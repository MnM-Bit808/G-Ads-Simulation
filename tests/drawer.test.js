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
import { CHAPTERS, CONTENTS, GOING_DEEPER } from '../ui/guide/chapters.js';

// The two-halves tests read GOING_DEEPER. A ground-floor chapter has one plain
// paragraph, no citation and no card, and is held to its own rules in
// tests/guide.test.js (plans/2026-09-19-ground-floor-plan.md).

import { guideFigures } from '../ui/guide/figures.js';

const FIGURES = guideFigures();
const read = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');

describe('the drawer shows a chapter whole', () => {
  test.each(GOING_DEEPER)('%s opens with a title, both halves and its sources', (id) => {
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

  // Found playing it: What people typed's list and Results' note on the replays
  // have no heading, and focus fell to the page there.
  test('and to the part itself when it has none, so a keyboard player keeps their place', () => {
    expect(read('ui/guide/drawer.js')).toContain("card.querySelector('h2, h3') ?? card");
    expect(read('ui/studio.css')).toMatch(/body\.studio \[data-slot\]\[tabindex="-1"\]:focus \{ outline: none; \}/);
  });

  test('in the Studio it says "in your account", where a part is often not a card of its own', () => {
    expect(read('ui/guide/drawer.js')).toContain('GUIDE.showAccount()');
  });
});

// The Guide as a page (the owner's choice, 2026-09-15): in the Studio the
// book is a page of its own, so the drawer's Contents opens that rather than
// a second, narrower contents; "why?" still opens the drawer.
describe('in the Studio, the drawer\'s Contents opens the Guide page', () => {
  test('it asks for the page first, and keeps its own list for the classic look and round 0', () => {
    const source = read('ui/guide/drawer.js');
    expect(source).toMatch(/if \(contentsPage\(\)\) close\(\{ restoreFocus: false \}\);\s*else openContents\(\);/);
  });

  test('the page opens a part through the drawer\'s own Show me, so both mark it the same way', () => {
    expect(read('ui/guide/drawer.js')).toMatch(/return \{ node, open, openContents, close, showCard \};/);
    expect(read('ui/app.js')).toContain('showCard: guide.showCard');
  });
});

describe('the player sees sources, never the ledger', () => {
  test.each(GOING_DEEPER)('%s carries no DECISIONS citation', (id) => {
    const view = guideView(id, FIGURES);
    expect(view).not.toHaveProperty('cites');
    for (const cite of CHAPTERS[id].cites) {
      expect(JSON.stringify(view)).not.toContain(`"${cite}"`);
    }
  });
});

describe('a ground-floor chapter opens as one column', () => {
  test('it has one plain paragraph, and none of a nuance chapter’s parts', () => {
    const view = guideView('breakEven', FIGURES);
    expect(view.kind).toBe('basic');
    expect(view.plain).toBeTruthy();
    expect(view.real).toBeUndefined();
    expect(view.game).toBeUndefined();
    expect(view.departs).toBeUndefined();
  });

  // What it offers instead of a second half: the chapter that continues it,
  // and owns the departure it does not state.
  test('it offers the chapter that continues it', () => {
    const view = guideView('breakEven', FIGURES);
    expect(view.then.id).toBe('kindMarket');
    expect(view.then.title).toBe(CHAPTERS.kindMarket.title);
  });

  test('it still carries its source, and says which step asks for it', () => {
    const view = guideView('breakEven', FIGURES);
    expect(view.sources.length).toBeGreaterThan(0);
    expect(view.sources[0].url).toMatch(/^https:\/\/support\.google\.com\//);
    expect(view.step).toBe(1);
  });
});
