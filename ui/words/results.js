/**
 * Every sentence and label of the Studio's Results area (design/results/,
 * chosen by the owner 2026-09-15): Twelve weeks, What you learned, Where they
 * sat and Everyone's books. The debrief's own lines (the lessons, the weeks
 * you changed something, both replays, the reveal's verdicts) are shared with
 * the classic end screen and stay in ./debrief.js; these are the four
 * sections' own.
 *
 * Two things the owner chose to say plainly (2026-09-15): net profit never
 * counts capital spent on the business, and the last weeks read high because
 * their returns come back after the game ends.
 */

import { line } from './line.js';

/** 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st. */
export function ordinal(n) {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th');
  return `${n}${suffix}`;
}

const listed = (items) => (items.length <= 1
  ? items.join('')
  : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

/** What a capital target is called in a sentence, by the engine's key. */
export const TARGET_WORDS = Object.freeze({
  sizeGuide: line('label', 'the size guide'),
  photography: line('label', 'photography'),
  landingPage: line('label', 'the landing page'),
  orderConfirmation: line('label', 'order confirmation'),
});

export const RESULTS = Object.freeze({
  next: line('instruction', ({ section }) => `Next: ${section} →`),

  // --- Twelve weeks --------------------------------------------------------
  netProfit: line('label', 'Net profit'),
  gross: line('label', ({ amount }) => `gross ${amount}`),
  spend: line('label', 'Spend'),
  clicks: line('label', ({ n }) => `${n} clicks`),
  conversions: line('label', 'Conversions'),
  cameBack: line('label', ({ n }) => `${n} came back`),
  netRevenue: line('label', 'Net revenue'),
  netRoas: line('label', 'Net ROAS'),
  netRoasSub: line('label', 'sales after returns, per rupee of clicks'),
  // The books settle the tail and count capital (the owner, 2026-09-18), so
  // where this panel used to say how many weeks had settled it says what the
  // business made: net profit less what was spent building it.
  made: line('label', 'What the business made'),
  madeSub: line('label', ({ amount }) => `net profit, less the ${amount} you built with`),
  madeNothingBuilt: line('label', 'net profit; you built nothing'),

  everyWeek: line('label', 'Every week'),
  chartNote: line('label', 'net profit by week, as it stands · the dashed tick is each week’s first report · tap a week'),
  changedKey: line('label', 'a week you changed something'),
  weekOf: line('label', ({ n }) => `Week ${n}`),
  weekSettled: line('label', 'settled: every conversion in, every return back'),
  firstReported: line('label', 'first reported'),
  now: line('label', 'now'),
  change: line('label', 'change'),
  noChange: line('label', 'no change'),
  whatYouDid: line('label', 'What you did'),
  didNothing: line('reading', 'Nothing: it ran on what you had already set.'),
  theWeek: line('label', 'The week'),
  weekRan: line('reading', ({ spent, clicks, shown, budget, rank }) =>
    `${spent} spent on ${clicks} clicks. You showed in ${shown} of the auctions you could enter, `
    + `and lost ${budget} to budget and ${rank} to rank.`),
  reports: line('reading', ({ first, now, weeks }) =>
    `The weeks’ first reports added up to ${first}; the same ${weeks} weeks stand at ${now} now. `
    + 'Every week you decided on was still moving.', { why: 'attributionLag' }),
  // The last weeks used to read high and say so. The books settle them instead
  // (the owner, 2026-09-18): what was in flight at the whistle is counted where
  // its clicks earned it, so the weeks are finished rather than provisional.
  settledAtEnd: line('reading', ({ sales, window }) =>
    `The ${sales} sales still arriving when the game ended are counted here, in the weeks whose clicks bought them, `
    + `and so are the returns they earned ${window} weeks later. Nothing is left provisional.`,
  { why: 'returnsSplit' }),

  built: line('label', 'What you built'),
  tranche: line('reading', ({ amount, target, round, live }) => (round === 0
    ? `${amount} on ${target} in round ${round}, live from week ${live}.`
    : `${amount} on ${target} at week ${round}, live from week ${live}.`)),
  rest: line('reading', ({ amount }) => `The other ${amount} of the two allocations went into your ad budget.`),
  allBudget: line('reading', ({ amount }) => `You built nothing: both allocations, ${amount}, went into your ad budget.`),
  // Net profit charges clicks and freight and never capital (engine/report.js),
  // so the books take it off themselves (the owner, 2026-09-18): an advertiser
  // who kept the money had it turned into ad budget and was charged for the
  // clicks it bought, and one who built with it used to pay nothing at all.
  capitalOff: line('disclosure', ({ amount, net, made }) =>
    `Your weekly net profit counts what clicks cost, never capital. The books take the ${amount} you built with `
    + `off it: ${net} less ${amount} is ${made}, and that is where you are ranked.`, { why: 'counterfactuals' }),
  realMarket: line('label', 'Against a real market'),

  // --- What you learned ----------------------------------------------------
  didNotTry: line('label', 'you didn’t try this'),
  numbersMoveCaption: line('label', ({ round }) => `week ${round}’s net profit, first reported and now`),
  rankOrBudgetCaption: line('label', ({ round, kind }) => `of week ${round}’s impressions lost to ${kind}`),
  broadMatchCaption: line('label', 'different searches bought that no keyword spelled out'),
  returnsCaption: line('label', ({ rank, grossRank }) =>
    `of your gross profit · ${ordinal(rank)} on net profit, ${ordinal(grossRank)} on gross`),
  ownNameCaption: line('label', 'a click on your name · on everything else'),
  shownShare: line('label', ({ share }) => `${share} shown`),
  budgetShare: line('label', ({ share }) => `${share} lost to budget`),
  rankShare: line('label', ({ share }) => `${share} lost to rank`),
  // A capital week's answer, with what the capital cost counted (the review,
  // 2026-09-15): the replay without it spent the money on clicks, which net
  // profit charges; the capital itself it never charges.
  capitalCounted: line('reading', ({ amount, targets, sign, gap }) => {
    const verdict = sign > 0 ? `the game without it ends ${gap} ahead`
      : (sign < 0 ? `your game still ends ${gap} ahead` : 'the two end level');
    return `Net profit never counts the ${amount} spent on ${listed(targets)}, only what clicks cost. Counting it, ${verdict}.`;
  }),
  stripLost: line('label', 'ran out; the rest of the month would have lost money'),
  stripEven: line('label', 'ran out; it would about have broken even'),
  stripPaid: line('label', 'ran out; it would have paid for itself'),
  stripNothing: line('label', 'ran out with none of its month left'),
  stripLeft: line('label', 'money left over'),

  // --- Where they sat ------------------------------------------------------
  introKept: line('instruction', ({ noted, rest, round }) => {
    if (noted === 0) return `You noted none of them at round ${round}. Place each one from its ad alone, then see where they really sat.`;
    if (rest === 0) return `At round ${round} you noted where all ${noted} sit, from their ads alone. See where they really sat.`;
    return `At round ${round} you noted where ${noted} of them sit, from their ads alone. Place the other ${rest} now, then see where they really sat.`;
  }),
  notedTag: line('label', ({ round }) => `noted at round ${round}`),
  nowTag: line('label', 'place it now'),
  placed: line('label', ({ placed, total }) => `${placed} of ${total} placed · tap a small grid to place a rival`),
  exactly: line('label', ({ cell }) => `Exactly right: ${cell}.`),
  missed: line('label', ({ how, said, cell }) => `${how}: you said ${said}, it was ${cell}.`),
  missedNoted: line('label', ({ how, said, cell }) => `${how}: you noted ${said}, it was ${cell}.`),
  notGuessed: line('label', ({ cell }) => `Not guessed: it was ${cell}.`),
  itWas: line('label', ({ cell }) => `It was ${cell}.`),
  scoreThen: line('reading', ({ exact, half, of, round }) =>
    `Of the ${of} you noted at round ${round}, you read ${exact} exactly and ${half} more half right.`),
  scoreNow: line('reading', ({ exact, half, of, placed }) => (placed === 0
    ? `You placed none of the other ${of}.`
    : `Of the other ${of}, you placed ${placed}: ${exact} exactly right and ${half} half right.`)),
  // Sharing a cell is not meeting most (the review, 2026-09-15).
  metMost: line('reading', ({ name, rate }) =>
    `Yet ${name}, in another cell, met you most: in ${rate} of the auctions you showed in, week by week on average.`),

  // --- Everyone's books ----------------------------------------------------
  booksTitle: line('label', 'You will never see this in a real account.'),
  booksWarning: line('disclosure',
    'For twelve weeks you saw your rivals as a real account does: their ads, and how often you met them in '
    + 'auctions. A real account never shows a competitor’s spend, conversions or profit. This page does, only '
    + 'because the game is over and nothing here can change a decision now. Read it as the answer sheet, not '
    + 'as a report.', { why: 'counterfactuals' }),
  colBrand: line('label', 'Brand'),
  colCell: line('label', 'Where they sat'),
  colBars: line('label', 'Net profit, with gross profit as the outline'),
  colNet: line('label', 'What the business made'),
  colReturns: line('label', 'Returns took'),
  colGross: line('label', 'Rank on gross'),
  you: line('label', 'You'),
  hidden: line('label', 'hidden'),
  brandLine: line('label', ({ spent, conversions, each, roas, gross, net, built }) =>
    `spent ${spent} · ${conversions} conversions, ${each} each · ${roas} of sales after returns per rupee of clicks `
    + `· gross profit ${gross} · net profit ${net} before the ${built} it built with`),
  booksNote: line('reading', ({ month, snapshot }) =>
    'Ranked by what each business made: sales after returns, less the goods, the clicks, the freight on parcels '
    + 'refused at the door, and the capital it spent building. The outline is gross profit, which counts an order '
    + `that came back as a sale; month ${month}’s budgets were split on gross, at week ${snapshot}.`,
  { why: 'returnsSplit' }),
  booksSettled: line('reading',
    'Every brand’s books are settled the same way: the sales still arriving when the game ended are counted in the '
    + 'weeks whose clicks bought them, and so are the returns they earned afterwards.'),
  cellsHidden: line('reading', 'Where each of them sat stays hidden here until you answer Where they sat.'),
  finished: line('label', 'Where you finished'),
  rankAtSnapshot: line('label', ({ week }) => `at week ${week}, on gross profit as reported then`),
  rankGross: line('label', 'at the end, on gross profit'),
  rankNet: line('label', 'at the end, on net profit'),
  // A COMPARISON THAT IS YOUR OWN FIGURE IS NOT A COMPARISON. Finishing 9th of
  // nine, this read "9th gave you ₹1,17,600, where the middle place got
  // ₹1,68,000, first ₹2,18,400 and last ₹1,17,600" — the last clause handing
  // the player their own number back as though it were somebody else's. Found
  // playing it from last place, 2026-09-19, which is where a beginner lands.
  monthThree: line('reading', ({ month, snapshot, place, amount, middle, first, last }) => {
    const others = [['the middle place', middle], ['first', first], ['last', last]]
      .filter(([, sum]) => sum !== amount)
      .map(([name, sum], i) => `${name}${i === 0 ? ' got' : ''} ${sum}`);
    return `Month ${month}’s budgets were set by the week-${snapshot} ranking: `
      + `${ordinal(place)} gave you ${amount}`
      + (others.length > 0 ? `, where ${listed(others)}.` : '.');
  }),
  traps: line('reading', ({ snapshot }) =>
    'Both halves of that ranking were traps. Gross profit does not net off returns, so traffic that converts well '
    + 'and comes straight back flattered it. And attribution had not caught up, so a click in week '
    + `${snapshot} showed all of its cost against about half of its revenue: spending hard into the deadline made `
    + 'you look worse, not better.', { why: 'attributionLag' }),
  playAgain: line('label', 'Play again'),
  startAnother: line('instruction', 'Start another game'),
  sameMarket: line('label', 'Same market'),
  sameWhy: line('reading', 'The same eight rivals in the same cells. The only way to find out whether a result '
    + 'came from your decisions or from the market you happened to get.'),
  newMarket: line('label', 'A new market'),
  newWhy: line('reading', ({ round }) => `Different rivals in different cells, so the eight ads at round ${round} say `
    + 'something else. Whether what you learned here transfers is a harder question than whether you can beat this '
    + 'board again.'),
  restartWarn: line('reading', 'Either one throws this game away: there is no going back to it. Read the rest first.'),
});
