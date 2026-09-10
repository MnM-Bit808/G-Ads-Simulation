/**
 * The round dashboard.
 *
 * Three findings from playing the game shaped this layout, and none of them is
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
 *        them. "Changed since you looked" is a panel, not a footnote.
 *
 *   15.2 The search terms report is the only tool for writing negatives, so it
 *        is a primary surface rather than a buried table, and rows that took
 *        clicks and returned nothing are marked.
 */

import { el, table, figure, rupees, whole, pct, ratio } from './dom.js';
import { getPublicView } from '../engine/insights.js';
import { briefing } from '../setup.js';
import {
  renderDecisions, addNegative, blocksTerm, effectiveGrades, termsOutlook,
  locationRows, locationOutlook, setLocation,
} from './decisions.js';
import { rankOf } from './ending.js';
import { renderTrends } from './chart.js';
import { brandNamedIn } from '../content/brands.js';
import {
  MONTHLY_BUDGET_PAISE, ROUNDS_PER_MONTH, DEFAULT_UNGRADED_QUALITY,
  ATTRIBUTION_LAG_DISTRIBUTION,
} from '../engine/constants.js';

/** "55% this week, then 28%, 12%, 5%", read off the constant it describes. */
const ARRIVAL_SHAPE = ATTRIBUTION_LAG_DISTRIBUTION
  .map((share, i) => `${Math.round(100 * share)}%${i === 0 ? ' this week' : ''}`)
  .join(', then ')
  .replace(/, then (?=[^,]*$)/, ' and then ');

// ---------------------------------------------------------------------------
// Panels
// ---------------------------------------------------------------------------

function renderHeadline(root, row, game, playerId, report) {
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

  // Before the provisional sentence, because it is the larger caveat on these
  // six figures in the weeks it appears: an ad that has not been written yet is
  // a bigger reason they are not what the account will do than the settling lag.
  const copy = creativeOutlook(creativeOf(game, playerId), report.round);
  if (copy) note.append(el('strong', 'copy-note', copySentence(copy)));

  note.append(document.createTextNode(
    'These figures are provisional. A click settles about five rounds after it '
    + 'happens — three for the order to arrive, two more for the return window — '
    + 'so everything here will still move.',
  ));
}

/**
 * The advertiser's own creative block, or undefined.
 *
 * Read from state rather than a view because `getSelfView` does not carry
 * `creative` — the block is a caller-layer field (I11) added after that view was
 * written, so no controller can see it either. Worth fixing there; the dashboard
 * already holds `game.state` and is not under R5's controller boundary.
 */
function creativeOf(game, playerId) {
  return game.state?.advertisers?.find((a) => a.id === playerId)?.creative;
}

/**
 * Is there anything to say about the player's own copy this week?
 *
 * MEASURED, AND THE REASON THIS FUNCTION EXISTS. A self-written ad runs on the
 * ungraded default until `creative.liveAtRound` (9.5, DECISIONS A8/I11), and the
 * round it lands is the largest single movement in a twelve-week game: at the
 * bid round 0 offers, a DIY account went 586 clicks to 2,351, while a hired
 * control over the same two weeks went DOWN. Below the reserve it goes from
 * nothing at all to 1,951. Nothing on this screen said so — the delay was
 * explained once at round 0, five cards deep, before the player had seen a
 * single auction — so a player who changed anything that week would credit their
 * own change with a 4x jump.
 *
 * It reports the STATE and the card writes the sentence, following
 * `termsOutlook` and `negativesOutlook`.
 *
 * @param {{liveAtRound?: number}|null|undefined} creative the player's own block
 * @param {number|null} round the round being reported
 * @returns {null | {state: 'pending'|'landed', liveAtRound: number,
 *   weeksAway: number, ungradedScore: number}} null when there is nothing to say
 */
export function creativeOutlook(creative, round) {
  const liveAtRound = creative?.liveAtRound;
  // A hired ad was live before the first auction (liveAtRound 1), so there is
  // nothing to explain and a "went live this week" on week 1 would be noise on
  // every hired account. A missing block is an older state, not a story.
  if (!Number.isFinite(liveAtRound) || liveAtRound <= 1 || !Number.isFinite(round)) return null;
  if (round > liveAtRound) return null;

  return {
    state: round < liveAtRound ? 'pending' : 'landed',
    liveAtRound,
    weeksAway: liveAtRound - round,
    // From the engine's own default, not a literal: this is the grade the
    // auction actually ran on, and a number typed into a view would drift.
    ungradedScore: DEFAULT_UNGRADED_QUALITY.expectedCtr,
  };
}

/**
 * What the card says about it.
 *
 * The landed sentence says where to look and stops there (I13). It does not
 * claim the copy is the ONLY reason anything moved — the player may have changed
 * bids the same week — but it names the cause they cannot see, because the one
 * they can see is the only one they would otherwise credit.
 */
function copySentence(copy) {
  if (copy.state === 'pending') {
    return 'Your own copy is not live yet. Until week '
      + `${copy.liveAtRound} you are running an unwritten ad, graded `
      + `${copy.ungradedScore} out of 10 for both click-through and relevance, `
      + 'so these figures are what an ungraded ad does rather than what yours '
      + 'will do. ';
  }
  return 'Your own copy went live this week, at the grade you wrote it to. '
    + 'If impressions and clicks jumped, that is the first thing to attribute '
    + 'it to — not the changes you made last week. ';
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

/**
 * Every week's conversions, landed against still arriving (I27).
 *
 * WHY THIS IS A PICTURE AND NOT A SENTENCE. "49.7 still pending" was a grey
 * sub-label under a headline figure, and a player who has played this twenty
 * times still had to ask what it meant. The delay is a SHAPE — 55% of a week's
 * conversions land that week, then 28, 12 and 5 — and a shape is the one thing
 * prose is worst at. Drawn, the whole game reads at a glance: week 1 is a solid
 * bar, this week is mostly hollow, and the staircase between them is the lag.
 *
 * NOTHING HERE IS ESTIMATED. `stillPending` is tracked per week by `report.js`
 * and decremented as conversions land, and `asFirstReported` is the twin W11
 * stores. The tick is where the number sat when the player read it, so the gap
 * between the tick and the end of the solid bar is what they were not told.
 */
function arrivalChart(game) {
  const weeks = game.state.history.map((h) => {
    const c = h.byAdvertiser[game.playerId]?.conversions;
    return {
      round: h.round,
      landed: c?.final ?? 0,
      pending: c?.stillPending ?? 0,
      first: c?.asFirstReported ?? 0,
    };
  });
  if (weeks.length === 0) return null;

  // One scale for every row, or a week cannot be compared with the week above
  // it — which is the only thing this chart is for.
  const max = Math.max(...weeks.map((w) => w.landed + w.pending), 1);
  // Rounded, and anything under a twentieth of a percent snapped to zero. A
  // settled week's `stillPending` lands on floating-point crumbs rather than on
  // 0, and `width: 5.77183e-15%` is what that renders as.
  const pc = (n) => {
    const share = (100 * n) / max;
    return `${share < 0.05 ? 0 : Math.round(share * 100) / 100}%`;
  };
  const wrap = el('div', 'arrival');

  for (const w of weeks) {
    const row = el('div', 'arrival-row');
    row.append(el('div', 'k', `Week ${w.round}`));

    const track = el('div', 'track');
    const landed = el('div', 'fill landed');
    landed.style.width = pc(w.landed);
    track.append(landed);
    // Appended only when there is something to show, so `:only-child` can round
    // both ends of a finished week's bar.
    if (w.pending > 0.05) {
      const pending = el('div', 'fill pending');
      pending.style.width = pc(w.pending);
      track.append(pending);
    }

    // Where the figure stood when this week was on screen as "the week".
    if (w.first > 0 && w.first < w.landed) {
      const tick = el('div', 'arrival-tick');
      tick.style.left = pc(w.first);
      tick.title = `read as ${w.first.toFixed(1)} at the time, now ${w.landed.toFixed(1)}`;
      track.append(tick);
    }
    row.append(track);

    const v = el('div', 'v');
    v.append(el('span', null, w.landed.toFixed(1)));
    if (w.pending > 0.05) v.append(el('span', 'arrival-more', `+${w.pending.toFixed(1)}`));
    row.append(v);
    wrap.append(row);
  }

  const key = el('div', 'arrival-key');
  key.append(el('span', 'arrival-swatch landed'), el('span', null, 'landed'));
  key.append(el('span', 'arrival-swatch pending'), el('span', null, 'still to arrive'));
  key.append(el('span', 'arrival-swatch tick'), el('span', null, 'what you read at the time'));
  wrap.append(key);
  return wrap;
}

/** W11: what moved since the player last looked. */
function renderRevised(root, game) {
  const body = root.querySelector('[data-slot="revised-body"]');
  body.replaceChildren();

  const chart = arrivalChart(game);
  if (chart) {
    body.append(el('p', 'note arrival-lead',
      `A click is charged the moment it happens. Its conversions arrive over the `
      + `next three weeks — ${ARRIVAL_SHAPE} — and returns resolve two weeks after `
      + 'that. So the newest bars are the least finished, and the week you are '
      + 'reading now is the least finished of all.'));
    body.append(chart);
  }

  const revised = game.state.history.filter((h) => h.revisedAtRound != null);
  if (revised.length === 0) {
    body.append(el('p', 'muted',
      'Nothing has been rewritten yet. Conversions from this week start arriving '
      + 'next week, and they rewrite the week that earned them.'));
    return;
  }

  const latest = revised[revised.length - 1];
  const row = latest.byAdvertiser[game.playerId];
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

/**
 * Add up one breakdown across the rounds in view.
 *
 * Not economics — addition, of figures the engine produced. It reads
 * `state.history` rather than the reports the screen was handed, because
 * history is the copy that gets REVISED (11.4): a round's conversions keep
 * arriving for three more rounds and its returns resolve two after that.
 * Summing the reports as first issued would understate every settled week.
 *
 * @param {object} game
 * @param {'byQuery'|'byKeyword'} which
 * @param {'week'|'all'} range
 */
function accumulate(game, which, range) {
  const rounds = range === 'week' ? game.state.history.slice(-1) : game.state.history;

  const out = {};
  for (const stored of rounds) {
    const breakdown = stored.byAdvertiser?.[game.playerId]?.breakdown?.[which];
    for (const [id, r] of Object.entries(breakdown ?? {})) {
      const acc = out[id] ?? (out[id] = { impressions: 0, clicks: 0, costPaise: 0, conversions: 0 });
      acc.impressions += r.impressions ?? 0;
      acc.clicks += r.clicks ?? 0;
      acc.costPaise += r.costPaise ?? 0;
      acc.conversions += r.conversions ?? 0;
    }
  }
  return out;
}

/**
 * What each week of the CURRENT month has spent so far, by week index.
 *
 * A month is ROUNDS_PER_MONTH rounds, and a round's index within it is
 * `(round - 1) % ROUNDS_PER_MONTH` — the same arithmetic `buildBudgets` uses to
 * pick which week's budget to spend.
 */
function spentByWeekOfMonth(game) {
  const round = game.state.round;
  const monthStart = round - ((round - 1) % ROUNDS_PER_MONTH);
  const out = {};
  for (const stored of game.state.history) {
    if (stored.round < monthStart || stored.round >= monthStart + ROUNDS_PER_MONTH) continue;
    const row = stored.byAdvertiser?.[game.playerId];
    if (row) out[(stored.round - 1) % ROUNDS_PER_MONTH] = row.traffic.costPaise;
  }
  return out;
}

/**
 * 15.2 and 8.2: the search terms report, and the only route to negatives.
 * A button on the row is the whole interaction.
 *
 * IT DEFAULTS TO EVERY WEEK PLAYED rather than to the week just run. One week
 * is the wrong basis for a negative and the interface should not invite it: a
 * row showing no conversions today may show two next week, because W11's
 * revision has not finished with it. Blocking an unsettled zero is precisely
 * the mistake this report exists to expose.
 */
function renderTerms(root, game, ctx) {
  const range = game.view.termsRange;
  const rows = Object.entries(ctx.terms)
    .filter(([, r]) => r.impressions > 0)
    .sort((a, b) => b[1].costPaise - a[1].costPaise)
    .map(([id, r]) => {
      const text = ctx.texts.get(id) ?? id;
      const blocked = blocksTerm(game.draft, text);
      const named = brandNamedIn(text, ctx.advertisers ?? []);
      const brand = named && (named.id === game.playerId ? 'own' : 'rival');

      const button = el('button', 'add');
      button.type = 'button';
      button.textContent = blocked ? 'blocked' : 'block';
      button.disabled = Boolean(blocked);
      button.title = blocked
        ? `blocked by the ${blocked.matchType} negative "${blocked.text}"`
        : 'writes an exact negative for this search and nothing else';
      button.addEventListener('click', () => {
        addNegative(game.draft, { text, matchType: 'exact' });
        ctx.refresh();
      });

      // 3.1 makes brand bidding one of the four reasons this vertical exists,
      // and until now it ran every round with nothing on screen about it. A
      // rival's name in a search you are paying for is the single most likely
      // explanation for a row that takes clicks and returns nothing.
      const label = el('div');
      label.append(el('span', null, text));
      if (brand === 'own') {
        label.append(el('span', 'brand-tag own', 'your name'));
        label.title = 'Searches for your own brand. They convert far better than '
          + 'anything else you can buy, and a rival can bid on them too.';
      } else if (brand === 'rival') {
        label.append(el('span', 'brand-tag rival', `${named.name}'s name`));
        label.title = `A search for ${named.name}, not for you. Bidding on a rival's `
          + 'name is allowed and converts terribly — about a tenth of what the owner '
          + 'gets. If you did not choose this, a keyword of yours matched into it.';
      }

      return {
        className: blocked ? 'blocked-row' : (r.clicks >= 5 && r.conversions === 0 ? 'wasted' : null),
        cells: [
          label,
          whole(r.impressions),
          whole(r.clicks),
          rupees(r.costPaise),
          r.conversions > 0 ? r.conversions.toFixed(1) : '0',
          r.clicks > 0 ? rupees(r.costPaise / r.clicks) : '—',
          button,
        ],
      };
    });

  table(
    root.querySelector('[data-slot="terms-table"]'),
    ['Search term', { label: 'Impr', num: true }, { label: 'Clicks', num: true },
      { label: 'Cost', num: true }, { label: 'Conv', num: true }, { label: 'CPC', num: true }, ''],
    rows,
  );

  const played = game.state.history.length;
  const chips = root.querySelector('[data-slot="terms-range"]');
  chips.replaceChildren();
  for (const [key, label] of [
    ['all', `all ${played} week${played === 1 ? '' : 's'}`],
    ['week', 'this week only'],
  ]) {
    const chip = el('button', `chip small${range === key ? ' on' : ''}`, label);
    chip.type = 'button';
    chip.addEventListener('click', () => { game.view.termsRange = key; ctx.refresh(); });
    chips.append(chip);
  }

  const basis = range === 'week'
    ? 'One week, and none of it settled. A click takes three rounds to arrive and '
      + 'two more to survive its return window, so a zero in this column is not '
      + 'yet evidence of anything.'
    : 'Every week you have played, with conversions as they stand after revision. '
      + 'Block writes an exact negative for that one search; to catch a whole '
      + 'family of them at once, name the words below.';

  // Why the table is the size it is. A player who buys tight keywords gets a
  // report that mirrors their keyword list, reads it as "nothing happened", and
  // has no way to know that is the account rather than the game. The
  // explanation used to live only on the Negatives card, which is not where the
  // question gets asked.
  const shape = termsOutlook(game.draft, ctx.terms);
  let why = '';
  if (shape.mirrored) {
    why = ` Your ${shape.keywords} keyword${shape.keywords === 1 ? '' : 's'} matched `
      + `${shape.searches} search${shape.searches === 1 ? '' : 'es'} — one each, which `
      + 'means every row here is a search you already chose to buy. This report only '
      + 'shows you something new when a keyword reaches PAST the words it names'
      + (shape.broad === 0
        ? ', which is what broad match is for and what it costs.'
        : '; your broad keywords are not reaching far yet.');
  } else if (shape.played) {
    why = ` Your ${shape.keywords} keyword${shape.keywords === 1 ? '' : 's'} matched `
      + `${shape.searches} searches, about ${shape.perKeyword.toFixed(1)} each — so `
      + 'there is reach here you did not name, and that is what this table is for.';
  }

  root.querySelector('[data-slot="terms-note"]').textContent = basis + why;
}

/**
 * Where this account has advertised, and what each place actually paid.
 *
 * ORDERED BY WHAT A CLICK IS WORTH THERE, not by size, because the decision the
 * card exists for is where the next rupee should go rather than where the last
 * one went. Cost per click sits beside it so the comparison is a trade rather
 * than a ranking: the metros are usually both the best and the dearest.
 *
 * The bid adjustment is on the row it belongs to. Google's own location
 * targeting is a bid adjustment rather than a separate campaign, and putting the
 * control next to the evidence is the whole reason this is one card instead of
 * two.
 */
function renderPlaces(root, game, ctx) {
  const rows = locationRows(game.draft, game.state.history, game.playerId);
  const outlook = locationOutlook(rows);

  table(
    root.querySelector('[data-slot="places-table"]'),
    ['Where', { label: 'Clicks', num: true }, { label: 'Avg CPC', num: true },
      { label: 'Returned', num: true }, { label: 'Net per click', num: true },
      { label: 'Your bid', num: true }, ''],
    rows.map((row) => {
      const name = el('div');
      name.append(el('div', null, row.label));
      name.append(el('div', 'muted small', row.examples.slice(0, 3).join(', ')));

      const control = el('div', 'place-control');
      for (const percent of [-100, -30, 0, 30, 100]) {
        const chip = el('button', `chip small${row.adjustment === percent ? ' on' : ''}`);
        chip.type = 'button';
        chip.textContent = percent === 0 ? 'even' : `${percent > 0 ? '+' : ''}${percent}%`;
        chip.title = percent <= -100
          ? 'bid the minimum here, which is ₹1 and wins almost nothing'
          : `bid ${percent === 0 ? 'the same as everywhere' : `${percent}% ${percent > 0 ? 'more' : 'less'}`} here`;
        chip.addEventListener('click', () => {
          setLocation(game.draft, rows.indexOf(row), percent);
          // `refresh`, not `onChange`: staging a change has to redraw the
          // "Next week" card as well as this one, or a location adjustment is
          // the one decision in the form with no preview and no undo.
          ctx.refresh();
        });
        control.append(chip);
      }

      return {
        cells: [
          name,
          whole(row.clicks),
          row.cpcPaise == null ? '—' : rupees(row.cpcPaise),
          row.returnRate == null ? '—' : pct(row.returnRate, 1),
          row.netPerClickPaise == null ? '—' : rupees(row.netPerClickPaise),
          row.adjustment === 0 ? 'even' : `${row.adjustment > 0 ? '+' : ''}${row.adjustment}%`,
          control,
        ],
        className: outlook.best && row.id === outlook.best.id ? 'best-place' : null,
      };
    }),
  );

  root.querySelector('[data-slot="places-note"]').textContent = outlook.note;
}

function renderInsights(root, game) {
  const own = game.insights[game.insights.length - 1]?.[game.playerId];
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
function renderBudget(root, row, game) {
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
  // 13.2 asks for the pot AGAINST the weeks left to spend it in, and until the
  // report carried roundsRemainingInMonth the second half could not be drawn.
  legend.append(el('span', null,
    `${rupees(b.monthRemainingPaise)} left, ${b.roundsRemainingInMonth} `
    + `week${b.roundsRemainingInMonth === 1 ? '' : 's'} to spend it`));
  burn.append(track, legend);
  body.append(burn);

  const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const daily = el('table', 'mini');
  table(daily, ['Day', { label: 'Spend', num: true }],
    b.dailySpendPaise.map((p, i) => ({ cells: [day[i], rupees(p)] })));
  body.append(daily);

  body.append(el('p', 'note',
    'Unspent money is lost at the month boundary. There is no carry-over.'));

  // 13.3 asks for market context to be surfaced precisely so that money moving
  // between months is attributable. Month 3's pool is split by rank, and until
  // this existed the budget simply shrank in silence — a twelve-round account
  // went from ₹1,68,000 to ₹1,17,600 with nothing on screen saying why.
  const ranked = rankOf(game.state, game.playerId);
  if (ranked && b.monthlyBudgetPaise !== MONTHLY_BUDGET_PAISE) {
    const note = el('p', 'rank-note');
    note.append(document.createTextNode('This month is not the same size as the last two. You finished week 8 ranked '));
    note.append(el('strong', null, `${ranked.position} of ${ranked.of}`));
    note.append(document.createTextNode(
      ' on cumulative gross profit, and month 3 was split on that ranking — the '
      + 'pool is unchanged, only the shares moved. Gross, so returns were not '
      + 'netted off; and as reported at week 8, when attribution had not caught up.',
    ));
    body.append(note);
  }
}

function renderMarket(root, game) {
  const context = game.state.marketContext[game.state.marketContext.length - 1];
  if (!context) return;
  table(
    root.querySelector('[data-slot="market-table"]'),
    ['', { label: 'This week', num: true }],
    [
      { cells: ['Total market spend', rupees(context.totalMarketSpendPaise)] },
      { cells: ['Advertisers running', String(context.activeAdvertisers)] },
      { cells: ['Median CPC', rupees(context.medianCpcPaise)] },
      { cells: ['Searches this week', whole(game.state.querySet.weeklyVolume)] },
    ],
  );
}


/**
 * Draw one round for one advertiser, and the form that changes the next one.
 *
 * The search terms table and the decision form move together: blocking a row
 * greys that row out immediately, so the cost of a broad negative lands in the
 * report it was written from rather than being discovered next week. One
 * `ctx` carries what both of them need, and `ctx.refresh` — written back by
 * `renderDecisions` — redraws them as a pair.
 *
 * Nothing here writes to `game.state`. The form edits a draft built from
 * `getSelfView`, and `app.js` hands that draft back through the player's
 * controller, which is the only door a decision may enter by.
 *
 * @param {object} game the running game: state, reports, insights, playerId,
 *   draft, view
 * @param {Function} [onDecisionChange] so the header can say how much is staged
 * @returns {HTMLElement}
 */
export function renderDashboard(game, onDecisionChange) {
  const report = game.reports[game.reports.length - 1];
  const row = report.byAdvertiser[game.playerId];
  const root = document.getElementById('tpl-dashboard').content
    .cloneNode(true).firstElementChild;

  renderHeadline(root, row, game, game.playerId, report);
  renderShare(root, row);
  renderRevised(root, game);
  renderInsights(root, game);
  renderBudget(root, row, game);
  renderMarket(root, game);

  // The public view, not content/querySet.js: the form may see a search's
  // text, volume and intent and nothing else (16.1), and taking it from here
  // means that is enforced rather than merely intended.
  const view = getPublicView(game.state, game.playerId);
  const ctx = {
    draft: game.draft,
    queries: view.querySet,
    weeklyVolume: view.weeklyVolume,
    texts: new Map(view.querySet.map((q) => [q.id, q.text])),
    // Rival identity is public (R3), so a search carrying somebody's name can
    // be named as such. `brandOwner` itself is withheld (16.1) and is never
    // read — this is the same inference a player makes from the words.
    advertisers: view.advertisers,
    quality: row.quality,
    // The grader's own 1-10 for this ad, with the landing-page capital folded
    // in. The player's own data, and until now never on screen.
    grades: effectiveGrades(game.draft),
    money: row.money,
    // What a founder could research (17.2), from the same function round 0
    // uses — so the two screens cannot disagree about the grid.
    brief: briefing(game.state.querySet),
    // What each week of this month actually spent, so the split card can show
    // it beside what that week was planned. Addition of report figures.
    spentByWeek: spentByWeekOfMonth(game),
    terms: null,
    byKeyword: null,
    /** Both breakdowns follow whichever range the report is showing. */
    sync: () => {
      ctx.terms = accumulate(game, 'byQuery', game.view.termsRange);
      ctx.byKeyword = accumulate(game, 'byKeyword', game.view.termsRange);
    },
    onChange: () => {
      renderTerms(root, game, ctx);
      renderPlaces(root, game, ctx);
      onDecisionChange?.();
    },
  };
  ctx.sync();

  // Beside Auction Insights, which is the static this-week version of the same
  // six numbers. Everything it plots is already in `game.insights`.
  root.querySelector('[data-slot="trends"]').replaceWith(renderTrends({
    insights: game.insights,
    playerId: game.playerId,
    names: new Map(view.advertisers.map((a) => [a.id, a.name])),
    view: game.view,
  }));

  root.querySelector('[data-slot="decisions"]').replaceWith(renderDecisions(ctx));
  renderTerms(root, game, ctx);
  renderPlaces(root, game, ctx);
  return root;
}
