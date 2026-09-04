import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { playRound, submitRound, playGame, triggersLearning } from '../game.js';
import { makeGameState, deformed, PLAYER_ID } from './fixtures/gameState.js';
import {
  LEARNING_ROUNDS, CAPEX_ALLOCATION_PAISE, CAPEX_DELAY_ROUNDS,
  REPOSITION_ROUND, REPOSITION_COST_PAISE, MONTHLY_BUDGET_PAISE,
} from '../engine/constants.js';

const STATE = makeGameState();
const noop = () => null;
const everyone = (fn) => Object.fromEntries(STATE.advertisers.map((a) => [a.id, fn]));

describe('controllers receive views, never state (R3a)', () => {
  test('a controller is handed exactly three things', async () => {
    let seen = null;
    await playRound(STATE, { [PLAYER_ID]: (...args) => { seen = args; return null; } },
      { mode: 'expected' });
    expect(seen).toHaveLength(3);
    const [self, report, view] = seen;
    expect(self.id).toBe(PLAYER_ID);
    expect(report).toBeNull();           // round 1 has no previous report
    expect(view.advertisers).toBeDefined();
  });

  test('none of the three is GameState, or contains it', async () => {
    // The rule that cannot be tested behaviourally (W12) and so is tested by
    // shape: GameState's own top-level keys must not be reachable from
    // anything a controller was handed.
    let seen = null;
    await playRound(STATE, { [PLAYER_ID]: (...args) => { seen = args; return null; } },
      { mode: 'expected' });
    for (const arg of seen) {
      if (arg == null) continue;
      for (const key of ['rootSeed', 'budgetSchedule', 'decisionLog', 'schemaVersion']) {
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
