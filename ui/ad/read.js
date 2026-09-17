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
import { writerTier, isDiy } from '../../content/writers.js';
import { effectiveGrades } from '../decisions.js';
import { pageShape } from '../landing-page.js';
import { tiersFunded, pageAsItStands, PAGE_FEATURES } from '../../content/landingPage.js';
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
 * THE GRADE POINTS ARE WHAT THE AUCTION GAINS, not the bonus the capital earns.
 * The auction caps the landing page grade at 10 (round.js, `withLandingBonus`),
 * so a page graded 9 with the top rung gains 1, not 3. This row used to add the
 * bonus uncapped and said "+3". So the points are asked of `grade` — the same
 * capped reading the rest of the screen uses — with the capital and without it.
 *
 * AND ITS WEEKS ARE THE WEEKS THE GRADE MOVES (`steps`), not the week the last
 * purchase lands (`week`, which the drawn page still reads, since that is when
 * the site work appears). They part company twice. A page bought in both capital
 * windows can step twice, and one week cannot say so. And a purchase the cap
 * leaves nothing to add still lands: ₹55,000 at round 0 and ₹25,000 at week 5,
 * on a page graded 8, gained all of its +2 at week 4, yet read "live from week 8".
 *
 * @param {object} block - the draft's `capexBlock`
 * @param {number} round
 * @param {(block: object, round: number) => number|null} grade - the landing page
 *   grade the auction runs on in `round` with that capital (`effectiveGrades`),
 *   or null for an account with no ad to grade
 * @returns {Array<{target: string, label: string|null, bought: boolean, paise: number,
 *   week: number|null, moves: 'grade'|'returns'|'conversions', points: number, lift: number,
 *   steps: Array<{week: number, points: number}>, wouldAdd: {paise: number, points: number}|null}>}
 *   in the order the page draws them; `points` is grade points, `lift` the
 *   multiplier the other two apply, 1 when nothing is bought; `steps` the weeks
 *   after `round` in which the grade still moves, and by how much — empty for the
 *   two that move no grade, and once the grade has finished moving; `wouldAdd`,
 *   for an unbought page only, the cheapest rung that adds grade to this account
 */
export function pageParts(block, round, grade) {
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
  const gained = (withCapital) => pageAdds(withCapital, round);
  // The weeks the PAGE's part of the grade moves, from the same capped weekly
  // grades the chart is drawn from, so the row cannot name a week the chart does
  // not step in. A step in `round` itself is already counted in `now`: that is
  // the week about to run.
  // WHAT AN UNBOUGHT PAGE WOULD ADD: the cheapest rung that adds anything to THIS
  // account, and how much. Not "it would raise the grade": the cheapest rung earns
  // its point only by lengthening the description, which a size chart or product
  // shots may already have done — beside a ₹25,000 size guide it adds nothing, and
  // ₹55,000 is the first to add, 3. Measured on the page as it stands (2026-09-17).
  const wouldAdd = (committed.landingPage ?? 0) > 0 ? null : PAGE_FEATURES.landingPage
    .map((tier) => tier.paise)
    .filter((paise) => paise > 0)
    .map((paise) => ({ paise, points: pageAdds({ ...settled, committed: { ...committed, landingPage: paise } }, round) }))
    .find((rung) => rung.points > 0) ?? null;
  const ownWorth = pageWorth(block, grade).map(({ round: r }) => ({ round: r, value: pageAdds(block, r) }));
  const steps = ownWorth.length === 0 ? [] : worthShape(ownWorth, GRADE_TOP).risers
    .filter((riser) => riser.round > round)
    .map((riser) => ({ week: riser.round, points: riser.points }));

  return PAGE_PARTS.map((target) => {
    const paise = committed[target] ?? 0;
    const waiting = pending(target);
    const live = liveCapexPaise(block, target, round);
    return {
      target,
      label: label.get(target) ?? null,
      bought: paise > 0,
      paise,
      week: waiting.length > 0 ? Math.max(...waiting.map((p) => p.liveAtRound)) : null,
      moves: MOVES[target],
      // The page's row carries what the page's own capital adds: its sentences and
      // its site work's points. The other two rows claim no grade yet; how to show
      // what their sentences add is the owner's design to come.
      points: target === 'landingPage' ? gained(settled) : 0,
      now: target === 'landingPage' ? gained(block) : capexEffect(live, target),
      lift: target === 'landingPage' ? 1 : capexEffect(paise, target),
      steps: target === 'landingPage' ? steps : [],
      wouldAdd: target === 'landingPage' ? wouldAdd : null,
    };
  });
}

/**
 * The rungs the drawn page shows as pictures: the stars are the reviews, and
 * the chart is the size guide's first rung (content/landingPage.js, PAGE_FEATURES).
 * Named by label because that ladder names them; a test holds that both labels
 * are rungs the ladder has, so renaming one fails rather than drawing nothing.
 */
export const DRAWN_RUNGS = Object.freeze({
  stars: Object.freeze({ target: 'landingPage', label: 'reviews' }),
  sizeChart: Object.freeze({ target: 'sizeGuide', label: 'a chart' }),
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
 * @param {object} block - the draft's `capexBlock`
 * @param {number} round
 * @returns {{stars: boolean, sizeChart: boolean}}
 */
export function pageDrawn(block, round) {
  const live = ({ target, label }) => tiersFunded(target, liveCapexPaise(block, target, round))
    .some((tier) => tier.label === label);
  return { stars: live(DRAWN_RUNGS.stars), sizeChart: live(DRAWN_RUNGS.sizeChart) };
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
export function adModel({ draft, creative, name, domain }) {
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
  return {
    name,
    domain,
    headlines: [...ad.headlines],
    descriptions: [...ad.descriptions],
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
      parts: pageParts(block, week, pageGrade),
      worth: pageWorth(block, pageGrade),
      drawn: pageDrawn(block, week),
    },
  };
}
