/**
 * The first run, drawn (plans/2026-09-19-first-run-plan.md, Task 3).
 *
 * IT HOLDS NO SENTENCE. Every word is a `line()` in `ui/words/firstrun.js`, and
 * `tests/words.test.js`'s drawing guard fails any string of three words here.
 * It works out no figure either: the auction and its figures are handed in, so
 * this file cannot quietly start computing what the engine should.
 *
 * THE MOTION IS THE REVIEW'S (reviews/slc-review.md section 13), not new. A
 * beat enters on opacity and an 8px rise; going back reverses it; the ladder
 * reveals row by row at a 50ms stagger, which is row 5's end-screen reveal
 * applied to the same idea — nine brands in rank order — and makes "ranked"
 * legible without a sentence. NO COUNTING TICKERS: every rupee figure appears
 * at its true value, because a ticker shows in-between numbers the engine never
 * reported. A bar may grow; a number may not. `ui/studio.css` drops every
 * translate under `prefers-reduced-motion` and keeps the fades.
 */

import { el, add } from '../dom.js';
import { button, icon } from '../kit/controls.js';
import { ICONS } from '../shell/sections.js';
import { serp } from '../kit/serp.js';
import { FIRST_RUN as W } from '../words/firstrun.js';
import { runView, forward, back, termsFor } from './read.js';

/** Remembers that this browser has been through the run. Beside the save, never inside it. */
export const FIRST_RUN_KEY = 'g-ads-simulation:first-run';

/** Row 5's stagger, in milliseconds. */
const STAGGER = 50;

/**
 * @param {Storage|null} storage
 * @returns {boolean} whether this browser has already seen the run
 */
export function seenFirstRun(storage) {
  try {
    return storage?.getItem(FIRST_RUN_KEY) === '1';
  } catch {
    // A browser that will not store it sees the run again, which is the safe
    // way to be wrong: a beginner meets it twice rather than never.
    return false;
  }
}

/** @param {Storage|null} storage */
export function markFirstRunSeen(storage) {
  try {
    storage?.setItem(FIRST_RUN_KEY, '1');
  } catch {
    // Unstorable is not a failure. The run has still been played.
  }
}

const say = (text) => el('p', 'fr-say', text);
const note = (text) => el('p', 'fr-note', text);
const kicker = (text) => el('div', 'fr-kicker', text);

/** The terms this beat teaches, each named beside what it means. */
function wordRow(key, f) {
  const terms = termsFor(key, f);
  if (terms.length === 0) return null;
  const row = el('div', 'fr-words');
  terms.forEach(({ term, gloss }, i) => {
    const chip = el('span', 'fr-word');
    chip.style.animationDelay = `${i * 60}ms`;
    add(chip, el('b', null, term), el('span', null, gloss));
    add(row, chip);
  });
  return row;
}

/** The search box, with whatever the beat puts under it. */
function searchBox(f, under) {
  const box = el('div', 'fr-serp');
  const query = el('div', 'fr-q');
  // The kit's own magnifier, rather than markup written here: a drawing module
  // holds no string a reader could mistake for a sentence.
  add(query, icon(ICONS.typed), el('span', null, f.query));
  add(box, query);
  if (under) add(box, under);
  return box;
}

function beatSearch(f) {
  const parts = [kicker(W.b1Kicker(f))];
  parts.push(searchBox(f, el('div', 'fr-where', W.b1Where(f))));
  parts.push(say(W.b1Say(f)));
  return parts;
}

function beatSerp(f, parts) {
  const shown = parts.ads;
  const stack = el('div', 'fr-ads');
  shown.forEach((row, i) => {
    const ad = serp({
      domain: row.domain,
      headlines: [...row.headlines],
      descriptions: [...row.descriptions],
      sponsored: W.b2Sponsored(f),
    });
    ad.style.animationDelay = `${i * STAGGER}ms`;
    add(stack, ad);
  });
  const organic = el('div', 'fr-organic');
  add(organic, el('i', null), el('i', 'thin'), el('small', null, W.b2Organic(f)));
  add(stack, organic);
  return [kicker(W.b2Kicker(f)), searchBox(f, stack), say(W.b2Say(f))];
}

/**
 * The ladder: one row a brand, revealed in rank order.
 *
 * WITHOUT ITS PAYS COLUMN SINCE I57. Six columns was two too many, and the
 * sixth contradicted the beat's own opening sentence. The class goes on the
 * node so the stylesheet lays out five columns rather than six.
 */
function ladder(f, table) {
  const node = el('div', 'fr-ladder nopays');
  const head = el('div', 'fr-lhd');
  add(head, el('span', null), el('span', null, W.colBrand(f)), el('span', null, W.colBid(f)),
    el('span', null, W.colFits(f)), el('span', null, W.colRank(f)));
  add(node, head);

  let cut = false;
  table.forEach((row, i) => {
    if (!row.shown && !cut) {
      cut = true;
      const line = el('div', 'fr-cut');
      line.style.animationDelay = `${i * STAGGER}ms`;
      add(line, el('i', null), el('span', null, W.b4Cut(f)), el('i', null));
      add(node, line);
    }
    const line = el('div', row.shown ? 'fr-lrow shown' : 'fr-lrow out');
    line.style.animationDelay = `${i * STAGGER}ms`;
    const fit = el('span', 'fr-fit');
    const fill = el('i', null);
    fill.style.width = `${Math.round(100 * row.fitShare)}%`;
    add(fit, fill);
    const rank = el('span', 'fr-rank');
    rank.style.width = `${Math.round(100 * row.rankShare)}%`;
    add(line,
      el('span', 'fr-pos', row.place),
      el('span', 'fr-brand', row.name),
      el('span', 'fr-num', row.bid),
      fit,
      rank);
    add(node, line);
  });
  return node;
}

/**
 * Beat 5: what each of the four actually paid (I57).
 *
 * Only the brands that showed. The two below the line pay nothing, and a row
 * of dashes under a column headed "pays" is the kind of near-miss this run
 * cannot afford — the screen exists to make one rule legible.
 *
 * Two plain figures and an arrow, with no bar on it: the ladder's bars are
 * about the ORDER, which is settled by the time a reader arrives here.
 */
function prices(f, table) {
  const node = el('div', 'fr-prices');
  const head = el('div', 'fr-phd');
  add(head, el('span', null), el('span', null, W.b5Bid(f)), el('span', null), el('span', null, W.b5Paid(f)));
  add(node, head);
  table.filter((row) => row.shown).forEach((row, i) => {
    const line = el('div', 'fr-prow');
    line.style.animationDelay = `${i * STAGGER}ms`;
    add(line,
      el('span', 'fr-brand', row.name),
      el('span', 'fr-num', row.bid),
      // Its own class, not `fr-arrow`: that one is hidden below 560px, where
      // the two-cell strips stack and an arrow pointing sideways would lie.
      // This row stays a row at every width, so its arrow stays.
      el('span', 'fr-then', '→'),
      el('span', 'fr-num pays', row.pays));
    add(node, line);
  });
  return node;
}

/**
 * Beat 3: the auction, before any of its machinery (I55). It shows the same
 * count the ladder will rank — how many wanted the search against how many
 * slots there are — so the ladder that follows is read as the answer to a
 * question this beat has already asked.
 */
function beatAuction(f) {
  const strip = el('div', 'fr-strip');
  add(strip,
    cell(W.b3Wanted(f), String(f.entered), W.b3OfBrands({ of: f.of }), null),
    el('span', 'fr-arrow', '→'),
    cell(W.b3Cut(f), String(f.slots), W.b3Shown(f), 'red'));
  return [kicker(W.b3Kicker(f)), strip, say(W.b3Say(f)), note(W.b3Again(f))];
}

function beatLadder(f, parts) {
  return [kicker(W.b4Kicker(f)), say(W.b4Say(f)), ladder(f, parts.table), note(W.b4Callout(f))];
}

function beatPrice(f, parts) {
  return [kicker(W.b5Kicker(f)), say(W.b5Say(f)), prices(f, parts.table),
    note(W.b5Note(f)), note(W.b5Cost(f))];
}

/** One figure with its label, as beat 4's pair of cells. */
function cell(label, value, sub, tone) {
  const node = el('div', 'fr-cell');
  const big = el('span', tone ? `fr-v ${tone}` : 'fr-v', value);
  add(node, el('span', 'fr-k', label), big, el('span', 'fr-s', sub));
  return node;
}

function beatClick(f) {
  const strip = el('div', 'fr-strip');
  add(strip,
    cell(W.b6Pays(f), f.winnerPays, W.b6When(f), 'red'),
    el('span', 'fr-arrow', '→'),
    cell(W.b6Sold(f), f.zero, W.b6Looking(f), 'dim'));
  return [kicker(W.b6Kicker(f)), strip, say(W.b6Say(f)), note(W.b6Note(f))];
}

/** The five weeks a click takes to settle, with the ones that matter lit. */
function weeks(list, beat) {
  const row = el('div', 'fr-weeks');
  list.forEach((week, i) => {
    const { tone, lines } = week[beat];
    const node = el('div', tone ? `fr-wk ${tone}` : 'fr-wk');
    node.style.animationDelay = `${i * STAGGER}ms`;
    const body = el('span', 'fr-e');
    lines.forEach((text, j) => {
      if (j > 0) add(body, el('br', null));
      add(body, el('span', j === 0 && tone ? 'lead' : null, text));
    });
    add(node, el('span', 'fr-n', W.wkWeek({ n: week.n })), body);
    add(row, node);
  });
  return row;
}

/** What one week's report said, once per time it was rewritten. */
function rewrite(title, rows) {
  const box = el('div', 'fr-rewrite');
  add(box, kicker(title));
  rows.forEach(([when, what, tone], i) => {
    const line = el('div', 'fr-rw');
    line.style.animationDelay = `${i * 60}ms`;
    add(line, el('span', null, when), el('span', tone ? `fr-num ${tone}` : 'fr-num', what));
    add(box, line);
  });
  return box;
}

function beatDelay(f, parts) {
  const { weeks: list, reports } = parts.tail;
  return [
    kicker(W.b8Kicker(f)),
    weeks(list, 'delay'),
    rewrite(W.b8Report(f), [[W.b8Then(f), reports.then], [W.b8Later(f), reports.later, 'up']]),
    say(W.b8Say(f)),
    note(W.b8Note(f)),
  ];
}

function beatRefused(f, parts) {
  const { weeks: list, reports } = parts.tail;
  return [
    kicker(W.b9Kicker(f)),
    weeks(list, 'refused'),
    say(W.b9Say(f)),
    rewrite(W.b9Report3(f), [
      [W.b8Then(f), reports.then],
      [W.b8Later(f), reports.later, 'up'],
      [W.b9Latest(f), reports.latest, 'down'],
    ]),
    note(W.b9Note(f)),
  ];
}

function beatYours(f) {
  return [
    kicker(W.b10Kicker(f)),
    el('div', 'fr-hero', W.b10Hero(f)),
    say(W.b10Say(f)),
    note(W.b10Note(f)),
  ];
}

/**
 * Beat 6: the budget the click came out of (I55). One bar, spent against
 * left, because the point is proportion — a click is a small bite of a week,
 * and the week stops when the bites add up.
 */
function beatBudget(f) {
  const strip = el('div', 'fr-strip');
  add(strip,
    cell(W.b7Week(f), f.weekBudget, W.b7ToSpend(f), null),
    el('span', 'fr-arrow', '→'),
    cell(W.b7Buys(f), f.budgetClicks, W.b7Gone(f), 'red'));
  return [kicker(W.b7Kicker(f)), strip, say(W.b7Say(f)), note(W.b7Note(f))];
}

const BODIES = {
  search: beatSearch,
  serp: beatSerp,
  auction: beatAuction,
  ladder: beatLadder,
  price: beatPrice,
  click: beatClick,
  budget: beatBudget,
  delay: beatDelay,
  refused: beatRefused,
  yours: beatYours,
};

/**
 * The minute before round 0.
 *
 * @param {object} deps
 * @param {object} deps.figures - what read.js's `figuresFor` worked out
 * @param {object} deps.parts - `{ads, table, tail}`, everything read.js worked
 *   out. Handed in rather than computed, so this file cannot quietly start
 *   working out what the engine should (tests/firstRun.test.js holds it).
 * @param {() => void} deps.onDone - Skip, or finishing the last beat
 * @returns {{node: HTMLElement}}
 */
export function createFirstRun({ figures, parts, onDone }) {
  const node = el('div', 'fr-board');
  const top = el('div', 'fr-top');
  const dots = el('div', 'fr-dots');
  const skip = button('fr-skip', W.skip(figures));
  const trail = el('div', 'fr-trail');
  const slot = el('div', 'fr-slot');
  const column = el('div', 'fr-col');
  add(top, dots, skip);
  add(column, trail, slot);
  add(node, top, column);

  let at = 0;
  let going = 1;

  skip.addEventListener('click', onDone);

  function draw() {
    const view = runView(at, figures);

    dots.replaceChildren(...Array.from({ length: view.total }, (_, i) => {
      const mark = el('span', 'fr-dot');
      if (i === view.at) mark.classList.add('on');
      else if (i < view.at) mark.classList.add('done');
      return mark;
    }));

    trail.replaceChildren(...view.trail.map((row) => {
      const line = el('div', 'fr-past');
      if (row.n === view.at && going === 1) line.classList.add('fresh');
      add(line, el('b', null, String(row.n)), el('span', null, row.text));
      return line;
    }));

    skip.hidden = !view.showsSkip;

    const live = el('div', going === 1 ? 'fr-live enter' : 'fr-live back');
    if (view.showsOpener) {
      const opener = el('div', 'fr-opener');
      add(opener,
        el('div', 'fr-hero', W.openTitle(figures)),
        say(W.openTypes(figures)),
        say(W.openLength(figures)),
        el('p', 'fr-lede', W.openNoNeed(figures)));
      add(live, opener);
    }
    add(live, ...BODIES[view.key](figures, parts));
    const chips = wordRow(view.key, figures);
    if (chips) add(live, chips);

    const row = el('div', 'fr-row');
    const go = button('fr-go', view.next);
    go.addEventListener('click', () => {
      const next = forward(at);
      going = 1;
      if (next === null) { onDone(); return; }
      at = next;
      draw();
    });
    add(row, go);
    if (view.canBack) {
      const backward = button('fr-back', W.back(figures));
      backward.addEventListener('click', () => { going = -1; at = back(at); draw(); });
      add(row, backward);
    }
    if (view.isLast) {
      const again = button('fr-again', W.again(figures));
      again.addEventListener('click', () => { going = 1; at = 0; draw(); });
      add(row, again);
    }
    add(live, row);
    slot.replaceChildren(live);
  }

  draw();
  return { node };
}
