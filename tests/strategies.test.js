import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  estimatedConvRate, predictionErrorSigma, effectiveBidPaise,
  daypartMultiplier, decrementLearning, STRATEGIES,
} from '../engine/strategies.js';
import { mulberry32 } from '../engine/rng.js';
import {
  SMART_BIDDING_MIN_CONVERSIONS, LEARNING_ERROR_MULTIPLIER, LEARNING_ROUNDS,
  COLD_START_CONV_RATE, MIN_HOUR_OBSERVATIONS, DAYPART_BLOCKS,
  MIN_BID_PAISE, MAX_BID_MULTIPLE, PREDICTION_ERROR_CLAMP,
} from '../engine/constants.js';

const bidding = (over = {}) => ({
  learningRoundsRemaining: 0,
  observedConvRate: 0.03,
  observedConversions: 100,
  observedByHour: null,
  ...over,
});

const business = { aovMeanPaise: 240000, marginPct: 0.52, convRateBase: 0.028, returnRate: 0.24 };
const keyword = { id: 'kw_1', text: 'gym leggings', matchType: 'phrase', bidPaise: 4000 };
const flat = [0, 0, 0, 0, 0, 0];

const bid = (strategy, over = {}) => effectiveBidPaise({
  strategy,
  strategyParams: { targetCpaPaise: 40000, targetRoas: 5.0 },
  keyword,
  business,
  bidding: bidding(),
  daypartAdjustments: flat,
  hour: 15,
  rng: null,
  ...over,
});

describe('the five strategies exist and are distinct', () => {
  test('all five are named', () => {
    expect(Object.keys(STRATEGIES).sort())
      .toEqual(['manual', 'maxClicks', 'maxConv', 'targetCpa', 'targetRoas']);
  });

  test('an unknown strategy throws rather than falling through to a default', () => {
    expect(() => bid('enhanced')).toThrow(/enhanced/);
  });

  test('maxConv is not merely maxClicks by another name', () => {
    // A v0.1 prototype bug: the two produced identical bids at every hour.
    const hourly = Array.from({ length: 24 }, () => ({ clicks: 200, conversions: 4 }));
    hourly[20] = { clicks: 200, conversions: 14 };
    const b = bidding({ observedByHour: hourly });
    expect(bid('maxConv', { bidding: b, hour: 20 }))
      .not.toBe(bid('maxClicks', { bidding: b, hour: 20 }));
  });
});

describe('predictionErrorSigma', () => {
  test('shrinks as observed conversions grow', () => {
    let prev = Infinity;
    for (const n of [1, 5, 15, 30, 80, 200, 600]) {
      const s = predictionErrorSigma(bidding({ observedConversions: n }));
      expect(s, `n=${n}`).toBeLessThan(prev);
      prev = s;
    }
  });

  test('is large below the smart bidding floor', () => {
    const below = predictionErrorSigma(bidding({ observedConversions: SMART_BIDDING_MIN_CONVERSIONS - 1 }));
    const well = predictionErrorSigma(bidding({ observedConversions: 400 }));
    expect(below).toBeGreaterThan(0.25);
    expect(below).toBeGreaterThan(well * 3);
  });

  test('a learning period multiplies it', () => {
    const calm = predictionErrorSigma(bidding({ learningRoundsRemaining: 0 }));
    const learning = predictionErrorSigma(bidding({ learningRoundsRemaining: 2 }));
    expect(learning).toBeCloseTo(Math.min(calm * LEARNING_ERROR_MULTIPLIER, PREDICTION_ERROR_CLAMP[1]), 10);
  });

  test('stays inside its clamp at both extremes', () => {
    const [lo, hi] = PREDICTION_ERROR_CLAMP;
    for (const n of [0, 1, 10, 1000, 100000]) {
      for (const learning of [0, 2]) {
        const s = predictionErrorSigma(bidding({ observedConversions: n, learningRoundsRemaining: learning }));
        expect(s).toBeGreaterThanOrEqual(lo);
        expect(s).toBeLessThanOrEqual(hi);
      }
    }
  });

  test('zero observed conversions is as uncertain as it gets', () => {
    expect(predictionErrorSigma(bidding({ observedConversions: 0 })))
      .toBe(PREDICTION_ERROR_CLAMP[1]);
  });
});

describe('estimatedConvRate never reads the truth (DECISIONS D2)', () => {
  test('it takes only the advertiser own history, the hour, and an rng', () => {
    // The signature IS the guarantee. Spec 12.2 passes a query as well, but a
    // query carries convMultiplier and the affinities - the truth - and
    // getPublicView withholds those from everyone (C4). A strategy that could
    // read them would be the v0.1 oracle wearing a different name.
    expect(estimatedConvRate.length).toBe(3);
  });

  test('the module never imports the conversion chain or position economics', () => {
    // Comments ARE stripped here, unlike the reportedScore guard in
    // quality.test.js. That one polices an exported binding, where a mention
    // in code is a real signal. This one polices a property name that the
    // module's header comment must be free to discuss - the explanation of why
    // a query never reaches a strategy is the most valuable prose in the file.
    const raw = readFileSync(fileURLToPath(new URL('../engine/strategies.js', import.meta.url)), 'utf8');
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const imports = src.match(/^import[\s\S]*?from\s*['"][^'"]+['"];/gm) ?? [];
    const joined = imports.join('\n');
    expect(/POSITION_ECONOMICS/.test(joined)).toBe(false);
    expect(/HOURLY_INTENT_CURVE/.test(joined)).toBe(false);
    expect(/priceAffinity|purposeAffinity/.test(src)).toBe(false);
    expect(/convMultiplier/.test(src)).toBe(false);
  });

  test('centres on observed history, not on any true rate', () => {
    const rng = mulberry32(1);
    const b = bidding({ observedConvRate: 0.05, observedConversions: 5000 });
    let total = 0;
    for (let i = 0; i < 20000; i++) total += estimatedConvRate(b, 15, rng);
    expect(total / 20000).toBeCloseTo(0.05, 3);
  });

  test('falls back to the cold start rate before anything is observed', () => {
    const b = bidding({ observedConvRate: null, observedConversions: 0 });
    expect(estimatedConvRate(b, 15, null)).toBeCloseTo(COLD_START_CONV_RATE, 10);
  });

  test('is deterministic without an rng, and reproducible with one', () => {
    const b = bidding();
    expect(estimatedConvRate(b, 15, null)).toBe(estimatedConvRate(b, 15, null));
    expect(estimatedConvRate(b, 15, mulberry32(7))).toBe(estimatedConvRate(b, 15, mulberry32(7)));
    expect(estimatedConvRate(b, 15, mulberry32(7))).not.toBe(estimatedConvRate(b, 15, mulberry32(8)));
  });

  test('never returns a negative or non-finite rate', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 20000; i++) {
      const r = estimatedConvRate(bidding({ observedConversions: 1 }), i % 24, rng);
      expect(Number.isFinite(r)).toBe(true);
      expect(r).toBeGreaterThan(0);
    }
  });
});

describe('hourly learning is earned, not given', () => {
  const hourly = () => {
    const h = Array.from({ length: 24 }, () => ({ clicks: 300, conversions: 6 })); // 2%
    h[20] = { clicks: 300, conversions: 21 }; // 7%
    return h;
  };

  test('an hour with enough of its own history overrides the aggregate', () => {
    const b = bidding({ observedByHour: hourly(), observedConvRate: 0.03 });
    expect(estimatedConvRate(b, 20, null)).toBeCloseTo(0.07, 10);
    expect(estimatedConvRate(b, 3, null)).toBeCloseTo(0.02, 10);
  });

  test('an hour with too little history falls back to the aggregate', () => {
    const h = hourly();
    h[20] = { clicks: MIN_HOUR_OBSERVATIONS - 1, conversions: 10 };
    const b = bidding({ observedByHour: h, observedConvRate: 0.03 });
    expect(estimatedConvRate(b, 20, null)).toBeCloseTo(0.03, 10);
  });

  test('with no hourly history at all, every hour reads the same', () => {
    const b = bidding({ observedByHour: null });
    const rates = Array.from({ length: 24 }, (_, h) => estimatedConvRate(b, h, null));
    expect(new Set(rates).size).toBe(1);
  });
});

describe('daypartMultiplier', () => {
  test('a flat schedule multiplies by one', () => {
    for (let h = 0; h < 24; h++) expect(daypartMultiplier(flat, h)).toBe(1);
  });

  test('an adjustment applies to its whole block and no other', () => {
    const adj = [0, 0, 0, 0, -50, 0]; // Evening, 17-21
    const evening = DAYPART_BLOCKS[4];
    for (let h = 0; h < 24; h++) {
      const inBlock = h >= evening.start && h < evening.end;
      expect(daypartMultiplier(adj, h), `hour ${h}`).toBe(inBlock ? 0.5 : 1);
    }
  });

  test('a positive adjustment raises the bid', () => {
    expect(daypartMultiplier([100, 0, 0, 0, 0, 0], 3)).toBe(2);
  });

  test('it cannot drive the multiplier negative', () => {
    expect(daypartMultiplier([-200, 0, 0, 0, 0, 0], 3)).toBe(0);
  });
});

describe('manual CPC', () => {
  test('bids what you set', () => {
    expect(bid('manual')).toBe(keyword.bidPaise);
  });

  test('respects dayparting', () => {
    expect(bid('manual', { daypartAdjustments: [0, 0, 0, 50, 0, 0], hour: 14 }))
      .toBe(Math.round(keyword.bidPaise * 1.5));
  });

  test('is unaffected by learning state', () => {
    // Manual never predicts conversions, which is exactly why it behaves
    // predictably on a thin account - and the player should discover that
    // rather than be told.
    expect(bid('manual', { bidding: bidding({ learningRoundsRemaining: 2 }) }))
      .toBe(bid('manual', { bidding: bidding({ learningRoundsRemaining: 0 }) }));
  });

  test('is unaffected by observed conversion history', () => {
    expect(bid('manual', { bidding: bidding({ observedConvRate: 0.001, observedConversions: 1 }) }))
      .toBe(bid('manual'));
  });

  test('and needs no rng at all', () => {
    expect(bid('manual', { rng: null })).toBe(keyword.bidPaise);
  });
});

describe('maxClicks', () => {
  test('bids above the keyword bid to win volume', () => {
    expect(bid('maxClicks')).toBeGreaterThan(keyword.bidPaise);
  });

  test('does not shape by hour: it never predicts conversions', () => {
    const hourly = Array.from({ length: 24 }, () => ({ clicks: 300, conversions: 6 }));
    hourly[20] = { clicks: 300, conversions: 30 };
    const b = bidding({ observedByHour: hourly });
    expect(bid('maxClicks', { bidding: b, hour: 20 })).toBe(bid('maxClicks', { bidding: b, hour: 3 }));
  });

  test('is unaffected by learning state', () => {
    expect(bid('maxClicks', { bidding: bidding({ learningRoundsRemaining: 2 }) }))
      .toBe(bid('maxClicks'));
  });
});

describe('targetCpa', () => {
  test('bids the target multiplied by the estimated conversion rate', () => {
    const b = bidding({ observedConvRate: 0.04, observedConversions: 500 });
    expect(bid('targetCpa', { bidding: b, rng: null })).toBe(Math.round(40000 * 0.04));
  });

  test('bids higher in hours its own history says convert better', () => {
    const hourly = Array.from({ length: 24 }, () => ({ clicks: 400, conversions: 8 }));
    hourly[20] = { clicks: 400, conversions: 32 };
    const b = bidding({ observedByHour: hourly });
    expect(bid('targetCpa', { bidding: b, hour: 20 }))
      .toBeGreaterThan(bid('targetCpa', { bidding: b, hour: 3 }));
  });

  test('a higher target buys a higher bid', () => {
    expect(bid('targetCpa', { strategyParams: { targetCpaPaise: 80000 } }))
      .toBeGreaterThan(bid('targetCpa', { strategyParams: { targetCpaPaise: 40000 } }));
  });

  test('a missing or non-positive target throws', () => {
    expect(() => bid('targetCpa', { strategyParams: {} })).toThrow(/targetCpa/i);
    expect(() => bid('targetCpa', { strategyParams: { targetCpaPaise: 0 } })).toThrow(/targetCpa/i);
  });
});

describe('targetRoas', () => {
  test('bids order value times conversion rate, divided by the target', () => {
    const b = bidding({ observedConvRate: 0.04, observedConversions: 500 });
    expect(bid('targetRoas', { bidding: b, rng: null }))
      .toBe(Math.round((240000 * 0.04) / 5.0));
  });

  test('a higher target demands a lower bid', () => {
    expect(bid('targetRoas', { strategyParams: { targetRoas: 10 } }))
      .toBeLessThan(bid('targetRoas', { strategyParams: { targetRoas: 3 } }));
  });

  test('a zero target throws instead of producing an infinite bid', () => {
    // The v0.1 prototype guarded this by silently substituting 1, which turns
    // a nonsensical setting into a plausible-looking bid. A zero ROAS target
    // means "spend without limit" and should fail loudly.
    expect(() => bid('targetRoas', { strategyParams: { targetRoas: 0 } })).toThrow(/targetRoas/i);
    expect(() => bid('targetRoas', { strategyParams: { targetRoas: -2 } })).toThrow(/targetRoas/i);
  });

  test('it uses its own order value, which an advertiser legitimately knows', () => {
    const rich = { ...business, aovMeanPaise: 480000 };
    expect(bid('targetRoas', { business: rich })).toBeGreaterThan(bid('targetRoas'));
  });
});

describe('the smart strategies degrade when the account is thin', () => {
  test('a thin account produces a wider spread of bids than a fat one', () => {
    const spread = (observedConversions) => {
      const rng = mulberry32(11);
      const b = bidding({ observedConversions });
      const bids = Array.from({ length: 4000 }, () => bid('targetCpa', { bidding: b, rng }));
      const mean = bids.reduce((a, x) => a + x, 0) / bids.length;
      const variance = bids.reduce((a, x) => a + (x - mean) ** 2, 0) / bids.length;
      return Math.sqrt(variance) / mean;
    };
    expect(spread(3)).toBeGreaterThan(spread(500) * 2);
  });

  test('a learning period widens it further', () => {
    const spread = (learningRoundsRemaining) => {
      const rng = mulberry32(13);
      const b = bidding({ observedConversions: 60, learningRoundsRemaining });
      const bids = Array.from({ length: 4000 }, () => bid('targetCpa', { bidding: b, rng }));
      const mean = bids.reduce((a, x) => a + x, 0) / bids.length;
      const variance = bids.reduce((a, x) => a + (x - mean) ** 2, 0) / bids.length;
      return Math.sqrt(variance) / mean;
    };
    expect(spread(2)).toBeGreaterThan(spread(0) * 1.5);
  });

  test('premium-shaped accounts stay uncertain longer than value-shaped ones', () => {
    // Premium generates roughly a sixth of Value's conversions on the same
    // budget, so its estimates are far noisier for far longer. Its
    // disadvantage is statistical, not economic (DECISIONS F7).
    const premium = predictionErrorSigma(bidding({ observedConversions: 25 }));
    const value = predictionErrorSigma(bidding({ observedConversions: 150 }));
    expect(premium / value).toBeGreaterThan(2);
  });
});

describe('every bid is well formed', () => {
  test('integer paise, always (R7)', () => {
    const rng = mulberry32(5);
    for (const strategy of Object.keys(STRATEGIES)) {
      for (let h = 0; h < 24; h++) {
        const v = bid(strategy, { hour: h, rng });
        expect(Number.isSafeInteger(v), `${strategy} @${h}`).toBe(true);
      }
    }
  });

  test('never below the floor nor above the ceiling', () => {
    const rng = mulberry32(6);
    for (const strategy of Object.keys(STRATEGIES)) {
      for (let i = 0; i < 500; i++) {
        const v = bid(strategy, {
          hour: i % 24,
          rng,
          bidding: bidding({ observedConvRate: 0.4, observedConversions: 1 }),
        });
        expect(v, strategy).toBeGreaterThanOrEqual(MIN_BID_PAISE);
        expect(v, strategy).toBeLessThanOrEqual(Math.round(keyword.bidPaise * MAX_BID_MULTIPLE));
      }
    }
  });

  test('a wild estimate cannot produce a wild bid', () => {
    const v = bid('targetCpa', {
      strategyParams: { targetCpaPaise: 10000000 },
      bidding: bidding({ observedConvRate: 0.9, observedConversions: 1 }),
    });
    expect(v).toBeLessThanOrEqual(Math.round(keyword.bidPaise * MAX_BID_MULTIPLE));
  });
});

describe('learning periods are set by the caller (L7)', () => {
  test('the engine only decrements', () => {
    expect(decrementLearning({ learningRoundsRemaining: 2 })).toEqual({ learningRoundsRemaining: 1 });
    expect(decrementLearning({ learningRoundsRemaining: 1 })).toEqual({ learningRoundsRemaining: 0 });
  });

  test('it never goes negative', () => {
    expect(decrementLearning({ learningRoundsRemaining: 0 }))
      .toEqual({ learningRoundsRemaining: 0 });
  });

  test('it never sets one', () => {
    // A pure function cannot detect that a setting changed. The caller diffs
    // the submitted decisions and writes the period; the engine only counts
    // it down.
    const src = readFileSync(fileURLToPath(new URL('../engine/strategies.js', import.meta.url)), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(/learningRoundsRemaining\s*=\s*LEARNING_ROUNDS/.test(src)).toBe(false);
    expect(LEARNING_ROUNDS).toBe(2);
  });

  test('decrementing does not mutate the bidding block it was given (R1)', () => {
    const b = { learningRoundsRemaining: 2, observedConversions: 10 };
    const before = JSON.stringify(b);
    decrementLearning(b);
    expect(JSON.stringify(b)).toBe(before);
  });
});

describe('purity (R1)', () => {
  test('bidding does not mutate its inputs', () => {
    const args = {
      strategy: 'targetCpa',
      strategyParams: { targetCpaPaise: 40000, targetRoas: 5 },
      keyword, business, bidding: bidding(), daypartAdjustments: flat, hour: 15, rng: null,
    };
    const before = JSON.stringify(args);
    effectiveBidPaise(args);
    expect(JSON.stringify(args)).toBe(before);
  });

  test('the same inputs give the same bid', () => {
    expect(bid('targetRoas')).toBe(bid('targetRoas'));
  });
});
