/**
 * A query set builder for tests.
 *
 * Hand-writing 115 conforming query objects would be unreadable and would rot
 * the moment a rule changed. This builds a set that satisfies every rule in
 * spec 7.4, so tests can mutate one field and assert that exactly one rule
 * breaks.
 *
 * The builder constructs data; the validator inspects data. They share no
 * logic, so this is not circular.
 */

import { PRICE_TIERS, PURPOSES, TAG_VOCABULARY, SCHEMA_VERSION } from '../../engine/constants.js';
import { allocate } from '../../engine/money.js';
import { BRAND_IDS } from '../../content/brands.js';

/**
 * The real roster, not a parallel list. A fixture that invented its own
 * advertiser ids would keep passing after the roster changed, which is the
 * kind of drift these tests exist to catch.
 */
export const TEST_ADVERTISER_IDS = [...BRAND_IDS];

const HOUR_PROFILES = ['business', 'evening', 'flat'];

/** Affinity shaped so that price x purpose peaks on the intended cell. */
function affinitiesFor(price, purpose) {
  const priceAffinity = {};
  for (const p of PRICE_TIERS) priceAffinity[p] = p === price ? 1.6 : (adjacent(p, price) ? 0.9 : 0.3);
  const purposeAffinity = {};
  for (const p of PURPOSES) purposeAffinity[p] = p === purpose ? 1.3 : 0.7;
  return { priceAffinity, purposeAffinity };
}

function adjacent(a, b) {
  return Math.abs(PRICE_TIERS.indexOf(a) - PRICE_TIERS.indexOf(b)) === 1;
}

/**
 * Build a query set that passes every rule in spec 7.4.
 *
 * Volume budget, in basis points of 10000:
 *   commercial     8400   the territory, split 52/28/20 across price tiers
 *   brand           600   one per advertiser
 *   informational   400
 *   irrelevant      600   comfortably over the 5% floor
 *
 * @param {{perCell?: number, headTermsPerCell?: number, advertiserIds?: string[]}} [opts]
 * @returns {object} a valid QuerySet
 */
export function makeQuerySet(opts = {}) {
  const {
    perCell = 15,
    headTermsPerCell = 3,
    advertiserIds = TEST_ADVERTISER_IDS,
  } = opts;

  const queries = [];
  let n = 0;
  const nextId = () => `q_${String(++n).padStart(3, '0')}`;

  // --- commercial territory -------------------------------------------------
  // 8400bp split 52/28/20 by tier, then evenly across that tier's two cells,
  // then evenly across each cell's queries. allocate() guarantees the parts sum
  // back to the whole at every level.
  const tierBp = allocate(8400, [52, 28, 20]);

  PRICE_TIERS.forEach((price, ti) => {
    const cellBp = allocate(tierBp[ti], PURPOSES.map(() => 1));
    PURPOSES.forEach((purpose, pi) => {
      const perQueryBp = allocate(cellBp[pi], Array.from({ length: perCell }, () => 1));
      for (let i = 0; i < perCell; i++) {
        queries.push({
          id: nextId(),
          text: `${price} ${purpose} query ${i}`,
          isHeadTerm: i < headTermsPerCell,
          volumeShareBp: perQueryBp[i],
          intent: 'commercial',
          brandOwner: null,
          tags: [TAG_VOCABULARY[0], TAG_VOCABULARY[20], TAG_VOCABULARY[30]],
          ...affinitiesFor(price, purpose),
          convMultiplier: 1.0,
          valueMultiplier: 1.0,
          returnRateMultiplier: 1.0,
          hourProfile: HOUR_PROFILES[i % HOUR_PROFILES.length],
        });
      }
    });
  });

  // --- brand ---------------------------------------------------------------
  const brandBp = allocate(600, advertiserIds.map(() => 1));
  advertiserIds.forEach((id, i) => {
    queries.push({
      id: nextId(),
      text: `${id} leggings`,
      isHeadTerm: false,
      volumeShareBp: brandBp[i],
      intent: 'brand',
      brandOwner: id,
      tags: [TAG_VOCABULARY[0], 'brand-term'],
      ...affinitiesFor('mid', 'performance'),
      convMultiplier: 1.0,
      valueMultiplier: 1.0,
      returnRateMultiplier: 1.0,
      hourProfile: 'flat',
    });
  });

  // --- informational and irrelevant ----------------------------------------
  const addNonTerritory = (intent, totalBp, count, label) => {
    const bp = allocate(totalBp, Array.from({ length: count }, () => 1));
    for (let i = 0; i < count; i++) {
      queries.push({
        id: nextId(),
        text: `${label} query ${i}`,
        isHeadTerm: false,
        volumeShareBp: bp[i],
        intent,
        brandOwner: null,
        tags: [TAG_VOCABULARY[0]],
        ...affinitiesFor('mid', 'performance'),
        convMultiplier: 1.0,
        valueMultiplier: 1.0,
        returnRateMultiplier: 1.0,
        hourProfile: 'flat',
      });
    }
  };
  addNonTerritory('informational', 400, 8, 'how to wash');
  addNonTerritory('irrelevant', 600, 8, 'free workout plan');

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedFrom: 'test fixture',
    weeklyVolume: 225000,
    tagVocabulary: [...TAG_VOCABULARY],
    queries,
  };
}

/**
 * Deep clone so a mutation in one test cannot leak into another.
 *
 * @template T
 * @param {T} obj
 * @returns {T}
 */
export function clone(obj) {
  return structuredClone(obj);
}

/**
 * Clone the set and hand the copy to a mutator, for the "break exactly one
 * rule" tests.
 *
 * @param {object} querySet
 * @param {(qs: object) => void} mutate
 * @returns {object} the mutated clone
 */
export function broken(querySet, mutate) {
  const copy = clone(querySet);
  mutate(copy);
  return copy;
}
