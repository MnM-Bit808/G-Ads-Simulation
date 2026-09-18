/**
 * THE BOOKS SETTLE THE TAIL (the owner's decision, 2026-09-18).
 *
 * A sale lands up to three weeks after its click and comes back two weeks after
 * that, so at the whistle the last weeks read high and weeks 11 and 12 count no
 * returns at all: a finished game left a median ₹3,46,560 of orders in flight,
 * per advertiser, and simply dropped them. The books now run the queue on past
 * the last week and write each arrival into the week whose click earned it,
 * with the engine's own reviser, so what is ranked is what the game earned.
 *
 * NO AUCTION IS RE-RUN. This is arithmetic after the last one, which is what
 * the traffic test below holds: every week's impressions, clicks and cost are
 * the ones the auctions produced.
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { playMarket, PLAYER } from '../scripts/market-harness.js';
import { settledHistory } from '../ui/ending.js';
import { TOTAL_ROUNDS } from '../engine/constants.js';

const SETTLES_BY = 2; // a return comes back two weeks after its sale lands

describe('the books settle the tail', { timeout: 120_000 }, () => {
  let state;
  let settled;

  beforeAll(async () => {
    ({ state } = await playMarket({ seed: 4, cell: 'mid|performance' }));
    settled = settledHistory(state);
  });

  test('set up: the game ends with sales in flight and the last weeks counting no returns', () => {
    const mine = (history, round) => history.find((h) => h.round === round).byAdvertiser[PLAYER];
    const inFlight = state.history.reduce((n, h) => n + h.byAdvertiser[PLAYER].conversions.stillPending, 0);
    expect(inFlight, 'nothing was still arriving, so this game proves nothing').toBeGreaterThan(1);
    for (const round of [TOTAL_ROUNDS - 1, TOTAL_ROUNDS]) {
      expect(mine(state.history, round).conversions.returned, `week ${round}`).toBe(0);
    }
  });

  test('every sale lands and every return comes back, in the week whose click earned it', () => {
    const mine = (history, round) => history.find((h) => h.round === round).byAdvertiser[PLAYER];
    for (const round of [TOTAL_ROUNDS - SETTLES_BY, TOTAL_ROUNDS]) {
      expect(mine(settled, round).conversions.returned, `week ${round}`).toBeGreaterThan(0);
    }
    for (const report of settled) {
      for (const [id, row] of Object.entries(report.byAdvertiser)) {
        expect(row.conversions.stillPending, `${id} week ${report.round}`).toBeLessThan(0.01);
        expect(row.conversions.returned, `${id} week ${report.round}`)
          .toBeLessThanOrEqual(row.conversions.final + 0.01);
      }
    }
  });

  test('and no auction number moves: the traffic is the one the auctions produced', () => {
    for (const [i, report] of settled.entries()) {
      const before = state.history[i];
      expect(report.round).toBe(before.round);
      for (const [id, row] of Object.entries(report.byAdvertiser)) {
        expect(row.traffic, `${id} week ${report.round}`).toEqual(before.byAdvertiser[id].traffic);
        expect(row.share, `${id} week ${report.round}`).toEqual(before.byAdvertiser[id].share);
        expect(row.quality, `${id} week ${report.round}`).toEqual(before.byAdvertiser[id].quality);
      }
    }
  });

  test('it settles every advertiser by the same rule, not only the player', () => {
    const late = (id) => settled.reduce((n, h) => n + h.byAdvertiser[id].conversions.final, 0)
      - state.history.reduce((n, h) => n + h.byAdvertiser[id].conversions.final, 0);
    for (const a of state.advertisers) expect(late(a.id), a.id).toBeGreaterThan(0);
  });

  test('reading the books twice gives the same figures', () => {
    // Pure: the books settle a copy from the game's own queues, so a redraw
    // reads the same numbers. (Settling an already-settled history with the
    // same queues would count every late sale twice — which is why the books
    // always start from the game's own history, never from their own output.)
    expect(settledHistory(state)).toEqual(settled);
  });

  test('it counts every queued sale exactly once', () => {
    const queued = (a) => (a.pendingConversions ?? []).reduce((n, e) => n + e.count, 0);
    for (const a of state.advertisers) {
      const before = state.history.reduce((n, h) => n + h.byAdvertiser[a.id].conversions.final, 0);
      const after = settled.reduce((n, h) => n + h.byAdvertiser[a.id].conversions.final, 0);
      expect(after - before, a.id).toBeCloseTo(queued(a), 6);
    }
  });

  test('it leaves the game\'s own history alone', () => {
    // The books read a settled copy; the state the save replays is untouched,
    // so a saved game still replays to the fingerprint it was saved with.
    expect(state.history.find((h) => h.round === TOTAL_ROUNDS).byAdvertiser[PLAYER].conversions.returned).toBe(0);
  });
});
