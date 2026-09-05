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
