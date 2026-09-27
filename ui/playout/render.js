/**
 * The week playing out, drawn (plans/2026-09-27-week-playout.md).
 *
 * IT HOLDS NO SENTENCE. Every word is a `line()` in `ui/words/playout.js`, and
 * `tests/words.test.js`'s drawing guard fails any string of three words here.
 * It works out no figure either: `ui/playout/read.js` reads the week's own
 * report and hands the figures in, so this file cannot quietly start computing
 * what the engine already did.
 *
 * NO COUNTING TICKERS, as in the first run (I52's honesty rule). Every figure
 * appears at its true value; a BAR may grow, because a bar is a shape and not a
 * claim about an in-between number the engine never reported. What moves is
 * which step is on screen.
 *
 * IT IS ALWAYS SKIPPABLE, and after `AUTOMATIC_WEEKS` it does not offer itself
 * at all. Fifteen seconds twelve times is ninety, and ninety seconds is where
 * the one recorded stranger's attention ran out.
 */

import { el, add } from '../dom.js';
import { button } from '../kit/controls.js';
import { PLAYOUT as W } from '../words/playout.js';
import { STEP_MS, playoutView, stepsFor } from './read.js';

/**
 * Remembers that this browser skipped one. Beside the save, never inside it —
 * a preference about watching is not part of the game being replayed.
 */
export const PLAYOUT_KEY = 'g-ads-simulation:playout-skipped';

/**
 * @param {Storage|null} storage
 * @returns {boolean} whether the player has ever skipped a playout
 */
export function playoutSkipped(storage) {
  try {
    return storage?.getItem(PLAYOUT_KEY) === '1';
  } catch {
    // Blocked site data reads as "never skipped", which errs towards showing
    // it: the same way `seenFirstRun` errs towards playing the first run.
    return false;
  }
}

/** @param {Storage|null} storage */
export function markPlayoutSkipped(storage) {
  try {
    storage?.setItem(PLAYOUT_KEY, '1');
  } catch {
    // Nothing to do: it plays again next week, which is not a fault.
  }
}

/** Row by row, as the first run's ladder reveals. */
const STAGGER = 50;

const say = (text) => el('p', 'po-say', text);
const note = (text) => el('p', 'po-note', text);
const kicker = (text) => el('div', 'po-kicker', text);

/** One big figure with a label under it. */
function figure(value, label, tone) {
  const cell = el('div', 'po-cell');
  add(cell, el('span', tone ? `po-v ${tone}` : 'po-v', value), el('span', 'po-k', label));
  return cell;
}

function stepPool(f) {
  return [kicker(W.s1Kicker(f)), figure(f.eligible, W.s1Sub(f), null), say(W.s1Say(f))];
}

function stepShown(f) {
  const row = el('div', 'po-strip');
  add(row, figure(f.impressions, W.s2Sub(f), 'lit'), el('span', 'po-of', f.shown));
  return [kicker(W.s2Kicker(f)), row, say(W.s2Say(f))];
}

/**
 * Why the rest were missed. The step that earns the sequence: lost-to-budget is
 * a figure on the dashboard nobody reads, and it was thirty per cent of the
 * measured week.
 */
function stepMissed(f) {
  const row = el('div', 'po-strip');
  add(row, figure(f.lostBudget, W.s3Budget(f), 'warn'), figure(f.lostRank, W.s3Rank(f), null));
  const parts = [kicker(W.s3Kicker(f)), row, say(W.s3Say(f))];
  // Only when the budget really is the bigger of the two: on a week where rank
  // was the problem this sentence would be false.
  if (f.budgetLed) parts.push(note(W.s3Note(f)));
  return parts;
}

/** Beat 4's ladder, weekly, with the player's own numbers in it. */
function stepLadder(f) {
  const ladder = el('div', 'po-ladder');
  f.places.forEach((row, i) => {
    const line = el('div', 'po-lrow');
    line.style.animationDelay = `${i * STAGGER}ms`;
    const track = el('span', 'po-track');
    const fill = el('i', null);
    fill.style.width = `${Math.round(100 * row.share)}%`;
    add(track, fill);
    add(line, el('span', 'po-pos', String(row.place)), track, el('span', 'po-num', row.count));
    add(ladder, line);
  });
  const parts = [kicker(W.s4Kicker(f)), ladder, say(W.s4Met(f))];
  if (f.rival) parts.push(note(f.cleared ? W.s4Clear(f) : W.s4Above(f)));
  return parts;
}

function stepClicks(f) {
  const row = el('div', 'po-strip');
  add(row, figure(f.clicks, W.s5Clicks(f), 'lit'), figure(f.cost, W.s5Cost(f), 'warn'));
  return [kicker(W.s5Kicker(f)), row, say(W.s5Say(f))];
}

function stepBought(f) {
  return [kicker(W.s6Kicker(f)), figure(f.bought, W.s6Sub(f), 'lit'), say(W.s6Say(f))];
}

/**
 * And who has not decided yet — the attribution delay, at the moment it is true
 * of this player. It is the first run's beat 8, met again when it means
 * something, and it is what the revision mark on Your week (I56) shows.
 */
function stepPending(f) {
  if (f.settled) return [kicker(W.s7Kicker(f)), say(W.s7None(f))];
  return [kicker(W.s7Kicker(f)), figure(f.pending, W.s7Sub(f), null), say(W.s7Note(f))];
}

const BODIES = {
  pool: stepPool,
  shown: stepShown,
  missed: stepMissed,
  ladder: stepLadder,
  clicks: stepClicks,
  bought: stepBought,
  pending: stepPending,
};

/**
 * The week, played out.
 *
 * @param {object} args
 * @param {object} args.figures - `figuresFor()`
 * @param {Function} args.onDone - called on skip, on finish, and on the last
 *   step's button. Takes `{skipped}` so the caller can remember a skip.
 * @param {Function} [args.setTimer] - `setTimeout`, replaced by a test
 * @param {Function} [args.clearTimer] - `clearTimeout`
 * @returns {{node: HTMLElement, stop: () => void}}
 */
export function createPlayout({ figures, onDone, setTimer = setTimeout, clearTimer = clearTimeout }) {
  const steps = stepsFor(figures);
  const node = el('div', 'po-board');
  const top = el('div', 'po-top');
  const dots = el('div', 'po-dots');
  const skip = button('po-skip', W.skip(figures));
  const slot = el('div', 'po-slot');
  add(top, dots, skip);
  add(node, top, slot);

  let at = 0;
  let timer = null;

  function stop() {
    if (timer !== null) clearTimer(timer);
    timer = null;
  }

  skip.addEventListener('click', () => { stop(); onDone({ skipped: true }); });

  function draw() {
    const view = playoutView(at, steps);

    dots.replaceChildren(...Array.from({ length: view.total }, (_, i) => {
      const mark = el('span', 'po-dot');
      if (i === view.at) mark.classList.add('on');
      else if (i < view.at) mark.classList.add('done');
      return mark;
    }));

    const live = el('div', 'po-live');
    add(live, ...BODIES[view.key](figures));

    if (view.isLast) {
      const go = button('po-go', W.done(figures));
      go.addEventListener('click', () => { stop(); onDone({ skipped: false }); });
      add(live, el('div', 'po-row', null));
      live.lastChild.append(go);
    }

    slot.replaceChildren(live);

    stop();
    if (!view.isLast) {
      timer = setTimer(() => { at += 1; draw(); }, STEP_MS);
    }
  }

  draw();
  return { node, stop };
}
