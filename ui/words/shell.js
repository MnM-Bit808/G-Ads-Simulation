/**
 * The Studio layout's own words: the top bar, the tray, the locks
 * (plans/2026-09-13-studio-makeover.md, section 2). Section names live with
 * the sections, in ui/shell/sections.js.
 */

import { line } from './line.js';

export const SHELL = Object.freeze({
  week: line('label', ({ played, total }) => `Week ${played} of ${total}`),
  saved: line('label', 'saved'),
  notSaved: line('label', 'not saved'),
  month: line('label', ({ month }) => `Month ${month}`),
  spent: line('label', ({ spent, budget }) => `${spent} of ${budget} spent`),
  changes: line('label', ({ n }) => (n === 1 ? 'change waiting' : 'changes waiting')),
  empty: line('instruction', 'No changes yet. Anything you change, in any section, lands here.'),
  // After the last week there is nothing left to change (design/results/).
  done: line('reading', ({ weeks }) => `The ${weeks} weeks are done.`),
  run: line('instruction', ({ week }) => `Run week ${week}`),
  running: line('label', ({ hours }) => `running ${hours} hours…`),
  gameOver: line('label', 'Game over'),
  undo: line('instruction', 'Undo this change'),
  lockChip: line('label', ({ week }) => `week ${week}`),
  opensAt: line('reading', ({ week }) => `Opens at week ${week}.`),
  returnsLocked: line('reading', 'Before then there is no honest reading of what came back.'),
  resultsLocked: line('reading', 'Opens after the last week, with the debrief and the rival reveal.'),
  redo: line('instruction', ({ round }) => `Redo round ${round}`),
  playtest: line('instruction', 'Send playtest file'),
  playtestShort: line('label', 'Playtest'),
  menu: line('label', 'Sections'),
  fresh: line('label', 'Something new here'),

  // THE ONE WEEK WITH A DEADLINE IN IT (2026-09-19). Both capital windows and
  // the only chance to move are open before this week, and until now the only
  // sign was a dot on Your money in the rail. Playing twelve weeks by pressing
  // Run each time missed it entirely, and Results then said so at the end:
  // "You built nothing: both allocations went into your ad budget."
  //
  // IT DOES NOT MAKE YOU DECIDE. Uncommitted capital becoming ad budget is
  // deliberate (13.3, so that not investing stays viable), so skipping is a
  // real choice. The aim is only that it cannot be skipped unknowingly, which
  // is why the question is asked once and never again once Your money has been
  // opened that week.
  // WHAT IS OPEN IS SAID IN THREE PIECES, as Your money's own panel already
  // says it (MONEY.windowBoth / windowCapital / windowMove). The two halves
  // open together in every game the engine starts, but a line that assumes so
  // would be a sentence the screen could not back up.
  windowOpen: line('reading', ({ week, what }) => `Week ${week} only: ${what}.`),
  windowBoth: line('label', ({ amount }) => `${amount} to invest, and your one chance to move where your brand sits`),
  windowCapital: line('label', ({ amount }) => `${amount} to invest`),
  windowMove: line('label', 'your one chance to move where your brand sits'),
  windowGo: line('instruction', 'Open Your money'),

  windowAsk: line('reading', ({ week, cost }) => `Run week ${week} without deciding? ${cost}`),
  askBoth: line('label', ({ amount }) => `The ${amount} becomes ad budget, and where your brand `
    + 'sits is fixed for the rest of the game.'),
  askCapital: line('label', ({ amount }) => `The ${amount} becomes ad budget.`),
  askMove: line('label', 'Where your brand sits is fixed for the rest of the game.'),
  windowRunAnyway: line('instruction', ({ week }) => `Run week ${week} anyway`),
});
