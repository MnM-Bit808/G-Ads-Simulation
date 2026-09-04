# HANDOVER.md

State of play, for whoever picks this up next — including a fresh Claude Code
session, which will have read the files but not the conversation that produced
them.

Everything factual lives in `ENGINE_SPEC_v0.3.md` and `DECISIONS.md`. This file
carries the things those two cannot: where we are, how we work, and what is
still resting on a guess.

---

## Where we are

**Every build-order step is done.** 1016 tests, all passing, 1 todo.

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

`ui/` is five modules: `app.js` (the loop), `round-zero.js`, `dashboard.js`,
`decisions.js` (the between-weeks form) and `ending.js` (the last screen, and
the only reader `decisionLog` has ever had).

**It is playable end to end, and has been played end to end.** `npm run dev`,
then http://localhost:5173. Round 0 asks for brand, position, capital,
keywords, ad copy and a weekly split; the dashboard plays a week at a time
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

All five calibration invariants pass. Neither `CALIBRATE` constant moved without
argument:

| | value | why it is where it is |
|---|---|---|
| `AD_RANK_FLOOR` | 60 | Raising it is regressive. A flat reserve takes the same absolute paise from every cell — a small bite out of Premium's ceiling, a fatal one out of Value's. Floor 150 takes I3 from 2.8% to 50.8%; 250 wipes the Value tier out. |
| `WEEKLY_VOLUME` | 350000 | Pinned from both sides. Below ~315,000 I1 fails — a competently covered advertiser cannot exhaust its month. Above ~375,000 I3 fails — the flat budget cap bites unequally across break-evens differing 2.7x. |

I3 sits at **2.8% worst deviation, 1.05x spread** against a 15% target.

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
  A6 records this as landing-page compression; it is every component.
- **The noise floor is flat.** `QUALITY_NOISE_SIGMA` is a volume-independent 8%
  that swamps the Poisson term, so every advertiser sits at 9-10% CV regardless
  of size. **F7's Premium claim does not hold on reported outcomes** — 10.5%
  against 8.8%, not the 3x it describes. It *does* hold on the bid strategy's
  internal estimate: sigma 0.141 against 0.050 at round 12.

None of that needs a longer game. The cheapest fixes are display-side and
constant-side, and they have not been discussed yet.

---

## Still open

**None of it is interface.** Build step 14 is finished; what follows is content,
tooling and one untested claim.

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
- **The query set was reviewed once** and Value and Premium were rewritten after
  that review. The corrected set has still not been read end to end.
- **`content/adCopy.js` is read and corrected.** One detail unverified: whether
  Japanese and Korean yarn is what Indian premium activewear signals with, or
  whether it is recycled technical fabric or a named mill.
- **The W11 display findings are unactioned.** A round's reported profit peaks
  at 117% of truth one round after the click and decays for four more; a 50%
  real improvement in ad quality never moves the reported score, because the
  ratio was already past 1.10 and three levels cannot express anything between.
  Both are design conversations, not defects.
- **Round 0 marks your own territory in the keyword planner, and 16.1 says it
  should not.** `ui/round-zero.js` uses `homeCell(q)` to put a dot beside the
  searches in the player's cell — and `homeCell` is computed from
  `priceAffinity` and `purposeAffinity`, which 16.1 withholds "from every
  viewer, including the advertiser the affinity favours". It is deliberate and
  it does real teaching work in round 0, where the player has no report at all.
  The mid-game planner added in the decision form does NOT carry the dot, on the
  grounds that by then the player has evidence. **So the two screens now
  disagree about whether you can see your own territory, which is worse than
  either answer.** Undecided, and worth deciding.
- ~~There is no linter.~~ **There is one now**, and it runs inside `npm test`
  (`eslint . && vitest run`), so a lint error stops you before a test runs.
  Correctness only, no style. Its first run found ten pieces of dead code
  including three unused parameters in `round.js` and an unused import added
  that same session. It is mutation-tested: reintroducing `brief is not
  defined` and an uncalled function into `dashboard.js` produces two eslint
  errors and leaves all twelve `ui` tests green. `tests/ui.test.js` asserts the
  wiring so it cannot be quietly removed.
- **Nobody has played it as a learner.** Round 0 and a first week have now been
  played BY HAND — real clicks, real typing, Tab between fields — and that
  immediately found two bugs a script structurally could not (see below). The
  rest has been driven from a script by someone who knows what the engine does,
  which is not the same thing as somebody learning from it. **This is still the
  largest untested claim in the project.**
- **The end screen has never been read by someone who did not build it.** It is
  the one surface whose whole job is reflection rather than mechanism, and the
  only evidence it works is that its numbers are right.

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
