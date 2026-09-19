/**
 * The first run (plans/2026-09-19-first-run-plan.md).
 *
 * WHY THE AUCTION IS TESTED AT ALL. The first screen a beginner ever sees must
 * not teach a made-up number, in a project whose premise is that a simulator
 * teaching something false is worse than none. So the run's ladder is a real
 * auction, and these tests hold it to being one: its query is the query set's,
 * its ladder is `resolveAuction`'s own, its ads are the rivals' real copy, and
 * the lesson the whole run is built on is asserted rather than assumed.
 */

import { describe, test, expect } from 'vitest';
import { resolveAuction } from '../engine/auction.js';
import { MAX_SLOTS, AD_RANK_FLOOR, WEEKLY_VOLUME } from '../engine/constants.js';
import { QUERY_SET } from '../content/querySet.js';
import { demonstration, DEMO_QUERY_ID, DEMO_HOUR } from '../ui/firstrun/auction.js';

describe('the demonstration is a real auction, not a written one', () => {
  test('its query is one of the query set’s own, and its volume is the set’s', () => {
    const row = QUERY_SET.queries.find((q) => q.id === DEMO_QUERY_ID);
    expect(row, DEMO_QUERY_ID).toBeTruthy();
    const demo = demonstration();
    expect(demo.query.text).toBe(row.text);
    expect(demo.query.weekly).toBe(Math.round((row.volumeShareBp / 10000) * WEEKLY_VOLUME));
  });

  test('its ladder is what resolveAuction gives for its own entrants', () => {
    const demo = demonstration();
    const { ladder } = resolveAuction(demo.rows.map(({ id, bidPaise, signal }) => ({
      id, bidPaise, qualitySignal: signal,
    })));
    expect(ladder).toHaveLength(demo.rows.length);
    for (const row of ladder) {
      const mine = demo.rows.find((r) => r.id === row.id);
      expect(mine, row.id).toBeTruthy();
      expect(mine.position, row.id).toBe(row.position);
      expect(mine.cpcPaise, row.id).toBe(row.cpcPaise);
      expect(mine.shown, row.id).toBe(row.shown);
      expect(mine.adRank, row.id).toBe(row.adRank);
    }
  });

  // The beat says "only four slots", so the ones left out must be left out by
  // the slots and not by the reserve, or the sentence is wrong.
  test('four are shown, and the rest are out on slots rather than the reserve', () => {
    const demo = demonstration();
    expect(demo.rows.filter((r) => r.shown)).toHaveLength(MAX_SLOTS);
    for (const row of demo.rows.filter((r) => !r.shown)) {
      expect(row.adRank, `${row.name} should be out on slots, not the reserve`)
        .toBeGreaterThan(AD_RANK_FLOOR);
    }
  });

  test('not everyone entered, because a keyword has to match first', () => {
    const demo = demonstration();
    expect(demo.entered).toBeLessThan(demo.of);
    expect(demo.rows).toHaveLength(demo.entered);
  });

  test('every ad on screen is a real rival ad, with words in it', () => {
    for (const row of demonstration().rows) {
      expect(row.headlines.length, row.name).toBeGreaterThan(0);
      expect(row.descriptions.length, row.name).toBeGreaterThan(0);
      expect(row.headlines.join(' ').length, row.name).toBeGreaterThan(10);
      expect(row.domain, row.name).toMatch(/\.in$/);
      expect(row.name, row.id).toBeTruthy();
    }
  });

  // THE RUN'S CENTRAL LESSON, and beat 3's callout says it in so many words.
  // The engine handed it over; nobody wrote it. If this ever fails, the beats
  // and the artboards in design/first-run/ both have to be redrawn, so stop
  // and say so rather than adjusting anything here.
  test('THE LESSON: the runner-up pays less on a smaller bid, because its ad fits better', () => {
    const demo = demonstration();
    expect(demo.runnerUp.bidPaise, 'the runner-up must bid less').toBeLessThan(demo.winner.bidPaise);
    expect(demo.runnerUp.cpcPaise, 'the runner-up must pay less').toBeLessThan(demo.winner.cpcPaise);
    expect(demo.runnerUp.signal, 'the runner-up must have the better-fitting ad')
      .toBeGreaterThan(demo.winner.signal);
    expect(demo.winner.position).toBe(1);
    expect(demo.runnerUp.position).toBe(2);
  });

  test('the winner pays less than it bid, because nobody pays their own bid', () => {
    const demo = demonstration();
    expect(demo.winner.cpcPaise).toBeLessThan(demo.winner.bidPaise);
    expect(demo.winner.cpcPaise).toBeGreaterThan(0);
  });

  test('it is the same auction every time, so the run teaches one thing', () => {
    expect(demonstration().rows.map((r) => r.cpcPaise))
      .toEqual(demonstration().rows.map((r) => r.cpcPaise));
    expect(demonstration()).toBe(demonstration());
  });

  test('it is cheap enough for a screen that is drawn on every step back', () => {
    demonstration();
    const started = Date.now();
    for (let i = 0; i < 50; i += 1) demonstration();
    expect(Date.now() - started).toBeLessThan(50);
  });

  test('the hour it runs at is a real hour of the day', () => {
    expect(Number.isInteger(DEMO_HOUR)).toBe(true);
    expect(DEMO_HOUR).toBeGreaterThanOrEqual(0);
    expect(DEMO_HOUR).toBeLessThan(24);
  });

  test('every figure the beats quote is on the demonstration, not typed', () => {
    const demo = demonstration();
    for (const key of ['winner', 'runnerUp']) {
      expect(Number.isInteger(demo[key].bidPaise), key).toBe(true);
      expect(Number.isInteger(demo[key].cpcPaise), key).toBe(true);
      expect(typeof demo[key].name, key).toBe('string');
    }
    expect(Number.isInteger(demo.query.weekly)).toBe(true);
    expect(demo.query.weekly).toBeGreaterThan(0);
  });
});
