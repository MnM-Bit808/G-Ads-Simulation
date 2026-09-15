/**
 * The Studio's Returns (design/returns/, chosen by the owner 2026-09-15): the
 * five figures, every week split into refused at the door and sent back, the
 * prepaid discount's rungs, each drawing what it saves a week against what it
 * costs, and what else moves returns. What it shows is worked out in
 * ./read.js and the form's `prepaidRungs`; the words are in
 * ui/words/returns.js. A rung is staged through the form's own
 * `setPrepaidDiscount`, so the tray words it.
 *
 * A RUNG REDRAWS ONLY THE DISCOUNT, and hands the focus back to the rung
 * pressed, so a keyboard is not sent back to the top of the page.
 */

import { el, add, rupees, whole, pct } from '../dom.js';
import { RTO_FREIGHT_PAISE, TOTAL_ROUNDS } from '../../engine/constants.js';
import { liveCapexPaise } from '../../engine/positions.js';
import { LOCATIONS } from '../../content/locations.js';
import { SETTLES_AFTER_ROUNDS, allocationWindowPhrase } from '../dashboard.js';
import { prepaidRungs, setPrepaidDiscount } from '../decisions.js';
import { featureAt } from '../landing-page.js';
import { whyButton } from '../guide/drawer.js';
import { SECTIONS } from '../shell/sections.js';
import { RETURNS, RETURNS_STUDIO as W } from '../words/returns.js';
import {
  returnsReading, liveMarks, stepReading, placeReturns, discountTrade, capitalWindow,
} from './read.js';

/** The height a week's bar would take at the chart's top rate, px. */
const PLOT_PX = 170;
/** The two capital targets on returns, in the order the levers card names them. */
const TARGETS = ['orderConfirmation', 'sizeGuide'];

function button(className, text, onClick) {
  const node = el('button', className, text);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

function swatch(kind) {
  const node = el('span', 'wr-swatch');
  node.classList.add(kind);
  node.setAttribute('aria-hidden', 'true');
  return node;
}

/**
 * @param {object} args
 * @param {object} args.game - the played game (ui/app.js, openGame)
 * @param {object} args.ctx - the dashboard's context: `places`
 * @param {Function} [args.openGuide] - `guide.open`
 * @param {(key: string) => void} [args.openSection] - the shell's, for the levers' links
 * @param {() => void} [args.refreshTray] - redraws the tray after a change
 * @returns {{node: HTMLElement, refresh: () => void}}
 */
export function renderReturnsSection({ game, ctx, openGuide, openSection, refreshTray }) {
  const node = el('div', 'wr');

  function figure(label, value, sub, { kind = null, why = null } = {}) {
    const box = el('div', 'wr-figure');
    const head = el('div', 'wr-label');
    if (kind) head.append(swatch(kind));
    head.append(el('span', null, label));
    add(head, why ? whyButton(why, openGuide) : null);
    box.append(head, el('strong', 'wr-value', value), el('span', 'wr-small', sub));
    return box;
  }

  function figuresCard(r) {
    const card = el('div', 'wr-card');
    card.dataset.slot = 'returns-figures';
    const rate = (n) => (r.orders > 0 ? n / r.orders : 0);
    const back = r.refused + r.sentBack;
    const row = el('div', 'wr-figures');
    add(row,
      figure(RETURNS.cameBack(), pct(rate(back), 1), RETURNS.cameBackSub({ returned: whole(back), orders: whole(r.orders) })),
      figure(W.refusedAtDoor(), pct(rate(r.refused), 1), RETURNS.refusedSub({ refused: whole(r.refused) }), { kind: 'refused' }),
      figure(RETURNS.sentBack(), pct(rate(r.sentBack), 1), RETURNS.sentBackSub({ sentBack: whole(r.sentBack) }), { kind: 'sent' }),
      figure(RETURNS.freight(), rupees(r.freightPaise), W.freightSub({ perParcel: rupees(RTO_FREIGHT_PAISE) })),
      r.codShare == null ? null : figure(W.paidAtDoor(), pct(r.codShare), W.paidAtDoorSub(), { why: W.paidAtDoor }));
    const counted = el('p', 'wr-small', W.counted({ from: r.countedFrom, to: r.countedTo, settlesAfter: SETTLES_AFTER_ROUNDS }));
    add(counted, whyButton(W.counted, openGuide));
    card.append(row, counted);
    return card;
  }

  function reading(r, step) {
    const rates = (w) => ({ refused: pct(w.refused / w.conversions, 1), sentBack: pct(w.sentBack / w.conversions, 1) });
    if (step) {
      return [W.step({
        half: step.half, direction: step.direction, before: pct(step.before, 1), after: pct(step.after, 1),
        from: step.beforeFrom, to: step.beforeTo, week: step.week, target: step.target,
        otherBefore: pct(step.otherBefore, 1), otherAfter: pct(step.otherAfter, 1),
      })];
    }
    const said = r.settled.length === 1
      ? W.onlyOne({ from: r.countedFrom, ...rates(r.settled[0]) })
      : W.plain({ from: r.countedFrom, to: r.countedTo, ...rates({ conversions: r.orders, refused: r.refused, sentBack: r.sentBack }) });
    return r.countedTo < r.latest ? [said, W.stillComing({ next: r.countedTo + 1, latest: r.latest })] : [said];
  }

  function chartCard(r) {
    const card = el('div', 'wr-card');
    card.dataset.slot = 'returns';
    const legend = el('div', 'wr-legend');
    const key = (kind, text, why) => {
      const item = el('span', 'wr-key');
      item.append(swatch(kind), el('span', null, text));
      add(item, why ? whyButton(why, openGuide) : null);
      return item;
    };
    legend.append(key('refused', RETURNS.keyRefused(), RETURNS.keyRefused), key('sent', RETURNS.keySentBack()),
      key('still', W.keyStill()));
    const head = el('div', 'wr-head');
    head.append(el('h3', null, W.chartTitle()), legend);

    const marks = liveMarks(game.draft.capexBlock);
    const share = (w, key) => (w.conversions > 0 ? w[key] / w.conversions : 0);
    const top = Math.max(0.4, Math.ceil(10 * Math.max(0, ...r.weeks.map((w) => share(w, 'refused') + share(w, 'sentBack')))) / 10);
    const chart = el('div', 'wr-chart');
    for (let week = 1; week <= TOTAL_ROUNDS; week++) {
      const w = r.weeks.find((x) => x.round === week);
      const col = el('div', 'wr-col');
      const plot = el('div', 'wr-plot');
      const mark = marks.find((m) => m.week === week);
      if (mark) {
        col.classList.add('marked');
        plot.append(el('span', 'wr-mark', week <= r.latest ? W.markLive({ target: mark.target }) : W.markLater({ target: mark.target })));
      }
      if (w) {
        const refused = share(w, 'refused');
        const sent = share(w, 'sentBack');
        if (!w.settled) col.classList.add('still');
        col.setAttribute('role', 'img');
        col.setAttribute('aria-label', W.column({ week, refused: pct(refused, 1), sentBack: pct(sent, 1), still: !w.settled }));
        if (w.settled) plot.append(el('span', 'wr-total', pct(refused + sent)));
        const stack = el('div', 'wr-stack');
        stack.setAttribute('aria-hidden', 'true');
        const sentBar = el('span', 'wr-sent');
        sentBar.style.height = `${Math.round((PLOT_PX * sent) / top)}px`;
        const refusedBar = el('span', 'wr-refused');
        refusedBar.style.height = `${Math.round((PLOT_PX * refused) / top)}px`;
        stack.append(sentBar, refusedBar);
        plot.append(stack);
      } else {
        col.classList.add('future');
      }
      const label = el('div', 'wr-week');
      label.setAttribute('aria-hidden', 'true');
      label.append(el('span', null, String(week)), el('span', 'wr-still', w && !w.settled ? RETURNS.stillIn() : ''));
      col.append(plot, label);
      chart.append(col);
    }
    const scroll = el('div', 'wr-scroll');
    scroll.append(chart);
    const read = el('div', 'wr-reading');
    for (const said of reading(r, stepReading(r, marks))) read.append(el('p', null, said));
    card.append(head, scroll, read);
    return card;
  }

  function prepaidCard(r) {
    const card = el('div', 'wr-card');
    card.dataset.slot = 'prepaid';
    const sub = el('span', 'wr-small', W.prepaidSub());
    add(sub, whyButton(W.prepaidSub, openGuide));
    const head = el('div', 'wr-head');
    head.append(el('h3', null, W.prepaidTitle()), sub);
    const rungsHost = el('div', 'wr-rungs');
    const detail = el('div', 'wr-detail');
    card.append(head, rungsHost, detail);

    const perWeek = r.orders / r.settled.length;
    const draw = (focus = null) => {
      const draft = game.draft;
      const rungs = discountTrade(prepaidRungs(draft, ctx.places()), { ordersPerWeek: perWeek, perRefusalPaise: r.perRefusalPaise });
      const scale = Math.max(1, ...rungs.map((x) => Math.max(x.savedPerWeekPaise, x.costPerWeekPaise)));
      const chosen = rungs.find((x) => x.paise === draft.prepaidDiscountPaise) ?? rungs[0];
      const bars = (rung, className) => {
        const box = el('span', className);
        box.setAttribute('aria-hidden', 'true');
        for (const [kind, paise] of [['saves', rung.savedPerWeekPaise], ['costs', rung.costPerWeekPaise]]) {
          const track = el('span', 'wr-track');
          const fill = el('span', kind);
          fill.style.width = `${(100 * paise) / scale}%`;
          track.append(fill);
          box.append(track);
        }
        return box;
      };
      rungsHost.replaceChildren(...rungs.map((rung, i) => {
        const pick = button('wr-rung', null, () => {
          setPrepaidDiscount(draft, rung.paise);
          draw(i);
          refreshTray?.();
        });
        pick.setAttribute('aria-pressed', String(rung === chosen));
        if (rung === chosen && rung.paise !== draft.base.prepaidDiscountPaise) pick.classList.add('change');
        pick.append(el('strong', null, rung.paise === 0 ? W.none() : rupees(rung.paise)));
        if (rung.paise > 0) pick.append(bars(rung, 'wr-bars'));
        return pick;
      }));
      const none = pct(rungs[0].refusal, 1);
      if (chosen.paise === 0) {
        detail.replaceChildren(el('p', 'wr-read', W.noneLine({ rate: none })),
          el('p', 'wr-small', `${W.noneShape()} ${W.pickHint()}`));
      } else {
        const rung = rupees(chosen.paise);
        const trade = el('div', 'wr-trade');
        for (const [kind, label, sub, paise] of [
          ['saves', W.saves({ amount: rupees(chosen.savedPerWeekPaise) }), W.savesSub({
            parcels: chosen.avoidedPerWeek.toFixed(1), freight: rupees(RTO_FREIGHT_PAISE), margin: rupees(r.marginPaise),
          }), chosen.savedPerWeekPaise],
          ['costs', W.costs({ amount: rupees(chosen.costPerWeekPaise) }), W.costsSub({
            rung, orders: whole(chosen.prepaidOrdersPerWeek),
          }), chosen.costPerWeekPaise],
        ]) {
          const track = el('span', 'wr-track');
          track.setAttribute('aria-hidden', 'true');
          const fill = el('span', kind);
          fill.style.width = `${(100 * paise) / scale}%`;
          track.append(fill);
          trade.append(el('strong', 'wr-num', label), track, el('span'), el('span', 'wr-small', sub));
        }
        detail.replaceChildren(
          el('p', 'wr-read', W.rungRate({ none, at: pct(chosen.refusal, 1), rung, fewer: pct(chosen.fewer, 1) })),
          trade,
          el('p', 'wr-small', W.rungFoot({ orders: whole(perWeek), from: r.countedFrom, to: r.countedTo })),
        );
      }
      if (focus !== null) rungsHost.children[focus]?.focus();
    };
    draw();
    return card;
  }

  function capitalLines() {
    const draft = game.draft;
    const capital = capitalWindow(game.state.budgetSchedule?.capexAllocationRounds, draft.round);
    let state = W.capitalClosed();
    if (capital.state === 'open') state = W.capitalOpen();
    else if (capital.state === 'later') state = W.capitalLater({ window: allocationWindowPhrase(capital.later) });
    const lines = [state];
    const marks = liveMarks(draft.capexBlock);
    for (const target of TARGETS) {
      const live = liveCapexPaise(draft.capexBlock, target, draft.round);
      const total = draft.capexBlock?.committed?.[target] ?? 0;
      const since = marks.find((m) => m.target === target && m.week <= draft.round)?.week ?? 0;
      const laterMark = marks.find((m) => m.target === target && m.week > draft.round);
      lines.push(W.capitalTarget({
        target,
        rung: live > 0 ? featureAt(target, live).label : '',
        since,
        later: total > live ? featureAt(target, total).label : '',
        laterWeek: laterMark?.week ?? 0,
      }));
    }
    return lines.join(' ');
  }

  function leversCard(r) {
    const card = el('div', 'wr-card');
    card.dataset.slot = 'returns-levers';
    const lever = (name, reach, ...body) => {
      const box = el('div', 'wr-lever');
      const head = el('div', 'wr-lever-head');
      head.append(el('strong', null, name), el('span', 'wr-small', reach));
      box.append(head, ...body);
      return box;
    };
    const go = (key) => button('wr-go', SECTIONS.find((s) => s.key === key).label, () => openSection?.(key));

    const table = el('div', 'wr-places');
    table.append(el('span'), el('span', 'wr-col-head', W.colRefused()), el('span', 'wr-col-head', W.colSentBack()),
      el('span', 'wr-col-head', W.colPaidAtDoor()));
    placeReturns(game.state.history, game.playerId, r.settled).forEach((p, i) => {
      const rate = (n) => (p.orders > 0 ? pct(n / p.orders, 1) : '—');
      table.append(el('span', null, LOCATIONS[i].label), el('span', 'wr-num', rate(p.refused)),
        el('span', 'wr-num', rate(p.sentBack)), el('span', 'wr-num', p.codShare == null ? '—' : pct(p.codShare)));
    });

    card.append(el('h3', null, W.leversTitle()),
      lever(W.placeHead(), W.bothHalves(), table, go('where')),
      lever(W.blockHead(), W.bothHalves(), el('p', 'wr-read', W.blockText()), go('typed')),
      lever(W.capitalHead(), W.oneHalfEach(), el('p', 'wr-read', capitalLines())));
    return card;
  }

  function draw() {
    const r = returnsReading(game.state.history, game.playerId, SETTLES_AFTER_ROUNDS);
    if (r.settled.length === 0) {
      const note = el('p', 'studio-panel', RETURNS.nothingSettled({
        settlesAfter: SETTLES_AFTER_ROUNDS, firstHonestWeek: SETTLES_AFTER_ROUNDS + 1,
      }));
      node.replaceChildren(note);
      return;
    }
    const row = el('div', 'wr-row');
    row.append(prepaidCard(r), leversCard(r));
    node.replaceChildren(figuresCard(r), chartCard(r), row);
  }

  draw();
  return { node, refresh: draw };
}
