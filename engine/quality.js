/**
 * Quality (spec 9). The split this whole simulation's honesty rests on.
 *
 * Google says plainly that Quality Score is not an input to the ad auction; it
 * is a diagnostic. What enters the auction are real-time quality signals
 * computed per individual query, from context the report never shows. v0.1
 * multiplied one 1-10 number into ad rank, which is the single most common
 * misunderstanding in paid search, and building it into a teaching tool would
 * have taught it.
 *
 * So there are two things here and they must never converge:
 *
 *   qualitySignal   continuous, per query, per hour, computed fresh every
 *                   auction. In the auction. Never shown as a number.
 *
 *   reportedScore   1-10, lagging thirteen rounds, computed only from
 *                   completed prior rounds and only from searches that
 *                   literally were the keyword. Output only. NO ENGINE
 *                   MODULE MAY READ IT, and a structural test enforces that.
 *
 * The line to hold onto: quality IS in the auction; the number on your screen
 * is not that number.
 *
 * The test that proves the split: improving ad copy must move qualitySignal
 * immediately and leave reportedScore untouched in the same round. If both
 * move, the split is broken.
 */

import {
  QUALITY_FACTOR_RANGES, QUALITY_WINDOW_ROUNDS, QUALITY_MIN_IMPRESSIONS,
  DEFAULT_UNGRADED_QUALITY, RATING_UPPER_THRESHOLD, RATING_LOWER_THRESHOLD,
  RATING_TO_SCORE_TABLE, RELEVANCE_INTENT_MULTIPLIERS, CONTEXT_FACTOR_CURVE,
  QUALITY_NOISE_SIGMA,
} from './constants.js';
import { clamp, lerp } from './num.js';
import { normal } from './rng.js';
import { queryKeywordFit, normalise } from './matching.js';

const COMPONENTS = ['expectedCtr', 'adRelevance', 'landingPage'];

/**
 * Expected click-through at the top slot, from the graded expected-CTR score.
 *
 * @param {number} score 1-10
 * @returns {number}
 */
export function baseCtr(score) {
  const { min, max } = QUALITY_FACTOR_RANGES.baseCtr;
  return lerp(clamp(score, 1, 10), 1, min, 10, max);
}

/**
 * How relevant this ad is to this searcher.
 *
 * Intent shifts the effective grade rather than scaling the output, so the
 * result cannot leave its stated range. The same ad is genuinely less relevant
 * to someone reading about laundry than to someone shopping.
 *
 * @param {number} score graded adRelevance, 1-10
 * @param {string} intent commercial | brand | informational | irrelevant
 * @returns {number}
 */
export function relevanceFactor(score, intent) {
  const { min, max } = QUALITY_FACTOR_RANGES.relevanceFactor;
  const multiplier = RELEVANCE_INTENT_MULTIPLIERS[intent] ?? 1.0;
  const effective = clamp(clamp(score, 1, 10) * multiplier, 1, 10);
  return lerp(effective, 1, min, 10, max);
}

/**
 * @param {number} score graded landingPage, 1-10
 * @returns {number}
 */
export function landingFactor(score) {
  const { min, max } = QUALITY_FACTOR_RANGES.landingFactor;
  return lerp(clamp(score, 1, 10), 1, min, 10, max);
}

/**
 * @param {number} hour 0-23
 * @returns {number}
 */
export function contextFactor(hour) {
  const v = CONTEXT_FACTOR_CURVE[hour];
  if (v === undefined) throw new RangeError(`hour must be 0..23, got ${String(hour)}`);
  return v;
}

/**
 * The auction input (spec 9.1).
 *
 * Roughly a predicted click probability. Deterministic in expected mode;
 * blurred by seeded lognormal noise in sampled mode.
 *
 * The returned `components` are the FACTOR values, not the 1-10 graded inputs.
 * Spec 9.1's example showed a landingPage component of 0.55 against a
 * landingFactor spanning 0.85-1.05, which could not both be true. The factors
 * are what 9.3 compares against the field, so the factors are what is stored.
 *
 * queryKeywordFit and contextFactor are terms in the signal but not reported
 * components: Google's three reported dimensions do not include how well your
 * keyword matched, which is a separate thing.
 *
 * @param {object|null} gradedQuality null when the ad has never been graded
 * @param {{text?: string, tags?: string[], intent: string}} query `text` is
 *   present when the caller asks about a hypothetical search rather than one
 *   from the set — ui/decisions.js does, to price a keyword on its own words.
 * @param {{text: string, matchType: string, tags?: string[]}} keyword
 * @param {number} hour 0-23
 * @param {(() => number)|null} rng required in sampled mode
 * @param {'expected'|'sampled'} mode
 * @returns {{signal: number, components: object, ungraded: boolean}}
 */
export function qualitySignal(gradedQuality, query, keyword, hour, rng, mode) {
  if (mode !== 'expected' && mode !== 'sampled') {
    throw new RangeError(`mode must be "expected" or "sampled", got "${mode}"`);
  }
  const { base, components, ungraded } = qualitySignalBase(gradedQuality, query, keyword);
  return { signal: applyHourAndNoise(base, hour, rng, mode), components, ungraded };
}

/**
 * The part of the signal that does not depend on the hour.
 *
 * Split out so `round.js` can compute it once per advertiser-query instead of
 * once per auction. Nothing here varies across the 168 hours of a round, and
 * recomputing it 226,800 times would put a round well outside its performance
 * budget for no gain.
 *
 * @param {object|null} gradedQuality
 * @param {{text?: string, tags?: string[], intent: string}} query `text` is
 *   present when the caller asks about a hypothetical search rather than one
 *   from the set — ui/decisions.js does, to price a keyword on its own words.
 * @param {{text: string, matchType: string, tags?: string[]}} keyword
 * @returns {{base: number, components: object, ungraded: boolean}}
 */
export function qualitySignalBase(gradedQuality, query, keyword) {
  const ungraded = gradedQuality == null;
  const grade = ungraded ? DEFAULT_UNGRADED_QUALITY : gradedQuality;

  const components = {
    expectedCtr: baseCtr(grade.expectedCtr),
    adRelevance: relevanceFactor(grade.adRelevance, query.intent),
    landingPage: landingFactor(grade.landingPage),
  };

  const base = components.expectedCtr
    * queryKeywordFit(query, keyword)
    * components.adRelevance
    * components.landingPage;

  return { base, components, ungraded };
}

/**
 * Finish a precomputed base signal for one particular auction.
 *
 * @param {number} base from qualitySignalBase
 * @param {number} hour 0-23
 * @param {(() => number)|null} rng required in sampled mode
 * @param {'expected'|'sampled'} mode
 * @returns {number}
 */
export function applyHourAndNoise(base, hour, rng, mode) {
  const signal = base * contextFactor(hour);
  if (mode !== 'sampled') return signal;
  if (typeof rng !== 'function') {
    throw new TypeError('sampled mode needs an rng: the engine never reaches for one (R1)');
  }
  // Lognormal, shifted so the mean is exactly 1. Noise must blur the signal
  // without quietly inflating it.
  const s = QUALITY_NOISE_SIGMA;
  return signal * Math.exp(normal(rng) * s - (s * s) / 2);
}

/**
 * Does this impression count toward the reported score? (spec 9.3, A4)
 *
 * Only when the search was literally the keyword, after normalising case and
 * spacing. Not a plural, not a reordering, not a broader phrase — Google
 * calculates from exact searches OF your keyword, and a plural is a different
 * search even though exact match would have served an ad for it.
 *
 * This is what makes "changing match type alone does not move Quality Score"
 * true: the filter runs on the text, and the match type never enters it.
 *
 * @param {{text: string}} query
 * @param {{text: string}} keyword
 * @returns {boolean}
 */
export function countsTowardReportedScore(query, keyword) {
  return normalise(query.text) === normalise(keyword.text);
}

/**
 * The diagnostic (spec 9.3). Output only.
 *
 * Computed from the trailing window of COMPLETED prior rounds — the current
 * round is excluded. That exclusion is what makes the CLAUDE.md trap hold:
 * nothing the player does this round can move this number, which is exactly
 * the lag that makes Quality Score so confusing in a real account.
 *
 * Each component compares this keyword's impression-weighted mean against the
 * field's. A strong ad in a stronger field reads as below average, and that
 * relativity is the whole point.
 *
 * @param {{qualityHistory?: object}} advertiser
 * @param {string} keywordId
 * @param {number} currentRound
 * @returns {null | {score: number, expectedCtr: string, adRelevance: string, landingPage: string}}
 */
export function reportedScore(advertiser, keywordId, currentRound) {
  const rows = (advertiser.qualityHistory ?? {})[keywordId] ?? [];
  const from = currentRound - QUALITY_WINDOW_ROUNDS;
  const window = rows.filter((r) => r.round >= from && r.round < currentRound);

  let impressions = 0;
  for (const r of window) impressions += r.impressions;
  if (impressions < QUALITY_MIN_IMPRESSIONS) return null;

  /** @type {Record<string, string>} */
  const ratings = {};
  for (const component of COMPONENTS) {
    let own = 0;
    let field = 0;
    for (const r of window) {
      own += r.impressions * r.ownComponents[component];
      field += r.impressions * r.fieldComponents[component];
    }
    ratings[component] = rate(own, field);
  }

  const key = `${ratings.expectedCtr}|${ratings.adRelevance}|${ratings.landingPage}`;
  // The loop above fills exactly the three COMPONENTS, which a spread cannot say.
  const scored = { score: RATING_TO_SCORE_TABLE[key], ...ratings };
  return /** @type {{score: number, expectedCtr: string, adRelevance: string, landingPage: string}} */ (scored);
}

/**
 * Above, average or below — on the ratio of two impression-weighted totals.
 *
 * A field total of zero means there was nobody to compare against, which reads
 * as average rather than as infinitely good.
 */
function rate(ownTotal, fieldTotal) {
  if (fieldTotal === 0) return 'average';
  const ratio = ownTotal / fieldTotal;
  if (ratio > RATING_UPPER_THRESHOLD) return 'above';
  if (ratio < RATING_LOWER_THRESHOLD) return 'below';
  return 'average';
}
