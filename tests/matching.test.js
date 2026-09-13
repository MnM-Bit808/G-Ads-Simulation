import { describe, test, expect } from 'vitest';
import {
  normalise, tokenise, stem, variantTokens,
  matchesKeyword, isBlocked, blockedBy,
  findMatches, isEligible, selectAdGroup,
  queryKeywordFit, tagOverlap, MATCH_SPECIFICITY, keywordReach,
} from '../engine/matching.js';
import { BROAD_MATCH_MIN_OVERLAP, QUALITY_FACTOR_RANGES } from '../engine/constants.js';
import { QUERY_SET } from '../content/querySet.js';
import { tagKeywordOffline } from '../agents/keywordTagger.js';

const q = (text, tags = []) => ({ id: 'q', text, tags });
const kw = (text, matchType, tags = [], extra = {}) => ({
  id: 'kw', text, matchType, tags, bidPaise: 5000, active: true, ...extra,
});
const neg = (text, matchType) => ({ text, matchType });

describe('how far a keyword reaches (the review\'s first recommendation, E8)', () => {
  // How far broad goes depends on how a keyword was tagged, so a player choosing
  // "broad" could not see what it would buy. The count is the engine's own
  // matching, over every search in the set, before negatives.
  const set = { queries: [
    q('gym leggings', ['leggings', 'gym']),
    q('gym leggings sale', ['leggings', 'gym', 'sale']),
    q('yoga pants', ['pants', 'yoga']),
  ] };

  test('it counts the searches the keyword matches on its own match type', () => {
    expect(keywordReach(kw('gym leggings', 'exact', ['leggings', 'gym']), set)).toBe(1);
    expect(keywordReach(kw('gym leggings', 'phrase', ['leggings', 'gym']), set)).toBe(2);
    expect(keywordReach(kw('leggings', 'broad', ['leggings']), set)).toBe(2);
  });

  test('an untagged keyword reaches nothing on broad, as it matches nothing', () => {
    expect(keywordReach(kw('gym leggings', 'broad', []), set)).toBe(0);
  });

  test('on the real set, a planner keyword reaches further on broad than on phrase', () => {
    // The tagger returns the tags, not the keyword: its text is the caller's.
    const tagged = { text: 'gym leggings', ...tagKeywordOffline({ text: 'gym leggings' }, QUERY_SET) };
    const on = (matchType) => keywordReach({ ...tagged, matchType }, QUERY_SET);
    expect(on('exact')).toBeGreaterThanOrEqual(1);
    expect(on('phrase')).toBeGreaterThanOrEqual(on('exact'));
    expect(on('broad')).toBeGreaterThan(on('phrase'));
  });

  test('and a specific keyword reaches less on broad than a generic one (E8)', () => {
    const reach = (text) => keywordReach({ text, ...tagKeywordOffline({ text }, QUERY_SET), matchType: 'broad' }, QUERY_SET);
    expect(reach('seamless compression leggings')).toBeLessThan(reach('leggings'));
  });
});

describe('normalise and tokenise', () => {
  test('lowercases, strips punctuation and collapses whitespace', () => {
    expect(normalise('  Gym   Leggings, Women!  ')).toBe('gym leggings women');
  });

  test('tokenises on whitespace', () => {
    expect(tokenise('gym leggings women')).toEqual(['gym', 'leggings', 'women']);
  });

  test('an empty string tokenises to nothing, not to one empty token', () => {
    expect(tokenise('   ')).toEqual([]);
  });
});

describe('stem', () => {
  test('strips a simple plural', () => {
    expect(stem('leggings')).toBe(stem('legging'));
    expect(stem('shorts')).toBe(stem('short'));
  });

  test('handles -ies', () => {
    expect(stem('bodies')).toBe(stem('body'));
  });

  test('leaves -ss alone', () => {
    expect(stem('dress')).toBe('dress');
  });

  test('leaves short words alone', () => {
    expect(stem('gym')).toBe('gym');
    expect(stem('bra')).toBe('bra');
  });
});

describe('variantTokens — the close-variant rule', () => {
  test('plurals are variants', () => {
    expect(variantTokens('leggings', 'legging')).toBe(true);
  });

  test('a one-character typo in a long word is a variant', () => {
    expect(variantTokens('leggings', 'leggins')).toBe(true);
  });

  test('but two different products are NOT variants', () => {
    // "shorts" and "shirts" are one edit apart. Treating edit distance alone
    // as a close variant would silently match a shorts keyword to a shirts
    // query - a false match in a simulator whose whole subject is precision.
    // The guard is a shared four-character prefix.
    expect(variantTokens('shorts', 'shirts')).toBe(false);
  });

  test('short words get no typo tolerance at all', () => {
    expect(variantTokens('bra', 'bro')).toBe(false);
    expect(variantTokens('top', 'tap')).toBe(false);
  });
});

describe('exact match', () => {
  test('matches the identical query', () => {
    expect(matchesKeyword(q('gym leggings'), kw('gym leggings', 'exact'))).toBe(true);
  });

  test('accepts a plural close variant', () => {
    expect(matchesKeyword(q('gym legging'), kw('gym leggings', 'exact'))).toBe(true);
  });

  test('accepts reordering that preserves meaning', () => {
    expect(matchesKeyword(q('leggings gym'), kw('gym leggings', 'exact'))).toBe(true);
  });

  test('accepts a misspelling', () => {
    expect(matchesKeyword(q('gym leggins'), kw('gym leggings', 'exact'))).toBe(true);
  });

  test('rejects extra words', () => {
    expect(matchesKeyword(q('cheap gym leggings'), kw('gym leggings', 'exact'))).toBe(false);
  });

  test('rejects a missing word', () => {
    expect(matchesKeyword(q('leggings'), kw('gym leggings', 'exact'))).toBe(false);
  });

  test('rejects a different product one edit away', () => {
    expect(matchesKeyword(q('gym shirts'), kw('gym shorts', 'exact'))).toBe(false);
  });
});

describe('phrase match', () => {
  test('matches with text on either side', () => {
    const k = kw('gym leggings', 'phrase');
    expect(matchesKeyword(q('cheap gym leggings'), k)).toBe(true);
    expect(matchesKeyword(q('gym leggings women'), k)).toBe(true);
    expect(matchesKeyword(q('buy cheap gym leggings online'), k)).toBe(true);
  });

  test('requires the terms in order', () => {
    expect(matchesKeyword(q('leggings gym'), kw('gym leggings', 'phrase'))).toBe(false);
  });

  test('requires the terms to be contiguous', () => {
    expect(matchesKeyword(q('gym wear leggings'), kw('gym leggings', 'phrase'))).toBe(false);
  });

  test('still tolerates plurals, via stemming', () => {
    expect(matchesKeyword(q('cheap gym legging women'), kw('gym leggings', 'phrase'))).toBe(true);
  });

  test('but not misspellings: only exact match carries typo tolerance', () => {
    expect(matchesKeyword(q('cheap gym leggins'), kw('gym leggings', 'phrase'))).toBe(false);
  });
});

describe('broad match runs on tags, not on words (spec 8.1)', () => {
  const k = kw('gym leggings', 'broad', ['leggings', 'gym']);

  test('matches a query sharing enough tags, with no words in common', () => {
    // "squat proof tights" shares not one word with "gym leggings" and means
    // nearly the same thing. This is exactly why broad match cannot be a
    // string operation, and why the semantics are precomputed offline.
    expect(matchesKeyword(q('squat proof tights', ['leggings', 'gym', 'squat-proof']), k))
      .toBe(true);
  });

  test('rejects a query below the overlap threshold', () => {
    expect(matchesKeyword(q('protein powder', ['research']), k)).toBe(false);
  });

  test('the threshold is the fraction of the KEYWORD tags found on the query', () => {
    const wide = kw('gym leggings', 'broad', ['leggings', 'gym', 'women', 'cheap']);
    // 2 of 4 = 0.5, exactly at the threshold, so it matches.
    expect(BROAD_MATCH_MIN_OVERLAP).toBe(0.5);
    expect(matchesKeyword(q('gym leggings', ['leggings', 'gym']), wide)).toBe(true);
    // 1 of 4 = 0.25, below.
    expect(matchesKeyword(q('yoga mat', ['gym']), wide)).toBe(false);
  });

  test('reaches irrelevant traffic, which is the point', () => {
    const broadKw = kw('gym wear', 'broad', ['gym']);
    expect(matchesKeyword(q('free gym diet chart', ['gym', 'free', 'research']), broadKw))
      .toBe(true);
  });
});

describe('untagged keywords (spec 8.4)', () => {
  test('exact still works', () => {
    expect(matchesKeyword(q('gym leggings'), kw('gym leggings', 'exact', []))).toBe(true);
  });

  test('phrase still works', () => {
    expect(matchesKeyword(q('cheap gym leggings'), kw('gym leggings', 'phrase', []))).toBe(true);
  });

  test('broad is inert: it matches nothing rather than everything', () => {
    const k = kw('gym leggings', 'broad', []);
    expect(matchesKeyword(q('gym leggings', ['leggings', 'gym']), k)).toBe(false);
    expect(matchesKeyword(q('anything at all', ['leggings']), k)).toBe(false);
  });

  test('a null tags field behaves the same as an empty one', () => {
    expect(matchesKeyword(q('gym leggings', ['gym']), kw('gym leggings', 'broad', null)))
      .toBe(false);
  });
});

describe('negatives never touch the tag layer (spec 8.2, H3)', () => {
  test('a negative does not block a semantically related query', () => {
    // If negatives ran on tags, "-cheap" would kill everything tagged
    // price-sensitive even where the word never appears - inverting the real
    // behaviour, where negatives are STRICTER than their positive twins.
    const query = q('leggings under 499', ['leggings', 'budget', 'cheap']);
    expect(isBlocked(query, [neg('cheap', 'broad')])).toBe(false);
  });

  test('it blocks only when the literal word is present', () => {
    expect(isBlocked(q('cheap gym leggings'), [neg('cheap', 'broad')])).toBe(true);
  });

  test('negative exact does NOT match close variants (L11)', () => {
    expect(isBlocked(q('gym leggings'), [neg('gym leggings', 'exact')])).toBe(true);
    expect(isBlocked(q('gym legging'), [neg('gym leggings', 'exact')])).toBe(false);
    expect(isBlocked(q('leggings gym'), [neg('gym leggings', 'exact')])).toBe(false);
  });

  test('negative phrase does not match plurals either', () => {
    expect(isBlocked(q('cheap gym leggings women'), [neg('gym leggings', 'phrase')])).toBe(true);
    expect(isBlocked(q('cheap gym legging women'), [neg('gym leggings', 'phrase')])).toBe(false);
  });

  test('negative phrase requires order', () => {
    expect(isBlocked(q('leggings gym cheap'), [neg('gym leggings', 'phrase')])).toBe(false);
  });

  test('negative broad needs every token, in any order', () => {
    expect(isBlocked(q('free workout plan'), [neg('free plan', 'broad')])).toBe(true);
    expect(isBlocked(q('free workout'), [neg('free plan', 'broad')])).toBe(false);
  });

  test('blockedBy names which negative fired, so the UI can explain itself', () => {
    const n = neg('free', 'broad');
    expect(blockedBy(q('free workout plan'), [n, neg('nothing', 'broad')])).toBe(n);
    expect(blockedBy(q('gym leggings'), [n])).toBeNull();
  });

  test('one negative among many is enough to block', () => {
    const negatives = [neg('mens', 'broad'), neg('free', 'broad'), neg('kids', 'broad')];
    expect(isBlocked(q('free workout plan'), negatives)).toBe(true);
  });
});

describe('eligibility (spec 8.5)', () => {
  const adGroups = [{
    id: 'ag1',
    keywords: [kw('gym leggings', 'phrase', ['leggings', 'gym'])],
  }];

  test('eligible when a keyword matches and nothing blocks', () => {
    expect(isEligible(q('cheap gym leggings'), adGroups, [])).toBe(true);
  });

  test('not eligible when no keyword matches', () => {
    expect(isEligible(q('protein powder'), adGroups, [])).toBe(false);
  });

  test('not eligible when a negative blocks, even though a keyword matched', () => {
    expect(isEligible(q('cheap gym leggings'), adGroups, [neg('cheap', 'broad')])).toBe(false);
  });

  test('a paused keyword does not create eligibility', () => {
    const paused = [{
      id: 'ag1',
      keywords: [kw('gym leggings', 'phrase', ['leggings', 'gym'], { active: false })],
    }];
    expect(isEligible(q('cheap gym leggings'), paused, [])).toBe(false);
  });

  test('eligibility is independent of budget and of winning', () => {
    // Spec 8.5: an advertiser is eligible when a keyword matches and no
    // negative blocks. Nothing here knows about money or ad rank, which is
    // what keeps the impression share denominator honest.
    expect(isEligible.length).toBe(3);
  });
});

describe('findMatches', () => {
  const adGroups = [
    { id: 'ag_exact', keywords: [kw('gym leggings', 'exact', ['leggings', 'gym'])] },
    { id: 'ag_broad', keywords: [kw('gym wear', 'broad', ['gym'])] },
  ];

  test('returns one entry per matching ad group', () => {
    const hits = findMatches(q('gym leggings', ['leggings', 'gym']), adGroups);
    expect(hits.map((h) => h.adGroupId).sort()).toEqual(['ag_broad', 'ag_exact']);
  });

  test('reports how each ad group matched', () => {
    const hits = findMatches(q('gym leggings', ['leggings', 'gym']), adGroups);
    expect(hits.find((h) => h.adGroupId === 'ag_exact').matchType).toBe('exact');
    expect(hits.find((h) => h.adGroupId === 'ag_broad').matchType).toBe('broad');
  });

  test('within one ad group the most specific matching keyword wins', () => {
    const mixed = [{
      id: 'ag',
      keywords: [
        kw('gym wear', 'broad', ['gym'], { id: 'k_broad' }),
        kw('gym leggings', 'exact', ['leggings', 'gym'], { id: 'k_exact' }),
      ],
    }];
    const hits = findMatches(q('gym leggings', ['leggings', 'gym']), mixed);
    expect(hits).toHaveLength(1);
    expect(hits[0].keyword.id).toBe('k_exact');
  });

  test('returns nothing when no ad group matches', () => {
    expect(findMatches(q('protein powder', ['research']), adGroups)).toEqual([]);
  });
});

describe('ad group selection (spec 8.6)', () => {
  const byBid = (hit) => hit.keyword.bidPaise;

  test('the highest ad rank enters', () => {
    const hits = [
      { adGroupId: 'a', matchType: 'broad', keyword: kw('x', 'broad', [], { bidPaise: 9000 }) },
      { adGroupId: 'b', matchType: 'broad', keyword: kw('y', 'broad', [], { bidPaise: 3000 }) },
    ];
    expect(selectAdGroup(hits, byBid).adGroupId).toBe('a');
  });

  test('ties break toward the more specific match type', () => {
    const hits = [
      { adGroupId: 'broadone', matchType: 'broad', keyword: kw('x', 'broad', [], { bidPaise: 5000 }) },
      { adGroupId: 'exactone', matchType: 'exact', keyword: kw('y', 'exact', [], { bidPaise: 5000 }) },
    ];
    expect(selectAdGroup(hits, byBid).adGroupId).toBe('exactone');
  });

  test('exact beats phrase beats broad', () => {
    expect(MATCH_SPECIFICITY.exact).toBeGreaterThan(MATCH_SPECIFICITY.phrase);
    expect(MATCH_SPECIFICITY.phrase).toBeGreaterThan(MATCH_SPECIFICITY.broad);
  });

  test('a full tie breaks on ad group id, for determinism (R1)', () => {
    const hits = [
      { adGroupId: 'zeta', matchType: 'exact', keyword: kw('x', 'exact', [], { bidPaise: 5000 }) },
      { adGroupId: 'alpha', matchType: 'exact', keyword: kw('y', 'exact', [], { bidPaise: 5000 }) },
    ];
    expect(selectAdGroup(hits, byBid).adGroupId).toBe('alpha');
  });

  test('one ad per advertiser per auction: selection returns a single hit', () => {
    const hits = [
      { adGroupId: 'a', matchType: 'exact', keyword: kw('x', 'exact', [], { bidPaise: 5000 }) },
      { adGroupId: 'b', matchType: 'phrase', keyword: kw('y', 'phrase', [], { bidPaise: 5000 }) },
    ];
    expect(selectAdGroup(hits, byBid)).toBeTypeOf('object');
    expect(Array.isArray(selectAdGroup(hits, byBid))).toBe(false);
  });

  test('no candidates gives null', () => {
    expect(selectAdGroup([], byBid)).toBeNull();
  });
});

describe('queryKeywordFit (spec 8.3)', () => {
  const { min, max } = QUALITY_FACTOR_RANGES.queryKeywordFit;

  test('perfect tag overlap sits at the top of the range', () => {
    const k = kw('gym leggings', 'broad', ['leggings', 'gym']);
    expect(queryKeywordFit(q('gym leggings', ['leggings', 'gym']), k)).toBeCloseTo(max, 10);
  });

  test('no overlap sits at the bottom', () => {
    const k = kw('gym leggings', 'broad', ['leggings', 'gym']);
    expect(queryKeywordFit(q('protein', ['research']), k)).toBeCloseTo(min, 10);
  });

  test('a distant query scores lower than a close one', () => {
    // This is what makes "broad match degrades quality as well as wasting
    // spend" mechanical rather than asserted (DECISIONS H5).
    const k = kw('gym leggings', 'broad', ['leggings', 'gym', 'women']);
    const close = queryKeywordFit(q('gym leggings women', ['leggings', 'gym', 'women']), k);
    const far = queryKeywordFit(q('gym membership price', ['gym', 'research']), k);
    expect(far).toBeLessThan(close);
  });

  test('an untagged keyword is neutral, not penalised', () => {
    // It cannot be measured, and 8.4 says an untagged keyword should still
    // work on exact and phrase. Scoring it at the floor would cripple it for
    // not having been through the tagger yet.
    expect(queryKeywordFit(q('gym leggings', ['gym']), kw('gym leggings', 'exact', [])))
      .toBeCloseTo(1.0, 10);
  });

  test('the result always sits inside the stated range', () => {
    const k = kw('x', 'broad', ['a', 'b', 'c']);
    for (const tags of [[], ['a'], ['a', 'b'], ['a', 'b', 'c'], ['a', 'b', 'c', 'd', 'e']]) {
      const fit = queryKeywordFit(q('y', tags), k);
      expect(fit).toBeGreaterThanOrEqual(min);
      expect(fit).toBeLessThanOrEqual(max);
    }
  });
});

describe('tagOverlap', () => {
  test('is the fraction of keyword tags present on the query', () => {
    expect(tagOverlap(['a', 'b'], ['a', 'b', 'c'])).toBeCloseTo(1, 10);
    expect(tagOverlap(['a', 'b', 'c', 'd'], ['a', 'b'])).toBeCloseTo(0.5, 10);
    expect(tagOverlap(['a'], ['z'])).toBe(0);
  });

  test('a keyword with no tags overlaps nothing', () => {
    expect(tagOverlap([], ['a', 'b'])).toBe(0);
  });
});

describe('purity (R1)', () => {
  test('matching does not mutate its inputs', () => {
    const query = q('cheap gym leggings', ['leggings', 'gym', 'cheap']);
    const k = kw('gym leggings', 'broad', ['leggings', 'gym']);
    const before = JSON.stringify([query, k]);
    matchesKeyword(query, k);
    queryKeywordFit(query, k);
    expect(JSON.stringify([query, k])).toBe(before);
  });

  test('repeated calls agree', () => {
    const query = q('cheap gym leggings', ['leggings', 'gym']);
    const k = kw('gym leggings', 'phrase', ['leggings']);
    expect(matchesKeyword(query, k)).toBe(matchesKeyword(query, k));
  });

  test('an unknown match type throws rather than silently not matching', () => {
    expect(() => matchesKeyword(q('gym leggings'), kw('gym leggings', 'modified')))
      .toThrow(/modified/);
  });
});
