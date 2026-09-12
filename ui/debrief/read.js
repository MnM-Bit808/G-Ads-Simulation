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

import { summariseDecisions, finalStandings } from '../ending.js';
import { brandNamedIn } from '../../content/brands.js';
import { LEARNING_ROUNDS } from '../../engine/constants.js';
import { STRATEGIES } from '../../engine/strategies.js';

/** At most this many moments; more than five stops being a debrief. */
export const MAX_MOMENTS = 5;

/**
 * How much of a week's impressions must go to budget or to rank before the
 * "rank or budget" lesson counts as met.
 *
 * A display threshold, not a number the game runs on, so it lives here rather
 * than in constants.js (DECISIONS I6). Ten per cent is where the loss is a
 * visible share of the week rather than rounding: below it, a player looking at
 * the impressions card would not have had a problem to fix.
 */
export const MATERIAL_LOSS = 0.10;

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
  // What the screen would round to nothing counts as nothing: a week imagining
  // a third of a click did not run out, and thirty paise did not "pay for
  // itself". Found playing, where exactly that read "0 more clicks and ₹0 kept".
  const WHOLE_CLICK = 0.5;
  const WHOLE_RUPEE_PAISE = 50;
  const ranOut = [];
  for (const report of history ?? []) {
    const missed = report.byAdvertiser?.[playerId]?.missedToBudget;
    if (missed && missed.clicks >= WHOLE_CLICK) {
      ranOut.push({ round: report.round, clicks: missed.clicks, profitIfFundedPaise: missed.profitIfFundedPaise });
    }
  }
  const paidFor = ranOut.filter((w) => w.profitIfFundedPaise >= WHOLE_RUPEE_PAISE);
  const didNotPay = ranOut.filter((w) => w.profitIfFundedPaise < WHOLE_RUPEE_PAISE);
  const best = paidFor.reduce((top, w) => (!top || w.profitIfFundedPaise > top.profitIfFundedPaise ? w : top), null);
  return { played: (history ?? []).length, ranOut: ranOut.length, paidFor, didNotPay, best };
}

// ---------------------------------------------------------------------------
// The lessons
// ---------------------------------------------------------------------------

const normalised = (text) => String(text ?? '').trim().toLowerCase();

/** Every keyword the player ever had: the opening list and every later list. */
function keywordsEver(decisionLog, playerId, opening) {
  const lists = [opening?.keywords ?? []];
  for (const entry of decisionLog ?? []) {
    if (entry.advertiserId !== playerId) continue;
    const submitted = entry.decision?.adGroups?.[0]?.keywords;
    if (submitted) lists.push(submitted);
  }
  return lists.flat();
}

/** The player's negatives as they finally stood. */
function finalNegatives(decisionLog, playerId, opening) {
  let negatives = opening?.negatives ?? [];
  for (const entry of decisionLog ?? []) {
    if (entry.advertiserId === playerId && entry.decision?.campaign?.negatives) {
      negatives = entry.decision.campaign.negatives;
    }
  }
  return negatives;
}

/** Clicks and cost per search, summed over every week. */
function termsOverGame(history, playerId) {
  const totals = new Map();
  for (const report of history ?? []) {
    const byQuery = report.byAdvertiser?.[playerId]?.breakdown?.byQuery ?? {};
    for (const [id, row] of Object.entries(byQuery)) {
      const sum = totals.get(id) ?? { clicks: 0, costPaise: 0 };
      sum.clicks += row.clicks ?? 0;
      sum.costPaise += row.costPaise ?? 0;
      totals.set(id, sum);
    }
  }
  return totals;
}

const cpcOf = ({ clicks, costPaise }) => (clicks > 0 ? Math.round(costPaise / clicks) : null);

/**
 * The six lessons, each met or not, with the player's own figures.
 *
 * "Met" means the player ran into the situation, never that they mastered it:
 * the debrief is a reading of the game, not a grade.
 *
 * @param {object} game
 * @param {object[]} game.history
 * @param {object[]} game.decisionLog
 * @param {string} game.playerId
 * @param {{negatives: object[], keywords: object[]}} game.opening
 * @param {object} game.state - the finished state: its advertisers, query set and history
 * @returns {Array<{id: string, met: boolean, figures: object|null}>}
 */
export function lessons({ history, decisionLog, playerId, opening, state }) {
  const weeks = history ?? [];
  const rowOf = (report) => report.byAdvertiser?.[playerId];

  // 1. The first week, as first reported against as it stands now.
  const first = weeks.find((r) => rowOf(r));
  const numbersMove = {
    id: 'numbersMove',
    met: Boolean(first),
    figures: first ? {
      round: first.round,
      firstReportedPaise: rowOf(first).money.grossProfitAsFirstReportedPaise,
      nowPaise: rowOf(first).money.grossProfitPaise,
    } : null,
  };

  // 2. The worst week lost to budget or to rank.
  let worst = null;
  for (const report of weeks) {
    const share = rowOf(report)?.share ?? {};
    for (const kind of ['budget', 'rank']) {
      const lost = kind === 'budget' ? share.lostToBudget ?? 0 : share.lostToRank ?? 0;
      if (!worst || lost > worst.share) worst = { round: report.round, kind, share: lost };
    }
  }
  const rankOrBudget = {
    id: 'rankOrBudget', met: Boolean(worst) && worst.share >= MATERIAL_LOSS, figures: worst,
  };

  // 3. Broad match, and the searches it bought that no keyword spelled out.
  const keywords = keywordsEver(decisionLog, playerId, opening);
  const written = new Set(keywords.map((k) => normalised(k.text)));
  const texts = new Map((state?.querySet?.queries ?? []).map((q) => [q.id, normalised(q.text)]));
  const terms = termsOverGame(weeks, playerId);
  const unwrittenTerms = [...terms].filter(([id, t]) => t.clicks > 0 && !written.has(texts.get(id))).length;
  const broadMatch = {
    id: 'broadMatch',
    met: keywords.some((k) => k.matchType === 'broad' && k.active !== false),
    figures: { unwrittenTerms, negatives: finalNegatives(decisionLog, playerId, opening).length },
  };

  // 4. Returns: the end screen's own share and ranks.
  const standing = finalStandings(state).find((r) => r.id === playerId);
  const returns = {
    id: 'returns',
    met: true,
    figures: standing
      ? { returnedShare: standing.returnedShare, rank: standing.rank, grossRank: standing.grossRank }
      : null,
  };

  // 5. Your own name, read from the words as a player would (brandOwner is withheld).
  const advertisers = state?.advertisers ?? [];
  const namesYou = (text) => brandNamedIn(text, advertisers)?.id === playerId;
  const own = { clicks: 0, costPaise: 0 };
  const other = { clicks: 0, costPaise: 0 };
  for (const [id, t] of terms) {
    const into = namesYou(texts.get(id)) ? own : other;
    into.clicks += t.clicks;
    into.costPaise += t.costPaise;
  }
  const ownName = {
    id: 'ownName',
    met: keywords.some((k) => namesYou(k.text)),
    figures: { ownCpcPaise: cpcOf(own), otherCpcPaise: cpcOf(other) },
  };

  // 6. The first switch to a strategy that predicts conversions, and its
  // learning weeks. Only those learn: manual and maximise clicks bid without a
  // conversion estimate, so a learning period cannot touch them.
  const switched = (decisionLog ?? []).find((e) => e.advertiserId === playerId
    && STRATEGIES[e.decision?.campaign?.strategy]?.predictsConversions);
  const smartBidding = {
    id: 'smartBidding',
    met: Boolean(switched),
    figures: switched
      ? { round: switched.round, strategy: switched.decision.campaign.strategy, learningWeeks: LEARNING_ROUNDS }
      : null,
  };

  return [numbersMove, rankOrBudget, broadMatch, returns, ownName, smartBidding];
}

// ---------------------------------------------------------------------------
// The reveal
// ---------------------------------------------------------------------------

/**
 * Score the player's guesses of where each rival sat.
 *
 * The truth is read from the STARTING state: the positions each round-0 ad was
 * written for. Rivals never reposition today, and reading the start means one
 * that ever did could not make the reveal disagree with its own ad.
 *
 * @param {object} initialState - the state before week 1
 * @param {string} playerId
 * @param {Object<string, {price: string, purpose: string}>} guesses - by rival id; missing is skipped
 * @returns {{rows: object[], exact: number, half: number, cellmates: string[]}}
 *   rows in alphabetical order, each `{id, name, domain, ad, truth, guess, result}`
 */
export function revealRows(initialState, playerId, guesses) {
  const advertisers = initialState?.advertisers ?? [];
  const player = advertisers.find((a) => a.id === playerId);
  const rows = advertisers
    .filter((a) => a.id !== playerId)
    .map((a) => {
      const truth = { price: a.position.price, purpose: a.position.purpose };
      const guess = guesses?.[a.id] ?? null;
      let result = 'skipped';
      if (guess) {
        const price = guess.price === truth.price;
        const purpose = guess.purpose === truth.purpose;
        result = price && purpose ? 'exact' : price ? 'price' : purpose ? 'purpose' : 'wrong';
      }
      return { id: a.id, name: a.name, domain: a.domain, ad: a.adGroups?.[0]?.ad, truth, guess, result };
    })
    .sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0));

  const sameCell = (row) => player
    && row.truth.price === player.position.price && row.truth.purpose === player.position.purpose;
  return {
    rows,
    exact: rows.filter((r) => r.result === 'exact').length,
    half: rows.filter((r) => r.result === 'price' || r.result === 'purpose').length,
    cellmates: rows.filter(sameCell).map((r) => r.name),
  };
}
