# HANDOVER.md

State of play, for whoever picks this up next — including a fresh Claude Code
session, which will have read the files but not the conversation that produced
them.

Everything factual lives in `ENGINE_SPEC_v0.3.md` and `DECISIONS.md`. This file
carries the things those two cannot: where we are, how we work, and what is
still resting on a guess.

---

## Start here

**The newest session (2026-09-12) reviewed the product and began its stage A.**
- **`reviews/slc-review.md` is the product review.** It covers Simple, Lovable
  and Complete, with scores, a 45-minute verdict and a route of seven
  recommendations in five stages. Read its section 12 for the route.
- **Stage A1 is done (`4e24039`).** It fixed the ten sentences that contradicted
  the model, plus the week-8 rank, which one finisher was never told.
- **Stage A4 is done.** The game is saved in the browser and a reload offers it
  back (*Still open*, the database bullet, says how).
- **Stage A2 is done.** The location card's "net per click" was revenue beside
  a CPC; it is now "revenue per click" plus "kept per click", taken from the
  engine's own `moneyBlock` (now exported), and the card ranks places by what a
  click kept.
- **Stage A3 is done: DECISIONS E9.** A keyword taken from the planner now
  carries that search's own tags, as a rival's does; typed phrases are still read
  from their words. Exact-match accounts are unchanged to the rupee. Broad
  accounts now behave like a rival's: narrower for short lifestyle keywords,
  slightly wider for a sixty-keyword spray. **Stage A is complete.**
- **Next, by the review's route, is stage B:** measure brand ownership and the
  absolute economics, then three stranger playtests.
- **Decided with the owner:** the explanations will move into an optional field
  guide inside the game, after stage A.

**The session before (2026-09-11 to 12) closed the three items that had been open
longest**, in this order. Each has its full record in `DECISIONS.md`; the commit
messages carry the reasoning in between.

| | what happened | read |
|---|---|---|
| **F14** | the return level now equals what the engine's own sourced constants imply (42.7 / 41.7 / 39.6%), and a test pins it. It forced `PURPOSE_MODIFIERS.ret`, `AD_RANK_FLOOR` and `WEEKLY_VOLUME` to move too, each measured before and after | F14 *What shipped* |
| **A crash** | the dashboard had crashed after week 1 since 2026-09-10, with every test green. Found by playing the deployable build, fixed, recorded | I34 |
| **Deployment** | live on Cloudflare, tests gating every push, invite-only through Cloudflare Access | *Deployment* below |
| **F13** | accepted rather than engineered away: lifestyle's broad keywords crowd activewear auctions, the round 0 briefing now says so, and a test pins the asymmetry | F13 *What was decided* |

**Pending, and nobody's but the owner's:** a first playtester has not been added
to the Access list yet (see *Deployment* for how — it is one edit).

**What the next session is for.** The owner intends a fresh, analytical review of
the whole product rather than another fix — judging it as something a stranger
plays, not as an engine that passes its tests. Two things in this file are the
best raw material for that and are easy to miss in its length: *What playing it
as a learner found* (one full recorded game, engagement ending at week 4) and
*Still open* (what is known to be unfinished, and why).

**Reading order for a new session:** `CLAUDE.md`, then this section and *Where we
are*, then *Still open*, then *Deployment*. `DECISIONS.md` is a ledger to look
things up in, not to read front to back — its entries are long because they
carry their measurements.

---

## Where we are

**Every build-order step is done, and the location mechanic with them.** 1373 tests, all passing, 1 todo.

**THE GAME IS LIVE ON CLOUDFLARE, INVITE-ONLY** (2026-09-12), at
`https://g-ads-simulation.manikhorocks.workers.dev`. Every push to `main` runs the
full suite and deploys only if it passes; every visitor signs in with an emailed
code, and only addresses on the list get one. The list holds the owner's address
alone so far. See *Deployment* below, including how to add playtesters.

**The returns model is the newest thing here** (I28-I34, 2026-09-10, and F14,
2026-09-11). It was one number — `returnRate` — and is now a chain of six: price
tier, purpose, the search's own multiplier, where it was bought, which half of
the return it is, and what capital and a prepaid discount do to each half. It is
the only part of the engine with a shipping cost in it, and the only one whose
constants are mostly `DOCUMENTED` rather than invented. Read I28 before touching
it: the safety property it was built on — *a split of a fixed total* — is exactly
what made a later change silently impossible, and then produced F14.

**F14 IS FIXED, AND IT MOVED THE WHOLE MARKET.** The invented `returnRate`
(30 / 24 / 20%, meaning post-delivery returns only) contradicted the engine's own
sourced constants, which imply 42.7 / 41.7 / 39.6% for every kind of return. It
now equals them and a test holds it there. Three more constants had to follow,
each forced by the one before and each measured: `PURPOSE_MODIFIERS.ret` 0.85/1.20
→ 0.91/1.09 (or I3's purpose tilt broke), `AD_RANK_FLOOR` 60 → 48 (or two rivals
went dark), `WEEKLY_VOLUME` 350,000 → 430,000 (or budgets stopped binding). Returns
across a played market went 22% → 34%. **Every absolute figure measured before
2026-09-11 in this file describes the old market** — the directions mostly
survive, the numbers do not. F14's *What shipped* has the before-and-after.

**F13 IS ACCEPTED, AND TOLD** (2026-09-12). Lifestyle takes top rival in 27 of 30
played markets because its short, vague broad keywords — "everyday leggings" —
reach every activewear leggings search and activewear keywords barely reach back.
True to life, so it stays; the briefing now warns that activewear searches are the
most contested. The lifestyle seat is still the easier one, and whether that spoils
the game is a question for playtesting.

**74% of the model's constants are `INVENTED`** — 59 of 80, against 8
`DOCUMENTED`, 8 `ESTIMATED` and 5 `CALIBRATE`. Roughly 25 of the 59 are
legitimate game-design choices (twelve rounds, nine advertisers, the grid); the
rest are empirical claims wearing a design tag. F14 is what happened the first
time one of them was checked properly.

```
✅  1  constants, money, rng          ✅  8  pacing, attribution
✅  2  querySet + content             ✅  9  round
✅  3  auction                        ✅ 10  report, insights
✅  4  matching                       ✅ 11  serialise
✅  5  quality                        ✅ 12  calibration
✅  6  positions                      🟨 13  agents  — llmPolicy + queryGen left
✅  7  strategies                     ✅ 14  ui      — every control the spec has
```

Plus three modules the spec's layout never had, all of them caller-layer:

| | what it is |
|---|---|
| `game.js` | the round loop. Diffs decisions and writes learning periods (12.3), appends to `decisionLog` (12.4), attaches each advertiser's own Quality Score (15.2). |
| `setup.js` | round 0 (§17). Seeded rival placement, the briefing, the player's opening decisions, and the one redo (17.3). It is in NO build-order step — the order predates `game.js`. |
| `dev-server.js` | 40 lines of `node:http` so `ui/` can import the real engine. `npm run dev`. |

`ui/` is seven modules: `app.js` (the loop), `round-zero.js`, `dashboard.js`,
`decisions.js` (the between-weeks form), `chart.js` (the week-by-week trend of
Auction Insights), `ending.js` (the last screen, and the only reader
`decisionLog` has ever had) and `landing-page.js` (the page the capital builds).

`content/writers.js` is newer than the rest of `content/`: who writes an
advertiser's ad, what that costs, and what it guarantees (DECISIONS I11).

**The interface was laid out across the page rather than down it.** Round 0 was
a single 980px column in a 1425px main — 5.6 screens of scrolling with ~445px
empty down the right; the dashboard rendered a four-column grid as one column
because eight of thirteen cards were full width. Both were measured before
being touched, and the measurement changed the plan twice:

- **Naive pairing is worth almost nothing.** Round 0 two-up came to 4767px
  against 5059px, and merely removing the width cap to 4803px. Halving a card's
  width INFLATES its height — "who else is here" goes 591px to 1590px — so
  pairing takes `max()` of two inflated cards and gives the gain back.
- **The wide TABLES were the cheap ones to halve.** Search terms, a seven-column
  table, grew 11%; the six-figure headline row grew 118%. Tables sit in capped
  scroll regions and only their notes rewrap, while `auto-fit` figure grids
  collapse from six across to three and double.

So the tall cards were fixed internally first — the ad card's fields now sit
BESIDE its live grade, 1024px to 660px — and the grid spends what that freed.
Round 0 is 3948px (4.4 screens), the dashboard 3725px (4.1). Two attempts that
made things worse are kept as comments so nobody repeats them.

**Two screens answer questions nothing used to.** The bidding card says what
the strategy will actually bid and whether that clears the reserve, BEFORE the
week is spent finding out; and the end screen opens the books on all nine
advertisers once the last round is played. Both came from playing it — see
DECISIONS I12 and G3.

**Round 0 now asks two things it never used to.** Who writes the ad — yourself,
a freelancer, an agency or a retainer — and what is on your landing page, which
is built from the capital rather than described in a text box. Both are
DECISIONS I9 and I11, and both replaced a screen that was quietly teaching
something false.

**It is playable end to end, and has been played end to end.** `npm run dev`,
then http://localhost:5173 (`.claude/launch.json` sets `autoPort`, so a second
session gets a different port rather than colliding). Round 0 asks for brand,
position, capital, keywords, who writes the ad, the ad itself and a weekly
split; the dashboard plays a week at a time
against six rule-based rivals; and the decision form now lets the player write
negatives, change bids and match types, pause keywords and add new ones between
weeks, choose a bid strategy, take the round-5 capital allocation, use the one
repositioning window, divide the month across its four weeks and bid the hours
of the day. **Every control spec v0.3 describes is now reachable.** A full
twelve rounds runs through the interface with no console errors and ends on a
screen that says what the twelve weeks came to.

**The rescue works**, which is what slice three was for. The account this
project keeps coming back to — `premium|lifestyle`, five keywords taken off the
top of the keyword planner by volume, every one of them a Value-tier search:

| | week 3 | week 4 |
|---|---|---|
| Net profit | **−₹26,998** | **+₹39,570** |
| Net ROAS | 0.73 | 2.90 |
| CPA | ₹6,756 | ₹1,737 |

Between those two weeks, through the form and nothing else: three negatives
written off the search terms report, three Value keywords paused, a broad bid
cut, six premium and co-ord terms added from the planner.

**This table is NOT a baseline for an unchanged account, and a session that
treats it as one will chase a number it cannot reach.** By week 3 that account
had been played for two weeks — the broad keyword the bid cut refers to was added
along the way — so its week 3 is a different account from the week 3 of the same
opening left alone. Rebuilt and run with no changes, the same opening reports
−₹5,871 / 1.44 / ₹3,600, which is the figure quoted further down under *the
search terms report defaults to every week played* (−₹5,796, reproduced to 1.3%).
Two different week 3s, both real, and only the second one is replayable.

All five calibration invariants pass. Neither `CALIBRATE` constant moved without
argument, and both moved in F14:

| | value | why it is where it is |
|---|---|---|
| `AD_RANK_FLOOR` | 48 (was 60) | Raising it is regressive. A flat reserve takes the same absolute paise from every cell — a small bite out of Premium's ceiling, a fatal one out of Value's. Floor 150 took I3 from 2.8% to 50.8%; 250 wiped the Value tier out. **Standing still is raising it** when every ceiling falls, which is why F14 moved it: at 60 after the return level rose, both `cautious` rivals went dark for up to four weeks. |
| `WEEKLY_VOLUME` | 430000 (was 350000) | Pinned from both sides. Below ~395,000 I1 fails — a competently covered advertiser cannot exhaust its month. Above ~460,000 I3 fails — the flat budget cap bites unequally across break-evens differing 2.5x. **The two are read together**: a lower floor means cheaper clicks, which take more searches to exhaust a budget. |

I3 sits at **11.3% worst deviation, 1.19x spread** against a 15% target, 7.8% at
the raised budget. It had drifted to 13.2% after I28 build 2 without anybody
seeing it, because a passing invariant prints nothing — the 2.8% above predates
the location mechanic and freight.

---

## The decision form

`ui/decisions.js` is the form. It owns a **draft** and the cards that edit it.

**The seam, and the trap it is arranged around.** A decision is RETURNED from a
controller, never written into state. The draft is built from `getSelfView` —
which deep-copies on the way out, so the form *physically cannot* write through
into `GameState` — and `toDecision(draft)` hands back a `{ campaign, adGroups }`
object that `app.js` returns from the player's controller. `playRound` collects
it and `submitRound` applies it, so the player enters a round by the same door a
policy does (R6), and the learning period and the decision log both happen.

`toDecision` returns **null when nothing changed**, so an untouched form is
byte-identical to the `() => null` controller it replaced. There is a test for
exactly that, and it is the one that would fail if someone "simplified"
`createDraft` to take the advertiser record directly.

All of it verified by opening a browser, because `npm test` cannot see any of
it (see *Verifying the interface*).

1. ✅ **Negatives written from the search terms report.** A block button on the
   row writes an exact negative for that one search. The composer writes broad
   and phrase negatives with a live preview.
2. ✅ **Bids, match types, pausing, and adding keywords** from a mid-game
   keyword planner. New keywords are tagged offline as they are typed (8.4).
3. ✅ **Bid strategy and its parameter**, with the learning period named before
   the commit and again while it bites.
4. ✅ **The round-5 window** — the capital top-up and the one repositioning step,
   together, because they are drawn from the same month.
5. ✅ **Month 3 explained, and an end screen** (`ui/ending.js`).
6. ✅ **The weekly split**, with what each spent week actually cost beside what
   it was planned.
7. ✅ **Dayparting**, six blocks, over the player's own hour-of-day history.

**Nothing is left of the list.** What is left of the project is in *Still open*,
and none of it is interface.

### What items 3 to 5 settled that is worth not relearning

**The learning period is asked of `game.js`, not restated.** `willTriggerLearning`
calls the same `triggersLearning` that `submitRound` will call. If the two ever
disagreed, the player would be warned about a penalty they do not get, or worse,
not warned about one they do.

**The bid-strategy parameter is locked to the strategy that uses it**, and that
is a fix for a sharp edge in 12.3 rather than tidiness. 12.3 triggers a learning
period on "changing any value in `strategyParams`", and that object carries BOTH
`targetCpaPaise` and `targetRoas` at all times whatever is running. Left
editable, nudging the target ROAS while running Target CPA would cost two rounds
of doubled prediction error for a number that touches no bid. `setStrategyParam`
therefore takes no key: the strategy decides which parameter exists.
**Anything else that writes decisions will hit this** — an `llmPolicy` most of
all.

The decision still submits the WHOLE params object, both keys, because
`applyDecision` merges `campaign` shallowly and a partial one would drop the
other strategy's parameter. `rawBid` then throws rather than substituting a
plausible number, which is correct and also means the failure would be loud.

**`STRATEGY_PARAM` restates knowledge that lives in `rawBid`, so it is checked
against the engine rather than trusted:** every strategy the table gives a key
to must throw without it, every strategy it gives none to must run on empty
params. Same principle as the negatives preview calling `blockedBy`.

**The capital allocation is submitted whether or not the player touches it.**
Omitting `capex` is not declining it — it means the allocation is never claimed
and ₹1,00,000 disappears, no investment AND no rollover. So the default is an
explicit zero, stated on the card and listed under `Next week` with no undo
button, because there the default IS the decision. Round 1 is deliberately not
offered: round 0 spent that allocation, and asking again would hand the player
the rollover on top of an investment already made.

**`monthBudgetAfter` mirrors `applyBudgetAdjustments`**, which is a drift risk,
so five cases assert it equals what the round actually reports — including both
round-5 decisions at once, which is the case that matters: committing everything
AND moving leaves ₹68,000 of a ₹1,68,000 month.

**The rank is two integers.** `budgetSchedule.rankedAtSnapshot` orders every
advertiser by gross profit; `rankOf` returns `{position, of}` and the array goes
no further, so no screen can show a rival's standing even by accident. Showing
the player their own rank was a deliberate call: they can read it off their own
month-3 budget anyway (₹1,17,600 against ₹1,68,000 is the last-place multiplier
and nothing else), and 13.3 is explicit that a budget swinging for reasons
nobody can attribute is worse than the mechanic is worth.

### What items 6 and 7 settled

**The split resets every month, and the card has to say so.**
`advanceCampaign` re-evens `weeklySplitPaise` at every month boundary, because
the month's total can change — month 3 is redistributed by rank. A shape set in
month 1 does not survive into month 2. The card re-asks at the top of each
month rather than pretending the plan carried, and a test pins the reset so
nobody later "fixes" the card on the assumption it persists.
`applyBudgetAdjustments` also rescales the split whenever capital rolls in,
which preserves the shape but not the amounts — so at an allocation round the
card tells the player to set the shape rather than the exact rupees.

**Spent weeks are read-only.** `buildBudgets` only ever reads
`split[(round - 1) % ROUNDS_PER_MONTH]`, so editing a week that has already run
changes nothing. A control that does nothing is worse than no control. They
show what they actually SPENT beside what they were planned, which is the
comparison 13.2's burn-down exists for.

**The split warning asks the operative question, not the tidy one.** The first
version asked `validateWeeklySplit`, which sums the WHOLE split against the
WHOLE month — right at round 0 where `setup.js` asks it, wrong mid-month. With
weeks 1 and 2 under their plan there is MORE in the pot than the total implies,
and the card warned about a ₹3,21,000 plan when only ₹1,87,000 was planned
ahead. It now compares the weeks still to run against what is left, which
collapses to exactly `validateWeeklySplit` at the top of a month — and a test
asserts they agree there, which is where the engine has an opinion at all.
Mid-month it has none; 13.2's cap simply binds during the round.

**Dayparting reads `bidding.observedByHour`, and that is the whole trick.** It
is cumulative clicks and LANDED conversions per hour of day, written by the
engine and already carried in `getSelfView` — the same history a bid strategy
must accumulate before it can daypart at all (12.2, D2). So the card needed no
new data and leaks nothing: `HOUR_PROFILES` and `HOURLY_INTENT_CURVE` are the
model and `tests/ui.test.js` fails if a `ui/` file names them.

**The card says nothing about which hours are good**, because I5 forces the
demand peak and the intent peak at least three hours apart and the table makes
that visible on its own. Measured on a played account at week 5:

| block | clicks | conversion rate |
|---|---|---|
| Afternoon | 1,390 | **3.63%** |
| Evening | **2,241** | 3.00% |
| Night | 1,460 | 2.21% |

The busiest block is not the best-converting one, and noticing that is the
entirety of H4. Being told it would be a different and much smaller lesson.

**−100% is "bids the minimum", not an off switch.** `daypartMultiplier` returns
zero, and `effectiveBidPaise` then clamps to `MIN_BID_PAISE` rather than to
nothing — so it is a bid of ₹1. It behaves like an off switch only because ₹1
lands under `AD_RANK_FLOOR`. Two tests pin the ends: every block at −100% cuts
impressions by over 99%, and +100% on evening raises what the account spends.

### Three rules the form obeys, and why

**A decision must be previewable before it is committed.** The whole design is
about acting on incomplete information, and a form that hides consequences it
could show is being cruel rather than honest. The commit button says how many
changes it is about to commit; a `Next week` card lists them with an undo on
each; and staging a negative greys out the rows it kills *in the report it was
written from*, rather than leaving the player to discover them next week.

**The view may not compute economics.** `tests/ui.test.js` fails if a `ui/` file
names a constant it should import, and that guard has already fired once and was
right. Every string operation in the form is the engine's own — `blockedBy`,
`normalise`, `tokenise`. A preview that reimplemented the matcher would agree
with it right up until one of them changed, which is exactly how the two `.jsx`
prototypes went wrong. A test asserts the preview agrees with `blockedBy` over
the whole frozen query set, for all three negative types.

**The form may only know what a controller could know.** It reads the query set
through `getPublicView` — text, volume, intent — rather than
`content/querySet.js`, so 16.1's withholding is enforced rather than intended.
Two consequences worth keeping:

- **There is no broad-match reach preview, and there must not be.** Reach needs
  the QUERY's tags, which 16.1 withholds from everybody. 8.2 is explicit that
  you discover what broad match dragged you into *after the fact*, from the
  report. The keyword note states the mechanism — impressions rise, impression
  share falls — with no number nobody could have.
- **Intent stays off the search terms report.** It is public, and the planner
  shows it. But a real search terms report has no such column, and adding one
  would turn reading the report into sorting by a label. The negatives preview
  lists the searches a negative would block and lets the player read them, which
  is the actual skill.

### The search terms report defaults to every week played

Not to the week just run. One week is the wrong basis for a negative and the
interface should not invite it: `byQuery.conversions` keeps being revised for
three more rounds, so a row reading zero today may read two next week. In the
account above, week 3 showed a ₹5,796 loss and was rewritten to a ₹16,454
profit. Blocking an unsettled zero is precisely the mistake the report exists to
expose. There is a `this week only` toggle, and the note under the table says
which of the two you are reading.

`accumulate()` sums `state.history` rather than the reports the screen was
handed, because history is the copy that gets revised (11.4).

---

## Three things the interface found in the engine and caller

Both were reachable by nothing before the form existed, which is exactly why
they survived. Both produced numbers, and one of them had been on screen since
slice one.

### Capital could be committed in any round, for free (`game.js`)

`applyCapex` never checked the round. The engine does not DEBIT capital: it
converts whatever was left uncommitted into ad budget, and only at
`capexAllocationRounds`. So a commitment made in any other round had no
allocation to consume and nothing to forfeit. Measured before the guard:

```
round 1: committed=10000000 liveAtRound=4    legal
round 5: committed=10000000 liveAtRound=8    legal
round 7: committed=10000000 liveAtRound=10   free
```

₹1,00,000 of investment, repeatable every round. It throws now, and a state
with no `budgetSchedule` refuses rather than guessing.

### `stillPending` was the whole queue, not the round's own clicks (`report.js`)

It summed the advertiser's entire pending queue, which made it the only field in
an `AdvertiserRoundReport` not about that round's cohort — `final`, `returned`,
`costPaise` and everything else are — and it broke the revision below it, which
subtracts only that round's late landings. Measured over eight rounds:

| round | final | stillPending |
|---|---|---|
| 1 | 195.0 | 0.00 |
| 3 | 195.0 | 42.91 — plateaus, nothing of its own outstanding |
| 8 | 107.3 | 130.68 — the entire account queue |

Summing across reports gave 421.30 against a true outstanding of 130.68. **The
dashboard had been showing an over-count under Conversions since slice one**,
and nothing noticed until the end screen tried to total it. Corrected to the
round's own cohort it now equals the true outstanding for every round, and the
ending reads 9 of 12 weeks settled — which is what a three-round lag predicts.

**It decays to 7.1e-15, not to zero**, because it decays by SUBTRACTING
fractional landings from a fractional total. Anything asking "has this settled"
needs a tolerance. `ui/ending.js` has one and `report.test.js` uses
`toBeCloseTo`.

### Two fields 15.2 asks for that the report never carried (`report.js`)

`budget.weeklySplitPaise` and `budget.roundsRemainingInMonth` are both listed in
15.2 and neither existed. 13.2 asks the UI for "a burn-down of remaining pot
against **rounds remaining**", and the second number could not be drawn — so the
dashboard showed half a burn-down from slice one until item 6. It now reads
`₹1,99,036 left, 1 week to spend it`.

`roundsRemainingInMonth` counts the rounds AFTER the one being reported, which
is the figure a burn-down wants: what is left, and how long there is to spend it.

**The shape of all three:** a field or a guard that nothing exercised. The
pattern worth carrying forward is that building the first real caller for a path
is when you find out whether the path was right — and that the spec's own field
lists are worth diffing against the code, because two of these were simply never
implemented and nothing noticed for eleven build steps.

## What building the form exposed

Eleven bugs in the interface itself. Before the linter existed `npm test` caught
exactly one of them — a syntax error. Every other one came from opening it, and
the last two from driving it by hand rather than from a script.

The ones worth remembering, because they are kinds rather than incidents:

- **A form that could not be typed into.** Every keystroke in round 0's ad copy
  called `rerender()`, which replaces the form and destroys the input being
  typed into: focus fell to `<body>` and every character after the first was
  swallowed. Typing "Built" by hand produced "B". **This file had recorded the
  cause since slice two** — "the round 0 form rebuilds itself on every
  keystroke, so driving it from a script means re-querying the element after
  every change" — as a scripting hazard rather than as a bug, which is exactly
  why it survived: a script re-queries and never notices. Fixed by separating a
  structural rebuild (a click) from a keystroke, which now refreshes only what
  it derives.
- **A counter that never rendered.** `field()` passed its hint to `el()`, which
  sets `textContent`, so round 0's character counters — spans — displayed the
  literal string `[object HTMLSpanElement]` from the day the screen was
  written. No test reads them and they are small grey text at the end of a long
  form.

- **A screen that leaked what the spec withholds.** Round 0 marked the player's
  own territory in the keyword planner with a dot, computed by `homeCell()` —
  which reads `priceAffinity` and `purposeAffinity`, the two fields 16.1
  withholds "from every viewer, including the advertiser the affinity favours".
  It also did the round 0 decision FOR the player: which of these searches are
  mine is the question 4.1 says positioning answers. Removed, and
  `tests/ui.test.js` now fails if any `ui/` file names those fields or the
  functions that derive them — a guard built from the engine's own
  `FORBIDDEN_IN_PUBLIC_VIEW` rather than a copy of it.
- **A screen that taught something false.** The round-5 card claimed
  repositioning resets your Quality Scores. It does not: 4.5 calls the loss "a
  consequence, not a rule to implement" — keeping a keyword keeps its history,
  and only the ones you REPLACE start from nothing. Moving with the old keywords
  in place kept every score (`4 7 4 4 7` before and after). **This is the worst
  class of interface bug in this project**, because the screen was explaining
  the exact mechanic it was getting wrong.
- **A warning that cried wolf.** The split card summed all four weeks against
  the month mid-month, warning about a ₹3,21,000 plan when only ₹1,87,000 was
  planned ahead. A warning that fires when nothing is wrong trains the player to
  ignore it.
- **An engine string on screen.** The same card printed
  `validateWeeklySplit`'s own message, which quotes raw paise because it is
  written for a thrown error: the player was shown "totals 35100000 paise". R7
  puts formatting at the display layer. **The verdict may be the engine's; the
  sentence has to be this layer's.**
- **A promise the screen did not keep.** The end screen offers "every decision,
  week by week" and knew nothing about the weekly split or the hour adjustments
  — a week where four blocks and a week budget changed logged one line about
  capital.
- **`willTriggerLearning` compared the draft's position against itself**, so a
  repositioning would have reported no learning period on the one change that
  most certainly causes one. Shipped in item 3, unreachable until item 4.
- **`spentByWeek` was computed and never attached to `ctx`** — a defined
  function nothing calls and an undefined lookup rendering as an em dash.
- Three more that were friction rather than falsehood: the planner composer
  losing its match type, bid and filter on every add; the over-block warning
  firing only on conversions already earned; and the split outlook not redrawing
  as you typed into it.

And one thing that was not a bug: at exactly 1100px wide the dashboard grid is
two columns, not four, because `@media (max-width: 1100px)` is inclusive. A
`span-2` card measuring full width there is correct. Check `matchMedia` before
believing a layout report.

## What the audit pass changed, and why it still matters

Two sessions back, and kept because the defects are the instructive kind.
An audit pass found nineteen things. Four were already covered by the ledger and
were withdrawn or narrowed — that is the system working. The rest produced eight
commits, and three of them were engine defects producing wrong numbers:

- **Reports were double-counting their own lag-0 conversions.** `runRound`
  appended the fresh report to history and then revised the whole array,
  including that report, so 55% of every advertiser's conversions landed twice.
  Round 1 stored 131.33 where `runRound` returned 65.66. Eight revision tests
  missed it because they all compared `R1.report` against `history`, and the
  defect lived exactly in the gap between those two objects.
- **`observedConvRate` was never written.** It stayed null for twelve rounds
  while `observedConversions` climbed into the hundreds, so smart bidding grew
  steadily more confident about `COLD_START_CONV_RATE`. The spec-19 test for it
  was never written, and every strategies test supplied the value by hand.
- **`observedByHour` was hard-coded null**, so `MIN_HOUR_OBSERVATIONS` was
  unreachable and a bid strategy had no route to dayparting at all.

And one design defect worth understanding before touching anything:

- **The purpose axis was applied twice.** `PURPOSE_MODIFIERS` *and* the query
  set, which gives lifestyle territory bigger baskets and fewer returns. Both
  are true; both push the same way. The realised purpose gap was 12/17/20%
  against I4's 15% bound, invisible because **I4 read `constants.js` and
  nothing else** — it measured a quantity no auction experiences. Fixed by
  shrinking the `INVENTED` modifier rather than flattening the argued content.

---

## The thing that governs everything downstream

**`breakEvenCpcPaise` is not the number an advertiser can pay.** It is the
ceiling on a neutral query — every multiplier 1, every hour average — and nobody
buys that query. Territory is by construction where both of a position's
affinities peak, so the affinity product runs near 2.0, and the intent curve
compounds it (its mean is 1 over uniform hours and **1.146 over traffic**).

Use **`realisedBreakEvenCpcPaise`** for anything operational. The old figure had
the fixtures bidding 29% of what they could afford, which is why the market read
as placid and everyone priced against the reserve. Corrected, median CPC went
979 → 2008 and `lostToBudget` started firing for the first time.

---

## Is twelve rounds long enough to learn from?

Measured rather than argued, because W11 was closed by design argument alone.
Short answer: **long enough for anything that settles inside a round, not long
enough for the three lessons the design cares most about.**

- **A round's reported profit overshoots.** 64% of truth at the click, **117%
  one round later**, then four rounds of decay. Conversions land faster than
  returns resolve, so every round looks best exactly one round after you stopped
  being able to change it.
- **Five of the eleven decisions in a game are made with no settled round to
  look at.** First fully-settled feedback arrives at round 7.
- **The quality diagnostic never moves.** Lifting `expectedCtr` 6 → 9 — a 50%
  improvement — moves the own/field ratio from 1.137 to 1.488 over eight rounds
  and the displayed score not at all, because the ratio was already past
  `RATING_UPPER_THRESHOLD` and three levels cannot express anything between.
  A6 records this as landing-page compression; it is every component. **On
  landing page it is now measured**: grades 5 to 8 are indistinguishable, so a
  player improving from 5 to 8 gets no feedback at all.
- **The noise floor is flat.** `QUALITY_NOISE_SIGMA` is a volume-independent 8%
  that swamps the Poisson term, so every advertiser sits at 9-10% CV regardless
  of size. **F7's Premium claim does not hold on reported outcomes** — 10.5%
  against 8.8%, not the 3x it describes. It *does* hold on the bid strategy's
  internal estimate: sigma 0.141 against 0.050 at round 12.

None of that needs a longer game. The cheapest fixes are display-side and
constant-side, and they have not been discussed yet.

---

## What playing it found

Six sessions of building found bugs by writing tests. **Playing it found a
different class entirely**, and every one of these was invisible to 1000+ tests
because it was about what the screen SAYS rather than what the engine does.

- **Two rivals ran word for word the same ad.** `adCopy.js` authored one ad per
  CELL and 17.1 puts eight rivals in six cells, so every doubled cell produced
  identical copy — on seed 20260902, two pairs of them. 17.1 makes the eight ads
  the ONLY evidence of where anyone sits, so that is not a cosmetic repeat: it is
  two rivals the player cannot tell apart. Each cell now holds two ads and every
  copy rule runs against both.
- **Round 0 listed eight brands with no hint that the ninth was you.** Correct
  behaviour, unexplained, so it reads as a missing rival.
- **The Quality Score was one number that barely moved.** Measured: lifting
  `expectedCtr` 6 → 9 moves the ratio 1.145 → 1.676 and the displayed score not
  at all. Worse, a player who commits the whole ₹1,00,000 to their landing page
  still read `landingPage: average`. The screen now shows all three component
  ratings AND the grade the player earned — see `DECISIONS.md` I1.
- **Brand bidding ran every round with no surface at all.** §3.1 names it one of
  four reasons this vertical was chosen. `brandDefender` poaches every brand
  query in the market from round 1 and holds 100% of eight of them by round 2,
  and nothing told the player they owned a name. See `DECISIONS.md` I2.
- **`Weekly` ran into `Intent`.** `td.num` sets `padding-right: 0` so figures
  align on their last digit, and the next cell had no left padding.
- **The round 0 planner threw away your search term** every time you added a
  keyword, because adding rebuilds the form.
- **Keywords could be paused but never removed** anywhere except round 0.
- **The ad copy card was a guess.** It took five boxes, said nothing about what
  they were worth, and the grade appeared two screens later with no way to tell
  which words moved it. `explainGrade` now scores and EXPLAINS from one pass, so
  the advice on screen cannot drift from the number beside it, and round 0 shows
  the grade live. Writing to the advice took a deliberately weak ad from 3/6/3
  to 8/10/8.

**The pattern.** Every one is a sentence the interface does or does not say. The
suite reads source, the linter reads syntax, and neither reads meaning — so this
class is found by using the thing and in no other way.

---

## What measuring it found, and it is the sharpest lesson here

A session spent measuring rather than building produced four findings, and three
of them were **defects in the measurements themselves**. That is the pattern
worth carrying: in this project a wrong number is far more likely than a wrong
feature, and it never announces itself.

> **Every rupee and percentage in this section predates F14** (2026-09-11), which
> raised returns across the market from 22% to 34% and moved the reserve and the
> weekly volume with them. The LESSONS are unaffected — they are about how
> measurements go wrong. The figures are a record of the old market and should
> not be quoted as current. None of them has been re-run, and several cannot be:
> see *Record the harness* under *Writing a measurement harness*.

### `advertiser.policyId` was dead, so every rival stood still

`buildRival` set it to `null` with the comment "the caller assigns a policy",
and the only caller that did was `ui/app.js` — which assigned by index from a
private array and never wrote the id back. So in **every game that had ever
run**, `policyId` was null and `controllerFor`, which exists precisely to turn
that id into a controller, had no reader outside the tests.

The cost was not theoretical. Every measurement taken that day wired rivals as

```js
controllers[a.id] = a.policyId ? controllerFor(a.policyId) : () => null;
```

which is the obvious way to write it and silently gives all eight rivals a
**no-op controller**. They kept their round 0 keywords, bids and ads and never
adjusted a bid, wrote a negative or responded to anything. A dead field still
produces entirely plausible numbers, which is why nothing looked wrong.

Fixed by dealing the policy at construction from `RIVAL_CAST` in
`agents/policies.js`, so the field is live by default rather than by the caller
remembering. **Any harness you write should assert the rivals are live before it
measures anything** — `tests/writerBalance.test.js` does.

What it cost in numbers: one point of ad copy quality was measured at
₹2,20,254 against a dead field and ₹1,33,986 against a live one. CPC improvement
went from −28% to −8%. Marginal value only starts falling at grade 9 once
rivals bid back.

### A claim measured on the canonical seed was a sample of one

Spec 9.4 said an "above average" landing page rating was "not reachable at all",
which overturned `DECISIONS` A6's correct "reachable but narrow". Measured over
720 games it is reached in **33 of 72 (seed, cell) pairs**.

The retracted figure came from seed `20260902` — this project's canonical seed,
and the WORST row in the grid: one of its six cells reaches `above`. In five of
six the false claim is locally true. **A number measured on the canonical seed
is a sample of one**, and this one propagated into the spec, a DECISIONS entry
and a `constants.js` comment before anyone re-measured.

### A replica that disagrees with the recorded baseline is measuring something else

Checking whether the creative rollover broke invariant I3, a scratch replica of
the I3 harness reported **15.0% and a FAIL** — which would have sent a session
rebalancing something that was never broken. It summed GROSS profit over all
twelve rounds; the real invariant uses NET profit over settled rounds only,
because a click in round R is not final until R+5.

What gave it away was that it could not reproduce the documented 2.8% baseline.
The real figure at the raised budget is **5.3%** against a 15% bound.

**And `calibration.test.js` could not have caught it either**, which is the
second half of the lesson: it builds its own fixture with `monthlyBudgetPaise`
hardcoded and no `creative` block, so a ~30% change to the budget scale
`WEEKLY_VOLUME` is pinned against could not reach the invariant that exists to
catch it. The suite passing proved nothing. The harness is parameterised by
budget now and the raised case is a permanent test.

### A rival that never traded, found by a screen rather than a test

The end screen's standings table, on its first game, showed one rival on ₹0
spend and ₹0 profit across twelve rounds. **The market had eight real
competitors, not nine**, and nothing had noticed.

The cause was self-inflicted and an hour old: the writer mechanic dealt the two
`cautious` rivals a self-written ad, which opens on the ungraded 3/3/3 default.
DECISIONS A8 measured that state precisely — *"sits below `AD_RANK_FLOOR` at any
cautious bid, so the player would enter every auction and show in none"* — and A8
is the reason the PLAYER's ad is graded before round 1. The fix recreated the
condition the fix existed to prevent. Marlow needed 1551 paise to appear and bid
1078.

**Nothing in 1147 tests asserted that a rival TRADES.** There are tests that
rivals exist, carry a policy, sit in legal cells, hold distinct ad copy and get
grades inside the scale — and none that any of it produces an impression.
`setup.test.js` now checks every rival's opening bid against the reserve on its
own best keyword, across all twelve seeds.

### The shape of all four

A test or a measurement that does not exercise the thing it names. `policyId`
had a function built to read it and no reader; I3 had an invariant that could
not see the budget; the landing-page claim had one seed standing in for
seventy-two; and eight rivals had nothing checking they were alive. **When a
measurement agrees with what you expected, check what it actually ran** — all
four produced numbers that looked entirely reasonable.

The fourth one is the warning about the other three. It was found by a SCREEN,
not a test — by putting nine rows in one table where a human could see that one
of them was zeros. Every guard in this project was written after something got
past it.

## What a second player session found

Every one of these came from somebody using it and saying what happened, and
none was findable any other way.

- **"Setting a target ROAS gives me a blank week."** It did, and the model was
  right: Target ROAS bids DOWN (`order value × conversion rate ÷ target`), so at
  25 the bid fell under `AD_RANK_FLOOR` — a RESERVE, not an eligibility gate —
  and the account entered every auction and showed in none. The screen said
  "lost to rank 100%", which reads as being OUTBID and sends a player to raise
  keyword bids, the one lever that cannot help. `bidOutlook` now says what the
  strategy will bid and whether it clears, live, before the week is spent
  (DECISIONS I12).
- **"Week 2 told me nothing."** Four phrase keywords produced four search-term
  rows, each identical to the keyword that bought it. The explanation existed
  and was good and lived on the NEGATIVES card — a feature the player was not
  using. `termsOutlook` moved that live read under the table where the question
  is actually asked, and it turns on REACH rather than match type, because a
  long phrase keyword reaches nothing while a short one reaches dozens.
- **"I don't get the rationale behind the graph."** The chart explained what
  each metric IS and warned what impression share is NOT, and never said what to
  DO with it. `marketOutlook` reads the account back — rank-bound, budget-bound,
  both, or saturated — entirely from `insightsFor(...).self` and the six legal
  rival metrics (I13).
- **"The month-2 capital screen explains it worse than round 0."** True, and a
  drift introduced the same day: round 0 became a page builder while the
  allocation window kept the older framing. Both read `featureAt` now. Finding
  it turned up something round 0 never has to say: investment is CUMULATIVE, so
  ₹25,000 on top of ₹25,000 reaches ₹50,000 against a ₹55,000 rung and buys
  NOTHING. That chip now says `no change` and is marked (I15).

**The pattern.** Three of the four were a screen that was correct and unhelpful
— the number was right and the sentence explaining it was missing, in the wrong
card, or pointed at the wrong lever. None of them is a defect any test could
hold, and all four were reported in the form "this told me nothing".

**And one thing to say plainly to whoever picks this up:** the recorder in
`ui/` is a scratch injection, not a feature. A session that wants to watch a
game must install it in the browser pane and the player must play THERE — twice
this session a game was played in a separate browser window and nothing was
captured, which is not recoverable afterwards.

## What playing it as a learner found

**The largest untested claim in this project is now tested once.** A full twelve
rounds, played by hand in the browser pane by somebody who had not driven it
before, with a passive DOM recorder installed so the session could be read back
rather than remembered. 881 events over 28 minutes, round 0 to the end screen.

**They won.** First of nine, `premium|lifestyle`: ₹5,70,502 spent for 68,576
clicks, 958.5 conversions, **₹17,22,620 net** on ₹22,97,660 gross, net ROAS
**6.48**, CPA ₹595. Second place took ₹16.62L, so a 38% lead. And **Vella & Co.
sat in the same cell and finished 6th on ₹5.99L** — worth holding on to, because
F13 says lifestyle cells are structurally cheap and this is the counterweight: the
seat did not win this game, the opening did.

### The finding: engagement ended at week 4 and winning did not require more

| phase | time | clicks | keystrokes |
|---|---|---|---|
| round 0 | **1,076s** | 42 | 630 |
| week 1 | 168s | 28 | 2 |
| week 2 | 102s | 14 | 4 |
| week 3 | 50s | 5 | 3 |
| week 4 | 148s | 26 | 20 |
| **weeks 5-11** | **72s total** | **8** | **0** |

Seven weeks in 72 seconds, one click each, nothing typed. The game's own decision
log agrees: *"4 of the 12 weeks carried a decision. The rest ran on what you had
already set."* **Round 0 took 67% of the entire session** — eighteen minutes and
630 keystrokes before a single auction ran.

Asked what happened, the player said: *"the screens stopped asking me anything
after week 4. Once I had put in the major inputs at about round 4 I felt like
there weren't that many things to look out for."*

### The screens did NOT go quiet. They spoke, and correctly said nothing was wrong

This was measured rather than assumed, and the first attempt to measure it was
wrong — see the correction at the end. Replaying a close replica and reading every
prompting surface for weeks 4 to 10, **seven consecutive weeks are identical**:

| card | every week |
|---|---|
| the market | `constraint: "saturated"`, impression share **99.999%**, lost to rank **0**, lost to budget **0.001%** |
| negatives | `worthIt: false`, wasteful rows 0, wasted spend ₹0 |
| search terms | `mirrored: true`, 20 searches / 20 keywords, 1.0 per keyword |
| bidding | bid ₹30 against ₹4.60 needed, `willShow: true`, unchanged |
| where you advertise | **byte-identical sentence, seven weeks running** |
| your copy | `null`, correctly — a hired ad was live from week 1 |
| this month | the only thing that moved |

So this is neither an interface defect nor exactly a round-loop one. **The account
reached a state by week 4 where every diagnostic correctly reported nothing wrong,
and nothing in the remaining eight weeks disturbs it.** The player's read was not a
failure to notice; every card agreed with them.

### And the calendar says the same thing structurally

| round | what arrives |
|---|---|
| 0 | position, keywords, ad, writer, capital, budget |
| 1 | first capital allocation |
| 3 | a DIY ad goes live |
| **5** | **capital top-up + the one repositioning window** |
| 8 | rank snapshot — invisible, and unactionable |
| 9 | month 3's redistributed budget |

**The last new decision the game offers arrives at round 5, and seven rounds
follow it.** Everything still available after that was already available in week 2.

Put that beside this file's own W11 measurement — *"first fully-settled feedback
arrives at round 7"* — and the shape is stark: **decisions are front-loaded and
finish at round 5; settled feedback is back-loaded and starts at round 7. They
never meet.** That is the best explanation this project has for both the passive
account that finished third and this one that stopped at week 4 and finished
first.

### Four smaller things the session found

- **The search terms report was inert for twelve weeks.** `mirrored: true` every
  round: twenty phrase keywords producing twenty rows, each identical to the
  keyword that bought it. This file already knows all-phrase accounts do this;
  what is new is that it persisted for a whole game, so the surface 15.2 calls the
  only route to negatives never switched on. I8 measured **one broad keyword
  taking the report to seventy rows** — the player never had a reason to add one.
- **Six of eight negatives blocked a search the player had already removed as a
  keyword the week before** (`gym near me`, `free workout plan`, `how to lose
  belly fat`, `gym tights for women`, `cheap gym leggings`, `marlow co ord set`).
  The two controls are genuinely different mechanisms, so this is not wasted
  motion in principle — but **neither card says the other has already handled it**,
  so the job was done twice and could not have been known to be redundant.
- **The location card was on screen from week 1 and never clicked.** Zero location
  decisions in twelve rounds. See DECISIONS I24.
- **Two things worked exactly as designed.** The player's dayparting peaked on
  **afternoon at +100%** — the best-converting block, not the busiest — which is
  H4 landing without being told, and the whole reason I5 forces the two peaks
  apart. And Target ROAS was set to **10** and traded fine, where the previous
  player session set 25, got a blank week, and read "lost to rank 100%" as being
  outbid. That is `bidOutlook` doing its job.

### The correction, because the shape will recur

**The first harness written to answer "did the screens go quiet" produced a clean
table showing exactly that, and it was wrong.** It read `.note` off all seven
outlook functions and printed `(silent)` where there was none. Only
`locationOutlook` composes a note; the other six return DATA and the sentence is
assembled inside the render function.

It would have confirmed the player's own words with a fabricated measurement, and
it looked right *because* it agreed with them. This file's rule — *when a
measurement agrees with what you expected, check what it actually ran* — caught it.

**And the reason it was possible is worth recording as a defect in its own right.**
This file claims the pure part of every screen sits outside the render so only the
drawing needs a browser. For six of seven prompting cards the **wording lives
inside the drawing**, so it is neither unit-tested nor readable without a browser
— and the wording is exactly where this project's whole "correct and unhelpful"
defect class lives.


## What capital is actually worth, and why it does not feel like it

**Asked by a player mid-game: "the capital investment seems to be a waste."** It is
not, and the gap between the money working and the money LOOKING like it works is
the finding.

**THE COMPARISON THAT MATTERS IS NOT AGAINST ZERO.** Uncommitted capital rolls into
the advertising budget (13.3), so every rupee on the page is a rupee not spent on
clicks. Measured over 3 seeds, `premium|lifestyle`, retainer, twelve rounds,
passive after round 0:

| ₹1,00,000 at round 0 | net profit | vs not investing |
|---|---|---|
| nothing (it all rolls into ad budget) | ₹14.61L | — |
| size guide | ₹15.19L | +4.0% |
| split three ways | ₹15.25L | +4.4% |
| page ₹55,000 + size chart ₹25,000 | ₹15.47L | +5.9% |
| page ₹1,00,000 | ₹15.73L | +7.6% |
| **photography ₹1,00,000** | **₹17.87L** | **+22.3%** |

Every allocation beats spending nothing, and the three targets do it by different
routes: photography leaves clicks and spend flat and moves **conversions 686 to
811**; the page buys cheaper clicks through quality (20,328 to 21,789 clicks at
much the same spend); the size guide moves neither and earns its 4% on returns
alone.

**THE SECOND ALLOCATION IS WORTH HAVING AND NOT ON THE SAME TARGET.** Round 0 at
₹55,000 page plus ₹25,000 chart in every row, varying only round 5:

| at round 5 | net profit | vs doing nothing |
|---|---|---|
| nothing | ₹18.33L | — |
| size chart to ₹1,00,000 (+₹75,000) | ₹18.98L | +3.5% |
| page to ₹1,00,000 (+₹45,000) | ₹19.32L | +5.4% |
| photography ₹55,000 + page to ₹1,00,000 | ₹20.31L | +10.8% |
| **photography ₹1,00,000** (a fresh target) | **₹20.92L** | **+14.1%** |

**Topping up something you have already funded earns a third of what funding a
fresh target does**, and the reason is `CAPEX_TIER_CURVE`:

| spend on one target | effect | landing page bonus |
|---|---|---|
| ₹0 | 1.00 | 0 |
| ₹25,000 | 1.04 | 0 |
| ₹55,000 | 1.16 | 2 |
| ₹70,000 | 1.22 | **3** |
| ₹1,00,000 | 1.25 | 3 |

The steep part of every target is **₹25,000 to ₹70,000**. Past ₹70,000 the landing
page bonus is capped, so the last ₹30,000 on that target buys *nothing* on the
score — which is D7's S-curve working exactly as designed: splitting is available
and sometimes right, spreading thin underperforms committing, and maxing one
target is neither.

**SO WHY IT FEELS LIKE A WASTE, which is the part worth acting on.** Three things
stack up, and only the first is fixed:

- **The landing page used to freeze at 4.** An unfinished ad capped all three
  components, so a player who hired a writer, left the copy boxes alone and spent
  ₹80,000 saw nothing move. Fixed (I19, reversed).
- **`landingPageBonus` is 0 until round 4**, because round 0's capital carries a
  three-round delay. The copy lands before the capital does.
- **A6's compression means grades 5 to 8 all report as `average`**, so even a real
  5 → 8 improvement leaves the Quality Score diagnostic unmoved.

**AND THE BEST-PAYING TARGET IS COMPLETELY INVISIBLE.** Photography is +22.3% and
has no on-screen indicator of any kind — it moves a business number the player can
only infer from the report weeks later. The size guide is the same. The landing
page is the only one of the three with a visible score, which is why it is the one
a player judges the whole mechanic by. That is the I16 shape again: the number was
right and no screen mentioned it.

**Caveat, and it is a real one:** three seeds, one cell. D7 argues Value should
invest and Premium often should not, so the ranking may well flip elsewhere.
"Photography first" is not safe to write into the briefing on this evidence.

## What changed in round 0, and what it cost

Three commits, all measured before they were built.

**The geography got its own card** (`a8b7554`). "The market" was 817px against
"Your brand"'s 386, so 432px of column sat empty. Splitting it is what was asked
for, and **every naive version made the page taller** — a half-width card costs
+118px, full width with the note stretched underneath +36px. What works is full
width with the note BESIDE the table: **4,274px, 25px shorter than before the
split**, and dead column under Your brand down to 148px. The arrangement
originally asked for — the market stacked under the brand with geography beside
them — cannot remove the dead space at all: it needs a 936px card on the right and
the geography card is the shortest on the page.

**The cap stopped freezing the landing page** (`286b0ab`). See DECISIONS I19,
which is reversed rather than amended, because the argument that kept the cap
depended on a state the Go button now makes unreachable.

**A worked example ad** (`71e41c6`), asked for so the ad rules are learnable. It
costs **no height at all** — 4,274px before and after — because it shares a grid
cell with the budget card through `.setup-stack` rather than starting a row of its
own. It had to land beside **Capital**: against "Who writes it" it overflowed by
169px, and Capital at 670px is the only card tall enough. That is why the writer
card now sits before the keyword planner — a layout constraint, not a reading
preference.

**Why an example is safe here when I3's territory dot was not:** `adRelevance` is
scored against the player's OWN keywords, so a copied ad scores *worse* than the
same effort in their own words. The dot made the decision; this cannot.


## The location mechanic

**Built, measured and on screen — all nine steps.** It was the first engine change
since the build order was completed; everything else added this session was
display-layer. `DECISIONS.md` G4 carries the design and every argument behind it.
This section carries what a next session needs and would otherwise have to
reconstruct.

Searches happen somewhere. India divides into metros, large cities, and smaller
cities and towns. Volume distributes by price × location, returns rise outside the
metros, baskets shrink a little, and **conversion rate is deliberately untouched**
— it already carries query affinity, `PURPOSE_MODIFIERS` and the hourly curve, and
F10 and F11 are both records of what two mechanisms pushing one number costs. The
player gets a weekly bid adjustment per tier, shaped exactly like dayparting.

**The country is 20 / 36 / 44**, metros smallest, with the price correlation inside
every row (premium 38/36/26, mid 22/38/40, value 12/35/53).

### The four things most worth not relearning

**The tables are RATIOS, normalised before use, and twice.** Applied raw their
volume-weighted mean is 1.243, so every advertiser's return rate would have risen a
quarter and value's documented 30% would have become 37%. Then calibration found a
second normalisation was needed: against the MARKET average the geography quietly
moved profit between positions — value 13.5% below the mean, premium 8.6% above,
against I3's 15% bound from a 2.8% baseline — because value's territory is 53% in
the towns where returns are worst and its margin is thinnest. Each position is now
centred on its own country. **I3 sits at 9.5%**, so the mechanic has spent about
half of that invariant's headroom.

**One ladder while the market is flat, three when anyone tilts.** Three locations
are three separate auctions and resolving three costs 531ms against a 400ms budget.
When nobody adjusts by location the ladders are identical, so one resolution
apportioned is exact — and `round.test.js` runs the same round both ways and holds
them to the same numbers, because the danger of two paths is that they quietly stop
agreeing.

**A rival learns where to bid; it is not told.** `policies.js` imports nothing from
`engine/`, which is what makes its guard absolute, so a policy cannot read the
volume table. `locationTilt` reads the rival's own `byLocation` report — net of
returns, which arrive late, so a rival leans metro-ward first and corrects later, on
the same terms the player does. `grossOptimiser` reads GROSS deliberately: section
14's missing multiplication, applied to geography.

**The leans are 200/320/100 and provisional.** At 40/70/20 rivals adjusted by 1-17%
and nothing they did was visible in the market. They are policy numbers rather than
engine physics (C7), so tuning them is cheap.

### What the measurements actually say, including the part that failed

**Targeting is a right answer, not a trade-off.** Concentrating on the metros is
worth **+58.6% to a value advertiser and +38.7% to a mid one**, and **−9% to
premium**. Premium is demand-limited — it spends 37% of its month — so every extra
search is worth having; value is budget-limited at 100%, so allocation decides
everything. Which regime an account is in is readable from its own report, and that
asymmetry is the genuine lesson in here.

**Two attempts to shrink that payoff both failed, and the failure is the finding.**
Narrowing the return spread 1.5 → 1.35 moved value's gain from +58.6% to +57.2%.
Narrowing the basket spread 1.196× → 1.07× moved it to +57.4%. Both were reverted.

The cause is structural, not a constant. For a value advertiser the metros are
**both the most valuable and the cheapest**: ₹26 profit per click at ₹13.40, against
₹16 at ₹16.30 in the towns. Every tier is profitable — this is not "stop losing
money" — but value's rivals crowd the towns where value's queries mostly are,
leaving its thin metro territory uncontested. Geography lands on top of the existing
affinity separation and produces *go where your competitors are not*. **No
`CALIBRATE` value fixes that.** It would need something structural, such as making
the metros contested across price tiers.

Also worth knowing: **the basket is a bigger lever than returns** (1.196× against
1.125×), and `constants.js` still describes it as "small on purpose... a texture on
top of the returns difference rather than a second lever". That comment is wrong and
has not been rewritten.

**Crowding is real but needs everyone to move.** Market CPC now runs ₹14-17 in the
metros against ₹12-13 in the towns (1.13-1.43×) where the earlier level country was
flat at 0.95-1.11×. Forcing all nine into the metros raises the price there 35%. But
D8 already established this market is demand-limited, so budget scarcity has no
price to bid up on its own — which is why the capacity argument the design was
originally built on did not hold.

### Two anomalies in the last played game, both now resolved

A full twelve-round game on seed 20260902, player at mid|performance doing nothing
after round 0. **`automator` (Satva) won by 62%** — ₹27.4L against ₹16.9L — and a
completely passive account finished high. Measured over 30 markets, neither is
about the thing it looked like being about.

**The replica reproduced first, and that is the only reason the rest is worth
reading.** Seed 20260902, agency writer, ₹55,000 landing page plus ₹25,000 size
guide (the only pair of round 0 chips summing to ₹80,000), six own-territory
keywords, `() => null` for the player: **₹27.51L against ₹16.84L, a 63.4% lead.**

**IT PREDATES THE LOCATION WORK, and the location work made it SMALLER.**

| | `automator`'s lead over second |
|---|---|
| as shipped, rivals targeting by location | 63.4% |
| tilts stripped, geography still in the engine | 67.7% |
| `5374fd8`, before a line of location code existed | **69.7%** |

Two things fall out of that. The mechanic is exonerated — it narrowed the gap by
six points rather than causing it. And the middle row against the bottom row
(₹28.18L against ₹28.40L, identical ordering) is an **independent confirmation
that `40a550c` did what it was built to do**: with nobody targeting, the geography
is very nearly neutral, which is exactly what centring each position on its own
country was for.

**IT IS THE SEAT, NOT THE DRIVER.** `automator` is also the only `mid|lifestyle`
advertiser on that seed, so policy and cell were entangled in the standings.
Swapping ONLY the controller — same cell, same agency ad, same keywords, same
budget, so the sole difference is behaviour:

| driver of Satva's seat | gross | rank |
|---|---|---|
| `cautious` | **₹45.37L** | 1 |
| `disciplined` | **₹43.03L** | 1 |
| `automator` | ₹27.51L | 1 |
| `brandDefender` | ₹26.56L | 1 |
| `grossOptimiser` | ₹22.18L | 1 |
| `spender` | ₹3.79L | 6 |

**`automator` is the third-worst driver of that seat and wins anyway.** `cautious`
— which finishes 6th and 8th everywhere else in that market — takes ₹45L from the
same account. So the cautionary character IS being punished, by roughly ₹18L
against sitting still; the seat is simply strong enough to win regardless. The
reciprocal holds: `automator` installed in Kestrel's seat finishes 1st on ₹29.6L
and in Auren's seat 9th on ₹0.88L. Same driver, first or last, decided by the cell.

**Over 30 markets it does not win at all.** Mean rank **3.17 of 9**; top rival 6
times against `brandDefender`'s 8, `disciplined`'s 7 and `cautious`'s 7; mean gross
₹15.62L inside the noise of the other three (₹15.98 / ₹15.20 / ₹15.15L). Its rank
tracks its cell's purpose — **2.50 in a lifestyle cell, 3.61 in a performance one**.

**And the passive account is the same finding seen from the player's chair.** The
specific "third" did not reproduce — the replica finishes 5th — and the rival
standings match to 0.4%, so the difference is entirely the player's own opening and
that rank is sensitive to it in a way `automator`'s was not. What IS structural:
**every market contains two `spender`s and two `cautious`**, because `RIVAL_CAST`
has six entries and there are eight rivals, so indices 7 and 8 wrap. Measured over
30 markets, `spender` means **₹2.80L** and `cautious` **₹11.42L** against ₹15.15 to
₹15.98L for the other four. Half the field is drawn from the two weakest
characters and a quarter of it from one that is 5.7x worse than the best, so a
passive account in a decent cell places mid-table without doing anything. That is
worth knowing before anyone reads a passive third place as the market being soft.

**What this cost to find, and it is the lesson rather than the numbers:** the
question as written was *why does this policy win*, and the answer is that it
does not. Policy and cell were confounded in a nine-row table, and the only way to
separate them was to hold the account fixed and vary one thing. **Both anomalies
were one seed.** This file says twice that a number measured on the canonical seed
is a sample of one, and both of these were.

### Why `spender` finishes 5.7x behind, and which half of it is the character

Noticed while closing the two anomalies above: over 30 markets `spender` means
**₹2.80L** against ₹15.98L for the best policy, and it appears **twice in every
market**, so a quarter of the field is an advertiser that barely trades.

It does four things at once — bids 1.10x affordable, puts every taggable keyword
on broad, writes no negatives, and leans hardest of anyone on location — so the
standings cannot say which one costs the money. Ablated one at a time over 12
markets, 24 accounts per variant:

| variant | gross | vs control | cpc | gross/click | convRate |
|---|---|---|---|---|---|
| untouched | ₹3.30L | — | 24.94 | 15.70 | 2.95% |
| bid 0.70x, as `disciplined` | ₹7.64L | **+131%** | 18.41 | 25.58 | 3.18% |
| no broad match | ₹8.15L | **+147%** | 23.44 | 33.83 | 4.00% |
| manual, not maxClicks | ₹7.87L | **+138%** | 18.19 | 26.04 | 3.20% |
| no location lean | ₹3.25L | **−2%** | 24.76 | 14.46 | 2.94% |
| bid 0.70x AND no broad | ₹11.75L | +256% | 19.31 | 39.88 | 4.15% |
| seats driven by `disciplined` | ₹29.80L | +802% | 9.69 | 51.68 | 4.32% |

**TWO LEVERS, NOT FOUR, AND THEY ACT THROUGH DIFFERENT CHANNELS.** The price it
pays, and the clicks it buys. Broad-with-no-negatives halves what a click is
worth (conversion rate 2.95% against 4.00%); the bid raises what it pays for one.
Together +256% against the +471% they would give if independent — sub-additive,
because both change which auctions it wins and at what price.

**The location lean is innocent**, at −2% inside noise, despite being the hardest
in the cast at 320 against a default 200. Worth knowing before somebody starts
there.

**`SPENDER_AGGRESSION` IS 1.10 AND THE ACCOUNT BIDS 1.76x.** `spender` runs
Maximise Clicks and `rawBid` multiplies the keyword bid by
`MAX_CLICKS_AGGRESSION` (1.6) again. That is why "bid 0.70x" and "manual not
maxClicks" return nearly the same number — **they are the same lever reached
through two files**. Against `disciplined`'s 0.70x that is a 2.5x ratio, and the
realised price agrees: cpc 24.94 against 9.69, a ratio of 2.57.

The comment beside the constant claimed 1.10 and said *"pacing is its only
brake"*. Both halves were wrong: the brake is the strategy. Corrected in place,
with `DECISIONS.md` C7 carrying why the split between policy numbers and physics
numbers is what hid it. **The VALUE was deliberately not touched** — see *Still
open*.

**What this does NOT show.** Even with bid and broad both fixed, `spender` reaches
₹11.75L against `disciplined`'s ₹29.80L on the same seats. The residual is
presumably the negatives it never writes, but the `disciplined` run changes
everything at once — bid logic, match types, blocking — so that 2.5x is not
attributable to any one thing and is not claimed here.

**The harness checked itself**, and that is why the rest is readable: every
ablation post-processes the REAL policy's output rather than reimplementing it,
and the no-op variant is asserted to reproduce `spender` to the paise. A replica
of `spender` would have drifted from `spender`, which is the failure this file
records twice already.

## Round 0 has a design, and part of it is built

**The canvas:** https://claude.ai/code/artifact/5e9555b3-28fa-4d12-8479-5f10812a086a

Six interactive artboards covering all ten round 0 cards, built on the
simulator's own content — the nine brands, the tier economics, the break-even
sums, the geography splits, the eight rival ads from `content/adCopy.js`, the
writer tiers, the capital rungs and the planner's head terms. It is a design
surface, not code: nothing in it drops into `ui/`, which is the point given the
two `.jsx` prototypes were deleted for drifting away from the engine.

**The brief was "it looks too mundane", and the diagnosis is in `style.css`'s own
opening line** — *"dense on purpose. This is a dashboard for reading numbers
against each other"*. True of the dashboard. Round 0 is a briefing and seven
decisions read once, and it had inherited the telemetry-panel look without
needing it: ten near-identical grey rectangles.

### What is built (`61304b9`)

- **The map.** `ui/india-map.js` plus a rebuilt `sectionWhereSearch`.
- **The capital curve**, which is the fix for a measured finding rather than a
  visual one — see *What capital is actually worth*.
- **The skin, scoped to `.setup`**. Not one selector wider, deliberately.

**And it moves** (`4a21bc7`). The first cut shipped the design's geometry and none
of its motion, which a player noticed immediately: *"the map is stationary."* Now
the 150 backdrop cities twinkle on staggered delays, each tier city throws a
halo, a tier's cities are joined by arcs that flow, and a scanline crosses the
country. **A city is a control** — clicking one picks its tier exactly as clicking
the table row does. A dimmed tier's arcs and halos stop, animations cancelled, or
the tier you dismissed keeps flowing over the one you chose.
`prefers-reduced-motion` turns all of it off.

### What is designed and NOT built

The identity panel on *Where you sit*, the market tiles, the keyword planner and
the ad card. All four are in the canvas at full fidelity. They were left because
they are the delicate parts of `round-zero.js` — the `live`/`rerender` split,
`submittedAd`, the reserve warning and the Go gate — and rewriting them is where
the risk is, not because the design is unsettled.

### Three decisions worth not relitigating

**The map is the honest chart, not an ornament.** The card already names eighteen
real cities across three tiers; drawing them is the figure that data asks for.
The coastline is DataMeet's boundary reduced by Douglas-Peucker, projected from
latitude and longitude. **Earlier attempts drew it by eye and were wrong however
many points were added** — 34, then 120, then a redraw. Adding points to a wrong
shape gives a wrong shape with more points. Only switching to real coordinates
fixed it.

**"Where you sit" is an identity, not a chart.** The first attempt plotted the
six cells on searches against ceiling. It was correct, and it was an analyst's
chart: it stripped out the thing the card actually asks, which is what kind of
company you are. The canvas version keeps the 3×2 grid — the intuitive part —
and makes choosing one show who you would be, with the real ad a shop like that
runs. Rejected on sight, and the rejection was right.

**Nothing may plot territory.** The tempting version of the positioning chart
lights up your own queries, and it would need `priceAffinity` and
`purposeAffinity` — exactly what 16.1 withholds and what I3 removed the round 0
dot for. Every figure on that card is public: order value, margin, searches,
break-even.

### One thing the canvas takes a position on that the code does not

The ad artboard opens in **the failing state a tester met**: retainer hired,
8/8/8 on screen, account still blocked because the description boxes are empty.
A tweak above the artboard flips it to the resolved state. The fix — a hired
writer supplying copy the player can edit — is proposed and unbuilt, and is the
open item below.


## Still open

**A playtest is where I would start.** The site is live and invite-only, F14 and
F13 are both settled, and the thing only people can do is now the most valuable:
add a playtester who has never seen it to the Access list and record the session
(see *One playthrough is one playthrough*). It is also what would decide whether
F13's rejected volume option has to come back.

- ~~The engine contradicts itself about returns (F14).~~ **Fixed 2026-09-11.**
  The price question was settled by accepting the flattening — nothing sourced
  supports returns rising at the cheap end, and the one breakdown by order value
  found is flat. The three-number change turned out to need four constants; F14
  records why each was forced and what each measured.

  **What it left behind, for whoever is next:**

  - **The location gradient sits on the wrong half of a return.**
    `LOCATION_RETURN_MULTIPLIER` multiplies the whole total, so send-backs come out
    1.36-1.40x higher in the towns as well as refusals. The evidence says it is
    refusals that climb outside the metros (tier-3 RTO 3-5x), and I28 once measured
    send-backs flat. Arithmetic from `round.js`, not yet seen in play. Recorded in
    F14, not touched.
  - **The design canvas quotes the old market.** `design/*.dc.html` still shows
    ₹26.56 at 76% retention, and returns of 24% for mid. They are artboards, not
    code, so nothing breaks — but they would teach the old numbers to anyone
    building from them.
  - **F13 is now 1.73x**, from 1.58x on the same harness. See F13's F14 note.

- **Deployment, a database and a backend are planned, in that order** (agreed
  2026-09-08). Everything runs in the player's browser, so there is no backend,
  database or auth yet. Each earns its place:

  **Deployment** unlocks the largest open item in this file. You cannot hand a
  playtester a localhost address. **The repository side is done** (2026-09-11):
  a build that publishes exactly the files the game loads (41 now), gated on the full
  suite, live on Cloudflare and invite-only since 2026-09-12 — see
  *Deployment*. It did need a little code after all: a build script, a front
  page and a caching header, none of them in `engine/`.

  **A reload no longer loses the game, and that did not need a database**
  (stage A4, 2026-09-12). `ui/save.js` keeps the state before week 1 plus the
  decision log in the browser's own storage after every week, about 280 KB by
  week 12, and a reload offers the game back. The whole final state is 4.5 MB,
  most of what a browser allows, which is why it is never stored. The replay goes
  through `game.js`'s `replayLog`, NOT `engine/serialise.js`'s `replayGame`:
  `serialise.test.js` proves the engine's replay for games played through
  `runRound`, and a game played through `game.js` does not match it (measured).
  A fingerprint of the player's weekly cost and clicks travels with the save, so a
  deploy that changes the numbers between saving and loading is told to the
  player rather than hidden. **A database is still the route to a game that
  follows the player across devices**, and to anything the owner wants to read
  back from playtests; auth arrives with it.

  **A backend** is the only route to `agents/llmPolicy.js`, which §2 asks for and
  which has never been built. That is not a scheduling problem: an API key cannot
  live in browser JavaScript, so the first live model call is *blocked* on having
  a server to hold it.

  Two constraints the work must not break: hard rule 1 keeps `engine/` pure — no
  network, no clocks, no global state — and hard rule 2 keeps model calls inside
  `agents/` with the full suite passing offline.

- ~~A hired writer should hand you the copy.~~ **Built (I25).** A tester paid
  ₹50,000 for the premium retainer, committed capital, watched the ratings reach
  8/8/8 — and could not start the game at all, because the Go button asks
  `validateAdCopy` and the description boxes were empty. They had paid a
  copywriter and were still required to write the copy.

  `content/writerCopy.js` now delivers the ad: **54 sets**, keyed cell → tier →
  three variants, `{brand}` interpolated, covering all 162 combinations. Keyed by
  CELL and not by brand, because 7.5 makes brand names position-neutral and the
  player picks brand and cell independently — brand-keyed copy would contradict
  the cell in most combinations.

  **Two things in I25 are worth reading before touching any of it.** The proposal
  on the table was copy authored to GRADE at its tier, and it was measured and
  rejected: run through the grader, the retainer sets score `adRelevance` 1, 6, 1
  against the freelancer's 2, 5, 4 — **the best copy grades the worst**, because
  relevance rewards keyword echo and good advertising avoids it. The rivals' own
  human-reviewed table never exceeds 5 either. And seeding must never become a
  second source for the grade: `creativeBlock` still takes a hired tier's grades
  from the tier and discards the text.

  The rule that took a decision: **switching to DIY clears the boxes**, because
  the words belong to the writer who was paid for them and retainer copy grades
  `adRelevance` 1 — a player who kept it would be punished for holding on to the
  best writing in the game. Hand-written copy is never overwritten, tracked by
  `draft.adIsSeeded`.

  `writerBalance.test.js` was expected to need re-measuring and did not — it
  passes unchanged at 1.014, which is exactly what the decoupling predicts.

- **Two of the four capital targets still have no surface at all.** Photography
  and order confirmation move a number and no screen says so. The landing page
  has a visible score and the size guide now shows up on *What came back* (I31)
  as the send-back half, so the gap has halved rather than closed. Same shape as
  I16, which put "your copy is not live yet" on the dashboard after measuring
  that the round it lands is the largest single movement in a game.

  **THE FIGURES THAT USED TO BE HERE HAVE BEEN REMOVED, and the reason matters.**
  This entry read "+22.3% for photography against the landing page's +7.6%". Both
  numbers predate two things that invalidate them: `CAPEX_TIER_CURVE` was
  reshaped and photography given a ladder of its own (I30), and the harness trap
  under *Writing a measurement harness* — capex passed as `{sizeGuide: n}` when
  `liveCapexPaise` reads `capex.committed` — was only found on 2026-09-10.
  **Any capex measurement taken before then may have been measuring an account
  with no capital committed at all**, silently, because the lookup returns 0 and
  nothing throws. The current figures are in I30 and were taken after the fix.

- ~~Nothing shows the shape of the curve.~~ **Round 0 draws it** — `steepRung`
  derives the steep stretch from `CAPEX_TIER_CURVE` rather than hard-coding
  indices, so the drawing cannot drift from the constant. **The round-5 window
  does not**, and that is where a top-up decision is actually made.

  The old numbers here are also superseded. The curve is now `0 / ₹25,000 /
  ₹55,000 / ₹80,000` for three targets and `0 / ₹50,000 / ₹1,10,000 / ₹1,60,000`
  for photography, and the rung that cost ₹30,000 for three hundredths is gone
  (I29).

- **Photography still leads in all six cells, by 1.10x to 1.84x.** Down from
  5.44x, so it is a choice rather than a solved puzzle, and it is not balanced.
  Per RUPEE the landing page beats it in three cells of the six, which is the
  more decision-relevant comparison and the better news. I30 carries the table,
  the arithmetic proving price alone could not fix it, and the argument for
  leaving it where it is — a conversion-rate lever genuinely is the highest-
  leverage thing in performance marketing, and 1.5x may be the lesson.

- **The prepaid discount is a real lever and a modest one.** ₹30 is right in four
  cells of six and the gain is 0.2% to 1.4%; what it teaches properly is the
  penalty, since ₹100 loses everywhere by up to 3.2%. If the modesty is a
  problem, the lever to pull is letting it lift conversion rate — excluded on
  purpose so it has one effect, and I34 says why. **Do not reach that by retuning
  `PREPAID_DISCOUNT_CURVE`**, which is built from published deltas rather than
  chosen.

- ~~The two positioning axes have swapped.~~ **Settled as F13, below.** Kept for
  the measurements, which are the reason the decision could be made.
  **The two positioning axes have swapped, and the mechanism is now known.**
  Realised gross profit splits **1.55x by purpose against 1.27x by price**, over 30
  markets and 240 rival accounts, and `lifestyle` takes top rival in **28 of 30**.
  Spec 4.4 and I4 have that the other way round — I4 asserts price moves break-even
  more than 2x and purpose under 15%, and **I4 passes**, because it measures
  break-even and this is not a break-even effect.

  **A lifestyle click is not worth more. It is 15% cheaper.** With both purpose
  sources flattened — realised break-even gap gone, 0.1 / −2.2 / −1.9% — revenue
  per click comes out **1.006** and cost per click **0.845**, and 1.287x of profit
  gap survives anyway.

  **Broad match crosses the purpose axis in one direction only.** `gym`,
  `sports-bra`, `training` and `running` sit in three cells each, all performance.
  `leggings`, `women`, `tshirt` and `india` sit in all six. So a lifestyle
  advertiser's broad keyword reaches performance territory and a performance
  advertiser's does not reach back: performance queries are reached by 2.95 cells
  against lifestyle's 2.34, and **all of the crossing is broad** (exact 0.05/0.05,
  phrase 0.25/0.32, broad 2.65/2.02). Performance auctions therefore run **4.59
  entrants against 3.13**, the runner-up is **402 against 297**, the price falls to
  the reserve **15.1% of the time against 31.6%**, and second price does the rest:
  cpc **24.55 against 16.90**.

  **Performance territory is where the whole market's broad match lands.**
  `DECISIONS.md` F13 carries the full chain, the two measures that looked like the
  cause and were not, and why it is open rather than fixed.

  **THREE CONSTANT-SIDE FIXES ARE MEASURED AND DEAD**, so do not retry them:
  neutralising `PURPOSE_MODIFIERS` leaves 1.386x, flattening the query set's
  purpose content leaves 1.411x, both together leave 1.287x. All three move what a
  click is WORTH; the asymmetry is in what it COSTS. Same shape as G4's two failed
  `CALIBRATE` tweaks on the location payoff.

  **DECIDED 2026-09-12: accepted, and told.** A sharper look found half the
  crossing is one word — "leggings" sits on 33 activewear rows against 12
  lifestyle, and two-tag lifestyle keywords like "everyday leggings" need only
  that one shared word to reach all of them. True to life; the problem was that it
  decided the round 0 choice (27 of 30 after F14, lifestyle's net lead 1.73x) and
  nobody was told. Now the briefing says activewear searches are the most
  contested, spec 4.4 separates what a position can pay from what it earns, and
  `querySetContent.test.js` pins the asymmetry from both sides. Symmetric broad
  match, retagging and volume compensation were each argued and turned down —
  F13's *What was decided* says why, and names volume compensation as the one to
  reopen if playtesting shows the lifestyle seat spoiling the game.

- **Is 1.76x break-even the aggression `spender` should have?** A design question
  about what the cautionary rival teaches, not a defect, which is why the value was
  left alone when the comment was corrected. At 1.10x it would still finish last and
  still demonstrate all four of the mechanisms its docstring lists — but a player
  watching it would see an advertiser overpaying by 10% rather than 76%, which is
  closer to the mistake a real advertiser makes and easier to recognise as one. It
  is a policy number under C7, so changing it moves one competitor's opinion and no
  market physics: no calibration re-run, no `CALIBRATE` constant, no invariant at
  risk. The measurement is in *Why `spender` finishes 5.7x behind* above.

  **The narrower question underneath it:** the effective bid is a policy number
  times an engine number, and nothing asserts what the product is. Whatever is
  decided about the value, a test pinning the effective multiple would stop the two
  drifting apart again — `MAX_CLICKS_AGGRESSION` can move for reasons that have
  nothing to do with this rival.

- ~~Nobody has played it as a learner.~~ **Somebody has now, once, and the game
  stopped asking them anything at week 4.** They won anyway, first of nine, having
  made a decision in 4 of 12 weeks and clicked through the last seven in 72
  seconds. The screens were not silent - measured, they correctly reported nothing
  wrong for seven straight weeks. See *What playing it as a learner found*.

  **What that leaves open is a design question and it is the biggest one here:
  the back half of the game asks nothing and costs nothing.** The last new
  decision arrives at round 5 and settled feedback starts at round 7 (W11), so
  decisions finish before feedback begins. Three directions, none taken and none
  costed: give the market something that changes after round 5 so there is
  something to respond to; move the capital or repositioning windows later so a
  decision lands after settled feedback exists; or shorten the game and accept
  that it is a five-round exercise with a seven-round tail. **The first is the
  only one that adds a lesson rather than removing a problem.**

- **One playthrough is one playthrough.** Everything above rests on a single
  player, in one cell, on one seed, who had watched this thing being built. It is
  vastly better than the zero it replaces and it is not a sample. The next one
  should be somebody who has never seen it, and it should be recorded the same way
  - a passive DOM recorder installed in the browser pane BEFORE round 0, because
  what the record caught that memory did not was the timing, and the timing was
  the finding.

- **The end screen has now been read once**, by the player whose game it
  summarised, and it is the surface that performed best: they read their standing,
  the open books and the week-8 rank trap without asking a question about any of
  it. Not proof it works, but no longer zero evidence.

**Parked deliberately, with the reasoning already written down:**

- **The bid warning in "The week".** Requested after a player set Target ROAS 25,
  got a blank week, and read "lost to rank 100%" as being outbid. `bidOutlook`
  exists on the Bidding card and did not reach them. The sentence belongs where the
  numbers are.
- **`getSelfView` does not carry `creative`.** So no controller can know its own ad
  is not live yet — a real blind spot for an `llmPolicy`, which would see a weak
  week 1 and raise bids for the wrong reason. Recorded in I16.
- **`maxClicks` and `maxConv` agree to the rupee** in every measurement taken.
  Hourly conversion data exists and its leans vary 0.51-0.91, so they should differ.
  Plausible explanation — second price means reshaping a bid changes neither your
  position nor what you pay once you are clearing the field — but unverified. Either
  a correct and interesting property, or one of five strategies is a duplicate.
- **The location basket comment in `constants.js` is wrong.** It calls the AOV
  multiplier "a texture on top of the returns difference rather than a second lever";
  measurement says it is the *larger* lever, 1.196× against 1.125×.

**The older list, unchanged:**



**None of it is interface.** Build step 14 is finished; what follows is content,
tooling and one untested claim.

- **The writer mechanic rests on a balance measured once.**
  `tests/writerBalance.test.js` plays the real configurations and holds
  self-written against the retainer at **1.014** — re-measured this session
  through a replica of the test's own fixtures; the **1.002** recorded here and
  in I11 is the older figure and drifted when rivals stopped writing their own
  ads, which is the drift the bullet below already warns about. Still far inside
  the test's 0.85-1.15 bounds. But that is two seeds and one cell,
  because whole games are slow. It is the tightest balance in the project
  and the most likely to drift: it depends on the tier grades, the delivery
  round, the creative budget, the grader's ceiling AND the rollover, and moving
  any one of them moves it. Widen the seeds and cells if that test ever starts
  looking marginal rather than loosening its bounds.
- **A self-written ad can beat every hired tier on `adRelevance`**, reaching 10
  where a tier caps at 8, because relevance is measured against your own
  keywords. Argued both ways in DECISIONS I11 and left alone because the balance
  holds. First thing to revisit if it stops holding.
- **Only the player writes its own ad now**, and the balance was measured before
  that changed. `writerBalance.test.js` still passes, because it varies the
  PLAYER's tier against a fixed field — but the field it measures against is a
  slightly stronger one than the numbers were originally taken in, since two
  rivals moved from a dead 3/3/3 opening to a hired grade 6. Re-run it if the
  tier grades are ever touched.
- ~~A DIY player runs two near-dead weeks whose cost was never measured in
  information.~~ **Measured, and the claim was wrong in an instructive way.** At
  the bid round 0 offers, weeks 1 and 2 are neither dead nor unteachable: 452 and
  586 clicks, **profitable** at +₹3,258 and +₹1,192, and the Quality Score
  arrives in **week 2** — the same week a hired player gets it. The search terms
  report is a five-row mirror, and it is a five-row mirror for the hired control
  too, and still is at week 6, so that is I8's match-type finding rather than a
  cost of the writer.

  **What IS a real information cost is narrower and exact:** a well-written and a
  badly-written self-written ad produce *byte-identical* weeks 1 and 2, because
  both run the ungraded default. Two of twelve weeks carry zero information about
  the only decision the DIY path exists to test.

  **And the fragility is in the BID, not the weeks.** A DIY opening needs
  **₹16.24** to clear the reserve on its own best keyword; a hired one needs
  ₹6.87. Round 0 offers ₹30 — 1.85x headroom against a hired account's 4.37x —
  and accepts anything from ₹1. Below ₹16 the account is not thin but *invisible*:
  at ₹17 it takes 396 clicks, at ₹16 it takes 244, and at **₹14 it takes zero**,
  for two full weeks, reporting "lost to rank 100%". *That* is where
  "unteachable" is true, and it is caused by the writer choice and the bid
  together. Committing the whole ₹1,00,000 to the landing page moves the floor
  only to ₹15.60, because `landingFactor` is compressed (A6) — capital cannot
  rescue it.

  So HANDOVER's own "the player survives only because their opening bid happens
  to be larger" is **confirmed and quantified**: 1.85x, against the 0.70x that
  killed a rival. ~~A round 0 warning is the open half of this.~~ **Built** —
  round 0 now calls `minimumBidToShowPaise` per keyword, priced at the grade the
  account OPENS on rather than the one the player wrote, and
  `content/writers.js` gained `openingCopyGrades` so that screen and
  `creativeBlock` cannot disagree about what that grade is (I17).

  **Capital cannot lower that floor, which is worth knowing before anyone tries
  to design around it:** round 0's capex goes live at round 4, so
  `landingPageBonus` is zero for the first three rounds and the copy lands
  before the capital does.
- **`agents/` needs `llmPolicy.js` and `queryGen.js`.** §2 asks for two of eight
  rivals to be Claude-backed; the market already has six distinct characters
  without it, so this is optional in a way the others were not. `queryGen` is
  arguably already done by hand — the set is frozen and 7.1 says it is generated
  once then hand-corrected, so building a generator now would regenerate an
  artefact reviewed twice.
- **`grader.js` and `keywordTagger.js` are built but only ever run offline.**
  Both take their transport as an argument and `agents/claude.js` supplies a
  real one; nothing has yet passed it. The first live model call in this project
  has not been made.

  This is now the only honest route to a copy grade above 8. The offline rubric
  caps `expectedCtr` at 8 deliberately — base 5 plus three rules — and
  `grader.test.js` pins that it "does not pretend to be the model". Extending
  patterns until they award a 10 would claim a judgement regexes cannot make,
  and would rebuild the word-bingo DECISIONS I10 removed. A model that reads the
  copy can tell; a regex cannot. See I10 for the argument in full, and note that
  the writer ladder was built to top out AT the offline ceiling so nothing
  currently depends on passing it.
- ~~The corrected query set has not been read end to end.~~ **It has now**, all
  151 rows, field by field. It is in better shape than "never re-read" implied,
  because it is built from a CONTROLLED VOCABULARY rather than tuned row by
  row: six `priceAffinity` triples, four `purposeAffinity` pairs, and nothing
  outside them. That is what stops a hand-edit drifting one row away from its
  neighbours, and it is why reading it was fast.

  Checked and clean: text against price affinity (cheap/budget/under-X against
  premium/luxury/designer/fabric names), text against purpose affinity, tags
  against the cell they sit in (zero contradictions), intent against shape,
  `valueMultiplier` against basket size, and the brand, informational and
  irrelevant rows, which are uniformly neutral by deliberate convention.

  One argument runs through the return multipliers and it is the right one:
  seamless, compression, squat-proof, high-impact, flared and cropped are HARD
  fits and return more; oversized, joggers, tshirts, modal and bamboo are
  forgiving and return less. An earlier smell-check of mine assumed the
  opposite for "technical" items and was wrong — the set is more careful than
  the check was.

  **Two things reading it found, neither a defect:**

  - **`convMultiplier` variation is concentrated in the Value tier.** Spread
    within a cell: value|performance 1.44x, value|lifestyle 1.39x, mid 1.30x
    both, premium|performance 1.18x, and **premium|lifestyle 1.00x — every one
    of its twenty queries converts identically.** The search terms report's
    conversion column is the primary learning surface, and for that one
    position it carries no signal *within* territory. Not false; flat. Fixing
    it is a content edit to a frozen fixture, so it moves every number in the
    simulation and needs calibration re-run.
  - **`studio to street leggings`** sits in premium|performance on a 1.35/0.65
    purpose affinity while being tagged `casual` and named after the
    lifestyle-crossover pitch. It is the one row whose label I would argue
    with. Left alone deliberately: the TAG is what broad match reads, so a
    lifestyle advertiser's broad keyword reaching into it is realistic spill
    rather than a mistake.
- **`content/adCopy.js` holds two ads per cell, and the second six have been
  read back and rewritten once.** Four of the six first drafts were paraphrases
  of the ad they sat beside rather than a second company — `value|performance`
  shared 53% of its vocabulary with variant 1, and `mid|performance`'s third
  headline was variant 1's third headline with the two words swapped. That is
  the standard failure of writing to a constraint list: the vocabulary that
  satisfies the constraints is the vocabulary the first ad already used.
  Rewritten as genuinely different shops and the overlap is now 0–25%, with two
  tests holding it there. **Still not an independent read** — the same person
  wrote them and reviewed them, which is exactly the gap `adCopy.test.js`'s own
  comment describes when it says passing the classifier proxy does not mean the
  copy reads well.
- **One detail unverified** in the premium cells: whether Japanese and Korean
  yarn is what Indian premium activewear signals with, or whether it is recycled
  technical fabric or a named mill.
- ~~`landingFactor` cannot reach "above average".~~ **It can, and the claim that
  it could not was this project's own error — now measured and retracted.** Over
  720 games (12 seeds × 6 cells × 10 grades, `mode: 'expected'`), `above` occurs
  on 20.2% of contested keywords at grade 10 and 3.4% at grade 9, in 33 of 72
  (seed, cell) pairs.

  **The real shape is a flat MIDDLE, not a pinned scale.** Grades 5 to 8 give
  411 of 411 `average` — four consecutive grades with identical output — because
  the factor range is ±10% around its midpoint while the `average` band is also
  ±10%. `below` is common at the bottom: 88.6% at grade 1.

  **How it went wrong, because the shape will recur.** The retracted 1.0925 is
  `1.05 / landingFactor(6)` — one rival, one query — measured on seed
  `20260902`. That is the canonical seed, and it is the WORST row in the grid:
  one of its six cells reaches `above` at all. In five of six cells the false
  claim is locally true. **A number measured on the canonical seed is a sample
  of one**, and it was propagated into spec 9.4, `DECISIONS` I1 and a
  `constants.js` comment, overturning A6's correct conclusion on the way.

  `tests/constants.test.js` had a test named for this and could not see it: it
  asserted `max / min > RATING_UPPER_THRESHOLD`, and `max/min` compares the best
  possible advertiser to the WORST possible one, while `rate()` compares against
  a field AVERAGE. Replaced with a guard that mutation-fires. Widening the range
  is still open and still costs 17.1 what 9.4 measures — but it is no longer
  needed for reachability, so it is a smaller prize than it looked.
- **The W11 display findings are unactioned.** A round's reported profit peaks
  at 117% of truth one round after the click and decays for four more; a 50%
  real improvement in ad quality never moves the reported score, because the
  ratio was already past 1.10 and three levels cannot express anything between.
  The landing-page half of this is now quantified in `DECISIONS.md` A6.
  Both are design conversations, not defects.
- ~~There is no linter.~~ **There is one now**, and it runs inside `npm test`
  (`eslint . && vitest run`), so a lint error stops you before a test runs.
  Correctness only, no style. Its first run found ten pieces of dead code
  including three unused parameters in `round.js` and an unused import added
  that same session. It is mutation-tested: reintroducing `brief is not
  defined` and an uncalled function into `dashboard.js` produces two eslint
  errors and leaves all twelve `ui` tests green. `tests/ui.test.js` asserts the
  wiring so it cannot be quietly removed.
- ~~The search terms card does not explain its own emptiness.~~ **It does now.**
  `termsOutlook` reads searches against RUNNING keywords — reach, not match type,
  because a long phrase keyword reaches almost nothing while a short one reaches
  dozens — and the note says which account you are running. Measured live: four
  phrase keywords give 4 rows and "one each, which means every row here is a
  search you already chose to buy"; the same four on broad give 57 and "about
  14.3 each — so there is reach here you did not name".
- ~~A DIY player runs two near-dead weeks, and nobody has priced that in
  INFORMATION.~~ **Measured — see the entry above.** The weeks are profitable and
  the Quality Score arrives on time; what is real is that the round the copy
  lands is the largest single movement in the game (575 clicks to 2,800, live in
  the interface) and the reserve a 3/3 ad faces is 2.4x a hired one's. The first
  half is now explained on the dashboard (I16); the bid warning is not built.
- ~~Nobody has played it as a learner. The end screen has never been read by
  someone who did not build it.~~ **Both done, once.** A full twelve rounds played
  by hand with a DOM recorder running; see *What playing it as a learner found*
  and the two entries at the top of this list.

---

## Deployment

**Cloudflare, running the tests before every deploy, invite-only.** Chosen
2026-09-11. The repository is private, which rules out free GitHub Pages, and
Cloudflare can later hold the backend and the database (D1) the plan puts next,
so nothing has to move.

**It is a Cloudflare WORKER serving static files, not a Pages project**, and that
was not the plan: the dashboard now steers new sites to Workers, and the account
was set up through that path before the instructions caught up. It was kept on
purpose — for a site like this the two do the same job, and Workers is where the
backend will run anyway.

**Live at `https://g-ads-simulation.manikhorocks.workers.dev`**, project
`g-ads-simulation`, connected to `MnM-Bit808/G-Ads-Simulation`, production branch
`main`, and every other branch gets a preview build.

**How it works, in one paragraph.** Nothing is compiled. `scripts/build-site.js`
follows the imports from `ui/index.html` exactly as a browser does and copies the
41 files it reaches into `dist/` — the page, its stylesheet and 39 modules, about
845 KB — plus a front page that sends visitors to `ui/` and a `_headers` file.
Docs, tests, the design canvas and `files.zip` are never published, and
`tests/build.test.js` holds both halves: nothing missing (Node imports every
module from the built copy, so the check does not trust the build's own reader)
and nothing extra.

| command | what it does |
|---|---|
| `npm run build` | builds `dist/` |
| `npm run preview` | builds, then serves `dist/` the way the live site will be served — the `site` entry in `.claude/launch.json` |
| `npm run ci` | lint, the whole suite with a 60-second test timeout, then build. **This is Cloudflare's build command.** |

**The Cloudflare settings** (project → Settings → Builds): build command
`npm run ci`, deploy command `npx wrangler deploy`, root directory `/`. The build
command was `npm run build` when the account was connected, which skipped the
tests; it was changed to `npm run ci` on 2026-09-11. `.node-version` asks for Node
24 and the build log confirms Cloudflare honours it (24.21.0) — ESLint 10 would
not run on an old default.

**`wrangler.jsonc` says which folder to publish, and it has to.** The first
build had no such file, and the log shows Wrangler guessing: *"Detected Project
Settings: Framework: Static, Output Directory: dist"*. It also wrote itself a
temporary config and rewrote the `preview` script inside the build machine. The
guess was right, and a guess re-made on every deploy is one detection change
from publishing the repository root while still reporting success. The file pins
`./dist`, and `tests/build.test.js` fails if it ever points elsewhere or grows a
`main` script — that would make it a backend.

**Why the test timeout is 60 seconds in `ci` and 5 locally.** Several tests take
1-3 seconds here; Cloudflare's build machines are slower, and a test that fails
because the machine was busy is the exact thing `vitest.config.js` already refuses
to tolerate for timing. Nothing asserts on it. The performance suite is not run
at all.

### What building it found

- **The dashboard crashed after week 1, and had since 2026-09-10.** The first
  smoke test of the build played round 0 into week 1 and got an error: the
  prepaid discount card read a `ctx.price` nothing ever set. 1348 tests passed
  throughout. Fixed and recorded in I34 — and a reminder that "the build works"
  means playing it, not loading it.
- **A plain static server let the browser keep a stale module through a hard
  reload.** With no bundler every module is cached on its own, so a returning
  player could pair new files with old ones after a deploy. The build writes a
  `_headers` file with `Cache-Control: no-cache` (revalidate every load, a cheap
  304 when unchanged), and `npm run preview` serves through `dev-server.js`, which
  never lets a browser cache.
- **`eslint .` linted the built copy** and reported 78 false errors — the rules
  are keyed on paths like `ui/**`, which `dist/ui/...` does not match. `dist/**`
  is ignored now.

### Invite-only, through Cloudflare Access

**Done 2026-09-12, and verified from both sides.** Signed out, every path — the
front page, `ui/`, `engine/constants.js` — answers with a redirect to a sign-in
page and not one line of game code. Signed in with an allowed address, the game
loads and plays.

| piece | where it lives | value |
|---|---|---|
| Zero Trust organisation | Cloudflare One | plan **Zero Trust Free** (up to 50 people), team name `bitter-recipe-3091` — it is what the sign-in page's address shows, chosen by Cloudflare, and can be renamed under Zero Trust → Settings |
| the rule | Zero Trust → Access controls → **Policies** | **Playtesters**: Allow, Include → **Emails** → the owner's address only |
| where it applies | the Worker → **Access** tab | scope **All traffic** (production AND every preview), session 24 hours |

**Adding a playtester** is one edit and no deploy: Zero Trust → Access controls →
Policies → **Playtesters** → add their address under Include → Emails → save.
They open the site, enter that address, and get a one-time code by email.

**Two choices on those screens that are traps**, both recorded because the
dashboard puts them first:

- **"Emails ending in" and the preset "Email domain"** admit a whole domain. With
  `gmail.com` that is every Gmail user alive. The rule uses exact **Emails**.
- **The Access dialog's scope defaults to "Previews only"**, which protects the
  branch previews and leaves the main site public. It is set to **All traffic**.

**What it changed about the "withheld" numbers.** They were readable by anyone
with the developer tools; now they are readable only by people on the list.
Signed-in players can still read `content/querySet.js`. Only a server holding the
numbers back changes that, and that is still the backend step.

### Deploys, from here on

Every push to `main` that passes `npm run ci` goes live on its own, every branch
gets a preview (also behind sign-in), and any earlier version can be restored from
the Worker's **Deployments** tab. The first build with the tests on took 5m49s,
4m54s of it the suite — one replay test takes 12 seconds on Cloudflare's machine,
which is why `ci` sets a 60-second timeout.

**Tell playtesters two things**: the game is saved in their own browser after
every week, so a reload offers it back, but a different browser or device starts
fresh; and the sign-in code arrives by email from Cloudflare, sometimes in spam.

**The "late weeks freeze for 30-60 seconds" warning is withdrawn.** It was
measured on 2026-09-06 and copied here on 09-11 without re-measuring. On
2026-09-12, on the built site (`npm run preview`) in a visible tab, every week of
a sixty-broad-keyword game took 0.25-0.32s. A hidden browser pane measured 0.8-1.8s,
so hidden tabs are slower. Still unmeasured: the live site on a phone. Ask the
first playtester to say if any week takes more than a few seconds.

---

## How this project works

**Tests first, then implementation, then run and iterate.** Every step so far:
write the test file, write the module, run, fix, commit, push. `npm test`.

**Commit and push after every green run.** Credentials are cached, so pushing
needs no interaction. Commit messages are long on purpose — they carry the
reasoning that would otherwise be lost.

**Run diagnostics, not just tests.** Several of the most useful findings came
from a throwaway script printing real numbers, not from an assertion. The
pacing stutter, the fixture's impossible bids, the 43% gross/net gap being a
base-tier figure — all found by looking at output. Scratchpad scripts for this
live outside the repo.

**Mutation-test anything that validates.** A validator that always returns
"valid" passes a naive suite perfectly. `querySet.test.js` breaks exactly one
rule at a time and asserts that rule fires; `brands.test.js` proves its guard
would reject `BudgetBox`.

**Structural tests where a rule cannot be tested behaviourally.** You cannot
prove a module ignored a field it was handed, so instead: `quality.test.js`
reads every file in `engine/` and fails if any but `quality.js` so much as
writes `reportedScore`; `strategies.test.js` fails if that module names an
affinity; `serialise.test.js` fails if it could reach a model. These have fired
three times and were right every time.

---

## The pattern worth knowing

**Building a module keeps finding defects in the spec that reading it did not.**
Roughly a dozen so far, all recorded in `DECISIONS.md`. Three examples, because
the shape repeats:

- Spec 12.1 and 14 both listed `business.convRateBase` *and* the purpose
  modifier. But `businessFor` already folds the modifier in — it has to, or the
  break-even table would be wrong. Applying it again would have made every
  lifestyle brand convert 1.21× and return 1.44× more than designed. **When a
  derived object and a formula both mention the same modifier, one of them is
  wrong.** (F10)
- `DECISIONS.md` D9 claimed the generic pacing curve manufactures the forecast
  error the 2× overspend cap needs. Measured, it produces 0.2% overspend — the
  hourly feedback loop is too tight. The entry is corrected in place, and what
  the mismatch actually costs (mis-timed spend, an account broke before its best
  hours) turned out to be the better lesson.
- Spec 10.2 would have let a *below-floor* rival set your price, so adding a
  weak competitor would have **lowered** your cost. The floor is a reserve, not
  just an eligibility gate. (B5)

So: **treat the spec as authoritative but not correct.** If something reads
oddly while implementing it, it is worth ten minutes of arithmetic.

---

## Decisions taken by recommendation rather than discussion

- **The three `RoundReport` sub-questions**: no rival rows in an advertiser's
  slice, breakdown per keyword *and* per query, and `AsFirstReported` twins on
  every revised figure. All built and tested; worth confirming they are what was
  wanted.
- **`PURPOSE_MODIFIERS.conv` is 0.94/1.06**, chosen so the *realised* purpose gap
  lands where spec 4.4 always claimed it was. The alternative was flattening the
  query set's baskets and returns, which would have asserted something false
  about apparel to protect an invariant. See `DECISIONS.md` F11.
- **Ad copy grades sit on the rival, not the cell** (`adCopy.js`), so position
  cannot carry hidden ad quality. Challenge it if you disagree.

---


## Things that will bite

- **The shell has a stale PATH.** Node is at `C:\Program Files\nodejs`; prepend
  it (`$env:Path = "C:\Program Files\nodejs;" + $env:Path`) in every PowerShell
  call or `node` is not found.
- **Commit messages must go through a file.** `git commit -F <file>`; PowerShell
  here-strings mangle embedded quotes and git receives the message as filenames.
- **`engine-audit.test.mjs`** at the repo root is a v0.1 prototype artefact that
  cannot run. `vitest.config.js` excludes it deliberately. Its `BUG CHECK` cases
  encode real traps and have been ported as their modules were built.
- **The two `.jsx` prototypes are gone**, and the reason is worth keeping. Each
  carried its OWN demand curve, conversion multipliers and auction, so once a
  real interface existed they looked like the UI and agreed with nothing.
  `git log` still has them if anything needs salvaging. `ui/` imports the real
  engine and `tests/ui.test.js` fails if that ever stops — which is the guard
  that replaced them.
- **`files.zip`** at the root holds a `CLAUDE.md` and `DECISIONS.md` from before
  the first commit, so git never captured them. Kept as provenance, not code.
- **The performance suite runs alone**, via `npm run test:perf` and its own
  config. Inside the parallel suite the same round reported 496ms and 1991ms
  twenty seconds apart, and switching to CPU time only moved the problem — GC
  under that much memory pressure is real CPU. A timing assertion that fires on
  machine weather is worse than none, because it teaches you to rerun until it
  passes.

### Playing it to the end

- **Rounds USED to get slow** (measured 2026-09-06; not reproduced 2026-09-12,
  when every week took under a third of a second on the built site). Early weeks
  resolved in about seven seconds; by week 10 or 11 a single round took thirty to
  sixty. The round blocks the main thread, so
  the button sits on "running 168 hours…" and the page is unresponsive — it
  looks hung and is not. Driving twelve rounds from a script needs waits far
  longer than the early rounds suggest, and a loop that clicks on a fixed
  interval will silently stop advancing once a click lands on a disabled button.
- **The search terms report mirrors your keywords when they are all phrase or
  exact.** Four phrase keywords give four rows, each identical to the keyword
  that bought it, and the primary learning surface has nothing in it. That is
  the model being honest — DECISIONS I8 measured one broad keyword taking the
  same report to seventy rows. The note under the table now says so, but the
  underlying fact is worth knowing before you read a quiet week as a bug.

### Writing a measurement harness

- **Assert the rivals are live before you measure anything.** `policyId` was
  null for everyone until it was fixed, and the obvious wiring silently produced
  a market that never bid back. Even now, one line —
  `expect(live).toBe(advertisers.length - 1)` — is the difference between a
  measurement and a plausible fiction.
- **Sum from `finalState.history`, through `gameTotals`.** History is the copy
  that gets REVISED (11.4). Summing the reports each round first returned counts
  lag-0 conversions at the wrong value and inflates everything.
- **Settled rounds only, if you are comparing to a calibration figure.** A click
  in round R is not final until R+5, so only rounds 1–7 of a twelve-round game
  are settled. `calibration.test.js` filters on that and a replica that does not
  will disagree with it by a factor.
- **Play more than one seed and more than one cell.** Seeded rival PLACEMENT
  means a seed is a whole different market, not a different roll.
- **`capex` is `{committed: {...}, pending: []}`, never `{sizeGuide: n}`.**
  `liveCapexPaise` reads `capex.committed?.[target] ?? 0`, so a bare object
  returns 0 for every target and NOTHING THROWS. Every harness written on
  2026-09-10 had this until a measurement reported a full size guide as worth
  0.0% in all three cells, identical to the rupee, which is what gave it away.
  Proven directly: the bare shape gives `sizeGuideEffect` 1.000, the correct one
  1.250. Any capex figure measured before that date is suspect.
- **A week's returns have not resolved, so never measure them on the last one.**
  A return needs two rounds after the conversion, which needs up to three after
  the click. An assertion on `history.at(-1)` reads zero and reports a working
  feature as broken — it did, twice in a row on 2026-09-10, and the second time
  was after wrongly blaming the fixture.
- **`tests/fixtures/querySet.js` hardcodes `returnRateMultiplier: 1.0`.** It
  exists to satisfy 7.4's rules, not to carry the content set's spread. Anything
  measuring variation BY SEARCH has to run on `content/querySet.js`, which has six
  distinct values from 0.85 to 1.2.
- **If your replica cannot reproduce a documented baseline, it is measuring
  something else** — whatever it says about your change. Two separate wrong
  conclusions this session were caught by exactly that check and by nothing
  else.
- **Record the harness, not just the result.** F14 wanted to re-measure F13, I30
  and G4 and could not: none of them wrote down the player account it was
  measured on, so no replica could be checked against them. F14's own, so the
  next session can reproduce it: `startGame` on `content/querySet.js`,
  `BRAND_IDENTITIES[0]` as the player on an agency writer, the six
  highest-volume queries of the cell as PHRASE keywords bid at 0.7 x
  `realisedBreakEvenCpcPaise`, a controller that returns null every round except
  round 5, where it returns `{ capex: {...} }` explicitly (an omitted round-5
  allocation is lost, not rolled in), rivals on `controllerFor(policyId)`,
  `mode: 'expected'`, totals from `gameTotals(finalState.history, id).all`.
  Market figures: 30 seeds (1-30), player on `mid|performance`. Account
  figures: seeds 1-3 in each of the six cells.
- **A passing invariant is not a measurement.** `calibration.test.js` asserts
  under 15% and prints nothing, so I3 drifted from 9.5% to 13.2% across I28
  without anybody seeing. To find where a number moved, `git archive <commit>
  engine content tests/fixtures agents game.js | tar -x -C <dir>` into the
  scratchpad for each commit and run the same replica against every snapshot —
  it found the whole move in one commit on the first pass.
- **A constant change can be measured before it is made.** `POSITION_ECONOMICS`
  and `PURPOSE_MODIFIERS` are plain objects read at call time, so a harness can
  set them in memory — then read `businessFor` back to prove it took. Primitive
  constants (`AD_RANK_FLOOR`, `WEEKLY_VOLUME`) cannot be reassigned from outside;
  copy the tree into a snapshot and edit the copy. Weekly volume reaches a game
  through `querySet.weeklyVolume`, so it can also be overridden there.
- **Whole games are fast in node.** About 3 seconds each — the 30-60 second
  rounds in *Playing it to the end* are the browser. On worker threads, 90 games
  take about 90 seconds on this machine. Terminate the workers when the pool is
  done or the process waits forever with nothing to do, which looks exactly
  like a hung engine. And never run `npm run test:perf` while a pool is busy: it
  failed at 2,902ms under load and passed at idle.

### The one that will cost you an afternoon

- **A player decision must be RETURNED from a controller, never written into
  state.** `playRound` collects what each controller returns and hands it to
  `submitRound`, and `submitRound` is what applies structural changes, writes
  the learning period when 12.3 says to, and appends to `decisionLog` for
  12.4's replay. Reaching into `game.state.advertisers[0]` from the interface
  and editing a bid there produces a game that runs, looks right, and silently
  never triggers a learning period or logs a decision. Three mechanics gone,
  no error. This is the exact shape of half the defects this project has found.

### Verifying the interface

- **`npm test` is the gate, and it has caught one interface bug out of nine.**
  The suite reads SOURCE, not function bodies: it can tell you that `ui/` still
  imports the engine and carries no physics of its own, and it cannot tell you
  that a stale identifier reaches the browser, that a form field forgets what
  you typed into it, that a warning fires when nothing is wrong, that an engine
  string is being printed raw, or that a card is explaining a mechanic
  incorrectly. The one it caught was a syntax error. **Open the browser before
  believing the interface works.** A green suite is necessary and it is not
  evidence.
- **The pure part of a screen belongs outside the render function.** Everything
  in `decisions.js` and `ending.js` that can be wrong silently — the diff, the
  preview, the month arithmetic, the reading-back of `decisionLog` — is an
  exported function with tests, and only the drawing needs a browser. That is
  what made 47 of this session's tests possible at all.
- **Resizing the browser pane reloads the page, and the game is in memory.**
  Four played rounds vanish and you are back at round 0 with no error and no
  clue. Set the viewport BEFORE opening the game, not after — and if a
  screenshot suddenly shows round 0, that is what happened rather than a bug in
  `app.js`.
- **Screenshots lie when the browser pane is hidden.** The viewport collapses,
  `window.innerWidth` reads 0, every card measures 32px and the page reports
  horizontal overflow. It is indistinguishable from a layout bug. When that
  happens, read the DOM with `javascript_tool` instead — measure
  `getBoundingClientRect()` and `innerHTML` rather than trusting a picture.
- **The console keeps errors across navigations.** Stale entries from a previous
  load read exactly like current failures, complete with line numbers from files
  that have since changed. Open a fresh tab to check whether an error is real.
- **The round 0 form rebuilds itself on every keystroke**, because each input
  calls `rerender()`. Driving it from a script means re-querying the element
  after every single change, and setting `.value` does nothing on its own —
  dispatch an `input` event or the handler never runs.

---

## Working preferences that shaped this

Stated in `CLAUDE.md` and worth repeating because they changed how the work was
done:

- Plan before code for anything non-trivial, and wait.
- Ask rather than assume. Guessing silently is the main failure mode being
  guarded against.
- One module at a time. Do not build ahead.
- Push back. Roughly forty spec problems were caught by two audit passes before
  a line was written, and a dozen more by building. Assume more remain.
- Explain technical things in plain language. A working file that cannot be
  followed is a failure even if the tests pass.
