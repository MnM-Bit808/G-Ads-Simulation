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
 * @returns {string}
 */
const eachStep = (steps) => steps
  .map(({ points, week }, i) => (i === 0 ? `${points} from week ${week}` : `${points} more from week ${week}`))
  .join(' and ');

/** What to call a target nothing has been spent on, which has no page label yet. */
const PART_NAME = Object.freeze({
  landingPage: 'The page itself',
  sizeGuide: 'A size chart',
  photography: 'Product shots',
});

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
  // Three purchases, three mechanisms: the sentences exist so the screen cannot
  // imply that any of them but the page itself moves the grade.
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
  toGrade: line('label', ({ points }) => `+${points} on the landing page grade`),
  fewerBack: line('label', ({ percent }) => `${percent} fewer orders sent back`),
  moreSales: line('label', ({ percent }) => `${percent} more sales for the same clicks`),
  noGrade: line('label', 'nothing on the grade'),
  notBought: line('label', 'not bought'),
  wouldReturns: line('label', 'would buy fewer orders sent back'),
  wouldSales: line('label', 'would buy more sales per click'),
  liveWeek: line('label', ({ week }) => `live from week ${week}`),
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
  stepNote: line('reading', ({ graded, steps }) => `Your page was graded ${graded} on its own words. `
    + `The site work adds ${eachStep(steps)}, when ${steps.length > 1 ? 'each goes' : 'it goes'} live — `
    + 'the money leaves the week you commit it, and the page is unchanged until then.'),
  onlyPage: line('disclosure', 'Only the page itself moves the grade. A size guide buys fewer orders sent back, and '
    + 'photography buys more sales for the same clicks — both worth money, neither worth a point of Quality Score.',
  { why: 'qualityScore' }),
});
