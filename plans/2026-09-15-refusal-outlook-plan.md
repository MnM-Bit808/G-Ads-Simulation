# The prepaid card's refusal rate, from the engine's own arithmetic: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans
> (inline, the owner's choice for this project) task by task. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** the prepaid card's "Refusals" figure becomes the rate the account's
next week will actually run at — order confirmation, purpose and place included —
and a prepaid discount removes the refusals its own sourced figures say it
removes. Both measured before and after.

**Architecture:** one function works out what comes back from an order bought
at a place (`returnHalves`, in `engine/positions.js`). `round.js` books refusals
with it, and a second function, `refusalOutlook`, forecasts an account's rate
with it, so the booking and the forecast cannot drift apart — the same principle
as the negatives preview calling `blockedBy`. The prepaid card calls
`refusalOutlook` with the account's own position, capital, next round, discount
and places. Inside `returnHalves`, a discount scales refusals by the ratio of
refusal RATES (what I34 says it does) instead of the ratio of refused SHARES
(what the engine did). A `prepaid` mode in the committed market harness measures
what the discount is worth, before and after.

**Tech stack:** ES modules, no bundler; Vitest; ESLint.

**Spec:** decided with the owner in conversation, 2026-09-15: option **A**
(one engine function used by both the engine and the card) with **(i)** (fix the
engine so the discount matches its sourced figures), built on the two
prepaid-places branches. No design document; the decision and the measurement it
rests on are below, and go into DECISIONS I34 in Task 7. Background: DECISIONS
I28, I29, I34, F14.

## What was measured, and decided

144 games on the committed harness's player (F15's), rivals live, expected mode:
six cells × seeds 1–6 × {no capital, ₹80,000 of order confirmation at round 0} ×
{no discount, ₹30}. "The engine" means refused ÷ orders over settled weeks.

**The card's "Refusals" figure** (no discount, weeks 4–7, when order
confirmation is live):

| cell | card | engine, no capital | engine, full order confirmation |
|---|---|---|---|
| value / performance | 18.1% | 17.3% | 13.8% |
| value / lifestyle | 18.2% | 19.7% | 15.8% |
| mid / performance | 16.9% | 16.3% | 13.1% |
| mid / lifestyle | 16.9% | 18.6% | 14.9% |
| premium / performance | 13.8% | 14.1% | 11.3% |
| premium / lifestyle | 13.9% | 15.6% | 12.5% |

Three causes: order confirmation (÷1.25 from its live week; the card never knew),
purpose (`PURPOSE_MODIFIERS.ret` 0.91 / 1.09), and the place gradient plus each
search's own multiplier (`LOCATION_RETURN_MULTIPLIER`, `returnRateMultiplier`).

**The "X% fewer refusals" line** at ₹30: the card says 5.8–6.8%, the engine
delivers 4.5–4.9% — 72–77% of it, identical with and without capital. Cause:
`round.js:561–562` multiplies the unchanged return total by the refused SHARE at
the discounted mix, and that share is computed against a total in which the newly
delivered parcels are sent back at 30% — the relabelling I34 removed from the
other half. Worked: 100 mid orders in the towns give 17.9 refusals; ₹30 should
leave 16.7 by the sourced rates; the engine books 17.0.

**The forecast option A would give** (measured in the same 72 no-discount
accounts, per-search multipliers left at 1 because 16.1 withholds them): 0.91× to
1.02× of what the engine booked, within about a point everywhere.

**Found on the way, not in this plan:** no rival ever offers a prepaid discount
(0 in 1,728 rival decisions over 18 games; `prepaidNudge` reads a week whose
refusals have not come back). Flagged as its own task.

## Global constraints

- **Branches.** Main line: `claude/refusal-outlook`, cut from
  `claude/youthful-wilbur-d483aa` (the main-based prepaid-places fix, 3 commits
  on `main`). Makeover line: `claude/refusal-outlook-makeover`, cut from
  `claude/prepaid-places-makeover` (Task 8). This worktree switches to them; its
  own branch has no commits. `claude/youthful-wilbur-d483aa` stays checked out in
  its own worktree, untouched. Nothing is pushed or merged; that is the owner's.
- `npm test` before every commit, **checking its exit code**; never commit red.
  `npm run test:perf` alone, with no harness running, after Task 2.
- CLAUDE.md hard rules: the engine stays pure (the only module-level state
  allowed is a deterministic cache like `round.js`'s `ONLY_TIER`, and only if
  Task 2's perf check needs it); `ui/` names no engine constant
  (`tests/ui.test.js`); the form reads only what a controller could, so
  `refusalOutlook` takes no search and no query set (16.1).
- **An account with no discount must be bit-identical.** At no discount the
  new factor is exactly 1 (a finite number divided by itself), so every
  calibration and market figure without a discount stays to the paisa. Task 2
  checks that with the harness rather than assuming it.
- **Consequence to know about:** a saved game whose player used a discount will
  show slightly fewer refusals after this reaches `main` and the save replays.
  The save's fingerprint checks cost and clicks, which do not move, so no warning
  fires. Accepted; named in I34.
- Edit with the Edit tool, never shell heredocs.

## Stops for the owner

Report and wait; do not work past these.

1. **Task 2:** the `market` run is not identical before and after (something
   without a discount moved).
2. **Task 2:** after the change, ₹100 is the best rung in even one cell, or
   "none" is best in every cell. The first would end I34's "a little helps, a
   lot hurts"; the second would make the lever pointless. Never retune
   `PREPAID_DISCOUNT_CURVE` to fix it (HANDOVER: it is built from published
   deltas).
3. **Task 2:** `npm run test:perf` fails even with the cache.
4. **Task 4:** the realistic account's card misses the booked rate by a
   point or more. Report the number; do not widen the tolerance.
5. **Task 8:** a cherry-pick conflict reaches past import lines, the harness's
   mode table or where a paragraph sits in a document.

## File map

| file | task | job |
|---|---|---|
| `plans/2026-09-15-refusal-outlook-plan.md` | 0 | this plan |
| `scripts/market-harness.js`, `tests/marketHarness.test.js` | 1 | a `prepaid` mode: every rung against none |
| `engine/positions.js`, `engine/round.js`, `tests/positions.test.js`, `tests/round.test.js` | 2 | `returnHalves`, used by the round; the discount at the sourced rate |
| `engine/positions.js`, `tests/positions.test.js`, `tests/round.test.js` | 3 | `refusalOutlook`, the forecast |
| `ui/decisions.js`, `tests/decisions.test.js`, `tests/dashboard.test.js` | 4 | the card asks the forecast |
| `engine/report.js` | 5 | drop the place rows' unused `refusalRate` |
| (browser) | 6 | play it |
| `DECISIONS.md` (I34, I29), `HANDOVER.md`, `ui/guide/chapters.js` (re-read) | 7 | the record |
| all of the above, on the makeover line | 8 | the same work, re-measured there |

---

### Task 0: the branch, and this plan

- [ ] **Step 1:** `git status` is clean on `claude/gifted-bohr-c47bbb`, then
  `git switch -c claude/refusal-outlook claude/youthful-wilbur-d483aa`.
- [ ] **Step 2:** copy this file to `plans/2026-09-15-refusal-outlook-plan.md`.
- [ ] **Step 3:** `npm test`; expect exit 0 (the base branch's own suite).
- [ ] **Step 4: Commit** — "Plan the prepaid card's refusal rate from the
  engine's own arithmetic".

### Task 1: a `prepaid` mode in the market harness, and the "before" numbers

**Files:** `scripts/market-harness.js`; `tests/marketHarness.test.js`.

**Why committed:** I34's table was measured with a throwaway and its "less modest
since F14" figures on F14's harness, which is not this one. "Record the harness,
not just the result" (HANDOVER, *Writing a measurement harness*).

**Interfaces:**
- Produces: `RUNGS` (`PREPAID_DISCOUNT_CURVE`'s paise, none first);
  `prepaidDecision(paise)` → `(round, state) => decision | null`, the discount
  at round 1 merged with `keepAtWindow`'s week-5 capital decision;
  `prepaidRow({ seed, cell })` → `{ seed, cell, [paise]: netProfitPaise }` for
  every rung; CLI mode `prepaid`.

- [ ] **Step 1: Write the failing test** in `tests/marketHarness.test.js`,
  inside the existing describe (add `prepaidDecision, RUNGS` to its harness
  import):

```js
  test('the prepaid mode offers its rung from week 1 and still sends week 5\'s capital (I34, C8)', async () => {
    // A decision that dropped the capital would lose the second ₹1,20,000 and
    // measure a poorer player than any real one, which is C8 again.
    expect(RUNGS[0]).toBe(0);
    const { state } = await playMarket({
      seed: 1, cell: 'value|performance', rounds: 5, playerDecision: prepaidDecision(3000),
    });
    expect(state.advertisers.find((a) => a.id === PLAYER).campaign.prepaidDiscountPaise).toBe(3000);
    const budget = (round) => state.history.find((h) => h.round === round).byAdvertiser[PLAYER].budget.monthlyBudgetPaise;
    expect(budget(5)).toBe(MONTHLY_BUDGET_PAISE + CAPEX_ALLOCATION_PAISE);
  });
```

- [ ] **Step 2: Run** `npx vitest run tests/marketHarness.test.js`. Expected:
  FAIL, `prepaidDecision` is not exported.
- [ ] **Step 3: Implement** in `scripts/market-harness.js`. Add
  `PREPAID_DISCOUNT_CURVE` to the constants import, then after `capitalRow`:

```js
/** The rungs a player can pick (I34), none first. */
export const RUNGS = PREPAID_DISCOUNT_CURVE.map((r) => r.paise);

/**
 * The harness player with a prepaid discount from week 1. It still sends the
 * week-5 capital decision the form always sends: a decision that dropped it would
 * lose the second allocation and measure a poorer player (C8).
 */
export const prepaidDecision = (paise) => (round, state) => {
  const decision = { ...(keepAtWindow(round, state) ?? {}) };
  if (round === 1 && paise > 0) decision.campaign = { prepaidDiscountPaise: paise };
  return Object.keys(decision).length > 0 ? decision : null;
};

/** I34's comparison on one market: whole games at every rung, against none. */
export async function prepaidRow({ seed, cell }) {
  const out = { seed, cell };
  for (const paise of RUNGS) {
    const { state } = await playMarket({ seed, cell, playerDecision: prepaidDecision(paise) });
    out[paise] = gameTotals(state.history, PLAYER).all.netProfitPaise;
  }
  return out;
}
```

  and beside `summariseCapital`:

```js
function summarisePrepaid(rows) {
  const gain = (r, paise) => (r[paise] - r[0]) / Math.abs(r[0]);
  const paid = RUNGS.slice(1);
  const out = [`${rows.length} markets: a prepaid discount from week 1 at each rung, against none (I34)`];
  out.push(`  ${'cell'.padEnd(20)}${paid.map((p) => `₹${p / 100}`.padStart(17)).join('')}   best`);
  for (const cell of CELLS) {
    const mine = rows.filter((r) => r.cell === cell);
    const medians = paid.map((p) => median(mine.map((r) => gain(r, p))));
    const wins = paid.map((p) => mine.filter((r) => r[p] > r[0]).length);
    const top = medians.reduce((b, m, i) => (m > b.m ? { m, i } : b), { m: 0, i: -1 });
    const best = top.i < 0 ? 'none' : `₹${paid[top.i] / 100}`;
    out.push(`  ${cell.padEnd(20)}${medians.map((m, i) => `${pct(m)} (${wins[i]}/${mine.length})`.padStart(17)).join('')}   ${best}`);
  }
  return out.join('\n');
}
```

  Add `prepaid: [prepaidRow, summarisePrepaid]` to `MODES`, and a usage line
  `node scripts/market-harness.js prepaid <label> [workers]` with one sentence in
  the header: "`prepaid` is I34's comparison: every rung from week 1 against
  none, whole games."
- [ ] **Step 4: Run** `npm test`. Expected: exit 0.
- [ ] **Step 5: Commit** — "Give the market harness a prepaid mode, so I34 can
  be measured again".
- [ ] **Step 6: Measure BEFORE** (nothing else running):
  `node scripts/market-harness.js prepaid before-i 6` and
  `node scripts/market-harness.js market before-i 6`. Keep both printed
  summaries and both output paths for Task 7.

### Task 2: one return arithmetic, and the discount at the sourced rate

**Files:** `engine/positions.js` (new `returnHalves` after `businessFor`, ~line
139; imports); `engine/round.js` (import at ~45 and ~47; ~488–496; ~525–570);
`tests/positions.test.js`; `tests/round.test.js`.

**Interfaces:**
- Produces: `returnHalves({ business, queryReturnMultiplier,
  placeReturnMultiplier, price, tierIndex, discountPaise = 0 })` →
  `{ returned, refused }`, per order, `refused <= returned <=
  RETURN_RATE_CLAMP_MAX`.

- [ ] **Step 1: Write the failing engine test** in `tests/round.test.js`. Add
  imports: `startGame` from `../setup.js`, `submitRound` from `../game.js`,
  `QUERY_SET` from `../content/querySet.js`, `BRAND_IDENTITIES` from
  `../content/brands.js`, `homeCell` from `../engine/querySet.js`,
  `businessFor, realisedBreakEvenCpcPaise` from `../engine/positions.js`, and
  `refusalRateFor` beside `locationSharesFor`. Then:

```js
/**
 * Refusals as a played week books them.
 *
 * ONE SEARCH, WHOSE OWN RETURN MULTIPLIER IS EXACTLY 1, so every refusal comes
 * from position, place, capital and discount and nothing else — which is what
 * lets these tests hold the engine to the digit. Order confirmation is bought at
 * round 0 and goes live at week 4 (CAPEX_DELAY_ROUNDS), so weeks 1-3 run without
 * it and week 4 with it. Nine weeks, so week 4's returns have all come back: up
 * to three weeks for the sale to land and two for the return.
 */
describe('refusals as a played week books them (I29, I34)', { timeout: 60_000 }, () => {
  const POSITION = { price: 'mid', purpose: 'performance' };
  const SEARCH = QUERY_SET.queries
    .filter((q) => homeCell(q) === 'mid|performance' && q.returnRateMultiplier === 1 && q.intent !== 'brand')
    .sort((a, b) => b.volumeShareBp - a.volumeShareBp)[0];
  const games = new Map();
  const played = (discountPaise) => {
    if (games.has(discountPaise)) return games.get(discountPaise);
    const breakEven = realisedBreakEvenCpcPaise(
      businessFor(POSITION, { committed: {}, pending: [] }, 1), QUERY_SET, POSITION,
    );
    let state = startGame({
      rootSeed: 20260902,
      playerBrandId: BRAND_IDENTITIES[0].id,
      querySet: QUERY_SET,
      player: {
        position: POSITION,
        capex: { orderConfirmation: 8000000 },
        keywords: [{ text: SEARCH.text, matchType: 'exact', bidPaise: Math.round(breakEven * 1.2) }],
        ad: {
          headlines: ['Activewear Built To Train In', 'Free Delivery Across India', 'Sizes XS To XXL'],
          descriptions: [
            'Leggings, tights and sports bras that hold through 4 sessions a week.',
            'Easy returns within 30 days, and cash on delivery everywhere.',
          ],
          landingPageDescription: 'A plain product page.',
        },
        writerTier: 'freelancer',
      },
    });
    const id = state.advertisers[0].id;
    for (let week = 1; week <= 9; week++) {
      const decisions = week === 1 && discountPaise > 0
        ? { [id]: { campaign: { prepaidDiscountPaise: discountPaise } } } : {};
      state = submitRound(state, decisions, { mode: 'expected' }).nextGameState;
    }
    const game = { state, id };
    games.set(discountPaise, game);
    return game;
  };
  const place = ({ state, id }, week, tier) => state.history[week - 1].byAdvertiser[id].breakdown.byLocation[tier];

  test('a discount takes refusals off at the sourced rate, and leaves send-backs and sales alone', () => {
    // I34 says the refusals a discount prevents leave the account. The first
    // build scaled them by the refused SHARE at the new cash mix, which falls more
    // slowly than the refusal RATE, so about a quarter of them stayed.
    expect(SEARCH, 'a mid|performance search at multiplier 1').toBeTruthy();
    for (let t = 0; t < LOCATION_TIERS.length; t++) {
      const none = place(played(0), 1, t);
      const paid = place(played(3000), 1, t);
      expect(none.conversions, `place ${t} has sales to measure`).toBeGreaterThan(1);
      expect(paid.conversions, `place ${t}`).toBeCloseTo(none.conversions, 9);
      expect((paid.refused / paid.conversions) / (none.refused / none.conversions), `place ${t}`)
        .toBeCloseTo(refusalRateFor('mid', t, 3000) / refusalRateFor('mid', t, 0), 6);
      expect(paid.sentBack / paid.conversions, `place ${t}`).toBeCloseTo(none.sentBack / none.conversions, 9);
    }
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/round.test.js -t "books them"`.
  Expected: FAIL on the ratio — pre-measured 0.95401 received against 0.93903
  expected at place 0.
- [ ] **Step 3: Write the unit tests** in `tests/positions.test.js`. Add
  `returnHalves` to the positions import; `refusalRateFor, rtoShareOfReturns`
  from `../engine/locations.js`; `LOCATION_TIERS, RETURN_RATE_CLAMP_MAX` to the
  constants import. Then:

```js
describe('what comes back from an order at a place (I28, I29, I34)', () => {
  const MID = { price: 'mid', purpose: 'performance' };
  const EMPTY = { committed: {}, pending: [] };
  const full = (target) => ({ committed: { [target]: 8000000 }, pending: [] });
  const top = CAPEX_TIER_CURVE[CAPEX_TIER_CURVE.length - 1].effect;
  const at = (over = {}) => returnHalves({
    business: businessFor(MID, EMPTY, 1), queryReturnMultiplier: 1, placeReturnMultiplier: 1,
    price: 'mid', tierIndex: 2, discountPaise: 0, ...over,
  });
  const sentBack = (x) => x.returned - x.refused;

  test('with nothing bought, it is the whole return level, split at the sourced share', () => {
    const x = at();
    expect(x.returned).toBeCloseTo(businessFor(MID, EMPTY, 1).returnRateBeforeSizeGuide, 12);
    expect(x.refused / x.returned).toBeCloseTo(rtoShareOfReturns('mid', 2, 0), 12);
  });

  test('order confirmation divides refusals and nothing else', () => {
    const x = at({ business: businessFor(MID, full('orderConfirmation'), 1) });
    expect(x.refused).toBeCloseTo(at().refused / top, 12);
    expect(sentBack(x)).toBeCloseTo(sentBack(at()), 12);
  });

  test('the size guide divides send-backs and nothing else', () => {
    const x = at({ business: businessFor(MID, full('sizeGuide'), 1) });
    expect(x.refused).toBeCloseTo(at().refused, 12);
    expect(sentBack(x)).toBeCloseTo(sentBack(at()) / top, 12);
  });

  test('a discount takes refusals off at the sourced rate, and leaves send-backs where they were', () => {
    for (let t = 0; t < LOCATION_TIERS.length; t++) {
      const none = at({ tierIndex: t });
      const paid = at({ tierIndex: t, discountPaise: 3000 });
      expect(paid.refused / none.refused, `place ${t}`)
        .toBeCloseTo(refusalRateFor('mid', t, 3000) / refusalRateFor('mid', t, 0), 12);
      expect(sentBack(paid), `place ${t}`).toBeCloseTo(sentBack(none), 12);
    }
  });

  test('nothing comes back past the clamp, and refusals never exceed returns', () => {
    const x = at({ queryReturnMultiplier: 5, placeReturnMultiplier: 5 });
    expect(x.returned).toBeLessThanOrEqual(RETURN_RATE_CLAMP_MAX);
    expect(x.refused).toBeLessThanOrEqual(x.returned);
  });
});
```

- [ ] **Step 4: Run** `npx vitest run tests/positions.test.js`. Expected: FAIL,
  `returnHalves` is not exported.
- [ ] **Step 5: Implement `returnHalves`** in `engine/positions.js`, directly
  after `businessFor`. Add `import { refusalRateFor, rtoShareOfReturns } from
  './locations.js';` below the existing imports (no cycle: `locations.js`
  imports only `constants.js` and `querySet.js`).

```js
/**
 * What comes back from one order bought at one place: every return, and the
 * part of it refused at the door.
 *
 * THE ONE PLACE THIS ARITHMETIC LIVES. `round.js` books an order's returns with
 * it and `refusalOutlook` forecasts an account's refusal rate with it, so what
 * the prepaid card says and what the week then does cannot drift apart. Until
 * 2026-09-15 the card had a formula of its own, and it missed order
 * confirmation, purpose and the place gradient (I29, I34).
 *
 * @param {object} args
 * @param {object} args.business from `businessFor`: the return level before the
 *   size guide, and both capital effects
 * @param {number} args.queryReturnMultiplier the search's own multiplier; 1
 *   where the caller may not know it (16.1)
 * @param {number} args.placeReturnMultiplier
 *   `locationEffects(...).returnMultiplier[tierIndex]`
 * @param {string} args.price a `PRICE_TIERS` entry
 * @param {number} args.tierIndex into `LOCATION_TIERS`
 * @param {number} [args.discountPaise] the prepaid discount, 0 for none
 * @returns {{returned: number, refused: number}} per order, with
 *   refused <= returned <= RETURN_RATE_CLAMP_MAX
 */
export function returnHalves({
  business, queryReturnMultiplier, placeReturnMultiplier, price, tierIndex, discountPaise = 0,
}) {
  // [MOVED from round.js ~488-491: "The return rate for this query BEFORE the
  // size guide was divided into it ..." — keep its words.] Clamped twice, as the
  // round always has: once for the search, once for the place.
  const gross = Math.min(
    RETURN_RATE_CLAMP_MAX,
    Math.min(RETURN_RATE_CLAMP_MAX, business.returnRateBeforeSizeGuide * queryReturnMultiplier)
      * placeReturnMultiplier,
  );

  // [MOVED from round.js ~525-536, unchanged: "I28 BUILD 2: THE SIZE GUIDE ONLY
  // REACHES HALF OF THIS." and its paragraphs.]
  // [MOVED from round.js ~540-544, unchanged: "EACH TARGET REDUCES ITS OWN HALF
  // AND ONLY ITS OWN HALF (I29)."]
  // [MOVED from round.js ~545-558, unchanged: "I34: THE DISCOUNT REMOVES
  // REFUSALS, IT DOES NOT RELABEL THEM." — then add:]
  //
  // AND IT REMOVES THEM AT THE SOURCED RATE (2026-09-15). The second version took
  // refusals as the refused SHARE at the discounted mix times the total before
  // it. That share is worked out against a total in which the newly delivered
  // parcels are sent back at POST_DELIVERY_RETURN_RATE — the relabelling this
  // comment says was removed — so it falls more slowly than the refusal rate,
  // and about a quarter of the refusals the discount should prevent stayed: 100
  // mid orders in the towns gave 17.9 refusals, ₹30 should leave 16.7, and the
  // round booked 17.0. Measured over 72 accounts, the prepaid card promised
  // 5.8-6.8% fewer and the round delivered 4.5-4.9%. So the refused half falls
  // by exactly the ratio of the two refusal rates, and with no discount that
  // ratio is exactly 1, which keeps every account without one to the paisa.
  const refusedShare = rtoShareOfReturns(price, tierIndex, 0);
  const cut = refusalRateFor(price, tierIndex, discountPaise) / refusalRateFor(price, tierIndex, 0);
  const refused = (gross * refusedShare * cut) / business.orderConfirmationEffect;
  const sentBack = (gross * (1 - refusedShare)) / business.sizeGuideEffect;
  const returned = Math.min(RETURN_RATE_CLAMP_MAX, refused + sentBack);
  return { returned, refused: Math.min(returned, refused) };
}
```

  (The bracketed lines are instructions: move those comment blocks from
  `round.js` word for word to the places shown. No bracket survives.)
- [ ] **Step 6: Call it from `engine/round.js`.** Add `returnHalves` to the
  `./positions.js` import (~45). Delete the comment and `queryReturnGross` at
  ~488–491 and ~493–496; keep `discountPaise` (~492), which the order value
  still uses at ~520. Replace ~525–570 (from the I28 BUILD 2 comment through
  `bucket.refusedWeighted += ...`) with:

```js
          // What comes back from these orders, refused at the door or sent back
          // after it, each half with its own lever (I28, I29, I34). The arithmetic
          // is `returnHalves`, so the prepaid card's forecast is this line and
          // not a copy of it.
          const back = returnHalves({
            business: business[i],
            queryReturnMultiplier: query.returnRateMultiplier ?? 1,
            placeReturnMultiplier: effects.returnMultiplier[t],
            price: advertisers[i].position.price,
            tierIndex: t,
            discountPaise,
          });
          bucket.returnWeighted += here * back.returned;
          // Carried so the freight on a refused parcel can be charged to the
          // round that earned it. Weighted the same way, because a bucket is a
          // cohort and not a single order.
          bucket.refusedWeighted += here * back.refused;
```

  Then `grep -n "rtoShareOfReturns\|RETURN_RATE_CLAMP_MAX" engine/round.js` and
  drop from the imports whichever no longer appears (lint fails otherwise).
- [ ] **Step 7: Run** `npx vitest run tests/positions.test.js tests/round.test.js`.
  Expected: PASS.
- [ ] **Step 8: Run** `npm test`. Expected: exit 0. Nothing that pins a figure
  uses a discount (checked while planning: no test names
  `prepaidDiscountPaise` outside the card's), so no pinned figure should move.
  If one does, that is stop 1's question: stop.
- [ ] **Step 9: Run** `npm run test:perf` alone. Expected: PASS. If it fails,
  cache `refusedShare` and `cut` per `price|tier|discount` in a module-level
  `Map` in `positions.js`, with a comment citing `ONLY_TIER` in `round.js` as
  the precedent (three tiers × three prices × five rungs, every answer
  deterministic), re-run; if it still fails, stop 3.
- [ ] **Step 10: Commit** — "Take a discount's refusals off at the sourced rate,
  in one arithmetic the round and a forecast can share (I34)".
- [ ] **Step 11: Measure AFTER:** `node scripts/market-harness.js prepaid
  after-i 6` and `node scripts/market-harness.js market after-i 6`. Then:

```bash
node -e "const fs=require('fs'),os=require('os'),p=require('path');const r=(l)=>fs.readFileSync(p.join(os.tmpdir(),'harness-'+l+'-market.json'),'utf8');console.log(r('before-i')===r('after-i')?'market identical':'MARKET DIFFERENT')"
```

  Expected: `market identical` (no rival discounts and the harness player does
  not, so nothing should move). Anything else is stop 1. Read the prepaid table
  against stop 2. Keep both summaries for Task 7.

### Task 3: the forecast, `refusalOutlook`

**Files:** `engine/positions.js` (after `returnHalves`); `tests/positions.test.js`;
`tests/round.test.js`.

**Interfaces:**
- Consumes: `returnHalves` (Task 2); `businessFor`; `locationEffects` from
  `./locations.js`.
- Produces: `refusalOutlook({ position, capex, round, discountPaise = 0,
  placeWeights })` → refusals per order, 0..1; throws `RangeError` when
  `placeWeights` is not one weight per `LOCATION_TIERS` entry or sums to nothing.

- [ ] **Step 1: Write the failing tests.** In `tests/positions.test.js` (add
  `refusalOutlook` to the positions import; `CAPEX_DELAY_ROUNDS` and
  `PURPOSE_MODIFIERS` are already imported):

```js
describe('the refusal rate an account will run at (I34)', () => {
  const MID = { price: 'mid', purpose: 'performance' };
  const EMPTY = { committed: {}, pending: [] };
  const outlook = (over = {}) => refusalOutlook({
    position: MID, capex: EMPTY, round: 1, discountPaise: 0, placeWeights: [0, 0, 1], ...over,
  });

  test('it weights the places by where the account buys, at any scale', () => {
    const each = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((w) => outlook({ placeWeights: w }));
    expect(outlook({ placeWeights: [2, 3, 5] })).toBeCloseTo((2 * each[0] + 3 * each[1] + 5 * each[2]) / 10, 12);
    expect(outlook({ placeWeights: [20, 30, 50] })).toBeCloseTo(outlook({ placeWeights: [2, 3, 5] }), 12);
  });

  test('an account with no clicks is refused, not guessed at', () => {
    // Which place to show an account that has bought nothing is the card's
    // choice, and the card makes it; a quiet default here would hide it.
    expect(() => outlook({ placeWeights: [0, 0, 0] })).toThrow(RangeError);
    expect(() => outlook({ placeWeights: [1, 1] })).toThrow(RangeError);
  });

  test('order confirmation counts from the week it is live, and not before', () => {
    const building = {
      committed: { orderConfirmation: 8000000 },
      pending: [{ target: 'orderConfirmation', paise: 8000000, liveAtRound: 1 + CAPEX_DELAY_ROUNDS }],
    };
    const top = CAPEX_TIER_CURVE[CAPEX_TIER_CURVE.length - 1].effect;
    expect(outlook({ capex: building, round: CAPEX_DELAY_ROUNDS })).toBeCloseTo(outlook(), 12);
    expect(outlook({ capex: building, round: 1 + CAPEX_DELAY_ROUNDS })).toBeCloseTo(outlook() / top, 12);
  });

  test('it carries purpose: lifestyle returns more than performance, by the modifiers', () => {
    const lifestyle = outlook({ position: { price: 'mid', purpose: 'lifestyle' } });
    expect(lifestyle / outlook())
      .toBeCloseTo(PURPOSE_MODIFIERS.lifestyle.ret / PURPOSE_MODIFIERS.performance.ret, 12);
  });

  test('and a discount, at the sourced rate', () => {
    expect(outlook({ discountPaise: 3000 }) / outlook())
      .toBeCloseTo(refusalRateFor('mid', 2, 3000) / refusalRateFor('mid', 2, 0), 12);
  });
});
```

  And in `tests/round.test.js`, inside Task 2's describe (add `refusalOutlook`
  to its positions import):

```js
  test('the forecast is what the week books, place by place, before and after order confirmation', () => {
    // The card's figure and the round's booking share `returnHalves`. On a search
    // at multiplier 1 the forecast leaves nothing out, so it must agree to the
    // digit; if the round ever grows a term the forecast lacks, this fails.
    for (const discountPaise of [0, 3000]) {
      const game = played(discountPaise);
      const capex = game.state.advertisers[0].capex;
      for (const week of [1, 4]) {
        for (let t = 0; t < LOCATION_TIERS.length; t++) {
          const booked = place(game, week, t);
          const placeWeights = LOCATION_TIERS.map((_, i) => (i === t ? 1 : 0));
          expect(refusalOutlook({ position: POSITION, capex, round: week, discountPaise, placeWeights }),
            `₹${discountPaise / 100}, week ${week}, place ${t}`)
            .toBeCloseTo(booked.refused / booked.conversions, 6);
        }
      }
    }
  });
```

- [ ] **Step 2: Run** `npx vitest run tests/positions.test.js tests/round.test.js`.
  Expected: FAIL, `refusalOutlook` is not exported.
- [ ] **Step 3: Implement** in `engine/positions.js`, after `returnHalves`. Add
  `locationEffects` to the `./locations.js` import and `LOCATION_TIERS` to the
  constants import.

```js
/**
 * The refusal rate an account will run at next week, per order, at its own
 * places — the figure the prepaid card shows (I34).
 *
 * `returnHalves` at each place, weighted by where the account buys, so it
 * carries everything the round will apply: the price tier's cash mix, purpose's
 * return level, the place gradient, order confirmation once it is live, and the
 * discount.
 *
 * ONE THING IT LEAVES OUT, BY RULE: each search's own return multiplier, which
 * every view withholds (16.1). So it is exact for an account whose searches sit
 * at 1 and close otherwise — measured 2026-09-15 over 72 played accounts at
 * 0.91x to 1.02x of what the round booked, where the card's old cash-mix formula
 * was up to 4.3 points high once order confirmation was live.
 *
 * @param {object} args
 * @param {{price: string, purpose: string}} args.position
 * @param {{committed: object, pending?: object[]}} args.capex the account's own
 *   capital block, pending tranches included, so money still being built is not
 *   counted
 * @param {number} args.round the round about to be played
 * @param {number} [args.discountPaise] 0 for none
 * @param {number[]} args.placeWeights one per `LOCATION_TIERS` entry, any scale:
 *   the account's clicks by place, say
 * @returns {number} refusals per order, 0..1
 * @throws {RangeError} when the weights are the wrong length or hold nothing —
 *   which place an account with no clicks should be shown is the caller's call
 */
export function refusalOutlook({ position, capex, round, discountPaise = 0, placeWeights }) {
  const total = (placeWeights ?? []).reduce((a, w) => a + w, 0);
  if (placeWeights?.length !== LOCATION_TIERS.length || !(total > 0)) {
    throw new RangeError(`placeWeights must be ${LOCATION_TIERS.length} weights with something in them`);
  }
  const business = businessFor(position, capex, round);
  // Normalised to the price tier's own country, as the round's are. With a
  // price named, `locationEffects` does not read the query set.
  const places = locationEffects(null, position.price).returnMultiplier;
  let refused = 0;
  for (let t = 0; t < placeWeights.length; t++) {
    if (placeWeights[t] <= 0) continue;
    refused += placeWeights[t] * returnHalves({
      business, queryReturnMultiplier: 1, placeReturnMultiplier: places[t],
      price: position.price, tierIndex: t, discountPaise,
    }).refused;
  }
  return refused / total;
}
```

- [ ] **Step 4: Run** the two files. Expected: PASS (pre-measured: every place,
  both weeks, agreed to six decimals).
- [ ] **Step 5: Run** `npm test`. Expected: exit 0.
- [ ] **Step 6: Commit** — "Forecast an account's refusal rate with the round's
  own arithmetic".

### Task 4: the card asks the forecast

**Files:** `ui/decisions.js` (`prepaidOutlook` ~2104 and its JSDoc; the import
at ~37); `tests/decisions.test.js`; `tests/dashboard.test.js`.

**Interfaces:**
- Consumes: `refusalOutlook` (Task 3); the draft's `position`, `capexBlock`,
  `round`, `prepaidDiscountPaise` (all set by `createDraft`).
- Produces: `prepaidOutlook(draft, rows)` unchanged in shape,
  `{ now, none }`; `prepaidReading(ctx)` unchanged.

- [ ] **Step 1: Write the failing tests.** In `tests/decisions.test.js` add
  `CAPEX_TIER_CURVE` to the constants import and, inside the describe
  `'the prepaid card reads the account it is drawn for (I34)'`:

```js
  test('it counts order confirmation from the week it goes live', () => {
    // The card read the cash mix alone and showed the same figure whether or not
    // the player had bought order confirmation (I29).
    const at = (round) => {
      const state = makeGameState({ round });
      const me = state.advertisers.find((a) => a.id === PLAYER_ID);
      me.capex = {
        committed: { orderConfirmation: 8000000 },
        pending: [{ target: 'orderConfirmation', paise: 8000000, liveAtRound: 4 }],
        remainingUnallocatedPaise: 0,
      };
      return prepaidOutlook(createDraft(getSelfView(state, PLAYER_ID)), []).none;
    };
    const top = CAPEX_TIER_CURVE[CAPEX_TIER_CURVE.length - 1].effect;
    expect(at(4)).toBeCloseTo(at(3) / top, 12);
  });
```

  In `tests/dashboard.test.js`, replace the whole describe
  `'the prepaid card reads this account\'s own places, not the towns\''` (and
  its docstring) with the one below. Add `businessFor,
  realisedBreakEvenCpcPaise, refusalOutlook` from `../engine/positions.js`;
  `LOCATION_TIERS`, `COD_SHARE_BY_PRICE_LOCATION`, `RTO_RATE_COD`,
  `RTO_RATE_PREPAID` stay imported.

```js
/**
 * The prepaid card, read through the context the dashboard hands the form.
 *
 * TWO FAULTS, AND BOTH SHOWED A PLAUSIBLE NUMBER. The card asked its context for
 * `history` and `playerId`, which the dashboard never packed, so it read the
 * towns' rate for every account, every week. Then, with its own places, it
 * worked the rate out from the cash mix alone, which knows nothing of order
 * confirmation, purpose or the place gradient: on this account, with order
 * confirmation live, it read 16.9% where the week booked 12.9% (I29, I34). It
 * now asks `refusalOutlook`, the round's own arithmetic.
 *
 * Checked against what the engine BOOKED, through the report, and not against
 * the function the card calls: an expectation built by the code under test agrees
 * with it whatever it does. The forecast leaves out each search's own return
 * multiplier (16.1 withholds it), so this holds it to a point, not to the digit;
 * `round.test.js` holds it to the digit where the multiplier is 1.
 */
describe('the prepaid card shows the refusal rate this account runs at (I29, I34)', { timeout: 60_000 }, () => {
  const POSITION = { price: 'mid', purpose: 'performance' };

  // The game as ui/app.js holds it after nine weeks: the state, each week's
  // report, and the draft rebuilt from the account the last week produced. Nine,
  // so week 4 — the first with order confirmation live — has settled.
  let shared = null;
  const played = () => {
    if (shared) return shared;
    const breakEven = realisedBreakEvenCpcPaise(
      businessFor(POSITION, { committed: {}, pending: [] }, 1), QUERY_SET, POSITION,
    );
    const own = QUERY_SET.queries.filter((q) => homeCell(q) === 'mid|performance')
      .sort((a, b) => b.volumeShareBp - a.volumeShareBp).slice(0, 5);
    let state = startGame({
      rootSeed: 20260902,
      playerBrandId: BRAND_IDENTITIES[0].id,
      querySet: QUERY_SET,
      player: {
        position: POSITION,
        // The top rung from round 0, live from week 4.
        capex: { orderConfirmation: 8000000 },
        keywords: own.map((q) => ({ text: q.text, matchType: 'phrase', bidPaise: Math.round(breakEven * 0.7) })),
        ad: {
          headlines: ['Activewear Built To Train In', 'Free Delivery Across India', 'Sizes XS To XXL'],
          descriptions: [
            'Leggings, tights and sports bras that hold through 4 sessions a week.',
            'Easy returns within 30 days, and cash on delivery everywhere.',
          ],
          landingPageDescription: 'A plain product page.',
        },
        writerTier: 'freelancer',
      },
    });
    const playerId = state.advertisers[0].id;
    const reports = [];
    for (let week = 0; week < 9; week++) {
      const out = submitRound(state, {}, { mode: 'expected' });
      reports.push(out.report);
      state = out.nextGameState;
    }
    const draft = createDraft(getSelfView(state, playerId), {
      allocationRounds: state.budgetSchedule?.capexAllocationRounds,
    });
    shared = { state, reports, draft, playerId, view: { termsRange: 'all' } };
    return shared;
  };

  const booked = (game) => {
    const c = game.state.history[3].byAdvertiser[game.playerId].conversions;
    return c.refused / c.final;
  };
  // The card's old figure, worked out here from the sourced constants: the cash
  // mix alone, at this account's places.
  const cashMix = (game) => {
    const clicks = LOCATION_TIERS.map((_, tier) => game.state.history.reduce(
      (a, h) => a + (h.byAdvertiser[game.playerId].breakdown.byLocation[tier]?.clicks ?? 0), 0,
    ));
    const total = clicks.reduce((a, c) => a + c, 0);
    return clicks.reduce((a, c, tier) => {
      const cash = COD_SHARE_BY_PRICE_LOCATION[POSITION.price][tier];
      return a + c * (cash * RTO_RATE_COD + (1 - cash) * RTO_RATE_PREPAID);
    }, 0) / total;
  };

  test('with order confirmation live, it is within a point of what the week booked', () => {
    const game = played();
    // Neither of the card's old readings passes, or this would prove nothing.
    expect(Math.abs(cashMix(game) - booked(game)), 'the cash mix alone').toBeGreaterThan(0.03);
    const towns = refusalOutlook({
      position: POSITION, capex: game.draft.capexBlock, round: game.draft.round,
      placeWeights: LOCATION_TIERS.map((_, i) => (i === LOCATION_TIERS.length - 1 ? 1 : 0)),
    });
    expect(Math.abs(towns - booked(game)), 'the towns\' places, not this account\'s').toBeGreaterThan(0.015);

    expect(Math.abs(prepaidReading(formContext(game)).none - booked(game))).toBeLessThan(0.01);
  });

  test('and the form is handed no other advertiser\'s figures to do it', () => {
    // The obvious fix was `history: game.state.history`, and it would have
    // worked, but every report in it carries all nine advertisers' money,
    // traffic and quality. Nothing would have shown them, and nothing could
    // prove the form ignored them, which is why a controller is never handed
    // state. A function's own closure is not handed over; what it returns is,
    // so that is checked with the rest.
    const ctx = formContext(played());
    const handed = JSON.stringify({ ...ctx, places: ctx.places() });
    expect(handed).not.toMatch(/byAdvertiser/);
  });
});
```

  Pre-measured on this account: booked 12.89%, cash mix 16.85% (3.96 points
  off), towns 14.79% (1.89 off), forecast 12.46% (0.43 off).
- [ ] **Step 2: Run**
  `npx vitest run tests/decisions.test.js tests/dashboard.test.js`. Expected:
  FAIL on both new tests (the card still reads the cash mix: 1.0 against 1.25,
  and 16.85% against 12.89%).
- [ ] **Step 3: Implement** in `ui/decisions.js`. Delete
  `import { refusalRateFor } from '../engine/locations.js';` and add
  `refusalOutlook` to the existing `../engine/positions.js` import. Replace
  `prepaidOutlook`'s body:

```js
export function prepaidOutlook(draft, rows) {
  const clicks = rows.map((r) => r.clicks ?? 0);
  const placeWeights = clicks.some((c) => c > 0)
    ? clicks
    : LOCATION_TIERS.map((_, i) => (i === LOCATION_TIERS.length - 1 ? 1 : 0));
  const at = (discountPaise) => refusalOutlook({
    position: draft.position, capex: draft.capexBlock, round: draft.round, discountPaise, placeWeights,
  });
  return { now: at(draft.prepaidDiscountPaise), none: at(0) };
}
```

  and its JSDoc's first two paragraphs with:

```js
/**
 * The refusal rate this account runs at, with and without its prepaid discount.
 *
 * FROM THE ROUND'S OWN ARITHMETIC. `refusalOutlook` is the line the round books
 * refusals with, so the figure carries what next week will apply: order
 * confirmation from the week it is live, purpose, and the place gradient. Until
 * 2026-09-15 the card worked it out from the cash mix alone, which read the same
 * whether or not the player had bought order confirmation — up to 4.3 points
 * high once it was live — and promised a third more from a discount than the
 * round delivered (I29, I34).
 *
 * Weighted by where the account actually bought clicks once it has bought any,
 * and at the towns before then — the most cash-heavy place, so the card never
 * opens by understating what the discount is for.
```

  keeping the "THE PRICE TIER COMES FROM THE DRAFT" paragraph, and changing
  `@param {object} draft from createDraft` to name what it reads: "its position,
  capital block, round and discount". The card's words do not change: the figure
  they describe is now the true one.
- [ ] **Step 4: Run** the two files. Expected: PASS.
- [ ] **Step 5: Run** `npm test`. Expected: exit 0 (the four older prepaid tests
  hold: a discount still lowers the rate, value still reads above premium).
- [ ] **Step 6: Commit** — "Show the prepaid card the refusal rate the round
  will run, capital and purpose included (I29, I34)".

### Task 5: drop the place rows' unused `refusalRate`

**Files:** `engine/report.js` (~27 import, ~403).

It is the same no-capital, no-discount formula on every place row, and nothing
reads it. Deleting dead output needs no new test.

- [ ] **Step 1:** `git grep -n "refusalRate[^F]"`. Expected: only
  `engine/report.js` (~403). If anything else reads it, stop and report.
- [ ] **Step 2:** delete that line, and `refusalRateFor` from the import at ~27
  (`codShareFor` stays).
- [ ] **Step 3: Run** `npm test`. Expected: exit 0.
- [ ] **Step 4: Commit** — "Drop the place rows' refusalRate, a formula without
  capital or discount that nothing read".

### Task 6: play it

"The build works means playing it, not loading it" (CLAUDE.md).

- [ ] **Step 1:** start the dev server with the Browser pane's `preview_start`
  (`.claude/launch.json`; create it with `npm run dev` if this worktree lacks
  one). Fresh tab.
- [ ] **Step 2:** round 0 as mid / performance, ₹80,000 to order confirmation,
  a hired writer; run weeks 1–3.
- [ ] **Step 3:** read the prepaid card after week 2 and after week 3 (the draft
  for week 4, when order confirmation is live). Expected: the "No discount" figure
  drops by about a fifth (1.25 on the same places). Stage ₹30: the "fewer
  refusals" line reads about 7% and the undo works.
- [ ] **Step 4:** console clean (`read_console_messages`, errors only);
  screenshot the card at week 3 for the owner.

### Task 7: the record

**Files:** `DECISIONS.md` (I34, I29), `HANDOVER.md`, `ui/guide/chapters.js`
(re-read).

- [ ] **Step 1: I34.** Add a section after "LESS MODEST SINCE F14": **"A
  QUARTER SHORT OF ITS OWN FIGURES, AND A CARD THAT COULD NOT SEE CAPITAL
  (2026-09-15)"** — the measurement table above; the share-versus-rate cause and
  the worked example; the fix and why an account without a discount is untouched
  (the factor is exactly 1); Task 2's before and after prepaid tables from the
  committed harness, with labels, commands and the `market identical` check; the
  saved-game consequence. The "before" table is Task 1 Step 6's, the "after"
  Task 2 Step 11's. Mark "LESS MODEST SINCE F14" as measured on F14's
  harness and superseded by this table. After "Rivals pull it too (R6)", add:
  "**Not in play, found 2026-09-15:** no rival has ever offered one;
  `prepaidNudge` reads a week whose refusals have not come back. Open."
- [ ] **Step 2: Commit** — "Record in I34 that the discount fell a quarter
  short, and what it is worth now".
- [ ] **Step 3: I29 and HANDOVER.** I29: a short "what the player sees" note —
  order confirmation now moves the prepaid card's refusal figure from its live
  week, though nothing on screen names it as the cause. HANDOVER, *Still open*,
  "Two of the four capital targets still have no surface at all": say so there
  in the same words. Add this session to the prepaid bullet the fix branch
  wrote.
- [ ] **Step 4: The guide.** `grep -n "I28\|I29\|I34" ui/guide/chapters.js`;
  re-read every chapter that cites one against Tasks 2–4. Expected on this line:
  `returnsSplit` only; its "order confirmation and a prepaid discount reach only
  refusals" still holds and it quotes no size. Change a chapter only if it now
  says something false. Name what was re-read in the commit message.
- [ ] **Step 5: Run** `npm test`. Expected: exit 0 (`tests/guide.test.js` checks
  every citation exists).
- [ ] **Step 6: Commit** — "Record the prepaid card's forecast in I29 and
  HANDOVER".

### Task 8: the makeover line

- [ ] **Step 1:** `git switch -c claude/refusal-outlook-makeover
  claude/prepaid-places-makeover`; `npm test`, expect exit 0.
- [ ] **Step 2:** cherry-pick Task 0's and Task 1's commits. The harness here
  has `writer` and `compare` modes: add `prepaid` beside them in `MODES` and the
  usage block; check `harnessPlayer`'s signature here takes `(cell, writerTier)`
  and `playMarket` is called as this line defines it. `npm test`, commit if the
  pick needed changes.
- [ ] **Step 3: Measure BEFORE on this line** (its engine carries D13's bid
  clamp, so its market is not main's): `prepaid before-m 6` and
  `market before-m 6`.
- [ ] **Step 4:** cherry-pick Tasks 2, 3, 4 and 5. Before the card's pick,
  `grep -rn "prepaidOutlook\|prepaidReading\|refusalRateFor" ui/` on this line,
  so every place the Studio draws the card's figure goes through
  `prepaidOutlook`. `npm test` after each pick; `npm run test:perf` alone once.
- [ ] **Step 5: Measure AFTER:** `prepaid after-m 6`, `market after-m 6`, and
  `node scripts/market-harness.js compare <before> <after>` for the market
  (expected identical; stops 1 and 2 apply).
- [ ] **Step 6:** cherry-pick Task 7's commits, then put this line's own tables
  in I34 where they differ, and say so if they do not. Re-read the guide here:
  this line's `chapters.js` has more chapters, so repeat Task 7 Step 4's grep.
- [ ] **Step 7:** play it in the Studio as Task 6 does; screenshot.
- [ ] **Step 8:** `npm test`, exit 0; commit any line-specific changes.

## Self-review

- **Spec coverage:** A — one engine function shared by booking and card (Tasks
  2–4); (i) — the discount at the sourced rate (Task 2) with before/after (Tasks
  1, 2, 7); built on both prepaid-places branches (Tasks 0, 8); the report's
  stale field (Task 5); the record and the guide (Task 7); played in the browser
  (Tasks 6, 8).
- **Names used across tasks:** `returnHalves({ business, queryReturnMultiplier,
  placeReturnMultiplier, price, tierIndex, discountPaise })` → `{ returned,
  refused }`; `refusalOutlook({ position, capex, round, discountPaise,
  placeWeights })` → number; `prepaidDecision(paise)`, `prepaidRow`, `RUNGS`;
  `draft.capexBlock`, `draft.round`, `draft.position`, `draft.prepaidDiscountPaise`.
