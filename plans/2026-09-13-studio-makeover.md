# The Studio makeover

*Design, 2026-09-13. Decided with the owner one part at a time. The pilot was
built on `makeover` (`plans/2026-09-13-studio-makeover-plan.md`), and the owner
played it and called it alive on 2026-09-15; where the build departs from this
text, section 10 says so.*

*It changes the route in `reviews/slc-review.md` section 12. The review's C3
(round 0 as steps), C4 (a dashboard that reveals itself) and E (game feel) are
folded into this plan. The stranger playtests are parked until the new look is
the default, and then run on it (section 7).*

## 1. Why

**The owner's call, after playing it with two other people and one stranger
playtest** (whose file has not been read yet; `playtest-2` is tagged locally on
`387baf1`, the version it was played on). Their grievances:

- **too much to read;**
- **fiddly controls**: static buttons and boxes to click and edit;
- **a boring look;** "it needs to feel alive".

The review measured the same thing from the other side:

- round 0 is one page of 2,633 words, 11 sections and 97 buttons;
- each week is 17–19 cards and 2,650–3,605 words;
- one bid idea took 18 separate field edits, with no way to edit bids in bulk;
- the one recorded human game spent 67% of its time in round 0, and 72 seconds
  on weeks 5–11.

**What "alive" means here, in the owner's words chosen from four options:**
controls you handle directly, a market you can see, and a look with character.
*The week plays out* (the week animating hour by hour) was offered and **not**
chosen.

**Its own game world, not the real Google Ads layout.** Sections are named in
plain words and the look is the game's own. The recommendation was the other way
(real layout, own look, so the skills transfer). The owner chose this, and it is
not to be re-proposed. Inside each section the real terms stay (bid, match type,
search terms, Quality Score), because they are what the game teaches and the
field guide already explains them.

## 2. The layout

**One section on screen at a time, chosen from a sidebar**, the way Claude's
desktop app switches conversations. It replaces the single long scroll.

**The icon strip, far left: four areas.**

| Area | Holds |
|---|---|
| **Brand** | your account: the sections below |
| **Market** | rivals: their ads, how often you meet each, who ranks above you, how the market is moving |
| **Guide** | the field guide as its own page; "why?" links still open it from any section |
| **Results** | locked until week 12; then the debrief and the rival reveal |

**The Brand area's sections, and which of today's cards each takes:**

| Section | Takes over |
|---|---|
| **Your week** | *The week*, *Where the impressions went*, *Changed since you looked* |
| **Your keywords** | *Keywords*, the keyword planner |
| **What people typed** | *Search terms*, *Negatives* |
| **Your ad** | the ad copy and its grades |
| **Your money** | *Budget* and *This month's budget*, merged; *Bidding*; *What week 8 decides*; *This week only* at week 5 (capital and the one chance to reposition, kept on one card because both draw on the same month) |
| **Where and when** | *Where you advertise*, *Hours of the day* |
| **Returns** | *What came back*, *Prepaid discount*; locked until week 6 |

**Three behaviours.**

1. **Sections appear when they have something to say.** Returns shows
   "week 6" and stays locked until then. A dot marks a section with something
   new: Returns when it opens, Your money at the week-5 capital decision. This is
   the review's C4, done through the sidebar instead of hiding cards.
2. **The tray, at the foot of every section, replaces the *Next week* card.**
   Every change made anywhere lands there as one short line ("gym leggings bid
   ₹33 → ₹25") beside the *Run week N* button. Each line carries the undo that
   `changes(draft)` already gives it; the one line without an undo, week 5's
   "commit no capital", is listed because it is itself a decision. The same
   advice is no longer printed once per change (30 times in one list, review
   section 5). *This week only* is not part of the tray: it is a decision card,
   and lives in Your money.
3. **On a phone,** the icon strip and the section list fold behind a menu button
   and slide out, like Claude's phone app. The tray stays pinned to the bottom.

**Today's header bar, re-homed.** Nothing it does is lost:

| Today, in the header | In the new layout |
|---|---|
| brand name and position | the top of the section list |
| "week 4 of 12 · saved" | the main area's top bar, beside the month's spend |
| *Run the week* | the tray |
| *Field guide* | the Guide icon |
| *Redo round 0* (until week 3) | under the brand name in the section list, while it is offered |
| *Send playtest file* (playtest link only) | the foot of the icon strip |

Round 0 moves into the same layout later, with the section list as its steps
(section 7).

## 3. The look: Studio drop, in Red signal

Studio drop's cards, type and layout were chosen from three looks drawn on one
real screen (section 9). Its colours were then changed by the owner, after
trying three palettes on the working mock-up, to **Red signal**: near-black,
blood red and cold grey, after a film the owner named. Colours only: no logo,
symbol or name from the film appears anywhere in the game.

**Colours.** One committed dark look; no light mode. The cream palette stays in
the mock-up as a record, not as an option.

| Name | Value | Use |
|---|---|---|
| night | `#0D0C0E` | the page |
| rail | `#060507` | the icon strip |
| sidebar | `#131215` | the section list |
| card | `#17161A` | cards, panels |
| raised | `#221F25` | chips, the QS pill, tray lines |
| line | `#2A272D`, `#3A363E` | card edges; stronger edges and dashes |
| bone | `#EDE8E3` | text |
| muted | `#A19A94` | secondary text |
| faint | `#8A847E` | small labels |
| red | `#D7262F` | the one accent: slider fills, a changed card, the Running switch, the chosen pill, the Run button |
| red, small text | `#FF6166` | red text under 18px ("was ₹33") |
| amber | `#F2A53A` | warnings, and money lost (with a minus sign) |
| mint | `#9FD3B5` | "above average", and money made |
| panel | `#1A0C0F`, edge `#4A1A1F` | the reading panel |

**Every text colour was measured against its background**, 24 pairs in all, and
passes 4.5:1. The lowest are white on red (the Run button, the chosen pill, the
change count) at 4.66:1.

**One colour rule, and what choosing Red signal cost.** Red means *you and your
changes*. So red cannot also mean "bad": a warning is amber, and a loss is amber
**and** carries a minus sign and a label. No meaning is carried by colour alone.
This was the known cost of Red signal over *Streetlight*, which kept red for
danger; the owner chose the drama knowingly.

**Type.** *Bricolage Grotesque* for titles and large numbers; *Instrument Sans*
for everything else. Tabular figures, so columns of numbers line up. Nothing
under 12px. **The font files are stored with the game** (`ui/fonts/`), not
fetched from Google on every load: both are under the SIL Open Font License, the
live game then calls no outside server, and the dev server works offline.

**The kit**, every screen built from the same pieces:

- the card;
- match-type pills;
- the bid slider, whose number can be tapped and typed, and which arrow keys move
  ₹1 at a time;
- an on/off switch;
- a stat trio (number over label);
- the dark reading panel: big figures and at most two sentences;
- sidebar items, with a lock and a dot;
- the tray;
- two buttons: the red pill for the one main action, an outline for the rest.

**Alive through response, not decoration.**

- Flipping a match type updates "reaches 16 searches" at once.
- Dragging a bid outlines the card and drops a line into the tray.
- A number the game revises visibly gives way to its new value.

**Motion: six moments, and nothing else.** From a `find-animation-opportunities`
sweep of this design (the re-run review section 13 asked for), approved by the
owner and drawn into the mock-up (rows 1, 3, 5, 6; rows 2 and 4 belong to screens
not drawn yet). All on the game's existing curve, `cubic-bezier(0.23, 1, 0.32, 1)`
(the field guide's drawer and the end-screen reveal use it), transform and opacity
only, entrances from `@starting-style`, no library.

| # | Where | Purpose | Motion |
|---|---|---|---|
| 1 | **The tray** | a change visibly goes somewhere | a new line enters from `opacity 0; translateY(8px)`, 200ms; lines are ordered by when the change was first made, so only the newest enters, and a line whose text updates mid-drag never re-enters; an undone line fades 150ms, then goes |
| 2 | **Revised figures**, Your week | the revision *is* the lesson | the old value and the new crossfade on opacity, 250ms; never a counting ticker |
| 3 | **A section unlocking** (Returns at week 6) | a new tool, made legible | the lock gives way to a dot entering from `scale(0.8)`, 200ms; on the first visit only, the section's cards enter from `opacity 0; scale(0.97)`, 200ms, 40ms apart, at most six |
| 4 | **Round 0's steps** | where you are in the sequence | direction-aware: forward enters from `translateX(24px)`, back from `-24px`, with opacity, 250ms `cubic-bezier(0.77, 0, 0.175, 1)` |
| 5 | **Run week** (and Apply, Add, Done) | feedback | `:active { transform: scale(0.97) }`, 160ms ease-out; on the compositor, so it finishes while the week computes on the main thread |
| 6 | **Drawers and the ⋯ menu** | each comes from where it lives | drawers: the field guide's exact rule (`ui/style.css:1352`), in 220ms, out 150ms; the menu grows from its button, `transform-origin: top right`, `scale(0.97)`, 150ms |

**Rejected, with the test each failed:** section and area switching (frequency:
it is core navigation, so it is instant); the slider and the numbers beside it
(function: they must track the finger); the spend bar drawing in and stats
rolling up (function, and the honesty rule); the grid moving when Adjust several
opens (purpose: that was a layout jump, fixed by layout, section 4); a new card
animating in from the planner (purpose: it would play unseen behind the drawer);
hover lift on cards (frequency).

**Rules for every motion:** under 300ms; reduced motion keeps the fades and drops
the movement, the press and the stagger; the pause switch's knob moves by
`transform: translateX(14px)`, never by `left`; and each passes
`/review-animations` before it ships.

**The honesty rule for controls.** A control shows only what the game computes.
The reach count is real (`keywordReach`, E8), so it is shown. "This bid would
get you 1,200 clicks" is not something the engine forecasts, so no control
says it.

## 4. The pilot section: Your keywords

Built completely first, because it has to prove the idea: the look, the controls
and the lighter reading. It uses only data the game already has; no rule
changes.

**Top to bottom:**

1. **Header:** title, keyword count, and a *This week / All weeks* switch. It is
   `game.view.termsRange`, the one the search terms use, and every number in the
   section follows it.
2. **The reading panel says what held the week back, where the money went, and
   which levers act on it.** Revised with the owner after the first mock-up: two
   bare figures ("50% lost to budget, 0% lost to rank") stated a problem and gave
   no way forward.
   - **What held it back**, from `marketOutlook` (`ui/chart.js`), the same
     classification today's market card uses: budget, rank, both, or saturated.
     The mock-up draws budget: "Your money ran out first. 50% of the auctions you
     could enter went unbought. None were lost to rank, so a higher bid would only
     run the money out sooner."
   - **Where the week's money went:** the week's cost by keyword as one bar, with
     the three largest named (gym leggings took 71% of week 4). Cost is final the
     week it is spent, unlike conversions, so it is the one split safe to show.
   - **The levers, as buttons into the controls.** Budget: *Stretch it* opens
     Adjust several ("cheaper clicks make it last; a lower bid can buy them") and
     *Add to it* opens Your money. Rank: a better ad (Your ad) or a higher bid.
     Saturated: more searches (Add a keyword, or a broader match).
   - **It names levers, never a verdict.** It does not say "lower your bids": the
     game cannot see whether the extra clicks would be worth buying, which the
     conversions show a week or more later. That is the stance of today's market
     card (`readingOf`, `ui/chart.js`), in the words of the guide's *Lost to rank,
     or lost to budget* chapter (H3).
3. **One card per keyword:**
   - **match pills**, with "reaches N searches" under them;
   - **tags only on broad**: "matches on: leggings · running · women", because
     tags decide broad reach and nothing else. The "no tags, broad finds
     nothing" warning stays;
   - **the bid slider, with what was actually paid under it**: "bid ₹33 · paid
     ₹20.6 a click". Side by side they show H1 (you pay what beats the ad below
     you, not your bid) without a sentence;
   - **clicks, cost, conversions;**
   - **the QS pill**, which opens its three parts in the card when tapped. The
     note on what Quality Score is and is not moves to the guide behind "why?";
   - **an on/off switch labelled Running or Paused**, top left; **remove** in the
     card's ⋯ menu;
   - **a changed card** takes the terracotta outline, and "was ₹33" sits beside
     the bid it belongs to ("was phrase" beside the reach); the change is in the
     tray with an undo.
4. **An "Add a keyword" card** opens the keyword planner as a panel from the
   right: search the list or type your own; each keyword added becomes a card.
5. **Adjust several at once:** tick cards, then set them all to ₹X, change them
   all by a percentage, or switch their match type. It is the direct answer to
   "fiddly controls" (18 edits for one idea). **While selecting, the tray becomes
   the bulk bar**, so nothing above it moves: the first mock-up put the bar above
   the cards and pushed the whole grid down 56px (the motion sweep, section 3).

**Rules the cards need, decided here:**

- **The slider's range** runs from ₹1 to the larger of ₹100 and 1.5× the highest
  bid **at the start of the week**, rounded up to the next ₹10. It is fixed for the
  week so that it never rescales under a finger mid-drag; a typed or bulk-set bid
  above the end extends it to fit (found building the mock-up, section 9).
- **"Change by a percentage"** rounds each result to the whole rupee, never below
  ₹1. A keyword the change would push outside what `updateKeyword` accepts is left
  alone, and the tray says which.
- **A keyword added this week** shows "new, no data yet" in place of its numbers.
- **No fixed card heights.** The first mock-up gave every card one height, and a
  broad card's extra tags line pushed its numbers out of the bottom; "₹2,03,202"
  was also wider than its column, and a "Changed" label wider than the card's top
  row. So cards size to their content, each row takes its tallest card's height,
  a line that comes and goes (the tags on broad) keeps its space so flipping a
  match type never makes a card jump, and the widest real values (six-figure
  costs, the longest planner search) are checked on screen, not assumed.

**Reading load.** Beyond keyword names and numbers, the section carries **about
120 words at most**, measured in the browser at the end of the pilot the way the
review measured its word counts. Concepts sit behind "why?" links. The wording
lives in `ui/words/keywords.js`.

**Two risks, tested rather than discovered.**

- **Many keywords.** The review's careless game added 60. The pilot is played
  with 60. If cards cannot cope, a compact list view is added.
- **An imprecise slider.** That is why the number can be typed and arrow keys
  step ₹1.

## 5. How it fits the code

**A switch, so the working game is never broken.** `?look=studio` turns the new
layout on, remembered by the browser the way the playtest link is (`lookMode`,
modelled on `playtestMode`). Without it the game is exactly today's. The old look
is removed only when every section has moved. Work happens on the branch
`makeover`; Cloudflare gives each branch a preview link behind the same sign-in,
so it can be played on a phone before any of it reaches the live game.

**The whole game is playable in the new layout from day one.** Only Your keywords
is rebuilt in the pilot. Every other section shows today's cards, moved into it
by their slot names (`data-slot` on the dashboard's cards, `dataset.slot` on the
form's). As each section is rebuilt, its old cards are retired. The game can be
played to week 12 in the new layout at every stage.

**The files:**

| File | Job | Checked by |
|---|---|---|
| `ui/shell/shell.js` | the layout: icon strip, section list, main area; which section is open; locks and dots; `reveal(slot)` | unit tests on its pure parts; playing it |
| `ui/shell/tray.js` | the tray: the lines of `changes(draft)`, each with its own undo, and *Run week N* | unit tests; playing it |
| `ui/kit/controls.js` | slider with type-in, pills, switch, stat trio | playing it |
| `ui/keywords/read.js` | pure: what each card shows (section 4's rules) | unit tests on played games |
| `ui/keywords/render.js` | draws the section from `read.js` | playing it |
| `ui/words/keywords.js` | the section's sentences, under the content model | `tests/words.test.js` |
| `ui/studio.css`, `ui/fonts/` | the look, and the two font files | `tests/build.test.js` |

`ui/app.js` branches on the switch. `ui/index.html` gains the second
stylesheet. `ui/recorder.js` learns the sections (below). Bids, match types, pausing, adding and removing still go through the
existing `updateKeyword`, `addKeyword` and `removeKeyword` in `ui/decisions.js`:
the new screen is a new way to reach the same draft, not a second copy of its
logic.

**Not touched:** any file in `engine/`, any rule, any constant. Nothing moves the
market, so there is nothing for `scripts/market-harness.js` to measure.

**Tests first, for these pure pieces:**

- `lookMode(search, storage)`: on, off, remembered.
- **The section rules:** Returns locked before week 6; the dots at week 5 and 6;
  Results locked before week 12.
- **Every slot has a section:** each slot the dashboard and the form draw maps
  to exactly one section, and **each guide chapter's `yourAccount` slot maps to
  one** (the CLAUDE.md trap: "show me on the card" must land on something that
  exists once drawn).
- **The keyword cards:** reach label; tags only on broad; the bid/paid pair; the
  changed flag with its old value; numbers following the range switch; paused;
  new with no data; the no-tags warning.
- **Adjust several:** set, change by a percentage (rounding, the ₹1 floor, the
  refusals), switch match type.
- **The slider's range rule.**
- **The tray:** one line per row of `changes(draft)`; a line's undo takes back
  that change and nothing else; the week-5 capital default is listed with no
  undo.
- **The build:** it follows `url()` inside a stylesheet, so the fonts are
  published; the list of published files grows by exactly the new files; still
  nothing that is not part of the game.

**Two traps this must respect (CLAUDE.md).**

- **The guide's "show me on the card" links.** A chapter's slot may sit in a
  section that is not open, so `reveal(slot)` opens that section first, and the
  slot test above fails if any chapter points at a slot no section holds.
- **The build publishes exactly what the game loads.** Today it follows the
  page's scripts and stylesheet, not fonts named inside a stylesheet.
  `scripts/build-site.js` learns to follow them. The count moves from 54, on
  purpose, and HANDOVER and CLAUDE.md say the new number.

**The playtest recorder must still read the screen.** It names each click by the
nearest `.card` or `header` and that card's `h2` (`ui/recorder.js`,
`attachRecorder`), and times cards on screen. In the new layout the sidebar, the
tray and the icon strip sit outside any card, and a section replaces a scroll
position. So every new region carries a name the recorder can read (the section
as a titled region, the sidebar items and tray controls with labels), and a
section switch is recorded the way a screen change is. The playtests in section
7 depend on it.

**Needs the owner's permission when reached:** downloading the two font files
from Google Fonts (names and sizes stated first; each about 100–200 KB).

## 6. When the pilot is done

- All twelve weeks played in the browser in the new layout, with every control
  in Your keywords used for real: slider, type-in, pills, pause, remove, add from
  the planner, adjust several, undo from the tray.
- A 60-keyword game played; if cards cannot cope, the list view is added.
- It works at phone width, the sidebar folding as described.
- The section's words stay under about 120, and each motion passes
  `/review-animations`.
- `npm test` is green.
- One game played with `?playtest=1`, and its file read with
  `scripts/read-playtest.js`: the sections, and clicks named by what was
  clicked.
- **The owner plays it and says whether it feels alive.** That is the gate. The
  rest makes the answer worth having.

## 7. After the pilot

**One section at a time**, each with its own short design in chat and the
owner's go-ahead:

1. **Your week**: the overview, where revised figures visibly give way.
2. **What people typed**: search terms and negatives; table-heavy, so its own
   layout within the look.
3. **Your money**: the merged budget card, bidding, week 8, capital.
4. **Where and when**: places set with sliders on the India map the game already
   draws (`ui/india-map.js`); hours as bars to drag.
5. **Your ad**, then **Returns**.
6. **The Market area**: rivals as players, from what the public view already
   carries (their names and ads, R3) and the player's own auction insights.
7. **Round 0 as guided steps** in the same layout. Late on purpose: its steps
   reuse the keyword cards, the ad editor and the budget controls built above.
8. **Results**, then **the Guide as a page**.
9. **The switch-over**: the new look becomes the default; the old screens and
   their code are removed.

**Decisions to bring back to the owner with options, not take alone:**

- **A results page for one particular search** in the Market area: who appeared,
  in what order. The public view does not carry it today (`getPublicView`,
  `engine/insights.js`), so it is a change to what players may know and needs a
  DECISIONS entry before any design.
- **Round 0's writer choice (I11).** The review recommends removing it when
  round 0 becomes steps; the new evidence is recorded in its recommendation 4.
- **Whether the old look survives the switch-over.** Recommended: no, because two
  looks double the checking.

**The playtests.** Once the new look is the default, the stranger playtests run
on it, judged against the review's own gates: round 0 under 10 active minutes,
more than 72 seconds on weeks 5–12, three lessons in the player's own words, and
decisions in weeks 7–12. The recorder is adapted to the layout (section 5).
Tester 1's file is read on `playtest-2`, the version they played.

## 8. What this does not do

- No light mode.
- No animation of the week playing out (not chosen).
- No forecasts a control cannot honestly make.
- No change to the engine, its rules or its numbers.
- No framework and no build step: native ES modules, as today.
- No per-search results page until the decision in section 7 is taken.

## 9. Where it came from

**The canvas:** https://claude.ai/code/artifact/d881fe56-251c-4ded-9173-b8616924bbc4,
with its source in `design/makeover/`. Three looks were drawn on the same screen,
Your keywords after week 4:

| Look | For | Against |
|---|---|---|
| A · Track day | the biggest break from today's dark look; dark on light reads fastest | the calmest; used timidly it is a table again |
| B · Night session | the most game-like | nearest today's look; ranking by conversions rewards volume, which the game itself teaches is not profit |
| **C · Studio drop, chosen** | feels like running a D2C label; cards suit touch and phones | fewer keywords fit at once; comparing across cards is slower than down a column |

**Its numbers are real.** One game played to week 4 with the engine: seed 1,
Vella & Co. at mid-price performance, with four phrase keywords, two broad, and
the brand on exact; the figures are weeks 1–4 added up, as today's keyword card
does. The one invented detail is the pending change (gym leggings ₹33 → ₹25),
drawn to show where changes wait.

## 10. Corrected by the build

The plan's tasks carry the detail, in their *Found when built* notes and Task
10's play record.

- **Round 0 came first and built the kit (section 7).** Round 0 was redesigned
  and rebuilt in this layout before the pilot section
  (`plans/2026-09-14-round-zero-redesign.md`), and it built the keyword card,
  the planner drawer and the controls in `ui/kit/`. Your keywords draws that
  same card with its week's parts switched on (the running switch, "was", the
  tick, the outlines), and the planner shares the classic planner's own state.
- **Today's cards are filtered by section, never moved (section 5).** The
  decision form redraws every card it owns into its own region, so a card moved
  into a section would be drawn into nothing. The stylesheet shows a section's
  cards by `data-slot`, and Your keywords, rebuilt, draws its own.
- **The tray (section 2, behaviour 2)** replaces the *Next week* card, as
  written; *This week only* stays a card in Your money. `ui/shell/tray.js`
  holds only the lines' order, and the tray is drawn in `ui/shell/shell.js`
  (section 5's table).
- **The field guide gained a chapter,** *What the Quality Score is, and is
  not*, which the card's QS "why?" opens (section 4, item 3).
- **The planner kept *Add all*** (section 4, item 4), and a keyword added this
  week reads "new: no clicks yet".
- **A bid under the reserve is warned on every week's card,** as round 0's is
  (the owner, 2026-09-14; DECISIONS I17), with the hour and place adjustments
  the week will run, under manual bidding.
- **Your ad (section 2's table)** had no weekly card to take over, and the
  pilot's section said so. The owner chose on 2026-09-15 to build it
  read-only, and it is built (`ui/ad/`): the ad as searchers see it, its
  writer and fee, the three grades out of ten the auctions use that week, with
  a grade still to change outlined and dated (capital going live, or an old
  save's own words landing), and the landing page as the grader read it,
  sketched with each part's week. It draws itself, as Your keywords does,
  since the classic page has no ad card to filter. Designing it found that the
  Studio's Quality Score panel had dropped the grade out of ten that DECISIONS
  I1 puts beside each rating; the card shows it again.
- **Where and when (section 7, item 4)** is built as the owner chose from the
  mock-ups on `design/where-when/` (2026-09-15): the three kinds of place as
  rows with a bar each beside the India map, a city's dot sized by the bid
  there, and the hours as the day drawn to scale, each block as wide as its
  hours with the day's clicks by hour beneath. It draws itself, as Your
  keywords does, and the classic cards are retired in the Studio. Bars stop
  where a bid stops (four times the keyword, once over hour and place, G4's
  dated note), and read "+30% · bids ×1.3". Its layout follows the section's
  width by container queries rather than the window's, because the sidebar
  takes 300px of any window.
- **Motion (section 3).** The tray's entrance is the weekly tray's only, since
  round 0's redraws its chips on every change; the strip scrolls to the line
  just made. A section's first visit plays once and staggers top to bottom, and
  its dot waits, on a phone, until the list behind the menu is seen. Row 2, the
  revised figures, plays in Your week (below). `/review-animations` was not
  available, and `improve-animations` reviewed the motion instead.
- **Your week (section 7, item 1)** is built as the owner chose from the
  mock-ups on `design/your-week/` (2026-09-15): the week's six figures, every
  week's net profit as a bar with a dashed tick where it stood before this week
  ran and the change in grey under it, one sentence on what moved, and where
  the impressions went. It draws itself (`ui/week/`), and the classic three
  cards are retired in the Studio. The engine keeps only the revised history,
  so the interface keeps the one from before the latest week (`ui/app.js`,
  `ui/save.js`). Three choices came from seeing it: the tick says "before week
  N ran", since the game cannot know when you looked; a losing week hangs below
  a zero line in amber, while the changes stay grey; and the palette's "a loss
  is amber" is set aside for the changes, because a week revised down is a
  correction, not money leaving. Row 2's motion plays the first time the section
  is seen after a week has run, and on "replay the revision"; `improve-animations`
  reviewed it, and the one finding taken hides where a week stood from screen
  readers, which read it at opacity 0 as a second current figure. On a phone
  the chart scrolls sideways in its own box rather than shortening its figures.
- **What people typed (section 7, item 2)** is built as the owner chose from
  the mock-ups on `design/what-people-typed/` (2026-09-15): every search the
  account bought in one list, most spent first, with its sales, what a sale
  cost there and how many came back, and Block words beside it, whose preview
  outlines the rows a block would catch as it is typed. It draws itself
  (`ui/typed/`) and retires the classic two cards in the Studio; every block
  goes through the form's own staging, so the tray words it. Not chosen: the
  searches grouped under the keyword that bought each, which would have needed
  the engine to keep that keyword. Drawing it found that today's "five
  clicks, no sale" mark never fires on the game's fractional sales, so a sale
  costing over twice the account's average is marked instead; the classic
  look's fix is its own task. A blocked row is muted grey rather than faded,
  which measured under 4.5:1.
- **Your money (section 7, item 3)** is built as the owner chose from the
  mock-ups on `design/your-money/` (2026-09-15): this month as one bar, where
  a line between two weeks moves money between those two and no others, so a
  drag can never leave money unplanned or plan more than the month holds;
  bidding and what week 8 decides side by side; and at week 5 the capital and
  the one move on top, on the panel colour. It draws itself (`ui/money/`) and
  retires the classic five cards in the Studio. Not chosen: twelve weeks at a
  glance, each week's budget against what it spent, with month 3's range
  shaded (the canvas's *Not chosen* page). Planning it found the tray quoting
  a plan the week-5 round re-spreads, and naming weeks of the month rather
  than of the game; both are fixed for both looks. Building it dropped one
  mock-up sentence, a threshold of thirty conversions the engine never uses
  (17.2: that consequence is discovered, not read off a card). Committing
  capital is red, as the player's change; money no week is given is amber and
  dashed, since the month's end loses it; a cell out of reach is muted rather
  than faded. After week 8 the card gives the rank alone: history is revised
  after the snapshot, so a total summed later would not be the one that set
  month 3.
- **Returns (section 7, item 4)** is built as the owner chose from the
  mock-ups on `design/returns/` (2026-09-15): the five figures over settled
  weeks, every week as one bar split into refused at the door (amber) and
  sent back (grey) with a week still coming back faint, the prepaid
  discount's rungs each drawing what it saves a week against what it costs,
  and what else moves returns with the half each reaches. It draws itself
  (`ui/returns/`) and retires the classic two cards in the Studio; it still
  unlocks at week 6. Not chosen: the two halves as two cards, each with its
  own weeks and levers, whose two strips sat side by side on different
  scales. Building it depended on the prepaid fix (I34), merged in first, so
  every rung's rate is the arithmetic the round books with. Row 3's motion,
  a first visit's entrance, had only ever played on classic cards: rebuilding
  Your money had taken its week-5 entrance away, and the shell now enters a
  rebuilt section's own parts. The mock-up said the half an investment cannot
  reach "held"; the section reads that half before and after instead, since
  the mix of places can move it. The rung you move to is red, your change; the
  account's own setting is bone, as a chosen chip is everywhere else.
- **A bid drag refreshes only the tray,** and the rest of the page once the
  slider is let go: the whole refresh on every step cost 41ms with sixty
  keywords.
- **The reading load (section 4)** measured 158 words with seven keywords,
  against about 120; 105 are the cards' repeated labels. Put to the owner.
- **Sixty keywords (section 4's risk)** drag smoothly and the reading panel
  folds the rest together, but a click that redraws the section took 274ms
  and the section runs to twenty screens. The compact list view was put to the
  owner, not built.
- **Phone (section 2, behaviour 3)** as written, and the top bar drops its week
  dots and saved note under 900px, which pushed its end off a 375px screen.
- **Desktop, after the gate (2026-09-15).** Playing it in a desktop browser, the
  owner asked for the window rather than the phone. A section's cards take its
  full width, one to a row, where the classic page's four-column grid left most
  at half width; a table's height is its own, so the page is the one scroll;
  scrollbars are slim; the guide's contents are numbered.
- **The gate (section 6) passed on 2026-09-15:** the owner played it and said
  it is alive. Of section 7, the owner's next are the brand as a pick from the
  nine in round 0 (reopening the round 0 design's drawn brand, DECISIONS I35),
  Your ad, and Where and when, drawn first as mock-ups.
