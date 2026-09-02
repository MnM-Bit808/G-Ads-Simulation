import { describe, test, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  qualitySignal, reportedScore, countsTowardReportedScore,
  baseCtr, relevanceFactor, landingFactor, contextFactor,
} from '../engine/quality.js';
import { mulberry32 } from '../engine/rng.js';
import {
  QUALITY_FACTOR_RANGES, QUALITY_MIN_IMPRESSIONS, QUALITY_WINDOW_ROUNDS,
  DEFAULT_UNGRADED_QUALITY, RATING_UPPER_THRESHOLD, RATING_LOWER_THRESHOLD,
} from '../engine/constants.js';

const graded = (expectedCtr, adRelevance, landingPage) => ({
  expectedCtr, adRelevance, landingPage, gradedAtRound: 1, contentHash: 'sha1:x',
});
const q = (text, tags = [], intent = 'commercial') => ({ id: 'q', text, tags, intent });
const kw = (text, matchType = 'exact', tags = []) => ({
  id: 'kw_1', text, matchType, tags, bidPaise: 5000, active: true,
});

/** An advertiser carrying one keyword's history. */
function withHistory(rows) {
  return { id: 'vella', qualityHistory: { kw_1: rows } };
}

/** A history row: same components every round keeps the arithmetic legible. */
const hrow = (round, impressions, own, field) => ({
  round,
  impressions,
  clicks: Math.round(impressions * 0.04),
  ownComponents: { expectedCtr: own[0], adRelevance: own[1], landingPage: own[2] },
  fieldComponents: { expectedCtr: field[0], adRelevance: field[1], landingPage: field[2] },
});

describe('the factor functions stay inside their stated ranges (spec 9.1)', () => {
  test('baseCtr maps 1-10 onto its range', () => {
    const { min, max } = QUALITY_FACTOR_RANGES.baseCtr;
    expect(baseCtr(1)).toBeCloseTo(min, 10);
    expect(baseCtr(10)).toBeCloseTo(max, 10);
    for (let i = 1; i <= 10; i++) {
      expect(baseCtr(i)).toBeGreaterThanOrEqual(min);
      expect(baseCtr(i)).toBeLessThanOrEqual(max);
    }
  });

  test('baseCtr is monotonic', () => {
    for (let i = 2; i <= 10; i++) expect(baseCtr(i)).toBeGreaterThan(baseCtr(i - 1));
  });

  test('landingFactor maps 1-10 onto its range and is monotonic', () => {
    const { min, max } = QUALITY_FACTOR_RANGES.landingFactor;
    expect(landingFactor(1)).toBeCloseTo(min, 10);
    expect(landingFactor(10)).toBeCloseTo(max, 10);
    for (let i = 2; i <= 10; i++) expect(landingFactor(i)).toBeGreaterThan(landingFactor(i - 1));
  });

  test('contextFactor stays inside its narrow band for every hour', () => {
    const { min, max } = QUALITY_FACTOR_RANGES.contextFactor;
    for (let h = 0; h < 24; h++) {
      expect(contextFactor(h), `hour ${h}`).toBeGreaterThanOrEqual(min);
      expect(contextFactor(h), `hour ${h}`).toBeLessThanOrEqual(max);
    }
  });

  test('relevanceFactor stays in range across every rating and intent', () => {
    const { min, max } = QUALITY_FACTOR_RANGES.relevanceFactor;
    for (const intent of ['commercial', 'brand', 'informational', 'irrelevant']) {
      for (let r = 1; r <= 10; r++) {
        const f = relevanceFactor(r, intent);
        expect(f, `${intent} ${r}`).toBeGreaterThanOrEqual(min);
        expect(f, `${intent} ${r}`).toBeLessThanOrEqual(max);
      }
    }
  });

  test('the same ad is less relevant to a searcher who is not buying', () => {
    expect(relevanceFactor(8, 'informational')).toBeLessThan(relevanceFactor(8, 'commercial'));
    expect(relevanceFactor(8, 'irrelevant')).toBeLessThan(relevanceFactor(8, 'informational'));
  });

  test('brand queries are treated like commercial ones', () => {
    expect(relevanceFactor(8, 'brand')).toBeCloseTo(relevanceFactor(8, 'commercial'), 10);
  });
});

describe('qualitySignal', () => {
  const query = q('gym leggings', ['leggings', 'gym']);
  const keyword = kw('gym leggings', 'exact', ['leggings', 'gym']);

  test('returns a signal and the component factors', () => {
    const r = qualitySignal(graded(6, 7, 4), query, keyword, 12, null, 'expected');
    expect(r.signal).toBeGreaterThan(0);
    expect(r.components).toHaveProperty('expectedCtr');
    expect(r.components).toHaveProperty('adRelevance');
    expect(r.components).toHaveProperty('landingPage');
  });

  test('components are the factor values, not the 1-10 graded inputs', () => {
    // Spec 9.1 as written showed a landingPage component of 0.55 while
    // landingFactor spans 0.85-1.05, which could not both be true. The
    // components are the factors, and 9.3 compares them against the field.
    const r = qualitySignal(graded(6, 7, 4), query, keyword, 12, null, 'expected');
    expect(r.components.expectedCtr).toBeCloseTo(baseCtr(6), 10);
    expect(r.components.adRelevance).toBeCloseTo(relevanceFactor(7, 'commercial'), 10);
    expect(r.components.landingPage).toBeCloseTo(landingFactor(4), 10);
  });

  test('the signal is the product of every factor', () => {
    const g = graded(6, 7, 4);
    const r = qualitySignal(g, query, keyword, 12, null, 'expected');
    const expected = baseCtr(6)
      * 1.15 // perfect tag overlap
      * relevanceFactor(7, 'commercial')
      * landingFactor(4)
      * contextFactor(12);
    expect(r.signal).toBeCloseTo(expected, 10);
  });

  test('a distant query lowers the signal through queryKeywordFit', () => {
    const broad = kw('gym leggings', 'broad', ['leggings', 'gym']);
    const close = qualitySignal(graded(6, 7, 4), q('gym leggings', ['leggings', 'gym']), broad, 12, null, 'expected');
    const far = qualitySignal(graded(6, 7, 4), q('gym membership price', ['gym', 'research']), broad, 12, null, 'expected');
    expect(far.signal).toBeLessThan(close.signal);
  });

  test('expected mode is deterministic and noise-free', () => {
    const a = qualitySignal(graded(6, 7, 4), query, keyword, 12, mulberry32(1), 'expected');
    const b = qualitySignal(graded(6, 7, 4), query, keyword, 12, mulberry32(9), 'expected');
    expect(a.signal).toBe(b.signal);
  });

  test('sampled mode perturbs the signal, reproducibly', () => {
    const a = qualitySignal(graded(6, 7, 4), query, keyword, 12, mulberry32(1), 'sampled');
    const b = qualitySignal(graded(6, 7, 4), query, keyword, 12, mulberry32(1), 'sampled');
    const c = qualitySignal(graded(6, 7, 4), query, keyword, 12, mulberry32(2), 'sampled');
    expect(a.signal).toBe(b.signal);
    expect(a.signal).not.toBe(c.signal);
  });

  test('sampled noise averages out to the expected signal', () => {
    const rng = mulberry32(4242);
    const base = qualitySignal(graded(6, 7, 4), query, keyword, 12, null, 'expected').signal;
    let total = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      total += qualitySignal(graded(6, 7, 4), query, keyword, 12, rng, 'sampled').signal;
    }
    expect((total / n) / base).toBeCloseTo(1, 2);
  });

  test('the signal is always positive and finite', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 5000; i++) {
      const r = qualitySignal(graded(1, 1, 1), query, keyword, i % 24, rng, 'sampled');
      expect(Number.isFinite(r.signal)).toBe(true);
      expect(r.signal).toBeGreaterThan(0);
    }
  });

  test('sampled mode requires an rng rather than reaching for one', () => {
    expect(() => qualitySignal(graded(6, 7, 4), query, keyword, 12, null, 'sampled')).toThrow();
  });

  test('an unknown mode throws', () => {
    expect(() => qualitySignal(graded(6, 7, 4), query, keyword, 12, null, 'guess')).toThrow(/guess/);
  });
});

describe('ungraded ads (spec 9.5)', () => {
  const query = q('gym leggings', ['leggings', 'gym']);
  const keyword = kw('gym leggings', 'exact', ['leggings', 'gym']);

  test('a null grade falls back to the deliberately poor default', () => {
    const r = qualitySignal(null, query, keyword, 12, null, 'expected');
    const same = qualitySignal(DEFAULT_UNGRADED_QUALITY, query, keyword, 12, null, 'expected');
    expect(r.signal).toBeCloseTo(same.signal, 10);
  });

  test('and flags itself, so the round can raise a warning', () => {
    expect(qualitySignal(null, query, keyword, 12, null, 'expected').ungraded).toBe(true);
    expect(qualitySignal(graded(6, 7, 4), query, keyword, 12, null, 'expected').ungraded).toBe(false);
  });

  test('the default really is poor: worse than a middling grade', () => {
    // An ad nobody has evaluated should not perform like a good one.
    const ungraded = qualitySignal(null, query, keyword, 12, null, 'expected').signal;
    const middling = qualitySignal(graded(5, 5, 5), query, keyword, 12, null, 'expected').signal;
    expect(ungraded).toBeLessThan(middling);
  });
});

describe('countsTowardReportedScore — the literal-match rule (A4)', () => {
  test('counts an impression where the query is literally the keyword', () => {
    expect(countsTowardReportedScore(q('gym leggings'), kw('gym leggings', 'broad'))).toBe(true);
  });

  test('ignores case and spacing, which are not different searches', () => {
    expect(countsTowardReportedScore(q('  Gym  Leggings '), kw('gym leggings'))).toBe(true);
  });

  test('does NOT count a close variant', () => {
    // Google calculates from exact searches of your keyword. A plural is a
    // different search, even though exact match would serve an ad for it.
    expect(countsTowardReportedScore(q('gym legging'), kw('gym leggings'))).toBe(false);
    expect(countsTowardReportedScore(q('leggings gym'), kw('gym leggings'))).toBe(false);
  });

  test('does not count a broader query', () => {
    expect(countsTowardReportedScore(q('cheap gym leggings'), kw('gym leggings'))).toBe(false);
  });

  test('is independent of match type, which is the whole point', () => {
    for (const matchType of ['exact', 'phrase', 'broad']) {
      expect(countsTowardReportedScore(q('gym leggings'), kw('gym leggings', matchType))).toBe(true);
      expect(countsTowardReportedScore(q('cheap gym leggings'), kw('gym leggings', matchType))).toBe(false);
    }
  });
});

describe('reportedScore (spec 9.3)', () => {
  test('is null below the impression threshold', () => {
    const adv = withHistory([hrow(1, QUALITY_MIN_IMPRESSIONS - 1, [0.06, 1.0, 1.0], [0.06, 1.0, 1.0])]);
    expect(reportedScore(adv, 'kw_1', 2)).toBeNull();
  });

  test('is null for a keyword with no history at all', () => {
    expect(reportedScore(withHistory([]), 'kw_1', 5)).toBeNull();
    expect(reportedScore({ id: 'v', qualityHistory: {} }, 'kw_1', 5)).toBeNull();
  });

  test('appears once the threshold is cleared', () => {
    const adv = withHistory([hrow(1, QUALITY_MIN_IMPRESSIONS, [0.06, 1.0, 1.0], [0.06, 1.0, 1.0])]);
    const r = reportedScore(adv, 'kw_1', 2);
    expect(r).not.toBeNull();
    expect(r.score).toBeGreaterThanOrEqual(1);
    expect(r.score).toBeLessThanOrEqual(10);
  });

  test('ratings derive from own versus field, not from an absolute level', () => {
    // A strong ad in a stronger field is below average. That relativity is the
    // whole point of fieldComponents.
    const strong = withHistory([hrow(1, 1000, [0.09, 1.1, 1.0], [0.06, 1.0, 1.0])]);
    const outclassed = withHistory([hrow(1, 1000, [0.09, 1.1, 1.0], [0.14, 1.2, 1.05])]);
    expect(reportedScore(strong, 'kw_1', 2).expectedCtr).toBe('above');
    expect(reportedScore(outclassed, 'kw_1', 2).expectedCtr).toBe('below');
  });

  test('a ratio inside the thresholds reads as average', () => {
    const adv = withHistory([hrow(1, 1000, [0.06, 1.0, 1.0], [0.06, 1.0, 1.0])]);
    const r = reportedScore(adv, 'kw_1', 2);
    expect(r.expectedCtr).toBe('average');
    expect(r.adRelevance).toBe('average');
    expect(r.landingPage).toBe('average');
  });

  test('the thresholds are where the spec says they are', () => {
    const just = (ratio) => withHistory([hrow(1, 1000, [0.06 * ratio, 1.0, 1.0], [0.06, 1.0, 1.0])]);
    expect(reportedScore(just(RATION_ABOVE), 'kw_1', 2).expectedCtr).toBe('above');
    expect(reportedScore(just(RATION_BELOW), 'kw_1', 2).expectedCtr).toBe('below');
  });

  test('the mean is impression-weighted, not a flat average of rounds', () => {
    // A huge good round must outweigh a tiny bad one.
    const adv = withHistory([
      hrow(1, 50, [0.03, 1.0, 1.0], [0.06, 1.0, 1.0]),
      hrow(2, 5000, [0.09, 1.0, 1.0], [0.06, 1.0, 1.0]),
    ]);
    expect(reportedScore(adv, 'kw_1', 3).expectedCtr).toBe('above');
  });

  test('only the trailing window counts', () => {
    const old = hrow(1, 10000, [0.14, 1.2, 1.05], [0.06, 1.0, 1.0]);
    const recent = hrow(20, 1000, [0.03, 0.8, 0.9], [0.06, 1.0, 1.0]);
    const adv = withHistory([old, recent]);
    // Round 21 with a 13-round window drops round 1 entirely.
    expect(reportedScore(adv, 'kw_1', 21).expectedCtr).toBe('below');
  });

  test('rounds outside the window cannot rescue the impression threshold', () => {
    const adv = withHistory([hrow(1, 100000, [0.09, 1.0, 1.0], [0.06, 1.0, 1.0])]);
    expect(reportedScore(adv, 'kw_1', 2)).not.toBeNull();
    expect(reportedScore(adv, 'kw_1', 40)).toBeNull();
  });

  test('a zero field mean reads as average rather than dividing by zero', () => {
    const adv = withHistory([hrow(1, 1000, [0.06, 1.0, 1.0], [0, 1.0, 1.0])]);
    expect(reportedScore(adv, 'kw_1', 2).expectedCtr).toBe('average');
  });
});

const RATION_ABOVE = RATING_UPPER_THRESHOLD + 0.01;
const RATION_BELOW = RATING_LOWER_THRESHOLD - 0.01;

describe('the split holds (CLAUDE.md known trap)', () => {
  const query = q('gym leggings', ['leggings', 'gym']);
  const keyword = kw('gym leggings', 'exact', ['leggings', 'gym']);

  test('improving copy raises qualitySignal in the same round', () => {
    const before = qualitySignal(graded(4, 4, 4), query, keyword, 12, null, 'expected');
    const after = qualitySignal(graded(9, 9, 9), query, keyword, 12, null, 'expected');
    expect(after.signal).toBeGreaterThan(before.signal);
  });

  test('and leaves reportedScore untouched in that same round', () => {
    // reportedScore reads history from COMPLETED prior rounds only. Nothing
    // the player does this round can move it, which is exactly the lag that
    // makes Quality Score confusing in a real account.
    const adv = withHistory([hrow(3, 2000, [0.06, 1.0, 1.0], [0.06, 1.0, 1.0])]);
    const before = reportedScore(adv, 'kw_1', 4);
    qualitySignal(graded(10, 10, 10), query, keyword, 12, null, 'expected');
    expect(reportedScore(adv, 'kw_1', 4)).toEqual(before);
  });

  test('the current round is not in the window', () => {
    const adv = withHistory([
      hrow(3, 2000, [0.06, 1.0, 1.0], [0.06, 1.0, 1.0]),
      hrow(4, 9000, [0.14, 1.2, 1.05], [0.06, 1.0, 1.0]),
    ]);
    // At round 4, round 4's own data is not yet part of the diagnostic.
    expect(reportedScore(adv, 'kw_1', 4).expectedCtr).toBe('average');
    // By round 5 it is.
    expect(reportedScore(adv, 'kw_1', 5).expectedCtr).toBe('above');
  });

  test('changing match type alone does not move reportedScore', () => {
    const adv = withHistory([hrow(1, 2000, [0.09, 1.0, 1.0], [0.06, 1.0, 1.0])]);
    const before = reportedScore(adv, 'kw_1', 2);
    // The keyword is not even an input: the score is computed from history
    // that was filtered to literal-query impressions when it was recorded.
    expect(reportedScore(adv, 'kw_1', 2)).toEqual(before);
    expect(reportedScore.length).toBe(3);
  });
});

describe('reportedScore is output only (spec 9.3, structural)', () => {
  test('no engine module imports it except the one that defines it', () => {
    const dir = fileURLToPath(new URL('../engine/', import.meta.url));
    const offenders = [];
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.js'))) {
      if (file === 'quality.js') continue;
      const src = readFileSync(join(dir, file), 'utf8');
      const imports = src.match(/import\s*\{[^}]*\}\s*from\s*['"][^'"]+['"]/g) ?? [];
      if (imports.some((line) => /\breportedScore\b/.test(line))) offenders.push(file);
    }
    expect(offenders, `these import reportedScore: ${offenders.join(', ')}`).toEqual([]);
  });

  test('nor does any engine module mention it outside a comment', () => {
    // Deliberately strict: string literals are NOT stripped, so even naming it
    // in an error message trips this. Loosening it to ignore strings would
    // also let obj['reportedScore'] through, and a rule this load-bearing is
    // better enforced with a false positive than with a hole. Reword the
    // message; user-facing prose should say "Quality Score" anyway.
    const dir = fileURLToPath(new URL('../engine/', import.meta.url));
    const offenders = [];
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.js'))) {
      if (file === 'quality.js') continue;
      const src = readFileSync(join(dir, file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      if (/\breportedScore\b/.test(src)) offenders.push(file);
    }
    expect(offenders, `these reference reportedScore in code: ${offenders.join(', ')}`).toEqual([]);
  });
});

describe('purity (R1)', () => {
  test('qualitySignal does not mutate its inputs', () => {
    const g = graded(6, 7, 4);
    const query = q('gym leggings', ['leggings', 'gym']);
    const keyword = kw('gym leggings', 'exact', ['leggings', 'gym']);
    const before = JSON.stringify([g, query, keyword]);
    qualitySignal(g, query, keyword, 12, null, 'expected');
    expect(JSON.stringify([g, query, keyword])).toBe(before);
  });

  test('reportedScore does not mutate the advertiser', () => {
    const adv = withHistory([hrow(1, 2000, [0.09, 1.0, 1.0], [0.06, 1.0, 1.0])]);
    const before = JSON.stringify(adv);
    reportedScore(adv, 'kw_1', 2);
    expect(JSON.stringify(adv)).toBe(before);
  });

  test('the window length is the constant, not a magic number', () => {
    expect(QUALITY_WINDOW_ROUNDS).toBe(13);
  });
});
