/**
 * The Studio's Results area (design/results/, chosen by the owner 2026-09-15):
 * what its four sections read from a finished game.
 *
 * Pure: each function takes the game's own records and returns figures; the
 * words are ui/words/results.js and the drawing ./render.js. The debrief's
 * readings (the weeks you changed something, both replays, the budget weeks,
 * the lessons, the reveal's truth) are ui/debrief/read.js, shared with the
 * classic end screen; these are what the sections add around them.
 */

import { gameTotals, finalStandings, rankOf, summariseDecisions } from '../ending.js';
import { onlyUntouchedCapital, revealRows } from '../debrief/read.js';
import {
  CAPEX_ALLOCATION_PAISE, CAPEX_DELAY_ROUNDS, MONTHLY_BUDGET_PAISE, RANK_BUDGET_MULTIPLIERS,
} from '../../engine/constants.js';

/** A sum of paise as the whole rupees it is shown in (ui/dom.js, rupees). */
const shownPaise = (paise) => Math.round(paise / 100) * 100;

/**
 * How many sales were still on their way when the last week ran.
 *
 * A click is final SETTLES_AFTER_ROUNDS after its week: three rounds to arrive,
 * two to resolve. Weeks 8 to 12 therefore used to read high and weeks 11 and 12
 * counted no returns at all (found drawing Results, 2026-09-15). The books now
 * settle them (`settledHistory`), so this is no longer a warning — it is what
 * the sentence under the chart says was counted.
 *
 * @param {object} state the finished game
 * @param {string} playerId
 * @returns {number} sales still queued at the whistle, fractional
 */
export function lateSales(state, playerId) {
  const me = (state?.advertisers ?? []).find((a) => a.id === playerId);
  return (me?.pendingConversions ?? []).reduce((total, entry) => total + entry.count, 0);
}

/**
 * Every week of the game, for Twelve weeks' chart and its strip.
 *
 * THE TICK IS THE WEEK'S FIRST REPORT. A first report counts no returns yet
 * (they resolve in later rounds), so its net profit then was its gross, the
 * one twin the report keeps (`grossProfitAsFirstReportedPaise`); a played-game
 * test in debrief.test.js holds that. The change is the difference of the two
 * figures as shown, in whole rupees, as Your week's is.
 *
 * @param {object[]} history - `state.history`, oldest first
 * @param {string} playerId
 * @param {object} game
 * @param {object[]} game.decisionLog
 * @param {{negatives: object[], keywords: object[]}} game.opening
 * @returns {object[]} per week: `round`, `netPaise`, `beforePaise` (first report),
 *   `changePaise`, `changed` (a week the player changed something), `did`
 *   (its lines), `costPaise`, `clicks`, `impressionShare`, `lostToBudget`,
 *   `lostToRank`, `stillPending` (zero once the books have settled the tail)
 */
export function seasonBars(history, playerId, { decisionLog = [], opening }) {
  const lines = new Map(summariseDecisions(decisionLog, playerId, opening).map((row) => [row.round, row.lines]));
  const untouched = new Set(decisionLog
    .filter((e) => e.advertiserId === playerId && onlyUntouchedCapital(e.decision))
    .map((e) => e.round));
  return (history ?? []).map((report) => {
    const row = report.byAdvertiser[playerId];
    const did = untouched.has(report.round) ? [] : (lines.get(report.round) ?? []);
    return {
      round: report.round,
      netPaise: row.money.netProfitPaise,
      beforePaise: row.money.grossProfitAsFirstReportedPaise,
      changePaise: shownPaise(row.money.netProfitPaise) - shownPaise(row.money.grossProfitAsFirstReportedPaise),
      changed: did.length > 0,
      did,
      costPaise: row.traffic.costPaise,
      clicks: row.traffic.clicks,
      impressionShare: row.share?.impressionShare ?? 0,
      lostToBudget: row.share?.lostToBudget ?? 0,
      lostToRank: row.share?.lostToRank ?? 0,
      stillPending: row.conversions.stillPending,
    };
  });
}

/**
 * The twelve weeks' figures: the end screen's own totals (`gameTotals`).
 *
 * @param {object[]} history
 * @param {string} playerId
 * @returns {object} money in integer paise; `netRoas` sales after returns per
 *   rupee of clicks, null with no spend
 */
export function seasonFigures(history, playerId) {
  const { all } = gameTotals(history, playerId);
  return {
    ...all,
    netRoas: all.costPaise > 0 ? all.netRevenuePaise / all.costPaise : null,
  };
}

/** What the weeks read when each first came out, added up. */
export function firstReportsTotal(bars) {
  return bars.reduce((total, b) => total + b.beforePaise, 0);
}

/**
 * Where the capital went: each commitment, the week it was made and the week
 * it went live, and what was left to the ad budget.
 *
 * From `capex.pending`, which keeps every tranche and is never pruned. A
 * tranche made in the first allocation round was chosen at round 0.
 *
 * @param {object} advertiser - the finished game's player
 * @param {number[]} allocationRounds - `budgetSchedule.capexAllocationRounds`
 * @returns {{tranches: {target: string, paise: number, madeAt: number, liveAtRound: number}[],
 *   committedPaise: number, toBudgetPaise: number}}
 */
export function capitalReading(advertiser, allocationRounds) {
  const tranches = (advertiser.capex?.pending ?? []).map((t) => {
    const round = t.liveAtRound - CAPEX_DELAY_ROUNDS;
    return { target: t.target, paise: t.paise, madeAt: round === allocationRounds[0] ? 0 : round, liveAtRound: t.liveAtRound };
  });
  const committedPaise = Object.values(advertiser.capex?.committed ?? {}).reduce((a, p) => a + (p ?? 0), 0);
  return {
    tranches,
    committedPaise,
    toBudgetPaise: CAPEX_ALLOCATION_PAISE * allocationRounds.length - committedPaise,
  };
}

/**
 * Everyone's books: every brand ranked by net profit (I26), with each bar's
 * length a share of the largest gross profit, so the gap between a brand's two
 * bars is what returns took. A loss draws no bar; its figure says it.
 *
 * THE ONE PLACE R3 IS LIFTED, and only once nothing can be done with it
 * (`finalStandings`).
 *
 * @param {object} state - the finished game
 * @returns {object[]} `finalStandings`' rows, each with `grossShare` and `netShare`, 0-1
 */
export function booksRows(state) {
  const rows = finalStandings(state);
  const top = Math.max(1, ...rows.map((r) => r.grossProfitPaise));
  return rows.map((r) => ({
    ...r,
    grossShare: Math.max(0, r.grossProfitPaise) / top,
    netShare: Math.max(0, r.netProfitPaise) / top,
  }));
}

/**
 * Where the player finished: at week 8 on gross profit as then reported, which
 * month 3's budgets were split on (D4), and at the end on gross and on net.
 *
 * Month 3's budget is set against the middle place's, the base month: the
 * player's months 1 and 2 held capital as well, so "the ₹1,68,000 everyone
 * had" was not what they had (found drawing Results, 2026-09-15).
 *
 * @param {object} state
 * @param {string} playerId
 * @returns {{week8: {position: number, of: number}|null, grossRank: number, netRank: number,
 *   of: number, month3Paise: number, middlePaise: number, firstPaise: number, lastPaise: number}}
 */
export function finishing(state, playerId) {
  const rows = finalStandings(state);
  const mine = rows.find((r) => r.id === playerId);
  const middle = RANK_BUDGET_MULTIPLIERS[Math.floor(RANK_BUDGET_MULTIPLIERS.length / 2)];
  return {
    week8: rankOf(state, playerId),
    grossRank: mine?.grossRank ?? null,
    netRank: mine?.rank ?? null,
    of: rows.length,
    month3Paise: state.advertisers.find((a) => a.id === playerId)?.campaign?.monthlyBudgetPaise ?? null,
    middlePaise: Math.round(MONTHLY_BUDGET_PAISE * middle),
    firstPaise: Math.round(MONTHLY_BUDGET_PAISE * RANK_BUDGET_MULTIPLIERS[0]),
    lastPaise: Math.round(MONTHLY_BUDGET_PAISE * RANK_BUDGET_MULTIPLIERS[RANK_BUDGET_MULTIPLIERS.length - 1]),
  };
}

const cellOf = (key) => {
  const [price, purpose] = key.split('|');
  return { price, purpose };
};

/**
 * Where they sat, scored.
 *
 * ROUND 0'S NOTES ARE THE ANSWERS (the owner, 2026-09-15). A rival noted at
 * round 0 is scored on that note, which a guess at the end cannot overwrite;
 * the others are placed at the end. A save written before notes were kept,
 * or a game opened on the classic page, has none: every guess is the end's.
 *
 * @param {object} initial - the state before week 1
 * @param {string} playerId
 * @param {object} answers
 * @param {Record<string, string>|null} answers.notes - round 0's, rival id to square key
 * @param {Record<string, string>} answers.guesses - the end's, rival id to square key
 * @returns {{rows: object[], all: object, then: object|null, now: object|null, cellmates: string[]}}
 *   rows as `revealRows`' with `noted`; `then` the noted rivals' score, `now`
 *   the rest's with how many were placed; both null without notes
 */
export function revealReading(initial, playerId, { notes = null, guesses = {} }) {
  const given = {};
  for (const [id, key] of Object.entries(guesses ?? {})) given[id] = cellOf(key);
  for (const [id, key] of Object.entries(notes ?? {})) given[id] = cellOf(key);
  const read = revealRows(initial, playerId, given);
  const rows = read.rows.map((row) => ({ ...row, noted: Boolean(notes && notes[row.id]) }));
  const score = (list) => ({
    exact: list.filter((r) => r.result === 'exact').length,
    half: list.filter((r) => r.result === 'price' || r.result === 'purpose').length,
    of: list.length,
  });
  const later = rows.filter((r) => !r.noted);
  return {
    rows,
    all: score(rows),
    then: notes ? score(rows.filter((r) => r.noted)) : null,
    now: notes ? { ...score(later), placed: later.filter((r) => r.guess).length } : null,
    cellmates: read.cellmates,
  };
}

/**
 * The rival that met the player in the most auctions over the game: each
 * rival's share of the auctions the player showed in, averaged over the weeks,
 * from the player's own Auction Insights (R3 allows it).
 *
 * @param {object[]} insights - one per week
 * @param {string} playerId
 * @returns {{id: string, rate: number}|null}
 */
export function meetMostOverGame(insights, playerId) {
  const sums = new Map();
  for (const week of insights ?? []) {
    for (const [id, r] of Object.entries(week?.[playerId]?.rivals ?? {})) {
      const s = sums.get(id) ?? { total: 0, weeks: 0 };
      s.total += r.overlapRate ?? 0;
      s.weeks += 1;
      sums.set(id, s);
    }
  }
  let best = null;
  for (const [id, s] of sums) {
    const rate = s.total / s.weeks;
    if (!best || rate > best.rate) best = { id, rate };
  }
  return best;
}
