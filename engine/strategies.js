/**
 * Bid strategies and prediction error (spec 12).
 *
 * v0.1 let Target CPA and Target ROAS read the TRUE hourly conversion rate.
 * They were never wrong, so automation always beat manual bidding, and the
 * simulation taught that automation is free. It is not: it is a trade of
 * control for a forecast, and the forecast is only as good as the data behind
 * it (DECISIONS D2).
 *
 * WHAT A STRATEGY IS ALLOWED TO KNOW
 *
 * Its own observed history, the hour, and its own product catalogue. That is
 * all. Notice what is absent from `estimatedConvRate`: there is no query
 * parameter. Spec 12.2 passes one, but a query carries `convMultiplier` and
 * the position affinities - the truth - and `getPublicView` withholds those
 * from everyone including the advertiser they favour (DECISIONS C4). A
 * strategy able to read them would be the v0.1 oracle under a new name, so the
 * parameter is dropped and the signature itself becomes the guarantee.
 *
 * Dayparting therefore has to be EARNED. A strategy bids more in a good hour
 * only once it has seen enough clicks in that hour to have an opinion, and
 * early on it has not, so it dayparts badly. That is the honest version.
 *
 * WHY THE ERROR MATTERS MOST TO PREMIUM
 *
 * Sigma shrinks with the square root of observed conversions. A premium
 * advertiser generates roughly a sixth of a value advertiser's conversions on
 * the same budget, so its estimates stay two to three times noisier for far
 * longer. Its disadvantage is statistical, not economic (DECISIONS F7).
 */

import {
  COLD_START_CONV_RATE, PREDICTION_ERROR_BASE, PREDICTION_ERROR_CLAMP,
  LEARNING_ERROR_MULTIPLIER, MIN_HOUR_OBSERVATIONS, DAYPART_BLOCKS,
  MAX_CLICKS_AGGRESSION, MAX_CONV_AGGRESSION,
  MIN_BID_PAISE, MAX_BID_MULTIPLE, CONV_RATE_CLAMP, LOCATION_TIERS,
} from './constants.js';
import { clamp } from './num.js';
import { normal } from './rng.js';
import { assertPaise } from './money.js';

/** The five, and whether each one predicts conversions at all. */
export const STRATEGIES = Object.freeze({
  manual: { predictsConversions: false },
  maxClicks: { predictsConversions: false },
  targetCpa: { predictsConversions: true },
  targetRoas: { predictsConversions: true },
  maxConv: { predictsConversions: true },
});

/**
 * How wrong this advertiser's conversion-rate estimate typically is.
 *
 * Falls with the square root of observed conversions, which is how sampling
 * error genuinely behaves, and is multiplied during a learning period.
 *
 * @param {{observedConversions?: number, learningRoundsRemaining?: number}} bidding
 * @returns {number} lognormal sigma
 */
export function predictionErrorSigma(bidding) {
  const n = Math.max(bidding?.observedConversions ?? 0, 0);
  const [lo, hi] = PREDICTION_ERROR_CLAMP;
  if (n === 0) return hi;

  const learning = (bidding?.learningRoundsRemaining ?? 0) > 0 ? LEARNING_ERROR_MULTIPLIER : 1;
  return clamp((PREDICTION_ERROR_BASE / Math.sqrt(n)) * learning, lo, hi);
}

/**
 * The conversion rate a strategy BELIEVES it will get in this hour.
 *
 * Drawn around the advertiser's own history, never around the truth. Uses the
 * hour's own observed rate when there is enough of it to mean anything, and
 * otherwise the aggregate — so dayparting emerges from data the advertiser
 * actually collected.
 *
 * @param {object} bidding the advertiser's own bidding block
 * @param {number} hour 0-23
 * @param {(() => number)|null} rng omit for the noise-free centre of the estimate
 * @returns {number} a conversion rate
 */
export function estimatedConvRate(bidding, hour, rng) {
  const centre = observedRateFor(bidding, hour);
  if (typeof rng !== 'function') return clamp(centre, ...CONV_RATE_CLAMP);

  const sigma = predictionErrorSigma(bidding);
  // Lognormal, shifted so the mean is exactly the observed centre. An estimate
  // that drifted high would be optimism baked into the model rather than error.
  const draw = centre * Math.exp(normal(rng) * sigma - (sigma * sigma) / 2);
  return clamp(draw, ...CONV_RATE_CLAMP);
}

function observedRateFor(bidding, hour) {
  const hourly = bidding?.observedByHour?.[hour];
  if (hourly && hourly.clicks >= MIN_HOUR_OBSERVATIONS) {
    return hourly.conversions / hourly.clicks;
  }
  const aggregate = bidding?.observedConvRate;
  return aggregate == null ? COLD_START_CONV_RATE : aggregate;
}

/**
 * The bid multiplier from the campaign's dayparting schedule.
 *
 * Adjustments are percentages, one per DAYPART_BLOCKS entry, and cannot drive
 * the multiplier below zero.
 *
 * @param {number[]} adjustments six percentages
 * @param {number} hour 0-23
 * @returns {number}
 */
export function daypartMultiplier(adjustments, hour) {
  const index = DAYPART_BLOCKS.findIndex((b) => hour >= b.start && hour < b.end);
  if (index === -1) throw new RangeError(`hour must be 0..23, got ${String(hour)}`);
  return Math.max(0, 1 + (adjustments?.[index] ?? 0) / 100);
}

/**
 * The bid multiplier from the campaign's location targeting.
 *
 * Percentages, one per `LOCATION_TIERS`, exactly like dayparting - because it is
 * exactly the same kind of control, and Google's own is a location bid
 * adjustment rather than a separate campaign. -100% is not an off switch: it
 * returns zero and `effectiveBidPaise` then clamps to `MIN_BID_PAISE`, so it is a
 * bid of one rupee, which behaves like an off switch only because a rupee sits
 * under `AD_RANK_FLOOR`. The same is true of dayparting and it is worth knowing
 * before reading a report that says "lost to rank".
 *
 * @param {number[]} adjustments one percentage per location tier
 * @param {number} tier index
 * @returns {number}
 */
export function locationMultiplier(adjustments, tier) {
  if (!Number.isInteger(tier) || tier < 0 || tier >= LOCATION_TIERS.length) {
    throw new RangeError(`tier must be 0..${LOCATION_TIERS.length - 1}, got ${String(tier)}`);
  }
  return Math.max(0, 1 + (adjustments?.[tier] ?? 0) / 100);
}

/**
 * What this advertiser actually bids for one auction.
 *
 * The budget-spending strategies do not solve for a bid that exhausts the
 * budget: they bid to win and let pacing throttle them (spec 13.4). That is
 * simpler than the v0.1 binary search and closer to how the real thing behaves.
 *
 * @param {object} args
 * @param {string} args.strategy
 * @param {object} args.strategyParams
 * @param {{bidPaise: number}} args.keyword
 * @param {{aovMeanPaise: number}} args.business own catalogue, legitimately known
 * @param {object} args.bidding own history
 * @param {number[]} args.daypartAdjustments
 * @param {number} args.hour
 * @param {(() => number)|null} args.rng
 * @returns {number} integer paise
 */
export function effectiveBidPaise({
  strategy, strategyParams, keyword, business, bidding, daypartAdjustments, hour, rng,
  locationAdjustments = null, locationTier = null,
}) {
  if (!STRATEGIES[strategy]) {
    throw new RangeError(`unknown strategy "${strategy}"`);
  }
  assertPaise(keyword.bidPaise, 'keyword.bidPaise');

  const daypart = daypartMultiplier(daypartAdjustments, hour);
  // Location is optional so every existing caller keeps its meaning: a bid with
  // no location is the bid anywhere, which is what the market was before G4.
  const place = locationTier === null ? 1 : locationMultiplier(locationAdjustments, locationTier);
  const raw = rawBid(strategy, strategyParams, keyword, business, bidding, hour, rng);

  // ONE CLAMP over both adjustments rather than one each, so -50% on the hour
  // and -50% on the place compound the way two bid adjustments do, instead of
  // each being floored separately at MIN_BID_PAISE.
  const ceiling = Math.round(keyword.bidPaise * MAX_BID_MULTIPLE);
  return clamp(Math.round(raw * daypart * place), MIN_BID_PAISE, ceiling);
}

function rawBid(strategy, params, keyword, business, bidding, hour, rng) {
  switch (strategy) {
    // Bids what you set. Never predicts conversions, so a learning period
    // cannot touch it - which is exactly why manual behaves predictably on a
    // thin account, and something the player should discover rather than read.
    case 'manual':
      return keyword.bidPaise;

    // Volume at any cost within budget. No conversion prediction, therefore no
    // shaping by hour.
    case 'maxClicks':
      return keyword.bidPaise * MAX_CLICKS_AGGRESSION;

    case 'targetCpa': {
      const target = params?.targetCpaPaise;
      if (!Number.isFinite(target) || target <= 0) {
        throw new RangeError(`targetCpaPaise must be a positive number, got ${String(target)}`);
      }
      return target * estimatedConvRate(bidding, hour, rng);
    }

    case 'targetRoas': {
      const target = params?.targetRoas;
      if (!Number.isFinite(target) || target <= 0) {
        // v0.1 silently substituted 1 here, turning a nonsensical setting into
        // a plausible-looking bid. A zero ROAS target means "spend without
        // limit" and should fail loudly.
        throw new RangeError(`targetRoas must be a positive number, got ${String(target)}`);
      }
      return (business.aovMeanPaise * estimatedConvRate(bidding, hour, rng)) / target;
    }

    // Like maxClicks, but leaning toward the hours its own history says convert
    // best. The lean is relative to its own average, so an account with no
    // hourly data behaves exactly like maxClicks until it has learned something.
    case 'maxConv': {
      const base = observedRateFor(bidding, null);
      const here = estimatedConvRate(bidding, hour, rng);
      const lean = base > 0 ? here / base : 1;
      return keyword.bidPaise * MAX_CONV_AGGRESSION * lean;
    }

    default:
      throw new RangeError(`unknown strategy "${strategy}"`);
  }
}

/**
 * Count a learning period down by one round (spec 12.3, L7).
 *
 * The engine ONLY decrements. A pure function cannot detect that a setting
 * changed, so the caller diffs the submitted decisions against the previous
 * state and writes the period; nothing here ever sets one.
 *
 * @param {{learningRoundsRemaining?: number}} bidding
 * @returns {object} a new bidding block
 */
export function decrementLearning(bidding) {
  return {
    ...bidding,
    learningRoundsRemaining: Math.max(0, (bidding?.learningRoundsRemaining ?? 0) - 1),
  };
}
