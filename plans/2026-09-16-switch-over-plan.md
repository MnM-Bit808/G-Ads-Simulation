# The switch-over, part 1: one release line, and a Studio that stands alone

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. In this project the owner has run every plan inline, one task at a time, with their go-ahead: do the same unless they say otherwise.

**Goal:** Bring every branch the owner chose into `makeover`, then make the Studio stand on its own (its own context, the front door, a failed-restore screen, its colours from the first paint, the playtest questions as a Results section, a playtest file that names its version) and make it the default look, with the classic look still reachable by `?look=classic` until part 2 removes it.

**Architecture:** The merges first, each measured on the market harness against gates the owner agrees before they run. F17 is already in: another session merged it at the owner's word (`5aef436`, 2026-09-16), measured on its branch against gates agreed first, so Task 2 only confirms it. Then the Studio stops building the classic page: a small `ui/shell/context.js` builds the twenty fields its sections read, which the shell used to take from `renderDashboard` drawn hidden. The front door is a new module pair, `ui/door/read.js` (pure) and `ui/door/render.js` (drawing), with its words in `ui/words/door.js`, drawn by `ui/app.js` in the Studio look. Nothing in `engine/` changes after the merges.

**Tech stack:** ES modules with no bundler, `npm test` (eslint, then vitest), the dev server at `http://localhost:5173`, `scripts/market-harness.js`, the in-app browser pane.

**Spec:** `design/switch-over/` (canvas https://claude.ai/code/artifact/54dadd5c-e4db-43fd-90ef-dd8117aa2c19, A chosen on 2026-09-16) and `plans/2026-09-13-studio-makeover.md` section 7 item 9. With the pick the owner chose: the classic look removed, and F17 and the rival prepaid fix in the release.

**Part 2** (its own plan, written when this one lands, because what this leaves decides it): remove the classic look and its code, about 4,500 lines, module by module, moving every rule the Studio still reads out first with its tests; then the records, the tags, and the deploy on the owner's word.

## Global constraints

- Plan before code; one task at a time, with the owner's go-ahead between tasks.
- Tests first. One concern per commit, present tense, the reasoning in the message, ending `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Write the message to a file and commit with `git commit -F <file>` (PowerShell splits here-strings with quotes).
- Check `npm test`'s exit code before committing; never commit red. Do not edit repo files while a full run is going: vitest reads a file when it reaches it.
- Push nothing, `makeover` included, until the owner says. Pushing `main` deploys the live site.
- "It works" means playing it in the browser pane on the dev server (`preview_start` with name `sim`), not green tests. Measure contrast by script.
- Edit files with the Edit tool, never shell heredocs (Windows, CRLF).
- Every sentence on screen is a `line()` in `ui/words/` (kinds: reading, disclosure, instruction, label); no digit typed inside a string literal; a new drawing module joins the drawing guard in `tests/words.test.js` and fails any literal of three words; a class string holds at most two names. Every new `ui/` module joins `LOADABLE` in `tests/ui.test.js`.
- Anything that moves the market is measured before and after with `scripts/market-harness.js`, against gates agreed with the owner first (below).
- The Studio's palette: red is the player and their changes; amber is warnings and money lost, with a minus sign; mint is money made; bone and greys for everything else.
- Downloads need the owner's yes first, with names and sizes. None are planned.

## The gates, to agree with the owner before Task 1

`node scripts/market-harness.js market <label> 6` plays 72 whole games (seeds 1 to 12, six cells) and writes `%TEMP%\harness-<label>-market.json`. Its `compare` mode reads writer runs only, so market runs are compared by file hash and by their printed summaries.

1. **Bringing `main` in changes no game.** After Task 1 the merged tree is makeover's byte for byte (every commit on `main` has a twin on makeover), so the market is unchanged by construction.
2. **F17 arrived as it was accepted.** Makeover's rows (Task 1's "before" run, on `5aef436`) are byte-identical to a run on F17's branch head, `c2cdba9`: only design files and records lie between the two. F17's own gates were agreed and passed on its branch, and its tripwires accepted by the owner ("Accept, and correct the words").
3. **The rival fix does what it says and nothing more.** After Task 3, against Task 1's `before-switch` run (the tree Task 1 leaves is the same): the player's final rank median and its count of losing markets are unchanged; the player's median final net profit moves by less than 3%; the rivals' median profit per rupee moves by less than 5%. It cannot change a saved game (a replay reads the rivals' decisions from the log). If a gate fails: stop, and report the two summaries to the owner.

## Files

| File | Job | Task |
|---|---|---|
| `ui/shell/context.js` (new) | the Studio's context for the draft, built without a page | 4 |
| `ui/dashboard.js` | exports `accumulate`, which the context reads | 4 |
| `ui/shell/shell.js` | uses the context; no hidden dashboard; the rail's Playtest opens "Before you go" after the last week | 4, 6 |
| `ui/door/read.js` (new) | pure: what the front door says about a save, and which weeks a changed replay changed | 5 |
| `ui/door/render.js` (new) | draws the front door's five states | 5 |
| `ui/words/door.js` (new) | the front door's words | 5 |
| `ui/app.js` | draws the door in the Studio look; a failed restore is caught; the door's clicks do not count as round 0 touched | 5, 6, 8 |
| `ui/studio.css` | the door; "Before you go"; the loading line | 5, 6, 8 |
| `ui/shell/sections.js` | the "Before you go" section, on the playtest link only | 6 |
| `ui/results/render.js` | draws "Before you go"; Play again moves there on the playtest link | 6 |
| `ui/words/playtest.js` (new) | the playtest questions' words, shared by both looks until part 2 | 6 |
| `ui/recorder.js` | its classic panel reads the shared words; the recording notes each version it ran on | 6, 7 |
| `ui/version.js` (new), `scripts/build-site.js` | the version the build stamps | 7 |
| `scripts/read-playtest.js` | groups the door's phases; prints the versions | 5, 7 |
| `ui/look.js`, `ui/index.html` | the Studio is the default; its colours from the first paint | 8 |
| `tests/…` | as each task says | all |

---

### Task 1: Bring `main` into `makeover`

**State when this task was set (2026-09-16, after the owner's go):** `main` is `417b91a` here and on GitHub, and live: the prepaid fix's twin (19e770f), the classic search terms fix's four commits, and a copy of the build test's allowance (417b91a, twin of 8841262). Every one of its 18 commits has a twin already on makeover: the prepaid fix merged at 4a918fe, the classic search terms fix at `167ce9d` (another session, from its copy branch), the allowance at 8841262.

**Files:** the merge meets makeover in 9 files: `DECISIONS.md`, `engine/round.js`, `scripts/market-harness.js`, `tests/dashboard.test.js`, `tests/decisions.test.js`, `tests/marketHarness.test.js`, `tests/round.test.js`, `ui/dashboard.js`, `ui/decisions.js` (checked with `git merge-tree` on `167ce9d`).

Order: this task's Step 1, then Task 2 (it checks F17 against that run), then this task's Step 2 onwards.

**Interfaces:** Produces the branch the rest of this plan builds on, with `main` an ancestor, so part 2's deploy can move `main` forward without discarding anything.

- [ ] **Step 1: Measure the market before.**
  Run: `node scripts/market-harness.js market before-switch 6`
  Keep the printed summary in the task's notes. Expected: `rows written to …harness-before-switch-market.json`.

- [ ] **Step 2: Merge `main`, taking makeover's side wherever the twins meet.**
  Run: `git merge --no-ff --no-commit origin/main`
  Expected: conflicts in exactly the 9 files above. Resolve each with `git checkout --ours -- <file>` then `git add <file>`.
  Then run: `git diff --stat HEAD` (against makeover's tip, before committing)
  Expected: no output. The merged tree is makeover's, byte for byte; if anything shows, stop and read it before going on.

- [ ] **Step 3: Gate 1.** An identical tree plays identically, so the gate holds by construction: record `git diff --stat HEAD` empty as its evidence. (The harness would only replay the same code.)

- [ ] **Step 4: Run the whole suite.** Run: `npm test`. Expected: exit 0.

- [ ] **Step 5: Commit the merge** with `git commit -F <file>`: "Merge the live site's main into makeover, keeping makeover's side of every twin", naming the three twins, that the tree is unchanged (gate 1), and why (part 2's deploy moves `main` forward, so it must be an ancestor). No play: nothing changed.

### Task 2: Confirm F17 as merged

F17 went into makeover at the owner's word on 2026-09-16 (`5aef436`, merged by another session, measured on its branch). This task only confirms nothing changed on the way in. Do it right after Task 1's Step 1 and before Task 1's merges.

- [ ] **Step 1: Measure F17's branch as it stands.** In its worktree:
  Run: `node scripts/market-harness.js market f17-branch 6` with the working directory `.claude/worktrees/lucid-bhabha-395dd1`
  Expected: rows written to `…harness-f17-branch-market.json`.

- [ ] **Step 2: Gate 2.** Compare the hashes of `harness-f17-branch-market.json` and Task 1 Step 1's `harness-before-switch-market.json`. Expected: `True`. If not, stop and report.

- [ ] **Step 3: Play it.** A new game at `/ui/?look=studio` through round 0 and two weeks: every section draws, the tray runs a week. No commit: nothing changed.

### Task 3: Merge the rival prepaid fix

**Files:** from `claude/rival-prepaid-makeover` (`b24a98e`): `agents/policies.js`, `engine/report.js`, `tests/policies.test.js`, `DECISIONS.md` (I34).

- [ ] **Step 1: Confirm the branch is final, and that no other session is merging it.** Another session built it and has a ready merge, `claude/rival-prepaid-makeover-merge` (`29bd0c5`); another merged F17 into this same folder while this plan was written. Run: `git log --oneline -3 claude/rival-prepaid-makeover` and `git log --oneline -5 makeover`. Expected: `b24a98e` on top of the branch, and the fix not already in makeover. If either has moved, ask the owner.

- [ ] **Step 2: Merge.** Run: `git merge --no-ff --no-commit claude/rival-prepaid-makeover`
  Expected: clean (`git merge-tree` checked it against both makeover and F17).

- [ ] **Step 3: Run the whole suite.** Run: `npm test`. Expected: exit 0.

- [ ] **Step 4: Gate 3.** Run: `node scripts/market-harness.js market after-rival 6`. Read its summary against Task 1's `before-switch` summary line by line: player final rank median and "loses money in N of 72" unchanged; player median final net profit within 3%; rivals' "profit per ₹" within 5%. If any fails, stop and report, and do not commit.

- [ ] **Step 5: Commit** with `git commit -F <file>`: "Merge the rival prepaid fix: rivals offer the discount, as I34 says", with each gate's figure before, after, and PASS.

### Task 4: The Studio builds its own context

**Files:**
- Create: `ui/shell/context.js`
- Modify: `ui/dashboard.js:638` (export `accumulate`), `ui/shell/shell.js` (the `draw` function and `drawSection`'s last branch)
- Test: `tests/studioContext.test.js` (new), `tests/ui.test.js` (LOADABLE)

**Interfaces:**
- Consumes: `formContext(game)` (ui/dashboard.js), `accumulate(game, which, range)` (ui/dashboard.js, exported here).
- Produces: `studioContext(game, { onChange }) → ctx` with every field `formContext` gives plus `terms`, `byKeyword`, `planner`, `sync()`, `refresh()`; `PLANNER_START`.

- [ ] **Step 1: Write the failing test.** `tests/studioContext.test.js`:

```js
/**
 * The Studio's own context (the switch-over, part 1). The shell took it from
 * renderDashboard, drawn hidden on every week, so the Studio built the whole
 * classic page to read twenty fields. This test holds that the new one gives
 * the same fields, without a page (vitest runs here with no document).
 */
import { describe, test, expect, beforeAll } from 'vitest';
import { studioContext, PLANNER_START } from '../ui/shell/context.js';
import { formContext, accumulate } from '../ui/dashboard.js';
import { startGame } from '../setup.js';
import { submitRound } from '../game.js';
import { getSelfView } from '../engine/insights.js';
import { createDraft } from '../ui/decisions.js';
import { QUERY_SET } from '../content/querySet.js';
import { BRAND_IDENTITIES } from '../content/brands.js';

let game;
beforeAll(() => {
  const own = QUERY_SET.queries.filter((q) => q.intent === 'commercial').slice(0, 4);
  let state = startGame({
    rootSeed: 7,
    playerBrandId: BRAND_IDENTITIES[0].id,
    querySet: QUERY_SET,
    player: {
      position: { price: 'mid', purpose: 'performance' },
      keywords: own.map((q) => ({ text: q.text, matchType: 'phrase', bidPaise: 2400 })),
    },
  });
  const playerId = state.advertisers[0].id;
  const reports = [];
  for (let week = 0; week < 3; week++) {
    const out = submitRound(state, {}, { mode: 'expected' });
    reports.push(out.report);
    state = out.nextGameState;
  }
  game = { state, reports, playerId, draft: createDraft(getSelfView(state, playerId)), view: { termsRange: 'all' } };
});

describe('the Studio builds its context without the classic page', () => {
  test('it carries every field formContext gives', () => {
    const ctx = studioContext(game);
    for (const key of Object.keys(formContext(game))) expect(ctx, key).toHaveProperty(key);
  });

  test('its breakdowns are the report range the player is reading', () => {
    const ctx = studioContext(game);
    expect(ctx.terms).toEqual(accumulate(game, 'byQuery', 'all'));
    expect(ctx.byKeyword).toEqual(accumulate(game, 'byKeyword', 'all'));
    game.view.termsRange = 'week';
    ctx.refresh();
    expect(ctx.terms).toEqual(accumulate(game, 'byQuery', 'week'));
    game.view.termsRange = 'all';
  });

  test('a staged change tells the shell once', () => {
    let told = 0;
    const ctx = studioContext(game, { onChange: () => { told += 1; } });
    ctx.refresh();
    expect(told).toBe(1);
  });

  test('the keyword planner opens as the classic card opened it', () => {
    expect(studioContext(game).planner).toEqual(PLANNER_START);
    expect(PLANNER_START).toEqual({ matchType: 'phrase', bidPaise: 3000, term: '', open: false });
  });
});
```

Add `'shell/context.js': () => import('../ui/shell/context.js'),` to `LOADABLE` in `tests/ui.test.js`.

- [ ] **Step 2: Run it to see it fail.** Run: `npx vitest run tests/studioContext.test.js`. Expected: FAIL, `Failed to load url ../ui/shell/context.js`.

- [ ] **Step 3: Export `accumulate`.** In `ui/dashboard.js:638`, `function accumulate(game, which, range) {` becomes `export function accumulate(game, which, range) {`, and its JSDoc gains a line: "Exported for the Studio's own context (ui/shell/context.js)."

- [ ] **Step 4: Write `ui/shell/context.js`.**

```js
/**
 * The Studio's own context for the draft (the switch-over, part 1): what the
 * rebuilt sections read and stage through, built without drawing a page.
 *
 * Until now the shell took it from `renderDashboard`, drawn hidden on every
 * week: `formContext` plus the search terms and keyword breakdowns, and two
 * things the classic form wrote back into it, `ctx.refresh` and the keyword
 * planner's state. So the Studio drew the whole classic page to read twenty
 * fields. This builds the same fields and nothing else.
 */

import { formContext, accumulate } from '../dashboard.js';

/** The planner's opening state, as the classic keywords card set it (ui/decisions.js). */
export const PLANNER_START = Object.freeze({ matchType: 'phrase', bidPaise: 3000, term: '', open: false });

/**
 * @param {object} game - the running game: state, reports, playerId, draft, view
 * @param {object} [options]
 * @param {() => void} [options.onChange] - after anything is staged; the shell redraws its tray
 * @returns {object} `formContext(game)` plus `terms`, `byKeyword`, `planner`, `sync` and `refresh`
 */
export function studioContext(game, { onChange } = {}) {
  const ctx = {
    ...formContext(game),
    terms: null,
    byKeyword: null,
    planner: { ...PLANNER_START },
    /** Both breakdowns follow whichever range the report is showing. */
    sync: () => {
      ctx.terms = accumulate(game, 'byQuery', game.view.termsRange);
      ctx.byKeyword = accumulate(game, 'byKeyword', game.view.termsRange);
    },
    /** A change was staged: read the figures again, then let the shell catch up. */
    refresh: () => {
      ctx.sync();
      onChange?.();
    },
  };
  ctx.sync();
  return ctx;
}
```

- [ ] **Step 5: The shell uses it.** In `ui/shell/shell.js`:
  - import `studioContext` from `./context.js`, and drop `renderDashboard` from the imports;
  - in `draw()`, replace the `dashboard = renderDashboard(game, () => drawTray(), { openGuide, onContext: (c) => { ctx = c; } }); dashboard.classList.add('studio-cards');` lines with `ctx = studioContext(game, { onChange: () => drawTray() });`;
  - remove `let dashboard = null;` and, in `drawSection`, the final `else { dashboard.dataset.section = s.key; shown = dashboard; }` branch: every section now draws itself (the next step's test holds it).
  Leave `visibilityRules` and `RETIRED_SLOTS` for part 2.

- [ ] **Step 6: A test that every section draws itself.** In `tests/sections.test.js`, in the describe `every card on today's page has one place in the new layout`:

```js
  // The switch-over, part 1: the shell no longer draws the classic page, so a
  // section with nothing of its own would draw nothing.
  test('every section is one the shell draws itself', () => {
    const shell = read('ui/shell/shell.js');
    for (const s of SECTIONS) {
      const drawn = s.area === 'results' || shell.includes(`s.key === '${s.key}'`)
        || (s.draws?.includes('keywords') && shell.includes("s.draws?.includes('keywords')"));
      expect(drawn, s.key).toBe(true);
    }
  });
```

- [ ] **Step 7: Run the tests.** Run: `npx vitest run tests/studioContext.test.js tests/sections.test.js tests/ui.test.js`. Expected: PASS. Then `npm test`, exit 0.

- [ ] **Step 8: Play it** on a six-week save at `/ui/?look=studio`: in every section stage a change (a bid, a match type, a planner add, a block, an hour, a place, the split, the prepaid rung) and see the tray line arrive and its undo take it back; switch What people typed between this week and all weeks; run a week. In the console, `document.querySelectorAll('[data-slot="decisions"], .decision-region').length` is `0`: the classic form is no longer built.

- [ ] **Step 9: Commit.** "Give the Studio its own context, so it stops drawing the classic page hidden", with why (twenty fields; `ctx.refresh` and the planner came from the classic form) and what played.

### Task 5: The front door

**Files:**
- Create: `ui/door/read.js`, `ui/door/render.js`, `ui/words/door.js`
- Modify: `ui/app.js` (`offerResume`, `resume`, the round-0-touched listener), `ui/studio.css` (a `door` block), `scripts/read-playtest.js` (`GROUPS`)
- Test: `tests/door.test.js` (new), `tests/words.test.js` (drawing guard; a DOOR block), `tests/ui.test.js` (LOADABLE), `tests/readPlaytest.test.js`

**Interfaces:**
- Consumes: `fingerprintOf(reports, playerId)` (ui/save.js), `TOTAL_ROUNDS`.
- Produces: `doorFacts(saved) → {name, position, played, total, finished}`; `changedWeeks(fingerprint, reports, playerId, limit = 3) → {rows: [{week, thenPaise, thenClicks, nowPaise, nowClicks}], more}`; `renderDoor(view) → {node, progress(week, of)}` where `view = {state: 'offer'|'restoring'|'changed'|'failed'|'finished', name, position, played, total, rows?, more?, onResume?, onContinue?, onStartAfresh, onPlaytest?}`.

- [ ] **Step 1: Write the failing tests.** `tests/door.test.js`:

```js
/**
 * The Studio's front door (design/switch-over/, A, the owner's choice of
 * 2026-09-16). The door is DOM and is played; what it says is decided here.
 */
import { describe, test, expect } from 'vitest';
import { doorFacts, changedWeeks } from '../ui/door/read.js';

const report = (costPaise, clicks) => ({ byAdvertiser: { me: { traffic: { costPaise, clicks } } } });

describe('what the door says about a save', () => {
  const saved = (weeksPlayed) => ({
    playerId: 'me', weeksPlayed,
    initialState: { advertisers: [{ id: 'me', name: 'Vella & Co.', position: { price: 'mid', purpose: 'performance' } }] },
  });

  test('the brand, where it sits and how far it got', () => {
    expect(doorFacts(saved(6))).toEqual({ name: 'Vella & Co.', position: 'mid · performance', played: 6, total: 12, finished: false });
  });

  test('a save of every week is a finished game', () => {
    expect(doorFacts(saved(12)).finished).toBe(true);
  });
});

describe('a changed replay lists the weeks that changed', () => {
  test('as saved against replayed now, in whole rupees and clicks', () => {
    const out = changedWeeks([[5593900, 4284.2]], [report(7824700, 6536.4)], 'me');
    expect(out).toEqual({ rows: [{ week: 1, thenPaise: 5593900, thenClicks: 4284, nowPaise: 7824700, nowClicks: 6536 }], more: 0 });
  });

  // Clicks are fractional and the save compares them exactly, so a replay can
  // differ where no figure on screen would (the review, 2026-09-16).
  test('a week that differs below what is shown is not listed', () => {
    const out = changedWeeks([[5593900, 4284.2], [7825000, 3400]], [report(5593940, 4284.3), report(7824700, 3500)], 'me');
    expect(out.rows.map((r) => r.week)).toEqual([2]);
  });

  test('three weeks at most, and how many more', () => {
    const five = [1, 2, 3, 4, 5].map((w) => [w * 100000, w * 10]);
    const out = changedWeeks(five, five.map(([c, k]) => report(c + 50000, k + 5)), 'me');
    expect(out.rows.map((r) => r.week)).toEqual([1, 2, 3]);
    expect(out.more).toBe(2);
  });
});
```

In `tests/words.test.js`: add `import { DOOR } from '../ui/words/door.js';`, add `'ui/door/render.js'` to the `drawing` list, and a block:

```js
describe('the front door says its words whole (ui/words/door.js)', () => {
  const FIGURES = { played: 6, total: 12, week: 7, of: 6, spend: '₹55,939', clicks: '4,284', n: 3 };
  test('each renders with the figures it is given', () => {
    for (const [name, entry] of Object.entries(DOOR)) expect(entry(FIGURES), name).not.toMatch(/undefined|NaN/);
    expect(DOOR.moreDiffer({ n: 1 })).toBe('and 1 more week differs');
  });

  // A replay is exact by design, so it fails the same way every time; a door
  // offering to try again would be a control that does nothing (ui/app.js).
  test('a save this version cannot open is not offered again', () => {
    expect(Object.values(DOOR).map((e) => e(FIGURES)).join(' ')).not.toMatch(/try again/i);
  });
});
```

Add `'door/read.js'`, `'door/render.js'`, `'words/door.js'` to `LOADABLE`. In `tests/readPlaytest.test.js`, the test `screens that are not play, such as restoring a save, are kept apart` (which files `restoring` under `other`) becomes:

```js
  test('the front door\'s screens are kept together, apart from play', () => {
    const file = recordedFile();
    for (const name of ['resume offer', 'restoring', 'restore failed']) {
      file.recording.phases.push({
        name, startAt: 0, endAt: 3000, lastSeenAt: 3000, hiddenMs: 0, idleMs: 0, clicks: 0, keys: 0, cardMs: {},
      });
    }
    const groups = phaseGroups(file);
    expect(groups.at(-1)).toMatchObject({ name: 'front door', activeSeconds: 9 });
  });
```

- [ ] **Step 2: Run them to see them fail.** Run: `npx vitest run tests/door.test.js tests/words.test.js tests/ui.test.js tests/readPlaytest.test.js`. Expected: FAIL, the door modules do not exist.

- [ ] **Step 3: `ui/door/read.js`.**

```js
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
 * The weeks a changed replay changed, as the save kept them (each week's spend
 * and clicks as first reported) against the replay's own first reports. Only
 * weeks that differ in whole rupees or whole clicks: the save compares clicks
 * exactly, and they are fractional, so a replay can differ where nothing shown
 * would. "When saved", not "as you played it": continuing a changed game
 * saves it again.
 *
 * @param {Array<[number, number]>} fingerprint - the save's, paise and clicks a week
 * @param {object[]} reports - the replay's
 * @param {string} playerId
 * @param {number} [limit] - weeks listed; the rest are counted
 * @returns {{rows: Array<{week: number, thenPaise: number, thenClicks: number, nowPaise: number, nowClicks: number}>, more: number}}
 */
export function changedWeeks(fingerprint, reports, playerId, limit = 3) {
  const now = fingerprintOf(reports, playerId);
  const rows = [];
  fingerprint.forEach(([thenPaise, thenClicks], i) => {
    const [nowPaise, nowClicks] = now[i] ?? [0, 0];
    const shown = (paise, clicks) => [Math.round(paise / 100), Math.round(clicks)];
    const [a, b] = [shown(thenPaise, thenClicks), shown(nowPaise, nowClicks)];
    if (a[0] === b[0] && a[1] === b[1]) return;
    rows.push({ week: i + 1, thenPaise, thenClicks: a[1], nowPaise, nowClicks: b[1] });
  });
  return { rows: rows.slice(0, limit), more: Math.max(0, rows.length - limit) };
}
```

- [ ] **Step 4: `ui/words/door.js`.**

```js
/**
 * The Studio's front door (design/switch-over/, A, the owner's choice of
 * 2026-09-16): the words before a game opens. The resume offer's, restoring's
 * and a changed game's are today's (ui/app.js); the finished game's and a game
 * this version cannot open are new, checked by a second reader.
 */

import { line } from './line.js';

export const DOOR = Object.freeze({
  saved: line('label', 'saved in this browser'),
  inProgress: line('label', 'A game in progress'),
  finished: line('label', 'A finished game'),
  played: line('label', ({ played, total }) => `${played} of ${total} weeks played`),
  replayNote: line('reading', 'Resuming replays those weeks from your own decisions, which takes a few seconds.'),
  finishedNote: line('reading', ({ total }) => `Opening it replays all ${total} weeks from your own decisions, which takes a few seconds.`),
  resume: line('label', ({ week }) => `Resume at week ${week}`),
  resumeWhy: line('reading', 'Everything as you left it, except changes you had staged and not yet run.'),
  backToResults: line('label', 'Back to the results'),
  backWhy: line('reading', 'The Results area, from its first section.'),
  startNew: line('label', 'Start a new game'),
  startNewWhy: line('reading', 'Discards the saved game. There is no getting it back.'),
  discardWhy: line('reading', 'Discards the saved game.'),
  restoring: line('label', 'Restoring your game'),
  replaying: line('label', ({ week, of }) => `Replaying week ${week} of ${of}…`),
  changedTitle: line('label', 'This game has changed since you saved it'),
  changedNote: line('reading', 'The simulator has been updated since this game was saved. Replayed on this version, '
    + 'your own decisions produce different weeks from the ones you played, so the numbers you would see are this '
    + 'version’s, not the ones you read at the time.'),
  whenSaved: line('label', 'when saved'),
  replayedNow: line('label', 'replayed now'),
  week: line('label', ({ week }) => `Week ${week}`),
  spendOn: line('label', ({ spend, clicks }) => `${spend} on ${clicks} clicks`),
  moreDiffer: line('label', ({ n }) => `and ${n} more ${n === 1 ? 'week differs' : 'weeks differ'}`),
  continue: line('label', 'Continue with these numbers'),
  continueWhy: line('reading', 'Carry on from here on the updated simulator.'),
  failedTitle: line('label', 'This version cannot open your saved game'),
  failedNote: line('reading', 'Opening it fails on this version, and would fail the same way every time. It stays in '
    + 'this browser until you start a new game, so a later version may open it.'),
  playtestOnly: line('label', 'on the playtest link only'),
});
```

(`DOOR.week` takes `{week}`; the test's FIGURES carry it.)

- [ ] **Step 5: `ui/door/render.js`.**

```js
/**
 * The Studio's front door (design/switch-over/, A, the owner's choice of
 * 2026-09-16): one card before a game opens, in five states. What it says
 * about a save is worked out in ./read.js; its words are in ui/words/door.js.
 * The weeks played stay red while a game replays, and a bar with a line read
 * out to screen readers shows how far it has got: emptying the dots and
 * filling them again read as weeks lost (the review).
 */

import { el, rupees, whole } from '../dom.js';
import { button } from '../kit/controls.js';
import { DOOR } from '../words/door.js';
import { SHELL } from '../words/shell.js';

function choice(label, why, onPick, primary) {
  const row = el('div', 'door-choice');
  const b = button(primary ? 'door-go' : 'door-other', label);
  b.addEventListener('click', onPick);
  row.append(b, el('p', 'door-why', why));
  return row;
}

/**
 * @param {object} view - see the plan's Interfaces for Task 5
 * @returns {{node: HTMLElement, progress: (week: number, of: number) => void}}
 */
export function renderDoor(view) {
  const node = el('div', 'door');
  const column = el('div', 'door-column');
  const head = el('div', 'door-head');
  const brand = el('div', 'door-brand');
  brand.append(el('strong', null, view.name), el('span', null, view.position));
  head.append(el('div', 'door-logo', view.name.split(' ').slice(0, 2).map((w) => w[0]).join('')), brand);
  if (view.onPlaytest) {
    const send = button('door-playtest', SHELL.playtest());
    send.title = DOOR.playtestOnly();
    send.addEventListener('click', view.onPlaytest);
    head.append(send);
  }

  const card = el('section', 'door-card');
  const dots = el('div', 'door-dots');
  dots.setAttribute('aria-hidden', 'true');
  for (let week = 1; week <= view.total; week++) dots.append(el('i', week <= view.played ? 'on' : null));

  const titles = {
    offer: DOOR.inProgress(), finished: DOOR.finished(), restoring: DOOR.restoring(),
    changed: DOOR.changedTitle(), failed: DOOR.failedTitle(),
  };
  const title = el('h2', 'door-title', titles[view.state]);
  title.tabIndex = -1;
  card.append(el('p', 'door-eyebrow', DOOR.saved()), title, dots);

  let progress = () => {};
  if (view.state === 'offer' || view.state === 'finished') {
    card.append(el('p', 'door-count', DOOR.played({ played: view.played, total: view.total })),
      el('p', 'door-note', view.state === 'finished' ? DOOR.finishedNote({ total: view.total }) : DOOR.replayNote()),
      view.state === 'finished'
        ? choice(DOOR.backToResults(), DOOR.backWhy(), view.onResume, true)
        : choice(DOOR.resume({ week: view.played + 1 }), DOOR.resumeWhy(), view.onResume, true),
      choice(DOOR.startNew(), DOOR.startNewWhy(), view.onStartAfresh, false));
  } else if (view.state === 'restoring') {
    const bar = el('div', 'door-bar');
    const fill = el('span');
    bar.append(fill);
    const said = el('p', 'door-count', DOOR.replaying({ week: 1, of: view.played }));
    said.setAttribute('role', 'status');
    card.append(bar, said);
    progress = (week, of) => {
      fill.style.width = `${(100 * week) / of}%`;
      said.textContent = DOOR.replaying({ week: Math.min(week + 1, of), of });
    };
  } else if (view.state === 'changed') {
    const table = el('div', 'door-table');
    table.append(el('span'), el('span', 'door-label', DOOR.whenSaved()), el('span', 'door-label', DOOR.replayedNow()));
    for (const r of view.rows) {
      table.append(el('span', 'door-week', DOOR.week({ week: r.week })),
        el('span', null, DOOR.spendOn({ spend: rupees(r.thenPaise), clicks: whole(r.thenClicks) })),
        el('strong', null, DOOR.spendOn({ spend: rupees(r.nowPaise), clicks: whole(r.nowClicks) })));
    }
    if (view.more > 0) table.append(el('span'), el('span', 'door-more', DOOR.moreDiffer({ n: view.more })));
    card.append(el('p', 'door-note', DOOR.changedNote()), table,
      choice(DOOR.continue(), DOOR.continueWhy(), view.onContinue, true),
      choice(DOOR.startNew(), DOOR.discardWhy(), view.onStartAfresh, false));
  } else {
    card.append(el('p', 'door-note', DOOR.failedNote()),
      choice(DOOR.startNew(), DOOR.discardWhy(), view.onStartAfresh, true));
  }

  column.append(head, card);
  node.append(column);
  return { node, progress };
}
```

- [ ] **Step 6: The door's look.** In `ui/studio.css`, after the shell block (`body.studio main:has(> .studio-shell)`):

```css
/* --- the front door (design/switch-over/, A, the owner's choice 2026-09-16) --- */
/* One card before a game opens, in the page's own space: no header, as in the shell. */
body.studio:has(.door) .bar { display: none; }
body.studio main:has(> .door) { padding: 0; max-width: none; }
body.studio .door { display: grid; place-items: center; min-height: 100vh; min-height: 100dvh; padding: 24px 16px; box-sizing: border-box; }
body.studio .door-column { display: flex; flex-direction: column; gap: 22px; width: min(600px, 100%); }
body.studio .door-head { display: flex; align-items: center; gap: 14px; }
body.studio .door-logo { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 14px; background: var(--studio-red); color: var(--studio-on-red); font: 800 17px/1 var(--studio-display); }
body.studio .door-brand { display: flex; flex: 1; flex-direction: column; gap: 2px; }
body.studio .door-brand strong { font: 800 20px/1.1 var(--studio-display); }
body.studio .door-brand span { font-size: 12px; color: var(--studio-muted); }
body.studio .door-playtest { padding: 6px 14px; border: 1px solid var(--studio-line-strong); border-radius: 999px; background: none; color: var(--studio-soft); font-size: 13px; font-weight: 600; }
body.studio .door-card { display: flex; flex-direction: column; gap: 16px; padding: 30px 32px; border: 1px solid var(--studio-line); border-radius: 24px; background: var(--studio-card); }
body.studio .door-eyebrow { margin: 0; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--studio-faint); }
body.studio .door-title { margin: 0; font: 800 40px/1 var(--studio-display); letter-spacing: -0.02em; color: var(--studio-text); text-transform: none; }
body.studio .door-title:focus { outline: none; }
body.studio .door-dots { display: flex; flex-wrap: wrap; gap: 6px; }
body.studio .door-dots i { width: 12px; height: 12px; border: 1.5px solid var(--studio-line-strong); border-radius: 50%; box-sizing: border-box; }
body.studio .door-dots i.on { border-color: var(--studio-red); background: var(--studio-red); }
body.studio .door-count { margin: -6px 0 0; font-size: 14px; color: var(--studio-muted); font-variant-numeric: tabular-nums; }
body.studio .door-note { margin: 0; font-size: 15px; line-height: 1.55; color: var(--studio-soft); }
body.studio .door-bar { height: 8px; overflow: hidden; border-radius: 4px; background: #2E2A33; }
body.studio .door-bar span { display: block; width: 0; height: 100%; background: var(--studio-red); }
body.studio .door-table { display: grid; grid-template-columns: 80px minmax(0, 1fr) minmax(0, 1fr); gap: 8px 16px; padding: 14px 16px; border: 1px solid var(--studio-line); border-radius: 16px; background: var(--studio-page); font-size: 13px; font-variant-numeric: tabular-nums; color: var(--studio-soft); }
body.studio .door-label { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--studio-faint); }
body.studio .door-week, body.studio .door-more { color: var(--studio-muted); }
body.studio .door-more { grid-column: 2 / -1; }
body.studio .door-choice { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; }
body.studio .door-go { height: 52px; padding: 0 28px; border-radius: 999px; background: var(--studio-red); color: var(--studio-on-red); font: 700 18px/1 var(--studio-display); }
body.studio .door-other { height: 44px; padding: 0 22px; border: 1px solid var(--studio-line-strong); border-radius: 999px; background: none; color: var(--studio-soft); font-size: 15px; font-weight: 600; }
body.studio .door-why { flex: 1 1 200px; margin: 0; font-size: 13px; line-height: 1.4; color: var(--studio-muted); }
@media (max-width: 560px) {
  body.studio .door-card { padding: 22px 18px; }
  body.studio .door-title { font-size: 30px; }
  body.studio .door-table { grid-template-columns: 60px minmax(0, 1fr) minmax(0, 1fr); font-size: 12px; }
}
```

- [ ] **Step 7: The app draws the door in the Studio look, and catches a failed restore in both.** In `ui/app.js`:
  - import `renderDoor` from `./door/render.js`, `doorFacts` and `changedWeeks` from `./door/read.js`, and `DOOR` from `./words/door.js`;
  - add, beside `showPanel`:

```js
/** The Studio's front door, in the page's own space (design/switch-over/, A). */
function showDoor(view) {
  const door = renderDoor(view);
  app.replaceChildren(door.node);
  window.scrollTo(0, 0);
  door.node.querySelector('.door-title')?.focus({ preventScroll: true });
  return door;
}
```

  - at the top of `offerResume`, after `recorder?.phase('resume offer');`:

```js
  if (look === 'studio') {
    const facts = doorFacts(saved);
    showDoor({
      ...facts, state: facts.finished ? 'finished' : 'offer',
      onResume: () => resume(saved), onStartAfresh: startAfresh, onPlaytest: recorder ? sendPlaytestFile : null,
    });
    return;
  }
```

  - `resume(saved)` becomes (the classic panels kept as they are, for part 2 to remove):

```js
async function resume(saved) {
  recorder?.phase('restoring');
  const facts = doorFacts(saved);
  const base = { ...facts, onStartAfresh: startAfresh, onPlaytest: recorder ? sendPlaytestFile : null };
  let door = null;
  let progress = null;
  if (look === 'studio') door = showDoor({ ...base, state: 'restoring' });
  else {
    const node = panel('Restoring your game');
    progress = el('p', 'note', `Replaying week 1 of ${saved.weeksPlayed}…`);
    node.append(progress);
    showPanel(node);
  }

  // A replay is exact by design (the same start, the same log, a seeded engine),
  // so one that fails fails every time. Before this, nothing caught it, and
  // "Restoring" stayed on screen for ever (found drawing the switch-over).
  try {
    const restored = await restoreSave(saved, {
      mode: 'expected',
      onWeek: (week, of) => {
        if (door) door.progress(week, of);
        else progress.textContent = week < of ? `Replaying week ${week + 1} of ${of}…` : 'Done.';
      },
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
    recorder?.phase('replay changed');
    if (door) {
      const { rows, more } = changedWeeks(saved.fingerprint, restored.reports, saved.playerId);
      showDoor({ ...base, state: 'changed', rows, more, onContinue: () => { persist(); render(); } });
      return;
    }
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
  } catch (error) {
    console.error(error);
    recorder?.phase('restore failed');
    game = null;
    if (look === 'studio') showDoor({ ...base, state: 'failed' });
    else {
      const node = panel(DOOR.failedTitle());
      node.append(el('p', 'note', DOOR.failedNote()), choice(DOOR.startNew(), DOOR.discardWhy(), startAfresh));
      showPanel(node);
    }
  }
}
```

  - the round-0-touched listener: `app.addEventListener(type, (event) => { if (!game && !event.target.closest?.('.door')) roundZeroTouched = true; });`, with a comment: a click on the door is not work round 0 would lose, so a reload during a restore does not ask "Leave site?".

- [ ] **Step 8: The door's phases group together.** In `scripts/read-playtest.js`, before `['other', () => true]`: `['front door', (name) => ['resume offer', 'restoring', 'replay changed', 'restore failed'].includes(name)],`.

- [ ] **Step 9: Run the tests.** Run: `npx vitest run tests/door.test.js tests/words.test.js tests/ui.test.js tests/readPlaytest.test.js`, then `npm test`. Expected: PASS, exit 0.

- [ ] **Step 10: Play every state** at `/ui/?look=studio` with saves written by `scratchpad/make-saves.mjs`: a six-week save (offer, then restoring, then the game); a finished save (Back to the results opens Twelve weeks); a save made on the live code (`scratchpad/save-across.mjs`'s maker, from the `wt-main` checkout of `origin/main`), which after Task 2 replays differently (the changed state, rows as measured: week 1 ₹55,939 on 4,284 clicks against ₹78,247 on 6,536); a failed restore (make one by editing a save's `decisionLog` so `restoreSave` throws, confirmed in Node first); each with and without `?playtest=1`. At 375px nothing runs off the side. Measure the door's contrast by script. `?look=classic` shows today's panels, and the failed restore's panel.

- [ ] **Step 11: Commit.** "Draw the Studio's front door, and catch a restore that fails", with the owner's choice, the five states, the words that are new, and what played.

### Task 6: The playtest questions as a Results section

**Files:**
- Create: `ui/words/playtest.js`
- Modify: `ui/shell/sections.js` (a `playtest` section and `sectionsIn`'s option), `ui/shell/shell.js` (pass the option; the rail's Playtest button), `ui/results/render.js` (draw it; Play again moves there on the playtest link), `ui/app.js` (hand Results the recorder), `ui/recorder.js` (its classic panel reads the shared words), `ui/studio.css`
- Test: `tests/sections.test.js`, `tests/words.test.js`, `tests/ui.test.js`

**Interfaces:**
- Produces: `sectionsIn(area, { playtest = false } = {})`; `areaEntry(area, lastIn = {}, options = {})`, passing `options` to `sectionsIn`; section `{ key: 'playtest', area: 'results', label: 'Before you go', playtestOnly: true, opensAt: TOTAL_ROUNDS }`; `renderResults({ …, playtest: { recorder, onDownload } | null })`.

- [ ] **Step 1: Write the failing tests.** In `tests/sections.test.js`:

```js
describe('the playtest questions are a Results section on the playtest link only', () => {
  test('Results has four sections, and a fifth, "Before you go", on the playtest link', () => {
    expect(sectionsIn('results').map((s) => s.key)).toEqual(['twelve', 'learned', 'reveal', 'books']);
    expect(sectionsIn('results', { playtest: true }).map((s) => s.key)).toEqual(['twelve', 'learned', 'reveal', 'books', 'playtest']);
  });

  test('it opens after the last week, as the rest of Results does', () => {
    expect(SECTIONS.find((s) => s.key === 'playtest').opensAt).toBe(TOTAL_ROUNDS);
  });

  test('the rail\'s Playtest opens it after the last week, rather than downloading past the questions', () => {
    expect(read('ui/shell/shell.js')).toContain("open('playtest')");
  });

  test('the rail\'s Results goes back to it on the playtest link', () => {
    expect(areaEntry('results', { results: 'playtest' }, { playtest: true })).toBe('playtest');
    expect(areaEntry('results', { results: 'playtest' })).toBe('twelve');
  });
});
```

In `tests/words.test.js`, `import { PLAYTEST } from '../ui/words/playtest.js';` and:

```js
describe('the playtest questions are today\'s, in both looks (ui/words/playtest.js)', () => {
  test('each renders whole, and the questions are the ones testers have answered', () => {
    for (const [name, entry] of Object.entries(PLAYTEST)) expect(entry({}), name).not.toMatch(/undefined|NaN/);
    expect(PLAYTEST.lessons()).toBe('What three things did this game teach you? In your own words.');
    expect(PLAYTEST.confusing()).toBe('What confused or annoyed you?');
  });
});
```

Add `'words/playtest.js': () => import('../ui/words/playtest.js'),` to `LOADABLE`.

- [ ] **Step 2: Run them to see them fail.** Run: `npx vitest run tests/sections.test.js tests/words.test.js tests/ui.test.js`. Expected: FAIL.

- [ ] **Step 3: `ui/words/playtest.js`** (today's words from `ui/recorder.js` `renderPlaytestPanel`, moved so both looks share them):

```js
/**
 * The playtest link's questions and the file's note (ui/recorder.js), shared by
 * the classic panel and the Studio's "Before you go" until part 2 of the
 * switch-over removes the classic one.
 */

import { line } from './line.js';

export const PLAYTEST = Object.freeze({
  title: line('label', 'Before you go'),
  sub: line('label', 'for the playtest only'),
  lessons: line('instruction', 'What three things did this game teach you? In your own words.'),
  confusing: line('instruction', 'What confused or annoyed you?'),
  fileNote: line('reading', 'The file holds how long you spent on each screen, what you clicked, how many keys you '
    + 'pressed (not what they were), your answers, your saved game and your browser and screen size. Nothing has '
    + 'been sent anywhere: download it and send it back.'),
  download: line('label', 'Download the playtest file'),
  playAgainAfter: line('reading', 'Starting again clears the saved game the file carries, so send the file first.'),
});
```

  In `ui/recorder.js` `renderPlaytestPanel`, replace the four literals with `PLAYTEST.title()`, `PLAYTEST.sub()`, `PLAYTEST.lessons()`, `PLAYTEST.confusing()`, `PLAYTEST.fileNote()`, `PLAYTEST.download()`.

- [ ] **Step 4: The section.** In `ui/shell/sections.js` SECTIONS, after `books`:

```js
  // On the playtest link only (design/switch-over/, 2026-09-16): the questions
  // a tester answers before sending the file, as the last Results section
  // rather than a card under Everyone's books, where one who stops at the first
  // section never meets them.
  { key: 'playtest', area: 'results', label: 'Before you go', icon: ICONS.file,
    slots: [], draws: ['results-playtest'], opensAt: TOTAL_ROUNDS, playtestOnly: true },
```

  and `sectionsIn` becomes:

```js
/**
 * @param {string} area
 * @param {{playtest?: boolean}} [options] - on the playtest link, Results has "Before you go"
 * @returns {object[]} an area's sections, in order
 */
export function sectionsIn(area, { playtest = false } = {}) {
  return SECTIONS.filter((s) => s.area === area && (playtest || !s.playtestOnly));
}
```

  and `areaEntry` passes its options on:

```js
export function areaEntry(area, lastIn = {}, options = {}) {
  const inArea = sectionsIn(area, options);
  return inArea.find((s) => s.key === lastIn[area])?.key ?? inArea[0].key;
}
```

- [ ] **Step 5: The shell.** In `ui/shell/shell.js`: `drawList` calls `sectionsIn(view.area, { playtest: Boolean(onPlaytest) })` and the rail's area buttons `areaEntry(area.key, view.lastIn, { playtest: Boolean(onPlaytest) })`; the rail's Playtest button's listener becomes `() => (results && played() >= TOTAL_ROUNDS ? open('playtest') : onPlaytest())`, with a comment: after the last week it opens the questions, which the file carries, instead of downloading past them.

- [ ] **Step 6: Results draws it.** In `ui/results/render.js`:
  - `renderResults`' `playtest` becomes `{ recorder, onDownload } | null`, and `const questions = playtest ? playtest() : null;` goes;
  - `parts` gains `playtest: el('div', 'rs')`, and `drawers` gains `playtest: drawPlaytest`;
  - Play again's card becomes a function `playAgain()` (the `again` card's code as it is), and `drawBooks` ends `[warning, table, endRow]` where `endRow` holds `finish` and, if `playtest` is null, `playAgain()`, else a card with `next('playtest')`;
  - add:

```js
  // On the playtest link, the questions and the file, then Play again, which
  // clears the saved game the file carries (the review, 2026-09-16).
  function drawPlaytest() {
    if (!playtest) return;
    const box = card('rs-card', 'results-playtest');
    const ask = (id, question, rows) => {
      const wrap = el('label', 'rs-ask');
      const text = el('textarea', 'rs-answer');
      text.rows = rows;
      text.value = playtest.recorder.log().answers[id] ?? '';
      text.addEventListener('input', () => playtest.recorder.answer(id, text.value));
      wrap.append(el('span', null, question), text);
      return wrap;
    };
    const send = button('rs-pill', PLAYTEST.download());
    send.addEventListener('click', playtest.onDownload);
    box.append(ask('lessons', PLAYTEST.lessons(), 5), ask('confusing', PLAYTEST.confusing(), 3),
      el('p', 'rs-sub', PLAYTEST.fileNote()), send);
    const again = playAgain();
    again.append(el('p', 'rs-sub', PLAYTEST.playAgainAfter()));
    parts.playtest.replaceChildren(el('p', 'rs-sub', PLAYTEST.sub()), box, again);
  }
```

  In `ui/app.js` the Studio's `ending.playtest` becomes `recorder ? { recorder, onDownload: () => downloadPlaytestFile(recorder, storage) } : null`.
  In `ui/studio.css`, beside the Results block: `.rs-ask` (a column, gap 8px, 14px semibold soft label) and `.rs-answer` (the kit's text box: `border: 1px solid #68636B; border-radius: 12px; background: #141216; color: var(--studio-text); padding: 10px 12px; font: inherit; resize: vertical;`).

- [ ] **Step 7: Run the tests.** Run: `npx vitest run tests/sections.test.js tests/words.test.js tests/results.test.js tests/ui.test.js`, then `npm test`. Expected: PASS, exit 0.

- [ ] **Step 8: Play it** with `?playtest=1` on a finished save: Results lists "Before you go" with a dot; Everyone's books ends by pointing to it, with no Play again; answers typed survive switching sections; Download writes the file (the pane cannot download: post it to a one-off local receiver, `scratchpad/receive.mjs` on port 5174, as before) and the file carries the answers; Play again under the file starts round 0. The rail's Playtest after the last week opens the section; before week 12 it downloads at once. Without `?playtest=1` there is no fifth section and Play again stays in Everyone's books.

- [ ] **Step 9: Commit.** "Ask the playtest questions in their own Results section, with Play again after the file".

### Task 7: The playtest file names the version it was made on

**Files:**
- Create: `ui/version.js`
- Modify: `scripts/build-site.js`, `ui/recorder.js` (`load`, `emptyRecording`, `playtestFile`), `scripts/read-playtest.js`
- Test: `tests/recorder.test.js`, `tests/build.test.js`, `tests/ui.test.js`

**Interfaces:** `GAME_VERSION` (ui/version.js): `'dev'` in the repository; the build writes the short commit. `recording.versions: Array<{at: number, version: string}>`, one entry each time a load runs a version the last load did not.

- [ ] **Step 1: Write the failing tests.** In `tests/recorder.test.js` (its own `memoryStorage` and `clock`):

```js
describe('a recording names the versions it ran on (the switch-over, 2026-09-16)', () => {
  // A tester whose game spans a deploy sends one file from two versions; without
  // this, nothing in the file says where one ends.
  test('the first load notes its version, a second load on the same one adds nothing, a new one is noted', () => {
    const storage = memoryStorage();
    const now = clock();
    const first = createRecorder({ storage, now, version: 'abc1234' });
    first.load();
    createRecorder({ storage, now, version: 'abc1234' }).load();
    const third = createRecorder({ storage, now, version: 'def5678' });
    third.load();
    expect(third.log().versions.map((v) => v.version)).toEqual(['abc1234', 'def5678']);
  });
});
```

  In `tests/build.test.js`, in *the built copy runs*: `expect(readFileSync(join(out, 'ui/version.js'), 'utf8')).toMatch(/GAME_VERSION = '(?!dev')[0-9a-f]{7,}'/);`. Add `'version.js': () => import('../ui/version.js'),` to `LOADABLE`.

- [ ] **Step 2: Run them to see them fail.** Run: `npx vitest run tests/recorder.test.js tests/build.test.js tests/ui.test.js`. Expected: FAIL.

- [ ] **Step 3: `ui/version.js`.**

```js
/**
 * Which build of the game this is. `'dev'` in the repository; the build
 * (scripts/build-site.js) writes the commit it was built from, so a playtest
 * file can say which version each of its loads ran (ui/recorder.js).
 */
export const GAME_VERSION = 'dev';
```

- [ ] **Step 4: The build stamps it.** In `scripts/build-site.js` `buildSite`, after the files are copied:

```js
  // The commit this site was built from, so a playtest file names its version.
  // Cloudflare builds from a git checkout; anywhere else, 'unknown'.
  let commit = 'unknown';
  try {
    commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch { /* not a git checkout */ }
  writeFileSync(join(outDir, 'ui', 'version.js'), `export const GAME_VERSION = '${commit}';\n`);
```

  with `import { execFileSync } from 'node:child_process';` at the top.

- [ ] **Step 5: The recorder notes it.** In `ui/recorder.js`: `emptyRecording` gains `versions: []`; `createRecorder({ storage, now, version = GAME_VERSION })` (import it from `./version.js`); in `load()`, after `recording.loads.push(at);`:

```js
      recording.versions ??= [];
      if (recording.versions.at(-1)?.version !== version) recording.versions.push({ at, version });
```

  `playtestFile` adds `versions: log.versions ?? []`. In `scripts/read-playtest.js`, print a line `versions: <v1> from <time>, <v2> from <time>` when the file has more than one.

- [ ] **Step 6: Run the tests,** then `npm test`. Expected: PASS, exit 0. Run `npm run build` and read `dist/ui/version.js`: the short commit.

- [ ] **Step 7: Commit.** "Name the version a playtest file was made on, so a game that spans a deploy says so".

### Task 8: The Studio is the default look, in its colours from the first paint

**Files:** Modify `ui/look.js`, `ui/index.html`, `ui/app.js` (the body class), `ui/studio.css` (the loading line); Test `tests/look.test.js`.

- [ ] **Step 1: Write the failing tests.** `tests/look.test.js` becomes:

```js
/**
 * Which look a visit runs in. Since the switch-over (2026-09-16) the Studio is
 * the default; `?look=classic` still reaches the classic page until part 2
 * removes it, and this browser remembers that choice until `?look=studio`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test, expect } from 'vitest';
import { lookMode, LOOK_KEY } from '../ui/look.js';

const memory = () => {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) };
};

describe('the Studio is the default look', () => {
  test('a visit with nothing asked runs the Studio', () => {
    expect(lookMode('', memory())).toBe('studio');
  });

  test('the classic page is still reachable, and remembered', () => {
    const storage = memory();
    expect(lookMode('?look=classic', storage)).toBe('classic');
    expect(lookMode('', storage)).toBe('classic');
    expect(lookMode('?look=studio', storage)).toBe('studio');
    expect(lookMode('', storage)).toBe('studio');
  });

  test('a tester\'s remembered Studio from before the switch-over still reads as the Studio', () => {
    const storage = memory();
    storage.setItem(LOOK_KEY, 'studio');
    expect(lookMode('', storage)).toBe('studio');
  });

  test('a browser that will not store the choice gets what it asked for, or the Studio', () => {
    const refusing = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); }, removeItem: () => { throw new Error('no'); } };
    expect(lookMode('', refusing)).toBe('studio');
    expect(lookMode('?look=classic', refusing)).toBe('classic');
  });

  test('the page opens in the Studio\'s colours, before any script runs', () => {
    expect(readFileSync(fileURLToPath(new URL('../ui/index.html', import.meta.url)), 'utf8')).toMatch(/<body class="studio">/);
  });
});
```

- [ ] **Step 2: Run it to see it fail.** Run: `npx vitest run tests/look.test.js`. Expected: FAIL on the default.

- [ ] **Step 3: `ui/look.js`.**

```js
/**
 * Which look a visit runs in. Since the switch-over (2026-09-16, the owner's
 * choice) the Studio is the default; `?look=classic` reaches the classic page,
 * remembered in this browser until `?look=studio`, until part 2 removes it.
 */

export const LOOK_KEY = 'g-ads-simulation:look';

/**
 * @param {string} search - `location.search`
 * @param {Storage|null} storage
 * @returns {'classic'|'studio'}
 */
export function lookMode(search, storage) {
  const asked = new URLSearchParams(search).get('look');
  try {
    if (asked === 'classic') {
      storage?.setItem(LOOK_KEY, 'classic');
      return 'classic';
    }
    if (asked === 'studio') {
      storage?.removeItem(LOOK_KEY);
      return 'studio';
    }
    return storage?.getItem(LOOK_KEY) === 'classic' ? 'classic' : 'studio';
  } catch {
    // A browser that will not store the choice still came in on the link.
    return asked === 'classic' ? 'classic' : 'studio';
  }
}
```

- [ ] **Step 4: The first paint.** `ui/index.html:12` `<body>` becomes `<body class="studio">`; in `ui/app.js` the two lines `const look = …; if (look === 'studio') document.body.classList.add('studio');` become `const look = lookMode(window.location.search, storage);` and `document.body.classList.toggle('studio', look === 'studio');`. In `ui/studio.css` beside the door block: `body.studio .loading { display: grid; place-items: center; min-height: 100vh; margin: 0; color: var(--studio-faint); }` and `body.studio:has(.loading) .bar { display: none; }`.

- [ ] **Step 5: Run the tests,** then `npm test`. Expected: PASS, exit 0. Other tests that assumed the classic default (search `lookMode(` and `'classic'` in `tests/`) are updated to the Studio default in this commit.

- [ ] **Step 6: Play it.** Clear `g-ads-simulation:look`, open `/ui/`: the Studio's colours from the first frame (no classic header flash), round 0 in steps. `/ui/?look=classic`: the classic page, remembered on reload; `/ui/?look=studio` brings the Studio back. The built copy (`npm run preview`) opens in the Studio.

- [ ] **Step 7: Commit.** "Make the Studio the default look, in its colours from the first paint".

### Task 9: The records

**Files:** `HANDOVER.md`, `CLAUDE.md`, `plans/2026-09-13-studio-makeover.md` (section 10), `design/README.md` (`switch-over/`: what was built), the market measurements of Tasks 1-3.

- [ ] **Step 1:** HANDOVER: part 1 done (the three merges and their gates' figures, the context, the door, the playtest section, the version, the default), what part 2 holds, and the counts (`npm test` and `npm run build`'s files).
- [ ] **Step 2:** CLAUDE.md: the Studio is the default (the trap that says everything new sits under `?look=studio` until the switch-over); the shell builds its own context (`ui/shell/context.js`) and no longer the classic page; the build count; F17 and the rival fix are in makeover.
- [ ] **Step 3:** The makeover design's section 10: part 1 as built.
- [ ] **Step 4:** `npm test`, exit 0; commit "Record part 1 of the switch-over in HANDOVER, CLAUDE.md and the makeover design".
- [ ] **Step 5:** Write part 2's plan, and bring it to the owner.
