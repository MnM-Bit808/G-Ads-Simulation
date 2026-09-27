/**
 * The week playing out (plans/2026-09-27-week-playout.md): seven steps between
 * pressing Run and reading the dashboard.
 *
 * WHY IT EXISTS. The first playtest file anyone sent showed a stranger reading
 * the opening minute properly — 114 seconds, nothing hidden, nothing idle —
 * and then never finishing round 0. The opening minute teaches the ladder, and
 * then the game never shows a ladder again: every week is a form you submit and
 * a table you read. This is the auction coming back, weekly, with the player's
 * own numbers in it.
 *
 * NOT ONE FIGURE IS COMPUTED HERE, as in every other `ui/words/` file. Each
 * sentence is handed what `ui/playout/read.js` read off the week's own report,
 * and can only phrase it.
 *
 * NO NUMBER COUNTS UP TO ANYTHING (I52's honesty rule, which refused a counting
 * ticker). Every figure below arrives at its final value; what moves is which
 * step is on screen, never a digit on its way to an answer.
 *
 * IT SAYS "YOU". The first run says "she" and "Marlow" because the player has
 * chosen nothing yet; by the time a week has run, every figure here is theirs.
 */

import { line } from './line.js';

export const PLAYOUT = Object.freeze({
  // Step 1: the pool. Every search the account's keywords matched.
  s1Kicker: line('label', 'Searches you could have been in'),
  // It must not echo its own kicker, which already says "could have been in".
  s1Say: line('reading', 'Each one held an auction, and your keywords entered you into it.'),
  s1Sub: line('label', 'matched your keywords'),

  // Step 2: how many of them you were actually in.
  s2Kicker: line('label', 'Where you actually appeared'),
  s2Say: line('reading', 'Being shown costs nothing. Nobody has clicked yet.'),
  s2Sub: line('label', 'you were shown'),

  // STEP 3 IS THE ONE THAT EARNS THE SEQUENCE. Lost-to-budget is a figure on
  // the dashboard that nobody reads, and for the week measured while this was
  // designed it was THIRTY PER CENT — a third of the account's reach, gone to a
  // number the player set and can change. It gets a step to itself.
  s3Kicker: line('label', 'Why you missed the rest'),
  s3Budget: line('label', 'the money ran out'),
  s3Rank: line('label', 'you were outranked'),
  s3Say: line('reading', 'There are two ways to miss one: the money is gone, '
    + 'or somebody outbid you.'),
  // Said only when the budget is the bigger of the two, which is the case worth
  // naming: rank is a bidding problem, budget is a spending one.
  s3Note: line('reading', 'Budget, not bidding, is what kept you out of most of them.'),

  // STEP 4 IS THE THESIS: beat 4's ladder, weekly, with the player in it.
  // The place numbers are NOT here. A slot's number is a figure, and the first
  // run's ladder reads its own from `tableFor` for the same reason: a word file
  // that types "1st" is typing a number by hand.
  s4Kicker: line('label', 'Where you sat when you were shown'),
  // NAMING A RIVAL IS THE ONE PLACE THIS COULD TEACH SOMETHING FALSE, so the
  // sentence says exactly what the figure means. `positionAboveRate` is "of the
  // auctions we BOTH appeared in, how often they were above me" — not how often
  // they took slot one, and not a share of the week. A rival that never met you
  // reads zero on that figure for want of a denominator, so only rivals with a
  // real overlap are ever named (`ui/playout/read.js`).
  s4Met: line('reading', ({ met, rivals }) => `You ran against ${met} of your ${rivals} rivals.`),
  s4Above: line('reading', ({ rival, aboveRate }) => `${rival} was above you in ${aboveRate} `
    + 'of the searches you appeared in.'),
  s4Clear: line('reading', 'Not one of them was ever above you.'),

  // Step 5: the clicks, and what they cost.
  s5Kicker: line('label', 'Who clicked'),
  s5Say: line('reading', 'You paid for every visit, whether or not it ends in a sale.'),
  s5Clicks: line('label', 'clicked'),
  s5Cost: line('label', 'it cost you'),

  // Step 6: the sales that have landed.
  s6Kicker: line('label', 'Who bought'),
  s6Say: line('reading', 'That is what the week has actually bought so far.'),
  s6Sub: line('label', 'orders so far'),

  // STEP 7 IS A RELOCATION, NOT AN ADDITION. The attribution delay is the first
  // run's beat 8, which the one recorded stranger gave 4.3 seconds — ninety
  // seconds before they had clicked anything. Here it is true of them, and it
  // is also what the revision mark on Your week (I56) exists to show.
  s7Kicker: line('label', 'And who has not decided yet'),
  s7Note: line('reading', 'They land over the next few weeks, and this week’s numbers change when they do.'),
  s7Sub: line('label', 'still deciding'),
  // Said instead of s7Say when nothing is outstanding, which a late week can do.
  s7None: line('reading', 'Every click this week has already settled.'),

  // The controls.
  skip: line('instruction', 'Skip'),
  done: line('instruction', 'See the week'),
  watch: line('instruction', 'Watch the week'),
  stepOf: line('label', ({ at, of }) => `${at} of ${of}`),
});
