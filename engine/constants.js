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

/**
 * THE ONE CONSTANT IN THIS FILE WITH NO PROVENANCE TAG, and the exemption is
 * named in `tests/constants.test.js` so it cannot quietly grow.
 *
 * A provenance tag answers "where did this quantity come from". This is not a
 * quantity: it is the save format's version, read by `serialise.js` to decide
 * whether a stored game can still be loaded. It was tagged INVENTED until
 * 2026-09-20, which read as though the save format were a guess about
 * advertising (I44).
 *
 * A number you cannot source is INVENTED or DESIGNED. Exempt is for things
 * that are not numbers about anything.
 */
export const SCHEMA_VERSION = '0.3';

/** Player plus eight rivals. Fewer than this and rank competition never bites. */
export const ADVERTISER_COUNT = 9;

/**
 * DESIGNED. Twelve weeks in three months of four.
 *
 * Not sourced and not sourceable: nothing published says how long a learning
 * simulation should run. It is set by what has to fit inside it — three budget
 * cycles, because a month-3 reallocation by rank (13.1) needs two months of
 * standing to reallocate ON; a returns tail that lands two to five weeks after
 * the click, so a week-12 sale can still be seen; and the capital delay of
 * three rounds twice over. Any shorter and one of those runs off the end.
 *
 * `HANDOVER.md` *Is twelve rounds long enough to learn from?* has the argument
 * in full, and it is the reasoning to re-read before changing this rather than
 * this comment.
 */
export const TOTAL_ROUNDS = 12;
export const ROUNDS_PER_MONTH = 4;

// ---------------------------------------------------------------------------
// Positioning (spec 4)
// ---------------------------------------------------------------------------

/**
 * DESIGNED, both of them. The 3 x 2 grid every advertiser occupies one cell of.
 *
 * These are vocabularies, not measurements — there is nothing to source in the
 * claim "this game has three price tiers", only in what each tier DOES, and
 * that is `POSITION_ECONOMICS` (INVENTED) and `PURPOSE_MODIFIERS` (INVENTED).
 * The split is deliberate: change a name here and nothing about advertising is
 * asserted differently; change a number there and the game teaches something
 * new about what a click is worth.
 *
 * Six cells is the smallest grid where a rival can be near you on one axis and
 * far on the other, which is the thing the player has to learn to read. Spec 4.
 */
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

/**
 * DESIGNED. One chance to move, at round 5, for ₹1,00,000.
 *
 * Nothing about real advertising is claimed here — a real brand repositions
 * whenever it likes and pays whatever it costs. This is a game rule, and it
 * exists so that the round-0 positioning choice is recoverable but not free.
 * The price is two thirds of a month's ad budget: enough that it is a real
 * decision, not so much that a player who read the market wrong at round 0 is
 * locked out of the rest of the game.
 *
 * Round 5 because it is the first week of month 2 — the player has four weeks
 * of reports to judge the cell on, and seven left for the move to pay back.
 */
export const REPOSITION_COST_PAISE = 10000000; // ₹1,00,000
export const REPOSITION_ROUND = 5;

/**
 * DESIGNED. How the eight rivals are spread over the grid at round 0.
 *
 * A setup rule, not an observation about who competes in Indian activewear.
 * It exists to stop a randomly generated market being uninteresting in two
 * specific ways: every rival landing in one price tier (so the player never
 * meets a cheaper or dearer competitor), or one cell holding five of them (so
 * one part of the grid is unwinnable and the rest is empty). `maxPerCell: 2`
 * also guarantees at least four cells are occupied, which is what makes the
 * positioning lesson legible.
 */
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

/**
 * Index 0 is Monday. Weekend browsing runs higher.
 *
 * AND THAT SENTENCE IS NOT SUPPORTED (searched 2026-09-20, I42). Every source
 * found points the other way. For India: "Mondays have also overtaken weekends
 * as the busiest day for completed transactions" (DFU Publications, on Indian
 * online fashion). For the West: "Friday Is the Peak eCommerce Day in the U.S."
 * with activity "peaks on Friday before declining over the weekend", and in the
 * UK and Germany "only on Saturday... is there a notable decline" (ECDB, 2023,
 * US/UK/Germany). This table peaks on Saturday, which is the one day two of
 * those three markets single out as falling.
 *
 * LEFT ALONE ON PURPOSE, and the reason is worth more than the fix. Nothing a
 * player does touches it: there is no day-of-week bid adjustment anywhere in
 * the game, this curve feeds only `searches()`, and a round IS a week, so the
 * weekly total is identical whatever shape it takes. Changing it would move
 * which day volume lands on, interact with daily pacing, and need gates and a
 * market measurement — all to buy no lesson at all.
 *
 * SO IT IS A TRAP FOR LATER, written down where it will be found: if anyone
 * ever adds day-of-week targeting, this curve becomes player-facing and has to
 * be re-sourced FIRST, because it currently points the wrong way.
 */
export const DAY_OF_WEEK_CURVE = normalise([
  1.35, 1.35, 1.40, 1.40, 1.45, 1.60, 1.45,
]);

/**
 * Volume by hour. Three shapes, assigned per query.
 *
 * Peaks matter: invariant I5 requires the intent peak (15:00) to sit at least
 * MIN_PEAK_SEPARATION_HOURS from every peak here. business peaks at 11, evening
 * at 20, flat at 19 — 4, 5 and 4 hours clear respectively.
 *
 * SEARCHED, AND THE SOURCES DISAGREE WITH EACH OTHER (2026-09-20, I42). For
 * Indian fashion: "browsing activity peaks around 10 p.m." (Fynd, via DFU
 * Publications). For the UK and Germany: shoppers peak "in the early evening
 * from 7 p.m. onwards", with US consumers earlier still (ECDB, 2023). The
 * evening profile's 20:00 sits between the two, which is the most this can
 * honestly claim — so it stays INVENTED rather than borrowing either number.
 *
 * Worth knowing if it is ever moved: pushing the evening peak later INCREASES
 * its distance from the 15:00 intent peak, so I5 gets easier, not harder. The
 * constraint that would bite is the business profile, not this one.
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

/**
 * INVENTED, and it is one of the few on this list that MIGHT be sourceable.
 *
 * It claims something real: that readiness to buy moves through the day
 * differently from the readiness to search, peaking mid-to-late afternoon
 * while search volume peaks elsewhere. That is a claim about people, and a
 * wrong shape teaches a false lesson about when to bid up.
 *
 * WHAT WAS LOOKED FOR AND NOT FOUND (2026-09-20): a published hour-by-hour
 * conversion-rate curve for Indian e-commerce, or for apparel anywhere, at a
 * granularity that would settle these 24 numbers. What exists is either
 * platform-wide and undated, or behind a vendor's report. Google publishes
 * dayparting as a bidding CONTROL and no curve behind it.
 *
 * So the shape is reasoned rather than measured: a trough overnight, a climb
 * through the working day, a peak before the evening browse, and a decline
 * while search volume is still high. `MIN_PEAK_SEPARATION_HOURS` holds the one
 * property the lesson actually needs. **If a real curve is ever found, this is
 * the first constant to replace** — it moves the market, so it goes through
 * `scripts/market-harness.js` before and after, and all five CALIBRATE
 * constants get re-checked after.
 */
export const HOURLY_INTENT_CURVE = normaliseToMeanOne([
  0.62, 0.55, 0.50, 0.48, 0.52, 0.62, 0.75, 0.88,
  0.98, 1.06, 1.14, 1.20, 1.24, 1.28, 1.34, 1.40,
  1.34, 1.24, 1.14, 1.06, 1.00, 0.92, 0.82, 0.72,
]);

/**
 * DESIGNED, and it is a GUARD rather than a quantity.
 *
 * It asserts nothing about when people search. It asserts that this game's two
 * hourly curves — how many search (`HOUR_PROFILES`) and how ready they are to
 * buy (`HOURLY_INTENT_CURVE`) — must peak at least three hours apart, and a
 * test fails if they do not.
 *
 * WITHOUT IT THE DAYPARTING LESSON IS DEAD. If the busiest hour is also the
 * best-converting hour, then bidding up at the peak is right for both reasons
 * at once, there is no trade to find, and DECISIONS H4 is false. Three hours is
 * simply wide enough that the cheaper hour is visibly not the busiest one.
 */
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

/**
 * DESIGNED. Six named blocks the player bids on, instead of 24 hours.
 *
 * An interface granularity, not a finding about when people shop. The engine
 * simulates every hour; these only decide what the player is offered as a
 * control, and the boundaries follow the day as a person would describe it so
 * that a block can be reasoned about ("evening") rather than looked up.
 *
 * Six because 24 sliders is a spreadsheet and three is too coarse to separate
 * the two curves' peaks, which is the whole trade (`MIN_PEAK_SEPARATION_HOURS`).
 * Nothing downstream assumes blocks are equal length, and they are not.
 */
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
 *
 * LOOKED FOR AND NOT FOUND (2026-09-20). Google's own help says only that "ads
 * can appear above or below search results on Google Search" and publishes no
 * count for either, so this stays INVENTED rather than inheriting a number from
 * the many third-party pages that assert one. The figure happens to match what
 * those pages say; matching an unsourced claim is not a source.
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

/**
 * DESIGNED. How many auctions the engine resolves per query per hour.
 *
 * A simulation-granularity choice, claiming nothing: real Google runs one
 * auction per search, which would be hundreds of thousands a week and is not
 * the question. Each resolution here carries a slice of that hour's volume.
 *
 * `expected: 1` is the deterministic mode — one resolution carries the whole
 * hour, which is what makes a game replay exactly. `sampled: 6` is the noisy
 * mode, where six resolutions per hour give variance to look at without the
 * cost of simulating every search. Six is a compromise between a visible
 * spread and a week that computes in under a second.
 *
 * NOT a knob for realism: raising it does not make the market truer, only
 * slower and slightly less noisy. See the pacing trap in `CLAUDE.md` — a slice
 * is never skipped, only scaled.
 */
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
/**
 * How much traffic a keyword needs before its rating means anything.
 *
 * INVENTED, and looked for (2026-09-20). Google publishes that the threshold
 * EXISTS and not where it is: "If you notice a '—' in the Quality Score column,
 * it means there aren't enough searches that exactly match your keywords to
 * determine a keyword's Quality Score" (About Quality Score). No impression
 * count is given anywhere, so 500 is this game's own line.
 */
export const QUALITY_MIN_IMPRESSIONS = 500;

/**
 * Where "Above average" and "Below average" begin, as a ratio to the market.
 *
 * THE THREE BANDS ARE GOOGLE'S, THE CUTOFFS ARE NOT. "Each component is
 * evaluated with a status of 'Above average,' 'Average,' or 'Below average'"
 * (About Quality Score), and those are the three this game reports, against the
 * same three components Google names — expected clickthrough rate, ad relevance
 * and landing page experience, on a 1-10 score.
 *
 * What Google does not publish is where one band ends and the next begins, so
 * +/-10% around the market's own mean is INVENTED. A6 records what that width
 * costs: the average band is as wide as the span it sits in, which is why
 * ratings move less than the underlying signal does.
 */
export const RATING_UPPER_THRESHOLD = 1.10;
export const RATING_LOWER_THRESHOLD = 0.90;

/**
 * Deliberately poor. An ad nobody has evaluated should not perform like a good one.
 *
 * THIS IS WHAT THE AUCTION USES, NOT WHAT THE ACCOUNT SHOWS, and the difference
 * matches the real thing (checked 2026-09-20). Google reports a dash rather than
 * a score while a keyword is unevaluated — "If you notice a '—' in the Quality
 * Score column, it means there aren't enough searches that exactly match your
 * keywords" (About Quality Score) — and `gradedQuality` is null until graded for
 * exactly that reason (9.5). But an auction still has to rank an ad with no
 * history, and Google publishes nothing about what it assumes there. 3/3/3 is
 * this game's answer; A8 records what it costs, which is that such an ad cannot
 * clear the reserve.
 */
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

/**
 * INVENTED, AND UNSOURCEABLE IN PRINCIPLE. This one is worth being exact about.
 *
 * Google publishes the three components of Quality Score — expected
 * click-through rate, ad relevance, landing page experience — and that each is
 * reported as below average, average or above average. It publishes that the
 * score runs 1 to 10. **It has never published how the three become the one**,
 * and there is no reason to expect it to: the weighting is the mechanism.
 *
 * So this table is arithmetic invented to be defensible rather than accurate.
 * Click-through rate is weighted double the other two (`2 * ctr + rel + lp`),
 * which reflects Google's own emphasis on it in the help documentation, and
 * the nine resulting positions map onto `SCORE_BY_INDEX`. All three average
 * gives 6, not 5, because average is where most accounts sit and the scale
 * should not read as a failing grade for being ordinary.
 *
 * **Do not go looking for a source.** Third-party pages assert mappings; they
 * are reverse-engineered from small samples and disagree. Matching one would
 * dress a guess as a citation — the same trap `MAX_SLOTS` records.
 */
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

/**
 * What a brand search converts at for the brand that owns it, and for a rival
 * bidding on it.
 *
 * THE DIRECTION IS SOURCED AND THE SIZES ARE NOT (searched 2026-09-20, I42).
 * Google defines ad relevance as "how closely your ad matches the intent behind
 * a user's search" (About Quality Score), so an ad for one brand shown against
 * a search for another is less relevant by that definition — the poacher's
 * penalty follows from Google's own words. What Google publishes nowhere is how
 * much: its help has nothing on bidding against a competitor's brand terms
 * beyond the general principle. 2.5x and 0.25x are this game's sizes.
 *
 * These are CONVERSION multipliers, not quality ones, and the separation is
 * deliberate — F10 and F11 both record what happens when two mechanisms push
 * the same number. The quality side of brand bidding lives in
 * `RELEVANCE_INTENT_MULTIPLIERS`.
 */
export const BRAND_OWNER_MULTIPLIER = 2.5;
export const BRAND_POACHER_MULTIPLIER = 0.25;

/**
 * What an informational search converts at: a tenth of a commercial one.
 *
 * INVENTED. "How to style co-ord sets" is a real search a real advertiser will
 * match and pay for, and it does occasionally buy — the lesson is that it is
 * dear for what it returns, not that it is worthless, which is
 * `IRRELEVANT_CONV_MULTIPLIER`'s job. No benchmark was found splitting paid
 * conversion by search intent; the ones that exist split by channel or device.
 */
export const INFORMATIONAL_CONV_MULTIPLIER = 0.10;

/** Exactly zero, not merely small. That traffic never converts, and the waste is the lesson. */
export const IRRELEVANT_CONV_MULTIPLIER = 0;

/**
 * The floor and ceiling on any conversion rate, as a PAIR rather than a list.
 *
 * Typed as a two-tuple because every caller spreads it into `clamp(value, lo,
 * hi)`, and a plain `number[]` cannot be spread into fixed parameters — five
 * sites across `strategies.js`, `positions.js` and `attribution.js` say so.
 * @type {[number, number]}
 */
export const CONV_RATE_CLAMP = [0.001, 0.35];

/**
 * DESIGNED, and a GUARD rather than a quantity. Nothing else bounds
 * `returnRate` x multipliers below 1.
 *
 * It claims nothing about how often Indian activewear comes back — that is
 * `POSITION_ECONOMICS` and the sourced RTO rates. This only stops the product
 * of a base rate and several multipliers reaching 1.0, where every order
 * returns, margin is identically zero for everyone, and the week teaches
 * nothing. 0.9 is simply short of that: high enough never to bind in normal
 * play, low enough to leave a tenth of orders standing if it ever does.
 *
 * **A CLAMP THAT BINDS IN NORMAL PLAY IS A DEFECT, NOT A NUMBER TO TUNE.** If
 * this one starts binding, the multipliers upstream are wrong and raising the
 * clamp would hide it. Same for `CONV_RATE_CLAMP` and `PREDICTION_ERROR_CLAMP`.
 */
export const RETURN_RATE_CLAMP_MAX = 0.9;

// ---------------------------------------------------------------------------
// Bidding and learning (spec 12.2, 12.3)
// ---------------------------------------------------------------------------

/**
 * How long a strategy is unsettled after its target changes, in rounds (weeks).
 *
 * ESTIMATED, and the estimate is an interpretation rather than a lift. Google
 * states the wait in conversion cycles, not weeks: "give it 1-2 conversion
 * cycles" before a changed target is hit (About Target ROAS bidding). A cycle
 * is however long this account takes to convert, which here is the attribution
 * lag — so two rounds is the top of that range read into this game's clock.
 *
 * It is not tagged DOCUMENTED because the unit had to be converted to get here,
 * and a converted unit is where a sourced figure turns into an inferred one.
 * See F21: a figure needs its denominator carried with it.
 */
export const LEARNING_ROUNDS = 2;

/**
 * How much noisier a strategy's estimate is while it is learning.
 *
 * INVENTED, and no source was found for it (checked 2026-09-20). Google says
 * performance is unstable during learning and to avoid judging it, but puts no
 * number on how much. 2.5x is the size that makes the instability visible in a
 * twelve-round game without making a learning period fatal — a game-balance
 * choice wearing an engine's clothes, which is what INVENTED is for.
 */
export const LEARNING_ERROR_MULTIPLIER = 2.5;

/**
 * The conversion count below which a bid strategy's estimates are still poor.
 *
 * DOCUMENTED, and it was tagged INVENTED until 2026-09-20 purely because nobody
 * had gone looking: "To evaluate results accurately, Google Ads recommends
 * measuring performance over longer time periods that have at least 30
 * conversions, such as a month or longer (50 conversions for Target ROAS)"
 * (About Smart Bidding). Target CPA's own page repeats it: "we recommend you
 * measure performance for the last 30 days, including at least 30 conversions".
 *
 * ONE FIGURE WHERE GOOGLE GIVES TWO, and that is a simplification worth naming.
 * Target ROAS wants 50, and Target ROAS additionally has an ELIGIBILITY floor
 * that is different again — "at least 15 conversions in the past 30 days" for
 * Search and Shopping. This game models one number, for "your estimates are
 * still noisy here", which is the 30 both general and Target CPA guidance give.
 *
 * NAMES A MILESTONE, NOT A BRANCH. `predictionErrorSigma` falls with sqrt(n)
 * and has no threshold in it; spec 12.2 quotes this to say what "high error"
 * means and `strategies.test.js` checks the curve is still large there.
 * `constants.test.js` records it as deliberately not consumed.
 */
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

/**
 * DESIGNED. ₹1,68,000 a month — six thousand rupees a day across twenty-eight.
 *
 * The arithmetic is not the justification, and this comment used to stop at it.
 * A real advertiser's budget is whatever they have; nothing is claimed here
 * about what a D2C brand in India spends. What is chosen is what THIS game
 * hands the player, and it is set relative to the market rather than to the
 * world: enough to be outbid on the dearest searches and still buy a useful
 * number of the cheaper ones, so that allocation is the decision rather than
 * affordability.
 *
 * A round number per day was picked so a player can do the daily sum in their
 * head when reading a weekly report. It moves the market, so changing it means
 * `scripts/market-harness.js` before and after, and the five CALIBRATE
 * constants re-checked.
 */
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

/**
 * DESIGNED. Site work lands three rounds after it is paid for.
 *
 * The delay models something real — a size guide is not written and live the
 * afternoon you decide to have one — but the NUMBER is a game rhythm, in game
 * rounds, and there is nothing to source about it. Three is chosen against the
 * calendar it sits in: paid at round 1 it is live by round 4, so the effect is
 * visible inside month 1 and the player connects spend to result; paid at
 * round 5 it lands at round 8, leaving four weeks to earn back.
 *
 * TWO IS TOO FAST AND FOUR IS TOO SLOW, for the same reason in both
 * directions. At two the money feels immediate and the lesson that capital is
 * a bet on a later week is lost; at four, the second allocation lands at round
 * 9 with three weeks to pay back and nobody spends it.
 *
 * The delay is why capital is the hardest decision in the game to read, and
 * the first-run design (`plans/2026-09-19-first-run-and-ground-floor.md`)
 * names it as one of the two ideas a beginner most often misses.
 */
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

  // INVENTED and DESIGNED are both "we chose this", and they are not the same
  // kind of choice. The test is ONE QUESTION: does this number assert a
  // magnitude in the real world, or define this game's own structure?
  //
  //   INVENTED - it claims something about advertising and we guessed. How much
  //              better position 1 is, how quality becomes a score, how demand
  //              moves through a day. A wrong value here TEACHES SOMETHING
  //              FALSE, which is the failure this project exists to avoid.
  //   DESIGNED - it is a rule of the game. How long a game runs, how many
  //              advertisers are in it, what a purchase costs in game money,
  //              what the engine samples. A wrong value here makes a worse
  //              GAME. It cannot make a false claim, because it claims nothing.
  //
  // They were one tag until 2026-09-20 and the conflation was doing real
  // damage: 57 of 79 constants read as INVENTED, which made the model sound
  // far less sourced than it is, and made the guide's honesty line hard to
  // write truthfully. TOTAL_ROUNDS = 12 is not a false claim about Google.
  // See DECISIONS.md I44, and note the guide's own share is computed over
  // world-claiming constants only.
  //
  // SCHEMA_VERSION is in NEITHER, and is exempt from this map: it is a save
  // format's version string, not a quantity anything modelled. See
  // constants.test.js, which names the exemption.

  // Rules of the game. No empirical claim; a wrong value is a worse game.
  ADVERTISER_COUNT: 'DESIGNED',
  TOTAL_ROUNDS: 'DESIGNED',
  ROUNDS_PER_MONTH: 'DESIGNED',
  PRICE_TIERS: 'DESIGNED',
  PURPOSES: 'DESIGNED',
  REPOSITION_COST_PAISE: 'DESIGNED',
  REPOSITION_ROUND: 'DESIGNED',
  RIVAL_PLACEMENT_CONSTRAINTS: 'DESIGNED',
  MIN_PEAK_SEPARATION_HOURS: 'DESIGNED',
  DAYPART_BLOCKS: 'DESIGNED',
  MIN_INCREMENT_PAISE: 'DESIGNED',
  AUCTIONS_PER_QUERY_HOUR: 'DESIGNED',

  // Claims about advertising that nobody sourced.
  POSITION_ECONOMICS: 'INVENTED',
  PURPOSE_MODIFIERS: 'INVENTED',
  DAY_OF_WEEK_CURVE: 'INVENTED',
  HOUR_PROFILES: 'INVENTED',
  HOURLY_INTENT_CURVE: 'INVENTED',
  PACING_REFERENCE_CURVE: 'INVENTED',
  MAX_SLOTS: 'INVENTED',
  TOP_SLOTS: 'INVENTED',
  QUALITY_FACTOR_RANGES: 'INVENTED',
  QUALITY_MIN_IMPRESSIONS: 'INVENTED',

  // Where the searches happen. CALIBRATE rather than ESTIMATED, and that widens
  // a set the spec had pinned at two - argued in DECISIONS G4. Nothing about
  // these numbers can be settled before a played game: the metros are better per
  // click by construction, and whether tier 2 and 3 are worth having depends on
  // whether crowding makes the metros expensive, which is emergent (H10).
  // DESIGNED: three tiers is a structure, not a measurement. How many bands to
  // cut India into is this game's choice; what each band DOES is the three
  // CALIBRATE tables below, and those are measurements.
  LOCATION_TIERS: 'DESIGNED',
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
  BRAND_OWNER_MULTIPLIER: 'INVENTED',
  BRAND_POACHER_MULTIPLIER: 'INVENTED',
  INFORMATIONAL_CONV_MULTIPLIER: 'INVENTED',
  IRRELEVANT_CONV_MULTIPLIER: 'INVENTED',
  LEARNING_ROUNDS: 'ESTIMATED',
  LEARNING_ERROR_MULTIPLIER: 'INVENTED',
  SMART_BIDDING_MIN_CONVERSIONS: 'DOCUMENTED',
  COLD_START_CONV_RATE: 'INVENTED',
  PREDICTION_ERROR_BASE: 'INVENTED',
  CAPEX_TIER_CURVE: 'INVENTED',

  // The shape of the content, not a claim about it: what a query set must
  // contain and what words may tag it. The numbers INSIDE a generated set are
  // judged by querySet.test.js; these say what shape it has to be.
  TAG_VOCABULARY: 'DESIGNED',
  QUERY_SET_RULES: 'DESIGNED',

  // Clamps and floors. A clamp asserts nothing about the world - it stops a
  // value leaving the range the engine can reason about, which is why a clamp
  // that BINDS in normal play is a defect rather than a number to source.
  CONV_RATE_CLAMP: 'DESIGNED',
  RETURN_RATE_CLAMP_MAX: 'DESIGNED',
  PREDICTION_ERROR_CLAMP: 'DESIGNED',
  MIN_BID_PAISE: 'DESIGNED',
  MAX_BID_MULTIPLE: 'DESIGNED',

  // What the rival policies are allowed to do. These describe agents this
  // project wrote, not advertisers in the world, so there is nothing to source:
  // the question is whether they make a market worth playing against.
  MIN_HOUR_OBSERVATIONS: 'DESIGNED',
  MAX_CLICKS_AGGRESSION: 'DESIGNED',
  MAX_CONV_AGGRESSION: 'DESIGNED',

  // The game's economy, in game money. A real advertiser's budget is whatever
  // they have; these set what THIS game hands you and what it charges.
  MONTHLY_BUDGET_PAISE: 'DESIGNED',
  RANK_BUDGET_MULTIPLIERS: 'DESIGNED',
  CAPEX_ALLOCATION_PAISE: 'DESIGNED',
  CAPEX_DELAY_ROUNDS: 'DESIGNED',
  CAPEX_TARGETS: 'DESIGNED',
  // ESTIMATED and not CALIBRATE, by that set's own rule: this was FITTED to a
  // measurement rather than left provisional. The gap it closes was measured at
  // 5.4x and the top was chosen to land near +20% of profit, so it is settled by
  // evidence — re-measure it if the six-cell gains move, do not widen a set the
  // spec pinned at two.
  CAPEX_PHOTOGRAPHY_CURVE: 'ESTIMATED',
  CAPEX_LANDING_PAGE_MAX_POINTS: 'DESIGNED',
  CREATIVE_ALLOCATION_PAISE: 'DESIGNED',
  // ESTIMATED, not CALIBRATE, and the distinction is not pedantry: CALIBRATE
  // means "provisional until calibration.test.js passes", and that file governs
  // exactly the constants it names. This was set from measurement over whole
  // games and is held by tests/writers.test.js instead. Tagging it CALIBRATE
  // would claim a reader it does not have. (CREATIVE_DIY_LIVE_ROUND stood beside
  // it until 2026-09-14, when I11 removed the wait it set.)
  WRITER_TIERS: 'ESTIMATED',
};
