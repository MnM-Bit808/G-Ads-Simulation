# Stage C1 and C2: the content model and the field guide

*Design, 2026-09-12. Decided with the owner in conversation, one section at a time.
No code has been written against it. Stage C of `reviews/slc-review.md`.*

## 1. Why

The screens carry about 10,000 hand-written words in roughly 460 sentences,
counted on `main` at `cf92f6c`:

| file | words |
|---|---|
| `ui/decisions.js` | 3,571 |
| `ui/round-zero.js` | 2,563 |
| `ui/dashboard.js` | 1,608 |
| `ui/ending.js` | 986 |
| `ui/chart.js` | 814 |
| `ui/app.js`, `ui/index.html` | 295 |

Almost every card works out its numbers and writes its sentences in the same
function. That causes three problems:

- **The wording cannot be tested.** HANDOVER names this as a defect: "for six of
  seven prompting cards the wording lives inside the drawing". Stage A's ten false
  sentences all lived there, several of them numbers typed by hand that had
  drifted from the constants.
- **Nothing sorts a sentence by what it is for.** A concept ("a click settles
  about five weeks later"), a reading of the account ("45% came back"), a
  disclosure ("the game departs from reality here") and an instruction all look
  alike and all stay on screen forever.
- **The one human playtester skimmed everything.** Text that is always on screen
  is text nobody reads.

The owner decided on 2026-09-12 that explanations move into an optional **field
guide inside the game**, reached from "why?" links, with one content source
feeding both the screen and the guide (memory note `field-guide-direction`).
This document designs the first two of stage C's five pieces.

## 2. Scope and sequence

| # | piece | this document |
|---|---|---|
| C1 | content model | **designed here; built as a one-card pilot** |
| C2 | field guide | **designed here; built for the pilot card only** |
| C3 | round 0 as five steps | not here. Waits for the playtest files and the owner's I11 decision |
| C4 | dashboard that reveals itself | not here. Waits for the playtest files' card times |
| C5 | bulk bid editing | not here. Independent |

**The pilot is one card, "What came back"** (the returns card, `renderReturns` in
`ui/dashboard.js`). It is chosen because it:
- has all four kinds of sentence in about 20 lines;
- carries the week-6 returns lesson, one of the game's true moments;
- has a typed number in its "nothing has settled" note ("about five weeks"),
  which the no-typed-numbers test exists to catch.

Every other card moves into the content model when C2, C3 or C4 rebuilds its
screen, not in one sweep. Moving 10,000 words at once is a large, risky change
that shows the player nothing.

**Playtest constraint.** Three stranger playtests are running on the tagged
commit `playtest-1`. **Nothing from this document is pushed to `main` until
every playtest file has been read**, because a push redeploys and a save
replayed on a changed engine no longer reproduces the player's game. All work
is committed locally.

## 3. The content model (C1)

### Where it lives

`ui/words/`, one module per card: `ui/words/returns.js` for the pilot, plus a
small `ui/words/line.js` holding the `line()` helper and the list of kinds.

**Under `ui/` on purpose.** `tests/ui.test.js` already scans every `ui/` file
and fails if one:
- reads a field the engine withholds from every viewer (`priceAffinity`,
  `convMultiplier` and the rest of `FORBIDDEN_IN_PUBLIC_VIEW`), or a function
  that derives one (`homeCell`);
- names a constant the view must not compute with (`AD_RANK_FLOOR` and others).

Putting the words there gives them both guards for free. A words module imports
nothing from `engine/`: every figure a sentence quotes is passed in by the render
function that uses it, which already works it out today. So the rule on which
constants the view may name keeps applying where it applies now, in the render
functions, including the one narrow allowance `dashboard.js` has for
`ATTRIBUTION_LAG_DISTRIBUTION` (quoted, never computed with).

### What an entry is

A function from the figures it needs to a string, labelled with its kind:

```js
// ui/words/returns.js
export const RETURNS = Object.freeze({
  nothingSettled: line('reading', ({ settlesAfter, firstHonestWeek }) =>
    `Nothing has settled yet. A click is final about ${settlesAfter} weeks after it `
    + `happens, so the first honest reading of this card is week ${firstHonestWeek}.`),
  // …
});
```

and the render function asks for words rather than typing them:

```js
note.textContent = RETURNS.nothingSettled({
  settlesAfter: SETTLES_AFTER_ROUNDS,
  firstHonestWeek: SETTLES_AFTER_ROUNDS + 1,
});
```

The figures are worked out where they are today, in the render function, from
the game and the constants. The words module only phrases them. It imports
nothing from `engine/`, so it cannot compute anything.

### The four kinds

| kind | what it is | where it may appear |
|---|---|---|
| `reading` | a statement about this player's account | on screen |
| `disclosure` | where the game departs from real Google Ads | on screen, and **must** carry `why:` naming a guide chapter (DECISIONS I11: an abstraction is honest only if the screen says so) |
| `instruction` | how to use a control | on screen, meant to become a label or tooltip (in C4) |
| `concept` | how something works | **never on screen.** Concepts are guide chapters (section 4), so `line()` refuses the kind |

A sentence that mixes kinds is split. Where a split would make the screen read
worse, the entry keeps its main kind and a comment says what else it carries.

### What the player sees change in C1

**Nothing.** The pilot moves the returns card's sentences verbatim, apart from
replacing typed numbers with the constants they came from. Concept sentences stay
on the card until C2 gives them somewhere to go.

### Tests (`tests/words.test.js`), written first

1. Every entry is made by `line()` with one of the three on-screen kinds, and
   `line()` refuses `concept`.
2. Every `disclosure` has a `why`, and every `why` names a chapter in the guide's
   registry. In C1 the registry holds titles only; C2 writes the chapters.
3. **No number is typed into any sentence.** A source scan of `ui/words/*.js`
   finds no digit in any string or template literal outside a `${…}`. This one
   test would have caught most of stage A's ten false sentences, such as
   "₹1,00,000" typed where the constant said ₹1,20,000.
4. **Once a card is moved, its render function holds no prose.** A source scan of
   `renderReturns` finds no string literal of three or more words, the way
   `tests/ui.test.js` already reads source for forbidden names.
5. `ui/words/*.js` is added to the `LOADABLE` list in `tests/ui.test.js`, whose
   completeness test fails otherwise.

### Verification by playing

Before the move, replay one saved game on the dev server to week 7 and copy the
returns card's text. After the move, replay the same save and compare. **They
must match word for word.** The only exception is a typed number replaced by its
constant; if the constant differs from what was typed, that is a false sentence
found, and it gets its own commit.

## 4. The guide's content (C2)

### Where it lives

`ui/guide/chapters.js`, one frozen entry per chapter, under `ui/` for the same
leak guards. A chapter may explain *that* each search has a hidden fit to each
position; it may never print one of those figures.

### What a chapter holds

The shape, with the prose elided (the text is drafted in build step 2):

```js
attributionLag: chapter({
  title: 'Why this week’s numbers keep moving',
  real: () => '…',                   // In real Google Ads
  realSources: [{ label: '…', url: 'https://support.google.com/google-ads/…' }],
  needs: ['settlesAfter'],           // the figures the game part quotes
  game: ({ settlesAfter }) => `…`,   // In this game
  cites: ['I27', '§11.3', '§11.4'],
  yourAccount: 'revised',            // the card where you can see it happen
  related: ['returnsSplit'],
}),
```

**Where a chapter's figures come from.** Like the words, a chapter imports no
constants. It declares the figures it quotes in `needs`, and the guide is handed
one `figures` object by the dashboard, built from the same places the cards take
theirs. A chapter therefore cannot quote a number the screen does not have, and
the rule on which constants the view may name stays in one place.

Each chapter has three parts:
- **In real Google Ads**: the real mechanism in plain words, with at least one
  source. Google's own help pages are preferred over blogs.
- **In this game**: what the model does and where it departs, citing the entries
  it rests on.
- **In your account**: a link to the card where the player can see it happening.

**Citation formats**, the only ones the test accepts:
- `A6`, `I27` and so on: a DECISIONS entry, matched against a heading `### A6.`;
- `H1` to `H10`: the numbered items of DECISIONS section H, *What the
  simulation gets right*;
- `§12.1`: a heading in `ENGINE_SPEC_v0.3.md`.

**Two kinds of chapter, one shape:**
- **Concept chapters** (quality, second-price auctions, match types, attribution
  lag, returns) have both parts.
- **Game-device chapters** (the writer tiers, the weekly split, the capital
  ladder) have no real equivalent. Their real part says so plainly, for example
  "Google Ads has no notion of who wrote your ad", and they are marked
  `device: true`. Only a device may have no `realSources`, because an absence
  cannot be cited.

**Numbers.** The game part follows the words' rule: no typed numbers. "A
13-week window" arrives as a figure the screen passes in from
`QUALITY_WINDOW_ROUNDS`. The real part may carry
numbers, because they are claims about Google with a source, such as its 1-10
Quality Score scale.

**Length.** At most 120 words per part, so under 250 a chapter. It is optional
depth, and depth nobody finishes teaches nothing.

### Scope

About 15-20 chapters in the end: roughly one per lesson DECISIONS H1-H10 claims,
plus attribution lag, returns, cash on delivery, the week-8 ranking trap (D4),
smart bidding's learning period (D2) and the game devices. **C2 writes only the
chapters the pilot card links to**, expected to be three:

| chapter | cites (to be confirmed while drafting) |
|---|---|
| numbers that keep moving | I27, §11.3, §11.4 |
| refused at the door against sent back | I28, F14 |
| cash on delivery, and where you advertise | G4 |

### How a chapter is written and checked

1. Claude drafts the chapter from the spec and DECISIONS. **Every real-world claim
   comes from a source fetched while drafting, never from memory**, and the
   source goes in `realSources`.
2. The owner reads it and judges whether a learner would follow it. Claude judges
   whether it is true.
3. It ships only after both.

### Tests (`tests/guide.test.js`), written first

1. Every chapter has a title, a real part and a game part, each within 120 words.
2. **Every citation exists**: the test reads `DECISIONS.md` and
   `ENGINE_SPEC_v0.3.md` and finds each cited heading or H item.
3. Every real part has at least one source URL, unless the chapter is a device.
4. No typed numbers in any title or game part.
5. Every `why` on screen and every `yourAccount` card lands on something that
   exists: a chapter in the registry, and a card by its `data-slot`.
6. **No orphans**: every chapter is reachable from some `why`, or listed in the
   guide's contents.
7. **Every chapter renders**: called with a `figures` object holding exactly
   what the dashboard supplies, no chapter's text contains `undefined` or `NaN`,
   and every name in `needs` is a figure the dashboard supplies.

**What test 2 cannot do.** It proves a cited entry *exists*, not that the chapter
*agrees* with it. Agreement is checked by reading, when drafting and when
reviewing. So when a DECISIONS entry changes, search `ui/guide/` for its ID and
re-read the chapters that cite it. Section 7 proposes adding that to CLAUDE.md's
known traps.

## 5. The guide on screen (C2)

### The "why?" link

A small link at the end of a disclosure line, and in place of any concept
sentence that leaves a card. One click opens the guide at that chapter.

### Where it opens: three directions, mocked up before any code

| | direction | good at | costs |
|---|---|---|---|
| **A** | a side drawer that slides in from the right over the dashboard, full width on a phone, with its own contents list | you keep your place and read beside the card it explains | covers part of the dashboard while open |
| **B** | unfolds inside the card, below the line | no navigation at all | makes cards taller, the problem the review measured; a two-part chapter is long |
| **C** | a guide page, reached from a "Field guide" button in the header, with "back to your account" | a place to browse every chapter | leaves the game to read it |

**Recommendation: A, with C's contents list inside it.** A "Field guide" button in
the header opens the same drawer at the contents list. The choice is made on the
mock-ups, not here.

**The mock-ups.** One design canvas (the `design` skill), published as a private
artifact:
- all three directions, each showing the returns card at week 6 with real
  figures from a replayed game and the actual drafted chapters, so words and
  layout are judged together;
- a phone-width version of the chosen direction, added after the choice.

### Behaviour, whichever direction wins

- **Keyboard and screen readers.** The guide is a dialog (`role="dialog"`,
  labelled by its title). Opening moves focus into it, Esc closes it, and focus
  returns to the "why?" it came from.
- **"In your account"** closes the guide, scrolls to the card, and marks it
  briefly so the eye lands on it.
- **The playtest recorder sees it.** The guide's container is a `.card` whose
  `h2` is the chapter title, so `ui/recorder.js` times chapter reading and names
  "why?" clicks with no change to the recorder. A later playtest can then answer
  whether anyone opens the guide at all.

### Motion: one transition, and nothing else

For direction A (adjusted to whichever direction wins):
- **enter**: `transform: translateX(100%)` to `0` with opacity 0 to 1, 220ms,
  `cubic-bezier(0.23, 1, 0.32, 1)`, via CSS transitions and `@starting-style`,
  so no library and no new published file beyond the module itself;
- **exit**: about 150ms, ease-in;
- **reduced motion**: opacity only, 150ms;
- **the "your account" marker**: an outline that fades out. If
  `review-animations` reads it as decoration, it becomes a static outline removed
  on the next interaction.

The diff must pass `review-animations` before it is committed. No counting
tickers, no motion on data (review section 13).

## 6. Build order

Each step is a commit after a green `npm test`, local only until the playtest
files are read.

1. **C1 pilot, tests first.** `ui/words/line.js`, `ui/words/returns.js`, a
   title-only chapter registry, `tests/words.test.js`; `renderReturns` asks for
   words. Verified word for word on a replayed save.
2. **Draft the three chapters**, sources fetched while drafting. The owner reviews
   them.
3. **Mock-ups** of directions A, B and C on the design canvas. The owner picks
   one.
4. **C2.** `ui/guide/` (chapters and the drawer or chosen shape),
   `tests/guide.test.js`, the returns card's "why?" links, and the concept
   sentences moved off the card. Verified by playing to week 7 and opening every
   link, by keyboard as well as by mouse. `review-animations` on the motion.
5. **Docs**: HANDOVER *Start here*, the published file count in CLAUDE.md,
   HANDOVER and `wrangler.jsonc`, and the known-traps line (section 7).

## 7. Left open, and why

- **Word limits for on-screen lines** (for example a reading of at most 25 words)
  belong to C4, which sets the 1,000-words-a-week budget. The pilot moves words
  verbatim, so a limit now would fail on day one for sentences C4 will rewrite.
- **Collapsing a note once it has been seen** is C4.
- **Round 0's wording** moves with C3, and C3 re-opens I11 (the writer tiers).
  That decision is the owner's and waits for the playtest files.
- **A new known trap for CLAUDE.md**, proposed for step 5: *"The field guide
  cites DECISIONS entries. When an entry changes, search `ui/guide/` for its ID
  and re-read every chapter that cites it; the citation test proves an entry
  exists, not that the chapter agrees with it."*

## 8. Risks

| risk | what guards against it |
|---|---|
| a chapter drifts from the model after a DECISIONS entry changes | citations, plus the known-trap line; only reading catches disagreement |
| a guide claim about real Google Ads is wrong | a source fetched while drafting, stored with the claim; owner review |
| the guide leaks a withheld figure | it lives under `ui/`, so `tests/ui.test.js` forbids reading withheld fields |
| nobody opens the guide | it is optional by design; the recorder will measure it in the next playtest |
| the drawer covers what it explains on a small screen | the phone-width mock-up, before code |
| the move changes a sentence by accident | the word-for-word comparison on a replayed save |

## 9. Decided: the side drawer (2026-09-12)

**The owner chose direction A** from the mock-ups
(https://claude.ai/code/artifact/a398dc9f-91bf-4135-ac4a-0b340357c3d3; working
files in `design/field-guide/`). All three were drawn on the returns card at week
6 of a replayed game (Vella & Co., mid · lifestyle, eight keywords) with the
approved chapter "Refused at the door, or sent back".

| | direction | ruled in or out by |
|---|---|---|
| **A** | side drawer, with a "Field guide" button in the header opening it at the contents | **chosen**: the chapter reads beside the card it explains |
| B | unfolds in the card | the card grows by about 440px and pushes its own note below the fold, the tall-card problem the review measured; nowhere to browse |
| C | a separate guide page | the card it explains is out of sight while reading it |

**What the mock-ups settled that this document had left open:**
- The drawer is 500px wide on a desktop and covers the right-hand column; the
  dashboard behind it is not dimmed, because reading beside the card is the point.
- On a phone it takes the whole screen, and its two ways out, "Show me on the
  card" and the next chapter, sit in a bar pinned to the bottom, every control at
  least 44px tall.
- "Next" follows the contents order, not a chapter's `related` list.
- **The guide shows players its sources, never the DECISIONS citations.** Those
  stay in the code and the tests, where they keep the chapters honest; to a player
  "I28" means nothing.
- The chapter title is the dialog's `h2`, so the playtest recorder names the drawer
  by its chapter.
