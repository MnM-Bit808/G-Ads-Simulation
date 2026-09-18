# The Studio makeover, pilot: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans
> (inline, the owner's choice for this project) task by task. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** the sidebar layout, the Red signal look and its kit, and a complete
*Your keywords* section, running behind `?look=studio` while the classic game
stays exactly as it is.

**Architecture:** `?look=studio` sets `body.studio`. The shell draws the icon
strip, the section list, one section at a time and the tray. **Today's cards are
shown, never moved:** the dashboard is drawn as the classic look draws it, and a
section is a stylesheet filter over it, because the decision form redraws its
cards into its own region on every change. *Your keywords* is new: pure reading
in `ui/keywords/read.js`, drawing in `ui/keywords/render.js`, words in
`ui/words/keywords.js`, changes through the form's own `updateKeyword`,
`addKeyword` and `removeKeyword`.

**Tech stack:** ES modules, no bundler, no framework; Vitest; ESLint; CSS with
`@starting-style` for motion.

**Spec:** `plans/2026-09-13-studio-makeover.md`. Read it first, all of it. The
working mock-up is `design/makeover/Main.dc.html` (canvas
https://claude.ai/code/artifact/d881fe56-251c-4ded-9173-b8616924bbc4).

## Amended by the round 0 plan (2026-09-14)

Round 0 was rebuilt in the Studio look between this plan's Tasks 6 and 7
(`plans/2026-09-14-round-zero-redesign-plan.md`), and on the way it built the
keyword card, the planner drawer and the kit's controls that Tasks 7 to 9 here
were to write. Read those tasks with these changes:

- **Task 6** was built before round 0 (`f75a3a3`): the keyword card opens its
  chapter from the *QS* button.
- **Task 7:** `SLIDER_FLOOR_PAISE`, `SLIDER_HEADROOM`, `SLIDER_STEP_PAISE` and
  `sliderMaxPaise` live in `ui/kit/card.js`; import them from there instead of
  defining them in `ui/keywords/read.js`. `ui/words/keywords.js` exists, so
  Task 7 adds only the weekly lines, and `KEYWORDS.isNew` reads "new: no clicks
  yet".
- **Task 8:** Step 3 is done: `ui/kit/controls.js` holds `icon`, `button`,
  `pills`, `toggle`, `stat`, `slider` and `typeIn`, and the shell imports
  `icon` and `button` from it. Step 2's drawing guard already lists the kit, so
  it adds only `ui/keywords/render.js`. Step 4 draws each card with the kit's
  `keywordCard` (`ui/kit/card.js`), adding the weekly parts to it (the running
  switch, *was*, the checkbox, the changed and paused outlines) rather than
  drawing its own, and opens the drawer with the kit's `openPlanner`
  (`ui/kit/planner.js`). Step 6 appends only the section's own rules (`khead`,
  `kpanel`, `klever`, `kbar`, `klegend`, `kcheck`, `kbulk`, `kswitch`,
  `kadjust`, and the card's changed, paused and selected states); the card,
  pills, slider, menu, planner and text box are styled already.
- **Task 9:** the press, the planner drawer's entrance and exit, the menu's
  grow and round 0's step transition are in the motion block at the end of
  `ui/studio.css`, reduced motion included. Task 9 adds only the tray's chips,
  the switch's knob, the section dot and a section's first visit, and does not
  declare the others twice. **Keep the chip entrance to the weekly tray**
  (`body.studio .studio-tray:not(.r0-tray) .studio-chip`): round 0 redraws its
  tray's *So far* chips on every change, so an entrance there would replay
  under every drag of a bid.
- **Task 11:** CLAUDE.md and HANDOVER already give `makeover`'s file count (80
  at the end of round 0); `wrangler.jsonc`'s comment still says 54, for the
  switch-over to change.

## Global constraints

- Branch `makeover`, cut from `main`. Commit after each green `npm test`, one
  concern per commit, reasoning in the message. **Push only when the owner says.**
- CLAUDE.md applies, hard rules included. **No file in `engine/` changes.** Money
  is integer paise; format only with `rupees`, `whole`, `pct` from `ui/dom.js`.
- **No module under `ui/` touches `document` or `window` while it loads.**
  `tests/build.test.js` imports every module in Node; only `ui/app.js` is exempt.
- **Every new `ui/` module is added to `LOADABLE` in `tests/ui.test.js`** (the
  test fails until it is), and no `ui/` file may name `homeCell`, `businessFor`,
  the withheld query fields or the forbidden constants that test lists.
- **Every sentence on screen is a `line` in `ui/words/`**, of a kind; no digit is
  typed in a words file (figures come in); new drawing modules hold no sentence.
- **Red signal** (spec section 3): red `#D7262F` means *you and your changes*;
  warnings and money lost are amber `#F2A53A` with a minus sign; small red text
  is `#FF6166`; every text colour passes 4.5:1.
- **Motion:** only the six approved moments; transform and opacity; curve
  `cubic-bezier(0.23, 1, 0.32, 1)`; under 300ms; reduced motion keeps the fades
  and drops movement, press and stagger; no counting tickers; no library;
  sections switch instantly.
- **A control shows only what the game computes.** No forecasts.
- **Without `?look=studio` the game is unchanged.** Play a classic week after
  every task that touches `app.js`, `index.html` or a shared module.
- Display bounds kept in the view cite DECISIONS I6 in a comment.
- **Any download needs the owner's yes first**, with names and sizes.
- Edit files with the Edit tool; shell heredocs only for commit messages.

## File map

| file | task | job |
|---|---|---|
| `ui/look.js`, `tests/look.test.js` | 1 | `lookMode`, `LOOK_KEY` |
| `ui/studio.css` | 1, 2, 5, 8, 9 | the look: tokens and re-theme (1), fonts (2), shell (5), keywords (8), motion (9) |
| `ui/index.html`, `ui/app.js` | 1, 2, 5 | the stylesheet and licence links; the switch; the shell wired in |
| `ui/fonts/*.woff2`, `ui/fonts/OFL-*.txt` | 2 | the two families, and their licences |
| `scripts/build-site.js`, `dev-server.js`, `tests/build.test.js` | 2 | follow `url()` in a stylesheet; serve fonts and text |
| `ui/shell/sections.js`, `tests/sections.test.js` | 3, 8 | areas, sections, their cards, locks and dots, the filter rules |
| `ui/decisions.js`, `ui/chart.js` | 3, 4 | a slot on every form card and the chart; an id on every change |
| `ui/shell/tray.js`, `tests/tray.test.js` | 4 | the tray's lines, oldest first |
| `ui/words/shell.js`, `ui/shell/shell.js` | 5 | the layout drawn |
| `ui/dashboard.js`, `ui/guide/drawer.js`, `ui/recorder.js` | 5 | `onContext`; `reveal`; named regions |
| `ui/guide/chapters.js` | 6 | the chapter *What the Quality Score is, and is not* |
| `ui/keywords/read.js`, `ui/words/keywords.js`, `tests/keywords.test.js` | 7 | the cards' model, the panel, adjust several; their words |
| `ui/kit/controls.js`, `ui/keywords/render.js` | 8 | the kit; the section drawn |
| `tests/words.test.js`, `tests/ui.test.js` | 1, 3-8 | the words and the loader map, as each module lands |
| docs | 11 | HANDOVER, CLAUDE.md, the spec's corrections |

---

### Task 1: the switch and the palette

**Files:** create `ui/look.js`, `ui/studio.css`, `tests/look.test.js`; modify
`ui/index.html`, `ui/app.js`, `tests/ui.test.js`.

**Interfaces produced:** `LOOK_KEY = 'g-ads-simulation:look'`;
`lookMode(search: string, storage: Storage|null) → 'classic'|'studio'`; the
class `studio` on `<body>` in studio mode; the CSS custom properties
`--studio-*` on `body.studio`.

- [ ] **Step 0:** `git switch -c makeover`.

- [ ] **Step 1: Write the failing test,** `tests/look.test.js`:

  ```js
  import { describe, test, expect } from 'vitest';
  import { lookMode, LOOK_KEY } from '../ui/look.js';

  const memory = () => {
    const store = new Map();
    return {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: (k) => { store.delete(k); },
    };
  };
  const refusing = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); },
  };

  describe('which look a visit runs in', () => {
    test('everyone gets today\'s screens unless they ask', () => {
      expect(lookMode('', memory())).toBe('classic');
      expect(lookMode('', null)).toBe('classic');
    });

    test('the link turns the studio on, and the browser remembers it', () => {
      const storage = memory();
      expect(lookMode('?look=studio', storage)).toBe('studio');
      expect(storage.getItem(LOOK_KEY)).toBe('studio');
      expect(lookMode('', storage)).toBe('studio');
    });

    test('?look=classic turns it off again', () => {
      const storage = memory();
      lookMode('?look=studio', storage);
      expect(lookMode('?look=classic', storage)).toBe('classic');
      expect(lookMode('', storage)).toBe('classic');
    });

    test('it rides alongside the playtest link', () => {
      expect(lookMode('?playtest=1&look=studio', memory())).toBe('studio');
    });

    test('an unknown value changes nothing', () => {
      const storage = memory();
      lookMode('?look=studio', storage);
      expect(lookMode('?look=neon', storage)).toBe('studio');
    });

    test('a browser that refuses storage still honours the link', () => {
      expect(lookMode('?look=studio', refusing)).toBe('studio');
      expect(lookMode('', refusing)).toBe('classic');
    });
  });
  ```

- [ ] **Step 2: Watch it fail.** `npx vitest run tests/look.test.js`. Expected:
  FAIL, cannot find `../ui/look.js`.

- [ ] **Step 3: Write `ui/look.js`:**

  ```js
  /**
   * Which look a visit runs in (plans/2026-09-13-studio-makeover.md, section 5).
   *
   * The Studio makeover is built beside today's screens, not over them: the link
   * `?look=studio` turns it on and this browser remembers it, the way the
   * playtest link is remembered (ui/recorder.js, `playtestMode`); `?look=classic`
   * turns it off. Everyone else gets today's game, unchanged, until the
   * switch-over retires the classic look.
   */

  export const LOOK_KEY = 'g-ads-simulation:look';

  /**
   * @param {string} search - `location.search`
   * @param {Storage|null} storage
   * @returns {'classic'|'studio'}
   */
  export function lookMode(search, storage) {
    const asked = new URLSearchParams(search).get('look');
    try {
      if (asked === 'studio') {
        storage?.setItem(LOOK_KEY, 'studio');
        return 'studio';
      }
      if (asked === 'classic') {
        storage?.removeItem(LOOK_KEY);
        return 'classic';
      }
      return storage?.getItem(LOOK_KEY) === 'studio' ? 'studio' : 'classic';
    } catch {
      // A browser that will not store the choice still came in on the link.
      return asked === 'studio' ? 'studio' : 'classic';
    }
  }
  ```

- [ ] **Step 4:** add `'look.js': () => import('../ui/look.js'),` to `LOADABLE` in
  `tests/ui.test.js`. Run `npx vitest run tests/look.test.js tests/ui.test.js`.
  Expected: PASS.

- [ ] **Step 5: Wire the switch into `ui/app.js`.** Import it beside the other
  local imports:

  ```js
  import { lookMode } from './look.js';
  ```

  and directly after the `storage` constant is defined:

  ```js
  /**
   * The Studio makeover, on the link only (plans/2026-09-13-studio-makeover.md).
   * `body.studio` is all it sets here; ui/studio.css scopes every rule under it.
   */
  const look = lookMode(window.location.search, storage);
  if (look === 'studio') document.body.classList.add('studio');
  ```

- [ ] **Step 6: Link the stylesheet** in `ui/index.html`, after `style.css`:

  ```html
  <link rel="stylesheet" href="./studio.css">
  ```

- [ ] **Step 7: Write `ui/studio.css`** with the tokens and the re-theme of
  today's cards. Everything is under `body.studio`:

  ```css
  /*
   * The Studio makeover's look (plans/2026-09-13-studio-makeover.md, section 3):
   * Studio drop's cards and type in the Red signal palette. Every rule is under
   * body.studio, so a visit without ?look=studio never sees any of it.
   */

  body.studio {
    --studio-page: #0D0C0E;
    --studio-rail: #060507;
    --studio-sidebar: #131215;
    --studio-card: #17161A;
    --studio-raised: #221F25;
    --studio-line: #2A272D;
    --studio-line-strong: #3A363E;
    --studio-text: #EDE8E3;
    --studio-soft: #CFC9C3;
    --studio-muted: #A19A94;
    --studio-faint: #8A847E;
    --studio-red: #D7262F;
    --studio-red-text: #FF6166;
    --studio-on-red: #FFF5F4;
    --studio-amber: #F2A53A;
    --studio-mint: #9FD3B5;
    --studio-panel: #1A0C0F;
    --studio-panel-edge: #4A1A1F;
    --studio-display: 'Bricolage Grotesque', 'Avenir Next', 'Segoe UI', sans-serif;
    --studio-body: 'Instrument Sans', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    --studio-ease: cubic-bezier(0.23, 1, 0.32, 1);

    /* Today's cards read these names. Restating them re-themes every card that
       has not been rebuilt yet, with no change to style.css. Losses are amber:
       red is the player's colour in Red signal, so it cannot also mean "bad". */
    --bg: var(--studio-page);
    --panel: var(--studio-card);
    --panel-2: var(--studio-raised);
    --line: var(--studio-line);
    --ink: var(--studio-text);
    --muted: var(--studio-muted);
    --accent: var(--studio-red);
    --good: var(--studio-mint);
    --warn: var(--studio-amber);
    --bad: var(--studio-amber);

    background: var(--studio-page);
    color: var(--studio-text);
    font-family: var(--studio-body);
  }

  /* style.css writes near-black text on every filled button, which on red falls
     under 4.5:1. Link-like buttons keep a light colour of their own. */
  body.studio button { color: var(--studio-on-red); }
  body.studio button.ghost,
  body.studio button.guess-cell { color: var(--studio-text); }
  body.studio button.add,
  body.studio button.why,
  body.studio button.guide-next { color: var(--studio-red-text); }
  body.studio button.add.danger { color: var(--studio-amber); }
  body.studio button.guess-cell[aria-pressed="true"] { color: var(--studio-on-red); }
  body.studio button:focus-visible,
  body.studio input:focus-visible { outline: 2px solid var(--studio-red-text); outline-offset: 2px; }
  ```

- [ ] **Step 8: Play both looks.** `npm run dev`, then:
  - `http://localhost:5173/ui/` plays a week exactly as before (classic);
  - `http://localhost:5173/ui/?look=studio`: round 0 and the dashboard are in
    Red signal colours. Open every card and check that every button's text is
    readable. Any that is not gets a scoped `body.studio` rule, never a change to
    `style.css`;
  - `?look=classic` brings the old colours back, and a reload stays classic.

- [ ] **Step 9:** `npm test` (green), `npm run build` (note the new count).
  Commit: *Turn the Studio look on with ?look=studio, in Red signal colours*.

---

### Task 2: the fonts, stored with the game

**Files:** create `ui/fonts/` (four `.woff2` files, two licence texts); modify
`ui/studio.css`, `ui/index.html`, `scripts/build-site.js`, `dev-server.js`,
`tests/build.test.js`.

**Interfaces produced:** `siteFiles` follows `url()` inside any stylesheet it
reaches, skipping `data:` and absolute addresses; the families
`'Bricolage Grotesque'` and `'Instrument Sans'` are available to `body.studio`.

- [ ] **Step 1: Find the files, then ask.** Fetch the stylesheet Google Fonts
  serves for the pair, with a modern browser's user agent:
  `https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,200..800&family=Instrument+Sans:wght@400..700&display=swap`.
  From it, take the `latin` and `latin-ext` blocks of each family. `latin-ext`
  carries ₹, U+20B9, which `latin` does not, and every money figure needs it.
  Note each file's URL, its `unicode-range` and its size (a `HEAD` request). Check
  that `https://raw.githubusercontent.com/google/fonts/main/ofl/bricolagegrotesque/OFL.txt`
  and `.../ofl/instrumentsans/OFL.txt` answer 200 (checked while planning: both
  4.4 KB). **Ask the owner** to approve downloading those six files, by name and
  size. Stop here without a yes.

- [ ] **Step 2: Download** into `ui/fonts/` as
  `bricolage-grotesque-latin.woff2`, `bricolage-grotesque-latin-ext.woff2`,
  `instrument-sans-latin.woff2`, `instrument-sans-latin-ext.woff2`,
  `OFL-bricolage-grotesque.txt`, `OFL-instrument-sans.txt`.

- [ ] **Step 3: Write the failing tests** in `tests/build.test.js`. First widen
  `RUNTIME` so fonts and their licences are allowed:

  ```js
  const RUNTIME = /^(ui|engine|content|agents)\/[^/]+\.(js|html|css)$|^ui\/[a-z]+\/[^/]+\.js$|^ui\/fonts\/[^/]+\.(woff2|txt)$|^(setup|game)\.js$/;
  ```

  Add to the list in *the page, its stylesheet, and both ends of the engine*:
  `'ui/studio.css', 'ui/fonts/OFL-bricolage-grotesque.txt'`. Then, in
  *the build refuses what a browser could not run*:

  ```js
  test('it follows the fonts a stylesheet names, and nothing inline or remote', () => {
    const root = fakeRoot('fonts', '');
    writeFileSync(join(root, 'ui/index.html'),
      '<link rel="stylesheet" href="./look.css"><script type="module" src="./app.js"></script>');
    writeFileSync(join(root, 'ui/look.css'),
      "@font-face { src: url('./fonts/a.woff2') format('woff2'); }\n"
      + '.x { background: url(data:image/png;base64,AAAA); }\n'
      + ".y { background: url('https://example.com/b.png'); }\n");
    mkdirSync(join(root, 'ui/fonts'), { recursive: true });
    writeFileSync(join(root, 'ui/fonts/a.woff2'), 'x');
    const files = siteFiles(root);
    expect(files).toEqual(expect.arrayContaining(['ui/look.css', 'ui/fonts/a.woff2']));
    expect(files.some((f) => f.includes('example.com') || f.startsWith('data:'))).toBe(false);
  });

  test('and refuses a stylesheet naming a font that is not there', () => {
    const root = fakeRoot('font-missing', '');
    writeFileSync(join(root, 'ui/index.html'), '<link rel="stylesheet" href="./look.css">');
    writeFileSync(join(root, 'ui/look.css'), "@font-face { src: url('./fonts/gone.woff2'); }\n");
    expect(() => siteFiles(root)).toThrow(/gone\.woff2/);
  });
  ```

- [ ] **Step 4: Watch them fail.** `npx vitest run tests/build.test.js`. The first
  new test fails because `ui/fonts/a.woff2` is not followed; the second because
  nothing throws; the file list test fails on `ui/studio.css`'s licence until
  Step 6.

- [ ] **Step 5: Teach `siteFiles` stylesheets.** In `scripts/build-site.js`, beside
  `HTML_REF`:

  ```js
  // A stylesheet's own references: fonts, today. `data:` is inline and an
  // absolute address is somebody else's, so neither is a file to copy.
  const CSS_URL = /url\(\s*['"]?([^'")]+?)['"]?\s*\)/g;
  const NOT_A_FILE = /^(data:|https?:|\/\/)/;
  ```

  and in `visit`, replace `if (!absolute.endsWith('.js')) return;` with:

  ```js
      if (absolute.endsWith('.css')) {
        for (const match of readFileSync(absolute, 'utf8').matchAll(CSS_URL)) {
          const target = match[1].trim();
          if (!NOT_A_FILE.test(target)) visit(resolve(dirname(absolute), target), path);
        }
        return;
      }
      if (!absolute.endsWith('.js')) return;
  ```

- [ ] **Step 6: The faces and the licences.** Prepend to `ui/studio.css` four
  `@font-face` rules, one per downloaded file. This is the template; the one value
  in angle brackets is **copied exactly** from that file's block in Step 1's
  response, never typed from memory:

  ```css
  /* Stored with the game (spec section 3), under the SIL Open Font License,
     whose text ships beside them and is linked from index.html. */
  @font-face {
    font-family: 'Bricolage Grotesque';
    src: url('./fonts/bricolage-grotesque-latin.woff2') format('woff2');
    font-weight: 200 800;
    font-stretch: 75% 100%;
    font-display: swap;
    unicode-range: <the latin block's unicode-range>;
  }
  ```

  The `latin-ext` face is the same with its own file and range. Instrument Sans's
  two faces take `font-weight: 400 700` and no `font-stretch`.
  In `ui/index.html`, after the stylesheets:

  ```html
  <link rel="license" href="./fonts/OFL-bricolage-grotesque.txt">
  <link rel="license" href="./fonts/OFL-instrument-sans.txt">
  ```

  The build follows every `href`, so the licences are published with the fonts.

- [ ] **Step 7: Serve them locally** with the right types. In `dev-server.js`'s
  `TYPES`:

  ```js
    '.woff2': 'font/woff2',
    '.txt': 'text/plain; charset=utf-8',
  ```

- [ ] **Step 8: Watch it pass,** `npx vitest run tests/build.test.js`; then `npm test`;
  `npm run build` and check `dist/ui/fonts/` holds all six. On the dev server with
  `?look=studio`, open the network panel: the fonts load from `/ui/fonts/`, and
  nothing goes to `fonts.googleapis.com`. Commit: *Store the two typefaces with
  the game, and publish their licences*.

---

### Task 3: sections, and which cards each one shows

**Files:** create `ui/shell/sections.js`, `tests/sections.test.js`; modify
`ui/decisions.js`, `ui/chart.js`, `tests/ui.test.js`.

**Interfaces produced:**
- `ICON_BOX = '0 0 24 24'`; `ICONS` (path lists by name).
- `AREAS: {key, label, title, icon}[]`, keys `brand`, `market`, `guide`, `results`.
- `SECTIONS: {key, area, label, icon, slots: string[], draws?: string[], opensAt?: number}[]`.
- `RETIRED_SLOTS: string[]`: cards the new screens draw instead.
- `sectionOf(slot) → section|null`; `sectionsIn(area) → section[]`.
- `sectionState(section, {played, seen, windowOpen}) → {locked, opensAt, fresh, seenKey}`.
- `visibilityRules(scope = 'body.studio .studio-cards') → string`, a stylesheet.
- Every form card carries `dataset.slot`: `next`, `window`, `bidding`, `split`,
  `prepaid`, `hours`, `negatives`, `keywords`; the trends chart carries `trends`.

- [ ] **Step 1: Write the failing test,** `tests/sections.test.js`:

  ```js
  import { describe, test, expect } from 'vitest';
  import { readFileSync } from 'node:fs';
  import { fileURLToPath } from 'node:url';
  import {
    AREAS, SECTIONS, RETIRED_SLOTS, sectionOf, sectionsIn, sectionState, visibilityRules,
  } from '../ui/shell/sections.js';
  import { CHAPTERS } from '../ui/guide/chapters.js';
  import { SETTLES_AFTER_ROUNDS } from '../ui/dashboard.js';
  import { TOTAL_ROUNDS } from '../engine/constants.js';

  const read = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');

  // Every card today's page draws, by the slot it carries: the page's own
  // articles, the decision form's cards and the trends chart.
  const CARD_SLOTS = [
    ...[...read('ui/index.html').matchAll(/<article class="card[^"]*" data-slot="([^"]+)"/g)].map((m) => m[1]),
    ...[...read('ui/decisions.js').matchAll(/dataset\.slot = '([^']+)'/g)].map((m) => m[1]),
    ...[...read('ui/chart.js').matchAll(/dataset\.slot = '([^']+)'/g)].map((m) => m[1]),
  ];

  describe('every card on today\'s page has one place in the new layout', () => {
    test('all nineteen are found, each once', () => {
      expect(CARD_SLOTS).toHaveLength(19);
      expect(new Set(CARD_SLOTS).size).toBe(19);
    });

    test.each(CARD_SLOTS)('%s sits in exactly one section, or is retired', (slot) => {
      const homes = SECTIONS.filter((s) => s.slots.includes(slot)).length;
      expect(homes + (RETIRED_SLOTS.includes(slot) ? 1 : 0), slot).toBe(1);
    });

    test('no section names a card that does not exist', () => {
      for (const s of SECTIONS) {
        for (const slot of s.slots) expect(CARD_SLOTS, `${s.key}: ${slot}`).toContain(slot);
      }
    });

    // CLAUDE.md's trap: "show me on the card" must land on something that exists.
    test.each(Object.entries(CHAPTERS))('the guide\'s %s can open the section holding its card', (_, c) => {
      expect(sectionOf(c.yourAccount), c.yourAccount).not.toBeNull();
    });
  });

  describe('a section opens when it has something true to say', () => {
    const find = (key) => SECTIONS.find((s) => s.key === key);

    test('Returns opens the week the first returns settle, not at a typed week', () => {
      const returns = find('returns');
      expect(returns.opensAt).toBe(SETTLES_AFTER_ROUNDS + 1);
      expect(sectionState(returns, { played: SETTLES_AFTER_ROUNDS, seen: {} }).locked).toBe(true);
      expect(sectionState(returns, { played: SETTLES_AFTER_ROUNDS + 1, seen: {} }))
        .toMatchObject({ locked: false, fresh: true });
    });

    test('its dot goes once it has been opened', () => {
      const returns = find('returns');
      const at = { played: SETTLES_AFTER_ROUNDS + 1, seen: {} };
      const { seenKey } = sectionState(returns, at);
      expect(sectionState(returns, { ...at, seen: { [seenKey]: true } }).fresh).toBe(false);
    });

    test('Your money carries a dot in a week the capital window is open, until opened that week', () => {
      const money = find('money');
      expect(sectionState(money, { played: 4, seen: {}, windowOpen: false }).fresh).toBe(false);
      const open = sectionState(money, { played: 4, seen: {}, windowOpen: true });
      expect(open.fresh).toBe(true);
      expect(sectionState(money, { played: 4, seen: { [open.seenKey]: true }, windowOpen: true }).fresh)
        .toBe(false);
    });

    test('Results opens after the last week', () => {
      const results = find('results');
      expect(sectionState(results, { played: TOTAL_ROUNDS - 1, seen: {} }).locked).toBe(true);
      expect(sectionState(results, { played: TOTAL_ROUNDS, seen: {} }).locked).toBe(false);
    });

    test('every area but the guide has sections; the guide opens its drawer instead', () => {
      for (const area of AREAS) expect(sectionsIn(area.key).length > 0, area.key).toBe(area.key !== 'guide');
    });
  });

  describe('a section is a filter over today\'s page', () => {
    const css = visibilityRules();

    test('each section hides every other section\'s cards', () => {
      for (const s of SECTIONS.filter((x) => x.slots.length > 0)) {
        expect(css).toContain(`:not([data-section="${s.key}"])`);
        for (const slot of s.slots) expect(css).toContain(`[data-slot="${slot}"]`);
      }
    });

    test('retired cards are hidden in every section', () => {
      for (const slot of RETIRED_SLOTS) {
        expect(css).toMatch(new RegExp(`\\.studio-cards :is\\([^)]*\\[data-slot="${slot}"\\]`));
      }
    });
  });
  ```

- [ ] **Step 2: Watch it fail.** `npx vitest run tests/sections.test.js`: cannot
  find the module.

- [ ] **Step 3: Give every card a slot.** In `ui/decisions.js`, directly after the
  `const node = card(...)` line in each of `summaryCard`, `windowCard`,
  `prepaidCard`, `splitCard`, `negativesCard` and `keywordsCard`, add, in order:

  ```js
  node.dataset.slot = 'next';      // summaryCard
  node.dataset.slot = 'window';    // windowCard (after the whole card(...) call)
  node.dataset.slot = 'prepaid';   // prepaidCard
  node.dataset.slot = 'split';     // splitCard
  node.dataset.slot = 'negatives'; // negativesCard
  node.dataset.slot = 'keywords';  // keywordsCard
  ```

  In `ui/chart.js`, `renderTrends`, after `const node = el('article', 'card span-2');`:

  ```js
  // It replaces the page's `trends` placeholder, so it carries the slot on.
  node.dataset.slot = 'trends';
  ```

- [ ] **Step 4: Write `ui/shell/sections.js`:**

  ```js
  /**
   * The Studio layout's areas and sections, and which of today's cards each one
   * shows (plans/2026-09-13-studio-makeover.md, section 2). Pure: the shell draws
   * what this decides, and the rules can be tested without a browser.
   *
   * A section shows today's cards by their `data-slot`. Until a section is rebuilt
   * its cards are the classic ones, re-themed; `draws` names the slots a rebuilt
   * section draws itself, so the guide can still open it.
   */

  import { SETTLES_AFTER_ROUNDS } from '../dashboard.js';
  import { TOTAL_ROUNDS } from '../../engine/constants.js';

  /** Stroked paths on a 24-unit grid, the mock-up's own icons. */
  export const ICON_BOX = '0 0 24 24';
  export const ICONS = Object.freeze({
    brand: ['M6 7h12l-1 13H7L6 7z', 'M9 7a3 3 0 0 1 6 0'],
    market: ['M6 8a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', 'M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6',
      'M14.5 9a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0', 'M16 14.2c2.9.4 5 2.8 5 5.8'],
    guide: ['M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z', 'M4 19a2 2 0 0 1 2-2h13'],
    results: ['M8 4h8v5a4 4 0 0 1-8 0V4z', 'M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4', 'M12 13v4M9 20h6'],
    week: ['M5 20V11M11 20V5M17 20v-6M3 20h18'],
    keywords: ['M3 12V4h8l10 10-8 8L3 12z', 'M6 7.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0'],
    typed: ['M5 11a6 6 0 1 0 12 0a6 6 0 1 0 -12 0', 'M20 20l-4.5-4.5'],
    ad: ['M3 10v4h4l6 4V6L7 10H3z', 'M16.5 9a4 4 0 0 1 0 6'],
    money: ['M5 6h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z', 'M3 10h18M16 14.5h2'],
    where: ['M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z', 'M9.5 10a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0'],
    returns: ['M4 8l8-4 8 4v8l-8 4-8-4V8z', 'M4 8l8 4 8-4M12 12v8'],
    rivals: ['M7 7h12l-3-3', 'M17 17H5l3 3'],
    menu: ['M4 7h16M4 12h16M4 17h16'],
    close: ['M6 6l12 12M18 6L6 18'],
    file: ['M6 3h8l4 4v14H6z', 'M14 3v4h4'],
  });

  export const AREAS = Object.freeze([
    { key: 'brand', label: 'Brand', title: 'Your brand', icon: ICONS.brand },
    { key: 'market', label: 'Market', title: 'The market', icon: ICONS.market },
    { key: 'guide', label: 'Guide', title: 'Field guide', icon: ICONS.guide },
    { key: 'results', label: 'Results', title: 'Results', icon: ICONS.results },
  ]);

  export const SECTIONS = Object.freeze([
    { key: 'week', area: 'brand', label: 'Your week', icon: ICONS.week, slots: ['headline', 'share', 'revised'] },
    { key: 'keywords', area: 'brand', label: 'Your keywords', icon: ICONS.keywords, slots: ['keywords'] },
    { key: 'typed', area: 'brand', label: 'What people typed', icon: ICONS.typed, slots: ['terms', 'negatives'] },
    // Today's weekly screen has no ad card: the ad is written in round 0 and its
    // grades show in each keyword's Quality Score. The section says so.
    { key: 'ad', area: 'brand', label: 'Your ad', icon: ICONS.ad, slots: [] },
    { key: 'money', area: 'brand', label: 'Your money', icon: ICONS.money,
      slots: ['window', 'budget', 'split', 'bidding', 'deadline'] },
    { key: 'where', area: 'brand', label: 'Where and when', icon: ICONS.where, slots: ['places', 'hours'] },
    // Opens the week the first returns settle: the returns card's own rule
    // (ui/dashboard.js, SETTLES_AFTER_ROUNDS), never a typed week.
    { key: 'returns', area: 'brand', label: 'Returns', icon: ICONS.returns,
      slots: ['returns', 'prepaid'], opensAt: SETTLES_AFTER_ROUNDS + 1 },
    { key: 'rivals', area: 'market', label: 'Rivals', icon: ICONS.rivals, slots: ['insights', 'trends'] },
    { key: 'marketMoves', area: 'market', label: 'The market', icon: ICONS.market, slots: ['market'] },
    { key: 'results', area: 'results', label: 'After the last week', icon: ICONS.results,
      slots: [], opensAt: TOTAL_ROUNDS },
  ]);

  /** Cards the new screens draw instead: the tray replaces *Next week*. */
  export const RETIRED_SLOTS = Object.freeze(['next']);

  /** @returns {object|null} the section a card's slot lives in */
  export function sectionOf(slot) {
    return SECTIONS.find((s) => s.slots.includes(slot) || s.draws?.includes(slot)) ?? null;
  }

  /** @returns {object[]} an area's sections, in order */
  export function sectionsIn(area) {
    return SECTIONS.filter((s) => s.area === area);
  }

  /**
   * Whether a section can be opened, and whether it carries a dot.
   *
   * A dot marks something new, once: a section the week it unlocks, and Your
   * money in a week its capital window is open. `seenKey` names that occasion,
   * so opening it once clears that dot and no later one.
   *
   * @param {object} section
   * @param {{played: number, seen?: Record<string, boolean>, windowOpen?: boolean}} at
   * @returns {{locked: boolean, opensAt: number|null, fresh: boolean, seenKey: string|null}}
   */
  export function sectionState(section, { played, seen = {}, windowOpen = false }) {
    const opensAt = section.opensAt ?? null;
    const locked = opensAt !== null && played < opensAt;
    let seenKey = null;
    if (!locked && opensAt !== null) seenKey = `${section.key}:opened`;
    else if (section.key === 'money' && windowOpen) seenKey = `money:window:${played}`;
    return { locked, opensAt, fresh: seenKey !== null && !seen[seenKey], seenKey };
  }

  /**
   * The stylesheet that makes a section a filter over today's page: in each
   * section, every other section's cards and every retired card are hidden.
   *
   * @param {string} [scope] - the dashboard root, as the shell marks it
   * @returns {string}
   */
  export function visibilityRules(scope = 'body.studio .studio-cards') {
    const is = (slots) => `:is(${slots.map((slot) => `[data-slot="${slot}"]`).join(', ')})`;
    const rules = [`${scope} ${is(RETIRED_SLOTS)} { display: none !important; }`];
    for (const s of SECTIONS) {
      if (s.slots.length === 0) continue;
      rules.push(`${scope}:not([data-section="${s.key}"]) ${is(s.slots)} { display: none !important; }`);
    }
    return rules.join('\n');
  }
  ```

- [ ] **Step 5:** add `'shell/sections.js': () => import('../ui/shell/sections.js'),`
  to `LOADABLE`. Run `npx vitest run tests/sections.test.js tests/guide.test.js tests/ui.test.js`.
  Expected: PASS. Break one mapping on purpose (put `terms` in two sections) and
  confirm the test names it; put it back.

- [ ] **Step 6:** `npm test`; play one classic week, since `decisions.js` and
  `chart.js` changed. Commit: *Give every card a slot, and map each to one section*.

---

### Task 4: the tray's lines

**Files:** create `ui/shell/tray.js`, `tests/tray.test.js`; modify
`ui/decisions.js` (`changes`), `tests/ui.test.js`.

**Interfaces produced:**
- every row of `changes(draft)` carries `id: string`, stable while its figures
  move: `position`, `capital`, `budget:<index>`, `location:<index>`,
  `daypart:<index>`, `strategy`, `strategy-param`,
  `negative-added:<matchType>:<text>`, `negative-removed:<matchType>:<text>`,
  `keyword-removed:<id>`, `keyword-added:<id>`, `keyword-match:<id>`,
  `keyword-bid:<id>`, `keyword-active:<id>`.
- `trayLines(rows, previousOrder = []) → {lines: {id, text, detail, undo}[], order: string[]}`.

- [ ] **Step 1: Write the failing test,** `tests/tray.test.js`:

  ```js
  import { describe, test, expect } from 'vitest';
  import { getSelfView } from '../engine/insights.js';
  import { makeGameState, PLAYER_ID } from './fixtures/gameState.js';
  import { createDraft, changes, updateKeyword, removeKeyword, addNegative } from '../ui/decisions.js';
  import { trayLines } from '../ui/shell/tray.js';

  const draft = () => createDraft(getSelfView(makeGameState(), PLAYER_ID));

  describe('every change carries an id of its own', () => {
    test('no two rows share one', () => {
      const d = draft();
      const [a, b, c] = d.keywords;
      updateKeyword(d, a.id, { bidPaise: a.bidPaise + 500 });
      updateKeyword(d, a.id, { matchType: a.matchType === 'broad' ? 'phrase' : 'broad' });
      updateKeyword(d, b.id, { active: false });
      removeKeyword(d, c.id);
      addNegative(d, { text: 'free', matchType: 'broad' });
      const rows = changes(d);
      expect(rows).toHaveLength(5);
      for (const row of rows) expect(typeof row.id, row.label).toBe('string');
      expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    });

    test('a row keeps its id while its figures move', () => {
      const d = draft();
      const [a] = d.keywords;
      updateKeyword(d, a.id, { bidPaise: a.bidPaise + 500 });
      const first = changes(d)[0].id;
      updateKeyword(d, a.id, { bidPaise: a.bidPaise + 900 });
      expect(changes(d)[0].id).toBe(first);
    });
  });

  describe('the tray', () => {
    test('lines stay in the order their changes were first made', () => {
      const d = draft();
      const [a, b] = d.keywords;
      updateKeyword(d, b.id, { bidPaise: b.bidPaise + 100 });
      const first = trayLines(changes(d), []);
      updateKeyword(d, a.id, { bidPaise: a.bidPaise + 100 });
      const second = trayLines(changes(d), first.order);
      expect(second.lines.map((l) => l.id)).toEqual([`keyword-bid:${b.id}`, `keyword-bid:${a.id}`]);
    });

    test('a line whose figures change keeps its place and takes the new text', () => {
      const d = draft();
      const [a, b] = d.keywords;
      updateKeyword(d, a.id, { bidPaise: a.bidPaise + 100 });
      updateKeyword(d, b.id, { bidPaise: b.bidPaise + 100 });
      const before = trayLines(changes(d), []);
      updateKeyword(d, a.id, { bidPaise: a.bidPaise + 700 });
      const after = trayLines(changes(d), before.order);
      expect(after.order).toEqual(before.order);
      expect(after.lines[0].text).not.toBe(before.lines[0].text);
    });

    test('an undone change leaves, and the rest keep their order', () => {
      const d = draft();
      const [a, b, c] = d.keywords;
      for (const k of [a, b, c]) updateKeyword(d, k.id, { bidPaise: k.bidPaise + 100 });
      const before = trayLines(changes(d), []);
      before.lines[1].undo();
      const after = trayLines(changes(d), before.order);
      expect(after.lines.map((l) => l.id)).toEqual([before.lines[0].id, before.lines[2].id]);
    });

    test('a change with nothing to take back is listed without an undo', () => {
      const rows = [{ id: 'capital', kind: 'capital', label: 'Capital: nothing committed', detail: 'x', undo: null }];
      expect(trayLines(rows, []).lines[0].undo).toBeNull();
    });
  });
  ```

- [ ] **Step 2: Watch it fail** (`npx vitest run tests/tray.test.js`): no module,
  and `row.id` undefined.

- [ ] **Step 3: Add the ids to `changes()`** in `ui/decisions.js`, as the first
  property of each `rows.push({...})`, using the list in *Interfaces produced*:
  for example `id: 'position',` in the position row,
  ``id: `budget:${index}`,`` in the weekly budget row,
  ``id: `negative-added:${negative.matchType}:${negative.text}`,``,
  ``id: `keyword-bid:${keyword.id}`,``, and
  ``id: `keyword-active:${keyword.id}`,`` for both the paused and resumed rows.
  Update the JSDoc `@returns` to include `id: string`.

- [ ] **Step 4: Write `ui/shell/tray.js`:**

  ```js
  /**
   * The tray's lines (plans/2026-09-13-studio-makeover.md, section 2): every
   * change in the draft, from `changes(draft)`, oldest first.
   *
   * A line keeps the place it first appeared in. So a new change always lands at
   * the end, which is the one line the tray animates in, and a line whose figures
   * move mid-drag (₹33 → ₹25 → ₹20) never moves.
   */

  /**
   * @param {Array<{id: string, label: string, detail: string, undo: Function|null}>} rows
   * @param {string[]} [previousOrder] - ids, in the order they first appeared
   * @returns {{lines: Array<{id: string, text: string, detail: string, undo: Function|null}>, order: string[]}}
   */
  export function trayLines(rows, previousOrder = []) {
    const present = new Map(rows.map((row) => [row.id, row]));
    const order = previousOrder.filter((id) => present.has(id));
    for (const row of rows) if (!order.includes(row.id)) order.push(row.id);
    return {
      lines: order.map((id) => {
        const row = present.get(id);
        return { id, text: row.label, detail: row.detail, undo: row.undo ?? null };
      }),
      order,
    };
  }
  ```

- [ ] **Step 5:** add `'shell/tray.js'` to `LOADABLE`;
  `npx vitest run tests/tray.test.js tests/decisions.test.js tests/ui.test.js`;
  `npm test`. Commit: *Give every staged change an id, and order the tray by them*.

---

### Task 5: the shell

**Files:** create `ui/words/shell.js`, `ui/shell/shell.js`; modify `ui/app.js`,
`ui/dashboard.js`, `ui/guide/drawer.js`, `ui/recorder.js`, `ui/studio.css`,
`tests/words.test.js`, `tests/ui.test.js`.

**Interfaces consumed:** Task 3's sections, Task 4's `trayLines`.

**Interfaces produced:**
- `renderDashboard(game, onDecisionChange, { openGuide, onContext })`:
  `onContext(ctx)` is called with the context it builds.
- `createGuide({ figures, reveal })`: `showCard(slot)` calls `reveal(slot)` first.
- `createStudio({ onRun, onRedo, openGuide, openContents, onPlaytest })` returns
  `{ node, draw(game, { saved, canRedo, endingNode }), reveal(slot), open(key), setTrayOverride(node|null) }`.
- `SHELL` words (below).

- [ ] **Step 1: Write the words,** `ui/words/shell.js`:

  ```js
  /**
   * The Studio layout's own words: the top bar, the tray, the locks
   * (plans/2026-09-13-studio-makeover.md, section 2). Section names live with
   * the sections, in ui/shell/sections.js.
   */

  import { line } from './line.js';

  export const SHELL = Object.freeze({
    week: line('label', ({ played, total }) => `Week ${played} of ${total}`),
    saved: line('label', 'saved'),
    notSaved: line('label', 'not saved'),
    month: line('label', ({ month }) => `Month ${month}`),
    spent: line('label', ({ spent, budget }) => `${spent} of ${budget} spent`),
    changes: line('label', ({ n }) => (n === 1 ? 'change waiting' : 'changes waiting')),
    empty: line('instruction', 'No changes yet. Anything you change, in any section, lands here.'),
    run: line('instruction', ({ week }) => `Run week ${week}`),
    running: line('label', ({ hours }) => `running ${hours} hours…`),
    gameOver: line('label', 'Game over'),
    undo: line('instruction', 'Undo this change'),
    lockChip: line('label', ({ week }) => `week ${week}`),
    opensAt: line('reading', ({ week }) => `Opens at week ${week}.`),
    returnsLocked: line('reading', 'Before then there is no honest reading of what came back.'),
    resultsLocked: line('reading', 'Opens after the last week, with the debrief and the rival reveal.'),
    adSection: line('reading', 'Your ad is written before the first week, and its grades show in each '
      + 'keyword’s Quality Score. It moves here when this section is built.'),
    redo: line('instruction', ({ round }) => `Redo round ${round}`),
    playtest: line('instruction', 'Send playtest file'),
    playtestShort: line('label', 'Playtest'),
    menu: line('label', 'Sections'),
    fresh: line('label', 'Something new here'),
  });
  ```

  In `tests/words.test.js`, import `SHELL` and add, beside the other blocks:

  ```js
  describe('the Studio layout', () => {
    const FIGURES = { played: 4, total: 12, month: 1, spent: '₹2,96,535', budget: '₹3,13,000',
      n: 2, week: 5, hours: 168, round: 0 };

    test('every entry is a line of a kind the screen may carry', () => {
      for (const [name, entry] of Object.entries(SHELL)) expect(KINDS, name).toContain(entry.kind);
    });

    test('every entry renders without a hole in it', () => {
      for (const [name, entry] of Object.entries(SHELL)) {
        expect(entry(FIGURES), name).not.toMatch(/undefined|NaN|\[object/);
      }
    });

    test('one change reads as one', () => {
      expect(SHELL.changes({ n: 1 })).toBe('change waiting');
      expect(SHELL.changes({ n: 3 })).toBe('changes waiting');
    });
  });
  ```

  and a guard that the new drawing modules hold no sentence of their own, below
  *a card that has moved draws, and no longer writes*. A "word" here must hold
  two letters in a row, so icon paths and class lists are not counted:

  ```js
  describe('the new screens draw, and do not write', () => {
    const drawing = ['ui/shell/shell.js'];
    test.each(drawing)('%s holds no sentence of its own', (file) => {
      const body = readFileSync(fileURLToPath(new URL(`../${file}`, import.meta.url)), 'utf8');
      for (const literal of literals(body)) {
        const words = outsideInterpolation(literal).slice(1, -1).trim().split(/\s+/)
          .filter((w) => /[a-z]{2,}/i.test(w));
        expect(words.length, `${file}: ${literal}`).toBeLessThan(3);
      }
    });
  });
  ```

- [ ] **Step 2: Watch them fail:** `npx vitest run tests/words.test.js` (no
  `SHELL`, no `shell.js`).

- [ ] **Step 3: The three small hooks.**
  - `ui/dashboard.js`: the signature becomes
    `export function renderDashboard(game, onDecisionChange, { openGuide, onContext } = {})`,
    and just before `return root;` add:

    ```js
    // The Studio's keywords section stages changes through this same context.
    onContext?.(ctx);
    ```

  - `ui/guide/drawer.js`: `export function createGuide({ figures, reveal = null })`,
    and in `showCard`, after `close({ restoreFocus: false });`:

    ```js
    // In the Studio layout the card may sit in a section that is not open.
    reveal?.(slot);
    ```

  - `ui/recorder.js`: in `attachRecorder`, the click handler reads
    `event.target.closest?.('.card, header, [data-region]')`, and `cardTitle`
    gains, after its `HEADER` line:

    ```js
    // The Studio layout's regions (the sidebar, the tray, a section) name themselves.
    if (card.dataset?.region) return card.dataset.region;
    ```

- [ ] **Step 4: Write `ui/shell/shell.js`:**

  ```js
  /**
   * The Studio layout (plans/2026-09-13-studio-makeover.md, sections 2 and 5):
   * the icon strip, the section list, one section at a time, and the tray.
   *
   * TODAY'S CARDS ARE SHOWN, NEVER MOVED. The decision form redraws its cards
   * into its own region on every change, and the dashboard's refreshes find their
   * cards by querying its root. So the dashboard is drawn exactly as the classic
   * look draws it, and a section is a filter over it: `data-section` on the root,
   * and the stylesheet from ./sections.js hiding every other section's cards. A
   * card moved out of its region would leave the next redraw drawing into nothing.
   */

  import { el, add, rupees } from '../dom.js';
  import { renderDashboard } from '../dashboard.js';
  import { changes } from '../decisions.js';
  import { TOTAL_ROUNDS, ROUNDS_PER_MONTH } from '../../engine/constants.js';
  import {
    AREAS, SECTIONS, ICONS, ICON_BOX, sectionOf, sectionsIn, sectionState, visibilityRules,
  } from './sections.js';
  import { trayLines } from './tray.js';
  import { SHELL } from '../words/shell.js';

  const HOURS_PER_WEEK = 7 * 24;
  /** An undone line fades before it goes; the tray's motion (spec section 3, row 1). */
  const UNDO_FADE_MS = 150;
  const SVG = 'http://www.w3.org/2000/svg';

  function icon(paths) {
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

  function button(className, ...children) {
    const node = el('button', className);
    node.type = 'button';
    node.append(...children);
    return node;
  }

  /**
   * @param {object} deps
   * @param {() => Promise<void>} deps.onRun - runs the week and redraws
   * @param {() => void} deps.onRedo
   * @param {Function} deps.openGuide - `guide.open`
   * @param {(trigger: HTMLElement) => void} deps.openContents
   * @param {(() => void)|null} [deps.onPlaytest]
   */
  export function createStudio({ onRun, onRedo, openGuide, openContents, onPlaytest = null }) {
    if (!document.getElementById('studio-sections')) {
      const style = el('style');
      style.id = 'studio-sections';
      style.textContent = visibilityRules();
      document.head.append(style);
    }

    const view = {
      area: 'brand', section: 'week', seen: {}, order: [], menuOpen: false,
      resultsShown: false, firstOpen: null, dotsShown: new Set(),
    };
    let game = null;
    let ctx = null;
    let dashboard = null;
    let ending = null;
    let extras = { saved: null, canRedo: false };
    let running = false;
    let override = null;

    const node = el('div', 'studio-shell');
    const rail = el('nav', 'studio-rail');
    rail.dataset.region = 'Icon strip';
    const list = el('nav', 'studio-list');
    list.dataset.region = 'Sections';
    const main = el('div', 'studio-main');
    const top = el('div', 'studio-top');
    const body = el('div', 'studio-body');
    const section = el('section', 'card studio-section');
    const title = el('h2', 'studio-title');
    const content = el('div', 'studio-content');
    section.append(title, content);
    body.append(section);

    const tray = el('div', 'studio-tray');
    tray.dataset.region = 'Tray';
    const linesBox = el('div', 'studio-lines');
    const count = el('span', 'studio-count');
    const countWord = el('span', 'studio-count-word');
    const chipsBox = el('div', 'studio-chips');
    linesBox.append(count, countWord, chipsBox);
    const empty = el('p', 'studio-empty', SHELL.empty());
    const overrideHost = el('div', 'studio-override');
    const run = button('studio-run press');
    run.addEventListener('click', runWeek);
    tray.append(linesBox, empty, overrideHost, run);

    main.append(top, body, tray);
    node.append(rail, list, main);

    const chips = new Map();
    const played = () => game.reports.length;
    const args = () => ({
      played: played(), seen: view.seen,
      windowOpen: Boolean(game.draft.capexOpen || game.draft.repositionOpen),
    });
    const me = () => game.state.advertisers.find((a) => a.id === game.playerId);

    function drawRail() {
      const initials = me().name.split(' ').slice(0, 2).map((w) => w[0]).join('');
      rail.replaceChildren(el('div', 'studio-logo', initials));
      for (const area of AREAS) {
        const b = button('studio-area', icon(area.icon), el('span', null, area.label));
        b.setAttribute('aria-current', String(view.area === area.key));
        b.disabled = area.key === 'results' && played() < TOTAL_ROUNDS;
        b.addEventListener('click', () => {
          if (area.key === 'guide') { openContents(b); return; }
          open(sectionsIn(area.key)[0].key);
        });
        rail.append(b);
      }
      if (onPlaytest) {
        const p = button('studio-area studio-playtest', icon(ICONS.file), el('span', null, SHELL.playtestShort()));
        p.title = SHELL.playtest();
        p.addEventListener('click', onPlaytest);
        rail.append(p);
      }
    }

    function drawList() {
      const brand = el('div', 'studio-brand');
      brand.append(el('strong', null, me().name), el('span', null, `${me().position.price} · ${me().position.purpose}`));
      list.replaceChildren(brand);
      if (extras.canRedo) {
        const redo = button('studio-redo', SHELL.redo({ round: 0 }));
        redo.addEventListener('click', onRedo);
        list.append(redo);
      }
      list.append(el('p', 'studio-area-title', AREAS.find((a) => a.key === view.area).title));
      for (const s of sectionsIn(view.area)) {
        const st = sectionState(s, args());
        const item = button(`studio-item${st.locked ? ' locked' : ''}`, icon(s.icon), el('span', 'grow', s.label));
        item.setAttribute('aria-current', String(view.section === s.key));
        if (st.locked) item.append(el('span', 'studio-lock', SHELL.lockChip({ week: st.opensAt })));
        else if (st.fresh) {
          // The dot arrives once; a later redraw of the list keeps it still.
          const dot = el('span', view.dotsShown.has(st.seenKey) ? 'studio-dot' : 'studio-dot arrive');
          view.dotsShown.add(st.seenKey);
          dot.title = SHELL.fresh();
          item.append(dot);
        }
        item.addEventListener('click', () => open(s.key));
        list.append(item);
      }
    }

    function drawTop() {
      const report = game.reports[game.reports.length - 1];
      const money = report.byAdvertiser[game.playerId].budget;
      const menu = button('studio-menu', icon(ICONS.menu));
      menu.setAttribute('aria-label', SHELL.menu());
      menu.setAttribute('aria-expanded', String(view.menuOpen));
      menu.addEventListener('click', () => { view.menuOpen = !view.menuOpen; drawAll(); });
      const dots = el('div', 'studio-dots');
      dots.setAttribute('aria-hidden', 'true');
      for (let week = 1; week <= TOTAL_ROUNDS; week++) dots.append(el('i', week <= played() ? 'on' : null));
      let saved = '';
      if (extras.saved === true) saved = SHELL.saved();
      if (extras.saved === false) saved = SHELL.notSaved();
      const meter = el('span', 'studio-meter');
      const fill = el('span');
      fill.style.width = `${Math.min(100, Math.round((100 * money.monthSpentPaise) / money.monthlyBudgetPaise))}%`;
      meter.append(fill);
      const month = el('div', 'studio-month');
      month.append(
        el('span', null, SHELL.month({ month: Math.ceil(played() / ROUNDS_PER_MONTH) })),
        meter,
        el('strong', null, SHELL.spent({ spent: rupees(money.monthSpentPaise), budget: rupees(money.monthlyBudgetPaise) })),
      );
      const left = add(el('div', 'studio-top-left'), menu,
        el('span', 'studio-week', SHELL.week({ played: played(), total: TOTAL_ROUNDS })), dots,
        el('span', 'studio-saved', saved));
      top.replaceChildren(left, month);
    }

    function drawSection() {
      const s = SECTIONS.find((x) => x.key === view.section);
      const st = sectionState(s, args());
      title.textContent = s.label;
      section.dataset.region = s.label;
      section.classList.toggle('first-open', view.firstOpen === s.key);
      let shown;
      if (st.locked && s.key === 'results') shown = el('p', 'studio-panel', SHELL.resultsLocked());
      else if (st.locked) {
        shown = el('p', 'studio-panel', `${SHELL.opensAt({ week: st.opensAt })} ${SHELL.returnsLocked()}`);
      } else if (s.key === 'results') shown = ending ?? el('p', 'studio-panel', SHELL.resultsLocked());
      else if (s.key === 'ad') shown = el('p', 'studio-panel', SHELL.adSection());
      else {
        dashboard.dataset.section = s.key;
        shown = dashboard;
      }
      content.replaceChildren(shown);
      body.scrollTop = 0;
    }

    function makeChip(line) {
      const chip = el('span', 'studio-chip');
      const text = el('span', null, line.text);
      const undo = button('studio-undo', icon(ICONS.close));
      undo.setAttribute('aria-label', SHELL.undo());
      undo.addEventListener('click', () => {
        const take = chip.undo;
        if (!take || chip.classList.contains('leaving')) return;
        chip.classList.add('leaving');
        setTimeout(() => { take(); ctx.refresh(); }, UNDO_FADE_MS);
      });
      chip.append(text, undo);
      return chip;
    }

    function drawTray() {
      const bulk = override !== null;
      tray.classList.toggle('bulk', bulk);
      overrideHost.replaceChildren(...(bulk ? [override] : []));
      run.hidden = bulk;
      const { lines, order } = trayLines(changes(game.draft), view.order);
      view.order = order;
      const keep = new Set(lines.map((l) => l.id));
      for (const [id, chip] of chips) {
        if (!keep.has(id)) { chips.delete(id); chip.remove(); }
      }
      for (const line of lines) {
        let chip = chips.get(line.id);
        if (!chip) {
          chip = makeChip(line);
          chips.set(line.id, chip);
          chipsBox.append(chip);
        }
        chip.firstChild.textContent = line.text;
        chip.title = line.detail;
        chip.undo = line.undo;
        chip.lastChild.hidden = !line.undo;
      }
      linesBox.hidden = bulk || lines.length === 0;
      empty.hidden = bulk || lines.length > 0;
      count.textContent = String(lines.length);
      countWord.textContent = SHELL.changes({ n: lines.length });
      const over = played() >= TOTAL_ROUNDS;
      run.disabled = running || over;
      if (running) run.textContent = SHELL.running({ hours: HOURS_PER_WEEK });
      else if (over) run.textContent = SHELL.gameOver();
      else run.textContent = SHELL.run({ week: played() + 1 });
    }

    function drawAll() {
      node.classList.toggle('menu-open', view.menuOpen);
      drawRail();
      drawList();
      drawTop();
      drawSection();
      drawTray();
    }

    /** Open a section by key; opening a fresh one marks it seen. */
    function open(key) {
      const s = SECTIONS.find((x) => x.key === key);
      const st = sectionState(s, args());
      view.area = s.area;
      view.section = key;
      view.menuOpen = false;
      view.firstOpen = st.fresh ? key : null;
      if (st.fresh) view.seen[st.seenKey] = true;
      drawAll();
    }

    async function runWeek() {
      if (running || played() >= TOTAL_ROUNDS) return;
      running = true;
      drawTray();
      // Let "running 168 hours…" paint before the week holds the thread.
      await new Promise((resolve) => setTimeout(resolve, 0));
      try {
        await onRun();
      } finally {
        running = false;
        drawTray();
      }
    }

    function draw(nextGame, { saved = null, canRedo = false, endingNode = null } = {}) {
      game = nextGame;
      extras = { saved, canRedo };
      ending = endingNode;
      override = null;
      dashboard = renderDashboard(game, () => drawTray(), {
        openGuide,
        onContext: (c) => { ctx = c; },
      });
      dashboard.classList.add('studio-cards');
      if (ending && !view.resultsShown) {
        view.resultsShown = true;
        view.area = 'results';
        view.section = 'results';
      }
      view.firstOpen = null;
      drawAll();
    }

    function reveal(slot) {
      const s = sectionOf(slot);
      if (!s || !game) return false;
      open(s.key);
      return true;
    }

    function setTrayOverride(next) {
      override = next;
      drawTray();
    }

    return { node, draw, reveal, open, setTrayOverride };
  }
  ```

  Add `'words/shell.js'` and `'shell/shell.js'` to `LOADABLE`.

- [ ] **Step 5: Wire it into `ui/app.js`.**
  - Import `createStudio` from `./shell/shell.js`.
  - Above the guide, declare `let studio = null;`, and create the guide with
    `createGuide({ figures: guideFigures(), reveal: (slot) => studio?.reveal(slot) ?? false })`.
  - Extract three functions from existing code, and point the old listeners at them:

    ```js
    /** The end screen and, on the playtest link, its questions. */
    function endingNodes() {
      const ending = el('section', 'grid');
      ending.append(renderEnding({
        state: game.state,
        history: game.state.history,
        playerId: game.playerId,
        opening: game.opening,
        initial: game.initial,
        openGuide: guide.open,
        onRestart: restart,
      }));
      if (!recorder) return [ending];
      const questions = el('section', 'grid');
      questions.append(renderPlaytestPanel({
        recorder,
        onDownload: () => downloadPlaytestFile(recorder, storage),
      }));
      return [ending, questions];
    }

    function redo() {
      rewinding = game.state;
      game = null;
      studio = null;
      render();
    }

    function sendPlaytestFile() {
      const questions = document.getElementById('playtest-panel');
      if (questions) questions.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else downloadPlaytestFile(recorder, storage);
    }
    ```

    The classic ending branch becomes `app.replaceChildren(...endingNodes(), dashboard);`.
    `restart()` also sets `studio = null`.
  - In `render()`, after the `if (!game) { ... }` block:

    ```js
    if (look === 'studio') {
      studio ??= createStudio({
        onRun: runWeek,
        onRedo: redo,
        openGuide: guide.open,
        openContents: (trigger) => guide.openContents(trigger),
        onPlaytest: recorder ? sendPlaytestFile : null,
      });
      let endingNode = null;
      if (game.reports.length >= TOTAL_ROUNDS) {
        endingNode = el('div', 'studio-results');
        endingNode.append(...endingNodes());
      }
      studio.draw(game, { saved: game.saved, canRedo: canRedoRoundZero(game.state), endingNode });
      app.replaceChildren(studio.node);
      return;
    }
    ```

- [ ] **Step 6: The shell's styles,** appended to `ui/studio.css`:

  ```css
  /* --- the shell (spec section 2) ------------------------------------------ */
  /* Round 0 keeps the page and its header; the shell takes the window. */
  body.studio:has(.studio-shell) .bar { display: none; }
  body.studio main:has(> .studio-shell) { padding: 0; max-width: none; }

  body.studio .studio-shell { display: grid; grid-template-columns: 72px 232px minmax(0, 1fr); height: 100vh; height: 100dvh; }
  body.studio .studio-icon { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }

  body.studio .studio-rail { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 0; background: var(--studio-rail); }
  body.studio .studio-logo { display: grid; place-items: center; width: 44px; height: 44px; margin-bottom: 18px; border-radius: 14px; background: var(--studio-red); color: var(--studio-on-red); font: 800 17px/1 var(--studio-display); }
  body.studio .studio-area { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 60px; padding: 8px 0 6px; border-radius: 14px; background: none; color: #8A8389; font-size: 10px; font-weight: 600; }
  body.studio .studio-area[aria-current="true"] { background: #2A1216; color: #F3EEEA; }
  body.studio .studio-area:disabled { opacity: 1; color: #4A454F; }
  body.studio .studio-playtest { margin-top: auto; }

  body.studio .studio-list { display: flex; flex-direction: column; gap: 4px; padding: 22px 12px; overflow-y: auto; background: var(--studio-sidebar); border-right: 1px solid #26232A; }
  body.studio .studio-brand { display: flex; flex-direction: column; gap: 2px; padding: 0 10px 16px; }
  body.studio .studio-brand strong { font: 800 22px/1.1 var(--studio-display); }
  body.studio .studio-brand span { font-size: 12px; color: var(--studio-muted); }
  body.studio .studio-redo { align-self: flex-start; margin: 0 10px 12px; padding: 6px 12px; border: 1px solid var(--studio-line-strong); border-radius: 999px; background: none; font-size: 12px; }
  body.studio .studio-area-title { margin: 0; padding: 0 12px 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--studio-faint); }
  body.studio .studio-item { display: flex; align-items: center; gap: 12px; height: 42px; padding: 0 12px; border-radius: 12px; background: none; color: var(--studio-soft); font: 500 14px/1 var(--studio-body); text-align: left; }
  body.studio .studio-item .grow { flex: 1; }
  body.studio .studio-item[aria-current="true"] { background: #1F1C22; color: #F3EEEA; font-weight: 700; box-shadow: 0 0 0 1px #2E2A33; }
  body.studio .studio-item[aria-current="true"] .studio-icon { color: var(--studio-red); }
  body.studio .studio-item.locked { color: #6D6770; }
  body.studio .studio-lock { padding: 2px 8px; border: 1px solid var(--studio-line-strong); border-radius: 999px; font-size: 11px; font-weight: 600; color: var(--studio-faint); }
  body.studio .studio-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--studio-red); }

  body.studio .studio-main { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
  body.studio .studio-top { display: flex; flex-shrink: 0; align-items: center; justify-content: space-between; gap: 16px; height: 64px; padding: 0 40px; border-bottom: 1px solid #26232A; }
  body.studio .studio-top-left, body.studio .studio-month { display: flex; align-items: center; gap: 14px; }
  body.studio .studio-week { font: 700 20px/1 var(--studio-display); }
  body.studio .studio-dots { display: flex; gap: 6px; }
  body.studio .studio-dots i { width: 9px; height: 9px; border: 1.5px solid var(--studio-line-strong); border-radius: 50%; box-sizing: border-box; }
  body.studio .studio-dots i.on { background: var(--studio-red); border-color: var(--studio-red); }
  body.studio .studio-saved, body.studio .studio-month span { font-size: 13px; color: var(--studio-faint); }
  body.studio .studio-meter { width: 160px; height: 6px; overflow: hidden; border-radius: 3px; background: #2E2A33; }
  body.studio .studio-meter span { display: block; height: 100%; background: var(--studio-red); }
  body.studio .studio-month strong { font-size: 14px; font-variant-numeric: tabular-nums; }
  body.studio .studio-menu { display: none; width: 40px; height: 40px; padding: 0; background: none; color: var(--studio-text); }

  body.studio .studio-body { flex: 1; min-height: 0; overflow-y: auto; padding: 22px 40px 28px; }
  body.studio .studio-section.card { padding: 0; border: 0; border-radius: 0; background: none; }
  body.studio .studio-section > h2.studio-title { margin: 0 0 16px; font: 800 48px/0.95 var(--studio-display); letter-spacing: -0.025em; text-transform: none; color: var(--studio-text); }
  body.studio .studio-panel { max-width: 620px; margin: 0; padding: 22px 24px; border: 1px dashed var(--studio-line-strong); border-radius: 20px; background: var(--studio-card); font-size: 15px; line-height: 1.55; color: var(--studio-soft); }

  body.studio .studio-tray { display: flex; flex-shrink: 0; align-items: center; justify-content: space-between; gap: 18px; height: 76px; padding: 0 24px 0 40px; background: var(--studio-sidebar); border-top: 1px solid #26232A; }
  body.studio .studio-tray.bulk { background: #1F1C22; border-top-color: var(--studio-red); }
  body.studio .studio-lines { display: flex; flex: 1; align-items: center; gap: 12px; min-width: 0; }
  body.studio .studio-count { display: grid; flex-shrink: 0; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--studio-red); color: var(--studio-on-red); font-size: 13px; font-weight: 700; }
  body.studio .studio-count-word { font-size: 15px; font-weight: 600; white-space: nowrap; }
  body.studio .studio-chips { display: flex; gap: 8px; min-width: 0; padding: 4px 0; overflow-x: auto; }
  body.studio .studio-chip { display: flex; align-items: center; gap: 8px; padding: 6px 8px 6px 12px; border-radius: 999px; background: var(--studio-raised); font-size: 13px; white-space: nowrap; }
  body.studio .studio-undo { display: grid; place-items: center; width: 20px; height: 20px; padding: 0; border-radius: 50%; background: #2E2A33; color: var(--studio-muted); }
  body.studio .studio-undo .studio-icon { width: 10px; height: 10px; stroke-width: 3; }
  body.studio .studio-empty { flex: 1; margin: 0; font-size: 14px; color: var(--studio-muted); }
  body.studio .studio-override { display: contents; }
  body.studio .studio-run { flex-shrink: 0; height: 52px; padding: 0 28px; border-radius: 999px; background: var(--studio-red); color: var(--studio-on-red); font: 700 18px/1 var(--studio-display); }

  @media (max-width: 900px) {
    body.studio .studio-shell { grid-template-columns: minmax(0, 1fr); }
    body.studio .studio-rail, body.studio .studio-list { display: none; }
    body.studio .studio-shell.menu-open .studio-rail,
    body.studio .studio-shell.menu-open .studio-list { display: flex; position: fixed; top: 0; bottom: 0; z-index: 30; }
    body.studio .studio-shell.menu-open .studio-rail { left: 0; width: 72px; }
    body.studio .studio-shell.menu-open .studio-list { left: 72px; width: min(260px, calc(100vw - 72px)); }
    body.studio .studio-menu { display: inline-grid; place-items: center; }
    body.studio .studio-top, body.studio .studio-body { padding-left: 16px; padding-right: 16px; }
    body.studio .studio-month .studio-meter { display: none; }
    body.studio .studio-tray { padding: 0 12px; }
    body.studio .studio-section > h2.studio-title { font-size: 34px; }
  }
  ```

- [ ] **Step 7: Watch it pass:** `npm test`.

- [ ] **Step 8: Play it.** On the dev server with `?look=studio`, play all twelve
  weeks, and check each of these:
  - every section shows exactly its cards, and Your keywords shows today's
    keywords card for now;
  - a bid changed in that card lands in the tray; its ✕ takes it back; and the
    old *Next week* card never shows;
  - Returns is locked with "week 6" until week 6, then shows a dot until opened;
  - Your money has a dot at week 5 with the capital card in it;
  - a guide chapter's "show me on the card" opens the right section (try *Lost
    to rank, or lost to budget*, which lands in Your week);
  - "Redo round 0" shows until week 3 and works;
  - Results opens after week 12 with the debrief;
  - at 375 px wide, the menu button opens the sidebar;
  - with `?playtest=1&look=studio`, the file downloads, and
    `node scripts/read-playtest.js <file>` lists "Your week", "Tray" and so on
    among the clicks;
  - the console is clean.

  Then play one classic week. Commit: *Draw the Studio shell over today's cards,
  one section at a time*.

---

### Task 6: the chapter *What the Quality Score is, and is not*

The spec sends the keywords card's long Quality Score note behind "why?", and
no chapter exists for it yet.

- [ ] Fetch the Google Ads Help page *About Quality Score* (find it through the
  Help Center; confirm the address loads), and write the real half **only** from
  it. Add it to `GOOGLE` in `ui/guide/chapters.js` as
  `qualityScore: { label: 'Google Ads Help: About Quality Score', url: <as fetched> }`.
- [ ] Write the game half from what `qualityNote()` and `qualitySummary()` in
  `ui/decisions.js` say the score does here: three ratings against everyone on
  the same searches, over finished weeks only, lagging, and coarse, so better
  copy moves price and rank before it moves the number. Cite the DECISIONS
  entries those rest on; search DECISIONS.md for `QUALITY_WINDOW_ROUNDS`, `A6`
  and `W11`, and cite only entries that exist and say this. It types no number;
  a figure it needs goes through `ui/guide/figures.js`.
- [ ] Add the chapter as `qualityScore` with `yourAccount: 'keywords'`, and put it
  in `CONTENTS` after `broadMatch`.
- [ ] `npx vitest run tests/guide.test.js tests/sections.test.js`; show the owner
  the rendered text; revise until approved; commit: *Write the Quality Score
  chapter the keywords section points at*.

---

### Task 7: the keyword cards' model, and their words

**Files:** create `ui/keywords/read.js`, `ui/words/keywords.js`,
`tests/keywords.test.js`; modify `tests/words.test.js`, `tests/ui.test.js`.

**Interfaces produced:**
- `SLIDER_FLOOR_PAISE = 10000`, `SLIDER_HEADROOM = 1.5`, `SLIDER_STEP_PAISE = 1000`, `SPEND_NAMED = 3`.
- `sliderMaxPaise(baseKeywords) → number` (paise).
- `keywordCards({ draft, byKeyword, quality, grades, reach }) →
  {id, text, matchType, active, isNew, bidPaise, wasBidPaise, wasMatchType,
  reach, tags, noTagsOnBroad, stats, quality}[]`, where
  `stats = {clicks, costPaise, cpcPaise|null, conversions} | null` and `quality`
  is `qualitySummary`'s shape.
- `adjustSeveral(draft, ids, change) → {changed: string[], refused: {id, reason}[]}`,
  where `change` is exactly one of `{setBidPaise}`, `{byPercent}` or `{matchType}`.
- `readingPanel({ outlook, keywords, lastWeek, week }) →
  null | {week, kind, lostToBudget, lostToRank, impressionShare, spend, named, others, levers}`.
- `KEYWORDS` words (below).

- [ ] **Step 1: Write the failing test,** `tests/keywords.test.js`:

  ```js
  import { describe, test, expect } from 'vitest';
  import { getSelfView } from '../engine/insights.js';
  import { MIN_BID_PAISE } from '../engine/constants.js';
  import { makeGameState, PLAYER_ID } from './fixtures/gameState.js';
  import { createDraft, updateKeyword, addKeyword } from '../ui/decisions.js';
  import {
    keywordCards, sliderMaxPaise, adjustSeveral, readingPanel, SLIDER_FLOOR_PAISE,
  } from '../ui/keywords/read.js';

  const draft = () => createDraft(getSelfView(makeGameState(), PLAYER_ID));
  const reach = (k) => `${k.matchType}:${k.text}`.length;   // a stand-in the tests can predict
  const cards = (d, byKeyword = {}) => keywordCards({ draft: d, byKeyword, quality: {}, grades: null, reach });

  describe('a card per keyword', () => {
    test('in the draft\'s order, with its own text, match and bid', () => {
      const d = draft();
      expect(cards(d).map((c) => [c.id, c.text, c.matchType, c.bidPaise]))
        .toEqual(d.keywords.map((k) => [k.id, k.text, k.matchType, k.bidPaise]));
    });

    test('"was" appears only once the bid or the match has moved', () => {
      const d = draft();
      const [a] = d.keywords;
      expect(cards(d)[0]).toMatchObject({ wasBidPaise: null, wasMatchType: null });
      updateKeyword(d, a.id, { bidPaise: a.bidPaise + 500, matchType: 'broad' });
      expect(cards(d)[0]).toMatchObject({ wasBidPaise: a.bidPaise, wasMatchType: 'exact' });
    });

    test('tags show on broad and only on broad (E8)', () => {
      const d = draft();
      for (const card of cards(d)) {
        if (card.matchType === 'broad') expect(card.tags.length).toBeGreaterThan(0);
        else expect(card.tags).toBeNull();
      }
    });

    test('a broad keyword with no tags is flagged', () => {
      const d = draft();
      addKeyword(d, { text: 'zzqx plumbing', matchType: 'broad', bidPaise: 3000 },
        { tag: () => ({ tags: [], taggedContentHash: 'x' }) });
      expect(cards(d).at(-1).noTagsOnBroad).toBe(true);
    });

    test('a keyword added this week has no figures yet', () => {
      const d = draft();
      addKeyword(d, { text: 'running shorts', matchType: 'phrase', bidPaise: 3000 });
      expect(cards(d).at(-1)).toMatchObject({ isNew: true, stats: null });
    });

    test('figures come from the report\'s rows, and a click-less keyword has no price', () => {
      const d = draft();
      const [a, b] = d.keywords;
      const byKeyword = {
        [a.id]: { clicks: 10, costPaise: 2505, conversions: 1.5 },
        [b.id]: { clicks: 0, costPaise: 0, conversions: 0 },
      };
      const [first, second] = cards(d, byKeyword);
      expect(first.stats).toEqual({ clicks: 10, costPaise: 2505, cpcPaise: 251, conversions: 1.5 });
      expect(second.stats.cpcPaise).toBeNull();
    });

    test('reach is the engine\'s count for the keyword on its chosen match', () => {
      const d = draft();
      const [a] = d.keywords;
      updateKeyword(d, a.id, { matchType: 'phrase' });
      expect(cards(d)[0].reach).toBe(reach({ ...a, matchType: 'phrase' }));
    });

    test('no score reads as none, with nothing invented', () => {
      expect(cards(draft())[0].quality).toMatchObject({ value: null, ratings: [] });
    });
  });

  describe('the slider\'s range, fixed for the week', () => {
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

  describe('adjust several at once', () => {
    test('sets one bid across all the ticked keywords', () => {
      const d = draft();
      const ids = d.keywords.slice(0, 2).map((k) => k.id);
      expect(adjustSeveral(d, ids, { setBidPaise: 2500 })).toEqual({ changed: ids, refused: [] });
      expect(d.keywords.slice(0, 2).map((k) => k.bidPaise)).toEqual([2500, 2500]);
    });

    test('a percentage rounds each bid to the whole rupee', () => {
      const d = draft();
      const [a] = d.keywords;
      updateKeyword(d, a.id, { bidPaise: 3300 });
      adjustSeveral(d, [a.id], { byPercent: -20 });
      expect(d.keywords[0].bidPaise).toBe(2600);
    });

    test('and never below the minimum bid', () => {
      const d = draft();
      const [a] = d.keywords;
      updateKeyword(d, a.id, { bidPaise: 300 });
      adjustSeveral(d, [a.id], { byPercent: -99 });
      expect(d.keywords[0].bidPaise).toBe(MIN_BID_PAISE);
    });

    test('switches a match type across them', () => {
      const d = draft();
      const ids = d.keywords.map((k) => k.id);
      adjustSeveral(d, ids, { matchType: 'phrase' });
      expect(d.keywords.every((k) => k.matchType === 'phrase')).toBe(true);
    });

    test('says which it left alone, and why', () => {
      const d = draft();
      const out = adjustSeveral(d, ['nope', d.keywords[0].id], { setBidPaise: 0 });
      expect(out.changed).toEqual([]);
      expect(out.refused.map((r) => r.id)).toEqual(['nope', d.keywords[0].id]);
    });

    test('refuses a change that is none of the three', () => {
      expect(() => adjustSeveral(draft(), [], {})).toThrow(TypeError);
    });
  });

  describe('the reading panel', () => {
    const outlook = (constraint) => ({ constraint, lostToBudget: 0.5, lostToRank: 0, impressionShare: 0.5 });
    const keywords = [1, 2, 3, 4, 5].map((n) => ({ id: `k${n}`, text: `kw ${n}` }));
    const lastWeek = { k1: { costPaise: 5000 }, k2: { costPaise: 3000 }, k3: { costPaise: 1000 },
      k4: { costPaise: 600 }, k5: { costPaise: 400 }, gone: { costPaise: 999 } };

    test('names the three biggest spenders and folds the rest together', () => {
      const p = readingPanel({ outlook: outlook('budget'), keywords, lastWeek, week: 4 });
      expect(p.named.map((r) => r.id)).toEqual(['k1', 'k2', 'k3']);
      expect(p.others).toEqual({ count: 2, share: 0.1 });
      expect(p.spend.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1);
    });

    test('a keyword it cannot name is left out rather than guessed', () => {
      const p = readingPanel({ outlook: outlook('budget'), keywords, lastWeek, week: 4 });
      expect(p.spend.some((r) => r.id === 'gone')).toBe(false);
    });

    test('offers the levers that act on what held the week back', () => {
      const levers = (c) => readingPanel({ outlook: outlook(c), keywords, lastWeek, week: 4 }).levers;
      expect(levers('budget')).toEqual(['stretch', 'addMoney']);
      expect(levers('both')).toEqual(['stretch', 'addMoney']);
      expect(levers('rank')).toEqual(['raise']);
      expect(levers('saturated')).toEqual(['reach']);
    });

    test('before a week has run there is nothing to say', () => {
      expect(readingPanel({ outlook: null, keywords, lastWeek: {}, week: 0 })).toBeNull();
    });
  });
  ```

  The fixture's first keyword is `exact` (`tests/fixtures/gameState.js`), which the
  "was" test relies on.

- [ ] **Step 2: Watch it fail:** `npx vitest run tests/keywords.test.js`.

- [ ] **Step 3: Write `ui/keywords/read.js`:**

  ```js
  /**
   * What Your keywords shows (plans/2026-09-13-studio-makeover.md, section 4).
   * Pure: the draft, the report's own per-keyword rows and the engine's reach
   * count go in, plain objects come out for render.js to draw. Money stays in
   * paise; nothing here formats.
   */

  import { qualitySummary, updateKeyword } from '../decisions.js';
  import { MIN_BID_PAISE } from '../../engine/constants.js';

  /**
   * The bid slider's range. Display bounds, kept in the view (DECISIONS I6):
   * never shorter than ₹100, half again the week's highest bid, to ₹10 steps.
   */
  export const SLIDER_FLOOR_PAISE = 10000;
  export const SLIDER_HEADROOM = 1.5;
  export const SLIDER_STEP_PAISE = 1000;

  /** How many keywords the panel names by their share of the week's money (I6). */
  export const SPEND_NAMED = 3;

  const LEVERS = Object.freeze({
    budget: ['stretch', 'addMoney'],
    both: ['stretch', 'addMoney'],
    rank: ['raise'],
    saturated: ['reach'],
  });

  /**
   * The slider's top, from the bids the week started with, so it never rescales
   * under a finger mid-drag. A typed bid past it widens it (render.js).
   *
   * @param {Array<{bidPaise: number}>} baseKeywords - `draft.base.keywords`
   * @returns {number} paise
   */
  export function sliderMaxPaise(baseKeywords) {
    const top = Math.max(0, ...baseKeywords.map((k) => k.bidPaise));
    const stepped = Math.ceil((top * SLIDER_HEADROOM) / SLIDER_STEP_PAISE) * SLIDER_STEP_PAISE;
    return Math.max(SLIDER_FLOOR_PAISE, stepped);
  }

  /**
   * One card per keyword, in the draft's order.
   *
   * @param {object} args
   * @param {object} args.draft
   * @param {Record<string, {clicks: number, costPaise: number, conversions: number}>} args.byKeyword
   * @param {Record<string, object>} [args.quality] - this advertiser's reportedScores
   * @param {object|null} [args.grades] - `effectiveGrades(draft)`
   * @param {(keyword: object) => number} args.reach - how many searches it reaches on its match type
   * @returns {object[]}
   */
  export function keywordCards({ draft, byKeyword, quality = {}, grades = null, reach }) {
    return draft.keywords.map((keyword) => {
      const base = draft.base.keywords.find((k) => k.id === keyword.id) ?? null;
      const row = base ? byKeyword?.[keyword.id] : null;
      const broad = keyword.matchType === 'broad';
      return {
        id: keyword.id,
        text: keyword.text,
        matchType: keyword.matchType,
        active: keyword.active !== false,
        isNew: base === null,
        bidPaise: keyword.bidPaise,
        wasBidPaise: base && base.bidPaise !== keyword.bidPaise ? base.bidPaise : null,
        wasMatchType: base && base.matchType !== keyword.matchType ? base.matchType : null,
        reach: reach(keyword),
        // Tags decide how far broad reaches and nothing else (E8), so they show
        // exactly when broad is chosen.
        tags: broad ? [...keyword.tags] : null,
        noTagsOnBroad: broad && keyword.tags.length === 0,
        stats: base === null ? null : {
          clicks: row?.clicks ?? 0,
          costPaise: row?.costPaise ?? 0,
          cpcPaise: row && row.clicks > 0 ? Math.round(row.costPaise / row.clicks) : null,
          conversions: row?.conversions ?? 0,
        },
        quality: qualitySummary(quality?.[keyword.id] ?? null, grades),
      };
    });
  }

  /**
   * One change across several keywords, each through `updateKeyword`, so a bulk
   * edit is exactly the single edits it stands for. A percentage rounds each bid
   * to the whole rupee and never below the minimum bid.
   *
   * @param {object} draft
   * @param {string[]} ids
   * @param {{setBidPaise?: number, byPercent?: number, matchType?: string}} change
   * @returns {{changed: string[], refused: Array<{id: string, reason: string}>}}
   */
  export function adjustSeveral(draft, ids, change) {
    if (!['setBidPaise', 'byPercent', 'matchType'].some((key) => key in change)) {
      throw new TypeError('adjustSeveral needs setBidPaise, byPercent or matchType');
    }
    const patchFor = (keyword) => {
      if ('setBidPaise' in change) return { bidPaise: change.setBidPaise };
      if ('matchType' in change) return { matchType: change.matchType };
      const rupees = Math.round((keyword.bidPaise * (100 + change.byPercent)) / 10000);
      return { bidPaise: Math.max(MIN_BID_PAISE, rupees * 100) };
    };

    const out = { changed: [], refused: [] };
    for (const id of ids) {
      const keyword = draft.keywords.find((k) => k.id === id);
      if (!keyword) {
        out.refused.push({ id, reason: 'no such keyword' });
        continue;
      }
      const result = updateKeyword(draft, id, patchFor(keyword));
      if (result.ok) out.changed.push(id);
      else out.refused.push({ id, reason: result.reason });
    }
    return out;
  }

  /**
   * The dark panel: what held the week back, where its money went, and the
   * levers that act on it (spec section 4, item 2). Cost is the only split,
   * because it is final the week it is spent; conversions keep arriving. It
   * names levers and never a verdict: whether more clicks would pay is not
   * something it can see.
   *
   * @param {object} args
   * @param {object|null} args.outlook - `marketOutlook(...)`, ui/chart.js
   * @param {Array<{id: string, text: string}>} args.keywords - the week's own, `draft.base.keywords`
   * @param {Record<string, {costPaise: number}>} args.lastWeek - the week's per-keyword rows
   * @param {number} args.week - the week just played
   * @returns {null|object}
   */
  export function readingPanel({ outlook, keywords, lastWeek, week }) {
    if (!outlook) return null;
    const names = new Map(keywords.map((k) => [k.id, k.text]));
    const rows = Object.entries(lastWeek ?? {})
      .map(([id, r]) => ({ id, text: names.get(id), costPaise: r.costPaise ?? 0 }))
      .filter((r) => r.text && r.costPaise > 0)
      .sort((a, b) => b.costPaise - a.costPaise);
    const total = rows.reduce((sum, r) => sum + r.costPaise, 0);
    const share = (paise) => (total > 0 ? paise / total : 0);
    const withShare = (r) => ({ ...r, share: share(r.costPaise) });
    const rest = rows.slice(SPEND_NAMED);
    return {
      week,
      kind: outlook.constraint,
      lostToBudget: outlook.lostToBudget,
      lostToRank: outlook.lostToRank,
      impressionShare: outlook.impressionShare,
      spend: rows.map(withShare),
      named: rows.slice(0, SPEND_NAMED).map(withShare),
      others: rest.length > 0
        ? { count: rest.length, share: share(rest.reduce((sum, r) => sum + r.costPaise, 0)) }
        : null,
      levers: LEVERS[outlook.constraint] ?? [],
    };
  }
  ```

- [ ] **Step 4: Write `ui/words/keywords.js`:**

  ```js
  /**
   * Your keywords' words (plans/2026-09-13-studio-makeover.md, section 4), under
   * the content model: every line a kind, every figure handed in.
   */

  import { line } from './line.js';

  const keywords = (n) => (n === 1 ? 'keyword' : 'keywords');

  export const KEYWORDS = Object.freeze({
    sub: line('label', ({ count, range }) => `${count} ${keywords(count)} · ${range}`, { why: 'attributionLag' }),
    rangeWeek: line('label', ({ week }) => `week ${week}`),
    rangeAll: line('label', ({ from, to }) => (from === to ? `week ${to}` : `weeks ${from}–${to}`)),
    thisWeek: line('label', 'This week'),
    allWeeks: line('label', 'All weeks'),
    rangeLabel: line('label', 'Which weeks the figures cover'),
    adjust: line('instruction', 'Adjust several'),

    eyebrow: line('label', ({ week }) => `Week ${week}`),
    heldBudget: line('reading', 'Your money ran out first', { why: 'rankOrBudget' }),
    heldBoth: line('reading', 'Money and rank both held you back', { why: 'rankOrBudget' }),
    heldRank: line('reading', 'Higher-ranked ads took the auctions you lost', { why: 'rankOrBudget' }),
    heldSaturated: line('reading', 'You showed almost everywhere you could', { why: 'rankOrBudget' }),
    saidBudget: line('reading', ({ budget, rank, rankNone }) => `${budget} of the auctions you could enter went unbought. `
      + (rankNone ? 'None were lost to rank, so a higher bid would only run the money out sooner.' : `${rank} were lost to rank.`)),
    saidBoth: line('reading', ({ budget, rank }) => `${rank} were lost to rank and ${budget} went unbought: `
      + 'you are bidding for more than the budget can buy.'),
    saidRank: line('reading', ({ budget, rank }) => `${rank} of the auctions you could enter went to `
      + `higher-ranked ads, and ${budget} went unbought.`),
    saidSaturated: line('reading', ({ shown }) => `You appeared in ${shown} of the auctions you could enter. `
      + 'More now means more searches, not more money on these.'),
    spendTitle: line('label', ({ week }) => `Where week ${week}’s money went`),
    others: line('label', ({ count }) => `${count} others`),
    leverStretch: line('instruction', 'Stretch it'),
    leverStretchHow: line('instruction', 'cheaper clicks make it last; a lower bid can buy them'),
    leverAddMoney: line('instruction', 'Add to it'),
    leverAddMoneyHow: line('instruction', 'a bigger budget, in Your money'),
    leverRaise: line('instruction', 'Raise bids'),
    leverRaiseHow: line('instruction', 'a higher bid buys rank, not a lower price'),
    leverReach: line('instruction', 'Reach further'),
    leverReachHow: line('instruction', 'more searches: add a keyword, or a broader match'),

    match: line('label', 'Match type'),
    exact: line('label', 'Exact'),
    phrase: line('label', 'Phrase'),
    broad: line('label', 'Broad'),
    wasMatch: line('reading', ({ match }) => ` · was ${match}`),
    tags: line('reading', ({ list }) => `tags: ${list}`, { why: 'broadMatch' }),
    noTags: line('reading', 'no tags: broad finds nothing', { why: 'broadMatch' }),
    bid: line('label', 'Bid'),
    wasBid: line('reading', ({ bid }) => `was ${bid}`),
    typeBid: line('instruction', ({ keyword }) => `Type an exact bid for ${keyword}`),
    sliderLabel: line('label', ({ keyword }) => `Bid for ${keyword}, in rupees`),
    paid: line('reading', ({ cpc }) => `paid ${cpc} a click on average`),
    noClicks: line('reading', 'no clicks yet'),
    isNew: line('reading', 'new this week: no clicks yet'),
    running: line('label', 'Running'),
    paused: line('label', 'Paused'),
    pauseTitle: line('instruction', 'Running: tap to pause'),
    resumeTitle: line('instruction', 'Paused: tap to enter auctions again'),
    clicks: line('label', 'clicks'),
    cost: line('label', 'cost'),
    conv: line('label', 'conv.'),
    qs: line('label', ({ value }) => `QS ${value}`),
    qsTitle: line('label', ({ value }) => `Quality Score ${value}`),
    qsNote: line('reading', 'Each part is compared with everyone who showed on the same searches.', { why: 'qualityScore' }),
    qsNone: line('reading', ({ impressions }) => `No score yet: it needs ${impressions} impressions on its own search first.`,
      { why: 'qualityScore' }),
    above: line('label', 'above average'),
    average: line('label', 'average'),
    below: line('label', 'below average'),
    back: line('instruction', 'Back to the keyword'),
    more: line('label', 'More'),
    remove: line('instruction', 'Remove keyword'),
    cancel: line('instruction', 'Cancel'),
    select: line('label', ({ keyword }) => `Select ${keyword}`),
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

    selected: line('label', ({ n }) => `${n} selected`),
    setBid: line('label', 'Set bid ₹'),
    changeBy: line('label', 'Change by'),
    percent: line('label', '%'),
    matchAll: line('label', 'Match'),
    apply: line('instruction', 'Apply'),
    done: line('instruction', 'Done'),
    pickFirst: line('instruction', 'Tick the keywords to change first.'),
    refused: line('reading', ({ n, reason }) => `${n} left as ${n === 1 ? 'it was' : 'they were'}: ${reason}`),
  });
  ```

  In `tests/words.test.js`, import `KEYWORDS` and add:

  ```js
  describe('Your keywords', () => {
    const FIGURES = {
      count: 7, range: 'weeks 1–4', week: 4, from: 1, to: 4, budget: '50%', rank: '0%', rankNone: true,
      shown: '50%', match: 'phrase', list: 'leggings · gym', bid: '₹33', keyword: 'gym leggings',
      cpc: '₹21', value: 8, impressions: '100', text: 'my own words', n: 2, reason: 'no such keyword',
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

    test('the panel names levers, never a verdict', () => {
      for (const name of Object.keys(KEYWORDS).filter((k) => k.startsWith('said') || k.startsWith('lever'))) {
        expect(KEYWORDS[name](FIGURES), name).not.toMatch(/\byou should\b|\blower your bids\b|\braise your bids\b/i);
      }
    });

    test('no rank lost reads as none, not as zero per cent', () => {
      expect(KEYWORDS.saidBudget({ budget: '50%', rank: '0%', rankNone: true })).toMatch(/None were lost to rank/);
      expect(KEYWORDS.saidBudget({ budget: '50%', rank: '12%', rankNone: false })).toMatch(/12% were lost to rank/);
    });
  });
  ```

- [ ] **Step 5:** add `'keywords/read.js'` and `'words/keywords.js'` to `LOADABLE`.
  `npx vitest run tests/keywords.test.js tests/words.test.js tests/ui.test.js`.
  Expected: PASS. Break the rounding (use `Math.floor`) and the tags rule on
  purpose, and confirm each is caught; restore. `npm test`. Commit: *Work out what
  each keyword card shows, and write its words*.

  *Found when built:* two of the tests above could not fail. The "was" test
  reads `a.bidPaise` after `updateKeyword` has changed that same object, so it
  expected the new bid as the old one; it now reads the bid first. The
  percentage test took ₹33 down 20% to ₹26.40, where rounding and rounding down
  agree; it now takes ₹33 down 10% to ₹29.70, which must come out ₹30. As
  amended above, the slider's range and its tests are the kit's
  (`tests/kit.test.js`). The weekly model also carries `needPaise: null`, so it
  has exactly the keys round 0's `setupKeywordCards` gives the kit's card, and a
  test holds the two shapes together. Broken on purpose, each of the rounding
  of a click's price, the rounding of a percentage and the tags rule failed its
  test.

---

### Task 8: Your keywords, drawn

**Files:** create `ui/kit/controls.js`, `ui/keywords/render.js`; modify
`ui/shell/sections.js`, `ui/shell/shell.js`, `ui/studio.css`,
`tests/sections.test.js`, `tests/words.test.js`, `tests/ui.test.js`.

**Interfaces consumed:** Task 5's `ctx` (via `onContext`), `open`,
`setTrayOverride`; Task 7's model and words.

**Interfaces produced:** `pills`, `toggle`, `stat`, `slider`, `typeIn` from the
kit; `renderKeywordsSection({ game, ctx, openGuide, openSection, setTrayOverride }) → { node, refresh }`.

- [ ] **Step 1: Retire the old card, test first.** In `tests/sections.test.js`,
  add:

  ```js
  test('Your keywords draws its own card, so the guide can still open it', () => {
    expect(RETIRED_SLOTS).toContain('keywords');
    expect(sectionOf('keywords').key).toBe('keywords');
  });
  ```

  Watch it fail. In `ui/shell/sections.js`, make the keywords section
  `slots: [], draws: ['keywords']` and `RETIRED_SLOTS` `['keywords', 'next']`,
  with the comment "the tray replaces *Next week*; Your keywords draws its own".
  Run `npx vitest run tests/sections.test.js`: PASS.

- [ ] **Step 2: Extend the drawing guard** in `tests/words.test.js` to
  `['ui/shell/shell.js', 'ui/keywords/render.js', 'ui/kit/controls.js']`. It fails
  until both files exist.

- [ ] **Step 3: Write `ui/kit/controls.js`:**

  ```js
  /**
   * The Studio kit's controls (plans/2026-09-13-studio-makeover.md, section 3).
   * Plain elements, each with its words handed in, so a control never holds a
   * sentence. A control that changes itself (the switch, the slider) does so in
   * place: redrawn under a finger, a drag would end.
   */

  import { el } from '../dom.js';

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

- [ ] **Step 4: Write `ui/keywords/render.js`.** It is long because it draws a
  whole section; every part below is needed and nothing else is:

  ```js
  /**
   * Your keywords, drawn (plans/2026-09-13-studio-makeover.md, section 4).
   *
   * What each card shows is worked out in ./read.js and every sentence is in
   * ../words/keywords.js; this file only draws. Changes go through the decision
   * form's own functions and its own refresh (`ctx.refresh`), so the new screen
   * is a new way to reach the same draft, and the tray, the search terms and the
   * rest of the page follow as they do in the classic look.
   *
   * A DRAG IS NEVER REDRAWN UNDER THE FINGER. While a slider moves, only its own
   * figure, its "was", its outline and the tray change; the switch flips in place
   * for the same reason. Everything else redraws the section, keeping focus.
   */

  import { el, add, rupees, whole, pct } from '../dom.js';
  import { addKeyword, addKeywords, removeKeyword, updateKeyword } from '../decisions.js';
  import { marketOutlook } from '../chart.js';
  import { whyButton } from '../guide/drawer.js';
  import { QUALITY_MIN_IMPRESSIONS } from '../../engine/constants.js';
  import { KEYWORDS } from '../words/keywords.js';
  import { FORM } from '../words/form.js';
  import {
    keywordCards, sliderMaxPaise, adjustSeveral, readingPanel, SLIDER_STEP_PAISE,
  } from './read.js';
  import { pills, toggle, stat, slider, typeIn } from '../kit/controls.js';

  const MATCHES = ['exact', 'phrase', 'broad'];
  const MATCH_WORD = { exact: KEYWORDS.exact, phrase: KEYWORDS.phrase, broad: KEYWORDS.broad };
  const HELD = { budget: KEYWORDS.heldBudget, both: KEYWORDS.heldBoth, rank: KEYWORDS.heldRank, saturated: KEYWORDS.heldSaturated };
  const SAID = { budget: KEYWORDS.saidBudget, both: KEYWORDS.saidBoth, rank: KEYWORDS.saidRank, saturated: KEYWORDS.saidSaturated };
  const LEVER = {
    stretch: [KEYWORDS.leverStretch, KEYWORDS.leverStretchHow],
    addMoney: [KEYWORDS.leverAddMoney, KEYWORDS.leverAddMoneyHow],
    raise: [KEYWORDS.leverRaise, KEYWORDS.leverRaiseHow],
    reach: [KEYWORDS.leverReach, KEYWORDS.leverReachHow],
  };
  const RATING_WORD = { above: KEYWORDS.above, average: KEYWORDS.average, below: KEYWORDS.below };
  /** The planner's starting bid, as the classic planner's (ui/decisions.js, planner). */
  const PLANNER_BID_PAISE = 3000;
  const PLANNER_ROWS = 40;
  /** The drawer leaves faster than it came (spec section 3, motion row 6). */
  const DRAWER_EXIT_MS = 150;
  const RUPEE_STEP = SLIDER_STEP_PAISE / 100;
  const normal = (text) => String(text).trim().toLowerCase().replace(/\s+/g, ' ');
  const matchOptions = () => MATCHES.map((m) => [m, MATCH_WORD[m]()]);

  /**
   * @param {object} args
   * @param {object} args.game
   * @param {object} args.ctx - the dashboard's context, from `renderDashboard`'s `onContext`
   * @param {Function} [args.openGuide]
   * @param {(key: string) => void} args.openSection
   * @param {(node: HTMLElement|null) => void} args.setTrayOverride
   * @returns {{node: HTMLElement, refresh: () => void}}
   */
  export function renderKeywordsSection({ game, ctx, openGuide, openSection, setTrayOverride }) {
    const played = game.reports.length;
    const state = { selecting: false, selected: new Set(), qsOpen: null, menuOpen: null };
    const planner = { term: '', matchType: 'phrase', bidPaise: PLANNER_BID_PAISE };
    let maxRupees = Math.round(sliderMaxPaise(ctx.draft.base.keywords) / 100);
    let bulk = null;

    const node = el('div', 'ksection');
    node.dataset.slot = 'keywords';

    const staged = (light = false) => ctx.refresh(light ? { summaryOnly: true } : undefined);

    function redraw() {
      const key = document.activeElement?.dataset?.key;
      node.replaceChildren(...[header(), panel(), grid()].filter(Boolean));
      if (key) node.querySelector(`[data-key="${CSS.escape(key)}"]`)?.focus();
    }

    function header() {
      const row = el('div', 'khead');
      const range = game.view.termsRange === 'week'
        ? KEYWORDS.rangeWeek({ week: played })
        : KEYWORDS.rangeAll({ from: 1, to: played });
      const sub = el('p', 'ksub', KEYWORDS.sub({ count: ctx.draft.keywords.length, range }));
      add(sub, whyButton(KEYWORDS.sub, openGuide));
      row.append(sub);
      if (!state.selecting) {
        const switcher = pills({
          options: [['week', KEYWORDS.thisWeek()], ['all', KEYWORDS.allWeeks()]],
          value: game.view.termsRange,
          label: KEYWORDS.rangeLabel(),
          keyPrefix: 'range',
          onPick: (value) => { game.view.termsRange = value; staged(); redraw(); },
        });
        switcher.classList.add('kswitch');
        const adjust = el('button', 'kadjust', KEYWORDS.adjust());
        adjust.type = 'button';
        adjust.dataset.key = 'adjust';
        adjust.addEventListener('click', startSelecting);
        const tools = el('div', 'ktools');
        tools.append(switcher, adjust);
        row.append(tools);
      }
      return row;
    }

    function panel() {
      const names = new Map(game.state.advertisers.map((a) => [a.id, a.name]));
      const model = readingPanel({
        outlook: marketOutlook(game.insights, game.playerId, names),
        keywords: ctx.draft.base.keywords,
        lastWeek: game.state.history.at(-1)?.byAdvertiser?.[game.playerId]?.breakdown?.byKeyword ?? {},
        week: played,
      });
      if (!model) return null;

      const read = el('div', 'kpanel-read');
      const heading = el('h3', null, HELD[model.kind]());
      add(heading, whyButton(HELD[model.kind], openGuide));
      read.append(
        el('p', 'kpanel-eyebrow', KEYWORDS.eyebrow({ week: model.week })),
        heading,
        el('p', null, SAID[model.kind]({
          budget: pct(model.lostToBudget),
          rank: pct(model.lostToRank),
          rankNone: Math.round(100 * model.lostToRank) === 0,
          shown: pct(model.impressionShare),
        })),
      );

      const spend = el('div', 'kpanel-spend');
      const bar = el('div', 'kbar');
      model.spend.forEach((row, i) => {
        const part = el('span', i === 0 ? 'lead' : null);
        part.style.flexGrow = String(row.costPaise);
        part.title = `${row.text}: ${rupees(row.costPaise)}, ${pct(row.share)}`;
        bar.append(part);
      });
      const legend = el('ul', 'klegend');
      const item = (label, share, lead) => {
        const li = el('li', lead ? 'lead' : null);
        li.append(el('span', 'klegend-key'), el('span', null, label), el('strong', null, share));
        return li;
      };
      model.named.forEach((row, i) => legend.append(item(row.text, pct(row.share), i === 0)));
      if (model.others) legend.append(item(KEYWORDS.others({ count: model.others.count }), pct(model.others.share), false));
      spend.append(el('p', 'kpanel-small', KEYWORDS.spendTitle({ week: model.week })), bar, legend);

      const levers = el('div', 'kpanel-levers');
      for (const lever of model.levers) {
        const [name, how] = LEVER[lever];
        const pull = el('button', 'klever press');
        pull.type = 'button';
        pull.dataset.key = `lever:${lever}`;
        pull.append(el('strong', null, name()), el('span', null, how()));
        pull.addEventListener('click', () => {
          if (lever === 'addMoney') openSection('money');
          else if (lever === 'reach') openPlanner(pull);
          else startSelecting();
        });
        levers.append(pull);
      }

      const box = el('div', 'kpanel');
      box.append(read, spend, levers);
      return box;
    }

    function grid() {
      const box = el('div', 'kgrid');
      const cards = keywordCards({
        draft: ctx.draft, byKeyword: ctx.byKeyword, quality: ctx.quality, grades: ctx.grades, reach: ctx.reach,
      });
      for (const card of cards) box.append(cardNode(card));
      const plus = el('button', 'kadd');
      plus.type = 'button';
      plus.dataset.key = 'add';
      plus.append(el('strong', null, KEYWORDS.addTitle()), el('span', null, KEYWORDS.addHow()));
      plus.addEventListener('click', () => openPlanner(plus));
      box.append(plus);
      return box;
    }

    function cardNode(card) {
      const article = el('article', 'kcard');
      article.dataset.id = card.id;
      const base = ctx.draft.base.keywords.find((k) => k.id === card.id) ?? null;
      const isChanged = () => {
        const now = ctx.draft.keywords.find((k) => k.id === card.id);
        return !base || base.bidPaise !== now.bidPaise || base.matchType !== now.matchType;
      };
      article.classList.toggle('changed', isChanged());
      article.classList.toggle('paused', !card.active);
      article.classList.toggle('selected', state.selected.has(card.id));

      const left = el('div', 'kcard-left');
      if (state.selecting) left.append(checkbox(card, article));
      const running = toggle({
        on: card.active,
        labelOn: KEYWORDS.running(), labelOff: KEYWORDS.paused(),
        titleOn: KEYWORDS.pauseTitle(), titleOff: KEYWORDS.resumeTitle(),
        onToggle: (on) => {
          updateKeyword(ctx.draft, card.id, { active: on });
          article.classList.toggle('paused', !on);
          staged();
        },
      });
      running.dataset.key = `${card.id}:active`;
      left.append(running);

      const qs = el('button', 'kqs', KEYWORDS.qs({ value: card.quality.value ?? '—' }));
      qs.type = 'button';
      qs.dataset.key = `${card.id}:qs`;
      qs.setAttribute('aria-expanded', String(state.qsOpen === card.id));
      qs.addEventListener('click', () => {
        state.qsOpen = state.qsOpen === card.id ? null : card.id;
        state.menuOpen = null;
        redraw();
      });
      const more = el('button', 'kmore', '⋯');
      more.type = 'button';
      more.dataset.key = `${card.id}:more`;
      more.setAttribute('aria-label', KEYWORDS.more());
      more.setAttribute('aria-expanded', String(state.menuOpen === card.id));
      more.addEventListener('click', () => {
        state.menuOpen = state.menuOpen === card.id ? null : card.id;
        redraw();
      });
      const right = el('div', 'kcard-right');
      right.append(qs, more);

      const top = el('div', 'kcard-top');
      top.append(left, right);
      article.append(top);
      if (state.menuOpen === card.id) article.append(menu(card));
      article.append(el('h3', 'kcard-name', card.text));
      article.append(state.qsOpen === card.id ? qualityPanel(card) : body(card, article, base, isChanged));
      return article;
    }

    function body(card, article, base, isChanged) {
      const box = el('div', 'kcard-body');
      const match = pills({
        options: matchOptions(),
        value: card.matchType,
        label: KEYWORDS.match(),
        keyPrefix: `${card.id}:match`,
        onPick: (m) => { updateKeyword(ctx.draft, card.id, { matchType: m }); staged(); redraw(); },
      });
      const reach = el('p', 'kreach', FORM.reach({ count: card.reach }));
      if (card.wasMatchType) reach.append(el('span', 'kwas', KEYWORDS.wasMatch({ match: MATCH_WORD[card.wasMatchType]() })));
      let tagsText = '';
      if (card.tags) tagsText = card.noTagsOnBroad ? KEYWORDS.noTags() : KEYWORDS.tags({ list: card.tags.join(' · ') });
      const tags = el('p', card.noTagsOnBroad ? 'ktags warn' : 'ktags', tagsText);
      tags.title = tagsText;

      const was = el('span', 'kwas', card.wasBidPaise !== null ? KEYWORDS.wasBid({ bid: rupees(card.wasBidPaise) }) : '');
      const figure = typeIn({
        text: rupees(card.bidPaise),
        value: Math.round(card.bidPaise / 100),
        label: KEYWORDS.typeBid({ keyword: card.text }),
        onCommit: (value) => setBid(value, true),
      });
      figure.dataset.key = `${card.id}:bid`;
      const bidRow = el('div', 'kbid-row');
      bidRow.append(el('span', 'klabel', KEYWORDS.bid()), was, figure);

      const bar = slider({
        minRupees: 1,
        maxRupees,
        valueRupees: Math.min(maxRupees, Math.round(card.bidPaise / 100)),
        wasRupees: card.wasBidPaise !== null ? Math.round(card.wasBidPaise / 100) : null,
        label: KEYWORDS.sliderLabel({ keyword: card.text }),
        onInput: (value) => setBid(value, false),
      });
      bar.range.dataset.key = `${card.id}:slider`;

      function setBid(value, redrawAfter) {
        if (!updateKeyword(ctx.draft, card.id, { bidPaise: value * 100 }).ok) return;
        if (value > maxRupees) maxRupees = Math.ceil(value / RUPEE_STEP) * RUPEE_STEP;
        staged(!redrawAfter);
        if (redrawAfter) { redraw(); return; }
        figure.textContent = rupees(value * 100);
        const moved = base !== null && base.bidPaise !== value * 100;
        was.textContent = moved ? KEYWORDS.wasBid({ bid: rupees(base.bidPaise) }) : '';
        bar.showWas(moved ? Math.round(base.bidPaise / 100) : null);
        article.classList.toggle('changed', isChanged());
      }

      let paid = KEYWORDS.noClicks();
      if (card.isNew) paid = KEYWORDS.isNew();
      else if (card.stats?.cpcPaise != null) paid = KEYWORDS.paid({ cpc: rupees(card.stats.cpcPaise) });

      const stats = el('div', 'kstats');
      stats.append(
        stat(card.stats ? whole(card.stats.clicks) : '—', KEYWORDS.clicks()),
        stat(card.stats ? rupees(card.stats.costPaise) : '—', KEYWORDS.cost()),
        stat(card.stats ? (card.stats.conversions > 0 ? card.stats.conversions.toFixed(1) : '0') : '—', KEYWORDS.conv()),
      );
      box.append(match, reach, tags, bidRow, bar.node, el('p', 'kpaid', paid), stats);
      return box;
    }

    function qualityPanel(card) {
      const box = el('div', 'kqs-panel');
      box.append(el('p', 'kqs-title', KEYWORDS.qsTitle({ value: card.quality.value ?? '—' })));
      if (card.quality.value === null) {
        const none = el('p', 'kqs-note', KEYWORDS.qsNone({ impressions: whole(QUALITY_MIN_IMPRESSIONS) }));
        add(none, whyButton(KEYWORDS.qsNone, openGuide));
        box.append(none);
      } else {
        const parts = el('dl', 'kqs-parts');
        for (const part of card.quality.ratings) {
          parts.append(el('dt', null, part.label), el('dd', `rating-${part.rating}`, RATING_WORD[part.rating]()));
        }
        const note = el('p', 'kqs-note', KEYWORDS.qsNote());
        add(note, whyButton(KEYWORDS.qsNote, openGuide));
        box.append(parts, note);
      }
      const back = el('button', 'kback', KEYWORDS.back());
      back.type = 'button';
      back.dataset.key = `${card.id}:qs`;
      back.addEventListener('click', () => { state.qsOpen = null; redraw(); });
      box.append(back);
      return box;
    }

    function menu(card) {
      const box = el('div', 'kmenu');
      box.setAttribute('role', 'menu');
      const remove = el('button', 'kmenu-danger', KEYWORDS.remove());
      remove.type = 'button';
      remove.setAttribute('role', 'menuitem');
      remove.addEventListener('click', () => {
        removeKeyword(ctx.draft, card.id);
        state.menuOpen = null;
        staged();
        redraw();
      });
      const cancel = el('button', null, KEYWORDS.cancel());
      cancel.type = 'button';
      cancel.setAttribute('role', 'menuitem');
      cancel.addEventListener('click', () => { state.menuOpen = null; redraw(); });
      box.append(remove, cancel);
      queueMicrotask(() => remove.focus());
      return box;
    }

    function checkbox(card, article) {
      const box = el('button', 'kcheck');
      box.type = 'button';
      box.dataset.key = `${card.id}:check`;
      box.setAttribute('role', 'checkbox');
      box.setAttribute('aria-label', KEYWORDS.select({ keyword: card.text }));
      box.setAttribute('aria-checked', String(state.selected.has(card.id)));
      box.addEventListener('click', () => {
        if (state.selected.has(card.id)) state.selected.delete(card.id);
        else state.selected.add(card.id);
        const on = state.selected.has(card.id);
        box.setAttribute('aria-checked', String(on));
        article.classList.toggle('selected', on);
        bulk?.update();
      });
      return box;
    }

    function startSelecting() {
      state.selecting = true;
      state.selected.clear();
      state.qsOpen = null;
      state.menuOpen = null;
      bulk = bulkBar();
      setTrayOverride(bulk.node);
      redraw();
    }

    function stopSelecting() {
      state.selecting = false;
      state.selected.clear();
      bulk = null;
      setTrayOverride(null);
      redraw();
    }

    function bulkBar() {
      const bar = el('div', 'kbulk');
      const count = el('strong', 'kbulk-count');
      const note = el('span', 'kbulk-note');
      const numberBox = (text, value) => {
        const label = el('label', 'kbulk-label');
        const input = el('input', 'kfield knum');
        input.type = 'number';
        input.step = '1';
        input.value = value;
        label.append(el('span', null, text), input);
        return { label, input };
      };
      const action = (text, onClick, className = 'kbulk-apply') => {
        const b = el('button', `${className} press`, text);
        b.type = 'button';
        b.addEventListener('click', onClick);
        return b;
      };
      const apply = (change) => {
        const ids = [...state.selected];
        if (ids.length === 0) { note.textContent = KEYWORDS.pickFirst(); return; }
        const out = adjustSeveral(ctx.draft, ids, change);
        note.textContent = out.refused.length > 0
          ? KEYWORDS.refused({ n: out.refused.length, reason: out.refused[0].reason })
          : '';
        staged();
        redraw();
      };
      const setBox = numberBox(KEYWORDS.setBid(), '');
      const pctBox = numberBox(KEYWORDS.changeBy(), '-20');
      const setGroup = el('div', 'kbulk-group');
      setGroup.append(setBox.label, action(KEYWORDS.apply(), () => {
        const n = Math.round(Number(setBox.input.value));
        if (n >= 1) apply({ setBidPaise: n * 100 });
      }));
      const pctGroup = el('div', 'kbulk-group');
      pctGroup.append(pctBox.label, el('span', null, KEYWORDS.percent()), action(KEYWORDS.apply(), () => {
        const n = Number(pctBox.input.value);
        if (pctBox.input.value !== '' && Number.isFinite(n)) apply({ byPercent: n });
      }));
      const matchGroup = el('div', 'kbulk-group');
      matchGroup.append(el('span', null, KEYWORDS.matchAll()));
      for (const m of MATCHES) matchGroup.append(action(MATCH_WORD[m](), () => apply({ matchType: m }), 'kbulk-pill'));
      bar.append(count, setGroup, pctGroup, matchGroup, note, action(KEYWORDS.done(), stopSelecting, 'kbulk-done'));
      const update = () => { count.textContent = KEYWORDS.selected({ n: state.selected.size }); };
      update();
      return { node: bar, update };
    }

    function openPlanner(trigger) {
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
      search.value = planner.term;
      search.placeholder = KEYWORDS.plannerSearch();
      search.setAttribute('aria-label', KEYWORDS.plannerSearch());
      const bid = el('input', 'kfield knum');
      bid.type = 'number';
      bid.min = '1';
      bid.step = '1';
      bid.value = String(Math.round(planner.bidPaise / 100));
      bid.addEventListener('input', () => {
        const n = Math.round(Number(bid.value));
        if (n >= 1) planner.bidPaise = n * 100;
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

      const weekly = (q) => Math.round((ctx.weeklyVolume * q.volumeShareBp) / 10000);
      const all = [...ctx.queries].sort((a, b) => weekly(b) - weekly(a));
      const spec = (text) => ({ text, matchType: planner.matchType, bidPaise: planner.bidPaise });
      const addOne = (text) => {
        if (addKeyword(ctx.draft, spec(text), { tag: ctx.tagKeyword }).ok) { staged(); redraw(); fill(); }
      };

      function fill() {
        matchHost.replaceChildren(pills({
          options: matchOptions(), value: planner.matchType, label: KEYWORDS.match(),
          onPick: (m) => { planner.matchType = m; fill(); },
        }));
        planner.term = search.value;
        const held = new Set(ctx.draft.keywords.map((k) => normal(k.text)));
        const term = normal(search.value);
        const shown = all.filter((q) => !term || q.text.includes(term)).slice(0, PLANNER_ROWS);
        const addable = shown.filter((q) => !held.has(normal(q.text)));
        extra.replaceChildren();
        if (term && !all.some((q) => normal(q.text) === term) && !held.has(term)) {
          const mine = el('button', 'kplanner-mine press', KEYWORDS.plannerOwn({ text: search.value.trim() }));
          mine.type = 'button';
          mine.addEventListener('click', () => { addOne(search.value.trim()); search.value = ''; fill(); });
          extra.append(mine);
        }
        if (addable.length > 1) {
          const every = el('button', 'kplanner-all', KEYWORDS.plannerAddAll({ n: addable.length }));
          every.type = 'button';
          every.addEventListener('click', () => {
            addKeywords(ctx.draft, addable.map((q) => spec(q.text)), { tag: ctx.tagKeyword });
            staged();
            redraw();
            fill();
          });
          extra.append(every);
        }
        list.replaceChildren(...shown.map((q) => {
          const inAccount = held.has(normal(q.text));
          const name = el('div', 'kplanner-name');
          name.append(el('strong', null, q.text), el('span', null, q.intent));
          // The search's own tags (E9), and a count only (E8), as the classic planner's.
          const reach = ctx.reach({ text: q.text, matchType: planner.matchType, tags: ctx.tagKeyword({ text: q.text }).tags });
          const pick = el('button', inAccount ? 'kplanner-held' : 'kplanner-add press',
            inAccount ? KEYWORDS.plannerHeld() : KEYWORDS.plannerAdd());
          pick.type = 'button';
          pick.disabled = inAccount;
          pick.addEventListener('click', () => addOne(q.text));
          const row = el('div', 'kplanner-row');
          row.append(name, el('span', 'knum', whole(weekly(q))), el('span', 'knum', whole(reach)), pick);
          return row;
        }));
      }

      search.addEventListener('input', fill);
      drawer.append(head, search, controls, extra, cols, list, el('p', 'kplanner-note', KEYWORDS.plannerNote()));
      fill();
      document.body.append(overlay, drawer);
      search.focus();
    }

    redraw();
    return { node, refresh: redraw };
  }
  ```

- [ ] **Step 5: Mount it in the shell.** In `ui/shell/shell.js`: import
  `renderKeywordsSection` from `../keywords/render.js`; keep a
  `let keywords = null;`; in `draw()`, after the dashboard:

  ```js
      keywords = renderKeywordsSection({
        game, ctx, openGuide, openSection: open, setTrayOverride,
      });
  ```

  (move `function setTrayOverride` above `draw` if needed); in `drawSection()`,
  before the dashboard branch:

  ```js
      else if (s.draws?.includes('keywords') && keywords) shown = keywords.node;
  ```

  and in `makeChip`'s undo, after `ctx.refresh();`, add `keywords?.refresh();`.
  Add `'kit/controls.js'` and `'keywords/render.js'` to `LOADABLE`.

- [ ] **Step 6: The section's styles,** appended to `ui/studio.css`. Values are the
  mock-up's (`design/makeover/Main.dc.html`) in Red signal:

  ```css
  /* --- Your keywords (spec section 4) --------------------------------------- */
  body.studio .khead { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin: -8px 0 16px; }
  body.studio .ksub { margin: 0; font-size: 14px; color: var(--studio-muted); }
  body.studio .ktools { display: flex; align-items: center; gap: 10px; }
  body.studio .kpills { display: flex; gap: 4px; }
  body.studio .kpill { padding: 4px 9px; border: 1px solid var(--studio-line-strong); border-radius: 999px; background: none; color: var(--studio-muted); font-size: 12px; font-weight: 600; white-space: nowrap; }
  body.studio .kpill[aria-checked="true"] { border-color: var(--studio-red); background: var(--studio-red); color: var(--studio-on-red); }
  body.studio .kswitch { gap: 2px; padding: 3px; border-radius: 999px; background: #211E24; }
  body.studio .kswitch .kpill { padding: 6px 14px; border: 0; font-size: 13px; }
  body.studio .kadjust { height: 38px; padding: 0 16px; border: 1px solid var(--studio-line-strong); border-radius: 999px; background: none; color: var(--studio-text); font-size: 14px; }

  body.studio .kpanel { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr) minmax(0, 0.95fr); gap: 28px; align-items: center; margin-bottom: 16px; padding: 16px 22px; border: 1px solid var(--studio-panel-edge); border-radius: 20px; background: var(--studio-panel); color: #F3EEEA; }
  body.studio .kpanel h3 { margin: 2px 0 4px; font: 800 24px/1.1 var(--studio-display); }
  body.studio .kpanel p { margin: 0; font-size: 13px; line-height: 1.45; color: #D9D1CB; }
  body.studio .kpanel .kpanel-eyebrow, body.studio .kpanel .kpanel-small { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #A8989A; }
  body.studio .kbar { display: flex; gap: 2px; height: 12px; margin: 8px 0; overflow: hidden; border-radius: 6px; }
  body.studio .kbar span { flex-basis: 0; min-width: 2px; background: #4A444A; }
  body.studio .kbar span.lead { background: var(--studio-red); }
  body.studio .kbar span:nth-child(2) { background: #8F8589; }
  body.studio .kbar span:nth-child(3) { background: #6F676C; }
  body.studio .klegend { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 0; padding: 0; list-style: none; font-size: 12px; color: #D9D1CB; }
  body.studio .klegend li { display: flex; align-items: center; gap: 6px; }
  body.studio .klegend strong { color: #F3EEEA; font-variant-numeric: tabular-nums; }
  body.studio .klegend-key { width: 8px; height: 8px; border-radius: 2px; background: #8F8589; }
  body.studio .klegend li.lead .klegend-key { background: var(--studio-red); }
  body.studio .kpanel-levers { display: flex; flex-direction: column; gap: 8px; }
  body.studio .klever { display: flex; flex-direction: column; gap: 1px; padding: 8px 12px; border: 1px solid #5A262C; border-radius: 12px; background: none; color: #F3EEEA; text-align: left; }
  body.studio .klever strong { font-size: 13px; }
  body.studio .klever span { font-size: 12px; font-weight: 400; color: #A8989A; }

  body.studio .kgrid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
  body.studio .kcard { position: relative; display: flex; flex-direction: column; gap: 10px; min-width: 0; padding: 14px 16px 16px; border: 1px solid var(--studio-line); border-radius: 20px; background: var(--studio-card); box-shadow: 0 0 0 1px transparent; }
  body.studio .kcard.changed { border-color: var(--studio-red); box-shadow: 0 0 0 1px var(--studio-red); }
  body.studio .kcard.selected { border-color: var(--studio-text); box-shadow: 0 0 0 1px var(--studio-text); }
  body.studio .kcard.paused { background: #121114; }
  body.studio .kcard.paused .kcard-name { color: #6E6872; }
  body.studio .kcard-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; height: 26px; }
  body.studio .kcard-left, body.studio .kcard-right { display: flex; align-items: center; gap: 6px; }
  body.studio .kcard-name { display: -webkit-box; height: 44px; margin: 0; overflow: hidden; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow-wrap: anywhere; font: 700 19px/1.15 var(--studio-display); }
  body.studio .kcard-body, body.studio .kqs-panel { display: flex; flex: 1; flex-direction: column; gap: 6px; min-width: 0; }
  body.studio .kreach, body.studio .ktags, body.studio .kpaid { height: 16px; margin: 0; overflow: hidden; font-size: 12px; line-height: 16px; color: var(--studio-muted); text-overflow: ellipsis; white-space: nowrap; }
  body.studio .ktags.warn { color: var(--studio-amber); }
  body.studio .kwas { font-size: 12px; font-weight: 600; color: var(--studio-red-text); }
  body.studio .kbid-row { display: flex; align-items: center; gap: 8px; height: 30px; margin-top: 4px; }
  body.studio .kbid-row .kwas { margin-left: auto; }
  body.studio .klabel { font-size: 12px; color: var(--studio-muted); }
  body.studio .kbid { padding: 0; border: 0; border-bottom: 1px dashed #4A454F; border-radius: 0; background: none; color: var(--studio-text); font: 800 22px/28px var(--studio-display); font-variant-numeric: tabular-nums; }
  body.studio .kbid-row .kbid:only-of-type { margin-left: auto; }
  body.studio .kbid-input { width: 84px; height: 30px; text-align: right; font-weight: 700; }
  body.studio .kslider { position: relative; height: 18px; }
  body.studio .kslider input[type="range"] { width: 100%; margin: 0; accent-color: var(--studio-red); }
  body.studio .kcard.paused .kslider input[type="range"] { accent-color: #5A5560; }
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
  body.studio .kcheck { width: 20px; height: 20px; padding: 0; border: 2px solid var(--studio-line-strong); border-radius: 6px; background: none; }
  body.studio .kcheck[aria-checked="true"] { border-color: var(--studio-text); background: var(--studio-text); }
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

  body.studio .kbulk { display: flex; flex: 1; align-items: center; gap: 14px; min-width: 0; color: var(--studio-text); }
  body.studio .kbulk-count { min-width: 92px; font-size: 14px; white-space: nowrap; }
  body.studio .kbulk-group, body.studio .kbulk-label { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--studio-muted); white-space: nowrap; }
  body.studio .kbulk-label input { width: 64px; }
  body.studio .kbulk-apply { padding: 7px 14px; border-radius: 999px; background: var(--studio-red); color: var(--studio-on-red); font-size: 13px; }
  body.studio .kbulk-pill { padding: 6px 11px; border: 1px solid #4A454F; border-radius: 999px; background: none; color: var(--studio-text); font-size: 12px; }
  body.studio .kbulk-note { flex: 1; min-width: 0; overflow: hidden; font-size: 12px; color: var(--studio-amber); text-overflow: ellipsis; white-space: nowrap; }
  body.studio .kbulk-done { padding: 9px 18px; border: 1px solid #4A454F; border-radius: 999px; background: none; color: var(--studio-text); font-size: 14px; }

  @media (max-width: 1280px) { body.studio .kgrid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 1000px) {
    body.studio .kgrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    body.studio .kpanel { grid-template-columns: minmax(0, 1fr); gap: 14px; }
  }
  @media (max-width: 620px) {
    body.studio .kgrid { grid-template-columns: minmax(0, 1fr); }
    body.studio .khead { flex-direction: column; align-items: flex-start; }
    body.studio .kbulk { flex-wrap: wrap; row-gap: 6px; overflow-y: auto; }
  }
  ```

  At phone width the bulk bar wraps inside a 76px tray. If it cannot fit, let the
  tray grow while selecting (`body.studio .studio-tray.bulk { height: auto; min-height: 76px; padding: 8px 12px; }`)
  and check that nothing above it moves.

- [ ] **Step 7:** `npm test`. Expected: green, the drawing guard included.

- [ ] **Step 8: Play it** on the dev server with `?look=studio`, in Your keywords,
  and check each of these:
  - drag a bid: the figure, "was", the outline and the tray follow, and the drag
    never breaks;
  - tap the figure, type 140, and press Enter: the slider widens to fit;
  - flip every match type: the reach changes, and tags appear on broad;
  - pause with the switch;
  - open QS, read its parts, and follow its "why?" into the new chapter;
  - remove a keyword from ⋯, then undo it from the tray;
  - add from the planner, add one of your own, and use "Add all";
  - Adjust several: set a bid, change bids by −20%, switch the match type, and
    confirm the cards above never move;
  - switch between This week and All weeks: the numbers change, and so does the
    search terms report in What people typed;
  - the reading panel's levers each go where they say;
  - keyboard only: every control is reachable and focus survives a redraw;
  - the console is clean.

  Then play one classic week. Commit: *Draw Your keywords: cards, the reading
  panel, the planner and adjust several*.

  *Found when built:* as amended above, the section draws the kit's card and
  planner rather than its own. The kit's `keywordCard` gained two optional parts,
  `onActive` (the running switch) and `select` (the tick), and draws "was", the
  slider's was-marker and the changed, paused and selected outlines from the
  model, which gained `changed` (round 0's is false). `render.js` is the head,
  the reading panel, the grid and Adjust several, about 300 lines where the plan
  had 540. The planner shares `ctx.planner`, the classic planner's own state.
  The section exposes `leave()`, which the shell calls on leaving it while
  picking, or the tray would keep the bar in another section; and the shell
  refreshes it on the way in, since another section may have staged a change.
  The owner asked for round 0's reserve warning on every week's card (commits
  before this one). `ctx.refresh` exists: `renderDecisions` writes it back.
  Playing it found three things, each its own commit or fixed here: the tray
  showed "0 changes waiting" beside "No changes yet", because a class's
  `display` outranked `hidden` (fixed for the whole Studio); a played week's
  top bar ran to 497px on a 375px phone, as round 0's once did; and Adjust
  several's bar, on one line, pushed the page sideways at 673px, so it wraps
  and the tray grows at any width. Its tick measured 1.52:1 against a card and
  now uses the 3:1 grey. The Enter key does not reach the typed-bid box in the
  browser pane, so that was committed with Tab. The build publishes 83 files.

---

### Task 9: the motion

**Files:** modify `ui/studio.css` only.

- [ ] **Step 1: The motion rules,** appended to `ui/studio.css`, as spec section 3
  sets them:

  ```css
  /* --- motion (spec section 3): six moments, transform and opacity only ----- */
  body.studio .studio-chip,
  body.studio .kmenu,
  body.studio .kplanner,
  body.studio .kplanner-overlay,
  body.studio .studio-dot.arrive,
  body.studio .studio-section.first-open .arriving { transition: opacity 200ms var(--studio-ease), transform 200ms var(--studio-ease); }
  body.studio .kmenu { transition-duration: 150ms; }
  body.studio .kplanner, body.studio .kplanner-overlay { transition-duration: 220ms; }
  body.studio .studio-chip.leaving { opacity: 0; transition-duration: 150ms; }
  body.studio .kplanner.closing { opacity: 0; transform: translateX(100%); transition-duration: 150ms; }
  body.studio .kplanner-overlay.closing { opacity: 0; transition-duration: 150ms; }
  body.studio .ktoggle-knob { transition: transform 150ms var(--studio-ease); }
  body.studio .press { transition: transform 160ms ease-out; }
  body.studio .press:active { transform: scale(0.97); }

  @starting-style {
    body.studio .studio-chip { opacity: 0; transform: translateY(8px); }
    body.studio .kmenu { opacity: 0; transform: scale(0.97); }
    body.studio .kplanner { opacity: 0; transform: translateX(100%); }
    body.studio .kplanner-overlay { opacity: 0; }
    body.studio .studio-dot.arrive { opacity: 0; transform: scale(0.8); }
    body.studio .studio-section.first-open .arriving { opacity: 0; transform: scale(0.97); }
  }

  /* Reduced motion keeps every fade, which moves nothing, and drops the
     movement, the press and the stagger. */
  @media (prefers-reduced-motion: reduce) {
    body.studio .press:active { transform: none; }
    body.studio .ktoggle-knob { transition: none; }
    body.studio .kplanner.closing { transform: none; }
    body.studio .studio-section.first-open .arriving { transition-delay: 0ms !important; }
    @starting-style {
      body.studio .studio-chip, body.studio .kmenu, body.studio .kplanner,
      body.studio .studio-dot.arrive, body.studio .studio-section.first-open .arriving { transform: none; }
    }
  }
  ```

- [ ] **Step 2: The first visit's cards arrive, once.** In `ui/shell/shell.js`,
  `drawSection()`, in the dashboard branch and before
  `dashboard.dataset.section = s.key;`:

  ```js
        if (view.firstOpen === s.key) {
          // The section's cards come out of display: none, so @starting-style
          // gives them an entrance; 40ms apart, at most six (spec section 3, row 3).
          const cards = s.slots.flatMap((slot) => [...dashboard.querySelectorAll(`[data-slot="${slot}"]`)]);
          cards.slice(0, 6).forEach((card, i) => {
            card.classList.add('arriving');
            card.style.transitionDelay = `${i * 40}ms`;
          });
          setTimeout(() => cards.forEach((card) => {
            card.classList.remove('arriving');
            card.style.transitionDelay = '';
          }), 600);
        }
  ```

  The same treatment applies when a rebuilt section is first opened: the section
  node's own cards take `arriving` in the same way.

- [ ] **Step 3: Check it moves only where it should.** On the dev server:
  - a new tray line rises in;
  - dragging a bid does not replay the line's entrance;
  - undo fades the line out;
  - the planner slides in and back out, faster going out;
  - ⋯ grows from its button;
  - the Run button presses;
  - the switch's knob slides;
  - at week 6, Returns' dot arrives once, and its cards arrive on the first open
    only.

  Then turn on reduced motion in the operating system: only fades remain. No
  number ever rolls.

- [ ] **Step 4: The owner runs `/review-animations`** on the diff. If it is not
  available in the session, stop and say so rather than skip it. Fix what it
  flags; `npm test`; commit: *Move only where it explains: the tray, drawers,
  the menu, press, the switch and a section's first visit*.

  *Found when built:* as amended above, only the tray's lines, the switch's
  knob, the section dot and a section's first visit were new; the press, the
  drawer and the menu came with round 0. Row 2 (revised figures) waits for Your
  week to be rebuilt. Two things in Step 2's code were wrong. `view.firstOpen`
  lasts until another section is opened, so every other redraw of the section
  (the menu, on a phone) played the cards' entrance again; it is now spent as
  it plays, in the shell's `arrive`. And a dot's entrance was spent in the
  first draw even where the list is hidden behind the menu (under 900px), so on
  a phone it never showed; it now waits for the list to be seen, asked of the
  width (`LIST_BEHIND_MENU`), because the first draw happens before the shell
  is on the page. No rebuilt section is ever fresh yet (Your keywords has no
  `opensAt`), so the rebuilt-section case in Step 2 has nothing to act on. The
  browser pane cannot turn on reduced motion; the rules were read back from the
  page as written.

  *The review:* `/review-animations` was not in the session, so the owner had
  `improve-animations` run on this task's diff instead, as in round 0's Task 14.
  It found two things; the owner took the first. The tray's strip scrolls
  sideways and never scrolled to a new line, so at 673px the second line showed
  41 of its 271px and every later one none: the change just made entered out of
  sight. The strip now scrolls to a line as it arrives, smoothly, or at once
  under reduced motion. Declined: fading the "changes waiting" badge in with the
  week's first line.

---

### Task 10: play it through, and measure

- [ ] **Twelve weeks** in the studio look with a seven-keyword account: every
  section, every control, the guide from three chapters, Redo round 0, the
  capital week, the Returns unlock, the debrief and reveal in Results. Then play
  a classic week.
- [ ] **Sixty keywords:** a new game, *Add all* in the planner until about sixty,
  every one broad; play two weeks. If the cards cannot cope, tell the owner and
  propose the compact list view the spec names; do not build it unasked.
- [ ] **Phone width**, 375 × 812: the menu, one column of cards, the planner full
  width, the bulk bar in the tray, and no horizontal scroll on the page.
- [ ] **The word count,** with seven keywords. In the browser pane:

  ```js
  const names = [...document.querySelectorAll('.kcard-name')].map((n) => n.textContent);
  let text = document.querySelector('.ksection').innerText;
  for (const name of names) text = text.split(name).join(' ');
  text.split(/\s+/).filter((w) => /[a-z]{2,}/i.test(w)).length;
  ```

  Report the figure against the spec's "about 120". Labels repeat on every card,
  so state the per-card share too.
- [ ] **A playtest file:** one game with `?playtest=1&look=studio`, read with
  `node scripts/read-playtest.js`. Sections and clicks must be named.
- [ ] Each finding becomes a fix, test first where it can be tested, one commit
  each.
- [ ] **The gate: the owner plays it.** Hand over the dev-server link (or the
  branch preview, if the owner has said to push) and ask the spec's own question:
  does it feel alive, or only tidier? Their answer decides whether the pilot is
  done, and what the next section changes first.

  *Played, 2026-09-14.* Twelve weeks in the Studio with seven keywords, recorded
  with `?playtest=1`: every section; the keyword controls, a blocked search, a
  place and two hours; the guide from three places (the head, the reading panel,
  a card's QS) and from its contents; Redo round 0 once, which starts round 0
  afresh in both looks and is then gone; the capital week, its window's five
  cards arriving; Returns at week 6 and a prepaid discount; the debrief, whose
  What if I hadn't? answered for week 2, and the reveal's eight answers. A
  classic week played after, with sixty keywords. Word count with seven
  keywords: 158 against about 120, of which 105 are the cards' repeated labels
  (15 each), the panel 45, the head 9 and the add card 9. Sixty broad keywords
  (and a sixty-two keyword round 0): a drag 4 to 7ms a step after the fix below,
  the reading panel folds the rest into "14 others", but a click that redraws
  the section took 274ms and the section is about 11,600px, twenty screens; put
  to the owner with the compact list view the spec names, not built. Phone at
  375 x 812: every section 375px wide by element edges, the menu, one card a
  row, the planner 375px wide once its entrance is finished, the bar in a 146px
  tray. The playtest file, read with `read-playtest.js`: every screen named in
  order, the replay matched, the clicks named by region (Round 0 steps, Your
  keywords, Add keywords, Tray, Sections, Icon strip, each chapter, Where did
  they sit?). Its cards-by-time list was empty because the browser pane's page
  is hidden and the sampler skips hidden ticks; its own logic, run by hand,
  names the sections and cards on screen.

  Found and fixed, one commit each: a prepaid discount was sent and listed
  nowhere, in the tray or the classic summary (`54d5229`); a first visit's
  stagger followed the slot list, not the page, so Your money's top card came
  last (`b711db5`); a bid drag ran the form's whole refresh every step, 41ms
  with sixty keywords, now the tray alone and one refresh on release
  (`42fd67f`); round 0's drag worked out every card, 18ms, now one (`00308b3`).

  *The gate passed, 2026-09-15:* the owner played it and said "Alive". Their
  follow-ups, playing it in a desktop browser: the guide's contents numbered
  (`9b89a14`); a section's cards at full width, one to a row, with one page
  scroll and slim scrollbars (`0665225`); and, to come, the brand as a pick
  from the nine, Your ad read-only, and Where and when's controls redrawn as
  mock-ups first.

---

### Task 11: docs

- [ ] **The spec's corrections:**
  - Your ad has no weekly card, and its section says so;
  - the new *Quality Score* chapter;
  - the tray replaces *Next week*, not *This week only*;
  - the planner kept *Add all*;
  - today's cards are filtered by section, never moved;
  - `ui/shell/tray.js` holds only the tray's order, and the tray is drawn in
    `ui/shell/shell.js`.
- [ ] **HANDOVER, *Start here*:** the pilot is built on `makeover`; how to open it
  (`?look=studio`); what the play-through found; what comes next (spec section 7).
- [ ] **CLAUDE.md:**
  - the published file count, which moves from 54 (also in HANDOVER and
    `wrangler.jsonc`);
  - a new known trap: *a section shows today's cards by filtering, never by moving
    them: the form redraws into its own region, and a moved card is drawn into
    nothing*;
  - the guard that new drawing modules hold no sentence.
- [ ] `npm test`; commit: *Record the Studio pilot: what was built and what
  playing it found*.
- [ ] **Ask the owner** whether to push `makeover`. Cloudflare builds a preview
  for a branch behind the same sign-in, so the owner can play it on a phone
  without touching the live game.
