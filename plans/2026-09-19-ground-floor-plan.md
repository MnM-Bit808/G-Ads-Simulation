# The guide's ground floor — implementation plan

**Goal:** nine chapters that say what a keyword, a bid, a budget and the rest
*are*, reachable from the round 0 step that asks for them, so a beginner is not
handed seven decisions in a vocabulary nobody taught them.

**Architecture:** a second constructor, `basic()`, beside `chapter()`. A
ground-floor chapter has one plain paragraph rather than two halves, no
departure of its own, and names the nuance chapter that continues it. Both kinds
flow through `guideView`, which grows a `kind`. The book stays one ordered list
with the nine at the front.

**Spec:** `plans/2026-09-19-ground-floor.md`. Read it first — section 5 carries
all nine chapters' text with every source fetched, and section 2.3 explains
`then`.

**Depends on:** the rewrite (`plans/2026-09-19-guide-rewrite-plan.md`), which
landed first so that `then` leads somewhere worth arriving at. Its weakness 2
was the reason for that order.

## Global constraints

- **Nothing in `engine/`, `game.js`, `setup.js`, `content/` or `agents/`.**
- **No real-world claim from memory.** Every source in the design was fetched on
  2026-09-19 and is quoted there with its URL; use those and no others. Two of
  the nine are game devices and carry none.
- **The four rewrite rules now apply to these chapters too**: no sentence over
  25 words, opening in 15 or fewer, no banned word, and a figure only through
  `guideFigures()`.
- **The freeze holds.** Commit freely; **push nothing**.
- `npm test` green (2569 passing, 1 todo today), **exit code checked** before
  every commit. `git commit -F <file>`, present tense, one concern, ending
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## One design decision this plan settles

**`CONTENTS` is not split.** The design said the contents page shows *Start
here* above *Going deeper*, and the obvious reading is two lists. But `CONTENTS`
is threaded through `book.js`, `drawer.js` and four test files for numbering and
for the chapter either side, and splitting it would fork all of that.

So `CONTENTS` stays one ordered book — **the nine first, then the thirteen** —
and `START_HERE` and `GOING_DEEPER` are exported beside it for the contents page
to group by. Numbering, *of 22*, and previous/next keep working untouched, and
turning the page at chapter 9 carries a reader from the ground floor into the
nuance chapters in order. That is the ladder section 2.3 asks for, for free.

## File structure

| file | what changes |
|---|---|
| `ui/guide/chapters.js` | `basic()`; the nine; `START_HERE`, `GOING_DEEPER`, `CONTENTS` |
| `ui/guide/drawer.js` | `guideView` returns `kind`; the drawer draws one column for a `basic` |
| `ui/guide/book.js` | `chapterPage` carries `kind`, `step`, `then`; `contentsCards` groups |
| `ui/guide/page.js` | one column and a *Read on* for a `basic` |
| `ui/words/guide.js` | the two group headings, and *Read on* |
| `ui/words/roundZero.js` | a `why?` on every term the ground floor defines |
| `ui/studio.css` | the group headings and the single column |
| `tests/guide.test.js`, `tests/drawer.test.js`, `tests/guidePage.test.js`, `tests/words.test.js` | both kinds |

---

## Task 1: `basic()`, and the book that holds both kinds

**Files:**
- Modify: `ui/guide/chapters.js`, `ui/guide/drawer.js:27`, `ui/guide/book.js`
- Test: `tests/guide.test.js`

**Interfaces:**
- Produces:

```js
export function basic({ title, plain, sources, device, needs, step, then, yourAccount })
// → { kind: 'basic', title, plain, sources, device, needs, step, then, yourAccount }

export const START_HERE    // the nine, in round 0's order
export const GOING_DEEPER  // the thirteen, in the order CONTENTS had
export const CONTENTS      // [...START_HERE, ...GOING_DEEPER]

guideView(id, figures) // → { kind: 'basic', id, title, plain, sources, step, then: {id,title}, next }
                       //   | { kind: 'chapter', id, title, real, sources, game, departs, … }
```

`chapter()` gains `kind: 'chapter'` on its frozen return, so nothing has to ask
which one it is by looking for a missing field.

- [x] **Step 1: Write the failing test**

```js
import { CHAPTERS, CONTENTS, START_HERE, GOING_DEEPER, chapter, basic } from '../ui/guide/chapters.js';

describe('the guide has a ground floor as well as its nuance chapters', () => {
  test('a ground-floor chapter is one plain paragraph, and says where it is used', () => {
    const made = basic({
      title: 'What a keyword is',
      plain: () => 'A keyword is a word or phrase you choose.',
      sources: [{ label: 'Google Ads Help: Keywords', url: 'https://support.google.com/google-ads/answer/6323' }],
      step: 3,
      then: 'broadMatch',
    });
    expect(made.kind).toBe('basic');
    expect(made.plain({})).toMatch(/^A keyword/);
    expect(made.step).toBe(3);
    expect(made.then).toBe('broadMatch');
  });

  test('a nuance chapter says which kind it is too, so nobody has to guess', () => {
    expect(CHAPTERS.hours.kind).toBe('chapter');
  });

  // The same rule chapter() follows: an absence cannot be cited, but anything
  // real must be.
  test('it needs a source unless it is a game device', () => {
    const base = { title: 'x', plain: () => 'y', step: 2, then: 'kindMarket' };
    expect(() => basic({ ...base })).toThrow(/source/);
    expect(basic({ ...base, device: true }).device).toBe(true);
  });

  test('it must name the chapter that continues it, and that chapter must exist', () => {
    const base = { title: 'x', plain: () => 'y', step: 2, device: true };
    expect(() => basic({ ...base, then: undefined })).toThrow(/continues/);
    expect(() => basic({ ...base, then: 'noSuchChapter' })).toThrow(/noSuchChapter/);
  });

  test('it must say which round 0 step asks for it', () => {
    const base = { title: 'x', plain: () => 'y', then: 'kindMarket', device: true };
    expect(() => basic({ ...base, step: 0 })).toThrow(/step/);
    expect(() => basic({ ...base, step: 6 })).toThrow(/step/);
  });

  test('the book is one list, the ground floor first', () => {
    expect(CONTENTS).toEqual([...START_HERE, ...GOING_DEEPER]);
    expect(START_HERE).toHaveLength(9);
    expect(GOING_DEEPER).toHaveLength(13);
    // Turning the page at the end of the ground floor lands on the first
    // nuance chapter, which is the ladder the design asks for.
    expect(CONTENTS[START_HERE.length]).toBe(GOING_DEEPER[0]);
  });

  test('every chapter in the book exists, whichever kind it is', () => {
    for (const id of CONTENTS) expect(Object.keys(CHAPTERS), id).toContain(id);
  });

  test('the ground floor runs in the order round 0 asks', () => {
    const steps = START_HERE.map((id) => CHAPTERS[id].step);
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
  });
});
```

- [x] **Step 2: Run it and watch it fail**

```bash
npm test -- guide
```

Expected: `basic is not a function`.

- [x] **Step 3: Write `basic()`**

In `ui/guide/chapters.js`, after `chapter()`:

```js
/** Round 0's five steps: a ground-floor chapter belongs to exactly one. */
const ROUND_ZERO_STEPS = 5;

/**
 * A GROUND-FLOOR CHAPTER: what a control IS, then where you use it.
 *
 * It is not a relaxed `chapter()`. A nuance chapter compares the game with the
 * real thing in two halves; this describes one thing that is true, and has no
 * second half to compare against and no DECISIONS entry to rest on. Forcing
 * either produces padding or a false claim of difference — and the two-halves
 * shape is what both stranger testers could not read (the design's section 2.1).
 *
 * IT NEVER DISCLOSES A DEPARTURE. `then` names the nuance chapter that
 * continues it, and that chapter owns the departure. "Your budget" departs —
 * Google budgets by the day — and `weeklySplit` is where a reader is told so.
 *
 * @param {object} spec
 * @param {string} spec.title
 * @param {(figures: object) => string} spec.plain - what it is, then where you use it
 * @param {Array<{label: string, url: string}>} [spec.sources]
 * @param {boolean} [spec.device] - a game device with no real equivalent
 * @param {string[]} [spec.needs] - figures `plain` quotes
 * @param {number} spec.step - the round 0 step that asks for it, 1 to 5
 * @param {string} spec.then - the chapter that continues it
 * @param {string|null} [spec.yourAccount] - a card, once a game exists
 */
export function basic({
  title, plain, sources = [], device = false, needs = [], step, then, yourAccount = null,
}) {
  if (!title) throw new TypeError('a ground-floor chapter needs a title');
  if (typeof plain !== 'function') throw new TypeError(`"${title}" needs its plain half`);
  if (!device && sources.length === 0) {
    throw new TypeError(`"${title}": it needs a source, unless it is a game device`);
  }
  if (!Number.isInteger(step) || step < 1 || step > ROUND_ZERO_STEPS) {
    throw new TypeError(`"${title}": say which round 0 step asks for it, 1 to ${ROUND_ZERO_STEPS}`);
  }
  if (!then) throw new TypeError(`"${title}": name the chapter that continues it`);
  return Object.freeze({
    kind: 'basic', title, plain, sources: Object.freeze(sources), device,
    needs: Object.freeze(needs), step, then, yourAccount,
  });
}
```

**`then` pointing at a chapter that exists** cannot be checked inside `basic()`,
because `CHAPTERS` is not built yet when it runs. Check it once, after the
object is assembled:

```js
for (const id of START_HERE) {
  const to = CHAPTERS[id].then;
  if (!CHAPTERS[to]) throw new RangeError(`"${id}" continues into "${to}", which is not a chapter`);
}
```

and have the test drive that through a `basic()` whose `then` is checked by the
same loop — or, simpler and what the test above expects, give `basic()` a
`known` argument defaulting to `CHAPTERS`. **Picked while building: the loop over the assembled
object.** `basic()` keeps no default argument that exists only for a test, and
the check sits beside `START_HERE` where a reader looking at the book will find
it.

- [x] **Step 4: One chapter, the most important one**

From the design's section 5, chapter 1. It is the one that matters most: round 0
step 1 already prints "₹20.37 a click at break-even" and nothing says what it
means.

```js
  breakEven: basic({
    title: 'What a click is worth to you',
    plain: () => 'Before you can say what to bid, you need to know what a visitor is worth. '
      + 'Work out what one sale earns you after returns, then how often a click becomes a sale. '
      + 'Multiply them and that is what a click is worth to you. '
      + 'Bid above it and you lose money on every click you win. '
      + 'Step 1 does the sum for where you sit.',
    sources: [GOOGLE.targetCpa],
    step: 1,
    then: 'kindMarket',
  }),
```

with `GOOGLE.targetCpa` added to the sources block:

```js
  targetCpa: {
    label: 'Google Ads Help: About Target CPA bidding',
    url: 'https://support.google.com/google-ads/answer/6268632',
  },
```

Then `START_HERE = ['breakEven']` for now, `GOING_DEEPER` the old `CONTENTS`,
and `CONTENTS = [...START_HERE, ...GOING_DEEPER]`. Task 3 adds the other eight.
**Relax the `toHaveLength(9)` assertion to `toBeGreaterThan(0)` in this task and
restore it in Task 3** — do not write nine stubs.

- [x] **Step 5: Teach `guideView` both kinds**

```js
export function guideView(id, figures) {
  const entry = CHAPTERS[id];
  if (!entry) throw new RangeError(`there is no chapter "${id}"`);
  const at = CONTENTS.indexOf(id);
  const nextId = at >= 0 && at < CONTENTS.length - 1 ? CONTENTS[at + 1] : null;
  const next = nextId ? { id: nextId, title: CHAPTERS[nextId].title } : null;
  if (entry.kind === 'basic') {
    return {
      kind: 'basic', id, title: entry.title, plain: entry.plain(figures),
      sources: entry.sources.map(({ label, url }) => ({ label, url })),
      step: entry.step,
      then: { id: entry.then, title: CHAPTERS[entry.then].title },
      yourAccount: entry.yourAccount, studioAccount: entry.yourAccount, next,
    };
  }
  return { kind: 'chapter', id, title: entry.title, /* …as today… */ next };
}
```

**`book.js` calls `sectionOf(view.studioAccount)`**, which will be handed null
for a ground-floor chapter. Guard it there, and let `chapterPage` return
`section: null` — Task 2 draws the step instead.

- [x] **Step 6: Run the whole suite**

```bash
npm test
```

Expect failures in `tests/drawer.test.js` and `tests/guidePage.test.js`: both
iterate `CONTENTS` and assert two halves. **Narrow them to `GOING_DEEPER`** and
add the ground floor's own assertions in Task 2, where the rendering lands.

- [x] **Step 7: Commit**

Message: *"Give the guide a ground floor, and one chapter to stand on"*. Body:
why `basic()` is a sibling and not a flag, and why `CONTENTS` stays one list.

---

## Task 2: Drawing a ground-floor chapter

**Files:**
- Modify: `ui/guide/drawer.js` (`open`), `ui/guide/page.js`, `ui/guide/book.js`,
  `ui/words/guide.js`, `ui/studio.css`
- Test: `tests/drawer.test.js`, `tests/guidePage.test.js`

- [x] **Step 1: Write the failing test**

```js
// tests/drawer.test.js
test('a ground-floor chapter opens as one column, not two halves', () => {
  const view = guideView('breakEven', FIGURES);
  expect(view.kind).toBe('basic');
  expect(view.plain).toBeTruthy();
  expect(view.real).toBeUndefined();
  expect(view.game).toBeUndefined();
  expect(view.departs).toBeUndefined();
});

test('it offers the chapter that continues it', () => {
  const view = guideView('breakEven', FIGURES);
  expect(view.then.id).toBe('kindMarket');
  expect(view.then.title).toBe(CHAPTERS.kindMarket.title);
});
```

and in `tests/guidePage.test.js`:

```js
test('the contents page shows the ground floor above the rest', () => {
  const cards = contentsCards(FIGURES);
  expect(cards.filter((c) => c.group === 'start')).toHaveLength(START_HERE.length);
  expect(cards.filter((c) => c.group === 'deeper')).toHaveLength(GOING_DEEPER.length);
  expect(cards[0].group).toBe('start');
});

test('a ground-floor card says which step asks for it, not which card explains it', () => {
  const card = contentsCards(FIGURES).find((c) => c.id === 'breakEven');
  expect(card.step).toBe(1);
  expect(card.section).toBeNull();
});
```

- [x] **Step 2: Run them and watch them fail**

```bash
npm test -- drawer
npm test -- guidePage
```

- [x] **Step 3: Add the two group headings and *Read on***

In `ui/words/guide.js`:

```js
  startHere: line('label', 'Start here'),
  goingDeeper: line('label', 'Going deeper'),
  // A ground-floor chapter has no "Show me in your account" before a game
  // exists, so what it offers instead is the chapter that continues it.
  readOn: line('instruction', ({ title }) => `Read on: ${title}`),
  usedIn: line('label', ({ step }) => `Used in step ${step}`),
```

- [x] **Step 4: Draw it**

In the drawer's `open()`, branch on `view.kind`: a `basic` draws one
`.guide-part` with `view.plain` and its sources, then a *Read on* button in the
footer that calls `open(view.then.id)`. In `ui/guide/page.js`, the same: one
column rather than `.gb-halves`, and *Read on* beside the turn links.

`contentsCards` groups: each card gains `group: 'start' | 'deeper'` and, for a
ground-floor card, `step` in place of `section`. The page draws a heading before
each group.

`ui/studio.css` gets the group headings and the single column. **Nothing new is
scoped outside `body.studio`.**

- [x] **Step 5: Run the suite, then look at it**

```bash
npm test
npm run dev
```

Open the Guide: the contents shows *Start here* with one card above *Going
deeper* with thirteen. Open the ground-floor chapter: one column, its source,
and *Read on: How kind this market is*. Follow it and land on the nuance
chapter. **Measure contrast by script.**

- [x] **Step 6: Commit**

Message: *"Draw a ground-floor chapter as one column, and the contents in two
groups"*.

---

## Task 3: The other eight chapters

**Files:**
- Modify: `ui/guide/chapters.js`
- Test: `tests/guide.test.js`

- [x] **Step 1: Restore the assertion Task 1 relaxed**

`expect(START_HERE).toHaveLength(9)`, and add:

```js
test('every ground-floor chapter obeys the rewrite rules too', () => {
  const sentences = (t) => t.split(/(?<=[.:;])\s+/).map((s) => s.trim()).filter(Boolean);
  for (const id of START_HERE) {
    const text = CHAPTERS[id].plain(FIGURES);
    expect(wordCount(sentences(text)[0]), `${id} opens long`).toBeLessThanOrEqual(15);
    for (const s of sentences(text)) expect(wordCount(s), `${id}: ${s}`).toBeLessThanOrEqual(25);
  }
});

// ONE WORD, ONE HOME (the design's section 3). The first run teaches the world;
// these teach the controls; the thirteen keep the surprises.
test('the ground floor covers every control round 0 asks for', () => {
  const steps = new Set(START_HERE.map((id) => CHAPTERS[id].step));
  expect([...steps].sort()).toEqual([1, 2, 3, 4, 5]);
});

test('two of them are game devices, and the rest carry a source', () => {
  const devices = START_HERE.filter((id) => CHAPTERS[id].device);
  expect(devices).toHaveLength(2);
  for (const id of START_HERE) {
    if (!CHAPTERS[id].device) expect(CHAPTERS[id].sources.length, id).toBeGreaterThan(0);
  }
});
```

- [x] **Step 2: Run it and watch it fail**

- [x] **Step 3: Write the eight**

**Every word of all nine is in the design's section 5, with its source.** Copy
the text; do not rewrite it here. The sources to add to the `GOOGLE` block, all
fetched 2026-09-19:

| chapter | source |
|---|---|
| 3 · Keywords | `https://support.google.com/google-ads/answer/6323` |
| 4 · How loosely it matches | `GOOGLE.matchTypes`, already there |
| 5 · Your bid | `https://support.google.com/google-ads/answer/1704431` |
| 6 · What an ad is made of | `GOOGLE.responsiveSearchAds`, already there |
| 7 · Your landing page | `https://support.google.com/google-ads/answer/6238826` |
| 8 · Your budget | `GOOGLE.dailyBudgets`, already there |
| 2 · Where your brand sits | *device* |
| 9 · Capital | *device* |

**If any chapter's text will not come under 25 words a sentence without losing
something true, stop and say so** rather than trimming the claim.

- [x] **Step 4: Run the suite and commit**

Message: *"Write the other eight ground-floor chapters, one per control"*.

---

## Task 4: Making them reachable

**Files:**
- Modify: `ui/words/roundZero.js`
- Test: `tests/words.test.js`, `tests/guide.test.js`

**A ground floor nobody finds is worth nothing.** Round 0 has **134 pieces of
text and 6 `why?` links**, onto 4 of the 13 chapters.

- [ ] **Step 1: Write the failing test**

```js
// tests/guide.test.js — every ground-floor chapter is reachable from round 0.
test('every ground-floor chapter has a why? that opens it', async () => {
  const whys = await screenWhys();
  for (const id of START_HERE) expect(whys, `${id} is unreachable`).toContain(id);
});

// tests/words.test.js
test('round 0 links to the ground floor far more than it used to', () => {
  const linked = Object.values(R0).filter((entry) => entry.why).length;
  expect(linked, 'six links was the problem').toBeGreaterThanOrEqual(15);
});
```

- [ ] **Step 2: Run them and watch them fail**

- [ ] **Step 3: Add the links**

One `why?` per term, on the line in `ui/words/roundZero.js` where round 0 first
uses it. `line()` already takes `{ why }`. The step each chapter names is where
its link belongs.

**Careful:** a `disclosure` must already name a chapter, so do not move an
existing `why` — add to `reading` and `label` lines that have none.

- [ ] **Step 4: Run the suite and commit**

Message: *"Put a why? on every term the ground floor defines"*.

---

## Task 5: Playing it

- [ ] **Step 1: Play round 0 with the guide open**

```bash
npm run dev
```

Walk all five steps. At each, open a `why?` and check it lands on a
ground-floor chapter, in one column, with *Read on* leading into the nuance
chapter. **The drawer belongs to a game** (`ui/app.js` closes it when there is
none) — this is the piece most likely to bite, and round 0 has no game.

Then: no console errors; 375 × 812; **contrast measured by script**; and the
Guide page's contents in two groups.

- [ ] **Step 2: Read the nine as a beginner would** — *the owner's.* The rules
  buy structure; whether the nine actually teach is not a test's to say.

- [ ] **Step 3: Commit what playing it found.**

---

## Self-review

**Spec coverage.** Design section 3 (`basic()`) → Task 1. Section 4 (both
shapes, the contents split) → Tasks 1 and 2. Section 5 (the nine) → Tasks 1 and
3. Section 6 (reachability) → Task 4. Section 8's table → the tests in Tasks 3
and 4, and Task 5 for the rest.

**Deliberately not here:** the mid-game questions (section 7 of the parent doc).

**Type consistency.** `kind` is `'basic' | 'chapter'` on both the frozen chapter
and the view. `then` is a string on the chapter and `{id, title}` on the view —
the same shape `next` already uses. `step` is 1–5 everywhere. `START_HERE`,
`GOING_DEEPER` and `CONTENTS` are all frozen string arrays.

**Known risk, stated.** Task 1 step 3 leaves one thing genuinely open: where
`then` is checked against `CHAPTERS`, which does not exist when `basic()` runs.
The plan offers two ways and says to pick one. **Pick the assembled-object loop**
unless building it shows otherwise: it keeps `basic()` free of a default
argument that exists only for a test.
