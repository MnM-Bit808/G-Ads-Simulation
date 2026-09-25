/**
 * How everybody is doing, read rather than drawn (spec 16).
 *
 * This was the trends chart: six metrics, nine advertisers, week by week. The
 * switch-over's part 2 (2026-09-16) deleted the drawing — the Studio's Market
 * area shows each rival as a card instead (ui/rivals/), by the owner's choice
 * of 2026-09-15, and deliberately does NOT plot a rival's lines, which the
 * chart's own warning below explains. What is left is the reading the Studio
 * asks for: who is above you most, which moves are real, and what your share
 * means.
 *
 * WHAT THIS MAY SHOW, AND WHY THE ANSWER IS SHORT
 *
 * R3 forbids reading another advertiser's bid, budget, cost, quality signals,
 * conversions, margins or position economics. Auction Insights is the entire
 * legal surface, and it carries exactly Google's six Search metrics — so those
 * six are what this draws, and there is nothing else it COULD draw. A chart of
 * rival spend or rival profit is not a feature this project has not got round
 * to; it is the thing the simulator's honesty rests on not existing.
 *
 * Three of the six are per-advertiser and plot for all nine. Three are pairwise
 * — "you against them" — so they plot eight lines and never one for yourself,
 * because "you against you" is not a quantity `insightsFor` computes and a flat
 * line for it would be invented data.
 *
 * WHAT IT REFUSES TO CALL A LEADERBOARD
 *
 * The lead in this game is cumulative gross profit (13.1), and that is exactly
 * what cannot be shown. The temptation is to let impression share stand in for
 * it, and `DECISIONS.md` F12 is the measurement of why not: an advertiser read
 * 100% impression share for twelve rounds while rivals took 69% of its profit
 * through price. It was winning every auction and losing the game. So the card
 * is headed "share of impressions", says most-visible is not winning ON the
 * chart rather than under it, and carries §16's warning that overlap rate is
 * the single most misread number in the report — a warning a TIME SERIES makes
 * more necessary, not less, because a rising line reads as a rival growing when
 * it may only mean you both broadened into the same queries.
 */

/**
 * How saturated counts as saturated, and how lopsided counts as lopsided.
 *
 * Display judgement, not economics — they decide which SENTENCE is shown and
 * nothing about what any number is. They live here rather than in
 * `constants.js` for the reason DECISIONS I6 gives: the orphan check does not
 * read `ui/`, so a display-only constant there is a constant nothing reads.
 */
const SATURATED_SHARE = 0.9;
const LOPSIDED = 2;

/**
 * What the market is doing to you, read back in words.
 *
 * ASKED FOR AFTER PLAYING: "I still don't get the rationale behind the graph."
 * The card explained what each metric IS and warned what it is NOT, and never
 * said what to DO with it — so the reading was left to the player, which is the
 * skill the chart exists to teach rather than to assume.
 *
 * EVERY FACT HERE IS ONE A REAL ADVERTISER COULD SEE. It comes from
 * `insightsFor(...).self` and the six legal rival metrics: no profit, no spend,
 * no conversions, nothing R3 withholds. That constraint is not a limitation
 * here — the most useful reading in the game is available inside it, because
 * "am I losing to rank or to budget" is answerable from your own report alone
 * and points at completely different fixes.
 *
 * @param {object[]} insights one entry per round, keyed by advertiser id
 * @param {string} playerId
 * @param {Map<string, string>} names
 * @returns {null | object} null before a week has been played
 */
export function marketOutlook(insights, playerId, names) {
  const latest = insights?.[insights.length - 1]?.[playerId];
  if (!latest?.self) return null;

  const { impressionShare, lostToRank, lostToBudget } = latest.self;

  // Which constraint is actually binding. A player who is never outranked and
  // keeps running out of money has a budget problem wearing a rank problem's
  // clothes, and the two want opposite responses.
  let constraint = 'both';
  if (impressionShare >= SATURATED_SHARE) constraint = 'saturated';
  else if (lostToBudget > lostToRank * LOPSIDED) constraint = 'budget';
  else if (lostToRank > lostToBudget * LOPSIDED) constraint = 'rank';

  const previous = insights?.[insights.length - 2]?.[playerId];
  const change = previous?.self
    ? impressionShare - previous.self.impressionShare
    : null;

  // Two different rivals answering two different questions: who you are
  // actually competing with, and who is winning the auctions you share.
  //
  // WINNING THEM IN THE MOST OF YOUR AUCTIONS, not the most often when you
  // meet. Ranked by `positionAboveRate` alone it named a rival in 2% of the
  // player's auctions, above it in 74% of that 2%, over one in 96% of them and
  // above in 70% (found drawing the Market area). Overlap times position-above
  // is the share of all the auctions you showed in where that rival sat above
  // you, and both figures are Auction Insights'.
  const rivals = Object.entries(latest.rivals ?? {});
  const best = (value) => rivals.reduce(
    (top, [id, r]) => (top === null || value(r) > top.rate
      ? { id, name: names?.get(id) ?? id, rate: value(r) }
      : top),
    null,
  );

  return {
    constraint,
    impressionShare,
    lostToRank,
    lostToBudget,
    change,
    meetMost: best((r) => r.overlapRate),
    aboveYouMost: best((r) => r.overlapRate * r.positionAboveRate),
  };
}

/**
 * The smallest change in a rival's overlap worth naming: five points of the
 * player's auctions, AS PRINTED. Below it, a week-to-week wobble. A display
 * threshold, kept in the view (DECISIONS I6). Judged on the rounded figures the
 * screen shows, so a rival shown going from 45% to 40% is never said to have
 * stayed put (found drawing the Market area: 0.4498 to 0.402 was "no move").
 */
const MIN_MOVE = 5;
const MOST_MOVERS = 3;
const printed = (rate) => Math.round(100 * rate);

/**
 * Whether a rival's rate moved enough to name: five points as printed. Shared
 * so the Studio's rival cards mark a move exactly when the sentence names one.
 *
 * @param {number} from - last week's rate, 0..1
 * @param {number} to - this week's
 * @returns {boolean}
 */
export function isMove(from, to) {
  return Math.abs(printed(to) - printed(from)) >= MIN_MOVE;
}

/**
 * The rivals whose presence in the player's auctions moved most since last week.
 *
 * Read at week 9, when month 3's budgets take effect (DECISIONS D12, C8): rivals
 * then move 3.97 times an ordinary week, measured on the market as it is since
 * I46 (3.78 before it, 3.53 when C9 landed on 2026-09-18, 4.19 before C9 made
 * ordinary weeks busier; the week-9 move itself did not change). D12's gate is
 * double, which every one of those figures clears. It says who moved and by how
 * much, from the overlap rate Auction
 * Insights shows, and never why a particular rival did: whose budget grew is
 * private (R3).
 *
 * @param {object[]} insights one entry per round, keyed by advertiser id
 * @param {string} playerId
 * @param {Map<string, string>} names
 * @returns {{id: string, name: string, from: number, to: number}[]} largest move
 *   first, at most three, only moves of at least five points as printed
 */
export function insightMovers(insights, playerId, names) {
  const before = insights?.[insights.length - 2]?.[playerId]?.rivals;
  const after = insights?.[insights.length - 1]?.[playerId]?.rivals;
  if (!before || !after) return [];
  return Object.keys(after)
    .filter((id) => id in before)
    .map((id) => ({ id, name: names?.get(id) ?? id, from: before[id].overlapRate, to: after[id].overlapRate }))
    .filter((m) => isMove(m.from, m.to))
    .sort((a, b) => Math.abs(printed(b.to) - printed(b.from)) - Math.abs(printed(a.to) - printed(a.from)))
    .slice(0, MOST_MOVERS);
}

/**
 * The whole market's spend this week against last week, from the public market
 * context (D8 put it on screen so money moving between months can be seen).
 *
 * @param {object[]} contexts `state.marketContext`, one entry per round
 * @returns {{thisWeekPaise: number, lastWeekPaise: number} | null}
 */
export function marketChange(contexts) {
  if (!contexts || contexts.length < 2) return null;
  return {
    thisWeekPaise: contexts[contexts.length - 1].totalMarketSpendPaise,
    lastWeekPaise: contexts[contexts.length - 2].totalMarketSpendPaise,
  };
}
