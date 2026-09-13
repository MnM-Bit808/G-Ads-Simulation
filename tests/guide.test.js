/**
 * The field guide's chapters (stage C2, plans/2026-09-12-content-model-and-field-guide.md).
 *
 * The guide is where the screens' explanations go, so it is where a false
 * sentence would do the most damage and be read least often. Each chapter says
 * how real Google Ads does something and then what this game does, and both
 * halves are held here:
 *
 * - the real half must carry a source, unless the chapter is a game device with
 *   no real equivalent (an absence cannot be cited);
 * - the game half must cite the DECISIONS entries or spec sections it rests on,
 *   and every one of them must exist;
 * - the game half types no number: every figure arrives from `guideFigures`,
 *   which reads the engine's constants, so a chapter cannot drift from them.
 *
 * WHAT THESE TESTS CANNOT DO. They prove a cited entry exists, not that the
 * chapter agrees with it. That is checked by reading, when a chapter is written
 * and whenever an entry it cites changes.
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CHAPTERS, CONTENTS, chapter } from '../ui/guide/chapters.js';
import { guideFigures } from '../ui/guide/figures.js';

const read = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');
const DECISIONS = read('DECISIONS.md');
const SPEC = read('ENGINE_SPEC_v0.3.md');
const INDEX = read('ui/index.html');
const DECISIONS_FORM = read('ui/decisions.js');
const FIGURES = guideFigures();
const wordCount = (text) => text.trim().split(/\s+/).filter(Boolean).length;
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Does the ledger or the spec hold this citation? */
function cited(id) {
  if (/^H\d+$/.test(id)) {
    const start = DECISIONS.indexOf('\n## H.');
    const section = DECISIONS.slice(start, DECISIONS.indexOf('\n## ', start + 1));
    return new RegExp(`^${id.slice(1)}\\. `, 'm').test(section);
  }
  if (id.startsWith('§')) return new RegExp(`^#+ ${escape(id.slice(1))} `, 'm').test(SPEC);
  return new RegExp(`^### ${escape(id)}\\. `, 'm').test(DECISIONS);
}

/**
 * Every "why" the screens point at, from every module in ui/words/. Loaded
 * with Vite's glob rather than a file URL, which the project folder's spaces
 * break.
 */
const WORD_MODULES = import.meta.glob('../ui/words/*.js', { eager: true });

async function screenWhys() {
  expect(Object.keys(WORD_MODULES).length).toBeGreaterThan(0);
  const whys = new Set();
  for (const module of Object.values(WORD_MODULES)) {
    for (const group of Object.values(module)) {
      if (typeof group !== 'object' || group === null) continue;
      for (const entry of Object.values(group)) if (entry?.why) whys.add(entry.why);
    }
  }
  return whys;
}

const base = {
  title: 'A title',
  real: () => 'How real Google Ads does it.',
  realSources: [{ label: 'Google Ads Help', url: 'https://support.google.com/google-ads/' }],
  game: () => 'What this game does.',
  cites: ['I27'],
  yourAccount: 'returns',
};

describe('a chapter is refused unless it is whole', () => {
  test('a whole chapter is accepted', () => {
    expect(chapter(base).title).toBe('A title');
  });

  test('it needs a title, a real half and a game half', () => {
    expect(() => chapter({ ...base, title: '' })).toThrow();
    expect(() => chapter({ ...base, real: undefined })).toThrow();
    expect(() => chapter({ ...base, game: undefined })).toThrow();
  });

  test('the real half needs a source, unless the chapter is a game device', () => {
    expect(() => chapter({ ...base, realSources: [] })).toThrow(/source/);
    expect(chapter({ ...base, realSources: [], device: true }).device).toBe(true);
  });

  test('the game half must cite something', () => {
    expect(() => chapter({ ...base, cites: [] })).toThrow(/cite/);
  });
});

describe('the chapters', () => {
  const entries = Object.entries(CHAPTERS);

  test('there are chapters to check', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  test.each(entries)('%s: each half is under 120 words', (_, c) => {
    for (const half of [c.real(FIGURES), c.game(FIGURES)]) {
      expect(wordCount(half)).toBeGreaterThan(10);
      expect(wordCount(half)).toBeLessThanOrEqual(120);
    }
  });

  test.each(entries)('%s: every citation exists in DECISIONS.md or the spec', (_, c) => {
    for (const id of c.cites) expect(cited(id), id).toBe(true);
  });

  test.each(entries)('%s: every real source is a link, unless it is a device', (_, c) => {
    if (c.device) return;
    expect(c.realSources.length).toBeGreaterThan(0);
    for (const source of c.realSources) expect(source.url).toMatch(/^https:\/\//);
  });

  test.each(entries)('%s: the game half and the title type no number', (_, c) => {
    const blank = Object.fromEntries(c.needs.map((name) => [name, 'X']));
    expect(c.title).not.toMatch(/\d/);
    expect(c.game(blank)).not.toMatch(/\d/);
  });

  test.each(entries)('%s: it renders whole with the figures the game supplies', (_, c) => {
    for (const name of c.needs) expect(Object.keys(FIGURES), name).toContain(name);
    expect(`${c.real(FIGURES)} ${c.game(FIGURES)}`).not.toMatch(/undefined|NaN/);
  });

  test.each(entries)('%s: "in your account" points at a card that exists', (_, c) => {
    // On the page itself, or on one of the decision form's cards, which the form
    // draws in place of the page's own `decisions` slot. Pointing at that slot
    // would leave a button that does nothing: it is gone once the form draws.
    expect(c.yourAccount).not.toBe('decisions');
    const onPage = INDEX.includes(`data-slot="${c.yourAccount}"`);
    const onForm = DECISIONS_FORM.includes(`dataset.slot = '${c.yourAccount}'`);
    expect(onPage || onForm, c.yourAccount).toBe(true);
  });

  test.each(entries)('%s: related chapters exist', (_, c) => {
    for (const id of c.related) expect(Object.keys(CHAPTERS), id).toContain(id);
  });
});

describe('every chapter can be reached, and every link lands', () => {
  test('every "why" on a screen names a chapter', async () => {
    for (const why of await screenWhys()) expect(Object.keys(CHAPTERS), why).toContain(why);
  });

  test('the contents list names only chapters', () => {
    for (const id of CONTENTS) expect(Object.keys(CHAPTERS), id).toContain(id);
  });

  test('no chapter is an orphan', async () => {
    const reachable = new Set([...(await screenWhys()), ...CONTENTS]);
    for (const id of Object.keys(CHAPTERS)) expect(reachable.has(id), id).toBe(true);
  });
});
