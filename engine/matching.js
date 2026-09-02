/**
 * Query x keyword x match type -> eligibility (spec 8).
 *
 * You do not buy keywords. You buy a rule deciding which of the searches
 * people actually type your keyword will catch, and the gap between what you
 * asked for and what you got is where most money in paid search is lost.
 *
 * TWO MECHANISMS, DELIBERATELY SEPARATE
 *
 * Only broad match needs semantics. Exact and phrase are string operations —
 * stemming, ordered token containment — and negatives are string operations
 * too. Broad match alone consults the concept tags that agents/queryGen.js
 * assigned offline, which is how a pure engine can be semantic at all (R1, R2).
 *
 * NEGATIVES ARE STRICTER THAN THEIR POSITIVE TWINS
 *
 * They never touch the tag layer and they never accept close variants. Route
 * them through tags and "-cheap" would kill every query tagged price-sensitive
 * even where the word never appears — inverting the real behaviour, where a
 * negative blocks only what it literally names (L11, H3).
 *
 * The asymmetry that leaves is real and intended: you get dragged into a query
 * by semantic association, and can only block it by naming its literal words,
 * after the fact, from your search terms report.
 */

import { BROAD_MATCH_MIN_OVERLAP, QUALITY_FACTOR_RANGES } from './constants.js';
import { lerp } from './num.js';

/** Exact beats phrase beats broad, for the 8.6 tie-break. */
export const MATCH_SPECIFICITY = Object.freeze({ exact: 3, phrase: 2, broad: 1 });

const TYPO_MIN_LENGTH = 6;
const TYPO_PREFIX = 4;

/**
 * Lowercase, strip punctuation, collapse whitespace.
 *
 * @param {string} text
 * @returns {string}
 */
export function normalise(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Split normalised text into tokens. Empty text gives an empty array rather
 * than one empty token.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function tokenise(text) {
  const n = normalise(text);
  return n === '' ? [] : n.split(' ');
}

/**
 * Crude English plural stemmer.
 *
 * Deliberately small. It only has to fold the plurals that appear in an
 * apparel vocabulary — leggings/legging, shorts/short — and a fuller stemmer
 * would start folding words that mean different things.
 *
 * @param {string} word
 * @returns {string}
 */
export function stem(word) {
  if (word.length <= 3) return word;
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (/(ss|sh|ch|x)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('ss')) return word;
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/**
 * Are two tokens close variants of each other?
 *
 * Plurals always. A single-character typo only when both words are reasonably
 * long AND share their first four characters.
 *
 * That prefix guard is doing real work: "shorts" and "shirts" are one edit
 * apart and are different products. Accepting bare edit distance would
 * silently match a shorts keyword to a shirts query, which is exactly the kind
 * of quiet wrongness this simulator exists not to teach.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function variantTokens(a, b) {
  if (a === b) return true;
  if (stem(a) === stem(b)) return true;
  if (a.length < TYPO_MIN_LENGTH || b.length < TYPO_MIN_LENGTH) return false;
  if (a.slice(0, TYPO_PREFIX) !== b.slice(0, TYPO_PREFIX)) return false;
  return editDistanceWithin1(a, b);
}

/**
 * Fraction of the KEYWORD's tags that appear on the query.
 *
 * Keyword-relative, not symmetric: a tightly focused keyword should not be
 * penalised for a query carrying extra concepts it never asked about.
 *
 * @param {string[]} keywordTags
 * @param {string[]} queryTags
 * @returns {number} 0..1
 */
export function tagOverlap(keywordTags, queryTags) {
  const kt = keywordTags ?? [];
  if (kt.length === 0) return 0;
  const have = new Set(queryTags ?? []);
  let hit = 0;
  for (const tag of kt) if (have.has(tag)) hit += 1;
  return hit / kt.length;
}

/**
 * Does this keyword catch this query?
 *
 * @param {{text: string, tags?: string[]}} query
 * @param {{text: string, matchType: string, tags?: string[]}} keyword
 * @returns {boolean}
 */
export function matchesKeyword(query, keyword) {
  switch (keyword.matchType) {
    case 'exact': return matchesExact(query, keyword);
    case 'phrase': return matchesPhrase(query, keyword);
    case 'broad': return matchesBroad(query, keyword);
    default:
      throw new RangeError(`unknown matchType "${keyword.matchType}"`);
  }
}

/** The query is the keyword, or a close variant: plural, misspelling, reordering. */
function matchesExact(query, keyword) {
  const qt = tokenise(query.text);
  const kt = tokenise(keyword.text);
  if (qt.length !== kt.length) return false;

  // Greedy bijection. Token counts are tiny, so the cost does not matter and
  // the alternative - sorting by stem - misplaces typo variants.
  const pool = [...qt];
  for (const k of kt) {
    const i = pool.findIndex((token) => variantTokens(token, k));
    if (i === -1) return false;
    pool.splice(i, 1);
  }
  return true;
}

/**
 * The keyword's terms appear contiguously and in order, with text permitted
 * either side.
 *
 * Stemming applies, so plurals still match. Typo tolerance does not: only
 * exact match carries close variants, which mirrors how Google separates the
 * two.
 */
function matchesPhrase(query, keyword) {
  const qt = tokenise(query.text).map(stem);
  const kt = tokenise(keyword.text).map(stem);
  if (kt.length === 0 || kt.length > qt.length) return false;

  for (let start = 0; start + kt.length <= qt.length; start++) {
    let ok = true;
    for (let j = 0; j < kt.length; j++) {
      if (qt[start + j] !== kt[j]) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

/**
 * Semantically related, decided on precomputed tags.
 *
 * An untagged keyword overlaps nothing and so matches nothing on broad — it
 * degrades to inert rather than to universal, which is the safe direction
 * (spec 8.4).
 */
function matchesBroad(query, keyword) {
  return tagOverlap(keyword.tags, query.tags) >= BROAD_MATCH_MIN_OVERLAP;
}

/**
 * Which negative blocks this query, if any.
 *
 * @param {{text: string}} query
 * @param {Array<{text: string, matchType: string}>} negatives
 * @returns {object|null} the negative that fired, or null
 */
export function blockedBy(query, negatives) {
  for (const negative of negatives ?? []) {
    if (negativeFires(query, negative)) return negative;
  }
  return null;
}

/**
 * @param {{text: string}} query
 * @param {Array<{text: string, matchType: string}>} negatives
 * @returns {boolean}
 */
export function isBlocked(query, negatives) {
  return blockedBy(query, negatives) !== null;
}

/**
 * Negative semantics: literal tokens only, no stemming, no tags, no variants.
 */
function negativeFires(query, negative) {
  const qt = tokenise(query.text);
  const nt = tokenise(negative.text);
  if (nt.length === 0) return false;

  switch (negative.matchType) {
    case 'exact':
      return normalise(query.text) === normalise(negative.text);
    case 'phrase': {
      for (let start = 0; start + nt.length <= qt.length; start++) {
        let ok = true;
        for (let j = 0; j < nt.length; j++) {
          if (qt[start + j] !== nt[j]) { ok = false; break; }
        }
        if (ok) return true;
      }
      return false;
    }
    case 'broad': {
      const have = new Set(qt);
      return nt.every((token) => have.has(token));
    }
    default:
      throw new RangeError(`unknown negative matchType "${negative.matchType}"`);
  }
}

/**
 * Every ad group that catches this query, with the keyword that caught it.
 *
 * Within one ad group the most specific matching keyword is used, ties broken
 * on higher bid then on keyword id, so the result is deterministic (R1).
 *
 * @param {{text: string, tags?: string[]}} query
 * @param {Array<{id: string, keywords: object[]}>} adGroups
 * @returns {Array<{adGroupId: string, keyword: object, matchType: string}>}
 */
export function findMatches(query, adGroups) {
  const hits = [];
  for (const adGroup of adGroups ?? []) {
    let best = null;
    for (const keyword of adGroup.keywords ?? []) {
      if (keyword.active === false) continue;
      if (!matchesKeyword(query, keyword)) continue;
      if (best === null || compareKeywords(keyword, best) < 0) best = keyword;
    }
    if (best) hits.push({ adGroupId: adGroup.id, keyword: best, matchType: best.matchType });
  }
  return hits;
}

function compareKeywords(a, b) {
  const spec = MATCH_SPECIFICITY[b.matchType] - MATCH_SPECIFICITY[a.matchType];
  if (spec !== 0) return spec;
  if (a.bidPaise !== b.bidPaise) return b.bidPaise - a.bidPaise;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Is this advertiser eligible for this query? (spec 8.5)
 *
 * At least one active keyword matches and no negative blocks. Nothing here
 * knows about budget, ad rank or whether the advertiser went on to win — that
 * independence is what keeps the impression share denominator honest, and it
 * is what makes broadening a keyword lower impression share while raising
 * impressions.
 *
 * @param {{text: string, tags?: string[]}} query
 * @param {Array<{id: string, keywords: object[]}>} adGroups
 * @param {Array<{text: string, matchType: string}>} negatives
 * @returns {boolean}
 */
export function isEligible(query, adGroups, negatives) {
  if (isBlocked(query, negatives)) return false;
  return findMatches(query, adGroups).length > 0;
}

/**
 * Pick the one ad group that enters the auction (spec 8.6).
 *
 * One ad per advertiser per auction. The highest ad rank wins; ties break
 * toward the more specific match type, then on ad group id.
 *
 * The scorer is injected rather than imported because ad rank needs the
 * quality signal, which lives in quality.js — and a matching module that
 * reached for it would tangle two concerns that spec 8 keeps apart.
 *
 * @param {Array<{adGroupId: string, keyword: object, matchType: string}>} hits
 * @param {(hit: object) => number} computeAdRank
 * @returns {object|null}
 */
export function selectAdGroup(hits, computeAdRank) {
  if (!hits || hits.length === 0) return null;

  let best = null;
  let bestRank = -Infinity;
  for (const hit of hits) {
    const rank = computeAdRank(hit);
    if (best === null || rank > bestRank) {
      best = hit; bestRank = rank; continue;
    }
    if (rank === bestRank) {
      const spec = MATCH_SPECIFICITY[hit.matchType] - MATCH_SPECIFICITY[best.matchType];
      if (spec > 0 || (spec === 0 && hit.adGroupId < best.adGroupId)) best = hit;
    }
  }
  return best;
}

/**
 * How well this keyword fits this query, as a quality factor (spec 8.3).
 *
 * The same tag overlap that decides broad eligibility scales the 0.50–1.15
 * factor in the quality signal. One mechanism serving both is what makes
 * "broad match degrades quality as well as wasting spend" mechanical rather
 * than asserted (DECISIONS H5): a distant query lowers the factor, which
 * lowers ad rank, on that query.
 *
 * An untagged keyword returns a neutral 1.0. It cannot be measured, and 8.4
 * says it should still work on exact and phrase — scoring it at the floor
 * would cripple a keyword for not having been through the tagger yet.
 *
 * @param {{tags?: string[]}} query
 * @param {{tags?: string[]}} keyword
 * @returns {number} within QUALITY_FACTOR_RANGES.queryKeywordFit
 */
export function queryKeywordFit(query, keyword) {
  const kt = keyword.tags ?? [];
  if (kt.length === 0) return 1.0;
  const { min, max } = QUALITY_FACTOR_RANGES.queryKeywordFit;
  return lerp(tagOverlap(kt, query.tags), 0, min, 1, max);
}

/** Levenshtein distance, short-circuited at 1. */
function editDistanceWithin1(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let seen = false;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i += 1; j += 1; continue; }
    if (seen) return false;
    seen = true;
    if (a.length === b.length) { i += 1; j += 1; }
    else if (a.length > b.length) i += 1;
    else j += 1;
  }
  return true;
}
