/**
 * WHAT THE PAGE SELLS, which until 2026-09-25 was one thing for everybody.
 *
 * `ui/words/ad.js` carried a single fixed line — "High-waisted training
 * leggings" — so all nine brands, in all six cells, landed their clicks on an
 * identical product page. The game spends round 0 teaching that a cell decides
 * what a click is worth and which searches are yours, and then showed every
 * cell the same shop.
 *
 * The cell already has a character the game wrote down and the page ignored:
 * round 0 calls the six "An affordable gym-wear brand", "A budget loungewear
 * label", "A serious training brand", "An everyday athleisure label", "A
 * technical performance house" and "A considered luxury label". These products
 * are those six, sold.
 *
 * NOTHING HERE IS A NEW NUMBER. The price is the tier's own mean order value
 * from `POSITION_ECONOMICS` — ₹1,200, ₹2,400, ₹4,800 — which the engine
 * already uses to value a sale and round 0 already shows on its first screen.
 * A page quoting a different figure from the one the market is priced on would
 * be teaching two economies at once.
 *
 * THIS LIVES IN `content/`, not `ui/`, for the reason the landing page's
 * grading rules do (`content/landingPage.js`): `game.js` may not import
 * `agents/`, and anything the page and a test both need is content.
 *
 * Three garments cover the six cells. A drawing that cannot be told from its
 * neighbour buys nothing, and six silhouettes at 124px would be four of them
 * pretending to differ — so performance cells wear the legging shape, the
 * cheap lifestyle cell wears joggers, and the dear one wears a set.
 */

import { POSITION_ECONOMICS } from '../engine/constants.js';

/** @typedef {'leggings'|'joggers'|'set'} GarmentShape */

/**
 * By `price|purpose`, the key `engine/positions.js` uses everywhere.
 *
 * The names are what a shop in that cell would put on a product, not what a
 * marketer would: a budget label sells "cotton lounge joggers", a technical
 * house sells "compression training tights". Each is under six words, because
 * it is drawn into a 124px column beside a price.
 */
const BY_CELL = Object.freeze({
  'value|performance': { name: 'Everyday gym leggings', shape: 'leggings' },
  'value|lifestyle': { name: 'Cotton lounge joggers', shape: 'joggers' },
  'mid|performance': { name: 'High-waisted training leggings', shape: 'leggings' },
  'mid|lifestyle': { name: 'Studio-to-street co-ord', shape: 'set' },
  'premium|performance': { name: 'Compression training tights', shape: 'leggings' },
  'premium|lifestyle': { name: 'Merino lounge set', shape: 'set' },
});

/** The cell the page falls back to when it is asked before one is chosen. */
const DEFAULT_CELL = 'mid|performance';

/**
 * The product a cell sells, with the price the engine values it at.
 *
 * @param {string} cell - `${price}|${purpose}`
 * @returns {{name: string, shape: GarmentShape, pricePaise: number, cell: string}}
 */
export function productFor(cell) {
  const key = cell in BY_CELL ? cell : DEFAULT_CELL;
  const [price] = key.split('|');
  return {
    cell: key,
    name: BY_CELL[key].name,
    shape: /** @type {GarmentShape} */ (BY_CELL[key].shape),
    pricePaise: POSITION_ECONOMICS[price].aovMeanPaise,
  };
}

/** Every cell that has a product, for the tests that hold the set. */
export const PRODUCT_CELLS = Object.freeze(Object.keys(BY_CELL));

/** The garment shapes drawn, so a drawing module cannot invent a seventh. */
export const GARMENT_SHAPES = Object.freeze(['leggings', 'joggers', 'set']);
