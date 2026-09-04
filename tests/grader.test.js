import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  gradeAd, heuristicGrade, applyGradingRules, validateAdCopy, namesARival,
  contentHashOf, buildGradingRequest, parseGradingResponse, GRADE_TOOL,
} from '../agents/grader.js';
import { BRAND_IDENTITIES } from '../content/brands.js';
import { AD_COPY_BY_CELL } from '../content/adCopy.js';
import { HEADLINE_MAX_CHARS, DESCRIPTION_MAX_CHARS } from '../engine/constants.js';

const GOOD = AD_COPY_BY_CELL['mid|performance'];
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
    for (const [cell, ad] of Object.entries(AD_COPY_BY_CELL)) {
      expect(validateAdCopy(ad).valid, cell).toBe(true);
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
    for (const ad of Object.values(AD_COPY_BY_CELL)) {
      expect(namesARival(ad, RIVALS)).toBeNull();
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
    for (const [cell, ad] of Object.entries(AD_COPY_BY_CELL)) {
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
