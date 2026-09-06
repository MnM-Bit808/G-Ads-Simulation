/**
 * The one thing on the dashboard that is a JUDGEMENT rather than a number:
 * whether to say anything about the player's own copy this week.
 *
 * WHY THIS EXISTS. Measured on this build, a self-written ad is the largest
 * single movement in a twelve-week game and the only one with no explanation on
 * screen. At the bid round 0 offers, a DIY account goes 586 clicks -> 2,351 at
 * the round the copy lands, while a hired control over the same two weeks goes
 * DOWN — so the jump is the creative and nothing else. Below the reserve it goes
 * 0 -> 1,951, out of nothing.
 *
 * `CREATIVE_DIY_LIVE_ROUND` was named in `ui/round-zero.js` and nowhere else,
 * and `ui/dashboard.js` mentioned the creative zero times. So weeks 1 and 2
 * never said the ad was not live, week 3 never said it had landed, and a player
 * who changed anything that week would attribute a 4x traffic jump to their own
 * change and be wrong. That is the "correct and unhelpful" class this project
 * keeps finding by playing it: every number right, the sentence missing.
 *
 * The TIMING is what is tested here, because that is where this can be wrong in
 * a way no screenshot shows: saying it in the wrong week, saying it to a player
 * who hired a writer, or saying it forever. The prose is verified in a browser,
 * the same way `termsOutlook`'s is.
 */

import { describe, test, expect } from 'vitest';
import { creativeOutlook } from '../ui/dashboard.js';
import { startGame } from '../setup.js';
import { submitRound } from '../game.js';
import { QUERY_SET } from '../content/querySet.js';
import { BRAND_IDENTITIES } from '../content/brands.js';
import { homeCell } from '../engine/querySet.js';
import { CREATIVE_DIY_LIVE_ROUND, DEFAULT_UNGRADED_QUALITY } from '../engine/constants.js';

const diy = (over = {}) => ({ tier: 'diy', liveAtRound: CREATIVE_DIY_LIVE_ROUND, ...over });
const hired = (over = {}) => ({ tier: 'freelancer', liveAtRound: 1, ...over });

describe('whether the dashboard says anything about the copy', () => {
  test('a self-written ad is flagged as not live, in every week before it lands', () => {
    for (let round = 1; round < CREATIVE_DIY_LIVE_ROUND; round++) {
      const out = creativeOutlook(diy(), round);
      expect(out, `round ${round}`).toBeTruthy();
      expect(out.state, `round ${round}`).toBe('pending');
      expect(out.liveAtRound, `round ${round}`).toBe(CREATIVE_DIY_LIVE_ROUND);
    }
  });

  test('and it is flagged as landed on the round it lands, which is the point', () => {
    const out = creativeOutlook(diy(), CREATIVE_DIY_LIVE_ROUND);
    expect(out.state).toBe('landed');
  });

  test('and never mentioned again', () => {
    // A card that keeps announcing a thing that happened four weeks ago trains
    // the player to stop reading the card.
    for (const round of [CREATIVE_DIY_LIVE_ROUND + 1, 8, 12]) {
      expect(creativeOutlook(diy(), round), `round ${round}`).toBeNull();
    }
  });

  test('a hired ad is never mentioned at all, including in week 1', () => {
    // It was live before the first auction, so there is nothing to explain and
    // "your copy went live this week" would be noise on every hired account.
    for (const round of [1, 2, 3, 12]) {
      expect(creativeOutlook(hired(), round), `round ${round}`).toBeNull();
    }
  });

  test('a state with no creative block says nothing rather than throwing', () => {
    // Serialised games predate the writer mechanic, and a rival built by an
    // older path has no block either. A missing field is not a story.
    expect(creativeOutlook(undefined, 1)).toBeNull();
    expect(creativeOutlook(null, 1)).toBeNull();
    expect(creativeOutlook({ tier: 'diy' }, 1)).toBeNull();
  });

  test('the grade it says you are running is the one the auction used', () => {
    // The sentence quotes a number, so the number has to come from the engine's
    // own default rather than a literal typed into a view.
    const out = creativeOutlook(diy(), 1);
    expect(out.ungradedScore).toBe(DEFAULT_UNGRADED_QUALITY.expectedCtr);
  });
});

describe('it agrees with the game rather than restating it', () => {
  // The failure this guards against is the one `willTriggerLearning` had: a
  // screen that computes its own version of a rule the caller also computes,
  // and drifts. `landCreative` in game.js decides when the copy lands; this
  // asserts the card's verdict against what the round actually did.
  const CELL = 'premium|lifestyle';
  const OWN = QUERY_SET.queries.filter((q) => homeCell(q) === CELL).slice(0, 5);

  const start = (writerTier) => startGame({
    rootSeed: 20260902,
    playerBrandId: BRAND_IDENTITIES[0].id,
    querySet: QUERY_SET,
    player: {
      position: { price: 'premium', purpose: 'lifestyle' },
      capex: { sizeGuide: 0, photography: 0, landingPage: 0 },
      keywords: OWN.map((q) => ({ text: q.text, matchType: 'phrase', bidPaise: 3000 })),
      ad: {
        headlines: ['Premium Athleisure', 'Designer Leggings', 'Luxury Loungewear'],
        descriptions: [
          'Built to hold through 4 sessions a week, wash after wash.',
          'Sizes XS to XXL with free delivery and easy returns.',
        ],
        landingPageDescription: 'A plain product page.',
      },
      writerTier,
    },
  });

  test('it reports pending in exactly the rounds whose auction ran ungraded', () => {
    // THE GRADE IS READ AFTER THE ROUND, NOT BEFORE IT, and the first version of
    // this test read it before and failed while the card was right. `game.js`
    // applies the pending grade inside `submitRound`, on the advertiser it
    // prepares for that round — so at the START of the round the copy lands, the
    // stored grade still reads the ungraded default while the auction that round
    // runs on the written one. The grade in `nextGameState` is the one the round
    // actually used, which is what this compares against.
    let state = start('diy');
    for (let round = 1; round <= CREATIVE_DIY_LIVE_ROUND; round++) {
      const outlook = creativeOutlook(state.advertisers[0].creative, state.round);
      const next = submitRound(state, {}, { mode: 'expected' }).nextGameState;
      const ranAt = next.advertisers[0].adGroups[0].gradedQuality.expectedCtr;
      const ungraded = ranAt === DEFAULT_UNGRADED_QUALITY.expectedCtr;
      expect(outlook?.state === 'pending', `round ${round} ran at ${ranAt}`).toBe(ungraded);
      state = next;
    }
  });

  test('and the round it calls landed is the round the copy actually changed', () => {
    let state = start('diy');
    let landedAt = null;
    let before = state.advertisers[0].adGroups[0].gradedQuality.expectedCtr;
    while (state.round <= CREATIVE_DIY_LIVE_ROUND + 1) {
      const round = state.round;
      const said = creativeOutlook(state.advertisers[0].creative, round)?.state;
      const next = submitRound(state, {}, { mode: 'expected' }).nextGameState;
      const after = next.advertisers[0].adGroups[0].gradedQuality.expectedCtr;
      if (after !== before && landedAt === null) landedAt = round;
      if (said === 'landed') expect(round, 'the card called it landed').toBe(landedAt);
      before = after;
      state = next;
    }
    expect(landedAt, 'the copy never landed, so this test proves nothing')
      .toBe(CREATIVE_DIY_LIVE_ROUND);
  });

  test('a hired account never has anything to report, at any round', () => {
    let state = start('freelancer');
    while (state.round <= 4) {
      expect(creativeOutlook(state.advertisers[0].creative, state.round), `round ${state.round}`)
        .toBeNull();
      state = submitRound(state, {}, { mode: 'expected' }).nextGameState;
    }
  });
});
