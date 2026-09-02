/**
 * General numeric helpers.
 *
 * These belong to no single module: clamp is used by quality (factor ranges),
 * strategies (the conversion chain bound) and pacing (participation fraction),
 * and none of those is about money. They lived in money.js while there was
 * only one of them, which was the wrong home for a helper that has nothing to
 * do with currency.
 */

/**
 * Bound a value both ways.
 *
 * @param {number} v
 * @param {number} lo
 * @param {number} hi lower bound wins if hi < lo
 * @returns {number}
 */
export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Linear interpolation between two points, clamped outside the range.
 *
 * Used for the capex S-curve (spec 13.3), which is a handful of points that
 * every intermediate commitment has to be read off.
 *
 * @param {number} x
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @returns {number}
 */
export function lerp(x, x0, y0, x1, y1) {
  if (x1 === x0) return y0;
  const t = clamp((x - x0) / (x1 - x0), 0, 1);
  return y0 + t * (y1 - y0);
}

/**
 * Sum of an array of numbers. Zero for an empty array.
 *
 * @param {number[]} values
 * @returns {number}
 */
export function sum(values) {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

/**
 * Mean of an array. NaN for an empty array, deliberately: an average of
 * nothing is not zero, and silently returning zero would let an empty history
 * read as a real measurement.
 *
 * @param {number[]} values
 * @returns {number}
 */
export function mean(values) {
  return values.length === 0 ? NaN : sum(values) / values.length;
}
