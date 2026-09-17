/**
 * What the weekly Your ad shows, read from the draft without a page. Read-only,
 * as the owner chose on 2026-09-15: the ad is written once, in round 0 (I9).
 */

import { describe, test, expect } from 'vitest';
import { getSelfView } from '../engine/insights.js';
import { DEFAULT_UNGRADED_QUALITY, TOTAL_ROUNDS, CAPEX_DELAY_ROUNDS } from '../engine/constants.js';
import { landingPageBonus, capexEffect } from '../engine/positions.js';
import { QUERY_SET } from '../content/querySet.js';
import { writerTier } from '../content/writers.js';
import { startGame } from '../setup.js';
import { createDraft, effectiveGrades } from '../ui/decisions.js';
import * as r0 from '../ui/roundzero/rules.js';
import { adModel, worthShape, GRADE_TOP, DRAWN_RUNGS } from '../ui/ad/read.js';
import { PAGE_FEATURES } from '../ui/landing-page.js';
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

/** The top rung, the whole of CAPEX_LANDING_PAGE_MAX_POINTS. */
const TOP_RUNG_PAISE = 8000000;
/** The same game with its page graded differently on its own words. */
const gradedAt = (game, landingPage) => ({
  ...game, draft: { ...game.draft, gradedQuality: { ...game.draft.gradedQuality, landingPage } },
});
/** The landing page grade the auction runs on in `round`, capped as it caps it. */
const auctionGrade = (draft, round) => effectiveGrades({ ...draft, round }).landingPage;
/** The same account with no capital on anything. */
const bare = (draft) => ({ ...draft, capexBlock: {} });

/** The week capital committed in the week-5 window goes live. */
const WEEK_FIVE_LIVE = 5 + CAPEX_DELAY_ROUNDS;
/**
 * The same game with more capital committed on `target` in the week-5 window,
 * in the shape a played game holds it (measured on the dev server: a second
 * pending tranche, live at week 8, beside the round-0 one).
 */
const andAtWeekFive = (game, paise, target = 'landingPage') => {
  const block = game.draft.capexBlock;
  return { ...game, draft: { ...game.draft, capexBlock: {
    ...block,
    committed: { ...block.committed, [target]: (block.committed[target] ?? 0) + paise },
    pending: [...block.pending, { target, paise, liveAtRound: WEEK_FIVE_LIVE }],
  } } };
};

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
 * CAPITAL REACHES THE LANDING PAGE GRADE BY TWO ROADS, and this describe was
 * first written knowing only one.
 *
 * 073e05f read `landingPageBonus`, found it reads the `landingPage` target
 * alone, and put on screen that "only the page itself moves the grade" and that
 * a size guide and photography are "neither worth a point of Quality Score".
 * That was false. Round 0 writes the page's description from ALL the capital
 * (`composeDescription`), and the grader scores that description from week 1:
 * a point for being described at all, a point for mentioning size, a point for
 * reviews (agents/grader.js, LANDING_RULES). Measured through a real round 0,
 * marlow, seed 20260902: nothing grades 5, a ₹25,000 size guide 7, ₹50,000 of
 * photography 6, ₹25,000 on the page 6. The size guide is worth more grade than
 * the same money on the page. The owner asked for a round-0 warning that ₹25,000
 * on the page moves nothing, and measuring that before building it found this.
 *
 * So a row's `points` is named for what it is — the SITE WORK's points, from
 * `landingPageBonus`, which only the page earns — and the screen no longer says
 * the other two leave the grade alone. How the description's points should be
 * shown is being designed (the owner's choice, 2026-09-16).
 */
describe('what each thing bought for the page actually moves', () => {
  const find = (parts, target) => parts.find((p) => p.target === target);

  test('the size guide and photography move the grade too, through the page description', () => {
    const grade = (game) => effectiveGrades(game.draft).landingPage;
    const nothing = grade(opened());
    expect(grade(opened({ guidePaise: 2500000 })), 'a size chart is a sentence the grader rewards twice')
      .toBe(nothing + 2);
    expect(grade(opened({ photoPaise: 5000000 })), 'product shots lengthen the description').toBe(nothing + 1);
    expect(grade(opened({ landingPaise: 2500000 })), 'and so does a faster page, though its site work adds nothing')
      .toBe(nothing + 1);
    // From week 1, before any of that work is live: the description counts at once.
    const guide = opened({ guidePaise: 2500000 });
    expect(effectiveGrades({ ...guide.draft, round: 1 }).landingPage).toBe(nothing + 2);
  });

  test('the page itself adds site-work points, by what the auction gains', () => {
    const game = opened({ landingPaise: PAGE_RUNG_PAISE });
    const live = game.draft.capexBlock.pending[0].liveAtRound;
    const page = find(read(game, live).page.parts, 'landingPage');
    expect(page.moves).toBe('grade');
    expect(page.points).toBe(auctionGrade(game.draft, live) - auctionGrade(bare(game.draft), live));
    expect(page.points).toBeGreaterThan(0);
  });

  /**
   * The auction caps the landing page grade at 10 (round.js, `withLandingBonus`),
   * and so does every other screen that shows it (`effectiveGrades`). This row
   * added capital's points without the cap, so a page graded 9 with the top rung
   * read "+3 on the landing page grade" and the auction gained 1. It only bites
   * the player who writes a strong page AND invests in it — the one doing it well.
   */
  test('a strong page is not credited with points the cap takes away', () => {
    const game = gradedAt(opened({ landingPaise: TOP_RUNG_PAISE }), 9);
    const live = game.draft.capexBlock.pending[0].liveAtRound;
    expect(landingPageBonus(game.draft.capexBlock, live), 'the rung is worth more than the cap allows').toBe(3);
    const before = find(read(game, live - 1).page.parts, 'landingPage');
    const after = find(read(game, live).page.parts, 'landingPage');
    expect(before.points).toBe(1);
    expect(before.now).toBe(0);
    expect(after.points).toBe(1);
    expect(after.now).toBe(1);
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

  test('the size guide moves returns, and earns no site-work points', () => {
    const game = opened({ landingPaise: PAGE_RUNG_PAISE, guidePaise: 2500000 });
    const live = Math.max(...game.draft.capexBlock.pending.map((p) => p.liveAtRound));
    const guide = find(read(game, live).page.parts, 'sizeGuide');
    expect(guide.moves).toBe('returns');
    expect(guide.points).toBe(0);
    expect(guide.lift).toBeCloseTo(capexEffect(2500000, 'sizeGuide'), 10);
    expect(guide.lift).toBeGreaterThan(1);
  });

  test('photography moves conversions, and earns no site-work points', () => {
    const game = opened({ landingPaise: PAGE_RUNG_PAISE, photoPaise: 5000000 });
    const live = Math.max(...game.draft.capexBlock.pending.map((p) => p.liveAtRound));
    const shots = find(read(game, live).page.parts, 'photography');
    expect(shots.moves).toBe('conversions');
    expect(shots.points).toBe(0);
    expect(shots.lift).toBeCloseTo(capexEffect(5000000, 'photography'), 10);
    expect(shots.lift).toBeGreaterThan(1);
  });

  test('only the page earns site-work points, whatever is bought', () => {
    const game = opened({ landingPaise: PAGE_RUNG_PAISE, guidePaise: 2500000, photoPaise: 5000000 });
    const live = Math.max(...game.draft.capexBlock.pending.map((p) => p.liveAtRound));
    const { parts } = read(game, live).page;
    expect(parts.filter((p) => p.points > 0).map((p) => p.target)).toEqual(['landingPage']);
    // And they are the whole of the site work's gain, not a share of it.
    expect(find(parts, 'landingPage').points).toBe(auctionGrade(game.draft, live) - auctionGrade(bare(game.draft), live));
  });

  /**
   * THE WEEK IS THE WEEK THE GRADE MOVES, not the week the last purchase lands
   * (the owner's choice, 2026-09-16). A row used to name the latest tranche
   * still pending, so ₹55,000 at round 0 and ₹25,000 more at week 5, on a page
   * graded 8, read "+2 · live from week 8" at week 6 — when the whole +2 had
   * arrived at week 4 and the cap left the ₹25,000 nothing to add. The grades
   * card above it already said the right week (`firstChange`); the row did not.
   */
  describe('the week the grade actually moves', () => {
    const page = (game, week) => find(read(game, week).page.parts, 'landingPage');
    /** Each week the auction's grade changes after `week`, and by how much: the rule itself. */
    const movesAfter = (draft, week) => Array.from({ length: TOTAL_ROUNDS - week }, (_, i) => week + 1 + i)
      .filter((w) => auctionGrade(draft, w) !== auctionGrade(draft, w - 1))
      .map((w) => ({ week: w, points: auctionGrade(draft, w) - auctionGrade(draft, w - 1) }));

    test('one step to come, with nothing live yet: its week, and the whole gain', () => {
      const game = gradedAt(opened({ landingPaise: PAGE_RUNG_PAISE }), 5);
      const live = game.draft.capexBlock.pending[0].liveAtRound;
      const row = page(game, 1);
      expect(row.steps).toEqual([{ week: live, points: row.points }]);
      expect(row.points).toBeGreaterThan(0);
      expect(row.now).toBe(0);
    });

    // NO REAL GAME REACHES THIS: the second window is week 5, and by then the
    // first purchase went live at week 4, so one step has always been taken. It
    // holds the rule in general — every move still to come, adding up to the
    // whole — which the case a player does meet (the next test) is a part of.
    test('a page that steps twice lists both, and they add up to what it buys', () => {
      const game = andAtWeekFive(gradedAt(opened({ landingPaise: PAGE_RUNG_PAISE }), 5), 2500000);
      const row = page(game, 1);
      expect(row.steps.map((s) => s.week)).toEqual([game.draft.capexBlock.pending[0].liveAtRound, WEEK_FIVE_LIVE]);
      expect(row.steps).toEqual(movesAfter(game.draft, 1));
      expect(row.steps.reduce((sum, s) => sum + s.points, 0)).toBe(row.points);
    });

    test('a step already taken is not listed again, and what is live is counted', () => {
      const game = andAtWeekFive(gradedAt(opened({ landingPaise: PAGE_RUNG_PAISE }), 5), 2500000);
      const row = page(game, 6);
      expect(row.steps).toEqual([{ week: WEEK_FIVE_LIVE, points: row.points - row.now }]);
      expect(row.now).toBeGreaterThan(0);
    });

    test('a purchase the cap swallows moves no week, though it is still being built', () => {
      const game = andAtWeekFive(gradedAt(opened({ landingPaise: PAGE_RUNG_PAISE }), 8), 2500000);
      const early = page(game, 1);
      expect(early.steps.map((s) => s.week)).toEqual([game.draft.capexBlock.pending[0].liveAtRound]);
      const late = page(game, 6);
      expect(late.week, 'the site work is still landing').toBe(WEEK_FIVE_LIVE);
      expect(late.steps, 'but the grade has finished moving').toEqual([]);
      expect(late.now).toBe(late.points);
    });

    test('the week a step lands, it is live, not to come', () => {
      const game = gradedAt(opened({ landingPaise: PAGE_RUNG_PAISE }), 5);
      const live = game.draft.capexBlock.pending[0].liveAtRound;
      expect(page(game, live).steps).toEqual([]);
      expect(page(game, live - 1).steps.map((s) => s.week)).toEqual([live]);
    });

    test('the size guide and photography have no grade to step', () => {
      const game = opened({ landingPaise: PAGE_RUNG_PAISE, guidePaise: 2500000, photoPaise: 5000000 });
      const { parts } = read(game, 1).page;
      expect(find(parts, 'sizeGuide').steps).toEqual([]);
      expect(find(parts, 'photography').steps).toEqual([]);
    });
  });

  test('a target with nothing spent on it says what it would move', () => {
    const game = opened({ landingPaise: PAGE_RUNG_PAISE });
    const shots = find(read(game).page.parts, 'photography');
    expect(shots).toMatchObject({ target: 'photography', paise: 0, bought: false, moves: 'conversions' });
  });
});

/**
 * WHAT THE DRAWN PAGE SHOWS IS THE RUNG THAT IS LIVE (the owner, 2026-09-16:
 * "show when the page goes live"). The stars are the reviews rung and the chart
 * is the size guide's first rung (ui/landing-page.js, PAGE_FEATURES). The page
 * used to draw both once EVERY tranche on the target had landed, whatever rung
 * was live, which went wrong both ways: ₹55,000 then ₹25,000 hid reviews bought
 * and live since week 4 until week 8, and ₹25,000 alone — a page that loads
 * faster and has no reviews — was drawn with review stars.
 */
describe('what the drawn page shows', () => {
  const drawnAt = (game, week) => read(game, week).page.drawn;
  const weeks = (game, key) => Array.from({ length: TOTAL_ROUNDS }, (_, i) => drawnAt(game, i + 1)[key]);
  const liveFrom = (week) => Array.from({ length: TOTAL_ROUNDS }, (_, i) => i + 1 >= week);
  const round0Live = (game) => game.draft.capexBlock.pending[0].liveAtRound;

  test('the rungs it draws are rungs the page can have', () => {
    expect(PAGE_FEATURES.landingPage.map((t) => t.label)).toContain(DRAWN_RUNGS.stars.label);
    expect(DRAWN_RUNGS.stars.target).toBe('landingPage');
    expect(PAGE_FEATURES.sizeGuide.map((t) => t.label)).toContain(DRAWN_RUNGS.sizeChart.label);
    expect(DRAWN_RUNGS.sizeChart.target).toBe('sizeGuide');
  });

  test('reviews bought at round 0 and more at week 5: the stars from week 4, when the reviews go live', () => {
    const game = andAtWeekFive(opened({ landingPaise: PAGE_RUNG_PAISE }), 2500000);
    expect(weeks(game, 'stars')).toEqual(liveFrom(round0Live(game)));
  });

  test('a faster page first and reviews at week 5: no stars until the reviews rung lands', () => {
    const game = andAtWeekFive(opened({ landingPaise: 2500000 }), 5500000);
    expect(weeks(game, 'stars')).toEqual(liveFrom(WEEK_FIVE_LIVE));
  });

  test('a page that bought speed and no reviews is never drawn with review stars', () => {
    const game = opened({ landingPaise: 2500000 });
    expect(weeks(game, 'stars').some(Boolean)).toBe(false);
  });

  test('the top rung includes reviews, from the week it lands', () => {
    const game = opened({ landingPaise: TOP_RUNG_PAISE });
    expect(weeks(game, 'stars')).toEqual(liveFrom(round0Live(game)));
  });

  test('a size guide bought in two halves shows its chart from the first, not the second', () => {
    const game = andAtWeekFive(opened({ guidePaise: 2500000 }), 2500000, 'sizeGuide');
    expect(weeks(game, 'sizeChart')).toEqual(liveFrom(round0Live(game)));
  });

  test('nothing bought, nothing drawn', () => {
    const game = opened();
    expect(weeks(game, 'stars').some(Boolean)).toBe(false);
    expect(weeks(game, 'sizeChart').some(Boolean)).toBe(false);
  });
});

/** The chart: the grade the auction runs on, week by week. */
describe('what the page is worth, week by week', () => {
  // The chart is titled "the landing page grade the auction uses", so that is
  // the whole of the rule: each week is the grade `effectiveGrades` gives it.
  test('each week is the grade the auction runs on that week', () => {
    const game = opened({ landingPaise: PAGE_RUNG_PAISE });
    const weeks = read(game).page.worth;
    expect(weeks).toHaveLength(TOTAL_ROUNDS);
    for (const { round, value } of weeks) expect(value, `week ${round}`).toBe(auctionGrade(game.draft, round));
  });

  test('it steps the week the site work goes live, and nowhere else', () => {
    const game = opened({ landingPaise: PAGE_RUNG_PAISE });
    const live = game.draft.capexBlock.pending[0].liveAtRound;
    const graded = game.draft.gradedQuality.landingPage;
    for (const { round, value } of read(game).page.worth) {
      expect(value, `week ${round}`).toBe(round < live ? graded : auctionGrade(game.draft, live));
    }
  });

  /**
   * Played with ₹80,000 on a page graded 8, the step chart drew weeks 8-12 at 11,
   * above its own 10. The data added capital's points with no cap, and the old
   * bars hid it. It also worked the page's own grade out BACKWARDS, from this
   * week's capped figure, so once the cap bit, the weeks before the step came
   * out low as well: a page graded 9 read 7.
   */
  test('a strong page never charts above the top of its scale, nor below its own grade', () => {
    const game = gradedAt(opened({ landingPaise: TOP_RUNG_PAISE }), 9);
    const live = game.draft.capexBlock.pending[0].liveAtRound;
    const weeks = read(game, live + 1).page.worth;
    for (const { round, value } of weeks) {
      expect(value, `week ${round}`).toBeLessThanOrEqual(GRADE_TOP);
      expect(value, `week ${round}`).toBe(round < live ? 9 : GRADE_TOP);
    }
  });

  test('a page with no capital never moves', () => {
    const weeks = read(opened()).page.worth;
    expect(new Set(weeks.map((w) => w.value)).size).toBe(1);
  });
});

/**
 * The chart's geometry, worked out here rather than in the drawing module, so
 * that the two promises it makes can be held by a test instead of by eye: the
 * scale is never cut short, and a step is drawn on the week the grade actually
 * steps. A chart that starts its scale at seven makes a two-point gain look
 * like a fourfold one, which is the oldest way to mislead with a picture, and
 * this game is worth nothing if it teaches something false.
 */
describe('the shape the worth chart is drawn from', () => {
  const flat = (value) => Array.from({ length: TOTAL_ROUNDS }, (_, i) => ({ round: i + 1, value }));
  const steps = (...at) => flat(0).map(({ round }) => ({
    round, value: at.reduce((v, [week, points]) => (round >= week ? v + points : v), 8),
  }));

  test('the scale runs from nothing to the whole grade, never from part way up', () => {
    const shape = worthShape(steps([4, 2]), GRADE_TOP);
    expect(shape.baseline).toBe(0);
    expect(shape.top).toBe(GRADE_TOP);
    // A grade of 8 stands 8/10 of the way up, which is only true of a full scale.
    expect(shape.weeks[0].y).toBeCloseTo(0.8, 10);
    expect(shape.weeks.at(-1).y).toBeCloseTo(1, 10);
  });

  test('every week of the game is a reading, in order', () => {
    const shape = worthShape(steps([4, 2]), GRADE_TOP);
    expect(shape.weeks).toHaveLength(TOTAL_ROUNDS);
    expect(shape.weeks.map((w) => w.round)).toEqual(flat(0).map((w) => w.round));
    // Each sits in the middle of its own band, so twelve weeks share the width.
    expect(shape.weeks[0].mid).toBeCloseTo(0.5 / TOTAL_ROUNDS, 10);
    expect(shape.weeks.at(-1).mid).toBeCloseTo((TOTAL_ROUNDS - 0.5) / TOTAL_ROUNDS, 10);
  });

  test('a riser stands where the grade steps, and carries what it gained', () => {
    const shape = worthShape(steps([4, 2]), GRADE_TOP);
    expect(shape.risers).toHaveLength(1);
    const [riser] = shape.risers;
    expect(riser.round).toBe(4);
    expect(riser.points).toBe(2);
    // At the START of week four's band: the grade is 8 through week three.
    expect(riser.at).toBeCloseTo(3 / TOTAL_ROUNDS, 10);
    expect(riser.from).toBeCloseTo(0.8, 10);
    expect(riser.to).toBeCloseTo(1, 10);
  });

  /**
   * Capital has two windows, round 1 and week 5 (`capexAllocationRounds`), so a
   * player who buys the page twice can step twice. Measured on the rungs a
   * player can pick: ₹55,000 then ₹25,000 more adds 0/0/0/2/2/2/2/3/3/3/3/3.
   * The other order steps once: ₹25,000 alone rounds to no points at all.
   * The chart drew one step until this test, which is why the note beside it
   * named a single week and the wrong number of points.
   */
  test('a page bought twice steps twice', () => {
    const shape = worthShape(steps([4, 1], [8, 2]), GRADE_TOP);
    expect(shape.risers.map((r) => [r.round, r.points])).toEqual([[4, 1], [8, 2]]);
    expect(shape.risers[1].from).toBeCloseTo(0.9, 10);
    expect(shape.risers[1].to).toBeCloseTo(1.1, 10);
  });

  test('a page nothing was spent on has no riser, and one flat run', () => {
    const shape = worthShape(flat(8), GRADE_TOP);
    expect(shape.risers).toEqual([]);
    expect(shape.flats).toHaveLength(1);
    expect(shape.flats[0]).toMatchObject({ from: 0, to: 1 });
  });

  test('the flat runs cover the whole width and meet at the risers', () => {
    const shape = worthShape(steps([4, 1], [8, 2]), GRADE_TOP);
    expect(shape.flats.map((f) => f.from)).toEqual(shape.flats.map((f, i) => (i === 0 ? 0 : shape.risers[i - 1].at)));
    expect(shape.flats[0].from).toBe(0);
    expect(shape.flats.at(-1).to).toBe(1);
    for (const [i, f] of shape.flats.slice(0, -1).entries()) expect(f.to).toBe(shape.flats[i + 1].from);
  });
});

describe('it reads only the player\'s own account', () => {
  test('the model holds nothing but the ad, the writer, the grades and the page', () => {
    expect(Object.keys(read(opened())).sort())
      .toEqual(['descriptions', 'domain', 'grades', 'headlines', 'name', 'page', 'week', 'writer']);
  });
});
