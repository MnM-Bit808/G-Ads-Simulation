# Prompt for the next session

*Written 2026-09-14. Paste everything below the line into a new Claude Code
session opened in this folder. If this date is old, HANDOVER's* Start here *is
the fresher source.*

---

You are picking up an ongoing project: a Google Ads search auction simulator, built as a learning tool for paid search. Vertical: athleisure and gym clothing, D2C, India. Nine advertisers (the player and eight rival policies) compete over twelve weekly rounds in three monthly budgets, each from one cell of a 3 × 2 positioning grid. Its value depends entirely on being honest about what it models: a simulator that teaches something false is worse than none. Accuracy outranks features.

The last session began a visual makeover, the **Studio makeover**, and ended with my request for this one: **drastic changes to round 0**, the setup page, which looks horrid in the new look.

## Read before doing anything

1. `CLAUDE.md`: the hard rules, the workflow and the known traps. Binding.
2. `HANDOVER.md`, section *Start here*: the 2026-09-14 block first; it is the context for this session.
3. `plans/2026-09-13-studio-makeover.md`, all of it: the makeover's design, which is the spec for the new look. Then `plans/2026-09-13-studio-makeover-plan.md`: the 11-task build plan; Tasks 1 and 2 are done.
4. `reviews/slc-review.md`: section 5 (*Simple*, round 0's measurements), section 12 recommendation 4 (*round 0 as a guided sequence*), section 13 (motion).
5. The design canvas https://claude.ai/code/artifact/d881fe56-251c-4ded-9173-b8616924bbc4 and `design/README.md`: the working mock-up of *Your keywords* in Red signal, and how it was drawn. `design/` also holds round 0's artboards from an earlier pass (`Market`, `Main` (the map), `Position`, `Grid`, `Spend`, `Account`).
6. `ui/round-zero.js` and `setup.js`: what round 0 asks today. Look DECISIONS entries up by ID as they come up (I11 the writer, D10 the weekly split, C5 positioning, I25 the writer's copy); don't read it front to back.
7. `git log --oneline -15`, and read the last few commit messages in full.

Then confirm you are on the branch `makeover` (`git branch --show-current`), run `npm test` (expect 1664 passing, 1 todo) and `npm run build` (expect 62 files), and tell me in a few lines that you have caught up.

## Who I am, and how to work with me

* I'm relatively new to development. Explain in plain language. A working file I can't follow is a failure even if the tests pass.
* I decide by seeing. Mock-ups on the design canvas, with real game content, beat descriptions.
* Plan before code. Design work goes through the brainstorming skill: one question at a time, then 2–3 options with a recommendation, then a design doc in `plans/`, a task plan (writing-plans), and the build inline, one task at a time, each after my go-ahead.
* Ask rather than assume; push back when something is wrong, including something I asked for. Give a recommendation, not a survey.
* Tests first. One concern per commit, present tense, with the reasoning in the message. Check `npm test`'s exit code before committing; never commit red.
* Pushing to `main` deploys to the live site. Push nothing, `makeover` included, until I say.
* "It works" means playing it in the browser pane on the dev server, not just green tests. Measure contrast by script, not by eye.
* Edit files with the Edit tool, not shell heredocs (Windows, CRLF).
* Never put a real-world claim in the game or the guide from memory: fetch the source and cite it.
* Anything that moves the market is measured before and after with `scripts/market-harness.js`, against gates we agree first. Downloads need my yes first, with names and sizes.

## Where things stand (2026-09-14)

* **Live site unchanged** (`387baf1`, invite-only). `main` is at `80d41e6`: the makeover's design doc, canvas sources and build plan, not pushed. The branch `makeover` adds Task 1 (`644d79b`: `?look=studio`, and today's cards re-themed in Red signal) and Task 2 (`f80d2ff`: the two fonts stored with the game; the build follows `url()` inside stylesheets). Nothing is pushed. The tag `playtest-2` exists on this computer only.
* **The stranger playtests are parked** by my choice. Tester 1's file was never handed over.
* **Decided about the makeover. Don't re-open these:**
  * a sidebar app shell, one section at a time (icon strip, section list, tray), like Claude's app;
  * its own game world, with plain section names, not Google Ads' layout;
  * Studio drop's cards and type (Bricolage Grotesque, Instrument Sans);
  * the **Red signal** palette: red means *you and your changes*, so warnings and losses are amber with a minus sign;
  * only six motions (the tray, revised figures, a section unlocking, round 0's steps, pressing Run week, drawers and the menu), each 300ms or less, transform and opacity only, with reduced motion keeping only the fades;
  * controls show only what the engine computes;
  * everything behind `?look=studio` on `makeover`; the classic game is untouched until the switch-over.
* **The plan's order was** the shell, then *Your keywords* as the pilot, then the other sections, with round 0 as guided steps seventh (design doc section 7). I've now asked for round 0 first.

## What needs doing

1. **Round 0, drastically redesigned, in the Studio look.** Use the brainstorming skill. First look at it yourself (`npm run dev`, then http://localhost:5173/ui/?look=studio; "Start a new game" overwrites the dev browser's save) and tell me what is horrid, with measurements. The review's baselines: 2,633 words, 11 sections, 97 buttons, 18 minutes of a 28-minute game. Bring these to me as options, not decisions:
   * **Recommendation 4's shape:**
     * five guided steps: the market and the rivals' ads (read only); position; keywords; the ad (a starter draft, graded live, live from week 1); budget, then Go;
     * capital defaults to "keep it";
     * the weekly split and the redo go behind "advanced";
     * the brand is assigned, not picked.

     It re-opens **I11** (who writes the ad), with the new evidence recommendation 4 lists.
   * **Where round 0 lives:** inside the sidebar shell (the design doc's plan: the section list becomes its steps), or as a full-screen setup flow of its own that hands over to the shell.
   * **Sequencing:** round 0 would reuse the pilot's pieces (keyword cards, the planner drawer, the slider, the tray). That argues for building the shell (plan Tasks 3–5) and those pieces (Tasks 7–8) first, or for building round 0's own versions now. Recommend one.
   * **The India map** ("Where the search happens") and its four endless animations: keep, restyle, or cut.

   Mock the options up on the canvas (the `design` skill), in Red signal, with real round 0 content: `content/brands.js`, `content/adCopy.js`, the query set, the map. Never invented figures.
2. **Then** a design doc in `plans/`, a task plan, and the build on `makeover`, one task at a time with my go-ahead.
3. **Then the rest of the Studio plan** (Tasks 3–11), in whatever order we agree.

## Do not re-propose without new evidence

Moving the capital window to week 7 (D12). A January or festive-season event (F16). Capital carry-over. Grade-matched writer copy, symmetric broad match, retagging the vague lifestyle searches, extra volume for performance. The real Google Ads layout for the shell. The Streetlight palette. Animating the week playing out.

## Traps worth knowing before you touch anything

* The ones in CLAUDE.md.
* **Today's cards are filtered, never moved.** The decision form redraws all its cards into its own region on every change, so the Studio shell shows today's cards by filtering them per section (CSS on `data-slot`). A moved card would be drawn into nothing.
* **The weekly screen has no ad card.** The ad is edited only in round 0, and its grades show inside each keyword's Quality Score.
* **`style.css` uses the accent as a text colour** in 14 places, and red at text size measures 3.6:1. `ui/studio.css` gives those the small-text red `#FF6166`. The contrast-measuring approach is in commit `644d79b`'s message.
* **Round 0 in the studio look:** the chosen brand card has a mint border, from an old rule that uses `var(--good)` for "chosen". That is part of why it looks wrong.
* **Every new `ui/` module joins `LOADABLE`** in `tests/ui.test.js`, and must not touch `document` or `window` while loading (`tests/build.test.js` imports every module in Node).
* **The build follows `url()` inside stylesheets**, which is how `ui/fonts/` is published. `RUNTIME` in `tests/build.test.js` allows `ui/fonts/*.woff2|txt`.
* **The words test** forbids digits inside `ui/words/` strings. The plan's Task 5 adds a guard against sentences in new drawing modules.
* **Using the design canvas:**
  * seed it with the `design` skill's helper and publish with `contract: "0.1.31"` and capabilities `{self, downloads}`;
  * the browser pane can't open `file://`, so copy the seeded file to `design/makeover/_preview.html`, open it through the dev server, and delete it afterwards;
  * scrolling inside an artboard can't be scripted, so check tall content with a temporary taller copy.
* **The browser pane:** a first screenshot is often blank, so take another. Hidden panes pause transitions. "Start a new game" overwrites the dev browser's save.
* Tests that replay whole games need `{ timeout: 60_000 }`. The full suite takes about 2 minutes.

## Useful commands

```
npm test                                     lint, then the whole suite
npm run ci                                   what Cloudflare runs: lint, suite, build
npm run dev                                  the dev server; add ?look=studio for the new look
npm run build                                builds dist/ and prints the file count
node scripts/market-harness.js market <label> 12
node scripts/read-playtest.js <files>
```

Start by confirming you've caught up, the branch and the test count. Then look at round 0 in the studio look, and ask me your first question about it.
