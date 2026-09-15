/**
 * The Studio's Your week (design/your-week/, chosen by the owner 2026-09-15):
 * the week's six figures, every week's net profit with a dashed tick where it
 * stood before this week ran, and where the impressions went. What it shows
 * is worked out in ./read.js; the words are in ui/words/week.js.
 *
 * THE REVISION PLAYS ONCE A WEEK. The first time the section is opened after
 * a week has run, every week that moved shows where it stood, holds, and
 * fades to where it is now (the makeover design's motion row 2: opacity only,
 * 250ms, never a counting ticker); "replay the revision" plays it again. The
 * shell decides when (ui/shell/shell.js); this module only knows how.
 *
 * A LOSS HANGS BELOW THE LINE, IN AMBER (the owner's choice after seeing it
 * beside bone): money lost is amber everywhere in the Studio. The changes
 * under the weeks stay grey, since a change is a correction, not money leaving.
 */

import { el, add, rupees, whole, ratio, pct } from '../dom.js';
import { TOTAL_ROUNDS } from '../../engine/constants.js';
import { whyButton } from '../guide/drawer.js';
import { creativeOutlook } from '../dashboard.js';
import { WEEK } from '../words/week.js';
import {
  weekFigures, weekBars, revision, chartRange, barPlace, impressions,
} from './read.js';

/** How long each week that moved shows where it stood, before it gives way. */
export const HOLD_MS = 900;
/** Grades run from 1 to 10 (the grader's scale, agents/grader.js). */
const GRADE_SCALE = 10;

const money = (paise) => (paise < 0 ? `−${rupees(-paise)}` : rupees(paise));
const signed = (paise) => (paise < 0 ? `−${rupees(-paise)}` : `+${rupees(paise)}`);
const percent = (fraction) => `${100 * fraction}%`;

function stat(label, value, sub, extra = null) {
  const box = el('div', 'yw-stat');
  add(box, el('span', 'yw-label', label), value, extra, sub ? el('span', 'yw-sub', sub) : null);
  return box;
}
const big = (text) => el('strong', 'yw-big', text);

function sixFigures(row) {
  const f = weekFigures(row);
  const box = el('div', 'yw-figures');
  box.dataset.slot = 'headline';
  const net = big(money(f.netProfitPaise));
  net.classList.toggle('loss', f.netProfitPaise < 0);
  // The week's conversions, landed against still to arrive (outlined).
  const landed = el('span', 'yw-landed');
  const fill = el('span');
  fill.style.width = percent(f.landedShare);
  landed.append(fill, el('span'));
  box.append(
    stat(WEEK.spend(), big(rupees(f.spendPaise)), WEEK.clicks({ clicks: whole(f.clicks), n: f.clicks })),
    stat(WEEK.cpc(), big(rupees(f.cpcPaise)), WEEK.impressions({ impressions: whole(f.impressions), n: f.impressions })),
    stat(WEEK.conversions(), big(f.conversions.toFixed(1)),
      f.pending > 0 ? WEEK.toArrive({ pending: f.pending.toFixed(1) }) : null, landed),
    stat(WEEK.netProfit(), net, f.conversions > 0 ? WEEK.returnsNotIn() : null),
    stat(WEEK.netRoas(), big(ratio(f.netRoas)), WEEK.gross({ roas: ratio(f.grossRoas) })),
    stat(WEEK.cpa(), big(f.cpaPaise == null ? '—' : rupees(f.cpaPaise)), WEEK.perConversion()),
  );
  return box;
}

/** An old save's own words, still to land or just landed (I11, as today's card says it). */
function copyNote(game, openGuide) {
  const creative = game.state.advertisers.find((a) => a.id === game.playerId)?.creative;
  const copy = creativeOutlook(creative, game.state.history.at(-1)?.round ?? null);
  if (!copy) return null;
  const said = copy.state === 'pending' ? WEEK.copyPending : WEEK.copyLanded;
  const note = el('p', 'yw-note', said({ week: copy.liveAtRound, score: copy.ungradedScore, scale: GRADE_SCALE }));
  add(note, whyButton(said, openGuide));
  return note;
}

/** Stand a bar on the zero line, or hang it from it. */
function setBar(node, paise, range) {
  const { zero, size, below } = barPlace(paise, range);
  node.style.height = percent(size);
  if (below) {
    node.classList.add('below');
    node.style.top = percent(1 - zero);
  } else {
    node.style.bottom = percent(zero);
  }
}

/** Put a figure or a tick at a bar's far end: above one standing, below one hanging. */
function atEnd(node, paise, range, gap) {
  const { zero, size, below } = barPlace(paise, range);
  if (below) node.style.top = `calc(${percent(1 - zero + size)} + ${gap}px)`;
  else node.style.bottom = `calc(${percent(zero + size)} + ${gap}px)`;
}
const figureGap = (paise) => (paise < 0 ? 2 : 4);

/**
 * Drawn for the eye only. Where a week stood stays on the page at opacity 0
 * once it has given way, and a screen reader would read it as a second
 * current figure; the change under the week and the sentence say it in words.
 */
function forTheEye(node) {
  node.setAttribute('aria-hidden', 'true');
  return node;
}

function zeroLine(range) {
  if (range.lowPaise === 0) return null;
  const line = el('span', 'yw-zero');
  line.style.bottom = percent(barPlace(0, range).zero);
  return line;
}

function column(b, range) {
  const col = el('div', 'yw-col');
  if (b.latest) col.classList.add('latest');
  if (b.moved) col.classList.add('moved');
  const plot = el('div', 'yw-bars');
  add(plot, zeroLine(range));
  // The figure clears the tick when the week stood further out than it does now.
  let figureAt = b.netPaise;
  let tick = null;
  if (b.moved) {
    const was = forTheEye(el('span', 'yw-bar yw-was'));
    setBar(was, b.beforePaise, range);
    const wasFigure = forTheEye(el('span', 'yw-value yw-was', money(b.beforePaise)));
    atEnd(wasFigure, b.beforePaise, range, figureGap(b.beforePaise));
    plot.append(was, wasFigure);
    tick = forTheEye(el('span', 'yw-tick'));
    atEnd(tick, b.beforePaise, range, -1);
    const sameSide = (b.beforePaise < 0) === (b.netPaise < 0);
    if (sameSide && Math.abs(b.beforePaise) > Math.abs(b.netPaise)) figureAt = b.beforePaise;
  }
  const now = el('span', 'yw-bar yw-now');
  setBar(now, b.netPaise, range);
  const figure = el('span', 'yw-value yw-now', money(b.netPaise));
  atEnd(figure, figureAt, range, figureGap(b.netPaise));
  if (b.netPaise < 0) {
    now.classList.add('loss');
    figure.classList.add('loss');
  }
  // The tick is drawn over the bar, so a week that rose shows it across the bar.
  add(plot, now, tick, figure);
  const foot = el('div', 'yw-foot');
  foot.append(el('span', 'yw-week', String(b.round)));
  if (b.latest) foot.append(el('span', 'yw-change', WEEK.thisWeek()));
  else if (b.moved) foot.append(el('span', 'yw-change', signed(b.changePaise)));
  col.append(plot, foot);
  return col;
}

function futureColumn(round, range) {
  const col = el('div', 'yw-col');
  col.classList.add('future');
  const plot = el('div', 'yw-bars');
  const stub = el('span', 'yw-stub');
  stub.style.bottom = percent(barPlace(0, range).zero);
  add(plot, zeroLine(range), stub);
  const foot = el('div', 'yw-foot');
  foot.append(el('span', 'yw-week', String(round)));
  col.append(plot, foot);
  return col;
}

function reading(said, openGuide) {
  let entry = WEEK.whileRan;
  let text;
  if (said.first) {
    entry = WEEK.first;
    text = entry();
  } else if (!said.rose && !said.fell) {
    entry = WEEK.nothingMoved;
    text = entry({ week: said.week });
  } else {
    text = entry({
      week: said.week,
      rose: said.rose && WEEK.rose({ ...said.rose, amount: rupees(said.rose.paise) }),
      fell: said.fell && WEEK.fell({ ...said.fell, amount: rupees(said.fell.paise) }),
    });
  }
  const p = el('p', 'yw-reading', text);
  add(p, whyButton(entry, openGuide));
  return p;
}

function weeksCard(game, openGuide) {
  const bars = weekBars(game.state.history, game.historyBefore, game.playerId);
  const range = chartRange(bars);
  const said = revision(bars);
  const moved = bars.some((b) => b.moved);

  const card = el('div', 'yw-card');
  card.dataset.slot = 'revised';
  const head = el('div', 'yw-head');
  const titles = el('div', 'yw-titles');
  titles.append(el('h3', null, WEEK.weeksTitle()),
    el('p', 'yw-sub', moved ? WEEK.weeksSub({ week: said.week }) : WEEK.weeksSubFirst()));
  head.append(titles);
  let replay = null;
  if (moved) {
    replay = el('button', 'yw-replay', WEEK.replay());
    replay.type = 'button';
    head.append(replay);
  }

  const chart = el('div', 'yw-chart');
  if (range.lowPaise > 0) chart.classList.add('has-loss');
  for (const b of bars) chart.append(column(b, range));
  for (let round = said.week + 1; round <= TOTAL_ROUNDS; round++) chart.append(futureColumn(round, range));
  // On a phone twelve weeks do not fit with their figures, so the chart
  // scrolls sideways in its own box, opened on the newest week.
  const scroll = el('div', 'yw-scroll');
  scroll.append(chart);
  requestAnimationFrame(() => { scroll.scrollLeft = scroll.scrollWidth; });

  card.append(head, scroll, reading(said, openGuide));
  return { card, chart, replay };
}

function shareCard(row, openGuide) {
  const read = impressions(row);
  const card = el('div', 'yw-card');
  card.dataset.slot = 'share';
  const title = el('h3', null, WEEK.shareTitle());
  add(title, whyButton(WEEK.shareTitle, openGuide));

  const strip = el('div', 'yw-strip');
  const keys = el('div', 'yw-keys');
  const parts = [
    ['shown', read.shown, WEEK.shown()],
    ['budget', read.lostToBudget, WEEK.lostToBudget()],
    ['rank', read.lostToRank, WEEK.lostToRank()],
  ];
  for (const [kind, value, word] of parts) {
    if (value > 0) {
      const part = el('span', kind);
      part.style.width = percent(value);
      strip.append(part);
    }
    const key = el('span', 'yw-key');
    key.append(el('i', kind), el('b', null, pct(value)), el('span', null, word));
    keys.append(key);
  }

  const positions = el('div', 'yw-positions');
  read.positions.forEach((share, i) => {
    const pos = el('div', 'yw-pos');
    const plot = el('span', 'yw-posplot');
    const bar = el('span', i === 0 ? 'yw-posbar top' : 'yw-posbar');
    bar.style.height = percent(share);
    plot.append(bar);
    const figure = el('span', 'yw-posfig');
    figure.append(el('b', null, pct(share)), el('span', null, WEEK.position({ n: i + 1 })));
    pos.append(plot, figure);
    positions.append(pos);
  });

  card.append(title, strip, keys, el('p', 'yw-sub', WEEK.onThePage()), positions);
  return card;
}

/**
 * @param {object} args
 * @param {object} args.game - the played game (ui/app.js, openGame), with
 *   `historyBefore`: every week as it stood before the latest week ran
 * @param {Function} [args.openGuide] - `guide.open`
 * @returns {{node: HTMLElement, play: () => void}} `play` shows each week that
 *   moved where it stood, then lets it give way; it does nothing when none moved
 */
export function renderWeekSection({ game, openGuide }) {
  const node = el('div', 'yw');
  const latest = game.state.history.at(-1);
  if (!latest) return { node, play: () => {} };
  const row = latest.byAdvertiser[game.playerId];

  const weeks = weeksCard(game, openGuide);
  const split = el('div', 'yw-row');
  split.append(weeks.card, shareCard(row, openGuide));
  add(node, sixFigures(row), copyNote(game, openGuide), split);

  let timer = null;
  function play() {
    if (!weeks.replay) return;
    clearTimeout(timer);
    // Straight back to where the weeks stood, with no fade, then the fade on.
    weeks.chart.classList.add('instant', 'was');
    weeks.chart.getBoundingClientRect();
    weeks.chart.classList.remove('instant');
    timer = setTimeout(() => weeks.chart.classList.remove('was'), HOLD_MS);
  }
  weeks.replay?.addEventListener('click', play);
  return { node, play };
}
