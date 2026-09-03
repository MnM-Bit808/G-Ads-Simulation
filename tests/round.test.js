import { describe, test, expect } from 'vitest';
import { runRound } from '../engine/round.js';
import { makeGameState, deformed, PLAYER_ID } from './fixtures/gameState.js';
import { ATTRIBUTION_LAG_DISTRIBUTION, MAX_SLOTS, ROUNDS_PER_MONTH } from '../engine/constants.js';

const STATE = makeGameState();
const EXPECTED = runRound(STATE, { mode: 'expected' });
const player = (result) => result.raw.byAdvertiser[PLAYER_ID];

/** An advertiser the fixture leaves genuinely budget-constrained. */
const CONSTRAINED = 'halcyon';

describe('a round runs end to end', () => {
  test('every advertiser gets a row', () => {
    expect(Object.keys(EXPECTED.raw.byAdvertiser)).toHaveLength(STATE.advertisers.length);
  });

  test('the round number advances', () => {
    expect(EXPECTED.nextGameState.round).toBe(STATE.round + 1);
  });

  test('somebody actually bought something', () => {
    const totals = Object.values(EXPECTED.raw.byAdvertiser);
    expect(totals.reduce((a, r) => a + r.impressions, 0)).toBeGreaterThan(0);
    expect(totals.reduce((a, r) => a + r.clicks, 0)).toBeGreaterThan(0);
    expect(totals.reduce((a, r) => a + r.costPaise, 0)).toBeGreaterThan(0);
  });

  test('positions are used across the ladder, not just the top slot', () => {
    const counts = new Array(MAX_SLOTS).fill(0);
    for (const r of Object.values(EXPECTED.raw.byAdvertiser)) {
      r.positionCounts.forEach((v, i) => { counts[i] += v; });
    }
    expect(counts.filter((v) => v > 0).length).toBeGreaterThan(1);
  });
});

describe('money stays integral (R7)', () => {
  test('every cost is integer paise', () => {
    for (const [id, r] of Object.entries(EXPECTED.raw.byAdvertiser)) {
      expect(Number.isSafeInteger(r.costPaise), id).toBe(true);
      expect(Number.isSafeInteger(r.monthSpentPaise), id).toBe(true);
      for (const v of r.dailySpendPaise) expect(Number.isSafeInteger(v), id).toBe(true);
    }
  });

  test('daily spend sums to the round cost, with no drift', () => {
    // Cost is rounded per auction. Across roughly 200,000 accumulations that
    // could have drifted; it must not.
    for (const [id, r] of Object.entries(EXPECTED.raw.byAdvertiser)) {
      const summed = r.dailySpendPaise.reduce((a, v) => a + v, 0);
      expect(summed, id).toBe(r.costPaise);
    }
  });

  test('nothing is ever Infinity or NaN', () => {
    for (const r of Object.values(EXPECTED.raw.byAdvertiser)) {
      for (const v of [r.costPaise, r.impressions, r.clicks, r.eligibleAuctions]) {
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });
});

describe('impression share decomposes exactly (spec 8.5)', () => {
  test('impressions plus lostToRank plus lostToBudget equals eligible auctions', () => {
    for (const [id, r] of Object.entries(EXPECTED.raw.byAdvertiser)) {
      if (r.eligibleAuctions === 0) continue;
      const total = r.impressions + r.lostToRank + r.lostToBudget;
      expect(total / r.eligibleAuctions, id).toBeCloseTo(1, 9);
    }
  });

  test('losses are split into the two problems with opposite fixes', () => {
    // Somewhere in a nine-advertiser market both kinds must occur, or the
    // most useful diagnostic on the platform has nothing to diagnose.
    const rows = Object.values(EXPECTED.raw.byAdvertiser);
    expect(rows.some((r) => r.lostToRank > 0)).toBe(true);
    expect(rows.some((r) => r.lostToBudget > 0)).toBe(true);
  });

  test('eligibility ignores budget entirely', () => {
    // Spec 8.5: an advertiser starved of budget is still eligible. That is
    // what keeps the denominator honest.
    const broke = deformed(STATE, (s) => {
      const a = s.advertisers.find((x) => x.id === PLAYER_ID);
      a.campaign.weeklySplitPaise = [1, 1, 1, 1];
    });
    const result = runRound(broke, { mode: 'expected' });
    expect(player(result).eligibleAuctions).toBeCloseTo(player(EXPECTED).eligibleAuctions, 6);
    expect(player(result).impressions).toBeLessThan(player(EXPECTED).impressions);
    expect(player(result).lostToBudget).toBeGreaterThan(0);
  });
});

describe('broadening raises impressions and LOWERS impression share', () => {
  test('the denominator grows faster than the numerator', () => {
    // Counterintuitive, real, and the whole reason spec 8.5 defines
    // eligibility the way it does.
    const broadened = deformed(STATE, (s) => {
      const a = s.advertisers.find((x) => x.id === PLAYER_ID);
      for (const kw of a.adGroups[0].keywords) kw.matchType = 'broad';
      // Take the budget out of the picture so this measures reach alone.
      a.campaign.weeklySplitPaise = a.campaign.weeklySplitPaise.map(() => 900000000);
    });
    const before = player(EXPECTED);
    const after = player(runRound(broadened, { mode: 'expected' }));

    const shareBefore = before.impressions / before.eligibleAuctions;
    const shareAfter = after.impressions / after.eligibleAuctions;

    expect(after.impressions).toBeGreaterThan(before.impressions);
    expect(shareAfter).toBeLessThan(shareBefore);
  });

  test('and it reaches traffic that never converts', () => {
    // A broad keyword only reaches waste that shares its concepts, so the
    // keyword has to be a plausibly broad one. "gym wear" reaches "gym near
    // me" and "gym membership price"; "sports bra combo pack" reaches neither,
    // and an advertiser holding only the latter would never see the trap.
    const broadened = deformed(STATE, (s) => {
      const a = s.advertisers.find((x) => x.id === PLAYER_ID);
      a.adGroups[0].keywords = [{
        id: 'kw_wide', text: 'gym wear', matchType: 'broad',
        bidPaise: 900, active: true, tags: ['gym'], taggedContentHash: 'sha1:t',
      }];
    });
    const irrelevantIds = new Set(
      STATE.querySet.queries.filter((q) => q.intent === 'irrelevant').map((q) => q.id),
    );
    const after = player(runRound(broadened, { mode: 'expected' }));
    const wasted = [...after.byQuery].filter(([id]) => irrelevantIds.has(id));

    expect(wasted.length).toBeGreaterThan(0);
    expect(wasted.reduce((a, [, v]) => a + v.costPaise, 0)).toBeGreaterThan(0);
  });

  test('a negative keyword takes some of it back', () => {
    const broadened = deformed(STATE, (s) => {
      const a = s.advertisers.find((x) => x.id === PLAYER_ID);
      for (const kw of a.adGroups[0].keywords) kw.matchType = 'broad';
    });
    const blocked = deformed(broadened, (s) => {
      s.advertisers.find((x) => x.id === PLAYER_ID).campaign.negatives = [
        { text: 'free', matchType: 'broad' },
        { text: 'gym near me', matchType: 'phrase' },
      ];
    });
    const wide = player(runRound(broadened, { mode: 'expected' }));
    const tight = player(runRound(blocked, { mode: 'expected' }));
    expect(tight.eligibleAuctions).toBeLessThan(wide.eligibleAuctions);
  });
});

describe('conversions arrive late and settle later (spec 11.3, 14)', () => {
  test('not every conversion lands in the round that earned it', () => {
    const p = player(EXPECTED);
    const landedNow = p.landed.reduce((a, e) => a + e.count, 0);
    const stillOwed = p.pendingConversions.reduce((a, e) => a + e.count, 0);
    expect(landedNow).toBeGreaterThan(0);
    expect(stillOwed).toBeGreaterThan(0);
    expect(landedNow / (landedNow + stillOwed))
      .toBeCloseTo(ATTRIBUTION_LAG_DISTRIBUTION[0], 1);
  });

  test('pending conversions remember the round they were clicked in', () => {
    for (const e of player(EXPECTED).pendingConversions) {
      expect(e.clickedInRound).toBe(STATE.round);
      expect(e.dueRound).toBeGreaterThan(STATE.round);
    }
  });

  test('running the next round lands what was owed', () => {
    const second = runRound(EXPECTED.nextGameState, { mode: 'expected' });
    const owedBefore = player(EXPECTED).pendingConversions
      .filter((e) => e.dueRound === STATE.round + 1)
      .reduce((a, e) => a + e.count, 0);
    const landedFromBefore = player(second).landed
      .filter((e) => e.clickedInRound === STATE.round)
      .reduce((a, e) => a + e.count, 0);
    expect(owedBefore).toBeGreaterThan(0);
    expect(landedFromBefore).toBeCloseTo(owedBefore, 6);
  });

  test('returns are queued against what landed', () => {
    const second = runRound(EXPECTED.nextGameState, { mode: 'expected' });
    const p = player(second);
    expect(p.pendingReturns.length).toBeGreaterThan(0);
    for (const r of p.pendingReturns) {
      expect(r.resolvesInRound).toBeGreaterThan(r.landedInRound);
    }
  });
});

describe('the counterfactual (spec 11.2, W4, L13)', () => {
  const withCf = runRound(STATE, { mode: 'expected', counterfactualFor: [CONSTRAINED] });
  const target = withCf.raw.byAdvertiser[CONSTRAINED];

  test('a budget-constrained advertiser would have bought much more', () => {
    expect(target.lostToBudget).toBeGreaterThan(0);
    expect(target.counterfactual.impressions).toBeGreaterThan(target.impressions * 1.5);
    expect(target.counterfactual.costPaise).toBeGreaterThan(target.costPaise);
  });

  test('it raises ONLY the focal advertiser budget', () => {
    // Raising everyone measures a different, more competitive market and
    // answers the wrong question.
    for (const [id, r] of Object.entries(withCf.raw.byAdvertiser)) {
      if (id === CONSTRAINED) continue;
      expect(r.costPaise, id).toBe(EXPECTED.raw.byAdvertiser[id].costPaise);
      expect(r.counterfactual, id).toBeUndefined();
    }
  });

  test('it does not recurse (L13)', () => {
    expect(target.counterfactual.counterfactual).toBeUndefined();
  });

  test('an advertiser that is not budget-limited misses nothing', () => {
    // Sometimes the correct action is to leave the budget alone, and the
    // counterfactual has to be able to say so.
    const free = runRound(STATE, { mode: 'expected', counterfactualFor: [PLAYER_ID] });
    const p = free.raw.byAdvertiser[PLAYER_ID];
    // Not exactly zero: pacing returns a fraction a hair under 1 in hours
    // where the advertiser sits exactly on plan, and those slivers accumulate
    // across 25,000 auctions. Five parts in a million of eligible volume is
    // not budget limitation, and the counterfactual agrees.
    expect(p.lostToBudget / p.eligibleAuctions).toBeLessThan(0.0001);
    // Relative, not absolute: two parts in a million of 19,620 impressions is
    // the same slivers reappearing, not opportunity the player is missing.
    expect(p.counterfactual.impressions / p.impressions).toBeCloseTo(1, 4);
  });

  test('it runs noise-free even when the round is sampled', () => {
    // DECISIONS G1 calls this a number the simulation knows exactly. Sampling
    // it would mean comparing a noisy observation against a noisy hypothetical
    // and reading the difference as opportunity.
    const a = runRound(STATE, { mode: 'sampled', seed: 11, counterfactualFor: [CONSTRAINED] });
    const b = runRound(STATE, { mode: 'sampled', seed: 12, counterfactualFor: [CONSTRAINED] });
    expect(a.raw.byAdvertiser[CONSTRAINED].counterfactual.impressions)
      .toBeCloseTo(b.raw.byAdvertiser[CONSTRAINED].counterfactual.impressions, 6);
  });
});

describe('determinism (R1)', () => {
  test('the same seed and the same decisions give the same round', () => {
    const a = runRound(STATE, { mode: 'sampled', seed: 4242 });
    const b = runRound(STATE, { mode: 'sampled', seed: 4242 });
    expect(JSON.stringify(a.raw.byAdvertiser[PLAYER_ID].costPaise))
      .toBe(JSON.stringify(b.raw.byAdvertiser[PLAYER_ID].costPaise));
    expect(a.raw.marketContext).toEqual(b.raw.marketContext);
  });

  test('a different seed gives a different round', () => {
    const a = runRound(STATE, { mode: 'sampled', seed: 1 });
    const b = runRound(STATE, { mode: 'sampled', seed: 2 });
    expect(a.raw.byAdvertiser[PLAYER_ID].costPaise)
      .not.toBe(b.raw.byAdvertiser[PLAYER_ID].costPaise);
  });

  test('expected mode ignores the seed entirely', () => {
    const a = runRound(STATE, { mode: 'expected', seed: 1 });
    const b = runRound(STATE, { mode: 'expected', seed: 999 });
    expect(a.raw.byAdvertiser[PLAYER_ID].costPaise)
      .toBe(b.raw.byAdvertiser[PLAYER_ID].costPaise);
  });

  test('it does not mutate the state it was given', () => {
    const snapshot = JSON.stringify(STATE);
    runRound(STATE, { mode: 'expected', counterfactualFor: [PLAYER_ID] });
    expect(JSON.stringify(STATE)).toBe(snapshot);
  });
});

describe('state advances correctly', () => {
  const next = EXPECTED.nextGameState;
  const nextPlayer = next.advertisers.find((a) => a.id === PLAYER_ID);

  test('month spend accumulates', () => {
    expect(nextPlayer.campaign.monthSpentPaise).toBe(player(EXPECTED).costPaise);
  });

  test('observed conversions grow from LANDED conversions only', () => {
    // A conversion that has not arrived cannot inform a bid (DECISIONS D2).
    const before = STATE.advertisers.find((a) => a.id === PLAYER_ID).bidding.observedConversions;
    const landed = player(EXPECTED).landed.reduce((a, e) => a + e.count, 0);
    expect(nextPlayer.bidding.observedConversions).toBeCloseTo(before + landed, 6);
  });

  test('a learning period counts down by exactly one round', () => {
    const learning = deformed(STATE, (s) => {
      s.advertisers.find((a) => a.id === PLAYER_ID).bidding.learningRoundsRemaining = 2;
    });
    const after = runRound(learning, { mode: 'expected' }).nextGameState
      .advertisers.find((a) => a.id === PLAYER_ID);
    expect(after.bidding.learningRoundsRemaining).toBe(1);
  });

  test('quality history gains a row per keyword that saw literal traffic', () => {
    const rows = Object.values(nextPlayer.qualityHistory);
    expect(rows.length).toBeGreaterThan(0);
    for (const history of rows) {
      expect(history[0].round).toBe(STATE.round);
      expect(history[0].impressions).toBeGreaterThan(0);
      expect(history[0].ownComponents.expectedCtr).toBeGreaterThan(0);
    }
  });

  test('field components come from rivals, not from oneself', () => {
    const withField = Object.values(nextPlayer.qualityHistory)
      .flat()
      .filter((r) => r.fieldComponents.expectedCtr > 0);
    expect(withField.length).toBeGreaterThan(0);
    for (const r of withField) {
      expect(r.fieldComponents.expectedCtr).not.toBe(r.ownComponents.expectedCtr);
    }
  });

  test('two rounds in a row keep advancing', () => {
    const second = runRound(EXPECTED.nextGameState, { mode: 'expected' });
    expect(second.nextGameState.round).toBe(STATE.round + 2);
    expect(second.raw.byAdvertiser[PLAYER_ID].monthSpentPaise)
      .toBeGreaterThan(player(EXPECTED).costPaise);
  });
});

describe('decisions arrive pre-computed (R2)', () => {
  test('a submitted campaign change takes effect this round', () => {
    const result = runRound(STATE, {
      mode: 'expected',
      decisions: {
        [PLAYER_ID]: { campaign: { ...STATE.advertisers[0].campaign, strategy: 'maxClicks' } },
      },
    });
    expect(player(result).costPaise).not.toBe(player(EXPECTED).costPaise);
  });

  test('an advertiser with no decision carries on unchanged', () => {
    const result = runRound(STATE, { mode: 'expected', decisions: {} });
    expect(player(result).costPaise).toBe(player(EXPECTED).costPaise);
  });
});

describe('budget ceilings hold', () => {
  test('nobody spends more than the month allows', () => {
    for (const [id, r] of Object.entries(EXPECTED.raw.byAdvertiser)) {
      expect(r.monthSpentPaise, id).toBeLessThanOrEqual(r.monthlyBudgetPaise);
    }
  });

  test('a month runs out and stays out', () => {
    const nearlyDone = deformed(STATE, (s) => {
      for (const a of s.advertisers) {
        a.campaign.monthSpentPaise = a.campaign.monthlyBudgetPaise;
      }
    });
    const result = runRound(nearlyDone, { mode: 'expected' });
    for (const [id, r] of Object.entries(result.raw.byAdvertiser)) {
      expect(r.costPaise, id).toBe(0);
      expect(r.lostToBudget, id).toBeGreaterThan(0);
    }
  });

  test('the week that applies is the one this round sits in', () => {
    const lopsided = deformed(STATE, (s) => {
      const a = s.advertisers.find((x) => x.id === PLAYER_ID);
      a.campaign.weeklySplitPaise = [100, 900000000, 100, 100];
    });
    const week1 = player(runRound({ ...lopsided, round: 1 }, { mode: 'expected' }));
    const week2 = player(runRound({ ...lopsided, round: 2 }, { mode: 'expected' }));
    expect(week2.costPaise).toBeGreaterThan(week1.costPaise * 10);
    expect(ROUNDS_PER_MONTH).toBe(4);
  });
});

describe('the market context', () => {
  test('reports total spend, advertiser count and a median CPC', () => {
    const m = EXPECTED.raw.marketContext;
    const summed = Object.values(EXPECTED.raw.byAdvertiser)
      .reduce((a, r) => a + r.costPaise, 0);
    expect(m.totalMarketSpendPaise).toBe(summed);
    expect(m.activeAdvertisers).toBe(STATE.advertisers.length);
    expect(m.medianCpcPaise).toBeGreaterThan(0);
  });
});

describe('performance (spec 19)', () => {
  test('an expected round completes under 400ms', () => {
    runRound(STATE, { mode: 'expected' });
    const t0 = Date.now();
    runRound(STATE, { mode: 'expected' });
    expect(Date.now() - t0).toBeLessThan(400);
  });

  test('a sampled round with one counterfactual completes under 1500ms', () => {
    runRound(STATE, { mode: 'sampled', seed: 3, counterfactualFor: [CONSTRAINED] });
    const t0 = Date.now();
    runRound(STATE, { mode: 'sampled', seed: 3, counterfactualFor: [CONSTRAINED] });
    expect(Date.now() - t0).toBeLessThan(1500);
  });
});
