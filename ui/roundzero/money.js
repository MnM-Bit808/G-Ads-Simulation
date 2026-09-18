/**
 * Step 5, your money (plans/2026-09-14-round-zero-redesign.md, section 4): the
 * month and where it comes from, the capital in plain view and neutral
 * (kept by default, nothing recommended), the landing page grade beside the
 * capital that moves it, and the weekly split behind Advanced.
 *
 * Every figure is the game's: the month is `monthlyBudget`, the grade
 * `landingGrade`, the rungs `PAGE_FEATURES` through `capexRungs`.
 */

import { el, add, rupees } from '../dom.js';
import { CAPEX_ALLOCATION_PAISE, ROUNDS_PER_MONTH } from '../../engine/constants.js';
import { whyButton } from '../guide/drawer.js';
import { R0 } from '../words/roundZero.js';
import {
  CAPEX_ORDER, monthlyBudget, monthParts, committed, landingGrade, capexRungs, setCapex,
  weeklySplit, setWeek,
} from './rules.js';

const PART = { base: R0.partBase, writer: R0.partWriter, kept: R0.capitalKept };
const TARGET = {
  landingPage: [R0.targetPage, R0.movesPage, R0.whyPage],
  sizeGuide: [R0.targetSize, R0.movesSize, R0.whySize],
  photography: [R0.targetPhoto, R0.movesPhoto, R0.whyPhoto],
  orderConfirmation: [R0.targetConfirm, R0.movesConfirm, R0.whyConfirm],
};
const GRADE_SCALE = 10;
/** Whether Advanced is open, per round 0: a redraw keeps it. */
const ADVANCED = new WeakMap();

/**
 * @param {object} ctx - the frame's context (./studio.js)
 * @param {object} ctx.draft - round 0's draft; the capital and the split are kept here
 * @param {Function} ctx.openGuide
 * @param {() => void} ctx.changed - moves the ticks and the tray, not the step
 * @param {() => void} ctx.redraw - redraws this step, keeping the scroll and focus
 * @returns {{node: HTMLElement}}
 */
export function renderMoneyStep({ draft, openGuide, changed, redraw }) {
  const month = monthlyBudget(draft);
  const left = CAPEX_ALLOCATION_PAISE - committed(draft);
  const grade = landingGrade(draft);
  const node = el('div', 'r0-money');
  node.append(el('p', 'r0-intro', R0.moneyIntro({ month: 1, capital: rupees(CAPEX_ALLOCATION_PAISE) })));

  // The month, and where it comes from. Commit capital and it shrinks by as much.
  const panel = el('div', 'r0-panel');
  panel.dataset.region = R0.monthTitle({ month: 1 });
  const bar = el('div', 'r0-month-bar');
  const legend = el('ul', 'r0-month-legend');
  for (const part of monthParts(draft)) {
    const segment = el('span', `r0-seg ${part.key}`);
    segment.style.flexGrow = String(part.paise);
    bar.append(segment);
    const item = el('li', part.key);
    item.append(el('span', 'r0-key'), el('span', null, PART[part.key]()), el('strong', null, rupees(part.paise)));
    legend.append(item);
  }
  panel.append(el('p', 'r0-eyebrow', R0.monthTitle({ month: 1 })), el('p', 'r0-sum', rupees(month)),
    el('p', null, R0.monthNote({ weeks: ROUNDS_PER_MONTH })), bar, legend);

  // The capital, and the grade the page part of it moves.
  const capital = el('div', 'r0-capital');
  capital.dataset.region = R0.capitalTitle();
  const head = el('div', 'r0-head');
  head.append(el('h3', null, R0.capitalTitle()), el('span', 'r0-small', R0.capitalWhen({ week: grade.liveAt })));
  const kept = el('p', 'r0-kept');
  kept.append(el('strong', null, rupees(left)), el('span', null, R0.notCommitted()));

  const lp = el('div', 'r0-lp');
  lp.dataset.region = R0.lpTitle();
  const gradeBar = (value, week) => {
    const line = el('div', 'r0-lp-line');
    const track = el('span', 'r0-grade-track');
    const fill = el('span', 'r0-grade-fill');
    fill.style.width = `${(100 * value) / GRADE_SCALE}%`;
    track.append(fill);
    line.append(track, el('strong', null, R0.lpFrom({ value, scale: GRADE_SCALE, week })));
    return line;
  };
  lp.append(el('h3', null, R0.lpTitle()), el('p', 'r0-small', R0.lpNote({ step: R0.stepAd() })),
    gradeBar(grade.fromWeek1, 1));
  if (grade.fromWeek4 > grade.fromWeek1) lp.append(gradeBar(grade.fromWeek4, grade.liveAt));
  // Which purchase earned the second bar (the owner, 2026-09-18). Nothing bought
  // earns nothing, and then there is no line to draw.
  if (grade.parts.length > 0) {
    const parts = el('p', 'r0-lp-parts', R0.lpParts({ start: grade.start, parts: grade.parts }));
    if (grade.capped) parts.append(el('span', 'r0-small', R0.lpStops({ top: GRADE_SCALE })));
    lp.append(parts);
  }

  const targets = el('div', 'r0-targets');
  for (const key of CAPEX_ORDER) {
    const [label, moves, why] = TARGET[key];
    const card = el('div', draft.capex[key] > 0 ? 'r0-target on' : 'r0-target');
    card.append(el('strong', null, label()), el('span', 'r0-moves', R0.moves({ what: moves() })),
      el('p', 'r0-small', why()));
    const rungs = el('div', 'r0-rungs');
    for (const rung of capexRungs(draft, key)) {
      const chip = el('button', rung.on ? 'r0-rung on' : 'r0-rung',
        rung.paise === 0 ? rung.label : R0.rung({ label: rung.label, price: rupees(rung.paise) }));
      chip.type = 'button';
      chip.dataset.key = `rung:${key}:${rung.paise}`;
      chip.setAttribute('aria-pressed', String(rung.on));
      chip.disabled = !rung.affordable;
      if (!rung.affordable) chip.title = R0.tooDear();
      chip.addEventListener('click', () => { if (!rung.on && setCapex(draft, key, rung.paise).ok) redraw(); });
      rungs.append(chip);
    }
    card.append(rungs);
    targets.append(card);
  }
  capital.append(head, kept, lp, targets);

  // The weekly split, behind Advanced (D10): even unless changed.
  const open = ADVANCED.get(draft) ?? false;
  const advanced = el('div', 'r0-advanced');
  const toggle = el('button', 'r0-advanced-toggle', R0.advanced());
  toggle.type = 'button';
  toggle.dataset.key = 'advanced';
  toggle.setAttribute('aria-expanded', String(open));
  toggle.addEventListener('click', () => { ADVANCED.set(draft, !open); redraw(); });
  const summary = el('span', 'r0-small');
  const showSummary = () => {
    const split = weeklySplit(draft);
    const planned = split.reduce((a, b) => a + b, 0);
    summary.textContent = draft.split === null
      ? R0.splitEven({ weekly: rupees(split[split.length - 1]) })
      : R0.splitCustom({ planned: rupees(planned), month: rupees(monthlyBudget(draft)) });
  };
  showSummary();
  const disclose = el('span', 'r0-small', R0.splitNotGoogle());
  add(disclose, whyButton(R0.splitNotGoogle, openGuide));
  advanced.append(toggle, summary, disclose);
  if (open) {
    const weeks = el('div', 'r0-weeks');
    weeklySplit(draft).forEach((paise, i) => {
      const box = el('input', 'kfield');
      box.classList.add('knum');
      box.type = 'number';
      box.min = '0';
      box.step = '100';
      box.value = String(Math.round(paise / 100));
      box.setAttribute('aria-label', R0.weekN({ n: i + 1 }));
      box.dataset.key = `week:${i}`;
      // Typing never redraws: the summary and the tray's checklist follow in place.
      box.addEventListener('input', () => { setWeek(draft, i, Math.round(Number(box.value) * 100)); showSummary(); changed(); });
      const wrap = el('label', 'r0-week');
      wrap.append(el('span', 'r0-small', R0.weekN({ n: i + 1 })), box);
      weeks.append(wrap);
    });
    advanced.append(weeks);
  }

  node.append(panel, capital, advanced);
  return { node };
}
