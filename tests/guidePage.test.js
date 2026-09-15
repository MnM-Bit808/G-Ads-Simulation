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
import { chapterList, contentsCards, chapterPage, openingSentence } from '../ui/guide/book.js';
import { guideView } from '../ui/guide/drawer.js';
import { CHAPTERS, CONTENTS } from '../ui/guide/chapters.js';
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
    for (const c of contentsCards(FIGURES)) expect(c.section, c.id).toBe(sectionOf(target(c.id)).label);
  });

  test('and opens with the first sentence of its real half, whole', () => {
    for (const c of contentsCards(FIGURES)) {
      expect(c.opening, c.id).toMatch(/\.$/);
      expect(CHAPTERS[c.id].real(FIGURES).startsWith(c.opening.slice(0, -1)), c.id).toBe(true);
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

  test.each(CONTENTS)('%s reads exactly as the drawer shows it', (id) => {
    const page = chapterPage(id, FIGURES);
    const view = guideView(id, FIGURES);
    expect([page.title, page.real, page.game]).toEqual([view.title, view.real, view.game]);
    expect(page.sources).toEqual(view.sources);
  });

  test.each(CONTENTS)('%s: Show me opens the part the Studio draws for it', (id) => {
    const page = chapterPage(id, FIGURES);
    expect(page.slot).toBe(target(id));
    expect(page.section).toBe(sectionOf(target(id)).label);
  });

  test('its chapters to read beside it come numbered, as "Read beside it" shows them', () => {
    expect(chapterPage('cashOnDelivery', FIGURES).related).toEqual([
      { id: 'returnsSplit', n: 2, title: CHAPTERS.returnsSplit.title },
      { id: 'hours', n: 10, title: CHAPTERS.hours.title },
    ]);
    expect(chapterPage('ownName', FIGURES).related).toEqual([]);
  });
});
