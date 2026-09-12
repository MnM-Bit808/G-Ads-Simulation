/**
 * What the field guide's drawer shows for a chapter (stage C2, direction A).
 *
 * The drawer itself is DOM and is checked by playing. What it SHOWS is decided
 * here, by `guideView`, so the parts a test can hold are held: every chapter
 * opens whole, "Next" walks the contents in order, an unknown chapter is refused
 * rather than opening an empty drawer, and nothing from the ledger reaches the
 * player. The DECISIONS citations keep a chapter honest in the code and the
 * tests; on screen, "I28" would mean nothing (plans/…-field-guide.md, section 9).
 */

import { describe, test, expect } from 'vitest';
import { guideView } from '../ui/guide/drawer.js';
import { CHAPTERS, CONTENTS } from '../ui/guide/chapters.js';
import { guideFigures } from '../ui/guide/figures.js';

const FIGURES = guideFigures();

describe('the drawer shows a chapter whole', () => {
  test.each(CONTENTS)('%s opens with a title, both halves and its sources', (id) => {
    const view = guideView(id, FIGURES);
    expect(view.title).toBe(CHAPTERS[id].title);
    expect(view.real.length).toBeGreaterThan(0);
    expect(view.game.length).toBeGreaterThan(0);
    expect(`${view.title} ${view.real} ${view.game}`).not.toMatch(/undefined|NaN/);
    expect(view.sources).toEqual(CHAPTERS[id].realSources.map(({ label, url }) => ({ label, url })));
    expect(view.yourAccount).toBe(CHAPTERS[id].yourAccount);
  });

  test('an unknown chapter is refused, not opened empty', () => {
    expect(() => guideView('noSuchChapter', FIGURES)).toThrow(/noSuchChapter/);
  });
});

describe('"Next" walks the contents in order', () => {
  test('each chapter points at the one after it', () => {
    for (const [i, id] of CONTENTS.slice(0, -1).entries()) {
      const next = CONTENTS[i + 1];
      expect(guideView(id, FIGURES).next).toEqual({ id: next, title: CHAPTERS[next].title });
    }
  });

  test('the last chapter has no next', () => {
    expect(guideView(CONTENTS.at(-1), FIGURES).next).toBeNull();
  });
});

describe('the player sees sources, never the ledger', () => {
  test.each(CONTENTS)('%s carries no DECISIONS citation', (id) => {
    const view = guideView(id, FIGURES);
    expect(view).not.toHaveProperty('cites');
    for (const cite of CHAPTERS[id].cites) {
      expect(JSON.stringify(view)).not.toContain(`"${cite}"`);
    }
  });
});
