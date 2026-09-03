/**
 * Conversions, attribution lag and returns (spec 11.3, 12.1, 14).
 *
 * This is where the truth lives. `effectiveConvRate` is the real probability a
 * click turns into an order — the number `strategies.js` is forbidden from
 * seeing and can only estimate. Keeping them in separate modules is not
 * tidiness; it is the whole of DECISIONS D2.
 *
 * It is also where gross and net revenue finally part company, and where the
 * simulation stops paying out the moment you spend.
 *
 * A CLICK TAKES FIVE ROUNDS TO SETTLE
 *
 *   round 3   the click, and the cost
 *   3 to 6    the order lands, somewhere in the lag distribution
 *   5 to 8    the return resolves, two rounds after it landed
 *
 * So a round-3 click is not finally scored until round 8, and clicks in rounds
 * 10 to 12 never settle before the game ends. That lag is why bid strategies
 * look broken when checked too early, and why an account cannot be judged on
 * the round it spent the money.
 *
 * A DOUBLE-COUNT THE SPEC WOULD HAVE INTRODUCED
 *
 * Spec 12.1 lists both `business.convRateBase` AND
 * `PURPOSE_MODIFIERS[position.purpose].conv` in the chain, and spec 14 does the
 * same with the return modifier. But `businessFor` already folds both into the
 * business block — it has to, or the break-even table in 4.4 would be wrong.
 * Applying them again here would be the L6 double-count in a new place, so
 * neither is re-applied. See DECISIONS F10.
 */

import {
  HOURLY_INTENT_CURVE, CONV_RATE_CLAMP, ATTRIBUTION_LAG_DISTRIBUTION,
  RETURN_RATE_CLAMP_MAX, BRAND_OWNER_MULTIPLIER, BRAND_POACHER_MULTIPLIER,
  INFORMATIONAL_CONV_MULTIPLIER, IRRELEVANT_CONV_MULTIPLIER,
} from './constants.js';
import { clamp } from './num.js';
import { normal } from './rng.js';
import { mulRate } from './money.js';

/**
 * How a query's intent and ownership scale the conversion rate.
 *
 * @param {{intent: string, brandOwner: string|null}} query
 * @param {string} advertiserId
 * @returns {number}
 */
export function brandFactor(query, advertiserId) {
  if (query.intent === 'irrelevant') return IRRELEVANT_CONV_MULTIPLIER;
  if (query.intent === 'informational') return INFORMATIONAL_CONV_MULTIPLIER;
  if (query.brandOwner) {
    return query.brandOwner === advertiserId ? BRAND_OWNER_MULTIPLIER : BRAND_POACHER_MULTIPLIER;
  }
  return 1;
}

/**
 * The real probability this click converts (spec 12.1).
 *
 * One chain, one clamp, written down once. No other module applies its own
 * bound — three modules each clamping their own way is how numbers stop
 * reconciling.
 *
 * Irrelevant traffic short-circuits to exactly zero rather than to the clamp
 * floor. That traffic never converts, and the waste is the lesson.
 *
 * @param {object} args
 * @param {object} args.business already position- and capex-derived
 * @param {object} args.query
 * @param {{price: string, purpose: string}} args.position
 * @param {string} args.advertiserId
 * @param {number} args.hour 0-23
 * @returns {number}
 */
export function effectiveConvRate({ business, query, position, advertiserId, hour }) {
  const brand = brandFactor(query, advertiserId);
  if (brand === 0) return 0;

  const intent = HOURLY_INTENT_CURVE[hour];
  if (intent === undefined) throw new RangeError(`hour must be 0..23, got ${String(hour)}`);

  const raw = business.convRateBase
    * query.convMultiplier
    * query.priceAffinity[position.price]
    * query.purposeAffinity[position.purpose]
    * brand
    * intent;

  return clamp(raw, ...CONV_RATE_CLAMP);
}

/**
 * The share of orders that survive the return window.
 *
 * The clamp is required: nothing else bounds returnRate x multiplier below 1,
 * and a return rate above 100% would produce negative revenue.
 *
 * @param {{returnRate: number}} business
 * @param {{returnRateMultiplier: number}} query
 * @returns {number} 0..1
 */
export function retentionRate(business, query) {
  return 1 - clamp(business.returnRate * query.returnRateMultiplier, 0, RETURN_RATE_CLAMP_MAX);
}

/**
 * What one order is worth.
 *
 * Sampled mode draws lognormally around the mean, so the spread is realistic,
 * the mean is preserved exactly, and an order value can never come out
 * negative. This distribution is what ROAS bidding exists to predict.
 *
 * @param {{aovMeanPaise: number, aovSpread: number}} business
 * @param {{valueMultiplier: number}} query
 * @param {(() => number)|null} rng
 * @param {'expected'|'sampled'} mode
 * @returns {number} integer paise
 */
export function sampleOrderValuePaise(business, query, rng, mode) {
  const base = mulRate(business.aovMeanPaise, query.valueMultiplier);
  if (mode !== 'sampled') return base;
  if (typeof rng !== 'function') {
    throw new TypeError('sampled mode needs an rng: the engine never reaches for one (R1)');
  }
  const s = business.aovSpread;
  return Math.max(1, mulRate(base, Math.exp(normal(rng) * s - (s * s) / 2)));
}

/**
 * Turn clicks into conversions and queue them behind the attribution lag.
 *
 * Each entry snapshots the order value and the return rate as they were at
 * click time, so a repositioning or a capex tranche going live cannot
 * retroactively rewrite an order that was already sold (spec 4.5).
 *
 * @param {object} args
 * @param {number} args.clicks
 * @param {number} args.convRate from effectiveConvRate
 * @param {number} args.orderValuePaise
 * @param {number} args.returnRate 0..1, the rate in force now
 * @param {number} args.round the click round
 * @param {(() => number)|null} args.rng
 * @param {'expected'|'sampled'} args.mode
 * @returns {Array<object>} pendingConversions entries
 */
export function queueConversions({
  clicks, convRate, orderValuePaise, returnRate, round, rng, mode,
}) {
  let count = clicks * convRate;
  if (count <= 0) return [];

  if (mode === 'sampled') {
    if (typeof rng !== 'function') {
      throw new TypeError('sampled mode needs an rng: the engine never reaches for one (R1)');
    }
    // Variance scales with the count, as a count of independent events does.
    // A thin query stays violently noisy; a fat one settles down.
    count = Math.max(0, count + normal(rng) * Math.sqrt(count));
    if (count <= 0) return [];
  }

  const entries = [];
  for (const [lag, share] of ATTRIBUTION_LAG_DISTRIBUTION.entries()) {
    const slice = count * share;
    if (slice <= 0) continue;
    entries.push({
      clickedInRound: round,
      dueRound: round + lag,
      count: slice,
      valuePaise: Math.round(slice * orderValuePaise),
      returnRate,
    });
  }
  return entries;
}

/**
 * Release the conversions due this round.
 *
 * Anything overdue lands too rather than being stranded, which keeps a resumed
 * or replayed game consistent.
 *
 * @param {Array<object>} pendingConversions
 * @param {number} round
 * @returns {{landed: Array<object>, remaining: Array<object>}}
 */
export function landDueConversions(pendingConversions, round) {
  const landed = [];
  const remaining = [];
  for (const entry of pendingConversions ?? []) {
    (entry.dueRound <= round ? landed : remaining).push(entry);
  }
  return { landed, remaining };
}

/**
 * Queue the share of landed orders that will come back.
 *
 * Uses each entry's snapshotted rate, not the advertiser's current one.
 *
 * @param {Array<object>} landed
 * @param {number} round the round they landed in
 * @param {number} returnWindowRounds
 * @returns {Array<object>} pendingReturns entries
 */
export function queueReturns(landed, round, returnWindowRounds) {
  const out = [];
  for (const entry of landed ?? []) {
    const rate = entry.returnRate ?? 0;
    if (rate <= 0) continue;
    out.push({
      // Carried through so a resolved return can be attributed back to the
      // round whose click earned it. Reports are keyed by click round and
      // revised in place (spec 11.4), and a return that could not name its
      // click round would have nowhere to go.
      clickedInRound: entry.clickedInRound,
      landedInRound: round,
      resolvesInRound: round + returnWindowRounds,
      count: entry.count * rate,
      valuePaise: mulRate(entry.valuePaise, rate),
    });
  }
  return out;
}

/**
 * Release the returns due this round.
 *
 * @param {Array<object>} pendingReturns
 * @param {number} round
 * @returns {{resolved: Array<object>, remaining: Array<object>}}
 */
export function resolveReturns(pendingReturns, round) {
  const resolved = [];
  const remaining = [];
  for (const entry of pendingReturns ?? []) {
    (entry.resolvesInRound <= round ? resolved : remaining).push(entry);
  }
  return { resolved, remaining };
}

/**
 * @param {Array<object>} landed
 * @returns {{conversions: number, grossRevenuePaise: number}}
 */
export function summariseLanded(landed) {
  let conversions = 0;
  let grossRevenuePaise = 0;
  for (const e of landed ?? []) {
    conversions += e.count;
    grossRevenuePaise += e.valuePaise;
  }
  return { conversions, grossRevenuePaise };
}

/**
 * @param {Array<object>} resolved
 * @returns {{returnedConversions: number, returnedRevenuePaise: number}}
 */
export function summariseReturns(resolved) {
  let returnedConversions = 0;
  let returnedRevenuePaise = 0;
  for (const e of resolved ?? []) {
    returnedConversions += e.count;
    returnedRevenuePaise += e.valuePaise;
  }
  return { returnedConversions, returnedRevenuePaise };
}
