/**
 * The content model (stage C1, plans/2026-09-12-content-model-and-field-guide.md).
 *
 * WHY IT EXISTS. The screens carry about 10,000 hand-written words, and almost
 * every card wrote its sentences inside the function that draws it, where no
 * test could read them. Stage A's ten false sentences all lived there, and
 * several were numbers typed by hand that had drifted from the constants they
 * described ("₹1,00,000" where the constant said ₹1,20,000).
 *
 * So a sentence now lives in `ui/words/`, as a small function of the figures it
 * quotes, labelled with the kind of sentence it is. What that buys is below:
 * a concept cannot sit on screen, a disclosure cannot go without its "why", a
 * number cannot be typed, and a card that has moved cannot quietly start
 * writing again.
 */

import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { line, KINDS } from '../ui/words/line.js';
import { RETURNS, RETURNS_STUDIO } from '../ui/words/returns.js';
import { RIVALS } from '../ui/words/rivals.js';
import { DEBRIEF } from '../ui/words/debrief.js';
import { CAPITAL } from '../ui/words/capital.js';
import { MARKET } from '../ui/words/market.js';
import { FORM } from '../ui/words/form.js';
import { SHELL } from '../ui/words/shell.js';
import { KEYWORDS } from '../ui/words/keywords.js';
import { R0 } from '../ui/words/roundZero.js';
import { AD } from '../ui/words/ad.js';
import { WHERE } from '../ui/words/where.js';
import { WEEK } from '../ui/words/week.js';
import { TYPED } from '../ui/words/typed.js';
import { MONEY } from '../ui/words/money.js';
import { RESULTS, TARGET_WORDS } from '../ui/words/results.js';
import { GUIDE } from '../ui/words/guide.js';
import { DOOR } from '../ui/words/door.js';
import { PLAYTEST } from '../ui/words/playtest.js';
import { FIRST_RUN } from '../ui/words/firstrun.js';
import { CHAPTERS } from '../ui/guide/chapters.js';

const WORDS = fileURLToPath(new URL('../ui/words/', import.meta.url));
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const literals = (text) => stripComments(text).match(/'[^'\n]*'|"[^"\n]*"|`[^`]*`/g) ?? [];
const outsideInterpolation = (literal) => literal.replace(/\$\{[^}]*\}/g, '');

describe('a line on screen says what kind of line it is', () => {
  test('the kinds a screen may carry', () => {
    expect(KINDS).toEqual(['reading', 'disclosure', 'instruction', 'label']);
  });

  test('a concept is refused: it belongs in the guide', () => {
    expect(() => line('concept', 'How a click settles')).toThrow(/guide/);
  });

  test('an unknown kind is refused', () => {
    expect(() => line('remark', 'x')).toThrow();
  });

  test('a disclosure without a why is refused (I11)', () => {
    expect(() => line('disclosure', 'The game departs here.')).toThrow(/why/);
    expect(line('disclosure', 'The game departs here.', { why: 'returnsSplit' }).why)
      .toBe('returnsSplit');
  });

  test('text may be fixed, or built from the figures it quotes', () => {
    expect(line('label', 'Refused')()).toBe('Refused');
    expect(line('reading', ({ n }) => `${n} orders`)({ n: '3' })).toBe('3 orders');
  });
});

describe('the returns card', () => {
  // One of every figure the card's lines quote, formatted as the card formats them.
  const FIGURES = {
    settlesAfter: 5, firstHonestWeek: 6, returned: '9', orders: '20', refused: '4',
    sentBack: '5', perParcel: '₹200', round: 3, perRefusal: '₹900', freight: '₹200',
    margin: '₹700', window: 'before week 1 and before week 5', first: 1, last: 2,
  };

  test('every entry is a line of a kind the screen may carry', () => {
    for (const [name, entry] of Object.entries(RETURNS)) {
      expect(KINDS, name).toContain(entry.kind);
    }
  });

  test('every why names a chapter that exists', () => {
    for (const [name, entry] of Object.entries(RETURNS)) {
      if (entry.why) expect(Object.keys(CHAPTERS), name).toContain(entry.why);
    }
  });

  test('every entry renders without a hole in it', () => {
    for (const [name, entry] of Object.entries(RETURNS)) {
      expect(entry(FIGURES), name).not.toMatch(/undefined|NaN/);
    }
  });

  // Found drawing the Studio's Returns: the note named three levers, written
  // before the discount existed (I34), and said capital "opens only before week
  // 1 and before week 5" in weeks when both had passed.
  test('the levers name the prepaid discount, open every week like two others', () => {
    expect(RETURNS.levers()).toMatch(/prepaid discount/i);
    expect(RETURNS.leversHead()).toBe('Four things move it, and three of them are open every week.');
  });

  test('capital is said to open again, or to have closed, never to open in a week gone by', () => {
    expect(RETURNS.capitalLater(FIGURES)).toBe('Capital is the fourth: it is shut, and opens again before week 1 and before week 5.');
    expect(RETURNS.capitalClosed()).toBe('Capital is the fourth, and it has closed for the rest of the game.');
    expect(Object.keys(RETURNS)).not.toContain('capitalShut');
  });

  test('one week counted reads as one', () => {
    expect(RETURNS.countedWeeks({ first: 1, last: 1 })).toMatch(/^Only week 1 is counted above;/);
    expect(RETURNS.countedWeeks({ first: 1, last: 4 })).toMatch(/^Only weeks 1 to 4 are counted above;/);
  });
});

describe('the debrief', () => {
  // One of every figure the debrief's lines quote, formatted as the render
  // formats them, including the signs and the booleans that pick the wording.
  const FIGURES = {
    round: 3, from: 3, to: 4, toEnd: false, week: 5, of: 12,
    newMonth: true, capitalLanded: true,
    clicks: '1,204', clicksSign: 1, cost: '₹4,100', costSign: -1, kept: '₹12,300', keptSign: 1,
    ranOut: 5, played: 12, count: 2, all: false,
    first: '₹40,000', now: '₹90,000', share: '30%', threshold: '10%',
    terms: 14, negatives: 3, rank: 3, grossRank: 1,
    own: '₹10', other: '₹18', strategy: 'Maximise conversions', learning: 2,
    price: 'mid', purpose: 'lifestyle', cell: 'mid · lifestyle',
    exact: 5, half: 2, names: ['Marlow', 'Nira'], weeks: [5, 11],
  };

  test('every entry is a line of a kind the screen may carry', () => {
    for (const [name, entry] of Object.entries(DEBRIEF)) expect(KINDS, name).toContain(entry.kind);
  });

  test('every why names a chapter that exists', () => {
    for (const [name, entry] of Object.entries(DEBRIEF)) {
      if (entry.why) expect(Object.keys(CHAPTERS), name).toContain(entry.why);
    }
  });

  test('every entry renders without a hole in it', () => {
    for (const [name, entry] of Object.entries(DEBRIEF)) {
      expect(entry(FIGURES), name).not.toMatch(/undefined|NaN|\[object/);
    }
  });

  test('the budget question names the weeks it cannot put a rupee on', () => {
    expect(DEBRIEF.budgetBrokeEven({ count: 2, weeks: [5, 11] }))
      .toBe('In 2 of them, weeks 5 and 11, spending the rest of the month there and then would about have broken even.');
    expect(DEBRIEF.budgetBrokeEven({ count: 1, weeks: [11] })).toMatch(/^In one of them, week 11, /);
    expect(DEBRIEF.budgetNothingLeft({ weeks: [8, 12] })).toBe('Weeks 8 and 12 had nothing left in their month to spend.');
    expect(DEBRIEF.budgetNothingLeft({ weeks: [8] })).toBe('Week 8 had nothing left in its month to spend.');
  });

  test('broad match does not take the blame for phrase match\'s longer searches', () => {
    expect(DEBRIEF.broadMatch({ terms: '26', negatives: '1', blocked: 1 }))
      .toMatch(/26 different searches .* phrase match’s longer searches\. By the end you were blocking one word\.$/);
    expect(DEBRIEF.broadMatch({ terms: '26', negatives: '3', blocked: 3 })).toMatch(/blocking 3 words\.$/);
  });

  test('"What if I hadn\'t?" always reads to the end of the game', () => {
    expect(DEBRIEF.window({ from: 4, to: 12 })).toBe('Weeks 4–12, to the end of the game, still settling.');
    expect(DEBRIEF.window({ from: 12, to: 12 })).toBe('Week 12, to the end of the game, still settling.');
  });

  test('a difference reads the right way round: the game WITHOUT the change', () => {
    // Played minus without: positive clicks means the game without it had fewer.
    expect(DEBRIEF.withoutIt({ clicks: '10', clicksSign: 1, cost: '₹5', costSign: 1, kept: '₹7', keptSign: -1 }))
      .toBe('Without it you would have had 10 fewer clicks, paid ₹5 less, and kept ₹7 more.');
    expect(DEBRIEF.withoutIt({ clicksSign: 0, costSign: 0, keptSign: 0 }))
      .toBe('Without it, those weeks would have come out exactly the same.');
  });

  test('ranks read as ordinals, and names as a list', () => {
    expect(DEBRIEF.returns({ share: '30%', rank: 1, grossRank: 12 })).toMatch(/1st on what you kept and 12th on gross/);
    expect(DEBRIEF.returns({ share: '30%', rank: 22, grossRank: 3 })).toMatch(/22nd .* 3rd/);
    expect(DEBRIEF.cellmates({ names: ['Aster', 'Birch', 'Cedar'] })).toMatch(/^Aster, Birch and Cedar sat in your cell, so they/);
    expect(DEBRIEF.cellmates({ names: ['Aster'] })).toMatch(/^Aster sat in your cell, so it/);
    expect(DEBRIEF.cellmates({ names: [] })).toBe('Nobody sat in your cell.');
  });
});

describe('the capital card (D12)', () => {
  const FIGURES = { spent: '₹1,62,000', budget: '₹2,88,000', lost: '38%' };

  test('every entry is a line of a kind the screen may carry', () => {
    for (const [name, entry] of Object.entries(CAPITAL)) expect(KINDS, name).toContain(entry.kind);
  });

  test('every entry renders without a hole in it', () => {
    for (const [name, entry] of Object.entries(CAPITAL)) {
      expect(entry(FIGURES), name).not.toMatch(/undefined|NaN|\[object/);
    }
  });

  test('it reads the figure, and does not tell the player what to do with it', () => {
    // The market card's rule (ui/chart.js, readingOf): say where to look. The
    // card cannot see what capital would earn this player, so it cannot advise.
    for (const [name, entry] of Object.entries(CAPITAL)) {
      expect(entry(FIGURES), name).not.toMatch(/\byou should\b|\bwe recommend\b|\binvest now\b/i);
    }
  });
});

describe('the week the market re-splits (D12, C8)', () => {
  const FIGURES = {
    month: 3, snapshot: 8, spent: '₹14,80,000', before: '₹20,10,000',
    movers: ['Torvi, from 28% to 49% of them', 'Satva, from 30% to 12% of them'],
    name: 'Torvi', from: '28%', to: '49%',
  };

  test('every entry is a line of a kind the screen may carry', () => {
    for (const [name, entry] of Object.entries(MARKET)) expect(KINDS, name).toContain(entry.kind);
  });

  test('every entry renders without a hole in it', () => {
    for (const [name, entry] of Object.entries(MARKET)) {
      expect(entry(FIGURES), name).not.toMatch(/undefined|NaN|\[object/);
    }
  });

  test('the movers read as a list, each with where it started and ended', () => {
    expect(MARKET.moved({ movers: FIGURES.movers }))
      .toBe('Moved most in your auctions this week: Torvi, from 28% to 49% of them; Satva, from 30% to 12% of them.');
  });
});

describe('the decision form', () => {
  const FIGURES = { count: 14 };

  test('a reach of one reads as one search, not one searches', () => {
    expect(FORM.reach({ count: 1 })).toBe('reaches 1 search');
    expect(FORM.reach({ count: 68 })).toBe('reaches 68 searches');
  });

  test('every entry is a line of a kind the screen may carry', () => {
    for (const [name, entry] of Object.entries(FORM)) expect(KINDS, name).toContain(entry.kind);
  });

  test('every why names a chapter that exists', () => {
    for (const [name, entry] of Object.entries(FORM)) {
      if (entry.why) expect(Object.keys(CHAPTERS), name).toContain(entry.why);
    }
  });

  test('every entry renders without a hole in it', () => {
    for (const [name, entry] of Object.entries(FORM)) {
      expect(entry(FIGURES), name).not.toMatch(/undefined|NaN|\[object/);
    }
  });
});

describe('the Studio layout', () => {
  const FIGURES = { played: 4, total: 12, month: 1, spent: '₹2,96,535', budget: '₹3,13,000',
    n: 2, week: 5, hours: 168, round: 0, weeks: 12 };

  test('every entry is a line of a kind the screen may carry', () => {
    for (const [name, entry] of Object.entries(SHELL)) expect(KINDS, name).toContain(entry.kind);
  });

  test('every entry renders without a hole in it', () => {
    for (const [name, entry] of Object.entries(SHELL)) {
      expect(entry(FIGURES), name).not.toMatch(/undefined|NaN|\[object/);
    }
  });

  test('one change reads as one', () => {
    expect(SHELL.changes({ n: 1 })).toBe('change waiting');
    expect(SHELL.changes({ n: 3 })).toBe('changes waiting');
  });
});

describe('the keyword card, the planner and Your keywords', () => {
  const FIGURES = {
    value: 7, list: 'leggings · gym', bid: '₹30', keyword: 'gym leggings', cpc: '₹12',
    impressions: '100', need: '₹16', n: 12, text: 'squat proof leggings',
    count: 7, range: 'weeks 1–4', week: 4, from: 1, to: 4, budget: '50%', rank: '0%', rankNone: true,
    shown: '50%', match: 'phrase', reason: 'no such keyword', scale: 10, rating: 'average',
  };

  test('a Quality Score part reads as its grade out of ten, then its rating (I1)', () => {
    expect(KEYWORDS.qsPart({ value: 7, scale: 10, rating: 'average' })).toBe('7/10 · average');
  });

  test('the panel names levers, never a verdict', () => {
    for (const name of Object.keys(KEYWORDS).filter((k) => k.startsWith('said') || k.startsWith('lever'))) {
      expect(KEYWORDS[name](FIGURES), name).not.toMatch(/\byou should\b|\blower your bids\b|\braise your bids\b/i);
    }
  });

  test('no rank lost reads as none, not as zero per cent', () => {
    expect(KEYWORDS.saidBudget({ budget: '50%', rank: '0%', rankNone: true })).toMatch(/None were lost to rank/);
    expect(KEYWORDS.saidBudget({ budget: '50%', rank: '12%', rankNone: false })).toMatch(/12% were lost to rank/);
  });

  test('one keyword, or one refused, reads as one', () => {
    expect(KEYWORDS.sub({ count: 1, range: 'week 4' })).toBe('1 keyword · week 4');
    expect(KEYWORDS.refused({ n: 1, reason: 'no such keyword' })).toBe('1 left as it was: no such keyword');
  });

  test('every entry is a line of a kind the screen may carry', () => {
    for (const [name, entry] of Object.entries(KEYWORDS)) expect(KINDS, name).toContain(entry.kind);
  });

  test('every why names a chapter that exists', () => {
    for (const [name, entry] of Object.entries(KEYWORDS)) {
      if (entry.why) expect(Object.keys(CHAPTERS), name).toContain(entry.why);
    }
  });

  test('every entry renders without a hole in it', () => {
    for (const [name, entry] of Object.entries(KEYWORDS)) {
      expect(entry(FIGURES), name).not.toMatch(/undefined|NaN|\[object/);
    }
  });
});

describe('round 0 in the Studio (plans/2026-09-14-round-zero-redesign.md)', () => {
  // One of every figure round 0's lines quote, formatted as the steps format them.
  // Each step's task adds its own figures here.
  const FIGURES = {
    round: 0, week: 1, n: 3, total: 5, step: 'Where you sit', hours: 168,
    weeks: 12, rivals: 8, order: '₹2,400', margin: '52%', level: 'value',
    price: 'Mid', purpose: 'Performance', amount: '₹25,000',
    placed: 3, names: ['Nira', 'Marlow'], name: 'Nira', cell: 'Value · Performance',
    budget: '₹50,000', grade: 6, max: 30, writer: 'freelance copywriter', value: 7, scale: 10,
    month: 1, capital: '₹1,20,000', what: 'parcels refused', label: 'a chart',
    weekly: '₹77,000', planned: '₹3,00,000', query: 'nira joggers', volume: '2,838',
    start: 5, top: 10, parts: [{ target: 'landingPage', points: 4 }, { target: 'sizeGuide', points: 1 }],
  };

  test('every entry is a line of a kind the screen may carry', () => {
    for (const [name, entry] of Object.entries(R0)) expect(KINDS, name).toContain(entry.kind);
  });

  test('every why names a chapter that exists', () => {
    for (const [name, entry] of Object.entries(R0)) {
      if (entry.why) expect(Object.keys(CHAPTERS), name).toContain(entry.why);
    }
  });

  test('every entry renders without a hole in it', () => {
    for (const [name, entry] of Object.entries(R0)) {
      expect(entry(FIGURES), name).not.toMatch(/undefined|NaN|\[object/);
    }
  });

  test('"Next" names the step in the middle of a sentence', () => {
    expect(R0.next({ step: 'Where you sit' })).toBe('Next: where you sit');
  });

  /**
   * The bar that moved says which purchase moved it (the owner, 2026-09-18), in
   * the same words Your ad's total uses, and the size guide card no longer names
   * returns alone when its chart earns a grade point too.
   */
  test('the landing page grade names the purchases that earned it, and the size guide says both things it moves', () => {
    expect(R0.lpParts({ start: 5, parts: [{ target: 'sizeGuide', points: 1 }] }))
      .toBe('5 to start, +1 a size chart');
    expect(R0.lpParts({ start: 5, parts: [{ target: 'landingPage', points: 4 }, { target: 'sizeGuide', points: 1 }] }))
      .toBe('5 to start, +4 the page itself, +1 a size chart');
    expect(R0.lpStops({ top: 10 })).toBe('the grade stops at 10');
    expect(R0.movesSize()).toBe('parcels sent back, and the landing page grade');
    expect(R0.whySize()).toMatch(/earns a point of the landing page grade/);
    expect(MONEY.targetWhy.sizeGuide()).toMatch(/earns a point of the landing page grade/);
  });

  test('the names you placed read as a list', () => {
    expect(R0.readoutPlaced({ names: ['Nira'] })).toMatch(/^You’ve placed Nira here/);
    expect(R0.readoutPlaced({ names: ['Nira', 'Marlow', 'Kestrel'] })).toMatch(/Nira, Marlow and Kestrel here/);
  });

  test('step 1 leaves the returns-by-place line to the weekly card', () => {
    // Step 1 measured 296 words against the design's 150 to 200 (2026-09-14),
    // and the owner cut this one: where to advertise is chosen week by week,
    // and the weekly card for it shows what came back from each place.
    const market = readFileSync(fileURLToPath(new URL('../ui/roundzero/market.js', import.meta.url)), 'utf8');
    expect(market).not.toMatch(/returnsVaryByLocation/);
  });
});

describe('the weekly Your ad', () => {
  const FIGURES = {
    amount: '₹10,000', budget: '₹50,000', week: 4, value: 9, scale: 10, part: 'Landing page',
    text: 'A plain product page.', label: 'reviews', from: 'plain',
    // The page drawn as a page: its grade points and the two lifts that are not
    // grade points (design/landing-page/, C).
    points: 2, percent: '4%', graded: 5, target: 'sizeGuide',
    // Two steps, the harder case: capital has two windows (design/page-worth/).
    steps: [{ points: 1, week: 4 }, { points: 2, week: 8 }],
    // Where the grade comes from (design/grade-breakdown/, B): a rule, the point
    // two purchases share, and the total they add up to.
    rule: 'reviews', targets: ['landingPage', 'sizeGuide'], at: 40, start: 5, parts: [3, 1, 1], top: 10,
  };

  /**
   * The note beside the worth chart named the TOTAL points and the LAST week,
   * so a page bought in both windows read "adds 3 from week 8" while the grade
   * had already risen at week 4. Found drawing the chart as a step, 2026-09-16.
   */
  /**
   * 073e05f put "Only the page itself moves the grade … neither worth a point of
   * Quality Score" on screen, and it was false: round 0 writes the page
   * description from all the capital, and the grader rewards a size chart twice
   * and product shots once (tests/ad.test.js). The page row's points are the
   * site work's alone, so they say so rather than standing for the whole grade.
   */
  test('Your ad no longer says the size guide and photography leave the grade alone', () => {
    for (const [name, entry] of Object.entries(AD)) {
      expect(entry(FIGURES), name).not.toMatch(/only the page itself moves the grade|neither worth a point/i);
    }
    expect(AD.stepNote({ graded: 8, steps: [{ points: 2, week: 4 }] })).toMatch(/^Your page’s description was graded 8\. /);
  });

  /**
   * Design B (the owner's choice, 2026-09-17, design/grade-breakdown/): each row
   * names the rules its sentences earn, a shared line names the point more than
   * one earns alone and every one that does, and a total adds them up — saying
   * openly when the grade stops at ten.
   */
  test('the grade breakdown reads rule by rule, shares out loud, and shows the cap', () => {
    expect(AD.gradeRule({ rule: 'reviews', points: 1 })).toBe('+1 it mentions reviews');
    // Not "the site work": round 0 and Your money use that for everything capital
    // builds, and so do this screen's note and legend, while these points are the
    // page's own capital alone (the owner's call, 2026-09-17).
    expect(AD.gradeRule({ rule: 'siteWork', points: 2 })).toBe('+2 the work on the page');
    expect(AD.gradeRule({ rule: 'sizing', points: 1 })).toBe('+1 it mentions sizing');
    // Grading only what Google names (C, 2026-09-17): the faster page's own sentence.
    expect(AD.gradeRule({ rule: 'speed', points: 1 })).toBe('+1 it loads quickly on a phone');
    expect(AD.gradeRule({ rule: 'described', points: 1 })).toBe('+1 the page is described');
    // A lost point carries a minus sign, never colour alone.
    expect(AD.gradeRule({ rule: 'barely', points: -2 })).toBe('−2 there is barely a description');
    expect(AD.noOwnPoint()).toBe('no grade point of its own');
    expect(AD.sharedWhy({ rule: 'described', at: 40, targets: ['landingPage', 'sizeGuide'] }))
      .toBe('Its words run past 40 characters, which the page itself or a size chart would each have done alone.');
    expect(AD.sharedWhy({ rule: 'described', at: 40, targets: ['landingPage', 'sizeGuide', 'photography'] }))
      .toBe('Its words run past 40 characters, which the page itself, a size chart or product shots would each have done alone.');
    expect(AD.sumStart({ start: 5, parts: [3, 1, 1] })).toBe('5 to start, +3 +1 +1');
    expect(AD.sumScale({ top: 10 })).toBe('/10');
    expect(AD.sumStops({ top: 10 })).toBe('the grade stops at 10');
    expect(AD.sumFrom({ week: 8 })).toBe('from week 8');
  });

  /** An unbought page buys grade, not sales per click (the owner, 2026-09-17). */
  test('an unbought page\'s row names what it would add to the grade, and never sales', () => {
    expect(AD.wouldGrade({ amount: '₹55,000', points: 3 })).toBe('₹55,000 would add 3 to the landing page grade');
    expect(AD.wouldGrade({ amount: '₹55,000', points: 3 })).not.toMatch(/sales/);
  });

  /** The four cases the owner chose between, 2026-09-16, as the row reads them. */
  test('the page row names the weeks the grade moves, in the note\'s own words', () => {
    // One step to come and nothing live yet: the common case reads as it always did.
    expect(AD.gradeWeeks({ steps: [{ points: 2, week: 4 }], started: false })).toBe('live from week 4');
    // Two to come: both, since one week would overstate the first or hide it.
    // (No real game shows it — the week-5 purchase always follows a step already
    // taken at week 4 — but the wording must hold if the windows ever move.)
    expect(AD.gradeWeeks({ steps: [{ points: 2, week: 4 }, { points: 1, week: 8 }], started: false }))
      .toBe('2 from week 4 and 1 more from week 8');
    // One taken, one to come: what is left is "more", never the whole again.
    expect(AD.gradeWeeks({ steps: [{ points: 1, week: 8 }], started: true })).toBe('1 more from week 8');
  });

  test('the note under the worth chart reads every step, not the last one', () => {
    const one = AD.stepNote({ graded: 8, steps: [{ points: 2, week: 4 }] });
    expect(one).toMatch(/adds 2 from week 4, when it goes live/);
    const two = AD.stepNote({ graded: 8, steps: [{ points: 1, week: 4 }, { points: 2, week: 8 }] });
    expect(two).toMatch(/adds 1 from week 4 and 2 more from week 8, when each goes live/);
    expect(two).not.toMatch(/adds 3/);
  });

  test('every entry is a line of a kind the screen may carry', () => {
    for (const [name, entry] of Object.entries(AD)) expect(KINDS, name).toContain(entry.kind);
  });

  test('every why names a chapter that exists', () => {
    for (const [name, entry] of Object.entries(AD)) {
      if (entry.why) expect(Object.keys(CHAPTERS), name).toContain(entry.why);
    }
  });

  test('every entry renders without a hole in it', () => {
    for (const [name, entry] of Object.entries(AD)) {
      expect(entry(FIGURES), name).not.toMatch(/undefined|NaN|\[object/);
    }
  });

  test('a hired ad says it runs at the writer\'s level (I11: "that sentence is printed")', () => {
    expect(AD.hired.kind).toBe('disclosure');
    expect(AD.hired()).toMatch(/runs at the writer’s level/);
  });
});

describe('Where and when', () => {
  const FIGURES = {
    n: 8, names: 'Mumbai, Delhi NCR, Bengaluru, Hyderabad', more: 4, clicks: '3,123', cod: '60%',
    refused: '7.8%', sentBack: '13.5%', best: 'metros', bestKept: '₹47', bestPaid: '₹15', worst: 'smaller cities and towns',
    worstKept: '₹34', worstPaid: '₹23', from: 1, to: 6, rate: '4.86%', min: 25, value: '1.3', times: 4, top: '+300%',
    already: 1.6, name: 'Afternoon',
  };

  test('every entry is a line of a kind the screen may carry', () => {
    for (const [name, entry] of Object.entries(WHERE)) expect(KINDS, name).toContain(entry.kind);
  });

  test('every why names a chapter that exists', () => {
    for (const [name, entry] of Object.entries(WHERE)) {
      if (entry.why) expect(Object.keys(CHAPTERS), name).toContain(entry.why);
    }
  });

  test('every entry renders without a hole in it', () => {
    for (const [name, entry] of Object.entries(WHERE)) {
      expect(entry(FIGURES), name).not.toMatch(/undefined|NaN|\[object/);
    }
  });

  test('one week, and one thin block, read as one', () => {
    expect(WHERE.over({ from: 1, to: 1 })).toBe('clicks and sales from week 1');
    expect(WHERE.thin({ n: 1, min: 25 })).toMatch(/^1 block rests/);
    expect(WHERE.thin({ n: 2, min: 25 })).toMatch(/^2 blocks rest /);
  });

  test('the place figures say where to look, never what to do (I13)', () => {
    expect(WHERE.outlook(FIGURES)).not.toMatch(/\byou should\b|\bbid (more|less) in\b/i);
  });
});

describe('Your week', () => {
  const FIGURES = {
    clicks: '3,170', impressions: '43,347', n: 3170, pending: '68.1', roas: '2.72', week: 6,
    weeks: { kind: 'run', from: 1, to: 4 }, amount: '₹51,143', landed: 44, returned: 64,
    rose: 'week 5 rose ₹53,317', fell: 'weeks 1 to 4 fell ₹51,143', score: 5, scale: 10,
  };

  test('every entry is a line of a kind the screen may carry', () => {
    for (const [name, entry] of Object.entries(WEEK)) expect(KINDS, name).toContain(entry.kind);
  });

  test('every why names a chapter that exists', () => {
    for (const [name, entry] of Object.entries(WEEK)) {
      if (entry.why) expect(Object.keys(CHAPTERS), name).toContain(entry.why);
    }
  });

  test('every entry renders without a hole in it', () => {
    for (const [name, entry] of Object.entries(WEEK)) {
      expect(entry(FIGURES), name).not.toMatch(/undefined|NaN|\[object/);
    }
  });

  test('the sentence the owner approved, word for word', () => {
    const rose = WEEK.rose({ weeks: { kind: 'one', week: 5 }, amount: '₹53,317', landed: 44 });
    const fell = WEEK.fell({ weeks: { kind: 'run', from: 1, to: 4 }, amount: '₹51,143', returned: 64 });
    expect(WEEK.whileRan({ week: 6, rose, fell })).toBe('While week 6 ran, week 5 rose ₹53,317 as 44 more '
      + 'conversions landed, and weeks 1 to 4 fell ₹51,143 between them as returns came back.');
  });

  test('the tick says before the week ran, not when you looked (the owner, 2026-09-15)', () => {
    expect(WEEK.weeksSub({ week: 6 })).toMatch(/where it stood before week 6 ran$/);
    expect(Object.values(WEEK).map((entry) => entry(FIGURES)).join(' ')).not.toMatch(/you last looked/);
  });

  test('a why is said only when it was counted', () => {
    const one = { kind: 'one', week: 3 };
    expect(WEEK.fell({ weeks: one, amount: '₹200', returned: 0 })).toBe('week 3 fell ₹200');
    expect(WEEK.rose({ weeks: one, amount: '₹200', landed: 0 })).toBe('week 3 rose ₹200');
    expect(WEEK.rose({ weeks: one, amount: '₹200', landed: 1 })).toBe('week 3 rose ₹200 as 1 more conversion landed');
  });

  test('weeks apart read as a list, and one click as one', () => {
    expect(WEEK.fell({ weeks: { kind: 'list', list: [1, 3], last: 4 }, amount: '₹9', returned: 2 }))
      .toBe('weeks 1, 3 and 4 fell ₹9 between them as returns came back');
    expect(WEEK.clicks({ clicks: '1', n: 1 })).toBe('1 click');
  });

  test('positions read top, 2nd, 3rd, 4th', () => {
    expect([1, 2, 3, 4].map((n) => WEEK.position({ n }))).toEqual(['top', '2nd', '3rd', '4th']);
  });
});

describe('What people typed', () => {
  const FIGURES = {
    n: 33, keywords: 7, each: '4.7', text: 'squat proof', name: 'Pulse', amount: '₹4,357', average: '₹488',
    rate: '26%', type: 'broad', bought: 2, spent: '₹8,526', sales: '12.9', never: 1,
    list: 'best squat proof leggings india', more: 0,
  };

  test('every entry is a line of a kind the screen may carry', () => {
    for (const [name, entry] of Object.entries(TYPED)) expect(KINDS, name).toContain(entry.kind);
  });

  test('every why names a chapter that exists', () => {
    for (const [name, entry] of Object.entries(TYPED)) {
      if (entry.why) expect(Object.keys(CHAPTERS), name).toContain(entry.why);
    }
  });

  test('every entry renders without a hole in it', () => {
    for (const [name, entry] of Object.entries(TYPED)) {
      expect(entry(FIGURES), name).not.toMatch(/undefined|NaN|\[object/);
    }
  });

  test('the preview says what the block catches, as the mock-up did', () => {
    expect(TYPED.someBought(FIGURES)).toBe('Blocks 33 searches: 2 you have bought, ₹8,526 and 12.9 sales, '
      + 'and 1 you never have.');
    expect(TYPED.someBought({ ...FIGURES, n: 2, never: 0 })).toBe('Blocks 2 searches: 2 you have bought, '
      + '₹8,526 and 12.9 sales.');
    expect(TYPED.noneBought({ n: 1 })).toBe('Blocks 1 search, none of them bought yet.');
  });

  test('a mark says where to look, never what to do (I13)', () => {
    for (const entry of [TYPED.legend, TYPED.legendNoReturns, TYPED.dearTitle, TYPED.dearNoSale, TYPED.worseTitle]) {
      expect(entry(FIGURES)).not.toMatch(/\byou should\b|\bblock (it|this|them)\b/i);
    }
  });

  /**
   * A search that sold nothing is marked here too since 2026-09-18 (the owner),
   * as the Negatives card has always marked it, so its mark needs words of its
   * own: there is no cost per sale to name.
   */
  test('a search that sold nothing says what it spent, not what a sale cost', () => {
    expect(TYPED.dearNoSale({ spent: '₹3,566', average: '₹488' }))
      .toBe('₹3,566 spent and nothing sold, where a sale costs you ₹488');
    expect(TYPED.legend(FIGURES)).toMatch(/sold nothing/);
  });

  test('one search reads as one', () => {
    expect(TYPED.blockThese({ n: 1 })).toBe('Block 1 search');
    expect(TYPED.catches({ n: 7 })).toBe('7 searches');
    expect(TYPED.allWeeks({ n: 1 })).toBe('all 1 week');
  });
});

describe('Your money', () => {
  const FIGURES = {
    amount: '₹1,20,000', rung: 'measured', week: 5, price: 'mid', purpose: 'performance', order: '₹2,400',
    margin: '52%', searches: '1,86,000', month: 2, base: '₹1,68,000', joins: '₹1,20,000', move: '₹1,00,000',
    left: '₹2,16,000', from: 6, to: 8, state: 'planned', strategy: 'Target CPA', bid: '₹31', keyword: 'gym leggings',
    need: '₹12', conversions: '41.6', rate: '1.85%', n: 2, roas: '2.72', times: 4, position: 3, of: 9,
    usual: '₹1,68,000', percent: '10%', up: true, gap: '₹1,00,800', next: 'week 6', rest: '₹72,000',
  };
  // The targets and strategies are named in groups, as the form names them.
  const entries = (object, prefix = '') => Object.entries(object).flatMap(([name, entry]) => (
    typeof entry === 'function' ? [[`${prefix}${name}`, entry]] : entries(entry, `${name}.`)));

  test('every entry is a line of a kind the screen may carry', () => {
    for (const [name, entry] of entries(MONEY)) expect(KINDS, name).toContain(entry.kind);
  });

  test('every why names a chapter that exists', () => {
    for (const [name, entry] of entries(MONEY)) {
      if (entry.why) expect(Object.keys(CHAPTERS), name).toContain(entry.why);
    }
  });

  test('every entry renders without a hole in it', () => {
    for (const [name, entry] of entries(MONEY)) {
      expect(entry(FIGURES), name).not.toMatch(/undefined|NaN|\[object/);
    }
  });

  test('the month at week 5 says where its money came from, as the mock-up did', () => {
    expect(MONEY.monthWindow(FIGURES)).toBe('₹1,68,000 for the month, and the ₹1,20,000 of capital you have '
      + 'not committed, less ₹1,00,000 for the move');
    expect(MONEY.monthWindow({ base: '₹1,68,000', joins: '', move: '' })).toBe('₹1,68,000 for the month');
    expect(MONEY.monthLeft({ left: '₹42,000', from: 8, to: 8 })).toBe('₹42,000 left for week 8');
    expect(MONEY.monthLeft(FIGURES)).toBe('₹2,16,000 left for weeks 6 to 8');
  });

  test('one week reads as one', () => {
    expect(MONEY.weeksLeft({ n: 1, week: 8 })).toBe('1 week left · week 8 is the cut-off');
    expect(MONEY.learningNow({ n: 1 })).toMatch(/^Learning: 1 week more/);
  });

  test('the ladder reads first to ninth, and above or below the average', () => {
    expect([1, 2, 3, 4, 9, 11, 12, 13, 21].map((n) => MONEY.finish({ n })))
      .toEqual(['1st', '2nd', '3rd', '4th', '9th', '11th', '12th', '13th', '21st']);
    expect(MONEY.versus({ percent: '30%', up: true })).toBe('+30%');
    expect(MONEY.versus({ percent: '30%', up: false })).toBe('−30%');
  });

  test('a reading says what is true, never what to do (I13)', () => {
    for (const [name, entry] of entries(MONEY)) {
      expect(entry(FIGURES), name).not.toMatch(/\byou should\b/i);
    }
  });
});

describe('Returns in the Studio', () => {
  const FIGURES = {
    perParcel: '₹200', from: 1, to: 3, settlesAfter: 5, target: 'orderConfirmation', week: 4, latest: 11,
    next: 7, refused: '14.8%', sentBack: '24.0%', half: 'refused', direction: 'fell', before: '16.2%', after: '13.5%',
    otherBefore: '23.7%', otherAfter: '24.3%', rate: '12.9%', none: '12.9%', at: '12.0%', rung: '₹30',
    fewer: '6.6%', amount: '₹1,796', parcels: '1.2', freight: '₹200', margin: '₹1,247', orders: '145',
    still: false, since: 4, later: '', laterWeek: 0, window: 'before week 5',
  };
  const entries = (object, prefix = '') => Object.entries(object).flatMap(([name, entry]) => (
    typeof entry === 'function' ? [[`${prefix}${name}`, entry]] : entries(entry, `${name}.`)));

  test('every entry is a line of a kind the screen may carry', () => {
    for (const [name, entry] of entries(RETURNS_STUDIO)) expect(KINDS, name).toContain(entry.kind);
  });

  test('every why names a chapter that exists', () => {
    for (const [name, entry] of entries(RETURNS_STUDIO)) {
      if (entry.why) expect(Object.keys(CHAPTERS), name).toContain(entry.why);
    }
  });

  test('every entry renders without a hole in it', () => {
    for (const [name, entry] of entries(RETURNS_STUDIO)) {
      expect(entry(FIGURES), name).not.toMatch(/undefined|NaN|\[object/);
    }
  });

  test('the step says what the investment did, and what the other half did over the same weeks', () => {
    expect(RETURNS_STUDIO.step(FIGURES)).toBe('Refused fell from 16.2% of orders in weeks 1 to 3 to 13.5% from '
      + 'week 4, when order confirmation went live. Sent back, which it does not reach, went from 23.7% to 24.3%.');
    expect(RETURNS_STUDIO.step({
      ...FIGURES, half: 'sentBack', direction: 'held', target: 'sizeGuide', from: 2, to: 2, after: '24.0%',
      otherBefore: '15.0%', otherAfter: '14.1%',
    })).toBe('Sent back held at 24.0% of orders from week 4, when the size guide went live, as in week 2. '
      + 'Refused, which it does not reach, went from 15.0% to 14.1%.');
  });

  test('one week reads as one', () => {
    expect(RETURNS_STUDIO.counted({ from: 1, to: 1, settlesAfter: 5 })).toBe('Week 1 is counted: a week settles '
      + '5 weeks after it runs.');
    expect(RETURNS_STUDIO.stillComing({ next: 6, latest: 6 })).toBe('Week 6 is still coming back, so it reads lower '
      + 'than it will end.');
    expect(RETURNS_STUDIO.rungFoot({ orders: '206', from: 1, to: 1 })).toBe('At the 206 orders week 1 had.');
  });

  test('a rung\'s rates are next week\'s, and said to be (the review of the canvas)', () => {
    expect(RETURNS_STUDIO.rungRate(FIGURES)).toMatch(/^Next week about 12.9% of orders refused with no discount/);
    expect(RETURNS_STUDIO.noneLine(FIGURES)).toBe('No discount: about 12.9% of next week\'s orders refused.');
  });

  test('a capital target says what it reaches, and where it stands', () => {
    const oc = { target: 'orderConfirmation', rung: 'confirm and verify', since: 4, later: '', laterWeek: 0 };
    expect(RETURNS_STUDIO.capitalTarget(oc)).toBe('Order confirmation, which reaches refusals only: confirm and '
      + 'verify, live since week 4.');
    expect(RETURNS_STUDIO.capitalTarget({ ...oc, target: 'sizeGuide', rung: '', later: 'a chart', laterWeek: 8 }))
      .toBe('The size guide, which reaches send-backs only: a chart from week 8.');
    expect(RETURNS_STUDIO.capitalTarget({ ...oc, rung: 'an SMS', later: 'confirm and verify', laterWeek: 8 }))
      .toBe('Order confirmation, which reaches refusals only: an SMS, live since week 4, rising to confirm and '
        + 'verify from week 8.');
    expect(RETURNS_STUDIO.capitalTarget({ ...oc, target: 'sizeGuide', rung: '' })).toBe('The size guide, which '
      + 'reaches send-backs only: nothing built.');
  });

  test('a reading says what is true, never what to do (I13)', () => {
    for (const [name, entry] of entries(RETURNS_STUDIO)) {
      expect(entry(FIGURES), name).not.toMatch(/\byou should\b/i);
    }
  });
});

describe('Rivals in the Studio', () => {
  const FIGURES = {
    value: '₹4,18,404', share: '26%', budget: '74%', rank: '0%', name: 'Kestrel', overlap: '96%', above: '67%',
    other: 'Torvi', from: '45%', names: ['Auren'],
  };
  const entries = (object, prefix = '') => Object.entries(object).flatMap(([name, entry]) => (
    typeof entry === 'function' ? [[`${prefix}${name}`, entry]] : entries(entry, `${name}.`)));

  test('every entry is a line of a kind the screen may carry', () => {
    for (const [name, entry] of entries(RIVALS)) expect(KINDS, name).toContain(entry.kind);
  });

  test('every why names a chapter that exists', () => {
    for (const [name, entry] of entries(RIVALS)) {
      if (entry.why) expect(Object.keys(CHAPTERS), name).toContain(entry.why);
    }
  });

  test('every entry renders without a hole in it', () => {
    for (const [name, entry] of entries(RIVALS)) {
      expect(entry(FIGURES), name).not.toMatch(/undefined|NaN|\[object/);
    }
  });

  test('the rival above you is said to be above you in all the auctions you show in', () => {
    expect(RIVALS.meetSame(FIGURES)).toBe('You meet Kestrel most, in 96% of the auctions you show in, and it ranks '
      + 'above you in 67% of all of them.');
    expect(RIVALS.meetOther(FIGURES)).toMatch(/but Torvi ranks above you in more of them: 67% of all the auctions/);
  });

  test('rivals never met read as a list', () => {
    expect(RIVALS.never({ names: ['Auren'] })).toBe('Auren never appeared in your auctions this week.');
    expect(RIVALS.never({ names: ['Auren', 'Halcyon', 'Nira'] }))
      .toBe('Auren, Halcyon and Nira never appeared in your auctions this week.');
  });

  test('how often you meet is said not to be spend, as Auction Insights must (spec 16)', () => {
    expect(RIVALS.notSpend()).toMatch(/not market share, and not spend/);
  });

  test('a reading says what is true, never what to do (I13)', () => {
    for (const [name, entry] of entries(RIVALS)) expect(entry(FIGURES), name).not.toMatch(/\byou should\b/i);
  });
});

describe('Results, after the last week (design/results/)', () => {
  // One of every figure the four sections' lines quote, as the render formats them.
  const FIGURES = {
    section: 'What you learned', amount: '₹55,000', n: 3, of: 12, from: 8, to: 12,
    spent: '₹44,940', clicks: '1,695', shown: '26%', budget: '74%', rank: 6, grossRank: 5,
    first: '₹3,86,307', now: '₹4,91,661', weeks: 5, arriving: [10, 11, 12], pending: '53.6', window: 2,
    cutoff: 10, none: 'weeks 11 and 12', list: [11, 12], target: 'the size guide', targets: ['the size guide'],
    round: 5, live: 8, kind: 'budget', share: '74%', sign: 1, gap: '₹83,625', noted: 5, rest: 3,
    placed: 2, total: 8, cell: 'Mid · Lifestyle', how: 'Right on price, wrong on purpose',
    said: 'Mid · Performance', exact: 3, half: 2, name: 'Kestrel', rate: '95%', month: 3, snapshot: 8,
    place: 4, middle: '₹1,68,000', last: '₹1,17,600', conversions: '1,543.1', each: '₹460',
    roas: '₹3.38', gross: '₹12,15,977', week: 8,
    // The books settle the tail and take capital off (the owner, 2026-09-18).
    sales: '53.6', net: '₹9,63,344', made: '₹8,33,344', built: '₹1,30,000',
  };

  test('every entry is a line of a kind the screen may carry, and every why names a chapter', () => {
    for (const [name, entry] of Object.entries({ ...RESULTS, ...TARGET_WORDS })) {
      expect(KINDS, name).toContain(entry.kind);
      if (entry.why) expect(Object.keys(CHAPTERS), name).toContain(entry.why);
    }
  });

  test('every entry renders without a hole in it', () => {
    for (const [name, entry] of Object.entries(RESULTS)) {
      expect(entry(FIGURES), name).not.toMatch(/undefined|NaN|\[object/);
    }
  });

  /**
   * The two things the owner chose to say plainly on 2026-09-15 were that the
   * last weeks read high and that capital was never counted. On 2026-09-18 the
   * owner had the books do both instead of disclosing them, so these say what is
   * counted rather than what is missing.
   */
  test('the books say what they now count: the tail, and the money spent building', () => {
    expect(RESULTS.settledAtEnd({ sales: '53.6', window: 2 }))
      .toBe('The 53.6 sales still arriving when the game ended are counted here, in the weeks whose clicks bought '
        + 'them, and so are the returns they earned 2 weeks later. Nothing is left provisional.');
    expect(RESULTS.capitalOff({ amount: '₹1,30,000', net: '₹9,63,344', made: '₹8,33,344' }))
      .toBe('Your weekly net profit counts what clicks cost, never capital. The books take the ₹1,30,000 you built '
        + 'with off it: ₹9,63,344 less ₹1,30,000 is ₹8,33,344, and that is where you are ranked.');
    expect(RESULTS.booksSettled()).toMatch(/settled the same way/);
    expect(RESULTS.booksNote({ month: 3, snapshot: 8 })).toMatch(/and the capital it spent building/);
  });

  test('a capital week\'s answer says which game ends ahead with the capital counted', () => {
    const args = { amount: '₹55,000', targets: ['the size guide'], gap: '₹83,625' };
    expect(RESULTS.capitalCounted({ ...args, sign: 1 })).toMatch(/the game without it ends ₹83,625 ahead\.$/);
    expect(RESULTS.capitalCounted({ ...args, sign: -1 })).toMatch(/your game still ends ₹83,625 ahead\.$/);
    expect(RESULTS.capitalCounted({ ...args, sign: 0 })).toMatch(/the two end level\.$/);
  });
});

describe('no number is typed into a sentence', () => {
  test('digits arrive as figures, never as text', () => {
    for (const file of readdirSync(WORDS).filter((f) => f.endsWith('.js'))) {
      for (const literal of literals(readFileSync(join(WORDS, file), 'utf8'))) {
        expect(outsideInterpolation(literal), `${file}: ${literal}`).not.toMatch(/\d/);
      }
    }
  });
});

describe('the Guide page says its own labels whole (ui/words/guide.js)', () => {
  // The Guide as a page (the owner's choice, 2026-09-15, design/guide/).
  // `step` is a ground-floor chapter's: which of round 0's five asks for it.
  // `figure` is the name of the figure a why? sits beside, for the labels that
  // have to tell three buttons opening one chapter apart (Your week's six).
  const FIGURES = {
    n: 4, of: 13, title: 'Lost to rank, or lost to budget', step: 3, figure: 'Net ROAS',
  };

  test('each renders with the figures it is given', () => {
    for (const [name, entry] of Object.entries(GUIDE)) {
      expect(entry(FIGURES), name).not.toMatch(/undefined|NaN/);
    }
    expect(GUIDE.chapterOf(FIGURES)).toBe('Chapter 4 of 13');
    expect(GUIDE.numbered(FIGURES)).toBe('4 · Lost to rank, or lost to budget');
  });

  test('the contents\' introduction counts no chapters, so a new one cannot make it wrong', () => {
    expect(GUIDE.intro()).not.toMatch(/\d|thirteen|twelve|fourteen/i);
  });
});

describe('the front door says its words whole (ui/words/door.js)', () => {
  // The switch-over, part 1 (design/switch-over/, A).
  const FIGURES = { played: 6, total: 12, week: 7, of: 6, spend: '₹55,939', clicks: '4,284', n: 3 };

  test('each renders with the figures it is given', () => {
    for (const [name, entry] of Object.entries(DOOR)) {
      expect(entry(FIGURES), name).not.toMatch(/undefined|NaN/);
    }
    expect(DOOR.played(FIGURES)).toBe('6 of 12 weeks played');
    expect(DOOR.replaying(FIGURES)).toBe('Replaying week 7 of 6…');
    expect(DOOR.moreDiffer({ n: 1 })).toBe('and 1 more week differs');
  });

  // A replay is exact by design, so it fails the same way every time: a door
  // offering to try again would be a control that does nothing (ui/app.js).
  test('a save this version cannot open is not offered again', () => {
    const all = Object.values(DOOR).map((entry) => entry(FIGURES)).join(' ');
    expect(all).not.toMatch(/try again/i);
  });
});

describe('the playtest questions are today\'s, in both looks (ui/words/playtest.js)', () => {
  // Moved out of ui/recorder.js by the switch-over, part 1, so the classic panel
  // and the Studio's "Before you go" cannot drift into asking different things
  // while testers are answering both.
  test('each renders whole, and the questions are the ones testers have answered', () => {
    for (const [name, entry] of Object.entries(PLAYTEST)) expect(entry({}), name).not.toMatch(/undefined|NaN/);
    expect(PLAYTEST.lessons()).toBe('What three things did this game teach you? In your own words.');
    expect(PLAYTEST.confusing()).toBe('What confused or annoyed you?');
  });
});

describe('the first run says nothing undefined, and stays inside its budget', () => {
  // What ui/firstrun/read.js will hand every line: the auction's figures, the
  // mid tier's economics, and the weeks a click takes to settle. Named here
  // rather than imported, because Task 1 is the words alone.
  const FIGURES = {
    query: 'gym leggings with pockets',
    volume: '1,849',
    where: 'Pune',
    time: '7 pm',
    winner: 'Marlow',
    winnerBid: '₹30',
    winnerPays: '₹25.13',
    runnerUp: 'Halcyon',
    runnerUpBid: '₹16',
    runnerUpPays: '₹9.45',
    entered: '6',
    of: '9',
    slots: '4',
    order: '₹2,400',
    freight: '₹200',
    returnShare: 'four orders in ten',
    weekly: '4,30,000',
    rivals: '8',
    weeks: '12',
    clickWeek: '3',
    buyWeek: '5',
    backWeek: '7',
    n: 1,
    total: 7,
  };

  test('every line renders without a hole in it', () => {
    for (const [name, entry] of Object.entries(FIRST_RUN)) {
      expect(entry(FIGURES), name).not.toMatch(/undefined|NaN|\[object/);
      expect(entry(FIGURES).trim(), name).not.toBe('');
    }
  });

  // THE PER-SCREEN BUDGET lives in tests/firstRun.test.js, where the run's own
  // beats and the terms each one teaches can be counted together. Here only
  // what belongs to the words themselves.

  // One word, one home (the design's section 3): the run teaches the world and
  // the ground-floor chapters teach the controls, so nothing here sends a
  // reader to a chapter that would define the same term a second time.
  test('it names no guide chapter', () => {
    for (const [name, entry] of Object.entries(FIRST_RUN)) {
      expect(entry.why, name).toBe(null);
    }
  });
});

describe('the new screens draw, and do not write', () => {
  // A "word" here must hold two letters in a row, so icon paths and class
  // lists are not counted.
  const drawing = ['ui/firstrun/render.js',
    'ui/shell/shell.js', 'ui/kit/controls.js', 'ui/kit/card.js', 'ui/kit/planner.js', 'ui/kit/serp.js',
    'ui/map/india.js', 'ui/roundzero/studio.js', 'ui/roundzero/market.js', 'ui/roundzero/position.js',
    'ui/roundzero/keywords.js', 'ui/roundzero/ad.js', 'ui/roundzero/money.js', 'ui/keywords/render.js',
    'ui/ad/render.js', 'ui/where/render.js', 'ui/week/render.js', 'ui/typed/render.js', 'ui/money/render.js',
    'ui/returns/render.js', 'ui/rivals/render.js', 'ui/results/render.js', 'ui/guide/page.js',
    'ui/door/render.js'];
  test.each(drawing)('%s holds no sentence of its own', (file) => {
    const body = readFileSync(fileURLToPath(new URL(`../${file}`, import.meta.url)), 'utf8');
    for (const literal of literals(body)) {
      const words = outsideInterpolation(literal).slice(1, -1).trim().split(/\s+/)
        .filter((w) => /[a-z]{2,}/i.test(w));
      expect(words.length, `${file}: ${literal}`).toBeLessThan(3);
    }
  });
});

describe('a why? is only real once something draws it', () => {
  // FOUND BY PLAYING IT, 2026-09-19. Adding `{ why }` to a line is data; the
  // button appears only where a drawing module calls `whyButton` for that line.
  // Twelve links were added to round 0's words and step 1 still drew none, and
  // the test that counted the LINES passed the whole time.
  const drawing = ['ui/roundzero/market.js', 'ui/roundzero/position.js', 'ui/roundzero/keywords.js',
    'ui/roundzero/ad.js', 'ui/roundzero/money.js', 'ui/kit/card.js'];
  const source = drawing.map((f) => readFileSync(fileURLToPath(new URL(`../${f}`, import.meta.url)), 'utf8')).join('\n');
  const calls = source.match(/whyButton\([^;]*?\)/g) ?? [];

  test('every line in round 0 that carries a why has a button drawn for it', () => {
    const missing = [];
    for (const [name, entry] of Object.entries(R0)) {
      if (!entry.why) continue;
      // A line may be drawn conditionally — `whyButton(x ? R0.a : R0.b, …)` —
      // so the name is looked for anywhere inside a whyButton call.
      const drawn = calls.some((call) => call.includes(`R0.${name}`));
      if (!drawn) missing.push(`R0.${name} → ${entry.why}`);
    }
    expect(missing, `carry a why nobody draws: ${missing.join(', ')}`).toEqual([]);
  });

  // THE NUMBER THAT MATTERS is how many a player can see, not how many lines
  // carry the data. Round 0 drew six before the ground floor.
  test('round 0 draws far more of them than it used to', () => {
    expect(calls.length, `only ${calls.length} why buttons are drawn`).toBeGreaterThanOrEqual(12);
  });

  test('each of round 0’s five steps draws at least one', () => {
    for (const file of ['market.js', 'position.js', 'keywords.js', 'ad.js', 'money.js']) {
      const body = readFileSync(fileURLToPath(new URL(`../ui/roundzero/${file}`, import.meta.url)), 'utf8');
      expect(body.includes('whyButton('), `${file} draws no why at all`).toBe(true);
    }
  });

  // THE SAME RULE, ON THE FIRST SCREEN AFTER ROUND 0 (2026-09-19). Playing it
  // showed Your week carried two why? links on the whole page and none on the
  // six figures — while the first run before it spends seven beats teaching
  // click, cost per click and conversion. The button is drawn by `stat`, which
  // is handed the line itself, so this reads the drawing rather than the data.
  const weekBody = readFileSync(fileURLToPath(new URL('../ui/week/render.js', import.meta.url)), 'utf8');

  test('Your week draws its buttons from the line it is handed', () => {
    expect(weekBody).toMatch(/function stat\([\s\S]*?whyButton\(/);
  });

  test('all six of Your week’s figures carry a why', () => {
    for (const name of ['spend', 'cpc', 'conversions', 'netProfit', 'netRoas', 'cpa']) {
      expect(WEEK[name].why, `WEEK.${name} carries no why`).toBeTruthy();
    }
  });

  // Your week draws a why two ways: the six figures hand their line to `stat`,
  // and the sentences under the chart call `whyButton` themselves. A line has
  // to reach one of the two, or its why is data nobody can click.
  test('every line on Your week that carries a why reaches a drawing', () => {
    const drawn = [
      ...(weekBody.match(/whyButton\([^;]*?\)/g) ?? []),
      ...(weekBody.match(/stat\(\s*WEEK\.\w+/g) ?? []),
    ];
    const missing = [];
    for (const [name, entry] of Object.entries(WEEK)) {
      if (!entry.why) continue;
      // A line chosen into a variable and then drawn — `let entry = WEEK.a;`
      // then `whyButton(entry, …)` — counts too, as round 0's conditional
      // `whyButton(x ? R0.a : R0.b)` does.
      const ok = drawn.some((call) => call.includes(`WEEK.${name}`))
        || new RegExp(`(said|entry) = [^;]*WEEK\\.${name}\\b`).test(weekBody);
      if (!ok) missing.push(`WEEK.${name}`);
    }
    expect(missing, `carry a why nobody draws: ${missing.join(', ')}`).toEqual([]);
  });

  // Three of the six open one chapter, so the visible "why?" is identical on
  // each. Without the figure in the label a screen reader cannot tell them
  // apart (ui/words/guide.js, whyForFigure).
  test('a figure sharing its chapter still says which figure it is', () => {
    expect(weekBody).toContain('GUIDE.whyForFigure(');
    const sharing = ['netProfit', 'netRoas', 'cpa'].map((n) => WEEK[n].why);
    expect(new Set(sharing).size, `expected one shared chapter, got ${sharing.join(', ')}`).toBe(1);
  });
});
