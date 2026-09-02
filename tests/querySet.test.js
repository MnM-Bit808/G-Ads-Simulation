import { describe, test, expect } from 'vitest';
import {
  validateQuerySet, assertValidQuerySet, homeCell, RULES,
  searches, weeklySearches, daySearches, DAYS_PER_WEEK, HOURS_PER_DAY,
} from '../engine/querySet.js';
import { makeQuerySet, broken, TEST_ADVERTISER_IDS } from './fixtures/querySet.js';
import { PRICE_TIERS, PURPOSES, DAY_OF_WEEK_CURVE, HOUR_PROFILES } from '../engine/constants.js';
import { cellKey } from '../engine/positions.js';

const opts = { advertiserIds: TEST_ADVERTISER_IDS };
const rulesBroken = (qs) => validateQuerySet(qs, opts).errors.map((e) => e.rule);

describe('the fixture itself is valid', () => {
  test('a freshly built set passes every rule', () => {
    const result = validateQuerySet(makeQuerySet(), opts);
    expect(result.errors, JSON.stringify(result.errors, null, 2)).toEqual([]);
    expect(result.valid).toBe(true);
  });

  test('assertValidQuerySet does not throw on it', () => {
    expect(() => assertValidQuerySet(makeQuerySet(), opts)).not.toThrow();
  });
});

describe('homeCell', () => {
  test('a commercial query homes to its strongest price x purpose cell', () => {
    const qs = makeQuerySet();
    const q = qs.queries.find((x) => x.text.startsWith('premium lifestyle'));
    expect(homeCell(q)).toBe(cellKey('premium', 'lifestyle'));
  });

  test('every cell is someone\'s home in the fixture', () => {
    const qs = makeQuerySet();
    const homes = new Set(qs.queries.map(homeCell).filter(Boolean));
    for (const price of PRICE_TIERS) {
      for (const purpose of PURPOSES) {
        expect(homes.has(cellKey(price, purpose))).toBe(true);
      }
    }
  });

  test('non-commercial queries have no home cell: they are waste, not territory', () => {
    const qs = makeQuerySet();
    for (const q of qs.queries) {
      if (q.intent !== 'commercial') expect(homeCell(q)).toBeNull();
    }
  });

  test('is deterministic under ties, resolving to the first cell in order', () => {
    const flat = {
      intent: 'commercial',
      priceAffinity: { value: 1, mid: 1, premium: 1 },
      purposeAffinity: { performance: 1, lifestyle: 1 },
    };
    expect(homeCell(flat)).toBe(cellKey(PRICE_TIERS[0], PURPOSES[0]));
    expect(homeCell(flat)).toBe(homeCell(flat));
  });
});

describe('VOLUME_SHARE_SUM', () => {
  test('accepts a set summing to exactly 10000', () => {
    expect(rulesBroken(makeQuerySet())).not.toContain(RULES.VOLUME_SHARE_SUM);
  });

  test('rejects a set that is one basis point short', () => {
    const qs = broken(makeQuerySet(), (s) => { s.queries[0].volumeShareBp -= 1; });
    expect(rulesBroken(qs)).toContain(RULES.VOLUME_SHARE_SUM);
  });

  test('rejects a non-integer share: basis points exist to avoid float sums', () => {
    const qs = broken(makeQuerySet(), (s) => { s.queries[0].volumeShareBp = 12.5; });
    expect(rulesBroken(qs)).toContain(RULES.FIELD_SHAPE);
  });

  test('rejects a negative share', () => {
    const qs = broken(makeQuerySet(), (s) => {
      s.queries[0].volumeShareBp = -5;
      s.queries[1].volumeShareBp += 5;
    });
    expect(rulesBroken(qs)).toContain(RULES.FIELD_SHAPE);
  });
});

describe('DUPLICATE_TEXT', () => {
  test('rejects two queries with the same text', () => {
    const qs = broken(makeQuerySet(), (s) => { s.queries[1].text = s.queries[0].text; });
    expect(rulesBroken(qs)).toContain(RULES.DUPLICATE_TEXT);
  });

  test('comparison is case and whitespace insensitive', () => {
    const qs = broken(makeQuerySet(), (s) => {
      s.queries[1].text = `  ${s.queries[0].text.toUpperCase()}  `;
    });
    expect(rulesBroken(qs)).toContain(RULES.DUPLICATE_TEXT);
  });

  test('rejects duplicate ids too', () => {
    const qs = broken(makeQuerySet(), (s) => { s.queries[1].id = s.queries[0].id; });
    expect(rulesBroken(qs)).toContain(RULES.DUPLICATE_ID);
  });
});

describe('TAG_IN_VOCABULARY', () => {
  test('rejects a tag outside the vocabulary', () => {
    const qs = broken(makeQuerySet(), (s) => { s.queries[0].tags.push('not-a-real-tag'); });
    expect(rulesBroken(qs)).toContain(RULES.TAG_IN_VOCABULARY);
  });

  test('rejects a query with no tags: broad match would be inert', () => {
    const qs = broken(makeQuerySet(), (s) => { s.queries[0].tags = []; });
    expect(rulesBroken(qs)).toContain(RULES.TAG_PRESENT);
  });
});

describe('CELL_QUERY_COUNT', () => {
  test('accepts 15 per cell', () => {
    expect(rulesBroken(makeQuerySet({ perCell: 15 }))).not.toContain(RULES.CELL_QUERY_COUNT);
  });

  test('rejects a cell with too few queries', () => {
    const qs = makeQuerySet({ perCell: 10 });
    expect(rulesBroken(qs)).toContain(RULES.CELL_QUERY_COUNT);
  });

  test('names the offending cell so the failure is actionable', () => {
    const qs = makeQuerySet({ perCell: 10 });
    const err = validateQuerySet(qs, opts).errors.find((e) => e.rule === RULES.CELL_QUERY_COUNT);
    expect(err.message).toMatch(/value\|performance/);
  });
});

describe('HEAD_TERMS_PER_CELL', () => {
  test('rejects a cell with too few head terms', () => {
    const qs = makeQuerySet({ headTermsPerCell: 1 });
    expect(rulesBroken(qs)).toContain(RULES.HEAD_TERMS_PER_CELL);
  });

  test('rejects a set with no head terms at all', () => {
    const qs = broken(makeQuerySet(), (s) => {
      for (const q of s.queries) q.isHeadTerm = false;
    });
    expect(rulesBroken(qs)).toContain(RULES.HEAD_TERMS_PER_CELL);
  });
});

describe('IRRELEVANT_VOLUME', () => {
  test('accepts the fixture, which carries 6%', () => {
    expect(rulesBroken(makeQuerySet())).not.toContain(RULES.IRRELEVANT_VOLUME);
  });

  test('rejects a set with too little waste traffic', () => {
    // Broad match needs something worthless to reach. Without it the most
    // expensive lesson in the simulation cannot happen.
    const qs = broken(makeQuerySet(), (s) => {
      const irrelevant = s.queries.filter((q) => q.intent === 'irrelevant');
      let moved = 0;
      for (const q of irrelevant) { moved += q.volumeShareBp - 1; q.volumeShareBp = 1; }
      s.queries[0].volumeShareBp += moved;
    });
    expect(rulesBroken(qs)).toContain(RULES.IRRELEVANT_VOLUME);
  });
});

describe('TIER_VOLUME_SPLIT', () => {
  test('accepts 52/28/20 within tolerance', () => {
    expect(rulesBroken(makeQuerySet())).not.toContain(RULES.TIER_VOLUME_SPLIT);
  });

  test('rejects a set skewed away from the target split', () => {
    // Drain the premium tier into value. Premium's margin potential is 2.7x
    // Value's, so tier volumes must stay near 52/28/20 or the positions cannot
    // balance no matter what the economics say.
    const qs = broken(makeQuerySet(), (s) => {
      let moved = 0;
      for (const q of s.queries) {
        if (q.intent === 'commercial' && homeCell(q).startsWith('premium')) {
          moved += q.volumeShareBp - 1;
          q.volumeShareBp = 1;
        }
      }
      const target = s.queries.find(
        (q) => q.intent === 'commercial' && homeCell(q).startsWith('value'),
      );
      target.volumeShareBp += moved;
    });
    expect(rulesBroken(qs)).toContain(RULES.TIER_VOLUME_SPLIT);
  });
});

describe('CELL_VOLUME_SHARE', () => {
  test('rejects a cell starved of volume even when its query count is fine', () => {
    // Count and volume are separate failures: fifteen queries that nobody ever
    // searches is not a territory.
    const qs = broken(makeQuerySet(), (s) => {
      let moved = 0;
      for (const q of s.queries) {
        if (q.intent === 'commercial' && homeCell(q) === 'premium|lifestyle') {
          moved += q.volumeShareBp - 1;
          q.volumeShareBp = 1;
        }
      }
      const target = s.queries.find((q) => homeCell(q) === 'premium|performance');
      target.volumeShareBp += moved;
    });
    const broke = rulesBroken(qs);
    expect(broke).toContain(RULES.CELL_VOLUME_SHARE);
    expect(broke).not.toContain(RULES.CELL_QUERY_COUNT);
  });
});

describe('BRAND_COVERAGE', () => {
  test('rejects a set missing a brand query for one advertiser', () => {
    const qs = broken(makeQuerySet(), (s) => {
      const i = s.queries.findIndex((q) => q.brandOwner === 'vella');
      s.queries[i + 1].volumeShareBp += s.queries[i].volumeShareBp;
      s.queries.splice(i, 1);
    });
    expect(rulesBroken(qs)).toContain(RULES.BRAND_COVERAGE);
  });

  test('rejects a brand query naming an advertiser who does not exist', () => {
    const qs = broken(makeQuerySet(), (s) => {
      s.queries.find((q) => q.brandOwner === 'vella').brandOwner = 'ghostbrand';
    });
    expect(rulesBroken(qs)).toContain(RULES.BRAND_OWNER_UNKNOWN);
  });

  test('skips the check, with a warning, when no roster is supplied', () => {
    // The query set is generated and validated before positions are assigned,
    // but the advertiser roster does exist by then. If a caller omits it we
    // say so rather than silently passing.
    const result = validateQuerySet(makeQuerySet(), {});
    expect(result.errors.map((e) => e.rule)).not.toContain(RULES.BRAND_COVERAGE);
    expect(result.warnings.map((w) => w.rule)).toContain(RULES.BRAND_COVERAGE);
  });
});

describe('BRAND_OWNER_CONSISTENCY', () => {
  test('rejects intent brand with no owner', () => {
    const qs = broken(makeQuerySet(), (s) => {
      s.queries.find((q) => q.intent === 'brand').brandOwner = null;
    });
    expect(rulesBroken(qs)).toContain(RULES.BRAND_OWNER_CONSISTENCY);
  });

  test('rejects an owner on a non-brand query', () => {
    const qs = broken(makeQuerySet(), (s) => {
      s.queries.find((q) => q.intent === 'commercial').brandOwner = 'vella';
    });
    expect(rulesBroken(qs)).toContain(RULES.BRAND_OWNER_CONSISTENCY);
  });
});

describe('FIELD_SHAPE', () => {
  test('rejects an unknown intent', () => {
    const qs = broken(makeQuerySet(), (s) => { s.queries[0].intent = 'transactional'; });
    expect(rulesBroken(qs)).toContain(RULES.FIELD_SHAPE);
  });

  test('rejects an unknown hour profile', () => {
    const qs = broken(makeQuerySet(), (s) => { s.queries[0].hourProfile = 'nocturnal'; });
    expect(rulesBroken(qs)).toContain(RULES.FIELD_SHAPE);
  });

  test('rejects a missing price tier in priceAffinity', () => {
    const qs = broken(makeQuerySet(), (s) => { delete s.queries[0].priceAffinity.premium; });
    expect(rulesBroken(qs)).toContain(RULES.FIELD_SHAPE);
  });

  test('rejects a non-finite multiplier', () => {
    const qs = broken(makeQuerySet(), (s) => { s.queries[0].convMultiplier = Infinity; });
    expect(rulesBroken(qs)).toContain(RULES.FIELD_SHAPE);
  });

  test('rejects a negative affinity', () => {
    const qs = broken(makeQuerySet(), (s) => { s.queries[0].priceAffinity.value = -1; });
    expect(rulesBroken(qs)).toContain(RULES.FIELD_SHAPE);
  });

  test('rejects empty query text', () => {
    const qs = broken(makeQuerySet(), (s) => { s.queries[0].text = '   '; });
    expect(rulesBroken(qs)).toContain(RULES.FIELD_SHAPE);
  });
});

describe('SCHEMA_VERSION (L16)', () => {
  test('rejects an unknown schema version loudly', () => {
    const qs = broken(makeQuerySet(), (s) => { s.schemaVersion = '0.2'; });
    expect(rulesBroken(qs)).toContain(RULES.SCHEMA_VERSION);
  });

  test('rejects a missing schema version', () => {
    const qs = broken(makeQuerySet(), (s) => { delete s.schemaVersion; });
    expect(rulesBroken(qs)).toContain(RULES.SCHEMA_VERSION);
  });
});

describe('structural guards', () => {
  test('rejects a set with no queries', () => {
    const qs = broken(makeQuerySet(), (s) => { s.queries = []; });
    expect(validateQuerySet(qs, opts).valid).toBe(false);
  });

  test('rejects a missing tagVocabulary', () => {
    const qs = broken(makeQuerySet(), (s) => { delete s.tagVocabulary; });
    expect(rulesBroken(qs)).toContain(RULES.TAG_VOCABULARY_MISSING);
  });

  test('rejects a non-positive weeklyVolume', () => {
    const qs = broken(makeQuerySet(), (s) => { s.weeklyVolume = 0; });
    expect(rulesBroken(qs)).toContain(RULES.WEEKLY_VOLUME);
  });

  test('rejects null and non-objects without crashing', () => {
    for (const bad of [null, undefined, 42, 'querySet', []]) {
      expect(() => validateQuerySet(bad, opts)).not.toThrow();
      expect(validateQuerySet(bad, opts).valid).toBe(false);
    }
  });
});

describe('assertValidQuerySet throws loudly (spec 7.4)', () => {
  test('the message names every broken rule, not just the first', () => {
    const qs = broken(makeQuerySet(), (s) => {
      s.queries[0].volumeShareBp -= 1;
      s.queries[1].tags = [];
    });
    let message = '';
    try { assertValidQuerySet(qs, opts); } catch (e) { message = e.message; }
    expect(message).toContain(RULES.VOLUME_SHARE_SUM);
    expect(message).toContain(RULES.TAG_PRESENT);
  });

  test('the error carries the structured errors for programmatic use', () => {
    const qs = broken(makeQuerySet(), (s) => { s.queries[0].volumeShareBp -= 1; });
    try {
      assertValidQuerySet(qs, opts);
      throw new Error('should have thrown');
    } catch (e) {
      expect(Array.isArray(e.errors)).toBe(true);
      expect(e.errors[0]).toHaveProperty('rule');
      expect(e.errors[0]).toHaveProperty('message');
    }
  });
});

describe('validation is pure (R1)', () => {
  test('it does not mutate the set it is given', () => {
    const qs = makeQuerySet();
    const before = JSON.stringify(qs);
    validateQuerySet(qs, opts);
    expect(JSON.stringify(qs)).toBe(before);
  });

  test('repeated calls give identical results', () => {
    const qs = makeQuerySet();
    expect(validateQuerySet(qs, opts)).toEqual(validateQuerySet(qs, opts));
  });
});

// ===========================================================================
// Volume composition (spec 7.2)
// ===========================================================================

describe('searches — conservation', () => {
  test('the whole week across every query sums to exactly weeklyVolume', () => {
    // This is the L6 regression test. v0.1 applied a global hourly demand curve
    // AND a per-query hour profile, double-counting one against the other. If
    // any weighting is applied twice, or dropped, this total stops matching.
    const qs = makeQuerySet();
    let total = 0;
    for (const q of qs.queries) {
      for (let d = 0; d < DAYS_PER_WEEK; d++) {
        for (let h = 0; h < HOURS_PER_DAY; h++) total += searches(qs, q, d, h);
      }
    }
    expect(total / qs.weeklyVolume).toBeCloseTo(1, 9);
  });

  test('one query over a week equals its share of weeklyVolume', () => {
    const qs = makeQuerySet();
    const q = qs.queries[0];
    let total = 0;
    for (let d = 0; d < DAYS_PER_WEEK; d++) {
      for (let h = 0; h < HOURS_PER_DAY; h++) total += searches(qs, q, d, h);
    }
    const expected = (qs.weeklyVolume * q.volumeShareBp) / 10000;
    expect(total).toBeCloseTo(expected, 6);
  });

  test('weeklySearches agrees with summing hour by hour', () => {
    const qs = makeQuerySet();
    const q = qs.queries[5];
    let manual = 0;
    for (let d = 0; d < DAYS_PER_WEEK; d++) {
      for (let h = 0; h < HOURS_PER_DAY; h++) manual += searches(qs, q, d, h);
    }
    expect(weeklySearches(qs, q)).toBeCloseTo(manual, 6);
  });

  test('daySearches agrees with summing that day hour by hour', () => {
    const qs = makeQuerySet();
    const q = qs.queries[5];
    let manual = 0;
    for (let h = 0; h < HOURS_PER_DAY; h++) manual += searches(qs, q, 3, h);
    expect(daySearches(qs, q, 3)).toBeCloseTo(manual, 6);
  });

  test('the days of one query sum to its week', () => {
    const qs = makeQuerySet();
    const q = qs.queries[9];
    let total = 0;
    for (let d = 0; d < DAYS_PER_WEEK; d++) total += daySearches(qs, q, d);
    expect(total).toBeCloseTo(weeklySearches(qs, q), 6);
  });
});

describe('searches — each weighting applies exactly once', () => {
  test('the ratio between two days matches DAY_OF_WEEK_CURVE', () => {
    // If the day curve were applied twice the ratio would be squared.
    const qs = makeQuerySet();
    const q = qs.queries[0];
    const ratio = searches(qs, q, 5, 12) / searches(qs, q, 0, 12);
    expect(ratio).toBeCloseTo(DAY_OF_WEEK_CURVE[5] / DAY_OF_WEEK_CURVE[0], 10);
  });

  test('the ratio between two hours matches the query hour profile', () => {
    const qs = makeQuerySet();
    const q = qs.queries.find((x) => x.hourProfile === 'evening');
    const profile = HOUR_PROFILES.evening;
    const ratio = searches(qs, q, 0, 20) / searches(qs, q, 0, 3);
    expect(ratio).toBeCloseTo(profile[20] / profile[3], 10);
  });

  test('doubling a query share doubles its volume and nothing else', () => {
    const qs = makeQuerySet();
    const q = qs.queries[0];
    const before = searches(qs, q, 2, 14);
    const doubled = { ...q, volumeShareBp: q.volumeShareBp * 2 };
    expect(searches(qs, doubled, 2, 14)).toBeCloseTo(before * 2, 9);
  });
});

describe('searches — hour profiles actually differ', () => {
  test('a business query peaks late morning, an evening query peaks at night', () => {
    const qs = makeQuerySet();
    const business = qs.queries.find((x) => x.hourProfile === 'business');
    const evening = qs.queries.find((x) => x.hourProfile === 'evening');

    const peakHour = (q) => {
      let best = 0;
      for (let h = 1; h < HOURS_PER_DAY; h++) {
        if (searches(qs, q, 0, h) > searches(qs, q, 0, best)) best = h;
      }
      return best;
    };

    expect(peakHour(business)).toBe(11);
    expect(peakHour(evening)).toBe(20);
  });

  test('two queries with the same share but different profiles differ by hour', () => {
    const qs = makeQuerySet();
    const base = qs.queries[0];
    const a = { ...base, hourProfile: 'business' };
    const b = { ...base, hourProfile: 'evening' };
    expect(searches(qs, a, 0, 11)).toBeGreaterThan(searches(qs, b, 0, 11));
    expect(searches(qs, b, 0, 21)).toBeGreaterThan(searches(qs, a, 0, 21));
  });

  test('but they still carry the same weekly total', () => {
    // The profile reshapes when the searches happen, never how many there are.
    const qs = makeQuerySet();
    const base = qs.queries[0];
    const a = { ...base, hourProfile: 'business' };
    const b = { ...base, hourProfile: 'evening' };
    expect(weeklySearches(qs, a)).toBeCloseTo(weeklySearches(qs, b), 6);
  });
});

describe('searches — edges and guards', () => {
  test('a zero share yields no searches at any hour', () => {
    const qs = makeQuerySet();
    const q = { ...qs.queries[0], volumeShareBp: 0 };
    for (let h = 0; h < HOURS_PER_DAY; h++) expect(searches(qs, q, 0, h)).toBe(0);
  });

  test('every hour of every day is non-negative and finite', () => {
    const qs = makeQuerySet();
    for (const q of qs.queries) {
      for (let d = 0; d < DAYS_PER_WEEK; d++) {
        for (let h = 0; h < HOURS_PER_DAY; h++) {
          const v = searches(qs, q, d, h);
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  test('an out of range day or hour throws rather than returning a wrong number', () => {
    const qs = makeQuerySet();
    const q = qs.queries[0];
    expect(() => searches(qs, q, -1, 0)).toThrow();
    expect(() => searches(qs, q, DAYS_PER_WEEK, 0)).toThrow();
    expect(() => searches(qs, q, 0, -1)).toThrow();
    expect(() => searches(qs, q, 0, HOURS_PER_DAY)).toThrow();
    expect(() => searches(qs, q, 1.5, 0)).toThrow();
  });

  test('an unknown hour profile throws', () => {
    const qs = makeQuerySet();
    const q = { ...qs.queries[0], hourProfile: 'nocturnal' };
    expect(() => searches(qs, q, 0, 0)).toThrow(/nocturnal/);
  });
});

describe('searches — purity (R1)', () => {
  test('identical arguments give identical results', () => {
    const qs = makeQuerySet();
    const q = qs.queries[3];
    expect(searches(qs, q, 4, 17)).toBe(searches(qs, q, 4, 17));
  });

  test('it does not mutate the query or the set', () => {
    const qs = makeQuerySet();
    const before = JSON.stringify(qs);
    for (let h = 0; h < HOURS_PER_DAY; h++) searches(qs, qs.queries[0], 0, h);
    expect(JSON.stringify(qs)).toBe(before);
  });
});
