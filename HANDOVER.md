# HANDOVER.md

State of play, for whoever picks this up next — including a fresh Claude Code
session, which will have read the files but not the conversation that produced
them.

Everything factual lives in `ENGINE_SPEC_v0.3.md` and `DECISIONS.md`. This file
carries the things those two cannot: where we are, how we work, and what is
still resting on a guess.

---

## Where we are

Eleven of fourteen build-order steps done. **650 tests, all passing.**

```
✅  1  constants, money, rng          ✅  7  strategies
✅  2  querySet + content             ✅  8  pacing, attribution
✅  3  auction                        ✅  9  round
✅  4  matching                       ✅ 10  report, insights
✅  5  quality                        ✅ 11  serialise
✅  6  positions                      ⬜ 12  calibration   ← next
                                      ⬜ 13  agents
                                      ⬜ 14  ui
```

The engine runs end to end. A round is 168 hours × 151 queries × 9 advertisers,
resolves ~25,200 auctions, and takes **242ms** in expected mode, **1,240ms**
sampled with one counterfactual. Both inside the spec 19 budgets.

`git log` is a genuine record — each commit message explains what was built and
what it exposed. Reading the last dozen is the fastest way in.

---

## Step 12 is the interesting one

`calibration.test.js` settles the two `CALIBRATE` constants and runs the balance
invariants in spec 18.2. **Nothing about the market's fairness has been verified
yet**, and there is real reason to expect problems.

Provisional right now:

| | value | governed by | what is known |
|---|---|---|---|
| `AD_RANK_FLOOR` | 60 | I2 | Median CPC came out at 964 paise against Value's 1,352 break-even, so it looks survivable |
| `WEEKLY_VOLUME` | 225,000 | I1 | Untested. First live round showed spend from 7% to 100% of budget |

**I3 has now run, and it fails.** Six identical advertisers, one per cell,
twelve rounds:

```
mid|lifestyle          19,40,851   ← best
mid|performance        14,06,136
premium|performance     9,80,950
premium|lifestyle       9,39,565
value|lifestyle         8,85,379
value|performance       4,62,394   ← worst

spread 4.20x · worst deviation 76% · target under 15%
```

**Mid-market wins and Value comes last, which reverses the design's intent** —
Mid was meant to be the squeezed position with no territory of its own.

This is now the single biggest open problem in the project, and it is pinned
rather than papered over: `calibration.test.js` asserts the *current* spread so
a change shows up, with two `test.todo` entries naming the invariant that has
not been met. Nothing asserts that I3 passes.

**A likely cause worth checking first.** Because each cell is largely
uncontested, most advertisers price against `AD_RANK_FLOOR` rather than against
each other — so every position pays roughly the same CPC while their
break-evens differ 2.6× top to bottom. The 52/28/20 volume split was derived to
equalise *margin potential*, and it does, but equal margin against equal cost
does not give equal profit when the margins-per-order differ so widely. Two
levers to weigh: the territory volume split, and whether the floor should scale
with something rather than being one number for the whole market (`DECISIONS`
B1 already flags the single-floor simplification as `OPEN`).

Two things found while building `round.js` that step 12 needs to respect:

- **I1 was rewritten.** It originally asked that every advertiser exhaust its
  budget simultaneously. The first live round showed the low spenders were being
  *outranked*, not starved of market — an advertiser losing 39% of impressions
  to rank *should* spend less. Testing all nine at once measures competition,
  not market size, and would push `WEEKLY_VOLUME` up to compensate for something
  volume cannot fix. It is now scoped to one advertiser against passive rivals.
- **Balance must be tested with rule-based policies and repositioning off.** LLM
  rivals and mid-game repositioning make market layout vary unpredictably, and
  the test cannot isolate position balance through that.

---

## How this project works

**Tests first, then implementation, then run and iterate.** Every step so far:
write the test file, write the module, run, fix, commit, push. `npm test`.

**Commit and push after every green run.** Credentials are cached, so pushing
needs no interaction. Commit messages are long on purpose — they carry the
reasoning that would otherwise be lost.

**Run diagnostics, not just tests.** Several of the most useful findings came
from a throwaway script printing real numbers, not from an assertion. The
pacing stutter, the fixture's impossible bids, the 43% gross/net gap being a
base-tier figure — all found by looking at output. Scratchpad scripts for this
live outside the repo.

**Mutation-test anything that validates.** A validator that always returns
"valid" passes a naive suite perfectly. `querySet.test.js` breaks exactly one
rule at a time and asserts that rule fires; `brands.test.js` proves its guard
would reject `BudgetBox`.

**Structural tests where a rule cannot be tested behaviourally.** You cannot
prove a module ignored a field it was handed, so instead: `quality.test.js`
reads every file in `engine/` and fails if any but `quality.js` so much as
writes `reportedScore`; `strategies.test.js` fails if that module names an
affinity; `serialise.test.js` fails if it could reach a model. These have fired
three times and were right every time.

---

## The pattern worth knowing

**Building a module keeps finding defects in the spec that reading it did not.**
Roughly a dozen so far, all recorded in `DECISIONS.md`. Three examples, because
the shape repeats:

- Spec 12.1 and 14 both listed `business.convRateBase` *and* the purpose
  modifier. But `businessFor` already folds the modifier in — it has to, or the
  break-even table would be wrong. Applying it again would have made every
  lifestyle brand convert 1.21× and return 1.44× more than designed. **When a
  derived object and a formula both mention the same modifier, one of them is
  wrong.** (F10)
- `DECISIONS.md` D9 claimed the generic pacing curve manufactures the forecast
  error the 2× overspend cap needs. Measured, it produces 0.2% overspend — the
  hourly feedback loop is too tight. The entry is corrected in place, and what
  the mismatch actually costs (mis-timed spend, an account broke before its best
  hours) turned out to be the better lesson.
- Spec 10.2 would have let a *below-floor* rival set your price, so adding a
  weak competitor would have **lowered** your cost. The floor is a reserve, not
  just an eligibility gate. (B5)

So: **treat the spec as authoritative but not correct.** If something reads
oddly while implementing it, it is worth ten minutes of arithmetic.

---

## Still open

- **The three `RoundReport` sub-questions** were answered by my recommendation
  rather than by explicit discussion: no rival rows in an advertiser's slice,
  breakdown per keyword *and* per query, and `AsFirstReported` twins on every
  revised figure. All built and tested; worth confirming they are what was
  wanted.
- **The query set is frozen but was reviewed only once**, via a published
  artifact. Value and Premium were rewritten after that review to use
  marketplace and material vocabulary; the corrected set has not been read
  end to end by a human.
- **Rival ad copy does not exist yet.** Spec 17.1 requires it authored per cell
  and *diagnostic* — a player must be able to infer position from it. The
  fixture uses one generic ad for all nine, which is fine for tests and useless
  for round 0. This is content work, and it is load-bearing.
- **`content/adCopy.js` is in the spec's module layout and not yet written.**
- **Nothing has been played.** The longest run is three consecutive rounds in a
  test. Whether twelve rounds is legible, whether the traps land, whether the
  feedback loop is too slow to learn from — all unknown.

---

## Things that will bite

- **The shell has a stale PATH.** Node is at `C:\Program Files\nodejs`; prepend
  it (`$env:Path = "C:\Program Files\nodejs;" + $env:Path`) in every PowerShell
  call or `node` is not found.
- **Commit messages must go through a file.** `git commit -F <file>`; PowerShell
  here-strings mangle embedded quotes and git receives the message as filenames.
- **`engine-audit.test.mjs`** at the repo root is a v0.1 prototype artefact that
  cannot run. `vitest.config.js` excludes it deliberately. Its `BUG CHECK` cases
  encode real traps and have been ported as their modules were built.
- **The in-test performance bound is looser than the spec's** (3000ms against
  1500ms) because vitest running 650 tests on a loaded machine measures 1.5–2×
  the engine's real cost. The spec budget was not moved; see the comment in
  `round.test.js`.

---

## Working preferences that shaped this

Stated in `CLAUDE.md` and worth repeating because they changed how the work was
done:

- Plan before code for anything non-trivial, and wait.
- Ask rather than assume. Guessing silently is the main failure mode being
  guarded against.
- One module at a time. Do not build ahead.
- Push back. Roughly forty spec problems were caught by two audit passes before
  a line was written, and a dozen more by building. Assume more remain.
- Explain technical things in plain language. A working file that cannot be
  followed is a failure even if the tests pass.
