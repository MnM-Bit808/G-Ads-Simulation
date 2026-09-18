/**
 * The Studio's Results area (design/results/, chosen by the owner 2026-09-15):
 * four sections after the last week. Twelve weeks, the result and every week
 * against its first report; What you learned, the lessons, the weeks you
 * changed something and the budget question; Where they sat, round 0's ads
 * and squares, guessed and revealed; Everyone's books, every brand's results
 * and Play again.
 *
 * What it shows is worked out in ./read.js and ui/debrief/read.js; the words
 * are ui/words/results.js and ui/words/debrief.js. The classic end screen
 * (ui/ending.js) is untouched and still draws for the classic look.
 *
 * STATE LIVES AS LONG AS THE FINISHED GAME: the week tapped, the answers the
 * replays gave, the guesses and whether they were revealed. The shell keeps
 * one of these per game, so moving between sections loses nothing; a reload
 * starts the reveal afresh, as the classic one does (plans/2026-09-13-debrief.md).
 *
 * THE REPLAYS ARE ON DEMAND AND PAUSE BETWEEN WEEKS, as the classic's do: a
 * week takes about a fifth of a second in a browser, and a frozen page reads
 * as a crash.
 */

import { el, add, rupees, whole, pct, ratio } from '../dom.js';
import { button } from '../kit/controls.js';
import { serp } from '../kit/serp.js';
import { whyButton } from '../guide/drawer.js';
import { replayRound } from '../../game.js';
import { AD } from '../words/ad.js';
import { DEBRIEF } from '../words/debrief.js';
import { RESULTS, TARGET_WORDS, ordinal } from '../words/results.js';
import { PLAYTEST } from '../words/playtest.js';
import { R0, cellWords, PRICE_WORD, PURPOSE_WORD } from '../words/roundZero.js';
import { SECTIONS } from '../shell/sections.js';
import {
  moments, windowDifference, budgetWeeks, lessons, logWithoutChange,
} from '../debrief/read.js';
import { budgetLines, lessonSentence } from '../debrief/render.js';
import { chartRange, barPlace } from '../week/read.js';
import {
  seasonBars, seasonFigures, firstReportsTotal, lateWeeks, settledThrough, capitalReading, booksRows,
  finishing, revealReading, meetMostOverGame,
} from './read.js';
import { RETURNS_RESOLVE_AFTER_ROUNDS } from '../dashboard.js';
import { PRICE_TIERS, PURPOSES, ROUNDS_PER_MONTH } from '../../engine/constants.js';

/** The chart's bars, px; the room under them for a losing week's figure is its own. */
const BARS_PX = 200;
/** The reveal's answers arrive 50ms apart (plans/2026-09-13-debrief.md, section 6). */
const REVEAL_STAGGER_MS = 50;

/** Money as the Studio prints it: a loss with a minus sign, never a hyphen. */
const money = (paise) => `${paise < 0 ? '−' : ''}${rupees(Math.abs(paise))}`;
const signed = (paise) => (paise === 0 ? '' : `${paise > 0 ? '+' : '−'}${rupees(Math.abs(paise))}`);
const one = (n) => n.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const label = (key) => SECTIONS.find((s) => s.key === key)?.label ?? key;

/** Replay the game from its start, a week at a time, as the classic end screen does. */
async function replay(initial, logAt, throughRound, options, onWeek) {
  let state = initial;
  while (state.round <= throughRound) {
    const out = replayRound(state, logAt(state), { mode: 'expected', ...options });
    state = out.nextGameState;
    onWeek?.(out.round, throughRound);
    await new Promise((resolve) => { setTimeout(resolve, 0); });
  }
  return state;
}

/**
 * @param {object} args
 * @param {object} args.game - the finished game: `state`, `initial`, `playerId`,
 *   `opening`, `insights`, `notes`
 * @param {Function} [args.openGuide] - `guide.open`
 * @param {(key: string) => void} args.openSection - the shell's `open`
 * @param {(market: 'same'|'new') => void} [args.onRestart]
 * @param {{recorder: object, onDownload: () => void}|null} [args.playtest] - on the
 *   playtest link, the recorder the answers are typed into and the file's button
 * @returns {{node: (key: string) => HTMLElement, game: object}}
 */
export function renderResults({ game, openGuide, openSection, onRestart = null, playtest = null }) {
  const { state: finished, playerId } = game;
  const history = finished.history;
  const decisionLog = finished.decisionLog;
  const lastRound = history.length;
  const allocationRounds = finished.budgetSchedule?.capexAllocationRounds ?? [];
  const snapshot = finished.budgetSchedule?.rankSnapshotRound ?? 2 * ROUNDS_PER_MONTH;
  const me = finished.advertisers.find((a) => a.id === playerId);
  const bars = seasonBars(history, playerId, { decisionLog, opening: game.opening, lastRound });
  const picked = moments({
    history, decisionLog, playerId, opening: game.opening, allocationRounds,
    roundsPerMonth: ROUNDS_PER_MONTH, lastRound,
  });

  const view = {
    week: [...bars].reverse().find((b) => b.changed)?.round ?? lastRound,
    answers: new Map(),
    budget: null,
    busy: false,
    guesses: {},
    revealed: 'no',
    arrive: false,
    restart: false,
  };
  const parts = {
    twelve: el('div', 'rs'), learned: el('div', 'rs'), reveal: el('div', 'rs'), books: el('div', 'rs'),
    playtest: el('div', 'rs'),
  };

  const why = (entry) => whyButton(entry, openGuide);
  const para = (className, text, entry = null) => {
    const p = el('p', className, text);
    add(p, entry?.why ? why(entry) : null);
    return p;
  };
  const next = (key) => {
    const b = button('rs-next', RESULTS.next({ section: label(key) }));
    b.addEventListener('click', () => openSection(key));
    return b;
  };
  const card = (className, slot) => {
    const node = el('div', className);
    if (slot) node.dataset.slot = slot;
    return node;
  };
  const dot = () => {
    const d = el('i', 'rs-dot');
    d.setAttribute('aria-hidden', 'true');
    return d;
  };

  // --- Twelve weeks -----------------------------------------------------------

  function stat(name, value, sub, loss = false) {
    const box = el('div', 'rs-stat');
    const big = el('strong', loss ? 'rs-big loss' : 'rs-big', value);
    box.append(el('span', 'rs-label', name), big, el('span', 'rs-sub', sub));
    return box;
  }

  function weekColumn(b, range) {
    const col = button(b.round === view.week ? 'rs-col on' : 'rs-col');
    col.dataset.round = String(b.round);
    col.setAttribute('aria-pressed', String(b.round === view.week));
    col.setAttribute('aria-label', `${RESULTS.weekOf({ n: b.round })}: ${money(b.netPaise)}, ${RESULTS.firstReported()} ${money(b.beforePaise)}`);
    const plot = el('div', 'rs-plot');
    const now = barPlace(b.netPaise, range);
    const was = barPlace(b.beforePaise, range);
    const zero = el('span', 'rs-zero');
    zero.style.bottom = `${100 * now.zero}%`;
    const bar = el('span', now.below ? 'rs-bar below' : 'rs-bar');
    if (now.below) bar.classList.add('loss');
    bar.style.bottom = `${100 * (now.below ? now.zero - now.size : now.zero)}%`;
    bar.style.height = `${100 * now.size}%`;
    const tick = el('span', 'rs-tick');
    tick.style.bottom = `${100 * (was.below ? was.zero - was.size : was.zero + was.size)}%`;
    const top = Math.max(now.below ? now.zero : now.zero + now.size, was.below ? now.zero : was.zero + was.size);
    const value = el('span', b.netPaise < 0 ? 'rs-value loss' : 'rs-value', money(b.netPaise));
    value.style.bottom = `calc(${100 * top}% + 5px)`;
    for (const part of [zero, bar, tick]) part.setAttribute('aria-hidden', 'true');
    plot.append(zero, bar, tick, value);
    const foot = el('span', 'rs-foot');
    const number = el('span', 'rs-week', String(b.round));
    if (b.changed) number.append(dot());
    foot.append(number, el('span', 'rs-change', signed(b.changePaise)));
    col.append(plot, foot);
    col.addEventListener('click', () => {
      view.week = b.round;
      drawTwelve();
      parts.twelve.querySelector(`.rs-col[data-round="${b.round}"]`)?.focus();
    });
    return col;
  }

  function weekStrip(b) {
    const strip = el('div', 'rs-strip');
    const first = el('div', 'rs-block');
    let status = RESULTS.weekSettled();
    if (!b.settled) status = b.stillPending >= 0.01 ? RESULTS.weekArriving({ n: one(b.stillPending) }) : RESULTS.weekReturnsToCome();
    const figs = el('div', 'rs-then');
    const pair = (name, value, className) => {
      const box = el('span', 'rs-pairfig');
      box.append(el('span', 'rs-label', name), el('strong', className, value));
      return box;
    };
    figs.append(
      pair(RESULTS.firstReported(), money(b.beforePaise), b.beforePaise < 0 ? 'loss' : null),
      pair(RESULTS.now(), money(b.netPaise), b.netPaise < 0 ? 'loss' : null),
      pair(RESULTS.change(), signed(b.changePaise) || RESULTS.noChange(), 'rs-quiet'),
    );
    first.append(el('h4', null, RESULTS.weekOf({ n: b.round })), el('p', 'rs-sub', status), figs);
    const did = el('div', 'rs-block');
    did.append(el('span', 'rs-label', RESULTS.whatYouDid()));
    if (b.did.length > 0) {
      const list = el('ul', 'rs-did');
      for (const text of b.did) {
        const item = el('li');
        item.append(dot(), el('span', null, text));
        list.append(item);
      }
      did.append(list);
    } else did.append(el('p', 'rs-read', RESULTS.didNothing()));
    const ran = el('div', 'rs-block');
    ran.append(el('span', 'rs-label', RESULTS.theWeek()), el('p', 'rs-read', RESULTS.weekRan({
      spent: money(b.costPaise), clicks: whole(b.clicks), shown: pct(b.impressionShare),
      budget: pct(b.lostToBudget), rank: pct(b.lostToRank),
    })));
    strip.append(first, did, ran);
    return strip;
  }

  function drawTwelve() {
    const f = seasonFigures(history, playerId);
    const settled = settledThrough(lastRound);
    const late = lateWeeks(bars, lastRound, RETURNS_RESOLVE_AFTER_ROUNDS);
    const figures = card('rs-figures', 'results-figures');
    figures.append(
      stat(RESULTS.netProfit(), money(f.netProfitPaise), RESULTS.gross({ amount: money(f.grossProfitPaise) }), f.netProfitPaise < 0),
      stat(RESULTS.spend(), money(f.costPaise), RESULTS.clicks({ n: whole(f.clicks) })),
      stat(RESULTS.conversions(), one(f.conversions), RESULTS.cameBack({ n: one(f.returned) })),
      stat(RESULTS.netRevenue(), money(f.netRevenuePaise), RESULTS.gross({ amount: money(f.grossRevenuePaise) })),
      stat(RESULTS.netRoas(), ratio(f.netRoas), RESULTS.netRoasSub()),
      stat(RESULTS.settled(), RESULTS.settledWeeks({ n: settled, of: lastRound }),
        late ? RESULTS.stillMoving({ from: late.from, to: lastRound }) : ''),
    );

    const chart = card('rs-card', 'results-weeks');
    const head = el('div', 'rs-head');
    const titles = el('div', 'rs-titles');
    titles.append(el('h3', null, RESULTS.everyWeek()), el('p', 'rs-sub', RESULTS.chartNote()));
    const key = el('span', 'rs-key');
    key.append(dot(), el('span', null, RESULTS.changedKey()));
    head.append(titles, key);
    const scroll = el('div', 'rs-scroll');
    const plotArea = el('div', 'rs-chart');
    const bracketRow = el('div', 'rs-brackets');
    if (late) {
      const bracket = el('span', 'rs-bracket', RESULTS.notSettled());
      bracket.style.gridColumn = `${late.from} / span ${late.weeks}`;
      bracketRow.append(bracket);
    }
    const cols = el('div', 'rs-cols');
    const range = chartRange(bars);
    cols.style.setProperty('--rs-bars', `${BARS_PX}px`);
    for (const b of bars) cols.append(weekColumn(b, range));
    plotArea.append(bracketRow, cols);
    scroll.append(plotArea);
    const shown = bars.find((b) => b.round === view.week) ?? bars.at(-1);
    chart.append(head, scroll, weekStrip(shown),
      para('rs-read', RESULTS.reports({ first: money(firstReportsTotal(bars)), now: money(f.netProfitPaise), weeks: lastRound }), RESULTS.reports));
    if (late) {
      chart.append(para('rs-sub', RESULTS.readHigh({
        weeks: late.weeks, arriving: late.arriving, pending: one(late.pending), window: late.window,
        cutoff: late.cutoff, none: RESULTS.weeksNamed({ list: late.none }),
      }), RESULTS.readHigh));
    }

    const pairRow = el('div', 'rs-pairs');
    const built = card('rs-card', 'results-built');
    built.append(el('span', 'rs-label', RESULTS.built()));
    const capital = capitalReading(me, allocationRounds);
    if (capital.tranches.length === 0) {
      built.append(el('p', 'rs-read', RESULTS.allBudget({ amount: money(capital.toBudgetPaise) })));
    } else {
      for (const t of capital.tranches) {
        built.append(el('p', 'rs-read', RESULTS.tranche({
          amount: money(t.paise), target: TARGET_WORDS[t.target]?.() ?? t.target, round: t.madeAt, live: t.liveAtRound,
        })));
      }
      built.append(el('p', 'rs-read', RESULTS.rest({ amount: money(capital.toBudgetPaise) })),
        para('rs-sub', RESULTS.notCounted({ amount: money(capital.committedPaise) }), RESULTS.notCounted));
    }
    const kinder = card('rs-card', null);
    kinder.append(el('span', 'rs-label', RESULTS.realMarket()), para('rs-read', DEBRIEF.kinderMarket(), DEBRIEF.kinderMarket));
    pairRow.append(built, kinder);
    parts.twelve.replaceChildren(figures, chart, pairRow, next('learned'));
  }

  // --- What you learned ---------------------------------------------------------

  function hero(lesson) {
    const f = lesson.figures ?? {};
    switch (lesson.id) {
      case 'numbersMove':
        return [`${money(f.firstReportedPaise)} → ${money(f.nowPaise)}`, RESULTS.numbersMoveCaption({ round: f.round })];
      case 'rankOrBudget':
        return [pct(f.share), RESULTS.rankOrBudgetCaption({ round: f.round, kind: f.kind })];
      case 'broadMatch':
        return [whole(f.unwrittenTerms), RESULTS.broadMatchCaption()];
      case 'returns':
        return f.returnedShare == null ? null
          : [pct(f.returnedShare), RESULTS.returnsCaption({ rank: f.rank, grossRank: f.grossRank })];
      case 'ownName':
        return f.ownCpcPaise == null ? null
          : [`${money(f.ownCpcPaise)} · ${f.otherCpcPaise == null ? '—' : money(f.otherCpcPaise)}`, RESULTS.ownNameCaption()];
      default:
        return null;
    }
  }

  /** Where a week's impressions went, as Your week draws it. */
  function shareStrip(round) {
    const b = bars.find((x) => x.round === round);
    const box = el('div', 'rs-shares');
    const strip = el('div', 'rs-sharebar');
    strip.setAttribute('aria-hidden', 'true');
    const keys = el('div', 'rs-sharekeys');
    for (const [kind, share, words] of [['shown', b.impressionShare, RESULTS.shownShare],
      ['budget', b.lostToBudget, RESULTS.budgetShare], ['rank', b.lostToRank, RESULTS.rankShare]]) {
      const seg = el('span', kind);
      seg.style.width = pct(share);
      strip.append(seg);
      keys.append(el('span', null, words({ share: pct(share) })));
    }
    box.append(strip, keys);
    return box;
  }

  function lessonCard(lesson) {
    const box = el('div', lesson.met ? 'rs-lesson' : 'rs-lesson untried');
    const head = el('div', 'rs-head');
    head.append(el('h4', null, DEBRIEF[`${lesson.id}Title`]()));
    if (!lesson.met) head.append(el('span', 'rs-sub', RESULTS.didNotTry()));
    box.append(head);
    const shown = lesson.met ? hero(lesson) : null;
    if (shown) box.append(el('strong', 'rs-big', shown[0]), el('span', 'rs-sub', shown[1]));
    if (lesson.id === 'rankOrBudget' && lesson.met) box.append(shareStrip(lesson.figures.round));
    const said = lessonSentence(lesson);
    if (said) box.append(para('rs-read', said[0](said[1]), said[0]));
    return box;
  }

  /** What the capital a week committed cost, counted, for its "What if" answer. */
  function capitalNote(round, diff) {
    const entry = decisionLog.find((e) => e.advertiserId === playerId && e.round === round);
    const committed = Object.entries(entry?.decision?.capex ?? {}).filter(([, paise]) => paise > 0);
    if (committed.length === 0) return null;
    const amount = committed.reduce((a, [, paise]) => a + paise, 0);
    const gap = amount - diff.netProfitPaise;
    return RESULTS.capitalCounted({
      amount: money(amount),
      targets: committed.map(([target]) => TARGET_WORDS[target]?.() ?? target),
      sign: Math.sign(Math.round(gap / 100)),
      gap: money(Math.abs(gap)),
    });
  }

  async function whatIf(m) {
    if (view.busy) return;
    view.busy = true;
    view.answers.set(m.round, { week: 1 });
    drawLearned();
    const spec = { initial: game.initial, decisionLog, history, playerId, round: m.round, allocationRounds };
    const without = await replay(game.initial, (s) => logWithoutChange(s, spec), lastRound, {}, (week) => {
      view.answers.set(m.round, { week: Math.min(week + 1, lastRound) });
      const progress = parts.learned.querySelector(`[data-replay="${m.round}"]`);
      if (progress) progress.textContent = DEBRIEF.replaying({ week: Math.min(week + 1, lastRound), of: lastRound });
    });
    const diff = windowDifference(history, without.history, playerId, { from: m.round, to: m.windowEnd });
    const nothing = (value, below) => (Math.abs(value) < below ? 0 : Math.sign(value));
    view.answers.set(m.round, {
      window: DEBRIEF.window({ from: m.round, to: m.windowEnd }),
      withoutIt: DEBRIEF.withoutIt({
        clicks: whole(Math.abs(diff.clicks)), clicksSign: nothing(diff.clicks, 0.5),
        cost: rupees(Math.abs(diff.costPaise)), costSign: nothing(diff.costPaise, 50),
        kept: rupees(Math.abs(diff.netProfitPaise)), keptSign: nothing(diff.netProfitPaise, 50),
      }),
      capital: capitalNote(m.round, diff),
    });
    view.busy = false;
    drawLearned();
  }

  function momentCard(m) {
    const box = el('div', 'rs-card');
    box.append(el('h4', null, DEBRIEF.week({ round: m.round })));
    const list = el('ul', 'rs-did');
    for (const text of m.lines) {
      const item = el('li');
      item.append(dot(), el('span', null, text));
      list.append(item);
    }
    const table = el('div', 'rs-compare');
    const cpc = (t) => (t.cpcPaise == null ? '—' : rupees(t.cpcPaise));
    table.append(el('span'), el('span', 'rs-label', DEBRIEF.weekBefore({ round: m.round - 1 })),
      el('span', 'rs-label', DEBRIEF.weekAfter({ round: m.round })));
    for (const [name, before, after] of [
      [DEBRIEF.clicks(), whole(m.before.clicks), whole(m.after.clicks)],
      [DEBRIEF.cpc(), cpc(m.before), cpc(m.after)],
      [DEBRIEF.spend(), rupees(m.before.costPaise), rupees(m.after.costPaise)],
      [DEBRIEF.share(), pct(m.before.impressionShare), pct(m.after.impressionShare)],
    ]) table.append(el('span', 'rs-quiet', name), el('span', 'rs-quiet', before), el('strong', null, after));
    box.append(list, table, el('p', 'rs-sub', DEBRIEF.alsoChanged({ newMonth: m.newMonth, capitalLanded: m.capitalLanded })));
    const answer = view.answers.get(m.round);
    if (!answer) {
      const ask = button('rs-pill', DEBRIEF.whatIf());
      ask.disabled = view.busy;
      ask.addEventListener('click', () => whatIf(m));
      box.append(ask);
    } else if (answer.week) {
      const progress = el('p', 'rs-sub', DEBRIEF.replaying({ week: answer.week, of: lastRound }));
      progress.dataset.replay = String(m.round);
      box.append(progress);
    } else {
      const said = el('div', 'rs-answer');
      said.append(el('strong', null, answer.window), el('p', 'rs-read', answer.withoutIt));
      if (answer.capital) said.append(el('p', 'rs-read', answer.capital));
      said.append(para('rs-sub', DEBRIEF.rivalsHeld(), DEBRIEF.rivalsHeld));
      box.append(said);
    }
    return box;
  }

  async function workOutBudget() {
    if (view.busy) return;
    view.busy = true;
    view.budget = { week: 1 };
    drawLearned();
    const replayed = await replay(game.initial, () => decisionLog, lastRound, { counterfactualFor: [playerId] }, (week) => {
      view.budget = { week: Math.min(week + 1, lastRound) };
      const progress = parts.learned.querySelector('[data-replay="budget"]');
      if (progress) progress.textContent = DEBRIEF.replaying({ week: view.budget.week, of: lastRound });
    });
    view.budget = { read: budgetWeeks(replayed.history, playerId) };
    view.busy = false;
    drawLearned();
  }

  function budgetCard() {
    const box = card('rs-card', 'results-budget');
    box.append(el('h4', null, DEBRIEF.budgetHead()));
    if (!view.budget) {
      const ask = button('rs-pill', DEBRIEF.budgetWorkOut());
      ask.disabled = view.busy;
      ask.addEventListener('click', workOutBudget);
      box.append(ask);
      return box;
    }
    if (view.budget.week) {
      const progress = el('p', 'rs-sub', DEBRIEF.replaying({ week: view.budget.week, of: lastRound }));
      progress.dataset.replay = 'budget';
      box.append(progress);
      return box;
    }
    const { read } = view.budget;
    const kindOf = new Map([
      ...read.lostMoney.map((w) => [w.round, 'lost']), ...read.brokeEven.map((w) => [w.round, 'even']),
      ...read.paidFor.map((w) => [w.round, 'paid']), ...read.nothingLeft.map((round) => [round, 'nothing']),
    ]);
    const strip = el('div', 'rs-weeks');
    strip.setAttribute('aria-hidden', 'true');
    for (const b of bars) {
      const cell = el('span', 'rs-weekcell');
      const mark = el('i', kindOf.get(b.round) ?? 'left');
      cell.append(mark, el('span', null, String(b.round)));
      strip.append(cell);
    }
    const legend = el('div', 'rs-legend');
    for (const [kind, words] of [['lost', RESULTS.stripLost], ['even', RESULTS.stripEven], ['paid', RESULTS.stripPaid],
      ['nothing', RESULTS.stripNothing], ['left', RESULTS.stripLeft]]) {
      if (kind !== 'left' && ![...kindOf.values()].includes(kind)) continue;
      const item = el('span');
      item.append(el('i', kind), el('span', null, words()));
      legend.append(item);
    }
    box.append(strip, legend, el('p', 'rs-read', budgetLines(read).join(' ')),
      para('rs-sub', DEBRIEF.budgetExact(), DEBRIEF.budgetExact));
    return box;
  }

  function drawLearned() {
    const read = lessons({ history, decisionLog, playerId, opening: game.opening, state: finished });
    const grid = card('rs-lessons', 'results-lessons');
    grid.append(...read.map(lessonCard));
    const moved = card('rs-moments', 'results-moments');
    moved.append(...picked.map(momentCard));
    const out = [el('h3', null, DEBRIEF.lessonsHead()), grid];
    if (picked.length > 0) out.push(el('h3', null, DEBRIEF.momentsHead()), moved);
    else {
      // The guide's "What only a simulation can tell you" shows the player here,
      // so the place the replays would be carries their slot when there are none.
      const none = el('p', 'rs-read', DEBRIEF.noMoments());
      none.dataset.slot = 'results-moments';
      out.push(none);
    }
    out.push(budgetCard(), next('reveal'));
    parts.learned.replaceChildren(...out);
  }

  // --- Where they sat -------------------------------------------------------------

  const notes = game.notes ?? null;
  const done = () => view.revealed !== 'no';

  function verdict(row) {
    if (view.revealed === 'skipped') return RESULTS.itWas({ cell: cellWords(`${row.truth.price}|${row.truth.purpose}`) });
    const cell = cellWords(`${row.truth.price}|${row.truth.purpose}`);
    if (!row.guess) return RESULTS.notGuessed({ cell });
    if (row.result === 'exact') return RESULTS.exactly({ cell });
    const how = { price: DEBRIEF.resultPrice, purpose: DEBRIEF.resultPurpose, wrong: DEBRIEF.resultWrong }[row.result]();
    const said = cellWords(`${row.guess.price}|${row.guess.purpose}`);
    return (row.noted ? RESULTS.missedNoted : RESULTS.missed)({ how, said, cell });
  }

  function rivalCard(row, index) {
    const box = el('div', 'rs-rival');
    const head = el('div', 'rs-head');
    head.append(el('strong', null, row.name));
    if (notes) head.append(el('span', row.noted ? 'rs-sub' : 'rs-faint', row.noted ? RESULTS.notedTag({ round: 0 }) : RESULTS.nowTag()));
    box.append(head, serp({
      domain: row.domain, headlines: row.ad?.headlines ?? [], descriptions: row.ad?.descriptions ?? [], sponsored: AD.sponsored(),
    }));
    const foot = el('div', 'rs-rivalfoot');
    const said = el('p', 'rs-verdict');
    if (done()) {
      said.textContent = verdict(row);
      if (row.result === 'exact' && view.revealed === 'yes') said.classList.add('right');
      if (view.arrive) {
        said.classList.add('rs-arrive');
        said.style.transitionDelay = `${index * REVEAL_STAGGER_MS}ms`;
      }
    }
    const mini = el('div', 'r0-mini');
    mini.setAttribute('role', 'group');
    mini.setAttribute('aria-label', R0.guessFor({ name: row.name }));
    const mine = view.revealed === 'skipped' ? null : row.guess;
    for (const purpose of PURPOSES) {
      for (const price of PRICE_TIERS) {
        const key = `${price}|${purpose}`;
        const isMine = mine && mine.price === price && mine.purpose === purpose;
        const isTruth = done() && row.truth.price === price && row.truth.purpose === purpose;
        const cell = button('r0-mini-cell');
        if (isMine) cell.classList.add(done() ? 'ring' : 'mine');
        if (isTruth) cell.classList.add('truth');
        cell.setAttribute('aria-label', R0.guessCell({ name: row.name, cell: cellWords(key) }));
        cell.setAttribute('aria-pressed', String(Boolean(isMine)));
        cell.disabled = done() || row.noted;
        cell.addEventListener('click', () => {
          if (view.guesses[row.id] === key) delete view.guesses[row.id];
          else view.guesses[row.id] = key;
          drawReveal();
          parts.reveal.querySelectorAll('.rs-rival')[index]?.querySelector(`[aria-label="${cell.getAttribute('aria-label')}"]`)?.focus();
        });
        mini.append(cell);
      }
    }
    foot.append(said, mini);
    box.append(foot);
    return box;
  }

  function squares(read) {
    const diagram = card('r0-diagram', 'results-squares');
    const yours = `${me.position.price}|${me.position.purpose}`;
    for (const purpose of PURPOSES) {
      const rowLabel = el('div', 'r0-row-label');
      rowLabel.append(el('strong', null, PURPOSE_WORD[purpose]()),
        el('span', 'r0-small', (purpose === 'performance' ? R0.contestPerformance : R0.contestLifestyle)()));
      diagram.append(rowLabel);
      for (const price of PRICE_TIERS) {
        const key = `${price}|${purpose}`;
        const square = el('div', key === yours ? 'r0-square on' : 'r0-square');
        const chips = el('span', 'r0-square-chips');
        if (key === yours) chips.append(el('span', 'r0-you', R0.you()));
        for (const row of read.rows) {
          const here = done() ? row.truth.price === price && row.truth.purpose === purpose
            : row.guess && row.guess.price === price && row.guess.purpose === purpose;
          if (!here) continue;
          if (done()) {
            const right = view.revealed === 'yes' && row.result === 'exact';
            chips.append(el('span', right ? 'rs-who right' : 'rs-who', right ? `${row.name} ✓` : row.name));
          } else chips.append(el('span', 'r0-guess', R0.guessed({ name: row.name })));
        }
        square.append(el('span', 'r0-square-name', cellWords(key)), chips);
        diagram.append(square);
      }
    }
    diagram.append(el('div', 'r0-axis-name', R0.axisPrice()));
    for (const price of PRICE_TIERS) {
      const axis = el('div', 'r0-axis');
      axis.append(el('strong', null, PRICE_WORD[price]()));
      diagram.append(axis);
    }
    return diagram;
  }

  function drawReveal() {
    const read = revealReading(game.initial, playerId, { notes, guesses: view.guesses });
    const noted = read.rows.filter((r) => r.noted).length;
    const intro = notes
      ? RESULTS.introKept({ noted, rest: read.rows.length - noted, round: 0 })
      : DEBRIEF.revealAsk();
    const grid = card('rs-rivals', 'results-reveal');
    read.rows.forEach((row, i) => grid.append(rivalCard(row, i)));
    const out = [el('p', 'rs-intro', intro), grid, squares(read)];
    if (!done()) {
      const actions = el('div', 'rs-actions');
      const reveal = button('rs-reveal press', DEBRIEF.reveal());
      reveal.addEventListener('click', () => { view.revealed = 'yes'; view.arrive = true; drawReveal(); });
      const skip = button('rs-pill', DEBRIEF.skip());
      skip.addEventListener('click', () => { view.revealed = 'skipped'; view.arrive = true; drawReveal(); });
      const placed = read.rows.filter((r) => r.guess).length;
      actions.append(reveal, skip, el('span', 'rs-sub', RESULTS.placed({ placed, total: read.rows.length })));
      out.push(actions);
    } else {
      const summary = card('rs-card', null);
      if (view.revealed === 'skipped') summary.append(el('strong', null, DEBRIEF.shown()));
      else if (read.then) {
        summary.append(el('strong', null, RESULTS.scoreThen({ ...read.then, round: 0 })),
          el('p', 'rs-read', RESULTS.scoreNow(read.now)));
      } else summary.append(el('strong', null, DEBRIEF.score(read.all)));
      const mates = [DEBRIEF.cellmates({ names: read.cellmates })];
      const most = meetMostOverGame(game.insights, playerId);
      const mostName = finished.advertisers.find((a) => a.id === most?.id)?.name;
      if (mostName && !read.cellmates.includes(mostName)) mates.push(RESULTS.metMost({ name: mostName, rate: pct(most.rate) }));
      summary.append(el('p', 'rs-read', mates.join(' ')));
      out.push(summary);
    }
    out.push(next('books'));
    parts.reveal.replaceChildren(...out);
    // Once, as the answers first appear (@starting-style in studio.css): a
    // redraw draws them without it, so nothing plays twice.
    view.arrive = false;
  }

  // --- Everyone's books -------------------------------------------------------------

  function brandRow(r) {
    const row = el('div', r.isYou ? 'rs-brand you' : 'rs-brand');
    const name = el('span', 'rs-brandname');
    name.append(el('strong', null, r.name));
    if (r.isYou) name.append(el('span', 'r0-you', RESULTS.you()));
    const cell = el('span', done() ? 'rs-quiet' : 'rs-faint', done() ? cellWords(r.cell) : '—');
    if (!done()) cell.setAttribute('aria-label', RESULTS.hidden());
    const track = el('span', 'rs-track');
    track.setAttribute('aria-hidden', 'true');
    const gross = el('span', 'rs-gross');
    gross.style.width = `${100 * r.grossShare}%`;
    const net = el('span', 'rs-net');
    net.style.width = `${100 * r.netShare}%`;
    track.append(gross, net);
    row.append(
      el('span', 'rs-rank', String(r.rank)), name, cell, track,
      el('strong', r.netProfitPaise < 0 ? 'rs-money loss' : 'rs-money', money(r.netProfitPaise)),
      el('span', 'rs-quiet', r.returnedShare == null ? '—' : pct(r.returnedShare)),
      el('span', 'rs-quiet', ordinal(r.grossRank)),
      el('span', 'rs-brandline', RESULTS.brandLine({
        spent: money(r.costPaise), conversions: one(r.conversions),
        each: r.cpaPaise == null ? '—' : money(r.cpaPaise), roas: `₹${ratio(r.netRoas)}`, gross: money(r.grossProfitPaise),
      })),
    );
    return row;
  }

  function drawBooks() {
    const warning = card('rs-warning', 'results-books');
    warning.append(el('strong', null, RESULTS.booksTitle()), para('rs-read', RESULTS.booksWarning(), RESULTS.booksWarning));
    const table = card('rs-card', null);
    const header = el('div', 'rs-brand head');
    for (const text of ['#', RESULTS.colBrand(), RESULTS.colCell(), RESULTS.colBars(), RESULTS.colNet(),
      RESULTS.colReturns(), RESULTS.colGross()]) header.append(el('span', 'rs-label', text));
    table.append(header, ...booksRows(finished).map(brandRow),
      para('rs-sub', RESULTS.booksNote({ month: Math.ceil((snapshot + 1) / ROUNDS_PER_MONTH), snapshot }), RESULTS.booksNote),
      el('p', 'rs-sub', RESULTS.booksHigh({ weeks: lastRound - settledThrough(lastRound) })));
    if (!done()) table.append(el('p', 'rs-sub', RESULTS.cellsHidden()));

    const where = finishing(finished, playerId);
    const finish = card('rs-card', 'results-finish');
    const ranks = el('div', 'rs-ranks');
    for (const [place, words] of [
      [where.week8?.position, RESULTS.rankAtSnapshot({ week: snapshot })],
      [where.grossRank, RESULTS.rankGross()],
      [where.netRank, RESULTS.rankNet()],
    ]) {
      if (place == null) continue;
      const box = el('div', 'rs-rankbox');
      box.append(el('strong', 'rs-big', ordinal(place)), el('span', 'rs-sub', words));
      ranks.append(box);
    }
    finish.append(el('h4', null, RESULTS.finished()), ranks);
    if (where.week8) {
      finish.append(el('p', 'rs-read', RESULTS.monthThree({
        month: Math.ceil((snapshot + 1) / ROUNDS_PER_MONTH), snapshot, place: where.week8.position,
        amount: money(where.month3Paise), middle: money(where.middlePaise),
        first: money(where.firstPaise), last: money(where.lastPaise),
      })), para('rs-sub', RESULTS.traps({ snapshot }), RESULTS.traps));
    }
    const endRow = el('div', 'rs-pairs wide');
    // On the playtest link Play again moves under the file, since starting again
    // clears the saved game the file carries; the books point there instead.
    if (playtest) {
      const onward = card('rs-card', null);
      onward.append(next('playtest'));
      endRow.append(finish, onward);
    } else endRow.append(finish, playAgain());
    parts.books.replaceChildren(warning, table, endRow);
  }

  /** Play again: in Everyone's books, or under the file on the playtest link. */
  function playAgain() {
    const again = card('rs-card', null);
    again.append(el('h4', null, RESULTS.playAgain()));
    if (!view.restart) {
      const ask = button('rs-pill', RESULTS.startAnother());
      ask.disabled = !onRestart;
      ask.addEventListener('click', () => { view.restart = true; redrawEnd(); });
      again.append(ask);
    } else {
      for (const [market, name, reason] of [['same', RESULTS.sameMarket(), RESULTS.sameWhy()],
        ['new', RESULTS.newMarket(), RESULTS.newWhy({ round: 0 })]]) {
        const pick = button('rs-choice');
        pick.append(el('strong', null, name), el('span', 'rs-sub', reason));
        pick.addEventListener('click', () => onRestart?.(market));
        again.append(pick);
      }
    }
    again.append(el('p', 'rs-sub', RESULTS.restartWarn()));
    return again;
  }

  /** The section Play again sits in, redrawn where the player is looking. */
  const redrawEnd = () => (playtest ? drawPlaytest() : drawBooks());

  // On the playtest link, the questions and the file, then Play again, which
  // clears the saved game the file carries (the review, 2026-09-16).
  function drawPlaytest() {
    if (!playtest) return;
    const box = card('rs-card', 'results-playtest');
    const ask = (id, question, rows) => {
      const wrap = el('label', 'rs-ask');
      const text = el('textarea', 'rs-answer');
      text.rows = rows;
      text.value = playtest.recorder.log().answers[id] ?? '';
      text.addEventListener('input', () => playtest.recorder.answer(id, text.value));
      wrap.append(el('span', null, question), text);
      return wrap;
    };
    const send = button('rs-pill', PLAYTEST.download());
    send.addEventListener('click', playtest.onDownload);
    box.append(ask('lessons', PLAYTEST.lessons(), 5), ask('confusing', PLAYTEST.confusing(), 3),
      el('p', 'rs-sub', PLAYTEST.fileNote()), send);
    const again = playAgain();
    again.append(el('p', 'rs-sub', PLAYTEST.playAgainAfter()));
    parts.playtest.replaceChildren(el('p', 'rs-sub', PLAYTEST.sub()), box, again);
  }

  const drawers = {
    twelve: drawTwelve, learned: drawLearned, reveal: drawReveal, books: drawBooks, playtest: drawPlaytest,
  };
  return {
    game,
    node(key) {
      drawers[key]?.();
      return parts[key];
    },
  };
}
