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
 * Then `yourAccount`, the card where the player can watch it happen.
 *
 * WHEN A CITED DECISIONS ENTRY CHANGES, re-read the chapters that cite it.
 * `tests/guide.test.js` proves a citation exists, not that the chapter agrees.
 */

/** A DECISIONS entry (`I27`), a "what it gets right" item (`H2`), or a spec section (`§11.4`). */
const CITATION = /^([A-Z]\d+|§\d+(\.\d+)*)$/;

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
 * @param {string[]} [spec.related]
 */
export function chapter({
  title, real, realSources = [], device = false, needs = [], game, cites = [],
  yourAccount, related = [],
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
    game, cites: Object.freeze(cites), yourAccount, related: Object.freeze(related),
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
    game: ({ rtoCod, rtoPrepaid, postDelivery, freight }) => 'Here the returns card is your '
      + 'shop’s own books, which Google Ads would show only if you uploaded them. Every order '
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
    game: () => 'The game makes cash commoner outside the metros and at lower prices, so '
      + 'orders from smaller cities and towns come back more often and cost more to carry. '
      + 'The Where you advertise card is the lever: it shows what a click kept in each place '
      + 'after returns, and lets you bid up or down there. It departs in two ways: an '
      + 'adjustment can switch a place off entirely, where Google’s lowest adjustment still '
      + 'leaves it on; and it applies under every bidding strategy, including the automated '
      + 'ones Google does not allow it with. How cash varies by price is the game’s own '
      + 'estimate.',
    cites: ['G4', 'I28', 'D11'],
    yourAccount: 'places',
    related: ['returnsSplit'],
  }),
});

/** The guide's contents list, in reading order. */
export const CONTENTS = Object.freeze(['attributionLag', 'returnsSplit', 'cashOnDelivery']);
