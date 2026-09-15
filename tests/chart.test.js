import { describe, test, expect } from 'vitest';
import { seriesFor, CHART_METRICS, marketOutlook, insightMovers, marketChange } from '../ui/chart.js';
import { FORBIDDEN_IN_PUBLIC_VIEW } from '../engine/insights.js';

/**
 * The competitor trend chart's data shaping, tested without a DOM.
 *
 * WHAT THIS CHART MAY PLOT, AND WHY THAT IS THE WHOLE TEST
 *
 * R3 forbids reading another advertiser's bid, budget, cost, quality,
 * conversions, margin or position. Auction Insights (16) is the entire legal
 * surface, and it carries exactly Google's six Search metrics — so those six
 * are what this chart draws and there is nothing else it could draw.
 *
 * Three of them are per-advertiser and can be plotted for all nine. Three are
 * pairwise and exist only as "you against them", so they yield eight lines and
 * never a line for yourself.
 */

const PLAYER = 'vella';
const NAMES = new Map([
  ['vella', 'Vella & Co.'], ['kestrel', 'Kestrel'], ['marlow', 'Marlow'],
]);

/** One round of what `playRound` returns as `insights`. */
const round = (over = {}) => ({
  [PLAYER]: {
    self: { impressionShare: 0.8, topOfPageRate: 0.5, absTopOfPageRate: 0.2 },
    rivals: {
      kestrel: {
        overlapRate: 0.4, positionAboveRate: 0.3, outrankingShare: 0.7,
        impressionShare: 0.6, topOfPageRate: 0.4, absTopOfPageRate: 0.1,
      },
      marlow: {
        overlapRate: 0.2, positionAboveRate: 0.9, outrankingShare: 0.1,
        impressionShare: 0.3, topOfPageRate: 0.2, absTopOfPageRate: 0.05,
      },
    },
    ...over,
  },
});

describe('what the chart is allowed to plot', () => {
  test('every metric it offers is one of Auction Insights\' six', () => {
    // Not a list somebody typed: each key must be readable off an insights row,
    // which is the only per-rival data R3 permits.
    const row = round()[PLAYER];
    for (const metric of CHART_METRICS) {
      const source = metric.scope === 'each' ? row.self : row.rivals.kestrel;
      expect(source, metric.key).toHaveProperty(metric.key);
    }
    expect(CHART_METRICS).toHaveLength(6);
  });

  test('and none of them is something getPublicView withholds', () => {
    for (const metric of CHART_METRICS) {
      expect(FORBIDDEN_IN_PUBLIC_VIEW, metric.key).not.toContain(metric.key);
    }
  });
});

describe('seriesFor', () => {
  test('a per-advertiser metric plots you and every rival', () => {
    const series = seriesFor([round(), round()], PLAYER, 'impressionShare', NAMES);
    expect(series.map((s) => s.id).sort()).toEqual(['kestrel', 'marlow', 'vella']);
    expect(series.find((s) => s.id === PLAYER).isSelf).toBe(true);
    expect(series.find((s) => s.id === 'kestrel').name).toBe('Kestrel');
  });

  test('a pairwise metric plots rivals only, and never a line for yourself', () => {
    // "You against you" is not a quantity. `insightsFor` does not compute one
    // and a chart that drew a flat line for it would be inventing data.
    const series = seriesFor([round()], PLAYER, 'overlapRate', NAMES);
    expect(series.map((s) => s.id).sort()).toEqual(['kestrel', 'marlow']);
    expect(series.some((s) => s.isSelf)).toBe(false);
  });

  test('a point per played round, numbered from one', () => {
    const series = seriesFor([round(), round(), round()], PLAYER, 'impressionShare', NAMES);
    const mine = series.find((s) => s.isSelf);
    expect(mine.points).toEqual([
      { round: 1, value: 0.8 }, { round: 2, value: 0.8 }, { round: 3, value: 0.8 },
    ]);
  });

  test('a rival that goes inactive stops rather than dropping to zero', () => {
    // `insightsFor` builds its rows from the ACTIVE advertisers, so a rival
    // that goes dark simply stops appearing. Reading that as 0% would draw a
    // cliff that never happened.
    const gone = round();
    delete gone[PLAYER].rivals.marlow;
    const series = seriesFor([round(), gone], PLAYER, 'impressionShare', NAMES);

    const marlow = series.find((s) => s.id === 'marlow');
    expect(marlow.points).toEqual([{ round: 1, value: 0.3 }]);
    expect(series.find((s) => s.id === 'kestrel').points).toHaveLength(2);
  });

  test('an unplayed game plots nothing rather than throwing', () => {
    expect(seriesFor([], PLAYER, 'impressionShare', NAMES)).toEqual([]);
    expect(seriesFor(undefined, PLAYER, 'overlapRate', NAMES)).toEqual([]);
  });

  test('an id with no name falls back to the id rather than to undefined', () => {
    const series = seriesFor([round()], PLAYER, 'impressionShare', new Map());
    expect(series.every((s) => typeof s.name === 'string' && s.name.length > 0)).toBe(true);
  });

  test('an unknown metric is refused rather than plotting a blank chart', () => {
    expect(() => seriesFor([round()], PLAYER, 'costPaise', NAMES)).toThrow(/costPaise/);
  });
});

describe('the chart reads the market back to you (I13)', () => {
  // Asked for after playing: "I still don't get the rationale behind the graph".
  // The card explained what each metric IS and warned what it is NOT, and never
  // said what to DO with it — so a player had to supply the reading themselves,
  // which is the skill the chart exists to teach rather than to assume.
  //
  // Everything here comes from `insightsFor(...).self` and the six legal rival
  // metrics. No profit, no spend, no conversions: R3 holds, and the diagnosis
  // is made ENTIRELY from what a real advertiser could see.
  const week = (self, rivals = {}) => ({ me: { self, rivals } });
  const full = { impressionShare: 0.41, lostToRank: 0, lostToBudget: 0.59 };
  const names = new Map([['kestrel', 'Kestrel'], ['lumen', 'Lumen']]);

  test('losing to budget and not to rank is named as a budget problem', () => {
    // The reading that matters, and the one a player gets backwards. Nobody is
    // outranking you; you stop turning up because the money runs out.
    const out = marketOutlook([week(full)], 'me', names);
    expect(out.constraint).toBe('budget');
  });

  test('losing to rank and not to budget is named as a rank problem', () => {
    const out = marketOutlook([week({
      impressionShare: 0.3, lostToRank: 0.68, lostToBudget: 0.02,
    })], 'me', names);
    expect(out.constraint).toBe('rank');
  });

  test('appearing in nearly everything is neither', () => {
    // F12's trap: 100% impression share is not winning, and the advice must not
    // be "buy more of what you already have all of".
    const out = marketOutlook([week({
      impressionShare: 0.97, lostToRank: 0.02, lostToBudget: 0.01,
    })], 'me', names);
    expect(out.constraint).toBe('saturated');
  });

  test('losing to both says so rather than picking one', () => {
    const out = marketOutlook([week({
      impressionShare: 0.4, lostToRank: 0.3, lostToBudget: 0.3,
    })], 'me', names);
    expect(out.constraint).toBe('both');
  });

  test('it says which way you moved since last week', () => {
    // "Analyse the steps taken" — the chart plots the trend, and this reads it.
    const out = marketOutlook([
      week({ impressionShare: 0.30, lostToRank: 0, lostToBudget: 0.7 }),
      week({ impressionShare: 0.41, lostToRank: 0, lostToBudget: 0.59 }),
    ], 'me', names);
    expect(out.change).toBeCloseTo(0.11, 5);
  });

  test('and says nothing about movement after a single week', () => {
    expect(marketOutlook([week(full)], 'me', names).change).toBeNull();
  });

  test('it names who you actually meet, and who actually beats you', () => {
    // Two different rivals and two different problems. The one you overlap with
    // most is who you are competing against; the one above you in the most of
    // your auctions is who is winning the auctions you share.
    const out = marketOutlook([week(full, {
      kestrel: { overlapRate: 0.9, positionAboveRate: 0.1 },
      lumen: { overlapRate: 0.2, positionAboveRate: 0.8 },
    })], 'me', names);
    expect(out.meetMost.name).toBe('Kestrel');
    expect(out.aboveYouMost.name).toBe('Lumen');
  });

  // Found drawing the Market area: ranked by "above you when you meet" alone,
  // it named Halcyon, above the player 74% of the time in the 2% of its
  // auctions Halcyon was in, over Kestrel, in 96% of them and above in 70%.
  test('the rival above you is the one above you in the most of your auctions, not one you hardly meet', () => {
    const out = marketOutlook([week(full, {
      kestrel: { overlapRate: 0.96, positionAboveRate: 0.70 },
      halcyon: { overlapRate: 0.02, positionAboveRate: 0.74 },
    })], 'me', new Map([['kestrel', 'Kestrel'], ['halcyon', 'Halcyon']]));
    expect(out.aboveYouMost.name).toBe('Kestrel');
    // A share of every auction you showed in: how often you meet, times how
    // often it is above you when you do.
    expect(out.aboveYouMost.rate).toBeCloseTo(0.96 * 0.70, 12);
    expect(out).not.toHaveProperty('beatsYouMost');
  });

  test('with no rivals in the report it reports none rather than inventing one', () => {
    const out = marketOutlook([week(full)], 'me', names);
    expect(out.meetMost).toBeNull();
    expect(out.aboveYouMost).toBeNull();
  });

  test('an unplayed game yields nothing', () => {
    expect(marketOutlook([], 'me', names)).toBeNull();
  });

  test('a withheld field handed to it never reaches the output', () => {
    // Behavioural rather than a source scan: `positionAboveRate` legally
    // contains the substring "position", so grepping the file would fail on a
    // metric Auction Insights actually publishes. Poison the input instead and
    // check nothing leaks.
    const poison = Object.fromEntries(FORBIDDEN_IN_PUBLIC_VIEW.map((f) => [f, 999999]));
    const out = marketOutlook([week(
      { ...full, ...poison },
      { kestrel: { overlapRate: 0.5, positionAboveRate: 0.5, ...poison } },
    )], 'me', names);

    const seen = JSON.stringify(out);
    expect(seen).not.toContain('999999');
    for (const field of FORBIDDEN_IN_PUBLIC_VIEW) {
      expect(Object.keys(out), field).not.toContain(field);
      expect(Object.keys(out.meetMost), field).not.toContain(field);
    }
  });
});

describe('the week the market re-splits (D12, C8)', () => {
  // After C8's fix, rivals carry their second allocation through month 2 and
  // fall back to rank-based budgets at week 9: the whole market spends a median
  // 26% less that week, and rivals move 2.40 times an ordinary week in the
  // player's Auction Insights. These read both from public figures only.
  const week = (overlaps) => ({ me: { self: {}, rivals: Object.fromEntries(Object.entries(overlaps).map(([id, o]) => [id, { overlapRate: o }])) } });
  const names = new Map([['a', 'Aster'], ['b', 'Birch'], ['c', 'Cedar'], ['d', 'Dune']]);

  test('the rivals whose overlap moved most, largest first, and only real moves', () => {
    const insights = [week({ a: 0.28, b: 0.30, c: 0.50, d: 0.10 }), week({ a: 0.49, b: 0.12, c: 0.52, d: 0.16 })];
    expect(insightMovers(insights, 'me', names)).toEqual([
      { id: 'a', name: 'Aster', from: 0.28, to: 0.49 },
      { id: 'b', name: 'Birch', from: 0.30, to: 0.12 },
      { id: 'd', name: 'Dune', from: 0.10, to: 0.16 },
    ]);
  });

  test('never more than three, and nothing when nobody moved', () => {
    const many = [week({ a: 0, b: 0, c: 0, d: 0 }), week({ a: 0.4, b: 0.3, c: 0.2, d: 0.1 })];
    expect(insightMovers(many, 'me', names).map((m) => m.id)).toEqual(['a', 'b', 'c']);
    const still = [week({ a: 0.3, b: 0.3 }), week({ a: 0.32, b: 0.29 })];
    expect(insightMovers(still, 'me', names)).toEqual([]);
    expect(insightMovers([week({ a: 0.3 })], 'me', names)).toEqual([]);
  });

  test('total market spend, this week against last', () => {
    expect(marketChange([{ totalMarketSpendPaise: 100 }, { totalMarketSpendPaise: 74 }]))
      .toEqual({ thisWeekPaise: 74, lastWeekPaise: 100 });
    expect(marketChange([{ totalMarketSpendPaise: 100 }])).toBeNull();
    expect(marketChange([])).toBeNull();
  });
});
