/**
 * The query set (spec 7.1). Authored, validated, frozen.
 *
 * HOW TO READ THIS FILE
 *
 * The bottom half builds a QuerySet from the authored source at the top. The
 * source is written in relative weights rather than basis points so it stays
 * editable by hand; allocate() converts weights to basis points that sum to
 * exactly 10000, at every level, by construction.
 *
 * Per query:
 *   t     the search text, as a person would type it
 *   tags  concept tags, all from TAG_VOCABULARY. Only broad match reads these
 *   w     relative volume weight within its cell. Head terms carry more
 *   head   short generic string a player might plausibly write as a keyword.
 *          At least three per cell or literal-match reportedScore never
 *          populates and the whole 9.3 diagnostic is dead weight (spec 7.4)
 *   soft   contested: affinities flatten, so several positions want it
 *   hp     hour profile: business, evening or flat
 *   conv   intent strength. How ready to buy this searcher is, for ANYONE
 *   val    basket size. Sets and multi-item searches run higher
 *   ret    fit risk. Sizing-critical items come back more often
 *
 * THE LINE BETWEEN conv AND AFFINITY
 *
 * Both multiply into the conversion chain (12.1), so they must not blur:
 *   conv     = how ready to buy this searcher is, regardless of who sells
 *   affinity = how well this searcher fits YOUR position
 * Let them both drift into meaning "good query" and they double-count, and the
 * positioning lesson goes with them.
 *
 * VOLUME BUDGET, in basis points of 10000
 *   commercial     8400   territory, allocated per cell — see below
 *   brand           600   one per advertiser, all nine (7.5)
 *   informational   400   converts at 10% of baseline. A trap, not a signpost
 *   irrelevant      600   converts at exactly zero. This waste is the lesson
 *
 * HOW THE COMMERCIAL 8400 IS SPLIT
 *
 * Each cell's share tracks 1/break-even, so that territory x break-even comes
 * out roughly equal across all six and no position is structurally richer.
 *
 * The first version split the three price tiers 52/28/20 — which was right —
 * and then split each tier EVENLY between its two purposes, which was not. The
 * purpose modifier moves break-even by 5-12%, so an even split leaves the
 * lower-break-even cell of each pair short of volume. In the Value tier the
 * two were effectively transposed: value|performance has the lower break-even
 * and needs MORE volume, and it had less.
 *
 * Diagnosing I3 found this. Tier shares now land at 52.7 / 27.9 / 19.4, inside
 * the validator's five-point tolerance, and the per-cell figures are:
 *
 *   value|performance   2266   27.0%      premium|performance   861   10.3%
 *   value|lifestyle     2159   25.7%      premium|lifestyle     770    9.2%
 *   mid|performance     1224   14.6%
 *   mid|lifestyle       1120   13.3%
 */

import { TAG_VOCABULARY, SCHEMA_VERSION, PRICE_TIERS, WEEKLY_VOLUME } from '../engine/constants.js';
import { allocate } from '../engine/money.js';
import { BRAND_IDENTITIES } from './brands.js';

// ---------------------------------------------------------------------------
// Commercial territory
// ---------------------------------------------------------------------------

const TERRITORY = {
  // Budget searching is rarely the word "cheap" repeated. It is price points,
  // multipacks, offers and clearance - marketplace vocabulary. Only two queries
  // here lead with an adjective; the rest name a number or a deal.
  'value|performance': {
    bp: 2266,
    queries: [
      { t: 'cheap gym leggings', tags: ['leggings', 'gym', 'cheap', 'women'], w: 11, head: true, soft: true, hp: 'evening' },
      { t: 'gym wear sale', tags: ['gym', 'sale'], w: 10, head: true, soft: true, conv: 1.2, hp: 'evening' },
      { t: 'budget gym wear women', tags: ['gym', 'budget', 'women'], w: 9, head: true, soft: true, hp: 'business' },
      { t: 'sports bra combo pack', tags: ['sports-bra', 'combo', 'budget'], w: 8, head: true, val: 1.3, ret: 1.15, hp: 'evening' },
      { t: 'gym leggings under 999', tags: ['leggings', 'gym', 'budget'], w: 7, val: 0.8, conv: 1.2, hp: 'evening' },
      { t: 'sports bra under 500', tags: ['sports-bra', 'budget'], w: 6, val: 0.75, conv: 1.2, ret: 1.15, hp: 'evening' },
      { t: 'leggings under 499', tags: ['leggings', 'budget'], w: 6, val: 0.7, conv: 1.25, hp: 'evening' },
      { t: 'pack of 2 gym leggings', tags: ['leggings', 'gym', 'combo'], w: 5, val: 1.4, conv: 1.15, hp: 'evening' },
      { t: 'workout tshirt under 300', tags: ['tshirt', 'training', 'budget'], w: 5, val: 0.7, conv: 1.25, ret: 0.9, hp: 'business' },
      { t: 'gym leggings offer today', tags: ['leggings', 'gym', 'sale'], w: 5, conv: 1.3, hp: 'evening' },
      { t: 'best gym leggings under 1000', tags: ['leggings', 'gym', 'budget', 'compare'], w: 4, conv: 0.9, hp: 'evening' },
      { t: 'running shorts under 400', tags: ['shorts', 'running', 'budget'], w: 4, val: 0.7, conv: 1.2, hp: 'evening' },
      { t: 'gym wear clearance sale', tags: ['gym', 'sale', 'discount'], w: 4, conv: 1.25, hp: 'evening' },
      { t: 'yoga pants under 600', tags: ['pants', 'yoga', 'budget'], w: 4, val: 0.8, conv: 1.2, hp: 'evening' },
      { t: 'compression tights under 999', tags: ['leggings', 'compression', 'budget'], w: 3, val: 0.8, ret: 1.15, hp: 'evening' },
      { t: 'gym tshirt combo women', tags: ['tshirt', 'gym', 'combo', 'women'], w: 3, val: 1.35, ret: 0.9, hp: 'business' },
      { t: 'buy gym leggings online low price', tags: ['leggings', 'gym', 'buy', 'online'], w: 3, conv: 1.3, hp: 'evening' },
      { t: 'discount activewear india', tags: ['training', 'discount', 'india'], w: 3, hp: 'evening' },
      { t: 'leggings 2 pack women', tags: ['leggings', 'combo', 'women'], w: 3, val: 1.4, hp: 'evening' },
      { t: 'cheap gym tights women', tags: ['leggings', 'gym', 'cheap', 'women'], w: 3, hp: 'evening' },
    ],
  },

  'value|lifestyle': {
    bp: 2159,
    queries: [
      { t: 'cheap athleisure', tags: ['casual', 'cheap', 'women'], w: 11, head: true, soft: true, hp: 'evening' },
      { t: 'co ord set sale', tags: ['co-ord-set', 'sale'], w: 10, head: true, soft: true, val: 1.3, conv: 1.2, hp: 'evening' },
      { t: 'budget loungewear', tags: ['lounge', 'budget', 'women'], w: 9, head: true, soft: true, hp: 'evening' },
      { t: 'leggings combo pack', tags: ['leggings', 'combo'], w: 9, head: true, val: 1.4, hp: 'evening' },
      { t: 'co ord set under 999', tags: ['co-ord-set', 'budget'], w: 7, val: 0.9, conv: 1.2, hp: 'evening' },
      { t: 'loungewear set under 799', tags: ['lounge', 'co-ord-set', 'budget'], w: 7, val: 0.85, conv: 1.2, hp: 'evening' },
      { t: 'joggers under 599', tags: ['joggers', 'budget'], w: 6, val: 0.75, conv: 1.25, ret: 0.9, hp: 'evening' },
      { t: 'lounge pants under 499', tags: ['pants', 'lounge', 'budget'], w: 6, val: 0.7, conv: 1.25, ret: 0.9, hp: 'evening' },
      { t: 'oversized tshirt under 399', tags: ['tshirt', 'oversized', 'budget'], w: 5, val: 0.7, conv: 1.25, ret: 0.85, hp: 'evening' },
      { t: 'matching set sale women', tags: ['co-ord-set', 'sale', 'women'], w: 5, val: 1.3, conv: 1.2, hp: 'evening' },
      { t: 'everyday leggings pack of 3', tags: ['leggings', 'everyday', 'combo'], w: 5, val: 1.5, hp: 'evening' },
      { t: 'flared leggings under 699', tags: ['leggings', 'flared', 'budget'], w: 4, val: 0.8, ret: 1.2, hp: 'evening' },
      { t: 'joggers combo women', tags: ['joggers', 'combo', 'women'], w: 4, val: 1.4, ret: 0.9, hp: 'evening' },
      { t: 'crop top under 299', tags: ['tank', 'cropped', 'budget'], w: 4, val: 0.65, conv: 1.25, ret: 1.2, hp: 'evening' },
      { t: 'athleisure clearance sale', tags: ['casual', 'sale', 'discount'], w: 4, conv: 1.25, hp: 'evening' },
      { t: 'best co ord set under 1000', tags: ['co-ord-set', 'budget', 'compare'], w: 4, conv: 0.9, hp: 'evening' },
      { t: 'lounge set offer india', tags: ['lounge', 'co-ord-set', 'sale', 'india'], w: 3, val: 1.3, conv: 1.25, hp: 'evening' },
      { t: 'leggings multipack women', tags: ['leggings', 'combo', 'women'], w: 3, val: 1.45, hp: 'evening' },
      { t: 'budget friendly loungewear', tags: ['lounge', 'budget'], w: 3, hp: 'evening' },
      { t: 'casual joggers under 799', tags: ['joggers', 'casual', 'budget'], w: 3, val: 0.85, conv: 1.2, ret: 0.9, hp: 'evening' },
    ],
  },

  'mid|performance': {
    bp: 1224,
    queries: [
      { t: 'gym leggings', tags: ['leggings', 'gym'], w: 12, head: true, soft: true, hp: 'evening' },
      { t: 'workout leggings', tags: ['leggings', 'training'], w: 11, head: true, soft: true, hp: 'evening' },
      { t: 'sports bra high impact', tags: ['sports-bra', 'training', 'women'], w: 9, head: true, soft: true, ret: 1.2, hp: 'evening' },
      { t: 'gym tights for women', tags: ['leggings', 'gym', 'women'], w: 8, head: true, hp: 'evening' },
      { t: 'running leggings women', tags: ['leggings', 'running', 'women'], w: 7, hp: 'evening' },
      { t: 'high waisted gym leggings', tags: ['leggings', 'high-waisted', 'gym'], w: 7, ret: 1.15, hp: 'evening' },
      { t: 'training shorts women', tags: ['shorts', 'training', 'women'], w: 6, hp: 'business' },
      { t: 'workout tshirt women', tags: ['tshirt', 'training', 'women'], w: 6, ret: 0.9, hp: 'business' },
      { t: 'buy gym wear for women online', tags: ['gym', 'women', 'buy', 'online'], w: 5, conv: 1.3, hp: 'evening' },
      { t: 'sports bra for gym', tags: ['sports-bra', 'gym'], w: 5, ret: 1.2, hp: 'evening' },
      { t: 'yoga pants women', tags: ['pants', 'yoga', 'women'], w: 5, hp: 'evening' },
      { t: 'cycling shorts women', tags: ['shorts', 'cycling', 'women'], w: 4, hp: 'business' },
      { t: 'quick dry gym tshirt', tags: ['tshirt', 'quick-dry', 'gym'], w: 4, ret: 0.9, hp: 'business' },
      { t: 'workout set women', tags: ['co-ord-set', 'training', 'women'], w: 4, val: 1.35, hp: 'evening' },
      { t: 'running shorts with pockets', tags: ['shorts', 'running', 'pocketed'], w: 4, hp: 'business' },
      { t: 'gym leggings with pockets', tags: ['leggings', 'gym', 'pocketed'], w: 4, ret: 1.1, hp: 'evening' },
      { t: 'sweat wicking gym tshirt', tags: ['tshirt', 'sweat-wicking', 'gym'], w: 3, ret: 0.9, hp: 'business' },
      { t: 'training tights women', tags: ['leggings', 'training', 'women'], w: 3, hp: 'business' },
      { t: 'gym clothes women india', tags: ['gym', 'women', 'india'], w: 3, hp: 'evening' },
      { t: 'high impact sports bra running', tags: ['sports-bra', 'running'], w: 3, ret: 1.2, hp: 'evening' },
    ],
  },

  'mid|lifestyle': {
    bp: 1120,
    queries: [
      { t: 'athleisure leggings', tags: ['leggings', 'casual'], w: 12, head: true, soft: true, hp: 'evening' },
      { t: 'co ord set', tags: ['co-ord-set'], w: 11, head: true, soft: true, val: 1.35, hp: 'evening' },
      { t: 'everyday leggings', tags: ['leggings', 'everyday'], w: 9, head: true, soft: true, hp: 'evening' },
      { t: 'joggers for women', tags: ['joggers', 'casual', 'women'], w: 9, head: true, ret: 0.9, hp: 'evening' },
      { t: 'lounge pants women', tags: ['pants', 'lounge', 'women'], w: 7, ret: 0.9, hp: 'evening' },
      { t: 'matching set women', tags: ['co-ord-set', 'women'], w: 6, val: 1.35, hp: 'evening' },
      { t: 'flared leggings women', tags: ['leggings', 'flared', 'women'], w: 6, ret: 1.2, hp: 'evening' },
      { t: 'oversized tshirt women', tags: ['tshirt', 'oversized', 'women'], w: 5, ret: 0.85, hp: 'evening' },
      { t: 'casual joggers women', tags: ['joggers', 'casual', 'women'], w: 5, ret: 0.9, hp: 'evening' },
      { t: 'athleisure set india', tags: ['co-ord-set', 'casual', 'india'], w: 5, val: 1.3, hp: 'evening' },
      { t: 'comfy leggings for women', tags: ['leggings', 'casual', 'women'], w: 4, hp: 'evening' },
      { t: 'travel joggers women', tags: ['joggers', 'travel', 'women'], w: 4, ret: 0.9, hp: 'business' },
      { t: 'cropped hoodie women', tags: ['hoodie', 'cropped', 'women'], w: 4, ret: 1.1, hp: 'evening' },
      { t: 'everyday co ord set', tags: ['co-ord-set', 'everyday'], w: 4, val: 1.3, hp: 'evening' },
      { t: 'soft lounge set women', tags: ['lounge', 'co-ord-set', 'women'], w: 4, val: 1.3, hp: 'evening' },
      { t: 'wide leg lounge pants', tags: ['pants', 'lounge'], w: 3, ret: 0.9, hp: 'evening' },
      { t: 'buy athleisure wear online india', tags: ['casual', 'buy', 'online', 'india'], w: 3, conv: 1.3, hp: 'evening' },
      { t: 'casual leggings women', tags: ['leggings', 'casual', 'women'], w: 3, hp: 'evening' },
      { t: 'cotton joggers women', tags: ['joggers', 'casual', 'women'], w: 3, ret: 0.9, hp: 'evening' },
      { t: 'everyday athleisure set', tags: ['co-ord-set', 'everyday', 'casual'], w: 3, val: 1.3, hp: 'evening' },
    ],
  },

  // Premium apparel is searched by material and construction, not by an
  // adjective meaning expensive. Someone spending Rs 4,800 asks about fabric,
  // fit and whether the thing does what it claims - the word "premium" is what
  // a brand writes, not what a buyer types.
  'premium|performance': {
    bp: 861,
    queries: [
      { t: 'seamless leggings', tags: ['leggings', 'seamless'], w: 12, head: true, soft: true, ret: 1.15, hp: 'evening' },
      { t: 'compression leggings', tags: ['leggings', 'compression'], w: 11, head: true, soft: true, ret: 1.15, hp: 'evening' },
      { t: 'squat proof leggings', tags: ['leggings', 'squat-proof', 'gym'], w: 10, head: true, soft: true, ret: 1.1, hp: 'evening' },
      { t: 'buttery soft leggings', tags: ['leggings', 'fabric'], w: 8, head: true, ret: 1.15, hp: 'evening' },
      { t: 'no camel toe gym leggings', tags: ['leggings', 'gym', 'squat-proof'], w: 7, ret: 1.1, hp: 'evening' },
      { t: 'four way stretch gym tights', tags: ['leggings', 'four-way-stretch', 'gym'], w: 6, hp: 'business' },
      { t: 'tummy control gym leggings', tags: ['leggings', 'gym', 'high-waisted'], w: 6, ret: 1.15, hp: 'evening' },
      { t: 'moisture wicking gym tshirt', tags: ['tshirt', 'sweat-wicking', 'gym'], w: 5, ret: 0.9, hp: 'business' },
      { t: 'high rise compression tights', tags: ['leggings', 'compression', 'high-waisted'], w: 5, ret: 1.15, hp: 'evening' },
      { t: 'nylon spandex gym leggings', tags: ['leggings', 'gym', 'fabric'], w: 5, hp: 'business' },
      { t: 'seamless sports bra high impact', tags: ['sports-bra', 'seamless', 'training'], w: 5, ret: 1.2, hp: 'evening' },
      { t: 'best squat proof leggings india', tags: ['leggings', 'squat-proof', 'compare', 'india'], w: 4, conv: 0.85, hp: 'evening' },
      { t: 'sculpt gym leggings women', tags: ['leggings', 'gym', 'women'], w: 4, ret: 1.15, hp: 'evening' },
      { t: 'seamless workout co ord set', tags: ['co-ord-set', 'seamless', 'training'], w: 4, val: 1.35, ret: 1.15, hp: 'evening' },
      { t: 'second skin leggings', tags: ['leggings', 'fabric', 'seamless'], w: 3, ret: 1.15, hp: 'evening' },
      { t: 'anti chafe running tights', tags: ['leggings', 'running', 'four-way-stretch'], w: 3, hp: 'business' },
      { t: 'imported gym wear women', tags: ['gym', 'premium', 'women'], w: 3, hp: 'evening' },
      { t: 'studio to street leggings', tags: ['leggings', 'yoga', 'casual'], w: 3, hp: 'evening' },
      { t: 'technical training tights', tags: ['leggings', 'training', 'four-way-stretch'], w: 3, hp: 'business' },
      { t: 'premium gym leggings india', tags: ['leggings', 'gym', 'premium', 'india'], w: 3, hp: 'evening' },
    ],
  },

  'premium|lifestyle': {
    bp: 770,
    queries: [
      { t: 'premium athleisure', tags: ['casual', 'premium'], w: 12, head: true, soft: true, hp: 'evening' },
      { t: 'designer leggings', tags: ['leggings', 'luxury'], w: 11, head: true, soft: true, ret: 1.15, hp: 'evening' },
      { t: 'luxury loungewear', tags: ['lounge', 'luxury'], w: 10, head: true, soft: true, hp: 'evening' },
      { t: 'modal lounge pants', tags: ['pants', 'lounge', 'fabric'], w: 8, head: true, ret: 0.9, hp: 'evening' },
      { t: 'buttery soft lounge set', tags: ['lounge', 'co-ord-set', 'fabric'], w: 6, val: 1.35, hp: 'evening' },
      { t: 'bamboo fabric loungewear', tags: ['lounge', 'fabric'], w: 6, ret: 0.9, hp: 'evening' },
      { t: 'silk finish leggings', tags: ['leggings', 'fabric'], w: 5, ret: 1.15, hp: 'evening' },
      { t: 'ribbed co ord set women', tags: ['co-ord-set', 'fabric', 'women'], w: 5, val: 1.35, hp: 'evening' },
      { t: 'cashmere blend joggers', tags: ['joggers', 'fabric', 'luxury'], w: 5, ret: 0.9, hp: 'evening' },
      { t: 'modal tshirt women', tags: ['tshirt', 'fabric', 'women'], w: 4, ret: 0.9, hp: 'evening' },
      { t: 'structured co ord set women', tags: ['co-ord-set', 'women', 'premium'], w: 4, val: 1.35, hp: 'evening' },
      { t: 'luxe lounge set women', tags: ['lounge', 'co-ord-set', 'luxury', 'women'], w: 4, val: 1.35, hp: 'evening' },
      { t: 'imported athleisure india', tags: ['casual', 'premium', 'india'], w: 4, hp: 'evening' },
      { t: 'tailored joggers women', tags: ['joggers', 'premium', 'women'], w: 3, ret: 0.9, hp: 'evening' },
      { t: 'soft touch lounge pants', tags: ['pants', 'lounge', 'fabric'], w: 3, ret: 0.9, hp: 'evening' },
      { t: 'pleated joggers women', tags: ['joggers', 'luxury', 'women'], w: 3, ret: 0.9, hp: 'evening' },
      { t: 'minimal design leggings', tags: ['leggings', 'premium', 'everyday'], w: 3, hp: 'evening' },
      { t: 'elevated athleisure india', tags: ['casual', 'premium', 'india'], w: 3, hp: 'evening' },
      { t: 'wrinkle free travel co ord', tags: ['co-ord-set', 'travel', 'fabric'], w: 3, val: 1.35, hp: 'business' },
      { t: 'brushed fleece cropped hoodie', tags: ['hoodie', 'cropped', 'fabric'], w: 3, ret: 1.1, hp: 'evening' },
    ],
  },
};

// ---------------------------------------------------------------------------
// Non-territory traffic
// ---------------------------------------------------------------------------

/**
 * Informational. Converts at 10% of baseline via the chain, so it loses money
 * without being obviously worthless — a trap rather than a signpost. Sits close
 * enough to the commercial vocabulary that broad match reaches it easily.
 */
const INFORMATIONAL = [
  { t: 'how to wash gym activewear', tags: ['gym', 'care', 'how-to'], w: 8 },
  { t: 'how to wash gym leggings', tags: ['leggings', 'care', 'how-to'], w: 7 },
  { t: 'what to wear to the gym', tags: ['gym', 'research', 'how-to'], w: 7 },
  { t: 'are gym leggings squat proof', tags: ['leggings', 'squat-proof', 'research'], w: 6 },
  { t: 'how to choose sports bra size', tags: ['sports-bra', 'size-guide', 'how-to'], w: 6 },
  { t: 'legging size guide', tags: ['leggings', 'size-guide'], w: 6 },
  { t: 'how tight should compression leggings be', tags: ['leggings', 'compression', 'size-guide'], w: 5 },
  { t: 'difference between leggings and tights', tags: ['leggings', 'compare', 'research'], w: 5 },
  { t: 'how to remove sweat smell from gym clothes', tags: ['gym', 'care', 'how-to'], w: 5 },
  { t: 'best fabric for gym wear', tags: ['gym', 'research', 'compare'], w: 4 },
  { t: 'how often to replace sports bra', tags: ['sports-bra', 'care', 'how-to'], w: 4 },
  { t: 'how to style athleisure', tags: ['casual', 'how-to', 'research'], w: 4 },
];

/**
 * Irrelevant. Converts at exactly zero, for everyone (12.1). These exist so
 * broad match can waste money on them, and that waste is the lesson (spec 7.4
 * enforces a 5% volume floor for exactly this reason).
 *
 * Every one shares vocabulary with the commercial set — gym, fitness, workout —
 * so a broad keyword reaches them without the player ever intending it.
 */
const IRRELEVANT = [
  { t: 'free workout plan', tags: ['training', 'free'], w: 10 },
  { t: 'gym near me', tags: ['gym', 'research'], w: 9 },
  { t: 'how to lose belly fat', tags: ['training', 'how-to'], w: 8 },
  { t: 'free gym diet chart', tags: ['gym', 'free', 'research'], w: 7 },
  { t: 'home workout without equipment', tags: ['training', 'how-to'], w: 7 },
  { t: 'gym membership price', tags: ['gym', 'research'], w: 6 },
  { t: 'protein powder for beginners', tags: ['research', 'compare'], w: 5 },
  { t: 'yoga classes near me', tags: ['yoga', 'research'], w: 5 },
  { t: 'how to build muscle fast', tags: ['training', 'how-to'], w: 4 },
  { t: 'free fitness app', tags: ['free', 'training'], w: 4 },
];

/** One per advertiser, all nine (7.5). Format varies as real brand searches do. */
const BRAND_SUFFIX = [
  'leggings', 'gym wear', 'co ord set', 'leggings review', 'activewear',
  'sports bra', 'joggers', 'leggings', 'athleisure',
];

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

/** Sharp queries name a niche; soft ones are contested by several positions. */
const SHARPNESS = {
  sharp: { own: 1.6, adjacent: 0.9, far: 0.3, purposeOwn: 1.35, purposeOther: 0.65 },
  soft: { own: 1.3, adjacent: 1.0, far: 0.6, purposeOwn: 1.15, purposeOther: 0.85 },
};

function affinitiesFor(price, purpose, soft) {
  const s = soft ? SHARPNESS.soft : SHARPNESS.sharp;
  const own = PRICE_TIERS.indexOf(price);
  const priceAffinity = {};
  for (const [i, tier] of PRICE_TIERS.entries()) {
    const d = Math.abs(i - own);
    priceAffinity[tier] = d === 0 ? s.own : d === 1 ? s.adjacent : s.far;
  }
  return {
    priceAffinity,
    purposeAffinity: {
      performance: purpose === 'performance' ? s.purposeOwn : s.purposeOther,
      lifestyle: purpose === 'lifestyle' ? s.purposeOwn : s.purposeOther,
    },
  };
}

/** Neutral affinities, for traffic that belongs to no position. */
const NEUTRAL = {
  priceAffinity: { value: 1, mid: 1, premium: 1 },
  purposeAffinity: { performance: 1, lifestyle: 1 },
};

function buildQuerySet() {
  const queries = [];
  let n = 0;
  const nextId = () => `q_${String(++n).padStart(3, '0')}`;

  const push = (src, bp, extra) => queries.push({
    id: nextId(),
    text: src.t,
    isHeadTerm: src.head === true,
    volumeShareBp: bp,
    brandOwner: null,
    tags: src.tags,
    convMultiplier: src.conv ?? 1.0,
    valueMultiplier: src.val ?? 1.0,
    returnRateMultiplier: src.ret ?? 1.0,
    hourProfile: src.hp ?? 'flat',
    ...extra,
  });

  for (const [cell, { bp, queries: src }] of Object.entries(TERRITORY)) {
    const [price, purpose] = cell.split('|');
    const shares = allocate(bp, src.map((q) => q.w));
    src.forEach((q, i) => push(q, shares[i], {
      intent: 'commercial',
      ...affinitiesFor(price, purpose, q.soft),
    }));
  }

  const brandShares = allocate(600, BRAND_IDENTITIES.map(() => 1));
  BRAND_IDENTITIES.forEach((brand, i) => {
    push(
      { t: `${brand.id} ${BRAND_SUFFIX[i]}`, tags: ['brand-term', 'india'], hp: 'evening' },
      brandShares[i],
      { intent: 'brand', brandOwner: brand.id, ...NEUTRAL },
    );
  });

  const infoShares = allocate(400, INFORMATIONAL.map((q) => q.w));
  INFORMATIONAL.forEach((q, i) => push(
    { ...q, hp: q.hp ?? 'business' }, infoShares[i], { intent: 'informational', ...NEUTRAL },
  ));

  const irrShares = allocate(600, IRRELEVANT.map((q) => q.w));
  IRRELEVANT.forEach((q, i) => push(
    { ...q, hp: q.hp ?? 'flat' }, irrShares[i], { intent: 'irrelevant', ...NEUTRAL },
  ));

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedFrom: 'Athleisure and gym clothing, D2C, India. Authored for spec v0.3, '
      + 'hand-corrected, frozen as the test fixture.',
    weeklyVolume: WEEKLY_VOLUME,
    tagVocabulary: [...TAG_VOCABULARY],
    queries,
  };
}

/** The frozen set. Built once at module load; deterministic and pure (R1). */
export const QUERY_SET = Object.freeze(buildQuerySet());
