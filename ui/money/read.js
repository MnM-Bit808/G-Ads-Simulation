/**
 * What the Studio's Your money shows, read without a page
 * (design/your-money/, chosen by the owner 2026-09-15): this month as one bar
 * whose weeks you move money between, bidding and what week 8 decides beside
 * it, and at week 5 the capital and the one chance to move on top.
 *
 * EVERY FIGURE IS THE FORM'S OR THE ENGINE'S. The month is `weekBudgetsAtRun`
 * (what each week will be given, the engine's own spread at week 5), capital
 * and the move go through `setCapex` and `setPosition`, a bid is `bidOutlook`,
 * and the rank is `rankOf`. So the two looks and the tray cannot disagree.
 *
 * A LINE BETWEEN TWO WEEKS MOVES MONEY BETWEEN THOSE TWO AND NO OTHERS, so a
 * drag can never leave money unplanned or plan more than there is. Money
 * already unplanned (a week that spent less than its budget leaves some) is
 * its own piece at the end, and the last line draws on it.
 */

import { allCells, parseCell, cellKey, isOneStep } from '../../engine/positions.js';
import {
  CAPEX_ALLOCATION_PAISE, CAPEX_DELAY_ROUNDS, MONTHLY_BUDGET_PAISE, RANK_BUDGET_MULTIPLIERS,
  ROUNDS_PER_MONTH,
} from '../../engine/constants.js';
import { STRATEGIES } from '../../engine/strategies.js';
import { capexChoices, pageShape } from '../landing-page.js';
import { featureAt } from '../../content/landingPage.js';
import { rankOf } from '../ending.js';
import {
  monthBudgetAfter, weekBudgetsAtRun, setWeekBudget, bidOutlook, willTriggerLearning,
} from '../decisions.js';

/** The four kinds of site work, in round 0's order (ui/decisions.js, CAPEX_TARGETS). */
export const TARGETS = Object.freeze(['landingPage', 'sizeGuide', 'photography', 'orderConfirmation']);
/** The five strategies, in the order the chips show them. */
export const STRATEGY_ORDER = Object.freeze(['manual', 'maxClicks', 'maxConv', 'targetCpa', 'targetRoas']);
/**
 * What a target slider reaches. Wide enough for any account the game makes: a
 * cost per conversion from ₹50 to ₹2,000 in ₹10 steps, a return from 0.5 to 10.
 */
export const TARGET_RANGE = Object.freeze({
  targetCpa: Object.freeze({ min: 5000, max: 200000, step: 1000 }),
  targetRoas: Object.freeze({ min: 0.5, max: 10, step: 0.1 }),
});
const paramOf = { targetCpa: 'targetCpaPaise', targetRoas: 'targetRoas' };
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
/**
 * Less than a rupee left over, or planned over, is nothing. A week spends a
 * few paise under its budget as a matter of course, and found by playing: the
 * bar drew a piece saying "not planned ₹0" and warned that ₹0 would be lost.
 */
const LEAST_SHOWN_PAISE = 100;
const shownOrNothing = (paise) => (paise >= LEAST_SHOWN_PAISE ? paise : 0);

/**
 * The month as one bar: what the weeks already run spent, what the rest will
 * be given, and any money left unplanned or planned past the month.
 *
 * @param {object} draft
 * @param {Record<number, number>} spentByWeek - week of the month to what it spent, paise (`ctx.spentByWeek`)
 * @returns {{month: number, firstWeek: number, totalPaise: number, spentPaise: number,
 *   weeks: {week: number, index: number, amountPaise: number, state: 'spent'|'next'|'planned'}[],
 *   unplannedPaise: number, overPaise: number, respread: boolean}}
 */
export function monthModel(draft, spentByWeek) {
  const given = weekBudgetsAtRun(draft);
  const firstWeek = draft.round - draft.weekIndex;
  const totalPaise = monthBudgetAfter(draft);
  const weeks = given.map((planned, index) => {
    if (index < draft.weekIndex) {
      return { week: firstWeek + index, index, amountPaise: spentByWeek?.[index] ?? 0, state: 'spent' };
    }
    return { week: firstWeek + index, index, amountPaise: planned, state: index === draft.weekIndex ? 'next' : 'planned' };
  });
  const spentPaise = draft.monthSpentPaise;
  const plannedPaise = sum(weeks.filter((w) => w.state !== 'spent').map((w) => w.amountPaise));
  // At an allocation round the engine spreads the whole month over the plan's
  // shape, so nothing can be left unplanned (weekBudgetsAtRun).
  const moved = draft.repositionOpen && draft.position && draft.base.position
    && (draft.position.price !== draft.base.position.price || draft.position.purpose !== draft.base.position.purpose);
  const respread = Boolean(draft.capexOpen || moved);
  return {
    month: Math.ceil(draft.round / ROUNDS_PER_MONTH),
    firstWeek,
    totalPaise,
    spentPaise,
    weeks,
    unplannedPaise: respread ? 0 : shownOrNothing(totalPaise - spentPaise - plannedPaise),
    overPaise: respread ? 0 : shownOrNothing(spentPaise + plannedPaise - totalPaise),
    respread,
  };
}

/**
 * Drag the line after one week of the month: that week gets `amountPaise`, the
 * next one (or the unplanned piece, after the last week) the rest of the two.
 * Written through `setWeekBudget`, as the plan's own weights, so at week 5 the
 * engine's re-spread gives the weeks what the bar showed.
 *
 * @param {object} draft
 * @param {ReturnType<typeof monthModel>} month - the bar being dragged
 * @param {number} index - the week of the month to the left of the line
 * @param {number} amountPaise - what that week should be given
 * @returns {boolean} whether anything changed
 */
export function moveLine(draft, month, index, amountPaise) {
  const left = month.weeks[index];
  if (!left || left.state === 'spent') return false;
  const last = index === month.weeks.length - 1;
  // At week 5 the engine spreads the whole month, so there is no unplanned
  // piece for the last line to draw on.
  if (last && month.respread) return false;
  const right = last ? null : month.weeks[index + 1];
  const pair = left.amountPaise + (right ? right.amountPaise : month.unplannedPaise);
  const a = Math.max(0, Math.min(pair, Math.round(amountPaise)));
  if (a === left.amountPaise) return false;
  if (last) {
    setWeekBudget(draft, index, a);
    return true;
  }
  // The plan's weights for these two, scaled as the engine will scale them:
  // at week 5 a weight is a share of the month, elsewhere the week itself.
  const weights = draft.weeklySplitPaise;
  const pairWeight = weights[index] + weights[index + 1];
  const scale = pair > 0 ? pairWeight / pair : 1;
  const w = Math.round(a * scale);
  setWeekBudget(draft, index, w);
  setWeekBudget(draft, index + 1, Math.max(0, pairWeight - w));
  return true;
}

/**
 * The capital: each kind of site work's rungs, which can be afforded, which is
 * chosen, and where the ₹1,20,000 goes.
 *
 * @param {object} draft
 * @returns {{targets: object[], committedPaise: number, joinsPaise: number, liveWeek: number,
 *   strips: object[]}}
 */
export function capitalModel(draft) {
  const committedPaise = sum(Object.values(draft.capex));
  const spare = CAPEX_ALLOCATION_PAISE - committedPaise;
  const targets = TARGETS.map((key) => {
    const already = draft.committed?.[key] ?? 0;
    return {
      key,
      already,
      now: featureAt(key, already),
      chips: capexChoices(key, already).map((choice) => ({
        amountPaise: choice.amountPaise,
        reaches: choice.reaches,
        wasteful: choice.wasteful,
        chosen: draft.capex[key] === choice.amountPaise,
        affordable: choice.amountPaise <= spare + draft.capex[key],
      })),
    };
  });
  const after = Object.fromEntries(TARGETS.map((key) => [key, (draft.committed?.[key] ?? 0) + draft.capex[key]]));
  return {
    targets,
    committedPaise,
    joinsPaise: spare,
    liveWeek: draft.round + CAPEX_DELAY_ROUNDS,
    strips: pageShape(after).strips,
  };
}

/**
 * The one step: every cell of the grid, what it earns and how often it is
 * searched (the briefing round 0 used, 17.2), where you are, and which a step reaches.
 *
 * @param {object} draft
 * @param {object} brief - `briefing(querySet)`
 * @returns {{cells: object[], moved: boolean}}
 */
export function positionModel(draft, brief) {
  const from = draft.base.position;
  const cells = allCells().map((key) => {
    const to = parseCell(key);
    const here = to.price === from.price && to.purpose === from.purpose;
    return {
      key,
      price: to.price,
      purpose: to.purpose,
      here,
      reachable: here || isOneStep(from, to),
      chosen: to.price === draft.position.price && to.purpose === draft.position.purpose,
      economics: brief.economicsByTier[to.price],
      searches: brief.weeklySearchesByTier[to.price],
    };
  });
  return { cells, moved: cellKey(draft.position.price, draft.position.purpose) !== cellKey(from.price, from.purpose) };
}

/**
 * Bidding: the strategies, the target a slider sets, the engine's own reading
 * of what the draft would bid, and whether a change restarts the learning.
 *
 * @param {object} draft
 * @returns {{strategy: string, strategies: {id: string, predicts: boolean}[],
 *   target: {kind: string, value: number, min: number, max: number, step: number}|null,
 *   outlook: ReturnType<typeof bidOutlook>, learning: 'predicts'|'free'|null,
 *   learningLeft: number, observed: {conversions: number, rate: number}}}
 */
export function biddingModel(draft) {
  const kind = paramOf[draft.strategy] ? draft.strategy : null;
  return {
    strategy: draft.strategy,
    strategies: STRATEGY_ORDER.map((id) => ({ id, predicts: STRATEGIES[id].predictsConversions === true })),
    // The draft always carries both targets (setup.js starts them at ₹400 and 4).
    target: kind ? { kind, value: draft.strategyParams[paramOf[kind]], ...TARGET_RANGE[kind] } : null,
    outlook: bidOutlook(draft),
    learning: willTriggerLearning(draft) ? (STRATEGIES[draft.strategy].predictsConversions ? 'predicts' : 'free') : null,
    learningLeft: draft.bidding?.learningRoundsRemaining ?? 0,
    observed: { conversions: draft.bidding?.observedConversions ?? 0, rate: draft.bidding?.observedConvRate ?? 0 },
  };
}

/**
 * What week 8 decides: before it, the gross profit counted so far and the
 * ladder of month-3 budgets; after it, the rank alone.
 *
 * NOTHING IS RE-ADDED AFTER THE SNAPSHOT. The engine ranks on the history as
 * it stood at week 8 and keeps only the order (`rankedAtSnapshot`); history
 * keeps being revised after that, so a total summed later would drift from
 * the one that decided month 3.
 *
 * @param {{history: object[], budgetSchedule: object}} state
 * @param {string} playerId
 * @returns {{snapshot: number, taken: boolean, countedPaise: number|null, through: number,
 *   weeksLeft: number, rank: {position: number, of: number}|null,
 *   ladder: {finish: number, budgetPaise: number, multiplier: number}[]}}
 */
export function deadlineModel(state, playerId) {
  const snapshot = state.budgetSchedule?.rankSnapshotRound ?? 8;
  const played = state.history.length;
  const rank = rankOf(state, playerId);
  const taken = rank !== null || played >= snapshot;
  const counted = state.history.filter((h) => h.round <= snapshot)
    .reduce((a, h) => a + (h.byAdvertiser[playerId]?.money?.grossProfitPaise ?? 0), 0);
  return {
    snapshot,
    taken,
    countedPaise: taken ? null : counted,
    through: Math.min(played, snapshot),
    weeksLeft: Math.max(0, snapshot - played),
    rank,
    ladder: RANK_BUDGET_MULTIPLIERS.map((multiplier, i) => ({
      finish: i + 1, multiplier, budgetPaise: Math.round(MONTHLY_BUDGET_PAISE * multiplier),
    })),
  };
}
