/**
 * Round 0 in the Studio (plans/2026-09-14-round-zero-redesign.md, sections 3
 * and 4): the frame's words, then each step's. About 150 to 200 words a step,
 * rival ads, planner rows and keyword names aside; the rest is in the guide.
 * The briefing's own facts (the hints, the formula, the returns line) come
 * from setup.js's briefing() as data and are not restated here.
 */

import { line } from './line.js';

const lower = (text) => `${text.charAt(0).toLowerCase()}${text.slice(1)}`;

/** 'Nira', 'Nira and Marlow', 'Nira, Marlow and Kestrel'. */
const listed = (names) => (names.length < 2 ? names.join('')
  : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

export const R0 = Object.freeze({
  // The frame
  stepMarket: line('label', 'The market'),
  stepPosition: line('label', 'Where you sit'),
  stepKeywords: line('label', 'Your keywords'),
  stepAd: line('label', 'Your ad'),
  stepMoney: line('label', 'Your money'),
  yourBrand: line('label', 'your brand this game'),
  beforeWeek: line('label', ({ week }) => `Before week ${week}`),
  roundLabel: line('label', ({ round }) => `Round ${round}`),
  beforeAuction: line('label', 'before the first auction'),
  stepOf: line('label', ({ n, total }) => `Step ${n} of ${total}`),
  done: line('label', 'done'),
  soFar: line('label', 'So far'),
  next: line('instruction', ({ step }) => `Next: ${lower(step)}`),
  cellName: line('label', ({ price, purpose }) => `${price} · ${purpose}`),
  capitalKept: line('label', 'capital kept'),
  capitalCommitted: line('label', ({ amount }) => `${amount} of capital committed`),
  keywordCount: line('label', ({ n }) => `${n} ${n === 1 ? 'keyword' : 'keywords'}`),
  menu: line('label', 'Steps'),

  // The tray at step 5
  checkSquare: line('label', 'Your square'),
  checkKeywords: line('label', 'Keywords'),
  checkAd: line('label', 'Your ad'),
  checkMoney: line('label', 'Your money'),
  needKeyword: line('instruction', 'add a keyword'),
  needAd: line('instruction', 'finish the ad'),
  needSplit: line('instruction', 'the weekly split asks for more than the month'),
  redoNote: line('reading', ({ round, week }) => `You can redo round ${round} once, until the end of week ${week}.`),
  go: line('instruction', ({ week }) => `Open the account and run week ${week}`),
  running: line('label', ({ hours }) => `running ${hours} hours…`),

  // The squares' names
  priceValue: line('label', 'Value'),
  priceMid: line('label', 'Mid'),
  pricePremium: line('label', 'Premium'),
  purposePerformance: line('label', 'Performance'),
  purposeLifestyle: line('label', 'Lifestyle'),

  // Step 1, the market
  marketIntro: line('reading', ({ weeks, rivals }) => `${weeks} weeks against ${rivals} rival brands. `
    + 'You finish ranked by profit after returns.'),
  searchesWeek: line('label', 'searches a week'),
  orderMargin: line('label', ({ order, margin }) => `${order} order · ${margin} margin`),
  breakEvenTitle: line('label', 'What a click is worth to you, at break-even'),
  breakEvenCaveat: line('reading', 'That is a click on a search worth nothing in particular. The searches '
    + 'you choose to compete for are worth roughly double, which is why your position matters.'),
  notTold: line('label', 'What you’re not told'),
  hintBuys: line('label', 'Who buys'),
  hintReturns: line('label', 'Returns'),
  hintCompetition: line('label', 'Competition'),
  whereTitle: line('label', 'Where the searches are'),
  basisLabel: line('label', 'Whose searches'),
  basisAll: line('label', 'All'),
  shareAll: line('label', 'Share of all searches'),
  shareOf: line('label', ({ level }) => `Share of ${level} searches`),
  pulseNote: line('reading', 'Each city rings as often as its kind of place is searched: the busiest '
    + 'rings fastest. Tap a place to name its cities.'),
  readOnly: line('instruction', 'Nothing to decide here. Read it, then choose where you sit.'),

  // Step 2, where you sit
  positionIntro: line('reading', ({ rivals }) => `Nobody tells you where the other ${rivals} sit. `
    + 'Their ads are the only evidence before the first auction.'),
  otherRivals: line('label', ({ n }) => `The other ${n}`),
  guessNote: line('instruction', ({ placed, total }) => 'tap the small grid to note where each sits · '
    + `${placed} of ${total} placed, if you like`),
  sponsored: line('label', 'Sponsored'),
  guessFor: line('label', ({ name }) => `Where you think ${name} sits`),
  guessCell: line('label', ({ name, cell }) => `${name}: ${cell}`),
  pickSquare: line('label', 'Pick your square'),
  fixedUntil: line('label', ({ week }) => `fixed until week ${week}`),
  readoutNone: line('reading', 'Price sets what a click can be worth to you. Purpose sets which searches '
    + 'are yours. You haven’t placed any rival here.'),
  readoutPlaced: line('reading', ({ names }) => `You’ve placed ${listed(names)} here. If you’re right, `
    + 'you’ll be competing for exactly the same searches.'),
  whoValuePerformance: line('label', 'An affordable gym-wear brand'),
  whoValueLifestyle: line('label', 'A budget loungewear label'),
  whoMidPerformance: line('label', 'A serious training brand'),
  whoMidLifestyle: line('label', 'An everyday athleisure label'),
  whoPremiumPerformance: line('label', 'A technical performance house'),
  whoPremiumLifestyle: line('label', 'A considered luxury label'),
  contestPerformance: line('label', 'the most contested'),
  contestLifestyle: line('label', 'fewer bidders'),
  you: line('label', 'You'),
  guessed: line('label', ({ name }) => `${name}?`),
  axisPrice: line('label', 'price'),
});

/** A price level's name, by the engine's key. */
export const PRICE_WORD = Object.freeze({ value: R0.priceValue, mid: R0.priceMid, premium: R0.pricePremium });
/** A purpose's name, by the engine's key. */
export const PURPOSE_WORD = Object.freeze({ performance: R0.purposePerformance, lifestyle: R0.purposeLifestyle });

/** A square's name, 'Mid · Performance', from its key 'mid|performance'. */
export function cellWords(cell) {
  const [price, purpose] = cell.split('|');
  return R0.cellName({ price: PRICE_WORD[price](), purpose: PURPOSE_WORD[purpose]() });
}
