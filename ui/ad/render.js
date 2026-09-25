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
import { DESCRIBED_AT, GRADE_CAP } from '../../content/landingPage.js';

const PART_WORD = { expectedCtr: AD.expectedCtr, adRelevance: AD.adRelevance, landingPage: AD.landingPage };
const width = (value) => `${(100 * value) / GRADE_SCALE}%`;

/**
 * The size table the `measured` rung draws: centimetres of a garment, which is
 * the page's own furniture and not a figure the engine produces. Nothing reads
 * it back, and the note under the page says the whole sheet is drawn.
 */
const SIZE_ROWS = Object.freeze([
  Object.freeze(['S', 86, 66, 91]),
  Object.freeze(['M', 91, 71, 97]),
  Object.freeze(['L', 97, 76, 102]),
  Object.freeze(['XL', 102, 81, 107]),
]);

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
/**
 * THE PLATE IS THE DARK GROUND THE GARMENT SITS ON, and it is optional because
 * `product shots` lights the page. Found playing it: the svg painted its own
 * dark rectangle over the whole viewBox, so a lit box multiplied a dark ground
 * against light and stayed dark — the rung that is meant to put the garment on
 * white changed almost nothing.
 */
/**
 * THE GARMENT IS THE ONE THE PAGE SELLS, since 2026-09-25. It was a top —
 * shoulders, sleeves, a body — on a page headed "High-waisted training
 * leggings", and the same top whatever cell the player was in. On the one
 * screen whose whole job is to BE the thing a click lands on, the hero showed
 * a different product, and the same different product to everybody.
 *
 * Three shapes for six cells (`content/product.js` says which cell wears
 * which). A silhouette that cannot be told from its neighbour buys nothing, so
 * six drawings would be four of them pretending to differ. Each is built from
 * the marks that survive at the 40px a thumbnail gets: a waistband, a taper,
 * an inseam.
 */
const SHAPES = Object.freeze({
  // A high waistband, a taper to the ankle, the inseam between the legs.
  leggings: [
    ['M42 18h40l2 16-4 100H67L62 62 57 134H44L40 34z', '#3A363E'],
    ['M42 18h40l1 9H41z', '#4A454F'],
  ],
  // The same legs, cut loose and cuffed: the cheap lifestyle cell's lounge pair.
  joggers: [
    ['M40 18h44l4 18-6 92h-16l-4-58-4 58H42l-6-92z', '#3A363E'],
    ['M40 18h44l1 9H39z', '#4A454F'],
    ['M50 120h14l1 8H49zM66 120h14l1 8H65z', '#4A454F'],
  ],
  // Two pieces, because a co-ord and a lounge set are sold as two.
  set: [
    ['M46 16h32l6 14-7 7 3 30H44l3-30-7-7z', '#3A363E'],
    ['M46 74h32l2 12-3 48H65l-3-32-3 32H49l-3-48z', '#3A363E'],
    ['M46 74h32l1 8H45z', '#4A454F'],
  ],
});

/**
 * THE SAME GARMENT, WORN (2026-09-25). The rung above `product shots` is called
 * "on real bodies" and drew three empty grey squares — nothing in it depicted
 * a body, so the dearest-but-one purchase on the strongest ladder in the game
 * changed almost nothing a player could see.
 *
 * A head and a torso above the garment, and the garment moved down to hang off
 * them. Written out rather than transformed, because the shapes are read at
 * 40px as often as at 300 and a scaled-down copy of the flat cut blurs.
 */
const WORN = Object.freeze({
  leggings: [
    ['M62 6a8 8 0 1 1 0 16 8 8 0 0 1 0-16z', '#4A454F'],
    ['M52 24h20l5 11-3 15H50l-3-15z', '#4A454F'],
    ['M46 50h32l2 12-4 78H65l-3-46-3 46H48l-4-78z', '#3A363E'],
    ['M46 50h32l1 8H45z', '#4A454F'],
  ],
  joggers: [
    ['M62 6a8 8 0 1 1 0 16 8 8 0 0 1 0-16z', '#4A454F'],
    ['M52 24h20l5 11-3 15H50l-3-15z', '#4A454F'],
    ['M44 50h36l3 14-5 72H63l-2-44-2 44H49l-5-72z', '#3A363E'],
    ['M44 50h36l1 8H43z', '#4A454F'],
    ['M51 128h12l1 7H50zM65 128h12l1 7H64z', '#4A454F'],
  ],
  set: [
    ['M62 6a8 8 0 1 1 0 16 8 8 0 0 1 0-16z', '#4A454F'],
    ['M50 24h24l5 11-5 6 2 27H48l2-27-5-6z', '#3A363E'],
    ['M48 72h28l2 11-4 57H64l-2-38-2 38H50l-4-57z', '#3A363E'],
    ['M48 72h28l1 7H47z', '#4A454F'],
  ],
});

/**
 * @param {{w: number, h: number}} size
 * @param {{plate?: boolean, shape?: string, worn?: boolean}} [options]
 */
function garment(size, { plate = true, shape = 'leggings', worn = false } = {}) {
  const cut = worn ? (WORN[shape] ?? WORN.leggings) : (SHAPES[shape] ?? SHAPES.leggings);
  return svg('0 0 124 148', [
    ...(plate ? [['M0 0h124v148H0z', '#232026']] : []),
    ...cut,
  ], size);
}

/**
 * THREE BUILDS, because the rung says three body types and the page should be
 * able to show what was paid for. The same worn cut at three widths: the torso
 * and hips carry the difference, which is where a garment's fit is decided.
 */
const BUILDS = Object.freeze([0.86, 1, 1.16]);

/** One body in a thumbnail, at a build. */
function body(shape, build) {
  const node = svg('0 0 124 148', WORN[shape] ?? WORN.leggings, { w: 22, h: 26 });
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  // Widened about the centre line, so a build changes the shape and not the
  // place it stands.
  group.setAttribute('transform', `translate(${62 * (1 - build)} 0) scale(${build} 1)`);
  while (node.firstChild) group.append(node.firstChild);
  node.append(group);
  return node;
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

/**
 * THE GARMENT, at whichever rung of photography is live.
 *
 * `none` is the flat grey silhouette the page has always had; `product shots`
 * lights it on white; `on real bodies` puts a second figure behind it; `video`
 * lays a play mark over it. Drawn rather than photographed, which the note
 * under the page says out loud.
 */
function garmentAt(drawn, shape) {
  const box = el('div', 'yad-shot');
  if (drawn.shots) box.classList.add('lit');
  if (drawn.bodies) box.classList.add('bodies');
  // Worn from the `on real bodies` rung up, which is what that rung buys.
  box.append(garment({ w: 124, h: 148 }, { plate: !drawn.shots, shape, worn: drawn.bodies }));
  if (drawn.video) {
    const play = el('span', 'yad-play');
    play.append(svg('0 0 24 24', [['M9 7l9 5-9 5z', '#141216']], { w: 13, h: 13 }));
    box.append(play);
  }
  return box;
}

/** The thumbnails the two dearer photography rungs add under the garment. */
function thumbs(drawn, shape) {
  if (!drawn.bodies && !drawn.video) return null;
  const row = el('div', 'yad-thumbs');
  // THE THUMBNAILS ARE THE BODIES, since 2026-09-25. They were three empty
  // grey squares under a rung called "on real bodies" -- the page naming a
  // purchase it did not draw. One per build, and the video rung adds a fourth
  // cell for the film rather than a fourth body.
  for (const build of BUILDS) {
    const cell = el('span', 'yad-thumb');
    cell.append(body(shape, build));
    row.append(cell);
  }
  if (drawn.video) row.append(el('span', 'yad-thumb film'));
  row.append(el('span', 'yad-small', drawn.video ? AD.shotVideo() : AD.shotBodies()));
  return row;
}

/** Fabric, care and delivery, which the top page rung writes out in full. */
function specs() {
  const box = el('div', 'yad-specs');
  box.append(el('div', 'yad-chart-head', AD.specsTitle()));
  const rows = [
    [AD.specFabric(), AD.specFabricValue()],
    [AD.specCare(), AD.specCareValue()],
    [AD.specDelivery(), AD.specDeliveryValue()],
  ];
  for (const [name, value] of rows) {
    const row = el('div', 'yad-spec');
    row.append(el('span', 'yad-spec-k', name), el('span', 'yad-spec-v', value));
    box.append(row);
  }
  return box;
}

/** Real measurements, which the size guide's second rung buys. */
function measurements() {
  const box = el('div', 'yad-measure');
  box.append(el('div', 'yad-chart-head', AD.measureTitle()));
  const table = el('div', 'yad-measure-grid');
  for (const head of [AD.measureSize(), AD.measureChest(), AD.measureWaist(), AD.measureHip()]) {
    table.append(el('span', 'yad-measure-h', head));
  }
  for (const [name, chest, waist, hip] of SIZE_ROWS) {
    table.append(el('span', name === 'M' ? 'yad-measure-c on' : 'yad-measure-c', name));
    for (const n of [chest, waist, hip]) table.append(el('span', 'yad-measure-c', String(n)));
  }
  box.append(table);
  return box;
}

/** What the dearest size-guide rung adds: two fields and an answer. */
function fitFinder() {
  const box = el('div', 'yad-fit');
  box.append(el('div', 'yad-chart-head', AD.fitTitle()));
  const row = el('div', 'yad-fit-row');
  for (const name of [AD.fitHeight(), AD.fitBuild()]) {
    const field = el('span', 'yad-fit-field');
    field.append(el('i', null), el('span', null, name));
    row.append(field);
  }
  row.append(el('span', 'yad-fit-answer', AD.fitAnswer({ size: SIZE_ROWS[1][0] })));
  box.append(row);
  return box;
}

/**
 * A part of the page ringed as new, the week its rung went live (the owner's
 * choice, 2026-09-19). The entrance is the review's own: opacity and an 8px
 * rise, 240ms, which `ui/studio.css` drops to a fade under reduced motion.
 */
function arrived(node) {
  if (!node) return node;
  node.classList.add('yad-new');
  node.append(el('span', 'yad-new-tag', AD.arrived()));
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
 * What a bought size guide or photography does to the business, in the unit it
 * moves — the settled value, not today's. Their grade points are drawn apart.
 */
function movedBy(part) {
  const percent = pct(part.moves === 'returns' ? 1 - 1 / part.lift : part.lift - 1);
  return part.moves === 'returns' ? AD.fewerBack({ percent }) : AD.moreSales({ percent });
}

/**
 * The grade points a bought purchase's own sentences earn, one line a rule, or a
 * line saying it earns none of its own (design B, 2026-09-17). Gains are mint; a
 * lost point is amber and carries a minus sign.
 */
function gradeLines(part) {
  if (part.gradeLines.length === 0) return [el('span', 'yad-buy-moves none', AD.noOwnPoint())];
  return part.gradeLines.map((line) => el('span', line.points < 0 ? 'yad-buy-moves lost' : 'yad-buy-moves grade',
    AD.gradeRule(line)));
}

/** The point more than one purchase earns alone, on a line of its own. */
function sharedLines(shared) {
  if (shared.length === 0) return null;
  const box = el('div', 'yad-shared');
  box.append(el('div', 'yad-buy-top', AD.sharedHead()));
  for (const line of shared) {
    box.append(el('span', 'yad-buy-moves grade', AD.gradeRule(line)),
      el('span', 'yad-small', AD.sharedWhy({ rule: line.rule, at: DESCRIBED_AT, targets: line.by })));
  }
  return box;
}

/**
 * The total the rows and the shared line add up to, and the week it will all
 * have arrived. THE CAP IS SHOWN OPENLY (the owner, 2026-09-17): a total past ten
 * says the grade stops there, where the chart draws the grade the auction uses.
 */
function sumLine(sum) {
  if (!sum) return null;
  const box = el('div', 'yad-sum');
  box.append(el('span', 'yad-sum-parts', AD.sumStart({ start: sum.start, parts: sum.parts })));
  const total = el('span', 'yad-sum-right');
  total.append(el('strong', 'yad-sum-total', String(sum.total)),
    el('span', 'yad-small', sum.capped ? AD.sumStops({ top: GRADE_CAP }) : AD.sumScale({ top: GRADE_CAP })));
  if (sum.week !== null) total.append(el('span', 'yad-small', AD.sumFrom({ week: sum.week })));
  box.append(total);
  return box;
}

/**
 * And what it would move, for a target nothing was spent on. The page moves the
 * grade, and it once fell through to "would buy more sales per click": it now
 * names the cheapest amount that adds grade to this account (read.js, wouldAdd).
 */
function wouldMove(part) {
  if (part.moves === 'grade') {
    return part.wouldAdd
      ? AD.wouldGrade({ amount: rupees(part.wouldAdd.paise), points: part.wouldAdd.points })
      : AD.noGrade();
  }
  return part.moves === 'returns' ? AD.wouldReturns() : AD.wouldSales();
}

function landingPage(model, openGuide) {
  const box = el('div', 'yad-card');
  box.classList.add('yad-page');

  // Each picture is drawn when its RUNG is live (read.js, pageDrawn), not once
  // every purchase on its target has landed. `fresh` is what went live THIS
  // week, so the page can ring what has just arrived.
  const { drawn, fresh } = model.page;
  // A part is handed to `arrived` only in the week its rung went live.
  const mark = (key, node) => (fresh.has(key) ? arrived(node) : node);

  // --- the page itself, drawn from what is live -----------------------------
  const sheet = el('div', 'yad-sheet');
  // UNPAINTED UNTIL THE PAGE IS FAST. A page below the `faster` rung is drawn
  // as the placeholders a visitor waits in front of, so the first ₹25,000 of
  // page money is the thing that finishes it (the owner, 2026-09-19).
  if (!drawn.painted) sheet.classList.add('slow');
  sheet.append(el('div', 'yad-bar', model.domain));

  // THE BUY BOX (2026-09-25, design option B). The hero used to be a 124px
  // thumbnail beside a short column, which read as a card ABOUT a product
  // rather than a page somebody would buy from. It is now the layout every
  // real product page uses: the picture and its gallery on one side, and
  // everything a buyer decides with on the other — name, reviews, price, size,
  // and the thing you press.
  const hero = el('div', 'yad-hero');
  const shotCol = el('div', 'yad-shotcol');
  shotCol.append(mark('shots', garmentAt(drawn, model.product.shape)));
  // The gallery belongs under the picture it is a gallery OF. It used to sit in
  // the text column, under the sizes.
  add(shotCol, mark('bodies', thumbs(drawn, model.product.shape)));
  hero.append(shotCol);

  const detail = el('div', 'yad-detail');
  detail.append(el('div', 'yad-product', model.product.name));
  if (drawn.stars) {
    const reviews = el('div', 'yad-reviews');
    reviews.append(stars(), el('span', 'yad-small', AD.reviewCount()));
    detail.append(mark('stars', reviews));
  }
  detail.append(el('div', 'yad-price', rupees(model.product.pricePaise)));
  const sizes = el('div', 'yad-sizes');
  for (const [i, name] of ['S', 'M', 'L'].entries()) {
    sizes.append(el('span', i === 1 ? 'yad-size on' : 'yad-size', name));
  }
  detail.append(sizes);
  // NOT A BUTTON, DELIBERATELY. A page with no button does not look like a
  // page anyone buys from, and a real button here would be the only control in
  // the game that does nothing when pressed. It is drawn and inert, and
  // `aria-hidden` keeps it out of the tab order and off a screen reader, which
  // is the honest treatment for a picture of a control.
  const cta = el('div', 'yad-cta', AD.addToBag());
  cta.setAttribute('aria-hidden', 'true');
  detail.append(cta);
  hero.append(detail);
  sheet.append(hero);
  if (!drawn.painted) sheet.append(el('div', 'yad-loading', AD.loading()));
  if (drawn.specs) sheet.append(mark('specs', specs()));
  // The dearer size-guide rungs replace the one below rather than stack on it:
  // a page does not carry a bar chart AND a table of the same sizes.
  if (drawn.fitFinder) sheet.append(mark('fitFinder', fitFinder()));
  if (drawn.measurements) sheet.append(mark('measurements', measurements()));
  else if (drawn.sizeChart) sheet.append(mark('sizeChart', sizeChart()));

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
    row.append(top);
    if (part.bought) {
      row.append(...gradeLines(part));
      if (part.moves !== 'grade') row.append(el('span', 'yad-buy-moves', movedBy(part)));
    } else {
      row.append(el('span', 'yad-buy-moves', wouldMove(part)));
    }
    // The page names the weeks its own points arrive; the other two name the
    // week their work lands, which is when their points arrive too.
    if (part.moves === 'grade') {
      if (part.steps.length > 0) row.append(el('span', 'yad-small', AD.gradeWeeks({ steps: part.steps, started: part.now > 0 })));
    } else if (part.week !== null) {
      row.append(el('span', 'yad-small', AD.liveWeek({ week: part.week })));
    }
    list.append(row);
  }
  // Where the grade comes from, beneath the rows (design B, 2026-09-17): the point
  // more than one purchase earns alone, then the total they all add up to.
  add(list, sharedLines(model.page.shared), sumLine(model.page.sum));
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
  const model = adModel({
    draft: game.draft, creative, name: self.name, domain: self.domain, position: self.position,
  });

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
