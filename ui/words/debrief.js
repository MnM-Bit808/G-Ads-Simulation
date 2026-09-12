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
    if (capitalLanded) also.push('capital landed');
    return `Other things changed that week too: ${listed(also)}. This shows what changed, not what caused it.`;
  }),
  whatIf: line('label', 'What if I hadn’t?'),
  replaying: line('reading', ({ week, of }) => `Replaying week ${week} of ${of}…`),
  window: line('reading', ({ from, to, toEnd }) => {
    const span = from === to ? `Week ${from}` : `Weeks ${from}–${to}`;
    return toEnd ? `${span}, to the end of the game, still settling.` : `${span}, until your next change.`;
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
  budgetDidNotPay: line('reading', ({ count, all }) => (all
    ? 'In every one the extra traffic would not have paid for itself, so running out cost you nothing.'
    : `In the other ${count} the extra traffic would not have paid for itself, so running out cost you nothing there.`)),
  budgetExact: line('disclosure',
    'An exact figure only a simulation can have: Google Ads can only estimate it, as impression share lost to budget.',
    { why: 'counterfactuals' }),

  // --- the lessons ---------------------------------------------------------
  lessonsHead: line('label', 'What you ran into, and what you didn’t try'),
  ranInto: line('label', 'You ran into this'),
  didNotTry: line('label', 'You didn’t try this'),

  numbersMoveTitle: line('label', 'Numbers keep moving'),
  numbersMove: line('reading', ({ round, first, now }) =>
    `Week ${round}’s gross profit read ${first} when you first saw it; it now stands at ${now}. Every week you read was unfinished.`,
  { why: 'attributionLag' }),

  rankOrBudgetTitle: line('label', 'Rank or budget'),
  rankOrBudgetBudget: line('reading', ({ round, share }) =>
    `Your worst week, week ${round}, lost ${share} of its impressions to budget. The fix for that is more money, or cheaper clicks through lower bids, not a higher bid.`),
  rankOrBudgetRank: line('reading', ({ round, share }) =>
    `Your worst week, week ${round}, lost ${share} of its impressions to rank. The fix for that is a better ad or a higher bid, not more money.`),
  rankOrBudgetNot: line('reading', ({ threshold }) =>
    `No week lost as much as ${threshold} of its impressions to budget or to rank, so neither limit really bit.`),

  broadMatchTitle: line('label', 'Broad match wanders'),
  broadMatch: line('reading', ({ terms, negatives }) =>
    `Your keywords bought clicks on ${terms} searches that no keyword of yours spelled out, and you blocked ${negatives}.`),
  broadMatchNot: line('reading',
    'You never ran a broad keyword, so every search you bought was close to one you wrote. Next game, try one broad keyword and watch the search terms report.'),

  returnsTitle: line('label', 'Returns: gross against kept'),
  returns: line('reading', ({ share, rank, grossRank }) =>
    `Returns took ${share} of your gross profit. You placed ${ordinal(rank)} on what you kept and `
    + `${ordinal(grossRank)} on gross profit, which counts an order that came back as a sale.`,
  { why: 'returnsSplit' }),

  ownNameTitle: line('label', 'Defending your name'),
  ownName: line('reading', ({ own, other }) =>
    `A click on your own name cost ${own}, against ${other} for everything else.`),
  ownNameNoClicks: line('reading', 'You bid on your own name, but it bought no clicks.'),
  ownNameNot: line('reading',
    'You never bid on your own name, so any rival could buy it. Next game, try defending it and compare what it costs.'),

  smartBiddingTitle: line('label', 'Smart bidding learns'),
  smartBidding: line('reading', ({ strategy, round, learning }) =>
    `You switched to ${strategy} in week ${round}; for its first ${learning} weeks it was learning, and bid less precisely while it did.`),
  smartBiddingNot: line('reading',
    'You never switched to a strategy that predicts conversions. Next game, try one and watch its learning weeks.'),

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
