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

// ---------------------------------------------------------------------------
// Where the searches happen (DECISIONS G4)
// ---------------------------------------------------------------------------

/**
 * The third dimension of demand, after the query and the hour.
 *
 * Three, and three is a decision rather than a default: two collapses into a
 * binary, and above three each keyword's traffic in each tier gets thin enough
 * that noise dominates the report a player is meant to read. `content/locations.js`
 * is what these mean to a person.
 */
export const LOCATION_TIERS = ['tier1', 'tier2', 'tier3'];

/**
 * Where a search happens, given the price tier it belongs to.
 *
 * Rows are `PRICE_TIERS`, columns are `LOCATION_TIERS`, and every row sums to 1:
 * this SPLITS existing demand rather than adding any. Geography does not invent
 * searchers, it says where the ones already counted are.
 *
 * PREMIUM SKEWS TO THE METROS AND VALUE AWAY FROM THEM, which is the correlation
 * the whole mechanic rests on. But the tail is deliberately fat: the overall
 * split lands near 34/35/31, so tier 2 and tier 3 together hold about two thirds
 * of the market.
 *
 * THE FAT TAIL IS THE POINT, and it is not realism — it is capacity. DECISIONS D8
 * measured this market as DEMAND-limited rather than budget-limited: raising every
 * advertiser's money by 60% raised actual spend by 14% and moved median CPC not at
 * all. Confine nine advertisers to the metros and they cannot all spend there, so
 * the money has to overflow — and tier 2 and 3 are worth having because they are
 * where it can go, not because a click there is better. A thin tail would have
 * made the metros a right answer and 30% of the market dead ground.
 *
 * Derived from each query's HOME CELL rather than authored per query, so the
 * frozen 151-row query set is untouched. It is the one artefact where a subtle
 * flaw poisons every number without throwing.
 */
export const LOCATION_VOLUME_BY_PRICE = Object.freeze({
  value: Object.freeze([0.26, 0.36, 0.38]),
  mid: Object.freeze([0.38, 0.36, 0.26]),
  premium: Object.freeze([0.50, 0.32, 0.18]),
});

/**
 * How much more of what sells comes back, by location.
 *
 * THIS IS THE TRADE. Without it the metros would simply be better and there would
 * be no decision to make: volume alone changes how MANY clicks are available, not
 * what one is worth. Cash on delivery is ordinary outside the metros and COD
 * orders come back materially more often, so tier 3 traffic converts perfectly
 * well and then leaves again.
 *
 * It multiplies `business.returnRate`, which is already per position and per
 * query — so it compounds with the fact that a value brand's thinner margin loses
 * more to each return. That is why the measured spread between best and worst
 * location is widest for value|lifestyle at 1.65x and narrowest for
 * premium|performance at 1.35x.
 *
 * NOT A CONVERSION MULTIPLIER, deliberately. Conversion already carries query
 * affinity, PURPOSE_MODIFIERS and the hourly intent curve, and F10 and F11 are
 * both records of what happens when two mechanisms push the same number.
 */
export const LOCATION_RETURN_MULTIPLIER = Object.freeze([1.0, 1.25, 1.5]);

/**
 * Basket size by location. Metro baskets run a little larger.
 *
 * Small on purpose: it is a texture on top of the returns difference rather than
 * a second lever, and making it large would say something about Indian retail
 * that nobody has measured here.
 */
export const LOCATION_AOV_MULTIPLIER = Object.freeze([1.10, 1.00, 0.92]);

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
 * THAT MEAN IS OVER UNIFORM HOURS, AND IT IS NOT THE MEAN THAT MATTERS.
 * Conversions arrive weighted by clicks, clicks follow demand, and demand sits
 * in the hours where this curve is high. Measured against the real query set,
 * the traffic-weighted mean is 1.146, not 1.
 *
 * An earlier version of this comment claimed the normalisation was what kept
 * spec 4.4's break-even figures honest. It never did: it protects a mean nobody
 * experiences. The 14.6% is real, deliberate, and folded into
 * realisedBreakEvenCpcPaise, which is the figure 4.4 now calls operative.
 * Normalising against traffic instead would couple this file to the query set,
 * which is a worse trade than naming the number.
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

/**
 * Weekly searches across the whole market.
 *
 * Pinned from BOTH sides, which is what took it off 225000.
 *
 * Below about 315,000 invariant I1 fails: a competently covered advertiser
 * running alone cannot exhaust its monthly budget, so `lostToBudget` never
 * fires, `missedToBudget` is always zero, the monthly pot never binds, and the
 * whole of section 13 does nothing. At 225,000 that advertiser reached 73% of
 * its month with `lostToBudget` at 0.0%.
 *
 * Above about 375,000 invariant I3 fails: more cells become budget-limited,
 * and the budget cap is FLAT while break-evens differ 2.7x top to bottom, so
 * the cap bites unequally and positions stop balancing.
 *
 *   volume    I1 spend   I1 lostToBudget   I3 worst deviation
 *   225000      0.730          0.0%              2.8%     I1 fails
 *   315000      1.000          2.2%              3.7%
 *   350000      1.000         12.0%              9.5%
 *   400000      1.000         23.0%             17.0%     I3 fails
 *
 * 350,000 sits near the middle of that window with headroom on both sides.
 * Still CALIBRATE: it is governed by two invariants that disagree, so a change
 * to either the query set or MONTHLY_BUDGET_PAISE can move the window.
 */
export const WEEKLY_VOLUME = 350000;

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
 * rating in reportedScore — see DECISIONS A6. Its span is ±10% around its
 * midpoint and the 'average' band is also ±10%, so THE BAND IS AS WIDE AS THE
 * WHOLE RANGE. Measured over 720 games, that makes grades 5 to 8 produce
 * identical output: 411 of 411 contested keywords read 'average' at every one
 * of those four grades.
 *
 * The ratings do still move at both ends — 'below' on 88.6% of keywords at
 * grade 1, 'above' on 20.2% at grade 10 — so the earlier claim that the
 * component is pinned to 'average' for everybody is false and is corrected in
 * spec 9.4 and DECISIONS A6/I1. If this range is ever widened, the threshold is
 * still the wrong thing to move: it is what makes the three components
 * comparable to each other. But widening it in either direction breaks 17.1's
 * open cell, which is measured in 9.4 and is why it has not been done.
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

// ---------------------------------------------------------------------------
// Who writes the ad (DECISIONS I11)
// ---------------------------------------------------------------------------

/**
 * A creative budget, separate from the capital allocation.
 *
 * Whatever is not spent on a writer rolls into the advertising budget, the same
 * way uncommitted capital does (13.3). That rollover is not free to the
 * balance: it hands a do-it-yourself advertiser real money on top of a higher
 * ceiling, which is why the tier grades below sit where they do.
 */
export const CREATIVE_ALLOCATION_PAISE = 5000000; // ₹50,000

/**
 * The round a player's own copy goes live.
 *
 * The DELIVERY is delayed, never the effect: when the copy ships, its quality
 * applies from that auction onward. An ad copy change must move `qualitySignal`
 * immediately or the split against `reportedScore` is broken, so a "quality
 * that fades in" would be a different and wrong mechanic.
 */
export const CREATIVE_DIY_LIVE_ROUND = 3;

/**
 * Who writes the ad, what it costs, and what it reliably delivers.
 *
 * `grade` is what the tier GUARANTEES for the two components copy sets,
 * `expectedCtr` and `adRelevance`. `null` means nobody is hired: the advertiser
 * writes its own, is graded on what it actually wrote, and can reach the
 * offline grader's ceiling of 8 — but not until CREATIVE_DIY_LIVE_ROUND.
 *
 * MEASURED, NOT CHOSEN. Over 12-round games against a live market, hired grades
 * of 5/6/7 were beaten by a competent DIY writer at every rung, so the ladder
 * moved up. At 6/7/8 the outcomes stratify: a DIY ad graded 8 lands between the
 * agency and the retainer, a 7 loses to the agency, a 6 loses to the
 * freelancer. Write well and you beat what you would have paid for; write
 * badly and you should have hired. `tests/writers.test.js` plays the real
 * configurations and holds that ordering.
 *
 * The prices are the honest ones for SEARCH copy, which is three headlines and
 * two descriptions — no footage, no artwork. A retainer costs more than
 * copywriting because it buys ongoing iteration rather than one ad.
 */
export const WRITER_TIERS = Object.freeze([
  { id: 'diy', label: 'Write it yourself', pricePaise: 0, grade: null },
  { id: 'freelancer', label: 'Freelance copywriter', pricePaise: 1000000, grade: 6 },
  { id: 'agency', label: 'Creative agency', pricePaise: 2500000, grade: 7 },
  { id: 'retainer', label: 'Premium retainer', pricePaise: 5000000, grade: 8 },
]);

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

  // Where the searches happen. CALIBRATE rather than ESTIMATED, and that widens
  // a set the spec had pinned at two - argued in DECISIONS G4. Nothing about
  // these numbers can be settled before a played game: the metros are better per
  // click by construction, and whether tier 2 and 3 are worth having depends on
  // whether crowding makes the metros expensive, which is emergent (H10).
  LOCATION_TIERS: 'INVENTED',
  LOCATION_VOLUME_BY_PRICE: 'CALIBRATE',
  LOCATION_RETURN_MULTIPLIER: 'CALIBRATE',
  LOCATION_AOV_MULTIPLIER: 'CALIBRATE',
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
  CAPEX_TIER_CURVE: 'INVENTED',
  CAPEX_LANDING_PAGE_MAX_POINTS: 'INVENTED',
  CREATIVE_ALLOCATION_PAISE: 'INVENTED',
  // ESTIMATED, not CALIBRATE, and the distinction is not pedantry: CALIBRATE
  // means "provisional until calibration.test.js passes", and that file governs
  // exactly the two constants spec 18.2 names. These two were set from
  // measurement over whole games and are held by tests/writers.test.js instead.
  // Tagging them CALIBRATE would claim a reader they do not have.
  CREATIVE_DIY_LIVE_ROUND: 'ESTIMATED',
  WRITER_TIERS: 'ESTIMATED',
};
