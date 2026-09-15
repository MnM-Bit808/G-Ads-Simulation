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

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test, expect } from 'vitest';
import { guideView } from '../ui/guide/drawer.js';
import { CHAPTERS, CONTENTS } from '../ui/guide/chapters.js';
import { guideFigures } from '../ui/guide/figures.js';

const FIGURES = guideFigures();
const read = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');

describe('the drawer shows a chapter whole', () => {
  test.each(CONTENTS)('%s opens with a title, both halves and its sources', (id) => {
    const view = guideView(id, FIGURES);
    expect(view.title).toBe(CHAPTERS[id].title);
    expect(view.real.length).toBeGreaterThan(0);
    expect(view.game.length).toBeGreaterThan(0);
    expect(`${view.title} ${view.real} ${view.game}`).not.toMatch(/undefined|NaN/);
    expect(view.sources).toEqual(CHAPTERS[id].realSources.map(({ label, url }) => ({ label, url })));
    expect(view.yourAccount).toBe(CHAPTERS[id].yourAccount);
    // In the Studio a chapter may point at a part only it draws.
    expect(view.studioAccount).toBe(CHAPTERS[id].studioAccount ?? CHAPTERS[id].yourAccount);
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

// Found drawing the Guide as a page (2026-09-15): the mark was drawn only on
// the classic `.card[data-slot]`, and focus looked for a card's h2, so in every
// rebuilt Studio section "Show me" opened the section and marked nothing. The
// drawer is DOM and played; these hold the two rules it depends on.
describe('"Show me" marks what it lands on, in the Studio too', () => {
  test('the Studio rings any part the guide points at, not only a classic card', () => {
    const css = read('ui/studio.css');
    expect(css).toMatch(/body\.studio \[data-slot\]::after \{[^}]*opacity: 0;/);
    expect(css).toMatch(/body\.studio \[data-slot\]\.guide-marked::after \{ opacity: 1; \}/);
  });

  test('and it fades on opacity alone, as the makeover\'s motion rules ask', () => {
    const ring = read('ui/studio.css').match(/body\.studio \[data-slot\]::after \{([^}]*)\}/)[1];
    expect(ring).toMatch(/transition: opacity \d+ms var\(--studio-ease\)/);
    expect(ring).not.toMatch(/transition:[^;]*(box-shadow|outline)/);
  });

  test('focus goes to the part\'s own heading, which a Studio part draws as an h3', () => {
    expect(read('ui/guide/drawer.js')).toContain("querySelector('h2, h3')");
  });

  test('in the Studio it says "in your account", where a part is often not a card of its own', () => {
    expect(read('ui/guide/drawer.js')).toContain('GUIDE.showAccount()');
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
