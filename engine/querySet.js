/**
 * Query set validation (spec 7.4).
 *
 * The query set is the one artefact where a subtle flaw poisons every number in
 * the simulation without ever throwing an error. A tier three points light on
 * volume does not crash anything — it just quietly makes one position
 * unwinnable, and you would spend a long time blaming the auction.
 *
 * So this module refuses to let a bad set into the engine at all. Same
 * philosophy as L16's schemaVersion rule: reject loudly rather than misread.
 *
 * Pure and offline (R1, R2). The semantic work — deciding that "squat proof
 * tights" is a premium performance query — happens in agents/queryGen.js before
 * anything reaches here. This module only checks the data it is handed.
 */

import {
  PRICE_TIERS, PURPOSES, SCHEMA_VERSION,
  QUERY_SET_RULES, DAY_OF_WEEK_CURVE, HOUR_PROFILES,
} from './constants.js';
// The grid itself belongs to positions.js. A query's *home* on that grid is a
// query concept and stays here.
import { cellKey, allCells } from './positions.js';

/** Derived from the curves themselves, so the two can never disagree. */
export const DAYS_PER_WEEK = DAY_OF_WEEK_CURVE.length;
export const HOURS_PER_DAY = HOUR_PROFILES.business.length;

/** Rule identifiers, so failures can be asserted on rather than string-matched. */
export const RULES = {
  SCHEMA_VERSION: 'SCHEMA_VERSION',
  WEEKLY_VOLUME: 'WEEKLY_VOLUME',
  TAG_VOCABULARY_MISSING: 'TAG_VOCABULARY_MISSING',
  QUERIES_MISSING: 'QUERIES_MISSING',
  FIELD_SHAPE: 'FIELD_SHAPE',
  VOLUME_SHARE_SUM: 'VOLUME_SHARE_SUM',
  DUPLICATE_TEXT: 'DUPLICATE_TEXT',
  DUPLICATE_ID: 'DUPLICATE_ID',
  TAG_PRESENT: 'TAG_PRESENT',
  TAG_IN_VOCABULARY: 'TAG_IN_VOCABULARY',
  CELL_QUERY_COUNT: 'CELL_QUERY_COUNT',
  CELL_VOLUME_SHARE: 'CELL_VOLUME_SHARE',
  TIER_VOLUME_SPLIT: 'TIER_VOLUME_SPLIT',
  IRRELEVANT_VOLUME: 'IRRELEVANT_VOLUME',
  HEAD_TERMS_PER_CELL: 'HEAD_TERMS_PER_CELL',
  BRAND_COVERAGE: 'BRAND_COVERAGE',
  BRAND_OWNER_UNKNOWN: 'BRAND_OWNER_UNKNOWN',
  BRAND_OWNER_CONSISTENCY: 'BRAND_OWNER_CONSISTENCY',
};

const INTENTS = ['commercial', 'informational', 'brand', 'irrelevant'];
const HOUR_PROFILE_NAMES = ['business', 'evening', 'flat'];
const TOTAL_BP = 10000;

/**
 * The cell a query belongs to: the price x purpose pair whose combined affinity
 * is highest.
 *
 * Only commercial queries have a home. Informational and irrelevant traffic is
 * waste rather than territory, and brand traffic belongs to whoever owns the
 * trademark rather than to a cell — counting either toward a cell's territory
 * would let a set look well-supplied while offering a position nothing it
 * actually wants to buy.
 *
 * Ties resolve to the first cell in PRICE_TIERS x PURPOSES order, so the result
 * is deterministic.
 *
 * @param {object} query
 * @returns {string|null} cell key, or null when the query is not territory
 */
export function homeCell(query) {
  if (!query || query.intent !== 'commercial') return null;
  const { priceAffinity, purposeAffinity } = query;
  if (!priceAffinity || !purposeAffinity) return null;

  let best = null;
  let bestScore = -Infinity;
  for (const price of PRICE_TIERS) {
    for (const purpose of PURPOSES) {
      const score = priceAffinity[price] * purposeAffinity[purpose];
      if (score > bestScore) {
        bestScore = score;
        best = cellKey(price, purpose);
      }
    }
  }
  return Number.isFinite(bestScore) ? best : null;
}

/**
 * Check a query set against every rule in spec 7.4.
 *
 * Never throws and never mutates its input, so a caller can report all problems
 * at once rather than fixing them one crash at a time.
 *
 * @param {object} querySet
 * @param {{advertiserIds?: string[]}} [options] advertiser roster; when omitted,
 *   brand coverage is reported as a warning instead of checked
 * @returns {{valid: boolean, errors: Array<{rule: string, message: string}>,
 *            warnings: Array<{rule: string, message: string}>, stats: object|null}}
 */
export function validateQuerySet(querySet, options = {}) {
  const errors = [];
  const warnings = [];
  const fail = (rule, message) => errors.push({ rule, message });
  const warn = (rule, message) => warnings.push({ rule, message });

  if (!querySet || typeof querySet !== 'object' || Array.isArray(querySet)) {
    fail(RULES.QUERIES_MISSING, 'query set must be an object');
    return { valid: false, errors, warnings, stats: null };
  }

  if (querySet.schemaVersion !== SCHEMA_VERSION) {
    fail(RULES.SCHEMA_VERSION,
      `schemaVersion must be "${SCHEMA_VERSION}", got ${JSON.stringify(querySet.schemaVersion)}`);
  }

  if (!Number.isFinite(querySet.weeklyVolume) || querySet.weeklyVolume <= 0) {
    fail(RULES.WEEKLY_VOLUME,
      `weeklyVolume must be a positive number, got ${String(querySet.weeklyVolume)}`);
  }

  if (!Array.isArray(querySet.tagVocabulary) || querySet.tagVocabulary.length === 0) {
    fail(RULES.TAG_VOCABULARY_MISSING, 'tagVocabulary must be a non-empty array');
  }

  const queries = querySet.queries;
  if (!Array.isArray(queries) || queries.length === 0) {
    fail(RULES.QUERIES_MISSING, 'queries must be a non-empty array');
    return { valid: false, errors, warnings, stats: null };
  }

  const vocabulary = new Set(querySet.tagVocabulary || []);

  // --- per-query shape ------------------------------------------------------
  const seenIds = new Set();
  const seenText = new Set();

  for (const [i, q] of queries.entries()) {
    const at = `queries[${i}]${q && q.id ? ` (${q.id})` : ''}`;

    if (!q || typeof q !== 'object') {
      fail(RULES.FIELD_SHAPE, `${at}: not an object`);
      continue;
    }

    if (typeof q.id !== 'string' || q.id.trim() === '') {
      fail(RULES.FIELD_SHAPE, `${at}: id must be a non-empty string`);
    } else if (seenIds.has(q.id)) {
      fail(RULES.DUPLICATE_ID, `${at}: duplicate id "${q.id}"`);
    } else {
      seenIds.add(q.id);
    }

    if (typeof q.text !== 'string' || q.text.trim() === '') {
      fail(RULES.FIELD_SHAPE, `${at}: text must be a non-empty string`);
    } else {
      // Two queries differing only in case or padding are the same search.
      const norm = q.text.trim().toLowerCase().replace(/\s+/g, ' ');
      if (seenText.has(norm)) {
        fail(RULES.DUPLICATE_TEXT, `${at}: duplicate text "${q.text.trim()}"`);
      } else {
        seenText.add(norm);
      }
    }

    if (!Number.isSafeInteger(q.volumeShareBp) || q.volumeShareBp < 0) {
      fail(RULES.FIELD_SHAPE,
        `${at}: volumeShareBp must be a non-negative integer, got ${String(q.volumeShareBp)}`);
    }

    if (!INTENTS.includes(q.intent)) {
      fail(RULES.FIELD_SHAPE, `${at}: intent must be one of ${INTENTS.join(', ')}`);
    }

    if (!HOUR_PROFILE_NAMES.includes(q.hourProfile)) {
      fail(RULES.FIELD_SHAPE,
        `${at}: hourProfile must be one of ${HOUR_PROFILE_NAMES.join(', ')}`);
    }

    if (typeof q.isHeadTerm !== 'boolean') {
      fail(RULES.FIELD_SHAPE, `${at}: isHeadTerm must be a boolean`);
    }

    checkAffinity(q.priceAffinity, PRICE_TIERS, 'priceAffinity', at, fail);
    checkAffinity(q.purposeAffinity, PURPOSES, 'purposeAffinity', at, fail);

    for (const key of ['convMultiplier', 'valueMultiplier', 'returnRateMultiplier']) {
      const v = q[key];
      if (!Number.isFinite(v) || v < 0) {
        fail(RULES.FIELD_SHAPE, `${at}: ${key} must be finite and non-negative, got ${String(v)}`);
      }
    }

    if (!Array.isArray(q.tags) || q.tags.length === 0) {
      fail(RULES.TAG_PRESENT, `${at}: must carry at least one tag or broad match is inert`);
    } else {
      for (const tag of q.tags) {
        if (!vocabulary.has(tag)) {
          fail(RULES.TAG_IN_VOCABULARY, `${at}: tag "${tag}" is not in tagVocabulary`);
        }
      }
    }

    const isBrand = q.intent === 'brand';
    const hasOwner = typeof q.brandOwner === 'string' && q.brandOwner !== '';
    if (isBrand && !hasOwner) {
      fail(RULES.BRAND_OWNER_CONSISTENCY, `${at}: intent "brand" requires a brandOwner`);
    }
    if (!isBrand && hasOwner) {
      fail(RULES.BRAND_OWNER_CONSISTENCY,
        `${at}: brandOwner "${q.brandOwner}" set on a ${q.intent} query`);
    }
  }

  // --- volume ---------------------------------------------------------------
  const bpTotal = queries.reduce(
    (a, q) => a + (Number.isSafeInteger(q?.volumeShareBp) ? q.volumeShareBp : 0), 0,
  );
  if (bpTotal !== TOTAL_BP) {
    fail(RULES.VOLUME_SHARE_SUM,
      `volumeShareBp must sum to exactly ${TOTAL_BP}, got ${bpTotal}`);
  }

  const irrelevantBp = sumBpWhere(queries, (q) => q.intent === 'irrelevant');
  const irrelevantShare = bpTotal > 0 ? irrelevantBp / bpTotal : 0;
  if (irrelevantShare < QUERY_SET_RULES.minIrrelevantVolumeShare) {
    fail(RULES.IRRELEVANT_VOLUME,
      `irrelevant traffic is ${(irrelevantShare * 100).toFixed(2)}% of volume, `
      + `below the ${(QUERY_SET_RULES.minIrrelevantVolumeShare * 100).toFixed(0)}% floor. `
      + 'Broad match needs something worthless to reach.');
  }

  // --- territory: cells and tiers ------------------------------------------
  // Territory is commercial traffic only. Shares below are of territory volume,
  // not of total volume, since informational and irrelevant traffic belongs to
  // no position.
  const cellCounts = new Map(allCells().map((c) => [c, 0]));
  const cellBp = new Map(allCells().map((c) => [c, 0]));
  const cellHeadTerms = new Map(allCells().map((c) => [c, 0]));
  const tierBp = new Map(PRICE_TIERS.map((t) => [t, 0]));
  let territoryBp = 0;

  for (const q of queries) {
    const cell = homeCell(q);
    if (!cell) continue;
    const bp = Number.isSafeInteger(q.volumeShareBp) ? q.volumeShareBp : 0;
    cellCounts.set(cell, cellCounts.get(cell) + 1);
    cellBp.set(cell, cellBp.get(cell) + bp);
    if (q.isHeadTerm) cellHeadTerms.set(cell, cellHeadTerms.get(cell) + 1);
    const tier = cell.split('|')[0];
    tierBp.set(tier, tierBp.get(tier) + bp);
    territoryBp += bp;
  }

  for (const cell of allCells()) {
    const count = cellCounts.get(cell);
    if (count < QUERY_SET_RULES.minQueriesPerCell) {
      fail(RULES.CELL_QUERY_COUNT,
        `cell ${cell} has ${count} queries, below the minimum of `
        + `${QUERY_SET_RULES.minQueriesPerCell}`);
    }

    const heads = cellHeadTerms.get(cell);
    if (heads < QUERY_SET_RULES.minHeadTermsPerCell) {
      fail(RULES.HEAD_TERMS_PER_CELL,
        `cell ${cell} has ${heads} head terms, below the minimum of `
        + `${QUERY_SET_RULES.minHeadTermsPerCell}. Without them a player's keyword may `
        + 'never literally appear as a query, and its Quality Score stays null forever.');
    }

    const share = territoryBp > 0 ? cellBp.get(cell) / territoryBp : 0;
    if (share < QUERY_SET_RULES.minCellVolumeShare) {
      fail(RULES.CELL_VOLUME_SHARE,
        `cell ${cell} holds ${(share * 100).toFixed(2)}% of territory volume, below the `
        + `${(QUERY_SET_RULES.minCellVolumeShare * 100).toFixed(0)}% floor`);
    }
  }

  for (const [tier, target] of Object.entries(QUERY_SET_RULES.tierVolumeTargets)) {
    const share = territoryBp > 0 ? tierBp.get(tier) / territoryBp : 0;
    const drift = Math.abs(share - target);
    if (drift > QUERY_SET_RULES.tierVolumeTolerance) {
      fail(RULES.TIER_VOLUME_SPLIT,
        `tier ${tier} holds ${(share * 100).toFixed(1)}% of territory volume against a `
        + `target of ${(target * 100).toFixed(0)}% (tolerance `
        + `${(QUERY_SET_RULES.tierVolumeTolerance * 100).toFixed(0)} points)`);
    }
  }

  // --- brand coverage -------------------------------------------------------
  const owners = new Set(
    queries.filter((q) => q.intent === 'brand' && typeof q.brandOwner === 'string')
      .map((q) => q.brandOwner),
  );

  if (Array.isArray(options.advertiserIds) && options.advertiserIds.length > 0) {
    for (const id of options.advertiserIds) {
      if (!owners.has(id)) {
        fail(RULES.BRAND_COVERAGE, `no brand query for advertiser "${id}"`);
      }
    }
    const known = new Set(options.advertiserIds);
    for (const owner of owners) {
      if (!known.has(owner)) {
        fail(RULES.BRAND_OWNER_UNKNOWN,
          `brand query names "${owner}", who is not in the advertiser roster`);
      }
    }
  } else {
    warn(RULES.BRAND_COVERAGE,
      'no advertiserIds supplied, so brand coverage was not checked');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      queryCount: queries.length,
      volumeShareBpTotal: bpTotal,
      territoryBp,
      irrelevantShare,
      cellCounts: Object.fromEntries(cellCounts),
      cellVolumeShare: Object.fromEntries(
        [...cellBp].map(([c, bp]) => [c, territoryBp > 0 ? bp / territoryBp : 0]),
      ),
      tierVolumeShare: Object.fromEntries(
        [...tierBp].map(([t, bp]) => [t, territoryBp > 0 ? bp / territoryBp : 0]),
      ),
    },
  };
}

/**
 * Validate and throw on any failure (spec 7.4).
 *
 * The thrown error carries `errors` so a caller can inspect the failures rather
 * than parse the message.
 *
 * @param {object} querySet
 * @param {{advertiserIds?: string[]}} [options]
 * @returns {object} the same query set, when valid
 */
export function assertValidQuerySet(querySet, options = {}) {
  const result = validateQuerySet(querySet, options);
  if (!result.valid) {
    const lines = result.errors.map((e) => `  [${e.rule}] ${e.message}`).join('\n');
    const error = /** @type {Error & {errors: object[]}} */ (new Error(
      `Query set failed ${result.errors.length} check(s):\n${lines}`,
    ));
    error.errors = result.errors;
    throw error;
  }
  return querySet;
}

// ===========================================================================
// Volume composition (spec 7.2)
// ===========================================================================

/**
 * How many people search this query in this hour of this day.
 *
 *   weeklyVolume x volumeShareBp/10000 x DAY_OF_WEEK_CURVE[day]
 *                                      x HOUR_PROFILES[hourProfile][hour]
 *
 * One mechanism, not two. v0.1 carried a global hourly demand curve *and* a
 * per-query hour profile and multiplied both, so every query was shaped twice
 * by the clock — the L6 defect. There is now exactly one hourly weighting and
 * it belongs to the query.
 *
 * Both curves are normalised over their range, so summing this across every
 * query, day and hour returns weeklyVolume exactly. That conservation is
 * asserted in the tests and is the cheapest way to catch a weighting applied
 * twice or dropped.
 *
 * Returns a fractional count, deliberately. The engine never simulates
 * individual searches — one auction resolution carries a weighted slice of an
 * hour's volume (spec 11.5) — so whole numbers here would be a false precision.
 * This is not money and R7 does not apply.
 *
 * @param {object} querySet the set the query belongs to, for weeklyVolume
 * @param {object} query
 * @param {number} day 0..6, 0 is Monday
 * @param {number} hour 0..23
 * @returns {number} expected searches, fractional
 */
export function searches(querySet, query, day, hour) {
  if (!Number.isInteger(day) || day < 0 || day >= DAYS_PER_WEEK) {
    throw new RangeError(`day must be an integer 0..${DAYS_PER_WEEK - 1}, got ${String(day)}`);
  }
  if (!Number.isInteger(hour) || hour < 0 || hour >= HOURS_PER_DAY) {
    throw new RangeError(`hour must be an integer 0..${HOURS_PER_DAY - 1}, got ${String(hour)}`);
  }

  const profile = HOUR_PROFILES[query.hourProfile];
  if (!profile) {
    throw new RangeError(
      `unknown hourProfile "${query.hourProfile}" on query ${query.id ?? '(no id)'}`,
    );
  }

  return (querySet.weeklyVolume * query.volumeShareBp) / TOTAL_BP
    * DAY_OF_WEEK_CURVE[day]
    * profile[hour];
}

/**
 * Expected searches for one query across a whole day.
 *
 * @param {object} querySet
 * @param {object} query
 * @param {number} day 0..6
 * @returns {number} fractional count
 */
export function daySearches(querySet, query, day) {
  let total = 0;
  for (let hour = 0; hour < HOURS_PER_DAY; hour++) {
    total += searches(querySet, query, day, hour);
  }
  return total;
}

/**
 * Expected searches for one query across a whole round.
 *
 * Equals weeklyVolume x volumeShareBp/10000, since both curves are normalised.
 * The hour profile decides *when* the searches happen, never how many there are.
 *
 * @param {object} querySet
 * @param {object} query
 * @returns {number} fractional count
 */
export function weeklySearches(querySet, query) {
  let total = 0;
  for (let day = 0; day < DAYS_PER_WEEK; day++) {
    total += daySearches(querySet, query, day);
  }
  return total;
}

function checkAffinity(obj, keys, label, at, fail) {
  if (!obj || typeof obj !== 'object') {
    fail(RULES.FIELD_SHAPE, `${at}: ${label} must be an object`);
    return;
  }
  for (const key of keys) {
    const v = obj[key];
    if (!Number.isFinite(v) || v < 0) {
      fail(RULES.FIELD_SHAPE,
        `${at}: ${label}.${key} must be finite and non-negative, got ${String(v)}`);
    }
  }
}

function sumBpWhere(queries, predicate) {
  return queries.reduce(
    (a, q) => a + (predicate(q) && Number.isSafeInteger(q.volumeShareBp) ? q.volumeShareBp : 0),
    0,
  );
}
