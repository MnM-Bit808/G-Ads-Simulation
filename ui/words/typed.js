/**
 * What people typed's words (design/what-people-typed/, chosen by the owner
 * 2026-09-15). The marks say where to look and never what to do (I13): a
 * search is marked for what a sale cost there, not told to be blocked.
 */

import { line } from './line.js';

const searches = (n) => (n === 1 ? `${n} search` : `${n} searches`);

export const TYPED = Object.freeze({
  summary: line('reading', ({ n, keywords, each }) => `${searches(n)} from your ${keywords} keywords, about ${each} each`,
    { why: 'broadMatch' }),
  summaryWeek: line('reading', ({ n, keywords }) => `${searches(n)} this week, from your ${keywords} keywords`,
    { why: 'broadMatch' }),
  // termsOutlook's mirror: every row is a search the player already chose to buy.
  mirrored: line('reading', ({ n }) => `${searches(n)}, one for each keyword: nothing here you did not name`,
    { why: 'broadMatch' }),
  nothingYet: line('reading', 'No search has shown your ad in these weeks.'),
  allWeeks: line('label', ({ n }) => (n === 1 ? `all ${n} week` : `all ${n} weeks`)),
  thisWeek: line('label', 'this week only'),

  search: line('label', 'Search'),
  spent: line('label', 'Spent'),
  sales: line('label', 'Sales'),
  perSale: line('label', 'Per sale'),
  cameBack: line('label', 'Came back'),
  block: line('label', 'block'),
  undo: line('label', 'undo'),
  unblock: line('label', 'unblock'),
  blocked: line('label', 'blocked'),
  blockThis: line('label', ({ text }) => `Block “${text}”`),
  unblockThis: line('label', ({ text }) => `Stop blocking “${text}”`),
  yourName: line('label', 'your name'),
  rivalName: line('label', ({ name }) => `${name}’s name`),
  dearTitle: line('label', ({ amount, average }) => `${amount} a sale, over twice your ${average} average`),
  worseTitle: line('label', ({ rate, average }) => `${rate} came back, against your ${average}`),
  legend: line('reading', ({ average, rate }) => `Amber: a sale there costs over twice your ${average} average, `
    + `or more of its sales came back than your ${rate}.`),
  // A week just played has no returns yet (they take two weeks to come back).
  legendNoReturns: line('reading', ({ average }) => `Amber: a sale there costs over twice your ${average} average.`),

  blockTitle: line('label', 'Block words'),
  blockNote: line('instruction', 'A block matches the words themselves: no plurals, no close variants.',
    { why: 'broadMatch' }),
  wordsToBlock: line('label', 'Words to block'),
  placeholder: line('instruction', 'free, near me, how to…'),
  nothingSays: line('reading', ({ text, type }) => `Nothing in the market says “${text}” on ${type}.`),
  noneBought: line('reading', ({ n }) => `Blocks ${searches(n)}, none of them bought yet.`),
  someBought: line('reading', ({ n, bought, spent, sales, never }) => `Blocks ${searches(n)}: ${bought} you have `
    + `bought, ${spent} and ${sales} sales` + (never > 0 ? `, and ${never} you never have.` : '.')),
  salesOf: line('label', ({ sales }) => `${sales} sales`),
  aSale: line('label', ({ amount }) => `${amount} a sale`),
  neverBought: line('reading', ({ list, more }) => `Never bought: ${list}` + (more > 0 ? `, and ${more} more.` : '.')),
  blockThese: line('label', ({ n }) => `Block ${searches(n)}`),
  blockedTitle: line('label', 'Blocked'),
  noneBlocked: line('reading', 'Nothing yet. Block one search from its row, or a family of them by their words.'),
  catches: line('label', ({ n }) => searches(n)),
  typeOf: line('label', ({ text, type }) => `“${text}” · ${type}`),
});
