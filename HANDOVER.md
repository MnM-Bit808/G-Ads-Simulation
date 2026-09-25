# HANDOVER.md

State of play, for whoever picks this up next — including a fresh Claude Code
session, which will have read the files but not the conversation that produced
them.

Everything factual lives in `ENGINE_SPEC_v0.3.md` and `DECISIONS.md`. This file
carries the things those two cannot: where we are, how we work, and what is
still resting on a guess.

---

## Start here

**This file is the guide. `JOURNAL.md` is the log.** If a sentence here says
what happened on a date, it is in the wrong file — the journal takes those,
newest first, append-only. That rule exists because this file had grown to
3,400 lines by keeping a running log inside it, and the cost was not length: it
was that *Where we are* claimed 1,656 tests for a week after there were 2,733,
and a section described a look that had been deleted four days earlier. **A
stale line in a long file is invisible.**

### Read in this order

1. `CLAUDE.md` — the rules, the build order, the known traps. Shortest.
2. This file's *Where we are*, then *Still open*, then *Things that will bite*.
3. `ENGINE_SPEC_v0.3.md` — the specification, and the source of truth.
4. `git log --oneline` and the last few commit messages **in full**. They carry
   the reasoning; this file carries only what outlived its commit.

`DECISIONS.md` is a ledger to look things up in, not to read front to back. Its
entries are long because they carry their measurements.

### What this game is, in one paragraph

Nine advertisers — the player and eight rule-based rivals — compete over twelve
weekly rounds in three monthly budget cycles, in Indian D2C athleisure. Each
holds one cell of a 3 × 2 price × purpose grid chosen at round 0, which sets
what a click is worth to them and therefore which searches are theirs. The
engine is pure and seeded; the interface is the Studio, and it is the only look.
It is live, and it is a teaching tool before it is a game — **a simulator that
teaches something false is worse than none, because the player cannot tell.**

### The one thing that has never been true

**Nobody has finished playing it.** Two testers stopped early and neither sent a
file. Every other quality signal this project has is internal — 2,733 tests,
gates agreed before measuring, a 113-entry ledger — and none of them can tell
you whether a beginner learns anything. That is the open question, it is the
owner's to close, and it outranks everything in *Still open*.

## Where we are

**Live on Cloudflare**, built and deployed from `main` by `npm run ci`, which
runs lint and the whole suite before it publishes. The Studio is the only look
since the switch-over (2026-09-16); there is no `?look=classic` and no
`ui/look.js`.

**2,733 tests, 1 todo**, across 69 files. `npm test` is lint then vitest.
`npm run test:perf` is separate and **nothing runs it for you** — see *Running
the performance suite*.

**Every build-order step is done**, plus the two the list never had: `game.js`
(the round loop) and `setup.js` (round 0). The engine, the agents, the Studio,
the field guide's 23 chapters, the first run, deployment and the playtest
recorder are all built.

**57 of 79 tagged constants are `INVENTED`, 9 `DOCUMENTED`, 8 `ESTIMATED`, 5
`CALIBRATE`.** That ratio is the honest headline of the whole model: its
STRUCTURE is faithful and its MAGNITUDES mostly are not, which is now audited
rather than assumed (DECISIONS I42) and said on screen in the field guide's
contents page rather than only here.

**The numbers most worth knowing** are in `DECISIONS.md` F14 (the return level),
F15 (why the market is profitable), F17 (the throttled ladder), F19 and F20
(this session's two engine fixes) and I42 (what is sourced and what is not).


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
agreeing. (Until 2026-09-15 that test compared one path with itself, and the two
had stopped agreeing: F17.)

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

## Still open

**A playtest is where I would start.** The site is live and **open to anyone with
the link since 2026-09-20**, F14 and F13 are both settled, and the thing only
people can do is now the most valuable: send the link to somebody who has never
seen it and record the session (see *One playthrough is one playthrough*). There
is nothing to set up first — the sign-in that used to stand in the way is gone
(*Invite-only, and why it was removed*). It is also what would decide whether
F13's rejected volume option has to come back.

- ~~The engine contradicts itself about returns (F14).~~ **Fixed 2026-09-11.**
  The price question was settled by accepting the flattening — nothing sourced
  supports returns rising at the cheap end, and the one breakdown by order value
  found is flat. The three-number change turned out to need four constants; F14
  records why each was forced and what each measured.

  **What it left behind, for whoever is next:**

  - ~~**The location gradient sits on the wrong half of a return.**~~ **HALF
    FIXED 2026-09-20 as F20, and the other half is now its own item.**
    `LOCATION_RETURN_MULTIPLIER` multiplied the whole total, so send-backs came
    out 1.36-1.40x higher in the towns as well as refusals. It multiplies the
    refused half alone now, and send-backs run 0.90-0.93x.
    **The table did NOT widen**, so refusals stay at 1.65-1.81x and the location
    trade fell from 1.50x to 1.16x. It could not widen without overturning the
    sourced cash mix (value and mid are level at `[1, 1.5, 1.9]` already) — and
    **F21, the same day, found there was nothing to widen toward.** The 3-5x
    that was supposed to be tier-3 against metros is COD against prepaid, which
    the model already carries at a sourced 3.6x. F20 has the measurements, F21
    the sources.
  - ~~**The design canvas quotes the old market.**~~ **CLOSED 2026-09-20 by
    marking, not by editing.** `design/*.dc.html` does still show ₹26.56 at 76%
    retention and 24% returns for mid, and it always will: an artboard is a
    record of what was believed the day it was drawn (2026-09-10, one day
    before F14), and editing its figures would make an old drawing look
    current. **What was actually wrong was `design/README.md`**, which vouched
    for the content as "real throughout" without saying *when* — so the folder
    asserted the numbers were good rather than merely showing them. It now
    names the date, names the three dead figures, and says to take the shape
    from an artboard and the numbers from `engine/constants.js`. It also
    records that `support.js` is not in the repository (the design canvas
    supplies it), so an artboard opened straight in a browser looks broken
    without being so.
  - **F13 is now 1.73x**, from 1.58x on the same harness. See F13's F14 note.


- **Deployment, a database and a backend are planned, in that order** (agreed
  2026-09-08). Everything runs in the player's browser, so there is no backend,
  database or auth yet. Each earns its place:

  **Deployment** unlocks the largest open item in this file. You cannot hand a
  playtester a localhost address. **The repository side is done** (2026-09-11):
  a build that publishes exactly the files the game loads (54 now), gated on the full
  suite, live on Cloudflare since 2026-09-12 — invite-only until 2026-09-20,
  open to anyone with the link since — see *Deployment*. It did need a little
  code after all: a build script, a front page and a caching header, none of
  them in `engine/`.

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
  as the send-back half, so the gap has halved rather than closed. Since
  2026-09-15 order confirmation moves the prepaid card's refusal figure from the
  week it goes live (I29, I34), but nothing names it as the cause, so it has
  half a surface, not one. Same shape as
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

- **The prepaid discount is a real lever and a modest one.** Since the round
  takes its refusals off at the sourced rate (I34, 2026-09-15), ₹50 is best in
  five cells and ₹70 in the sixth, for +1.7% to +4.7% of final profit on the
  committed harness (`node scripts/market-harness.js prepaid <label>`). ₹100 is
  worse than ₹50 everywhere and no longer worse than nothing, so the penalty the
  lever used to teach is now only the diminishing return. If the modesty is a
  problem, the lever to pull is letting it lift conversion rate — excluded on
  purpose so it has one effect, and I34 says why. **Do not reach that by retuning
  `PREPAID_DISCOUNT_CURVE`**, which is built from published deltas rather than
  chosen. ~~And no rival has ever pulled it (I34, open).~~ **Corrected
  2026-09-25:** rivals have pulled it since the C9 fix — measured on the
  committed harness, two of eight offer ₹50, live from week 3, in every seed
  tried (20260901, 20260902, 7, 12). **Nothing on any screen says so** — see
  the next two entries, which are why.

- **A rival's prepaid offer cannot reach the player today, and the reason is
  a design decision nobody has taken (open, 2026-09-25).** The Rivals card is
  handed `view.advertisers` (`ui/dashboard.js`), and `getPublicView` builds a
  rival as `{id, name, domain, ads}` — no `campaign`, so no
  `prepaidDiscountPaise`. The field is not in `FORBIDDEN_IN_PUBLIC_VIEW`, but
  the view is a WHITELIST, so being absent from the blacklist grants nothing.
  Two ways in, both needing a decision first because both change a contract:
  **(a) add the field to the public view** — defensible, because everything the
  blacklist withholds is genuinely private operating data (bids, budgets,
  affinities, negatives) while a retail discount is advertised to customers,
  but it also hands the field to every rival controller, so it is a 16.1
  change with a DECISIONS entry; or **(b) put the offer in the rival's own ad
  copy** at the point the policy sets it, which needs no R3 change at all
  because ads are already public, but means a decision can carry creative,
  which today it cannot. Until one is chosen the lever stays contested
  invisibly, and a player cannot tell whether their ₹50 matches the field.

- **A UI test that spreads an engine field onto a view fixture proves
  nothing (2026-09-25).** A card read `who.campaign.prepaidDiscountPaise`, a
  test built `{...advertiser, campaign: {...}}` to check it, the suite went
  green, and the card drew nothing in a real game because the public view has
  no `campaign` — `?? 0` turned the missing shape into a confident "no offer".
  Same shape as the three rival rules that read `report` for returns. The
  fixture in `tests/rivals.test.js` is the public view's four keys on purpose,
  and `the shape a card is really handed` now locks it to `getPublicView`, so
  the next field a card wants fails there instead of reading `undefined`.

- **Only two of six characters ever consider the prepaid lever, and every
  rival is over the line that says they should (open, found 2026-09-25).**
  `prepaidNudge` is shared, but only `disciplinedAccount` and
  `grossOptimiserAccount` call it; `spender`, `cautious`, `automator` and
  `brandDefender` never do, and `withCapital` adds only capex. Measured on the
  last played week of seed 20260901, **all eight rivals sit between 12.2% and
  18.6% refusal**, above the 12% line that buys ₹50 — so the four silent
  characters are not declining the lever on the numbers, they were never
  offered it. This is the C8 shape: a decision added to some policies and not
  the rest. It is not obviously a character choice either, because every
  deliberate omission in this file is documented in its policy's header
  (`spenderAccount`: "Negatives stay empty, every round. That is the whole
  character.") and none of the four mentions prepaid; and the cast's own
  standard is that each character is "wrong about one thing **in a legible
  way**", while a rival's refusal rate is on no screen, so this one cannot be
  read. **Fixing it moves the market** — six rivals taking a +1.7% to +4.7%
  profit lever makes the board harder — so it needs gates agreed and a
  before/after harness run, and is deliberately not done.

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
  self-written against the retainer at **1.034** (2026-09-12, E9). Before that,
  **1.014** was re-measured through a replica of the test's own fixtures, and
  **1.002** is the oldest figure; it drifted when rivals stopped writing their own
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
- ~~The search terms mark and the block warning test for an exact zero.~~
  **Fixed 2026-09-15** (I8's addendum): a search is marked when a sale there
  costs over twice the account's average, or when it has spent an average sale
  and sold nothing; the block preview warns only when it would catch a search
  selling at or under that average. Seed 1's Vella & Co. at week 6 went from
  none of 33 searches marked to 3. **Two twins are left:** the Studio's What
  people typed (`ui/typed/read.js`, on `makeover`) still leaves a search with
  no sale unmarked, and can import `isDear` once `main` is merged in; and the
  rivals' `wastefulQueries` still blocks only a search with no conversions at
  all, which changes the market and wants the harness before and after.
- ~~A revision re-prices the weeks sold before a price move.~~ **Fixed
  2026-09-16** (F18, on `main` the same day; this is its `makeover` twin):
  each week's report records the margin its orders were sold at
  (`money.marginPct`), and every revision uses it. A week-5 move had been
  re-pricing all of month 1 at the new tier's margin, which moved the week-8
  rank and the end screen for a player who moved; F18 has the before and after.
  The harness has a `move` mode for it.
- ~~An old week's late sales go to whichever keyword catches the search when
  they land.~~ **Fixed 2026-09-16** (I36, with F18): each order now carries
  the keyword that caught its click (`keywordId`), as it carries its search and
  place, and `keywordForQuery` is gone. It hit every player who blocked a
  search with a negative, since nothing catches a blocked search any more;
  removing or replacing a keyword did it too. The keywords table showed it,
  the search terms report never did, and the market harness came out identical.
- **What the twin took, since `makeover`'s engine is not `main`'s.** F18 applied
  as it stands. I36 did not: F17 moved the conversion bucket into
  `recordConversions`, so `keywordId` is set there from `e._plan.keyword.id`,
  and `report.js` differs by about thirty lines from main's, so only the map
  argument came out of `reviseBreakdown` and its three `byKeyword` lookups. The
  harness kept `makeover`'s `writer` and `compare` modes beside the new `move`
  one. In DECISIONS, F17 stays before F18 and I35 before I36.

---

## Deployment

**Cloudflare, running the tests before every deploy. Open to anyone with the
link since 2026-09-20.** Chosen
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
files it reaches into `dist/` — 112 since the switch-over (54 before it), about
1.6 MB with the two typefaces — plus a front page that sends visitors to `ui/`
and a `_headers` file. It also WRITES one file it did not copy, `ui/version.js`,
stamped with the commit, so a playtest file names the build it was made on.
Docs, tests, the design canvas and `files.zip` are never published, and
`tests/build.test.js` holds both halves: nothing missing (Node imports every
module from the built copy, so the check does not trust the build's own reader)
and nothing extra.

| command | what it does |
|---|---|
| `npm run build` | builds `dist/` |
| `npm run preview` | builds, then serves `dist/` the way the live site will be served — the `site` entry in `.claude/launch.json` |
| `npm run ci` | lint, the whole suite with a 60-second test timeout, then build. **This is Cloudflare's build command.** |
| `npm run test:perf` | spec 19's engine budgets. **Nothing runs this for you** — see below |
| `npm run typecheck` | `tsc --noEmit` over the engine side. Checks the JSDoc against the code; compiles nothing |

### What `typecheck` is for, and what it is not

**It is not a migration.** There are no `.ts` files, no bundler, and `noEmit`
guarantees nothing is compiled — the game is still served as the `.js` files you
can read. What it checks is that the **JSDoc still matches the code**, which is
the project's own convention (a tag on every exported function: what it does,
its units, the invariants it assumes) and which nothing checked until
2026-09-20.

**It found 61 things and not one was a type error.** They were all documentation
that had drifted: `effectiveGrades`' tags described a different function
entirely; `pagePoints` had a duplicated `@param` pair with prose pasted between
it and the real tags, so every tag bound one position out; `runRound`'s
`@returns` listed three of the five fields its own file header names, and that
disagreement reached `game.js` and `serialise.js`; `liveCapexPaise` declared
`committed` required while its body has always read `capex?.committed?.[target]
?? 0`. A JSDoc that lies is the same defect as a comment that lies.

**`ui/` is out of scope on purpose**, and `tsconfig.json` carries the reasoning:
303 errors there against 44 on the engine side, nearly all DOM typing that is
silenced with casts rather than fixed — and every interface defect this game has
ever had was visual or behavioural, which no type-checker sees.

**Run it before committing anything in `engine/`, `content/`, `agents/` or
`scripts/`.** It is in `npm test`, so the ordinary check covers it.

### Running the performance suite

**`test:perf` is hand-run, and that is a real gap rather than an oversight.**
`npm test` is lint plus vitest and `npm run ci` is lint, vitest and the build;
neither includes it, because timing anything inside a parallel run measures the
machine rather than the code. So the one gate protecting the per-round budget
has no automation behind it, and on 2026-09-20 it was found red — it had been
red for an unknown stretch and nobody knew.

**Last run: 2026-09-20, all five passing.** Three-auction path 3,101–3,180ms
under vitest, 1,968–2,104ms in plain Node, against an asserted bound of 3,600
and a spec budget of 1,500.

**Run it before any release you care about, and after anything that touches the
hot loop in `engine/round.js`.** Then update the line above, because a date is
the only thing that tells the next person whether the green tick means anything.

**IF IT GOES RED, MEASURE THE OLD CODE BEFORE TOUCHING THE BOUND.**
`git checkout <old-sha> -- engine/ tests/`, run it, restore. That one step
separates "the engine regressed" from "the environment changed", and both times
this bound has moved the answer was the environment — the file's own header has
the numbers for both occasions.

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
  means playing it, not loading it. That fix mended one of three keys the card
  read and nothing set; the other two failed quietly, showing every account the
  towns' refusal rate, until 2026-09-15 (I34, and *Verifying the interface*).
- **A plain static server let the browser keep a stale module through a hard
  reload.** With no bundler every module is cached on its own, so a returning
  player could pair new files with old ones after a deploy. The build writes a
  `_headers` file with `Cache-Control: no-cache` (revalidate every load, a cheap
  304 when unchanged), and `npm run preview` serves through `dev-server.js`, which
  never lets a browser cache.
- **`eslint .` linted the built copy** and reported 78 false errors — the rules
  are keyed on paths like `ui/**`, which `dist/ui/...` does not match. `dist/**`
  is ignored now.

### Invite-only, and why it was removed

**THE SITE IS OPEN. Anyone with the link can play it, as of 2026-09-20.** It was
invite-only from 2026-09-12 to that day. This section is a record of what was
there and how to put it back, because a stranger playtest may want it again.

**Why it went.** Phase 0 of the critical-review programme needed three people
who had never seen the game to play it, and the sign-in stood between them and
the first screen: the tester had to be added to a list by hand, then wait for a
one-time code, sometimes in spam. That is a minute or three of friction and a
reason to give up, in front of the one measurement the project most needed. The
gate protected nothing the backend step will not have to protect properly
anyway — see *What tampering would cost*, which never claimed Access helped.

**Measured after removal**, not assumed: the front page, `ui/`, `ui/studio.css`
and `content/querySet.js` all answer `200` with no redirect.

```
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" \
  https://g-ads-simulation.manikhorocks.workers.dev/ui/
```

`200` and an empty redirect means open. A `302` to
`bitter-recipe-3091.cloudflareaccess.com` would mean it is back on. **Do not
test this in a private window** — Chrome shares one session across private tabs
and an Access session lasts 24 hours, so a signed-in browser reports "open"
when it is not. The curl is the check.

**Read the redirect target, not just the code.** `/ui/index.html` answers `307`
to `/ui/` on the same origin — that is the asset server canonicalising a
trailing slash and has nothing to do with Access. Only a redirect to
`cloudflareaccess.com` means the gate.

**What was there, if it has to come back:**

| piece | where it lived | value |
|---|---|---|
| Zero Trust organisation | Cloudflare One | plan **Zero Trust Free** (up to 50 people), team name `bitter-recipe-3091` — it is what the sign-in page's address showed, chosen by Cloudflare, renameable under Zero Trust → Settings |
| the rule | Zero Trust → Access controls → **Policies** | **Playtesters**: Allow, Include → **Emails** → exact addresses |
| where it applied | the Worker → **Access** tab | scope **All traffic** (production AND every preview), session 24 hours |

Adding a playtester was one edit and no deploy: add their address under Include
→ Emails → save. They opened the site, entered that address, and got a one-time
code by email.

**Three traps, kept because they cost time to find:**

- **Delete the APPLICATION, not the policy.** An Access application with no
  Allow policy denies everyone, including the owner, and from outside it is
  indistinguishable from the gate still being on — stricter, not looser. The
  reversible alternative is a policy with action **Bypass** and include
  **Everyone**, which leaves the record in place and lets all traffic through.
- **"Emails ending in" and the preset "Email domain"** admit a whole domain.
  With `gmail.com` that is every Gmail user alive. The rule used exact
  **Emails**.
- **The Access dialog's scope defaults to "Previews only"**, which protects the
  branch previews and leaves the main site public.

**What it changed about the "withheld" numbers, and what it did not.** While the
gate was on, `content/querySet.js` was readable by people on the list rather
than by anyone; signed-in players could always read it. It is now readable by
anyone with the link. The pool changed, not the exposure — **only a server
holding the numbers back changes that, and that is still the backend step.**

### Branch previews are public, and outlive their branch

**Measured 2026-09-20.** Every branch gets a preview at
`<branch>-g-ads-simulation.manikhorocks.workers.dev`, and with Access gone those
are open too. A subdomain with no deployment answers `404`, so a `200` there is
a real, playable copy of the game at a guessable address.

**Deleting the branch does NOT remove the preview.** `origin/makeover` was
deleted on 2026-09-20 and its preview went on serving `e312519` — a build from
2026-09-16 — afterwards.

**And it is NOT in the Deployments tab, which is where an hour went.** The
vocabulary is the trap. A **version** is a build of the Worker; a **deployment**
is a version made live on production, and the Deployments tab lists only those;
an **alias** is a readable label stuck on a version, and that is what
`makeover-…` is. It was never deployed, so it never appears there, and it
survived the branch because it was never attached to the branch. Cloudflare
files this under routing, not deployments: **Settings → Domains & Routes →
Preview URLs → Disable**, which turns previews off wholesale. Per Cloudflare's
documentation there is **no way to delete a single alias** — they persist until
a thousand newer ones push them out.

**AND DISABLING PREVIEW URLS DOES NOT RETIRE THE ALIASES ALREADY ISSUED
(measured 2026-09-25).** The setting above was turned off, with no branches left
in the repository at all — and `polish-…` and `makeover-…` both went on
answering `200`, each still serving its own old build (`7913880` and
`e312519`), through thirteen checks over six minutes. So it is not propagation
delay. Production was unaffected throughout.

**What that leaves, stated plainly because the next person will try the same
things:** deleting the branch does not remove the alias; the alias is not in
the Deployments tab; Cloudflare documents no way to delete one; and disabling
the feature appears to stop new ones without withdrawing old ones. **There may
be no way to take an issued alias down.** Anything left untried is in the
Worker's Deployments tab, looking for those two versions by name.

**It is PARKED, not fixed (2026-09-20, re-parked 2026-09-25)**, and that was a
judgement about proportion rather than a failure to try: the site is public
anyway so a public preview leaks nothing new, and the only real cost — a tester
playing a stale build — needs somebody to send them that link. Nobody will.
**The defence that works is the sentence below.** Two sessions have now gone at
this; a third would be spending real time on a thing whose whole cost is one
sentence of discipline.

**Why it matters for a playtest:** a tester sent a preview link plays a stale
build and reports defects that were fixed weeks ago. Send the bare
`g-ads-simulation.manikhorocks.workers.dev` address and nothing else.

### How it is shared, and why it is not a download

**DECIDED 2026-09-19: it ships as a LINK.** The owner asked whether to build a
Windows/Mac download instead; the answer after a feasibility check was no.

**A zip of `dist/` cannot work, and that is a fact rather than a preference.**
`ui/index.html` loads `<script type="module">`, and ES modules are blocked by
CORS from `file://` in every modern browser — a tester double-clicking
`index.html` gets a blank page. Anything that "just sends the folder" needs a
local server with it.

**Why the link wins.** A download freezes the build a tester is judging, which
is the opposite of what playtesting needs — nine defects were fixed in a single
session, each live in two minutes. A desktop app also excludes phones, and the
recorder exists partly for phone timings nobody has measured. And the friction
this argument was written against — Cloudflare Access's email code — **was
removed on 2026-09-20**, so the link now costs a tester one click and the
decision only got easier.

**What a desktop app would really cost:** there is no bundler and no packaging
setup here at all. Electron or Tauri means a new pipeline, per-OS builds (a Mac
build needs a Mac) and code signing, or testers meet SmartScreen and
"unidentified developer" warnings — around 100MB per platform to wrap 2.1MB.

**The middle option, not taken:** a PWA — manifest, icons, a service worker —
would make the link installable with an icon and offline play, keeping instant
updates and needing no store or signing. `scripts/build-site.js` already knows
the exact file list, so the cache manifest could generate itself. About half a
day. Raise it only if the icon is wanted.

### What tampering would cost, and what is worth doing about it

**Written 2026-09-20, because "how do I protect it" is a question that wastes a
week if it is not asked precisely.**

**THE BOUND FIRST: a single-player browser game cannot be protected from its own
player.** The engine runs on their machine, so a breakpoint in the developer
tools edits any number mid-run. Obfuscation, minification and a checksum in the
page are all defeated by the same breakpoint. Nothing in this section tries to
beat that, and anything proposed later that does is theatre.

The useful question is which kinds of tampering would actually cost something.
Four would, and they want very different answers.

| what | what it costs | what stops it | worth spending? |
|---|---|---|---|
| **the answer key read in devtools** | the whole lesson | only a server | later — it is the backend step |
| **the deployment written to by someone else** | every player at once | 2FA, branch protection, token scope | **yes, and it is an hour** |
| **a player editing their own save** | nothing but their own learning | already tamper-EVIDENT, by accident | no |
| **a forged playtest file** | one bad finding | the replay check, partly | no |

**1. The answer key is the one that damages the teaching.**
`content/querySet.js` carries `priceAffinity`, `purposeAffinity`,
`convMultiplier`, `valueMultiplier`, `returnRateMultiplier`, `tags` and
`isHeadTerm`. Spec 16.1 withholds all seven from every controller *including the
one the affinity favours*, because the learning loop IS "guess which searches are
yours, see what came back, revise". With that table open there is nothing left to
infer. `getPublicView` strips them at the API boundary, which is right and buys
nothing against reading the file — the engine runs in the browser, so the browser
must be handed them. `scripts/build-site.js` has said so since it was written
(*WHAT IT DOES NOT HIDE*). **There is no clever partial fix. Do not look for
one.** The mitigation that actually applies is the audience: a true beginner does
not open devtools, and whoever does has chosen to skip the lesson.

**That mitigation got weaker on 2026-09-20**, when Access was removed and the
audience stopped being a named list and became anyone with the link
(*Invite-only, and why it was removed*). The row above is unchanged by it — it
already said only a server stops this, and Access never did — but the pool is
larger now, which is one more argument for the backend step once the teaching
is known to work.

**2. The deployment is where the cheap, real wins are.** A push to `main`
publishes to everyone holding the link, so anything that can write to `main` can
publish. Worth an hour, in this order: **2FA on GitHub and Cloudflare** (this is
the whole game — an account takeover makes everything below a rounding error),
**branch protection on `main`**, and **checking the Cloudflare build's repo
permission is scoped to this repo** rather than the account. There is no
`.github/workflows`; Cloudflare builds from the repository directly, so that
permission is the credential.

Two guards already do real work here and should not be quietly removed: `npm run
ci` gates every deploy on lint and the whole suite, and `tests/build.test.js`
holds `dist/` to exactly the files the game loads, so a build that tried to
publish the repository or slip a file in fails before it ships.

**3. A player cheating their own save is already tamper-evident, by accident —
and this is the one people reach for first.** The save is not a scoreboard with a
money field to raise: `makeSave` (`ui/save.js`) stores the state before week 1
plus the decision log, and the game replays it, so forging a richer game means
writing a decision log that genuinely earns it. `restoreSave` then compares
`fingerprintOf(reports, playerId)` — cost and clicks per week — against what was
recorded, and `scripts/read-playtest.js` prints `THE REPLAY DOES NOT MATCH` when
it disagrees. **That check was built for version drift and works as tamper
evidence; keep it in mind before building a second one.** Its limit: it proves
the decisions produced the figures, not that a human made them.

**4. A forged playtest file is not the failure mode this project has.** The
replay check above catches an edited decision log but not forged timings or
forged answers, which are the data worth having. The actual failure so far is the
opposite: two testers, neither sent a file (*Running a playtest* below).

**WHAT TIES IT TO EVERYTHING ELSE: three things in the queue want the same one
thing.** Withholding the answer key wants a server; `llmPolicy` rivals want a
server; cross-device saves want a server. That makes the backend the single
unlock rather than one feature among several — worth knowing when it is next
weighed against something else.

**AND THE COUNTERWEIGHT, which is why nothing here is being built yet.** No
tester has finished a game. A server that protects a lesson nobody has reached is
the wrong build this month. The split taken on 2026-09-20 was: do the deployment
hygiene, write this section, and leave the backend where it is until a beginner
has played twelve weeks and said what it taught them.

### Running a playtest

**The recorder is in the game and switched on only by the link.** Send
`https://g-ads-simulation.manikhorocks.workers.dev/ui/?playtest=1`. The browser
remembers it, so a reload stays in playtest mode; `?playtest=0` turns it off.
Anyone on the plain link runs the game exactly as before.

**What it records** (`ui/recorder.js`), in the player's own browser storage, and
nothing is sent anywhere by the page:
- time on each screen, with a hidden tab and two minutes without input taken
  off, because the gate for stage C is written in active time;
- clicks, named by card and control ("Search terms › Last week");
- keystroke counts, never the keys;
- how long each card was on screen;
- page loads;
- how long each week took to compute on their device, which is the phone and
  live-site timing nobody has measured.

**What the player does.** They play. A *Send playtest file* button in the header
downloads the file at any point, so someone who gives up can still send what
they did. After the end screen, a panel asks what three things the game taught
them and what confused them, then offers the same file. They send it back by
email or WhatsApp. It is about 280 KB and holds their save, so their whole game
can be replayed.

**RUN ON THE LIVE SITE, decided with the owner 2026-09-13.** The plan was the
`playtest-1` tag (`f725dda`), the game before stage C, as a "before". Since then
the field guide, the debrief, the capital card, C8, the week-9 line and more
have gone live, and stage D's gate, strangers stating three lessons in their own
words, can only be tested with the debrief in the game. Stage C's gates are
absolute (round 0 under 10 active minutes, weeks 5–12 over 72 seconds), not a
comparison, so the live game measures them as well. `playtest-1` stays, for a
before-and-after later if one is wanted.

**When the invites go out:**
1. **Tag the live version the same day,** so the files can be read on the engine
   they were played on. Five are used: `playtest-1` (`f725dda`, 2026-09-12),
   `playtest-2` (`387baf1`, 2026-09-13, the classic game), `playtest-3`
   (`e312519`, 2026-09-16, the Studio's first live version, tagged when the
   invite was rewritten), `playtest-4` (`368801d`, 2026-09-18, the build the
   first stranger playtests ran on) and `playtest-5` (`a7266a2`, 2026-09-19).
   `live-before-studio` is the last version the site served before the Studio.
   **So the next one is `playtest-6`:**

   ```
   git tag playtest-6
   git push origin playtest-6
   ```

   **Read the tag list rather than this sentence** — `git tag -l "playtest-*" |
   sort -V` is one command and cannot go stale. This step named `playtest-5` as
   the next tag for a day after `playtest-5` had been created, which would have
   sent whoever followed it into a tag that already existed.

   Then keep engine changes off `main` until the files are back. Words and
   docs are safe; anything that moves a number in a played week is not.

   Since the switch-over (2026-09-16) a playtest file also NAMES the build each
   of its loads ran on (`ui/version.js`), so a game that spans a deploy says so
   in the file itself and `scripts/read-playtest.js` prints the versions. The
   tag still matters — it is how you get that build back to read the file on.
2. Send `https://g-ads-simulation.manikhorocks.workers.dev/ui/?playtest=1` with
   the message below. **Nothing has to be set up first** — since 2026-09-20 the
   link is all a tester needs. Send that address and no other: a branch preview
   is public too and serves a stale build (*Branch previews are public*).
3. **Read the files on the tag if `main` has moved.** A save replays exactly only
   on the engine it was played on. The reader says so when it does not (`THE
   REPLAY DOES NOT MATCH`), and the fix is `git checkout playtest-2` and reading
   it again.

**The invite** (fill in the name).

**The last step was rewritten on 2026-09-19 and the reason matters.** It used to
say the Playtest button "saves the same file straight away". Since the mid-game
questions it does not — it asks the two questions first, which is the entire
point of that change: the people worth hearing from are the ones who stop, and
the old build asked them nothing. An invite describing the old behaviour would
have walked a quitting tester straight past the questions. It also now says how
to reach the button on a phone, where the rail is behind the ☰ menu. It was
step 5 until 2026-09-20, when the sign-in step went and everything moved up one.

> Hi *name*, I've built a small game that simulates running Google search ads
> for an Indian activewear brand, and I'd love you to play one game of it. It
> takes about 45 minutes, and you can stop whenever you like.
>
> 1. Open https://g-ads-simulation.manikhorocks.workers.dev/ui/?playtest=1
>    — there is no sign-up and nothing to install.
> 2. Play it the way you would on your own. There is no right answer, and you
>    don't need to read everything.
> 3. When you finish, the last thing on the results is **Before you go**: two
>    questions about what the game taught you and what confused you, and a
>    **Download the playtest file** button under them. A few words is plenty.
>    Send me the file it saves.
> 4. If you give up partway, that is useful too, and I would rather have that
>    than nothing. Press **Playtest** at the bottom of the strip down the left
>    — on a phone, tap the ☰ menu at the top first. It asks you the same two
>    questions, then saves the file. Send me that. Even one line is plenty.
>
> The file holds how long you spent on each screen, what you clicked, your
> browser and screen size, and your game, so I can replay it. It never records
> what you type, apart from your answers to those two questions. Thank you!

**Reading the files:** `node scripts/read-playtest.js playtest-*.json`. It gives
active time for round 0, weeks 1-4, weeks 5-11 and the end screen (the groups
of the one recorded human game, *What playing it as a learner found*), every
screen in order, cards by time on screen, week compute times, rank and
contribution replayed from their save, the weeks in the red, the weeks they
decided something (with how many of weeks 7–12, stage D's gate, and the week-5
capital card marked when it was left alone), and their answers.

It counts clicks per screen; it does not list them. What was clicked, named by
card or region and control, is in the file's `recording.clicks`, each with its
`where`: read those directly when the names matter. In the Studio's round 0 the
regions are *Round 0 steps*, *Tray*, each step by name, and the planner drawer
(*Add keywords*); a control with no text, such as a guess cell, is named by its
label for screen readers.

**For the one played on a call,** use the same link and record the call
yourself. Watching changes how people read, so its timings are not pooled with
the other two; it is there for the *why*.

**What the recorder cannot see:** whether they read a card or only had it on
screen, and anything outside the tab. One testing trap: an automation tool's
"type" inserts text without key events, so its typing counts as 0 keys. A
person typing does fire them; press real keys to test the count.

**Found while testing it, and fixed before any stranger played:** week 1 opened
at the foot of the dashboard, 6,409px down a 7,171px page, because the browser
kept round 0's scroll position when the page was replaced. The recorder found
it by timing "Budget" and "The market" in week 1 before anything was scrolled.
`begin()` now scrolls to the top once the first week has run.

### Deploys, from here on

Every push to `main` that passes `npm run ci` goes live on its own, every branch
gets a preview (**public since 2026-09-20, and it outlives the branch** — see
*Branch previews are public*), and any earlier version can be restored from
the Worker's **Deployments** tab. The first build with the tests on took 5m49s,
4m54s of it the suite — one replay test takes 12 seconds on Cloudflare's machine,
which is why `ci` sets a 60-second timeout.

**Tell playtesters one thing**: the game is saved in their own browser after
every week, so a reload offers it back, but a different browser or device starts
fresh. There used to be a second — that the sign-in code arrives by email from
Cloudflare, sometimes in spam — and it went with the sign-in on 2026-09-20.

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

- **When a measurement agrees with what you expected, check what it actually
  ran.** This is the one that has caught the most here, and every instance
  produced numbers that looked entirely reasonable: `policyId` had a function
  built to read it and no reader, so every rival stood still; invariant I3 could
  not see the budget it was supposed to bound; a landing-page claim had one seed
  standing in for seventy-two; eight rivals had nothing checking they were
  alive; and a harness written to ask "did the screens go quiet" answered *yes*
  by reading a `.note` field that six of the seven functions do not have. The
  last one would have confirmed a player's own words with a fabricated
  measurement, and it looked right BECAUSE it agreed with them.
  **The fourth was found by a SCREEN, not a test** — by putting nine rows in one
  table where a human could see that one row was zeros. `JOURNAL.md` has all
  five as they were found.
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
- **The pure part of a screen belongs outside the render function**, and for the
  arithmetic it is. Everything in `decisions.js` and `ending.js` that can be
  wrong silently — the diff, the preview, the month arithmetic, the reading-back
  of `decisionLog` — is an exported function with tests, and only the drawing
  needs a browser.
- **BUT THE WORDING IS NOT, FOR SIX OF THE SEVEN PROMPTING CARDS, and that is
  where this project's defects actually live.** Only `locationOutlook` composes
  its own note; the other six return DATA and the sentence is assembled inside
  the render function, so it is neither unit-tested nor readable without a
  browser. The "correct and unhelpful" defect class is entirely a wording class
  — a screen that says something true and useless, or true and unreadable — so
  the half that is hardest to test is the half that breaks. This was found by a
  harness that tried to read notes that were not there (see *Writing a
  measurement harness*), and it is recorded as an open defect rather than a
  finished design.
- **A key the form's context lacks is not an error, and a fallback hides it.**
  The prepaid card read `ctx.history` and `ctx.playerId`, which the dashboard
  never set, and `?? []` turned the gap into "no weeks played": every account
  read the towns' refusal rate from the day the card shipped (2026-09-10) until
  2026-09-15, in a card that had already crashed once over a third missing key,
  `ctx.price` (I34). The context's data half is now `formContext(game)` in
  `ui/dashboard.js`, built without a page, so a card's figures can be tested
  through the context the screen really hands it, as `tests/dashboard.test.js`
  does for `prepaidReading`. A card that reads a new key deserves the same
  test. And the context carries the player's own rows, never `state.history`,
  which holds all nine advertisers' reports.
- **Calling one engine function is not asking the engine.** The prepaid card
  imported `refusalRateFor`, so it named no constant and passed
  `tests/ui.test.js`, and it still worked out only part of what the round does:
  no order confirmation, purpose or place gradient, up to 4.3 points high once
  order confirmation was live (I34, 2026-09-15). A figure a card shows should
  come from a function the round itself calls — here `refusalOutlook`, which
  shares `returnHalves` with `round.js` — and its test should hold it against
  what the round BOOKED through the report, not against the function the card
  calls.
- **A class name is not a colour.** The search terms report's returns mark
  (I32) gave a figure the class `bad` from 2026-09-10, and no rule in
  `ui/style.css` styled it, so the mark was hover text on an ordinary figure
  until 2026-09-15. It was found only because a second mark was meant to match
  it. When checking a mark in the browser, read its computed colour
  (`getComputedStyle`), not its class list.
- **A report is rewritten for five weeks, by whoever the account is by then.**
  `reviseReports` is handed THIS round's advertisers while it edits earlier
  reports, so anything it works out from the advertiser rather than adding up
  from the orders describes the account as it is now, not as the week was sold.
  The cash share on each place row was worked out that way, and a week-5 price
  move rewrote four weeks of it (I34, 2026-09-15); it is now recorded once, when
  the week's report is built. Anything a report carries that is not a sum of
  orders belongs in `buildRoundReport`, or on the order itself, as `valuePaise`
  and `returnRate` are (11.3). The margin (F18) and the keyword a late sale is
  credited to (I36) were the same fault, fixed the same way; CLAUDE.md carries
  it as a known trap.
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
