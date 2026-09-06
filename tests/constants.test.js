import { describe, test, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as C from '../engine/constants.js';
import { landingFactor } from '../engine/quality.js';
import { RIVAL_GRADE_VARIATION } from '../content/adCopy.js';

const sum = (a) => a.reduce((x, y) => x + y, 0);
const argmax = (a) => a.indexOf(Math.max(...a));

describe('distribution curves are normalised', () => {
  test('DAY_OF_WEEK_CURVE has 7 entries summing to 1', () => {
    expect(C.DAY_OF_WEEK_CURVE).toHaveLength(7);
    expect(sum(C.DAY_OF_WEEK_CURVE)).toBeCloseTo(1, 10);
  });

  test('every HOUR_PROFILES curve has 24 entries summing to 1', () => {
    for (const [name, curve] of Object.entries(C.HOUR_PROFILES)) {
      expect(curve, name).toHaveLength(24);
      expect(sum(curve), name).toBeCloseTo(1, 10);
    }
  });

  test('PACING_REFERENCE_CURVE has 24 entries summing to 1', () => {
    expect(C.PACING_REFERENCE_CURVE).toHaveLength(24);
    expect(sum(C.PACING_REFERENCE_CURVE)).toBeCloseTo(1, 10);
  });

  test('ATTRIBUTION_LAG_DISTRIBUTION sums to 1', () => {
    expect(sum(C.ATTRIBUTION_LAG_DISTRIBUTION)).toBeCloseTo(1, 10);
  });

  test('no curve contains a negative or non-finite value', () => {
    const curves = [
      C.DAY_OF_WEEK_CURVE, C.PACING_REFERENCE_CURVE, C.HOURLY_INTENT_CURVE,
      C.ATTRIBUTION_LAG_DISTRIBUTION, ...Object.values(C.HOUR_PROFILES),
    ];
    for (const curve of curves) {
      for (const v of curve) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('HOURLY_INTENT_CURVE is a multiplier, not a distribution', () => {
  test('it has 24 entries', () => {
    expect(C.HOURLY_INTENT_CURVE).toHaveLength(24);
  });

  test('its mean is exactly 1, so it reshapes without rescaling', () => {
    // If the mean drifted from 1 this curve would silently change the average
    // conversion rate, invalidating every break-even figure in spec 4.4.
    expect(sum(C.HOURLY_INTENT_CURVE) / 24).toBeCloseTo(1, 10);
  });
});

describe('I5 — demand peak and intent peak must not coincide', () => {
  test('the intent peak is at least 3 hours from every volume profile peak', () => {
    const intentPeak = argmax(C.HOURLY_INTENT_CURVE);
    for (const [name, curve] of Object.entries(C.HOUR_PROFILES)) {
      const volumePeak = argmax(curve);
      const raw = Math.abs(intentPeak - volumePeak);
      const circular = Math.min(raw, 24 - raw);
      expect(circular, `${name} peaks at ${volumePeak}, intent at ${intentPeak}`)
        .toBeGreaterThanOrEqual(C.MIN_PEAK_SEPARATION_HOURS);
    }
  });

  test('the intent peak is where the spec says it is (3pm)', () => {
    expect(argmax(C.HOURLY_INTENT_CURVE)).toBe(15);
  });
});

describe('budget constants', () => {
  test('RANK_BUDGET_MULTIPLIERS has one entry per advertiser', () => {
    expect(C.RANK_BUDGET_MULTIPLIERS).toHaveLength(C.ADVERTISER_COUNT);
  });

  test('rank multipliers sum to exactly the advertiser count', () => {
    // This is what keeps the month 3 pool identical to months 1 and 2. If it
    // drifts, total market money changes and CPCs move for reasons the player
    // cannot attribute to anything they did. See DECISIONS D5.
    expect(sum(C.RANK_BUDGET_MULTIPLIERS)).toBeCloseTo(C.ADVERTISER_COUNT, 10);
  });

  test('rank multipliers descend', () => {
    for (let i = 1; i < C.RANK_BUDGET_MULTIPLIERS.length; i++) {
      expect(C.RANK_BUDGET_MULTIPLIERS[i]).toBeLessThan(C.RANK_BUDGET_MULTIPLIERS[i - 1]);
    }
  });

  test('the month 3 pool equals months 1 and 2', () => {
    const pool = C.RANK_BUDGET_MULTIPLIERS
      .reduce((acc, m) => acc + Math.round(C.MONTHLY_BUDGET_PAISE * m), 0);
    expect(pool).toBe(C.ADVERTISER_COUNT * C.MONTHLY_BUDGET_PAISE);
  });

  test('monthly budget is ₹1,68,000 in paise', () => {
    expect(C.MONTHLY_BUDGET_PAISE).toBe(168000 * 100);
  });

  test('capex allocation and reposition cost are both ₹1,00,000', () => {
    expect(C.CAPEX_ALLOCATION_PAISE).toBe(100000 * 100);
    expect(C.REPOSITION_COST_PAISE).toBe(100000 * 100);
  });

  test('rounds divide evenly into months', () => {
    expect(C.TOTAL_ROUNDS % C.ROUNDS_PER_MONTH).toBe(0);
    expect(C.TOTAL_ROUNDS / C.ROUNDS_PER_MONTH).toBe(3);
  });
});

describe('CAPEX_TIER_CURVE is an S, not a diminishing curve', () => {
  test('committed amounts ascend and effects ascend with them', () => {
    for (let i = 1; i < C.CAPEX_TIER_CURVE.length; i++) {
      expect(C.CAPEX_TIER_CURVE[i].paise).toBeGreaterThan(C.CAPEX_TIER_CURVE[i - 1].paise);
      expect(C.CAPEX_TIER_CURVE[i].effect).toBeGreaterThan(C.CAPEX_TIER_CURVE[i - 1].effect);
    }
  });

  test('it starts at zero spend with no effect', () => {
    expect(C.CAPEX_TIER_CURVE[0]).toEqual({ paise: 0, effect: 1 });
  });

  test('the first tranche is NOT the most efficient', () => {
    // This is the whole point of the S. With a diminishing curve the cheapest
    // gain would always be the first tranche on a fresh target, splitting three
    // ways would be strictly optimal, and the amount choice would collapse.
    // See DECISIONS D7.
    const eff = [];
    for (let i = 1; i < C.CAPEX_TIER_CURVE.length; i++) {
      const dp = C.CAPEX_TIER_CURVE[i].paise - C.CAPEX_TIER_CURVE[i - 1].paise;
      const de = C.CAPEX_TIER_CURVE[i].effect - C.CAPEX_TIER_CURVE[i - 1].effect;
      eff.push(de / dp);
    }
    expect(eff[0]).toBeLessThan(Math.max(...eff));
  });

  test('efficiency rises then falls', () => {
    const eff = [];
    for (let i = 1; i < C.CAPEX_TIER_CURVE.length; i++) {
      const dp = C.CAPEX_TIER_CURVE[i].paise - C.CAPEX_TIER_CURVE[i - 1].paise;
      const de = C.CAPEX_TIER_CURVE[i].effect - C.CAPEX_TIER_CURVE[i - 1].effect;
      eff.push(de / dp);
    }
    const peak = eff.indexOf(Math.max(...eff));
    expect(peak).toBeGreaterThan(0);
    expect(peak).toBeLessThan(eff.length - 1);
  });

  test('the top tier costs exactly one capex allocation', () => {
    const top = C.CAPEX_TIER_CURVE[C.CAPEX_TIER_CURVE.length - 1];
    expect(top.paise).toBe(C.CAPEX_ALLOCATION_PAISE);
  });
});

describe('position economics', () => {
  test('all three price tiers are present with all six fields', () => {
    const fields = ['aovMeanPaise', 'marginPct', 'convRateBase', 'returnRate',
      'aovSpread', 'returnWindowRounds'];
    for (const tier of ['value', 'mid', 'premium']) {
      expect(C.POSITION_ECONOMICS[tier], tier).toBeDefined();
      for (const f of fields) {
        expect(C.POSITION_ECONOMICS[tier][f], `${tier}.${f}`).toBeTypeOf('number');
      }
    }
  });

  test('order value, margin and return rate move as the design says', () => {
    const { value, mid, premium } = C.POSITION_ECONOMICS;
    expect(value.aovMeanPaise).toBeLessThan(mid.aovMeanPaise);
    expect(mid.aovMeanPaise).toBeLessThan(premium.aovMeanPaise);
    expect(value.marginPct).toBeLessThan(premium.marginPct);
    expect(value.convRateBase).toBeGreaterThan(premium.convRateBase);
    expect(value.returnRate).toBeGreaterThan(premium.returnRate);
  });

  test('order values are integer paise (R7)', () => {
    for (const tier of Object.values(C.POSITION_ECONOMICS)) {
      expect(Number.isSafeInteger(tier.aovMeanPaise)).toBe(true);
    }
  });

  test('both purposes carry a conversion and a return modifier', () => {
    for (const p of ['performance', 'lifestyle']) {
      expect(C.PURPOSE_MODIFIERS[p].conv).toBeTypeOf('number');
      expect(C.PURPOSE_MODIFIERS[p].ret).toBeTypeOf('number');
    }
  });
});

describe('I4 — the axes stay in their lanes (spec 4.4)', () => {
  const breakEven = (price, purpose) => {
    const t = C.POSITION_ECONOMICS[price];
    const p = C.PURPOSE_MODIFIERS[purpose];
    const cr = t.convRateBase * p.conv;
    const ret = Math.min(t.returnRate * p.ret, 0.9);
    return t.aovMeanPaise * t.marginPct * (1 - ret) * cr;
  };

  test('the purpose axis moves break-even by under 15% within a price row', () => {
    for (const price of ['value', 'mid', 'premium']) {
      const a = breakEven(price, 'performance');
      const b = breakEven(price, 'lifestyle');
      const spread = Math.abs(b - a) / Math.min(a, b);
      expect(spread, `${price} purpose spread`).toBeLessThan(0.15);
    }
  });

  test('the price axis moves break-even by more than 2x top to bottom', () => {
    for (const purpose of ['performance', 'lifestyle']) {
      const ratio = breakEven('premium', purpose) / breakEven('value', purpose);
      expect(ratio, `${purpose} price ratio`).toBeGreaterThan(2);
    }
  });

  test('gross break-even always exceeds net, most sharply at the cheap end', () => {
    // PER CELL, not per row. This used to read POSITION_ECONOMICS alone and
    // never apply PURPOSE_MODIFIERS, so it checked the 43/32/25 figures that
    // DECISIONS F8 explicitly says are base-tier and that no advertiser
    // occupies. The real spread runs 20.5% at Premium-Performance to 56.3% at
    // Value-Lifestyle, and which cell you chose decides how badly section 14
    // hurts.
    const gap = (price, purpose) => {
      const t = C.POSITION_ECONOMICS[price];
      const m = C.PURPOSE_MODIFIERS[purpose];
      return 1 / (1 - t.returnRate * m.ret) - 1;
    };
    for (const purpose of ['performance', 'lifestyle']) {
      expect(gap('value', purpose), purpose).toBeGreaterThan(gap('mid', purpose));
      expect(gap('mid', purpose), purpose).toBeGreaterThan(gap('premium', purpose));
    }
    // Lifestyle is punished harder than performance in every row, because it
    // returns more, and that is the point of the F8 table.
    for (const price of ['value', 'mid', 'premium']) {
      expect(gap(price, 'lifestyle'), price).toBeGreaterThan(gap(price, 'performance'));
    }
    expect(gap('value', 'lifestyle')).toBeCloseTo(0.5625, 4);
    expect(gap('mid', 'performance')).toBeCloseTo(0.2563, 4);
  });
});

describe('RATING_TO_SCORE_TABLE', () => {
  const RATINGS = ['below', 'average', 'above'];

  test('covers all 27 combinations', () => {
    let count = 0;
    for (const a of RATINGS) {
      for (const b of RATINGS) {
        for (const c of RATINGS) {
          const score = C.RATING_TO_SCORE_TABLE[`${a}|${b}|${c}`];
          expect(score, `${a}|${b}|${c}`).toBeTypeOf('number');
          count++;
        }
      }
    }
    expect(count).toBe(27);
  });

  test('every score is an integer from 1 to 10', () => {
    for (const score of Object.values(C.RATING_TO_SCORE_TABLE)) {
      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(1);
      expect(score).toBeLessThanOrEqual(10);
    }
  });

  test('the extremes and the midpoint land where intended', () => {
    expect(C.RATING_TO_SCORE_TABLE['below|below|below']).toBe(1);
    expect(C.RATING_TO_SCORE_TABLE['average|average|average']).toBe(6);
    expect(C.RATING_TO_SCORE_TABLE['above|above|above']).toBe(10);
  });

  test('expected CTR carries more weight than the other two (DECISIONS A4)', () => {
    const liftCtr = C.RATING_TO_SCORE_TABLE['above|average|average'];
    const liftRel = C.RATING_TO_SCORE_TABLE['average|above|average'];
    const liftLp = C.RATING_TO_SCORE_TABLE['average|average|above'];
    expect(liftCtr).toBeGreaterThan(liftRel);
    expect(liftRel).toBe(liftLp);
  });

  test('improving any component never lowers the score', () => {
    const rank = { below: 0, average: 1, above: 2 };
    for (const a of RATINGS) {
      for (const b of RATINGS) {
        for (const c of RATINGS) {
          const base = C.RATING_TO_SCORE_TABLE[`${a}|${b}|${c}`];
          for (const [i, cur] of [a, b, c].entries()) {
            if (rank[cur] === 2) continue;
            const better = RATINGS[rank[cur] + 1];
            const parts = [a, b, c];
            parts[i] = better;
            expect(C.RATING_TO_SCORE_TABLE[parts.join('|')]).toBeGreaterThanOrEqual(base);
          }
        }
      }
    }
  });
});

describe('quality signal factor ranges (spec 9.1)', () => {
  test('each range is a valid ordered pair', () => {
    for (const [name, r] of Object.entries(C.QUALITY_FACTOR_RANGES)) {
      expect(r.min, name).toBeLessThan(r.max);
      expect(r.min, name).toBeGreaterThan(0);
    }
  });

  test('landing page compression is measured against a FIELD, not against min', () => {
    // This test used to assert `max / min > RATING_UPPER_THRESHOLD` and pass
    // while the thing it is named for was being described wrongly in three
    // documents. max/min compares the best possible advertiser to the WORST
    // possible one; `rate()` compares an advertiser to an impression-weighted
    // FIELD AVERAGE, which is never the minimum. It guarded a quantity no
    // auction computes - the same shape as the F11 defect, where I4 read
    // constants.js and measured something no auction experiences.
    //
    // Measured over 720 games (12 seeds x 6 cells x 10 grades, mode
    // 'expected'): 'above' occurs on 20.2% of contested keywords at grade 10
    // and 3.4% at grade 9, never at grade 8 or below; 'below' occurs on 88.6%
    // at grade 1 and never above grade 4. See DECISIONS A6.
    const { min, max } = C.QUALITY_FACTOR_RANGES.landingFactor;
    const field = (grade) => landingFactor(grade);
    const rosterMean = RIVAL_GRADE_VARIATION.slice(1)
      .reduce((t, g) => t + g.landingPage, 0) / (RIVAL_GRADE_VARIATION.length - 1);

    // 1. Against a field at the rival roster's MEAN landing grade, no player
    //    grade reaches 'above'. This is why grades 5-8 are indistinguishable.
    expect(max / field(rosterMean)).toBeLessThan(C.RATING_UPPER_THRESHOLD);

    // 2. Against a field at the roster's WEAKEST landing grade it is reachable,
    //    which is what makes 'reachable but narrow' true rather than decorative.
    const weakest = Math.min(...RIVAL_GRADE_VARIATION.slice(1).map((g) => g.landingPage));
    expect(max / field(weakest)).toBeGreaterThan(C.RATING_UPPER_THRESHOLD);

    // 3. The low end is reachable against the roster mean, so the scale is not
    //    one-sided: a bad landing page does read as bad.
    expect(min / field(rosterMean)).toBeLessThan(C.RATING_LOWER_THRESHOLD);
  });
});

describe('auction and slot constants', () => {
  test('there are fewer slots than advertisers, so rank competition can bite', () => {
    expect(C.MAX_SLOTS).toBeLessThan(C.ADVERTISER_COUNT);
  });

  test('top slots are a subset of all slots', () => {
    expect(C.TOP_SLOTS).toBeLessThan(C.MAX_SLOTS);
  });

  test('POSITION_CTR_MULTIPLIERS has one entry per slot and descends', () => {
    expect(C.POSITION_CTR_MULTIPLIERS).toHaveLength(C.MAX_SLOTS);
    expect(C.POSITION_CTR_MULTIPLIERS[0]).toBe(1);
    for (let i = 1; i < C.POSITION_CTR_MULTIPLIERS.length; i++) {
      expect(C.POSITION_CTR_MULTIPLIERS[i]).toBeLessThan(C.POSITION_CTR_MULTIPLIERS[i - 1]);
    }
  });

  test('the minimum bid increment is integer paise', () => {
    expect(Number.isSafeInteger(C.MIN_INCREMENT_PAISE)).toBe(true);
    expect(C.MIN_INCREMENT_PAISE).toBeGreaterThan(0);
  });
});

describe('dayparting', () => {
  test('blocks tile 0..24 with no gaps and no overlaps', () => {
    let cursor = 0;
    for (const b of C.DAYPART_BLOCKS) {
      expect(b.start).toBe(cursor);
      expect(b.end).toBeGreaterThan(b.start);
      cursor = b.end;
    }
    expect(cursor).toBe(24);
  });

  test('there are six blocks, matching daypartAdjustments in spec 5.2', () => {
    expect(C.DAYPART_BLOCKS).toHaveLength(6);
  });
});

describe('conversion chain bounds (spec 12.1)', () => {
  test('the clamp is an ordered pair inside (0, 1)', () => {
    const [lo, hi] = C.CONV_RATE_CLAMP;
    expect(lo).toBeGreaterThan(0);
    expect(lo).toBeLessThan(hi);
    expect(hi).toBeLessThan(1);
  });

  test('the fully stacked best case is clamped, not merely large', () => {
    // Value base, its best affinities, brand-owner boost, peak intent hour.
    // The affinity and multiplier maxima are the query set's real ceilings:
    // priceAffinity 1.6, purposeAffinity 1.35, convMultiplier 1.4. An earlier
    // version of this test stacked 1.6 x 1.3 and stopped there, which is not
    // the best case - it under-stacked by a third, and when PURPOSE_MODIFIERS
    // shrank to 0.94/1.06 the understatement fell below the clamp and the test
    // read as though the chain could no longer run away. It can.
    const stacked = C.POSITION_ECONOMICS.value.convRateBase
      * C.PURPOSE_MODIFIERS.lifestyle.conv
      * C.BRAND_OWNER_MULTIPLIER
      * Math.max(...C.HOURLY_INTENT_CURVE)
      * 1.6 * 1.35 * 1.4;
    expect(stacked).toBeGreaterThan(C.CONV_RATE_CLAMP[1]);
  });

  test('irrelevant traffic converts at exactly zero', () => {
    expect(C.IRRELEVANT_CONV_MULTIPLIER).toBe(0);
  });

  test('brand owners convert far better than poachers', () => {
    expect(C.BRAND_OWNER_MULTIPLIER).toBeGreaterThan(C.BRAND_POACHER_MULTIPLIER * 5);
  });
});

describe('rival placement constraints (spec 17.1)', () => {
  test('constraints are satisfiable by eight rivals over six cells', () => {
    const { minPriceTiers, requireBothPurposes, maxPerCell } = C.RIVAL_PLACEMENT_CONSTRAINTS;
    const cells = 3 * 2;
    expect(minPriceTiers).toBeGreaterThanOrEqual(2);
    expect(minPriceTiers).toBeLessThanOrEqual(3);
    expect(requireBothPurposes).toBe(true);
    expect(maxPerCell * cells).toBeGreaterThanOrEqual(C.ADVERTISER_COUNT - 1);
  });
});

describe('every constant is read by something (R4, hard rule 7)', () => {
  // The hole CAPEX_TARGETS came through.
  //
  // The provenance tests below check that every constant has a tag and every
  // tag has a constant - both directions of the LEDGER. Neither asks whether
  // any code consumes the number. So CAPEX_TARGETS sat in constants.js with a
  // provenance entry and a paragraph of justification, read by nothing at all,
  // not even a test. That is exactly the failure v0.3 deleted QUALITY_WEIGHTS
  // and EXTENSIONS_IMPACT for, recurring in a new place, and the file's own
  // header says "if a number leaves this file, delete its DECISIONS.md entry
  // too" while nothing checked whether it had ever arrived anywhere.

  const root = fileURLToPath(new URL('../', import.meta.url));
  const stripComments = (text) => text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });

  const read = (files) => files.map((f) => stripComments(readFileSync(f, 'utf8'))).join('\n');

  // Comments are stripped, so a constant merely DISCUSSED in prose does not
  // count as consumed. CAPEX_TARGETS is named in three comments.
  // Every root-level module, not a named list. game.js was named explicitly
  // when this guard was written and setup.js arrived a step later, invisible
  // to it - which is the same shape of hole the guard exists to close.
  const rootModules = readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.js') && !e.name.includes('config'))
    .map((e) => join(root, e.name));

  const SOURCE = read([
    ...walk(join(root, 'engine')).filter((f) => !f.endsWith('constants.js')),
    ...walk(join(root, 'content')),
    ...walk(join(root, 'agents')),
    ...rootModules,
  ]);
  const TESTS = read(walk(join(root, 'tests')));

  const exported = Object.keys(C).filter((k) => k === k.toUpperCase() && k !== 'PROVENANCE');
  const mentions = (text, name) => new RegExp(`\\b${name}\\b`).test(text);

  /**
   * Constants that only tests read, each with the reason.
   *
   * Two different things live here and it is worth keeping them apart.
   *
   * The first three are constants whose CONSUMER IS A TEST, legitimately and
   * permanently: an invariant's threshold belongs to the invariant, and an
   * invariant is a test. Those are not debt.
   *
   * The rest are debt - a number waiting for code that has not been written -
   * and each names what will consume it. An entry here is a promise, and the
   * third test below stops the promise being quietly forgotten.
   */
  const NOT_YET_CONSUMED = {
    LOCATION_VOLUME_BY_PRICE:
      'step 1 of the location mechanic: the numbers and their argument land '
      + 'before engine/locations.js reads them, so that the tables can be '
      + 'reviewed on their own. Remove when that module exists.',
    LOCATION_RETURN_MULTIPLIER:
      'as LOCATION_VOLUME_BY_PRICE.',
    LOCATION_AOV_MULTIPLIER:
      'as LOCATION_VOLUME_BY_PRICE.',
    MIN_PEAK_SEPARATION_HOURS:
      'invariant I5 IS a test (18.2), so its threshold belongs to one. Not debt.',
    SMART_BIDDING_MIN_CONVERSIONS:
      'names a milestone on a continuous curve rather than a branch in it - '
      + 'predictionErrorSigma falls with sqrt(n) and has no threshold. Spec 12.2 '
      + 'quotes it to say what "high error" means, and strategies.test.js checks '
      + 'the curve is still large there. Not debt.',
  };

  test('no constant is read by nothing at all', () => {
    const orphans = exported.filter((n) => !mentions(SOURCE, n) && !mentions(TESTS, n));
    expect(orphans, `read by nothing: ${orphans.join(', ')}`).toEqual([]);
  });

  test('every constant that only tests read is declared, with a reason', () => {
    const testOnly = exported.filter((n) => !mentions(SOURCE, n) && mentions(TESTS, n));
    const undeclared = testOnly.filter((n) => !(n in NOT_YET_CONSUMED));
    expect(undeclared, `test-only and undeclared: ${undeclared.join(', ')}`).toEqual([]);
  });

  test('and that list has no stale entries', () => {
    // The mirror of "PROVENANCE has no entries for constants that no longer
    // exist". When a constant finally gets a reader, its excuse must go.
    const stale = Object.keys(NOT_YET_CONSUMED).filter((n) => mentions(SOURCE, n));
    expect(stale, `now read by source, remove from the list: ${stale.join(', ')}`).toEqual([]);
  });
});

describe('provenance (R4, hard rule 7)', () => {
  test('every exported constant has a provenance tag', () => {
    const exported = Object.keys(C).filter(
      (k) => k !== 'PROVENANCE' && k === k.toUpperCase(),
    );
    const missing = exported.filter((k) => !(k in C.PROVENANCE));
    expect(missing, `untagged constants: ${missing.join(', ')}`).toEqual([]);
  });

  test('every tag is one of the four permitted values', () => {
    const allowed = ['DOCUMENTED', 'ESTIMATED', 'INVENTED', 'CALIBRATE'];
    for (const [name, tag] of Object.entries(C.PROVENANCE)) {
      expect(allowed, `${name} tagged ${tag}`).toContain(tag);
    }
  });

  test('PROVENANCE has no entries for constants that no longer exist', () => {
    const orphans = Object.keys(C.PROVENANCE).filter((k) => !(k in C));
    expect(orphans, `orphan ledger entries: ${orphans.join(', ')}`).toEqual([]);
  });

  test('the CALIBRATE set is the two the spec names, plus the location tables', () => {
    // WIDENING THIS WAS A DELIBERATE CALL, not a leak. Spec 18.1 names two
    // CALIBRATE constants and this test pinned the set at exactly those, which is
    // the right instinct: CALIBRATE means "provisional until a played game says
    // otherwise", and a growing list of provisional numbers is a project losing
    // its grip on its own model.
    //
    // The three location tables earn it on the same grounds AD_RANK_FLOOR does.
    // Nothing about them can be settled by argument: the metros are better per
    // click by construction, and whether tier 2 and 3 are worth having at all
    // depends on whether crowding makes the metros expensive - which is emergent
    // (H10) and therefore only observable in a played game. Tagging them
    // ESTIMATED would claim a confidence nobody has.
    //
    // If this list grows again, ask whether the thing being added is genuinely
    // unsettleable or merely unmeasured. See DECISIONS G4.
    const calibrate = Object.entries(C.PROVENANCE)
      .filter(([, tag]) => tag === 'CALIBRATE')
      .map(([name]) => name)
      .sort();
    expect(calibrate).toEqual([
      'AD_RANK_FLOOR',
      'LOCATION_AOV_MULTIPLIER',
      'LOCATION_RETURN_MULTIPLIER',
      'LOCATION_VOLUME_BY_PRICE',
      'WEEKLY_VOLUME',
    ]);
  });
});
