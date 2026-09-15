/**
 * Your week's words (design/your-week/, chosen by the owner 2026-09-15). The
 * six figures keep today's card's names; the chart says where each week stood
 * "before week N ran", the owner's words, because the game knows that and not
 * when you looked.
 */

import { line } from './line.js';

/** "week 5", "weeks 1 to 4", or "weeks 1, 3 and 4" (ui/week/read.js, weeksOf). */
function weeksSaid(weeks) {
  if (weeks.kind === 'one') return `week ${weeks.week}`;
  if (weeks.kind === 'run') return `weeks ${weeks.from} to ${weeks.to}`;
  return `weeks ${weeks.list.join(', ')} and ${weeks.last}`;
}
const between = (weeks) => (weeks.kind === 'one' ? '' : ' between them');

/** "2nd", "3rd", "4th"; the first position is "top". */
function ordinal(n) {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  if (n % 10 === 1) return `${n}st`;
  if (n % 10 === 2) return `${n}nd`;
  if (n % 10 === 3) return `${n}rd`;
  return `${n}th`;
}

export const WEEK = Object.freeze({
  spend: line('label', 'Spend'),
  clicks: line('label', ({ clicks, n }) => (n === 1 ? `${clicks} click` : `${clicks} clicks`)),
  cpc: line('label', 'Avg CPC'),
  impressions: line('label', ({ impressions, n }) => (n === 1 ? `${impressions} impression` : `${impressions} impressions`)),
  conversions: line('label', 'Conversions'),
  toArrive: line('label', ({ pending }) => `${pending} still to arrive`),
  netProfit: line('label', 'Net profit'),
  returnsNotIn: line('label', 'returns not in yet'),
  netRoas: line('label', 'Net ROAS'),
  gross: line('label', ({ roas }) => `gross ${roas}`),
  cpa: line('label', 'CPA'),
  perConversion: line('label', 'per conversion'),

  weeksTitle: line('label', 'Every week so far'),
  weeksSub: line('label', ({ week }) => `net profit by week · the dashed tick is where it stood before week ${week} ran`),
  weeksSubFirst: line('label', 'net profit by week'),
  replay: line('instruction', 'replay the revision'),
  thisWeek: line('label', 'this week'),
  // Each "as" only when its count moved (ui/week/read.js): a rise or a fall
  // on its own proves nothing about why.
  rose: line('reading', ({ weeks, amount, landed }) => {
    let as = '';
    if (landed === 1) as = ` as ${landed} more conversion landed`;
    else if (landed > 1) as = ` as ${landed} more conversions landed`;
    return `${weeksSaid(weeks)} rose ${amount}${between(weeks)}${as}`;
  }),
  fell: line('reading', ({ weeks, amount, returned }) => `${weeksSaid(weeks)} fell ${amount}${between(weeks)}`
    + (returned > 0 ? ' as returns came back' : '')),
  whileRan: line('reading', ({ week, rose, fell }) => `While week ${week} ran, ${[rose, fell].filter(Boolean).join(', and ')}.`,
    { why: 'attributionLag' }),
  nothingMoved: line('reading', ({ week }) => `While week ${week} ran, no earlier week moved.`, { why: 'attributionLag' }),
  first: line('reading', 'This is your first week, so there is nothing earlier for it to move.', { why: 'attributionLag' }),

  shareTitle: line('label', 'Where the impressions went', { why: 'rankOrBudget' }),
  shown: line('label', 'shown'),
  lostToBudget: line('label', 'lost to budget'),
  lostToRank: line('label', 'lost to rank'),
  onThePage: line('label', 'where you showed on the page'),
  position: line('label', ({ n }) => (n === 1 ? 'top' : ordinal(n))),

  // Only a game saved before 2026-09-14 has its own words still to land (I11).
  copyPending: line('reading', ({ week, score, scale }) => `Your own ad goes live in week ${week}. Until then the `
    + `auctions run an unwritten ad, graded ${score} out of ${scale}.`, { why: 'writers' }),
  copyLanded: line('reading', 'Your own ad went live this week: if clicks jumped, look there first.', { why: 'writers' }),
});
