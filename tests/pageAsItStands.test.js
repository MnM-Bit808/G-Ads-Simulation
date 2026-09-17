/**
 * THE PAGE AS IT STANDS (the owner's decision, 2026-09-17).
 *
 * The player's page description used to be written once, in round 0, from all
 * the capital committed, and graded from week 1. Measured (kept on branch
 * claude/cranky-montalcini-b7c4de, 87d797e, and again on 2026-09-17): a page
 * bought at round 0 was in the week-1 auctions though its capital went live at
 * week 4, and capital committed at week 5 never reached the description at all.
 * The same money was worth up to three grade points more for being spent early.
 *
 * Now each week the page is re-written from the capital LIVE that week and its
 * landing page grade re-scored (`pageAsItStands`, content/landingPage.js). This file
 * holds the owner's gates that are tests rather than market figures: G3, read
 * from the auctions' own record, and G4, the screen agreeing with it.
 *
 * Read from `qualityHistory` rather than recomputed, so what is compared is the
 * landing page factor the auctions actually ran on.
 */

import { describe, test, expect } from 'vitest';

import { startGame } from '../setup.js';
import { submitRound } from '../game.js';
import { harnessPlayer, PLAYER } from '../scripts/market-harness.js';
import { gradeAdOffline } from '../agents/grader.js';
import { composeDescription, pageAsItStands } from '../content/landingPage.js';
import { landingFactor } from '../engine/quality.js';
import { getSelfView } from '../engine/insights.js';
import { QUERY_SET } from '../content/querySet.js';
import { CAPEX_DELAY_ROUNDS, TOTAL_ROUNDS } from '../engine/constants.js';
import { createDraft, effectiveGrades } from '../ui/decisions.js';
import * as r0 from '../ui/roundzero/rules.js';

const CELL = 'mid|performance';
const ROUND0_LIVE = 1 + CAPEX_DELAY_ROUNDS;
const WEEK5_LIVE = 5 + CAPEX_DELAY_ROUNDS;

const NOTHING = {};
const REVIEWS = { landingPage: 5500000 };
const SIZE_CHART = { sizeGuide: 2500000 };
const CHART_AND_SHOTS = { sizeGuide: 2500000, photography: 5000000 };

/**
 * A whole game, the player's page written from its round-0 capital as round 0
 * writes it, and `week5` committed at week 5. Each round's state is kept from
 * before it ran, for what the screen would have shown that week.
 */
function play(capex, week5 = {}) {
  let state = startGame({
    rootSeed: 1, playerBrandId: PLAYER, querySet: QUERY_SET, player: harnessPlayer(CELL, 'agency', capex),
  });
  const before = {};
  while (state.round <= TOTAL_ROUNDS) {
    before[state.round] = state;
    const decisions = state.round === 5 ? { [PLAYER]: { capex: week5 } } : {};
    state = submitRound(state, decisions, { mode: 'expected' }).nextGameState;
  }
  return { player: state.advertisers.find((a) => a.id === PLAYER), before };
}

/**
 * The landing page factor one round's auctions ran on. It does not vary by
 * search, so every keyword that showed must agree; a round with none shown
 * measured nothing, and says so rather than passing.
 */
function ranOn(player, round) {
  const rows = Object.values(player.qualityHistory).flat().filter((r) => r.round === round);
  if (rows.length === 0) throw new Error(`round ${round}: no literal impressions, nothing measured`);
  const values = rows.map((r) => r.ownComponents.landingPage);
  for (const v of values) expect(v).toBeCloseTo(values[0], 12);
  return values[0];
}

describe('the page as it stands, in any week', () => {
  test('with nothing live it is the plain page, whatever is committed', () => {
    expect(pageAsItStands({}, 1)).toEqual({ description: composeDescription({}), landingPage: 5 });
    const block = {
      committed: { sizeGuide: 2500000 },
      pending: [{ target: 'sizeGuide', paise: 2500000, liveAtRound: ROUND0_LIVE }],
    };
    expect(pageAsItStands(block, ROUND0_LIVE - 1)).toEqual(pageAsItStands({}, 1));
    expect(pageAsItStands(block, ROUND0_LIVE)).toEqual({ description: composeDescription(SIZE_CHART), landingPage: 7 });
  });

  test('its grade is the grader\'s own, on the description alone', () => {
    const block = { committed: CHART_AND_SHOTS, pending: [] };
    const { description, landingPage } = pageAsItStands(block, 1);
    expect(landingPage).toBe(gradeAdOffline({ headlines: [], descriptions: [], landingPageDescription: description }, {}, 1).landingPage);
  });
});

describe('G3: what the auctions ran on, from their own record', { timeout: 180_000 }, () => {
  const games = {
    nothing: play(NOTHING),
    reviews: play(REVIEWS),
    sizeChart: play(SIZE_CHART),
    week5: play(NOTHING, CHART_AND_SHOTS),
    round0: play(CHART_AND_SHOTS),
  };
  const at = (name, round) => ranOn(games[name].player, round);

  // The record is an average weighted by impressions, so two games on one grade
  // agree to twelve places, not to the last bit.
  test('round-0 capital is not in the auction before it goes live', () => {
    for (let round = 1; round < ROUND0_LIVE; round++) {
      expect(at('reviews', round), `reviews, round ${round}`).toBeCloseTo(at('nothing', round), 12);
      expect(at('sizeChart', round), `size chart, round ${round}`).toBeCloseTo(at('nothing', round), 12);
    }
  });

  /**
   * "Like today from week 4", as the owner agreed: the grades round 0's capital
   * used to earn from week 1 — reviews 7, and 9 once the site work's points
   * land; a size chart 7 (87d797e) — are what it earns from the week it lands.
   */
  test('from the week it lands, it grades as it used to from week 1', () => {
    expect(at('reviews', ROUND0_LIVE)).toBeCloseTo(landingFactor(9), 12);
    expect(at('sizeChart', ROUND0_LIVE)).toBeCloseTo(landingFactor(7), 12);
    expect(at('nothing', ROUND0_LIVE)).toBeCloseTo(landingFactor(5), 12);
  });

  test('week-5 capital leaves the page alone until week 8, then grades as if bought at round 0', () => {
    for (let round = 5; round < WEEK5_LIVE; round++) {
      expect(at('week5', round), `round ${round}`).toBeCloseTo(at('nothing', round), 12);
    }
    for (let round = WEEK5_LIVE; round <= TOTAL_ROUNDS; round++) {
      expect(at('week5', round), `round ${round}`).toBeCloseTo(at('round0', round), 12);
    }
  });
});

describe('G4: the screen reads the page the auction runs on', { timeout: 180_000 }, () => {
  test('every week of a game with capital at round 0 and at week 5', () => {
    const { player, before } = play(REVIEWS, SIZE_CHART);
    for (let round = 1; round <= TOTAL_ROUNDS; round++) {
      const draft = createDraft(getSelfView(before[round], PLAYER));
      expect(landingFactor(effectiveGrades(draft).landingPage), `round ${round}`).toBeCloseTo(ranOn(player, round), 12);
    }
  });

  test('round 0 shows the plain page for week 1 and the page it builds from week 4', () => {
    const draft = r0.createSetupDraft({ playerBrandId: 'marlow', rootSeed: 20260902 });
    r0.addSetupKeyword(draft, 'gym leggings');
    r0.setCapex(draft, 'landingPage', 5500000);
    r0.setCapex(draft, 'sizeGuide', 2500000);
    expect(r0.landingGrade(draft)).toMatchObject({ fromWeek1: 5, fromWeek4: 10 });
    // The first auction's reserve is priced at the page that first auction runs on.
    expect(r0.openingReserve(draft, QUERY_SET).grade.landingPage).toBe(5);
  });
});

describe('who it applies to', () => {
  test('the player\'s page is marked as built from capital; no rival\'s is', () => {
    const state = startGame({ rootSeed: 1, playerBrandId: PLAYER, querySet: QUERY_SET, player: harnessPlayer(CELL) });
    for (const a of state.advertisers) {
      expect(Boolean(a.adGroups[0].pageBuiltFromCapital), a.id).toBe(a.id === PLAYER);
    }
  });

  test('a new game opens on the page as it stands in week 1', () => {
    const state = startGame({
      rootSeed: 1, playerBrandId: PLAYER, querySet: QUERY_SET, player: harnessPlayer(CELL, 'agency', CHART_AND_SHOTS),
    });
    const group = state.advertisers.find((a) => a.id === PLAYER).adGroups[0];
    expect(group.ad.landingPageDescription).toBe(composeDescription({}));
    expect(group.gradedQuality.landingPage).toBe(5);
  });

  /**
   * The owner's choice: a game saved before this change keeps the rule it was
   * played under, so it replays exactly and never meets "This game has
   * changed". Its saved start has no mark, the whole description round 0 wrote,
   * and the grade that description earned at once.
   */
  test('a game begun before the change keeps the old rule', () => {
    const fresh = startGame({
      rootSeed: 1, playerBrandId: PLAYER, querySet: QUERY_SET, player: harnessPlayer(CELL, 'agency', REVIEWS),
    });
    const written = composeDescription(REVIEWS);
    const old = {
      ...fresh,
      advertisers: fresh.advertisers.map((a) => (a.id !== PLAYER ? a : {
        ...a,
        adGroups: a.adGroups.map(({ pageBuiltFromCapital: _mark, ...group }) => ({
          ...group,
          ad: { ...group.ad, landingPageDescription: written },
          gradedQuality: {
            ...group.gradedQuality,
            landingPage: gradeAdOffline({ ...group.ad, landingPageDescription: written }, {}, 0).landingPage,
          },
        })),
      })),
    };
    const next = submitRound(old, {}, { mode: 'expected' }).nextGameState;
    expect(ranOn(next.advertisers.find((a) => a.id === PLAYER), 1)).toBeCloseTo(landingFactor(7), 12);
  });
});
