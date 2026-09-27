# The week plays out

**BUILT 2026-09-27 as DECISIONS I58.** What changed in the building is recorded
there: the sentences were rewritten so none repeats its own figure, and the
rival is named by `overlapRate × positionAboveRate` rather than by overlap
alone, because the most-met rival is often one you beat. Section 10's three
open questions were answered by the owner: seven steps, two automatic plays,
and yes, name the rivals.

Written 2026-09-27 with the owner,
after the first playtest file anyone has ever sent (`playtest-2026-09-27-1620`,
recorded on `f65a3d7`, the ten-beat build).

Nothing in this design touches `engine/`. Every figure it draws is already in
the week's report.

---

## 1. What the file said, and what it did not

**What it says, measured:**

| | |
| --- | --- |
| first run | 1:54 active, **0:00 hidden, 0:00 idle**, 10 clicks, all ten beats |
| round 0 | 4:56 active, 2:13 hidden, 5:39 idle, 5 clicks — every one a tray *Next* |
| keystrokes, whole session | **0** |
| outcome | **no saved game: they stopped before week 1 finished** |
| both playtest questions | blank |

Reading rate collapses at beat 6, and the break is sharp rather than gradual:

| beat | | secs | words | words/sec |
| --- | --- | --- | --- | --- |
| 1–5 | search → price | 92.1 | 248 | 1.2 – 4.1 |
| 6–10 | click → yours | 21.9 | 251 | 9.7 – 13.5 |

Above about four words a second nobody is reading. So the attribution delay and
returns — the two subtlest ideas in the game — got 4.3 and 3.5 seconds.

Cards in round 0: Your money 3:35, **The market 1:55**, Where you sit 0:18,
**Your ad 0:06, Your keywords 0:03**.

**What it cannot say, and must not be made to say.** It is one file. There is no
earlier recording to compare it with, so it says nothing about whether ten beats
beat seven. And 2:13 hidden plus 5:39 idle fits "confused" and "the doorbell
rang" equally well. The owner's reading is that it may be plain lack of
interest, and nothing here contradicts that.

**One hypothesis was tested and failed.** That they could not find the button on
the last step of round 0. Measured in the browser: *Open the account and run
week 1* is 343 × 52, red, in view at y=705 of a 768 viewport. It was findable.

**The one thing that argues for the owner's instinct:** The market — the India
map with the tier cities — held 1:55, the second-longest card in the session,
and it is a *looking* screen. It out-held every screen that asked for a
decision.

## 2. The thesis

**The most interesting thing in this simulator is the auction, and after the
opening minute you never see one again.** Beats 4 and 5 teach the ladder. Then
every week for twelve weeks is a form you submit and a table you read.

So: pressing *Run week N* stops being a form submit. The week plays out.

## 3. Why the auction and not a clock

The first shape considered was a clock — the week running hour by hour. It was
rejected on the data, not on taste.

**Only clicks and conversions are kept per hour.** `acc.hourlyClicks` and
`acc.hourlyConv` are `new Array(HOURS_PER_DAY)` — 24 buckets, summed across all
seven days. Impressions, cost, position, who was above you and the budget
running out are all week totals. A clock could draw two curves, which is close
to what **Where and when** already draws.

**And days are not kept at all.** The round loops day 0–6 × hour 0–23 and adds
into 24 slots. Drawing Monday to Sunday would mean reconstructing days from
`DAY_OF_WEEK_CURVE` — inventing intermediates and presenting them as what
happened. There is a second reason too: **the player has a lever on hour of day
and none on day of week**, so a seven-day chronology would put drama on a
dimension that is not a decision.

**What the week keeps is much richer**, and all of it is already in the report:

| field | week 1, `mid|performance`, seed 20260902 |
| --- | --- |
| `traffic.eligibleAuctions` | 75,508 |
| `traffic.impressions` | 52,140 |
| `share.impressionShare` | 0.69 |
| `share.lostToBudget` | **0.30** |
| `share.lostToRank` | 0.01 |
| `positions.counts` | 25,525 / 15,263 / 7,583 / 3,769 |
| `traffic.clicks` | 4,244 |
| `traffic.costPaise` | 8,574,992 (₹85,750) |
| `conversions.asFirstReported` | 105.5 |
| `conversions.stillPending` | **86.3** |

`stillPending` is sales from THIS week's clicks still in the queue
(`clickedInRound === round`, `engine/report.js:62`), so the last step is true as
written.

## 4. The steps

Seven, about two seconds each, and **every figure names the field it reads**. No
number counts up to anything (I52's honesty rule); each figure arrives at its
final value and the motion is in what is revealed, not in the digits.

| # | shows | reads |
| --- | --- | --- |
| 1 | the auctions you could have been in | `traffic.eligibleAuctions` |
| 2 | how many you were shown in | `traffic.impressions`, `share.impressionShare` |
| 3 | **why you missed the rest** — budget, not rank | `share.lostToBudget`, `share.lostToRank` |
| 4 | **the ladder**, your four slots | `positions.counts` |
| 5 | who clicked, and what it cost | `traffic.clicks`, `traffic.costPaise` |
| 6 | who bought | `conversions.asFirstReported` |
| 7 | **and who has not decided yet** | `conversions.stillPending` |

**Step 3 is the one that earns the sequence.** Thirty per cent of this player's
auctions were lost to budget and the dashboard says so in a figure nobody reads.
Here it is a step of its own.

**Step 4 is the thesis.** It is beat 4's picture, weekly, with the player's own
numbers in it.

**Step 7 is a relocation, not an addition.** It teaches the attribution delay at
the moment it happens, which is beat 8 — the beat this tester gave 4.3 seconds
to, ninety seconds before anything had been clicked. The run keeps its beat;
this is the same idea meeting the player again when it is true of them.

## 5. Where it sits

Follows `ui/firstrun/`, which is the closest existing thing: a transient phase,
not a section of the shell.

```
ui/playout/read.js     the seven steps as data, no DOM. What each reads,
                       what is shown, whether a step has anything to say.
ui/playout/render.js   drawing only. Holds no sentence (the drawing guard,
                       tests/words.test.js).
ui/words/playout.js    every sentence, as `line`s.
```

**The hook is one branch in `runWeek`** (`ui/app.js:447`), between `persist()`
and `render()`. `runWeek` already computes, stores and redraws; the playout
renders in place of the dashboard and calls `render()` when it finishes or is
skipped. The pattern is I54's `replayIntro`: a module-level flag and a branch in
`render()`, so nothing else has to know.

**Round 0's own button runs week 1 down the same path**, so the playout is the
first thing a new player sees after Go. That is deliberate: it is the moment the
opening minute pays off.

## 6. Skipping, and not wearing out

Fifteen seconds twelve times is ninety seconds — the exact budget this tester
ran out of. So:

- **Skip is always present**, and skipping goes straight to the dashboard.
- **It stops offering itself.** After week 2 it no longer plays automatically; a
  *Watch the week* control on the dashboard replays it for any week. Two
  automatic plays, then on request.
- **Skipping once is remembered.** A player who skips week 1 does not get it
  again in week 2.
- `prefers-reduced-motion` shows all seven steps at once, static, with no
  timing.

**The number of automatic plays is `DESIGNED`, not measured** — it is a rule of
the game, not a claim about advertising, and it goes in `constants.js` with that
tag and a `DECISIONS.md` entry.

## 7. Recording

`recorder.phase('the week playing out')` on entry, so the next playtest file
says whether it was watched or skipped and for how long. **This design came from
one file; the next one should be able to judge it.** The recorder already
carries phases, and `scripts/read-playtest.js` groups them.

## 8. What this does NOT do

- **It does not fix Your money.** 3:35 and no click, on the step where
  ₹1,50,000 is allocated across five categories ninety seconds after fifteen new
  words. A week-playout on the far side of that screen changes nothing about it.
  Separate job, separate design.
- **It does not touch the engine**, the market, or any number. Nothing to
  re-calibrate, no perf risk, no schema change.
- **It does not prove the tester would have stayed.** Nobody can know that from
  one recording.

## 9. Tests

- Each step reads the field the table above names, from a **played** week —
  not a hand-built report. The `harnessPlayer` + `playRound` route, as
  `tests/rivalsInPlay.test.js` does. A fixture-shaped report is how three rival
  rules read zero for months with every test green.
- No step draws when its figure is absent, and none prints `undefined`, `NaN`
  or `[object`.
- The drawing module holds no string of three words (the guard).
- Skip reaches the dashboard from every step.
- The automatic play stops after the designed number of weeks, and a skip in
  week 1 is remembered in week 2.
- `prefers-reduced-motion` draws all seven and sets no timing.

## 10. Open, for the owner

1. **Seven steps or fewer?** Steps 1 and 2 could be one. Seven at two seconds is
   fifteen including the landing; five would be eleven.
2. **Two automatic plays, or one?** Written as two above.
3. **Does the ladder step draw the rivals by name?** `positions.counts` gives
   the player's own four slots with no engine change. Naming who was above you
   needs `insights`' pairwise `positionAboveRate`, which is per-week and real —
   but it is per-rival-pair, not per-slot, so "Halcyon was above you 14% of the
   time you both showed" is true and "Halcyon took slot 1" is not. Worth having,
   and worth being careful about.
