/**
 * What the first run shows, read without a page (plans/2026-09-19-first-run-plan.md,
 * Task 3): the nine beats, where you are in them, and every figure their
 * sentences quote.
 *
 * IT HOLDS NO DOM, like every other `read.js` in the Studio. The whole
 * progression — which beat, what is behind you, where the button goes, whether
 * there is anywhere back to — is a pure function of one number, so it can be
 * driven hard by a test on a suite with no browser in it.
 *
 * NOT ONE FIGURE IS TYPED HERE. The auction's come from `demonstration()`, the
 * market's from `briefing()` — the same call round 0's first step already reads
 * them from — and the weeks from `ATTRIBUTION_LAG_DISTRIBUTION` and
 * `RETURNS_RESOLVE_AFTER_ROUNDS`. The only invention is WHICH week the story is
 * told in, and `tests/firstRun.test.js` holds even that to a week the engine
 * could really produce.
 */

import { briefing } from '../../setup.js';
import { QUERY_SET } from '../../content/querySet.js';
import {
  MAX_SLOTS, TOTAL_ROUNDS, ADVERTISER_COUNT, RTO_FREIGHT_PAISE,
  MONTHLY_BUDGET_PAISE, ROUNDS_PER_MONTH,
} from '../../engine/constants.js';
import { RETURNS_RESOLVE_AFTER_ROUNDS } from '../dashboard.js';
import { rupees, whole, pct } from '../dom.js';
import { FIRST_RUN as W } from '../words/firstrun.js';
import { DEMO_HOUR } from './auction.js';

/**
 * The nine beats, in order. `trail` is the one quiet line the beat leaves
 * behind it once it has been played; the last beat leaves none, because there
 * is nothing after it to leave it above.
 */
export const BEATS = Object.freeze([
  { key: 'search', trail: W.b1Trail, next: W.next1 },
  { key: 'serp', trail: W.b2Trail, next: W.next2 },
  // Split from the ladder and the click (I55): each of those taught three of
  // the run's fifteen terms on one screen, which is where a tester said it
  // went too fast.
  { key: 'auction', trail: W.b3Trail, next: W.next3 },
  { key: 'ladder', trail: W.b4Trail, next: W.next4 },
  { key: 'click', trail: W.b5Trail, next: W.next5 },
  { key: 'budget', trail: W.b6Trail, next: W.next6 },
  { key: 'delay', trail: W.b7Trail, next: W.next7 },
  { key: 'refused', trail: W.b8Trail, next: W.next8 },
  { key: 'yours', trail: null, next: W.next9 },
].map(Object.freeze));

/**
 * THE WEEK THE STORY IS TOLD IN. Week 3 is early enough that everything it sets
 * off still lands inside a twelve-week game, which is the point being made.
 * The sale lands two weeks on, well inside the lag window, and the return comes
 * back the engine's own number of rounds after that.
 */
const CLICK_WEEK = 3;
const BUY_AFTER = 2;

/** 19 becomes "7 pm": the hour the auction really ran at, said as a person would. */
function clockFor(hour) {
  const short = hour % 12 === 0 ? 12 : hour % 12;
  return `${short} ${hour < 12 ? 'am' : 'pm'}`;
}

/**
 * Where the story happens: the first city of whichever kind of place carries
 * most of the mid tier's searches, so it is read off the game's own location
 * table rather than chosen.
 */
function cityFor(locations) {
  const busiest = [...locations].sort((a, b) => b.shareOfSearches.mid - a.shareOfSearches.mid)[0];
  return busiest.examples[0];
}

/**
 * Every figure the run's sentences quote.
 *
 * @param {object} demo - `demonstration()`
 * @returns {Readonly<object>} keyed as `ui/words/firstrun.js` names them
 */
export function figuresFor(demo) {
  const brief = briefing(QUERY_SET);
  const mid = brief.economicsByTier.mid;
  const buyWeek = CLICK_WEEK + BUY_AFTER;
  const weekBudgetPaise = Math.round(MONTHLY_BUDGET_PAISE / ROUNDS_PER_MONTH);
  return Object.freeze({
    // The auction's own.
    query: demo.query.text,
    volume: whole(demo.query.weekly),
    winner: demo.winner.name,
    winnerBid: rupees(demo.winner.bidPaise),
    winnerPays: rupees(demo.winner.cpcPaise),
    runnerUp: demo.runnerUp.name,
    runnerUpBid: rupees(demo.runnerUp.bidPaise),
    runnerUpPays: rupees(demo.runnerUp.cpcPaise),
    entered: whole(demo.entered),
    of: whole(demo.of),

    // BEAT 6'S BUDGET, from the engine's own month and its own weeks (I55) —
    // the figure round 0 will hand the player, not a number written for a
    // story. The bar is the click against that week, which is a small bite
    // and is meant to look like one.
    weekBudget: rupees(weekBudgetPaise),
    // A BAR WAS WRONG HERE. Rs25 against a Rs42,000 week is 0.06% — three
    // pixels of a 762px track, which draws as "nothing happened" and teaches
    // nothing. The same fact said as a COUNT is the intuition the beat is
    // for: a budget is a number of clicks, and it runs out.
    budgetClicks: whole(Math.floor(weekBudgetPaise / demo.winner.cpcPaise)),

    // The market's.
    where: cityFor(brief.locations),
    time: clockFor(DEMO_HOUR),
    slots: whole(MAX_SLOTS),
    order: rupees(mid.aovMeanPaise),
    freight: rupees(RTO_FREIGHT_PAISE),
    zero: rupees(0),
    returnShare: pct(1 - brief.workedAnchor.retentionPct),
    weekly: whole(brief.weeklySearchesByTier
      ? Object.values(brief.weeklySearchesByTier).reduce((a, b) => a + (b ?? 0), 0)
      : 0),
    rivals: whole(ADVERTISER_COUNT - 1),
    weeks: whole(TOTAL_ROUNDS),

    // The weeks the tail is told in.
    clickWeek: whole(CLICK_WEEK),
    buyWeek: whole(buyWeek),
    backWeek: whole(buyWeek + RETURNS_RESOLVE_AFTER_ROUNDS),
  });
}

/**
 * What the screen shows at one beat.
 *
 * @param {number} at - 0-based
 * @returns {{
 *   at: number, total: number, key: string, isLast: boolean,
 *   showsOpener: boolean, showsSkip: boolean, canBack: boolean,
 *   next: string, trail: Array<{n: number, text: string}>,
 * }}
 */
export function runView(at, figures = {}) {
  const beat = BEATS[at];
  if (!beat) throw new RangeError(`the first run has no beat ${at}`);
  return {
    at,
    total: BEATS.length,
    key: beat.key,
    isLast: at === BEATS.length - 1,
    // The statement of what this is rides on the first beat, so a player who
    // reads nothing else has still been told what they are about to do.
    showsOpener: at === 0,
    showsSkip: at !== BEATS.length - 1,
    canBack: at > 0,
    next: beat.next(figures),
    trail: BEATS.slice(0, at)
      .map((played, i) => (played.trail ? { n: i + 1, text: played.trail(figures) } : null))
      .filter(Boolean),
  };
}

/**
 * @param {number} at
 * @returns {number|null} the next beat, or null when the run is over
 */
export function forward(at) {
  return at + 1 < BEATS.length ? at + 1 : null;
}

/**
 * @param {number} at
 * @returns {number|null} the beat before, or null from the first
 */
export function back(at) {
  return at > 0 ? at - 1 : null;
}

/**
 * The terms each beat teaches, in the order the beat shows them. This is the
 * run's purpose in one table: a beginner meets a word attached to the thing it
 * names, once, and never meets it twice in two voices (the design's section 3,
 * "one word, one home").
 */
export const TERMS = Object.freeze({
  search: [[W.termSearch, W.glossSearch], [W.termVolume, W.glossVolume]],
  serp: [[W.termAd, W.glossAd], [W.termPosition, W.glossPosition], [W.termImpression, W.glossImpression]],
  // Two terms a beat at most, since I55. The auction is its own idea; the bid
  // and where it lands you are the next one; and the budget the click came
  // out of is a third, not a clause on the click's screen.
  auction: [[W.termAuction, W.glossAuction]],
  ladder: [[W.termBid, W.glossBid], [W.termRank, W.glossRank]],
  click: [[W.termClick, W.glossClick], [W.termCpc, W.glossCpc]],
  budget: [[W.termBudget, W.glossBudget]],
  delay: [[W.termConversion, W.glossConversion], [W.termDelay, W.glossDelay]],
  refused: [[W.termReturn, W.glossReturn], [W.termRefused, W.glossRefused]],
  yours: [],
});

/**
 * @param {string} key - a beat's
 * @param {object} f - `figuresFor()`
 * @returns {Array<{term: string, gloss: string}>}
 */
export function termsFor(key, f = {}) {
  return (TERMS[key] ?? []).map(([term, gloss]) => ({ term: term(f), gloss: gloss(f) }));
}

/**
 * The ladder, ready to draw: money already formatted, and the two bars as
 * fractions of the strongest row. The bars are pictures of a value, which is
 * why they may grow; the money beside them may not (section 13 forbids a
 * counting ticker, and these are numbers a player reads).
 *
 * @param {object} demo - `demonstration()`
 * @returns {ReadonlyArray<object>}
 */
export function tableFor(demo) {
  const topRank = Math.max(...demo.rows.map((row) => row.adRank));
  const topFit = Math.max(...demo.rows.map((row) => row.signal));
  return Object.freeze(demo.rows.map((row) => Object.freeze({
    id: row.id,
    name: row.name,
    shown: row.shown,
    position: row.position,
    bid: rupees(row.bidPaise),
    pays: row.shown ? rupees(row.cpcPaise) : DASH,
    place: row.shown ? String(row.position) : DASH,
    fitShare: row.signal / topFit,
    rankShare: row.adRank / topRank,
  })));
}

/** An em dash, for a row with no place and nothing to pay. */
const DASH = '—';

/**
 * The five weeks a click takes to settle, and what one week's report said each
 * time it was rewritten. Beats 5 and 6 draw the same strip; what differs is
 * which weeks are lit, so the player sees week 7 turn against weeks they have
 * already read.
 *
 * @param {object} f - `figuresFor()`
 * @returns {{weeks: ReadonlyArray<object>, reports: Readonly<object>}}
 */
export function tailFor(f) {
  const click = Number(f.clickWeek);
  const buy = Number(f.buyWeek);
  const backAt = Number(f.backWeek);
  // EACH BEAT GETS ITS OWN LINES, because a week that has not happened yet must
  // not be readable. Found by playing it: one shared array meant the delay beat
  // already showed the last week saying "refused at the door", which is the
  // whole of the beat after it.
  const weeks = [];
  for (let n = click; n <= backAt; n += 1) {
    let lines;
    let lit = null;
    if (n === click) [lines, lit] = [[W.wkClick(f), f.winnerPays], 'hit'];
    else if (n === buy) [lines, lit] = [[W.wkBuys(f), f.order], 'hit'];
    else if (n === backAt) [lines, lit] = [[W.wkRefused(f), f.freight], 'bad'];
    else if (n === buy + 1) lines = [W.wkShips(f)];
    else lines = [W.wkThinks(f)];

    const known = n <= buy;
    weeks.push({
      n,
      // On the delay beat the story has only reached the sale.
      delay: { tone: known ? lit : null, lines: known ? lines : [] },
      // On the return beat every week has happened, and only the last is lit.
      refused: { tone: n === backAt ? 'bad' : null, lines },
    });
  }
  return Object.freeze({
    weeks: Object.freeze(weeks.map(Object.freeze)),
    reports: Object.freeze({
      then: W.repThen(f),
      later: W.repLater(f),
      latest: W.repLatest(f),
    }),
  });
}

/**
 * Everything the drawing needs, worked out here so `render.js` holds no
 * arithmetic: the four ads as the searcher meets them, the ladder formatted,
 * and the five weeks with their reports.
 *
 * @param {object} demo - `demonstration()`
 * @param {object} f - `figuresFor(demo)`
 * @returns {Readonly<object>}
 */
export function partsFor(demo, f) {
  return Object.freeze({
    ads: Object.freeze(demo.rows.filter((row) => row.shown)),
    table: tableFor(demo),
    tail: tailFor(f),
  });
}
