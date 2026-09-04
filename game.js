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
 * Three things and nothing else (R3a): its own AdvertiserRoundReport, its own
 * `getSelfView`, and `getPublicView`. Never `GameState`, never another
 * advertiser's record. This module is the only place that could break that
 * rule, which is why it is also the place a structural test points at.
 */

import { runRound } from './engine/round.js';
import { advertiserReport } from './engine/report.js';
import { getPublicView, getSelfView } from './engine/insights.js';
import { logDecisions } from './engine/serialise.js';
import { reposition, canReposition } from './engine/positions.js';
import {
  LEARNING_ROUNDS, CAPEX_ALLOCATION_PAISE, CAPEX_DELAY_ROUNDS, TOTAL_ROUNDS,
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
    advertisers: gameState.advertisers.map((a) => applyStructural(a, decisions[a.id], gameState.round)),
  };

  const result = runRound(prepared, {
    ...runOptions,
    decisions: campaignDecisionsOnly(decisions),
  });

  result.nextGameState.decisionLog = logDecisions(
    gameState.decisionLog, gameState.round, decisions, sources,
  );
  return result;
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
function applyStructural(advertiser, decision, round) {
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
    next = { ...next, capex: applyCapex(next.capex, decision.capex, round) };
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
 * @param {object} capex current block
 * @param {Object<string, number>} allocation paise per target
 * @param {number} round
 * @returns {object} a new capex block
 */
function applyCapex(capex, allocation, round) {
  const committed = { ...capex.committed };
  const pending = [...(capex.pending ?? [])];
  let spent = 0;

  for (const [target, paise] of Object.entries(allocation)) {
    if (!(target in committed)) {
      throw new RangeError(`unknown capex target "${target}"`);
    }
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

function campaignDecisionsOnly(decisions) {
  const out = {};
  for (const [id, decision] of Object.entries(decisions ?? {})) {
    if (!decision) continue;
    const slice = {};
    if (decision.campaign) slice.campaign = decision.campaign;
    if (decision.adGroups) slice.adGroups = decision.adGroups;
    if (Object.keys(slice).length > 0) out[id] = slice;
  }
  return out;
}

function lastReport(gameState) {
  const history = gameState.history ?? [];
  return history.length > 0 ? history[history.length - 1] : null;
}
