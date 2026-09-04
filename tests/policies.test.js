import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { POLICIES, controllerFor, disciplined, affordableCpcPaise } from '../agents/policies.js';
import { playGame, playRound } from '../game.js';
import { getSelfView, getPublicView } from '../engine/insights.js';
import { advertiserReport } from '../engine/report.js';
import { makeGameState, PLAYER_ID } from './fixtures/gameState.js';

const STATE = makeGameState();
const SRC = readFileSync(fileURLToPath(new URL('../agents/policies.js', import.meta.url)), 'utf8');
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const everyone = Object.fromEntries(STATE.advertisers.map((a) => [a.id, disciplined]));

describe('a policy is a pure function of three views (R3a, R6)', () => {
  test('every registered policy is a function', () => {
    for (const [id, policy] of Object.entries(POLICIES)) {
      expect(typeof policy, id).toBe('function');
    }
  });

  test('the id spec 5.2 names is present', () => {
    expect(POLICIES).toHaveProperty('disciplined');
    expect(controllerFor('disciplined')).toBe(disciplined);
  });

  test('an unknown policy id throws rather than falling back to a default', () => {
    expect(() => controllerFor('aggressive')).toThrow(/aggressive/);
  });

  test('the same views give the same decision', () => {
    const self = getSelfView(STATE, PLAYER_ID);
    const view = getPublicView(STATE, PLAYER_ID);
    expect(JSON.stringify(disciplined(self, null, view)))
      .toBe(JSON.stringify(disciplined(self, null, view)));
  });

  test('it does not mutate the views it was handed', () => {
    const self = getSelfView(STATE, PLAYER_ID);
    const view = getPublicView(STATE, PLAYER_ID);
    const before = JSON.stringify([self, view]);
    disciplined(self, null, view);
    expect(JSON.stringify([self, view])).toBe(before);
  });
});

describe('structural: what this file may not reach', () => {
  test('it imports nothing from engine/ at all', () => {
    // Absolute rather than a denylist somebody has to remember to extend. A
    // policy that cannot import the engine cannot accidentally read the truth
    // out of it - POSITION_ECONOMICS, the conversion chain, a query's
    // affinities - by any route, including ones nobody thought to forbid.
    const imports = CODE.match(/^import[\s\S]*?from\s*['"][^'"]+['"];/gm) ?? [];
    expect(imports.join('\n')).not.toMatch(/engine\//);
    expect(imports.join('\n')).not.toMatch(/content\//);
  });

  test('it never names the truth', () => {
    for (const forbidden of [
      'priceAffinity', 'purposeAffinity', 'convMultiplier', 'valueMultiplier',
      'returnRateMultiplier', 'convRateBase', 'POSITION_ECONOMICS',
      'PURPOSE_MODIFIERS', 'HOURLY_INTENT_CURVE', 'effectiveConvRate',
      'gameState',
      // NOT 'advertisers': R3 explicitly permits reading every rival's
      // identity and ad creative, because the Ads Transparency Center makes
      // both public, and 17.1 makes rival position INFERABLE FROM AD COPY.
      // A policy that could not read view.advertisers could not do the one
      // piece of competitive research the design most wants it to do.
    ]) {
      expect(CODE.includes(forbidden), forbidden).toBe(false);
    }
  });

  test('no controller reads missedToBudget (spec 11.2)', () => {
    // It is a pedagogical output. Policies use lostToBudget, which every
    // advertiser gets, exactly as a real one would - which is what keeps the
    // engine symmetric under R6 and makes DECISIONS G1 true rather than
    // aspirational.
    expect(CODE.includes('missedToBudget')).toBe(false);
  });

  test('and it cannot reach a model or the network (R2)', () => {
    for (const escape of ['fetch(', 'XMLHttpRequest', 'require(', 'import(']) {
      expect(CODE.includes(escape), escape).toBe(false);
    }
  });

  test('a greedy policy finds nothing behind the forbidden keys', () => {
    // Stronger than the greps above, which cannot catch self['conv' + 'RateBase'].
    const self = getSelfView(STATE, PLAYER_ID);
    const view = getPublicView(STATE, PLAYER_ID);
    expect(self.catalogue.convRateBase).toBeUndefined();
    expect(self.catalogue.returnRate).toBeUndefined();
    for (const q of view.querySet) {
      expect(q.priceAffinity).toBeUndefined();
      expect(q.convMultiplier).toBeUndefined();
    }
  });
});

describe('disciplined estimates what it is not told', () => {
  const self = getSelfView(STATE, PLAYER_ID);

  test('it cannot compute its own break-even, and does not pretend to', () => {
    // The catalogue carries order value and margin. The conversion rate and
    // the return rate are withheld (16.2), so this figure is an ESTIMATE and
    // is wrong early. That is the thing being modelled, not a limitation.
    const affordable = affordableCpcPaise(self, null);
    const truth = 3456; // realised value|performance break-even
    expect(affordable).toBeGreaterThan(0);
    expect(affordable).not.toBe(truth);
  });

  test('it opens under what it believes it can afford', () => {
    const decision = disciplined(self, null, getPublicView(STATE, PLAYER_ID));
    const bid = decision.adGroups[0].keywords[0].bidPaise;
    expect(bid).toBeLessThan(affordableCpcPaise(self, null));
    expect(decision.campaign.strategy).toBe('manual');
  });

  test('its belief moves as its own history arrives', async () => {
    // observedConvRate is written from LANDED conversions only and opens near
    // 55% of the truth, so this figure climbs for several rounds. A policy
    // checked at round 2 is not broken, it is uninformed.
    const { finalState } = await playGame(STATE, everyone, { mode: 'expected', rounds: 4 });
    const early = affordableCpcPaise(getSelfView(STATE, PLAYER_ID), null);
    const later = affordableCpcPaise(getSelfView(finalState, PLAYER_ID), null);
    expect(later).not.toBe(early);
  });
});

describe('disciplined reads its search terms report', () => {
  test('it blocks a query that took clicks and returned nothing', () => {
    const self = getSelfView(STATE, PLAYER_ID);
    const view = getPublicView(STATE, PLAYER_ID);
    const waster = view.querySet[0];
    const report = {
      traffic: { clicks: 500, costPaise: 400000, impressions: 9000, eligibleAuctions: 20000 },
      share: { lostToRank: 0.1, lostToBudget: 0 },
      conversions: { final: 10, returned: 2 },
      breakdown: {
        byQuery: { [waster.id]: { clicks: 200, conversions: 0, impressions: 4000, costPaise: 160000 } },
        byKeyword: {},
      },
    };
    const decision = disciplined(self, report, view);
    expect(decision.campaign.negatives.map((n) => n.text)).toContain(waster.text);
    // Phrase, not broad: a broad negative needs every token present in any
    // order and over-blocks less predictably (8.2, L11).
    expect(decision.campaign.negatives.find((n) => n.text === waster.text).matchType)
      .toBe('phrase');
  });

  test('it leaves a query that converts alone', () => {
    const self = getSelfView(STATE, PLAYER_ID);
    const view = getPublicView(STATE, PLAYER_ID);
    const earner = view.querySet[0];
    const report = {
      traffic: { clicks: 500, costPaise: 400000, impressions: 9000, eligibleAuctions: 20000 },
      share: { lostToRank: 0.1, lostToBudget: 0 },
      conversions: { final: 10, returned: 2 },
      breakdown: {
        byQuery: { [earner.id]: { clicks: 200, conversions: 6, impressions: 4000, costPaise: 160000 } },
        byKeyword: {},
      },
    };
    expect(disciplined(self, report, view).campaign.negatives).toHaveLength(0);
  });

  test('it does not block the same query twice', () => {
    const self = getSelfView(STATE, PLAYER_ID);
    const view = getPublicView(STATE, PLAYER_ID);
    const waster = view.querySet[0];
    const already = { ...self, campaign: { ...self.campaign, negatives: [{ text: waster.text, matchType: 'phrase' }] } };
    const report = {
      traffic: { clicks: 500, costPaise: 400000, impressions: 9000, eligibleAuctions: 20000 },
      share: { lostToRank: 0.1, lostToBudget: 0 },
      conversions: { final: 10, returned: 2 },
      breakdown: { byQuery: { [waster.id]: { clicks: 200, conversions: 0 } }, byKeyword: {} },
    };
    expect(disciplined(already, report, view).campaign.negatives).toHaveLength(1);
  });
});

describe('a market of policies plays a game', () => {
  test('nine disciplined advertisers run four rounds without throwing', async () => {
    const { finalState, reports } = await playGame(STATE, everyone, { mode: 'expected', rounds: 4 });
    expect(reports).toHaveLength(4);
    expect(finalState.round).toBe(5);
    for (const report of reports) {
      for (const row of Object.values(report.byAdvertiser)) {
        expect(Number.isFinite(row.traffic.costPaise)).toBe(true);
        expect(row.traffic.costPaise).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('every decision is logged with its policy as the source', async () => {
    const sources = Object.fromEntries(STATE.advertisers.map((a) => [a.id, 'policy:disciplined']));
    const out = await playRound(STATE, everyone, { mode: 'expected', sources });
    expect(out.nextGameState.decisionLog).toHaveLength(STATE.advertisers.length);
    for (const entry of out.nextGameState.decisionLog) {
      expect(entry.source).toBe('policy:disciplined');
    }
  });

  test('it never bids past what it believes it can afford', async () => {
    const { finalState } = await playGame(STATE, everyone, { mode: 'expected', rounds: 4 });
    for (const a of finalState.advertisers) {
      const self = getSelfView(finalState, a.id);
      const affordable = affordableCpcPaise(self, null);
      for (const k of self.adGroups[0].keywords) {
        expect(k.bidPaise, `${a.id} ${k.id}`).toBeLessThanOrEqual(affordable);
      }
    }
  });

  test('and no policy ever triggers a learning period, because it never switches strategy', async () => {
    // disciplined stays on manual all game. Manual never predicts conversions,
    // so a learning period cannot touch it - which is why it behaves
    // predictably on a thin account (12.2).
    const { finalState } = await playGame(STATE, everyone, { mode: 'expected', rounds: 4 });
    for (const a of finalState.advertisers) {
      expect(a.bidding.learningRoundsRemaining, a.id).toBe(0);
    }
  });
});
