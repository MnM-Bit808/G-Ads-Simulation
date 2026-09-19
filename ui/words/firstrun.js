/**
 * The first run's sentences (plans/2026-09-19-first-run-and-ground-floor.md,
 * section 4): the minute before round 0, for someone who has never bought an ad.
 *
 * WHY IT SAYS SO LITTLE. Round 0 was cut from 2,648 words to 781 and a stranger
 * still gave up inside it, so cutting further is not the remedy and this run
 * earns its place only by staying a story told in numbers and real ads rather
 * than in prose. NO BEAT PUTS MORE THAN 80 WORDS ON SCREEN, against round 0's
 * step 1 at about 248 — the step a stranger gave up inside — and
 * `tests/words.test.js` holds it there. A failure means cutting a sentence,
 * never raising the bound; this file was cut twice on 2026-09-19 for exactly
 * that reason.
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
  openTypes: line('reading', 'Four ads sit above Google’s results. You decide whether one is yours, '
    + 'and what you pay.'),
  openLength: line('reading', ({ weeks, rivals }) => `${weeks} weeks. ${rivals} rival brands. `
    + 'You’re ranked on what your business made.'),
  openNoNeed: line('reading', 'You don’t need to know anything yet. '
    + 'Here is one search, start to finish.'),

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
  // The word Google itself puts on a paid result. It is a term the run teaches,
  // so it is said here rather than borrowed from the beat's own heading.
  b2Sponsored: line('label', 'Sponsored'),
  b2Organic: line('label', 'the results nobody pays for'),
  b2Trail: line('label', ({ slots }) => `${slots} ads above the results`),

  // Beat 3, the auction. The run's centre.
  b3Kicker: line('label', 'Nobody bought those slots'),
  b3Say: line('reading', ({ entered, of }) => `${of} brands sell here. ${entered} wanted this search, `
    + 'ranked by bid times how well the ad fits.'),
  b3Cut: line('label', ({ slots }) => `only ${slots} slots`),
  b3ReadAgain: line('label', 'Read those two rows again'),
  b3Callout: line('reading', ({ winner, winnerBid, winnerPays, runnerUp, runnerUpBid, runnerUpPays }) =>
    `${winner} bid ${winnerBid}, pays ${winnerPays}. ${runnerUp} bid ${runnerUpBid}, sits below, `
    + `pays ${runnerUpPays} — its ad fits better.`),
  b3Cost: line('reading', 'Buying your way up costs you every click.'),
  b3Trail: line('label', ({ winner, winnerPays }) => `${winner} first at ${winnerPays}`),

  // Beat 4, the click. Where the money goes and the sale does not.
  b4Kicker: line('label', 'She clicks the first one'),
  b4Pays: line('label', ({ winner }) => `${winner} pays`),
  b4Sold: line('label', ({ winner }) => `${winner} has sold`),
  b4When: line('label', 'the moment she clicks'),
  b4Looking: line('label', 'she is only looking'),
  b4Say: line('reading', ({ winner, winnerPays }) => 'You pay for the visit, not the sale. '
    + `She may buy nothing. ${winner} still paid ${winnerPays}.`),
  b4Note: line('reading', 'A cheap click on the wrong search is expensive. '
    + 'A dear one on the right search is a bargain.'),
  b4Trail: line('label', ({ winnerPays }) => `she clicked · ${winnerPays} gone · nothing sold`),

  // Beat 5, the delay.
  b5Kicker: line('label', 'The same click, weeks on'),
  b5Say: line('reading', 'The sale counts in the week she clicked, not the week she bought.'),
  b5Note: line('reading', 'A week you already read is rewritten. '
    + 'Judging a week early is expensive.'),
  b5Report: line('label', ({ clickWeek }) => `What week ${clickWeek} said`),
  b5Then: line('label', 'when it happened'),
  b5Later: line('label', 'two weeks later'),
  b5Trail: line('label', ({ order, buyWeek }) => `she buys ${order} in week ${buyWeek}`),

  // Beat 6, the return.
  b6Kicker: line('label', 'Two weeks after that'),
  b6Say: line('reading', ({ order, freight }) => 'She pays cash on delivery, and doesn’t take it. '
    + `The ${order} goes back; the ${freight} freight does not.`),
  b6Note: line('reading', ({ returnShare }) => `Roughly ${returnShare} come back — `
    + 'the gap between revenue and profit.'),
  b6Report3: line('label', ({ clickWeek }) => `What week ${clickWeek} said, again`),
  b6Latest: line('label', 'four weeks later'),
  b6Trail: line('label', ({ freight }) => `refused at the door · ${freight} of freight gone`),

  // Beat 7, the handover into round 0.
  b7Kicker: line('label', 'That was one search'),
  b7Hero: line('label', ({ weekly, of }) => `There are ${weekly} a week, and ${of} brands want them.`),
  b7Say: line('reading', ({ weeks }) => `One of those brands is you. For ${weeks} weeks you decide `
    + 'which searches are worth being in, what to pay, and what your ad says.'),
  b7Note: line('reading', 'Every word you just met has a “why?” beside it from here on, '
    + 'and the guide is in the strip on the left.'),

  // One week's report, said once for each time it was rewritten. "One", never
  // "1": a digit in a sentence is a number typed by hand, which tests/ui.test.js
  // refuses on sight.
  repThen: line('label', ({ winnerPays }) => `one click · ${winnerPays} spent · nothing sold`),
  repLater: line('label', ({ winnerPays, order }) => `one click · ${winnerPays} spent · ${order} sold`),
  repLatest: line('label', ({ winnerPays, freight }) => `one click · ${winnerPays} spent · nothing sold, −${freight}`),

  // The week strip, beats 5 and 6.
  wkWeek: line('label', ({ n }) => `Week ${n}`),
  wkClick: line('label', 'the click'),
  wkThinks: line('label', 'she thinks'),
  wkBuys: line('label', 'she buys'),
  wkShips: line('label', 'it ships'),
  wkRefused: line('label', 'refused at the door'),

  // THE TERMS EACH BEAT TEACHES, named as they appear. These are the run's
  // whole purpose — a beginner meets the word attached to the thing, once —
  // so they are sentences like any other and counted in the budget like any
  // other. No digits: "one to four", never "1 to 4".
  termSearch: line('label', 'a search'), glossSearch: line('label', 'one person, once'),
  termVolume: line('label', 'search volume'), glossVolume: line('label', 'how many a week'),

  termAd: line('label', 'an ad'), glossAd: line('label', 'headlines and two lines'),
  termPosition: line('label', 'position'), glossPosition: line('label', 'one to four, top down'),
  termImpression: line('label', 'an impression'), glossImpression: line('label', 'your ad was shown'),

  termBid: line('label', 'a bid'), glossBid: line('label', 'the most you’ll pay'),
  termAuction: line('label', 'the auction'), glossAuction: line('label', 'run on every search'),
  termRank: line('label', 'ad rank'), glossRank: line('label', 'bid × fit, and it decides'),

  termClick: line('label', 'a click'), glossClick: line('label', 'someone came to your site'),
  termCpc: line('label', 'cost per click'), glossCpc: line('label', 'what that visit cost'),
  termBudget: line('label', 'your budget'), glossBudget: line('label', 'the pot it comes from'),

  termConversion: line('label', 'a conversion'), glossConversion: line('label', 'a click that bought'),
  termDelay: line('label', 'the delay'), glossDelay: line('label', 'sales land weeks later'),

  termReturn: line('label', 'a return'), glossReturn: line('label', 'the money goes back'),
  termRefused: line('label', 'refused'), glossRefused: line('label', 'never delivered, freight lost'),

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
