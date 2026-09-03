/**
 * The calibration invariants (spec 18.2).
 *
 * These govern the two CALIBRATE constants and the fairness of the grid. They
 * are slower than the rest of the suite because several play whole games.
 *
 * I3 CURRENTLY FAILS AND IS NOT ASSERTED AS PASSING.
 *
 * Measured for the first time here: six identical advertisers, one per cell,
 * playing twelve rounds, produce a 4.20x spread in cumulative net profit
 * against a 15% target. Mid-market wins and Value comes last, which is the
 * reverse of the design's intent — Mid was meant to be the squeezed position
 * with no territory of its own.
 *
 * Writing an assertion that passes at 76% would be dressing a failure as a
 * result. Instead the measurement runs, prints, and pins the current figure so
 * a change is visible; the 15% target is a `todo` naming work not yet done.
 */

import { describe, test, expect } from 'vitest';
import { runRound } from '../engine/round.js';
import { makeGameState } from './fixtures/gameState.js';
import { homeCell } from '../engine/querySet.js';
import {
  allCells, parseCell, businessFor, breakEvenCpcPaise,
} from '../engine/positions.js';
import { allocate } from '../engine/money.js';
import { QUERY_SET } from '../content/querySet.js';
import {
  MONTHLY_BUDGET_PAISE, ROUNDS_PER_MONTH, TOTAL_ROUNDS, HOUR_PROFILES,
  HOURLY_INTENT_CURVE, MIN_PEAK_SEPARATION_HOURS, POSITION_ECONOMICS,
  PURPOSE_MODIFIERS, AD_RANK_FLOOR, WEEKLY_VOLUME, PROVENANCE,
} from '../engine/constants.js';

const CELLS = allCells();
const EMPTY = { committed: { sizeGuide: 0, photography: 0, landingPage: 0 }, pending: [] };
const argmax = (a) => a.indexOf(Math.max(...a));

/** Six advertisers, one per cell, identical in everything but position. */
function balancedState() {
  const base = makeGameState();
  const advertisers = CELLS.map((cell, i) => {
    const position = { ...parseCell(cell), setAtRound: 0, repositionedAtRound: null };
    const bidPaise = Math.round(breakEvenCpcPaise(businessFor(position, EMPTY, 1)) * 0.70);
    const own = QUERY_SET.queries.filter((q) => homeCell(q) === cell && q.isHeadTerm);

    return {
      ...base.advertisers[i],
      id: `cell_${i}`,
      name: cell,
      position,
      capex: EMPTY,
      campaign: {
        ...base.advertisers[i].campaign,
        monthlyBudgetPaise: MONTHLY_BUDGET_PAISE,
        monthSpentPaise: 0,
        weeklySplitPaise: allocate(MONTHLY_BUDGET_PAISE, new Array(ROUNDS_PER_MONTH).fill(1)),
        strategy: 'manual',
      },
      adGroups: [{
        ...base.advertisers[i].adGroups[0],
        keywords: own.slice(0, 4).map((q, k) => ({
          id: `kw_${k + 1}`, text: q.text,
          matchType: k === 0 ? 'exact' : k === 3 ? 'broad' : 'phrase',
          bidPaise, active: true, tags: [...q.tags], taggedContentHash: 'sha1:b',
        })),
        // The only difference between these six is which cell they sit in.
        gradedQuality: {
          expectedCtr: 6, adRelevance: 7, landingPage: 6,
          gradedAtRound: 0, contentHash: 'sha1:balanced',
        },
      }],
    };
  });
  return { ...base, advertisers };
}

/** Play a full game and return cumulative net profit per cell, settled rounds only. */
function playBalanced() {
  let s = balancedState();
  const rows = [];
  for (let r = 1; r <= TOTAL_ROUNDS; r++) {
    const out = runRound(s, { mode: 'expected' });
    rows.push(out.report);
    s = out.nextGameState;
  }
  // A click in round R settles at R + 3 lag + 2 return window, so by round 12
  // only rounds 1..7 are final.
  const settled = s.history.filter((h) => h.round <= 7);
  const profit = {};
  for (const a of s.advertisers) {
    profit[a.name] = settled.reduce(
      (acc, h) => acc + (h.byAdvertiser[a.id]?.money.netProfitPaise ?? 0), 0,
    );
  }
  return { profit, finalState: s };
}

describe('I1 — budget must bind', () => {
  test('an advertiser alone against passive rivals can exhaust its month', () => {
    // Scoped to ONE advertiser deliberately. The original wording asked that
    // all nine exhaust simultaneously, and the first live round showed the low
    // spenders were being outranked rather than starved of market. An
    // advertiser losing 39% of impressions to rank should spend less; testing
    // all nine measures competition, not market size.
    const state = makeGameState();
    const solo = {
      ...state,
      advertisers: state.advertisers.map((a, i) => (i === 0 ? {
        ...a,
        adGroups: [{
          ...a.adGroups[0],
          keywords: a.adGroups[0].keywords.map((k) => ({
            ...k, matchType: 'broad', bidPaise: k.bidPaise * 3,
          })),
        }],
      } : { ...a, active: false })),
    };

    let s = solo;
    let spent = 0;
    for (let r = 1; r <= ROUNDS_PER_MONTH; r++) {
      const out = runRound(s, { mode: 'expected' });
      spent += out.raw.byAdvertiser[state.advertisers[0].id].costPaise;
      s = out.nextGameState;
    }
    // It must be ABLE to spend a serious fraction of the month. If the market
    // cannot absorb the money, lostToBudget never fires, missedToBudget is
    // always zero, and the whole of section 13 does nothing.
    expect(spent / MONTHLY_BUDGET_PAISE).toBeGreaterThan(0.5);
  });

  test('WEEKLY_VOLUME is still marked provisional', () => {
    expect(PROVENANCE.WEEKLY_VOLUME).toBe('CALIBRATE');
    expect(WEEKLY_VOLUME).toBe(225000);
  });
});

describe('I2 — the market must be affordable', () => {
  test('median CPC sits below the Value tier net break-even', () => {
    // If it does not, the cheapest position is unplayable and the grid
    // collapses to two tiers.
    const state = makeGameState();
    const out = runRound(state, { mode: 'expected' });
    const valueBreakEven = breakEvenCpcPaise(
      businessFor({ price: 'value', purpose: 'performance' }, EMPTY, 1),
    );
    expect(out.raw.marketContext.medianCpcPaise).toBeLessThan(valueBreakEven);
  });

  test('every position pays less than it can afford, on average', () => {
    const state = makeGameState();
    const out = runRound(state, { mode: 'expected' });
    for (const a of state.advertisers) {
      const row = out.raw.byAdvertiser[a.id];
      if (row.clicks < 100) continue;
      const cpc = row.costPaise / row.clicks;
      const affordable = breakEvenCpcPaise(businessFor(a.position, a.capex, 1));
      expect(cpc, `${a.id} (${a.position.price})`).toBeLessThan(affordable);
    }
  });

  test('AD_RANK_FLOOR is still marked provisional', () => {
    expect(PROVENANCE.AD_RANK_FLOOR).toBe('CALIBRATE');
    expect(AD_RANK_FLOOR).toBe(60);
  });
});

describe('I3 — positions must balance', () => {
  const { profit } = playBalanced();
  const values = CELLS.map((c) => profit[c]);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const worstDeviation = Math.max(...values.map((v) => Math.abs(v - mean))) / Math.abs(mean);
  const spread = Math.max(...values) / Math.min(...values);

  test('the measurement runs and every cell turns a profit', () => {
    // The floor: a position that cannot make money at all is not a position.
    for (const cell of CELLS) {
      expect(profit[cell], cell).toBeGreaterThan(0);
    }
  });

  test('THE GRID IS NOT BALANCED — measured, pinned, not yet fixed', () => {
    // 4.20x spread, 76% worst deviation, against a 15% target. Mid-market
    // wins and Value comes last, which reverses the design's intent: Mid was
    // meant to be the squeezed position with no territory of its own.
    //
    // Pinned loosely so the number is visible in the suite and a change to it
    // shows up as a failure. This is NOT the invariant passing.
    expect(spread).toBeGreaterThan(3);
    expect(spread).toBeLessThan(6);
    expect(worstDeviation).toBeGreaterThan(0.5);
  });

  test('mid-market currently wins, which is the wrong way round', () => {
    const ranked = CELLS.slice().sort((a, b) => profit[b] - profit[a]);
    expect(ranked[0].startsWith('mid')).toBe(true);
    expect(ranked[ranked.length - 1].startsWith('value')).toBe(true);
  });

  test.todo('I3 passes: worst deviation from mean under 15% across N seeds');
  test.todo('I3 passes with each position playing its own best capex');
});

describe('I4 — the axes stay in their lanes', () => {
  const be = (price, purpose) => breakEvenCpcPaise(
    businessFor({ price, purpose }, EMPTY, 1),
  );

  test('purpose moves break-even under 15% within a price row', () => {
    for (const price of ['value', 'mid', 'premium']) {
      const a = be(price, 'performance');
      const b = be(price, 'lifestyle');
      expect(Math.abs(b - a) / Math.min(a, b), price).toBeLessThan(0.15);
    }
  });

  test('price moves it more than 2x top to bottom', () => {
    for (const purpose of ['performance', 'lifestyle']) {
      expect(be('premium', purpose) / be('value', purpose), purpose).toBeGreaterThan(2);
    }
  });

  test('and the constants behind it have not drifted', () => {
    expect(POSITION_ECONOMICS.value.convRateBase).toBeGreaterThan(
      POSITION_ECONOMICS.premium.convRateBase,
    );
    expect(PURPOSE_MODIFIERS.lifestyle.ret).toBeGreaterThan(PURPOSE_MODIFIERS.performance.ret);
  });
});

describe('I5 — demand peak and intent peak must not coincide', () => {
  test('the intent peak clears every volume peak by the stated margin', () => {
    // If they coincide, dayparting earns nothing and DECISIONS H4 is false.
    const intentPeak = argmax(HOURLY_INTENT_CURVE);
    for (const [name, curve] of Object.entries(HOUR_PROFILES)) {
      const raw = Math.abs(intentPeak - argmax(curve));
      const circular = Math.min(raw, 24 - raw);
      expect(circular, name).toBeGreaterThanOrEqual(MIN_PEAK_SEPARATION_HOURS);
    }
  });
});

describe('a full game holds together', () => {
  const { finalState } = playBalanced();

  test('twelve rounds complete and the state advances to thirteen', () => {
    expect(finalState.round).toBe(TOTAL_ROUNDS + 1);
    expect(finalState.history).toHaveLength(TOTAL_ROUNDS);
  });

  test('the month resets three times, so nobody goes dark for lack of a reset', () => {
    // The bug this test exists for: monthSpentPaise accumulated across the
    // whole game against one month's allowance, so an advertiser spending its
    // full weekly budget exhausted the month in four rounds and went dark for
    // the remaining eight. Only a full game exposes it.
    for (const a of finalState.advertisers) {
      expect(a.campaign.monthSpentPaise, a.id).toBeLessThanOrEqual(a.campaign.monthlyBudgetPaise);
    }
    const spentInLastRound = finalState.history[TOTAL_ROUNDS - 1];
    const anySpend = Object.values(spentInLastRound.byAdvertiser)
      .some((r) => r.traffic.costPaise > 0);
    expect(anySpend).toBe(true);
  });

  test('month 3 allocations are redistributed by rank, and the pool is unchanged', () => {
    const total = finalState.advertisers
      .reduce((a, x) => a + x.campaign.monthlyBudgetPaise, 0);
    expect(total).toBeCloseTo(finalState.advertisers.length * MONTHLY_BUDGET_PAISE, -3);
    const budgets = finalState.advertisers.map((a) => a.campaign.monthlyBudgetPaise);
    expect(new Set(budgets).size).toBeGreaterThan(1);
  });

  test('early rounds are settled and late ones are not', () => {
    const early = finalState.history.find((h) => h.round === 3);
    const late = finalState.history.find((h) => h.round === TOTAL_ROUNDS);
    const id = finalState.advertisers[0].id;
    expect(early.revisedAtRound).not.toBeNull();
    expect(late.byAdvertiser[id].conversions.stillPending).toBeGreaterThan(0);
  });
});
