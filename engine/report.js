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

import { businessFor, refusalOutlook } from './positions.js';
import { mulRate } from './money.js';
import { buildInsights } from './insights.js';
import { SCHEMA_VERSION, RTO_FREIGHT_PAISE, LOCATION_TIERS } from './constants.js';
import { codShareFor } from './locations.js';

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
    // THIS round's clicks that have not converted yet, and no one else's.
    //
    // It used to sum the advertiser's WHOLE pending queue, which made it the
    // only field in an AdvertiserRoundReport that was not about this round's
    // cohort - `final`, `returned`, `costPaise` and every other figure here are
    // - and it broke the revision arithmetic below, which subtracts only this
    // round's late landings. The result plateaued instead of decaying: rounds
    // 3, 4 and 5 all read 42.91 for the rest of the game with nothing of their
    // own outstanding, round 8 read 130.68 (the entire account queue), and
    // summing the field across twelve reports triple-counted it.
    const stillPending = sum(
      (r.pendingConversions ?? []).filter((e) => e.clickedInRound === round),
      (e) => e.count,
    );

    const money = moneyBlock({
      costPaise: r.costPaise,
      conversions,
      grossRevenuePaise,
      returnedRevenuePaise: 0,
      marginPct: business.marginPct,
      // Nothing has come back yet — a return needs the window — so there is no
      // freight to charge in the round the click happened.
      refused: 0,
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
        refused: 0,
        sentBack: 0,
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
        // 15.2 lists both. `roundsRemainingInMonth` counts the rounds AFTER
        // this one, which is the figure 13.2's burn-down needs: what is left,
        // and how many weeks are left to spend it in.
        weeklySplitPaise: [...(r.weeklySplitPaise ?? [])],
        roundsRemainingInMonth: r.roundsRemainingInMonth ?? 0,
        dailySpendPaise: [...r.dailySpendPaise],
      },
      quality: {},
      missedToBudget: missedToBudget(r, business),
      warnings: [...(r.warnings ?? [])],
      breakdown: statedRefusals(
        withRefusals(attributeConversions(r, ownLanded), advertiser.position?.price),
        advertiser, round,
      ),
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
      // I28 build 2: how many of those never got through the door, from the
      // entries themselves rather than from a rate applied afterwards.
      const refused = (existing.conversions.refused ?? 0)
        + sum(lateReturns, (e) => e.count * (e.refusedShare ?? 0));
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
        refused,
      });

      byAdvertiser[advertiser.id] = {
        ...existing,
        breakdown: withRefusals(reviseBreakdown(
          existing.breakdown, r.keywordForQuery ?? new Map(), lateLanded, lateReturns,
        ), advertiser.position?.price),
        conversions: {
          ...existing.conversions,
          final: conversions,
          returned,
          // The half of `returned` that was never a sale (I28).
          refused,
          sentBack: returned - refused,
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
  for (const [id, row] of r.byQuery ?? []) {
    byQuery[id] = { ...row, conversions: 0, returned: 0, returnedRevenuePaise: 0 };
  }
  const byKeyword = {};
  for (const [id, row] of r.byKeyword ?? []) {
    byKeyword[id] = { ...row, conversions: 0, returned: 0, returnedRevenuePaise: 0 };
  }
  // WHERE IT HAPPENED (G4). Carries revenue as well as conversions, because
  // location changes the basket and the return rate and nothing else - a
  // breakdown of clicks alone would show three columns differing only by volume
  // and would hide the entire lesson.
  const byLocation = {};
  for (const [tier, row] of r.byLocation ?? []) {
    byLocation[tier] = {
      ...row,
      conversions: 0,
      grossRevenuePaise: 0,
      returned: 0,
      returnedRevenuePaise: 0,
      eligibleAuctions: r.eligibleByLocation?.[tier] ?? 0,
      impressionShare: ratio(row.impressions, r.eligibleByLocation?.[tier] ?? 0),
    };
  }

  const keywordFor = r.keywordForQuery ?? new Map();
  for (const entry of landed) {
    const queryRow = byQuery[entry.queryId];
    if (queryRow) queryRow.conversions += entry.count;
    const keywordRow = byKeyword[keywordFor.get(entry.queryId)];
    if (keywordRow) keywordRow.conversions += entry.count;
    const locationRow = byLocation[entry.locationTier];
    if (locationRow) {
      locationRow.conversions += entry.count;
      locationRow.grossRevenuePaise += entry.valuePaise;
    }
  }
  return { byKeyword, byQuery, byLocation };
}

/**
 * Say which of a location's returns were REFUSED and which were sent back.
 *
 * An RTO and a return are different events. One reverses a sale; the other means
 * there was never a sale — the parcel came back from the door. The engine has
 * only ever had the second, folded into `returnRate`, and
 * `LOCATION_RETURN_MULTIPLIER` exists BECAUSE of the first: its comment says
 * cash on delivery is ordinary outside the metros and COD orders come back more
 * often. The mechanism was simulated and unnamed.
 *
 * IT SPLITS, IT DOES NOT ADD. `refused + sentBack === returned`, exactly, so no
 * advertiser's economics move and no calibrated number changes. The freight an
 * RTO costs is the next change and that one does move them.
 *
 * `codShare` rides along because the player cannot judge the split without it —
 * "59% of your returns were refusals" only means something beside "78% of your
 * orders here are paid at the door".
 *
 * @param {object} byLocation rows keyed by `LOCATION_TIERS` id
 * @param {string} price the advertiser's own price tier
 * @returns {object} a new map, each row carrying refused, sentBack and codShare
 */
function withRefusals(breakdown, price) {
  if (!price) return breakdown;
  return { ...breakdown, byLocation: splitRefusals(breakdown.byLocation, price) };
}

function splitRefusals(byLocation, price) {
  const out = {};
  for (const [key, row] of Object.entries(byLocation ?? {})) {
    // KEYED BY INDEX, not by tier id. `round.js` writes `locationTier:
    // bucket.tier` and that is a position in `LOCATION_TIERS`, which is also why
    // `locationRows` reads it as `totals[tier]`. Passing the key to
    // `locationIndex` threw on "0" and took the whole report suite with it.
    const index = Number(key);
    if (!Number.isInteger(index)) { out[key] = row; continue; }
    const returned = row.returned ?? 0;
    out[key] = {
      ...row,
      // Defaulted, never overwritten: `reviseBreakdown` fills these from the
      // resolved returns, and a row that has not had any yet is all zero rather
      // than all estimate.
      refused: row.refused ?? 0,
      sentBack: row.sentBack ?? (returned - (row.refused ?? 0)),
      // The reason the two differ, which the card cannot say the split without.
      codShare: codShareFor(price, index),
    };
  }
  return out;
}

/**
 * What each place's refusal rate was that week, with no discount (I34).
 *
 * A rival's prepaid rule reads this, because it cannot count its own refusals: a
 * week's land two to five weeks after its clicks, and a controller is handed
 * only the week just played, so a count there is always zero. That is why no
 * rival ever offered a discount until this was stated.
 *
 * FROM THE PREPAID CARD'S OWN FUNCTION. `refusalOutlook` is what the card shows
 * and `returnHalves` under it is what the round books, so a rival decides on the
 * number the player decides on (R6). The cash-mix formula that used to sit here
 * was dropped for leaving out capital, purpose and the place gradient; this is
 * not that formula.
 *
 * Stated once, when the week is reported, and kept through every revision: it
 * is what the rate was, not a count of what has come back. And with no discount,
 * whatever the account offers, so a rival already offering one does not read
 * its own discount back as a reason to stop.
 *
 * @param {object} breakdown with `byLocation` rows keyed by `LOCATION_TIERS` index
 * @param {object} advertiser as it played the week: position and capex
 * @param {number} round the week the report covers
 * @returns {object} a new breakdown, each place row carrying `refusalRate`, 0..1
 */
function statedRefusals(breakdown, advertiser, round) {
  const { position, capex } = advertiser;
  if (!position?.price) return breakdown;
  const byLocation = {};
  for (const [key, row] of Object.entries(breakdown.byLocation ?? {})) {
    const index = Number(key);
    byLocation[key] = Number.isInteger(index)
      ? {
        ...row,
        refusalRate: refusalOutlook({
          position, capex, round, placeWeights: LOCATION_TIERS.map((_, t) => (t === index ? 1 : 0)),
        }),
      }
      : row;
  }
  return { ...breakdown, byLocation };
}

/** Add later arrivals to the breakdown rows they belong to. */
function reviseBreakdown(breakdown, keywordFor, late, lateReturns = []) {
  const byQuery = { ...breakdown.byQuery };
  const byKeyword = { ...breakdown.byKeyword };
  const byLocation = { ...(breakdown.byLocation ?? {}) };
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
    // Revised on the same clock as the other two (11.4). A location report that
    // was not revised would keep saying the towns never convert, which is the
    // exact trap the search terms report already sets and already corrects.
    const locationRow = byLocation[entry.locationTier];
    if (locationRow) {
      byLocation[entry.locationTier] = {
        ...locationRow,
        conversions: (locationRow.conversions ?? 0) + entry.count,
        grossRevenuePaise: (locationRow.grossRevenuePaise ?? 0) + entry.valuePaise,
      };
    }
  }

  // RETURNS ARE THE POINT OF THIS BREAKDOWN, and they arrive later than the
  // conversions they undo - a return window on top of an attribution lag. So a
  // location reads well for several rounds and is then revised downward, which
  // is exactly the shape of the mistake the mechanic exists to teach.
  for (const entry of lateReturns) {
    // I32: WHICH SEARCH SENT IT BACK. `queueReturns` has carried `queryId` on
    // every resolved return since it was written, and this loop threw it away —
    // only the location was credited. So a player could see that the towns
    // return badly and never that a SEARCH does, which left the one lever
    // available in every round (a negative) unusable on return grounds.
    //
    // 51 of the queries carry a `ret:` multiplier, from 0.85 to 1.2, so this is
    // a real spread rather than noise. Nothing here changes a total: the returns
    // already happened and were already counted against the account. This says
    // where they came from.
    const queryRow = byQuery[entry.queryId];
    if (queryRow) {
      byQuery[entry.queryId] = {
        ...queryRow,
        returned: (queryRow.returned ?? 0) + entry.count,
        returnedRevenuePaise: (queryRow.returnedRevenuePaise ?? 0) + entry.valuePaise,
      };
    }
    const returnedKeywordId = keywordFor.get(entry.queryId);
    const returnedKeywordRow = byKeyword[returnedKeywordId];
    if (returnedKeywordRow) {
      byKeyword[returnedKeywordId] = {
        ...returnedKeywordRow,
        returned: (returnedKeywordRow.returned ?? 0) + entry.count,
        returnedRevenuePaise:
          (returnedKeywordRow.returnedRevenuePaise ?? 0) + entry.valuePaise,
      };
    }

    const row = byLocation[entry.locationTier];
    if (!row) continue;
    // I28 build 2: the entry knows how much of itself never got through the
    // door, so this is a real count now rather than build 1's derived share.
    const refusedHere = entry.count * (entry.refusedShare ?? 0);
    byLocation[entry.locationTier] = {
      ...row,
      returned: (row.returned ?? 0) + entry.count,
      returnedRevenuePaise: (row.returnedRevenuePaise ?? 0) + entry.valuePaise,
      refused: (row.refused ?? 0) + refusedHere,
      sentBack: (row.sentBack ?? 0) + (entry.count - refusedHere),
    };
  }
  return { byKeyword, byQuery, byLocation };
}

/**
 * Revenue, returns, freight and ad cost turned into the money figures a report
 * carries. The engine's one definition of profit.
 *
 * Exported so a view that needs profit for a SLICE of an account — the location
 * card's "kept per click" (stage A2) — asks this rather than restating it. A
 * second copy of this arithmetic in `ui/` is the drift the interface tests exist
 * to prevent.
 *
 * @param {object} inputs
 * @param {number} inputs.costPaise - ad spend, integer paise
 * @param {number} inputs.conversions
 * @param {number} inputs.grossRevenuePaise - integer paise
 * @param {number} inputs.returnedRevenuePaise - integer paise
 * @param {number} inputs.marginPct - 0..1, the advertiser's own margin
 * @param {number} [inputs.refused] - parcels refused at the door; each costs freight
 * @returns {object} revenue, freight, ROAS, profit and CPA; money in integer paise
 */
export function moneyBlock({
  costPaise, conversions, grossRevenuePaise, returnedRevenuePaise, marginPct, refused = 0,
}) {
  const netRevenuePaise = grossRevenuePaise - returnedRevenuePaise;
  // I28 BUILD 2: THE FIRST SHIPPING COST THIS ENGINE HAS EVER HAD.
  //
  // `marginPct` absorbed freight silently, so a parcel refused at the door cost
  // nothing but revenue that never arrived — which is exactly why cash on
  // delivery looked harmless here and does not in life.
  //
  // It comes off NET profit and not gross, deliberately. Gross profit is the
  // reading where nothing came back, and if nothing came back there is no
  // freight to pay. That also sharpens D4's trap rather than softening it: the
  // metric month 3's budget is allocated on now ignores the returns AND what
  // they cost to carry.
  const rtoFreightPaise = Math.round(refused * RTO_FREIGHT_PAISE);
  return {
    grossRevenuePaise,
    returnedRevenuePaise,
    netRevenuePaise,
    rtoFreightPaise,
    grossRoas: ratio(grossRevenuePaise, costPaise),
    netRoas: ratio(netRevenuePaise, costPaise),
    grossProfitPaise: mulRate(grossRevenuePaise, marginPct) - costPaise,
    netProfitPaise: mulRate(netRevenuePaise, marginPct) - costPaise - rtoFreightPaise,
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
