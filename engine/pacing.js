/**
 * Budget pacing (spec 13.4).
 *
 * Three levels, with clear precedence:
 *
 *   MONTH   monthlyBudgetPaise                    hard ceiling, no carry-over
 *     WEEK  weeklySplitPaise[w]                   the advertiser's own choice
 *       DAY target = remaining week / remaining days
 *
 * The daily target is recomputed each morning. Overspend on Monday lowers
 * Tuesday's target automatically; a quiet Monday raises it. The weekly figure
 * holds by construction rather than by a hard stop, so spend tapers instead of
 * falling off a ledge.
 *
 * WHERE THE OVERSPEND COMES FROM
 *
 * Google allows a day to reach twice the daily budget because pacing is a
 * PREDICTION and predictions are wrong. In a simulation the demand table is
 * one the engine wrote, so a pacer reading it would have perfect foresight,
 * never overshoot, and the documented 2x behaviour would be decoration with an
 * unpassable test attached to it.
 *
 * So the pacer forecasts from PACING_REFERENCE_CURVE — one smooth generic
 * day-shape peaking early afternoon — while real demand is the sum of
 * per-query hour profiles that peak late morning and mid-evening. It plans
 * against a day that does not exist. When a quiet morning leaves headroom
 * unspent and the evening arrives three times heavier than the reference
 * predicted, the day overshoots.
 *
 * No dice, no injected noise, fully deterministic under R1, and it produces a
 * lesson the sim did not previously have: an account whose demand pattern is
 * unusual gets paced worse than an average one (DECISIONS D9).
 *
 * THROTTLING IS FRACTIONAL, NEVER A SKIPPED AUCTION
 *
 * One auction resolution carries a whole slice of an hour's volume for a query
 * — enough to consume most of a day's budget in one step. A throttled
 * advertiser therefore enters a FRACTION of that volume, and the rest counts
 * as lostToBudget. The obvious implementation, "if throttled, skip this
 * auction", reproduces exactly the cliff this module exists to remove (H1).
 */

import {
  PACING_REFERENCE_CURVE, DAILY_BUDGET_OVERSPEND_CAP,
} from './constants.js';
import { clamp } from './num.js';
import { assertPaise } from './money.js';
import { DAYS_PER_WEEK, HOURS_PER_DAY } from './querySet.js';

/**
 * Cumulative share of a day the pacer believes has passed by the END of `hour`.
 *
 * Precomputed once: this is read on every advertiser-hour of every round.
 */
const CUMULATIVE_REFERENCE = (() => {
  const out = [];
  let running = 0;
  for (const share of PACING_REFERENCE_CURVE) {
    running += share;
    out.push(running);
  }
  // Guard against drift in the last entry, which must be exactly 1.
  out[out.length - 1] = 1;
  return Object.freeze(out);
})();

/**
 * What fraction of the day the pacer expects to be over by the end of an hour.
 *
 * @param {number} hour 0-23
 * @returns {number} 0..1
 */
export function cumulativeReference(hour) {
  const v = CUMULATIVE_REFERENCE[hour];
  if (v === undefined) throw new RangeError(`hour must be 0..23, got ${String(hour)}`);
  return v;
}

/**
 * What fraction of the day the pacer believes still lies ahead, counting this
 * hour as ahead.
 *
 * @param {number} hour 0-23
 * @returns {number} 0..1
 */
export function remainingReference(hour) {
  if (hour === 0) return 1;
  return Math.max(0, 1 - cumulativeReference(hour - 1));
}

/**
 * Today's spending target: what is left of the week, spread over the days that
 * remain in it.
 *
 * Self-correcting by construction. Nothing here needs to know whether previous
 * days ran hot or cold; the arithmetic absorbs both.
 *
 * @param {number} weekBudgetPaise this week's allocation
 * @param {number} weekSpentPaise spent so far this week
 * @param {number} dayOfWeek 0-6, 0 is Monday
 * @returns {number} integer paise, never negative
 */
export function dailyTargetPaise(weekBudgetPaise, weekSpentPaise, dayOfWeek) {
  assertPaise(weekBudgetPaise, 'weekBudgetPaise');
  assertPaise(weekSpentPaise, 'weekSpentPaise');
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek >= DAYS_PER_WEEK) {
    throw new RangeError(`dayOfWeek must be 0..${DAYS_PER_WEEK - 1}, got ${String(dayOfWeek)}`);
  }
  const remainingDays = DAYS_PER_WEEK - dayOfWeek;
  const remainingBudget = Math.max(0, weekBudgetPaise - weekSpentPaise);
  return Math.floor(remainingBudget / remainingDays);
}

/**
 * What the pacer EXPECTS this hour to cost, from its generic day-shape.
 *
 * Deliberately wrong. The gap between this and what the hour actually costs is
 * the whole mechanism above.
 *
 * @param {number} dayTargetPaise
 * @param {number} hour 0-23
 * @returns {number} integer paise
 */
export function projectedHourSpendPaise(dayTargetPaise, hour) {
  assertPaise(dayTargetPaise, 'dayTargetPaise');
  const share = PACING_REFERENCE_CURVE[hour];
  if (share === undefined) throw new RangeError(`hour must be 0..23, got ${String(hour)}`);
  return Math.round(dayTargetPaise * share);
}

/**
 * How much of this hour's available volume the advertiser enters.
 *
 * Returns a fraction, never a yes or no. The remainder is `lostToBudget`.
 *
 * Three ceilings apply and the tightest wins:
 *   - the running plan, so spend tracks the day rather than front-loading
 *   - twice the daily target, the documented hard stop for one day
 *   - whatever is left of the month, which is real money and cannot be exceeded
 *
 * @param {object} args
 * @param {number} args.dayTargetPaise
 * @param {number} args.spentTodayPaise
 * @param {number} args.hour 0-23
 * @param {number} [args.monthRemainingPaise] omit for no month constraint
 * @returns {number} 0..1
 */
export function participationFraction({
  dayTargetPaise, spentTodayPaise, hour, monthRemainingPaise = Infinity,
}) {
  assertPaise(dayTargetPaise, 'dayTargetPaise');
  assertPaise(spentTodayPaise, 'spentTodayPaise');
  if (hour < 0 || hour >= HOURS_PER_DAY || !Number.isInteger(hour)) {
    throw new RangeError(`hour must be 0..${HOURS_PER_DAY - 1}, got ${String(hour)}`);
  }
  if (dayTargetPaise === 0) return 0;
  return participationFrom(pacingContext(dayTargetPaise, hour), spentTodayPaise, monthRemainingPaise);
}

/**
 * The parts of a pacing decision that depend only on the advertiser's daily
 * target and the hour.
 *
 * Hoisted out because `round.js` evaluates pacing on the order of a million
 * times per sampled round, and recomputing a curve lookup and two divisions
 * inside that loop is most of a round's budget. Same arithmetic, computed once
 * per advertiser-hour instead of once per auction.
 *
 * @param {number} dayTargetPaise
 * @param {number} hour 0-23
 * @returns {{dayTargetPaise: number, projected: number, remainingShare: number, ceiling: number}}
 */
export function pacingContext(dayTargetPaise, hour) {
  return {
    dayTargetPaise,
    projected: projectedHourSpendPaise(dayTargetPaise, hour),
    remainingShare: remainingReference(hour),
    ceiling: dayTargetPaise * DAILY_BUDGET_OVERSPEND_CAP,
  };
}

/**
 * Finish a pacing decision from a precomputed context.
 *
 * @param {object} ctx from pacingContext
 * @param {number} spentTodayPaise
 * @param {number} monthRemainingPaise
 * @returns {number} 0..1
 */
export function participationFrom(ctx, spentTodayPaise, monthRemainingPaise) {
  const { dayTargetPaise, projected, remainingShare, ceiling } = ctx;
  if (dayTargetPaise === 0) return 0;

  // Spread what is left of the day's budget over what the pacer believes is
  // left of the day's demand:
  //
  //     participation = budget remaining / (target x share of day still ahead)
  //
  // Exactly on plan gives 1. Ahead of plan throttles smoothly toward 0. Behind
  // plan exceeds 1 and clamps back.
  //
  // An earlier version compared spend against the plan CUMULATIVE TO THIS HOUR
  // and it stuttered badly — an advertiser a whisker ahead of plan dropped to
  // zero participation for a whole hour, then jumped back to full when the next
  // hour's allowance opened. On an evening-heavy account that shut it out of
  // 20:00, its single best hour of the day, for reasons no player could ever
  // have diagnosed. Pacing has to be smooth to be legible.
  const remainingPlan = dayTargetPaise - spentTodayPaise;
  const planFraction = remainingShare > 0
    ? remainingPlan / (dayTargetPaise * remainingShare)
    : 0;

  // The two hard ceilings are expressed against what this hour is projected to
  // cost, so they compare like with like.
  if (projected <= 0) {
    return monthRemainingPaise > 0 && remainingPlan > 0 ? clamp(planFraction, 0, 1) : 0;
  }

  const dayCeilingFraction = (ceiling - spentTodayPaise) / projected;
  const monthCeilingFraction = monthRemainingPaise / projected;

  return clamp(Math.min(planFraction, dayCeilingFraction, monthCeilingFraction), 0, 1);
}

/**
 * The hard ceiling on one day's spend.
 *
 * @param {number} dayTargetPaise
 * @returns {number} integer paise
 */
export function dailyCeilingPaise(dayTargetPaise) {
  assertPaise(dayTargetPaise, 'dayTargetPaise');
  return Math.round(dayTargetPaise * DAILY_BUDGET_OVERSPEND_CAP);
}

/**
 * Is a proposed weekly split legal? (spec 13.2)
 *
 * The month is a hard cap and there is no carry-over, so the four weeks must
 * not ask for more than the month holds.
 *
 * @param {number[]} weeklySplitPaise
 * @param {number} monthlyBudgetPaise
 * @returns {{valid: boolean, reason: string|null}}
 */
export function validateWeeklySplit(weeklySplitPaise, monthlyBudgetPaise) {
  if (!Array.isArray(weeklySplitPaise) || weeklySplitPaise.length === 0) {
    return { valid: false, reason: 'weekly split must be a non-empty array' };
  }
  let total = 0;
  for (const week of weeklySplitPaise) {
    if (!Number.isSafeInteger(week) || week < 0) {
      return { valid: false, reason: `each week must be non-negative integer paise, got ${String(week)}` };
    }
    total += week;
  }
  if (total > monthlyBudgetPaise) {
    return {
      valid: false,
      reason: `weekly split totals ${total} paise, above the month's ${monthlyBudgetPaise}`,
    };
  }
  return { valid: true, reason: null };
}
