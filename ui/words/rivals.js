/**
 * The Studio's Rivals (design/market/, chosen by the owner 2026-09-15): the
 * market's public figures, the player's own share, and each rival's card. The
 * week the market re-splits keeps the market card's words (./market.js).
 *
 * Every figure arrives formatted; none is a rival's spend, bids or results
 * (R3), and the line saying how often you meet is not spend is spec 16's:
 * overlap rate is the most misread number on the platform.
 */

import { line } from './line.js';

const listOf = (names) => (names.length < 2
  ? names.join('')
  : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

export const RIVALS = Object.freeze({
  // A DISCOUNTING RIVAL SAYS SO IN ITS AD (I45), because that is what a shop
  // does with an offer. It is read in the ad rather than reported in a panel:
  // finding it is the same reading step 2 teaches.
  offersPrepaid: line('label', ({ amount }) => `${amount} off when you pay online.`),
  // The market, this week against last.
  marketSpend: line('label', 'Market spend'),
  medianClick: line('label', 'Median click'),
  advertisersRunning: line('label', 'Advertisers running'),
  searchesWeek: line('label', 'Searches a week'),
  lastWeek: line('label', ({ value }) => `last week ${value}`),
  firstWeek: line('label', 'the first week played'),
  sameEveryWeek: line('label', 'the same every week'),

  // You.
  you: line('label', 'You'),
  shown: line('label', 'shown, of the auctions you could enter'),
  lostBudget: line('label', 'lost to budget'),
  lostRank: line('label', 'lost to rank', { why: 'rankOrBudget' }),
  reading: Object.freeze({
    budget: line('reading', ({ share, budget, rank }) => `You showed in ${share} of the auctions you were eligible `
      + `for, and lost ${budget} to budget against ${rank} to rank: nobody is keeping you out, the money runs out first.`),
    rank: line('reading', ({ share, budget, rank }) => `You showed in ${share} of the auctions you were eligible for, `
      + `and lost ${rank} to rank against ${budget} to budget: you are being outranked.`),
    both: line('reading', ({ share, budget, rank }) => `You showed in ${share} of the auctions you were eligible for, `
      + `losing ${rank} to rank and ${budget} to budget: both are biting.`),
    saturated: line('reading', ({ share }) => `You showed in ${share} of the auctions you were eligible for: there is `
      + 'almost nothing left to win on these keywords.'),
  }),
  // "Of all the auctions you show in", so it cannot be read as the card's
  // "above you, when you meet" (the second read of the mock-ups).
  meetSame: line('reading', ({ name, overlap, above }) => `You meet ${name} most, in ${overlap} of the auctions `
    + `you show in, and it ranks above you in ${above} of all of them.`),
  meetOther: line('reading', ({ name, overlap, other, above }) => `You meet ${name} most, in ${overlap} of the `
    + `auctions you show in, but ${other} ranks above you in more of them: ${above} of all the auctions you show in.`),

  // The cards.
  notSpend: line('reading', 'How often a rival shows in your auctions is not market share, and not spend: a rising '
    + 'figure can simply mean you both moved into the same searches.'),
  key: line('reading', 'Above you counts only the auctions you both showed in; you outrank them counts every auction '
    + 'you showed in, the ones they missed included.'),
  showedIn: line('label', 'of the auctions you showed in'),
  aboveWhenMeet: line('label', 'above you, when you meet'),
  youOutrank: line('label', 'you outrank them'),
  movedUp: line('label', ({ from }) => `up from ${from} last week`),
  movedDown: line('label', ({ from }) => `down from ${from} last week`),
  never: line('reading', ({ names }) => `${listOf(names)} never appeared in your auctions this week.`),
});
