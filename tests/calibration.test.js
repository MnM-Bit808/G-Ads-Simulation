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
import { makeGameState } from './fixtures/gameState.js';
import { homeCell } from '../engine/querySet.js';
import {
  allCells, parseCell, businessFor, breakEvenCpcPaise, realisedBreakEvenCpcPaise,
} from '../engine/positions.js';
import { allocate } from '../engine/money.js';
import { QUERY_SET } from '../content/querySet.js';
import {
  MONTHLY_BUDGET_PAISE, ROUNDS_PER_MONTH, TOTAL_ROUNDS, HOUR_PROFILES,
  HOURLY_INTENT_CURVE, MIN_PEAK_SEPARATION_HOURS, POSITION_ECONOMICS,
  PURPOSE_MODIFIERS, AD_RANK_FLOOR, WEEKLY_VOLUME, PROVENANCE,
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
function balancedState() {
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
        monthlyBudgetPaise: MONTHLY_BUDGET_PAISE,
        monthSpentPaise: 0,
        weeklySplitPaise: allocate(MONTHLY_BUDGET_PAISE, new Array(ROUNDS_PER_MONTH).fill(1)),
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
  return { ...base, advertisers };
}

/** Play a full game and return cumulative net profit per cell, settled rounds only. */
function playBalanced() {
  let s = balancedState();
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

describe('I1 — budget must bind', () => {
  test('an advertiser alone against passive rivals can exhaust its month', () => {
    // Scoped to ONE advertiser deliberately. The original wording asked that
    // all nine exhaust simultaneously, and the first live round showed the low
    // spenders were being outranked rather than starved of market. An
    // advertiser losing 39% of impressions to rank should spend less; testing
    // all nine measures competition, not market size.
    const state = makeGameState();
    const solo = {
      ...state,
      advertisers: state.advertisers.map((a, i) => (i === 0 ? {
        ...a,
        adGroups: [{
          ...a.adGroups[0],
          keywords: a.adGroups[0].keywords.map((k) => ({
            ...k, matchType: 'broad', bidPaise: k.bidPaise * 3,
          })),
        }],
      } : { ...a, active: false })),
    };

    let s = solo;
    let spent = 0;
    for (let r = 1; r <= ROUNDS_PER_MONTH; r++) {
      const out = runRound(s, { mode: 'expected' });
      spent += out.raw.byAdvertiser[state.advertisers[0].id].costPaise;
      s = out.nextGameState;
    }
    // It must be ABLE to spend a serious fraction of the month. If the market
    // cannot absorb the money, lostToBudget never fires, missedToBudget is
    // always zero, and the whole of section 13 does nothing.
    expect(spent / MONTHLY_BUDGET_PAISE).toBeGreaterThan(0.5);
  });

  test('WEEKLY_VOLUME is still marked provisional', () => {
    expect(PROVENANCE.WEEKLY_VOLUME).toBe('CALIBRATE');
    expect(WEEKLY_VOLUME).toBe(225000);
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
    expect(AD_RANK_FLOOR).toBe(60);
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
