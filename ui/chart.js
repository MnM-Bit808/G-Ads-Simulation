/**
 * How everybody is doing, week by week (spec 16).
 *
 * WHAT THIS CHART MAY SHOW, AND WHY THE ANSWER IS SHORT
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

import { el, add, pct } from './dom.js';

/**
 * The six, and which of them describe an advertiser rather than a matchup.
 *
 * `scope: 'each'` reads off `insights.self` and `insights.rivals[id]` alike, so
 * it plots everybody. `scope: 'versus'` exists only inside a rival's row.
 */
export const CHART_METRICS = Object.freeze([
  {
    key: 'impressionShare',
    label: 'Impression share',
    scope: 'each',
    help: 'How often each advertiser appeared at all, out of the auctions they were '
      + 'eligible for. The most visible advertiser is not the one making the most money.',
  },
  {
    key: 'topOfPageRate',
    label: 'Top of page',
    scope: 'each',
    help: 'How often they appeared above the organic results rather than below them.',
  },
  {
    key: 'absTopOfPageRate',
    label: 'Absolute top',
    scope: 'each',
    help: 'How often they were the first ad on the page. Expensive, and not always worth it.',
  },
  {
    key: 'overlapRate',
    label: 'Overlap with you',
    scope: 'versus',
    help: 'How often a rival appeared in the auctions YOU appeared in. It is not market '
      + 'share and it is not spend — a line rising here can simply mean you both '
      + 'broadened into the same searches.',
  },
  {
    key: 'positionAboveRate',
    label: 'Above you',
    scope: 'versus',
    help: 'When you both showed, how often they were higher up the page than you.',
  },
  {
    key: 'outrankingShare',
    label: 'You beat them',
    scope: 'versus',
    help: 'How often you came out ahead, counting auctions they never reached at all.',
  },
]);

const METRIC_BY_KEY = new Map(CHART_METRICS.map((m) => [m.key, m]));

/**
 * Turn a game's stored insights into one line per advertiser.
 *
 * @param {object[]} insights one entry per played round, keyed by advertiser id
 * @param {string} playerId
 * @param {string} metric one of `CHART_METRICS`
 * @param {Map<string, string>} names id → display name
 * @returns {Array<{id: string, name: string, isSelf: boolean, points: object[]}>}
 */
export function seriesFor(insights, playerId, metric, names) {
  const spec = METRIC_BY_KEY.get(metric);
  if (!spec) throw new RangeError(`no chart metric "${metric}"`);

  const rounds = insights ?? [];
  const byId = new Map();

  const push = (id, isSelf, round, value) => {
    if (typeof value !== 'number') return;
    if (!byId.has(id)) {
      byId.set(id, { id, name: names?.get(id) ?? id, isSelf, points: [] });
    }
    byId.get(id).points.push({ round, value });
  };

  rounds.forEach((entry, i) => {
    const mine = entry?.[playerId];
    if (!mine) return;
    const round = i + 1;

    if (spec.scope === 'each') push(playerId, true, round, mine.self?.[metric]);
    // A rival that has gone inactive simply stops appearing in `insightsFor`'s
    // rows. Its line stops with it; reading the gap as 0% would draw a cliff
    // that never happened.
    for (const [id, row] of Object.entries(mine.rivals ?? {})) {
      push(id, false, round, row?.[metric]);
    }
  });

  // Yours first so it draws on top of the muted rival lines.
  return [...byId.values()].sort((a, b) => Number(b.isSelf) - Number(a.isSelf));
}

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

const BOX = { w: 560, h: 220, left: 34, right: 8, top: 10, bottom: 22 };

/**
 * Draw one card: a metric switcher, the lines, and a legend you can focus with.
 *
 * @param {object} ctx
 * @param {object[]} ctx.insights one per played round
 * @param {string} ctx.playerId
 * @param {Map<string, string>} ctx.names
 * @param {object} ctx.view held by the caller, so a redraw keeps the selection
 * @returns {HTMLElement}
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
  const rivals = Object.entries(latest.rivals ?? {});
  const best = (key) => rivals.reduce(
    (top, [id, r]) => (top === null || r[key] > top.rate
      ? { id, name: names?.get(id) ?? id, rate: r[key] }
      : top),
    null,
  );

  return {
    constraint,
    impressionShare,
    lostToRank,
    lostToBudget,
    change,
    meetMost: best('overlapRate'),
    beatsYouMost: best('positionAboveRate'),
  };
}

/**
 * The smallest change in a rival's overlap worth naming: five points of the
 * player's auctions. Below it, a week-to-week wobble. A display threshold, kept
 * in the view (DECISIONS I6).
 */
const MIN_MOVE = 0.05;
const MOST_MOVERS = 3;

/**
 * The rivals whose presence in the player's auctions moved most since last week.
 *
 * Read at week 9, when month 3's budgets take effect (DECISIONS D12, C8): rivals
 * then move 2.40 times an ordinary week. It says who moved and by how much, from
 * the overlap rate Auction Insights shows, and never why a particular rival did:
 * whose budget grew is private (R3).
 *
 * @param {object[]} insights one entry per round, keyed by advertiser id
 * @param {string} playerId
 * @param {Map<string, string>} names
 * @returns {{id: string, name: string, from: number, to: number}[]} largest move
 *   first, at most three, only moves of at least five points
 */
export function insightMovers(insights, playerId, names) {
  const before = insights?.[insights.length - 2]?.[playerId]?.rivals;
  const after = insights?.[insights.length - 1]?.[playerId]?.rivals;
  if (!before || !after) return [];
  return Object.keys(after)
    .filter((id) => id in before)
    .map((id) => ({ id, name: names?.get(id) ?? id, from: before[id].overlapRate, to: after[id].overlapRate }))
    .filter((m) => Math.abs(m.to - m.from) >= MIN_MOVE)
    .sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from))
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

/**
 * The market, read back in sentences, from what the player is allowed to know.
 *
 * Deliberately says WHERE TO LOOK rather than what to do. "Your split and your
 * bids" is a place; "lower your bids" would be advice this card cannot justify,
 * because it cannot see whether the clicks were worth buying.
 */
function readingOf(ctx) {
  const out = marketOutlook(ctx.insights, ctx.playerId, ctx.names);
  if (!out) return null;

  const node = el('p', 'note market-read');
  const shown = pct(out.impressionShare);
  const rank = pct(out.lostToRank);
  const budget = pct(out.lostToBudget);

  const said = {
    budget: `You appeared in ${shown} of the auctions you were eligible for, and lost `
      + `${budget} to BUDGET against ${rank} to rank. Nobody is keeping you out — you `
      + 'stop turning up when the money runs out. The lines above you are advertisers '
      + 'with budget left, not better ads. Look at the weekly split and whether your '
      + 'bids are higher than they need to be.',
    rank: `You appeared in ${shown} of the auctions you were eligible for, and lost `
      + `${rank} to RANK against ${budget} to budget. You are being outranked, and rank `
      + 'is your bid multiplied by your quality — so a higher bid buys position, and a '
      + 'better ad buys position AND makes every click cheaper.',
    both: `You appeared in ${shown} of the auctions you were eligible for, losing `
      + `${rank} to rank and ${budget} to budget. Both are biting, which usually means `
      + 'you are bidding for more traffic than the budget can pay for. Fixing one alone '
      + 'will move the other.',
    saturated: `You appeared in ${shown} of the auctions you were eligible for, so there `
      + 'is almost nothing left to win on the keywords you have. More impressions now '
      + 'means more keywords, not more money on these ones — and 100% share is not '
      + 'winning, because a rival who never outranks you still sets what you pay.',
  };
  node.append(document.createTextNode(said[out.constraint]));

  if (out.meetMost && out.meetMost.rate > 0) {
    node.append(document.createTextNode(
      ` You meet ${out.meetMost.name} most — ${pct(out.meetMost.rate)} of the auctions `
      + 'you appear in',
    ));
    node.append(document.createTextNode(
      out.beatsYouMost && out.beatsYouMost.id !== out.meetMost.id
        ? `, but it is ${out.beatsYouMost.name} that is above you most often when you `
          + `meet, ${pct(out.beatsYouMost.rate)} of the time.`
        // Same advertiser on both counts: it is who you meet AND who beats you.
        : `, and it is above you ${pct(out.beatsYouMost?.rate ?? 0)} of the times you `
          + 'both appear.',
    ));
  }

  if (out.change !== null && Math.abs(out.change) >= 0.01) {
    node.append(document.createTextNode(
      ` Your share ${out.change > 0 ? 'rose' : 'fell'} ${pct(Math.abs(out.change))} since `
      + 'last week — whatever you changed, that is what it did to how often you appear.',
    ));
  }
  return node;
}

export function renderTrends(ctx) {
  const node = el('article', 'card span-2');
  const heading = el('h2', null, 'Week by week');
  heading.append(el('span', 'muted', 'everyone, on what you are allowed to see'));
  node.append(heading);

  ctx.view.metric = ctx.view.metric ?? CHART_METRICS[0].key;
  const body = el('div');

  const draw = () => {
    const spec = METRIC_BY_KEY.get(ctx.view.metric);
    const series = seriesFor(ctx.insights, ctx.playerId, ctx.view.metric, ctx.names);
    body.replaceChildren();

    const chips = el('div', 'chips metric-chips');
    for (const metric of CHART_METRICS) {
      const chip = el('button', `chip small${metric.key === ctx.view.metric ? ' on' : ''}`,
        metric.label);
      chip.type = 'button';
      chip.title = metric.help;
      chip.addEventListener('click', () => {
        ctx.view.metric = metric.key;
        ctx.view.focus = null;
        draw();
      });
      chips.append(chip);
    }
    body.append(chips);

    if (series.length === 0 || series.every((s) => s.points.length === 0)) {
      body.append(el('p', 'muted', 'Nothing to plot yet. Run a week.'));
      return;
    }

    body.append(plot(series, ctx.view));
    body.append(legend(series, ctx.view, draw));
    body.append(el('p', 'note', spec.help));

    // What the lines mean FOR THIS ACCOUNT. The card used to say what each
    // metric is and warn what it is not, and never what to do with it, so the
    // reading was left to the player — which is the skill it exists to teach.
    const read = readingOf(ctx);
    if (read) body.append(read);

    if (spec.scope === 'each') {
      body.append(el('p', 'chart-warn',
        'Most visible is not winning. An advertiser in this game read 100% '
        + 'impression share for twelve rounds while its rivals took 69% of its '
        + 'profit through price — they never outranked it, they just made every '
        + 'click it bought more expensive.'));
    }
  };

  draw();
  node.append(body);
  return node;
}

/** Which lines are drawn: everything, or one rival plus you for reference. */
const visible = (series, view) => (view.focus
  ? series.filter((s) => s.id === view.focus || s.isSelf)
  : series);

function plot(series, view) {
  const shown = visible(series, view);
  const lastRound = Math.max(...series.flatMap((s) => s.points.map((p) => p.round)), 1);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${BOX.w} ${BOX.h}`);
  svg.setAttribute('class', 'trend');
  svg.setAttribute('role', 'img');

  const x = (round) => (lastRound <= 1
    ? BOX.left
    : BOX.left + ((round - 1) / (lastRound - 1)) * (BOX.w - BOX.left - BOX.right));
  // Every one of the six is a rate, so the axis is a fixed 0-100% and weeks are
  // comparable to each other rather than rescaling as the data moves.
  const y = (value) => BOX.top + (1 - value) * (BOX.h - BOX.top - BOX.bottom);

  const add2 = (tag, attrs, text) => {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text != null) n.textContent = text;
    svg.append(n);
    return n;
  };

  for (const value of [0, 0.25, 0.5, 0.75, 1]) {
    add2('line', {
      x1: BOX.left, x2: BOX.w - BOX.right, y1: y(value), y2: y(value), class: 'grid',
    });
    add2('text', { x: BOX.left - 6, y: y(value) + 3, class: 'axis', 'text-anchor': 'end' },
      pct(value));
  }
  for (let round = 1; round <= lastRound; round++) {
    add2('text', { x: x(round), y: BOX.h - 6, class: 'axis', 'text-anchor': 'middle' },
      String(round));
  }

  for (const line of shown) {
    if (line.points.length === 0) continue;
    const points = line.points.map((p) => `${x(p.round)},${y(p.value)}`).join(' ');
    add2(line.points.length === 1 ? 'polyline' : 'polyline', {
      points,
      class: `line${line.isSelf ? ' self' : ''}${view.focus === line.id ? ' focused' : ''}`,
    });
    // A single played round has no segment to draw, so mark the point itself.
    if (line.points.length === 1) {
      add2('circle', {
        cx: x(line.points[0].round), cy: y(line.points[0].value), r: 3,
        class: `dot${line.isSelf ? ' self' : ''}`,
      });
    }
  }
  return svg;
}

function legend(series, view, redraw) {
  const box = el('div', 'legend-lines');
  for (const line of series) {
    const focused = view.focus === line.id;
    const entry = el('button',
      `legend-line${line.isSelf ? ' self' : ''}${focused ? ' on' : ''}`);
    entry.type = 'button';
    entry.append(el('span', 'legend-swatch'));
    entry.append(el('span', null, line.isSelf ? `${line.name} (you)` : line.name));
    const last = line.points[line.points.length - 1];
    if (last) entry.append(el('span', 'legend-value', pct(last.value)));
    entry.title = focused
      ? 'Show everybody again'
      : `Show only ${line.name}${line.isSelf ? '' : ' and you'}`;
    entry.addEventListener('click', () => {
      view.focus = focused ? null : line.id;
      redraw();
    });
    box.append(entry);
  }
  add(box);
  return box;
}
