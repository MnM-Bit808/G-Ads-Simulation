/**
 * The debrief's readings of a finished game (plans/2026-09-13-debrief.md).
 *
 * The rules are tested on small hand-built records, where every figure is
 * known, and then once on a real played game, to prove the readings agree with
 * what the game actually reported.
 *
 * Two of the rules exist to stop the debrief saying something false:
 * - a before/after reads TRAFFIC only, never conversions or profit, because
 *   those arrive for weeks and a before/after on them would mostly measure how
 *   settled each week was;
 * - the budget weeks are NEVER added up, because each week's "what if" spends
 *   the same remaining month.
 */

import { describe, test, expect } from 'vitest';
import {
  MAX_MOMENTS, MATERIAL_LOSS, moments, windowDifference, budgetWeeks, lessons, revealRows,
} from '../ui/debrief/read.js';
import { summariseDecisions, finalStandings } from '../ui/ending.js';
import { startGame } from '../setup.js';
import { playRound, replayLog } from '../game.js';
import { controllerFor } from '../agents/policies.js';
import { QUERY_SET } from '../content/querySet.js';
import { BRAND_IDENTITIES } from '../content/brands.js';
import { homeCell } from '../engine/querySet.js';
import { ROUNDS_PER_MONTH, LEARNING_ROUNDS } from '../engine/constants.js';

const P = 'player';

/** One week's report for the player, holding only what the readings use. */
function week(round, { clicks = 100, costPaise = 100_000, impressionShare = 0.5, netProfitPaise = 0, missed = null } = {}) {
  return {
    round,
    byAdvertiser: {
      [P]: {
        traffic: { impressions: clicks * 10, clicks, costPaise },
        share: { impressionShare, lostToRank: 0, lostToBudget: 0 },
        money: { netProfitPaise },
        missedToBudget: missed,
      },
    },
  };
}

/** A decision that blocks one more search, so every week has a line to show. */
const blocking = (round, ...texts) => ({
  round,
  advertiserId: P,
  source: 'player',
  decision: { campaign: { negatives: texts.map((text) => ({ text, matchType: 'phrase' })) } },
});

const OPENING = { negatives: [], keywords: [] };
const BASE = { playerId: P, opening: OPENING, allocationRounds: [1, 5], roundsPerMonth: 4, lastRound: 12 };

describe('which weeks become moments', () => {
  test('five or fewer decision weeks are all shown, in round order', () => {
    const history = Array.from({ length: 12 }, (_, i) => week(i + 1));
    const log = [blocking(3, 'a'), blocking(7, 'a', 'b'), blocking(9, 'a', 'b', 'c')];
    const picked = moments({ ...BASE, history, decisionLog: log });
    expect(picked.map((m) => m.round)).toEqual([3, 7, 9]);
    expect(picked[0].lines).toEqual(summariseDecisions(log, P, OPENING)[0].lines);
  });

  test('beyond five, the five with the largest change in clicks or cost per click', () => {
    // Spend is ₹1,000 every week, so cost per click moves with clicks. Worked
    // by hand, each decision week against the week before it:
    //   week 2  100 -> 150 clicks   larger change 0.50 (clicks)
    //   week 3  150 -> 120          0.25 (cost per click)
    //   week 4  120 -> 200          0.67 (clicks)
    //   week 5  200 -> 110          0.82 (cost per click)
    //   week 6  110 -> 130          0.18 (clicks)
    //   week 7  130 -> 130          0
    //   week 8  130 -> 300          1.31 (clicks)
    const clicksIn = { 1: 100, 2: 150, 3: 120, 4: 200, 5: 110, 6: 130, 7: 130, 8: 300 };
    const history = Array.from({ length: 12 }, (_, i) => week(i + 1, { clicks: clicksIn[i + 1] ?? 100 }));
    const log = [2, 3, 4, 5, 6, 7, 8].map((round, i) => blocking(round, ...'abcdefg'.slice(0, i + 1)));
    const picked = moments({ ...BASE, history, decisionLog: log });
    expect(MAX_MOMENTS).toBe(5);
    expect(picked.map((m) => m.round)).toEqual([2, 3, 4, 5, 8]);
  });

  test('when changes tie, the earlier weeks are kept', () => {
    // Decisions every other week, each doubling clicks from 100 to 200: six
    // candidates with exactly the same change, so the first five win.
    const history = Array.from({ length: 12 }, (_, i) => week(i + 1, { clicks: (i + 1) % 2 === 0 ? 200 : 100 }));
    const log = [2, 4, 6, 8, 10, 12].map((round, i) => blocking(round, ...'abcdef'.slice(0, i + 1)));
    const all = moments({ ...BASE, history, decisionLog: log }, { max: 99 });
    expect(new Set(all.map((m) => m.change)).size).toBe(1);
    expect(moments({ ...BASE, history, decisionLog: log }).map((m) => m.round)).toEqual([2, 4, 6, 8, 10]);
  });

  test('a decision in week 1 is not a moment, because there is no week before it', () => {
    const history = Array.from({ length: 4 }, (_, i) => week(i + 1));
    expect(moments({ ...BASE, history, decisionLog: [blocking(1, 'a')] })).toEqual([]);
  });
});

describe('what a moment shows', () => {
  test('the week before and the week after, in traffic and nothing else', () => {
    const history = [week(1, { clicks: 80, costPaise: 160_000, impressionShare: 0.4 }),
      week(2, { clicks: 0, costPaise: 0, impressionShare: 0 })];
    const [m] = moments({ ...BASE, history, decisionLog: [blocking(2, 'a')], lastRound: 2 });
    expect(Object.keys(m.before).sort()).toEqual(['clicks', 'costPaise', 'cpcPaise', 'impressionShare']);
    expect(Object.keys(m.after).sort()).toEqual(['clicks', 'costPaise', 'cpcPaise', 'impressionShare']);
    expect(m.before).toEqual({ clicks: 80, costPaise: 160_000, cpcPaise: 2000, impressionShare: 0.4 });
    expect(m.after.cpcPaise).toBeNull();
  });

  test('a new month begins in weeks 5 and 9, and capital lands in week 5', () => {
    const history = Array.from({ length: 12 }, (_, i) => week(i + 1));
    const log = [2, 5, 9, 11].map((round, i) => blocking(round, ...'abcd'.slice(0, i + 1)));
    const flags = moments({ ...BASE, history, decisionLog: log })
      .map((m) => [m.round, m.newMonth, m.capitalLanded]);
    expect(flags).toEqual([[2, false, false], [5, true, true], [9, true, false], [11, false, false]]);
  });

  test('the window ends the week before the next decision, or at the last week', () => {
    const history = Array.from({ length: 12 }, (_, i) => week(i + 1));
    const log = [3, 7].map((round, i) => blocking(round, ...'ab'.slice(0, i + 1)));
    expect(moments({ ...BASE, history, decisionLog: log }).map((m) => m.windowEnd)).toEqual([6, 12]);
  });
});

describe('the difference a removed decision made', () => {
  const history = [week(1, { clicks: 10, costPaise: 1000, netProfitPaise: 5 }),
    week(2, { clicks: 20, costPaise: 2000, netProfitPaise: 7 }),
    week(3, { clicks: 30, costPaise: 3000, netProfitPaise: 9 })];

  test('a game against itself differs by nothing', () => {
    expect(windowDifference(history, history, P, { from: 1, to: 3 }))
      .toEqual({ clicks: 0, costPaise: 0, netProfitPaise: 0 });
  });

  test('only the weeks in the window count, as the actual game minus the one without', () => {
    const without = [week(1, { clicks: 10, costPaise: 1000, netProfitPaise: 5 }),
      week(2, { clicks: 5, costPaise: 2500, netProfitPaise: 1 }),
      week(3, { clicks: 999, costPaise: 9999, netProfitPaise: 999 })];
    expect(windowDifference(history, without, P, { from: 2, to: 2 }))
      .toEqual({ clicks: 15, costPaise: -500, netProfitPaise: 6 });
  });
});

describe('the budget weeks', () => {
  const missed = (clicks, profitIfFundedPaise) => ({ clicks, profitIfFundedPaise });

  test('weeks that ran out split by whether the extra traffic would have paid for itself', () => {
    const history = [
      week(1),
      week(2, { missed: missed(300, 50_000) }),
      week(3, { missed: missed(200, -20_000) }),
      week(4, { missed: missed(0, 0) }),
      week(5, { missed: missed(500, 90_000) }),
      week(6, { missed: missed(100, 0) }),
    ];
    const read = budgetWeeks(history, P);
    expect(read.played).toBe(6);
    expect(read.ranOut).toBe(4);
    expect(read.paidFor.map((w) => w.round)).toEqual([2, 5]);
    expect(read.didNotPay.map((w) => w.round)).toEqual([3, 6]);
    expect(read.best).toEqual({ round: 5, clicks: 500, profitIfFundedPaise: 90_000 });
  });

  test('it is never a total: the weeks spend the same remaining month', () => {
    const read = budgetWeeks([week(1, { missed: missed(300, 50_000) })], P);
    expect(Object.keys(read).sort()).toEqual(['best', 'didNotPay', 'paidFor', 'played', 'ranOut']);
  });

  test('a budget that never ran out has no best week', () => {
    const read = budgetWeeks([week(1), week(2)], P);
    expect(read).toMatchObject({ ranOut: 0, paidFor: [], didNotPay: [], best: null });
  });
});

// ---------------------------------------------------------------------------
// The lessons (spec section 5)
// ---------------------------------------------------------------------------

/**
 * A fuller week, for the lessons: everything `finalStandings` reads, plus the
 * search terms breakdown. `terms` maps a query id to its clicks and cost.
 */
function fullWeek(round, {
  lostToBudget = 0, lostToRank = 0, gross = 1000, firstGross = gross, net = 600, terms = {},
} = {}) {
  const byQuery = Object.fromEntries(Object.entries(terms)
    .map(([id, [clicks, costPaise]]) => [id, { impressions: clicks * 10, clicks, costPaise }]));
  return {
    round,
    byAdvertiser: {
      [P]: {
        traffic: { impressions: 1000, clicks: 100, costPaise: 50_000 },
        share: { impressionShare: 0.5, lostToRank, lostToBudget },
        conversions: { final: 5, stillPending: 0, returned: 2 },
        money: {
          grossRevenuePaise: 3000, netRevenuePaise: 2000,
          grossProfitPaise: gross, netProfitPaise: net, grossProfitAsFirstReportedPaise: firstGross,
        },
        breakdown: { byQuery, byKeyword: {}, byLocation: {} },
        missedToBudget: null,
      },
    },
  };
}

const QUERIES = [
  { id: 'q1', text: 'co ord set' },
  { id: 'q2', text: 'lounge pants women' },
  { id: 'q3', text: 'gym leggings' },
  { id: 'q4', text: 'vella and co co ord' },
];
const ADVERTISERS = [
  { id: P, name: 'Vella & Co.', controller: 'player', position: { price: 'mid', purpose: 'lifestyle' } },
  { id: 'r1', name: 'Kestrel', controller: 'policy', position: { price: 'premium', purpose: 'lifestyle' } },
];
const phrase = (text, extra = {}) => ({ id: `k-${text}`, text, matchType: 'phrase', bidPaise: 1500, ...extra });

function lessonsFor({ history, decisionLog = [], keywords = [phrase('co ord set')], negatives = [] }) {
  const read = lessons({
    history,
    decisionLog,
    playerId: P,
    opening: { negatives, keywords },
    state: { advertisers: ADVERTISERS, querySet: { queries: QUERIES }, history },
  });
  return Object.fromEntries(read.map((lesson) => [lesson.id, lesson]));
}

describe('the six lessons', () => {
  test('come in the order the debrief shows them', () => {
    const read = lessons({
      history: [fullWeek(1)], decisionLog: [], playerId: P, opening: { negatives: [], keywords: [] },
      state: { advertisers: ADVERTISERS, querySet: { queries: QUERIES }, history: [fullWeek(1)] },
    });
    expect(read.map((l) => l.id))
      .toEqual(['numbersMove', 'rankOrBudget', 'broadMatch', 'returns', 'ownName', 'smartBidding']);
  });

  test('numbers keep moving: week 1 as first reported against as it stands', () => {
    const { numbersMove } = lessonsFor({ history: [fullWeek(1, { gross: 90_000, firstGross: 40_000 }), fullWeek(2)] });
    expect(numbersMove).toMatchObject({ met: true, figures: { firstReportedPaise: 40_000, nowPaise: 90_000 } });
  });

  test('rank or budget: met at 10%, naming the worst week and which kind of loss', () => {
    expect(MATERIAL_LOSS).toBe(0.10);
    const met = lessonsFor({ history: [fullWeek(1, { lostToBudget: 0.05 }), fullWeek(2, { lostToRank: 0.10 }),
      fullWeek(3, { lostToBudget: 0.30 })] }).rankOrBudget;
    expect(met).toMatchObject({ met: true, figures: { round: 3, kind: 'budget', share: 0.30 } });
    const edge = lessonsFor({ history: [fullWeek(1, { lostToRank: 0.10 })] }).rankOrBudget;
    expect(edge).toMatchObject({ met: true, figures: { round: 1, kind: 'rank' } });
    const missed = lessonsFor({ history: [fullWeek(1, { lostToBudget: 0.09 }), fullWeek(2, { lostToRank: 0.02 })] }).rankOrBudget;
    expect(missed.met).toBe(false);
  });

  test('broad match: met by an active broad keyword, counting searches no keyword spelled out', () => {
    const history = [fullWeek(1, { terms: { q1: [10, 500], q2: [4, 200], q3: [0, 0] } }),
      fullWeek(2, { terms: { q2: [3, 150], q3: [2, 100] } })];
    const broad = lessonsFor({
      history,
      keywords: [phrase('co ord set', { matchType: 'broad' })],
      negatives: [{ text: 'gym', matchType: 'phrase' }],
    }).broadMatch;
    // q1 is a keyword's own text; q2 and q3 bought clicks and are no keyword's.
    expect(broad).toMatchObject({ met: true, figures: { unwrittenTerms: 2, negatives: 1 } });

    const later = lessonsFor({
      history,
      decisionLog: [{ round: 2, advertiserId: P, source: 'player',
        decision: { adGroups: [{ keywords: [phrase('co ord set', { matchType: 'broad' })] }] } }],
    }).broadMatch;
    expect(later.met).toBe(true);

    expect(lessonsFor({ history }).broadMatch.met).toBe(false);
    expect(lessonsFor({ history, keywords: [phrase('co ord set', { matchType: 'broad', active: false })] })
      .broadMatch.met).toBe(false);
  });

  test('defending your name: met by a keyword naming your own brand, not a rival\'s', () => {
    const history = [fullWeek(1, { terms: { q4: [10, 1000], q1: [20, 6000] } })];
    const own = lessonsFor({ history, keywords: [phrase('vella and co co ord'), phrase('co ord set')] }).ownName;
    expect(own).toMatchObject({ met: true, figures: { ownCpcPaise: 100, otherCpcPaise: 300 } });
    expect(lessonsFor({ history, keywords: [phrase('kestrel leggings')] }).ownName.met).toBe(false);
    expect(lessonsFor({ history }).ownName.met).toBe(false);
  });

  test('smart bidding: met by the first strategy switch, with its learning weeks', () => {
    const history = [fullWeek(1), fullWeek(2), fullWeek(3)];
    const decisionLog = [
      { round: 2, advertiserId: P, source: 'player', decision: { campaign: { strategy: 'maxConv' } } },
      { round: 3, advertiserId: P, source: 'player', decision: { campaign: { strategy: 'manual' } } },
      { round: 2, advertiserId: 'r1', source: 'policy', decision: { campaign: { strategy: 'targetRoas' } } },
    ];
    expect(lessonsFor({ history, decisionLog }).smartBidding)
      .toMatchObject({ met: true, figures: { round: 2, strategy: 'maxConv', learningWeeks: LEARNING_ROUNDS } });
    expect(lessonsFor({ history }).smartBidding.met).toBe(false);
  });

  test('smart bidding: only a strategy that predicts conversions learns, so only that counts', () => {
    // A learning period only affects a strategy that estimates conversions;
    // manual and maximise clicks bid without one (engine/strategies.js), so a
    // switch to either would make the lesson's sentence false.
    const history = [fullWeek(1), fullWeek(2), fullWeek(3)];
    const switchTo = (round, strategy) => ({ round, advertiserId: P, source: 'player', decision: { campaign: { strategy } } });
    expect(lessonsFor({ history, decisionLog: [switchTo(2, 'maxClicks')] }).smartBidding.met).toBe(false);
    expect(lessonsFor({ history, decisionLog: [switchTo(2, 'maxClicks'), switchTo(3, 'targetCpa')] }).smartBidding)
      .toMatchObject({ met: true, figures: { round: 3, strategy: 'targetCpa' } });
  });

  test('returns: always met, with the end screen\'s own share and ranks', () => {
    const history = [fullWeek(1, { gross: 1000, net: 600 })];
    const { returns } = lessonsFor({ history });
    const row = finalStandings({ advertisers: ADVERTISERS, history }).find((r) => r.id === P);
    expect(returns).toMatchObject({
      met: true, figures: { returnedShare: row.returnedShare, rank: row.rank, grossRank: row.grossRank },
    });
  });
});

// ---------------------------------------------------------------------------
// The reveal (spec section 6)
// ---------------------------------------------------------------------------

describe('where they sat: scoring the guesses', () => {
  const ad = (name) => ({ headlines: [`${name} one`, 'two', 'three'], descriptions: ['a', 'b'] });
  const rival = (id, name, price, purpose) => ({
    id, name, domain: `${id}.in`, position: { price, purpose }, adGroups: [{ ad: ad(name) }],
  });
  const START = {
    advertisers: [
      { id: P, name: 'Vella & Co.', domain: 'vella.in', position: { price: 'mid', purpose: 'lifestyle' }, adGroups: [{ ad: ad('Vella') }] },
      rival('b', 'Birch', 'value', 'lifestyle'),
      rival('a', 'Aster', 'mid', 'lifestyle'),
      rival('c', 'Cedar', 'premium', 'performance'),
      rival('d', 'Dune', 'mid', 'performance'),
      rival('e', 'Elm', 'value', 'performance'),
    ],
  };

  test('exact, half on price, half on purpose, wrong, and skipped', () => {
    const read = revealRows(START, P, {
      a: { price: 'mid', purpose: 'lifestyle' },
      b: { price: 'value', purpose: 'performance' },
      c: { price: 'value', purpose: 'performance' },
      d: { price: 'premium', purpose: 'lifestyle' },
    });
    expect(Object.fromEntries(read.rows.map((r) => [r.id, r.result])))
      .toEqual({ a: 'exact', b: 'price', c: 'purpose', d: 'wrong', e: 'skipped' });
    expect(read.exact).toBe(1);
    expect(read.half).toBe(2);
  });

  test('rivals in alphabetical order, with their round-0 ad, and never the player', () => {
    const read = revealRows(START, P, {});
    expect(read.rows.map((r) => r.name)).toEqual(['Aster', 'Birch', 'Cedar', 'Dune', 'Elm']);
    expect(read.rows[0]).toMatchObject({ domain: 'a.in', ad: ad('Aster'), truth: { price: 'mid', purpose: 'lifestyle' } });
    expect(read.rows.some((r) => r.id === P)).toBe(false);
  });

  test('who shared the player\'s cell, and nobody when nobody did', () => {
    expect(revealRows(START, P, {}).cellmates).toEqual(['Aster']);
    const alone = { advertisers: START.advertisers.filter((a) => a.id !== 'a') };
    expect(revealRows(alone, P, {}).cellmates).toEqual([]);
  });
});

// Plays whole games: a ceiling, not a speed test (see save.test.js).
describe('on a real played game', { timeout: 60_000 }, () => {
  const PLAYER = BRAND_IDENTITIES[0].id;
  const own = QUERY_SET.queries.filter((q) => homeCell(q) === 'mid|lifestyle').slice(0, 4);

  async function play({ matchType, bidPaise, scripted, weeks }) {
    const start = startGame({
      rootSeed: 20260902,
      playerBrandId: PLAYER,
      querySet: QUERY_SET,
      player: {
        position: { price: 'mid', purpose: 'lifestyle' },
        capex: { sizeGuide: 0, photography: 0, landingPage: 0 },
        keywords: own.map((q) => ({ text: q.text, matchType, bidPaise })),
        ad: {
          headlines: ['Everyday Co-ord Sets', 'Soft Lounge Sets', 'Sizes XS To XXL'],
          descriptions: [
            'Soft co-ord sets and lounge pants to wear all day.',
            'Free delivery over Rs 1,499 and 30-day returns.',
          ],
          landingPageDescription: 'A plain product page.',
        },
        writerTier: 'agency',
      },
    });
    const controllers = Object.fromEntries(start.advertisers.map((a, i) => [
      a.id, i === 0 ? (self) => scripted[self.round] ?? null : controllerFor(a.policyId),
    ]));
    const sources = Object.fromEntries(start.advertisers.map((a, i) => [
      a.id, i === 0 ? 'player' : `policy:${a.policyId}`,
    ]));
    // counterfactualFor asks the engine for the player's missedToBudget. It is
    // only computed when asked, and until the debrief nothing in the game asked.
    let state = start;
    while (state.round <= weeks) {
      state = (await playRound(state, controllers, {
        mode: 'expected', sources, counterfactualFor: [PLAYER],
      })).nextGameState;
    }
    return { start, state };
  }

  // Broad keywords bid high, so the budget runs out; two scripted decisions.
  let spending = null;
  const spendingGame = () => {
    spending ??= play({
      matchType: 'broad',
      bidPaise: 6000,
      weeks: 8,
      scripted: {
        3: { campaign: { negatives: [{ text: 'gym', matchType: 'broad' }] } },
        6: { campaign: { strategy: 'maxClicks' } },
      },
    });
    return spending;
  };

  test('each moment\'s before and after are the reports\' own traffic figures', async () => {
    const { start, state } = await spendingGame();
    const history = state.history;
    const picked = moments({
      history,
      decisionLog: state.decisionLog,
      playerId: PLAYER,
      opening: { negatives: start.advertisers[0].campaign.negatives, keywords: start.advertisers[0].adGroups[0].keywords },
      allocationRounds: state.budgetSchedule.capexAllocationRounds,
      roundsPerMonth: ROUNDS_PER_MONTH,
      lastRound: 8,
    });
    expect(picked.map((m) => m.round)).toEqual([3, 6]);
    for (const m of picked) {
      const row = history.find((r) => r.round === m.round).byAdvertiser[PLAYER];
      expect(m.after.clicks).toBe(row.traffic.clicks);
      expect(m.after.costPaise).toBe(row.traffic.costPaise);
      expect(m.after.impressionShare).toBe(row.share.impressionShare);
    }
    expect(picked.map((m) => m.windowEnd)).toEqual([5, 8]);
  });

  test('asking for the budget "what if" changes nothing else about the game', async () => {
    // The debrief works it out at the END, by replaying the game with
    // counterfactualFor switched on (decided 2026-09-13). That is only the
    // game the player played if the extra pass disturbs nothing: the same
    // game replayed WITHOUT it must match, report for report, apart from the
    // missedToBudget field itself.
    const { start, state } = await spendingGame();
    const plain = replayLog(start, state.decisionLog, { mode: 'expected', throughRound: 8 });
    const strip = (history) => JSON.stringify(history.map((report) => ({
      ...report,
      byAdvertiser: Object.fromEntries(Object.entries(report.byAdvertiser)
        .map(([id, row]) => [id, { ...row, missedToBudget: null }])),
    })));
    expect(strip(plain.finalState.history)).toBe(strip(state.history));
    expect(plain.finalState.history.some((r) => r.byAdvertiser[PLAYER].missedToBudget)).toBe(false);
  });

  test('the reveal\'s truth agrees with the standings table\'s position column', async () => {
    const { start, state } = await spendingGame();
    const { rows } = revealRows(start, PLAYER, {});
    const standings = new Map(finalStandings(state).map((r) => [r.id, r.cell]));
    expect(rows).toHaveLength(state.advertisers.length - 1);
    for (const row of rows) {
      expect(`${row.truth.price}|${row.truth.purpose}`, row.name).toBe(standings.get(row.id));
    }
  });

  test('the budget weeks are exactly the weeks the game reported running out', async () => {
    const { state } = await spendingGame();
    const read = budgetWeeks(state.history, PLAYER);
    const reported = state.history.filter((r) => (r.byAdvertiser[PLAYER].missedToBudget?.clicks ?? 0) > 0);
    // The premise: this game's budget does run out, or the test proves nothing.
    expect(reported.length).toBeGreaterThan(0);
    expect(read.ranOut).toBe(reported.length);
    expect([...read.paidFor, ...read.didNotPay].map((w) => w.round).sort((a, b) => a - b))
      .toEqual(reported.map((r) => r.round));
  });
});
