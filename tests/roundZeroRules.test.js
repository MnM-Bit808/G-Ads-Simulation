/**
 * Round 0's rules, read without a page (plans/2026-09-14-round-zero-redesign.md,
 * section 8). They were lifted out of the classic page so that page and the
 * Studio's steps could not disagree about the account Go opens; the switch-over's
 * part 2 then deleted the page, and the rules stayed where they had moved to.
 */
import { describe, test, expect } from 'vitest';
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

describe('who writes the ad, and whose words are in it (I25, as the owner changed it)', () => {
  // The Studio shows the ad's boxes only when you write it yourself, so a hired
  // writer's ad that kept the player's words (I25's old second rule) sat in the
  // account unseen, and if they broke Google's limits Go stayed blocked with
  // nothing on screen to fix (found playing step 4, 2026-09-14).
  const copyOf = (d, tier) => writerCopyFor(d.cell, tier, BRAND_IDENTITIES[1].name, SEED % WRITER_COPY_VARIANTS);
  const typed = () => {
    const d = fresh();
    rules.setWriter(d, 'diy', SEED);
    rules.writeAd(d, 'headlines', 0, 'Squat Proof All Day');
    rules.writeAd(d, 'descriptions', 1, 'Made for heavy lifting days.');
    return d;
  };

  test('a hired writer\'s ad is the writer\'s copy, even after you typed', () => {
    const d = typed();
    rules.setWriter(d, 'agency', SEED);
    expect(d.ad.headlines).toEqual(copyOf(d, 'agency').headlines);
    expect(d.ad.descriptions).toEqual(copyOf(d, 'agency').descriptions);
    expect(d.adIsSeeded).toBe(true);
  });

  test('your words are set aside, not lost, and come back when you write again', () => {
    const d = typed();
    rules.setWriter(d, 'agency', SEED);
    rules.setWriter(d, 'retainer', SEED);
    rules.setWriter(d, 'diy', SEED);
    expect(d.ad.headlines).toEqual(['Squat Proof All Day', '', '']);
    expect(d.ad.descriptions).toEqual(['', 'Made for heavy lifting days.']);
    expect(d.adIsSeeded).toBe(false);
  });

  test('with nothing of yours set aside, writing it yourself opens empty boxes', () => {
    const d = fresh();
    rules.setWriter(d, 'diy', SEED);
    expect(d.ad.headlines).toEqual(['', '', '']);
    expect(d.ad.descriptions).toEqual(['', '']);
  });

  test('what comes back is what you last wrote, blank boxes included', () => {
    const d = typed();
    rules.setWriter(d, 'freelancer', SEED);
    rules.setWriter(d, 'diy', SEED);
    rules.writeAd(d, 'headlines', 0, '');
    rules.writeAd(d, 'descriptions', 1, '');
    rules.setWriter(d, 'freelancer', SEED);
    rules.setWriter(d, 'diy', SEED);
    expect(d.ad.headlines).toEqual(['', '', '']);
    expect(d.ad.descriptions).toEqual(['', '']);
  });

  test('changing the square while you write keeps your words', () => {
    const d = typed();
    rules.setCell(d, 'value|lifestyle', SEED);
    expect(d.ad.headlines[0]).toBe('Squat Proof All Day');
  });

  test('the classic page\'s draft, which never had a place to set words aside, works the same', () => {
    // ui/round-zero.js builds its own draft and calls syncWriterCopy directly.
    const d = { playerBrandId: BRAND, cell: 'mid|performance', writerTier: 'diy', adIsSeeded: false,
      ad: { headlines: ['Mine', '', ''], descriptions: ['', ''], landingPageDescription: '' } };
    d.writerTier = 'agency';
    rules.syncWriterCopy(d, SEED);
    expect(d.ad.headlines).toEqual(copyOf(d, 'agency').headlines);
    d.writerTier = 'diy';
    rules.syncWriterCopy(d, SEED);
    expect(d.ad.headlines).toEqual(['Mine', '', '']);
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
    // The landing page's timing was the spec's open question (section 12), and
    // this test said it would change with it. The owner settled it on 2026-09-17:
    // grade the page as it stands. So nothing round 0 commits is on the page in
    // week 1, and from week 4 the page grades as it used to from week 1 — reviews
    // 7 plus the site work's 2, the top page 7 plus 3, a size chart 7 — which
    // step 5 now draws as a second bar where it used to draw one.
    //
    // Since grading only what Google names (C, 2026-09-17) a size chart alone is
    // 6: its 7 held a point for running the page past 40 characters. Product
    // shots alone, which earned that point and nothing else, draw no second bar.
    expect(grade({})).toMatchObject({ fromWeek1: 5, fromWeek4: 5 });
    expect(grade({ landingPage: 5500000 })).toMatchObject({ fromWeek1: 5, fromWeek4: 8 });
    // 9, not 10, since I40: the page's own money is worth two points, so the top
    // rung alone no longer reaches the top of the scale.
    expect(grade({ landingPage: 8000000 })).toMatchObject({ fromWeek1: 5, fromWeek4: 9 });
    expect(grade({ sizeGuide: 2500000 })).toMatchObject({ fromWeek1: 5, fromWeek4: 6 });
    expect(grade({ photography: 5000000 })).toMatchObject({ fromWeek1: 5, fromWeek4: 5 });
    expect(grade({ landingPage: 2500000 })).toMatchObject({ fromWeek1: 5, fromWeek4: 6 });
  });

  test('it never falls when the site goes live, and never passes ten', () => {
    for (const page of [0, 2500000, 5500000, 8000000]) {
      const { fromWeek1, fromWeek4, liveAt } = grade({ landingPage: page });
      expect(fromWeek4).toBeGreaterThanOrEqual(fromWeek1);
      expect(fromWeek4).toBeLessThanOrEqual(10);
      expect(liveAt).toBe(1 + CAPEX_DELAY_ROUNDS);
    }
  });

  /**
   * WHERE THE SECOND BAR COMES FROM (the owner, 2026-09-18). The size guide card
   * said it moves parcels sent back while the bar beside it rose, and nothing on
   * the screen said which purchase had moved it. The grade now carries its parts,
   * by the purchase that earns them, from the same `pagePoints` Your ad reads.
   */
  describe('and it says which purchase earned it', () => {
    const partsOf = (capex) => grade(capex).parts.map((p) => [p.target, p.points]);

    test('each purchase that earns a point is named, and those that earn none are left out', () => {
      expect(partsOf({})).toEqual([]);
      expect(partsOf({ sizeGuide: 2500000 })).toEqual([['sizeGuide', 1]]);
      expect(partsOf({ photography: 5000000 }), 'product shots earn nothing since I38').toEqual([]);
      // The page's own points are one part: speed, reviews and the site work.
      expect(partsOf({ landingPage: 5500000 })).toEqual([['landingPage', 3]]);
      expect(partsOf({ landingPage: 5500000, sizeGuide: 2500000 })).toEqual([['landingPage', 3], ['sizeGuide', 1]]);
    });

    test('the parts add up to the bar, from the start, and say when the cap takes one', () => {
      for (const capex of [{}, { sizeGuide: 2500000 }, { landingPage: 5500000, sizeGuide: 2500000 }]) {
        const g = grade(capex);
        expect(g.start + g.parts.reduce((sum, p) => sum + p.points, 0), JSON.stringify(capex)).toBe(g.total);
        expect(g.total, JSON.stringify(capex)).toBe(g.fromWeek4);
        expect(g.capped).toBe(false);
      }
      // SINCE I40 NOTHING IS CAPPED. The top page and a size chart used to earn
      // 11 and have one taken back; they now earn exactly 10, so the openly
      // shown cap (the owner, 2026-09-17) has nothing left to show. The
      // machinery stays — it is what would surface the fault returning.
      const best = grade({ landingPage: 8000000, sizeGuide: 2500000 });
      expect(best.parts).toEqual([{ target: 'landingPage', points: 4 }, { target: 'sizeGuide', points: 1 }]);
      expect(best).toMatchObject({ start: 5, total: 10, capped: false, fromWeek4: 10 });
    });
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
    // Round 0 has no week to have changed from: no outline, no switch.
    expect(phrase).toMatchObject({ id: 'gym leggings', isNew: true, stats: null, active: null, changed: false });
  });

  test('a bid under the reserve says what it needs, and a bid over it says nothing', () => {
    const d = fresh();
    rules.addSetupKeyword(d, 'gym leggings', { bidPaise: MIN_BID_PAISE });
    rules.addSetupKeyword(d, 'sports bra');
    const [low, ok] = rules.setupKeywordCards(d, QUERY_SET);
    expect(low.needPaise).toBeGreaterThan(MIN_BID_PAISE);
    expect(ok.needPaise).toBeNull();
  });

  test('a card worked out alone is the same card worked out with the rest', () => {
    // A drag redraws one card, so step 3 works out that card alone: all of
    // them cost 14ms a step with sixty keywords (makeover Task 10).
    const d = fresh();
    rules.addSetupKeyword(d, 'gym leggings', { bidPaise: MIN_BID_PAISE });
    rules.addSetupKeyword(d, 'sports bra', { matchType: 'broad' });
    rules.addSetupKeyword(d, 'squat proof leggings india');
    const all = rules.setupKeywordCards(d, QUERY_SET);
    for (const keyword of d.keywords) {
      const [alone] = rules.setupKeywordCards({ ...d, keywords: [keyword] }, QUERY_SET);
      expect(alone).toEqual(all.find((c) => c.id === keyword.text));
    }
  });

  test('what it says it needs is a whole-rupee bid that clears, and a rupee less does not', () => {
    // Bids are slid and typed in rupees, and a figure shown to the nearest rupee
    // could be one that fails: ₹6.02 showed as "needs ₹6" to a bid of ₹6.
    const d = fresh();
    rules.addSetupKeyword(d, 'gym leggings', { bidPaise: MIN_BID_PAISE });
    const exact = rules.openingReserve(d, QUERY_SET).rows[0].needPaise;
    const [card] = rules.setupKeywordCards(d, QUERY_SET);
    expect(card.needPaise % 100).toBe(0);
    expect(card.needPaise).toBeGreaterThanOrEqual(exact);
    expect(card.needPaise - 100).toBeLessThan(exact);
  });

  test('removing takes it out', () => {
    const d = fresh();
    rules.addSetupKeyword(d, 'gym leggings');
    expect(rules.removeSetupKeyword(d, 'gym leggings').ok).toBe(true);
    expect(d.keywords).toEqual([]);
  });
});

describe('guesses are the player\'s notes: never in the account, kept for the reveal', () => {
  test('tapping a square notes it, tapping it again takes it back', () => {
    const d = fresh();
    rules.setGuess(d, 'Marlow', 'value|lifestyle');
    expect(rules.guessedIn(d, 'value|lifestyle')).toEqual(['Marlow']);
    rules.setGuess(d, 'Marlow', 'value|lifestyle');
    expect(rules.guessedIn(d, 'value|lifestyle')).toEqual([]);
  });

  test('the account Go opens holds no guess', () => {
    const d = fresh();
    rules.setGuess(d, 'Marlow', 'value|lifestyle');
    expect(JSON.stringify(rules.startChoices(d))).not.toContain('Marlow');
  });

  test('they are kept by rival, for the reveal after the last week (the owner, 2026-09-15)', () => {
    // The reveal scores what the player read from the ads before the first
    // auction; asked again at the end, a player guesses with twelve weeks of
    // meeting them in auctions behind them. Kept by id, because the game's
    // records name rivals by id, and only for the rivals of the game Go opened.
    const d = fresh();
    rules.addSetupKeyword(d, 'gym leggings');
    const state = startGame({ ...rules.startChoices(d), rootSeed: SEED, querySet: QUERY_SET });
    const [first, second] = state.advertisers.filter((a) => a.id !== d.playerBrandId);
    const you = state.advertisers.find((a) => a.id === d.playerBrandId);
    rules.setGuess(d, first.name, 'value|lifestyle');
    rules.setGuess(d, second.name, 'premium|performance');
    rules.setGuess(d, you.name, 'mid|performance');
    rules.setGuess(d, 'Nobody Here', 'mid|lifestyle');
    expect(rules.notesFor(d.guesses, state.advertisers, d.playerBrandId))
      .toEqual({ [first.id]: 'value|lifestyle', [second.id]: 'premium|performance' });
  });
});

describe('choosing the brand (I35, reopened by the owner 2026-09-15)', () => {
  const other = BRAND_IDENTITIES.find((b) => b.id !== BRAND);
  const adText = (ad) => JSON.stringify([ad.headlines, ad.descriptions]);

  test('the brand left becomes a rival, and the brand taken stops being one', () => {
    const d = fresh();
    rules.setBrand(d, other.id, SEED, QUERY_SET);
    expect(d.playerBrandId).toBe(other.id);
    const names = rules.rivalAds(SEED, d.playerBrandId, QUERY_SET).map((a) => a.name);
    expect(names).toContain(BRAND_IDENTITIES[1].name);
    expect(names).not.toContain(other.name);
  });

  test('a note stays on the ad it was made about, whoever wears that ad now', () => {
    // Rivals are dealt around the player in the brands' fixed order, so a
    // different brand moves several names onto different ads (up to seven of
    // the eight). The notes are readings of ads, so they follow the ads.
    const cells = rules.positionMatrix().rows.flatMap((row) => row.cells.map((c) => c.key));
    const before = rules.rivalAds(SEED, BRAND, QUERY_SET);
    for (const target of BRAND_IDENTITIES.filter((b) => b.id !== BRAND)) {
      const d = fresh();
      before.forEach((rival, i) => rules.setGuess(d, rival.name, cells[i % cells.length]));
      const noteOn = new Map(before.map((rival) => [adText(rival.ad), d.guesses[rival.name]]));
      rules.setBrand(d, target.id, SEED, QUERY_SET);
      const after = rules.rivalAds(SEED, target.id, QUERY_SET);
      expect(Object.keys(d.guesses).sort(), target.id).toEqual(after.map((r) => r.name).sort());
      for (const rival of after) expect(d.guesses[rival.name], `${target.id} ${rival.name}`).toBe(noteOn.get(adText(rival.ad)));
    }
  });

  test('a hired writer\'s copy is written again for the new name', () => {
    const d = fresh();
    rules.setBrand(d, other.id, SEED, QUERY_SET);
    const copy = writerCopyFor(d.cell, d.writerTier, other.name, SEED % WRITER_COPY_VARIANTS);
    expect(d.ad.headlines).toEqual(copy.headlines);
    expect(d.ad.descriptions).toEqual(copy.descriptions);
  });

  test('words the player wrote are left as they are', () => {
    const d = fresh();
    rules.setWriter(d, 'diy', SEED);
    rules.writeAd(d, 'headlines', 0, 'Squat Proof All Day');
    rules.setBrand(d, other.id, SEED, QUERY_SET);
    expect(d.ad.headlines).toEqual(['Squat Proof All Day', '', '']);
  });

  test('a name that is not one of the nine is refused, and nothing changes', () => {
    const d = fresh();
    rules.setGuess(d, rules.rivalAds(SEED, BRAND, QUERY_SET)[0].name, 'value|lifestyle');
    const kept = JSON.stringify(d);
    expect(() => rules.setBrand(d, 'budgetbox', SEED, QUERY_SET)).toThrow(RangeError);
    expect(JSON.stringify(d)).toBe(kept);
  });

  test('each name comes with a search of its own, counted as the planner counts it', () => {
    const planner = rules.researchList(QUERY_SET);
    for (const brand of BRAND_IDENTITIES) {
      const own = rules.ownSearch(brand.id, QUERY_SET);
      expect(own.intent, brand.id).toBe('brand');
      expect(own.text, brand.id).toContain(brand.name.split(' ')[0].toLowerCase());
      expect(own.weekly, brand.id).toBe(planner.find((q) => q.id === own.id).weekly);
    }
    expect(new Set(BRAND_IDENTITIES.map((b) => rules.ownSearch(b.id, QUERY_SET).id)).size).toBe(9);
  });

  test('Go opens the account under the name chosen', () => {
    const d = fresh();
    rules.setBrand(d, other.id, SEED, QUERY_SET);
    rules.addSetupKeyword(d, 'gym leggings');
    const state = startGame({ rootSeed: SEED, querySet: QUERY_SET, ...rules.startChoices(d) });
    expect(state.advertisers[0].id).toBe(other.id);
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
