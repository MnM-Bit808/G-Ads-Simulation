import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  gradeAd, heuristicGrade, applyGradingRules, validateAdCopy, namesARival,
  contentHashOf, buildGradingRequest, parseGradingResponse, GRADE_TOOL,
  gradeAdOffline, explainGrade,
} from '../agents/grader.js';
import { BRAND_IDENTITIES } from '../content/brands.js';
import { AD_COPY_BY_CELL } from '../content/adCopy.js';
import { HEADLINE_MAX_CHARS, DESCRIPTION_MAX_CHARS } from '../engine/constants.js';

const GOOD = AD_COPY_BY_CELL['mid|performance'][0];
/** Every authored ad, both variants of all six cells. */
const EVERY_AD = Object.entries(AD_COPY_BY_CELL)
  .flatMap(([cell, ads]) => ads.map((ad, v) => [`${cell} #${v + 1}`, ad]));
const KEYWORDS = [{ text: 'gym leggings' }, { text: 'workout leggings' }];
const RIVALS = BRAND_IDENTITIES.map((b) => b.name);

/** A stub model that returns whatever grade the test wants. */
const stubModel = (input) => async () => ({
  content: [{ type: 'tool_use', name: GRADE_TOOL.name, input }],
});

describe('the grade is cached on the copy, not the round (spec 5.2)', () => {
  test('the same copy hashes the same, whatever else changes', () => {
    expect(contentHashOf(GOOD)).toBe(contentHashOf({ ...GOOD }));
  });

  test('changing a headline changes the hash', () => {
    const edited = { ...GOOD, headlines: [...GOOD.headlines.slice(1), 'Something New'] };
    expect(contentHashOf(edited)).not.toBe(contentHashOf(GOOD));
  });

  test('an unchanged ad is returned unregraded, without calling the model', async () => {
    let calls = 0;
    const callModel = async (...args) => { calls += 1; return stubModel({})(...args); };
    const first = await gradeAd({ ad: GOOD, round: 1 });
    const again = await gradeAd({ ad: GOOD, round: 5, previous: first, callModel });
    expect(again).toBe(first);
    expect(again.gradedAtRound).toBe(1);
    expect(calls).toBe(0);
  });

  test('edited copy IS regraded', async () => {
    const first = await gradeAd({ ad: GOOD, round: 1 });
    const edited = { ...GOOD, descriptions: ['Totally different copy now.', 'And this too.'] };
    const second = await gradeAd({ ad: edited, round: 5, previous: first });
    expect(second).not.toBe(first);
    expect(second.gradedAtRound).toBe(5);
  });
});

describe('the character limits finally have a reader (spec 18.1)', () => {
  test('the authored rival copy passes', () => {
    for (const [label, ad] of EVERY_AD) {
      expect(validateAdCopy(ad).valid, label).toBe(true);
    }
  });

  test('an overlong headline is caught', () => {
    const bad = { ...GOOD, headlines: ['x'.repeat(HEADLINE_MAX_CHARS + 1)] };
    expect(validateAdCopy(bad).valid).toBe(false);
  });

  test('an overlong description is caught', () => {
    const bad = { ...GOOD, descriptions: ['x'.repeat(DESCRIPTION_MAX_CHARS + 1)] };
    expect(validateAdCopy(bad).valid).toBe(false);
  });

  // AN EMPTY BOX IS NOT COPY, and this counted them. Round 0 seeds its draft
  // `descriptions: ['', '']` and only strips the blanks at submit, so this
  // function read two empty strings as two descriptions and called the ad valid.
  // The Go button asks exactly this question, so it enabled; `setup.js` then
  // graded the FILTERED ad, which has no descriptions at all, and
  // `OVERLONG_CEILING` capped every component at 4 — including `landingPage`,
  // which has nothing to do with ad copy. A retainer then overwrote the two copy
  // components with its guaranteed 8s, so the only visible symptom was a landing
  // page reading 4/10 on a page the player had spent ₹80,000 on.
  //
  // Found by a player asking why. DECISIONS I10 fixed the identical flaw in
  // `gradeInputs` and did not touch this function; same predicate now.
  test('blank boxes are not copy', () => {
    expect(validateAdCopy({ ...GOOD, descriptions: ['', ''] }).valid, 'blank descriptions').toBe(false);
    expect(validateAdCopy({ ...GOOD, headlines: ['', '', ''] }).valid, 'blank headlines').toBe(false);
    expect(validateAdCopy({ ...GOOD, descriptions: ['   ', '	'] }).valid, 'whitespace only').toBe(false);
  });

  test('and it says which, rather than just refusing', () => {
    // The Go button prints this, so the reason has to be the real one.
    expect(validateAdCopy({ ...GOOD, descriptions: ['', ''] }).violations)
      .toContain('no descriptions');
  });

  test('one real line among blanks is still copy', () => {
    // The filter must not be stricter than the ad it grades: submit keeps the
    // non-empty entries, so one written description is one description.
    expect(validateAdCopy({ ...GOOD, descriptions: ['Sizes XS to XXL.', ''] }).valid).toBe(true);
  });

  test('and an ad that does not fit cannot grade well, whatever the model said', async () => {
    // The model is told the ad is superb. It does not matter: copy that does
    // not fit the slot cannot be a good ad, and that is not a judgement call.
    const bad = { ...GOOD, headlines: ['x'.repeat(HEADLINE_MAX_CHARS + 1)] };
    const graded = await gradeAd({
      ad: bad,
      callModel: stubModel({ expectedCtr: 10, adRelevance: 10, landingPage: 10, reasoning: 'perfect' }),
    });
    expect(graded.expectedCtr).toBeLessThanOrEqual(4);
    expect(graded.adRelevance).toBeLessThanOrEqual(4);
    expect(graded.landingPage).toBeLessThanOrEqual(4);
    expect(graded.notes.join(' ')).toMatch(/limits/i);
  });
});

describe('naming a rival is penalised, never blocked (spec 8.7)', () => {
  test('a rival trademark in the copy is found', () => {
    const poaching = { ...GOOD, headlines: ['Better Than Kestrel', 'Shop Now', 'Free Delivery'] };
    expect(namesARival(poaching, RIVALS)).toBe('Kestrel');
  });

  test('a multi-word name is matched by its distinctive token', () => {
    // The roster holds "Vella & Co."; nobody writes that out.
    const poaching = { ...GOOD, headlines: ['Cheaper Than Vella', 'Shop Now', 'Free Delivery'] };
    expect(namesARival(poaching, RIVALS)).toBe('Vella & Co.');
  });

  test('ordinary copy names nobody', () => {
    for (const [label, ad] of EVERY_AD) {
      expect(namesARival(ad, RIVALS), label).toBeNull();
    }
  });

  test('the penalty lands on adRelevance and nothing else', async () => {
    const poaching = { ...GOOD, headlines: ['Better Than Kestrel', 'Shop Now', 'Free Delivery'] };
    const clean = { ...GOOD, headlines: ['Better Than Ever', 'Shop Now', 'Free Delivery'] };
    const grade = { expectedCtr: 8, adRelevance: 8, landingPage: 8, reasoning: '' };

    const penalised = await gradeAd({
      ad: poaching, context: { rivalNames: RIVALS }, callModel: stubModel(grade),
    });
    const ordinary = await gradeAd({
      ad: clean, context: { rivalNames: RIVALS }, callModel: stubModel(grade),
    });

    expect(penalised.adRelevance).toBeLessThan(ordinary.adRelevance);
    expect(penalised.expectedCtr).toBe(ordinary.expectedCtr);
    expect(penalised.landingPage).toBe(ordinary.landingPage);
  });

  test('and it is a penalty, not a block: the ad still grades above zero', async () => {
    // 8.7 is explicit. Ad disapproval is out of scope (section 19), so a
    // trademark makes an ad expensive to run, never unrunnable.
    const poaching = { ...GOOD, headlines: ['Better Than Kestrel', 'Shop Now', 'Free Delivery'] };
    const graded = await gradeAd({
      ad: poaching,
      context: { rivalNames: RIVALS },
      callModel: stubModel({ expectedCtr: 1, adRelevance: 1, landingPage: 1, reasoning: '' }),
    });
    expect(graded.adRelevance).toBeGreaterThanOrEqual(1);
  });

  test('the rule survives a model that ignored it entirely', () => {
    // The point of applying rules AFTER the model. A grader that forgot the
    // instruction, or was swapped for one that never had it, cannot produce an
    // ad that escapes 8.7.
    const poaching = { ...GOOD, headlines: ['Better Than Kestrel', 'Shop Now', 'Free Delivery'] };
    const { grade } = applyGradingRules(
      { expectedCtr: 9, adRelevance: 9, landingPage: 9 }, poaching, { rivalNames: RIVALS },
    );
    expect(grade.adRelevance).toBeLessThan(9);
  });
});

describe('the offline heuristic keeps the game playable', () => {
  test('it grades every authored rival ad inside the scale', () => {
    for (const [cell, ad] of EVERY_AD) {
      const grade = heuristicGrade(ad, { keywords: KEYWORDS });
      for (const [k, v] of Object.entries(grade)) {
        expect(Number.isInteger(v), `${cell} ${k}`).toBe(true);
        expect(v, `${cell} ${k}`).toBeGreaterThanOrEqual(1);
        expect(v, `${cell} ${k}`).toBeLessThanOrEqual(10);
      }
    }
  });

  test('it clears AD_RANK_FLOOR where the ungraded default does not', async () => {
    // The whole reason it exists. DECISIONS A8: an ungraded ad grades 3/3/3,
    // which sits below the reserve at any cautious bid, so a player who cannot
    // reach a model could not enter an auction at all.
    const graded = await gradeAd({ ad: GOOD, context: { keywords: KEYWORDS } });
    expect(graded.expectedCtr).toBeGreaterThan(3);
  });

  test('it is deterministic', () => {
    expect(heuristicGrade(GOOD, { keywords: KEYWORDS }))
      .toEqual(heuristicGrade(GOOD, { keywords: KEYWORDS }));
  });

  test('it rewards copy that matches its keywords', () => {
    const onTopic = heuristicGrade(GOOD, { keywords: [{ text: 'gym wear leggings train' }] });
    const offTopic = heuristicGrade(GOOD, { keywords: [{ text: 'wedding cake stand hire' }] });
    expect(onTopic.adRelevance).toBeGreaterThan(offTopic.adRelevance);
  });

  test('it punishes three identical headlines', () => {
    const lazy = { ...GOOD, headlines: ['Shop Now', 'Shop Now', 'Shop Now'] };
    expect(heuristicGrade(lazy, { keywords: KEYWORDS }).expectedCtr)
      .toBeLessThan(heuristicGrade(GOOD, { keywords: KEYWORDS }).expectedCtr);
  });

  // The two tests below hold the digit and the offer word CONSTANT across both
  // ads they compare. The first draft of each did not, and both passed against
  // the OLD rubric — dropping a description also dropped a digit, and rewording
  // the headlines also dropped one. They were measuring the rules they were
  // meant to be proving absent.
  const SHARED_DESCRIPTIONS = [
    'Squat-proof gym leggings that survive 4 sessions a week, free delivery.',
    'Sizes XS to XXL, with easy returns.',
  ];

  test('it scores the second description, which nothing used to read', () => {
    // CTR_RULES had no clause about descriptions at all. Google's own Ad
    // Strength rubric asks for more of them, and an ad with one description is
    // half-written — but the old rubric could not see the difference.
    // Description 1 alone already carries the digit and the offer word, so the
    // ONLY thing that changes here is how many descriptions there are.
    const both = { ...GOOD, descriptions: SHARED_DESCRIPTIONS };
    const one = { ...GOOD, descriptions: [SHARED_DESCRIPTIONS[0]] };
    expect(heuristicGrade(one, { keywords: KEYWORDS }).expectedCtr)
      .toBeLessThan(heuristicGrade(both, { keywords: KEYWORDS }).expectedCtr);
  });

  test('it can tell three headlines that SAY the same thing from three that do not', () => {
    // The gap the old rubric had. It caught byte-identical headlines and
    // nothing else, so a writer could reword one headline three times and score
    // exactly as well as one who wrote three different messages. That is
    // precisely what "make your headlines more unique" means, and it is the
    // difference between rewarding craft and rewarding tokens.
    //
    // Neither headline set carries a digit or an offer word: both live in the
    // shared descriptions, so the two ads differ in vocabulary spread alone.
    const reworded = {
      descriptions: SHARED_DESCRIPTIONS,
      landingPageDescription: 'A plain product page.',
      headlines: [
        'Squat Proof Gym Leggings',
        'Gym Leggings, Squat Proof',
        'Leggings For The Gym Squat Proof',
      ],
    };
    const varied = {
      descriptions: SHARED_DESCRIPTIONS,
      landingPageDescription: 'A plain product page.',
      headlines: ['Squat Proof Gym Leggings', 'Delivery Across India', 'Sizes XS To XXL'],
    };
    // No two of the rewordings are identical, so the old duplicate rule is silent.
    expect(new Set(reworded.headlines).size).toBe(3);
    expect(heuristicGrade(reworded, { keywords: KEYWORDS }).expectedCtr)
      .toBeLessThan(heuristicGrade(varied, { keywords: KEYWORDS }).expectedCtr);
  });

  test('stuffing the tokens no longer reaches the ceiling', () => {
    // The old rubric handed out its whole positive range for three headlines, a
    // digit somewhere and one offer word — so "Shop 3 Now" scored as well as a
    // finished ad. Two of those three points now depend on the ad being
    // written rather than on characters appearing in it.
    const stuffed = {
      headlines: ['Shop 3 Now Buy Save', 'Shop Now Save 3 Buy', 'Buy 3 Shop Save Now'],
      descriptions: ['Save 20% off, shop now, buy 3.'],
      landingPageDescription: 'A plain product page.',
    };
    const written = {
      headlines: ['Squat Proof Gym Leggings', 'Free Delivery Over 799', 'Sizes XS To XXL'],
      descriptions: [
        'Squat-proof gym leggings that survive four sessions a week.',
        'Sizes XS to XXL, free delivery, easy 15-day returns.',
      ],
      landingPageDescription: 'A plain product page.',
    };
    const stuffedGrade = heuristicGrade(stuffed, { keywords: KEYWORDS }).expectedCtr;
    expect(stuffedGrade).toBeLessThan(heuristicGrade(written, { keywords: KEYWORDS }).expectedCtr);
    expect(stuffedGrade).toBeLessThan(8);
  });

  test('the ceiling is still 8, deliberately', () => {
    // The honesty boundary this module is built on: a handful of regexes
    // cannot recognise excellent writing, so it must not award a grade that
    // claims it did. Extending the rules to reach 9 was considered and
    // rejected — the route to a 9 is the model path, not more patterns.
    const best = {
      headlines: ['Squat Proof Gym Leggings', 'Free Delivery Over 799', 'Sizes XS To XXL'],
      descriptions: [
        'Squat-proof gym leggings that survive four sessions a week.',
        'Sizes XS to XXL, free delivery, easy 15-day returns.',
      ],
      landingPageDescription: 'Category page with a size guide, fit reviews and filters.',
    };
    expect(heuristicGrade(best, { keywords: KEYWORDS }).expectedCtr).toBe(8);
  });

  test('and it does not pretend to be the model: it awards no 9s or 10s', () => {
    // Narrow-banded on purpose. It is a floor, not an opinion about writing.
    const best = { headlines: ['Gym Leggings From ₹799', 'Free Delivery Over ₹799', 'Buy 2 Save 20%'],
      descriptions: ['Squat-proof gym leggings that survive four sessions a week.',
        'Sizes XS to XXL, free delivery, easy 15-day returns.'],
      landingPageDescription: 'Category page with a size guide, fit reviews and filters by activity.' };
    const grade = heuristicGrade(best, { keywords: KEYWORDS });
    expect(Math.max(...Object.values(grade))).toBeLessThan(9);
  });
});

describe('the model path', () => {
  test('the request carries the keywords, because relevance needs them', () => {
    const text = JSON.stringify(buildGradingRequest(GOOD, { keywords: KEYWORDS }));
    expect(text).toContain('gym leggings');
    expect(text).toContain(GOOD.headlines[0]);
  });

  test('and carries nothing about position, economics or affinities', () => {
    // A grader that knew a brand was premium would grade the brand rather than
    // the writing (C2), and the affinities are withheld from everyone (C4).
    const text = JSON.stringify(buildGradingRequest(GOOD, {
      keywords: KEYWORDS, rivalNames: RIVALS,
    }));
    for (const leak of [
      'premium', 'value', 'mid-market', 'convRateBase', 'priceAffinity',
      'purposeAffinity', 'aovMeanPaise', 'marginPct', 'breakEven',
    ]) {
      expect(text.toLowerCase(), leak).not.toContain(leak.toLowerCase());
    }
  });

  test('the tool is strict, so the reply validates by construction', () => {
    expect(GRADE_TOOL.strict).toBe(true);
    expect(GRADE_TOOL.input_schema.additionalProperties).toBe(false);
    for (const c of ['expectedCtr', 'adRelevance', 'landingPage']) {
      expect(GRADE_TOOL.input_schema.required).toContain(c);
      expect(GRADE_TOOL.input_schema.properties[c].maximum).toBe(10);
    }
  });

  test('a model grade is used when the model answers', async () => {
    const graded = await gradeAd({
      ad: GOOD,
      context: { keywords: KEYWORDS },
      callModel: stubModel({ expectedCtr: 9, adRelevance: 8, landingPage: 7, reasoning: 'good' }),
    });
    expect(graded).toMatchObject({ expectedCtr: 9, adRelevance: 8, landingPage: 7, source: 'model' });
    expect(graded.notes[0]).toBe('good');
  });

  test('a model that answers without calling the tool falls back, not throws', () => {
    expect(parseGradingResponse({ content: [{ type: 'text', text: 'I think it is fine' }] }))
      .toBeNull();
  });

  test('a model that throws falls back to the heuristic', async () => {
    const graded = await gradeAd({
      ad: GOOD,
      context: { keywords: KEYWORDS },
      callModel: async () => { throw new Error('network down'); },
    });
    // Losing a round to a network error would be a worse failure than a
    // cruder grade.
    expect(graded.source).toBe('heuristic');
    expect(graded.expectedCtr).toBeGreaterThanOrEqual(1);
  });

  test('a model returning nonsense is clamped, not trusted', async () => {
    const graded = await gradeAd({
      ad: GOOD,
      callModel: stubModel({ expectedCtr: 400, adRelevance: -9, landingPage: 3.7, reasoning: '' }),
    });
    expect(graded.expectedCtr).toBe(10);
    expect(graded.adRelevance).toBe(1);
    expect(graded.landingPage).toBe(4);
  });
});

describe('the suite stays offline (R2)', () => {
  const src = (file) => readFileSync(
    fileURLToPath(new URL(`../agents/${file}`, import.meta.url)), 'utf8',
  ).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  test('grader.js holds the judgement and cannot reach a network', () => {
    // The transport is injected. This module decides what to ask and which
    // rules the answer may not break, and has no way to send anything.
    const text = src('grader.js');
    for (const escape of ['fetch(', 'XMLHttpRequest', 'require(', 'import(', 'anthropic']) {
      expect(text.toLowerCase().includes(escape.toLowerCase()), escape).toBe(false);
    }
  });

  test('claude.js is the only file that reaches one, and nothing imports it', () => {
    expect(src('claude.js')).toMatch(/@anthropic-ai\/sdk/);
    for (const file of ['grader.js', 'policies.js']) {
      expect(src(file), file).not.toMatch(/claude\.js/);
    }
  });
});

describe('the grade explains itself (explainGrade)', () => {
  // A player wrote an ad, got a number, and had no way to tell what moved it.
  // The checks and the score come from ONE pass over one list of rules, so the
  // advice on screen cannot drift from the number beside it — which is the
  // whole reason this lives in the grader rather than as a second rubric in ui/.
  const ctx = { keywords: KEYWORDS };

  test('the grade it reports is exactly the grade the engine will use', () => {
    for (const [label, ad] of EVERY_AD) {
      const explained = explainGrade(ad, ctx);
      const graded = gradeAdOffline(ad, ctx, 0);
      for (const component of ['expectedCtr', 'adRelevance', 'landingPage']) {
        expect(explained.grade[component], `${label} ${component}`).toBe(graded[component]);
      }
    }
  });

  test('every component gets at least one thing said about it', () => {
    const checks = explainGrade(GOOD, ctx).checks;
    for (const component of ['expectedCtr', 'adRelevance', 'landingPage']) {
      expect(checks.filter((c) => c.component === component).length, component)
        .toBeGreaterThan(0);
    }
  });

  test('a failing check says what is missing, and passes once it is fixed', () => {
    const bare = {
      headlines: ['Leggings'],
      // Neither a digit nor an offer word. It used to say "Buy leggings.",
      // which failed the old digit rule while passing the old offer rule —
      // now that those are one rule, "buy" alone satisfies it.
      descriptions: ['Leggings for training.'],
      landingPageDescription: 'A page.',
    };
    const said = (ad) => explainGrade(ad, ctx).checks.filter((c) => !c.ok).map((c) => c.text);

    expect(said(bare).join(' ')).toMatch(/not filled out/);
    expect(said(bare).join(' ')).toMatch(/no reason to act/);
    expect(said(bare).join(' ')).toMatch(/too short/);
    // One headline cannot be three different things, so the new uniqueness
    // rule has to fire here too rather than passing by default on a thin ad.
    expect(said(bare).join(' ')).toMatch(/one message reworded/);

    const fixed = {
      headlines: ['Gym Leggings From 799', 'Squat Proof Every Rep', 'Free Size Exchange'],
      descriptions: ['Workout leggings that hold through the session.', 'Sizes XS to XXL.'],
      landingPageDescription: 'A long page with a size chart, fit guide and customer reviews.',
    };
    expect(said(fixed)).toEqual([]);
    expect(explainGrade(fixed, ctx).grade.expectedCtr)
      .toBeGreaterThan(explainGrade(bare, ctx).grade.expectedCtr);
  });

  test('with no keywords it says so rather than scoring relevance silently', () => {
    const check = explainGrade(GOOD, {}).checks.find((c) => c.component === 'adRelevance');
    expect(check.text).toMatch(/no keywords yet/);
    expect(check.ok).toBe(false);
  });

  test('and it still carries the penalties applyGradingRules adds', () => {
    const named = { ...GOOD, headlines: [`Better Than ${RIVALS[1]}`, ...GOOD.headlines.slice(1)] };
    expect(explainGrade(named, { ...ctx, rivalNames: RIVALS }).notes.join(' '))
      .toMatch(/names a rival/);
  });
});
