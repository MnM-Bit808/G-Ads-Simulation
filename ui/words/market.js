/**
 * The market card's and Auction Insights' readings of the week the market
 * re-splits (DECISIONS D12, C8).
 *
 * After C8's fix, rivals carry their second capital allocation through month 2
 * and fall back to rank-based budgets when month 3 begins: the whole market
 * spends a median 26% less that week, and rivals move 3.97 times an ordinary
 * week in the player's Auction Insights (3.78 before I46, 3.53 when C9 landed,
 * 4.19 before it). Every figure clears D12's gate of double. The sentences
 * below quote none of them: they carry the week's live figures. The rule is
 * public
 * (announced at round 1, D4); who ranked where and anyone's budget are not
 * (R3), so these name the rule and the public figures, and never a rival's
 * money.
 */

import { line } from './line.js';

export const MARKET = Object.freeze({
  thisWeek: line('label', 'This week'),
  lastWeek: line('label', 'Last week'),
  newMonth: line('reading', ({ month, snapshot, spent, before }) =>
    `Month ${month} began this week: every advertiser's budget was re-split by the week ${snapshot} `
    + `ranking, and the whole market spent ${spent}, against ${before} last week.`),
  moved: line('reading', ({ movers }) => `Moved most in your auctions this week: ${movers.join('; ')}.`),
  mover: line('label', ({ name, from, to }) => `${name}, from ${from} to ${to} of them`),
  nobodyMoved: line('reading', 'None of your rivals moved much in your auctions this week.'),
});
