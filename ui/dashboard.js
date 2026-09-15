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
 *        is a primary surface rather than a buried table, and a search whose
 *        sales cost over twice the account's average is marked.
 */

import { el, add, table, figure, rupees, whole, pct, ratio } from './dom.js';
import { getPublicView } from '../engine/insights.js';
import { keywordReach } from '../engine/matching.js';
import { briefing } from '../setup.js';
import {
  renderDecisions, addNegative, blocksTerm, effectiveGrades, termsOutlook,
  locationRows, locationOutlook, setLocation, lastMonthBudget,
  averagePerSalePaise, isDear,
} from './decisions.js';
import { rankOf } from './ending.js';
import { renderTrends, insightMovers, marketChange } from './chart.js';
import { brandNamedIn } from '../content/brands.js';
import { RETURNS } from './words/returns.js';
import { MARKET } from './words/market.js';
import { whyButton } from './guide/drawer.js';
import { tagKeywordOffline } from '../agents/keywordTagger.js';
import {
  MONTHLY_BUDGET_PAISE, ROUNDS_PER_MONTH, DEFAULT_UNGRADED_QUALITY,
  ATTRIBUTION_LAG_DISTRIBUTION, RTO_FREIGHT_PAISE, RANK_BUDGET_MULTIPLIERS,
} from '../engine/constants.js';

/** 13.1's snapshot round, when `budgetSchedule` does not name its own. */
const RANK_SNAPSHOT_ROUND = 8;

/**
 * A click in round R is final at R+5: three rounds to arrive, two to resolve.
 * Exported for the field guide, which quotes it rather than deriving it again.
 */
export const SETTLES_AFTER_ROUNDS = ATTRIBUTION_LAG_DISTRIBUTION.length + 1;

/** "55% this week, then 28%, 12%, 5%", read off the constant it describes. */
export const ARRIVAL_SHAPE = ATTRIBUTION_LAG_DISTRIBUTION
  .map((share, i) => `${Math.round(100 * share)}%${i === 0 ? ' this week' : ''}`)
  .join(', then ')
  .replace(/, then (?=[^,]*$)/, ' and then ');

// ---------------------------------------------------------------------------
// Sentences that quote the state
// ---------------------------------------------------------------------------
//
// Each of these used to be a literal or a condition inside a render, and each
// said something the model did not do (reviews/slc-review.md, 9B and 9C). Out
// here they are a function of what they describe, and tested against it.

/**
 * When capital can be committed, in the weeks the player sees.
 *
 * The engine applies an allocation AT a round; the player makes it in the
 * form before that round runs, so round 1's is made at round 0 and round 5's
 * after week 4. The screens never call these "rounds", so neither does this.
 *
 * @param {number[]} allocationRounds - rounds an allocation is applied at
 * @returns {string} e.g. "before week 1 and before week 5"
 */
export function allocationWindowPhrase(allocationRounds) {
  const weeks = (allocationRounds ?? []).map((r) => `before week ${r}`);
  if (weeks.length === 0) return 'only in its allocation weeks';
  if (weeks.length === 1) return weeks[0];
  return `${weeks.slice(0, -1).join(', ')} and ${weeks[weeks.length - 1]}`;
}

/**
 * The player's own week-8 rank, and what it did to month 3.
 *
 * Told to every finisher. It used to be drawn only when month 3 differed from
 * MONTHLY_BUDGET_PAISE, which silenced exactly the position whose multiplier
 * is 1. Two integers and the player's own budget — nothing about the field (R3).
 *
 * @param {{position: number, of: number}|null} rank - from `rankOf`
 * @param {number} monthPaise - the player's month-3 budget, in paise
 * @param {number} snapshotRound - the round the ranking was taken at
 * @returns {string|null} null before the snapshot
 */
export function rankSentence(rank, monthPaise, snapshotRound) {
  if (!rank) return null;
  const lead = `You finished week ${snapshotRound} ranked ${rank.position} of ${rank.of} `
    + 'on cumulative gross profit';
  if (monthPaise === MONTHLY_BUDGET_PAISE) {
    return `${lead}, so month 3 is the same ${rupees(MONTHLY_BUDGET_PAISE)} as months 1 and 2.`;
  }
  const direction = monthPaise > MONTHLY_BUDGET_PAISE ? 'more than' : 'less than';
  return `${lead}, so month 3 is ${rupees(monthPaise)}, ${direction} the `
    + `${rupees(MONTHLY_BUDGET_PAISE)} of months 1 and 2.`;
}

/**
 * The line under the headline net profit.
 *
 * Returns resolve two rounds after the conversion that earned them, so the week
 * just played never has any: its "net profit" is gross less freight, shown in
 * the net slot. Saying so is the difference between a provisional figure and a
 * flattering one.
 *
 * @param {{grossProfitPaise: number, rtoFreightPaise: number}} money
 * @param {{final: number, returned: number}} conversions
 * @returns {string}
 */
export function profitSubLabel(money, conversions) {
  const freight = money.rtoFreightPaise > 0
    ? `, less ${rupees(money.rtoFreightPaise)} freight`
    : '';
  const unreturned = (conversions?.final ?? 0) > 0 && (conversions?.returned ?? 0) === 0
    ? ' · returns not in yet'
    : '';
  return `gross ${rupees(money.grossProfitPaise)}${freight}${unreturned}`;
}

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
      profitSubLabel(row.money, row.conversions),
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

/**
 * What came back, what it cost, and whether it is getting better (I31).
 *
 * WHY THIS CARD EXISTS. Build 2 charged ₹200 on every parcel refused at the
 * door and build 3 sold a ₹80,000 lever against it — and there was nowhere to
 * watch either. Returns appeared in exactly two places during a game: a
 * sub-label under net profit, and three columns on a card about GEOGRAPHY. No
 * account-level return rate existed at all until the end screen, by which point
 * nothing can be done about it.
 *
 * THE WEEK COLUMN IS THE POINT OF IT. `locationRows` sums every week played and
 * has no week/all toggle, so a capex landing at round 4 is permanently diluted
 * by rounds 1-3 and moves an average too slowly to read. A player could buy
 * order confirmation and never find out whether it worked. Here each week is its
 * own bar, so the round the investment lands is a step rather than a smudge.
 *
 * SETTLED WEEKS ARE MARKED, because a return needs two rounds after the
 * conversion and the conversion needs up to three after the click. Recent weeks
 * always understate, and a card that let a player read week 11 as good news
 * would be teaching the opposite of W11.
 */
function renderReturns(root, game, openGuide) {
  const history = game.state.history ?? [];
  const latest = history.length > 0 ? history[history.length - 1].round : 0;

  const weeks = history.map((h) => {
    const row = h.byAdvertiser[game.playerId];
    const c = row?.conversions ?? {};
    return {
      round: h.round,
      conversions: c.final ?? 0,
      refused: c.refused ?? 0,
      sentBack: c.sentBack ?? 0,
      freightPaise: row?.money?.rtoFreightPaise ?? 0,
      grossRevenuePaise: row?.money?.grossRevenuePaise ?? 0,
      grossProfitPaise: row?.money?.grossProfitPaise ?? 0,
      costPaise: row?.traffic?.costPaise ?? 0,
      // A click in round R is final at R+5 (3 for the order, 2 for the window).
      settled: latest - h.round >= SETTLES_AFTER_ROUNDS,
    };
  });

  const figures = root.querySelector('[data-slot="returns-figures"]');
  const body = root.querySelector('[data-slot="returns-weeks"]');
  const note = root.querySelector('[data-slot="returns-note"]');
  figures.replaceChildren();
  body.replaceChildren();

  const settled = weeks.filter((w) => w.settled);
  const sum = (rows, fn) => rows.reduce((a, r) => a + fn(r), 0);
  const freightAll = sum(weeks, (w) => w.freightPaise);

  if (settled.length === 0) {
    note.textContent = RETURNS.nothingSettled({
      settlesAfter: SETTLES_AFTER_ROUNDS,
      firstHonestWeek: SETTLES_AFTER_ROUNDS + 1,
    });
    add(note, whyButton(RETURNS.nothingSettled, openGuide));
    return;
  }

  const conv = sum(settled, (w) => w.conversions);
  const refused = sum(settled, (w) => w.refused);
  const sentBack = sum(settled, (w) => w.sentBack);
  const rate = (n) => (conv > 0 ? n / conv : 0);

  // What one refused parcel is actually worth, from this account's own figures
  // rather than from a constant — the arithmetic the player would otherwise do
  // by hand. Margin is recovered from the gross figures, which carry no freight.
  let codClicks = 0;
  let codWeighted = 0;
  for (const h of history) {
    const rows = h.byAdvertiser[game.playerId]?.breakdown?.byLocation ?? {};
    for (const row of Object.values(rows)) {
      if (row.codShare == null) continue;
      codClicks += row.clicks ?? 0;
      codWeighted += (row.clicks ?? 0) * row.codShare;
    }
  }
  const codShare = codClicks > 0 ? codWeighted / codClicks : null;

  const grossRev = sum(settled, (w) => w.grossRevenuePaise);
  const grossProfit = sum(settled, (w) => w.grossProfitPaise);
  const spend = sum(settled, (w) => w.costPaise);
  const marginPct = grossRev > 0 ? (grossProfit + spend) / grossRev : 0;
  const aovPaise = conv > 0 ? grossRev / conv : 0;
  const perRefusal = aovPaise * marginPct + RTO_FREIGHT_PAISE;

  add(
    figures,
    figure(RETURNS.cameBack(), pct(rate(refused + sentBack), 1),
      RETURNS.cameBackSub({ returned: whole(refused + sentBack), orders: whole(conv) })),
    figure(RETURNS.refused(), pct(rate(refused), 1), RETURNS.refusedSub({ refused: whole(refused) }),
      rate(refused) > 0.08 ? 'neg' : null),
    figure(RETURNS.sentBack(), pct(rate(sentBack), 1), RETURNS.sentBackSub({ sentBack: whole(sentBack) })),
    figure(RETURNS.freight(), rupees(freightAll),
      RETURNS.freightSub({ perParcel: rupees(RTO_FREIGHT_PAISE) })),
    // WHY the split is what it is, and the only figure here a player can change
    // by moving their money rather than by buying something.
    codShare == null ? null : figure(RETURNS.paidAtDoor(), pct(codShare), RETURNS.paidAtDoorSub()),
  );
  const paidAtDoor = codShare == null ? null : figures.lastElementChild?.querySelector('.label');
  if (paidAtDoor) add(paidAtDoor, whyButton(RETURNS.paidAtDoor, openGuide));

  const max = Math.max(...weeks.map((w) => w.refused + w.sentBack), 1);
  const pc = (n) => {
    const share = (100 * n) / max;
    return `${share < 0.05 ? 0 : Math.round(share * 100) / 100}%`;
  };
  const wrap = el('div', 'arrival');
  for (const w of weeks) {
    const line = el('div', `arrival-row${w.settled ? '' : ' unsettled'}`);
    line.append(el('div', 'k', RETURNS.week({ round: w.round })));
    const track = el('div', 'track');
    const bad = el('div', 'fill refused');
    bad.style.width = pc(w.refused);
    track.append(bad);
    if (w.sentBack > 0.05) {
      const soft = el('div', 'fill sent-back');
      soft.style.width = pc(w.sentBack);
      track.append(soft);
    }
    line.append(track);
    const v = el('div', 'v');
    v.append(el('span', null, w.conversions > 0
      ? pct((w.refused + w.sentBack) / w.conversions, 0) : '—'));
    if (!w.settled) v.append(el('span', 'arrival-more', RETURNS.stillIn()));
    line.append(v);
    wrap.append(line);
  }
  const key = el('div', 'arrival-key');
  key.append(el('span', 'arrival-swatch refused'), el('span', null, RETURNS.keyRefused()));
  key.append(el('span', 'arrival-swatch sent-back'), el('span', null, RETURNS.keySentBack()));
  add(key, whyButton(RETURNS.keyRefused, openGuide));
  wrap.append(key);
  body.append(wrap);

  note.replaceChildren();
  note.append(el('strong', null, RETURNS.refusalCost({ perRefusal: rupees(perRefusal) })));
  note.append(document.createTextNode(` ${RETURNS.refusalCostParts({
    freight: rupees(RTO_FREIGHT_PAISE),
    margin: rupees(aovPaise * marginPct),
  })} `));

  // I33: THREE LEVERS, AND WHICH OF THEM IS AVAILABLE THIS WEEK. The card was
  // a statistic without this — a player watched a number they had no way to
  // move, because capital closes at round 5 and nothing named the two levers
  // that never close. Same complaint I24 makes about the location card:
  // it states a fact and names none.
  const allocations = game.state.budgetSchedule?.capexAllocationRounds ?? [];
  const capexOpen = allocations.includes(game.state.round);
  note.append(el('strong', null, `${RETURNS.leversHead()} `));
  note.append(document.createTextNode(`${RETURNS.levers()} ${capexOpen
    ? RETURNS.capitalOpen()
    : RETURNS.capitalShut({ window: allocationWindowPhrase(allocations) })}`));

  note.append(document.createTextNode(` ${RETURNS.countedWeeks({
    first: settled[0].round,
    last: latest - SETTLES_AFTER_ROUNDS,
  })}`));
  add(note, whyButton(RETURNS.countedWeeks, openGuide));
}

/**
 * Your own running total against the week-8 deadline (I33).
 *
 * R3 IS NOT LIFTED HERE AND MUST NOT BE. I7 records this request being made
 * before — a chart of all nine "to evaluate who has the current lead" — and
 * refused: the lead is cumulative gross profit and that is exactly what an
 * advertiser may not read about anybody else. `finalStandings` opens the books
 * only because the game is over and nothing can change.
 *
 * So this card carries THE PLAYER'S OWN FIGURE, the published rule, and the
 * published multipliers. Not one number on it belongs to a rival, and the note
 * says so rather than letting the omission read as an oversight.
 *
 * WHY IT EXISTS. Month 3's budget is allocated on cumulative gross profit at
 * week 8, the rule is announced at round 1 — and nothing on the dashboard showed
 * that total accumulating. The player was being ranked on a number they could
 * not watch. Same shape as I16, I24 and I31.
 *
 * The budget card already explains the outcome AFTER the snapshot, including
 * D4's two traps. This is the half that was missing: the part you can still act
 * on.
 */
function renderDeadline(root, row, game) {
  const figures = root.querySelector('[data-slot="deadline-figures"]');
  const note = root.querySelector('[data-slot="deadline-note"]');
  const snapshot = game.state.budgetSchedule?.rankSnapshotRound ?? RANK_SNAPSHOT_ROUND;
  const history = game.state.history ?? [];
  const latest = history.length > 0 ? history[history.length - 1].round : 0;

  // Exactly what `rankByGrossProfit` sums: cumulative gross profit over the
  // rounds up to and including the snapshot, and no further.
  const counted = history.filter((h) => h.round <= snapshot);
  const total = counted.reduce(
    (a, h) => a + (h.byAdvertiser[game.playerId]?.money?.grossProfitPaise ?? 0), 0,
  );
  const weeksLeft = Math.max(0, snapshot - latest);
  const taken = latest >= snapshot;

  figures.replaceChildren();
  add(
    figures,
    figure(taken ? `Counted at week ${snapshot}` : 'Counted so far', rupees(total),
      `gross profit, weeks 1 to ${Math.min(latest, snapshot)}`),
    figure(taken ? 'Snapshot' : 'Weeks left',
      taken ? 'taken' : String(weeksLeft),
      taken ? 'month 3 is already split' : `week ${snapshot} is the cut-off`),
  );

  // What each place is worth, in rupees rather than as a multiplier — a player
  // cannot spend 1.30.
  table(
    root.querySelector('[data-slot="deadline-ladder"]'),
    ['Finish', { label: 'Month 3 budget', num: true }, { label: 'Against average', num: true }],
    RANK_BUDGET_MULTIPLIERS.map((m, i) => ({
      cells: [
        `${i + 1}${i === 0 ? 'st' : i === 1 ? 'nd' : i === 2 ? 'rd' : 'th'}`,
        rupees(MONTHLY_BUDGET_PAISE * m),
        `${m > 1 ? '+' : ''}${Math.round(100 * (m - 1))}%`,
      ],
      className: m === 1 ? 'muted-row' : null,
    })),
  );

  const first = MONTHLY_BUDGET_PAISE * RANK_BUDGET_MULTIPLIERS[0];
  const last = MONTHLY_BUDGET_PAISE * RANK_BUDGET_MULTIPLIERS[RANK_BUDGET_MULTIPLIERS.length - 1];
  note.replaceChildren();
  note.append(el('strong', null,
    `${rupees(first - last)} separates first from last`));
  note.append(document.createTextNode(
    ' in month 3, on a pool that does not change size — only the shares move. '
    + 'The figure above is GROSS profit, so what came back is not netted off, and '
    + `it is counted as reported at week ${snapshot}, before attribution has caught up. `
    // D4: the two halves pull opposite ways. Gross flatters traffic that sells
    // and comes back; the early reading penalises spend near the deadline. The
    // sentence used to say both "reward spending that looks better than it is".
    + 'Both are the rule rather than a mistake, and they pull in opposite '
    + 'directions: gross flatters traffic that sells and then comes back, while '
    + 'the early reading makes spending near the deadline look worse than it is, '
    + 'because a late click shows all of its cost and only part of its revenue. ',
  ));
  const rank = taken ? rankOf(game.state, game.playerId) : null;
  const told = rank ? rankSentence(rank, monthAhead(game, row), snapshot) : null;
  note.append(told
    ? el('strong', null, told)
    : el('em', null,
      'Nothing here tells you where you stand against the other eight yet. At '
      + `week ${snapshot} you learn your own rank and nobody else's — a real `
      + 'account never shows you a rival’s profit, and neither does this one '
      + 'until the last week is played.'));
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
      const acc = out[id] ?? (out[id] = {
        impressions: 0, clicks: 0, costPaise: 0, conversions: 0,
        returned: 0, returnedRevenuePaise: 0,
      });
      acc.impressions += r.impressions ?? 0;
      acc.clicks += r.clicks ?? 0;
      acc.costPaise += r.costPaise ?? 0;
      acc.conversions += r.conversions ?? 0;
      // I32: which search sent it back, so a negative can be written on return
      // grounds rather than only on "took clicks and never converted".
      acc.returned += r.returned ?? 0;
      acc.returnedRevenuePaise += r.returnedRevenuePaise ?? 0;
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
  // The comparison every row is marked against, over exactly the rows on screen
  // so the table and its highlighting cannot disagree about the period.
  const totals = Object.values(ctx.terms).reduce(
    (a, r) => ({ conv: a.conv + (r.conversions ?? 0), ret: a.ret + (r.returned ?? 0) }),
    { conv: 0, ret: 0 },
  );
  const accountReturnRate = totals.conv > 0 ? totals.ret / totals.conv : 0;
  const averagePaise = averagePerSalePaise(ctx.terms);
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

      // I32: the return rate of this SEARCH, invisible until the returns were
      // attributed back here.
      //
      // MARKED AGAINST THIS ACCOUNT'S OWN RATE, not against a fixed threshold.
      // The first version used 34% and never fired, because a mid|lifestyle
      // account runs at 20-22% and a value one runs higher — an absolute cut-off
      // marks a whole cell or none of it. What a player can act on is a search
      // returning worse than THEIR OTHER SEARCHES, which is the comparison a
      // negative is actually made on.
      // `returned` is a SUBSET of `conversions`, not a separate cohort: an
      // order is counted when it lands and counted again when it comes back.
      // Dividing by the sum double-counts and understates every rate.
      const returnRate = r.conversions > 0 ? r.returned / r.conversions : null;
      const worse = returnRate != null && accountReturnRate > 0
        && returnRate > accountReturnRate * 1.15;
      const returns = el('span', worse ? 'bad' : null);
      returns.textContent = returnRate == null ? '—' : pct(returnRate, 0);
      returns.title = returnRate == null
        ? 'nothing has come back from this search yet'
        : `${r.returned.toFixed(1)} of ${r.conversions.toFixed(1)} orders came back, `
          + `${rupees(r.returnedRevenuePaise)} of revenue`
          + (worse ? `. That is worse than your account's ${pct(accountReturnRate, 0)}.` : '');

      // What a sale cost on this search, marked beside the returns and in the
      // same way: against this account, not a fixed line. It replaced "five
      // clicks and no conversion", which the game's fractional sales only ever
      // met on a search nobody buys from (`isDear`, DECISIONS I8).
      const dear = isDear(r, averagePaise);
      const perSale = el('span', dear ? 'bad' : null);
      perSale.textContent = r.conversions > 0 ? rupees(r.costPaise / r.conversions) : 'no sale';
      if (averagePaise === null) {
        perSale.title = 'nothing in this report has sold yet, so there is no average to hold it against';
      } else if (r.conversions > 0) {
        perSale.title = `${rupees(r.costPaise / r.conversions)} a sale, `
          + (dear ? 'over twice' : 'against')
          + ` your average of ${rupees(averagePaise)}`;
      } else {
        perSale.title = dear
          ? `${rupees(r.costPaise)} and no sale, more than a sale costs you on average `
            + `(${rupees(averagePaise)})`
          : `no sale yet, on less than a sale costs you on average (${rupees(averagePaise)})`;
      }

      return {
        className: blocked ? 'blocked-row' : null,
        cells: [
          label,
          whole(r.impressions),
          whole(r.clicks),
          rupees(r.costPaise),
          r.conversions > 0 ? r.conversions.toFixed(1) : '0',
          perSale,
          returns,
          r.clicks > 0 ? rupees(r.costPaise / r.clicks) : '—',
          button,
        ],
      };
    });

  table(
    root.querySelector('[data-slot="terms-table"]'),
    ['Search term', { label: 'Impr', num: true }, { label: 'Clicks', num: true },
      { label: 'Cost', num: true }, { label: 'Conv', num: true },
      { label: 'Per sale', num: true }, { label: 'Came back', num: true },
      { label: 'CPC', num: true }, ''],
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
      { label: 'Paid at door', num: true },
      { label: 'Refused', num: true }, { label: 'Sent back', num: true },
      // Two lines each, or the card overflows at 1024px (style.css says how much).
      { label: 'Revenue\nper click', num: true },
      { label: 'Kept\nper click', num: true },
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

      // I28: the two halves of the return rate, side by side, because they are
      // different events and only one of them a size guide can do anything
      // about. `Paid at door` is the reason they differ and belongs beside them.
      const refused = el('span', row.refusedRate > 0.08 ? 'bad' : null);
      refused.textContent = row.refusedRate == null ? '—' : pct(row.refusedRate, 1);
      refused.title = row.refusedShare == null
        ? 'no returns from here yet'
        : `${pct(row.refusedShare)} of the returns from here never got through the door`;

      return {
        cells: [
          name,
          whole(row.clicks),
          row.cpcPaise == null ? '—' : rupees(row.cpcPaise),
          row.codShare == null ? '—' : pct(row.codShare),
          refused,
          row.sentBackRate == null ? '—' : pct(row.sentBackRate, 1),
          row.netPerClickPaise == null ? '—' : rupees(row.netPerClickPaise),
          row.keptPerClickPaise == null ? '—' : rupees(row.keptPerClickPaise),
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

  // The week month 3's budgets take effect, rivals move 2.40 times an ordinary
  // week (D12, C8). Say who moved and how far, and not why: whose budget grew
  // is private (R3), and the market card has already said what took effect.
  if (reSplitWeek(game)) {
    const movers = insightMovers(game.insights, game.playerId, names);
    root.querySelector('[data-slot="insights"]').append(el('p', 'note insight-movers', movers.length > 0
      ? MARKET.moved({ movers: movers.map((m) => MARKET.mover({ name: m.name, from: pct(m.from), to: pct(m.to) })) })
      : MARKET.nobodyMoved()));
  }
}

/**
 * Is the week just played the first week of the month the ranking re-split?
 *
 * Month 3's budgets are shared out by the week-8 rank and take effect in week 9.
 * After C8's fix that is the week the market changes most: a median 26% less
 * spent across the market, against about 1% in an ordinary week.
 */
function reSplitWeek(game) {
  const snapshot = game.state.budgetSchedule?.rankSnapshotRound ?? RANK_SNAPSHOT_ROUND;
  return game.reports[game.reports.length - 1]?.round === snapshot + 1;
}

/**
 * The budget of the month the NEXT week runs in.
 *
 * Not the report row's: a report describes the week just played, so at the
 * week-8 dashboard it still carries month 2 - including any capital rolled in at
 * round 5 - while the rank has already bought month 3. Found by playing it: a
 * 5th-place player read "month 3 is ₹2,88,000, more than ₹1,68,000". The draft
 * is rebuilt from getSelfView after every week, so it holds the month ahead.
 */
function monthAhead(game, row) {
  return game.draft?.monthlyBudgetPaise ?? row.budget.monthlyBudgetPaise;
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
  //
  // Told to every finisher, including the one whose month did not move: the
  // condition used to be "month 3 differs from the base", which is false for
  // exactly one position and left that player never told (slc-review 9C).
  const snapshot = game.state.budgetSchedule?.rankSnapshotRound ?? RANK_SNAPSHOT_ROUND;
  const told = rankSentence(rankOf(game.state, game.playerId), monthAhead(game, row), snapshot);
  if (told) {
    const note = el('p', 'rank-note');
    note.append(el('strong', null, told));
    note.append(document.createTextNode(
      ' The pool is unchanged; only the shares moved. Gross, so returns were not '
      + `netted off; and as reported at week ${snapshot}, when attribution had not caught up.`,
    ));
    body.append(note);
  }
}

function renderMarket(root, game) {
  const context = game.state.marketContext[game.state.marketContext.length - 1];
  if (!context) return;
  // Last week beside this week, so a shift in the market can be seen at all.
  // The table used to show one week alone, and the week-9 re-split, the largest
  // change the market makes, went by without a number moving next to another.
  const previous = game.state.marketContext[game.state.marketContext.length - 2];
  const before = (show) => (previous ? show(previous) : '—');
  const searches = whole(game.state.querySet.weeklyVolume);
  table(
    root.querySelector('[data-slot="market-table"]'),
    ['', { label: MARKET.thisWeek(), num: true }, { label: MARKET.lastWeek(), num: true }],
    [
      { cells: ['Total market spend', rupees(context.totalMarketSpendPaise), before((c) => rupees(c.totalMarketSpendPaise))] },
      { cells: ['Advertisers running', String(context.activeAdvertisers), before((c) => String(c.activeAdvertisers))] },
      { cells: ['Median CPC', rupees(context.medianCpcPaise), before((c) => rupees(c.medianCpcPaise))] },
      { cells: ['Searches', searches, before(() => searches)] },
    ],
  );

  // The one week the market's money is re-split (D12, C8): the rule is public,
  // announced at round 1 (D4), and so is the market's total spend (D8).
  const change = marketChange(game.state.marketContext);
  if (reSplitWeek(game) && change) {
    const round = game.reports[game.reports.length - 1].round;
    root.querySelector('[data-slot="market"]').append(el('p', 'note market-month', MARKET.newMonth({
      month: Math.ceil(round / ROUNDS_PER_MONTH),
      snapshot: round - 1,
      spent: rupees(change.thisWeekPaise),
      before: rupees(change.lastWeekPaise),
    })));
  }
}


/**
 * What the decision form is handed to draw from: the account's own figures,
 * the public view, and lookups that answer without handing over what they read.
 *
 * The half of the form's context that needs no page, so a test can read what
 * the cards read without drawing them. `renderDashboard` adds the half that
 * does — the guide, the report's range and the redraws.
 *
 * @param {object} game the running game: state, reports, playerId, draft
 * @param {object} [view] the player's public view, when the caller already
 *   has one
 * @returns {object} built afresh each week, when the dashboard is drawn
 */
export function formContext(game, view = getPublicView(game.state, game.playerId)) {
  const row = game.reports[game.reports.length - 1].byAdvertiser[game.playerId];
  return {
    draft: game.draft,
    // The public view, not content/querySet.js: the form may see a search's
    // text, volume and intent and nothing else (16.1), and taking it from here
    // means that is enforced rather than merely intended.
    queries: view.querySet,
    // The form adds keywords from the public view, which has no tags; this is
    // the one thing it may ask of the full set, and the lookup happens in
    // agents/keywordTagger.js rather than here (E9).
    tagKeyword: (keyword) => tagKeywordOffline(keyword, game.state.querySet),
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
    // The month just played, which the capital card reads its choice against
    // (D12). The player's own report, so nothing R3 withholds.
    lastMonth: lastMonthBudget(game.state.history, game.playerId, game.state.round),
    // How many searches a keyword matches, as a count only: the matching reads
    // the full set's tags, which the view withholds, and hands back a number,
    // as Keyword Planner forecasts a keyword without its workings (E8).
    reach: (keyword) => keywordReach(keyword, game.state.querySet),
    // This account's own places, the rows the places card draws, which the
    // prepaid card weights its refusal rate by. The rows and never the history
    // they are summed from: `state.history` holds all nine advertisers'
    // reports, and the form may only know what a controller could.
    places: () => locationRows(game.draft, game.state.history, game.playerId),
  };
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
export function renderDashboard(game, onDecisionChange, { openGuide } = {}) {
  const report = game.reports[game.reports.length - 1];
  const row = report.byAdvertiser[game.playerId];
  const root = document.getElementById('tpl-dashboard').content
    .cloneNode(true).firstElementChild;

  renderHeadline(root, row, game, game.playerId, report);
  renderShare(root, row);
  renderReturns(root, game, openGuide);
  renderDeadline(root, row, game);
  renderRevised(root, game);
  renderInsights(root, game);
  renderBudget(root, row, game);
  renderMarket(root, game);

  const view = getPublicView(game.state, game.playerId);
  const ctx = {
    ...formContext(game, view),
    // So a card on the form can carry a "why?" into the field guide.
    openGuide,
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
