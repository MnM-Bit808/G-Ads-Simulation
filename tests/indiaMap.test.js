/**
 * The map's arithmetic (plans/2026-09-14-round-zero-redesign.md, sections 4 and 7).
 * The pulse is the data: a city rings as often as its kind of place is searched.
 */
import { describe, test, expect } from 'vitest';
import { briefing } from '../setup.js';
import { QUERY_SET } from '../content/querySet.js';
import { sharesFor, pulsePeriods, FASTEST_PULSE_S } from '../ui/map/india.js';

const brief = briefing(QUERY_SET);
const shares = (basis) => sharesFor(brief.locations, brief.weeklySearchesByTier, basis);

describe('whose searches the map shows', () => {
  test('all of them: each level\'s shares weighted by its searches, 20 / 36 / 44', () => {
    const all = shares('all');
    expect(all.tier1).toBeCloseTo(0.20, 2);
    expect(all.tier2).toBeCloseTo(0.36, 2);
    expect(all.tier3).toBeCloseTo(0.44, 2);
    expect(Object.values(all).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });

  test('one price level: the briefing\'s own shares, untouched', () => {
    for (const place of brief.locations) expect(shares('premium')[place.id]).toBe(place.shareOfSearches.premium);
  });
});

describe('the pulse is the share', () => {
  test('the busiest kind rings fastest, the others in proportion', () => {
    const s = shares('value');
    const periods = pulsePeriods(s);
    const busiest = Object.keys(s).reduce((a, b) => (s[a] >= s[b] ? a : b));
    expect(periods[busiest]).toBeCloseTo(FASTEST_PULSE_S, 10);
    for (const id of Object.keys(s)) expect(periods[id] * s[id]).toBeCloseTo(FASTEST_PULSE_S * s[busiest], 10);
  });

  test('a kind of place nobody searches does not ring', () => {
    expect(pulsePeriods({ a: 0.5, b: 0 }).b).toBeNull();
  });
});
