/**
 * Round 0's rules, read without a page (plans/2026-09-14-round-zero-redesign.md,
 * section 8). The classic page and the Studio steps must read the SAME
 * functions, or a figure on one could disagree with the account.
 */
import { describe, test, expect } from 'vitest';
import * as classic from '../ui/round-zero.js';
import * as rules from '../ui/roundzero/rules.js';
import { assignIdentities, BRAND_IDENTITIES } from '../content/brands.js';
import { QUERY_SET } from '../content/querySet.js';
import { startGame } from '../setup.js';
import { writerCopyFor, WRITER_COPY_VARIANTS } from '../content/writerCopy.js';
import { keywordReach } from '../engine/matching.js';
import { tagKeywordOffline } from '../agents/keywordTagger.js';
import {
  MONTHLY_BUDGET_PAISE, CAPEX_ALLOCATION_PAISE, CREATIVE_ALLOCATION_PAISE,
  CAPEX_DELAY_ROUNDS, CAPEX_TARGETS, WRITER_TIERS, MIN_BID_PAISE,
} from '../engine/constants.js';

describe('one set of rules for both looks', () => {
  test.each(['openingReserve', 'submittedAd', 'gradeAsSubmitted', 'monthlyBudget',
    'positionMatrix', 'splitShares'])('%s is the same function on both pages', (name) => {
    expect(classic[name]).toBe(rules[name]);
  });
});

describe('the rival ads round 0 shows', () => {
  const brand = 'nira';
  const ads = rules.rivalAds(20260902, brand, QUERY_SET);

  test('eight of them, none the player\'s own, in name order', () => {
    expect(ads).toHaveLength(8);
    expect(ads.map((a) => a.name)).toEqual([...ads.map((a) => a.name)].sort());
    const { player } = assignIdentities(brand);
    expect(ads.map((a) => a.name)).not.toContain(player.name);
  });

  test('each carries the ad the market will run, and no square', () => {
    for (const a of ads) {
      expect(a.ad.headlines.length).toBeGreaterThan(0);
      expect(Object.keys(a).sort()).toEqual(['ad', 'domain', 'name']);
    }
  });
});

describe('the research list', () => {
  test('every search, biggest first, with nothing Keyword Planner would not show', () => {
    const list = rules.researchList(QUERY_SET);
    expect(list).toHaveLength(QUERY_SET.queries.length);
    for (let i = 1; i < list.length; i++) expect(list[i - 1].weekly).toBeGreaterThanOrEqual(list[i].weekly);
    expect(Object.keys(list[0]).sort()).toEqual(['id', 'intent', 'text', 'weekly']);
  });
});

const SEED = 20260902;
const BRAND = BRAND_IDENTITIES[1].id;
const fresh = () => rules.createSetupDraft({ playerBrandId: BRAND, rootSeed: SEED });

describe('the draft round 0 opens on', () => {
  test('mid-price performance, the freelancer, all capital kept, nothing bid on', () => {
    const d = fresh();
    expect(d).toMatchObject({ cell: 'mid|performance', writerTier: 'freelancer', keywords: [], split: null, guesses: {} });
    expect(Object.values(d.capex).every((p) => p === 0)).toBe(true);
  });

  test('the freelancer\'s own copy is already in the ad, so nobody meets empty boxes', () => {
    const brand = BRAND_IDENTITIES[1];
    const copy = writerCopyFor('mid|performance', 'freelancer', brand.name, SEED % WRITER_COPY_VARIANTS);
    expect(fresh().ad.headlines).toEqual(copy.headlines);
    expect(fresh().adIsSeeded).toBe(true);
  });

  test('and it follows the square, because the writer writes for your position', () => {
    const d = fresh();
    rules.setCell(d, 'value|lifestyle', SEED);
    const copy = writerCopyFor('value|lifestyle', 'freelancer', BRAND_IDENTITIES[1].name, SEED % WRITER_COPY_VARIANTS);
    expect(d.ad.headlines).toEqual(copy.headlines);
  });

  test('the month holds the base, what the freelancer left, and all the capital', () => {
    const left = CREATIVE_ALLOCATION_PAISE - WRITER_TIERS.find((t) => t.id === 'freelancer').pricePaise;
    expect(rules.monthlyBudget(fresh())).toBe(MONTHLY_BUDGET_PAISE + left + CAPEX_ALLOCATION_PAISE);
  });

  test('the step-5 order names every capital target, once', () => {
    expect([...rules.CAPEX_ORDER].sort()).toEqual([...CAPEX_TARGETS].sort());
  });
});

describe('the month, as step 5 draws it', () => {
  test('its parts add up to the month, and a zero part is left out', () => {
    const d = fresh();
    expect(rules.monthParts(d).reduce((a, p) => a + p.paise, 0)).toBe(rules.monthlyBudget(d));
    rules.setWriter(d, 'retainer', SEED);
    expect(rules.monthParts(d).map((p) => p.key)).toEqual(['base', 'kept']);
  });

  test('committing capital takes it out of the month, rupee for rupee', () => {
    const d = fresh();
    const before = rules.monthlyBudget(d);
    expect(rules.setCapex(d, 'sizeGuide', 2500000).ok).toBe(true);
    expect(before - rules.monthlyBudget(d)).toBe(2500000);
  });

  test('a rung the capital left cannot buy is refused, and shown as such', () => {
    const d = fresh();
    const video = rules.capexRungs(d, 'photography').at(-1);
    expect(video.affordable).toBe(false);
    expect(rules.setCapex(d, 'photography', video.paise)).toMatchObject({ ok: false });
  });

  test('the split is even until someone changes a week, and a new month re-splits it', () => {
    const d = fresh();
    expect(rules.weeklySplit(d).reduce((a, b) => a + b, 0)).toBe(rules.monthlyBudget(d));
    rules.setWeek(d, 0, 0);
    expect(rules.weeklySplit(d)[0]).toBe(0);
    rules.setCapex(d, 'sizeGuide', 2500000);
    expect(rules.weeklySplit(d).reduce((a, b) => a + b, 0)).toBe(rules.monthlyBudget(d));
  });
});

describe('the landing page grade, as the engine will run it (spec section 6)', () => {
  const grade = (capex) => {
    const d = fresh();
    for (const [key, paise] of Object.entries(capex)) rules.setCapex(d, key, paise);
    return rules.landingGrade(d);
  };

  test('its rows, from the game\'s own code', () => {
    // These are the figures the owner approved in the spec. If the landing
    // page's timing changes (spec section 12), this test and step 5 change with it.
    expect(grade({})).toMatchObject({ fromWeek1: 5, fromWeek4: 5 });
    expect(grade({ landingPage: 5500000 })).toMatchObject({ fromWeek1: 7, fromWeek4: 9 });
    expect(grade({ landingPage: 8000000 })).toMatchObject({ fromWeek1: 7, fromWeek4: 10 });
    expect(grade({ sizeGuide: 2500000 })).toMatchObject({ fromWeek1: 7, fromWeek4: 7 });
  });

  test('it never falls when the site goes live, and never passes ten', () => {
    for (const page of [0, 2500000, 5500000, 8000000]) {
      const { fromWeek1, fromWeek4, liveAt } = grade({ landingPage: page });
      expect(fromWeek4).toBeGreaterThanOrEqual(fromWeek1);
      expect(fromWeek4).toBeLessThanOrEqual(10);
      expect(liveAt).toBe(1 + CAPEX_DELAY_ROUNDS);
    }
  });
});

describe('keywords in round 0', () => {
  test('a keyword is added once, however it is typed', () => {
    const d = fresh();
    expect(rules.addSetupKeyword(d, 'gym leggings').ok).toBe(true);
    expect(rules.addSetupKeyword(d, '  Gym   Leggings ')).toEqual({ ok: false, reason: 'held' });
    expect(rules.addSetupKeyword(d, '   ')).toEqual({ ok: false, reason: 'empty' });
    expect(d.keywords).toEqual([{ text: 'gym leggings', matchType: 'phrase', bidPaise: rules.SETUP_BID_PAISE }]);
  });

  test('a bid never goes under the minimum', () => {
    const d = fresh();
    rules.addSetupKeyword(d, 'gym leggings');
    rules.updateSetupKeyword(d, 'gym leggings', { bidPaise: 1 });
    expect(d.keywords[0].bidPaise).toBe(MIN_BID_PAISE);
  });

  test('a card carries the engine\'s reach, and tags on broad only', () => {
    const d = fresh();
    rules.addSetupKeyword(d, 'gym leggings');
    rules.addSetupKeyword(d, 'squat proof leggings', { matchType: 'broad' });
    const [phrase, broad] = rules.setupKeywordCards(d, QUERY_SET);
    const tags = tagKeywordOffline({ text: 'gym leggings' }, QUERY_SET).tags;
    expect(phrase.reach).toBe(keywordReach({ text: 'gym leggings', matchType: 'phrase', tags }, QUERY_SET));
    expect(phrase.tags).toBeNull();
    expect(broad.tags.length).toBeGreaterThan(0);
    expect(phrase).toMatchObject({ id: 'gym leggings', isNew: true, stats: null, active: null });
  });

  test('a bid under the reserve says what it needs, and a bid over it says nothing', () => {
    const d = fresh();
    rules.addSetupKeyword(d, 'gym leggings', { bidPaise: MIN_BID_PAISE });
    rules.addSetupKeyword(d, 'sports bra');
    const [low, ok] = rules.setupKeywordCards(d, QUERY_SET);
    expect(low.needPaise).toBeGreaterThan(MIN_BID_PAISE);
    expect(ok.needPaise).toBeNull();
  });

  test('removing takes it out', () => {
    const d = fresh();
    rules.addSetupKeyword(d, 'gym leggings');
    expect(rules.removeSetupKeyword(d, 'gym leggings').ok).toBe(true);
    expect(d.keywords).toEqual([]);
  });
});

describe('guesses are the player\'s notes, and never leave round 0', () => {
  test('tapping a square notes it, tapping it again takes it back', () => {
    const d = fresh();
    rules.setGuess(d, 'Marlow', 'value|lifestyle');
    expect(rules.guessedIn(d, 'value|lifestyle')).toEqual(['Marlow']);
    rules.setGuess(d, 'Marlow', 'value|lifestyle');
    expect(rules.guessedIn(d, 'value|lifestyle')).toEqual([]);
  });

  test('Go sends no guess', () => {
    const d = fresh();
    rules.setGuess(d, 'Marlow', 'value|lifestyle');
    expect(JSON.stringify(rules.startChoices(d))).not.toContain('Marlow');
  });
});

describe('what Go needs, and what it sends', () => {
  test('a keyword and a finished ad; the square and the money arrive done', () => {
    const d = fresh();
    expect(rules.checklist(d).map((c) => [c.key, c.done])).toEqual([
      ['square', true], ['keywords', false], ['ad', true], ['money', true],
    ]);
    expect(rules.canGo(d)).toBe(false);
    rules.addSetupKeyword(d, 'gym leggings');
    expect(rules.canGo(d)).toBe(true);
  });

  test('writing it yourself empties the boxes, and the ad is not done until written', () => {
    const d = fresh();
    rules.addSetupKeyword(d, 'gym leggings');
    rules.setWriter(d, 'diy', SEED);
    expect(rules.checklist(d).find((c) => c.key === 'ad')).toMatchObject({ done: false, need: 'ad' });
  });

  test('a split that asks for more than the month stops Go', () => {
    const d = fresh();
    rules.addSetupKeyword(d, 'gym leggings');
    rules.setWeek(d, 0, rules.monthlyBudget(d));
    expect(rules.checklist(d).find((c) => c.key === 'money')).toMatchObject({ done: false, need: 'split' });
  });

  test('what it sends opens an account, with the capital live at week four', () => {
    const d = fresh();
    rules.addSetupKeyword(d, 'gym leggings');
    rules.setCapex(d, 'sizeGuide', 2500000);
    const choices = rules.startChoices(d);
    expect(choices.player.capex.pending).toEqual([{ target: 'sizeGuide', paise: 2500000, liveAtRound: 1 + CAPEX_DELAY_ROUNDS }]);
    const state = startGame({ rootSeed: SEED, querySet: QUERY_SET, ...choices });
    expect(state.round).toBe(1);
    expect(state.advertisers[0].id).toBe(BRAND);
  });

  test('a step is done when it has been seen, or when its choice is complete', () => {
    const d = fresh();
    expect(rules.stepsDone(d, new Set())).toEqual({ market: false, position: false, keywords: false, ad: true, money: false });
    rules.addSetupKeyword(d, 'gym leggings');
    expect(rules.stepsDone(d, new Set(['market', 'position', 'money'])))
      .toEqual({ market: true, position: true, keywords: true, ad: true, money: true });
  });
});
