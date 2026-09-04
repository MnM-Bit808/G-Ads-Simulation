/**
 * The decision form (build step 14, slice three) — what the player changes
 * between weeks, which is the whole game.
 *
 * THE TRAP THIS MODULE IS SHAPED AROUND
 *
 * A player decision must be RETURNED from a controller, never written into
 * state. `submitRound` is what applies structural changes, writes the learning
 * period 12.3 asks for, and appends to `decisionLog` for 12.4's replay.
 * Reaching into `game.state.advertisers[0]` and editing a bid there produces a
 * game that runs, looks right, and silently has three mechanics missing.
 *
 * So the form never sees an advertiser. It is built from `getSelfView`, which
 * deep-copies on the way out — the form physically cannot write through into
 * `GameState` — and it hands back a decision object that goes in by the same
 * door a policy uses. There is no privileged player path (R6).
 *
 * WHAT IT MAY AND MAY NOT KNOW
 *
 * The preview reads the PUBLIC query list (16.1: id, text, volume, intent) and
 * the player's own search terms report. It never reads a query's tags, and it
 * therefore cannot tell the player how far a broad keyword will travel — which
 * is correct rather than a limitation. 8.2 is explicit that you discover what
 * broad match dragged you into *after the fact*, from the report, and blocking
 * it means naming its literal words.
 *
 * Every string operation here is the engine's own (`blockedBy`, `normalise`).
 * A preview that reimplemented the matcher would agree with it right up until
 * one of them changed, which is exactly how the v0.1 prototypes went wrong.
 */

import { el, add, table, field, input, select, rupees, whole, ratio } from './dom.js';
import { blockedBy, normalise, tokenise } from '../engine/matching.js';
import { STRATEGIES } from '../engine/strategies.js';
import { canReposition, isOneStep, allCells, parseCell, cellKey } from '../engine/positions.js';
import {
  LEARNING_ROUNDS, MAX_BID_MULTIPLE, CAPEX_ALLOCATION_PAISE, CAPEX_DELAY_ROUNDS,
  CAPEX_TIER_CURVE, REPOSITION_COST_PAISE, ROUNDS_PER_MONTH,
} from '../engine/constants.js';
import { triggersLearning } from '../game.js';
import { tagKeywordOffline, tagContentHashOf } from '../agents/keywordTagger.js';

/** The three string negatives of 8.2, and no fourth. Tags never appear (H3). */
export const NEGATIVE_TYPES = ['broad', 'phrase', 'exact'];
const MATCH_TYPES = ['exact', 'phrase', 'broad'];

/**
 * Which `strategyParams` key each strategy actually reads.
 *
 * This is knowledge about `rawBid` in `engine/strategies.js`, restated here so
 * the form can lock the parameter to the strategy using it. It is therefore
 * CHECKED against the engine rather than trusted: `decisions.test.js` asserts
 * every strategy this table gives a key to throws without it, and every
 * strategy it gives none to runs on empty params.
 *
 * The lock exists because of a sharp edge in 12.3. That section triggers a
 * learning period on "changing any value in `strategyParams`" — and the params
 * object carries BOTH keys at all times, whatever is running. Left editable,
 * nudging the target ROAS while running Target CPA would cost two rounds of
 * doubled prediction error for a number that touches no bid.
 */
export const STRATEGY_PARAM = Object.freeze({
  manual: null,
  maxClicks: null,
  targetCpa: 'targetCpaPaise',
  targetRoas: 'targetRoas',
  maxConv: null,
});

/**
 * How each strategy is described on screen.
 *
 * `predicts` is taken from the engine (`STRATEGIES[x].predictsConversions`)
 * rather than repeated here, because it is the fact that matters: a strategy
 * that never predicts conversions cannot be hurt by a learning period, which is
 * why manual behaves predictably on a thin account (12.2).
 */
const STRATEGY_COPY = {
  manual: ['Manual CPC', 'Bids exactly what you set, every hour, whatever the data says.'],
  maxClicks: ['Maximise clicks', 'Buys as much traffic as the budget allows. It does not care what converts.'],
  targetCpa: ['Target CPA', 'Bids for a cost per conversion you name, from what it has learned converts.'],
  targetRoas: ['Target ROAS', 'Bids for a return on ad spend you name, using your own order value.'],
  maxConv: ['Maximise conversions', 'Like maximise clicks, but leaning toward the hours its history says convert.'],
};

const NEGATIVE_HELP = {
  broad: 'blocks any search containing all these words, in any order',
  phrase: 'blocks any search containing these words in this order',
  exact: 'blocks only this search, word for word',
};

// ---------------------------------------------------------------------------
// The draft
// ---------------------------------------------------------------------------

/**
 * A working copy of the account, and the untouched original to diff against.
 *
 * @param {object} selfView output of `getSelfView` — never an advertiser record
 * @returns {object} draft
 */
/**
 * The amounts the S-curve actually distinguishes, taken from the curve itself.
 *
 * Not a hand-copied list. `CAPEX_TIER_CURVE` is what `businessFor` interpolates
 * between, so offering exactly its knots means every choice on screen is a
 * point the model has an opinion about, and a change to the curve moves the
 * form with it.
 */
export const CAPEX_STEPS = CAPEX_TIER_CURVE.map((point) => point.paise);

/** The three targets of 13.3, and what each one moves. */
const CAPEX_TARGETS = [
  ['sizeGuide', 'Size guide', 'Fewer returns.'],
  ['photography', 'Photography', 'More of your visitors buy.'],
  ['landingPage', 'Landing page', 'Better quality, so a cheaper click.'],
];

/**
 * @param {object} selfView output of `getSelfView` — never an advertiser record
 * @param {object} [options]
 * @param {number[]} [options.allocationRounds] `budgetSchedule.capexAllocationRounds`
 * @returns {object} draft
 */
export function createDraft(selfView, options = {}) {
  // Cloned again although getSelfView already cloned. Cheap, and it means this
  // function is safe whatever a future caller hands it.
  const adGroups = structuredClone(selfView.adGroups ?? []);
  const negatives = structuredClone(selfView.campaign?.negatives ?? []);
  const keywords = structuredClone(adGroups[0]?.keywords ?? []);
  const strategy = selfView.campaign?.strategy ?? 'manual';
  const strategyParams = structuredClone(selfView.campaign?.strategyParams ?? {});

  return {
    adGroups,
    negatives,
    keywords,
    strategy,
    strategyParams,
    // Read-only here: what the account knows about itself, for the form to
    // show. `bidding` carries observedConvRate, observedConversions and
    // learningRoundsRemaining — an advertiser's own measurements, never the
    // truth behind them (16.2).
    bidding: structuredClone(selfView.bidding ?? {}),
    position: structuredClone(selfView.position ?? null),

    // 13.3 and 4.5, both of which are open for one round only.
    round: selfView.round,
    capexOpen: inGameAllocationRounds(options.allocationRounds).includes(selfView.round),
    repositionOpen: canReposition({ position: selfView.position }, selfView.round),
    capex: { sizeGuide: 0, photography: 0, landingPage: 0 },
    committed: structuredClone(selfView.capex?.committed ?? {}),
    monthlyBudgetPaise: selfView.campaign?.monthlyBudgetPaise ?? 0,
    monthSpentPaise: selfView.campaign?.monthSpentPaise ?? 0,

    // 13.4's middle level. `buildBudgets` reads
    // `split[(round - 1) % ROUNDS_PER_MONTH]`, so this is the box the round
    // about to run will actually spend from.
    weeklySplitPaise: [...(selfView.campaign?.weeklySplitPaise ?? [])],
    weekIndex: (selfView.round - 1) % ROUNDS_PER_MONTH,

    base: {
      negatives: structuredClone(negatives),
      keywords: structuredClone(keywords),
      strategy,
      strategyParams: structuredClone(strategyParams),
      position: structuredClone(selfView.position ?? null),
      weeklySplitPaise: [...(selfView.campaign?.weeklySplitPaise ?? [])],
    },
  };
}

/**
 * The allocation rounds a PLAYING advertiser is asked about.
 *
 * The first one is spent in round 0 (spec 17 step 9), before the game starts —
 * `setup.js` has already written `remainingUnallocatedPaise` from those
 * choices. Offering it again in round 1 would let the player claim the rollover
 * on top of an investment they already made, so every allocation round except
 * the first belongs to the decision form.
 */
const inGameAllocationRounds = (rounds) => (rounds ?? []).slice(1);

/**
 * The decision to submit, or null when nothing changed.
 *
 * Only what moved is returned. An untouched form is indistinguishable from the
 * `() => null` controller the player had before this slice existed, so opening
 * the form and closing it does not write a decision into the log.
 *
 * `runRound` merges `campaign` shallowly and REPLACES `adGroups` wholesale, so
 * the ad and its grade are carried through untouched rather than omitted.
 *
 * @param {object} draft
 * @returns {object|null} `{ campaign?, adGroups? }`
 */
export function toDecision(draft) {
  const decision = {};
  const campaign = {};

  if (!sameNegatives(draft.negatives, draft.base.negatives)) {
    campaign.negatives = structuredClone(draft.negatives);
  }
  if (!sameSplit(draft.weeklySplitPaise, draft.base.weeklySplitPaise)) {
    campaign.weeklySplitPaise = [...draft.weeklySplitPaise];
  }
  if (biddingChanged(draft)) {
    campaign.strategy = draft.strategy;
    // The WHOLE params object, both keys, always. `applyDecision` merges
    // `campaign` shallowly, so a partial one would replace the stored object
    // and drop the parameter the other strategy needs — and `rawBid` throws
    // when it is missing rather than substituting a plausible number.
    campaign.strategyParams = structuredClone(draft.strategyParams);
  }
  if (Object.keys(campaign).length > 0) decision.campaign = campaign;
  if (!sameKeywords(draft.keywords, draft.base.keywords)) {
    decision.adGroups = structuredClone(draft.adGroups).map((group, i) => (
      i === 0 ? { ...group, keywords: structuredClone(draft.keywords) } : group
    ));
  }

  // Sent whether or not the player touched it, and only in an allocation
  // round. Omitting it does not mean "decline": it means the allocation is
  // never claimed, so `remainingUnallocatedPaise` stays zero and ₹1,00,000
  // vanishes — no investment AND no rollover into the month's budget.
  // Declining has to be an explicit zero.
  if (draft.capexOpen) decision.capex = { ...draft.capex };

  if (draft.repositionOpen && movedPosition(draft)) {
    decision.position = { price: draft.position.price, purpose: draft.position.purpose };
  }
  return Object.keys(decision).length > 0 ? decision : null;
}

/**
 * Everything this draft would change, each with a way to take it back.
 *
 * This is what the player reads before committing. A form that hides a
 * consequence it could show is being cruel rather than honest.
 *
 * @param {object} draft
 * @returns {Array<{kind: string, label: string, detail: string, undo: Function}>}
 */
export function changes(draft) {
  const rows = [];

  if (draft.repositionOpen && movedPosition(draft)) {
    rows.push({
      kind: 'position',
      label: `Position: ${cellOf(draft.base.position)} → ${cellOf(draft.position)}`,
      detail: `costs ${rupees(REPOSITION_COST_PAISE)} from this month, restarts the `
        + 'learning period, and any keyword you replace starts with no Quality Score',
      undo: () => setPosition(draft, cellOf(draft.base.position)),
    });
  }

  if (draft.capexOpen) {
    const spent = capexSpent(draft);
    const parts = CAPEX_TARGETS
      .filter(([key]) => draft.capex[key] > 0)
      .map(([key, label]) => `${rupees(draft.capex[key])} to ${label.toLowerCase()}`);
    rows.push({
      kind: 'capital',
      label: parts.length > 0
        ? `Capital: ${parts.join(', ')}`
        : `Capital: nothing committed to the business`,
      detail: `${rupees(CAPEX_ALLOCATION_PAISE - spent)} joins this month's advertising `
        + `budget instead${spent > 0 ? `, and the rest goes live in week ${draft.round + CAPEX_DELAY_ROUNDS}` : ''}`,
      // Nothing to take back when nothing was committed: the default IS the
      // decision, and the row is here to say so rather than to be undone.
      undo: spent > 0 ? () => resetCapex(draft) : null,
    });
  }

  draft.weeklySplitPaise.forEach((paise, index) => {
    const before = draft.base.weeklySplitPaise[index];
    if (paise === before) return;
    rows.push({
      kind: 'budget',
      label: `Week ${index + 1} budget ${rupees(before)} → ${rupees(paise)}`,
      detail: index === draft.weekIndex
        ? 'the week about to run'
        : `week ${index + 1} of this month, and the month resets the plan after that`,
      undo: () => setWeekBudget(draft, index, before),
    });
  });

  if (draft.strategy !== draft.base.strategy) {
    rows.push({
      kind: 'strategy',
      label: `Bidding: ${strategyName(draft.base.strategy)} → ${strategyName(draft.strategy)}`,
      detail: learningWarning(),
      undo: () => setStrategy(draft, draft.base.strategy),
    });
  } else {
    // Only reported when the strategy itself held still; otherwise the switch
    // above already carries the same learning period and saying it twice would
    // make one decision look like two.
    const key = STRATEGY_PARAM[draft.strategy];
    if (key && draft.strategyParams[key] !== draft.base.strategyParams[key]) {
      const format = key === 'targetCpaPaise' ? rupees : ratio;
      rows.push({
        kind: 'strategy-param',
        label: `${paramLabel(draft.strategy)} ${format(draft.base.strategyParams[key])}`
          + ` → ${format(draft.strategyParams[key])}`,
        detail: learningWarning(),
        undo: () => setStrategyParam(draft, draft.base.strategyParams[key]),
      });
    }
  }

  for (const negative of draft.negatives) {
    if (findNegative(draft.base.negatives, negative) === -1) {
      rows.push({
        kind: 'negative-added',
        label: `Block “${negative.text}”`,
        detail: `${negative.matchType} negative — ${NEGATIVE_HELP[negative.matchType]}`,
        undo: () => dropNegative(draft, findNegative(draft.negatives, negative)),
      });
    }
  }
  draft.base.negatives.forEach((negative, index) => {
    if (findNegative(draft.negatives, negative) === -1) {
      rows.push({
        kind: 'negative-removed',
        label: `Stop blocking “${negative.text}”`,
        detail: `the ${negative.matchType} negative comes off`,
        undo: () => { draft.negatives.splice(index, 0, structuredClone(negative)); },
      });
    }
  });

  for (const keyword of draft.keywords) {
    const before = draft.base.keywords.find((k) => k.id === keyword.id);
    if (!before) {
      rows.push({
        kind: 'keyword-added',
        label: `Add “${keyword.text}”`,
        detail: `${keyword.matchType} match at ${rupees(keyword.bidPaise)}`
          + (keyword.tags.length === 0 ? ' — no tags, so broad will find nothing' : ''),
        undo: () => {
          draft.keywords.splice(draft.keywords.findIndex((k) => k.id === keyword.id), 1);
        },
      });
      continue;
    }
    if (keyword.matchType !== before.matchType) {
      rows.push({
        kind: 'keyword-match',
        label: `“${keyword.text}” → ${keyword.matchType} match`,
        detail: keyword.matchType === 'broad' && before.matchType !== 'broad'
          ? `was ${before.matchType}. Impressions rise and impression share falls`
          : `was ${before.matchType}`,
        undo: () => updateKeyword(draft, keyword.id, { matchType: before.matchType }),
      });
    }
    if (keyword.bidPaise !== before.bidPaise) {
      rows.push({
        kind: 'keyword-bid',
        label: `“${keyword.text}” bid ${rupees(before.bidPaise)} → ${rupees(keyword.bidPaise)}`,
        detail: keyword.bidPaise > before.bidPaise
          ? 'a higher bid buys rank, not a lower price'
          : 'a lower bid gives up rank before it saves money',
        undo: () => updateKeyword(draft, keyword.id, { bidPaise: before.bidPaise }),
      });
    }
    if ((keyword.active !== false) !== (before.active !== false)) {
      const paused = keyword.active === false;
      rows.push({
        kind: paused ? 'keyword-paused' : 'keyword-resumed',
        label: `${paused ? 'Pause' : 'Resume'} “${keyword.text}”`,
        detail: paused
          ? 'it stops entering auctions; its history stays'
          : 'it starts entering auctions again',
        undo: () => updateKeyword(draft, keyword.id, { active: before.active !== false }),
      });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Capital (13.3) and position (4.5) — one round each
// ---------------------------------------------------------------------------

/**
 * Commit part of this round's allocation to one target.
 *
 * Cumulative across allocations (13.3): what is set here is added to what was
 * committed before, so a round-1 split lands somewhere different on the S-curve
 * once it is topped up.
 *
 * @param {object} draft
 * @param {string} target sizeGuide | photography | landingPage
 * @param {number} paise
 * @returns {{ok: boolean, reason?: string}}
 */
export function setCapex(draft, target, paise) {
  if (!draft.capexOpen) return { ok: false, reason: 'no capital is allocated this round' };
  if (!(target in draft.capex)) return { ok: false, reason: `unknown target "${target}"` };
  if (!Number.isSafeInteger(paise) || paise < 0) {
    return { ok: false, reason: 'an amount is a whole number of paise, or none' };
  }
  const others = capexSpent(draft) - draft.capex[target];
  if (others + paise > CAPEX_ALLOCATION_PAISE) {
    return { ok: false, reason: `that is more than the ${rupees(CAPEX_ALLOCATION_PAISE)} available` };
  }
  draft.capex = { ...draft.capex, [target]: paise };
  return { ok: true };
}

/** Back to committing nothing, which rolls the whole allocation into budget. */
export function resetCapex(draft) {
  draft.capex = { sizeGuide: 0, photography: 0, landingPage: 0 };
}

/**
 * Move one step on the grid, or back to where you started.
 *
 * Guarded by the engine's own `isOneStep` rather than a restatement of 4.5.
 * `reposition` throws on anything illegal instead of clamping — a silently
 * corrected move would charge the cost and deliver a cell nobody asked for —
 * so the form must not offer one.
 *
 * @param {object} draft
 * @param {string} cell e.g. "mid|lifestyle"
 * @returns {{ok: boolean, reason?: string}}
 */
export function setPosition(draft, cell) {
  if (!draft.repositionOpen) {
    return { ok: false, reason: 'the repositioning window is not open' };
  }
  if (!allCells().includes(cell)) return { ok: false, reason: `not a grid cell: "${cell}"` };

  const to = parseCell(cell);
  const from = draft.base.position;
  const back = to.price === from.price && to.purpose === from.purpose;
  if (!back && !isOneStep(from, to)) {
    return { ok: false, reason: 'that is more than one step from where you are' };
  }
  draft.position = { ...draft.position, price: to.price, purpose: to.purpose };
  return { ok: true };
}

/**
 * The month's advertising budget this draft would produce.
 *
 * Mirrors `applyBudgetAdjustments` in `engine/round.js`, which at an allocation
 * round adds whatever capital was left uncommitted and subtracts the
 * repositioning cost from the same month. The two interact, and a player who
 * commits everything AND moves finds their month halved — which has to be a
 * figure on screen rather than a discovery. `decisions.test.js` asserts this
 * agrees with what the round actually reports, so the mirror cannot drift.
 *
 * @param {object} draft
 * @returns {number} integer paise
 */
export function monthBudgetAfter(draft) {
  let delta = draft.capexOpen ? CAPEX_ALLOCATION_PAISE - capexSpent(draft) : 0;
  if (draft.repositionOpen && movedPosition(draft)) delta -= REPOSITION_COST_PAISE;
  return Math.max(0, draft.monthlyBudgetPaise + delta);
}

const capexSpent = (draft) => Object.values(draft.capex).reduce((a, b) => a + b, 0);
const cellOf = (position) => cellKey(position.price, position.purpose);

function movedPosition(draft) {
  const from = draft.base.position;
  const to = draft.position;
  if (!from || !to) return false;
  return from.price !== to.price || from.purpose !== to.purpose;
}

// ---------------------------------------------------------------------------
// The weekly split (13.4)
// ---------------------------------------------------------------------------

/**
 * Plan one week of this month.
 *
 * A week that has already run is refused. `buildBudgets` only ever reads the
 * index of the round about to play, so editing a spent week changes nothing —
 * offering it would be a control that does nothing, which is worse than not
 * offering it.
 *
 * Zero is allowed. Going dark for a week is a legitimate play and 13.2 discusses
 * it directly; it is the month's hard cap that is not negotiable, not this.
 *
 * @param {object} draft
 * @param {number} index 0..ROUNDS_PER_MONTH-1
 * @param {number} paise
 * @returns {{ok: boolean, reason?: string}}
 */
export function setWeekBudget(draft, index, paise) {
  if (!Number.isInteger(index) || index < 0 || index >= draft.weeklySplitPaise.length) {
    return { ok: false, reason: `no week ${String(index)} in this month` };
  }
  if (index < draft.weekIndex) {
    return { ok: false, reason: 'that week has already run' };
  }
  if (!Number.isSafeInteger(paise) || paise < 0) {
    return { ok: false, reason: 'a week is a whole number of paise, or nothing' };
  }
  const next = [...draft.weeklySplitPaise];
  next[index] = paise;
  draft.weeklySplitPaise = next;
  return { ok: true };
}

/**
 * What is wrong with this plan, said in rupees, or null.
 *
 * It compares what is planned for the weeks STILL TO RUN against what is left
 * of the month, and not the whole split against the whole month. Mid-month the
 * second question is the wrong one: weeks 1 and 2 spending ₹8,963 and ₹30,120
 * of a planned ₹67,000 each leaves far more in the pot than the split's total
 * suggests, and warning off a total of ₹3,21,000 when only ₹1,87,000 is
 * actually planned ahead is crying wolf.
 *
 * At the top of a month the two are the same question — nothing has run, so the
 * remaining plan IS the split and the remaining money IS the month — and there
 * `decisions.test.js` asserts this agrees with `validateWeeklySplit`, which is
 * the rule `setup.js` enforces at round 0. That is where the engine has an
 * opinion; mid-month it has none, because 13.2's cap simply binds during the
 * round instead.
 *
 * @param {object} draft
 * @returns {string|null}
 */
export function splitProblem(draft) {
  const { remainingPaise, plannedPaise } = splitOutlook(draft);
  if (plannedPaise <= remainingPaise) return null;
  return `This plans ${rupees(plannedPaise)} against ${rupees(remainingPaise)} left in the month`;
}

/**
 * The month's money against the plan for what is left of it.
 *
 * 13.2's use-it-or-lose-it, made arithmetic: unspent money is gone at the month
 * boundary, so a plan that leaves the pot unfinished is a plan to throw some of
 * it away.
 *
 * @param {object} draft
 * @returns {{remainingPaise: number, plannedPaise: number, weeksLeft: number}}
 */
export function splitOutlook(draft) {
  const remainingPaise = Math.max(0, draft.monthlyBudgetPaise - draft.monthSpentPaise);
  const ahead = draft.weeklySplitPaise.slice(draft.weekIndex);
  return {
    remainingPaise,
    plannedPaise: ahead.reduce((a, b) => a + b, 0),
    weeksLeft: ahead.length,
  };
}

const sameSplit = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// ---------------------------------------------------------------------------
// Bidding (12)
// ---------------------------------------------------------------------------

/**
 * Choose a bid strategy.
 *
 * @param {object} draft
 * @param {string} strategy one of `STRATEGIES`
 * @returns {{ok: boolean, reason?: string}}
 */
export function setStrategy(draft, strategy) {
  if (!STRATEGIES[strategy]) return { ok: false, reason: `unknown strategy "${strategy}"` };
  draft.strategy = strategy;
  return { ok: true };
}

/**
 * Set the parameter belonging to the strategy currently chosen.
 *
 * There is no key argument on purpose. The strategy decides which parameter
 * exists, so the lock is structural rather than a rule the caller has to
 * remember — see `STRATEGY_PARAM` for why that matters under 12.3.
 *
 * @param {object} draft
 * @param {number} value paise for a target CPA, a plain ratio for a target ROAS
 * @returns {{ok: boolean, reason?: string}}
 */
export function setStrategyParam(draft, value) {
  const key = STRATEGY_PARAM[draft.strategy];
  if (!key) {
    return { ok: false, reason: `${strategyName(draft.strategy)} takes no target` };
  }
  if (key === 'targetCpaPaise' && !isPaise(value)) {
    return { ok: false, reason: 'a target CPA is a whole number of paise above zero' };
  }
  if (key === 'targetRoas' && !(typeof value === 'number' && Number.isFinite(value) && value > 0)) {
    return { ok: false, reason: 'a target ROAS is a ratio above zero' };
  }
  draft.strategyParams = { ...draft.strategyParams, [key]: value };
  return { ok: true };
}

/**
 * Will submitting this draft restart the learning clock?
 *
 * Asks `game.js`'s own predicate — the one `submitRound` will ask — rather than
 * restating 12.3 in the view. If the two ever disagreed, the player would be
 * warned about a penalty they do not get, or worse, not warned about one they
 * do.
 *
 * @param {object} draft
 * @returns {boolean}
 */
export function willTriggerLearning(draft) {
  const decision = toDecision(draft);
  if (!decision) return false;
  // The shape `triggersLearning` reads: the account as it stands BEFORE this
  // decision. `base.position`, not `draft.position` — handing it the draft's
  // own position would compare the new cell against itself and report no
  // learning period on the one change that most certainly causes one.
  return triggersLearning({
    campaign: { strategy: draft.base.strategy, strategyParams: draft.base.strategyParams },
    position: draft.base.position ?? {},
  }, decision);
}

const strategyName = (id) => STRATEGY_COPY[id]?.[0] ?? id;
const paramLabel = (id) => (STRATEGY_PARAM[id] === 'targetCpaPaise' ? 'Target CPA' : 'Target ROAS');

const learningWarning = () => `restarts the learning period: ${LEARNING_ROUNDS} weeks `
  + 'of much wider guesses while the bid model re-learns';

function biddingChanged(draft) {
  if (draft.strategy !== draft.base.strategy) return true;
  const before = draft.base.strategyParams ?? {};
  const after = draft.strategyParams ?? {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) if (before[key] !== after[key]) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Negatives (8.2)
// ---------------------------------------------------------------------------

/**
 * Stage a negative. String types only — negatives never touch the tag layer.
 *
 * @param {object} draft
 * @param {{text: string, matchType: string}} negative
 * @returns {{added: boolean, reason?: string}}
 */
export function addNegative(draft, { text, matchType } = {}) {
  if (!NEGATIVE_TYPES.includes(matchType)) {
    return { added: false, reason: 'a negative is broad, phrase or exact' };
  }
  const clean = String(text ?? '').trim();
  // Tokenised with the engine's own normaliser: "!!!" carries no words, and a
  // negative with no words would block nothing while looking like it works.
  if (tokenise(clean).length === 0) {
    return { added: false, reason: 'a negative needs at least one word' };
  }
  if (findNegative(draft.negatives, { text: clean, matchType }) !== -1) {
    return { added: false, reason: 'you are already blocking that' };
  }
  draft.negatives.push({ text: clean, matchType });
  return { added: true };
}

/** @param {object} draft @param {number} index */
export function dropNegative(draft, index) {
  if (index < 0 || index >= draft.negatives.length) return { dropped: false };
  draft.negatives.splice(index, 1);
  return { dropped: true };
}

/**
 * Which of the draft's negatives, if any, kills this search term.
 *
 * Used to grey the row out the moment a negative is staged, so the cost of a
 * broad negative is visible in the report it was written from rather than
 * discovered next week.
 *
 * @param {object} draft
 * @param {string} text
 * @returns {object|null}
 */
export function blocksTerm(draft, text) {
  return blockedBy({ text }, draft.negatives);
}

/**
 * What a negative would do, before it is committed.
 *
 * Split into searches you have paid for and searches you have not, because
 * those are two different arguments: the first is money you would stop
 * spending, the second is reach you would give up sight unseen.
 *
 * @param {{text: string, matchType: string}} negative
 * @param {{queries: Array<{id: string, text: string, volumeShareBp: number}>,
 *          terms: Object<string, {clicks: number, costPaise: number, conversions: number}>}} context
 * @returns {object}
 */
export function previewNegative(negative, { queries, terms }) {
  const empty = {
    blocked: [], spent: [], unspent: [],
    totals: { clicks: 0, costPaise: 0, conversions: 0 },
    costsConversions: false,
  };
  if (!NEGATIVE_TYPES.includes(negative?.matchType)) return empty;
  if (tokenise(negative.text ?? '').length === 0) return empty;

  const blocked = [];
  const spent = [];
  const unspent = [];
  const totals = { clicks: 0, costPaise: 0, conversions: 0 };

  for (const query of queries) {
    // The engine's matcher, not a copy of its rules.
    if (!blockedBy({ text: query.text }, [negative])) continue;
    const stats = terms?.[query.id];
    const row = {
      id: query.id,
      text: query.text,
      volumeShareBp: query.volumeShareBp,
      clicks: stats?.clicks ?? 0,
      costPaise: stats?.costPaise ?? 0,
      conversions: stats?.conversions ?? 0,
    };
    blocked.push(row);
    if (stats && (stats.impressions > 0 || stats.clicks > 0)) {
      spent.push(row);
      totals.clicks += row.clicks;
      totals.costPaise += row.costPaise;
      totals.conversions += row.conversions;
    } else {
      unspent.push(row);
    }
  }

  spent.sort((a, b) => b.costPaise - a.costPaise);
  unspent.sort((a, b) => b.volumeShareBp - a.volumeShareBp);
  return { blocked, spent, unspent, totals, costsConversions: totals.conversions > 0 };
}

// ---------------------------------------------------------------------------
// Keywords
// ---------------------------------------------------------------------------

/**
 * Add a keyword, tagged as it is typed.
 *
 * The tagger runs offline and synchronously (8.4), so a keyword written here
 * is usable on broad immediately — except when the heuristic finds nothing in
 * the vocabulary to hang it on, which is reported rather than hidden. An
 * untagged keyword matches nothing on broad, and a player who is not told that
 * sees a keyword that simply does not work.
 *
 * @param {object} draft
 * @param {{text: string, matchType: string, bidPaise: number}} spec
 * @returns {{ok: boolean, reason?: string, keyword?: object, inertOnBroad?: boolean}}
 */
export function addKeyword(draft, { text, matchType = 'phrase', bidPaise } = {}) {
  const clean = String(text ?? '').trim();
  if (tokenise(clean).length === 0) return { ok: false, reason: 'a keyword needs at least one word' };
  if (!MATCH_TYPES.includes(matchType)) return { ok: false, reason: 'unknown match type' };
  if (!isPaise(bidPaise)) return { ok: false, reason: 'a bid is a whole number of paise above zero' };
  if (draft.keywords.some((k) => normalise(k.text) === normalise(clean))) {
    return { ok: false, reason: 'that keyword is already in the account' };
  }

  const { tags, taggedContentHash } = tagKeywordOffline({ text: clean });
  const keyword = {
    id: freshId(clean, draft.keywords),
    text: clean,
    matchType,
    bidPaise,
    active: true,
    tags,
    taggedContentHash,
  };
  draft.keywords.push(keyword);
  return { ok: true, keyword, inertOnBroad: tags.length === 0 };
}

/**
 * Change a keyword's bid, match type or paused state.
 *
 * None of the three triggers a learning period (12.3) — the bid model has
 * nothing to re-estimate. Rejecting a bad value rather than coercing it: a
 * silently coerced bid is a bid the player did not make.
 *
 * @param {object} draft
 * @param {string} id
 * @param {{bidPaise?: number, matchType?: string, active?: boolean}} patch
 * @returns {{ok: boolean, reason?: string}}
 */
export function updateKeyword(draft, id, patch = {}) {
  const keyword = draft.keywords.find((k) => k.id === id);
  if (!keyword) return { ok: false, reason: 'no such keyword' };

  if ('bidPaise' in patch && !isPaise(patch.bidPaise)) {
    return { ok: false, reason: 'a bid is a whole number of paise above zero' };
  }
  if ('matchType' in patch && !MATCH_TYPES.includes(patch.matchType)) {
    return { ok: false, reason: 'unknown match type' };
  }
  if ('active' in patch && typeof patch.active !== 'boolean') {
    return { ok: false, reason: 'active is a boolean' };
  }

  Object.assign(keyword, patch);
  return { ok: true, keyword };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** R7: money is an integer number of paise, and a bid of nothing is not a bid. */
const isPaise = (value) => Number.isSafeInteger(value) && value > 0;

const negativeKey = (n) => `${n.matchType}::${normalise(n.text)}`;
const findNegative = (list, negative) => list.findIndex((n) => negativeKey(n) === negativeKey(negative));

const sameNegatives = (a, b) => a.length === b.length
  && a.every((n, i) => negativeKey(n) === negativeKey(b[i]));

const keywordKey = (k) => `${k.id}|${k.text}|${k.matchType}|${k.bidPaise}|${k.active !== false}`;
const sameKeywords = (a, b) => a.length === b.length
  && a.every((k, i) => keywordKey(k) === keywordKey(b[i]));

/**
 * An id derived from the keyword's own text.
 *
 * `qualityHistory` is keyed by keyword id, so a recycled id would hand a brand
 * new keyword somebody else's impressions and the `reportedScore` built from
 * them. Deriving from the text also means re-adding a keyword you removed
 * picks its own history back up, which is what a real account does.
 */
function freshId(text, keywords) {
  const base = `kw_${tagContentHashOf({ text }).replace('h53:', '')}`;
  let id = base;
  for (let n = 2; keywords.some((k) => k.id === id); n++) id = `${base}_${n}`;
  return id;
}

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

/**
 * Draw the decision form: what is staged, the negatives, and the keywords.
 *
 * @param {object} ctx
 * @param {object} ctx.draft
 * @param {Array} ctx.queries public query list (16.1) — text, volume, intent
 * @param {number} ctx.weeklyVolume
 * @param {object} ctx.terms search terms report rows, keyed by query id
 * @param {object} ctx.byKeyword per-keyword rows from the same range
 * @param {object} ctx.quality this advertiser's own reportedScores
 * @param {Function} [ctx.sync] re-read the report figures before drawing
 * @param {Function} ctx.onChange called after anything is staged, so the rest
 *   of the dashboard can catch up. `ctx.refresh` is written back for callers
 *   that stage a change from outside this region — the search terms table does.
 * @returns {HTMLElement}
 */
export function renderDecisions(ctx) {
  // `display: contents`, so the cards below take part in the dashboard grid
  // rather than being boxed inside a wrapper of their own.
  const region = el('div', 'decision-region');
  const summary = el('div', 'decision-summary');
  const forms = el('div', 'decision-forms');
  region.append(summary, forms);

  const drawSummary = () => summary.replaceChildren(...summaryCard(ctx));
  const drawAll = () => {
    drawSummary();
    forms.replaceChildren(...[
      // First, and only for the one round it exists: 13.3's second allocation
      // and 4.5's single repositioning window both open at the start of month
      // two and are gone the week after.
      windowCard(ctx, refresh),
      biddingCard(ctx, refresh),
      splitCard(ctx, refresh),
      negativesCard(ctx, refresh),
      keywordsCard(ctx, refresh),
    ].filter(Boolean));
  };

  function refresh({ summaryOnly = false } = {}) {
    // Before drawing, not after: the caller may have changed which rounds the
    // report covers, and the previews below read those figures.
    ctx.sync?.();
    if (summaryOnly) drawSummary();
    else drawAll();
    ctx.onChange?.();
  }

  ctx.refresh = refresh;
  drawAll();
  return region;
}

const card = (title, subtitle, span = 'span-4') => {
  const node = el('article', `card ${span}`);
  const heading = el('h2', null, title);
  if (subtitle) heading.append(el('span', 'muted', subtitle));
  node.append(heading);
  return node;
};

/** What will be committed when the week is run. Absent when nothing is staged. */
function summaryCard(ctx) {
  const rows = changes(ctx.draft);
  if (rows.length === 0) return [];

  const node = card('Next week', `${rows.length} change${rows.length === 1 ? '' : 's'}, not yet committed`);
  const list = el('div', 'staged');
  for (const row of rows) {
    const item = el('div', `staged-row ${row.kind}`);
    const body = el('div');
    body.append(el('div', 'staged-label', row.label));
    body.append(el('div', 'staged-detail', row.detail));
    item.append(body);
    // A row without an undo is one where the default IS the decision — this
    // round's capital, when none of it was committed. It is listed because it
    // is being submitted, not because it can be taken back.
    if (row.undo) {
      const undo = el('button', 'add');
      undo.type = 'button';
      undo.textContent = 'undo';
      undo.addEventListener('click', () => { row.undo(); ctx.refresh(); });
      item.append(undo);
    }
    list.append(item);
  }
  node.append(list);
  node.append(el('p', 'note',
    'Nothing here has happened yet. It is applied when you run the week, and '
    + 'the result arrives a week later — later still for anything that depends '
    + 'on conversions.'));
  return [node];
}

// --- the one-round window --------------------------------------------------

/**
 * Capital (13.3) and repositioning (4.5), both open for a single round.
 *
 * WHY IT IS ALWAYS SUBMITTED. The engine never debits capital; it converts
 * whatever was left uncommitted into this month's ad budget, and only at an
 * allocation round. So a player who ignores this card entirely must still be
 * making the "commit nothing" decision, or ₹1,00,000 simply disappears. The
 * default is therefore stated here and listed under Next week, rather than
 * being a silence that costs money.
 *
 * WHY THE TWO SIT TOGETHER. They are drawn from the same month. The rollover
 * adds to it and the repositioning cost subtracts from it, so committing
 * everything AND moving leaves a month worth a fraction of the ordinary one.
 * That figure has to be visible while the choice is being made.
 */
function windowCard(ctx, refresh) {
  const draft = ctx.draft;
  if (!draft.capexOpen && !draft.repositionOpen) return null;

  const both = draft.capexOpen && draft.repositionOpen;
  const node = card('This week only', both
    ? 'capital to invest, and your one chance to move'
    : (draft.capexOpen ? 'capital to invest' : 'your one chance to move'));

  if (draft.capexOpen) node.append(capitalSection(ctx, refresh));
  if (draft.repositionOpen) node.append(positionSection(ctx, refresh));

  const month = el('p', 'month-after');
  month.append(document.createTextNode('This leaves you '));
  month.append(el('strong', null, rupees(monthBudgetAfter(draft))));
  month.append(document.createTextNode(' to advertise with this month, spread across four weeks.'));
  node.append(month);
  return node;
}

function capitalSection(ctx, refresh) {
  const draft = ctx.draft;
  const box = el('div', 'window-section');
  box.append(el('p', 'field-label',
    `Capital · ${rupees(CAPEX_ALLOCATION_PAISE)}, and it does not carry forward`));

  const spent = capexSpent(draft);
  const left = CAPEX_ALLOCATION_PAISE - spent;

  for (const [key, label, why] of CAPEX_TARGETS) {
    const already = draft.committed[key] ?? 0;
    const row = el('div', 'capex-row');

    const name = el('div', 'capex-label');
    name.append(el('div', null, label));
    // 13.3 makes investment CUMULATIVE, so where a top-up lands on the S-curve
    // depends entirely on what is already there. Without this figure the choice
    // cannot be reasoned about at all.
    if (already > 0) {
      name.append(el('div', 'capex-already',
        draft.capex[key] > 0
          ? `${rupees(already)} → ${rupees(already + draft.capex[key])}`
          : `${rupees(already)} already`));
    }
    row.append(name);

    const chips = el('div', 'chips');
    for (const amount of CAPEX_STEPS) {
      const chip = el('button', `chip small${draft.capex[key] === amount ? ' on' : ''}`);
      chip.type = 'button';
      chip.textContent = amount === 0 ? 'none' : rupees(amount);
      chip.disabled = amount > draft.capex[key] + left;
      chip.addEventListener('click', () => { setCapex(draft, key, amount); refresh(); });
      chips.append(chip);
    }
    row.append(chips);
    row.append(el('div', 'capex-why muted', why));
    box.append(row);
  }

  box.append(el('p', 'note',
    `Anything you do not commit joins this month's advertising budget instead. `
    + `What you do commit goes live in week ${draft.round + CAPEX_DELAY_ROUNDS}, which leaves `
    + 'the rest of the game to pay it back — and spreading it thin genuinely '
    + 'underperforms committing, because the first small tranche on a target '
    + 'buys a half-built thing that helps nobody.'));
  return box;
}

function positionSection(ctx, refresh) {
  const draft = ctx.draft;
  const box = el('div', 'window-section');
  box.append(el('p', 'field-label',
    `Position · one step, once, for ${rupees(REPOSITION_COST_PAISE)}`));

  const from = draft.base.position;
  const grid = el('div', 'cell-grid');
  for (const cell of allCells()) {
    const to = parseCell(cell);
    const here = to.price === from.price && to.purpose === from.purpose;
    const reachable = here || isOneStep(from, to);
    const chosen = to.price === draft.position.price && to.purpose === draft.position.purpose;

    const button = el('button', `cell${chosen ? ' on' : ''}${reachable ? '' : ' unreachable'}`);
    button.type = 'button';
    button.disabled = !reachable;
    button.append(el('div', 'cell-name', `${to.price} · ${to.purpose}`));
    // From the briefing, exactly as round 0 does it. 17.2 decides what a
    // founder could research; reaching past it into POSITION_ECONOMICS is how a
    // screen starts showing numbers the player was never meant to have.
    const economics = ctx.brief.economicsByTier[to.price];
    button.append(el('div', 'cell-econ',
      `${rupees(economics.aovMeanPaise)} order · ${Math.round(100 * economics.marginPct)}% margin`));
    button.append(el('div', 'cell-vol',
      `${whole(ctx.brief.weeklySearchesByTier[to.price])} searches a week`));
    if (here) button.append(el('div', 'cell-here', 'you are here'));
    else if (!reachable) button.append(el('div', 'cell-here', 'more than one step'));

    button.addEventListener('click', () => { setPosition(draft, cell); refresh(); });
    grid.append(button);
  }
  box.append(grid);

  if (movedPosition(draft)) {
    // Careful with the Quality Score claim. 4.5 calls the loss "a consequence,
    // not a rule to implement": keeping a keyword keeps its history, and only
    // the ones you REPLACE start from nothing. Verified by moving with the old
    // keywords in place — every score survived. Saying they all reset would be
    // teaching something false about the thing being taught.
    box.append(el('p', 'problems',
      'Moving restarts the learning period. Your capital investment survives — '
      + 'it is still your website — but your keywords do not: they were written '
      + 'for the searches you are leaving, and rewriting them below is part of '
      + 'the same decision. Every keyword you replace starts with no Quality '
      + 'Score and earns one back only once it has the impressions for it.'));
  }

  box.append(el('p', 'note',
    'Price sets what a click can be worth to you. Purpose sets which searches '
    + 'are yours. One adjacent step is a repricing exercise a real brand could '
    + 'run in a month; a leap across the grid is a different company.'));
  return box;
}

// --- bidding ---------------------------------------------------------------

/**
 * How bids are decided, and what changing that costs.
 *
 * THE WARNING IS THE POINT OF THIS CARD. Switching strategy or moving its
 * target restarts a learning period (12.3), during which every conversion-rate
 * guess is multiplied wider. The penalty then lands a round or two later, in
 * numbers that look like bad luck. If the interface does not say so BEFORE the
 * player commits, it inflicts by accident the confusion the simulator exists to
 * teach deliberately.
 *
 * WHAT IT REFUSES TO SHOW. Not the prediction error. `predictionErrorSigma`
 * takes nothing but the advertiser's own history and would be trivial to put on
 * screen — and 17.2 says outright that the statistical consequence of a low
 * conversion rate "must be discovered, not read off a card". So this shows what
 * a real account shows: conversions observed, the rate they imply, and whether
 * a learning period is running.
 */
function biddingCard(ctx, refresh) {
  const draft = ctx.draft;
  const node = card('Bidding', 'how your bid is decided, every hour');
  const learningLeft = draft.bidding?.learningRoundsRemaining ?? 0;

  if (learningLeft > 0) {
    // A learning period only ever counts DOWN, so any remaining now means the
    // week on screen ran under it as well. Saying so is the difference between
    // a player who can attribute a bad week and one who reads it as the market.
    node.append(el('p', 'learning-now',
      `Learning: ${learningLeft} more week${learningLeft === 1 ? '' : 's'}. `
      + 'While it runs, this account\'s guess at what converts is much wider '
      + 'than usual — including for the week you are looking at, which was '
      + 'bought under it.'));
  }

  const grid = el('div', 'strategy-grid');
  for (const [id, [name, description]] of Object.entries(STRATEGY_COPY)) {
    const box = el('button', `strategy${id === draft.strategy ? ' on' : ''}`);
    box.type = 'button';
    box.append(el('div', 'strategy-name', name));
    box.append(el('div', 'strategy-desc', description));
    // From the engine, not repeated here. It is the fact that decides whether a
    // learning period can hurt you at all.
    box.append(el('div', 'strategy-predicts',
      STRATEGIES[id].predictsConversions
        ? 'predicts conversions — a learning period slows it down'
        : 'never predicts conversions — a learning period cannot touch it'));
    box.addEventListener('click', () => { setStrategy(draft, id); refresh(); });
    grid.append(box);
  }
  node.append(grid);

  const warn = el('div', 'bid-warn');
  const drawWarning = () => warn.replaceChildren(...warningBody(ctx));

  const key = STRATEGY_PARAM[draft.strategy];
  if (key) {
    const isCpa = key === 'targetCpaPaise';
    const box = input({
      type: 'number',
      value: isCpa
        ? String(Math.round(draft.strategyParams[key] / 100))
        : String(draft.strategyParams[key]),
      min: isCpa ? '1' : '0.1',
      step: isCpa ? '10' : '0.1',
      onInput: (value) => {
        const parsed = isCpa ? Math.round(Number(value) * 100) : Number(value);
        if (setStrategyParam(draft, parsed).ok) {
          // Summary only: a full redraw here would rebuild this box and take
          // the caret with it.
          drawWarning();
          refresh({ summaryOnly: true });
        }
      },
    });
    node.append(field(
      isCpa ? 'Target CPA (₹)' : 'Target ROAS',
      box,
      isCpa ? ownCpaHint(ctx) : ownRoasHint(ctx),
    ));
  }

  drawWarning();
  node.append(warn);

  node.append(el('p', 'note',
    `Your keyword bids stay the ceiling. No strategy may bid more than `
    + `${MAX_BID_MULTIPLE}× what you set on a keyword, so raising a bid still `
    + 'widens what automation is allowed to do and lowering one still closes it down.'));
  return node;
}

/** The consequence, before the button rather than after it. */
function warningBody(ctx) {
  const draft = ctx.draft;
  const out = [];

  const predicts = STRATEGIES[draft.strategy]?.predictsConversions;

  if (willTriggerLearning(draft)) {
    out.push(predicts
      ? el('p', 'problems',
        `This restarts the learning period. For the next ${LEARNING_ROUNDS} weeks the `
        + 'bid model guesses much more widely than usual, and it will cost you '
        + 'money you cannot easily attribute to this decision — which is exactly '
        + 'why it is being said here rather than left for you to find.')
      // The period is still WRITTEN — 12.3 triggers on any switch — it simply
      // has nothing to slow down while a strategy that never predicts is
      // running. Saying only "restarts the learning period" here would
      // contradict the tile above it, and saying nothing would hide the trap
      // waiting for anyone who switches back before it expires.
      : el('p', 'note',
        `This still starts a ${LEARNING_ROUNDS} week learning period, but it costs `
        + `${strategyName(draft.strategy)} nothing, because it never predicts `
        + 'conversions. It matters only if you switch back to one that does '
        + 'before the period runs out.'));
  }

  if (predicts) {
    const seen = draft.bidding?.observedConversions ?? 0;
    const rate = draft.bidding?.observedConvRate;
    const line = el('p', 'note');
    line.append(document.createTextNode(
      'A strategy that predicts conversions predicts from the ones it has '
      + `actually seen land. This account has seen ${seen.toFixed(1)}`
      + (rate == null ? '' : `, a rate of ${(100 * rate).toFixed(2)}%`)
      + '. Below about thirty, that guess is very rough — and conversions '
      + 'arrive rounds after the click that earned them, so it is always '
      + 'behind what you did last.',
    ));
    out.push(line);
  }
  return out;
}

/** The player's own cost per conversion, over whichever weeks are on screen. */
function ownCpaHint(ctx) {
  let cost = 0;
  let conversions = 0;
  for (const row of Object.values(ctx.byKeyword ?? {})) {
    cost += row.costPaise;
    conversions += row.conversions;
  }
  return conversions > 0
    ? `you have paid ${rupees(cost / conversions)} a conversion over the weeks shown above`
    : 'you have no conversions yet to compare this against';
}

function ownRoasHint(ctx) {
  const net = ctx.money?.netRoas;
  return Number.isFinite(net)
    ? `your net return last week was ${ratio(net)}, and it is still being revised`
    : 'you have no return to compare this against yet';
}

// --- the weekly split ------------------------------------------------------

/**
 * How this month's money is divided across its four weeks (13.4).
 *
 * THE TRAP IT EXISTS TO MAKE VISIBLE. `advanceCampaign` RESETS the split to an
 * even one at every month boundary, because the month's total may have changed
 * — month 3 is redistributed by rank. So a shape the player set in month 1 does
 * not survive into month 2, and until this card said so it flattened in
 * silence. The card re-asks at the top of each month rather than pretending the
 * plan carried.
 *
 * Weeks that have already run are shown with what they actually SPENT beside
 * what they were planned, which is the comparison 13.2's burn-down is for:
 * unspent money is lost at the month boundary, so a plan that leaves the pot
 * unfinished is a plan to throw some of it away.
 */
function splitCard(ctx, refresh) {
  const draft = ctx.draft;
  if (draft.weeklySplitPaise.length === 0) return null;

  const node = card("This month's budget", "how the month is divided across its weeks");

  if (draft.weekIndex === 0 && draft.round > 1) {
    node.append(el('p', 'learning-now',
      'A new month opens with an even split. Whatever shape you gave last month '
      + "did not carry over — the month's total can change, so the plan is made "
      + 'again from scratch. This is the moment to set it.'));
  }

  // Redrawn on every keystroke; the inputs above are not, or the caret would go
  // with them. Same split the bidding card makes for the same reason.
  const outlook = el('div', 'split-outlook');
  const drawOutlook = () => outlook.replaceChildren(...outlookBody(ctx));

  const row = el('div', 'split-row');
  draft.weeklySplitPaise.forEach((paise, index) => {
    const spent = ctx.spentByWeek?.[index];
    const past = index < draft.weekIndex;
    const now = index === draft.weekIndex;

    if (past) {
      // Read-only, with what it actually SPENT beside what it was planned.
      // Editing it would change nothing — buildBudgets only ever reads the
      // index of the round about to run — and a control that does nothing is
      // worse than no control.
      const box = el('div', 'week-done');
      box.append(el('div', 'week-spent', spent == null ? '—' : rupees(spent)));
      box.append(el('div', 'week-planned', `of ${rupees(paise)} planned`));
      row.append(field(`Week ${index + 1}`, box, null));
      return;
    }

    const box = input({
      type: 'number',
      value: String(Math.round(paise / 100)),
      min: '0',
      step: '100',
      onInput: (value) => {
        if (setWeekBudget(draft, index, Math.max(0, Math.round(Number(value) * 100))).ok) {
          drawOutlook();
          refresh({ summaryOnly: true });
        }
      },
    });
    row.append(field(`Week ${index + 1}`, box, now ? 'the week about to run' : null));
  });
  node.append(row);

  drawOutlook();
  node.append(outlook);

  if (draft.capexOpen || (draft.repositionOpen && movedPosition(draft))) {
    node.append(el('p', 'note',
      'These amounts will be rescaled to whatever this month ends up being once '
      + 'the capital above is settled, keeping the shape you set here. Set the '
      + 'shape rather than the exact rupees.'));
  }
  return node;
}

/** The consequence of the plan as it currently stands. */
function outlookBody(ctx) {
  const draft = ctx.draft;
  const out = [];
  const outlook = splitOutlook(draft);
  const problem = splitProblem(draft);

  if (problem) {
    out.push(el('p', 'problems',
      `${problem}. The month is a hard cap, so this does not buy you more — it `
      + 'burns the pot early and goes dark for the rest of the month.'));
  }

  const line = el('p', 'month-after');
  line.append(document.createTextNode(
    `${outlook.weeksLeft} week${outlook.weeksLeft === 1 ? '' : 's'} left in this month, `,
  ));
  line.append(el('strong', null, rupees(outlook.remainingPaise)));
  line.append(document.createTextNode(
    ` of the month still unspent, and ${rupees(outlook.plannedPaise)} planned across them.`,
  ));
  out.push(line);

  if (!problem && outlook.plannedPaise < outlook.remainingPaise) {
    out.push(el('p', 'note',
      `That leaves ${rupees(outlook.remainingPaise - outlook.plannedPaise)} you have `
      + 'not planned to spend. Unspent money is lost at the month boundary — there '
      + 'is no carry-over — so it is worth nothing unless you allocate it.'));
  }
  return out;
}

// --- negatives -------------------------------------------------------------

function negativesCard(ctx, refresh) {
  const node = card('Negatives', 'written from the report above, and only from it');
  const draft = ctx.draft;

  if (draft.negatives.length > 0) {
    const list = el('table', 'mini');
    table(list, ['Blocked', 'Type', { label: 'Searches it blocks', num: true }, ''],
      draft.negatives.map((negative, index) => {
        const preview = previewNegative(negative, { queries: ctx.queries, terms: ctx.terms });
        const remove = el('button', 'add');
        remove.type = 'button';
        remove.textContent = 'remove';
        remove.addEventListener('click', () => { dropNegative(draft, index); refresh(); });
        return { cells: [negative.text, negative.matchType, whole(preview.blocked.length), remove] };
      }));
    node.append(list);
  } else {
    node.append(el('p', 'muted',
      'Nothing blocked. Use the block button on a search term above, or write '
      + 'one here to catch a whole family of them at once.'));
  }

  // The composer. Its preview updates on every keystroke; the rest of the card
  // does not, or the box would lose focus as you typed into it.
  const composing = { text: '', matchType: 'broad' };
  const preview = el('div', 'neg-preview');
  const drawPreview = () => preview.replaceChildren(...previewBody(composing, ctx));

  const row = el('div', 'neg-compose');
  const text = input({
    placeholder: 'free, near me, how to…',
    onInput: (value) => { composing.text = value; drawPreview(); },
  });
  const type = select({
    options: NEGATIVE_TYPES.map((t) => [t, t]),
    value: composing.matchType,
    onChange: (value) => { composing.matchType = value; drawPreview(); },
  });
  const go = el('button', 'add');
  go.type = 'button';
  go.textContent = 'block it';
  go.addEventListener('click', () => {
    const result = addNegative(draft, composing);
    if (result.added) refresh();
    else {
      preview.replaceChildren(el('p', 'problems', result.reason));
    }
  });

  add(row,
    field('Words to block', text, NEGATIVE_HELP[composing.matchType]),
    field('Type', type),
    go);
  node.append(row, preview);

  node.append(el('p', 'note',
    'A negative matches the words themselves — no synonyms, no close variants, '
    + 'no plurals. That is why you can be dragged into a search by meaning and '
    + 'can only get out of it by naming what it literally said.'));
  return node;
}

/** The consequence, shown before the button is pressed rather than after. */
function previewBody(negative, ctx) {
  if (tokenise(negative.text ?? '').length === 0) return [];
  const preview = previewNegative(negative, { queries: ctx.queries, terms: ctx.terms });

  if (preview.blocked.length === 0) {
    return [el('p', 'muted', `Nothing in the market matches “${negative.text}” on ${negative.matchType}.`)];
  }

  const out = [];
  const headline = el('p', 'neg-headline');
  headline.append(el('strong', null, `${preview.blocked.length} searches`));
  headline.append(document.createTextNode(
    preview.spent.length > 0
      ? ` blocked, ${preview.spent.length} of which you have bought: `
        + `${rupees(preview.totals.costPaise)} and `
        + `${preview.totals.conversions.toFixed(1)} conversions.`
      : ' blocked. You have bought none of them yet.',
  ));
  out.push(headline);

  if (preview.costsConversions) {
    out.push(el('p', 'problems',
      'This would also block searches that converted for you. A negative does '
      + 'not know what you meant by it — it blocks every search carrying those '
      + 'words.'));
  } else if (preview.unspent.length > 0) {
    // The softer half of the same warning. A negative is not only a refund on
    // what you have wasted; it also closes searches you have never run, and
    // you will never find out what they would have done. Read the list.
    out.push(el('p', 'note',
      `${preview.unspent.length} of these you have never bought. Blocking them `
      + 'closes them for good — read the words and decide whether every one of '
      + 'them really is somebody else\'s customer.'));
  }

  const list = el('table', 'mini');
  table(list,
    ['Search it would block', { label: 'Your cost', num: true }, { label: 'Your conv', num: true }],
    [...preview.spent, ...preview.unspent].slice(0, 12).map((row) => ({
      className: row.conversions > 0 ? 'costly' : null,
      cells: [
        row.text,
        row.clicks > 0 ? rupees(row.costPaise) : '—',
        row.conversions > 0 ? row.conversions.toFixed(1) : '—',
      ],
    })));
  out.push(list);
  return out;
}

// --- keywords --------------------------------------------------------------

function keywordsCard(ctx, refresh) {
  const node = card('Keywords', 'what you bid on, and how loosely it matches');
  const draft = ctx.draft;

  const rows = draft.keywords.map((keyword) => {
    const stats = ctx.byKeyword?.[keyword.id];
    const score = ctx.quality?.[keyword.id];
    const paused = keyword.active === false;

    const label = el('div', paused ? 'kw-text paused' : 'kw-text');
    label.append(el('div', null, keyword.text));
    const tags = el('div', 'tag-row');
    if (keyword.tags.length === 0) {
      tags.append(el('span', 'tag warn', 'no tags — broad finds nothing'));
    } else {
      for (const tag of keyword.tags.slice(0, 5)) tags.append(el('span', 'tag', tag));
    }
    label.append(tags);

    const matchType = select({
      options: MATCH_TYPES.map((t) => [t, t]),
      value: keyword.matchType,
      onChange: (value) => { updateKeyword(draft, keyword.id, { matchType: value }); refresh(); },
    });

    const bid = input({
      type: 'number',
      value: String(Math.round(keyword.bidPaise / 100)),
      min: '1',
      step: '1',
      onInput: (value) => {
        // Written straight into the draft, and only the summary redrawn — a
        // full redraw here would rebuild this box and take the caret with it.
        const paise = Math.round(Number(value) * 100);
        if (updateKeyword(draft, keyword.id, { bidPaise: paise }).ok) {
          refresh({ summaryOnly: true });
        }
      },
    });

    const toggle = el('button', 'add');
    toggle.type = 'button';
    toggle.textContent = paused ? 'resume' : 'pause';
    toggle.addEventListener('click', () => {
      updateKeyword(draft, keyword.id, { active: paused });
      refresh();
    });

    return {
      className: paused ? 'paused-row' : null,
      cells: [
        label, matchType, bid,
        stats ? whole(stats.clicks) : '0',
        stats ? rupees(stats.costPaise) : '—',
        stats && stats.clicks > 0 ? rupees(stats.costPaise / stats.clicks) : '—',
        stats && stats.conversions > 0 ? stats.conversions.toFixed(1) : '0',
        score ? String(score.score) : '—',
        toggle,
      ],
    };
  });

  const list = el('table', 'mini picked');
  table(list, [
    'Keyword', 'Match', { label: 'Bid ₹', num: true }, { label: 'Clicks', num: true },
    { label: 'Cost', num: true }, { label: 'CPC', num: true }, { label: 'Conv', num: true },
    { label: 'Quality', num: true }, '',
  ], rows);
  node.append(list);

  if (draft.keywords.every((k) => k.active === false)) {
    node.append(el('p', 'problems',
      'Every keyword is paused. You will enter no auctions at all next week.'));
  }

  node.append(planner(ctx, refresh));
  node.append(el('p', 'note',
    'Exact and phrase match on the words. Broad matches on meaning through the '
    + 'tags — and nobody can tell you in advance how far it will travel, which '
    + 'is the point. Broadening raises impressions and LOWERS impression share, '
    + 'because it grows the number of auctions you were eligible for faster '
    + 'than the number you won.'));
  return node;
}

/**
 * Keyword Planner, mid-game: text, weekly volume, intent, and nothing else.
 *
 * The same list round 0 offered, and the same withholding — what a search does
 * after the click is earned by running it (16.1, C4).
 */
function planner(ctx, refresh) {
  // Held on ctx rather than here, because adding a keyword rebuilds this card.
  // Found by using it: you set "phrase, ₹55", add one keyword, and the box
  // shuts and forgets both — which makes building an ad group from the planner
  // eight fiddly steps instead of eight clicks.
  ctx.planner = ctx.planner ?? { matchType: 'phrase', bidPaise: 3000, term: '', open: false };
  const chosen = ctx.planner;

  const box = el('details', 'planner');
  box.open = chosen.open;
  box.addEventListener('toggle', () => { chosen.open = box.open; });
  box.append(el('summary', null, 'Add a keyword'));

  const held = new Set(ctx.draft.keywords.map((k) => normalise(k.text)));
  const all = ctx.queries
    .map((q) => ({ ...q, weekly: Math.round((ctx.weeklyVolume * q.volumeShareBp) / 10000) }))
    .sort((a, b) => b.weekly - a.weekly);

  const controls = el('div', 'neg-compose');
  const search = input({
    value: chosen.term,
    placeholder: 'search the keyword planner…',
    onInput: (value) => { chosen.term = value; draw(); },
  });
  const type = select({
    options: MATCH_TYPES.map((t) => [t, t]),
    value: chosen.matchType,
    onChange: (value) => { chosen.matchType = value; },
  });
  const bid = input({
    type: 'number',
    value: String(Math.round(chosen.bidPaise / 100)),
    min: '1',
    step: '1',
    onInput: (value) => { chosen.bidPaise = Math.max(100, Math.round(Number(value) * 100)); },
  });
  add(controls, field('Search', search), field('Match', type), field('Bid ₹', bid));
  box.append(controls);

  const listBox = el('div', 'scroll research');
  box.append(listBox);

  function draw() {
    const term = chosen.term.trim().toLowerCase();
    const rows = all
      .filter((q) => !term || q.text.includes(term))
      .slice(0, 40)
      .map((q) => {
        const already = held.has(normalise(q.text));
        const button = el('button', 'add');
        button.type = 'button';
        button.textContent = already ? 'in account' : 'add';
        button.disabled = already;
        button.addEventListener('click', () => {
          addKeyword(ctx.draft, { text: q.text, matchType: chosen.matchType, bidPaise: chosen.bidPaise });
          refresh();
        });
        return { cells: [q.text, whole(q.weekly), q.intent, button] };
      });
    const node = el('table', 'mini');
    table(node, ['Search term', { label: 'Weekly', num: true }, 'Intent', ''], rows);
    listBox.replaceChildren(node);
  }
  draw();

  box.append(el('p', 'note',
    'Volume is public research. What a search is worth to you is not — that is '
    + 'earned by running it and reading the report.'));
  return box;
}
