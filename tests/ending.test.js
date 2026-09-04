import { describe, test, expect } from 'vitest';
import { rankOf, gameTotals, summariseDecisions } from '../ui/ending.js';

/**
 * The end screen's arithmetic and its account of what the player did.
 *
 * The screen itself needs a browser. What is tested here is what it says: the
 * sums, and the reading of `decisionLog` — which 12.4 has stored since the
 * first commit and which nothing has ever shown.
 */

const PLAYER = 'vella';

describe('rankOf hands over two numbers and nothing else (13.1, R3)', () => {
  const scheduled = (rankedAtSnapshot) => ({ budgetSchedule: { rankedAtSnapshot } });

  test('the player learns where they finished, and how big the field was', () => {
    const rank = rankOf(scheduled(['torvi', 'kestrel', PLAYER, 'nira']), PLAYER);
    expect(rank).toEqual({ position: 3, of: 4 });
  });

  test('and the order itself never leaves this function', () => {
    // The ranking array names every rival in profit order. The render is handed
    // two integers, so it cannot show a rival's standing even by accident.
    const rank = rankOf(scheduled(['torvi', PLAYER]), PLAYER);
    expect(Object.keys(rank).sort()).toEqual(['of', 'position']);
    expect(JSON.stringify(rank)).not.toMatch(/torvi/);
  });

  test('nothing is claimed before the snapshot round has happened', () => {
    expect(rankOf({ budgetSchedule: {} }, PLAYER)).toBeNull();
    expect(rankOf({}, PLAYER)).toBeNull();
    expect(rankOf(scheduled(['torvi']), PLAYER)).toBeNull();
  });
});

describe('gameTotals', () => {
  const week = (round, over) => ({
    round,
    byAdvertiser: {
      [PLAYER]: {
        traffic: { impressions: 1000, clicks: 100, costPaise: 50000 },
        conversions: { final: 4, stillPending: 0, asFirstReported: 3, returned: 1 },
        money: {
          grossProfitPaise: 20000, netProfitPaise: 15000,
          grossProfitAsFirstReportedPaise: 9000,
          grossRevenuePaise: 90000, netRevenuePaise: 80000,
        },
        ...over,
      },
      rival: {
        traffic: { impressions: 9, clicks: 9, costPaise: 9 },
        conversions: { final: 9, stillPending: 9, asFirstReported: 9, returned: 9 },
        money: {
          grossProfitPaise: 9, netProfitPaise: 9, grossProfitAsFirstReportedPaise: 9,
          grossRevenuePaise: 9, netRevenuePaise: 9,
        },
      },
    },
  });

  test('it sums the player and nobody else', () => {
    const { all } = gameTotals([week(1), week(2)], PLAYER);
    expect(all.costPaise).toBe(100000);
    expect(all.clicks).toBe(200);
    expect(all.netProfitPaise).toBe(30000);
    expect(all.conversions).toBe(8);
  });

  test('a week is settled when its conversions have all arrived', () => {
    const history = [
      week(1),
      week(2, { conversions: { final: 4, stillPending: 2.5, asFirstReported: 3, returned: 1 } }),
    ];
    const { weeks, settled } = gameTotals(history, PLAYER);
    expect(weeks.map((w) => w.settled)).toEqual([true, false]);
    expect(settled.count).toBe(1);
    expect(settled.netProfitPaise).toBe(15000);
    expect(all(history).stillPending).toBe(2.5);
  });

  test('it keeps both readings of every week, which is the whole lesson', () => {
    const { weeks, all: totals } = gameTotals([week(1)], PLAYER);
    expect(weeks[0].grossProfitAsFirstReportedPaise).toBe(9000);
    expect(weeks[0].grossProfitPaise).toBe(20000);
    expect(totals.grossProfitAsFirstReportedPaise).toBe(9000);
  });

  test('an empty history totals to nothing rather than throwing', () => {
    const { all: totals, weeks } = gameTotals([], PLAYER);
    expect(weeks).toEqual([]);
    expect(totals.costPaise).toBe(0);
  });

  const all = (history) => gameTotals(history, PLAYER).all;
});

describe('summariseDecisions reads the log back (12.4)', () => {
  const opening = { negatives: [], keywords: [{ id: 'kw_1', text: 'gym leggings', matchType: 'phrase', bidPaise: 3000, active: true }] };
  const entry = (round, decision, advertiserId = PLAYER) => ({ round, advertiserId, source: 'player', decision });
  const lines = (log, open = opening) => summariseDecisions(log, PLAYER, open).map((r) => r.lines).flat();

  test('another advertiser\'s decisions are not the player\'s', () => {
    const log = [entry(1, { campaign: { negatives: [{ text: 'free', matchType: 'broad' }] } }, 'torvi')];
    expect(summariseDecisions(log, PLAYER, opening)).toEqual([]);
  });

  test('a negative reads as what it blocked, and its removal as what it let back in', () => {
    const log = [
      entry(2, { campaign: { negatives: [{ text: 'free', matchType: 'broad' }] } }),
      entry(3, { campaign: { negatives: [] } }),
    ];
    const rows = summariseDecisions(log, PLAYER, opening);
    expect(rows[0].lines[0]).toMatch(/Blocked “free” \(broad\)/);
    expect(rows[1].lines[0]).toMatch(/Stopped blocking “free”/);
  });

  test('negatives are diffed against the last submission, not counted afresh', () => {
    // A decision carries the WHOLE list, so reporting its length every round
    // would say "blocked 2 searches" in a week where one was added.
    const log = [
      entry(2, { campaign: { negatives: [{ text: 'free', matchType: 'broad' }] } }),
      entry(3, {
        campaign: {
          negatives: [
            { text: 'free', matchType: 'broad' },
            { text: 'near me', matchType: 'phrase' },
          ],
        },
      }),
    ];
    expect(summariseDecisions(log, PLAYER, opening)[1].lines).toEqual([
      'Blocked “near me” (phrase)',
    ]);
  });

  test('keywords read as what changed about them', () => {
    const log = [entry(4, {
      adGroups: [{
        keywords: [
          { id: 'kw_1', text: 'gym leggings', matchType: 'broad', bidPaise: 4500, active: false },
          { id: 'kw_2', text: 'premium athleisure', matchType: 'phrase', bidPaise: 5500, active: true },
        ],
      }],
    })];
    const out = lines(log);
    expect(out).toContain('Added “premium athleisure” on phrase match at ₹55');
    expect(out).toContain('Paused “gym leggings”');
    expect(out).toContain('“gym leggings” to broad match');
    expect(out).toContain('“gym leggings” bid ₹30 → ₹45');
  });

  test('a strategy switch reads with the target it was given', () => {
    const log = [entry(5, {
      campaign: { strategy: 'targetCpa', strategyParams: { targetCpaPaise: 52000, targetRoas: 4 } },
    })];
    expect(lines(log)[0]).toBe('Switched bidding to Target CPA at ₹520');
  });

  test('a strategy with no target says so without inventing one', () => {
    const log = [entry(5, {
      campaign: { strategy: 'maxClicks', strategyParams: { targetCpaPaise: 52000, targetRoas: 4 } },
    })];
    expect(lines(log)[0]).toBe('Switched bidding to Maximise clicks');
  });

  test('capital reads as what it bought, or as the budget it became', () => {
    expect(lines([entry(5, { capex: { sizeGuide: 5500000, photography: 0, landingPage: 0 } })])[0])
      .toBe('Committed ₹55,000 to the size guide');
    expect(lines([entry(5, { capex: { sizeGuide: 0, photography: 0, landingPage: 0 } })])[0])
      .toBe('Took the whole ₹1,00,000 as advertising budget');
  });

  test('a move reads as a move', () => {
    expect(lines([entry(5, { position: { price: 'premium', purpose: 'lifestyle' } })])[0])
      .toBe('Moved to premium · lifestyle');
  });

  test('a week where nothing was submitted is not listed', () => {
    const log = [entry(6, { campaign: { negatives: [] } })];
    expect(summariseDecisions(log, PLAYER, opening)).toEqual([]);
  });
});
