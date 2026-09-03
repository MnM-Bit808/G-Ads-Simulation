/**
 * One round: 168 hours, every query, every advertiser (spec 11).
 *
 * This is where the other nine modules meet. It is also the only place in the
 * engine where performance is a design constraint rather than an afterthought,
 * so the shape of the code is driven by that.
 *
 * WHY IT PRECOMPUTES
 *
 * Done naively, eligibility would be tested once per advertiser-query-hour:
 * 9 x 150 x 168 = 226,800 checks, each matching a query against ~20 keywords.
 * That is four and a half million keyword comparisons against a 400ms budget,
 * and it does not fit.
 *
 * But eligibility does not depend on the hour, and neither does most of the
 * quality signal. Both are computed once per advertiser-query — 1,350 times
 * instead of 226,800 — and the hot loop is left with one multiplication for
 * the hour, one noise draw, and the auction itself.
 *
 * A bid strategy's conversion-rate estimate is drawn once per advertiser-hour
 * rather than per auction. That is not only cheaper, it is more honest: a real
 * strategy holds a model and applies it, it does not change its mind between
 * two auctions a second apart.
 *
 * WHAT IT RETURNS
 *
 * Raw accumulators, not a RoundReport. Shaping them into the report of spec 15
 * belongs to report.js, and the pairwise matrix belongs to insights.js; both
 * are later steps. `runRound`'s return type gains its final form then.
 */

import {
  ADVERTISER_COUNT, ROUNDS_PER_MONTH, POSITION_CTR_MULTIPLIERS, TOP_SLOTS,
  AUCTIONS_PER_QUERY_HOUR, MAX_SLOTS,
} from './constants.js';
import { assertPaise, mulRate } from './money.js';
import { substream } from './rng.js';
import { searches, DAYS_PER_WEEK, HOURS_PER_DAY } from './querySet.js';
import { isBlocked, findMatches, selectAdGroup, normalise } from './matching.js';
import { qualitySignalBase, applyHourAndNoise } from './quality.js';
import { businessFor, landingPageBonus } from './positions.js';
import { resolveAuction } from './auction.js';
import { estimatedConvRate, effectiveBidPaise } from './strategies.js';
import { dailyTargetPaise, pacingContext, participationFrom } from './pacing.js';
import {
  effectiveConvRate, retentionRate, sampleOrderValuePaise,
  queueConversions, landDueConversions, queueReturns, resolveReturns,
} from './attribution.js';

const COMPONENTS = ['expectedCtr', 'adRelevance', 'landingPage'];

/**
 * Run one round.
 *
 * @param {object} gameState
 * @param {object} options
 * @param {number} [options.seed] defaults to the game's rootSeed
 * @param {'expected'|'sampled'} [options.mode]
 * @param {object} [options.decisions] pre-computed, keyed by advertiser id (R2)
 * @param {string[]} [options.counterfactualFor] advertiser ids; see 11.2
 * @param {boolean} [options._isCounterfactual] internal guard (L13)
 * @returns {{round: number, raw: object, nextGameState: object}}
 */
export function runRound(gameState, options = {}) {
  const {
    seed = gameState.rootSeed,
    mode = 'expected',
    decisions = {},
    counterfactualFor = [],
    _isCounterfactual = false,
  } = options;

  if (mode !== 'expected' && mode !== 'sampled') {
    throw new RangeError(`mode must be "expected" or "sampled", got "${mode}"`);
  }

  const round = gameState.round;
  const querySet = gameState.querySet;
  const queries = querySet.queries;
  const advertisers = gameState.advertisers
    .map((a) => applyDecision(a, decisions[a.id]))
    .filter((a) => a.active !== false);

  const n = advertisers.length;
  const perAdvertiserRng = advertisers.map((a) => substream(seed, round, a.id));

  // --- precompute -----------------------------------------------------------
  const business = advertisers.map((a) => businessFor(a.position, a.capex, round));
  const entryPlan = buildEntryPlans(advertisers, business, queries, round);
  const bids = buildBidTable(advertisers, business, entryPlan, queries, perAdvertiserRng, mode);
  const budgets = buildBudgets(advertisers, round);

  // --- accumulators ---------------------------------------------------------
  const acc = advertisers.map(() => freshAccumulator());
  const pairwise = freshPairwise(n);
  const convAccum = advertisers.map(() => new Map());

  const auctionsPerHour = AUCTIONS_PER_QUERY_HOUR[mode];
  const entrants = [];

  // --- the loop -------------------------------------------------------------
  for (let day = 0; day < DAYS_PER_WEEK; day++) {
    const dayTarget = advertisers.map((a, i) => dailyTargetPaise(
      budgets[i].weekBudgetPaise, budgets[i].weekSpentPaise, day,
    ));
    for (const a of acc) a.spentTodayPaise = 0;

    for (let hour = 0; hour < HOURS_PER_DAY; hour++) {
      // Hoisted: pacing is evaluated on the order of a million times in a
      // sampled round, and everything that depends only on the hour can be
      // computed nine times instead.
      const pacing = dayTarget.map((t) => pacingContext(t, hour));

      for (let q = 0; q < queries.length; q++) {
        const query = queries[q];
        const hourVolume = searches(querySet, query, day, hour) / auctionsPerHour;
        if (hourVolume <= 0) continue;

        for (let k = 0; k < auctionsPerHour; k++) {
          entrants.length = 0;

          for (let i = 0; i < n; i++) {
            const plan = entryPlan[i][q];
            if (!plan) continue;
            acc[i].eligibleAuctions += hourVolume;

            const monthRemaining = Math.max(
              0, budgets[i].monthlyBudgetPaise - budgets[i].monthSpentPaise,
            );
            const participation = participationFrom(
              pacing[i], acc[i].spentTodayPaise, monthRemaining,
            );

            if (participation <= 0) {
              acc[i].lostToBudget += hourVolume;
              continue;
            }
            acc[i].lostToBudget += hourVolume * (1 - participation);

            entrants.push({
              id: advertisers[i].id,
              bidPaise: bids[i][q][hour],
              qualitySignal: applyHourAndNoise(plan.base, hour, perAdvertiserRng[i], mode),
              _i: i,
              _volume: hourVolume * participation,
              _plan: plan,
            });
          }

          if (entrants.length === 0) continue;
          const { ladder } = resolveAuction(entrants);
          recordAuction({
            ladder, entrants, acc, pairwise, convAccum,
            advertisers, business, query, q, hour, day,
            budgets, perAdvertiserRng, mode,
          });
        }
      }
    }

    for (let i = 0; i < n; i++) {
      acc[i].dailySpendPaise[day] = acc[i].spentTodayPaise;
    }
  }

  // --- settle ---------------------------------------------------------------
  const settled = settleRound({
    advertisers, business, acc, convAccum, queries, round, perAdvertiserRng, mode,
  });

  const raw = {
    byAdvertiser: Object.fromEntries(advertisers.map((a, i) => [a.id, {
      ...acc[i],
      ...settled[i],
      monthlyBudgetPaise: budgets[i].monthlyBudgetPaise,
      // Already includes this round's spend: budgets[i] is accumulated inside
      // the loop because the month ceiling has to bind during it, not after.
      monthSpentPaise: budgets[i].monthSpentPaise,
      weekBudgetPaise: budgets[i].weekBudgetPaise,
    }])),
    pairwise: { ...pairwise, ids: advertisers.map((a) => a.id) },
    marketContext: buildMarketContext(acc, advertisers),
  };

  // --- the counterfactual (11.2, L13) ---------------------------------------
  if (!_isCounterfactual && counterfactualFor.length > 0) {
    for (const id of counterfactualFor) {
      const target = raw.byAdvertiser[id];
      if (!target) continue;
      target.counterfactual = runCounterfactual(gameState, options, id);
    }
  }

  return { round, raw, nextGameState: advanceState(gameState, advertisers, acc, settled, raw) };
}

// ---------------------------------------------------------------------------
// Precomputation
// ---------------------------------------------------------------------------

/**
 * For every advertiser-query pair: are they eligible, through which ad group,
 * and what is the hour-independent part of their quality signal?
 *
 * 1,350 entries for a nine-advertiser, 150-query game. The alternative is
 * 226,800 and the round misses its budget.
 */
function buildEntryPlans(advertisers, business, queries, round) {
  return advertisers.map((advertiser, i) => {
    const bonus = landingPageBonus(advertiser.capex, round);
    return queries.map((query) => {
      if (isBlocked(query, advertiser.campaign.negatives)) return null;
      const hits = findMatches(query, advertiser.adGroups);
      if (hits.length === 0) return null;

      // Ad group selection uses the hour-independent signal, so an advertiser's
      // chosen ad group cannot flip from hour to hour.
      const cache = new Map();
      const baseFor = (hit) => {
        if (cache.has(hit.adGroupId)) return cache.get(hit.adGroupId);
        const adGroup = advertiser.adGroups.find((g) => g.id === hit.adGroupId);
        const graded = withLandingBonus(adGroup.gradedQuality, bonus);
        const value = qualitySignalBase(graded, query, hit.keyword);
        cache.set(hit.adGroupId, value);
        return value;
      };

      const chosen = selectAdGroup(hits, (hit) => hit.keyword.bidPaise * baseFor(hit).base);
      const { base, components, ungraded } = baseFor(chosen);

      return {
        adGroupId: chosen.adGroupId,
        keyword: chosen.keyword,
        matchType: chosen.matchType,
        base,
        components,
        ungraded,
        // Only searches that literally were the keyword count toward the
        // reported score (spec 9.3, A4).
        literal: normalise(query.text) === normalise(chosen.keyword.text),
      };
    });
  });
}

/** Capex on the landing page adds points after grading, capped at 10 (13.3). */
function withLandingBonus(gradedQuality, bonus) {
  if (gradedQuality == null || bonus === 0) return gradedQuality;
  return { ...gradedQuality, landingPage: Math.min(10, gradedQuality.landingPage + bonus) };
}

/**
 * Every advertiser's bid for every query, hour by hour.
 *
 * The conversion-rate estimate is drawn ONCE per advertiser-hour and reused
 * across queries. Drawing per query would give one advertiser a different
 * belief about the same hour depending on which search it was looking at,
 * which is incoherent — the estimate is a property of the account, not of the
 * query it never gets to see (DECISIONS D2).
 */
function buildBidTable(advertisers, business, entryPlan, queries, rngs, mode) {
  return advertisers.map((advertiser, i) => {
    const hourlyBidding = [];
    for (let hour = 0; hour < HOURS_PER_DAY; hour++) {
      const drawn = estimatedConvRate(advertiser.bidding, hour, mode === 'sampled' ? rngs[i] : null);
      hourlyBidding.push({ ...advertiser.bidding, observedConvRate: drawn, observedByHour: null });
    }

    return queries.map((query, q) => {
      const plan = entryPlan[i][q];
      if (!plan) return null;
      const row = new Array(HOURS_PER_DAY);
      for (let hour = 0; hour < HOURS_PER_DAY; hour++) {
        row[hour] = effectiveBidPaise({
          strategy: advertiser.campaign.strategy,
          strategyParams: advertiser.campaign.strategyParams,
          keyword: plan.keyword,
          business: business[i],
          bidding: hourlyBidding[hour],
          daypartAdjustments: advertiser.campaign.daypartAdjustments,
          hour,
          rng: null,
        });
      }
      return row;
    });
  });
}

/** Which month and week this round sits in, and what is left of each. */
function buildBudgets(advertisers, round) {
  const weekIndex = (round - 1) % ROUNDS_PER_MONTH;
  return advertisers.map((a) => {
    const monthlyBudgetPaise = a.campaign.monthlyBudgetPaise;
    const split = a.campaign.weeklySplitPaise ?? [];
    const weekBudgetPaise = split[weekIndex] ?? Math.floor(monthlyBudgetPaise / ROUNDS_PER_MONTH);
    assertPaise(monthlyBudgetPaise, 'monthlyBudgetPaise');
    return {
      monthlyBudgetPaise,
      monthSpentPaise: a.campaign.monthSpentPaise ?? 0,
      weekBudgetPaise,
      weekSpentPaise: 0,
    };
  });
}

// ---------------------------------------------------------------------------
// The hot path
// ---------------------------------------------------------------------------

function recordAuction({
  ladder, entrants, acc, pairwise, convAccum,
  advertisers, business, query, q, hour, day, budgets, perAdvertiserRng, mode,
}) {
  const byId = new Map(entrants.map((e) => [e.id, e]));
  const shown = [];

  for (const row of ladder) {
    const e = byId.get(row.id);
    const i = e._i;

    if (!row.shown) {
      acc[i].lostToRank += e._volume;
      continue;
    }

    const impressions = e._volume;
    const ctr = row.qualitySignal * POSITION_CTR_MULTIPLIERS[row.position - 1];
    const clicks = impressions * ctr;
    const cost = mulRate(row.cpcPaise, clicks);

    const a = acc[i];
    a.impressions += impressions;
    a.clicks += clicks;
    a.costPaise += cost;
    a.spentTodayPaise += cost;
    a.positionCounts[row.position - 1] += impressions;
    if (row.position <= TOP_SLOTS) a.topImpressions += impressions;
    if (row.position === 1) a.absTopImpressions += impressions;
    if (e._plan.ungraded) a.warnings.add('ungraded_ad');
    budgets[i].weekSpentPaise += cost;
    budgets[i].monthSpentPaise += cost;

    bump(a.byKeyword, e._plan.keyword.id, impressions, clicks, cost);
    bump(a.byQuery, query.id, impressions, clicks, cost);

    // Conversions accumulate per advertiser-query and are queued once at the
    // end of the round: 1,350 queue calls instead of 226,800.
    if (clicks > 0) {
      const convRate = effectiveConvRate({
        business: business[i], query, position: advertisers[i].position,
        advertiserId: advertisers[i].id, hour,
      });
      if (convRate > 0) {
        const value = sampleOrderValuePaise(business[i], query, perAdvertiserRng[i], mode);
        const bucket = convAccum[i].get(query.id) ?? { count: 0, valuePaise: 0 };
        bucket.count += clicks * convRate;
        bucket.valuePaise += clicks * convRate * value;
        convAccum[i].set(query.id, bucket);
      }
    }

    shown.push({ i, impressions, plan: e._plan, position: row.position });
  }

  recordPairwise(pairwise, ladder, byId, shown);
  recordQualityRows(acc, shown);
}

function bump(map, key, impressions, clicks, cost) {
  const row = map.get(key) ?? { impressions: 0, clicks: 0, costPaise: 0 };
  row.impressions += impressions;
  row.clicks += clicks;
  row.costPaise += cost;
  map.set(key, row);
}

/** Auction Insights is computable only because the ladder keeps its losers (L3). */
function recordPairwise(pairwise, ladder, byId, shown) {
  for (const a of shown) {
    pairwise.aShown[a.i] += a.impressions;
    for (const b of shown) {
      if (a.i === b.i) continue;
      pairwise.bothShown[a.i][b.i] += a.impressions;
      if (b.position < a.position) pairwise.bAbove[a.i][b.i] += a.impressions;
    }
  }
  // Everyone who entered and did not show, from everyone who did.
  for (const row of ladder) {
    if (row.shown) continue;
    const loser = byId.get(row.id)._i;
    for (const a of shown) pairwise.aShownBnot[a.i][loser] += a.impressions;
  }
}

/**
 * Own and field components, for the reported score (spec 9.3).
 *
 * The only accumulator that reaches across advertisers: the field is the
 * impression-weighted average of every OTHER advertiser shown on the same
 * literal query, and it is what makes "above average" mean anything.
 */
function recordQualityRows(acc, shown) {
  for (const a of shown) {
    if (!a.plan.literal) continue;
    const rows = acc[a.i].qualityRows;
    const key = a.plan.keyword.id;
    let row = rows.get(key);
    if (!row) {
      row = {
        impressions: 0,
        ownSum: { expectedCtr: 0, adRelevance: 0, landingPage: 0 },
        fieldSum: { expectedCtr: 0, adRelevance: 0, landingPage: 0 },
        fieldImpressions: 0,
      };
      rows.set(key, row);
    }
    row.impressions += a.impressions;
    for (const c of COMPONENTS) row.ownSum[c] += a.impressions * a.plan.components[c];

    for (const b of shown) {
      if (b.i === a.i) continue;
      row.fieldImpressions += b.impressions;
      for (const c of COMPONENTS) row.fieldSum[c] += b.impressions * b.plan.components[c];
    }
  }
}

// ---------------------------------------------------------------------------
// Settlement
// ---------------------------------------------------------------------------

function settleRound({ advertisers, business, acc, convAccum, queries, round, perAdvertiserRng, mode }) {
  const queryById = new Map(queries.map((q) => [q.id, q]));

  return advertisers.map((advertiser, i) => {
    // Queue this round's conversions behind the attribution lag.
    const queued = [];
    for (const [queryId, bucket] of convAccum[i]) {
      if (bucket.count <= 0) continue;
      const query = queryById.get(queryId);
      queued.push(...queueConversions({
        clicks: bucket.count,
        convRate: 1,
        orderValuePaise: Math.round(bucket.valuePaise / bucket.count),
        returnRate: 1 - retentionRate(business[i], query),
        round,
        rng: perAdvertiserRng[i],
        mode,
      }));
    }

    const allPending = [...(advertiser.pendingConversions ?? []), ...queued];
    const { landed, remaining } = landDueConversions(allPending, round);

    const returns = queueReturns(landed, round, business[i].returnWindowRounds);
    const allReturns = [...(advertiser.pendingReturns ?? []), ...returns];
    const { resolved, remaining: remainingReturns } = resolveReturns(allReturns, round);

    return {
      landed,
      resolvedReturns: resolved,
      pendingConversions: remaining,
      pendingReturns: remainingReturns,
      qualityRow: finaliseQualityRows(acc[i].qualityRows, round),
    };
  });
}

function finaliseQualityRows(rows, round) {
  const out = [];
  for (const [keywordId, row] of rows) {
    if (row.impressions <= 0) continue;
    const ownComponents = {};
    const fieldComponents = {};
    for (const c of COMPONENTS) {
      ownComponents[c] = row.ownSum[c] / row.impressions;
      fieldComponents[c] = row.fieldImpressions > 0 ? row.fieldSum[c] / row.fieldImpressions : 0;
    }
    out.push({ keywordId, round, impressions: row.impressions, clicks: 0, ownComponents, fieldComponents });
  }
  return out;
}

// ---------------------------------------------------------------------------
// The counterfactual (11.2)
// ---------------------------------------------------------------------------

/**
 * Re-run the round with ONLY this advertiser's budget lifted to its remaining
 * monthly pot.
 *
 * Raising every budget, as spec v0.2 had it, measures a different and more
 * competitive market in which the missed traffic would have been more
 * expensive anyway. It answers the wrong question (W4).
 *
 * ALWAYS RUNS IN EXPECTED MODE, whatever the main pass used.
 *
 * DECISIONS G1 calls this a number the simulation knows exactly and Google can
 * only estimate. Sampling it would contradict that — you would be comparing a
 * noisy observation against a noisy hypothetical and reading the difference as
 * opportunity. The counterfactual is a question about the market, not a draw
 * from it.
 *
 * It also happens to keep a sampled round inside its performance budget:
 * sampled main plus expected counterfactual is about 1.3s, where two sampled
 * passes was 2.2s against a 1.5s ceiling.
 */
function runCounterfactual(gameState, options, advertiserId) {
  const lifted = {
    ...gameState,
    advertisers: gameState.advertisers.map((a) => (a.id !== advertiserId ? a : {
      ...a,
      campaign: {
        ...a.campaign,
        weeklySplitPaise: new Array(ROUNDS_PER_MONTH).fill(a.campaign.monthlyBudgetPaise),
        monthSpentPaise: 0,
      },
    })),
  };
  const { raw } = runRound(lifted, {
    ...options,
    mode: 'expected',
    counterfactualFor: [],
    _isCounterfactual: true,
  });
  return raw.byAdvertiser[advertiserId];
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

function applyDecision(advertiser, decision) {
  if (!decision) return advertiser;
  return {
    ...advertiser,
    campaign: { ...advertiser.campaign, ...(decision.campaign ?? {}) },
    adGroups: decision.adGroups ?? advertiser.adGroups,
  };
}

function advanceState(gameState, advertisers, acc, settled, raw) {
  const byId = new Map(advertisers.map((a, i) => [a.id, { a, acc: acc[i], settled: settled[i] }]));

  return {
    ...gameState,
    round: gameState.round + 1,
    advertisers: gameState.advertisers.map((original) => {
      const entry = byId.get(original.id);
      if (!entry) return original;
      const { a, settled: s } = entry;
      const rawRow = raw.byAdvertiser[original.id];

      return {
        ...a,
        campaign: { ...a.campaign, monthSpentPaise: rawRow.monthSpentPaise },
        pendingConversions: s.pendingConversions,
        pendingReturns: s.pendingReturns,
        bidding: updateBidding(a.bidding, s.landed),
        qualityHistory: appendQualityHistory(a.qualityHistory, s.qualityRow),
      };
    }),
  };
}

/**
 * Observed history is written from LANDED conversions only.
 *
 * A conversion that has not arrived cannot inform a bid, which is precisely
 * why bid strategies look broken when checked too early (DECISIONS D2).
 */
function updateBidding(bidding, landed) {
  let count = 0;
  for (const e of landed) count += e.count;
  const observedConversions = (bidding.observedConversions ?? 0) + count;
  return {
    ...bidding,
    observedConversions,
    learningRoundsRemaining: Math.max(0, (bidding.learningRoundsRemaining ?? 0) - 1),
  };
}

function appendQualityHistory(history, rows) {
  if (rows.length === 0) return history ?? {};
  const next = { ...(history ?? {}) };
  for (const { keywordId, ...row } of rows) {
    next[keywordId] = [...(next[keywordId] ?? []), row];
  }
  return next;
}

// ---------------------------------------------------------------------------
// Scaffolding
// ---------------------------------------------------------------------------

function freshAccumulator() {
  return {
    eligibleAuctions: 0,
    impressions: 0,
    clicks: 0,
    costPaise: 0,
    lostToRank: 0,
    lostToBudget: 0,
    topImpressions: 0,
    absTopImpressions: 0,
    positionCounts: new Array(MAX_SLOTS).fill(0),
    dailySpendPaise: new Array(DAYS_PER_WEEK).fill(0),
    spentTodayPaise: 0,
    byKeyword: new Map(),
    byQuery: new Map(),
    qualityRows: new Map(),
    warnings: new Set(),
  };
}

function freshPairwise(n) {
  const grid = () => Array.from({ length: n }, () => new Array(n).fill(0));
  return {
    aShown: new Array(n).fill(0),
    bothShown: grid(),
    bAbove: grid(),
    aShownBnot: grid(),
  };
}

function buildMarketContext(acc, advertisers) {
  let totalMarketSpendPaise = 0;
  const cpcs = [];
  for (const a of acc) {
    totalMarketSpendPaise += a.costPaise;
    if (a.clicks > 0) cpcs.push(a.costPaise / a.clicks);
  }
  cpcs.sort((x, y) => x - y);
  const medianCpcPaise = cpcs.length === 0
    ? 0
    : Math.round(cpcs[Math.floor(cpcs.length / 2)]);
  return {
    totalMarketSpendPaise,
    activeAdvertisers: advertisers.length,
    medianCpcPaise,
  };
}

export { ADVERTISER_COUNT };
