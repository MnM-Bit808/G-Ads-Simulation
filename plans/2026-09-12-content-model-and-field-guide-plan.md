# Content model and field guide: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans
> (inline, the owner's choice for this project) to carry this out task by task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** move the returns card's wording into a tested content model (C1), then
give it an in-game field guide reached from "why?" links (C2).

**Architecture:** On-screen sentences become small labelled functions in
`ui/words/<card>.js`, which render functions call with figures they already
compute. Guide chapters live in `ui/guide/chapters.js` with two parts (real
Google Ads, then this game) and checked citations. The guide's on-screen shape
is chosen from design-canvas mock-ups before its code is written.

**Tech stack:** ES modules, no bundler, no framework; Vitest; ESLint; the
existing `ui/dom.js` helpers.

**Spec:** `plans/2026-09-12-content-model-and-field-guide.md`. Read it first.
This plan argues from it.

## Global constraints

- **Nothing is pushed to `main`** until every playtest file from tag
  `playtest-1` has been read. Commit locally only.
- CLAUDE.md applies: tests first, `npm test` green before every commit, one
  concern per commit, present-tense messages ending with the attribution line.
- Edit files with the Edit tool, never with shell heredocs (line endings).
- A words or guide module imports nothing from `engine/`; figures are passed in.
- The player sees no change from Task 1.

## Two amendments to the spec, found while planning

1. **`tests/ui.test.js` reads only the top level of `ui/`.** Its `readdirSync(UI)`
   does not descend into folders, so the leak guards the spec relies on would
   not reach `ui/words/` or `ui/guide/`. Task 1 makes the listing recursive.
2. **A fourth on-screen kind, `label`**, for the names of figures and legend
   keys ("Refused", "Freight paid"). They are neither readings nor
   instructions. A label may carry a `why`; it never needs one.

## File map

| file | task | responsibility |
|---|---|---|
| `ui/words/line.js` | 1 | `line()` and `KINDS`: one on-screen sentence and its kind |
| `ui/words/returns.js` | 1 | every sentence and label on the returns card |
| `ui/guide/chapters.js` | 1 (titles), 2 (chapters) | the chapter registry |
| `ui/dashboard.js` | 1, 4 | `renderReturns` asks for words; later the "why?" links |
| `tests/words.test.js` | 1 | the content model's rules |
| `tests/ui.test.js` | 1 | scans `ui/` recursively; loads the new modules |
| `tests/guide.test.js` | 2 | the chapters' rules |
| `ui/guide/*` (shape per mock-up) | 4 | the guide on screen |
| docs | 1, 5 | published file count; HANDOVER; CLAUDE.md known trap |

---

### Task 1: the content model, piloted on the returns card (C1)

**Files:**
- Create: `ui/words/line.js`, `ui/words/returns.js`, `ui/guide/chapters.js`,
  `tests/words.test.js`
- Modify: `ui/dashboard.js` (`renderReturns`, about lines 364-507),
  `tests/ui.test.js` (the source listing and `LOADABLE`)

**Interfaces produced:**
- `line(kind, text, { why } = {})` returns a function `(figures = {}) => string`
  carrying `.kind` and `.why`. `text` is a string or `(figures) => string`.
  It throws on `kind === 'concept'`, an unknown kind, or a `disclosure` without
  `why`.
- `KINDS`: `['reading', 'disclosure', 'instruction', 'label']`.
- `RETURNS`: a frozen object of `line()` entries (listed in step 5).
- `CHAPTERS`: a frozen object keyed by chapter id, each `{ title }` in this task.
  Ids: `attributionLag`, `returnsSplit`, `cashOnDelivery`.

- [ ] **Step 1: Record the card's text before anything moves.** Start the dev
  server (`.claude/launch.json` entry `sim`), clear storage, and play round 0
  with fixed choices: position *mid · lifestyle*, *Freelance copywriter*, the
  first planner keyword, *Open the account*. After each of weeks 1-8, store the
  card's text in the page:

  ```js
  localStorage.setItem(`probe:returns:${n}`,
    document.querySelector('[data-slot="returns"]').innerText);
  ```

  The seed is fixed (20260902), so the same clicks rebuild the same game later.
  Weeks 1-5 carry "nothing has settled", weeks 6-8 the figures, and one of weeks
  4-5 the capital-open branch. Keep the server running: the probes live in that
  origin's storage.

- [ ] **Step 2: Write the failing tests** in `tests/words.test.js`:

  ```js
  import { describe, test, expect } from 'vitest';
  import { readFileSync, readdirSync } from 'node:fs';
  import { join } from 'node:path';
  import { fileURLToPath } from 'node:url';
  import { line, KINDS } from '../ui/words/line.js';
  import { RETURNS } from '../ui/words/returns.js';
  import { CHAPTERS } from '../ui/guide/chapters.js';

  const WORDS = fileURLToPath(new URL('../ui/words/', import.meta.url));
  const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const literals = (t) => stripComments(t).match(/'[^'\n]*'|"[^"\n]*"|`[^`]*`/g) ?? [];
  const outsideInterpolation = (s) => s.replace(/\$\{[^}]*\}/g, '');

  describe('a line on screen says what kind of line it is', () => {
    test('the on-screen kinds', () => {
      expect(KINDS).toEqual(['reading', 'disclosure', 'instruction', 'label']);
    });
    test('a concept is refused: it belongs in the guide', () => {
      expect(() => line('concept', 'x')).toThrow(/guide/);
    });
    test('an unknown kind is refused', () => {
      expect(() => line('remark', 'x')).toThrow();
    });
    test('a disclosure without a why is refused (I11)', () => {
      expect(() => line('disclosure', 'x')).toThrow(/why/);
      expect(line('disclosure', 'x', { why: 'returnsSplit' }).why).toBe('returnsSplit');
    });
    test('text may be fixed or built from figures', () => {
      expect(line('label', 'Refused')()).toBe('Refused');
      expect(line('reading', ({ n }) => `${n} orders`)({ n: '3' })).toBe('3 orders');
    });
  });

  describe('the returns card', () => {
    const FIGURES = {
      settlesAfter: 5, firstHonestWeek: 6, returned: '9', orders: '20', refused: '4',
      sentBack: '5', perParcel: '₹200', round: 3, perRefusal: '₹900', freight: '₹200',
      margin: '₹700', window: 'before week 1 and before week 5', first: 1, last: 2,
    };

    test('every entry is a line of an on-screen kind', () => {
      for (const [name, entry] of Object.entries(RETURNS)) {
        expect(KINDS, name).toContain(entry.kind);
      }
    });
    test('every why names a chapter that exists', () => {
      for (const [name, entry] of Object.entries(RETURNS)) {
        if (entry.why) expect(Object.keys(CHAPTERS), name).toContain(entry.why);
      }
    });
    test('every entry renders without a hole in it', () => {
      for (const [name, entry] of Object.entries(RETURNS)) {
        expect(entry(FIGURES), name).not.toMatch(/undefined|NaN/);
      }
    });
  });

  describe('no number is typed into a sentence', () => {
    test('digits arrive as figures, never as text', () => {
      for (const file of readdirSync(WORDS).filter((f) => f.endsWith('.js'))) {
        for (const lit of literals(readFileSync(join(WORDS, file), 'utf8'))) {
          expect(outsideInterpolation(lit), `${file}: ${lit}`).not.toMatch(/\d/);
        }
      }
    });
  });

  describe('a moved card draws, and no longer writes', () => {
    test('renderReturns holds no sentence of its own', () => {
      const src = readFileSync(fileURLToPath(new URL('../ui/dashboard.js', import.meta.url)), 'utf8');
      const start = src.indexOf('function renderReturns(');
      const body = src.slice(start, src.indexOf('\nfunction ', start + 1));
      for (const lit of literals(body)) {
        const words = outsideInterpolation(lit).slice(1, -1).trim().split(/\s+/).filter(Boolean);
        expect(words.length, lit).toBeLessThan(3);
      }
    });
  });
  ```

- [ ] **Step 3: Run them and watch them fail.**
  Run: `npx vitest run tests/words.test.js`
  Expected: FAIL, "Failed to load url ../ui/words/line.js".

- [ ] **Step 4: Write `ui/words/line.js` and `ui/guide/chapters.js`.**

  ```js
  // ui/words/line.js
  /** The kinds of sentence the screen may carry. A concept is a guide chapter. */
  export const KINDS = Object.freeze(['reading', 'disclosure', 'instruction', 'label']);

  export function line(kind, text, { why = null } = {}) {
    if (kind === 'concept') throw new TypeError('a concept is a guide chapter, never a line on screen');
    if (!KINDS.includes(kind)) throw new TypeError(`unknown kind "${kind}"`);
    if (kind === 'disclosure' && !why) throw new TypeError('a disclosure must say why: name a guide chapter');
    const say = typeof text === 'function' ? text : () => text;
    const entry = (figures = {}) => say(figures);
    entry.kind = kind;
    entry.why = why;
    return Object.freeze(entry);
  }
  ```

  ```js
  // ui/guide/chapters.js — titles only until Task 2 writes the chapters
  export const CHAPTERS = Object.freeze({
    attributionLag: Object.freeze({ title: 'Why this week’s numbers keep moving' }),
    returnsSplit: Object.freeze({ title: 'Refused at the door, or sent back' }),
    cashOnDelivery: Object.freeze({ title: 'Cash on delivery, and where you advertise' }),
  });
  ```

  Each file gets a header comment in the style of `ui/save.js`: why it exists,
  and the rule it enforces.

- [ ] **Step 5: Write `ui/words/returns.js`**, moving every sentence and label
  out of `renderReturns` verbatim. The one intended change is the typed "five",
  which becomes `${settlesAfter}`:

  ```js
  import { line } from './line.js';

  export const RETURNS = Object.freeze({
    nothingSettled: line('reading', ({ settlesAfter, firstHonestWeek }) =>
      `Nothing has settled yet. A click is final about ${settlesAfter} weeks `
      + `after it happens, so the first honest reading of this card is week ${firstHonestWeek}.`,
    { why: 'attributionLag' }),
    cameBack: line('label', 'Came back'),
    cameBackSub: line('label', ({ returned, orders }) => `${returned} of ${orders} orders`),
    refused: line('label', 'Refused'),
    refusedSub: line('label', ({ refused }) => `${refused} never delivered`),
    sentBack: line('label', 'Sent back'),
    sentBackSub: line('label', ({ sentBack }) => `${sentBack} after delivery`),
    freight: line('label', 'Freight paid'),
    freightSub: line('label', ({ perParcel }) => `${perParcel} a parcel, every week`),
    paidAtDoor: line('label', 'Paid at door', { why: 'cashOnDelivery' }),
    paidAtDoorSub: line('label', 'across where you actually advertise'),
    week: line('label', ({ round }) => `Week ${round}`),
    stillIn: line('label', 'still in'),
    keyRefused: line('label', 'refused at the door', { why: 'returnsSplit' }),
    keySentBack: line('label', 'sent back after delivery'),
    refusalCost: line('reading', ({ perRefusal }) => `Every refusal costs you about ${perRefusal}`),
    refusalCostParts: line('reading', ({ freight, margin }) =>
      `— ${freight} of freight both ways, and ${margin} of margin on a sale that never happened.`),
    leversHead: line('instruction', 'Three things move it, and two of them this week.'),
    levers: line('instruction',
      'Bid less where cash on delivery is commonest — the location card is the same '
      + 'decision seen from the other side, and it is open every round. Block a search '
      + 'that comes back worse than the rest of your account; the search terms card '
      + 'marks them and the button is on the row.'),
    capitalOpen: line('instruction',
      'And capital is open THIS round: order confirmation reaches refusals, the size '
      + 'guide reaches send-backs, and neither reaches the other.'),
    capitalShut: line('instruction', ({ window }) =>
      `Capital is the third and it is shut — it opens only ${window}, so the first two are what you have now.`),
    countedWeeks: line('reading', ({ first, last }) =>
      `Only weeks ${first} to ${last} are counted above; the rest are still arriving `
      + 'and will read better than they are.', { why: 'attributionLag' }),
  });
  ```

- [ ] **Step 6: Change `renderReturns` to ask for words.** Replace each literal
  with its entry, keeping the spaces between text nodes exactly as they were:
  `strong(refusalCost)`, then `" " + refusalCostParts + " "`, then
  `strong(leversHead + " ")`, then `levers + " " + (capitalOpen or capitalShut)`,
  then `" " + countedWeeks`. `countedWeeks` takes `first: settled[0].round` and
  `last: latest - SETTLES_AFTER_ROUNDS`, rather than a typed 1. Import `RETURNS`
  from `./words/returns.js`.

- [ ] **Step 7: Make `tests/ui.test.js` read `ui/` recursively.** Replace the
  flat `readdirSync(UI)` with `readdirSync(UI, { recursive: true })`, keeping
  `.js` files and joining paths with `/`. Add `'words/line.js'`,
  `'words/returns.js'` and `'guide/chapters.js'` to `LOADABLE`. Its
  completeness test compares against the same recursive list.

- [ ] **Step 8: Run the tests and watch them pass.**
  Run: `npx vitest run tests/words.test.js tests/ui.test.js`, then `npm test`.
  Expected: all green. Then break one rule on purpose (type a digit into a
  `returns.js` string, then put a sentence back into `renderReturns`) and
  confirm each is caught, then restore.

- [ ] **Step 9: Compare the card word for word.** On the same dev server, clear
  the save, play the same round 0 and weeks, and compare each week's text with
  its `probe:returns:N`. Expected: identical, except "about five weeks" now reads
  "about 5 weeks". Any other difference is a bug in step 6. A digit that
  disagrees with what was typed is a false sentence found: stop and report it.

- [ ] **Step 10: Update the published file count** in CLAUDE.md, HANDOVER
  (*Deployment* and the build-order note) and `wrangler.jsonc`, from what
  `npm run build` prints. `chapters.js` is not imported by the game yet, so it is
  not published.

- [ ] **Step 11: Commit** (local only): the new modules, `ui/dashboard.js`, both
  test files and the docs, as one commit about moving the returns card's words.

### Task 2: the three chapters (C2 content)

**Files:** Modify `ui/guide/chapters.js`; create `tests/guide.test.js`.

**Interfaces produced:** `chapter({ title, real, realSources, device, needs,
game, cites, yourAccount, related })` returns a frozen chapter. `real` and
`game` are `(figures) => string`. `CHAPTERS` keeps its three ids.

- [ ] **Step 1: Write the failing tests** in `tests/guide.test.js`, one per spec
  test (spec section 4, tests 1-7):
  - title, real and game present, each part at most 120 words when rendered
    with `GUIDE_FIGURES`;
  - every `cites` entry found: `### ID.` in `DECISIONS.md`, `H1`-`H10` as
    numbered items under `## H.`, `§N.N` as a heading in `ENGINE_SPEC_v0.3.md`;
  - `realSources` non-empty with `https://` URLs unless `device: true`;
  - no digit in any title or game-part literal outside `${}` (the same scan as
    `tests/words.test.js`);
  - every `yourAccount` is a `data-slot` in `ui/index.html`; every `why` in
    `ui/words/*.js` is a chapter id;
  - every chapter is the target of some `why` or listed in `CONTENTS`;
  - rendered with `GUIDE_FIGURES`, no `undefined` or `NaN`, and every `needs`
    name is a key of `GUIDE_FIGURES`.

  `GUIDE_FIGURES` is exported from `ui/guide/chapters.js` as the list of figure
  names the dashboard will supply, with sample values for the test.

- [ ] **Step 2: Run them and watch them fail** (`npx vitest run tests/guide.test.js`).

- [ ] **Step 3: Draft each chapter.** For the real part, fetch sources at the time
  (Google Ads Help first), and write only what they say. For the game part, read
  the cited DECISIONS entries and spec sections, and say what the model does.
  Expected citations: attribution lag, I27, §11.3, §11.4; returns split, I28,
  F14; cash on delivery, G4. Confirm each while drafting.

- [ ] **Step 4: Run the tests and watch them pass**, then `npm test`.

- [ ] **Step 5: Owner review.** Show the three chapters as rendered text. The
  owner judges whether a learner would follow them. Revise until approved.

- [ ] **Step 6: Commit** (local only).

### Task 3: mock-ups of how the guide opens

- [ ] **Step 1:** With the `design` skill, make one canvas with three artboards:
  A (side drawer with a contents list), B (unfolds in the card), C (guide page).
  Each shows the returns card at week 6, using figures from the replayed game in
  Task 1 and the approved chapters from Task 2.
- [ ] **Step 2:** The owner picks a direction. A phone-width artboard of the
  chosen direction follows.
- [ ] **Step 3:** Record the choice and its reasons at the end of the spec.

### Task 4: the guide on screen (C2 interface)

**Gate:** this task's code is planned in an addendum to this file **after Task 3**,
because its structure depends on the chosen direction. Direction-independent
requirements, from spec section 5:
- a "why?" link after every entry with a `why` on the returns card; concept
  sentences leave the card as their chapters take them;
- a dialog (`role="dialog"`, labelled by the chapter title); focus moves in on
  open, Esc closes, focus returns to the "why?";
- "In your account" closes the guide, scrolls to the card and marks it briefly;
- the container is a `.card` whose `h2` is the chapter title, so
  `ui/recorder.js` times it;
- one entrance transition: 220ms, `cubic-bezier(0.23, 1, 0.32, 1)`, transform
  and opacity; about 150ms exit; opacity only under reduced motion;
  `review-animations` passes on the diff;
- verified by playing to week 7 and opening every link by mouse and by keyboard.

### Task 4 addendum: the side drawer (planned 2026-09-12, after direction A was chosen)

**Scope.** The drawer, its header button, and the returns card's three "why?"
links. No other card changes: the other cards move into the content model in C4.
Nothing leaves the returns card, because none of its sentences is a concept; the
chapters add depth beside it.

**Files:**
- Create `ui/guide/drawer.js`: `guideView(id, figures)` (pure) and
  `createGuide({ figures, root })` (the DOM).
- Modify `ui/dashboard.js`: `renderDashboard(game, onDecisionChange, { openGuide })`,
  and `renderReturns` appends a "why?" button to the Paid at door label, the
  legend and the counted-weeks sentence, each opening its entry's `why`.
- Modify `ui/app.js`: create the guide once and append it to `document.body`,
  outside `#app`, so a re-render never removes it; pass `openGuide` to the
  dashboard; wire the header button.
- Modify `ui/index.html`: a `Field guide` ghost button in the header, hidden until a
  game exists.
- Modify `ui/style.css`: the drawer, the "why?" button, the phone layout under
  620px, the motion, and `.guide[hidden] { display: none; }`. The page has no
  general `[hidden]` rule, so a drawer styled `display: flex` would otherwise stay
  on screen when closed.
- Create `tests/drawer.test.js`; add `guide/drawer.js` to `LOADABLE` in
  `tests/ui.test.js`.

**The pure part, tested first:** `guideView(id, figures)` returns
`{ id, title, real, sources, game, yourAccount, next }`, with `next` as
`{ id, title }` from `CONTENTS` order, or `null` for the last chapter. Tests:
- every chapter's view renders with `guideFigures()` and no `undefined`;
- `next` follows the contents order, and the last chapter has none;
- an unknown id throws, rather than opening an empty drawer;
- sources come through as label and link, and the view carries no DECISIONS
  citation, because players see sources and never ledger ids (spec section 9).

**The DOM part, checked by playing** (the suite has no browser; `app.js` is
checked the same way):
- The drawer is an `aside` with `role="dialog"`, `aria-modal="false"` (the
  dashboard stays usable beside it) and `aria-labelledby` pointing at its `h2`,
  which is the chapter title. It has the class `card`, so `ui/recorder.js` times
  it and names clicks inside it by chapter.
- Opening focuses the `h2` (tabindex -1). Esc or the close button closes it, and
  focus returns to whatever opened it. Contents lists `CONTENTS` in order.
- "Show me on the card" closes the drawer, scrolls `[data-slot=<yourAccount>]`
  into view, and adds a `guide-marked` outline, removed on the next pointer or key
  press.
- "Why?" is a `<button>` styled as a link, because it performs an action rather
  than going to a page.
- Sources open in a new tab (`target="_blank" rel="noopener"`).
- Below 620px wide, the drawer is full screen with the pinned bottom bar from the
  phone mock-up; every control is at least 44px tall there.

**Motion, the only motion in this task:**
- enter: `transform: translateX(100%)` to `none`, opacity 0 to 1, 220ms,
  `cubic-bezier(0.23, 1, 0.32, 1)`, using `@starting-style` and
  `transition-behavior: allow-discrete`, so there is no library and no timer;
- exit: 150ms, `ease-in`;
- reduced motion: opacity only, 150ms;
- the `guide-marked` outline fades out over 200ms and does not pulse.
- `review-animations` is run on the diff before committing; anything it flags is
  fixed or argued.

**Verification, by playing on the dev server:**
1. Play to week 7 and open all three "why?" links by mouse.
2. Do the same by keyboard only: Tab to the link, Enter, then Esc returns focus.
3. Open the contents from the header, and use "Next" through all three chapters.
4. Use "Show me on the card".
5. Check the phone preset.
6. Check the console for errors, and that a closed drawer takes no clicks or card
   time in the playtest recorder.
7. Take screenshots of desktop and phone.

**Commits, local only:** the pure view with its tests; then the drawer, links and
styles together, since none of them works without the others.

### Task 5: documentation

- [ ] HANDOVER *Start here*: what C1 and C2 built and where the guide is.
- [ ] CLAUDE.md *Known traps*: the citation line from spec section 7.
- [ ] The published file count again, if Task 4 changed it.
- [ ] Commit (local only).
