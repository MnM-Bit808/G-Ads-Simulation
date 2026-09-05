import { describe, test, expect } from 'vitest';
import { seriesFor, CHART_METRICS } from '../ui/chart.js';
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
