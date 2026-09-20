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

- **0.1** ~~Remove the Cloudflare Access application, so a tester does not need
  an email code.~~ **DONE 2026-09-20** by the owner, and measured from outside:
  five production paths answer `200` with no redirect. The application was
  deleted rather than its policy — deleting only the policy would have denied
  everyone.
- **0.2** ~~Deployment hygiene: 2FA on GitHub and Cloudflare, branch protection
  on `main`, and the Cloudflare build's repository scope.~~ **THE TWO THAT
  MATTER ARE DONE, 2026-09-20.**
  - **2FA on both accounts** — done, authenticator app on each.
  - **The build's repository scope** — done. It was on **All repositories** and
    is now **Only select repositories → G-Ads-Simulation**. That setting lives
    on GITHUB, not Cloudflare (`github.com/settings/installations` → *Cloudflare
    Workers and Pages* → Configure), because the integration is a GitHub App.
    Cloudflare's own docs recommend narrowing it. There is no
    `.github/workflows` here — Cloudflare builds from the repository directly,
    so that installation IS the credential.
  - **Branch protection: NOT DONE, and deliberately.** It may need a paid plan
    on a private repository, and it is the weakest of the three — a sole admin
    bypasses their own rules, which is not the failure mode here. Revisit only
    if somebody else ever gets write access.
- **0.3** ~~Update `HANDOVER.md`'s invite text and *Invite-only* section once
  0.1 is done.~~ **DONE 2026-09-20.** It was ten passages rather than two, in
  four files: `HANDOVER.md`, `CLAUDE.md`, `scripts/build-site.js`'s *WHAT IT
  DOES NOT HIDE* comment, and this file. `JOURNAL.md` and `reviews/slc-review.md`
  were left alone deliberately — they are records of a moment and true as
  written.
- **0.3a** **Found while doing 0.3, and not in the original plan:** branch
  previews are public too, and **outlive the branch**. `origin/makeover` was
  deleted (fully merged, zero unique commits, preserved by the annotated tag
  `playtest-3`) and its preview went on serving `e312519`.
  **PARKED 2026-09-20, on a judgement about proportion.** The alias is NOT in
  the Deployments tab and cannot be deleted individually — Cloudflare's docs
  offer only *Settings → Domains & Routes → Preview URLs → Disable*, which
  turns off previews wholesale, and that setting could not be located in the
  dashboard as it now stands. **It is tidiness, not safety:** the site is
  public anyway, so a public preview leaks nothing new, and the only real risk
  — a tester playing the stale build — happens only if somebody sends them that
  link. **The defence that works is the documented one:** send the bare
  production address and no other (HANDOVER, *Branch previews are public*).
  Revisit if a branch is ever worked on again, when a preview would be wanted
  anyway.
- **0.4** Send the link to three people who have never seen it. *Owner's.*

**Done when:** three recordings are in hand, or three people have said why they
stopped. Not before.

### ~~Phase 1 — clear the deck~~ **DONE 2026-09-20**

- **1.1** ~~Audit the 18 branches and 8 worktrees.~~ **DONE.** `git branch -a`
  is now `main` and nothing else. The last to go was `makeover` (2026-09-20,
  fully merged, its head preserved by the annotated tag `playtest-3`).
- **1.2** ~~Fix the documentation drift.~~ **DONE, and the second half was not
  the job it looked like.**
  - **Spec §20** said geography was deliberately out of scope while G4 models
    it. Corrected: §20 now records that geography stopped being an omission,
    and the same pass added Performance Max, which the list had never named
    (I43).
  - **The design artboards were NOT edited, and should not be.**
    `design/*.dc.html` still quotes ₹26.56 at 76% retention and 24% returns for
    mid, because an artboard is a record of what was believed on the day it was
    drawn — 2026-09-10, the day before F14 overturned the economics. Editing
    the figures would make an old drawing look current. **The actual fault was
    `design/README.md`**, which vouched for the content as "real throughout"
    without saying *when*, so the folder asserted the numbers were good rather
    than merely displaying them. Fixed there: the date is named, the three dead
    figures are named, and the rule is stated — take the shape from an
    artboard, the numbers from `engine/constants.js`. The same pass recorded
    that `support.js` is not in the repository (the design canvas supplies it
    at render time), so an artboard opened straight in a browser looks broken
    without being broken.

**Done when:** `git branch` is short, and no document states something the code
contradicts. **Both hold.** The second needed a distinction the item did not
have: a document that *shows* an old number is a record, and one that *vouches*
for it is a fault.

### Phase 2 — the correctness defect in the teaching model

- **2.1** ~~`LOCATION_RETURN_MULTIPLIER` applies to the whole return total, so
  send-backs come out 1.36–1.40x higher in the towns along with refusals.~~
  **DONE 2026-09-20 as F20**, and it turned up F21 on the way: the 3–5x this
  item quoted as the evidence is COD against prepaid, not tier-3 against metros.
  **C.**

This is first among the code items because it is the only one where the game is
currently teaching something the project's own sources contradict. Everything
else on this list is an absence; this is a wrong answer.

**How:** gates agreed before measuring, `scripts/market-harness.js` before and
after, a DECISIONS entry recording what moved. It touches `engine/`, so the
five CALIBRATE constants get re-checked.

**Done when:** the location gradient reaches refusals only, the market is
measured either side, and F14's leftover note is closed rather than reworded.

### ~~Phase 2b — normalise the gradient market-wide~~ **CLOSED, NOT DONE (F21)**

**Opened by F20 and closed the same day, without code.** The plan was to
normalise `LOCATION_RETURN_MULTIPLIER` market-wide so a place's gradient stopped
depending on who was advertising, and the table could then widen to the 3–5x
tier-3 RTO the sources were said to quote.

**It rested on a misread source.** That 3–5x is COD against prepaid — *"COD
orders have 3–5× higher RTO than prepaid"* (Shipmozo, 2026) — and the model
already carries it, from a named study, at `RTO_RATE_COD` 20.9% against
`RTO_RATE_PREPAID` 5.8% = 3.6x. There is no gap for a wider table to close.

**And the thing that looked like an artefact is correct.**
`tests/constants.test.js` ties `POSITION_ECONOMICS.returnRate` to
`refusalRateFor` *weighted by where that tier's searches are*, so per-price
normalisation preserves a sourced derivation. Doing this work would have broken
a sourced number to chase a misread one.

**What this leaves.** `LOCATION_RETURN_MULTIPLIER` stays as the unquantified
remainder — address quality, courier reach, digital literacy are all quoted as
raising tier-2/3 RTO with no multiple attached — which is what `INVENTED` means.
F21 has the sources and the reasoning.

**Worth carrying into Phase 3**, where the constants get audited: the check that
found this was searching for the *claim*, not for support of it. Every INVENTED
constant justified by a quoted figure should be re-read the same way — a figure
needs its denominator carried with it, not just its value.

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

### ~~Phase 3a — the gate nobody runs~~ **DONE 2026-09-20**

**The answer was not a regression.** Running the bound-setting commit's own code
on today's setup gave 3,180ms against HEAD's 3,101ms — the old code is SLOWER.
The engine has got faster since (the expected round nearly halved, 183ms to
107–129ms); what grew is the test runner. The header used to record plain Node
as "8-15% dearer" than vitest; today it is about 35% cheaper.

So none of I34, I39, I40, I41, C9 or F18 was responsible, the asserted bound
went 2,800 → 3,600 on that evidence with the 1,500ms spec budget untouched, and
`HANDOVER.md` now carries a *Running the performance suite* section with the
date it was last run and the instruction to measure the old code before ever
touching the number again. A ratio bound was considered and rejected: the ratio
moved further than the absolute did.

<details><summary>the original item</summary>

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

</details>

**What the closed item teaches, kept because the instinct above was half
wrong.** "Do not simply raise the number" was right; "find which change moved
it" assumed a regression that did not exist. A wall-clock bound has two inputs
and only one of them is the code, so **the first question is which input moved,
not which commit** — and that is a ten-minute check, not a bisect.

### ~~Phase 4 — durability~~ **ALL THREE DONE 2026-09-20**

The project is one person with no reviewer, and the docs meant to protect
against that are already drifting at eighteen days.

- **4.1** ~~Type checking without a migration: JSDoc types plus `tsc --checkJs`,
  no bundler, no `.ts` files, no change to how the game is served.~~ **DONE.**
  61 errors to 0, and **none of them was a type error** — every one was JSDoc
  that had drifted from the code it described. `tsconfig.json` records why
  `ui/` is excluded (303 errors against 44, all DOM typing). `npm test` runs
  it; `npm run ci` deliberately does not.
- **4.2** ~~A review pass on `engine/` by something that is not me.~~ **DONE.**
  It found three things no test could: a guide honesty line I had falsified
  myself six hours after writing it, and two false comments. Tests were added
  for the first.
- **4.3** ~~`HANDOVER.md` is 3,370 lines and `DECISIONS.md` 6,210. Decide what
  is a record and what is a guide, and split them.~~ **DONE.** `HANDOVER.md` is
  1,574 lines and the dated log moved to a new append-only `JOURNAL.md`.

### Phase 5 — the fork, which is a decision and not a task

- **5.1** **Is this game about the auction, or about the modern job?** **I.**
  It teaches the auction well. The job is increasingly about feeding automation:
  broad match with Smart Bidding, PMax, asset-level optimisation. Those are
  different games, and the second one has less for a player to decide.

This is the owner's call and it should be made deliberately rather than by
default. It is also the item most affected by Phase 0: what a beginner says they
learned will say which game this actually is.

**PART OF IT WAS ANSWERED ON 2026-09-20, and the premise turned out to be
half wrong.** The game already teaches Smart Bidding. What was missing was
PMax — absent from the guide, the ledger and spec §20 alike, so the game was
silent about a thing it does not model rather than honest about it. Chapter 24,
*What this game leaves out*, now names the boundary (I43). **The fork itself is
still open**, and still wants the recordings: naming what is missing is not the
same as deciding whether to build it.

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
