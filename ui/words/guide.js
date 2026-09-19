/**
 * The field guide's own labels: the drawer's chrome, the "why?" that opens it,
 * and the Studio's Guide page (ui/guide/page.js).
 *
 * Kept here rather than in `ui/guide/drawer.js` for the same reason every card's
 * words are: `tests/words.test.js` holds this folder to its rules, and the
 * drawing code then holds no wording of its own.
 */

import { line } from './line.js';

export const GUIDE = Object.freeze({
  why: line('label', 'why?'),
  whyFor: line('label', ({ title }) => `Open the field guide: ${title}`),
  name: line('label', 'Field guide'),
  contents: line('label', 'Contents'),
  close: line('label', 'Close the field guide'),
  real: line('label', 'In real Google Ads'),
  game: line('label', 'In this game'),
  // Not "Where it departs": that word is retired from the guide's prose, and a
  // beginner has never met it in this sense (plans/2026-09-19-guide-rewrite.md).
  departs: line('label', 'Not like the real thing'),
  sources: line('label', 'Sources:'),
  showCard: line('label', 'Show me on the card'),
  // The Studio's: what it marks is often one part of a section, not a card.
  showAccount: line('label', 'Show me in your account'),
  next: line('label', ({ title }) => `Next: ${title}`),

  // The Guide as a page, in the Studio (the owner's choice, 2026-09-15,
  // design/guide/): the contents, and one chapter at a time.
  intro: line('reading', 'Each chapter comes in two halves: what real Google Ads does, and what this game '
    + 'does and where it departs. Read them in order, or open the one beside whatever you are looking at: '
    + 'a “why?” anywhere in the game opens its chapter in a drawer beside you.'),
  chapterOf: line('label', ({ n, of }) => `Chapter ${n} of ${of}`),
  explains: line('label', 'Explains:'),
  readBeside: line('label', 'Read beside it:'),
  numbered: line('label', ({ n, title }) => `${n} · ${title}`),
});
