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
  run: line('instruction', ({ week }) => `Run week ${week}`),
  running: line('label', ({ hours }) => `running ${hours} hours…`),
  gameOver: line('label', 'Game over'),
  undo: line('instruction', 'Undo this change'),
  lockChip: line('label', ({ week }) => `week ${week}`),
  opensAt: line('reading', ({ week }) => `Opens at week ${week}.`),
  returnsLocked: line('reading', 'Before then there is no honest reading of what came back.'),
  resultsLocked: line('reading', 'Opens after the last week, with the debrief and the rival reveal.'),
  adSection: line('reading', 'Your ad is written before the first week, and its grades show in each '
    + 'keyword’s Quality Score. It moves here when this section is built.'),
  redo: line('instruction', ({ round }) => `Redo round ${round}`),
  playtest: line('instruction', 'Send playtest file'),
  playtestShort: line('label', 'Playtest'),
  menu: line('label', 'Sections'),
  fresh: line('label', 'Something new here'),
});
