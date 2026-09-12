/**
 * The debrief's readings of a finished game (plans/2026-09-13-debrief.md).
 *
 * Pure: each function takes the game's own records and returns figures; the
 * words are `ui/words/debrief.js` and the drawing `ui/debrief/render.js`.
 *
 * TWO RULES THAT KEEP IT TRUE
 *
 * A before/after reads TRAFFIC only: clicks, spend, cost per click, impression
 * share. They are final the moment a week is reported. Conversions and returns
 * keep arriving for weeks, so a before/after on profit would mostly measure how
 * settled each of the two weeks was, and credit or blame a decision for it.
 *
 * The budget weeks are NEVER added up. Each week's `missedToBudget` imagines
 * that week alone spending the rest of the month; two weeks in one month spend
 * the same money, so a total would count it twice.
 */

import { summariseDecisions } from '../ending.js';

/** At most this many moments; more than five stops being a debrief. */
export const MAX_MOMENTS = 5;

/** The player's traffic in one week, or null when there is no such week. */
function trafficOf(report, playerId) {
  const row = report?.byAdvertiser?.[playerId];
  if (!row) return null;
  const { clicks, costPaise } = row.traffic;
  return {
    clicks,
    costPaise,
    cpcPaise: clicks > 0 ? Math.round(costPaise / clicks) : null,
    impressionShare: row.share?.impressionShare ?? 0,
  };
}

/** How far `after` moved from `before`, as a share of `before`. */
function moved(after, before) {
  if (before === 0) return after === 0 ? 0 : 1;
  return Math.abs(after - before) / before;
}

/**
 * The weeks the player changed something, each with the week before and the
 * week after.
 *
 * A candidate is a round with a player entry in the decision log that the
 * "What you did" log has words for, and a week before it to compare with.
 * `windowEnd` is the week before the player's NEXT decision, or the last
 * week: a removed change only stays removed until then, because keyword and
 * negative lists are submitted whole and carry it back in.
 *
 * @param {object} game
 * @param {object[]} game.history - reports, revised, oldest first
 * @param {object[]} game.decisionLog
 * @param {string} game.playerId
 * @param {{negatives: object[], keywords: object[]}} game.opening - the account after round 0
 * @param {number[]} game.allocationRounds - rounds capital lands in
 * @param {number} game.roundsPerMonth
 * @param {number} game.lastRound - the last week played
 * @param {{max?: number}} [options]
 * @returns {Array<{round: number, lines: string[], before: object, after: object,
 *   change: number, newMonth: boolean, capitalLanded: boolean, windowEnd: number}>}
 *   in round order
 */
export function moments({
  history, decisionLog, playerId, opening, allocationRounds = [], roundsPerMonth, lastRound,
}, { max = MAX_MOMENTS } = {}) {
  const byRound = new Map((history ?? []).map((report) => [report.round, report]));
  const decided = [...new Set((decisionLog ?? [])
    .filter((entry) => entry.advertiserId === playerId)
    .map((entry) => entry.round))].sort((a, b) => a - b);
  const words = new Map(summariseDecisions(decisionLog, playerId, opening)
    .map((row) => [row.round, row.lines]));

  const all = [];
  for (const [i, round] of decided.entries()) {
    const before = trafficOf(byRound.get(round - 1), playerId);
    const after = trafficOf(byRound.get(round), playerId);
    if (!before || !after || !words.has(round)) continue;
    const next = decided[i + 1];
    all.push({
      round,
      lines: words.get(round),
      before,
      after,
      change: Math.max(moved(after.clicks, before.clicks), moved(after.cpcPaise ?? 0, before.cpcPaise ?? 0)),
      newMonth: round > 1 && (round - 1) % roundsPerMonth === 0,
      capitalLanded: allocationRounds.includes(round),
      windowEnd: next === undefined ? lastRound : next - 1,
    });
  }

  if (all.length <= max) return all;
  const kept = new Set([...all]
    .sort((a, b) => b.change - a.change || a.round - b.round)
    .slice(0, max)
    .map((m) => m.round));
  return all.filter((m) => kept.has(m.round));
}

/**
 * What a removed decision made, over a window of weeks: the played game minus
 * the game replayed without it, each week read as it stands at the end, so
 * both have had the same time to settle.
 *
 * @param {object[]} actual - the played game's history
 * @param {object[]} without - the replayed game's history
 * @param {string} playerId
 * @param {{from: number, to: number}} window - rounds, inclusive
 * @returns {{clicks: number, costPaise: number, netProfitPaise: number}}
 */
export function windowDifference(actual, without, playerId, { from, to }) {
  const total = (history) => {
    const sum = { clicks: 0, costPaise: 0, netProfitPaise: 0 };
    for (const report of history ?? []) {
      if (report.round < from || report.round > to) continue;
      const row = report.byAdvertiser?.[playerId];
      if (!row) continue;
      sum.clicks += row.traffic.clicks;
      sum.costPaise += row.traffic.costPaise;
      sum.netProfitPaise += row.money.netProfitPaise;
    }
    return sum;
  };
  const a = total(actual);
  const w = total(without);
  return {
    clicks: a.clicks - w.clicks,
    costPaise: a.costPaise - w.costPaise,
    netProfitPaise: a.netProfitPaise - w.netProfitPaise,
  };
}

/**
 * The weeks the budget ran out, and whether more money would have paid.
 *
 * A week ran out when its `missedToBudget` imagines extra clicks. It "paid for
 * itself" when the extra traffic's `profitIfFundedPaise` is above zero, and
 * "did not pay" otherwise: breaking even is not paying either. There is no
 * total on purpose (see the header).
 *
 * @param {object[]} history
 * @param {string} playerId
 * @returns {{played: number, ranOut: number, paidFor: object[], didNotPay: object[], best: object|null}}
 *   each week `{round, clicks, profitIfFundedPaise}`
 */
export function budgetWeeks(history, playerId) {
  const ranOut = [];
  for (const report of history ?? []) {
    const missed = report.byAdvertiser?.[playerId]?.missedToBudget;
    if (missed && missed.clicks > 0) {
      ranOut.push({ round: report.round, clicks: missed.clicks, profitIfFundedPaise: missed.profitIfFundedPaise });
    }
  }
  const paidFor = ranOut.filter((w) => w.profitIfFundedPaise > 0);
  const didNotPay = ranOut.filter((w) => w.profitIfFundedPaise <= 0);
  const best = paidFor.reduce((top, w) => (!top || w.profitIfFundedPaise > top.profitIfFundedPaise ? w : top), null);
  return { played: (history ?? []).length, ranOut: ranOut.length, paidFor, didNotPay, best };
}
