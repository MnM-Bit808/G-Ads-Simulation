import { describe, test, expect } from 'vitest';
import { mulberry32, hashString, deriveSeed, substream, normal } from '../engine/rng.js';

describe('mulberry32', () => {
  test('same seed produces the same sequence (R1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  test('different seeds produce different sequences', () => {
    const a = mulberry32(42);
    const b = mulberry32(43);
    expect(a()).not.toBe(b());
  });

  test('every draw lies in [0, 1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 10000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  test('the mean of many draws is close to 0.5', () => {
    const r = mulberry32(1);
    let sum = 0;
    const n = 100000;
    for (let i = 0; i < n; i++) sum += r();
    expect(Math.abs(sum / n - 0.5)).toBeLessThan(0.01);
  });
});

describe('hashString', () => {
  test('is deterministic', () => {
    expect(hashString('vella')).toBe(hashString('vella'));
  });

  test('distinguishes similar strings', () => {
    expect(hashString('vella')).not.toBe(hashString('vellb'));
    expect(hashString('kw_1')).not.toBe(hashString('kw_2'));
  });

  test('returns a non-negative 32-bit integer', () => {
    for (const s of ['', 'a', 'vella', 'q_017', 'gym leggings women']) {
      const h = hashString(s);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(2 ** 32);
    }
  });
});

describe('deriveSeed', () => {
  test('is deterministic across calls', () => {
    expect(deriveSeed(20260902, 'vella', 3)).toBe(deriveSeed(20260902, 'vella', 3));
  });

  test('order of parts matters', () => {
    expect(deriveSeed(1, 'a', 'b')).not.toBe(deriveSeed(1, 'b', 'a'));
  });

  test('a different root seed gives a different result', () => {
    expect(deriveSeed(1, 'vella')).not.toBe(deriveSeed(2, 'vella'));
  });

  test('mixes numbers and strings without collision', () => {
    expect(deriveSeed(1, 3)).not.toBe(deriveSeed(1, '3'));
  });
});

describe('substream (spec 9.2)', () => {
  test('each advertiser gets an independent stream', () => {
    const a = substream(20260902, 3, 'vella');
    const b = substream(20260902, 3, 'northgate');
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  test('an advertiser stream is reproducible', () => {
    const a = substream(20260902, 3, 'vella');
    const b = substream(20260902, 3, 'vella');
    expect(Array.from({ length: 10 }, () => a()))
      .toEqual(Array.from({ length: 10 }, () => b()));
  });

  test('a round change reshuffles every stream', () => {
    const r3 = substream(20260902, 3, 'vella');
    const r4 = substream(20260902, 4, 'vella');
    expect(r3()).not.toBe(r4());
  });

  test('one advertiser drawing does not disturb another (the point of 9.2)', () => {
    // Draw heavily from one stream, then confirm a second stream is unaffected.
    const noisy = substream(20260902, 3, 'northgate');
    for (let i = 0; i < 1000; i++) noisy();

    const quiet = substream(20260902, 3, 'vella');
    const fresh = substream(20260902, 3, 'vella');
    expect(quiet()).toBe(fresh());
  });
});

describe('normal', () => {
  test('is deterministic for a given stream', () => {
    const a = mulberry32(99);
    const b = mulberry32(99);
    expect(normal(a)).toBe(normal(b));
  });

  test('mean is near 0 and standard deviation near 1', () => {
    const r = mulberry32(5);
    const n = 200000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const v = normal(r);
      sum += v;
      sumSq += v * v;
    }
    const mean = sum / n;
    const sd = Math.sqrt(sumSq / n - mean * mean);
    expect(Math.abs(mean)).toBeLessThan(0.02);
    expect(Math.abs(sd - 1)).toBeLessThan(0.02);
  });

  test('never returns a non-finite value', () => {
    const r = mulberry32(11);
    for (let i = 0; i < 50000; i++) {
      expect(Number.isFinite(normal(r))).toBe(true);
    }
  });
});
