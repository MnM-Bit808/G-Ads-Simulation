/**
 * The Studio layout (plans/2026-09-13-studio-makeover.md, sections 2 and 5):
 * the icon strip, the section list, one section at a time, and the tray.
 *
 * TODAY'S CARDS ARE SHOWN, NEVER MOVED. The decision form redraws its cards
 * into its own region on every change, and the dashboard's refreshes find their
 * cards by querying its root. So the dashboard is drawn exactly as the classic
 * look draws it, and a section is a filter over it: `data-section` on the root,
 * and the stylesheet from ./sections.js hiding every other section's cards. A
 * card moved out of its region would leave the next redraw drawing into nothing.
 */

import { el, add, rupees } from '../dom.js';
import { renderDashboard } from '../dashboard.js';
import { changes } from '../decisions.js';
import { TOTAL_ROUNDS, ROUNDS_PER_MONTH } from '../../engine/constants.js';
import {
  AREAS, SECTIONS, ICONS, ICON_BOX, sectionOf, sectionsIn, sectionState, visibilityRules,
} from './sections.js';
import { trayLines } from './tray.js';
import { SHELL } from '../words/shell.js';

const HOURS_PER_WEEK = 7 * 24;
/** An undone line fades before it goes; the tray's motion (spec section 3, row 1). */
const UNDO_FADE_MS = 150;
const SVG = 'http://www.w3.org/2000/svg';

function icon(paths) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', ICON_BOX);
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('studio-icon');
  for (const d of paths) {
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

function button(className, ...children) {
  const node = el('button', className);
  node.type = 'button';
  node.append(...children);
  return node;
}

/**
 * @param {object} deps
 * @param {() => Promise<void>} deps.onRun - runs the week and redraws
 * @param {() => void} deps.onRedo
 * @param {Function} deps.openGuide - `guide.open`
 * @param {(trigger: HTMLElement) => void} deps.openContents
 * @param {(() => void)|null} [deps.onPlaytest]
 */
export function createStudio({ onRun, onRedo, openGuide, openContents, onPlaytest = null }) {
  if (!document.getElementById('studio-sections')) {
    const style = el('style');
    style.id = 'studio-sections';
    style.textContent = visibilityRules();
    document.head.append(style);
  }

  const view = {
    area: 'brand', section: 'week', seen: {}, order: [], menuOpen: false,
    resultsShown: false, firstOpen: null, dotsShown: new Set(),
  };
  let game = null;
  let ctx = null;
  let dashboard = null;
  let ending = null;
  let extras = { saved: null, canRedo: false };
  let running = false;
  let override = null;

  const node = el('div', 'studio-shell');
  const rail = el('nav', 'studio-rail');
  rail.dataset.region = 'Icon strip';
  const list = el('nav', 'studio-list');
  list.dataset.region = 'Sections';
  const main = el('div', 'studio-main');
  const top = el('div', 'studio-top');
  const body = el('div', 'studio-body');
  const section = el('section', 'card studio-section');
  const title = el('h2', 'studio-title');
  const content = el('div', 'studio-content');
  section.append(title, content);
  body.append(section);

  const tray = el('div', 'studio-tray');
  tray.dataset.region = 'Tray';
  const linesBox = el('div', 'studio-lines');
  const count = el('span', 'studio-count');
  const countWord = el('span', 'studio-count-word');
  const chipsBox = el('div', 'studio-chips');
  linesBox.append(count, countWord, chipsBox);
  const empty = el('p', 'studio-empty', SHELL.empty());
  const overrideHost = el('div', 'studio-override');
  const run = button('studio-run press');
  run.addEventListener('click', runWeek);
  tray.append(linesBox, empty, overrideHost, run);

  main.append(top, body, tray);
  node.append(rail, list, main);

  const chips = new Map();
  const played = () => game.reports.length;
  const args = () => ({
    played: played(), seen: view.seen,
    windowOpen: Boolean(game.draft.capexOpen || game.draft.repositionOpen),
  });
  const me = () => game.state.advertisers.find((a) => a.id === game.playerId);

  function drawRail() {
    const initials = me().name.split(' ').slice(0, 2).map((w) => w[0]).join('');
    rail.replaceChildren(el('div', 'studio-logo', initials));
    for (const area of AREAS) {
      const b = button('studio-area', icon(area.icon), el('span', null, area.label));
      b.setAttribute('aria-current', String(view.area === area.key));
      b.disabled = area.key === 'results' && played() < TOTAL_ROUNDS;
      b.addEventListener('click', () => {
        if (area.key === 'guide') { openContents(b); return; }
        open(sectionsIn(area.key)[0].key);
      });
      rail.append(b);
    }
    if (onPlaytest) {
      const p = button('studio-area studio-playtest', icon(ICONS.file), el('span', null, SHELL.playtestShort()));
      p.title = SHELL.playtest();
      p.addEventListener('click', onPlaytest);
      rail.append(p);
    }
  }

  function drawList() {
    const brand = el('div', 'studio-brand');
    brand.append(el('strong', null, me().name), el('span', null, `${me().position.price} · ${me().position.purpose}`));
    list.replaceChildren(brand);
    if (extras.canRedo) {
      const redo = button('studio-redo', SHELL.redo({ round: 0 }));
      redo.addEventListener('click', onRedo);
      list.append(redo);
    }
    list.append(el('p', 'studio-area-title', AREAS.find((a) => a.key === view.area).title));
    for (const s of sectionsIn(view.area)) {
      const st = sectionState(s, args());
      const item = button(`studio-item${st.locked ? ' locked' : ''}`, icon(s.icon), el('span', 'grow', s.label));
      item.setAttribute('aria-current', String(view.section === s.key));
      if (st.locked) item.append(el('span', 'studio-lock', SHELL.lockChip({ week: st.opensAt })));
      else if (st.fresh) {
        // The dot arrives once; a later redraw of the list keeps it still.
        const dot = el('span', view.dotsShown.has(st.seenKey) ? 'studio-dot' : 'studio-dot arrive');
        view.dotsShown.add(st.seenKey);
        dot.title = SHELL.fresh();
        item.append(dot);
      }
      item.addEventListener('click', () => open(s.key));
      list.append(item);
    }
  }

  function drawTop() {
    const report = game.reports[game.reports.length - 1];
    const money = report.byAdvertiser[game.playerId].budget;
    const menu = button('studio-menu', icon(ICONS.menu));
    menu.setAttribute('aria-label', SHELL.menu());
    menu.setAttribute('aria-expanded', String(view.menuOpen));
    menu.addEventListener('click', () => { view.menuOpen = !view.menuOpen; drawAll(); });
    const dots = el('div', 'studio-dots');
    dots.setAttribute('aria-hidden', 'true');
    for (let week = 1; week <= TOTAL_ROUNDS; week++) dots.append(el('i', week <= played() ? 'on' : null));
    let saved = '';
    if (extras.saved === true) saved = SHELL.saved();
    if (extras.saved === false) saved = SHELL.notSaved();
    const meter = el('span', 'studio-meter');
    const fill = el('span');
    fill.style.width = `${Math.min(100, Math.round((100 * money.monthSpentPaise) / money.monthlyBudgetPaise))}%`;
    meter.append(fill);
    const month = el('div', 'studio-month');
    month.append(
      el('span', null, SHELL.month({ month: Math.ceil(played() / ROUNDS_PER_MONTH) })),
      meter,
      el('strong', null, SHELL.spent({ spent: rupees(money.monthSpentPaise), budget: rupees(money.monthlyBudgetPaise) })),
    );
    const left = add(el('div', 'studio-top-left'), menu,
      el('span', 'studio-week', SHELL.week({ played: played(), total: TOTAL_ROUNDS })), dots,
      el('span', 'studio-saved', saved));
    top.replaceChildren(left, month);
  }

  function drawSection() {
    const s = SECTIONS.find((x) => x.key === view.section);
    const st = sectionState(s, args());
    title.textContent = s.label;
    section.dataset.region = s.label;
    section.classList.toggle('first-open', view.firstOpen === s.key);
    let shown;
    if (st.locked && s.key === 'results') shown = el('p', 'studio-panel', SHELL.resultsLocked());
    else if (st.locked) {
      shown = el('p', 'studio-panel', `${SHELL.opensAt({ week: st.opensAt })} ${SHELL.returnsLocked()}`);
    } else if (s.key === 'results') shown = ending ?? el('p', 'studio-panel', SHELL.resultsLocked());
    else if (s.key === 'ad') shown = el('p', 'studio-panel', SHELL.adSection());
    else {
      dashboard.dataset.section = s.key;
      shown = dashboard;
    }
    content.replaceChildren(shown);
    body.scrollTop = 0;
  }

  function makeChip(line) {
    const chip = el('span', 'studio-chip');
    const text = el('span', null, line.text);
    const undo = button('studio-undo', icon(ICONS.close));
    undo.setAttribute('aria-label', SHELL.undo());
    undo.addEventListener('click', () => {
      const take = chip.undo;
      if (!take || chip.classList.contains('leaving')) return;
      chip.classList.add('leaving');
      setTimeout(() => { take(); ctx.refresh(); }, UNDO_FADE_MS);
    });
    chip.append(text, undo);
    return chip;
  }

  function drawTray() {
    const bulk = override !== null;
    tray.classList.toggle('bulk', bulk);
    overrideHost.replaceChildren(...(bulk ? [override] : []));
    run.hidden = bulk;
    const { lines, order } = trayLines(changes(game.draft), view.order);
    view.order = order;
    const keep = new Set(lines.map((l) => l.id));
    for (const [id, chip] of chips) {
      if (!keep.has(id)) { chips.delete(id); chip.remove(); }
    }
    for (const line of lines) {
      let chip = chips.get(line.id);
      if (!chip) {
        chip = makeChip(line);
        chips.set(line.id, chip);
        chipsBox.append(chip);
      }
      chip.firstChild.textContent = line.text;
      chip.title = line.detail;
      chip.undo = line.undo;
      chip.lastChild.hidden = !line.undo;
    }
    linesBox.hidden = bulk || lines.length === 0;
    empty.hidden = bulk || lines.length > 0;
    count.textContent = String(lines.length);
    countWord.textContent = SHELL.changes({ n: lines.length });
    const over = played() >= TOTAL_ROUNDS;
    run.disabled = running || over;
    if (running) run.textContent = SHELL.running({ hours: HOURS_PER_WEEK });
    else if (over) run.textContent = SHELL.gameOver();
    else run.textContent = SHELL.run({ week: played() + 1 });
  }

  function drawAll() {
    node.classList.toggle('menu-open', view.menuOpen);
    drawRail();
    drawList();
    drawTop();
    drawSection();
    drawTray();
  }

  /** Open a section by key; opening a fresh one marks it seen. */
  function open(key) {
    const s = SECTIONS.find((x) => x.key === key);
    const st = sectionState(s, args());
    view.area = s.area;
    view.section = key;
    view.menuOpen = false;
    view.firstOpen = st.fresh ? key : null;
    if (st.fresh) view.seen[st.seenKey] = true;
    drawAll();
  }

  async function runWeek() {
    if (running || played() >= TOTAL_ROUNDS) return;
    running = true;
    drawTray();
    // Let "running 168 hours…" paint before the week holds the thread.
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      await onRun();
    } finally {
      running = false;
      drawTray();
    }
  }

  function draw(nextGame, { saved = null, canRedo = false, endingNode = null } = {}) {
    game = nextGame;
    extras = { saved, canRedo };
    ending = endingNode;
    override = null;
    dashboard = renderDashboard(game, () => drawTray(), {
      openGuide,
      onContext: (c) => { ctx = c; },
    });
    dashboard.classList.add('studio-cards');
    if (ending && !view.resultsShown) {
      view.resultsShown = true;
      view.area = 'results';
      view.section = 'results';
      // Opened for the player, so it is not news: no dot on the section being read.
      const st = sectionState(SECTIONS.find((x) => x.key === 'results'), args());
      if (st.seenKey) view.seen[st.seenKey] = true;
    }
    view.firstOpen = null;
    drawAll();
  }

  function reveal(slot) {
    const s = sectionOf(slot);
    if (!s || !game) return false;
    open(s.key);
    return true;
  }

  function setTrayOverride(next) {
    override = next;
    drawTray();
  }

  return { node, draw, reveal, open, setTrayOverride };
}
