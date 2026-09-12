# Google Trends exports

What the January surge is sized from (`plans/2026-09-13-january-surge.md`,
section 6; DECISIONS F16). Read by `scripts/season-lift.js`. Never published:
`tests/build.test.js` holds `dist/` to exactly the files the game loads.

## How each file was made

For each term: open https://trends.google.com/trends/explore, type the term, set
**India**, **Past 5 years**, **All categories**, **Web Search**. On the
*Interest over time* chart, use the download arrow (CSV). Save it in this
folder as `<group>--<term with dashes>.csv`.

One term per file, on purpose. Trends scales every file so its highest point is
100. The method only ever divides a term by itself, so files never need to be
compared, and a term alone in its file gets the whole 0–100 range.

## The fourteen terms

| group | terms (one file each) |
|---|---|
| `training` | gym leggings · sports bra · gym wear · gym clothes · workout clothes |
| `lifestyle` | co ord set · loungewear · joggers · athleisure · lounge pants |
| `junk` | gym near me · workout plan · how to lose belly fat · gym membership |

The training terms are the buying side of a resolution. The lifestyle terms are
the control, and must not rise. The junk terms are the searches broad match
wanders into.

Expected file names:

```
training--gym-leggings.csv
training--sports-bra.csv
training--gym-wear.csv
training--gym-clothes.csv
training--workout-clothes.csv
lifestyle--co-ord-set.csv
lifestyle--loungewear.csv
lifestyle--joggers.csv
lifestyle--athleisure.csv
lifestyle--lounge-pants.csv
junk--gym-near-me.csv
junk--workout-plan.csv
junk--how-to-lose-belly-fat.csv
junk--gym-membership.csv
```
