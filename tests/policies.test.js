import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  POLICIES, controllerFor, disciplined, affordableCpcPaise, locationTilt,
  capitalWindow, investment, DISCIPLINED_BUDGET_BOUND,
} from '../agents/policies.js';
import { playGame, playRound } from '../game.js';
import { getSelfView, getPublicView } from '../engine/insights.js';
import { advertiserReport } from '../engine/report.js';
import { startGame } from '../setup.js';
import { QUERY_SET } from '../content/querySet.js';
import { BRAND_IDENTITIES } from '../content/brands.js';
import { MONTHLY_BUDGET_PAISE, CAPEX_ALLOCATION_PAISE } from '../engine/constants.js';
import { makeGameState, PLAYER_ID } from './fixtures/gameState.js';
import { playMarket } from '../scripts/market-harness.js';

const STATE = makeGameState();
const SRC = readFileSync(fileURLToPath(new URL('../agents/policies.js', import.meta.url)), 'utf8');
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const everyone = Object.fromEntries(STATE.advertisers.map((a) => [a.id, disciplined]));

describe('a policy is a pure function of four views (R3a, R6)', () => {
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
  test('it imports nothing from engine/, and from content/ only the search-terms rule', () => {
    // Absolute rather than a denylist somebody has to remember to extend. A
    // policy that cannot import the engine cannot accidentally read the truth
    // out of it - POSITION_ECONOMICS, the conversion chain, a query's
    // affinities - by any route, including ones nobody thought to forbid.
    //
    // ONE EXCEPTION, the owner's call of 2026-09-18: `content/searchTerms.js`,
    // which is what a search costing too much means. A rival judges a search by
    // the rule the player's own card judges it by, and the alternative was the
    // same concept written twice (I9's defect). The next test holds that file to
    // being a leaf, so nothing can reach a policy through it.
    const imports = CODE.match(/^import[\s\S]*?from\s*['"][^'"]+['"];/gm) ?? [];
    expect(imports.join('\n')).not.toMatch(/engine\//);
    const fromContent = imports.filter((line) => /content\//.test(line));
    for (const line of fromContent) expect(line).toMatch(/content\/searchTerms\.js/);
  });

  test('and the one file it may import from content/ imports nothing itself', () => {
    // What makes the exception above safe: the truth lives behind other modules
    // (the query set's affinities, the engine's economics), and a leaf cannot
    // carry it. If this file ever needs an import, the exception needs rethinking.
    const leaf = readFileSync(fileURLToPath(new URL('../content/searchTerms.js', import.meta.url)), 'utf8');
    expect(leaf.match(/^import[\s\S]*?from\s*['"][^'"]+['"];/gm) ?? []).toEqual([]);
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

  test('it believes the briefing about returns until a week has finished coming back', () => {
    // A week's sales land over the three rounds after its clicks and their
    // returns two rounds after that, so at week 6 no week is complete. Reading
    // an unfinished one would count its sales before their returns (C9).
    const self = { ...getSelfView(STATE, PLAYER_ID), round: 6 };
    const young = [1, 2, 3, 4, 5].map((round) => ({ round, conversions: { final: 30, returned: 3 } }));
    expect(affordableCpcPaise(self, young)).toBe(affordableCpcPaise(self));
  });

  test('then it reads its own return rate off the weeks that have', () => {
    // At week 8, weeks 1 and 2 are complete: 18 of their 60 sales came back,
    // 30% against the briefing's 40%, so it believes a click is worth 0.70/0.60
    // of what it believed. The younger weeks' partial returns do not count.
    const self = { ...getSelfView(STATE, PLAYER_ID), round: 8 };
    const weeks = [1, 2, 3, 4, 5, 6, 7].map((round) => ({
      round, conversions: { final: 30, returned: round <= 2 ? 9 : 1 },
    }));
    expect(affordableCpcPaise(self, weeks) / affordableCpcPaise(self)).toBeCloseTo(0.70 / 0.60, 2);
  });

  test('but not off a handful of sales, which is noise', () => {
    const self = { ...getSelfView(STATE, PLAYER_ID), round: 8 };
    const thin = [1, 2].map((round) => ({ round, conversions: { final: 2, returned: 2 } }));
    expect(affordableCpcPaise(self, thin)).toBe(affordableCpcPaise(self));
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

describe('where a rival bids, read off every week it has played (G4, C9)', () => {
  // Three places, the same clicks and the same gross per click in each, and the
  // towns sending back four times what the metros do. A week at a time.
  const week = (round, returned) => ({
    round,
    breakdown: {
      byLocation: Object.fromEntries([0, 1, 2].map((tier) => [tier, {
        clicks: 100, grossRevenuePaise: 10000, returnedRevenuePaise: returned[tier],
      }])),
    },
  });
  const self = { ...getSelfView(STATE, PLAYER_ID), round: 4 };

  test('reading net, it bids the towns down for what they send back', () => {
    const history = [week(1, [1000, 2000, 4000]), week(2, [1000, 2000, 4000]), week(3, [0, 0, 0])];
    const [metros, , towns] = locationTilt(self, history);
    expect(towns).toBeLessThan(0);
    expect(metros).toBeGreaterThan(0);
  });

  test('reading gross, it cannot tell the places apart', () => {
    // grossOptimiser: section 14's missing subtraction, applied to geography.
    const history = [week(1, [1000, 2000, 4000]), week(2, [1000, 2000, 4000])];
    expect(locationTilt(self, history, undefined, { net: false })).toEqual([0, 0, 0]);
  });

  test('and with nothing yet come back, the two readings agree', () => {
    // Which is why a net reader leans like a gross one for its first weeks,
    // and only parts company as the towns' returns arrive.
    const history = [week(1, [0, 0, 0]), week(2, [0, 0, 0])];
    expect(locationTilt(self, history)).toEqual(locationTilt(self, history, undefined, { net: false }));
  });

  test('week 1 has no history to read, so it leaves the places alone', () => {
    expect(locationTilt({ ...self, round: 1 }, [])).toBeNull();
  });

  test('it moves halfway toward what the weeks say, not all the way', () => {
    // A place's value per click falls as the bid there rises, so a rival that
    // jumped all the way to each week's reading bid the towns up, read them
    // worse, cut, read them better, and see-sawed for twelve weeks (C9). All
    // the way, this history says [35, 9, -43].
    const history = [week(1, [1000, 2000, 4000]), week(2, [1000, 2000, 4000])];
    const from = (held) => locationTilt({ ...self, campaign: { ...self.campaign, locationAdjustments: held } }, history);
    expect(from([0, 0, 0])).toEqual([18, 5, -21]);
    expect(from([-40, 20, 0])).toEqual([-2, 15, -21]);
    // Once there, it stays.
    expect(from([35, 9, -43])).toEqual([35, 9, -43]);
  });

  test('a place it leaves alone is written 0, never -0', () => {
    // `Math.round` gives -0 for anything a hair under zero, JSON has no -0, and
    // a saved game then reads back a decision it never stored: the round-trip
    // in save.test.js fails, which is how the makeover line found it. Summing
    // every week put a place close enough to the average to meet it. The
    // halfway step above cannot produce one any more, so this holds the branch
    // that still could - a place with too little traffic to read, whose
    // adjustment is carried over as it stands (C9).
    const rows = {
      0: { clicks: 100, grossRevenuePaise: 10100, returnedRevenuePaise: 0 },
      1: { clicks: 10, grossRevenuePaise: 1000, returnedRevenuePaise: 0 },
      2: { clicks: 100, grossRevenuePaise: 10000, returnedRevenuePaise: 0 },
    };
    const history = [{ round: 1, breakdown: { byLocation: rows } }];
    const holding = { ...self, campaign: { ...self.campaign, locationAdjustments: [0, -0, 0] } };
    const middle = locationTilt(holding, history)[1];
    expect(middle).toBe(0);
    expect(Object.is(middle, -0)).toBe(false);
  });
});

/**
 * WHAT A RIVAL BLOCKS, and why the old rule blocked almost nothing.
 *
 * It asked for conversions of exactly zero on the week just played. The game is
 * played in expected mode, where a search's sales are its clicks times a rate —
 * a fraction, never exactly zero unless nobody searching it ever buys — so a
 * rival wrote negatives on the zero-intent searches and on nothing else, while
 * its report was full of searches costing several times what a sale costs it
 * (I8's addendum, fixed 2026-09-18). It now judges by `isDear`, the rule the
 * player's own card and search terms table use, over every week it has played,
 * as revised (C9's fourth argument): a week's sales are still arriving, and
 * judging a search on them is what made the old rule wrong.
 */
describe('disciplined reads its search terms report', () => {
  const self = () => getSelfView(STATE, PLAYER_ID);
  const view = () => getPublicView(STATE, PLAYER_ID);
  const week = (round, byQuery) => ({ round, breakdown: { byQuery, byKeyword: {} } });
  const report = {
    traffic: { clicks: 500, costPaise: 400000, impressions: 9000, eligibleAuctions: 20000 },
    share: { lostToRank: 0.1, lostToBudget: 0 },
    conversions: { final: 10, returned: 2 },
    breakdown: { byQuery: {}, byKeyword: {} },
  };
  const row = (clicks, conversions, costPaise) => ({ clicks, conversions, costPaise, impressions: clicks * 20 });
  /** An account where a sale costs ₹500: ₹3,200 spent over 6.4 sales. */
  const account = (waster, earner) => [
    week(1, { [waster]: row(100, 0.2, 80000), [earner]: row(100, 3, 80000) }),
    week(2, { [waster]: row(100, 0.2, 80000), [earner]: row(100, 3, 80000) }),
  ];

  test('it blocks a search whose sales cost far more than its own average, fractional though they are', () => {
    const [waster, earner] = view().querySet;
    const decision = disciplined(self(), report, view(), account(waster.id, earner.id));
    // ₹1,600 spent on 0.4 sales is ₹4,000 a sale, against the account's ₹500.
    expect(decision.campaign.negatives.map((n) => n.text)).toEqual([waster.text]);
    // Phrase, not broad: a broad negative needs every token present in any
    // order and over-blocks less predictably (8.2, L11).
    expect(decision.campaign.negatives[0].matchType).toBe('phrase');
  });

  test('the old rule blocked nothing here, because 0.2 sales is not zero', () => {
    const [waster, earner] = view().querySet;
    const history = account(waster.id, earner.id);
    const zeroOnly = Object.values(history[0].breakdown.byQuery).filter((r) => (r.conversions ?? 0) === 0);
    expect(zeroOnly, 'nothing in this account converts at exactly zero').toHaveLength(0);
    expect(disciplined(self(), report, view(), history).campaign.negatives).toHaveLength(1);
  });

  test('it leaves a search that sells at about what selling costs this account', () => {
    const [waster, earner] = view().querySet;
    const decision = disciplined(self(), report, view(), account(waster.id, earner.id));
    expect(decision.campaign.negatives.map((n) => n.text)).not.toContain(earner.text);
  });

  test('it waits until a search has spent enough to have sold anything', () => {
    const [thin, earner] = view().querySet;
    // Dear by ratio, but it has spent ₹200 where a sale costs this account ₹288:
    // too little to have sold, whatever it shows.
    const history = [week(1, { [thin.id]: row(60, 0.02, 20000), [earner.id]: row(300, 9, 240000) })];
    expect(disciplined(self(), report, view(), history).campaign.negatives).toHaveLength(0);
  });

  test('it reads every week it has played, so a search whose sales arrived late is left alone', () => {
    const [late, earner] = view().querySet;
    // On the last week alone it looks dear; over the three weeks it has sold.
    const history = [
      week(1, { [late.id]: row(100, 4, 80000), [earner.id]: row(100, 3, 80000) }),
      week(2, { [late.id]: row(100, 3, 80000), [earner.id]: row(100, 3, 80000) }),
      week(3, { [late.id]: row(100, 0.1, 80000), [earner.id]: row(100, 3, 80000) }),
    ];
    expect(disciplined(self(), report, view(), history).campaign.negatives).toHaveLength(0);
    const lastWeekOnly = [history[2]];
    expect(disciplined(self(), report, view(), lastWeekOnly).campaign.negatives.map((n) => n.text))
      .toEqual([late.text]);
  });

  test('it blocks nothing before it has played a week', () => {
    expect(disciplined(self(), report, view(), []).campaign.negatives).toHaveLength(0);
  });

  test('it does not block the same query twice', () => {
    const [waster, earner] = view().querySet;
    const already = { ...self(), campaign: { ...self().campaign, negatives: [{ text: waster.text, matchType: 'phrase' }] } };
    expect(disciplined(already, report, view(), account(waster.id, earner.id)).campaign.negatives).toHaveLength(1);
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

describe('week 5: every rival decides its second capital allocation (DECISIONS C8)', { timeout: 60_000 }, () => {
  // No rival used to submit a capital decision at week 5, and the engine only
  // turns uncommitted capital into ad budget when one is submitted, so each
  // rival's second ₹1,20,000 disappeared. Each now decides, by character.
  let atFive;
  let self;
  let report;
  const view = () => getPublicView(atFive, PLAYER_ID);
  const withLoss = (lostToBudget) => ({ ...report, share: { ...report.share, lostToBudget } });
  const at = (round, over = {}) => ({ ...structuredClone(self), round, ...over });
  const committedNothing = () => ({ ...self.capex, committed: { sizeGuide: 0, photography: 0, landingPage: 0, orderConfirmation: 0 } });

  test('set up: a real week-5 self view and report', async () => {
    ({ finalState: atFive } = await playGame(STATE, everyone, { mode: 'expected', rounds: 4 }));
    self = getSelfView(atFive, PLAYER_ID);
    report = advertiserReport(atFive.history.at(-1), PLAYER_ID);
    expect(self.round).toBe(5);
    expect(capitalWindow(self)).toBe(true);
  });

  test('nothing changes outside the window', () => {
    for (const round of [1, 2, 4, 6, 9]) {
      expect(capitalWindow(at(round)), `round ${round}`).toBe(false);
      for (const [id, policy] of Object.entries(POLICIES)) {
        const decision = policy(at(round), withLoss(0), view());
        expect(decision?.capex, `${id} at round ${round}`).toBeUndefined();
      }
    }
  });

  test('an investment tops up by the tilt, and never passes a ceiling or the allocation', () => {
    const nothing = committedNothing();
    const mid = investment(at(5, { position: { ...self.position, price: 'mid' }, capex: nothing }));
    expect(mid).toEqual({ landingPage: 8000000, orderConfirmation: 4000000 });
    const value = investment(at(5, { position: { ...self.position, price: 'value' }, capex: nothing }));
    expect(value).toEqual({ sizeGuide: 8000000, orderConfirmation: 4000000 });
    const premium = investment(at(5, { position: { ...self.position, price: 'premium' }, capex: nothing }));
    expect(premium).toEqual({ photography: CAPEX_ALLOCATION_PAISE });

    // Already part-built: it finishes the primary, then the secondary, and what
    // no ladder can take is left to become ad money.
    const built = investment(at(5, {
      position: { ...self.position, price: 'mid' },
      capex: { ...nothing, committed: { ...nothing.committed, landingPage: 8000000, orderConfirmation: 4000000 } },
    }));
    expect(built).toEqual({ orderConfirmation: 4000000 });

    for (const price of ['value', 'mid', 'premium']) {
      const out = investment(at(5, { position: { ...self.position, price }, capex: nothing }));
      expect(Object.values(out).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(self.capital.allocationPaise);
      for (const [target, paise] of Object.entries(out)) {
        expect(paise, `${price} ${target}`).toBeLessThanOrEqual(self.capital.ceilingPaise[target]);
      }
    }
  });

  test('each character decides by its own reading', () => {
    const invested = at(5, { capex: { ...self.capex, committed: { ...committedNothing().committed, landingPage: 2500000 } } });
    const fresh = at(5, { capex: committedNothing() });

    expect(POLICIES.spender(fresh, withLoss(0), view()).capex).toEqual({});
    expect(POLICIES.cautious(fresh, withLoss(0.5), view()).capex).toEqual(investment(fresh));

    // D12's finding, as the capital card now puts it to the player.
    expect(POLICIES.disciplined(fresh, withLoss(DISCIPLINED_BUDGET_BOUND / 2), view()).capex)
      .toEqual(investment(fresh));
    expect(POLICIES.disciplined(fresh, withLoss(0.3), view()).capex).toEqual({});

    // Habit: what it did at round 0.
    for (const id of ['automator', 'grossOptimiser', 'brandDefender']) {
      expect(POLICIES[id](invested, withLoss(0), view()).capex, id).toEqual(investment(invested));
      expect(POLICIES[id](fresh, withLoss(0), view()).capex, id).toEqual({});
    }
  });

  test('through the door, no rival loses its allocation any more', async () => {
    let state = startGame({
      rootSeed: 1,
      playerBrandId: BRAND_IDENTITIES[0].id,
      querySet: QUERY_SET,
      player: {
        position: { price: 'mid', purpose: 'performance' },
        keywords: [{ text: 'gym leggings', matchType: 'phrase', bidPaise: 1500 }],
        ad: { headlines: ['Gym Leggings', 'Free Delivery', 'Sizes XS To XXL'], descriptions: ['For every session.', 'Easy returns.'], landingPageDescription: 'A plain product page.' },
      },
    });
    const controllers = Object.fromEntries(state.advertisers.map((a) => [a.id, a.policyId ? controllerFor(a.policyId) : () => null]));
    while (state.round <= 5) state = (await playRound(state, controllers, { mode: 'expected' })).nextGameState;

    const week5 = state.history.find((h) => h.round === 5);
    for (const a of state.advertisers.filter((x) => x.policyId)) {
      const entry = state.decisionLog.find((e) => e.round === 5 && e.advertiserId === a.id);
      const invested = Object.values(entry.decision.capex ?? {}).reduce((x, y) => x + y, 0);
      expect(entry.decision.capex, `${a.id} made no capital decision`).toBeDefined();
      expect(week5.byAdvertiser[a.id].budget.monthlyBudgetPaise, a.id)
        .toBe(MONTHLY_BUDGET_PAISE + CAPEX_ALLOCATION_PAISE - invested);
    }
  });
});

describe('rivals pull the prepaid discount too (DECISIONS I34, R6)', { timeout: 120_000 }, () => {
  // I34 says they do, and in play none ever did: 18 games, 1,728 rival
  // decisions, not one discount. A week's refusals land two to five weeks
  // after its clicks, and the rule read them off the week just played.
  test('through the door, a rival in a cash-heavy cell offers one at some point', async () => {
    // Seed 2 seats a rival in the value tier, where most orders are cash on
    // delivery and refusals cost the most.
    const { state } = await playMarket({ seed: 2, cell: 'mid|performance' });
    const cashHeavy = state.advertisers.filter((a) => a.policyId && a.position.price === 'value');
    expect(cashHeavy.length, 'no rival in a value cell, so this would prove nothing').toBeGreaterThan(0);

    const offered = cashHeavy.filter((a) => state.decisionLog.some((e) => e.advertiserId === a.id
      && (e.decision?.campaign?.prepaidDiscountPaise ?? 0) > 0));
    expect(offered.map((a) => a.id), 'no value-tier rival ever offered a discount').not.toEqual([]);
    // Applied, not only logged.
    expect(offered.some((a) => a.campaign.prepaidDiscountPaise > 0)).toBe(true);
  });
});

describe('a rival steps its discount down only once refusals are clearly lighter (I34)', () => {
  // A rival whose stated rate sat on the 12% line flipped between ₹50 and ₹30
  // as its clicks moved between places: 8 of 144 rival-games, one of them seven
  // times in eleven weeks. It now steps up at the line and down only a point
  // under it.
  let played;
  // What the rule asks for when each place's row of a real report is reshaped.
  const decide = (reshape, held) => {
    const self = getSelfView(played, PLAYER_ID);
    self.campaign.prepaidDiscountPaise = held;
    const report = advertiserReport(played.history.at(-1), PLAYER_ID);
    const byLocation = Object.fromEntries(Object.entries(report.breakdown.byLocation)
      .map(([tier, row]) => [tier, reshape(row, Number(tier))]));
    const decision = disciplined(self, { ...report, breakdown: { ...report.breakdown, byLocation } },
      getPublicView(played, PLAYER_ID));
    return decision.campaign.prepaidDiscountPaise;
  };
  const at = (rate, held) => decide((row) => ({ ...row, refusalRate: rate }), held);

  test('set up: a real report, the shape a rival is handed after a week', async () => {
    ({ finalState: played } = await playGame(STATE, everyone, { mode: 'expected', rounds: 1 }));
    const byLocation = advertiserReport(played.history.at(-1), PLAYER_ID).breakdown.byLocation;
    expect(Object.keys(byLocation).sort()).toEqual(['0', '1', '2']);
    for (const row of Object.values(byLocation)) {
      expect(row.eligibleAuctions).toBeGreaterThan(0);
      expect(Number.isFinite(row.refusalRate)).toBe(true);
    }
  });

  test('it weights by the searches it is in, not the clicks its place bids bought', () => {
    // A rival's place bids see-saw week to week (locationTilt), so its clicks
    // do too, while the searches it is eligible for stay put. Weighted by
    // clicks, the metro-heavy week below reads 9.5% and asks for ₹30, and the
    // town-heavy one 15.1% and ₹50: the flip. Over the same searches, both
    // weeks are the same week.
    const byPlace = [0.09, 0.12, 0.16];
    const week = (clicks) => decide((row, tier) => ({
      ...row, refusalRate: byPlace[tier], clicks: clicks[tier], eligibleAuctions: 1000,
    }), 0);
    expect(week([2000, 100, 100])).toBe(5000);
    expect(week([100, 100, 2000])).toBe(5000);
  });

  test('it steps up at the line', () => {
    expect(at(0.121, 0)).toBe(5000);
    expect(at(0.121, 3000)).toBe(5000);
    expect(at(0.115, 0)).toBe(3000);
  });

  test('holding ₹50, a rate just under the line changes nothing', () => {
    // No change is sent at all, which is what an unchanged decision looks like.
    expect(at(0.115, 5000)).toBeUndefined();
  });

  test('a rate clearly under the line steps it down', () => {
    expect(at(0.105, 5000)).toBe(3000);
  });

  test('the same margin holds at the lower rung', () => {
    expect(at(0.055, 3000)).toBeUndefined();
    expect(at(0.045, 3000)).toBe(0);
  });
});
