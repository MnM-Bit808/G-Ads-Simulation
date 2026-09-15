/**
 * Does round 0's capital reach the auction before it goes live?
 *
 * THE SUSPICION (2026-09-14). Round 0's capital goes live at round 4
 * (`liveAtRound`), and `landingPageBonus` counts only live capital. But the
 * player's landing-page GRADE is read from `composeDescription(capex)`, which
 * describes every committed purchase at round 0, and `buildPlayer` puts that
 * grade in the account from round 1. So a page purchase would raise the graded
 * landing page three weeks before the work it describes exists.
 *
 * Two players identical but for round 0's capital, each with the page round 0
 * composes from it, exactly as `syncPage` does. Read from the auction's own
 * record (`qualityHistory`) rather than recomputed, so what is compared is the
 * landing-page component the auctions actually ran on.
 */

import { describe, test, expect } from 'vitest';

import { startGame } from '../setup.js';
import { submitRound } from '../game.js';
import { harnessPlayer, PLAYER } from '../scripts/market-harness.js';
import { composeDescription } from '../ui/landing-page.js';
import { landingPageBonus } from '../engine/positions.js';
import { landingFactor } from '../engine/quality.js';
import { QUERY_SET } from '../content/querySet.js';
import { CAPEX_DELAY_ROUNDS } from '../engine/constants.js';

const CELL = 'mid|performance';
const LIVE = 1 + CAPEX_DELAY_ROUNDS;

const NOTHING = {};
const REVIEWS = { landingPage: 5500000 };
const SIZE_CHART = { sizeGuide: 2500000 };

/** The player's account after `rounds` weeks, round 0's page composed from its capital. */
function playerAfter(capex, rounds) {
  const base = harnessPlayer(CELL);
  let state = startGame({
    rootSeed: 1,
    playerBrandId: PLAYER,
    querySet: QUERY_SET,
    player: { ...base, capex, ad: { ...base.ad, landingPageDescription: composeDescription(capex) } },
  });
  while (state.round <= rounds) state = submitRound(state, {}, { mode: 'expected' }).nextGameState;
  return state.advertisers.find((a) => a.id === PLAYER);
}

/**
 * The landing-page factor one round's auctions ran on. The grade does not vary
 * by search, so every keyword that showed must agree; a round with none shown
 * measured nothing and says so rather than passing.
 */
function landingComponent(player, round) {
  const rows = Object.values(player.qualityHistory).flat().filter((r) => r.round === round);
  if (rows.length === 0) throw new Error(`round ${round}: no literal impressions, nothing measured`);
  const values = rows.map((r) => r.ownComponents.landingPage);
  for (const v of values) expect(v).toBeCloseTo(values[0], 12);
  return values[0];
}

describe('round 0 capital and the graded landing page', { timeout: 60_000 }, () => {
  const players = {
    nothing: playerAfter(NOTHING, LIVE),
    reviews: playerAfter(REVIEWS, LIVE),
    sizeChart: playerAfter(SIZE_CHART, LIVE),
  };

  test('the engine holds the capital back until it goes live', () => {
    for (let round = 1; round < LIVE; round++) {
      expect(landingPageBonus(players.reviews.capex, round), `round ${round}`).toBe(0);
    }
    expect(landingPageBonus(players.reviews.capex, LIVE)).toBeGreaterThan(0);
  });

  test('the record is the grade: stored page plus live bonus, through landingFactor', () => {
    for (const [name, player] of Object.entries(players)) {
      const stored = player.adGroups[0].gradedQuality.landingPage;
      for (const round of [1, LIVE]) {
        const ran = Math.min(10, stored + landingPageBonus(player.capex, round));
        expect(landingComponent(player, round), `${name} round ${round}`).toBeCloseTo(landingFactor(ran), 12);
      }
    }
  });

  test('CONFIRMED: a page bought at round 0 is in the round-1 auction, three weeks early', () => {
    const at = (name, round) => landingComponent(players[name], round);

    // Nothing bought, nothing moves.
    expect(at('nothing', LIVE)).toBe(at('nothing', 1));

    // Reviews: the page grade is up from week 1, while the capital bonus is
    // still zero, then the bonus lands on top at week 4.
    expect(at('reviews', 1)).toBeGreaterThan(at('nothing', 1));
    expect(at('reviews', LIVE)).toBeGreaterThan(at('reviews', 1));

    // A size chart moves the page grade from week 1 too, and its own effect on
    // returns does not arrive until week 4. It has no bonus to come.
    expect(at('sizeChart', 1)).toBeGreaterThan(at('nothing', 1));
    expect(at('sizeChart', LIVE)).toBe(at('sizeChart', 1));
  });

  test('by how much, in grade points', () => {
    const ran = (name, round) => Math.min(
      10, players[name].adGroups[0].gradedQuality.landingPage + landingPageBonus(players[name].capex, round),
    );
    const grades = Object.fromEntries(Object.keys(players).map((name) => [name, {
      round1: ran(name, 1),
      live: ran(name, LIVE),
    }]));
    expect(grades).toEqual({
      nothing: { round1: 5, live: 5 },
      reviews: { round1: 7, live: 9 },
      sizeChart: { round1: 7, live: 7 },
    });
  });
});
