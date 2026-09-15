/**
 * The map's arithmetic (plans/2026-09-14-round-zero-redesign.md, sections 4 and 7).
 * The pulse is the data: a city rings as often as its kind of place is searched.
 */
import { describe, test, expect } from 'vitest';
import { briefing } from '../setup.js';
import { studioRule, studioToken, rgb, contrast } from './fixtures/studioCss.js';
import { QUERY_SET } from '../content/querySet.js';
import {
  sharesFor, pulsePeriods, pulseDelay, FASTEST_PULSE_S, dotFor, DOT_RADIUS,
} from '../ui/map/india.js';

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

  test('a ring is already ringing when the map is drawn, however often it is redrawn', () => {
    // Found by an animation audit (2026-09-14): with a positive delay every
    // redraw of the map (arriving, switching price level, tapping a place)
    // blanked all 32 rings, which came back one by one over up to 2.6 seconds.
    for (const period of [1.6, 3.52, 7.07]) {
      const delays = Array.from({ length: 12 }, (_, i) => pulseDelay(i, period));
      for (const d of delays) {
        expect(d, `period ${period}`).toBeLessThanOrEqual(0);
        expect(d, `period ${period}`).toBeGreaterThan(-period);
      }
      expect(new Set(delays.map((d) => d.toFixed(2))).size, 'a kind\'s cities still ring out of step')
        .toBeGreaterThan(1);
    }
  });
});

describe('a city\'s dot shows the bid there (Where and when, 2026-09-15)', () => {
  test('at an even bid, the dot round 0 draws', () => {
    expect(dotFor(1)).toEqual({ r: DOT_RADIUS, off: false });
  });

  test('its area grows with the bid, so twice the bid is twice the ink', () => {
    for (const multiplier of [0.5, 2, 4]) {
      expect((dotFor(multiplier).r / DOT_RADIUS) ** 2, `x${multiplier}`).toBeCloseTo(multiplier, 10);
    }
  });

  test('off is drawn hollow, not as nothing: the city is still eligible there', () => {
    const off = dotFor(0);
    expect(off.off).toBe(true);
    expect(off.r).toBeGreaterThan(0);
  });

  test('an off city can be made out on the land', () => {
    const land = rgb(studioRule('.r0-land', 'fill'));
    expect(contrast(rgb(studioRule('.r0-city.off', 'stroke')), land)).toBeGreaterThanOrEqual(3);
  });
});

describe('the map can be seen, not only read', () => {
  // Measured by script on the dev server (2026-09-14) and raised on the
  // owner's word: the coastline was 1.65:1 against the page and a dimmed city
  // 2.43:1 against the land, under the 3:1 a graphic needs to be made out
  // (WCAG 1.4.11). The colours are read from the stylesheet itself.
  const rule = studioRule;
  const page = rgb(studioToken('--studio-page'));
  const land = rgb(rule('.r0-land', 'fill'));

  test('the coastline stands out from the page', () => {
    expect(contrast(rgb(rule('.r0-land', 'stroke')), page)).toBeGreaterThanOrEqual(3);
  });

  test('a dimmed city can still be made out on the land', () => {
    const opacity = Number(rule('.r0-place.dim', 'opacity'));
    const city = rgb(rule('.r0-city', 'fill')).map((v, i) => v * opacity + land[i] * (1 - opacity));
    expect(contrast(city, land)).toBeGreaterThanOrEqual(3);
  });
});
