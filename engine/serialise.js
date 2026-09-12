/**
 * Save, load and replay (spec 5.1, 12.4, L16).
 *
 * WHY LOADING IS STRICT
 *
 * A save file from an earlier schema does not fail loudly on its own. It fails
 * quietly: a field that moved reads as undefined, a rule that changed applies
 * to numbers gathered under the old one, and the game keeps running while
 * teaching something false. So an unknown `schemaVersion` throws, and it
 * throws before anything is read.
 *
 * WHY REPLAY READS A LOG
 *
 * Two of the eight rivals are Claude-backed. Ask them again and they answer
 * differently, so a saved game replayed by re-invoking them is a different
 * game. Every decision is therefore appended to `decisionLog` as it is
 * submitted, and replay reads from the log and never calls a model (L12).
 *
 * That makes a saved game reproducible from `rootSeed` plus the log alone,
 * which is what "same inputs, same outputs" has to mean once part of the
 * market is a language model.
 */

import { SCHEMA_VERSION } from './constants.js';
import { runRound } from './round.js';

/**
 * @param {object} gameState
 * @param {{pretty?: boolean}} [opts]
 * @returns {string} JSON
 */
export function serialise(gameState, opts = {}) {
  if (gameState?.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `refusing to save schemaVersion ${JSON.stringify(gameState?.schemaVersion)}, `
      + `expected ${SCHEMA_VERSION}`,
    );
  }
  return JSON.stringify(gameState, null, opts.pretty ? 2 : 0);
}

/**
 * Load a saved game, refusing anything this build cannot read correctly.
 *
 * @param {string} json
 * @returns {object} gameState
 */
export function deserialise(json) {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (cause) {
    throw new Error(`save file is not valid JSON: ${cause.message}`, { cause });
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('save file must contain a game state object');
  }

  // Checked before anything else is touched. A version mismatch means every
  // other field is suspect, so there is nothing to be gained by reading on.
  if (parsed.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `unknown schemaVersion ${JSON.stringify(parsed.schemaVersion)}: `
      + `this build reads ${SCHEMA_VERSION} only`,
    );
  }

  for (const field of ['round', 'rootSeed']) {
    if (!Number.isFinite(parsed[field])) {
      throw new Error(`save file is missing a usable ${field}`);
    }
  }
  if (!Array.isArray(parsed.advertisers) || parsed.advertisers.length === 0) {
    throw new Error('save file has no advertisers');
  }
  if (!parsed.querySet || !Array.isArray(parsed.querySet.queries)) {
    throw new Error('save file has no query set');
  }

  return parsed;
}

/**
 * Append one round's decisions to the log.
 *
 * `source` records where each came from — `player`, `policy:<id>` or `llm` —
 * because a replay needs to know which entries could not be regenerated even
 * in principle.
 *
 * @param {object[]} decisionLog
 * @param {number} round
 * @param {object} decisions keyed by advertiser id
 * @param {object} sources keyed by advertiser id
 * @returns {object[]} a new log
 */
export function logDecisions(decisionLog, round, decisions, sources = {}) {
  const entries = Object.entries(decisions).map(([advertiserId, decision]) => ({
    round,
    advertiserId,
    source: sources[advertiserId] ?? 'unknown',
    decision,
  }));
  return [...(decisionLog ?? []), ...entries];
}

/**
 * The decisions submitted in one round, in the shape runRound expects.
 *
 * @param {object[]} decisionLog
 * @param {number} round
 * @returns {object} keyed by advertiser id
 */
export function decisionsForRound(decisionLog, round) {
  const out = {};
  for (const entry of decisionLog ?? []) {
    if (entry.round === round) out[entry.advertiserId] = entry.decision;
  }
  return out;
}

/**
 * Replay a game from its log, without ever consulting a model.
 *
 * THE ENGINE'S REPLAY, NOT THE GAME'S. This runs `runRound` alone, which is
 * exact for a game played through `runRound` and wrong for one played through
 * `game.js`: it skips capital, repositioning, a self-written ad landing and the
 * Quality Scores the caller attaches. Measured on a played game, its costs do
 * not match. A played game is restored with `game.js`'s `replayLog`.
 *
 * @param {object} initialState the state as it was at the first logged round
 * @param {object[]} decisionLog
 * @param {object} [options] passed through to runRound; seed and mode included
 * @returns {{finalState: object, reports: object[]}}
 */
export function replayGame(initialState, decisionLog, options = {}) {
  const rounds = [...new Set((decisionLog ?? []).map((e) => e.round))].sort((a, b) => a - b);
  let state = initialState;
  const reports = [];

  for (const round of rounds) {
    if (state.round !== round) {
      throw new Error(
        `replay desynchronised: state is at round ${state.round}, log expects ${round}`,
      );
    }
    const result = runRound(state, {
      ...options,
      decisions: decisionsForRound(decisionLog, round),
    });
    reports.push(result.report);
    state = result.nextGameState;
  }

  return { finalState: state, reports };
}

/**
 * Round-trip a state through JSON.
 *
 * Used by tests to prove the state holds no Maps, Sets, functions or
 * undefined values that would not survive a save. Anything that fails this
 * would work perfectly in memory and be silently lost on reload.
 *
 * @param {object} gameState
 * @returns {object}
 */
export function roundTrip(gameState) {
  return deserialise(serialise(gameState));
}
