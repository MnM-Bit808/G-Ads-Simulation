# Rivals' second capital allocation (DECISIONS C8): implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans
> (inline, the owner's choice for this project) task by task. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** every rival decides its week-5 capital by its character, so no
advertiser's second ₹1,20,000 silently disappears; measured before and after, as
F14 was, because it adds up to ₹9,60,000 to month 2.

**Architecture:** a guard first, so the harness that measures the change
describes a real player: `startGame` accepts a capital block or a capital
allocation (the decision's own shape) and refuses anything malformed. Then a
committed market harness measures the market before; rivals learn the capital
rules from their self view and decide by character; the harness measures after.

**Tech stack:** ES modules, no bundler; Vitest; ESLint.

**Spec:** DECISIONS C8 (the defect and the fix it names), D12 (what the right
week-5 choice is), F15 (the harness and the economics this re-measures). No
design document: the decision was taken with the owner in conversation,
2026-09-13, and is recorded here.

## Decided with the owner

Each rival reads its own budget, by character:

| character | at week 5 |
|---|---|
| `disciplined` | D12's finding: invests if last week lost under 10% of its impressions to budget, keeps it as ad money if more |
| `spender` | always keeps it as ad money (volume at any cost) |
| `cautious` | always invests (afraid to spend) |
| `automator`, `grossOptimiser`, `brandDefender` | habit: invests again if it invested at round 0, keeps it as ad money if it did not |

"Invests" means: its primary target up to that target's top rung, the rest on
its secondary, never past a top rung; the primary and secondary follow the tilt
`rivalCapex` uses at round 0 (value → size guide, mid → landing page, premium →
photography; secondary order confirmation for value and mid, landing page for
premium). "Keeps it as ad money" means submitting an empty capital decision, so
the engine rolls the whole allocation into month 2's budget, as it does for the
player.

## Global constraints

- Branch `back-half`. Commit after each green `npm test`, checking its exit
  code; push only when the owner says.
- CLAUDE.md applies: controllers receive views, never state (hard rule 5), and
  `agents/policies.js` imports nothing from `engine/`, so everything a rival
  needs to decide capital arrives in its self view. One advertiser type (hard
  rule 6): the rivals' decision goes through `submitRound`'s door, the same one
  the player's does.
- The 10% is a character's opinion (`DISCIPLINED_BUDGET_BOUND = 0.10` in
  `agents/policies.js`), under C7, not a constant of the market.
- **Stops for the owner:** Task 1 if a balance test fails once the harness
  player has its round-0 money (I11's measurement would be in question); Task 5
  if any gate below fails. Report, do not tune past it.
- Edit with the Edit tool, never shell heredocs.

## File map

| file | task | job |
|---|---|---|
| `setup.js`, `tests/setup.test.js` | 1 | the capital guard |
| every test that hands `startGame` a flat capital list | 1 | re-read; pinned figures move only where the round-0 money now arrives |
| `scripts/market-harness.js`, `tests/marketHarness.test.js` | 2 | the before/after measurement, committed so it is run the same way twice |
| `engine/insights.js`, `tests/report.test.js` | 3 | the self view carries the capital rules |
| `agents/policies.js`, `tests/policies.test.js` | 4 | rivals decide week 5 by character |
| `DECISIONS.md` (C8, F15, D12), `HANDOVER.md` | 5 | the measurement and the record |

---

### Task 1: the capital guard in `startGame`

**Files:** `setup.js` (`buildPlayer`, ~line 686); `tests/setup.test.js`.

**Interface:** `startGame({ player: { capex } })` accepts
- a **block**: `{ committed, pending, remainingUnallocatedPaise }`, every field
  present and well formed; or
- an **allocation**: `{ [target]: paise }`, known targets only, non-negative
  integer paise, summing to at most `CAPEX_ALLOCATION_PAISE`, converted to a
  block exactly as the round-1 decision door would: committed as given, one
  pending tranche per non-zero target live at `1 + CAPEX_DELAY_ROUNDS`, and
  `remainingUnallocatedPaise = CAPEX_ALLOCATION_PAISE - sum`;
- nothing (`undefined`): the full allocation uncommitted, as today.

Anything else throws a `RangeError` naming what is wrong. A block is recognised
by having a `committed` key; a block missing `pending` or
`remainingUnallocatedPaise` is refused rather than read as zero.

- [ ] **Step 1: Write the failing tests** in `tests/setup.test.js`, a new
  `describe('the round-0 capital a caller hands startGame (C8)')`:
  - an allocation of zeros gives `remainingUnallocatedPaise` equal to
    `CAPEX_ALLOCATION_PAISE`, and the player's month 1 report shows
    `MONTHLY_BUDGET_PAISE + CAPEX_ALLOCATION_PAISE` plus the writer's rollover
    (the trap this closes: it used to show ₹1,20,000 less);
  - an allocation of `{ landingPage: 8000000 }` gives committed ₹80,000, one
    pending tranche live at round 4, and ₹40,000 remaining;
  - a block missing `remainingUnallocatedPaise` throws `/remainingUnallocatedPaise/`;
  - `{ billboards: 1 }` throws `/unknown capex target/`; an allocation over
    `CAPEX_ALLOCATION_PAISE` throws `/exceeds/`; a negative or fractional amount
    throws;
  - a full block, as `ui/round-zero.js` builds it (line ~1631), is taken as
    given.
- [ ] **Step 2: Run** `npx vitest run tests/setup.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `capitalBlock(capex)` in `setup.js` beside
  `buildPlayer`, used in place of `capex ?? {...}` at both sites (~686, ~702),
  with a comment naming C8 and the trap. Reuse `CAPEX_TARGETS`,
  `CAPEX_ALLOCATION_PAISE`, `CAPEX_DELAY_ROUNDS`, already imported.
- [ ] **Step 4: Run** `npm test`. Every test that handed `startGame` zeros now
  gives its player the round-0 money it always should have had, so figures pinned
  on a twelve-week game may move. For each failure: confirm the difference is the
  month-1 money and nothing else, then update the pinned figure with a comment
  naming C8. **If `tests/writerBalance.test.js` fails an ordering or a ratio,
  stop and report**: I11's balance was measured on a player without its
  round-0 money, and whether it still holds is the owner's question.
- [ ] **Step 5: Commit** — "Build the round-0 capital block from an allocation,
  and refuse a malformed one (C8)".

### Task 2: the market harness, committed

**Files:** create `scripts/market-harness.js`, `tests/marketHarness.test.js`.

**Why committed:** F15, D12 and F16 each rebuilt the same harness as a throwaway
and each got the round-0 capital wrong. This runs it the same way before and
after the change.

**Interface:**
- `harnessPlayer(cell)` → F15's player (the six highest-volume searches of the
  cell on phrase at 0.7 × `realisedBreakEvenCpcPaise`, the brand search on exact
  at 1.2×, the agency writer, round-0 capital `{}`: nothing committed, now
  handed over correctly);
- `playMarket({ seed, cell, playerDecision })` → the final state, rivals on
  `controllerFor(policyId)` and asserted live, `mode: 'expected'`;
- `measure(seeds, cells)` → per market: the player's final net profit and
  rank, settled weeks 1–7's click-through, cost per click, conversion and profit
  per rupee (F15's table), each rival's month-2 budget, and the step into week 5
  and week 9 against an ordinary week (the check that found C8);
- CLI: `node scripts/market-harness.js <label> [workers]` writes
  `harness-<label>.json` to the system temp folder, forking `workers` processes
  (default 6), and prints the summary.

- [ ] **Step 1: Test** `harnessPlayer` and one short market (seed 1, one cell,
  `rounds: 5`): the player's month-1 budget includes the round-0 allocation, and
  every rival is live. Give the describe `{ timeout: 60_000 }`.
- [ ] **Step 2: Implement**, reading D12's and the week-9 throwaways for the
  measurement code (they are recorded in DECISIONS D12, C8 and F16).
- [ ] **Step 3: Run it for the BEFORE picture:** `node scripts/market-harness.js before`.
  Also run D12's comparison (capital against keeping it, week 5, by cell) through
  the same harness. Keep the printed summaries for Task 5.
- [ ] **Step 4: Commit** the script and its test — "Commit the market harness
  F15, D12 and C8 are measured with".

### Task 3: the self view carries the capital rules

**Files:** `engine/insights.js` (`getSelfView`); `tests/report.test.js` (where
the self-view tests live).

**Interface:** `getSelfView(...).capital = { allocationRounds: number[],
allocationPaise: number, ceilingPaise: { [target]: number } }` — the rules every
advertiser is told at round 0 (17.2): which rounds capital can be committed in,
how much each brings, and each target's top rung (`CAPEX_TIER_CURVE`'s last for
three, `CAPEX_PHOTOGRAPHY_CURVE`'s last for photography). Nothing about any
other advertiser.

- [ ] **Step 1: Test**: the self view carries `capital` with those three fields
  matching the constants and the state's `budgetSchedule`; the existing
  forbidden-fields test still passes.
- [ ] **Step 2: Implement**, with a comment: a policy imports nothing from
  `engine/`, so the rules reach it here or not at all.
- [ ] **Step 3: Run** `npm test`; **commit** — "Tell every advertiser the capital
  rules in its own view".

### Task 4: rivals decide week 5 by character

**Files:** `agents/policies.js`; `tests/policies.test.js`.

**Interfaces (in `policies.js`):**
- `capitalWindow(self)` → `true` when `self.round` is an allocation round after
  round 1 (round 1's allocation is round 0's, decided in `setup.js`);
- `investment(self)` → an allocation `{ [target]: paise }`: the primary target
  up to its ceiling less what is already committed, then the secondary with what
  is left, never past a ceiling, summing to at most `allocationPaise`;
- `keepAsAds()` → `{}`;
- `DISCIPLINED_BUDGET_BOUND = 0.10`, commented under C7.

Each policy's decision gains `capex` on a window round, per the table at the
top; on every other round it is unchanged.

- [ ] **Step 1: Write the failing tests:**
  - **nothing changes outside the window**: every policy's decision at rounds 2,
    4, 6 and 9 has no `capex`;
  - `investment` never passes a ceiling, never passes `allocationPaise`, tops up
    a target already part-built rather than restarting it, and picks the tilt
    above for each price tier;
  - at round 5: `spender` sends `{}`; `cautious` sends an investment;
    `disciplined` sends an investment when the report's `share.lostToBudget` is
    0.05 and `{}` when it is 0.30; a habit rival sends an investment when its
    `capex.committed` sums above zero and `{}` when it does not;
  - **through the door**: a round-5 `submitRound` with the real policies leaves
    no rival with a month-2 budget of exactly `MONTHLY_BUDGET_PAISE` unless it
    invested the whole allocation, which is C8's defect as a test.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement**, with a comment above the window rule quoting C8.
- [ ] **Step 4: Run** `npm test`. Pinned twelve-week figures may move from week 5
  onward; update each only after confirming weeks 1–4 are unchanged, with a
  comment naming C8. Stop and ask if anything moves in weeks 1–4.
- [ ] **Step 5: Commit** — "Let every rival decide its second capital allocation
  (C8)".

### Task 5: measure after, and record

- [ ] **Step 1: Run** `node scripts/market-harness.js after`, D12's comparison
  through it, and `npx vitest run tests/calibration.test.js` with I1–I5's
  figures printed and read (they measure round 1 and one month, so they should
  not move; confirm it).
- [ ] **Step 2: The gates.** Stop and report to the owner if any holds:
  - a calibration invariant fails;
  - the player's median final rank moves by more than two places, or the
    player now loses money in more than a quarter of markets (F15 had none);
  - D12's finding reverses in any cell (capital against keeping it changes
    sign).
  The gates are the owner's to agree, not model constants.
- [ ] **Step 3: Record.** C8 becomes `FIXED`, with the rule, the before/after
  table (rivals' month-2 budgets, the step into week 5, the player's rank and
  profit, D12 by cell). F15 gains an addendum: the corrected round-0 money and
  the rivals' allocation, and whether "profitable for almost everyone" still
  holds. D12 gains a line saying its comparisons were re-run on the corrected
  harness. HANDOVER *Start here* says what changed.
- [ ] **Step 4: Play a game to week 6** on the dev server and read the market
  card and Auction Insights at week 5: rivals should no longer collapse.
- [ ] **Step 5: Commit** — "Measure the market with every rival's second
  allocation (C8, F15)".
