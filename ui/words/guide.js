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
  // Where several figures share a chapter — Your week's net profit, ROAS and
  // cost per conversion all open the same one — the figure has to be in the
  // label, or a screen reader hears the same button three times in a row.
  whyForFigure: line('label', ({ figure, title }) => `${figure}: open the field guide: ${title}`),
  name: line('label', 'Field guide'),
  contents: line('label', 'Contents'),
  close: line('label', 'Close the field guide'),
  real: line('label', 'In real Google Ads'),
  game: line('label', 'In this game'),
  // The contents in two groups: what a control IS, then why it behaves oddly.
  // The split is itself teaching (plans/2026-09-19-ground-floor.md, 2.2).
  startHere: line('label', 'Start here'),
  goingDeeper: line('label', 'Going deeper'),
  // A ground-floor chapter has no card to show before a game exists, so what it
  // offers instead is the chapter that continues it — and owns the departure it
  // does not state.
  readOn: line('instruction', ({ title }) => `Read on: ${title}`),
  usedIn: line('label', ({ step }) => `Used in step ${step}`),
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
  // Rewritten 2026-09-19: it promised two halves of every chapter, which the
  // ground floor does not have, and used the one word the guide retired.
  intro: line('reading', 'Start here says what each thing is, and where you use it. '
    + 'Going deeper sets what this game does beside what real Google Ads does. '
    + 'Read them in order, or open the one beside whatever you are looking at: '
    + 'a “why?” anywhere in the game opens its chapter in a drawer beside you.'),
  // WHAT THE GUIDE OWED THE PLAYER AND HAD NEVER SAID (2026-09-20). Of the
  // numbers `engine/constants.js` tags, 59 of 79 are INVENTED and 8 are
  // DOCUMENTED — and nothing on screen said so. A player finished believing
  // they had learned magnitudes when they had only learned directions, which is
  // the one failure CLAUDE.md names as worse than no simulator at all: they
  // cannot tell the difference.
  //
  // IT MAKES NO CLAIM ABOUT GOOGLE, deliberately. Every sentence is about THIS
  // game's own numbers and is checkable in this repository, so it needs no
  // source fetched and cannot rot into a false claim about the real thing.
  // `tests/guide.test.js` fails if the provenance ever stops matching it —
  // which would be a good problem, and a rewrite rather than a deletion.
  whatIsReal: line('reading', 'One thing to know before you trust a number here. '
    + 'The way this game works is real: how the auction ranks you, how a budget runs out, '
    + 'how sales land late, and how returns rewrite a week you have already read. '
    + 'The sizes are mostly invented. Only a handful of its numbers come from a published '
    + 'source; the rest were chosen so the market would hold together. Returns are the '
    + 'exception, and are published Indian figures. So trust this game on which way a '
    + 'lever moves, not on how much.'),
  chapterOf: line('label', ({ n, of }) => `Chapter ${n} of ${of}`),
  explains: line('label', 'Explains:'),
  readBeside: line('label', 'Read beside it:'),
  numbered: line('label', ({ n, title }) => `${n} · ${title}`),
});
