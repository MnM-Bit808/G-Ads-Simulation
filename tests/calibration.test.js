/**
 * The calibration invariants (spec 18.2).
 *
 * These govern the two CALIBRATE constants and the fairness of the grid. They
 * are slower than the rest of the suite because several play whole games.
 *
 * I3 PASSES, after two corrections and one bug.
 *
 * First measurement: 4.20x spread, 76% worst deviation against a 15% target —
 * and 90% of that turned out to be the harness rather than the grid. Holding
 * keyword coverage constant took it to 1.32x; allocating each cell's volume by
 * 1/break-even, rather than splitting each tier evenly between its purposes,
 * took it to 12%. Then the double-counted lag-0 conversions in report history
 * (see report.test.js, 'the report stored in history is the report that was
 * returned') turned out to be inflating every settled figure this file sums.
 * Removing them took it to 7.1% and a 1.14x spread.
 *
 * The assertions below hold the SPEC's 15% target, not the current 7.1%.
 * Ratcheting a test down to whatever was last measured turns every later
 * change into a failure with nothing behind it.
 */

import { describe, test, expect } from 'vitest';
import { runRound } from '../engine/round.js';
import { makeGameState, PLAYER_ID } from './fixtures/gameState.js';
import { homeCell } from '../engine/querySet.js';
import {
  allCells, parseCell, businessFor, breakEvenCpcPaise, realisedBreakEvenCpcPaise,
} from '../engine/positions.js';
import { playGame } from '../game.js';
import { disciplined } from '../agents/policies.js';
import { allocate } from '../engine/money.js';
import { QUERY_SET } from '../content/querySet.js';
import {
  MONTHLY_BUDGET_PAISE, ROUNDS_PER_MONTH, TOTAL_ROUNDS, HOUR_PROFILES,
  HOURLY_INTENT_CURVE, MIN_PEAK_SEPARATION_HOURS, POSITION_ECONOMICS,
  PURPOSE_MODIFIERS, AD_RANK_FLOOR, WEEKLY_VOLUME, PROVENANCE,
  CREATIVE_ALLOCATION_PAISE,
} from '../engine/constants.js';

const CELLS = allCells();
const EMPTY = { committed: { sizeGuide: 0, photography: 0, landingPage: 0 }, pending: [] };
const argmax = (a) => a.indexOf(Math.max(...a));

/**
 * Six advertisers, one per cell, identical in every respect except position —
 * INCLUDING keyword coverage.
 *
 * One exact keyword per query in the cell, nothing broad, so reach equals
 * territory by construction. That clause is the whole invariant: the first
 * version of this harness handed out four head terms with one broad, and
 * measured a 4.20x spread of which 90% turned out to be the keyword choice
 * rather than the grid. A broad keyword's reach depends on how many tags that
 * cell's head terms happen to carry, which is skill, and a fairness test that
 * varies with skill measures the wrong thing.
 *
 * ONE CONSEQUENCE WORTH KNOWING, because "six advertisers play twelve rounds"
 * reads as though a market happens here. It does not. Equal coverage means
 * each cell holds exact keywords only on its own queries, so EVERY AUCTION HAS
 * EXACTLY ONE ENTRANT, beatRank always falls back to AD_RANK_FLOOR, and the
 * bid is never the binding constraint. Multiplying every bid by 2.45 changes
 * the result of this harness by nothing at all - verified.
 *
 * So I3 measures the TERRITORY economics in isolation and says nothing about
 * the auction. That is the right thing for a fairness invariant to do, and it
 * is also why the flat reserve matters so much here: raising AD_RANK_FLOOR
 * takes the same absolute paise from every cell, which is a small bite out of
 * Premium and a fatal one out of Value. Measured, a floor of 150 takes worst
 * deviation from 2.8% to over 50%, and 250 wipes the Value tier out entirely.
 */
function balancedState(weeklyVolume = WEEKLY_VOLUME, monthBudget = MONTHLY_BUDGET_PAISE) {
  const base = makeGameState();
  const advertisers = CELLS.map((cell, i) => {
    const position = { ...parseCell(cell), setAtRound: 0, repositionedAtRound: null };
    const business = businessFor(position, EMPTY, 1);
    const bidPaise = Math.round(realisedBreakEvenCpcPaise(business, QUERY_SET, position) * 0.70);
    const own = QUERY_SET.queries.filter((q) => homeCell(q) === cell);

    return {
      ...base.advertisers[i],
      id: `cell_${i}`,
      name: cell,
      position,
      capex: EMPTY,
      campaign: {
        ...base.advertisers[i].campaign,
        monthlyBudgetPaise: monthBudget,
        monthSpentPaise: 0,
        weeklySplitPaise: allocate(monthBudget, new Array(ROUNDS_PER_MONTH).fill(1)),
        strategy: 'manual',
      },
      adGroups: [{
        ...base.advertisers[i].adGroups[0],
        keywords: own.map((q, k) => ({
          id: `kw_${k + 1}`, text: q.text, matchType: 'exact',
          bidPaise, active: true, tags: [...q.tags], taggedContentHash: 'sha1:b',
        })),
        // The only difference between these six is which cell they sit in.
        gradedQuality: {
          expectedCtr: 6, adRelevance: 7, landingPage: 6,
          gradedAtRound: 0, contentHash: 'sha1:balanced',
        },
      }],
    };
  });
  return { ...base, querySet: { ...base.querySet, weeklyVolume }, advertisers };
}

/**
 * Play a full game and return cumulative net profit per cell, settled rounds
 * only.
 *
 * Memoised on volume, because this is a twelve-round six-advertiser game and
 * the file asks for the default one twice - once for I3 and once for "a full
 * game holds together". It is deterministic in expected mode, so the second
 * call was recomputing a result it already had, and the wasted seconds showed
 * up as flaky timing in the performance tests running alongside.
 */
const balancedCache = new Map();

function playBalanced(weeklyVolume = WEEKLY_VOLUME, monthBudget = MONTHLY_BUDGET_PAISE) {
  const key = `${weeklyVolume}|${monthBudget}`;
  if (balancedCache.has(key)) return balancedCache.get(key);
  const result = computeBalanced(weeklyVolume, monthBudget);
  balancedCache.set(key, result);
  return result;
}

function computeBalanced(weeklyVolume, monthBudget) {
  let s = balancedState(weeklyVolume, monthBudget);
  const rows = [];
  for (let r = 1; r <= TOTAL_ROUNDS; r++) {
    const out = runRound(s, { mode: 'expected' });
    rows.push(out.report);
    s = out.nextGameState;
  }
  // A click in round R settles at R + 3 lag + 2 return window, so by round 12
  // only rounds 1..7 are final.
  const settled = s.history.filter((h) => h.round <= 7);
  const profit = {};
  for (const a of s.advertisers) {
    profit[a.name] = settled.reduce(
      (acc, h) => acc + (h.byAdvertiser[a.id]?.money.netProfitPaise ?? 0), 0,
    );
  }
  return { profit, finalState: s };
}

/**
 * One advertiser, alone, covering its own territory competently.
 *
 * "Playing the baseline policy" is now literal: `disciplined` decides the bids,
 * rather than the harness deforming an advertiser until it spends enough. The
 * old version tripled every bid and forced every keyword to broad, which is not
 * a baseline — it is an advertiser built to pass the test, and it passed at a
 * WEEKLY_VOLUME where a competent one could reach only 73% of its month.
 *
 * Coverage is one phrase keyword per query in its own cell. That is competence
 * rather than deformation: an advertiser that has not built out its territory
 * is not evidence about the size of the market.
 */
function soloState(weeklyVolume = WEEKLY_VOLUME) {
  const base = makeGameState();
  const advertiser = base.advertisers[0];
  const cell = cellOf(advertiser);
  const own = QUERY_SET.queries.filter((q) => homeCell(q) === cell);

  return {
    ...base,
    querySet: { ...base.querySet, weeklyVolume },
    advertisers: base.advertisers.map((a, i) => (i === 0 ? {
      ...a,
      adGroups: [{
        ...a.adGroups[0],
        keywords: own.map((q, k) => ({
          id: `kw_${k + 1}`,
          text: q.text,
          matchType: 'phrase',
          bidPaise: a.adGroups[0].keywords[0].bidPaise,
          active: true,
          tags: [...q.tags],
          taggedContentHash: 'sha1:solo',
        })),
      }],
    } : { ...a, active: false })),
  };
}

const cellOf = (a) => `${a.position.price}|${a.position.purpose}`;

/** Play one month solo and report what the budget did. */
async function playSolo(weeklyVolume) {
  const state = soloState(weeklyVolume);
  const { reports } = await playGame(
    state, { [PLAYER_ID]: disciplined }, { mode: 'expected', rounds: ROUNDS_PER_MONTH },
  );
  let costPaise = 0;
  let clicks = 0;
  let lostToBudget = 0;
  let eligible = 0;
  for (const report of reports) {
    const row = report.byAdvertiser[PLAYER_ID];
    costPaise += row.traffic.costPaise;
    clicks += row.traffic.clicks;
    lostToBudget += row.share.lostToBudget * row.traffic.eligibleAuctions;
    eligible += row.traffic.eligibleAuctions;
  }
  const position = state.advertisers[0].position;
  return {
    spentFraction: costPaise / MONTHLY_BUDGET_PAISE,
    cpcPaise: costPaise / clicks,
    lostToBudget: lostToBudget / eligible,
    breakEven: realisedBreakEvenCpcPaise(
      businessFor(position, EMPTY, 1), state.querySet, position,
    ),
  };
}

describe('I1 \u2014 budget must bind', () => {
  test('an advertiser alone against passive rivals exhausts its month', async () => {
    // The clause the old assertion left out. 18.2 says a competent advertiser
    // must be able to EXHAUST its budget, not spend half of it - and the old
    // test asked only for 50%, which WEEKLY_VOLUME could be cut by 2.5x and
    // still satisfy. It did not govern the constant it was said to govern.
    const solo = await playSolo();
    expect(solo.spentFraction).toBeGreaterThan(0.99);
  });

  test('and does it PROFITABLY, at a CPC below its own break-even', async () => {
    // The other clause that was never checked. Exhausting a budget at a CPC
    // above break-even is not evidence the market is big enough; it is
    // evidence the advertiser is overpaying. Against the REALISED ceiling,
    // since the neutral-query figure is not what anybody can pay.
    const solo = await playSolo();
    expect(solo.cpcPaise).toBeLessThan(solo.breakEven);
  });

  test('and the budget genuinely binds, rather than merely running low', async () => {
    // The consequence 18.2 actually cares about. If lostToBudget never fires,
    // missedToBudget is always zero, the monthly pot never binds and the whole
    // of section 13 does nothing. Spending 99.9% of a month with lostToBudget
    // at 0.0% would pass the first assertion and mean nothing.
    const solo = await playSolo();
    expect(solo.lostToBudget).toBeGreaterThan(0.02);
  });

  test('WEEKLY_VOLUME is pinned from BELOW: a smaller market cannot do it', async () => {
    // This is what makes I1 govern the constant rather than merely tolerate
    // it. At 225,000 - the value this project carried for eleven commits - a
    // competently covered advertiser reached 73% of its month with
    // lostToBudget at exactly 0.0%.
    //
    // The probe was 225,000 until F14, and after F14 that was so far below the
    // window that it tested nothing. 330,000 is the value F14 first chose,
    // before the reserve was lowered: with AD_RANK_FLOOR at 48 the same
    // advertiser reaches 86% of its month and never loses an auction to budget.
    const small = await playSolo(330000);
    expect(small.spentFraction).toBeLessThan(0.99);
    expect(small.lostToBudget).toBeLessThan(0.001);
  });

  test('WEEKLY_VOLUME is still marked provisional', () => {
    expect(PROVENANCE.WEEKLY_VOLUME).toBe('CALIBRATE');
    expect(WEEKLY_VOLUME).toBe(430000);
  });
});

describe('I2 — the market must be affordable', () => {
  const state = makeGameState();
  const out = runRound(state, { mode: 'expected' });
  const valueBreakEven = realisedBreakEvenCpcPaise(
    businessFor({ price: 'value', purpose: 'performance' }, EMPTY, 1),
    QUERY_SET, { price: 'value', purpose: 'performance' },
  );

  test('median CPC sits below what the Value tier can really pay', () => {
    // Against the REALISED ceiling, not breakEvenCpcPaise. The neutral-query
    // figure is 1412 and the real one is 3456, so this bar used to be set at
    // 41% of the right height - passing it said almost nothing.
    expect(out.raw.marketContext.medianCpcPaise).toBeLessThan(valueBreakEven);
  });

  test('and the market it measures is alive', () => {
    // Without this, I2 passes on a DEAD market. At AD_RANK_FLOOR >= 400 nobody
    // clears the reserve, nothing transacts, medianCpcPaise is 0, and "median
    // CPC below break-even" goes green at exactly the setting that destroys
    // the thing it exists to protect. Measured: floor 400 gives 0 impressions,
    // 0 spend, and a passing assertion above.
    expect(out.raw.marketContext.medianCpcPaise).toBeGreaterThan(0);
    expect(out.raw.marketContext.totalMarketSpendPaise).toBeGreaterThan(0);
    const impressions = state.advertisers
      .reduce((a, x) => a + out.raw.byAdvertiser[x.id].impressions, 0);
    expect(impressions).toBeGreaterThan(0);
  });

  test('no position is priced out of its own territory', () => {
    // This replaces an assertion that could not fail. It compared each
    // advertiser's CPC against its own break-even while the fixture bid 70% of
    // that same break-even and the auction guarantees cpc <= bid - so it was
    // true by construction and would have passed against an auction that
    // simply returned the bid.
    //
    // lostToRank is not capped by the bid rule. If a tier were being priced
    // out - the "grid collapses to two tiers" failure I2 exists to catch - it
    // would show up here and nowhere else.
    for (const a of state.advertisers) {
      const r = out.raw.byAdvertiser[a.id];
      const lostToRank = r.lostToRank / r.eligibleAuctions;
      expect(lostToRank, `${a.id} (${a.position.price})`).toBeLessThan(0.55);
    }
    for (const price of ['value', 'mid', 'premium']) {
      const best = Math.max(...state.advertisers
        .filter((a) => a.position.price === price)
        .map((a) => {
          const r = out.raw.byAdvertiser[a.id];
          return r.impressions / r.eligibleAuctions;
        }));
      expect(best, price).toBeGreaterThan(0.4);
    }
  });

  test('AD_RANK_FLOOR is still marked provisional', () => {
    expect(PROVENANCE.AD_RANK_FLOOR).toBe('CALIBRATE');
    expect(AD_RANK_FLOOR).toBe(48);
  });
});

describe('I3 — positions must balance', () => {
  const { profit } = playBalanced();
  const values = CELLS.map((c) => profit[c]);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const worstDeviation = Math.max(...values.map((v) => Math.abs(v - mean))) / Math.abs(mean);
  const spread = Math.max(...values) / Math.min(...values);

  test('the measurement runs and every cell turns a profit', () => {
    // The floor: a position that cannot make money at all is not a position.
    for (const cell of CELLS) {
      expect(profit[cell], cell).toBeGreaterThan(0);
    }
  });

  test('no cell finishes more than 15% from the mean', () => {
    // The invariant, now that it measures the grid rather than the harness's
    // keyword choice. Two changes got it here: equal coverage (which removed
    // 90% of the original spread) and allocating each cell's volume by
    // 1/break-even instead of splitting each tier evenly between its purposes.
    expect(worstDeviation, `worst deviation ${(worstDeviation * 100).toFixed(1)}%`)
      .toBeLessThan(0.15);
  });

  test('and the best cell is within a third of the worst', () => {
    expect(spread, `spread ${spread.toFixed(2)}x`).toBeLessThan(1.35);
  });

  test('and it still holds when the creative rollover raises every budget', () => {
    // DECISIONS I11 added a creative budget whose unspent remainder becomes
    // advertising money, so an advertiser that writes its own copy runs a month
    // of MONTHLY_BUDGET + CREATIVE_ALLOCATION. That is a ~30% change to the
    // budget scale WEEKLY_VOLUME is pinned against, and this file was blind to
    // it: the harness hardcoded the base figure, so the whole suite could pass
    // while the invariant it exists for had never been tested at the budget a
    // real game now produces.
    const raised = playBalanced(WEEKLY_VOLUME, MONTHLY_BUDGET_PAISE + CREATIVE_ALLOCATION_PAISE);
    const vals = CELLS.map((c) => raised.profit[c]);
    const m = vals.reduce((a, b) => a + b, 0) / vals.length;
    const worst = Math.max(...vals.map((v) => Math.abs(v - m))) / Math.abs(m);
    expect(worst, `worst deviation at the raised budget ${(worst * 100).toFixed(1)}%`)
      .toBeLessThan(0.15);
  });

  test('no single position is systematically the place to be', () => {
    // If one tier reliably took the top and another the bottom, the round 0
    // choice would have a right answer and the grid would be decoration.
    const ranked = CELLS.slice().sort((a, b) => profit[b] - profit[a]);
    const spreadWithinTier = (tier) => {
      const vals = CELLS.filter((c) => c.startsWith(tier)).map((c) => profit[c]);
      return Math.max(...vals) / Math.min(...vals);
    };
    // Every tier has at least one cell in the top half or the bottom half —
    // no tier sweeps both ends.
    const topThree = new Set(ranked.slice(0, 3).map((c) => c.split('|')[0]));
    expect(topThree.size).toBeGreaterThan(1);

    // AND THE PURPOSE AXIS, which this guard used to ignore entirely. It only
    // ever looked at price tiers, so a systematic 9.4% lifestyle edge - every
    // lifestyle cell beating its performance twin, in all three rows - sat
    // inside the 15% band and went unseen for two commits. It was the purpose
    // effect being applied twice, once by PURPOSE_MODIFIERS and once by the
    // query set's baskets and returns. Fixed at the modifier; guarded here.
    const side = (purpose) => CELLS.filter((c) => c.endsWith(purpose))
      .reduce((a, c) => a + profit[c], 0);
    const tilt = side('lifestyle') / side('performance');
    expect(tilt, `lifestyle/performance ${tilt.toFixed(3)}x`).toBeGreaterThan(0.9);
    expect(tilt, `lifestyle/performance ${tilt.toFixed(3)}x`).toBeLessThan(1.1);
    expect(new Set(ranked.slice(0, 3).map((c) => c.split('|')[1])).size).toBe(2);
    for (const tier of ['value', 'mid', 'premium']) {
      expect(spreadWithinTier(tier), tier).toBeLessThan(1.35);
    }
  });

  test('WEEKLY_VOLUME is pinned from ABOVE, and this is the invariant that does it', () => {
    // I1 bounds the market from below - too small and the budget never binds.
    // Nothing bounded it from above, so the constant could have been set to
    // anything large and I1 would have stayed green. This is the other jaw.
    //
    // A bigger market puts more cells against their budget cap, and the cap is
    // FLAT while break-evens differ 2.7x top to bottom, so it bites Value and
    // Premium by very different amounts and the positions stop balancing.
    //
    //   volume    I1 spend   I3 worst deviation
    //   330000      0.857           6.0%     I1 fails
    //   430000      1.000          11.3%     both hold
    //   460000      1.000          14.9%     both hold, barely
    //   500000      1.000          19.6%     I3 fails
    //
    // So WEEKLY_VOLUME is governed by two invariants that disagree, and sits
    // in the window between them rather than above a single floor. F14 moved
    // the window from about 315,000-375,000 to 395,000-460,000, by lowering
    // AD_RANK_FLOOR after the return level rose — and this probe with it, from
    // 400,000, which now sits comfortably inside.
    const inflated = playBalanced(500000).profit;
    const values = CELLS.map((c) => inflated[c]);
    const centre = values.reduce((a, b) => a + b, 0) / values.length;
    const deviation = Math.max(...values.map((v) => Math.abs(v - centre))) / Math.abs(centre);
    expect(deviation, `at 500000 the spread is ${(deviation * 100).toFixed(1)}%`)
      .toBeGreaterThan(0.15);
  });

  test.todo('a separate, cheaper test: does one capex choice dominate all positions?');
});

describe('I4 — the axes stay in their lanes', () => {
  const be = (price, purpose) => breakEvenCpcPaise(
    businessFor({ price, purpose }, EMPTY, 1),
  );

  test('purpose moves break-even under 15% within a price row', () => {
    for (const price of ['value', 'mid', 'premium']) {
      const a = be(price, 'performance');
      const b = be(price, 'lifestyle');
      expect(Math.abs(b - a) / Math.min(a, b), price).toBeLessThan(0.15);
    }
  });

  test('price moves it more than 2x top to bottom', () => {
    for (const purpose of ['performance', 'lifestyle']) {
      expect(be('premium', purpose) / be('value', purpose), purpose).toBeGreaterThan(2);
    }
  });

  test('and the REALISED figures stay in their lanes too', () => {
    // The lane that matters. I4 read constants.js only, so it measured a
    // quantity no auction ever experiences - and while it sat comfortably at
    // 5.0/9.3/11.9%, the figures an advertiser actually faced were
    // 12.2/17.0/20.5%, through the bound in two rows out of three.
    //
    // The query set was adding a second purpose effect on top of
    // PURPOSE_MODIFIERS: lifestyle territory has bigger baskets (it is full of
    // co-ord sets) and fewer returns (oversized and modal fit anybody, while
    // compression and high-impact do not). Both are TRUE, and both push the
    // same way as the modifier. So the modifier shrank rather than the content
    // being flattened to suit it. See DECISIONS F11.
    const real = (price, purpose) => realisedBreakEvenCpcPaise(
      businessFor({ price, purpose }, EMPTY, 1), QUERY_SET, { price, purpose },
    );
    for (const price of ['value', 'mid', 'premium']) {
      const a = real(price, 'performance');
      const b = real(price, 'lifestyle');
      expect(Math.abs(b - a) / Math.min(a, b), price).toBeLessThan(0.15);
    }
    for (const purpose of ['performance', 'lifestyle']) {
      expect(real('premium', purpose) / real('value', purpose), purpose).toBeGreaterThan(2);
    }
  });

  test('and the constants behind it have not drifted', () => {
    expect(POSITION_ECONOMICS.value.convRateBase).toBeGreaterThan(
      POSITION_ECONOMICS.premium.convRateBase,
    );
    expect(PURPOSE_MODIFIERS.lifestyle.ret).toBeGreaterThan(PURPOSE_MODIFIERS.performance.ret);
  });
});

describe('I5 — demand peak and intent peak must not coincide', () => {
  test('the intent peak clears every volume peak by the stated margin', () => {
    // If they coincide, dayparting earns nothing and DECISIONS H4 is false.
    const intentPeak = argmax(HOURLY_INTENT_CURVE);
    for (const [name, curve] of Object.entries(HOUR_PROFILES)) {
      const raw = Math.abs(intentPeak - argmax(curve));
      const circular = Math.min(raw, 24 - raw);
      expect(circular, name).toBeGreaterThanOrEqual(MIN_PEAK_SEPARATION_HOURS);
    }
  });
});

describe('a full game holds together', () => {
  const { finalState } = playBalanced();

  test('twelve rounds complete and the state advances to thirteen', () => {
    expect(finalState.round).toBe(TOTAL_ROUNDS + 1);
    expect(finalState.history).toHaveLength(TOTAL_ROUNDS);
  });

  test('the month resets three times, so nobody goes dark for lack of a reset', () => {
    // The bug this test exists for: monthSpentPaise accumulated across the
    // whole game against one month's allowance, so an advertiser spending its
    // full weekly budget exhausted the month in four rounds and went dark for
    // the remaining eight. Only a full game exposes it.
    for (const a of finalState.advertisers) {
      expect(a.campaign.monthSpentPaise, a.id).toBeLessThanOrEqual(a.campaign.monthlyBudgetPaise);
    }
    const spentInLastRound = finalState.history[TOTAL_ROUNDS - 1];
    const anySpend = Object.values(spentInLastRound.byAdvertiser)
      .some((r) => r.traffic.costPaise > 0);
    expect(anySpend).toBe(true);
  });

  test('month 3 allocations are redistributed by rank, and the pool is unchanged', () => {
    const total = finalState.advertisers
      .reduce((a, x) => a + x.campaign.monthlyBudgetPaise, 0);
    expect(total).toBeCloseTo(finalState.advertisers.length * MONTHLY_BUDGET_PAISE, -3);
    const budgets = finalState.advertisers.map((a) => a.campaign.monthlyBudgetPaise);
    expect(new Set(budgets).size).toBeGreaterThan(1);
  });

  test('early rounds are settled and late ones are not', () => {
    const early = finalState.history.find((h) => h.round === 3);
    const late = finalState.history.find((h) => h.round === TOTAL_ROUNDS);
    const id = finalState.advertisers[0].id;
    expect(early.revisedAtRound).not.toBeNull();
    expect(late.byAdvertiser[id].conversions.stillPending).toBeGreaterThan(0);
  });
});
