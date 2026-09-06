/**
 * Where the searches happen (DECISIONS G4) — step 1: the numbers and the names.
 *
 * The engine does not read these yet. What is testable now is whether the tables
 * say what the design says, and every one of these assertions is a claim that
 * could be quietly broken later by someone tuning a number:
 *
 *   - the split SPLITS demand rather than adding any
 *   - premium skews to the metros and value away from them
 *   - and the tail is fat enough that the metros cannot hold the whole market
 *
 * The third is the one worth understanding. The metros are better per click by
 * construction, so if the tail were thin they would simply be a right answer and
 * a third of the market would be dead ground. What makes tier 2 and 3 worth
 * having is capacity, not quality: D8 measured this market as demand-limited, so
 * nine advertisers confined to the metros cannot all spend there and the money
 * has to overflow.
 */

import { describe, test, expect } from 'vitest';
import {
  LOCATION_TIERS, LOCATION_VOLUME_BY_PRICE, LOCATION_RETURN_MULTIPLIER,
  LOCATION_AOV_MULTIPLIER, PRICE_TIERS,
} from '../engine/constants.js';
import { LOCATIONS, location, locationsInOrder } from '../content/locations.js';
import { QUERY_SET } from '../content/querySet.js';
import { homeCell } from '../engine/querySet.js';

describe('the tables split demand rather than inventing it', () => {
  test('every price tier has a row, and every row covers every location', () => {
    expect(Object.keys(LOCATION_VOLUME_BY_PRICE).sort()).toEqual([...PRICE_TIERS].sort());
    for (const price of PRICE_TIERS) {
      expect(LOCATION_VOLUME_BY_PRICE[price], price).toHaveLength(LOCATION_TIERS.length);
    }
  });

  test('each row sums to exactly one', () => {
    // The whole claim of the mechanic: geography says WHERE the searchers
    // already counted are. A row summing to 1.1 would quietly add 10% demand to
    // that price tier and break the volume balance F9 engineered.
    for (const price of PRICE_TIERS) {
      const total = LOCATION_VOLUME_BY_PRICE[price].reduce((a, b) => a + b, 0);
      expect(total, `${price} sums to ${total}`).toBeCloseTo(1, 10);
    }
  });

  test('no share is zero, so no position is locked out of anywhere', () => {
    // A zero would make a location unreachable for that price tier rather than
    // merely poor, and targeting it would be a bug with no error.
    for (const price of PRICE_TIERS) {
      for (const share of LOCATION_VOLUME_BY_PRICE[price]) {
        expect(share, price).toBeGreaterThan(0);
      }
    }
  });
});

describe('the correlation the mechanic rests on', () => {
  test('premium skews to the metros, value away from them', () => {
    const metro = (price) => LOCATION_VOLUME_BY_PRICE[price][0];
    expect(metro('premium')).toBeGreaterThan(metro('mid'));
    expect(metro('mid')).toBeGreaterThan(metro('value'));
  });

  test('and the reverse holds in the smallest towns', () => {
    const towns = (price) => LOCATION_VOLUME_BY_PRICE[price][2];
    expect(towns('value')).toBeGreaterThan(towns('mid'));
    expect(towns('mid')).toBeGreaterThan(towns('premium'));
  });

  test('returns rise as the cities get smaller, and baskets shrink', () => {
    // Both monotonic, because the design is a gradient rather than a metro/
    // non-metro binary. If either ever inverted, tier 2 would become strictly
    // better than tier 1 on that axis and the gradient would stop teaching.
    for (let i = 1; i < LOCATION_TIERS.length; i++) {
      expect(LOCATION_RETURN_MULTIPLIER[i], `returns at ${i}`)
        .toBeGreaterThan(LOCATION_RETURN_MULTIPLIER[i - 1]);
      expect(LOCATION_AOV_MULTIPLIER[i], `basket at ${i}`)
        .toBeLessThan(LOCATION_AOV_MULTIPLIER[i - 1]);
    }
  });

  test('the metros are the baseline for returns, not a discount', () => {
    // 1.0 there means `business.returnRate` still means what F8 says it means.
    expect(LOCATION_RETURN_MULTIPLIER[0]).toBe(1);
  });
});

describe('the tail is fat enough to hold the overflow', () => {
  /**
   * Weighted by how much of the market each price tier actually carries.
   *
   * MEASURED OFF THE QUERY SET rather than restated from a constant. F9's
   * 52/28/20 is not a number in `constants.js` at all - it is a property of how
   * the 151 rows were authored, so the only honest weight is the one the set
   * really has. If somebody re-authors the set, this test follows it.
   */
  const overallShares = () => {
    const weight = Object.fromEntries(PRICE_TIERS.map((price) => [price, 0]));
    for (const query of QUERY_SET.queries) {
      const cell = homeCell(query);
      if (!cell) continue;
      weight[cell.split('|')[0]] += query.volumeShareBp;
    }
    const total = Object.values(weight).reduce((a, b) => a + b, 0);
    return LOCATION_TIERS.map((_, tier) => PRICE_TIERS
      .reduce((sum, price) => sum
        + (weight[price] / total) * LOCATION_VOLUME_BY_PRICE[price][tier], 0));
  };

  test('the country is not a metro market with two afterthoughts', () => {
    // The failure this guards: a thin tail makes the metros a right answer,
    // because they are better per click by construction. Two thirds of the
    // market outside them is what forces the overflow that makes them contested.
    const [metros, , towns] = overallShares();
    expect(metros, `metros hold ${(100 * metros).toFixed(0)}%`).toBeLessThan(0.4);
    expect(towns, `towns hold ${(100 * towns).toFixed(0)}%`).toBeGreaterThan(0.25);
  });

  test('and it is near enough to level that no tier is a rounding error', () => {
    const shares = overallShares();
    const spread = Math.max(...shares) / Math.min(...shares);
    expect(spread, `spread ${spread.toFixed(2)}x`).toBeLessThan(1.3);
  });

  test('the overall shares still sum to one', () => {
    expect(overallShares().reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });
});

describe('what a player reads', () => {
  test('every engine tier has content, and nothing has content it lacks', () => {
    expect(LOCATIONS.map((l) => l.id)).toEqual([...LOCATION_TIERS]);
  });

  test('each tier names real places, because "tier 2" names nothing', () => {
    for (const tier of LOCATIONS) {
      expect(tier.examples.length, tier.id).toBeGreaterThanOrEqual(4);
      expect(tier.label, tier.id).toBeTruthy();
      expect(tier.note, tier.id).toBeTruthy();
    }
  });

  test('no city is listed under two tiers', () => {
    const all = LOCATIONS.flatMap((tier) => tier.examples);
    expect(new Set(all).size, 'a city in two tiers').toBe(all.length);
  });

  test('the smallest towns are where the returns warning is stated', () => {
    // 17.2 decides what a founder could have researched, and an Indian D2C
    // founder knows COD comes back. This is the sentence the briefing quotes, so
    // if it stops mentioning returns the briefing silently stops warning.
    expect(location('tier3').note.toLowerCase()).toMatch(/return/);
  });

  test('an unknown tier throws rather than quietly returning the metros', () => {
    expect(() => location('tier4')).toThrow(RangeError);
  });

  test('the ordered list is in engine order', () => {
    expect(locationsInOrder().map((l) => l.id)).toEqual([...LOCATION_TIERS]);
  });
});
