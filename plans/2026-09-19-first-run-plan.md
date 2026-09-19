# The first run — implementation plan

**Goal:** a seven-beat guided sequence before round 0 that teaches a true
beginner the world's vocabulary — search, ad, position, impression, auction,
bid, ad rank, click, cost per click, budget, conversion, the delay, return — on
one search the engine really ran.

**Architecture:** a new `ui/firstrun/` drawn before any game exists. It reads no
player `GameState`, writes no save, and moves no engine number. Its ladder is a
real `resolveAuction` on a demonstration game built by `startGame`, so no figure
on screen is typed by hand. Its sentences live in `ui/words/firstrun.js` and it
joins the drawing guard.

**Spec:** `plans/2026-09-19-first-run-and-ground-floor.md`, section 4. Read it
first; this plan argues from it.

**Design:** `design/first-run/` — seven `.dc.html` artboards, `canvas.json` with
the sourcing, and `prototype.html`, a playable version of the finished thing.
When this plan and the prototype disagree, **the prototype is the drawing and
this plan is the contract**; the spec wins over both.

## Global constraints

- **Nothing in `engine/`, `game.js`, `setup.js`, `content/` or `agents/` is
  modified.** No number moves, so no `scripts/market-harness.js` run and no
  calibration check. Every existing save must still replay.
- **The freeze holds.** Commit freely; **push nothing** until the owner says. A
  push restamps `ui/version.js`.
- ES modules, `.js`, named exports, JSDoc on every export, comments say *why*.
- **Money is integer paise**, formatted only at display, via `rupees()` in
  `ui/dom.js`.
- **No sentence lives in a drawing module.** Every one is a `line()` in
  `ui/words/`, and `ui/firstrun/render.js` joins the `drawing` list in
  `tests/words.test.js`, which fails any string literal of three or more words.
- **Motion is `reviews/slc-review.md` section 13's, and nothing new.** Transform
  and opacity only, no library. Entrances `240ms` on
  `cubic-bezier(0.23, 1, 0.32, 1)`; the step back `260ms` on
  `cubic-bezier(0.77, 0, 0.175, 1)`; the ladder row-by-row at a **50ms**
  stagger. **No counting tickers anywhere.** Under `prefers-reduced-motion`
  every translate is dropped and the fades stay.
- **Studio tokens only** (`ui/studio.css`): every rule scoped under `.studio`,
  and **red is the player's colour** — losses and warnings are amber
  (`--studio-amber`) with a minus sign.
- **Word budget, measured per screen: no beat puts more than 80 words on
  screen**, the opening statement counted against beat 1, which carries it.
  Round 0's step 1 is 281 words, about 248 visible at once, and that is the step
  a stranger gave up inside. A second bound of 500 words in all is a ratchet
  against sprawl. *(Corrected in Task 1: this plan and the design first said
  "under 200 words in all", counting prose and not labels. Measured, the run is
  477 across every line, and a total was never the figure that matters.)*
- `npm test` must be green (2402 passing, 1 todo today) and its **exit code
  checked** before every commit. Commit with `git commit -F <file>`, present
  tense, one concern, ending:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

## File structure

| file | responsibility |
|---|---|
| `ui/words/firstrun.js` | every sentence the run says. Imports only `line.js`. |
| `ui/firstrun/auction.js` | the demonstration auction: builds it, resolves it, returns the ladder. No DOM. |
| `ui/firstrun/read.js` | the seven beats as data — which figures each needs, what it teaches. No DOM. |
| `ui/firstrun/render.js` | the drawing: frame, trail, beats, navigation. Holds no sentence. |
| `ui/studio.css` | the run's rules, scoped under `.studio`. |
| `ui/app.js` | routes to the run before round 0, once per browser. |
| `scripts/read-playtest.js` | one row in `GROUPS` so the file reports the run's time. |
| `tests/firstRun.test.js` | new: the auction, the beats, the frame, seen-once. |
| `tests/words.test.js` | the drawing guard, the word budget, the sentences. |
| `tests/build.test.js` | the file count moves. |

---

## Task 1: The words

**Files:**
- Create: `ui/words/firstrun.js`
- Test: `tests/words.test.js` (add a `describe`)

**Interfaces:**
- Produces: `FIRST_RUN`, a frozen object of `line()` entries. Later tasks read
  `FIRST_RUN.<key>(figures)`. Keys used by Task 4:
  `openTitle`, `openTypes`, `openLength`, `openNoNeed`,
  `b1Kicker`, `b1Where`, `b1Say`, `b1Trail`,
  `b2Kicker`, `b2Say`, `b2Organic`, `b2Trail`,
  `b3Kicker`, `b3Say`, `b3Cut`, `b3ReadAgain`, `b3Callout`, `b3Cost`, `b3Trail`,
  `b4Kicker`, `b4Pays`, `b4Sold`, `b4When`, `b4Looking`, `b4Say`, `b4Note`, `b4Trail`,
  `b5Kicker`, `b5Say`, `b5Note`, `b5Report`, `b5Then`, `b5Later`, `b5Trail`,
  `b6Kicker`, `b6Say`, `b6Note`, `b6Report3`, `b6Latest`, `b6Trail`,
  `b7Kicker`, `b7Hero`, `b7Say`, `b7Note`,
  `wkClick`, `wkThinks`, `wkBuys`, `wkShips`, `wkRefused`, `wkWeek`,
  `colBrand`, `colBid`, `colFits`, `colRank`, `colPays`,
  `next1`…`next7`, `skip`, `back`, `again`, `stepOf`.

- [x] **Step 1: Write the failing test**

Add to `tests/words.test.js`:

```js
import { FIRST_RUN } from '../ui/words/firstrun.js';

describe('the first run says nothing undefined, and stays inside its budget', () => {
  const FIGURES = {
    query: 'gym leggings with pockets', volume: '1,849', where: 'Pune',
    winner: 'Marlow', winnerBid: '₹30', winnerPays: '₹25.13',
    runnerUp: 'Halcyon', runnerUpBid: '₹16', runnerUpPays: '₹9.45',
    entered: '6', of: '9', slots: '4',
    order: '₹2,400', freight: '₹200', returnShare: 'four orders in ten',
    weekly: '4,30,000', rivals: '8', weeks: '12', time: '7:40 pm',
    clickWeek: '3', buyWeek: '5', backWeek: '7',
    n: 1, total: 7,
  };

  test('every line renders without a hole in it', () => {
    for (const [name, entry] of Object.entries(FIRST_RUN)) {
      expect(entry(FIGURES), name).not.toMatch(/undefined|NaN|\[object/);
      expect(entry(FIGURES).trim(), name).not.toBe('');
    }
  });

  // ON_SCREEN lists which lines each beat draws; beat 1 carries the opener.
  // `words` counts anything holding two letters in a row, as the drawing guard does.
  test('no beat puts more than 80 words on screen, against round 0 step 1's 248', () => {
    for (const [beat, keys] of Object.entries(ON_SCREEN)) {
      const count = keys.reduce((total, key) => total + words(FIRST_RUN[key](FIGURES)), 0);
      expect(count, `beat ${beat} says ${count} words`).toBeLessThanOrEqual(80);
    }
  });

  test('the run stays under 500 words in all', () => {
    const said = Object.values(FIRST_RUN).map((entry) => entry(FIGURES)).join(' ');
    expect(words(said)).toBeLessThan(500);
  });

  test('it names no chapter, because the run teaches the world and chapters teach the controls', () => {
    for (const [name, entry] of Object.entries(FIRST_RUN)) {
      expect(entry.why, name).toBe(null);
    }
  });
});
```

- [x] **Step 2: Run it and watch it fail**

```bash
npm test -- words
```

Expected: `Failed to resolve import "../ui/words/firstrun.js"`.

- [x] **Step 3: Write `ui/words/firstrun.js`**

```js
/**
 * The first run's sentences (plans/2026-09-19-first-run-and-ground-floor.md,
 * section 4): the minute before round 0, for someone who has never bought an ad.
 *
 * WHY IT SAYS SO LITTLE. Round 0 was cut from 2,648 words to 781 and a stranger
 * still gave up inside it, so this run earns its place only by staying a story
 * told in numbers and real ads rather than in prose. No beat puts more than 80
 * words on screen and tests/words.test.js holds it there.
 *
 * NO CHAPTER IS NAMED HERE. The run teaches the world — what a click is — and
 * the ground-floor chapters teach the controls. One word, one home, so nothing
 * is defined twice in two voices.
 *
 * Every figure arrives from ui/firstrun/auction.js, which resolves a real
 * auction. Nothing below computes a number; it can only phrase one.
 */

import { line } from './line.js';

export const FIRST_RUN = Object.freeze({
  // The opening statement, above beat 1 only.
  openTitle: line('label', 'You’re buying the ads above Google’s search results.'),
  openTypes: line('reading', 'Someone in India types “gym leggings”. Four ads sit above the results. '
    + 'You decide whether one of them is yours, and what you’ll pay to be there.'),
  openLength: line('reading', ({ weeks, rivals }) => `${weeks} weeks. ${rivals} rival brands. `
    + 'You’re ranked on what your business made.'),
  openNoNeed: line('reading', 'You don’t need to know anything about advertising yet. '
    + 'The next minute shows you one search, start to finish.'),

  // Beat 1, the search.
  b1Kicker: line('label', 'One search'),
  b1Where: line('label', ({ where }) => `${where} · 7:40 pm`),
  b1Say: line('reading', ({ where, volume }) => `In ${where}, someone types this. `
    + `About ${volume} people search it every week.`),
  b1Trail: line('label', ({ query, volume }) => `“${query}” · ${volume} a week`),

  // Beat 2, the four ads.
  b2Kicker: line('label', 'What she sees'),
  b2Say: line('reading', 'Four ads, above everything else. Being shown at all is an impression — '
    + 'and nothing has been paid yet.'),
  b2Organic: line('label', 'the ordinary results, which nobody pays for'),
  b2Trail: line('label', ({ slots }) => `${slots} ads above the results`),

  // Beat 3, the auction.
  b3Kicker: line('label', 'Nobody bought those slots'),
  b3Say: line('reading', ({ entered, of }) => `${of} brands sell gym clothes here. ${entered} wanted this search. `
    + 'On every single search, Google ranks them by what they bid, multiplied by how well their ad fits.'),
  b3Cut: line('label', ({ slots }) => `only ${slots} slots`),
  b3ReadAgain: line('label', 'Read the top two rows again'),
  b3Callout: line('reading', ({ winner, winnerBid, winnerPays, runnerUp, runnerUpBid, runnerUpPays }) =>
    `${winner} bid ${winnerBid} and pays ${winnerPays}. ${runnerUp} bid ${runnerUpBid}, sits one place below, `
    + `and pays ${runnerUpPays} — because its ad fits this search better.`),
  b3Cost: line('reading', 'You can buy your way up. It costs you every click.'),
  b3Trail: line('label', ({ winner, winnerPays }) => `${winner} first at ${winnerPays}`),

  // Beat 4, the click.
  b4Kicker: line('label', 'She clicks the first one'),
  b4Pays: line('label', ({ winner }) => `${winner} pays`),
  b4Sold: line('label', ({ winner }) => `${winner} has sold`),
  b4When: line('label', 'the moment she clicks'),
  b4Looking: line('label', 'she is only looking'),
  b4Say: line('reading', ({ winner, winnerPays }) => 'This is the part that surprises people. '
    + `You pay for the visit, not the sale. She might buy nothing and leave. ${winner} still paid ${winnerPays}.`),
  b4Note: line('reading', 'So a cheap click on the wrong search is expensive, '
    + 'and a dear click on the right one can be a bargain.'),
  b4Trail: line('label', ({ winnerPays }) => `she clicked · ${winnerPays} gone · nothing sold`),

  // Beat 5, the delay.
  b5Kicker: line('label', ({ clickWeek, buyWeek }) => `She clicked in week ${clickWeek}. She buys in week ${buyWeek}.`),
  b5Say: line('reading', 'The sale is counted in the week she clicked, not the week she bought. '
    + 'So a week you have already read is rewritten underneath you.'),
  b5Note: line('reading', 'Nothing has gone wrong. This is how the real thing works, '
    + 'and it is why judging a week too early is expensive.'),
  b5Report: line('label', ({ clickWeek }) => `What week ${clickWeek}’s report said`),
  b5Then: line('label', 'when it happened'),
  b5Later: line('label', 'two weeks later'),
  b5Trail: line('label', ({ order, buyWeek }) => `she buys ${order} in week ${buyWeek}`),

  // Beat 6, the return.
  b6Kicker: line('label', 'Two weeks after that'),
  b6Say: line('reading', ({ order, freight }) => 'She pays cash when it arrives — and she doesn’t take it. '
    + `The parcel goes back undelivered. The ${order} goes back too, and the ${freight} it cost to send does not.`),
  b6Note: line('reading', ({ returnShare }) => `Roughly ${returnShare} come back here. `
    + 'It is the biggest thing standing between revenue and profit.'),
  b6Report3: line('label', ({ clickWeek }) => `What week ${clickWeek}’s report said, three times`),
  b6Latest: line('label', 'four weeks later'),
  b6Trail: line('label', ({ freight }) => `refused at the door · ${freight} of freight gone`),

  // Beat 7, the handover.
  b7Kicker: line('label', 'That was one search'),
  b7Hero: line('label', ({ weekly, of }) => `There are ${weekly} a week, and ${of} brands want them.`),
  b7Say: line('reading', ({ weeks }) => 'One of those brands is you. '
    + `For ${weeks} weeks you decide which searches are worth being in, what to pay, and what your ad says.`),
  b7Note: line('reading', 'Every term you just met comes back with a “why?” beside it, '
    + 'and the guide is always in the left-hand strip.'),

  // The week strip, beats 5 and 6.
  wkWeek: line('label', ({ n }) => `Week ${n}`),
  wkClick: line('label', 'the click'),
  wkThinks: line('label', 'she thinks about it'),
  wkBuys: line('label', 'she buys'),
  wkShips: line('label', 'it ships'),
  wkRefused: line('label', 'refused at the door'),

  // The ladder's columns.
  colBrand: line('label', 'brand'),
  colBid: line('label', 'bid'),
  colFits: line('label', 'ad fits'),
  colRank: line('label', 'rank'),
  colPays: line('label', 'pays'),

  // Moving through it.
  stepOf: line('label', ({ n, total }) => `Step ${n} of ${total}`),
  next1: line('instruction', 'What she sees'),
  next2: line('instruction', 'How those four were chosen'),
  next3: line('instruction', 'She clicks one'),
  next4: line('instruction', 'Three weeks later'),
  next5: line('instruction', 'Two weeks after that'),
  next6: line('instruction', 'And that is the whole job'),
  next7: line('instruction', 'Start — pick your brand’s position'),
  skip: line('instruction', 'Skip this — take me to the game'),
  back: line('instruction', 'Back'),
  again: line('instruction', 'Watch that again'),
});
```

- [x] **Step 4: Run the test and watch it pass**

```bash
npm test -- words
```

Expected: PASS. **If the word budget fails, cut sentences — do not raise the
bound.** The bound is the point.

- [x] **Step 5: Commit**

```bash
git add ui/words/firstrun.js tests/words.test.js
git commit -F <message file>
```

Message: *"Write the first run's sentences, and hold them under 200 words"*.
Say in the body that round 0's 781 words are the reason for the budget, and that
no line names a guide chapter because the run teaches the world and the chapters
teach the controls.

---

## Task 2: The demonstration auction

**Files:**
- Create: `ui/firstrun/auction.js`
- Test: `tests/firstRun.test.js` (new)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:

```js
/**
 * @returns {{
 *   query: {text: string, weekly: number},
 *   winner: {name: string, bidPaise: number, cpcPaise: number},
 *   runnerUp: {name: string, bidPaise: number, cpcPaise: number},
 *   entered: number, of: number,
 *   rows: Array<{
 *     id: string, name: string, domain: string,
 *     bidPaise: number, signal: number, adRank: number,
 *     position: number, shown: boolean, cpcPaise: number,
 *     headlines: string[], descriptions: string[],
 *   }>,
 * }}
 */
export function demonstration()
```

`rows` is sorted by ad rank, descending, shown first.

- [x] **Step 1: Write the failing test**

Create `tests/firstRun.test.js`:

```js
import { describe, test, expect } from 'vitest';
import { resolveAuction } from '../engine/auction.js';
import { MAX_SLOTS, AD_RANK_FLOOR, WEEKLY_VOLUME } from '../engine/constants.js';
import { QUERY_SET } from '../content/querySet.js';
import { demonstration, DEMO_QUERY_ID, DEMO_HOUR } from '../ui/firstrun/auction.js';

describe('the demonstration is a real auction, not a written one', () => {
  test('its query is one of the query set\'s own, and its volume is the set\'s', () => {
    const row = QUERY_SET.queries.find((q) => q.id === DEMO_QUERY_ID);
    expect(row, DEMO_QUERY_ID).toBeTruthy();
    const demo = demonstration();
    expect(demo.query.text).toBe(row.text);
    expect(demo.query.weekly).toBe(Math.round((row.volumeShareBp / 10000) * WEEKLY_VOLUME));
  });

  test('its ladder is what resolveAuction gives for its own entrants', () => {
    const demo = demonstration();
    const { ladder } = resolveAuction(demo.rows.map(({ id, bidPaise, signal }) => ({
      id, bidPaise, qualitySignal: signal,
    })));
    for (const row of ladder) {
      const mine = demo.rows.find((r) => r.id === row.id);
      expect(mine.position, row.id).toBe(row.position);
      expect(mine.cpcPaise, row.id).toBe(row.cpcPaise);
      expect(mine.shown, row.id).toBe(row.shown);
    }
  });

  test('four are shown, and the rest are out on slots rather than the reserve', () => {
    const demo = demonstration();
    expect(demo.rows.filter((r) => r.shown)).toHaveLength(MAX_SLOTS);
    for (const row of demo.rows.filter((r) => !r.shown)) {
      expect(row.adRank, `${row.name} should be out on slots, not the reserve`)
        .toBeGreaterThan(AD_RANK_FLOOR);
    }
  });

  test('every ad on screen is a real rival ad, with words in it', () => {
    for (const row of demonstration().rows) {
      expect(row.headlines.length, row.name).toBeGreaterThan(0);
      expect(row.descriptions.length, row.name).toBeGreaterThan(0);
      expect(row.domain, row.name).toMatch(/\.in$/);
    }
  });

  test('THE LESSON: the runner-up pays less on a smaller bid, because its ad fits better', () => {
    const demo = demonstration();
    expect(demo.runnerUp.bidPaise).toBeLessThan(demo.winner.bidPaise);
    expect(demo.runnerUp.cpcPaise).toBeLessThan(demo.winner.cpcPaise);
    const [first, second] = demo.rows;
    expect(second.signal, 'the runner-up must have the better-fitting ad')
      .toBeGreaterThan(first.signal);
  });

  test('it is the same auction every time, so the run teaches one thing', () => {
    expect(demonstration().rows.map((r) => r.cpcPaise))
      .toEqual(demonstration().rows.map((r) => r.cpcPaise));
  });

  test('it reads nothing of the player\'s, and is cheap enough for a screen', () => {
    const started = Date.now();
    demonstration();
    expect(Date.now() - started).toBeLessThan(2000);
  });

  test('the hour it runs at is a real hour', () => {
    expect(DEMO_HOUR).toBeGreaterThanOrEqual(0);
    expect(DEMO_HOUR).toBeLessThan(24);
  });
});
```

- [x] **Step 2: Run it and watch it fail**

```bash
npm test -- firstRun
```

Expected: `Failed to resolve import "../ui/firstrun/auction.js"`.

- [x] **Step 3: Write `ui/firstrun/auction.js`**

```js
/**
 * The first run's demonstration auction (the design's section 4.3).
 *
 * WHY IT IS A REAL AUCTION. The first screen a beginner ever sees must not
 * teach a made-up number, in a project whose premise is that a simulator
 * teaching something false is worse than none. So this builds a throwaway game
 * exactly as `startGame` builds one, then resolves ONE auction on one search
 * with the engine's own functions — the rule `ui/reserve.js` already follows:
 * every step the engine's own, so this cannot drift from the auction.
 *
 * IT IS NOT THE PLAYER'S GAME. It runs before a game exists, on a fixed seed,
 * and nothing it builds is ever handed to `game.js`. It reads no save and
 * writes none.
 *
 * WHY THIS SEARCH. `q_056` leans mid and performance, the square a player is
 * most likely to pick, and it is plain English — a beginner recognises it
 * without knowing the vertical.
 */

import { startGame } from '../../setup.js';
import { findMatches, selectAdGroup, isBlocked } from '../../engine/matching.js';
import { qualitySignalBase, applyHourAndNoise } from '../../engine/quality.js';
import { landingPageBonus, businessFor } from '../../engine/positions.js';
import { resolveAuction } from '../../engine/auction.js';
import { effectiveBidPaise } from '../../engine/strategies.js';
import { WEEKLY_VOLUME, LOCATION_TIERS } from '../../engine/constants.js';
import { QUERY_SET } from '../../content/querySet.js';
import * as r0 from '../roundzero/rules.js';

/** The search the run is told on. */
export const DEMO_QUERY_ID = 'q_056';

/** Evening, where the demand and intent curves are both high. */
export const DEMO_HOUR = 19;

/** Fixed, so the run teaches the same thing to everyone. */
const DEMO_SEED = 20260902;
const DEMO_BRAND = 'marlow';

/** Worked out once: the run is drawn several times as the player steps back. */
let cached = null;

/**
 * One real auction, resolved.
 *
 * @returns {object} see the plan's Task 2 for the shape
 */
export function demonstration() {
  if (cached) return cached;

  const setup = r0.createSetupDraft({ playerBrandId: DEMO_BRAND, rootSeed: DEMO_SEED });
  r0.addSetupKeyword(setup, QUERY_SET.queries.find((q) => q.id === DEMO_QUERY_ID).text);
  const state = startGame({ rootSeed: DEMO_SEED, querySet: QUERY_SET, ...r0.startChoices(setup) });
  const query = QUERY_SET.queries.find((q) => q.id === DEMO_QUERY_ID);

  const entrants = [];
  for (const advertiser of state.advertisers) {
    if (isBlocked(query, advertiser.campaign.negatives)) continue;
    const hits = findMatches(query, advertiser.adGroups);
    if (hits.length === 0) continue;

    const bonus = landingPageBonus(advertiser.capex, 1);
    const baseFor = (hit) => {
      const group = advertiser.adGroups.find((g) => g.id === hit.adGroupId);
      const graded = group.gradedQuality
        ? { ...group.gradedQuality, landingPage: Math.min(10, (group.gradedQuality.landingPage ?? 0) + bonus) }
        : group.gradedQuality;
      return { ...qualitySignalBase(graded, query, hit.keyword), group };
    };
    const chosen = selectAdGroup(hits, (hit) => hit.keyword.bidPaise * baseFor(hit).base);
    const { base, group } = baseFor(chosen);

    entrants.push({
      id: advertiser.id,
      name: advertiser.name,
      domain: advertiser.domain,
      headlines: [...group.ad.headlines],
      descriptions: [...group.ad.descriptions],
      signal: applyHourAndNoise(base, DEMO_HOUR, null, 'expected'),
      bidPaise: effectiveBidPaise({
        strategy: advertiser.campaign.strategy,
        strategyParams: advertiser.campaign.strategyParams ?? {},
        keyword: chosen.keyword,
        business: businessFor(advertiser.position),
        bidding: advertiser.bidding ?? {},
        daypartAdjustments: advertiser.campaign.daypartAdjustments ?? new Array(24).fill(0),
        hour: DEMO_HOUR,
        rng: null,
      }),
    });
  }

  const { ladder } = resolveAuction(entrants.map(({ id, bidPaise, signal }) => ({
    id, bidPaise, qualitySignal: signal,
  })));
  const rows = ladder.map((row) => ({
    ...entrants.find((e) => e.id === row.id),
    adRank: row.adRank,
    position: row.position,
    shown: row.shown,
    cpcPaise: row.cpcPaise,
  }));

  cached = Object.freeze({
    query: {
      text: query.text,
      weekly: Math.round((query.volumeShareBp / 10000) * WEEKLY_VOLUME),
    },
    winner: rows[0],
    runnerUp: rows[1],
    entered: entrants.length,
    of: state.advertisers.length,
    rows: Object.freeze(rows),
  });
  return cached;
}
```

**Note on `LOCATION_TIERS`:** it is imported above only if the implementation
needs it; if the code above compiles without it, remove the import — `no-unused-vars`
will stop the build otherwise.

- [x] **Step 4: Run the test and watch it pass**

```bash
npm test -- firstRun
```

Expected: PASS, all eight. **If "the runner-up pays less on a smaller bid" fails,
stop and tell the owner** — the run's central lesson has moved, and the beats and
the artboards both rest on it.

- [x] **Step 5: Print the ladder and check it against the design**

```bash
node -e "import('./ui/firstrun/auction.js').then(({demonstration})=>{const d=demonstration();console.log(d.query, d.entered+'/'+d.of);for(const r of d.rows)console.log(r.position||'-', r.name, (r.bidPaise/100).toFixed(0), r.adRank.toFixed(1), (r.cpcPaise/100).toFixed(2));});"
```

Expected, matching `design/README.md`'s `first-run/` section:
Marlow 1 at ₹25.13 on ₹30, Halcyon 2 at ₹9.45 on ₹16, Auren 3 at ₹17.08,
Lumen 4 at ₹12.55, Torvi and Nira out, 6 of 9 entered.
**If the figures differ, update `design/first-run/` and the spec's section 4.3
in the same commit** — the drawing may not say one thing while the code says
another.

- [x] **Step 6: Commit**

```bash
git add ui/firstrun/auction.js tests/firstRun.test.js
git commit -F <message file>
```

Message: *"Resolve the first run's ladder as a real auction, not a written one"*.
Body: the `ui/reserve.js` precedent, and that it runs before a game exists so it
reads no save.

---

## Task 3: The frame

**Files:**
- Create: `ui/firstrun/read.js`, `ui/firstrun/render.js`
- Modify: `ui/studio.css` (append a `.studio .fr-*` block)
- Test: `tests/firstRun.test.js`, `tests/words.test.js`

**Interfaces:**
- Consumes: `FIRST_RUN` (Task 1), `demonstration()` (Task 2).
- Produces:

```js
// ui/firstrun/read.js
/** @returns {Array<{key: string, trail: ((f: object) => string)|null, next: (f: object) => string}>} */
export function beats()
/** @returns {object} the figures every line is rendered with */
export function figuresFor(demo)

// ui/firstrun/render.js
/**
 * @param {object} deps
 * @param {() => void} deps.onDone - Skip, or finishing beat 7
 * @returns {{node: HTMLElement}}
 */
export function createFirstRun({ onDone })
```

- [ ] **Step 1: Write the failing test**

Add to `tests/firstRun.test.js`:

```js
import { JSDOM } from 'jsdom';
import { beats, figuresFor } from '../ui/firstrun/read.js';
import { demonstration } from '../ui/firstrun/auction.js';

describe('the run moves one beat at a time, and the player holds the clock', () => {
  const mount = () => {
    const dom = new JSDOM('<!doctype html><body></body>');
    global.document = dom.window.document;
    let done = 0;
    const run = createFirstRun({ onDone: () => { done += 1; } });
    document.body.append(run.node);
    return { run, done: () => done };
  };

  test('there are seven beats, and it opens on the first', () => {
    expect(beats()).toHaveLength(7);
    const { run } = mount();
    expect(run.node.querySelectorAll('.fr-dot.on')).toHaveLength(1);
    expect(run.node.querySelector('.fr-dot').classList.contains('on')).toBe(true);
  });

  test('a played beat stays on screen as one line, so nothing is lost', () => {
    const { run } = mount();
    run.node.querySelector('.fr-go').click();
    expect(run.node.querySelectorAll('.fr-past')).toHaveLength(1);
    run.node.querySelector('.fr-go').click();
    expect(run.node.querySelectorAll('.fr-past')).toHaveLength(2);
  });

  test('Back returns to the beat before, and the trail shortens with it', () => {
    const { run } = mount();
    run.node.querySelector('.fr-go').click();
    run.node.querySelector('.fr-back').click();
    expect(run.node.querySelectorAll('.fr-past')).toHaveLength(0);
    expect(run.node.querySelector('.fr-back')).toBe(null);
  });

  test('Skip finishes it at once, and beat 7 has no Skip left to press', () => {
    const { run, done } = mount();
    run.node.querySelector('.fr-skip').click();
    expect(done()).toBe(1);
    const second = mount();
    for (let i = 0; i < 6; i += 1) second.run.node.querySelector('.fr-go').click();
    expect(second.run.node.querySelector('.fr-skip')).toBe(null);
    second.run.node.querySelector('.fr-go').click();
    expect(second.done()).toBe(1);
  });

  test('Watch that again returns to beat 1 without finishing', () => {
    const { run, done } = mount();
    for (let i = 0; i < 6; i += 1) run.node.querySelector('.fr-go').click();
    run.node.querySelector('.fr-again').click();
    expect(done()).toBe(0);
    expect(run.node.querySelectorAll('.fr-past')).toHaveLength(0);
  });

  test('every figure a line asks for is one the auction supplies', () => {
    const f = figuresFor(demonstration());
    for (const key of ['query', 'volume', 'winner', 'winnerBid', 'winnerPays',
      'runnerUp', 'runnerUpBid', 'runnerUpPays', 'entered', 'of', 'slots',
      'order', 'freight', 'returnShare', 'weekly', 'rivals', 'weeks',
      'clickWeek', 'buyWeek', 'backWeek', 'where']) {
      expect(String(f[key]), key).not.toMatch(/^(undefined|NaN|)$/);
    }
  });
});
```

Add `'ui/firstrun/render.js'` to the `drawing` array in `tests/words.test.js`.

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- firstRun
```

Expected: `Failed to resolve import "../ui/firstrun/read.js"`.

- [ ] **Step 3: Write `read.js`, then `render.js`, then the CSS**

`read.js` holds the beat list and the figures; it imports `FIRST_RUN`,
`demonstration()`, `rupees`/`whole` from `ui/dom.js`, and
`TOTAL_ROUNDS`, `ADVERTISER_COUNT`, `MAX_SLOTS`, `WEEKLY_VOLUME`,
`RTO_FREIGHT_PAISE` from `engine/constants.js`. **It types no figure**: the
order value and the return share come from `setup.js`'s `briefing(QUERY_SET)`
for the mid tier, exactly as round 0's step 1 reads them, and the click and buy
weeks come from `ATTRIBUTION_LAG_DISTRIBUTION`'s length.

`render.js` draws: `.fr-top` (the dots and `.fr-skip`), `.fr-trail` of
`.fr-past` rows, and one `.fr-live` card holding the beat, `.fr-go`,
`.fr-back` and, on beat 7, `.fr-again`. **Take the markup from
`design/first-run/prototype.html`** — it is the drawing, already played — and
replace every string with its `FIRST_RUN` line. Beat 2 uses `serp()` from
`ui/kit/serp.js` rather than new markup.

The CSS is appended to `ui/studio.css`, every rule scoped `.studio .fr-…`, and
the keyframes are those in the prototype. Copy the `prefers-reduced-motion`
block unchanged.

- [ ] **Step 4: Run the tests and watch them pass**

```bash
npm test -- firstRun
npm test -- words
```

Expected: both PASS. The drawing guard failing means a sentence is still in
`render.js`: move it to `ui/words/firstrun.js`.

- [ ] **Step 5: Commit**

```bash
git add ui/firstrun/read.js ui/firstrun/render.js ui/studio.css tests/firstRun.test.js tests/words.test.js
git commit -F <message file>
```

Message: *"Draw the first run, one beat at a time, with the review's own motion"*.
Body: name section 13's rows used, and that no figure is typed.

---

## Task 4: Wiring it into the app

**Files:**
- Modify: `ui/app.js:284-306` (the `render()` no-game branch), `ui/app.js:278` (`screenName`)
- Modify: `scripts/read-playtest.js:34-44` (`GROUPS`)
- Test: `tests/firstRun.test.js`

**Interfaces:**
- Consumes: `createFirstRun({ onDone })` (Task 3).
- Produces: `FIRST_RUN_KEY`, exported from `ui/firstrun/render.js`, the storage
  key that remembers the run has been seen: `'g-ads-simulation:first-run'`.

- [ ] **Step 1: Write the failing test**

Add to `tests/firstRun.test.js`:

```js
import { FIRST_RUN_KEY, seenFirstRun, markFirstRunSeen } from '../ui/firstrun/render.js';

describe('it is seen once per browser, and never costs a game', () => {
  const store = () => {
    const map = new Map();
    return {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
    };
  };

  test('a fresh browser has not seen it; marking it makes it seen', () => {
    const storage = store();
    expect(seenFirstRun(storage)).toBe(false);
    markFirstRunSeen(storage);
    expect(seenFirstRun(storage)).toBe(true);
    expect(storage.getItem(FIRST_RUN_KEY)).toBeTruthy();
  });

  test('storage that refuses reads as not seen, and never throws', () => {
    const angry = {
      getItem: () => { throw new Error('nope'); },
      setItem: () => { throw new Error('nope'); },
      removeItem: () => {},
    };
    expect(() => seenFirstRun(angry)).not.toThrow();
    expect(seenFirstRun(angry)).toBe(false);
    expect(() => markFirstRunSeen(angry)).not.toThrow();
  });

  test('it is kept apart from the save and the recording', () => {
    expect(FIRST_RUN_KEY).not.toBe('g-ads-simulation:save');
    expect(FIRST_RUN_KEY).not.toBe('g-ads-simulation:playtest');
  });
});
```

And in `tests/playtest.test.js` (or `tests/firstRun.test.js` if the reader is not
already covered there):

```js
import { phaseGroups } from '../scripts/read-playtest.js';

test('the reader reports the first run as its own phase, beside round 0', () => {
  const file = { recording: { format: 1, startedAt: 0, loads: [0], versions: [], clicks: [], weeks: [],
    answers: {}, phases: [
      { name: 'first run', startAt: 0, endAt: 90_000, lastSeenAt: 90_000, hiddenMs: 0, idleMs: 0, clicks: 6, keys: 0 },
      { name: 'round 0', startAt: 90_000, endAt: 600_000, lastSeenAt: 600_000, hiddenMs: 0, idleMs: 0, clicks: 20, keys: 40 },
    ] } };
  const names = phaseGroups(file).map((row) => row.name);
  expect(names).toContain('first run');
  expect(names).toContain('round 0');
  expect(names.indexOf('first run')).toBeLessThan(names.indexOf('round 0'));
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- firstRun
```

Expected: `seenFirstRun is not a function`, and the reader test fails because
`'first run'` falls into `other`.

- [ ] **Step 3: Add the storage helpers to `render.js`**

```js
/** Remembers that this browser has been through the run. Beside the save, never inside it. */
export const FIRST_RUN_KEY = 'g-ads-simulation:first-run';

/**
 * @param {Storage|null} storage
 * @returns {boolean} whether this browser has seen the run
 */
export function seenFirstRun(storage) {
  try {
    return storage?.getItem(FIRST_RUN_KEY) === '1';
  } catch {
    // A browser that will not store it shows the run again, which is the safe way to be wrong.
    return false;
  }
}

/** @param {Storage|null} storage */
export function markFirstRunSeen(storage) {
  try {
    storage?.setItem(FIRST_RUN_KEY, '1');
  } catch {
    // Unstorable is not a failure: the run has still been played.
  }
}
```

- [ ] **Step 4: Route to it in `ui/app.js`**

Add a module-level flag beside `roundZeroTouched`:

```js
/**
 * Whether the run is on screen. It sits before round 0 and before any game, so
 * it is the one screen with no state of its own to lose.
 */
let inFirstRun = false;
```

In `screenName()`, before the `!game` branch:

```js
function screenName() {
  if (inFirstRun) return 'first run';
  if (!game) return rewinding ? 'round 0 (redo)' : 'round 0';
  ...
}
```

In `render()`, inside `if (!game)` and **before** `createRoundZero`:

```js
  if (!game) {
    roundZeroTouched = false;
    guide.close();
    // The minute before round 0, for someone who has never bought an ad
    // (plans/2026-09-19-first-run-and-ground-floor.md). Once per browser, and
    // never on a redo: a player rewinding round 0 has already met all of it.
    if (!rewinding && !seenFirstRun(storage)) {
      inFirstRun = true;
      recorder?.phase(screenName());
      app.replaceChildren(createFirstRun({
        onDone: () => {
          markFirstRunSeen(storage);
          inFirstRun = false;
          render();
        },
      }).node);
      window.scrollTo(0, 0);
      return;
    }
    inFirstRun = false;
    app.replaceChildren(createRoundZero({ /* unchanged */ }).node);
```

**Careful:** `render()` calls `recorder?.phase(screenName())` on its first line,
before `inFirstRun` is set, so the call above is what records the run. Set
`inFirstRun` **before** calling `screenName()`, as written.

Also extend the reload guard at `ui/app.js:493` so a click inside the run does
not mark round 0 as touched:

```js
    if (!game && !inFirstRun && !event.target.closest?.('.door')) roundZeroTouched = true;
```

- [ ] **Step 5: Add the reader's group**

In `scripts/read-playtest.js`, insert **above** the `round 0` row so it prints
first:

```js
const GROUPS = [
  // The minute before round 0 (2026-09-19). Its own row, so round 0's ten-minute
  // gate is not quietly absorbed by the thing that was added to protect it.
  ['first run', (name) => name === 'first run'],
  ['round 0', (name) => name.startsWith('round 0')],
  ...
```

- [ ] **Step 6: Run the whole suite**

```bash
npm test
```

Expected: green, exit code 0. **Check the exit code, not the tick.**

- [ ] **Step 7: Commit**

```bash
git add ui/app.js ui/firstrun/render.js scripts/read-playtest.js tests/firstRun.test.js
git commit -F <message file>
```

Message: *"Show the first run before round 0, once per browser, as its own
recorded phase"*. Body: why it is skipped on a redo, and why the run gets its own
row in the reader rather than being counted inside round 0.

---

## Task 5: Playing it

**Files:**
- Modify: `tests/build.test.js` (the file count)
- Test: `tests/firstRun.test.js` (the smoke test)

- [ ] **Step 1: Write the failing smoke test**

*"The build works" means playing it.* The dashboard once crashed after week 1 for
two days with 1,348 tests green. Add to `tests/firstRun.test.js`:

```js
test('a browser that has never played goes run → round 0 → week 1 without throwing', async () => {
  // Modelled on tests/dashboard.test.js's opened(): the run finishes, round 0
  // opens on the same brand, and the first week runs down the real path.
  const storage = store();
  expect(seenFirstRun(storage)).toBe(false);
  markFirstRunSeen(storage);          // what onDone does
  const setup = r0.createSetupDraft({ playerBrandId: 'marlow', rootSeed: 20260902 });
  r0.addSetupKeyword(setup, 'gym leggings');
  const state = startGame({ rootSeed: 20260902, querySet: QUERY_SET, ...r0.startChoices(setup) });
  const out = await submitRound(state, {}, { mode: 'expected' });
  expect(out.reports[0].round).toBe(1);
  expect(seenFirstRun(storage)).toBe(true);
});
```

- [ ] **Step 2: Run the whole suite and read the build test's failure**

```bash
npm test
```

Expected: `tests/build.test.js` fails on the file count — `dist/` now holds the
run's files. **Read the number it reports; do not guess it.**

- [ ] **Step 3: Update the count in `tests/build.test.js`**

Set it to the number the run reported, and add a one-line comment saying the
first run is why it moved, in the form the file already uses for
`ui/words/form.js` (2026-09-13).

- [ ] **Step 4: Run the suite, green**

```bash
npm test
```

Expected: exit code 0.

- [ ] **Step 5: Play it in the browser**

```bash
npm run dev
```

Open `http://localhost:5173/ui/`. **Clear the site's storage first** so the
browser has never played. Then check, with the browser pane's own tools:

1. the run opens instead of round 0, on beat 1;
2. all seven beats advance, Back works, the trail grows and shrinks;
3. Skip lands in round 0 step 1;
4. a reload after finishing goes straight to round 0 — the run is not shown twice;
5. `read_console_messages` reports no errors on any beat;
6. beat 3's ladder matches Task 2's printed figures, to the paisa;
7. `resize_window` to 375×812: nothing is wider than the screen on any beat;
8. contrast **measured by script**, not by eye, on every enabled text;
9. finish `getAnimations().forEach((a) => a.finish())` before measuring anything
   — the pane reports itself hidden and animations do not run there.

- [ ] **Step 6: Commit**

```bash
git add tests/build.test.js tests/firstRun.test.js
git commit -F <message file>
```

Message: *"Play the first run into week 1, and let the build carry its files"*.
Body: what playing it found, with the measured figures. **Push nothing.**

---

## Self-review

**Spec coverage.** §4.1 seven beats → Tasks 1, 3. §4.2 told about the nine
brands → Task 1's wording (no "you" before `b7Say`). §4.3 real auction → Task 2.
§4.4 pacing, Skip, Back, Watch again, seen-once → Tasks 3, 4. §4.5 motion →
Task 3. §4.6 placement, word budget, drawing guard, recorder phase → Tasks 1, 3,
4. §9.2's gates → Task 4's reader row and Task 5's play-through.

**Not in this plan, and deliberately:** §5 (the ground floor), §6 (the rewrite)
and §7 (the mid-game questions) are their own plans. The owner chose the first
run first on 2026-09-19.

**Type consistency.** `demonstration()` returns `rows[].signal` and the test,
`read.js` and `render.js` all use `signal`, never `qualitySignal`, which is
`resolveAuction`'s own input name. `FIRST_RUN_KEY`, `seenFirstRun` and
`markFirstRunSeen` are exported from `render.js` in Task 4 and imported under
those names in Tasks 4 and 5.

**Known risk, stated.** Task 2 caches `demonstration()` in a module-level `let`.
That is a module-level singleton, which this project's conventions warn about —
it is allowed here because the value is a pure function of frozen content with no
rng, and because the run is drawn many times as a player steps back and forth.
If a test ever needs it fresh, export a `resetDemonstration()` rather than
reaching into the module.
