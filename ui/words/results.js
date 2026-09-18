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
  settled: line('label', 'Settled'),
  settledWeeks: line('label', ({ n, of }) => `${n} of ${of} weeks`),
  stillMoving: line('label', ({ from, to }) => `weeks ${from} to ${to} still moving`),

  everyWeek: line('label', 'Every week'),
  chartNote: line('label', 'net profit by week, as it stands · the dashed tick is each week’s first report · tap a week'),
  changedKey: line('label', 'a week you changed something'),
  notSettled: line('label', 'not settled: returns still to come'),
  weekOf: line('label', ({ n }) => `Week ${n}`),
  weekSettled: line('label', 'settled: every conversion in, every return back'),
  weekReturnsToCome: line('label', 'returns still to come'),
  weekArriving: line('label', ({ n }) => `${n} conversions still to arrive, and returns to come`),
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
  // The last weeks read HIGH, not merely unfinished (the review, 2026-09-15).
  readHigh: line('reading', ({ weeks, arriving, pending, window, cutoff, none }) => {
    let still = '';
    if (arriving.length === 1) still = `Week ${arriving[0]} still has ${pending} conversions to arrive, but `;
    else if (arriving.length > 1) still = `Weeks ${arriving[0]} to ${arriving.at(-1)} still have ${pending} conversions to arrive, but `;
    const tail = `a return comes back ${window} weeks after its sale lands, so nothing sold after week ${cutoff} comes `
      + `back inside the game: ${none} count no returns at all.`;
    const opening = `The last ${weeks} weeks are not settled, and they read high.`;
    const rest = still ? still + tail : tail.charAt(0).toUpperCase() + tail.slice(1);
    return `${opening} ${rest}`;
  }, { why: 'returnsSplit' }),
  weeksNamed: line('label', ({ list }) => (list.length === 1 ? `week ${list[0]}` : `weeks ${listed(list)}`)),

  built: line('label', 'What you built'),
  tranche: line('reading', ({ amount, target, round, live }) => (round === 0
    ? `${amount} on ${target} in round ${round}, live from week ${live}.`
    : `${amount} on ${target} at week ${round}, live from week ${live}.`)),
  rest: line('reading', ({ amount }) => `The other ${amount} of the two allocations went into your ad budget.`),
  allBudget: line('reading', ({ amount }) => `You built nothing: both allocations, ${amount}, went into your ad budget.`),
  // Net profit charges clicks and freight, never capital (engine/report.js).
  notCounted: line('disclosure', ({ amount }) =>
    `Net profit counts what clicks cost, never capital: the ${amount} you built with is free in every figure `
    + 'here, and in Everyone’s books.', { why: 'counterfactuals' }),
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
  colNet: line('label', 'Net profit'),
  colReturns: line('label', 'Returns took'),
  colGross: line('label', 'Rank on gross'),
  you: line('label', 'You'),
  hidden: line('label', 'hidden'),
  brandLine: line('label', ({ spent, conversions, each, roas, gross }) =>
    `spent ${spent} · ${conversions} conversions, ${each} each · ${roas} of sales after returns per rupee of clicks `
    + `· gross profit ${gross}`),
  booksNote: line('reading', ({ month, snapshot }) =>
    'Ranked by net profit, what each kept: sales after returns, less the goods, the clicks and the freight on '
    + `parcels refused at the door. The outline is gross profit, which counts an order that came back as a sale; `
    + `month ${month}’s budgets were split on gross, at week ${snapshot}.`, { why: 'returnsSplit' }),
  booksHigh: line('reading', ({ weeks }) =>
    `Every brand’s last ${weeks} weeks are missing returns that came back after the game ended, and capital spent `
    + 'on the business is never counted, so every figure here reads high: most for whoever sold most late, or built most.'),
  cellsHidden: line('reading', 'Where each of them sat stays hidden here until you answer Where they sat.'),
  finished: line('label', 'Where you finished'),
  rankAtSnapshot: line('label', ({ week }) => `at week ${week}, on gross profit as reported then`),
  rankGross: line('label', 'at the end, on gross profit'),
  rankNet: line('label', 'at the end, on net profit'),
  monthThree: line('reading', ({ month, snapshot, place, amount, middle, first, last }) =>
    `Month ${month}’s budgets were set by the week-${snapshot} ranking: ${ordinal(place)} gave you ${amount}, `
    + `where the middle place got ${middle}, first ${first} and last ${last}.`),
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
