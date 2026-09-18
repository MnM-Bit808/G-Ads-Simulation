/**
 * Is choosing a writer a real decision? (DECISIONS I11)
 *
 * The tier grades and the delivery round are ESTIMATED constants set from
 * measurement, and a balance that lives only in a commit message stops being
 * true the first time anything moves. So this file PLAYS the real
 * configurations — `startGame`, live rival policies, twelve rounds — and holds
 * the ordering the mechanic exists to create:
 *
 *   write it well  ->  better than the retainer: the fee buys not having to
 *                      write, and insurance, never a better ad than a careful
 *                      writer's (I11, since 2026-09-14)
 *   write it badly ->  worse than the cheapest writer you could have hired
 *   pay more       ->  get more
 *
 * It is in its own file because it is slow: whole games, and there is no
 * shortcut that would still be measuring the thing.
 *
 * WHAT IT DELIBERATELY DOES NOT DO is assert rupees. Pinning the numbers would
 * make every later change a failure with nothing behind it; the ordering and
 * the size of the gaps are the design, and those are what is checked.
 */

import { describe, test, expect } from 'vitest';
import { startGame } from '../setup.js';
import { playGame } from '../game.js';
import { controllerFor } from '../agents/policies.js';
import { gradeAdOffline } from '../agents/grader.js';
import { gameTotals } from '../ui/ending.js';
import { QUERY_SET } from '../content/querySet.js';
import { BRAND_IDENTITIES } from '../content/brands.js';
import { homeCell } from '../engine/querySet.js';
import { TOTAL_ROUNDS, WRITER_TIERS } from '../engine/constants.js';

const CELL = 'mid|performance';
const SEEDS = [1, 20260902];
const HIRED_GRADES = WRITER_TIERS.filter((t) => t.grade !== null).map((t) => t.grade);
const OWN = QUERY_SET.queries.filter((q) => homeCell(q) === CELL).slice(0, 6);
const KEYWORDS = OWN.map((q) => ({ text: q.text, matchType: 'exact', bidPaise: 2600 }));

/**
 * An ad that satisfies every rule the grader has: three headlines saying three
 * different things, both descriptions, a number, and — the part that is easy to
 * miss — the vocabulary of its OWN keywords.
 *
 * The first draft of this fixture failed the assertion below at `adRelevance`
 * 5, because it was written to read well rather than to echo the searches. That
 * is the whole point of `relevanceCoverage`: these six keywords carry nine
 * distinctive words between them, and an ad has to use most of them.
 */
const WELL_WRITTEN = {
  headlines: ['High Waisted Gym Leggings', 'Running Tights For Women', 'Sports Bra High Impact'],
  descriptions: [
    'Workout leggings that hold through 4 sessions a week.',
    'Sizes XS to XXL, with free delivery and easy returns.',
  ],
  landingPageDescription: 'A plain product page.',
};

/** One headline, one description, nothing asked of the reader. */
const BADLY_WRITTEN = {
  headlines: ['Leggings'],
  descriptions: ['Leggings for training.'],
  landingPageDescription: 'A plain product page.',
};

async function play({ writerTier, ad, seed }) {
  const state = startGame({
    rootSeed: seed,
    playerBrandId: BRAND_IDENTITIES[0].id,
    querySet: QUERY_SET,
    player: {
      position: { price: CELL.split('|')[0], purpose: CELL.split('|')[1] },
      capex: { sizeGuide: 0, photography: 0, landingPage: 0 },
      keywords: KEYWORDS.map((k) => ({ ...k })),
      ad,
      writerTier,
    },
  });
  const controllers = {};
  for (const a of state.advertisers) {
    controllers[a.id] = a.policyId ? controllerFor(a.policyId) : () => null;
  }
  // The check that would have caught a whole afternoon of measuring a market
  // that never bids back: policyId used to be null for everyone, so this exact
  // wiring silently gave all eight rivals a no-op controller.
  const live = state.advertisers.filter((a) => a.policyId).length;
  expect(live, 'the rivals are not live, so this measures nothing').toBe(state.advertisers.length - 1);

  const { finalState } = await playGame(state, controllers, {
    rounds: TOTAL_ROUNDS, mode: 'expected',
  });
  return gameTotals(finalState.history, finalState.advertisers[0].id).all.netProfitPaise;
}

/** Mean over the seeds, so one lucky market cannot decide the balance. */
const profitOf = async (writerTier, ad) => {
  const runs = await Promise.all(SEEDS.map((seed) => play({ writerTier, ad, seed })));
  return runs.reduce((a, b) => a + b, 0) / runs.length;
};

describe('the fixtures grade where this file claims they do', () => {
  // Asserted BEFORE anything is played. If the grader moves, these fail and say
  // the fixture drifted — rather than the balance tests below quietly measuring
  // two ads that are no longer good and bad.
  const graded = (ad) => gradeAdOffline(ad, { keywords: KEYWORDS }, 0);

  test('the well-written ad reaches the offline ceiling on craft', () => {
    expect(graded(WELL_WRITTEN).expectedCtr, 'expectedCtr').toBe(8);
  });

  test('and BEATS every hired tier on relevance, which is worth understanding', () => {
    // A consequence of the model rather than an accident, and it is the thing
    // that makes writing your own worth doing at all. `adRelevance` is measured
    // against your OWN keywords, so an advertiser who echoes their searches can
    // reach 10 — while a hired tier is a flat grade capped at 8.
    //
    // The argument for it: relevance to your own searches is the part the
    // advertiser knows best, and echoing the search is ordinary practice. The
    // argument against: a copywriter given your keyword list would obviously
    // use it too, so a flat cap understates a professional. Left as it is
    // because the balance below is what decides whether it is too generous.
    const top = Math.max(...HIRED_GRADES);
    expect(graded(WELL_WRITTEN).adRelevance).toBeGreaterThan(top);
  });

  test('and the badly written one is clearly worse', () => {
    const bad = graded(BADLY_WRITTEN);
    const good = graded(WELL_WRITTEN);
    expect(bad.expectedCtr).toBeLessThan(good.expectedCtr - 1);
  });
});

describe('paying more buys more', () => {
  test('the tiers finish in the order they are priced', async () => {
    const [freelancer, agency, retainer] = await Promise.all([
      profitOf('freelancer', WELL_WRITTEN),
      profitOf('agency', WELL_WRITTEN),
      profitOf('retainer', WELL_WRITTEN),
    ]);
    // The ad is identical in all three: a hired tier sets the grade, so what
    // differs is only what was paid. If this ever inverts, the rollover has
    // grown large enough to make the cheap tier better than the expensive one.
    expect(agency).toBeGreaterThan(freelancer);
    expect(retainer).toBeGreaterThan(agency);
  }, 120000);
});

describe('writing it yourself is a real bet, not a trap or a free win', () => {
  test('written well, it beats the retainer, which is the point (I11)', async () => {
    // The fee buys not having to write. A player who writes as well as the
    // grader can see keeps the whole creative budget and runs a better ad, so
    // writing well has to come out ahead. If it does not, the rule is not
    // doing what I11 says.
    const [own, retainer] = await Promise.all([
      profitOf('diy', WELL_WRITTEN),
      profitOf('retainer', WELL_WRITTEN),
    ]);
    expect(own).toBeGreaterThan(retainer);
  }, 120000);

  test('written badly, you should have hired the cheapest writer going', async () => {
    // The downside that makes it a bet. It is the insurance the fee buys.
    const [bad, freelancer] = await Promise.all([
      profitOf('diy', BADLY_WRITTEN),
      profitOf('freelancer', WELL_WRITTEN),
    ]);
    expect(bad).toBeLessThan(freelancer);
  }, 120000);

  test('and writing well beats writing badly by more than noise', async () => {
    // If these two were close, the rubric would not be worth reading and the
    // round 0 ad card would be ceremony.
    const [good, bad] = await Promise.all([
      profitOf('diy', WELL_WRITTEN),
      profitOf('diy', BADLY_WRITTEN),
    ]);
    expect(good).toBeGreaterThan(bad * 1.2);
  }, 120000);
});
