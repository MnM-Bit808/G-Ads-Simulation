/**
 * What a keyword must bid to show at all (ui/reserve.js), the figure behind the
 * keyword card's "under the reserve" warning in round 0 and in a played week.
 *
 * Proved against the engine's own auction, not restated: the warning claims a
 * bid one paise under the figure shows in NO auction, and the figure itself
 * clears the reserve in some. Alone in the auction, so that only the reserve
 * decides: in the default market rivals take every slot at these prices, and
 * a played week at a paise under and at 1.1 times the figure both showed
 * nothing, which says nothing about the reserve. Until 2026-09-14 the figure
 * ignored the evening's lift in the signal (`CONTEXT_FACTOR_CURVE`, up to
 * 1.05), so a bid it called unable to show at all could still show at 7pm.
 */

import { describe, test, expect } from 'vitest';
import { lowestBidToShowPaise } from '../ui/reserve.js';
import { QUERY_SET } from '../content/querySet.js';
import { minimumBidToShowPaise, resolveAuction } from '../engine/auction.js';
import { qualitySignalBase, applyHourAndNoise } from '../engine/quality.js';
import { HOURS_PER_DAY } from '../engine/querySet.js';
import { DAYPART_BLOCKS, LOCATION_TIERS } from '../engine/constants.js';

const GRADE = { expectedCtr: 6, adRelevance: 6, landingPage: 5 };
const KEYWORD = { text: 'gym leggings', matchType: 'exact' };
const HOURS = Array.from({ length: HOURS_PER_DAY }, (_, hour) => hour);
const figure = (over = {}) => lowestBidToShowPaise({ grade: GRADE, keyword: KEYWORD, querySet: QUERY_SET, ...over });

const query = QUERY_SET.queries.find((q) => q.text === KEYWORD.text);
const base = qualitySignalBase(GRADE, query, KEYWORD).base;
/** The engine's auction, with this bid alone in it, at this hour's signal. */
const showsAlone = (bidPaise, hour) => resolveAuction([
  { id: 'me', bidPaise, qualitySignal: applyHourAndNoise(base, hour, null, 'expected') },
]).ladder[0].shown;

describe('the auction agrees with the figure', () => {
  test('at the figure it clears the reserve in some hour; a paise under, in none', () => {
    const need = figure();
    expect(HOURS.some((hour) => showsAlone(need, hour)), 'the figure').toBe(true);
    expect(HOURS.some((hour) => showsAlone(need - 1, hour)), 'a paise under').toBe(false);
  });

  test('a paise under the figure priced without the hour still shows in the evening', () => {
    // Why it moved: the old figure warned bids that the auction lets through.
    const hourBlind = minimumBidToShowPaise(base);
    expect(HOURS.some((hour) => showsAlone(hourBlind - 1, hour))).toBe(true);
    expect(figure()).toBeLessThan(hourBlind);
  });
});

describe('the best hour, and the adjustments', () => {
  test('it is the floor at the hour the signal is strongest', () => {
    const best = Math.min(...HOURS.map((hour) => minimumBidToShowPaise(applyHourAndNoise(base, hour, null, 'expected'))));
    expect(figure()).toBe(best);
  });

  test('raising every hour lowers it; cutting every hour raises it', () => {
    const every = (pct) => DAYPART_BLOCKS.map(() => pct);
    expect(figure({ daypartAdjustments: every(100) })).toBeLessThan(figure());
    expect(figure({ daypartAdjustments: every(-50) })).toBeGreaterThan(figure());
  });

  test('the place its adjustment favours most counts', () => {
    const one = LOCATION_TIERS.map((_, t) => (t === 0 ? 50 : 0));
    expect(figure({ locationAdjustments: one })).toBeLessThan(figure());
  });

  test('with every hour switched off no bid shows, and it says so rather than guessing', () => {
    expect(figure({ daypartAdjustments: DAYPART_BLOCKS.map(() => -100) })).toBeNull();
  });
});
