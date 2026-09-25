/**
 * The Studio's Your money (design/your-money/, chosen by the owner 2026-09-15):
 * at week 5 the capital and the one chance to move on top, then this month as
 * one bar whose weeks you move money between, and bidding and what week 8
 * decides beside each other. What it shows is worked out in ./read.js; the
 * words are in ui/words/money.js. Every change is staged through the form's
 * own setters, so the tray words it.
 *
 * A DRAG REDRAWS ONLY THE BAR, and a target slider only the bid it reads, so
 * neither takes the pointer or the focus away from under the player.
 */

import { el, add, rupees, whole, ratio, pct } from '../dom.js';
import {
  MONTHLY_BUDGET_PAISE, REPOSITION_COST_PAISE, ROUNDS_PER_MONTH, MAX_BID_MULTIPLE, LEARNING_ROUNDS,
} from '../../engine/constants.js';
import { whyButton } from '../guide/drawer.js';
import { setCapex, setPosition, setStrategy, setStrategyParam } from '../decisions.js';
import { CAPITAL } from '../words/capital.js';
import { MONEY } from '../words/money.js';
import { meter } from '../kit/meter.js';
import {
  monthModel, moveLine, capitalModel, positionModel, biddingModel, deadlineModel, STRATEGY_ORDER,
} from './read.js';

/** A drag or an arrow key moves a line in whole steps of this many paise (₹1,000). */
const STEP_PAISE = 100000;
/** Under half a percent prints as 0%, so it reads as never running out (DECISIONS I6). */
const NEVER_RAN_OUT = 0.005;

function button(className, text, onClick) {
  const node = el('button', className, text);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

/**
 * @param {object} args
 * @param {object} args.game - the played game (ui/app.js, openGame)
 * @param {object} args.ctx - the dashboard's context: `spentByWeek`, `brief`, `lastMonth`, `money`
 * @param {Function} [args.openGuide] - `guide.open`
 * @param {() => void} [args.refreshTray] - redraws the tray after a change
 * @returns {{node: HTMLElement, refresh: () => void}}
 */
export function renderMoneySection({ game, ctx, openGuide, refreshTray }) {
  const node = el('div', 'wm');
  let barHost = null;
  let bidHost = null;

  function changed() {
    draw();
    refreshTray?.();
  }

  // --- this week only ---------------------------------------------------------

  function capitalPart(draft) {
    const capital = capitalModel(draft);
    const box = el('div', 'wm-part');
    box.append(el('p', 'wm-label', MONEY.capitalHead({ amount: rupees(capital.committedPaise + capital.joinsPaise) })));
    for (const target of capital.targets) {
      const head = el('div', 'wm-target-head');
      head.append(el('strong', null, MONEY.targetName[target.key]()),
        el('span', 'wm-small', MONEY.now({ rung: target.now.label })));
      const chips = el('div', 'wm-chips');
      for (const chip of target.chips) {
        const rung = chip.wasteful ? MONEY.noChange() : chip.reaches.label;
        const pick = button('wm-chip', MONEY.chip({ rung, amount: rupees(chip.amountPaise) }), () => {
          setCapex(draft, target.key, chip.chosen ? 0 : chip.amountPaise);
          changed();
        });
        pick.setAttribute('aria-pressed', String(chip.chosen));
        pick.disabled = !chip.affordable && !chip.chosen;
        chips.append(pick);
      }
      const row = el('div', 'wm-target');
      row.append(head, el('p', 'wm-small', MONEY.targetWhy[target.key]()), chips);
      box.append(row);
    }
    const total = capital.committedPaise + capital.joinsPaise;
    const bar = el('div', 'wm-capbar');
    bar.setAttribute('aria-hidden', 'true');
    const committed = el('span', 'wm-committed');
    committed.style.width = `${(100 * capital.committedPaise) / total}%`;
    const joins = el('span', 'wm-joins');
    joins.style.width = `${(100 * capital.joinsPaise) / total}%`;
    bar.append(committed, joins);
    const figures = el('div', 'wm-capfigures');
    figures.append(
      el('span', 'wm-yours', MONEY.toBusiness({ amount: rupees(capital.committedPaise), week: capital.liveWeek })),
      el('span', null, MONEY.joinsAds({ amount: rupees(capital.joinsPaise) })),
    );
    box.append(bar, figures, el('p', 'wm-small', MONEY.capitalNote()));
    return { box, strips: capital.strips };
  }

  function positionPart(draft) {
    const model = positionModel(draft, ctx.brief);
    const box = el('div', 'wm-part');
    box.append(el('p', 'wm-label', MONEY.positionHead({ amount: rupees(REPOSITION_COST_PAISE) })));
    const grid = el('div', 'wm-cells');
    for (const cell of model.cells) {
      const pick = button('wm-cell', null, () => {
        setPosition(draft, cell.key);
        changed();
      });
      pick.disabled = !cell.reachable;
      pick.setAttribute('aria-pressed', String(cell.chosen));
      pick.append(
        el('strong', null, MONEY.cellName({ price: cell.price, purpose: cell.purpose })),
        el('span', 'wm-num', MONEY.cellEconomics({
          order: rupees(cell.economics.aovMeanPaise), margin: pct(cell.economics.marginPct),
        })),
        el('span', 'wm-small', MONEY.cellSearches({ searches: whole(cell.searches) })),
      );
      if (cell.here) pick.append(el('span', 'wm-small', MONEY.youAreHere()));
      else if (!cell.reachable) pick.append(el('span', 'wm-small', MONEY.tooFar()));
      grid.append(pick);
    }
    box.append(grid);
    if (model.moved) box.append(el('p', 'wm-warn', MONEY.moveNote({ amount: rupees(REPOSITION_COST_PAISE) })));
    box.append(el('p', 'wm-small', MONEY.positionNote()));
    return box;
  }

  function sketch(strips) {
    const box = el('div', 'wm-part');
    const page = el('div', 'wm-page');
    page.setAttribute('aria-hidden', 'true');
    page.append(el('div', 'wm-strip', MONEY.yourProduct()));
    for (const strip of strips) page.append(el('div', 'wm-strip', strip.label));
    box.append(el('p', 'wm-label', MONEY.landsOn()), page);
    return box;
  }

  function windowCard(draft) {
    const card = el('div', 'wm-window');
    card.dataset.slot = 'window';
    let sub = MONEY.windowBoth();
    if (!draft.repositionOpen) sub = MONEY.windowCapital();
    else if (!draft.capexOpen) sub = MONEY.windowMove();
    const head = el('div', 'wm-head');
    head.append(el('h3', null, MONEY.windowTitle()), el('span', 'wm-small', sub));
    card.append(head);

    // D12: the one figure the capital choice turns on, from the month just played.
    const month = ctx.lastMonth;
    if (draft.capexOpen && month) {
      const figures = { spent: rupees(month.spentPaise), budget: rupees(month.budgetPaise), lost: pct(month.lostToBudget) };
      const read = el('p', 'wm-read');
      read.append(el('strong', null, month.lostToBudget < NEVER_RAN_OUT
        ? CAPITAL.lastMonthNeverRanOut(figures) : CAPITAL.lastMonth(figures)));
      read.append(document.createTextNode(` ${CAPITAL.turnsOn()}`));
      add(read, whyButton(CAPITAL.turnsOn, openGuide));
      card.append(read);
    }

    const columns = el('div', 'wm-split');
    const left = el('div', 'wm-column');
    const right = el('div', 'wm-column');
    let strips = [];
    if (draft.capexOpen) {
      const capital = capitalPart(draft);
      left.append(capital.box);
      strips = capital.strips;
    }
    if (draft.repositionOpen) right.append(positionPart(draft));
    if (draft.capexOpen) right.append(sketch(strips));
    columns.append(...[left, right].filter((column) => column.childElementCount > 0));
    card.append(columns);
    return card;
  }

  // --- the month, one bar -------------------------------------------------------

  function drawBar(draft) {
    const month = monthModel(draft, ctx.spentByWeek);
    const shown = month.spentPaise + month.weeks.filter((w) => w.state !== 'spent').reduce((a, w) => a + w.amountPaise, 0);
    const scale = Math.max(1, month.totalPaise, shown);
    const bar = el('div', 'wm-bar');
    const segs = el('div', 'wm-segs');
    const lines = el('div', 'wm-lines');
    let before = 0;
    month.weeks.forEach((week, i) => {
      const seg = el('div', 'wm-seg');
      seg.classList.add(week.state);
      seg.style.width = `${(100 * week.amountPaise) / scale}%`;
      const state = { spent: MONEY.weekSpent, next: MONEY.weekNext, planned: MONEY.weekPlanned }[week.state]();
      seg.append(el('strong', null, MONEY.weekName({ week: week.week })),
        el('span', 'wm-num', MONEY.weekFigure({ amount: rupees(week.amountPaise), state })));
      segs.append(seg);
      before += week.amountPaise;
      const last = i === month.weeks.length - 1;
      // The last line draws on what is not planned, or gives back what is
      // planned past the month; at week 5 the engine spreads the whole month.
      const lastMoves = !month.respread && (month.unplannedPaise > 0 || month.overPaise > 0);
      if (week.state !== 'spent' && (!last || lastMoves)) lines.append(handle(draft, month, i, before, scale));
    });
    if (month.unplannedPaise > 0) {
      const seg = el('div', 'wm-seg');
      seg.classList.add('unplanned');
      seg.style.width = `${(100 * month.unplannedPaise) / scale}%`;
      seg.append(el('strong', null, MONEY.unplanned()), el('span', 'wm-num', rupees(month.unplannedPaise)));
      segs.append(seg);
    }
    bar.append(segs, lines);
    const notes = [bar];
    if (month.unplannedPaise > 0) notes.push(el('p', 'wm-warn', MONEY.unplannedNote({ amount: rupees(month.unplannedPaise) })));
    if (month.overPaise > 0) notes.push(el('p', 'wm-warn', MONEY.overNote({ amount: rupees(month.overPaise) })));
    notes.push(el('p', 'wm-small', MONEY.lostAtEnd()));
    barHost.replaceChildren(...notes);
  }

  /** The line after week `i`: drag it, or focus it and press an arrow key. */
  function handle(draft, month, i, atPaise, scale) {
    const week = month.weeks[i];
    const next = month.weeks[i + 1] ?? null;
    const pair = week.amountPaise + (next ? next.amountPaise : month.unplannedPaise);
    const line = el('button', 'wm-line');
    line.type = 'button';
    line.dataset.line = String(i);
    line.style.left = `${(100 * atPaise) / scale}%`;
    line.setAttribute('role', 'slider');
    line.setAttribute('aria-label', next
      ? MONEY.moveLineLabel({ from: week.week, to: next.week }) : MONEY.lastLineLabel({ week: week.week }));
    line.setAttribute('aria-valuemin', '0');
    line.setAttribute('aria-valuemax', String(Math.round(Math.max(pair, week.amountPaise) / 100)));
    line.setAttribute('aria-valuenow', String(Math.round(week.amountPaise / 100)));
    line.setAttribute('aria-valuetext', MONEY.lineValue({
      week: week.week, amount: rupees(week.amountPaise),
      next: next ? MONEY.weekName({ week: next.week }) : MONEY.unplanned(),
      rest: rupees(next ? next.amountPaise : month.unplannedPaise),
    }));

    const move = (amountPaise) => {
      if (!moveLine(draft, monthModel(draft, ctx.spentByWeek), i, amountPaise)) return false;
      drawBar(draft);
      refreshTray?.();
      return true;
    };
    // The redraw replaced this line. The last one goes altogether once nothing
    // is left unplanned, so the focus falls back to the line before it.
    const refocus = () => (barHost.querySelector(`[data-line="${i}"]`)
      ?? [...barHost.querySelectorAll('.wm-line')].pop())?.focus();
    line.addEventListener('keydown', (event) => {
      const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const now = monthModel(draft, ctx.spentByWeek).weeks[i].amountPaise;
      if (move(now + step * STEP_PAISE)) refocus();
    });
    line.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      line.focus();
      const rect = line.parentElement.getBoundingClientRect();
      const earlier = atPaise - week.amountPaise;
      const drag = (ev) => {
        const at = ((ev.clientX - rect.left) / rect.width) * scale;
        move(Math.round((at - earlier) / STEP_PAISE) * STEP_PAISE);
      };
      const up = () => {
        window.removeEventListener('pointermove', drag);
        window.removeEventListener('pointerup', up);
        refocus();
      };
      window.addEventListener('pointermove', drag);
      window.addEventListener('pointerup', up);
    });
    return line;
  }

  function monthCard(draft) {
    const month = monthModel(draft, ctx.spentByWeek);
    const card = el('div', 'wm-card');
    card.dataset.slot = 'budget';
    const next = month.weeks.find((w) => w.state === 'next');
    const last = month.weeks[month.weeks.length - 1];
    let sub;
    if (month.respread) {
      const joins = draft.capexOpen ? capitalModel(draft).joinsPaise : 0;
      const moved = draft.repositionOpen && positionModel(draft, ctx.brief).moved;
      sub = MONEY.monthWindow({
        base: rupees(draft.monthlyBudgetPaise), joins: joins > 0 ? rupees(joins) : '',
        move: moved ? rupees(REPOSITION_COST_PAISE) : '',
      });
    } else {
      sub = MONEY.monthLeft({
        left: rupees(Math.max(0, month.totalPaise - month.spentPaise)), from: next?.week ?? last.week, to: last.week,
      });
    }
    const titles = el('div', 'wm-titles');
    titles.append(el('h3', null, MONEY.monthHead({ month: month.month, amount: rupees(month.totalPaise) })),
      el('p', 'wm-small', sub));
    const hint = el('p', 'wm-small', MONEY.dragHint());
    add(hint, whyButton(MONEY.dragHint, openGuide));
    const head = el('div', 'wm-head');
    head.append(titles, hint);
    barHost = el('div', 'wm-barhost');
    barHost.dataset.slot = 'split';
    card.append(head, barHost);
    drawBar(draft);
    return card;
  }

  // --- bidding -------------------------------------------------------------------

  function cpaSoFar() {
    const rows = game.state.history.map((h) => h.byAdvertiser[game.playerId]).filter(Boolean);
    const cost = rows.reduce((a, r) => a + r.traffic.costPaise, 0);
    const sales = rows.reduce((a, r) => a + r.conversions.final, 0);
    return sales > 0 ? cost / sales : null;
  }

  function drawBid(draft) {
    const model = biddingModel(draft);
    const name = MONEY.strategyName[model.strategy]();
    const shown = [];
    const o = model.outlook;
    if (o) {
      const figures = { strategy: name, bid: rupees(o.bidPaise), keyword: o.keywordText, need: rupees(o.needPaise) };
      shown.push(el('p', o.willShow ? 'wm-read' : 'wm-warn', o.willShow ? MONEY.bidShows(figures) : MONEY.bidNowhere(figures)));
    }
    if (model.strategies.find((s) => s.id === model.strategy).predicts) {
      shown.push(el('p', 'wm-small', MONEY.observed({
        conversions: model.observed.conversions.toFixed(1), rate: pct(model.observed.rate, 2),
      })));
    }
    if (model.learning) {
      const said = model.learning === 'predicts' ? MONEY.learningPredicts : MONEY.learningFree;
      const warn = el('p', model.learning === 'predicts' ? 'wm-warn' : 'wm-small', said({ n: LEARNING_ROUNDS, strategy: name }));
      add(warn, whyButton(said, openGuide));
      shown.push(warn);
    }
    bidHost.replaceChildren(...shown);
  }

  function targetBox(draft, t) {
    const box = el('div', 'wm-targetbox');
    const label = MONEY.strategyName[t.kind]();
    const show = (v) => (t.kind === 'targetCpa' ? rupees(v) : v.toFixed(1));
    const value = el('strong', 'wm-num', show(t.value));
    const top = el('div', 'wm-target-head');
    top.append(el('span', null, label), value);
    const slider = el('input', 'wm-slider');
    slider.type = 'range';
    slider.min = String(t.min);
    slider.max = String(t.max);
    slider.step = String(t.step);
    slider.value = String(Math.min(t.max, Math.max(t.min, t.value)));
    slider.setAttribute('aria-label', label);
    slider.setAttribute('aria-valuetext', show(t.value));
    slider.addEventListener('input', () => {
      const v = t.kind === 'targetCpa' ? Math.round(Number(slider.value)) : Number(Number(slider.value).toFixed(1));
      if (!setStrategyParam(draft, v).ok) return;
      value.textContent = show(v);
      slider.setAttribute('aria-valuetext', show(v));
      drawBid(draft);
      refreshTray?.();
    });
    let hint;
    if (t.kind === 'targetRoas') hint = MONEY.roasHint({ roas: ratio(ctx.money?.netRoas) });
    else {
      const cpa = cpaSoFar();
      hint = cpa === null ? MONEY.cpaNone() : MONEY.cpaHint({ amount: rupees(cpa) });
    }
    box.append(top, slider, el('p', 'wm-small', hint));
    return box;
  }

  function biddingCard(draft) {
    const model = biddingModel(draft);
    const card = el('div', 'wm-card');
    card.dataset.slot = 'bidding';
    const sub = el('span', 'wm-small', MONEY.biddingSub());
    add(sub, whyButton(MONEY.biddingSub, openGuide));
    const head = el('div', 'wm-head');
    head.append(el('h3', null, MONEY.biddingTitle()), sub);
    card.append(head);
    if (model.learningLeft > 0) {
      const now = el('p', 'wm-warn', MONEY.learningNow({ n: model.learningLeft }));
      add(now, whyButton(MONEY.learningNow, openGuide));
      card.append(now);
    }
    const chips = el('div', 'wm-chips');
    for (const id of STRATEGY_ORDER) {
      const chip = button('wm-chip', MONEY.strategyName[id](), () => {
        setStrategy(draft, id);
        changed();
      });
      chip.setAttribute('aria-pressed', String(id === model.strategy));
      chips.append(chip);
    }
    card.append(chips, el('p', 'wm-read', MONEY.strategyWhat[model.strategy]()));
    if (model.target) card.append(targetBox(draft, model.target));
    bidHost = el('div', 'wm-bid');
    card.append(bidHost, el('p', 'wm-small', MONEY.ceiling({ times: MAX_BID_MULTIPLE })));
    drawBid(draft);
    return card;
  }

  // --- what week 8 decides ------------------------------------------------------------

  function deadlineCard() {
    const d = deadlineModel(game.state, game.playerId);
    const monthAfter = Math.ceil((d.snapshot + 1) / ROUNDS_PER_MONTH);
    const card = el('div', 'wm-card');
    card.dataset.slot = 'deadline';
    card.append(el('h3', null, MONEY.deadlineTitle({ week: d.snapshot })));
    if (d.rank) {
      // The month the rank set, as the engine gave it (rankAllocations), never
      // a total summed again after the snapshot: history keeps being revised.
      const amount = game.draft.monthlyBudgetPaise;
      const figures = {
        week: d.snapshot, position: d.rank.position, of: d.rank.of, month: monthAfter,
        amount: rupees(amount), usual: rupees(MONTHLY_BUDGET_PAISE),
      };
      let said = MONEY.rankedSame;
      if (rupees(amount) !== rupees(MONTHLY_BUDGET_PAISE)) said = amount > MONTHLY_BUDGET_PAISE ? MONEY.rankedMore : MONEY.rankedLess;
      card.append(el('p', 'wm-read', said(figures)));
    } else if (!d.taken) {
      card.append(el('p', 'wm-read', d.through > 0
        ? MONEY.counted({ amount: rupees(d.countedPaise), from: 1, to: d.through }) : MONEY.countedNone()));
      card.append(el('p', 'wm-small', MONEY.weeksLeft({ n: d.weeksLeft, week: d.snapshot })));
    }
    card.append(el('p', 'wm-label', MONEY.ladderHead({ month: monthAfter })));
    const ladder = el('div', 'wm-ladder');
    const top = d.ladder[0].budgetPaise;
    for (const rung of d.ladder) {
      const row = el('div', 'wm-rung');
      if (rung.multiplier === 1) row.classList.add('average');
      if (d.rank?.position === rung.finish) row.classList.add('you');
      const track = meter(rung.budgetPaise / top);
      const percent = pct(Math.abs(rung.multiplier - 1));
      row.append(el('span', null, MONEY.finish({ n: rung.finish })), track, el('span', 'wm-num', rupees(rung.budgetPaise)),
        el('span', 'wm-small', rung.multiplier === 1 ? MONEY.average() : MONEY.versus({ percent, up: rung.multiplier > 1 })));
      ladder.append(row);
    }
    const gap = d.ladder[0].budgetPaise - d.ladder[d.ladder.length - 1].budgetPaise;
    card.append(ladder, el('p', 'wm-small', MONEY.ladderNote({ gap: rupees(gap), month: monthAfter, week: d.snapshot })));
    return card;
  }

  function draw() {
    const draft = game.draft;
    const parts = [];
    if (draft.capexOpen || draft.repositionOpen) parts.push(windowCard(draft));
    parts.push(monthCard(draft));
    const row = el('div', 'wm-row');
    row.append(biddingCard(draft), deadlineCard());
    parts.push(row);
    node.replaceChildren(...parts);
  }

  draw();
  return { node, refresh: draw };
}
