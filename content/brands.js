/**
 * The nine brand identities (spec 7.5).
 *
 * Frozen alongside the query set. The player takes one at round 0; the other
 * eight go to the rivals.
 *
 * WHY THESE NAMES SAY NOTHING
 *
 * Rival placement is seeded per game (17.1), so any name carrying a price or
 * purpose signal would eventually land in a cell that contradicts it. A brand
 * called "BudgetBox" turning up in Premium does not merely read oddly — it
 * actively misleads, because 17.1 makes position *inferable from ad copy*, and
 * a name pulling the other way poisons that inference.
 *
 * So every name here is abstract. Position is signalled entirely through ad
 * copy, authored per cell in content/adCopy.js, which is the honest place for
 * it. A brand is not premium because of its name.
 *
 * This is also true of most real D2C labels, which are coined words chosen to
 * be memorable rather than descriptive.
 *
 * Adding a name that signals price or purpose is a real regression, and
 * tests/brands.test.js will refuse it.
 */

/**
 * @typedef {{id: string, name: string, domain: string}} BrandIdentity
 */

/** @type {readonly BrandIdentity[]} */
export const BRAND_IDENTITIES = Object.freeze([
  { id: 'vella', name: 'Vella & Co.', domain: 'vellaandco.in' },
  { id: 'kestrel', name: 'Kestrel', domain: 'kestrel.in' },
  { id: 'marlow', name: 'Marlow', domain: 'marlowlabel.in' },
  { id: 'satva', name: 'Satva', domain: 'satva.in' },
  { id: 'halcyon', name: 'Halcyon', domain: 'halcyon.in' },
  { id: 'lumen', name: 'Lumen', domain: 'lumenlabel.in' },
  { id: 'nira', name: 'Nira', domain: 'nira.in' },
  { id: 'torvi', name: 'Torvi', domain: 'torvi.in' },
  { id: 'auren', name: 'Auren', domain: 'auren.in' },
].map(Object.freeze));

/** Every identity id, in roster order. */
export const BRAND_IDS = Object.freeze(BRAND_IDENTITIES.map((b) => b.id));

/**
 * The distinctive word in a brand name — the one people actually type.
 *
 * NOT the registered name, and that is not pedantry. The roster holds
 * "Vella & Co." while the query it owns reads "vella leggings"; nobody searches
 * a company's legal name with its ampersand attached. Matching the full string
 * finds ownership for eight of the nine and silently misses the one whose name
 * runs to more than a word.
 *
 * @param {string} name
 * @returns {string|null}
 */
export function brandToken(name) {
  const match = String(name ?? '').toLowerCase().match(/[a-z0-9]+/);
  return match ? match[0] : null;
}

/**
 * Which advertiser's name appears in this search, if any.
 *
 * OWNERSHIP IS INFERRED, NEVER READ. `query.brandOwner` is withheld from every
 * viewer (16.1), so the interface works it out the way a player would: read the
 * words, look for a name you already know. Identity is public because the Ads
 * Transparency Center makes it so (R3), which is what makes the inference fair.
 *
 * `agents/policies.js` does the same thing with its own private copy of this,
 * and that duplication is DELIBERATE — `policies.test.js` forbids that file
 * from importing `content/` at all, so a policy cannot reach the roster except
 * through the view it was handed. A shared helper would be a hole in a guard
 * that is currently absolute.
 *
 * Whole-word only, so a short name cannot match inside a longer word.
 *
 * @param {string} text the search term
 * @param {Array<{id: string, name: string}>} advertisers
 * @returns {{id: string, name: string}|null}
 */
export function brandNamedIn(text, advertisers) {
  const haystack = String(text ?? '').toLowerCase();
  for (const advertiser of advertisers ?? []) {
    const token = brandToken(advertiser.name);
    // `\\b`, not `\b` — inside a template literal a single backslash-b is the
    // BACKSPACE character, so the first version of this matched nothing at all
    // and every brand term rendered unlabelled.
    if (token && new RegExp(`\\b${token}\\b`).test(haystack)) {
      return { id: advertiser.id, name: advertiser.name };
    }
  }
  return null;
}

/**
 * Words that would leak a price tier or a purpose into a brand name.
 *
 * Exported so the test can assert against it and so the reason for the list is
 * visible rather than buried in an assertion.
 */
export const POSITION_SIGNALLING_WORDS = Object.freeze([
  // price
  'budget', 'cheap', 'value', 'save', 'discount', 'deal', 'bargain',
  'premium', 'luxe', 'luxury', 'elite', 'prime', 'lux',
  // purpose
  'active', 'sport', 'sports', 'gym', 'fit', 'fitness', 'athletic',
  'performance', 'pro', 'train', 'run', 'yoga', 'flex', 'lounge', 'street',
]);

/**
 * Look up one identity by id.
 *
 * @param {string} id
 * @returns {BrandIdentity}
 */
export function brandById(id) {
  const found = BRAND_IDENTITIES.find((b) => b.id === id);
  if (!found) throw new RangeError(`unknown brand id "${id}"`);
  return found;
}

/**
 * Split the roster into the player's identity and the eight rivals', preserving
 * roster order for the rivals so placement stays reproducible (R1).
 *
 * @param {string} playerId one of BRAND_IDS
 * @returns {{player: BrandIdentity, rivals: BrandIdentity[]}}
 */
export function assignIdentities(playerId) {
  const player = brandById(playerId);
  const rivals = BRAND_IDENTITIES.filter((b) => b.id !== playerId);
  return { player, rivals };
}
