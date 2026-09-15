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
 * @param {string[]} [spec.related]
 */
export function chapter({
  title, real, realSources = [], device = false, needs = [], game, cites = [],
  yourAccount, studioAccount = null, related = [],
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
  return Object.freeze({
    title, real, realSources: Object.freeze(realSources), device, needs: Object.freeze(needs),
    game, cites: Object.freeze(cites), yourAccount, studioAccount, related: Object.freeze(related),
  });
}

const GOOGLE = {
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
  attributionLag: chapter({
    title: 'Why this week’s numbers keep moving',
    real: () => 'Google Ads dates a conversion by the click that led to it, not by the day '
      + 'of the sale. Someone who clicks on Monday and buys on Friday adds a conversion to '
      + 'Monday, on Friday. So your newest days always look weakest: their spend is counted '
      + 'in full, but many of their buyers have not bought yet. Depending on the conversion '
      + 'window you set, a sale can still be added up to 90 days after the click.',
    realSources: [GOOGLE.byClickTime, GOOGLE.howLong],
    needs: ['lagShape', 'settlesAfter'],
    game: ({ lagShape, settlesAfter }) => 'This game keeps the same rule, a week at a time. '
      + 'Each week’s report belongs to the week of its clicks and is rewritten as orders '
      + `arrive: ${lagShape}. Returns then need their own time to come back, so a week is `
      + `final about ${settlesAfter} weeks after it happens. Where it departs: a real `
      + 'account’s delay depends on what you sell and how you set it up, while here every '
      + 'advertiser shares one fixed shape, counted in weeks because each turn is a week.',
    cites: ['I27', '§11.3', '§11.4'],
    yourAccount: 'revised',
    related: ['returnsSplit'],
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
    game: ({ rtoCod, rtoPrepaid, postDelivery, freight }) => 'Here the game shows your returns from '
      + 'your shop’s own books, which Google Ads would show only if you uploaded them. Every order '
      + `can be refused at the door, ${rtoCod} of the time when paid in cash and ${rtoPrepaid} `
      + `when prepaid, and ${postDelivery} of delivered orders are sent back. Each refused `
      + `parcel also costs ${freight} in freight. The two halves have different fixes: a size `
      + 'guide reaches only send-backs, while order confirmation and a prepaid discount reach '
      + 'only refusals. The refusal rates come from one named study; newer reports put cash '
      + 'refusals higher.',
    cites: ['I28', 'F14', 'I29', 'I34'],
    yourAccount: 'returns',
    related: ['cashOnDelivery', 'attributionLag'],
  }),

  cashOnDelivery: chapter({
    title: 'Cash on delivery, and where you advertise',
    real: () => 'Most Indian online orders are still paid in cash at the door, 58–65% by '
      + 'ClickPost’s count, and cash parcels are refused far more often than prepaid ones: '
      + 'GoKwik reports about 26% against under 2%, and in one festive quarter Unicommerce saw '
      + '58% of cash orders come back against under 15% of prepaid ones. A refused parcel costs '
      + '₹150–300 in freight. Google Ads cannot see how a customer pays. What it offers is '
      + 'place: you can raise or lower bids by location, from −90% to +900%, though not under '
      + 'Smart Bidding strategies.',
    realSources: [INDIA.firstResort, INDIA.unicommerce, GOOGLE.bidAdjustments],
    needs: ['bidCap'],
    game: ({ bidCap }) => 'The game makes cash commoner outside the metros and at lower prices, so '
      + 'orders from smaller cities and towns come back more often and cost more to carry. '
      + 'Where you advertise is the lever: it shows what a click kept in each place '
      + 'after returns, and lets you bid up or down there. It departs in three ways: an '
      + 'adjustment can switch a place off entirely, where Google’s lowest adjustment still '
      + 'leaves it on; it applies under every bidding strategy, including the automated '
      + `ones Google does not allow it with; and no bid goes past ${bidCap} your keyword bid, `
      + 'however the place’s and the hour’s adjustments stack. How cash varies by price is '
      + 'the game’s own estimate.',
    cites: ['G4', 'I28', 'D11', 'D13'],
    yourAccount: 'places',
    related: ['returnsSplit'],
  }),

  counterfactuals: chapter({
    title: 'What only a simulation can tell you',
    real: () => 'Google Ads never sees what would have happened. When your budget runs out, it '
      + 'reports the share of searches you missed because of it, as impression share lost to '
      + 'budget, and even the searches you were eligible for are an estimate. Its bid and budget '
      + 'simulators go further, estimating from the last 7 days of auction data how your ads '
      + 'might have performed with more money, and they warn that conversions are the hardest '
      + 'part to estimate. Everything it tells you about the road not taken is a projection.',
    realSources: [GOOGLE.impressionShareData, GOOGLE.impressionShare, GOOGLE.simulators],
    game: () => 'This game can re-run a week exactly. The budget "what if" re-runs each week with '
      + 'only your own budget lifted to what was left of the month, everyone else unchanged, and '
      + 'reports the extra traffic and whether it would have paid; orders that never happened are '
      + 'costed at your expected return rate. "What if I hadn’t?" replays the game without '
      + 'one of your changes, with every rival making the moves it made in your game, though a '
      + 'real market might have answered differently. Both are exact inside the game and '
      + 'impossible outside it.',
    cites: ['G1', 'G1a'],
    yourAccount: 'budget',
    // Both replays are drawn after the last week, in Results' What you learned.
    studioAccount: 'results-moments',
  }),

  kindMarket: chapter({
    title: 'How kind this market is',
    real: () => 'Published benchmarks for apparel search ads do not agree, even on one page. '
      + 'One industry page gives apparel search ads a click-through rate of 3.2% and a '
      + 'conversion rate of 3.8% in its table by campaign type, but 6.8% and 4.0% as its '
      + 'headline averages, with a return on ad spend of 4.2×. An Indian agency reports ₹8–40 '
      + 'a click on category searches for D2C brands, and returns of 4.5–8× on its own '
      + 'campaigns. Neither is Indian search data from a named dataset, so treat every one of '
      + 'these as a rough range rather than a fact.',
    realSources: [INDUSTRY.ppcChief, INDIA.balistro],
    game: () => 'Measured across many markets, ads here are clicked, and clicks buy, at least as '
      + 'often as those benchmarks, and a player bidding sensibly earns returns at the top of the '
      + 'Indian range and made money in every market measured. Three choices make it kinder '
      + 'than a real market: the results page holds nothing but ads, so no organic results or '
      + 'shopping units compete for the click; the base conversion rate is the game’s own '
      + 'estimate; and there is no lifetime value, so the first order must carry everything, '
      + 'and here it does so easily. A careless player can still lose money.',
    cites: ['F15', 'B6', 'F4'],
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
    game: () => 'This game splits every week’s missed searches the same way, but exactly, because it '
      + 'counts every auction you could have entered. The two point at different fixes. Lost to '
      + 'budget means the money ran out first: more money helps, and so do cheaper clicks, while '
      + 'a higher bid makes each click dearer and the money runs out sooner. Lost to rank means '
      + 'your ad rank, your bid weighed by your ad’s quality, was too low: a better ad or a '
      + 'higher bid helps, and more money does not.',
    cites: ['H3', 'G2'],
    yourAccount: 'share',
    related: ['counterfactuals'],
  }),

  broadMatch: chapter({
    title: 'How far broad match wanders',
    real: () => 'Exact match reaches searches with the same meaning or intent as your keyword, '
      + 'phrase match those that include its meaning, and broad match searches related to it, '
      + 'which can include ones that do not carry its meaning at all. Google says it is critical '
      + 'to use Smart Bidding with broad match. The search terms report shows the searches your '
      + 'ad actually appeared on, and a term that is not yours becomes a negative keyword. '
      + 'Negatives do not match close variants, so plurals and synonyms have to be added '
      + 'separately.',
    realSources: [GOOGLE.matchTypes, GOOGLE.searchTerms, GOOGLE.negatives],
    game: () => 'Here exact and phrase match are word matches, and broad match reaches a search '
      + 'when enough of the concept tags the two were given from their words are shared. A '
      + 'distant search costs twice: it rarely buys, and a poorer fit lowers your ad rank on it. '
      + 'Broadening also lowers impression share while raising impressions, because it adds '
      + 'searches faster than it wins them. Negatives are plain word matches, never tags. Where '
      + 'it departs: how far broad reaches depends on how a keyword was tagged, and broad works '
      + 'under any strategy.',
    cites: ['E8', 'E9', 'H5', 'H6', '§8.2'],
    yourAccount: 'terms',
  }),

  qualityScore: chapter({
    title: 'What the Quality Score is, and is not',
    real: () => 'Google Ads gives each keyword a Quality Score from 1 to 10, a diagnostic of '
      + 'how your ad quality compares to other advertisers. Three parts make it up: expected '
      + 'clickthrough rate, the likelihood your ad is clicked when shown; ad relevance, how '
      + 'closely your ad matches the intent behind a search; and landing page experience, how '
      + 'relevant and useful your page is to people who click. Each is rated above average, '
      + 'average or below average, against advertisers whose ads showed for the exact same '
      + 'search over the last 90 days. Google says it is not an input in the ad auction. A '
      + 'dash means too few searches exactly match the keyword to score it.',
    realSources: [GOOGLE.qualityScore],
    needs: ['qsImpressions'],
    game: ({ qsImpressions }) => 'Here too the score is a report, never an input: the '
      + 'auction weighs your ad’s quality afresh on every search, and the score is worked out '
      + 'afterwards. It counts only the keyword’s own literal search, in finished weeks, so a '
      + 'better ad counts in the very next auction, in your position and its price, while the '
      + 'score catches up late or never. Each part has three levels against everyone on the '
      + 'same search, so a real improvement can leave it unmoved, and landing page reads '
      + `above average only rarely. A keyword has no score until its own search earns `
      + `${qsImpressions} impressions. Where it departs: the overall score comes from the `
      + 'three ratings through a table this game invented.',
    cites: ['A1', 'A2', 'A5', 'A6'],
    yourAccount: 'keywords',
    related: ['broadMatch'],
  }),

  ownName: chapter({
    title: 'Defending your own name',
    real: () => 'Google’s trademark policy does not restrict using a trademark as a keyword, so '
      + 'a rival may bid on your brand’s name and appear when people search for it. What the '
      + 'policy restricts is the ad itself: a direct competitor using your trademark in its ad '
      + 'text, or any ad using it in a confusing or misleading way, subject to local trademark '
      + 'law. So your own name is an auction like any other, and one you can lose.',
    realSources: [GOOGLE.trademarks],
    needs: ['ownerConv', 'poacherConv'],
    game: ({ ownerConv, poacherConv }) => 'Every brand here has its own search, and any '
      + 'advertiser may bid on it. Someone searching your name buys from you at '
      + `${ownerConv} the usual rate, and from a rival that poaches it at ${poacherConv} that `
      + 'rate. Nothing else knows whose name it is: the searcher is no likelier to click your '
      + 'ad than a rival’s with the same grades. Defending it is cheap here because few rivals '
      + 'contest it and the owner can afford to bid higher, not because searchers prefer the '
      + 'name they typed.',
    cites: ['A9', '§12.1'],
    // The search terms, where a search for the player's own name is marked as
    // theirs; the auction insights say nothing about a name.
    yourAccount: 'terms',
  }),

  smartBidding: chapter({
    title: 'Smart bidding has to learn',
    real: () => 'Smart Bidding, which covers Target CPA, Target ROAS, Maximise conversions and '
      + 'Maximise conversion value, sets a bid for every auction from signals such as the '
      + 'device, the place, the time and the search itself. After a new strategy or a changed '
      + 'setting it shows as learning, and Google says it can take up to around 50 conversions '
      + 'or 3 conversion cycles to calibrate. It suggests judging results over a month or '
      + 'longer, with at least 30 conversions.',
    realSources: [GOOGLE.smartBidding, GOOGLE.learning],
    needs: ['learningWeeks', 'learningError'],
    game: ({ learningWeeks, learningError }) => 'Here the strategies that predict conversions '
      + 'estimate each click’s chance of a sale from your own conversions that have already '
      + 'landed, never from the truth, so they start out wrong and improve with volume. '
      + `Switching strategy, changing its target or moving position starts a learning period of ${learningWeeks} `
      + `weeks in which their predictions go wrong ${learningError} as much. Bid, keyword and `
      + 'budget changes do not. Where it departs: learning lasts a fixed number of weeks rather '
      + 'than until enough conversions arrive.',
    cites: ['D2', '§12.3'],
    yourAccount: 'bidding',
    related: ['attributionLag', 'hours'],
  }),

  hours: chapter({
    title: 'Bidding by the hour',
    real: () => 'Google Ads lets you raise or lower your bids by day and hour through the ad '
      + 'schedule, from −90% to +900%. Adjustments usually multiply, and together they cannot raise a '
      + 'bid by more than 900%. Your ads follow the days and times the schedule sets, '
      + 'so to stop showing at an hour you leave it out. With Smart Bidding strategies such as '
      + 'Target CPA, Target ROAS and Maximise conversions, schedule adjustments are not used at '
      + 'all: Smart Bidding already sets each bid from performance by time of day.',
    realSources: [GOOGLE.bidAdjustments, GOOGLE.smartBidding],
    needs: ['bidCap'],
    game: ({ bidCap }) => 'Here searches peak at one time of day and buying at another, which is what '
      + 'makes an hour adjustment pay: it can move money toward the hours that convert rather '
      + 'than the hours that are busy. It departs three times. The lowest setting takes you out '
      + 'of an hour altogether, where Google’s lowest still leaves you in it. The adjustment '
      + 'works under every strategy: under the ones that predict conversions it lands on top '
      + 'of the strategy’s own lean by hour, so the hour counts twice, which Google does not '
      + `allow. And no bid goes past ${bidCap} your keyword bid, however the hour’s and the `
      + 'place’s adjustments stack.',
    cites: ['D11', 'H4', 'D2', 'D13'],
    yourAccount: 'hours',
    related: ['smartBidding'],
  }),

  writers: chapter({
    title: 'Who writes the ad',
    real: () => 'A search ad in Google Ads is built from headlines and descriptions: up to 15 '
      + 'headlines of up to 30 characters and 4 descriptions of up to 90, which Google '
      + 'assembles into combinations, testing them to learn which are most relevant. At least '
      + 'one headline and one description show at a time. Two of Quality Score’s three parts '
      + 'are about the ad: expected clickthrough rate, the likelihood it is clicked when shown, '
      + 'and ad relevance, how closely it matches the intent behind a search. The third, '
      + 'landing page experience, is how relevant and useful your page is to people who click.',
    realSources: [GOOGLE.responsiveSearchAds, GOOGLE.qualityScore],
    game: () => 'Before the first week you choose who writes the ad, which sets two of Quality '
      + 'Score’s three parts: expected click-through and ad relevance. A hired writer’s ad runs '
      + 'at the writer’s level whatever the words say, because this game cannot judge '
      + 'professional writing. Writing it yourself costs nothing, and the game’s grader scores '
      + 'your words by rules, not taste: echoing your own keywords counts for more than reading '
      + 'well. Both run from the first week, and what the writer does not cost goes to your ads, '
      + 'so the fee buys not having to write, and insurance against writing badly. The landing '
      + 'page is built with capital. Where it departs: Google’s Quality Score has no part for '
      + 'who wrote the ad.',
    cites: ['I11', 'I10', 'I25', 'I9'],
    // The classic page draws the ad on no card; the Studio's Your ad does.
    yourAccount: 'keywords',
    studioAccount: 'writer',
    related: ['qualityScore'],
  }),

  weeklySplit: chapter({
    title: 'Splitting the month into weeks',
    real: () => 'Google Ads budgets by the day: you set an average daily budget for each '
      + 'campaign, the average amount it spends per day. On a particular day it may spend up to '
      + 'twice that, for most campaigns, because Google leans spend toward the days of the month '
      + 'when you are more likely to get clicks and conversions. Across a month it stays within '
      + '30.4 times the daily figure.',
    realSources: [GOOGLE.dailyBudgets],
    game: () => 'Here each month’s money is a fixed amount you divide across its four weeks, '
      + 'evenly unless you change the split, and within a week it is paced across the days and '
      + 'hours. A week spends what it was given and no more, and money left when the month ends '
      + 'is lost: nothing carries over, so hoarding cannot win. Where it departs: Google works '
      + 'from a daily average and moves spend between days for you; here the shape of the month '
      + 'is yours to set, which is why the split exists, and yours to read afterwards.',
    cites: ['D10', '§13.2', 'D1'],
    yourAccount: 'split',
    related: ['rankOrBudget'],
  }),
});

/** The guide's contents list, in reading order. */
export const CONTENTS = Object.freeze([
  'attributionLag', 'returnsSplit', 'cashOnDelivery', 'rankOrBudget', 'broadMatch',
  'qualityScore', 'writers', 'ownName', 'smartBidding', 'hours', 'weeklySplit',
  'counterfactuals', 'kindMarket',
]);
