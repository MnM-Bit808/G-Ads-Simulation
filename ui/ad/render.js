/**
 * The weekly Your ad (the owner's call, 2026-09-15): read-only, the ad as it
 * runs. What it shows is worked out in ./read.js; the words are in
 * ui/words/ad.js. Drawn afresh each time the section is opened, since a week
 * may have moved a grade (capital going live) since the last time.
 */

import { el, add, rupees, pct } from '../dom.js';
import { getSelfView } from '../../engine/insights.js';
import { CREATIVE_ALLOCATION_PAISE } from '../../engine/constants.js';
import { whyButton } from '../guide/drawer.js';
import { serp } from '../kit/serp.js';
import { AD } from '../words/ad.js';
import { adModel, worthShape, GRADE_TOP as GRADE_SCALE } from './read.js';

const PART_WORD = { expectedCtr: AD.expectedCtr, adRelevance: AD.adRelevance, landingPage: AD.landingPage };
const width = (value) => `${(100 * value) / GRADE_SCALE}%`;

function whoWrote(writer, openGuide) {
  const box = el('div', 'yad-card');
  // Where the guide's "Who writes the ad" shows the player (sections.js, draws).
  box.dataset.slot = 'writer';
  const budget = rupees(CREATIVE_ALLOCATION_PAISE);
  box.append(el('h3', null, AD.whoWrote()),
    el('p', 'yad-writer', writer.hired ? writer.label : AD.you()),
    el('p', 'yad-small', writer.hired ? AD.fee({ amount: rupees(writer.pricePaise), budget }) : AD.free({ budget })));
  const said = writer.hired ? AD.hired : AD.own;
  const note = el('p', 'yad-note', said());
  add(note, whyButton(said, openGuide));
  box.append(note);
  return box;
}

function howItGrades(model, openGuide) {
  const box = el('div', 'yad-card');
  const rows = el('div', 'yad-grades');
  const laters = [];
  for (const grade of model.grades) {
    const part = PART_WORD[grade.key]();
    const track = el('span', 'yad-track');
    // The grade still to come sits behind this week's, outlined.
    if (grade.later) {
      const ghost = el('span', 'yad-ghost');
      ghost.style.width = width(grade.later.value);
      track.append(ghost);
      const later = grade.later.why === 'page' ? AD.laterPage : AD.laterCopy;
      laters.push(el('p', 'yad-small', later({ part, value: grade.later.value, week: grade.later.week })));
    }
    const fill = el('span', 'yad-fill');
    fill.style.width = width(grade.value);
    track.append(fill);
    rows.append(el('span', null, part), track, el('strong', 'yad-value', AD.outOf({ value: grade.value, scale: GRADE_SCALE })));
  }
  const qs = el('p', 'yad-small', AD.qsNote());
  add(qs, whyButton(AD.qsNote, openGuide));
  box.append(el('h3', null, AD.gradesTitle({ week: model.week })), rows, ...laters, qs);
  return box;
}

/** A stroked figure on a 24-unit grid, drawn rather than photographed. */
function svg(viewBox, paths, size) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  node.setAttribute('viewBox', viewBox);
  node.setAttribute('width', String(size.w));
  node.setAttribute('height', String(size.h));
  node.setAttribute('aria-hidden', 'true');
  for (const [d, fill] of paths) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', fill);
    node.append(path);
  }
  return node;
}

/** The garment the page sells, at whatever size the column gives it. */
function garment(size) {
  return svg('0 0 124 148', [
    ['M0 0h124v148H0z', '#232026'],
    ['M42 22h40l7 19-9 9 5 76H39l5-76-9-9z', '#3A363E'],
    ['M49 47h26l4 65H45z', '#4A454F'],
  ], size);
}

/** Five stars, the last one half: what reviews look like, not a strip saying so. */
function stars() {
  const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  node.setAttribute('viewBox', '0 0 78 14');
  node.setAttribute('width', '78');
  node.setAttribute('height', '14');
  node.setAttribute('aria-hidden', 'true');
  const star = 'M7 1l1.9 3.8 4.1.6-3 2.9.7 4.1L7 10.5 3.3 12.4l.7-4.1-3-2.9 4.1-.6z';
  for (let i = 0; i < 5; i++) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', star);
    path.setAttribute('transform', `translate(${i * 16} 0)`);
    path.setAttribute('fill', '#F2A53A');
    if (i === 4) path.setAttribute('opacity', '0.45');
    node.append(path);
  }
  return node;
}

/** The size chart the size guide buys: a chart, drawn as one. */
function sizeChart() {
  const chart = el('div', 'yad-chart');
  chart.append(el('div', 'yad-chart-head', AD.sizeChart()));
  const bars = el('div', 'yad-chart-bars');
  // Five sizes rising: the shape of a size chart, not a measurement the game models.
  for (const [i, height] of [13, 19, 25, 31, 37].entries()) {
    const bar = el('div', i === 2 ? 'yad-chart-bar on' : 'yad-chart-bar');
    bar.style.height = `${height}px`;
    bars.append(bar);
  }
  chart.append(bars);
  return chart;
}

/**
 * What one purchase BUYS, in the unit it moves — the settled value, not today's.
 * Played at week 1, today's value reads "+0 on the landing page grade · live
 * from week 4", which is true and says the opposite of what it means.
 */
function movedBy(part) {
  if (part.moves === 'grade') return AD.toGrade({ points: part.points });
  const percent = pct(part.moves === 'returns' ? 1 - 1 / part.lift : part.lift - 1);
  return part.moves === 'returns' ? AD.fewerBack({ percent }) : AD.moreSales({ percent });
}

/** And what it would move, for a target nothing was spent on. */
const wouldMove = (part) => (part.moves === 'returns' ? AD.wouldReturns() : AD.wouldSales());

function landingPage(model, openGuide) {
  const box = el('div', 'yad-card');
  box.classList.add('yad-page');

  const bought = new Map(model.page.parts.map((p) => [p.target, p]));
  const has = (target) => bought.get(target)?.bought && bought.get(target)?.week === null;

  // --- the page itself, drawn from what is live -----------------------------
  const sheet = el('div', 'yad-sheet');
  sheet.append(el('div', 'yad-bar', model.domain));

  const hero = el('div', 'yad-hero');
  hero.append(garment({ w: 124, h: 148 }));
  const detail = el('div', 'yad-detail');
  detail.append(el('div', 'yad-product', AD.product()));
  if (has('landingPage')) {
    const reviews = el('div', 'yad-reviews');
    reviews.append(stars(), el('span', 'yad-small', AD.reviewCount()));
    detail.append(reviews);
  }
  const sizes = el('div', 'yad-sizes');
  for (const [i, name] of ['S', 'M', 'L'].entries()) {
    sizes.append(el('span', i === 1 ? 'yad-size on' : 'yad-size', name));
  }
  detail.append(sizes);
  hero.append(detail);
  sheet.append(hero);
  if (has('sizeGuide')) sheet.append(sizeChart());

  // --- what each one buys ---------------------------------------------------
  const side = el('div', 'yad-side');
  side.append(el('h3', null, AD.pageTitle()), el('p', 'yad-quote', AD.quoted({ text: model.page.description })),
    el('p', 'yad-small', AD.pageRead()));

  const list = el('div', 'yad-buys');
  list.append(el('div', 'yad-buys-head', AD.boughtTitle()));
  for (const part of model.page.parts) {
    const row = el('div', part.bought ? 'yad-buy' : 'yad-buy off');
    const top = el('div', 'yad-buy-top');
    top.append(el('span', null, part.label ?? AD.partName({ target: part.target })),
      el('span', 'yad-value', part.bought ? rupees(part.paise) : AD.notBought()));
    const said = el('span', part.moves === 'grade' && part.points > 0 ? 'yad-buy-moves grade' : 'yad-buy-moves');
    said.textContent = part.bought ? movedBy(part) : wouldMove(part);
    row.append(top, said);
    if (part.week !== null) row.append(el('span', 'yad-small', AD.liveWeek({ week: part.week })));
    list.append(row);
  }
  const only = el('p', 'yad-small', AD.onlyPage());
  add(only, whyButton(AD.onlyPage, openGuide));
  list.append(only);
  side.append(list);

  const top = el('div', 'yad-page-top');
  top.append(sheet, side);
  // An account with no ad has no grade, so no worth to chart (read.js, pageWorth).
  add(box, top, model.page.worth.length > 0 ? worthChart(model, openGuide) : null, el('p', 'yad-small', AD.drawn()));
  return box;
}

// The box the chart is drawn in. The shape it is drawn FROM is fractions
// (ui/ad/read.js, worthShape), so these are the only pixels in it.
// `top` leaves room above the scale for a riser's gain, which is written there.
const PLOT = Object.freeze({ w: 720, h: 206, left: 36, right: 708, top: 38, floor: 178, weeks: 190 });
const acrossPlot = (fraction) => PLOT.left + fraction * (PLOT.right - PLOT.left);
const upFromFloor = (fraction) => PLOT.floor - fraction * (PLOT.floor - PLOT.top);

/**
 * The grade the auction runs on, week by week, drawn as a step (the owner's
 * choice, 2026-09-16, design/page-worth/).
 *
 * IT WAS TWELVE BARS AND IT READ AS ONE FLAT ROW. A grade of 8 stepping to 10
 * is nineteen pixels inside a ninety-six pixel bar, twelve times over, and the
 * one thing the chart exists to teach — that the money goes now and the grade
 * moves weeks later — was invisible at a glance. The obvious fix, starting the
 * scale at 7, was refused: it draws a 25% gain as a fourfold one.
 *
 * A LINE IS LEGIBLE WITHOUT EXAGGERATING, because the eye reads a break in it
 * rather than the area of a bar. It is a true step and never a slope: the grade
 * sits still and then moves once, and a sloped line would claim a climb through
 * weeks the engine holds flat.
 */
function worthChart(model, openGuide) {
  const wrap = el('div', 'yad-worth');
  const head = el('div', 'yad-worth-head');
  head.append(el('h3', null, AD.worthTitle()), el('span', 'yad-small', AD.worthSub()));
  wrap.append(head);

  const shape = worthShape(model.page.worth, GRADE_SCALE);
  // LINES IN THE SVG, MARKS AND WORDS OVER IT. The SVG scales with the card, and
  // anything drawn inside it scales too: at 592px wide its ten-pixel labels
  // measured 8.2px, and on a phone about four. So the plot holds only lines,
  // whose strokes do not thin as it shrinks, and every dot and label is an
  // element laid over it by percentage, which stays its own size at any width.
  const frame = el('div', 'yad-worth-frame');
  frame.setAttribute('role', 'img');
  frame.setAttribute('aria-label', AD.worthTitle());
  // Stretched to the frame, not letterboxed in it: on a phone the frame is kept
  // taller than its shape would allow, or a two-point step is thirteen pixels.
  // Every line is level or upright, so stretching one way bends nothing.
  const plot = svgEl('svg', {
    viewBox: `0 0 ${PLOT.w} ${PLOT.h}`, class: 'yad-worth-plot', 'aria-hidden': 'true', preserveAspectRatio: 'none',
  });
  frame.append(plot);

  // The scale it is read against, so the step is never bigger than it is.
  for (const grade of [shape.baseline, shape.top / 2, shape.top]) {
    const y = upFromFloor(grade / shape.top);
    plot.append(svgEl('line', { class: 'yad-worth-rule', x1: PLOT.left, x2: PLOT.right, y1: y, y2: y }));
    frame.append(pin(PLOT.left - 8, y, String(grade), 'yad-worth-axis'));
  }

  // Where it stood before each step, carried on so the gain is read against it.
  for (const riser of shape.risers) {
    const y = upFromFloor(riser.from);
    plot.append(svgEl('line', { class: 'yad-worth-before', x1: acrossPlot(riser.at), x2: PLOT.right, y1: y, y2: y }));
    plot.append(svgEl('line', {
      class: 'yad-worth-live', x1: acrossPlot(riser.at), x2: acrossPlot(riser.at),
      y1: PLOT.top - 6, y2: PLOT.floor + 8,
    }));
  }

  // The flats alone: each riser is drawn after, in its own colour.
  const line = shape.flats.map((f) => `M${acrossPlot(f.from)} ${upFromFloor(f.y)}H${acrossPlot(f.to)}`).join('');
  const under = `M${acrossPlot(shape.flats[0].from)} ${upFromFloor(shape.flats[0].y)}`
    + shape.flats.map((f) => `V${upFromFloor(f.y)}H${acrossPlot(f.to)}`).join('')
    + `V${PLOT.floor}H${acrossPlot(0)}Z`;
  plot.append(svgEl('path', { class: 'yad-worth-under', d: under }));
  plot.append(svgEl('path', { class: 'yad-worth-line', d: line }));

  // The risers are the player's own doing, so they carry the player's colour.
  for (const riser of shape.risers) {
    const x = acrossPlot(riser.at);
    plot.append(svgEl('path', {
      class: 'yad-worth-riser', d: `M${x} ${upFromFloor(riser.from)}V${upFromFloor(riser.to)}`,
    }));
    // Above the riser, the one place nothing else is drawn. Beside it, on the
    // right it covered the mark of the week the step lands in (on a phone), and
    // on the left the ring of the week being played whenever that is the week
    // before — which is the very week this chart is there for.
    frame.append(pin(x, upFromFloor(riser.to), AD.gained({ points: riser.points }), 'yad-worth-gain'));
  }

  const stepWeeks = new Set(shape.risers.map((r) => r.round));
  for (const week of shape.weeks) {
    const x = acrossPlot(week.mid);
    const y = upFromFloor(week.y);
    const mark = pin(x, y, '', 'yad-worth-dot');
    if (stepWeeks.has(week.round)) mark.classList.add('live');
    if (week.round === model.week) mark.classList.add('now');
    frame.append(mark);
    const label = pin(x, PLOT.weeks + 4, String(week.round), 'yad-worth-week');
    if (week.round === model.week || stepWeeks.has(week.round)) label.classList.add('on');
    frame.append(label);
  }
  wrap.append(frame);

  if (shape.risers.length > 0) {
    const key = el('div', 'yad-worth-key');
    key.append(dot('live', AD.liveDot()), dot('now', AD.nowDot()));
    wrap.append(key);
    const note = el('p', 'yad-note', AD.stepNote({
      graded: shape.weeks[0].value,
      steps: shape.risers.map((r) => ({ points: r.points, week: r.round })),
    }));
    add(note, whyButton(AD.stepNote, openGuide));
    wrap.append(note);
  }
  return wrap;
}

/** One entry of the chart's key: a mark of the same kind, then what it means. */
function dot(kind, label) {
  const item = el('span', 'yad-worth-keyitem');
  const mark = el('span', 'yad-worth-keydot');
  mark.classList.add(kind);
  item.append(mark, el('span', null, label));
  return item;
}

/** One SVG element with its attributes, since `el` builds HTML ones. */
function svgEl(tag, attrs) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  return node;
}

/**
 * A mark or label laid over the plot at a point in its own coordinates, as a
 * percentage of the frame, so it lands where the line is at any width and keeps
 * its own size. Where it hangs from that point is the stylesheet's business.
 */
function pin(x, y, body, cls) {
  const node = el('span', cls, body);
  node.style.left = `${(100 * x) / PLOT.w}%`;
  node.style.top = `${(100 * y) / PLOT.h}%`;
  return node;
}

/**
 * @param {object} args
 * @param {object} args.game - the played game (ui/app.js, openGame)
 * @param {Function} args.openGuide - `guide.open`
 * @returns {{node: HTMLElement}}
 */
export function renderAdSection({ game, openGuide }) {
  const self = getSelfView(game.state, game.playerId);
  // The creative block is not in the self view, so it is read from state, as
  // the dashboard reads it (I16).
  const creative = game.state.advertisers.find((a) => a.id === game.playerId)?.creative;
  const model = adModel({ draft: game.draft, creative, name: self.name, domain: self.domain });

  const node = el('div', 'yad');
  const preview = el('div', 'yad-preview');
  preview.append(el('h3', null, AD.asSearchersSee()), serp({
    domain: model.domain, name: model.name, headlines: model.headlines,
    descriptions: model.descriptions, sponsored: AD.sponsored(),
  }));
  const row = el('div', 'yad-row');
  row.append(whoWrote(model.writer, openGuide), howItGrades(model, openGuide));
  node.append(el('p', 'yad-intro', AD.intro({ week: 1 })), preview, row, landingPage(model, openGuide));
  return { node };
}
