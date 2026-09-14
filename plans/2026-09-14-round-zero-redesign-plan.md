# Round 0 in the Studio look: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans
> (inline, the owner's choice for this project) task by task, each task after
> the owner's go-ahead. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** round 0 as five steps inside the Studio's sidebar layout, behind
`?look=studio`, with one rule changed (a self-written ad is graded on its words
from week 1), the brand assigned, 32 cities on a map that pulses by searches,
and the shared keyword kit that the weekly *Your keywords* later extends.

**Architecture:** round 0's rules move out of `ui/round-zero.js` into a pure
module, `ui/roundzero/rules.js`, which both looks read. A new controller,
`ui/roundzero/studio.js`, draws the same frame as the weekly shell (the same
`studio-*` classes) and mounts one drawing module per step. Go still calls
`begin` in `ui/app.js`, so the account opens exactly as it does today. Every
sentence is a `line` in `ui/words/`; the drawing modules hold none.

**Tech stack:** ES modules, no bundler, no framework; Vitest; ESLint; CSS with
`@starting-style` for motion; the market harness (`scripts/market-harness.js`).

**Spec:** `plans/2026-09-14-round-zero-redesign.md`. Read it first, all of it.
The canvas is https://claude.ai/code/artifact/b89a625b-19ea-4d93-b90b-a548f1d97680,
with its source in `design/round-zero/`. The makeover's own plan,
`plans/2026-09-13-studio-makeover-plan.md`, still holds except where this plan
amends it (Task 16).

## Global constraints

- Branch `makeover`. Commit after each green `npm test` (check the exit code),
  one concern per commit, present tense, the reasoning in the message. **Push
  nothing, `makeover` included, until the owner says.**
- CLAUDE.md applies, hard rules included. Money is integer paise; format only
  with `rupees`, `whole`, `pct` from `ui/dom.js`.
- **Every new `ui/` module joins `LOADABLE` in `tests/ui.test.js`** and touches no
  `document` or `window` while it loads. Folder names under `ui/` are lowercase
  letters only (the build's `RUNTIME` allows `ui/[a-z]+/[^/]+\.js`, one level).
- No `ui/` file names `homeCell`, `businessFor`, `territoryQueries`,
  `realisedConvRate` or the withheld query fields. Nothing in round 0 plots a
  territory or states a rival's square (I3, C5).
- **Every sentence on screen is a `line` in `ui/words/`**, of a kind; no digit is
  typed inside a words-file string (figures come in); the drawing modules hold
  no sentence (the drawing guard in `tests/words.test.js`). A `disclosure` names
  a guide chapter; every `why` names a chapter that exists.
- **Red signal:** red `#D7262F` means *you and your changes*. Rival ads, planner
  rows and the map are never red except for the player's own choices. Warnings
  are amber `#F2A53A`. Every text colour passes 4.5:1, measured by script.
- **Motion:** the makeover's six moments, plus the one named exception (the map's
  pulse, section 7 of the spec): transform and opacity only, curve
  `cubic-bezier(0.23, 1, 0.32, 1)`, under 300 ms except the pulse, off under
  reduced motion.
- **A control shows only what the game computes.** No forecasts.
- **Without `?look=studio` round 0 is today's page**, except for the two things
  the spec changes everywhere: the writer rule's wording and the extra cities.
  Play a classic round 0 into week 1 after every task that touches `app.js`,
  `ui/round-zero.js` or a shared module.
- **Anything that moves the market** is measured with
  `scripts/market-harness.js` before and after, against gates the owner agrees
  first (Tasks 3 and 4).
- **Never put a real-world claim in the game or the guide from memory**: fetch
  the source and cite it (Task 5; the cities in Task 6).
- **Any download needs the owner's yes first**, with its name, source and size.
- Edit files with the Edit tool; shell heredocs only for commit messages.
- "It works" means played in the browser pane on the dev server
  (`npm run dev`, then `http://localhost:5173/ui/?look=studio`).

## Before Task 1: what must already be built

This plan starts on the sidebar layout. From
`plans/2026-09-13-studio-makeover-plan.md`, build first, as written there:

- **Task 3** (sections and slots), **Task 4** (the tray's ids and order),
  **Task 5** (the shell);
- **Task 6** (the chapter *What the Quality Score is, and is not*). The spec's
  build order named 3–5 only; 6 moves forward because the keyword card this plan
  builds opens that chapter from its *QS* button, and `tests/words.test.js`
  refuses a `why` that names a chapter which does not exist.

## Where this plan narrows or departs from the spec

Each is the owner's to overrule before Task 1.

1. **`tests/writerBalance.test.js` is rewritten, not retired** (spec section 5 said
   retire). Two of its three orderings still hold under the new rule and are
   worth keeping: *paying more buys more*, and *writing badly loses to the
   cheapest writer*. The third flips from "writing well ≈ the retainer" to
   "writing well beats the retainer", which is the new rule's point.
2. **Guesses live in round 0's draft only** (spec section 8 said "stored with the
   browser save"). Round 0 is never saved (`ui/app.js`): the save is the state
   before week 1 plus the log, so a reload in round 0 loses every choice, guesses
   included, as it does today. After Go nothing reads them, because carrying them
   into the end reveal is the later decision in spec section 12. They are not
   stored until something reads them.
3. **Round 0 draws the sidebar layout with its own controller**, sharing the
   shell's classes, icons and kit, rather than as a branch inside
   `createStudio`. Every draw function in `ui/shell/shell.js` reads a played game
   (`game.reports`, `game.draft`, the month's spend); an `if (!game)` in each
   would be the harder file to read. On screen it is the same layout.
4. **Two new guide chapters** (Task 5): *Who writes the ad* and *Splitting the
   month into weeks*. No chapter covers I11 or D10 today, and round 0's "why?"
   links need somewhere to go.
5. **The eighteen cities' coordinates were typed by hand** (`SIM` in
   `design/build-cities.mjs`); only the 150 backdrop dots came from the geonames
   dataset. Task 6 takes all 32 from the dataset, which needs the owner's yes to
   download it. If the owner declines, Task 6 fetches each new city's page
   instead.
6. **The guide's "Show me on the card" is hidden in round 0.** Before week 1 there
   is no card to show, and a button that does nothing is worse than none
   (Task 9, one option in `ui/guide/drawer.js`).
7. **The default market's brand changes.** The canvas drew the player as Vella &
   Co. for illustration. Assigned from the seed, seed 20260902 draws whichever
   brand `assignPlayerBrand` gives it, and the eight rival ads shown are the
   other eight.

## File map

| file | task | job |
|---|---|---|
| `ui/roundzero/rules.js`, `tests/roundZeroRules.test.js` | 1, 2, 4 | round 0's rules, pure |
| `ui/round-zero.js` | 1, 4 | the classic page reads the rules from the new module; the writer wording |
| `setup.js`, `tests/setup.test.js` | 2, 4 | `assignPlayerBrand`; the writer rule in `creativeBlock` |
| `scripts/market-harness.js`, `tests/marketHarness.test.js` | 3 | the self-writing player, the `writer` mode, `compare` |
| `engine/constants.js`, `content/writers.js`, `game.js`, `ui/dashboard.js` | 4 | the constant deleted; `openingCopyGrades(tierId, bias, written)`; comments for old saves |
| `tests/writers.test.js`, `tests/dashboard.test.js`, `tests/game.test.js`, `tests/roundZero.test.js`, `tests/writerBalance.test.js`, `tests/fixtures/oldSave.js` | 4 | the tests the rule changes |
| `DECISIONS.md` | 4, 6, 16 | I11 rewritten; G4's city note; the round 0 entries |
| `ui/guide/chapters.js`, `tests/guide.test.js` | 5 | two chapters |
| `content/locations.js`, `ui/india-map.js`, `design/build-city-points.mjs`, `tests/locations.test.js` | 6 | 32 cities |
| `ui/kit/controls.js`, `ui/kit/card.js`, `ui/kit/planner.js`, `ui/kit/serp.js`, `ui/words/keywords.js`, `tests/kit.test.js` | 7 | the shared kit and its words |
| `ui/shell/shell.js` | 7 | imports `icon` and `button` from the kit |
| `ui/map/india.js`, `tests/indiaMap.test.js` | 8 | the map, drawn once for both uses |
| `ui/roundzero/studio.js`, `ui/words/roundZero.js`, `ui/app.js`, `ui/guide/drawer.js` | 9 | the frame, the steps list, the tray, Go |
| `ui/roundzero/market.js`, `position.js`, `keywords.js`, `ad.js`, `money.js` | 9–13 | one drawing module per step |
| `ui/studio.css` | 7–14 | the kit, the map, the frame, each step, motion |
| `tests/words.test.js`, `tests/ui.test.js` | 7–13 | the words and the loader map, as each module lands |
| docs | 16 | HANDOVER, CLAUDE.md, DECISIONS, the makeover plan's amendments |

---

### Task 1: move round 0's rules into a module both looks share

A move, not a rewrite: nothing any player sees changes. It exists so the five
new steps can read the same month, reserve and grade as the classic page, and
so those rules can be tested without a page.

**Files:** create `ui/roundzero/rules.js`, `tests/roundZeroRules.test.js`;
modify `ui/round-zero.js`, `tests/ui.test.js`.

**Interfaces produced** (all from `ui/roundzero/rules.js`):
- `syncPage(draft)`, `syncWriterCopy(draft, rootSeed)`: unchanged behaviour.
- `submittedAd(draft)`, `gradingContext(draft)`, `gradeAsSubmitted(draft)`,
  `openingReserve(draft, querySet)`: unchanged.
- `committed(draft) → paise`, `monthlyBudget(draft) → paise`,
  `evenSplit(total) → paise[]`, `splitShares(split) → number[]`.
- `positionMatrix() → {prices, rows}`.
- `researchList(querySet) → {id, text, intent, weekly}[]`, biggest first.
- `rivalAds(rootSeed, playerBrandId, querySet) → {name, domain, ad}[]`, sorted by
  name: the eight ads the market will actually run.
- `ui/round-zero.js` keeps exporting `openingReserve`, `submittedAd`,
  `gradeAsSubmitted`, `monthlyBudget`, `positionMatrix`, `splitShares` (re-exports),
  so `tests/roundZero.test.js` is untouched.

- [ ] **Step 1: Write the failing test,** `tests/roundZeroRules.test.js`:

  ```js
  /**
   * Round 0's rules, read without a page (plans/2026-09-14-round-zero-redesign.md,
   * section 8). The classic page and the Studio steps must read the SAME
   * functions, or a figure on one could disagree with the account.
   */
  import { describe, test, expect } from 'vitest';
  import * as classic from '../ui/round-zero.js';
  import * as rules from '../ui/roundzero/rules.js';
  import { assignIdentities } from '../content/brands.js';
  import { QUERY_SET } from '../content/querySet.js';

  describe('one set of rules for both looks', () => {
    test.each(['openingReserve', 'submittedAd', 'gradeAsSubmitted', 'monthlyBudget',
      'positionMatrix', 'splitShares'])('%s is the same function on both pages', (name) => {
      expect(classic[name]).toBe(rules[name]);
    });
  });

  describe('the rival ads round 0 shows', () => {
    const brand = 'nira';
    const ads = rules.rivalAds(20260902, brand, QUERY_SET);

    test('eight of them, none the player\'s own, in name order', () => {
      expect(ads).toHaveLength(8);
      expect(ads.map((a) => a.name)).toEqual([...ads.map((a) => a.name)].sort());
      const { player } = assignIdentities(brand);
      expect(ads.map((a) => a.name)).not.toContain(player.name);
    });

    test('each carries the ad the market will run, and no square', () => {
      for (const a of ads) {
        expect(a.ad.headlines.length).toBeGreaterThan(0);
        expect(Object.keys(a).sort()).toEqual(['ad', 'domain', 'name']);
      }
    });
  });

  describe('the research list', () => {
    test('every search, biggest first, with nothing Keyword Planner would not show', () => {
      const list = rules.researchList(QUERY_SET);
      expect(list).toHaveLength(QUERY_SET.queries.length);
      for (let i = 1; i < list.length; i++) expect(list[i - 1].weekly).toBeGreaterThanOrEqual(list[i].weekly);
      expect(Object.keys(list[0]).sort()).toEqual(['id', 'intent', 'text', 'weekly']);
    });
  });
  ```

  (`'nira'` is Nira's id in `content/brands.js`: any brand but the first will do.)

- [ ] **Step 2: Watch it fail.** `npx vitest run tests/roundZeroRules.test.js`:
  cannot find `../ui/roundzero/rules.js`.

- [ ] **Step 3: Create `ui/roundzero/rules.js`** with this head:

  ```js
  /**
   * Round 0's rules (plans/2026-09-14-round-zero-redesign.md, section 8): what
   * the month holds, what a bid must clear, how the ad grades, and what Go
   * sends. Pure: nothing here touches the page, so the classic round 0 and the
   * Studio's five steps read the same answers, and a test can read them too.
   *
   * MOVED FROM ui/round-zero.js, NOT REWRITTEN. Each function kept the comment
   * that explains why it is the way it is; ui/round-zero.js re-exports the ones
   * its tests import.
   */

  import { placeRivals, buildRivals } from '../../setup.js';
  import { BRAND_IDENTITIES, assignIdentities } from '../../content/brands.js';
  import { cellKey } from '../../engine/positions.js';
  import { writerCopyFor, WRITER_COPY_VARIANTS } from '../../content/writerCopy.js';
  import { explainGrade } from '../../agents/grader.js';
  import { heuristicTags } from '../../agents/keywordTagger.js';
  import {
    MONTHLY_BUDGET_PAISE, CAPEX_ALLOCATION_PAISE, ROUNDS_PER_MONTH,
    CREATIVE_ALLOCATION_PAISE, PRICE_TIERS, PURPOSES,
  } from '../../engine/constants.js';
  import {
    writerTier, isDiy, hiredCopyGrades, openingCopyGrades,
  } from '../../content/writers.js';
  import { qualitySignalBase } from '../../engine/quality.js';
  import { minimumBidToShowPaise } from '../../engine/auction.js';
  import { composeDescription } from '../landing-page.js';
  ```

  Then **cut these from `ui/round-zero.js` and paste them below the imports,
  each with the comment block above it**, adding `export` to every function:

  | what | lines in `ui/round-zero.js` today |
  |---|---|
  | `syncPage` | 92–94 (the two comment blocks above it, 66–73, go with it) |
  | `anyCopyWritten` (stays unexported) | 96–98 |
  | `syncWriterCopy` | 100–141 |
  | `committed` | 677–679 |
  | `researchList` | 795–806 |
  | `positionMatrix` | 875–898 |
  | `splitShares` | 900–914 |
  | `submittedAd` | 916–938 |
  | `gradingContext` | 940–955 |
  | `gradeAsSubmitted` | 957–980 |
  | `openingReserve` | 982–1050 |
  | `monthlyBudget` | 1485–1510 |
  | `evenSplit` | 1512–1517 |

  Line numbers are `ac457eb`'s; if makeover Tasks 3–6 moved them, find each by
  name. Add, at the end of the file, the one new function, lifted from
  `sectionRivals`:

  ```js
  /**
   * The eight rival ads, as the market will run them (17.1).
   *
   * THE SAME BUILDER startGame USES, with the same seed, so what is read in round
   * 0 is what will be played against, including which of a cell's two ads each
   * rival wears. Sorted by name, and carrying no cell: position is in the words.
   *
   * @param {number} rootSeed
   * @param {string} playerBrandId
   * @param {object} querySet
   * @returns {Array<{name: string, domain: string, ad: object}>}
   */
  export function rivalAds(rootSeed, playerBrandId, querySet) {
    const { rivals: identities } = assignIdentities(playerBrandId);
    const placement = placeRivals(rootSeed, identities.length);
    return buildRivals(identities, placement, querySet, () => 0.5)
      .map((rival) => ({ name: rival.name, domain: rival.domain, ad: rival.adGroups[0].ad }))
      .sort((a, b) => (a.name < b.name ? -1 : 1));
  }
  ```

- [ ] **Step 4: Point `ui/round-zero.js` at it.** Add:

  ```js
  import {
    syncPage, syncWriterCopy, committed, researchList, positionMatrix, splitShares,
    submittedAd, gradeAsSubmitted, openingReserve, monthlyBudget, evenSplit, rivalAds,
  } from './roundzero/rules.js';

  // Re-exported: tests/roundZero.test.js reads them from this page.
  export {
    openingReserve, submittedAd, gradeAsSubmitted, monthlyBudget, positionMatrix, splitShares,
  };
  ```

  In `sectionRivals`, replace the four lines from `const { rivals: identities }`
  to `.sort(...)` with `const ads = rivalAds(rootSeed, draft.playerBrandId, querySet);`.
  Remove every import the page no longer uses (`npm run lint` names them:
  `placeRivals`, `buildRivals`, `assignIdentities`, `cellKey`, `writerCopyFor`,
  `WRITER_COPY_VARIANTS`, `heuristicTags`, `hiredCopyGrades`, `openingCopyGrades`,
  `qualitySignalBase`, `minimumBidToShowPaise`, `composeDescription`,
  `MONTHLY_BUDGET_PAISE`, `PRICE_TIERS`, `PURPOSES`, as the linter finds them).

- [ ] **Step 5:** add `'roundzero/rules.js': () => import('../ui/roundzero/rules.js'),`
  to `LOADABLE`. Run `npm test`. Expected: green, the new file included, and
  `tests/roundZero.test.js` unchanged and passing.

- [ ] **Step 6: Play a classic round 0 into week 1** on the dev server (no
  `?look`): pick a writer, add two keywords, commit some capital, Go. The
  numbers on the page should match what you saw before the move. Commit:
  *Move round 0's rules into a module both looks can share*.

---

### Task 2: the rules the five steps need, and the brand assigned

**Files:** modify `ui/roundzero/rules.js`, `setup.js`,
`tests/roundZeroRules.test.js`, `tests/setup.test.js`.

**Interfaces produced:**
- `CAPEX_ORDER = ['landingPage', 'sizeGuide', 'photography', 'orderConfirmation']`.
- `SETUP_BID_PAISE = 3000` (round 0's starting bid today).
- `createSetupDraft({ playerBrandId, rootSeed }) → draft`: cell `mid|performance`,
  the freelancer, capital all kept, no keywords, `split: null`, `guesses: {}`,
  the freelancer's copy in the ad.
- `setCell(draft, cell, rootSeed)`, `setWriter(draft, tierId, rootSeed)`,
  `writeAd(draft, part, index, text)` (`part` is `'headlines'|'descriptions'`).
- `writerOptions(draft) → {id, label, pricePaise, grade, on}[]`.
- `adGrades(draft) → {expectedCtr, adRelevance, byWriter, checks, notes}`.
- `capitalOf(draft) → {committed, pending, remainingUnallocatedPaise}`.
- `capexRungs(draft, key) → {paise, label, on, affordable}[]`;
  `setCapex(draft, key, paise) → {ok, reason?}`.
- `landingGrade(draft) → {fromWeek1, fromWeek4, liveAt}`.
- `monthParts(draft) → {key: 'base'|'writer'|'kept', paise}[]`, zero parts left out.
- `weeklySplit(draft) → paise[]`; `setWeek(draft, index, paise)`.
- `addSetupKeyword(draft, text, {matchType, bidPaise}) → {ok, reason?}` (reason
  `'empty'|'held'`); `updateSetupKeyword(draft, text, change) → {ok}`;
  `removeSetupKeyword(draft, text) → {ok}`.
- `setupKeywordCards(draft, querySet) → card[]`, the kit card's model (Task 7):
  `{id, text, matchType, bidPaise, reach, tags|null, noTagsOnBroad, wasBidPaise:
  null, wasMatchType: null, isNew: true, stats: null, quality: {value: null,
  ratings: []}, active: null, needPaise|null}`.
- `setGuess(draft, rivalName, cell)`; `guessedIn(draft, cell) → string[]`.
- `stepsDone(draft, visited) → {market, position, keywords, ad, money}` (booleans).
- `checklist(draft) → {key: 'square'|'keywords'|'ad'|'money', done, need}[]`;
  `canGo(draft) → boolean`.
- `startChoices(draft) → {playerBrandId, player}`, the shape `begin` takes.
- `setup.js`: `assignPlayerBrand(rootSeed) → brand id`.

- [ ] **Step 1: Write the failing tests.** In `tests/roundZeroRules.test.js`, put
  these imports with the others at the top, and the blocks after them at the end:

  ```js
  import { startGame } from '../setup.js';
  import { BRAND_IDENTITIES } from '../content/brands.js';
  import { writerCopyFor, WRITER_COPY_VARIANTS } from '../content/writerCopy.js';
  import { keywordReach } from '../engine/matching.js';
  import { tagKeywordOffline } from '../agents/keywordTagger.js';
  import {
    MONTHLY_BUDGET_PAISE, CAPEX_ALLOCATION_PAISE, CREATIVE_ALLOCATION_PAISE,
    CAPEX_DELAY_ROUNDS, CAPEX_TARGETS, WRITER_TIERS, MIN_BID_PAISE,
  } from '../engine/constants.js';

  const SEED = 20260902;
  const BRAND = BRAND_IDENTITIES[1].id;
  const fresh = () => rules.createSetupDraft({ playerBrandId: BRAND, rootSeed: SEED });

  describe('the draft round 0 opens on', () => {
    test('mid-price performance, the freelancer, all capital kept, nothing bid on', () => {
      const d = fresh();
      expect(d).toMatchObject({ cell: 'mid|performance', writerTier: 'freelancer', keywords: [], split: null, guesses: {} });
      expect(Object.values(d.capex).every((p) => p === 0)).toBe(true);
    });

    test('the freelancer\'s own copy is already in the ad, so nobody meets empty boxes', () => {
      const brand = BRAND_IDENTITIES[1];
      const copy = writerCopyFor('mid|performance', 'freelancer', brand.name, SEED % WRITER_COPY_VARIANTS);
      expect(fresh().ad.headlines).toEqual(copy.headlines);
      expect(fresh().adIsSeeded).toBe(true);
    });

    test('and it follows the square, because the writer writes for your position', () => {
      const d = fresh();
      rules.setCell(d, 'value|lifestyle', SEED);
      const copy = writerCopyFor('value|lifestyle', 'freelancer', BRAND_IDENTITIES[1].name, SEED % WRITER_COPY_VARIANTS);
      expect(d.ad.headlines).toEqual(copy.headlines);
    });

    test('the month holds the base, what the freelancer left, and all the capital', () => {
      const left = CREATIVE_ALLOCATION_PAISE - WRITER_TIERS.find((t) => t.id === 'freelancer').pricePaise;
      expect(rules.monthlyBudget(fresh())).toBe(MONTHLY_BUDGET_PAISE + left + CAPEX_ALLOCATION_PAISE);
    });

    test('the step-5 order names every capital target, once', () => {
      expect([...rules.CAPEX_ORDER].sort()).toEqual([...CAPEX_TARGETS].sort());
    });
  });

  describe('the month, as step 5 draws it', () => {
    test('its parts add up to the month, and a zero part is left out', () => {
      const d = fresh();
      expect(rules.monthParts(d).reduce((a, p) => a + p.paise, 0)).toBe(rules.monthlyBudget(d));
      rules.setWriter(d, 'retainer', SEED);
      expect(rules.monthParts(d).map((p) => p.key)).toEqual(['base', 'kept']);
    });

    test('committing capital takes it out of the month, rupee for rupee', () => {
      const d = fresh();
      const before = rules.monthlyBudget(d);
      expect(rules.setCapex(d, 'sizeGuide', 2500000).ok).toBe(true);
      expect(before - rules.monthlyBudget(d)).toBe(2500000);
    });

    test('a rung the capital left cannot buy is refused, and shown as such', () => {
      const d = fresh();
      const video = rules.capexRungs(d, 'photography').at(-1);
      expect(video.affordable).toBe(false);
      expect(rules.setCapex(d, 'photography', video.paise)).toMatchObject({ ok: false });
    });

    test('the split is even until someone changes a week, and a new month re-splits it', () => {
      const d = fresh();
      expect(rules.weeklySplit(d).reduce((a, b) => a + b, 0)).toBe(rules.monthlyBudget(d));
      rules.setWeek(d, 0, 0);
      expect(rules.weeklySplit(d)[0]).toBe(0);
      rules.setCapex(d, 'sizeGuide', 2500000);
      expect(rules.weeklySplit(d).reduce((a, b) => a + b, 0)).toBe(rules.monthlyBudget(d));
    });
  });

  describe('the landing page grade, as the engine will run it (spec section 6)', () => {
    const grade = (capex) => {
      const d = fresh();
      for (const [key, paise] of Object.entries(capex)) rules.setCapex(d, key, paise);
      return rules.landingGrade(d);
    };

    test('its rows, from the game\'s own code', () => {
      // These are the figures the owner approved in the spec. If the landing
      // page's timing changes (spec section 12), this test and step 5 change with it.
      expect(grade({})).toMatchObject({ fromWeek1: 5, fromWeek4: 5 });
      expect(grade({ landingPage: 5500000 })).toMatchObject({ fromWeek1: 7, fromWeek4: 9 });
      expect(grade({ landingPage: 8000000 })).toMatchObject({ fromWeek1: 7, fromWeek4: 10 });
      expect(grade({ sizeGuide: 2500000 })).toMatchObject({ fromWeek1: 7, fromWeek4: 7 });
    });

    test('it never falls when the site goes live, and never passes ten', () => {
      for (const page of [0, 2500000, 5500000, 8000000]) {
        const { fromWeek1, fromWeek4, liveAt } = grade({ landingPage: page });
        expect(fromWeek4).toBeGreaterThanOrEqual(fromWeek1);
        expect(fromWeek4).toBeLessThanOrEqual(10);
        expect(liveAt).toBe(1 + CAPEX_DELAY_ROUNDS);
      }
    });
  });

  describe('keywords in round 0', () => {
    test('a keyword is added once, however it is typed', () => {
      const d = fresh();
      expect(rules.addSetupKeyword(d, 'gym leggings').ok).toBe(true);
      expect(rules.addSetupKeyword(d, '  Gym   Leggings ')).toEqual({ ok: false, reason: 'held' });
      expect(rules.addSetupKeyword(d, '   ')).toEqual({ ok: false, reason: 'empty' });
      expect(d.keywords).toEqual([{ text: 'gym leggings', matchType: 'phrase', bidPaise: rules.SETUP_BID_PAISE }]);
    });

    test('a bid never goes under the minimum', () => {
      const d = fresh();
      rules.addSetupKeyword(d, 'gym leggings');
      rules.updateSetupKeyword(d, 'gym leggings', { bidPaise: 1 });
      expect(d.keywords[0].bidPaise).toBe(MIN_BID_PAISE);
    });

    test('a card carries the engine\'s reach, and tags on broad only', () => {
      const d = fresh();
      rules.addSetupKeyword(d, 'gym leggings');
      rules.addSetupKeyword(d, 'squat proof leggings', { matchType: 'broad' });
      const [phrase, broad] = rules.setupKeywordCards(d, QUERY_SET);
      const tags = tagKeywordOffline({ text: 'gym leggings' }, QUERY_SET).tags;
      expect(phrase.reach).toBe(keywordReach({ text: 'gym leggings', matchType: 'phrase', tags }, QUERY_SET));
      expect(phrase.tags).toBeNull();
      expect(broad.tags.length).toBeGreaterThan(0);
      expect(phrase).toMatchObject({ id: 'gym leggings', isNew: true, stats: null, active: null });
    });

    test('a bid under the reserve says what it needs, and a bid over it says nothing', () => {
      const d = fresh();
      rules.addSetupKeyword(d, 'gym leggings', { bidPaise: MIN_BID_PAISE });
      rules.addSetupKeyword(d, 'sports bra');
      const [low, ok] = rules.setupKeywordCards(d, QUERY_SET);
      expect(low.needPaise).toBeGreaterThan(MIN_BID_PAISE);
      expect(ok.needPaise).toBeNull();
    });

    test('removing takes it out', () => {
      const d = fresh();
      rules.addSetupKeyword(d, 'gym leggings');
      expect(rules.removeSetupKeyword(d, 'gym leggings').ok).toBe(true);
      expect(d.keywords).toEqual([]);
    });
  });

  describe('guesses are the player\'s notes, and never leave round 0', () => {
    test('tapping a square notes it, tapping it again takes it back', () => {
      const d = fresh();
      rules.setGuess(d, 'Marlow', 'value|lifestyle');
      expect(rules.guessedIn(d, 'value|lifestyle')).toEqual(['Marlow']);
      rules.setGuess(d, 'Marlow', 'value|lifestyle');
      expect(rules.guessedIn(d, 'value|lifestyle')).toEqual([]);
    });

    test('Go sends no guess', () => {
      const d = fresh();
      rules.setGuess(d, 'Marlow', 'value|lifestyle');
      expect(JSON.stringify(rules.startChoices(d))).not.toContain('Marlow');
    });
  });

  describe('what Go needs, and what it sends', () => {
    test('a keyword and a finished ad; the square and the money arrive done', () => {
      const d = fresh();
      expect(rules.checklist(d).map((c) => [c.key, c.done])).toEqual([
        ['square', true], ['keywords', false], ['ad', true], ['money', true],
      ]);
      expect(rules.canGo(d)).toBe(false);
      rules.addSetupKeyword(d, 'gym leggings');
      expect(rules.canGo(d)).toBe(true);
    });

    test('writing it yourself empties the boxes, and the ad is not done until written', () => {
      const d = fresh();
      rules.addSetupKeyword(d, 'gym leggings');
      rules.setWriter(d, 'diy', SEED);
      expect(rules.checklist(d).find((c) => c.key === 'ad')).toMatchObject({ done: false, need: 'ad' });
    });

    test('a split that asks for more than the month stops Go', () => {
      const d = fresh();
      rules.addSetupKeyword(d, 'gym leggings');
      rules.setWeek(d, 0, rules.monthlyBudget(d));
      expect(rules.checklist(d).find((c) => c.key === 'money')).toMatchObject({ done: false, need: 'split' });
    });

    test('what it sends opens an account, with the capital live at week four', () => {
      const d = fresh();
      rules.addSetupKeyword(d, 'gym leggings');
      rules.setCapex(d, 'sizeGuide', 2500000);
      const choices = rules.startChoices(d);
      expect(choices.player.capex.pending).toEqual([{ target: 'sizeGuide', paise: 2500000, liveAtRound: 1 + CAPEX_DELAY_ROUNDS }]);
      const state = startGame({ rootSeed: SEED, querySet: QUERY_SET, ...choices });
      expect(state.round).toBe(1);
      expect(state.advertisers[0].id).toBe(BRAND);
    });

    test('a step is done when it has been seen, or when its choice is complete', () => {
      const d = fresh();
      expect(rules.stepsDone(d, new Set())).toEqual({ market: false, position: false, keywords: false, ad: true, money: false });
      rules.addSetupKeyword(d, 'gym leggings');
      expect(rules.stepsDone(d, new Set(['market', 'position', 'money'])))
        .toEqual({ market: true, position: true, keywords: true, ad: true, money: true });
    });
  });
  ```

  In `tests/setup.test.js`, import `assignPlayerBrand` with the other `setup.js`
  imports and add:

  ```js
  describe('the player\'s brand is drawn from the seed, not picked (round 0 redesign)', () => {
    test('the same seed is always the same brand', () => {
      expect(assignPlayerBrand(20260902)).toBe(assignPlayerBrand(20260902));
    });

    test('every brand turns up across seeds, so no name is never yours', () => {
      const drawn = new Set(Array.from({ length: 500 }, (_, i) => assignPlayerBrand(i + 1)));
      expect([...drawn].sort()).toEqual(BRAND_IDENTITIES.map((b) => b.id).sort());
    });
  });
  ```

  (import `BRAND_IDENTITIES` from `../content/brands.js` if the file does not yet).

- [ ] **Step 2: Watch them fail:** `npx vitest run tests/roundZeroRules.test.js tests/setup.test.js`.

- [ ] **Step 3: `assignPlayerBrand`,** in `setup.js`, after `canRedoRoundZero`:

  ```js
  /**
   * The player's brand, drawn from the seed (plans/2026-09-14-round-zero-redesign.md).
   *
   * Picking one of nine decided almost nothing: a brand's own searches run to
   * within two percent of each other whichever brand it is, so the pick was ten
   * buttons and a paragraph for no decision. Drawn from its own substream, so the
   * same seed is always the same brand and nothing else in the market moves.
   *
   * @param {number} rootSeed
   * @returns {string} a brand id from BRAND_IDENTITIES
   */
  export function assignPlayerBrand(rootSeed) {
    return BRAND_IDENTITIES[deriveSeed(rootSeed, 'player-brand') % BRAND_IDENTITIES.length].id;
  }
  ```

- [ ] **Step 4: The new rules,** appended to `ui/roundzero/rules.js`. Add
  `CAPEX_DELAY_ROUNDS, MIN_BID_PAISE, WRITER_TIERS` to its constants import, and
  add these imports:

  ```js
  import { parseCell } from '../../engine/positions.js';
  import { landingPageBonus } from '../../engine/positions.js';
  import { keywordReach } from '../../engine/matching.js';
  import { validateAdCopy } from '../../agents/grader.js';
  import { tagKeywordOffline } from '../../agents/keywordTagger.js';
  import { PAGE_FEATURES } from '../landing-page.js';
  ```

  (merge them into the existing import lines from the same modules), then:

  ```js
  // ---------------------------------------------------------------------------
  // The Studio's five steps (plans/2026-09-14-round-zero-redesign.md, section 4)
  // ---------------------------------------------------------------------------

  /** The order step 5 draws the targets in: the page first, as round 0 always has. */
  export const CAPEX_ORDER = Object.freeze(['landingPage', 'sizeGuide', 'photography', 'orderConfirmation']);

  /** Round 0's starting bid for a keyword, as the classic planner's. */
  export const SETUP_BID_PAISE = 3000;

  /** The round capital committed in round 0 goes live at. */
  const CAPITAL_LIVE_AT = 1 + CAPEX_DELAY_ROUNDS;

  const normal = (text) => String(text).trim().toLowerCase().replace(/\s+/g, ' ');

  /**
   * The draft the five steps fill in.
   *
   * THE FREELANCER, NOT WRITING IT YOURSELF, is the writer a player arrives on,
   * so somebody who does not want to write never meets five empty boxes (the
   * spec's section 4, step 4). `syncWriterCopy` puts the freelancer's copy in.
   *
   * `guesses` are the player's notes on where each rival sits: never sent, and
   * never confirmed by the game (section 4, step 2).
   *
   * @param {{playerBrandId: string, rootSeed: number}} args
   * @returns {object}
   */
  export function createSetupDraft({ playerBrandId, rootSeed }) {
    const draft = {
      playerBrandId,
      cell: 'mid|performance',
      capex: Object.fromEntries(CAPEX_ORDER.map((key) => [key, 0])),
      keywords: [],
      ad: { headlines: ['', '', ''], descriptions: ['', ''], landingPageDescription: '' },
      writerTier: 'freelancer',
      adIsSeeded: false,
      split: null,
      guesses: {},
    };
    syncPage(draft);
    syncWriterCopy(draft, rootSeed);
    return draft;
  }

  /** Choose a square. The writer's copy is written for the square, so it follows. */
  export function setCell(draft, cell, rootSeed) {
    draft.cell = cell;
    syncWriterCopy(draft, rootSeed);
  }

  /**
   * Choose who writes the ad. The month changes with the fee, so an edited
   * weekly split no longer adds up and goes back to even.
   */
  export function setWriter(draft, tierId, rootSeed) {
    writerTier(tierId);
    draft.writerTier = tierId;
    syncWriterCopy(draft, rootSeed);
    draft.split = null;
  }

  /** A keystroke in one of the ad's boxes: the words are now the player's (I25). */
  export function writeAd(draft, part, index, text) {
    draft.ad[part][index] = text;
    draft.adIsSeeded = false;
  }

  /** @returns {Array<{id: string, label: string, pricePaise: number, grade: number|null, on: boolean}>} */
  export function writerOptions(draft) {
    return WRITER_TIERS.map((tier) => ({
      id: tier.id, label: tier.label, pricePaise: tier.pricePaise, grade: tier.grade,
      on: tier.id === draft.writerTier,
    }));
  }

  /**
   * The two grades the ad sets, as the auction will use them from week 1.
   *
   * @returns {{expectedCtr: number, adRelevance: number, byWriter: boolean,
   *   checks: object[], notes: string[]}}
   */
  export function adGrades(draft) {
    const { applied, checks, notes } = gradeAsSubmitted(draft);
    return {
      expectedCtr: applied.expectedCtr,
      adRelevance: applied.adRelevance,
      byWriter: !isDiy(draft.writerTier),
      checks,
      notes,
    };
  }

  /** The capital as Go will send it: the block `startGame` reads (C8). */
  export function capitalOf(draft) {
    return {
      committed: { ...draft.capex },
      pending: CAPEX_ORDER
        .filter((target) => draft.capex[target] > 0)
        .map((target) => ({ target, paise: draft.capex[target], liveAtRound: CAPITAL_LIVE_AT })),
      remainingUnallocatedPaise: CAPEX_ALLOCATION_PAISE - committed(draft),
    };
  }

  /**
   * A target's rungs, each marked chosen and affordable. A rung is affordable
   * when what is committed to this target plus what is left would buy it:
   * photography's top rung never is in round 0.
   */
  export function capexRungs(draft, key) {
    const left = CAPEX_ALLOCATION_PAISE - committed(draft);
    return PAGE_FEATURES[key].map((rung) => ({
      paise: rung.paise,
      label: rung.label,
      on: draft.capex[key] === rung.paise,
      affordable: rung.paise <= draft.capex[key] + left,
    }));
  }

  /** Choose a rung. The page's description follows it (I9); the month re-splits. */
  export function setCapex(draft, key, paise) {
    const rung = capexRungs(draft, key).find((r) => r.paise === paise);
    if (!rung) return { ok: false, reason: 'no such rung' };
    if (!rung.affordable) return { ok: false, reason: 'more than the capital left' };
    draft.capex[key] = paise;
    syncPage(draft);
    draft.split = null;
    return { ok: true };
  }

  /**
   * The landing page grade, the third part of Quality Score, as the engine will
   * run it: the page the capital describes, graded (I9), which counts from week
   * 1; plus the page's own capital as points once the site goes live
   * (`landingPageBonus`, 13.3), capped at 10 as `round.js` caps it.
   *
   * The engine's own functions, so if the open question on the description's
   * timing (the spec's section 12) changes the rule, this follows.
   *
   * @returns {{fromWeek1: number, fromWeek4: number, liveAt: number}}
   */
  export function landingGrade(draft) {
    const graded = gradeAsSubmitted(draft).applied.landingPage;
    const block = capitalOf(draft);
    return {
      fromWeek1: Math.min(10, graded + landingPageBonus(block, 1)),
      fromWeek4: Math.min(10, graded + landingPageBonus(block, CAPITAL_LIVE_AT)),
      liveAt: CAPITAL_LIVE_AT,
    };
  }

  /** Where the month comes from, for step 5's bar. A part worth nothing is left out. */
  export function monthParts(draft) {
    return [
      { key: 'base', paise: MONTHLY_BUDGET_PAISE },
      { key: 'writer', paise: CREATIVE_ALLOCATION_PAISE - writerTier(draft.writerTier).pricePaise },
      { key: 'kept', paise: CAPEX_ALLOCATION_PAISE - committed(draft) },
    ].filter((part) => part.paise > 0);
  }

  /** The four weeks: even, unless the player has changed one. */
  export function weeklySplit(draft) {
    return draft.split ?? evenSplit(monthlyBudget(draft));
  }

  export function setWeek(draft, index, paise) {
    const split = [...weeklySplit(draft)];
    split[index] = Math.max(0, Math.round(paise));
    draft.split = split;
  }

  export function addSetupKeyword(draft, text, { matchType = 'phrase', bidPaise = SETUP_BID_PAISE } = {}) {
    const clean = normal(text);
    if (!clean) return { ok: false, reason: 'empty' };
    if (draft.keywords.some((k) => normal(k.text) === clean)) return { ok: false, reason: 'held' };
    draft.keywords.push({ text: clean, matchType, bidPaise: Math.max(MIN_BID_PAISE, Math.round(bidPaise)) });
    return { ok: true };
  }

  export function updateSetupKeyword(draft, text, change) {
    const keyword = draft.keywords.find((k) => k.text === text);
    if (!keyword) return { ok: false };
    if (change.matchType) keyword.matchType = change.matchType;
    if (change.bidPaise !== undefined) keyword.bidPaise = Math.max(MIN_BID_PAISE, Math.round(change.bidPaise));
    return { ok: true };
  }

  export function removeSetupKeyword(draft, text) {
    const i = draft.keywords.findIndex((k) => k.text === text);
    if (i >= 0) draft.keywords.splice(i, 1);
    return { ok: i >= 0 };
  }

  /**
   * Each keyword as the kit's card draws it (ui/kit/card.js), before any week
   * has run: no score, no figures, no "was". The tags are the ones the account
   * will be given (E9), shown on broad only (E8). `needPaise` is set only when
   * the bid cannot clear the reserve at the grade the account opens on.
   */
  export function setupKeywordCards(draft, querySet) {
    const reserve = openingReserve(draft, querySet);
    return draft.keywords.map((keyword, i) => {
      const tags = tagKeywordOffline({ text: keyword.text }, querySet).tags;
      const broad = keyword.matchType === 'broad';
      return {
        id: keyword.text,
        text: keyword.text,
        matchType: keyword.matchType,
        bidPaise: keyword.bidPaise,
        reach: keywordReach({ text: keyword.text, matchType: keyword.matchType, tags }, querySet),
        tags: broad ? tags : null,
        noTagsOnBroad: broad && tags.length === 0,
        wasBidPaise: null,
        wasMatchType: null,
        isNew: true,
        stats: null,
        quality: { value: null, ratings: [] },
        active: null,
        needPaise: reserve.rows[i].clears ? null : reserve.rows[i].needPaise,
      };
    });
  }

  /** Note a rival in a square; the same square again takes the note back. */
  export function setGuess(draft, rivalName, cell) {
    if (draft.guesses[rivalName] === cell) delete draft.guesses[rivalName];
    else draft.guesses[rivalName] = cell;
  }

  /** The rivals the player has noted in a square, by name. */
  export function guessedIn(draft, cell) {
    return Object.keys(draft.guesses).filter((name) => draft.guesses[name] === cell).sort();
  }

  /**
   * The ticks in the steps list. The two reading steps are done once seen; the
   * money step once seen and adding up; the others when their choice is complete.
   *
   * @param {object} draft
   * @param {Set<string>} visited - step keys the player has opened
   */
  export function stepsDone(draft, visited) {
    const money = checklist(draft).find((c) => c.key === 'money').done;
    return {
      market: visited.has('market'),
      position: visited.has('position'),
      keywords: draft.keywords.length > 0,
      ad: validateAdCopy(submittedAd(draft)).valid,
      money: visited.has('money') && money,
    };
  }

  /**
   * What Go waits for. `need` names what is missing, for the tray's words.
   *
   * @returns {Array<{key: string, done: boolean, need: string|null}>}
   */
  export function checklist(draft) {
    const planned = weeklySplit(draft).reduce((a, b) => a + b, 0);
    return [
      { key: 'square', done: true, need: 'square' },
      { key: 'keywords', done: draft.keywords.length > 0, need: 'keyword' },
      { key: 'ad', done: validateAdCopy(submittedAd(draft)).valid, need: 'ad' },
      { key: 'money', done: planned <= monthlyBudget(draft), need: 'split' },
    ].map((item) => ({ ...item, need: item.done ? null : item.need }));
  }

  export const canGo = (draft) => checklist(draft).every((item) => item.done);

  /**
   * What Go sends: exactly the shape the classic page's Go sends, so the account
   * opens the same way from either look. Guesses are not part of it.
   *
   * @returns {{playerBrandId: string, player: object}}
   */
  export function startChoices(draft) {
    return {
      playerBrandId: draft.playerBrandId,
      player: {
        position: parseCell(draft.cell),
        capex: capitalOf(draft),
        keywords: draft.keywords.map((k) => ({ ...k })),
        ad: submittedAd(draft),
        weeklySplitPaise: [...weeklySplit(draft)],
        writerTier: draft.writerTier,
      },
    };
  }
  ```

  Check `PAGE_FEATURES` has an entry for every key in `CAPEX_ORDER`
  (`ui/landing-page.js`, lines 57–130): it does at `ac457eb`.

- [ ] **Step 5: Watch them pass:** `npx vitest run tests/roundZeroRules.test.js tests/setup.test.js`.
  If a landing-grade row fails, print `rules.landingGrade` for that mix and
  compare it with the spec's section 6 before touching the expectation: the
  table was read off this code, so a difference means something moved.

- [ ] **Step 6:** `npm test`. Commit: *Give round 0's five steps their rules, and
  draw the player's brand from the seed*.

---

### Task 3: a self-writing player on the market harness, measured before

The rule change touches only an advertiser that writes its own ad, and the
harness's player hires the agency (`scripts/market-harness.js`, `harnessPlayer`),
so as it stands the harness could not see the change at all. This adds the same
player writing its own ad, and a way to compare two runs against the gates.

**Files:** modify `scripts/market-harness.js`, `tests/marketHarness.test.js`.

**Interfaces produced:**
- `harnessPlayer(cell, writerTier = 'agency')`.
- `playMarket({ seed, cell, from, rounds, playerDecision, writerTier = 'agency' })`.
- `writerRow({ seed, cell }) → {seed, cell, written, hired: {net, rank, rivals}, own: {net, rank, rivals}}`,
  where `rivals` is `{[id]: netProfitPaise}` and `written` the grade the
  self-written ad gets.
- `writerGates(before, after) → {rank: {before, after, ok}, hiredUnmoved: boolean, rivals: {id, before, after, change, ok}[], ok}`.
- CLI: `node scripts/market-harness.js writer <label> [workers]` and
  `node scripts/market-harness.js compare <before.json> <after.json>`.

- [ ] **Step 1: Write the failing tests.** In `tests/marketHarness.test.js`, import
  `writerGates` beside the others and add:

  ```js
  describe('the self-writing player, and the gates it is judged by (round 0 redesign)', () => {
    test('the same player, writing its own ad', () => {
      const own = harnessPlayer('mid|lifestyle', 'diy');
      expect(own.writerTier).toBe('diy');
      expect(own.keywords).toEqual(harnessPlayer('mid|lifestyle').keywords);
    });

    const row = (seed, ownRank, ownNet, hiredNet, rivalNet) => ({
      seed, cell: 'mid|lifestyle',
      own: { rank: ownRank, net: ownNet, rivals: { a: rivalNet, b: rivalNet } },
      hired: { rank: 4, net: hiredNet, rivals: { a: 100, b: 100 } },
    });

    test('a self-writer that climbs one place, a hire that does not move, rivals within 5%: pass', () => {
      const before = [row(1, 5, 10, 50, 100), row(2, 5, 10, 50, 100)];
      const after = [row(1, 4, 20, 50, 96), row(2, 4, 20, 50, 96)];
      expect(writerGates(before, after).ok).toBe(true);
    });

    test('a climb of more than one place fails', () => {
      const before = [row(1, 6, 10, 50, 100)];
      const after = [row(1, 4, 20, 50, 100)];
      expect(writerGates(before, after).rank.ok).toBe(false);
    });

    test('any change at all to the hiring player fails', () => {
      const before = [row(1, 5, 10, 50, 100)];
      const after = [row(1, 5, 10, 51, 100)];
      expect(writerGates(before, after).hiredUnmoved).toBe(false);
    });

    test('a rival whose median profit falls by more than 5% fails, and is named', () => {
      const before = [row(1, 5, 10, 50, 100)];
      const after = [row(1, 5, 10, 50, 94)];
      const out = writerGates(before, after);
      expect(out.ok).toBe(false);
      expect(out.rivals.filter((r) => !r.ok).map((r) => r.id)).toEqual(['a', 'b']);
    });
  });
  ```

- [ ] **Step 2: Watch them fail:** `npx vitest run tests/marketHarness.test.js`.

- [ ] **Step 3: The harness.** In `scripts/market-harness.js`:
  - add to the imports `import { gradeAdOffline } from '../agents/grader.js';`;
  - `harnessPlayer(cell, writerTier = 'agency')`, returning `writerTier` instead
    of the literal, and its JSDoc gaining
    `@param {string} [writerTier] - 'agency', or 'diy' for the self-writing player`;
  - `playMarket` takes `writerTier = 'agency'` and passes it:
    `player: harnessPlayer(cell, writerTier)`;
  - update the file's header comment: *THE PLAYER* paragraph gains "The `writer`
    mode plays the same player twice, hiring the agency and writing `AD`
    itself, for DECISIONS I11 (plans/2026-09-14-round-zero-redesign.md,
    section 5)." and the usage block gains the two new commands.

  Add, after `capitalRow`:

  ```js
  /** Every rival's final net profit, by id. */
  const rivalProfits = (state) => Object.fromEntries(state.advertisers
    .filter((a) => a.id !== PLAYER)
    .map((a) => [a.id, gameTotals(state.history, a.id).all.netProfitPaise]));

  /**
   * I11's comparison on one market: the player hiring the agency, and the same
   * player writing AD itself. `written` is the grade AD gets in this cell, the
   * figure the owner agreed counts as a competent self-written ad.
   */
  export async function writerRow({ seed, cell }) {
    const out = { seed, cell };
    for (const [key, writerTier] of [['hired', 'agency'], ['own', 'diy']]) {
      const { state } = await playMarket({ seed, cell, writerTier });
      out[key] = {
        net: gameTotals(state.history, PLAYER).all.netProfitPaise,
        rank: finalStandings(state).findIndex((r) => r.id === PLAYER) + 1,
        rivals: rivalProfits(state),
      };
    }
    const player = harnessPlayer(cell, 'diy');
    const rivalNames = BRAND_IDENTITIES.filter((b) => b.id !== PLAYER).map((b) => b.name);
    const { expectedCtr, adRelevance, landingPage } = gradeAdOffline(AD, { keywords: player.keywords, rivalNames }, 0);
    out.written = { expectedCtr, adRelevance, landingPage };
    return out;
  }

  /**
   * The gates agreed with the owner before the run (spec section 5): the
   * self-writing player's median rank improves by at most one place; the hiring
   * player does not move at all, since nothing it touches changed; and no
   * rival's median profit, in the self-writer's markets, falls by more than 5%.
   *
   * @param {object[]} before - writerRow rows
   * @param {object[]} after - writerRow rows, the same markets
   */
  export function writerGates(before, after) {
    const key = (r) => `${r.seed}|${r.cell}`;
    const then = new Map(before.map((r) => [key(r), r]));
    const rank = { before: median(before.map((r) => r.own.rank)), after: median(after.map((r) => r.own.rank)) };
    rank.ok = rank.before - rank.after <= 1;
    const hiredUnmoved = after.every((r) => {
      const was = then.get(key(r));
      return was && was.hired.net === r.hired.net && was.hired.rank === r.hired.rank;
    });
    const ids = Object.keys(before[0].own.rivals);
    const rivals = ids.map((id) => {
      const b = median(before.map((r) => r.own.rivals[id]));
      const a = median(after.map((r) => r.own.rivals[id]));
      const change = (a - b) / Math.abs(b);
      return { id, before: b, after: a, change, ok: change >= -0.05 };
    });
    return { rank, hiredUnmoved, rivals, ok: rank.ok && hiredUnmoved && rivals.every((r) => r.ok) };
  }

  function summariseWriter(rows) {
    const m = (f) => median(rows.map(f));
    const grades = [...new Set(rows.map((r) => `${r.cell} ${r.written.expectedCtr}/${r.written.adRelevance}`))];
    return [
      `${rows.length} markets`,
      `the self-written ad grades (expected CTR / ad relevance): ${grades.join(', ')}`,
      `hiring the agency: median rank ${m((r) => r.hired.rank)}, median net ₹${rupees(m((r) => r.hired.net))}`,
      `writing it: median rank ${m((r) => r.own.rank)}, median net ₹${rupees(m((r) => r.own.net))}`,
    ].join('\n');
  }

  function printGates(beforeFile, afterFile) {
    const out = writerGates(JSON.parse(readFileSync(beforeFile, 'utf8')), JSON.parse(readFileSync(afterFile, 'utf8')));
    console.log(`self-writer's median rank: ${out.rank.before} -> ${out.rank.after}  ${out.rank.ok ? 'PASS' : 'FAIL'}`);
    console.log(`the hiring player unmoved in every market: ${out.hiredUnmoved ? 'PASS' : 'FAIL'}`);
    for (const r of out.rivals) {
      console.log(`  ${r.id.padEnd(12)} median ₹${rupees(r.before)} -> ₹${rupees(r.after)} (${pct(r.change)})  ${r.ok ? 'PASS' : 'FAIL'}`);
    }
    console.log(out.ok ? 'ALL GATES PASS' : 'A GATE FAILED');
  }
  ```

  Then `MODES` gains `writer: [writerRow, summariseWriter]`, the mode error
  message lists all three, and the command line becomes:

  ```js
  if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const [first, ...rest] = process.argv.slice(2);
    if (first === '--worker') {
      const [mode, outFile, ...seeds] = rest;
      await worker(mode, outFile, seeds.map(Number));
    } else if (first === 'compare') {
      printGates(rest[0], rest[1]);
    } else {
      await main(first, rest[0] ?? 'run', Number(rest[1] ?? 6));
    }
  }
  ```

  `rupees` and `pct` are declared below `capitalRow` in the file; move the new
  functions below them if the linter objects.

- [ ] **Step 4:** `npx vitest run tests/marketHarness.test.js`, then `npm test`.
  Commit: *Measure a self-writing player on the market harness*.

- [ ] **Step 5: Show the owner what the self-writer writes, and agree the gates.**
  Print the grade `AD` gets in each cell without playing a game:

  ```bash
  node -e "import('./scripts/market-harness.js').then(async (h) => { const { gradeAdOffline } = await import('./agents/grader.js'); const { BRAND_IDENTITIES } = await import('./content/brands.js'); for (const cell of h.CELLS) { const p = h.harnessPlayer(cell, 'diy'); const g = gradeAdOffline(p.ad, { keywords: p.keywords, rivalNames: BRAND_IDENTITIES.filter((b) => b.id !== h.PLAYER).map((b) => b.name) }, 0); console.log(cell, g.expectedCtr, g.adRelevance, g.landingPage); } })"
  ```

  Put the six grades in front of the owner with the three gates from the spec
  (section 5) and ask two questions: is this the grade a careful player
  reaches, and are these the gates? **Stop until both are yes.** If the owner
  wants a different ad, that is a change to `AD`'s use in `writerRow` and this
  step runs again.

- [ ] **Step 6: The "before" run,** on the code as it stands (the two-week wait
  still in force):

  ```bash
  node scripts/market-harness.js writer before 6
  ```

  It prints a summary and the path of `harness-before-writer.json` in the
  system temp folder. Copy the summary into the task's notes; it goes into
  DECISIONS I11 in Task 4. Nothing is committed in this step.

---

### Task 4: the writer rule: a self-written ad is graded on its words from week 1

**Files:** modify `engine/constants.js`, `content/writers.js`, `setup.js`,
`ui/roundzero/rules.js`, `ui/round-zero.js`, `game.js`, `ui/dashboard.js`,
`DECISIONS.md`; tests `tests/setup.test.js`, `tests/writers.test.js`,
`tests/dashboard.test.js`, `tests/game.test.js`, `tests/roundZero.test.js`,
`tests/writerBalance.test.js`; create `tests/fixtures/oldSave.js`.

**Interfaces produced:**
- `openingCopyGrades(tierId, bias = 0, written = null)`: for `diy`, the written
  grade's two copy components; throws if `written` is missing.
- `CREATIVE_DIY_LIVE_ROUND` no longer exists.
- A self-written player opens with `creative.liveAtRound === 1`,
  `pendingGrade === null`, and its written grade in `gradedQuality`.
- `game.js`'s `landCreative` and `dashboard.js`'s `creativeOutlook` are
  unchanged: a save written before this commit carries `liveAtRound: 3` and a
  `pendingGrade` in its first state, and must still replay exactly.
- `tests/fixtures/oldSave.js`: `OLD_SAVE_LIVE_ROUND = 3`, `asOldSave(state)`.

- [ ] **Step 1: The old-save fixture,** `tests/fixtures/oldSave.js`:

  ```js
  /**
   * A game as it was saved before the writer rule changed (DECISIONS I11,
   * 2026-09-14). A save stores the state before week 1, so a self-written ad
   * saved then still waits for week 3 in it, and `game.js` must still land it
   * there on replay. New games never look like this.
   */
  import { DEFAULT_UNGRADED_QUALITY } from '../../engine/constants.js';

  /** The week a self-written ad went live under the old rule. */
  export const OLD_SAVE_LIVE_ROUND = 3;

  /**
   * @param {object} state - a new game whose player writes its own ad
   * @returns {object} the same game, shaped as a save from before the change
   */
  export function asOldSave(state) {
    const [player, ...rivals] = state.advertisers;
    const [group, ...groups] = player.adGroups;
    const written = group.gradedQuality;
    return {
      ...state,
      advertisers: [{
        ...player,
        creative: {
          ...player.creative,
          liveAtRound: OLD_SAVE_LIVE_ROUND,
          pendingGrade: {
            expectedCtr: written.expectedCtr, adRelevance: written.adRelevance, landingPage: written.landingPage,
          },
        },
        adGroups: [{
          ...group,
          gradedQuality: {
            ...written,
            expectedCtr: DEFAULT_UNGRADED_QUALITY.expectedCtr,
            adRelevance: DEFAULT_UNGRADED_QUALITY.adRelevance,
          },
        }, ...groups],
      }, ...rivals],
    };
  }
  ```

- [ ] **Step 2: Change the tests to the new rule.**
  - `tests/setup.test.js`: remove `CREATIVE_DIY_LIVE_ROUND` from the imports,
    add `gradeAdOffline` from `../agents/grader.js` and `BRAND_IDENTITIES` if
    missing, and replace the test *a self-written ad runs weak until it lands,
    then becomes what was written* with:

    ```js
    test('a self-written ad runs on its own words from week 1 (I11)', () => {
      const diy = start().advertisers.filter((a) => isDiy(a.creative.tier));
      expect(diy.length, 'nobody writes their own, so the rule is unreachable').toBeGreaterThan(0);
      for (const a of diy) {
        const group = a.adGroups[0];
        const written = gradeAdOffline(group.ad, {
          keywords: group.keywords,
          rivalNames: BRAND_IDENTITIES.filter((b) => b.id !== a.id).map((b) => b.name),
        }, 0);
        expect(a.creative.liveAtRound, a.id).toBe(1);
        expect(a.creative.pendingGrade, a.id).toBeNull();
        expect(group.gradedQuality.expectedCtr, a.id).toBe(written.expectedCtr);
        expect(group.gradedQuality.adRelevance, a.id).toBe(written.adRelevance);
      }
    });
    ```

    If the player in `start()` hands `startGame` keywords that differ from the
    tagged ones in text, grade against `start()`'s own keyword list instead:
    `adRelevance` reads keyword text only.
  - `tests/writers.test.js`: remove `CREATIVE_DIY_LIVE_ROUND` from the imports;
    in *both measured constants are declared*, rename it *the measured ladder is
    declared, and not as CALIBRATE* and delete the `CREATIVE_DIY_LIVE_ROUND`
    line; delete the whole *the delay is a delivery date* block; import
    `openingCopyGrades` and add:

    ```js
    describe('what an advertiser opens on (I11)', () => {
      test('writing it yourself opens on what was written', () => {
        const written = { expectedCtr: 7, adRelevance: 9, landingPage: 5 };
        expect(openingCopyGrades('diy', 0, written)).toEqual({ expectedCtr: 7, adRelevance: 9 });
      });

      test('and asking without the writing is an error, not a default', () => {
        // The old answer was the ungraded 3/3. Returning it now would quietly put
        // the two-week wait back for any caller that forgot the grade.
        expect(() => openingCopyGrades('diy')).toThrow(RangeError);
      });

      test('a hire opens on what it bought, whatever was written', () => {
        const written = { expectedCtr: 2, adRelevance: 2, landingPage: 5 };
        for (const tier of HIRED) {
          expect(openingCopyGrades(tier.id, 0, written)).toEqual(hiredCopyGrades(tier.id, 0));
        }
      });
    });
    ```

  - `tests/dashboard.test.js`: replace the `CREATIVE_DIY_LIVE_ROUND` import with
    `import { OLD_SAVE_LIVE_ROUND, asOldSave } from './fixtures/oldSave.js';`, and
    every use of `CREATIVE_DIY_LIVE_ROUND` in the file with `OLD_SAVE_LIVE_ROUND`.
    In the two played tests (*it reports pending in exactly the rounds…* and
    *the round it calls landed…*), start from `asOldSave(start('diy'))` instead of
    `start('diy')`. Rename the first `describe` to *whether the dashboard says
    anything about the copy, in a game saved before I11 changed*, and add to the
    second block:

    ```js
    test('a new self-written account has nothing to report, at any round', () => {
      // Since I11 changed, a self-written ad runs from week 1: nothing waits.
      let state = start('diy');
      while (state.round <= 4) {
        expect(creativeOutlook(state.advertisers[0].creative, state.round), `round ${state.round}`).toBeNull();
        state = submitRound(state, {}, { mode: 'expected' }).nextGameState;
      }
    });
    ```

    Update the file's header comment: the measurement it describes was taken
    under the old rule, and the card now speaks only to saves from before it.
  - `tests/game.test.js`: in *a game played here is rebuilt exactly from its first
    state and its log*, import `asOldSave` and make `initial` return
    `asOldSave(startGame({...}))`, changing the comment on `writerTier: 'diy'` to
    "Self-written and saved before I11 changed, so the copy lands at week 3: the
    thing runRound never does, and old saves still need."
  - `tests/roundZero.test.js`, in *what round 0 says a bid has to clear*:
    replace *the grade it prices against is the one the FIRST auction runs at*
    with:

    ```js
    test('writing it yourself prices the floor at what you wrote, from week 1 (I11)', () => {
      const out = openingReserve(draft(), QUERY_SET);
      const written = gradeAsSubmitted(draft()).written;
      expect(out.grade.expectedCtr).toBe(written.expectedCtr);
      expect(out.grade.adRelevance).toBe(written.adRelevance);
      expect(out.grade.landingPage).toBe(written.landingPage);
    });
    ```

    In *it asks content/writers.js for that grade instead of restating it*, the
    expectation becomes
    `openingCopyGrades(tier.id, 0, gradeAsSubmitted(draft({ writerTier: tier.id })).written)`.
    Replace *hiring lowers the floor, which is the trade being made visible* and,
    in *when it fires*, *a hired account at the same low bid is not warned* with:

    ```js
    const WEAK = { headlines: ['Leggings'], descriptions: ['Leggings for training.'], landingPageDescription: AD.landingPageDescription };

    test('a weak ad of your own raises the floor; a hire guarantees its level', () => {
      const own = openingReserve(draft({ ad: WEAK }), QUERY_SET).rows[0].needPaise;
      const hired = openingReserve(draft({ ad: WEAK, writerTier: 'freelancer' }), QUERY_SET).rows[0].needPaise;
      expect(own).toBeGreaterThan(hired);
    });
    ```

    ```js
    test('at a bid a hire clears, a weak ad of your own is warned', () => {
      const need = openingReserve(draft({ ad: WEAK, writerTier: 'freelancer' }), QUERY_SET).rows[0].needPaise;
      expect(at(need, { ad: WEAK, writerTier: 'freelancer' }).under.length, 'freelancer').toBe(0);
      expect(at(need, { ad: WEAK }).under.length, 'a weak ad of your own').toBe(1);
    });
    ```

    (`WEAK` goes beside `AD` at the top of the file.) If *round 0 grades the ad
    it is about to submit* fails anywhere on `applied`, read the case before
    changing it: `applied` for `diy` is the written grade, as before.
  - `tests/writerBalance.test.js`: rewrite the header comment's list as

    ```
     *   write it well  ->  better than the retainer: the fee buys not having to
     *                      write, and insurance, never a better ad than a careful
     *                      writer's (I11, since 2026-09-14)
     *   write it badly ->  worse than the cheapest writer you could have hired
     *   pay more       ->  get more
    ```

    and replace *written well, it lands close to what the retainer would have
    bought* with:

    ```js
    test('written well, it beats the retainer, which is the point (I11)', async () => {
      // The fee buys not having to write. A player who writes as well as the
      // grader can see keeps the whole creative budget and runs a better ad, so
      // writing well has to come out ahead. If it does not, the rule is not
      // doing what I11 says.
      const [own, retainer] = await Promise.all([
        profitOf('diy', WELL_WRITTEN),
        profitOf('retainer', WELL_WRITTEN),
      ]);
      expect(own).toBeGreaterThan(retainer);
    }, 120000);
    ```

    In *written badly, you should have hired the cheapest writer going*, replace
    "Without this the delay is the only cost, and the delay alone is not enough
    to price the option." with "It is the insurance the fee buys."

- [ ] **Step 3: Watch them fail:**
  `npx vitest run tests/setup.test.js tests/writers.test.js tests/dashboard.test.js tests/roundZero.test.js`.
  Expected: the new tests fail on the old rule (`liveAtRound` 3, the 3/3 floor,
  and `openingCopyGrades('diy')` not throwing).

- [ ] **Step 4: The rule.**
  - `content/writers.js`: the header's second paragraph becomes "Hiring is
    guaranteed and capped; writing it yourself is free, uncapped to the offline
    grader's ceiling, and only as good as what you actually wrote. Both run from
    week 1 (I11: until 2026-09-14 a self-written ad waited until week 3)." Then:

    ```js
    /**
     * The two copy grades an advertiser actually OPENS on, at round 1.
     *
     * For a hired tier this is what the tier bought. For an advertiser writing
     * its own, it is what was written: since 2026-09-14 a self-written ad runs
     * from week 1, so the fee buys not having to write, never a head start (I11).
     *
     * WHY IT IS A FUNCTION AND NOT TWO BRANCHES IN THE CALLER. Two places need it:
     * `creativeBlock` in `setup.js`, which builds the account, and round 0's own
     * reserve warning, which has to know what grade the first auction will run
     * at. A screen that computes its own version of a rule the engine also
     * computes disagrees with it eventually, and the disagreement is invisible.
     *
     * @param {string} tierId
     * @param {number} [bias] -1, 0 or +1, as `hiredCopyGrades` takes it
     * @param {{expectedCtr: number, adRelevance: number}|null} [written] - the
     *   graded copy, required when the advertiser writes its own
     * @returns {{expectedCtr: number, adRelevance: number}}
     * @throws {RangeError} for a self-written ad with no grade: the old default of
     *   3/3 would silently bring back the wait this rule removed
     */
    export function openingCopyGrades(tierId, bias = 0, written = null) {
      if (isDiy(tierId)) {
        if (!written) throw new RangeError('a self-written ad opens on what was written: pass its grade');
        return { expectedCtr: written.expectedCtr, adRelevance: written.adRelevance };
      }
      return hiredCopyGrades(tierId, bias);
    }
    ```

    and remove `DEFAULT_UNGRADED_QUALITY` from its import if nothing else there
    uses it.
  - `setup.js`, `creativeBlock`: replace its body from `const opening = ...` to
    the end with:

    ```js
    // One grader pass, whoever writes: a hire discards it, and a self-written
    // ad runs on it from week 1 (I11).
    const written = isDiy(tierId) ? (writtenGrade ?? gradeAdOffline(ad, { keywords }, 0)) : null;
    // One source for "what grade does this advertiser open on", because round 0's
    // reserve warning needs the same answer and a second copy of it would drift.
    const opening = { ...openingCopyGrades(tierId, bias, written), landingPage };
    return { ...base, liveAtRound: 1, pendingGrade: null, openingGrade: opening };
    ```

    Rewrite the JSDoc paragraph "Hiring is immediate … which is what makes the
    delay cost anything." as: "Hiring buys a guaranteed level; writing it
    yourself is graded on the words. Both run from round 1. `liveAtRound` and
    `pendingGrade` stay in the block because saves made before 2026-09-14 carry a
    self-written ad due at round 3, and `game.js` still lands it (I11)." In
    `buildPlayer`, replace "The default is DIY because writing their own copy is
    what the player has always done here; the delay is the new cost of doing so,
    not a new behaviour." with "The default is DIY, as it always was here."
    Remove `CREATIVE_DIY_LIVE_ROUND` from the imports.
  - `engine/constants.js`: delete the `CREATIVE_DIY_LIVE_ROUND` block (the JSDoc
    and `export const`, lines 912–920 at `ac457eb`) and its `PROVENANCE` line;
    in the `WRITER_TIERS` comment, replace "— but not until
    CREATIVE_DIY_LIVE_ROUND." with ". Since 2026-09-14 that runs from week 1,
    like a hire (I11)." and add after its *MEASURED, NOT CHOSEN* paragraph: "That
    ladder was measured while a self-written ad waited two weeks. Without the
    wait a careful self-written ad beats the retainer; the ladder is left where
    it was, because what a hire guarantees did not change, and I11 records the
    harness figures for the change."
  - `ui/roundzero/rules.js`, `openingReserve`: the grade becomes

    ```js
    const written = gradeAsSubmitted(draft).written;
    const grade = {
      ...openingCopyGrades(draft.writerTier, 0, written),
      // The player's own page, graded from what the capital built (I9).
      landingPage: written.landingPage,
    };
    ```

    and in its JSDoc replace the *MEASURED* and *THE GRADE IS THE OPENING ONE*
    paragraphs with: "THE GRADE IS THE ONE THE FIRST AUCTION RUNS AT: a hire's
    level, or since 2026-09-14 (I11) the words as written. A weak ad of your own
    raises this floor; a better one lowers it, and so does raising the bid."
  - `ui/round-zero.js` (the classic page's words, which the rule makes false):
    - in `sectionWriter`, the self-written line becomes
      `` `Graded on what you actually write — ${written.expectedCtr}/10 and ${written.adRelevance}/10 as it stands, running from week 1.` ``;
    - in `drawGrade`, `` `How this ad grades, as it stands — live from week ${CREATIVE_DIY_LIVE_ROUND}` ``
      becomes `'How this ad grades, as it stands — live from week 1'`;
    - in `sectionKeywords`' reserve note, `` `${out.grade.expectedCtr}/10 for both copy components` ``
      becomes `` `${out.grade.expectedCtr}/10 and ${out.grade.adRelevance}/10 for the copy` ``,
      the clause `${isDiy(draft.writerTier) ? ', because you are writing the ad yourself' : ''}`
      goes, and the closing DIY sentence becomes
      `' That floor is set by the ad as you wrote it — a better ad lowers it, and so does raising the bid.'`;
    - remove `CREATIVE_DIY_LIVE_ROUND` from the imports.
  - `game.js`, above `landCreative`: add "Since 2026-09-14 no new game sets a
    `pendingGrade` (I11): a self-written ad runs from week 1. This stays for
    saves made before then, which carry one due at round 3 in their first
    state and must replay exactly."
  - `ui/dashboard.js`, `creativeOutlook`'s JSDoc: add "Only a game saved before
    2026-09-14 can reach 'pending' (I11)."

- [ ] **Step 5: Watch them pass,** then the whole suite: `npm test`. Expected:
  green. `tests/save.test.js` and `tests/readPlaytest.test.js` play self-written
  games; if either fails, read what it asserts before changing it, and say in
  the commit why its figure moved.

- [ ] **Step 6: The "after" run and the gates.**

  ```bash
  node scripts/market-harness.js writer after 6
  ```

  ```bash
  node scripts/market-harness.js compare "<temp>/harness-before-writer.json" "<temp>/harness-after-writer.json"
  ```

  (`<temp>` is the folder the two runs printed.) **If any gate fails, stop:**
  do not commit the rule; put the gate output in front of the owner and decide
  together.

- [ ] **Step 7: DECISIONS I11, rewritten** with the measured figures. In the
  table, the first row's *live* column becomes **week 1**. Replace the paragraph
  *So the currency is time and certainty, not money…* with:

  ```markdown
  **The fee buys not having to write, and insurance** (since 2026-09-14,
  plans/2026-09-14-round-zero-redesign.md). Writing your own is free and graded
  on the words from week 1; hiring guarantees the writer's level from week 1. A
  player who writes a 4 loses far more than any fee, since one grade point is
  worth about ₹1,33,986 over a game; a player who writes an 8 keeps the fee and
  runs a better ad than the retainer's. Until 2026-09-14 the currency was time:
  a self-written ad ran on the ungraded 3/3 until week 3, an invented wait whose
  only job was to make the choice cost something. The owner kept the fee so round
  0 introduces the idea that copy can be bought, and moved what it buys.
  ```

  Replace *THE DELIVERY IS DELAYED, NEVER THE EFFECT* with:

  ```markdown
  **MEASURED BEFORE AND AFTER** on `scripts/market-harness.js` (72 markets, the
  `writer` mode: F15's player hiring the agency, and the same player writing its
  own ad, graded <the six grades Task 3 printed>). Gates agreed with the owner
  before the run: the self-writer's median rank improves by at most one place;
  the hiring player does not move; no rival's median profit falls by more than
  5%. Result: median rank <before> → <after>; the hiring player unmoved in
  every market; the largest rival fall <rival, change>. `game.js` still lands a
  pending grade, for saves made before the change.
  ```

  (the angle-bracketed fields are the harness's output from Tasks 3 and 4,
  copied exactly). In *THE ROLLOVER IS LOAD-BEARING*, add at its end: "Under the
  new rule `tests/writerBalance.test.js` holds writing well above the retainer
  rather than level with it." In *RIVALS HIRE*, keep the history of `cautious`
  and add: "The 3/3 opening it describes no longer applies to anyone new."

- [ ] **Step 8:** `npm test` once more, then play a classic round 0 with *Write it
  yourself* into week 2: the grade the card shows is the one in week 1's
  Quality Score parts, and no "your copy lands" line appears. Commit: *Grade a
  self-written ad on its words from week 1: the fee buys not having to write*.
  The message carries the gate results.

---

### Task 5: two guide chapters round 0 points at

Round 0's "why?" links need somewhere to go, and nothing covers who writes the
ad (I9, I10, I11, I25) or the weekly split (D10). The real halves are written
at build time from pages fetched then, by the project's rule; this plan does not
write them from memory.

**Files:** modify `ui/guide/chapters.js`; `tests/guide.test.js` needs no change
(it checks every chapter's citations and slot).

**Interfaces produced:** `CHAPTERS.writers` (`yourAccount: 'keywords'`) and
`CHAPTERS.weeklySplit` (`yourAccount: 'split'`), both in `CONTENTS`.

- [ ] **Step 1: Fetch the sources,** with WebFetch, and keep what each page says
  that the chapter will use, quoted, for the owner:
  - for *Who writes the ad*: Google Ads Help *About Quality Score for Search
    campaigns* (the three components: expected click-through rate, ad
    relevance, landing page experience) and *About responsive search ads*
    (answer 7684791: headlines and descriptions, how Google assembles them).
    Makeover Task 6 already fetched and stored the Quality Score page as
    `GOOGLE.qualityScore`; reuse it.
  - for *Splitting the month into weeks*: Google Ads Help *About average daily
    budgets* (find it through the Help Center and confirm the address loads):
    what Google lets an advertiser set, and how spend may vary day to day within
    the month.

  Add the new pages to `GOOGLE` as `responsiveSearchAds` and `dailyBudgets`, each
  `{ label: 'Google Ads Help: <the page's title>', url: <as fetched> }`.

- [ ] **Step 2: Draft both real halves** from those pages only, four or five
  sentences each, and show them to the owner beside the quotes they rest on.
  **Stop until the owner approves the wording.**

- [ ] **Step 3: Add the chapters,** after `hours` in `CHAPTERS`, with the approved
  real halves in place of the two `real` bodies below. The game halves are
  written from DECISIONS and type no number:

  ```js
    writers: chapter({
      title: 'Who writes the ad',
      real: () => '<the approved real half, from GOOGLE.qualityScore and GOOGLE.responsiveSearchAds>',
      realSources: [GOOGLE.qualityScore, GOOGLE.responsiveSearchAds],
      game: () => 'Here you choose who writes the ad before the first week, and the choice sets two '
        + 'of the three parts of Quality Score: expected click-through and ad relevance. A hired '
        + 'writer’s ad runs at the writer’s level, whatever the words say, because this game '
        + 'cannot judge professional writing. Writing it yourself costs nothing, and the game’s own '
        + 'grader scores your words by rules, not taste: it counts echoing your own keywords for '
        + 'more than reading well, and it refuses to award the top of the scale on rules alone. '
        + 'Both run from week 1. What the writer does not cost goes to your ads, so the fee buys '
        + 'not having to write, and insurance against writing badly. The third part, the landing '
        + 'page, is your site, built with capital, and no writer touches it. Where it departs: '
        + 'Google has no idea who wrote your ad.',
      cites: ['I11', 'I10', 'I25', 'I9'],
      yourAccount: 'keywords',
      related: ['qualityScore'],
    }),

    weeklySplit: chapter({
      title: 'Splitting the month into weeks',
      real: () => '<the approved real half, from GOOGLE.dailyBudgets>',
      realSources: [GOOGLE.dailyBudgets],
      game: () => 'Here each month’s money is a fixed amount, split across its four weeks: evenly, '
        + 'unless you change the split. A week spends what it was given and no more, and money '
        + 'left at the end of the month is lost; nothing carries over. Google offers no such '
        + 'decision, and the game keeps it because it makes a week’s pacing something you set and '
        + 'can read afterwards, rather than something the platform does for you.',
      cites: ['D10'],
      yourAccount: 'split',
      related: ['rankOrBudget'],
    }),
  ```

  Check before committing that each cited entry exists in `DECISIONS.md` and
  says what the chapter claims (`I9`, `I10`, `I11` as rewritten in Task 4, `I25`,
  `D10`), and that D10 does describe unspent money as lost at the month's end;
  if it does not, cite the entry that does, or cut the sentence. `CONTENTS`
  gains `'writers'` after `'broadMatch'` and `'weeklySplit'` after `'hours'`.

- [ ] **Step 4:** `npx vitest run tests/guide.test.js tests/sections.test.js`, then
  `npm test`. Open both chapters in the drawer on the dev server and read them
  through once. Commit: *Write the two chapters round 0 points at: who writes
  the ad, and the weekly split*.

---

### Task 6: thirty-two cities, placed from the dataset

**Files:** create `design/build-city-points.mjs`; modify `content/locations.js`,
`ui/india-map.js`, `tests/locations.test.js`, `DECISIONS.md` (G4's note).

**Interfaces produced:** `LOCATIONS[i].examples` with 8, 12 and 12 names;
`CITY_POINTS` with all 32.

- [ ] **Step 1: The owner's yes to the download.** Find its size first:

  ```bash
  curl -sI https://raw.githubusercontent.com/lutangar/cities.json/master/cities.json
  ```

  Tell the owner the name (`cities.json`), the source
  (github.com/lutangar/cities.json, geonames-derived, the dataset the backdrop's
  150 dots came from) and the `Content-Length`, and that it goes to the
  scratchpad, never the repository. **Stop until the owner says yes.** If the
  owner says no, fetch each of the fourteen new cities' coordinates from its
  GeoNames page instead, keep the eighteen as they are, and record every source
  in the script's table.

- [ ] **Step 2: Write the failing tests** in `tests/locations.test.js`, importing
  `CITY_POINTS` and `MAP_VIEWBOX` from `../ui/india-map.js`:

  ```js
  describe('the cities round 0 names (plans/2026-09-14-round-zero-redesign.md)', () => {
    test('eight metros, twelve large cities, twelve smaller cities and towns', () => {
      expect(LOCATIONS.map((tier) => tier.examples.length)).toEqual([8, 12, 12]);
    });

    test('every city named has a point on the map, and the map has no stray points', () => {
      const named = LOCATIONS.flatMap((tier) => tier.examples).sort();
      expect(Object.keys(CITY_POINTS).sort()).toEqual(named);
    });

    test('every point is inside the drawing', () => {
      const [, , width, height] = MAP_VIEWBOX.split(' ').map(Number);
      for (const [name, [x, y]] of Object.entries(CITY_POINTS)) {
        expect(x > 0 && x < width && y > 0 && y < height, name).toBe(true);
      }
    });

    test('no two cities sit on top of each other', () => {
      const points = Object.entries(CITY_POINTS);
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const [a, [ax, ay]] = points[i];
          const [b, [bx, by]] = points[j];
          expect(Math.hypot(ax - bx, ay - by), `${a} and ${b}`).toBeGreaterThanOrEqual(8);
        }
      }
    });
  });
  ```

  Remove the `.toBeGreaterThanOrEqual(4)` line from *each tier names real
  places*: the new test says more.

- [ ] **Step 3: Watch them fail:** `npx vitest run tests/locations.test.js`.

- [ ] **Step 4: Write `design/build-city-points.mjs`:**

  ```js
  /**
   * The map's named cities, placed from the geonames-derived dataset
   * (github.com/lutangar/cities.json), through the projection INDIA_PATH was
   * drawn with (ui/india-map.js). Run from the scratchpad folder holding
   * cities.json:
   *
   *   node <repo>/design/build-city-points.mjs cities.json
   *
   * It prints CITY_POINTS to paste into ui/india-map.js, and each city's shift
   * from the point it had, for the owner to see. A name the dataset spells
   * differently goes in ALIASES; a name it holds twice in India stops the run.
   */
  import { readFileSync } from 'node:fs';
  import { LOCATIONS } from '../content/locations.js';
  import { CITY_POINTS } from '../ui/india-map.js';

  // The projection INDIA_PATH uses, checked: Mumbai (19.08 N, 72.88 E) lands on
  // the [82, 285.6] the map already had for it.
  const SCALE = 14.440516664936647;
  const X = (lon) => +((lon - 68.17202758800005) * SCALE + 14).toFixed(1);
  const Y = (lat) => +((37.095811 - lat) * SCALE + 25.452819565539272).toFixed(1);

  // Where the game's name is not the dataset's. Check each against the file.
  const ALIASES = { 'Delhi NCR': 'New Delhi', Mysuru: 'Mysore', Hubballi: 'Hubli', Bengaluru: 'Bengaluru' };

  const all = JSON.parse(readFileSync(process.argv[2], 'utf8')).filter((c) => c.country === 'IN');
  const out = {};
  const problems = [];
  for (const name of LOCATIONS.flatMap((tier) => tier.examples)) {
    const wanted = ALIASES[name] ?? name;
    const found = all.filter((c) => c.name === wanted);
    if (found.length !== 1) { problems.push(`${name}: ${found.length} matches for "${wanted}"`); continue; }
    out[name] = [X(Number(found[0].lng)), Y(Number(found[0].lat))];
    const was = CITY_POINTS[name];
    if (was) console.error(`${name}: moved ${Math.hypot(out[name][0] - was[0], out[name][1] - was[1]).toFixed(1)} units`);
  }
  if (problems.length > 0) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log(`export const CITY_POINTS = Object.freeze(${JSON.stringify(out)});`);
  ```

  Where a name has two matches in India, add the dataset's `admin1` code or its
  coordinates to disambiguate in ALIASES as an object, and say which in a
  comment. The `Bengaluru` entry is there to be checked: if the dataset spells
  it `Bangalore`, change it.

- [ ] **Step 5: The words.** In `content/locations.js`:

  ```js
    examples: ['Mumbai', 'Delhi NCR', 'Bengaluru', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata', 'Ahmedabad'],
  ```

  ```js
    examples: ['Jaipur', 'Lucknow', 'Kochi', 'Indore', 'Chandigarh', 'Coimbatore',
      'Nagpur', 'Visakhapatnam', 'Bhopal', 'Patna', 'Bhubaneswar', 'Vadodara'],
  ```

  ```js
    examples: ['Guwahati', 'Raipur', 'Jodhpur', 'Salem', 'Warangal', 'Siliguri',
      'Dehradun', 'Udaipur', 'Mysuru', 'Gorakhpur', 'Jammu', 'Hubballi'],
  ```

  Add to the file's *WHY REAL CITIES ARE NAMED* paragraph: "Eight metros, because
  a longer list would be calling large cities metros; the line between a large
  city and a town is fuzzy in any list, and these follow the grouping the first
  eighteen used." (No source is quoted in the file, so it makes no claim that
  needs one.)

- [ ] **Step 6: The points.** Run the script against the downloaded file, paste
  its output over `CITY_POINTS` in `ui/india-map.js`, and change the header's
  "carries the eighteen" to "carries the thirty-two" and "The eighteen the
  simulator models" to "The thirty-two cities round 0 names". Add to the header:
  "All thirty-two come from the dataset, through design/build-city-points.mjs.
  The first eighteen were typed by hand once (design/build-cities.mjs, SIM) and
  were re-derived here." Show the owner the "moved" lines the script printed for
  the eighteen.

- [ ] **Step 7:** `npm test`. Open a classic round 0 on the dev server: its map
  and its list now show thirty-two cities; check the labels do not collide when a
  place is lit. Add to DECISIONS G4 one line: "Round 0 names 32 cities (8 / 12 /
  12) since 2026-09-14, placed from the geonames-derived dataset; display
  geography only, nothing in engine/ reads them." Commit: *Name thirty-two cities
  on the map, placed from the geonames dataset*.

  *Found when built:* five pairs of names collided when their kind was lit, two
  of them already in the first eighteen (Mumbai over Pune, Bengaluru over
  Chennai). `LABEL_SIDE` and `labelPlace` in `ui/india-map.js` move seven names
  off the right-hand side; the test checks both maps' type, and Task 8 uses the
  same function.

---

### Task 7: the kit: controls, the keyword card, the planner drawer, the ad block

Build order C: round 0 builds the pieces the weekly *Your keywords* will reuse.
The shapes and class names are the makeover plan's (its Tasks 7 and 8), so
that section later extends this card rather than drawing its own; Task 16
amends the makeover plan to say so.

**Files:** create `ui/kit/controls.js`, `ui/kit/card.js`, `ui/kit/planner.js`,
`ui/kit/serp.js`, `ui/words/keywords.js`, `tests/kit.test.js`; modify
`ui/shell/shell.js`, `ui/studio.css`, `tests/words.test.js`, `tests/ui.test.js`.

**Interfaces produced:**
- `controls.js`: `icon(paths)`, `button(className, ...children)`,
  `pills({options, value, label, onPick, keyPrefix})`,
  `toggle({on, labelOn, labelOff, titleOn, titleOff, onToggle})`,
  `stat(value, label)`, `slider({minRupees, maxRupees, valueRupees, wasRupees, label, onInput}) → {node, range, showWas}`,
  `typeIn({text, value, label, onCommit})`.
- `card.js`: `SLIDER_FLOOR_PAISE = 10000`, `SLIDER_HEADROOM = 1.5`,
  `SLIDER_STEP_PAISE = 1000`, `sliderMaxPaise(keywords) → paise`,
  `keywordCard({card, maxRupees, openGuide, onMatch, onBid, onRemove}) → {node, show(card)}`.
- `planner.js`: `PLANNER_ROWS = 40`,
  `plannerRows({queries, weeklyVolume, term, held, limit}) → {rows: {text, intent, weekly, held}[], addable: string[], own: string|null}`,
  `openPlanner({trigger, queries, weeklyVolume, state, held, reach, tag, onAdd, onAddAll}) → {close}`.
- `serp.js`: `serp({domain, name, headlines, descriptions, sponsored, emptyHead, emptyDesc})`.
- `KEYWORDS` words (below).

- [ ] **Step 1: Write the failing tests,** `tests/kit.test.js`:

  ```js
  /**
   * The kit's pure parts (plans/2026-09-14-round-zero-redesign.md, section 8).
   * The drawing is checked by playing it; what can be decided without a page is
   * decided here.
   */
  import { describe, test, expect } from 'vitest';
  import { sliderMaxPaise, SLIDER_FLOOR_PAISE } from '../ui/kit/card.js';
  import { plannerRows, PLANNER_ROWS } from '../ui/kit/planner.js';
  import { QUERY_SET } from '../content/querySet.js';

  describe('the slider\'s range, fixed while the page is up', () => {
    test('never shorter than the floor', () => {
      expect(sliderMaxPaise([])).toBe(SLIDER_FLOOR_PAISE);
      expect(sliderMaxPaise([{ bidPaise: 3300 }, { bidPaise: 5700 }])).toBe(SLIDER_FLOOR_PAISE);
    });

    test('half again the highest bid, up to the next ten rupees', () => {
      expect(sliderMaxPaise([{ bidPaise: 9000 }])).toBe(14000);
      expect(sliderMaxPaise([{ bidPaise: 9001 }])).toBe(14000);
      expect(sliderMaxPaise([{ bidPaise: 10000 }])).toBe(15000);
    });
  });

  describe('the planner\'s rows', () => {
    const rows = (over = {}) => plannerRows({ queries: QUERY_SET.queries, weeklyVolume: QUERY_SET.weeklyVolume, ...over });

    test('biggest first, as Keyword Planner gives them, and no more than a screenful', () => {
      const { rows: list } = rows();
      expect(list).toHaveLength(PLANNER_ROWS);
      for (let i = 1; i < list.length; i++) expect(list[i - 1].weekly).toBeGreaterThanOrEqual(list[i].weekly);
    });

    test('what is typed filters, and the biggest matches come first', () => {
      const { rows: list } = rows({ term: 'leggings' });
      expect(list.length).toBeGreaterThan(0);
      expect(list.every((r) => r.text.includes('leggings'))).toBe(true);
    });

    test('a search already held is marked, and left out of "add all"', () => {
      const first = rows().rows[0].text;
      const out = rows({ held: new Set([first]) });
      expect(out.rows[0]).toMatchObject({ text: first, held: true });
      expect(out.addable).not.toContain(first);
    });

    test('your own words are offered only when the planner does not hold them', () => {
      expect(rows({ term: 'zzqx plumbing' }).own).toBe('zzqx plumbing');
      expect(rows({ term: QUERY_SET.queries[0].text }).own).toBeNull();
      expect(rows({ term: 'zzqx plumbing', held: new Set(['zzqx plumbing']) }).own).toBeNull();
    });

    test('Keyword Planner\'s columns, and nothing else', () => {
      expect(Object.keys(rows().rows[0]).sort()).toEqual(['held', 'intent', 'text', 'weekly']);
    });
  });
  ```

  In `tests/words.test.js`, import `KEYWORDS` from `../ui/words/keywords.js` and
  add:

  ```js
  describe('the keyword card and the planner', () => {
    const FIGURES = {
      value: 7, list: 'leggings · gym', bid: '₹30', keyword: 'gym leggings', cpc: '₹12',
      impressions: '100', need: '₹16', n: 12, text: 'squat proof leggings',
    };

    test('every entry is a line of a kind the screen may carry', () => {
      for (const [name, entry] of Object.entries(KEYWORDS)) expect(KINDS, name).toContain(entry.kind);
    });

    test('every why names a chapter that exists', () => {
      for (const [name, entry] of Object.entries(KEYWORDS)) {
        if (entry.why) expect(Object.keys(CHAPTERS), name).toContain(entry.why);
      }
    });

    test('every entry renders without a hole in it', () => {
      for (const [name, entry] of Object.entries(KEYWORDS)) {
        expect(entry(FIGURES), name).not.toMatch(/undefined|NaN|\[object/);
      }
    });
  });
  ```

  and extend the drawing guard's list (makeover Task 5 created it as
  `const drawing = ['ui/shell/shell.js'];`) to
  `['ui/shell/shell.js', 'ui/kit/controls.js', 'ui/kit/card.js', 'ui/kit/planner.js', 'ui/kit/serp.js']`.

- [ ] **Step 2: Watch them fail:** `npx vitest run tests/kit.test.js tests/words.test.js`.

- [ ] **Step 3: The words,** `ui/words/keywords.js`. The texts are the makeover
  plan's (its Task 7), so the weekly section adds its own lines to this file
  later; three are new for round 0 (`newTag`, `underReserve`, and `isNew`
  reworded so it reads true before week 1 as well as after):

  ```js
  /**
   * The keyword card's and the planner's words (plans/2026-09-13-studio-makeover.md,
   * section 4). Round 0 draws the card before any week has run; the weekly
   * Your keywords section adds its own lines here (the makeover plan, Task 7).
   */

  import { line } from './line.js';

  export const KEYWORDS = Object.freeze({
    match: line('label', 'Match type'),
    exact: line('label', 'Exact'),
    phrase: line('label', 'Phrase'),
    broad: line('label', 'Broad'),
    tags: line('reading', ({ list }) => `tags: ${list}`, { why: 'broadMatch' }),
    noTags: line('reading', 'no tags: broad finds nothing', { why: 'broadMatch' }),
    bid: line('label', 'Bid'),
    typeBid: line('instruction', ({ keyword }) => `Type an exact bid for ${keyword}`),
    sliderLabel: line('label', ({ keyword }) => `Bid for ${keyword}, in rupees`),
    underReserve: line('reading', ({ need }) => `under the reserve: it needs ${need} to show at all`,
      { why: 'rankOrBudget' }),
    paid: line('reading', ({ cpc }) => `paid ${cpc} a click on average`),
    noClicks: line('reading', 'no clicks yet'),
    isNew: line('reading', 'new: no clicks yet'),
    newTag: line('label', 'new'),
    clicks: line('label', 'clicks'),
    cost: line('label', 'cost'),
    conv: line('label', 'conv.'),
    qs: line('label', ({ value }) => `QS ${value}`),
    qsTitle: line('label', ({ value }) => `Quality Score ${value}`),
    qsNote: line('reading', 'Each part is compared with everyone who showed on the same searches.',
      { why: 'qualityScore' }),
    qsNone: line('reading', ({ impressions }) => `No score yet: it needs ${impressions} impressions on its own search first.`,
      { why: 'qualityScore' }),
    above: line('label', 'above average'),
    average: line('label', 'average'),
    below: line('label', 'below average'),
    back: line('instruction', 'Back to the keyword'),
    more: line('label', 'More'),
    remove: line('instruction', 'Remove keyword'),
    cancel: line('instruction', 'Cancel'),
    addTitle: line('instruction', 'Add a keyword'),
    addHow: line('instruction', 'from the planner, or your own words'),
    plannerTitle: line('label', 'Add keywords'),
    plannerSearch: line('instruction', 'search the planner, or type your own'),
    plannerBid: line('label', 'Bid ₹'),
    plannerWeek: line('label', 'A week'),
    plannerReach: line('label', 'Reach'),
    plannerAdd: line('instruction', 'Add'),
    plannerAddAll: line('instruction', ({ n }) => `Add all ${n} shown`),
    plannerHeld: line('label', 'in account'),
    plannerOwn: line('instruction', ({ text }) => `Add “${text}” as your own`),
    plannerNote: line('reading', 'How often a search is made is public research. What it is worth to you is learned by running it.'),
    close: line('label', 'Close'),
  });
  ```

- [ ] **Step 4: The controls,** `ui/kit/controls.js`. `icon` and `button` move here
  from `ui/shell/shell.js`; the rest is the makeover plan's Task 8 kit:

  ```js
  /**
   * The Studio kit's controls (plans/2026-09-13-studio-makeover.md, section 3).
   * Plain elements, each with its words handed in, so a control never holds a
   * sentence. A control that changes itself (the switch, the slider) does so in
   * place: redrawn under a finger, a drag would end.
   */

  import { el } from '../dom.js';
  import { ICON_BOX } from '../shell/sections.js';

  const SVG = 'http://www.w3.org/2000/svg';

  /** A stroked icon from a list of paths (ui/shell/sections.js, ICONS). */
  export function icon(paths) {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', ICON_BOX);
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('studio-icon');
    for (const d of paths) {
      const path = document.createElementNS(SVG, 'path');
      path.setAttribute('d', d);
      svg.append(path);
    }
    return svg;
  }

  /** A button that is never a form's submit. */
  export function button(className, ...children) {
    const node = el('button', className);
    node.type = 'button';
    node.append(...children);
    return node;
  }

  /** One choice from a few, as radio buttons. */
  export function pills({ options, value, label, onPick, keyPrefix = null }) {
    const group = el('div', 'kpills');
    group.setAttribute('role', 'radiogroup');
    if (label) group.setAttribute('aria-label', label);
    for (const [optionValue, text] of options) {
      const pill = el('button', 'kpill', text);
      pill.type = 'button';
      pill.setAttribute('role', 'radio');
      pill.setAttribute('aria-checked', String(optionValue === value));
      if (keyPrefix) pill.dataset.key = `${keyPrefix}:${optionValue}`;
      pill.addEventListener('click', () => { if (optionValue !== value) onPick(optionValue); });
      group.append(pill);
    }
    return group;
  }

  /** An on/off switch with its state written beside it; it flips in place. */
  export function toggle({ on, labelOn, labelOff, titleOn, titleOff, onToggle }) {
    const node = el('button', 'ktoggle');
    node.type = 'button';
    node.setAttribute('role', 'switch');
    const track = el('span', 'ktoggle-track');
    track.append(el('span', 'ktoggle-knob'));
    const label = el('span', 'ktoggle-label');
    node.append(track, label);
    let state = on;
    const show = () => {
      node.setAttribute('aria-checked', String(state));
      label.textContent = state ? labelOn : labelOff;
      node.title = state ? titleOn : titleOff;
    };
    show();
    node.addEventListener('click', () => { state = !state; show(); onToggle(state); });
    return node;
  }

  /** A number over its label. */
  export function stat(value, label) {
    const box = el('div', 'kstat');
    box.append(el('div', 'kstat-value', value), el('div', 'kstat-label', label));
    return box;
  }

  /**
   * A slider in whole rupees, with the week's starting value marked. `onInput`
   * fires while dragging; the caller updates figures in place.
   */
  export function slider({ minRupees, maxRupees, valueRupees, wasRupees = null, label, onInput }) {
    const box = el('div', 'kslider');
    const range = el('input');
    range.type = 'range';
    range.min = String(minRupees);
    range.max = String(maxRupees);
    range.step = '1';
    range.value = String(valueRupees);
    range.setAttribute('aria-label', label);
    const was = el('span', 'kslider-was');
    const showWas = (value) => {
      was.hidden = value === null;
      if (value !== null) was.style.left = `${(100 * (value - minRupees)) / (maxRupees - minRupees)}%`;
    };
    showWas(wasRupees);
    range.addEventListener('input', () => onInput(Number(range.value)));
    box.append(range, was);
    return { node: box, range, showWas };
  }

  /** A figure that becomes a box to type in when tapped: a slider alone is too coarse for a bid. */
  export function typeIn({ text, value, label, onCommit }) {
    const shown = el('button', 'kbid', text);
    shown.type = 'button';
    shown.title = label;
    shown.addEventListener('click', () => {
      const box = el('input', 'kfield kbid-input');
      box.type = 'number';
      box.min = '1';
      box.step = '1';
      box.value = String(value);
      box.setAttribute('aria-label', label);
      let done = false;
      const finish = (commit) => {
        if (done) return;
        done = true;
        const typed = Math.round(Number(box.value));
        box.replaceWith(shown);
        if (commit && Number.isFinite(typed) && typed >= 1) onCommit(typed);
        else shown.focus();
      };
      box.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') finish(true);
        if (event.key === 'Escape') finish(false);
      });
      box.addEventListener('blur', () => finish(true));
      shown.replaceWith(box);
      box.focus();
      box.select();
    });
    return shown;
  }
  ```

  In `ui/shell/shell.js`, delete its own `icon`, `button` and `SVG`, and import
  `{ icon, button }` from `../kit/controls.js` (and drop `ICON_BOX` from its
  `sections.js` import if nothing else there uses it).

- [ ] **Step 5: The card,** `ui/kit/card.js`:

  ```js
  /**
   * The keyword card (plans/2026-09-13-studio-makeover.md, section 4). One card
   * for the whole game: round 0 draws it before any week has run, with its
   * weekly places present and empty; the weekly Your keywords section fills
   * the same places with the week's figures.
   *
   * A DRAG IS NEVER REDRAWN UNDER THE FINGER. While the slider moves, the caller
   * hands the new model to `show`, which changes the figure and the warning in
   * place; anything else (a match type, a typed bid) the caller redraws.
   */

  import { el, add, rupees, whole } from '../dom.js';
  import { whyButton } from '../guide/drawer.js';
  import { QUALITY_MIN_IMPRESSIONS } from '../../engine/constants.js';
  import { KEYWORDS } from '../words/keywords.js';
  import { FORM } from '../words/form.js';
  import { pills, stat, slider, typeIn } from './controls.js';

  /** The slider never ends below ₹100; past that, half again the highest bid (I6's display bounds). */
  export const SLIDER_FLOOR_PAISE = 10000;
  export const SLIDER_HEADROOM = 1.5;
  export const SLIDER_STEP_PAISE = 1000;

  /** @returns {number} paise: the slider's right end for these keywords */
  export function sliderMaxPaise(keywords) {
    const top = Math.max(0, ...keywords.map((k) => k.bidPaise));
    const wanted = Math.ceil((top * SLIDER_HEADROOM) / SLIDER_STEP_PAISE) * SLIDER_STEP_PAISE;
    return Math.max(SLIDER_FLOOR_PAISE, wanted);
  }

  const MATCHES = ['exact', 'phrase', 'broad'];
  const MATCH_WORD = { exact: KEYWORDS.exact, phrase: KEYWORDS.phrase, broad: KEYWORDS.broad };
  const RATING_WORD = { above: KEYWORDS.above, average: KEYWORDS.average, below: KEYWORDS.below };

  /**
   * @param {object} args
   * @param {object} args.card - the model: `setupKeywordCards` (round 0) or the
   *   weekly `keywordCards`
   * @param {number} args.maxRupees - the slider's right end
   * @param {Function|null} [args.openGuide]
   * @param {(matchType: string) => void} args.onMatch
   * @param {(rupees: number, settled: boolean) => void} args.onBid - `settled` is
   *   false while the slider moves
   * @param {() => void} args.onRemove
   * @returns {{node: HTMLElement, show: (card: object) => void}}
   */
  export function keywordCard({ card, maxRupees, openGuide = null, onMatch, onBid, onRemove }) {
    let model = card;
    let view = 'body';
    const node = el('article', 'kcard');
    node.dataset.id = card.id;

    const left = el('div', 'kcard-left');
    if (card.isNew) left.append(el('span', 'knew', KEYWORDS.newTag()));
    const qs = el('button', 'kqs', KEYWORDS.qs({ value: card.quality.value ?? '—' }));
    qs.type = 'button';
    qs.dataset.key = `${card.id}:qs`;
    const more = el('button', 'kmore', '⋯');
    more.type = 'button';
    more.dataset.key = `${card.id}:more`;
    more.setAttribute('aria-label', KEYWORDS.more());
    const right = el('div', 'kcard-right');
    right.append(qs, more);
    const top = el('div', 'kcard-top');
    top.append(left, right);
    const menuHost = el('div');
    const inner = el('div', 'kcard-inner');
    node.append(top, menuHost, el('h3', 'kcard-name', card.text), inner);

    // The two things a drag changes, kept so `show` can reach them.
    let figure = null;
    const warning = el('p', 'kwarn');
    const warningText = el('span');
    warning.append(warningText);
    add(warning, whyButton(KEYWORDS.underReserve, openGuide));

    function showWarning() {
      warning.hidden = model.needPaise == null;
      warningText.textContent = model.needPaise == null ? '' : KEYWORDS.underReserve({ need: rupees(model.needPaise) });
    }

    function paidLine() {
      if (model.isNew) return KEYWORDS.isNew();
      if (model.stats?.cpcPaise != null) return KEYWORDS.paid({ cpc: rupees(model.stats.cpcPaise) });
      return KEYWORDS.noClicks();
    }

    function body() {
      const box = el('div', 'kcard-body');
      const match = pills({
        options: MATCHES.map((m) => [m, MATCH_WORD[m]()]),
        value: model.matchType,
        label: KEYWORDS.match(),
        keyPrefix: `${model.id}:match`,
        onPick: onMatch,
      });
      const reach = el('p', 'kreach', FORM.reach({ count: model.reach }));
      let tagsText = '';
      if (model.tags) tagsText = model.noTagsOnBroad ? KEYWORDS.noTags() : KEYWORDS.tags({ list: model.tags.join(' · ') });
      const tags = el('p', model.noTagsOnBroad ? 'ktags warn' : 'ktags', tagsText);
      tags.title = tagsText;

      figure = typeIn({
        text: rupees(model.bidPaise),
        value: Math.round(model.bidPaise / 100),
        label: KEYWORDS.typeBid({ keyword: model.text }),
        onCommit: (value) => onBid(value, true),
      });
      figure.dataset.key = `${model.id}:bid`;
      const bidRow = el('div', 'kbid-row');
      bidRow.append(el('span', 'klabel', KEYWORDS.bid()), figure);

      const bar = slider({
        minRupees: 1,
        maxRupees,
        valueRupees: Math.min(maxRupees, Math.round(model.bidPaise / 100)),
        label: KEYWORDS.sliderLabel({ keyword: model.text }),
        onInput: (value) => onBid(value, false),
      });
      bar.range.dataset.key = `${model.id}:slider`;
      showWarning();

      const figures = el('div', 'kstats');
      const s = model.stats;
      figures.append(
        stat(s ? whole(s.clicks) : '—', KEYWORDS.clicks()),
        stat(s ? rupees(s.costPaise) : '—', KEYWORDS.cost()),
        stat(s ? (s.conversions > 0 ? s.conversions.toFixed(1) : '0') : '—', KEYWORDS.conv()),
      );
      box.append(match, reach, tags, bidRow, bar.node, warning, el('p', 'kpaid', paidLine()), figures);
      return box;
    }

    function qualityPanel() {
      const box = el('div', 'kqs-panel');
      box.append(el('p', 'kqs-title', KEYWORDS.qsTitle({ value: model.quality.value ?? '—' })));
      if (model.quality.value === null) {
        const none = el('p', 'kqs-note', KEYWORDS.qsNone({ impressions: whole(QUALITY_MIN_IMPRESSIONS) }));
        add(none, whyButton(KEYWORDS.qsNone, openGuide));
        box.append(none);
      } else {
        const parts = el('dl', 'kqs-parts');
        for (const part of model.quality.ratings) {
          parts.append(el('dt', null, part.label), el('dd', `rating-${part.rating}`, RATING_WORD[part.rating]()));
        }
        const note = el('p', 'kqs-note', KEYWORDS.qsNote());
        add(note, whyButton(KEYWORDS.qsNote, openGuide));
        box.append(parts, note);
      }
      const back = el('button', 'kback', KEYWORDS.back());
      back.type = 'button';
      back.dataset.key = `${model.id}:qs`;
      back.addEventListener('click', () => { view = 'body'; draw(); });
      box.append(back);
      return box;
    }

    function menu() {
      const box = el('div', 'kmenu');
      box.setAttribute('role', 'menu');
      const remove = el('button', 'kmenu-danger', KEYWORDS.remove());
      remove.type = 'button';
      remove.setAttribute('role', 'menuitem');
      remove.addEventListener('click', onRemove);
      const cancel = el('button', null, KEYWORDS.cancel());
      cancel.type = 'button';
      cancel.setAttribute('role', 'menuitem');
      cancel.addEventListener('click', () => { view = 'body'; draw(); });
      box.append(remove, cancel);
      queueMicrotask(() => remove.focus());
      return box;
    }

    function draw() {
      qs.setAttribute('aria-expanded', String(view === 'qs'));
      more.setAttribute('aria-expanded', String(view === 'menu'));
      menuHost.replaceChildren(...(view === 'menu' ? [menu()] : []));
      inner.replaceChildren(view === 'qs' ? qualityPanel() : body());
    }

    qs.addEventListener('click', () => { view = view === 'qs' ? 'body' : 'qs'; draw(); });
    more.addEventListener('click', () => { view = view === 'menu' ? 'body' : 'menu'; draw(); });
    draw();

    /** Mid-drag: the new bid and its warning, in place. */
    function show(next) {
      model = next;
      if (figure) figure.textContent = rupees(next.bidPaise);
      showWarning();
    }

    return { node, show };
  }
  ```

- [ ] **Step 6: The planner,** `ui/kit/planner.js`:

  ```js
  /**
   * The planner drawer (plans/2026-09-13-studio-makeover.md, section 4):
   * Keyword Planner's research, text, weekly volume and intent, plus the
   * engine's count of how far each would reach on the match chosen (E8). Nothing
   * a search does after the click is shown (16.1, C4).
   */

  import { el, whole } from '../dom.js';
  import { KEYWORDS } from '../words/keywords.js';
  import { pills } from './controls.js';

  export const PLANNER_ROWS = 40;
  /** The drawer leaves faster than it came (the makeover spec, section 3, motion row 6). */
  const DRAWER_EXIT_MS = 150;
  const MATCHES = ['exact', 'phrase', 'broad'];
  const normal = (text) => String(text).trim().toLowerCase().replace(/\s+/g, ' ');

  /**
   * The rows for what is typed: biggest first, a screenful at most, each marked
   * if the account holds it. `own` is the typed text, when the planner has no
   * such search and the account does not hold it.
   *
   * @returns {{rows: Array<{text: string, intent: string, weekly: number, held: boolean}>,
   *   addable: string[], own: string|null}}
   */
  export function plannerRows({ queries, weeklyVolume, term = '', held = new Set(), limit = PLANNER_ROWS }) {
    const typed = normal(term);
    const weekly = (q) => Math.round((weeklyVolume * q.volumeShareBp) / 10000);
    const rows = queries
      .filter((q) => !typed || q.text.includes(typed))
      .map((q) => ({ text: q.text, intent: q.intent, weekly: weekly(q), held: held.has(normal(q.text)) }))
      .sort((a, b) => b.weekly - a.weekly)
      .slice(0, limit);
    const own = typed && !queries.some((q) => normal(q.text) === typed) && !held.has(typed) ? typed : null;
    return { rows, addable: rows.filter((r) => !r.held).map((r) => r.text), own };
  }

  /**
   * @param {object} args
   * @param {HTMLElement} args.trigger - focus returns here when the drawer closes
   * @param {object[]} args.queries
   * @param {number} args.weeklyVolume
   * @param {{term: string, matchType: string, bidPaise: number}} args.state - kept
   *   by the caller, so reopening keeps what was typed
   * @param {() => Set<string>} args.held - the account's keywords, normalised
   * @param {(keyword: object) => number} args.reach - the engine's count
   * @param {(keyword: {text: string}) => {tags: string[]}} args.tag
   * @param {(text: string, spec: object) => boolean} args.onAdd
   * @param {(texts: string[], spec: object) => void} args.onAddAll
   */
  export function openPlanner({ trigger, queries, weeklyVolume, state, held, reach, tag, onAdd, onAddAll }) {
    const overlay = el('div', 'kplanner-overlay');
    const drawer = el('aside', 'kplanner');
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-label', KEYWORDS.plannerTitle());
    let closing = false;
    const close = () => {
      if (closing) return;
      closing = true;
      overlay.classList.add('closing');
      drawer.classList.add('closing');
      setTimeout(() => { overlay.remove(); drawer.remove(); trigger?.focus?.(); }, DRAWER_EXIT_MS);
    };
    overlay.addEventListener('click', close);
    drawer.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });

    const shut = el('button', 'kplanner-close', '×');
    shut.type = 'button';
    shut.setAttribute('aria-label', KEYWORDS.close());
    shut.addEventListener('click', close);
    const head = el('div', 'kplanner-head');
    head.append(el('h3', null, KEYWORDS.plannerTitle()), shut);

    const search = el('input', 'kfield');
    search.type = 'search';
    search.value = state.term;
    search.placeholder = KEYWORDS.plannerSearch();
    search.setAttribute('aria-label', KEYWORDS.plannerSearch());
    const bid = el('input', 'kfield knum');
    bid.type = 'number';
    bid.min = '1';
    bid.step = '1';
    bid.value = String(Math.round(state.bidPaise / 100));
    bid.addEventListener('input', () => {
      const n = Math.round(Number(bid.value));
      if (n >= 1) state.bidPaise = n * 100;
    });
    const bidLabel = el('label', 'kplanner-bid');
    bidLabel.append(el('span', null, KEYWORDS.plannerBid()), bid);
    const matchHost = el('div');
    const controls = el('div', 'kplanner-controls');
    controls.append(matchHost, bidLabel);
    const extra = el('div', 'kplanner-extra');
    const cols = el('div', 'kplanner-cols');
    cols.append(el('span'), el('span', null, KEYWORDS.plannerWeek()), el('span', null, KEYWORDS.plannerReach()), el('span'));
    const list = el('div', 'kplanner-list');
    const spec = () => ({ matchType: state.matchType, bidPaise: state.bidPaise });

    function fill() {
      state.term = search.value;
      matchHost.replaceChildren(pills({
        options: MATCHES.map((m) => [m, KEYWORDS[m]()]),
        value: state.matchType,
        label: KEYWORDS.match(),
        onPick: (m) => { state.matchType = m; fill(); },
      }));
      const { rows, addable, own } = plannerRows({ queries, weeklyVolume, term: search.value, held: held() });
      extra.replaceChildren();
      if (own) {
        const mine = el('button', 'kplanner-mine press', KEYWORDS.plannerOwn({ text: own }));
        mine.type = 'button';
        mine.addEventListener('click', () => { if (onAdd(own, spec())) { search.value = ''; fill(); } });
        extra.append(mine);
      }
      if (addable.length > 1) {
        const every = el('button', 'kplanner-all', KEYWORDS.plannerAddAll({ n: addable.length }));
        every.type = 'button';
        every.addEventListener('click', () => { onAddAll(addable, spec()); fill(); });
        extra.append(every);
      }
      list.replaceChildren(...rows.map((row) => {
        const name = el('div', 'kplanner-name');
        name.append(el('strong', null, row.text), el('span', null, row.intent));
        const count = reach({ text: row.text, matchType: state.matchType, tags: tag({ text: row.text }).tags });
        const pick = el('button', row.held ? 'kplanner-held' : 'kplanner-add press',
          row.held ? KEYWORDS.plannerHeld() : KEYWORDS.plannerAdd());
        pick.type = 'button';
        pick.disabled = row.held;
        pick.addEventListener('click', () => { if (onAdd(row.text, spec())) fill(); });
        const line = el('div', 'kplanner-row');
        line.append(name, el('span', 'knum', whole(row.weekly)), el('span', 'knum', whole(count)), pick);
        return line;
      }));
    }

    search.addEventListener('input', fill);
    drawer.append(head, search, controls, extra, cols, list, el('p', 'kplanner-note', KEYWORDS.plannerNote()));
    fill();
    document.body.append(overlay, drawer);
    search.focus();
    return { close };
  }
  ```

- [ ] **Step 7: The ad block,** `ui/kit/serp.js`, for the rival ads in step 2 and
  the player's own in step 4 (the classic page keeps `serpBlock`):

  ```js
  /**
   * One ad as a searcher meets it: who runs it, the headlines, the descriptions.
   * The same block for a rival's ad and the player's own, because round 0 makes
   * the rivals' copy the only evidence of where they sit (17.1). Words are
   * handed in; the block holds none. Headlines are bone, never red: red is you.
   */

  import { el } from '../dom.js';

  export function serp({ domain, name = null, headlines, descriptions, sponsored, emptyHead = '', emptyDesc = '' }) {
    const node = el('article', 'kserp');
    const tag = el('p', 'kserp-tag');
    tag.append(el('span', null, sponsored), el('span', 'kserp-sep', '·'), el('span', null, domain));
    if (name) tag.append(el('span', 'kserp-name', name));
    const head = el('p', headlines.length > 0 ? 'kserp-head' : 'kserp-head empty',
      headlines.length > 0 ? headlines.join(' · ') : emptyHead);
    const desc = el('p', descriptions.length > 0 ? 'kserp-desc' : 'kserp-desc empty',
      descriptions.length > 0 ? descriptions.join(' ') : emptyDesc);
    node.append(tag, head, desc);
    return node;
  }
  ```

- [ ] **Step 8: The kit's styles,** appended to `ui/studio.css`. They are the
  makeover plan's Task 8 values for the card and the planner, moved here, plus
  `knew`, `kwarn` and the ad block:

  ```css
  /* --- the kit: pills, the card, the planner, the ad block ------------------ */
  body.studio .kpills { display: flex; gap: 4px; }
  body.studio .kpill { padding: 4px 9px; border: 1px solid var(--studio-line-strong); border-radius: 999px; background: none; color: var(--studio-muted); font-size: 12px; font-weight: 600; white-space: nowrap; }
  body.studio .kpill[aria-checked="true"] { border-color: var(--studio-red); background: var(--studio-red); color: var(--studio-on-red); }

  body.studio .kgrid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
  body.studio .kcard { position: relative; display: flex; flex-direction: column; gap: 10px; min-width: 0; padding: 14px 16px 16px; border: 1px solid var(--studio-line); border-radius: 20px; background: var(--studio-card); }
  body.studio .kcard-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; height: 26px; }
  body.studio .kcard-left, body.studio .kcard-right { display: flex; align-items: center; gap: 6px; }
  body.studio .knew { padding: 2px 8px; border: 1px solid var(--studio-line-strong); border-radius: 999px; font-size: 11px; font-weight: 700; color: var(--studio-muted); }
  body.studio .kcard-name { display: -webkit-box; height: 44px; margin: 0; overflow: hidden; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow-wrap: anywhere; font: 700 19px/1.15 var(--studio-display); }
  body.studio .kcard-inner { display: flex; flex: 1; flex-direction: column; }
  body.studio .kcard-body, body.studio .kqs-panel { display: flex; flex: 1; flex-direction: column; gap: 6px; min-width: 0; }
  body.studio .kreach, body.studio .ktags, body.studio .kpaid { height: 16px; margin: 0; overflow: hidden; font-size: 12px; line-height: 16px; color: var(--studio-muted); text-overflow: ellipsis; white-space: nowrap; }
  body.studio .ktags.warn, body.studio .kwarn { color: var(--studio-amber); }
  body.studio .kwarn { margin: 0; font-size: 12px; line-height: 1.4; }
  body.studio .kbid-row { display: flex; align-items: center; gap: 8px; height: 30px; margin-top: 4px; }
  body.studio .klabel { font-size: 12px; color: var(--studio-muted); }
  body.studio .kbid { margin-left: auto; padding: 0; border: 0; border-bottom: 1px dashed #4A454F; border-radius: 0; background: none; color: var(--studio-text); font: 800 22px/28px var(--studio-display); font-variant-numeric: tabular-nums; }
  body.studio .kbid-input { width: 84px; height: 30px; margin-left: auto; text-align: right; font-weight: 700; }
  body.studio .kslider { position: relative; height: 18px; }
  body.studio .kslider input[type="range"] { width: 100%; margin: 0; accent-color: var(--studio-red); }
  body.studio .kslider-was { position: absolute; top: 3px; width: 12px; height: 12px; margin-left: -6px; border: 2px dashed var(--studio-faint); border-radius: 50%; box-sizing: border-box; pointer-events: none; }
  body.studio .kstats { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.4fr) minmax(0, 0.8fr); gap: 8px; margin-top: auto; padding-top: 10px; border-top: 1px solid #232026; }
  body.studio .kstat-value { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
  body.studio .kstat-label { font-size: 12px; color: var(--studio-muted); }
  body.studio .ktoggle { display: flex; align-items: center; gap: 6px; padding: 0; border: 0; background: none; color: var(--studio-red-text); font-size: 12px; font-weight: 600; }
  body.studio .ktoggle-track { position: relative; flex-shrink: 0; width: 34px; height: 20px; border-radius: 999px; background: var(--studio-red); }
  body.studio .ktoggle-knob { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #F3EEEA; transform: translateX(14px); }
  body.studio .ktoggle[aria-checked="false"] { color: var(--studio-muted); }
  body.studio .ktoggle[aria-checked="false"] .ktoggle-track { background: var(--studio-line-strong); }
  body.studio .ktoggle[aria-checked="false"] .ktoggle-knob { transform: none; }
  body.studio .kqs { padding: 3px 9px; border-radius: 999px; background: var(--studio-raised); color: var(--studio-text); font-size: 12px; font-weight: 700; }
  body.studio .kqs[aria-expanded="true"] { background: var(--studio-text); color: var(--studio-page); }
  body.studio .kmore { width: 26px; height: 26px; padding: 0; border-radius: 8px; background: none; color: var(--studio-muted); }
  body.studio .kmenu { position: absolute; top: 44px; right: 12px; z-index: 5; display: flex; flex-direction: column; min-width: 170px; padding: 6px; border: 1px solid var(--studio-line-strong); border-radius: 12px; background: #1F1C22; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5); transform-origin: top right; }
  body.studio .kmenu button { padding: 8px 10px; border-radius: 8px; background: none; color: var(--studio-muted); font-size: 13px; text-align: left; }
  body.studio .kmenu .kmenu-danger { color: var(--studio-amber); font-weight: 600; }
  body.studio .kqs-title { margin: 0; font-size: 13px; font-weight: 700; }
  body.studio .kqs-parts { display: grid; grid-template-columns: 1fr auto; gap: 8px 10px; margin: 0; }
  body.studio .kqs-parts dt { font-size: 13px; color: var(--studio-soft); }
  body.studio .kqs-parts dd { margin: 0; font-size: 12px; font-weight: 700; white-space: nowrap; }
  body.studio .rating-above { color: var(--studio-mint); }
  body.studio .rating-average { color: var(--studio-muted); }
  body.studio .rating-below { color: var(--studio-amber); }
  body.studio .kqs-note { margin: 0; font-size: 12px; line-height: 1.45; color: var(--studio-muted); }
  body.studio .kback { align-self: flex-start; margin-top: auto; padding: 0; background: none; color: var(--studio-text); font-size: 13px; text-decoration: underline; text-underline-offset: 3px; }
  body.studio .kadd { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; min-height: 280px; border: 2px dashed var(--studio-line-strong); border-radius: 20px; background: none; color: var(--studio-muted); }
  body.studio .kadd strong { color: var(--studio-text); font: 700 16px/1.2 var(--studio-display); }
  body.studio .kadd span { font-size: 12px; font-weight: 400; }

  body.studio .kfield { height: 34px; padding: 0 10px; border: 1px solid var(--studio-line-strong); border-radius: 10px; background: #141216; color: var(--studio-text); font: inherit; font-size: 14px; }
  body.studio .knum { font-variant-numeric: tabular-nums; }

  body.studio .kplanner-overlay { position: fixed; inset: 0; z-index: 40; background: rgba(0, 0, 0, 0.55); }
  body.studio .kplanner { position: fixed; top: 0; right: 0; bottom: 0; z-index: 41; display: flex; flex-direction: column; gap: 12px; width: min(480px, 100vw); padding: 24px; box-sizing: border-box; border-left: 1px solid #26232A; background: #141216; box-shadow: -12px 0 32px rgba(0, 0, 0, 0.5); }
  body.studio .kplanner-head { display: flex; align-items: center; justify-content: space-between; }
  body.studio .kplanner-head h3 { margin: 0; font: 800 26px/1 var(--studio-display); }
  body.studio .kplanner-close { width: 34px; height: 34px; padding: 0; border-radius: 10px; background: none; color: var(--studio-text); font-size: 20px; }
  body.studio .kplanner-controls, body.studio .kplanner-extra { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
  body.studio .kplanner-bid { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--studio-muted); }
  body.studio .kplanner-bid input { width: 72px; }
  body.studio .kplanner-mine, body.studio .kplanner-all { padding: 7px 14px; border-radius: 999px; background: var(--studio-red); color: var(--studio-on-red); font-size: 13px; }
  body.studio .kplanner-all { border: 1px solid var(--studio-line-strong); background: none; color: var(--studio-text); }
  body.studio .kplanner-cols, body.studio .kplanner-row { display: grid; grid-template-columns: minmax(0, 1fr) 76px 64px 86px; gap: 10px; align-items: center; }
  body.studio .kplanner-cols { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--studio-faint); }
  body.studio .kplanner-cols span:nth-child(2), body.studio .kplanner-cols span:nth-child(3), body.studio .kplanner-row .knum { text-align: right; font-size: 13px; }
  body.studio .kplanner-list { flex: 1; min-height: 0; overflow-y: auto; }
  body.studio .kplanner-row { padding: 9px 0; border-bottom: 1px solid #211E24; }
  body.studio .kplanner-name { display: flex; flex-direction: column; min-width: 0; }
  body.studio .kplanner-name strong { overflow: hidden; font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
  body.studio .kplanner-name span { font-size: 12px; color: var(--studio-faint); }
  body.studio .kplanner-add, body.studio .kplanner-held { justify-self: end; padding: 5px 12px; border-radius: 999px; font-size: 12px; }
  body.studio .kplanner-add { background: var(--studio-red); color: var(--studio-on-red); }
  body.studio .kplanner-held { border: 1px solid var(--studio-line-strong); background: none; color: var(--studio-faint); }
  body.studio .kplanner-note { margin: 0; font-size: 12px; line-height: 1.45; color: var(--studio-muted); }

  body.studio .kserp { display: flex; flex-direction: column; gap: 4px; min-width: 0; padding: 14px 16px; border: 1px solid var(--studio-line); border-radius: 16px; background: var(--studio-card); }
  body.studio .kserp-tag { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; font-size: 12px; color: var(--studio-faint); }
  body.studio .kserp-name { margin-left: auto; font-weight: 700; color: var(--studio-soft); }
  body.studio .kserp-head { margin: 0; font: 700 16px/1.25 var(--studio-display); color: var(--studio-text); }
  body.studio .kserp-desc { margin: 0; font-size: 13px; line-height: 1.45; color: var(--studio-soft); }
  body.studio .kserp-head.empty, body.studio .kserp-desc.empty { color: var(--studio-faint); font-style: italic; }

  @media (max-width: 1280px) { body.studio .kgrid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 1000px) { body.studio .kgrid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 620px) { body.studio .kgrid { grid-template-columns: minmax(0, 1fr); } }
  ```

- [ ] **Step 9:** add the five new modules (`'kit/controls.js'`, `'kit/card.js'`,
  `'kit/planner.js'`, `'kit/serp.js'`, `'words/keywords.js'`) to `LOADABLE`. Run
  `npm test`. Expected: green. The kit is not on any screen yet: Task 11 is
  where it is played. Play one Studio week (the shell's icons now come from the
  kit) and one classic week. Commit: *Build the Studio kit round 0 and Your
  keywords share: controls, the keyword card, the planner, the ad block*.

  *Found when built:* mounted on the dev page and played, the code above lost
  keyboard focus in three places, each where a redraw removed the control
  being used. After a planner row's Add, focus fell to the page and Escape no
  longer closed the drawer; Cancel in the card's menu and *Back to the keyword*
  dropped it the same way; and a bid typed and entered left nothing focused
  for the frame's data-key restore to find. The built kit keeps focus in the
  drawer (it takes `tabIndex = -1`, and focus that falls out goes to the
  search box), returns it to ⋯ or the QS button, closes the menu on Escape,
  and puts it back on the figure on Enter or Escape but not on a blur.

---

### Task 8: the map, drawn once, pulsing by searches

**Files:** create `ui/map/india.js`, `tests/indiaMap.test.js`; modify
`ui/studio.css`, `tests/ui.test.js`, `tests/words.test.js` (the drawing guard).

**Interfaces produced:**
- `FASTEST_PULSE_S = 1.6`.
- `sharesFor(locations, weeklySearchesByTier, basis) → {[locationId]: share}`,
  `basis` one of `'all'|'value'|'mid'|'premium'`.
- `pulsePeriods(shares, fastest) → {[locationId]: seconds|null}`.
- `drawIndia({ locations, shares, lit, onPick }) → SVGElement`.

*Changed by Task 6:* this task once filtered the background dots near a named
city as it drew them (`clearBackdrop`, `BACKDROP_GAP`). Task 6 removed those
dots from `BACKDROP` itself and `tests/locations.test.js` holds it clear, so
the filter would remove nothing and is gone.

- [ ] **Step 1: Write the failing test,** `tests/indiaMap.test.js`:

  ```js
  /**
   * The map's arithmetic (plans/2026-09-14-round-zero-redesign.md, sections 4 and 7).
   * The pulse is the data: a city rings as often as its kind of place is searched.
   */
  import { describe, test, expect } from 'vitest';
  import { briefing } from '../setup.js';
  import { QUERY_SET } from '../content/querySet.js';
  import { sharesFor, pulsePeriods, FASTEST_PULSE_S } from '../ui/map/india.js';

  const brief = briefing(QUERY_SET);
  const shares = (basis) => sharesFor(brief.locations, brief.weeklySearchesByTier, basis);

  describe('whose searches the map shows', () => {
    test('all of them: each level\'s shares weighted by its searches, 20 / 36 / 44', () => {
      const all = shares('all');
      expect(all.tier1).toBeCloseTo(0.20, 2);
      expect(all.tier2).toBeCloseTo(0.36, 2);
      expect(all.tier3).toBeCloseTo(0.44, 2);
      expect(Object.values(all).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    });

    test('one price level: the briefing\'s own shares, untouched', () => {
      for (const place of brief.locations) expect(shares('premium')[place.id]).toBe(place.shareOfSearches.premium);
    });
  });

  describe('the pulse is the share', () => {
    test('the busiest kind rings fastest, the others in proportion', () => {
      const s = shares('value');
      const periods = pulsePeriods(s);
      const busiest = Object.keys(s).reduce((a, b) => (s[a] >= s[b] ? a : b));
      expect(periods[busiest]).toBeCloseTo(FASTEST_PULSE_S, 10);
      for (const id of Object.keys(s)) expect(periods[id] * s[id]).toBeCloseTo(FASTEST_PULSE_S * s[busiest], 10);
    });

    test('a kind of place nobody searches does not ring', () => {
      expect(pulsePeriods({ a: 0.5, b: 0 }).b).toBeNull();
    });
  });
  ```

- [ ] **Step 2: Watch it fail:** `npx vitest run tests/indiaMap.test.js`.

- [ ] **Step 3: Write `ui/map/india.js`:**

  ```js
  /**
   * India, with the three kinds of place on it (DECISIONS G4): round 0's step 1
   * now, and the Where and when control later (plans/2026-09-14-round-zero-redesign.md,
   * section 8). Display geography only: nothing in engine/ reads a city, and the
   * model knows three kinds of place, not cities, so every city of a kind rings
   * at that kind's rate.
   *
   * THE PULSE CARRIES THE DATA, and it is the one motion the makeover's six do
   * not include (the spec's section 7): a city rings as often as its kind of
   * place is searched, for the price level shown. Transform and opacity only,
   * none at all under reduced motion (ui/studio.css), and it runs only while the
   * map is on the page: leaving step 1 removes it.
   */

  import { MAP_VIEWBOX, INDIA_PATH, CITY_POINTS, BACKDROP, labelPlace } from '../india-map.js';

  /** The busiest kind of place rings once every this many seconds. */
  export const FASTEST_PULSE_S = 1.6;

  const NS = 'http://www.w3.org/2000/svg';

  /**
   * Each kind of place's share of searches, for one price level or for all.
   * 'all' weights each level's shares by its searches a week: both are the
   * briefing's public figures (17.2), so it tells the player nothing withheld.
   *
   * @param {object[]} locations - `briefing(querySet).locations`
   * @param {Record<string, number>} weeklySearchesByTier - `briefing(querySet).weeklySearchesByTier`
   * @param {'all'|'value'|'mid'|'premium'} basis
   * @returns {Record<string, number>} share by location id
   */
  export function sharesFor(locations, weeklySearchesByTier, basis) {
    if (basis !== 'all') return Object.fromEntries(locations.map((p) => [p.id, p.shareOfSearches[basis]]));
    const total = Object.values(weeklySearchesByTier).reduce((a, b) => a + b, 0);
    return Object.fromEntries(locations.map((p) => [
      p.id,
      Object.entries(weeklySearchesByTier)
        .reduce((sum, [price, searches]) => sum + p.shareOfSearches[price] * searches, 0) / total,
    ]));
  }

  /** @returns {Record<string, number|null>} seconds between rings, by location id */
  export function pulsePeriods(shares, fastest = FASTEST_PULSE_S) {
    const top = Math.max(...Object.values(shares));
    return Object.fromEntries(Object.entries(shares)
      .map(([id, share]) => [id, share > 0 ? (fastest * top) / share : null]));
  }

  function make(tag, attrs = {}) {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    return node;
  }

  /**
   * @param {object} args
   * @param {object[]} args.locations - `briefing(querySet).locations`
   * @param {Record<string, number>} args.shares - from `sharesFor`
   * @param {string|null} [args.lit] - a location id to light, or null for none
   * @param {(id: string) => void} args.onPick - a city was tapped
   * @returns {SVGElement}
   */
  export function drawIndia({ locations, shares, lit = null, onPick }) {
    const svg = make('svg', { viewBox: MAP_VIEWBOX, class: 'r0-map', 'aria-hidden': 'true' });
    svg.append(make('path', { d: INDIA_PATH, class: 'r0-land' }));

    const back = make('g', { class: 'r0-backdrop' });
    for (const [x, y] of BACKDROP) back.append(make('circle', { cx: x, cy: y, r: 1.6 }));
    svg.append(back);

    const periods = pulsePeriods(shares);
    for (const place of locations) {
      let state = '';
      if (lit === place.id) state = ' lit';
      else if (lit) state = ' dim';
      const group = make('g', { class: `r0-place${state}` });
      place.examples.forEach((name, i) => {
        const point = CITY_POINTS[name];
        if (!point) return;
        const [x, y] = point;
        const pin = make('g', { class: 'r0-pin' });
        const period = periods[place.id];
        if (period !== null) {
          const ring = make('circle', { cx: x, cy: y, r: 7, class: 'r0-ring' });
          ring.style.animationDuration = `${period.toFixed(2)}s`;
          // Offset through the period, so a kind's cities do not ring in lockstep.
          ring.style.animationDelay = `${((i * 0.37) % period).toFixed(2)}s`;
          pin.append(ring);
        }
        pin.append(make('circle', { cx: x, cy: y, r: 3.5, class: 'r0-city' }));
        // Which side the name sits is Task 6's LABEL_SIDE, checked in this
        // map's type by tests/locations.test.js.
        const at = labelPlace(name, point, 7);
        const label = make('text', { x: at.x, y: at.y, 'text-anchor': at.anchor, class: 'r0-label' });
        label.textContent = name;
        pin.append(label);
        pin.addEventListener('click', () => onPick(place.id));
        group.append(pin);
      });
      svg.append(group);
    }
    return svg;
  }
  ```

  The map is hidden from screen readers because the places list beside it
  (Task 9) carries the same choice as buttons, with the shares written out.

- [ ] **Step 4: Its styles,** appended to `ui/studio.css`. No red: the map shows
  the market, and red is you.

  ```css
  /* --- the map (spec section 7: the pulse is the one named exception) ------- */
  body.studio .r0-map { display: block; width: 100%; height: auto; }
  body.studio .r0-land { fill: #1C1A1F; stroke: var(--studio-line-strong); stroke-width: 1; }
  body.studio .r0-backdrop circle { fill: #3A363E; }
  body.studio .r0-pin { cursor: pointer; }
  body.studio .r0-city { fill: var(--studio-soft); }
  body.studio .r0-ring { fill: none; stroke: var(--studio-soft); stroke-width: 1.5; opacity: 0; transform-box: fill-box; transform-origin: center; animation: r0-ring 1.6s var(--studio-ease) infinite; }
  body.studio .r0-label { fill: var(--studio-text); font: 600 11px var(--studio-body); opacity: 0; pointer-events: none; }
  body.studio .r0-place.lit .r0-label { opacity: 1; }
  body.studio .r0-place.lit .r0-city { fill: var(--studio-text); }
  body.studio .r0-place.dim { opacity: 0.35; }
  @keyframes r0-ring { from { opacity: 0.7; transform: scale(0.5); } to { opacity: 0; transform: scale(2.4); } }
  @media (prefers-reduced-motion: reduce) { body.studio .r0-ring { animation: none; } }
  ```

- [ ] **Step 5:** add `'map/india.js'` to `LOADABLE` and to the drawing guard's
  list in `tests/words.test.js`. `npm test`. Commit: *Draw India once, pulsing
  each city by its kind of place's share of searches*.

  *Changed after it was built, on the owner's word:* measured by script, the
  coastline above was 1.65:1 against the page and a dimmed city 2.43:1 against
  the land, both under the 3:1 a graphic needs. The coastline is now `#68636B`
  (3.33:1) and `.r0-place.dim` is 0.45 (3.17:1); `tests/indiaMap.test.js`
  reads both from the stylesheet and holds them.

---

### Task 9: round 0's frame in the Studio, and step 1, the market

**Files:** create `ui/roundzero/studio.js`, `ui/roundzero/market.js`,
`ui/words/roundZero.js`; modify `ui/app.js`, `ui/guide/drawer.js`,
`ui/studio.css`, `tests/words.test.js`, `tests/ui.test.js`.

**Interfaces consumed:** Task 2's rules; Task 7's `icon`, `button`, `pills`;
Task 8's `sharesFor`, `drawIndia`; the makeover's `AREAS`, `ICONS`.

**Interfaces produced:**
- `createRoundZero({ querySet, rootSeed, playerBrandId, openGuide, openContents, onGo }) → { node }`.
- A step module exports `render<Name>Step(ctx) → { node }`, where
  `ctx = { draft, brief, querySet, rootSeed, openGuide, changed, redraw }`:
  `changed()` redraws the list's ticks and the tray, never the step;
  `redraw()` redraws the step itself.
- `STEPS` in `studio.js`: `{ key, render }` for `market`, `position`, `keywords`,
  `ad`, `money`; a step whose `render` is `null` is not built yet and shows
  disabled in the list.
- `createGuide({ figures, reveal, canShowCard })`: `canShowCard(slot) → boolean`
  decides whether the chapter's "Show me on the card" is offered.
- `R0` words (below; each later step task adds its own).

- [ ] **Step 1: Write the failing tests** in `tests/words.test.js`: import `R0`
  from `../ui/words/roundZero.js` and add

  ```js
  describe('round 0 in the Studio (plans/2026-09-14-round-zero-redesign.md)', () => {
    // One of every figure round 0's lines quote, formatted as the steps format them.
    // Each step's task adds its own figures here.
    const FIGURES = {
      round: 0, week: 1, n: 3, total: 5, step: 'Where you sit', hours: 168,
      weeks: 12, rivals: 8, order: '₹2,400', margin: '52%', level: 'value',
      price: 'Mid', purpose: 'Performance', amount: '₹25,000',
    };

    test('every entry is a line of a kind the screen may carry', () => {
      for (const [name, entry] of Object.entries(R0)) expect(KINDS, name).toContain(entry.kind);
    });

    test('every why names a chapter that exists', () => {
      for (const [name, entry] of Object.entries(R0)) {
        if (entry.why) expect(Object.keys(CHAPTERS), name).toContain(entry.why);
      }
    });

    test('every entry renders without a hole in it', () => {
      for (const [name, entry] of Object.entries(R0)) {
        expect(entry(FIGURES), name).not.toMatch(/undefined|NaN|\[object/);
      }
    });

    test('"Next" names the step in the middle of a sentence', () => {
      expect(R0.next({ step: 'Where you sit' })).toBe('Next: where you sit');
    });
  });
  ```

  and add `'ui/roundzero/studio.js', 'ui/roundzero/market.js'` to the drawing
  guard's list.

- [ ] **Step 2: Watch them fail:** `npx vitest run tests/words.test.js`.

- [ ] **Step 3: The words,** `ui/words/roundZero.js`:

  ```js
  /**
   * Round 0 in the Studio (plans/2026-09-14-round-zero-redesign.md, sections 3
   * and 4): the frame's words, then each step's. About 150 to 200 words a step,
   * rival ads, planner rows and keyword names aside; the rest is in the guide.
   * The briefing's own facts (the hints, the formula, the returns line) come
   * from setup.js's briefing() as data and are not restated here.
   */

  import { line } from './line.js';

  const lower = (text) => `${text.charAt(0).toLowerCase()}${text.slice(1)}`;

  export const R0 = Object.freeze({
    // The frame
    stepMarket: line('label', 'The market'),
    stepPosition: line('label', 'Where you sit'),
    stepKeywords: line('label', 'Your keywords'),
    stepAd: line('label', 'Your ad'),
    stepMoney: line('label', 'Your money'),
    yourBrand: line('label', 'your brand this game'),
    beforeWeek: line('label', ({ week }) => `Before week ${week}`),
    roundLabel: line('label', ({ round }) => `Round ${round}`),
    beforeAuction: line('label', 'before the first auction'),
    stepOf: line('label', ({ n, total }) => `Step ${n} of ${total}`),
    done: line('label', 'done'),
    soFar: line('label', 'So far'),
    next: line('instruction', ({ step }) => `Next: ${lower(step)}`),
    cellName: line('label', ({ price, purpose }) => `${price} · ${purpose}`),
    capitalKept: line('label', 'capital kept'),
    capitalCommitted: line('label', ({ amount }) => `${amount} of capital committed`),
    keywordCount: line('label', ({ n }) => `${n} ${n === 1 ? 'keyword' : 'keywords'}`),
    menu: line('label', 'Steps'),

    // The tray at step 5
    checkSquare: line('label', 'Your square'),
    checkKeywords: line('label', 'Keywords'),
    checkAd: line('label', 'Your ad'),
    checkMoney: line('label', 'Your money'),
    needKeyword: line('instruction', 'add a keyword'),
    needAd: line('instruction', 'finish the ad'),
    needSplit: line('instruction', 'the weekly split asks for more than the month'),
    redoNote: line('reading', ({ round, week }) => `You can redo round ${round} once, until the end of week ${week}.`),
    go: line('instruction', ({ week }) => `Open the account and run week ${week}`),
    running: line('label', ({ hours }) => `running ${hours} hours…`),

    // The squares' names
    priceValue: line('label', 'Value'),
    priceMid: line('label', 'Mid'),
    pricePremium: line('label', 'Premium'),
    purposePerformance: line('label', 'Performance'),
    purposeLifestyle: line('label', 'Lifestyle'),

    // Step 1, the market
    marketIntro: line('reading', ({ weeks, rivals }) => `${weeks} weeks against ${rivals} rival brands. `
      + 'You finish ranked by profit after returns.'),
    searchesWeek: line('label', 'searches a week'),
    orderMargin: line('label', ({ order, margin }) => `${order} order · ${margin} margin`),
    breakEvenTitle: line('label', 'What a click is worth to you, at break-even'),
    breakEvenCaveat: line('reading', 'That is a click on a search worth nothing in particular. The searches '
      + 'you choose to compete for are worth roughly double, which is why your position matters.'),
    notTold: line('label', 'What you’re not told'),
    hintBuys: line('label', 'Who buys'),
    hintReturns: line('label', 'Returns'),
    hintCompetition: line('label', 'Competition'),
    whereTitle: line('label', 'Where the searches are'),
    basisLabel: line('label', 'Whose searches'),
    basisAll: line('label', 'All'),
    shareAll: line('label', 'Share of all searches'),
    shareOf: line('label', ({ level }) => `Share of ${level} searches`),
    pulseNote: line('reading', 'Each city rings as often as its kind of place is searched: the busiest '
      + 'rings fastest. Tap a place to name its cities.'),
    readOnly: line('instruction', 'Nothing to decide here. Read it, then choose where you sit.'),
  });

  /** A price level's name, by the engine's key. */
  export const PRICE_WORD = Object.freeze({ value: R0.priceValue, mid: R0.priceMid, premium: R0.pricePremium });
  /** A purpose's name, by the engine's key. */
  export const PURPOSE_WORD = Object.freeze({ performance: R0.purposePerformance, lifestyle: R0.purposeLifestyle });

  /** A square's name, 'Mid · Performance', from its key 'mid|performance'. */
  export function cellWords(cell) {
    const [price, purpose] = cell.split('|');
    return R0.cellName({ price: PRICE_WORD[price](), purpose: PURPOSE_WORD[purpose]() });
  }
  ```

- [ ] **Step 4: The guide's card link,** in `ui/guide/drawer.js`:
  `createGuide({ figures, reveal: revealCard = null, canShowCard = () => true })`
  (the drawer holds the option as `revealCard`, since it has its own `reveal`), and in
  `open`, replace `foot.replaceChildren(button('ghost', GUIDE.showCard(), ...));`
  with:

  ```js
      // Before week 1 there is no card to show, and a button that does nothing is
      // worse than none (plans/2026-09-14-round-zero-redesign-plan.md).
      foot.replaceChildren();
      if (canShowCard(view.yourAccount)) {
        foot.append(button('ghost', GUIDE.showCard(), () => showCard(view.yourAccount), ICONS.back));
      }
  ```

- [ ] **Step 5: The controller,** `ui/roundzero/studio.js`:

  ```js
  /**
   * Round 0 in the Studio's sidebar layout (plans/2026-09-14-round-zero-redesign.md,
   * sections 3 and 8): the icon strip, the steps in the list, one step at a
   * time, and the tray. The same frame and classes as the weekly shell
   * (ui/shell/shell.js), with its own controller because every draw in that
   * file reads a played game.
   *
   * The draft is round 0's own (./rules.js), and Go sends `startChoices`, so the
   * account opens exactly as it does from the classic page. Nothing here is
   * saved: round 0 never is (ui/app.js).
   */

  import { el, rupees } from '../dom.js';
  import { briefing, REDO_DEADLINE_ROUND } from '../../setup.js';
  import { BRAND_IDENTITIES } from '../../content/brands.js';
  import { writerTier } from '../../content/writers.js';
  import { TOTAL_ROUNDS } from '../../engine/constants.js';
  import { AREAS, ICONS } from '../shell/sections.js';
  import { icon, button } from '../kit/controls.js';
  import { R0, cellWords } from '../words/roundZero.js';
  import {
    createSetupDraft, stepsDone, checklist, canGo, startChoices, committed,
  } from './rules.js';
  import { renderMarketStep } from './market.js';

  const HOURS_PER_WEEK = 7 * 24;

  /** The five steps. A step whose `render` is null is not built yet. */
  const STEPS = [
    { key: 'market', label: R0.stepMarket, render: renderMarketStep },
    { key: 'position', label: R0.stepPosition, render: null },
    { key: 'keywords', label: R0.stepKeywords, render: null },
    { key: 'ad', label: R0.stepAd, render: null },
    { key: 'money', label: R0.stepMoney, render: null },
  ];
  const CHECK = { square: R0.checkSquare, keywords: R0.checkKeywords, ad: R0.checkAd, money: R0.checkMoney };
  const NEED = { keyword: R0.needKeyword, ad: R0.needAd, split: R0.needSplit };

  /**
   * @param {object} args
   * @param {object} args.querySet
   * @param {number} args.rootSeed
   * @param {string} args.playerBrandId - assigned from the seed, or kept by a redo
   * @param {Function} args.openGuide - `guide.open`
   * @param {(trigger: HTMLElement) => void} args.openContents
   * @param {(choices: {playerBrandId: string, player: object}) => Promise<void>} args.onGo
   * @returns {{node: HTMLElement}}
   */
  export function createRoundZero({ querySet, rootSeed, playerBrandId, openGuide, openContents, onGo }) {
    const brief = briefing(querySet);
    const draft = createSetupDraft({ playerBrandId, rootSeed });
    const brand = BRAND_IDENTITIES.find((b) => b.id === playerBrandId);
    const view = { step: 'market', visited: new Set(['market']), direction: 0 };
    let going = false;

    const node = el('div', 'studio-shell r0');
    const rail = el('nav', 'studio-rail');
    rail.dataset.region = 'Icon strip';
    const list = el('nav', 'studio-list');
    list.dataset.region = 'Round 0 steps';
    const main = el('div', 'studio-main');
    const top = el('div', 'studio-top');
    const body = el('div', 'studio-body');
    // Class lists stay at two names a string: the drawing guard counts three as a sentence.
    const section = el('section', 'card studio-section');
    section.classList.add('r0-step');
    const title = el('h2', 'studio-title');
    const content = el('div', 'studio-content');
    section.append(title, content);
    body.append(section);
    const tray = el('div', 'studio-tray r0-tray');
    tray.dataset.region = 'Tray';
    main.append(top, body, tray);
    node.append(rail, list, main);

    const at = (key) => STEPS.findIndex((s) => s.key === key);
    const ctx = {
      draft, brief, querySet, rootSeed, openGuide,
      // A step's change moves the ticks and the tray, never the step under the cursor.
      changed: () => { drawList(); drawTray(); },
      // A change that does redraw the step keeps the reader's place: the scroll,
      // and the control they were on (each control carries a data-key).
      redraw: () => {
        const y = body.scrollTop;
        const key = document.activeElement?.dataset?.key;
        // A redraw is not a move between steps, so the step transition must not play.
        view.direction = 0;
        drawSection();
        body.scrollTop = y;
        if (key) content.querySelector(`[data-key="${CSS.escape(key)}"]`)?.focus();
        drawList();
        drawTray();
      },
    };

    function drawRail() {
      const initials = brand.name.split(' ').slice(0, 2).map((w) => w[0]).join('');
      rail.replaceChildren(el('div', 'studio-logo', initials));
      for (const area of AREAS) {
        const b = button('studio-area', icon(area.icon), el('span', null, area.label));
        b.setAttribute('aria-current', String(area.key === 'brand'));
        // Neither has anything to show before an auction has run (spec section 3).
        b.disabled = area.key === 'market' || area.key === 'results';
        if (area.key === 'guide') b.addEventListener('click', () => openContents(b));
        rail.append(b);
      }
    }

    function drawList() {
      const done = stepsDone(draft, view.visited);
      const head = el('div', 'studio-brand');
      head.append(el('strong', null, brand.name), el('span', null, R0.yourBrand()));
      list.replaceChildren(head, el('p', 'studio-area-title', R0.beforeWeek({ week: 1 })));
      STEPS.forEach((step, i) => {
        const mark = el('span', done[step.key] ? 'r0-mark done' : 'r0-mark', done[step.key] ? '✓' : String(i + 1));
        if (done[step.key]) mark.setAttribute('aria-label', R0.done());
        const item = button('studio-item', mark, el('span', 'grow', step.label()));
        item.setAttribute('aria-current', String(view.step === step.key));
        item.disabled = step.render === null;
        item.addEventListener('click', () => open(step.key));
        list.append(item);
      });
    }

    function drawTop() {
      const menu = button('studio-menu', icon(ICONS.menu));
      menu.setAttribute('aria-label', R0.menu());
      menu.addEventListener('click', () => node.classList.toggle('menu-open'));
      const dots = el('div', 'studio-dots');
      dots.setAttribute('aria-hidden', 'true');
      for (let week = 1; week <= TOTAL_ROUNDS; week++) dots.append(el('i'));
      const left = el('div', 'studio-top-left');
      left.append(menu, el('span', 'studio-week', R0.roundLabel({ round: 0 })),
        el('span', 'studio-saved', R0.beforeAuction()), dots);
      top.replaceChildren(left, el('span', 'r0-stepof', R0.stepOf({ n: at(view.step) + 1, total: STEPS.length })));
    }

    function drawSection() {
      const step = STEPS[at(view.step)];
      title.textContent = step.label();
      section.dataset.region = step.label();
      // Read by the step transition (Task 14): which way the steps moved.
      let direction = 'none';
      if (view.direction > 0) direction = 'forward';
      if (view.direction < 0) direction = 'back';
      section.dataset.direction = direction;
      content.replaceChildren(step.render(ctx).node);
      body.scrollTop = 0;
    }

    function soFar() {
      const box = el('div', 'r0-sofar');
      const chip = (text) => el('span', 'studio-chip', text);
      box.append(el('span', 'r0-sofar-label', R0.soFar()), chip(cellWords(draft.cell)));
      if (draft.keywords.length > 0) box.append(chip(R0.keywordCount({ n: draft.keywords.length })));
      box.append(chip(writerTier(draft.writerTier).label));
      const spent = committed(draft);
      box.append(chip(spent > 0 ? R0.capitalCommitted({ amount: rupees(spent) }) : R0.capitalKept()));
      return box;
    }

    function finish() {
      const box = el('div', 'r0-finish');
      const checks = el('ul', 'r0-checks');
      for (const item of checklist(draft)) {
        const li = el('li', item.done ? 'done' : 'need', CHECK[item.key]());
        if (!item.done) li.append(el('span', 'r0-need', NEED[item.need]()));
        checks.append(li);
      }
      const go = button('studio-run r0-go', R0.go({ week: 1 }));
      go.classList.add('press');
      go.disabled = going || !canGo(draft);
      go.addEventListener('click', async () => {
        if (going || !canGo(draft)) return;
        going = true;
        go.disabled = true;
        go.textContent = R0.running({ hours: HOURS_PER_WEEK });
        // Let the label paint before the week holds the thread.
        await new Promise((resolve) => { setTimeout(resolve, 0); });
        await onGo(startChoices(draft));
      });
      box.append(checks, el('p', 'r0-redo', R0.redoNote({ round: 0, week: REDO_DEADLINE_ROUND })), go);
      return box;
    }

    function drawTray() {
      if (view.step === 'money') {
        tray.replaceChildren(soFar(), finish());
        return;
      }
      const nextStep = STEPS[at(view.step) + 1];
      const next = button('studio-run r0-next', R0.next({ step: nextStep.label() }));
      next.classList.add('press');
      next.disabled = nextStep.render === null;
      next.addEventListener('click', () => open(nextStep.key));
      tray.replaceChildren(soFar(), next);
    }

    function drawAll() {
      drawRail();
      drawList();
      drawTop();
      drawSection();
      drawTray();
    }

    /** Open a step, from the list or from Next. */
    function open(key) {
      const step = STEPS[at(key)];
      if (!step || step.render === null) return;
      view.direction = Math.sign(at(key) - at(view.step));
      view.step = key;
      view.visited.add(key);
      node.classList.remove('menu-open');
      drawAll();
    }

    drawAll();
    return { node };
  }
  ```

- [ ] **Step 6: Step 1,** `ui/roundzero/market.js`:

  ```js
  /**
   * Step 1, the market (plans/2026-09-14-round-zero-redesign.md, section 4). Read
   * only: what a founder could research before spending anything (17.2), all of
   * it from setup.js's briefing(), and where the searches are, on a map that
   * pulses by each kind of place's share.
   */

  import { el, rupees, whole, pct } from '../dom.js';
  import { ADVERTISER_COUNT, TOTAL_ROUNDS, PRICE_TIERS } from '../../engine/constants.js';
  import { R0, PRICE_WORD } from '../words/roundZero.js';
  import { pills } from '../kit/controls.js';
  import { sharesFor, drawIndia } from '../map/india.js';

  /** @param {{brief: object}} ctx @returns {{node: HTMLElement}} */
  export function renderMarketStep({ brief }) {
    const node = el('div', 'r0-market');
    node.append(el('p', 'r0-intro', R0.marketIntro({ weeks: TOTAL_ROUNDS, rivals: ADVERTISER_COUNT - 1 })));

    const levels = el('div', 'r0-levels');
    for (const price of PRICE_TIERS) {
      const economics = brief.economicsByTier[price];
      const level = el('div', 'r0-level');
      level.append(
        el('h3', null, PRICE_WORD[price]()),
        el('p', 'r0-figure', whole(brief.weeklySearchesByTier[price])),
        el('p', 'r0-small', R0.searchesWeek()),
        el('p', 'r0-small', R0.orderMargin({ order: rupees(economics.aovMeanPaise), margin: pct(economics.marginPct) })),
      );
      levels.append(level);
    }

    const panel = el('div', 'r0-panel');
    panel.dataset.region = R0.breakEvenTitle();
    panel.append(
      el('p', 'r0-eyebrow', R0.breakEvenTitle()),
      el('p', 'r0-formula', brief.breakEvenFormula),
      el('p', 'r0-sum', brief.workedAnchor.arithmetic),
      el('p', null, R0.breakEvenCaveat()),
    );

    const told = el('div', 'r0-told');
    const hints = el('dl', 'r0-hints');
    for (const [label, text] of [
      [R0.hintBuys, brief.hints.conversionRate],
      [R0.hintReturns, brief.hints.returns],
      [R0.hintCompetition, brief.hints.competition],
    ]) hints.append(el('dt', null, label()), el('dd', null, text));
    told.append(el('h3', null, R0.notTold()), hints);

    const where = el('div', 'r0-where');
    where.dataset.region = R0.whereTitle();
    let basis = 'all';
    let lit = null;
    const light = (id) => { lit = lit === id ? null : id; drawWhere(); };

    function drawWhere() {
      const shares = sharesFor(brief.locations, brief.weeklySearchesByTier, basis);
      const head = el('div', 'r0-where-head');
      head.append(el('h3', null, R0.whereTitle()), pills({
        options: [['all', R0.basisAll()], ...PRICE_TIERS.map((p) => [p, PRICE_WORD[p]()])],
        value: basis,
        label: R0.basisLabel(),
        keyPrefix: 'basis',
        onPick: (value) => { basis = value; drawWhere(); },
      }));
      const places = el('div', 'r0-places');
      places.append(el('p', 'r0-small',
        basis === 'all' ? R0.shareAll() : R0.shareOf({ level: PRICE_WORD[basis]().toLowerCase() })));
      for (const place of brief.locations) {
        const row = el('button', lit === place.id ? 'r0-place-row on' : 'r0-place-row');
        row.type = 'button';
        row.setAttribute('aria-pressed', String(lit === place.id));
        row.append(el('strong', null, place.label), el('span', 'r0-share', pct(shares[place.id])),
          el('span', 'r0-small', place.examples.join(', ')));
        row.addEventListener('click', () => light(place.id));
        places.append(row);
      }
      places.append(el('p', 'r0-small', R0.pulseNote()), el('p', 'r0-small', brief.returnsVaryByLocation));
      const map = el('div', 'r0-mapbox');
      map.append(drawIndia({ locations: brief.locations, shares, lit, onPick: light }));
      const split = el('div', 'r0-where-split');
      split.append(places, map);
      where.replaceChildren(head, split);
    }
    drawWhere();

    node.append(levels, panel, told, where, el('p', 'r0-readonly', R0.readOnly()));
    return { node };
  }
  ```

- [ ] **Step 7: Mount it,** in `ui/app.js`:
  - import `createRoundZero` from `./roundzero/studio.js`, and `assignPlayerBrand`
    with the other `setup.js` imports;
  - the guide gains `canShowCard: () => Boolean(game)` beside the `reveal` makeover
    Task 5 gave it;
  - in `render()`, the `if (!game)` block becomes:

    ```js
    if (!game) {
      roundZeroTouched = false;
      if (look === 'studio') {
        // Round 0 in the sidebar layout (plans/2026-09-14-round-zero-redesign.md).
        // The brand is drawn from the seed; a redo keeps the one it had, because
        // redoRoundZero rebuilds the same market around it.
        app.replaceChildren(createRoundZero({
          querySet: QUERY_SET,
          rootSeed,
          playerBrandId: rewinding?.roundZero?.playerBrandId ?? assignPlayerBrand(rootSeed),
          openGuide: guide.open,
          openContents: (trigger) => guide.openContents(trigger),
          onGo: begin,
        }).node);
      } else {
        app.replaceChildren(renderRoundZero({ querySet: QUERY_SET, rootSeed, onStart: begin }));
      }
      window.scrollTo(0, 0);
      return;
    }
    ```

- [ ] **Step 8: The frame's and step 1's styles,** appended to `ui/studio.css`
  (the shell's own rules from makeover Task 5 already lay out `studio-shell`):

  ```css
  /* --- round 0 in the sidebar layout (plans/2026-09-14-round-zero-redesign.md) --- */
  body.studio .r0-mark { display: grid; flex-shrink: 0; place-items: center; width: 22px; height: 22px; border: 1.5px solid #4A454F; border-radius: 50%; box-sizing: border-box; font-size: 11px; font-weight: 700; color: var(--studio-muted); }
  body.studio .r0-mark.done { border-color: var(--studio-text); background: var(--studio-text); color: var(--studio-page); }
  body.studio .studio-item[aria-current="true"] .r0-mark { border-color: var(--studio-red); background: var(--studio-red); color: var(--studio-on-red); }
  body.studio .studio-item:disabled { color: #6D6770; }
  body.studio .r0-stepof { font-size: 13px; color: var(--studio-faint); }
  body.studio .r0-sofar { display: flex; flex: 1; align-items: center; gap: 8px; min-width: 0; padding: 4px 0; overflow-x: auto; }
  body.studio .r0-sofar-label { font-size: 13px; font-weight: 700; color: var(--studio-muted); white-space: nowrap; }
  body.studio .r0-finish { display: flex; align-items: center; gap: 16px; }
  body.studio .r0-checks { display: flex; gap: 12px; margin: 0; padding: 0; list-style: none; font-size: 13px; }
  body.studio .r0-checks li.done { color: var(--studio-soft); }
  body.studio .r0-checks li.need { color: var(--studio-amber); }
  body.studio .r0-need { display: block; font-size: 11px; }
  body.studio .r0-redo { max-width: 200px; margin: 0; font-size: 12px; line-height: 1.35; color: var(--studio-muted); }
  body.studio .r0-go:disabled, body.studio .r0-next:disabled { opacity: 0.45; }

  body.studio .r0-intro { max-width: 720px; margin: 0 0 18px; font-size: 16px; line-height: 1.5; color: var(--studio-soft); }
  body.studio .r0-small { margin: 0; font-size: 12px; line-height: 1.45; color: var(--studio-muted); }
  body.studio .r0-levels { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-bottom: 14px; }
  body.studio .r0-level { padding: 16px 18px; border: 1px solid var(--studio-line); border-radius: 20px; background: var(--studio-card); }
  body.studio .r0-step h3 { margin: 0 0 6px; font: 700 16px/1.2 var(--studio-display); }
  body.studio .r0-figure { margin: 0; font: 800 30px/1.1 var(--studio-display); font-variant-numeric: tabular-nums; }
  body.studio .r0-panel { margin-bottom: 14px; padding: 18px 22px; border: 1px solid var(--studio-panel-edge); border-radius: 20px; background: var(--studio-panel); color: #F3EEEA; }
  body.studio .r0-panel p { margin: 0 0 6px; font-size: 14px; line-height: 1.5; color: #D9D1CB; }
  body.studio .r0-panel .r0-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #A8989A; }
  body.studio .r0-panel .r0-formula { font-size: 13px; color: #A8989A; }
  body.studio .r0-panel .r0-sum { font: 800 22px/1.25 var(--studio-display); color: #F3EEEA; }
  body.studio .r0-told { margin-bottom: 14px; }
  body.studio .r0-hints { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 8px 16px; margin: 0; }
  body.studio .r0-hints dt { font-size: 13px; font-weight: 700; color: var(--studio-text); }
  body.studio .r0-hints dd { margin: 0; font-size: 13px; line-height: 1.45; color: var(--studio-soft); }
  body.studio .r0-where { padding: 18px 22px; border: 1px solid var(--studio-line); border-radius: 20px; background: var(--studio-card); }
  body.studio .r0-where-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
  body.studio .r0-where-split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 20px; align-items: start; }
  body.studio .r0-places { display: flex; flex-direction: column; gap: 8px; }
  body.studio .r0-place-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 10px; padding: 10px 12px; border: 1px solid var(--studio-line); border-radius: 14px; background: none; color: var(--studio-text); text-align: left; }
  body.studio .r0-place-row .r0-small { grid-column: 1 / -1; }
  body.studio .r0-place-row.on { border-color: var(--studio-text); }
  body.studio .r0-share { font: 800 18px/1 var(--studio-display); font-variant-numeric: tabular-nums; }
  body.studio .r0-mapbox { max-width: 460px; }
  body.studio .r0-readonly { margin: 16px 0 0; font-size: 14px; color: var(--studio-muted); }
  @media (max-width: 900px) {
    body.studio .r0-levels, body.studio .r0-where-split { grid-template-columns: minmax(0, 1fr); }
    body.studio .r0-finish { flex-wrap: wrap; }
    body.studio .studio-tray.r0-tray { height: auto; min-height: 76px; padding: 8px 12px; flex-wrap: wrap; }
  }
  ```

- [ ] **Step 9:** add `'roundzero/studio.js'` and `'roundzero/market.js'` to
  `LOADABLE`. `npm test`. Expected: green, the drawing guard included.

- [ ] **Step 10: Play it** on `http://localhost:5173/ui/?look=studio` with the save
  cleared (the resume offer comes first if a game is saved):
  - the sidebar shows the assigned brand, *Before week 1*, five steps with
    *The market* current and 2–5 disabled; Market and Results in the strip are
    disabled; the Guide icon opens the contents, and a chapter shows no *Show me
    on the card*;
  - the top bar reads *Round 0 · before the first auction*, twelve empty dots,
    *Step 1 of 5*;
  - the three price levels, the break-even panel and the three hints match the
    classic page's figures;
  - switch *All · Value · Mid · Premium*: the shares change (20 / 36 / 44 on
    All), and the towns ring fastest on Value, the metros on Premium;
  - tap a place, in the list and on the map: its cities are named and the others
    dim; tap it again to clear;
  - turn on reduced motion in the operating system and reload: nothing rings;
  - the tray shows *So far* (the square, the freelancer, capital kept) and a
    disabled *Next: where you sit*;
  - the console is clean.

  Then play a classic round 0 into week 1. Commit: *Draw round 0 in the sidebar
  layout: the frame, the tray, and step 1, the market*.

  *Found when built:* the Studio hides the page's header whenever the sidebar
  layout is on the page, and the header carries the playtest button, so
  `createRoundZero` also takes `onPlaytest` and draws the weekly shell's
  Playtest icon in the strip on the playtest link. Step 1's `drawWhere`
  replaced the pill or place just pressed and dropped focus, as the kit did
  (Task 7); the place rows carry `place:<id>` keys and focus is restored by
  key. The guide's footer hides when it holds nothing (the last chapter,
  before week 1). `LOADABLE` needs `'words/roundZero.js'` too. Step 1 measured
  296 words against the section's 150 to 200: its own lines are within it, and
  the briefing's three hints (83 words) and returns-by-place line (48) are the
  rest. The owner cut the returns-by-place line (where to advertise is chosen
  week by week, and that week's card shows what came back from each place):
  243 words, 210 without the city names. Reduced motion was not played: the
  in-app browser cannot turn it on.

---

### Task 10: step 2, where you sit, and the owner's "alive" gate

**Files:** create `ui/roundzero/position.js`; modify `ui/roundzero/studio.js`,
`ui/words/roundZero.js`, `ui/studio.css`, `tests/words.test.js`, `tests/ui.test.js`.

**Interfaces consumed:** `rivalAds`, `positionMatrix`, `setCell`, `setGuess`,
`guessedIn` (Tasks 1–2); `serp` (Task 7); `ctx` (Task 9).

- [ ] **Step 1: The words first.** Add to `R0`, after step 1's lines:

  ```js
    // Step 2, where you sit
    positionIntro: line('reading', ({ rivals }) => `Nobody tells you where the other ${rivals} sit. `
      + 'Their ads are the only evidence before the first auction.'),
    otherRivals: line('label', ({ n }) => `The other ${n}`),
    guessNote: line('instruction', ({ placed, total }) => 'tap the small grid to note where each sits · '
      + `${placed} of ${total} placed, if you like`),
    sponsored: line('label', 'Sponsored'),
    guessFor: line('label', ({ name }) => `Where you think ${name} sits`),
    guessCell: line('label', ({ name, cell }) => `${name}: ${cell}`),
    pickSquare: line('label', 'Pick your square'),
    fixedUntil: line('label', ({ week }) => `fixed until week ${week}`),
    readoutNone: line('reading', 'Price sets what a click can be worth to you. Purpose sets which searches '
      + 'are yours. You haven’t placed any rival here.'),
    readoutPlaced: line('reading', ({ names }) => `You’ve placed ${listed(names)} here. If you’re right, `
      + 'you’ll be competing for exactly the same searches.'),
    whoValuePerformance: line('label', 'An affordable gym-wear brand'),
    whoValueLifestyle: line('label', 'A budget loungewear label'),
    whoMidPerformance: line('label', 'A serious training brand'),
    whoMidLifestyle: line('label', 'An everyday athleisure label'),
    whoPremiumPerformance: line('label', 'A technical performance house'),
    whoPremiumLifestyle: line('label', 'A considered luxury label'),
    contestPerformance: line('label', 'the most contested'),
    contestLifestyle: line('label', 'fewer bidders'),
    you: line('label', 'You'),
    guessed: line('label', ({ name }) => `${name}?`),
    axisPrice: line('label', 'price'),
    barOrder: line('label', 'order · margin'),
  ```

  and, above `R0`, the one helper it uses:

  ```js
  /** 'Nira', 'Nira and Marlow', 'Nira, Marlow and Kestrel'. */
  const listed = (names) => (names.length < 2 ? names.join('')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);
  ```

  In `tests/words.test.js`, the round 0 block's `FIGURES` gains
  `placed: 3, names: ['Nira', 'Marlow'], name: 'Nira', cell: 'Value · Performance'`,
  and add:

  ```js
  test('the names you placed read as a list', () => {
    expect(R0.readoutPlaced({ names: ['Nira'] })).toMatch(/^You’ve placed Nira here/);
    expect(R0.readoutPlaced({ names: ['Nira', 'Marlow', 'Kestrel'] })).toMatch(/Nira, Marlow and Kestrel here/);
  });
  ```

  Add `'ui/roundzero/position.js'` to the drawing guard's list. Run
  `npx vitest run tests/words.test.js`: the guard fails (no file yet), the rest
  pass.

- [ ] **Step 2: Write `ui/roundzero/position.js`:**

  ```js
  /**
   * Step 2, where you sit (plans/2026-09-14-round-zero-redesign.md, section 4):
   * the eight rival ads, each with a small grid for the player's own guess, and
   * the six squares drawn as a diagram. Price is a real axis, value to premium,
   * carrying the briefing's two figures per level; purpose is a divider, because
   * performance and lifestyle are kinds, not a scale.
   *
   * THE GAME NEVER SAYS WHERE A RIVAL SITS, AND NEVER CONFIRMS A GUESS (17.1,
   * I3). The guesses are the player's notes, kept in round 0's draft and not
   * sent. No square carries a figure of its own: that would be worked out from
   * what round 0 withholds.
   */

  import { el, rupees, whole, pct } from '../dom.js';
  import { PRICE_TIERS, REPOSITION_ROUND } from '../../engine/constants.js';
  import { R0, PRICE_WORD, PURPOSE_WORD, cellWords } from '../words/roundZero.js';
  import { serp } from '../kit/serp.js';
  import { rivalAds, positionMatrix, setCell, setGuess, guessedIn } from './rules.js';

  const WHO = {
    'value|performance': R0.whoValuePerformance,
    'value|lifestyle': R0.whoValueLifestyle,
    'mid|performance': R0.whoMidPerformance,
    'mid|lifestyle': R0.whoMidLifestyle,
    'premium|performance': R0.whoPremiumPerformance,
    'premium|lifestyle': R0.whoPremiumLifestyle,
  };
  const CONTEST = { performance: R0.contestPerformance, lifestyle: R0.contestLifestyle };

  /** A bar under a price level: a share of the widest, and its figure. */
  function bar(fraction, text) {
    const box = el('div', 'r0-bar');
    const fill = el('span', 'r0-bar-fill');
    fill.style.width = `${Math.max(4, Math.round(100 * fraction))}%`;
    box.append(fill, el('span', 'r0-bar-text', text));
    return box;
  }

  export function renderPositionStep({ draft, brief, querySet, rootSeed, redraw }) {
    const ads = rivalAds(rootSeed, draft.playerBrandId, querySet);
    const matrix = positionMatrix();
    const node = el('div', 'r0-position');
    node.append(el('p', 'r0-intro', R0.positionIntro({ rivals: ads.length })));

    // The other eight, as searchers see them, each with a grid for a guess.
    const rivals = el('div', 'r0-rivals');
    rivals.dataset.region = R0.otherRivals({ n: ads.length });
    const head = el('div', 'r0-head');
    head.append(el('h3', null, R0.otherRivals({ n: ads.length })),
      el('span', 'r0-small', R0.guessNote({ placed: Object.keys(draft.guesses).length, total: ads.length })));
    const grid = el('div', 'r0-rival-grid');
    for (const rival of ads) {
      const card = el('div', 'r0-rival');
      card.append(serp({
        domain: rival.domain, name: rival.name, headlines: rival.ad.headlines,
        descriptions: rival.ad.descriptions, sponsored: R0.sponsored(),
      }));
      const mini = el('div', 'r0-mini');
      mini.setAttribute('role', 'group');
      mini.setAttribute('aria-label', R0.guessFor({ name: rival.name }));
      for (const row of matrix.rows) {
        for (const cell of row.cells) {
          const on = draft.guesses[rival.name] === cell.key;
          const pick = el('button', on ? 'r0-mini-cell on' : 'r0-mini-cell');
          pick.type = 'button';
          pick.dataset.key = `guess:${rival.name}:${cell.key}`;
          pick.setAttribute('aria-pressed', String(on));
          pick.setAttribute('aria-label', R0.guessCell({ name: rival.name, cell: cellWords(cell.key) }));
          pick.addEventListener('click', () => { setGuess(draft, rival.name, cell.key); redraw(); });
          mini.append(pick);
        }
      }
      card.append(mini);
      grid.append(card);
    }
    rivals.append(head, grid);

    // The squares, as a diagram, with a crosshair on the one chosen.
    const squares = el('div', 'r0-squares');
    squares.dataset.region = R0.pickSquare();
    const shead = el('div', 'r0-head');
    shead.append(el('h3', null, R0.pickSquare()), el('span', 'r0-small', R0.fixedUntil({ week: REPOSITION_ROUND })));
    const here = guessedIn(draft, draft.cell);
    const readout = el('p', 'r0-readout', here.length > 0 ? R0.readoutPlaced({ names: here }) : R0.readoutNone());

    const [chosenPrice, chosenPurpose] = draft.cell.split('|');
    const diagram = el('div', 'r0-diagram');
    for (const row of matrix.rows) {
      const label = el('div', row.purpose === chosenPurpose ? 'r0-row-label on' : 'r0-row-label');
      label.append(el('strong', null, PURPOSE_WORD[row.purpose]()), el('span', 'r0-small', CONTEST[row.purpose]()));
      diagram.append(label);
      for (const cell of row.cells) {
        const on = cell.key === draft.cell;
        const square = el('button', on ? 'r0-square on' : 'r0-square');
        square.type = 'button';
        square.dataset.key = `square:${cell.key}`;
        square.setAttribute('aria-pressed', String(on));
        square.append(el('span', 'r0-square-name', cellWords(cell.key)), el('span', 'r0-who', WHO[cell.key]()));
        const chips = el('span', 'r0-square-chips');
        if (on) chips.append(el('span', 'r0-you', R0.you()));
        for (const name of guessedIn(draft, cell.key)) chips.append(el('span', 'r0-guess', R0.guessed({ name })));
        square.append(chips);
        square.addEventListener('click', () => { if (!on) { setCell(draft, cell.key, rootSeed); redraw(); } });
        diagram.append(square);
      }
    }
    diagram.append(el('div', 'r0-axis-name', R0.axisPrice()));
    const maxSearches = Math.max(...PRICE_TIERS.map((p) => brief.weeklySearchesByTier[p]));
    const maxOrder = Math.max(...PRICE_TIERS.map((p) => brief.economicsByTier[p].aovMeanPaise));
    for (const price of PRICE_TIERS) {
      const economics = brief.economicsByTier[price];
      const axis = el('div', price === chosenPrice ? 'r0-axis on' : 'r0-axis');
      axis.append(
        el('strong', null, PRICE_WORD[price]()),
        bar(brief.weeklySearchesByTier[price] / maxSearches, `${whole(brief.weeklySearchesByTier[price])} ${R0.searchesWeek()}`),
        bar(economics.aovMeanPaise / maxOrder, R0.orderMargin({ order: rupees(economics.aovMeanPaise), margin: pct(economics.marginPct) })),
      );
      diagram.append(axis);
    }
    squares.append(shead, readout, diagram);

    node.append(rivals, squares);
    return { node };
  }
  ```

  In `ui/roundzero/studio.js`, import `renderPositionStep` from `./position.js`
  and set it as the `position` step's `render`.

- [ ] **Step 3: Its styles,** appended to `ui/studio.css`. Rival headlines are bone
  and a guess is bone: only your square and the crosshair are red.

  ```css
  /* --- step 2, where you sit ------------------------------------------------ */
  body.studio .r0-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
  body.studio .r0-rivals, body.studio .r0-squares { margin-bottom: 16px; }
  body.studio .r0-rival-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  body.studio .r0-rival { display: flex; flex-direction: column; gap: 8px; }
  body.studio .r0-rival .kserp { flex: 1; }
  body.studio .r0-mini { display: grid; grid-template-columns: repeat(3, 18px); grid-template-rows: repeat(2, 12px); gap: 3px; align-self: flex-end; }
  body.studio .r0-mini-cell { width: 18px; height: 12px; padding: 0; border: 1px solid #4A454F; border-radius: 3px; background: none; }
  body.studio .r0-mini-cell.on { border-color: var(--studio-text); background: var(--studio-text); }
  body.studio .r0-readout { margin: 0 0 10px; font-size: 14px; color: var(--studio-soft); }
  body.studio .r0-diagram { display: grid; grid-template-columns: 150px repeat(3, minmax(0, 1fr)); gap: 6px; align-items: stretch; }
  body.studio .r0-row-label { display: flex; flex-direction: column; justify-content: center; gap: 2px; padding-right: 10px; border-right: 2px solid #4A454F; }
  body.studio .r0-row-label.on { border-right-color: var(--studio-red); }
  body.studio .r0-row-label.on strong { color: var(--studio-text); }
  body.studio .r0-square { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; min-height: 118px; padding: 12px; border: 1px solid var(--studio-line); border-radius: 6px; background: var(--studio-card); color: var(--studio-soft); text-align: center; }
  body.studio .r0-square.on { border-color: var(--studio-red); background: #1C1417; box-shadow: 0 0 0 1px var(--studio-red); color: var(--studio-text); }
  body.studio .r0-square-name { font-size: 12px; color: var(--studio-muted); }
  body.studio .r0-who { font: 700 15px/1.2 var(--studio-display); }
  body.studio .r0-square-chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; }
  body.studio .r0-you { padding: 2px 8px; border-radius: 999px; background: var(--studio-red); color: var(--studio-on-red); font-size: 11px; font-weight: 700; }
  body.studio .r0-guess { padding: 2px 8px; border: 1px solid var(--studio-line-strong); border-radius: 999px; font-size: 11px; color: var(--studio-soft); }
  body.studio .r0-axis-name { align-self: center; font-size: 12px; color: var(--studio-faint); }
  body.studio .r0-axis-name::after { content: ' →'; }
  body.studio .r0-axis { display: flex; flex-direction: column; gap: 4px; padding-top: 8px; border-top: 2px solid #4A454F; }
  body.studio .r0-axis.on { border-top-color: var(--studio-red); }
  body.studio .r0-axis strong { font-size: 13px; color: var(--studio-muted); }
  body.studio .r0-axis.on strong { color: var(--studio-text); }
  body.studio .r0-bar { position: relative; height: 18px; }
  body.studio .r0-bar-fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 3px; background: #3A363E; }
  body.studio .r0-bar-text { position: relative; padding-left: 6px; font-size: 11px; line-height: 18px; color: var(--studio-soft); white-space: nowrap; }
  @media (max-width: 1280px) { body.studio .r0-rival-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 700px) {
    body.studio .r0-rival-grid { grid-template-columns: minmax(0, 1fr); }
    body.studio .r0-diagram { grid-template-columns: 84px repeat(3, minmax(0, 1fr)); }
    body.studio .r0-who { font-size: 12px; }
  }
  ```

- [ ] **Step 4:** add `'roundzero/position.js'` to `LOADABLE`; `npm test`.

- [ ] **Step 5: Play it:**
  - eight ads, four across at desktop width, headlines in bone, each with its
    small grid; tap a square on one: it fills, the count in the heading rises, and
    the rival's name appears in that big square with a question mark; tap again
    to take it back; the page never jumps and focus stays on the grid;
  - choose a square: it goes red, *You* moves to it, its price and purpose light
    red on the axes, and the line above the grid names any rival you placed
    there;
  - the tray's *So far* follows the square; *Next: your keywords* is disabled
    until Task 11;
  - at 375 px wide: one ad per row, the diagram still three columns, readable;
  - the console is clean.

  Commit: *Draw step 2: the rival ads with your guesses, and the squares as a
  diagram*.

  *Found when built:* at 375px the page measured 424px wide. Round 0's top bar
  (Task 9) held twelve dots, "before the first auction" and the step count on
  one line, so under 900px round 0 drops the dots and that phrase (the list
  still says *Before week 1*). The diagram's squares were 76px with a 50px
  inside, narrower than "performance", and the bars' figures ran out of their
  columns; under 700px the purpose labels sit above their rows as a rule, a
  square is 110px, and a bar is a thin line with its figure beneath. `barOrder`
  was never used and is not in the words. Two things left for the owner: the
  guess cells are 18 by 12px with centres 21 and 15px apart (the touch-target
  minimum is 24px, or spacing that makes up for it) and their outline is 2.1:1
  against the card; and on a phone the tray's *So far* chips are squeezed
  beside Next and scroll sideways. The owner's gate: *it feels alive*, and
  both changed. The guess cells are 26 by 20px, 4px apart, outlined 3.33:1
  (`tests/roundZeroLook.test.js`). Under 700px the tray's *So far* takes its
  own line, its chips wrapping, with the button full width beneath.

- [ ] **Step 6: The owner's gate** (spec section 9). Hand over the dev-server link
  with `?look=studio` and ask the spec's question: play steps 1 and 2; does it
  feel alive, or only tidier? **Stop until the owner answers.** Their answer
  decides whether steps 3–5 go ahead as drawn, and what changes first.

---

### Task 11: step 3, your keywords

**Files:** create `ui/roundzero/keywords.js`; modify `ui/roundzero/studio.js`,
`ui/words/roundZero.js`, `tests/words.test.js`, `tests/ui.test.js`.

**Interfaces consumed:** `setupKeywordCards`, `addSetupKeyword`,
`updateSetupKeyword`, `removeSetupKeyword`, `SETUP_BID_PAISE` (Task 2);
`keywordCard`, `sliderMaxPaise`, `openPlanner` (Task 7).

- [ ] **Step 1: The words.** Add to `R0`:

  ```js
    // Step 3, your keywords
    keywordsIntro: line('reading', ({ n }) => `${n} ${n === 1 ? 'keyword' : 'keywords'} · the searches you `
      + 'bid on, and how loosely each one matches', { why: 'broadMatch' }),
  ```

  Add `'ui/roundzero/keywords.js'` to the drawing guard's list.

- [ ] **Step 2: Write `ui/roundzero/keywords.js`:**

  ```js
  /**
   * Step 3, your keywords (plans/2026-09-14-round-zero-redesign.md, section 4):
   * the weekly section's card and planner, before any data. The card's weekly
   * places are present and empty; a bid under the reserve at the grade the
   * account opens on says so on its card, in one amber line (openingReserve).
   *
   * A DRAG IS NEVER REDRAWN: while a slider moves, only that card's figure and
   * warning change, and the tray. Anything else redraws the step.
   */

  import { el, add } from '../dom.js';
  import { keywordReach } from '../../engine/matching.js';
  import { tagKeywordOffline } from '../../agents/keywordTagger.js';
  import { whyButton } from '../guide/drawer.js';
  import { KEYWORDS } from '../words/keywords.js';
  import { R0 } from '../words/roundZero.js';
  import { keywordCard, sliderMaxPaise } from '../kit/card.js';
  import { openPlanner } from '../kit/planner.js';
  import {
    setupKeywordCards, addSetupKeyword, updateSetupKeyword, removeSetupKeyword, SETUP_BID_PAISE,
  } from './rules.js';

  /** What the planner had typed, per round 0: reopening it keeps the search. */
  const PLANNER = new WeakMap();
  const normal = (text) => String(text).trim().toLowerCase().replace(/\s+/g, ' ');

  export function renderKeywordsStep({ draft, querySet, openGuide, changed, redraw }) {
    if (!PLANNER.has(draft)) PLANNER.set(draft, { term: '', matchType: 'phrase', bidPaise: SETUP_BID_PAISE });
    const maxRupees = Math.round(sliderMaxPaise(draft.keywords) / 100);

    const node = el('div', 'r0-keywords');
    const intro = el('p', 'r0-intro', R0.keywordsIntro({ n: draft.keywords.length }));
    add(intro, whyButton(R0.keywordsIntro, openGuide));

    const grid = el('div', 'kgrid');
    for (const card of setupKeywordCards(draft, querySet)) {
      const drawn = keywordCard({
        card,
        maxRupees,
        openGuide,
        onMatch: (matchType) => { updateSetupKeyword(draft, card.text, { matchType }); redraw(); },
        onBid: (rupees, settled) => {
          updateSetupKeyword(draft, card.text, { bidPaise: rupees * 100 });
          if (settled) { redraw(); return; }
          drawn.show(setupKeywordCards(draft, querySet).find((c) => c.id === card.id));
          changed();
        },
        onRemove: () => { removeSetupKeyword(draft, card.text); redraw(); },
      });
      grid.append(drawn.node);
    }

    const plus = el('button', 'kadd');
    plus.type = 'button';
    plus.dataset.key = 'add';
    plus.append(el('strong', null, KEYWORDS.addTitle()), el('span', null, KEYWORDS.addHow()));
    plus.addEventListener('click', () => openPlanner({
      // The step redraws behind the drawer, so focus returns to the new button.
      trigger: { focus: () => document.querySelector('.r0-keywords [data-key="add"]')?.focus() },
      queries: querySet.queries,
      weeklyVolume: querySet.weeklyVolume,
      state: PLANNER.get(draft),
      held: () => new Set(draft.keywords.map((k) => normal(k.text))),
      reach: (keyword) => keywordReach(keyword, querySet),
      tag: (keyword) => tagKeywordOffline(keyword, querySet),
      onAdd: (text, spec) => {
        const { ok } = addSetupKeyword(draft, text, spec);
        if (ok) redraw();
        return ok;
      },
      onAddAll: (texts, spec) => {
        for (const text of texts) addSetupKeyword(draft, text, spec);
        redraw();
      },
    }));
    grid.append(plus);

    node.append(intro, grid);
    return { node };
  }
  ```

  In `ui/roundzero/studio.js`, import `renderKeywordsStep` from `./keywords.js`
  and set it as the `keywords` step's `render`.

- [ ] **Step 3:** add `'roundzero/keywords.js'` to `LOADABLE`; `npm test`.

- [ ] **Step 4: Play it:**
  - an empty step shows only *Add a keyword*; it opens the planner from the
    right: search *leggings*, pick *Broad*, set ₹25, add three; add *squat proof
    leggings india* as your own; *Add all* adds the rest shown; the rows show
    *in account* once held; Escape and the overlay close it, faster than it came,
    and focus lands back on *Add a keyword*;
  - each card: *new*, *QS —* (opens *No score yet…* with its "why?" into the
    Quality Score chapter, then *Back to the keyword*), match pills that change
    the reach, tags on broad only, the bid figure and slider, dashes for clicks,
    cost and conversions, *new: no clicks yet*;
  - drag a bid down to ₹5: the figure follows, and at the reserve an amber *under
    the reserve: it needs ₹… to show at all* appears and goes again above it,
    with no redraw (the drag never breaks); tap the figure, type 140, Enter: the
    slider widens;
  - ⋯ → *Remove keyword* takes the card out; the tray's keyword count follows;
    the step's tick appears with the first keyword;
  - keyboard only: every control reachable, focus kept after a redraw;
  - the console is clean.

  Commit: *Draw step 3: the shared keyword cards and the planner, before any
  data*.

  *Found when built:* after a drag, tapping the bid figure opened its box on
  the bid from before the drag, because `typeIn` held the value it was drawn
  with and `show` changes only the figure's text; `typeIn` now takes the value
  as a function, read when the box opens. After *Remove keyword* the step
  redraws without the card or the menu that had focus, so focus goes to *Add a
  keyword*. Keyboard: Tab reaches every control in reading order; the in-app
  browser's key presses carry no character, so pressing a button with Enter or
  Space could not be played there (a native button takes both).

---

### Task 12: step 4, your ad

**Files:** create `ui/roundzero/ad.js`; modify `ui/roundzero/studio.js`,
`ui/words/roundZero.js`, `ui/studio.css`, `tests/words.test.js`, `tests/ui.test.js`.

**Interfaces consumed:** `writerOptions`, `setWriter`, `writeAd`, `adGrades`,
`submittedAd` (Tasks 1–2); `serp` (Task 7).

- [ ] **Step 1: The words.** Add to `R0`:

  ```js
    // Step 4, your ad
    adIntro: line('reading', 'The only thing your rivals can see about you. Hire a writer, or write it '
      + 'yourself.', { why: 'writers' }),
    whoWrites: line('label', 'Who writes it'),
    fromBudget: line('label', ({ budget }) => `from a ${budget} creative budget`),
    free: line('label', 'free'),
    writerDiy: line('reading', 'Free. Graded on your own words.'),
    writerFreelancer: line('reading', 'Names what you sell, plainly.'),
    writerAgency: line('reading', 'Adds a hook and one concrete detail.'),
    writerRetainer: line('reading', 'Writes from the customer’s day.'),
    yourWordsDecide: line('label', 'your words decide'),
    runsAt: line('label', ({ grade }) => `runs at ${grade} · ${grade}`),
    leftover: line('reading', ({ amount }) => `${amount} of the creative budget goes to your ads instead`),
    asSearchersSee: line('label', 'As searchers see it'),
    emptyHead: line('instruction', 'Your headlines appear here'),
    emptyDesc: line('instruction', 'Your descriptions appear here.'),
    headlineN: line('label', ({ n }) => `Headline ${n}`),
    descriptionN: line('label', ({ n }) => `Description ${n}`),
    charCount: line('label', ({ n, max }) => `${n}/${max}`),
    namesRival: line('reading', ({ name }) => `It names ${name}. Bidding on a rival’s name is allowed; `
      + 'naming them in your ad is not, and it costs ad relevance.'),
    howItRuns: line('label', ({ week }) => `How it runs, from week ${week}`),
    twoParts: line('label', 'two of Quality Score’s three parts · the grade the auction uses'),
    expectedCtr: line('label', 'Expected click-through'),
    adRelevance: line('label', 'Ad relevance'),
    byWriter: line('label', ({ writer }) => `written by the ${writer}`),
    byYou: line('label', 'written by you'),
    outOf: line('label', ({ value, scale }) => `${value}/${scale}`),
    hiredNote: line('disclosure', 'A hired writer’s ad runs at the writer’s level whatever the words say: '
      + 'this game cannot judge professional writing, so it takes the writer’s level as the grade. The '
      + 'landing page, the third part, is your site: you build it in the next step.', { why: 'writers' }),
    diyNote: line('disclosure', 'The game’s own grader scores your words as you type, and that score runs '
      + 'from the first week. It checks rules, not taste: echoing your keywords counts for more than '
      + 'reading well. The landing page, the third part, is your site: you build it in the next step.',
      { why: 'writers' }),
  ```

  `FIGURES` in the round 0 words test gains `budget: '₹50,000', grade: 6,
  max: 30, writer: 'freelance copywriter', value: 7, scale: 10`. Add
  `'ui/roundzero/ad.js'` to the drawing guard's list.

- [ ] **Step 2: Write `ui/roundzero/ad.js`:**

  ```js
  /**
   * Step 4, your ad (plans/2026-09-14-round-zero-redesign.md, sections 4 and 5):
   * who writes it, the ad as searchers see it, and the two grades it runs at
   * from week 1. The fee buys not having to write (I11): a hired writer's copy is
   * the real copy for your square (content/writerCopy.js), graded at the
   * writer's level; writing it yourself opens the boxes, graded live on your
   * words by the game's own grader.
   *
   * A KEYSTROKE NEVER REDRAWS THE BOXES: the preview, the counters, the grades
   * and the tray change in place. The classic page learned this the hard way:
   * redrawing under the cursor swallowed every character after the first.
   */

  import { el, add, rupees } from '../dom.js';
  import { BRAND_IDENTITIES } from '../../content/brands.js';
  import { writerTier, isDiy } from '../../content/writers.js';
  import { validateAdCopy, namesARival } from '../../agents/grader.js';
  import {
    HEADLINE_MAX_CHARS, DESCRIPTION_MAX_CHARS, CREATIVE_ALLOCATION_PAISE,
  } from '../../engine/constants.js';
  import { whyButton } from '../guide/drawer.js';
  import { R0 } from '../words/roundZero.js';
  import { serp } from '../kit/serp.js';
  import { writerOptions, setWriter, writeAd, adGrades, submittedAd } from './rules.js';

  const WHAT = {
    diy: R0.writerDiy, freelancer: R0.writerFreelancer, agency: R0.writerAgency, retainer: R0.writerRetainer,
  };
  /** Grades run from 1 to 10 (the grader's scale, agents/grader.js). */
  const GRADE_SCALE = 10;
  /** Room past the limit, so the counter can say a line is too long rather than cut it. */
  const OVER_ROOM = 20;

  export function renderAdStep({ draft, rootSeed, openGuide, changed, redraw }) {
    const brand = BRAND_IDENTITIES.find((b) => b.id === draft.playerBrandId);
    const rivalNames = BRAND_IDENTITIES.filter((b) => b.id !== draft.playerBrandId).map((b) => b.name);
    const writing = isDiy(draft.writerTier);
    const node = el('div', 'r0-ad');
    const intro = el('p', 'r0-intro', R0.adIntro());
    add(intro, whyButton(R0.adIntro, openGuide));

    // Who writes it, and what is left of the creative budget.
    const writers = el('div', 'r0-writers');
    writers.dataset.region = R0.whoWrites();
    const head = el('div', 'r0-head');
    head.append(el('h3', null, R0.whoWrites()),
      el('span', 'r0-small', R0.fromBudget({ budget: rupees(CREATIVE_ALLOCATION_PAISE) })));
    writers.append(head);
    for (const option of writerOptions(draft)) {
      const row = el('button', option.on ? 'r0-writer on' : 'r0-writer');
      row.type = 'button';
      row.dataset.key = `writer:${option.id}`;
      row.setAttribute('aria-pressed', String(option.on));
      row.append(
        el('strong', null, option.label),
        el('span', 'r0-writer-price', option.pricePaise === 0 ? R0.free() : rupees(option.pricePaise)),
        el('span', 'r0-small', WHAT[option.id]()),
        el('span', 'r0-writer-grade', option.grade === null ? R0.yourWordsDecide() : R0.runsAt({ grade: option.grade })),
      );
      row.addEventListener('click', () => { if (!option.on) { setWriter(draft, option.id, rootSeed); redraw(); } });
      writers.append(row);
    }
    const left = CREATIVE_ALLOCATION_PAISE - writerTier(draft.writerTier).pricePaise;
    writers.append(el('p', 'r0-small', R0.leftover({ amount: rupees(left) })));

    // The ad as searchers meet it, and, when you write it, the boxes.
    const preview = el('div', 'r0-preview');
    const serpHost = el('div');
    preview.append(el('h3', null, R0.asSearchersSee()), serpHost);
    const boxes = el('div', 'r0-boxes');
    const problems = el('ul', 'r0-problems');
    const grades = el('div', 'r0-grades');
    grades.dataset.region = R0.howItRuns({ week: 1 });

    function field(part, index, max, label) {
      const box = el('input', 'kfield');
      box.classList.add('r0-box');
      box.value = draft.ad[part][index];
      box.maxLength = max + OVER_ROOM;
      box.setAttribute('aria-label', label);
      box.dataset.key = `ad:${part}:${index}`;
      const count = el('span', 'r0-count');
      const show = () => {
        count.textContent = R0.charCount({ n: box.value.length, max });
        count.classList.toggle('over', box.value.length > max);
      };
      show();
      box.addEventListener('input', () => { writeAd(draft, part, index, box.value); show(); refresh(); });
      const wrap = el('label', 'r0-field');
      wrap.append(el('span', 'r0-small', label), box, count);
      boxes.append(wrap);
    }

    if (writing) {
      draft.ad.headlines.forEach((_, i) => field('headlines', i, HEADLINE_MAX_CHARS, R0.headlineN({ n: i + 1 })));
      draft.ad.descriptions.forEach((_, i) => field('descriptions', i, DESCRIPTION_MAX_CHARS, R0.descriptionN({ n: i + 1 })));
    }

    function drawSerp() {
      const ad = submittedAd(draft);
      serpHost.replaceChildren(serp({
        domain: brand.domain, headlines: ad.headlines, descriptions: ad.descriptions,
        sponsored: R0.sponsored(), emptyHead: R0.emptyHead(), emptyDesc: R0.emptyDesc(),
      }));
    }

    function drawGrades() {
      const graded = adGrades(draft);
      const source = graded.byWriter
        ? R0.byWriter({ writer: writerTier(draft.writerTier).label.toLowerCase() })
        : R0.byYou();
      const row = (label, value) => {
        const line = el('div', 'r0-grade');
        const track = el('span', 'r0-grade-track');
        const fill = el('span', 'r0-grade-fill');
        fill.style.width = `${(100 * value) / GRADE_SCALE}%`;
        track.append(fill);
        line.append(el('span', 'r0-grade-name', label), el('span', 'r0-small', source), track,
          el('strong', 'r0-grade-value', R0.outOf({ value, scale: GRADE_SCALE })));
        return line;
      };
      const note = el('p', 'r0-small', graded.byWriter ? R0.hiredNote() : R0.diyNote());
      add(note, whyButton(graded.byWriter ? R0.hiredNote : R0.diyNote, openGuide));
      grades.replaceChildren(el('h3', null, R0.howItRuns({ week: 1 })), el('p', 'r0-small', R0.twoParts()),
        row(R0.expectedCtr(), graded.expectedCtr), row(R0.adRelevance(), graded.adRelevance), note);

      // Your own words' problems, in the grader's own sentences (I19): why a line
      // does not fit, and what naming a rival costs.
      problems.replaceChildren();
      if (writing) {
        for (const text of validateAdCopy(submittedAd(draft)).violations) problems.append(el('li', null, text));
        for (const text of graded.notes) problems.append(el('li', null, text));
        const rival = namesARival(draft.ad, rivalNames);
        if (rival) problems.append(el('li', null, R0.namesRival({ name: rival })));
      }
      problems.hidden = problems.children.length === 0;
    }

    function refresh() {
      drawSerp();
      drawGrades();
      changed();
    }

    drawSerp();
    drawGrades();
    const written = el('div', 'r0-written');
    written.append(preview, boxes, problems);
    const split = el('div', 'r0-ad-split');
    split.append(written, grades);
    node.append(intro, writers, split);
    return { node };
  }
  ```

  In `ui/roundzero/studio.js`, import `renderAdStep` from `./ad.js` and set it as
  the `ad` step's `render`.

- [ ] **Step 3: Its styles,** appended to `ui/studio.css`:

  ```css
  /* --- step 4, your ad ------------------------------------------------------ */
  body.studio .r0-writers { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 16px; }
  body.studio .r0-writers .r0-head, body.studio .r0-writers > .r0-small { grid-column: 1 / -1; }
  body.studio .r0-writer { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 14px 16px; border: 1px solid var(--studio-line); border-radius: 16px; background: var(--studio-card); color: var(--studio-text); text-align: left; }
  body.studio .r0-writer.on { border-color: var(--studio-red); box-shadow: 0 0 0 1px var(--studio-red); }
  body.studio .r0-writer-price { font: 800 20px/1.1 var(--studio-display); }
  body.studio .r0-writer-grade { margin-top: auto; font-size: 12px; font-weight: 700; color: var(--studio-soft); }
  body.studio .r0-ad-split { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 20px; align-items: start; }
  body.studio .r0-written { display: flex; flex-direction: column; gap: 12px; }
  body.studio .r0-boxes { display: flex; flex-direction: column; gap: 8px; }
  body.studio .r0-field { display: grid; grid-template-columns: 110px minmax(0, 1fr) 56px; gap: 8px; align-items: center; }
  body.studio .r0-count { font-size: 12px; text-align: right; color: var(--studio-muted); font-variant-numeric: tabular-nums; }
  body.studio .r0-count.over { color: var(--studio-amber); }
  body.studio .r0-problems { margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.45; color: var(--studio-amber); }
  body.studio .r0-grades { padding: 18px 20px; border: 1px solid var(--studio-line); border-radius: 20px; background: var(--studio-card); }
  body.studio .r0-grade { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px; margin: 12px 0; }
  body.studio .r0-grade-name { font-weight: 700; }
  body.studio .r0-grade .r0-small { grid-column: 1; }
  body.studio .r0-grade-track { grid-column: 1; position: relative; height: 8px; overflow: hidden; border-radius: 4px; background: #2E2A33; }
  body.studio .r0-grade-fill { position: absolute; inset: 0 auto 0 0; background: var(--studio-text); }
  body.studio .r0-grade-value { grid-column: 2; grid-row: 1 / span 3; align-self: center; font: 800 26px/1 var(--studio-display); font-variant-numeric: tabular-nums; }
  @media (max-width: 1000px) {
    body.studio .r0-writers { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    body.studio .r0-ad-split { grid-template-columns: minmax(0, 1fr); }
  }
  ```

- [ ] **Step 4:** add `'roundzero/ad.js'` to `LOADABLE`; `npm test`.

- [ ] **Step 5: Play it:**
  - arriving: the freelancer chosen, its copy (the real `content/writerCopy.js`
    set for your square) in the preview, *runs at 6 · 6*, both grades at 6,
    *written by the freelance copywriter*, and the hired note with its "why?"
    into *Who writes the ad*;
  - the agency and the retainer: different copy, 7 and 8, the leftover line
    falling to ₹25,000 and ₹0, the tray's month following in step 5;
  - *Write it yourself*: the boxes open empty (I25 clears them), the preview
    says where the headlines will appear, the step's tick goes, the grades show
    what the grader gives your words as you type, without the cursor ever
    jumping; type a headline over 30 characters: the counter turns amber and
    the grader's own sentence says why; name a rival: the line says what it
    costs;
  - switch back to a writer: its copy returns; switch to writing again: the
    boxes are empty again;
  - the console is clean.

  Commit: *Draw step 4: who writes the ad, the ad as searchers see it, and how
  it runs from week 1*.

  *Found when built:* the problems list leaves out `graded.notes`, which say
  the over-length and the rival penalty a second time in the engine's words
  ("adRelevance penalised by 4"); it shows what the classic page shows. On a
  phone a field's label sits above its box (the box was 161px at 375px).
  Two things for the owner. **Switching back to a writer does not bring its
  copy back** once the player has typed: I25 never overwrites the player's
  words, which worked on the classic page because its boxes show for every
  writer; here they show only for *Write it yourself*, so the player's words
  stay in the ad under a hired writer, unseen and uneditable, and an invalid
  ad then blocks Go with nothing on screen to fix. And the kit's text boxes
  (`kfield`) are outlined 1.65:1 against the page. The owner chose: a hired
  writer's ad is always the writer's copy, the player's words set aside in
  `draft.ownAd` and back with *Write it yourself* (I25 rewritten, both looks);
  and the boxes' outline raised to 3.33:1.

---

### Task 13: step 5, your money, and Go

**Files:** create `ui/roundzero/money.js`; modify `ui/roundzero/studio.js`,
`ui/words/roundZero.js`, `ui/studio.css`, `tests/words.test.js`, `tests/ui.test.js`.

**Interfaces consumed:** `CAPEX_ORDER`, `monthlyBudget`, `monthParts`,
`committed`, `landingGrade`, `capexRungs`, `setCapex`, `weeklySplit`, `setWeek`
(Tasks 1–2). The tray's checklist and Go were built in Task 9.

- [ ] **Step 1: The words.** Add to `R0`:

  ```js
    // Step 5, your money
    moneyIntro: line('reading', ({ month, capital }) => `Month ${month}’s budget, and ${capital} of capital: `
      + 'build the site your clicks land on, or keep it as ad money.'),
    monthTitle: line('label', ({ month }) => `Month ${month}, to spend on clicks`),
    monthNote: line('label', ({ weeks }) => `over ${weeks} weeks · unspent money is lost at the month’s end`),
    partBase: line('label', 'the month'),
    partWriter: line('label', 'left from the writer'),
    capitalTitle: line('label', 'Capital'),
    capitalWhen: line('label', ({ week }) => `site work goes live at week ${week} · until then the money is `
      + 'spent and the site unchanged'),
    notCommitted: line('label', 'not committed'),
    lpTitle: line('label', 'Landing page grade'),
    lpNote: line('label', ({ step }) => `the third part of Quality Score · the ad’s two are in ${step}`),
    lpFrom: line('label', ({ value, scale, week }) => `${value}/${scale} from week ${week}`),
    targetPage: line('label', 'The page itself'),
    targetSize: line('label', 'Size guide'),
    targetPhoto: line('label', 'Photography'),
    targetConfirm: line('label', 'Order confirmation'),
    moves: line('label', ({ what }) => `moves: ${what}`),
    movesPage: line('label', 'the landing page grade'),
    movesSize: line('label', 'parcels sent back'),
    movesPhoto: line('label', 'how many visitors buy'),
    movesConfirm: line('label', 'parcels refused'),
    whyPage: line('reading', 'Better quality, so a cheaper click. Worth most in the middle.'),
    whySize: line('reading', 'Fewer parcels sent back after delivery. Worth most at the cheap end, and to '
      + 'anything sold on how it looks.'),
    whyPhoto: line('reading', 'More of your visitors buy. Worth most where the decision is considered.'),
    whyConfirm: line('reading', 'Fewer parcels refused at the door. Worth most where cash on delivery is '
      + 'commonest, which is the cheap end and the small towns.'),
    rung: line('label', ({ label, price }) => `${label} · ${price}`),
    tooDear: line('label', 'more than the capital left'),
    advanced: line('instruction', 'Advanced'),
    splitEven: line('reading', ({ weekly }) => `the weekly split: even, ${weekly} a week`),
    splitCustom: line('reading', ({ planned, month }) => `the weekly split: ${planned} planned of ${month}`),
    splitNotGoogle: line('disclosure', 'a decision Google does not offer', { why: 'weeklySplit' }),
    weekN: line('label', ({ n }) => `Week ${n}`),
  ```

  The four *why* lines are the classic page's own (`CAPEX_TARGETS` in
  `ui/round-zero.js`), unchanged. `FIGURES` gains `month: 1, capital: '₹1,20,000',
  weeks: 4, what: 'parcels refused', label: 'a chart', price: '₹25,000',
  weekly: '₹77,000', planned: '₹3,00,000'` (keep `step`, `value`, `scale`, `week`).
  Add `'ui/roundzero/money.js'` to the drawing guard's list.

- [ ] **Step 2: Write `ui/roundzero/money.js`:**

  ```js
  /**
   * Step 5, your money (plans/2026-09-14-round-zero-redesign.md, section 4): the
   * month and where it comes from, the capital in plain view and neutral
   * (kept by default, nothing recommended), the landing page grade beside the
   * capital that moves it, and the weekly split behind Advanced.
   *
   * Every figure is the game's: the month is `monthlyBudget`, the grade
   * `landingGrade`, the rungs `PAGE_FEATURES` through `capexRungs`.
   */

  import { el, add, rupees } from '../dom.js';
  import { CAPEX_ALLOCATION_PAISE, ROUNDS_PER_MONTH } from '../../engine/constants.js';
  import { whyButton } from '../guide/drawer.js';
  import { R0 } from '../words/roundZero.js';
  import {
    CAPEX_ORDER, monthlyBudget, monthParts, committed, landingGrade, capexRungs, setCapex,
    weeklySplit, setWeek,
  } from './rules.js';

  const PART = { base: R0.partBase, writer: R0.partWriter, kept: R0.capitalKept };
  const TARGET = {
    landingPage: [R0.targetPage, R0.movesPage, R0.whyPage],
    sizeGuide: [R0.targetSize, R0.movesSize, R0.whySize],
    photography: [R0.targetPhoto, R0.movesPhoto, R0.whyPhoto],
    orderConfirmation: [R0.targetConfirm, R0.movesConfirm, R0.whyConfirm],
  };
  const GRADE_SCALE = 10;
  /** Whether Advanced is open, per round 0: a redraw keeps it. */
  const ADVANCED = new WeakMap();

  export function renderMoneyStep({ draft, openGuide, changed, redraw }) {
    const month = monthlyBudget(draft);
    const left = CAPEX_ALLOCATION_PAISE - committed(draft);
    const grade = landingGrade(draft);
    const node = el('div', 'r0-money');
    node.append(el('p', 'r0-intro', R0.moneyIntro({ month: 1, capital: rupees(CAPEX_ALLOCATION_PAISE) })));

    // The month, and where it comes from. Commit capital and it shrinks by as much.
    const panel = el('div', 'r0-panel');
    panel.dataset.region = R0.monthTitle({ month: 1 });
    const bar = el('div', 'r0-month-bar');
    const legend = el('ul', 'r0-month-legend');
    for (const part of monthParts(draft)) {
      const segment = el('span', `r0-seg ${part.key}`);
      segment.style.flexGrow = String(part.paise);
      bar.append(segment);
      const item = el('li', part.key);
      item.append(el('span', 'r0-key'), el('span', null, PART[part.key]()), el('strong', null, rupees(part.paise)));
      legend.append(item);
    }
    panel.append(el('p', 'r0-eyebrow', R0.monthTitle({ month: 1 })), el('p', 'r0-sum', rupees(month)),
      el('p', null, R0.monthNote({ weeks: ROUNDS_PER_MONTH })), bar, legend);

    // The capital, and the grade the page part of it moves.
    const capital = el('div', 'r0-capital');
    capital.dataset.region = R0.capitalTitle();
    const head = el('div', 'r0-head');
    head.append(el('h3', null, R0.capitalTitle()), el('span', 'r0-small', R0.capitalWhen({ week: grade.liveAt })));
    const kept = el('p', 'r0-kept');
    kept.append(el('strong', null, rupees(left)), el('span', null, R0.notCommitted()));

    const lp = el('div', 'r0-lp');
    lp.dataset.region = R0.lpTitle();
    const gradeBar = (value, week) => {
      const line = el('div', 'r0-lp-line');
      const track = el('span', 'r0-grade-track');
      const fill = el('span', 'r0-grade-fill');
      fill.style.width = `${(100 * value) / GRADE_SCALE}%`;
      track.append(fill);
      line.append(track, el('strong', null, R0.lpFrom({ value, scale: GRADE_SCALE, week })));
      return line;
    };
    lp.append(el('h3', null, R0.lpTitle()), el('p', 'r0-small', R0.lpNote({ step: R0.stepAd() })),
      gradeBar(grade.fromWeek1, 1));
    if (grade.fromWeek4 > grade.fromWeek1) lp.append(gradeBar(grade.fromWeek4, grade.liveAt));

    const targets = el('div', 'r0-targets');
    for (const key of CAPEX_ORDER) {
      const [label, moves, why] = TARGET[key];
      const card = el('div', draft.capex[key] > 0 ? 'r0-target on' : 'r0-target');
      card.append(el('strong', null, label()), el('span', 'r0-moves', R0.moves({ what: moves() })),
        el('p', 'r0-small', why()));
      const rungs = el('div', 'r0-rungs');
      for (const rung of capexRungs(draft, key)) {
        const chip = el('button', rung.on ? 'r0-rung on' : 'r0-rung',
          rung.paise === 0 ? rung.label : R0.rung({ label: rung.label, price: rupees(rung.paise) }));
        chip.type = 'button';
        chip.dataset.key = `rung:${key}:${rung.paise}`;
        chip.setAttribute('aria-pressed', String(rung.on));
        chip.disabled = !rung.affordable;
        if (!rung.affordable) chip.title = R0.tooDear();
        chip.addEventListener('click', () => { if (!rung.on && setCapex(draft, key, rung.paise).ok) redraw(); });
        rungs.append(chip);
      }
      card.append(rungs);
      targets.append(card);
    }
    capital.append(head, kept, lp, targets);

    // The weekly split, behind Advanced (D10): even unless changed.
    const open = ADVANCED.get(draft) ?? false;
    const advanced = el('div', 'r0-advanced');
    const toggle = el('button', 'r0-advanced-toggle', R0.advanced());
    toggle.type = 'button';
    toggle.dataset.key = 'advanced';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.addEventListener('click', () => { ADVANCED.set(draft, !open); redraw(); });
    const summary = el('span', 'r0-small');
    const showSummary = () => {
      const split = weeklySplit(draft);
      const planned = split.reduce((a, b) => a + b, 0);
      summary.textContent = draft.split === null
        ? R0.splitEven({ weekly: rupees(split[split.length - 1]) })
        : R0.splitCustom({ planned: rupees(planned), month: rupees(monthlyBudget(draft)) });
    };
    showSummary();
    const disclose = el('span', 'r0-small', R0.splitNotGoogle());
    add(disclose, whyButton(R0.splitNotGoogle, openGuide));
    advanced.append(toggle, summary, disclose);
    if (open) {
      const weeks = el('div', 'r0-weeks');
      weeklySplit(draft).forEach((paise, i) => {
        const box = el('input', 'kfield');
        box.classList.add('knum');
        box.type = 'number';
        box.min = '0';
        box.step = '100';
        box.value = String(Math.round(paise / 100));
        box.setAttribute('aria-label', R0.weekN({ n: i + 1 }));
        box.dataset.key = `week:${i}`;
        // Typing never redraws: the summary and the tray's checklist follow in place.
        box.addEventListener('input', () => { setWeek(draft, i, Math.round(Number(box.value) * 100)); showSummary(); changed(); });
        const wrap = el('label', 'r0-week');
        wrap.append(el('span', 'r0-small', R0.weekN({ n: i + 1 })), box);
        weeks.append(wrap);
      });
      advanced.append(weeks);
    }

    node.append(panel, capital, advanced);
    return { node };
  }
  ```

  In `ui/roundzero/studio.js`, import `renderMoneyStep` from `./money.js` and set
  it as the `money` step's `render`. Every step now has one, so remove the
  "not built yet" handling: the `render: null` guard in `open`, and the
  `disabled` lines for list items and Next (and the sentence in `STEPS`' comment).

- [ ] **Step 3: Its styles,** appended to `ui/studio.css`:

  ```css
  /* --- step 5, your money --------------------------------------------------- */
  body.studio .r0-month-bar { display: flex; gap: 2px; height: 12px; margin: 10px 0 8px; overflow: hidden; border-radius: 6px; }
  body.studio .r0-seg { flex-basis: 0; min-width: 2px; }
  body.studio .r0-seg.base, body.studio .r0-month-legend .base .r0-key { background: #D9D3CD; }
  body.studio .r0-seg.writer, body.studio .r0-month-legend .writer .r0-key { background: #9E9599; }
  body.studio .r0-seg.kept, body.studio .r0-month-legend .kept .r0-key { background: #5A545B; }
  body.studio .r0-month-legend { display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 0; padding: 0; list-style: none; font-size: 12px; color: #D9D1CB; }
  body.studio .r0-month-legend li { display: flex; align-items: center; gap: 6px; }
  body.studio .r0-key { width: 8px; height: 8px; border-radius: 2px; }
  body.studio .r0-capital { margin-bottom: 14px; padding: 18px 22px; border: 1px solid var(--studio-line); border-radius: 20px; background: var(--studio-card); }
  body.studio .r0-kept { display: flex; align-items: baseline; gap: 8px; margin: 0 0 12px; font-size: 14px; color: var(--studio-muted); }
  body.studio .r0-kept strong { font: 800 24px/1 var(--studio-display); color: var(--studio-text); }
  body.studio .r0-lp { margin-bottom: 14px; padding: 12px 16px; border: 1px solid var(--studio-line-strong); border-radius: 14px; }
  body.studio .r0-lp-line { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center; margin-top: 8px; }
  body.studio .r0-lp-line strong { font-size: 14px; font-variant-numeric: tabular-nums; }
  body.studio .r0-targets { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  body.studio .r0-target { display: flex; flex-direction: column; gap: 4px; padding: 14px 16px; border: 1px solid var(--studio-line); border-radius: 16px; }
  body.studio .r0-target.on { border-color: var(--studio-red); }
  body.studio .r0-moves { font-size: 12px; font-weight: 700; color: var(--studio-soft); }
  body.studio .r0-rungs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
  body.studio .r0-rung { padding: 5px 10px; border: 1px solid var(--studio-line-strong); border-radius: 999px; background: none; color: var(--studio-soft); font-size: 12px; }
  body.studio .r0-rung.on { border-color: var(--studio-red); background: var(--studio-red); color: var(--studio-on-red); }
  body.studio .r0-rung:disabled { border-color: var(--studio-line); color: #6D6770; }
  body.studio .r0-advanced { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; padding: 12px 0; border-top: 1px solid var(--studio-line); }
  body.studio .r0-advanced-toggle { padding: 6px 14px; border: 1px solid var(--studio-line-strong); border-radius: 999px; background: none; color: var(--studio-text); font-size: 13px; }
  body.studio .r0-weeks { display: grid; grid-template-columns: repeat(4, minmax(0, 120px)); gap: 10px; width: 100%; }
  body.studio .r0-week { display: flex; flex-direction: column; gap: 4px; }
  @media (max-width: 900px) { body.studio .r0-targets, body.studio .r0-weeks { grid-template-columns: minmax(0, 1fr); } }
  ```

  The disabled rung's `#6D6770` on the card is likely under 4.5:1. Task 15's
  contrast script reports it; the owner decides whether disabled text must pass
  too, and if so it becomes `#8A847E`, the faint text token.

- [ ] **Step 4:** add `'roundzero/money.js'` to `LOADABLE`; `npm test`.

- [ ] **Step 5: Play it, through to week 1:**
  - arriving: the month is ₹1,68,000 + ₹40,000 + ₹1,20,000 = ₹3,28,000, drawn as
    three parts; the capital *₹1,20,000 not committed*; the landing page grade
    *5/10 from week 1*;
  - commit *reviews* on the page: the month falls by ₹55,000, the grade reads
    *7/10 from week 1* and *9/10 from week 4*; add *a chart*: 8 and 10, as the
    spec's section 6 says; photography's *video* is disabled with its title;
  - open *Advanced*: four weeks, even; type week 1 up past the month: the tray's
    *Your money* turns amber with its need and Go disables; bring it back;
  - change the writer in step 4: the month and the split follow;
  - with a keyword and a finished ad, press *Open the account and run week 1*: it
    says *running 168 hours…*, then week 1 opens in the sidebar layout, the redo
    under the brand; the account's month, keywords, writer and capital match
    what round 0 showed;
  - *Redo round 0*: round 0 opens again with the **same brand**; Go again: the
    redo is used (no redo button in week 1);
  - the console is clean.

  Then play a classic round 0 into week 1. Commit: *Draw step 5: the month, the
  capital beside the grade it moves, the weekly split, and Go*.

  *Found when built:* the words test's figures already held `weeks` and
  `price`, so the two this step would add are left out (the linter's
  no-dupe-keys). With every step built, the frame's disabled-step rule and the
  Next button's disabled style are dead, and go. The week 1 screen shows no
  Quality Score until 500 impressions, so the account was checked against round
  0 through the save: brand, square, keyword, the agency's copy, both capital
  commitments live at week 4, and four weeks of ₹58,250 adding to the month.
  Left for Task 15: an unaffordable rung is 3.28:1 (disabled, so exempt unless
  the owner says otherwise), and on a phone step 5's tray is 266px tall of 812.

---

### Task 14: round 0's motion

**Files:** modify `ui/studio.css` only.

The makeover's motion task (its Task 9) comes after round 0 in build order C,
so round 0 adds the moments it uses now, and that task later skips them.

- [ ] **Step 1: The rules,** appended to `ui/studio.css`:

  ```css
  /* --- round 0's motion (makeover spec, section 3): the step transition, the
     press, the planner drawer and the card's menu. The map's pulse is in its own
     block above, the one named exception. ------------------------------------- */
  body.studio .r0-step .studio-content > * { transition: opacity 250ms cubic-bezier(0.77, 0, 0.175, 1), transform 250ms cubic-bezier(0.77, 0, 0.175, 1); }
  body.studio .r0-step[data-direction="none"] .studio-content > * { transition: none; }
  body.studio .press { transition: transform 160ms ease-out; }
  body.studio .press:active { transform: scale(0.97); }
  body.studio .kmenu, body.studio .kplanner, body.studio .kplanner-overlay { transition: opacity 220ms var(--studio-ease), transform 220ms var(--studio-ease); }
  body.studio .kmenu { transition-duration: 150ms; }
  body.studio .kplanner.closing { opacity: 0; transform: translateX(100%); transition-duration: 150ms; }
  body.studio .kplanner-overlay.closing { opacity: 0; transition-duration: 150ms; }

  @starting-style {
    body.studio .r0-step[data-direction="forward"] .studio-content > * { opacity: 0; transform: translateX(24px); }
    body.studio .r0-step[data-direction="back"] .studio-content > * { opacity: 0; transform: translateX(-24px); }
    body.studio .kmenu { opacity: 0; transform: scale(0.97); }
    body.studio .kplanner { opacity: 0; transform: translateX(100%); }
    body.studio .kplanner-overlay { opacity: 0; }
  }

  /* Reduced motion keeps the fades and drops the movement and the press. */
  @media (prefers-reduced-motion: reduce) {
    body.studio .press:active { transform: none; }
    body.studio .kplanner.closing { transform: none; }
    @starting-style {
      body.studio .r0-step[data-direction="forward"] .studio-content > *,
      body.studio .r0-step[data-direction="back"] .studio-content > *,
      body.studio .kmenu, body.studio .kplanner { transform: none; }
    }
  }
  ```

- [ ] **Step 2: Check it moves only where it should,** on the dev server:
  - Next slides the new step in from the right, 24px, in 250ms; a step earlier in
    the list comes in from the left; a guess, a square, a rung, a writer and a
    match type change instantly (they redraw with `data-direction="none"`);
  - Next and Go press; the planner slides in and leaves faster; ⋯ grows from its
    button;
  - the map rings on step 1 only, and stops when you leave it;
  - under reduced motion: fades only, and no rings.

- [ ] **Step 3: The owner runs `/review-animations`** on the diff. If it is not
  available in the session, stop and say so rather than skip it. Fix what it
  flags; `npm test`; commit: *Move round 0 only where it explains: the steps,
  the press, the drawer and the menu*.

  *Found when built:* `/review-animations` was not in the session (it had
  `improve-animations` and `find-animation-opportunities`); the owner chose to
  run `improve-animations` on the motion instead. It confirmed the press, the
  drawer, the menu and the step slide against its values, and flagged four
  things; the owner took one. The map's rings had positive delays, so every
  redraw (arriving, a tap, a price level) blanked all 32 and brought them back
  over up to 2.6 seconds; `pulseDelay` now starts each ring mid-cycle. The step
  slide's own curve stays (the spec's row 4), named `--studio-ease-in-out`. Not
  taken: a test holding `DRAWER_EXIT_MS` to the CSS's 150ms, and measuring the
  pulse's repaint cost on a real phone. In the pane the step slid a measured
  24px (Chrome's `getKeyframes` reports a `@starting-style` transform doubled,
  48px, at a device pixel ratio of 2); redraws moved nothing; the planner came
  in over 220ms and left over 150ms; the menu grew from its button.

---

### Task 15: play it through, and measure

Nothing here is written in advance: each finding becomes a fix, test first
where it can be tested, one commit each.

- [ ] **Four round 0s, each into week 2,** in the Studio look: the freelancer with
  nothing committed; the agency with *reviews*; the retainer with a size guide
  and photography; writing it yourself with a weak ad and then a good one. In
  each, week 1's account matches round 0: the month, the keywords and bids, the
  two copy grades in each keyword's Quality Score parts, the capital pending at
  week 4. Then one *Redo round 0*: the same brand and market, and the redo gone.
- [ ] **The reading load,** per step, rival ads, planner rows and keyword names
  aside, in the browser pane on each step:

  ```js
  const skip = [...document.querySelectorAll('.r0-step .kserp, .r0-step .kcard-name')].map((n) => n.innerText);
  let text = document.querySelector('.r0-step').innerText;
  for (const s of skip) text = text.split(s).join(' ');
  text.split(/\s+/).filter((w) => /[a-z]{2,}/i.test(w)).length;
  ```

  Report the five figures against the spec's 150 to 200, and the total against
  the review's 2,648.
- [ ] **Contrast, by script,** on each step (and with the planner open):

  ```js
  const channel = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = (css) => { const [r, g, b] = css.match(/[\d.]+/g).map(Number); return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b); };
  const ground = (node) => {
    for (let n = node; n; n = n.parentElement) {
      const parts = getComputedStyle(n).backgroundColor.match(/[\d.]+/g);
      if (parts && (parts.length < 4 || Number(parts[3]) === 1)) return getComputedStyle(n).backgroundColor;
    }
    return 'rgb(13, 12, 14)';
  };
  const fails = [];
  for (const node of document.querySelectorAll('.r0 *, .kplanner *')) {
    if (![...node.childNodes].some((t) => t.nodeType === 3 && t.textContent.trim())) continue;
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
    const a = lum(style.color);
    const b = lum(ground(node));
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    if (ratio < 4.5) fails.push([node.className, node.textContent.trim().slice(0, 40), ratio.toFixed(2)]);
  }
  fails;
  ```

  The map's city names are SVG `fill`, which the script does not read: check
  `#EDE8E3` on `#1C1A1F` once by hand with the same formula. Every failure is a
  fix unless the owner rules on it (the disabled rung, Task 13).
- [ ] **Red is you:** on steps 1 and 2, list every element whose computed colour,
  background or border is `rgb(215, 38, 47)` or `rgb(255, 97, 102)`; each must be
  the player's own choice (their square and its crosshair, a chosen pill, rung
  or writer, *You*, Next, Go).
- [ ] **Phone width,** 375 × 812: the menu opens the steps, one ad per row, the
  diagram readable, one card per row, the planner full width, the tray wraps,
  and `document.documentElement.scrollWidth <= innerWidth` on every step.
- [ ] **Keyboard only,** through all five steps and Go.
- [ ] **A playtest file:** one round 0 and one week with `?playtest=1&look=studio`,
  read with `node scripts/read-playtest.js <file>`: *Round 0 steps*, *Tray* and
  each step's name must appear among the clicks.
- [ ] **The classic look:** a whole round 0 into week 1, no `?look`.
- [ ] **The gate: the owner plays round 0 in the Studio.** Hand over the link and
  ask the spec's question again, now for all five steps. Their answer decides
  whether round 0 is done.

  *Played, 2026-09-14.* Four round 0s into week 2 each matched their account:
  the freelancer (₹3,28,000; 6 · 6, landing 5; nothing pending), the agency
  with reviews (₹2,58,000; 7 · 7, landing 7; ₹55,000 pending at week 4), the
  retainer with a size guide and photography (₹2,13,000; 8 · 8, landing 7; both
  pending at week 4), and writing it yourself, weak then good (8 · 3 then
  8 · 10; the account ran 8 · 10 at ₹3,38,000). A redo kept the brand, the seed
  and all eight rivals, and was then gone. Reading load by the script: 281
  (about 248 visible: 33 are map labels shown only when a place is lit), 119,
  23 plus 15 a keyword, 150 (160 writing it yourself), 208; 781 in all against
  2,648. Contrast: every enabled text passes on every step, the planner, the
  QS panel, the menu, the reserve warning, the ad's problems and a need in the
  tray; the only failures are disabled (the strip's Market and Results, 2.18:1;
  an unaffordable rung, 3.28:1), for the owner. Red is only the player's own.
  At 375 × 812 nothing is wider than the screen on any step, and the tray is
  166px, 266px on step 5. Tab reaches all 29 of step 5's controls with a 2px
  outline; the pane's key presses carry no character, so Enter could not be
  played. The playtest recording named Round 0 steps, Tray and every step, and
  found two gaps, both fixed: the planner drawer had no region (458311f) and a
  guess cell had no label (02e2489). The classic look played into week 1.

---

### Task 16: docs

- [ ] **`HANDOVER.md`, *Start here*:** round 0 is built in the Studio look on
  `makeover`; how to open it (`?look=studio`, the save cleared); what is next
  (the makeover plan's Tasks 7–11 as amended below, then the message project,
  spec section 11); the open question on the landing page's timing (spec
  section 12) and where its answer landed.
- [ ] **`CLAUDE.md`, *Known traps*,** three new ones:
  - "Round 0's rules live in `ui/roundzero/rules.js`, and both looks read them.
    A figure round 0 shows (the month, the reserve, the grades, the landing page
    grade) comes from there, never from the drawing module."
  - "Since 2026-09-14 a self-written ad runs on its words from week 1 (I11). No
    new game sets `pendingGrade`, and `game.js`'s `landCreative` stays for saves
    made before then; `tests/fixtures/oldSave.js` builds one."
  - "A drawing module's class list holds at most two names in one string: the
    drawing guard in `tests/words.test.js` reads three words as a sentence. Add a
    third with `classList.add`."

  and the build's file count: run `npm run build`, count the files in `dist/`,
  and replace "62 on the branch `makeover`" with the new figure and the date.
- [ ] **`DECISIONS.md`:** I11 (Task 4) and G4 (Task 6) are done. Add, under I, at
  the next free number, *Round 0 is five steps in the sidebar layout, and the
  brand is drawn* — `FIXED`: the review's measurements (2,648 words, 18 of 28
  minutes), the five steps, the brand drawn from the seed because a brand's own
  searches run within two percent of each other whichever it is, the freelancer
  as the arrival, guesses as notes never confirmed and never sent; citing
  `plans/2026-09-14-round-zero-redesign.md`.
- [ ] **The spec's corrections,** in `plans/2026-09-14-round-zero-redesign.md`:
  guesses live in round 0's draft only (section 8); `tests/writerBalance.test.js`
  was rewritten, not retired (section 5); the build started after makeover
  Task 6, not 5 (section 9); the eighteen cities' coordinates were re-derived
  from the dataset (section 8); the guide's *Show me on the card* is hidden
  before week 1.
- [ ] **The makeover plan's amendments,** a short section at the top of
  `plans/2026-09-13-studio-makeover-plan.md`, *Amended by the round 0 plan*:
  - Task 6 was built before round 0;
  - Task 7: `SLIDER_FLOOR_PAISE`, `SLIDER_HEADROOM`, `SLIDER_STEP_PAISE` and
    `sliderMaxPaise` live in `ui/kit/card.js` and are imported from there;
    `ui/words/keywords.js` exists, so Task 7 adds only the weekly lines, and
    `KEYWORDS.isNew` reads "new: no clicks yet";
  - Task 8: Step 3 is done (`ui/kit/controls.js`); Step 4 draws each card with
    the kit's `keywordCard`, adding to it the weekly parts (the running switch,
    "was", the checkbox, the changed and paused outlines) rather than drawing its
    own, and opens the drawer with the kit's `openPlanner`; Step 6 appends only
    the section's own rules (`khead`, `kpanel`, `klever`, `kbar`, `klegend`,
    `kcheck`, `kbulk`, `kswitch`, `kadjust`, and the card's changed, paused and
    selected states);
  - Task 9: the press, the drawer and the menu rules exist; it adds the tray,
    the dot and a section's first visit.
- [ ] **The project memory** (`visual-makeover-direction.md` in Claude's memory
  folder): round 0 BUILT, with the commit range.
- [ ] `npm test`. Commit: *Record round 0's build: the handover, the traps, the
  decisions and the makeover plan's amendments*.

