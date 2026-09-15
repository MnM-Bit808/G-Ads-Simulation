# A throttled advertiser is in only its share of the searches (DECISIONS F17): implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans
> (inline, the owner's choice for this project) task by task. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** the auction treats a budget-throttled advertiser as present in only
the share of searches its pacer lets it into, taking no slot and setting no
price in the rest, so the round's two paths through the auction agree to the
paisa and a real test holds them together.

**Architecture:** a new pure function, `resolveSlice` in `engine/auction.js`,
resolves one slice of searches by weighing every combination of which throttled
entrants are present: one ladder per combination, ranked once, each as likely
as its members' shares. `engine/round.js` records its result one place at a
time on both paths, so the flat path adds exactly the numbers the three-auction
path does. The market is measured before and after on the harness, against
gates agreed with the owner first.

**Tech stack:** ES modules, no bundler; Vitest; ESLint.

**Spec:** ENGINE_SPEC_v0.3 section 13.4 ("a throttled advertiser enters a
*fraction* of that volume", H1) and DECISIONS F2 ("statistically equivalent to
simulating each search"), both of which the engine contradicts today and this
makes true; DECISIONS G4, *Two paths through the auction*. No design document:
the defect was diagnosed and the fix decided with the owner in conversation on
2026-09-15, and both are recorded here.

## What was found (2026-09-15)

Pacing gives each advertiser a participation fraction p for each auction
(spec 13.4). `recordAuction` bills it for p of the searches, but
`resolveAuction` ranks it in all of them. So in the (1 − p) of searches it is
not in, it still holds its slot: the rivals beneath it drop a place or off the
page, and the rival just above pays as though it were bidding against them.

The two paths disagree because of a trigger on top of that. An advertiser that
has nearly spent its day enters with a tiny p. Each auction then costs it a
fraction of a paisa, which rounds to zero, so it never spends its last paisa and
keeps holding a slot for the rest of the day. Whether it lands exactly on its
day target (and drops out) or one paisa short (and stays) is rounding luck. The
three-auction path rounds three times as often, so the luck falls differently.

Measured on `tests/fixtures/gameState.js`, expected mode, with scratch copies of
the round (not committed):

- At the first auction where the paths part (Monday 21:00, query 2), marlow had
  spent 600,000 paise of a 600,000 day target on the flat path (out) and 599,999
  on the three-auction path (in, at position 1 on 0.0001 searches, pushing
  three rivals down a slot on all of theirs).
- Given the same entrants, the ladder never differed: 0 of 45,774 resolutions.
- The paths disagree by up to 5.1% of impressions and 12.9% of cost (kestrel).
- Against an exact reference, in which each throttled advertiser is present in
  a share p of the searches: the current engine is up to 58% off on impressions
  and 105% on cost (lumen pays twice what it should: ₹13.89 a click against
  ₹6.77).
- In 9 markets the harness plays (3 seeds × 3 cells, weeks 2, 6 and 10), 67–95%
  of auctions have a throttled entrant; the worst-hit advertiser's clicks are
  30–82% off the reference; the player's are usually 20–45% low.
- A cutoff (treat participation under 0.001 as zero) makes the paths agree but
  leaves clicks about 37% off whatever the threshold: advertisers throttled to
  25–99% hold slots they are not in, too.
- The calibration invariants could not see any of it. I1 plays one advertiser
  alone, and I3 plays isolated territory with one entrant per auction, so
  nobody is ever in anybody's way. Only I2 plays one contested round, and it
  asserts bounds this passes.
- G4's dated note records moving a rounding step changing one game by 15% of
  the player's profit. This is that amplifier.
- The test meant to hold the paths together (`tests/round.test.js`, *the two
  paths through the auction agree when they should*) sets every place
  adjustment to `[0, 0, 0]`, a multiplier of exactly 1, so both of its states
  take the flat path and it compares that path with itself.

## Decided with the owner (2026-09-15)

- **The model:** a throttled advertiser holds its place only in the share of
  searches it actually enters ("Yes, only its share").
- **The scope:** fix the ladder, staged. Prove the exact method first, then the
  round and a real two-paths test, then the harness gates and recalibration.
- **How presence combines:** each advertiser is throttled by its own pacer, so
  whether one is present in a search is independent of whether another is. This
  is what "simulating each search" (F2) means with independent pacers, and it is
  what makes the enumeration below exact.
- **Not a sampled draw:** drawing who is present per auction would put a whole
  slice's volume on or off one advertiser at a time, which is the budget cliff
  H1 exists to remove.
- **Not a cutoff:** measured above, it hides the symptom and leaves the defect.

## The method, and what the prototype measured

Enumerate the combinations. With k throttled entrants (participation under 1),
there are 2^k combinations of who is present: one ladder when nobody is
throttled, 512 at worst with all nine. Rank everyone once, because an absentee
changes nobody else's order. Per combination, assign slots and prices by
`resolveAuction`'s rules, and add each result, weighted by the combination's
probability, to per-entrant shares.

Position and price can be averaged separately. Where an entrant sits depends only
on who is present above it, and what it pays only on who is present below it.
Those are separate sets of independent advertisers, so the average price does
not depend on the slot, and clicks times average price is the expected cost.

A prototype of Tasks 5 and 6 was checked in the scratchpad. Task 6 arranges
the recording slightly differently: one call per place rather than a place
loop inside each entrant, and Auction Insights recorded per place rather than
once per auction. That is what makes even the pair counts agree to the last
digit. Neither change should move a number the prototype checked, and Task 6's
own tests and timings check both again.

| check | result |
|---|---|
| against `resolveAuction` run on each combination, 3,000 random auctions | worst difference 1.9e-15 |
| the two paths with equal bids, expected and sampled | 0 difference in impressions, clicks and cost |
| against the brute-force reference (every combination through the old recorder) | within 0.036% (rounding order) |

| wall time on this machine | flat expected | flat sampled + CF | three-auction expected | three-auction sampled + CF |
|---|---|---|---|---|
| engine today | 72ms | 546ms | 167ms | 1,275ms |
| prototype | 104ms | 904ms | 206ms | 1,594ms |

The budgets are 400ms (expected) and 2,200ms as the performance suite asserts it
(sampled + one counterfactual, spec 1,500ms). A played week is the three-auction
sampled column: about 0.3s slower. Two choices made it that fast. The pair
tables are flat typed arrays, not nested arrays; nested ones cost 21% of the
round in allocation. And each search's expected basket is worked out once per
round, not once per record, because `toPrecision` rounding had cost 18%.

## Gates: to agree with the owner BEFORE Task 3

**Correctness: all must hold before anything is measured after.**
1. `resolveSlice` equals `resolveAuction` run on every combination of who is
   present, on 300 seeded random auctions, to 1e-9.
2. The two paths agree with a tilt that moves no bid, in expected and sampled
   mode: cost to the paisa, impressions, clicks and lost-to-rank to six
   decimals, place by place.
3. `npm test` is green.

**Performance: must hold.**
4. `npm run test:perf` passes: expected under 400ms, sampled plus one
   counterfactual under 2,200ms on both paths (Task 2 adds the three-auction
   one).

**Calibration: must hold.**
5. Every test in `tests/calibration.test.js` passes, and its figures are printed
   before and after and recorded in F17. If an invariant fails, stop: a
   `CALIBRATE` constant would have to move, and that is the owner's call.

**Market: tripwires, 72 markets before and after.** If any of these fires,
stop and bring the figures to the owner before anything is recorded as done.
The fix is not reverted, since a known 30–80% defect is not kept, but nothing is
tuned without the owner.
6. The player's median final rank moves by more than one place.
7. The player loses money in more markets than before.
8. Any of the player's or the rivals' median CTR, CPC or profit per rupee moves
   by more than 25%.
9. The largest rival move into week 5 or week 9 (D12's figures) changes by more
   than half of its before value.

## Global constraints

- Work on this worktree's branch, `claude/lucid-bhabha-395dd1`, which was
  fast-forwarded to `makeover` at `54d250b` (after the prepaid fix, I34, moved
  the round's returns arithmetic into `returnHalves`). Where it merges is the owner's
  call. Commit after each green `npm test`, checking its exit code. Push nothing.
- CLAUDE.md's hard rules apply. The engine stays pure: `resolveSlice`
  allocates its tables per call, with no module-level cache or buffer. Money is
  integer paise: an average price is rounded once, where it is spent
  (`roundPaise`). One advertiser type: every entrant goes through the same
  function.
- No new constants. Nothing here is a number about the world. The one guard,
  on how many throttled entrants a slice may have, is `ADVERTISER_COUNT`.
- `resolveAuction` does not change. It is still the one-ladder function, and
  `resolveSlice`'s test holds the two to the same rules.
- **Stops for the owner:** Task 6 if any calibration invariant, balance ordering
  (`tests/writerBalance.test.js`) or known-trap test fails (CLAUDE.md, *Known
  traps*); Task 7 if a gate fails or a tripwire fires. Report; do not tune past
  it.
- Edit with the Edit tool, never shell heredocs.

## File map

| file | task | job |
|---|---|---|
| `tests/calibration.test.js` | 1 | the invariants print their figures on request |
| `tests/performance.test.js` | 2 | time the three-auction path, which a played game takes |
| this plan, *Measurements* | 3, 7 | the market before and after |
| `engine/attribution.js`, `engine/round.js`, `tests/attribution.test.js` | 4 | a search's basket worked out once per round |
| `engine/auction.js`, `tests/auction.test.js` | 5 | `resolveSlice` |
| `engine/money.js`, `tests/money.test.js` | 6 | `roundPaise` |
| `engine/round.js`, `tests/round.test.js` | 6 | the round records slices; the real two-paths test |
| `DECISIONS.md` (F17, notes in F2 and G4), `ENGINE_SPEC_v0.3.md` 13.4, `CLAUDE.md`, `HANDOVER.md` | 8 | the record |

---

### Task 1: the calibration figures, printed on request

The invariants assert bounds and print nothing when they pass, which is how I3
once drifted from 9.5% to 13.2% unseen (CLAUDE.md). This change moves the
market, so the figures are read before and after, from the same code.

**Files:** `tests/calibration.test.js`.

- [ ] **Step 1: Add the helper** after `const EMPTY = …` (line 42):

```js
/**
 * Prints a measured figure when CALIBRATION_FIGURES is set, and nothing
 * otherwise.
 *
 * Every invariant here asserts a bound and says nothing when it passes, so I3
 * once drifted from 9.5% to 13.2% with every tick green. A change that moves
 * the market reads these before and after:
 *
 *   CALIBRATION_FIGURES=1 npx vitest run tests/calibration.test.js
 */
const figure = (label, value) => {
  if (process.env.CALIBRATION_FIGURES) console.info(`[figure] ${label}: ${value}`);
};
```

- [ ] **Step 2: Call it** in these tests, straight after the value is computed
  and before the `expect`:
  - I1 *exhausts its month*: `figure('I1 solo, share of the month spent', solo.spentFraction.toFixed(4));`
  - I1 *PROFITABLY*: `figure('I1 solo, CPC over realised break-even', (solo.cpcPaise / solo.breakEven).toFixed(3));`
  - I1 *genuinely binds*: `figure('I1 solo, lost to budget', solo.lostToBudget.toFixed(4));`
  - I1 *pinned from BELOW*: `figure('I1 at 330000, spent and lost to budget', \`${small.spentFraction.toFixed(3)} ${small.lostToBudget.toFixed(4)}\`);`
  - I2 *median CPC*: `figure('I2 median CPC and the Value realised break-even', \`${out.raw.marketContext.medianCpcPaise} ${Math.round(valueBreakEven)}\`);`
  - I2 *priced out*, inside the first loop after `lostToRank` is computed:
    `figure(\`I2 lost to rank, ${a.id}\`, lostToRank.toFixed(3));`, and inside
    the second loop after `best`: `figure(\`I2 best impression share, ${price}\`, best.toFixed(3));`
  - I3 *15% from the mean*: `figure('I3 worst deviation', \`${(worstDeviation * 100).toFixed(1)}%\`);`
  - I3 *within a third*: `figure('I3 spread', \`${spread.toFixed(3)}x\`);`
  - I3 *creative rollover*: `figure('I3 worst deviation at the raised budget', \`${(worst * 100).toFixed(1)}%\`);`
  - I3 *place to be*, after `tilt`: `figure('I3 lifestyle over performance', \`${tilt.toFixed(3)}x\`);`
  - I3 *pinned from ABOVE*: `figure('I3 at 500000, worst deviation', \`${(deviation * 100).toFixed(1)}%\`);`
- [ ] **Step 3: Run it both ways.**
  Run: `CALIBRATION_FIGURES=1 npx vitest run tests/calibration.test.js`
  Expected: PASS, with `[figure]` lines in the output, including
  `I3 worst deviation: 11.3%` (HANDOVER's current figure; if it differs, write
  down what it is, since that is the baseline).
  Run: `npx vitest run tests/calibration.test.js`
  Expected: PASS, no `[figure]` lines.
- [ ] **Step 4: Run** `npm test`. Expected: exit code 0.
- [ ] **Step 5: Commit**: "Print the calibration figures on request, so a
  market change can read them before and after".

### Task 2: time the path a played game takes

The performance suite times only the flat fixture, but rivals bid by place
(`agents/policies.js`), so a played week mostly takes the three-auction path.
This change makes that path about 0.3s slower, so it gets a test before the
change, not after.

**Files:** `tests/performance.test.js`.

- [ ] **Step 1: Add the test** after *a sampled round with one counterfactual
  stays near its 1500ms budget*:

```js
  test('and so does the three-auction path, which a played week mostly takes', () => {
    // Rivals bid by place (agents/policies.js), so once one tilts, every
    // auction resolves once per place, and that is what a played week costs.
    // The flat fixture above never takes that path. A millionth of a percent
    // on one place sends the round down it without moving a bid (G4).
    const tilted = makeGameState();
    tilted.advertisers[1].campaign.locationAdjustments = [0, 0, 0.0001];
    const ms = medianMs(() => runRound(
      tilted, { mode: 'sampled', seed: 3, counterfactualFor: [CONSTRAINED] },
    ), 3);
    expect(ms, `${ms}ms against a 1500ms spec budget`).toBeLessThan(2200);
  });
```

- [ ] **Step 2: Run** `npm run test:perf`. Expected: PASS. Write down all four
  times; Task 3 records them.
- [ ] **Step 3: Run** `npm test`. Expected: exit code 0.
- [ ] **Step 4: Commit**: "Time the three-auction path too, which a played
  week mostly takes".

### Task 3: measure the market before

Only after the owner has agreed the gates above.

**Files:** this plan, *Measurements* at the end.

- [ ] **Step 1: The harness.**
  Run: `node scripts/market-harness.js market before-f17 6`
  Expected: a summary of 72 markets, and
  `rows written to …/harness-before-f17-market.json` in the system temp folder.
  Copy the whole printed summary into *Measurements → Before*.
- [ ] **Step 2: The calibration figures.**
  Run: `CALIBRATION_FIGURES=1 npx vitest run tests/calibration.test.js`
  Copy every `[figure]` line into *Measurements → Before*.
- [ ] **Step 3: The times.** Run `npm run test:perf` and copy the four times.
- [ ] **Step 4: Commit** the plan: "Record the market before F17".

### Task 4: a search's basket, worked out once per round

The round will record every entrant that shows in any share of the searches,
once per place, where it used to record at most four per resolution. Each
record prices a basket with `mulRate(aovMeanPaise, valueMultiplier)`, which is
fixed for an advertiser and a search all round. Worked out once per pair
instead, and no number moves: the same arithmetic, and the same random draws
at the same points.

**Files:** `engine/attribution.js` (`sampleOrderValuePaise`, line ~120);
`engine/round.js` (import, `buildEntryPlans`, `recordAuction`);
`tests/attribution.test.js` (*order value*).

**Interfaces:**
- Produces: `expectedOrderValuePaise(business, query) → integer paise`;
  `orderValuePaise(basePaise, business, rng, mode) → integer paise`; each entry
  plan carries `orderValuePaise`. `sampleOrderValuePaise` keeps its signature
  and its results.

- [ ] **Step 1: Write the failing test** in `tests/attribution.test.js`, inside
  `describe('order value')`, and add `expectedOrderValuePaise, orderValuePaise`
  to the import from `../engine/attribution.js`:

```js
  test('is the expected basket and the noise around it, in two steps the round can split', () => {
    const query = neutralQuery({ valueMultiplier: 1.3 });
    const base = expectedOrderValuePaise(business, query);
    expect(base).toBe(sampleOrderValuePaise(business, query, null, 'expected'));
    expect(orderValuePaise(base, business, null, 'expected')).toBe(base);
    const a = mulberry32(11);
    const b = mulberry32(11);
    for (let i = 0; i < 200; i++) {
      expect(orderValuePaise(base, business, a, 'sampled'))
        .toBe(sampleOrderValuePaise(business, query, b, 'sampled'));
    }
  });
```

- [ ] **Step 2: Run** `npx vitest run tests/attribution.test.js`. Expected:
  FAIL, `expectedOrderValuePaise is not a function` (or not exported).
- [ ] **Step 3: Split the function.** Replace `sampleOrderValuePaise` in
  `engine/attribution.js` (keep its JSDoc above the composed version) with:

```js
/**
 * What one order on this search is worth before any noise: the catalogue's
 * mean basket times the search's own value multiplier.
 *
 * Fixed for an advertiser and a search for the whole round, so the round
 * works it out once per pair rather than once per auction it records.
 *
 * @param {{aovMeanPaise: number}} business
 * @param {{valueMultiplier: number}} query
 * @returns {number} integer paise
 */
export function expectedOrderValuePaise(business, query) {
  return mulRate(business.aovMeanPaise, query.valueMultiplier);
}

/**
 * One order's value: the expected basket in expected mode, and a lognormal
 * draw around it in sampled mode, so the spread is realistic, the mean is kept
 * exactly and a value can never come out negative.
 *
 * @param {number} basePaise from expectedOrderValuePaise
 * @param {{aovSpread: number}} business
 * @param {(() => number)|null} rng
 * @param {'expected'|'sampled'} mode
 * @returns {number} integer paise
 */
export function orderValuePaise(basePaise, business, rng, mode) {
  if (mode !== 'sampled') return basePaise;
  if (typeof rng !== 'function') {
    throw new TypeError('sampled mode needs an rng: the engine never reaches for one (R1)');
  }
  const s = business.aovSpread;
  return Math.max(1, mulRate(basePaise, Math.exp(normal(rng) * s - (s * s) / 2)));
}

/**
 * What one order is worth.
 *
 * Sampled mode draws lognormally around the mean, so the spread is realistic,
 * the mean is preserved exactly, and an order value can never come out
 * negative. This distribution is what ROAS bidding exists to predict.
 *
 * @param {{aovMeanPaise: number, aovSpread: number}} business
 * @param {{valueMultiplier: number}} query
 * @param {(() => number)|null} rng
 * @param {'expected'|'sampled'} mode
 * @returns {number} integer paise
 */
export function sampleOrderValuePaise(business, query, rng, mode) {
  return orderValuePaise(expectedOrderValuePaise(business, query), business, rng, mode);
}
```

- [ ] **Step 4: Use it in the round.** In `engine/round.js`:
  - the attribution import: replace `sampleOrderValuePaise` with
    `expectedOrderValuePaise, orderValuePaise`;
  - `buildEntryPlans`: `return advertisers.map((advertiser) => {` becomes
    `return advertisers.map((advertiser, i) => {`, and the returned plan gains,
    after `literal: …,`:

```js
        // The basket before any noise. Fixed for this advertiser and search
        // all round, so worked out here once rather than at every record.
        orderValuePaise: expectedOrderValuePaise(business[i], query),
```

  - `recordAuction`: `const base = sampleOrderValuePaise(business[i], query, perAdvertiserRng[i], mode);`
    becomes `const base = orderValuePaise(e._plan.orderValuePaise, business[i], perAdvertiserRng[i], mode);`
- [ ] **Step 5: Run** `npm test`. Expected: exit code 0 with **no other test
  changed**. If any pinned figure moves, the refactor is wrong: stop and find
  out why, because nothing here should move a number.
- [ ] **Step 6: Commit**: "Work out a search's basket once per round, not once
  per auction recorded".

### Task 5: `resolveSlice`

**Files:** `engine/auction.js`; `tests/auction.test.js`.

**Interfaces:**
- Consumes: `adRank`, `resolveAuction`'s rules; `AD_RANK_FLOOR`, `MAX_SLOTS`,
  `MIN_INCREMENT_PAISE`, `ADVERTISER_COUNT` from `./constants.js`.
- Produces: `resolveSlice(entrants)`, where each entrant is
  `{ id, bidPaise, qualitySignal, participation }` with participation in
  (0, 1]. It returns `{ shown, positions, cpcPaise, both, above, shownNot }`,
  all `Float64Array`, indexed in the **entrants' order** (never the ladder's):
  `shown[x]`, `positions[x * MAX_SLOTS + k]`, `cpcPaise[x]` (average price when
  shown, fractional), `both[x * n + y]`, `above[x * n + y]` (both show, y above
  x), `shownNot[x * n + y]` (x shows, y takes part without showing). Every
  value is a share of the slice's searches.

- [ ] **Step 1: Write the failing tests.** In `tests/auction.test.js`, add
  `resolveSlice` to the import from `../engine/auction.js`, and append:

```js
/** An entrant in a share of the slice's searches. */
const part = (id, bidPaise, qualitySignal, participation = 1) => ({
  id, bidPaise, qualitySignal, participation,
});

/**
 * The definition, written out plainly: every combination of who is present,
 * resolved by resolveAuction and weighed by how likely it is. resolveSlice
 * must equal this; it only gets there faster.
 */
function everyCombination(entrants) {
  const n = entrants.length;
  const shown = new Array(n).fill(0);
  const positions = new Array(n * MAX_SLOTS).fill(0);
  const cpcSum = new Array(n).fill(0);
  const both = new Array(n * n).fill(0);
  const above = new Array(n * n).fill(0);
  const shownNot = new Array(n * n).fill(0);
  for (let mask = 0; mask < 2 ** n; mask++) {
    let weight = 1;
    const here = [];
    entrants.forEach((entrant, x) => {
      const isIn = (mask >> x) & 1;
      weight *= isIn ? entrant.participation : 1 - entrant.participation;
      if (isIn) here.push({ ...entrant, x });
    });
    if (weight === 0 || here.length === 0) continue;
    const { ladder } = resolveAuction(here);
    const index = new Map(here.map((entrant) => [entrant.id, entrant.x]));
    for (const r of ladder) {
      if (!r.shown) continue;
      const x = index.get(r.id);
      shown[x] += weight;
      positions[x * MAX_SLOTS + r.position - 1] += weight;
      cpcSum[x] += weight * r.cpcPaise;
      for (const other of ladder) {
        if (other.id === r.id) continue;
        const y = index.get(other.id);
        if (other.shown) {
          both[x * n + y] += weight;
          if (other.position < r.position) above[x * n + y] += weight;
        } else {
          shownNot[x * n + y] += weight;
        }
      }
    }
  }
  const cpcPaise = cpcSum.map((sum, x) => (shown[x] > 0 ? sum / shown[x] : 0));
  return { shown, positions, cpcPaise, both, above, shownNot };
}

describe('a throttled advertiser is in only its share of the searches (F17)', () => {
  // Quality signals are powers of two, so every price below is exact.
  const floorPrice = (qualitySignal) => Math.ceil(AD_RANK_FLOOR / qualitySignal) + MIN_INCREMENT_PAISE;

  test('the hand-worked cases below clear the reserve, whatever it is calibrated to', () => {
    // AD_RANK_FLOOR is CALIBRATE and may move. Every case below assumes an ad
    // rank of 125 shows; if the floor passes it, these numbers stop meaning
    // what their names say, so this fails first rather than they pass wrongly.
    expect(adRank(2000, 0.0625)).toBeGreaterThanOrEqual(AD_RANK_FLOOR);
  });

  test('in the searches it stays out of, the rival beneath it keeps the top slot', () => {
    // X outranks Y (ad rank 500 against 125) but takes part in a tenth of the
    // searches. The old ladder put Y second in every one of them.
    const r = resolveSlice([part('X', 4000, 0.125, 0.1), part('Y', 2000, 0.0625)]);
    expect(r.shown[0]).toBeCloseTo(0.1, 12);
    expect(r.positions[0]).toBeCloseTo(0.1, 12);
    expect(r.shown[1]).toBeCloseTo(1, 12);
    expect(r.positions[MAX_SLOTS + 0]).toBeCloseTo(0.9, 12);
    expect(r.positions[MAX_SLOTS + 1]).toBeCloseTo(0.1, 12);
  });

  test('and the rival above it pays its price only in the searches it is in', () => {
    // Y outranks X. A quarter of the time X is beneath it and prices it at
    // 1001; the rest of the time only the reserve does.
    const r = resolveSlice([part('Y', 4000, 0.125), part('X', 2000, 0.0625, 0.25)]);
    const againstX = Math.ceil(125 / 0.125) + MIN_INCREMENT_PAISE;
    expect(r.cpcPaise[0]).toBeCloseTo(0.25 * againstX + 0.75 * floorPrice(0.125), 9);
    expect(r.cpcPaise[1]).toBeCloseTo(floorPrice(0.0625), 9);
    expect(r.positions[MAX_SLOTS + 1]).toBeCloseTo(0.25, 12);
  });

  test('Auction Insights counts only the searches both were in', () => {
    // B takes part in half the searches and never clears the reserve.
    expect(adRank(100, 0.25)).toBeLessThan(AD_RANK_FLOOR);
    const r = resolveSlice([part('A', 4000, 0.125), part('B', 100, 0.25, 0.5)]);
    expect(r.shown[1]).toBe(0);
    expect(r.shownNot[0 * 2 + 1]).toBeCloseTo(0.5, 12);
    expect(r.both[0 * 2 + 1]).toBe(0);
  });

  test('it equals every combination resolved by resolveAuction, on random auctions', () => {
    const rng = mulberry32(20260915);
    let worst = 0;
    for (let trial = 0; trial < 300; trial++) {
      const n = 1 + Math.floor(rng() * 9);
      const entrants = Array.from({ length: n }, (_, x) => {
        const roll = rng();
        return part(
          `e${x}`,
          100 + Math.floor(rng() * 4000),
          0.005 + rng() * 0.12,
          // Some in every search, some nearly spent, the rest anywhere between.
          roll < 0.4 ? 1 : roll < 0.5 ? 1e-5 : 1e-3 + rng() * (1 - 2e-3),
        );
      });
      const got = resolveSlice(entrants);
      const want = everyCombination(entrants);
      for (const field of ['shown', 'positions', 'both', 'above', 'shownNot']) {
        want[field].forEach((v, k) => { worst = Math.max(worst, Math.abs(got[field][k] - v)); });
      }
      want.cpcPaise.forEach((v, x) => {
        worst = Math.max(worst, Math.abs(got.cpcPaise[x] - v) / Math.max(1, v));
      });
    }
    expect(worst).toBeLessThan(1e-9);
  });

  test('with everyone in every search it is resolveAuction, exactly', () => {
    const rng = mulberry32(7);
    for (let trial = 0; trial < 200; trial++) {
      const n = 1 + Math.floor(rng() * 9);
      const entrants = Array.from({ length: n }, (_, x) => part(
        `e${x}`, 100 + Math.floor(rng() * 4000), 0.005 + rng() * 0.12,
      ));
      const got = resolveSlice(entrants);
      const { ladder } = resolveAuction(entrants);
      entrants.forEach((entrant, x) => {
        const r = ladder.find((l) => l.id === entrant.id);
        expect(got.shown[x]).toBe(r.shown ? 1 : 0);
        expect(got.cpcPaise[x]).toBe(r.cpcPaise);
        for (let k = 0; k < MAX_SLOTS; k++) {
          expect(got.positions[x * MAX_SLOTS + k]).toBe(r.position === k + 1 ? 1 : 0);
        }
      });
    }
  });

  test('refuses a participation outside (0, 1], and a duplicate id', () => {
    for (const p of [0, -0.1, 1.5, NaN, Infinity]) {
      expect(() => resolveSlice([part('a', 4000, 0.125, p)]), String(p)).toThrow(RangeError);
    }
    expect(() => resolveSlice([part('a', 4000, 0.125), part('a', 2000, 0.125)])).toThrow(/a/);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/auction.test.js`. Expected: FAIL,
  `resolveSlice is not a function`.
- [ ] **Step 3: Implement.** In `engine/auction.js`, add `ADVERTISER_COUNT` to
  the constants import, and append after `resolveAuction`:

```js
/**
 * @typedef {object} SliceEntrant
 * @property {string} id
 * @property {number} bidPaise integer paise
 * @property {number} qualitySignal > 0
 * @property {number} participation the share of the slice's searches it enters, (0, 1]
 */

/**
 * @typedef {object} SliceResult
 * Every array is indexed in the entrants' order as given, never the ladder's,
 * and every value is a share of the slice's searches. With n entrants:
 * @property {Float64Array} shown [x] the share x shows in
 * @property {Float64Array} positions [x * MAX_SLOTS + k] the share it shows in slot k + 1
 * @property {Float64Array} cpcPaise [x] its average price per click when it shows:
 *   an average of whole-paise prices, so not itself whole
 * @property {Float64Array} both [x * n + y] the share in which x and y both show
 * @property {Float64Array} above [x * n + y] the share in which both show and y is above x
 * @property {Float64Array} shownNot [x * n + y] the share in which x shows and y
 *   takes part without showing
 */

/**
 * Resolve one slice of searches in which some entrants take part in only a
 * share of them (DECISIONS F17).
 *
 * Pacing throttles an advertiser by letting it into a share of a slice's
 * searches, never by skipping the auction (spec 13.4, H1). In the searches it
 * stays out of, it is not in the ladder: it takes no slot and sets nobody's
 * price. `resolveAuction` ranks everyone it is handed in every search, and the
 * round used to hand it throttled advertisers, so a nearly-spent rival held a
 * slot, and priced the advertiser above it, on searches it was not in.
 *
 * Each advertiser's share is its own pacer's, so who is present in a search is
 * independent from one advertiser to the next. Every combination of who is
 * present is then a ladder of its own, as likely as its members' shares times
 * its absentees' complements. This resolves each with `resolveAuction`'s rules
 * and weighs it. Exact, not sampled.
 *
 * COST: an entrant in every search adds no combinations, so a slice with k
 * throttled entrants resolves 2^k ladders - one when nobody is throttled, 512
 * if all nine are. Ranked once, because an absentee changes nobody else's order.
 *
 * WHY POSITION AND PRICE ARE AVERAGED APART: where an entrant sits depends only
 * on who is present above it, and what it pays only on who is present below
 * it. Those are separate sets of independent advertisers, so its average price
 * is the same whatever slot it lands in, and clicks times average price is its
 * expected cost exactly.
 *
 * @param {SliceEntrant[]} entrants
 * @returns {SliceResult}
 */
export function resolveSlice(entrants) {
  if (!Array.isArray(entrants)) {
    throw new TypeError('entrants must be an array');
  }
  const n = entrants.length;
  const seen = new Set();
  for (const entrant of entrants) {
    if (seen.has(entrant.id)) {
      throw new Error(`duplicate entrant id "${entrant.id}" in one auction`);
    }
    seen.add(entrant.id);
    const p = entrant.participation;
    if (!Number.isFinite(p) || p <= 0 || p > 1) {
      throw new RangeError(`participation must be in (0, 1], got ${String(p)} for "${entrant.id}"`);
    }
  }

  const rows = rankEntrants(entrants);
  // The ranks of the entrants that are sometimes absent. Only they make
  // combinations: one in every search is present in all of them.
  const throttled = [];
  for (let r = 0; r < n; r++) {
    if (entrants[rows[r].index].participation < 1) throttled.push(r);
  }
  if (throttled.length > ADVERTISER_COUNT) {
    throw new RangeError(`${throttled.length} throttled entrants in one slice; the game has ${ADVERTISER_COUNT} advertisers`);
  }

  const shown = new Float64Array(n);
  const positions = new Float64Array(n * MAX_SLOTS);
  const cpcPaise = new Float64Array(n);
  const both = new Float64Array(n * n);
  const above = new Float64Array(n * n);
  const shownNot = new Float64Array(n * n);

  // One ladder's worth, by rank, reused across the combinations.
  const present = new Uint8Array(n).fill(1);
  const position = new Int32Array(n);
  const cpc = new Float64Array(n);
  const shownRanks = new Int32Array(MAX_SLOTS);
  const unshownRanks = new Int32Array(n);

  const combinations = 2 ** throttled.length;
  for (let mask = 0; mask < combinations; mask++) {
    // Bit j says whether the j-th throttled entrant is present.
    let weight = 1;
    for (let j = 0; j < throttled.length; j++) {
      const r = throttled[j];
      const p = entrants[rows[r].index].participation;
      present[r] = (mask >> j) & 1;
      weight *= present[r] ? p : 1 - p;
    }
    if (weight === 0) continue;
    settleLadder(rows, present, position, cpc);

    let nShown = 0;
    let nUnshown = 0;
    for (let r = 0; r < n; r++) {
      if (!present[r]) continue;
      const x = rows[r].index;
      if (position[r]) {
        shownRanks[nShown] = r;
        nShown += 1;
        shown[x] += weight;
        positions[x * MAX_SLOTS + position[r] - 1] += weight;
        cpcPaise[x] += weight * cpc[r];
      } else {
        unshownRanks[nUnshown] = r;
        nUnshown += 1;
      }
    }
    // Pairs are only ever made with somebody shown, and at most MAX_SLOTS are.
    for (let s = 0; s < nShown; s++) {
      const r = shownRanks[s];
      const x = rows[r].index;
      for (let t = 0; t < nShown; t++) {
        if (t === s) continue;
        const y = rows[shownRanks[t]].index;
        both[x * n + y] += weight;
        if (position[shownRanks[t]] < position[r]) above[x * n + y] += weight;
      }
      for (let t = 0; t < nUnshown; t++) {
        shownNot[x * n + rows[unshownRanks[t]].index] += weight;
      }
    }
  }

  // A sum of weighted prices until now; the average, over the searches shown in.
  for (let x = 0; x < n; x++) {
    if (shown[x] > 0) cpcPaise[x] /= shown[x];
  }
  return { shown, positions, cpcPaise, both, above, shownNot };
}

/** Everyone in ladder order, once: descending ad rank, ties on id as resolveAuction breaks them. */
function rankEntrants(entrants) {
  const rows = entrants.map((entrant, index) => ({
    index,
    id: entrant.id,
    bidPaise: entrant.bidPaise,
    qualitySignal: entrant.qualitySignal,
    adRank: adRank(entrant.bidPaise, entrant.qualitySignal),
  }));
  rows.sort((a, b) => (b.adRank - a.adRank) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return rows;
}

/**
 * Slots and prices among the rows present in one search, by resolveAuction's
 * rules: slots in rank order to present rows that clear the floor, and each
 * shown row priced against the next PRESENT row beneath it, shown or not,
 * never below the reserve (B5).
 *
 * resolveSlice's test holds this to resolveAuction on every combination of
 * random auctions, so the two sets of rules cannot drift apart.
 */
function settleLadder(rows, present, position, cpc) {
  let filled = 0;
  for (let r = 0; r < rows.length; r++) {
    if (present[r] && rows[r].adRank >= AD_RANK_FLOOR && filled < MAX_SLOTS) {
      filled += 1;
      position[r] = filled;
    } else {
      position[r] = 0;
    }
  }
  let belowRank = AD_RANK_FLOOR;
  for (let r = rows.length - 1; r >= 0; r--) {
    if (!present[r]) continue;
    const row = rows[r];
    const beatRank = Math.max(belowRank, AD_RANK_FLOOR);
    cpc[r] = position[r]
      ? Math.min(row.bidPaise, Math.ceil(beatRank / row.qualitySignal) + MIN_INCREMENT_PAISE)
      : 0;
    belowRank = row.adRank;
  }
}
```

- [ ] **Step 4: Run** `npx vitest run tests/auction.test.js`. Expected: PASS,
  every old test untouched.
- [ ] **Step 5: Run** `npm test`. Expected: exit code 0 (nothing calls it yet).
- [ ] **Step 6: Commit**: "Resolve a slice in which some advertisers take part
  in only a share of the searches (F17)".

### Task 6: the round records slices, and the two paths agree

**Files:** `engine/money.js`, `tests/money.test.js`; `engine/round.js`;
`tests/round.test.js` (replace the describe at line ~829).

**Interfaces:**
- Consumes: `resolveSlice` (Task 5); `orderValuePaise` and each plan's
  `orderValuePaise` (Task 4).
- Produces: `roundPaise(value) → integer paise`. Inside `round.js`, an entrant
  carries `participation` in place of `_volume`, and
  `recordSlice({ result, tier, volume, … })` replaces `recordAuction`.
  `recordPairwise(pairwise, result, entrants, volume)` and
  `recordQualityRows(acc, result, entrants, volume)` read the slice's shares.
  `onlyTier` and its cache go.

- [ ] **Step 1: Write the failing round test.** In `tests/round.test.js`, add
  `import { locationMultiplier, clampBidPaise } from '../engine/strategies.js';`
  and replace the whole `describe('the two paths through the auction agree when they should', …)`
  block (its `targeted` state was never used) with:

```js
describe('the two paths through the auction agree when the bids do (G4, F17)', () => {
  /**
   * The guard the step 3 tripwire stood in for, and the second attempt at it.
   *
   * The first set every advertiser's place adjustments to [0, 0, 0] to force
   * the per-place path. But 0% is a multiplier of exactly 1, so the round never
   * took it: both states ran the flat path, and the test compared that path
   * with itself (found 2026-09-15). Meanwhile the paths disagreed with equal
   * bids, by 5% of one rival's impressions and 13% of its cost in this
   * fixture, because a nearly-spent advertiser held a slot in every search it
   * entered and a paisa of rounding decided whether it entered (F17).
   *
   * So the tilt here is a millionth of a percent: a multiplier that is not 1,
   * which sends the round down the three-auction path, on bids it leaves where
   * they were. Both premises are asserted first, because the old test failed
   * on a premise nobody checked.
   */
  const TILT = [0, 0, 0.0001];
  const tilted = () => {
    const state = makeGameState();
    state.advertisers[1].campaign.locationAdjustments = TILT;
    return state;
  };

  test('the tilt really forces the three-auction path, and moves no bid', () => {
    expect(locationMultiplier(TILT, 2)).not.toBe(1);
    for (const advertiser of makeGameState().advertisers) {
      for (const group of advertiser.adGroups) {
        for (const keyword of group.keywords) {
          // The fixture bids manually with no hour adjustments, so every
          // hour's bid is the keyword's.
          expect(clampBidPaise(keyword.bidPaise * locationMultiplier(TILT, 2), keyword))
            .toBe(clampBidPaise(keyword.bidPaise, keyword));
        }
      }
    }
  });

  test('and the market it plays is one where pacing throttles, which is where the paths parted', () => {
    const throttled = Object.values(EXPECTED.raw.byAdvertiser).filter((r) => r.lostToBudget > 0);
    expect(throttled.length).toBeGreaterThanOrEqual(3);
  });

  for (const mode of ['expected', 'sampled']) {
    test(`a tilt that moves no bid moves nothing, to the paisa (${mode})`, () => {
      const a = runRound(makeGameState(), { mode, seed: 3 }).raw.byAdvertiser;
      const b = runRound(tilted(), { mode, seed: 3 }).raw.byAdvertiser;
      for (const id of Object.keys(a)) {
        expect(b[id].costPaise, `${id} cost`).toBe(a[id].costPaise);
        expect(b[id].impressions, `${id} impressions`).toBeCloseTo(a[id].impressions, 6);
        expect(b[id].clicks, `${id} clicks`).toBeCloseTo(a[id].clicks, 6);
        expect(b[id].lostToRank, `${id} lost to rank`).toBeCloseTo(a[id].lostToRank, 6);
        expect(b[id].lostToBudget, `${id} lost to budget`).toBeCloseTo(a[id].lostToBudget, 6);
        for (const [tier, row] of a[id].byLocation) {
          expect(b[id].byLocation.get(tier).impressions, `${id} tier ${tier}`).toBeCloseTo(row.impressions, 6);
          expect(b[id].byLocation.get(tier).costPaise, `${id} tier ${tier}`).toBe(row.costPaise);
        }
      }
    });
  }

  test('and so does Auction Insights', () => {
    const a = runRound(makeGameState(), { mode: 'expected' }).insights;
    const b = runRound(tilted(), { mode: 'expected' }).insights;
    for (const [id, row] of Object.entries(a)) {
      for (const [rival, r] of Object.entries(row.rivals)) {
        expect(b[id].rivals[rival].overlapRate, `${id}/${rival}`).toBeCloseTo(r.overlapRate, 9);
        expect(b[id].rivals[rival].positionAboveRate, `${id}/${rival}`).toBeCloseTo(r.positionAboveRate, 9);
        expect(b[id].rivals[rival].outrankingShare, `${id}/${rival}`).toBeCloseTo(r.outrankingShare, 9);
      }
    }
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/round.test.js -t "two paths"`.
  Expected: the two premise tests PASS; *moves nothing* FAILS in both modes
  (kestrel's impressions about 115,263 against 109,345 in expected mode), and
  so does *Auction Insights*. This is the defect, seen by a test at last.
- [ ] **Step 3: `roundPaise`.** In `tests/money.test.js`, add `roundPaise` to
  the import and:

```js
describe('roundPaise: an average price becomes money once, where it is spent (F17)', () => {
  test('rounds half up, the rule mulRate uses', () => {
    expect(roundPaise(2.5)).toBe(3);
    expect(roundPaise(2.4999)).toBe(2);
    expect(roundPaise(1000.0000000000001)).toBe(1000);
  });
  test('agrees with mulRate for a whole price', () => {
    for (const [paise, rate] of [[1001, 0.37], [385, 12.5], [2883, 0.0413]]) {
      expect(roundPaise(paise * rate)).toBe(mulRate(paise, rate));
    }
  });
  test('refuses what is not a number', () => {
    for (const v of [NaN, Infinity, -Infinity]) expect(() => roundPaise(v)).toThrow(TypeError);
  });
});
```

  In `engine/money.js`, after `mulRate`:

```js
/**
 * Round an amount that is not yet money to integer paise, half up.
 *
 * For a price that is an AVERAGE of whole-paise prices: an advertiser taking
 * part in only a share of a slice's searches pays each ladder's whole-paise
 * price weighted by how often that ladder happens, which is rarely whole
 * (DECISIONS F17). It becomes money here, once, where it is spent, by the same
 * rule mulRate uses.
 *
 * @param {number} value finite
 * @returns {number} integer paise
 */
export function roundPaise(value) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`value must be finite, got ${String(value)}`);
  }
  return roundHalfUp(value);
}
```

  Run `npx vitest run tests/money.test.js`. Expected: PASS.
- [ ] **Step 4: The round.** In `engine/round.js`:
  - Imports: `import { assertPaise, mulRate, allocate } from './money.js';`
    becomes `import { assertPaise, allocate, roundPaise } from './money.js';`
    (check `mulRate` has no other use in the file first; if it has, keep it).
    `import { resolveAuction } from './auction.js';` becomes
    `import { resolveSlice } from './auction.js';`.
  - The comment above `const locationMultipliers` (*WHO IS BIDDING DIFFERENTLY
    BY PLACE*) becomes:

```js
  // WHO IS BIDDING DIFFERENTLY BY PLACE, and therefore which path the loop takes.
  //
  // Three locations are three genuinely separate auctions and the honest
  // implementation resolves three. Measured, that is 531ms against a 400ms
  // budget. But when nobody adjusts their bid by location, the entrants, their
  // bids and their quality are identical in all three, so the three results
  // are too: the flat path resolves the slice once and records it place by
  // place, adding exactly what three resolutions would.
  //
  // So: one resolution while the market is flat, three the moment anyone
  // tilts. A player who never touches the control pays nothing for it, and
  // `round.test.js` holds the two paths to the paisa with a tilt that moves no
  // bid. The test that stood there before never took the second path (F17).
```

  - The entrant: `_volume: hourVolume * participation,` becomes
    `participation,` (the searches it enters are the slice's volume times this,
    and `resolveSlice` needs the share itself).
  - The flat path (`if (!anyoneTargets) { … continue; }`) becomes:

```js
          if (!anyoneTargets) {
            // FLAT MARKET: one resolution, recorded one place at a time. Cost
            // is rounded to the paisa once per record, so recording the whole
            // auction at once would part this path from the three-auction one
            // by a paisa here and there.
            const result = resolveSlice(entrants);
            for (let tier = 0; tier < tiers; tier++) {
              const share = shares[q][tier];
              if (share <= 0) continue;
              recordSlice({
                result, tier, volume: hourVolume * share, entrants, acc, pairwise,
                convAccum, advertisers, business, query, hour, effectsByAdvertiser,
                budgets, perAdvertiserRng, mode,
              });
            }
            continue;
          }
```

  - The three-auction path: delete `_volume: e._volume * share,` from the
    `here.push({…})`, and replace its `const { ladder } = resolveAuction(here);`
    and `recordAuction({…});` with:

```js
            recordSlice({
              result: resolveSlice(here), tier, volume: hourVolume * share,
              entrants: here, acc, pairwise, convAccum, advertisers, business,
              query, hour, effectsByAdvertiser, budgets, perAdvertiserRng, mode,
            });
```

  - Replace `recordAuction`, `recordPairwise` and `recordQualityRows` (keep
    `keywordForQuery` and `bump`; delete `onlyTier` and `ONLY_TIER`) with:

```js
/**
 * Record one place's searches of a resolved slice.
 *
 * Called once per place on both paths, so the flat path, which resolves a
 * slice once for all three places, adds exactly what three resolutions would:
 * the same numbers, in the same order for each advertiser, rounded at the same
 * points, and drawing the same random numbers (F17).
 *
 * Every entrant is recorded, not only the shown: one that takes part in a
 * share of the searches shows in a share of them, and lostToRank is the rest
 * of what it entered.
 */
function recordSlice({
  result, tier, volume, entrants, acc, pairwise, convAccum,
  advertisers, business, query, hour, effectsByAdvertiser,
  budgets, perAdvertiserRng, mode,
}) {
  for (let x = 0; x < entrants.length; x++) {
    const e = entrants[x];
    const i = e._i;
    const a = acc[i];
    const shownShare = result.shown[x];
    // What it entered and did not show in. Clamped, because the share is a
    // sum of products and can pass the participation by a rounding error.
    a.lostToRank += volume * Math.max(0, e.participation - shownShare);
    if (shownShare <= 0) continue;

    // Each slot's share of the searches, weighted by that slot's click-through.
    const at = x * MAX_SLOTS;
    let ctrShare = 0;
    let topShare = 0;
    for (let k = 0; k < MAX_SLOTS; k++) {
      ctrShare += result.positions[at + k] * POSITION_CTR_MULTIPLIERS[k];
      if (k < TOP_SLOTS) topShare += result.positions[at + k];
    }
    const impressions = volume * shownShare;
    const clicks = volume * e.qualitySignal * ctrShare;
    // An average of whole-paise prices, so it becomes money here, once.
    const cost = roundPaise(result.cpcPaise[x] * clicks);

    a.impressions += impressions;
    a.clicks += clicks;
    a.hourlyClicks[hour] += clicks;
    a.costPaise += cost;
    a.spentTodayPaise += cost;
    for (let k = 0; k < MAX_SLOTS; k++) a.positionCounts[k] += volume * result.positions[at + k];
    a.topImpressions += volume * topShare;
    a.absTopImpressions += volume * result.positions[at];
    budgets[i].weekSpentPaise += cost;
    budgets[i].monthSpentPaise += cost;

    bump(a.byKeyword, e._plan.keyword.id, impressions, clicks, cost);
    bump(a.byQuery, query.id, impressions, clicks, cost);
    bump(a.byLocation, tier, impressions, clicks, cost);

    // Conversions accumulate per advertiser, query and place, and are queued
    // once at the end of the round: 1,350 queue calls instead of 226,800.
    if (clicks > 0) {
      // NOT touched by location, deliberately. Conversion already carries query
      // affinity, PURPOSE_MODIFIERS and the hourly curve, and F10 and F11 are
      // both records of what two mechanisms pushing one number costs. Where you
      // are changes the basket and the odds it comes back, not the odds of a sale.
      const convRate = effectiveConvRate({
        business: business[i], query, position: advertisers[i].position,
        advertiserId: advertisers[i].id, hour,
      });
      if (convRate > 0) {
        const converted = clicks * convRate;
        recordConversions({
          i, e, tier, converted, advertisers, business, query,
          effectsByAdvertiser, convAccum, perAdvertiserRng, mode,
        });
        // Kept separately from the money buckets, which are per query because
        // order value and return rate are. This one is per hour and counts
        // only, which is all the hour-of-day history needs.
        a.hourlyConv[hour] += converted;
      }
    }
  }

  recordPairwise(pairwise, result, entrants, volume);
  recordQualityRows(acc, result, entrants, volume);
}
```

  - `recordConversions` is the bucket code that was inside `recordAuction`'s
    `for (let t = 0; t < tiers; t++)` loop, for the one place this record is
    about, with every comment kept:

```js
/**
 * One place's conversions, into this query's bucket for that place.
 *
 * ONE BUCKET PER QUERY AND LOCATION. The basket and the return rate are both
 * per location, and they are the only two things location changes - so merging
 * the tiers here would leave the location report able to show clicks and cost
 * and nothing about what the money did, which is the whole lesson. Conversion
 * RATE is location-independent by design, so each place's count is its own
 * clicks times the one rate.
 */
function recordConversions({
  i, e, tier, converted, advertisers, business, query,
  effectsByAdvertiser, convAccum, perAdvertiserRng, mode,
}) {
  const base = orderValuePaise(e._plan.orderValuePaise, business[i], perAdvertiserRng[i], mode);
  const discountPaise = advertisers[i].campaign?.prepaidDiscountPaise ?? 0;
  const effects = effectsByAdvertiser[i];
  const key = `${query.id}\x00${tier}`;
  const bucket = convAccum[i].get(key)
    ?? {
      queryId: query.id, tier, count: 0, valuePaise: 0,
      returnWeighted: 0, refusedWeighted: 0,
    };
  bucket.count += converted;
  // The discount is paid on PREPAID orders only — that is what it is for
  // — so it costs the discount times the prepaid share of the mix it
  // just created. Flat rupees, so it is 4.2% of a value basket and 1.0%
  // of a premium one (I34).
  const prepaidShare = 1 - codShareFor(advertisers[i].position.price, tier, discountPaise);
  bucket.valuePaise += converted * Math.max(
    0, base * effects.aovMultiplier[tier] - discountPaise * prepaidShare,
  );

  // What comes back from these orders, refused at the door or sent back
  // after it, each half with its own lever (I28, I29, I34). The arithmetic
  // is `returnHalves`, so the prepaid card's forecast is this line and
  // not a copy of it.
  const back = returnHalves({
    business: business[i],
    queryReturnMultiplier: query.returnRateMultiplier ?? 1,
    placeReturnMultiplier: effects.returnMultiplier[tier],
    price: advertisers[i].position.price,
    tierIndex: tier,
    discountPaise,
  });
  bucket.returnWeighted += converted * back.returned;
  // Carried so the freight on a refused parcel can be charged to the
  // round that earned it. Weighted the same way, because a bucket is a
  // cohort and not a single order.
  bucket.refusedWeighted += converted * back.refused;
  convAccum[i].set(key, bucket);
}

/**
 * Auction Insights is computable only because the ladder keeps its losers
 * (L3), and each count is now the searches in which it happened: a pair is
 * counted only in the searches both were in (F17).
 */
function recordPairwise(pairwise, result, entrants, volume) {
  const n = entrants.length;
  for (let x = 0; x < n; x++) {
    if (result.shown[x] <= 0) continue;
    const i = entrants[x]._i;
    pairwise.aShown[i] += volume * result.shown[x];
    for (let y = 0; y < n; y++) {
      if (y === x) continue;
      const j = entrants[y]._i;
      pairwise.bothShown[i][j] += volume * result.both[x * n + y];
      pairwise.bAbove[i][j] += volume * result.above[x * n + y];
      pairwise.aShownBnot[i][j] += volume * result.shownNot[x * n + y];
    }
  }
}

/**
 * Own and field components, for the reported score (spec 9.3).
 *
 * The only accumulator that reaches across advertisers: the field is the
 * impression-weighted average of every OTHER advertiser shown on the same
 * literal query, weighted by the searches in which both showed, and it is
 * what makes "above average" mean anything.
 */
function recordQualityRows(acc, result, entrants, volume) {
  const n = entrants.length;
  for (let x = 0; x < n; x++) {
    const e = entrants[x];
    if (result.shown[x] <= 0 || !e._plan.literal) continue;
    const rows = acc[e._i].qualityRows;
    const key = e._plan.keyword.id;
    let row = rows.get(key);
    if (!row) {
      row = {
        impressions: 0,
        ownSum: { expectedCtr: 0, adRelevance: 0, landingPage: 0 },
        fieldSum: { expectedCtr: 0, adRelevance: 0, landingPage: 0 },
        fieldImpressions: 0,
      };
      rows.set(key, row);
    }
    const own = volume * result.shown[x];
    row.impressions += own;
    for (const c of COMPONENTS) row.ownSum[c] += own * e._plan.components[c];
    for (let y = 0; y < n; y++) {
      if (y === x) continue;
      const together = volume * result.both[x * n + y];
      if (together <= 0) continue;
      row.fieldImpressions += together;
      for (const c of COMPONENTS) row.fieldSum[c] += together * entrants[y]._plan.components[c];
    }
  }
}
```

  Before deleting `recordAuction`, diff its bucket code against
  `recordConversions` line by line: the arithmetic must be the same with `t`
  read as `tier` and `here` as `converted`, and nothing else.

  The bucket key's separator is written `\x00`, the same character as the old
  line's unicode escape. Typing that unicode escape into an editing tool turned
  it into a real NUL byte in this plan (found 2026-09-15), and a NUL byte makes
  git treat a file as binary. After editing `round.js`, confirm it has none:
  `git diff --stat` must list it with line counts, not as `Bin`.
- [ ] **Step 5: Run** `npx vitest run tests/round.test.js tests/auction.test.js tests/money.test.js`.
  Expected: PASS, including the two-paths tests from Step 1.
- [ ] **Step 6: Run** `npm test` and read every failure. Each is one of:
  - **A pinned market figure** (a count, a rupee amount, a share measured off a
    played round) that moved. Confirm it moved the way the fix predicts (the
    rival beneath a throttled advertiser gains, a price set against one falls)
    and by an amount of the size the prototype measured. Then update it, with a
    comment naming F17 and the old value.
  - **An invariant, a balance ordering or a known trap** (anything in
    `tests/calibration.test.js`, `tests/writerBalance.test.js`, the F13
    asymmetry, the two quality-and-CPC tests, broadening lowering impression
    share, pacing never skipping an auction). **Stop and report to the owner**
    with the figure before and after.
  Repeat until exit code 0.
- [ ] **Step 7: Run** `npm run lint` (part of `npm test`, but check nothing
  left in `round.js` is unused: `mulRate`, `onlyTier`, `resolveAuction`).
- [ ] **Step 8: Run** `npm run test:perf`. Expected: PASS on all three timed
  tests. Write down the four times for Task 7.
- [ ] **Step 9: Play a week in the browser** (CLAUDE.md: the build works means
  playing it). `npm run dev`, then `http://localhost:5173/ui/?look=studio`,
  *Start a new game*, round 0 through to week 2, and check the console is clean
  and Auction Insights shows rates between 0 and 100%.
- [ ] **Step 10: Commit**: "Put a throttled advertiser in only its share of the
  searches, and hold the two paths to the paisa (F17)".

### Task 7: measure the market after, and read the gates

- [ ] **Step 1: The harness.**
  Run: `node scripts/market-harness.js market after-f17 6`
  Copy the whole printed summary into *Measurements → After*.
- [ ] **Step 2: The calibration figures.**
  Run: `CALIBRATION_FIGURES=1 npx vitest run tests/calibration.test.js`
  Copy every `[figure]` line into *Measurements → After*.
- [ ] **Step 3: The times** from Task 6 Step 8, into *Measurements → After*.
- [ ] **Step 4: Read each gate** against *Before* and *After*, and write a line
  per gate under *Measurements → Gates*: the figure before, after, and PASS,
  FAIL or FIRED. The harness's `compare` reads only `writer` runs, so compare
  the two summaries line by line; the rows are in the two JSON files if a gate
  needs a figure the summary does not print.
- [ ] **Step 5: If a correctness, performance or calibration gate fails, or a
  tripwire fires: stop.** Commit the measurements ("Record the market after
  F17") and bring the table to the owner. Do not start Task 8.
- [ ] **Step 6: Otherwise commit**: "Record the market after F17".

### Task 8: the record

**Files:** `DECISIONS.md`, `ENGINE_SPEC_v0.3.md`, `CLAUDE.md`, `HANDOVER.md`.

- [ ] **Step 1: DECISIONS F17**, after F16, titled
  `### F17. A throttled advertiser held its place in every search — \`FIXED\` (2026-09-15)`.
  Its sections, in this project's usual order:
  - **Real:** Google's budget pacing enters an advertiser in some of the
    auctions it is eligible for; in the rest, its ad is not there. (Check
    Google's own help page on "Limited by budget" before writing this line,
    and cite it. Never from memory: CLAUDE.md, the field guide rule.)
  - **Sim, before:** *What was found* above, with its numbers.
  - **The fix:** *The method* above: the independence decision, why
    enumeration and not a draw or a cutoff, why position and price average
    apart, and the cost.
  - **What it cost:** the prototype's time table, and Task 6's times.
  - **Measured:** *Measurements → Before, After, Gates*, copied in whole.
  - **Why it survived:** I1 and I3 play one entrant per auction; the two-paths
    test never took its second path; and one fixture round's numbers were
    plausible either way.
- [ ] **Step 2: A dated note under F2**, after *The trap this created and we
  had to fix*:
  "*Completed 2026-09-15 (F17).* Fractional participation fixed the budget
  cliff but left the throttled advertiser in the ladder for every search, so
  one resolution was not yet statistically equivalent to simulating each
  search. `resolveSlice` makes it so."
- [ ] **Step 3: A dated note under G4's *TWO PATHS THROUGH THE AUCTION*
  paragraph:**
  "*Corrected 2026-09-15 (F17).* The test named here set every place adjustment
  to 0%, a multiplier of exactly 1, so both of its states took the flat path.
  The paths disagreed with equal bids by up to 13% of one rival's cost. They now
  agree to the paisa: the flat path records its one resolution place by place,
  and the test uses a tilt that moves no bid. G4's own earlier note, a rounding
  step that moved one game by 15% of the player's profit, was this defect."
- [ ] **Step 4: Spec 13.4**, after the H1 paragraph and its code block:

```markdown
**A throttled advertiser is in only its share of the searches (F17).**
Participation is the share of a slice's searches an advertiser enters, and each
advertiser's pacer decides its own, so who is present in a search is
independent from one advertiser to the next. In the searches it stays out of it
is not in the ladder: it takes no slot and sets nobody's price. One resolution
weighs every combination of who is present by how likely it is:

    shown share    = P(present and shown)
    impressions   += weighted volume x shown share
    clicks        += weighted volume x quality x sum over slots of P(in slot) x slot CTR
    cost          += clicks x average price when shown, rounded to the paisa once
    lostToRank    += weighted volume x (participation - shown share)

With k throttled entrants that is 2^k ladders: one when nobody is throttled.
```

- [ ] **Step 5: CLAUDE.md, *Known traps*,** after the pacing trap:

```markdown
- **A throttled advertiser is in only its share of the searches, and the ladder
  has to know it.** Pacing's participation used to scale what an advertiser
  paid for but not where it stood, so a nearly-spent rival held a slot, and
  priced whoever sat above it, in searches it was not in. A paisa of rounding
  decided when, and the round's two paths disagreed by 13% with equal bids
  while their test compared one path with itself (F17). `resolveSlice` weighs
  every combination of who is present. Anything new that enters the ladder
  enters it with its participation, and a test that forces a code path asserts
  that it did.
```

- [ ] **Step 6: HANDOVER.** In *Start here*, item 7 of *What to do next*:
  replace the sentence about the two paths with "**FIXED 2026-09-15 (F17):** a
  throttled advertiser now holds its place only in the searches it enters; the
  two paths agree to the paisa, and a real test holds them" plus the gate
  table's headline (player's median rank and profit before and after). Update
  the test count line (*On `makeover`: … tests pass*) to what `npm test` now
  reports.
- [ ] **Step 7: The guide.** `ui/guide/chapters.js` line ~220 cites G4. Re-read
  that chapter against G4's new note (CLAUDE.md: a green guide test does not
  mean the chapter agrees). Search `ui/guide/` and `ui/words/` for "slot",
  "outrank", "budget" and "impression share", and read each hit against F17.
  Change nothing that is still true.
- [ ] **Step 8: Run** `npm test`. Expected: exit code 0.
- [ ] **Step 9: Commit**: "Record F17: a throttled advertiser is in only its
  share of the searches".

---

## Measurements

### Before (Task 3)

*(the harness summary, the calibration figures and the four times go here)*

### After (Task 7)

*(the same three, after)*

### Gates (Task 7)

| gate | before | after | result |
|---|---|---|---|
