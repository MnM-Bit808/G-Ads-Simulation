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
 *
 * SINCE 2026-09-14 ONLY OLD SAVES REACH IT (I11). A self-written ad now runs on
 * its words from week 1, so a new game never waits; the measurement above was
 * taken under the old rule. A game saved before then still carries its week-3
 * ad and must still be told, so these tests build that save
 * (tests/fixtures/oldSave.js) and check a new game says nothing.
 */

import { describe, test, expect } from 'vitest';
import { creativeOutlook, allocationWindowPhrase, formContext } from '../ui/dashboard.js';
import { createDraft, prepaidReading } from '../ui/decisions.js';
import { startGame } from '../setup.js';
import { getSelfView } from '../engine/insights.js';
import { submitRound } from '../game.js';
import { QUERY_SET } from '../content/querySet.js';
import { BRAND_IDENTITIES } from '../content/brands.js';
import { homeCell } from '../engine/querySet.js';
import { businessFor, realisedBreakEvenCpcPaise, refusalOutlook } from '../engine/positions.js';
import {
  DEFAULT_UNGRADED_QUALITY, LOCATION_TIERS, COD_SHARE_BY_PRICE_LOCATION,
  RTO_RATE_COD, RTO_RATE_PREPAID,
} from '../engine/constants.js';
import { OLD_SAVE_LIVE_ROUND, asOldSave } from './fixtures/oldSave.js';

const diy = (over = {}) => ({ tier: 'diy', liveAtRound: OLD_SAVE_LIVE_ROUND, ...over });
const hired = (over = {}) => ({ tier: 'freelancer', liveAtRound: 1, ...over });

describe('whether the dashboard says anything about the copy, in a game saved before I11 changed', () => {
  test('a self-written ad is flagged as not live, in every week before it lands', () => {
    for (let round = 1; round < OLD_SAVE_LIVE_ROUND; round++) {
      const out = creativeOutlook(diy(), round);
      expect(out, `round ${round}`).toBeTruthy();
      expect(out.state, `round ${round}`).toBe('pending');
      expect(out.liveAtRound, `round ${round}`).toBe(OLD_SAVE_LIVE_ROUND);
    }
  });

  test('and it is flagged as landed on the round it lands, which is the point', () => {
    const out = creativeOutlook(diy(), OLD_SAVE_LIVE_ROUND);
    expect(out.state).toBe('landed');
  });

  test('and never mentioned again', () => {
    // A card that keeps announcing a thing that happened four weeks ago trains
    // the player to stop reading the card.
    for (const round of [OLD_SAVE_LIVE_ROUND + 1, 8, 12]) {
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
    let state = asOldSave(start('diy'));
    for (let round = 1; round <= OLD_SAVE_LIVE_ROUND; round++) {
      const outlook = creativeOutlook(state.advertisers[0].creative, state.round);
      const next = submitRound(state, {}, { mode: 'expected' }).nextGameState;
      const ranAt = next.advertisers[0].adGroups[0].gradedQuality.expectedCtr;
      const ungraded = ranAt === DEFAULT_UNGRADED_QUALITY.expectedCtr;
      expect(outlook?.state === 'pending', `round ${round} ran at ${ranAt}`).toBe(ungraded);
      state = next;
    }
  });

  test('and the round it calls landed is the round the copy actually changed', () => {
    let state = asOldSave(start('diy'));
    let landedAt = null;
    let before = state.advertisers[0].adGroups[0].gradedQuality.expectedCtr;
    while (state.round <= OLD_SAVE_LIVE_ROUND + 1) {
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
      .toBe(OLD_SAVE_LIVE_ROUND);
  });

  test('a new self-written account has nothing to report, at any round', () => {
    // Since I11 changed, a self-written ad runs from week 1: nothing waits.
    let state = start('diy');
    while (state.round <= 4) {
      expect(creativeOutlook(state.advertisers[0].creative, state.round), `round ${state.round}`).toBeNull();
      state = submitRound(state, {}, { mode: 'expected' }).nextGameState;
    }
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

/**
 * Three sentences the SLC review (reviews/slc-review.md, 9B and 9C) found
 * saying something the model does not do. Each was a literal or a condition in
 * the render; each is now a function of the state it describes, so it cannot
 * drift from it again.
 */
describe('when capital can be spent, in the weeks the player actually sees', () => {
  test('the allocation rounds read as the weeks the decision comes before', () => {
    // The engine applies an allocation AT round 1 and round 5; the player makes
    // it at round 0 and after week 4. "Opens at rounds 1 and 5" named neither.
    expect(allocationWindowPhrase([1, 5])).toBe('before week 1 and before week 5');
  });

  test('it never says "round", which no other screen uses for these', () => {
    expect(allocationWindowPhrase([1, 5])).not.toMatch(/round/i);
  });

  test('one window, three windows, and none all read as sentences', () => {
    expect(allocationWindowPhrase([5])).toBe('before week 5');
    expect(allocationWindowPhrase([1, 5, 9])).toBe('before week 1, before week 5 and before week 9');
    expect(allocationWindowPhrase([])).toBe('only in its allocation weeks');
  });
});

/**
 * The prepaid card, read through the context the dashboard hands the form.
 *
 * TWO FAULTS, AND BOTH SHOWED A PLAUSIBLE NUMBER. The card asked its context for
 * `history` and `playerId`, which the dashboard never packed, so it read the
 * towns' rate for every account, every week. Then, with its own places, it
 * worked the rate out from the cash mix alone, which knows nothing of order
 * confirmation, purpose or the place gradient: on this account, with order
 * confirmation live, it read 16.9% where the week booked 12.9% (I29, I34). It
 * now asks `refusalOutlook`, the round's own arithmetic.
 *
 * Checked against what the engine BOOKED, through the report, and not against
 * the function the card calls: an expectation built by the code under test agrees
 * with it whatever it does. The forecast leaves out each search's own return
 * multiplier (16.1 withholds it), so this holds it to a point, not to the digit;
 * `round.test.js` holds it to the digit where the multiplier is 1.
 */
describe('the prepaid card shows the refusal rate this account runs at (I29, I34)', { timeout: 60_000 }, () => {
  const POSITION = { price: 'mid', purpose: 'performance' };

  // The game as ui/app.js holds it after nine weeks: the state, each week's
  // report, and the draft rebuilt from the account the last week produced. Nine,
  // so week 4 — the first with order confirmation live — has settled.
  let shared = null;
  const played = () => {
    if (shared) return shared;
    const breakEven = realisedBreakEvenCpcPaise(
      businessFor(POSITION, { committed: {}, pending: [] }, 1), QUERY_SET, POSITION,
    );
    const own = QUERY_SET.queries.filter((q) => homeCell(q) === 'mid|performance')
      .sort((a, b) => b.volumeShareBp - a.volumeShareBp).slice(0, 5);
    let state = startGame({
      rootSeed: 20260902,
      playerBrandId: BRAND_IDENTITIES[0].id,
      querySet: QUERY_SET,
      player: {
        position: POSITION,
        // The top rung from round 0, live from week 4.
        capex: { orderConfirmation: 8000000 },
        keywords: own.map((q) => ({ text: q.text, matchType: 'phrase', bidPaise: Math.round(breakEven * 0.7) })),
        ad: {
          headlines: ['Activewear Built To Train In', 'Free Delivery Across India', 'Sizes XS To XXL'],
          descriptions: [
            'Leggings, tights and sports bras that hold through 4 sessions a week.',
            'Easy returns within 30 days, and cash on delivery everywhere.',
          ],
          landingPageDescription: 'A plain product page.',
        },
        writerTier: 'freelancer',
      },
    });
    const playerId = state.advertisers[0].id;
    const reports = [];
    for (let week = 0; week < 9; week++) {
      const out = submitRound(state, {}, { mode: 'expected' });
      reports.push(out.report);
      state = out.nextGameState;
    }
    const draft = createDraft(getSelfView(state, playerId), {
      allocationRounds: state.budgetSchedule?.capexAllocationRounds,
    });
    shared = { state, reports, draft, playerId, view: { termsRange: 'all' } };
    return shared;
  };

  const booked = (game) => {
    const c = game.state.history[3].byAdvertiser[game.playerId].conversions;
    return c.refused / c.final;
  };
  // The card's old figure, worked out here from the sourced constants: the cash
  // mix alone, at this account's places.
  const cashMix = (game) => {
    const clicks = LOCATION_TIERS.map((_, tier) => game.state.history.reduce(
      (a, h) => a + (h.byAdvertiser[game.playerId].breakdown.byLocation[tier]?.clicks ?? 0), 0,
    ));
    const total = clicks.reduce((a, c) => a + c, 0);
    return clicks.reduce((a, c, tier) => {
      const cash = COD_SHARE_BY_PRICE_LOCATION[POSITION.price][tier];
      return a + c * (cash * RTO_RATE_COD + (1 - cash) * RTO_RATE_PREPAID);
    }, 0) / total;
  };

  test('with order confirmation live, it is within a point of what the week booked', () => {
    const game = played();
    // Neither of the card's old readings passes, or this would prove nothing.
    expect(Math.abs(cashMix(game) - booked(game)), 'the cash mix alone').toBeGreaterThan(0.03);
    const towns = refusalOutlook({
      position: POSITION, capex: game.draft.capexBlock, round: game.draft.round,
      placeWeights: LOCATION_TIERS.map((_, i) => (i === LOCATION_TIERS.length - 1 ? 1 : 0)),
    });
    expect(Math.abs(towns - booked(game)), 'the towns\' places, not this account\'s').toBeGreaterThan(0.015);

    expect(Math.abs(prepaidReading(formContext(game)).none - booked(game))).toBeLessThan(0.01);
  });

  test('and the form is handed no other advertiser\'s figures to do it', () => {
    // The obvious fix was `history: game.state.history`, and it would have
    // worked, but every report in it carries all nine advertisers' money,
    // traffic and quality. Nothing would have shown them, and nothing could
    // prove the form ignored them, which is why a controller is never handed
    // state. A function's own closure is not handed over; what it returns is,
    // so that is checked with the rest.
    const ctx = formContext(played());
    const handed = JSON.stringify({ ...ctx, places: ctx.places() });
    expect(handed).not.toMatch(/byAdvertiser/);
  });
});
