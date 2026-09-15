/**
 * Save and resume, in the player's own browser (stage A4, reviews/slc-review.md).
 *
 * WHY IT EXISTS. The game lived only in memory, so a reload lost it — up to
 * forty-five minutes of play — with no warning and no error. HANDOVER told
 * playtesters to be careful, which is a message, not a fix.
 *
 * WHAT IS STORED IS THE START AND THE LOG, NEVER THE STATE. The engine is pure
 * and seeded, so the state before week 1 plus every decision since rebuilds the
 * rest exactly. Measured on a twelve-week game: 79 KB of start and 184 KB of
 * log, against 4.5 MB of final state — most of what a browser lets a site keep.
 *
 * WHY A FINGERPRINT. The site redeploys on every push. A save written before a
 * deploy and replayed after it runs the same decisions through a changed engine,
 * and would hand back a game quietly different from the one that was played. So
 * the player's cost and clicks for every week travel with the save, and a
 * replay that no longer matches them says so rather than pretending.
 *
 * Nothing here touches `window`: storage is passed in, so the whole module is
 * tested without a browser, and a browser that refuses storage (private mode, a
 * full quota) yields a failed save and an empty load rather than an exception.
 */

import { serialise, deserialise } from '../engine/serialise.js';
import { replayRound } from '../game.js';
import { SCHEMA_VERSION, TOTAL_ROUNDS } from '../engine/constants.js';

/** The one key this site stores under. */
export const SAVE_KEY = 'g-ads-simulation:save';

/** The shape of a save, versioned separately from the engine's schema. */
export const SAVE_FORMAT = 1;

/**
 * What the player saw each week: their own cost and clicks.
 *
 * @param {object[]} reports - one per week played, in order
 * @param {string} playerId
 * @returns {Array<[number, number]>} [costPaise, clicks] per week
 */
export function fingerprintOf(reports, playerId) {
  return reports.map((report) => {
    const traffic = report.byAdvertiser?.[playerId]?.traffic;
    return [traffic?.costPaise ?? 0, traffic?.clicks ?? 0];
  });
}

/**
 * Build a save from a game in progress.
 *
 * @param {object} game
 * @param {object} game.initial - the state before week 1
 * @param {object[]} game.decisionLog - the log as it stands
 * @param {string} game.playerId
 * @param {number} game.weeksPlayed
 * @param {Array<[number, number]>} game.fingerprint - from `fingerprintOf`
 * @returns {object} a plain object, ready for JSON
 */
export function makeSave({ initial, decisionLog, playerId, weeksPlayed, fingerprint }) {
  return {
    format: SAVE_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    playerId,
    weeksPlayed,
    fingerprint,
    // Through the engine's own strict writer, so a state it would refuse to
    // save never reaches storage.
    initial: serialise(initial),
    decisionLog,
  };
}

/**
 * Store a save.
 *
 * @param {Storage|null} storage - `window.localStorage`, or anything shaped like it
 * @param {object} save - from `makeSave`
 * @returns {boolean} whether it was stored
 */
export function writeSave(storage, save) {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

/**
 * Read a save back, refusing anything this build cannot restore correctly.
 *
 * Strict for the same reason `deserialise` is: a save that loads wrongly keeps
 * running and teaches something false. Anything unexpected reads as no save.
 *
 * @param {Storage|null} storage
 * @returns {object|null} the save plus `initialState`, or null
 */
export function readSave(storage) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (save?.format !== SAVE_FORMAT || save.schemaVersion !== SCHEMA_VERSION) return null;
    if (typeof save.playerId !== 'string' || !Array.isArray(save.decisionLog)) return null;
    const weeks = save.weeksPlayed;
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > TOTAL_ROUNDS) return null;
    if (!Array.isArray(save.fingerprint) || save.fingerprint.length !== weeks) return null;

    const initialState = deserialise(save.initial);
    if (!initialState.advertisers.some((a) => a.id === save.playerId)) return null;
    return { ...save, initialState };
  } catch {
    return null;
  }
}

/**
 * Forget the saved game.
 *
 * @param {Storage|null} storage
 */
export function clearSave(storage) {
  try {
    storage?.removeItem(SAVE_KEY);
  } catch {
    // A browser that will not let us remove it will not let us read it either.
  }
}

/**
 * Rebuild the game a save describes, one week at a time.
 *
 * Yields between weeks so the page can say how far it has got: a late-game
 * restore replays up to twelve weeks, and a frozen page reads as a crash.
 *
 * Keeps the history as it stood before the last week ran, because running a
 * week rewrites the earlier ones and the state keeps only the new version:
 * Your week's dashed tick is where each week stood before (ui/app.js keeps
 * the same thing when a week is run live).
 *
 * @param {object} save - from `readSave`
 * @param {object} [options] `onWeek(week, of)` is called after each week; the
 *   rest is passed through to the round (`mode` included)
 * @returns {Promise<{state: object, reports: object[], insights: object[], exact: boolean,
 *   historyBefore: object[]}>} `exact` is false when the replay no longer matches
 *   what the player saw
 */
export async function restoreSave(save, options = {}) {
  const { onWeek, ...runOptions } = options;
  let state = save.initialState;
  let historyBefore = [];
  const reports = [];
  const insights = [];
  for (let week = 1; week <= save.weeksPlayed; week++) {
    historyBefore = state.history ?? [];
    const out = replayRound(state, save.decisionLog, runOptions);
    reports.push(out.report);
    insights.push(out.insights);
    state = out.nextGameState;
    onWeek?.(week, save.weeksPlayed);
    await new Promise((resolve) => { setTimeout(resolve, 0); });
  }
  const exact = JSON.stringify(fingerprintOf(reports, save.playerId))
    === JSON.stringify(save.fingerprint);
  return { state, reports, insights, exact, historyBefore };
}
