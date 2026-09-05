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
import { PAGE_FEATURES, CAPEX_STEPS, composeDescription } from '../ui/landing-page.js';

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
