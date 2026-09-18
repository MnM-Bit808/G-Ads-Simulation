import { describe, test, expect } from 'vitest';
import {
  effectiveConvRate, brandFactor, retentionRate, sampleOrderValuePaise,
  expectedOrderValuePaise, orderValuePaise, queueConversions, landDueConversions, queueReturns, resolveReturns,
  summariseLanded, summariseReturns,
} from '../engine/attribution.js';
import { businessFor } from '../engine/positions.js';
import { mulberry32 } from '../engine/rng.js';
import {
  HOURLY_INTENT_CURVE, CONV_RATE_CLAMP, ATTRIBUTION_LAG_DISTRIBUTION,
  POSITION_ECONOMICS, PURPOSE_MODIFIERS, RETURN_RATE_CLAMP_MAX,
  BRAND_OWNER_MULTIPLIER, BRAND_POACHER_MULTIPLIER, INFORMATIONAL_CONV_MULTIPLIER,
} from '../engine/constants.js';

const noCapex = { committed: { sizeGuide: 0, photography: 0, landingPage: 0 }, pending: [] };
const pos = (price, purpose) => ({ price, purpose, setAtRound: 0, repositionedAtRound: null });

const neutralQuery = (over = {}) => ({
  id: 'q', text: 'gym leggings', intent: 'commercial', brandOwner: null,
  convMultiplier: 1, valueMultiplier: 1, returnRateMultiplier: 1,
  priceAffinity: { value: 1, mid: 1, premium: 1 },
  purposeAffinity: { performance: 1, lifestyle: 1 },
  ...over,
});

const rateFor = (price, purpose, query, hour = 12, id = 'vella') => effectiveConvRate({
  business: businessFor(pos(price, purpose), noCapex, 1),
  query,
  position: pos(price, purpose),
  advertiserId: id,
  hour,
});

describe('the conversion chain applies each factor exactly once (spec 12.1)', () => {
  test('a neutral query at a neutral hour is just the business rate times intent', () => {
    const business = businessFor(pos('mid', 'lifestyle'), noCapex, 1);
    expect(rateFor('mid', 'lifestyle', neutralQuery(), 12))
      .toBeCloseTo(business.convRateBase * HOURLY_INTENT_CURVE[12], 12);
  });

  test('the purpose modifier is NOT applied twice', () => {
    // Spec 12.1 lists both business.convRateBase and
    // PURPOSE_MODIFIERS[purpose].conv in the chain. But businessFor already
    // folds the purpose modifier into convRateBase - it has to, or the
    // break-even table in 4.4 would be wrong. Multiplying it again here would
    // be the L6 double-count in a new place.
    const raw = POSITION_ECONOMICS.lifestyle ?? POSITION_ECONOMICS.mid;
    const expected = raw.convRateBase * PURPOSE_MODIFIERS.lifestyle.conv * HOURLY_INTENT_CURVE[12];
    const doubled = expected * PURPOSE_MODIFIERS.lifestyle.conv;
    const actual = rateFor('mid', 'lifestyle', neutralQuery(), 12);
    expect(actual).toBeCloseTo(expected, 12);
    expect(actual).not.toBeCloseTo(doubled, 6);
  });

  test('query conversion multiplier scales it', () => {
    const base = rateFor('mid', 'performance', neutralQuery(), 12);
    const boosted = rateFor('mid', 'performance', neutralQuery({ convMultiplier: 1.4 }), 12);
    expect(boosted).toBeCloseTo(base * 1.4, 10);
  });

  test('price and purpose affinity both scale it', () => {
    const base = rateFor('premium', 'performance', neutralQuery(), 12);
    const fitted = rateFor('premium', 'performance', neutralQuery({
      priceAffinity: { value: 0.3, mid: 0.9, premium: 1.6 },
      purposeAffinity: { performance: 1.35, lifestyle: 0.65 },
    }), 12);
    expect(fitted).toBeCloseTo(base * 1.6 * 1.35, 10);
  });

  test('the hourly intent curve shapes it', () => {
    const q = neutralQuery();
    const peak = rateFor('mid', 'performance', q, 15);
    const trough = rateFor('mid', 'performance', q, 3);
    expect(peak).toBeGreaterThan(trough);
    expect(peak / trough).toBeCloseTo(HOURLY_INTENT_CURVE[15] / HOURLY_INTENT_CURVE[3], 10);
  });

  test('the same click is worth different amounts to different positions', () => {
    // A bargain hunter's query: the value brand converts, the premium one does
    // not, even though both could win the auction for it.
    const cheapQuery = neutralQuery({
      priceAffinity: { value: 1.6, mid: 0.9, premium: 0.3 },
      purposeAffinity: { performance: 1.35, lifestyle: 0.65 },
    });
    const value = rateFor('value', 'performance', cheapQuery);
    const premium = rateFor('premium', 'performance', cheapQuery);
    expect(value).toBeGreaterThan(premium * 4);
  });
});

describe('brandFactor', () => {
  test('a brand owner converts far better on its own name', () => {
    expect(brandFactor(neutralQuery({ intent: 'brand', brandOwner: 'vella' }), 'vella'))
      .toBe(BRAND_OWNER_MULTIPLIER);
  });

  test('a poacher converts badly on someone else name', () => {
    expect(brandFactor(neutralQuery({ intent: 'brand', brandOwner: 'kestrel' }), 'vella'))
      .toBe(BRAND_POACHER_MULTIPLIER);
  });

  test('brand bidding is legal, just poor: the poacher factor is not zero', () => {
    expect(BRAND_POACHER_MULTIPLIER).toBeGreaterThan(0);
  });

  test('informational traffic converts at a tenth of baseline', () => {
    expect(brandFactor(neutralQuery({ intent: 'informational' }), 'vella'))
      .toBe(INFORMATIONAL_CONV_MULTIPLIER);
  });

  test('irrelevant traffic converts at exactly zero, for everyone', () => {
    for (const id of ['vella', 'kestrel', 'nobody']) {
      expect(brandFactor(neutralQuery({ intent: 'irrelevant' }), id)).toBe(0);
    }
  });

  test('ordinary commercial traffic is unmodified', () => {
    expect(brandFactor(neutralQuery(), 'vella')).toBe(1);
  });
});

describe('the chain clamps at both ends', () => {
  test('irrelevant traffic really does yield zero, not the clamp floor', () => {
    // The floor is 0.001, but zero must survive it: that traffic never
    // converts, and the waste is the lesson.
    expect(rateFor('mid', 'performance', neutralQuery({ intent: 'irrelevant' }))).toBe(0);
  });

  test('a fully stacked best case is capped', () => {
    const stacked = neutralQuery({
      intent: 'brand',
      brandOwner: 'vella',
      convMultiplier: 1.4,
      priceAffinity: { value: 1.6, mid: 0.9, premium: 0.3 },
      purposeAffinity: { performance: 0.65, lifestyle: 1.35 },
    });
    expect(rateFor('value', 'lifestyle', stacked, 15)).toBe(CONV_RATE_CLAMP[1]);
  });

  test('a vanishingly small case is floored, not zeroed', () => {
    const awful = neutralQuery({
      convMultiplier: 0.001,
      priceAffinity: { value: 0.3, mid: 0.9, premium: 1.6 },
      purposeAffinity: { performance: 1.35, lifestyle: 0.65 },
    });
    const r = rateFor('value', 'performance', awful, 3);
    expect(r).toBe(CONV_RATE_CLAMP[0]);
    expect(r).toBeGreaterThan(0);
  });
});

describe('order value', () => {
  const business = businessFor(pos('mid', 'performance'), noCapex, 1);

  test('expected mode returns the mean, scaled by the query', () => {
    expect(sampleOrderValuePaise(business, neutralQuery({ valueMultiplier: 1.3 }), null, 'expected'))
      .toBe(Math.round(240000 * 1.3));
  });

  test('sampled mode varies but preserves the mean', () => {
    const rng = mulberry32(99);
    let total = 0;
    const n = 40000;
    for (let i = 0; i < n; i++) {
      total += sampleOrderValuePaise(business, neutralQuery(), rng, 'sampled');
    }
    expect((total / n) / 240000).toBeCloseTo(1, 1);
  });

  test('sampled order values are always positive integers', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 20000; i++) {
      const v = sampleOrderValuePaise(business, neutralQuery(), rng, 'sampled');
      expect(Number.isSafeInteger(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
    }
  });

  test('is the expected basket and the noise around it, in two steps the round can split', () => {
    const query = neutralQuery({ valueMultiplier: 1.3 });
    const base = expectedOrderValuePaise(business, query);
    expect(base).toBe(sampleOrderValuePaise(business, query, null, 'expected'));
    expect(orderValuePaise(base, business, null, 'expected')).toBe(base);
    const a = mulberry32(11);
    const b = mulberry32(11);
    for (let i = 0; i < 200; i++) {
      expect(orderValuePaise(base, business, a, 'sampled'))
        .toBe(sampleOrderValuePaise(business, query, b, 'sampled'));
    }
  });
});

describe('queueConversions — the attribution lag (spec 11.3)', () => {
  const args = {
    clicks: 1000, convRate: 0.03, orderValuePaise: 240000,
    returnRate: 0.24, round: 3, rng: null, mode: 'expected',
  };

  test('splits conversions across the lag distribution', () => {
    const queued = queueConversions(args);
    expect(queued).toHaveLength(ATTRIBUTION_LAG_DISTRIBUTION.length);
    for (const [lag, share] of ATTRIBUTION_LAG_DISTRIBUTION.entries()) {
      expect(queued[lag].dueRound).toBe(3 + lag);
      expect(queued[lag].count).toBeCloseTo(30 * share, 10);
    }
  });

  test('every entry remembers the round it was clicked in', () => {
    for (const e of queueConversions(args)) expect(e.clickedInRound).toBe(3);
  });

  test('the counts sum to the conversions the clicks earned', () => {
    const total = queueConversions(args).reduce((a, e) => a + e.count, 0);
    expect(total).toBeCloseTo(1000 * 0.03, 10);
  });

  test('most conversions land in the click round, but far from all', () => {
    // 45% arrive later. That lag is why a bid strategy looks broken when you
    // check it too early, and why an account cannot be judged on the round it
    // spent the money.
    expect(ATTRIBUTION_LAG_DISTRIBUTION[0]).toBeGreaterThan(0.5);
    expect(1 - ATTRIBUTION_LAG_DISTRIBUTION[0]).toBeGreaterThan(0.4);
  });

  test('it snapshots order value and return rate at click time (spec 4.5)', () => {
    // A repositioning must not retroactively change an order that was already
    // sold. The snapshot is what makes that impossible.
    const queued = queueConversions(args);
    for (const e of queued) {
      expect(e.returnRate).toBe(0.24);
      expect(e.valuePaise).toBe(Math.round(e.count * 240000));
    }
  });

  test('no conversions yields no queue entries', () => {
    expect(queueConversions({ ...args, convRate: 0 })).toEqual([]);
    expect(queueConversions({ ...args, clicks: 0 })).toEqual([]);
  });

  test('sampled mode adds noise scaling with the count', () => {
    const spread = (clicks) => {
      const rng = mulberry32(21);
      const totals = [];
      for (let i = 0; i < 3000; i++) {
        totals.push(queueConversions({ ...args, clicks, rng, mode: 'sampled' })
          .reduce((a, e) => a + e.count, 0));
      }
      const mean = totals.reduce((a, x) => a + x, 0) / totals.length;
      const variance = totals.reduce((a, x) => a + (x - mean) ** 2, 0) / totals.length;
      return Math.sqrt(variance) / mean;
    };
    // A thin query is violently noisy; a fat one is not. That difference is
    // what makes a premium account so much harder to read than a value one.
    expect(spread(100)).toBeGreaterThan(spread(10000) * 3);
  });

  test('sampled counts never go negative', () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 5000; i++) {
      const queued = queueConversions({ ...args, clicks: 20, rng, mode: 'sampled' });
      for (const e of queued) expect(e.count).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('landDueConversions', () => {
  const pending = [
    { clickedInRound: 1, dueRound: 2, count: 10, valuePaise: 2400000, returnRate: 0.24 },
    { clickedInRound: 1, dueRound: 4, count: 5, valuePaise: 1200000, returnRate: 0.24 },
    { clickedInRound: 3, dueRound: 4, count: 8, valuePaise: 1920000, returnRate: 0.24 },
  ];

  test('lands what is due and holds the rest back', () => {
    const { landed, remaining } = landDueConversions(pending, 2);
    expect(landed).toHaveLength(1);
    expect(landed[0].dueRound).toBe(2);
    expect(remaining).toHaveLength(2);
  });

  test('nothing lands before its round', () => {
    const { landed, remaining } = landDueConversions(pending, 1);
    expect(landed).toHaveLength(0);
    expect(remaining).toHaveLength(3);
  });

  test('everything has landed once the last due round passes', () => {
    const { landed, remaining } = landDueConversions(pending, 4);
    expect(landed).toHaveLength(3);
    expect(remaining).toHaveLength(0);
  });

  test('lands anything overdue rather than stranding it', () => {
    // Keeps a resumed or replayed game consistent: a queue entry can never be
    // left behind by a round that skipped past it.
    const { landed, remaining } = landDueConversions(pending, 99);
    expect(landed).toHaveLength(3);
    expect(remaining).toHaveLength(0);
  });

  test('landed entries still carry their click round, so reports can be revised', () => {
    // Round 4 lands orders clicked in rounds 1 and 3. Both of those earlier
    // reports get rewritten, which is spec 11.4's whole point.
    const { landed } = landDueConversions(pending, 4);
    expect([...new Set(landed.map((e) => e.clickedInRound))].sort()).toEqual([1, 3]);
  });

  test('it does not mutate the queue it was given (R1)', () => {
    const before = JSON.stringify(pending);
    landDueConversions(pending, 4);
    expect(JSON.stringify(pending)).toBe(before);
  });
});

describe('returns (spec 14)', () => {
  test('retention is one minus the return rate, scaled by the query', () => {
    const business = businessFor(pos('value', 'lifestyle'), noCapex, 1);
    expect(retentionRate(business, neutralQuery()))
      .toBeCloseTo(1 - business.returnRate, 10);
    expect(retentionRate(business, neutralQuery({ returnRateMultiplier: 1.2 })))
      .toBeLessThan(retentionRate(business, neutralQuery()));
  });

  test('the return rate is clamped so it can never exceed the ceiling', () => {
    const business = businessFor(pos('value', 'lifestyle'), noCapex, 1);
    const r = retentionRate(business, neutralQuery({ returnRateMultiplier: 99 }));
    expect(r).toBeCloseTo(1 - RETURN_RATE_CLAMP_MAX, 10);
    expect(r).toBeGreaterThan(0);
  });

  test('the purpose modifier is not applied twice here either', () => {
    const business = businessFor(pos('mid', 'lifestyle'), noCapex, 1);
    const expected = 1 - POSITION_ECONOMICS.mid.returnRate * PURPOSE_MODIFIERS.lifestyle.ret;
    expect(retentionRate(business, neutralQuery())).toBeCloseTo(expected, 10);
  });

  test('returns resolve returnWindowRounds after landing', () => {
    const landed = [{ clickedInRound: 1, dueRound: 3, count: 10, valuePaise: 2400000, returnRate: 0.24 }];
    const queued = queueReturns(landed, 3, 2);
    expect(queued[0].landedInRound).toBe(3);
    expect(queued[0].resolvesInRound).toBe(5);
  });

  test('the returned share matches the snapshotted rate', () => {
    const landed = [{ clickedInRound: 1, dueRound: 3, count: 10, valuePaise: 2400000, returnRate: 0.24 }];
    const [r] = queueReturns(landed, 3, 2);
    expect(r.count).toBeCloseTo(2.4, 10);
    expect(r.valuePaise).toBe(Math.round(2400000 * 0.24));
  });

  test('a snapshotted rate survives a change to the advertiser business', () => {
    // The advertiser repositioned, or a size guide went live. Orders already
    // sold return at the rate that applied when they were sold.
    const landed = [{ clickedInRound: 1, dueRound: 3, count: 10, valuePaise: 2400000, returnRate: 0.30 }];
    const [r] = queueReturns(landed, 3, 2);
    expect(r.count).toBeCloseTo(3.0, 10);
  });

  test('resolveReturns releases only what is due', () => {
    const pendingReturns = [
      { landedInRound: 3, resolvesInRound: 5, count: 2.4, valuePaise: 576000 },
      { landedInRound: 4, resolvesInRound: 6, count: 1.2, valuePaise: 288000 },
    ];
    const { resolved, remaining } = resolveReturns(pendingReturns, 5);
    expect(resolved).toHaveLength(1);
    expect(remaining).toHaveLength(1);
  });

  test('no returns at all when nothing comes back', () => {
    const landed = [{ clickedInRound: 1, dueRound: 3, count: 10, valuePaise: 2400000, returnRate: 0 }];
    expect(queueReturns(landed, 3, 2)).toEqual([]);
  });
});

describe('gross and net diverge by the return rate (spec 14)', () => {
  test('net revenue is gross minus what came back', () => {
    const landed = [
      { clickedInRound: 1, dueRound: 3, count: 10, valuePaise: 2400000, returnRate: 0.24 },
      { clickedInRound: 2, dueRound: 3, count: 5, valuePaise: 1200000, returnRate: 0.24 },
    ];
    const gross = summariseLanded(landed);
    const returned = summariseReturns(queueReturns(landed, 3, 2));

    expect(gross.conversions).toBe(15);
    expect(gross.grossRevenuePaise).toBe(3600000);
    expect(returned.returnedRevenuePaise).toBe(864000);
    expect(gross.grossRevenuePaise - returned.returnedRevenuePaise).toBe(2736000);
  });

  test('the gap is exactly the return rate', () => {
    const landed = [{ clickedInRound: 1, dueRound: 3, count: 100, valuePaise: 24000000, returnRate: 0.24 }];
    const gross = summariseLanded(landed).grossRevenuePaise;
    const net = gross - summariseReturns(queueReturns(landed, 3, 2)).returnedRevenuePaise;
    expect(net / gross).toBeCloseTo(0.76, 6);
  });

  test('a value-lifestyle brand loses more to returns than premium-performance', () => {
    // 46.5% against 36%. It was 36% against 17% — "far more", and the test was
    // named for it — until F14 set the level from the sourced constants, which
    // barely vary by price. What spread survives is the cash mix, which is
    // sourced, and the purpose modifier, which is not.
    const worst = businessFor(pos('value', 'lifestyle'), noCapex, 1);
    const best = businessFor(pos('premium', 'performance'), noCapex, 1);
    expect(retentionRate(worst, neutralQuery())).toBeLessThan(retentionRate(best, neutralQuery()));
    expect(1 - retentionRate(worst, neutralQuery())).toBeCloseTo(0.465, 2);
    expect(1 - retentionRate(best, neutralQuery())).toBeCloseTo(0.360, 2);
  });

  test('summaries return integer paise (R7)', () => {
    const landed = [{ clickedInRound: 1, dueRound: 3, count: 7.3, valuePaise: 1752000, returnRate: 0.24 }];
    expect(Number.isSafeInteger(summariseLanded(landed).grossRevenuePaise)).toBe(true);
    expect(Number.isSafeInteger(summariseReturns(queueReturns(landed, 3, 2)).returnedRevenuePaise)).toBe(true);
  });

  test('empty summaries are zero, not NaN', () => {
    expect(summariseLanded([])).toEqual({ conversions: 0, grossRevenuePaise: 0 });
    expect(summariseReturns([])).toEqual({ returnedConversions: 0, returnedRevenuePaise: 0 });
  });
});

describe('the full loop takes five rounds to settle', () => {
  test('a round-3 click can still be resolving in round 8', () => {
    // Lag up to 3 rounds, then a 2-round return window. A click in round 3 is
    // not finally scored until round 8, and clicks in rounds 10-12 never settle
    // before the game ends. The UI has to label unsettled figures as
    // provisional rather than showing them as final.
    const queued = queueConversions({
      clicks: 1000, convRate: 0.03, orderValuePaise: 240000,
      returnRate: 0.24, round: 3, rng: null, mode: 'expected',
    });
    const latest = Math.max(...queued.map((e) => e.dueRound));
    expect(latest).toBe(6);

    const { landed } = landDueConversions(queued, latest);
    const returns = queueReturns(landed, latest, 2);
    expect(Math.max(...returns.map((r) => r.resolvesInRound))).toBe(8);
  });
});

describe('purity (R1)', () => {
  test('the chain does not mutate its inputs', () => {
    const q = neutralQuery();
    const business = businessFor(pos('mid', 'performance'), noCapex, 1);
    const before = JSON.stringify([q, business]);
    effectiveConvRate({ business, query: q, position: pos('mid', 'performance'), advertiserId: 'v', hour: 12 });
    expect(JSON.stringify([q, business])).toBe(before);
  });

  test('repeated calls agree', () => {
    const q = neutralQuery();
    expect(rateFor('mid', 'performance', q)).toBe(rateFor('mid', 'performance', q));
  });
});
