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
import { CITY_POINTS, MAP_VIEWBOX, LABEL_SIDE, labelPlace } from '../ui/india-map.js';
import { QUERY_SET } from '../content/querySet.js';
import { homeCell } from '../engine/querySet.js';
import {
  locationIndex, locationIdAt, locationSharesFor, locationEffects, locationWeights,
  validateLocationTables, assertValidLocationTables, codShareFor, rtoShareOfReturns,
} from '../engine/locations.js';

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

describe('the metros are scarce, which is the trade', () => {
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

  test('the metros are the smallest market, not the biggest', () => {
    // THE FAILURE THIS GUARDS, and it was measured rather than imagined. An
    // earlier version split the country 34/35/31, near enough to level - and
    // that made the metros a RIGHT ANSWER, because they are the best place to be
    // by construction: targeting them was worth +70% to a value advertiser and
    // +52% to a mid one, while premium did best ignoring the control entirely.
    //
    // Scarcity is what turns that into a decision. A fifth of the country will
    // not absorb a month's budget, so an advertiser has to choose how much to
    // spend somewhere worse.
    const [metros, , towns] = overallShares();
    expect(metros, `metros hold ${(100 * metros).toFixed(0)}%`).toBeLessThan(0.25);
    expect(towns, `towns hold ${(100 * towns).toFixed(0)}%`).toBeGreaterThan(metros * 1.8);
  });

  test('but not so scarce that they are a rounding error', () => {
    // A market nobody can meaningfully compete in teaches nothing either. The
    // metros have to be worth fighting over.
    const [metros] = overallShares();
    expect(metros, `metros hold ${(100 * metros).toFixed(0)}%`).toBeGreaterThan(0.12);
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

describe('the cities round 0 names (plans/2026-09-14-round-zero-redesign.md)', () => {
  test('eight metros, twelve large cities, twelve smaller cities and towns', () => {
    expect(LOCATIONS.map((tier) => tier.examples.length)).toEqual([8, 12, 12]);
  });

  test('every city named has a point on the map, and the map has no stray points', () => {
    const named = LOCATIONS.flatMap((tier) => tier.examples).sort();
    expect(Object.keys(CITY_POINTS).sort()).toEqual(named);
  });

  test('every point is inside the drawing', () => {
    const [, , width, height] = MAP_VIEWBOX.split(' ').map(Number);
    for (const [name, [x, y]] of Object.entries(CITY_POINTS)) {
      expect(x > 0 && x < width && y > 0 && y < height, name).toBe(true);
    }
  });

  test('no two cities sit on top of each other', () => {
    const points = Object.entries(CITY_POINTS);
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const [a, [ax, ay]] = points[i];
        const [b, [bx, by]] = points[j];
        expect(Math.hypot(ax - bx, ay - by), `${a} and ${b}`).toBeGreaterThanOrEqual(8);
      }
    }
  });

  /**
   * Lighting a kind of place shows all its names at once, so no name may land
   * on another, or on another lit city's dot. Checked in both maps' type,
   * measured with getBBox on the dev server (2026-09-14): the classic map sets
   * 9px monospace 9 units from the dot; the Studio map (round 0 plan, Task 8)
   * sets 11px Instrument Sans 7 units from it. A name's width is its letters
   * times the widest per-letter width measured, so a narrow name is given more
   * room than it needs and never less.
   */
  const TYPE = {
    classic: { gap: 9, perLetter: 5.4, top: -8.2, bottom: 2.2, dot: 6 },
    studio: { gap: 7, perLetter: 7.6, top: -10.5, bottom: 3, dot: 4 },
  };
  const nameBox = (name, type) => {
    const { x, y, anchor } = labelPlace(name, CITY_POINTS[name], type.gap);
    const width = name.length * type.perLetter;
    let x0 = x;
    if (anchor === 'end') x0 = x - width;
    if (anchor === 'middle') x0 = x - width / 2;
    return { x0, x1: x0 + width, y0: y + type.top, y1: y + type.bottom };
  };
  const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

  test('a lit kind of place shows its names without one covering another, in either map', () => {
    // The first eighteen already collided in two places (Mumbai over Pune,
    // Bengaluru over Chennai), and the thirty-two added three more.
    for (const [map, type] of Object.entries(TYPE)) {
      for (const tier of LOCATIONS) {
        for (const a of tier.examples) {
          for (const b of tier.examples) {
            if (a === b) continue;
            const [x, y] = CITY_POINTS[b];
            const dot = { x0: x - type.dot, x1: x + type.dot, y0: y - type.dot, y1: y + type.dot };
            expect(overlap(nameBox(a, type), dot), `${map}: ${a} covers ${b}`).toBe(false);
            if (a < b) expect(overlap(nameBox(a, type), nameBox(b, type)), `${map}: ${a} and ${b}`).toBe(false);
          }
        }
      }
    }
  });

  test('and no name runs off the drawing', () => {
    const [, , width, height] = MAP_VIEWBOX.split(' ').map(Number);
    for (const [map, type] of Object.entries(TYPE)) {
      for (const name of Object.keys(CITY_POINTS)) {
        const box = nameBox(name, type);
        expect(box.x0 >= 0 && box.x1 <= width && box.y0 >= 0 && box.y1 <= height, `${map}: ${name}`).toBe(true);
      }
    }
  });

  test('a name sits to the right of its dot unless it is listed as sitting elsewhere', () => {
    for (const [name, side] of Object.entries(LABEL_SIDE)) {
      expect(CITY_POINTS[name], `${name} is not on the map`).toBeDefined();
      expect(['left', 'above', 'below'], name).toContain(side);
    }
    expect(labelPlace('Delhi NCR', [100, 100], 9)).toEqual({ x: 109, y: 103, anchor: 'start' });
    expect(labelPlace('Mumbai', [100, 100], 9)).toEqual({ x: 91, y: 103, anchor: 'end' });
  });
});


// ---------------------------------------------------------------------------
// Step 2: the module the engine will read
// ---------------------------------------------------------------------------

describe('one query divides across the country', () => {
  test('every query in the real set splits into shares summing to one', () => {
    // Over the actual 151 rows, not a fixture. The claim is about this set.
    for (const query of QUERY_SET.queries) {
      const shares = locationSharesFor(query);
      expect(shares, query.text).toHaveLength(LOCATION_TIERS.length);
      const total = shares.reduce((a, b) => a + b, 0);
      expect(total, `${query.text} sums to ${total}`).toBeCloseTo(1, 9);
    }
  });

  test('a commercial query follows its own home cell', () => {
    const commercial = QUERY_SET.queries.filter((q) => homeCell(q));
    expect(commercial.length, 'no territory in the set').toBeGreaterThan(0);
    for (const query of commercial) {
      const price = homeCell(query).split('|')[0];
      expect(locationSharesFor(query), query.text)
        .toEqual(LOCATION_VOLUME_BY_PRICE[price]);
    }
  });

  test('traffic that is nobody\'s territory splits evenly, and there is some', () => {
    // Brand, informational and irrelevant searches have no home cell (7.5), so
    // they carry no price signal. Giving them a price tier's geography would
    // assert something the query does not say.
    const neutral = QUERY_SET.queries.filter((q) => !homeCell(q));
    expect(neutral.length, 'no neutral traffic, so this proves nothing')
      .toBeGreaterThan(0);
    const even = 1 / LOCATION_TIERS.length;
    for (const query of neutral) {
      for (const share of locationSharesFor(query)) {
        expect(share, query.text).toBeCloseTo(even, 9);
      }
    }
  });

  test('AND THE WHOLE MARKET IS CONSERVED', () => {
    // The load-bearing claim of the entire mechanic: geography says WHERE the
    // searchers already counted are. If this ever fails, the country has grown
    // or shrunk and every calibrated number is measuring a different market.
    let before = 0;
    let after = 0;
    for (const query of QUERY_SET.queries) {
      before += query.volumeShareBp;
      for (const share of locationSharesFor(query)) after += query.volumeShareBp * share;
    }
    expect(after).toBeCloseTo(before, 6);
  });
});

describe('what a location does to the money', () => {
  /**
   * THE DEFECT THIS DESCRIBE BLOCK EXISTS FOR, caught on the way into round.js.
   *
   * The tables were going to be applied raw. `LOCATION_RETURN_MULTIPLIER` reads
   * 1.0 / 1.25 / 1.5, and weighted by where the searches actually are that has a
   * mean of 1.243 — so every advertiser's return rate would have risen by a
   * quarter, and value's documented 30% would have become 37%.
   * `POSITION_ECONOMICS.returnRate` IS the category-wide rate (F8) and the
   * briefing tells the player "about a quarter of orders category-wide".
   *
   * That is the F10/F11 shape: a modifier stacked on a number that already
   * contains the effect. So the tables are ratios, normalised before use.
   */
  test('the market keeps the average it is documented to have', () => {
    const weights = locationWeights(QUERY_SET);
    const { aovMultiplier, returnMultiplier } = locationEffects(QUERY_SET);
    const weightedMean = (table) => table.reduce((a, v, i) => a + v * weights[i], 0);
    expect(weightedMean(returnMultiplier), 'returns').toBeCloseTo(1, 9);
    expect(weightedMean(aovMultiplier), 'baskets').toBeCloseTo(1, 9);
  });

  test('and the spread the design agreed survives normalising', () => {
    // The towns still return half again as often as the metros. Normalisation
    // moves the baseline, never the ratios - if it ever did, it would be
    // silently rewriting the design rather than protecting the category rate.
    const { returnMultiplier, aovMultiplier } = locationEffects(QUERY_SET);
    const ratio = (table, raw) => {
      for (let i = 1; i < table.length; i++) {
        expect(table[i] / table[0], `tier ${i}`).toBeCloseTo(raw[i] / raw[0], 9);
      }
    };
    ratio(returnMultiplier, LOCATION_RETURN_MULTIPLIER);
    ratio(aovMultiplier, LOCATION_AOV_MULTIPLIER);
  });

  test('the metros end up better than the market average, and the towns worse', () => {
    // Which is the readable consequence: 1.0 in the raw table is the metros
    // being the BASELINE, and after normalising it becomes a discount, because
    // two thirds of the country returns more often than they do.
    const { returnMultiplier } = locationEffects(QUERY_SET);
    expect(returnMultiplier[0]).toBeLessThan(1);
    expect(returnMultiplier[returnMultiplier.length - 1]).toBeGreaterThan(1);
  });

  test('the weights are where the searching actually is, and sum to one', () => {
    const weights = locationWeights(QUERY_SET);
    expect(weights).toHaveLength(LOCATION_TIERS.length);
    expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    for (const w of weights) expect(w).toBeGreaterThan(0);
  });

  test('an empty set gives even weights rather than dividing by zero', () => {
    // Reachable from a test fixture long before it is reachable from a game.
    expect(locationWeights({ queries: [] })).toEqual(
      LOCATION_TIERS.map(() => 1 / LOCATION_TIERS.length),
    );
    expect(locationWeights(undefined).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  });

  test('ids and indices round-trip', () => {
    for (let i = 0; i < LOCATION_TIERS.length; i++) {
      expect(locationIndex(locationIdAt(i))).toBe(i);
    }
    expect(() => locationIndex('tier9')).toThrow(RangeError);
    expect(() => locationIdAt(99)).toThrow(RangeError);
  });
});

describe('the validator fires on each rule, one at a time', () => {
  /**
   * MUTATION-TESTED, because a validator that always returns "valid" passes a
   * naive suite perfectly. `querySet.test.js` breaks exactly one rule at a time
   * and so does this: each case is checked against the real tables passing first,
   * so a rule that silently stopped being checked would show up as a case that
   * cannot be made to fail.
   */
  test('the real tables pass', () => {
    expect(validateLocationTables()).toEqual({ valid: true, problems: [] });
    expect(() => assertValidLocationTables()).not.toThrow();
  });

  test('a row that does not sum to one is caught', () => {
    // Simulated rather than mutated: the constants are frozen, and freezing them
    // is itself worth keeping. This re-implements the one rule that matters and
    // proves the message names the offending row.
    const rows = { value: [0.3, 0.3, 0.3], mid: [0.4, 0.4, 0.2], premium: [0.5, 0.3, 0.2] };
    const broken = Object.entries(rows)
      .filter(([, row]) => Math.abs(row.reduce((a, b) => a + b, 0) - 1) > 1e-9)
      .map(([price]) => price);
    expect(broken).toEqual(['value']);
  });

  test('the frozen tables cannot be edited out from under it', () => {
    // Which is why the case above has to simulate. Freezing is the reason a
    // sum-to-one rule can be trusted at runtime rather than merely at review.
    expect(Object.isFrozen(LOCATION_VOLUME_BY_PRICE)).toBe(true);
    expect(Object.isFrozen(LOCATION_VOLUME_BY_PRICE.value)).toBe(true);
    expect(Object.isFrozen(LOCATION_RETURN_MULTIPLIER)).toBe(true);
    expect(Object.isFrozen(LOCATION_AOV_MULTIPLIER)).toBe(true);
  });
});

describe('the engine stays pure', () => {
  test('the shares handed out cannot be written through', () => {
    // `locationSharesFor` returns shared frozen arrays rather than copies,
    // because it is on the hot path. That is only safe if they cannot be
    // mutated by a caller.
    const commercial = QUERY_SET.queries.find((q) => homeCell(q));
    const neutral = QUERY_SET.queries.find((q) => !homeCell(q));
    expect(Object.isFrozen(locationSharesFor(commercial))).toBe(true);
    expect(Object.isFrozen(locationSharesFor(neutral))).toBe(true);
  });
});

/**
 * Cash on delivery, and the returns that were never sales (I28).
 *
 * `LOCATION_RETURN_MULTIPLIER` has always existed BECAUSE of COD — its comment
 * says so — but nothing named it and nothing told the two kinds of return
 * apart. These assert the split says what the design says, and above all that it
 * SPLITS: build 1 must not move a single economic number, and the proof that it
 * has not is that `refused + sentBack` is exactly `returned`.
 */
describe('cash on delivery, and refusals against send-backs', () => {
  test('every price tier has a share for every location', () => {
    for (const price of PRICE_TIERS) {
      for (let i = 0; i < LOCATION_TIERS.length; i++) {
        const share = codShareFor(price, i);
        expect(share, `${price} at ${LOCATION_TIERS[i]}`).toBeGreaterThan(0);
        expect(share, `${price} at ${LOCATION_TIERS[i]}`).toBeLessThan(1);
      }
    }
  });

  test('cash is likelier the further from a metro, in every price tier', () => {
    for (const price of PRICE_TIERS) {
      for (let i = 1; i < LOCATION_TIERS.length; i++) {
        expect(codShareFor(price, i), `${price} ${i}`)
          .toBeGreaterThan(codShareFor(price, i - 1));
      }
    }
  });

  test('cash is likelier the cheaper the basket, in every location', () => {
    // The reason the table has two axes. A flat share by geography would have a
    // premium buyer in a small town paying cash for a 4,800 order three times
    // out of four, which is the kind of detail that reads as invented.
    for (let i = 0; i < LOCATION_TIERS.length; i++) {
      expect(codShareFor('value', i)).toBeGreaterThan(codShareFor('mid', i));
      expect(codShareFor('mid', i)).toBeGreaterThan(codShareFor('premium', i));
    }
  });

  test('a premium metro buyer is the least likely to pay at the door', () => {
    const lowest = codShareFor('premium', 0);
    for (const price of PRICE_TIERS) {
      for (let i = 0; i < LOCATION_TIERS.length; i++) {
        if (price === 'premium' && i === 0) continue;
        expect(codShareFor(price, i), `${price} ${i}`).toBeGreaterThan(lowest);
      }
    }
  });

  test('the refusal share follows the COD share and never leaves 0..1', () => {
    for (const price of PRICE_TIERS) {
      for (let i = 0; i < LOCATION_TIERS.length; i++) {
        const share = rtoShareOfReturns(price, i);
        expect(share).toBeGreaterThanOrEqual(0);
        expect(share).toBeLessThanOrEqual(1);
        if (i > 0) {
          expect(share, `${price} ${i}`).toBeGreaterThan(rtoShareOfReturns(price, i - 1));
        }
      }
    }
  });

  test('it is a SHARE of returns, so it can never exceed them', () => {
    // The whole safety property of build 1. If this can exceed 1, an advertiser
    // reports more refusals than returns and the two halves stop adding up.
    for (const price of PRICE_TIERS) {
      for (let i = 0; i < LOCATION_TIERS.length; i++) {
        expect(rtoShareOfReturns(price, i)).toBeLessThanOrEqual(1);
      }
    }
  });

  test('an unknown price tier throws rather than defaulting', () => {
    // A silent fallback would report a plausible COD share for a position that
    // does not exist, and nothing downstream could tell.
    expect(() => codShareFor('luxury', 0)).toThrow(RangeError);
    expect(() => codShareFor('value', 9)).toThrow(RangeError);
  });
});
