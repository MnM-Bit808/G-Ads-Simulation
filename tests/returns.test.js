/**
 * What the returns card and the Studio's Returns section show, read without a
 * page (ui/returns/read.js; design/returns/, chosen by the owner 2026-09-15).
 */

import { describe, test, expect } from 'vitest';
import { startGame } from '../setup.js';
import { submitRound } from '../game.js';
import { QUERY_SET } from '../content/querySet.js';
import { BRAND_IDENTITIES } from '../content/brands.js';
import { homeCell } from '../engine/querySet.js';
import { businessFor, realisedBreakEvenCpcPaise } from '../engine/positions.js';
import { POSITION_ECONOMICS, RTO_FREIGHT_PAISE } from '../engine/constants.js';
import { SETTLES_AFTER_ROUNDS } from '../ui/dashboard.js';
import { returnsReading } from '../ui/returns/read.js';

const POSITION = { price: 'mid', purpose: 'performance' };

// Nine weeks with the top rung of order confirmation from round 0, live from
// week 4, so the first four weeks have settled: tests/dashboard.test.js's game.
let shared = null;
function played() {
  if (shared) return shared;
  const breakEven = realisedBreakEvenCpcPaise(businessFor(POSITION, { committed: {}, pending: [] }, 1), QUERY_SET, POSITION);
  const own = QUERY_SET.queries.filter((q) => homeCell(q) === 'mid|performance')
    .sort((a, b) => b.volumeShareBp - a.volumeShareBp).slice(0, 5);
  let state = startGame({
    rootSeed: 20260902,
    playerBrandId: BRAND_IDENTITIES[0].id,
    querySet: QUERY_SET,
    player: {
      position: POSITION,
      capex: { orderConfirmation: 8000000 },
      keywords: own.map((q) => ({ text: q.text, matchType: 'phrase', bidPaise: Math.round(breakEven * 0.7) })),
      ad: {
        headlines: ['Activewear Built To Train In', 'Free Delivery Across India', 'Sizes XS To XXL'],
        descriptions: [
          'Leggings, tights and sports bras that hold through 4 sessions a week.',
          'Easy returns within 30 days, and cash on delivery everywhere.',
        ],
        landingPageDescription: 'A plain product page.',
      },
      writerTier: 'freelancer',
    },
  });
  const playerId = state.advertisers[0].id;
  const states = [];
  for (let week = 0; week < 9; week++) {
    state = submitRound(state, {}, { mode: 'expected' }).nextGameState;
    states.push(state);
  }
  shared = { state, states, playerId };
  return shared;
}
const rowOf = (h, id) => h.byAdvertiser[id];
const sum = (xs, fn) => xs.reduce((a, x) => a + fn(x), 0);

describe('what came back, read from the account\'s own weeks', () => {
  test('a week counts once it has settled, and the rates are over those weeks only', () => {
    const { state, playerId } = played();
    const r = returnsReading(state.history, playerId, SETTLES_AFTER_ROUNDS);
    expect(r.latest).toBe(9);
    expect(r.weeks.map((w) => w.settled)).toEqual(r.weeks.map((w) => 9 - w.round >= SETTLES_AFTER_ROUNDS));
    expect(r.settled.map((w) => w.round)).toEqual([1, 2, 3, 4]);
    const counted = state.history.filter((h) => h.round <= 4).map((h) => rowOf(h, playerId).conversions);
    expect(r.orders).toBeCloseTo(sum(counted, (c) => c.final), 9);
    expect(r.refused).toBeCloseTo(sum(counted, (c) => c.refused), 9);
    expect(r.sentBack).toBeCloseTo(sum(counted, (c) => c.sentBack), 9);
    expect([r.countedFrom, r.countedTo]).toEqual([1, 4]);
  });

  test('freight is every week\'s, since a refused parcel is paid for as it comes back', () => {
    const { state, playerId } = played();
    const r = returnsReading(state.history, playerId, SETTLES_AFTER_ROUNDS);
    expect(r.freightPaise).toBe(sum(state.history, (h) => rowOf(h, playerId).money.rtoFreightPaise));
  });

  test('a refusal costs the freight and the account\'s own margin on an order', () => {
    const { state, playerId } = played();
    const r = returnsReading(state.history, playerId, SETTLES_AFTER_ROUNDS);
    expect(r.perRefusalPaise - r.marginPaise).toBeCloseTo(RTO_FREIGHT_PAISE, 6);
    // Recovered from the gross figures, so it is the account's, near the tier's own.
    const tier = POSITION_ECONOMICS.mid.aovMeanPaise * POSITION_ECONOMICS.mid.marginPct;
    expect(r.marginPaise / tier).toBeGreaterThan(0.9);
    expect(r.marginPaise / tier).toBeLessThan(1.1);
  });

  test('paid at the door is weighted by where the clicks went', () => {
    const { state, playerId } = played();
    const r = returnsReading(state.history, playerId, SETTLES_AFTER_ROUNDS);
    const shares = Object.values(rowOf(state.history[0], playerId).breakdown.byLocation).map((l) => l.codShare);
    expect(r.codShare).toBeGreaterThan(Math.min(...shares));
    expect(r.codShare).toBeLessThan(Math.max(...shares));
  });

  test('before any week has settled, nothing is counted', () => {
    const { states, playerId } = played();
    const r = returnsReading(states[2].history, playerId, SETTLES_AFTER_ROUNDS);
    expect(r.settled).toEqual([]);
    expect(r.orders).toBe(0);
    expect(r.countedFrom).toBeNull();
  });
});
