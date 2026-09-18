/**
 * The Studio's front door (design/switch-over/, A, the owner's choice of
 * 2026-09-16): one card before a game opens, in five states — the game in
 * progress, restoring it, a game the simulator has changed under, a game this
 * version cannot open, and a finished game.
 *
 * What it says about a save is worked out in ./read.js; its words are in
 * ui/words/door.js. The weeks played stay red while a game replays and a bar
 * shows how far it has got: emptying the dots and filling them again read as
 * weeks lost. The line beside the bar is a status, so a screen reader hears
 * the progress the dots are hidden from.
 */

import { el, rupees, whole } from '../dom.js';
import { button } from '../kit/controls.js';
import { DOOR } from '../words/door.js';
import { SHELL } from '../words/shell.js';

const TITLES = {
  offer: DOOR.inProgress,
  finished: DOOR.finished,
  restoring: DOOR.restoring,
  changed: DOOR.changedTitle,
  failed: DOOR.failedTitle,
};

function choice(label, why, onPick, primary) {
  const row = el('div', 'door-choice');
  const pick = button(primary ? 'door-go' : 'door-other', label);
  pick.addEventListener('click', onPick);
  row.append(pick, el('p', 'door-why', why));
  return row;
}

/**
 * @param {object} view
 * @param {'offer'|'restoring'|'changed'|'failed'|'finished'} view.state
 * @param {string} view.name - the brand's
 * @param {string} view.position
 * @param {number} view.played - weeks played
 * @param {number} view.total
 * @param {Array<object>} [view.rows] - from `changedWeeks`
 * @param {number} [view.more]
 * @param {() => void} [view.onResume]
 * @param {() => void} [view.onCarryOn]
 * @param {() => void} view.onStartAfresh
 * @param {(() => void)|null} [view.onPlaytest] - the playtest link's own button
 * @returns {{node: HTMLElement, progress: (week: number, of: number) => void}}
 */
export function renderDoor(view) {
  const head = el('div', 'door-head');
  const brand = el('div', 'door-brand');
  brand.append(el('strong', null, view.name), el('span', null, view.position));
  const initials = view.name.split(' ').slice(0, 2).map((word) => word[0]).join('');
  head.append(el('div', 'door-logo', initials), brand);
  if (view.onPlaytest) {
    const send = button('door-playtest', SHELL.playtest());
    send.title = DOOR.playtestOnly();
    send.addEventListener('click', view.onPlaytest);
    head.append(send);
  }

  const card = el('section', 'door-card');
  const dots = el('div', 'door-dots');
  dots.setAttribute('aria-hidden', 'true');
  for (let week = 1; week <= view.total; week++) dots.append(el('i', week <= view.played ? 'on' : null));
  const title = el('h2', 'door-title', TITLES[view.state]());
  title.tabIndex = -1;
  card.append(el('p', 'door-eyebrow', DOOR.saved()), title, dots);

  let progress = () => {};
  if (view.state === 'offer' || view.state === 'finished') {
    const done = view.state === 'finished';
    card.append(
      el('p', 'door-count', DOOR.played({ played: view.played, total: view.total })),
      el('p', 'door-note', done ? DOOR.finishedNote({ total: view.total }) : DOOR.replayNote()),
      done
        ? choice(DOOR.backToResults(), DOOR.backWhy(), view.onResume, true)
        : choice(DOOR.resume({ week: view.played + 1 }), DOOR.resumeWhy(), view.onResume, true),
      choice(DOOR.startNew(), DOOR.startNewWhy(), view.onStartAfresh, false),
    );
  } else if (view.state === 'restoring') {
    const bar = el('div', 'door-bar');
    const fill = el('span');
    bar.append(fill);
    const said = el('p', 'door-count', DOOR.replaying({ week: 1, of: view.played }));
    said.setAttribute('role', 'status');
    card.append(bar, said);
    progress = (week, of) => {
      fill.style.width = `${(100 * week) / of}%`;
      said.textContent = DOOR.replaying({ week: Math.min(week + 1, of), of });
    };
  } else if (view.state === 'changed') {
    const table = el('div', 'door-table');
    table.append(el('span'), el('span', 'door-label', DOOR.whenSaved()), el('span', 'door-label', DOOR.replayedNow()));
    for (const row of view.rows) {
      table.append(
        el('span', 'door-week', DOOR.week({ week: row.week })),
        el('span', null, DOOR.spendOn({ spend: rupees(row.thenPaise), clicks: whole(row.thenClicks) })),
        el('strong', null, DOOR.spendOn({ spend: rupees(row.nowPaise), clicks: whole(row.nowClicks) })),
      );
    }
    if (view.more > 0) table.append(el('span'), el('span', 'door-more', DOOR.moreDiffer({ n: view.more })));
    card.append(
      el('p', 'door-note', DOOR.changedNote()), table,
      choice(DOOR.carryOn(), DOOR.carryOnWhy(), view.onCarryOn, true),
      choice(DOOR.startNew(), DOOR.discardWhy(), view.onStartAfresh, false),
    );
  } else {
    card.append(
      el('p', 'door-note', DOOR.failedNote()),
      choice(DOOR.startNew(), DOOR.discardWhy(), view.onStartAfresh, true),
    );
  }

  const column = el('div', 'door-column');
  column.append(head, card);
  const node = el('div', 'door');
  node.append(column);
  return { node, progress };
}
