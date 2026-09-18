/**
 * What the Studio's What people typed shows, read without a page
 * (design/what-people-typed/, chosen by the owner 2026-09-15: one list, the
 * money down it, with Block words beside it).
 */

import { describe, test, expect } from 'vitest';
import { QUERY_SET } from '../content/querySet.js';
import {
  DEAR_TIMES, WORSE_TIMES, averages, termRows, blockPreview,
} from '../ui/typed/read.js';

/** One search's figures over the weeks on screen, as `ctx.terms` holds them. */
const term = (costPaise, conversions, { returned = 0, clicks = 100, impressions = 1000 } = {}) => ({
  impressions, clicks, costPaise, conversions, returned, returnedRevenuePaise: 0,
});
const TEXTS = new Map([
  ['a', 'cheap gym leggings'], ['b', 'how to wash gym leggings'], ['c', 'squat proof leggings'],
  ['d', 'vella leggings'], ['e', 'pulse running shorts'], ['f', 'never shown'],
]);
const ADVERTISERS = [{ id: 'me', name: 'Vella & Co.' }, { id: 'p', name: 'Pulse' }];
const read = (terms, negatives = []) => termRows(terms, {
  texts: TEXTS, negatives, advertisers: ADVERTISERS, playerId: 'me',
});

describe('the list', () => {
  const terms = {
    a: term(6947900, 86.2, { returned: 20.1 }), b: term(356600, 0.8), c: term(547600, 12.2, { returned: 3.5 }),
    f: term(0, 0, { impressions: 0, clicks: 0 }),
  };

  test('every search that showed, most spent first', () => {
    expect(read(terms).rows.map((r) => r.text)).toEqual([
      'cheap gym leggings', 'squat proof leggings', 'how to wash gym leggings',
    ]);
  });

  test('a sale\'s cost and the share that came back, per search', () => {
    const [cheap] = read(terms).rows;
    expect(cheap.perSalePaise).toBeCloseTo(6947900 / 86.2, 6);
    expect(cheap.backRate).toBeCloseTo(20.1 / 86.2, 6);
  });

  test('the averages are this account\'s own, over the rows on screen', () => {
    const avg = averages(terms);
    expect(avg.perSalePaise).toBeCloseTo((6947900 + 356600 + 547600) / (86.2 + 0.8 + 12.2), 6);
    expect(avg.returnRate).toBeCloseTo((20.1 + 3.5) / (86.2 + 0.8 + 12.2), 6);
  });
});

describe('what is marked', () => {
  test(`a sale costing over ${DEAR_TIMES} times the account's average is marked, and no other`, () => {
    // The card's own "five clicks, no sale" never fires on the game's fractional
    // sales: this search cost Rs 3,566 for 0.8 of one (the canvas's game).
    const { rows, averages: avg } = read({ a: term(6947900, 86.2), b: term(356600, 0.8), c: term(547600, 12.2) });
    const dear = rows.filter((r) => r.dear).map((r) => r.text);
    expect(dear).toEqual(['how to wash gym leggings']);
    expect(rows.find((r) => r.text === 'how to wash gym leggings').perSalePaise).toBeGreaterThan(DEAR_TIMES * avg.perSalePaise);
  });

  test('exactly twice the average is not over it', () => {
    const { rows } = read({ a: term(100000, 10), b: term(300000, 10) });
    // average 20,000 a sale; b at 30,000 is 1.5 times; a at 10,000 half.
    expect(rows.some((r) => r.dear)).toBe(false);
    const edge = read({ a: term(100000, 10), b: term(100000, 10), c: term(400000, 10) });
    // average 20,000; c at 40,000 is exactly twice.
    expect(edge.rows.find((r) => r.text === 'squat proof leggings').dear).toBe(false);
  });

  test(`returns worse than the account's by more than ${Math.round((WORSE_TIMES - 1) * 100)}% are marked, as today's card marks them`, () => {
    const { rows } = read({ a: term(100000, 10, { returned: 2 }), c: term(100000, 10, { returned: 4 }) });
    // account 30%; c at 40% is over 34.5%, a at 20% is not.
    expect(rows.filter((r) => r.worse).map((r) => r.text)).toEqual(['squat proof leggings']);
  });

  test('a range with nothing come back yet has no return rate to compare with', () => {
    const { rows, averages: avg } = read({ a: term(100000, 10), c: term(100000, 5) });
    expect(avg.returnRate).toBe(0);
    expect(rows.every((r) => !r.worse && r.backRate === 0)).toBe(true);
  });

  test('a search that sold nothing has no cost per sale, and nothing to compare it with', () => {
    // Nothing in this account has sold, so there is no average to judge against.
    const { rows } = read({ a: term(100000, 0) });
    expect(rows[0]).toMatchObject({ perSalePaise: null, dear: false, backRate: null });
  });

  /**
   * A SEARCH THAT SOLD NOTHING IS THE CLEAREST WASTE, and this screen left it
   * unmarked while the Negatives card marked it: one idea read two ways (the
   * owner, 2026-09-18). It now reads the same `isDear` the card and the rival
   * policies read — no sale is dearer than any price — once the search has spent
   * what a sale costs this account.
   */
  test('a search that spent more than a sale costs and sold nothing is marked', () => {
    // A sale costs this account ₹1,200 (₹12,000 over 10 sales, the silent search's
    // own ₹2,000 counted in, as every average here counts every row on screen).
    const { rows, averages: avg } = read({ a: term(1000000, 10), b: term(200000, 0) });
    expect(avg.perSalePaise).toBe(120000);
    expect(rows.find((r) => r.text === 'how to wash gym leggings'))
      .toMatchObject({ sales: 0, perSalePaise: null, dear: true });
  });

  test('but not before it has spent that much: it has not had the money to sell', () => {
    const { rows } = read({ a: term(1000000, 10), b: term(100000, 0) });
    expect(rows.find((r) => r.text === 'how to wash gym leggings').dear).toBe(false);
  });

  test('a search carrying your name, or a rival\'s, says so', () => {
    const { rows } = read({ d: term(100, 1), e: term(100, 1) });
    expect(rows.find((r) => r.text === 'vella leggings').brand).toEqual({ own: true, name: 'Vella & Co.' });
    expect(rows.find((r) => r.text === 'pulse running shorts').brand).toEqual({ own: false, name: 'Pulse' });
  });
});

describe('what is blocked', () => {
  const terms = { a: term(3000, 3), b: term(2000, 1), c: term(1000, 1) };

  test('a search blocked from its own row can be undone from it', () => {
    const { rows } = read(terms, [{ text: 'how to wash gym leggings', matchType: 'exact' }]);
    expect(rows.find((r) => r.text === 'how to wash gym leggings')).toMatchObject({ blocksItself: true });
    expect(rows.filter((r) => r.blockedBy).length).toBe(1);
  });

  test('a search caught by a block on words says it is blocked, and is undone from the block', () => {
    const block = { text: 'squat proof', matchType: 'broad' };
    const row = read(terms, [block]).rows.find((r) => r.text === 'squat proof leggings');
    expect(row.blockedBy).toEqual(block);
    expect(row.blocksItself).toBe(false);
  });

  test('a block matches the words themselves, never a plural (8.2)', () => {
    const { rows } = read(terms, [{ text: 'legging', matchType: 'broad' }]);
    expect(rows.some((r) => r.blockedBy)).toBe(false);
  });
});

describe('what a block would catch, before it is made', () => {
  const queries = QUERY_SET.queries;
  const id = (text) => queries.find((q) => q.text === text).id;
  const terms = {
    [id('squat proof leggings')]: term(547600, 12.2),
    [id('are gym leggings squat proof')]: term(305000, 0.7),
    [id('gym leggings')]: term(2946200, 60.4),
  };

  test('the searches bought, with their spend and sales, and the ones never bought', () => {
    const preview = blockPreview({ text: 'squat proof', matchType: 'broad' }, { queries, terms });
    expect(preview.bought.map((r) => r.text)).toEqual(['squat proof leggings', 'are gym leggings squat proof']);
    expect(preview.never.map((r) => r.text)).toEqual(['best squat proof leggings india']);
    expect(preview.spentPaise).toBe(547600 + 305000);
    expect(preview.sales).toBeCloseTo(12.9, 6);
  });

  test('each bought search carries its cost per sale, marked as the list marks it', () => {
    const preview = blockPreview({ text: 'squat proof', matchType: 'broad' }, { queries, terms });
    const dear = preview.bought.filter((r) => r.dear).map((r) => r.text);
    expect(dear).toEqual(['are gym leggings squat proof']);
  });

  test('words nothing in the market carries catch nothing', () => {
    const preview = blockPreview({ text: 'for men', matchType: 'phrase' }, { queries, terms });
    expect(preview.bought).toEqual([]);
    expect(preview.never).toEqual([]);
  });
});
