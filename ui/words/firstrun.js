/**
 * The first run's sentences (plans/2026-09-19-first-run-and-ground-floor.md,
 * section 4): the minute before round 0, for someone who has never bought an ad.
 *
 * WHY IT SAYS SO LITTLE. Round 0 was cut from 2,648 words to 781 and a stranger
 * still gave up inside it, so cutting further is not the remedy and this run
 * earns its place only by staying a story told in numbers and real ads rather
 * than in prose. The whole thing is under 200 words and `tests/words.test.js`
 * holds it there: a failure means cutting a sentence, never raising the bound.
 *
 * NO CHAPTER IS NAMED HERE. The run teaches the world — what a click IS — and
 * the ground-floor chapters teach the controls. One word, one home, so a term
 * is never defined twice in two voices.
 *
 * IT SAYS "SHE" AND "MARLOW", NOT "YOU", UNTIL THE LAST BEAT. The player has
 * chosen no position, no keyword and no bid, so "you bid ₹30" would be the
 * first screen of this game teaching something false.
 *
 * Every figure arrives from `ui/firstrun/auction.js`, which resolves a real
 * auction. Nothing below computes a number; it can only phrase one.
 */

import { line } from './line.js';

export const FIRST_RUN = Object.freeze({
  // The opening statement, shown above beat 1 only.
  openTitle: line('label', 'You’re buying the ads above Google’s search results.'),
  openTypes: line('reading', 'Someone in India types “gym leggings”. Four ads sit above the results. '
    + 'You decide whether one is yours, and what you’ll pay to be there.'),
  openLength: line('reading', ({ weeks, rivals }) => `${weeks} weeks. ${rivals} rival brands. `
    + 'You’re ranked on what your business made.'),
  openNoNeed: line('reading', 'You don’t need to know anything about advertising yet. '
    + 'This shows you one search, start to finish.'),

  // Beat 1, the search.
  b1Kicker: line('label', 'One search'),
  // The hour is the auction's own (`DEMO_HOUR`), so it arrives as a figure.
  b1Where: line('label', ({ where, time }) => `${where} · ${time}`),
  b1Say: line('reading', ({ where, volume }) => `In ${where}, someone types this. `
    + `About ${volume} people search it every week.`),
  b1Trail: line('label', ({ query, volume }) => `“${query}” · ${volume} a week`),

  // Beat 2, the four ads.
  b2Kicker: line('label', 'What she sees'),
  b2Say: line('reading', 'Four ads, above everything else. Being shown is an impression, '
    + 'and nothing has been paid yet.'),
  b2Organic: line('label', 'the results nobody pays for'),
  b2Trail: line('label', ({ slots }) => `${slots} ads above the results`),

  // Beat 3, the auction. The run's centre.
  b3Kicker: line('label', 'Nobody bought those slots'),
  b3Say: line('reading', ({ entered, of }) => `${of} brands sell gym clothes here, and ${entered} wanted this search. `
    + 'On every search, Google ranks them by what they bid times how well their ad fits.'),
  b3Cut: line('label', ({ slots }) => `only ${slots} slots`),
  b3ReadAgain: line('label', 'Read the top two rows again'),
  b3Callout: line('reading', ({ winner, winnerBid, winnerPays, runnerUp, runnerUpBid, runnerUpPays }) =>
    `${winner} bid ${winnerBid} and pays ${winnerPays}. ${runnerUp} bid ${runnerUpBid}, sits below it, `
    + `and pays ${runnerUpPays} — its ad fits this search better.`),
  b3Cost: line('reading', 'You can buy your way up. It costs you every click.'),
  b3Trail: line('label', ({ winner, winnerPays }) => `${winner} first at ${winnerPays}`),

  // Beat 4, the click. Where the money goes and the sale does not.
  b4Kicker: line('label', 'She clicks the first one'),
  b4Pays: line('label', ({ winner }) => `${winner} pays`),
  b4Sold: line('label', ({ winner }) => `${winner} has sold`),
  b4When: line('label', 'the moment she clicks'),
  b4Looking: line('label', 'she is only looking'),
  b4Say: line('reading', ({ winner, winnerPays }) => 'You pay for the visit, not the sale. '
    + `She might buy nothing and leave. ${winner} still paid ${winnerPays}.`),
  b4Note: line('reading', 'So a cheap click on the wrong search is expensive, '
    + 'and a dear one on the right search can be a bargain.'),
  b4Trail: line('label', ({ winnerPays }) => `she clicked · ${winnerPays} gone · nothing sold`),

  // Beat 5, the delay.
  b5Kicker: line('label', ({ clickWeek, buyWeek }) => `She clicked in week ${clickWeek}, and buys in week ${buyWeek}`),
  b5Say: line('reading', 'The sale is counted in the week she clicked, not the week she bought. '
    + 'So a week you have already read is rewritten underneath you.'),
  b5Note: line('reading', 'Nothing has gone wrong. This is how the real thing works, '
    + 'and it is why judging a week early is expensive.'),
  b5Report: line('label', ({ clickWeek }) => `What week ${clickWeek} said`),
  b5Then: line('label', 'when it happened'),
  b5Later: line('label', 'two weeks later'),
  b5Trail: line('label', ({ order, buyWeek }) => `she buys ${order} in week ${buyWeek}`),

  // Beat 6, the return.
  b6Kicker: line('label', 'Two weeks after that'),
  b6Say: line('reading', ({ order, freight }) => 'She pays cash when it arrives, and she doesn’t take it. '
    + `The ${order} goes back, and the ${freight} it cost to send does not.`),
  b6Note: line('reading', ({ returnShare }) => `Roughly ${returnShare} come back here. `
    + 'It is the biggest thing between revenue and profit.'),
  b6Report3: line('label', ({ clickWeek }) => `What week ${clickWeek} said, three times`),
  b6Latest: line('label', 'four weeks later'),
  b6Trail: line('label', ({ freight }) => `refused at the door · ${freight} of freight gone`),

  // Beat 7, the handover into round 0.
  b7Kicker: line('label', 'That was one search'),
  b7Hero: line('label', ({ weekly, of }) => `There are ${weekly} a week, and ${of} brands want them.`),
  b7Say: line('reading', ({ weeks }) => `One of those brands is you. For ${weeks} weeks you decide `
    + 'which searches are worth being in, what to pay, and what your ad says.'),
  b7Note: line('reading', 'Every word you just met has a “why?” beside it from here on, '
    + 'and the guide is in the strip on the left.'),

  // The week strip, beats 5 and 6.
  wkWeek: line('label', ({ n }) => `Week ${n}`),
  wkClick: line('label', 'the click'),
  wkThinks: line('label', 'she thinks'),
  wkBuys: line('label', 'she buys'),
  wkShips: line('label', 'it ships'),
  wkRefused: line('label', 'refused at the door'),

  // The ladder's columns.
  colBrand: line('label', 'brand'),
  colBid: line('label', 'bid'),
  colFits: line('label', 'ad fits'),
  colRank: line('label', 'rank'),
  colPays: line('label', 'pays'),

  // Moving through it. Each `next` names where it goes, never "next".
  stepOf: line('label', ({ n, total }) => `Step ${n} of ${total}`),
  next1: line('instruction', 'What she sees'),
  next2: line('instruction', 'How those four were chosen'),
  next3: line('instruction', 'She clicks one'),
  next4: line('instruction', 'Three weeks later'),
  next5: line('instruction', 'Two weeks after that'),
  next6: line('instruction', 'And that is the whole job'),
  next7: line('instruction', 'Start — pick where your brand sits'),
  skip: line('instruction', 'Skip this, take me to the game'),
  back: line('instruction', 'Back'),
  again: line('instruction', 'Watch that again'),
});
