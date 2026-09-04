/**
 * Every number in the simulation, with provenance (spec R4, hard rule 7).
 *
 * Provenance tags, declared once in PROVENANCE at the foot of this file:
 *   DOCUMENTED  Google publishes it.
 *   ESTIMATED   Third-party analyses, no official source, they disagree.
 *   INVENTED    Chosen for playability. No empirical basis whatsoever.
 *   CALIBRATE   Provisional. Governed by an invariant in spec 18.2 and not
 *               trustworthy until calibration.test.js passes.
 *
 * If a number is not in this file it is not a decision, it is an accident.
 * If a number leaves this file, delete its DECISIONS.md entry too — v0.2 shipped
 * two constants defended at length in the ledger that no formula ever read.
 */

// ---------------------------------------------------------------------------
// Game shape
// ---------------------------------------------------------------------------

export const SCHEMA_VERSION = '0.3';

/** Player plus eight rivals. Fewer than this and rank competition never bites. */
export const ADVERTISER_COUNT = 9;

export const TOTAL_ROUNDS = 12;
export const ROUNDS_PER_MONTH = 4;

// ---------------------------------------------------------------------------
// Positioning (spec 4)
// ---------------------------------------------------------------------------

export const PRICE_TIERS = ['value', 'mid', 'premium'];
export const PURPOSES = ['performance', 'lifestyle'];

/**
 * Price tier sets the economics: what a click can be worth.
 *
 * The internal logic, not just the numbers: cheap things convert well because
 * the decision is near-impulse, but the margin has been competed away and price
 * shoppers order two sizes meaning to return one. Expensive things are
 * considered purchases — slow to convert, high margin, fewer returns because the
 * size guide is better and the buyer is committed.
 */
export const POSITION_ECONOMICS = {
  value: {
    aovMeanPaise: 120000, marginPct: 0.40, convRateBase: 0.042,
    returnRate: 0.30, aovSpread: 0.35, returnWindowRounds: 2,
  },
  mid: {
    aovMeanPaise: 240000, marginPct: 0.52, convRateBase: 0.028,
    returnRate: 0.24, aovSpread: 0.35, returnWindowRounds: 2,
  },
  premium: {
    aovMeanPaise: 480000, marginPct: 0.62, convRateBase: 0.016,
    returnRate: 0.20, aovSpread: 0.35, returnWindowRounds: 2,
  },
};

/**
 * Purpose sets the territory: which clicks you want. It must NOT materially
 * change what you can pay for them — invariant I4 holds the purpose axis to
 * under 15% of break-even within a price row.
 *
 * WHY conv IS 0.94/1.06 AND NOT 0.90/1.10
 *
 * Because the query set already carries a purpose effect on economics, and it
 * carries a better one. Lifestyle territory has genuinely bigger baskets — it
 * is full of "co ord set", "matching set", "lounge set", and a set IS a larger
 * order — and genuinely fewer returns, because oversized tshirts and modal
 * joggers fit anybody while compression leggings and high impact sports bras
 * do not. Those are per-query, argued, and visible in the set.
 *
 * Measured on the REALISED figures (realisedBreakEvenCpcPaise), the old
 * 0.90/1.10 put the purpose gap at 12.2 / 17.0 / 20.5% — through I4's 15%
 * bound in two rows out of three, and invisible because I4 only ever read this
 * file. Spec 4.4's headroom warning was aimed at the wrong constant.
 *
 * The fix is 4.4's own prescription run backwards. It says that if the purpose
 * axis needs to be STRONGER, strengthen the query affinities rather than these
 * numbers. The query set is already the stronger of the two, so these shrink
 * instead. At 0.94/1.06 the realised gap is 3.5 / 7.9 / 11.2%, which is what
 * the 4.4 table always claimed and never delivered.
 *
 * ret stays at 0.85/1.20. It is the better-argued half of 4.3, and it is the
 * half the query set reinforces rather than duplicates. Shrinking it would
 * WIDEN the break-even gap, not narrow it: the return modifier currently
 * offsets the conversion modifier rather than compounding it.
 *
 * The cost, named: the query set carries no purpose effect on CONVERSION — the
 * affinity ratio within a price row measures 1.001, 0.992, 1.001 — so nothing
 * else carries "performance goods are bought on stated specs". That claim is
 * now made more mildly. See DECISIONS F11.
 */
export const PURPOSE_MODIFIERS = {
  performance: { conv: 0.94, ret: 0.85 },
  lifestyle: { conv: 1.06, ret: 1.20 },
};

export const REPOSITION_COST_PAISE = 10000000; // ₹1,00,000
export const REPOSITION_ROUND = 5;

export const RIVAL_PLACEMENT_CONSTRAINTS = {
  minPriceTiers: 2,
  requireBothPurposes: true,
  maxPerCell: 2,
};

// ---------------------------------------------------------------------------
// Demand (spec 7.2, 12.1)
// ---------------------------------------------------------------------------

/**
 * Curves are authored as raw shapes and normalised here, rather than authored
 * pre-normalised. Hand-normalising 24 values is a good way to introduce a
 * silent error that nothing ever catches.
 */
const normalise = (raw) => {
  const total = raw.reduce((a, b) => a + b, 0);
  return raw.map((v) => v / total);
};

/** Index 0 is Monday. Weekend browsing runs higher. */
export const DAY_OF_WEEK_CURVE = normalise([
  1.35, 1.35, 1.40, 1.40, 1.45, 1.60, 1.45,
]);

/**
 * Volume by hour. Three shapes, assigned per query.
 *
 * Peaks matter: invariant I5 requires the intent peak (15:00) to sit at least
 * MIN_PEAK_SEPARATION_HOURS from every peak here. business peaks at 11, evening
 * at 20, flat at 19 — 4, 5 and 4 hours clear respectively.
 */
export const HOUR_PROFILES = {
  // Searching from a desk. Peaks late morning.
  business: normalise([
    0.30, 0.20, 0.15, 0.12, 0.15, 0.35, 0.90, 1.80,
    3.20, 4.60, 5.40, 5.80, 5.20, 4.60, 4.40, 4.30,
    4.10, 3.60, 3.00, 2.60, 2.20, 1.60, 1.00, 0.55,
  ]),
  // Browsing after dinner, mostly on a phone. Peaks at 20:00.
  evening: normalise([
    0.50, 0.32, 0.22, 0.18, 0.20, 0.35, 0.70, 1.20,
    1.80, 2.20, 2.50, 2.70, 2.60, 2.50, 2.60, 2.90,
    3.40, 4.20, 5.20, 6.00, 6.40, 5.50, 3.80, 1.90,
  ]),
  // "Flat" means low amplitude, not uniform. Still peaks, gently, at 19:00.
  flat: normalise([
    1.00, 0.80, 0.70, 0.65, 0.70, 0.90, 1.20, 1.50,
    1.70, 1.80, 1.90, 2.00, 1.95, 1.90, 1.90, 1.95,
    2.00, 2.10, 2.20, 2.30, 2.20, 1.90, 1.50, 1.15,
  ]),
};

/**
 * Conversion rate by hour — a multiplier, not a distribution, so it is
 * normalised to a mean of exactly 1 rather than a sum of 1.
 *
 * That normalisation is load-bearing. If the mean drifted from 1 this curve
 * would quietly change the average conversion rate and invalidate every
 * break-even figure in spec 4.4.
 *
 * Peaks at 15:00, deliberately away from both the late-morning search peak and
 * the evening browse peak. The lesson is that the busiest hour and the
 * most-browsed hour are both the wrong hour to spend your money — which is
 * where dayparting earns its keep. See DECISIONS F5 and H4.
 */
const normaliseToMeanOne = (raw) => {
  const mean = raw.reduce((a, b) => a + b, 0) / raw.length;
  return raw.map((v) => v / mean);
};

export const HOURLY_INTENT_CURVE = normaliseToMeanOne([
  0.62, 0.55, 0.50, 0.48, 0.52, 0.62, 0.75, 0.88,
  0.98, 1.06, 1.14, 1.20, 1.24, 1.28, 1.34, 1.40,
  1.34, 1.24, 1.14, 1.06, 1.00, 0.92, 0.82, 0.72,
]);

export const MIN_PEAK_SEPARATION_HOURS = 3;

/**
 * What the pacer BELIEVES the day looks like (spec 13.4, DECISIONS D9).
 *
 * Deliberately generic and therefore wrong. Real demand is a mix of the three
 * HOUR_PROFILES above; this single broad early-afternoon shape under-forecasts
 * evening demand and over-forecasts the morning. That mismatch is what produces
 * pacing error, and pacing error is the only reason the documented 2x daily
 * overspend can ever occur in a simulation whose demand table the engine wrote.
 *
 * No dice, no injected noise, no fudge factor — the error is structural.
 */
export const PACING_REFERENCE_CURVE = normalise([
  0.35, 0.25, 0.20, 0.18, 0.22, 0.40, 0.85, 1.60,
  2.60, 3.50, 4.20, 4.70, 4.90, 5.00, 4.80, 4.50,
  4.20, 3.90, 3.60, 3.30, 2.90, 2.30, 1.50, 0.85,
]);

export const DAYPART_BLOCKS = [
  { label: 'Late night', start: 0, end: 6 },
  { label: 'Early morning', start: 6, end: 9 },
  { label: 'Late morning', start: 9, end: 12 },
  { label: 'Afternoon', start: 12, end: 17 },
  { label: 'Evening', start: 17, end: 21 },
  { label: 'Night', start: 21, end: 24 },
];

/** Weekly searches across the whole market. Governed by invariant I1. */
export const WEEKLY_VOLUME = 225000;

// ---------------------------------------------------------------------------
// Auction (spec 10)
// ---------------------------------------------------------------------------

/**
 * Four slots, three above organic — not v0.2's seven.
 *
 * With nine advertisers and seven slots every entrant clearing the floor always
 * showed, so lostToRank collapsed to "below the floor" and half the impression
 * share lesson died. Four makes rank competition emergent: disciplined play
 * keeps auctions thin, and the moment anyone broadens their match types the
 * auctions crowd and people start missing out.
 */
export const MAX_SLOTS = 4;
export const TOP_SLOTS = 3;

export const POSITION_CTR_MULTIPLIERS = [1, 0.62, 0.42, 0.30];

/** The smallest amount by which you can outbid the entrant below you. */
export const MIN_INCREMENT_PAISE = 1;

/**
 * Minimum ad rank to show at all. adRank is bidPaise x qualitySignal, so a
 * mid-market advertiser bidding 2500 paise at a 0.06 signal sits at 150.
 * Governed by invariant I2: median CPC must stay below the Value tier's net
 * break-even (~1352 paise) or the cheapest position becomes unplayable.
 */
export const AD_RANK_FLOOR = 60;

export const AUCTIONS_PER_QUERY_HOUR = { expected: 1, sampled: 6 };

// ---------------------------------------------------------------------------
// Quality (spec 9)
// ---------------------------------------------------------------------------

/**
 * The factor ranges multiplied together in qualitySignal.
 *
 * landingFactor is deliberately narrow, which compresses the landing page
 * rating in reportedScore — see DECISIONS A6. If ratings never leave 'average'
 * in play, widen this range rather than moving RATING_UPPER_THRESHOLD, because
 * the threshold is what makes the three components comparable to each other.
 */
export const QUALITY_FACTOR_RANGES = {
  baseCtr: { min: 0.02, max: 0.14 },
  queryKeywordFit: { min: 0.50, max: 1.15 },
  relevanceFactor: { min: 0.60, max: 1.20 },
  landingFactor: { min: 0.85, max: 1.05 },
  contextFactor: { min: 0.95, max: 1.05 },
};

/**
 * How much less relevant the same ad is to a searcher who is not buying.
 *
 * Applied to the graded adRelevance before it is mapped onto its factor range,
 * rather than multiplied onto the output, so the result cannot leave the range
 * and need not be clamped back into it.
 */
export const RELEVANCE_INTENT_MULTIPLIERS = {
  commercial: 1.0,
  brand: 1.0,
  informational: 0.80,
  irrelevant: 0.60,
};

/**
 * A small hourly wobble in click probability - people browse more attentively
 * in the evening and less at four in the morning.
 *
 * The narrowest factor in the signal by a wide margin, and deliberately so:
 * it is texture, not a lever anyone should be playing against.
 */
export const CONTEXT_FACTOR_CURVE = [
  0.96, 0.95, 0.95, 0.95, 0.96, 0.97, 0.98, 0.99,
  1.00, 1.01, 1.01, 1.02, 1.02, 1.01, 1.01, 1.02,
  1.02, 1.03, 1.04, 1.05, 1.05, 1.04, 1.02, 0.99,
];

/**
 * Spread of the multiplicative noise on the quality signal in sampled mode.
 *
 * Lognormal, shifted so its mean is exactly 1 - noise must blur the signal
 * without quietly inflating or deflating it.
 */
export const QUALITY_NOISE_SIGMA = 0.08;

export const QUALITY_WINDOW_ROUNDS = 13;
export const QUALITY_MIN_IMPRESSIONS = 500;
export const RATING_UPPER_THRESHOLD = 1.10;
export const RATING_LOWER_THRESHOLD = 0.90;

/** Deliberately poor. An ad nobody has evaluated should not perform like a good one. */
export const DEFAULT_UNGRADED_QUALITY = { expectedCtr: 3, adRelevance: 3, landingPage: 3 };

/**
 * Three-level ratings to a 1-10 score.
 *
 * Generated from a weighted index rather than authored as 27 loose numbers:
 * below/average/above score -1/0/+1, expected CTR counts double, the other two
 * count once. That weighting is the only part with a basis — see DECISIONS A4,
 * where the argument is that click probability belongs in the rank multiplier
 * for a hard revenue reason while relevance and landing page protect long-run
 * trust, which does not appear in single-impression revenue.
 *
 * The index spans nine states across a ten-point scale, so one score is
 * unreachable. Anchored so all-below is 1, all-average is 6 (real keywords
 * commonly sit there) and all-above is 10; 5 is the value that never occurs.
 */
const RATING_VALUE = { below: -1, average: 0, above: 1 };
const SCORE_BY_INDEX = [1, 2, 3, 4, 6, 7, 8, 9, 10]; // index -4..+4

export const RATING_TO_SCORE_TABLE = (() => {
  const table = {};
  for (const ctr of Object.keys(RATING_VALUE)) {
    for (const rel of Object.keys(RATING_VALUE)) {
      for (const lp of Object.keys(RATING_VALUE)) {
        const index = 2 * RATING_VALUE[ctr] + RATING_VALUE[rel] + RATING_VALUE[lp];
        table[`${ctr}|${rel}|${lp}`] = SCORE_BY_INDEX[index + 4];
      }
    }
  }
  return table;
})();

// ---------------------------------------------------------------------------
// Matching (spec 8)
// ---------------------------------------------------------------------------

/**
 * Fraction of a keyword's tags a query must share for broad match to fire.
 *
 * Only broad match consults tags. Exact and phrase are string operations, and
 * negatives never touch this layer at all — routing them through it would make
 * "-cheap" block everything tagged price-sensitive, inverting the real behaviour
 * where negatives are STRICTER than their positive counterparts. See DECISIONS E3.
 *
 * Expect to retune this once a real query set exists.
 */
export const BROAD_MATCH_MIN_OVERLAP = 0.50;

/**
 * Fixed alongside content/querySet.js. Every tag here is used by at least one
 * query, and every query tag is here — asserted by the query set tests, so the
 * two cannot drift.
 */
export const TAG_VOCABULARY = [
  // product
  'leggings', 'sports-bra', 'tshirt', 'tank', 'shorts', 'joggers',
  'hoodie', 'pants', 'co-ord-set',
  // attribute
  'high-waisted', 'seamless', 'compression', 'squat-proof', 'pocketed',
  'flared', 'cropped', 'oversized', 'quick-dry', 'sweat-wicking',
  'four-way-stretch',
  // use
  'gym', 'running', 'yoga', 'training', 'cycling', 'casual', 'everyday',
  'travel', 'lounge',
  // audience — one entry only: the vertical is women's athleisure, and 'men'
  // or 'plus-size' would be tags no query could ever legitimately carry
  'women',
  // price signal. No 'value' tag: it would read as the Value price tier and
  // the two mean different things
  'cheap', 'budget', 'sale', 'discount', 'premium', 'luxury', 'combo',
  // how premium goods are actually searched: by material and construction
  // rather than by an adjective meaning expensive
  'fabric',
  // intent
  'buy', 'compare', 'research', 'how-to', 'size-guide', 'care',
  // other
  'brand-term', 'india', 'online', 'free',
];

// ---------------------------------------------------------------------------
// Query set validation (spec 7.4)
// ---------------------------------------------------------------------------

/**
 * The thresholds engine/querySet.js enforces.
 *
 * Two readings of spec 7.4 were needed and are recorded in DECISIONS E7:
 *
 *  - A query's cell is the price x purpose pair where its combined affinity
 *    peaks, and only COMMERCIAL queries have one. Informational and irrelevant
 *    traffic is waste rather than territory, and brand traffic belongs to a
 *    trademark owner. Counting either would let a set look well-supplied while
 *    offering a position nothing it actually wants to buy.
 *
 *  - Cell and tier shares are therefore fractions of TERRITORY volume, not of
 *    total volume. With 5%+ of volume deliberately worthless, shares of the
 *    total could never reach 52/28/20.
 */
export const QUERY_SET_RULES = {
  minQueriesPerCell: 15,
  minHeadTermsPerCell: 3,
  minCellVolumeShare: 0.08,
  minIrrelevantVolumeShare: 0.05,
  tierVolumeTargets: { value: 0.52, mid: 0.28, premium: 0.20 },
  tierVolumeTolerance: 0.05,
};

// ---------------------------------------------------------------------------
// Conversion chain (spec 12.1)
// ---------------------------------------------------------------------------

export const BRAND_OWNER_MULTIPLIER = 2.5;
export const BRAND_POACHER_MULTIPLIER = 0.25;
export const INFORMATIONAL_CONV_MULTIPLIER = 0.10;

/** Exactly zero, not merely small. That traffic never converts, and the waste is the lesson. */
export const IRRELEVANT_CONV_MULTIPLIER = 0;

export const CONV_RATE_CLAMP = [0.001, 0.35];

/** Nothing else bounds returnRate x multipliers below 1. */
export const RETURN_RATE_CLAMP_MAX = 0.9;

// ---------------------------------------------------------------------------
// Bidding and learning (spec 12.2, 12.3)
// ---------------------------------------------------------------------------

export const LEARNING_ROUNDS = 2;
export const LEARNING_ERROR_MULTIPLIER = 2.5;
export const SMART_BIDDING_MIN_CONVERSIONS = 30;

/**
 * What a strategy assumes before it has observed any conversions.
 *
 * Deliberately matches no position exactly, so the cold start is wrong for
 * everyone rather than quietly correct for the mid-market.
 */
export const COLD_START_CONV_RATE = 0.025;

/**
 * Spread of a bid strategy's conversion-rate estimate, before the learning
 * multiplier. Shrinks with the square root of observed conversions, which is
 * how sampling error actually behaves.
 *
 * At 1 conversion the estimate is worthless; at 30 - the SMART_BIDDING floor -
 * it is still around 27% out; by 400 it has settled near 8%. That gradient is
 * the point: automation is not wrong because it is stupid, it is wrong because
 * it has not seen enough yet.
 */
export const PREDICTION_ERROR_BASE = 1.5;
export const PREDICTION_ERROR_CLAMP = [0.05, 0.80];

/**
 * Clicks an advertiser needs in one hour of the day before its own history for
 * that hour is worth more than its aggregate.
 *
 * This is the only legitimate route to dayparting for a bid strategy. v0.1 let
 * Target CPA read the true hourly conversion curve, so automation dayparted
 * perfectly from round one and never paid for the privilege (DECISIONS D2).
 */
export const MIN_HOUR_OBSERVATIONS = 25;

/**
 * How hard the budget-spending strategies push relative to the keyword bid.
 *
 * They do not solve for a bid that exactly exhausts the budget - pacing does
 * that (13.4). They bid to win and let pacing throttle, which is both simpler
 * and closer to how the real thing behaves.
 */
export const MAX_CLICKS_AGGRESSION = 1.6;
export const MAX_CONV_AGGRESSION = 1.6;

/** No strategy may bid below this, or above this multiple of the keyword bid. */
export const MIN_BID_PAISE = 100;
export const MAX_BID_MULTIPLE = 4.0;

// ---------------------------------------------------------------------------
// Attribution and returns (spec 11.3, 14)
// ---------------------------------------------------------------------------

/** Rounds 0..3 after the click. */
export const ATTRIBUTION_LAG_DISTRIBUTION = [0.55, 0.28, 0.12, 0.05];

// ---------------------------------------------------------------------------
// Budget (spec 13)
// ---------------------------------------------------------------------------

/** ₹1,68,000 — six thousand rupees a day across twenty-eight days. */
export const MONTHLY_BUDGET_PAISE = 16800000;

/**
 * Month 3 redistribution by rank. Sums to exactly ADVERTISER_COUNT so the total
 * pool is unchanged.
 *
 * That constancy is not cosmetic. If total market money moved between months,
 * CPCs would move with it and the player could no longer tell whether their
 * results changed because of their decisions or because the market got richer.
 * See DECISIONS D5.
 */
export const RANK_BUDGET_MULTIPLIERS = [
  1.30, 1.22, 1.15, 1.07, 1.00, 0.93, 0.85, 0.78, 0.70,
];

export const DAILY_BUDGET_OVERSPEND_CAP = 2.0;

// ---------------------------------------------------------------------------
// Capital expenditure (spec 13.3)
// ---------------------------------------------------------------------------

export const CAPEX_ALLOCATION_PAISE = 10000000; // ₹1,00,000, at rounds 1 and 5
export const CAPEX_DELAY_ROUNDS = 3;

export const CAPEX_TARGETS = {
  sizeGuide: 'returnRate',
  photography: 'convRateBase',
  landingPage: 'gradedLandingPage',
};

/**
 * Points added to the graded landing page score at full commitment.
 *
 * The landing page target is the odd one out: the other two move a business
 * number directly, while this one moves a GRADED number that the ad grader
 * also writes. Expressing it as points added after grading keeps the two
 * mechanisms separable - two things writing one number is how L6 happened.
 */
export const CAPEX_LANDING_PAGE_MAX_POINTS = 3;

/**
 * An S-curve, not a diminishing one. Interpolated linearly between points.
 *
 * The shape is the whole mechanic. With diminishing returns the first tranche
 * on a fresh target would always be the cheapest gain, splitting three ways
 * would be strictly optimal, and the amount choice would collapse into a solved
 * puzzle. The S makes splitting available and sometimes right while spreading
 * thin genuinely underperforms committing.
 *
 * It is also the more honest shape: ₹25,000 of engineering buys a half-built
 * fit tool that helps nobody. See DECISIONS D7.
 */
export const CAPEX_TIER_CURVE = [
  { paise: 0, effect: 1 },
  { paise: 2500000, effect: 1.04 },
  { paise: 5500000, effect: 1.16 },
  { paise: 7000000, effect: 1.22 },
  { paise: 10000000, effect: 1.25 },
];

// ---------------------------------------------------------------------------
// Ad copy limits (spec 18.1)
// ---------------------------------------------------------------------------

export const HEADLINE_MAX_CHARS = 30;
export const DESCRIPTION_MAX_CHARS = 90;

// ---------------------------------------------------------------------------
// Provenance ledger (R4)
// ---------------------------------------------------------------------------

export const PROVENANCE = {
  // Google publishes these.
  HEADLINE_MAX_CHARS: 'DOCUMENTED',
  DESCRIPTION_MAX_CHARS: 'DOCUMENTED',
  DAILY_BUDGET_OVERSPEND_CAP: 'DOCUMENTED',

  // Third-party analyses. No official source, and they disagree with each other.
  POSITION_CTR_MULTIPLIERS: 'ESTIMATED',
  ATTRIBUTION_LAG_DISTRIBUTION: 'ESTIMATED',
  QUALITY_WINDOW_ROUNDS: 'ESTIMATED',

  // Provisional until calibration.test.js passes (spec 18.2).
  AD_RANK_FLOOR: 'CALIBRATE',
  WEEKLY_VOLUME: 'CALIBRATE',

  // Everything else: chosen for playability, no empirical basis.
  SCHEMA_VERSION: 'INVENTED',
  ADVERTISER_COUNT: 'INVENTED',
  TOTAL_ROUNDS: 'INVENTED',
  ROUNDS_PER_MONTH: 'INVENTED',
  PRICE_TIERS: 'INVENTED',
  PURPOSES: 'INVENTED',
  POSITION_ECONOMICS: 'INVENTED',
  PURPOSE_MODIFIERS: 'INVENTED',
  REPOSITION_COST_PAISE: 'INVENTED',
  REPOSITION_ROUND: 'INVENTED',
  RIVAL_PLACEMENT_CONSTRAINTS: 'INVENTED',
  DAY_OF_WEEK_CURVE: 'INVENTED',
  HOUR_PROFILES: 'INVENTED',
  HOURLY_INTENT_CURVE: 'INVENTED',
  MIN_PEAK_SEPARATION_HOURS: 'INVENTED',
  PACING_REFERENCE_CURVE: 'INVENTED',
  DAYPART_BLOCKS: 'INVENTED',
  MAX_SLOTS: 'INVENTED',
  TOP_SLOTS: 'INVENTED',
  MIN_INCREMENT_PAISE: 'INVENTED',
  AUCTIONS_PER_QUERY_HOUR: 'INVENTED',
  QUALITY_FACTOR_RANGES: 'INVENTED',
  QUALITY_MIN_IMPRESSIONS: 'INVENTED',
  RELEVANCE_INTENT_MULTIPLIERS: 'INVENTED',
  CONTEXT_FACTOR_CURVE: 'INVENTED',
  QUALITY_NOISE_SIGMA: 'INVENTED',
  RATING_UPPER_THRESHOLD: 'INVENTED',
  RATING_LOWER_THRESHOLD: 'INVENTED',
  DEFAULT_UNGRADED_QUALITY: 'INVENTED',
  RATING_TO_SCORE_TABLE: 'INVENTED',
  BROAD_MATCH_MIN_OVERLAP: 'INVENTED',
  TAG_VOCABULARY: 'INVENTED',
  QUERY_SET_RULES: 'INVENTED',
  BRAND_OWNER_MULTIPLIER: 'INVENTED',
  BRAND_POACHER_MULTIPLIER: 'INVENTED',
  INFORMATIONAL_CONV_MULTIPLIER: 'INVENTED',
  IRRELEVANT_CONV_MULTIPLIER: 'INVENTED',
  CONV_RATE_CLAMP: 'INVENTED',
  RETURN_RATE_CLAMP_MAX: 'INVENTED',
  LEARNING_ROUNDS: 'INVENTED',
  LEARNING_ERROR_MULTIPLIER: 'INVENTED',
  SMART_BIDDING_MIN_CONVERSIONS: 'INVENTED',
  COLD_START_CONV_RATE: 'INVENTED',
  PREDICTION_ERROR_BASE: 'INVENTED',
  PREDICTION_ERROR_CLAMP: 'INVENTED',
  MIN_HOUR_OBSERVATIONS: 'INVENTED',
  MAX_CLICKS_AGGRESSION: 'INVENTED',
  MAX_CONV_AGGRESSION: 'INVENTED',
  MIN_BID_PAISE: 'INVENTED',
  MAX_BID_MULTIPLE: 'INVENTED',
  MONTHLY_BUDGET_PAISE: 'INVENTED',
  RANK_BUDGET_MULTIPLIERS: 'INVENTED',
  CAPEX_ALLOCATION_PAISE: 'INVENTED',
  CAPEX_DELAY_ROUNDS: 'INVENTED',
  CAPEX_TARGETS: 'INVENTED',
  CAPEX_TIER_CURVE: 'INVENTED',
  CAPEX_LANDING_PAGE_MAX_POINTS: 'INVENTED',
};
