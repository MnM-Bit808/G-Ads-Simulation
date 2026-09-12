# The debrief: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans
> (inline, the owner's choice for this project) task by task. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** end the game with a debrief read from the player's own game (moments
with an exact "what if I hadn't?", the budget "what if", six lessons) and a
guess-then-reveal of where each rival sat.

**Architecture:** a pure counterfactual replay in `game.js`; pure readings in
`ui/debrief/read.js`, tested on games played in the test; drawing in
`ui/debrief/render.js`; every sentence in `ui/words/debrief.js`; one new guide
chapter.

**Tech stack:** ES modules, no bundler; Vitest; ESLint.

**Spec:** `plans/2026-09-13-debrief.md`. Read it first.

## Global constraints

- Work on the branch `stage-c`. Commit after each green `npm test`; push only
  when the owner says.
- CLAUDE.md applies, hard rules included: the engine stays pure and untouched;
  money is integer paise; nothing in `ui/` names a withheld field.
- Before/after uses traffic only (`traffic`, `share`), never conversions or profit.
- `missedToBudget` weeks are never summed.
- Edit with the Edit tool, never shell heredocs.

## File map

| file | task | job |
|---|---|---|
| `game.js` | 1 | `logWithout`, `replayWithout` |
| `tests/game.test.js` | 1 | their tests |
| `ui/debrief/read.js` | 2, 3 | `moments`, `windowDifference`, `budgetWeeks`, `lessons`, `revealRows` |
| `tests/debrief.test.js` | 2, 3 | their tests |
| `ui/guide/chapters.js`, `ui/guide/figures.js` | 4 | the chapter *What only a simulation can tell you* |
| `ui/words/debrief.js`, `ui/debrief/render.js`, `ui/ending.js`, `ui/app.js`, `ui/round-zero.js`, `ui/style.css` | 5 | the two cards, the hidden column, `serpBlock` exported |
| `ui/style.css` | 6 | the reveal's motion |
| docs | 7 | HANDOVER, file count |

---

### Task 1: replay a game without one decision (`game.js`)

**Files:** modify `game.js` (after `replayLog`); test in `tests/game.test.js`.

**Interfaces produced:**
- `logWithout(decisionLog, { advertiserId, round })` returns a new array without
  that advertiser's entry for that round; every other entry kept, in order.
- `replayWithout(initialState, decisionLog, { advertiserId, round, ...options })`
  returns what `replayLog` returns (`{ finalState, reports, insights }`) for the
  log with that entry removed. `options` must include `throughRound` and should
  include `mode: 'expected'`.

- [ ] **Step 1: Write the failing tests** in a new `describe` at the end of
  `tests/game.test.js`, reusing the file's `startGame`, `playRound`,
  `controllerFor`, `QUERY_SET`, `homeCell` and `BRAND_IDENTITIES` imports:

  ```js
  describe('a game replayed without one decision (the debrief)', () => {
    const own = QUERY_SET.queries.filter((q) => homeCell(q) === 'mid|lifestyle').slice(0, 4);
    const PLAYER = BRAND_IDENTITIES[0].id;
    const initial = () => startGame({
      rootSeed: 20260902,
      playerBrandId: PLAYER,
      querySet: QUERY_SET,
      player: {
        position: { price: 'mid', purpose: 'lifestyle' },
        capex: { sizeGuide: 0, photography: 0, landingPage: 0 },
        keywords: own.map((q) => ({ text: q.text, matchType: 'broad', bidPaise: 3000 })),
        ad: {
          headlines: ['Everyday Co-ord Sets', 'Soft Lounge Sets', 'Sizes XS To XXL'],
          descriptions: [
            'Soft co-ord sets and lounge pants to wear all day.',
            'Free delivery over Rs 1,499 and 30-day returns.',
          ],
          landingPageDescription: 'A plain product page.',
        },
        writerTier: 'agency',
      },
    });
    const scripted = {
      2: { campaign: { negatives: [{ text: 'gym', matchType: 'broad' }] } },
      4: { campaign: { strategy: 'maxClicks' } },
    };

    async function playLive(weeks) {
      const start = initial();
      const controllers = Object.fromEntries(start.advertisers.map((a, i) => [
        a.id, i === 0 ? (self) => scripted[self.round] ?? null : controllerFor(a.policyId),
      ]));
      const sources = Object.fromEntries(start.advertisers.map((a, i) => [
        a.id, i === 0 ? 'player' : `policy:${a.policyId}`,
      ]));
      let state = start;
      const reports = [];
      while (state.round <= weeks) {
        const out = await playRound(state, controllers, { mode: 'expected', sources });
        reports.push(out.report);
        state = out.nextGameState;
      }
      return { start, state, reports };
    }

    const row = (report) => report.byAdvertiser[PLAYER].traffic;

    test('only that advertiser\'s entry for that round is taken out', async () => {
      const live = await playLive(4);
      const log = live.state.decisionLog;
      const without = logWithout(log, { advertiserId: PLAYER, round: 2 });
      expect(without).toHaveLength(log.length - 1);
      expect(without.some((e) => e.advertiserId === PLAYER && e.round === 2)).toBe(false);
      expect(without.filter((e) => e.round === 2)).toEqual(
        log.filter((e) => e.round === 2 && e.advertiserId !== PLAYER),
      );
    });

    test('removing a round the player never decided in changes nothing', async () => {
      const live = await playLive(6);
      const replayed = replayWithout(live.start, live.state.decisionLog, {
        advertiserId: PLAYER, round: 3, mode: 'expected', throughRound: 6,
      });
      expect(JSON.stringify(replayed.reports)).toBe(JSON.stringify(live.reports));
    });

    test('removing a decision leaves every week before it identical, and changes its own week', async () => {
      const live = await playLive(6);
      const replayed = replayWithout(live.start, live.state.decisionLog, {
        advertiserId: PLAYER, round: 2, mode: 'expected', throughRound: 6,
      });
      expect(JSON.stringify(replayed.reports[0])).toBe(JSON.stringify(live.reports[0]));
      expect(row(replayed.reports[1])).not.toEqual(row(live.reports[1]));
    });

    test('rivals make exactly the moves they made, and the player\'s later decisions still happen', async () => {
      const live = await playLive(6);
      const replayed = replayWithout(live.start, live.state.decisionLog, {
        advertiserId: PLAYER, round: 2, mode: 'expected', throughRound: 6,
      });
      const rivals = (log) => log.filter((e) => e.advertiserId !== PLAYER);
      expect(rivals(replayed.finalState.decisionLog)).toEqual(rivals(live.state.decisionLog));
      expect(replayed.finalState.decisionLog.some((e) => e.advertiserId === PLAYER && e.round === 4))
        .toBe(true);
    });
  });
  ```

  Add `logWithout, replayWithout` to the file's `game.js` import.

- [ ] **Step 2: Run them and watch them fail.**
  Run: `npx vitest run tests/game.test.js -t "without one decision"`.
  Expected: FAIL, `logWithout is not a function` (or not exported).

- [ ] **Step 3: Write the implementation** after `replayLog` in `game.js`:

  ```js
  /**
   * The decision log with one advertiser's decision for one round taken out.
   *
   * What the debrief's "What if I hadn't?" replays (plans/2026-09-13-debrief.md):
   * the player's week, gone; every other advertiser's logged decision, kept.
   *
   * @param {object[]} decisionLog
   * @param {{advertiserId: string, round: number}} which
   * @returns {object[]} a new log
   */
  export function logWithout(decisionLog, { advertiserId, round }) {
    return (decisionLog ?? []).filter(
      (entry) => !(entry.advertiserId === advertiserId && entry.round === round),
    );
  }

  /**
   * Replay a game with one advertiser's decision for one round removed.
   *
   * RIVALS MAKE THE MOVES THEY MADE. Their logged decisions are replayed as
   * they were, so the difference is this decision's alone, in a market that did
   * not react to its absence. A real market might have; the debrief says so.
   *
   * The player's later decisions still happen. Keyword and negative lists are
   * submitted whole, so a later submission can carry the removed change back
   * in; the debrief compares only the weeks before the player's next decision.
   *
   * @param {object} initialState the state before the first logged round
   * @param {object[]} decisionLog
   * @param {object} options `advertiserId` and `round` name the decision;
   *   `throughRound` and the rest go to `replayLog`
   * @returns {{finalState: object, reports: object[], insights: object[]}}
   */
  export function replayWithout(initialState, decisionLog, { advertiserId, round, ...options }) {
    return replayLog(initialState, logWithout(decisionLog, { advertiserId, round }), options);
  }
  ```

- [ ] **Step 4: Run them and watch them pass**, then break the filter on purpose
  (keep every entry) and confirm the tests fail, then restore.
  Run: `npx vitest run tests/game.test.js`, then `npm test`.

- [ ] **Step 5: Commit** (`game.js`, `tests/game.test.js`).

### Task 2: the moments and the budget weeks (`ui/debrief/read.js`)

**Interfaces produced:**
- `MAX_MOMENTS = 5`.
- `moments({ history, decisionLog, playerId, opening, allocationRounds,
  roundsPerMonth, lastRound })` returns up to five
  `{ round, lines, before, after, change, newMonth, capitalLanded, windowEnd }`,
  in round order. `lines` comes from `summariseDecisions`. `before`/`after` are
  `{ clicks, costPaise, cpcPaise|null, impressionShare }` for rounds `round - 1`
  and `round`. `change` is the larger of the relative change in clicks and in
  CPC. `newMonth` is `(round - 1) % roundsPerMonth === 0`; `capitalLanded` is
  `allocationRounds.includes(round)`. `windowEnd` is the player's next decision
  round minus one, or `lastRound`.
- `windowDifference(actual, without, playerId, { from, to })` returns
  `{ clicks, costPaise, netProfitPaise }`, each the actual game minus the game
  without the decision, summed over reports `from`..`to` read from each game's
  final history.
- `budgetWeeks(history, playerId)` returns
  `{ played, ranOut, paidFor: Week[], lostMoney: Week[], best: Week|null }`, with
  `Week = { round, clicks, profitIfFundedPaise }`. A week ran out when its
  `missedToBudget` is non-null with clicks above zero. **Never a total.**

- [ ] **Step 1: Write the failing tests** in `tests/debrief.test.js`, on games
  played in the test with a scripted player, as Task 1 does:
  - five or fewer decision weeks: all of them, in round order;
  - more than five (script a decision every week): exactly five, the largest
    `change`, ties to the earlier round;
  - `before`/`after` carry exactly the four traffic keys and nothing else;
  - `newMonth` true for rounds 5 and 9 only; `capitalLanded` true for round 5
    when `allocationRounds` is `[1, 5]`;
  - `windowEnd`: the round before the next decision; `lastRound` for the last;
  - `windowDifference` of a game against itself is all zeros;
  - `budgetWeeks`: `paidFor` and `lostMoney` partition the ran-out weeks by the
    sign of `profitIfFundedPaise`; `best` is the paid-for week with the most
    profit; a game whose budget never runs out (four phrase keywords bid at
    `MIN_BID_PAISE`, which cannot spend a month's money; assert that premise in
    the test) gives `ranOut: 0` and `best: null`; and the returned object has no
    key holding a sum.

- [ ] **Step 2: Watch them fail.** Run: `npx vitest run tests/debrief.test.js`.
- [ ] **Step 3: Implement** the three functions, pure, importing
  `summariseDecisions` from `../ending.js`.
- [ ] **Step 4: Watch them pass;** break the tie rule and the partition on
  purpose and confirm each is caught; `npm test`.
- [ ] **Step 5: Commit.**

### Task 3: the lessons and the reveal (`ui/debrief/read.js`)

**Interfaces produced:**
- `MATERIAL_LOSS = 0.10`, a display threshold with its reason in a comment
  (DECISIONS I6).
- `lessons({ history, decisionLog, playerId, opening, state })` returns six
  `{ id, met, figures }` in this order: `numbersMove`, `rankOrBudget`,
  `broadMatch`, `returns`, `ownName`, `smartBidding`, with the rules of spec
  section 5.
- `revealRows(initialState, playerId, guesses)`, where `guesses` maps rival id to
  `{ price, purpose }` or is missing, returns
  `{ rows: [{ id, name, domain, ad, truth, guess, result }], exact, half, cellmates }`,
  `result` being one of `exact`, `price`, `purpose`, `wrong` or `skipped`, and
  `cellmates` the names of rivals in the player's starting cell.

- [ ] **Step 1: Write the failing tests:** each lesson met by one scripted game
  and missed by another (broad against phrase keywords; a strategy switch against
  none; a keyword naming the player's own brand against none; a week losing 10%
  or more to budget or rank against a game that never does). `numbersMove` and
  `returns` are always met. Reveal: all five results; `cellmates` with a sharer
  and without; truth read from `initialState` even if a test moves a rival's
  position in the final state; the player never among the rows.
- [ ] **Step 2: Watch them fail.**
- [ ] **Step 3: Implement,** pure; the brand test uses `brandNamedIn` from
  `content/brands.js`; the learning weeks use `LEARNING_ROUNDS`.
- [ ] **Step 4: Watch them pass;** break two rules on purpose; `npm test`.
- [ ] **Step 5: Commit.**

### Task 4: the chapter *What only a simulation can tell you*

- [ ] Add the chapter id `counterfactuals` to `ui/guide/chapters.js`: the real half
  from Google Ads Help on impression share lost to budget and on estimates,
  fetched while drafting; the game half citing G1 and G1a, saying rivals are held
  to their logged moves and missed orders are costed at the expected return rate;
  `yourAccount: 'budget'`. Add it to `CONTENTS`.
- [ ] `npx vitest run tests/guide.test.js`; show the owner the rendered text;
  revise until approved; commit.

### Task 5: the two cards

- [ ] `ui/words/debrief.js` with every sentence and label from spec sections 4-6;
  disclosures carry `why: 'counterfactuals'`; lessons with chapters carry theirs.
- [ ] Export `serpBlock` from `ui/round-zero.js`.
- [ ] `ui/debrief/render.js`: `renderDebrief(ctx)` and `renderReveal(ctx, onRevealed)`;
  "What if I hadn't?" runs `logWithout` then `replayRound` one week at a time,
  pausing between weeks, and writes the window's `windowDifference`.
- [ ] The budget card starts with a button, *Work out what more budget would have
  done*: it replays the played log with `replayRound` week by week,
  `counterfactualFor: [playerId]` and `mode: 'expected'`, pausing between weeks
  with progress, then shows `budgetWeeks` of the replayed history (decided
  2026-09-13; DECISIONS G1).
- [ ] `ui/ending.js`: new order (spec section 2); the standings' position column
  hidden until `onRevealed`; `ctx.initial` passed through from `ui/app.js`.
- [ ] Styles for both cards, the guess grid at 44px cells on a phone.
- [ ] Play to the end on the dev server: every moment's "What if I hadn't?",
  budget card, lessons, guess/reveal/skip, the column, keyboard, phone, console;
  `npm test`; commit.

### Task 6: the reveal's motion

- [ ] Row-by-row: 50ms stagger, 200ms, `cubic-bezier(0.23, 1, 0.32, 1)`, opacity
  plus a 4px rise; reduced motion is opacity only, without stagger.
- [ ] The owner runs `/review-animations`; fix what it flags; commit.

### Task 7: docs

- [ ] HANDOVER *Start here*: the debrief built; the published file count in
  CLAUDE.md, HANDOVER and `wrangler.jsonc`; commit.
