/**
 * The Studio's front door (design/switch-over/, A, the owner's choice of
 * 2026-09-16): the words before a game opens.
 *
 * The resume offer's, restoring's and a changed game's are the ones the classic
 * panels have used since stage A4 (ui/app.js). New here, and checked by a
 * second reader: a finished game's own title and lines, since "everything as
 * you left it" was never true of the results (the reveal starts again); the
 * table of the weeks a replay changed; and a save this version cannot open,
 * which offers no second try, because a replay fails the same way every time.
 */

import { line } from './line.js';

export const DOOR = Object.freeze({
  saved: line('label', 'saved in this browser'),
  inProgress: line('label', 'A game in progress'),
  finished: line('label', 'A finished game'),
  played: line('label', ({ played, total }) => `${played} of ${total} weeks played`),
  replayNote: line('reading', 'Resuming replays those weeks from your own decisions, which takes a few seconds.'),
  finishedNote: line('reading', ({ total }) => `Opening it replays all ${total} weeks from your own decisions, `
    + 'which takes a few seconds.'),
  resume: line('label', ({ week }) => `Resume at week ${week}`),
  resumeWhy: line('reading', 'Everything as you left it, except changes you had staged and not yet run.'),
  backToResults: line('label', 'Back to the results'),
  backWhy: line('reading', 'The Results area, from its first section.'),
  startNew: line('label', 'Start a new game'),
  startNewWhy: line('reading', 'Discards the saved game. There is no getting it back.'),
  discardWhy: line('reading', 'Discards the saved game.'),
  restoring: line('label', 'Restoring your game'),
  replaying: line('label', ({ week, of }) => `Replaying week ${week} of ${of}…`),
  changedTitle: line('label', 'This game has changed since you saved it'),
  changedNote: line('reading', 'The simulator has been updated since this game was saved. Replayed on this version, '
    + 'your own decisions produce different weeks from the ones you played, so the numbers you would see are this '
    + 'version’s, not the ones you read at the time.'),
  whenSaved: line('label', 'when saved'),
  replayedNow: line('label', 'replayed now'),
  week: line('label', ({ week }) => `Week ${week}`),
  spendOn: line('label', ({ spend, clicks }) => `${spend} on ${clicks} clicks`),
  moreDiffer: line('label', ({ n }) => `and ${n} more ${n === 1 ? 'week differs' : 'weeks differ'}`),
  carryOn: line('label', 'Continue with these numbers'),
  carryOnWhy: line('reading', 'Carry on from here on the updated simulator.'),
  failedTitle: line('label', 'This version cannot open your saved game'),
  failedNote: line('reading', 'Opening it fails on this version, and would fail the same way every time. It stays in '
    + 'this browser until you start a new game, so a later version may open it.'),
  playtestOnly: line('label', 'on the playtest link only'),
});
