import { describe, test, expect } from 'vitest';
import { clamp, lerp, sum, mean } from '../engine/num.js';

describe('clamp', () => {
  test('bounds a value both ways', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  test('passes bounds through exactly', () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  test('works with fractional bounds, as the conversion chain needs', () => {
    expect(clamp(0.44, 0.001, 0.35)).toBe(0.35);
    expect(clamp(0.0001, 0.001, 0.35)).toBe(0.001);
  });
});

describe('lerp', () => {
  test('interpolates between two points', () => {
    expect(lerp(5, 0, 0, 10, 100)).toBe(50);
    expect(lerp(0, 0, 0, 10, 100)).toBe(0);
    expect(lerp(10, 0, 0, 10, 100)).toBe(100);
  });

  test('clamps outside the range rather than extrapolating', () => {
    // A capex commitment above the top tier must not keep buying effect.
    expect(lerp(20, 0, 0, 10, 100)).toBe(100);
    expect(lerp(-5, 0, 0, 10, 100)).toBe(0);
  });

  test('a zero-width range returns the first value instead of dividing by zero', () => {
    expect(lerp(5, 3, 42, 3, 99)).toBe(42);
  });

  test('reads a capex S-curve point correctly', () => {
    // Between the 25,00,000 and 55,00,000 paise tiers of CAPEX_TIER_CURVE.
    expect(lerp(4000000, 2500000, 1.04, 5500000, 1.16)).toBeCloseTo(1.10, 10);
  });
});

describe('sum', () => {
  test('adds up', () => {
    expect(sum([1, 2, 3])).toBe(6);
  });

  test('an empty array sums to zero', () => {
    expect(sum([])).toBe(0);
  });
});

describe('mean', () => {
  test('averages', () => {
    expect(mean([2, 4, 6])).toBe(4);
  });

  test('an empty array gives NaN, not zero', () => {
    // Returning zero would let an empty history read as a real measurement of
    // nothing, which is exactly the confusion the sim exists to prevent.
    expect(Number.isNaN(mean([]))).toBe(true);
  });
});
