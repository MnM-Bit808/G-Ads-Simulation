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
import { CAPEX_TIER_CURVE, CAPEX_ALLOCATION_PAISE } from '../engine/constants.js';
import {
  PAGE_FEATURES, CAPEX_STEPS, composeDescription, featureAt, capexChoices,
} from '../ui/landing-page.js';

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

  test('every capex target has a tier for every step', () => {
    for (const [target, tiers] of Object.entries(PAGE_FEATURES)) {
      expect(tiers.map((t) => t.paise), target).toEqual(CAPEX_STEPS);
    }
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

  test('but every target can still beat it', () => {
    for (const target of Object.keys(PAGE_FEATURES)) {
      expect(gradeOf({ ...NOTHING, [target]: TOP }), target)
        .toBeGreaterThan(gradeOf(NOTHING));
    }
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

  test('THE BEST PAGE AND BETTER PHOTOGRAPHY ARE MUTUALLY EXCLUSIVE', () => {
    // The trade-off the builder exists to make visible, and it was MEASURED
    // rather than designed: the cheapest route to the top landing grade costs
    // 80,000, leaving 20,000 — under photography's 25,000 first rung. So a
    // player who wants the best page buys no photography at all, and
    // photography is what raises conversion rate.
    //
    // The choice is therefore between a cheaper click and more of the visitors
    // buying, which is a real decision rather than a slider.
    const atBest = affordable().filter((c) => gradeOf(c) === bestGrade());
    expect(atBest.length).toBeGreaterThan(0);
    for (const c of atBest) expect(c.photography, JSON.stringify(c)).toBe(0);
  });

  test('and reaching it costs most of the allocation', () => {
    const cheapest = Math.min(
      ...affordable().filter((c) => gradeOf(c) === bestGrade()).map(cost),
    );
    expect(cheapest).toBeGreaterThanOrEqual(0.75 * CAPEX_ALLOCATION_PAISE);
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
      expect(choices.map((c) => c.amountPaise))
        .toEqual(CAPEX_STEPS.filter((p) => p > 0));
      expect(choices.some((c) => c.wasteful), `${target} has nothing to waste yet`).toBe(false);
    }
  });

  test('topping up ₹25,000 of photography offers exactly what it should', () => {
    // The reported case, pinned as a whole so the shape cannot drift.
    const choices = capexChoices('photography', 2500000);
    expect(choices.map((c) => [c.amountPaise, c.reaches.label, c.wasteful])).toEqual([
      [2500000, 'product shots', true],   // I15's chip: spends and changes nothing
      [3000000, 'on real bodies', false], // the rung that used to be unreachable
      [4500000, 'fabric detail', false],
      [7500000, 'video', false],
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
