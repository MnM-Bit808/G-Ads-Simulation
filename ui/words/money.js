/**
 * Your money's words (design/your-money/, chosen by the owner 2026-09-15). The
 * strategies, the capital targets and the warnings keep the decision form's
 * own words (ui/decisions.js), which the classic look still prints until the
 * switch-over; every figure arrives as a figure, never typed.
 */

import { line } from './line.js';

const weeks = (n) => (n === 1 ? `${n} week` : `${n} weeks`);

/** "1st", "2nd", "3rd", "4th"... */
function ordinal(n) {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  if (n % 10 === 1) return `${n}st`;
  if (n % 10 === 2) return `${n}nd`;
  if (n % 10 === 3) return `${n}rd`;
  return `${n}th`;
}

export const MONEY = Object.freeze({
  // This week only: capital, and the one chance to move.
  windowTitle: line('label', 'This week only'),
  windowBoth: line('label', 'capital to invest, and your one chance to move'),
  windowCapital: line('label', 'capital to invest'),
  windowMove: line('label', 'your one chance to move'),
  capitalHead: line('label', ({ amount }) => `Capital · ${amount}, and it does not carry forward`),
  targetName: Object.freeze({
    landingPage: line('label', 'The page itself'),
    sizeGuide: line('label', 'Size guide'),
    photography: line('label', 'Photography'),
    orderConfirmation: line('label', 'Order confirmation'),
  }),
  targetWhy: Object.freeze({
    landingPage: line('reading', 'Better quality, so a cheaper click. Worth most in the middle.'),
    // Its chart earns a point of the landing page grade as well, which this card
    // used to leave out (the owner, 2026-09-18; round 0's card said the same).
    sizeGuide: line('reading', 'Fewer parcels sent back after delivery. Worth most at the cheap end, and to '
      + 'anything sold on how it looks. The chart it puts on the page earns a point of the landing '
      + 'page grade too.'),
    photography: line('reading', 'More of your visitors buy. Worth most where the decision is considered.'),
    orderConfirmation: line('reading', 'Fewer parcels refused at the door. Worth most where cash on delivery is '
      + 'commonest, which is the cheap end and the small towns.'),
  }),
  now: line('label', ({ rung }) => `now: ${rung}`),
  chip: line('label', ({ rung, amount }) => `${rung} · ${amount}`),
  // A chip whose money reaches no new rung says so, as the classic card does (I15).
  noChange: line('label', 'no change'),
  toBusiness: line('label', ({ amount, week }) => `${amount} to the business, live in week ${week}`),
  joinsAds: line('label', ({ amount }) => `${amount} joins this month’s ads`),
  capitalNote: line('reading', 'What you commit is added to what is already built, which is why each chip names '
    + 'the rung it reaches. Spread thin, it buys half-built things that help nobody.'),
  positionHead: line('label', ({ amount }) => `Position · one step, once, for ${amount}`),
  cellName: line('label', ({ price, purpose }) => `${price} · ${purpose}`),
  cellEconomics: line('label', ({ order, margin }) => `${order} order · ${margin} margin`),
  cellSearches: line('label', ({ searches }) => `${searches} searches a week`),
  youAreHere: line('label', 'you are here'),
  tooFar: line('label', 'more than one step'),
  moveNote: line('reading', ({ amount }) => `Moving takes ${amount} from this month and restarts the learning period. `
    + 'Your site work survives; every keyword you replace starts with no Quality Score.'),
  positionNote: line('reading', 'Price sets what a click can be worth to you. Purpose sets which searches are '
    + 'yours. One step is a repricing a real brand could run in a month.'),
  landsOn: line('label', 'What they would land on'),
  yourProduct: line('label', 'your product'),

  // The month, one bar.
  monthHead: line('label', ({ month, amount }) => `Month ${month} · ${amount} to advertise`),
  monthWindow: line('reading', ({ base, joins, move }) => `${base} for the month`
    + (joins ? `, and the ${joins} of capital you have not committed` : '')
    + (move ? `, less ${move} for the move` : '')),
  monthLeft: line('reading', ({ left, from, to }) => (from === to
    ? `${left} left for week ${from}` : `${left} left for weeks ${from} to ${to}`)),
  dragHint: line('instruction', 'drag a line between two weeks to move money between them', { why: 'weeklySplit' }),
  weekName: line('label', ({ week }) => `week ${week}`),
  weekSpent: line('label', 'spent'),
  weekNext: line('label', 'about to run'),
  weekPlanned: line('label', 'planned'),
  weekFigure: line('label', ({ amount, state }) => `${amount} · ${state}`),
  unplanned: line('label', 'not planned'),
  unplannedNote: line('reading', ({ amount }) => `${amount} is not planned for any week: it is lost when the month `
    + 'ends unless you drag it into one.'),
  overNote: line('reading', ({ amount }) => `This plans ${amount} more than is left in the month. The month is a `
    + 'hard cap, so the last weeks would go dark.'),
  lostAtEnd: line('reading', 'Unspent money is lost when the month ends: there is no carry-over.'),
  moveLineLabel: line('label', ({ from, to }) => `Move money between week ${from} and week ${to}`),
  lastLineLabel: line('label', ({ week }) => `Move money between week ${week} and what is not planned`),
  lineValue: line('label', ({ week, amount, next, rest }) => `week ${week} ${amount}, ${next} ${rest}`),

  // Bidding.
  biddingTitle: line('label', 'Bidding'),
  biddingSub: line('label', 'how your bid is decided, every hour', { why: 'smartBidding' }),
  strategyName: Object.freeze({
    manual: line('label', 'Manual CPC'),
    maxClicks: line('label', 'Maximise clicks'),
    maxConv: line('label', 'Maximise conversions'),
    targetCpa: line('label', 'Target CPA'),
    targetRoas: line('label', 'Target ROAS'),
  }),
  strategyWhat: Object.freeze({
    manual: line('reading', 'Bids exactly what you set, every hour, whatever the data says.'),
    maxClicks: line('reading', 'Buys as much traffic as the budget allows. It does not care what converts.'),
    maxConv: line('reading', 'Like maximise clicks, but leaning toward the hours its history says convert.'),
    targetCpa: line('reading', 'Bids for a cost per conversion you name, from what it has learned converts.'),
    targetRoas: line('reading', 'Bids for a return on ad spend you name, using your own order value.'),
  }),
  cpaHint: line('reading', ({ amount }) => `You have paid ${amount} a conversion over the weeks played.`),
  cpaNone: line('reading', 'You have no conversions yet to compare this against.'),
  roasHint: line('reading', ({ roas }) => `Your net return last week was ${roas}, and it is still being revised.`),
  bidShows: line('reading', ({ strategy, bid, keyword, need }) => `${strategy} bids about ${bid} at best, on `
    + `${keyword}. Your quality needs ${need} to appear at all, so this shows.`),
  bidNowhere: line('reading', ({ strategy, bid, keyword, need }) => `This shows nowhere: ${strategy} bids ${bid} `
    + `at best on ${keyword}, and your quality needs ${need} to appear at all. Raising a keyword bid will not `
    + 'fix it: this strategy sets its own bid, well under that ceiling.'),
  observed: line('reading', ({ conversions, rate }) => `Seen so far: ${conversions} conversions, a ${rate} rate.`),
  learningNow: line('reading', ({ n }) => `Learning: ${weeks(n)} more, and its guesses at what converts are much `
    + 'wider while it lasts, including for the week just played.', { why: 'smartBidding' }),
  learningPredicts: line('reading', ({ n }) => `This restarts the learning period: for ${weeks(n)} its guesses at `
    + 'what converts are much wider while the bid model re-learns.', { why: 'smartBidding' }),
  learningFree: line('reading', ({ n, strategy }) => `This still starts a ${n}-week learning period, but it costs `
    + `${strategy} nothing: it never predicts conversions.`, { why: 'smartBidding' }),
  ceiling: line('reading', ({ times }) => `Your keyword bids stay the ceiling: no strategy bids more than ${times} `
    + 'times what you set on a keyword.'),

  // What week 8 decides.
  deadlineTitle: line('label', ({ week }) => `What week ${week} decides`),
  counted: line('reading', ({ amount, from, to }) => `${amount} gross profit counted, weeks ${from} to ${to}`),
  countedNone: line('reading', 'Nothing counted yet: the first week has not run.'),
  weeksLeft: line('label', ({ n, week }) => `${weeks(n)} left · week ${week} is the cut-off`),
  ladderHead: line('label', ({ month }) => `Where you finish sets month ${month}`),
  finish: line('label', ({ n }) => ordinal(n)),
  average: line('label', 'average'),
  versus: line('label', ({ percent, up }) => (up ? `+${percent}` : `−${percent}`)),
  ladderNote: line('reading', ({ gap, month, week }) => `${gap} separates first from last in month ${month}, on a `
    + `pool that does not change size. At week ${week} you learn your own rank, and nobody else’s.`),
  rankedSame: line('reading', ({ week, position, of, month, amount }) => `You finished week ${week} ranked ${position} `
    + `of ${of} on gross profit, so month ${month} is the same ${amount} as the months before it.`),
  rankedMore: line('reading', ({ week, position, of, month, amount, usual }) => `You finished week ${week} ranked `
    + `${position} of ${of} on gross profit, so month ${month} is ${amount}, more than the ${usual} before it.`),
  rankedLess: line('reading', ({ week, position, of, month, amount, usual }) => `You finished week ${week} ranked `
    + `${position} of ${of} on gross profit, so month ${month} is ${amount}, less than the ${usual} before it.`),
});
