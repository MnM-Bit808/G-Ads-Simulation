/**
 * The end of the game, and the account of it.
 *
 * Twelve rounds used to stop on week 12's dashboard with a disabled button and
 * nothing else — no total, no arc, no record of what the player had actually
 * done. This is that record.
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

import { el, add, table, figure, rupees, whole, ratio, pct, scrollX } from './dom.js';
import { renderDebrief, renderReveal } from './debrief/render.js';
import { DEBRIEF } from './words/debrief.js';
import {
  CAPEX_ALLOCATION_PAISE, MONTHLY_BUDGET_PAISE, DAYPART_BLOCKS,
} from '../engine/constants.js';

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
  const history = state?.history ?? [];
  if (history.length === 0) return [];

  const rows = (state.advertisers ?? []).map((a) => {
    const { all } = gameTotals(history, a.id);
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
      netRoas: all.costPaise > 0 ? all.netRevenuePaise / all.costPaise : null,
      cpaPaise: all.conversions > 0 ? Math.round(all.costPaise / all.conversions) : null,
    };
  });

  // The rank month 3's budget was actually allocated on, worked out first so it
  // survives the re-sort below and can be shown against it.
  const byGross = [...rows].sort((x, y) => y.grossProfitPaise - x.grossProfitPaise);
  const grossRank = new Map(byGross.map((r, i) => [r.id, i + 1]));

  rows.sort((x, y) => y.netProfitPaise - x.netProfitPaise);
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

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

/**
 * @param {object} ctx
 * @param {object} ctx.state the finished game state
 * @param {object[]} ctx.history
 * @param {string} ctx.playerId
 * @param {object} ctx.opening the account at the end of round 0
 * @param {object} [ctx.initial] the state before week 1: the debrief replays
 *   from it and the reveal reads the rivals' ads from it
 * @param {Function} [ctx.openGuide] opens a field guide chapter from a "why?"
 * @returns {DocumentFragment}
 */
export function renderEnding(ctx) {
  const frag = document.createDocumentFragment();
  const totals = gameTotals(ctx.history, ctx.playerId);

  // The standings show where every rival sat, which is the reveal's answer, so
  // they hold that column back until the reveal is answered or skipped. With no
  // starting state there is no reveal, and nothing to hold back for.
  let standings = standingsCard(ctx, { showCells: !ctx.initial });
  const reveal = renderReveal(ctx, () => {
    const shown = standingsCard(ctx, { showCells: true });
    standings.replaceWith(shown);
    standings = shown;
  });

  add(frag, headlineCard(ctx, totals), renderDebrief(ctx), reveal, standings,
    weeksCard(ctx, totals), accountCard(ctx), decisionsCard(ctx));
  // Last, deliberately. It is the only control here that destroys something,
  // and it should be read after the summary rather than met before it.
  if (ctx.onRestart) frag.append(restartCard(ctx));
  return frag;
}

/**
 * Start another game, once this one is finished.
 *
 * TWO STEPS ON PURPOSE. Twelve rounds is far too much to lose to a stray click,
 * so the first button only ASKS, and the second says which market it is about
 * to build. Nothing here is reachable before the twelfth week is played.
 *
 * The choice is the interesting part rather than a setting. Replaying the same
 * market is this project's counterfactual made playable — the same eight
 * rivals in the same cells, so a different plan can be compared against an
 * identical field, which is the only way to know whether a decision or the
 * market produced a result. A new market asks the harder question: whether what
 * you learned transfers, or whether you learned this one board.
 *
 * NOT the round 0 redo (17.3). That rewinds THROUGH `redoRoundZero`, keeps the
 * market and spends the one redo; this starts over with the redo unspent.
 */
function restartCard(ctx) {
  const node = card('Play again', 'the twelve weeks are done');
  const choices = el('div');

  const ask = el('button', null, 'Start another game');
  ask.type = 'button';
  ask.addEventListener('click', () => {
    ask.hidden = true;
    choices.append(
      option('Same market',
        'The same eight rivals in the same cells. The only way to find out whether '
        + 'a result came from your decisions or from the market you happened to get.',
        () => ctx.onRestart('same')),
      option('A new market',
        'Different rivals in different cells, so the eight ads at round 0 say '
        + 'something else. Whether what you learned here transfers is a harder '
        + 'question than whether you can beat this board again.',
        () => ctx.onRestart('new')),
    );
  });

  node.append(ask, choices);
  node.append(el('p', 'note',
    'Either one throws this game away — there is no going back to it, and nothing '
    + 'is saved. Read what is above first.'));
  return node;
}

function option(label, why, onPick) {
  const row = el('div', 'restart-row');
  const button = el('button', 'restart-pick', label);
  button.type = 'button';
  button.addEventListener('click', onPick);
  row.append(button, el('div', 'restart-why muted', why));
  return row;
}

const card = (title, subtitle, span = 'span-4') => {
  const node = el('article', `card ${span}`);
  const heading = el('h2', null, title);
  if (subtitle) heading.append(el('span', 'muted', subtitle));
  node.append(heading);
  return node;
};

/**
 * The books, opened. See `finalStandings` for why this is allowed to exist.
 *
 * The warning is not decoration and is not hedging. Everything else this
 * project shows is something a real advertiser could see; this is not, and a
 * player who took it for a normal report would leave believing they can find
 * out what a competitor earns. They cannot, ever.
 */
function standingsCard(ctx, { showCells = true } = {}) {
  const rows = finalStandings(ctx.state);
  const node = card('Everyone, with the books open',
    'what the simulator knows and a real account never tells you');

  if (rows.length === 0) return node;
  if (!showCells) node.append(el('p', 'muted', DEBRIEF.cellsHidden()));

  node.append(el('p', 'note',
    'For twelve weeks you could read six Auction Insights metrics about a rival '
    + 'and nothing else, because that is all Google gives you. This is the '
    + 'exception, and it exists because the game is over: nothing here can '
    + 'change a decision now. YOU WILL NEVER SEE THIS IN A REAL ACCOUNT — not a '
    + 'competitor’s spend, not their conversions, and certainly not their '
    + 'profit. Read it as the answer sheet, not as a report.'));

  // A real <table>, because `table()` calls replaceChildren on what it is given
  // and handing it the card would delete the heading and the warning above. It
  // used to be a <div>: the browser wraps a stray thead and tbody in an
  // anonymous table box, so it rendered while `table { width: 100% }` never
  // matched it, and the columns huddled in the left two thirds of the card.
  const wrap = el('table');
  table(wrap, [
    '#', 'Brand', ...(showCells ? ['Where they sat'] : []),
    { label: 'Spend', num: true }, { label: 'Conv', num: true },
    { label: 'CPA', num: true }, { label: 'Net ROAS', num: true },
    { label: 'Gross profit', num: true },
    { label: 'Returns took', num: true },
    { label: 'Contribution', num: true },
    { label: 'On gross', num: true },
  ], rows.map((r) => {
    // A rival who placed differently on the two metrics is the whole point of
    // showing both, so the row says which way and by how much.
    const moved = r.grossRank != null && r.grossRank !== r.rank;
    const arrow = moved ? `${r.grossRank} ${r.grossRank > r.rank ? '▲' : '▼'}` : `${r.grossRank}`;
    return {
      className: r.isYou ? 'you' : null,
      cells: [
        String(r.rank),
        r.isYou ? `${r.name} (you)` : r.name,
        ...(showCells ? [r.cell.replace('|', ' · ')] : []),
        rupees(r.costPaise),
        r.conversions.toFixed(1),
        r.cpaPaise == null ? '—' : rupees(r.cpaPaise),
        ratio(r.netRoas),
        rupees(r.grossProfitPaise),
        r.returnedShare == null ? '—' : pct(r.returnedShare),
        rupees(r.netProfitPaise),
        arrow,
      ],
    };
  }));
  node.append(scrollX(wrap));

  const disagree = rows.filter((r) => r.grossRank != null && r.grossRank !== r.rank);
  const note = el('p', 'note');
  note.append(el('strong', null, 'Ranked by contribution margin'));
  note.append(document.createTextNode(
    ' — revenue after returns, less the cost of the goods and the cost of the '
    + 'traffic. It is the only column here that is money you actually kept.',
  ));
  if (disagree.length > 0) {
    note.append(document.createTextNode(
      ` The last column is where each brand placed on GROSS profit, and ${disagree.length} `
      + `of ${rows.length} placed differently. Gross is the metric month 3’s budgets `
      + 'were actually allocated on, at week 8, before the '
      + 'returns had come back. A brand that sold a great deal and shipped much of it '
      + 'back ranks high on gross and low here — which is the trap you were playing '
      + 'inside for twelve weeks, and this is the first screen that says so.',
    ));
  }
  if (showCells) {
    note.append(document.createTextNode(
      ' The position column is the one nothing has ever told you: every rival’s cell '
      + 'was inferable only from the eight ads you read at round 0, so this is where '
      + 'you find out whether you read them right.',
    ));
  }
  node.append(note);
  return node;
}

function headlineCard(ctx, { all, settled }) {
  const node = card('Twelve weeks', 'what they came to');
  const figures = el('div', 'figures');
  add(figures,
    figure('Spend', rupees(all.costPaise), `${whole(all.clicks)} clicks`),
    figure('Conversions', all.conversions.toFixed(1), `${all.returned.toFixed(1)} returned`),
    figure('Net revenue', rupees(all.netRevenuePaise), `gross ${rupees(all.grossRevenuePaise)}`),
    figure('Net profit', rupees(all.netProfitPaise), `gross ${rupees(all.grossProfitPaise)}`,
      all.netProfitPaise < 0 ? 'neg' : 'pos'),
    figure('Net ROAS', ratio(all.costPaise > 0 ? all.netRevenuePaise / all.costPaise : NaN), ''),
    figure('Settled weeks', `${settled.count} of ${all.clicks > 0 ? ctx.history.length : 0}`,
      `${rupees(settled.netProfitPaise)} net`),
  );
  node.append(figures);

  node.append(el('p', 'note',
    all.stillPending > 0
      ? `None of this is final. ${all.stillPending.toFixed(1)} conversions are still in `
        + 'flight from clicks you have already paid for, and returns keep resolving for '
        + 'two rounds after a conversion lands. The last weeks of the game are the least '
        + 'settled, which is exactly why the ranking that decided month 3 was taken at '
        + 'week 8 rather than at the end.'
      : 'Every conversion has arrived, though returns may still be resolving.'));
  return node;
}

/** W11 at the scale of a whole game: what you read, against what it was. */
function weeksCard(ctx, { weeks, all }) {
  const node = card('Every week', 'what you read at the time, and what it turned out to be');
  const box = el('div', 'scroll');
  const list = el('table', 'mini');
  table(list, [
    'Week', { label: 'Spend', num: true }, { label: 'Conv', num: true },
    { label: 'Gross profit as you saw it', num: true },
    { label: 'As it stands', num: true }, '',
  ], weeks.map((week) => {
    const moved = week.grossProfitPaise - week.grossProfitAsFirstReportedPaise;
    return {
      className: week.settled ? null : 'unsettled',
      cells: [
        `Week ${week.round}`,
        rupees(week.costPaise),
        week.conversions.toFixed(1),
        rupees(week.grossProfitAsFirstReportedPaise),
        rupees(week.grossProfitPaise),
        moved === 0 ? '' : (moved > 0 ? `+${rupees(moved)}` : `−${rupees(-moved)}`),
      ],
    };
  }));
  box.append(list);
  node.append(box);

  const moved = all.grossProfitPaise - all.grossProfitAsFirstReportedPaise;
  node.append(el('p', 'note',
    `Across the game those first readings understated your gross profit by `
    + `${rupees(Math.abs(moved))}. Every decision you took was taken against the `
    + 'left-hand column, because the right-hand one did not exist yet. Rows still '
    + 'waiting on conversions are greyed.'));
  return node;
}

/** Where the money went that was not spent on clicks, and where you finished. */
function accountCard(ctx) {
  const node = card('The account', 'what you built, and where it left you', 'span-2');
  const self = ctx.state.advertisers.find((a) => a.id === ctx.playerId);

  const committed = Object.entries(self.capex?.committed ?? {}).filter(([, p]) => p > 0);
  if (committed.length > 0) {
    const list = el('table', 'mini');
    table(list, ['Invested in', { label: 'Committed', num: true }],
      committed.map(([target, paise]) => ({
        cells: [CAPEX_NAMES[target] ?? target, rupees(paise)],
      })));
    node.append(list);
  } else {
    node.append(el('p', 'muted',
      'You invested nothing in the business and took every allocation as '
      + 'advertising budget, which bought you more traffic and no better a shop '
      + 'to send it to.'));
  }

  const rank = rankOf(ctx.state, ctx.playerId);
  if (rank) {
    const line = el('p', 'rank-line');
    line.append(document.createTextNode('At week 8 you ranked '));
    line.append(el('strong', null, `${rank.position} of ${rank.of}`));
    line.append(document.createTextNode(
      ` on cumulative gross profit, and month 3's pool was split on that. `
      + `Your month 3 was ${rupees(self.campaign.monthlyBudgetPaise)} against the `
      + `${rupees(MONTHLY_BUDGET_PAISE)} everyone had in months 1 and 2.`,
    ));
    node.append(line);
    node.append(el('p', 'note', RANK_TRAPS));
  }
  return node;
}

const RANK_TRAPS = 'Both halves of that metric were traps. GROSS profit does not '
  + 'net off returns, so buying traffic that converts well and comes straight back '
  + 'flattered it. AS REPORTED AT WEEK 8 means attribution had not caught up, so a '
  + 'week-8 click showed all of its cost against about half of its revenue — '
  + 'spending hard into the deadline made you look worse, not better.';

/** 12.4 has stored this since the first commit and nothing has ever shown it. */
function decisionsCard(ctx) {
  const node = card('What you did', 'every decision, week by week', 'span-2');
  const rows = summariseDecisions(ctx.state.decisionLog, ctx.playerId, ctx.opening);

  if (rows.length === 0) {
    node.append(el('p', 'muted',
      'You changed nothing after opening the account. The market moved around a '
      + 'fixed position for twelve weeks.'));
    return node;
  }

  const box = el('div', 'scroll');
  const list = el('div', 'decision-log');
  for (const row of rows) {
    const week = el('div', 'log-row');
    week.append(el('div', 'log-week', `Week ${row.round}`));
    const lines = el('div', 'log-lines');
    for (const line of row.lines) lines.append(el('div', null, line));
    week.append(lines);
    list.append(week);
  }
  box.append(list);
  node.append(box);
  node.append(el('p', 'note',
    `${rows.length} of the ${ctx.history.length} weeks carried a decision. `
    + 'The rest ran on what you had already set.'));
  return node;
}
