/**
 * Where the searches happen (DECISIONS G4, I24).
 *
 * The engine's vocabulary is three ids in `LOCATION_TIERS`; this file is what a
 * player reads. Same split as `content/brands.js`: identity and words live in
 * content, physics lives in `engine/`.
 *
 * WHY REAL CITIES ARE NAMED. "Tier 2" means nothing to somebody deciding where
 * to advertise, and *Indore* means something immediately. The examples are not
 * decoration and they are not data either — nothing in `engine/` reads them, and
 * no query belongs to a city. They exist so the tiers are recognisable as places
 * rather than as three abstract buckets.
 *
 * THE GROUPING IS THE ORDINARY INDIAN E-COMMERCE ONE, and it is a caricature in
 * the same way the positioning grid is: a real media plan buys states, cities and
 * radii, not three buckets. Three is the fewest that gives a real choice, and
 * more would split each keyword's traffic thin enough that noise dominates.
 */

import { LOCATION_TIERS } from '../engine/constants.js';

/**
 * What each tier is, in a player's words.
 *
 * `note` is the thing a founder in this market would already know, and it is
 * what the round 0 briefing quotes (17.2). The returns line is deliberately
 * stated rather than withheld: an Indian D2C founder knows that COD orders come
 * back more often outside the metros, so making the player discover it would be
 * withholding something the character would have.
 */
export const LOCATIONS = Object.freeze([
  Object.freeze({
    id: 'tier1',
    label: 'Metros',
    examples: ['Mumbai', 'Delhi NCR', 'Bengaluru', 'Hyderabad', 'Chennai', 'Pune'],
    note: 'Card and UPI mostly, bigger baskets, and the fewest returns. '
      + 'Everyone else wants to be here too.',
  }),
  Object.freeze({
    id: 'tier2',
    label: 'Large cities',
    examples: ['Jaipur', 'Lucknow', 'Kochi', 'Indore', 'Chandigarh', 'Coimbatore'],
    note: 'Baskets close to the metros, and noticeably more of what sells here '
      + 'comes back.',
  }),
  Object.freeze({
    id: 'tier3',
    label: 'Smaller cities and towns',
    examples: ['Guwahati', 'Raipur', 'Jodhpur', 'Salem', 'Warangal', 'Siliguri'],
    note: 'The cheapest attention in the country, smaller baskets, and cash on '
      + 'delivery means half again as many returns as a metro.',
  }),
]);

/**
 * One tier by id.
 *
 * @param {string} id one of LOCATION_TIERS
 * @returns {object} the frozen tier
 * @throws {RangeError} on an unknown id, rather than quietly returning the first
 *   — a typo that silently targeted the metros would be invisible in every
 *   number it produced.
 */
export function location(id) {
  const found = LOCATIONS.find((tier) => tier.id === id);
  if (!found) throw new RangeError(`unknown location tier "${id}"`);
  return found;
}

/** The tiers in engine order, so a caller can render them without re-sorting. */
export const locationsInOrder = () => LOCATION_TIERS.map((id) => location(id));
