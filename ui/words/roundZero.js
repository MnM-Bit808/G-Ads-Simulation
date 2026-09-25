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

/** A purchase, mid-sentence, where the landing page grade says who earned a point. */
const PART_OF_PAGE = Object.freeze({
  landingPage: 'the page itself',
  sizeGuide: 'a size chart',
  photography: 'product shots',
});

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
  checkSquare: line('label', 'Your positioning'),
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
  breakEvenTitle: line('label', 'What a click is worth to you, at break-even', { why: 'breakEven' }),
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
  brandNote: line('instruction', 'one of nine · the rest are your rivals'),
  ownSearch: line('reading', ({ query, volume }) => `Your name is a search too: “${query}”, `
    + `about ${volume} a week. Any rival can bid on it.`, { why: 'ownName' }),
  positionIntro: line('reading', ({ rivals }) => `Nobody tells you where the other ${rivals} sit. `
    + 'Their ads are the only evidence.'),
  // ONE AD AT A TIME, since 2026-09-24. The step drew all eight at once and
  // measured 612 words; the ask below is what replaced the old `guessNote`,
  // which told a beginner to tap a grid under each of eight ads they had not
  // read yet. `adStage` in ./rules.js holds the bound.
  positionAsk: line('instruction', 'Open an ad to see where it belongs.'),
  otherRivals: line('label', ({ n }) => `The other ${n}`),
  stillUnread: line('label', 'Still unread'),
  unreadLeft: line('instruction', ({ n }) => (n === 1 ? 'one left · stop whenever you like' : `${n} left · stop whenever you like`)),
  readAd: line('label', 'read ad'),
  adOf: line('label', ({ name }) => `${name}’s ad`),
  adOnly: line('instruction', 'All anyone sees of them.'),
  closeAd: line('label', 'Close'),
  reopenAd: line('label', ({ name }) => `Read ${name}’s ad again`),
  guessNote: line('instruction', ({ placed, total }) => `${placed} of ${total} placed · none required`),
  sponsored: line('label', 'Sponsored'),
  guessFor: line('label', ({ name }) => `Where you think ${name} sits`),
  guessCell: line('label', ({ name, cell }) => `${name}: ${cell}`),
  // NOT "Pick your square", which named the widget rather than the decision: a
  // beginner reading it learned that there are squares, not that they are
  // placing a brand in a market. The real term is taught here and defined once,
  // in the chapter the why? opens.
  pickSquare: line('label', 'Brand positioning', { why: 'position' }),
  fixedUntil: line('label', ({ week }) => `fixed until week ${week}`),
  // The third sentence went on 2026-09-25: the grid already shows an empty
  // cell, so saying it was spending the step's budget on a fact on screen.
  readoutNone: line('reading', 'Price sets what a click can be worth. Purpose sets which searches are yours.'),
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
    + 'bid on, and how loosely each one matches', { why: 'keywords' }),

  // Step 4, your ad
  adIntro: line('reading', 'The only thing your rivals can see about you.', { why: 'writers' }),
  // No why? of its own: the intro right above it already opens "Who writes the
  // ad", and two links to one chapter within a line of each other is noise.
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
  // "What an ad is made of" belongs beside the drawn ad, where the headlines
  // and descriptions it names are on screen. It used to hang off "Who writes
  // it", which asks a different question.
  asSearchersSee: line('label', 'As searchers see it', { why: 'adParts' }),
  emptyHead: line('instruction', 'Your headlines appear here'),
  emptyDesc: line('instruction', 'Your descriptions appear here.'),
  headlineN: line('label', ({ n }) => `Headline ${n}`),
  descriptionN: line('label', ({ n }) => `Description ${n}`),
  charCount: line('label', ({ n, max }) => `${n}/${max}`),
  namesRival: line('reading', ({ name }) => `It names ${name}. Bidding on a rival’s name is allowed; `
    + 'naming them in your ad costs ad relevance.'),
  howItRuns: line('label', ({ week }) => `How it runs, from week ${week}`),
  twoParts: line('label', 'two of Quality Score’s three parts'),
  expectedCtr: line('label', 'Expected click-through'),
  adRelevance: line('label', 'Ad relevance'),
  byWriter: line('label', ({ writer }) => `written by the ${writer}`),
  byYou: line('label', 'written by you'),
  outOf: line('label', ({ value, scale }) => `${value}/${scale}`),
  hiredNote: line('disclosure', 'A hired ad runs at the writer’s level whatever the words say: '
    + 'this game cannot judge professional writing.', { why: 'writers' }),
  // "from the first week", not "from week 1": a digit typed into a sentence is
  // a figure the game cannot re-render, and tests/words.test.js refuses them.
  diyNote: line('disclosure', 'The grader scores your words as you type, from the first week. '
    + 'It checks rules, not taste: echoing your keywords beats reading well.', { why: 'writers' }),

  // Step 5, your money
  moneyIntro: line('reading', ({ month, capital }) => `Month ${month}’s budget, and ${capital} of capital: `
    + 'build the site, or keep it as ad money.'),
  monthTitle: line('label', ({ month }) => `Month ${month}, for clicks`, { why: 'budget' }),
  monthNote: line('label', ({ weeks }) => `over ${weeks} weeks · unspent is lost`),
  partBase: line('label', 'the month'),
  partWriter: line('label', 'left from the writer'),
  capitalTitle: line('label', 'Capital', { why: 'capital' }),
  capitalWhen: line('label', ({ week }) => `live at week ${week} · spent now either way`),
  notCommitted: line('label', 'not committed'),
  lpTitle: line('label', 'Landing page grade', { why: 'landingPage' }),
  lpNote: line('label', 'Quality Score’s third part'),
  lpFrom: line('label', ({ value, scale, week }) => `${value}/${scale} from week ${week}`),
  // Where the bar came from, in the words Your ad's total uses (design/grade-breakdown/,
  // B): the start, then each purchase that earned points, by name. A purchase that
  // earns none is not listed, so a plain page shows no line at all.
  lpParts: line('label', ({ start, parts }) => `${start} to start, `
    + parts.map(({ target, points }) => `+${points} ${PART_OF_PAGE[target]}`).join(', ')),
  // As in Your ad, the cap is shown rather than hidden in a smaller number.
  lpStops: line('label', ({ top }) => `the grade stops at ${top}`),
  targetPage: line('label', 'The page itself'),
  targetSize: line('label', 'Size guide'),
  targetPhoto: line('label', 'Photography'),
  targetConfirm: line('label', 'Order confirmation'),
  // ONE SENTENCE A CARD SINCE 2026-09-25, saying what moves and why together.
  // Each card used to carry a separate "moves: …" line, and for three of the
  // four it restated the sentence under it — `movesPhoto` "how many visitors
  // buy" against `whyPhoto` "More visitors buy". Only the page's named a thing
  // its why did not (the grade), so that is folded into the first clause here.
  //
  // BOTH THINGS THE SIZE GUIDE MOVES (the owner, 2026-09-18) survives the fold:
  // it earns a page-grade point as well as taking parcels off, because the
  // chart's sentence earns the grader's sizing point. Photography and order
  // confirmation move no grade at all since I38.
  whyPage: line('reading', 'Lifts the page grade: better quality, cheaper clicks. Worth most in the middle.'),
  whySize: line('reading', 'Fewer parcels sent back, and a better page grade. Worth most at the cheap end.'),
  whyPhoto: line('reading', 'More visitors buy. Worth most where the decision is considered.'),
  whyConfirm: line('reading', 'Fewer parcels refused at the door. Worth most where cash on delivery is commonest.'),
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
