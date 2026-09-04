# HANDOVER.md

State of play, for whoever picks this up next — including a fresh Claude Code
session, which will have read the files but not the conversation that produced
them.

Everything factual lives in `ENGINE_SPEC_v0.3.md` and `DECISIONS.md`. This file
carries the things those two cannot: where we are, how we work, and what is
still resting on a guess.

---

## Where we are

Thirteen of fourteen build-order steps done. **755 tests, all passing, 1 todo.**

```
✅  1  constants, money, rng          ✅  8  pacing, attribution
✅  2  querySet + content             ✅  9  round
✅  3  auction                        ✅ 10  report, insights
✅  4  matching                       ✅ 11  serialise
✅  5  quality                        ✅ 12  calibration
✅  6  positions                      🟨 13  agents  — disciplined done, five to go
✅  7  strategies                     ⬜ 14  ui
```

Plus two modules the spec's layout did not have: **`game.js`** (the caller loop)
and **`content/adCopy.js`** (rival copy per cell, a draft awaiting a read).

All five calibration invariants pass. Neither `CALIBRATE` constant moved, and
both are now argued rather than merely untested:

| | value | why it is where it is |
|---|---|---|
| `AD_RANK_FLOOR` | 60 | Raising it is regressive. A flat reserve takes the same absolute paise from every cell — a small bite out of Premium's ceiling, a fatal one out of Value's. Measured over a full game, floor 150 takes I3 from 2.8% to 50.8%; 250 wipes the Value tier out. |
| `WEEKLY_VOLUME` | 225000 | I1 passes at 100% of a month. But note the weakness below. |

I3 now sits at **2.8% worst deviation, 1.05x spread**, against a 15% target.

---

## What the last session changed, and why it matters

An audit pass found nineteen things. Four were already covered by the ledger and
were withdrawn or narrowed — that is the system working. The rest produced eight
commits, and three of them were engine defects producing wrong numbers:

- **Reports were double-counting their own lag-0 conversions.** `runRound`
  appended the fresh report to history and then revised the whole array,
  including that report, so 55% of every advertiser's conversions landed twice.
  Round 1 stored 131.33 where `runRound` returned 65.66. Eight revision tests
  missed it because they all compared `R1.report` against `history`, and the
  defect lived exactly in the gap between those two objects.
- **`observedConvRate` was never written.** It stayed null for twelve rounds
  while `observedConversions` climbed into the hundreds, so smart bidding grew
  steadily more confident about `COLD_START_CONV_RATE`. The spec-19 test for it
  was never written, and every strategies test supplied the value by hand.
- **`observedByHour` was hard-coded null**, so `MIN_HOUR_OBSERVATIONS` was
  unreachable and a bid strategy had no route to dayparting at all.

And one design defect worth understanding before touching anything:

- **The purpose axis was applied twice.** `PURPOSE_MODIFIERS` *and* the query
  set, which gives lifestyle territory bigger baskets and fewer returns. Both
  are true; both push the same way. The realised purpose gap was 12/17/20%
  against I4's 15% bound, invisible because **I4 read `constants.js` and
  nothing else** — it measured a quantity no auction experiences. Fixed by
  shrinking the `INVENTED` modifier rather than flattening the argued content.

---

## The thing that governs everything downstream

**`breakEvenCpcPaise` is not the number an advertiser can pay.** It is the
ceiling on a neutral query — every multiplier 1, every hour average — and nobody
buys that query. Territory is by construction where both of a position's
affinities peak, so the affinity product runs near 2.0, and the intent curve
compounds it (its mean is 1 over uniform hours and **1.146 over traffic**).

Use **`realisedBreakEvenCpcPaise`** for anything operational. The old figure had
the fixtures bidding 29% of what they could afford, which is why the market read
as placid and everyone priced against the reserve. Corrected, median CPC went
979 → 2008 and `lostToBudget` started firing for the first time.

---

## Is twelve rounds long enough to learn from?

Measured rather than argued, because W11 was closed by design argument alone.
Short answer: **long enough for anything that settles inside a round, not long
enough for the three lessons the design cares most about.**

- **A round's reported profit overshoots.** 64% of truth at the click, **117%
  one round later**, then four rounds of decay. Conversions land faster than
  returns resolve, so every round looks best exactly one round after you stopped
  being able to change it.
- **Five of the eleven decisions in a game are made with no settled round to
  look at.** First fully-settled feedback arrives at round 7.
- **The quality diagnostic never moves.** Lifting `expectedCtr` 6 → 9 — a 50%
  improvement — moves the own/field ratio from 1.137 to 1.488 over eight rounds
  and the displayed score not at all, because the ratio was already past
  `RATING_UPPER_THRESHOLD` and three levels cannot express anything between.
  A6 records this as landing-page compression; it is every component.
- **The noise floor is flat.** `QUALITY_NOISE_SIGMA` is a volume-independent 8%
  that swamps the Poisson term, so every advertiser sits at 9-10% CV regardless
  of size. **F7's Premium claim does not hold on reported outcomes** — 10.5%
  against 8.8%, not the 3x it describes. It *does* hold on the bid strategy's
  internal estimate: sigma 0.141 against 0.050 at round 12.

None of that needs a longer game. The cheapest fixes are display-side and
constant-side, and they have not been discussed yet.

---

## Still open

- **Five policies to write**: `spender`, `automator`, `cautious`,
  `brandDefender`, `grossOptimiser`. The interface, the guards and
  `disciplined` are done and committed.
- **`content/adCopy.js` is a draft and has not been read by a human.** A naive
  classifier recovers all six cells, which only proves it is not *generically*
  bad. Same standing as the query set.
- **The query set was reviewed once** and Value and Premium were rewritten after
  that review. The corrected set has still not been read end to end.
- **`agents/` still needs** `llmPolicy.js`, `grader.js`, `keywordTagger.js`,
  `queryGen.js`. Rival grades are hand-authored so the suite stays offline.
- **Rival placement (17.1) has no implementation.** `RIVAL_PLACEMENT_CONSTRAINTS`
  is read by nothing but a constants test.
- **I1 does not actually pin `WEEKLY_VOLUME`.** It asserts >50% of a month over
  four rounds; reality is 100%, and the constant can fall to ~90,000 before the
  test notices. It also never checks the "at a CPC below break-even" clause it
  is built around.
- **`CAPEX_TARGETS` is read by nothing**, not even a test. The `QUALITY_WEIGHTS`
  pattern v0.3 deleted, recurring. The provenance tests check tag ⇄ constant in
  both directions but never that a constant is *read*.
- **Nothing has been played.** Longest run is twelve rounds in a test.

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
  1500ms) because vitest running 755 tests on a loaded machine measures 1.5–2×
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
