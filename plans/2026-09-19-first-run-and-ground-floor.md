# The first run, and the guide's ground floor

**Design doc. Nothing is built from it yet.** Written 2026-09-19 with the owner,
after two strangers played the game on `playtest-4` and neither finished. One
gave up inside round 0; the other stopped around week 6 and agreed with the
first one's complaint. `main` is frozen for engine changes, and nothing in this
design touches `engine/`.

Neither tester sent a playtest file, so everything measured here is measured on
the code and on the engine, not on a recording. What the testers said is quoted
as what they said, and kept separate from what was measured.

---

## 1. What this is, and what it is for

The game is a learning tool, and it has a guide. The guide explains the
interesting parts of a subject whose basics it never covers, and round 0 hands a
beginner seven decisions in a vocabulary nobody taught them.

**The tester's own sentence**, quoted by the owner:

> "This might be a simulation that may be easy to do for people who are already
> well akin or accustomed to Google Ads or the concepts around advertising. But
> for someone who is new to this, these all seem like too text heavy and working
> around concepts that they are not at all familiar with. And even if the
> explanation is there, the explanation is not good enough and not simple
> enough."

**Decided with the owner, 2026-09-19.** The audience is a **true beginner**:
someone who has never bought an ad and does not know what a keyword is, and who
should be able to finish the game with nobody sitting next to them. That is the
bar every decision below is measured against.

**The lesson the design serves:** you cannot teach someone what a bid *does*
before they know what a bid *is*, and the game currently never says.

## 2. What was measured

### 2.1 Cutting words has already been tried, and it did not work

Round 0 was **2,648 words** before the redesign and is **781** after — a 70% cut,
measured in `plans/2026-09-14-round-zero-redesign-plan.md`, Task 15. A stranger
still gave up inside it. **Fewer words is not the remedy**, and this design does
not re-cut round 0.

### 2.2 The first screen a new player sees is the market

`ui/app.js:286`: with no saved game, `render()` goes straight into round 0. The
front door exists only to handle a save. So the tester's *"as soon as the
simulation opens, you are introduced to the market"* is literally what the code
does, and the slot before round 0 is empty.

The only statement of purpose in the game is one line,
`ui/words/roundZero.js:67` — *"12 weeks against 8 rival brands. You finish ranked
by profit after returns."* That is a win condition, not a purpose.

### 2.3 The guide has no ground floor

Thirteen chapters, every one a nuance of something you are assumed to know. None
defines **keyword**, **bid**, **CPC**, **auction**, **ad rank**, **impression**,
**click**, **conversion**, **landing page**, or **the price × purpose square**.
The file says so itself: *"A chapter is optional depth."*

### 2.4 The doors are shut where they are most needed

`ui/words/roundZero.js` holds **134 pieces of text and 6 `why?` links**, opening
onto 4 of the 13 chapters.

### 2.5 The departure is the largest part of the hardest chapters

Measured across all 13 chapters with their figures resolved:

```
game halves      words             median  95   max 120
                 longest sentence  median  32   max  41
                 first sentence    median  21   max  36
```

And, for the eight chapters that name a departure at all:

| chapter | the departure | of the whole |
|---|---|---|
| `hours` | **73 words** | of 109 — two thirds |
| `cashOnDelivery` | **65** | of 118 |
| `weeklySplit` | 37 | of 95 |
| `attributionLag` | 35 | of 92 |
| `broadMatch` | 20 | of 91 |
| `qualityScore` | 17 | of 118 |
| `smartBidding` | 16 | of 82 |
| `writers` | 14 | of 120 |

**The two chapters the testers named as hardest are the two where the departure
is the largest share of the chapter.** The owner reported the trouble in
*Why this week's numbers keep moving* as starting *"from where it departs all the
way to the end"*, and named *Bidding by the hour*'s game half as the other. That
is a structural fault, not a wording one.

**And five of the thirteen declare no departure at all** — `returnsSplit`,
`counterfactuals`, `kindMarket`, `rankOrBudget`, `ownName`. Nothing checks, so
the honesty mechanism the project runs on is silently absent from more than a
third of the book.

### 2.6 A figure with no noun

`ARRIVAL_SHAPE` (`ui/dashboard.js:53`) renders *"55% this week, then 28%, then
12% and then 5%"*, and never says 55% **of orders**. The tester read four
percentages attached to no thing. `ui/guide/figures.js` is its only consumer.

## 3. The shape: three layers, one word, one home

| layer | teaches | where it lives | met |
|---|---|---|---|
| **the world** | what happens whether or not you act: search, ad, position, impression, auction, bid, ad rank, click, cost per click, budget, conversion, the delay, return | **the first run** (new) | once, before round 0 |
| **your controls** | the levers round 0 hands you: break-even, positioning, keyword, match type, bid, ad, landing page, budget, capital | **new ground-floor chapters** | on demand, from the step that asks |
| **the surprises** | why those levers behave oddly | **the 13 existing chapters**, rewritten | on demand, for the curious |

**The rule that holds them apart: one word, one home.** The first run says what a
click *is*; no chapter re-defines it. A ground-floor chapter says what a bid
*does*; the first run only shows money leaving. A nuance chapter may use a term
freely but may not define one that has a home elsewhere. `tests/guide.test.js`
holds this.

**Approaches rejected, 2026-09-19.** *Teach on demand only* — put the ground
floor in the guide and add links — was rejected because it is still optional, and
the tester who quit did not open the guide; optional help is declined by the
people who need it, which is what already happened. *Teach in the way* — inline
in round 0's steps — was rejected because it re-inflates the words that were cut
70% to fix this same complaint, and taxes every later player to help the
first-time one. It stays the fallback if the chosen design fails (section 9).

## 4. The first run

### 4.1 What it is

Seven beats before round 0, told as one story about one search, using the brand
the seed has already drawn. Artboards in `design/first-run/`, and a playable
prototype at `design/first-run/prototype.html`.

| # | on screen | the words it teaches |
|---|---|---|
| 1 | someone in Pune types **"gym leggings with pockets"**; about 1,849 search it a week | a search · search volume |
| 2 | four ads above the results, real rival copy; yours was shown | an ad · position · impression |
| 3 | nobody bought those slots — the real ladder, nine brands ranked on bid × fit | a bid · the auction · ad rank |
| 4 | she clicks; **₹25** leaves the budget; she has bought nothing | a click · cost per click · budget |
| 5 | three weeks later she buys ₹2,400 — counted in the week she *clicked* | a conversion · the delay |
| 6 | two weeks after that it is refused at the door; ₹2,400 back, ₹200 freight gone | a return · refused at the door |
| 7 | 430,000 searches a week, nine brands, and one of them is you | what the game is |

**Beats 5 and 6 were one beat until the owner split them on 2026-09-19.** The
delay and the return are the two hardest ideas in the run and they were sharing
the board where attention is thinnest.

### 4.2 It is told about the nine brands, not about "you"

Until beat 7. The player has chosen no position, no keyword and no bid, so
"you bid ₹30" would teach something false on the first screen of a project whose
premise is that a simulator teaching something false is worse than none.

### 4.3 Every figure is the engine's

The demonstration auction is **one real auction**, not written prose. Precedent:
`ui/reserve.js` already runs the engine's own functions for round 0's reserve
warning, and states the principle — *"Every step is the engine's own function, so
this cannot drift from the auction."*

Resolved on `q_056` at hour 19, seed 20260902, with the rival ads from
`content/adCopy.js`:

```
pos  brand      bid    quality   ad rank   pays
1    Marlow     ₹30    0.0917     275.1    ₹25
2    Halcyon    ₹16    0.1468     230.3     ₹9
3    Auren      ₹19    0.0739     138.5    ₹17
4    Lumen      ₹17    0.0727     126.1    ₹13
—    Torvi      ₹9     0.1030      91.1        —
—    Nira       ₹8     0.0787      62.3        —
```

Six of nine entered; three had no keyword that matched. `AD_RANK_FLOOR` is 48, so
Torvi and Nira clear the reserve and are out on slots, not on price.

**Marlow bid ₹30 and pays ₹25 for slot one. Halcyon bid ₹16, sits one place
below, and pays ₹9 — because its ad fits the search better.** Nobody wrote
that; it fell out of the auction. It is the run's central lesson, and beat 3 says
only: *"You can buy your way up. It costs you every click."*

The **quality signal is drawn as a bar with no number.** The raw signal is not a
figure the game shows players, so printing it would invent one.

Other figures: 43bp of `WEEKLY_VOLUME` 430,000 gives 1,849 searches a week;
₹2,400 order value and 52% margin are `setup.js`'s `briefing()` for the mid tier;
41.7% of mid-tier orders come back; ₹200 is `RTO_FREIGHT_PAISE`, charged on a
**refused** parcel only, which is why beat 6 is a refusal rather than a
send-back; five weeks to settle is `engine/attribution.js`'s own header.

### 4.4 How it is paced

**One beat at a time, advanced by the player.** No autoplay and no timers — a
timer freezes in the browser pane and records nothing (HANDOVER's known traps),
and pacing that the player holds is the honest answer to both testers' *"more
interactive"*. A played beat collapses to one quiet line and stays on screen, so
a re-reader can scroll back.

**Skip** is on every beat but the last. The last offers **Watch that again**,
which is also how the Guide reopens it. Seen once per browser.

### 4.5 Its motion is the review's, not new

`reviews/slc-review.md` section 13 already decided this project's motion. The run
uses it exactly, and adds nothing:

- a beat enters on opacity and an 8px rise, **240ms**, `cubic-bezier(0.23, 1, 0.32, 1)` — row 2;
- **Back** reverses the direction, **260ms**, `cubic-bezier(0.77, 0, 0.175, 1)` — row 3;
- the ladder reveals **row by row at a 50ms stagger** with its bars growing from zero — row 5's end-screen reveal applied to the same idea, nine brands in rank order, which makes "ranked" legible without a sentence;
- the Go button takes `scale(0.97)` on press — row 4.

**No counting tickers anywhere.** Every rupee figure appears at its true value:
a ticker shows in-between numbers the engine never reported. A bar may grow
because a bar is a picture of a value, not a value being read. Under
`prefers-reduced-motion` every translate is dropped and the fades stay.

Four motions, inside section 13's cap of five to seven for the whole app,
transform and opacity only, no library.

### 4.6 Where it sits, and what it must not touch

`no save → first run → round 0 step 1`, in place of today's
`no save → round 0 step 1`. It runs **before a game exists**, so it reads no
`GameState`, writes no save, and moves no number. Its sentences live in
`ui/words/firstrun.js` and its drawing in `ui/firstrun/`, which joins the drawing
guard in `tests/words.test.js`.

**The word budget is measured per screen, not in total** — corrected 2026-09-19
while building Task 1. This doc first said "167 words for the whole run", which
counted the prototype's prose and not its labels, kickers, column headings and
buttons. Measured over every line the run is **477 words**: 297 of prose, 139 of
label, 41 of instruction.

That is still well under round 0's 781, and spread over seven screens rather
than five — but a total was never the figure the argument rests on. **A beginner
drowns on a screen.** Round 0's step 1 is 281 words, about 248 visible at once,
and that is the step a stranger gave up inside. So the bound `tests/words.test.js`
holds is **no beat over 80 words on screen**, the opening statement counted
against beat 1 which carries it. Measured today: beat 1 is 75 with the opener,
beat 3 is 65, and nothing else reaches 62. A second bound, 500 words in all,
is a ratchet against the run growing to fifteen beats.

## 5. The guide's ground floor

### 5.1 `chapter()` gains a sibling, not a flag

`chapter()` (`ui/guide/chapters.js:45`) requires a `real` half with a source, a
`game` half, at least one citation, and a card in the player's account. For
*"what is a keyword?"* three of those cannot be filled honestly: there is no
departure to describe, no DECISIONS entry that says the game has keywords, and in
round 0 the keyword card does not exist yet.

**Decided with the owner: a second constructor, `basic()`.** Its contract is
`title`, one plain definition, `realSources` whenever it makes a real-world
claim, and `seeItIn` — the round 0 step where the term is used. No `game`, no
`cites`, no `yourAccount`.

Rejected: **a `ground: true` flag**, on the pattern of `device: true`, because
`device` waives one rule and this would waive three, and a flag that switches off
half the validation spreads. Rejected: **changing nothing** and giving ground
chapters a `game` half citing a spec section, which `CITATION` already permits —
it costs no code, and it reproduces the exact two-halves shape that lost both
testers. A beginner asking what a keyword is wants one answer, not a comparison.

`basic()` also lets the contents page separate **Start here** from **Going
deeper**, which is itself teaching.

### 5.2 The nine

One per control round 0 asks you to operate, in the order you meet them.

| # | chapter | step |
|---|---|---|
| 1 | What a click is worth to you — break-even | 1, the market |
| 2 | Where your brand sits — price × purpose | 2 |
| 3 | Keywords: the searches you bid on | 3 |
| 4 | How loosely a keyword matches — exact, phrase, broad | 3 |
| 5 | Your bid, and what you actually pay | 3 |
| 6 | What an ad is made of | 4 |
| 7 | Your landing page | 4 |
| 8 | Your budget, and what running out means | 5 |
| 9 | Capital: spending on the business, not the ads | 5 |

**Number 1 matters most.** Round 0 step 1 shows *"₹20.37 a click at break-even"*
— `₹2,400 × 52% × 58.3% × 2.8%`, from `briefing()` — and nothing in the game says
what that means or what to do with it. It is the most important number a player
is handed and it arrives undefined.

**Number 4 shows the division.** The ground floor says **what** exact, phrase and
broad are. `broadMatch` keeps the surprise: how far broad wanders, and why
broadening lowers impression share while raising impressions.

### 5.3 Reachability is part of the design

A ground floor nobody can find is worth nothing. **Every term a ground-floor
chapter defines gets a `why?` the first time round 0 uses it.** `line()` already
carries the option; `tests/words.test.js` holds the rule, as it already holds
sentences out of drawing modules. Six links become roughly thirty.

## 6. The rewrite

Five rules, applying to `ui/guide/` and the new ground-floor chapters only.
`HANDOVER.md`, `DECISIONS.md`, commit messages and the rest of `ui/` keep their
voice.

1. **`departs` becomes its own field, and it is a list.** One departure per
   entry, rendered as a labelled block a reader can skip. The `game` half gets
   shorter by construction, `hours`' three departures become three items rather
   than *"It departs three times"*, and a test can finally require the field —
   every chapter declares `departs`, or declares it empty **with a stated
   reason**, which closes the five silent chapters.
2. **A game half opens in 15 words or fewer.** A topic sentence you can act on,
   before any qualification. Median today is 21; nine chapters change.
3. **No sentence over 25 words, anywhere in the guide.** Median today is 32.
   This is most of the work.
4. **Every figure names what it counts.** Fixed at source: `ARRIVAL_SHAPE` says
   *of orders*. One consumer, so it is contained.
5. **A banned-jargon list**, seeded from what actually failed — "shape" for a
   distribution, "lean" as a noun, "stack" as a verb, "departs" in prose — and
   extended every time a reader trips on a word, which makes it a ratchet rather
   than a guess.

**The trade, stated so it is chosen rather than discovered.** The guide's voice
is good, and the compression that makes it distinctive is part of what a beginner
cannot parse. Rules 2 and 3 spend some of that voice to reach them. The owner
accepted the trade on 2026-09-19.

**What is not testable.** Rules 1, 2, 3 and 5 are machine-checkable. Rule 4 is
checkable at its source but not per sentence. **Whether the prose is actually
clear is not testable at all** — the caps stop the failures we measured, not a
24-word sentence that happens to be obscure. That needs a reader, so the gate is
the owner first and the next playtest after.

## 7. The mid-game questions

**The game can only ask what it taught you if you finish.** "Before you go" — the
two questions and the download — lives on Results (`ui/results/render.js:740`),
after week 12. The **Playtest** button in the rail (`ui/shell/shell.js:144`) has
always downloaded the file at any point, and the invite already tells a tester to
press it if they give up. But it asks nothing.

So the whole population this design exists for — people who stop early — has
never been asked a single question, and the two who just stopped sent no words at
all except through the owner.

**Decided with the owner, 2026-09-19: pressing Playtest mid-game shows the two
questions first, then the file.** Same wording, from `ui/words/playtest.js`, so
the answers in a partial file and a finished one are answers to the same
question. It is contained in `ui/`, moves no number, and turns every abandonment
into data.

## 8. What this refuses

- **Animating the rest of the game.** Both testers asked for it; the owner parked
  it, and section 13 agrees that animating before the screens settle polishes
  what a rebuild is about to shrink. The first run earns four motions because it
  is a new screen.
- **Re-cutting round 0's 781 words.** Already tried at 70%, and it did not work.
- **An "are you new to this?" toggle.** Two paths to build and test, and
  beginners decline help that requires admitting they need it.
- **A glossary page.** It would give every term a second home and break section
  3's one rule.
- **Abolishing the real / game split.** `departs` moves out of the game half; the
  real half stays, because it is what keeps the guide honest about the difference
  between the simulation and reality.
- **Anything in `engine/`.** No number moves, no market harness run, no
  calibration check, and every existing save still replays.

## 9. How we would know

### 9.1 On the code, before any tester

| | today | after |
|---|---|---|
| chapters declaring a departure | 8 of 13 | 13 of 13, or explicitly empty with a reason |
| sentences over 25 words in the guide | the median chapter has one | none |
| game halves opening in ≤ 15 words | 4 of 13 | 13 of 13 |
| `why?` links in round 0 | 6, across 134 lines | one per term the ground floor defines |
| the first run's words | — | under 200 |

### 9.2 From the next playtest file

The recorder already measures all of this; it needs one new phase.

- **Someone finishes round 0.** The blunt gate, and the actual failure.
- **The first run costs under 2 active minutes.** `recorder.phase('first run')`
  plus a row in `scripts/read-playtest.js`'s `GROUPS`, and the file prints it
  beside round 0. Over five minutes and the problem has moved, not gone.
- **Round 0 stays under 10 active minutes.** The run is its own phase, so §12's
  gate stays clean rather than being quietly absorbed by it.
- **The skip rate on beat 1.** If testers skip, the run failed whatever they say
  afterwards. `recording.clicks` names every control.
- **Whether any `why?` is ever clicked.** Six links become thirty; if none is
  touched, the ground floor is unreachable in practice.
- **Three lessons in their own words**, now askable of someone who stopped at
  week 6 (section 7).

### 9.3 What would prove it wrong

- **Strangers still quit inside round 0.** Then it was never the vocabulary: it
  is the seven decisions themselves, and the answer is a shorter round 0, not a
  better-taught one.
- **They finish round 0 but still cannot state a lesson.** Then on-demand was the
  wrong shape, and the ground floor moves inline into the steps — the rejected
  approach from section 3, with evidence behind it the second time.

## 10. The tests it needs

- `tests/guide.test.js`: every chapter declares `departs` or an explicit empty
  with a reason; no sentence over 25 words; a game half opens in ≤ 15; no banned
  word; **one word, one home** — nothing defined by a `basic()` chapter is
  defined again in a `chapter()` one.
- `tests/words.test.js`: `ui/firstrun/` joins the drawing guard; every term the
  ground floor defines carries a `why?` on its first use in round 0; the first
  run's word budget.
- `tests/firstRun.test.js` (new): the run's seven beats in order, Skip and Back,
  seen-once-per-browser, and that it reads no `GameState`.
- The demonstration auction is asserted against `resolveAuction` itself, so it
  cannot drift from the engine — the rule `ui/reserve.js` already follows.
- `tests/build.test.js`: the file count moves, and `dist/` must still hold
  exactly what the game loads.
- A played-through smoke test from the first run into week 1. *"The build works"
  means playing it* — the dashboard once crashed after week 1 for two days with
  1,348 tests green.

## 11. Known weaknesses, stated rather than hidden

1. **Two testers is not a measurement.** One quit in round 0 and one stopped at
   week 6; everything in section 2 is measured on the code, and everything about
   *why* they stopped is recollection relayed through the owner. No playtest file
   exists for either.
2. **The run adds time before the player does anything.** §12's gate is round 0
   under ten minutes, and this design spends minutes to save them. The bet is
   that nobody quits because a screen took twelve minutes — they quit because
   they are lost. If the recorder shows the run costing five minutes and round 0
   unchanged, the bet was wrong.
3. **Tutorials get skipped.** Section 9.2 measures it rather than assuming it.
4. **The caps cannot make prose clear**, only short. Section 6 says so.
5. **The first run teaches one search on one seed.** A player whose own brand and
   square differ may find beat 7's "one of those nine is you" less pointed than
   intended. Using the seed's own brand narrows this but does not close it.
6. **Nine new chapters plus thirteen rewritten is a lot of words to get right at
   once**, and the only real reader test is a stranger we do not have yet.

## 12. Open, for the owner

- Whether the **10-minute round 0 gate** moves, now that the run sits beside it
  rather than inside it. Flagged in conversation, not decided; it is a review
  gate and the owner's to move.

**Decided 2026-09-19, after this doc was written: the first run is built first**
— section 4, as `plans/2026-09-19-first-run-plan.md`, in five tasks. The rewrite
(section 6), the ground floor (section 5) and the mid-game questions (section 7)
follow, each with its own plan. The first run went first because it is the
change the evidence points at: both testers met the vocabulary before they met
the guide.

## 13. Where it came from

- Two strangers played `playtest-4` and neither finished (2026-09-19). Neither
  sent a file.
- `reviews/slc-review.md` §8 predicted it: *"The risk isn't running out of time.
  It's quitting inside round 0."* §12 stages C and D are the route this serves;
  §13 supplies every motion rule in section 4.5.
- `plans/2026-09-14-round-zero-redesign-plan.md` Task 15 supplies the 781-against-
  2,648 measurement that rules out cutting further.
- `design/first-run/` holds the artboards and the playable prototype.
