import { describe, test, expect } from 'vitest';
import {
  cellKey, parseCell, allCells, isValidPosition,
  businessFor, breakEvenCpcPaise, grossBreakEvenCpcPaise, marginPerOrderPaise,
  capexEffect, liveCapexPaise, landingPageBonus,
  canReposition, isOneStep, reposition,
  realisedBreakEvenCpcPaise, territoryQueries, returnHalves, refusalOutlook,
} from '../engine/positions.js';
import { refusalRateFor, rtoShareOfReturns } from '../engine/locations.js';
import { homeCell } from '../engine/querySet.js';
import { QUERY_SET } from '../content/querySet.js';
import {
  PRICE_TIERS, PURPOSES, POSITION_ECONOMICS, PURPOSE_MODIFIERS,
  CAPEX_TIER_CURVE, CAPEX_ALLOCATION_PAISE, CAPEX_DELAY_ROUNDS,
  CAPEX_LANDING_PAGE_MAX_POINTS, REPOSITION_ROUND, REPOSITION_COST_PAISE,
  LOCATION_TIERS, RETURN_RATE_CLAMP_MAX,
} from '../engine/constants.js';

const pos = (price, purpose) => ({ price, purpose, setAtRound: 0, repositionedAtRound: null });
const noCapex = { committed: { sizeGuide: 0, photography: 0, landingPage: 0 }, pending: [] };

describe('the grid', () => {
  test('has six cells', () => {
    expect(allCells()).toHaveLength(PRICE_TIERS.length * PURPOSES.length);
    expect(allCells()).toHaveLength(6);
  });

  test('cellKey and parseCell round-trip', () => {
    for (const price of PRICE_TIERS) {
      for (const purpose of PURPOSES) {
        expect(parseCell(cellKey(price, purpose))).toEqual({ price, purpose });
      }
    }
  });

  test('cell order is fixed, so anything iterating it is deterministic (R1)', () => {
    expect(allCells()).toEqual(allCells());
    expect(allCells()[0]).toBe(cellKey(PRICE_TIERS[0], PURPOSES[0]));
  });

  test('parseCell rejects nonsense rather than returning a half-built cell', () => {
    expect(() => parseCell('value')).toThrow();
    expect(() => parseCell('cheap|performance')).toThrow();
    expect(() => parseCell('value|sporty')).toThrow();
  });

  test('isValidPosition checks both axes', () => {
    expect(isValidPosition(pos('value', 'performance'))).toBe(true);
    expect(isValidPosition(pos('value', 'sporty'))).toBe(false);
    expect(isValidPosition(pos('cheap', 'performance'))).toBe(false);
    expect(isValidPosition(null)).toBe(false);
  });
});

describe('economics derive from position (spec 4.2, DECISIONS F6)', () => {
  test('every cell yields a complete business block', () => {
    const fields = ['convRateBase', 'aovMeanPaise', 'aovSpread', 'marginPct',
      'returnRate', 'returnWindowRounds'];
    for (const price of PRICE_TIERS) {
      for (const purpose of PURPOSES) {
        const b = businessFor(pos(price, purpose), noCapex, 1);
        for (const f of fields) expect(b[f], `${price}|${purpose}.${f}`).toBeTypeOf('number');
      }
    }
  });

  test('order value comes from the price tier alone', () => {
    for (const price of PRICE_TIERS) {
      for (const purpose of PURPOSES) {
        expect(businessFor(pos(price, purpose), noCapex, 1).aovMeanPaise)
          .toBe(POSITION_ECONOMICS[price].aovMeanPaise);
      }
    }
  });

  test('purpose modulates conversion and returns, and nothing else', () => {
    const perf = businessFor(pos('mid', 'performance'), noCapex, 1);
    const life = businessFor(pos('mid', 'lifestyle'), noCapex, 1);
    expect(perf.aovMeanPaise).toBe(life.aovMeanPaise);
    expect(perf.marginPct).toBe(life.marginPct);
    expect(life.convRateBase).toBeGreaterThan(perf.convRateBase);
    expect(life.returnRate).toBeGreaterThan(perf.returnRate);
  });

  test('the purpose modifiers are applied, not merely present', () => {
    const base = POSITION_ECONOMICS.mid;
    const b = businessFor(pos('mid', 'lifestyle'), noCapex, 1);
    expect(b.convRateBase).toBeCloseTo(base.convRateBase * PURPOSE_MODIFIERS.lifestyle.conv, 10);
    expect(b.returnRate).toBeCloseTo(base.returnRate * PURPOSE_MODIFIERS.lifestyle.ret, 10);
  });

  test('the return rate is clamped, so a modifier can never push it past 1', () => {
    for (const price of PRICE_TIERS) {
      for (const purpose of PURPOSES) {
        const r = businessFor(pos(price, purpose), noCapex, 1).returnRate;
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThan(1);
      }
    }
  });

  test('an invalid position throws rather than yielding a silent default', () => {
    expect(() => businessFor(pos('cheap', 'performance'), noCapex, 1)).toThrow();
  });
});

describe('break-even (spec 4.4)', () => {
  const be = (price, purpose) => breakEvenCpcPaise(businessFor(pos(price, purpose), noCapex, 1));

  test('matches the figures the spec documents', () => {
    // These moved when PURPOSE_MODIFIERS.conv shrank from 0.90/1.10 to
    // 0.94/1.06, and again with F14, when the return level rose to the sourced
    // total and ret narrowed to 0.91/1.09 (they were 1412 / 1368 / 2615 / 2637
    // / 3715 / 3836). They are the NEUTRAL-QUERY figures - every query
    // multiplier at 1, every hour equally likely - and no advertiser ever buys
    // that query. What a position can really pay is realisedBreakEvenCpcPaise,
    // 2.2 to 2.6x these, and that is what I2 and the briefing quote.
    expect(be('value', 'performance')).toBe(1159);
    expect(be('value', 'lifestyle')).toBe(1142);
    expect(be('mid', 'performance')).toBe(2038);
    expect(be('mid', 'lifestyle')).toBe(2020);
    expect(be('premium', 'performance')).toBe(2863);
    expect(be('premium', 'lifestyle')).toBe(2869);
  });

  test('the realised figure is what a position can really pay', () => {
    // Territory is by construction the queries where BOTH affinities peak, so
    // the affinity product runs near 2.0; and the intent curve's mean is 1
    // across uniform hours but 1.146 across traffic. Together they put the
    // real ceiling well above the neutral-query one, in every cell.
    for (const cell of allCells()) {
      const { price, purpose } = parseCell(cell);
      const b = businessFor(pos(price, purpose), noCapex, 1);
      const neutral = breakEvenCpcPaise(b);
      const real = realisedBreakEvenCpcPaise(b, QUERY_SET, pos(price, purpose));
      expect(real / neutral, cell).toBeGreaterThan(2);
      expect(real / neutral, cell).toBeLessThan(3);
      expect(Number.isSafeInteger(real), cell).toBe(true);
    }
  });

  test('territory holds only commercial queries that this cell wins', () => {
    for (const cell of allCells()) {
      const { price, purpose } = parseCell(cell);
      const qs = territoryQueries(QUERY_SET, pos(price, purpose));
      expect(qs.length, cell).toBeGreaterThan(0);
      for (const q of qs) {
        expect(q.intent, q.id).toBe('commercial');
        expect(homeCell(q), q.id).toBe(cell);
      }
    }
  });

  test('every territory query is claimed by exactly one cell', () => {
    const seen = new Set();
    for (const cell of allCells()) {
      const { price, purpose } = parseCell(cell);
      for (const q of territoryQueries(QUERY_SET, pos(price, purpose))) {
        expect(seen.has(q.id), q.id).toBe(false);
        seen.add(q.id);
      }
    }
  });

  test('returns integer paise (R7)', () => {
    for (const cell of allCells()) {
      const { price, purpose } = parseCell(cell);
      expect(Number.isSafeInteger(be(price, purpose)), cell).toBe(true);
    }
  });

  test('I4: the purpose axis moves break-even by under 15% within a price row', () => {
    for (const price of PRICE_TIERS) {
      const a = be(price, 'performance');
      const b = be(price, 'lifestyle');
      expect(Math.abs(b - a) / Math.min(a, b), `${price} purpose spread`).toBeLessThan(0.15);
    }
  });

  test('I4: the price axis moves it more than 2x top to bottom', () => {
    for (const purpose of PURPOSES) {
      expect(be('premium', purpose) / be('value', purpose), purpose).toBeGreaterThan(2);
    }
  });

  test('the axes stay in their lanes: price moves it far more than purpose', () => {
    const purposeSpread = Math.max(...PRICE_TIERS.map(
      (p) => Math.abs(be(p, 'lifestyle') - be(p, 'performance')) / be(p, 'performance'),
    ));
    const priceSpread = be('premium', 'performance') / be('value', 'performance') - 1;
    expect(priceSpread).toBeGreaterThan(purposeSpread * 5);
  });

  test('the documented 75/72/66 gross-net gaps are the BASE tier figures', () => {
    // Worth pinning: DECISIONS quotes these for the price tier alone. The
    // purpose modifier then moves them in both directions, so the headline
    // numbers describe a row, not any actual cell an advertiser occupies.
    //
    // They were 43/32/25 until F14. The level rose to the sourced total and
    // the spread collapsed with it: section 14's trap is now nearly as deep at
    // premium as at value, because returns barely vary by price.
    const baseGap = (price) => 1 / (1 - POSITION_ECONOMICS[price].returnRate) - 1;
    expect(baseGap('value')).toBeCloseTo(0.745, 2);
    expect(baseGap('mid')).toBeCloseTo(0.715, 2);
    expect(baseGap('premium')).toBeCloseTo(0.656, 2);
  });

  test('gross always exceeds net, and the gap is widest where margin is thinnest', () => {
    // The section 14 trap: an advertiser optimising to gross conversions
    // believes it can pay the gross figure. Value is punished hardest.
    const gap = (price, purpose) => {
      const b = businessFor(pos(price, purpose), noCapex, 1);
      return grossBreakEvenCpcPaise(b) / breakEvenCpcPaise(b) - 1;
    };
    for (const purpose of PURPOSES) {
      expect(gap('value', purpose), purpose).toBeGreaterThan(gap('mid', purpose));
      expect(gap('mid', purpose), purpose).toBeGreaterThan(gap('premium', purpose));
      expect(gap('premium', purpose), purpose).toBeGreaterThan(0.15);
    }
  });

  test('a lifestyle brand is punished harder than a performance one', () => {
    // Lifestyle returns run 1.09x, performance 0.91x, so the same price tier
    // faces a very different gross-net gap depending on what it sells. Value
    // lifestyle is the worst place in the grid to optimise to gross.
    const gap = (price, purpose) => {
      const b = businessFor(pos(price, purpose), noCapex, 1);
      return grossBreakEvenCpcPaise(b) / breakEvenCpcPaise(b) - 1;
    };
    expect(gap('value', 'lifestyle')).toBeGreaterThan(gap('value', 'performance'));
    expect(gap('value', 'lifestyle')).toBeGreaterThan(0.5);
  });

  test('margin potential per order runs premium > mid > value', () => {
    const m = (price) => marginPerOrderPaise(businessFor(pos(price, 'performance'), noCapex, 1));
    expect(m('premium')).toBeGreaterThan(m('mid'));
    expect(m('mid')).toBeGreaterThan(m('value'));
  });

  test('premium generates roughly 2.7x value per thousand searches', () => {
    // This ratio is what the 52/28/20 territory split is derived from. If it
    // drifts, the volume split stops balancing the positions.
    const per1000 = (price) => {
      const b = businessFor(pos(price, 'performance'), noCapex, 1);
      return 1000 * b.convRateBase * marginPerOrderPaise(b);
    };
    const ratio = per1000('premium') / per1000('value');
    expect(ratio).toBeGreaterThan(2.4);
    expect(ratio).toBeLessThan(3.0);
  });
});

describe('capex: the S-curve (spec 13.3, DECISIONS D7)', () => {
  test('zero commitment has no effect', () => {
    expect(capexEffect(0)).toBe(1);
  });

  test('reads the curve at its authored points', () => {
    for (const point of CAPEX_TIER_CURVE) {
      expect(capexEffect(point.paise), String(point.paise)).toBeCloseTo(point.effect, 10);
    }
  });

  test('interpolates between them', () => {
    const mid = (CAPEX_TIER_CURVE[1].paise + CAPEX_TIER_CURVE[2].paise) / 2;
    expect(capexEffect(mid)).toBeGreaterThan(CAPEX_TIER_CURVE[1].effect);
    expect(capexEffect(mid)).toBeLessThan(CAPEX_TIER_CURVE[2].effect);
  });

  test('spending past the top tier buys nothing further', () => {
    const top = CAPEX_TIER_CURVE[CAPEX_TIER_CURVE.length - 1];
    expect(capexEffect(top.paise * 3)).toBe(top.effect);
  });

  test('is monotonic', () => {
    let prev = 0;
    for (let p = 0; p <= CAPEX_ALLOCATION_PAISE; p += 500000) {
      const e = capexEffect(p);
      expect(e).toBeGreaterThanOrEqual(prev);
      prev = e;
    }
  });

  test('splitting three ways underperforms committing, at equal spend', () => {
    // The whole reason the curve is an S. With diminishing returns the first
    // tranche on a fresh target would always be the cheapest gain and
    // spreading thin would be strictly optimal.
    const third = Math.floor(CAPEX_ALLOCATION_PAISE / 3);
    const spread = capexEffect(third) - 1;
    const committed = capexEffect(CAPEX_ALLOCATION_PAISE) - 1;
    expect(spread * 3).toBeLessThan(committed * 1.35);
    expect(capexEffect(third)).toBeLessThan(capexEffect(CAPEX_ALLOCATION_PAISE));
  });
});

describe('capex: the delay (spec 13.3)', () => {
  const capex = {
    committed: { sizeGuide: 10000000, photography: 0, landingPage: 0 },
    pending: [{ target: 'sizeGuide', paise: 10000000, liveAtRound: 1 + CAPEX_DELAY_ROUNDS }],
  };

  test('a tranche is inert before its live round', () => {
    expect(liveCapexPaise(capex, 'sizeGuide', 1)).toBe(0);
    expect(liveCapexPaise(capex, 'sizeGuide', CAPEX_DELAY_ROUNDS)).toBe(0);
  });

  test('and live from that round onward', () => {
    expect(liveCapexPaise(capex, 'sizeGuide', 1 + CAPEX_DELAY_ROUNDS)).toBe(10000000);
    expect(liveCapexPaise(capex, 'sizeGuide', 12)).toBe(10000000);
  });

  test('commissioned at round 1, live at round 4', () => {
    expect(1 + CAPEX_DELAY_ROUNDS).toBe(4);
  });

  test('a target with nothing committed reads zero', () => {
    expect(liveCapexPaise(capex, 'photography', 12)).toBe(0);
  });

  test('is cumulative across both allocations', () => {
    const twice = {
      committed: { sizeGuide: 8000000, photography: 0, landingPage: 0 },
      pending: [{ target: 'sizeGuide', paise: 5000000, liveAtRound: 8 }],
    };
    expect(liveCapexPaise(twice, 'sizeGuide', 7)).toBe(3000000);
    expect(liveCapexPaise(twice, 'sizeGuide', 8)).toBe(8000000);
  });
});

describe('capex: what each target actually moves', () => {
  const withCapex = (target, paise) => ({
    committed: { sizeGuide: 0, photography: 0, landingPage: 0, [target]: paise },
    pending: [],
  });
  const base = businessFor(pos('value', 'performance'), noCapex, 5);

  test('the size guide lowers the return rate and touches nothing else', () => {
    const b = businessFor(pos('value', 'performance'), withCapex('sizeGuide', CAPEX_ALLOCATION_PAISE), 5);
    expect(b.returnRate).toBeLessThan(base.returnRate);
    expect(b.convRateBase).toBeCloseTo(base.convRateBase, 10);
    expect(b.aovMeanPaise).toBe(base.aovMeanPaise);
  });

  test('photography raises the conversion rate and touches nothing else', () => {
    const b = businessFor(pos('value', 'performance'), withCapex('photography', CAPEX_ALLOCATION_PAISE), 5);
    expect(b.convRateBase).toBeGreaterThan(base.convRateBase);
    expect(b.returnRate).toBeCloseTo(base.returnRate, 10);
  });

  test('the landing page target does not touch the business block at all', () => {
    // It moves a GRADED number instead, applied after grading, so the grader
    // and the investment stay separable.
    const b = businessFor(pos('value', 'performance'), withCapex('landingPage', CAPEX_ALLOCATION_PAISE), 5);
    expect(b).toEqual(base);
  });

  test('both effects together are larger than either alone', () => {
    const both = {
      committed: { sizeGuide: 5000000, photography: 5000000, landingPage: 0 },
      pending: [],
    };
    const b = businessFor(pos('value', 'performance'), both, 5);
    expect(b.returnRate).toBeLessThan(base.returnRate);
    expect(b.convRateBase).toBeGreaterThan(base.convRateBase);
  });

  test('a full size-guide investment lifts break-even meaningfully', () => {
    const b = businessFor(pos('value', 'performance'), withCapex('sizeGuide', CAPEX_ALLOCATION_PAISE), 5);
    expect(breakEvenCpcPaise(b)).toBeGreaterThan(breakEvenCpcPaise(base));
  });

  test('the value tier gains most from the size guide, premium least', () => {
    // Returns are 30% at the cheap end and 20% at the top, so the same fix is
    // worth more where more orders come back. This is what makes the capex
    // choice position-dependent rather than a re-skinned slider.
    const gain = (price) => {
      const before = businessFor(pos(price, 'performance'), noCapex, 5);
      const after = businessFor(pos(price, 'performance'), withCapex('sizeGuide', CAPEX_ALLOCATION_PAISE), 5);
      return breakEvenCpcPaise(after) / breakEvenCpcPaise(before) - 1;
    };
    expect(gain('value')).toBeGreaterThan(gain('premium'));
  });
});

describe('landingPageBonus', () => {
  test('is zero with no investment', () => {
    expect(landingPageBonus(noCapex, 5)).toBe(0);
  });

  test('reaches the full allowance at full commitment', () => {
    const capex = {
      committed: { sizeGuide: 0, photography: 0, landingPage: CAPEX_ALLOCATION_PAISE },
      pending: [],
    };
    expect(landingPageBonus(capex, 5)).toBe(CAPEX_LANDING_PAGE_MAX_POINTS);
  });

  test('respects the delay', () => {
    const capex = {
      committed: { sizeGuide: 0, photography: 0, landingPage: CAPEX_ALLOCATION_PAISE },
      pending: [{ target: 'landingPage', paise: CAPEX_ALLOCATION_PAISE, liveAtRound: 8 }],
    };
    expect(landingPageBonus(capex, 7)).toBe(0);
    expect(landingPageBonus(capex, 8)).toBe(CAPEX_LANDING_PAGE_MAX_POINTS);
  });

  test('is a whole number of points, since the graded score is', () => {
    for (let p = 0; p <= CAPEX_ALLOCATION_PAISE; p += 250000) {
      const capex = { committed: { sizeGuide: 0, photography: 0, landingPage: p }, pending: [] };
      expect(Number.isInteger(landingPageBonus(capex, 5))).toBe(true);
    }
  });
});

describe('repositioning (spec 4.5)', () => {
  const at = (round, already = null) => ({
    position: { price: 'value', purpose: 'performance', setAtRound: 0, repositionedAtRound: already },
  });

  test('is permitted only at round 5', () => {
    expect(REPOSITION_ROUND).toBe(5);
    expect(canReposition(at(5), 5)).toBe(true);
    for (const r of [1, 2, 3, 4, 6, 9, 12]) expect(canReposition(at(r), r), `round ${r}`).toBe(false);
  });

  test('only once', () => {
    expect(canReposition(at(5, 5), 5)).toBe(false);
  });

  test('one grid step: a price step is allowed', () => {
    expect(isOneStep({ price: 'value', purpose: 'performance' }, { price: 'mid', purpose: 'performance' })).toBe(true);
  });

  test('one grid step: a purpose step is allowed', () => {
    expect(isOneStep({ price: 'value', purpose: 'performance' }, { price: 'value', purpose: 'lifestyle' })).toBe(true);
  });

  test('two price tiers is not one step: that is a different company', () => {
    expect(isOneStep({ price: 'value', purpose: 'performance' }, { price: 'premium', purpose: 'performance' })).toBe(false);
  });

  test('moving both axes at once is not one step', () => {
    expect(isOneStep({ price: 'value', purpose: 'performance' }, { price: 'mid', purpose: 'lifestyle' })).toBe(false);
  });

  test('staying put is not a step', () => {
    expect(isOneStep({ price: 'mid', purpose: 'lifestyle' }, { price: 'mid', purpose: 'lifestyle' })).toBe(false);
  });

  test('reposition records the round it happened', () => {
    const next = reposition(at(5).position, { price: 'mid', purpose: 'performance' }, 5);
    expect(next.price).toBe('mid');
    expect(next.repositionedAtRound).toBe(5);
    expect(next.setAtRound).toBe(0);
  });

  test('it refuses an illegal move rather than silently clamping', () => {
    expect(() => reposition(at(5).position, { price: 'premium', purpose: 'lifestyle' }, 5))
      .toThrow(/one step/i);
  });

  test('it refuses the wrong round', () => {
    expect(() => reposition(at(3).position, { price: 'mid', purpose: 'performance' }, 3))
      .toThrow(/round/i);
  });

  test('it refuses a second move', () => {
    expect(() => reposition(at(5, 5).position, { price: 'mid', purpose: 'performance' }, 5))
      .toThrow(/once/i);
  });

  test('the cost is one maxed target, which is the point it makes now', () => {
    // It used to be one full capex allocation. That tie broke when the fourth
    // target arrived (I29) — see `constants.test.js` for why it could not be
    // kept — and repositioning was left at ₹1,00,000 rather than following the
    // allocation up to ₹1,20,000, because HANDOVER already records that it is
    // barely affordable against a month's budget.
    const top = CAPEX_TIER_CURVE[CAPEX_TIER_CURVE.length - 1].paise;
    expect(REPOSITION_COST_PAISE).toBeGreaterThan(top);
    expect(REPOSITION_COST_PAISE).toBeLessThan(CAPEX_ALLOCATION_PAISE);
  });

  test('it does not mutate the position it was given (R1)', () => {
    const before = at(5).position;
    const snapshot = JSON.stringify(before);
    reposition(before, { price: 'mid', purpose: 'performance' }, 5);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('purity (R1)', () => {
  test('businessFor does not mutate its inputs', () => {
    const p = pos('mid', 'lifestyle');
    const capex = { committed: { sizeGuide: 5000000, photography: 0, landingPage: 0 }, pending: [] };
    const before = JSON.stringify([p, capex]);
    businessFor(p, capex, 5);
    expect(JSON.stringify([p, capex])).toBe(before);
  });

  test('and never returns the shared constants object', () => {
    // A caller mutating the returned block must not corrupt POSITION_ECONOMICS
    // for every other advertiser in the game.
    const b = businessFor(pos('mid', 'performance'), noCapex, 1);
    expect(b).not.toBe(POSITION_ECONOMICS.mid);
    b.marginPct = 0.99;
    expect(POSITION_ECONOMICS.mid.marginPct).not.toBe(0.99);
  });

  test('repeated calls agree', () => {
    const p = pos('premium', 'performance');
    expect(businessFor(p, noCapex, 5)).toEqual(businessFor(p, noCapex, 5));
  });
});

/**
 * The size guide reaches only half of what comes back (I28 build 2).
 *
 * A size guide fixes "wrong size". It does nothing about a parcel refused at
 * the door, and refusals are the half that varies with geography — so the two
 * halves have to be separable before `round.js` can apply the capex to one and
 * not the other.
 */
describe('the two halves of the return rate', () => {
  const noCapex = { committed: {}, pending: [] };
  const fullGuide = { committed: { sizeGuide: 10000000 }, pending: [] };
  const cell = { price: 'mid', purpose: 'lifestyle' };

  test('the pre-size-guide rate is exactly what the tables say, capex or not', () => {
    // If capex ever leaks into this, the split downstream applies the size
    // guide twice — once here and once to the send-back half.
    const a = businessFor(cell, noCapex, 6);
    const b = businessFor(cell, fullGuide, 6);
    expect(b.returnRateBeforeSizeGuide).toBe(a.returnRateBeforeSizeGuide);
    expect(a.returnRateBeforeSizeGuide).toBeCloseTo(
      POSITION_ECONOMICS[cell.price].returnRate * PURPOSE_MODIFIERS[cell.purpose].ret, 10,
    );
  });

  test('the size guide effect is 1 with no capex and above 1 with it', () => {
    expect(businessFor(cell, noCapex, 6).sizeGuideEffect).toBe(1);
    expect(businessFor(cell, fullGuide, 6).sizeGuideEffect).toBeGreaterThan(1);
  });

  test('the headline returnRate is still the two divided, so nothing else moves', () => {
    // `returnRate` is what every caller that does not know the location reads,
    // and it must keep meaning exactly what it did before this split existed.
    for (const capex of [noCapex, fullGuide]) {
      const b = businessFor(cell, capex, 6);
      expect(b.returnRate).toBeCloseTo(b.returnRateBeforeSizeGuide / b.sizeGuideEffect, 10);
    }
  });

  test('a capex tranche still pending does not reduce anything yet', () => {
    const pending = {
      committed: { sizeGuide: 10000000 },
      pending: [{ target: 'sizeGuide', paise: 10000000, liveAtRound: 9 }],
    };
    expect(businessFor(cell, pending, 6).sizeGuideEffect).toBe(1);
    expect(businessFor(cell, pending, 9).sizeGuideEffect).toBeGreaterThan(1);
  });
});

/**
 * Order confirmation, the fourth target (I29).
 *
 * Build 2 charged ₹200 on every parcel refused at the door and gave the player
 * nothing to do about it — the size guide reaches send-backs only. A cost with
 * no defence is a tax, not a decision. These assert that the defence exists,
 * that it reaches the right half, and that it cannot reach the wrong one.
 */
describe('order confirmation acts on refusals and nothing else', () => {
  const cell = { price: 'mid', purpose: 'lifestyle' };
  const none = { committed: {}, pending: [] };
  const confirmed = { committed: { orderConfirmation: 8000000 }, pending: [] };
  const guided = { committed: { sizeGuide: 8000000 }, pending: [] };

  test('funding it raises its effect and leaves the size guide alone', () => {
    const b = businessFor(cell, confirmed, 6);
    expect(b.orderConfirmationEffect).toBeGreaterThan(1);
    expect(b.sizeGuideEffect).toBe(1);
  });

  test('and the size guide does not touch order confirmation either', () => {
    const b = businessFor(cell, guided, 6);
    expect(b.sizeGuideEffect).toBeGreaterThan(1);
    expect(b.orderConfirmationEffect).toBe(1);
  });

  test('it does NOT move the headline return rate, because it is not a fit problem', () => {
    // `returnRate` is the size-guide-adjusted figure every caller that does not
    // know the location reads. Order confirmation acts per location, inside
    // `round.js`, on the refusal half only — so if it ever starts moving this,
    // it has become a second size guide and the two halves have merged.
    expect(businessFor(cell, confirmed, 6).returnRate)
      .toBe(businessFor(cell, none, 6).returnRate);
  });

  test('it climbs the same ladder as everything else', () => {
    const top = CAPEX_TIER_CURVE[CAPEX_TIER_CURVE.length - 1];
    expect(businessFor(cell, confirmed, 6).orderConfirmationEffect).toBe(top.effect);
    const half = { committed: { orderConfirmation: 5500000 }, pending: [] };
    expect(businessFor(cell, half, 6).orderConfirmationEffect)
      .toBeLessThan(top.effect);
  });

  test('a pending tranche buys nothing until it lands', () => {
    const pending = {
      committed: { orderConfirmation: 8000000 },
      pending: [{ target: 'orderConfirmation', paise: 8000000, liveAtRound: 9 }],
    };
    expect(businessFor(cell, pending, 6).orderConfirmationEffect).toBe(1);
    expect(businessFor(cell, pending, 9).orderConfirmationEffect).toBeGreaterThan(1);
  });
});

describe('what comes back from an order at a place (I28, I29, I34)', () => {
  const MID = { price: 'mid', purpose: 'performance' };
  const EMPTY = { committed: {}, pending: [] };
  const full = (target) => ({ committed: { [target]: 8000000 }, pending: [] });
  const top = CAPEX_TIER_CURVE[CAPEX_TIER_CURVE.length - 1].effect;
  const at = (over = {}) => returnHalves({
    business: businessFor(MID, EMPTY, 1), queryReturnMultiplier: 1, placeReturnMultiplier: 1,
    price: 'mid', tierIndex: 2, discountPaise: 0, ...over,
  });
  const sentBack = (x) => x.returned - x.refused;

  test('with nothing bought, it is the whole return level, split at the sourced share', () => {
    const x = at();
    expect(x.returned).toBeCloseTo(businessFor(MID, EMPTY, 1).returnRateBeforeSizeGuide, 12);
    expect(x.refused / x.returned).toBeCloseTo(rtoShareOfReturns('mid', 2, 0), 12);
  });

  test('order confirmation divides refusals and nothing else', () => {
    const x = at({ business: businessFor(MID, full('orderConfirmation'), 1) });
    expect(x.refused).toBeCloseTo(at().refused / top, 12);
    expect(sentBack(x)).toBeCloseTo(sentBack(at()), 12);
  });

  test('the size guide divides send-backs and nothing else', () => {
    const x = at({ business: businessFor(MID, full('sizeGuide'), 1) });
    expect(x.refused).toBeCloseTo(at().refused, 12);
    expect(sentBack(x)).toBeCloseTo(sentBack(at()) / top, 12);
  });

  test('a discount takes refusals off at the sourced rate, and leaves send-backs where they were', () => {
    for (let t = 0; t < LOCATION_TIERS.length; t++) {
      const none = at({ tierIndex: t });
      const paid = at({ tierIndex: t, discountPaise: 3000 });
      expect(paid.refused / none.refused, `place ${t}`)
        .toBeCloseTo(refusalRateFor('mid', t, 3000) / refusalRateFor('mid', t, 0), 12);
      expect(sentBack(paid), `place ${t}`).toBeCloseTo(sentBack(none), 12);
    }
  });

  test('nothing comes back past the clamp, and refusals never exceed returns', () => {
    const x = at({ queryReturnMultiplier: 5, placeReturnMultiplier: 5 });
    expect(x.returned).toBeLessThanOrEqual(RETURN_RATE_CLAMP_MAX);
    expect(x.refused).toBeLessThanOrEqual(x.returned);
  });
});

describe('the refusal rate an account will run at (I34)', () => {
  const MID = { price: 'mid', purpose: 'performance' };
  const EMPTY = { committed: {}, pending: [] };
  const outlook = (over = {}) => refusalOutlook({
    position: MID, capex: EMPTY, round: 1, discountPaise: 0, placeWeights: [0, 0, 1], ...over,
  });

  test('it weights the places by where the account buys, at any scale', () => {
    const each = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((w) => outlook({ placeWeights: w }));
    expect(outlook({ placeWeights: [2, 3, 5] })).toBeCloseTo((2 * each[0] + 3 * each[1] + 5 * each[2]) / 10, 12);
    expect(outlook({ placeWeights: [20, 30, 50] })).toBeCloseTo(outlook({ placeWeights: [2, 3, 5] }), 12);
  });

  test('an account with no clicks is refused, not guessed at', () => {
    // Which place to show an account that has bought nothing is the card's
    // choice, and the card makes it; a quiet default here would hide it.
    expect(() => outlook({ placeWeights: [0, 0, 0] })).toThrow(RangeError);
    expect(() => outlook({ placeWeights: [1, 1] })).toThrow(RangeError);
  });

  test('order confirmation counts from the week it is live, and not before', () => {
    const building = {
      committed: { orderConfirmation: 8000000 },
      pending: [{ target: 'orderConfirmation', paise: 8000000, liveAtRound: 1 + CAPEX_DELAY_ROUNDS }],
    };
    const top = CAPEX_TIER_CURVE[CAPEX_TIER_CURVE.length - 1].effect;
    expect(outlook({ capex: building, round: CAPEX_DELAY_ROUNDS })).toBeCloseTo(outlook(), 12);
    expect(outlook({ capex: building, round: 1 + CAPEX_DELAY_ROUNDS })).toBeCloseTo(outlook() / top, 12);
  });

  test('it carries purpose: lifestyle returns more than performance, by the modifiers', () => {
    const lifestyle = outlook({ position: { price: 'mid', purpose: 'lifestyle' } });
    expect(lifestyle / outlook())
      .toBeCloseTo(PURPOSE_MODIFIERS.lifestyle.ret / PURPOSE_MODIFIERS.performance.ret, 12);
  });

  test('and a discount, at the sourced rate', () => {
    expect(outlook({ discountPaise: 3000 }) / outlook())
      .toBeCloseTo(refusalRateFor('mid', 2, 3000) / refusalRateFor('mid', 2, 0), 12);
  });
});
