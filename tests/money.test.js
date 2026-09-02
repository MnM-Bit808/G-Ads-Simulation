import { describe, test, expect } from 'vitest';
import {
  rupeesToPaise, paiseToRupees, formatINR,
  mulRate, allocate, sumPaise, isPaise, assertPaise,
} from '../engine/money.js';

describe('paise conversion', () => {
  test('rupees convert to integer paise', () => {
    expect(rupeesToPaise(1)).toBe(100);
    expect(rupeesToPaise(168000)).toBe(16800000);
    expect(rupeesToPaise(0)).toBe(0);
  });

  test('fractional rupees round to the nearest paisa', () => {
    expect(rupeesToPaise(1.005)).toBe(101);   // 100.5 -> 101, half up
    expect(rupeesToPaise(1.004)).toBe(100);
  });

  test('paise convert back to rupees for display only', () => {
    expect(paiseToRupees(16800000)).toBe(168000);
    expect(paiseToRupees(150)).toBe(1.5);
  });
});

describe('isPaise / assertPaise', () => {
  test('accepts safe integers', () => {
    expect(isPaise(0)).toBe(true);
    expect(isPaise(-500)).toBe(true);          // profit may be negative
    expect(isPaise(16800000)).toBe(true);
  });

  test('rejects floats, NaN and Infinity (R7)', () => {
    expect(isPaise(1.5)).toBe(false);
    expect(isPaise(NaN)).toBe(false);
    expect(isPaise(Infinity)).toBe(false);
    expect(isPaise(-Infinity)).toBe(false);
    expect(isPaise('100')).toBe(false);
  });

  test('assertPaise throws on anything that is not integer paise', () => {
    expect(() => assertPaise(1.5)).toThrow();
    expect(() => assertPaise(Infinity)).toThrow();
    expect(() => assertPaise(100)).not.toThrow();
  });
});

describe('mulRate', () => {
  test('multiplying money by a rate returns integer paise', () => {
    expect(mulRate(1000, 0.5)).toBe(500);
    expect(mulRate(16800000, 0.25)).toBe(4200000);
  });

  test('rounds half up', () => {
    expect(mulRate(1001, 0.5)).toBe(501);      // 500.5 -> 501
    expect(mulRate(999, 0.5)).toBe(500);       // 499.5 -> 500
  });

  test('survives floating point representation error', () => {
    // 100000 * 0.07 is 7000.000000000001 in IEEE 754
    expect(mulRate(100000, 0.07)).toBe(7000);
  });

  test('rejects non-finite rates rather than producing Infinity (R7)', () => {
    expect(() => mulRate(1000, Infinity)).toThrow();
    expect(() => mulRate(1000, NaN)).toThrow();
  });

  test('a rate of zero yields zero, not a rounding artefact', () => {
    expect(mulRate(999999, 0)).toBe(0);
  });
});

describe('allocate', () => {
  test('parts sum to exactly the total, with no drift', () => {
    const parts = allocate(100, [1, 1, 1]);
    expect(sumPaise(parts)).toBe(100);
    expect(parts).toEqual([34, 33, 33]);
  });

  test('the monthly budget splits across four weeks without losing a paisa', () => {
    const parts = allocate(16800000, [1, 1, 1, 1]);
    expect(sumPaise(parts)).toBe(16800000);
    expect(parts).toEqual([4200000, 4200000, 4200000, 4200000]);
  });

  test('uneven weights still sum exactly', () => {
    const parts = allocate(1000, [5, 3, 2]);
    expect(sumPaise(parts)).toBe(1000);
    expect(parts).toEqual([500, 300, 200]);
  });

  test('remainder goes to the largest fractional parts, ties by index', () => {
    // 10 across 3 equal weights: exact 3.333 each, floors 3,3,3, remainder 1.
    // All fractions equal, so the first index wins the tie.
    expect(allocate(10, [1, 1, 1])).toEqual([4, 3, 3]);
  });

  test('is deterministic: identical inputs give identical output (R1)', () => {
    const a = allocate(999983, [7, 11, 13, 3]);
    const b = allocate(999983, [7, 11, 13, 3]);
    expect(a).toEqual(b);
  });

  test('no part is ever negative for a non-negative total', () => {
    const parts = allocate(7, [1, 1, 1, 1, 1]);
    expect(parts.every((p) => p >= 0)).toBe(true);
    expect(sumPaise(parts)).toBe(7);
  });

  test('a zero weight receives nothing', () => {
    expect(allocate(100, [1, 0, 1])).toEqual([50, 0, 50]);
  });

  test('rejects a total that is not integer paise', () => {
    expect(() => allocate(100.5, [1, 1])).toThrow();
  });

  test('rejects weights that sum to zero', () => {
    expect(() => allocate(100, [0, 0])).toThrow();
  });

  test('rejects negative weights', () => {
    expect(() => allocate(100, [1, -1])).toThrow();
  });

  test('rejects a negative total: largest-remainder is defined for non-negative splits', () => {
    expect(() => allocate(-100, [1, 1])).toThrow();
  });

  test('fuzz: 500 random splits always conserve the total exactly', () => {
    let seed = 12345;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let i = 0; i < 500; i++) {
      const total = Math.floor(next() * 10000000);
      const n = 2 + Math.floor(next() * 8);
      const weights = Array.from({ length: n }, () => next() * 10);
      const parts = allocate(total, weights);
      expect(sumPaise(parts)).toBe(total);
      expect(parts.every(isPaise)).toBe(true);
    }
  });
});

describe('sumPaise', () => {
  test('sums integers', () => {
    expect(sumPaise([1, 2, 3])).toBe(6);
    expect(sumPaise([])).toBe(0);
  });

  test('throws if any element is not integer paise', () => {
    expect(() => sumPaise([1, 2.5])).toThrow();
  });
});

describe('formatINR', () => {
  test('groups digits the Indian way: lakh and crore', () => {
    expect(formatINR(16800000)).toBe('₹1,68,000');
    expect(formatINR(100000000)).toBe('₹10,00,000');
    expect(formatINR(100000)).toBe('₹1,000');
  });

  test('shows paise when asked', () => {
    expect(formatINR(2656, { decimals: 2 })).toBe('₹26.56');
  });

  test('handles zero and negatives', () => {
    expect(formatINR(0)).toBe('₹0');
    expect(formatINR(-50000)).toBe('-₹500');
  });
});

