/**
 * The interface (spec 14, build step 14). Slice one: the round dashboard.
 *
 * IT IMPORTS THE REAL ENGINE, which is the whole point.
 *
 * The two `.jsx` files at the repository root are v0.1 prototypes, and each one
 * carries its OWN copy of the demand curve, the conversion multipliers and the
 * auction. They drifted from the spec the moment the spec moved, and nothing
 * could tell. This module imports `setup.js`, `game.js` and `engine/` directly
 * over native ES modules — no bundler, no framework, no transpile — so there is
 * exactly one engine and the screen cannot disagree with the tests.
 *
 * WHAT THE MEASUREMENTS ASKED THIS SCREEN TO DO
 *
 * Three findings from playing the game shaped the layout, and none of them is
 * decoration:
 *
 *   F12  Impression share is misleading on its own. An advertiser alone in its
 *        cell read 100% share and 0% lost for twelve rounds while rivals took
 *        69% of its profit through PRICE. So share never appears without
 *        position mix and CPC beside it.
 *
 *   W11  A round's numbers move after you have read them — round 1 finally read
 *        +82% conversions and +171% profit against what the player saw at the
 *        time. The AsFirstReported twins were all stored and nothing surfaced
 *        them. "Changed since you looked" is now a panel, not a footnote.
 *
 *   15.2 The search terms report is the only tool for writing negatives, so it
 *        is a primary surface rather than a buried table, and rows that took
 *        clicks and returned nothing are marked.
 */

import { startGame, briefing } from '../setup.js';
import { playRound } from '../game.js';
import { POLICIES } from '../agents/policies.js';
import { QUERY_SET } from '../content/querySet.js';
import { BRAND_IDENTITIES } from '../content/brands.js';
import { homeCell } from '../engine/querySet.js';
import { TOTAL_ROUNDS } from '../engine/constants.js';

// ---------------------------------------------------------------------------
// Formatting. Money is integer paise everywhere until exactly here (R7).
// ---------------------------------------------------------------------------

const rupees = (paise) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
const whole = (n) => Math.round(n).toLocaleString('en-IN');
const pct = (x, places = 0) => `${(100 * (x || 0)).toFixed(places)}%`;
const ratio = (x) => (Number.isFinite(x) ? x.toFixed(2) : '—');

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

/** Build a table from a header row and an array of row descriptors. */
function table(node, headers, rows) {
  node.replaceChildren();
  const thead = el('thead');
  const hr = el('tr');
  for (const h of headers) {
    const th = el('th', h.num ? 'num' : null, h.label ?? h);
    hr.append(th);
  }
  thead.append(hr);
  const tbody = el('tbody');
  for (const row of rows) {
    const tr = el('tr', row.className);
    for (const [i, cell] of row.cells.entries()) {
      const td = el('td', headers[i]?.num ? 'num' : null);
      if (cell instanceof Node) td.append(cell);
      else td.textContent = cell;
      tr.append(td);
    }
    tbody.append(tr);
  }
  node.append(thead, tbody);
}

// ---------------------------------------------------------------------------
// A game, played against the six rule-based policies
// ---------------------------------------------------------------------------

const PLAYER = BRAND_IDENTITIES[0].id;

/**
 * The market the player walks into: one policy per rival, cycling the six so
 * every character is represented.
 */
const CAST = ['spender', 'cautious', 'automator', 'grossOptimiser', 'brandDefender', 'disciplined'];

/** An opening account, until slice two lets the player write their own. */
function openingChoices() {
  const own = QUERY_SET.queries.filter((q) => homeCell(q) === 'mid|performance');
  return {
    position: { price: 'mid', purpose: 'performance' },
    keywords: own.slice(0, 8).map((q, i) => ({
      text: q.text,
      matchType: i === 0 ? 'exact' : i < 5 ? 'phrase' : 'broad',
      bidPaise: 4000,
    })),
    ad: {
      headlines: ['Leggings Built To Train In', 'Holds Up, Wash After Wash', 'Squat-Proof, Sweat-Wicking'],
      descriptions: [
        'Gym wear that survives four sessions a week and a hot Indian summer.',
        'Sizes XS to XXL, with a fit guide that admits when to size up. 30-day returns.',
      ],
      landingPageDescription: 'Product page with a fit guide, wash-test notes and reviews by activity.',
    },
  };
}

const game = {
  state: startGame({
    rootSeed: 20260902,
    playerBrandId: PLAYER,
    player: openingChoices(),
    querySet: QUERY_SET,
  }),
  reports: [],
  insights: [],
};

const controllers = Object.fromEntries(
  game.state.advertisers.map((a, i) => [
    a.id,
    i === 0 ? () => null : POLICIES[CAST[(i - 1) % CAST.length]],
  ]),
);

const brief = briefing(QUERY_SET);

// ---------------------------------------------------------------------------
// Panels
// ---------------------------------------------------------------------------

function figure(label, value, sub, tone) {
  const box = el('div', 'figure');
  box.append(el('div', 'label', label));
  box.append(el('div', `value${tone ? ` ${tone}` : ''}`, value));
  if (sub) box.append(el('div', 'sub', sub));
  return box;
}

function renderHeadline(root, row) {
  const t = row.traffic;
  const cpc = t.clicks > 0 ? t.costPaise / t.clicks : 0;
  const figures = root.querySelector('[data-slot="figures"]');
  figures.replaceChildren(
    figure('Spend', rupees(t.costPaise), `${whole(t.clicks)} clicks`),
    figure('Avg CPC', rupees(cpc), `${whole(t.impressions)} impressions`),
    figure('Conversions', row.conversions.final.toFixed(1),
      `${row.conversions.stillPending.toFixed(1)} still pending`),
    figure('Net ROAS', ratio(row.money.netRoas), `gross ${ratio(row.money.grossRoas)}`),
    figure('Net profit', rupees(row.money.netProfitPaise),
      `gross ${rupees(row.money.grossProfitPaise)}`,
      row.money.netProfitPaise < 0 ? 'neg' : 'pos'),
    figure('CPA', row.money.cpaPaise == null ? '—' : rupees(row.money.cpaPaise), ''),
  );

  const note = root.querySelector('[data-slot="settled"]');
  const warnings = (row.warnings ?? []).map((w) => {
    const pill = el('span', 'warn-pill', w.replace(/_/g, ' '));
    return pill;
  });
  note.replaceChildren(...warnings);
  note.append(document.createTextNode(
    'These figures are provisional. A click settles about five rounds after it '
    + 'happens — three for the order to arrive, two more for the return window — '
    + 'so everything here will still move.',
  ));
}

/** F12: share never appears without position mix beside it. */
function renderShare(root, row) {
  const bars = root.querySelector('[data-slot="share-bars"]');
  bars.replaceChildren();
  const rows = [
    ['Shown', row.share.impressionShare, 'shown'],
    ['Lost to rank', row.share.lostToRank, 'rank'],
    ['Lost to budget', row.share.lostToBudget, 'budget'],
  ];
  for (const [label, value, kind] of rows) {
    const line = el('div', 'bar-row');
    line.append(el('div', 'k', label));
    const track = el('div', 'track');
    const fill = el('div', `fill ${kind}`);
    fill.style.width = `${Math.max(0, Math.min(100, 100 * (value || 0)))}%`;
    track.append(fill);
    line.append(track, el('div', 'v', pct(value, 1)));
    bars.append(line);
  }

  const counts = row.positions.counts;
  const total = counts.reduce((a, b) => a + b, 0);
  table(
    root.querySelector('[data-slot="positions"]'),
    ['Position', { label: 'Impressions', num: true }, { label: 'Share', num: true }],
    counts.map((n, i) => ({
      cells: [`${i + 1}${i === 0 ? ' (top)' : ''}`, whole(n), total > 0 ? pct(n / total) : '—'],
    })),
  );
}

/** W11: what moved since the player last looked. */
function renderRevised(root) {
  const body = root.querySelector('[data-slot="revised-body"]');
  body.replaceChildren();

  const revised = game.state.history.filter((h) => h.revisedAtRound != null);
  if (revised.length === 0) {
    body.append(el('p', 'muted',
      'Nothing yet. Conversions from this week will start arriving next week, '
      + 'and they rewrite the week that earned them.'));
    return;
  }

  const latest = revised[revised.length - 1];
  const row = latest.byAdvertiser[PLAYER];
  body.append(el('p', 'muted',
    `Week ${latest.round}, rewritten in week ${latest.revisedAtRound}.`));

  const grid = el('div', 'revision');
  grid.append(el('div', 'k head', ''), el('div', 'then head', 'you saw'), el('div', 'now head', 'actually'));

  const lines = [
    ['Conversions', row.conversions.asFirstReported, row.conversions.final, (v) => v.toFixed(1)],
    ['Net ROAS', row.money.netRoasAsFirstReported, row.money.netRoas, ratio],
    ['Gross profit', row.money.grossProfitAsFirstReportedPaise, row.money.grossProfitPaise, rupees],
  ];
  for (const [label, before, after, fmt] of lines) {
    grid.append(el('div', 'k', label));
    grid.append(el('div', 'then', fmt(before)));
    const dir = after > before ? 'up' : after < before ? 'down' : '';
    grid.append(el('div', `now ${dir}`, fmt(after)));
  }
  body.append(grid);
  body.append(el('p', 'note',
    'Numbers changing after you have read them is one of the most disorienting '
    + 'things about a real account. Decisions you made on the left-hand column '
    + 'were made on incomplete information.'));
}

/** 15.2 and 8.2: the search terms report, and the only route to negatives. */
function renderTerms(root, row) {
  const texts = new Map(QUERY_SET.queries.map((q) => [q.id, q.text]));
  const rows = Object.entries(row.breakdown.byQuery)
    .filter(([, r]) => r.impressions > 0)
    .sort((a, b) => b[1].costPaise - a[1].costPaise)
    .slice(0, 40)
    .map(([id, r]) => ({
      className: r.clicks >= 5 && r.conversions === 0 ? 'wasted' : null,
      cells: [
        texts.get(id) ?? id,
        whole(r.impressions),
        whole(r.clicks),
        rupees(r.costPaise),
        r.conversions > 0 ? r.conversions.toFixed(1) : '0',
        r.clicks > 0 ? rupees(r.costPaise / r.clicks) : '—',
      ],
    }));

  table(
    root.querySelector('[data-slot="terms-table"]'),
    ['Search term', { label: 'Impr', num: true }, { label: 'Clicks', num: true },
      { label: 'Cost', num: true }, { label: 'Conv', num: true }, { label: 'CPC', num: true }],
    rows,
  );
}

function renderQuality(root, row) {
  const keywords = game.state.advertisers[0].adGroups[0].keywords;
  const byKeyword = row.breakdown.byKeyword;
  table(
    root.querySelector('[data-slot="quality-table"]'),
    ['Keyword', 'Match', { label: 'Clicks', num: true }, { label: 'Quality', num: true }],
    keywords.map((k) => {
      const score = row.quality?.[k.id];
      const stats = byKeyword[k.id];
      // A block wrapper, not a span: the tags go on their own line under the
      // keyword, and a block child inside an inline element is not valid HTML.
      const text = el('div');
      text.append(el('div', null, k.text));
      const tags = el('div', 'tag-row');
      for (const tag of k.tags.slice(0, 4)) tags.append(el('span', 'tag', tag));
      if (k.tags.length > 0) text.append(tags);
      return {
        cells: [
          text,
          k.matchType,
          stats ? whole(stats.clicks) : '0',
          score ? String(score.score) : '—',
        ],
      };
    }),
  );
}

function renderInsights(root) {
  const own = game.insights[game.insights.length - 1]?.[PLAYER];
  const names = new Map(game.state.advertisers.map((a) => [a.id, a.name]));
  if (!own) return;
  const rows = Object.entries(own.rivals)
    .sort((a, b) => b[1].overlapRate - a[1].overlapRate)
    .map(([id, r]) => ({
      cells: [
        names.get(id) ?? id,
        pct(r.overlapRate),
        pct(r.positionAboveRate),
        pct(r.outrankingShare),
      ],
    }));
  table(
    root.querySelector('[data-slot="insights-table"]'),
    ['Advertiser', { label: 'Overlap', num: true },
      { label: 'Above you', num: true }, { label: 'You beat', num: true }],
    rows,
  );
}

/** 13.2 requires a burn-down of the remaining pot against rounds remaining. */
function renderBudget(root, row) {
  const body = root.querySelector('[data-slot="budget-body"]');
  body.replaceChildren();
  const b = row.budget;
  const used = b.monthlyBudgetPaise > 0 ? b.monthSpentPaise / b.monthlyBudgetPaise : 0;

  const burn = el('div', 'burn');
  const track = el('div', 'track');
  const fill = el('div', 'fill');
  fill.style.width = `${Math.min(100, 100 * used)}%`;
  track.append(fill);
  const legend = el('div', 'legend');
  legend.append(el('span', null, `${rupees(b.monthSpentPaise)} spent`));
  legend.append(el('span', null, `${rupees(b.monthRemainingPaise)} left`));
  burn.append(track, legend);
  body.append(burn);

  const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const daily = el('table', 'mini');
  table(daily, ['Day', { label: 'Spend', num: true }],
    b.dailySpendPaise.map((p, i) => ({ cells: [day[i], rupees(p)] })));
  body.append(daily);

  body.append(el('p', 'note',
    'Unspent money is lost at the month boundary. There is no carry-over.'));
}

function renderMarket(root) {
  const context = game.state.marketContext[game.state.marketContext.length - 1];
  if (!context) return;
  table(
    root.querySelector('[data-slot="market-table"]'),
    ['', { label: 'This week', num: true }],
    [
      { cells: ['Total market spend', rupees(context.totalMarketSpendPaise)] },
      { cells: ['Advertisers running', String(context.activeAdvertisers)] },
      { cells: ['Median CPC', rupees(context.medianCpcPaise)] },
      { cells: ['Searches this week', whole(brief.weeklySearchesByTier.value
        + brief.weeklySearchesByTier.mid + brief.weeklySearchesByTier.premium)] },
    ],
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

const app = document.getElementById('app');
const nextButton = document.getElementById('next');

function renderChrome() {
  const me = game.state.advertisers[0];
  document.getElementById('brand').textContent = me.name;
  document.getElementById('position').textContent =
    `${me.position.price} · ${me.position.purpose}`;
  const played = game.reports.length;
  document.getElementById('round-label').textContent =
    played === 0 ? 'no weeks played' : `week ${played} of ${TOTAL_ROUNDS}`;
  nextButton.disabled = played >= TOTAL_ROUNDS;
  nextButton.textContent = played >= TOTAL_ROUNDS ? 'Game over' : 'Run the week';
}

function render() {
  renderChrome();
  const report = game.reports[game.reports.length - 1];
  if (!report) {
    app.replaceChildren(el('p', 'loading',
      'Nothing has run yet. Run the week to buy some traffic.'));
    return;
  }
  const row = report.byAdvertiser[PLAYER];
  const view = document.getElementById('tpl-dashboard').content.cloneNode(true);
  const root = view.firstElementChild;

  renderHeadline(root, row);
  renderShare(root, row);
  renderRevised(root);
  renderTerms(root, row);
  renderQuality(root, row);
  renderInsights(root);
  renderBudget(root, row);
  renderMarket(root);

  app.replaceChildren(root);
}

nextButton.addEventListener('click', async () => {
  nextButton.disabled = true;
  nextButton.textContent = 'running 168 hours…';
  // Yield once so the button repaints before the round blocks the thread.
  await new Promise((resolve) => setTimeout(resolve, 0));

  const out = await playRound(game.state, controllers, { mode: 'expected' });
  game.state = out.nextGameState;
  game.reports.push(out.report);
  game.insights.push(out.insights);
  render();
});

render();
