import { describe, test, expect } from 'vitest';
import { rankOf, gameTotals, summariseDecisions, finalStandings } from '../ui/ending.js';
import { submitRound } from '../game.js';
import { makeGameState, PLAYER_ID } from './fixtures/gameState.js';

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

  test('the budget plan and the hour adjustments are read back too', () => {
    // Both were missing until a played game showed the log saying nothing about
    // a week where the player had changed four hour blocks and a week budget.
    expect(lines([entry(6, { campaign: { weeklySplitPaise: [4200000, 4200000, 12000000, 4200000] } })])[0])
      .toBe('Planned the month as ₹42,000 / ₹42,000 / ₹1,20,000 / ₹42,000');
    expect(lines([entry(6, { campaign: { daypartAdjustments: [-100, 0, 0, 35, 0, 0] } })])[0])
      .toBe('Bid -100% late night, +35% afternoon');
    expect(lines([entry(6, { campaign: { daypartAdjustments: [0, 0, 0, 0, 0, 0] } })])[0])
      .toBe('Cleared every hour-of-day adjustment');
  });

  test('and neither is diffed, because their baseline moves on its own', () => {
    // advanceCampaign re-evens the split at every month boundary without a
    // decision, so diffing one submission against the previous would attribute
    // the engine's reset to the player.
    const log = [
      entry(2, { campaign: { weeklySplitPaise: [4200000, 4200000, 4200000, 4200000] } }),
      entry(6, { campaign: { weeklySplitPaise: [4200000, 4200000, 4200000, 4200000] } }),
    ];
    const rows = summariseDecisions(log, PLAYER, opening);
    expect(rows).toHaveLength(2);
    expect(rows[0].lines).toEqual(rows[1].lines);
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

describe('the books are opened after the last round (DECISIONS G3)', () => {
  // R3 forbids reading another advertiser's performance, and it forbids it for
  // the whole game — DECISIONS I7 is the record of a trend chart that could not
  // be a leaderboard for exactly this reason. This is the one place it is
  // lifted, and only once nothing can be done with it: after the final round
  // there is no decision left for the information to unfairly inform.
  //
  // What it buys is the question round 0 asks and nothing has ever answered.
  // 17.1 says a rival's position is inferred from its ad copy and never stated,
  // so a player who read those eight ads has spent twelve weeks not knowing
  // whether they read them right.
  const played = () => {
    const state = makeGameState({ round: 1 });
    let s = state;
    for (let r = 1; r <= 3; r++) s = submitRound({ ...s, round: r }, {}, { mode: 'expected' }).nextGameState;
    return s;
  };

  test('every advertiser is in it, not just the player', () => {
    const s = played();
    const rows = finalStandings(s);
    expect(rows).toHaveLength(s.advertisers.length);
    expect(rows.filter((r) => r.isYou)).toHaveLength(1);
  });

  test('it ranks by cumulative gross profit, which is what 13.1 calls the lead', () => {
    const rows = finalStandings(played());
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].grossProfitPaise).toBeGreaterThanOrEqual(rows[i].grossProfitPaise);
    }
    expect(rows[0].rank).toBe(1);
    expect(rows[rows.length - 1].rank).toBe(rows.length);
  });

  test('it names where each rival actually sat', () => {
    // The payoff. Nothing before this ever states a rival's cell.
    for (const row of finalStandings(played())) {
      expect(row.cell, row.name).toMatch(/^(value|mid|premium)\|(performance|lifestyle)$/);
    }
  });

  test('the player is marked, so a reader can find themselves', () => {
    const s = played();
    const me = finalStandings(s).find((r) => r.isYou);
    expect(me.id).toBe(PLAYER_ID);
  });

  test('it totals from history, the copy that gets revised', () => {
    // Same summation the player's own figures use. Reading the reports each
    // round first returned would count lag-0 conversions at the wrong value and
    // make the rivals look better than they were.
    const s = played();
    const me = finalStandings(s).find((r) => r.isYou);
    expect(me.grossProfitPaise).toBe(gameTotals(s.history, PLAYER_ID).all.grossProfitPaise);
  });

  test('an unplayed game yields nothing rather than a table of zeroes', () => {
    expect(finalStandings(makeGameState({ round: 1 }))).toEqual([]);
  });
});
