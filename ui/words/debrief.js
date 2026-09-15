/**
 * Every sentence and label of the debrief and the reveal
 * (plans/2026-09-13-debrief.md, sections 4-6).
 *
 * Figures arrive formatted from `ui/debrief/render.js`; the choice between
 * "more" and "fewer" is made here, because it is wording. The two disclosures,
 * both about what only a simulation can know, carry their "why?".
 */

import { line } from './line.js';

const listed = (names) => (names.length <= 1
  ? names.join('')
  : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

/** "more", "fewer" or "the same", for a difference the player did not have. */
const direction = (sign, [up, down]) => (sign > 0 ? up : sign < 0 ? down : 'the same');

/** 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st. */
function ordinal(n) {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th');
  return `${n}${suffix}`;
}

export const DEBRIEF = Object.freeze({
  // --- the card ------------------------------------------------------------
  title: line('label', 'What your twelve weeks taught you'),
  subtitle: line('label', 'read from your own game'),

  // --- the result, set against a real market (F15) --------------------------
  kinderMarket: line('disclosure',
    'This market is kinder than a real one: its ads are clicked, and its clicks buy, at least '
    + 'as often as published apparel benchmarks, so its returns sit at the top of the range '
    + 'Indian brands report, and in every market measured a sensible player made money.',
    { why: 'kindMarket' }),

  // --- the moments ---------------------------------------------------------
  momentsHead: line('label', 'The weeks you changed something'),
  noMoments: line('reading',
    'You changed nothing after opening the account, so there is no before and after to read.'),
  week: line('label', ({ round }) => `Week ${round}`),
  weekBefore: line('label', ({ round }) => `Week ${round}, before`),
  weekAfter: line('label', ({ round }) => `Week ${round}, after`),
  clicks: line('label', 'Clicks'),
  cpc: line('label', 'Cost per click'),
  spend: line('label', 'Spend'),
  share: line('label', 'Impression share'),
  alsoChanged: line('reading', ({ newMonth, capitalLanded }) => {
    const also = ['rivals moved their bids'];
    if (newMonth) also.push('a new month’s budget began');
    // Not "capital landed": what it paid for goes live weeks later, and the
    // Results screen beside it says when (the review, 2026-09-15).
    if (capitalLanded) also.push('the second capital allocation was made');
    return `Other things changed that week too: ${listed(also)}. This shows what changed, not what caused it.`;
  }),
  whatIf: line('label', 'What if I hadn’t?'),
  replaying: line('reading', ({ week, of }) => `Replaying week ${week} of ${of}…`),
  // Always to the end of the game: a change stays out of the replay after it,
  // and can move the week-8 ranking and month 3's budget (found drawing
  // Results, 2026-09-15). It used to stop "until your next change".
  window: line('reading', ({ from, to }) => {
    const span = from === to ? `Week ${from}` : `Weeks ${from}–${to}`;
    return `${span}, to the end of the game, still settling.`;
  }),
  withoutIt: line('reading', ({ clicks, clicksSign, cost, costSign, kept, keptSign }) => {
    if (clicksSign === 0 && costSign === 0 && keptSign === 0) {
      return 'Without it, those weeks would have come out exactly the same.';
    }
    // A difference is the played game MINUS the one without the change, so a
    // positive clicks difference means the game without it had fewer.
    const clicksPart = clicksSign === 0 ? 'the same clicks'
      : `${clicks} ${direction(clicksSign, ['fewer', 'more'])} clicks`;
    const costPart = costSign === 0 ? 'paid the same'
      : `paid ${cost} ${direction(costSign, ['less', 'more'])}`;
    const keptPart = keptSign === 0 ? 'kept the same'
      : `kept ${kept} ${direction(keptSign, ['less', 'more'])}`;
    return `Without it you would have had ${clicksPart}, ${costPart}, and ${keptPart}.`;
  }),
  rivalsHeld: line('disclosure',
    'Rivals make the moves they made in your game; in a real one they might have answered differently.',
    { why: 'counterfactuals' }),

  // --- the budget "what if" ------------------------------------------------
  budgetHead: line('label', 'If you had had more budget'),
  budgetWorkOut: line('label', 'Work out what more budget would have done'),
  budgetNeverRanOut: line('reading',
    'Your budget never ran out: every week had money left, so more of it would have bought nothing.'),
  budgetRanOut: line('reading', ({ ranOut, played }) => `Your budget ran out in ${ranOut} of ${played} weeks.`),
  budgetPaid: line('reading', ({ count, round, clicks, kept }) => (count === 1
    ? `In one of them more money would have paid for itself: week ${round}, ${clicks} more clicks and ${kept} kept.`
    : `In ${count} of them more money would have paid for itself, week ${round} most: ${clicks} more clicks and ${kept} kept.`)),
  // Within a rupee a click either way (the owner, 2026-09-15): ₹36 on 1,977
  // more clicks had read as "paid for itself".
  budgetBrokeEven: line('reading', ({ count, weeks }) => (count === 1
    ? `In one of them, week ${weeks[0]}, spending the rest of the month there and then would about have broken even.`
    : `In ${count} of them, weeks ${listed(weeks)}, spending the rest of the month there and then would about have broken even.`)),
  budgetLost: line('reading', ({ count, all }) => (all
    ? 'In every one, spending the rest of the month there and then would have lost money, so running out cost you nothing.'
    : `In ${count} of them, spending the rest of the month there and then would have lost money, so running out cost you nothing there.`)),
  // A week that ran out with none of its month left: the question imagines
  // nothing there, and without this line such a week read as never running out.
  budgetNothingLeft: line('reading', ({ weeks }) => (weeks.length === 1
    ? `Week ${weeks[0]} had nothing left in its month to spend.`
    : `Weeks ${listed(weeks)} had nothing left in their month to spend.`)),
  budgetExact: line('disclosure',
    'An exact figure only a simulation can have: Google Ads can only estimate it, as impression share lost to budget.',
    { why: 'counterfactuals' }),

  // --- the lessons ---------------------------------------------------------
  lessonsHead: line('label', 'What you ran into, and what you didn’t try'),
  ranInto: line('label', 'You ran into this'),
  didNotTry: line('label', 'You didn’t try this'),

  numbersMoveTitle: line('label', 'Numbers keep moving'),
  // Net profit, as the Results chart reads every week (the owner, 2026-09-15).
  numbersMove: line('reading', ({ round, first, now }) =>
    `Week ${round}’s net profit read ${first} when it was first reported; it now stands at ${now}. Every week you read was unfinished.`,
  { why: 'attributionLag' }),

  rankOrBudgetTitle: line('label', 'Rank or budget'),
  // It used to say the fix was more money, beside a budget question that
  // could say more money would not have paid (the review, 2026-09-15).
  rankOrBudgetBudget: line('reading', ({ round, share }) =>
    `Your worst week, week ${round}, lost ${share} of its impressions to budget: the money ran out, so a higher bid would only have made each click dearer. Whether more money would have paid is what “If you had had more budget” works out.`,
  { why: 'rankOrBudget' }),
  rankOrBudgetRank: line('reading', ({ round, share }) =>
    `Your worst week, week ${round}, lost ${share} of its impressions to rank. The fix for that is a better ad or a higher bid, not more money.`,
  { why: 'rankOrBudget' }),
  rankOrBudgetNot: line('reading', ({ threshold }) =>
    `No week lost as much as ${threshold} of its impressions to budget or to rank, so neither limit really bit.`,
  { why: 'rankOrBudget' }),

  broadMatchTitle: line('label', 'Broad match wanders'),
  // The count takes in every search no keyword spelled out exactly, phrase
  // match's longer searches too, so the sentence says so rather than laying
  // them all at broad match's door (the review, 2026-09-15).
  broadMatch: line('reading', ({ terms, negatives, blocked }) => {
    const blocking = blocked === 1 ? 'one word' : `${negatives} words`;
    return `Your keywords bought clicks on ${terms} different searches that none of them spelled out exactly: `
      + `broad match wandering, and phrase match’s longer searches. By the end you were blocking ${blocking}.`;
  }, { why: 'broadMatch' }),
  broadMatchNot: line('reading',
    'You never ran a broad keyword, so every search you bought was close to one you wrote. Next game, try one broad keyword and watch the search terms report.',
    { why: 'broadMatch' }),

  returnsTitle: line('label', 'Returns: gross against kept'),
  // A return comes back two weeks after its sale lands, so the last weeks'
  // returns never arrive inside the game (found drawing Results, 2026-09-15).
  returns: line('reading', ({ share, rank, grossRank }) =>
    `Returns took ${share} of your gross profit. You placed ${ordinal(rank)} on what you kept and `
    + `${ordinal(grossRank)} on gross profit, which counts an order that came back as a sale. That share `
    + 'would grow: the last weeks’ returns had not all come back when the game ended.',
  { why: 'returnsSplit' }),

  ownNameTitle: line('label', 'Defending your name'),
  ownName: line('reading', ({ own, other }) =>
    `A click on your own name cost ${own}, against ${other} for everything else.`,
  { why: 'ownName' }),
  ownNameNoClicks: line('reading', 'You bid on your own name, but it bought no clicks.', { why: 'ownName' }),
  ownNameNot: line('reading',
    'You never bid on your own name, so any rival could buy it. Next game, try defending it and compare what it costs.',
    { why: 'ownName' }),

  smartBiddingTitle: line('label', 'Smart bidding learns'),
  smartBidding: line('reading', ({ strategy, round, learning }) =>
    `You switched to ${strategy} in week ${round}; for its first ${learning} weeks it was learning, and bid less precisely while it did.`,
  { why: 'smartBidding' }),
  smartBiddingNot: line('reading',
    'You never switched to a strategy that predicts conversions. Next game, try one and watch its learning weeks.',
    { why: 'smartBidding' }),

  // --- the reveal ----------------------------------------------------------
  revealTitle: line('label', 'Where did they sit?'),
  revealSubtitle: line('label', 'you read their ads before the first auction'),
  revealAsk: line('instruction',
    'Place each rival on the grid from its ad alone, the only evidence you had before the first auction. Then see where they really sat.'),
  reveal: line('label', 'Reveal'),
  skip: line('label', 'Skip, just show me'),
  cell: line('label', ({ price, purpose }) => `${price} · ${purpose}`),
  youSaid: line('label', ({ cell }) => `You said ${cell}`),
  actually: line('label', ({ cell }) => `Actually ${cell}`),
  resultExact: line('label', 'Exactly right'),
  resultPrice: line('label', 'Right on price, wrong on purpose'),
  resultPurpose: line('label', 'Right on purpose, wrong on price'),
  resultWrong: line('label', 'Wrong on both'),
  resultSkipped: line('label', 'Not guessed'),
  score: line('reading', ({ exact, half, of }) =>
    `You read ${exact} of ${of} exactly, and ${half} more half right.`),
  shown: line('reading', 'Here is where each of them really sat.'),
  cellsHidden: line('reading',
    'Where each of them sat stays hidden here until you have answered the card above.'),
  cellmates: line('reading', ({ names }) => (names.length === 0
    ? 'Nobody sat in your cell.'
    : `${listed(names)} sat in your cell, so ${names.length === 1 ? 'it' : 'they'} bid on the same kind of searches you did.`)),
});
