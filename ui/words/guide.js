/**
 * The field guide's own labels: the drawer's chrome and the "why?" that opens it.
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
  sources: line('label', 'Sources:'),
  showCard: line('label', 'Show me on the card'),
  next: line('label', ({ title }) => `Next: ${title}`),
});
