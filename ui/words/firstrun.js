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

  // BEAT 3, THE AUCTION ALONE (I55, split from the ladder 2026-09-26). It used
  // to teach the auction, the bid and ad rank on one screen — three of the
  // fifteen words the run teaches, on the screen a beginner understands least.
  // This one says only that a search is an auction and that most brands lose
  // it; the ladder beat after it says how the order was decided.
  b3Kicker: line('label', 'Nobody bought those slots'),
  b3Say: line('reading', ({ of, entered, slots }) => `${of} brands sell here, and ${entered} wanted `
    + `this search. There are ${slots} slots, so most of them get nothing.`),
  b3Again: line('reading', 'Every search runs its own auction, the moment it is typed.'),
  b3Wanted: line('label', 'wanted this search'),
  b3OfBrands: line('label', ({ of }) => `of the ${of} selling here`),
  b3Cut: line('label', 'can be shown'),
  b3Shown: line('label', 'the rest show nothing'),
  b3Trail: line('label', ({ entered, slots }) => `${entered} wanted it · ${slots} slots`),

  // Beat 4, the ladder: how those slots were handed out. The run's centre.
  b4Kicker: line('label', 'How the four were chosen'),
  b4Say: line('reading', 'Each brand names a price it will pay for a click. '
    + 'The order is that bid times how well the ad fits.'),
  // The line drawn across the table where the slots run out. Beat 3 has
  // already said how many there are; here it marks who fell below it.
  b4Cut: line('label', ({ slots }) => `only ${slots} slots`),
  b4ReadAgain: line('label', 'Read those two rows again'),
  // IT USED TO LEAVE A CONTRADICTION STANDING (2026-09-20, found by playing
  // it). The old telling was "X bid ₹30, pays ₹25. Y bid ₹16, sits below, pays
  // ₹9 — its ad fits better", which hands a true beginner *better ad, lower
  // place* and never says why. The reader is left to resolve it, and the whole
  // point of the run is that they cannot yet.
  //
  // THE PAIR IS RIGHT AND STAYS. `tests/firstRun.test.js` calls it THE LESSON
  // and says the artboards in design/first-run/ are drawn to it: the runner-up
  // bids less, pays less, and has the better-fitting ad. What was wrong was the
  // telling, not the rows.
  //
  // So the top place is now explained by the bid that bought it, and the fit is
  // spent where it is actually spent — on the PRICE, not the place. That is
  // also what makes b4Cost land: buying your way up costs you every click.
  // AND IT HAD TO FIT THE BEAT'S WORD BUDGET. The ladder beat was at 78 of its
  // 80, and the first rewrite took the screen to 87. The bound is not the thing
  // to move — the run was cut twice on 2026-09-19 to come in under it — so this
  // says the same thing in three short sentences instead of two long ones,
  // which a beginner wants anyway. It now leaves the beat at 79.
  //
  // The bound counts words of two letters or more, so the figures and "a" are
  // free and the SENTENCES are what cost: that is the budget to think in.
  b4Callout: line('reading', ({ winner, winnerBid, winnerPays, runnerUp, runnerUpBid, runnerUpPays }) =>
    `${winner}’s ${winnerBid} bid buys top place at ${winnerPays}. `
    + `${runnerUp} bid ${runnerUpBid}. Its better ad means ${runnerUpPays} a click.`),
  b4Cost: line('reading', 'Buying your way up costs you every click.'),
  b4Trail: line('label', ({ winner, winnerPays }) => `${winner} first at ${winnerPays}`),

  // Beat 4, the click. Where the money goes and the sale does not.
  b5Kicker: line('label', 'She clicks the first one'),
  b5Pays: line('label', ({ winner }) => `${winner} pays`),
  b5Sold: line('label', ({ winner }) => `${winner} has sold`),
  b5When: line('label', 'the moment she clicks'),
  b5Looking: line('label', 'she is only looking'),
  b5Say: line('reading', ({ winner, winnerPays }) => 'You pay for the visit, not the sale. '
    + `She may buy nothing. ${winner} still paid ${winnerPays}.`),
  b5Note: line('reading', 'A cheap click on the wrong search is expensive. '
    + 'A dear one on the right search is a bargain.'),
  b5Trail: line('label', ({ winnerPays }) => `she clicked · ${winnerPays} gone · nothing sold`),

  // BEAT 6, THE BUDGET (I55, split from the click 2026-09-26). It used to be
  // the third term on the click's screen — a word smuggled in beside click
  // and cost per click, when it is a different idea entirely: the click is
  // what you buy, the budget is what you are buying it out of, and it is the
  // one that stops the ads. Round 0's last step asks for it, so it gets a
  // screen rather than a clause.
  b6Kicker: line('label', 'Where that money came from'),
  b6Say: line('reading', ({ winnerPays }) => `That ${winnerPays} came out of a budget set for the week. `
    + 'When the week’s money is gone, the ads stop showing.'),
  b6Note: line('reading', 'Nothing is refunded and nothing carries over. '
    + 'A week you underspend is a week you bought less than you could have.'),
  b6Week: line('label', 'a week’s budget'),
  b6ToSpend: line('label', 'to spend on clicks'),
  b6Buys: line('label', ({ winnerPays }) => `clicks at ${winnerPays}`),
  b6Gone: line('label', 'then nothing shows'),
  b6Trail: line('label', ({ winnerPays }) => `${winnerPays} of the week’s budget`),

  // Beat 7, the delay.
  b7Kicker: line('label', 'The same click, weeks on'),
  b7Say: line('reading', 'The sale counts in the week she clicked, not the week she bought.'),
  b7Note: line('reading', 'A week you already read is rewritten. '
    + 'Judging a week early is expensive.'),
  b7Report: line('label', ({ clickWeek }) => `What week ${clickWeek} said`),
  b7Then: line('label', 'when it happened'),
  b7Later: line('label', 'two weeks later'),
  b7Trail: line('label', ({ order, buyWeek }) => `she buys ${order} in week ${buyWeek}`),

  // Beat 6, the return.
  b8Kicker: line('label', 'Two weeks after that'),
  b8Say: line('reading', ({ order, freight }) => 'She pays cash on delivery, and doesn’t take it. '
    + `The ${order} goes back; the ${freight} freight does not.`),
  b8Note: line('reading', ({ returnShare }) => `Roughly ${returnShare} come back — `
    + 'the gap between revenue and profit.'),
  b8Report3: line('label', ({ clickWeek }) => `What week ${clickWeek} said, again`),
  b8Latest: line('label', 'four weeks later'),
  b8Trail: line('label', ({ freight }) => `refused at the door · ${freight} of freight gone`),

  // Beat 7, the handover into round 0.
  b9Kicker: line('label', 'That was one search'),
  b9Hero: line('label', ({ weekly, of }) => `There are ${weekly} a week, and ${of} brands want them.`),
  b9Say: line('reading', ({ weeks }) => `One of those brands is you. For ${weeks} weeks you decide `
    + 'which searches are worth being in, what to pay, and what your ad says.'),
  // IT PROMISES THE GUIDE, NOT A LINK BESIDE EVERY WORD. It used to say every
  // word met here has a "why?" from here on; playing it showed the first screen
  // after round 0 carries two, beside none of impressions, clicks, cost per
  // click or conversions. A beginner who checks a promise and finds it false
  // has been taught to stop trusting the screen.
  b9Note: line('reading', 'The guide is in the strip on the left, '
    + 'and a “why?” anywhere opens it at the right page.'),

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
  next2: line('instruction', 'Why only four'),
  next3: line('instruction', 'How those four were chosen'),
  next4: line('instruction', 'She clicks one'),
  next5: line('instruction', 'Where that money came from'),
  next6: line('instruction', 'Three weeks later'),
  next7: line('instruction', 'Two weeks after that'),
  next8: line('instruction', 'And that is the whole job'),
  // Where it actually goes: round 0's step 1, the market, which is read-only.
  // It used to promise "pick where your brand sits", which is step 2.
  next9: line('instruction', 'Start — meet the market'),
  skip: line('instruction', 'Skip this, take me to the game'),
  back: line('instruction', 'Back'),
  again: line('instruction', 'Watch that again'),
});
