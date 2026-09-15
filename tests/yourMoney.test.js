/**
 * What the Studio's Your money shows, read without a page
 * (design/your-money/, chosen by the owner 2026-09-15: this month as one bar,
 * bidding and what week 8 decides beside it, and at week 5 the capital and the
 * one chance to move on top).
 */

import { describe, test, expect } from 'vitest';
import { getSelfView } from '../engine/insights.js';
import { allCells, parseCell, isOneStep, cellKey } from '../engine/positions.js';
import {
  CAPEX_ALLOCATION_PAISE, CAPEX_DELAY_ROUNDS, REPOSITION_COST_PAISE, REPOSITION_ROUND,
  MONTHLY_BUDGET_PAISE, RANK_BUDGET_MULTIPLIERS,
} from '../engine/constants.js';
import { briefing } from '../setup.js';
import { QUERY_SET } from '../content/querySet.js';
import { makeGameState, PLAYER_ID } from './fixtures/gameState.js';
import {
  createDraft, setCapex, setPosition, setStrategy, setStrategyParam, monthBudgetAfter,
  weekBudgetsAtRun, bidOutlook, willTriggerLearning,
} from '../ui/decisions.js';
import {
  monthModel, moveLine, capitalModel, positionModel, biddingModel, deadlineModel, TARGET_RANGE,
} from '../ui/money/read.js';

const draftAt = (round) => {
  const state = makeGameState({ round });
  return createDraft(getSelfView(state, PLAYER_ID), { allocationRounds: state.budgetSchedule.capexAllocationRounds });
};
const total = (xs) => xs.reduce((a, b) => a + b, 0);

describe('the month, one bar', () => {
  test('at week 5 it is the month plus the capital left for ads, spread as the engine will spread it', () => {
    const draft = draftAt(REPOSITION_ROUND);
    const month = monthModel(draft, {});
    expect(month.totalPaise).toBe(monthBudgetAfter(draft));
    expect(month.totalPaise).toBe(MONTHLY_BUDGET_PAISE + CAPEX_ALLOCATION_PAISE);
    expect(month.weeks.map((w) => w.amountPaise)).toEqual(weekBudgetsAtRun(draft));
    expect(month.weeks.map((w) => [w.week, w.state])).toEqual([[5, 'next'], [6, 'planned'], [7, 'planned'], [8, 'planned']]);
    expect(month.unplannedPaise).toBe(0);
  });

  test('capital committed, or a move, takes its money out of the month', () => {
    const draft = draftAt(REPOSITION_ROUND);
    setCapex(draft, 'sizeGuide', 5500000);
    const to = allCells().map(parseCell).find((c) => isOneStep(draft.base.position, c));
    setPosition(draft, cellKey(to.price, to.purpose));
    const month = monthModel(draft, {});
    expect(month.totalPaise).toBe(MONTHLY_BUDGET_PAISE + CAPEX_ALLOCATION_PAISE - 5500000 - REPOSITION_COST_PAISE);
    expect(total(month.weeks.map((w) => w.amountPaise))).toBe(month.totalPaise);
  });

  test('a week that has run shows what it spent, and the money it left unplanned is its own piece', () => {
    const draft = draftAt(6);
    const month = monthModel(draft, { 0: 3000000 });
    expect(month.weeks[0]).toMatchObject({ week: 5, state: 'spent', amountPaise: 3000000 });
    expect(month.weeks[1]).toMatchObject({ week: 6, state: 'next' });
    // The fixture's month is split evenly and nothing is spent in the draft's
    // own count, so what week 5 did not spend is not planned for anything.
    const planned = total(month.weeks.slice(1).map((w) => w.amountPaise));
    expect(month.unplannedPaise).toBe(Math.max(0, month.totalPaise - draft.monthSpentPaise - planned));
  });

  // Found by playing: two weeks each spent a few paise under ₹72,000, and the
  // bar drew a piece saying "not planned ₹0" and warned that ₹0 would be lost.
  test('less than a rupee left over, or planned over, is nothing', () => {
    const draft = draftAt(6);
    const planned = total(weekBudgetsAtRun(draft).slice(1));
    draft.monthSpentPaise = monthBudgetAfter(draft) - planned - 40;
    expect(monthModel(draft, {}).unplannedPaise).toBe(0);
    draft.monthSpentPaise = monthBudgetAfter(draft) - planned + 40;
    expect(monthModel(draft, {}).overPaise).toBe(0);
    draft.monthSpentPaise = monthBudgetAfter(draft) - planned - 100;
    expect(monthModel(draft, {}).unplannedPaise).toBe(100);
  });
});

describe('dragging a line between two weeks', () => {
  test('moves money between those two weeks and no others, and the month adds up the same', () => {
    const draft = draftAt(6);
    const before = weekBudgetsAtRun(draft);
    moveLine(draft, monthModel(draft, {}), 1, before[1] + 1000000);
    const after = weekBudgetsAtRun(draft);
    expect(after[1]).toBe(before[1] + 1000000);
    expect(after[2]).toBe(before[2] - 1000000);
    expect(after[3]).toBe(before[3]);
    expect(total(after)).toBe(total(before));
  });

  test('at week 5 the weeks get what the bar showed, once the capital settles', () => {
    const draft = draftAt(REPOSITION_ROUND);
    const shown = weekBudgetsAtRun(draft);
    moveLine(draft, monthModel(draft, {}), 0, shown[0] + 1500000);
    const after = weekBudgetsAtRun(draft);
    expect(Math.abs(after[0] - (shown[0] + 1500000))).toBeLessThan(100);
    expect(Math.abs(after[1] - (shown[1] - 1500000))).toBeLessThan(100);
    expect(total(after)).toBe(monthBudgetAfter(draft));
  });

  test('a line cannot give a week more than the two weeks hold between them', () => {
    const draft = draftAt(6);
    const before = weekBudgetsAtRun(draft);
    moveLine(draft, monthModel(draft, {}), 1, before[1] + before[2] + 5000000);
    const after = weekBudgetsAtRun(draft);
    expect(after[1]).toBe(before[1] + before[2]);
    expect(after[2]).toBe(0);
  });

  test('the last line draws on the unplanned money, and never past it', () => {
    const draft = draftAt(6);
    const month = monthModel(draft, { 0: 3000000 });
    const last = month.weeks.length - 1;
    const before = weekBudgetsAtRun(draft)[last];
    moveLine(draft, month, last, before + month.unplannedPaise + 9900000);
    expect(weekBudgetsAtRun(draft)[last]).toBe(before + month.unplannedPaise);
  });
});

describe('this week only: capital', () => {
  test('a rung it cannot afford is shown and cannot be chosen', () => {
    const draft = draftAt(REPOSITION_ROUND);
    setCapex(draft, 'landingPage', 8000000);
    const photo = capitalModel(draft).targets.find((t) => t.key === 'photography');
    expect(photo.chips.every((c) => !c.affordable || c.amountPaise <= CAPEX_ALLOCATION_PAISE - 8000000)).toBe(true);
    expect(photo.chips.some((c) => !c.affordable)).toBe(true);
  });

  test('what goes to the business and what joins the month add up to the allocation', () => {
    const draft = draftAt(REPOSITION_ROUND);
    setCapex(draft, 'sizeGuide', 2500000);
    const capital = capitalModel(draft);
    expect(capital.committedPaise + capital.joinsPaise).toBe(CAPEX_ALLOCATION_PAISE);
    expect(capital.liveWeek).toBe(REPOSITION_ROUND + CAPEX_DELAY_ROUNDS);
    expect(capital.targets.find((t) => t.key === 'sizeGuide').chips.find((c) => c.chosen).amountPaise).toBe(2500000);
  });
});

describe('this week only: the one step', () => {
  test('six cells, where you are, and only one step away can be chosen', () => {
    const draft = draftAt(REPOSITION_ROUND);
    const cells = positionModel(draft, briefing(QUERY_SET)).cells;
    expect(cells).toHaveLength(6);
    const here = cells.filter((c) => c.here);
    expect(here).toHaveLength(1);
    for (const c of cells) {
      expect(c.reachable, c.key).toBe(c.here || isOneStep(draft.base.position, parseCell(c.key)));
    }
  });
});

describe('bidding', () => {
  test('the bid it shows is the engine\'s own reading of the draft', () => {
    const draft = draftAt(6);
    setStrategy(draft, 'targetCpa');
    setStrategyParam(draft, 30000);
    const bidding = biddingModel(draft);
    expect(bidding.outlook).toEqual(bidOutlook(draft));
    expect(bidding.target).toMatchObject({ kind: 'targetCpa', value: 30000, ...TARGET_RANGE.targetCpa });
    expect(bidding.learning).toBe(willTriggerLearning(draft) ? 'predicts' : null);
  });

  test('a strategy that never predicts costs nothing to learn, and says so', () => {
    const draft = draftAt(6);
    setStrategy(draft, 'maxClicks');
    expect(biddingModel(draft).learning).toBe(willTriggerLearning(draft) ? 'free' : null);
    expect(biddingModel(draft).target).toBeNull();
  });

  test('a slider holds the whole range the form ever needs', () => {
    expect(TARGET_RANGE.targetCpa.min).toBeGreaterThan(0);
    expect(TARGET_RANGE.targetRoas.min).toBeGreaterThan(0);
    expect(TARGET_RANGE.targetCpa.max).toBeGreaterThan(TARGET_RANGE.targetCpa.min);
  });
});

describe('what week 8 decides', () => {
  const week = (round, grossProfitPaise) => ({ round, byAdvertiser: { [PLAYER_ID]: { money: { grossProfitPaise } } } });
  const schedule = (ranked = null) => ({ rankSnapshotRound: 8, rankedAtSnapshot: ranked });

  test('before it, what is counted so far and how many weeks are left', () => {
    const state = { history: [week(1, 100000), week(2, 250000), week(3, -50000)], budgetSchedule: schedule() };
    const model = deadlineModel(state, PLAYER_ID);
    expect(model).toMatchObject({ taken: false, countedPaise: 300000, through: 3, weeksLeft: 5, snapshot: 8 });
    expect(model.ladder.map((l) => l.budgetPaise)).toEqual(RANK_BUDGET_MULTIPLIERS.map((m) => Math.round(MONTHLY_BUDGET_PAISE * m)));
  });

  test('after it, the rank and nothing re-added: history keeps being revised, and the ranking was taken then', () => {
    const ranked = ['a', 'b', PLAYER_ID, 'c'];
    const state = { history: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((r) => week(r, 100000)), budgetSchedule: schedule(ranked) };
    const model = deadlineModel(state, PLAYER_ID);
    expect(model.taken).toBe(true);
    expect(model.rank).toEqual({ position: 3, of: 4 });
    expect(model.countedPaise).toBeNull();
  });
});
