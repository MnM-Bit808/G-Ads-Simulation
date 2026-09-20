# Prompt for the next session

*Written 2026-09-19, for the session that reads the stranger playtest files.
Paste everything below the line into a new Claude Code session opened in this
folder. If this date is old, HANDOVER's* Start here *is the fresher source.*

---

You are picking up an ongoing project: a Google Ads search auction simulator,
built as a learning tool for paid search advertising. Vertical: athleisure and
gym clothing, D2C, India. Nine advertisers — me and eight rival policies —
compete over twelve weekly rounds in three monthly budget cycles, each from one
cell of a 3 × 2 positioning grid chosen at round 0. Its value depends entirely
on being honest about what it models: a simulator that teaches something false is
worse than no simulator, because the person cannot tell the difference. Accuracy
outranks features.

**This session's work: two strangers have played the game and sent their
playtest files. Read them, tell me what they say, and let us act on it.**

## Read before doing anything

1. `CLAUDE.md`: the hard rules, the workflow, the known traps. Binding.
2. `HANDOVER.md`, *Start here*: the 2026-09-19 block — the freeze, the tag, how
   to read a file, and the gates.
3. `reviews/slc-review.md` section 12: the gates these files are judged against,
   and the route they feed (C3, C4, stage E).
4. `git log --oneline -15`, and read the last few commit messages in full. The
   week before the freeze moved the market three times; the messages carry why.

Then run `npm test` (expect 2402 passing, 1 todo, and check the exit code) and
tell me in a few lines that you have caught up. Do not start work before that.

## The files, and what to do with them

- Read each with `node scripts/read-playtest.js <file>`. It prints active time by
  phase (round 0, weeks 1–4, weeks 5–11, the end screen), every screen in order,
  cards by time on screen, week compute times on their device, what they wrote in
  the two questions, and their game replayed: rank, what the business made, the
  weeks they decided something, and whether the replay matched.
- If a file says `THE REPLAY DOES NOT MATCH`, read it again on the build they
  played: `git checkout playtest-4`, read, then come back.
- The clicks are not listed, only counted. When the names matter, read
  `recording.clicks` in the file directly — each carries a `where`.
- **The gates**: round 0 under 10 active minutes; weeks 5–12 over 72 seconds
  each; three lessons stated in their own words; decisions taken in weeks 7–12.
  Tell me which gates each file passes and which it fails, with the figures.
- **Two testers is not a measurement.** Say what is one person's opinion and what
  both hit. Where a file shows something and their words say something else, show
  me both rather than choosing.

Then, before any code: bring me what you think the files are asking for, in
order of how much it would change what a learner takes away. I will pick.

## The freeze, which is still on when you start

- `main` is frozen for engine changes until we have finished with the files.
  Words and docs are safe to commit.
- **Do not push anything** until I say. A push rebuilds the live site and stamps
  a new commit into `ui/version.js`, and a tester still playing would then send a
  file naming a build that is not `playtest-4`.
- `44fa4f4` — the message project's design doc — is committed and waiting for
  the same reason. It is the first thing to push once the files are in.

## Who I am, and how to work with me

* I'm relatively new to development. Explain in plain language. A working file I
  can't follow is a failure even if the tests pass.
* I decide by seeing. Mock-ups on the design canvas, with real game content, beat
  descriptions.
* Plan before code. Design work goes through the brainstorming skill: one
  question at a time, then 2–3 options with a recommendation, then a design doc
  in `plans/`, a task plan, and the build inline, one task at a time, each after
  my go-ahead.
* Ask rather than assume; push back when something is wrong, including something
  I asked for. Give a recommendation, not a survey.
* Tests first. One concern per commit, present tense, with the reasoning in the
  message. Check `npm test`'s exit code before committing; never commit red.
* Pushing to `main` deploys to the live site. Push nothing until I say.
* "It works" means playing it in the browser pane on the dev server, not just
  green tests. Measure contrast by script, not by eye.
* Edit files with the Edit tool, not shell heredocs (Windows, CRLF).
* Never put a real-world claim in the game or the guide from memory: fetch the
  source and cite it.
* Anything that moves the market is measured before and after with
  `scripts/market-harness.js`, against gates we agree first. Downloads need my
  yes first, with names and sizes.
* End commit messages with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`,
  and commit with `git commit -F <file>`.

## Where things stand (2026-09-19)

* **Live**: `368801d`, tagged `playtest-4`, at
  `https://g-ads-simulation.manikhorocks.workers.dev`. That is the build the
  testers played; every playtest file also names the build each of its loads ran.
  It was invite-only when this was written; the sign-in was removed 2026-09-20
  and the link is now all a tester needs.
* **Unpushed**: `44fa4f4`, the message angles design doc.
* **The week before the freeze**, all live and all measured against gates agreed
  first: the landing page is graded as it stands (I37); Your ad shows where the
  grade comes from, rule by rule, with the cap shown openly; the grade counts
  only what Google names (I38); rivals are handed their own revised history (C9);
  rivals block what costs them rather than only what nobody buys (I8's addendum);
  What people typed marks a search that sold nothing; and the books count what
  the business spent and settle the tail after the whistle (I39).
* **Open, none blocking**: the message project's part 2 (images from week 9);
  what the drawn landing page shows for its remaining rungs; whether sixty
  keywords want a compact list; trimming the cards' repeated words; and
  `npm run test:perf`'s sampled-round test sitting on its 2,200ms bound on
  untouched code.
