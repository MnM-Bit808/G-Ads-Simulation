/**
 * India, with the three kinds of place on it (DECISIONS G4): round 0's step 1
 * now, and the Where and when control later (plans/2026-09-14-round-zero-redesign.md,
 * section 8). Display geography only: nothing in engine/ reads a city, and the
 * model knows three kinds of place, not cities, so every city of a kind rings
 * at that kind's rate.
 *
 * THE PULSE CARRIES THE DATA, and it is the one motion the makeover's six do
 * not include (the spec's section 7): a city rings as often as its kind of
 * place is searched, for the price level shown. Transform and opacity only,
 * none at all under reduced motion (ui/studio.css), and it runs only while the
 * map is on the page: leaving step 1 removes it.
 */

import { MAP_VIEWBOX, INDIA_PATH, CITY_POINTS, BACKDROP, labelPlace } from '../india-map.js';

/** The busiest kind of place rings once every this many seconds. */
export const FASTEST_PULSE_S = 1.6;

const NS = 'http://www.w3.org/2000/svg';

/**
 * Each kind of place's share of searches, for one price level or for all.
 * 'all' weights each level's shares by its searches a week: both are the
 * briefing's public figures (17.2), so it tells the player nothing withheld.
 *
 * @param {object[]} locations - `briefing(querySet).locations`
 * @param {Record<string, number>} weeklySearchesByTier - `briefing(querySet).weeklySearchesByTier`
 * @param {'all'|'value'|'mid'|'premium'} basis
 * @returns {Record<string, number>} share by location id
 */
export function sharesFor(locations, weeklySearchesByTier, basis) {
  if (basis !== 'all') return Object.fromEntries(locations.map((p) => [p.id, p.shareOfSearches[basis]]));
  const total = Object.values(weeklySearchesByTier).reduce((a, b) => a + b, 0);
  return Object.fromEntries(locations.map((p) => [
    p.id,
    Object.entries(weeklySearchesByTier)
      .reduce((sum, [price, searches]) => sum + p.shareOfSearches[price] * searches, 0) / total,
  ]));
}

/**
 * How long each kind of place waits between rings: the busiest waits `fastest`
 * seconds, and the others longer, in proportion to how much less they are
 * searched.
 *
 * @param {Record<string, number>} shares - from `sharesFor`
 * @param {number} [fastest] - seconds
 * @returns {Record<string, number|null>} seconds between rings, by location id;
 *   null for a kind nobody searches, which does not ring
 */
export function pulsePeriods(shares, fastest = FASTEST_PULSE_S) {
  const top = Math.max(...Object.values(shares));
  return Object.fromEntries(Object.entries(shares)
    .map(([id, share]) => [id, share > 0 ? (fastest * top) / share : null]));
}

function make(tag, attrs = {}) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

/**
 * @param {object} args
 * @param {object[]} args.locations - `briefing(querySet).locations`
 * @param {Record<string, number>} args.shares - from `sharesFor`
 * @param {string|null} [args.lit] - a location id to light, or null for none
 * @param {(id: string) => void} args.onPick - a city was tapped
 * @returns {SVGElement}
 */
export function drawIndia({ locations, shares, lit = null, onPick }) {
  const svg = make('svg', { viewBox: MAP_VIEWBOX, class: 'r0-map', 'aria-hidden': 'true' });
  svg.append(make('path', { d: INDIA_PATH, class: 'r0-land' }));

  const back = make('g', { class: 'r0-backdrop' });
  for (const [x, y] of BACKDROP) back.append(make('circle', { cx: x, cy: y, r: 1.6 }));
  svg.append(back);

  const periods = pulsePeriods(shares);
  for (const place of locations) {
    let state = '';
    if (lit === place.id) state = ' lit';
    else if (lit) state = ' dim';
    const group = make('g', { class: `r0-place${state}` });
    place.examples.forEach((name, i) => {
      const point = CITY_POINTS[name];
      if (!point) return;
      const [x, y] = point;
      const pin = make('g', { class: 'r0-pin' });
      const period = periods[place.id];
      if (period !== null) {
        const ring = make('circle', { cx: x, cy: y, r: 7, class: 'r0-ring' });
        ring.style.animationDuration = `${period.toFixed(2)}s`;
        // Offset through the period, so a kind's cities do not ring in lockstep.
        ring.style.animationDelay = `${((i * 0.37) % period).toFixed(2)}s`;
        pin.append(ring);
      }
      pin.append(make('circle', { cx: x, cy: y, r: 3.5, class: 'r0-city' }));
      // Which side the name sits is LABEL_SIDE (ui/india-map.js), checked in
      // this map's type by tests/locations.test.js.
      const at = labelPlace(name, point, 7);
      const label = make('text', { x: at.x, y: at.y, 'text-anchor': at.anchor, class: 'r0-label' });
      label.textContent = name;
      pin.append(label);
      pin.addEventListener('click', () => onPick(place.id));
      group.append(pin);
    });
    svg.append(group);
  }
  return svg;
}
