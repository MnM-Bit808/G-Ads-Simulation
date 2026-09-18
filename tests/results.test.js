/**
 * The Studio's Results area (design/results/, chosen by the owner 2026-09-15):
 * its readings, on small hand-built records where every figure is known.
 *
 * The debrief's own readings (moments, the replays, the budget weeks, the
 * lessons, the reveal's truth) are tested in debrief.test.js; these are what
 * the four sections add around them.
 */

import { describe, test, expect } from 'vitest';
import {
  seasonBars, seasonFigures, firstReportsTotal, lateSales, capitalReading, booksRows, finishing,
  revealReading, meetMostOverGame,
} from '../ui/results/read.js';
import { SETTLES_AFTER_ROUNDS, RETURNS_RESOLVE_AFTER_ROUNDS } from '../ui/dashboard.js';
import {
  TOTAL_ROUNDS, MONTHLY_BUDGET_PAISE, CAPEX_ALLOCATION_PAISE, CAPEX_DELAY_ROUNDS, POSITION_ECONOMICS,
} from '../engine/constants.js';

const P = 'player';

/** One week's report for the player, with what the readings use. */
function week(round, {
  net = 1000, firstGross = net, gross = net, costPaise = 50_000, clicks = 100, stillPending = 0,
  impressionShare = 0.5, lostToBudget = 0.5, lostToRank = 0,
} = {}) {
  return {
    round,
    byAdvertiser: {
      [P]: {
        traffic: { impressions: clicks * 10, clicks, costPaise },
        share: { impressionShare, lostToBudget, lostToRank },
        conversions: { final: 5, stillPending, returned: 2 },
        money: {
          grossRevenuePaise: 300_000, netRevenuePaise: 200_000,
          grossProfitPaise: gross, netProfitPaise: net, grossProfitAsFirstReportedPaise: firstGross,
        },
      },
    },
  };
}

describe('which weeks are settled', () => {
  test('a click is final five rounds after its week, which is what the books run on', () => {
    // Three rounds to arrive, two for the return. At the whistle that left weeks
    // 8 to 12 unfinished; the books now settle them (tests/settling.test.js), so
    // this figure is the tail's length rather than a warning's threshold.
    expect(SETTLES_AFTER_ROUNDS).toBe(5);
    expect(TOTAL_ROUNDS - SETTLES_AFTER_ROUNDS).toBe(7);
  });
});

describe('every week of the game, for the chart', () => {
  const opening = { negatives: [], keywords: [{ id: 'k1', text: 'gym leggings', matchType: 'phrase', bidPaise: 3000 }] };
  const log = [
    { round: 2, advertiserId: P, decision: { adGroups: [{ keywords: [{ id: 'k1', text: 'gym leggings', matchType: 'phrase', bidPaise: 2500 }] }] } },
    { round: 3, advertiserId: P, decision: { capex: {} } },
  ];
  const history = [week(1, { net: 88_508_49, firstGross: 88_508_49 }), week(2, { net: 38_941_00, firstGross: 32_940_40 }),
    week(3, { net: 7_008_00, firstGross: 7_008_00 })];
  const bars = seasonBars(history, P, { decisionLog: log, opening });

  test('each week stands against its first report, which counts no returns yet', () => {
    expect(bars.map((b) => b.netPaise)).toEqual([88_508_49, 38_941_00, 7_008_00]);
    expect(bars.map((b) => b.beforePaise)).toEqual([88_508_49, 32_940_40, 7_008_00]);
  });

  test('the change is the difference of the figures as shown, in whole rupees', () => {
    // ₹38,941 and ₹32,940 are ₹6,001 apart on screen, though ₹6,000.60 in paise.
    expect(bars[1].changePaise).toBe(6_001_00);
    expect(bars[0].changePaise).toBe(0);
  });

  test('a week the player changed something is marked, and an untouched capital card is not', () => {
    expect(bars.map((b) => b.changed)).toEqual([false, true, false]);
    expect(bars[1].did).toEqual(['“gym leggings” bid ₹30 → ₹25']);
    expect(bars[2].did).toEqual([]);
  });

  test('the first reports add up to what the weeks read when they came out', () => {
    expect(firstReportsTotal(bars)).toBe(88_508_49 + 32_940_40 + 7_008_00);
  });
});

describe('what was still in flight at the whistle', () => {
  test('a return comes back as long after its sale as the engine says, at every price level', () => {
    // The books settle the tail with this window (ui/ending.js, settledHistory),
    // and the view may not read the economics it comes from (tests/ui.test.js),
    // so it is derived where the lag is (ui/dashboard.js). If a cell ever wants
    // its own window, this test is what says the books can no longer assume one.
    for (const [price, economics] of Object.entries(POSITION_ECONOMICS)) {
      expect(RETURNS_RESOLVE_AFTER_ROUNDS, price).toBe(economics.returnWindowRounds);
    }
  });

  test('the sales still queued when the last week ran, which the books then count', () => {
    const state = {
      advertisers: [
        { id: P, pendingConversions: [{ count: 3.8 }, { count: 15.7 }, { count: 34.1 }] },
        { id: 'torvi', pendingConversions: [{ count: 1 }] },
      ],
    };
    expect(lateSales(state, P)).toBeCloseTo(53.6, 6);
  });

  test('a game that ended with nothing on its way has none', () => {
    expect(lateSales({ advertisers: [{ id: P, pendingConversions: [] }] }, P)).toBe(0);
    expect(lateSales({ advertisers: [] }, P)).toBe(0);
  });
});

describe('the twelve weeks\' figures', () => {
  test('they are the end screen\'s own totals', () => {
    const f = seasonFigures([week(1, { net: 1000, costPaise: 400 }), week(2, { net: -300, costPaise: 600, stillPending: 1.5 })], P);
    // Net revenue ₹2,000 a week against ₹10 of clicks in all.
    expect(f).toMatchObject({ netProfitPaise: 700, costPaise: 1000, clicks: 200, stillPending: 1.5, netRoas: 400 });
  });
});

describe('where the capital went', () => {
  test('each commitment, the week it was made and the week it went live; the rest went into the ad budget', () => {
    const advertiser = {
      capex: {
        committed: { sizeGuide: 5_500_000, photography: 0 },
        pending: [{ target: 'sizeGuide', paise: 5_500_000, liveAtRound: 5 + CAPEX_DELAY_ROUNDS }],
      },
    };
    expect(capitalReading(advertiser, [1, 5])).toEqual({
      tranches: [{ target: 'sizeGuide', paise: 5_500_000, madeAt: 5, liveAtRound: 8 }],
      committedPaise: 5_500_000,
      toBudgetPaise: 2 * CAPEX_ALLOCATION_PAISE - 5_500_000,
    });
  });

  test('round 0\'s commitment is made at round 0, and goes live with the site work', () => {
    const advertiser = { capex: { committed: { orderConfirmation: 8_000_000 }, pending: [{ target: 'orderConfirmation', paise: 8_000_000, liveAtRound: 1 + CAPEX_DELAY_ROUNDS }] } };
    expect(capitalReading(advertiser, [1, 5]).tranches[0].madeAt).toBe(0);
  });

  test('nothing committed: both allocations went into the ad budget', () => {
    expect(capitalReading({ capex: { committed: {}, pending: [] } }, [1, 5]))
      .toEqual({ tranches: [], committedPaise: 0, toBudgetPaise: 2 * CAPEX_ALLOCATION_PAISE });
  });
});

describe('everyone\'s books', () => {
  // finalStandings reads the whole history; two brands, two weeks.
  const report = (round, rows) => ({ round, byAdvertiser: rows });
  const row = (gross, net, cost) => ({
    traffic: { impressions: 1000, clicks: 100, costPaise: cost },
    conversions: { final: 5, stillPending: 0, returned: 2 },
    money: { grossRevenuePaise: gross * 3, netRevenuePaise: net * 3, grossProfitPaise: gross, netProfitPaise: net, grossProfitAsFirstReportedPaise: gross },
  });
  const state = {
    advertisers: [
      { id: P, name: 'Vella & Co.', controller: 'player', position: { price: 'mid', purpose: 'performance' } },
      { id: 'torvi', name: 'Torvi', controller: 'policy', position: { price: 'premium', purpose: 'performance' } },
      { id: 'nira', name: 'Nira', controller: 'policy', position: { price: 'mid', purpose: 'lifestyle' } },
    ],
    history: [report(1, { [P]: row(40_000, 20_000, 10_000), torvi: row(20_000, -1_000, 30_000), nira: row(80_000, 50_000, 10_000) })],
  };

  test('ranked by what the business made, each bar a share of the largest gross profit, a loss drawing nothing', () => {
    const rows = booksRows(state);
    expect(rows.map((r) => r.id)).toEqual(['nira', P, 'torvi']);
    expect(rows.map((r) => r.grossShare)).toEqual([1, 0.5, 0.25]);
    expect(rows.map((r) => r.netShare)).toEqual([50_000 / 80_000, 20_000 / 80_000, 0]);
  });

  /**
   * CAPITAL IS COUNTED IN THE BOOKS (the owner, 2026-09-18). Net profit charges
   * clicks and freight and never the money spent on the business, so an
   * advertiser that built nothing and one that spent the whole ₹2,40,000 were
   * ranked alike — while the one that built nothing had its capital turned into
   * ad budget and charged for the clicks it bought. The weekly report is an
   * advertising report and keeps its own meaning; the books are the scoreboard.
   */
  test('what each brand spent on its business comes off its profit, and the ranking follows', () => {
    const built = {
      ...state,
      advertisers: state.advertisers.map((a) => (a.id !== 'nira' ? a : {
        ...a, capex: { committed: { landingPage: 8_000_000, sizeGuide: 2_500_000 }, pending: [] },
      })),
    };
    const rows = booksRows(built);
    const nira = rows.find((r) => r.id === 'nira');
    expect(nira.capitalPaise).toBe(10_500_000);
    expect(nira.businessProfitPaise).toBe(50_000 - 10_500_000);
    // Its net profit is the biggest and its business is the worst: ₹1,05,000
    // of building against ₹500 of profit.
    expect(nira.netProfitPaise).toBe(50_000);
    expect(rows.map((r) => r.id)).toEqual([P, 'torvi', 'nira']);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  test('a brand that built nothing has nothing taken off', () => {
    const rows = booksRows(state);
    expect(rows.every((r) => r.capitalPaise === 0)).toBe(true);
    expect(rows.every((r) => r.businessProfitPaise === r.netProfitPaise)).toBe(true);
  });
});

describe('where the player finished', () => {
  test('three ranks, and month 3\'s budget against the middle place\'s', () => {
    const report = (round, rows) => ({ round, byAdvertiser: rows });
    const row = (gross, net) => ({
      traffic: { impressions: 1, clicks: 1, costPaise: 1 },
      conversions: { final: 1, stillPending: 0, returned: 0 },
      money: { grossRevenuePaise: 1, netRevenuePaise: 1, grossProfitPaise: gross, netProfitPaise: net, grossProfitAsFirstReportedPaise: gross },
    });
    const state = {
      advertisers: [
        { id: P, name: 'Vella & Co.', controller: 'player', position: { price: 'mid', purpose: 'performance' }, campaign: { monthlyBudgetPaise: 17_976_000 } },
        { id: 'a', name: 'A', controller: 'policy', position: { price: 'mid', purpose: 'lifestyle' } },
        { id: 'b', name: 'B', controller: 'policy', position: { price: 'value', purpose: 'lifestyle' } },
      ],
      budgetSchedule: { rankedAtSnapshot: ['a', P, 'b'] },
      history: [report(1, { [P]: row(500, 100), a: row(900, 50), b: row(100, 200) })],
    };
    expect(finishing(state, P)).toEqual({
      week8: { position: 2, of: 3 },
      grossRank: 2,
      netRank: 2,
      of: 3,
      month3Paise: 17_976_000,
      middlePaise: MONTHLY_BUDGET_PAISE,
      firstPaise: Math.round(MONTHLY_BUDGET_PAISE * 1.3),
      lastPaise: Math.round(MONTHLY_BUDGET_PAISE * 0.7),
    });
  });
});

describe('where they sat, with round 0\'s notes', () => {
  const rival = (id, name, price, purpose) => ({
    id, name, domain: `${id}.in`, position: { price, purpose },
    adGroups: [{ ad: { headlines: [name], descriptions: [''] } }],
  });
  const initial = {
    advertisers: [
      rival(P, 'Vella & Co.', 'mid', 'performance'),
      rival('a', 'Auren', 'premium', 'lifestyle'),
      rival('h', 'Halcyon', 'premium', 'lifestyle'),
      rival('k', 'Kestrel', 'mid', 'lifestyle'),
      rival('m', 'Marlow', 'mid', 'performance'),
    ],
  };

  test('noted at round 0, those are the answers scored; the rest are placed at the end', () => {
    const read = revealReading(initial, P, {
      notes: { a: 'premium|lifestyle', h: 'value|performance' },
      guesses: { k: 'mid|performance' },
    });
    expect(read.rows.map((r) => [r.name, r.noted, r.result])).toEqual([
      ['Auren', true, 'exact'], ['Halcyon', true, 'wrong'], ['Kestrel', false, 'price'], ['Marlow', false, 'skipped'],
    ]);
    expect(read.then).toEqual({ exact: 1, half: 0, of: 2 });
    expect(read.now).toEqual({ exact: 0, half: 1, of: 2, placed: 1 });
    expect(read.cellmates).toEqual(['Marlow']);
  });

  test('a guess at the end cannot overwrite a round-0 note', () => {
    const read = revealReading(initial, P, { notes: { a: 'premium|lifestyle' }, guesses: { a: 'value|lifestyle' } });
    expect(read.rows.find((r) => r.id === 'a')).toMatchObject({ noted: true, result: 'exact' });
  });

  test('without notes, as a save written before them, every guess is the end\'s', () => {
    const read = revealReading(initial, P, { notes: null, guesses: { a: 'premium|lifestyle', k: 'value|lifestyle' } });
    expect(read.then).toBeNull();
    expect(read.all).toEqual({ exact: 1, half: 1, of: 4 });
    expect(read.rows.every((r) => !r.noted)).toBe(true);
  });
});

describe('the rival met most over the game', () => {
  test('averaged over the weeks, from the player\'s own Auction Insights', () => {
    const weekOf = (k, m) => ({ [P]: { rivals: { k: { overlapRate: k }, m: { overlapRate: m } } } });
    expect(meetMostOverGame([weekOf(0.9, 0.1), weekOf(0.8, 0.95)], P)).toEqual({ id: 'k', rate: (0.9 + 0.8) / 2 });
    expect(meetMostOverGame([], P)).toBeNull();
  });
});
