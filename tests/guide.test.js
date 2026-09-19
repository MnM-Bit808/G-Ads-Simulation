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
import { sectionOf } from '../ui/shell/sections.js';
import { MAX_BID_MULTIPLE } from '../engine/constants.js';

const read = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');
const DECISIONS = read('DECISIONS.md');
const SPEC = read('ENGINE_SPEC_v0.3.md');
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
  // Since 2026-09-19 a chapter must say where it departs, or why it does not.
  departs: ['and here is the one way it is not like the real thing'],
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

  /**
   * The attribution chapter's example names two days doing two different jobs:
   * the day the sale is COUNTED ON, and the day the figure MOVES. It once said
   * "adds a conversion to Monday, on Friday", which is true — Google Ads Help,
   * *Understand your conversion tracking data*: "if your ad was clicked on last
   * week and that traffic converted this week, both the click and the
   * conversion are reported back to last week" — and read as a typo, in the one
   * chapter whose job is explaining why a number a player has already read
   * changes afterwards. The owner read it as an error (2026-09-16), which is
   * the only test that matters for a sentence.
   */
  test('the attribution chapter keeps its two days apart', () => {
    const real = CHAPTERS.attributionLag.real(FIGURES);
    // The sale is counted on the day of the click.
    expect(real).toMatch(/counted on Monday, the day of the click/);
    // And the figure moves later, which is a separate clause.
    expect(real).toMatch(/change on Friday/);
    expect(real).not.toMatch(/adds a conversion to Monday, on Friday/);
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

  test.each(entries)('%s: "in your account" points at a part that exists', (_, c) => {
    // Until the switch-over's part 2 this asked the classic page and the
    // decision form. The page is gone, so the part a chapter points at is one a
    // Studio section draws; tests/sections.test.js holds the other half, that
    // the section's own module really sets the slot.
    expect(c.yourAccount).not.toBe('decisions');
    expect(sectionOf(c.studioAccount ?? c.yourAccount), c.yourAccount).not.toBeNull();
  });

  test.each(entries)('%s: related chapters exist', (_, c) => {
    for (const id of c.related) expect(Object.keys(CHAPTERS), id).toContain(id);
  });

  // The Guide page shows `related` as "Read beside it", so the owner asked for a
  // read-through first (2026-09-15). Its one rule: chapters that rest on the same
  // departure read beside each other, as the two under the bid cap now do.
  test('the chapters that cite the bid cap read beside each other (D13)', () => {
    const capped = entries.filter(([, c]) => c.cites.includes('D13')).map(([id]) => id);
    expect(capped.length).toBeGreaterThan(1);
    for (const id of capped) {
      for (const other of capped) if (other !== id) expect(CHAPTERS[id].related, id).toContain(other);
    }
  });

  // Found drawing the Guide as a page (2026-09-15): two chapters named a classic
  // card ("the returns card", "The share card") that the Studio does not draw.
  // What the game does is said of the figure, so it reads true in both looks.
  test.each(entries)('%s: what the game does names no card', (_, c) => {
    expect(c.game(FIGURES)).not.toMatch(/\bcards?\b/i);
  });

  // Places scale an account's returns (LOCATION_RETURN_MULTIPLIER, normalised
  // to the country; F14 holds its effect on send-backs open). Drawing the Guide
  // page put this chapter beside an account sending back 28.0% of delivered
  // orders against its 30% (2026-09-15).
  test('the returns chapter gives the send-back rate as the country\'s, which where you sell moves', () => {
    const game = CHAPTERS.returnsSplit.game(FIGURES);
    expect(game).toContain(`${FIGURES.postDelivery} of delivered orders across the country`);
    expect(game).toContain('depending on where you sell');
    expect(CHAPTERS.returnsSplit.cites).toContain('F14');
  });

  test('the chapters with a bid adjustment say no bid passes the cap, and cite it (D13)', () => {
    // Where and when's bars stop at the cap and say so (2026-09-15); the guide
    // behind their "why?" links has to agree, from the constant itself.
    expect(FIGURES.bidCap).toBe(`${MAX_BID_MULTIPLE} times`);
    for (const id of ['hours', 'cashOnDelivery']) {
      // The cap is a DEPARTURE, so from 2026-09-19 it may be said in the block
      // rather than the half. It must still be said, and still as a figure —
      // which is why a departure may be a function of the figures it quotes.
      const said = [CHAPTERS[id].game(FIGURES), ...CHAPTERS[id].departs.map((d) => d(FIGURES))];
      expect(said.some((text) => text.includes(`${FIGURES.bidCap} your keyword bid`)), id).toBe(true);
      expect(CHAPTERS[id].cites, id).toContain('D13');
    }
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

describe('a departure is a field, not a sentence buried in the prose', () => {
  // MEASURED 2026-09-19: in `hours` the departure ran to 73 words of 109, and
  // in `cashOnDelivery` 65 of 118 — the two chapters both testers named as the
  // hardest to read. And five more chapters declared no departure while stating
  // one inside their prose, where no reader could find it and no test could
  // reach it. So it becomes a field of its own.
  const departures = (id) => CHAPTERS[id].departs.map((entry) => entry(FIGURES));

  test('a chapter declares its departures as a list', () => {
    expect(CHAPTERS.hours.departs).toBeInstanceOf(Array);
    expect(departures('hours')).toHaveLength(3);
  });

  test('each one is short enough to read on its own', () => {
    for (const line of departures('hours')) {
      expect(wordCount(line), line).toBeLessThanOrEqual(25);
    }
  });

  // A departure is no less a claim than the half it came out of, so it types no
  // number either: it may be a function of the figures it quotes, exactly as
  // the two halves are (the owner's choice, 2026-09-19). `hours` quotes the bid
  // cap, which is MAX_BID_MULTIPLE and must not become the typed word "four".
  test('a departure may quote a figure, and it arrives from the engine', () => {
    const capped = departures('hours').find((line) => line.includes(FIGURES.bidCap));
    expect(capped, 'the cap should reach the reader as a figure').toBeTruthy();
    expect(capped).toContain(`${MAX_BID_MULTIPLE} times`);
    expect(CHAPTERS.hours.needs).toContain('bidCap');
  });

  test('a plain string is allowed too, and comes back as a line', () => {
    const made = chapter({
      title: 'x', real: () => 'y', realSources: [{ label: 'a', url: 'b' }],
      game: () => 'z', cites: ['A1'], yourAccount: 'terms',
      departs: ['the game does this its own way'],
    });
    expect(made.departs[0]({})).toBe('the game does this its own way');
  });

  // The word itself goes. It is the name of the field now, and a beginner has
  // never met it in this sense; the block's own heading says what it is.
  test('the chapter that had three departures no longer says so in prose', () => {
    expect(CHAPTERS.hours.game(FIGURES)).not.toMatch(/departs?/i);
  });

  test('a chapter with none says so in words, so the claim can be checked', () => {
    const made = chapter({
      title: 'x', real: () => 'y', realSources: [{ label: 'a', url: 'b' }],
      game: () => 'z', cites: ['A1'], yourAccount: 'terms',
      departsNot: 'the game does this exactly as Google does',
    });
    expect(made.departs).toEqual([]);
    expect(made.departsNot).toMatch(/exactly/);
  });

  test('a boolean is refused, because a reason can be checked and true cannot', () => {
    expect(() => chapter({
      title: 'x', real: () => 'y', realSources: [{ label: 'a', url: 'b' }],
      game: () => 'z', cites: ['A1'], yourAccount: 'terms', departsNot: true,
    })).toThrow(/reason/);
  });

  test('declaring both, or neither, is refused', () => {
    const base = {
      title: 'x', real: () => 'y', realSources: [{ label: 'a', url: 'b' }],
      game: () => 'z', cites: ['A1'], yourAccount: 'terms',
    };
    expect(() => chapter({ ...base, departs: ['one'], departsNot: 'none' })).toThrow(/both/);
    expect(() => chapter({ ...base })).toThrow(/where it departs/);
  });
});
