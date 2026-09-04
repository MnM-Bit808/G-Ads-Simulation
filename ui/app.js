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

import { startGame, redoRoundZero, canRedoRoundZero } from '../setup.js';
import { playRound } from '../game.js';
import { POLICIES } from '../agents/policies.js';
import { QUERY_SET } from '../content/querySet.js';
import { getSelfView } from '../engine/insights.js';
import { TOTAL_ROUNDS } from '../engine/constants.js';
import { el } from './dom.js';
import { renderRoundZero } from './round-zero.js';
import { renderDashboard } from './dashboard.js';
import { createDraft, toDecision, changes } from './decisions.js';

const ROOT_SEED = 20260902;

/**
 * One policy per rival, cycling the six so every character is in the market.
 *
 * `disciplined` is the competent baseline; the other five are each wrong about
 * one thing in a legible way, which is what makes the market worth reading.
 */
const CAST = ['spender', 'cautious', 'automator', 'grossOptimiser', 'brandDefender', 'disciplined'];

const app = document.getElementById('app');
const nextButton = document.getElementById('next');
const redoButton = document.getElementById('redo');

/** Everything the interface knows. The engine owns the rest. */
let game = null;

/**
 * The game being rewound, while round 0 is on screen for a second time (17.3).
 *
 * Held rather than discarded because the rewind has to go back THROUGH
 * `redoRoundZero`, which is what stamps `redoUsed` and keeps the market
 * identical. Starting fresh would silently hand out a second redo and a
 * different set of rivals.
 */
let rewinding = null;

function begin({ playerBrandId, player }) {
  const state = rewinding
    ? redoRoundZero(rewinding, { playerBrandId, player })
    : startGame({ rootSeed: ROOT_SEED, playerBrandId, player, querySet: QUERY_SET });
  rewinding = null;

  game = {
    playerId: playerBrandId,
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
    controllers: Object.fromEntries(state.advertisers.map((a, i) => [
      a.id,
      i === 0 ? () => toDecision(game.draft) : POLICIES[CAST[(i - 1) % CAST.length]],
    ])),
    // 12.4: every logged decision carries where it came from, or a replay
    // cannot tell a player's week from a policy's.
    sources: Object.fromEntries(state.advertisers.map((a, i) => [
      a.id,
      i === 0 ? 'player' : `policy:${CAST[(i - 1) % CAST.length]}`,
    ])),
  };
  refreshDraft();
  render();
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

  if (!game) {
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
  label.textContent = played === 0 ? 'no weeks played' : `week ${played} of ${TOTAL_ROUNDS}`;
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

function render() {
  chrome();
  if (!game) {
    app.replaceChildren(renderRoundZero({
      querySet: QUERY_SET,
      rootSeed: ROOT_SEED,
      onStart: begin,
    }));
    window.scrollTo(0, 0);
    return;
  }
  if (game.reports.length === 0) {
    app.replaceChildren(el('p', 'loading',
      'The account is open and nothing has run yet. Run the week to buy some traffic.'));
    return;
  }
  app.replaceChildren(renderDashboard(game, () => {
    // Only the button, so staging a change does not rebuild the screen under
    // the cursor. The dashboard redraws its own cards.
    nextButton.textContent = commitLabel();
  }));
}

nextButton.addEventListener('click', async () => {
  nextButton.disabled = true;
  nextButton.textContent = 'running 168 hours…';
  // Yield once so the button repaints before the round blocks the thread.
  await new Promise((resolve) => setTimeout(resolve, 0));

  // The player's controller reads `game.draft`, so nothing is passed here.
  const out = await playRound(game.state, game.controllers, {
    mode: 'expected',
    sources: game.sources,
  });
  game.state = out.nextGameState;
  game.reports.push(out.report);
  game.insights.push(out.insights);
  // Rebuilt from the account the round produced, so what the form shows is
  // what the engine now holds — staged changes have become real ones.
  refreshDraft();
  render();
});

redoButton.addEventListener('click', () => {
  // Back to round 0, keeping the game to rewind FROM. Same seed, same rivals,
  // same cells, same ads — only the player's own choices change, because
  // replaying against a different market would answer a different question.
  rewinding = game.state;
  game = null;
  render();
});

render();
