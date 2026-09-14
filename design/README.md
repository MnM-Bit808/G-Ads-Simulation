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
