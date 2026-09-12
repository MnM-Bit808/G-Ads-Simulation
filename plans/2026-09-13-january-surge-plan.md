# The January surge: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans
> (inline, the owner's choice for this project) task by task. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** training searches rise in weeks 9–11, the first weeks of January, by
amounts measured from Google Trends; the player and the rivals see it coming and
can plan for it, so the back half of the game carries decisions.

**Architecture:** a hand-assigned `seasonProfile` on every search and a
`SEASON_PROFILES` curve in `engine/constants.js`; `seasonFactor(query, round)` in
`engine/querySet.js`, multiplied in at the one place volume enters an auction
(`engine/round.js`); both published in the public view, as Keyword Planner
publishes seasonality; two rival characters with a January rule; a calendar,
a January card, a guide chapter and a seventh debrief lesson on screen.

**Tech stack:** ES modules, no bundler; Vitest; ESLint.

**Spec:** `plans/2026-09-13-january-surge.md`. Read it first; this plan argues
from it.

## Global constraints

- Work on the branch `january-surge`. Commit after each green `npm test`,
  checking its exit code before committing; push only when the owner says.
- CLAUDE.md applies, hard rules included: the engine stays pure (the lift
  depends on the round number and nothing else); controllers get views, never
  state; every unsourced number goes in `constants.js` with a provenance tag and
  a DECISIONS entry, except a rival's opinions, which stay in
  `agents/policies.js` (C7), and display numbers, which stay in `ui/` (I6).
- Profile names are exactly `'resolution'` and `'steady'`.
- `SEASON_PROFILES.<name>.length === TOTAL_ROUNDS`, and every profile is exactly
  `1` in weeks 1–8. Weeks 1–8 of every game are today's market, to the paise.
- The calendar: week 1 starts 6 November, so week 9 starts 1 January. No year.
- Rival January rules act only from the first round of the month that contains
  the first lifted week (round 9) onward.
- **Two stops for the owner** (section 6 of the design): Task 2's reading of the
  Trends files, and Task 8's balance gates. If a gate fails, stop and report;
  do not tune past it.
- New wording follows the content model (`ui/words/line.js`): kinds, a `why` on
  every disclosure, no digits typed into a words string.
- Edit files with the Edit tool, never shell heredocs.

## File map

| file | task | job |
|---|---|---|
| `sources/trends/README.md`, `sources/trends/*.csv` | 1 | the owner's exports, and what they are |
| `scripts/season-lift.js`, `tests/seasonLift.test.js` | 2 | January's lift per term and per group |
| `DECISIONS.md` (F16) | 2, 7, 8 | the curve's source, the rivals' rules, the measurement |
| `ENGINE_SPEC_v0.3.md` | 3 | section 7.6, the section-20 line, the changelog |
| `content/querySet.js`, `engine/constants.js`, `engine/querySet.js` | 4 | the field, the curve, validation, schema version |
| `tests/querySetContent.test.js`, `tests/querySet.test.js`, `tests/fixtures/querySet.js` | 4, 5 | their tests |
| `engine/querySet.js` (`seasonFactor`), `engine/round.js` | 5 | the lift in the auction |
| `engine/insights.js`, `tests/insights.test.js` | 6 | the public view |
| `agents/policies.js`, `tests/policies.test.js` | 7 | `disciplined` and `spender` in January |
| scratchpad harness | 8 | calibration figures and the balance measurement |
| `ui/season/read.js`, `ui/season/render.js`, `ui/words/season.js`, `ui/index.html`, `ui/dashboard.js`, `ui/app.js`, `ui/round-zero.js`, `ui/decisions.js`, `ui/style.css`, `tests/season.test.js`, `tests/words.test.js`, `tests/ui.test.js` | 9 | the calendar, the January card, the planner mark |
| `ui/guide/chapters.js`, `ui/debrief/read.js`, `ui/debrief/render.js`, `ui/words/debrief.js`, `tests/guide.test.js`, `tests/debrief.test.js` | 10 | the chapter and the seventh lesson |
| `HANDOVER.md`, `CLAUDE.md`, `wrangler.jsonc` | 11 | docs and the published file count |

---

### Task 1: the Google Trends exports (the owner)

**Files:** create `sources/trends/README.md`; the owner adds the CSVs.

**Why one term per file:** Trends scales every file so its highest point is 100.
The method below only ever divides a term by itself, so files never need to be
compared, and a term alone in its file gets the whole 0–100 range rather than a
few coarse integers beside a bigger term.

- [ ] **Step 1: Write `sources/trends/README.md`** with the instructions and the
  list below, so the folder explains itself.

  > For each term: open https://trends.google.com/trends/explore, type the term,
  > set **India**, **Past 5 years**, **All categories**, **Web Search**. On the
  > *Interest over time* chart, use the download arrow (CSV). Save it here as
  > `<group>--<term with dashes>.csv`.

  | group | terms (one file each) |
  |---|---|
  | `training` | gym leggings · sports bra · gym wear · gym clothes · workout clothes |
  | `lifestyle` | co ord set · loungewear · joggers · athleisure · lounge pants |
  | `junk` | gym near me · workout plan · how to lose belly fat · gym membership |

  Fourteen files, e.g. `training--gym-leggings.csv`. The training terms are the
  buying side of a resolution; the lifestyle terms are the control, and must not
  rise; the junk terms are the searches broad match wanders into.

- [ ] **Step 2: Ask the owner to export the fourteen files** and tell you when
  they are in the folder. Nothing in Tasks 2–11 has its numbers until then.

- [ ] **Step 3: Check the files.** Each must have a weekly date column and one
  value column, and cover at least five Novembers-to-Januaries. Report any that
  do not, by name, and ask for a re-export.

- [ ] **Step 4: Commit** the README and the files:
  `git add sources/trends && git commit` — "Add the Google Trends exports the
  January surge is sized from".

### Task 2: read January's lift from the files

**Files:** create `scripts/season-lift.js`, `tests/seasonLift.test.js`; add
DECISIONS F16 (its first half).

**Interfaces produced:**
- `parseTrends(text)` → `[{ start: 'YYYY-MM-DD', value: number }]`, one row per
  week; `"<1"` reads as `0.5`; header and blank lines ignored.
- `januaryLifts(rows, weekOne)` → `{ years: number[], lifts: [w9, w10, w11, w12] }`,
  each lift the median over complete years of (that game week's value ÷ the mean
  of game weeks 1–8 of the same year). `weekOne` is `{ month: 11, day: 6 }`.
- `groupLifts(dir, weekOne)` → `{ [group]: { terms: {[term]: lifts}, mean: lifts } }`.

**The mapping, fixed before any file is read:** game week *g* of year *Y*
starts on 6 November *Y* plus 7(*g*−1) days, so weeks 9–12 fall in January
*Y*+1. A Trends week (starting on a Sunday) belongs to game week *g* when its
midpoint, start + 3 days, falls inside that game week. A year counts only if
all eight baseline weeks and all four January weeks have a row.

- [ ] **Step 1: Write the failing tests** in `tests/seasonLift.test.js`:

```js
import { describe, test, expect } from 'vitest';
import { parseTrends, januaryLifts } from '../scripts/season-lift.js';

const WEEK_ONE = { month: 11, day: 6 };
const DAY = 86400000;

/** Weekly Sunday rows from `from`, valued by which game week they sit in. */
function synthetic(fromIso, weeks, valueFor) {
  const rows = [];
  for (let i = 0; i < weeks; i++) {
    const t = Date.parse(`${fromIso}T00:00:00Z`) + i * 7 * DAY;
    rows.push({ start: new Date(t).toISOString().slice(0, 10), value: valueFor(t + 3 * DAY) });
  }
  return rows;
}

describe('reading a Trends export (plans/2026-09-13-january-surge.md, section 6)', () => {
  test('parses the weekly rows and nothing else', () => {
    const text = 'Category: All categories\n\nWeek,gym leggings: (India)\n2021-09-19,45\n2021-09-26,<1\n';
    expect(parseTrends(text)).toEqual([
      { start: '2021-09-19', value: 45 },
      { start: '2021-09-26', value: 0.5 },
    ]);
  });

  test('January over November-December, per game week, median over years', () => {
    // 50 in the baseline weeks, then 75, 70, 60 and 55 in weeks 9-12, every year.
    const lifted = [75, 70, 60, 55];
    const valueFor = (mid) => {
      const d = new Date(mid);
      const y = d.getUTCMonth() === 0 ? d.getUTCFullYear() - 1 : d.getUTCFullYear();
      const start = Date.UTC(y, 10, 6);
      const week = Math.floor((mid - start) / (7 * DAY)) + 1;
      if (week >= 1 && week <= 8) return 50;
      if (week >= 9 && week <= 12) return lifted[week - 9];
      return 10;
    };
    const rows = synthetic('2020-01-05', 52 * 3, valueFor);
    const out = januaryLifts(rows, WEEK_ONE);
    expect(out.years).toEqual([2020, 2021]);
    expect(out.lifts.map((x) => Number(x.toFixed(2)))).toEqual([1.5, 1.4, 1.2, 1.1]);
  });

  test('a year with a missing week is left out rather than half-read', () => {
    const rows = synthetic('2020-10-04', 20, () => 50).filter((r) => r.start !== '2020-12-06');
    expect(januaryLifts(rows, WEEK_ONE).years).toEqual([]);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/seasonLift.test.js`. Expected: FAIL,
  the module does not exist.

- [ ] **Step 3: Write `scripts/season-lift.js`:**

```js
/**
 * January's lift per search, read from Google Trends exports
 * (plans/2026-09-13-january-surge.md, section 6; DECISIONS F16).
 *
 * THE METHOD IS FIXED BEFORE THE NUMBERS ARE READ. For each year, each January
 * game week's index is divided by the mean of that year's game weeks 1-8
 * (6 November to 31 December); the median over years is the term's lift; a
 * group's lift is the mean of its terms'. Only a term is ever compared with
 * itself, so Trends scaling each file to its own 100 changes nothing.
 *
 * usage: node scripts/season-lift.js [dir]    (default sources/trends)
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { WEEK_ONE } from '../ui/season/read.js';

const DAY = 86400000;

/** One row per week; "<1" is Trends' way of saying "above zero, below one". */
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

/** See the file header. `weekOne` is { month, day } of game week 1. */
export function januaryLifts(rows, weekOne) {
  const mids = rows.map((r) => ({ mid: Date.parse(`${r.start}T00:00:00Z`) + 3 * DAY, value: r.value }));
  const years = [...new Set(rows.map((r) => Number(r.start.slice(0, 4))))].sort();
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
  return { years: counted, lifts: [0, 1, 2, 3].map((k) => median(perYear.map((p) => p[k]))) };
}

/** Every `<group>--<term>.csv` in `dir`, read and grouped. */
export function groupLifts(dir, weekOne = WEEK_ONE) {
  const groups = {};
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.csv')).sort()) {
    const [group, term] = file.replace(/\.csv$/, '').split('--');
    const out = januaryLifts(parseTrends(readFileSync(join(dir, file), 'utf8')), weekOne);
    (groups[group] ??= { terms: {} }).terms[term] = out;
  }
  for (const g of Object.values(groups)) {
    const all = Object.values(g.terms).filter((t) => t.years.length > 0);
    g.mean = [0, 1, 2, 3].map((k) => all.reduce((a, t) => a + t.lifts[k], 0) / all.length);
  }
  return groups;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const groups = groupLifts(process.argv[2] ?? 'sources/trends');
  const f = (xs) => xs.map((x) => x.toFixed(2)).join('  ');
  for (const [name, g] of Object.entries(groups)) {
    console.log(`\n${name}          wk9   wk10  wk11  wk12`);
    for (const [term, t] of Object.entries(g.terms)) {
      console.log(`  ${term.padEnd(24)} ${f(t.lifts)}   (${t.years.length} Januaries)`);
    }
    console.log(`  ${'MEAN'.padEnd(24)} ${f(g.mean)}`);
  }
}
```

  `WEEK_ONE` comes from `ui/season/read.js` (Task 9) so the calendar the screen
  shows and the calendar the curve was measured on are one definition. Create
  that file now with only this export, and its JSDoc:

```js
/**
 * The game's calendar: week 1 starts on 6 November, so week 9 starts on
 * 1 January. No year, because New Year falls on 1 January every year.
 * A display number (DECISIONS I6), and the measurement in
 * scripts/season-lift.js reads the same one, so the dates on screen and the
 * dates the curve was measured on cannot drift apart.
 */
export const WEEK_ONE = Object.freeze({ month: 11, day: 6 });
```

  Add `'season/read.js': () => import('../ui/season/read.js'),` to `LOADABLE` in
  `tests/ui.test.js`.

- [ ] **Step 4: Run** the new tests and `npm test`. Expected: PASS.

- [ ] **Step 5: Run it on the owner's files:** `node scripts/season-lift.js`.
  Read every term, not only the means.

- [ ] **Step 6: The first stop.** Report the table to the owner and stop if
  either holds:
  - the **lifestyle** mean is **1.10 or more** in any of weeks 9–11 (lifestyle
    was decided as staying put; this would contradict it);
  - the **training** mean over weeks 9–11 is **below 1.00** (January is not a
    surge at all).
  Either way, record what the files said. The 1.10 is a gate the owner agreed
  to in the design, not a model constant.

- [ ] **Step 7: Write DECISIONS F16, first half**, directly after F15:
  `### F16. January's training searches rise, and the game shows when — ESTIMATED (<date>)`.
  It records: the question (design section 1); the fourteen files and where they
  are; the method (quote the script header); the per-term table; the curve that
  goes into `SEASON_PROFILES.resolution` weeks 9–12 = the **training** mean,
  rounded to two decimals; the junk terms' lift, stated beside it as a known
  under- or over-statement for junk traffic, since one `resolution` curve
  serves both; the lifestyle mean, showing `steady` is honest. Leave headings
  for *Rivals* (Task 7) and *Measured in play* (Task 8).

- [ ] **Step 8: Commit** — "Measure January's lift from the Trends exports (F16)".

### Task 3: amend the spec

**Files:** modify `ENGINE_SPEC_v0.3.md`.

- [ ] **Step 1: Add section 7.6 after 7.5**, titled *7.6 Seasonality: the
  January surge*. It states: every query carries `seasonProfile`
  (`resolution` | `steady`), assigned by hand from its words, "a search
  someone makes because they are starting to train"; `SEASON_PROFILES` holds
  one value per round per profile, exactly `1` in rounds 1–8; the volume a
  round's auctions carry is `searches(query, day, hour) × seasonFactor(query,
  round)`; `WEEKLY_VOLUME` is an ordinary week; `seasonProfile` and
  `SEASON_PROFILES` are public (Keyword Planner shows monthly volumes), and
  `hourProfile` stays withheld; nothing else moves (conversion, order value,
  returns, budgets); the calendar puts round 1 at 6 November and round 9 at
  1 January; source DECISIONS F16.
- [ ] **Step 2: In 7.2**, under the formula, add one sentence: the formula is an
  ordinary week, and 7.6 scales a round by the query's season factor.
- [ ] **Step 3: In section 20**, remove "seasonality," from the omissions and
  add after the list: "Seasonality is modelled once, as the January surge
  (7.6); the festive season and the winter sales are not."
- [ ] **Step 4: In section 21**, add to *New in v0.3* a bullet: "**The January
  surge** (7.6), added 2026-09 — training searches rise in rounds 9–11; the
  first calendar event, and the first thing the market does after round 5."
- [ ] **Step 5: Commit** (docs only; run `npm run lint`) — "Amend the spec for
  the January surge (7.6)".

### Task 4: the field, the curve and the schema

**Files:** modify `content/querySet.js`, `engine/constants.js`,
`engine/querySet.js`, `tests/fixtures/querySet.js`; tests in
`tests/querySetContent.test.js` and `tests/querySet.test.js`.

**Interfaces produced:**
- every query in `QUERY_SET.queries` has `seasonProfile: 'resolution' | 'steady'`;
- `SEASON_PROFILES` exported from `engine/constants.js`:
  `{ steady: number[12], resolution: number[12] }`, provenance `'ESTIMATED'`;
- `SEASON_PROFILE_NAMES` exported from `engine/querySet.js`
  (`Object.keys(SEASON_PROFILES)`);
- `SCHEMA_VERSION` becomes `'0.3.1'`.

**The hand review, decided here.** `resolution` goes on exactly these 69; all
other 82 are `steady` (the default). Six training-leaning commercial searches
stay `steady` because their words are about the garment, not about starting to
train, which is also the proof that this is not the affinity copied:

- value · performance, 18: cheap gym leggings · gym wear sale · budget gym wear
  women · sports bra combo pack · gym leggings under 999 · sports bra under 500 ·
  pack of 2 gym leggings · workout tshirt under 300 · gym leggings offer today ·
  best gym leggings under 1000 · running shorts under 400 · gym wear clearance
  sale · yoga pants under 600 · compression tights under 999 · gym tshirt combo
  women · buy gym leggings online low price · discount activewear india · cheap
  gym tights women *(steady: leggings under 499, leggings 2 pack women)*
- mid · performance, all 20
- premium · performance, 16: compression leggings · squat proof leggings · no
  camel toe gym leggings · four way stretch gym tights · tummy control gym
  leggings · moisture wicking gym tshirt · high rise compression tights · nylon
  spandex gym leggings · seamless sports bra high impact · best squat proof
  leggings india · sculpt gym leggings women · seamless workout co ord set ·
  anti chafe running tights · imported gym wear women · technical training
  tights · premium gym leggings india *(steady: seamless leggings, buttery soft
  leggings, second skin leggings, studio to street leggings)*
- informational, 5: what to wear to the gym · are gym leggings squat proof · how
  to choose sports bra size · how tight should compression leggings be · best
  fabric for gym wear
- irrelevant, all 10
- every lifestyle cell, every brand search: `steady`

- [ ] **Step 1: Write the failing tests.** In `tests/querySetContent.test.js`:

```js
describe('the season profile is a hand review (spec 7.6)', () => {
  const byText = new Map(QUERY_SET.queries.map((q) => [q.text, q]));
  const count = (pred) => QUERY_SET.queries.filter(pred).length;

  test('every search has one, and it is a known name', () => {
    for (const q of QUERY_SET.queries) expect(['resolution', 'steady'], q.text).toContain(q.seasonProfile);
  });

  test('the counts the review decided', () => {
    expect(count((q) => q.seasonProfile === 'resolution')).toBe(69);
    expect(count((q) => q.intent === 'irrelevant' && q.seasonProfile === 'resolution')).toBe(10);
    expect(count((q) => q.intent === 'informational' && q.seasonProfile === 'resolution')).toBe(5);
    expect(count((q) => q.intent === 'brand' && q.seasonProfile === 'resolution')).toBe(0);
  });

  test('named examples pin the reading of the words', () => {
    expect(byText.get('gym near me').seasonProfile).toBe('resolution');
    expect(byText.get('gym leggings').seasonProfile).toBe('resolution');
    expect(byText.get('co ord set sale').seasonProfile).toBe('steady');
    // Training-leaning by affinity, steady by its words: the review is not the
    // affinity copied, which would expose what 16.1 withholds.
    expect(byText.get('buttery soft leggings').seasonProfile).toBe('steady');
    expect(byText.get('leggings under 499').seasonProfile).toBe('steady');
  });

  test('no lifestyle search rises', () => {
    const lifestyle = QUERY_SET.queries.filter((q) => q.intent === 'commercial'
      && q.purposeAffinity.lifestyle > q.purposeAffinity.performance);
    expect(lifestyle.every((q) => q.seasonProfile === 'steady')).toBe(true);
  });
});
```

  In `tests/querySet.test.js`, beside the `hourProfile` validation test: a query
  with `seasonProfile: 'festive'` fails validation with `RULES.FIELD_SHAPE`; and
  `SEASON_PROFILES` has `TOTAL_ROUNDS` values per profile, every one exactly `1`
  in rounds 1–8, and `steady` exactly `1` everywhere.

- [ ] **Step 2: Run** the two files. Expected: FAIL.

- [ ] **Step 3: Implement.**
  - `engine/constants.js`, after `HOUR_PROFILES`: `SEASON_PROFILES`, with a JSDoc
    saying weeks 1–8 are 1 by definition (the baseline is the
    November–December mean, so every calibrated constant stands), weeks 9–12
    are Task 2's training mean, and see DECISIONS F16. Add
    `SEASON_PROFILES: 'ESTIMATED'` to the provenance ledger.
  - `SCHEMA_VERSION = '0.3.1'`, with a comment: a field on every query is a
    schema change; `ui/save.js` discards a save from another version rather than
    replaying it into a different January.
  - `engine/querySet.js`: import `SEASON_PROFILES`; export
    `SEASON_PROFILE_NAMES`; in validation, beside the `hourProfile` check:
    `if (!SEASON_PROFILE_NAMES.includes(q.seasonProfile)) fail(RULES.FIELD_SHAPE, ...)`.
  - `content/querySet.js`: document `sp` in the header ("season profile:
    resolution or steady, read from the words, spec 7.6"); add
    `sp: 'resolution'` to the 69 entries above; in `push`,
    `seasonProfile: src.sp ?? 'steady',`.
  - `tests/fixtures/querySet.js`: give every hand-built query a
    `seasonProfile` (`'steady'` unless a test needs otherwise).
  - `grep -rn "'0\.3'" tests/` and update any test pinning the old version.

- [ ] **Step 4: Run** `npm test`. Expected: PASS. Every other suite must still
  pass, because nothing yet reads the field.

- [ ] **Step 5: Commit** — "Give every search a season profile, and the curve
  it follows (spec 7.6)".

### Task 5: the lift in the auction

**Files:** modify `engine/querySet.js`, `engine/round.js`; tests in
`tests/querySet.test.js` and `tests/round.test.js`.

**Interfaces produced:** `seasonFactor(query, round)` → a number; throws a
`RangeError` for an unknown profile or a round outside `1..TOTAL_ROUNDS`.

- [ ] **Step 1: Write the failing tests.**
  - `tests/querySet.test.js`: `seasonFactor` is `1` for every query in rounds
    1–8; `steady` queries are `1` in every round; a `resolution` query in round
    9 returns `SEASON_PROFILES.resolution[8]`; it throws on `'festive'` and on
    rounds `0` and `TOTAL_ROUNDS + 1`.
  - `tests/round.test.js`, **weeks 1–8 are today's market**: take a state at
    round 5 from `playRound` with the real rivals (as `tests/debrief.test.js`
    builds its game), run `runRound` on it twice, once as is and once with every
    query's `seasonProfile` set to `'steady'`; the two reports are deep-equal.
  - `tests/round.test.js`, **January is not**: the same at round 9; the
    player's impressions on `resolution` searches are higher as played than with
    every profile steady, and on `steady` searches the eligible auctions are
    identical. Give the describe `{ timeout: 60_000 }`, since it plays eight
    rounds.

- [ ] **Step 2: Run** them. Expected: FAIL, `seasonFactor` is not defined.

- [ ] **Step 3: Implement.** In `engine/querySet.js`, after `weeklySearches`:

```js
/**
 * How much busier this search is in this round than in an ordinary week
 * (spec 7.6, DECISIONS F16).
 *
 * Kept apart from `searches()`, which stays an ordinary week, so the
 * conservation that function's tests assert still holds and a season can never
 * be applied twice. It depends on the round number alone (R1).
 *
 * @param {object} query
 * @param {number} round 1..TOTAL_ROUNDS
 * @returns {number} 1 in an ordinary week
 */
export function seasonFactor(query, round) {
  const profile = SEASON_PROFILES[query.seasonProfile];
  if (!profile) {
    throw new RangeError(`unknown seasonProfile "${query.seasonProfile}" on query ${query.id ?? '(no id)'}`);
  }
  if (!Number.isInteger(round) || round < 1 || round > profile.length) {
    throw new RangeError(`round must be an integer 1..${profile.length}, got ${String(round)}`);
  }
  return profile[round - 1];
}
```

  In `engine/round.js`, import `seasonFactor`; before the day loop,
  `const season = queries.map((query) => seasonFactor(query, round));` with a
  one-line comment (hoisted, like `pacing`: it depends on the round only); and
  in the loop,
  `const hourVolume = (searches(querySet, query, day, hour) * season[q]) / auctionsPerHour;`.

- [ ] **Step 4: Run** `npm test`. Expected: PASS, except tests that pin a whole
  twelve-week game's figures, which may move because weeks 9–12 now differ.
  For each one that fails: read it, confirm the change is January's and only
  January's (weeks 1–8 identical), and update the pinned figure with a comment
  naming spec 7.6. Stop and ask if any failure is in weeks 1–8.

- [ ] **Step 5: Run** `npm run test:perf`. Expected: PASS within its budgets
  (the factor is hoisted, one multiplication per query-hour).

- [ ] **Step 6: Commit** — "Scale January's training searches in the auction
  (spec 7.6)".

### Task 6: the public view

**Files:** modify `engine/insights.js`; tests in `tests/insights.test.js`.

**Interfaces produced:** `getPublicView(...)` gains `querySet[i].seasonProfile`
and `seasonProfiles` (a copy of `SEASON_PROFILES`).

- [ ] **Step 1: Write the failing tests:** the public view's query rows carry
  `seasonProfile`; `view.seasonProfiles` deep-equals `SEASON_PROFILES` and is a
  copy (mutating it does not touch the constant); and the existing
  forbidden-fields test still passes, `hourProfile` included.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** In the view's `querySet` map add
  `seasonProfile: q.seasonProfile,` and after `weeklyVolume`:

```js
    // Keyword Planner shows every advertiser each keyword's monthly volumes, so
    // a known season is public knowledge (spec 7.6). The hour profile is not:
    // nothing real publishes when in the day a search converts.
    seasonProfiles: structuredClone(SEASON_PROFILES),
```

  Update the comment above `querySet` ("what people search, how often, and in
  which weeks more of them do").
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** — "Publish each search's season, as Keyword Planner
  does".

### Task 7: two rivals plan for January

**Files:** modify `agents/policies.js`; tests in `tests/policies.test.js`;
DECISIONS F16 *Rivals*.

**Interfaces produced (all in `agents/policies.js`, which still imports nothing
from `engine/`):**
- `januaryPlanRound(view, weeksPerMonth)` → the first round of the month holding
  the first round where any profile exceeds 1, or `null`;
- `forecastWeights(self, view, firstRound, weeksPerMonth)` → one weight per week
  of that month: the sum, over the advertiser's keywords, of the public volume
  share of the search with the keyword's text times that week's profile value
  (keywords whose text is no search count as steady, share 1);
- `splitBy(totalPaise, weights)` → integer paise per week, summing to
  `totalPaise` exactly (floor each, give the remainder to the largest weight).

Opinions, in `policies.js` under C7: `SPENDER_JANUARY_FRONT_LOAD = 0.55` (the
share of January's money it puts into the first week) and
`SPENDER_JANUARY_BID_LIFT = 1.25` (on searches it can see are rising, in the
lifted weeks). Both INVENTED, both a character's, and recorded in F16.

- [ ] **Step 1: Write the failing tests:**
  - **weeks 1–8 unchanged, for every policy**: for each id in `POLICIES`, a
    self view at round 5 and a report; the decision with the real view deep-
    equals the decision with a view whose `seasonProfiles` are all 1s and whose
    queries are all `steady`.
  - `splitBy(100001, [2, 1, 1, 0])` sums to 100001 and gives the largest share
    to the first week; `splitBy(x, [0, 0, 0, 0])` spreads evenly.
  - `disciplined` at round 9 sends `campaign.weeklySplitPaise` of
    `weeksPerMonth` entries summing exactly to `self.campaign.monthlyBudgetPaise`,
    heavier in week 9 than week 12 when its keywords are `resolution`
    searches; its bids equal what they would be without January.
  - `spender` at round 9 puts at least `SPENDER_JANUARY_FRONT_LOAD` of the month
    in week 9; at round 10 its bid on a `resolution` keyword is
    `SPENDER_JANUARY_BID_LIFT` times the bid on an identical `steady` one; at
    round 12 (profile back near 1) and round 8 the two are equal.
  - `cautious`, `automator`, `grossOptimiser`, `brandDefender` at round 9: no
    `weeklySplitPaise` in the decision.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the three helpers, then:
  - in `disciplined`, when `self.round === januaryPlanRound(view, n)` with
    `n = self.campaign.weeklySplitPaise.length`, add
    `weeklySplitPaise: splitBy(self.campaign.monthlyBudgetPaise, forecastWeights(self, view, self.round, n))`
    to `campaign`, with a comment: the competent plan moves money to where the
    searches will be and leaves bids alone, because more searches do not
    change what a click is worth;
  - `spender(self, report, view)`: at the plan round, a split of
    `[SPENDER_JANUARY_FRONT_LOAD, rest shared evenly]` through `splitBy`; in any
    round whose `resolution` value exceeds 1, keywords whose search is
    `resolution` bid `SPENDER_JANUARY_BID_LIFT` times its usual bid, clamped as
    today. Comment: it spends January in its first week and goes quiet before
    it ends, which is the lesson it carries.
  - Confirm, in a test, that at round 9 a self view's
    `campaign.monthlyBudgetPaise` is already month 3's and its split has
    `weeksPerMonth` entries; if not, stop and read `advanceCampaign` before
    going on.
- [ ] **Step 4: Run** `npm test`. Expected: PASS; update any twelve-week pinned
  figure only as in Task 5 Step 4.
- [ ] **Step 5: Write F16 *Rivals*:** who plans, how, the two constants and why
  they live in `policies.js` (C7), and that no rival repositions or buys capital
  for January.
- [ ] **Step 6: Commit** — "Let the disciplined rival and the spender plan for
  January".

### Task 8: calibration, and the balance measurement

**Files:** a throwaway harness in the scratchpad; DECISIONS F16 *Measured in
play*. No project code, unless a gate fails and the owner decides a change.

- [ ] **Step 1: Calibration.** Run `npx vitest run tests/calibration.test.js`,
  then print I1–I5's measured figures for round 1 (unchanged by construction)
  and for a round-9 state, with a scratch script that calls the same functions
  the test does. **Read the figures**, not the green tick (CLAUDE.md). Record
  both in F16.
- [ ] **Step 2: The harness.** Copy `worker.mjs`'s structure from D12
  (`startGame`, 72 markets: seeds 1–12 × six cells, F15's full-account player,
  rivals asserted live, `mode: 'expected'`, measured on
  `gameTotals(...).all.netProfitPaise`, rounds 1–8 played once and forked).
  Three branches per market:
  - **ignores January**: the player changes nothing;
  - **plans for January**: at round 5 adds, on phrase at 0.7 × realised
    break-even, the three highest-volume `resolution` searches of its cell it
    does not already have; at round 9 reshapes month 3's split with
    `forecastWeights` and `splitBy` imported from `agents/policies.js`;
  - **no January**: every query `steady` (the market as it is today), for the
    cell comparison.
  Also count, per market, whether `automator` switches strategy at round 12,
  with January and without.
- [ ] **Step 3: The second stop.** Report to the owner, and stop if any holds:
  - planning beats ignoring in **fewer than 60%** of markets, or its median gain
    is **not above zero** (the surge is scenery);
  - planning's median gain is **more than 15%** of the ignoring player's final
    net profit (a rout);
  - one cell's median rank moves by **more than two places** against "no
    January" (January decides the standings by round 0).
  These three are gates the owner agrees to, not model constants.
- [ ] **Step 4: Write F16 *Measured in play*:** the harness, the three
  branches' medians by cell, the gates and how each landed, and what
  `automator` did at week 12. The guide and the card may only say what this
  records.
- [ ] **Step 5: Commit** — "Measure the January surge across 72 markets (F16)".

### Task 9: the calendar, the January card and the planner mark

**Files:** `ui/season/read.js` (extend), create `ui/season/render.js` and
`ui/words/season.js`; modify `ui/index.html`, `ui/dashboard.js`, `ui/app.js`,
`ui/round-zero.js`, `ui/decisions.js`, `ui/style.css`; tests in
`tests/season.test.js`, `tests/words.test.js`, `tests/ui.test.js`.

**Interfaces produced (`ui/season/read.js`, pure):**
- `weekDates(round)` → `{ fromDay, fromMonth, toDay, toMonth }`, months as
  `'Nov'`, `'Dec'`, `'Jan'` (a fixed array, never a locale), computed from
  `WEEK_ONE` with `Date.UTC` on a fixed non-leap year;
- `liftedRounds(view)` → the rounds where `view.seasonProfiles.resolution`
  exceeds 1;
- `januaryPhase(nextRound, lifted)` → `'hidden'` before round 5, `'forecast'`
  up to the first lifted round, `'surge'` after it, through the game's end;
- `forecast(view, report, playerId)` → `{ lift, from, to, searches, impressions }`:
  `from` and `to` the first and last of `liftedRounds(view)` (weeks 9–11, or
  9–12 if the files lift late January too); `lift` the mean of
  `resolution`'s values over those rounds, minus 1 (a share, formatted as a
  percentage on screen); `searches` how many rows of the player's last
  `breakdown.byQuery` are `resolution` searches; `impressions` their
  impressions;
- `surgeReading(history, playerId, round, view)` → `{ lift, lostToBudget }` or
  `null` when weeks 5–8 showed no training search: impressions on
  `resolution` searches in `round` over their mean in weeks 5–8, minus 1, and
  that week's `share.lostToBudget`.

- [ ] **Step 1: Write the failing tests** in a new `tests/season.test.js`:
  `weekDates(1)` is 6–12 Nov; `weekDates(8)` 25–31 Dec; `weekDates(9)` 1–7 Jan;
  `weekDates(12)` 22–28 Jan; `liftedRounds` on the real view starts at 9
  (**the calendar and the curve agree**); `januaryPhase` at 4, 5, 9, 10 and 12;
  `forecast` and `surgeReading` on a hand-built report and history, including
  the zero cases.
- [ ] **Step 2: Write the words** in `ui/words/season.js`, `SEASON`, using
  `line()`; figures arrive formatted:
  - `title` label "January", `subtitle` label "the resolution weeks";
  - `dates` label from `{ fromDay, fromMonth, toDay, toMonth }`:
    "1–7 Jan", or "25 Dec – 1 Jan" across months;
  - `calendar` reading for round 0 from `{ start, end, week }`: "Your twelve
    weeks run from ${start} to ${end}. January's resolutions arrive in week
    ${week}.";
  - `rises` label "rises in January";
  - `forecast` reading from `{ lift, searches, impressions, from, to }`:
    "In weeks ${from}–${to}, training searches usually run about ${lift} above
    November and December, going by five Januaries of Google Trends.
    ${searches} of the searches your ads showed on last week are training
    searches, and they brought you ${impressions} impressions.";
  - `forecastNone` reading: "None of the searches your ads showed on last week
    is a training search, so January will pass this account by unless you add
    some.";
  - `rank` reading from `{ week }`: "Your January budget is set by where you
    rank at week ${week}.";
  - `levers` reading: "What you can move before then: your bids on those
    searches, how January's budget is spread across its four weeks and, if you
    run broad keywords, your negatives, because the junk rises too.";
  - `surge` reading from `{ lift }`: "Your training searches ran ${lift} above
    November and December this week."; `surgeNone` reading: "None of your ads
    showed on a training search this week."; `lostToBudget` reading from
    `{ share }`: "The week lost ${share} of its impressions to budget.";
  - `easing` reading: "January is easing: the last week runs closer to an
    ordinary one.";
  - `notModelled` disclosure, `{ why: 'seasons' }`: "Only January's training
    searches move here. The festive season and the winter sales that fall in
    these weeks are not modelled."
  Add `SEASON` to `tests/words.test.js`'s kinds/whys/renders-whole checks the way
  `DEBRIEF` is, and `'words/season.js'` and `'season/render.js'` to `LOADABLE`.
- [ ] **Step 3: Run.** Expected: FAIL.
- [ ] **Step 4: Implement `ui/season/read.js`'s functions**, then
  `ui/season/render.js`: `renderJanuary(root, game, view, openGuide)` fills
  `[data-slot="january"]` by phase (hidden, forecast with `rank` and `levers`,
  or surge with `lostToBudget` and, when the next week is the last, `easing`),
  always ending with `notModelled` and its `whyButton`. No prose in the render
  function; every sentence from `SEASON`.
- [ ] **Step 5: Wire it.**
  - `ui/index.html`: after the deadline card,
    `<article class="card span-2" data-slot="january" hidden>` with an `h2` from
    nothing (filled by the render), and a comment saying why it sits beside
    *What week 8 decides*.
  - `ui/dashboard.js`: call `renderJanuary(root, game, view, openGuide)` after
    `getPublicView`.
  - `ui/app.js:249`: append ` · ${SEASON.dates(weekDates(played))}` when
    `played >= 1`.
  - `ui/round-zero.js`: the `calendar` line in the opening, and a *January*
    column in the market table (line ~314) showing `SEASON.rises()` on
    `resolution` searches; `ui/decisions.js`: the same mark where keywords are
    added from the planner.
- [ ] **Step 6: Run** `npm test`. Expected: PASS.
- [ ] **Step 7: Play it** on the dev server: round 0 shows the calendar line
  and the marks; the header shows dates; the card appears at week 5 with the
  forecast, turns into the surge reading after week 9, shows `easing` before
  week 12; the "why?" opens the guide (the chapter lands in Task 10, so until
  then check the link is wired). Check the phone width for overflow and the
  console for errors.
- [ ] **Step 8: Commit** — "Show the calendar, the January card and the
  planner's January mark".

### Task 10: the guide chapter and the seventh lesson

**Files:** modify `ui/guide/chapters.js`, `ui/debrief/read.js`,
`ui/debrief/render.js`, `ui/words/debrief.js`; tests in `tests/guide.test.js`,
`tests/debrief.test.js`, `tests/words.test.js`.

- [ ] **Step 1: Fetch the real half's sources** and read them before writing a
  word of it: https://support.google.com/google-ads/answer/10369906 (seasonality
  adjustments), https://support.google.com/google-ads/answer/10970825 (how the
  algorithms learn), and Google's Keyword Planner help page on search volume
  trends (find it on support.google.com and cite the page that says so; never a
  claim from memory).
- [ ] **Step 2: Add the chapter** `seasons`, *Seasons and surges*, with
  `chapter()` as the others are: real half (Keyword Planner shows monthly
  volumes; Smart Bidding handles seasonal traffic itself; seasonality
  adjustments are for short events of 1–7 days with a major conversion-rate
  change, on Target CPA and Target ROAS); game half (one surge; volume only;
  weeks 9–11; which searches, by their words; two rivals plan; the forecast
  comes true exactly, where a real one is history; the festive season and the
  winter sales are not modelled), citing `F16` and `§7.6`. Add it to
  `CONTENTS`.
- [ ] **Step 3: The seventh lesson**, `planningSurge`, in `lessons()`:
  `met` when, in rounds 5–9, a player decision raised the bid on, or added, a
  keyword whose text is a `resolution` search, or (round 9) changed the weekly
  split; `figures` `{ lift, lostToBudget }` from `surgeReading` over weeks
  9–11 (mean lift, worst lost-to-budget). Words in `DEBRIEF`:
  `planningSurgeTitle` "Planning for a known surge"; `planningSurge` reading
  "You got ready for January, and your training searches ran ${lift} above
  November and December; at worst a January week lost ${share} of its
  impressions to budget." with `why: 'seasons'`; `planningSurgeNot` reading
  "You changed nothing ahead of January. Next game, move money and bids toward
  the searches the planner says will rise, before week ${week}." Add the case to
  `lessonSentence` in `render.js`.
- [ ] **Step 4: Tests**: the chapter cites entries that exist (the existing
  guide test covers it once it is in `CONTENTS`); `lessons()` on a played game
  where the player added a training keyword at round 6 meets `planningSurge`,
  and on the untouched game does not; the words render whole.
- [ ] **Step 5: Run** `npm test`. Expected: PASS. **Play to week 12**: the
  seventh lesson reads right in both groups; the card's "why?" and the lesson's
  open *Seasons and surges*.
- [ ] **Step 6: Commit** — "Add the Seasons and surges chapter and the seventh
  lesson".

### Task 11: docs

- [ ] HANDOVER *Start here*: stage D2 built, what F16 measured, what is left
  for the playtests (the stage D gate). The published file count in CLAUDE.md,
  HANDOVER and `wrangler.jsonc`: run `npm run build` and quote what it prints
  (three new modules: `ui/season/read.js`, `ui/season/render.js`,
  `ui/words/season.js`). CLAUDE.md's known traps gain one: the calendar
  (`WEEK_ONE`) and `SEASON_PROFILES` were measured together, so moving one
  means re-running `scripts/season-lift.js`. Commit.
