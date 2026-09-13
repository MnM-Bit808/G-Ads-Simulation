# Prompt for the next session

*Written 2026-09-13. Paste everything below the line into a new Claude Code
session opened in this folder. If this date is old, HANDOVER's* Start here *is
the fresher source.*

---

You are picking up an ongoing project: a Google Ads search auction simulator,
built as a learning tool for paid search. Vertical: athleisure and gym clothing,
D2C, India. Nine advertisers (the player and eight rival policies) compete over
twelve weekly rounds in three monthly budgets, each from one cell of a 3 × 2
positioning grid. Its value depends entirely on being honest about what it
models: a simulator that teaches something false is worse than none. Accuracy
outranks features.

## Read before doing anything

1. `CLAUDE.md`: the hard rules, the workflow and the known traps. Binding.
2. `HANDOVER.md`, section *Start here*: the current state and the to-do list in
   order. Then *Deployment → Running a playtest*.
3. `reviews/slc-review.md`, section 12: the route the work follows (stages A to
   E) and each stage's gate.
4. `DECISIONS.md` is a ledger: look entries up by ID as they come up (C8, D11,
   D12, E8, F15, F16, A9, G1, I11 are the recent ones), don't read it front to
   back.
5. `git log --oneline -30`, and read the last few commit messages in full.

Then run `npm test` (expect 1656 passing, 1 todo) and `npm run build` (expect 54
files), and tell me in a few lines that you have caught up.

## Who I am, and how to work with me

- I'm relatively new to development. Explain in plain language. A working file I
  can't follow is a failure even if the tests pass.
- **Plan before code.** For anything beyond a trivial edit, tell me the approach
  and wait for my go-ahead ("looks right, build it"). Bounded changes get a
  short design in chat; bigger ones a design doc in `plans/`, then a task plan.
- **Ask rather than assume; push back** when something is wrong, including
  something I asked for. Give a recommendation, not a survey.
- Tests first. One concern per commit, present tense, with the reasoning in the
  message. Check `npm test`'s exit code before committing; never commit red.
- **Pushing to `main` deploys to the live site.** Push only when I say, and run
  `npm run ci` first.
- "It works" means playing it in the browser pane on the dev server
  (`npm run dev`, then http://localhost:5173/ui/), not just green tests.
- Edit files with the Edit tool, not shell heredocs (Windows, CRLF).
- Never put a real-world claim in the game or the guide from memory: fetch the
  source and cite it. Check a benchmark's context before quoting it.
- Any change that moves the market is measured before and after with
  `scripts/market-harness.js`, against gates we agree first. If a gate fails,
  stop and report; don't tune past it.

## Where things stand (2026-09-13)

- **Live and invite-only** at https://g-ads-simulation.manikhorocks.workers.dev
  (Cloudflare Access). `main` is the only branch. Tags: `playtest-1` (the game
  before stage C, kept for reference).
- **Built:** the engine (all fourteen build steps); round 0; the dashboard and
  decision form; saves in the browser; the field guide (nine chapters, each
  "real Google Ads" then "this game", reached from "why?" links); the end-screen
  debrief with "What if I hadn't?", the budget "what if", six lessons and the
  rival reveal; the week-5 capital card reading last month's budget; the week-9
  market line; each keyword's reach on its match type; a playtest recorder
  (`?playtest=1`) and reader (`scripts/read-playtest.js`).
- **Known and said on screen:** the market is kinder than a real one (F15); hour
  adjustments count twice under automated bidding (D11); places and hours can be
  switched off entirely (D11).
- **Measured and rejected:** moving the capital window to week 7 (D12); a
  January surge and a festive-season event (F16, from Google Trends India).
- **Fixed on 2026-09-13:** C8, every rival had been losing its second capital
  allocation.

## What needs doing, explicitly

1. **The stranger playtests. This is the blocker for everything below.**
   - Mine: choose three testers (two alone, one on a video call with me), add
     their exact emails in Cloudflare Access (Zero Trust → Access controls →
     Policies → Playtesters; exact Emails, scope All traffic), send the invite
     from HANDOVER.
   - Yours, on the day I say I'm sending: `git tag playtest-2`, then
     `git push origin playtest-2`, and keep engine changes off `main` until the
     files are back (words and docs are fine).
   - When files arrive: `node scripts/read-playtest.js <files>` (on the
     `playtest-2` tag if `main` has moved), then judge them against the review's
     gates. Stage C: round 0 under 10 active minutes, weeks 5–12 over 72
     seconds. Stage D: three lessons stated in their own words, and decisions
     in weeks 7–12 (the reader counts them).
2. **After the playtests, C3 and C4,** designed from what the files show:
   - C3, round 0 as guided steps (review recommendation 4). It re-opens I11, the
     writer decision.
   - C4, a dashboard that shows only the cards with something to say that week
     (recommendation 5). The recorder's card times decide what it hides.
   - Each moves its cards' prose into `ui/words/` under the content model.
3. **Then stage E, game feel** (review section 13), only on screens C rebuilds,
   each motion reviewed with `/review-animations`.
4. **Open decisions to bring to me with options, not decide alone:** A9 (whether
   a brand owner's advantage on its own name should be modelled), F15 options
   (b)/(c) (a harsher market, only with better data), and E8's formula (how many
   tags decide how far broad match reaches).
5. **If the playtests haven't happened yet,** ask me which of item 4 to take up,
   or propose the smallest honest improvement you can find, and wait for my
   go-ahead.

## Do not re-propose without new evidence

Moving the capital window to week 7 (D12). A January or festive-season event
(F16; see the memory note). Capital carry-over (memory). Grade-matched writer
copy, symmetric broad match, retagging the vague lifestyle searches, extra volume
for performance (the review's "not proposed" list).

## Traps worth knowing before you touch anything

- The ones in CLAUDE.md, especially: a decision the player's form always sends
  must also be sent by every rival (C8); `replayGame` is not a game replay, use
  `game.js`'s `replayLog`; a chapter's "show me on the card" slot must exist once
  the page is drawn.
- `tagKeywordOffline` returns `tags`, `taggedContentHash` and `source`, not the
  keyword's text.
- The browser pane: when hidden it pauses CSS transitions and smooth scrolls
  until it paints; screenshots resize the viewport and can cut a smooth scroll
  short, so measure with a wait and no screenshot in between; a first
  screenshot is often blank, so take another. A scripted reload logs a harmless
  `beforeunload` console error. "Start a new game" overwrites the dev browser's
  saved game.
- Tests that replay whole games need `{ timeout: 60_000 }`; the full suite takes
  about 85 seconds.

## Useful commands

```
npm test                                    lint, then the whole suite
npm run ci                                  what Cloudflare runs: lint, suite, build
npm run dev                                 the dev server, http://localhost:5173/ui/
npm run build                               builds dist/ and prints the file count
node scripts/market-harness.js market <label> 12    F15's economics and the market's shape
node scripts/market-harness.js capital <label> 12   D12's capital comparison
node scripts/read-playtest.js <files>       read returned playtest files
node scripts/season-lift.js                 January's lift from sources/trends/
```

Start by confirming you've caught up and that the tests pass, then ask me
whether the playtests have happened.
