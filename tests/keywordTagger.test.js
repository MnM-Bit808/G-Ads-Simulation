import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  tagKeyword, tagKeywords, tagKeywordOffline, tagKeywordsOffline,
  heuristicTags, enforceVocabulary, tagContentHashOf, sharedTagsNeeded,
  buildTaggingRequest, parseTaggingResponse, TAG_TOOL, MAX_KEYWORD_TAGS,
} from '../agents/keywordTagger.js';
import { QUERY_SET } from '../content/querySet.js';
import { homeCell } from '../engine/querySet.js';
import { matchesKeyword, tagOverlap, queryKeywordFit } from '../engine/matching.js';
import { TAG_VOCABULARY, BROAD_MATCH_MIN_OVERLAP } from '../engine/constants.js';

const kw = (text, over = {}) => ({ text, matchType: 'broad', bidPaise: 2000, ...over });
const stubModel = (tags) => async () => ({
  content: [{ type: 'tool_use', name: TAG_TOOL.name, input: { tags } }],
});

describe('only the vocabulary exists (spec 8.1, 8.4)', () => {
  test('an invented tag is dropped, not stored', () => {
    // The load-bearing rule. A tag outside TAG_VOCABULARY can never appear on a
    // query, so it can never contribute to an overlap - it quietly makes the
    // keyword HARDER to match while looking like it helps.
    const { tags, rejected } = enforceVocabulary(['leggings', 'activewear', 'womens-gym', 'gym']);
    expect(tags).toEqual(['leggings', 'gym']);
    expect(rejected).toEqual(['activewear', 'womens-gym']);
  });

  test('a model that invents everything falls back rather than poisoning the keyword', async () => {
    const result = await tagKeyword({
      keyword: kw('gym leggings'),
      callModel: stubModel(['activewear', 'sportswear', 'fitness-apparel']),
    });
    // Better tagged lexically than tagged with words no query has ever carried.
    expect(result.tags).toEqual(heuristicTags('gym leggings'));
    for (const tag of result.tags) expect(TAG_VOCABULARY).toContain(tag);
  });

  test('every tag this module can ever emit is in the vocabulary', () => {
    const texts = QUERY_SET.queries.map((q) => q.text);
    for (const text of texts) {
      for (const tag of heuristicTags(text)) {
        expect(TAG_VOCABULARY, `"${text}" produced "${tag}"`).toContain(tag);
      }
    }
  });

  test('the tool constrains the model to it too, at the schema', () => {
    expect(TAG_TOOL.strict).toBe(true);
    expect(TAG_TOOL.input_schema.properties.tags.items.enum).toEqual([...TAG_VOCABULARY]);
    expect(TAG_TOOL.input_schema.properties.tags.maxItems).toBe(MAX_KEYWORD_TAGS);
  });

  test('duplicates collapse and order is the vocabulary order, not arrival order', () => {
    // Vocabulary order is product, attribute, use, audience, price, intent - so
    // trimming to the cap keeps what the keyword IS and drops the incidentals.
    expect(enforceVocabulary(['gym', 'leggings', 'gym']).tags).toEqual(['leggings', 'gym']);
  });
});

describe('the tag count is capped, because it decides reach', () => {
  test('nothing carries more than MAX_KEYWORD_TAGS', () => {
    const greedy = enforceVocabulary(TAG_VOCABULARY.slice(0, 20));
    expect(greedy.tags).toHaveLength(MAX_KEYWORD_TAGS);
  });

  test('and the cap is where the query set says the cliff is', () => {
    // A keyword with n tags needs a query carrying ceil(n/2) of them. Queries
    // carry two to four. At seven tags a query must supply four, and only 11 of
    // 151 queries have four tags at all - so a broad keyword past the cap is
    // inert in practice while looking perfectly well-formed.
    const withAtLeast = (n) => QUERY_SET.queries.filter((q) => q.tags.length >= n).length;
    expect(sharedTagsNeeded(MAX_KEYWORD_TAGS)).toBe(3);
    expect(withAtLeast(sharedTagsNeeded(MAX_KEYWORD_TAGS))).toBeGreaterThan(100);
    expect(withAtLeast(sharedTagsNeeded(MAX_KEYWORD_TAGS + 1))).toBeLessThan(20);
  });

  test('an over-tagged keyword really would go inert', () => {
    // Demonstrated rather than asserted: eight tags against the real set.
    const overTagged = kw('x', { tags: TAG_VOCABULARY.slice(0, 8) });
    const reached = QUERY_SET.queries.filter(
      (q) => tagOverlap(overTagged.tags, q.tags) >= BROAD_MATCH_MIN_OVERLAP,
    );
    expect(reached).toHaveLength(0);
  });
});

describe('tagging makes broad match work (spec 8.4)', () => {
  const head = QUERY_SET.queries.find((q) => q.isHeadTerm && homeCell(q) === 'value|performance');

  test('an untagged keyword matches nothing on broad', () => {
    const untagged = kw(head.text, { tags: [], taggedContentHash: null });
    expect(matchesKeyword(head, untagged)).toBe(false);
  });

  test('and the same keyword tagged does match', () => {
    const tagged = kw(head.text, tagKeywordOffline({ text: head.text }));
    expect(tagged.tags.length).toBeGreaterThan(0);
    expect(matchesKeyword(head, tagged)).toBe(true);
  });

  test('exact and phrase never needed tags, and still do not', () => {
    for (const matchType of ['exact', 'phrase']) {
      const untagged = kw(head.text, { matchType, tags: [], taggedContentHash: null });
      expect(matchesKeyword(head, untagged), matchType).toBe(true);
    }
  });

  test('a tagged keyword reaches beyond its own query, but not everywhere', () => {
    const tagged = kw(head.text, tagKeywordOffline({ text: head.text }));
    const reached = QUERY_SET.queries.filter((q) => matchesKeyword(q, tagged));
    expect(reached.length).toBeGreaterThan(1);
    expect(reached.length).toBeLessThan(QUERY_SET.queries.length);
  });
});

describe('tagging also moves queryKeywordFit (spec 8.3)', () => {
  test('an untagged keyword scores a flat 1.0, whatever it is matched against', () => {
    const untagged = kw('anything at all', { tags: [] });
    for (const query of QUERY_SET.queries.slice(0, 5)) {
      expect(queryKeywordFit(query, untagged)).toBe(1.0);
    }
  });

  test('a well-tagged keyword beats 1.0 on its own query', () => {
    // So tagging is not free: it rewards a keyword that matches what it says.
    const head = QUERY_SET.queries.find((q) => q.isHeadTerm);
    const tagged = kw(head.text, tagKeywordOffline({ text: head.text }));
    expect(queryKeywordFit(head, tagged)).toBeGreaterThan(1.0);
  });

  test('and can fall below it on a query that shares little', () => {
    const leggings = QUERY_SET.queries.find((q) => q.text.includes('leggings'));
    const tagged = kw(leggings.text, tagKeywordOffline({ text: leggings.text }));
    const stranger = QUERY_SET.queries.find((q) => tagOverlap(tagged.tags, q.tags) === 0);
    if (stranger) expect(queryKeywordFit(stranger, tagged)).toBeLessThan(1.0);
  });
});

describe('the offline tagger reads what is written, and nothing more', () => {
  test('it finds the words that are actually there', () => {
    expect(heuristicTags('high waisted gym leggings')).toContain('leggings');
    expect(heuristicTags('high waisted gym leggings')).toContain('high-waisted');
    expect(heuristicTags('high waisted gym leggings')).toContain('gym');
  });

  test('it handles the hyphenated vocabulary and plurals', () => {
    expect(heuristicTags('sports bra for gym')).toContain('sports-bra');
    expect(heuristicTags('co ord set')).toContain('co-ord-set');
    expect(heuristicTags('four way stretch gym tights')).toContain('four-way-stretch');
    expect(heuristicTags('workout tshirt women')).toContain('tshirt');
  });

  test('it invents nothing it cannot read', () => {
    // The query set tags "cheap gym leggings" with `women`, because the whole
    // vertical is women's athleisure. No amount of reading that string produces
    // it, and guessing would be worse than missing.
    expect(heuristicTags('cheap gym leggings')).not.toContain('women');
    expect(heuristicTags('cheap gym leggings')).toContain('cheap');
  });

  test('missing an implied tag costs nothing, because overlap divides by the KEYWORD', () => {
    const query = QUERY_SET.queries.find((q) => q.text === 'cheap gym leggings');
    const tagged = kw(query.text, tagKeywordOffline({ text: query.text }));
    expect(tagOverlap(tagged.tags, query.tags)).toBe(1);
  });

  test('it is deterministic', () => {
    expect(heuristicTags('gym leggings women')).toEqual(heuristicTags('gym leggings women'));
  });

  test('it tags most of the real query set usefully', () => {
    const tagged = QUERY_SET.queries.filter((q) => heuristicTags(q.text).length > 0);
    expect(tagged.length / QUERY_SET.queries.length).toBeGreaterThan(0.9);
  });
});

describe('cached on the text, per spec 8.4', () => {
  test('the same text hashes the same', () => {
    expect(tagContentHashOf({ text: 'Gym  Leggings ' })).toBe(tagContentHashOf({ text: 'gym leggings' }));
  });

  test('unchanged text is not re-tagged, and no model is called', async () => {
    let calls = 0;
    const callModel = async (...args) => { calls += 1; return stubModel(['gym'])(...args); };
    const first = await tagKeyword({ keyword: kw('gym leggings') });
    const again = await tagKeyword({
      keyword: kw('gym leggings', { tags: first.tags, taggedContentHash: first.taggedContentHash }),
      callModel,
    });
    expect(again.source).toBe('cached');
    expect(calls).toBe(0);
  });

  test('changing the text does re-tag', async () => {
    const first = await tagKeyword({ keyword: kw('gym leggings') });
    const second = await tagKeyword({
      keyword: kw('yoga pants women', { tags: first.tags, taggedContentHash: first.taggedContentHash }),
    });
    expect(second.taggedContentHash).not.toBe(first.taggedContentHash);
    expect(second.tags).not.toEqual(first.tags);
  });

  test('changing the match type or the bid does not', () => {
    // Switching phrase to broad does not change what a keyword MEANS, so it
    // must not force a model call - and neither should editing a bid.
    const base = tagContentHashOf(kw('gym leggings'));
    expect(tagContentHashOf(kw('gym leggings', { matchType: 'exact' }))).toBe(base);
    expect(tagContentHashOf(kw('gym leggings', { bidPaise: 9999 }))).toBe(base);
  });
});

describe('the model path', () => {
  test('the request carries the keyword and the vocabulary, and nothing else', () => {
    const text = JSON.stringify(buildTaggingRequest(kw('high waisted gym leggings')));
    expect(text).toContain('high waisted gym leggings');
    expect(text).toContain('squat-proof');
    // Not the query set, not the position, not what converts. A tagger that
    // knew which queries were valuable would be choosing the player's traffic.
    //
    // Note that "premium" IS in the request, and legitimately: it is a
    // price-signal tag in TAG_VOCABULARY, describing what a keyword says rather
    // than which tier the advertiser occupies. The leak to guard is the
    // advertiser's own economics, not the word.
    for (const leak of [
      'volumeShareBp', 'priceAffinity', 'purposeAffinity', 'convMultiplier',
      'aovMeanPaise', 'marginPct', 'breakEven', 'position',
    ]) {
      expect(text, leak).not.toContain(leak);
    }
  });

  test('a model answer is used and still filtered', async () => {
    const result = await tagKeyword({
      keyword: kw('gym leggings'),
      callModel: stubModel(['leggings', 'gym', 'not-a-real-tag']),
    });
    expect(result.source).toBe('model');
    expect(result.tags).toEqual(['leggings', 'gym']);
    expect(result.rejected).toEqual(['not-a-real-tag']);
  });

  test('a model that does not call the tool falls back', () => {
    expect(parseTaggingResponse({ content: [{ type: 'text', text: 'leggings, gym' }] })).toBeNull();
  });

  test('a model that throws falls back to the heuristic', async () => {
    const result = await tagKeyword({
      keyword: kw('gym leggings'),
      callModel: async () => { throw new Error('network down'); },
    });
    expect(result.tags).toEqual(heuristicTags('gym leggings'));
  });

  test('a whole ad group can be tagged at once', async () => {
    const group = [kw('gym leggings'), kw('sports bra for gym'), kw('yoga pants women')];
    const tagged = await tagKeywords(group);
    expect(tagged).toHaveLength(3);
    for (const keyword of tagged) {
      expect(keyword.tags.length).toBeGreaterThan(0);
      expect(keyword.taggedContentHash).toMatch(/^h53:/);
    }
    expect(tagKeywordsOffline(group).map((k) => k.tags)).toEqual(tagged.map((k) => k.tags));
  });
});

describe('the suite stays offline (R2)', () => {
  test('the tagger holds the judgement and cannot reach a network', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../agents/keywordTagger.js', import.meta.url)), 'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const escape of ['fetch(', 'XMLHttpRequest', 'require(', 'import(', 'anthropic']) {
      expect(src.toLowerCase().includes(escape.toLowerCase()), escape).toBe(false);
    }
  });
});

/**
 * A planner keyword is tagged as the search it names (stage A3,
 * reviews/slc-review.md 9A-1, DECISIONS E9).
 *
 * The query set's tags are the tagger's own output for those exact phrases,
 * computed once offline and frozen (E2), and every rival's keyword already
 * carries them (setup.js). The player's went through the word lookup instead,
 * which reaches further: over the 120 commercial searches, 86 lost a tag, 34
 * collapsed to one, and mean broad reach was 29.2 searches against 16.7.
 */
describe('a keyword that is a planner search is tagged as that search', () => {
  const reach = (tags) => QUERY_SET.queries
    .filter((q) => tagOverlap(tags, q.tags) >= BROAD_MATCH_MIN_OVERLAP).length;

  test('every search in the planner, added as a keyword, carries its own tags', () => {
    for (const q of QUERY_SET.queries) {
      expect(tagKeywordOffline({ text: q.text }, QUERY_SET).tags, q.text)
        .toEqual(enforceVocabulary(q.tags).tags);
    }
  });

  test('so on broad it reaches exactly what a rival\'s identical keyword reaches', () => {
    for (const q of QUERY_SET.queries.filter((x) => x.intent === 'commercial')) {
      expect(reach(tagKeywordOffline({ text: q.text }, QUERY_SET).tags), q.text).toBe(reach(q.tags));
    }
  });

  test('case and spacing do not stop it being the same search', () => {
    expect(tagKeywordOffline({ text: '  Matching  Set WOMEN ' }, QUERY_SET).tags)
      .toEqual(['co-ord-set', 'women']);
  });

  test('a keyword the planner does not contain is still read from its words', () => {
    const typed = 'ribbed seamless leggings';
    expect(QUERY_SET.queries.some((q) => q.text === typed)).toBe(false);
    const out = tagKeywordOffline({ text: typed }, QUERY_SET);
    expect(out.tags).toEqual(heuristicTags(typed));
    expect(out.source).toBe('heuristic');
  });

  test('it says where the tags came from', () => {
    expect(tagKeywordOffline({ text: 'matching set women' }, QUERY_SET).source).toBe('query-set');
  });

  test('without a query set it reads the words, exactly as before', () => {
    expect(tagKeywordOffline({ text: 'matching set women' }).tags).toEqual(heuristicTags('matching set women'));
  });

  test('a whole ad group is tagged the same way, and a keyword\'s old tags do not survive', () => {
    const [kept, typed] = tagKeywordsOffline([
      { text: 'matching set women', tags: ['women'] },
      { text: 'ribbed seamless leggings', tags: ['stale'] },
    ], QUERY_SET);
    expect(kept.tags).toEqual(['co-ord-set', 'women']);
    expect(typed.tags).toEqual(heuristicTags('ribbed seamless leggings'));
  });

  test('the word lookup reaches FURTHER, which is why it was not a safe default', () => {
    // The other half of "missing an implied tag costs nothing" above. Missing
    // tags costs nothing on the keyword's own search, where overlap is still 1 -
    // and widens broad match everywhere else, because tagOverlap divides by the
    // KEYWORD's count. "studio to street leggings" read as just `leggings`.
    const text = 'studio to street leggings';
    const row = QUERY_SET.queries.find((q) => q.text === text);
    expect(reach(heuristicTags(text))).toBeGreaterThan(reach(row.tags) * 5);
  });
});
