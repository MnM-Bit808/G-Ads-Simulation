/**
 * The capital card's reading of the month just played (DECISIONS D12, option d).
 *
 * D12 measured that the second allocation is spend-or-invest, and that the
 * player's own share of impressions lost to budget decides which pays: capital
 * won in 0 of 12 markets where the budget was running out, and 35 of 36 where it
 * never did. So the card sets that figure beside the choice. It reads, and does
 * not advise, for the market card's reason (`ui/chart.js`, `readingOf`): it
 * cannot see what capital would earn this player.
 */

import { line } from './line.js';

export const CAPITAL = Object.freeze({
  lastMonth: line('reading', ({ spent, budget, lost }) =>
    `Last month you spent ${spent} of ${budget} and lost ${lost} of your impressions to budget.`),
  lastMonthNeverRanOut: line('reading', ({ spent, budget }) =>
    `Last month you spent ${spent} of ${budget}, and your budget never ran out.`),
  turnsOn: line('reading',
    'Whether this money does more as advertising or as capital turns on that figure. '
    + 'While the budget is what keeps you out of auctions, advertising money buys more of them; '
    + 'while it is not, extra advertising money goes unspent and is lost when the month ends.'),
});
