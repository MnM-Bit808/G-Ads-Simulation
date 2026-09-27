/**
 * Round 0 in the Studio's sidebar layout (plans/2026-09-14-round-zero-redesign.md,
 * sections 3 and 8): the icon strip, the steps in the list, one step at a
 * time, and the tray. The same frame and classes as the weekly shell
 * (ui/shell/shell.js), with its own controller because every draw in that
 * file reads a played game.
 *
 * The draft is round 0's own (./rules.js), and Go sends `startChoices`, so the
 * account opens exactly as it does from the classic page. Nothing here is
 * saved: round 0 never is (ui/app.js).
 */

import { el, rupees } from '../dom.js';
import { briefing, REDO_DEADLINE_ROUND } from '../../setup.js';
import { brandById } from '../../content/brands.js';
import { writerTier } from '../../content/writers.js';
import { TOTAL_ROUNDS } from '../../engine/constants.js';
import { AREAS, ICONS } from '../shell/sections.js';
import { icon, button } from '../kit/controls.js';
import { R0, cellWords } from '../words/roundZero.js';
import { SHELL } from '../words/shell.js';
import {
  createSetupDraft, stepsDone, checklist, canGo, startChoices, committed,
} from './rules.js';
import { renderMarketStep } from './market.js';
import { renderPositionStep } from './position.js';
import { renderKeywordsStep } from './keywords.js';
import { renderAdStep } from './ad.js';
import { renderMoneyStep } from './money.js';

const HOURS_PER_WEEK = 7 * 24;

/** The five steps, in order. */
const STEPS = [
  { key: 'market', label: R0.stepMarket, render: renderMarketStep },
  { key: 'position', label: R0.stepPosition, render: renderPositionStep },
  { key: 'keywords', label: R0.stepKeywords, render: renderKeywordsStep },
  { key: 'ad', label: R0.stepAd, render: renderAdStep },
  { key: 'money', label: R0.stepMoney, render: renderMoneyStep },
];
const CHECK = { square: R0.checkSquare, keywords: R0.checkKeywords, ad: R0.checkAd, money: R0.checkMoney };
const NEED = { keyword: R0.needKeyword, ad: R0.needAd, split: R0.needSplit };

/**
 * @param {object} args
 * @param {object} args.querySet
 * @param {number} args.rootSeed
 * @param {string} args.playerBrandId - the brand round 0 starts on: the seed's
 *   draw, or the one a redo kept. Step 2 lets the player choose another.
 * @param {Function} args.openGuide - `guide.open`
 * @param {(trigger: HTMLElement) => void} args.openContents
 * @param {(choices: {playerBrandId: string, player: object, guesses: object}) => Promise<void>} args.onGo
 *   `guesses` are the player's notes on the rivals, by name, for the save
 * @param {(() => void)|null} [args.onPlaytest] - on the playtest link only. The
 *   Studio hides the page's header, which carries the playtest button, so a
 *   playtester who stops during round 0 sends the file from the icon strip, as
 *   in the weekly shell.
 * @returns {{node: HTMLElement}}
 */
export function createRoundZero({ querySet, rootSeed, playerBrandId, openGuide, openContents, onGo, onPlaytest = null }) {
  const brief = briefing(querySet);
  const draft = createSetupDraft({ playerBrandId, rootSeed });
  // Read each time it is drawn: step 2 lets the player choose another.
  const brandName = () => brandById(draft.playerBrandId).name;
  const view = { step: 'market', visited: new Set(['market']), direction: 0 };
  let going = false;

  const node = el('div', 'studio-shell r0');
  const rail = el('nav', 'studio-rail');
  rail.dataset.region = 'Icon strip';
  const list = el('nav', 'studio-list');
  list.dataset.region = 'Round 0 steps';
  const main = el('div', 'studio-main');
  const top = el('div', 'studio-top');
  const body = el('div', 'studio-body');
  // Class lists stay at two names a string: the drawing guard counts three as a sentence.
  const section = el('section', 'card studio-section');
  section.classList.add('r0-step');
  const title = el('h2', 'studio-title');
  const content = el('div', 'studio-content');
  section.append(title, content);
  body.append(section);
  const tray = el('div', 'studio-tray r0-tray');
  tray.dataset.region = 'Tray';
  main.append(top, body, tray);
  node.append(rail, list, main);

  const at = (key) => STEPS.findIndex((s) => s.key === key);
  /**
   * Transient state a step owns between redraws — which rival's ad is open on
   * step 2, and nothing else so far.
   *
   * NOT THE DRAFT, deliberately. The draft is what round 0 decides and what Go
   * sends (`startChoices`); an ad being open is neither, and putting it there
   * would travel into the save and the reveal. It is not a module variable
   * either, because that would outlive the game. It lives on the context, which
   * is built once per round 0 and dies with it.
   */
  const stepUi = {};

  const ctx = {
    draft, brief, querySet, rootSeed, openGuide, ui: stepUi,
    // A step's change moves the ticks and the tray, never the step under the cursor.
    changed: () => { drawList(); drawTray(); },
    // A change that does redraw the step keeps the reader's place: the scroll,
    // and the control they were on (each control carries a data-key).
    redraw: () => {
      const y = body.scrollTop;
      const key = document.activeElement?.dataset?.key;
      // A redraw is not a move between steps, so the step transition must not play.
      view.direction = 0;
      drawSection();
      body.scrollTop = y;
      if (key) content.querySelector(`[data-key="${CSS.escape(key)}"]`)?.focus();
      // The rail carries the brand's initials, which a redraw may have changed.
      drawRail();
      drawList();
      drawTray();
    },
  };

  function drawRail() {
    const initials = brandName().split(' ').slice(0, 2).map((w) => w[0]).join('');
    rail.replaceChildren(el('div', 'studio-logo', initials));
    for (const area of AREAS) {
      const b = button('studio-area', icon(area.icon), el('span', null, area.label));
      b.setAttribute('aria-current', String(area.key === 'brand'));
      // Neither has anything to show before an auction has run (spec section 3).
      b.disabled = area.key === 'market' || area.key === 'results';
      if (area.key === 'guide') b.addEventListener('click', () => openContents(b));
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
    const done = stepsDone(draft, view.visited);
    const head = el('div', 'studio-brand');
    head.append(el('strong', null, brandName()), el('span', null, R0.yourBrand()));
    list.replaceChildren(head, el('p', 'studio-area-title', R0.beforeWeek({ week: 1 })));
    STEPS.forEach((step, i) => {
      const mark = el('span', done[step.key] ? 'r0-mark done' : 'r0-mark', done[step.key] ? '✓' : String(i + 1));
      if (done[step.key]) mark.setAttribute('aria-label', R0.done());
      const item = button('studio-item', mark, el('span', 'grow', step.label()));
      item.setAttribute('aria-current', String(view.step === step.key));
      item.addEventListener('click', () => open(step.key));
      list.append(item);
    });
  }

  function drawTop() {
    const menu = button('studio-menu', icon(ICONS.menu));
    menu.setAttribute('aria-label', R0.menu());
    menu.addEventListener('click', () => node.classList.toggle('menu-open'));
    const dots = el('div', 'studio-dots');
    dots.setAttribute('aria-hidden', 'true');
    for (let week = 1; week <= TOTAL_ROUNDS; week++) dots.append(el('i'));
    const left = el('div', 'studio-top-left');
    left.append(menu, el('span', 'studio-week', R0.roundLabel({ round: 0 })),
      el('span', 'studio-saved', R0.beforeAuction()), dots);
    top.replaceChildren(left, el('span', 'r0-stepof', R0.stepOf({ n: at(view.step) + 1, total: STEPS.length })));
  }

  function drawSection() {
    const step = STEPS[at(view.step)];
    title.textContent = step.label();
    section.dataset.region = step.label();
    // Read by the step transition (Task 14): which way the steps moved.
    let direction = 'none';
    if (view.direction > 0) direction = 'forward';
    if (view.direction < 0) direction = 'back';
    section.dataset.direction = direction;
    content.replaceChildren(step.render(ctx).node);
    body.scrollTop = 0;
  }

  function soFar() {
    const box = el('div', 'r0-sofar');
    const chip = (text) => el('span', 'studio-chip', text);
    box.append(el('span', 'r0-sofar-label', R0.soFar()), chip(cellWords(draft.cell)));
    if (draft.keywords.length > 0) box.append(chip(R0.keywordCount({ n: draft.keywords.length })));
    box.append(chip(writerTier(draft.writerTier).label));
    const spent = committed(draft);
    box.append(chip(spent > 0 ? R0.capitalCommitted({ amount: rupees(spent) }) : R0.capitalKept()));
    return box;
  }

  function finish() {
    const box = el('div', 'r0-finish');
    const checks = el('ul', 'r0-checks');
    for (const item of checklist(draft)) {
      const li = el('li', item.done ? 'done' : 'need', CHECK[item.key]());
      if (!item.done) li.append(el('span', 'r0-need', NEED[item.need]()));
      checks.append(li);
    }
    // `canGo` stays the authority on whether the week may run; `missing` only
    // supplies the LABEL. Deriving "may I go" from the checklist here would
    // put the rule in two places. `checklist` keeps its own keys: `square` is
    // settled on the position step, the rest share a name with theirs.
    const blocked = !canGo(draft);
    const missing = blocked ? (checklist(draft).find((item) => !item.done) ?? null) : null;
    const go = button('studio-run r0-go',
      missing ? R0.goNeeds({ need: NEED[missing.need]() }) : R0.go({ week: 1 }));
    go.classList.add('press');
    // NOT DISABLED WHEN SOMETHING IS MISSING (I59). A dead button is a dead
    // end: the one recorded stranger sat here for 3:35 of active time, made no
    // click at all, and never started the game — the reason was 13px of amber
    // beside a 343x52 red button at 45% opacity. It now says what it wants and
    // takes you to the step that holds it.
    if (blocked) go.classList.add('waiting');
    go.disabled = going;
    go.addEventListener('click', async () => {
      if (going) return;
      // Blocked and nothing named cannot happen — `canGo` is false only when an
      // item is not done — but it must not fall through into running the week.
      if (blocked) { if (missing) open(missing.key === 'square' ? 'position' : missing.key); return; }
      going = true;
      go.disabled = true;
      go.textContent = R0.running({ hours: HOURS_PER_WEEK });
      // Let the label paint before the week holds the thread.
      await new Promise((resolve) => { setTimeout(resolve, 0); });
      // The notes go beside the account, never into it (`notesFor`).
      await onGo({ ...startChoices(draft), guesses: { ...draft.guesses } });
    });
    box.append(checks, el('p', 'r0-redo', R0.redoNote({ round: 0, week: REDO_DEADLINE_ROUND })), go);
    return box;
  }

  function drawTray() {
    if (view.step === 'money') {
      tray.replaceChildren(soFar(), finish());
      return;
    }
    const nextStep = STEPS[at(view.step) + 1];
    const next = button('studio-run r0-next', R0.next({ step: nextStep.label() }));
    next.classList.add('press');
    // IT GOES QUIET WHERE IT COMPETES WITH THE STEP'S OWN JOB (I59). Nothing is
    // held: someone who wants to look at the ad and the money first still can,
    // and the Go button will send them back. The screen simply stops being the
    // loudest argument for leaving the one step that can block the game.
    if (view.step === 'keywords' && draft.keywords.length === 0) next.classList.add('quiet');
    next.addEventListener('click', () => open(nextStep.key));
    tray.replaceChildren(soFar(), next);
  }

  function drawAll() {
    drawRail();
    drawList();
    drawTop();
    drawSection();
    drawTray();
  }

  /** Open a step, from the list or from Next. */
  function open(key) {
    const step = STEPS[at(key)];
    if (!step) return;
    view.direction = Math.sign(at(key) - at(view.step));
    view.step = key;
    view.visited.add(key);
    node.classList.remove('menu-open');
    drawAll();
  }

  drawAll();
  return { node };
}
