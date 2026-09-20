/**
 * Read a playtest file back as the baseline table (stage B, reviews/slc-review.md).
 *
 *     node scripts/read-playtest.js playtest-2026-09-14-0905.json [more.json …]
 *
 * WHY A PROGRAM. These files are the "before" that stage C's rebuild is
 * measured against, so the same file has to give the same table every time,
 * whoever reads it. A session summarising a JSON file by eye is how a
 * measurement quietly becomes an opinion.
 *
 * THE GROUPS are those of the one recorded human game (HANDOVER, "What playing
 * it as a learner found"): round 0, weeks 1-4, weeks 5-11, the end screen. It is
 * the only baseline there is, so a stranger's numbers are laid out to line up
 * with it. Stage C's gate is written in the same terms: round 0 under ten
 * minutes, and more than 72 seconds on the back half.
 *
 * THE OUTCOME IS REPLAYED, NOT REMEMBERED. The file carries the player's save,
 * and it goes back through `restoreSave` — `game.js`'s `replayLog`, the replay
 * that reproduces a PLAYED game — so rank and profit come from the game
 * itself. If the site has been redeployed since they played, the replay says
 * so (`exact: false`) and the figures are this version's, not theirs: check
 * out the tag they played on and read it again.
 *
 * Never published: `scripts/build-site.js` copies only what `ui/index.html`
 * imports.
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { summarise } from '../ui/recorder.js';
import { readSave, restoreSave, SAVE_KEY } from '../ui/save.js';
import { finalStandings, gameTotals } from '../ui/ending.js';
import { rupees } from '../ui/dom.js';

/** @type {Array<[string, (name: string) => boolean]>} */
const GROUPS = [
  // The minute before round 0 (2026-09-19). ITS OWN ROW, ABOVE ROUND 0's:
  // counted inside round 0, the run's minutes would be absorbed by the very
  // ten-minute gate it was added to protect, and nobody could tell whether it
  // had worked.
  ['first run', (name) => name === 'first run'],
  ['round 0', (name) => name.startsWith('round 0')],
  ['weeks 1-4', (name) => /^week [1-4]$/.test(name)],
  ['weeks 5-11', (name) => /^week (5|6|7|8|9|10|11)$/.test(name)],
  ['end screen', (name) => name === 'end screen'],
  // Before a game opens (the switch-over, part 1): the offer, the replay, a
  // game the simulator changed under, and one it could not open at all.
  ['front door', (name) => ['resume offer', 'restoring', 'replay changed', 'restore failed'].includes(name)],
  ['other', () => true],
];

/**
 * The phases, totalled into the groups the human game was reported in.
 * Empty groups are left out.
 *
 * @param {object} file - a parsed playtest file
 * @returns {object[]} `{name, activeSeconds, hiddenSeconds, idleSeconds, clicks, keys}`
 */
export function phaseGroups(file) {
  const totals = new Map();
  for (const phase of summarise(file.recording)) {
    // Every phase name matches one group; the last entry is the catch-all.
    const [group] = GROUPS.find(([, belongs]) => belongs(phase.name)) ?? [];
    const row = totals.get(group)
      ?? { name: group, activeSeconds: 0, hiddenSeconds: 0, idleSeconds: 0, clicks: 0, keys: 0 };
    row.activeSeconds += phase.activeSeconds;
    row.hiddenSeconds += phase.hiddenSeconds;
    row.idleSeconds += phase.idleSeconds;
    row.clicks += phase.clicks;
    row.keys += phase.keys;
    totals.set(group, row);
  }
  return GROUPS.map(([name]) => totals.get(name)).filter(Boolean);
}

/**
 * Seconds each card was on screen, over the whole game, most read first.
 *
 * @param {object} file
 * @returns {Array<[string, number]>}
 */
export function cardTotals(file) {
  const totals = new Map();
  for (const phase of summarise(file.recording)) {
    for (const [card, seconds] of Object.entries(phase.cards)) {
      totals.set(card, (totals.get(card) ?? 0) + seconds);
    }
  }
  return [...totals].sort((a, b) => b[1] - a[1]);
}

/**
 * How long a week took to compute in the player's browser.
 *
 * @param {object} file
 * @returns {{weeks: number, fastestMs: number, medianMs: number, slowestMs: number}|null}
 */
export function computeTimes(file) {
  const times = file.recording.weeks.map((w) => w.computeMs).sort((a, b) => a - b);
  if (times.length === 0) return null;
  const middle = times.length / 2;
  const median = times.length % 2 ? times[Math.floor(middle)] : (times[middle - 1] + times[middle]) / 2;
  return { weeks: times.length, fastestMs: times[0], medianMs: Math.round(median), slowestMs: times.at(-1) };
}

/**
 * How the game came out, replayed from the save the file carries.
 *
 * @param {object} file
 * @returns {Promise<object|null>} null when the player never got past round 0
 */
export async function outcome(file) {
  if (!file.save) return null;
  // Only `getItem` is reached; `readSave` asks for nothing else.
  const storage = /** @type {Storage} */ (/** @type {unknown} */ (
    { getItem: (key) => (key === SAVE_KEY ? JSON.stringify(file.save) : null) }));
  const saved = readSave(storage);
  if (!saved) return { unreadable: true };

  const { state, exact } = await restoreSave(saved, { mode: 'expected' });
  const standings = finalStandings(state);
  const me = standings.find((row) => row.id === saved.playerId);
  return {
    weeksPlayed: saved.weeksPlayed,
    exact,
    rank: me.rank,
    of: standings.length,
    grossRank: me.grossRank,
    costPaise: me.costPaise,
    netProfitPaise: me.netProfitPaise,
    // What the books rank on since I39: settled net profit, less what they
    // built with. Printing the rank beside net profit alone said one number
    // and ranked on another.
    capitalPaise: me.capitalPaise,
    businessProfitPaise: me.businessProfitPaise,
    weeksInTheRed: weeksInTheRed(state.history, saved.playerId),
    decisions: decisionWeeks(saved.decisionLog, saved.playerId),
  };
}

/**
 * The weeks that lost money after returns, as the end screen's own totals
 * count them. Read from `history`, so a week is judged as it now stands rather
 * than as it was first reported.
 *
 * @param {object[]} history
 * @param {string} playerId
 * @returns {number[]} rounds
 */
export function weeksInTheRed(history, playerId) {
  return gameTotals(history, playerId).weeks
    .filter((week) => week.netProfitPaise < 0)
    .map((week) => week.round);
}

/**
 * The weeks the player decided something, read from the save's log.
 *
 * Stage D's gate is that weeks 7-12 carry decisions (reviews/slc-review.md,
 * section 12), and the one recorded human game decided nothing after week 4.
 * The form sends the week-5 capital card whether or not it was touched
 * (`toDecision` in ui/decisions.js), so a week whose only decision is that card
 * with every amount zero is marked as left alone, not counted as a choice.
 *
 * @param {object[]} decisionLog
 * @param {string} playerId
 * @returns {{round: number, leftAlone: boolean}[]} in round order
 */
export function decisionWeeks(decisionLog, playerId) {
  return (decisionLog ?? [])
    .filter((entry) => entry.advertiserId === playerId)
    .sort((a, b) => a.round - b.round)
    .map((entry) => ({ round: entry.round, leftAlone: capitalLeftAlone(entry.decision) }));
}

function capitalLeftAlone(decision) {
  const keys = Object.keys(decision ?? {});
  return keys.length === 1 && keys[0] === 'capex'
    && Object.values(decision.capex ?? {}).every((paise) => paise === 0);
}

/** `rupees` prints a loss as "₹-1,56,785"; this reads it as a loss. */
const money = (paise) => (paise < 0 ? `−${rupees(-paise)}` : rupees(paise));
const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const pad = (text, width) => String(text).padEnd(width);
const num = (text, width) => String(text).padStart(width);

/**
 * The whole file as text, for a person to read.
 *
 * @param {object} file
 * @returns {Promise<string>}
 */
export async function report(file) {
  const lines = [];
  const began = new Date(file.recording.startedAt).toISOString().slice(0, 16).replace('T', ' ');
  const env = file.environment ?? {};
  lines.push(`Playtest recording, begun ${began} UTC`);
  if (env.viewport) {
    lines.push(`Device: ${env.viewport.join(' × ')} window`
      + `${env.screen ? `, ${env.screen.join(' × ')} screen` : ''}`);
  }
  if (env.userAgent) lines.push(`Browser: ${env.userAgent}`);
  lines.push(`Page loads: ${file.recording.loads.length}`);
  // Only when it changed mid-game: otherwise the version is the tag you read it
  // on, and a line saying so on every file would be noise.
  const versions = file.versions ?? file.recording.versions ?? [];
  if (versions.length > 1) {
    lines.push(`Versions: ${versions.map((v) => `${v.version} from `
      + `${new Date(v.at).toISOString().slice(11, 16)} UTC`).join(', ')}`);
  }

  lines.push('', 'Time on each part (active = hidden and idle time taken off)');
  lines.push(`  ${pad('', 12)}${num('active', 8)}${num('hidden', 8)}${num('idle', 8)}${num('clicks', 8)}${num('keys', 7)}`);
  let total = 0;
  for (const g of phaseGroups(file)) {
    total += g.activeSeconds;
    lines.push(`  ${pad(g.name, 12)}${num(clock(g.activeSeconds), 8)}${num(clock(g.hiddenSeconds), 8)}`
      + `${num(clock(g.idleSeconds), 8)}${num(g.clicks, 8)}${num(g.keys, 7)}`);
  }
  lines.push(`  ${pad('total', 12)}${num(clock(total), 8)}`);

  lines.push('', 'Every screen, in order');
  for (const p of summarise(file.recording)) {
    lines.push(`  ${pad(p.name, 16)}${num(clock(p.activeSeconds), 8)}  ${p.clicks} clicks, ${p.keys} keys`);
  }

  lines.push('', 'Cards by time on screen');
  for (const [card, seconds] of cardTotals(file)) lines.push(`  ${num(clock(seconds), 6)}  ${card}`);

  const speed = computeTimes(file);
  if (speed) {
    lines.push('', `Weeks computed: ${speed.weeks}, fastest ${speed.fastestMs}ms, `
      + `median ${speed.medianMs}ms, slowest ${speed.slowestMs}ms`);
  }

  lines.push('', 'How it came out');
  const result = await outcome(file);
  if (!result) {
    lines.push('  No saved game: they stopped before week 1 finished.');
  } else if (result.unreadable) {
    lines.push('  The saved game could not be read by this version of the code.');
  } else {
    lines.push(`  ${result.weeksPlayed} of 12 weeks played`);
    lines.push(`  rank ${result.rank} of ${result.of} on what the business made (gross rank ${result.grossRank})`);
    lines.push(`  made ${money(result.businessProfitPaise)}: contribution ${money(result.netProfitPaise)} `
      + `less ${money(result.capitalPaise)} built with, on ${money(result.costPaise)} of spend`);
    lines.push(`  weeks in the red: ${result.weeksInTheRed.length ? result.weeksInTheRed.join(', ') : 'none'}`);
    const chose = result.decisions.filter((d) => !d.leftAlone);
    lines.push(`  weeks with a decision: ${result.decisions.length
      ? result.decisions.map((d) => (d.leftAlone ? `${d.round} (capital left alone)` : String(d.round))).join(', ')
      : 'none'}`);
    const lateWeeks = Math.max(0, Math.min(result.weeksPlayed, 12) - 6);
    lines.push(`  weeks 7-12 with a decision: ${chose.filter((d) => d.round >= 7).length} of ${lateWeeks} played`);
    lines.push(result.exact
      ? '  the replay matches what they saw'
      : '  THE REPLAY DOES NOT MATCH what they saw: read it again on the tag they played');
  }

  lines.push('', 'What they said');
  const answers = file.answers ?? {};
  lines.push(`  Taught: ${answers.lessons?.trim() || '(nothing written)'}`);
  lines.push(`  Confused or annoyed: ${answers.confusing?.trim() || '(nothing written)'}`);
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const path of process.argv.slice(2)) {
    console.log(`\n=== ${path}\n`);
    console.log(await report(JSON.parse(readFileSync(path, 'utf8'))));
  }
}
