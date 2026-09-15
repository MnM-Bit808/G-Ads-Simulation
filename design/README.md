# design/

The Claude Design artboards for round 0, and the scripts that produced the map.

These are **drafts of screens**, not the screens. What is actually built lives in
`ui/`. An artboard and the app can disagree, and where they do the app wins —
`HANDOVER.md` under *Round 0 has a design, and part of it is built* records which
parts made it across and which did not.

## The artboards

`canvas.json` lays them out and carries the annotations. Page 1 is round 0, in
reading order; page 2 holds two superseded directions kept for the argument they
lost.

| File | Card |
|---|---|
| `Market.dc.html` | 01–02 · Your brand + The market |
| `Main.dc.html` | 03 · Where the search happens (the map) |
| `Position.dc.html` | 04 · Who else is here |
| `Grid.dc.html` | 05 · Where you sit |
| `Spend.dc.html` | 06–08 · The money |
| `Account.dc.html` | 09–10 · Keywords + Your ad |
| `Instrument.dc.html`, `Workspace.dc.html` | superseded |

They use real content throughout — the nine brands, the tier economics, the
break-even sums, the eight rival ads from `content/adCopy.js`. That is deliberate:
a mock with invented figures designs a screen that has never held a real number,
and this project has twice found a layout problem only once real text went in.

## `field-guide/`: how the field guide opens (stage C2)

A second canvas, https://claude.ai/code/artifact/a398dc9f-91bf-4135-ac4a-0b340357c3d3,
drawn on the returns card at week 6 of a real replayed game with the approved
chapter "Refused at the door, or sent back". Page 1 is the direction the owner
chose on 2026-09-12, **A · the side drawer** (`Main.dc.html` desktop,
`Phone.dc.html` phone, `Card.dc.html` the card with its "why?" links). Page 2
keeps B (`InCard.dc.html`, unfolds in the card) and C (`GuidePage.dc.html`, a
separate page), with the cost that ruled each out.
`plans/2026-09-12-content-model-and-field-guide.md` records the choice.

## `makeover/`: the Studio makeover's look (2026-09-13)

A third canvas, https://claude.ai/code/artifact/d881fe56-251c-4ded-9173-b8616924bbc4,
drawn on one real screen: *Your keywords* after week 4, inside the sidebar layout
of `plans/2026-09-13-studio-makeover.md`.

- **Page 1** is `Main.dc.html`: that section as designed in the plan's section 4,
  in the chosen look, with working controls, for the owner to try before any code
  is written. Its colours come from one of three palettes that name the same
  roles (its `theme` switch): the cream *Studio drop*, and two night palettes the
  owner asked for after a reference film the owner named, colours only and no logo,
  symbol or name from it. **The owner chose Red signal**, which `Main.dc.html`
  now opens in, with the design's motion. `Cream.dc.html` and
  `Streetlight.dc.html` are that same component imported with the other two
  palettes, kept beside it as the record. Every text colour in all three was
  measured against its background at 4.5:1 or better.
- **Page 2** keeps the three looks it was chosen from, each with its case and its
  cost in a note above it: `TrackDay.dc.html` (A · Track day),
  `NightSession.dc.html` (B · Night session), `StudioDrop.dc.html` (C · Studio
  drop). **The owner chose C.**

Its numbers come from one game played to week 4 with the engine (seed 1, Vella &
Co. at mid-price performance, four phrase keywords, two broad and the brand on
exact), added up over weeks 1–4 as the keyword card does. The one invented detail
is a pending bid change, drawn to show the tray.

## `where-when/`: the controls for Where and when (2026-09-15)

A fourth canvas, https://claude.ai/code/artifact/84535b5e-0d58-4228-b2b5-fbfcf8d7383b,
asked for after the Studio pilot: the owner found the hours cramped and disliked
the number boxes and preset buttons. Two options for each half of the section,
every bar draggable, drawn inside the weekly sidebar layout.

- **Page 1, hours of the day:** `Main.dc.html` (A · the day to scale: each block
  as wide as its hours, with the day's clicks by hour on the same clock) and
  `HoursSliders.dc.html` (B · six equal sliders, each with its own figures).
- **Page 2, where you advertise:** `PlacesBeside.dc.html` (A · the three kinds of
  place as rows with a bar each, beside the India map, which lights and names a
  row's cities) and `PlacesOnMap.dc.html` (B · tap a city or a kind to set it,
  with its figures beside the map).

Both scales run from off through even to four times the keyword bid, the most a
bid can be under manual bidding (`MAX_BID_MULTIPLE`). Its numbers come from one
game played six weeks with the engine (seed 1, Vella & Co. at mid-price
performance, manual bids of ₹33, no adjustments), read with the form's own
`daypartRows` and `locationRows`; the map and the 32 cities are
`ui/india-map.js` and `content/locations.js`. The notes on the canvas carry each
option's case and cost, and two findings for the owner: the hours box accepts
+900% though nothing past +300% changes a bid, and the engine applies a place
adjustment without the four-times cap its own comment describes.

## `your-week/`: the Your week overview (2026-09-15)

A fifth canvas, https://claude.ai/code/artifact/ae97f8b4-111a-451d-b37a-e8e237b4866f,
the first section on the makeover design's section 7 list: the overview, where
revised figures visibly give way. Two options, each opening by playing the
revision (every earlier week shows what you saw when you last looked, then
crossfades to what it is now, 250ms, opacity only):

- **Page 1**, `Main.dc.html` (A · money first), **chosen by the owner on
  2026-09-15**: the week's six figures, then every week's net profit as a bone
  bar, a faint dashed tick where it stood before this week ran, and the change
  in grey under the week with its plus or minus. Beneath it,
  `LossAmber.dc.html`: a week that lost money, hanging below a zero line in
  amber, the owner's choice after seeing it beside bone.
- **Page 2**, `DelayFirst.dc.html` (B · the delay first): every week's
  conversions, landed against still to arrive with a tick where you read them;
  tap a week for its six figures. Beneath it, `LossBone.dc.html`, the losing
  week in bone.

The tick says "before week 6 ran" rather than "when you last looked", at the
owner's word: the game knows the figures before a week ran, not when you
looked. The losing week comes from the same game with one mistake made in it,
every bid raised from ₹33 to ₹82.50 at week 5: week 6 lost ₹20,570, and week
5, a loss of ₹17,265 before week 6 ran, is a profit of ₹10,600 once its late
conversions landed.

The colours took three tries, and the note on page 1 keeps the reasoning. Mint
and amber on the changes looked out of place; hatched caps with dark figures
did not mesh with the rest of the dashboard. What stayed uses only what the
Studio already does: bone and greys, and the keyword slider's "was" marker
made for a bar. It sets aside the palette's "a loss is amber" on this one
screen for the changes, because a week revised down is a correction to what
you were told, not money leaving now; a week that itself lost money stays
amber.

Its numbers come from one game played six weeks with the engine (seed 1,
Vella & Co. at mid-price performance, manual bids), with every week's figures
captured before and after week 6 ran: week 5's profit rose ₹53,317 as its
conversions landed, and weeks 1 to 4 fell ₹51,143 between them as returns
came back.

## `what-people-typed/`: search terms and negatives (2026-09-15)

A sixth canvas, https://claude.ai/code/artifact/9564f078-b493-4538-94aa-90b6c035ffc0,
the second section on the makeover design's section 7 list, replacing today's
Search terms and Negatives cards. Both options work: block a search from its
row, or a family of them by their words, with what the block would catch
outlined before it is made, and the change landing in the tray.

- **Page 1**, `Main.dc.html` (A · one list, the money down it), **chosen by
  the owner on 2026-09-15**: every search the account bought, most spent
  first, with its sales, what a sale cost there and how many came back, and
  Block words beside it.
- **Page 2**, `ByKeyword.dc.html` (B · by the keyword that bought them): the
  same searches under the keyword that reached each, a broad keyword's
  searches marked with the words they lack. It would have needed the engine
  to record which keyword bought each search, which it works out every week
  and then drops.

Its numbers come from one game played six weeks with the engine (seed 1,
Vella & Co. at mid-price performance, with the makeover canvas's keywords:
four phrase at ₹33, two broad at ₹24, the brand on exact at ₹57), 33 searches
from 7 keywords. A block matches as the engine's negatives do, on the words
themselves. Drawing it found two marks in today's cards that the game's
fractional sales defeat: "five clicks, no sale" never fires, and the block
preview's warning about searches that sold nearly always does. Both options
mark instead a sale that costs over twice the account's average, and show the
sales a block would stop.

## `your-money/`: budget, bidding, week 8 and capital (2026-09-15)

A seventh canvas, https://claude.ai/code/artifact/6f331294-d17c-48e9-9804-b7b37227e2c8,
the third section on the makeover design's section 7 list, merging today's
five cards (This week only, Budget, This month's budget, Bidding, What week 8
decides). Both options open at week 5 with the capital and position window
on top; a switch shows an ordinary week 6. Every bid a strategy shows is the
engine's own (`bidOutlook`, computed for each target the slider reaches).

- **Page 1**, `Main.dc.html` (A · this month, as one bar), **chosen by the
  owner on 2026-09-15**: the month as one bar whose four weeks you move money
  between by dragging the lines, so the plan always equals the money; bidding
  and what week 8 decides side by side below, with the whole ladder of month-3
  budgets; at week 5 the capital card on top, its uncommitted money visibly
  joining the month.
- **Page 2**, `Timeline.dc.html` (B · twelve weeks at a glance): all three
  months as one chart, each week's budget against what it spent, the weeks
  that ran out marked, and month 3 shaded because week 8 decides it.

Its numbers come from the game the makeover canvas's keywords played (seed 1,
Vella & Co. at mid-price performance), after week 4 and after week 5 with the
capital left for ads: month 1 was ₹3,13,000 and ran out in weeks 2 to 4,
losing 41% of impressions to budget; month 2 is ₹1,68,000, or ₹2,88,000 with
the capital. Mapping today's cards found the rank sentence printed twice
after week 8, "counted so far" re-added from revised history (so it can drift
from the figure the engine ranked on), and ₹1,00,000 left in comments and the
spec from before the allocation became ₹1,20,000.

## `returns/`: what came back, and the prepaid discount (2026-09-15)

An eighth canvas, https://claude.ai/code/artifact/ca2f5ce0-0c5c-4935-8179-55337e6fc9c5,
the fourth section on the makeover design's section 7 list, replacing today's
What came back and Prepaid discount cards. Both options open at week 6, when
the section unlocks, and a switch shows week 11. Pick a discount rung and it
draws what it saves a week against what it costs, from the round's own
arithmetic.

- **Page 1**, `Main.dc.html` (A · week by week), **chosen by the owner on
  2026-09-15**: the five figures, one chart of every week split into refused
  at the door and sent back, the week order confirmation went live marked and
  unsettled weeks faint; below, the discount's five rungs, and what else moves
  returns with the half each reaches.
- **Page 2**, `Halves.dc.html` (B · two halves): refused and sent back as two
  cards, each with its own weeks and only the levers that reach it. Its two
  strips sat side by side on different scales, which invites comparing bars
  that do not mean the same.

Its numbers come from the makeover canvas's player (seed 1, Vella & Co. at
mid-price performance, the same keywords) with ₹80,000 of round-0 capital on
order confirmation, live from week 4, so the weeks show the step: refused fell
from 16.2% of orders to 13.5%, sent back held at about 24%. The discount
figures are `refusalOutlook`'s, from the prepaid fix on the branch
`claude/refusal-outlook-makeover`, which the owner chose to merge before the
build. Mapping today's cards found the returns note naming three levers but
not the discount beside it, and saying capital "opens only before week 1 and
before week 5" once it has closed for the game; and, with order confirmation
live, ₹30 saves about ₹1,796 a week against ₹1,436 while ₹50 costs more than
it saves, so the section draws the trade rather than naming a rung.

## `market/`: the Market area, rivals as players (2026-09-15)

A ninth canvas, https://claude.ai/code/artifact/230864af-39a1-4789-8631-158a34316d7a,
the Market area on the makeover design's section 7 list, replacing today's
Auction insights, Week by week (the trends chart) and The market cards. Both
options make it one section, Rivals, with the market's four public figures and
the player's own share on top; the owner agreed to the one section.

- **Page 1**, `Main.dc.html` (A · the field, rival by rival), **chosen by the
  owner on 2026-09-15**: each rival you meet as a card, how often they are in
  your auctions with every week so far as small bars, their ad as searchers see
  it, and who comes out above; sorted by how often you meet, one you never meet
  a line at the end.
- **Page 2**, `Grid.dc.html` (B · week by week, every rival at once): a row a
  rival and a bar a week for the figure picked, and the picked rival's ad and
  figures beside it.

Only what a player may see (R3): names, sites and ads from the public view, the
player's own Auction Insights, and the market's public totals. Its numbers come
from the makeover canvas's game (seed 1, Vella & Co. at mid-price performance,
its keywords), after week 6 and week 9. Mapping today's cards found the reading
naming the rival "above you most often when you meet" by that rate alone, which
picked one in 2% of the player's auctions; the mock-ups name the rival above
the player in the most of all the auctions it shows in. A second read fixed
five wordings, recorded on the canvas. Left for the owner: a results page for
one search (a DECISIONS entry first), and keeping round 0's notes on rivals.

## `results/`: the Results area, after the last week (2026-09-15)

A tenth canvas, https://claude.ai/code/artifact/e03ab7c2-eeb8-473b-b80c-d67e1932a5b7,
the Results area on the makeover design's section 7 list, replacing today's end
screen (Twelve weeks, the debrief, Where did they sit?, Everyone with the books
open, Every week, The account, What you did, Play again), which the Studio
still showed as classic cards.

- **Page 1**, four artboards (A · four sections), **chosen by the owner on
  2026-09-15**: `Main.dc.html`, Twelve weeks: the figures, every week's net
  profit as it stands against its first report (a dashed tick) with the weeks
  the player changed something marked red, and a strip for the week tapped,
  which replaces Every week and What you did; `Learned.dc.html`, What you
  learned: the six lessons as cards, the weeks you changed something with
  "What if I hadn't?", and the budget question; `Reveal.dc.html`, Where they
  sat: round 0's eight ads and six squares, guessed and then revealed, with a
  switch showing round 0's notes kept; `Books.dc.html`, Everyone's books: every
  brand ranked by net profit with gross profit as an outline, where each sat
  hidden until the reveal is answered, the player's three ranks, and Play again.
- **Page 2**, `OnePage.dc.html` (B · one page, told in order): the same four
  parts on one scroll, about 5,000px, today's length again.

Its numbers come from the makeover canvas's game (seed 1, Vella & Co. at
mid-price performance, its keywords) played to week 12 with four decisions a
player could make from the screens: block "cheap" at week 4, ₹55,000 to the
size guide at week 5, the broad bids ₹24 → ₹18 at week 7, "gym leggings" ₹33 →
₹40 at week 10. Only the guesses are invented. Drawing it, and a second reader
checking every figure against the code, found four faults, recorded on the
canvas: "What if I hadn't?" deletes a decision where it should keep the change
out, stops at the next decision of any kind, and at week 5 makes the capital
vanish (blocking "cheap" read ₹8,067, worth ₹75,021 to the end; the size
guide's answer reversed); the budget question cannot answer for a capital week,
because the rollover re-spreads the month and undoes its raise; net profit never
counts capital spent on the business; and returns come back two weeks after a
sale, so the last five weeks read high and weeks 11 and 12 count none. The owner
chose to fix both replays first and to say the other two plainly on the
screens; the mock-ups show the corrected answers and those sentences. Still
open: keeping round 0's notes for the reveal.

## `guide/`: the Guide as a page (2026-09-15)

An eleventh canvas, https://claude.ai/code/artifact/5a912577-a5cc-4107-9923-c351e61837fd,
the last item on the makeover design's section 7 list. Today the rail's Guide
button opens the field guide's drawer at its contents, over whichever section
the player was in; the layout table gives the Guide area "the field guide as its
own page".

- **Page 1**, `Main.dc.html` and `Contents.dc.html` (A · the guide as a book),
  **chosen by the owner on 2026-09-15**: the Guide area's list is Contents and
  the thirteen numbered chapters; the contents are thirteen cards (number, the
  section each explains, title, the first sentence of its real half); a chapter
  is its two halves side by side with the sources, the section it explains with
  Show me in your account, the chapters to read beside it, and previous and next.
- **Page 2**, `Beside.dc.html` (B · beside your account): A's page with a panel
  of the chapter's own figure in the player's account, drawn for four chapters.

Every chapter is the game's own, read through the drawer's `guideView`; B's
figures come from the makeover canvas's game after week 6. A second reader
checked every chapter, figure and claim against the code. It found B's
broad-match panel listing phrase match's longer searches as broad match's
wandering (redrawn with only what broad match alone reached), and five things
the build must answer, recorded on the canvas: Show me marks nothing in the
Studio (the ring exists only on the classic cards, and focus looks for their
heading); three chapters point where their idea is not shown ("Who writes the
ad" at Your keywords, "Defending your own name" at Rivals, "What only a
simulation can tell you" at a month bar with no "what if"); two chapters name a
classic card; the rail's area buttons always open the first section, so a trip
to the Guide loses the player's place; and the page needs a handful of new
labels. The owner also chose: chapter 12's Show me points at Results' replays
after week 12 and is hidden before; "Read beside it" stays after a read-through
of every related list; "why?" still opens the drawer.

## `switch-over/`: the switch-over (2026-09-16)

A twelfth canvas, https://claude.ai/code/artifact/54dadd5c-e4db-43fd-90ef-dd8117aa2c19,
for section 7's last item: the new look becomes the default and the old
screens and their code are removed. It draws what the Studio never drew and
maps what goes live.

- **Page 1**, `Main.dc.html` (A · the front door on its own), **chosen by the
  owner on 2026-09-16**: before a game opens, one card with the brand, the
  twelve weeks as dots and the choices, in every state the door has (the
  resume offer, restoring, a game that has changed, a game this version cannot
  open, a finished game), with the playtest file on the playtest link; and
  `Playtest.dc.html`, the playtest questions as a fifth Results section,
  "Before you go", with Play again after the file.
- **Page 2**, `Release.dc.html`, what goes live: every branch waiting, what it
  brings, and what it does to a game a tester has saved on the live site.
- **Page 3**, `Shell.dc.html` (B · the door in the Studio's frame), not chosen.

With the pick the owner chose the classic look removed, as the makeover design
recommended, and F17 and the rival prepaid fix in the release. Measured, with
saves made on the live site's code: a hired writer's six weeks, a self-written
ad's six weeks and a finished twelve all replay exactly on `makeover`; F17
changes almost any game whose budget ran short (week 1's Rs 55,939 on 4,284
clicks becomes Rs 78,247 on 6,536). A second reader checked the words, the
figures and every branch against the code and git: "Try again" went from the
door that cannot open a game (a replay fails the same way every time), the
changed game lists only the weeks that differ as saved against replayed now,
and the release's housekeeping is on the canvas.

## The map data

`build-map.mjs` and `build-cities.mjs` are one-shot Node scripts, run by hand.
They turned DataMeet's india-composite boundary into `ui/india-map.js`, reducing
242,146 points to 2,088 by Douglas–Peucker. `india-path.json`, `india-cities.json`
and `map-data.json` are their output, kept so the number in `ui/india-map.js` has
a provenance rather than an origin story.

**The two raw downloads are not in the repo** — a 17 MB composite and a 10 MB
GeoJSON. The scripts name their sources; re-download if the map ever needs
redrawing.

`ui/india-map.js` says it and it is worth repeating here: this is **display
geography only**. No engine number is derived from it. The location tiers in
`constants.js` are the model; the map is a picture of what they describe.
