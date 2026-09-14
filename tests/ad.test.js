/**
 * What the weekly Your ad shows, read from the draft without a page. Read-only,
 * as the owner chose on 2026-09-15: the ad is written once, in round 0 (I9).
 */

import { describe, test, expect } from 'vitest';
import { getSelfView } from '../engine/insights.js';
import { DEFAULT_UNGRADED_QUALITY } from '../engine/constants.js';
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
function opened({ writer = 'freelancer', landingPaise = 0, old = false } = {}) {
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

describe('it reads only the player\'s own account', () => {
  test('the model holds nothing but the ad, the writer, the grades and the page', () => {
    expect(Object.keys(read(opened())).sort())
      .toEqual(['descriptions', 'domain', 'grades', 'headlines', 'name', 'page', 'week', 'writer']);
  });
});
