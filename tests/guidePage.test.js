/**
 * The Guide as a page (the owner's choice, 2026-09-15, design/guide/).
 *
 * The page is DOM and is checked by playing. What it shows is decided in
 * ui/guide/book.js and held here: the contents in reading order, each card
 * naming the Studio section its chapter explains; a chapter's place in the
 * book, its two halves exactly as the drawer shows them, the part Show me
 * opens, and the chapters around it.
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chapterList, contentsCards, chapterPage, openingSentence } from '../ui/guide/book.js';
import { guideView } from '../ui/guide/drawer.js';
import { CHAPTERS, CONTENTS, START_HERE, GOING_DEEPER } from '../ui/guide/chapters.js';

// The two-halves tests read GOING_DEEPER. A ground-floor chapter has one plain
// paragraph, no citation and no card, and is held to its own rules in
// tests/guide.test.js (plans/2026-09-19-ground-floor-plan.md).

import { guideFigures } from '../ui/guide/figures.js';
import { sectionOf } from '../ui/shell/sections.js';

const FIGURES = guideFigures();
const target = (id) => CHAPTERS[id].studioAccount ?? CHAPTERS[id].yourAccount;

describe('the Guide area\'s list', () => {
  test('every chapter by its number, in reading order', () => {
    expect(chapterList()).toEqual(CONTENTS.map((id, i) => ({ id, n: i + 1, title: CHAPTERS[id].title })));
  });
});

describe('the contents', () => {
  test('a card for every chapter, in reading order', () => {
    expect(contentsCards(FIGURES).map((c) => [c.id, c.n])).toEqual(CONTENTS.map((id, i) => [id, i + 1]));
  });

  test('each names the Studio section its chapter explains', () => {
    for (const c of contentsCards(FIGURES).filter((x) => x.group === 'deeper')) {
      expect(c.section, c.id).toBe(sectionOf(target(c.id)).label);
    }
  });

  // A ground-floor card names the round 0 step that asks for it instead: it is
  // opened before the account exists, so it has no card to point at.
  test('a ground-floor card names its step, not a section', () => {
    for (const c of contentsCards(FIGURES).filter((x) => x.group === 'start')) {
      expect(c.section, c.id).toBeNull();
      expect(c.step, c.id).toBeGreaterThanOrEqual(1);
      expect(c.step, c.id).toBeLessThanOrEqual(5);
    }
  });

  test('and opens with the first sentence of its real half, whole', () => {
    for (const c of contentsCards(FIGURES)) {
      expect(c.opening, c.id).toMatch(/\.$/);
      const whole = c.group === 'start' ? CHAPTERS[c.id].plain(FIGURES) : CHAPTERS[c.id].real(FIGURES);
      expect(whole.startsWith(c.opening.slice(0, -1)), c.id).toBe(true);
      expect(c.opening.split(/\s+/).length, c.id).toBeGreaterThan(4);
    }
  });

  test('a figure like 2.5 does not end a sentence, and a colon closes one as a full stop', () => {
    expect(openingSentence('It rose 2.5 times. Then it fell.')).toBe('It rose 2.5 times.');
    expect(openingSentence('Google Ads budgets by the day: you set an average.')).toBe('Google Ads budgets by the day.');
    expect(openingSentence('No full stop at all')).toBe('No full stop at all');
  });
});

describe('a chapter', () => {
  test.each(CONTENTS)('%s knows its place in the book, and the chapters either side', (id) => {
    const page = chapterPage(id, FIGURES);
    const at = CONTENTS.indexOf(id);
    expect([page.n, page.of]).toEqual([at + 1, CONTENTS.length]);
    expect(page.previous?.id ?? null).toBe(at > 0 ? CONTENTS[at - 1] : null);
    expect(page.following?.id ?? null).toBe(at < CONTENTS.length - 1 ? CONTENTS[at + 1] : null);
  });

  test.each(GOING_DEEPER)('%s reads exactly as the drawer shows it', (id) => {
    const page = chapterPage(id, FIGURES);
    const view = guideView(id, FIGURES);
    expect([page.title, page.real, page.game]).toEqual([view.title, view.real, view.game]);
    expect(page.sources).toEqual(view.sources);
  });

  test.each(GOING_DEEPER)('%s: Show me opens the part the Studio draws for it', (id) => {
    const page = chapterPage(id, FIGURES);
    expect(page.slot).toBe(target(id));
    expect(page.section).toBe(sectionOf(target(id)).label);
  });

  test('its chapters to read beside it come numbered, as "Read beside it" shows them', () => {
    // The numbers count from the front of the book, and the ground floor is
    // now in front of the nuance chapters, so every one of them shifted.
    const n = (id) => CONTENTS.indexOf(id) + 1;
    expect(chapterPage('cashOnDelivery', FIGURES).related).toEqual([
      { id: 'returnsSplit', n: n('returnsSplit'), title: CHAPTERS.returnsSplit.title },
      { id: 'hours', n: n('hours'), title: CHAPTERS.hours.title },
    ]);
    expect(chapterPage('ownName', FIGURES).related).toEqual([]);
  });
});

describe('the contents shows the ground floor above the rest', () => {
  test('every card knows which group it is in', () => {
    const cards = contentsCards(FIGURES);
    expect(cards.filter((c) => c.group === 'start')).toHaveLength(START_HERE.length);
    expect(cards.filter((c) => c.group === 'deeper')).toHaveLength(GOING_DEEPER.length);
    expect(cards[0].group).toBe('start');
  });

  test('a ground-floor chapter reads as one column, with a way on', () => {
    const page = chapterPage('breakEven', FIGURES);
    expect(page.kind).toBe('basic');
    expect(page.plain).toBeTruthy();
    expect(page.real).toBeUndefined();
    expect(page.then.id).toBe('kindMarket');
    expect(page.then.n).toBe(CONTENTS.indexOf('kindMarket') + 1);
    expect(page.related).toEqual([]);
  });
});

describe('both surfaces draw both kinds', () => {
  const read = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');

  // There is no DOM in this suite, so the drawing is read as text — the same
  // way tests/sections.test.js reads it. Without a branch, the drawer renders
  // `view.real` as undefined and throws on `view.departs.length`.
  test.each(['ui/guide/drawer.js', 'ui/guide/page.js'])('%s branches on the kind', (file) => {
    const body = read(file);
    expect(body, `${file} must tell a ground-floor chapter from a nuance one`)
      .toMatch(/kind === 'basic'/);
  });

  test('each offers the chapter that continues a ground-floor one', () => {
    for (const file of ['ui/guide/drawer.js', 'ui/guide/page.js']) {
      expect(read(file), `${file} should draw a way on`).toContain('readOn');
    }
  });

  test('the contents page heads its two groups', () => {
    const body = read('ui/guide/page.js');
    expect(body).toContain('startHere');
    expect(body).toContain('goingDeeper');
  });
});
