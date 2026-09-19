# Rewriting the guide — implementation plan

**Goal:** make the thirteen chapters readable by someone who has never bought an
ad, by pulling every departure out of the prose into a field of its own and
holding what remains to a sentence a beginner can parse.

**Architecture:** `departs` becomes a field on `chapter()`, required, carried
through `guideView` and drawn as its own block by both the drawer and the Guide
page. Then the game and real halves are rewritten to four measurable rules. No
claim changes and no source moves; one line of `ui/dashboard.js` is the only
code outside `ui/guide/` that is touched.

**Spec:** `plans/2026-09-19-guide-rewrite.md`. Read it first — section 4 carries
the two worked chapters this plan builds from, and section 2.2 names the five
departures that are buried in prose today.

## Global constraints

- **Nothing in `engine/`, `game.js`, `setup.js`, `content/` or `agents/`.** No
  number moves, so no `scripts/market-harness.js` run and no calibration check.
- **No real-world claim changes, and no source moves.** Rule 3 may split a
  sentence; it may never change a figure, drop a citation, or add a claim. Every
  `realSources` entry stays exactly as fetched.
- **The freeze holds.** Commit freely; **push nothing** until the owner says.
- `npm test` green (2456 passing, 1 todo today) and its **exit code checked**
  before every commit. `git commit -F <file>`, present tense, one concern,
  ending `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **The four rules, in the words the tests will use:**
  1. every chapter declares `departs` (a list, each entry ≤ 25 words) or
     `departsNot` (a reason, not a boolean);
  2. every half opens in **15 words or fewer**;
  3. **no sentence over 25 words**, anywhere in `ui/guide/`;
  4. no banned word in prose: `shape` (for a distribution), `lean` (as a noun),
     `stack` (as a verb), `departs`.

## File structure

| file | what changes |
|---|---|
| `ui/guide/chapters.js` | `chapter()` takes `departs`/`departsNot`; all 13 chapters rewritten |
| `ui/guide/drawer.js` | `guideView` returns `departs`; the drawer draws the block |
| `ui/guide/book.js` | `chapterPage` carries `departs` |
| `ui/guide/page.js` | the Guide page draws the block |
| `ui/words/guide.js` | one new label, the block's heading |
| `ui/dashboard.js` | `ARRIVAL_SHAPE` gains its noun (Task 3 only) |
| `ui/studio.css` | the block's rules |
| `tests/guide.test.js` | the four rules |

---

## Task 1: `departs` becomes a field, proven on one chapter

**Files:**
- Modify: `ui/guide/chapters.js` (the `chapter()` factory, and `hours`),
  `ui/guide/drawer.js:27` (`guideView`) and its `open()`, `ui/guide/book.js:62`
  (`chapterPage`), `ui/guide/page.js`, `ui/words/guide.js`, `ui/studio.css`
- Test: `tests/guide.test.js`

**Interfaces:**
- Produces: `chapter({ …, departs?: string[], departsNot?: string })`, and
  `guideView(id, figures).departs` — `string[]`, empty when the chapter declares
  `departsNot`. `chapterPage(id, figures).departs`, the same.

- [x] **Step 1: Write the failing test**

```js
import { CHAPTERS } from '../ui/guide/chapters.js';
import { guideView } from '../ui/guide/drawer.js';
import { chapterPage } from '../ui/guide/book.js';

describe('a departure is a field, not a sentence buried in the prose', () => {
  test('a chapter may declare its departures as a list', () => {
    expect(CHAPTERS.hours.departs).toBeInstanceOf(Array);
    expect(CHAPTERS.hours.departs.length).toBe(3);
  });

  test('each one is short enough to read on its own', () => {
    for (const line of CHAPTERS.hours.departs) {
      const words = line.trim().split(/\s+/).length;
      expect(words, line).toBeLessThanOrEqual(25);
    }
  });

  // The word goes: it becomes the name of the field, and a reader has never met
  // it in this sense. The block's heading says what it is instead.
  test('the chapter that had three departures no longer says so in prose', () => {
    expect(CHAPTERS.hours.game(FIGURES)).not.toMatch(/departs/i);
  });

  test('both surfaces carry it', () => {
    expect(guideView('hours', FIGURES).departs).toEqual(CHAPTERS.hours.departs);
    expect(chapterPage('hours', FIGURES).departs).toEqual(CHAPTERS.hours.departs);
  });

  test('a chapter with none says so in words, so the claim can be checked', () => {
    const made = chapter({
      title: 'x', real: () => 'y', realSources: [{ label: 'a', url: 'b' }],
      game: () => 'z', cites: ['A1'], yourAccount: 'terms',
      departsNot: 'the game does this exactly as Google does',
    });
    expect(made.departs).toEqual([]);
    expect(made.departsNot).toMatch(/exactly/);
  });

  test('a boolean is refused, because a reason can be checked and true cannot', () => {
    expect(() => chapter({
      title: 'x', real: () => 'y', realSources: [{ label: 'a', url: 'b' }],
      game: () => 'z', cites: ['A1'], yourAccount: 'terms', departsNot: true,
    })).toThrow(/reason/);
  });

  test('declaring both is refused', () => {
    expect(() => chapter({
      title: 'x', real: () => 'y', realSources: [{ label: 'a', url: 'b' }],
      game: () => 'z', cites: ['A1'], yourAccount: 'terms',
      departs: ['one thing'], departsNot: 'nothing',
    })).toThrow(/both/);
  });
});
```

`FIGURES` is `guideFigures()`, as the file's existing tests use it. Export
`chapter` from `ui/guide/chapters.js` if it is not exported already.

- [x] **Step 2: Run it and watch it fail**

```bash
npm test -- guide
```

Expected: `CHAPTERS.hours.departs` is undefined.

- [x] **Step 3: Take the field on `chapter()`**

In `ui/guide/chapters.js`, add to the factory's signature and validation:

```js
  // A DEPARTURE IS A FIELD NOW, not a clause in the middle of the game half.
  // Measured 2026-09-19: in `hours` the departure was 73 words of 109, and in
  // `cashOnDelivery` 65 of 118 — the two chapters both testers named as the
  // hardest. And five chapters declared none while stating one in their prose,
  // where no reader could find it and no test could reach it.
  //
  // `departsNot` takes a REASON rather than a boolean, so a chapter claiming it
  // has nothing to disclose makes a claim the next reader can check.
  if (departs && departsNot) {
    throw new TypeError(`"${title}": declare departs or departsNot, not both`);
  }
  if (!departs && !departsNot) {
    throw new TypeError(`"${title}": say where it departs, or why it does not`);
  }
  if (departsNot && typeof departsNot !== 'string') {
    throw new TypeError(`"${title}": departsNot needs a reason, not a boolean`);
  }
  for (const line of departs ?? []) {
    const words = line.trim().split(/\s+/).length;
    if (words > DEPARTURE_MAX_WORDS) {
      throw new TypeError(`"${title}": a departure runs to ${words} words; say it in ${DEPARTURE_MAX_WORDS}`);
    }
  }
```

with `const DEPARTURE_MAX_WORDS = 25;` beside `CITATION`, and
`departs: Object.freeze([...(departs ?? [])]), departsNot: departsNot ?? null`
on the frozen return.

**Make the requirement bite only where it is met yet:** the other twelve
chapters have no field, so this throws at import. Give them all
`departsNot: 'not yet pulled out of the prose (Task 2)'` in this task, and Task
2 replaces every one. It is a temporary, truthful sentence rather than a
placeholder — it says exactly what is so.

- [x] **Step 4: Rewrite `hours`, the worked example**

From the design's section 4.2, which is the contract for this text:

```js
    game: () => 'Searches peak at one hour and buying at another. '
      + 'That gap is what an hour adjustment is for: it moves money toward the '
      + 'hours that buy, not the hours that are busy.',
    departs: [
      'The lowest setting takes you out of an hour completely. Google’s lowest still leaves you in it.',
      'It works under every bidding strategy. Under the ones that predict conversions the hour counts twice, which Google does not allow.',
      'No bid goes past four times your keyword bid, however an hour and a place add up.',
    ],
```

**`bidCap` stays a figure. Decided with the owner, 2026-09-19:** a departure may
be a function of the figures it quotes, exactly as the two halves are, so the
third entry above is written

```js
      ({ bidCap }) => `No bid goes past ${bidCap} your keyword bid, however an hour and a place add up.`,
```

and `needs: ['bidCap']` stays on the chapter. The alternative — every entry a
plain string — would have turned a constant read from `MAX_BID_MULTIPLE` into
the typed word "four", and this project spends real effort on a chapter typing
no number. `cashOnDelivery` quotes the same cap, so it is two chapters, not one.

- [x] **Step 5: Carry it through the view and both surfaces**

`ui/guide/drawer.js`, in `guideView`'s return: `departs: chapter.departs,`.
`ui/guide/book.js`, in `chapterPage`'s return: `departs: view.departs,`.

In `ui/words/guide.js`:

```js
  // Not "Where it departs": that word is retired from the guide's prose, and a
  // beginner has never met it in this sense.
  departs: line('label', 'Not like the real thing'),
```

In the drawer's `open()`, after the `game` section:

```js
    const parts = [heading(view.title), real, game];
    if (view.departs.length > 0) {
      const apart = el('section', 'guide-part guide-departs');
      const list = el('ul', null);
      for (const line of view.departs) list.append(el('li', null, line));
      apart.append(el('h3', null, GUIDE.departs()), list);
      parts.push(apart);
    }
    body.replaceChildren(...parts);
```

and the same block in `ui/guide/page.js` where it draws the game half.

`ui/studio.css` gets `.guide-departs` styling: quieter than the two halves, a
list, and skippable by eye.

- [x] **Step 6: Run the suite**

```bash
npm test
```

Expected green, exit 0. **Check the exit code, not the tick.**

- [x] **Step 7: Commit**

Message: *"Make a departure a field of its own, and prove it on Bidding by the
hour"*. Body: the 73-of-109 measurement, why `departsNot` takes a reason, and
that twelve chapters carry a truthful placeholder until Task 2.

---

## Task 2: Every departure out of the prose, all thirteen

**Files:**
- Modify: `ui/guide/chapters.js` (all thirteen)
- Test: `tests/guide.test.js`

- [ ] **Step 1: Write the failing test**

```js
describe('every chapter says where it departs, or why it does not', () => {
  test.each(Object.keys(CHAPTERS))('%s declares one or the other', (id) => {
    const c = CHAPTERS[id];
    expect(c.departs.length > 0 || Boolean(c.departsNot), id).toBe(true);
    expect(c.departsNot ?? '', id).not.toMatch(/Task 2|not yet/);
  });

  test('every departure is its own line, and short', () => {
    for (const [id, c] of Object.entries(CHAPTERS)) {
      for (const line of c.departs) {
        expect(line.trim().split(/\s+/).length, `${id}: ${line}`).toBeLessThanOrEqual(25);
      }
    }
  });

  // Measured 2026-09-19: eight chapters labelled a departure and five more
  // stated one inside their prose, unlabelled. Pulled out, there are about 25.
  test('there are far more of them than the eight that used to be labelled', () => {
    const all = Object.values(CHAPTERS).flatMap((c) => c.departs);
    expect(all.length).toBeGreaterThan(18);
  });

  test('no game half still carries a departure in its prose', () => {
    for (const [id, c] of Object.entries(CHAPTERS)) {
      expect(c.game(FIGURES), id).not.toMatch(/departs|where it departs/i);
      expect(c.game(FIGURES), id).not.toMatch(/kinder than a real market/i);
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- guide
```

Expected: twelve chapters still carry the Task 1 placeholder.

- [ ] **Step 3: Extract the eight that are already labelled**

`attributionLag`, `returnsSplit`'s books clause, `cashOnDelivery`,
`broadMatch`, `qualityScore`, `smartBidding`, `writers`, `weeklySplit`. Each
already says its departure in words: move that text into `departs` as one entry
per distinct claim, trim to 25 words, and delete it from the `game` half.
`attributionLag`'s is written out in the design's section 4.1.

- [ ] **Step 4: Pull out the five that are buried**

These are stated in prose today and unlabelled. The design's section 2.2 quotes
each one; the claims do not change, only where they sit.

- **`kindMarket`** — three, and its game half enumerates them already: the
  results page holds nothing but ads, so nothing but ads competes for a click;
  the base conversion rate is the game's own estimate; there is no lifetime
  value, so a first order carries everything.
- **`returnsSplit`** — Google Ads learns of a return only if you upload one;
  here your shop's books are always on screen. And: the refusal rates come from
  one study, and newer reports put cash refusals higher.
- **`counterfactuals`** — a replay is exact here and impossible in a real
  account. And: rivals repeat the moves they made, where a real market might
  have answered differently.
- **`rankOrBudget`** — this split is exact because every auction is counted;
  Google's rests on an estimate of what you were eligible for.
- **`ownName`** — a searcher here is no likelier to click the brand they typed
  than any other ad with the same grades.

**None of these is a new claim.** If any one of them cannot be written from the
chapter's existing prose, stop: it means the chapter was saying something the
design did not find, and the owner should see it before it is moved.

- [ ] **Step 5: Run the suite**

```bash
npm test
```

Expected green, exit 0. `tests/guide.test.js` also proves every `cites` entry
still exists — **a departure moving must not drop a citation.**

- [ ] **Step 6: Commit**

Message: *"Pull every departure out of the prose, including the five nobody had
labelled"*. Body: the five, named, with the sentence each was hiding in.

---

## Task 3: The figure gains its noun

**Files:**
- Modify: `ui/dashboard.js:53` (`ARRIVAL_SHAPE`)
- Test: `tests/words.test.js` or `tests/dashboard.test.js`, wherever
  `ARRIVAL_SHAPE` is already covered

- [ ] **Step 1: Write the failing test**

```js
// The tester read four percentages attached to no noun: "55% this week, then
// 28%…" never said 55% OF WHAT. The noun travels with the number now, so every
// screen that quotes the figure gets it.
test('the arrival shape says what it is counting', () => {
  expect(ARRIVAL_SHAPE).toMatch(/orders/);
  expect(ARRIVAL_SHAPE).toMatch(/^55% of orders/);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- dashboard
```

Expected: `"55% this week, then 28%, then 12% and then 5%"` has no noun.

- [ ] **Step 3: Give it the noun**

```js
export const ARRIVAL_SHAPE = ATTRIBUTION_LAG_DISTRIBUTION
  .map((share, i) => `${Math.round(100 * share)}%${i === 0 ? ' of orders in the week of the click' : ''}`)
  .join(', then ')
  .replace(/, then (?=[^,]*$)/, ' and then ');
```

- [ ] **Step 4: Check the one guard that watches this constant**

`tests/ui.test.js` allows `ATTRIBUTION_LAG_DISTRIBUTION` to be named in
`dashboard.js` alone, and only to be QUOTED — it fails if the next characters
are arithmetic, and it requires the figure to reach the screen as a percentage.
The change keeps both. **Run `npm test -- ui` and read it, do not assume.**

- [ ] **Step 5: Re-read `attributionLag` with the new figure**

The chapter's sentence is built around the old wording. Rewrite it as the
design's section 4.1 has it, so the noun is not said twice.

- [ ] **Step 6: Run the suite and commit**

Message: *"Say what the 55% is counting, everywhere the figure is quoted"*.

---

## Task 4: The sentence rules, across all twenty-six halves

**Files:**
- Modify: `ui/guide/chapters.js`
- Test: `tests/guide.test.js`

- [ ] **Step 1: Write the failing test**

```js
const sentences = (text) => text.split(/(?<=[.:;])\s+/).map((s) => s.trim()).filter(Boolean);
const words = (text) => text.trim().split(/\s+/).filter(Boolean).length;

describe('a beginner can parse a sentence of it', () => {
  const halves = Object.entries(CHAPTERS).flatMap(([id, c]) => [
    [`${id}.real`, c.real(FIGURES)], [`${id}.game`, c.game(FIGURES)],
  ]);

  // Measured 2026-09-19: the median chapter's longest sentence ran to 32 words
  // in its game half and 28 in its real one, with maxima of 41 and 40.
  test.each(halves)('%s keeps every sentence under 25 words', (name, text) => {
    for (const s of sentences(text)) {
      expect(words(s), `${name}: ${s}`).toBeLessThanOrEqual(25);
    }
  });

  // A topic sentence you can act on, before any qualification. Today: 4 of 13
  // game halves and 6 of 13 real ones.
  test.each(halves)('%s opens in 15 words or fewer', (name, text) => {
    expect(words(sentences(text)[0]), name).toBeLessThanOrEqual(15);
  });

  // Seeded from what is in the file today, and it only ever grows: a word joins
  // it the first time a reader trips on one, and never leaves.
  const BANNED = [
    [/\bshapes?\b/i, 'a distribution called a shape'],
    [/\blean\b/i, 'lean, as a noun'],
    [/\bstacks?\b/i, 'stack, as a verb'],
    [/\bdeparts?\b/i, 'departs — it is a field now, not a word'],
  ];
  test.each(halves)('%s uses none of the words a reader tripped on', (name, text) => {
    for (const [pattern, why] of BANNED) {
      expect(pattern.test(text), `${name} uses ${why}`).toBe(false);
    }
  });

  test('the departures follow the same rules', () => {
    for (const [id, c] of Object.entries(CHAPTERS)) {
      for (const line of c.departs) {
        for (const s of sentences(line)) expect(words(s), `${id}: ${s}`).toBeLessThanOrEqual(25);
        for (const [pattern, why] of BANNED) expect(pattern.test(line), `${id} uses ${why}`).toBe(false);
      }
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- guide
```

Expected: many failures, most of them rule 3. **Read the list and keep it** —
it is the work.

- [ ] **Step 3: Rewrite, one chapter at a time**

Work down the list. For each half: split the long sentence, move the
qualification after the claim, and lift the topic sentence to the front.
`attributionLag` and `hours` are already done and are the worked examples of
what "after" looks like.

**Never change a claim to fit a rule.** If a sentence cannot come under 25 words
without dropping something true, split it into two sentences. If it still
cannot, stop and say so: that is a claim needing the owner, not a rewrite.

- [ ] **Step 4: Run the suite, green**

```bash
npm test
```

**`tests/guide.test.js` already proves every cited DECISIONS entry exists.** A
rewrite must not drop a citation, and this is what catches it.

- [ ] **Step 5: Re-read every chapter that cites a changed entry**

`CLAUDE.md`: *"The field guide cites DECISIONS, and a green test does not mean
it agrees."* Nothing in DECISIONS changes here, so nothing needs re-reading —
but the reverse check does apply: **read each rewritten chapter against the
entry it cites**, because a shortened sentence is the easiest place to lose a
qualification that the entry depends on.

- [ ] **Step 6: Commit**

Message: *"Hold every sentence in the guide to something a beginner can parse"*.
Body: the before and after medians, and the count of halves that moved.

---

## Task 5: Reading it

**Files:**
- Modify: `ui/studio.css` if the block needs it
- Test: the browser

- [ ] **Step 1: Play it**

```bash
npm run dev
```

At `http://localhost:5173/ui/`, with a game saved so the guide has an account to
point at:

1. open the **Guide** area and read three chapters end to end — `hours`,
   `attributionLag` and `kindMarket`, the three that changed most;
2. open a **why?** from a card, and check the drawer draws the departures block
   the same way the page does;
3. check **Show me in your account** still works from both;
4. `read_console_messages` for errors on each;
5. `resize_window` to 375 × 812: the block wraps, nothing is wider than the
   screen;
6. **measure contrast by script** across the drawer and the page, and read the
   figure — the departures block is quieter than the halves by design, which is
   exactly where a contrast failure hides;
7. finish animations by script before measuring; the pane reports itself hidden.

- [ ] **Step 2: Read the three chapters as a beginner would**

The rules buy structure, not understanding (the design's weakness 2). This step
is the only check on whether it actually reads better, and it is the owner's
call, not a test's. **Hand the three chapters to the owner and ask.**

- [ ] **Step 3: Commit anything the play-through fixed**

Message: what playing it found, with the measured figures.

---

## Self-review

**Spec coverage.** Rule 1 → Tasks 1 and 2. Rule 2 → Task 4. Rule 3 → Task 4.
Rule 4 → Task 3. Rule 5 → Task 4. The rendering (design section 5) → Task 1. The
"how we would know" table (section 7) → the tests in Tasks 2, 3 and 4, and the
owner in Task 5.

**Not in this plan, deliberately:** the ground floor
(`plans/2026-09-19-ground-floor.md`) and the mid-game questions (section 7 of
the parent doc). The ground floor follows this, because its `then` sends a
beginner into these chapters.

**Type consistency.** `departs` is `string[]` everywhere and never null;
`departsNot` is `string|null`. `guideView` and `chapterPage` both return
`departs` under that name. `DEPARTURE_MAX_WORDS` is defined once in
`chapters.js` and the tests repeat the number rather than importing it, so a
loosened constant cannot quietly loosen the test.

**The one flagged question is answered.** `hours` and `cashOnDelivery` quote
`bidCap` inside a departure. The owner chose, on 2026-09-19, that a departure
may be a function of its figures rather than lose the number to the typed word
"four". The factory normalises a plain string to a function, as `line()` does,
so only the entries that need a figure are written as one — and the 25-word
bound moves to the test, which renders with `guideFigures()`.
