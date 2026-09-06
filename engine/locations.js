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
 * What a location does to the money, once a click has converted.
 *
 * Both multipliers apply where the order is valued and where it is resolved, not
 * where it is bid — a metro basket is bigger and a town parcel comes back more
 * often, and neither changes how likely the click was.
 *
 * @param {number} index location tier index
 * @returns {{aovMultiplier: number, returnMultiplier: number}}
 * @throws {RangeError} out of range
 */
export function locationEffects(index) {
  locationIdAt(index);
  return {
    aovMultiplier: LOCATION_AOV_MULTIPLIER[index],
    returnMultiplier: LOCATION_RETURN_MULTIPLIER[index],
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
