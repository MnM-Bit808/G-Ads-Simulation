/**
 * What the weekly Your keywords shows (plans/2026-09-13-studio-makeover.md,
 * section 4), read from the draft and the week's report without a page. The
 * slider's range is the kit's and is tested in tests/kit.test.js.
 */

import { describe, test, expect } from 'vitest';
import { getSelfView } from '../engine/insights.js';
import { MIN_BID_PAISE } from '../engine/constants.js';
import { QUERY_SET } from '../content/querySet.js';
import { makeGameState, PLAYER_ID } from './fixtures/gameState.js';
import { createDraft, updateKeyword, addKeyword, effectiveGrades } from '../ui/decisions.js';
import { createSetupDraft, addSetupKeyword, setupKeywordCards } from '../ui/roundzero/rules.js';
import { keywordCards, adjustSeveral, readingPanel } from '../ui/keywords/read.js';
import { lowestBidToShowPaise, wholeRupeeBid } from '../ui/reserve.js';
import { DAYPART_BLOCKS } from '../engine/constants.js';

const draft = () => createDraft(getSelfView(makeGameState(), PLAYER_ID));
const reach = (k) => `${k.matchType}:${k.text}`.length; // a stand-in the tests can predict
const cards = (d, byKeyword = {}) => keywordCards({
  draft: d, byKeyword, quality: {}, grades: effectiveGrades(d), reach, querySet: QUERY_SET,
});

describe('a card per keyword', () => {
  test('in the draft\'s order, with its own text, match and bid', () => {
    const d = draft();
    expect(cards(d).map((c) => [c.id, c.text, c.matchType, c.bidPaise]))
      .toEqual(d.keywords.map((k) => [k.id, k.text, k.matchType, k.bidPaise]));
  });

  test('the same shape as round 0\'s, so one card draws both (ui/kit/card.js)', () => {
    const setup = createSetupDraft({ playerBrandId: PLAYER_ID, rootSeed: 1 });
    addSetupKeyword(setup, 'gym leggings');
    const [roundZero] = setupKeywordCards(setup, QUERY_SET);
    expect(Object.keys(cards(draft())[0]).sort()).toEqual(Object.keys(roundZero).sort());
  });

  test('"was" appears only once the bid or the match has moved', () => {
    const d = draft();
    const [a] = d.keywords;
    // Read before the change: `updateKeyword` changes the keyword it is handed.
    const before = a.bidPaise;
    expect(cards(d)[0]).toMatchObject({ wasBidPaise: null, wasMatchType: null });
    updateKeyword(d, a.id, { bidPaise: before + 500, matchType: 'broad' });
    expect(cards(d)[0]).toMatchObject({ bidPaise: before + 500, wasBidPaise: before, wasMatchType: 'exact' });
  });

  test('tags show on broad and only on broad (E8)', () => {
    const d = draft();
    expect(cards(d).some((c) => c.matchType === 'broad')).toBe(true);
    for (const card of cards(d)) {
      if (card.matchType === 'broad') expect(card.tags.length).toBeGreaterThan(0);
      else expect(card.tags).toBeNull();
    }
  });

  test('a broad keyword with no tags is flagged', () => {
    const d = draft();
    addKeyword(d, { text: 'zzqx plumbing', matchType: 'broad', bidPaise: 3000 },
      { tag: () => ({ tags: [], taggedContentHash: 'x' }) });
    expect(cards(d).at(-1).noTagsOnBroad).toBe(true);
  });

  test('a keyword added this week has no figures yet', () => {
    const d = draft();
    addKeyword(d, { text: 'running shorts', matchType: 'phrase', bidPaise: 3000 });
    expect(cards(d).at(-1)).toMatchObject({ isNew: true, stats: null });
  });

  test('figures come from the report\'s rows, and a click-less keyword has no price', () => {
    const d = draft();
    const [a, b] = d.keywords;
    const byKeyword = {
      [a.id]: { clicks: 10, costPaise: 2505, conversions: 1.5 },
      [b.id]: { clicks: 0, costPaise: 0, conversions: 0 },
    };
    const [first, second] = cards(d, byKeyword);
    expect(first.stats).toEqual({ clicks: 10, costPaise: 2505, cpcPaise: 251, conversions: 1.5 });
    expect(second.stats.cpcPaise).toBeNull();
  });

  test('reach is the engine\'s count for the keyword on its chosen match', () => {
    const d = draft();
    const [a] = d.keywords;
    updateKeyword(d, a.id, { matchType: 'phrase' });
    expect(cards(d)[0].reach).toBe(reach({ ...a, matchType: 'phrase' }));
  });

  test('no score reads as none, with nothing invented', () => {
    expect(cards(draft())[0].quality).toMatchObject({ value: null, ratings: [] });
  });

});

describe('a bid under the reserve, warned as round 0 warns it (I17)', () => {
  const at = (d, bidPaise) => {
    updateKeyword(d, d.keywords[0].id, { bidPaise });
    return cards(d)[0].needPaise;
  };
  const floor = (d) => lowestBidToShowPaise({
    grade: effectiveGrades(d), keyword: d.keywords[0], querySet: QUERY_SET,
    daypartAdjustments: d.daypartAdjustments, locationAdjustments: d.locationAdjustments,
  });

  test('says the whole-rupee bid it needs, at the grade the week runs on', () => {
    const d = draft();
    expect(d.strategy).toBe('manual');
    expect(at(d, MIN_BID_PAISE)).toBe(wholeRupeeBid(floor(d)));
  });

  test('from a paise under the floor, and says nothing at it', () => {
    const d = draft();
    const need = floor(d);
    expect(at(d, need - 1)).not.toBeNull();
    expect(at(d, need)).toBeNull();
  });

  test('counts the hours as adjusted: a bid that clears at every hour can fail at half', () => {
    const d = draft();
    const need = floor(d);
    expect(at(d, need)).toBeNull();
    d.daypartAdjustments = DAYPART_BLOCKS.map(() => -50);
    expect(at(d, need)).not.toBeNull();
  });

  test('a paused keyword enters no auction, so it is not warned', () => {
    const d = draft();
    updateKeyword(d, d.keywords[0].id, { active: false });
    expect(at(d, MIN_BID_PAISE)).toBeNull();
  });

  test('under a bid strategy the card says nothing: the strategy sets the bid, and warns for it', () => {
    const d = draft();
    d.strategy = 'maxClicks';
    expect(at(d, MIN_BID_PAISE)).toBeNull();
  });
});

describe('adjust several at once', () => {
  test('sets one bid across all the ticked keywords', () => {
    const d = draft();
    const ids = d.keywords.slice(0, 2).map((k) => k.id);
    expect(adjustSeveral(d, ids, { setBidPaise: 2500 })).toEqual({ changed: ids, refused: [] });
    expect(d.keywords.slice(0, 2).map((k) => k.bidPaise)).toEqual([2500, 2500]);
  });

  test('a percentage rounds each bid to the nearest whole rupee', () => {
    const d = draft();
    const [a] = d.keywords;
    updateKeyword(d, a.id, { bidPaise: 3300 });
    // ₹29.70 is nearer ₹30 than ₹29, so this fails if the rupee is rounded down.
    adjustSeveral(d, [a.id], { byPercent: -10 });
    expect(d.keywords[0].bidPaise).toBe(3000);
  });

  test('and never below the minimum bid', () => {
    const d = draft();
    const [a] = d.keywords;
    updateKeyword(d, a.id, { bidPaise: 300 });
    adjustSeveral(d, [a.id], { byPercent: -99 });
    expect(d.keywords[0].bidPaise).toBe(MIN_BID_PAISE);
  });

  test('switches a match type across them', () => {
    const d = draft();
    const ids = d.keywords.map((k) => k.id);
    adjustSeveral(d, ids, { matchType: 'phrase' });
    expect(d.keywords.every((k) => k.matchType === 'phrase')).toBe(true);
  });

  test('says which it left alone, and why', () => {
    const d = draft();
    const out = adjustSeveral(d, ['nope', d.keywords[0].id], { setBidPaise: 0 });
    expect(out.changed).toEqual([]);
    expect(out.refused.map((r) => r.id)).toEqual(['nope', d.keywords[0].id]);
  });

  test('refuses a change that is none of the three', () => {
    expect(() => adjustSeveral(draft(), [], {})).toThrow(TypeError);
  });
});

describe('the reading panel', () => {
  const outlook = (constraint) => ({ constraint, lostToBudget: 0.5, lostToRank: 0, impressionShare: 0.5 });
  const keywords = [1, 2, 3, 4, 5].map((n) => ({ id: `k${n}`, text: `kw ${n}` }));
  const lastWeek = {
    k1: { costPaise: 5000 }, k2: { costPaise: 3000 }, k3: { costPaise: 1000 },
    k4: { costPaise: 600 }, k5: { costPaise: 400 }, gone: { costPaise: 999 },
  };

  test('names the three biggest spenders and folds the rest together', () => {
    const p = readingPanel({ outlook: outlook('budget'), keywords, lastWeek, week: 4 });
    expect(p.named.map((r) => r.id)).toEqual(['k1', 'k2', 'k3']);
    expect(p.others).toEqual({ count: 2, share: 0.1 });
    expect(p.spend.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1);
  });

  test('a keyword it cannot name is left out rather than guessed', () => {
    const p = readingPanel({ outlook: outlook('budget'), keywords, lastWeek, week: 4 });
    expect(p.spend.some((r) => r.id === 'gone')).toBe(false);
  });

  test('offers the levers that act on what held the week back', () => {
    const levers = (c) => readingPanel({ outlook: outlook(c), keywords, lastWeek, week: 4 }).levers;
    expect(levers('budget')).toEqual(['stretch', 'addMoney']);
    expect(levers('both')).toEqual(['stretch', 'addMoney']);
    expect(levers('rank')).toEqual(['raise']);
    expect(levers('saturated')).toEqual(['reach']);
  });

  test('before a week has run there is nothing to say', () => {
    expect(readingPanel({ outlook: null, keywords, lastWeek: {}, week: 0 })).toBeNull();
  });
});
