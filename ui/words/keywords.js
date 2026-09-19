/**
 * The keyword card's and the planner's words (plans/2026-09-13-studio-makeover.md,
 * section 4). Round 0 draws the card before any week has run; the weekly
 * Your keywords section adds its head, its reading panel, the card's weekly
 * parts and Adjust several (the makeover plan, Task 7).
 */

import { line } from './line.js';

const keywords = (n) => (n === 1 ? 'keyword' : 'keywords');

export const KEYWORDS = Object.freeze({
  // The section's head.
  sub: line('label', ({ count, range }) => `${count} ${keywords(count)} · ${range}`, { why: 'attributionLag' }),
  rangeWeek: line('label', ({ week }) => `week ${week}`),
  rangeAll: line('label', ({ from, to }) => (from === to ? `week ${to}` : `weeks ${from}–${to}`)),
  thisWeek: line('label', 'This week'),
  allWeeks: line('label', 'All weeks'),
  rangeLabel: line('label', 'Which weeks the figures cover'),
  adjust: line('instruction', 'Adjust several'),

  // The reading panel: what held the week back, and the levers on it.
  eyebrow: line('label', ({ week }) => `Week ${week}`),
  heldBudget: line('reading', 'Your money ran out first', { why: 'rankOrBudget' }),
  heldBoth: line('reading', 'Money and rank both held you back', { why: 'rankOrBudget' }),
  heldRank: line('reading', 'Higher-ranked ads took the auctions you lost', { why: 'rankOrBudget' }),
  heldSaturated: line('reading', 'You showed almost everywhere you could', { why: 'rankOrBudget' }),
  saidBudget: line('reading', ({ budget, rank, rankNone }) => `${budget} of the auctions you could enter went unbought. `
    + (rankNone ? 'None were lost to rank, so a higher bid would only run the money out sooner.' : `${rank} were lost to rank.`)),
  saidBoth: line('reading', ({ budget, rank }) => `${rank} were lost to rank and ${budget} went unbought: `
    + 'you are bidding for more than the budget can buy.'),
  saidRank: line('reading', ({ budget, rank }) => `${rank} of the auctions you could enter went to `
    + `higher-ranked ads, and ${budget} went unbought.`),
  saidSaturated: line('reading', ({ shown }) => `You appeared in ${shown} of the auctions you could enter. `
    + 'More now means more searches, not more money on these.'),
  spendTitle: line('label', ({ week }) => `Where week ${week}’s money went`),
  others: line('label', ({ count }) => `${count} others`),
  leverStretch: line('instruction', 'Stretch it'),
  leverStretchHow: line('instruction', 'cheaper clicks make it last; a lower bid can buy them'),
  leverAddMoney: line('instruction', 'Add to it'),
  leverAddMoneyHow: line('instruction', 'a bigger budget, in Your money'),
  leverRaise: line('instruction', 'Raise bids'),
  leverRaiseHow: line('instruction', 'a higher bid buys rank, not a lower price'),
  leverReach: line('instruction', 'Reach further'),
  leverReachHow: line('instruction', 'more searches: add a keyword, or a broader match'),

  match: line('label', 'Match type'),
  exact: line('label', 'Exact', { why: 'matchTypes' }),
  phrase: line('label', 'Phrase', { why: 'matchTypes' }),
  broad: line('label', 'Broad', { why: 'matchTypes' }),
  wasMatch: line('reading', ({ match }) => ` · was ${match}`),
  tags: line('reading', ({ list }) => `tags: ${list}`, { why: 'broadMatch' }),
  noTags: line('reading', 'no tags: broad finds nothing', { why: 'broadMatch' }),
  bid: line('label', 'Bid', { why: 'bidding' }),
  wasBid: line('reading', ({ bid }) => `was ${bid}`),
  typeBid: line('instruction', ({ keyword }) => `Type an exact bid for ${keyword}`),
  sliderLabel: line('label', ({ keyword }) => `Bid for ${keyword}, in rupees`),
  underReserve: line('reading', ({ need }) => `under the reserve: it needs ${need} to show at all`,
    { why: 'rankOrBudget' }),
  paid: line('reading', ({ cpc }) => `paid ${cpc} a click on average`),
  noClicks: line('reading', 'no clicks yet'),
  isNew: line('reading', 'new: no clicks yet'),
  newTag: line('label', 'new'),
  running: line('label', 'Running'),
  paused: line('label', 'Paused'),
  pauseTitle: line('instruction', 'Running: tap to pause'),
  resumeTitle: line('instruction', 'Paused: tap to enter auctions again'),
  clicks: line('label', 'clicks'),
  cost: line('label', 'cost'),
  conv: line('label', 'conv.'),
  qs: line('label', ({ value }) => `QS ${value}`),
  qsTitle: line('label', ({ value }) => `Quality Score ${value}`),
  qsPart: line('label', ({ value, scale, rating }) => `${value}/${scale} · ${rating}`),
  qsNote: line('reading', 'Each part is compared with everyone who showed on the same searches.',
    { why: 'qualityScore' }),
  qsNone: line('reading', ({ impressions }) => `No score yet: it needs ${impressions} impressions on its own search first.`,
    { why: 'qualityScore' }),
  above: line('label', 'above average'),
  average: line('label', 'average'),
  below: line('label', 'below average'),
  back: line('instruction', 'Back to the keyword'),
  more: line('label', 'More'),
  remove: line('instruction', 'Remove keyword'),
  cancel: line('instruction', 'Cancel'),
  select: line('label', ({ keyword }) => `Select ${keyword}`),
  addTitle: line('instruction', 'Add a keyword'),
  addHow: line('instruction', 'from the planner, or your own words'),
  plannerTitle: line('label', 'Add keywords'),
  plannerSearch: line('instruction', 'search the planner, or type your own'),
  plannerBid: line('label', 'Bid ₹'),
  plannerWeek: line('label', 'A week'),
  plannerReach: line('label', 'Reach'),
  plannerAdd: line('instruction', 'Add'),
  plannerAddAll: line('instruction', ({ n }) => `Add all ${n} shown`),
  plannerHeld: line('label', 'in account'),
  plannerOwn: line('instruction', ({ text }) => `Add “${text}” as your own`),
  plannerNote: line('reading', 'How often a search is made is public research. What it is worth to you is learned by running it.'),
  close: line('label', 'Close'),

  // Adjust several.
  selected: line('label', ({ n }) => `${n} selected`),
  setBid: line('label', 'Set bid ₹'),
  changeBy: line('label', 'Change by'),
  percent: line('label', '%'),
  matchAll: line('label', 'Match'),
  apply: line('instruction', 'Apply'),
  done: line('instruction', 'Done'),
  pickFirst: line('instruction', 'Tick the keywords to change first.'),
  refused: line('reading', ({ n, reason }) => `${n} left as ${n === 1 ? 'it was' : 'they were'}: ${reason}`),
});
