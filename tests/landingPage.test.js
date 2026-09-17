/**
 * The landing page builder (DECISIONS I9).
 *
 * Round 0 used to ask the player to TYPE a description of a page that does not
 * exist, and the grader read that prose for two regexes and a length. So the
 * words "size guide" earned landing-page grade for free, while BUYING a size
 * guide cost capital and bought a lower return rate instead — two models of one
 * concept, and the cheap one was a text box.
 *
 * The page is now composed from what the player actually funded. These tests
 * exist because the composition is the seam: if it drifts from what the grader
 * reads, the card promises a grade the engine will not give.
 */

import { describe, test, expect } from 'vitest';
import { explainGrade } from '../agents/grader.js';
import { CAPEX_TIER_CURVE, CAPEX_ALLOCATION_PAISE, CAPEX_TARGETS } from '../engine/constants.js';
import {
  PAGE_FEATURES, CAPEX_STEPS, stepsFor, composeDescription, featureAt,
  LANDING_RULES, DESCRIBED_AT, PAGE_GRADE_BASE, GRADE_CAP, pagePoints, pageAsItStands,
} from '../content/landingPage.js';
import { landingPageBonus } from '../engine/positions.js';
import * as cards from '../ui/landing-page.js';

const { capexChoices } = cards;

/**
 * THE LADDER HAS ONE HOME, and it is not a screen. The weekly loop re-writes a
 * page from the capital live that week (the owner, 2026-09-17: grade the page as
 * it stands), and game.js reads nothing from ui/. So the ladder and the
 * sentences the grader reads live in content/, and the cards keep only what
 * draws them — a second copy in ui/ would be a second model of the page.
 */
describe('where the page ladder lives', () => {
  test('in content/, and ui/ keeps only what the cards draw', () => {
    expect(Object.keys(cards).sort()).toEqual(['capexChoices', 'pageShape']);
    expect(typeof composeDescription).toBe('function');
    expect(Object.keys(PAGE_FEATURES)).toEqual(['landingPage', 'sizeGuide', 'photography', 'orderConfirmation']);
  });
});

const NOTHING = { sizeGuide: 0, photography: 0, landingPage: 0 };
const adWith = (capex) => ({
  headlines: ['Gym Leggings', 'Squat Proof', 'Free Delivery'],
  descriptions: ['Train hard without overspending.', 'Sizes XS to XXL.'],
  landingPageDescription: composeDescription(capex),
});

const STEP = CAPEX_STEPS;
const TOP = STEP[STEP.length - 1];

/**
 * The grader's VERDICT, never its prose.
 *
 * The first draft of this file found rules by matching the sentences
 * `explainGrade` prints, and broke at once: a rule prints one sentence when it
 * passes and a different one when it fails, so a search for "sizing" silently
 * found nothing exactly when the rule was missed. Matching on rule text is also
 * a second copy of the rubric, which is the thing this file exists to avoid.
 * Everything below is asserted on the GRADE instead.
 */
const gradeOf = (capex) => explainGrade(adWith(capex), {}).grade.landingPage;

/** Every allocation the capital can actually buy. */
const affordable = () => {
  const out = [];
  for (const landingPage of STEP) {
    for (const sizeGuide of STEP) {
      for (const photography of STEP) {
        if (landingPage + sizeGuide + photography <= CAPEX_ALLOCATION_PAISE) {
          out.push({ landingPage, sizeGuide, photography });
        }
      }
    }
  }
  return out;
};
const cost = (c) => Object.values(c).reduce((a, b) => a + b, 0);
const bestGrade = () => Math.max(...affordable().map(gradeOf));

describe('the steps are the engine, not a copy of it', () => {
  test('CAPEX_STEPS is derived from CAPEX_TIER_CURVE', () => {
    // It used to be a literal array in ui/round-zero.js holding the same five
    // integers as the curve. The ui guard only catches DECIMAL arrays, so a
    // copy of an integer curve sat in the view unnoticed. If the curve gains a
    // tier the chips must gain one too, or the card offers amounts the engine
    // cannot distinguish.
    expect(CAPEX_STEPS).toEqual(CAPEX_TIER_CURVE.map((t) => t.paise));
  });

  test('every capex target has a tier for every step of ITS OWN ladder', () => {
    // It used to compare all four against `CAPEX_STEPS`. Photography climbs a
    // longer, shallower ladder now (I30), so a shared list would demand rungs it
    // does not have — and, worse, would pass if photography's rungs were
    // silently reset to the shared ones.
    for (const [target, tiers] of Object.entries(PAGE_FEATURES)) {
      expect(tiers.map((t) => t.paise), target).toEqual(stepsFor(target));
    }
  });

  test('and photographys own ladder really is the longer one', () => {
    // The guard against the above passing vacuously if `stepsFor` ever returns
    // the shared curve for everything.
    expect(stepsFor('photography')).not.toEqual(CAPEX_STEPS);
    const photoTop = stepsFor('photography').at(-1);
    expect(photoTop).toBe(2 * CAPEX_STEPS.at(-1));
  });
});

describe('composeDescription is a pure function of what was funded', () => {
  test('the same capex always gives the same description', () => {
    const capex = { sizeGuide: STEP[1], photography: STEP[2], landingPage: STEP[1] };
    expect(composeDescription(capex)).toBe(composeDescription(capex));
  });

  test('it does not mutate what it was given', () => {
    const capex = { sizeGuide: STEP[2], photography: 0, landingPage: STEP[1] };
    const before = JSON.stringify(capex);
    composeDescription(capex);
    expect(JSON.stringify(capex)).toBe(before);
  });

  test('a missing target reads as unfunded rather than throwing', () => {
    expect(() => composeDescription({})).not.toThrow();
    expect(composeDescription({})).toBe(composeDescription(NOTHING));
  });
});

describe('a player who funds nothing still has a page', () => {
  test('the description is real, not empty', () => {
    // The grader penalises a description under 15 characters as "barely a
    // description at all". An advertiser who invests nothing still HAS a
    // product page; what they do not have is a good one.
    expect(composeDescription(NOTHING).length).toBeGreaterThan(15);
  });

  test('so the penalty for having no page does not fire', () => {
    // Proved by comparison rather than by reading the rule.
    const stunted = { ...adWith(NOTHING), landingPageDescription: 'a page' };
    expect(gradeOf(NOTHING))
      .toBeGreaterThan(explainGrade(stunted, {}).grade.landingPage);
  });

  test('every target that is ABOUT the page can still beat it', () => {
    for (const target of ['landingPage', 'sizeGuide', 'photography']) {
      expect(gradeOf({ ...NOTHING, [target]: TOP }), target)
        .toBeGreaterThan(gradeOf(NOTHING));
    }
  });

  test('and order confirmation cannot, which is the whole point of it', () => {
    // I29. Confirming an order before dispatch changes nothing a visitor reads,
    // so it must not move a grade the copy grader writes. It acts on refusals
    // and on nothing else. If this ever starts passing, capital has found a
    // second route into quality score and L6 is happening again.
    expect(gradeOf({ ...NOTHING, orderConfirmation: TOP }))
      .toBe(gradeOf(NOTHING));
  });
});

describe('nothing can be claimed that was not paid for', () => {
  test('a size guide has to be bought before it can be claimed', () => {
    // The whole point of the rewrite: typing "size guide" used to be free.
    // Spending the ENTIRE allocation on the page itself must not buy one.
    expect(composeDescription({ ...NOTHING, landingPage: TOP })).not.toContain('size');
    expect(gradeOf({ ...NOTHING, landingPage: STEP[2], sizeGuide: STEP[1] }))
      .toBeGreaterThan(gradeOf({ ...NOTHING, landingPage: STEP[2] }));
  });

  test('every sentence in the description belongs to a tier that was funded', () => {
    const capex = { sizeGuide: STEP[1], photography: STEP[2], landingPage: STEP[1] };
    const text = composeDescription(capex);
    for (const [target, tiers] of Object.entries(PAGE_FEATURES)) {
      for (const tier of tiers) {
        if (!tier.sentence) continue;
        expect(text.includes(tier.sentence), `${target} @${tier.paise}`)
          .toBe(capex[target] >= tier.paise);
      }
    }
  });
});

describe('every grader rule stays reachable', () => {
  test('all three positive landing rules can be satisfied at once', () => {
    // LANDING_RULES has three positive clauses worth +1 each. If a tier ladder
    // stopped mentioning reviews, or sizing, or growing long enough, that
    // clause would become a rule nothing can satisfy — the same defect as a
    // constant with no reader, which this project treats as a bug.
    //
    // Asserted as a reachable ceiling rather than by naming the rules: the best
    // affordable page must beat an unfunded one by the full three points.
    expect(bestGrade()).toBe(gradeOf(NOTHING) + 3);
  });
});

describe('spending more is never worse', () => {
  test('the landing page grade is monotonic in every target', () => {
    for (const target of Object.keys(PAGE_FEATURES)) {
      let previous = -Infinity;
      for (const paise of STEP) {
        const grade = gradeOf({ ...NOTHING, [target]: paise });
        expect(grade, `${target} @${paise}`).toBeGreaterThanOrEqual(previous);
        previous = grade;
      }
    }
  });
});

describe('the page competes with the rest of the business for the same money', () => {
  test('the allocation cannot fund all three targets fully', () => {
    expect(cost({ sizeGuide: TOP, photography: TOP, landingPage: TOP }))
      .toBeGreaterThan(CAPEX_ALLOCATION_PAISE);
  });

  test('THE BEST PAGE NO LONGER COSTS YOU PHOTOGRAPHY, and that was a choice', () => {
    // IT USED TO. The top landing grade cost ₹80,000 of a ₹1,00,000 round,
    // leaving ₹20,000 — under photography's ₹25,000 first rung — so a player
    // who wanted the best page bought no photography at all. That was measured
    // rather than designed and it was the sharpest trade in the mechanic.
    //
    // I29 raised the round to ₹1,20,000 so that two rounds fund three of four
    // targets, which leaves ₹40,000 beside the best page. The trade did not
    // disappear; it moved from "page or photos, this round" to "which of the
    // four do I give up, all game" — asserted below.
    const atBest = affordable().filter((c) => gradeOf(c) === bestGrade());
    expect(atBest.length).toBeGreaterThan(0);
    expect(atBest.some((c) => c.photography > 0)).toBe(true);
  });

  test('BUT ONE TARGET MUST STILL BE ABANDONED ENTIRELY, across the whole game', () => {
    // The trade the one above gave up, in the form it now takes. Two rounds are
    // ₹2,40,000 and four maxed targets are ₹3,20,000, so a player can finish
    // three and must leave the fourth at nothing.
    const top = CAPEX_TIER_CURVE[CAPEX_TIER_CURVE.length - 1].paise;
    const wholeGame = 2 * CAPEX_ALLOCATION_PAISE;
    expect(wholeGame).toBe(3 * top);
    expect(CAPEX_TARGETS.length * top).toBeGreaterThan(wholeGame);
  });

  test('and reaching it still costs most of a round', () => {
    const cheapest = Math.min(
      ...affordable().filter((c) => gradeOf(c) === bestGrade()).map(cost),
    );
    expect(cheapest).toBeGreaterThanOrEqual(0.66 * CAPEX_ALLOCATION_PAISE);
  });
});

describe('the same words describe capital wherever it is spent (I15)', () => {
  // Round 0 became a page builder — chips saying "a chart · ₹25,000" beside a
  // drawing of the page. The round-5 allocation window kept the older framing:
  // its own target list, one-line whys, and chips showing only an amount. Two
  // screens describing one decision in two languages, and the terser one is
  // where the player has more context and less time.
  //
  // `featureAt` is what both now read, so they cannot drift again.
  test('it names the tier an amount actually buys', () => {
    expect(featureAt('sizeGuide', CAPEX_STEPS[1]).label).toBe('a chart');
    expect(featureAt('landingPage', CAPEX_STEPS[2]).label).toBe('reviews');
  });

  test('money between two rungs buys the lower one, never the higher', () => {
    // The S-curve is a step function of what is COMMITTED, so a top-up that
    // lands between knots must not be described as the tier above it.
    const between = CAPEX_STEPS[1] + 1;
    expect(featureAt('sizeGuide', between).paise).toBe(CAPEX_STEPS[1]);
  });

  test('nothing spent is the bottom rung, not an error', () => {
    expect(featureAt('photography', 0).label).toBe('none');
    expect(featureAt('landingPage', 0).label).toBe('plain');
  });

  test('more than the top rung is still the top rung', () => {
    const top = CAPEX_STEPS[CAPEX_STEPS.length - 1];
    expect(featureAt('sizeGuide', top * 2).paise).toBe(top);
  });

  test('an unknown target throws rather than describing nothing', () => {
    expect(() => featureAt('billboards', 0)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// What the round-5 card is allowed to offer (DECISIONS I15, and its correction)
// ---------------------------------------------------------------------------

describe('a partly funded target can still climb its own ladder', () => {
  /**
   * FOUND BY PLAYING IT. After committing ₹25,000 to photography at round 0, the
   * round-5 card offered ₹25,000 (no change), ₹55,000, ₹70,000 and ₹1,00,000 as
   * TOP-UPS — the rung prices, reused as amounts. Since investment is cumulative
   * (13.3), ₹55,000 on top of ₹25,000 reaches ₹80,000 and lands on the ₹70,000
   * rung, so nobody was double-charged. But the increment to the ₹55,000 rung is
   * ₹30,000, and no chip offered it: **that rung was unreachable for the rest of
   * the game**, and round 5 is the last capital window there is.
   *
   * It also priced a player out. Upgrading two half-funded targets one rung each
   * cost ₹55,000 twice against a ₹1,00,000 window, where the true increments are
   * ₹30,000 twice.
   *
   * So the menu was wrong, not the price. `capexChoices` offers the cheapest
   * amount that reaches each rung, and keeps I15's marked "buys nothing" chip
   * because the contrast between "₹25,000 changes nothing" and "₹30,000 buys the
   * next rung" is a better lesson in the S-curve than either chip alone.
   */
  const TARGETS = Object.keys(PAGE_FEATURES);

  test('every rung above where you stand is reachable, from every rung', () => {
    // The invariant the defect broke, over every target and every position.
    for (const target of TARGETS) {
      const ladder = PAGE_FEATURES[target];
      for (const standing of ladder) {
        const choices = capexChoices(target, standing.paise);
        for (const rung of ladder.filter((t) => t.paise > standing.paise)) {
          const match = choices.find((c) => c.reaches.paise === rung.paise);
          expect(match, `${target}: ${standing.label} -> ${rung.label}`).toBeTruthy();
          // And at the honest price: the difference, never the rung's own price.
          expect(match.amountPaise, `${target}: ${standing.label} -> ${rung.label}`)
            .toBe(rung.paise - standing.paise);
        }
      }
    }
  });

  test('it never offers two ways to reach the same rung', () => {
    // Paying more for the same rung is strictly worse and does not belong on a
    // menu. I15 deliberately showed both; that is narrowed here, because a
    // dominated option is not a lesson.
    for (const target of TARGETS) {
      for (const standing of PAGE_FEATURES[target]) {
        const reached = capexChoices(target, standing.paise)
          .filter((c) => !c.wasteful)
          .map((c) => c.reaches.paise);
        expect(new Set(reached).size, `${target} at ${standing.label}`).toBe(reached.length);
      }
    }
  });

  test('round 0 is unchanged: from nothing, the amounts ARE the rung prices', () => {
    // The bug was invisible at round 0 and must stay so — there is nothing
    // committed, so every increment equals the rung's own price.
    for (const target of TARGETS) {
      const choices = capexChoices(target, 0);
      expect(choices.map((c) => c.amountPaise), target)
        .toEqual(stepsFor(target).filter((p) => p > 0));
      expect(choices.some((c) => c.wasteful), `${target} has nothing to waste yet`).toBe(false);
    }
  });

  test('topping up ₹25,000 of the size guide offers exactly what it should', () => {
    // THE REPORTED CASE, pinned as a whole so the shape cannot drift. It was
    // photography when it was found; photography left the shared ladder in I30,
    // so the case moved to a target that still climbs the one the bug was about.
    const choices = capexChoices('sizeGuide', 2500000);
    expect(choices.map((c) => [c.amountPaise, c.reaches.label, c.wasteful])).toEqual([
      [2500000, 'a chart', true],    // I15's chip: spends and changes nothing
      [3000000, 'measured', false],  // the rung that used to be unreachable
      // Three rungs, not four: the ladder lost the step that cost ₹30,000 for
      // three hundredths (I29), and its label merged into the top one.
      [5500000, 'fit finder', false],
    ]);
  });

  test('the wasteful chip is kept, marked, and is a real step the player might pick', () => {
    // Not invented: it is one of CAPEX_STEPS, so it is an amount the card would
    // have offered anyway. A warning about a chip nobody could click is theatre.
    const wasteful = capexChoices('sizeGuide', 2500000).filter((c) => c.wasteful);
    expect(wasteful).toHaveLength(1);
    expect(CAPEX_STEPS).toContain(wasteful[0].amountPaise);
    expect(wasteful[0].reaches.paise).toBe(featureAt('sizeGuide', 2500000).paise);
  });

  test('at the top of a ladder there is nothing left to sell', () => {
    for (const target of TARGETS) {
      const top = PAGE_FEATURES[target][PAGE_FEATURES[target].length - 1];
      expect(capexChoices(target, top.paise).filter((c) => !c.wasteful)).toHaveLength(0);
    }
  });

  test('every amount is integer paise', () => {
    // Hard rule 3. A difference of two curve points cannot be fractional, and if
    // it ever became one the form would submit a non-integer to applyCapex,
    // which throws.
    for (const target of TARGETS) {
      for (const standing of PAGE_FEATURES[target]) {
        for (const choice of capexChoices(target, standing.paise)) {
          expect(Number.isSafeInteger(choice.amountPaise), `${target} ${choice.amountPaise}`).toBe(true);
        }
      }
    }
  });

  test('an unknown target throws rather than offering nothing', () => {
    expect(() => capexChoices('billboards', 0)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// Where the grade comes from (the owner's choice B, 2026-09-17, design/grade-breakdown/)
// ---------------------------------------------------------------------------

/**
 * WHERE THE LANDING PAGE GRADE COMES FROM, point by point, and who earned each.
 *
 * By rule, not by purchase. Asked per purchase — the grade with it against the
 * grade without it — a real game does not add up: reviews and a size chart grade
 * 10, without the page's money 7, without the chart 9, so +3 and +1 against a
 * gain of 5 over the plain page. The missing point is "described", which either
 * earns alone, so neither finds it missing. Split by the grader's rules every
 * point has one source, and the point more than one purchase earns alone is
 * shared, and says so.
 */
describe('where the grade comes from, point by point', () => {
  const live = (committed) => ({ committed, pending: [] });
  const byRule = (points) => Object.fromEntries(points.lines.map((l) => [l.rule, { points: l.points, by: l.by }]));

  test('the rules have names, and "described" reads its threshold from one number', () => {
    expect(LANDING_RULES.map((r) => r.key)).toEqual(['described', 'sizing', 'reviews', 'barely']);
    const described = LANDING_RULES.find((r) => r.key === 'described');
    expect(described.hit({ page: 'x'.repeat(DESCRIBED_AT) })).toBe(false);
    expect(described.hit({ page: 'x'.repeat(DESCRIBED_AT + 1) })).toBe(true);
  });

  test('reviews and a size chart: every point, and the one they share', () => {
    const points = pagePoints(live({ landingPage: 5500000, sizeGuide: 2500000 }), 6);
    expect(points.start).toBe(PAGE_GRADE_BASE);
    expect(byRule(points)).toEqual({
      described: { points: 1, by: ['landingPage', 'sizeGuide'] },
      sizing: { points: 1, by: ['sizeGuide'] },
      reviews: { points: 1, by: ['landingPage'] },
      siteWork: { points: 2, by: ['landingPage'] },
    });
    expect(points.total).toBe(10);
    expect(points.grade).toBe(10);
  });

  test('product shots beside them share the described point and earn nothing else', () => {
    const points = pagePoints(live({ landingPage: 5500000, sizeGuide: 2500000, photography: 5000000 }), 8);
    expect(byRule(points).described.by).toEqual(['landingPage', 'sizeGuide', 'photography']);
    expect(points.lines.some((l) => l.by.length === 1 && l.by[0] === 'photography')).toBe(false);
    expect(points.total).toBe(10);
  });

  test('bought alone, a purchase that lengthens the page earns the described point itself', () => {
    const points = pagePoints(live({ photography: 5000000 }), 1);
    expect(byRule(points)).toEqual({ described: { points: 1, by: ['photography'] } });
    expect(points.total).toBe(6);
  });

  test('nothing bought is the plain page: no points but the start', () => {
    const points = pagePoints(live({}), 1);
    expect(points.lines).toEqual([]);
    expect(points).toMatchObject({ start: 5, total: 5, grade: 5 });
  });

  /** The owner's choice, 2026-09-17: the cap is shown openly, not hidden in a smaller number. */
  test('the top page and a size chart earn eleven, and the grade stops at ten', () => {
    const points = pagePoints(live({ landingPage: 8000000, sizeGuide: 2500000 }), 4);
    expect(byRule(points).siteWork).toEqual({ points: 3, by: ['landingPage'] });
    expect(points.total).toBe(11);
    expect(points.grade).toBe(GRADE_CAP);
  });

  test('capital not yet live earns nothing yet', () => {
    const block = { committed: { sizeGuide: 2500000 }, pending: [{ target: 'sizeGuide', paise: 2500000, liveAtRound: 4 }] };
    expect(pagePoints(block, 3).total).toBe(5);
    expect(pagePoints(block, 4).total).toBe(7);
  });

  /**
   * THE BREAKDOWN IS THE GRADE, NOT A SECOND MODEL OF IT. Across every rung of the
   * three page targets and the weeks either side of the live week, the points add
   * up to the grade the auction runs on, capped as it caps it.
   */
  test('the points always add up to the grade the auction runs on', () => {
    const rungs = (target) => PAGE_FEATURES[target].map((t) => t.paise);
    for (const landingPage of rungs('landingPage')) {
      for (const sizeGuide of rungs('sizeGuide')) {
        for (const photography of rungs('photography')) {
          const committed = { landingPage, sizeGuide, photography };
          const pending = Object.entries(committed).filter(([, p]) => p > 0)
            .map(([target, paise]) => ({ target, paise, liveAtRound: 4 }));
          for (const round of [3, 4]) {
            const block = { committed, pending };
            const auction = Math.min(GRADE_CAP, pageAsItStands(block, round).landingPage + landingPageBonus(block, round));
            const points = pagePoints(block, round);
            expect(points.grade, `${JSON.stringify(committed)} week ${round}`).toBe(auction);
            expect(points.start + points.lines.reduce((sum, l) => sum + l.points, 0)).toBe(points.total);
          }
        }
      }
    }
  });
});
