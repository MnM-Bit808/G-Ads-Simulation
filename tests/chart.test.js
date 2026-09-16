import { describe, test, expect } from 'vitest';
import { marketOutlook, insightMovers, marketChange } from '../ui/chart.js';
import { FORBIDDEN_IN_PUBLIC_VIEW } from '../engine/insights.js';

/**
 * What the market reading says, tested without a DOM.
 *
 * This file used to test the competitor trend chart's data shaping as well. The
 * switch-over's part 2 deleted that chart — the Studio's Market area shows each
 * rival as a card (ui/rivals/) — and R3 is guarded harder where the cards are
 * built: tests/rivals.test.js hands a card every field getPublicView withholds
 * and proves none of them reaches it.
 *
 * What is tested here is the reading itself, which is the part a player asked
 * for: whether they are losing to rank or to budget, who sits above them most,
 * and which weekly moves are real rather than wobble.
 */

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

  // Found drawing the Market area: judged on unrounded figures, a rival the
  // screen showed going from 45% to 40% (0.4498 to 0.402) had "not moved".
  test('a move is judged on the figures printed, five points of them', () => {
    expect(insightMovers([week({ a: 0.4498 }), week({ a: 0.402 })], 'me', names))
      .toEqual([{ id: 'a', name: 'Aster', from: 0.4498, to: 0.402 }]);
    expect(insightMovers([week({ a: 0.304 }), week({ a: 0.3449 })], 'me', names)).toEqual([]);
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
