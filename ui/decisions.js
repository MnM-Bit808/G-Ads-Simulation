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

import { el, add, table, field, input, select, rupees, whole, ratio, pct, scrollX } from './dom.js';
import { blockedBy, normalise, tokenise } from '../engine/matching.js';
import { STRATEGIES, daypartMultiplier, effectiveBidPaise } from '../engine/strategies.js';
import { minimumBidToShowPaise } from '../engine/auction.js';
import { qualitySignalBase } from '../engine/quality.js';
import { refusalRateFor } from '../engine/locations.js';
// Derived from the hour curves rather than declared, so it lives with them.
import { HOURS_PER_DAY } from '../engine/querySet.js';
import { featureAt, pageShape, capexChoices } from './landing-page.js';
import { CAPITAL } from './words/capital.js';
import { FORM } from './words/form.js';
import { whyButton } from './guide/drawer.js';
import { LOCATIONS } from '../content/locations.js';
import { moneyBlock } from '../engine/report.js';
import {
  canReposition, isOneStep, allCells, parseCell, cellKey, landingPageBonus,
} from '../engine/positions.js';
import {
  LEARNING_ROUNDS, MAX_BID_MULTIPLE, CAPEX_ALLOCATION_PAISE, CAPEX_DELAY_ROUNDS,
  REPOSITION_COST_PAISE, ROUNDS_PER_MONTH, LOCATION_TIERS,
  DAYPART_BLOCKS, MIN_HOUR_OBSERVATIONS, QUALITY_MIN_IMPRESSIONS, QUALITY_WINDOW_ROUNDS,
  RTO_FREIGHT_PAISE, PREPAID_DISCOUNT_MAX_PAISE, PREPAID_DISCOUNT_CURVE,
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
 * The three targets of 13.3, in round 0's order and round 0's words.
 *
 * They used to be listed differently here and described in four words each,
 * while round 0 had become a page builder that says what every rung buys and
 * draws the result. One decision in two languages, and the terser telling was
 * on the screen where the player has MORE context and less time to use it.
 * DECISIONS I15.
 */
const CAPEX_TARGETS = [
  ['landingPage', 'The page itself', 'Better quality, so a cheaper click. Worth most in the middle.'],
  ['sizeGuide', 'Size guide', 'Fewer parcels sent back after delivery. Worth most at the cheap end, '
    + 'and to anything sold on how it looks.'],
  ['photography', 'Photography', 'More of your visitors buy. Worth most where the decision is considered.'],
  // I29: the only one that is not about the page, and the only defence against
  // the freight a refused parcel costs.
  ['orderConfirmation', 'Order confirmation', 'Fewer parcels refused at the door. Worth most '
    + 'where cash on delivery is commonest, which is the cheap end and the small towns.'],
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
    // The grader's own 1-10 for this ad. It has always been in getSelfView and
    // has never been on screen, so a player rewriting a headline had no way to
    // see whether it helped.
    gradedQuality: structuredClone(adGroups[0]?.gradedQuality ?? null),
    // What Target ROAS divides into. Own catalogue only — getSelfView carries
    // order value and margin, never the conversion rate behind them (16.2).
    catalogue: structuredClone(selfView.catalogue ?? {}),
    position: structuredClone(selfView.position ?? null),

    // 13.3 and 4.5, both of which are open for one round only.
    round: selfView.round,
    capexOpen: inGameAllocationRounds(options.allocationRounds).includes(selfView.round),
    repositionOpen: canReposition({ position: selfView.position }, selfView.round),
    capex: Object.fromEntries(CAPEX_TARGETS.map(([key]) => [key, 0])),
    committed: structuredClone(selfView.capex?.committed ?? {}),
    // The whole block, not just `committed`: `liveCapexPaise` subtracts
    // tranches that have not reached `liveAtRound` yet, and a capex block
    // without `pending` would count money that is still being built.
    capexBlock: structuredClone(selfView.capex ?? {}),
    monthlyBudgetPaise: selfView.campaign?.monthlyBudgetPaise ?? 0,
    monthSpentPaise: selfView.campaign?.monthSpentPaise ?? 0,

    // 13.4's middle level. `buildBudgets` reads
    // `split[(round - 1) % ROUNDS_PER_MONTH]`, so this is the box the round
    // about to run will actually spend from.
    weeklySplitPaise: [...(selfView.campaign?.weeklySplitPaise ?? [])],
    weekIndex: (selfView.round - 1) % ROUNDS_PER_MONTH,

    // 13.4's hour level. Percentages, one per DAYPART_BLOCKS entry.
    daypartAdjustments: [...(selfView.campaign?.daypartAdjustments
      ?? DAYPART_BLOCKS.map(() => 0))],

    // G4's place level. The same kind of control, one per location tier.
    prepaidDiscountPaise: selfView.campaign?.prepaidDiscountPaise ?? 0,
    locationAdjustments: [...(selfView.campaign?.locationAdjustments
      ?? LOCATION_TIERS.map(() => 0))],

    base: {
      negatives: structuredClone(negatives),
      keywords: structuredClone(keywords),
      strategy,
      strategyParams: structuredClone(strategyParams),
      position: structuredClone(selfView.position ?? null),
      weeklySplitPaise: [...(selfView.campaign?.weeklySplitPaise ?? [])],
      daypartAdjustments: [...(selfView.campaign?.daypartAdjustments
        ?? DAYPART_BLOCKS.map(() => 0))],
      prepaidDiscountPaise: selfView.campaign?.prepaidDiscountPaise ?? 0,
      locationAdjustments: [...(selfView.campaign?.locationAdjustments
        ?? LOCATION_TIERS.map(() => 0))],
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
  if (!sameSplit(draft.locationAdjustments, draft.base.locationAdjustments)) {
    campaign.locationAdjustments = [...draft.locationAdjustments];
  }
  // I34: an operating decision rather than a structural one, so it does not
  // trigger a learning period the way a bidding change does (12.3).
  if (draft.prepaidDiscountPaise !== draft.base.prepaidDiscountPaise) {
    campaign.prepaidDiscountPaise = draft.prepaidDiscountPaise;
  }
  if (!sameSplit(draft.daypartAdjustments, draft.base.daypartAdjustments)) {
    campaign.daypartAdjustments = [...draft.daypartAdjustments];
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

  draft.locationAdjustments.forEach((percent, index) => {
    const before = draft.base.locationAdjustments[index];
    if (percent === before) return;
    const place = LOCATIONS[index];
    rows.push({
      kind: 'location',
      label: `${place.label} bid ${signed(before)} → ${signed(percent)}`,
      detail: percent <= -100
        ? `you will bid the minimum in ${place.label.toLowerCase()}, which is a bid of ₹1`
        : `${place.examples.slice(0, 3).join(', ')} and everywhere like them`,
      undo: () => setLocation(draft, index, before),
    });
  });

  draft.daypartAdjustments.forEach((percent, index) => {
    const before = draft.base.daypartAdjustments[index];
    if (percent === before) return;
    const block = DAYPART_BLOCKS[index];
    rows.push({
      kind: 'daypart',
      label: `${block.label} bid ${signed(before)} → ${signed(percent)}`,
      detail: percent <= -100
        ? `you will bid the minimum between ${hourLabel(block.start)} and ${hourLabel(block.end)}`
        : `${hourLabel(block.start)} to ${hourLabel(block.end)}, every day`,
      undo: () => setDaypart(draft, index, before),
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

  draft.base.keywords.forEach((before, index) => {
    if (draft.keywords.some((k) => k.id === before.id)) return;
    rows.push({
      kind: 'keyword-removed',
      label: `Remove “${before.text}”`,
      detail: 'it leaves the ad group; what it has already learned is kept',
      undo: () => { draft.keywords.splice(index, 0, structuredClone(before)); },
    });
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
  draft.capex = Object.fromEntries(CAPEX_TARGETS.map(([key]) => [key, 0]));
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

/**
 * The month just played, read beside the capital choice (DECISIONS D12).
 *
 * D12 measured that whether the second allocation does more as advertising or
 * as capital turns on one figure: the share of impressions the player lost to
 * budget. So this reads it for the four weeks before the month being decided,
 * with each week counted by its eligible auctions, so a quiet week weighs less
 * than a busy one. The spend and the month's pot come from the month's last
 * report, which carries the month's running totals.
 *
 * @param {object[]} history `state.history`
 * @param {string} playerId
 * @param {number} round the round being decided
 * @returns {{spentPaise: number, budgetPaise: number, lostToBudget: number} | null}
 *   null in the first month, or when the player has no report for that month
 */
export function lastMonthBudget(history, playerId, round) {
  const monthStart = round - ((round - 1) % ROUNDS_PER_MONTH);
  const from = monthStart - ROUNDS_PER_MONTH;
  if (from < 1) return null;
  const rows = (history ?? [])
    .filter((h) => h.round >= from && h.round < monthStart)
    .sort((a, b) => a.round - b.round)
    .map((h) => h.byAdvertiser?.[playerId])
    .filter(Boolean);
  if (rows.length === 0) return null;

  const eligible = rows.reduce((a, r) => a + (r.traffic?.eligibleAuctions ?? 0), 0);
  const lost = rows.reduce((a, r) => a + (r.share?.lostToBudget ?? 0) * (r.traffic?.eligibleAuctions ?? 0), 0);
  const last = rows[rows.length - 1].budget ?? {};
  return {
    spentPaise: last.monthSpentPaise ?? 0,
    budgetPaise: last.monthlyBudgetPaise ?? 0,
    lostToBudget: eligible > 0 ? lost / eligible : 0,
  };
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
const signed = (percent) => (percent > 0 ? `+${percent}%` : `${percent}%`);
const hourLabel = (hour) => (hour === 24 ? 'midnight' : `${String(hour).padStart(2, '0')}:00`);

// ---------------------------------------------------------------------------
// The Quality Score (9.3)
// ---------------------------------------------------------------------------

/** Worst first. `expectedCtr` breaks a tie because the score table weights it double. */
const RATING_ORDER = { below: 0, average: 1, above: 2 };

const QUALITY_COMPONENTS = [
  ['expectedCtr', 'Expected CTR', 'whether people click your ad when they see it'],
  ['adRelevance', 'Ad relevance', 'whether your ad answers what they searched for'],
  ['landingPage', 'Landing page', 'whether the page you send them to matches the ad'],
];

/**
 * The Quality Score, decomposed — which is the only form in which it says
 * anything.
 *
 * The screen used to render `score.score` alone and drop the three ratings
 * `reportedScore` returns beside it. That is the least informative quarter of
 * the diagnostic: the number cannot tell you WHICH part is weak, and it barely
 * moves. Measured on a played account, lifting `expectedCtr` from 6 to 9 takes
 * the own/field ratio from 1.145 to 1.676 and leaves the displayed score at 8,
 * because both are past `RATING_UPPER_THRESHOLD` and three levels have nothing
 * between them to say. Google shows all four figures for the same reason.
 *
 * @param {object|null} score output of `reportedScore`
 * @returns {{value: number|null, ratings: object[], weakest: object|null, note: string}}
 */
export function effectiveGrades(draft) {
  const graded = draft.gradedQuality;
  if (!graded) return null;
  // 13.3 adds the landing-page capital as points AFTER grading and never
  // writes them back, so the stored grade understates an account that invested.
  // The engine's own function, not a restatement of the curve.
  const bonus = landingPageBonus(draft.capexBlock ?? {}, draft.round);
  return {
    expectedCtr: graded.expectedCtr,
    adRelevance: graded.adRelevance,
    landingPage: Math.min(10, graded.landingPage + bonus),
  };
}

export function qualitySummary(score, graded = null) {
  if (!score) {
    return {
      value: null,
      ratings: [],
      weakest: null,
      note: `No score yet. It needs ${whole(QUALITY_MIN_IMPRESSIONS)} impressions on the `
        + "keyword's own literal search before it will say anything, and it only "
        + 'ever counts rounds that have already finished.',
    };
  }

  const ratings = QUALITY_COMPONENTS.map(([key, label, meaning]) => ({
    key, label, meaning, rating: score[key], graded: graded?.[key] ?? null,
  }));

  // Judged on the GRADE where there is one, because that is what the player
  // controls and what moves the moment they rewrite a headline. The rating can
  // be pinned by a threshold - landing page cannot read "above" at any grade -
  // so ranking on it alone would point at the wrong thing.
  const ranked = [...ratings].sort((a, b) => (
    graded
      ? (a.graded - b.graded) || (a.key === 'expectedCtr' ? -1 : b.key === 'expectedCtr' ? 1 : 0)
      : (RATING_ORDER[a.rating] ?? 1) - (RATING_ORDER[b.rating] ?? 1)
        || (a.key === 'expectedCtr' ? -1 : b.key === 'expectedCtr' ? 1 : 0)
  ));
  const weakest = graded
    ? (ranked[0].graded >= 9 ? null : ranked[0])
    : (ranked[0].rating === 'above' ? null : ranked[0]);

  return { value: score.score, ratings, weakest, note: null };
}

// ---------------------------------------------------------------------------
// Dayparting (13.4, H4)
// ---------------------------------------------------------------------------

/**
 * The range an hour or a place may be adjusted by. NOT quite Google's: Google
 * allows −90% to +900% here and −100% only for devices, so −100% is this game
 * letting one control do an exclusion's job (DECISIONS D11).
 */
const DAYPART_RANGE = [-100, 900];

/**
 * Adjust the bid for one block of the day.
 *
 * @param {object} draft
 * @param {number} index into DAYPART_BLOCKS
 * @param {number} percent -100..900
 * @returns {{ok: boolean, reason?: string}}
 */
/**
 * Adjust the bid for one part of the country.
 *
 * The same shape as `setDaypart`, and the same range, because it is the same kind
 * of control: Google's own location targeting is a bid adjustment rather than a
 * separate campaign.
 *
 * @param {object} draft
 * @param {number} index into LOCATION_TIERS
 * @param {number} percent -100..900
 * @returns {{ok: boolean, reason?: string}}
 */
/**
 * What a prepaid order is discounted by, in paise (I34).
 *
 * @param {object} draft
 * @param {number} paise 0..`PREPAID_DISCOUNT_MAX_PAISE`
 * @returns {{ok: boolean, reason?: string}}
 */
export function setPrepaidDiscount(draft, paise) {
  if (!Number.isSafeInteger(paise) || paise < 0) {
    return { ok: false, reason: 'a discount is whole rupees, and not negative' };
  }
  if (paise > PREPAID_DISCOUNT_MAX_PAISE) {
    return { ok: false, reason: `the most worth offering is ${rupees(PREPAID_DISCOUNT_MAX_PAISE)}` };
  }
  draft.prepaidDiscountPaise = paise;
  return { ok: true };
}

export function setLocation(draft, index, percent) {
  if (!Number.isInteger(index) || index < 0 || index >= LOCATION_TIERS.length) {
    return { ok: false, reason: `no location tier ${String(index)}` };
  }
  const [lo, hi] = DAYPART_RANGE;
  if (!Number.isInteger(percent) || percent < lo || percent > hi) {
    return { ok: false, reason: `an adjustment is a whole percentage from ${lo} to ${hi}` };
  }
  const next = [...draft.locationAdjustments];
  next[index] = percent;
  draft.locationAdjustments = next;
  return { ok: true };
}

/**
 * Each part of the country, with what this account has actually done there.
 *
 * THE DATA IS THE PLAYER'S OWN REPORT, accumulated over every week played, the
 * same way the search terms table is. Nothing here reads the model: the volume
 * table, the return multipliers and the basket multipliers are all engine
 * constants and `tests/ui.test.js` fails if this file names any of them.
 *
 * WHAT IT SHOWS IS NET OF RETURNS, and that is the whole reason the card exists.
 * Clicks and cost alone would rank the places by how much traffic each has;
 * revenue alone would rank them by basket size and put the metros on top. Only
 * net of returns says which place is actually paying for itself - and returns
 * arrive late, so this table rewrites itself for several weeks after a decision
 * is made on it.
 *
 * @param {object} draft
 * @param {object[]} history every report this account has, revised
 * @param {string} playerId
 * @returns {Array<object>} one row per location, in engine order
 */
export function locationRows(draft, history, playerId) {
  const totals = LOCATION_TIERS.map(() => ({
    impressions: 0, clicks: 0, costPaise: 0, conversions: 0,
    grossRevenuePaise: 0, returned: 0, returnedRevenuePaise: 0, eligibleAuctions: 0,
    refused: 0, sentBack: 0, codShare: null,
  }));

  for (const report of history ?? []) {
    const rows = report.byAdvertiser?.[playerId]?.breakdown?.byLocation;
    if (!rows) continue;
    for (const [tier, row] of Object.entries(rows)) {
      const at = totals[tier];
      if (!at) continue;
      at.impressions += row.impressions ?? 0;
      at.clicks += row.clicks ?? 0;
      at.costPaise += row.costPaise ?? 0;
      at.conversions += row.conversions ?? 0;
      at.grossRevenuePaise += row.grossRevenuePaise ?? 0;
      at.returned += row.returned ?? 0;
      at.returnedRevenuePaise += row.returnedRevenuePaise ?? 0;
      // I28: which of those returns never made it through the door.
      at.refused += row.refused ?? 0;
      at.sentBack += row.sentBack ?? 0;
      if (row.codShare != null) at.codShare = row.codShare;
      at.eligibleAuctions += row.eligibleAuctions ?? 0;
    }
  }

  return LOCATION_TIERS.map((id, index) => {
    const at = totals[index];
    const place = LOCATIONS[index];
    const netRevenuePaise = at.grossRevenuePaise - at.returnedRevenuePaise;
    // What a click here LEFT the player: the engine's own profit arithmetic on
    // this slice of the account, with the clicks' own cost left out so the figure
    // can sit beside the cost per click (stage A2). Revenue per click alone read
    // ₹78-112 beside a ₹8-11 CPC and invited bids the margin cannot carry.
    // Rounded first because `moneyBlock` works in whole paise, and a place's
    // revenue is a sum of fractional conversions.
    const kept = at.clicks > 0
      ? moneyBlock({
        costPaise: 0,
        conversions: at.conversions,
        grossRevenuePaise: Math.round(at.grossRevenuePaise),
        returnedRevenuePaise: Math.round(at.returnedRevenuePaise),
        marginPct: draft.catalogue?.marginPct ?? 0,
        refused: at.refused,
      }).netProfitPaise
      : null;
    return {
      id,
      label: place.label,
      examples: [...place.examples],
      adjustment: draft.locationAdjustments[index] ?? 0,
      ...at,
      netRevenuePaise,
      // Per click, because that is the only form in which three places of very
      // different sizes can be compared at all.
      netPerClickPaise: at.clicks > 0 ? netRevenuePaise / at.clicks : null,
      keptPerClickPaise: kept === null ? null : kept / at.clicks,
      cpcPaise: at.clicks > 0 ? at.costPaise / at.clicks : null,
      returnRate: at.conversions > 0 ? at.returned / at.conversions : null,
      // The two halves of that rate, which the engine has always had and never
      // named: a refusal at the door was never a sale, a send-back was.
      refusedRate: at.conversions > 0 ? at.refused / at.conversions : null,
      sentBackRate: at.conversions > 0 ? at.sentBack / at.conversions : null,
      refusedShare: at.returned > 0 ? at.refused / at.returned : null,
      codShare: at.codShare ?? null,
      impressionShare: at.eligibleAuctions > 0 ? at.impressions / at.eligibleAuctions : null,
    };
  });
}

/**
 * Which places are paying for themselves, said in one sentence.
 *
 * Same principle as `negativesOutlook` and `termsOutlook`: a live read of this
 * account beats a paragraph the player has to apply to themselves. It says where
 * to look and never what to do - whether to leave a place depends on what else
 * the money could buy, and this card cannot see that.
 *
 * @param {Array<object>} rows from locationRows
 * @returns {{played: boolean, best: object|null, worst: object|null, note: string}}
 */
export function locationOutlook(rows) {
  const traded = rows.filter((r) => r.clicks >= 1 && r.keptPerClickPaise != null);
  if (traded.length < 2) {
    return {
      played: traded.length > 0,
      best: null,
      worst: null,
      note: 'Not enough has run yet to compare places. This table needs a week or '
        + 'two of clicks, and the returns behind it take longer still.',
    };
  }

  // Ranked on what a click KEPT, not on what it sold: revenue per click puts
  // the metros on top by basket size alone, and the freight on a refused parcel
  // can reverse that.
  const sorted = [...traded].sort((a, b) => b.keptPerClickPaise - a.keptPerClickPaise);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const settling = rows.some((r) => r.conversions > 0 && r.returned === 0);

  let note = `A click has left you ${rupees(best.keptPerClickPaise)} in `
    + `${best.label.toLowerCase()} and ${rupees(worst.keptPerClickPaise)} in `
    + `${worst.label.toLowerCase()}, after returns, your margin and return freight — `
    + `against ${rupees(best.cpcPaise)} and ${rupees(worst.cpcPaise)} paid for one.`;

  // The sentence the old figure could never produce: a place where the click
  // cost more than it left. That is the bid to cut, and revenue hid it.
  const losing = traded.filter((r) => r.keptPerClickPaise < r.cpcPaise);
  for (const place of losing) {
    note += ` In ${place.label.toLowerCase()} a click has cost more than it left you so far.`;
  }

  if (settling) {
    note += ' Some of these weeks have conversions that have not been returned yet, '
      + 'so the worse places will look better than they are for a while longer.';
  }

  // I28: the arithmetic the player has to be able to do for themselves. A
  // refusal and a send-back are different events and the card now separates
  // them, but the split only means something beside the reason for it — and the
  // consequence, which is that a size guide can only ever reach half of it.
  const worstRefusal = [...traded]
    .filter((r) => r.refusedRate != null && r.codShare != null)
    .sort((a, b) => b.refusedRate - a.refusedRate)[0];

  if (worstRefusal && worstRefusal.refusedRate > 0) {
    note += ` In ${worstRefusal.label.toLowerCase()}, `
      + `${pct(worstRefusal.codShare)} of orders are paid at the door and `
      + `${pct(worstRefusal.refusedShare)} of the returns from there never got through it. `
      + `A refusal is not a return: there was no sale to reverse, it still cost you `
      + `${rupees(RTO_FREIGHT_PAISE)} of freight both ways, and no size guide fixes `
      + 'somebody changing their mind on the doorstep — which is the half of your '
      + 'returns a size guide can never reach.';
  }

  return { played: true, best, worst, note };
}

export function setDaypart(draft, index, percent) {
  if (!Number.isInteger(index) || index < 0 || index >= DAYPART_BLOCKS.length) {
    return { ok: false, reason: `no daypart block ${String(index)}` };
  }
  const [lo, hi] = DAYPART_RANGE;
  if (!Number.isInteger(percent) || percent < lo || percent > hi) {
    return { ok: false, reason: `an adjustment is a whole percentage from ${lo} to ${hi}` };
  }
  const next = [...draft.daypartAdjustments];
  next[index] = percent;
  draft.daypartAdjustments = next;
  return { ok: true };
}

/**
 * Each block of the day, with what this account has actually seen in it.
 *
 * THE DATA IS THE PLAYER'S OWN. `bidding.observedByHour` is cumulative clicks
 * and LANDED conversions per hour of day, written by the engine and carried in
 * `getSelfView` — the same history a bid strategy has to accumulate before it
 * can daypart at all (12.2, D2). `HOUR_PROFILES` and `HOURLY_INTENT_CURVE` are
 * the model and are never shown; `tests/ui.test.js` fails if this file so much
 * as names them.
 *
 * That is what makes the choice reasoned rather than a guess, and it is why the
 * lesson works: I5 forces the demand peak and the intent peak apart, so the
 * block with the most clicks is NOT the block with the best conversion rate.
 * The table puts both columns side by side and says nothing — the player reads
 * it off.
 *
 * @param {object} draft
 * @returns {Array<object>} one row per block
 */
export function daypartRows(draft) {
  const observed = draft.bidding?.observedByHour ?? null;

  return DAYPART_BLOCKS.map((block, index) => {
    let clicks = 0;
    let conversions = 0;
    let thinHours = 0;
    for (let hour = block.start; hour < block.end; hour++) {
      const seen = observed?.[hour] ?? { clicks: 0, conversions: 0 };
      clicks += seen.clicks;
      conversions += seen.conversions;
      // MIN_HOUR_OBSERVATIONS is per HOUR, not per block: a block can hold
      // plenty of clicks and still have no hour the strategy would trust.
      if (seen.clicks < MIN_HOUR_OBSERVATIONS) thinHours++;
    }
    const percent = draft.daypartAdjustments[index] ?? 0;
    return {
      index,
      label: block.label,
      start: block.start,
      end: block.end,
      clicks,
      conversions,
      rate: clicks > 0 ? conversions / clicks : null,
      thin: thinHours > 0,
      thinHours,
      hours: block.end - block.start,
      percent,
      // The engine's own function, asked once per block. Every hour in a block
      // shares an adjustment, so any hour of it answers for all of them.
      multiplier: daypartMultiplier(draft.daypartAdjustments, block.start),
    };
  });
}

/** This account's conversion rate across every hour it has data for. */
export function observedRateOverall(draft) {
  const observed = draft.bidding?.observedByHour ?? [];
  let clicks = 0;
  let conversions = 0;
  for (const hour of observed) {
    clicks += hour.clicks;
    conversions += hour.conversions;
  }
  return clicks > 0 ? conversions / clicks : null;
}

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
 * Whether this account needs to think about negatives at all, from its own data.
 *
 * THE QUESTION THIS ANSWERS came from playing: "what does this section do, do I
 * even need to pay attention to it or just let it be". It has a real answer and
 * prose cannot give it, because the answer depends on the account.
 *
 * Negatives matter in proportion to how loosely your keywords match. Measured
 * on this query set: five phrase keywords on long strings produced a search
 * terms report with five rows and nothing whatever to block, while one broad
 * keyword took it to seventy — three of them `gym near me`, `free gym diet
 * chart` and `gym membership price`, which convert at exactly zero for
 * everybody (12.1).
 *
 * So the card reads the player's own match types and their own report and says
 * which of those two accounts they are running.
 *
 * @param {object} draft
 * @param {object} terms search terms report rows, keyed by query id
 * @returns {object}
 */
export function negativesOutlook(draft, terms) {
  const rows = Object.values(terms ?? {}).filter((r) => r.impressions > 0);
  const active = draft.keywords.filter((k) => k.active !== false);
  const loose = active.filter((k) => k.matchType !== 'exact').length;
  const broad = active.filter((k) => k.matchType === 'broad').length;

  // The same marking the search terms table already makes: clicks paid for
  // that came back with nothing. Not proof of waste on one week - conversions
  // are still arriving - which is why the card points at the report rather
  // than telling anyone to block.
  const wasteful = rows.filter((r) => r.clicks >= 5 && r.conversions === 0);
  const wastedPaise = wasteful.reduce((total, r) => total + r.costPaise, 0);

  return {
    played: rows.length > 0,
    searches: rows.length,
    keywords: active.length,
    loose,
    broad,
    wasteful: wasteful.length,
    wastedPaise,
    // Worth attention when something is already being wasted, when a keyword
    // is reaching well past the searches it names, or when there are already
    // negatives whose over-blocking is worth checking.
    worthIt: wasteful.length > 0
      || draft.negatives.length > 0
      || (broad > 0 && rows.length > active.length * 3),
  };
}

/**
 * Why the search terms report is the size it is.
 *
 * FOUND BY PLAYING. A player reported having "no information" at week 2, and
 * the reproduction was four phrase keywords producing four rows — each one
 * identical to the keyword that bought it. The report that exists to show what
 * your keywords ACTUALLY matched was a mirror of the keyword list, and the note
 * under it explained only the date range.
 *
 * The explanation already existed, in `negativesOutlook`, printed on the
 * NEGATIVES card — a feature the player was not using and had no reason to
 * open. This is the same live read moved to where the question gets asked,
 * which is I8's own principle: a read of the player's own situation beats a
 * paragraph they have to apply to themselves.
 *
 * WHAT DECIDES IT IS REACH, NOT MATCH TYPE. A long phrase keyword reaches
 * almost nothing beyond itself while a short one reaches dozens, so counting
 * match types would mislabel both. Searches per running keyword is the fact.
 *
 * @param {object} draft
 * @param {object} terms `byQuery`, accumulated over whatever range is on screen
 * @returns {{played: boolean, searches: number, keywords: number, broad: number,
 *   perKeyword: number, mirrored: boolean}}
 */
export function termsOutlook(draft, terms) {
  const searches = Object.values(terms ?? {}).filter((r) => r.impressions > 0).length;
  // Only what is running. A paused keyword matches nothing, so counting it
  // would understate reach and call a healthy report a mirror.
  const active = (draft.keywords ?? []).filter((k) => k.active !== false);
  const keywords = active.length;
  const perKeyword = keywords > 0 ? searches / keywords : 0;

  return {
    played: searches > 0,
    searches,
    keywords,
    broad: active.filter((k) => k.matchType === 'broad').length,
    perKeyword,
    // One search per keyword means nothing was discovered: every row is a
    // search you already chose to buy.
    mirrored: searches > 0 && keywords > 0 && searches <= keywords,
  };
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
 * THE TAGGER IS HANDED IN. This form works from the PUBLIC view of the query
 * set, which carries no tags (16.1), so it cannot look a search's tags up and
 * must not. The dashboard passes a tagger built on the full set, so a keyword
 * taken from the planner carries that search's own tags, as a rival's does
 * (E9); without one, the words are read as they always were.
 *
 * @param {object} draft
 * @param {{text: string, matchType: string, bidPaise: number}} spec
 * @param {{tag?: Function}} [options] - `tag({text})` returns `{tags, taggedContentHash}`
 * @returns {{ok: boolean, reason?: string, keyword?: object, inertOnBroad?: boolean}}
 */
export function addKeyword(draft, { text, matchType = 'phrase', bidPaise } = {}, { tag } = {}) {
  const clean = String(text ?? '').trim();
  if (tokenise(clean).length === 0) return { ok: false, reason: 'a keyword needs at least one word' };
  if (!MATCH_TYPES.includes(matchType)) return { ok: false, reason: 'unknown match type' };
  if (!isPaise(bidPaise)) return { ok: false, reason: 'a bid is a whole number of paise above zero' };
  if (draft.keywords.some((k) => normalise(k.text) === normalise(clean))) {
    return { ok: false, reason: 'that keyword is already in the account' };
  }

  const { tags, taggedContentHash } = (tag ?? tagKeywordOffline)({ text: clean });
  const keyword = {
    id: freshId(clean, draft.keywords, draft.base.keywords),
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
 * Take a keyword out of the ad group entirely.
 *
 * NOT the same as pausing, and both are worth having. Pause is "stop entering
 * auctions, keep the row and its numbers in front of me"; remove is "this was
 * a mistake, get it off my screen". Google Ads has both, and until now this
 * form had only pause — which meant a keyword added by accident could never be
 * fully undone once a round had run.
 *
 * It destroys nothing the engine holds: `qualityHistory` is keyed by keyword id
 * and lives on the ADVERTISER rather than in the ad group, so taking the row
 * out of the ad group leaves the record alone.
 *
 * Remove it and add it straight back and it keeps its id, and therefore its
 * history — `freshId` reuses an id this account already holds for that text.
 * Across ROUNDS it does not: once a removal is committed the form no longer
 * knows the old id, and the keyword comes back as a new one starting from
 * nothing. That is a real edge and it is not worth engineering away; it is
 * also roughly what happens if you delete something in a real account and
 * rebuild it by hand months later.
 *
 * @param {object} draft
 * @param {string} id
 * @returns {{ok: boolean, reason?: string}}
 */
export function removeKeyword(draft, id) {
  const at = draft.keywords.findIndex((k) => k.id === id);
  if (at === -1) return { ok: false, reason: 'no such keyword' };
  draft.keywords.splice(at, 1);
  return { ok: true };
}

/**
 * Add a list of keywords in one go, skipping the ones that cannot be added.
 *
 * Every one goes through `addKeyword`, so each is tagged and validated exactly
 * as a single add would be — the button is a convenience, not a second path.
 *
 * @param {object} draft
 * @param {Array<{text: string, matchType: string, bidPaise: number}>} specs
 * @returns {{added: number, skipped: number}}
 */
export function addKeywords(draft, specs, options = {}) {
  let added = 0;
  let skipped = 0;
  for (const spec of specs ?? []) {
    if (addKeyword(draft, spec, options).ok) added++;
    else skipped++;
  }
  return { added, skipped };
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
function freshId(text, keywords, previous = []) {
  // An id this account already holds for exactly this text wins, so removing a
  // keyword and putting it back is a true undo rather than a fresh start.
  const known = previous.find((k) => normalise(k.text) === normalise(text));
  if (known && !keywords.some((k) => k.id === known.id)) return known.id;

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
      prepaidCard(ctx, refresh),
      daypartCard(ctx, refresh),
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
      // Named, not just priced. "a chart → measured" says what the top-up
      // actually changes; "₹25,000 → ₹55,000" says only that it costs more.
      name.append(el('div', 'capex-already',
        draft.capex[key] > 0
          ? `${featureAt(key, already).label} → ${featureAt(key, already + draft.capex[key]).label}`
          : `${featureAt(key, already).label} already`));
    }
    row.append(name);

    const chips = el('div', 'chips');
    // Declining is always available and always free.
    const none = el('button', `chip small${!draft.capex[key] ? ' on' : ''}`);
    none.type = 'button';
    none.textContent = 'nothing more';
    none.addEventListener('click', () => { setCapex(draft, key, 0); refresh(); });
    chips.append(none);

    // What this top-up would take the target TO, since 13.3 makes investment
    // cumulative: ₹25,000 on top of ₹25,000 is a different rung from ₹25,000 on
    // nothing, and the amount alone cannot say which.
    //
    // The AMOUNTS come from `capexChoices` rather than from CAPEX_STEPS, and that
    // is a correction the user found by playing: offering the rung PRICES as
    // top-ups left the next rung unreachable from a half-funded target, because
    // the increment to it was never on the menu. See I15.
    //
    // AND WHEN A CHIP BUYS NOTHING, IT SAYS SO. On top of an existing ₹25,000 a
    // further ₹25,000 reaches ₹50,000 while the next rung is ₹55,000 — the money
    // is spent and the page does not change. Kept beside the ₹30,000 that DOES
    // buy the rung, because the pair is the S-curve lesson.
    for (const { amountPaise, reaches, wasteful } of capexChoices(key, already)) {
      const chip = el('button', `chip small${draft.capex[key] === amountPaise ? ' on' : ''}`);
      chip.type = 'button';
      chip.textContent = `${wasteful ? 'no change' : reaches.label} · ${rupees(amountPaise)}`;
      if (wasteful) chip.classList.add('wasteful');
      chip.disabled = amountPaise > draft.capex[key] + left;
      chip.addEventListener('click', () => { setCapex(draft, key, amountPaise); refresh(); });
      chips.append(chip);
    }
    row.append(chips);
    row.append(el('div', 'capex-why muted', why));
    box.append(row);
  }

  // The page as this top-up would leave it. Round 0 draws one and this did not,
  // which is most of why the same decision read as two different decisions.
  // Committed PLUS staged, because 13.3 is cumulative.
  const after = {};
  for (const [key] of CAPEX_TARGETS) after[key] = (draft.committed[key] ?? 0) + (draft.capex[key] ?? 0);
  const preview = el('div', 'page-preview');
  preview.append(el('p', 'field-label', 'What they would land on'));
  const sheet = el('div', 'page-sheet');
  sheet.append(el('div', 'page-strip head', 'your product'));
  for (const strip of pageShape(after).strips) {
    sheet.append(el('div', `page-strip ${strip.target}`, strip.label));
  }
  preview.append(sheet);
  box.append(preview);

  // D12: the one figure this choice turns on, from the month just played.
  if (ctx.lastMonth) box.append(capitalReading(ctx.lastMonth));

  box.append(el('p', 'note',
    `Anything you do not commit joins this month's advertising budget instead. `
    + `What you do commit goes live in week ${draft.round + CAPEX_DELAY_ROUNDS}, which leaves `
    + 'the rest of the game to pay it back — and spreading it thin genuinely '
    + 'underperforms committing, because the first small tranche on a target '
    + 'buys a half-built thing that helps nobody. Investment is CUMULATIVE: what '
    + 'you add here lands on top of what is already built, which is why the '
    + 'chips name the rung they would take you to rather than the money.'));
  return box;
}

/**
 * Under half a percent prints as "0%", and "you lost 0% to budget" reads worse
 * than saying the budget never ran out, which is what it means. A display
 * threshold, kept in the view (DECISIONS I6).
 */
const NEVER_RAN_OUT = 0.005;

function capitalReading(month) {
  const node = el('p', 'note capital-read');
  const figures = {
    spent: rupees(month.spentPaise),
    budget: rupees(month.budgetPaise),
    lost: pct(month.lostToBudget),
  };
  node.append(el('strong', null, month.lostToBudget < NEVER_RAN_OUT
    ? CAPITAL.lastMonthNeverRanOut(figures)
    : CAPITAL.lastMonth(figures)));
  node.append(document.createTextNode(` ${CAPITAL.turnsOn()}`));
  return node;
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
  // Where the guide's "Smart bidding has to learn" shows the player. The form
  // replaces the dashboard's own `decisions` slot when it draws, so its cards
  // carry their own.
  node.dataset.slot = 'bidding';
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
/**
 * What the strategy will actually bid, and whether that is enough to appear.
 *
 * FOUND BY PLAYING. Target ROAS bids DOWN — `bid = order value × conversion
 * rate ÷ target` — so raising the target is an instruction to pay less. At a
 * target of 25 the bid fell under the reserve and the week came back completely
 * blank, reporting "lost to rank 100%". That phrase reads as being OUTBID, so
 * the natural response is to raise keyword bids — which does nothing, because
 * the strategy computes its own bid and the keyword bid is only a ceiling.
 *
 * Every number here is the engine's own. `effectiveBidPaise` is the function
 * the round will actually call, and `minimumBidToShowPaise` is the auction's
 * own reserve; a view that recomputed either would agree with it right up until
 * one of them changed.
 *
 * THE BID REPORTED IS THE BEST HOUR'S, so `willShow: false` means the account
 * appears NOWHERE, at any hour — not merely that it is quiet at 3am.
 *
 * @param {object} draft
 * @returns {null | {bidPaise: number, needPaise: number, willShow: boolean,
 *   qualitySignal: number, keywordText: string}} null when nothing is running
 */
export function bidOutlook(draft) {
  const keyword = (draft.keywords ?? []).find((k) => k.active !== false);
  if (!keyword) return null;

  const business = { aovMeanPaise: draft.catalogue?.aovMeanPaise ?? 0 };
  let bidPaise = 0;
  for (let hour = 0; hour < HOURS_PER_DAY; hour++) {
    // rng omitted: the noise-free centre of the estimate. A preview that drew
    // from the error distribution would show a different number each keystroke.
    const bid = effectiveBidPaise({
      strategy: draft.strategy,
      strategyParams: draft.strategyParams,
      keyword,
      business,
      bidding: draft.bidding,
      daypartAdjustments: draft.daypartAdjustments,
      hour,
      rng: null,
    });
    if (bid > bidPaise) bidPaise = bid;
  }

  // The most favourable query this keyword could meet: its own words, someone
  // buying. If the bid cannot clear the reserve HERE it clears it nowhere.
  const { base } = qualitySignalBase(draft.gradedQuality, {
    text: keyword.text, intent: 'commercial', tags: [...(keyword.tags ?? [])],
  }, keyword);
  const needPaise = minimumBidToShowPaise(base);

  return {
    bidPaise,
    needPaise,
    willShow: bidPaise >= needPaise,
    qualitySignal: base,
    keywordText: keyword.text,
  };
}

function warningBody(ctx) {
  const draft = ctx.draft;
  const out = [];

  const predicts = STRATEGIES[draft.strategy]?.predictsConversions;

  // What it will actually bid, before the week is spent finding out. The
  // failure this exists for reported itself as "lost to rank 100%", which
  // reads as being outbid and sends a player to raise keyword bids — the one
  // lever that cannot help, because the strategy sets its own bid.
  const outlook = bidOutlook(draft);
  if (outlook) {
    const line = el('p', outlook.willShow ? 'note' : 'problems');
    line.append(document.createTextNode(
      `${strategyName(draft.strategy)} bids about ${rupees(outlook.bidPaise)} at best, `
      + `on ${outlook.keywordText}. `,
    ));
    line.append(document.createTextNode(outlook.willShow
      ? `Your quality needs ${rupees(outlook.needPaise)} to appear at all, so this shows.`
      : `Your quality needs ${rupees(outlook.needPaise)} to appear at all, so THIS SHOWS `
        + 'NOWHERE — you would enter every auction and win none, and the week would '
        + 'come back blank. Raising your keyword bid will not fix it: the keyword bid '
        + 'is only a ceiling, and this strategy is bidding well under it.'));
    out.push(line);
  }

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
/**
 * What a prepaid order is discounted by (I34).
 *
 * THE LEVER THE BACK HALF DID NOT HAVE. Capital shuts at round 5 and the two
 * things left after it — a bid adjustment and a negative — move your MIX and
 * your TRAFFIC. Neither moves a rate. This does: a discount shifts buyers off
 * cash, cash is what gets refused, and a refusal costs freight and a sale.
 *
 * Every chip is a real rung of the sourced curve, and the card says what each
 * one buys and what it costs, because the whole decision is that arithmetic.
 */
/**
 * The refusal rate this account runs at, with and without its prepaid discount.
 *
 * Weighted by where the account actually bought clicks once it has bought any,
 * and at the towns' mix before then — the most cash-heavy place, so the card
 * never opens by understating what the discount is for.
 *
 * THE PRICE TIER COMES FROM THE DRAFT. The card first read it from `ctx.price`,
 * which nothing ever set, so it asked for the cash mix of tier "undefined" and
 * threw — on the dashboard, after every week, from the day it shipped until a
 * deployment smoke test played one. The draft's position is the staged one, so
 * a player about to move tier sees the rate the next week will actually run at.
 *
 * @param {object} draft from `createDraft`
 * @param {object[]} rows from `locationRows`, one per location tier
 * @returns {{now: number, none: number}} refusal rates, 0..1
 */
export function prepaidOutlook(draft, rows) {
  const price = draft.position?.price;
  const clicks = rows.reduce((a, r) => a + (r.clicks ?? 0), 0);
  const at = (paise) => (clicks > 0
    ? rows.reduce((a, r, i) => a + (r.clicks ?? 0) * refusalRateFor(price, i, paise), 0) / clicks
    : refusalRateFor(price, LOCATION_TIERS.length - 1, paise));
  return { now: at(draft.prepaidDiscountPaise), none: at(0) };
}

/**
 * The prepaid card's two figures, read from the context the form is handed.
 *
 * Apart from the card so a test can read what it shows without drawing it:
 * this is the line where the card takes its figures from its context.
 *
 * @param {object} ctx from `formContext` in ui/dashboard.js
 * @returns {{now: number, none: number}} refusal rates, 0..1
 */
export function prepaidReading(ctx) {
  const rows = locationRows(ctx.draft, ctx.history ?? [], ctx.playerId);
  return prepaidOutlook(ctx.draft, rows);
}

function prepaidCard(ctx, refresh) {
  const node = card('Prepaid discount', 'money off, to keep the parcel out of the wrong hands', 'span-2');
  const draft = ctx.draft;
  const chips = el('div', 'chip-row');

  for (const rung of PREPAID_DISCOUNT_CURVE) {
    const on = draft.prepaidDiscountPaise === rung.paise;
    const chip = el('button', `chip small${on ? ' on' : ''}`);
    chip.type = 'button';
    chip.textContent = rung.paise === 0 ? 'none' : rupees(rung.paise);
    chip.title = rung.paise === 0
      ? 'cash on delivery at whatever rate the market runs'
      : `moves ${pct(rung.shifted)} of your cash orders to prepaid`;
    chip.addEventListener('click', () => {
      setPrepaidDiscount(draft, rung.paise);
      refresh();
    });
    chips.append(chip);
  }
  node.append(chips);

  // What it is doing to this account, at the mix this account actually buys.
  const { now, none } = prepaidReading(ctx);
  const table_ = el('table', 'mini');
  table(table_, ['', { label: 'Refusals', num: true }, { label: 'Costs you', num: true }], [
    { cells: ['No discount', pct(none, 1), '—'] },
    {
      cells: [
        draft.prepaidDiscountPaise === 0 ? 'This setting' : `At ${rupees(draft.prepaidDiscountPaise)}`,
        pct(now, 1),
        draft.prepaidDiscountPaise === 0 ? '—' : `${rupees(draft.prepaidDiscountPaise)} a prepaid order`,
      ],
      className: draft.prepaidDiscountPaise > 0 ? 'best-place' : null,
    },
  ]);
  node.append(table_);

  const note = el('p', 'note');
  if (draft.prepaidDiscountPaise === 0) {
    note.append(document.createTextNode(
      'Cash orders are refused about three and a half times as often as prepaid ones, '
      + 'and a refusal costs the freight both ways plus a sale that never happened. '
      + 'A discount is the only lever on that which is open every week — capital is not.',
    ));
  } else {
    note.append(el('strong', null,
      `${pct(Math.max(0, 1 - now / none))} fewer refusals`));
    note.append(document.createTextNode(
      `, bought with ${rupees(draft.prepaidDiscountPaise)} off every prepaid order. `
      + 'The rungs get worse as they get bigger — the first one does most of the work — '
      + 'so the question is whether the freight you save is worth the margin you give up.',
    ));
  }
  node.append(note);
  return node;
}

function splitCard(ctx, refresh) {
  const draft = ctx.draft;
  if (draft.weeklySplitPaise.length === 0) return null;

  // Half a row: measured 247px wide against 287px at half, and it pairs with
  // the hours card, which is the other half of pacing the same month.
  const node = card("This month's budget", "how the month is divided across its weeks", 'span-2');

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

// --- dayparting ------------------------------------------------------------

/**
 * The six blocks of the day, and what this account has seen in each of them.
 *
 * The card says nothing about which hours are good. It puts clicks beside
 * conversion rate and lets the player read it, because I5 forces the demand
 * peak and the intent peak at least three hours apart — so the busiest block is
 * reliably NOT the best-converting one, and noticing that is the whole of H4.
 * Being told it would be a different and much smaller lesson.
 */
function daypartCard(ctx, refresh) {
  const draft = ctx.draft;
  // 426px wide against 463px at half. The six blocks stack rather than reflow,
  // so the width was never doing much for it.
  const node = card('Hours of the day', 'when you bid more, and when you bid less', 'span-2');
  // Where the guide's "Bidding by the hour" shows the player (see biddingCard).
  node.dataset.slot = 'hours';
  const rows = daypartRows(draft);
  const overall = observedRateOverall(draft);
  const best = Math.max(...rows.map((r) => r.rate ?? 0));

  const list = el('table', 'mini daypart');
  table(list, [
    'Block', 'Hours', { label: 'Clicks', num: true }, { label: 'Conv', num: true },
    { label: 'Rate', num: true }, '', { label: 'Bid', num: true },
  ], rows.map((row) => {
    const box = input({
      type: 'number',
      value: String(row.percent),
      min: String(DAYPART_RANGE[0]),
      max: String(DAYPART_RANGE[1]),
      step: '5',
      onInput: (value) => {
        const percent = Math.round(Number(value));
        if (setDaypart(draft, row.index, percent).ok) refresh({ summaryOnly: true });
      },
    });

    // Relative to this account's own average, not to anything the model knows.
    const track = el('div', 'track');
    const fill = el('div', `fill ${row.rate != null && overall != null && row.rate >= overall ? 'shown' : 'rank'}`);
    fill.style.width = `${best > 0 ? Math.round(100 * ((row.rate ?? 0) / best)) : 0}%`;
    track.append(fill);

    return {
      className: row.thin ? 'thin-hours' : null,
      cells: [
        row.label,
        `${hourLabel(row.start)}–${hourLabel(row.end)}`,
        whole(row.clicks),
        row.conversions > 0 ? row.conversions.toFixed(1) : '0',
        row.rate == null ? '—' : `${(100 * row.rate).toFixed(2)}%`,
        track,
        box,
      ],
    };
  }));
  node.append(scrollX(list));

  const thin = rows.filter((r) => r.thin);
  if (thin.length > 0) {
    node.append(el('p', 'note',
      `${thin.length} of these blocks contain hours with fewer than `
      + `${MIN_HOUR_OBSERVATIONS} clicks, marked above. A conversion rate built on `
      + 'a handful of clicks is noise, and a bid adjustment made on it is a guess '
      + 'with extra steps.'));
  }

  node.append(el('p', 'note',
    'An adjustment multiplies what you bid in those hours. It does not make more '
    + "people search, and it does not add money: the day's budget is the same, so "
    + 'bidding harder in the morning leaves less for the evening. −100% bids the '
    + 'minimum, which in practice drops you under the reserve and out of the '
    + 'auction.'));

  // D11, the half that was still owed: said only while it is true.
  if (hourAdjustmentStacks(draft.strategy)) {
    const told = el('p', 'note');
    told.append(document.createTextNode(FORM.hoursTwice()));
    const why = whyButton(FORM.hoursTwice, ctx.openGuide);
    if (why) told.append(why);
    node.append(told);
  }
  return node;
}

/**
 * Does an hour adjustment land on top of this strategy's own reading of the
 * hour? (DECISIONS D11.) The strategies that predict conversions lean by hour
 * from their own history, and `effectiveBidPaise` multiplies the player's hour
 * adjustment in as well, so under them the hour counts twice. Real Google Ads
 * does not use schedule adjustments with those strategies at all.
 *
 * @param {string} strategy
 * @returns {boolean}
 */
export function hourAdjustmentStacks(strategy) {
  return STRATEGIES[strategy]?.predictsConversions === true;
}

// --- negatives -------------------------------------------------------------

function negativesCard(ctx, refresh) {
  const node = card('Negatives', 'searches you refuse to pay for');
  const draft = ctx.draft;

  // Does this account need to care yet? Answered from its own numbers rather
  // than left as a paragraph the player has to apply to themselves.
  const outlook = negativesOutlook(draft, ctx.terms);
  const verdict = el('p', outlook.worthIt ? 'neg-verdict live' : 'neg-verdict quiet');
  if (!outlook.played) {
    verdict.textContent = 'Nothing has run yet. Once a week has played, this is where '
      + 'you find out which searches your keywords actually bought.';
  } else if (outlook.worthIt) {
    verdict.append(el('strong', null, 'Worth your attention this week. '));
    verdict.append(document.createTextNode(
      outlook.wasteful > 0
        ? `${outlook.wasteful} of your ${outlook.searches} searches took five clicks or `
          + `more and returned nothing, costing ${rupees(outlook.wastedPaise)}. `
        : `${outlook.keywords} keywords pulled you into ${outlook.searches} different `
          + 'searches, which is a lot further than you named. ',
    ));
    verdict.append(document.createTextNode(
      'Read the search terms report above and block what is not yours.',
    ));
  } else {
    verdict.append(el('strong', null, 'Not much for you here yet. '));
    verdict.append(document.createTextNode(
      `Your ${outlook.keywords} keywords matched ${outlook.searches} searches, and `
      + 'none of them is taking clicks without returning anything. Negatives start '
      + 'to earn their keep when a keyword reaches past the words it names — which '
      + 'is what broad match is for, and what it costs.',
    ));
  }
  node.append(verdict);

  if (draft.negatives.length > 0) {
    const list = el('table', 'mini negatives');
    table(list, ['Blocked', 'Type', { label: 'Searches\nit blocks', num: true }, ''],
      draft.negatives.map((negative, index) => {
        const preview = previewNegative(negative, { queries: ctx.queries, terms: ctx.terms });
        const remove = el('button', 'add');
        remove.type = 'button';
        remove.textContent = 'remove';
        remove.addEventListener('click', () => { dropNegative(draft, index); refresh(); });
        return { cells: [negative.text, negative.matchType, whole(preview.blocked.length), remove] };
      }));
    // Missed by the six-table fix, which measured a game with no negatives.
    // The two-line header is what makes it fit a 375px phone, with the remove
    // button in view; the wrapper is for a long phrase negative, which can
    // still widen it past the card.
    node.append(scrollX(list));
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
    + 'can only get out of it by naming what it literally said. A blocked search '
    + 'stops being one you were eligible for at all, so your impression share '
    + 'moves as well as your spend, and it stays blocked until you remove it.'));
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
    // How far it reaches on the match type chosen, so switching to broad shows
    // what broad would buy before a week is spent on it (E8).
    const match = el('div', 'kw-match');
    match.append(matchType);
    if (ctx.reach) match.append(el('div', 'kw-reach', FORM.reach({ count: ctx.reach(keyword) })));

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
    toggle.title = paused
      ? 'Start entering auctions again.'
      : 'Stop entering auctions, but keep the row and its numbers.';
    toggle.addEventListener('click', () => {
      updateKeyword(draft, keyword.id, { active: paused });
      refresh();
    });

    const drop = el('button', 'add danger');
    drop.type = 'button';
    drop.textContent = 'remove';
    drop.title = 'Take it out of the ad group altogether. What it has already '
      + 'learned is kept, so adding it back later picks its history up again.';
    drop.addEventListener('click', () => { removeKeyword(draft, keyword.id); refresh(); });

    const actions = el('div', 'row-actions');
    actions.append(toggle, drop);

    return {
      className: paused ? 'paused-row' : null,
      cells: [
        label, match, bid,
        stats ? whole(stats.clicks) : '0',
        stats ? rupees(stats.costPaise) : '—',
        stats && stats.clicks > 0 ? rupees(stats.costPaise / stats.clicks) : '—',
        stats && stats.conversions > 0 ? stats.conversions.toFixed(1) : '0',
        qualityCell(score, ctx.grades),
        actions,
      ],
    };
  });

  const list = el('table', 'mini picked');
  table(list, [
    'Keyword', 'Match', { label: 'Bid ₹', num: true }, { label: 'Clicks', num: true },
    { label: 'Cost', num: true }, { label: 'CPC', num: true }, { label: 'Conv', num: true },
    { label: 'Quality', num: true }, '',
  ], rows);
  node.append(scrollX(list));

  if (draft.keywords.every((k) => k.active === false)) {
    node.append(el('p', 'problems',
      'Every keyword is paused. You will enter no auctions at all next week.'));
  }

  node.append(planner(ctx, refresh));

  node.append(qualityNote(ctx));
  node.append(el('p', 'note',
    'Exact and phrase match on the words. Broad matches on meaning through the '
    + 'tags — and nobody can tell you in advance how far it will travel, which '
    + 'is the point. Broadening raises impressions and LOWERS impression share, '
    + 'because it grows the number of auctions you were eligible for faster '
    + 'than the number you won.'));
  return node;
}

/**
 * The Quality Score cell: the number, and the three ratings it is made of.
 *
 * The three ratings are the part that can actually be acted on. The 1-10
 * number is deliberately coarse and deliberately lagging, and the card says so
 * rather than leaving a player to conclude their ad copy does not matter when
 * it does not move.
 */
function qualityCell(score, graded) {
  const summary = qualitySummary(score, graded);
  const box = el('div', 'quality-cell');

  if (summary.value == null) {
    box.append(el('div', 'quality-score muted', '—'));
    box.title = summary.note;
    return box;
  }

  box.append(el('div', 'quality-score', String(summary.value)));
  const list = el('div', 'quality-parts');
  for (const part of summary.ratings) {
    const row = el('div', `quality-part ${part.rating}`);
    row.append(el('span', 'quality-part-label', part.label));
    if (part.graded != null) row.append(el('span', 'quality-part-grade', `${part.graded}/10`));
    row.append(el('span', 'quality-part-rating', part.rating));
    row.title = part.meaning;
    list.append(row);
  }
  box.append(list);
  return box;
}

/**
 * Keyword Planner, mid-game: text, weekly volume, intent, and nothing else.
 *
 * The same list round 0 offered, and the same withholding — what a search does
 * after the click is earned by running it (16.1, C4).
 */
/**
 * What the Quality Score is, and what it is not.
 *
 * Without this the column reads as a grade out of ten for your ad. It is not:
 * it is a comparison against everyone else who appeared on the same searches,
 * over completed rounds only, in three levels per component. Better copy shows
 * up in what you PAY and where you RANK on the very next round, and may never
 * move this column at all - which is a true and useful thing to know, and a
 * miserable thing to work out on your own.
 */
/**
 * How far back the quality comparison reaches, in words that fit the game.
 *
 * `QUALITY_WINDOW_ROUNDS` is 13 — Google's ninety days in weeks — and a game is
 * twelve, so "the last 13 finished rounds" was true to the constant and read as
 * a mistake (reviews/slc-review.md, 9C). While every week played is inside the
 * window, that is what it says.
 *
 * @param {number} finishedRounds - weeks already played
 * @param {number} windowRounds - the comparison window
 * @returns {string}
 */
export function qualityWindowPhrase(finishedRounds, windowRounds) {
  return finishedRounds <= windowRounds
    ? 'over every week played so far'
    : `over the last ${windowRounds} finished weeks`;
}

function qualityNote(ctx) {
  const weakest = ctx.draft.keywords
    .map((k) => qualitySummary(ctx.quality?.[k.id], ctx.grades).weakest)
    .find(Boolean);

  const finished = Math.max(0, (ctx.draft.round ?? 1) - 1);
  const note = el('p', 'note');
  note.append(document.createTextNode(
    'Quality is a comparison, not a grade: it measures you against everyone else '
    + `who appeared on the same searches, ${qualityWindowPhrase(finished, QUALITY_WINDOW_ROUNDS)}. `
    + 'It is coarse on purpose — three levels per component — so a real '
    + 'improvement can leave it exactly where it was. ',
  ));
  note.append(el('strong', null,
    'Better copy shows up in your CPC and your position first, and here late or never.'));
  note.append(document.createTextNode(
    ' The number beside each component is the grade your copy earned, which moves '
    + 'the moment you rewrite it — including the landing-page capital, which is '
    + 'added after grading.',
  ));
  if (weakest) {
    note.append(document.createTextNode(
      ` The weakest part of your ad right now is ${weakest.label.toLowerCase()} — `
      + `${weakest.meaning}.`,
    ));
  }
  return note;
}

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

  const bulk = el('div', 'bulk-add');
  box.append(bulk);

  const listBox = el('div', 'scroll research');
  box.append(listBox);

  function draw() {
    const term = chosen.term.trim().toLowerCase();
    const shown = all.filter((q) => !term || q.text.includes(term)).slice(0, 40);

    // Says how many it will add, so it is a considered click rather than a
    // blind one — this is the button most likely to bury an account in
    // keywords it never chose.
    const addable = shown.filter((q) => !held.has(normalise(q.text)));
    bulk.replaceChildren();
    if (addable.length > 1) {
      const go = el('button', 'add');
      go.type = 'button';
      go.textContent = `Add all ${addable.length} shown`;
      go.title = `${chosen.matchType} match at ${rupees(chosen.bidPaise)} each, `
        + 'the same as adding them one at a time.';
      go.addEventListener('click', () => {
        addKeywords(ctx.draft, addable.map((q) => ({
          text: q.text, matchType: chosen.matchType, bidPaise: chosen.bidPaise,
        })), { tag: ctx.tagKeyword });
        refresh();
      });
      bulk.append(go);
    }

    const rows = shown
      .map((q) => {
        const already = held.has(normalise(q.text));
        const button = el('button', 'add');
        button.type = 'button';
        button.textContent = already ? 'in account' : 'add';
        button.disabled = already;
        button.addEventListener('click', () => {
          addKeyword(ctx.draft,
            { text: q.text, matchType: chosen.matchType, bidPaise: chosen.bidPaise },
            { tag: ctx.tagKeyword });
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
