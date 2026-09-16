/**
 * The Studio's Where and when (design/where-when/, the owner's choice of
 * 2026-09-15): where you advertise as three rows beside the India map, then the
 * hours of the day drawn to scale, every setting a bar to drag. What it shows is
 * worked out in ./read.js and every sentence is in ../words/where.js.
 *
 * A DRAG MOVES ONLY WHAT IT TOUCHES: the bar, its readout, the map's dots and
 * the tray. The form's refresh, which redraws the classic cards behind the
 * section, waits for the bar to be let go, as Your keywords' slider does.
 *
 * EVERY BAR IS A SLIDER to a keyboard and a screen reader: arrows move it a
 * step, Page keys five steps, Home turns it off and End takes it to the top.
 * The map is hidden from screen readers (ui/map/india.js); the rows are the
 * control.
 */

import { el, add, rupees, whole, pct } from '../dom.js';
import { MAX_BID_MULTIPLE, MAX_CLICKS_AGGRESSION, MIN_HOUR_OBSERVATIONS } from '../../engine/constants.js';
import { whyButton } from '../guide/drawer.js';
import { drawIndia, sizeDots } from '../map/india.js';
import { WHERE } from '../words/where.js';
import { STEP, OFF, settle, hoursModel, placesModel, setHour, setPlace } from './read.js';

/** A drag this close to even lands on even: the one setting worth finding by hand. */
const STICKY = 6;
const PAGE = 5 * STEP;
const HOURS_A_DAY = 24;
/** A row names this many of its cities; the map names them all. */
const NAMED = 4;

/** The part of a bar a setting fills: off none of it, even a share, the top all of it. */
const share = (percent, top) => (percent - OFF) / (top - OFF);
const asPct = (fraction) => `${(100 * fraction).toFixed(2)}%`;
const multiplier = (percent) => Math.max(0, 1 + percent / 100);

function setting(percent) {
  if (percent === 0) return WHERE.even();
  if (percent <= OFF) return WHERE.off();
  return `${percent > 0 ? '+' : '−'}${Math.abs(percent)}%`;
}

function effect(percent) {
  if (percent <= OFF) return WHERE.offBid();
  if (percent === 0) return '';
  return WHERE.times({ value: String(Number(multiplier(percent).toFixed(2))) });
}

function tone(percent) {
  if (percent <= OFF) return 'off';
  if (percent > 0) return 'up';
  if (percent < 0) return 'down';
  return 'even';
}

/**
 * One setting as a slider: dragged along `axis`, or moved by keys.
 *
 * @param {object} args
 * @param {HTMLElement} args.node - what a pointer grabs and a key moves
 * @param {'x'|'y'} args.axis
 * @param {string} args.key - `data-key`, so a redraw can give focus back
 * @param {string} args.name - what a screen reader calls it
 * @param {number} args.top
 * @param {() => number} args.value - the setting now
 * @param {(percent: number) => void} args.onMove - each step of a drag, and each key
 * @param {() => void} args.onSettle - the bar let go, or a key pressed
 */
function slider({ node, axis, key, name, top, value, onMove, onSettle }) {
  node.tabIndex = 0;
  node.dataset.key = key;
  node.setAttribute('role', 'slider');
  node.setAttribute('aria-label', name);
  node.setAttribute('aria-orientation', axis === 'y' ? 'vertical' : 'horizontal');
  node.setAttribute('aria-valuemin', String(OFF));
  node.setAttribute('aria-valuemax', String(top));
  const describe = () => {
    const now = value();
    node.setAttribute('aria-valuenow', String(Math.min(now, top)));
    node.setAttribute('aria-valuetext', [setting(now), effect(now)].filter(Boolean).join(' · '));
  };
  describe();
  const at = (event) => {
    const box = node.getBoundingClientRect();
    const along = axis === 'y' ? (box.bottom - event.clientY) / box.height : (event.clientX - box.left) / box.width;
    const raw = OFF + along * (top - OFF);
    return Math.abs(raw) <= STICKY ? 0 : settle(raw, top);
  };
  node.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    node.setPointerCapture?.(event.pointerId);
    node.focus();
    const section = node.closest('.ww');
    section?.classList.add('dragging');
    const move = (e) => { onMove(at(e)); describe(); };
    const up = () => {
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', up);
      section?.classList.remove('dragging');
      onSettle();
    };
    move(event);
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', up);
  });
  node.addEventListener('keydown', (event) => {
    const now = Math.min(value(), top);
    const next = {
      ArrowUp: now + STEP, ArrowRight: now + STEP, ArrowDown: now - STEP, ArrowLeft: now - STEP,
      PageUp: now + PAGE, PageDown: now - PAGE, Home: OFF, End: top,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onMove(settle(next, top));
    describe();
    onSettle();
  });
}

/** The heading every part carries: its name, a line under it, and how to use it. */
function head(title, sub, hint, over) {
  const box = el('div', 'ww-head');
  const left = el('div', 'ww-title');
  left.append(el('h3', null, title), el('span', 'ww-sub', sub));
  const right = el('span', 'ww-hint', over ? `${hint} · ${over}` : hint);
  box.append(left, right);
  return box;
}

/**
 * @param {object} args
 * @param {object} args.game - the played game (ui/app.js, openGame)
 * @param {object} args.ctx - the decision form's context (ui/dashboard.js); `ctx.refresh` redraws the form
 * @param {Function} [args.openGuide]
 * @param {() => void} args.refreshTray - the tray alone, for each step of a drag
 * @returns {{node: HTMLElement, refresh: () => void}}
 */
export function renderWhereSection({ game, ctx, openGuide, refreshTray }) {
  const node = el('div', 'ww');
  const played = game.state.history?.length ?? 0;
  const over = played > 0 ? WHERE.over({ from: 1, to: played }) : null;

  function places() {
    const draft = game.draft;
    const model = placesModel(draft, game.state.history, game.playerId);
    const part = el('section', 'ww-part');
    // The guide's "show me on the card" looks for this slot (sections.js, draws).
    part.dataset.slot = 'places';
    part.append(head(WHERE.placesTitle(), WHERE.placesSub(), WHERE.placesHint(), over));

    const bids = () => Object.fromEntries(model.rows.map((row, i) => [row.id, multiplier(draft.locationAdjustments[i] ?? 0)]));
    const rows = el('div', 'ww-rows');
    let lit = null;
    const map = drawIndia({
      locations: model.rows,
      shares: model.shares ?? Object.fromEntries(model.rows.map((row) => [row.id, 0])),
      bids: bids(),
      onPick: (id) => node.querySelector(`[data-key="place:${model.rows.findIndex((row) => row.id === id)}"]`)?.focus(),
    });
    const light = (id) => {
      lit = id;
      for (const group of map.querySelectorAll('[data-place]')) {
        group.classList.toggle('lit', group.dataset.place === id);
        group.classList.toggle('dim', id !== null && group.dataset.place !== id);
      }
      for (const row of rows.children) row.classList.toggle('lit', row.dataset.place === id);
    };

    model.rows.forEach((row, index) => {
      const card = el('div', 'ww-row');
      card.dataset.place = row.id;
      const readout = el('span', 'ww-setting');
      const times = el('span', 'ww-times');
      const top = el('div', 'ww-row-head');
      const named = el('div', 'ww-named');
      const names = { n: row.examples.length, names: row.examples.slice(0, NAMED).join(', '), more: row.examples.length - NAMED };
      named.append(el('strong', null, row.label),
        el('span', 'ww-cities', names.more > 0 ? WHERE.citiesMore(names) : WHERE.cities(names)));
      const now = el('div', 'ww-now');
      now.append(times, readout);
      top.append(named, now);

      const figures = el('div', 'ww-figures');
      if (row.clicks >= 1 && row.keptPerClickPaise != null) {
        const figure = (value, label, cls) => {
          const box = el('div', 'ww-figure');
          box.append(el('strong', cls, value), el('span', null, label));
          return box;
        };
        figures.append(figure(rupees(row.keptPerClickPaise), WHERE.kept(), null),
          figure(rupees(row.cpcPaise), WHERE.paid(), 'ww-paid'),
          el('span', 'ww-small', WHERE.rowFigures({
            clicks: whole(row.clicks), cod: pct(row.codShare ?? 0), refused: pct(row.refusedRate ?? 0, 1), sentBack: pct(row.sentBackRate ?? 0, 1),
          })));
      } else {
        figures.append(el('span', 'ww-small', WHERE.noClicks()));
      }

      const track = el('div', 'ww-track');
      const barFill = el('span', 'ww-fill');
      const knob = el('span', 'ww-knob');
      const evenMark = el('span', 'ww-even');
      evenMark.style.left = asPct(share(0, model.top));
      track.append(barFill, evenMark, knob);
      const scale = el('div', 'ww-scale');
      const tick = (text, at, cls) => {
        const label = el('span', cls, text);
        label.style.left = asPct(at);
        return label;
      };
      scale.append(tick(WHERE.off(), 0, null), tick(WHERE.even(), share(0, model.top), 'ww-tick-even'),
        tick(WHERE.scaleTimes({ times: MAX_BID_MULTIPLE / 2 }), share(100 * (MAX_BID_MULTIPLE / 2 - 1), model.top), null),
        tick(WHERE.scaleTimes({ times: MAX_BID_MULTIPLE }), 1, 'ww-tick-top'));

      const show = () => {
        const percent = draft.locationAdjustments[index] ?? 0;
        const shown = Math.min(percent, model.top);
        const at = asPct(share(shown, model.top));
        barFill.style.width = at;
        knob.style.left = at;
        card.dataset.tone = tone(percent);
        readout.textContent = setting(percent);
        times.textContent = percent > model.top ? WHERE.above({ value: setting(percent) }) : effect(percent);
      };
      show();
      slider({
        node: track,
        axis: 'x',
        key: `place:${index}`,
        name: WHERE.sliderName({ name: row.label }),
        top: model.top,
        value: () => draft.locationAdjustments[index] ?? 0,
        onMove: (percent) => {
          setPlace(draft, index, percent);
          show();
          sizeDots(map, bids());
          light(row.id);
          refreshTray();
        },
        onSettle: () => ctx.refresh(),
      });
      track.addEventListener('focus', () => light(row.id));
      card.addEventListener('pointerenter', () => { if (!node.classList.contains('dragging')) light(row.id); });
      card.addEventListener('pointerleave', () => { if (!node.classList.contains('dragging') && lit === row.id) light(null); });
      card.append(top, figures, track, scale);
      rows.append(card);
    });

    const left = el('div', 'ww-left');
    left.append(rows);
    const { best, worst } = model.outlook;
    const said = best && worst
      ? WHERE.outlook({
        best: best.label.toLowerCase(), bestKept: rupees(best.keptPerClickPaise), bestPaid: rupees(best.cpcPaise),
        worst: worst.label.toLowerCase(), worstKept: rupees(worst.keptPerClickPaise), worstPaid: rupees(worst.cpcPaise),
      })
      : WHERE.notYet();
    const note = el('p', 'ww-note', said);
    add(note, whyButton(best && worst ? WHERE.outlook : WHERE.notYet, openGuide));
    left.append(note);

    const mapBox = el('div', 'ww-map');
    mapBox.append(map, el('p', 'ww-small', WHERE.mapNote()));
    const split = el('div', 'ww-split');
    split.append(left, mapBox);
    part.append(split);
    return part;
  }

  function hours() {
    const draft = game.draft;
    const model = hoursModel(draft);
    const part = el('section', 'ww-part');
    part.dataset.slot = 'hours';
    part.append(head(WHERE.hoursTitle(), WHERE.hoursSub(), WHERE.hoursHint(), over));

    const day = el('div', 'ww-day');
    const scale = el('div', 'ww-yscale');
    const mark = (text, at, cls) => {
      const label = el('span', cls, text);
      label.style.bottom = asPct(at);
      return label;
    };
    scale.append(mark(WHERE.top(), 1, 'ww-y-top'),
      mark(WHERE.even(), share(0, model.top), 'ww-y-even'), mark(WHERE.off(), 0, null));

    const plot = el('div', 'ww-plot');
    const evenLine = el('span', 'ww-even-line');
    evenLine.style.bottom = asPct(share(0, model.top));
    plot.append(el('span', 'ww-top-line'), evenLine);

    const hourly = el('div', 'ww-hourly');
    const most = Math.max(...model.hourly, 0);
    const columns = model.hourly.map((clicks) => {
      const column = el('span', 'ww-hour');
      column.style.height = most > 0 ? asPct(Math.max(0.03, clicks / most)) : '0%';
      hourly.append(column);
      return column;
    });

    const axis = el('div', 'ww-axis');
    for (const hour of [0, 6, 9, 12, 17, 21, 24]) {
      const tick = el('span', null, hour === 24 ? '24:00' : `${String(hour).padStart(2, '0')}:00`);
      tick.style.left = asPct(hour / HOURS_A_DAY);
      axis.append(tick);
    }

    const labels = el('div', 'ww-labels');
    for (const block of model.blocks) {
      const column = el('div', 'ww-block');
      column.style.setProperty('--x', asPct(block.start / HOURS_A_DAY));
      column.style.setProperty('--w', asPct(block.hours / HOURS_A_DAY));
      const bar = el('span', 'ww-bar');
      const read = el('span', 'ww-read');
      const value = el('strong', null);
      const times = el('span', null);
      read.append(value, times);
      column.append(bar, read);
      plot.append(column);

      const show = () => {
        const percent = draft.daypartAdjustments[block.index] ?? 0;
        const shown = Math.min(percent, model.top);
        // Off keeps an outline at the even height, so a block switched off
        // still shows where it was.
        bar.style.height = asPct(share(percent <= OFF ? 0 : shown, model.top));
        read.style.bottom = asPct(share(percent <= OFF ? 0 : shown, model.top));
        column.dataset.tone = tone(percent);
        value.textContent = setting(percent);
        times.textContent = percent > model.top ? WHERE.above({ value: setting(percent) }) : effect(percent);
      };
      show();
      const own = columns.slice(block.start, block.end);
      slider({
        node: column,
        axis: 'y',
        key: `hour:${block.index}`,
        name: WHERE.sliderName({ name: block.label }),
        top: model.top,
        value: () => draft.daypartAdjustments[block.index] ?? 0,
        onMove: (percent) => { setHour(draft, block.index, percent); show(); refreshTray(); },
        onSettle: () => ctx.refresh(),
      });
      const mine = (on) => { for (const c of own) c.classList.toggle('mine', on); };
      column.addEventListener('pointerenter', () => mine(true));
      column.addEventListener('pointerleave', () => mine(false));
      column.addEventListener('focus', () => mine(true));
      column.addEventListener('blur', () => mine(false));

      const label = el('div', 'ww-label');
      label.style.setProperty('--x', asPct(block.start / HOURS_A_DAY));
      label.style.setProperty('--w', asPct(block.hours / HOURS_A_DAY));
      label.append(el('strong', null, block.label),
        el('span', null, WHERE.blockClicks({ n: whole(block.clicks) })),
        el('span', block.thin ? 'ww-thin' : null, block.rate === null ? WHERE.noRate() : WHERE.bought({ rate: pct(block.rate, 2) })));
      labels.append(label);
    }

    const chart = el('div', 'ww-chart');
    chart.append(plot, hourly, axis, labels);
    const hourlyName = el('span', 'ww-y-hourly', WHERE.clicksByHour());
    scale.append(hourlyName);
    day.append(scale, chart);
    part.append(day);

    const notes = el('div', 'ww-notes');
    const thin = model.blocks.filter((block) => block.thin && block.clicks > 0).length;
    if (thin > 0) notes.append(el('p', 'ww-small', WHERE.thin({ n: thin, min: MIN_HOUR_OBSERVATIONS })));
    const top = `+${model.top}%`;
    notes.append(el('p', 'ww-small', draft.strategy === 'maxClicks'
      ? WHERE.capClicks({ already: MAX_CLICKS_AGGRESSION, times: MAX_BID_MULTIPLE, top })
      : WHERE.cap({ times: MAX_BID_MULTIPLE, top })));
    if (model.varies) notes.append(el('p', 'ww-small', WHERE.varies()));
    const said = el('p', 'ww-note', WHERE.hoursNote());
    add(said, whyButton(WHERE.hoursNote, openGuide));
    notes.append(said);
    // D11's disclosure, while the strategy it describes is the one running.
    if (model.countsTwice) {
      const twice = el('p', 'ww-note', WHERE.hoursTwice());
      add(twice, whyButton(WHERE.hoursTwice, openGuide));
      notes.append(twice);
    }
    part.append(notes);
    return part;
  }

  /** Redrawn from the draft: on the way in, and after an undo from the tray. */
  function refresh() {
    const key = document.activeElement?.dataset?.key;
    node.replaceChildren(places(), hours());
    if (key) node.querySelector(`[data-key="${key}"]`)?.focus();
  }

  refresh();
  return { node, refresh };
}
