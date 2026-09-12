import { describe, test, expect } from 'vitest';
import { parseTrends, januaryLifts } from '../scripts/season-lift.js';

/**
 * The January surge is sized from Google Trends exports, read by
 * scripts/season-lift.js (plans/2026-09-13-january-surge.md, section 6).
 *
 * The method was fixed before any file was read, so these tests pin it on data
 * whose answer is known: a baseline of 50 in November and December and chosen
 * values in January. If the mapping from Trends weeks to game weeks ever
 * slips by one, the lifts come out wrong here before they reach a constant.
 */

const WEEK_ONE = { month: 11, day: 6 };
const DAY = 86400000;

/** Weekly rows from a Sunday, valued by the midpoint of each week. */
function synthetic(fromIso, weeks, valueFor) {
  const rows = [];
  for (let i = 0; i < weeks; i++) {
    const t = Date.parse(`${fromIso}T00:00:00Z`) + i * 7 * DAY;
    rows.push({ start: new Date(t).toISOString().slice(0, 10), value: valueFor(t + 3 * DAY) });
  }
  return rows;
}

describe('reading a Trends export (plans/2026-09-13-january-surge.md, section 6)', () => {
  test('parses the weekly rows and nothing else', () => {
    const text = 'Category: All categories\n\nWeek,gym leggings: (India)\n2021-09-19,45\n2021-09-26,<1\n';
    expect(parseTrends(text)).toEqual([
      { start: '2021-09-19', value: 45 },
      { start: '2021-09-26', value: 0.5 },
    ]);
  });

  test('January over November-December, per game week, median over years', () => {
    // 50 in the baseline weeks, then 75, 70, 60 and 55 in weeks 9-12, every year.
    const lifted = [75, 70, 60, 55];
    const valueFor = (mid) => {
      const d = new Date(mid);
      const year = d.getUTCMonth() === 0 ? d.getUTCFullYear() - 1 : d.getUTCFullYear();
      const start = Date.UTC(year, 10, 6);
      const week = Math.floor((mid - start) / (7 * DAY)) + 1;
      if (week >= 1 && week <= 8) return 50;
      if (week >= 9 && week <= 12) return lifted[week - 9];
      return 10;
    };
    const rows = synthetic('2020-01-05', 52 * 3, valueFor);
    const out = januaryLifts(rows, WEEK_ONE);
    expect(out.years).toEqual([2020, 2021]);
    expect(out.lifts.map((x) => Number(x.toFixed(2)))).toEqual([1.5, 1.4, 1.2, 1.1]);
  });

  test('a year with a missing week is left out rather than half-read', () => {
    const rows = synthetic('2020-10-04', 20, () => 50).filter((r) => r.start !== '2020-12-06');
    expect(januaryLifts(rows, WEEK_ONE).years).toEqual([]);
  });
});
