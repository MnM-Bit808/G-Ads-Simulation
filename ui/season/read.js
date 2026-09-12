/**
 * Readings for the January surge (plans/2026-09-13-january-surge.md, spec 7.6).
 *
 * Pure: no DOM, no sentences. The words live in `ui/words/season.js`.
 */

/**
 * The game's calendar: week 1 starts on 6 November, so week 9 starts on
 * 1 January. No year, because New Year falls on 1 January every year.
 *
 * A display number (DECISIONS I6), and the measurement in
 * `scripts/season-lift.js` reads this same one, so the dates on screen and the
 * dates the curve was measured on cannot drift apart.
 */
export const WEEK_ONE = Object.freeze({ month: 11, day: 6 });
