/**
 * What the weekly Your ad shows (the owner's call, 2026-09-15), read without a
 * page: the ad as searchers see it, who wrote it, the grades the auctions use,
 * and the landing page.
 *
 * READ-ONLY. The ad is written once, in round 0, and nothing rewrites it (I9);
 * rewriting waits for the message project. Every figure is the player's own:
 * the draft, which is built from `getSelfView`, and the creative block, which
 * that view does not carry and the caller reads from state (I16).
 *
 * A GRADE IS THE ONE THE AUCTIONS WILL RUN ON in the week about to be played,
 * and one still to change says when: landing page capital being built (13.3),
 * or, in a save from before 2026-09-14, a self-written ad not yet live (I11).
 * Both are worked out by `effectiveGrades`, the function the reserve and the
 * keyword card read, so the three cannot disagree.
 */

import { TOTAL_ROUNDS } from '../../engine/constants.js';
import { productFor } from '../../content/product.js';
import { writerTier, isDiy } from '../../content/writers.js';
import { effectiveGrades } from '../decisions.js';
import { pageShape } from '../landing-page.js';
import {
  tiersFunded, pageAsItStands, pagePoints, PAGE_FEATURES, GRADE_CAP, LANDING_RULES, rulesFor,
} from '../../content/landingPage.js';
import { capexEffect, liveCapexPaise } from '../../engine/positions.js';

const PARTS = ['expectedCtr', 'adRelevance', 'landingPage'];

/**
 * The three things capital can put on the page, in the order it draws them,
 * and what each one moves. `orderConfirmation` is not here: it buys fewer
 * refusals at the door and nothing a visitor to the page can see.
 */
const PAGE_PARTS = ['landingPage', 'sizeGuide', 'photography'];
const MOVES = Object.freeze({
  landingPage: 'grade',
  sizeGuide: 'returns',
  photography: 'conversions',
});

/**
 * The grade each part runs at in `round`. A save's self-written ad that is due
 * lands as its week runs (`landCreative` in game.js), so from that week on it
 * counts although the state has not applied it yet.
 */
function gradesAt(draft, creative, round) {
  const lands = Boolean(creative?.pendingGrade) && round >= creative.liveAtRound;
  return effectiveGrades({
    ...draft,
    round,
    gradedQuality: lands ? { ...draft.gradedQuality, ...creative.pendingGrade } : draft.gradedQuality,
  });
}

/** The first week a part's grade changes, and to what, or null. */
function firstChange(draft, creative, key, from, round) {
  for (let week = round + 1; week <= TOTAL_ROUNDS; week++) {
    const value = gradesAt(draft, creative, week)[key];
    // Only capital moves the landing page; only a self-written ad still to
    // land moves the other two.
    if (value !== from) return { value, week, why: key === 'landingPage' ? 'page' : 'copy' };
  }
  return null;
}

/**
 * The page's parts, from the capital committed to it. A part whose rung is
 * still being built carries the rung it has now (`from`, null if none) and the
 * week the rest goes live.
 */
function pageStrips(block, round) {
  const committed = block.committed ?? {};
  const notYet = (target) => (block.pending ?? []).filter((p) => p.target === target && p.liveAtRound > round);
  const live = Object.fromEntries(Object.entries(committed)
    .map(([target, paise]) => [target, paise - notYet(target).reduce((sum, p) => sum + p.paise, 0)]));
  const liveLabel = new Map(pageShape(live).strips.map((s) => [s.target, s.label]));
  return pageShape(committed).strips.map((strip) => {
    const now = liveLabel.get(strip.target) ?? null;
    if (now === strip.label) return { target: strip.target, from: null, label: strip.label, week: null };
    return { target: strip.target, from: now, label: strip.label, week: Math.max(...notYet(strip.target).map((p) => p.liveAtRound)) };
  });
}

/**
 * What each thing bought for the page moves, and by how much.
 *
 * CAPITAL REACHES THE GRADE BY TWO ROADS, and this was first written knowing
 * one. Round 0 writes the page description from all the capital and the grader
 * scores it from week 1 — a size chart earns two points there, product shots
 * one — and the page's own capital adds the site work's points from the week it
 * goes live (`landingPageBonus`, which reads the `landingPage` target alone).
 * `points` below is the second road only, which is why only the page has any;
 * the first is already inside the grade the description was given. The size
 * guide also divides the return rate and photography multiplies the conversion
 * rate (`businessFor`). Every figure is asked of the engine, so a change to a
 * curve moves the screen with it rather than leaving it stating an old number.
 *
 * EACH ROW CARRIES THE POINTS ITS OWN SENTENCES EARN, rule by rule (design B, the
 * owner's choice, 2026-09-17, design/grade-breakdown/). A row used to count what
 * the page's capital added against the account without it: +3, while the chart
 * stepped +5 and nothing said where the other two came from — a size chart's
 * sizing point, and the described point that either earns alone, so neither's
 * marginal ever found it. `pagePoints` credits each rule to whoever earns it
 * alone; a point more than one earns alone is shared, and `pageBreakdown` puts it
 * on a line of its own.
 *
 * THE CAP IS SHOWN OPENLY (the owner, 2026-09-17). A row's `points` are what its
 * rules earn, uncapped; the total beneath the rows says when the grade stops at
 * 10, and the chart draws the grade the auction runs on.
 *
 * ITS WEEKS ARE THE WEEKS ITS OWN POINTS ARRIVE (`steps`), not the week the last
 * purchase lands (`week`, which the drawn page still reads, since that is when
 * the site work appears). A page bought in both capital windows can earn twice,
 * and one week cannot say so. Where the cap takes a point, the row still says
 * when it arrives; until the cap was shown openly, it said nothing there.
 *
 * @param {object} block - the draft's `capexBlock`
 * @param {number} round
 * @param {(block: object, round: number) => number|null} grade - the landing page
 *   grade the auction runs on in `round` with that capital (`effectiveGrades`),
 *   or null for an account with no ad to grade
 * @param {{describedFrom?: 'live'|'committed', rules?: readonly object[]}} [options]
 *   'committed' for a game saved before the page was graded as it stands, and the
 *   rules the game was begun under (`pagePoints`, `rulesFor`)
 * @returns {Array<{target: string, label: string|null, bought: boolean, paise: number,
 *   week: number|null, moves: 'grade'|'returns'|'conversions', points: number, now: number,
 *   lift: number, gradeLines: Array<{rule: string, points: number}>,
 *   steps: Array<{week: number, points: number}>, wouldAdd: {paise: number, points: number}|null}>}
 *   in the order the page draws them; `points` and `gradeLines` the grade points
 *   this purchase's own sentences earn once live, `now` what it earns this week,
 *   `lift` the multiplier the size guide and photography apply, 1 when nothing is
 *   bought; `steps`, for the page, the weeks after `round` its own points arrive;
 *   `wouldAdd`, for an unbought page only, the cheapest rung that adds grade to
 *   this account
 */
export function pageParts(block, round, grade, { describedFrom = 'live', rules = LANDING_RULES } = {}) {
  const committed = block?.committed ?? {};
  const pending = (target) => (block?.pending ?? []).filter((p) => p.target === target && p.liveAtRound > round);
  const label = new Map(pageShape(committed).strips.map((s) => [s.target, s.label]));

  // What a purchase buys is what it buys ONCE LIVE. Read at the current round
  // instead, a page bought in week 1 reads "+0 on the grade · live from week 4",
  // which is true and says the opposite of what it means (found by playing it).
  // So `points` and `lift` are the settled answer and `now` is today's.
  const settled = { ...block, pending: [] };
  // WHAT THE PAGE'S OWN CAPITAL ADDS, against the same account without it. Since
  // the page is graded as it stands (the owner, 2026-09-17), a size chart bought
  // beside it lands its sentence on the page too; measured against no capital at
  // all, the page's row would have been credited with the size chart's points.
  const withoutPage = (b) => ({
    ...b,
    committed: { ...(b?.committed ?? {}), landingPage: 0 },
    pending: (b?.pending ?? []).filter((p) => p.target !== 'landingPage'),
  });
  const pageAdds = (b, r) => {
    const all = grade(b, r);
    return all === null ? 0 : all - grade(withoutPage(b), r);
  };
  // WHAT AN UNBOUGHT PAGE WOULD ADD: the cheapest rung that adds anything to THIS
  // account, and how much. Not "it would raise the grade": under the length rule
  // the cheapest rung earned its point only by lengthening the description, which a
  // size chart or product shots may already have done — beside a ₹25,000 size guide
  // it added nothing, and ₹55,000 was the first to add, 3. Measured on the page as
  // it stands (2026-09-17). Since C it earns that point for speed, so in a new game
  // it always adds one; a game saved before C still meets the case.
  const wouldAdd = (committed.landingPage ?? 0) > 0 ? null : PAGE_FEATURES.landingPage
    .map((tier) => tier.paise)
    .filter((paise) => paise > 0)
    .map((paise) => ({ paise, points: pageAdds({ ...settled, committed: { ...committed, landingPage: paise } }, round) }))
    .find((rung) => rung.points > 0) ?? null;

  const pointsAt = (b, r) => pagePoints(b, r, { describedFrom, rules });
  const settledPoints = pointsAt(settled, round);
  const nowPoints = pointsAt(block, round);
  // The page's own weeks: each week after this one in which its points rise. A
  // step in `round` itself is already counted in `now`: that is the week about to run.
  const ownAt = (target, r) => pointTotal(ownLines(pointsAt(block, r), target));
  const steps = Array.from({ length: Math.max(0, TOTAL_ROUNDS - round) }, (_, i) => round + 1 + i)
    .map((r) => ({ week: r, points: ownAt('landingPage', r) - ownAt('landingPage', r - 1) }))
    .filter((step) => step.points !== 0);

  return PAGE_PARTS.map((target) => {
    const paise = committed[target] ?? 0;
    const waiting = pending(target);
    const gradeLines = ownLines(settledPoints, target).map(({ rule, points }) => ({ rule, points }));
    return {
      target,
      label: label.get(target) ?? null,
      bought: paise > 0,
      paise,
      week: waiting.length > 0 ? Math.max(...waiting.map((p) => p.liveAtRound)) : null,
      moves: MOVES[target],
      points: pointTotal(gradeLines),
      now: pointTotal(ownLines(nowPoints, target)),
      lift: target === 'landingPage' ? 1 : capexEffect(paise, target),
      gradeLines,
      steps: target === 'landingPage' ? steps : [],
      wouldAdd: target === 'landingPage' ? wouldAdd : null,
    };
  });
}

/**
 * The points one purchase earns on its own: every line only it earns, and for the
 * page itself any line no purchase earns (the plain page's, of which there are
 * none today). A shared line is no single purchase's.
 */
function ownLines(points, target) {
  return points.lines.filter((line) => (line.by.length === 1
    ? line.by[0] === target
    : line.by.length === 0 && target === 'landingPage'));
}

const pointTotal = (lines) => lines.reduce((sum, line) => sum + line.points, 0);

/**
 * The lines beneath the rows: the points more than one purchase earns alone, and
 * the total the rows and those lines add up to (design B, 2026-09-17).
 *
 * `total` is the plain sum once everything committed is live, and may pass ten —
 * the cap is shown openly (the owner, 2026-09-17), with `capped` saying so. `week`
 * is the last week after `round` in which the total still rises, or null. With
 * nothing that earns a point, there is nothing to add up and `sum` is null.
 *
 * Only a game saved before grading only what Google names (C, 2026-09-17) can have
 * a shared line: every rule a new game grades by is one ladder's own.
 *
 * @param {object} block - the draft's `capexBlock`
 * @param {number} round
 * @param {{describedFrom?: 'live'|'committed', rules?: readonly object[]}} [options]
 * @returns {{shared: Array<{rule: string, points: number, by: string[]}>,
 *   sum: {start: number, parts: number[], total: number, capped: boolean, week: number|null}|null}}
 */
export function pageBreakdown(block, round, { describedFrom = 'live', rules = LANDING_RULES } = {}) {
  const pointsAt = (b, r) => pagePoints(b, r, { describedFrom, rules });
  const settled = pointsAt({ ...block, pending: [] }, round);
  const shared = settled.lines.filter((line) => line.by.length > 1);
  if (settled.lines.length === 0) return { shared, sum: null };

  const parts = [
    ...PAGE_PARTS.map((target) => pointTotal(ownLines(settled, target))).filter((points) => points !== 0),
    ...shared.map((line) => line.points),
  ];
  let week = null;
  for (let r = round + 1; r <= TOTAL_ROUNDS; r++) {
    if (pointsAt(block, r).total !== pointsAt(block, r - 1).total) week = r;
  }
  return {
    shared,
    sum: { start: settled.start, parts, total: settled.total, capped: settled.total > GRADE_CAP, week },
  };
}

/**
 * THE RUNGS THE DRAWN PAGE SHOWS AS PICTURES, one per rung that changes what a
 * visitor would see.
 *
 * TWO OF TWELVE USED TO DRAW ANYTHING (the owner, 2026-09-19: "the current
 * design layout for the webpage is too simple"). Photography was the worst of
 * it — the most expensive ladder in the game, up to ₹1,60,000, and the picture
 * never changed.
 *
 * ORDER CONFIRMATION IS ABSENT, AND THAT IS THE POINT rather than an omission:
 * confirming an order before dispatch changes nothing a visitor reads (I29). If
 * it ever appears here, it has found a second route onto the page.
 *
 * Named by LABEL because the ladder names them that way, and a test holds every
 * label to being a rung its ladder actually has — so renaming a rung fails
 * loudly rather than quietly drawing nothing.
 */
export const DRAWN_RUNGS = Object.freeze({
  // The page itself.
  painted: Object.freeze({ target: 'landingPage', label: 'faster' }),
  stars: Object.freeze({ target: 'landingPage', label: 'reviews' }),
  specs: Object.freeze({ target: 'landingPage', label: 'built around the search' }),
  // What is on it.
  sizeChart: Object.freeze({ target: 'sizeGuide', label: 'a chart' }),
  measurements: Object.freeze({ target: 'sizeGuide', label: 'measured' }),
  fitFinder: Object.freeze({ target: 'sizeGuide', label: 'fit finder' }),
  // And how it is photographed.
  shots: Object.freeze({ target: 'photography', label: 'product shots' }),
  bodies: Object.freeze({ target: 'photography', label: 'on real bodies' }),
  video: Object.freeze({ target: 'photography', label: 'video' }),
});

/**
 * What the drawn page shows in `round`: each picture whose rung is LIVE.
 *
 * IT READS THE LIVE MONEY, NOT WHETHER EVERY PURCHASE HAS LANDED (the owner,
 * 2026-09-16). The page used to draw a target's picture once no tranche on it
 * was pending, whatever rung was live. So ₹55,000 at round 0 and ₹25,000 more
 * at week 5 hid reviews live since week 4 until week 8, while the grade beside
 * them already counted them; and ₹25,000 alone, which buys a page that loads
 * faster and no reviews at all, was drawn with review stars. The live money is
 * run through the same ladder that writes the page's description (`tiersFunded`),
 * so the picture and the words cannot claim different rungs.
 *
 * `painted` IS THE ONE THAT READS BACKWARDS. Every other key adds something;
 * this one says the page is finished rather than still loading, so a page
 * without it is drawn as the placeholders a slow page shows. That makes the
 * first ₹25,000 of page money visible, where it used to buy a sentence and no
 * picture at all.
 *
 * @param {object} block - the draft's `capexBlock`
 * @param {number} round
 * @returns {Record<string, boolean>} keyed as `DRAWN_RUNGS`
 */
export function pageDrawn(block, round) {
  const live = ({ target, label }) => tiersFunded(target, liveCapexPaise(block, target, round))
    .some((tier) => tier.label === label);
  return Object.freeze(Object.fromEntries(
    Object.entries(DRAWN_RUNGS).map(([key, rung]) => [key, live(rung)]),
  ));
}

/**
 * Which pictures the page gained THIS round, so the drawing can say which are
 * new (the owner's choice, 2026-09-19: ring what arrives, the week it arrives).
 *
 * Pure, and a difference rather than a flag on the block: capital lands by
 * going live, and nothing writes "this landed today" anywhere. Round 1 has no
 * round before it, so nothing is ever new in it.
 *
 * @param {object} block - the draft's `capexBlock`
 * @param {number} round
 * @returns {ReadonlySet<string>} keys of `DRAWN_RUNGS`
 */
export function pageArrived(block, round) {
  if (round <= 1) return Object.freeze(new Set());
  const now = pageDrawn(block, round);
  const before = pageDrawn(block, round - 1);
  return Object.freeze(new Set(Object.keys(now).filter((key) => now[key] && !before[key])));
}

/**
 * The landing page grade the auction runs on, week by week. This is the chart
 * beside the page, and it is why the page steps rather than climbs — the money
 * leaves in one week and buys nothing until another.
 *
 * READ, NOT RECKONED. It used to be the page's grade plus the bonus, which
 * skipped the auction's cap at 10, and it found the page's grade by taking this
 * week's bonus off this week's CAPPED figure, so once the cap bit the weeks
 * before the step came out low too: a page graded 9 with the top rung charted
 * 7, 7, 7, then 10. Played, a page graded 8 charted weeks 8-12 at 11, above the
 * chart's own scale. Each week is now simply the grade `grade` gives it.
 *
 * @param {object} block - the draft's `capexBlock`
 * @param {(block: object, round: number) => number|null} grade - as `pageParts` takes it
 * @returns {Array<{round: number, value: number}>} one per round of the game, or
 *   none for an account with no ad to grade, which has no page worth to draw
 */
export function pageWorth(block, grade) {
  if (grade(block, 1) === null) return [];
  return Array.from({ length: TOTAL_ROUNDS }, (_, i) => ({ round: i + 1, value: grade(block, i + 1) }));
}

/**
 * Grades run from 1 to 10 (the grader's scale, agents/grader.js). The whole
 * screen reads it from here — the grade bars and the worth chart both — so a
 * chart cannot be drawn against a different scale from the bars beside it.
 */
export const GRADE_TOP = 10;

/**
 * The worth chart's geometry: where the line sits, where it steps, and how far.
 *
 * IT LIVES HERE, NOT IN THE DRAWING MODULE, so that the two things the chart
 * promises can be held by a test rather than by eye. The first is that the
 * scale runs from nothing to the whole grade: starting it part way up makes a
 * two-point gain look like a fourfold one, which is the oldest way to mislead
 * with a picture and exactly the failure this game cannot afford. The second is
 * that a step is drawn on the week the grade actually steps.
 *
 * EVERYTHING IS A FRACTION of the plot, never a pixel, so the drawing module
 * owns the size and this owns the shape. `mid` and `at` run left to right
 * across the weeks; `y` runs up from the baseline, so 1 is the top of the scale.
 *
 * There can be more than one riser. Capital has two windows, round 1 and week 5
 * (`capexAllocationRounds`), so a page bought in both can step twice: ₹55,000
 * then ₹25,000 more steps +2 at week 4 and +1 at week 8. A purchase too small to
 * round to a point steps nothing, so a riser is drawn only where the grade moves.
 *
 * @param {Array<{round: number, value: number}>} worth - from `pageWorth`
 * @param {number} top - the highest grade the scale holds
 * @returns {{top: number, baseline: number,
 *   weeks: Array<{round: number, value: number, mid: number, y: number}>,
 *   flats: Array<{from: number, to: number, y: number}>,
 *   risers: Array<{round: number, at: number, from: number, to: number, points: number}>}}
 */
export function worthShape(worth, top) {
  const span = worth.length;
  const weeks = worth.map(({ round, value }, i) => ({
    round, value, mid: (i + 0.5) / span, y: value / top,
  }));
  const risers = [];
  const flats = [];
  let start = 0;
  for (const [i, week] of worth.entries()) {
    if (i === 0 || week.value === worth[i - 1].value) continue;
    // The grade holds its old value through the week before, so the step stands
    // at the START of the week it lands in, never between two readings.
    risers.push({
      round: week.round, at: i / span,
      from: worth[i - 1].value / top, to: week.value / top,
      points: week.value - worth[i - 1].value,
    });
    flats.push({ from: start / span, to: i / span, y: worth[i - 1].value / top });
    start = i;
  }
  flats.push({ from: start / span, to: 1, y: worth.at(-1).value / top });
  return { top, baseline: 0, weeks, flats, risers };
}

/**
 * @param {object} args
 * @param {object} args.draft - the weekly draft (ui/decisions.js, createDraft)
 * @param {object|undefined} args.creative - the player's creative block, from
 *   state (I16); missing in a save older than I11, which is read as the
 *   player's own words
 * @param {string} args.name - the player's brand, from the self view
 * @param {string} args.domain
 * @returns {{name: string, domain: string, headlines: string[], descriptions: string[],
 *   writer: {id: string, label: string, pricePaise: number, hired: boolean}, week: number,
 *   grades: Array<{key: string, value: number, later: {value: number, week: number, why: string}|null}>,
 *   page: {description: string, strips: object[]}}}
 */
export function adModel({ draft, creative, name, domain, position = null }) {
  const ad = draft.adGroups[0]?.ad ?? { headlines: [], descriptions: [], landingPageDescription: '' };
  // After the last week the draft looks at a week that never runs.
  const week = Math.min(draft.round, TOTAL_ROUNDS);
  const tierId = creative?.tier ?? 'diy';
  const tier = writerTier(tierId);
  const now = draft.gradedQuality ? gradesAt(draft, creative, week) : null;
  // The landing page grade the auction runs on, for any capital and any week:
  // one reading, capped as the auction caps it, for the grades, the rows and
  // the chart alike, so the three cannot disagree.
  const pageGrade = (block, round) => gradesAt({ ...draft, capexBlock: block }, creative, round)?.landingPage ?? null;
  const block = draft.capexBlock ?? {};
  // A game saved before the page was graded as it stands carries no mark, and its
  // description still counts everything committed from week 1 (I37).
  const describedFrom = draft.adGroups[0]?.pageBuiltFromCapital ? 'live' : 'committed';
  // And one saved before grading only what Google names keeps the length rule (C).
  const rules = rulesFor(draft.adGroups[0]);
  return {
    name,
    domain,
    headlines: [...ad.headlines],
    descriptions: [...ad.descriptions],
    // WHAT THE SHOP SELLS, from the player's own cell (content/product.js).
    // The page used to sell one fixed product to all nine brands in all six
    // cells, on the screen that is supposed to be YOUR shop — after round 0
    // spends five steps teaching that the cell decides everything.
    product: productFor(position ? `${position.price}|${position.purpose}` : ''),
    writer: { id: tierId, label: tier.label, pricePaise: tier.pricePaise, hired: !isDiy(tierId) },
    week,
    grades: now ? PARTS.map((key) => ({ key, value: now[key], later: firstChange(draft, creative, key, now[key], week) })) : [],
    page: {
      // What the grader reads in the week about to run. For a page built from
      // capital that is the page as it stands then, which game.js has not yet
      // written into the account if a tranche lands this very week.
      description: draft.adGroups[0]?.pageBuiltFromCapital
        ? pageAsItStands(block, week).description
        : ad.landingPageDescription ?? '',
      strips: pageStrips(block, week),
      parts: pageParts(block, week, pageGrade, { describedFrom, rules }),
      ...pageBreakdown(block, week, { describedFrom, rules }),
      worth: pageWorth(block, pageGrade),
      drawn: pageDrawn(block, week),
      // What went live THIS week, so the drawing can ring it (2026-09-19).
      fresh: pageArrived(block, week),
    },
  };
}
