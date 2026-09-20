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
 * the whole mechanic rests on.
 *
 * THE METROS ARE SCARCE, AND THAT IS THE WHOLE TRADE. They hold about a fifth of
 * the country's searching and they are the best place to be — better baskets,
 * fewer returns — so an advertiser who could have all of it would simply take it.
 * They cannot: a fifth of the market will not absorb a month's budget, so the real
 * question is how much to spend somewhere worse. That is the decision the mechanic
 * exists to create, and it is also the truthful shape, since the metros are a
 * minority of India and a majority of its e-commerce.
 *
 * THIS REPLACED A NEARLY-LEVEL 34/35/31, AND THE REASON IS MEASURED. Level made
 * the metros a right answer: targeting them was worth +70% to a value advertiser
 * and +52% to a mid one, while premium was better off ignoring the control
 * entirely. The counterweight the level version relied on — crowding making the
 * metros expensive — does not appear at realistic behaviour: market CPC came out
 * within 11% across all three tiers. It CAN (forcing all nine into the metros
 * raises the price there 35%) but nobody does that, and D8 already said why the
 * pressure cannot build: this market is demand-limited, so budget scarcity has no
 * price to bid up.
 *
 * Derived from each query's HOME CELL rather than authored per query, so the
 * frozen 151-row query set is untouched. It is the one artefact where a subtle
 * flaw poisons every number without throwing.
 */
export const LOCATION_VOLUME_BY_PRICE = Object.freeze({
  value: Object.freeze([0.12, 0.35, 0.53]),
  mid: Object.freeze([0.22, 0.38, 0.40]),
  premium: Object.freeze([0.38, 0.36, 0.26]),
});

/**
 * How much more likely a parcel is REFUSED AT THE DOOR, by location.
 *
 * THIS IS THE TRADE. Without it the metros would simply be better and there would
 * be no decision to make: volume alone changes how MANY clicks are available, not
 * what one is worth. Cash on delivery is ordinary outside the metros and COD
 * orders come back materially more often, so tier 3 traffic converts perfectly
 * well and then leaves again.
 *
 * IT REACHES THE REFUSED HALF ONLY (2026-09-20, F20). It used to multiply the
 * whole return rate, with the refused/sent-back split applied afterwards, so
 * send-backs came out 1.36-1.40x higher in the towns as well. Nothing supports
 * that: `POST_DELIVERY_RETURN_RATE` is one national figure, and F14 recorded the
 * fault and left it. Send-backs now run 0.90-0.93x metros to towns, and that
 * slight FALL is not a compromise — more parcels are refused at the door out
 * there, so fewer are ever delivered, and a parcel that never arrived cannot be
 * sent back.
 *
 * THE TABLE DID NOT WIDEN WITH IT, AND THAT TURNED OUT TO BE RIGHT (F21). It was
 * left alone because widening it overturns the sourced cash mix — the table is
 * normalised PER PRICE TIER to hold each position's own documented return rate,
 * a value brand's country is 53% towns where a premium brand's is 26%, so
 * holding premium's rate lifts its town multiplier further than value's, and
 * past about [1, 1.5, 1.9] refusals in the towns stop running value 18.8% >
 * mid 17.9% > premium 15.6% the way the sourced COD shares say they should.
 *
 * At the time that looked like a cap the evidence would eventually push past,
 * because the comment on `POST_DELIVERY_RETURN_RATE` claimed tier-3 RTO is
 * quoted at 3-5x the metros. It is not: that 3-5x is COD against PREPAID, which
 * this model already carries at a sourced 3.6x. There is no gap left for this
 * table to close, so there is nothing to widen it toward, and the ordering bound
 * above is simply the right bound rather than a temporary one.
 *
 * WHAT IS LEFT FOR IT TO DO. A real, unquantified remainder: address quality,
 * courier limitations and digital literacy are all quoted as raising tier-2/3
 * RTO beyond what payment method explains, with no multiple attached to any of
 * them. An invented texture is the honest way to carry that, provided nothing
 * pretends it is measured.
 *
 * NORMALISED AGAINST THE REFUSED SHARE, not against volume — see
 * `locationEffects`. Normalising a refusals-only gradient by volume would no
 * longer hold the category return rate, which is the thing normalisation is for.
 * The total return rate runs 1.16x metros to towns now, against 1.50x before:
 * the trade is weaker until the table can widen, and the mechanism is no longer
 * wrong, which was the thing worth buying first.
 *
 * NOT A CONVERSION MULTIPLIER, deliberately. Conversion already carries query
 * affinity, PURPOSE_MODIFIERS and the hourly intent curve, and F10 and F11 are
 * both records of what happens when two mechanisms push the same number.
 *
 * READ AS RATIOS, NOT AS ABSOLUTE FACTORS. `locationEffects` divides these by
 * their volume-weighted mean before anything applies them, because that mean is
 * 1.243 and applying it raw would raise every advertiser's return rate by a
 * quarter - `POSITION_ECONOMICS.returnRate` is already the category-wide figure
 * (F8, F14), so value's 42.7% would silently have become 53%. What survives
 * normalisation is the spread, which is the part the design is about.
 */
export const LOCATION_RETURN_MULTIPLIER = Object.freeze([1.0, 1.25, 1.5]);

/**
 * Basket size by location. Metro baskets run a little larger.
 *
 * Small on purpose: it is a texture on top of the returns difference rather than
 * a second lever, and making it large would say something about Indian retail
 * that nobody has measured here.
 *
 * Ratios, like the return table above, and normalised the same way - otherwise
 * the market's average basket would drift from the one POSITION_ECONOMICS sets.
 */
export const LOCATION_AOV_MULTIPLIER = Object.freeze([1.10, 1.00, 0.92]);

/**
 * How much of what sells is paid for at the door, by price tier and location.
 *
 * Rows are `PRICE_TIERS`, columns are `LOCATION_TIERS`.
 *
 * COD WAS ALREADY IN THIS MODEL, WITH NO NAME. `LOCATION_RETURN_MULTIPLIER`
 * above exists because of it — its comment says so outright: "Cash on delivery
 * is ordinary outside the metros and COD orders come back materially more
 * often." The consequence was simulated and the mechanism was invisible, so a
 * player could see that small towns return more and never learn why.
 *
 * TWO AXES, AND THEY ARE NOT EQUALLY WELL EVIDENCED. Say so rather than let the
 * table imply otherwise:
 *
 *   LOCATION is sourced. Tier 2 and tier 3 markets run 58-64% COD across 142
 *   D2C brands (Unicommerce, 2024) and 60-80% by other trackers, against a
 *   lower metro share. The direction and the rough spread are not in dispute.
 *
 *   PRICE is INFERRED and stays an estimate. No source found gives COD share by
 *   order value, and the nearest fact cuts the other way: RTO by order band is
 *   nearly flat, 25% under ₹500, 28% at ₹500-1,000, 24% above (Unicommerce).
 *   What justifies the axis is that cash skews impulse and premium buyers are
 *   more card-comfortable — reasoning, not measurement.
 *
 * THE LEVEL IS SET BY THE CATEGORY, NOT BY ECOMMERCE AT LARGE. Fashion and
 * accessories run 68-76% COD, the highest of any category, because fit and
 * style make people want the parcel in front of them first (Pragma). India
 * overall is 58-65%. The mid row averages 0.71, which is where this vertical
 * belongs; an earlier version of this table averaged about 0.55 and was quietly
 * modelling electronics.
 */
export const COD_SHARE_BY_PRICE_LOCATION = Object.freeze({
  value: Object.freeze([0.70, 0.80, 0.86]),
  mid: Object.freeze([0.60, 0.72, 0.80]),
  premium: Object.freeze([0.42, 0.55, 0.65]),
});

/**
 * How often a parcel is refused at the door, by how it was going to be paid for.
 *
 * DOCUMENTED, and the single most useful pair of numbers found: across FY23,
 * Unicommerce measured RTO at **20.9% on COD against 5.8% on prepaid** — a 3.6x
 * gap. GoKwik's 180M-shopper network puts it wider still, ~26% against under
 * 2%, and industry averages sit at 28-35% against 4-8%. The conservative pair
 * is used because it is the one attached to a named study and a stated period.
 *
 * THIS REPLACED AN INVENTED NUMBER AND NARROWED THE ANSWER A LOT. The first
 * version of this file had a `COD_REFUSAL_PROPENSITY` of 0.75, chosen by
 * nothing, which made refusals run from 16% of returns in the metros to 58% in
 * the towns. On these figures the real range is 31% to 44% — the geography
 * penalty is real and roughly half as dramatic as the guess. Worth remembering
 * the next time a plausible-feeling constant goes in unsourced.
 */
export const RTO_RATE_COD = 0.209;
export const RTO_RATE_PREPAID = 0.058;

/**
 * How often a DELIVERED fashion order is sent back afterwards.
 *
 * DOCUMENTED: 25-40% for fashion and apparel (GoKwik, ClickPost), 30-35% for
 * fashion and footwear specifically (Pragma). Dresses alone reach 54%.
 *
 * IT SETS THE LEVEL AS WELL AS THE SHAPE, since F14. It was first used only to
 * work out what PROPORTION of a return is a refusal, while `POSITION_ECONOMICS`
 * kept an invented 30% / 24% / 20% that meant post-delivery returns alone —
 * and I28 then treated that as the total, so the two disagreed by 30% to 100%.
 * `returnRate` now equals the total this figure and the RTO pair imply, and a
 * test holds it there.
 *
 * ONE FIGURE FOR EVERY TIER AND EVERY PLACE, because the sources quote it as
 * one. That makes the chain nearly flat by price (1.08x value to premium) and
 * by location (1.04-1.06x towns to metros). On price the flatness is accepted:
 * nothing found says otherwise.
 *
 * ON LOCATION, THE FLATNESS OF *THIS* FIGURE IS RIGHT, and the claim that used
 * to sit here was not (F21, 2026-09-20). It read: "tier-3 RTO is quoted at 3-5x
 * the metros, far more than the cash mix alone explains." The 3-5x is real and
 * it is the COD-to-PREPAID ratio, not a tier ratio — "COD orders have 3-5x
 * higher RTO than prepaid" (Shipmozo, 2026). That is the mechanism this model
 * already carries, sourced: `RTO_RATE_COD` 20.9% against `RTO_RATE_PREPAID`
 * 5.8% is 3.6x, inside the quoted range. So the cash mix does not under-explain
 * the gap; it IS the explanation, and nothing needed inventing to close it.
 *
 * What is genuinely supported beyond the cash mix is a DIRECTION with no number
 * attached: "tier-2/3 pin codes have higher RTO due to address quality, courier
 * partner limitations, and lower digital literacy" (Shipmozo). No source found
 * puts a multiple on it. `LOCATION_RETURN_MULTIPLIER` is that unquantified
 * remainder, and is tagged INVENTED because that is what it is.
 */
export const POST_DELIVERY_RETURN_RATE = 0.30;

/**
 * What one refused parcel costs in freight, in paise.
 *
 * DOCUMENTED: ClickPost puts direct logistics on an RTO at ₹150-300, and GoKwik
 * puts the typical loss on a ₹1,000 order at ₹200-250. (Fully loaded with
 * acquisition and handling it reaches ₹450-900, which is a different quantity —
 * the ad spend is already charged separately here, so counting it again would
 * bill the player twice for the same click.)
 *
 * FLAT, NOT A SHARE OF THE ORDER, because freight is charged per parcel and not
 * per rupee. That is what makes it bite unevenly, and the unevenness is the
 * lesson: ₹200 against value's ₹480 margin on a ₹1,200 basket is 42% of the
 * order gone, against 16% for mid and 7% for premium. A value brand is punished
 * six times harder than a premium one for the same parcel coming back.
 *
 * THE ENGINE HAD NO SHIPPING COST AT ALL BEFORE THIS. `marginPct` absorbed it
 * silently, so a refusal cost nothing but revenue that never arrived — which is
 * precisely why cash on delivery looked harmless here and does not in life.
 */
export const RTO_FREIGHT_PAISE = 20000;

/**
 * How much of the cash-on-delivery mix a prepaid discount moves (I34).
 *
 * THE LEVER THE BACK HALF WAS MISSING. Capital shuts at round 5, and after that
 * the only things left were a bid adjustment, which moves your MIX rather than
 * any rate, and a negative, which removes traffic rather than improving it. A
 * prepaid discount is an operating decision — set it every round like a bid —
 * and it moves the underlying rate.
 *
 * SOURCED, INCLUDING THE SHAPE. ₹30-50 shifts 10-20% of the COD mix to prepaid,
 * and the returns diminish hard and early:
 *
 *   ₹30 -> ₹50   a 38% improvement in conversion
 *   ₹50 -> ₹70   only 12% more
 *   past ₹100    under 5% per further ₹25
 *
 * Those three deltas build the curve rather than a guess: 10% shifted at ₹30,
 * 13.8% at ₹50, 15.5% at ₹70, 16.3% at ₹100, which lands inside the 10-20% the
 * same sources quote for the tactic as a whole.
 *
 * DIMINISHING, NOT AN S, AND DELIBERATELY UNLIKE `CAPEX_TIER_CURVE`. Capital
 * rewards committing because half a fit tool helps nobody; a discount does not
 * work that way — the first ₹30 does most of the work and the last ₹30 does
 * almost none. A second S here would teach the same lesson twice and would
 * contradict the figures.
 *
 * FLAT RUPEES, NOT A PERCENTAGE, and that is the whole of its balance. ₹50 is
 * 4.2% of a value brand's ₹1,200 basket and 1.0% of a premium brand's ₹4,800 —
 * so the advertiser with the most refusals to prevent pays the most to prevent
 * them, and the one who can afford it barely needs it. A percentage would be
 * neutral across the grid and would make the choice the same everywhere.
 *
 * IT DOES NOT TOUCH CONVERSION RATE, and the question did arise. A discount
 * genuinely lifts conversion a little in life. It is left out so the lever has
 * ONE effect and the trade stays legible: fewer refusals, bought with margin. If
 * that is ever revisited, note that it would also make the discount partly pay
 * for itself, which is a different mechanic from the one this is.
 */
export const PREPAID_DISCOUNT_CURVE = [
  { paise: 0, shifted: 0 },
  { paise: 3000, shifted: 0.100 },
  { paise: 5000, shifted: 0.138 },
  { paise: 7000, shifted: 0.155 },
  { paise: 10000, shifted: 0.163 },
];

/** The most a player may offer. Past this the sources measure almost nothing. */
export const PREPAID_DISCOUNT_MAX_PAISE = 10000;

/**
 * What order confirmation is worth against refusals, at full commitment.
 *
 * THE COUNTERWEIGHT TO THE FREIGHT (I29). Build 2 charged ₹200 on every parcel
 * refused at the door and gave the player nothing to do about it: the size
 * guide reaches send-backs only, because no fit chart stops somebody changing
 * their mind on a doorstep. That left a cost with no defence, which is not a
 * decision — it is a tax.
 *
 * So capital gets a fourth target. In life it is a WhatsApp or IVR confirmation
 * before dispatch plus address verification, and it is the standard tool:
 *
 *   one automated WhatsApp confirmation cuts RTO by 6-12 PERCENTAGE POINTS, at
 *   a 60-70% response rate when it goes out within 15 minutes of the order
 *
 *   brands running IVR, WhatsApp and COD-to-prepaid nudges together report up
 *   to a 40% reduction
 *
 * Against India's 25-35% RTO baseline, 6-12 points is a 20-40% relative cut. It
 * reuses `CAPEX_TIER_CURVE`, so full commitment divides refusals by 1.25 — a
 * 20% cut, the CONSERVATIVE end of that range, and the same ladder every other
 * target climbs.
 *
 * IT DOES NOT DISTINGUISH CASH FROM PREPAID, deliberately. Confirmation mostly
 * filters cash orders, but the refusal rate it acts on is already cash-dominated
 * by construction — `refusalRateFor` blends 20.9% on COD against 5.8% on prepaid
 * — so splitting it again would model the same fact twice for no gain the player
 * could act on. The cards state the COD share beside the refusal rate instead,
 * which is the form a player can do arithmetic with.
 */
// The effect itself is `CAPEX_TIER_CURVE`, applied in `businessFor`.


/**
 * Price tier sets the economics: what a click can be worth.
 *
 * Cheap things convert well because the decision is near-impulse, but the
 * margin has been competed away. Expensive things are considered purchases —
 * slow to convert, high margin.
 *
 * RETURNS BARELY VARY BY PRICE, and that is the sourced position rather than an
 * oversight (F14). This comment used to say price shoppers order two sizes
 * meaning to return one, and that premium returns less because the size guide
 * is better and the buyer is committed. Neither survived a search for evidence.
 * The one breakdown by order value found puts RTO at 25% / 28% / 24% across
 * bands (Unicommerce), and what is quoted about post-delivery returns by price
 * leans the OTHER way — a high price leaves less tolerance for a mismatch. "The
 * size guide is better" also counted one thing twice: a size guide is a capital
 * target any tier can buy.
 *
 * `returnRate` IS EVERY RETURN — refused at the door and sent back after
 * delivery — and it is the total the DOCUMENTED constants imply: `RTO_RATE_COD`
 * and `RTO_RATE_PREPAID` on this tier's cash mix, then
 * `POST_DELIVERY_RETURN_RATE` on whatever was delivered. `constants.test.js`
 * holds the two together, so this can no longer drift from its own sources the
 * way it did between I28 and F14. What genuinely differs by tier is the cash
 * mix, so premium returns a little less: 39.6% against value's 42.7%.
 *
 * WHAT PRICE DOES DECIDE IS WHAT A RETURN COSTS. Freight is a flat ₹200 per
 * refused parcel — 42% of value's margin on an order, 7% of premium's — and a
 * thin margin loses more to every reversal. Cheap goods do not come back much
 * more often; each one that does hurts more.
 *
 * The tag stays INVENTED because the other fields are: order value and margin
 * sit inside quoted bands without a citation tight enough to call documented,
 * and `convRateBase` is conversion on a PAID CLICK, which the 1.8-3% site-wide
 * benchmark that looks like it does not measure (F14).
 */
export const POSITION_ECONOMICS = {
  value: {
    aovMeanPaise: 120000, marginPct: 0.40, convRateBase: 0.042,
    returnRate: 0.427, aovSpread: 0.35, returnWindowRounds: 2,
  },
  mid: {
    aovMeanPaise: 240000, marginPct: 0.52, convRateBase: 0.028,
    returnRate: 0.417, aovSpread: 0.35, returnWindowRounds: 2,
  },
  premium: {
    aovMeanPaise: 480000, marginPct: 0.62, convRateBase: 0.016,
    returnRate: 0.396, aovSpread: 0.35, returnWindowRounds: 2,
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
 * WHY ret IS 0.91/1.09 AND NOT 0.85/1.20 (F14)
 *
 * ret is an OFFSET. Lifestyle converts a little more and returns a little
 * more, and the two cancel so that purpose does not move what a click is worth.
 * That balance was struck when returns ran at 20-30%. When `returnRate` rose to
 * the sourced 40-43%, the same 1.41x ratio on a larger base took lifestyle 13.5%
 * below performance in I3 (tilt 0.865 against a 0.9 bound) and pushed I4's
 * neutral purpose gap to 14.5% of its 15%. No CALIBRATE constant moves that tilt
 * — measured at three volumes and two floors, it sat at 0.86 in every one.
 *
 * Measured in POINTS, which is what the argument was about, the lifestyle
 * penalty moved much less than the ratio did: 8.4 points at mid before and 7.5
 * after, 7.0 and 7.1 at premium. Value is the exception and narrowed, 10.5 to
 * 7.7, because its old 30% was the level most understated. At 0.91/1.09 the
 * I3 tilt is 1.01 and the neutral gap 1.5%; the realised gap is 12.0%, up from
 * 11.2%, which is the widening this comment always predicted for a narrower ret.
 *
 * They average exactly 1.0, deliberately, so `returnRate` IS the sourced total
 * with nothing to back-solve.
 *
 * The cost, named: the query set carries no purpose effect on CONVERSION — the
 * affinity ratio within a price row measures 1.001, 0.992, 1.001 — so nothing
 * else carries "performance goods are bought on stated specs". That claim is
 * now made more mildly. See DECISIONS F11.
 */
export const PURPOSE_MODIFIERS = {
  performance: { conv: 0.94, ret: 0.91 },
  lifestyle: { conv: 1.06, ret: 1.09 },
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
 * Below about 395,000 invariant I1 fails: a competently covered advertiser
 * running alone cannot exhaust its monthly budget, so `lostToBudget` never
 * fires, `missedToBudget` is always zero, the monthly pot never binds, and the
 * whole of section 13 does nothing. At 330,000 that advertiser reaches 86% of
 * its month with `lostToBudget` at 0.0%.
 *
 * Above about 460,000 invariant I3 fails: more cells become budget-limited,
 * and the budget cap is FLAT while break-evens differ 2.5x top to bottom, so
 * the cap bites unequally and positions stop balancing.
 *
 *   volume    I1 spend   I1 lostToBudget   I3 worst deviation
 *   330000      0.857          0.0%              6.0%     I1 fails
 *   380000      0.985          0.2%              6.0%     I1 fails
 *   400000      1.000          3.8%              7.5%
 *   430000      1.000         10.5%             11.3%
 *   460000      1.000         16.3%             14.9%     I3 at its bound
 *   500000      1.000         23.0%             19.6%     I3 fails
 *
 * WAS 350,000, AND F14 MOVED IT, together with AD_RANK_FLOOR. Raising returns
 * to the sourced level cut every ceiling by 20-30%; the reserve had to follow
 * or the weakest ads fell under it (see AD_RANK_FLOOR), and a lower reserve
 * means cheaper clicks in a thin auction — so it takes more searches before a
 * competent advertiser can spend its month. The window moved from roughly
 * 315,000-375,000 to 395,000-460,000, and 430,000 sits in its middle.
 *
 * The window's floor on I3 is no longer near zero. With no budget binding at
 * all, I3 reads 6.0%, against 2.8% before freight was charged on refused
 * parcels (I28 build 2): a flat ₹200 per parcel is a structural cost to the
 * thinnest margin, and no volume removes it.
 *
 * Still CALIBRATE: it is governed by two invariants that disagree, so a change
 * to the query set, MONTHLY_BUDGET_PAISE, AD_RANK_FLOOR or the return level
 * moves the window.
 */
export const WEEKLY_VOLUME = 430000;

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
 * break-even or the cheapest position becomes unplayable.
 *
 * WAS 60, AND F14 MOVED IT. A reserve is a fixed price in a market where every
 * ceiling just fell 20-30%, because returns rose to the sourced level. Left at
 * 60 it became a quarter stricter relative to what anybody could afford, and
 * it bit the weakest ads first: with rivals assuming the briefing's two in
 * five, both `cautious` rivals showed in nothing for one to four opening weeks
 * on 10 of 12 seeds, and a DIY account on `disciplined` got no impressions in
 * week 1. At 60 with rivals assuming a quarter, nobody went dark — so it was the
 * reserve falling behind the ceilings, not the returns themselves.
 *
 * 48 is 60 scaled down by roughly what the ceilings fell. It moves
 * WEEKLY_VOLUME with it: in a thin auction the reserve IS the price, so cheaper
 * clicks need more searches before a budget binds (I1).
 */
export const AD_RANK_FLOOR = 48;

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

/*
 * ₹1,50,000 SINCE I41, AND THE CLIFF IS AT ₹1,30,000.
 *
 * I29 raised this to ₹1,20,000 so that the best page would stop costing you
 * photography. I30 then doubled photography's first rung, ₹25,000 to ₹50,000,
 * and the trade came straight back: the cheapest route to the best description
 * grade is ₹80,000, which leaves ₹40,000 against a ₹50,000 rung. Measured, the
 * property flips the moment a round can carry both — ₹1,30,000 — and does not
 * widen again until ₹1,60,000.
 *
 * ₹1,50,000 clears that cliff with ₹20,000 of slack, so a later price change on
 * either ladder does not silently kill the property the way I30's did. Two
 * rounds are ₹3,00,000 against ₹4,00,000 to max all four targets, so one must
 * still be given up over the whole game — which is the trade I29 wanted.
 */
export const CAPEX_ALLOCATION_PAISE = 15000000; // ₹1,50,000, at rounds 1 and 5
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
 * Who writes the ad, what it costs, and what it reliably delivers.
 *
 * `grade` is what the tier GUARANTEES for the two components copy sets,
 * `expectedCtr` and `adRelevance`. `null` means nobody is hired: the advertiser
 * writes its own, is graded on what it actually wrote, and can reach the
 * offline grader's ceiling of 8. Since 2026-09-14 that runs from week 1, like a
 * hire (I11).
 *
 * MEASURED, NOT CHOSEN. Over 12-round games against a live market, hired grades
 * of 5/6/7 were beaten by a competent DIY writer at every rung, so the ladder
 * moved up. At 6/7/8 the outcomes stratify: a DIY ad graded 8 lands between the
 * agency and the retainer, a 7 loses to the agency, a 6 loses to the
 * freelancer. Write well and you beat what you would have paid for; write
 * badly and you should have hired. `tests/writers.test.js` plays the real
 * configurations and holds that ordering.
 *
 * That ladder was measured while a self-written ad waited two weeks. Without the
 * wait a careful self-written ad beats the retainer; the ladder is left where
 * it was, because what a hire guarantees did not change, and I11 records the
 * harness figures for the change.
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
/*
 * 2 SINCE I40, AND THE SUM IS WHY. The grade is base 5 and caps at 10, so five
 * points are buyable. At 3 the page's own ladder claimed all five alone — speed
 * and reviews as sentences, plus the full bonus — so ₹80,000 on one target
 * graded 10 from week 4, and every combination above it computed 11 and threw a
 * point away. A size guide bought beside the top page was worth nothing.
 * At 2 the arithmetic closes exactly: 5 + 3 sentence points + 2 = 10, so no
 * combination overflows and no single target reaches the top.
 */
export const CAPEX_LANDING_PAGE_MAX_POINTS = 2;

/**
 * An S-curve, not a diminishing one. Interpolated linearly between points.
 *
 * The shape is the whole mechanic. With diminishing returns the first tranche
 * on a fresh target would always be the cheapest gain, splitting four ways
 * would be strictly optimal, and the amount choice would collapse into a solved
 * puzzle. The S makes splitting available and sometimes right while spreading
 * thin genuinely underperforms committing.
 *
 * It is also the more honest shape: ₹25,000 of engineering buys a half-built
 * fit tool that helps nobody. See DECISIONS D7.
 *
 * RESHAPED WHEN THE FOURTH TARGET ARRIVED (I29), and the old top rung was the
 * reason it could be. Measured against the version before it:
 *
 *   0 -> 25,000   +0.04 for ₹25,000    0.002 per ₹10,000
 *   25 -> 55,000  +0.12 for ₹30,000    0.004 per ₹10,000
 *   55 -> 70,000  +0.06 for ₹15,000    0.004 per ₹10,000
 *   70 -> 100,000 +0.03 for ₹30,000    0.001 per ₹10,000   <- the worst buy
 *
 * The last rung cost ₹30,000 for three hundredths, a quarter the efficiency of
 * the middle of the ladder and worse than the first step. Nobody rational
 * bought it, and `HANDOVER.md` had already recorded that the last ₹30,000
 * "buys almost nothing".
 *
 * So the ladder now tops at ₹80,000 and reaches the same 1.25 it always did.
 * The dud rung is gone, the top rung is a good buy rather than a trap, and
 * ₹80,000 x 3 is exactly the ₹2,40,000 two allocation rounds provide — so a
 * player can finish three of the four targets and must give one up. The choice
 * D7 exists to protect is intact; what changed is that the budget now lands on
 * a round number instead of two thirds of one.
 */
export const CAPEX_TIER_CURVE = [
  { paise: 0, effect: 1 },
  { paise: 2500000, effect: 1.04 },
  { paise: 5500000, effect: 1.16 },
  { paise: 8000000, effect: 1.25 },
];

/**
 * The four things capital can be spent on, and the order the cards list them.
 *
 * Named here rather than written out at each site, because a fourth target was
 * added to a codebase that had three in object literals in five files, and the
 * one that got missed would have been a target nobody could fund.
 */
export const CAPEX_TARGETS = Object.freeze([
  'photography', 'sizeGuide', 'landingPage', 'orderConfirmation',
]);

/**
 * Photography climbs a longer, shallower ladder than the other three (I30).
 *
 * MEASURED, AND IT WAS NOT A CLOSE CALL. On the shared curve, ₹80,000 of
 * photography was worth +46.3% of profit averaged over the six cells, against
 * +8.5% for the landing page, +6.4% for the size guide and +5.7% for order
 * confirmation. **Five and a half times the next best, in every cell.** So there
 * was no "which three of four" — everybody bought photography and the real
 * decision was over the leftovers.
 *
 * The reason is structural rather than a tuning error. Photography multiplies
 * `convRateBase`, so a 25% lift is 25% more revenue on advertising that costs
 * the same either way. The two return targets divide a rate that is only about a
 * quarter of revenue to begin with, so a 25% cut there is worth about 6%.
 *
 * PRICE ALONE COULD NOT FIX IT, and the arithmetic is worth keeping because the
 * idea will come back:
 *
 *   to make photography no better per rupee than the landing page it would have
 *   to cost ₹4,35,068 — 1.8x the ₹2,40,000 the whole game provides, so nobody
 *   could ever buy it
 *
 *   cutting the other three to match photography per rupee puts all four at
 *   ₹1,15,000 together, leaving ₹1,25,000 spare — you buy everything and the
 *   choice disappears, which is where the rejected carryover idea also led
 *
 * And equal value per rupee was never the goal anyway: if all four pay the same,
 * every allocation is as good as any other and there is still nothing to decide.
 * What makes a choice is COMPARABLE SIZE WITH DIFFERENT ORDERING BY CELL, and
 * the other three already have it — the landing page pays most at
 * premium|performance, exactly where the size guide and order confirmation pay
 * least.
 *
 * So the effect comes down and the price goes up. The top is 1.11, worth about
 * +20% of profit, and the ladder runs to ₹1,60,000 at the same proportions the
 * shared curve uses. That leaves two strategies costing exactly the ₹2,40,000
 * two allocation rounds provide:
 *
 *   photography, and one other target maxed
 *   three of the other three, and no photography
 *
 * Photography stays the strongest single lever — about 1.3x the landing page per
 * rupee — and taking it now costs two of the other three. That is the trade.
 */
export const CAPEX_PHOTOGRAPHY_CURVE = [
  { paise: 0, effect: 1 },
  { paise: 5000000, effect: 1.02 },
  { paise: 11000000, effect: 1.07 },
  { paise: 16000000, effect: 1.11 },
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
  // Location axis sourced, price axis inferred — the comment on the table says
  // which is which, and they are tagged for the weaker of the two.
  COD_SHARE_BY_PRICE_LOCATION: 'ESTIMATED',
  RTO_RATE_COD: 'DOCUMENTED',
  RTO_RATE_PREPAID: 'DOCUMENTED',
  POST_DELIVERY_RETURN_RATE: 'DOCUMENTED',
  RTO_FREIGHT_PAISE: 'DOCUMENTED',
  PREPAID_DISCOUNT_CURVE: 'DOCUMENTED',
  PREPAID_DISCOUNT_MAX_PAISE: 'ESTIMATED',
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
  CAPEX_TARGETS: 'INVENTED',
  // ESTIMATED and not CALIBRATE, by that set's own rule: this was FITTED to a
  // measurement rather than left provisional. The gap it closes was measured at
  // 5.4x and the top was chosen to land near +20% of profit, so it is settled by
  // evidence — re-measure it if the six-cell gains move, do not widen a set the
  // spec pinned at two.
  CAPEX_PHOTOGRAPHY_CURVE: 'ESTIMATED',
  CAPEX_LANDING_PAGE_MAX_POINTS: 'INVENTED',
  CREATIVE_ALLOCATION_PAISE: 'INVENTED',
  // ESTIMATED, not CALIBRATE, and the distinction is not pedantry: CALIBRATE
  // means "provisional until calibration.test.js passes", and that file governs
  // exactly the constants it names. This was set from measurement over whole
  // games and is held by tests/writers.test.js instead. Tagging it CALIBRATE
  // would claim a reader it does not have. (CREATIVE_DIY_LIVE_ROUND stood beside
  // it until 2026-09-14, when I11 removed the wait it set.)
  WRITER_TIERS: 'ESTIMATED',
};
