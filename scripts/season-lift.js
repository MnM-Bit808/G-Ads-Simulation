/**
 * January's lift per search, read from Google Trends exports
 * (plans/2026-09-13-january-surge.md, section 6; DECISIONS F16).
 *
 * THE METHOD WAS FIXED BEFORE THE NUMBERS WERE READ. For each year, each
 * January game week's index is divided by the mean of that year's game weeks
 * 1-8 (6 November to 31 December); the median over years is the term's lift;
 * a group's lift is the mean of its terms'. Only a term is ever compared with
 * itself, so Trends scaling each file to its own 100 changes nothing.
 *
 * A Trends week starts on a Sunday. It belongs to the game week that holds its
 * midpoint, so every game week gets exactly one Trends week. A year counts only
 * if all eight baseline weeks and all four January weeks have a row.
 *
 * usage: node scripts/season-lift.js [dir]    (default sources/trends)
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { WEEK_ONE } from '../ui/season/read.js';

const DAY = 86400000;

/**
 * One row per week of a Trends CSV. `"<1"` is Trends' way of saying "above
 * zero, below one", so it reads as a half.
 *
 * @param {string} text the file
 * @returns {{start: string, value: number}[]}
 */
export function parseTrends(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^(\d{4}-\d{2}-\d{2}),\s*"?(<1|\d+)"?\s*$/);
    if (m) rows.push({ start: m[1], value: m[2] === '<1' ? 0.5 : Number(m[2]) });
  }
  return rows;
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Weeks 9-12 of the game over weeks 1-8, per year, median over years.
 *
 * @param {{start: string, value: number}[]} rows from `parseTrends`
 * @param {{month: number, day: number}} weekOne the day game week 1 starts
 * @returns {{years: number[], lifts: number[]}} `lifts` is [week 9, 10, 11, 12]
 */
export function januaryLifts(rows, weekOne) {
  const mids = rows.map((r) => ({ mid: Date.parse(`${r.start}T00:00:00Z`) + 3 * DAY, value: r.value }));
  const years = [...new Set(rows.map((r) => Number(r.start.slice(0, 4))))].sort((a, b) => a - b);
  const counted = [];
  const perYear = [];
  for (const year of years) {
    const start = (week) => Date.UTC(year, weekOne.month - 1, weekOne.day) + (week - 1) * 7 * DAY;
    const inWeek = (week) => mids.find((r) => r.mid >= start(week) && r.mid < start(week) + 7 * DAY);
    const base = [1, 2, 3, 4, 5, 6, 7, 8].map(inWeek);
    const january = [9, 10, 11, 12].map(inWeek);
    if (base.some((r) => !r) || january.some((r) => !r)) continue;
    const mean = base.reduce((a, r) => a + r.value, 0) / base.length;
    if (mean === 0) continue;
    counted.push(year);
    perYear.push(january.map((r) => r.value / mean));
  }
  return {
    years: counted,
    lifts: [0, 1, 2, 3].map((k) => (perYear.length ? median(perYear.map((p) => p[k])) : NaN)),
  };
}

/**
 * Every `<group>--<term>.csv` in a folder, read and grouped.
 *
 * @param {string} dir
 * @param {{month: number, day: number}} [weekOne]
 * @returns {Object<string, {terms: Object<string, {years: number[], lifts: number[]}>, mean: number[]}>}
 */
export function groupLifts(dir, weekOne = WEEK_ONE) {
  const groups = {};
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.csv')).sort()) {
    const [group, term] = file.replace(/\.csv$/, '').split('--');
    const out = januaryLifts(parseTrends(readFileSync(join(dir, file), 'utf8')), weekOne);
    (groups[group] ??= { terms: {} }).terms[term] = out;
  }
  for (const g of Object.values(groups)) {
    const read = Object.values(g.terms).filter((t) => t.years.length > 0);
    g.mean = [0, 1, 2, 3].map((k) => read.reduce((a, t) => a + t.lifts[k], 0) / read.length);
  }
  return groups;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const groups = groupLifts(process.argv[2] ?? 'sources/trends');
  const f = (xs) => xs.map((x) => x.toFixed(2)).join('  ');
  for (const [name, g] of Object.entries(groups)) {
    console.log(`\n${name.padEnd(26)} wk9   wk10  wk11  wk12`);
    for (const [term, t] of Object.entries(g.terms)) {
      console.log(`  ${term.padEnd(24)} ${f(t.lifts)}   (${t.years.length} Januaries: ${t.years.join(', ')})`);
    }
    console.log(`  ${'MEAN'.padEnd(24)} ${f(g.mean)}`);
  }
}
