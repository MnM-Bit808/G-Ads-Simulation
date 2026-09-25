/**
 * A thin horizontal meter: a ground, and a fill along it.
 *
 * THREE IMPLEMENTATIONS UNTIL I49 (2026-09-25): `rv-track` and `wt-track` were
 * identical at 6px with a 3px corner, and `wm-track` was 8px with a 4px corner
 * for no reason anyone could state. Six pixels won on the count.
 *
 * NOT every track in the Studio. Three others share the word and are different
 * objects, and folding them in here would be worse than the duplication:
 *
 * - `rs-track` (Everyone's books) draws TWO bars, a gross outline with a net
 *   fill inside it, and the gap between them is the point.
 * - `ww-track` (Where and when) is a drag target with a cursor and
 *   `touch-action`, not a readout.
 * - `yad-track` is the bid slider's rail, which paints itself from custom
 *   properties so a drag repaints without touching the DOM.
 */

import { el } from '../dom.js';

/**
 * @param {number} fraction - 0 to 1; clamped, and anything drawable gets at
 *   least a sliver so "a very small amount" never reads as "none"
 * @param {object} [args]
 * @param {string|null} [args.tone] - a modifier class, e.g. 'blocked'
 * @param {string|null} [args.label] - an accessible name; without one the
 *   meter is decoration and is hidden from screen readers, which is right
 *   when the number sits beside it
 * @returns {HTMLElement}
 */
export function meter(fraction, { tone = null, label = null } = {}) {
  const track = el('span', tone ? `kmeter ${tone}` : 'kmeter');
  const safe = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
  const fill = el('span');
  fill.style.width = `${safe > 0 ? Math.max(2, 100 * safe) : 0}%`;
  track.append(fill);
  if (label) {
    track.setAttribute('role', 'img');
    track.setAttribute('aria-label', label);
  } else {
    track.setAttribute('aria-hidden', 'true');
  }
  return track;
}
