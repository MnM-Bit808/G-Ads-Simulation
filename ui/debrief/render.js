/**
 * The debrief and the reveal, drawn (plans/2026-09-13-debrief.md).
 *
 * The readings are `./read.js` and the words `../words/debrief.js`; this file
 * only lays them out and runs the two replays the player asks for.
 *
 * THE REPLAYS ARE ON DEMAND AND PAUSE BETWEEN WEEKS. "What if I hadn't?" and
 * the budget "what if" each replay the game through `game.js`, which is the
 * only replay that reproduces a played game. A week takes about a fifth of a
 * second in a browser, so the loop yields between weeks, the way the save
 * restore does, and says how far it has got: a frozen page reads as a crash.
 */

import { el, table, rupees, whole, pct } from '../dom.js';
import { DEBRIEF } from '../words/debrief.js';
import { whyButton } from '../guide/drawer.js';
import { serpBlock } from '../round-zero.js';
import { STRATEGY_NAMES } from '../ending.js';
import { replayRound, logWithout } from '../../game.js';
import {
  moments, windowDifference, budgetWeeks, lessons, revealRows, MATERIAL_LOSS,
} from './read.js';
import { ROUNDS_PER_MONTH, PRICE_TIERS, PURPOSES } from '../../engine/constants.js';

/** Replay the game from its start, one week at a time, saying how far it has got. */
async function replay(initial, decisionLog, throughRound, options, onWeek) {
  let state = initial;
  while (state.round <= throughRound) {
    const out = replayRound(state, decisionLog, { mode: 'expected', ...options });
    state = out.nextGameState;
    onWeek?.(out.round, throughRound);
    await new Promise((resolve) => { setTimeout(resolve, 0); });
  }
  return state;
}

/** The sign of a difference, treating what rounds to nothing as nothing. */
const signOf = (value, nothing) => (Math.abs(value) < nothing ? 0 : Math.sign(value));

/** A paragraph with its "why?", for a disclosure. */
function disclosure(entry, openGuide) {
  const p = el('p', 'note');
  p.append(document.createTextNode(entry()));
  const why = whyButton(entry, openGuide);
  if (why) p.append(why);
  return p;
}

function card(title, subtitle, className) {
  const node = el('article', `card span-4 ${className}`);
  const heading = el('h2', null, title);
  heading.append(el('span', 'muted', subtitle));
  node.append(heading);
  return node;
}

// ---------------------------------------------------------------------------
// The debrief
// ---------------------------------------------------------------------------

/**
 * @param {object} ctx
 * @param {object} ctx.state - the finished game
 * @param {object} ctx.initial - the state before week 1
 * @param {string} ctx.playerId
 * @param {{negatives: object[], keywords: object[]}} ctx.opening
 * @param {(id: string, opener: Element) => void} [ctx.openGuide]
 * @returns {HTMLElement}
 */
export function renderDebrief(ctx) {
  const node = card(DEBRIEF.title(), DEBRIEF.subtitle(), 'debrief');
  // One replay at a time: two at once would only make both slower.
  const busy = (on) => {
    for (const button of node.querySelectorAll('button.replay')) button.disabled = on;
  };
  node.append(momentsSection(ctx, busy), budgetSection(ctx, busy), lessonsSection(ctx));
  return node;
}

function momentsSection(ctx, busy) {
  const section = el('section', 'debrief-part');
  section.append(el('h3', 'debrief-head', DEBRIEF.momentsHead()));
  const { state, playerId } = ctx;
  const lastRound = state.history.length;
  const picked = moments({
    history: state.history,
    decisionLog: state.decisionLog,
    playerId,
    opening: ctx.opening,
    allocationRounds: state.budgetSchedule?.capexAllocationRounds ?? [],
    roundsPerMonth: ROUNDS_PER_MONTH,
    lastRound,
  });
  if (picked.length === 0) {
    section.append(el('p', 'muted', DEBRIEF.noMoments()));
    return section;
  }

  const list = el('div', 'moments');
  for (const m of picked) {
    const box = el('div', 'moment');
    box.append(el('div', 'moment-week', DEBRIEF.week({ round: m.round })));
    const lines = el('ul', 'moment-lines');
    for (const text of m.lines) lines.append(el('li', null, text));
    box.append(lines);

    const compare = el('table', 'mini');
    const cpc = (t) => (t.cpcPaise == null ? '—' : rupees(t.cpcPaise));
    table(compare, ['',
      { label: DEBRIEF.weekBefore({ round: m.round - 1 }), num: true },
      { label: DEBRIEF.weekAfter({ round: m.round }), num: true }], [
      { cells: [DEBRIEF.clicks(), whole(m.before.clicks), whole(m.after.clicks)] },
      { cells: [DEBRIEF.cpc(), cpc(m.before), cpc(m.after)] },
      { cells: [DEBRIEF.spend(), rupees(m.before.costPaise), rupees(m.after.costPaise)] },
      { cells: [DEBRIEF.share(), pct(m.before.impressionShare), pct(m.after.impressionShare)] },
    ]);
    box.append(compare);
    box.append(el('p', 'note', DEBRIEF.alsoChanged({ newMonth: m.newMonth, capitalLanded: m.capitalLanded })));

    const result = el('div', 'whatif-result');
    const ask = el('button', 'ghost replay', DEBRIEF.whatIf());
    ask.type = 'button';
    ask.hidden = !ctx.initial;
    ask.addEventListener('click', async () => {
      busy(true);
      const progress = el('p', 'note', DEBRIEF.replaying({ week: 1, of: lastRound }));
      result.replaceChildren(progress);
      const log = logWithout(state.decisionLog, { advertiserId: playerId, round: m.round });
      const without = await replay(ctx.initial, log, lastRound, {}, (week, of) => {
        progress.textContent = DEBRIEF.replaying({ week, of });
      });
      const diff = windowDifference(state.history, without.history, playerId, { from: m.round, to: m.windowEnd });
      result.replaceChildren(
        el('p', 'whatif-window', DEBRIEF.window({ from: m.round, to: m.windowEnd, toEnd: m.windowEnd === lastRound })),
        el('p', null, DEBRIEF.withoutIt({
          clicks: whole(Math.abs(diff.clicks)),
          clicksSign: signOf(diff.clicks, 0.5),
          cost: rupees(Math.abs(diff.costPaise)),
          costSign: signOf(diff.costPaise, 50),
          kept: rupees(Math.abs(diff.netProfitPaise)),
          keptSign: signOf(diff.netProfitPaise, 50),
        })),
        disclosure(DEBRIEF.rivalsHeld, ctx.openGuide),
      );
      ask.remove();
      busy(false);
    });
    box.append(ask, result);
    list.append(box);
  }
  section.append(list);
  return section;
}

function budgetSection(ctx, busy) {
  const section = el('section', 'debrief-part');
  section.append(el('h3', 'debrief-head', DEBRIEF.budgetHead()));
  const result = el('div', 'budget-result');
  const ask = el('button', 'ghost replay', DEBRIEF.budgetWorkOut());
  ask.type = 'button';
  ask.hidden = !ctx.initial;
  ask.addEventListener('click', async () => {
    busy(true);
    const lastRound = ctx.state.history.length;
    const progress = el('p', 'note', DEBRIEF.replaying({ week: 1, of: lastRound }));
    result.replaceChildren(progress);
    // The engine works the budget "what if" out only when asked, and nothing
    // asked during play (DECISIONS G1); so the game is replayed asking.
    const replayed = await replay(ctx.initial, ctx.state.decisionLog, lastRound,
      { counterfactualFor: [ctx.playerId] },
      (week, of) => { progress.textContent = DEBRIEF.replaying({ week, of }); });
    const read = budgetWeeks(replayed.history, ctx.playerId);

    const lines = [];
    if (read.ranOut === 0) {
      lines.push(DEBRIEF.budgetNeverRanOut());
    } else {
      lines.push(DEBRIEF.budgetRanOut({ ranOut: read.ranOut, played: read.played }));
      if (read.best) {
        lines.push(DEBRIEF.budgetPaid({
          count: read.paidFor.length,
          round: read.best.round,
          clicks: whole(read.best.clicks),
          kept: rupees(read.best.profitIfFundedPaise),
        }));
      }
      if (read.didNotPay.length > 0) {
        lines.push(DEBRIEF.budgetDidNotPay({ count: read.didNotPay.length, all: read.paidFor.length === 0 }));
      }
    }
    result.replaceChildren(el('p', null, lines.join(' ')), disclosure(DEBRIEF.budgetExact, ctx.openGuide));
    ask.remove();
    busy(false);
  });
  section.append(ask, result);
  return section;
}

/** The sentence for one lesson, met or not. */
function lessonSentence(lesson) {
  const f = lesson.figures ?? {};
  switch (lesson.id) {
    case 'numbersMove':
      return [DEBRIEF.numbersMove, {
        round: f.round, first: rupees(f.firstReportedPaise), now: rupees(f.nowPaise),
      }];
    case 'rankOrBudget':
      if (!lesson.met) return [DEBRIEF.rankOrBudgetNot, { threshold: pct(MATERIAL_LOSS) }];
      return [f.kind === 'budget' ? DEBRIEF.rankOrBudgetBudget : DEBRIEF.rankOrBudgetRank,
        { round: f.round, share: pct(f.share) }];
    case 'broadMatch':
      return lesson.met
        ? [DEBRIEF.broadMatch, { terms: whole(f.unwrittenTerms), negatives: whole(f.negatives) }]
        : [DEBRIEF.broadMatchNot, {}];
    case 'returns':
      return [DEBRIEF.returns, {
        share: f.returnedShare == null ? '—' : pct(f.returnedShare), rank: f.rank, grossRank: f.grossRank,
      }];
    case 'ownName':
      if (!lesson.met) return [DEBRIEF.ownNameNot, {}];
      if (f.ownCpcPaise == null) return [DEBRIEF.ownNameNoClicks, {}];
      return [DEBRIEF.ownName, {
        own: rupees(f.ownCpcPaise), other: f.otherCpcPaise == null ? '—' : rupees(f.otherCpcPaise),
      }];
    case 'smartBidding':
      return lesson.met
        ? [DEBRIEF.smartBidding, {
          strategy: STRATEGY_NAMES[f.strategy] ?? f.strategy, round: f.round, learning: f.learningWeeks,
        }]
        : [DEBRIEF.smartBiddingNot, {}];
    default:
      return null;
  }
}

function lessonsSection(ctx) {
  const section = el('section', 'debrief-part');
  section.append(el('h3', 'debrief-head', DEBRIEF.lessonsHead()));
  const read = lessons({
    history: ctx.state.history,
    decisionLog: ctx.state.decisionLog,
    playerId: ctx.playerId,
    opening: ctx.opening,
    state: ctx.state,
  });

  const groups = el('div', 'lesson-groups');
  for (const [label, met] of [[DEBRIEF.ranInto(), true], [DEBRIEF.didNotTry(), false]]) {
    const inGroup = read.filter((lesson) => lesson.met === met);
    if (inGroup.length === 0) continue;
    const group = el('div', 'lesson-group');
    group.append(el('div', 'lesson-group-label', label));
    for (const lesson of inGroup) {
      const said = lessonSentence(lesson);
      if (!said) continue;
      const [entry, figures] = said;
      const row = el('div', 'lesson');
      row.append(el('div', 'lesson-title', DEBRIEF[`${lesson.id}Title`]()));
      const p = el('p', null, entry(figures));
      const why = whyButton(entry, ctx.openGuide);
      if (why) p.append(why);
      row.append(p);
      group.append(row);
    }
    groups.append(group);
  }
  section.append(groups);
  return section;
}

// ---------------------------------------------------------------------------
// The reveal
// ---------------------------------------------------------------------------

const RESULT_WORDS = {
  exact: DEBRIEF.resultExact,
  price: DEBRIEF.resultPrice,
  purpose: DEBRIEF.resultPurpose,
  wrong: DEBRIEF.resultWrong,
  skipped: DEBRIEF.resultSkipped,
};

/**
 * Guess where each rival sat, then see.
 *
 * @param {object} ctx - as for `renderDebrief`
 * @param {() => void} onRevealed - called once, when the answers are shown
 * @returns {HTMLElement|null} null when the starting state is not to hand
 */
export function renderReveal(ctx, onRevealed) {
  if (!ctx.initial) return null;
  const node = card(DEBRIEF.revealTitle(), DEBRIEF.revealSubtitle(), 'reveal');
  node.append(el('p', 'note', DEBRIEF.revealAsk()));

  const guesses = {};
  const outcome = new Map();
  const grid = el('div', 'rival-grid reveal-grid');
  for (const row of revealRows(ctx.initial, ctx.playerId, {}).rows) {
    const box = el('div', 'guess');
    box.append(serpBlock({
      name: row.name, domain: row.domain, headlines: row.ad?.headlines ?? [], descriptions: row.ad?.descriptions ?? [],
    }));
    const picker = el('div', 'guess-grid');
    for (const purpose of PURPOSES) {
      for (const price of PRICE_TIERS) {
        const cell = el('button', 'guess-cell', DEBRIEF.cell({ price, purpose }));
        cell.type = 'button';
        cell.setAttribute('aria-pressed', 'false');
        cell.addEventListener('click', () => {
          guesses[row.id] = { price, purpose };
          for (const other of picker.children) other.setAttribute('aria-pressed', String(other === cell));
        });
        picker.append(cell);
      }
    }
    const said = el('p', 'guess-result');
    said.hidden = true;
    outcome.set(row.id, { box, picker, said });
    box.append(picker, said);
    grid.append(box);
  }
  node.append(grid);

  const summary = el('div', 'reveal-summary');
  const actions = el('div', 'reveal-actions');
  const reveal = el('button', null, DEBRIEF.reveal());
  reveal.type = 'button';
  const skip = el('button', 'ghost', DEBRIEF.skip());
  skip.type = 'button';
  actions.append(reveal, skip);

  const show = (skipped) => {
    const read = revealRows(ctx.initial, ctx.playerId, skipped ? {} : guesses);
    // Only the lines that land on screen take part in the stagger. On a phone
    // five of the eight are above the screen when the button is pressed, and
    // numbering those too spent the first quarter-second on motion nobody saw
    // (reviewed 2026-09-13). Measured before any line un-hides, because each
    // one that does moves the boxes after it.
    const onScreen = new Set(read.rows.filter((row) => {
      const { bottom } = outcome.get(row.id).box.getBoundingClientRect();
      return bottom > 0 && bottom < window.innerHeight;
    }).map((row) => row.id));

    // The rows come back in the order the grid was built, so counting through
    // them numbers the visible lines in reading order.
    let next = 0;
    const arrive = (line) => {
      line.classList.add('arriving');
      line.style.setProperty('--i', String(next++));
    };
    for (const row of read.rows) {
      const { picker, said } = outcome.get(row.id);
      for (const cell of picker.children) cell.disabled = true;
      const parts = [RESULT_WORDS[row.result](), DEBRIEF.actually({ cell: DEBRIEF.cell(row.truth) })];
      if (row.guess) parts.splice(1, 0, DEBRIEF.youSaid({ cell: DEBRIEF.cell(row.guess) }));
      said.textContent = `${parts.join('. ')}.`;
      said.className = `guess-result result-${row.result}`;
      if (onScreen.has(row.id)) arrive(said);
      said.hidden = false;
    }

    // The score comes last, after the answers it adds up. It sits where the
    // button just was, so it is always on screen.
    const total = el('p', null, skipped
      ? DEBRIEF.shown()
      : DEBRIEF.score({ exact: read.exact, half: read.half, of: read.rows.length }));
    const mates = el('p', null, DEBRIEF.cellmates({ names: read.cellmates }));
    arrive(total);
    arrive(mates);
    summary.replaceChildren(total, mates);
    actions.remove();
    onRevealed?.();
  };
  reveal.addEventListener('click', () => show(false));
  skip.addEventListener('click', () => show(true));

  node.append(actions, summary);
  return node;
}
