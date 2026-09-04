/**
 * The RoundReport (spec 15), and the revision that rewrites it later.
 *
 * Four things consume this: the interface renders it, controllers read it to
 * decide next round, `history` stores it, and 11.4 comes back and edits it.
 * Spec v0.2 described it four times and never specified it, which is why v0.3
 * pins the shape here.
 *
 * WHY REPORTS GET REWRITTEN
 *
 * Reports are keyed by CLICK round. A click in round 3 may not convert until
 * round 6, and the resulting return may not resolve until round 8 — so round
 * 3's report is edited twice, long after anyone looked at it.
 *
 * Numbers changing after you have read them is one of the most disorienting
 * things about a real Google Ads account, and reproducing it is worth the
 * complexity. Every derived figure that moves keeps an `AsFirstReported` twin
 * captured on first build and never touched again, so the interface can show
 * what you thought you were looking at last week beside what turned out to be
 * true.
 */

import { businessFor } from './positions.js';
import { mulRate } from './money.js';
import { buildInsights } from './insights.js';
import { SCHEMA_VERSION } from './constants.js';

/**
 * Build a fresh report for one round.
 *
 * @param {object} args
 * @param {number} args.round
 * @param {object} args.raw from runRound
 * @param {object[]} args.advertisers
 * @returns {object} RoundReport
 */
export function buildRoundReport({ round, raw, advertisers }) {
  const byAdvertiser = {};

  for (const advertiser of advertisers) {
    const r = raw.byAdvertiser[advertiser.id];
    if (!r) continue;
    const business = businessFor(advertiser.position, advertiser.capex, round);

    // Only what this round's own clicks earned. Conversions landing now from
    // EARLIER clicks belong to those earlier reports, and are applied there by
    // reviseReports.
    const ownLanded = (r.landed ?? []).filter((e) => e.clickedInRound === round);
    const conversions = sum(ownLanded, (e) => e.count);
    const grossRevenuePaise = sum(ownLanded, (e) => e.valuePaise);
    const stillPending = sum(r.pendingConversions ?? [], (e) => e.count);

    const money = moneyBlock({
      costPaise: r.costPaise,
      conversions,
      grossRevenuePaise,
      returnedRevenuePaise: 0,
      marginPct: business.marginPct,
    });

    byAdvertiser[advertiser.id] = {
      traffic: {
        eligibleAuctions: r.eligibleAuctions,
        impressions: r.impressions,
        clicks: r.clicks,
        costPaise: r.costPaise,
      },
      share: {
        impressionShare: ratio(r.impressions, r.eligibleAuctions),
        lostToRank: ratio(r.lostToRank, r.eligibleAuctions),
        lostToBudget: ratio(r.lostToBudget, r.eligibleAuctions),
        topImpressionShare: ratio(r.topImpressions, r.eligibleAuctions),
        absTopImpressionShare: ratio(r.absTopImpressions, r.eligibleAuctions),
      },
      positions: { counts: [...r.positionCounts] },
      conversions: {
        asFirstReported: conversions,
        final: conversions,
        stillPending,
        returned: 0,
      },
      money: {
        ...money,
        // Captured once. Never revised. This is what you saw at the time.
        grossRoasAsFirstReported: money.grossRoas,
        netRoasAsFirstReported: money.netRoas,
        cpaAsFirstReportedPaise: money.cpaPaise,
        grossProfitAsFirstReportedPaise: money.grossProfitPaise,
      },
      budget: {
        monthlyBudgetPaise: r.monthlyBudgetPaise,
        monthSpentPaise: r.monthSpentPaise,
        monthRemainingPaise: Math.max(0, r.monthlyBudgetPaise - r.monthSpentPaise),
        weekBudgetPaise: r.weekBudgetPaise,
        dailySpendPaise: [...r.dailySpendPaise],
      },
      quality: {},
      missedToBudget: missedToBudget(r, business),
      warnings: [...(r.warnings ?? [])],
      breakdown: attributeConversions(r, ownLanded),
    };
  }

  return {
    round,
    schemaVersion: SCHEMA_VERSION,
    revisedAtRound: null,
    marketContext: { ...raw.marketContext },
    byAdvertiser,
  };
}

/**
 * The counterfactual, shaped for the report (spec 11.2).
 *
 * `profitIfFundedPaise` is the figure that matters. Sometimes the missed
 * traffic would have lost money and the correct action is to leave the budget
 * alone — a counterfactual that only reported extra clicks would tell you to
 * spend every time.
 */
function missedToBudget(r, business) {
  const cf = r.counterfactual;
  if (!cf) return null;

  const extraCost = cf.costPaise - r.costPaise;
  const ownLanded = (list) => sum(list ?? [], (e) => e.count);
  const extraConversions = ownLanded(cf.landed) - ownLanded(r.landed);
  const extraGross = sum(cf.landed ?? [], (e) => e.valuePaise)
    - sum(r.landed ?? [], (e) => e.valuePaise);
  const extraNet = mulRate(Math.max(0, extraGross), 1 - business.returnRate);

  return {
    impressions: Math.max(0, cf.impressions - r.impressions),
    clicks: Math.max(0, cf.clicks - r.clicks),
    conversions: Math.max(0, extraConversions),
    netRevenuePaise: extraNet,
    profitIfFundedPaise: mulRate(extraNet, business.marginPct) - Math.max(0, extraCost),
  };
}

/**
 * Apply this round's late arrivals to the earlier reports that earned them.
 *
 * @param {object[]} history reports, oldest first
 * @param {object} args
 * @param {number} args.currentRound
 * @param {object} args.raw this round's raw output
 * @param {object[]} args.advertisers
 * @returns {object[]} a new history array
 */
export function reviseReports(history, { currentRound, raw, advertisers }) {
  const marginByAdvertiser = new Map(advertisers.map((a) => [
    a.id, businessFor(a.position, a.capex, currentRound),
  ]));

  return history.map((report) => {
    let touched = false;
    const byAdvertiser = { ...report.byAdvertiser };

    for (const advertiser of advertisers) {
      const r = raw.byAdvertiser[advertiser.id];
      const existing = byAdvertiser[advertiser.id];
      if (!r || !existing) continue;

      // Conversions landing now, and returns resolving now, whose CLICK was in
      // the round this report covers.
      const lateLanded = (r.landed ?? []).filter((e) => e.clickedInRound === report.round);
      const lateReturns = (r.resolvedReturns ?? [])
        .filter((e) => e.clickedInRound === report.round);
      if (lateLanded.length === 0 && lateReturns.length === 0) continue;

      touched = true;
      const business = marginByAdvertiser.get(advertiser.id);
      const conversions = existing.conversions.final + sum(lateLanded, (e) => e.count);
      const returned = existing.conversions.returned + sum(lateReturns, (e) => e.count);
      const grossRevenuePaise = existing.money.grossRevenuePaise
        + sum(lateLanded, (e) => e.valuePaise);
      const returnedRevenuePaise = existing.money.returnedRevenuePaise
        + sum(lateReturns, (e) => e.valuePaise);

      const money = moneyBlock({
        costPaise: existing.traffic.costPaise,
        conversions,
        grossRevenuePaise,
        returnedRevenuePaise,
        marginPct: business.marginPct,
      });

      byAdvertiser[advertiser.id] = {
        ...existing,
        breakdown: reviseBreakdown(
          existing.breakdown, r.keywordForQuery ?? new Map(), lateLanded,
        ),
        conversions: {
          ...existing.conversions,
          final: conversions,
          returned,
          stillPending: Math.max(0, existing.conversions.stillPending - sum(lateLanded, (e) => e.count)),
        },
        money: {
          ...money,
          // The twins survive every revision. That is the point of them.
          grossRoasAsFirstReported: existing.money.grossRoasAsFirstReported,
          netRoasAsFirstReported: existing.money.netRoasAsFirstReported,
          cpaAsFirstReportedPaise: existing.money.cpaAsFirstReportedPaise,
          grossProfitAsFirstReportedPaise: existing.money.grossProfitAsFirstReportedPaise,
        },
      };
    }

    return touched
      ? { ...report, revisedAtRound: currentRound, byAdvertiser }
      : report;
  });
}

/**
 * Attach each advertiser's own reported scores to its own report row.
 *
 * Passed in rather than computed here: nothing in `engine/` may read
 * `reportedScore`, and a report module that reached for it would be exactly
 * the violation the structural test in quality.test.js exists to catch.
 *
 * @param {object} report
 * @param {object} scoresByAdvertiser {advertiserId: {keywordId: score|null}}
 * @returns {object} a new report
 */
export function attachQualityScores(report, scoresByAdvertiser) {
  const byAdvertiser = { ...report.byAdvertiser };
  for (const [id, scores] of Object.entries(scoresByAdvertiser)) {
    if (!byAdvertiser[id]) continue;
    byAdvertiser[id] = { ...byAdvertiser[id], quality: { ...scores } };
  }
  return { ...report, byAdvertiser };
}

/**
 * One advertiser's slice, which is all a controller may ever receive (R3a).
 *
 * @param {object} report
 * @param {string} advertiserId
 * @returns {object|null}
 */
export function advertiserReport(report, advertiserId) {
  const own = report.byAdvertiser[advertiserId];
  if (!own) return null;
  return {
    round: report.round,
    revisedAtRound: report.revisedAtRound,
    marketContext: { ...report.marketContext },
    ...own,
  };
}

/** Build the whole round's output: report plus every advertiser's insights. */
export function buildRoundOutput({ round, raw, advertisers }) {
  return {
    report: buildRoundReport({ round, raw, advertisers }),
    insights: buildInsights(raw.pairwise, raw.byAdvertiser),
  };
}

// ---------------------------------------------------------------------------

/**
 * The search terms report, with the column that makes it actionable.
 *
 * Spec 15.2 specifies `conversions` on both breakdown rows and the engine
 * recorded impressions, clicks and cost only — so `byQuery`, which 15.2 calls
 * the search terms report and the ONLY tool for writing negatives (8.2), could
 * tell you what a query cost and never what it earned. A policy reading it to
 * find waste blocked its own best keywords, because every row looked like a row
 * with no conversions.
 *
 * Attributed from LANDED conversions, on the same clock as every other figure
 * in the report, and revised into earlier reports as the rest arrive (11.4). So
 * a query reads as worthless for a round or two before its conversions turn up,
 * which is exactly the trap the real search terms report sets.
 *
 * @param {object} r raw accumulator for one advertiser
 * @param {Array<object>} landed this round's own landed conversions
 * @returns {{byKeyword: object, byQuery: object}}
 */
function attributeConversions(r, landed) {
  const byQuery = {};
  for (const [id, row] of r.byQuery ?? []) byQuery[id] = { ...row, conversions: 0 };
  const byKeyword = {};
  for (const [id, row] of r.byKeyword ?? []) byKeyword[id] = { ...row, conversions: 0 };

  const keywordFor = r.keywordForQuery ?? new Map();
  for (const entry of landed) {
    const queryRow = byQuery[entry.queryId];
    if (queryRow) queryRow.conversions += entry.count;
    const keywordRow = byKeyword[keywordFor.get(entry.queryId)];
    if (keywordRow) keywordRow.conversions += entry.count;
  }
  return { byKeyword, byQuery };
}

/** Add later arrivals to the breakdown rows they belong to. */
function reviseBreakdown(breakdown, keywordFor, late) {
  const byQuery = { ...breakdown.byQuery };
  const byKeyword = { ...breakdown.byKeyword };
  for (const entry of late) {
    const queryRow = byQuery[entry.queryId];
    if (queryRow) {
      byQuery[entry.queryId] = { ...queryRow, conversions: (queryRow.conversions ?? 0) + entry.count };
    }
    const keywordId = keywordFor.get(entry.queryId);
    const keywordRow = byKeyword[keywordId];
    if (keywordRow) {
      byKeyword[keywordId] = { ...keywordRow, conversions: (keywordRow.conversions ?? 0) + entry.count };
    }
  }
  return { byKeyword, byQuery };
}

function moneyBlock({ costPaise, conversions, grossRevenuePaise, returnedRevenuePaise, marginPct }) {
  const netRevenuePaise = grossRevenuePaise - returnedRevenuePaise;
  return {
    grossRevenuePaise,
    returnedRevenuePaise,
    netRevenuePaise,
    grossRoas: ratio(grossRevenuePaise, costPaise),
    netRoas: ratio(netRevenuePaise, costPaise),
    grossProfitPaise: mulRate(grossRevenuePaise, marginPct) - costPaise,
    netProfitPaise: mulRate(netRevenuePaise, marginPct) - costPaise,
    cpaPaise: conversions > 0 ? Math.round(costPaise / conversions) : null,
  };
}

function ratio(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : 0;
}

function sum(list, pick) {
  let total = 0;
  for (const item of list) total += pick(item);
  return total;
}
