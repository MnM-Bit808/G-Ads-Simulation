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
import { getSelfView } from '../engine/insights.js';
import { codShareFor } from '../engine/locations.js';
import { PREPAID_DISCOUNT_CURVE, LOCATION_TIERS } from '../engine/constants.js';
import {
  createDraft, locationRows, prepaidOutlook, prepaidRungs, setPrepaidDiscount,
} from '../ui/decisions.js';
import {
  returnsReading, capitalWindow, liveMarks, stepReading, placeReturns, discountTrade,
} from '../ui/returns/read.js';

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
  const draft = createDraft(getSelfView(state, playerId), { allocationRounds: state.budgetSchedule?.capexAllocationRounds });
  shared = { state, states, playerId, draft, rows: locationRows(draft, state.history, playerId) };
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

  test('capital is open in its week, shut until the next, and closed once the last has gone', () => {
    expect(capitalWindow([1, 5], 5)).toEqual({ state: 'open', later: [] });
    expect(capitalWindow([1, 5], 3)).toEqual({ state: 'later', later: [5] });
    expect(capitalWindow([1, 5], 7)).toEqual({ state: 'closed', later: [] });
    expect(capitalWindow(undefined, 7)).toEqual({ state: 'closed', later: [] });
  });

  test('before any week has settled, nothing is counted', () => {
    const { states, playerId } = played();
    const r = returnsReading(states[2].history, playerId, SETTLES_AFTER_ROUNDS);
    expect(r.settled).toEqual([]);
    expect(r.orders).toBe(0);
    expect(r.countedFrom).toBeNull();
  });
});

describe('the week capital went live, and what it did', () => {
  test('a mark for each week order confirmation or the size guide went live, from the account\'s own tranches', () => {
    const block = {
      committed: { orderConfirmation: 8000000, sizeGuide: 2500000, photography: 5000000 },
      pending: [
        { target: 'orderConfirmation', paise: 8000000, liveAtRound: 4 },
        { target: 'photography', paise: 5000000, liveAtRound: 4 },
        { target: 'sizeGuide', paise: 2500000, liveAtRound: 8 },
      ],
    };
    expect(liveMarks(block)).toEqual([{ target: 'orderConfirmation', week: 4 }, { target: 'sizeGuide', week: 8 }]);
    expect(liveMarks(played().draft.capexBlock)).toEqual([{ target: 'orderConfirmation', week: 4 }]);
    expect(liveMarks(undefined)).toEqual([]);
  });

  test('once its week has settled, the half it reaches is read before and after it', () => {
    const { state, playerId, draft } = played();
    const r = returnsReading(state.history, playerId, SETTLES_AFTER_ROUNDS);
    const step = stepReading(r, liveMarks(draft.capexBlock));
    const rate = (weeks, key) => sum(weeks, (w) => w[key]) / sum(weeks, (w) => w.conversions);
    expect(step).toMatchObject({ target: 'orderConfirmation', week: 4, half: 'refused', beforeFrom: 1, beforeTo: 3 });
    expect(step.before).toBeCloseTo(rate(r.settled.slice(0, 3), 'refused'), 9);
    expect(step.after).toBeCloseTo(rate(r.settled.slice(3), 'refused'), 9);
    // The half it cannot reach is read over the same weeks, so the sentence
    // says what it did rather than assuming it held.
    expect(step.otherBefore).toBeCloseTo(rate(r.settled.slice(0, 3), 'sentBack'), 9);
    expect(step.otherAfter).toBeCloseTo(rate(r.settled.slice(3), 'sentBack'), 9);
    // Order confirmation reaches refusals: the week it went live, they fell.
    expect(step.direction).toBe('fell');
  });

  test('a change too small to print is said to have held', () => {
    const reading = {
      settled: [
        { round: 1, conversions: 100, refused: 15, sentBack: 24 },
        { round: 2, conversions: 100, refused: 15.04, sentBack: 24 },
      ],
    };
    expect(stepReading(reading, [{ target: 'sizeGuide', week: 2 }])).toMatchObject({ half: 'sentBack', direction: 'held' });
  });

  test('before its week has settled, there is nothing to read', () => {
    const { states, playerId, draft } = played();
    const r = returnsReading(states[6].history, playerId, SETTLES_AFTER_ROUNDS);
    expect(r.settled.map((w) => w.round)).toEqual([1, 2]);
    expect(stepReading(r, liveMarks(draft.capexBlock))).toBeNull();
  });
});

describe('the places, over settled weeks', () => {
  test('each place\'s orders and returns, which add up to the account\'s', () => {
    const { state, playerId } = played();
    const r = returnsReading(state.history, playerId, SETTLES_AFTER_ROUNDS);
    const places = placeReturns(state.history, playerId, r.settled);
    expect(places).toHaveLength(LOCATION_TIERS.length);
    expect(sum(places, (p) => p.orders)).toBeCloseTo(r.orders, 6);
    expect(sum(places, (p) => p.refused)).toBeCloseTo(r.refused, 6);
    expect(sum(places, (p) => p.sentBack)).toBeCloseTo(r.sentBack, 6);
    // The towns pay at the door most (content/locations.js), so they refuse most.
    const rate = (p) => p.refused / p.orders;
    expect(rate(places[2])).toBeGreaterThan(rate(places[0]));
    expect(places[2].codShare).toBeGreaterThan(places[0].codShare);
  });
});

describe('what a discount saves against what it costs', () => {
  test('each rung\'s refusal rate is the prepaid card\'s own, from the round\'s arithmetic', () => {
    const { draft, rows } = played();
    const rungs = prepaidRungs(draft, rows);
    expect(rungs.map((r) => r.paise)).toEqual(PREPAID_DISCOUNT_CURVE.map((r) => r.paise));
    for (const rung of rungs) {
      const d = structuredClone(draft);
      setPrepaidDiscount(d, rung.paise);
      expect(rung.refusal, `₹${rung.paise / 100}`).toBeCloseTo(prepaidOutlook(d, rows).now, 12);
    }
    for (let i = 1; i < rungs.length; i++) expect(rungs[i].refusal).toBeLessThan(rungs[i - 1].refusal);
  });

  test('it is paid on every prepaid order, the ones already paying first included', () => {
    const { draft, rows } = played();
    const clicks = rows.map((r) => r.clicks);
    const total = sum(clicks, (c) => c);
    for (const rung of prepaidRungs(draft, rows)) {
      const share = sum(clicks.map((c, t) => c * (1 - codShareFor('mid', t, rung.paise))), (x) => x) / total;
      expect(rung.prepaidShare).toBeCloseTo(share, 12);
    }
  });

  test('a rung saves the refusals it prevents at freight plus margin, and costs its discount on each prepaid order', () => {
    const { state, playerId, draft, rows } = played();
    const r = returnsReading(state.history, playerId, SETTLES_AFTER_ROUNDS);
    const rungs = prepaidRungs(draft, rows);
    const perWeek = r.orders / r.settled.length;
    const trade = discountTrade(rungs, { ordersPerWeek: perWeek, perRefusalPaise: r.perRefusalPaise });
    expect(trade[0]).toMatchObject({ fewer: 0, avoidedPerWeek: 0, savedPerWeekPaise: 0, costPerWeekPaise: 0 });
    const t = trade[1];
    expect(t.fewer).toBeCloseTo(1 - rungs[1].refusal / rungs[0].refusal, 12);
    expect(t.avoidedPerWeek).toBeCloseTo((rungs[0].refusal - rungs[1].refusal) * perWeek, 9);
    expect(t.savedPerWeekPaise).toBeCloseTo(t.avoidedPerWeek * r.perRefusalPaise, 6);
    expect(t.costPerWeekPaise).toBeCloseTo(rungs[1].paise * rungs[1].prepaidShare * perWeek, 6);
    expect(t.prepaidOrdersPerWeek).toBeCloseTo(rungs[1].prepaidShare * perWeek, 9);
  });
});
