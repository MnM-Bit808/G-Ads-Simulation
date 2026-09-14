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
import { RETURNS } from '../ui/words/returns.js';
import { DEBRIEF } from '../ui/words/debrief.js';
import { CAPITAL } from '../ui/words/capital.js';
import { MARKET } from '../ui/words/market.js';
import { FORM } from '../ui/words/form.js';
import { SHELL } from '../ui/words/shell.js';
import { KEYWORDS } from '../ui/words/keywords.js';
import { R0 } from '../ui/words/roundZero.js';
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
    exact: 5, half: 2, names: ['Marlow', 'Nira'],
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
    n: 2, week: 5, hours: 168, round: 0 };

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

describe('no number is typed into a sentence', () => {
  test('digits arrive as figures, never as text', () => {
    for (const file of readdirSync(WORDS).filter((f) => f.endsWith('.js'))) {
      for (const literal of literals(readFileSync(join(WORDS, file), 'utf8'))) {
        expect(outsideInterpolation(literal), `${file}: ${literal}`).not.toMatch(/\d/);
      }
    }
  });
});

describe('a card that has moved draws, and no longer writes', () => {
  const dashboard = readFileSync(fileURLToPath(new URL('../ui/dashboard.js', import.meta.url)), 'utf8');

  test('renderReturns holds no sentence of its own', () => {
    const start = dashboard.indexOf('function renderReturns(');
    const body = dashboard.slice(start, dashboard.indexOf('\nfunction ', start + 1));
    expect(body.length).toBeGreaterThan(0);
    for (const literal of literals(body)) {
      const words = outsideInterpolation(literal).slice(1, -1).trim().split(/\s+/).filter(Boolean);
      expect(words.length, literal).toBeLessThan(3);
    }
  });
});

describe('the new screens draw, and do not write', () => {
  // A "word" here must hold two letters in a row, so icon paths and class
  // lists are not counted.
  const drawing = ['ui/shell/shell.js', 'ui/kit/controls.js', 'ui/kit/card.js', 'ui/kit/planner.js', 'ui/kit/serp.js',
    'ui/map/india.js', 'ui/roundzero/studio.js', 'ui/roundzero/market.js', 'ui/roundzero/position.js',
    'ui/roundzero/keywords.js', 'ui/roundzero/ad.js', 'ui/roundzero/money.js', 'ui/keywords/render.js'];
  test.each(drawing)('%s holds no sentence of its own', (file) => {
    const body = readFileSync(fileURLToPath(new URL(`../${file}`, import.meta.url)), 'utf8');
    for (const literal of literals(body)) {
      const words = outsideInterpolation(literal).slice(1, -1).trim().split(/\s+/)
        .filter((w) => /[a-z]{2,}/i.test(w));
      expect(words.length, `${file}: ${literal}`).toBeLessThan(3);
    }
  });
});
