/**
 * The keyword tagger (spec 8.4, 8.1, 8.3).
 *
 * Broad match is the only match type that needs semantics. Exact and phrase are
 * string operations; broad is a tag overlap. So a keyword nobody has tagged
 * matches nothing on broad — it degrades safely and invents no data (8.4) — but
 * it also means the player chose a match type that does nothing until this runs.
 *
 * Same shape as `grader.js`: the judgement lives here, the transport is
 * injected, and the rules the simulation depends on are enforced over whatever
 * comes back rather than requested of it.
 *
 * TAGGING DOES TWO THINGS, AND THE SECOND IS EASY TO MISS
 *
 * It makes broad match possible, and it moves `queryKeywordFit` (8.3) — the
 * same overlap ratio produces the 0.50–1.15 quality factor. An UNTAGGED keyword
 * scores a flat 1.0. A well-tagged one scores 1.15 on its own query and less
 * than 1.0 on a loose one. So tagging is not free: it rewards a keyword that
 * matches what it says and penalises one that wandered.
 *
 * WHY THE TAG COUNT IS CAPPED, AND WHY AT SIX
 *
 * `tagOverlap` divides by the KEYWORD's tag count, so the number of tags a
 * keyword carries decides how far it travels. Broad match fires at 0.50, so a
 * keyword with n tags needs a query carrying ceil(n/2) of them. Measured
 * against the real query set, where queries carry two to four tags each:
 *
 *   n = 3..4   needs 2 shared   150 of 151 queries could supply that
 *   n = 5..6   needs 3 shared   106 of 151
 *   n = 7..8   needs 4 shared    11 of 151
 *
 * There is a cliff between six and seven. Past it a broad keyword is inert in
 * practice while looking perfectly well-formed, which is the same shape of
 * failure as the ungraded ad in DECISIONS A8: a degradation that is not safe
 * because nothing tells you it happened. So a tagger that over-tags is
 * corrected here rather than trusted.
 *
 * That the tag COUNT controls reach at all is a real consequence worth knowing:
 * a specific keyword broad-matches narrowly and a generic one broadly, which is
 * how the real thing behaves, but it means how far "broad" reaches is decided
 * by the tagger rather than by the advertiser who chose it.
 */

import { createHash } from 'node:crypto';
import { TAG_VOCABULARY, BROAD_MATCH_MIN_OVERLAP } from '../engine/constants.js';

/**
 * The most tags a keyword may carry. See the header: past six, a query must
 * share four, and almost no query has four to share.
 */
export const MAX_KEYWORD_TAGS = 6;

const VOCABULARY = new Set(TAG_VOCABULARY);

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/**
 * A stable hash of what the tags depend on, which is the text and nothing else
 * (spec 5.2: `taggedContentHash`, null until tagged).
 *
 * Deliberately excludes the match type and the bid. Switching a keyword from
 * phrase to broad does not change what it means, so it must not force a
 * retag — and a player who edits a bid should not pay for a model call.
 *
 * @param {{text: string}} keyword
 * @returns {string}
 */
export function tagContentHashOf(keyword) {
  const canonical = String(keyword?.text ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  return `sha1:${createHash('sha1').update(canonical).digest('hex')}`;
}

// ---------------------------------------------------------------------------
// The rule: only the vocabulary exists
// ---------------------------------------------------------------------------

/**
 * Drop anything that is not a real tag, deduplicate, and cap.
 *
 * THE VOCABULARY RULE IS THE LOAD-BEARING ONE. A tag outside `TAG_VOCABULARY`
 * can never appear on a query, so it can never contribute to an overlap — it
 * quietly makes the keyword harder to match while looking like it helps. A
 * model inventing a plausible tag ("activewear", "womens-gym") would produce a
 * keyword that broad-matches strictly less than an untagged one, and nothing
 * anywhere would report it.
 *
 * Kept in vocabulary order rather than the order they arrived, which is not
 * cosmetic: `TAG_VOCABULARY` is authored product, attribute, use, audience,
 * price, intent — so trimming to the cap keeps what the keyword IS and drops
 * the incidentals.
 *
 * @param {string[]} tags
 * @returns {{tags: string[], rejected: string[]}}
 */
export function enforceVocabulary(tags) {
  const seen = new Set();
  const rejected = [];
  for (const raw of tags ?? []) {
    const tag = String(raw).trim().toLowerCase();
    if (!VOCABULARY.has(tag)) {
      if (tag) rejected.push(tag);
      continue;
    }
    seen.add(tag);
  }
  return {
    tags: TAG_VOCABULARY.filter((t) => seen.has(t)).slice(0, MAX_KEYWORD_TAGS),
    rejected,
  };
}

/** How many of a keyword's tags a query must share for broad match to fire. */
export function sharedTagsNeeded(tagCount) {
  return Math.ceil(tagCount * BROAD_MATCH_MIN_OVERLAP);
}

// ---------------------------------------------------------------------------
// The offline path
// ---------------------------------------------------------------------------

/** The written forms a tag might appear as: "sports-bra" -> "sports bra", "sportsbra". */
function surfaceForms(tag) {
  const spaced = tag.replace(/-/g, ' ');
  const forms = new Set([tag, spaced, spaced.replace(/\s+/g, '')]);
  for (const form of [...forms]) {
    forms.add(form.endsWith('s') ? form.slice(0, -1) : `${form}s`);
  }
  return [...forms];
}

const FORMS = TAG_VOCABULARY.map((tag) => ({ tag, forms: surfaceForms(tag) }));

/**
 * Tag a keyword from its own words, with no model.
 *
 * Purely lexical: it finds vocabulary terms the keyword actually contains. It
 * will miss anything implied rather than written — the query set tags
 * "cheap gym leggings" with `women` because the whole vertical is women's
 * athleisure, and no amount of reading that string will produce it.
 *
 * That miss costs less than it looks. `tagOverlap` divides by the KEYWORD's tag
 * count, so a keyword tagged with three terms the query also carries scores a
 * perfect 1.0 even though the query carries a fourth. Being conservative is
 * cheap here; inventing is not.
 *
 * @param {string} text
 * @returns {string[]} tags, in vocabulary order
 */
export function heuristicTags(text) {
  const haystack = ` ${String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
  const found = FORMS
    .filter(({ forms }) => forms.some((form) => haystack.includes(` ${form} `)))
    .map(({ tag }) => tag);
  return enforceVocabulary(found).tags;
}

/**
 * Tag one keyword offline, synchronously — the path round 0 uses.
 *
 * @param {{text: string}} keyword
 * @returns {{tags: string[], taggedContentHash: string, source: string}}
 */
export function tagKeywordOffline(keyword) {
  return {
    tags: heuristicTags(keyword.text),
    taggedContentHash: tagContentHashOf(keyword),
    source: 'heuristic',
  };
}

// ---------------------------------------------------------------------------
// The model path
// ---------------------------------------------------------------------------

/** One tool, with the vocabulary as an enum so the reply is valid by construction. */
export const TAG_TOOL = Object.freeze({
  name: 'tag_keyword',
  description: 'Record the tags that describe one search keyword.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      tags: {
        type: 'array',
        minItems: 1,
        maxItems: MAX_KEYWORD_TAGS,
        items: { type: 'string', enum: [...TAG_VOCABULARY] },
        description: 'The tags that describe what this keyword is about. '
          + 'Choose the fewest that capture it: what the product IS first, then '
          + 'its defining attribute, then what it is for.',
      },
    },
    required: ['tags'],
  },
});

/**
 * The request to send. Exported so the prompt is reviewable as data and a test
 * can check what would be asked without a network.
 *
 * It is given the keyword and the vocabulary, and nothing else. Not the query
 * set, not the advertiser's position, not what converts — a tagger that knew
 * which queries were valuable would be choosing the player's traffic for them,
 * and the affinities are withheld from everyone anyway (DECISIONS C4).
 *
 * @param {{text: string}} keyword
 * @returns {object} messages-API request parameters
 */
export function buildTaggingRequest(keyword) {
  return {
    model: 'claude-opus-5',
    max_tokens: 2048,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'low' },
    tools: [TAG_TOOL],
    system:
      'You tag search keywords for an athleisure retailer, using a fixed '
      + 'vocabulary and nothing else. Tags describe what the keyword is about: '
      + 'the product, its attributes, what it is used for, who it is for, and any '
      + 'price or intent signal in the words themselves.\n\n'
      + 'Use as FEW tags as capture the keyword honestly. Tags are how loosely '
      + 'this keyword will match other searches, and every extra tag makes it '
      + 'stricter, not broader. Do not add a tag for something the keyword only '
      + 'implies. Call the tag_keyword tool exactly once.\n\n'
      + `Vocabulary: ${TAG_VOCABULARY.join(', ')}`,
    messages: [{
      role: 'user',
      content: [{ type: 'text', text: `Keyword: ${keyword.text}` }],
    }],
  };
}

/**
 * Pull the tags out of a response, or null if the model did not call the tool.
 *
 * @param {object} response
 * @returns {string[]|null}
 */
export function parseTaggingResponse(response) {
  const block = (response?.content ?? []).find(
    (b) => b.type === 'tool_use' && b.name === TAG_TOOL.name,
  );
  if (!Array.isArray(block?.input?.tags)) return null;
  return block.input.tags;
}

// ---------------------------------------------------------------------------
// The entry point
// ---------------------------------------------------------------------------

/**
 * Tag one keyword, cheaply if its text has not changed.
 *
 * @param {object} args
 * @param {{text: string, tags?: string[], taggedContentHash?: string}} args.keyword
 * @param {Function} [args.callModel] async (request) => response. Omit to stay offline.
 * @returns {Promise<{tags: string[], taggedContentHash: string, source: string, rejected?: string[]}>}
 */
export async function tagKeyword({ keyword, callModel }) {
  const taggedContentHash = tagContentHashOf(keyword);

  // Spec 8.4: cached on taggedContentHash. Unchanged text is never re-tagged.
  if (keyword.taggedContentHash === taggedContentHash && Array.isArray(keyword.tags)) {
    return { tags: keyword.tags, taggedContentHash, source: 'cached' };
  }

  let raw = null;
  let source = 'heuristic';
  if (typeof callModel === 'function') {
    try {
      raw = parseTaggingResponse(await callModel(buildTaggingRequest(keyword)));
      if (raw) source = 'model';
    } catch {
      raw = null;
    }
  }
  if (!raw) return { ...tagKeywordOffline(keyword), source };

  const { tags, rejected } = enforceVocabulary(raw);
  // A model that produced nothing usable leaves the keyword better off tagged
  // lexically than tagged with words no query has ever carried.
  if (tags.length === 0) return { ...tagKeywordOffline(keyword), source };
  return { tags, taggedContentHash, source, rejected };
}

/**
 * Tag a whole ad group, which is what a player actually submits.
 *
 * @param {Array<object>} keywords
 * @param {{callModel?: Function}} [options]
 * @returns {Promise<Array<object>>} the keywords, tagged
 */
export async function tagKeywords(keywords, { callModel } = {}) {
  const tagged = [];
  for (const keyword of keywords ?? []) {
    const { tags, taggedContentHash } = await tagKeyword({ keyword, callModel });
    tagged.push({ ...keyword, tags, taggedContentHash });
  }
  return tagged;
}

/** Tag a whole ad group offline, synchronously — the path round 0 uses. */
export function tagKeywordsOffline(keywords) {
  return (keywords ?? []).map((keyword) => ({ ...keyword, ...tagKeywordOffline(keyword) }));
}
