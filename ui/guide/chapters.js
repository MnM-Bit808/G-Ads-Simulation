/**
 * The field guide's chapters (stage C2, plans/2026-09-12-content-model-and-field-guide.md).
 *
 * Where the screens' explanations go. A chapter is optional depth: the game
 * must still teach its lessons to someone who never opens one.
 *
 * EVERY CHAPTER HAS TWO HALVES, in this order:
 *
 *   real   how real Google Ads (or the Indian market) does it, in plain words,
 *          written only from the sources listed with it, fetched when it was
 *          written. Numbers may appear here, because they are claims with a
 *          source.
 *   game   what this game does and where it departs, citing the DECISIONS
 *          entries and spec sections it rests on. It types no number: figures
 *          arrive from `ui/guide/figures.js`, named in `needs`.
 *
 * Then `yourAccount`, the card where the player can watch it happen, and
 * `studioAccount` where the Studio shows it in a part the classic page has no
 * card for (found drawing the Guide as a page, 2026-09-15).
 *
 * WHEN A CITED DECISIONS ENTRY CHANGES, re-read the chapters that cite it.
 * `tests/guide.test.js` proves a citation exists, not that the chapter agrees.
 */

/**
 * A DECISIONS entry (`I27`, or a sub-entry like `G1a`), a "what it gets right"
 * item (`H2`), or a spec section (`§11.4`).
 */
const CITATION = /^([A-Z]\d+[a-z]?|§\d+(\.\d+)*)$/;

/**
 * The most a single departure may run to, checked by `tests/guide.test.js`
 * rather than here, because a departure may be a function of its figures and
 * has no length until it is rendered.
 */
export const DEPARTURE_MAX_WORDS = 25;

/**
 * @param {object} spec
 * @param {string} spec.title
 * @param {(figures: object) => string} spec.real - in real Google Ads
 * @param {Array<{label: string, url: string}>} [spec.realSources]
 * @param {boolean} [spec.device] - a game device with no real equivalent
 * @param {string[]} [spec.needs] - figures the game half quotes
 * @param {(figures: object) => string} spec.game - in this game
 * @param {string[]} spec.cites
 * @param {string} spec.yourAccount - the card's `data-slot`
 * @param {string|null} [spec.studioAccount] - the Studio part's `data-slot`,
 *   where it differs: a part only the Studio draws
 * @param {Array<string | ((figures: object) => string)>} [spec.departs] - where
 *   the game departs from the real thing, ONE PER ENTRY. A plain string, or a
 *   function of the figures it quotes; both come back as functions, the way
 *   `line()` in ui/words/line.js normalises its text.
 * @param {string} [spec.departsNot] - why it does not depart, when it does not.
 *   A reason, never a boolean. A chapter declares one or the other.
 * @param {string[]} [spec.related]
 */
export function chapter({
  title, real, realSources = [], device = false, needs = [], game, cites = [],
  departs = null, departsNot = null, yourAccount, studioAccount = null, related = [],
}) {
  if (!title) throw new TypeError('a chapter needs a title');
  if (typeof real !== 'function') throw new TypeError(`"${title}" needs its real half`);
  if (typeof game !== 'function') throw new TypeError(`"${title}" needs its game half`);
  if (!device && realSources.length === 0) {
    throw new TypeError(`"${title}": the real half needs a source, unless the chapter is a game device`);
  }
  if (cites.length === 0) throw new TypeError(`"${title}": the game half must cite what it rests on`);
  for (const id of cites) {
    if (!CITATION.test(id)) throw new TypeError(`"${title}": "${id}" is not a citation`);
  }
  if (!yourAccount) throw new TypeError(`"${title}" needs a card in your account`);

  // A DEPARTURE IS A FIELD, not a clause in the middle of the game half.
  // Measured 2026-09-19: in `hours` the departure ran to 73 words of 109 and in
  // `cashOnDelivery` 65 of 118 — the two chapters both stranger testers named as
  // the hardest to read. Five more declared none while stating one inside their
  // prose, where no reader could find it and no test could reach it.
  //
  // `departsNot` takes a REASON rather than a boolean, so a chapter claiming it
  // has nothing to disclose makes a claim the next reader can check.
  if (departs && departsNot) {
    throw new TypeError(`"${title}": declare departs or departsNot, never both`);
  }
  if (!departs && !departsNot) {
    throw new TypeError(`"${title}": say where it departs, or why it does not`);
  }
  if (departsNot !== null && typeof departsNot !== 'string') {
    throw new TypeError(`"${title}": departsNot needs a reason, not a boolean`);
  }

  return Object.freeze({
    kind: 'chapter',
    title, real, realSources: Object.freeze(realSources), device, needs: Object.freeze(needs),
    game, cites: Object.freeze(cites),
    // A plain string and a function of the figures are the same thing to a
    // reader, so they are the same thing here too.
    departs: Object.freeze((departs ?? []).map((entry) => (typeof entry === 'function' ? entry : () => entry))),
    departsNot,
    yourAccount, studioAccount, related: Object.freeze(related),
  });
}

/** Round 0's five steps: a ground-floor chapter belongs to exactly one. */
const ROUND_ZERO_STEPS = 5;

/**
 * A GROUND-FLOOR CHAPTER: what a control IS, and then where you use it.
 *
 * NOT A RELAXED `chapter()`. A nuance chapter compares the game with the real
 * thing in two halves. This describes one thing that is true, and has no second
 * half to compare against and no DECISIONS entry to rest on; forcing either
 * produces padding, or a false claim of difference. The two-halves shape is
 * also what both stranger testers could not read, and a beginner asking what a
 * keyword is wants one answer rather than a comparison
 * (plans/2026-09-19-ground-floor.md, section 2.1).
 *
 * IT NEVER DISCLOSES A DEPARTURE, and it does not need to. `then` names the
 * nuance chapter that continues it, and that chapter owns the departure. A
 * budget here is a month split across weeks where Google's is an average daily
 * budget — and `weeklySplit` is where a reader is told so.
 *
 * @param {object} spec
 * @param {string} spec.title
 * @param {(figures: object) => string} spec.plain - what it is, then where you use it
 * @param {Array<{label: string, url: string}>} [spec.sources]
 * @param {boolean} [spec.device] - a game device with no real equivalent
 * @param {string[]} [spec.needs] - figures `plain` quotes
 * @param {number} spec.step - the round 0 step that asks for it, 1 to 5
 * @param {string} spec.then - the chapter that continues it
 * @param {string|null} [spec.yourAccount] - a card, once a game exists
 */
export function basic({
  title, plain, sources = [], device = false, needs = [], step, then, yourAccount = null,
}) {
  if (!title) throw new TypeError('a ground-floor chapter needs a title');
  if (typeof plain !== 'function') throw new TypeError(`"${title}" needs its plain half`);
  if (!device && sources.length === 0) {
    throw new TypeError(`"${title}": it needs a source, unless it is a game device`);
  }
  if (!Number.isInteger(step) || step < 1 || step > ROUND_ZERO_STEPS) {
    throw new TypeError(`"${title}": say which round 0 step asks for it, 1 to ${ROUND_ZERO_STEPS}`);
  }
  if (!then) throw new TypeError(`"${title}": name the chapter that continues it`);
  return Object.freeze({
    kind: 'basic',
    title, plain, sources: Object.freeze(sources), device,
    needs: Object.freeze(needs), step, then, yourAccount,
  });
}

const GOOGLE = {
  targetCpa: {
    label: 'Google Ads Help: About Target CPA bidding',
    url: 'https://support.google.com/google-ads/answer/6268632',
  },
  keywords: {
    label: 'Google Ads Help: Keywords',
    url: 'https://support.google.com/google-ads/answer/6323',
  },
  adAuction: {
    label: 'Google Ads Help: The ad auction',
    url: 'https://support.google.com/google-ads/answer/1704431',
  },
  landingPages: {
    label: 'Google Ads Help: Optimize your ads and landing pages',
    url: 'https://support.google.com/google-ads/answer/6238826',
  },
  byClickTime: {
    label: 'Google Ads Help: Understand your conversion tracking data',
    url: 'https://support.google.com/google-ads/answer/6270625',
  },
  howLong: {
    label: 'Google Ads Help: Find out how long it takes for your customers to convert',
    url: 'https://support.google.com/google-ads/answer/6239119',
  },
  adjustments: {
    label: 'Google Ads Help: About conversion adjustments',
    url: 'https://support.google.com/google-ads/answer/7686447',
  },
  bidAdjustments: {
    label: 'Google Ads Help: About bid adjustments',
    url: 'https://support.google.com/google-ads/answer/2732132',
  },
  impressionShareData: {
    label: 'Google Ads Help: Get impression share data',
    url: 'https://support.google.com/google-ads/answer/7103314',
  },
  impressionShare: {
    label: 'Google Ads Help: About impression share',
    url: 'https://support.google.com/google-ads/answer/2497703',
  },
  simulators: {
    label: 'Google Ads Help: Estimate your results with bid, budget and target simulators',
    url: 'https://support.google.com/google-ads/answer/2470105',
  },
  matchTypes: {
    label: 'Google Ads Help: About keyword matching options',
    url: 'https://support.google.com/google-ads/answer/7478529',
  },
  searchTerms: {
    label: 'Google Ads Help: About the search terms report',
    url: 'https://support.google.com/google-ads/answer/2472708',
  },
  negatives: {
    label: 'Google Ads Help: About negative keywords',
    url: 'https://support.google.com/google-ads/answer/2453972',
  },
  trademarks: {
    label: 'Google Ads policy: Trademarks',
    url: 'https://support.google.com/adspolicy/answer/6118',
  },
  smartBidding: {
    label: 'Google Ads Help: About Smart Bidding',
    url: 'https://support.google.com/google-ads/answer/7065882',
  },
  learning: {
    label: 'Google Ads Help: Duration of the learning period for campaigns',
    url: 'https://support.google.com/google-ads/answer/13020501',
  },
  qualityScore: {
    label: 'Google Ads Help: About Quality Score for Search campaigns',
    url: 'https://support.google.com/google-ads/answer/6167118',
  },
  responsiveSearchAds: {
    label: 'Google Ads Help: About responsive search ads',
    url: 'https://support.google.com/google-ads/answer/7684791',
  },
  dailyBudgets: {
    label: 'Google Ads Help: About average daily budgets',
    url: 'https://support.google.com/google-ads/answer/6385083',
  },
  targetRoas: {
    label: 'Google Ads Help: About Target ROAS bidding',
    url: 'https://support.google.com/google-ads/answer/6268637',
  },
  conversionValues: {
    label: 'Google Ads Help: About conversion values',
    url: 'https://support.google.com/google-ads/answer/3419241',
  },
};

const INDIA = {
  pragmaRto: {
    label: 'Pragma: Understanding Return to Origin (RTO) charges',
    url: 'https://www.bepragma.ai/blogs/what-is-rto-charges',
  },
  firstResort: {
    label: 'First Resort: E-commerce returns and RTO in Indian fashion, 2026 (quoting ClickPost, GoKwik and Unicommerce)',
    url: 'https://www.firstresort.in/blogs/research/fashion-ecommerce-returns-rto-india-2026',
  },
  unicommerce: {
    label: 'Unicommerce: India D2C Report 2026',
    url: 'https://unicommerce.com/india-d2c-report-2026-april/',
  },
  balistro: {
    label: 'Balistro: Performance marketing channels ranked for D2C in India (its own campaigns, 2024–26)',
    url: 'https://www.balistro.com/blog/performance-marketing-channels-ranked-d2c-india',
  },
};

const INDUSTRY = {
  ppcChief: {
    label: 'PPC Chief: Apparel and fashion Google Ads benchmarks (its own accounts, WordStream and Store Growers)',
    url: 'https://ppcchief.com/google-ads-benchmarks/apparel-fashion',
  },
};

export const CHAPTERS = Object.freeze({
  // ---------------------------------------------------------------------
  // START HERE: one chapter per control round 0 asks you to operate, in the
  // order you meet them. What a thing IS, then where you use it.
  // ---------------------------------------------------------------------

  breakEven: basic({
    title: 'What a click is worth to you',
    plain: () => 'Before you can bid, you need to know what a visitor is worth. '
      + 'Work out what one sale earns you after returns, then how often a click becomes a sale. '
      + 'Multiply them and that is what a click is worth to you. '
      + 'Bid above it and you lose money on every click you win. '
      + 'Step 1 does the sum for where you sit.',
    // In real Google Ads you set a target cost per conversion and it works back
    // to a bid; here the sum is done for you and shown.
    sources: [GOOGLE.targetCpa],
    step: 1,
    then: 'kindMarket',
  }),

  position: basic({
    title: 'Where your brand sits',
    plain: () => 'Your brand sits at a price, and has a purpose. '
      + 'Value, mid or premium; performance or lifestyle. '
      + 'The two together are your brand positioning. '
      + 'They decide what one sale earns you, and which searches are really yours. '
      + 'Nobody tells you where the other eight sit, and their ads are the only evidence. '
      + 'You choose in step 2, and cannot move until week 5.',
    // The six squares are this game's own: real advertisers are not sorted into
    // a grid, so there is nothing to cite.
    device: true,
    step: 2,
    then: 'kindMarket',
  }),

  keywords: basic({
    title: 'Keywords: the searches you bid on',
    plain: () => 'A keyword is a word or phrase you choose. '
      + 'When someone types a search close enough to it, your ad can enter the auction for '
      + 'that search. '
      + 'You are not buying the words. You are buying the chance to appear when they are typed. '
      + 'You pick yours in step 3, and each one carries a bid of its own.',
    sources: [GOOGLE.keywords],
    step: 3,
    then: 'broadMatch',
  }),

  matchTypes: basic({
    title: 'How loosely a keyword matches',
    plain: () => 'Every keyword carries a match type. '
      + 'Exact reaches the search you wrote. Phrase reaches searches that contain it. '
      + 'Broad reaches searches merely related to it, which can be a long way from what you wrote. '
      + 'Wider reaches more people, and more of the wrong people. '
      + 'You set it beside each keyword in step 3.',
    sources: [GOOGLE.matchTypes],
    step: 3,
    then: 'broadMatch',
  }),

  bidding: basic({
    title: 'Your bid, and what you actually pay',
    plain: () => 'Your bid is the most you will pay for a click. '
      + 'It is not what you will pay. '
      + 'On every search, ads are ranked by their bid multiplied by how well they fit. '
      + 'The winner pays only enough to stay ahead of the ad below it. '
      + 'So a better ad can buy a better place for less money. '
      + 'You set a bid on each keyword in step 3.',
    sources: [GOOGLE.adAuction],
    step: 3,
    then: 'qualityScore',
  }),

  adParts: basic({
    title: 'What an ad is made of',
    plain: () => 'An ad is a set of headlines and two lines of description. '
      + 'Google chooses which to show on each search. '
      + 'It is the only thing your rivals can see about you. '
      + 'How well it fits a search decides your place as much as your bid does. '
      + 'You write it yourself, or pay someone to, in step 4.',
    sources: [GOOGLE.responsiveSearchAds],
    step: 4,
    then: 'writers',
  }),

  landingPage: basic({
    title: 'Your landing page',
    plain: () => 'The page a click lands on. '
      + 'Google judges how well it matches the ad and the search that brought someone there. '
      + 'A poor match costs you both position and price. '
      + 'It is also where a visitor decides whether to buy at all. '
      + 'You do not write it here; you build it with capital in step 5.',
    sources: [GOOGLE.landingPages],
    // STEP 5, NOT 4 (found reading the chapters, 2026-09-19). Step 4 names the
    // landing page as Quality Score's third part and sends you on; the only
    // why? that opens this chapter is on step 5's own "Landing page grade"
    // (ui/roundzero/money.js), and step 5 is where the capital that builds it
    // is spent. Labelled 4, the contents page sent a reader to a step where
    // they could neither act on it nor find it — and the chapter's own last
    // sentence already said step 5.
    step: 5,
    then: 'qualityScore',
  }),

  budget: basic({
    title: 'Your budget, and what running out means',
    plain: () => 'Your budget is what the month has to spend, divided across its four weeks. '
      + 'When a week’s money runs out your ads stop, and the searches carry on without you. '
      + 'Spending less than you could is not saving. It is searches you were never in. '
      + 'You split the month in step 5.',
    sources: [GOOGLE.dailyBudgets],
    step: 5,
    then: 'weeklySplit',
  }),

  capital: basic({
    title: 'Capital: spending on the business, not the ads',
    plain: () => 'Some of your money can go into the business instead of into ads. '
      + 'A better page, a size chart, photographs, order confirmation. '
      + 'Each takes three weeks to take effect, and then keeps paying for the rest of the game. '
      + 'Anything you do not commit becomes ad budget instead. '
      + 'You choose in step 5, and once more at week 5.',
    // Google Ads knows nothing about what a business spends on itself.
    device: true,
    step: 5,
    then: 'rankOrBudget',
  }),

  // ---------------------------------------------------------------------
  // GOING DEEPER: why a control behaves oddly, for a reader who has met it.
  // ---------------------------------------------------------------------

  // THE FIGURES A PLAYER READS TWELVE TIMES, and until 2026-09-19 the guide
  // defined none of them. Found by playing: the first screen after round 0
  // shows net profit, ROAS and CPA, and searching all twenty-two chapters for
  // any of the three turned up only the names of Google's bidding strategies.
  // The ground floor could not take it — `basic()` requires a round 0 step, and
  // reading your week belongs to none — and there is a real departure here, so
  // it is a nuance chapter.
  //
  // WHAT THE SOURCES ACTUALLY SAY, fetched rather than remembered. The first
  // draft of this chapter claimed Google cannot report profit. It can: "About
  // conversion values" gives "sales revenue or profit margins" as its own
  // examples of what to report. The true difference is narrower and is in the
  // block below — you do not choose here, and nobody uploads the return.
  readingTheWeek: chapter({
    title: 'What your week’s figures mean',
    real: () => 'Google Ads reports what you spent, how many conversions, and what they were worth. '
      + 'Return on ad spend is that value divided by the spend. '
      + 'You decide what a conversion is worth: Google’s own examples are sales revenue or profit margins. '
      + 'Cost per conversion is the spend divided by the conversions. '
      + 'A return only reaches these figures if you upload the adjustment yourself. '
      + 'A restatement changes the value; a retraction takes the conversion away.',
    realSources: [GOOGLE.targetRoas, GOOGLE.conversionValues, GOOGLE.adjustments],
    game: () => 'Net profit is what the week actually made. '
      + 'It is the margin on the orders that stuck, less the ad spend, less freight on parcels refused. '
      + 'Net ROAS counts the orders that stuck; gross counts them all, before any came back. '
      + 'Cost per conversion is the spend divided by the conversions, as Google’s is.',
    departs: [
      'You do not choose what a conversion is worth. Where your brand sits sets the order value and the margin.',
      'Returns come back on their own. A real account sees them only when you upload the adjustment yourself.',
      'Net profit has the ad spend already taken out. A conversion value in Google Ads does not.',
      'These weekly figures never charge what you spent building the business. Only the final books do.',
    ],
    cites: ['I26', 'I28', 'F14', 'I39'],
    yourAccount: 'headline',
    related: ['attributionLag', 'returnsSplit'],
  }),

  attributionLag: chapter({
    title: 'Why this week’s numbers keep moving',
    // Two days, two jobs: the day the sale is counted on, and the day the figure
    // moves. Said in one clause ("adds a conversion to Monday, on Friday") it is
    // true and reads as a typo — which the owner caught by playing it, in the one
    // chapter whose whole job is why a number changes after you have read it.
    real: () => 'Google Ads dates a conversion by the click that led to it. '
      + 'Not by the day of the sale. Someone who clicks on Monday and buys on Friday has that sale counted '
      + 'on Monday, the day of the click. Monday’s figures change on Friday — days after you '
      + 'read them. So your newest days always look weakest: their spend is counted '
      + 'in full, but many of their buyers have not bought yet. Depending on the conversion '
      + 'window you set, a sale can still be added up to 90 days after the click.',
    realSources: [GOOGLE.byClickTime, GOOGLE.howLong],
    needs: ['lagShape', 'settlesAfter'],
    game: ({ lagShape, settlesAfter }) => 'A week’s report belongs to the week its clicks '
      + `happened. It is rewritten as they arrive: ${lagShape}. `
      + 'Returns come back later still. '
      + `A week is not final until about ${settlesAfter} weeks after it ends.`,
    departs: [
      'A real account’s delay depends on what you sell and how you set it up. Here every advertiser has the same one.',
      'It is counted in whole weeks, because here a week is one turn.',
    ],
    cites: ['I27', '§11.3', '§11.4'],
    yourAccount: 'revised',
    // Smart bidding learns only from conversions that have landed.
    // `readingTheWeek` says what the figures this one moves actually are.
    related: ['readingTheWeek', 'returnsSplit', 'smartBidding'],
  }),

  returnsSplit: chapter({
    title: 'Refused at the door, or sent back',
    real: () => 'An order can come back in two ways. A parcel that is not delivered, for '
      + 'instance because it was refused at the door, goes back to the seller; Indian '
      + 'e-commerce calls this RTO, return to origin, and there was never a sale. A delivered '
      + 'order can also be sent back later, and clothing is the most-returned category, at '
      + 'roughly 25–40%. Google Ads counts the purchase when it happens and learns of neither '
      + 'unless you upload an adjustment that retracts or restates it. Until then, the return '
      + 'on ad spend it shows you is before returns.',
    realSources: [INDIA.pragmaRto, GOOGLE.adjustments],
    needs: ['rtoCod', 'rtoPrepaid', 'postDelivery', 'freight'],
    game: ({ rtoCod, rtoPrepaid, postDelivery, freight }) => 'Your returns come from your shop’s '
      + `own books. Any order can be refused at the door: ${rtoCod} of the time when paid in cash, `
      + `and ${rtoPrepaid} when prepaid. `
      + `Another ${postDelivery} of delivered orders across the country are sent back, `
      + 'more or less depending on where you sell. '
      + `Each refused parcel costs ${freight} in freight as well. `
      + 'The two halves take different fixes. A size guide reaches only send-backs; '
      + 'order confirmation and a prepaid discount reach only refusals.',
    departs: [
      'Google Ads shows you none of this. It learns of a return only if you upload one yourself.',
      'The refusal rates come from one named study, and newer reports put cash refusals higher.',
    ],
    cites: ['I28', 'F14', 'I29', 'I34'],
    yourAccount: 'returns',
    related: ['cashOnDelivery', 'attributionLag'],
  }),

  cashOnDelivery: chapter({
    title: 'Cash on delivery, and where you advertise',
    real: () => 'Most Indian online orders are still paid in cash at the door. '
      + 'ClickPost puts it at 58–65%. '
      + 'Cash parcels are refused far more often than prepaid ones: GoKwik reports about 26% '
      + 'against under 2%. '
      + 'In one festive quarter Unicommerce saw 58% of cash orders come back, against under '
      + '15% of prepaid ones. '
      + 'A refused parcel costs ₹150–300 in freight. '
      + 'Google Ads cannot see how a customer pays. What it offers is place: '
      + 'you can raise or lower bids by location, from −90% to +900%, though not under '
      + 'Smart Bidding strategies.',
    realSources: [INDIA.firstResort, INDIA.unicommerce, GOOGLE.bidAdjustments],
    needs: ['bidCap'],
    game: () => 'Cash is commoner outside the metros, and at lower prices. '
      + 'So orders from smaller cities and towns come back more often, and cost more to carry. '
      + 'Where you advertise is the lever. It shows what a click kept in each place after '
      + 'returns, and lets you bid up or down there.',
    departs: [
      'The lowest setting switches a place off completely. Google’s lowest adjustment still leaves it on.',
      'It applies under every bidding strategy, including the automated ones Google does not allow it with.',
      ({ bidCap }) => `No bid goes past ${bidCap} your keyword bid, however a place and an hour add up.`,
      'How much cash varies by price is the game’s own estimate.',
    ],
    cites: ['G4', 'I28', 'D11', 'D13'],
    yourAccount: 'places',
    // A place and an hour are both bid adjustments, under the one cap (D13).
    related: ['returnsSplit', 'hours'],
  }),

  counterfactuals: chapter({
    title: 'What only a simulation can tell you',
    real: () => 'Google Ads never sees what would have happened. '
      + 'When your budget runs out it reports the share of searches you missed because of it, '
      + 'as impression share lost to budget. '
      + 'Even the searches you were eligible for are an estimate. '
      + 'Its bid and budget simulators go further, estimating from the last 7 days of auction '
      + 'data how your ads might have performed with more money. '
      + 'They warn that conversions are the hardest part to estimate. '
      + 'Everything it tells you about the road not taken is a projection.',
    realSources: [GOOGLE.impressionShareData, GOOGLE.impressionShare, GOOGLE.simulators],
    game: () => 'This game can re-run a week exactly. '
      + 'The budget "what if" re-runs each week with only your own budget lifted to what was '
      + 'left of the month, and everyone else unchanged. '
      + 'It reports the extra traffic and whether it would have paid; orders that never '
      + 'happened are costed at your expected return rate. '
      + '"What if I hadn’t?" replays the game without one of your changes.',
    departs: [
      'Both replays are exact here and impossible in a real account, where nobody sees the road not taken.',
      'In a replay every rival repeats the moves it made. A real market might have answered differently.',
    ],
    cites: ['G1', 'G1a'],
    yourAccount: 'budget',
    // Both replays are drawn after the last week, in Results' What you learned.
    studioAccount: 'results-moments',
    // The budget "what if" answers lost to budget.
    related: ['rankOrBudget'],
  }),

  kindMarket: chapter({
    title: 'How kind this market is',
    real: () => 'Published benchmarks for apparel search ads do not agree, even on one page. '
      + 'One industry page gives apparel search ads a click-through rate of 3.2% and a '
      + 'conversion rate of 3.8% in its table by campaign type. '
      + 'But 6.8% and 4.0% as its headline averages, with a return on ad spend of 4.2×. '
      + 'An Indian agency reports ₹8–40 '
      + 'a click on category searches for D2C brands, and returns of 4.5–8× on its own '
      + 'campaigns. Neither is Indian search data from a named dataset, so treat every one of '
      + 'these as a rough range rather than a fact.',
    realSources: [INDUSTRY.ppcChief, INDIA.balistro],
    game: () => 'This market is kind, and it was measured across many. '
      + 'Ads here are clicked, and clicks buy, at least as often as those benchmarks. '
      + 'A player bidding sensibly earns returns above the Indian range, and made money in '
      + 'every market measured. A careless player can still lose money.',
    departs: [
      'The results page holds nothing but ads. No organic results or shopping units compete for the click.',
      'The base conversion rate is the game’s own estimate.',
      'There is no lifetime value, so a first order carries everything — and here it does so easily.',
    ],
    cites: ['F15', 'F17', 'B6', 'F4'],
    yourAccount: 'headline',
  }),

  rankOrBudget: chapter({
    title: 'Lost to rank, or lost to budget',
    real: () => 'Google Ads splits the searches your ad missed in two. Search lost impression '
      + 'share to budget is the share it missed because your budget ran short; lost to rank is '
      + 'the share it missed because its Ad Rank was too low in the auction. Both rest on an '
      + 'estimate: impression share divides the impressions you got by the estimated number you '
      + 'were eligible for. Google presents the figure as telling you whether your ads might '
      + 'reach more people with a higher bid or a bigger budget.',
    realSources: [GOOGLE.impressionShareData, GOOGLE.impressionShare],
    game: () => 'This game splits every week’s missed searches the same way. '
      + 'The two point at different fixes. '
      + 'Lost to budget means the money ran out first: more money helps, and so do cheaper '
      + 'clicks, while a higher bid makes each click dearer and the money runs out sooner. '
      + 'Lost to rank means your ad rank — your bid weighed by your ad’s quality — was too low. '
      + 'A better ad or a higher bid helps there, and more money does not.',
    departs: [
      'The split here is exact, because every auction you could have entered is counted. Google’s rests on an estimate.',
    ],
    cites: ['H3', 'G2'],
    yourAccount: 'share',
    related: ['counterfactuals'],
  }),

  broadMatch: chapter({
    title: 'How far broad match wanders',
    real: () => 'Exact match reaches searches with the same meaning or intent as your keyword. '
      + 'Phrase match reaches those that include its meaning. '
      + 'Broad match reaches searches related to it, which can include ones that do not carry '
      + 'its meaning at all. Google says it is critical '
      + 'to use Smart Bidding with broad match. The search terms report shows the searches your '
      + 'ad actually appeared on, and a term that is not yours becomes a negative keyword. '
      + 'Negatives do not match close variants, so plurals and synonyms have to be added '
      + 'separately.',
    realSources: [GOOGLE.matchTypes, GOOGLE.searchTerms, GOOGLE.negatives],
    game: () => 'Exact and phrase match are word matches here. '
      + 'Broad match reaches a search when enough of the concept tags the two were given from '
      + 'their words are shared. '
      + 'A distant search costs you twice: it rarely buys, and a poorer fit lowers your ad rank '
      + 'on it. '
      + 'Broadening also lowers impression share while raising impressions, because it adds '
      + 'searches faster than it wins them. '
      + 'Negatives are plain word matches, never tags.',
    departs: [
      'How far broad reaches depends on how a keyword was tagged.',
      'Broad match works under any bidding strategy. Google says to use Smart Bidding with it.',
    ],
    cites: ['E8', 'E9', 'H5', 'H6', '§8.2'],
    yourAccount: 'terms',
    // A poorer fit lowers your ad rank.
    related: ['qualityScore'],
  }),

  qualityScore: chapter({
    title: 'What the Quality Score is, and is not',
    real: () => 'Google Ads gives each keyword a Quality Score from 1 to 10. '
      + 'It is a diagnostic of how your ad quality compares to other advertisers. '
      + 'Three parts make it up: expected '
      + 'clickthrough rate, the likelihood your ad is clicked when shown; ad relevance, how '
      + 'closely your ad matches the intent behind a search; and landing page experience, how '
      + 'relevant and useful your page is to people who click. Each is rated above average, '
      + 'average or below average, against advertisers whose ads showed for the exact same '
      + 'search over the last 90 days. Google says it is not an input in the ad auction. A '
      + 'dash means too few searches exactly match the keyword to score it.',
    realSources: [GOOGLE.qualityScore],
    needs: ['qsImpressions'],
    game: ({ qsImpressions }) => 'Here too the score is a report, never an input. '
      + 'The auction weighs your ad’s quality afresh on every search, and the score is worked '
      + 'out afterwards. '
      + 'It counts only the keyword’s own literal search, in finished weeks. '
      + 'So a better ad counts in the very next auction, in your position and its price, while '
      + 'the score catches up late or never. '
      + 'Each part has three levels, against everyone on the same search. '
      + 'So a real improvement can leave it unmoved, and landing page reads above average '
      + 'only rarely. '
      + `A keyword has no score until its own search earns ${qsImpressions} impressions.`,
    departs: [
      'The overall score comes from the three ratings through a table this game invented.',
    ],
    cites: ['A1', 'A2', 'A5', 'A6'],
    yourAccount: 'keywords',
    // The writer sets two of the score's three parts.
    related: ['broadMatch', 'writers'],
  }),

  ownName: chapter({
    title: 'Defending your own name',
    real: () => 'Google’s trademark policy does not restrict using a trademark as a keyword. '
      + 'So a rival may bid on your brand’s name and appear when people search for it. '
      + 'What the policy restricts is the ad itself: '
      + 'a direct competitor using your trademark in its ad text. '
      + 'Or any ad using it in a confusing or misleading way, subject to local trademark law. '
      + 'So your own name is an auction like any other, and one you can lose.',
    realSources: [GOOGLE.trademarks],
    needs: ['ownerConv', 'poacherConv'],
    game: ({ ownerConv, poacherConv }) => 'Every brand here has its own search, and any '
      + 'advertiser may bid on it. '
      + `Someone searching your name buys from you at ${ownerConv} the usual rate, and from a `
      + `rival that poaches it at ${poacherConv} that rate. `
      + 'Defending it is cheap here because few rivals contest it, and the owner can afford to '
      + 'bid higher.',
    departs: [
      'Nothing else knows whose name it is. A searcher is no likelier to click your ad than a rival’s with the same grades.',
    ],
    cites: ['A9', '§12.1'],
    // The search terms, where a search for the player's own name is marked as
    // theirs; the auction insights say nothing about a name.
    yourAccount: 'terms',
  }),

  smartBidding: chapter({
    title: 'Smart bidding has to learn',
    real: () => 'Smart Bidding sets a bid for every auction. '
      + 'It covers Target CPA, Target ROAS, Maximise conversions and Maximise conversion value. '
      + 'The bid comes from signals such as the device, the place, the time and the search itself. '
      + 'After a new strategy or a changed setting it shows as learning. '
      + 'Google says it can take up to around 50 conversions or 3 conversion cycles to calibrate. '
      + 'It suggests judging results over a month or longer, with at least 30 conversions.',
    realSources: [GOOGLE.smartBidding, GOOGLE.learning],
    needs: ['learningWeeks', 'learningError'],
    game: ({ learningWeeks, learningError }) => 'A strategy here guesses, and never knows. '
      + 'The ones that predict conversions estimate each click’s chance of a sale from your '
      + 'own conversions that have already landed, never from the truth. '
      + 'So they start out wrong and improve with volume. '
      + 'Switching strategy, changing its target or moving position starts a learning period of '
      + `${learningWeeks} weeks, in which their predictions go wrong ${learningError} as much. `
      + 'Bid, keyword and budget changes do not.',
    departs: [
      'Learning lasts a fixed number of weeks here, rather than until enough conversions arrive.',
    ],
    cites: ['D2', '§12.3'],
    yourAccount: 'bidding',
    related: ['attributionLag', 'hours'],
  }),

  hours: chapter({
    title: 'Bidding by the hour',
    real: () => 'Google Ads lets you raise or lower your bids by day and hour. '
      + 'The ad schedule does it, from −90% to +900%. '
      + 'Adjustments usually multiply, and together they cannot raise a '
      + 'bid by more than 900%. Your ads follow the days and times the schedule sets, '
      + 'so to stop showing at an hour you leave it out. With Smart Bidding strategies such as '
      + 'Target CPA, Target ROAS and Maximise conversions, schedule adjustments are not used at '
      + 'all: Smart Bidding already sets each bid from performance by time of day.',
    realSources: [GOOGLE.bidAdjustments, GOOGLE.smartBidding],
    needs: ['bidCap'],
    game: () => 'Searches peak at one hour and buying at another. '
      + 'That gap is what an hour adjustment is for: it moves money toward the hours that buy, '
      + 'not the hours that are busy.',
    departs: [
      'The lowest setting takes you out of an hour completely. Google’s lowest still leaves you in it.',
      'It works under every bidding strategy. Under the ones that predict conversions the hour counts twice, which Google does not allow.',
      ({ bidCap }) => `No bid goes past ${bidCap} your keyword bid, however an hour and a place add up.`,
    ],
    cites: ['D11', 'H4', 'D2', 'D13'],
    yourAccount: 'hours',
    related: ['smartBidding', 'cashOnDelivery'],
  }),

  writers: chapter({
    title: 'Who writes the ad',
    real: () => 'A search ad in Google Ads is built from headlines and descriptions: '
      + 'up to 15 headlines of up to 30 characters, and 4 descriptions of up to 90. '
      + 'Google assembles them into combinations, testing which are most relevant. At least '
      + 'one headline and one description show at a time. Two of Quality Score’s three parts '
      + 'are about the ad: expected clickthrough rate, the likelihood it is clicked when shown, '
      + 'and ad relevance, how closely it matches the intent behind a search. The third, '
      + 'landing page experience, is how relevant and useful your page is to people who click.',
    realSources: [GOOGLE.responsiveSearchAds, GOOGLE.qualityScore],
    game: () => 'Before the first week you choose who writes the ad. '
      + 'That sets two of Quality Score’s three parts: expected click-through and ad relevance. '
      + 'A hired writer’s ad runs at the writer’s level whatever the words say, because this '
      + 'game cannot judge professional writing. '
      + 'Writing it yourself costs nothing, and the grader scores your words by rules rather '
      + 'than taste: echoing your own keywords counts for more than reading well. '
      + 'Both run from the first week, and what the writer does not cost goes to your ads. '
      + 'So the fee buys not having to write, and insurance against writing badly. '
      + 'The landing page is built with capital.',
    departs: [
      'Google’s Quality Score has no part for who wrote the ad.',
    ],
    cites: ['I11', 'I10', 'I25', 'I9'],
    // The classic page draws the ad on no card; the Studio's Your ad does.
    yourAccount: 'keywords',
    studioAccount: 'writer',
    related: ['qualityScore'],
  }),

  weeklySplit: chapter({
    title: 'Splitting the month into weeks',
    real: () => 'Google Ads budgets by the day. '
      + 'You set an average daily budget for each campaign: the average amount it spends per day. '
      + 'On a particular day it may spend up to twice that, for most campaigns. '
      + 'Google moves spend toward the days of the month when you are more likely to get '
      + 'clicks and conversions. '
      + 'Across a month it stays within 30.4 times the daily figure.',
    realSources: [GOOGLE.dailyBudgets],
    game: () => 'A month’s money is yours to divide across its four weeks. '
      + 'It is a fixed amount, split evenly unless you change it. '
      + 'Within a week it is paced across the days and hours. '
      + 'A week spends what it was given and no more. '
      + 'Money left when the month ends is lost: nothing carries over, so hoarding cannot win.',
    departs: [
      'Google works from a daily average and moves spend between days for you.',
      'Here how the month is divided is yours to set, which is why the split exists, and yours to read afterwards.',
    ],
    cites: ['D10', '§13.2', 'D1'],
    yourAccount: 'split',
    related: ['rankOrBudget'],
  }),
});

/** The guide's contents list, in reading order. */
/**
 * The ground floor, in the order round 0 asks for each control.
 *
 * `START_HERE` and `GOING_DEEPER` are separate only so the contents page can
 * head them separately. THE BOOK IS ONE LIST: numbering, "of 22" and the
 * chapter either side all read `CONTENTS`, and turning the page at the end of
 * the ground floor lands on the first nuance chapter, which is the ladder the
 * design asks for (plans/2026-09-19-ground-floor.md, section 2.3).
 */
export const START_HERE = Object.freeze([
  'breakEven', 'position', 'keywords', 'matchTypes', 'bidding',
  'adParts', 'landingPage', 'budget', 'capital',
]);

/**
 * The nuance chapters. `readingTheWeek` opens them (added 2026-09-19): what the
 * six figures ARE has to come before why they move, and both belong to the
 * first screen a player meets after round 0.
 */
export const GOING_DEEPER = Object.freeze([
  'readingTheWeek',
  'attributionLag', 'returnsSplit', 'cashOnDelivery', 'rankOrBudget', 'broadMatch',
  'qualityScore', 'writers', 'ownName', 'smartBidding', 'hours', 'weeklySplit',
  'counterfactuals', 'kindMarket',
]);

export const CONTENTS = Object.freeze([...START_HERE, ...GOING_DEEPER]);

// `then` cannot be checked inside `basic()`, because CHAPTERS does not exist
// while it runs. Checked once here instead, rather than handing the factory a
// default argument that would exist only to satisfy a test.
for (const id of START_HERE) {
  const to = CHAPTERS[id].then;
  if (!CHAPTERS[to]) {
    throw new RangeError(`"${id}" continues into "${to}", which is not a chapter`);
  }
}
