/**
 * WHAT THE PAGE SELLS, and that it is the player's own.
 *
 * Until 2026-09-25 `ui/words/ad.js` held one fixed line, so every brand in
 * every cell landed its clicks on the same product page — on the one screen
 * whose job is to be YOUR shop, after round 0 has spent five steps teaching
 * that the cell decides what a click is worth.
 *
 * What these hold is that the page follows the cell, and that it quotes the
 * engine's own price rather than a second economy of its own.
 */
import { describe, test, expect } from 'vitest';
import { productFor, PRODUCT_CELLS, GARMENT_SHAPES } from '../content/product.js';
import { allCells } from '../engine/positions.js';
import { POSITION_ECONOMICS, PRICE_TIERS } from '../engine/constants.js';

describe('every cell sells something, and something of its own', () => {
  test('the six cells the engine has are the six with products', () => {
    // The guard against a cell being added to the grid and quietly inheriting
    // another cell's shop.
    expect([...PRODUCT_CELLS].sort()).toEqual([...allCells()].sort());
  });

  test('no two cells sell the same product', () => {
    const names = PRODUCT_CELLS.map((cell) => productFor(cell).name);
    expect(new Set(names).size, `names: ${names.join(', ')}`).toBe(names.length);
  });

  test('a garment is one of the three drawn, never a fourth nobody drew', () => {
    for (const cell of PRODUCT_CELLS) {
      expect(GARMENT_SHAPES, cell).toContain(productFor(cell).shape);
    }
  });

  test('every drawn shape is actually used, so none is dead', () => {
    const used = new Set(PRODUCT_CELLS.map((cell) => productFor(cell).shape));
    expect([...used].sort()).toEqual([...GARMENT_SHAPES].sort());
  });
});

describe('the price is the engine\'s, not the page\'s', () => {
  test.each(PRICE_TIERS)('%s quotes POSITION_ECONOMICS rather than a figure of its own', (price) => {
    // A page quoting its own number would teach two economies at once: the one
    // the market prices sales on, and the one the shop advertises.
    for (const purpose of ['performance', 'lifestyle']) {
      const product = productFor(`${price}|${purpose}`);
      expect(product.pricePaise).toBe(POSITION_ECONOMICS[price].aovMeanPaise);
    }
  });

  test('a dearer tier is a dearer product, in the order the tiers are priced', () => {
    const prices = PRICE_TIERS.map((price) => productFor(`${price}|performance`).pricePaise);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(new Set(prices).size, 'and no two tiers are level').toBe(prices.length);
  });
});

describe('it fails soft, because the page is drawn before a cell is always known', () => {
  test('an unknown cell falls back rather than throwing', () => {
    const out = productFor('gold|wholesale');
    expect(out.name).toBeTruthy();
    expect(GARMENT_SHAPES).toContain(out.shape);
  });

  test('and the fallback says which cell it fell back to', () => {
    // So a page showing the wrong shop can be traced rather than guessed at.
    expect(productFor('gold|wholesale').cell).toBe('mid|performance');
    expect(productFor('value|lifestyle').cell).toBe('value|lifestyle');
  });
});
