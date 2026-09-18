# The switch-over, part 2: the classic look goes

*Plan, 2026-09-16. Part 1 is built (`plans/2026-09-16-switch-over-plan.md`,
`638cf47`..`4d55bb6`): the Studio is the default look, and `?look=classic` still
reaches today's page. This plan removes that page, its code, and the link — and
ends in the deploy that puts the Studio in front of real players.*

**Design:** `design/switch-over/` (canvas
https://claude.ai/code/artifact/54dadd5c-e4db-43fd-90ef-dd8117aa2c19), page 2,
*What goes live*; and `plans/2026-09-13-studio-makeover.md` section 7, item 9.

**The owner's two decisions, 2026-09-16:**
1. **Delete first, deploy once.** A live site where the Studio is default but
   `?look=classic` still works is a state nobody needs, and it doubles what a
   playtester might land on.
2. **Cut off, then carve.** First make the classic look unreachable, so the
   Studio is the only thing that runs; then take the dead regions out of the
   shared files one at a time, with the suite green between each.

## What this actually is, and why the shape changed

The design said "about 4,500 lines". An inventory of the branch (2026-09-16)
found that **only two files are wholly classic**:

| File | Lines | Note |
|---|---|---|
| `ui/look.js` | 37 | Only `ui/app.js:39` and `tests/look.test.js` import it. |
| `ui/round-zero.js` | 1,362 | Held alive by ONE import: `ui/debrief/render.js:17` takes `serpBlock` from it. |

Everything else assumed classic is **shared with the Studio** and cannot be
deleted: `ui/dashboard.js` (7 Studio importers), `ui/decisions.js` (10),
`ui/ending.js` (4), `ui/chart.js` (3), `ui/dom.js`, `ui/style.css`,
`ui/debrief/`. So the work is carving classic-only REGIONS out of six shared
files: about 3,300 lines with confidence, plausibly near 5,000 once
`ui/decisions.js` and `ui/style.css` are audited properly.

**The trap this plan exists to avoid.** The classic `<header class="bar">` is
not inert. `ui/app.js` writes to `#brand`, `#position`, `#round-label`, `#next`,
`#redo` and `#guide` on EVERY render in both looks (`chrome()`, `ui/app.js:272`;
`offerResume`, `561-566`); the Studio merely hides the header with CSS
(`ui/studio.css:139`). Deleting the markup without stripping that wiring breaks
the Studio, not the classic page. Task 1 does both in one commit for that
reason.

**Three things verified by hand before this plan was written**, because the
inventory was unsure:
- `creativeOf` (`ui/dashboard.js:186`) is a private classic helper. The Studio
  calls `creativeOutlook(creative, round)` with its own `creative`
  (`ui/week/render.js:69`), so deleting `creativeOf` is safe.
- The guide drawer reads `document.querySelector('.bar')` to sit below the
  header (`ui/guide/drawer.js:159`). In the Studio the header is
  `display: none`, so its `getBoundingClientRect().bottom` is already **0** —
  measured in the browser — which is exactly what the null guard gives when the
  element is gone. Removing it changes nothing.
- `serpBlock` is used at one site outside `round-zero.js`
  (`ui/debrief/render.js:329`), inside `renderReveal`, which only
  `ui/ending.js:364` calls. The Studio draws its own reveal with `serp()` from
  `ui/kit/serp.js` (`ui/results/render.js:509`).

## Global constraints

- **Tests first, then the change. Never commit red:** check `npm test`'s exit
  code, not the scroll-back.
- **One concern per commit**, present tense, the reasoning in the message,
  ending `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Commit with
  `git commit -F <file>` (PowerShell splits here-strings).
- **Edit with the Edit tool**, never shell heredocs (Windows, CRLF).
- **"It works" means playing it** on the dev server in the browser pane, not
  green tests. After every task that touches `ui/app.js`, `ui/index.html` or
  `ui/style.css`, play: round 0 → week 1 → reload → resume → a section in each
  area → the guide drawer and page.
- **Nothing is pushed** until the owner says so, this branch included. The final
  task's deploy runs only on their word.
- **`makeover` is shared.** Other sessions merge and push it in this same
  folder. Re-check `git log -3 makeover` and `git fetch` immediately before
  every commit.
- **Delete a number's ledger entry when the number goes** (hard rule 7). No
  `CALIBRATE` constant is touched by this plan.

## Gates

| Gate | What it holds | How |
|---|---|---|
| **G1** | No engine behaviour changes. | `engine/`, `game.js`, `setup.js`, `agents/` and `content/` are untouched by every task. `git diff --stat` on each commit proves it. No harness run is needed, and none is planned. |
| **G2** | The tools that read past playtests keep working. | `scripts/read-playtest.js` imports `finalStandings`/`gameTotals` from `ui/ending.js` and `rupees` from `ui/dom.js`; `scripts/market-harness.js:43` imports the same two. After every task that touches those files, run `node scripts/read-playtest.js <sample>` and see a full report. Keep a sample at `scratchpad/sample-playtest.json` (Task 1, step 1). |
| **G3** | The game still plays. | The play-through above, after each task that can reach the screen. |
| **G4** | Nothing dead ships. | `npm run build` after each carve task; the file count falls and `tests/build.test.js` holds `dist/` to what the page imports. |

---

## Task 1: The page stops offering the classic look

The cut-off. After this commit no player can reach the classic page, round 0 or
end screen, and the Studio no longer depends on classic markup.

**Files:**
- Modify: `ui/app.js`, `ui/index.html`
- Delete: `ui/look.js`, `tests/look.test.js`
- Test: `tests/ui.test.js`, `tests/sections.test.js`, `tests/guide.test.js`

- [ ] **Step 1: Tag the way back, and keep a sample playtest file.** Before
      anything is deleted:

```bash
git tag classic-last 4d55bb6 -m "The last commit where the classic look runs"
```

  Then make a sample playtest file for G2 — play two weeks on
  `http://localhost:5173/ui/?playtest=1`, and in the pane post it to the
  scratchpad receiver (`scratchpad/receive.mjs`, port 5174) rather than
  downloading, which the pane cannot do. Save it as
  `scratchpad/sample-playtest.json` and check it reads:
  `node scripts/read-playtest.js scratchpad/sample-playtest.json`.

- [ ] **Step 2: Write the failing tests.** In `tests/ui.test.js`, remove
      `'look.js': () => import('../ui/look.js'),` from `LOADABLE`.

  In `tests/sections.test.js`, `CARD_SLOTS` (lines 24-28) reads the classic
  markup out of `ui/index.html`. Replace the fixture and the two tests that use
  it with one that reads the Studio's own parts, so the guarantee survives the
  markup:

```js
// Every slot a Studio section says it draws, and every slot its module really
// sets. Until part 2 this read the classic page's cards out of ui/index.html;
// the page no longer has them, and a section's own parts are the thing that
// has to agree with SECTIONS.
const DRAWN_SLOTS = [...new Set(SECTIONS.flatMap((s) => s.draws ?? []))];

test('every slot a section claims to draw is set by the module that draws it', () => {
  for (const s of SECTIONS) {
    for (const slot of s.draws ?? []) {
      expect(read(DRAWN_BY[s.key]), `${s.key} draws ${slot}`).toContain(`'${slot}'`);
    }
  }
  expect(DRAWN_SLOTS.length).toBeGreaterThan(18);
});
```

  In `tests/guide.test.js`, the `test.each(entries)` at line 132 validates each
  chapter's `yourAccount` against `ui/index.html` and `ui/decisions.js`. The
  page is going, so it validates against the Studio instead — the section that
  holds the slot, and the module that draws it:

```js
// A chapter's "Show me" must land on a part that exists. It used to be checked
// against the classic page's cards; since part 2 the Studio is the only place
// a slot can live, so the check is: some section holds it, and that section's
// own module sets it.
test.each(Object.entries(CHAPTERS))('%s points at a part the Studio really draws', (_, c) => {
  const slot = c.studioAccount ?? c.yourAccount;
  const section = sectionOf(slot);
  expect(section, slot).not.toBeNull();
  expect(read(DRAWN_BY[section.key]), `${section.key} draws ${slot}`).toContain(`'${slot}'`);
});
```

- [ ] **Step 3: Run them to see them fail.**
      `npx vitest run tests/ui.test.js tests/sections.test.js tests/guide.test.js`.
      Expected: FAIL on the missing `look.js` entry and on the new assertions.

- [ ] **Step 4: `ui/app.js`.** Remove, in this order:
  - the imports `renderRoundZero` (line 27), `renderDashboard` (28),
    `renderEnding` (30), `renderPlaytestPanel` (from the `./recorder.js` group,
    35), `lookMode` (39);
  - `const nextButton/redoButton/guideButton` (56-58) and
    `const playtestButton` (123);
  - `guideButton.addEventListener` (88), `nextButton.addEventListener`
    (496-…), `redoButton.addEventListener` (705), `playtestButton.hidden` /
    its listener (712-713);
  - `inStudio: () => look === 'studio'` (80) becomes `inStudio: () => true`;
  - `const look = …` and `document.body.classList.toggle` (110-113), and the
    comment above them: the page is served as `body.studio` and nothing takes
    it off now;
  - `chrome()` (272-309) and its call (356), and `commitLabel()` (317-…),
    which only `chrome` and the classic dashboard callback use;
  - in `render()`, the `if (look === 'studio') { … } else { … }` around round 0
    (360-378) keeps only the Studio arm; the `if (look === 'studio')` around the
    shell (381-401) keeps only its arm, and everything from
    `const dashboard = renderDashboard(` to the end of `render()` (403-416)
    goes, along with `endingNodes()` (419-442);
  - `panel`, `showPanel`, `choice` (509-530) and every classic arm that uses
    them: `offerResume`'s lines 561-566 and 582-595, and in `resume()` the
    `else` arms at 606-612, the `warn` block at 653-663, and the `else` at
    669-674. `door` is then always truthy, so the `if (door)` guards collapse.
  - `sendPlaytestFile` (459-464) loses its `#playtest-panel` branch and becomes
    `downloadPlaytestFile(recorder, storage)` — in the Studio the rail's button
    opens "Before you go" after the last week (`ui/shell/shell.js`), and before
    it the file is what a tester wants.

  **Check nothing else reads the header**: `grep -n "getElementById('next'\|'redo'\|'guide'\|'brand'\|'position'\|'round-label'\|'playtest'" ui/` must return nothing.

- [ ] **Step 5: `ui/index.html`.** Delete the header (lines 14-26) and the
      `<template id="tpl-dashboard">` (32-128). Keep: the two stylesheets and
      the font licence links (7-10, held by `tests/build.test.js:41`),
      `<body class="studio">` (12), `<main id="app">` with its loading line
      (28-30), and the module script (130).

- [ ] **Step 6: Delete `ui/look.js` and `tests/look.test.js`.** The Studio is
      not a mode any more, so there is nothing to choose. Note in the commit
      message that `g-ads-simulation:look` is left in players' browsers and is
      simply never read again — clearing it would mean shipping code whose only
      job is to delete a key nobody reads.

- [ ] **Step 7: Run the tests,** then `npm test`. Expected: PASS, exit 0.
      Then `npm run build` (G4) and
      `node scripts/read-playtest.js scratchpad/sample-playtest.json` (G2).

- [ ] **Step 8: Play it** (G3). `http://localhost:5173/ui/`: round 0's five
      steps → Go → week 1 runs; reload → the front door → resume; a section in
      Brand, Market, Guide; the guide drawer from a "why?" link (it must sit at
      the top of the page, not under a gap where the header was); the playtest
      link's rail button. Then `http://localhost:5173/ui/?look=classic` — it
      must give the Studio, because the parameter now means nothing.

- [ ] **Step 9: Commit.** "Stop offering the classic look, and take the
      Studio off the classic page's markup".

---

## Task 2: The classic end screen goes

**Files:** Modify `ui/ending.js` (delete 356-670), `ui/debrief/render.js`
(delete `renderDebrief` 74-173 and `renderReveal` 319-408, and the
`serpBlock` import at 17); Test `tests/ending.test.js`, `tests/debrief.test.js`.

This is the task that frees `ui/round-zero.js`.

- [ ] **Step 1:** Confirm the call sites are gone: `grep -rn "renderEnding\|renderDebrief\|renderReveal" ui/ tests/ scripts/` should name only the definitions after Task 1.
- [ ] **Step 2:** Delete `renderEnding` and its private helpers (`restartCard`,
      `option`, `card`, `standingsCard`, `headlineCard`, `weeksCard`,
      `accountCard`, `decisionsCard`), keeping `STRATEGY_NAMES`, `rankOf`,
      `finalStandings`, `gameTotals`, `summariseDecisions` — all four are used
      by the Studio and by `scripts/`.
- [ ] **Step 3:** Delete `renderDebrief` and `renderReveal` from
      `ui/debrief/render.js`, keeping `budgetLines` and `lessonSentence`
      (`ui/results/render.js:37`). Remove the now-unused `serpBlock` import and
      any `ui/dom.js` import the deleted code alone used.
- [ ] **Step 4:** `npm test`, exit 0. Then G2: the playtest reader again, which
      is the tool that leans hardest on `ui/ending.js`.
- [ ] **Step 5: Commit.** "Delete the classic end screen, which nothing draws".

---

## Task 3: `ui/round-zero.js` goes

**Files:** Delete `ui/round-zero.js` (1,362 lines); Test
`tests/roundZero.test.js` (delete, 35 tests), `tests/roundZeroRules.test.js`
(drop its first describe), `tests/ui.test.js`.

- [ ] **Step 1:** Prove it is an orphan: `grep -rn "round-zero.js" ui/ tests/ scripts/` names only the two test files.
- [ ] **Step 2:** `tests/roundZeroRules.test.js` imports
      `* as classic from '../ui/round-zero.js'` at line 7 and asserts six
      re-exports equal `ui/roundzero/rules.js`'s own. Those re-exports exist only
      for that test. Delete the import and the `describe` at 20-25; **keep the
      other 36 tests**, which are about `rules.js` and are the shared source of
      round 0's figures for both looks.
- [ ] **Step 3:** Delete `tests/roundZero.test.js` entirely — every one of its
      35 tests drives the classic page. Read it once first for any rule it holds
      that `tests/roundZeroLook.test.js` does not; if one exists, move it there
      rather than lose it.
- [ ] **Step 4:** `tests/ui.test.js`: drop `round-zero.js` from `LOADABLE` and
      from the render-function test at line 284.
- [ ] **Step 5:** `npm test`, exit 0; `npm run build` — the file count falls.
- [ ] **Step 6: Commit.** "Delete the classic round 0, 1,362 lines nothing
      imports".

---

## Task 4: `ui/dashboard.js` keeps only what the Studio reads

**Files:** Modify `ui/dashboard.js` (~955 of 1,207 lines go); Test
`tests/dashboard.test.js`.

**Keep** (Studio importers, verified): `SETTLES_AFTER_ROUNDS`,
`RETURNS_RESOLVE_AFTER_ROUNDS`, `ARRIVAL_SHAPE`, `allocationWindowPhrase`,
`creativeOutlook`, `accumulate`, `formContext` and its helper
`spentByWeekOfMonth`.

**Delete**: `renderDashboard` (1157), `rankSentence` (104), `profitSubLabel`
(128), `creativeOf` (186), and the private card renderers at 142-213, 240-640
and 694-1090.

- [ ] **Step 1:** For each name above, `grep -rn "<name>" ui/ scripts/ tests/`
      and confirm the only hits are inside `ui/dashboard.js` and
      `tests/dashboard.test.js`. Anything with another caller stays — the
      inventory was confident here, but confidence is not a grep.
- [ ] **Step 2:** Delete, then let the linter find the rest: `npx eslint .`
      reports every helper left unused. Repeat until clean.
- [ ] **Step 3:** `tests/dashboard.test.js`: drop the describes for
      `rankSentence` (208), `profitSubLabel` (232) and the rank-sentence month
      (256), about 8 tests. Keep `creativeOutlook`, `allocationWindowPhrase`,
      `formContext` and the prepaid tests.
- [ ] **Step 4:** `npm test`, exit 0. Play a week (G3): `formContext` and
      `accumulate` are what the Studio's own context is built from.
- [ ] **Step 5: Commit.** "Take the classic cards out of ui/dashboard.js,
      keeping what the Studio reads".

---

## Task 5: `ui/decisions.js` keeps only the draft and its rules

**Files:** Modify `ui/decisions.js` (3,047 lines; ~1,100-1,200 go); Test
`tests/decisions.test.js` (139 tests).

**This is the least certain file in the plan and the one to go slowly in.** The
inventory's own note: `negativesOutlook` is called at line 992 as well as inside
the render region, and `STRATEGY_PARAM` is used at 414 and 1160, outside it. The
method matters more than any list:

- [ ] **Step 1:** Delete `renderDecisions` (1673) alone, commit nothing, and run
      `npx eslint .`. Every now-unused private function is reported. Delete the
      reported ones, re-run, repeat until the linter is clean. This finds the
      boundary rather than guessing it.
- [ ] **Step 2:** For every EXPORT the linter cannot judge, check for importers:
      `grep -rn "from '.*decisions.js'" ui/ scripts/ tests/` lists the ten
      Studio importers; read what each takes. An export nobody imports and
      nothing inside the file calls is dead; an export only
      `tests/decisions.test.js` imports is a test of dead code — say so in the
      commit message and delete both.
- [ ] **Step 3:** Run `npm test` after each deletion round, not at the end. 139
      tests live here and most exercise pure draft logic the Studio uses; a red
      run names the mistake immediately.
- [ ] **Step 4:** Play the form's own path (G3): stage a bid change, a block, a
      capital decision at week 5, undo each from the tray, run the week.
- [ ] **Step 5: Commit.** "Take the classic form out of ui/decisions.js, keeping
      the draft every Studio section stages into".

---

## Task 6: `ui/chart.js` and `ui/dom.js` lose what nothing calls

**Files:** Modify `ui/chart.js` (~223 of 486), `ui/dom.js` (~99 of 145); Test
`tests/chart.test.js`.

- [ ] **Step 1:** `ui/chart.js`: delete `renderTrends` (345), `CHART_METRICS`
      (40), `seriesFor` (93) and the privates `METRIC_BY_KEY`, `BOX`, `visible`,
      `plot`, `legend`. Keep `marketOutlook`, `isMove`, `insightMovers`,
      `marketChange`, `readingOf` — all read by `ui/rivals/`. Confirm
      `marketOutlook` does not call `seriesFor` (it does not).
- [ ] **Step 2:** `tests/chart.test.js`: drop the describes at 43 and 62 (about
      12 tests); keep `marketOutlook` and `marketChange`.
- [ ] **Step 3:** `ui/dom.js`: delete `table` (47), `scrollX` (85), `figure`
      (92), `field` (110), `input` (125), `select` (135) **only if** the greps
      after Tasks 2, 4 and 5 show no importer left. `el`, `add`, `rupees`,
      `whole`, `pct`, `ratio` stay — `scripts/read-playtest.js` uses `rupees`
      (G2).
- [ ] **Step 4:** `npm test`, exit 0; the playtest reader again (G2).
- [ ] **Step 5: Commit.** "Delete the trends chart and the DOM helpers only the
      classic page used".

---

## Task 7: The shell stops filtering cards that no longer exist

**Files:** Modify `ui/shell/sections.js` (`RETIRED_SLOTS` 99-102,
`visibilityRules` 189), `ui/shell/shell.js` (its call at 58), `ui/studio.css`
(the injected rules); Test `tests/sections.test.js`.

Every `SECTIONS` entry now has `slots: []`, so `visibilityRules()` emits rules
that match nothing: the mechanism the makeover was built on ("filter today's
cards, never move them") has no cards left to filter.

- [ ] **Step 1:** Delete the `describe('a section is a filter over today\'s
      page')` block from `tests/sections.test.js`, and any assertion that
      `RETIRED_SLOTS` is non-empty.
- [ ] **Step 2:** Delete `RETIRED_SLOTS` and `visibilityRules` and the call in
      `ui/shell/shell.js`. Check whether `sectionOf` still needs `s.slots` at
      all: if every section draws its own parts, `slots` can go from the
      `SECTIONS` entries too — but only if no test or module reads it.
- [ ] **Step 3:** `npm test`, exit 0; play a section in each area (G3), because
      this removes a stylesheet the shell injects at run time.
- [ ] **Step 4: Commit.** "Stop hiding classic cards, there being none left".

---

## Task 8: `ui/style.css` keeps the base the Studio stands on

**Files:** Modify `ui/style.css` (1,581 lines; ~700-850 go); Test
`tests/build.test.js`.

`ui/studio.css` is scoped under `body.studio` but resolves tokens and inherits
base rules from `style.css`. **Keep, verified:** `:root` (10-25), `body`
(26-32), `button` (53-64) with `.ghost` and `:disabled`, layout (`main`,
`.loading`, `.grid`, `.span-*` and the two media queries, 68-105), tables
(174-227), cards (107-134), the whole guide drawer block (1315-1500), and the
smaller shared ones: `tr.you` (809), `.chip` (621-642), `.quality-part.*`
(1106), `.rival-grid` (668), and in the debrief block `.moments` (1506),
`.lesson*` (1524-1528), `button.replay` (1519).

**Delete:** `.bar`/`.identity`/`.round-nav` (33-51), `.figures`/`.figure`
(135-158), `.bars`/`.bar-row`/`.track`/`.fill` (159-170), `.revision` (250),
`.burn` (260), the `.serp-*` block (328-359), the whole round-0 block
(407-~658), and most of 676-1314.

- [ ] **Step 1: Do not delete by eye.** Write
      `scratchpad/selector-audit.mjs`: collect every class name the Studio
      emits — `el('x', 'a b')`, `classList.add`, `className =`, template
      literals — across `ui/**/*.js` minus the deleted files, plus every
      selector `ui/studio.css` mentions; then list the `ui/style.css` selectors
      matched by none of them. That list is the candidate set, and it is the
      only honest way to treat 1,581 lines.
- [ ] **Step 2:** Read the candidate list by hand before deleting: a selector
      can be emitted by a string this scan cannot see. Where in doubt, keep it
      and say so in the commit message — an unused rule costs bytes, a deleted
      one costs a broken screen.
- [ ] **Step 3:** Delete, then **measure contrast by script, not by eye**, on
      the screens most likely to have leaned on a deleted rule: round 0, a
      weekly section, the guide drawer and page, Results. Lowest measured value
      goes in the commit message.
- [ ] **Step 4:** `npm test`, exit 0; `npm run build`; play every area (G3) at
      1280px and 375px.
- [ ] **Step 5: Commit.** "Cut ui/style.css to the base the Studio stands on".

---

## Task 9: The records

**Files:** `HANDOVER.md`, `CLAUDE.md`, `plans/2026-09-13-studio-makeover.md`
(section 10), `design/README.md`, `wrangler.jsonc` (its comment), `DECISIONS.md`
(dated notes only).

- [ ] **Step 1:** HANDOVER: part 2 done; the classic look and the link gone;
      what a reader should no longer look for; the tag `classic-last` and what
      it is for; the counts (`npm test`, `npm run build`).
- [ ] **Step 2:** CLAUDE.md: the traps that describe two looks. The filtering
      trap ("the Studio makeover filters today's cards, it never moves them")
      describes a mechanism that no longer exists — replace it with what is now
      true, rather than deleting the paragraph and losing the reason the Studio
      is shaped as it is. Same for the round-0 rules trap ("both looks read
      them") and the drawing-guard trap.
- [ ] **Step 3:** The makeover design's section 10 and `design/README.md`: part
      2 as built, with the real line count from `git diff --stat classic-last`.
- [ ] **Step 4: `wrangler.jsonc`'s comment** says "the 54 files the game loads",
      which is `main`'s count and about to be wrong on the branch that deploys.
      Correct it to what `npm run build` reports. The JSON itself does not
      change — `tests/build.test.js` reads this file as plain JSON, so keep
      full-line comments only.
- [ ] **Step 5: `DECISIONS.md` gets dated notes, not rewrites.** Several entries
      say in the present tense that the classic page does something (I25 at
      ~3537, I34 at ~4487-4509, I35 at ~4536-4558). The ledger records what was
      decided and when, so the entry stays as written and gains a dated line
      saying the classic page is gone and which Studio module now carries the
      behaviour. Do not delete a `DECISIONS` entry for a rule that still holds.
- [ ] **Step 6:** `npm test`, exit 0. **Commit.** "Record part 2: the classic
      look is gone".

---

## Task 10: The deploy

**This task runs only on the owner's word, and it is the one that goes live.**

- [ ] **Step 1: Save the version the playtesters played, before `main` moves.**
      `playtest-2` (`387baf1`) exists on this computer only — `git ls-remote
      --tags origin` shows the remote has `playtest-1` and nothing else. Once
      `main` moves, the code those recordings were made on is reachable only by
      commit id. So: push `playtest-2`, and tag the commit the live site is
      serving now (`git tag live-before-studio <origin/main>`) and push that
      too. A playtest file is read by checking out the tag it was played on
      (`scripts/read-playtest.js`'s own note), so this is the difference between
      a readable recording and a lost one.
- [ ] **Step 2:** `git fetch`, and check what `main` has that `makeover` does
      not: other sessions merge fixes into `main` in this folder. Merge `main`
      into `makeover` first if it has moved, and run the suite on the result.
- [ ] **Step 3:** Show the owner what the deploy contains: `git log --oneline main..makeover`, the test and file counts, and the fact that every playtester's saved game will be replayed by this code the next time they open it.
- [ ] **Step 4:** On their yes: merge `makeover` into `main`, run `npm run ci`
      locally (lint, suite, build) and check the exit code before pushing.
- [ ] **Step 5:** Push `main`. Cloudflare runs `npm run ci` again and publishes
      only if it passes.
- [ ] **Step 6:** Play the live site: round 0, a week, a reload and resume, on
      the deployed URL rather than localhost.
- [ ] **Step 7:** Tag the release, and tell the playtesters. Their saved games
      are on the old code: a save made before the deploy replays on the new
      engine, and where F17 changes it the front door says so — which is what
      the front door was built for.

---

## What this plan does NOT do

- **It does not touch the engine.** F17, the rival prepaid fix and F18/I36 are
  already merged and measured; no market moves here, so no harness run is
  planned. If a task turns out to touch `engine/`, stop: that is a different
  plan with its own gates.
- **It does not remove the playtest recorder or the `?playtest=1` link.** Those
  are stage B's, still in use.
- **It does not settle the open questions** in HANDOVER: the landing page's
  timing, capital not counted in net profit, returns that settle after week 12.
  Each is the owner's, and each is a change to what the game teaches rather than
  to what it looks like.
