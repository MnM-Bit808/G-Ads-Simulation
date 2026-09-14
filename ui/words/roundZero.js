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
  brandTitle: line('label', 'Your brand'),
  brandNote: line('instruction', 'one of the nine · the other eight are your rivals'),
  ownSearch: line('reading', ({ query, volume }) => `Your name brings a search of its own: “${query}”, `
    + `about ${volume} a week. Any rival may bid on it.`, { why: 'ownName' }),
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

  // Step 3, your keywords
  keywordsIntro: line('reading', ({ n }) => `${n} ${n === 1 ? 'keyword' : 'keywords'} · the searches you `
    + 'bid on, and how loosely each one matches', { why: 'broadMatch' }),

  // Step 4, your ad
  adIntro: line('reading', 'The only thing your rivals can see about you. Hire a writer, or write it '
    + 'yourself.', { why: 'writers' }),
  whoWrites: line('label', 'Who writes it'),
  fromBudget: line('label', ({ budget }) => `from a ${budget} creative budget`),
  free: line('label', 'free'),
  writerDiy: line('reading', 'Free. Graded on your own words.'),
  writerFreelancer: line('reading', 'Names what you sell, plainly.'),
  writerAgency: line('reading', 'Adds a hook and one concrete detail.'),
  writerRetainer: line('reading', 'Writes from the customer’s day.'),
  yourWordsDecide: line('label', 'your words decide'),
  runsAt: line('label', ({ grade }) => `runs at ${grade} · ${grade}`),
  leftover: line('reading', ({ amount }) => `${amount} of the creative budget goes to your ads instead`),
  asSearchersSee: line('label', 'As searchers see it'),
  emptyHead: line('instruction', 'Your headlines appear here'),
  emptyDesc: line('instruction', 'Your descriptions appear here.'),
  headlineN: line('label', ({ n }) => `Headline ${n}`),
  descriptionN: line('label', ({ n }) => `Description ${n}`),
  charCount: line('label', ({ n, max }) => `${n}/${max}`),
  namesRival: line('reading', ({ name }) => `It names ${name}. Bidding on a rival’s name is allowed; `
    + 'naming them in your ad is not, and it costs ad relevance.'),
  howItRuns: line('label', ({ week }) => `How it runs, from week ${week}`),
  twoParts: line('label', 'two of Quality Score’s three parts · the grade the auction uses'),
  expectedCtr: line('label', 'Expected click-through'),
  adRelevance: line('label', 'Ad relevance'),
  byWriter: line('label', ({ writer }) => `written by the ${writer}`),
  byYou: line('label', 'written by you'),
  outOf: line('label', ({ value, scale }) => `${value}/${scale}`),
  hiredNote: line('disclosure', 'A hired writer’s ad runs at the writer’s level whatever the words say: '
    + 'this game cannot judge professional writing, so it takes the writer’s level as the grade. The '
    + 'landing page, the third part, is your site: you build it in the next step.', { why: 'writers' }),
  diyNote: line('disclosure', 'The game’s own grader scores your words as you type, and that score runs '
    + 'from the first week. It checks rules, not taste: echoing your keywords counts for more than '
    + 'reading well. The landing page, the third part, is your site: you build it in the next step.',
    { why: 'writers' }),

  // Step 5, your money
  moneyIntro: line('reading', ({ month, capital }) => `Month ${month}’s budget, and ${capital} of capital: `
    + 'build the site your clicks land on, or keep it as ad money.'),
  monthTitle: line('label', ({ month }) => `Month ${month}, to spend on clicks`),
  monthNote: line('label', ({ weeks }) => `over ${weeks} weeks · unspent money is lost at the month’s end`),
  partBase: line('label', 'the month'),
  partWriter: line('label', 'left from the writer'),
  capitalTitle: line('label', 'Capital'),
  capitalWhen: line('label', ({ week }) => `site work goes live at week ${week} · until then the money is `
    + 'spent and the site unchanged'),
  notCommitted: line('label', 'not committed'),
  lpTitle: line('label', 'Landing page grade'),
  lpNote: line('label', ({ step }) => `the third part of Quality Score · the ad’s two are in ${step}`),
  lpFrom: line('label', ({ value, scale, week }) => `${value}/${scale} from week ${week}`),
  targetPage: line('label', 'The page itself'),
  targetSize: line('label', 'Size guide'),
  targetPhoto: line('label', 'Photography'),
  targetConfirm: line('label', 'Order confirmation'),
  moves: line('label', ({ what }) => `moves: ${what}`),
  movesPage: line('label', 'the landing page grade'),
  movesSize: line('label', 'parcels sent back'),
  movesPhoto: line('label', 'how many visitors buy'),
  movesConfirm: line('label', 'parcels refused'),
  whyPage: line('reading', 'Better quality, so a cheaper click. Worth most in the middle.'),
  whySize: line('reading', 'Fewer parcels sent back after delivery. Worth most at the cheap end, and to '
    + 'anything sold on how it looks.'),
  whyPhoto: line('reading', 'More of your visitors buy. Worth most where the decision is considered.'),
  whyConfirm: line('reading', 'Fewer parcels refused at the door. Worth most where cash on delivery is '
    + 'commonest, which is the cheap end and the small towns.'),
  rung: line('label', ({ label, price }) => `${label} · ${price}`),
  tooDear: line('label', 'more than the capital left'),
  advanced: line('instruction', 'Advanced'),
  splitEven: line('reading', ({ weekly }) => `the weekly split: even, ${weekly} a week`),
  splitCustom: line('reading', ({ planned, month }) => `the weekly split: ${planned} planned of ${month}`),
  splitNotGoogle: line('disclosure', 'a decision Google does not offer', { why: 'weeklySplit' }),
  weekN: line('label', ({ n }) => `Week ${n}`),
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
