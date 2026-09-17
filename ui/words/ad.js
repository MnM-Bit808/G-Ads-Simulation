/**
 * The weekly Your ad's words (the owner's call, 2026-09-15). Read-only: the
 * ad is written once, in round 0, and runs as it is (I9). The part names are
 * the ones the keyword card's Quality Score uses, so the two read alike.
 */

import { line } from './line.js';

/**
 * Every step the grade takes, read aloud: "2 from week 4", or "1 from week 4
 * and 2 more from week 8". There are at most two, because capital has two
 * windows (`capexAllocationRounds`).
 *
 * @param {Array<{points: number, week: number}>} steps - in the order they land
 * @param {boolean} [started] - some of the gain is live already, so even the
 *   first step still to come is "more"
 * @returns {string}
 */
const eachStep = (steps, started = false) => steps
  .map(({ points, week }, i) => (i === 0 && !started ? `${points} from week ${week}` : `${points} more from week ${week}`))
  .join(' and ');

/** What to call a target nothing has been spent on, which has no page label yet. */
const PART_NAME = Object.freeze({
  landingPage: 'The page itself',
  sizeGuide: 'A size chart',
  photography: 'Product shots',
});

/** The same, mid-sentence, for the purchases that share a point. */
const SHARER = Object.freeze({
  landingPage: 'the page itself',
  sizeGuide: 'a size chart',
  photography: 'product shots',
});

/**
 * Each of the grader's landing page rules (content/landingPage.js), and the site
 * work's points, as a row says them (design/grade-breakdown/, B).
 *
 * The site work's points are NOT called "the site work" on screen. Round 0 and
 * Your money use that for everything capital builds, and so do this screen's note
 * and legend, while these points come from the page's own capital alone. It read
 * "+2 the site work" for a day, and beside a note saying product shots were site
 * work too, the same words named two things (the owner's call, 2026-09-17).
 */
const RULE_NAME = Object.freeze({
  // Grading only what Google names (C, 2026-09-17): the faster page's own sentence,
  // word for word. "The page is described" stays for games saved before it.
  speed: 'it loads quickly on a phone',
  described: 'the page is described',
  sizing: 'it mentions sizing',
  reviews: 'it mentions reviews',
  barely: 'there is barely a description',
  siteWork: 'the work on the page',
});

/** A point with its sign: a lost one carries a minus, never colour alone. */
const signed = (points) => (points < 0 ? `−${Math.abs(points)}` : `+${points}`);

/** "a, b or c": the purchases that each earn a shared point alone. */
const eitherOf = (targets) => {
  const names = targets.map((target) => SHARER[target]);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names.at(-1)}` : names.join('');
};

export const AD = Object.freeze({
  intro: line('reading', ({ week }) => `Written once, before week ${week}. It runs every week as it is.`),
  asSearchersSee: line('label', 'As searchers see it'),
  sponsored: line('label', 'Sponsored'),
  whoWrote: line('label', 'Who wrote it'),
  you: line('label', 'You'),
  fee: line('label', ({ amount, budget }) => `${amount} of the ${budget} creative budget`),
  free: line('label', ({ budget }) => `free · the ${budget} creative budget went to your ads`),
  hired: line('disclosure', 'A hired writer’s ad runs at the writer’s level, whatever the words say.',
    { why: 'writers' }),
  own: line('disclosure', 'Scored by the game’s own grader, on your words.', { why: 'writers' }),
  gradesTitle: line('label', ({ week }) => `How it grades in week ${week}`),
  expectedCtr: line('label', 'Expected CTR'),
  adRelevance: line('label', 'Ad relevance'),
  landingPage: line('label', 'Landing page'),
  outOf: line('label', ({ value, scale }) => `${value}/${scale}`),
  laterPage: line('reading', ({ part, value, week }) => `${part} ${value} from week ${week}, when the site work `
    + 'goes live.'),
  laterCopy: line('reading', ({ part, value, week }) => `${part} ${value} from week ${week}, when your own `
    + 'words go live.'),
  qsNote: line('reading', 'Each keyword’s Quality Score rates these against the other advertisers on its search.',
    { why: 'qualityScore' }),
  pageTitle: line('label', 'Your landing page'),
  quoted: line('label', ({ text }) => `“${text}”`),
  pageRead: line('label', 'what the grader read'),
  stripAt: line('label', ({ label, week }) => `${label} · week ${week}`),
  stripFrom: line('label', ({ from, label, week }) => `${from} → ${label} · week ${week}`),

  // The page drawn as a page (design/landing-page/, C, the owner 2026-09-16).
  // Capital reaches the landing page grade by two roads: the page description,
  // which round 0 writes from ALL of it and the grader scores from week 1, and
  // the site work's points from the page's own capital (`landingPageBonus`). A
  // row's grade points are the second road only, and say so.
  // The page's own furniture. The price is the account's OWN average order
  // (`aovMeanPaise`), not a number typed to look like a shop: a figure on this
  // screen that no part of the game produced would be read as one that is.
  // The stars carry no count for the same reason — an invented "412 reviews"
  // beside real grades is decoration pretending to be data.
  product: line('label', 'High-waisted training leggings'),
  price: line('label', ({ amount }) => amount),
  reviewCount: line('label', 'reviews'),
  sizeChart: line('label', 'Size chart'),
  partName: line('label', ({ target }) => PART_NAME[target]),
  boughtTitle: line('label', 'What each one buys'),
  worthTitle: line('label', 'What the page is worth'),
  worthSub: line('label', 'the landing page grade the auction uses'),
  gradedOn: line('label', 'Graded on its words'),
  withWork: line('label', ({ week }) => `With the site work, from week ${week}`),
  // WHERE THE GRADE COMES FROM (design B, the owner's choice, 2026-09-17). A row
  // once said "+3 on the landing page grade, from the site work" while the chart
  // stepped +5, and nothing said where the other two came from. Each row now names
  // the rules its own sentences earn; the point more than one earns alone is
  // shared, out loud; and the total says when the grade stops at ten.
  gradeRule: line('label', ({ rule, points }) => `${signed(points)} ${RULE_NAME[rule]}`),
  noOwnPoint: line('label', 'no grade point of its own'),
  sharedHead: line('label', 'shared'),
  sharedWhy: line('reading', ({ rule, at, targets }) => (rule === 'described'
    ? `Its words run past ${at} characters, which ${eitherOf(targets)} would each have done alone.`
    : `Each of ${eitherOf(targets)} would have earned it alone.`)),
  sumStart: line('label', ({ start, parts }) => `${start} to start, ${parts.map(signed).join(' ')}`),
  sumScale: line('label', ({ top }) => `/${top}`),
  sumStops: line('label', ({ top }) => `the grade stops at ${top}`),
  sumFrom: line('label', ({ week }) => `from week ${week}`),
  fewerBack: line('label', ({ percent }) => `${percent} fewer orders sent back`),
  moreSales: line('label', ({ percent }) => `${percent} more sales for the same clicks`),
  noGrade: line('label', 'nothing on the grade'),
  notBought: line('label', 'not bought'),
  wouldReturns: line('label', 'would buy fewer orders sent back'),
  wouldSales: line('label', 'would buy more sales per click'),
  // The page buys grade, and its row used to say it would buy sales per click.
  // It names the cheapest amount that adds anything to this account, because the
  // cheapest rung adds nothing beside a size chart or product shots (read.js).
  wouldGrade: line('label', ({ amount, points }) => `${amount} would add ${points} to the landing page grade`),
  liveWeek: line('label', ({ week }) => `live from week ${week}`),
  // The page row's weeks are the weeks the GRADE moves (read.js, `steps`), in
  // the words the note under the chart uses. One step with nothing live yet
  // reads as it always did; anything else lists what is still to come, since a
  // single week would overstate the first step or hide it.
  gradeWeeks: line('label', ({ steps, started }) => (steps.length === 1 && !started
    ? `live from week ${steps[0].week}`
    : eachStep(steps, started))),
  liveNow: line('label', 'live'),
  drawn: line('reading', 'The page is drawn from what your capital bought. Nothing here is a photograph of a '
    + 'real product.'),
  gained: line('label', ({ points }) => `+${points}`),
  liveDot: line('label', 'the site work goes live'),
  // Not "the week you are playing": the header counts weeks played, so beside
  // "Week 2 of 12" that ringed week 3 and read as a contradiction. The grades
  // here are the ones the NEXT week runs on, and the button says "Run week 3".
  nowDot: line('label', 'the week you run next'),
  // No week is typed here on purpose: capital can be committed in either
  // window, so "the money leaves in week 1" is false for anything bought at
  // week 5. The words guard caught that.
  //
  // IT READS EVERY STEP, not one. Capital has two windows, so a page bought in
  // both can step twice, and naming the total points and the last week alone
  // said the grade was unchanged through weeks it had already risen in.
  // "Its description", not "its own words": round 0 writes that description
  // from the capital, so the grade it gets already counts what the capital bought.
  stepNote: line('reading', ({ graded, steps }) => `Your page’s description was graded ${graded}. `
    + `The site work adds ${eachStep(steps)}, when ${steps.length > 1 ? 'each goes' : 'it goes'} live — `
    + 'the money leaves the week you commit it, and the page is unchanged until then.'),
});
