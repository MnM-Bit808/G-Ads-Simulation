/**
 * Integer paise arithmetic (spec R7).
 *
 * All money in this simulation is an integer number of paise. Rupees exist only
 * at the display layer. Floating-point currency is forbidden because repeated
 * multiplication by rates — CTR, conversion rate, pacing fraction — accumulates
 * error that is invisible until totals stop reconciling.
 *
 * Two rounding rules live here and they do different jobs:
 *   mulRate   rounds half up. Ordinary "money times a rate".
 *   allocate  uses largest-remainder. Splitting one pot into parts that must
 *             sum back to exactly the pot.
 *
 * CPC pricing is not here. It has its own explicit ceil in spec 10.2, because
 * that is a pricing rule rather than a rounding convention.
 */

/**
 * True when a value is usable as money: a safe integer, finite, not NaN.
 * Negative is allowed — profit can be negative.
 *
 * @param {unknown} v
 * @returns {boolean}
 */
export function isPaise(v) {
  return typeof v === 'number' && Number.isSafeInteger(v);
}

/**
 * Throws unless the value is integer paise. Use at module boundaries where bad
 * money would otherwise propagate silently.
 *
 * @param {unknown} v
 * @param {string} [label] included in the error message
 * @returns {number} the value, unchanged
 */
export function assertPaise(v, label = 'value') {
  if (!isPaise(v)) {
    throw new TypeError(`${label} must be integer paise, got ${String(v)}`);
  }
  return v;
}

/**
 * Convert rupees to integer paise, rounding half up.
 *
 * @param {number} rupees
 * @returns {number} paise
 */
export function rupeesToPaise(rupees) {
  if (!Number.isFinite(rupees)) {
    throw new TypeError(`rupees must be finite, got ${String(rupees)}`);
  }
  return roundHalfUp(rupees * 100);
}

/**
 * Convert paise to rupees. Display only — the result is a float and must never
 * re-enter the engine.
 *
 * @param {number} paise
 * @returns {number} rupees
 */
export function paiseToRupees(paise) {
  assertPaise(paise, 'paise');
  return paise / 100;
}

/**
 * Multiply money by a rate and return integer paise, rounding half up.
 *
 * Rejects non-finite rates rather than letting Infinity or NaN into the money
 * system, which R7 forbids outright.
 *
 * @param {number} paise integer paise
 * @param {number} rate finite multiplier
 * @returns {number} integer paise
 */
export function mulRate(paise, rate) {
  assertPaise(paise, 'paise');
  if (!Number.isFinite(rate)) {
    throw new TypeError(`rate must be finite, got ${String(rate)}`);
  }
  return roundHalfUp(paise * rate);
}

/**
 * Sum integer paise, asserting every element on the way through.
 *
 * @param {number[]} values
 * @returns {number} integer paise
 */
export function sumPaise(values) {
  let total = 0;
  for (const v of values) {
    assertPaise(v, 'element');
    total += v;
  }
  return total;
}

/**
 * Split a pot into parts proportional to weights, with the parts summing to
 * exactly the pot.
 *
 * Uses the largest-remainder method: floor every exact share, then hand each
 * leftover paisa to whichever part came closest to rounding up. Naive rounding
 * would leave the parts summing to slightly more or less than the total, and
 * that drift is what spec 19's "sum of parts equals the recorded total" exists
 * to catch. This makes it true by construction instead.
 *
 * Ties break toward the lower index so the result is deterministic (R1).
 *
 * Defined for non-negative totals only. Every current caller — the monthly
 * budget across weeks, a week across days — splits a positive pot.
 *
 * @param {number} totalPaise integer paise, >= 0
 * @param {number[]} weights non-negative, at least one > 0
 * @returns {number[]} integer paise, same length as weights, summing to totalPaise
 */
export function allocate(totalPaise, weights) {
  assertPaise(totalPaise, 'totalPaise');
  if (totalPaise < 0) {
    throw new RangeError('allocate is defined for non-negative totals only');
  }
  if (!Array.isArray(weights) || weights.length === 0) {
    throw new TypeError('weights must be a non-empty array');
  }

  let weightSum = 0;
  for (const w of weights) {
    if (!Number.isFinite(w) || w < 0) {
      throw new RangeError(`weights must be finite and non-negative, got ${String(w)}`);
    }
    weightSum += w;
  }
  if (weightSum === 0) {
    throw new RangeError('weights must not sum to zero');
  }

  const exact = weights.map((w) => (totalPaise * w) / weightSum);
  const parts = exact.map(Math.floor);
  let remainder = totalPaise - parts.reduce((a, b) => a + b, 0);

  const byFraction = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => (b.frac - a.frac) || (a.i - b.i));

  for (let k = 0; k < remainder; k++) {
    parts[byFraction[k % byFraction.length].i] += 1;
  }

  return parts;
}

/**
 * Format paise as rupees with Indian digit grouping (lakh, crore).
 *
 * @param {number} paise integer paise
 * @param {{decimals?: number}} [opts] decimals defaults to 0
 * @returns {string} e.g. "₹1,68,000" or "₹26.56"
 */
export function formatINR(paise, opts = {}) {
  assertPaise(paise, 'paise');
  const { decimals = 0 } = opts;
  const rupees = Math.abs(paise) / 100;
  const body = rupees.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${paise < 0 ? '-' : ''}₹${body}`;
}

/**
 * Round half up, correcting for IEEE 754 representation error.
 *
 * 100000 * 0.07 evaluates to 7000.000000000001, and there are cases where a
 * value that should sit exactly on .5 lands a hair below it and rounds the
 * wrong way. Snapping to 12 significant decimals first removes that class of
 * surprise without affecting any value the engine legitimately produces.
 *
 * @param {number} v
 * @returns {number} integer
 */
function roundHalfUp(v) {
  return Math.round(Number(v.toPrecision(12)));
}
