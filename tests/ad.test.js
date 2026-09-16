/**
 * What the weekly Your ad shows, read from the draft without a page. Read-only,
 * as the owner chose on 2026-09-15: the ad is written once, in round 0 (I9).
 */

import { describe, test, expect } from 'vitest';
import { getSelfView } from '../engine/insights.js';
import { DEFAULT_UNGRADED_QUALITY, TOTAL_ROUNDS } from '../engine/constants.js';
import { landingPageBonus, capexEffect } from '../engine/positions.js';
import { QUERY_SET } from '../content/querySet.js';
import { writerTier } from '../content/writers.js';
import { startGame } from '../setup.js';
import { createDraft, effectiveGrades } from '../ui/decisions.js';
import * as r0 from '../ui/roundzero/rules.js';
import { adModel } from '../ui/ad/read.js';
import { asOldSave, OLD_SAVE_LIVE_ROUND } from './fixtures/oldSave.js';

const SEED = 20260902;
const PAGE_RUNG_PAISE = 5500000;

/** A game opened from round 0, as the Studio's Go opens one. */
function opened({ writer = 'freelancer', landingPaise = 0, guidePaise = 0, photoPaise = 0, old = false } = {}) {
  const setup = r0.createSetupDraft({ playerBrandId: 'marlow', rootSeed: SEED });
  r0.addSetupKeyword(setup, 'gym leggings');
  if (writer !== 'freelancer') r0.setWriter(setup, writer, SEED);
  if (writer === 'diy') {
    ['Squat Proof Leggings', 'Made For Heavy Lifts', 'Free Delivery In India']
      .forEach((text, i) => r0.writeAd(setup, 'headlines', i, text));
    ['Leggings that stay put through every squat and lunge.', 'Order today for free delivery and easy returns.']
      .forEach((text, i) => r0.writeAd(setup, 'descriptions', i, text));
  }
  if (landingPaise) r0.setCapex(setup, 'landingPage', landingPaise);
  if (guidePaise) r0.setCapex(setup, 'sizeGuide', guidePaise);
  if (photoPaise) r0.setCapex(setup, 'photography', photoPaise);
  const fresh = startGame({ rootSeed: SEED, querySet: QUERY_SET, ...r0.startChoices(setup) });
  const state = old ? asOldSave(fresh) : fresh;
  const me = state.advertisers[0];
  const view = getSelfView(state, me.id);
  return { me, view, draft: createDraft(view) };
}

const read = (game, round = null) => adModel({
  draft: round === null ? game.draft : { ...game.draft, round },
  creative: game.me.creative,
  name: game.view.name,
  domain: game.view.domain,
});
const part = (model, key) => model.grades.find((g) => g.key === key);

describe('the ad as searchers see it', () => {
  test('the words the account runs, under the player\'s own name', () => {
    const game = opened();
    const model = read(game);
    expect(model.headlines).toEqual(game.me.adGroups[0].ad.headlines);
    expect(model.descriptions).toEqual(game.me.adGroups[0].ad.descriptions);
    expect([model.name, model.domain]).toEqual([game.view.name, game.view.domain]);
  });
});

describe('who wrote it', () => {
  test('a hired writer, by name and fee', () => {
    const { label, pricePaise } = writerTier('freelancer');
    expect(read(opened()).writer).toEqual({ id: 'freelancer', label, pricePaise, hired: true });
  });

  test('your own words, marked yours', () => {
    expect(read(opened({ writer: 'diy' })).writer).toMatchObject({ id: 'diy', hired: false });
  });
});

describe('the grades', () => {
  test('are the ones the auctions use in the week about to be played', () => {
    const game = opened({ landingPaise: PAGE_RUNG_PAISE });
    const model = read(game);
    expect(model.week).toBe(game.draft.round);
    for (const g of model.grades) expect(g.value, g.key).toBe(effectiveGrades(game.draft)[g.key]);
  });

  test('landing page capital still being built says what it brings, and when', () => {
    const game = opened({ landingPaise: PAGE_RUNG_PAISE });
    const [tranche] = game.draft.capexBlock.pending;
    const landing = part(read(game), 'landingPage');
    const then = effectiveGrades({ ...game.draft, round: tranche.liveAtRound }).landingPage;
    expect(then).toBeGreaterThan(landing.value);
    expect(landing.later).toEqual({ value: then, week: tranche.liveAtRound, why: 'page' });
    expect(part(read(game), 'expectedCtr').later).toBeNull();
  });

  test('once it has gone live, nothing is still to come', () => {
    const game = opened({ landingPaise: PAGE_RUNG_PAISE });
    const [tranche] = game.draft.capexBlock.pending;
    const landing = part(read(game, tranche.liveAtRound), 'landingPage');
    expect(landing.later).toBeNull();
    expect(landing.value).toBe(effectiveGrades({ ...game.draft, round: tranche.liveAtRound }).landingPage);
  });

  test('with no capital on the page, no grade changes', () => {
    for (const g of read(opened()).grades) expect(g.later, g.key).toBeNull();
  });

  test('a save from before 2026-09-14 runs the ungraded ad until its own words go live (I11, I16)', () => {
    const game = opened({ writer: 'diy', old: true });
    const written = game.me.creative.pendingGrade;
    const ctr = part(read(game), 'expectedCtr');
    expect(ctr.value).toBe(DEFAULT_UNGRADED_QUALITY.expectedCtr);
    expect(ctr.later).toEqual({ value: written.expectedCtr, week: OLD_SAVE_LIVE_ROUND, why: 'copy' });
    // The week it lands, the auctions run on the written grade although the
    // state has not applied it yet: game.js lands it as that week runs.
    expect(part(read(game, OLD_SAVE_LIVE_ROUND), 'expectedCtr')).toMatchObject({ value: written.expectedCtr, later: null });
  });
});

describe('the landing page', () => {
  test('the description the grader read', () => {
    const game = opened({ landingPaise: PAGE_RUNG_PAISE });
    expect(read(game).page.description).toBe(game.me.adGroups[0].ad.landingPageDescription);
  });

  test('a part still being built shows what it becomes and the week', () => {
    const game = opened({ landingPaise: PAGE_RUNG_PAISE });
    const [tranche] = game.draft.capexBlock.pending;
    const [strip] = read(game).page.strips;
    expect(strip).toMatchObject({ target: 'landingPage', from: 'plain', label: 'reviews', week: tranche.liveAtRound });
    expect(read(game, tranche.liveAtRound).page.strips[0]).toMatchObject({ label: 'reviews', week: null });
  });

  test('a page with no capital is the plain page, with nothing to come', () => {
    expect(read(opened()).page.strips).toEqual([{ target: 'landingPage', from: null, label: 'plain', week: null }]);
  });
});

/**
 * THREE PURCHASES, THREE DIFFERENT MECHANISMS, and the screen used to imply one.
 *
 * Drawing the page (design/landing-page/, C, the owner's choice 2026-09-16) the
 * mock-up first tagged "+1 reviews" and "+1 size chart", splitting the grade
 * evenly between them. `landingPageBonus` reads the `landingPage` target ALONE:
 * the size guide divides the return rate (`businessFor`, returnRate /
 * sizeGuideEffect) and photography multiplies the conversion rate, and neither
 * touches the grade. A player who buys a size guide for a better Quality Score
 * is buying the wrong thing, and nothing on screen said so.
 *
 * So every figure here is asked of the engine rather than typed: a change to a
 * curve or to CAPEX_LANDING_PAGE_MAX_POINTS moves the screen with it.
 */
describe('what each thing bought for the page actually moves', () => {
  const find = (parts, target) => parts.find((p) => p.target === target);

  test('the page itself moves the grade, by the engine\'s own points', () => {
    const game = opened({ landingPaise: PAGE_RUNG_PAISE });
    const live = game.draft.capexBlock.pending[0].liveAtRound;
    const page = find(read(game, live).page.parts, 'landingPage');
    expect(page.moves).toBe('grade');
    expect(page.points).toBe(landingPageBonus(game.draft.capexBlock, live));
    expect(page.points).toBeGreaterThan(0);
  });

  /**
   * A row says what the purchase BUYS, which is what it buys once live; `now`
   * is what the auction is using today. Read the other way round, a page bought
   * in week 1 says "+0 on the landing page grade · live from week 4" — true,
   * and the opposite of what it means. Found by playing it.
   */
  test('it says what it buys even before the week it goes live, and what it is worth today', () => {
    const game = opened({ landingPaise: PAGE_RUNG_PAISE });
    const live = game.draft.capexBlock.pending[0].liveAtRound;
    const before = find(read(game, live - 1).page.parts, 'landingPage');
    expect(before.points).toBeGreaterThan(0);
    expect(before.now).toBe(0);
    expect(before.week).toBe(live);

    const after = find(read(game, live).page.parts, 'landingPage');
    expect(after.now).toBe(after.points);
    expect(after.week).toBeNull();
  });

  test('the size guide moves returns and claims no grade point', () => {
    const game = opened({ landingPaise: PAGE_RUNG_PAISE, guidePaise: 2500000 });
    const live = Math.max(...game.draft.capexBlock.pending.map((p) => p.liveAtRound));
    const guide = find(read(game, live).page.parts, 'sizeGuide');
    expect(guide.moves).toBe('returns');
    expect(guide.points).toBe(0);
    expect(guide.lift).toBeCloseTo(capexEffect(2500000, 'sizeGuide'), 10);
    expect(guide.lift).toBeGreaterThan(1);
  });

  test('photography moves conversions and claims no grade point', () => {
    const game = opened({ landingPaise: PAGE_RUNG_PAISE, photoPaise: 5000000 });
    const live = Math.max(...game.draft.capexBlock.pending.map((p) => p.liveAtRound));
    const shots = find(read(game, live).page.parts, 'photography');
    expect(shots.moves).toBe('conversions');
    expect(shots.points).toBe(0);
    expect(shots.lift).toBeCloseTo(capexEffect(5000000, 'photography'), 10);
    expect(shots.lift).toBeGreaterThan(1);
  });

  test('only one of them is ever a grade point, whatever is bought', () => {
    const game = opened({ landingPaise: PAGE_RUNG_PAISE, guidePaise: 2500000, photoPaise: 5000000 });
    const live = Math.max(...game.draft.capexBlock.pending.map((p) => p.liveAtRound));
    const { parts } = read(game, live).page;
    expect(parts.filter((p) => p.points > 0).map((p) => p.target)).toEqual(['landingPage']);
    // And the points on screen are the whole bonus, not a share of it.
    expect(find(parts, 'landingPage').points).toBe(landingPageBonus(game.draft.capexBlock, live));
  });

  test('a target with nothing spent on it says what it would move', () => {
    const game = opened({ landingPaise: PAGE_RUNG_PAISE });
    const shots = find(read(game).page.parts, 'photography');
    expect(shots).toMatchObject({ target: 'photography', paise: 0, bought: false, moves: 'conversions' });
  });
});

/** The chart: the grade the auction runs on, week by week. */
describe('what the page is worth, week by week', () => {
  test('it steps the week the site work goes live, and nowhere else', () => {
    const game = opened({ landingPaise: PAGE_RUNG_PAISE });
    const live = game.draft.capexBlock.pending[0].liveAtRound;
    const weeks = read(game).page.worth;
    expect(weeks).toHaveLength(TOTAL_ROUNDS);
    for (const { round, value } of weeks) {
      const graded = game.draft.gradedQuality.landingPage;
      expect(value, `week ${round}`).toBe(graded + landingPageBonus(game.draft.capexBlock, round));
      expect(value, `week ${round}`).toBe(round < live ? graded : graded + landingPageBonus(game.draft.capexBlock, live));
    }
  });

  test('a page with no capital never moves', () => {
    const weeks = read(opened()).page.worth;
    expect(new Set(weeks.map((w) => w.value)).size).toBe(1);
  });
});

describe('it reads only the player\'s own account', () => {
  test('the model holds nothing but the ad, the writer, the grades and the page', () => {
    expect(Object.keys(read(opened())).sort())
      .toEqual(['descriptions', 'domain', 'grades', 'headlines', 'name', 'page', 'week', 'writer']);
  });
});
