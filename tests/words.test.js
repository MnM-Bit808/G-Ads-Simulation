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
