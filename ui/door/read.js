/**
 * What the Studio's front door says about a saved game (design/switch-over/,
 * A, the owner's choice of 2026-09-16), worked out without a page.
 */

import { TOTAL_ROUNDS } from '../../engine/constants.js';
import { fingerprintOf } from '../save.js';

/**
 * @param {object} saved - from `readSave`
 * @returns {{name: string, position: string, played: number, total: number, finished: boolean}}
 */
export function doorFacts(saved) {
  const me = saved.initialState.advertisers.find((a) => a.id === saved.playerId);
  return {
    name: me.name,
    position: `${me.position.price} · ${me.position.purpose}`,
    played: saved.weeksPlayed,
    total: TOTAL_ROUNDS,
    finished: saved.weeksPlayed >= TOTAL_ROUNDS,
  };
}

/**
 * The weeks a changed replay changed: each week's spend and clicks as the save
 * kept them, against the replay's own first reports.
 *
 * Only weeks that differ in whole rupees or whole clicks. The save compares
 * clicks exactly and they are fractional, so a replay can differ where no
 * figure on screen would, and a table of identical rows under "this game has
 * changed" would read as a mistake.
 *
 * @param {Array<[number, number]>} fingerprint - the save's, paise and clicks a week
 * @param {object[]} reports - the replay's
 * @param {string} playerId
 * @param {number} [limit] - weeks listed; the rest are counted
 * @returns {{rows: Array<{week: number, thenPaise: number, thenClicks: number, nowPaise: number,
 *   nowClicks: number}>, more: number}}
 */
export function changedWeeks(fingerprint, reports, playerId, limit = 3) {
  const now = fingerprintOf(reports, playerId);
  const shown = (paise, clicks) => [Math.round(paise / 100), Math.round(clicks)];
  const rows = [];
  fingerprint.forEach(([thenPaise, thenClicks], i) => {
    const [nowPaise, nowClicks] = now[i] ?? [0, 0];
    const [then, later] = [shown(thenPaise, thenClicks), shown(nowPaise, nowClicks)];
    if (then[0] === later[0] && then[1] === later[1]) return;
    rows.push({ week: i + 1, thenPaise, thenClicks: then[1], nowPaise, nowClicks: later[1] });
  });
  return { rows: rows.slice(0, limit), more: Math.max(0, rows.length - limit) };
}
