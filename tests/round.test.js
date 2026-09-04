import { describe, test, expect } from 'vitest';
import { runRound } from '../engine/round.js';
import { makeGameState, deformed, PLAYER_ID } from './fixtures/gameState.js';
import {
  ATTRIBUTION_LAG_DISTRIBUTION, MAX_SLOTS, ROUNDS_PER_MONTH,
  HOURLY_INTENT_CURVE, MIN_HOUR_OBSERVATIONS, CAPEX_ALLOCATION_PAISE, AD_RANK_FLOOR,
  MONTHLY_BUDGET_PAISE, REPOSITION_COST_PAISE, REPOSITION_ROUND,
} from '../engine/constants.js';

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

describe('the ungraded warning names the ad, not the outcome (spec 9.5)', () => {
  // 9.5: "If gradedQuality is null, the engine uses DEFAULT_UNGRADED_QUALITY and
  // adds 'ungraded_ad' to report.warnings." It said nothing about winning.
  //
  // It used to be set inside the shown branch of recordAuction, so an
  // advertiser whose 3/3/3 default held it below AD_RANK_FLOOR - which is
  // exactly what an ungraded ad does at any cautious bid - entered every
  // auction, showed in none, and was never told why. 100% lost to rank and no
  // cause. The one advertiser who most needed the warning was the only one who
  // could not get it.

  test('an ungraded advertiser that never shows is still warned', () => {
    const ungraded = deformed(STATE, (x) => {
      x.advertisers[0].adGroups[0].gradedQuality = null;
      // Below the reserve on purpose: eligible everywhere, shown nowhere.
      for (const k of x.advertisers[0].adGroups[0].keywords) k.bidPaise = 200;
    });
    const out = runRound(ungraded, { mode: 'expected' });
    const mine = out.report.byAdvertiser[PLAYER_ID];
    expect(mine.traffic.eligibleAuctions).toBeGreaterThan(0);
    expect(mine.traffic.impressions).toBe(0);
    expect(mine.warnings).toContain('ungraded_ad');
  });

  test('and one that shows is warned too', () => {
    const ungraded = deformed(STATE, (x) => {
      x.advertisers[0].adGroups[0].gradedQuality = null;
    });
    const out = runRound(ungraded, { mode: 'expected' });
    expect(out.report.byAdvertiser[PLAYER_ID].warnings).toContain('ungraded_ad');
  });

  test('a graded advertiser is not warned', () => {
    expect(runRound(STATE, { mode: 'expected' }).report.byAdvertiser[PLAYER_ID].warnings)
      .not.toContain('ungraded_ad');
  });
});

describe('an open cell is not a free ride (spec 17.1)', () => {
  // 17.1 says taking a cell nobody else occupies is a legitimate strategy and
  // "not a free ride - rival broad match spills into every territory". Round 0's
  // central decision rests on that being true.
  //
  // It IS true, and the first attempt to check it looked at the wrong number.
  // The player here loses NOT ONE IMPRESSION to rank: it outranks or ties with
  // everyone who reaches it, and with four slots against typically fewer
  // entrants, everyone above the floor shows anyway. Measured on lostToRank the
  // rivals appear to cost nothing.
  //
  // The cost lands entirely on PRICE. Second price charges what it takes to beat
  // the entrant below you (10.2, W8), so a rival who never outranks you and
  // never takes an impression from you still raises every click you buy.
  const solo = deformed(STATE, (x) => {
    x.advertisers = x.advertisers.map((a, i) => (i === 0 ? a : { ...a, active: false }));
  });
  const alone = runRound(solo, { mode: 'expected' }).raw.byAdvertiser[PLAYER_ID];
  const market = runRound(STATE, { mode: 'expected' }).raw.byAdvertiser[PLAYER_ID];

  test('the rivals take no impressions at all', () => {
    expect(market.impressions / market.eligibleAuctions).toBeCloseTo(1, 3);
    expect(market.lostToRank / market.eligibleAuctions).toBeLessThan(0.001);
    // Not exactly equal: 7 impressions in 32,900, two parts in ten thousand,
    // where a rival edges it out of a sliver of one hour. Relative, because
    // "loses no impressions" is a claim about proportion, not about integers.
    expect(Math.abs(market.impressions / alone.impressions - 1)).toBeLessThan(0.001);
  });

  test('and cost it half its margin anyway, through the price', () => {
    const aloneCpc = alone.costPaise / alone.clicks;
    const marketCpc = market.costPaise / market.clicks;
    expect(marketCpc, `${aloneCpc.toFixed(0)} alone vs ${marketCpc.toFixed(0)} in market`)
      .toBeGreaterThan(aloneCpc * 1.5);
  });

  test('which is the reserve giving way to a real competitor', () => {
    // Alone, every auction prices against AD_RANK_FLOOR because there is no
    // entrant below. In the market the entrant below is a real advertiser with
    // a real ad rank, and that is what the player is paying to beat.
    const aloneCpc = alone.costPaise / alone.clicks;
    const floorPrice = AD_RANK_FLOOR / 0.10;      // a plausible signal, order of magnitude
    expect(aloneCpc).toBeLessThan(floorPrice * 3);
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

  test('it lifts the budget to what is LEFT of the month, not the whole of it', () => {
    // Spec 11.2 and DECISIONS G1 both say "raised to its remaining monthly
    // pot". The implementation zeroed monthSpentPaise, which hands the
    // advertiser the FULL month back - so an account in week four that had
    // already spent 90% of its pot was told what it could have earned with
    // ten times the money it actually had left.
    //
    // Invisible at round 1, where monthSpentPaise is 0 and the two readings
    // agree. Every existing counterfactual test ran at round 1.
    const spent = Math.round(MONTHLY_BUDGET_PAISE * 0.9);
    const lateInMonth = deformed(STATE, (x) => {
      x.round = 3;
      x.advertisers.find((a) => a.id === CONSTRAINED).campaign.monthSpentPaise = spent;
    });
    const out = runRound(lateInMonth, { mode: 'expected', counterfactualFor: [CONSTRAINED] });
    const remaining = MONTHLY_BUDGET_PAISE - spent;

    // The month is a hard cap (13.2). A hypothetical that ignores it is not a
    // hypothetical about this account.
    expect(out.raw.byAdvertiser[CONSTRAINED].counterfactual.costPaise)
      .toBeLessThanOrEqual(remaining);
  });

  test('and an advertiser that has burned its month misses nothing', () => {
    // The pot is gone. There is no version of this round where it spends
    // more, so the honest answer is zero rather than "everything you would
    // have earned with another month's money".
    const burnt = deformed(STATE, (x) => {
      x.round = 3;
      x.advertisers.find((a) => a.id === CONSTRAINED).campaign.monthSpentPaise = MONTHLY_BUDGET_PAISE;
    });
    const out = runRound(burnt, { mode: 'expected', counterfactualFor: [CONSTRAINED] });
    const report = out.report.byAdvertiser[CONSTRAINED];
    expect(report.missedToBudget.impressions).toBe(0);
    expect(report.missedToBudget.clicks).toBe(0);
  });

  test('it does not recurse (L13)', () => {
    expect(target.counterfactual.counterfactual).toBeUndefined();
  });

  test('an advertiser that is not budget-limited misses nothing', () => {
    // Sometimes the correct action is to leave the budget alone, and the
    // counterfactual has to be able to say so.
    //
    // The advertiser is given a budget it cannot spend rather than assumed to
    // have one. This used to lean on the player happening not to be
    // budget-limited at the fixture's settings, which stopped being true the
    // moment WEEKLY_VOLUME was calibrated upward - and a test whose premise
    // depends on the size of the market is testing the market, not the
    // counterfactual.
    const unlimited = deformed(STATE, (x) => {
      const huge = MONTHLY_BUDGET_PAISE * 50;
      x.advertisers[0].campaign.monthlyBudgetPaise = huge;
      x.advertisers[0].campaign.weeklySplitPaise = new Array(ROUNDS_PER_MONTH).fill(huge / ROUNDS_PER_MONTH);
    });
    const free = runRound(unlimited, { mode: 'expected', counterfactualFor: [PLAYER_ID] });
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

describe('the engine writes observed history (spec 12.2)', () => {
  // The test spec 19 asks for and that was never written. Every strategies
  // test supplies observedConvRate by hand, so the suite looked identical
  // whether or not the engine ever wrote one - and it never did. Smart
  // bidding fell back to COLD_START_CONV_RATE for all twelve rounds while
  // observedConversions climbed into the hundreds, so the estimate grew
  // steadily more confident about a number that never updated.
  const fresh = deformed(STATE, (x) => {
    for (const a of x.advertisers) {
      a.campaign.strategy = 'targetCpa';
      a.bidding = { learningRoundsRemaining: 0, observedConvRate: null, observedConversions: 0, observedClicks: 0, observedByHour: null };
    }
  });

  const rounds = [];
  let s = fresh;
  for (let r = 1; r <= 4; r++) {
    const out = runRound(s, { mode: 'expected' });
    s = out.nextGameState;
    rounds.push({ raw: out.raw, state: s });
  }
  const bidding = (i) => rounds[i].state.advertisers[0].bidding;

  test('observedConvRate is written, not left null', () => {
    expect(bidding(0).observedConvRate).toBeGreaterThan(0);
  });

  test('it is landed conversions over every click paid for', () => {
    let conv = 0;
    let clicks = 0;
    for (const { raw } of rounds) clicks += raw.byAdvertiser[PLAYER_ID].clicks;
    conv = bidding(3).observedConversions;
    expect(bidding(3).observedConvRate).toBeCloseTo(conv / clicks, 12);
    expect(bidding(3).observedClicks).toBeCloseTo(clicks, 6);
  });

  test('it reads LOW at first and converges upward', () => {
    // Clicks are paid for immediately; their conversions arrive over the next
    // three rounds. So the observed rate starts near 55% of the truth and
    // climbs. This IS the lesson in 12.2 - a bid strategy checked too early
    // is not broken, it is uninformed - and it only exists because the
    // denominator counts clicks that have not paid out yet.
    const rates = rounds.map((_, i) => bidding(i).observedConvRate);
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i], `round ${i + 1}`).toBeGreaterThan(rates[i - 1]);
    }
  });

  test('it stays null until the first click, so cold start still fires', () => {
    const dark = deformed(STATE, (x) => {
      for (const a of x.advertisers) {
        a.campaign.monthlyBudgetPaise = 0;
        a.campaign.weeklySplitPaise = [0, 0, 0, 0];
        a.bidding = { learningRoundsRemaining: 0, observedConvRate: null, observedConversions: 0, observedClicks: 0, observedByHour: null };
      }
    });
    const out = runRound(dark, { mode: 'expected' });
    expect(out.raw.byAdvertiser[PLAYER_ID].clicks).toBe(0);
    expect(out.nextGameState.advertisers[0].bidding.observedConvRate).toBeNull();
  });
});

describe('hour-of-day history, so dayparting can be earned (DECISIONS D2)', () => {
  // observedByHour was written as a literal null by round.js and populated by
  // nothing, so MIN_HOUR_OBSERVATIONS was unreachable and the hourly branch of
  // observedRateFor was dead code. A bid strategy had no route to dayparting
  // at all - which is the v0.1 oracle problem inverted: instead of knowing the
  // hourly curve for free, it could never learn it.
  let s = deformed(STATE, (x) => {
    for (const a of x.advertisers) {
      a.bidding = { learningRoundsRemaining: 0, observedConvRate: null, observedConversions: 0, observedClicks: 0, observedByHour: null };
    }
  });
  for (let r = 1; r <= 3; r++) s = runRound(s, { mode: 'expected' }).nextGameState;
  const hourly = s.advertisers[0].bidding.observedByHour;

  test('it is populated, one entry per hour', () => {
    expect(Array.isArray(hourly)).toBe(true);
    expect(hourly).toHaveLength(24);
    for (const h of hourly) expect(h.clicks).toBeGreaterThan(0);
  });

  test('the hours carry real signal: the best hour is the intent peak', () => {
    // HOURLY_INTENT_CURVE peaks at 15:00 and the volume profiles peak at 11,
    // 19 and 20 (invariant I5 keeps them apart). If the hourly history did not
    // carry the intent curve there would be nothing for dayparting to find,
    // and DECISIONS H4 would be false.
    const rates = hourly.map((h) => h.conversions / h.clicks);
    const best = rates.indexOf(Math.max(...rates));
    expect(best).toBe(HOURLY_INTENT_CURVE.indexOf(Math.max(...HOURLY_INTENT_CURVE)));
  });

  test('most hours clear MIN_HOUR_OBSERVATIONS, but not the dead of night', () => {
    // The branch has to be REACHABLE or dayparting cannot be earned at all.
    // It also has to stay unreachable somewhere, or it is not earned - an
    // advertiser should not form an opinion about 3am off nine clicks. After
    // three rounds 19 of 24 hours qualify and the overnight ones do not.
    const cleared = hourly.map((h) => h.clicks >= MIN_HOUR_OBSERVATIONS);
    expect(cleared.filter(Boolean).length).toBeGreaterThan(12);
    expect(cleared.filter(Boolean).length).toBeLessThan(24);
    expect(cleared.slice(2, 5).some(Boolean)).toBe(false);
  });

  test('hourly conversions lag exactly as the aggregate does', () => {
    // Clicks are counted the moment they happen; conversions are added only
    // when they LAND. If the hourly branch counted conversions at click time
    // it would read 100% of truth while the aggregate read 55%, and crossing
    // the observation threshold would jump an advertiser's belief upward for
    // no reason it could see.
    const totalHourlyConv = hourly.reduce((a, h) => a + h.conversions, 0);
    const totalHourlyClicks = hourly.reduce((a, h) => a + h.clicks, 0);
    expect(totalHourlyConv).toBeCloseTo(s.advertisers[0].bidding.observedConversions, 6);
    expect(totalHourlyClicks).toBeCloseTo(s.advertisers[0].bidding.observedClicks, 6);
  });
});

describe('capex that is not committed becomes ad budget (spec 13.3, D8)', () => {
  // 13.3: "Unspent capex rolls into the current month's ad budget, raising
  // that month's hard cap accordingly. Months 1 and 2 can therefore reach
  // 2,68,000." Nothing implemented it, so capex cost nothing and investing
  // the maximum was strictly dominant - the delay was carrying the whole of
  // "don't invest is viable" on its own.
  const holder = deformed(STATE, (x) => {
    x.advertisers[0].capex.remainingUnallocatedPaise = CAPEX_ALLOCATION_PAISE;
  });
  const out = runRound(holder, { mode: 'expected' });
  const row = out.raw.byAdvertiser[PLAYER_ID];

  test('the month cap rises by exactly what was left uncommitted', () => {
    expect(row.monthlyBudgetPaise)
      .toBe(MONTHLY_BUDGET_PAISE + CAPEX_ALLOCATION_PAISE);
  });

  test('the weekly split is respread, or the money is unreachable', () => {
    // The month is the cap but the WEEK is what pacing binds on. Raising one
    // without the other leaves the rollover stranded and the mechanic inert.
    const next = out.nextGameState.advertisers[0].campaign;
    expect(next.weeklySplitPaise.reduce((a, b) => a + b, 0))
      .toBe(MONTHLY_BUDGET_PAISE + CAPEX_ALLOCATION_PAISE);
  });

  test('it is banked once, not every round of the month', () => {
    const after = out.nextGameState.advertisers[0];
    expect(after.capex.remainingUnallocatedPaise).toBe(0);
    const r2 = runRound(out.nextGameState, { mode: 'expected' });
    expect(r2.raw.byAdvertiser[PLAYER_ID].monthlyBudgetPaise)
      .toBe(MONTHLY_BUDGET_PAISE + CAPEX_ALLOCATION_PAISE);
  });

  test('an advertiser that committed everything gets nothing back', () => {
    const spender = runRound(STATE, { mode: 'expected' });
    expect(spender.raw.byAdvertiser[PLAYER_ID].monthlyBudgetPaise)
      .toBe(MONTHLY_BUDGET_PAISE);
  });

  test('and it only lands on a capex allocation round', () => {
    const midMonth = deformed(STATE, (x) => {
      x.round = 3;
      x.advertisers[0].capex.remainingUnallocatedPaise = CAPEX_ALLOCATION_PAISE;
    });
    expect(runRound(midMonth, { mode: 'expected' }).raw.byAdvertiser[PLAYER_ID].monthlyBudgetPaise)
      .toBe(MONTHLY_BUDGET_PAISE);
  });
});

describe('repositioning is paid for (spec 4.5)', () => {
  // "Costs REPOSITION_COST_PAISE, drawn from the month-2 budget." The constant
  // existed, the ledger defended it, and no code read it. The only assertion
  // anywhere compared it to CAPEX_ALLOCATION_PAISE - two constants checked
  // against each other, which would pass with the mechanic deleted.
  const moved = deformed(STATE, (x) => {
    x.round = REPOSITION_ROUND;
    x.advertisers[0].position = {
      price: 'mid', purpose: 'performance', setAtRound: 0, repositionedAtRound: REPOSITION_ROUND,
    };
  });

  test('the month it lands in is lighter by the cost', () => {
    expect(runRound(moved, { mode: 'expected' }).raw.byAdvertiser[PLAYER_ID].monthlyBudgetPaise)
      .toBe(MONTHLY_BUDGET_PAISE - REPOSITION_COST_PAISE);
  });

  test('an advertiser that stayed put pays nothing', () => {
    const stayed = deformed(STATE, (x) => { x.round = REPOSITION_ROUND; });
    expect(runRound(stayed, { mode: 'expected' }).raw.byAdvertiser[PLAYER_ID].monthlyBudgetPaise)
      .toBe(MONTHLY_BUDGET_PAISE);
  });

  test('it is charged once, not for the rest of the game', () => {
    const after = runRound(moved, { mode: 'expected' }).nextGameState;
    expect(runRound(after, { mode: 'expected' }).raw.byAdvertiser[PLAYER_ID].monthlyBudgetPaise)
      .toBe(MONTHLY_BUDGET_PAISE - REPOSITION_COST_PAISE);
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
