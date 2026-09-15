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
 * `{ round, report, insights, raw, nextGameState }`. The report is spec 15's
 * shape, built by report.js; the insights are the six metrics per advertiser,
 * built by insights.js from the pairwise matrix. `raw` stays exposed because
 * the calibration harness and the tests want the accumulators before anyone
 * has rounded or renamed anything.
 */

import {
  ADVERTISER_COUNT, ROUNDS_PER_MONTH, POSITION_CTR_MULTIPLIERS, TOP_SLOTS,
  AUCTIONS_PER_QUERY_HOUR, MAX_SLOTS, ATTRIBUTION_LAG_DISTRIBUTION,
  LOCATION_TIERS,
  REPOSITION_COST_PAISE,
} from './constants.js';
import { assertPaise, mulRate, allocate } from './money.js';
import { substream } from './rng.js';
import { searches, DAYS_PER_WEEK, HOURS_PER_DAY } from './querySet.js';
import { isBlocked, findMatches, selectAdGroup, normalise } from './matching.js';
import { qualitySignalBase, applyHourAndNoise } from './quality.js';
import { businessFor, landingPageBonus, returnHalves } from './positions.js';
import {
  locationSharesFor, locationEffects, codShareFor,
} from './locations.js';
import { resolveAuction } from './auction.js';
import {
  estimatedConvRate, unclampedBidPaise, clampBidPaise, locationMultiplier,
} from './strategies.js';
import {
  dailyTargetPaise, pacingContext, participationFrom,
  opensNewMonth, rankAllocations, allocationForRound,
} from './pacing.js';
import { buildRoundOutput, reviseReports } from './report.js';
import {
  effectiveConvRate, expectedOrderValuePaise, orderValuePaise,
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
    .map((a) => applyBudgetAdjustments(a, round, gameState.budgetSchedule))
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

  // Spec 9.5 raises this when the AD is ungraded, not when an ungraded ad
  // happens to win something. It used to be set inside the shown branch of
  // recordAuction, so the one advertiser who most needed telling - the one
  // whose 3/3/3 default is holding it below AD_RANK_FLOOR and out of every
  // auction it enters - was the only one never told. It saw 100% lost to rank
  // and no reason for it.
  //
  // Set once per round from the entry plan, which knows before the loop runs.
  for (let i = 0; i < n; i++) {
    if (entryPlan[i].some((plan) => plan?.ungraded)) acc[i].warnings.add('ungraded_ad');
  }
  const pairwise = freshPairwise(n);
  const convAccum = advertisers.map(() => new Map());

  const auctionsPerHour = AUCTIONS_PER_QUERY_HOUR[mode];
  const entrants = [];

  // WHERE THE SEARCHES ARE (G4). Precomputed per query rather than per auction:
  // the shares depend only on the query's home cell, so this is 151 lookups
  // instead of one per resolution. `effects` is normalised against this set, so
  // the market keeps the return rate and basket size F8 documents - see
  // locations.js for what applying the raw tables would have cost.
  const shares = queries.map((query) => locationSharesFor(query));
  // Per advertiser, because each position is centred on its own country: a value
  // brand's territory is mostly towns and a premium brand's is mostly metros, and
  // measuring both against the market's average moved profit between them.
  const effectsByAdvertiser = advertisers.map((a) => locationEffects(querySet, a.position?.price));
  const tiers = LOCATION_TIERS.length;

  // WHO IS BIDDING DIFFERENTLY BY PLACE, and therefore which path the loop takes.
  //
  // Three locations are three genuinely separate auctions and the honest
  // implementation resolves three. Measured, that is 531ms against a 400ms
  // budget. But when nobody adjusts their bid by location, the entrants, their
  // bids and their quality are identical in all three - so the ladder is too,
  // everything that differs is linear in volume, and splitting the RESULT of one
  // resolution is exact rather than approximate.
  //
  // So: one ladder while the market is flat, three the moment anyone tilts. A
  // player who never touches the control pays nothing for it, and
  // `round.test.js` asserts the two paths agree when they should.
  const locationMultipliers = advertisers.map(
    (a) => LOCATION_TIERS.map((_, tier) => locationMultiplier(a.campaign.locationAdjustments, tier)),
  );
  const anyoneTargets = locationMultipliers.some((row) => row.some((m) => m !== 1));

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
            // Per location too, because impression share needs a denominator
            // from the same place as its numerator. Counted once here on both
            // paths: an advertiser is eligible everywhere its keyword matches,
            // whatever it chose to bid there. Being outbid because you bid a
            // rupee is still being outbid.
            for (let t = 0; t < tiers; t++) {
              acc[i].eligibleByLocation[t] += hourVolume * shares[q][t];
            }

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
              bidPaise: clampBidPaise(bids[i][q][hour], plan.keyword),
              // Kept unclamped, so a place's adjustment compounds with the
              // hour's before the one clamp (G4).
              _unclamped: bids[i][q][hour],
              qualitySignal: applyHourAndNoise(plan.base, hour, perAdvertiserRng[i], mode),
              _i: i,
              _volume: hourVolume * participation,
              _plan: plan,
            });
          }

          if (entrants.length === 0) continue;

          if (!anyoneTargets) {
            // FLAT MARKET: one ladder, apportioned. Exact, because nothing here
            // depends on the location.
            const { ladder } = resolveAuction(entrants);
            recordAuction({
              ladder, entrants, acc, pairwise, convAccum,
              advertisers, business, query, hour,
              shares: shares[q], effectsByAdvertiser, tiers,
              budgets, perAdvertiserRng, mode,
            });
            continue;
          }

          // SOMEBODY TILTS: three auctions, because the ladder genuinely differs
          // and apportioning would rank everyone as though they had bid the same
          // everywhere.
          for (let tier = 0; tier < tiers; tier++) {
            const share = shares[q][tier];
            if (share <= 0) continue;
            const here = [];
            for (const e of entrants) {
              const multiplier = locationMultipliers[e._i][tier];
              here.push({
                ...e,
                // Clamped once, from the unclamped hour's bid: MIN_BID_PAISE is a
                // floor on what anybody can bid, so -100% is a bid of one rupee
                // rather than no bid at all - which behaves like an off switch
                // only because a rupee sits under AD_RANK_FLOOR - and no place
                // takes a bid past MAX_BID_MULTIPLE x its keyword (G4).
                bidPaise: clampBidPaise(e._unclamped * multiplier, e._plan.keyword),
                _volume: e._volume * share,
              });
            }
            const { ladder } = resolveAuction(here);
            recordAuction({
              ladder, entrants: here, acc, pairwise, convAccum,
              advertisers, business, query, hour,
              // One tier at a time now, so the apportionment inside is the
              // identity on this tier and zero elsewhere.
              shares: onlyTier(tiers, tier), effectsByAdvertiser, tiers,
              budgets, perAdvertiserRng, mode,
            });
          }
        }
      }
    }

    for (let i = 0; i < n; i++) {
      acc[i].dailySpendPaise[day] = acc[i].spentTodayPaise;
    }
  }

  // --- settle ---------------------------------------------------------------
  const settled = settleRound({
    advertisers, business, acc, convAccum, round, perAdvertiserRng, mode,
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
      // Spec 15.2 lists both of these in the report's budget block and neither
      // was ever carried. 13.2 asks the UI for "a burn-down of remaining pot
      // against rounds remaining", and the second number did not exist.
      weeklySplitPaise: [...(a.campaign.weeklySplitPaise ?? [])],
      roundsRemainingInMonth: ROUNDS_PER_MONTH - 1 - ((round - 1) % ROUNDS_PER_MONTH),
      keywordForQuery: keywordForQuery(entryPlan[i], queries),
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

  const nextGameState = advanceState(gameState, advertisers, acc, settled, raw);

  // The counterfactual pass wants none of this: it is a hypothetical whose
  // only job is to be diffed against the real round.
  if (_isCounterfactual) return { round, raw, nextGameState };

  const { report, insights } = buildRoundOutput({ round, raw, advertisers });
  // The reviser sees only EARLIER rounds. This round's own conversions are
  // already in the report that was just built, so handing it this report too
  // would land the lag-0 share of them - 55% of the distribution - a second
  // time, and stamp a revision on a report nobody had read yet.
  nextGameState.history = [
    ...reviseReports(gameState.history ?? [], { currentRound: round, raw, advertisers }),
    report,
  ];
  nextGameState.marketContext = [...(gameState.marketContext ?? []), raw.marketContext];

  return { round, report, insights, raw, nextGameState };
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
        // The basket before any noise. Fixed for this advertiser and search
        // all round, so worked out here once rather than at every record.
        orderValuePaise: expectedOrderValuePaise(business[i], query),
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
      // Rounded to paise, as this table always was, but not clamped: the clamp
      // waits for the place's adjustment (G4). Rounding here rather than once at
      // the end keeps every bid the clamp does not touch exactly what it was.
      for (let hour = 0; hour < HOURS_PER_DAY; hour++) {
        row[hour] = Math.round(unclampedBidPaise({
          strategy: advertiser.campaign.strategy,
          strategyParams: advertiser.campaign.strategyParams,
          keyword: plan.keyword,
          business: business[i],
          bidding: hourlyBidding[hour],
          daypartAdjustments: advertiser.campaign.daypartAdjustments,
          hour,
          rng: null,
        }));
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
  advertisers, business, query, hour, shares, effectsByAdvertiser, tiers,
  budgets, perAdvertiserRng, mode,
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
    a.hourlyClicks[hour] += clicks;
    a.costPaise += cost;
    a.spentTodayPaise += cost;
    a.positionCounts[row.position - 1] += impressions;
    if (row.position <= TOP_SLOTS) a.topImpressions += impressions;
    if (row.position === 1) a.absTopImpressions += impressions;
    budgets[i].weekSpentPaise += cost;
    budgets[i].monthSpentPaise += cost;

    bump(a.byKeyword, e._plan.keyword.id, impressions, clicks, cost);
    bump(a.byQuery, query.id, impressions, clicks, cost);
    // Where this query's traffic actually was. Everything above is linear in
    // volume, so the split is exact.
    for (let t = 0; t < tiers; t++) {
      const share = shares[t];
      if (share > 0) bump(a.byLocation, t, impressions * share, clicks * share, cost * share);
    }

    // Conversions accumulate per advertiser-query and are queued once at the
    // end of the round: 1,350 queue calls instead of 226,800.
    if (clicks > 0) {
      // NOT touched by location, deliberately. Conversion already carries query
      // affinity, PURPOSE_MODIFIERS and the hourly curve, and F10 and F11 are
      // both records of what two mechanisms pushing one number costs. Where you
      // are changes the basket and the odds it comes back, not the odds of a sale.
      const convRate = effectiveConvRate({
        business: business[i], query, position: advertisers[i].position,
        advertiserId: advertisers[i].id, hour,
      });
      if (convRate > 0) {
        const base = orderValuePaise(e._plan.orderValuePaise, business[i], perAdvertiserRng[i], mode);
        const discountPaise = advertisers[i].campaign?.prepaidDiscountPaise ?? 0;
        const converted = clicks * convRate;
        // ONE BUCKET PER QUERY AND LOCATION. The basket and the return rate are
        // both per location, and they are the only two things location changes -
        // so merging the tiers here would leave the location report able to show
        // clicks and cost and nothing about what the money did, which is the
        // whole lesson. Conversion RATE is location-independent by design, so
        // the counts still divide in proportion to the clicks.
        const effects = effectsByAdvertiser[i];
        for (let t = 0; t < tiers; t++) {
          const share = shares[t];
          if (share <= 0) continue;
          const here = converted * share;
          const key = `${query.id}\u0000${t}`;
          const bucket = convAccum[i].get(key)
            ?? {
              queryId: query.id, tier: t, count: 0, valuePaise: 0,
              returnWeighted: 0, refusedWeighted: 0,
            };
          bucket.count += here;
          // The discount is paid on PREPAID orders only — that is what it is for
          // — so it costs the discount times the prepaid share of the mix it
          // just created. Flat rupees, so it is 4.2% of a value basket and 1.0%
          // of a premium one (I34).
          const prepaidShare = 1 - codShareFor(advertisers[i].position.price, t, discountPaise);
          bucket.valuePaise += here * Math.max(
            0, base * effects.aovMultiplier[t] - discountPaise * prepaidShare,
          );

          // What comes back from these orders, refused at the door or sent back
          // after it, each half with its own lever (I28, I29, I34). The arithmetic
          // is `returnHalves`, so the prepaid card's forecast is this line and
          // not a copy of it.
          const back = returnHalves({
            business: business[i],
            queryReturnMultiplier: query.returnRateMultiplier ?? 1,
            placeReturnMultiplier: effects.returnMultiplier[t],
            price: advertisers[i].position.price,
            tierIndex: t,
            discountPaise,
          });
          bucket.returnWeighted += here * back.returned;
          // Carried so the freight on a refused parcel can be charged to the
          // round that earned it. Weighted the same way, because a bucket is a
          // cohort and not a single order.
          bucket.refusedWeighted += here * back.refused;
          convAccum[i].set(key, bucket);
        }
        // Kept separately from the money buckets, which are per query because
        // order value and return rate are. This one is per hour and counts
        // only, which is all the hour-of-day history needs.
        a.hourlyConv[hour] += converted;
      }
    }

    shown.push({ i, impressions, plan: e._plan, position: row.position });
  }

  recordPairwise(pairwise, ladder, byId, shown);
  recordQualityRows(acc, shown);
}

/**
 * Which keyword each query was matched through, this round.
 *
 * One advertiser matches one query through one ad group per round (8.6), so
 * this is a property of the entry plan rather than of any single auction, and
 * it is read straight off the plan once - 151 entries - instead of being
 * rewritten inside the hot loop.
 *
 * It WAS written in the loop, which in sampled mode meant roughly 600,000
 * Map.set calls per round all storing the same value, and cost the round about
 * 1.3 seconds of CPU. The measurement that caught it is the one in
 * round.test.js, which only started reporting honestly once it stopped timing
 * a wall clock under contention.
 */
function keywordForQuery(plans, queries) {
  const map = new Map();
  for (let q = 0; q < queries.length; q++) {
    if (plans[q]) map.set(queries[q].id, plans[q].keyword.id);
  }
  return map;
}

/**
 * A share vector that is all of one tier and none of the others.
 *
 * Lets `recordAuction` keep one shape whichever path the loop took: on the flat
 * path it is handed the query's real split, and on the targeted path a resolution
 * that already belongs entirely to one place.
 *
 * Cached because the loop asks for it up to 75,600 times a round and there are
 * only ever three answers.
 */
const ONLY_TIER = new Map();
function onlyTier(tiers, tier) {
  const key = `${tiers}:${tier}`;
  let vector = ONLY_TIER.get(key);
  if (!vector) {
    vector = new Array(tiers).fill(0);
    vector[tier] = 1;
    Object.freeze(vector);
    ONLY_TIER.set(key, vector);
  }
  return vector;
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

function settleRound({ advertisers, business, acc, convAccum, round, perAdvertiserRng, mode }) {
  return advertisers.map((advertiser, i) => {
    // Queue this round's conversions behind the attribution lag.
    const queued = [];
    for (const bucket of convAccum[i].values()) {
      if (bucket.count <= 0) continue;
      queued.push(...queueConversions({
        clicks: bucket.count,
        convRate: 1,
        orderValuePaise: Math.round(bucket.valuePaise / bucket.count),
        // Already the cohort's own rate for this query in this location, so no
        // averaging is left to do here.
        returnRate: bucket.returnWeighted / bucket.count,
        // What share of THIS bucket's returns never got through the door. Rides
        // along so a resolved return can say how much freight it owes.
        refusedShare: bucket.returnWeighted > 0
          ? bucket.refusedWeighted / bucket.returnWeighted
          : 0,
        round,
        rng: perAdvertiserRng[i],
        mode,
        queryId: bucket.queryId,
        locationTier: bucket.tier,
      }));
    }

    const allPending = [...(advertiser.pendingConversions ?? []), ...queued];
    const { landed, remaining } = landDueConversions(allPending, round);

    const returns = queueReturns(landed, round, business[i].returnWindowRounds);
    const allReturns = [...(advertiser.pendingReturns ?? []), ...returns];
    const { resolved, remaining: remainingReturns } = resolveReturns(allReturns, round);

    // The same lag, applied to a count per hour of day. At most 24 x 4 entries
    // in flight, which is why this is a separate queue rather than an hour
    // stamped onto every per-query conversion: that would be 150 x 24 x 4.
    const allHourly = [...(advertiser.pendingHourly ?? []), ...queueHourly(acc[i].hourlyConv, round)];
    const landedHourly = allHourly.filter((e) => e.dueRound <= round);
    const pendingHourly = allHourly.filter((e) => e.dueRound > round);

    return {
      landed,
      resolvedReturns: resolved,
      pendingConversions: remaining,
      pendingReturns: remainingReturns,
      landedHourly,
      pendingHourly,
      qualityRow: finaliseQualityRows(acc[i].qualityRows, round),
    };
  });
}

/**
 * Spread one round's hourly conversion counts across the attribution lag.
 *
 * Conversions have to reach the hour-of-day history on the SAME clock as the
 * aggregate. If they arrived at click time the hourly branch would read 100%
 * of the truth while observedConvRate read 55%, and an advertiser crossing
 * MIN_HOUR_OBSERVATIONS would see its belief jump for a reason invisible to
 * it — bypassing the lag that is the whole lesson of spec 12.2.
 *
 * @param {number[]} hourlyConv 24 click-time conversion counts
 * @param {number} round the click round
 * @returns {Array<{dueRound: number, hour: number, count: number}>}
 */
function queueHourly(hourlyConv, round) {
  const out = [];
  for (const [lag, share] of ATTRIBUTION_LAG_DISTRIBUTION.entries()) {
    for (let hour = 0; hour < HOURS_PER_DAY; hour++) {
      const count = hourlyConv[hour] * share;
      if (count > 0) out.push({ dueRound: round + lag, hour, count });
    }
  }
  return out;
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
    advertisers: gameState.advertisers.map((a) => {
      if (a.id !== advertiserId) return a;
      // THE REMAINING pot, not the whole one. Spec 11.2 and DECISIONS G1 both
      // say "raised to its remaining monthly pot", and this used to zero
      // monthSpentPaise instead - which hands back the entire month and asks
      // what the advertiser could have earned with money it does not have.
      // In week four of a month that is 90% spent, that is ten times the real
      // answer, and missedToBudget is a teaching output whose whole value is
      // being believable.
      //
      // Keeping monthSpentPaise intact also keeps the month cap binding during
      // the pass (13.2), so the hypothetical obeys the one ceiling that is not
      // negotiable.
      const remaining = Math.max(
        0, a.campaign.monthlyBudgetPaise - (a.campaign.monthSpentPaise ?? 0),
      );
      return {
        ...a,
        campaign: {
          ...a.campaign,
          weeklySplitPaise: new Array(ROUNDS_PER_MONTH).fill(remaining),
        },
      };
    }),
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

/**
 * What a structural decision does to the month's ad budget (spec 13.3, 4.5).
 *
 * Two adjustments, both landing in the round the decision was taken, which for
 * both is the first round of a month. They are applied AFTER the decision is
 * merged, because the decision is what creates them, and they persist for the
 * rest of the month because advanceCampaign only rewrites monthlyBudgetPaise
 * at a boundary.
 *
 * CAPEX NOT COMMITTED becomes ad budget. Without this, capital investment is
 * free and taking the maximum every time is strictly dominant - the three
 * round delay was carrying the whole of "not investing is viable" by itself.
 * With it, a non-investor's spend rises in months 1 and 2 and falls back in
 * month 3, which D8 records as a real and deliberate confound and is the
 * reason marketContext exists.
 *
 * REPOSITIONING is charged. 4.5 says the cost is drawn from the month 2
 * budget; the constant existed and nothing read it.
 *
 * THE WEEKLY SPLIT IS RESPREAD, and that is a judgement call worth naming. The
 * month is the hard cap but the WEEK is what pacing actually binds on, so
 * raising the cap alone would leave the rollover unreachable and the mechanic
 * inert. The split keeps its shape - allocate() spreads the new total across
 * the old weights - so a front-loaded plan stays front-loaded. It is
 * idempotent for a split that already sums to the month, which is what a
 * caller aware of the rollover would submit.
 *
 * @param {object} advertiser after its decision has been applied
 * @param {number} round
 * @param {object} schedule gameState.budgetSchedule
 * @returns {object} the advertiser, unchanged when nothing applies
 */
function applyBudgetAdjustments(advertiser, round, schedule) {
  let delta = 0;
  let capex = advertiser.capex;

  if ((schedule?.capexAllocationRounds ?? []).includes(round)) {
    const unspent = capex?.remainingUnallocatedPaise ?? 0;
    if (unspent > 0) {
      assertPaise(unspent, 'capex.remainingUnallocatedPaise');
      delta += unspent;
      // Banked, so a four round month cannot claim it four times.
      capex = { ...capex, remainingUnallocatedPaise: 0 };
    }
  }

  if (advertiser.position?.repositionedAtRound === round) {
    delta -= REPOSITION_COST_PAISE;
  }

  if (delta === 0) return advertiser;

  const campaign = advertiser.campaign;
  const monthlyBudgetPaise = Math.max(0, campaign.monthlyBudgetPaise + delta);
  const weights = campaign.weeklySplitPaise ?? [];
  const weeklySplitPaise = weights.length > 0 && weights.some((w) => w > 0)
    ? allocate(monthlyBudgetPaise, weights)
    : weights;

  return {
    ...advertiser,
    capex,
    campaign: { ...campaign, monthlyBudgetPaise, weeklySplitPaise },
  };
}

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
  const nextRound = gameState.round + 1;
  const schedule = gameState.budgetSchedule ?? {};

  // Month 3's split is decided by rank on cumulative gross profit through the
  // snapshot round, and captured THERE rather than read later, because history
  // keeps being revised and "as reported at round 8" has to mean at round 8.
  let rankedIds = schedule.rankedAtSnapshot ?? null;
  if (gameState.round === (schedule.rankSnapshotRound ?? 8)) {
    rankedIds = rankByGrossProfit(gameState.history, raw, advertisers, gameState.round);
  }

  const rankAllocation = rankedIds ? rankAllocations(rankedIds) : null;
  const newMonth = opensNewMonth(nextRound);

  return {
    ...gameState,
    round: nextRound,
    budgetSchedule: { ...schedule, rankedAtSnapshot: rankedIds },
    advertisers: gameState.advertisers.map((original) => {
      const entry = byId.get(original.id);
      if (!entry) return original;
      const { a, settled: s } = entry;
      const rawRow = raw.byAdvertiser[original.id];

      return {
        ...a,
        campaign: advanceCampaign(a.campaign, rawRow, nextRound, newMonth, rankAllocation, a.id),
        pendingConversions: s.pendingConversions,
        pendingReturns: s.pendingReturns,
        bidding: updateBidding(a.bidding, s.landed, entry.acc, s.landedHourly),
        pendingHourly: s.pendingHourly,
        qualityHistory: appendQualityHistory(a.qualityHistory, s.qualityRow),
      };
    }),
  };
}

/**
 * Carry a campaign into the next round, resetting it if a month turns over.
 *
 * There is no carry-over (spec 13.2): unspent money is lost and the new
 * allocation starts clean. Without the reset, `monthSpentPaise` accumulates
 * across the whole game against one month's allowance, and an advertiser
 * spending its full weekly budget exhausts the month inside four rounds and
 * goes dark for the remaining eight. Nothing shorter than a full game exposes
 * that, which is why it survived until calibration.
 *
 * The weekly split resets to an even quarter of the new allocation. A player
 * who wants it uneven resubmits one; the caller's decision overrides this.
 */
function advanceCampaign(campaign, rawRow, nextRound, newMonth, rankAllocation, advertiserId) {
  if (!newMonth) {
    return { ...campaign, monthSpentPaise: rawRow.monthSpentPaise };
  }
  const monthlyBudgetPaise = allocationForRound(nextRound, advertiserId, rankAllocation);
  return {
    ...campaign,
    monthlyBudgetPaise,
    monthSpentPaise: 0,
    weeklySplitPaise: allocate(monthlyBudgetPaise, new Array(ROUNDS_PER_MONTH).fill(1)),
  };
}

/**
 * Rank advertisers on cumulative gross profit across every round so far, as
 * the reports stand right now (spec 13.1).
 *
 * Gross, not net, and provisional rather than settled — both deliberate. An
 * advertiser managing to this number buys traffic that converts well and comes
 * straight back, and a round-8 click shows all of its cost against about half
 * of its revenue. Cumulative rather than the snapshot round alone, so going
 * dark before the deadline costs the profit those rounds would have made
 * (DECISIONS D4).
 */
function rankByGrossProfit(history, raw, advertisers, round) {
  const totals = new Map(advertisers.map((a) => [a.id, 0]));

  for (const report of history ?? []) {
    for (const [id, row] of Object.entries(report.byAdvertiser)) {
      if (totals.has(id)) totals.set(id, totals.get(id) + row.money.grossProfitPaise);
    }
  }
  // This round's own report is not in history yet.
  const { report } = buildRoundOutput({ round, raw, advertisers });
  for (const [id, row] of Object.entries(report.byAdvertiser)) {
    if (totals.has(id)) totals.set(id, totals.get(id) + row.money.grossProfitPaise);
  }

  return [...totals.entries()]
    .sort((x, y) => (y[1] - x[1]) || (x[0] < y[0] ? -1 : 1))
    .map(([id]) => id);
}

/**
 * Observed history is written from LANDED conversions only.
 *
 * A conversion that has not arrived cannot inform a bid, which is precisely
 * why bid strategies look broken when checked too early (DECISIONS D2).
 *
 * THE DENOMINATOR IS EVERY CLICK EVER PAID FOR, and that asymmetry is the
 * whole lesson. Clicks are charged the moment they happen; their conversions
 * arrive over the following three rounds. So an account's observed rate opens
 * at roughly 55% of its true rate and climbs for three rounds before it means
 * anything. A strategy reading it at round 2 is not broken, it is uninformed,
 * and there is no way to tell those apart from inside the account.
 *
 * Cumulative rather than windowed. A trailing window would respond to a real
 * change in the business, but on a twelve-round game with a three-round lag
 * any window short enough to respond is too thin to be worth reading. The cost
 * is that an advertiser is anchored to its own past for a long time, which is
 * also true of the real thing.
 *
 * Null until the first click, so COLD_START_CONV_RATE still governs an account
 * that has never run.
 *
 * @param {object} bidding the advertiser's own bidding block
 * @param {Array<object>} landed conversions that arrived this round
 * @param {number} clicks this round's clicks, fractional
 * @returns {object} a new bidding block
 */
function updateBidding(bidding, landed, acc, landedHourly) {
  let count = 0;
  for (const e of landed) count += e.count;
  const observedConversions = (bidding.observedConversions ?? 0) + count;
  const observedClicks = (bidding.observedClicks ?? 0) + acc.clicks;
  return {
    ...bidding,
    observedConversions,
    observedClicks,
    observedConvRate: observedClicks > 0 ? observedConversions / observedClicks : null,
    observedByHour: updateHourly(bidding.observedByHour, acc.hourlyClicks, landedHourly),
    learningRoundsRemaining: Math.max(0, (bidding.learningRoundsRemaining ?? 0) - 1),
  };
}

/**
 * Cumulative clicks and LANDED conversions, per hour of day (spec 12.2, D2).
 *
 * This is the only legitimate route to dayparting for a bid strategy. v0.1 let
 * Target CPA read the true hourly conversion curve, so automation dayparted
 * perfectly from round one and never paid for the privilege. Here it has to
 * accumulate MIN_HOUR_OBSERVATIONS clicks in an hour before its own history
 * for that hour outweighs its aggregate — so early on it dayparts badly, which
 * is the honest version.
 *
 * @param {Array<{clicks: number, conversions: number}>|null} previous
 * @param {number[]} hourlyClicks this round's clicks by hour
 * @param {Array<{hour: number, count: number}>} landedHourly conversions arriving now
 * @returns {Array<{clicks: number, conversions: number}>}
 */
function updateHourly(previous, hourlyClicks, landedHourly) {
  const out = [];
  for (let hour = 0; hour < HOURS_PER_DAY; hour++) {
    const before = previous?.[hour] ?? { clicks: 0, conversions: 0 };
    out.push({ clicks: before.clicks + hourlyClicks[hour], conversions: before.conversions });
  }
  for (const e of landedHourly ?? []) out[e.hour].conversions += e.count;
  return out;
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
    hourlyClicks: new Array(HOURS_PER_DAY).fill(0),
    hourlyConv: new Array(HOURS_PER_DAY).fill(0),
    dailySpendPaise: new Array(DAYS_PER_WEEK).fill(0),
    spentTodayPaise: 0,
    byKeyword: new Map(),
    byQuery: new Map(),
    // Keyed by tier index. `report.js` turns it into something a person reads;
    // accumulating it here is free, and there is nowhere else it could happen.
    byLocation: new Map(),
    eligibleByLocation: new Array(LOCATION_TIERS.length).fill(0),
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
