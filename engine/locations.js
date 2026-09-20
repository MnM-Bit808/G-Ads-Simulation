/**
 * Where the searches happen (spec 4, DECISIONS G4).
 *
 * The third dimension of demand, after the query and the hour. This module is
 * the whole of the demand-side arithmetic: how one query's volume divides across
 * the country, and what that does to baskets and returns. Nothing here knows
 * about advertisers, bids or auctions.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *
 * It does not touch conversion. Conversion already carries query affinity,
 * `PURPOSE_MODIFIERS` and the hourly intent curve, and F10 and F11 are both
 * records of what happens when two mechanisms push one number — the purpose axis
 * was applied twice and nobody noticed until an invariant was measured properly.
 * Location changes how many searches there are, how large the basket is, and how
 * often it comes back. Not how likely somebody is to buy.
 *
 * IT SPLITS DEMAND, IT DOES NOT ADD ANY
 *
 * Every query's shares sum to exactly 1. Geography does not invent searchers; it
 * says where the ones `WEEKLY_VOLUME` already counts are. `locations.test.js`
 * asserts that over the real query set, which is the only form of the claim that
 * is worth anything.
 */

import {
  LOCATION_TIERS, LOCATION_VOLUME_BY_PRICE, LOCATION_RETURN_MULTIPLIER,
  LOCATION_AOV_MULTIPLIER, PRICE_TIERS,
  COD_SHARE_BY_PRICE_LOCATION, RTO_RATE_COD, RTO_RATE_PREPAID, POST_DELIVERY_RETURN_RATE,
  PREPAID_DISCOUNT_CURVE,
} from './constants.js';
import { homeCell } from './querySet.js';

/**
 * An even split, for traffic that is not territory.
 *
 * `homeCell` returns null for brand, informational and irrelevant queries —
 * about a sixth of the set — because those are not any position's territory (7.5).
 * They still happen somewhere, so they still need a split, and an even one is the
 * only honest answer: a query with no price signal cannot be assigned a price
 * tier's geography without asserting something the query does not say.
 *
 * Frozen and shared rather than built per call: this is on the hot path.
 */
const NEUTRAL_SHARES = Object.freeze(
  LOCATION_TIERS.map(() => 1 / LOCATION_TIERS.length),
);

/**
 * The index of a location tier, for the arrays above.
 *
 * @param {string} id one of LOCATION_TIERS
 * @returns {number} 0-based
 * @throws {RangeError} on an unknown id, rather than returning -1 and indexing
 *   an array with it, which would silently produce undefined multipliers.
 */
export function locationIndex(id) {
  const index = LOCATION_TIERS.indexOf(id);
  if (index === -1) throw new RangeError(`unknown location tier "${id}"`);
  return index;
}

/**
 * The id at an index, for reports and for anything a person will read.
 *
 * @param {number} index
 * @returns {string}
 * @throws {RangeError} out of range
 */
export function locationIdAt(index) {
  const id = LOCATION_TIERS[index];
  if (id === undefined) throw new RangeError(`no location tier at index ${index}`);
  return id;
}

/**
 * How one query's volume divides across the country.
 *
 * Derived from the query's HOME CELL rather than authored per query, which is
 * what keeps the frozen 151-row set untouched — it is the one artefact where a
 * subtle flaw poisons every number without ever throwing.
 *
 * Returns the shared frozen array for neutral traffic, so the common case
 * allocates nothing. Callers must not mutate the result; `round.js` precomputes
 * these once per query rather than per auction.
 *
 * @param {object} query
 * @returns {number[]} one share per LOCATION_TIERS, summing to 1
 */
export function locationSharesFor(query) {
  const cell = homeCell(query);
  if (!cell) return NEUTRAL_SHARES;
  const price = cell.split('|')[0];
  return LOCATION_VOLUME_BY_PRICE[price] ?? NEUTRAL_SHARES;
}

/**
 * How much of the country's searching happens in each tier.
 *
 * Measured off the query set rather than stated as a constant, because it is a
 * property of how the rows were authored: it falls out of each query's home cell
 * and its volume. Pass the set the round is actually running on.
 *
 * @param {object} querySet
 * @returns {number[]} one weight per LOCATION_TIERS, summing to 1
 */
export function locationWeights(querySet, price = null) {
  // A position's own country, when one is named: the row for its price tier is
  // where its territory's searches are, and that is what its economics have to be
  // measured against.
  if (price && LOCATION_VOLUME_BY_PRICE[price]) return [...LOCATION_VOLUME_BY_PRICE[price]];

  const totals = LOCATION_TIERS.map(() => 0);
  let all = 0;
  for (const query of querySet?.queries ?? []) {
    const shares = locationSharesFor(query);
    all += query.volumeShareBp;
    for (let i = 0; i < totals.length; i++) totals[i] += query.volumeShareBp * shares[i];
  }
  if (all <= 0) return LOCATION_TIERS.map(() => 1 / LOCATION_TIERS.length);
  return totals.map((t) => t / all);
}

/**
 * What a location does to the money, NORMALISED so the country still has the
 * economics it is documented to have.
 *
 * THIS NORMALISATION IS THE WHOLE POINT OF THIS FUNCTION, and leaving it out was
 * a real defect caught on the way into `round.js`. `LOCATION_RETURN_MULTIPLIER`
 * reads 1.0 / 1.25 / 1.5, which weighted by where the searches actually are has a
 * mean of **1.243** — so applying it raw would have raised every advertiser's
 * return rate by a quarter. `POSITION_ECONOMICS.returnRate` IS the category-wide
 * rate (F8, F14), and the briefing tells the player "about two in five orders":
 * value's 42.7% would silently have become 53%.
 *
 * That is the F10 and F11 shape exactly — a modifier stacked on a number that
 * already contains the effect. Both entries in this ledger are records of the
 * purpose axis being applied twice and nobody noticing until an invariant was
 * measured properly.
 *
 * So the tables are read as RATIOS. Dividing by the volume-weighted mean keeps
 * the spread the design agreed — the towns still return half again as often as
 * the metros — while leaving the market's average exactly where F8 put it.
 *
 * Normalised on VOLUME rather than on conversions, which is an approximation:
 * conversions follow clicks, which follow quality and bids as well as volume. It
 * holds the realised category rate to within a point rather than exactly, and
 * that is the right trade for a number that must not depend on who is winning.
 *
 * AND NORMALISED AGAINST THE POSITION'S OWN COUNTRY, not the market's, which is
 * a correction calibration forced. Against the market average the geography
 * quietly transferred profit between positions: value's territory is 53% in the
 * towns where returns are worst, and value has the thinnest margin to absorb
 * them, so it finished 13.5% below the mean while premium finished 8.6% above -
 * against invariant I3's 15% bound, from a baseline of 2.8%.
 *
 * That is F9's engineered balance being undone by a mechanic that was never meant
 * to touch it. Each price tier is now centred on its own distribution, so running
 * your whole territory everywhere returns exactly the rate F8 documents for your
 * position - while the gradient between places, which IS the lesson, is untouched:
 * the ratio metros-to-towns stays 1.5 for everybody.
 *
 * @param {object} querySet the set the round is running on
 * @param {string|null} price the advertiser's own price tier, when it has one
 * @returns {{aovMultiplier: number[], returnMultiplier: number[]}} by tier index
 */
export function locationEffects(querySet, price = null) {
  const weights = locationWeights(querySet, price);
  const normalise = (table) => {
    const mean = table.reduce((a, v, i) => a + v * weights[i], 0);
    return mean > 0 ? table.map((v) => v / mean) : table.map(() => 1);
  };

  // THE RETURN TABLE IS NORMALISED AGAINST THE REFUSED SHARE (2026-09-20, F20).
  //
  // Normalisation exists to hold the category return rate: the tables are
  // ratios, and `POSITION_ECONOMICS.returnRate` is already the category-wide
  // figure (F8, F14). While the gradient multiplied the WHOLE return rate,
  // dividing by its volume-weighted mean did that exactly.
  //
  // It reaches the refused half only now, so a return rate is
  // `share x m + (1 - share)` rather than `m`, and holding the average needs
  // `sum(w . share . m) = sum(w . share)` instead of `sum(w . m) = 1`. Dividing
  // by the volume mean would leave the category rate a point or so adrift, in a
  // direction that depends on how refusal-heavy the price tier is.
  //
  // WITHOUT A PRICE there is no refused share to weigh against — `rtoShareOfReturns`
  // is per price tier — so the volume mean is used, which still gives the right
  // RATIOS and only the level differs. Every caller that feeds `returnHalves`
  // passes a price; the fallback serves callers that want the shape.
  const normaliseReturns = () => {
    // THE SAME GUARD `locationWeights` USES, deliberately. It falls back to the
    // query set for a price it does not recognise rather than throwing, and this
    // has to agree with it: `rtoShareOfReturns` below reaches `codShareFor`,
    // which throws RangeError on an unknown tier. Guarding only on `!price`
    // would make one function tolerant of a typo and the other fatal.
    if (!price || !LOCATION_VOLUME_BY_PRICE[price]) return normalise(LOCATION_RETURN_MULTIPLIER);
    const shares = LOCATION_RETURN_MULTIPLIER.map((_, t) => rtoShareOfReturns(price, t, 0));
    const want = shares.reduce((a, s, t) => a + weights[t] * s, 0);
    const have = LOCATION_RETURN_MULTIPLIER.reduce((a, v, t) => a + weights[t] * shares[t] * v, 0);
    return have > 0
      ? LOCATION_RETURN_MULTIPLIER.map((v) => (v * want) / have)
      : LOCATION_RETURN_MULTIPLIER.map(() => 1);
  };

  return {
    aovMultiplier: normalise(LOCATION_AOV_MULTIPLIER),
    returnMultiplier: normaliseReturns(),
  };
}

/**
 * Check the tables against the rules the design rests on (G4).
 *
 * Never throws and never mutates, so a caller can report every problem at once —
 * same shape as `assertValidQuerySet`'s validator, and mutation-tested the same
 * way: `locations.test.js` breaks exactly one rule at a time and asserts that
 * rule fires. A validator that always returns "valid" passes a naive suite
 * perfectly.
 *
 * @returns {{valid: boolean, problems: string[]}}
 */
/**
 * How much of an advertiser's orders are paid for at the door, here.
 *
 * @param {string} price a `PRICE_TIERS` entry
 * @param {number} tierIndex into `LOCATION_TIERS`
 * @returns {number} 0..1
 * @throws {RangeError} on an unknown price tier, rather than defaulting — a
 *   silent fallback would report a plausible COD share for a position that does
 *   not exist, and nothing downstream could tell.
 */
export function codShareFor(price, tierIndex, discountPaise = 0) {
  const row = COD_SHARE_BY_PRICE_LOCATION[price];
  if (!row) throw new RangeError(`no COD share for price tier "${price}"`);
  const share = row[tierIndex];
  if (share == null) throw new RangeError(`no COD share for location index ${tierIndex}`);
  // I34: a prepaid discount moves buyers off cash, and everything downstream
  // already reads the mix — refusals, the freight on them, and the split the
  // cards show all follow from this one number.
  return share * (1 - prepaidShiftFor(discountPaise));
}

/**
 * What share of would-be cash orders a discount moves to prepaid.
 *
 * Interpolated between the authored points and flat outside them, the same way
 * `capexEffect` reads its curve — but the curve DIMINISHES rather than being an
 * S, because that is what the figures say: the first ₹30 does most of the work.
 *
 * @param {number} discountPaise 0..`PREPAID_DISCOUNT_MAX_PAISE`
 * @returns {number} 0..1
 */
export function prepaidShiftFor(discountPaise) {
  const curve = PREPAID_DISCOUNT_CURVE;
  const paise = Math.max(0, discountPaise || 0);
  if (paise <= curve[0].paise) return curve[0].shifted;
  const last = curve[curve.length - 1];
  if (paise >= last.paise) return last.shifted;
  for (let i = 1; i < curve.length; i++) {
    if (paise <= curve[i].paise) {
      const a = curve[i - 1];
      const b = curve[i];
      return a.shifted + ((paise - a.paise) / (b.paise - a.paise)) * (b.shifted - a.shifted);
    }
  }
  return last.shifted;
}

/**
 * How often a parcel bound here is refused at the door.
 *
 * The payment mix does the work: cash orders come back refused at
 * `RTO_RATE_COD` and prepaid ones at `RTO_RATE_PREPAID`, which Unicommerce
 * measured at 20.9% against 5.8% over FY23. A place with more cash in it has
 * more refusals, and that is the whole of the mechanism.
 *
 * @param {string} price a `PRICE_TIERS` entry
 * @param {number} tierIndex into `LOCATION_TIERS`
 * @returns {number} 0..1
 */
export function refusalRateFor(price, tierIndex, discountPaise = 0) {
  const cod = codShareFor(price, tierIndex, discountPaise);
  return cod * RTO_RATE_COD + (1 - cod) * RTO_RATE_PREPAID;
}

/**
 * What fraction of the returns from here were REFUSALS rather than send-backs.
 *
 * A return and an RTO are different events — one reverses a sale, the other
 * means there never was one — and the engine has only ever had the first.
 *
 * A SHAPE, APPLIED TO A LEVEL SET ELSEWHERE. This is a RATIO, and it is applied
 * to whatever return rate `POSITION_ECONOMICS` already gives an advertiser —
 * nothing here sets how much comes back. Since F14 that level is itself the
 * total these same figures imply, and `constants.test.js` holds it there. Before
 * F14 it was not: the split was built on an invented 30% / 24% / 20% that meant
 * post-delivery returns alone, so the shape came from the sources and the level
 * contradicted them.
 *
 * Of 100 orders sent here, `refusalRateFor` are refused. The rest are delivered,
 * and `POST_DELIVERY_RETURN_RATE` of those come back afterwards. The share is
 * the first over the sum — which lands between 31% and 44% across the grid,
 * against the 16% to 58% an invented constant produced before the figures were
 * looked up.
 *
 * @param {string} price a `PRICE_TIERS` entry
 * @param {number} tierIndex into `LOCATION_TIERS`
 * @returns {number} 0..1, the share of returns that were refused at the door
 */
export function rtoShareOfReturns(price, tierIndex, discountPaise = 0) {
  const refused = refusalRateFor(price, tierIndex, discountPaise);
  const sentBack = (1 - refused) * POST_DELIVERY_RETURN_RATE;
  const total = refused + sentBack;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, refused / total));
}


export function validateLocationTables() {
  const problems = [];

  if (LOCATION_TIERS.length < 2) {
    problems.push('fewer than two location tiers leaves nothing to choose between');
  }
  for (const table of ['LOCATION_RETURN_MULTIPLIER', 'LOCATION_AOV_MULTIPLIER']) {
    const values = table === 'LOCATION_RETURN_MULTIPLIER'
      ? LOCATION_RETURN_MULTIPLIER : LOCATION_AOV_MULTIPLIER;
    if (values.length !== LOCATION_TIERS.length) {
      problems.push(`${table} has ${values.length} entries for ${LOCATION_TIERS.length} tiers`);
    }
    for (const value of values) {
      if (!Number.isFinite(value) || value <= 0) {
        problems.push(`${table} holds a non-positive value`);
        break;
      }
    }
  }

  for (const price of PRICE_TIERS) {
    const row = LOCATION_VOLUME_BY_PRICE[price];
    if (!row) {
      problems.push(`no volume row for price tier "${price}"`);
      continue;
    }
    if (row.length !== LOCATION_TIERS.length) {
      problems.push(`volume row "${price}" has ${row.length} entries for ${LOCATION_TIERS.length} tiers`);
      continue;
    }
    // The load-bearing one. A row summing to anything but 1 adds or destroys
    // demand for that price tier, which breaks the volume balance F9 engineered
    // and would do it silently.
    const total = row.reduce((a, b) => a + b, 0);
    if (Math.abs(total - 1) > 1e-9) {
      problems.push(`volume row "${price}" sums to ${total}, not 1`);
    }
    if (row.some((share) => !(share > 0))) {
      problems.push(`volume row "${price}" has a share of zero, locking it out of a tier`);
    }
  }

  return { valid: problems.length === 0, problems };
}

/**
 * Throw if the tables are unusable, for callers that cannot carry on without
 * them. Mirrors `assertValidQuerySet`: nothing downstream is trustworthy if the
 * demand split is not.
 *
 * @throws {RangeError}
 */
export function assertValidLocationTables() {
  const { valid, problems } = validateLocationTables();
  if (!valid) throw new RangeError(`location tables rejected: ${problems.join('; ')}`);
}
