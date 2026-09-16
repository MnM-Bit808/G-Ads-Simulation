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
import { adModel } from './read.js';

/** Grades run from 1 to 10 (the grader's scale, agents/grader.js). */
const GRADE_SCALE = 10;
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
  box.append(top, worthChart(model, openGuide), el('p', 'yad-small', AD.drawn()));
  return box;
}

/** The grade the auction runs on, week by week: it steps, it does not climb. */
function worthChart(model, openGuide) {
  const wrap = el('div', 'yad-worth');
  const head = el('div', 'yad-worth-head');
  head.append(el('h3', null, AD.worthTitle()), el('span', 'yad-small', AD.worthSub()));
  wrap.append(head);

  const page = model.page.parts.find((p) => p.target === 'landingPage');
  const live = page?.week ?? model.page.worth.findIndex((w, i) => i > 0 && w.value !== model.page.worth[0].value) + 1;
  const top = 10;
  const bars = el('div', 'yad-worth-bars');
  for (const week of model.page.worth) {
    const column = el('div', 'yad-worth-col');
    const bar = el('div', week.round === model.week ? 'yad-worth-bar now' : 'yad-worth-bar');
    bar.style.height = `${Math.round((week.value / top) * 96)}px`;
    column.append(bar, el('span', 'yad-worth-week', String(week.round)));
    if (live > 1 && week.round === live) column.classList.add('live');
    bars.append(column);
  }
  wrap.append(bars);

  if (page?.points > 0 || page?.week !== null) {
    const graded = model.page.worth[0].value;
    const note = el('p', 'yad-note', AD.stepNote({
      graded, points: page.points > 0 ? page.points : model.page.worth.at(-1).value - graded, week: live,
    }));
    add(note, whyButton(AD.stepNote, openGuide));
    wrap.append(note);
  }
  return wrap;
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
