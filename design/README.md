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
