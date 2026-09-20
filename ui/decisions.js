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

import { rupees, whole, ratio, pct } from './dom.js';
import { blockedBy, normalise, tokenise } from '../engine/matching.js';
import { STRATEGIES, daypartMultiplier, effectiveBidPaise } from '../engine/strategies.js';
import { minimumBidToShowPaise } from '../engine/auction.js';
import { qualitySignalBase } from '../engine/quality.js';
// Derived from the hour curves rather than declared, so it lives with them.
import { HOURS_PER_DAY } from '../engine/querySet.js';
import { LOCATIONS } from '../content/locations.js';
import { codShareFor } from '../engine/locations.js';
import { moneyBlock } from '../engine/report.js';
import { allocate } from '../engine/money.js';
import {
  canReposition, isOneStep, allCells, parseCell, cellKey, landingPageBonus, refusalOutlook,
} from '../engine/positions.js';
import {
  LEARNING_ROUNDS, CAPEX_ALLOCATION_PAISE, CAPEX_DELAY_ROUNDS,
  REPOSITION_COST_PAISE, ROUNDS_PER_MONTH, LOCATION_TIERS,
  DAYPART_BLOCKS, MIN_HOUR_OBSERVATIONS, QUALITY_MIN_IMPRESSIONS,
  RTO_FREIGHT_PAISE, PREPAID_DISCOUNT_MAX_PAISE, PREPAID_DISCOUNT_CURVE,
} from '../engine/constants.js';
import { triggersLearning } from '../game.js';
import { tagKeywordOffline, tagContentHashOf } from '../agents/keywordTagger.js';
import { pageAsItStands, rulesFor } from '../content/landingPage.js';
import { DEAR_TIMES, averagePerSalePaise, isDear } from '../content/searchTerms.js';

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
 * Every row carries an `id` that stays the same while its figures move, so the
 * Studio's tray can keep a line in place mid-drag (ui/shell/tray.js).
 *
 * @param {object} draft
 * @returns {Array<{id: string, kind: string, label: string, detail: string, undo: Function|null}>}
 */
export function changes(draft) {
  const rows = [];

  if (draft.repositionOpen && movedPosition(draft)) {
    rows.push({
      id: 'position',
      kind: 'position',
      label: `Position: ${cellName(draft.base.position)} → ${cellName(draft.position)}`,
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
      id: 'capital',
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

  // In what each week will be given (`weekBudgetsAtRun`), named by the game's
  // own week, as the top bar and the Run button number them: at week 5 the
  // plan's own figures are pre-capital, and "Week 1" was the month's first week.
  const given = weekBudgetsAtRun(draft);
  const givenBefore = weekBudgetsAtRun(draft, draft.base.weeklySplitPaise);
  const firstWeek = draft.round - draft.weekIndex;
  draft.weeklySplitPaise.forEach((paise, index) => {
    const before = draft.base.weeklySplitPaise[index];
    if (paise === before || given[index] === givenBefore[index]) return;
    rows.push({
      id: `budget:${index}`,
      kind: 'budget',
      label: `Week ${firstWeek + index} budget ${rupees(givenBefore[index])} → ${rupees(given[index])}`,
      detail: index === draft.weekIndex
        ? 'the week about to run'
        : 'later this month; a new month starts again from an even split',
      undo: () => setWeekBudget(draft, index, before),
    });
  });

  draft.locationAdjustments.forEach((percent, index) => {
    const before = draft.base.locationAdjustments[index];
    if (percent === before) return;
    const place = LOCATIONS[index];
    rows.push({
      id: `location:${index}`,
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
      id: `daypart:${index}`,
      kind: 'daypart',
      label: `${block.label} bid ${signed(before)} → ${signed(percent)}`,
      detail: percent <= -100
        ? `you will bid the minimum between ${hourLabel(block.start)} and ${hourLabel(block.end)}`
        : `${hourLabel(block.start)} to ${hourLabel(block.end)}, every day`,
      undo: () => setDaypart(draft, index, before),
    });
  });

  // I34. Sent by toDecision and, until makeover Task 10 played it, listed
  // nowhere: the tray said "No changes yet" over a discount about to run.
  if (draft.prepaidDiscountPaise !== draft.base.prepaidDiscountPaise) {
    const before = draft.base.prepaidDiscountPaise;
    const after = draft.prepaidDiscountPaise;
    const shown = (paise) => (paise === 0 ? 'none' : rupees(paise));
    rows.push({
      id: 'prepaid',
      kind: 'prepaid',
      label: `Prepaid discount ${shown(before)} → ${shown(after)}`,
      detail: after === 0
        ? 'cash on delivery at whatever rate the market runs'
        : `${rupees(after)} off every prepaid order, from the week about to run`,
      undo: () => setPrepaidDiscount(draft, before),
    });
  }

  if (draft.strategy !== draft.base.strategy) {
    rows.push({
      id: 'strategy',
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
        id: 'strategy-param',
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
        id: `negative-added:${negative.matchType}:${negative.text}`,
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
        id: `negative-removed:${negative.matchType}:${negative.text}`,
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
      id: `keyword-removed:${before.id}`,
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
        id: `keyword-added:${keyword.id}`,
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
        id: `keyword-match:${keyword.id}`,
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
        id: `keyword-bid:${keyword.id}`,
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
        id: `keyword-active:${keyword.id}`,
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
 * What each week of this month will actually be given when the round runs.
 *
 * At an allocation round the engine adds the uncommitted capital, takes off a
 * move, and re-spreads the month over the weeks in the plan's own proportions
 * (engine/round.js, `applyBudgetAdjustments`, with the engine's own `allocate`).
 * So at week 5 a plan of ₹42,000 a week becomes a larger one once a round's
 * uncommitted capital is left for ads, and the plan's figures are not what a
 * week will spend. In any other round the plan is taken as it stands. The
 * figure is not written out here: it moved once already (I41) and a comment
 * quoting it goes stale silently.
 *
 * @param {object} draft
 * @param {number[]} [split] - weights to spread, the draft's own by default
 * @returns {number[]} integer paise per week of the month
 */
export function weekBudgetsAtRun(draft, split = draft.weeklySplitPaise) {
  const respread = draft.capexOpen || (draft.repositionOpen && movedPosition(draft));
  if (!respread || !split.some((w) => w > 0)) return [...split];
  return allocate(monthBudgetAfter(draft), split);
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
/** A cell as the cards name it; `cellOf` is the engine's key for it. */
const cellName = (position) => `${position.price} · ${position.purpose}`;

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
 * @param {object} draft from `createDraft`
 * @returns {{expectedCtr: number, adRelevance: number, landingPage: number}|null}
 *   null when the account has no graded quality yet. The tags above this line
 *   used to describe a `score` parameter and a `{value, ratings, weakest, note}`
 *   return, neither of which this function has ever had.
 */
export function effectiveGrades(draft) {
  const graded = draft.gradedQuality;
  if (!graded) return null;
  // 13.3 adds the landing-page capital as points AFTER grading and never
  // writes them back, so the stored grade understates an account that invested.
  // The engine's own function, not a restatement of the curve.
  const bonus = landingPageBonus(draft.capexBlock ?? {}, draft.round);
  // A page built from capital is graded AS IT STANDS in the week asked about
  // (the owner, 2026-09-17): the function game.js lands before that week's
  // auctions, so a future week reads the page it will have, not the stored one.
  // By the rules the game was begun under: a game saved before grading only what
  // Google names keeps the length rule (C, 2026-09-17).
  const page = draft.adGroups?.[0]?.pageBuiltFromCapital
    ? pageAsItStands(draft.capexBlock ?? {}, draft.round, { rules: rulesFor(draft.adGroups[0]) }).landingPage
    : graded.landingPage;
  return {
    expectedCtr: graded.expectedCtr,
    adRelevance: graded.adRelevance,
    landingPage: Math.min(10, page + bonus),
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
    refused: 0, sentBack: 0, codOrders: 0, codWeighted: 0,
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
      // Each week carries the cash share it was sold at (I34), so weeks differ.
      // Weighted by the orders `refusedRate` divides by, so the share beside the
      // Refused column is the share of the same orders: the latest week alone
      // would put this week's discount beside refusals from weeks without it.
      if (row.codShare != null) {
        at.codOrders += row.conversions ?? 0;
        at.codWeighted += (row.conversions ?? 0) * row.codShare;
      }
      at.eligibleAuctions += row.eligibleAuctions ?? 0;
    }
  }

  return LOCATION_TIERS.map((id, index) => {
    const { codOrders, codWeighted, ...at } = totals[index];
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
      codShare: codOrders > 0 ? codWeighted / codOrders : null,
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
 * @param {object} [args]
 * @param {string} [args.text]
 * @param {string} [args.matchType]
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
 * The mark on the search terms report, and what the Negatives card counts.
 *
 * The rule itself lives in `content/searchTerms.js` since 2026-09-18, because a
 * rival's policy judges a search by it too and `agents/` may not reach into
 * `ui/`. Re-exported here, where every screen already reads it, so the card and
 * the rival cannot drift apart. What it asks, and why it is not "clicks and no
 * sale", is written there (DECISIONS I8's addendum).
 */
export { DEAR_TIMES, averagePerSalePaise, isDear };

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

  // The same mark the search terms table makes, over the same rows. Not proof
  // of waste on one week - sales are still arriving - which is why the card
  // points at the report rather than telling anyone to block.
  const averagePaise = averagePerSalePaise(terms);
  const wasteful = rows.filter((r) => isDear(r, averagePaise));
  const wastedPaise = wasteful.reduce((total, r) => total + r.costPaise, 0);

  return {
    played: rows.length > 0,
    searches: rows.length,
    keywords: active.length,
    loose,
    broad,
    wasteful: wasteful.length,
    wastedPaise,
    averagePaise,
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
 *          terms: Object<string, {clicks: number, impressions: number,
 *            costPaise: number, conversions: number}>}} context `impressions`
 *   is read below and `searchTerms.js` supplies it; this tag omitted it.
 * @returns {object} `blocked`, `spent` (most spent first) and `unspent`, each
 *   row marked `dear` as the search terms report marks it; `totals` over the
 *   spent ones; `averagePaise`, the account's cost of a sale over all of
 *   `terms`; and `sellsWell`, the spent searches whose sales cost no more than
 *   that average
 */
export function previewNegative(negative, { queries, terms }) {
  const averagePaise = averagePerSalePaise(terms);
  const empty = {
    blocked: [], spent: [], unspent: [],
    totals: { clicks: 0, costPaise: 0, conversions: 0 },
    averagePaise,
    sellsWell: [],
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
    row.dear = isDear(row, averagePaise);
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

  // What the block would cost you that is earning its keep: searches whose
  // sales cost no more than the account's average. The warning is about these
  // and no others. It used to fire over any sale at all, and in expected mode
  // almost every search has sold a fraction, so it fired on nearly every block.
  const sellsWell = averagePaise === null ? [] : spent.filter(
    (r) => r.conversions > 0 && r.costPaise <= averagePaise * r.conversions,
  );
  return { blocked, spent, unspent, totals, averagePaise, sellsWell };
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
 * @param {object} [args]
 * @param {string} [args.text]
 * @param {string} [args.matchType]
 * @param {number} [args.bidPaise]
 * @param {object} [options]
 * @param {Function} [options.tag] `tag({text})` returns `{tags, taggedContentHash}`
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
 * @returns {{ok: boolean, reason?: string, keyword?: object}} `keyword` is the
 *   row as it now stands, returned on success and omitted on failure.
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
 * FROM THE ROUND'S OWN ARITHMETIC. `refusalOutlook` is the line the round books
 * refusals with, so the figure carries what next week will apply: order
 * confirmation from the week it is live, purpose, and the place gradient. Until
 * 2026-09-15 the card worked it out from the cash mix alone, which read the same
 * whether or not the player had bought order confirmation — up to 4.3 points
 * high once it was live — and promised a third more from a discount than the
 * round delivered (I29, I34).
 *
 * Weighted by where the account actually bought clicks once it has bought any,
 * and at the towns before then — the most cash-heavy place, so the card never
 * opens by understating what the discount is for.
 *
 * THE PRICE TIER COMES FROM THE DRAFT. The card first read it from `ctx.price`,
 * which nothing ever set, so it asked for the cash mix of tier "undefined" and
 * threw — on the dashboard, after every week, from the day it shipped until a
 * deployment smoke test played one. The draft's position is the staged one, so
 * a player about to move tier sees the rate the next week will actually run at.
 *
 * @param {object} draft from `createDraft`: its position, capital block, round
 *   and discount
 * @param {object[]} rows from `locationRows`, one per location tier
 * @returns {{now: number, none: number}} refusals per order, 0..1
 */
export function prepaidOutlook(draft, rows) {
  const placeWeights = placeWeightsOf(rows);
  const at = (discountPaise) => refusalOutlook({
    position: draft.position, capex: draft.capexBlock, round: draft.round, discountPaise, placeWeights,
  });
  return { now: at(draft.prepaidDiscountPaise), none: at(0) };
}

/** Where the account bought clicks, or the towns before it has bought any (see above). */
function placeWeightsOf(rows) {
  const clicks = rows.map((r) => r.clicks ?? 0);
  return clicks.some((c) => c > 0)
    ? clicks
    : LOCATION_TIERS.map((_, i) => (i === LOCATION_TIERS.length - 1 ? 1 : 0));
}

/**
 * Every rung of the discount, each with next week's refusal rate and the share
 * of orders it would be paid on: the Studio's Returns draws what a rung saves
 * against what it costs from these (design/returns/, chosen 2026-09-15).
 *
 * THE SAME TWO FUNCTIONS THE ROUND USES. The refusal rate is `prepaidOutlook`'s,
 * at the same places; the prepaid share is `codShareFor`'s, which the round
 * charges the discount through, on every prepaid order, the ones already
 * paying first included (I34).
 *
 * @param {object} draft from `createDraft`
 * @param {object[]} rows from `locationRows`, one per location tier
 * @returns {Array<{paise: number, shifted: number, refusal: number, prepaidShare: number}>}
 *   in the curve's order, the first rung none; rates 0..1
 */
export function prepaidRungs(draft, rows) {
  const placeWeights = placeWeightsOf(rows);
  const total = placeWeights.reduce((a, w) => a + w, 0);
  return PREPAID_DISCOUNT_CURVE.map(({ paise, shifted }) => ({
    paise,
    shifted,
    refusal: refusalOutlook({
      position: draft.position, capex: draft.capexBlock, round: draft.round, discountPaise: paise, placeWeights,
    }),
    prepaidShare: placeWeights.reduce((a, w, t) => a + w * (1 - codShareFor(draft.position.price, t, paise)), 0) / total,
  }));
}

/**
 * Does an hour adjustment land on top of this strategy's own reading of the
 * hour? (DECISIONS D11.) The strategies that predict conversions lean by hour
 * from their own history, and `effectiveBidPaise` multiplies the player's hour
 * adjustment in as well, so under them the hour counts twice. Real Google Ads
 * does not use schedule adjustments with those strategies at all.
 *
 * D11 is accepted "and told", so this is what the telling is asked. The classic
 * form's daypart card asked it; since the switch-over's part 2 the Studio's
 * Where and when does (ui/where/read.js, `hoursModel`).
 *
 * @param {string} strategy
 * @returns {boolean}
 */
export function hourAdjustmentStacks(strategy) {
  return STRATEGIES[strategy]?.predictsConversions === true;
}
