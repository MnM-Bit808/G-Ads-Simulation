/**
 * The interface (spec 14, build step 14). The two screens and the loop.
 *
 * IT IMPORTS THE REAL ENGINE, which is the whole point.
 *
 * The two `.jsx` files at the repository root are v0.1 prototypes, and each one
 * carries its OWN copy of the demand curve, the conversion multipliers and the
 * auction. They agreed with the spec the day they were written and drifted the
 * moment it moved, and nothing could tell. This module imports `setup.js`,
 * `game.js` and `engine/` directly over native ES modules — no bundler, no
 * framework, no transpile — so there is exactly one engine and the screen
 * cannot disagree with the tests. `tests/ui.test.js` fails if that stops being
 * true.
 *
 * There are two screens. Round 0 (spec 17), which runs once and asks for the
 * hardest decisions in the game against deliberately incomplete information;
 * and the round dashboard, which is what the rest of the game looks like.
 */

import { startGame, redoRoundZero, canRedoRoundZero, assignPlayerBrand } from '../setup.js';
import { playRound } from '../game.js';
import { controllerFor } from '../agents/policies.js';
import { QUERY_SET } from '../content/querySet.js';
import { getSelfView } from '../engine/insights.js';
import { TOTAL_ROUNDS } from '../engine/constants.js';
import { el } from './dom.js';
import { renderRoundZero } from './round-zero.js';
import { renderDashboard } from './dashboard.js';
import { createDraft, toDecision, changes } from './decisions.js';
import { renderEnding } from './ending.js';
import {
  makeSave, writeSave, readSave, clearSave, fingerprintOf, restoreSave,
} from './save.js';
import {
  playtestMode, createRecorder, attachRecorder, downloadPlaytestFile, renderPlaytestPanel,
} from './recorder.js';
import { createGuide } from './guide/drawer.js';
import { guideFigures } from './guide/figures.js';
import { lookMode } from './look.js';
import { createStudio } from './shell/shell.js';
import { createRoundZero } from './roundzero/studio.js';

/**
 * The market this game is played in. NOT a constant any more, because the end
 * screen can start another one — but still a SEED rather than a clock, so a
 * game remains reproducible from the number `state.rootSeed` records (R1).
 * A new market is the next seed along, not a random one.
 */
let rootSeed = 20260902;

const app = document.getElementById('app');
const nextButton = document.getElementById('next');
const redoButton = document.getElementById('redo');
const guideButton = document.getElementById('guide');

/**
 * The Studio layout (plans/2026-09-13-studio-makeover.md), built on the first
 * week drawn with `?look=studio` and dropped whenever the game is.
 */
let studio = null;

/**
 * The field guide (stage C2). Built once and kept outside `#app`, so redrawing
 * a week never removes it; the dashboard's "why?" buttons and the header's
 * Field guide button all open this one drawer. In the Studio layout, "show me
 * on the card" first opens the section the card sits in, and before week 1,
 * when there is no card, it is not offered.
 */
const guide = createGuide({
  figures: guideFigures(),
  reveal: (slot) => studio?.reveal(slot) ?? false,
  canShowCard: () => Boolean(game),
});
document.body.append(guide.node);
guideButton.addEventListener('click', () => guide.openContents(guideButton));

/** Everything the interface knows. The engine owns the rest. */
let game = null;

/**
 * Where the game is saved between visits (stage A4). Reaching for
 * `localStorage` can itself throw where a browser blocks site data, so the
 * lookup is guarded and a null storage simply means nothing is saved.
 */
const storage = (() => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})();

/**
 * The Studio makeover, on the link only (plans/2026-09-13-studio-makeover.md).
 * `body.studio` is all it sets here; ui/studio.css scopes every rule under it.
 */
const look = lookMode(window.location.search, storage);
if (look === 'studio') document.body.classList.add('studio');

/**
 * The playtest recorder, on the invite link only (stage B). Null for everyone
 * else, and every use below is `recorder?.`, so the ordinary game runs none of
 * it and draws nothing it did not draw before.
 */
const recorder = playtestMode(window.location.search, storage)
  ? createRecorder({ storage, now: () => Date.now() })
  : null;
const playtestButton = document.getElementById('playtest');

/**
 * Whether round 0 has been touched since it was drawn. Round 0 is never saved
 * (a game only exists once the account opens), so it is the one screen a
 * reload can still cost work on.
 */
let roundZeroTouched = false;

/**
 * The game being rewound, while round 0 is on screen for a second time (17.3).
 *
 * Held rather than discarded because the rewind has to go back THROUGH
 * `redoRoundZero`, which is what stamps `redoUsed` and keeps the market
 * identical. Starting fresh would silently hand out a second redo and a
 * different set of rivals.
 */
let rewinding = null;

async function begin({ playerBrandId, player }) {
  const state = rewinding
    ? redoRoundZero(rewinding, { playerBrandId, player })
    : startGame({ rootSeed, playerBrandId, player, querySet: QUERY_SET });
  rewinding = null;
  openGame(state, playerBrandId);

  // AND RUN THE FIRST WEEK, rather than rendering an account with no rounds in
  // it. There used to be a screen between here and the dashboard carrying one
  // sentence — "The account is open and nothing has run yet. Run the week to buy
  // some traffic." — which told the player to press a button in the opposite
  // corner of the page from the form they had just spent five screens filling
  // in, and showed them nothing at all in the meantime.
  //
  // Leaving round 0 on screen instead would have been worse: `game` exists by
  // this line, so the form's draft is no longer read by anything and every field
  // on it would accept edits that did nothing. A control that does nothing is
  // worse than no control.
  //
  // So the account is created and the week is bought by one press of one button,
  // at the bottom of the form it belongs to. `render` is not called until a
  // report exists, because the dashboard reads the last one.
  await runWeek();

  // And to the top. That button sits at the bottom of round 0, and the browser
  // keeps the scroll position when the page is replaced, so week 1 opened at
  // the foot of the dashboard: 6,409px down a 7,171px page, "Week by week" on
  // screen and "The week" out of sight. Only here, because only here does
  // one page replace a different one. Later weeks redraw the same dashboard,
  // and staying put there keeps the player's place.
  window.scrollTo(0, 0);
}

/**
 * Build the interface's game around a state that has not played a week yet.
 *
 * Shared by a new game and a restored one, so a resumed game is wired exactly
 * as it was the first time: the same controllers, the same sources, and the
 * same round 0 snapshot for the end screen to diff against.
 *
 * @param {object} state - the state before week 1
 * @param {string} playerId
 */
function openGame(state, playerId) {
  game = {
    playerId,
    // Kept for the save (A4): the start plus the log rebuilds everything else.
    initial: state,
    saved: null,
    state,
    reports: [],
    insights: [],
    draft: null,
    // Display preferences, which the view is allowed to keep. Nothing the
    // engine owns lives here.
    view: { termsRange: 'all' },
    // The player's own controller returns whatever the form has staged, and
    // `null` when it has staged nothing — which is exactly what this returned
    // before slice three existed. `playRound` collects it and `submitRound`
    // applies it, so the player enters a round by the same door a policy does
    // (R6), and the learning period and the decision log both happen.
    // Read off the advertiser, not re-derived from an index. This view used to
    // own the cast privately and assign by position, which is why
    // `advertiser.policyId` was null in every game that ever ran.
    controllers: Object.fromEntries(state.advertisers.map((a, i) => [
      a.id,
      i === 0 ? () => toDecision(game.draft) : controllerFor(a.policyId),
    ])),
    // 12.4: every logged decision carries where it came from, or a replay
    // cannot tell a player's week from a policy's.
    sources: Object.fromEntries(state.advertisers.map((a, i) => [
      a.id,
      i === 0 ? 'player' : `policy:${a.policyId}`,
    ])),
  };
  refreshDraft();
  // The account as round 0 left it, kept so the end screen can diff the
  // decision log against something. A snapshot for display, not state the
  // engine owns — `game.draft.base` is already that snapshot, deep-copied out
  // of `getSelfView` a line ago.
  game.opening = {
    negatives: game.draft.base.negatives,
    keywords: game.draft.base.keywords,
  };
}

/**
 * Store the game as it now stands. Called after every week.
 *
 * `game.saved` records whether it worked, so the header can say so and the
 * leave warning knows whether a reload would cost anything.
 */
function persist() {
  game.saved = writeSave(storage, makeSave({
    initial: game.initial,
    decisionLog: game.state.decisionLog,
    playerId: game.playerId,
    weeksPlayed: game.reports.length,
    fingerprint: fingerprintOf(game.reports, game.playerId),
  }));
}

/**
 * Rebuild the form's working copy from the account as it now stands.
 *
 * From `getSelfView`, never from `state.advertisers[0]`. The view is deep
 * copied on the way out, so the form cannot write through into `GameState` —
 * which is the failure this whole seam is arranged to make impossible.
 */
function refreshDraft() {
  game.draft = createDraft(getSelfView(game.state, game.playerId), {
    // Not in getSelfView: the schedule is a rule of the game rather than
    // anything private, and the form needs it to know whether this is the
    // round capital is allocated in (13.3).
    allocationRounds: game.state.budgetSchedule?.capexAllocationRounds,
  });
}

function chrome() {
  const label = document.getElementById('round-label');
  const brand = document.getElementById('brand');
  const position = document.getElementById('position');

  // The guide's chapters point at dashboard cards, so it opens once there is a
  // dashboard to point at.
  guideButton.hidden = !game;
  if (!game) {
    guide.close();
    brand.textContent = 'Round 0';
    position.textContent = 'before you have seen a single auction';
    label.textContent = '';
    nextButton.hidden = true;
    redoButton.hidden = true;
    return;
  }

  const me = game.state.advertisers.find((a) => a.id === game.playerId);
  brand.textContent = me.name;
  position.textContent = `${me.position.price} · ${me.position.purpose}`;

  const played = game.reports.length;
  // Said quietly when it worked and plainly when it did not, because a reload
  // is the one thing a player cannot undo.
  const saveState = game.saved === true ? ' · saved' : game.saved === false ? ' · not saved' : '';
  label.textContent = `week ${played} of ${TOTAL_ROUNDS}${saveState}`;
  label.title = game.saved === false
    ? 'This browser is refusing to store the game, so a reload will lose it.'
    : game.saved ? 'Saved in this browser. A reload brings you back here.' : '';
  nextButton.hidden = false;
  nextButton.disabled = played >= TOTAL_ROUNDS;
  nextButton.textContent = played >= TOTAL_ROUNDS ? 'Game over' : commitLabel();

  // 17.3: one redo, up to the end of round 3. A learning affordance rather
  // than a game mechanic, so it is offered plainly and then withdrawn.
  redoButton.hidden = !canRedoRoundZero(game.state);
}

/**
 * The commit button says how much it is about to commit.
 *
 * A decision has to be previewable before it is taken, and the button is the
 * last thing between a staged change and a week that cannot be replayed.
 */
function commitLabel() {
  const staged = game?.draft ? changes(game.draft).length : 0;
  return staged === 0
    ? 'Run the week'
    : `Run the week · ${staged} change${staged === 1 ? '' : 's'}`;
}

/**
 * Throw this game away and go back to round 0.
 *
 * Offered only once the twelfth week is played, so it cannot cost anybody a
 * game in progress — and the end screen asks which market before it does
 * anything, because twelve rounds is too much to lose to one stray click.
 *
 * NOT the same thing as the round 0 redo (17.3). A redo goes back THROUGH
 * `redoRoundZero`, which stamps `redoUsed` and keeps the identical market on
 * purpose; this starts over completely, and `rewinding` is cleared so the new
 * game arrives with its redo unspent.
 *
 * @param {'same'|'new'} market whether to replay this market or move on
 */
function restart(market) {
  if (market === 'new') rootSeed += 1;
  clearSave(storage);
  game = null;
  rewinding = null;
  studio = null;
  render();
  window.scrollTo(0, 0);
}

/** What the recorder calls the screen about to be drawn. */
function screenName() {
  if (!game) return rewinding ? 'round 0 (redo)' : 'round 0';
  const played = game.reports.length;
  return played >= TOTAL_ROUNDS ? 'end screen' : `week ${played}`;
}

function render() {
  chrome();
  recorder?.phase(screenName());
  if (!game) {
    roundZeroTouched = false;
    if (look === 'studio') {
      // Round 0 in the sidebar layout (plans/2026-09-14-round-zero-redesign.md).
      // The brand is drawn from the seed; a redo keeps the one it had, because
      // redoRoundZero rebuilds the same market around it.
      app.replaceChildren(createRoundZero({
        querySet: QUERY_SET,
        rootSeed,
        playerBrandId: rewinding?.roundZero?.playerBrandId ?? assignPlayerBrand(rootSeed),
        openGuide: guide.open,
        openContents: (trigger) => guide.openContents(trigger),
        onGo: begin,
        onPlaytest: recorder ? sendPlaytestFile : null,
      }).node);
    } else {
      app.replaceChildren(renderRoundZero({ querySet: QUERY_SET, rootSeed, onStart: begin }));
    }
    window.scrollTo(0, 0);
    return;
  }
  // The Studio layout: the same dashboard and form, shown one section at a
  // time, with the ending in its own Results area.
  if (look === 'studio') {
    studio ??= createStudio({
      onRun: runWeek,
      onRedo: redo,
      openGuide: guide.open,
      openContents: (trigger) => guide.openContents(trigger),
      onPlaytest: recorder ? sendPlaytestFile : null,
    });
    let endingNode = null;
    if (game.reports.length >= TOTAL_ROUNDS) {
      endingNode = el('div', 'studio-results');
      endingNode.append(...endingNodes());
    }
    studio.draw(game, { saved: game.saved, canRedo: canRedoRoundZero(game.state), endingNode });
    app.replaceChildren(studio.node);
    return;
  }

  const dashboard = renderDashboard(game, () => {
    // Only the button, so staging a change does not rebuild the screen under
    // the cursor. The dashboard redraws its own cards.
    nextButton.textContent = commitLabel();
  }, { openGuide: guide.open });

  // The ending goes ABOVE the last week rather than replacing it: the final
  // dashboard is still the most detailed thing in the game, and a summary that
  // hid it would answer fewer questions than it raised.
  if (game.reports.length >= TOTAL_ROUNDS) {
    app.replaceChildren(...endingNodes(), dashboard);
    return;
  }
  app.replaceChildren(dashboard);
}

/** The end screen and, on the playtest link, its questions. */
function endingNodes() {
  const ending = el('section', 'grid');
  ending.append(renderEnding({
    state: game.state,
    history: game.state.history,
    playerId: game.playerId,
    opening: game.opening,
    // The debrief replays the game from here, and the reveal reads the
    // rivals' round-0 ads and positions from it.
    initial: game.initial,
    openGuide: guide.open,
    onRestart: restart,
  }));
  if (!recorder) return [ending];
  // A playtester's questions come after the books are open and before the
  // last week, so they are asked once the whole game has been seen.
  const questions = el('section', 'grid');
  questions.append(renderPlaytestPanel({
    recorder,
    onDownload: () => downloadPlaytestFile(recorder, storage),
  }));
  return [ending, questions];
}

/**
 * Back to round 0, keeping the game to rewind FROM. Same seed, same rivals,
 * same cells, same ads — only the player's own choices change, because
 * replaying against a different market would answer a different question.
 */
function redo() {
  rewinding = game.state;
  game = null;
  studio = null;
  render();
}

/**
 * At the end the questions come first; anywhere else, the file at once, so a
 * player who stops halfway can still send what they did.
 */
function sendPlaytestFile() {
  const questions = document.getElementById('playtest-panel');
  if (questions) questions.scrollIntoView({ behavior: 'smooth', block: 'start' });
  else downloadPlaytestFile(recorder, storage);
}

/**
 * Buy one week, then redraw.
 *
 * Shared by the header button and by round 0's own, so opening the account runs
 * the first week down exactly the same path as every week after it — including
 * the decision log and the learning period, which `submitRound` owns.
 */
async function runWeek() {
  // The player's controller reads `game.draft`, so nothing is passed here.
  const started = performance.now();
  const out = await playRound(game.state, game.controllers, {
    mode: 'expected',
    sources: game.sources,
  });
  const computeMs = performance.now() - started;
  game.state = out.nextGameState;
  game.reports.push(out.report);
  game.insights.push(out.insights);
  persist();
  recorder?.week(game.reports.length, computeMs);
  // Rebuilt from the account the round produced, so what the form shows is
  // what the engine now holds — staged changes have become real ones.
  // `game.opening` is deliberately NOT refreshed: it is the round 0 snapshot
  // the end screen diffs the decision log against, and re-taking it every
  // round would make every week's diff empty.
  refreshDraft();
  render();
}

nextButton.addEventListener('click', async () => {
  nextButton.disabled = true;
  nextButton.textContent = 'running 168 hours…';
  // Yield once so the button repaints before the round blocks the thread.
  await new Promise((resolve) => setTimeout(resolve, 0));
  await runWeek();
});

// ---------------------------------------------------------------------------
// Resuming a saved game (stage A4)
// ---------------------------------------------------------------------------

/** One full-width card, the shape every screen here is built from. */
function panel(title, subtitle) {
  const node = el('article', 'card span-4');
  const heading = el('h2', null, title);
  if (subtitle) heading.append(el('span', 'muted', subtitle));
  node.append(heading);
  return node;
}

function showPanel(node) {
  const grid = el('section', 'grid');
  grid.append(node);
  app.replaceChildren(grid);
  window.scrollTo(0, 0);
}

function choice(label, why, onPick) {
  const row = el('div', 'restart-row');
  const button = el('button', 'restart-pick', label);
  button.type = 'button';
  button.addEventListener('click', onPick);
  row.append(button, el('div', 'restart-why muted', why));
  return row;
}

/** Throw the saved game away and open round 0. */
function startAfresh() {
  clearSave(storage);
  game = null;
  render();
}

/**
 * Offer the saved game back. It is never resumed silently: a player who meant
 * to start again should not find themselves in week 9.
 */
function offerResume(saved) {
  const me = saved.initialState.advertisers.find((a) => a.id === saved.playerId);
  document.getElementById('brand').textContent = me.name;
  document.getElementById('position').textContent = `${me.position.price} · ${me.position.purpose}`;
  document.getElementById('round-label').textContent = 'saved game';
  nextButton.hidden = true;
  redoButton.hidden = true;
  guideButton.hidden = true;
  recorder?.phase('resume offer');

  const finished = saved.weeksPlayed >= TOTAL_ROUNDS;
  const node = panel('A game in progress', 'saved in this browser');
  node.append(el('p', 'note',
    `${me.name}, ${me.position.price} · ${me.position.purpose}: ${saved.weeksPlayed} of `
    + `${TOTAL_ROUNDS} weeks played. Resuming replays those weeks from your own decisions, `
    + 'which takes a few seconds.'));
  node.append(
    choice(finished ? 'Back to the end screen' : `Resume at week ${saved.weeksPlayed + 1}`,
      'Everything as you left it, except changes you had staged and not yet run.',
      () => resume(saved)),
    choice('Start a new game',
      'Discards the saved game. There is no getting it back.',
      startAfresh),
  );
  showPanel(node);
}

async function resume(saved) {
  recorder?.phase('restoring');
  const node = panel('Restoring your game');
  const progress = el('p', 'note', `Replaying week 1 of ${saved.weeksPlayed}…`);
  node.append(progress);
  showPanel(node);

  const restored = await restoreSave(saved, {
    mode: 'expected',
    onWeek: (week, of) => {
      progress.textContent = week < of ? `Replaying week ${week + 1} of ${of}…` : 'Done.';
    },
  });

  rootSeed = saved.initialState.rootSeed;
  openGame(saved.initialState, saved.playerId);
  game.state = restored.state;
  game.reports = restored.reports;
  game.insights = restored.insights;
  refreshDraft();
  if (restored.exact) {
    game.saved = true;
    render();
    return;
  }

  // The same decisions, run by an engine that has changed since the save was
  // written, gave different weeks. Say so rather than hand back a game quietly
  // different from the one that was played.
  recorder?.phase('replay changed');
  const warn = panel('This game has changed since you saved it');
  warn.append(el('p', 'note',
    'The simulator has been updated since this game was saved. Replayed on this '
    + 'version, your own decisions produce different weeks from the ones you '
    + 'played, so the numbers you would see are this version’s, not the ones you '
    + 'read at the time.'));
  warn.append(
    choice('Continue with these numbers', 'Carry on from here on the updated simulator.', () => {
      persist();
      render();
    }),
    choice('Start a new game', 'Discards the saved game.', startAfresh),
  );
  showPanel(warn);
}

/**
 * Should leaving the page be questioned? Only when a reload would cost
 * something: an unfinished round 0 that has been touched, a game the browser
 * refused to store, or changes staged and not yet run. Warning on every visit
 * would teach players to click straight through it.
 */
function leavingCostsWork() {
  if (!game) return roundZeroTouched;
  if (game.reports.length >= TOTAL_ROUNDS) return false;
  return game.saved !== true || changes(game.draft).length > 0;
}

window.addEventListener('beforeunload', (event) => {
  if (!leavingCostsWork()) return;
  event.preventDefault();
  // Older browsers only show the prompt when this is set.
  event.returnValue = '';
});

for (const type of ['input', 'change', 'click']) {
  app.addEventListener(type, () => { if (!game) roundZeroTouched = true; });
}

redoButton.addEventListener('click', redo);

if (recorder) {
  // Before the first screen is drawn, so the load is recorded ahead of the
  // phase it opens on.
  recorder.load();
  attachRecorder(recorder);
  playtestButton.hidden = false;
  playtestButton.addEventListener('click', sendPlaytestFile);
}

const saved = readSave(storage);
if (saved) offerResume(saved);
else render();
