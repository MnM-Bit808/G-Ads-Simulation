import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  playRound, submitRound, playGame, triggersLearning, replayLog, logWithout, replayWithout,
} from '../game.js';
import { startGame } from '../setup.js';
import { controllerFor } from '../agents/policies.js';
import { QUERY_SET } from '../content/querySet.js';
import { BRAND_IDENTITIES } from '../content/brands.js';
import { homeCell } from '../engine/querySet.js';
import { advertiserReport } from '../engine/report.js';
import { makeGameState, deformed, PLAYER_ID } from './fixtures/gameState.js';
import { asOldSave } from './fixtures/oldSave.js';
import {
  LEARNING_ROUNDS, CAPEX_ALLOCATION_PAISE, CAPEX_DELAY_ROUNDS,
  REPOSITION_ROUND, REPOSITION_COST_PAISE, MONTHLY_BUDGET_PAISE, TOTAL_ROUNDS,
} from '../engine/constants.js';

const STATE = makeGameState();
const noop = () => null;
const everyone = (fn) => Object.fromEntries(STATE.advertisers.map((a) => [a.id, fn]));

describe('controllers receive views, never state (R3a)', () => {
  test('a controller is handed exactly four things', async () => {
    let seen = null;
    await playRound(STATE, { [PLAYER_ID]: (...args) => { seen = args; return null; } },
      { mode: 'expected' });
    expect(seen).toHaveLength(4);
    const [self, report, view, history] = seen;
    expect(self.id).toBe(PLAYER_ID);
    expect(report).toBeNull();           // round 1 has no previous report
    expect(view.advertisers).toBeDefined();
    expect(history).toEqual([]);         // and no weeks played yet
  });

  test('the fourth is its own weeks, every one played, as revised since', async () => {
    // The week just played never carries a return: a week's returns land two
    // to five weeks after its clicks and are written back into that week's
    // report. A controller handed only that week cannot learn what comes back,
    // and three rival rules read zero because of it (DECISIONS C9).
    let state = STATE;
    let before = null;
    let seen = null;
    for (let r = 1; r <= 3; r++) {
      before = state;
      const controllers = { [PLAYER_ID]: (...args) => { seen = args; return null; } };
      state = (await playRound(state, controllers, { mode: 'expected' })).nextGameState;
    }
    // Handed at the start of week 3: weeks 1 and 2, each its own slice of the
    // history as it stood then.
    const [, report, , history] = seen;
    expect(history.map((week) => week.round)).toEqual([1, 2]);
    expect(history).toEqual(before.history.map((h) => advertiserReport(h, PLAYER_ID)));
    // Revised, not as first reported: week 1 has had week 2's late conversions.
    expect(history[0].revisedAtRound).toBe(2);
    // The week just played is the same week the second argument carries.
    expect(history.at(-1)).toEqual(report);
  });

  test('and nothing of anyone else\'s', async () => {
    let state = STATE;
    let seen = null;
    for (let r = 1; r <= 3; r++) {
      const controllers = { [PLAYER_ID]: (...args) => { seen = args; return null; } };
      state = (await playRound(state, controllers, { mode: 'expected' })).nextGameState;
    }
    const others = STATE.advertisers.map((a) => a.id).filter((id) => id !== PLAYER_ID);
    for (const week of seen[3]) {
      expect(week).not.toHaveProperty('byAdvertiser');
      // No rival's id anywhere in it, as a key or a value.
      const text = JSON.stringify(week);
      for (const id of others) expect(text.includes(`"${id}"`), id).toBe(false);
    }
  });

  test('none of the four is GameState, or contains it', async () => {
    // The rule that cannot be tested behaviourally (W12) and so is tested by
    // shape: GameState's own top-level keys must not be reachable from
    // anything a controller was handed.
    let state = STATE;
    let seen = null;
    for (let r = 1; r <= 2; r++) {
      const controllers = { [PLAYER_ID]: (...args) => { seen = args; return null; } };
      state = (await playRound(state, controllers, { mode: 'expected' })).nextGameState;
    }
    for (const arg of [...seen.slice(0, 3), ...seen[3]]) {
      if (arg == null) continue;
      for (const key of ['rootSeed', 'budgetSchedule', 'decisionLog', 'schemaVersion', 'history']) {
        expect(arg, key).not.toHaveProperty(key);
      }
    }
  });

  test('a controller that reaches for a forbidden key finds nothing there', async () => {
    // Stronger than a source grep, which cannot catch view['price' + 'Affinity'].
    // Every property a controller touches is recorded and checked afterwards.
    const touched = new Set();
    const watch = (obj, path = '') => new Proxy(obj, {
      get(target, prop) {
        if (typeof prop === 'string') touched.add(path ? `${path}.${prop}` : prop);
        const value = target[prop];
        return value && typeof value === 'object' && !ArrayBuffer.isView(value)
          ? watch(value, path ? `${path}.${prop}` : prop)
          : value;
      },
    });

    await playRound(STATE, {
      [PLAYER_ID]: (self, report, view) => {
        const w = [watch(self, 'self'), report, watch(view, 'view')];
        // A greedy controller, rummaging for anything it can find.
        void w[0].campaign.strategy;
        void w[0].catalogue.aovMeanPaise;
        void w[0].catalogue.convRateBase;
        void w[2].querySet[0].text;
        void w[2].querySet[0].priceAffinity;
        return null;
      },
    }, { mode: 'expected' });

    // It may LOOK; what matters is that nothing was there to find.
    expect([...touched]).toContain('self.catalogue.convRateBase');
    const self = STATE.advertisers[0];
    expect(self).toBeDefined();
  });

  test('the module cannot reach a model or the network', () => {
    // agents/ may call Claude; this loop may not. It invokes controllers and
    // has no business knowing what is behind them (R2).
    const src = readFileSync(fileURLToPath(new URL('../game.js', import.meta.url)), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const escape of ['fetch(', 'XMLHttpRequest', 'require(', 'import(']) {
      expect(src.includes(escape), escape).toBe(false);
    }
    expect(/from\s*['"][^'"]*agents/.test(src)).toBe(false);
  });
});

describe('the player is shown their Quality Score (spec 15.2, 9.3)', () => {
  // Nothing in engine/ may read reportedScore (hard rule 4), so runRound hands
  // back a report with an empty `quality` block and the CALLER fills it. Until
  // game.js existed there was no caller, attachQualityScores was exported and
  // invoked by nothing, and a played game showed the player no Quality Score
  // at all - the diagnostic the whole of section 9 is built around.
  //
  // Found by playing twelve rounds and reading what a player would see.

  test('round 1 shows null, because the window is completed rounds only', () => {
    const out = submitRound(STATE, {}, { mode: 'expected' });
    const quality = out.report.byAdvertiser[PLAYER_ID].quality;
    expect(Object.keys(quality).length).toBeGreaterThan(0);
    for (const [id, score] of Object.entries(quality)) {
      expect(score, id).toBeNull();
    }
  });

  test('and a later round shows a score for every keyword', async () => {
    let state = STATE;
    for (let r = 1; r <= 3; r++) {
      state = submitRound(state, {}, { mode: 'expected' }).nextGameState;
    }
    const out = submitRound(state, {}, { mode: 'expected' });
    const quality = out.report.byAdvertiser[PLAYER_ID].quality;
    const scores = Object.values(quality).filter((s) => s !== null);
    expect(scores.length).toBeGreaterThan(0);
    for (const score of scores) {
      expect(score.score).toBeGreaterThanOrEqual(1);
      expect(score.score).toBeLessThanOrEqual(10);
      expect(['above', 'average', 'below']).toContain(score.expectedCtr);
    }
  });

  test('an advertiser sees its own scores and nobody else appears in its slice', () => {
    const out = submitRound(STATE, {}, { mode: 'expected' });
    const slice = advertiserReport(out.report, PLAYER_ID);
    const own = new Set(STATE.advertisers[0].adGroups[0].keywords.map((k) => k.id));
    for (const id of Object.keys(slice.quality)) {
      expect(own.has(id), id).toBe(true);
    }
  });

  test('the copy stored in history carries them too', () => {
    const out = submitRound(STATE, {}, { mode: 'expected' });
    const stored = out.nextGameState.history.find((h) => h.round === STATE.round);
    expect(stored.byAdvertiser[PLAYER_ID].quality)
      .toEqual(out.report.byAdvertiser[PLAYER_ID].quality);
  });
});

describe('learning periods are set here, not in the engine (spec 12.3, L7)', () => {
  const advertiser = STATE.advertisers[0];

  test('switching strategy triggers one', () => {
    expect(triggersLearning(advertiser, { campaign: { strategy: 'targetCpa' } })).toBe(true);
  });

  test('changing a strategy parameter triggers one', () => {
    expect(triggersLearning(advertiser, {
      campaign: { strategyParams: { targetCpaPaise: 99999, targetRoas: 5.0 } },
    })).toBe(true);
  });

  test('repositioning triggers one', () => {
    expect(triggersLearning(advertiser, {
      position: { price: 'mid', purpose: 'performance' },
    })).toBe(true);
  });

  test('editing ad copy does NOT', () => {
    // A learning period exists because the bid model must re-estimate. A
    // headline does not invalidate an estimate of how often people convert,
    // and a sim that punished copy edits would teach people not to improve
    // their ads.
    expect(triggersLearning(advertiser, {
      adGroups: [{ ...advertiser.adGroups[0], ad: { headlines: ['New'], descriptions: ['New'] } }],
    })).toBe(false);
  });

  test('nor do bids, keywords, negatives or budget', () => {
    for (const decision of [
      { adGroups: [{ ...advertiser.adGroups[0], keywords: [] }] },
      { campaign: { negatives: [{ text: 'free', matchType: 'broad' }] } },
      { campaign: { weeklySplitPaise: [1, 2, 3, 4] } },
      { campaign: { daypartAdjustments: [10, 0, 0, 0, 0, 0] } },
      { campaign: { strategy: advertiser.campaign.strategy } },
    ]) {
      expect(triggersLearning(advertiser, decision), JSON.stringify(decision).slice(0, 40))
        .toBe(false);
    }
  });

  test('and the period actually reaches the round', () => {
    const out = submitRound(STATE, {
      [PLAYER_ID]: { campaign: { strategy: 'targetCpa' } },
    }, { mode: 'expected' });
    // Set to LEARNING_ROUNDS before the round, decremented by it. Two rounds
    // of elevated error: this one and the next.
    expect(out.nextGameState.advertisers[0].bidding.learningRoundsRemaining)
      .toBe(LEARNING_ROUNDS - 1);
  });
});

describe('decisions are logged as they are submitted (spec 12.4)', () => {
  test('every decision lands in the log with its round and source', () => {
    const out = submitRound(STATE, {
      [PLAYER_ID]: { campaign: { strategy: 'maxClicks' } },
    }, { mode: 'expected', sources: { [PLAYER_ID]: 'policy:disciplined' } });

    expect(out.nextGameState.decisionLog).toHaveLength(1);
    const [entry] = out.nextGameState.decisionLog;
    expect(entry.round).toBe(STATE.round);
    expect(entry.advertiserId).toBe(PLAYER_ID);
    expect(entry.source).toBe('policy:disciplined');
  });

  test('the log grows rather than being replaced', async () => {
    const r1 = submitRound(STATE, { [PLAYER_ID]: { campaign: {} } }, { mode: 'expected' });
    const r2 = submitRound(r1.nextGameState, { [PLAYER_ID]: { campaign: {} } }, { mode: 'expected' });
    expect(r2.nextGameState.decisionLog).toHaveLength(2);
    expect(r2.nextGameState.decisionLog[0].round).toBe(1);
    expect(r2.nextGameState.decisionLog[1].round).toBe(2);
  });
});

describe('capital is committed here (spec 13.3)', () => {
  test('a tranche is recorded and goes live CAPEX_DELAY_ROUNDS later', () => {
    const out = submitRound(STATE, {
      [PLAYER_ID]: { capex: { photography: CAPEX_ALLOCATION_PAISE } },
    }, { mode: 'expected' });
    const capex = out.nextGameState.advertisers[0].capex;
    expect(capex.committed.photography).toBe(CAPEX_ALLOCATION_PAISE);
    expect(capex.pending[0].liveAtRound).toBe(STATE.round + CAPEX_DELAY_ROUNDS);
  });

  test('what is not committed rolls into the month, and is spendable', () => {
    const half = CAPEX_ALLOCATION_PAISE / 2;
    const out = submitRound(STATE, {
      [PLAYER_ID]: { capex: { sizeGuide: half } },
    }, { mode: 'expected' });
    expect(out.raw.byAdvertiser[PLAYER_ID].monthlyBudgetPaise)
      .toBe(MONTHLY_BUDGET_PAISE + half);
    expect(out.nextGameState.advertisers[0].campaign.weeklySplitPaise
      .reduce((a, b) => a + b, 0)).toBe(MONTHLY_BUDGET_PAISE + half);
  });

  test('committing more than the allocation throws rather than silently capping', () => {
    expect(() => submitRound(STATE, {
      [PLAYER_ID]: { capex: { sizeGuide: CAPEX_ALLOCATION_PAISE, photography: 1 } },
    }, { mode: 'expected' })).toThrow(/exceeds/);
  });

  test('an unknown target throws', () => {
    expect(() => submitRound(STATE, {
      [PLAYER_ID]: { capex: { billboards: 100 } },
    }, { mode: 'expected' })).toThrow(/billboards/);
  });

  test('committing outside an allocation round throws', () => {
    // The engine never DEBITS capital. It converts whatever was left
    // uncommitted into ad budget, and only at capexAllocationRounds. So a
    // commitment in any other round has no allocation to consume and nothing
    // to forfeit: measured before this guard, round 7 recorded the tranche
    // exactly as round 1 did with the month's budget untouched, which is
    // ₹1,00,000 of free investment, repeatable every round.
    const atSeven = deformed(STATE, (x) => { x.round = 7; });
    expect(() => submitRound(atSeven, {
      [PLAYER_ID]: { capex: { photography: CAPEX_ALLOCATION_PAISE } },
    }, { mode: 'expected' })).toThrow(/only in round 1 and 5/);
  });

  test('and the second allocation round still works', () => {
    const atFive = deformed(STATE, (x) => { x.round = REPOSITION_ROUND; });
    const out = submitRound(atFive, {
      [PLAYER_ID]: { capex: { photography: CAPEX_ALLOCATION_PAISE } },
    }, { mode: 'expected' });
    expect(out.nextGameState.advertisers[0].capex.pending.at(-1).liveAtRound)
      .toBe(REPOSITION_ROUND + CAPEX_DELAY_ROUNDS);
  });

  test('a state with no budget schedule refuses rather than guessing', () => {
    const noSchedule = deformed(STATE, (x) => { delete x.budgetSchedule; });
    expect(() => submitRound(noSchedule, {
      [PLAYER_ID]: { capex: { sizeGuide: 100 } },
    }, { mode: 'expected' })).toThrow(/allocation round/);
  });
});

describe('repositioning is applied here and charged by the round (spec 4.5)', () => {
  const atFive = deformed(STATE, (x) => { x.round = REPOSITION_ROUND; });

  test('one step is permitted, and costs', () => {
    const out = submitRound(atFive, {
      [PLAYER_ID]: { position: { price: 'mid', purpose: 'performance' } },
    }, { mode: 'expected' });
    const moved = out.nextGameState.advertisers[0];
    expect(moved.position.price).toBe('mid');
    expect(moved.position.repositionedAtRound).toBe(REPOSITION_ROUND);
    expect(out.raw.byAdvertiser[PLAYER_ID].monthlyBudgetPaise)
      .toBe(MONTHLY_BUDGET_PAISE - REPOSITION_COST_PAISE);
  });

  test('two steps throws', () => {
    expect(() => submitRound(atFive, {
      [PLAYER_ID]: { position: { price: 'premium', purpose: 'lifestyle' } },
    }, { mode: 'expected' })).toThrow(/one step/);
  });

  test('the wrong round throws', () => {
    expect(() => submitRound(STATE, {
      [PLAYER_ID]: { position: { price: 'mid', purpose: 'performance' } },
    }, { mode: 'expected' })).toThrow(/may not reposition/);
  });
});

describe('a game plays', () => {
  test('three rounds run through controllers and the state advances', async () => {
    const { finalState, reports } = await playGame(STATE, everyone(noop), {
      mode: 'expected', rounds: 3,
    });
    expect(reports).toHaveLength(3);
    expect(finalState.round).toBe(4);
    expect(finalState.history).toHaveLength(3);
  });

  test('an async controller works exactly like a sync one', async () => {
    const sync = await playGame(STATE, everyone(() => ({ campaign: {} })), { mode: 'expected', rounds: 2 });
    const async_ = await playGame(STATE, everyone(async () => ({ campaign: {} })), { mode: 'expected', rounds: 2 });
    expect(async_.reports[1].byAdvertiser[PLAYER_ID].traffic.costPaise)
      .toBe(sync.reports[1].byAdvertiser[PLAYER_ID].traffic.costPaise);
  });

  test('an advertiser with no controller simply keeps its settings', async () => {
    const { reports } = await playGame(STATE, { [PLAYER_ID]: noop }, { mode: 'expected', rounds: 1 });
    expect(Object.keys(reports[0].byAdvertiser)).toHaveLength(STATE.advertisers.length);
  });
});

describe('self-written copy ships on its delivery date (DECISIONS I11)', () => {
  // The DELIVERY is delayed, never the effect. CLAUDE.md is explicit that an ad
  // copy change must move qualitySignal IMMEDIATELY and leave reportedScore
  // unchanged in the same round — so a grade that faded in over several rounds
  // would break the split the whole diagnostic rests on. What is late is the
  // copy arriving, and the moment it does, it counts in full.
  const withPending = (round, liveAtRound) => {
    const state = makeGameState({ round });
    const me = state.advertisers.find((a) => a.id === PLAYER_ID);
    me.creative = {
      tier: 'diy',
      liveAtRound,
      spentPaise: 0,
      unspentPaise: 0,
      pendingGrade: { expectedCtr: 8, adRelevance: 8, landingPage: 5 },
    };
    me.adGroups[0].gradedQuality = {
      ...me.adGroups[0].gradedQuality, expectedCtr: 3, adRelevance: 3, landingPage: 5,
    };
    return state;
  };
  const playerGrade = (state) => state.advertisers
    .find((a) => a.id === PLAYER_ID).adGroups[0].gradedQuality;

  test('it does not arrive early', () => {
    const out = submitRound(withPending(2, 3), {}, { mode: 'expected' });
    expect(playerGrade(out.nextGameState).expectedCtr).toBe(3);
    expect(out.nextGameState.advertisers
      .find((a) => a.id === PLAYER_ID).creative.pendingGrade).toBeTruthy();
  });

  test('it arrives whole on the round it was due, not gradually', () => {
    const out = submitRound(withPending(3, 3), {}, { mode: 'expected' });
    const graded = playerGrade(out.nextGameState);
    expect(graded.expectedCtr).toBe(8);
    expect(graded.adRelevance).toBe(8);
  });

  test('and it is spent once, so a later round cannot apply it again', () => {
    const first = submitRound(withPending(3, 3), {}, { mode: 'expected' });
    const me = first.nextGameState.advertisers.find((a) => a.id === PLAYER_ID);
    expect(me.creative.pendingGrade).toBeNull();
  });

  test('landing keeps the grade metadata 5.2 caches on', () => {
    // A grade that lost its contentHash would look unregraded, and 5.2's "an
    // unchanged ad is never regraded" guarantee would quietly stop holding.
    const before = withPending(3, 3);
    const hash = before.advertisers.find((a) => a.id === PLAYER_ID)
      .adGroups[0].gradedQuality.contentHash;
    const after = submitRound(before, {}, { mode: 'expected' });
    expect(playerGrade(after.nextGameState).contentHash).toBe(hash);
  });

  test('an advertiser with nothing pending is untouched', () => {
    const state = makeGameState({ round: 3 });
    const was = state.advertisers.find((a) => a.id === PLAYER_ID).adGroups[0].gradedQuality;
    const out = submitRound(state, {}, { mode: 'expected' });
    expect(playerGrade(out.nextGameState)).toEqual(was);
  });
});

/**
 * Replaying a game played through THIS module (stage A4, save and resume).
 *
 * `engine/serialise.js`'s replayGame runs `runRound` alone, which skips what
 * this module adds around it: structural decisions (capital, repositioning),
 * the self-written ad landing at its round, and the Quality Scores attached to
 * each report. Measured on a real game: its costs do not match the live ones.
 * A save has to replay the way the game was played, through `submitRound`.
 */
describe('a game played here is rebuilt exactly from its first state and its log', () => {
  const own = QUERY_SET.queries.filter((q) => homeCell(q) === 'mid|lifestyle').slice(0, 4);
  const initial = () => asOldSave(startGame({
    rootSeed: 20260902,
    playerBrandId: BRAND_IDENTITIES[0].id,
    querySet: QUERY_SET,
    player: {
      position: { price: 'mid', purpose: 'lifestyle' },
      capex: { sizeGuide: 0, photography: 0, landingPage: 0 },
      keywords: own.map((q) => ({ text: q.text, matchType: 'phrase', bidPaise: 1500 })),
      ad: {
        headlines: ['Everyday Co-ord Sets', 'Soft Lounge Sets', 'Sizes XS To XXL'],
        descriptions: [
          'Soft co-ord sets and lounge pants to wear all day.',
          'Free delivery over Rs 1,499 and 30-day returns.',
        ],
        landingPageDescription: 'A plain product page.',
      },
      // Self-written and saved before I11 changed, so the copy lands at week 3:
      // the thing runRound never does, and old saves still need.
      writerTier: 'diy',
    },
  }));

  // Everything the caller layer does that the engine's replay skips.
  const scripted = {
    2: { campaign: { negatives: [{ text: 'gym', matchType: 'broad' }] } },
    4: { campaign: { strategy: 'maxClicks' } },
    5: { capex: { photography: 5000000 } },
  };

  async function playLive(weeks) {
    const start = initial();
    const controllers = Object.fromEntries(start.advertisers.map((a, i) => [
      a.id,
      i === 0 ? (self) => scripted[self.round] ?? null : controllerFor(a.policyId),
    ]));
    const sources = Object.fromEntries(start.advertisers.map((a, i) => [
      a.id, i === 0 ? 'player' : `policy:${a.policyId}`,
    ]));
    let state = start;
    const reports = [];
    while (state.round <= weeks) {
      const out = await playRound(state, controllers, { mode: 'expected', sources });
      reports.push(out.report);
      state = out.nextGameState;
    }
    return { start, state, reports };
  }

  test('twelve weeks replay to the same state, report for report', async () => {
    const live = await playLive(TOTAL_ROUNDS);
    const replayed = replayLog(live.start, live.state.decisionLog, {
      mode: 'expected', throughRound: TOTAL_ROUNDS,
    });
    expect(JSON.stringify(replayed.finalState)).toBe(JSON.stringify(live.state));
    expect(JSON.stringify(replayed.reports)).toBe(JSON.stringify(live.reports));
    expect(replayed.insights).toHaveLength(TOTAL_ROUNDS);
  });

  test('a week in which nobody decided anything still replays', () => {
    // Replay is driven by the round count, not by which rounds have log entries,
    // so a silent week cannot desynchronise it.
    let state = initial();
    const start = state;
    for (let i = 0; i < 2; i++) state = submitRound(state, {}, { mode: 'expected' }).nextGameState;
    expect(state.decisionLog).toEqual([]);
    const replayed = replayLog(start, [], { mode: 'expected', throughRound: 2 });
    expect(JSON.stringify(replayed.finalState)).toBe(JSON.stringify(state));
  });

  test('a log from before the state it is replayed onto throws', () => {
    const start = initial();
    const later = { ...start, round: 3 };
    const log = [{ round: 1, advertiserId: 'x', source: 'player', decision: {} }];
    expect(() => replayLog(later, log, { mode: 'expected', throughRound: 4 }))
      .toThrow(/desynchronised/);
  });
});

/**
 * The debrief's "What if I hadn't?" (plans/2026-09-13-debrief.md, section 4).
 *
 * It replays the game with one of the player's decision weeks taken out, and
 * reads the difference as what that decision did. That reading is only honest
 * if three things hold, and each is a test below: removing nothing changes
 * nothing, the weeks before the decision are untouched, and every rival makes
 * exactly the moves it made in the played game.
 */
// Plays and replays whole games: a ceiling, not a speed test (see save.test.js).
describe('a game replayed without one decision (the debrief)', { timeout: 60_000 }, () => {
  const own = QUERY_SET.queries.filter((q) => homeCell(q) === 'mid|lifestyle').slice(0, 4);
  const PLAYER = BRAND_IDENTITIES[0].id;
  const initial = () => startGame({
    rootSeed: 20260902,
    playerBrandId: PLAYER,
    querySet: QUERY_SET,
    player: {
      position: { price: 'mid', purpose: 'lifestyle' },
      capex: { sizeGuide: 0, photography: 0, landingPage: 0 },
      // Broad, so a broad negative has something to block and week 2 changes.
      keywords: own.map((q) => ({ text: q.text, matchType: 'broad', bidPaise: 3000 })),
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
  const scripted = {
    2: { campaign: { negatives: [{ text: 'gym', matchType: 'broad' }] } },
    4: { campaign: { strategy: 'maxClicks' } },
  };

  async function playLive(weeks) {
    const start = initial();
    const controllers = Object.fromEntries(start.advertisers.map((a, i) => [
      a.id, i === 0 ? (self) => scripted[self.round] ?? null : controllerFor(a.policyId),
    ]));
    const sources = Object.fromEntries(start.advertisers.map((a, i) => [
      a.id, i === 0 ? 'player' : `policy:${a.policyId}`,
    ]));
    let state = start;
    const reports = [];
    while (state.round <= weeks) {
      const out = await playRound(state, controllers, { mode: 'expected', sources });
      reports.push(out.report);
      state = out.nextGameState;
    }
    return { start, state, reports };
  }

  const row = (report) => report.byAdvertiser[PLAYER].traffic;

  // One six-week game shared by every test here. Each used to play its own,
  // and four extra games running beside the suite's other long tests pushed
  // three of those past their 5-second limit on an ordinary run.
  let shared = null;
  const played = () => { shared ??= playLive(6); return shared; };

  test('only that advertiser\'s entry for that round is taken out', async () => {
    const live = await played();
    const log = live.state.decisionLog;
    const without = logWithout(log, { advertiserId: PLAYER, round: 2 });
    expect(without).toHaveLength(log.length - 1);
    expect(without.some((e) => e.advertiserId === PLAYER && e.round === 2)).toBe(false);
    expect(without.filter((e) => e.round === 2)).toEqual(
      log.filter((e) => e.round === 2 && e.advertiserId !== PLAYER),
    );
  });

  test('removing a round the player never decided in changes nothing', async () => {
    const live = await played();
    const replayed = replayWithout(live.start, live.state.decisionLog, {
      advertiserId: PLAYER, round: 3, mode: 'expected', throughRound: 6,
    });
    expect(JSON.stringify(replayed.reports)).toBe(JSON.stringify(live.reports));
  });

  test('removing a decision leaves every week before it identical, and changes its own week', async () => {
    const live = await played();
    const replayed = replayWithout(live.start, live.state.decisionLog, {
      advertiserId: PLAYER, round: 2, mode: 'expected', throughRound: 6,
    });
    expect(JSON.stringify(replayed.reports[0])).toBe(JSON.stringify(live.reports[0]));
    expect(row(replayed.reports[1])).not.toEqual(row(live.reports[1]));
  });

  test('rivals make exactly the moves they made, and the player\'s later decisions still happen', async () => {
    const live = await played();
    const replayed = replayWithout(live.start, live.state.decisionLog, {
      advertiserId: PLAYER, round: 2, mode: 'expected', throughRound: 6,
    });
    const rivals = (log) => log.filter((e) => e.advertiserId !== PLAYER);
    expect(rivals(replayed.finalState.decisionLog)).toEqual(rivals(live.state.decisionLog));
    expect(replayed.finalState.decisionLog.some((e) => e.advertiserId === PLAYER && e.round === 4))
      .toBe(true);
  });
});
