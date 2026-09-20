/**
 * The caller loop (spec 12.3, 12.4, and everything `runRound` deliberately
 * refuses to do).
 *
 * WHY THIS MODULE EXISTS AND WHY IT IS NOT IN engine/
 *
 * `runRound` is pure (R1) and takes decisions pre-computed (R2). It never
 * invokes a policy, never diffs one round's settings against the last, and
 * never writes a learning period — 12.3 says outright that a pure function
 * cannot detect that a setting changed, so the caller must. But the spec's
 * module layout has `engine/`, `content/`, `agents/` and `ui/` and no home for
 * the caller. So four separate obligations had nowhere to live:
 *
 *   12.3  diff submitted decisions and write learningRoundsRemaining
 *   12.4  append every decision to decisionLog with its source
 *   13.3  commit capital, and leave the remainder to roll into ad budget
 *   4.5   apply a repositioning
 *
 * This file owns all four. It sits outside `engine/` because it holds the
 * controllers, and controllers may be Claude-backed; the engine may not be.
 *
 * WHAT A CONTROLLER RECEIVES
 *
 * Four things and nothing else (R3a): its own AdvertiserRoundReport for the
 * week just played, its own `getSelfView`, `getPublicView`, and its own report
 * for every week played so far, as revised since. Never `GameState`, never
 * another advertiser's record. This module is the only place that could break
 * that rule, which is why it is also the place a structural test points at.
 *
 * The fourth exists because the first never carries a return. Returns are
 * written back into the week whose clicks earned them, two to five weeks
 * later, so a controller that sees only the week just played cannot learn
 * what comes back - and three rival rules read zero because of it (C9). The
 * player's screens read the same revised history; a rival reading less would
 * be a privileged player path (R6).
 */

import { runRound } from './engine/round.js';
import { advertiserReport, attachQualityScores } from './engine/report.js';
import { reportedScore } from './engine/quality.js';
import { getPublicView, getSelfView } from './engine/insights.js';
import { logDecisions, decisionsForRound } from './engine/serialise.js';
import { reposition, canReposition } from './engine/positions.js';
import { pageAsItStands, rulesFor } from './content/landingPage.js';
import {
  LEARNING_ROUNDS, CAPEX_ALLOCATION_PAISE, CAPEX_DELAY_ROUNDS, TOTAL_ROUNDS,
  CAPEX_TARGETS, PREPAID_DISCOUNT_MAX_PAISE,
} from './engine/constants.js';

/**
 * Ask every controller for its decisions, then run the round.
 *
 * Async because a Claude-backed controller returns a promise. A rule-based one
 * returns a plain object and `await` passes it straight through, so the two
 * are the same shape to this loop — which is the point of R2.
 *
 * @param {object} gameState
 * @param {Object<string, Function>} controllers by advertiser id
 * @param {object} [options] passed through to runRound; `sources` names each
 *   controller for the decision log
 * @returns {Promise<{round: number, report: object, insights: object, raw: object, nextGameState: object}>}
 */
export async function playRound(gameState, controllers, options = {}) {
  const { sources = {}, ...runOptions } = options;
  const previous = lastReport(gameState);
  const publicViews = new Map();

  const submitted = {};
  for (const advertiser of gameState.advertisers) {
    const controller = controllers[advertiser.id];
    if (!controller || advertiser.active === false) continue;

    // Built per viewer: insights are the viewer's own row against each rival.
    if (!publicViews.has(advertiser.id)) {
      publicViews.set(advertiser.id, getPublicView(gameState, advertiser.id));
    }

    const decision = await controller(
      getSelfView(gameState, advertiser.id),
      previous ? advertiserReport(previous, advertiser.id) : null,
      publicViews.get(advertiser.id),
      ownHistory(gameState, advertiser.id),
    );
    if (decision) submitted[advertiser.id] = decision;
  }

  return submitRound(gameState, submitted, { ...runOptions, sources });
}

/**
 * Run one round from decisions that already exist.
 *
 * Split out from `playRound` so a replay, a test, or a human submitting on
 * behalf of the player uses exactly the same path as a policy. There is no
 * privileged route into a round **(R6)**.
 *
 * @param {object} gameState
 * @param {Object<string, object>} decisions by advertiser id
 * @param {object} [options]
 * @returns {{round: number, report: object, insights: object, raw: object, nextGameState: object}}
 */
export function submitRound(gameState, decisions, options = {}) {
  const { sources = {}, ...runOptions } = options;

  // Structural decisions first: they change what the round is run ON, not what
  // the round is told. runRound's `decisions` carries campaign and adGroups
  // only, which is all it declares.
  const prepared = {
    ...gameState,
    advertisers: gameState.advertisers.map((a) => landPage(landCreative(applyStructural(
      a, decisions[a.id], gameState.round, gameState.budgetSchedule,
    ), gameState.round), gameState.round)),
  };

  const result = runRound(prepared, {
    ...runOptions,
    decisions: campaignDecisionsOnly(decisions),
  });

  result.nextGameState.decisionLog = logDecisions(
    gameState.decisionLog, gameState.round, decisions, sources,
  );

  // The report leaves runRound with an empty `quality` block, because nothing
  // in engine/ may read reportedScore (hard rule 4) - so the caller attaches
  // it, and this is the caller. Until game.js existed nobody did, and a played
  // game showed the player no Quality Score at all.
  const report = withQualityScores(result.report, result.nextGameState, gameState.round);
  // `runRound` types `insights` optional because its counterfactual path
  // returns without one. This is never that path.
  return /** @type {{round: number, report: object, insights: object, raw: object, nextGameState: object}} */ ({
    ...result,
    report,
    nextGameState: {
      ...result.nextGameState,
      history: result.nextGameState.history.map((h) => (h.round === report.round ? report : h)),
    },
  });
}

/**
 * Replay one logged round through the same door the live round came in by.
 *
 * NOT `engine/serialise.js`'s `replayGame`. That runs `runRound` alone, which
 * is right for the engine and wrong for a game played through this module: it
 * skips the structural decisions (capital, repositioning), the self-written ad
 * landing on its round, and the Quality Scores attached to each report.
 * Measured on a real twelve-week game, its costs do not match the ones the
 * player saw. Every decision in the log came in through `submitRound`, so a
 * replay has to go back through it — with the log's own sources, so the log
 * the replay writes is the log it read.
 *
 * Driven by the state's round rather than by which rounds have entries: a
 * week in which nobody decided anything logs nothing and still happened.
 *
 * @param {object} gameState the state before the round
 * @param {object[]} decisionLog the whole log; this round's entries are used
 * @param {object} [options] passed through to `submitRound`
 * @returns {{round: number, report: object, insights: object, raw: object, nextGameState: object}}
 */
export function replayRound(gameState, decisionLog, options = {}) {
  const round = gameState.round;
  const sources = {};
  for (const entry of decisionLog ?? []) {
    if (entry.round === round) sources[entry.advertiserId] = entry.source;
  }
  return submitRound(gameState, decisionsForRound(decisionLog, round), { ...options, sources });
}

/**
 * Rebuild a game from its first state and its log, up to a given round.
 *
 * What a save restores from (stage A4): the start and the log, never the state,
 * which reaches 4.5 MB by week 12 while the two together are about 260 KB.
 *
 * @param {object} initialState the state before the first logged round
 * @param {object[]} decisionLog
 * @param {object} options `throughRound` is the last round to replay; the rest
 *   is passed through to `submitRound`
 * @returns {{finalState: object, reports: object[], insights: object[]}}
 */
export function replayLog(initialState, decisionLog, options) {
  const { throughRound, ...runOptions } = options;
  const early = (decisionLog ?? []).find((e) => e.round < initialState.round);
  if (early) {
    throw new Error(
      `replay desynchronised: the log has round ${early.round}, the state starts at ${initialState.round}`,
    );
  }

  let state = initialState;
  const reports = [];
  const insights = [];
  while (state.round <= throughRound) {
    const out = replayRound(state, decisionLog, runOptions);
    reports.push(out.report);
    insights.push(out.insights);
    state = out.nextGameState;
  }
  return { finalState: state, reports, insights };
}

/**
 * The decision log with one advertiser's decision for one round taken out.
 *
 * What the debrief's "What if I hadn't?" replays (plans/2026-09-13-debrief.md):
 * the player's week, gone; every other advertiser's logged decision, kept.
 *
 * @param {object[]} decisionLog
 * @param {{advertiserId: string, round: number}} which
 * @returns {object[]} a new log
 */
export function logWithout(decisionLog, { advertiserId, round }) {
  return (decisionLog ?? []).filter(
    (entry) => !(entry.advertiserId === advertiserId && entry.round === round),
  );
}

/**
 * Replay a game with one advertiser's decision for one round removed.
 *
 * RIVALS MAKE THE MOVES THEY MADE. Their logged decisions are replayed as they
 * were, so the difference is this decision's alone, in a market that did not
 * react to its absence. A real market might have, and the debrief says so.
 *
 * The advertiser's later decisions still happen. Keyword and negative lists
 * are submitted whole, so a later submission can carry the removed change back
 * in; the debrief therefore compares only the weeks before the next decision.
 *
 * @param {object} initialState the state before the first logged round
 * @param {object[]} decisionLog
 * @param {object} options `advertiserId` and `round` name the decision;
 *   `throughRound` and the rest go to `replayLog`
 * @returns {{finalState: object, reports: object[], insights: object[]}}
 */
export function replayWithout(initialState, decisionLog, { advertiserId, round, ...options }) {
  return replayLog(initialState, logWithout(decisionLog, { advertiserId, round }), options);
}

/**
 * Each advertiser's own reported scores, attached to its own row (spec 15.2).
 *
 * `currentRound` is the round just played, which EXCLUDES it: 9.3 computes from
 * completed prior rounds only, so the score a player reads beside round 5's
 * numbers is built from rounds 1 to 4. That lag is the point - it is what makes
 * "improving ad copy moves qualitySignal immediately and leaves reportedScore
 * unchanged" true, and why round 1 shows null.
 *
 * Safe to store in history: the window only ever reads rounds strictly before
 * this one, and qualityHistory is appended to rather than revised, so a round's
 * score is stable once written. What the player saw stays what they saw.
 */
/**
 * Ship an advertiser's own copy on the round it was commissioned to arrive.
 *
 * WHAT IS LATE IS THE COPY, NOT ITS EFFECT. `CLAUDE.md` requires an ad copy
 * change to move `qualitySignal` immediately and leave `reportedScore`
 * unchanged in the same round; a grade that faded in over several rounds would
 * break exactly that split. So the grade is computed at round 0, held whole,
 * and applied whole here — from this auction onward it counts in full.
 *
 * It runs in the caller layer for the same reason the Quality Score does: the
 * engine resolves auctions and has no business knowing that someone was hired.
 *
 * Since 2026-09-14 no new game sets a `pendingGrade` (I11): a self-written ad
 * runs from week 1. This stays for saves made before then, which carry one due
 * at round 3 in their first state and must replay exactly.
 *
 * @param {object} advertiser
 * @param {number} round the round about to run
 * @returns {object} the advertiser, unchanged unless something was due
 */
function landCreative(advertiser, round) {
  const creative = advertiser.creative;
  if (!creative?.pendingGrade || round < creative.liveAtRound) return advertiser;

  const [first, ...rest] = advertiser.adGroups ?? [];
  if (!first) return advertiser;

  return {
    ...advertiser,
    // Spread the components OVER the existing grade, so `contentHash`,
    // `gradedAtRound` and `source` survive. 5.2 caches on that hash, and a
    // grade that lost it would be treated as never graded.
    adGroups: [
      { ...first, gradedQuality: { ...first.gradedQuality, ...creative.pendingGrade } },
      ...rest,
    ],
    // Cleared, so a later round cannot apply the same copy twice.
    creative: { ...creative, pendingGrade: null },
  };
}

/**
 * Put the page as it stands in front of this round's auctions.
 *
 * THE OWNER'S DECISION, 2026-09-17. A page built from capital is re-written each
 * week from the capital live that week, and its landing page grade re-scored
 * (`pageAsItStands`). It used to be written once, in round 0, from everything
 * committed and graded from week 1, so page capital counted three weeks before
 * the work existed and capital committed at week 5 never reached the page.
 *
 * Here, beside `landCreative`, for that function's reason: it changes a grade
 * when its week arrives, which is the caller's business, not the auction's.
 *
 * Only the landing page part moves. The copy grades read headlines and
 * descriptions alone, so a hired writer's level and a self-writer's words stand.
 * It is not an edit to the ad: no decision was made, so nothing starts learning.
 *
 * An advertiser without the mark is left alone: rivals, whose page grade is
 * their authored character, and games saved before this change, which keep the
 * rule they were played under (the owner's choice).
 *
 * And graded by the rules the game was begun under (`rulesFor`): a game saved
 * before grading only what Google names (C, 2026-09-17) keeps the length rule,
 * the owner's choice again.
 *
 * @param {object} advertiser
 * @param {number} round the round about to run
 * @returns {object} the advertiser, unchanged unless its page has moved
 */
function landPage(advertiser, round) {
  const [first, ...rest] = advertiser.adGroups ?? [];
  if (!first?.pageBuiltFromCapital) return advertiser;

  const page = pageAsItStands(advertiser.capex, round, { rules: rulesFor(first) });
  if (first.ad?.landingPageDescription === page.description && first.gradedQuality?.landingPage === page.landingPage) {
    return advertiser;
  }

  // The grade's `contentHash` is left as it was. It is the grader's (agents/),
  // which this loop may not reach (R2), and it matters only to a model regrade
  // (5.2), which no played game runs: nothing here reads it.
  return {
    ...advertiser,
    adGroups: [{
      ...first,
      ad: { ...first.ad, landingPageDescription: page.description },
      gradedQuality: { ...first.gradedQuality, landingPage: page.landingPage },
    }, ...rest],
  };
}

function withQualityScores(report, state, currentRound) {
  const byAdvertiser = {};
  for (const advertiser of state.advertisers) {
    const own = {};
    for (const group of advertiser.adGroups ?? []) {
      for (const keyword of group.keywords ?? []) {
        own[keyword.id] = reportedScore(advertiser, keyword.id, currentRound);
      }
    }
    byAdvertiser[advertiser.id] = own;
  }
  return attachQualityScores(report, byAdvertiser);
}

/**
 * Play from here to the end of the game.
 *
 * @param {object} gameState
 * @param {Object<string, Function>} controllers
 * @param {object} [options] `rounds` defaults to TOTAL_ROUNDS
 * @returns {Promise<{finalState: object, reports: object[]}>}
 */
export async function playGame(gameState, controllers, options = {}) {
  // TOTAL_ROUNDS, not a literal 12. The two agree today, which is exactly why
  // the literal survived - it was found by a test asserting that every
  // constant has a reader, not by anything going wrong.
  const { rounds = TOTAL_ROUNDS, ...rest } = options;
  let state = gameState;
  const reports = [];
  while (state.round <= rounds) {
    const result = await playRound(state, controllers, rest);
    reports.push(result.report);
    state = result.nextGameState;
  }
  return { finalState: state, reports };
}

// ---------------------------------------------------------------------------
// Learning periods (spec 12.3, L7)
// ---------------------------------------------------------------------------

/**
 * Does this decision restart the learning clock?
 *
 * 12.3 is explicit about both halves, and the second half is the one worth
 * getting right. **Triggering:** switching `strategy`, changing any value in
 * `strategyParams`, or repositioning. **Not triggering:** keyword bid changes,
 * adding or removing keywords or negatives, editing ad copy, budget changes.
 *
 * The distinction is not arbitrary. A learning period exists because the bid
 * model has to re-estimate; editing a headline does not invalidate an estimate
 * of how often people convert, and a simulation that punished copy edits would
 * teach people not to improve their ads.
 *
 * @param {object} advertiser as it stands now
 * @param {object|undefined} decision
 * @returns {boolean}
 */
export function triggersLearning(advertiser, decision) {
  if (!decision) return false;

  if (decision.position && isRepositioning(advertiser, decision.position)) return true;

  const campaign = decision.campaign;
  if (!campaign) return false;

  if (campaign.strategy !== undefined && campaign.strategy !== advertiser.campaign.strategy) {
    return true;
  }
  if (campaign.strategyParams !== undefined) {
    const before = advertiser.campaign.strategyParams ?? {};
    const after = campaign.strategyParams;
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) if (before[key] !== after[key]) return true;
  }
  return false;
}

function isRepositioning(advertiser, to) {
  return to.price !== advertiser.position.price || to.purpose !== advertiser.position.purpose;
}

// ---------------------------------------------------------------------------
// Structural decisions
// ---------------------------------------------------------------------------

/**
 * Apply the parts of a decision that `runRound` does not accept.
 *
 * Repositioning and capital commitment change the advertiser rather than the
 * campaign, so they are applied here and the round is then run on the result.
 * `runRound` charges for both (13.3, 4.5); this only records them.
 */
function applyStructural(advertiser, decision, round, budgetSchedule) {
  let next = advertiser;

  if (decision?.position && isRepositioning(advertiser, decision.position)) {
    if (!canReposition(advertiser, round)) {
      throw new RangeError(
        `${advertiser.id} may not reposition in round ${round}`,
      );
    }
    next = { ...next, position: reposition(next.position, decision.position, round) };
  }

  if (decision?.capex) {
    next = { ...next, capex: applyCapex(next.capex, decision.capex, round, budgetSchedule) };
  }

  if (triggersLearning(advertiser, decision)) {
    next = {
      ...next,
      bidding: { ...next.bidding, learningRoundsRemaining: LEARNING_ROUNDS },
    };
  }

  return next;
}

/**
 * Commit this round's capital allocation.
 *
 * Investment is cumulative across both allocations (13.3), so a three-way
 * split at round 1 can be topped up at round 5. Each tranche lands
 * `CAPEX_DELAY_ROUNDS` later, and whatever is left uncommitted is recorded so
 * `runRound` can roll it into the month's ad budget.
 *
 * ONLY IN AN ALLOCATION ROUND, and the guard is not ceremonial. The engine
 * never DEBITS capital: it only converts whatever was left uncommitted into ad
 * budget, and only at `capexAllocationRounds` (`applyBudgetAdjustments`). So a
 * commitment made in any other round has no allocation to consume and nothing
 * to forfeit — it is a free ₹1,00,000 of investment, repeatable every round.
 * Measured before this guard existed: round 7 recorded the tranche exactly as
 * round 1 did, with the month's budget untouched.
 *
 * @param {object} capex current block
 * @param {Object<string, number>} allocation paise per target
 * @param {number} round
 * @param {{capexAllocationRounds?: number[]}} [budgetSchedule]
 * @returns {object} a new capex block
 */
function applyCapex(capex, allocation, round, budgetSchedule) {
  const allowed = budgetSchedule?.capexAllocationRounds ?? [];
  if (!allowed.includes(round)) {
    throw new RangeError(
      `capital may be committed only in ${allowed.length > 0 ? `round ${allowed.join(' and ')}` : 'a capex allocation round'}`
      + `, not round ${round}`,
    );
  }

  const committed = { ...capex.committed };
  const pending = [...(capex.pending ?? [])];
  let spent = 0;

  for (const [target, paise] of Object.entries(allocation)) {
    // AGAINST THE LIST, NOT AGAINST WHATEVER THIS ADVERTISER HAPPENS TO HOLD.
    // It used to test `target in committed`, so a target was "unknown" whenever
    // an advertiser's block predated it — which is every state written before
    // the fourth target existed (I29), and every fixture built by hand.
    if (!CAPEX_TARGETS.includes(target)) {
      throw new RangeError(`unknown capex target "${target}"`);
    }
    if (!(target in committed)) committed[target] = 0;
    if (!Number.isSafeInteger(paise) || paise < 0) {
      throw new RangeError(`capex for ${target} must be non-negative integer paise, got ${String(paise)}`);
    }
    if (paise === 0) continue;
    spent += paise;
    committed[target] += paise;
    pending.push({ target, paise, liveAtRound: round + CAPEX_DELAY_ROUNDS });
  }

  if (spent > CAPEX_ALLOCATION_PAISE) {
    throw new RangeError(
      `capex allocation of ${spent} paise exceeds the ${CAPEX_ALLOCATION_PAISE} available`,
    );
  }

  return {
    ...capex,
    committed,
    pending,
    // Rolls into this month's ad budget, raising its hard cap (13.3).
    remainingUnallocatedPaise: CAPEX_ALLOCATION_PAISE - spent,
  };
}

// ---------------------------------------------------------------------------

/**
 * A prepaid discount is money off every prepaid order, so it is checked before
 * the round spends it (I34).
 *
 * Rejected rather than clamped. A clamp would let a controller ask for ₹500 and
 * be quietly charged for ₹100, which is the shape of bug that survives a whole
 * game because every number downstream still looks reasonable.
 */
function assertPrepaidDiscount(paise, id) {
  if (paise === undefined) return;
  if (!Number.isSafeInteger(paise) || paise < 0) {
    throw new RangeError(`${id}: prepaid discount must be non-negative integer paise, got ${String(paise)}`);
  }
  if (paise > PREPAID_DISCOUNT_MAX_PAISE) {
    throw new RangeError(`${id}: prepaid discount ${paise} is over the ${PREPAID_DISCOUNT_MAX_PAISE} cap`);
  }
}

function campaignDecisionsOnly(decisions) {
  const out = {};
  for (const [id, decision] of Object.entries(decisions ?? {})) {
    if (!decision) continue;
    const slice = {};
    if (decision.campaign) {
      assertPrepaidDiscount(decision.campaign.prepaidDiscountPaise, id);
      slice.campaign = decision.campaign;
    }
    if (decision.adGroups) slice.adGroups = decision.adGroups;
    if (Object.keys(slice).length > 0) out[id] = slice;
  }
  return out;
}

function lastReport(gameState) {
  const history = gameState.history ?? [];
  return history.length > 0 ? history[history.length - 1] : null;
}

/**
 * One advertiser's own slice of every week played, oldest first, as revised
 * so far (R3a). The same `advertiserReport` the week just played goes through,
 * so nothing of any other advertiser can come with it.
 */
function ownHistory(gameState, advertiserId) {
  return (gameState.history ?? [])
    .map((report) => advertiserReport(report, advertiserId))
    .filter(Boolean);
}
