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
import { createDraft, toDecision, changes } from './decisions.js';
import {
  makeSave, writeSave, readSave, clearSave, fingerprintOf, restoreSave,
} from './save.js';
import {
  playtestMode, createRecorder, attachRecorder, downloadPlaytestFile, renderPlaytestPanel,
} from './recorder.js';
import { createGuide } from './guide/drawer.js';
import { guideFigures } from './guide/figures.js';
import { createStudio } from './shell/shell.js';
import { createPlayout, playoutSkipped, markPlayoutSkipped } from './playout/render.js';
import { figuresFor as figuresForWeek, playsAutomatically } from './playout/read.js';
import { createRoundZero } from './roundzero/studio.js';
import { notesFor } from './roundzero/rules.js';
import { renderDoor } from './door/render.js';
import { doorFacts, changedWeeks } from './door/read.js';
import { createFirstRun, seenFirstRun, markFirstRunSeen } from './firstrun/render.js';
import { demonstration } from './firstrun/auction.js';
import { figuresFor, partsFor } from './firstrun/read.js';

/**
 * The market this game is played in. NOT a constant any more, because the end
 * screen can start another one — but still a SEED rather than a clock, so a
 * game remains reproducible from the number `state.rootSeed` records (R1).
 * A new market is the next seed along, not a random one.
 */
let rootSeed = 20260902;

const app = document.getElementById('app');

/**
 * The Studio layout (plans/2026-09-13-studio-makeover.md), built on the first
 * week drawn and dropped whenever the game is. Since the switch-over's part 2
 * it is the only layout there is.
 */
let studio = null;

/**
 * The field guide (stage C2). Built once and kept outside `#app`, so redrawing
 * a week never removes it; every "why?" button opens this one drawer. "Show me
 * in your account" first opens the section the part sits in, and before week 1,
 * when there is no part, it is not offered; nor while the section is still
 * locked. The Guide page reads the same chapters with the same figures, and the
 * drawer's Contents opens that page.
 */
const GUIDE_FIGURES = guideFigures();
const guide = createGuide({
  onWatchIntro: () => replayFirstRun(),
  figures: GUIDE_FIGURES,
  reveal: (slot) => studio?.reveal(slot) ?? false,
  canShowCard: (slot) => Boolean(game) && (studio ? studio.canReveal(slot) : true),
  inStudio: () => true,
  contentsPage: () => {
    if (!studio || !game) return false;
    studio.openChapter('contents');
    return true;
  },
});
document.body.append(guide.node);

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
 * The playtest recorder, on the invite link only (stage B). Null for everyone
 * else, and every use below is `recorder?.`, so the ordinary game runs none of
 * it and draws nothing it did not draw before.
 */
const recorder = playtestMode(window.location.search, storage)
  ? createRecorder({ storage, now: () => Date.now() })
  : null;

/**
 * Whether round 0 has been touched since it was drawn. Round 0 is never saved
 * (a game only exists once the account opens), so it is the one screen a
 * reload can still cost work on.
 */
let roundZeroTouched = false;

/**
 * Whether the first run is on screen. It sits before round 0 and before any
 * game exists, so it is the one screen with no state of its own to lose — and
 * a click in it must not mark round 0 as touched.
 */
let inFirstRun = false;
/** Set when the intro is asked for again, from the door or the Guide (I54). */
let replayIntro = false;
/**
 * Where to go when a replayed intro finishes. The Guide's caller wants
 * `render()`, which puts the player back in the week they were reading from.
 * THE DOOR'S DOES NOT: `render()` with no game opens round 0, so watching a
 * minute cost a returning player the offer to resume — found by clicking it.
 */
let introReturn = null;

/**
 * The game being rewound, while round 0 is on screen for a second time (17.3).
 *
 * Held rather than discarded because the rewind has to go back THROUGH
 * `redoRoundZero`, which is what stamps `redoUsed` and keeps the market
 * identical. Starting fresh would silently hand out a second redo and a
 * different set of rivals.
 */
let rewinding = null;

/**
 * The week waiting to play out, or null (plans/2026-09-27-week-playout.md).
 *
 * Held as FIGURES rather than as a report, so `render()` cannot re-read a week
 * that has since been revised. What it draws is what the round produced.
 */
let playout = null;

/** What the recorder calls this screen, so the next playtest file can judge it. */
const PLAYOUT_PHASE = 'the week playing out';

async function begin({ playerBrandId, player, guesses = null }) {
  const state = rewinding
    ? redoRoundZero(rewinding, { playerBrandId, player })
    : startGame({ rootSeed, playerBrandId, player, querySet: QUERY_SET });
  rewinding = null;
  openGame(state, playerBrandId);
  // Round 0's notes on the rivals, kept for the reveal after the last week
  // (the owner, 2026-09-15). Only the Studio's round 0 takes them; a game
  // opened on the classic page has none, and the reveal asks at the end.
  game.notes = guesses ? notesFor(guesses, state.advertisers, playerBrandId) : null;

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
    // Every week as it stood before the latest week ran, which the engine
    // does not keep: running a week rewrites the earlier ones (11.4). Your
    // week's dashed tick is drawn from it (ui/save.js keeps it on a reload).
    historyBefore: [],
    // Round 0's notes on where each rival sits, rival id to square, or null.
    // Display only; the save carries them for the reveal.
    notes: null,
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
    notes: game.notes,
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
  // Its own phase, never round 0's: counted inside round 0, the run's minutes
  // would be absorbed by the very gate it exists to protect
  // (plans/2026-09-19-first-run-and-ground-floor.md, 9.2).
  if (inFirstRun) return 'first run';
  if (!game) return rewinding ? 'round 0 (redo)' : 'round 0';
  const played = game.reports.length;
  return played >= TOTAL_ROUNDS ? 'end screen' : `week ${played}`;
}

function render() {
  recorder?.phase(screenName());

  /**
   * THE MINUTE BEFORE ROUND 0, for someone who has never bought an ad
   * (plans/2026-09-19-first-run-and-ground-floor.md). It plays once per
   * browser, and never on a redo: a player rewinding round 0 has already met
   * all of it.
   *
   * IT CAN ALSO BE ASKED FOR, from the door and from the Guide (I54, the
   * owner 2026-09-26). That is why this sits OUTSIDE `if (!game)`: the one
   * screen that teaches what the game is about could only be reached before
   * a game existed, so a player who got lost in week 4 had no way back to it.
   * `onDone` calls `render()`, which returns whoever asked to exactly where
   * they were — round 0, or the week they were playing.
   */
  if (replayIntro || (!game && !rewinding && !seenFirstRun(storage))) {
    inFirstRun = true;
    recorder?.phase(screenName());
    const demo = demonstration();
    const figures = figuresFor(demo);
    app.replaceChildren(createFirstRun({
      figures,
      parts: partsFor(demo, figures),
      onDone: () => {
        markFirstRunSeen(storage);
        replayIntro = false;
        inFirstRun = false;
        const back = introReturn;
        introReturn = null;
        if (back) back(); else render();
      },
    }).node);
    window.scrollTo(0, 0);
    return;
  }

  /**
   * THE WEEK PLAYING OUT (plans/2026-09-27-week-playout.md), between pressing
   * Run and reading the dashboard.
   *
   * The opening minute teaches the ladder and then the game never shows one
   * again: every week was a form you submitted and a table you read. This is
   * the auction coming back, weekly, with the player's own numbers in it. It
   * reads the report the round JUST produced — `reviseReports` drains
   * `stillPending` over the following weeks, so a revised copy of the same
   * week reads a smaller number than the week ever showed.
   */
  if (playout) {
    recorder?.phase(PLAYOUT_PHASE);
    const live = createPlayout({
      figures: playout,
      onDone: ({ skipped }) => {
        if (skipped) markPlayoutSkipped(storage);
        playout = null;
        render();
      },
    });
    app.replaceChildren(live.node);
    window.scrollTo(0, 0);
    return;
  }

  if (!game) {
    roundZeroTouched = false;
    // The drawer belongs to a game: its chapters point at parts of the account,
    // and round 0 has none yet. Closing it here is what the header's own
    // bookkeeping used to do before the switch-over took the header away.
    guide.close();
    inFirstRun = false;
    // Round 0 in the sidebar layout (plans/2026-09-14-round-zero-redesign.md).
    // Round 0 starts on the brand the seed draws, and step 2 lets the player
    // pick another; a redo starts on the one the game was played as.
    app.replaceChildren(createRoundZero({
      querySet: QUERY_SET,
      rootSeed,
      playerBrandId: rewinding?.roundZero?.playerBrandId ?? assignPlayerBrand(rootSeed),
      openGuide: guide.open,
      openContents: (trigger) => guide.openContents(trigger),
      onGo: begin,
      onPlaytest: recorder ? sendPlaytestFile : null,
    }).node);
    window.scrollTo(0, 0);
    return;
  }
  studio ??= createStudio({
    onRun: runWeek,
    onRedo: redo,
    openGuide: guide.open,
    showCard: guide.showCard,
    figures: GUIDE_FIGURES,
    onPlaytest: recorder ? sendPlaytestFile : null,
    onExit: backToMenu,
    onWatchIntro: replayFirstRun,
    onWatchWeek: watchLatestWeek,
  });
  // After the last week the shell draws Results itself (ui/results/render.js,
  // the owner's choice 2026-09-15); it is handed only what it cannot reach:
  // starting over, and on the playtest link the questions, asked once the
  // whole game has been seen.
  const ending = game.reports.length >= TOTAL_ROUNDS ? {
    onRestart: restart,
    playtest: recorder ? { recorder, onDownload: () => downloadPlaytestFile(recorder, storage) } : null,
  } : null;
  studio.draw(game, { saved: game.saved, canRedo: canRedoRoundZero(game.state), ending });
  app.replaceChildren(studio.node);
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
 * The file at once. Until the switch-over's part 2 this scrolled to the classic
 * questions panel when the game was over; the questions are a Results section
 * now ("Before you go"), and the shell's own Playtest button opens it after the
 * last week, so everything that reaches here wants the file itself.
 */
function sendPlaytestFile() {
  // ASK BEFORE HANDING OVER THE FILE. Until 2026-09-19 this downloaded at once,
  // and the two questions lived on Results alone — so the game could only ask
  // what it had taught you if you played all twelve weeks. The people this is
  // for are the ones who stop early (the design's section 7).
  //
  // On Results the questions are already on screen, so pressing the rail's
  // Playtest there means the file, not the questions again.
  if (game && game.reports.length >= TOTAL_ROUNDS) {
    downloadPlaytestFile(recorder, storage);
    return;
  }
  askBeforeSending();
}

/** The two questions, over whatever is on screen, and the file under them. */
function askBeforeSending() {
  const close = () => {
    document.getElementById('playtest-panel')?.remove();
    recorder?.phase(screenName());
  };
  close();
  recorder?.phase('playtest questions');
  document.body.append(renderPlaytestPanel({
    recorder,
    onDownload: () => {
      downloadPlaytestFile(recorder, storage);
      close();
    },
    onClose: close,
  }));
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
  game.historyBefore = game.state.history;
  game.state = out.nextGameState;
  game.reports.push(out.report);
  game.insights.push(out.insights);
  persist();
  recorder?.week(game.reports.length, computeMs);
  // Built HERE, from the round's own output, and not in `render()`: by the time
  // a later week is drawn this week's report has been revised and its pending
  // queue drained. Names are public (`getPublicView`'s whitelist), so reading
  // them off the account is not a leak.
  playout = startPlayout(out, game.reports.length);
  // Rebuilt from the account the round produced, so what the form shows is
  // what the engine now holds — staged changes have become real ones.
  // `game.opening` is deliberately NOT refreshed: it is the round 0 snapshot
  // the end screen diffs the decision log against, and re-taking it every
  // round would make every week's diff empty.
  refreshDraft();
  render();
}

/**
 * The figures for the week just run, or null when it should not play.
 *
 * @param {object} out - `playRound`'s return
 * @param {number} week - 1-based, the week just played
 * @returns {object|null} `figuresFor()`, or null
 */
function startPlayout(out, week) {
  if (!playsAutomatically(week, playoutSkipped(storage))) return null;
  return playoutFigures(out.report, out.insights);
}

/**
 * @param {object} report - a round report, `{byAdvertiser}`
 * @param {object} insights - that round's, keyed by advertiser id
 * @returns {object|null} `figuresFor()` for the player's row, or null when
 *   there is nothing to show
 */
function playoutFigures(report, insights) {
  const row = report?.byAdvertiser?.[game.playerId];
  const rivals = insights?.[game.playerId]?.rivals;
  if (!row || !rivals) return null;
  const names = Object.fromEntries(game.state.advertisers.map((a) => [a.id, a.name]));
  return figuresForWeek(row, rivals, names);
}

/**
 * Play the latest week again, from Your week's own card.
 *
 * THE LATEST WEEK IS THE ONE SAFE WEEK TO REPLAY. `reviseReports` edits
 * EARLIER weeks as late sales land, so an older report's `stillPending` has
 * been drained and reads smaller than that week ever showed. The newest report
 * has had nothing taken out of it yet.
 */
function watchLatestWeek() {
  playout = playoutFigures(game.reports.at(-1), game.insights.at(-1));
  if (playout) render();
}

// ---------------------------------------------------------------------------
// Resuming a saved game (stage A4)
// ---------------------------------------------------------------------------

/**
 * The Studio's front door (design/switch-over/, A), in the page's own space:
 * the shell appears only once there is a game to put in it.
 *
 * @param {object} view - `renderDoor`'s (ui/door/render.js)
 * @returns {{progress: (week: number, of: number) => void}}
 */
function showDoor(view) {
  const door = renderDoor(view);
  app.replaceChildren(door.node);
  window.scrollTo(0, 0);
  door.node.querySelector('.door-title')?.focus({ preventScroll: true });
  return door;
}

/** Throw the saved game away and open round 0. */
function startAfresh() {
  clearSave(storage);
  game = null;
  render();
}

/**
 * Play the minute about how Google Ads works again, from wherever it was
 * asked for (I54). It throws nothing away: `onDone` returns to the same
 * screen, whether that is the door, round 0 or week 7.
 */
function replayFirstRun(back = null) {
  // A CLICK HANDLER IS HANDED AN EVENT, not the argument you meant. The Guide
  // passes this function straight to `addEventListener`, so `back` arrived as
  // a MouseEvent — truthy, not callable, and the page went blank on the way
  // out of the intro. Anything that is not a function means "just re-render".
  introReturn = typeof back === 'function' ? back : null;
  replayIntro = true;
  render();
}

/**
 * Out of a finished game and back to the front door, which is the nearest thing
 * this has to a main menu (the owner, 2026-09-19: after the last week the tray
 * offered "See your results" and nothing else, and no screen led anywhere out).
 *
 * IT THROWS NOTHING AWAY. The save is written after every week, so the door
 * meets a finished one and says so — "A finished game" — and opening it again
 * replays all twelve weeks. Starting fresh is still a separate, warned choice
 * there, as it is on the books page.
 */
function backToMenu() {
  const saved = readSave(storage);
  if (!saved) { startAfresh(); return; }
  game = null;
  offerResume(saved);
}

/**
 * Offer the saved game back. It is never resumed silently: a player who meant
 * to start again should not find themselves in week 9.
 */
function offerResume(saved) {
  recorder?.phase('resume offer');
  const facts = doorFacts(saved);
  showDoor({
    ...facts,
    state: facts.finished ? 'finished' : 'offer',
    onResume: () => resume(saved),
    onStartAfresh: startAfresh,
    onPlaytest: recorder ? sendPlaytestFile : null,
    onWatchIntro: () => replayFirstRun(() => offerResume(saved)),
  });
}

async function resume(saved) {
  recorder?.phase('restoring');
  const base = {
    ...doorFacts(saved),
    onStartAfresh: startAfresh,
    onPlaytest: recorder ? sendPlaytestFile : null,
  };
  const door = showDoor({ ...base, state: 'restoring' });

  // A replay is exact by design — the same first state, the same log and a
  // seeded engine — so one that throws would throw again on the next try. Until
  // this, nothing caught it and "Restoring your game" stayed on screen for ever
  // (found drawing the switch-over, 2026-09-16).
  try {
    const restored = await restoreSave(saved, {
      mode: 'expected',
      onWeek: (week, of) => door.progress(week, of),
    });

    rootSeed = saved.initialState.rootSeed;
    openGame(saved.initialState, saved.playerId);
    game.notes = saved.notes;
    game.state = restored.state;
    game.reports = restored.reports;
    game.insights = restored.insights;
    game.historyBefore = restored.historyBefore;
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
    const carryOn = () => {
      persist();
      render();
    };
    const { rows, more } = changedWeeks(saved.fingerprint, restored.reports, saved.playerId);
    showDoor({ ...base, state: 'changed', rows, more, onCarryOn: carryOn });
  } catch (error) {
    console.error(error);
    recorder?.phase('restore failed');
    game = null;
    showDoor({ ...base, state: 'failed' });
  }
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

// A click on the front door is not work round 0 would lose, so reloading while
// a game restores, or on a door that could not open one, asks nothing. Nor is
// a click in the first run: it holds nothing a reload could cost.
for (const type of ['input', 'change', 'click']) {
  app.addEventListener(type, (event) => {
    if (!game && !inFirstRun && !event.target.closest?.('.door')) roundZeroTouched = true;
  });
}

if (recorder) {
  // Before the first screen is drawn, so the load is recorded ahead of the
  // phase it opens on.
  recorder.load();
  attachRecorder(recorder);
}

const saved = readSave(storage);
if (saved) offerResume(saved);
else render();
