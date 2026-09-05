/**
 * The ad copy grader (spec 9.5, 8.7, 17 step 12).
 *
 * Turns written copy into the three graded numbers the auction reads:
 * `expectedCtr`, `adRelevance` and `landingPage`, each 1-10. Everything
 * downstream of `qualitySignal` depends on these, so this is the point where a
 * human's writing becomes an economic input.
 *
 * WHY THE MODEL CALL IS INJECTED RATHER THAN IMPORTED
 *
 * R2 says Claude lives outside the engine and that the full test suite passes
 * with no network. This module holds the JUDGEMENT - what to ask, how to read
 * the answer, and which rules the answer is not allowed to break - and takes
 * the transport as an argument. `agents/claude.js` supplies the real one; a
 * test supplies a stub; omitting it falls back to the offline heuristic. So the
 * grading logic is fully testable and nothing here can reach the network.
 *
 * THE RULES ARE APPLIED AFTER THE MODEL, NOT ASKED OF IT
 *
 * Spec 8.7 requires `adRelevance` to be penalised when a rival's trademark
 * appears in the ad text. That is a rule the simulation depends on, not a
 * matter of taste, so it is enforced in code over whatever grade comes back. A
 * model that forgot the instruction, or was never given it, cannot produce an
 * ad that quietly escapes the penalty. The same goes for the character limits
 * and the 1-10 clamp.
 *
 * WHAT THE OFFLINE HEURISTIC IS FOR
 *
 * It is not a substitute for the model and does not pretend to be. It exists so
 * that the game runs, the suite stays offline, and round 0 can complete without
 * an API key - because DECISIONS A8 showed the alternative: an ungraded ad
 * grades 3/3/3, which sits below AD_RANK_FLOOR at any sane bid, so a player who
 * cannot reach a grader cannot enter an auction at all. It grades on things
 * that are actually observable in the text and is deliberately narrow-banded.
 */

import { contentHash } from './hash.js';
import { HEADLINE_MAX_CHARS, DESCRIPTION_MAX_CHARS } from '../engine/constants.js';

/** How far a rival's trademark in the ad text pulls `adRelevance` down (8.7). */
const TRADEMARK_PENALTY = 4;

/** The ceiling an ad that does not fit Google's limits can reach. */
const OVERLONG_CEILING = 4;

/** What the heuristic returns before evidence moves it. Mid-scale, not good. */
const HEURISTIC_BASE = 5;

const GRADE_COMPONENTS = ['expectedCtr', 'adRelevance', 'landingPage'];

// ---------------------------------------------------------------------------
// Identity and validation
// ---------------------------------------------------------------------------

/**
 * A stable hash of the copy, so an unchanged ad is never regraded (spec 5.2).
 *
 * Covers exactly the text a grade depends on. The landing page description is
 * in it because `landingPage` is graded from it; nothing else is, so editing a
 * bid or a keyword does not invalidate a grade.
 *
 * @param {{headlines: string[], descriptions: string[], landingPageDescription?: string}} ad
 * @returns {string} e.g. "sha1:1f0a..."
 */
export function contentHashOf(ad) {
  const canonical = JSON.stringify({
    headlines: [...(ad?.headlines ?? [])],
    descriptions: [...(ad?.descriptions ?? [])],
    landingPageDescription: ad?.landingPageDescription ?? '',
  });
  return contentHash(canonical);
}

/**
 * Does this copy fit what Google actually allows? (spec 18.1)
 *
 * The first code in the project to read HEADLINE_MAX_CHARS and
 * DESCRIPTION_MAX_CHARS outside a test. Both have been DOCUMENTED constants
 * with no reader since step 1.
 *
 * @param {object} ad
 * @returns {{valid: boolean, violations: string[]}}
 */
export function validateAdCopy(ad) {
  const violations = [];
  for (const headline of ad?.headlines ?? []) {
    if (headline.length > HEADLINE_MAX_CHARS) {
      violations.push(`headline over ${HEADLINE_MAX_CHARS} chars: "${headline}"`);
    }
  }
  for (const description of ad?.descriptions ?? []) {
    if (description.length > DESCRIPTION_MAX_CHARS) {
      violations.push(`description over ${DESCRIPTION_MAX_CHARS} chars: "${description}"`);
    }
  }
  if ((ad?.headlines ?? []).length === 0) violations.push('no headlines');
  if ((ad?.descriptions ?? []).length === 0) violations.push('no descriptions');
  return { valid: violations.length === 0, violations };
}

/** Every word in the ad, lowercased, for the checks below. */
function adText(ad) {
  return [...(ad?.headlines ?? []), ...(ad?.descriptions ?? [])].join(' ').toLowerCase();
}

/**
 * Does the copy name a rival? (spec 8.7)
 *
 * Matched on the distinctive first token of the name rather than the whole
 * string, for the same reason `brandDefender` does: the roster holds
 * "Vella & Co." and nobody writes that out.
 *
 * @param {object} ad
 * @param {string[]} rivalNames
 * @returns {string|null} the name found, or null
 */
export function namesARival(ad, rivalNames = []) {
  const words = new Set(adText(ad).split(/[^a-z0-9]+/));
  for (const name of rivalNames) {
    const token = String(name).toLowerCase().match(/[a-z0-9]+/)?.[0];
    if (token && words.has(token)) return name;
  }
  return null;
}

// ---------------------------------------------------------------------------
// The rules, applied over any grade
// ---------------------------------------------------------------------------

/**
 * Enforce what the simulation depends on, whatever produced the grade.
 *
 * A model asked to penalise trademarks might forget, might be given a prompt
 * that omits the instruction, or might be swapped for a different one. Spec 8.7
 * is not a preference, so it is applied here rather than requested there.
 *
 * @param {object} grade the raw three components
 * @param {object} ad
 * @param {{rivalNames?: string[]}} context
 * @returns {{grade: object, notes: string[]}}
 */
export function applyGradingRules(grade, ad, context = {}) {
  const notes = [];
  const out = {};
  for (const component of GRADE_COMPONENTS) {
    out[component] = clampGrade(grade?.[component]);
  }

  const rival = namesARival(ad, context.rivalNames ?? []);
  if (rival) {
    // A penalty, never a block (8.7). Bidding on a competitor's brand as a
    // keyword is permitted; naming them in your ad text is not, and ad
    // disapproval is out of scope (section 19).
    out.adRelevance = clampGrade(out.adRelevance - TRADEMARK_PENALTY);
    notes.push(`names a rival ("${rival}"): adRelevance penalised by ${TRADEMARK_PENALTY}`);
  }

  const { valid, violations } = validateAdCopy(ad);
  if (!valid) {
    for (const component of GRADE_COMPONENTS) {
      out[component] = Math.min(out[component], OVERLONG_CEILING);
    }
    notes.push(`does not fit Google's limits, capped at ${OVERLONG_CEILING}: ${violations[0]}`);
  }

  return { grade: out, notes };
}

/** 1-10, integer, and never NaN however odd the input. */
function clampGrade(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return HEURISTIC_BASE;
  return Math.max(1, Math.min(10, n));
}

// ---------------------------------------------------------------------------
// The offline heuristic
// ---------------------------------------------------------------------------

/**
 * A deterministic grade from what is observable in the text.
 *
 * Narrow-banded on purpose - it moves between about 3 and 7 and will not award
 * a 9. It is a floor that keeps the game playable without an API key, not an
 * opinion about writing. Anything that wants a real judgement passes a model.
 *
 * @param {object} ad
 * @param {{keywords?: object[], queryTexts?: string[]}} context
 * @returns {object} the three components
 */
/**
 * The rules `heuristicGrade` scores, written down once so they can be both
 * SCORED and EXPLAINED from the same pass.
 *
 * They were inline arithmetic, which made the grade unexplainable: a player
 * wrote an ad, got a number, and had no way to tell what moved it. Every one of
 * these is ordinary search-advertising practice rather than a quirk of this
 * implementation, which is why showing them teaches something instead of
 * teaching the rubric.
 */
const CTR_RULES = Object.freeze([
  {
    points: 1,
    hit: ({ headlines }) => headlines.length >= 3,
    whenHit: 'three headlines, so there is something to rotate',
    whenMissed: 'fewer than three headlines — unused space that costs nothing to fill',
  },
  {
    points: 1,
    hit: ({ text }) => /\d/.test(text),
    whenHit: 'a number in the copy, which gives a reason to click',
    whenMissed: 'no number anywhere — a price, a size range or a count earns clicks',
  },
  {
    points: 1,
    hit: ({ text }) => /free|save|off|from ₹|buy|shop|order/.test(text),
    whenHit: 'it asks for the click',
    whenMissed: 'nothing asks them to act — no offer, no "shop", no "buy"',
  },
  {
    points: -2,
    hit: ({ headlines }) => new Set(headlines.map((h) => h.toLowerCase())).size < headlines.length,
    whenHit: 'two headlines are the same, which wastes one of them',
    whenMissed: null,
  },
  {
    points: -1,
    hit: ({ headlines }) => headlines.some((h) => h.length < 8),
    whenHit: 'a headline under eight characters is space you paid for and did not use',
    whenMissed: null,
  },
]);

const LANDING_RULES = Object.freeze([
  {
    points: 1,
    hit: ({ page }) => page.length > 40,
    whenHit: 'you have actually described the page',
    whenMissed: 'the description is too short to tell anyone what is on the page',
  },
  {
    points: 1,
    hit: ({ page }) => /size|fit|guide|chart/.test(page),
    whenHit: 'it mentions sizing, which is what apparel buyers leave over',
    whenMissed: 'no mention of size or fit — the main reason apparel visitors bounce',
  },
  {
    points: 1,
    hit: ({ page }) => /review|rating/.test(page),
    whenHit: 'it mentions reviews',
    whenMissed: 'no reviews or ratings on the page',
  },
  {
    points: -2,
    hit: ({ page }) => page.length < 15,
    whenHit: 'there is barely a description at all',
    whenMissed: null,
  },
]);

/** The words a grader compares an ad against: its own keywords. */
function relevanceCoverage(ad, context) {
  const target = new Set(
    [...(context.keywords ?? []).map((k) => k.text), ...(context.queryTexts ?? [])]
      .join(' ').toLowerCase().split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3),
  );
  const words = new Set(adText(ad).split(/[^a-z0-9]+/).filter((w) => w.length > 3));
  const shared = [...target].filter((w) => words.has(w));
  return { target, shared, coverage: target.size > 0 ? shared.length / target.size : 0 };
}

function gradeInputs(ad, context) {
  return {
    headlines: ad?.headlines ?? [],
    text: adText(ad),
    page: (ad?.landingPageDescription ?? '').toLowerCase(),
    relevance: relevanceCoverage(ad, context),
  };
}

const scoreRules = (rules, inputs) => rules
  .reduce((total, rule) => total + (rule.hit(inputs) ? rule.points : 0), HEURISTIC_BASE);

export function heuristicGrade(ad, context = {}) {
  const inputs = gradeInputs(ad, context);
  return {
    expectedCtr: clampGrade(scoreRules(CTR_RULES, inputs)),
    // The one component with an objective referent, so it leans on it: does the
    // copy say what the keywords say?
    adRelevance: clampGrade(HEURISTIC_BASE + Math.round(inputs.relevance.coverage * 8) - 2),
    // Graded from the advertiser's own description, which is all anybody has
    // until there is a page to look at (DECISIONS C2).
    landingPage: clampGrade(scoreRules(LANDING_RULES, inputs)),
  };
}

/**
 * The grade, and why it is what it is.
 *
 * Same pass as `heuristicGrade` — the checks are scored and explained from one
 * list, so the advice on screen cannot drift from the number beside it. That
 * drift is the whole reason this exists rather than a second rubric in `ui/`.
 *
 * @param {object} ad
 * @param {object} [context] `keywords` is what adRelevance is measured against
 * @returns {{grade: object, notes: string[], checks: object[]}}
 */
export function explainGrade(ad, context = {}) {
  const inputs = gradeInputs(ad, context);
  const { grade, notes } = applyGradingRules(heuristicGrade(ad, context), ad, context);
  const checks = [];

  const walk = (component, rules) => {
    for (const rule of rules) {
      const hit = rule.hit(inputs);
      const text = hit ? rule.whenHit : rule.whenMissed;
      if (text) checks.push({ component, ok: rule.points > 0 ? hit : !hit, text });
    }
  };
  walk('expectedCtr', CTR_RULES);

  const { target, shared } = inputs.relevance;
  checks.push({
    component: 'adRelevance',
    ok: inputs.relevance.coverage >= 0.5,
    text: target.size === 0
      ? 'no keywords yet, so there is nothing to be relevant TO — pick them first'
      : `your ad uses ${shared.length} of the ${target.size} distinctive words in your `
        + 'keywords. An ad that echoes the search wins the click and the rating',
  });

  walk('landingPage', LANDING_RULES);
  return { grade, notes, checks };
}

// ---------------------------------------------------------------------------
// The model path
// ---------------------------------------------------------------------------

/** The one tool the grader offers, so the reply is schema-valid by construction. */
export const GRADE_TOOL = Object.freeze({
  name: 'grade_ad',
  description: 'Record the three quality grades for one search ad.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      expectedCtr: {
        type: 'integer', minimum: 1, maximum: 10,
        description: 'How likely a searcher is to click this ad rather than another. '
          + 'Specific, concrete, benefit-led copy scores high; vague or generic copy scores low.',
      },
      adRelevance: {
        type: 'integer', minimum: 1, maximum: 10,
        description: 'How closely the ad matches what the advertiser bid on. '
          + 'Judge against the keywords given, not against the advertiser.',
      },
      landingPage: {
        type: 'integer', minimum: 1, maximum: 10,
        description: 'How well the described landing page serves someone arriving from this ad.',
      },
      reasoning: {
        type: 'string',
        description: 'One sentence per grade, for the advertiser to read.',
      },
    },
    required: ['expectedCtr', 'adRelevance', 'landingPage', 'reasoning'],
  },
});

/**
 * The request to send. Exported so a test can inspect what would be asked
 * without a network, and so the prompt is reviewable as data.
 *
 * The ad's OWN keywords are supplied, because relevance has no meaning without
 * them. Nothing about the advertiser's position, economics or the query set's
 * affinities is: a grader that knew a brand was premium would grade the brand
 * rather than the writing (DECISIONS C2), and the affinities are withheld from
 * everyone (C4).
 *
 * @param {object} ad
 * @param {object} context
 * @returns {object} messages-API request parameters
 */
export function buildGradingRequest(ad, context = {}) {
  const keywords = (context.keywords ?? []).map((k) => k.text);
  return {
    model: 'claude-opus-5',
    max_tokens: 4096,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'low' },
    tools: [GRADE_TOOL],
    system:
      'You grade search ad copy the way Google Ads does, on three separate '
      + 'dimensions, each 1-10. Grade the WRITING, not the business: you are not '
      + 'told what the brand sells or what it charges, and you should not guess. '
      + '6 is an ordinary, competent ad. Reserve 9 and 10 for copy that is '
      + 'genuinely specific and compelling, and 1 to 3 for copy that is empty, '
      + 'repetitive or off-topic. Call the grade_ad tool exactly once.',
    messages: [{
      role: 'user',
      content: [{
        type: 'text',
        text: [
          'Keywords this ad is serving:',
          keywords.length ? keywords.map((k) => `  - ${k}`).join('\n') : '  (none given)',
          '',
          'Headlines:',
          ...(ad?.headlines ?? []).map((h) => `  - ${h}`),
          '',
          'Descriptions:',
          ...(ad?.descriptions ?? []).map((d) => `  - ${d}`),
          '',
          'The advertiser describes their landing page as:',
          `  ${ad?.landingPageDescription || '(not described)'}`,
        ].join('\n'),
      }],
    }],
  };
}

/**
 * Pull the grade out of a response, or null if the model did not call the tool.
 *
 * Null rather than a throw: a grader that fails should fall back to the
 * heuristic and let the game continue, not take the round down with it.
 *
 * @param {object} response a Messages API response
 * @returns {object|null}
 */
export function parseGradingResponse(response) {
  const block = (response?.content ?? []).find(
    (b) => b.type === 'tool_use' && b.name === GRADE_TOOL.name,
  );
  if (!block?.input) return null;
  const { expectedCtr, adRelevance, landingPage, reasoning } = block.input;
  if ([expectedCtr, adRelevance, landingPage].some((v) => !Number.isFinite(Number(v)))) {
    return null;
  }
  return { expectedCtr, adRelevance, landingPage, reasoning: reasoning ?? '' };
}

// ---------------------------------------------------------------------------
// The entry point
// ---------------------------------------------------------------------------

/**
 * Grade an ad without a model, synchronously.
 *
 * Round 0 needs a graded player before round 1 begins (spec 17 step 12), and it
 * needs it whether or not anybody has an API key. This is the path that
 * guarantees a player never enters the game on DEFAULT_UNGRADED_QUALITY, which
 * DECISIONS A8 showed puts them below the reserve and out of every auction.
 *
 * @param {object} ad
 * @param {object} [context]
 * @param {number} [round]
 * @returns {object} a gradedQuality
 */
export function gradeAdOffline(ad, context = {}, round = 0) {
  const { grade, notes } = applyGradingRules(heuristicGrade(ad, context), ad, context);
  return {
    ...grade,
    gradedAtRound: round,
    contentHash: contentHashOf(ad),
    source: 'heuristic',
    notes,
  };
}

/**
 * Grade one ad, cheaply if it has been graded before.
 *
 * @param {object} args
 * @param {object} args.ad the copy
 * @param {object} [args.context] keywords, queryTexts, rivalNames
 * @param {number} [args.round] stamped onto the grade
 * @param {Function} [args.callModel] async (request) => response. Omit to stay offline.
 * @param {object} [args.previous] an existing gradedQuality, for the cache check
 * @returns {Promise<object>} a gradedQuality, ready for adGroup.gradedQuality
 */
export async function gradeAd({ ad, context = {}, round = 0, callModel, previous }) {
  const contentHash = contentHashOf(ad);

  // Spec 5.2: regrade only when the content hash changes.
  if (previous && previous.contentHash === contentHash) return previous;

  let raw = null;
  let source = 'heuristic';
  if (typeof callModel === 'function') {
    try {
      raw = parseGradingResponse(await callModel(buildGradingRequest(ad, context)));
      if (raw) source = 'model';
    } catch {
      // A grader that cannot reach a model grades it anyway. Losing a round to
      // a network error would be a worse failure than a cruder grade.
      raw = null;
    }
  }
  if (!raw) raw = heuristicGrade(ad, context);

  const { grade, notes } = applyGradingRules(raw, ad, context);
  return {
    ...grade,
    gradedAtRound: round,
    contentHash,
    source,
    notes: raw.reasoning ? [raw.reasoning, ...notes] : notes,
  };
}
