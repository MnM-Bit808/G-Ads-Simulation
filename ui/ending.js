/**
 * How the game came out: the totals, the standings and what the player decided.
 *
 * Twelve rounds used to stop on week 12's dashboard with a disabled button and
 * nothing else — no total, no arc, no record of what the player had actually
 * done. This file is the reading that answered that.
 *
 * IT NO LONGER DRAWS ANYTHING. Until the switch-over's part 2 (2026-09-16) it
 * also held the classic end screen, `renderEnding`; the Studio's Results area
 * draws its own four sections from the same functions (`ui/results/`), and
 * `scripts/read-playtest.js` and the market harness take the standings from
 * here too. So what is left is pure reading, which is why it reads a game
 * rather than a screen.
 *
 * WHAT IT IS ALLOWED TO SAY ABOUT THE FIELD
 *
 * `budgetSchedule.rankedAtSnapshot` is an ordered list of every advertiser by
 * cumulative gross profit. `rankOf` turns it into two integers and the array
 * goes no further, so the screen cannot show a rival's standing even by
 * accident. The player learns where THEY finished, which they can read off
 * their own month-3 budget anyway — ₹1,17,600 against ₹1,68,000 is the
 * last-place multiplier and nothing else — and 13.3 is explicit that a budget
 * swinging for reasons nobody can attribute is worse than the mechanic is
 * worth.
 *
 * WHAT IT REFUSES TO CALL FINAL
 *
 * §14: clicks in the last rounds will not have settled before the game ends,
 * and the interface must label unsettled figures as provisional rather than
 * quietly showing them as final. A week counts as settled here only when its
 * own report says nothing is still pending — derived from the data rather than
 * from a constant, which also keeps this file clear of the attribution
 * constants `tests/ui.test.js` forbids the view from naming.
 */

import { rupees, ratio } from './dom.js';
import { reviseReports } from '../engine/report.js';
import { landDueConversions, queueReturns, resolveReturns } from '../engine/attribution.js';
import { RETURNS_RESOLVE_AFTER_ROUNDS } from './dashboard.js';
import { CAPEX_ALLOCATION_PAISE, DAYPART_BLOCKS } from '../engine/constants.js';

/**
 * How many weeks past the last one the books will run the queue on before they
 * give up. A sale lands at most three weeks after its click and comes back two
 * after that, so five is the whole tail; the loop stops as soon as the queues
 * are empty and this only bounds a queue that never empties.
 */
const SETTLE_LIMIT = 8;

/**
 * The game's weeks with everything that was still in flight written into them.
 *
 * WHY THE BOOKS SETTLE (the owner's decision, 2026-09-18). A sale lands up to
 * three weeks after its click (`ATTRIBUTION_LAG_DISTRIBUTION`) and comes back
 * two weeks after that, so at the whistle the last weeks read high and nothing
 * sold after week 10 could come back at all: a finished game dropped a median
 * ₹3,46,560 of orders per advertiser, and ranked everyone on what was left.
 *
 * So the queue runs on past the last week and each arrival is written into the
 * week whose click earned it — by `reviseReports`, the engine's own reviser, at
 * the margin each week was built with (11.3), so a settled week is the week the
 * game would have reported had it kept turning. Every advertiser settles the
 * same way, which is what makes the standings like for like.
 *
 * NO AUCTION IS RE-RUN, and the game's own history is not touched: this returns
 * a copy for the books to read, so a saved game still replays to the fingerprint
 * it was saved with.
 *
 * @param {object} state the finished GameState
 * @returns {object[]} the history, settled; the same array when nothing is in flight
 */
export function settledHistory(state) {
  const advertisers = state?.advertisers ?? [];
  let history = state?.history ?? [];
  if (history.length === 0 || advertisers.length === 0) return history;

  // The window every cell's economics carry, which `results.test.js` holds to
  // each of them: asking the advertiser instead would mean deriving its
  // business here, and that reads the affinities 16.1 withholds (ui.test.js).
  const window = RETURNS_RESOLVE_AFTER_ROUNDS;
  const last = history[history.length - 1].round;
  const queues = new Map(advertisers.map((a) => [a.id, {
    pending: a.pendingConversions ?? [],
    returns: a.pendingReturns ?? [],
  }]));

  for (let round = last + 1; round <= last + SETTLE_LIMIT; round++) {
    const byAdvertiser = {};
    let moved = false;
    for (const a of advertisers) {
      const queue = queues.get(a.id);
      const { landed, remaining } = landDueConversions(queue.pending, round);
      queue.pending = remaining;
      const due = [...queue.returns, ...queueReturns(landed, round, window)];
      const { resolved, remaining: unresolved } = resolveReturns(due, round);
      queue.returns = unresolved;
      byAdvertiser[a.id] = { landed, resolvedReturns: resolved };
      if (landed.length > 0 || resolved.length > 0) moved = true;
    }
    if (moved) history = reviseReports(history, { currentRound: round, raw: { byAdvertiser }, advertisers });
    const empty = [...queues.values()].every((q) => q.pending.length === 0 && q.returns.length === 0);
    if (empty) break;
  }
  return history;
}

export const STRATEGY_NAMES = {
  manual: 'Manual CPC',
  maxClicks: 'Maximise clicks',
  targetCpa: 'Target CPA',
  targetRoas: 'Target ROAS',
  maxConv: 'Maximise conversions',
};

const CAPEX_NAMES = {
  sizeGuide: 'the size guide',
  photography: 'photography',
  landingPage: 'the landing page',
  orderConfirmation: 'order confirmation',
};

// ---------------------------------------------------------------------------
// The numbers
// ---------------------------------------------------------------------------

/**
 * Where this advertiser finished the ranking, and how many were in it.
 *
 * @param {object} state
 * @param {string} playerId
 * @returns {{position: number, of: number}|null} null before the snapshot round
 */
export function rankOf(state, playerId) {
  const ranked = state?.budgetSchedule?.rankedAtSnapshot;
  if (!Array.isArray(ranked) || ranked.length === 0) return null;
  const index = ranked.indexOf(playerId);
  return index === -1 ? null : { position: index + 1, of: ranked.length };
}

/**
 * Every advertiser, how they finished, and where they actually sat.
 *
 * THE ONE PLACE R3 IS LIFTED, and only once nothing can be done with it. For
 * twelve rounds an advertiser may not read another's performance: `getPublicView`
 * withholds it, `insightsFor` computes only Google's six Search metrics, and
 * DECISIONS I7 is the record of a trend chart that could not be a leaderboard
 * for exactly that reason. After the final round there is no decision left for
 * this to unfairly inform, and it answers the question round 0 asks and nothing
 * has ever answered: 17.1 says a rival's position is INFERRED from its ad copy
 * and never stated, so a player who read those eight ads has spent the whole
 * game not knowing whether they read them right.
 *
 * It belongs with the counterfactual and true impression share in DECISIONS
 * section G — things the simulation knows that reality cannot. A real account
 * never shows you a competitor's ROAS, and the screen says so.
 *
 * RANKED BY CONTRIBUTION MARGIN, and it did not used to be (I26).
 *
 * `netProfitPaise` is revenue after returns, times the margin that covers the
 * goods, minus what the traffic cost — contribution margin after advertising,
 * and it has been on every row of this function since it was written, computed
 * and unused. The sort was on GROSS, which counts an order that came straight
 * back as an order.
 *
 * Measured over five seeds and 45 placings, sorting on the honest number moves
 * **15 of them**, because returns take between 18% and 75% of gross depending on
 * the advertiser. In one game Halcyon finishes 2nd on gross and 6th on
 * contribution margin, having shipped 45% of what it sold back.
 *
 * `grossRank` is kept beside it ON PURPOSE. 13.1 does define the lead as gross
 * and `budgetSchedule.rankedAtSnapshot` really did allocate month 3 on it — D4
 * makes that a deliberate trap, announced at round 1. This screen is read when
 * the game is over and nothing rests on it, so it ranks honestly and shows the
 * other number beside it. Where the two disagree, the player is looking at the
 * trap they just played through, in their own figures.
 *
 * @param {object} state the final GameState
 * @returns {object[]} one row per advertiser, best first; empty before any week
 */
export function finalStandings(state) {
  // Settled, and with what each brand spent on its business taken off (the
  // owner, 2026-09-18): the tail is counted where its clicks earned it, and an
  // advertiser that built nothing had its capital turned into ad budget and
  // charged for the clicks it bought, while one that built with it paid nothing
  // here. Ranked on what the business made, so the two are comparable at last.
  const history = settledHistory(state);
  if (history.length === 0) return [];

  const rows = (state.advertisers ?? []).map((a) => {
    const { all } = gameTotals(history, a.id);
    const capitalPaise = Object.values(a.capex?.committed ?? {}).reduce((total, paise) => total + (paise ?? 0), 0);
    return {
      id: a.id,
      name: a.name,
      // Never stated anywhere before this screen (17.1).
      cell: `${a.position?.price}|${a.position?.purpose}`,
      isYou: a.controller === 'player',
      costPaise: all.costPaise,
      clicks: all.clicks,
      conversions: all.conversions,
      grossProfitPaise: all.grossProfitPaise,
      netProfitPaise: all.netProfitPaise,
      capitalPaise,
      businessProfitPaise: all.netProfitPaise - capitalPaise,
      netRoas: all.costPaise > 0 ? all.netRevenuePaise / all.costPaise : null,
      cpaPaise: all.conversions > 0 ? Math.round(all.costPaise / all.conversions) : null,
    };
  });

  // The rank month 3's budget was actually allocated on, worked out first so it
  // survives the re-sort below and can be shown against it.
  const byGross = [...rows].sort((x, y) => y.grossProfitPaise - x.grossProfitPaise);
  const grossRank = new Map(byGross.map((r, i) => [r.id, i + 1]));

  rows.sort((x, y) => y.businessProfitPaise - x.businessProfitPaise);
  for (const [i, row] of rows.entries()) {
    row.rank = i + 1;
    row.grossRank = grossRank.get(row.id);
    // What the returns took, which is the whole reason the two ranks differ.
    row.returnedShare = row.grossProfitPaise > 0
      ? 1 - (row.netProfitPaise / row.grossProfitPaise)
      : null;
  }
  return rows;
}

/**
 * Every week of the game, and the totals over them.
 *
 * Reads `state.history`, which is the copy 11.4 revises, so each week carries
 * both readings: what it said when it was first issued, and what it says now.
 *
 * @param {object[]} history
 * @param {string} playerId
 * @returns {{weeks: object[], all: object, settled: object}}
 */
export function gameTotals(history, playerId) {
  const weeks = (history ?? []).map((report) => {
    const row = report.byAdvertiser?.[playerId];
    if (!row) return null;
    return {
      round: report.round,
      impressions: row.traffic.impressions,
      clicks: row.traffic.clicks,
      costPaise: row.traffic.costPaise,
      conversions: row.conversions.final,
      stillPending: row.conversions.stillPending,
      returned: row.conversions.returned,
      grossRevenuePaise: row.money.grossRevenuePaise,
      netRevenuePaise: row.money.netRevenuePaise,
      grossProfitPaise: row.money.grossProfitPaise,
      netProfitPaise: row.money.netProfitPaise,
      grossProfitAsFirstReportedPaise: row.money.grossProfitAsFirstReportedPaise,
      // Not a constant, a fact this week reports about itself.
      settled: row.conversions.stillPending < SETTLED_EPSILON,
    };
  }).filter(Boolean);

  return {
    weeks,
    all: sum(weeks),
    settled: { ...sum(weeks.filter((w) => w.settled)), count: weeks.filter((w) => w.settled).length },
  };
}

/**
 * How close to nothing counts as nothing.
 *
 * Not a threshold anyone chose: `stillPending` decays by subtracting each late
 * landing from a fractional total, so a fully settled week lands on float
 * residue — 7.1e-15 in the run that found this — rather than on zero. A
 * hundredth of a conversion is far below anything real and far above that.
 */
const SETTLED_EPSILON = 0.01;

const SUMMED = [
  'impressions', 'clicks', 'costPaise', 'conversions', 'stillPending', 'returned',
  'grossRevenuePaise', 'netRevenuePaise', 'grossProfitPaise', 'netProfitPaise',
  'grossProfitAsFirstReportedPaise',
];

function sum(weeks) {
  const out = Object.fromEntries(SUMMED.map((key) => [key, 0]));
  for (const week of weeks) for (const key of SUMMED) out[key] += week[key] ?? 0;
  return out;
}

// ---------------------------------------------------------------------------
// What the player did
// ---------------------------------------------------------------------------

/**
 * Read `decisionLog` back as sentences (12.4).
 *
 * Each logged decision is already a diff — `toDecision` submits only what
 * moved — EXCEPT for negatives and keywords, which are submitted whole because
 * `applyDecision` replaces those lists rather than merging them. So those two
 * are diffed against the last submission, carried forward from the opening
 * account. Counting a list's length each round would report "blocked 2
 * searches" in a week where one was added.
 *
 * @param {object[]} decisionLog
 * @param {string} playerId
 * @param {{negatives: object[], keywords: object[]}} opening the account as it
 *   stood at the end of round 0
 * @returns {Array<{round: number, lines: string[]}>} weeks with nothing to say are omitted
 */
export function summariseDecisions(decisionLog, playerId, opening) {
  let negatives = opening?.negatives ?? [];
  let keywords = opening?.keywords ?? [];
  const rows = [];

  for (const entry of decisionLog ?? []) {
    if (entry.advertiserId !== playerId || !entry.decision) continue;
    const decision = entry.decision;
    const lines = [];

    if (decision.position) {
      lines.push(`Moved to ${decision.position.price} · ${decision.position.purpose}`);
    }

    if (decision.capex) {
      const committed = Object.entries(decision.capex).filter(([, paise]) => paise > 0);
      if (committed.length === 0) {
        lines.push(`Took the whole ${rupees(CAPEX_ALLOCATION_PAISE)} as advertising budget`);
      } else {
        for (const [target, paise] of committed) {
          lines.push(`Committed ${rupees(paise)} to ${CAPEX_NAMES[target] ?? target}`);
        }
      }
    }

    if (decision.campaign?.strategy) {
      const name = STRATEGY_NAMES[decision.campaign.strategy] ?? decision.campaign.strategy;
      const params = decision.campaign.strategyParams ?? {};
      // Only the target the chosen strategy reads. The other key is carried in
      // every submission and naming it would report a number that moved nothing.
      const target = decision.campaign.strategy === 'targetCpa'
        ? ` at ${rupees(params.targetCpaPaise)}`
        : (decision.campaign.strategy === 'targetRoas' ? ` at ${ratio(params.targetRoas)}` : '');
      lines.push(`Switched bidding to ${name}${target}`);
    }

    // Reported as SUBMITTED rather than diffed, unlike negatives and keywords.
    // Both of these are short fixed-length arrays whose baseline drifts without
    // a decision — `advanceCampaign` re-evens the split at every month boundary
    // — so a diff would attribute the engine's reset to the player. What they
    // sent is unambiguous and needs no baseline at all.
    if (decision.campaign?.weeklySplitPaise) {
      lines.push(`Planned the month as ${decision.campaign.weeklySplitPaise.map(rupees).join(' / ')}`);
    }

    if (decision.campaign?.daypartAdjustments) {
      const moved = decision.campaign.daypartAdjustments
        .map((percent, i) => [percent, DAYPART_BLOCKS[i]?.label ?? `block ${i}`])
        .filter(([percent]) => percent !== 0);
      lines.push(moved.length === 0
        ? 'Cleared every hour-of-day adjustment'
        : `Bid ${moved.map(([percent, label]) => `${percent > 0 ? '+' : ''}${percent}% ${label.toLowerCase()}`).join(', ')}`);
    }

    if (decision.campaign?.negatives) {
      lines.push(...diffNegatives(negatives, decision.campaign.negatives));
      negatives = decision.campaign.negatives;
    }

    const submitted = decision.adGroups?.[0]?.keywords;
    if (submitted) {
      lines.push(...diffKeywords(keywords, submitted));
      keywords = submitted;
    }

    if (lines.length > 0) rows.push({ round: entry.round, lines });
  }
  return rows;
}

const negativeKey = (n) => `${n.matchType}::${String(n.text).trim().toLowerCase()}`;

function diffNegatives(before, after) {
  const was = new Map(before.map((n) => [negativeKey(n), n]));
  const now = new Map(after.map((n) => [negativeKey(n), n]));
  const lines = [];
  for (const [key, n] of now) {
    if (!was.has(key)) lines.push(`Blocked “${n.text}” (${n.matchType})`);
  }
  for (const [key, n] of was) {
    if (!now.has(key)) lines.push(`Stopped blocking “${n.text}”`);
  }
  return lines;
}

function diffKeywords(before, after) {
  const was = new Map(before.map((k) => [k.id, k]));
  const lines = [];

  for (const keyword of after) {
    const old = was.get(keyword.id);
    if (!old) {
      lines.push(`Added “${keyword.text}” on ${keyword.matchType} match at ${rupees(keyword.bidPaise)}`);
      continue;
    }
    if ((keyword.active !== false) !== (old.active !== false)) {
      lines.push(`${keyword.active === false ? 'Paused' : 'Resumed'} “${keyword.text}”`);
    }
    if (keyword.matchType !== old.matchType) {
      lines.push(`“${keyword.text}” to ${keyword.matchType} match`);
    }
    if (keyword.bidPaise !== old.bidPaise) {
      lines.push(`“${keyword.text}” bid ${rupees(old.bidPaise)} → ${rupees(keyword.bidPaise)}`);
    }
  }
  for (const [id, old] of was) {
    if (!after.some((k) => k.id === id)) lines.push(`Removed “${old.text}”`);
  }
  return lines;
}
