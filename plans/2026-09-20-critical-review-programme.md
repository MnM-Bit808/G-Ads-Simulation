# What the critical review found, and the order to fix it in

**A sequencing document. Nothing is built from it yet.** Written 2026-09-20
after a critical review of the whole project, at the owner's request. The review
is in this session's transcript; what is kept here is the list of problems it
found and the order to work them in.

**The owner's instruction:** work through all of it, however long it takes, but
sequenced rather than picked at.

---

## 1. The one sequencing decision everything else follows from

**The playtest is the long pole, and it must start first even though it
finishes last.**

Every other item on this list is work that can be done in an afternoon or a
week, by one person, on demand. Getting three beginners to play twelve weeks and
say what they understood cannot be compressed, cannot be done by the person who
built it, and is the only item whose *result could invalidate the others*.

If three beginners finish and say the chapters were impenetrable, the guide work
outranks the calibration work. If they say the numbers felt arbitrary, sourcing
outranks everything. If they never reach week 5, the whole second half of the
game is unvalidated and the model work is premature.

**So it goes first in the sequence and runs in the background.** Everything
below it is what gets done while waiting.

The second reason it goes first: the project's only rating below 3 is *evidence
it achieves its stated goal*, at 2/10. Every other number in the review is
respectable. Nothing else on this list moves that one.

## 2. What the review found

Nine problems, and one that is already fixed. Listed as found, not in work
order — section 3 has the order.

| | problem | rating it holds down |
|---|---|---|
| ~~A~~ | ~~75% of constants invented, and nothing on screen said so~~ | **fixed 2026-09-20**, `e608918` |
| B | Nobody has ever finished playing it | evidence it works, 2/10 |
| C | `LOCATION_RETURN_MULTIPLIER` scales the whole return total, when the project's own sources say only refusals climb outside the metros | model design, 8/10 |
| D | Documentation drift at eighteen days old | doc accuracy, 6/10 |
| E | 59 of 79 constants invented; only 8 from a published source | quantitative grounding, 3/10 |
| F | No type checking on 58,000 lines dense with numeric invariants | production readiness, 5/10 |
| G | No second human has read any of it | bus factor, 4/10 |
| H | 18 branches and 8 stale worktrees | bus factor, 4/10 |
| I | Models manual and Smart Bidding in a market moving to PMax | obsolescence (a threat, not a rating) |
| J | The model's answer key ships to every player's browser | production readiness, 5/10 |

**One thing the review found that is NOT on this list.** The engine is 12% of
the code and the interface is 31%. That is an observation about where the work
went, not a defect, and nothing should be done about it.

## 3. The order

### Phase 0 — start the long pole (the owner's, and it blocks nothing else)

Runs in parallel with everything below. **B.**

- **0.1** Remove the Cloudflare Access application, so a tester does not need an
  email code. *Owner's: it is their dashboard.* Still on as of 2026-09-20.
- **0.2** Deployment hygiene, while in those dashboards: 2FA on GitHub and
  Cloudflare, branch protection on `main`, and the Cloudflare build's repository
  scope. *Owner's.* An hour, and the only security item worth spending on.
- **0.3** Update `HANDOVER.md`'s invite text and *Invite-only* section once 0.1
  is done — step 2 currently tells testers to expect an email code. *Mine, and
  it depends on 0.1.*
- **0.4** Send the link to three people who have never seen it. *Owner's.*

**Done when:** three recordings are in hand, or three people have said why they
stopped. Not before.

### Phase 1 — clear the deck (cheap, and everything after it is easier)

- **1.1** Audit the 18 branches and 8 worktrees. List what is unmerged BEFORE
  deleting anything; delete only what is provably in `main`. **H.**
- **1.2** Fix the documentation drift. **D.** Spec §20 lists geography as
  deliberately out of scope and geography is modelled; `design/*.dc.html` quotes
  a market that no longer exists (₹26.56 at 76% retention, mid returns at 24%).
  Both would teach the old numbers to whoever reads them next.

**Done when:** `git branch` is short, and no document states something the code
contradicts.

### Phase 2 — the correctness defect in the teaching model

- **2.1** `LOCATION_RETURN_MULTIPLIER` applies to the whole return total, so
  send-backs come out 1.36–1.40x higher in the towns along with refusals. The
  evidence recorded in F14 says it is refusals that climb outside the metros
  (tier-3 RTO 3–5x) and I28 measured send-backs flat. **C.**

This is first among the code items because it is the only one where the game is
currently teaching something the project's own sources contradict. Everything
else on this list is an absence; this is a wrong answer.

**How:** gates agreed before measuring, `scripts/market-harness.js` before and
after, a DECISIONS entry recording what moved. It touches `engine/`, so the
five CALIBRATE constants get re-checked.

**Done when:** the location gradient reaches refusals only, the market is
measured either side, and F14's leftover note is closed rather than reworded.

### Phase 3 — raise the weakest rating

- **3.1** Audit all 59 INVENTED constants and split them in two: those that
  genuinely cannot be sourced because Google does not publish them, and those
  that have a public benchmark nobody looked for. **E.**
- **3.2** Source the second group. Every one that moves the market gets measured
  before and after, like any other market change.
- **3.3** Re-read the guide's honesty line against the new picture. If enough
  moves, rewrite it — the test added in `e608918` will say so.

**The honest expectation:** the auction's internals stay invented, because
Google publishes neither Ad Rank's coefficients nor what a Quality Score point
is worth. What might be sourceable: click-through by position, conversion rates
for Indian apparel, average CPC in the category, cart abandonment. A realistic
outcome is 8 documented becoming 15–20, not 59 becoming 5.

**Done when:** every remaining INVENTED constant has a one-line note saying why
it could not be sourced, rather than being invented by default.

### Phase 3a — the gate nobody runs

**Found while measuring F19's G3, 2026-09-20, and it is not F19's fault.**
`tests/performance.test.js` fails on `main`: the three-auction path measures
**3,105–3,167ms against its own 2,800ms bound**, about 11% over. Measured with
the fix stashed and unstashed, three samples either side — the fix adds nothing,
the bound was already red.

**Why nobody noticed.** `npm test` is lint plus vitest; `npm run ci` is lint,
vitest and the build. **Neither runs `test:perf`** — it is a separate script
because timing inside a parallel run measures the machine. So the one gate that
protects the 400ms-per-round spec budget has no automation behind it at all, and
`main` drifted past it at some point after 2026-09-15, when the bound was set
from measurements of 2,200–2,550ms.

**What it needs, in order:** find which change moved it (the candidates since
that date are I34, I39, I40, I41, C9 and F18); decide whether the cost is real
or the bound was set on a quieter machine; then either fix the cost or re-set
the bound openly with its measurement, the way F14 re-set `AD_RANK_FLOOR`. And
give it a way to be noticed — a nightly run, or a line in the handover's
deployment section saying it is run by hand and when it was last run.

**Do not simply raise the number.** The project's own rule is to cut the thing
rather than move the bound, and a performance bound that is raised whenever it
fails is not a bound.

### Phase 4 — durability

The project is one person with no reviewer, and the docs meant to protect
against that are already drifting at eighteen days.

- **4.1** Type checking without a migration: JSDoc types plus `tsc --checkJs`,
  no bundler, no `.ts` files, no change to how the game is served. **F.** The
  project has already shipped `no-undef` and `no-unused-vars` to a browser; this
  is the next class up.
- **4.2** A review pass on `engine/` by something that is not me. **G.**
- **4.3** `HANDOVER.md` is 3,370 lines and `DECISIONS.md` 6,210. Decide what is
  a record (keep, never edit) and what is a guide (keep current), and split
  them, because the second kind is what rots.

### Phase 5 — the fork, which is a decision and not a task

- **5.1** **Is this game about the auction, or about the modern job?** **I.**
  It teaches the auction well. The job is increasingly about feeding automation:
  broad match with Smart Bidding, PMax, asset-level optimisation. Those are
  different games, and the second one has less for a player to decide.

This is the owner's call and it should be made deliberately rather than by
default. It is also the item most affected by Phase 0: what a beginner says they
learned will say which game this actually is.

### Phase 6 — the backend

- **6.1** Withhold the answer key from the browser. **J.**
- **6.2** LLM-driven rivals, currently blocked on it.
- **6.3** Cross-device saves.

Last deliberately. It is the largest build on the list and it protects a lesson
nobody has yet finished learning. Three things want it, which is the argument
for doing it — but not before the thing it protects is known to work.

## 4. What would change this order

- **Phase 0 returning bad news.** If three beginners cannot finish, the guide
  and the interface outrank Phases 2–6 and this document gets rewritten.
- **Phase 2 moving the market more than expected.** The five CALIBRATE constants
  are the tell; if they move, Phase 3 has to follow immediately rather than
  waiting.
- **The owner needing the project for interviews sooner than expected.** Then
  Phase 0 is the only phase that matters, and the rest waits.
