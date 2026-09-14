/**
 * The planner drawer (plans/2026-09-13-studio-makeover.md, section 4):
 * Keyword Planner's research, text, weekly volume and intent, plus the
 * engine's count of how far each would reach on the match chosen (E8). Nothing
 * a search does after the click is shown (16.1, C4).
 */

import { el, whole } from '../dom.js';
import { KEYWORDS } from '../words/keywords.js';
import { pills } from './controls.js';

export const PLANNER_ROWS = 40;
/** The drawer leaves faster than it came (the makeover spec, section 3, motion row 6). */
const DRAWER_EXIT_MS = 150;
const MATCHES = ['exact', 'phrase', 'broad'];
const normal = (text) => String(text).trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * The rows for what is typed: biggest first, a screenful at most, each marked
 * if the account holds it. `own` is the typed text, when the planner has no
 * such search and the account does not hold it.
 *
 * @returns {{rows: Array<{text: string, intent: string, weekly: number, held: boolean}>,
 *   addable: string[], own: string|null}}
 */
export function plannerRows({ queries, weeklyVolume, term = '', held = new Set(), limit = PLANNER_ROWS }) {
  const typed = normal(term);
  const weekly = (q) => Math.round((weeklyVolume * q.volumeShareBp) / 10000);
  const rows = queries
    .filter((q) => !typed || q.text.includes(typed))
    .map((q) => ({ text: q.text, intent: q.intent, weekly: weekly(q), held: held.has(normal(q.text)) }))
    .sort((a, b) => b.weekly - a.weekly)
    .slice(0, limit);
  const own = typed && !queries.some((q) => normal(q.text) === typed) && !held.has(typed) ? typed : null;
  return { rows, addable: rows.filter((r) => !r.held).map((r) => r.text), own };
}

/**
 * @param {object} args
 * @param {HTMLElement} args.trigger - focus returns here when the drawer closes
 * @param {object[]} args.queries
 * @param {number} args.weeklyVolume
 * @param {{term: string, matchType: string, bidPaise: number}} args.state - kept
 *   by the caller, so reopening keeps what was typed
 * @param {() => Set<string>} args.held - the account's keywords, normalised
 * @param {(keyword: object) => number} args.reach - the engine's count
 * @param {(keyword: {text: string}) => {tags: string[]}} args.tag
 * @param {(text: string, spec: object) => boolean} args.onAdd
 * @param {(texts: string[], spec: object) => void} args.onAddAll
 * @returns {{close: () => void}}
 */
export function openPlanner({ trigger, queries, weeklyVolume, state, held, reach, tag, onAdd, onAddAll }) {
  const overlay = el('div', 'kplanner-overlay');
  const drawer = el('aside', 'kplanner');
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-label', KEYWORDS.plannerTitle());
  // The drawer sits outside every card, so without a region of its own the
  // playtest recorder named its clicks "Add" and "×", from nowhere.
  drawer.dataset.region = KEYWORDS.plannerTitle();
  // A click on the drawer's plain text would otherwise send focus to the page
  // behind, where Escape no longer reaches the drawer.
  drawer.tabIndex = -1;
  let closing = false;
  const close = () => {
    if (closing) return;
    closing = true;
    overlay.classList.add('closing');
    drawer.classList.add('closing');
    setTimeout(() => { overlay.remove(); drawer.remove(); trigger?.focus?.(); }, DRAWER_EXIT_MS);
  };
  overlay.addEventListener('click', close);
  drawer.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });

  const shut = el('button', 'kplanner-close', '×');
  shut.type = 'button';
  shut.setAttribute('aria-label', KEYWORDS.close());
  shut.addEventListener('click', close);
  const head = el('div', 'kplanner-head');
  head.append(el('h3', null, KEYWORDS.plannerTitle()), shut);

  const search = el('input', 'kfield');
  search.type = 'search';
  search.value = state.term;
  search.placeholder = KEYWORDS.plannerSearch();
  search.setAttribute('aria-label', KEYWORDS.plannerSearch());
  const bid = el('input', 'kfield knum');
  bid.type = 'number';
  bid.min = '1';
  bid.step = '1';
  bid.value = String(Math.round(state.bidPaise / 100));
  bid.addEventListener('input', () => {
    const n = Math.round(Number(bid.value));
    if (n >= 1) state.bidPaise = n * 100;
  });
  const bidLabel = el('label', 'kplanner-bid');
  bidLabel.append(el('span', null, KEYWORDS.plannerBid()), bid);
  const matchHost = el('div');
  const controls = el('div', 'kplanner-controls');
  controls.append(matchHost, bidLabel);
  const extra = el('div', 'kplanner-extra');
  const cols = el('div', 'kplanner-cols');
  cols.append(el('span'), el('span', null, KEYWORDS.plannerWeek()), el('span', null, KEYWORDS.plannerReach()), el('span'));
  const list = el('div', 'kplanner-list');
  const spec = () => ({ matchType: state.matchType, bidPaise: state.bidPaise });

  function fill() {
    state.term = search.value;
    matchHost.replaceChildren(pills({
      options: MATCHES.map((m) => [m, KEYWORDS[m]()]),
      value: state.matchType,
      label: KEYWORDS.match(),
      onPick: (m) => { state.matchType = m; fill(); },
    }));
    const { rows, addable, own } = plannerRows({ queries, weeklyVolume, term: search.value, held: held() });
    extra.replaceChildren();
    if (own) {
      const mine = el('button', 'kplanner-mine press', KEYWORDS.plannerOwn({ text: own }));
      mine.type = 'button';
      mine.addEventListener('click', () => { if (onAdd(own, spec())) { search.value = ''; fill(); } });
      extra.append(mine);
    }
    if (addable.length > 1) {
      const every = el('button', 'kplanner-all', KEYWORDS.plannerAddAll({ n: addable.length }));
      every.type = 'button';
      every.addEventListener('click', () => { onAddAll(addable, spec()); fill(); });
      extra.append(every);
    }
    list.replaceChildren(...rows.map((row) => {
      const name = el('div', 'kplanner-name');
      name.append(el('strong', null, row.text), el('span', null, row.intent));
      const count = reach({ text: row.text, matchType: state.matchType, tags: tag({ text: row.text }).tags });
      const pick = el('button', row.held ? 'kplanner-held' : 'kplanner-add press',
        row.held ? KEYWORDS.plannerHeld() : KEYWORDS.plannerAdd());
      pick.type = 'button';
      pick.disabled = row.held;
      pick.addEventListener('click', () => { if (onAdd(row.text, spec())) fill(); });
      const line = el('div', 'kplanner-row');
      line.append(name, el('span', 'knum', whole(row.weekly)), el('span', 'knum', whole(count)), pick);
      return line;
    }));
    // Redrawing removes the button just pressed, and focus falls out of the
    // dialog with it: found by playing it, when Escape stopped closing the
    // drawer after an Add. It comes back to the search box.
    if (drawer.isConnected && !drawer.contains(document.activeElement)) search.focus();
  }

  search.addEventListener('input', fill);
  drawer.append(head, search, controls, extra, cols, list, el('p', 'kplanner-note', KEYWORDS.plannerNote()));
  fill();
  document.body.append(overlay, drawer);
  search.focus();
  return { close };
}
