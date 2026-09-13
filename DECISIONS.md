# DECISIONS.md

The honesty ledger. Every place this simulation departs from real Google Ads, what
the departure is, and why.

Its purpose: when you use this simulator to learn, you must be able to tell the
difference between **how Google Ads works** and **how this model works**. Without
this file you will eventually mistake a simplification for a fact.

**Status key**
`FIXED` resolved in spec v0.3 · `OPEN` known gap, not yet addressed ·
`WONTFIX` deliberate permanent simplification · `CALIBRATE` provisional, governed
by an invariant in spec 18.2

---

## A. Quality Score

### A1. Reported Quality Score is not an auction input — `FIXED v0.2`
**Real:** Google states plainly that Quality Score is not an input in the ad
auction; it is a diagnostic tool. What *does* enter the auction are real-time
quality signals computed per individual query, using context the report never
shows. Those signals sit in the denominator of the actual CPC calculation.

**Sim:** split into `qualitySignal` (continuous, per-query, in the auction) and
`reportedScore` (1–10, lagging, output only, never read by the engine).

**The line to hold onto:** quality *is* in the auction; the number on your screen
is not that number.

### A2. Components are three-level, not 1–10 — `FIXED v0.2`
**Real:** expected CTR, ad relevance and landing page experience are reported only
as below average / average / above average. The 1–10 scale exists solely at the
overall keyword level.

**Sim:** `reportedScore` returns three-level ratings only. The 1–10 score is
derived from them via `RATING_TO_SCORE_TABLE`, which is invented.

### A3. Component weights were invented, and then deleted — `FIXED v0.3`
**Real:** Google publishes no formula and no weights.

**Sim v0.2:** `QUALITY_WEIGHTS = { 0.5, 0.3, 0.2 }`, tagged `ESTIMATED` and
defended at length in this file.

**Sim v0.3:** **deleted.** The v0.2 audit found the constant was an orphan — the
`qualitySignal` formula is purely multiplicative and nothing read the weights, in
the auction or in the reported score. A constant nothing consumes is how a spec
starts lying. If a weighted formula is ever wanted, it has to be written into
spec 9.1 first.

**The ordering argument in A4 survives. The numbers were never real.**

### A4. Why expected CTR plausibly leads — *this part is real theory*
Google's expected revenue from an impression is price × probability of click.
Ranking by bid × predicted CTR is the arrangement that maximises revenue per
search. So click probability belongs in the rank multiplier for a hard economic
reason, not a user-experience one.

Ad relevance and landing page experience protect long-run user trust, which does
not appear in single-impression revenue. That is a principled reason to expect them
to weigh less — and it yields no number.

This is why `baseCtr` (driven by expected CTR) is the base term in spec 9.1 while
relevance and landing page are narrower multipliers around it. The *shape* has a
basis. The exact ranges do not.

### A5. Quality Score is backward-looking and exact-match based — `FIXED v0.3`
**Real:** calculated from roughly 90 days of history on exact searches of your
keyword, relative to other advertisers who appeared for the same search.
Consequence: **changing match types alone will not move Quality Score.**

**Sim:** 13-round trailing window; **only impressions where the query text
literally equals the keyword text** (spec 9.3). Not "impressions via an
exact-match keyword" — the literal reading, which is what Google's wording means.

**Consequence we had to design around:** in a fixed 150-query set, a player's
keyword might never literally appear as a query, and would then show no Quality
Score forever. So spec 7.4 requires at least three "head term" queries per grid
cell — short strings a player would plausibly type as a keyword. Without them the
entire §9.3 diagnostic is dead weight.

Running the real set through `matching.js` proved the point: an exact-match
keyword on `gym leggings`, the most obvious search in this market, caught
**nothing**, because every query in the set carried a modifier. Two head terms
were rewritten to their bare canonical form and a test now guards it.

**The trailing window excludes the current round.** The spec says "trailing
window of `QUALITY_WINDOW_ROUNDS`" without saying whether the round in progress
counts, and the answer decides whether the CLAUDE.md trap holds at all.

It is computed from completed prior rounds only. Nothing a player does this
round can move the number they are looking at: improving ad copy lifts
`qualitySignal` in the very next auction while `reportedScore` sits unchanged.
That is exactly the lag that makes Quality Score confusing in a real account.
Including the current round would let the two move together, and the split
would quietly stop teaching anything.

### A6. Landing page ratings are compressed — `OPEN`
`landingFactor` spans 0.85–1.05. **"Above average" on landing page is reachable
but narrow, and "below average" likewise** — this entry's original conclusion,
which was correct, and which a later pass wrongly overturned. See I1 for that
history.

**The basis has been corrected.** This entry used to reason from `max / min`
≈ 1.235 against a threshold of 1.10. That is the wrong quantity: `rate()`
compares an advertiser to an impression-weighted **field average**, never to the
worst possible advertiser. `tests/constants.test.js` made the same mistake and
passed for it.

**The right quantity, measured over 720 games** (12 seeds × 6 cells × 10 grades,
`mode: 'expected'`, 8 rounds, 411 contested keywords per grade):

| grade | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| `below` % | 88.6 | 60.8 | 21.2 | 5.6 | 0 | 0 | 0 | 0 | 0 | 0 |
| `above` % | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3.4 | 20.2 |

The realised field landing factor over those keywords: min 0.9167, p25 0.9611,
median 0.9760, p75 0.9909, max 1.0333.

**The compression is a flat MIDDLE, not a pinned scale.** Grades 5 to 8 produce
identical output — 411 of 411 `average` at every one of the four — because the
factor range is ±10% around its midpoint and the `average` band is also ±10%, so
the band is as wide as the whole range. At the median field the reachable ratio
runs 0.871 to 1.076: `above` therefore requires a **below-median field**, and
`below` requires a grade of 4 or less. The modal account walks
`bb--------` — below at grades 1–2, average from 3 to 10, never above — in 33 of
72 (seed, cell) pairs.

The remedy stands as direction: if the range is widened it is the range that
moves, not the threshold, because the threshold is what makes the three
components comparable to each other. **But 9.4 measures what widening costs** —
it breaks 17.1's open cell in both directions tried — so this stays `OPEN` and
the interface compensates instead (I1).

### A7. The broad-match quality penalty is half the size the range implies — `OPEN`
`queryKeywordFit` is specified as spanning 0.50–1.15, scaled by how much of a
keyword's tag set the query carries. Building `matching.js` showed the bottom
half of that range is structurally unreachable **for the match type it exists
to penalise**.

Broad match fires at `BROAD_MATCH_MIN_OVERLAP` (0.50) or above. An overlap of
exactly 0.50 maps to a fit of 0.825. So no broad match can ever score below
0.825 — anything that would have has already failed to match.

The effective penalty is therefore **0.825 to 1.15, a 28% swing in ad rank**,
not the 57% the stated range suggests. Measured against the real query set, a
broad `gym leggings` keyword reaches fits between 0.825 and 1.150 exactly.

28% is still a real penalty and the lesson survives. But the two constants are
**coupled and cannot be tuned independently**: lowering the overlap threshold
widens the reachable fit range *and* makes broad match catch more traffic at
the same time. Worth knowing before calibration starts reaching for either one.

The floor of 0.50 is reachable only by an exact or phrase keyword whose tags
happen not to overlap the query's — which in practice means the tagger tagged
the keyword differently from the query, and is rare.

### A8. An ungraded ad cannot clear the reserve — `OPEN`
Spec 9.5 says an ungraded ad uses `DEFAULT_UNGRADED_QUALITY` (3/3/3) and is
"deliberately poor: an ad nobody has evaluated should not perform like a good
one". Building round 0 showed that at the current constants it does not perform
*at all*.

3/3/3 gives a quality signal of **0.031**, so clearing `AD_RANK_FLOOR` of 60
takes a bid of **1,961 paise**. A cold-start `disciplined` advertiser, reasoning
from `ASSUMED_CONV_RATE`, bids about **1,512**. It is not outbid — it is below
the reserve, enters every auction and shows in none.

| bid | ad rank | impressions | lost to rank |
|---|---|---|---|
| 1,512 | 46 | 0 | 100% |
| 1,800 | 55 | 0 | 100% |
| 1,961 | 60 | 18,436 | 45% |
| 2,400 | 73 | 25,445 | 24% |

**"Should not perform like a good one" and "cannot enter" are different
claims**, and two `INVENTED` constants — `DEFAULT_UNGRADED_QUALITY` and
`AD_RANK_FLOOR` — happen to sit either side of the line. Neither was chosen with
the other in mind.

**Left as it is for now, because it is fully diagnosed.** The advertiser sees
100% lost to rank and an `ungraded_ad` warning naming the cause, which is a
complete explanation and an obvious remedy: get the ad graded, or pay a premium
to be seen without one. That is a defensible lesson rather than a dead end.

It became diagnosed only during this work — the warning was raised inside the
*shown* branch of `recordAuction`, so the advertiser it most concerned was the
only one who never received it. Fixed, and pinned by three tests.

**What would change the answer:** if play shows people abandoning the game at
round 1 rather than reading the warning, raise `DEFAULT_UNGRADED_QUALITY` to
4/4/4, which clears the reserve at a cautious bid. Do not lower `AD_RANK_FLOOR`
— it is calibrated against I2 and I3 and moving it is regressive (F12).

The real fix is `agents/grader.js`. Spec 17 lists "grade + tag player assets" as
step 12 of round 0, so a graded player was always the intended state; this entry
describes what happens before that module exists.

---

**Resolved for the player.** `agents/grader.js` exists, and round 0 now grades
the player's copy at step 12 rather than leaving `gradedQuality` null. It grades
offline by default, so this holds with no API key and no network.

| the player writes | grade | impressions |
|---|---|---|
| three generic headlines | 4 / 3 / 3 | 18,579 |
| specific, benefit-led copy | 8 / 4 / 8 | 26,349 |

Writing better copy is now worth 42% more traffic, which is the incentive 9.5
was reaching for and could not deliver while the only alternative to a good ad
was one that could not enter the auction.

**The interaction stays on this list**, because nothing about the constants
changed. An advertiser who somehow reaches round 1 ungraded is still below the
reserve, and `DEFAULT_UNGRADED_QUALITY` and `AD_RANK_FLOOR` still sit either
side of a line neither was chosen with reference to. What changed is that
nothing routes a player there any more.

---

**F14 LOWERED `AD_RANK_FLOOR` FROM 60 TO 48, and that is not a breach of the
line above.** "Do not lower it" was advice against lowering the reserve *to
rescue an ungraded ad*, on the grounds that it is calibrated against I2 and I3.
F14 lowered it for a different reason and re-calibrated it against those same
invariants: raising returns to the sourced level cut every ceiling by 20-30%, a
fixed reserve became a quarter stricter relative to all of them, and the weakest
rival ads fell under it. The floor followed the ceilings, and I1, I2 and I3 all
pass at the new value.

**The gap this entry describes is unchanged by it**, which is the check that
matters. A cold-start `disciplined` bid fell by a fifth too — it now assumes
the briefing's two in five, not a quarter — so an ungraded 3/3/3 ad still sits
just under the reserve at a cautious bid. The floor and the bids moved together;
the line between them did not.

### A9. A brand owner's advantage on its own name is emergent, not modelled — `OPEN` (2026-09-12)

**What the model does.** Click-through is the quality signal × the position
factor (`round.js`), and the signal comes from grades, keyword fit, relevance
and landing page. **Nothing in it knows whose name a brand search is.**
`RELEVANCE_INTENT_MULTIPLIERS.brand` is 1.0 for everyone, so an owner and a
poacher with the same grades get the same click-through on the owner's name.
Ownership changes only conversion: 2.5× for the owner, 0.25× for a poacher
(12.1, `attribution.js`).

**The SLC review said this made brand traffic dearer than generic.** That was
**one game**, where the player's generic searches sat at the reserve price.
**Measured properly it is largely wrong**, and this entry corrects it.

**Measured.** 72 markets: seeds 1–12 × the player in each of the six cells. The
harness is recorded under F15. The player defends its own name on exact at
1.2× realised break-even:

| player, 72 markets | click-through | cost per click | conversion |
|---|---|---|---|
| on its own name | 11.0% | ₹10.3 | 8.2% |
| on its generic searches | 7.2% | ₹17.5 | 6.2% |
| ratio | 1.52× | 0.59× | 1.32× |

It keeps 66% of the clicks on its name, and poachers take the other 34%, at
4.8% click-through and ₹6.3 a click. **So defending your name IS the cheaper,
higher-click traffic in play, as the briefing says.** The advantage comes from
thin competition and the owner's higher bid, not from searchers preferring the
brand they typed.

**Against benchmarks (weak ones, stated as such).**
- The only measured brand/non-brand split found is 53 B2B-software accounts,
  July 2025–June 2026 (PipeRocket): brand 22.21% click-through against 3.60%,
  **about 6×**, and $3.12 a click against $13.75, **about 0.23×**.
- Agency guidance agrees on the direction: brand 10–20%+, non-brand 2–5%.
- No apparel or Indian brand split was found.

So the direction is right and the size is probably understated: 1.5× where the
evidence suggests several times, and 0.59× where it suggests about a quarter.

**Two things the measurement found that nothing recorded.**
1. **Five of the six rival characters never bid on their own name.** Across the
   648 owner/brand pairs, the owner never appeared on its own name in 486 (75%).
   Only the player, `brandDefender` and sometimes `cautious` defend. So the market
   shows a learner rivals who leave their names to `brandDefender`. Real brands
   of any size usually defend.
2. **A poacher pays no quality penalty.** Real ones typically do: lower
   relevance, lower expected click-through. Here, a poacher bidding what the
   owner bids would get the owner's click-through.

**Options, none taken:**
- **(a) Leave it.** The lesson "defend your name, it is cheap" already lands.
- **(b) Model searcher preference.** An owner advantage on relevance or
  click-through on its own brand search, and a poacher penalty. That is an
  engine change; it moves calibration and needs a sourced size, and the evidence
  here is B2B software.
- **(c) Have more rival characters defend their names.** That is a policy change
  (C7) with no market physics.

Decide after stranger playtests show whether brand behaviour is noticed at all.

**Sources:**
- PipeRocket, B2B software benchmarks: https://piperocket.digital/research/google-ads-benchmarks/
- ClickMinded, direction only: https://www.clickminded.com/google-ads-benchmarks/

---

## B. Auction and pricing

### B1. Ad rank threshold is a constant — `CALIBRATE`
**Real:** thresholds vary by query, context and position. This is why CPCs
sometimes jump with no visible cause.
**Sim:** `AD_RANK_FLOOR`, one number, provisional. Governed by invariant I2: median
CPC must stay below the Value tier's net break-even, or the cheapest position
becomes unplayable and the grid collapses to two tiers.

### B2. Extensions were a flat multiplier, and are now absent — `FIXED v0.3`
**Sim v0.2:** `EXTENSIONS_IMPACT = 0.1`, applied uniformly.

**Sim v0.3:** **deleted.** Like `QUALITY_WEIGHTS`, it was an orphan — there was no
`extensions` field anywhere in the schema and no term for it in any formula. It was
a number defended in this file that the engine could not have read.

Extensions are real and do matter. They are now an honest omission (spec 20) rather
than a fictional one.

### B3. Position CTR multipliers are estimates — `OPEN`
**Sim:** `[1, 0.62, 0.42, 0.30]`, now `MAX_SLOTS` long. Directionally sound, not
sourced.

### B4. Slot count — `REOPENED and CHANGED in v0.3`
**Real:** varies by query and device; sometimes zero ads show.

**Sim v0.2:** 7 slots, marked `WONTFIX`.

**Sim v0.3:** **4 slots, 3 above organic.** With nine advertisers and seven slots,
every entrant clearing the floor always showed, so `lostToRank` collapsed to
"below the floor" and half the impression-share lesson died. Four slots is also
closer to a real SERP than seven ever was.

The payoff is that **rank competition became emergent**: disciplined play keeps
auctions thin, and the moment anyone broadens their match types, auctions crowd and
people start missing out. Nobody has to be told that; they watch it happen.

### B5. Second price prices against the entrant below, shown or not — `FIXED v0.3`
**Sim v0.2 and the v0.1 prototype:** the last *shown* advertiser priced against the
ad rank floor.

**Wrong.** With four slots and nine advertisers, the entrant in position 5 is
usually well above the floor. Pricing position 4 against the floor undercharges it
exactly when the field is deep, which is when it should be expensive. v0.3 prices
against the first entrant below you regardless of whether they were shown, and
falls back to the floor only when nobody is below you at all.

**A second correction, found while building `auction.js`.** Spec 10.2 as written
would let a *below-floor* rival sitting beneath you set your price. That inverts
the mechanic: adding a weak competitor would **lower** your cost beneath the
reserve, so a deeper field would be cheaper than a thin one.

The floor is a reserve price, not merely an eligibility gate. You always pay at
least enough to clear it, so `beatRank` is the greater of the rank below you and
`AD_RANK_FLOOR`. Neither half of this is stated outright in the spec; both are
now enforced and tested.

**And one thing worth recording because it looks like a bug and is not.** The
`min(bid, price)` cap almost never binds. Clearing the floor means
`bid x qs >= floor`, so `bid >= floor/qs`, while the price is `ceil(floor/qs) + 1`
— at most two paise more. Anyone who qualifies to show can essentially always
afford the price *by construction*, and the same argument holds against a live
rival, since outranking them implies you can outbid them. So the cap guards the
rounding increment rather than expressing an economic constraint. It stays,
because that rounding edge is real, and it is tested at the exact bid where it
bites.

### B6. The SERP contains only ads — `WONTFIX`
**Real:** shopping carousels, local packs, AI overviews and organic results compete
for the same attention and change effective CTR.

### B7. The minimum bid increment is invented — `OPEN`
`MIN_INCREMENT_PAISE = 1`. Google does not publish how it computes the increment
that beats the advertiser below you. One paise is the smallest unit available and
is as good a guess as any.

---

## C. Competitors and information

### C1. Competitors never react — `FIXED v0.2`
**Sim v0.1:** static bids forever.
**Sim v0.3:** eight rivals, full `Advertiser` objects with per-round decisions —
six rule-based policies and two Claude-backed.

### C2. Ad copy graded in isolation — `OPEN`
**Real:** expected CTR is relative to the other ads actually in the auction.
**Sim:** the grader sees one ad at a time. Spec 8.7 requires it to know about rival
trademarks, which pulls in the same direction. Candidate for v0.4.

### C3. Information asymmetry — `FIXED v0.3`
**Real:** Auction Insights names competitors by domain and gives six metrics. Ads
Transparency Center makes their creative public. Keyword Planner makes query text
and search volume public. Bids, budgets, costs, quality and conversions are never
visible.

**Sim v0.3:** `getPublicView` enforces exactly this split, and R3a makes it
architectural: **a controller receives its own report plus `getPublicView` output,
and never `GameState`.** You cannot prove a controller ignored a field it was
handed, so the only real enforcement is never handing it over. This matters most
for the two Claude-backed rivals, where it would be trivially easy to put the whole
state into a prompt and quietly destroy the entire information model.

**Trap preserved deliberately:** overlap rate is not market share and is not a
measure of spend. It is the most misread number in the report.

### C4. Query affinity is hidden from everyone, including its beneficiary — `FIXED v0.3`
`getPublicView` exposes query text, volume share and intent. It withholds
`priceAffinity`, `purposeAffinity`, `convMultiplier`, `valueMultiplier`,
`returnRateMultiplier` and `tags` — from *every* viewer, including the advertiser
whose position a query happens to favour.

That is the line between Keyword Planner (public research) and knowing how well a
query converts for you (earned by running it). A real advertiser can see that
50,000 people search "cheap gym leggings"; they cannot see what those people do
after clicking someone else's ad.

### C5. Rival positions are inferable, never stated — `FIXED v0.3`
Round 0 shows all eight rivals' ad copy, unordered. Position must be read off the
copy, and later confirmed through Auction Insights overlap.

**This makes rival ad copy load-bearing content.** If the eight ads read
generically, the player can infer nothing and the round 0 mechanic collapses into
guessing. Ads must be hand-authored per cell so a careful reader can tell
"₹899, flat 50% off" from "seamless compression, four-way stretch".

---

### C6. Brand identities are pre-decided and deliberately meaningless — `FIXED v0.3`
**Real:** an advertiser names its own brand, and the name usually carries some
signal — "Decathlon" and "Lululemon" do not read alike.

**Sim v0.3:** nine identities are authored once in `content/brands.js` and
frozen. The player takes one at round 0; the other eight go to the rivals.

Two problems forced this, both found while building the query set validator.

**The player could not have had a brand query.** Spec 17 loads and validates
the query set at step 1, but the player named their brand at step 7. At
validation time the player did not exist, yet 7.4 requires a brand query for
all nine advertisers. As written those rules could not both hold. Pre-deciding
the roster puts all nine brand queries in the frozen set, and removes the
name-uniqueness check entirely — names cannot collide when they come from one
list. It also dissolves the last of the round 0 circular dependency, since the
roster is now complete before anything is generated.

**Names had to stop signalling position.** Rival placement is seeded per game,
so a name carrying a price or purpose signal would eventually land in a cell
that contradicts it. This is not a cosmetic problem: 17.1 makes position
*inferable from ad copy*, so a name pulling the other way actively degrades the
inference the round 0 decision depends on. The v0.1 prototype's "BudgetBox" is
exactly the failure mode, and `tests/brands.test.js` now refuses any name
containing a price or purpose word.

**So position is signalled entirely through ad copy**, authored per cell. That
is the honest place for it — a brand is not premium because of its name. It is
also true of most real D2C labels, which are coined words chosen to be
memorable rather than descriptive.

**What is lost:** the player picks a name from nine rather than typing their
own. At the most overloaded moment of the game that is arguably a gain, but it
is a real reduction in expression and is recorded as such.

### C7. A policy's numbers live with the policy, not in `constants.js` — `OPEN`
Hard rule 7 sends every unsourced number to `constants.js` with a provenance tag.
`agents/policies.js` has eight of its own — an assumed return rate, an assumed
conversion rate, a margin of safety, a maximum bid move — and none are there.

**Because `constants.js` is the physics of the market and these are one
competitor's opinions about how to play it.** If a rival's aggression lived in
the file the engine reads, tuning a policy would move the market itself, and a
change meant to make one competitor bolder would quietly change what every
advertiser can afford. The two have to be separable or neither can be tuned
safely.

They keep the spirit of the rule: each is named, commented with what it means and
why that value, and grouped at the top of the file rather than inlined where it
is used. Every number is still findable in one place — just a different place,
chosen so that strategy and physics do not share a blast radius.

**The tell that this is the right line:** `ASSUMED_RETURN_RATE` is 0.40 because
that is what the round 0 briefing tells the player (17.2), and it is *wrong* for
every cell on the grid — Value-Lifestyle really returns 46.5%, Premium-Performance
36%. A number that is deliberately wrong has no business in the file that defines
what is true. (It was 0.25 against 36% / 17% until F14 raised the level and the
briefing followed.)

**AND THE COUNTEREXAMPLE THAT SHOWS WHERE THE LINE COSTS SOMETHING.** The
justification above rests on each policy number being *"named, commented with
what it means and why that value"*. `SPENDER_AGGRESSION` was not.

It reads 1.10 and its comment said *"bids ABOVE what it can afford. Pacing is its
only brake."* But `spender` runs Maximise Clicks, and `rawBid` multiplies the
keyword bid by `MAX_CLICKS_AGGRESSION` (1.6) — which lives in `constants.js`,
because it IS physics. The effective bid is **1.76x break-even**, 64% above the
number written in the policy file, and the brake is the strategy rather than
pacing. Measured: cpc 24.94 against `disciplined`'s 9.69, a 2.57x ratio landing
almost exactly on 1.76 / 0.70.

**This is the cost of the split, not an argument against it.** A policy number and
an engine number multiplying the same quantity is invisible precisely because the
two files are meant not to share a blast radius — and the separation that makes
tuning safe is the same separation that hid the compounding. It is the fifth time
this project has found two mechanisms multiplying one quantity with a comment
describing only one of them (F10, F11, G4 step 3, the purpose axis in
`HANDOVER.md`, and this).

**The comment is corrected and the VALUE is deliberately untouched**, because
whether 1.76x is the intended aggression is a design question about what the
cautionary rival teaches rather than a defect. It is open in `HANDOVER.md`.

### C8. Every rival loses its second capital allocation, and the player does not — `FOUND, not fixed` (2026-09-13)

**Found while checking whether the week-9 reshuffle is visible (D12).** The
step into week 5 moved rivals 3.60 times as much as an ordinary week, far more
than week 9 did, and this is why.

**What happens.** At a capital round the engine converts whatever capital was
left uncommitted into that month's ad budget, but only when the advertiser
submits a capital decision (`game.js`, `applyCapex`; `engine/round.js`,
`applyBudgetAdjustments`). The player's form always submits one at week 5, and
the comment above it says why: "or ₹1,00,000 simply disappears". No rival
policy ever does (`agents/policies.js`: "It does not touch capex or
repositioning"). So each rival's second ₹1,20,000 disappears: never invested,
never advertised.

**Measured, seed 1**, each advertiser's month budget as its report carries it:
rivals that kept their round-0 capital run ₹2,88,000–3,28,000 in month 1 and
**₹1,68,000** in month 2; rivals that invested it run ₹1,93,000–2,08,000, then
₹1,68,000; the player, committing nothing at week 5, runs **₹2,88,000** in month
2. So in month 2 the player has up to ₹1,20,000 more than any rival.

**Why it matters.** Hard rule 6 is "one advertiser type, no privileged player
path anywhere". There is no player-only code here, but there is a player-only
outcome: month 2's market is softer for the player than the rules say, every
game. It is also why rivals' presence collapses at week 5, and plausibly part of
why F15 found the market so generous to the player (a sensible player profits
in 72 of 72 markets).

**Not fixed yet, because fixing it moves the market.** The obvious repair is for
every rival policy to submit a capital decision at week 5, committing by its
character (as `rivalCapex` does at round 0) or nothing, so the rest becomes ad
budget. That adds up to ₹9,60,000 to month 2 across the eight rivals, so it
needs the calibration invariants re-measured and read, F15's economics re-run,
and D12's findings re-checked, before and after, like F14.

**And a harness trap found beside it.** `startGame`'s `player.capex` expects a
capital block (`committed`, `pending`, `remainingUnallocatedPaise`). Given a
flat list of targets, as D12's, F15's and F16's throwaway harnesses did and
`tests/writerBalance.test.js` still does, `remainingUnallocatedPaise` reads as
missing and the player's round-0 ₹1,20,000 silently disappears too: the harness
player's month 1 was ₹1,93,000 where a real game gives ₹3,13,000. D12's and
F16's comparisons stand, because both branches of every fork shared the same
month 1, but their absolute figures describe a player poorer in month 1 than
any real one. `startGame` should refuse a capital block without its fields.

## D. Budget, bidding and capital

### D1. Budget model was outdated — `FIXED v0.3`
**Sim v0.1:** spend accumulated from midnight and stopped dead. That is accelerated
delivery, which Google removed in 2019.
**Sim v0.3:** paced delivery, three levels — month, week, day — with a rolling
daily target of `remaining week ÷ days remaining`.

### D2. Smart Bidding was an oracle — `FIXED v0.2`
**Sim v0.1:** Target CPA and Target ROAS used the *true* hourly conversion rate.
Never wrong. This badly flattered automation.
**Sim v0.3:** estimates drawn around observed history, error shrinking with
conversion volume, plus a learning period after every strategy change.
`observedConvRate` is written from **landed** conversions only — a conversion that
has not arrived cannot inform a bid, which is precisely why bid strategies look
broken when checked too early.

**The query parameter is gone, and its absence is the guarantee.** Spec 12.2
passes `estimatedConvRate(bidding, query, hour, rng)`. But a query carries
`convMultiplier` and the position affinities — the truth — and `getPublicView`
withholds those from everyone, including the advertiser they favour (C4). A
strategy able to reach them would be the v0.1 oracle wearing a different name.

So the signature is `estimatedConvRate(bidding, hour, rng)`. A strategy may read
its own history, the hour, and its own product catalogue. Nothing else. Two
tests enforce it: one asserts the arity, one reads the module's source and fails
if it so much as names an affinity.

**Dayparting therefore has to be earned.** A strategy bids more in a good hour
only once it has logged `MIN_HOUR_OBSERVATIONS` clicks in that hour and formed
its own opinion. Early on it has not, so it dayparts badly — the honest version
of what automation does. v0.1's Target CPA dayparted perfectly from round one
because it was reading the answer.

**All five bid formulas are invented.** Spec 10 and 12 name the strategies and
describe the error around the estimate, but never say how an estimate becomes a
bid — audit item A12, unresolved until now:

| | bid |
|---|---|
| `manual` | keyword bid |
| `maxClicks` | keyword bid × 1.6, no hour shaping |
| `targetCpa` | target × estimated conversion rate |
| `targetRoas` | (own order value × estimated rate) ÷ target |
| `maxConv` | keyword bid × 1.6 × (this hour's estimate ÷ own average) |

The budget-spending strategies deliberately do **not** solve for a bid that
exhausts the budget, as the v0.1 binary search did. They bid to win and let
pacing throttle them, which is simpler and closer to the real thing.

**A zero ROAS target now throws.** v0.1 silently substituted 1, turning a
nonsensical setting into a plausible-looking bid. "Spend without limit" should
fail loudly rather than quietly become "spend at 1× return".

### D3. Quality improvements were free sliders — `FIXED v0.2`
**Sim v0.1:** drag a slider from 4 to 9, costs drop instantly.
**Sim v0.3:** you write real ad copy and Claude grades it. Improving quality costs
what it costs in life: the work of writing something good, with no guarantee.

### D4. The month-3 ranking metric is a deliberate trap — `FIXED v0.3`, *by design*
Month 3 budgets are allocated by rank on **cumulative gross profit across rounds
1–8, as reported at round 8**, and the rule is announced to the player at round 1.

Both halves are traps the simulation already contained:

- **Gross**, so returns are not netted out. A player managing to the ranking metric
  will happily buy traffic that converts well and comes straight back.
- **As reported at round 8**, so attribution lag has not resolved. A round-8 click
  shows 100% of its cost against roughly 55% of its revenue. Spending near the
  deadline makes you look worse than you are.

**Why cumulative rather than round 8 alone.** Ranking on round 8's report alone
would make going dark for the last fortnight strictly optimal and free. Cumulative
means the go-dark play costs you the real profit those rounds would have produced.

**A residual incentive to under-spend just before the snapshot survives, and is
intentional.** That is exactly what happens at real quarter ends, it is
value-destroying, and a player who discovers it has learned something true about
how organisations behave. The UI should say so after the fact, not before.

### D5. Budget follows performance — `FIXED v0.3`, *realistic but risky*
**Real:** in a business, good returns get you more budget. Budget follows ROI.

**Sim:** month 3 redistributes on rank, top to bottom, 1.30× down to 0.70×.

**The risk we designed against:** this is a rich-get-richer mechanic, and in a
learning simulator it could make the last third a foregone conclusion — inverting
the lesson, since the interesting skill in paid search is doing more with less.
Three things hold it in check: the spread is gentle (1.86× top to bottom, ~7%
between adjacent ranks), **the total pool is constant**, and the rule is announced
in advance so managing to it becomes strategy rather than surprise.

**The constant pool is not cosmetic.** If total money in the market changed between
months, CPCs would move for reasons unconnected to the player's decisions, and they
could no longer read their own performance. Capex rollover (D7) already perturbs
this, which is why `marketContext` exists.

### D6. Money does not compound — `WONTFIX for v0.3`
**Real:** profit funds next month's advertising. Revenue arrives late, some walks
back out as returns, and you can go broke while technically profitable.

**Sim:** each month's allocation is fixed and independent. Cumulative profit is the
score, not the bankroll.

**Why:** a depleting bankroll introduces bankruptcy rules and cash-flow mechanics,
which is business simulation rather than paid-search simulation. Most of the
interest is captured by scoring on cumulative profit without building a second
economy. Candidate for v0.4.

### D7. Capital expenditure is a one-time purchase with a guaranteed return — `OPEN`
**Real:** conversion rate optimisation is continuous, uncertain, and frequently
fails. A redesign can make things worse.

**Sim:** two allocations of ₹1,20,000 (weeks 1 and 5), four targets, an
S-curve of guaranteed effects, live three rounds after commitment. It was two of
₹1,00,000 and three targets until I29 added order confirmation; photography
climbs its own longer ladder since I30. D12 measures what the timing of the
second allocation does.

**Simplified heavily in the player's favour.** What it does buy honestly is the
lesson the simulator otherwise could not teach at all: **the highest-return
marketing decision is often not a marketing decision.** A conversion lift improves
every click you buy for the rest of the game; more budget buys more clicks once.

**Why the curve is an S rather than diminishing.** With diminishing returns the
first tranche on every target is the most efficient purchase, splitting across
every target becomes strictly optimal, and the amount choice collapses to a solved puzzle. The S
makes splitting available and sometimes right, while spreading thin genuinely
underperforms committing. It is also more honest: ₹25,000 of engineering produces a
half-built fit tool that helps nobody.

**Why the delay matters.** Investing costs three rounds of traffic *and* three
rounds of conversion data, and the data cost falls unevenly. Value has conversions
to spare and the worst returns problem, so it should invest. Premium is already
data-starved (F7) and needs every round of history before the round-8 snapshot, so
it often should not. Without the delay, investing would simply dominate.

### D8. Unspent capital inflates the market — `OPEN`, mitigated
Capex not committed rolls into that month's ad budget, so months 1 and 2 can reach
₹2,68,000 while month 3 is capped at the rank allocation. If every advertiser
declines to invest, total market money rises by 60% for two months and then falls
back.

That would make CPCs swing across month boundaries for reasons the player cannot
attribute — the exact confound D5 exists to prevent.

**Mitigation, not elimination:** `marketContext` records total market spend, active
advertiser count and median CPC every round, and the UI must surface it. Then
"my CPCs jumped 40% in month 3" resolves to "because two rivals ran out of money" —
a real and valuable read rather than noise. Without that surface, this mechanic
costs more than it is worth.

---

**Correction, after building the rollover: the confound is an order of magnitude
smaller than this entry assumed.** The rollover was described here in the present
tense for three commits before any code implemented it. Once it existed, the
market was measured both ways, nine advertisers, expected mode, rounds 1–4:

| | month cap | actual spend | median CPC |
|---|---|---|---|
| all nine invest fully | ₹15,12,000 | ₹2,21,000 | 979 paise |
| all nine decline | ₹24,12,000 | ₹2,52,000 | 979 paise |

**Money rises 60%. Spend rises 14%. Median CPC does not move.** The market at
these bids is demand-limited rather than budget-limited, so most of the extra
money simply cannot be spent, and the price is set by `AD_RANK_FLOOR` and rival
ad rank rather than by how much budget is in the room.

So the D5 confound this entry exists to worry about is real but small, and the
`marketContext` surface is worth keeping for the *rivals going dark* case — which
is a genuine 100% swing in one advertiser's presence — rather than for this one.

The measurement also says something about the rollover as a game mechanic: at the
fixture's disciplined bids it buys a non-investor 14% more traffic, not 60%. That
is a real cost to investing, but a smaller one than 13.3 implies, and it will grow
only for an advertiser aggressive enough to be budget-limited in the first place.

### D9. The 2× daily overspend cap needs manufactured forecast error — `FIXED v0.3`
**Real:** Google may spend up to twice your daily budget on a given day, balanced by
underspending others, because pacing is a *prediction* and predictions are wrong.
Over a billing period you are never charged more than daily budget × days.

**The problem:** in a simulation, demand is a table the engine wrote. A pacer that
reads it has perfect foresight, never overshoots, and the 2× cap becomes
decoration — with a spec test that could never pass.

**Sim v0.3:** the pacer forecasts from `PACING_REFERENCE_CURVE`, one smooth
day-shape, while real demand is the sum of per-query hour profiles that do not
match it. The error emerges structurally from the mismatch — no dice, no injected
noise, fully deterministic, no new fudge factor.

**And it produces a lesson we did not previously have:** an account whose demand
pattern is unusual gets paced worse than an average one.

---

**Correction, after building `pacing.js`: the mismatch does NOT produce 2× days,
and the entry above overclaimed.** Measured across all three hour profiles at
2.5× market appetite, a day lands within 0.2% of its target. The reason is
simple and was not obvious in advance: the pacer re-reads actual spend every
hour, so it self-corrects continuously and converges. Total overspend is
negligible no matter how badly the reference curve misjudges the shape.

**The 2× cap is therefore a safety rail, not an active mechanic.** It is
implemented and enforced, and a test confirms it binds when it would otherwise
be exceeded — but in ordinary play it does not fire. Spec 19's *"a single day
may exceed the daily budget up to the cap"* passes only marginally, and pretending
otherwise would be exactly the kind of quiet falsehood this file exists to catch.

**What the mismatch actually costs is far more interesting: mis-timed spend.**
An evening-heavy account is throttled to zero from 19:00 onward, because the
pacer — planning against a day that peaks in the early afternoon — let it spend
freely all morning on mediocre traffic. Hours 19–22 carry over 20% of that
account's demand and receive under half that share of its budget.

A business-profile account, whose demand sits closer to the generic curve, keeps
substantially more of its own peak. So the original claim survives in a better
form: **an unusual account is paced worse — not by overspending, but by having
its money gone before its best hours arrive.**

That is a sharper lesson than a 2× day, and the player's fix for it is
dayparting, which is precisely the tool the simulation wants them to reach for.

**One control-law note, because it looks like a tuning detail and is not.** The
first implementation compared spend against the plan *cumulative to the current
hour*. It stuttered: an account a whisker ahead of plan dropped to zero
participation for a whole hour, then snapped back to full. On an evening account
that shut it out of 20:00 — its single best hour — for reasons no player could
have diagnosed. The control law now spreads what is left of the budget over what
is left of the day, which is smooth by construction. Pacing has to be legible or
the diagnosis it supports is worthless.

### D10. The weekly split is a decision Google does not offer — `OPEN`
**Real:** you set a daily budget. There is no weekly allocation control.

**Sim:** the advertiser splits the monthly pot across four weeks. This exists so the
monthly pot means something — front-load to build conversion data early, or hold
back for the ranking window. With an automatic ÷4 the pot would be cosmetic.

An honest departure, made for playability.

### D11. Place and hour adjustments go further than Google's, and work under every strategy — `ACCEPTED, and told` (2026-09-12)

**Found while writing the field guide's cash-on-delivery chapter**, and nothing in
this ledger had recorded it. Google Ads Help, *About bid adjustments*
(https://support.google.com/google-ads/answer/2732132), fetched 2026-09-12:

| | Google Ads | this game |
|---|---|---|
| location adjustment | −90% to +900% | −100% to +900% |
| ad schedule (hour) adjustment | −90% to +900% | −100% to +900% |
| under Smart Bidding (Target CPA, Target ROAS, Maximise conversions) | not supported | applied |

Google does allow −100%, but only for devices, where it opts you out. To stop
showing in a place or at an hour, you exclude the place or leave the hour out of
the ad schedule.

**Where it comes from.** `setLocation` and `setDaypart` share one range,
`DAYPART_RANGE` in `ui/decisions.js`, whose comment called it "what Google Ads
allows". That was true of device adjustments, not of these two. And
`effectiveBidPaise` (`engine/strategies.js`) multiplies every strategy's bid by
both adjustments, `targetCpa`, `targetRoas` and `maxConv` included.

**The two departures do different things, because the automated strategies are
not symmetric.** They lean by hour from their own history (`estimatedConvRate`
takes the hour) and do not read place at all:
- **Hours: counted twice.** Under an automated strategy the player's hour
  adjustment lands on top of the strategy's own hourly lean. Real Google Ads
  refuses the adjustment for exactly this reason: Smart Bidding already sets bids
  by time of day.
- **Place: the only route in.** No automated strategy here learns place, so the
  player's adjustment is the only way location reaches its bid. Real Smart
  Bidding reads location for itself. Dropping the adjustment under automation
  would leave these strategies blind to place, which is further from the real
  thing, not closer.
- **−100%** does what an exclusion does, in one control rather than two. The
  difference is a label, not a mechanism.

**Accepted as they are, decided by the owner 2026-09-12, and told on screen.**
The field guide chapter *Cash on delivery, and where you advertise* states both
location departures. The double-counted hour has no chapter yet: it must be said
when the hours-of-the-day card moves into the content model (stage C4), and that
chapter should cite this entry.

**What would change the answer:** a playtest in which automated bidding plus an
hour adjustment visibly overbids, or a player who carries "you can set −100%" to
a real account and is surprised.

### D12. Moving the second capital window to week 7 keeps capital profitable and empties the returns levers — `OPEN` (2026-09-13)

**The question.** The SLC review's recommendation 7 proposes, as its cheap
test, moving the second capital window from week 5 to week 7, so that a
decision lands after returns can be read (HANDOVER: "the back half of the game
asks nothing and costs nothing"). Its stated failure: "moving capital later
makes every capital allocation unprofitable". Nothing had measured it.

**The harness, recorded so it can be re-run** (the script itself was a
throwaway):
- `startGame` on `content/querySet.js`, seeds 1–12, the player
  (`BRAND_IDENTITIES[0]`) in each of the six cells: 72 markets; agency writer;
  no capital at round 0;
- two players. **Full**: F15's, the six highest-volume searches of its cell on
  PHRASE at 0.7 × `realisedBreakEvenCpcPaise`, its brand search on EXACT at
  1.2×. **Small**: three searches on EXACT at 0.5×, so its budget never runs out
  and spare ad money buys nothing;
- rounds 1–4 played once, then forked. Today's rule: at round 5, each of
  photography ₹1,20,000, or ₹80,000 on one of the other three targets, against
  committing nothing. The moved rule: `capexAllocationRounds: [1, 7]` on the
  same market, the same five choices at round 7, and what is not invested put
  into weeks 7 and 8, the only weeks of month 2 left to spend it;
- rivals on `controllerFor(policyId)`, asserted live. They commit no capital
  after round 0 (`agents/policies.js`), so the market is identical under both
  rules;
- `playRound` in `mode: 'expected'`; the measure is the end screen's
  `gameTotals(...).all.netProfitPaise`, what the player is ranked on;
- 13 minutes on 12 processes.

**Measured: capital minus keeping the money for ads, median rupees of final net
profit (and the share of markets where capital wins).**

| | small, week 5 | small, week 7 | kept | full, week 5 | full, week 7 |
|---|---|---|---|---|---|
| photography | +23,717 (100%) | +14,966 (100%) | 0.64 | −1,569 (50%) | +5,668 (51%) |
| landing page | +21,037 (100%) | +13,571 (100%) | 0.64 | +4,954 (54%) | +15,441 (58%) |
| size guide | +10,879 (100%) | +2,548 (100%) | **0.24** | +11,689 (58%) | +3,263 (65%) |
| order confirmation | +8,266 (100%) | +1,945 (100%) | **0.24** | +9,332 (56%) | +2,794 (65%) |
| best of the four | +23,723 (100%) | +14,966 (100%) | 0.64 | +20,693 (63%) | +18,784 (71%) |

"Kept" is the median of week 7 over week 5 for the small account, whose spare
money buys nothing, so it is capital's own value.

**1. The review's failure condition is not met.** At week 7 the best choice
still beats keeping the money in every small-account market and in 71% of the
full-account ones. Photography and the landing page keep about two thirds of
their value, which is what landing at round 10 instead of round 8 predicts:
three live weeks instead of five (`CAPEX_DELAY_ROUNDS` is 3).

**2. The returns levers keep a quarter, because the game ends before their
returns do.** Traced week by week on one small market (seed 1,
mid · performance, ₹80,000 on the size guide against nothing):

| week | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|
| net profit gained, window at week 5 | ₹3,355 | ₹2,935 | ₹1,939 | 0 | 0 |
| net profit gained, window at week 7 | — | — | ₹1,939 | 0 | 0 |

A return resolves weeks after its order, so by the end of week 12 no return from
weeks 11 or 12 has happened, and a lever that only removes returns shows
nothing there. Live from week 10 it counts once; ₹1,939 over ₹8,229 is the 0.24
measured across all 72 markets. Photography and the landing page raise orders,
which land sooner, so they lose far less.

**That is what sinks the cheap test.** Its purpose is a decision taken after
returns can be read, and the natural answer to reading them is to fix them. At
week 7 that fix earns a quarter of what it does today, so the move would teach
"fixing returns does not pay", which is false, and would narrow D7's choice of
four to photography or the landing page. The same truncation already costs
today's returns levers two of their five live weeks; it is smaller, not absent.

**3. Found on the way, about today's rule: whether capital pays depends on
whether the budget is running out.** For the full account at week 5:

| cell | lost to budget, weeks 5–8, if invested | capital wins |
|---|---|---|
| mid · performance | 64% | 0 of 12 |
| mid · lifestyle | 62% | 2 of 12 |
| premium · performance | 29% | 8 of 12 |
| the other three | 0% | 35 of 36 |

Where the budget runs out, ₹1,20,000 of ads beats a better shop almost every
time; where it does not, the money buys nothing and capital always wins. D8
predicted exactly this ("it will grow only for an advertiser aggressive enough
to be budget-limited") and it is a fair decision. **But nothing on screen tells
the player that "am I losing impressions to budget?" is the question the choice
turns on.** The full account's apparent gains at week 7 (landing page +4,954 →
+15,441) are not capital improving: the money it is compared with is worth less,
squeezed into two weeks and too late for the week-8 rank.

**Limits.** Two scripted players; rivals do not react; no capital at round 0;
one ad. Repositioning was not measured: `REPOSITION_ROUND` is a constant, and
moving it is an engine change.

**Options, none taken:**
- **(a) Leave the window at week 5,** and look for the back half's decision
  elsewhere: the review's route B, an announced market event true to the Indian
  calendar (HANDOVER's preferred direction).
- **(b) Move it and shorten `CAPEX_DELAY_ROUNDS`.** It is INVENTED. But D7 rests
  on the delay ("without the delay, investing would simply dominate"), and a size
  guide or order-confirmation flow built in a week is its own honesty question.
- **(c) Score returns that are certain to come.** The end screen could count
  weeks 11–12 net of the returns their orders will produce. That repairs the
  truncation for every lever, today's included, but it puts an estimate where
  the game has only ever shown what happened (G1).
- **(d) Say the budget question on screen,** whichever of the above: the capital
  card, or the debrief, can say that the second allocation is spend-or-invest,
  and that the week's "lost to budget" figure decides it.

(a) and (d) first. (b) and (c) change what the game claims, and each needs its
own entry before it touches a constant.

**(a) and (d) taken, 2026-09-13.** The window stays at week 5; route B, a market
event, was then measured twice and rejected (F16). For (d), the week-5 capital
card now reads the month just played, from the player's own report: what was
spent, of what, and the share of impressions lost to budget, weighted by each
week's eligible auctions (`lastMonthBudget` in `ui/decisions.js`). It then says
that the choice turns on that figure, and why, without advising: the card
cannot see what capital would earn this player, the same reason the market
card points at the split and the bids rather than prescribing (`ui/chart.js`,
`readingOf`). The words are `ui/words/capital.js`.

**The week-9 reshuffle was checked for a line too, and gets none.** Month 3's
money is split by the week-8 rank, so the market does change at week 9. Read
from the player's own Auction Insights over 72 full games (F15's player), the
largest rival change into week 9 is a median 10.8 points of impression share
against 5.9 in an ordinary week: 1.51 times, and at least double in 26 of 72.
The agreed gate was double. The rivals do move the way the ranking says (the
week-8 leader gains a median 5.3 points, ninth place loses 2.5), but not visibly
above ordinary week-to-week movement, so the screen stays quiet about it. The
step into week 5 was 3.60 times ordinary, which is C8.

---

## E. Queries, keywords and matching

### E1. Queries, match types, negatives — `FIXED v0.2`
The largest v0.1 gap. You do not buy keywords; you buy matches between your
keywords and unpredictable human queries. Now modelled, including
`intent: 'irrelevant'` queries that exist to be wasted money.

### E2. Broad match semantics are precomputed, not computed — `FIXED v0.3`
**The contradiction:** spec 8.1 defines broad match as "semantically related",
while R1 and R2 forbid network calls and non-determinism inside `engine/`. **You
cannot compute semantic relatedness in a pure offline function.**

**Sim v0.3:** `queryGen` tags every query with concept tags at generation time — a
model does the semantic work once, offline, cached. `matching.js` then does
deterministic set operations on tags. Exact and phrase match need no semantics at
all; they are string operations (stemming, edit distance, ordered token
containment). Only broad match uses the tag layer.

**Bonus:** the same tag-overlap ratio produces `queryKeywordFit`, the quality factor
in spec 9.1. One mechanism serves both eligibility and quality degradation, which
makes H5 below mechanical rather than asserted.

**Cost:** player-written keywords need tagging, which is a model call. Until tagged,
a keyword works on exact and phrase but is inert on broad. It degrades safely and
invents no data.

### E3. Negatives never touch the tag layer — `FIXED v0.3`
**Real:** negative keywords are *stricter* than their positive counterparts.
Negative phrase and negative exact do not match close variants, plurals or
synonyms.

**The bug we caught:** routing negatives through the tag system would over-block
enormously. `-cheap` would kill everything tagged `price-sensitive`, including
queries where the word never appears — inverting the real behaviour and teaching
"negatives are dangerous, don't use them."

**Sim v0.3:** negatives are string-only. Broad negative = all tokens present in any
order; phrase = tokens in order; exact = normalised string equality. None accept
close variants.

**The asymmetry this creates is real and deliberate:** you get dragged into a query
by semantic association and can only block it by naming its literal words, after
the fact, from your search terms report. That is exactly the frustration of running
broad match in a real account.

### E4. The search terms report is the only route to negatives — `FIXED v0.3`
`breakdown.byQuery` in the RoundReport is the search terms report, and given E3 it
is the only tool for finding what to block. It must be a primary UI surface, not a
buried table. The loop — broaden, inspect the terms, cut the waste — is the loop
the entire matching design depends on.

### E5. The search terms report shows everything — `WONTFIX for v0.3`
**Real:** Google withholds search terms below a volume threshold for privacy, so a
meaningful share of your spend is on queries you can never see.
**Sim:** you see every query you appeared on. A real and educational constraint,
deliberately omitted as one complication too many. Candidate for v0.4.

### E6. Account structure — `WONTFIX for v0.3`
No devices, geography, audiences, or multiple campaigns. Negatives are campaign
level only. One market.

### E7. Two readings the validator had to settle — `FIXED v0.3`
Spec 7.4 requires "every one of the 6 cells has >= 15 queries and >= 8% of total
volume". Building the validator exposed that neither half of that sentence is
fully determined, so both readings are recorded here rather than left implicit
in the code.

**Which cell does a query belong to?** Queries carry no cell field — they carry
a `priceAffinity` and a `purposeAffinity`. A query's cell is therefore the
price x purpose pair where the product of the two peaks, with ties resolving to
the first cell in a fixed order so the result is deterministic (R1).

**Only commercial queries have a cell.** Informational and irrelevant traffic is
waste, not territory, and brand traffic belongs to a trademark owner rather than
to a position. Had they been assigned cells by the same argmax, a set could
satisfy "15 queries per cell" while offering a position fifteen searches for
laundry advice. The rule exists to guarantee every position enough ground to
build a keyword strategy on, and only commercial traffic is ground.

**Shares are of territory volume, not total volume.** This follows from the
above and from the 5% irrelevant floor: with a deliberate slice of the market
worthless to everyone, tier shares of *total* volume could never sum to the
52/28/20 target. So both the 8% cell floor and the 52/28/20 tier split are
measured against commercial volume alone.

`QUERY_SET_RULES` in `constants.js` carries the thresholds, tagged `INVENTED`.
The 5-point tier tolerance is the loosest of them and the one most likely to
need revisiting once a real set exists — too tight and no generated set will
ever pass, too loose and invariant I3 cannot balance.

### E8. The tagger decides how far "broad" reaches — `OPEN`
`tagOverlap` divides by the KEYWORD's tag count, not the query's:

```
overlap = shared tags / keyword tag count
```

So the NUMBER of tags a keyword carries decides how far it travels. Broad match
fires at 0.50, so a keyword with n tags needs a query carrying ceil(n/2) of
them. Against the real query set, where queries carry two to four tags:

| keyword tags | query must share | queries with that many tags |
|---|---|---|
| 3–4 | 2 | 150 of 151 |
| 5–6 | 3 | 106 of 151 |
| 7–8 | 4 | **11 of 151** |

**There is a cliff between six and seven**, so `agents/keywordTagger.js` caps at
six. Past it a broad keyword is inert in practice while looking perfectly
well-formed — the same shape of failure as the ungraded ad in A8: a degradation
that is not safe, because nothing tells you it happened.

**The half worth arguing about is that this is the TAGGER's decision, not the
advertiser's.** A player selects "broad" and how broad it actually turns out to
be depends on how verbosely something else described their keyword. Commit
67aecbd found the same mechanism from the other end: `premium|performance`'s
broad head term carried two tags and reached half the market, while
`value|performance`'s carried three and reached almost nothing — a 4.2x swing in
invariant I3 that had nothing to do with the grid.

**Kept, because the semantics are right even if the control is in an odd
place.** A specific keyword should broad-match narrowly and a generic one
broadly, which is how the real thing behaves: "seamless compression leggings"
ought to reach less than "leggings". The tagger's job is to describe the keyword
faithfully and let reach follow, which is why its prompt says to use as few tags
as capture the keyword honestly and warns that every extra tag makes it
stricter rather than broader.

**What would change the answer:** if play shows people writing a broad keyword
and getting reach they cannot predict, the fix is to surface the tags in the
interface rather than to change the formula. A player who can see that their
keyword carries five tags can reason about it; one who cannot is guessing.

### E9. A planner keyword is tagged as the search it names — `FIXED` (2026-09-12)

**Found by the SLC review** (`reviews/slc-review.md` 9A-1), and nothing in this
ledger had recorded it. Before this change there were two tagging routes:

| who | route | where |
|---|---|---|
| rivals | the search row's own tags | `rivalKeywords` |
| player | the word lookup, `heuristicTags` | `buildPlayer`, `addKeyword` |

So the same text broad-matched further for the player than for any rival. It
was not an R6 breach in the letter, because the engine treats both alike; the
asymmetry was in what went into it.

**Measured over the 120 commercial searches, each added as a keyword:**
- 86 lost at least one tag and 34 collapsed to a single tag;
- mean broad reach was **29.2 searches, against 16.7** with the row's own tags;
- `studio to street leggings` read as just `leggings` and reached 50 searches
  where its own tags reach 4;
- `wrinkle free travel co ord` gained `free` and reached three "free workout"
  searches.

**The reasoning had it backwards.** `heuristicTags` called missing tags
"conservative". It is harmless on the keyword's own search, where overlap is
still 1, but `tagOverlap` divides by the KEYWORD's count, so fewer tags travel
further, not less far.

**The calibrated market never had this asymmetry.** `calibration.test.js` builds
its advertisers with `tags: [...q.tags]`, and round 0's reserve warning already
priced planner keywords on the row's tags (`round-zero.js`). The player was the
only one tagged differently.

**Decided by the owner, 2026-09-12: option (i).** `tagKeywordOffline(keyword,
querySet)` consults the game's own query set first. A keyword whose text is a
planner search (case and spacing aside) carries that search's tags, marked
`source: 'query-set'`; a phrase the planner does not contain is still read from
its words. The query set is passed in rather than imported, so a game played on
a fixture set is tagged from that set. The form works from the public view,
which has no tags, so the dashboard hands it a tagger (`ctx.tagKeyword`) and the
lookup stays in `agents/`. Round 0's tag chips show the tags the account will
actually get.

**Why this is not a new leak, argued because `tags` is in
`FORBIDDEN_IN_PUBLIC_VIEW`:**
- **The public view is unchanged.** It still carries no tags on any search.
- **What the player sees is the tags of a phrase THEY chose.** E2 describes the
  query set's tags as the tagger's own output for those exact phrases, produced
  once offline and frozen, so this is exactly what a live tagger would show.
  Showing a keyword's tags was E8's chosen remedy.
- **What stays withheld is which OTHER searches carry which tags,** so how far
  broad travels is still learned from the search terms report.
- **The residual leak, stated rather than hidden:** a player who added every
  planner search one by one could read every search's tags. That is accepted.
  The affinities and conversion multipliers that decide what a search is worth
  stay withheld, and anyone who can sign in can already read
  `content/querySet.js` (HANDOVER *Deployment*).

**What it changed, measured before and after:**
- **Exact-match accounts: nothing.** `writerBalance.test.js`'s games came out
  identical to the rupee (diy/retainer 1.034 both times, where HANDOVER records
  1.014, so it had already drifted inside its bounds before this change).
- **Broad-match accounts: they now behave like a rival's, which is not always
  narrower.** Twelve weeks, seed 20260902, 'before' re-creating the word lookup
  on the same keywords:

  | account | tags | searches reached | spend | net profit |
  |---|---|---|---|---|
  | five lifestyle keywords on broad | word lookup | 109 | ₹5.94L | ₹16.49L |
  | | search tags | **62** | ₹5.19L | ₹17.00L |
  | top 60 by volume, all broad (value · performance) | word lookup | 138 | ₹5.07L | −₹71,433 |
  | | search tags | **148** | ₹4.94L | −₹1,28,546 |

  A search's own tags include implied ones (`women` on "cheap gym leggings"), so
  sixty of them reach a little further than their words did.

**Not changed, and still open under E8:** a two-tag keyword needs one shared tag,
and `women` sits on most of the set, so `matching set women` still reaches 53
searches on broad. Whether a qualifier like `women` or `india` should count as a
concept broad match travels on is a question for playtesting. F13's rejected
options (retagging, symmetric broad match) are not reopened by this entry.

---

## F. Positioning, statistics and economics

### F1. No noise — `FIXED v0.2`
**Real:** accounts are violently noisy at low volume. Telling signal from noise, and
not optimising on twelve clicks, is a core skill.
**Sim:** `mode: 'sampled'` for play, `mode: 'expected'` for smooth feedback while
adjusting settings.

### F2. The engine does not simulate individual searches — `FIXED v0.3`
**Sim:** one auction resolution carries a weighted slice of an hour's volume for a
query — one slice in expected mode, six in sampled mode. Noise is applied to the
aggregate with **variance scaling to the underlying count**, so a 50-search query
stays violently noisy and a 5,000-search one does not.

Statistically equivalent to simulating each search, at a fixed cost that does not
grow with `weeklyVolume`. Six sub-auctions in sampled mode restore genuine position
churn, which one resolution per query-hour cannot produce.

**The trap this created and we had to fix:** with a whole hour's volume in one
resolution, a single auction can consume most of a day's budget. So pacing throttles
by reducing *participation fraction*, never by skipping an auction. The obvious
implementation reproduces exactly the cliff D1 exists to remove.

### F3. Order value was a fixed number — `FIXED v0.2`
Now a distribution via `aovSpread`, which is what ROAS bidding exists to predict.

### F4. Profit ignores lifetime value — `OPEN`
**Real:** many advertisers rationally lose money on the first order.
**Sim:** profit is margin on net revenue minus cost, single purchase only.

### F5. Demand and intent curves are invented — `OPEN`
`DAY_OF_WEEK_CURVE`, `HOUR_PROFILES` and `HOURLY_INTENT_CURVE` are hand-drawn. The
*shape* of the lesson — demand peak and intent peak do not coincide — is sound.
These particular numbers are illustrative only and should never be quoted as facts
about any industry.

**Note:** v0.2 deleted the hourly intent curve along with the global demand curve,
which left dayparting with nothing to earn while this file still claimed the lesson.
Restored in v0.3 as a separate curve, with invariant I5 requiring its peak to sit at
least three hours away from every volume peak. If the peaks coincide, H4 below is
false.

### F5a. The specific curve shapes, chosen in step 1 — `OPEN`
Recorded individually because F5 covers the principle and not the numbers.

**`DAY_OF_WEEK_CURVE`** — Monday-indexed, Saturday highest, weekdays near-flat.
Spread is deliberately gentle (13.5% to 16%) so day of week is a texture rather
than a strategy. Nothing in the design asks the player to reason about weekdays.

**`HOUR_PROFILES`** — three shapes: `business` peaking at 11:00, `evening` at
20:00, `flat` at 19:00. "Flat" means low amplitude, not uniform; a genuinely
uniform curve would have an ambiguous peak, which invariant I5 needs to be able
to locate.

**`HOURLY_INTENT_CURVE` peaks at 15:00.** This was forced, not chosen freely.
I5 requires the intent peak to sit at least three hours from *every* volume peak,
and with volume peaking at 11:00, 19:00 and 20:00 the only sensible window left
is mid-afternoon. The first draft put intent at 22:00, two hours from the evening
browse peak, and would have failed the invariant.

The result is a sharper lesson than the draft would have given: **both the
busiest hour and the most-browsed hour are the wrong hour to spend your money.**
Dayparting earns its keep by moving budget somewhere neither obvious peak
suggests.

Mid-afternoon is defensible as a considered-purchase window, but it is
illustrative and should never be quoted as a fact about any industry.

**The curve is normalised to a mean of exactly 1, not a sum of 1**, because it is
a multiplier rather than a distribution.

**Correction: that mean is over uniform hours, and it is not the mean that
matters.** This entry claimed the normalisation was what kept spec 4.4's
break-even figures honest, and said it was tested. It protects a mean nobody
experiences. Conversions arrive weighted by clicks, clicks follow demand, and
demand sits in the hours where this curve is high — so measured against the real
query set the **traffic-weighted mean is 1.146**, and every position converts
about 15% better than 4.2's `convRateBase` implies.

The 14.6% is real and deliberate, and it is folded into
`realisedBreakEvenCpcPaise`, which 4.4 now calls the operative figure.
Normalising against traffic instead would couple `constants.js` to the query set,
which is a worse trade than naming the number. See F11.

**`PACING_REFERENCE_CURVE` peaks at 13:00**, between the late-morning and evening
peaks and matching neither. That mismatch is the entire mechanism in D9 — it is
supposed to be wrong, and wrong in a way that under-forecasts evening demand.

### F5b. `RATING_TO_SCORE_TABLE` is generated, not authored — `OPEN`
Twenty-seven combinations mapped to a 1–10 score. Rather than pick 27 loose
numbers, the table is generated from a weighted index: below/average/above score
−1/0/+1, expected CTR counts double, the other two count once.

**Only the weighting has a basis**, and it is A4's argument — click probability
belongs in the rank multiplier for a hard revenue reason, while relevance and
landing page protect long-run trust, which does not show up in single-impression
revenue. The doubling is a crude expression of that ordering and nothing more.

The index has nine states across a ten-point scale, so **one score is
unreachable**. Anchored at all-below = 1, all-average = 6 (real keywords commonly
sit there), all-above = 10, which makes 5 the value that never occurs. An honest
artefact of mapping 9 states onto 10, not a bug.

### F5c. Other numbers invented in step 1 — `OPEN`

**`BROAD_MATCH_MIN_OVERLAP = 0.50`** — a query must share at least half a
keyword's tags for broad match to fire. Pure guesswork, and tightly coupled to
how many tags `queryGen` puts on a typical query. Expect to retune it in step 2
once a real query set exists.

**`COLD_START_CONV_RATE = 0.025`** — what a bid strategy assumes before it has
observed anything. Deliberately matches no position exactly, so the cold start is
wrong for everyone rather than quietly correct for the mid-market.

**`AD_RANK_FLOOR = 60`** — `CALIBRATE`, provisional. Ad rank is bid × quality
signal, so a mid-market advertiser bidding ₹25 at a 0.06 signal sits at 150.
A floor of 60 excludes roughly the bottom third of plausible bids. Governed by
invariant I2 and not to be trusted until `calibration.test.js` runs.
**Now 48 (F14)**: every ceiling fell 20-30% when the return level rose to the
sourced total, and a reserve that stayed put was a quarter stricter relative to
them — both `cautious` rivals went dark for 1-4 opening weeks on 10 of 12 seeds.
Lowering it moved `WEEKLY_VOLUME` from 350,000 to 430,000 with it.

**`TAG_VOCABULARY`** — 48 provisional tags across product, attribute, use,
audience, price signal and intent. Query-set content living temporarily in
`constants.js`; it will be revised when the real set is generated.

**`MIN_PEAK_SEPARATION_HOURS = 3`** — how far apart I5 requires the demand and
intent peaks to be. Three hours is enough that dayparting has somewhere
non-obvious to move budget, and loose enough that the curves remain drawable.

### F6. Positioning is a caricature of a continuous market — `OPEN`
**Real:** brands sit on a continuum of price and purpose, move along it gradually,
and often occupy different points in different product lines.

**Sim:** six discrete cells, chosen once, with one adjacent step permitted at round
5.

**Why the grid at all:** it converts the advertiser's economics from an endowment
into a **decision**. Everyone picks from the same menu, everyone knows what the menu
says, and the differences that follow trace back to a choice. That is the same
control-group logic as equal starting budgets, applied one level up — and without
it, ranking on profit would rank the hand you were dealt.

**Why economics are identical within a cell:** so outcome differences remain
attributable to decisions. Asymmetric economics within a position is more realistic
and is a v0.4 candidate, but it should arrive as an explicit scenario ("you are up
against a brand with double your margin") rather than as invisible variance.

**Why one step and not free movement:** twelve one-week rounds is too short a span
for a brand to credibly change what it sells and who it sells to. Value → Mid in a
month is a repricing exercise a real brand could run. Value → Premium is a different
company. If the game were longer, or the interval per round greater than one week,
this constraint should be revisited.

### F7. Premium's disadvantage is statistical, not economic — *by design*
Premium can pay roughly 2.7× what Value can for the same click. Its problem is that
at a 1.6% conversion rate it generates about a sixth of Value's conversions on the
same budget, so week-to-week variation runs around ±20% against Value's ±7%.

Its read on its own performance is roughly three times noisier. Its smart bidding
sits in high-error territory longer. Every learning period costs it more, because it
has less data to recover on. Stack that with attribution lag and a premium
advertiser checking results at round 3 sees almost nothing landed, panics, changes
strategy, triggers a learning period, and destroys the history it needed.

This is true of premium advertisers in life, and it is the hardest thing in the
simulator to learn any other way. It is deliberately **not** stated in the round 0
briefing.

### F8. Return rate is position-derived, not a single estimate — `FIXED v0.3`
**Sim v0.2:** `ATHLEISURE_RETURN_RATE = 0.24`, one number for a whole category.
**Sim v0.3:** derived from price tier (30% / 24% / 20%) and modulated by purpose
(performance ×0.85, lifestyle ×1.20).

**Still invented**, but now it varies for reasons that are argued rather than
assumed: cheap goods invite size-gambling and have less consistent sizing;
performance goods are bought on stated specs and either do the job or do not;
lifestyle goods are bought on appearance, and how something looks on you is only
knowable once it arrives.

**The 43 / 32 / 25 gross-versus-net gaps quoted elsewhere in this file are
BASE TIER figures, not cell figures.** Building `positions.js` made that
distinction matter. Once the purpose modifier is applied the gaps move a long
way in both directions:

| | Performance (ret ×0.85) | Lifestyle (ret ×1.20) |
|---|---|---|
| Value | 34.2% | **56.3%** |
| Mid | 25.6% | 40.4% |
| Premium | 20.5% | 31.6% |

So the headline numbers describe a row, and no advertiser actually occupies a
row. **Value-Lifestyle is the worst place on the grid to optimise to gross** —
a 56% overpayment, sustained, invisible on the dashboard. Premium-Performance
gets off lightest at 21%, which is still enough to matter.

That spread is a feature: the section 14 trap does not punish everyone equally,
and which cell you chose decides how badly it hurts.

**SUPERSEDED IN PART BY F14.** The 30 / 24 / 20 level was post-delivery returns
alone, and I28 then treated it as the total. It is now the total the engine's
own DOCUMENTED constants imply — 42.7 / 41.7 / 39.6% — and `ret` narrowed to
×0.91 / ×1.09 to keep the purpose axis level on the larger base. The argument
above for price ("cheap goods invite size-gambling") did not survive a search
for evidence and has been withdrawn; see F14. The purpose argument stands, at a
smaller ratio. The gaps are now:

| | Performance (ret ×0.91) | Lifestyle (ret ×1.09) |
|---|---|---|
| Value | 63.6% | **87.1%** |
| Mid | 61.2% | 83.3% |
| Premium | 56.3% | 75.9% |

Base tier: 75 / 72 / 66, where it was 43 / 32 / 25. The trap is deeper
everywhere and far less uneven by price: which cell you chose now matters
mostly through purpose, and through what each return COSTS — a flat ₹200 of
freight on every refused parcel, against margins that differ 6x.

### F9. Territory volume is engineered for balance — `OPEN`
Volume is split 52 / 28 / 20 across Value / Mid / Premium, derived so that each
tier's *total margin potential* comes out roughly equal — Premium generates about
2.7× Value's margin per thousand searches, so Value carries about 2.7× the volume.

Real markets are not balanced. This one is, deliberately, so that the round 0 choice
is a genuine trade-off (a high ceiling on thin volume against a low ceiling on thick
volume) rather than a right answer. Invariant I3 tests it.

### F10. The spec's conversion chain would have double-counted purpose — `FIXED v0.3`
Spec 12.1 sets out the conversion chain as:

```
business.convRateBase × query.convMultiplier × priceAffinity × purposeAffinity
                      × PURPOSE_MODIFIERS[purpose].conv × brandFactor × hourlyIntent
```

and spec 14 does the same with `PURPOSE_MODIFIERS[purpose].ret` for returns.

**Both would apply the purpose modifier twice.** `businessFor` already folds it
into `business.convRateBase` and `business.returnRate` — it has to, because
`breakEvenCpcPaise` reads the same block, and the 4.4 table (1352 / 1419 / 2503
/ 2737 / 3557 / 3981) only comes out right when the modifier is included.

So the chain in `attribution.js` re-applies neither. A lifestyle brand's
conversion rate would otherwise have been 1.21× its intended value and its
return rate 1.44× — both quietly, both in the direction of making lifestyle
positions look better at converting and worse at retaining than designed.

This is the L6 defect trying to happen again in a new place, and it is the
third time a "both of these are in the formula" reading has turned out to be
one time too many. The pattern is worth naming: **when a derived object and a
formula both mention the same modifier, one of them is wrong.** Two tests pin
it, one for conversion and one for returns.

### F11. The purpose axis was applied twice — `FIXED`
Spec 4.1 splits the grid so that **price sets the economics and purpose sets the
territory**, and invariant I4 holds the purpose axis to under 15% of break-even
within a price row. At the authored constants Premium sat at 11.9%, and 4.4
warned that the headroom was thin and that any increase to `PURPOSE_MODIFIERS`
would push it through.

**Measured on the figures an advertiser actually faces, it was already through.**

| | `PURPOSE_MODIFIERS` alone | realised on own territory |
|---|---|---|
| Value | 5.0% | 12.2% |
| Mid | 9.3% | **17.0%** |
| Premium | 11.9% | **20.5%** |

I4 could not see it because I4 read `constants.js` and nothing else — it
measured a quantity no auction ever experiences.

**The second dose came from the query set, and the query set is right.**
Lifestyle territory has genuinely bigger baskets: it is full of `co ord set`,
`matching set`, `luxe lounge set`, and a set is a larger order than a tshirt.
It has genuinely fewer returns: `oversized tshirt women`, `cotton joggers`,
`modal lounge pants` fit almost anybody, while `compression leggings`,
`squat proof leggings` and `high impact sports bra` do not. Both effects are
per-query, argued, and visible to anyone reading the set. Both push the same
direction as `PURPOSE_MODIFIERS`.

The conversion affinities are innocent — the lifestyle/performance ratio within
a price row measures 1.001, 0.992, 1.001. The duplication is entirely in
baskets and returns.

**So the modifier shrank rather than the content being flattened.**
`PURPOSE_MODIFIERS.conv` moves from 0.90/1.10 to **0.94/1.06**. This is 4.4's
own prescription run backwards: it says that if the purpose axis needs to be
*stronger*, strengthen the query affinities rather than these numbers. The query
set was already the stronger of the two, so these gave way. `ret` stays at
0.85/1.20 — it is the better-argued half of 4.3, and shrinking it would *widen*
the gap rather than narrow it, because the return modifier currently offsets the
conversion modifier instead of compounding it.

**`ret` IS NOW 0.91/1.09 (F14), and the reason is the offset argued above.** It
cancels the conversion modifier, and it was sized to do that at a 20-30% return
level. When the level rose to the sourced 40-43%, the same 1.41x ratio on a larger
base over-penalised lifestyle: I3's tilt fell to 0.865 against a 0.9 bound and
I4's neutral purpose gap reached 14.5% of its 15%. No `CALIBRATE` constant moved
the tilt — measured at three volumes and two floors. At 0.91/1.09 the tilt is
1.01, the neutral gap 1.5%, and the realised gap 12.0% (up from 11.2%: the
widening predicted above, now inside the bound). In points the lifestyle penalty
barely moved — 8.4 to 7.5 at mid, 7.0 to 7.1 at premium, 10.5 to 7.7 at value.

Flattening the query set was the first plan and was the wrong one. It would have
asserted that compression leggings and modal lounge pants come back at the same
rate, to protect an invariant, using content as the currency. `PURPOSE_MODIFIERS`
is `INVENTED` with no empirical basis; the query set's multipliers are the
closest thing in this project to an observation. The invented number gave way.

**Result.** Realised purpose gap 3.5 / 7.9 / 11.2%, against the 5.0 / 9.3 / 11.9%
the 4.4 table always claimed and never delivered. Price axis 2.68x realised.
And in I3, where every lifestyle cell had been beating its performance twin:

| | before | after |
|---|---|---|
| worst deviation | 7.1% | **2.8%** |
| spread | 1.14x | **1.05x** |
| lifestyle / performance | 1.094x | **0.999x** |

**The cost, named.** The query set carries no purpose effect on *conversion*, so
nothing else carries "performance goods are bought on stated specs, and mostly
they do the job". That claim is now made more mildly. The purpose effect is
concentrated in returns, where 4.3's argument is strongest and where the content
reinforces it rather than duplicating it.

**And a guard.** I3's "no single position is systematically the place to be" test
only ever inspected price tiers, which is why a consistent 9.4% purpose tilt
survived two commits inside the 15% band. It now checks both axes.

### F12. Impression share is a misleading headline in a thin auction — `OPEN`
Found by playing a full game and misreading it, which is the useful way to find
this sort of thing.

An advertiser alone in its cell showed **100% impression share, 0% lost to rank
and 0% lost to budget for twelve consecutive rounds**. Read off that dashboard,
nothing is happening and no rival exists. The first conclusion drawn from it was
that spec 17.1's claim — that an open cell is "not a free ride" because rival
broad match spills into every territory — was false.

**It is not false. The metric was.**

Broad match spills widely. Each cell's head terms, taken broad, reach 38–64% of
total market volume, and `mid|performance` reaches 100% of premium|performance's.
In the played game three rivals sat in the majority of the player's auctions:
overlap rates of 74%, 82% and 64%.

They took no impressions, because `MAX_SLOTS` is 4 and a thin auction has fewer
entrants than that — everyone above the floor shows. So `lostToRank` stayed at
zero and impression share stayed at 100%.

**The cost lands entirely on price.** Second price charges what it takes to beat
the entrant below you (10.2, W8), so a rival who never outranks you and never
takes an impression from you still raises every click you buy:

| | alone | with eight rivals |
|---|---|---|
| average CPC | 630 | **1679** (+166%) |
| impressions | 131,599 | 131,599 (−0.0%) |
| net profit | ₹2,98,293 | **₹92,962** (−69%) |

Sixty-nine per cent of the profit, and not one impression.

**Why this is worth keeping rather than fixing.** It is exactly true of the real
platform, and it is one of the more expensive misreadings a real advertiser
makes: impression share says how often you *appeared*, and says nothing about
what appearing cost. Spec 10.3 chose four slots so that rank competition would
be emergent and disciplined play would keep auctions thin — this is that working.

**The obligation it creates is on the UI.** A player watching impression share
alone sees 100% and concludes they are dominating, while paying 166% over the
reserve. The interface must show position mix, top-of-page share and CPC beside
it, or it will teach the misreading rather than cure it. Section 16 already says
overlap rate is the most misread number on the platform; on this evidence
impression share is a close second.

Pinned by `round.test.js`, "an open cell is not a free ride".

---

### F13. Broad match crosses the purpose axis in one direction only — `ACCEPTED, and told`

**Decided 2026-09-12: kept as a true mechanism, and stated to the player.** The
decision and the reasons are at the end of this entry, under *What was decided*.
The finding below is as it was recorded.

**The finding, in one line: `lifestyle` wins 28 of 30 played markets, and it is
not because a lifestyle sale is worth more. It is because a lifestyle click is
15% cheaper.**

Realised gross profit splits **1.55x by purpose against 1.27x by price**, over 30
markets and 240 rival accounts. Spec 4.4 and invariant I4 have those the other way
round: I4 asserts price moves break-even **more than 2x** and purpose **under
15%**, and I4 passes. The two axes have swapped in play.

**F9's balance is sound and the auction undoes it.** Territory x break-even —
which `content/querySet.js` engineers so no position is structurally richer —
comes out 0.78 / 0.77 / 0.75 / 0.74 / 0.72 / 0.71, a spread of **1.10x**. The
played market turns that into 1.86x.

**THREE CONSTANT-SIDE FIXES WERE MEASURED AND ALL THREE FAILED.** Neutralising
`PURPOSE_MODIFIERS` leaves 1.386x. Flattening the query set's baskets, returns and
conversion multipliers within each price row leaves 1.411x. Doing **both** — which
takes the realised break-even gap to 0.1 / −2.2 / −1.9%, i.e. gone, and slightly
favouring performance — still leaves **1.287x**, and lifestyle still takes top
rival in 9 of 12 markets. 62% of the gap survives the removal of the entire
designed purpose advantage.

They failed for one reason: **they all move what a click is WORTH, and the
asymmetry is in what a click COSTS.** With both sources flattened:

| | lifestyle | performance | ratio |
|---|---|---|---|
| revenue per click | 52.87 | 52.58 | **1.006** |
| cost per click | 13.86 | 16.41 | **0.845** |
| clicks | 33,989 | 29,609 | 1.148 |
| capture (rev/click ÷ own break-even) | 0.870 | 0.843 | 1.032 |
| gross profit | ₹13.38L | ₹10.40L | **1.287** |

Revenue per click is equal to within half a percent. Capture is equal, so this is
not an advertiser winning better queries than its territory average — the
selection hypothesis was tested and is false.

**THE CAUSE IS AUCTION DENSITY, AND IT IS THE F12 MECHANISM ON A DIFFERENT AXIS.**
Instrumented at both `resolveAuction` call sites, volume-weighted:

| query purpose | entrants | price set by reserve | runner-up ad rank | cpc |
|---|---|---|---|---|
| lifestyle | **3.13** | **31.6%** | 297 | 16.90 |
| performance | **4.59** | **15.1%** | 402 | 24.55 |

Winner quality is 0.12 against 0.11, so quality plays no part — and it could not,
because a hired tier's grade ignores the copy (`setup.js` `creativeBlock`) and
every rival is hired. F12 already records that a rival who never outranks you
still raises every click you buy. Here that is happening to half the grid at once.

**AND THE DENSITY IS BROAD MATCH, CROSSING ONE WAY.** Asking the engine's own
`matchesKeyword` how many cells' keywords reach each query, on the 8-keyword shape
`rivalKeywords` actually builds:

| | performance | lifestyle |
|---|---|---|
| cells reaching it (volume-weighted) | **2.95** | **2.34** |
| of those, from the OTHER purpose | **1.05** | **0.40** |
| via exact | 0.05 | 0.05 |
| via phrase | 0.25 | 0.32 |
| **via broad** | **2.65** | **2.02** |

Exact and phrase are level; phrase slightly favours lifestyle. **Every bit of the
crossing is broad match**, which reads tags and nothing else (E3).

**The tag vocabulary is what does it.** `leggings`, `women`, `tshirt` and `india`
appear in all six cells; `co-ord-set` in five and `casual` in four, both
lifestyle-weighted. But `gym`, `sports-bra`, `training` and `running` appear in
exactly three cells each — **all performance, none lifestyle**. Lifestyle
territory is tagged with general apparel words that also describe performance
products; performance territory is tagged with activity words that describe
nothing in lifestyle. So a lifestyle advertiser's broad keyword reaches into
performance territory and a performance advertiser's broad keyword does not
reach back.

**Performance territory is where the whole market's broad match lands.** That is
the entire finding. It crowds performance auctions, raises the second price 45%,
and hands every lifestyle advertiser cheaper clicks and more of them.

**Two measures that looked like the cause and were not**, recorded because both
are the obvious things to try. Tag COUNT predicts density only weakly (r = 0.099
within lifestyle, and at four tags lifestyle draws 2.59 entrants against
performance's 5.05). Tag SPREAD — the mean number of cells sharing a query's tags
— comes out performance 3.71 against lifestyle 3.80, marginally the wrong way,
and every cell is 100% reachable by somebody. Neither is the right measure,
because what matters is whether a *keyword's* tag set overlaps a *query's* enough
for `tagOverlap` to accept it, not how popular the individual tags are.

**WHY THIS IS OPEN RATHER THAN FIXED.** The spill is arguably true to life —
generic apparel vocabulary really does reach activity searches, and E8 already
holds "how far broad reaches" open as a design question. What was never argued is
the CONSEQUENCE: a one-directional spill that subsidises half the positioning grid
and decides 28 games in 30. I8 frames broad match as something an advertiser does
to itself; nothing in this ledger chose it as a structural transfer between
positions.

Nothing should move before that is settled, and in particular not another
constant. Three have now been measured on this axis and all three were the wrong
lever, which is the same lesson G4 records when two `CALIBRATE` tweaks failed to
shrink the location payoff.

**F14 MADE IT WORSE, and that is recorded rather than regretted.** Narrowing
`PURPOSE_MODIFIERS.ret` to hold I3 level took lifestyle's net-profit lead from
1.58x to 1.73x, and lifestyle top rival from 26 to 27 of 30 (a different harness
from the figures above — see F14 on why those cannot be re-run). The version of
F14 that would have left `ret` alone penalised lifestyle through returns and hid
part of this finding by accident. The cause is still the one-way tag spill.

#### What was decided

**A SHARPER DIAGNOSIS FIRST, because the options could not be costed without
it.** Every commercial row bid on as a broad keyword, run through the engine's
own `tagOverlap`:

| | reaches the other purpose's volume |
|---|---|
| lifestyle keywords into performance searches | **5.27x** |
| performance keywords into lifestyle searches | 3.10x |

**Half the crossing is one word.** "leggings" alone makes 50% of the
lifestyle-to-performance matches, and with its pairings about two thirds. It
sits on 33 performance rows against 12 lifestyle ones — most leggings searching
in this market is activewear — and the lifestyle keywords that carry it are
short and vague: "everyday leggings", "designer leggings", "athleisure
leggings", two tags each. E8's rule asks for half the KEYWORD's tags, so one
shared word is enough, and one word reaches every activewear leggings search.
Performance keywords are specific, three or four tags, and reach back far less.

**THE MECHANISM IS TRUE TO LIFE; THE CONSEQUENCE IS THE PROBLEM.** A casual brand
bidding broad on "everyday leggings" really does show on "gym leggings", and
activewear really is where a category's search volume sits. What is not fine is
that it decides the round 0 choice — lifestyle takes top rival in 27 of 30 — and
that nothing told the player.

**Chosen: accept it, and say it.**

- The round 0 briefing gains a hint: *"Activewear searches are the most
  contested in the category. Almost everyone sells leggings, so anyone bidding
  broadly on them turns up in gym and training auctions, while searches for
  casual and lounge wear draw fewer bidders."* A founder would know this — it is
  what a real Keyword Planner's competition column shows — so it withholds
  nothing the character would have, and it gives no multiplier and ranks no cell.
- Spec 4.4 now separates what a position can PAY, where price dominates, from
  what it EARNS in play, where purpose does and why.
- `querySetContent.test.js` pins the asymmetry from both sides — the reach ratio
  between 1.5 and 1.9 (1.70 today), "leggings" alone carrying over 40% of it, and
  activewear holding more than twice lifestyle's leggings rows. Growing silently
  would widen a gap this entry records at one size; vanishing silently would leave
  the briefing telling the player something false.

**REJECTED, and why, so they are not retried without new evidence:**

- **Symmetric broad match** (divide by the larger tag count, or Jaccard). It
  removes the one-way flow and also stops a generic keyword reaching specific
  searches — "leggings" against a four-tag activewear row falls to 0.25 — which is
  the central broad match lesson (I8: one broad keyword, seventy search terms) and
  exactly what E8 keeps on purpose.
- **Adding a third tag to the vague lifestyle rows.** Cheap, and it is content
  tuned to hit a number: F11's rule against spending content as currency, and
  arguably less true, since "everyday leggings" IS related to "gym leggings".
- **More territory volume for performance**, turning the asymmetry into a trade:
  bigger but crowded against smaller but quiet. The most promising of the three
  and the one to reopen if playtesting shows the lifestyle seat spoiling the game.
  Not taken now because it edits volumes across the frozen set, needs a full
  recalibration, fights I3 — which measures territory WITHOUT crowding and would
  read the compensation as a performance advantage, so the spec would need a
  played-market check — and nobody knows yet whether any sane volume closes 1.7x.

**What this leaves true that was not before:** I3 says no position is the place
to be, and it measures isolated territory. In a played market one is. The test
is right about what it measures; the grid is not balanced in play, and the
player is now told which way it leans.

---

## G. Things the simulation knows that reality cannot

### G1. Exact counterfactuals — *by design*
`missedToBudget` is computed by re-running the round with the focal advertiser's
budget raised to its remaining monthly pot, and diffing. Because this is a
simulation, that counterfactual is exact.

Google can only **estimate** this: lost impression share as a percentage, and
estimated additional clicks in Recommendations. It never observes the
counterfactual.

**No controller reads it.** Policies use `lostToBudget`, which everyone gets,
exactly as a real advertiser would. That keeps the engine symmetric under R6 and
makes this entry true rather than aspirational — it is a teaching output, not a
competitive advantage.

**The UI must label it.** Knowing what kind of number you are looking at — an
observation, an estimate, or an impossibility — is itself part of the education.

**IT IS ONLY COMPUTED WHEN ASKED, AND UNTIL 2026-09-13 NOTHING ASKED.**
`runRound` computes it for the advertisers named in `counterfactualFor`, and the
report says `null` otherwise (spec 15.2 says so: "or null if not requested"). No
caller in the game ever passed one, so no played game has had it. The review's
"computed every round and shown nowhere", repeated in HANDOVER and in the
debrief's first draft, was wrong: it was computable and never computed.

**Decided with the owner: the debrief asks for it once, at the end, on
demand** (`plans/2026-09-13-debrief.md`). The budget card replays the game
through `game.js`'s `replayLog` with `counterfactualFor: [the player]`. Two
things make that the played game's own figure: the replay reproduces a played
game exactly, and the extra pass changes nothing else in it (both tested,
`tests/game.test.js` and `tests/debrief.test.js`). Computing it live every week
was the alternative, rejected on cost: measured, it makes a week about 2.5 times
slower to compute, and a resumed save would pay it again for every week.

**It is computed for the player only.** A teaching output that no controller
reads (`tests/policies.test.js`), so asking for one advertiser and not the others
changes no competitor's decisions, and R6 is untouched.

**v0.2 got this wrong** by raising *every* advertiser's budget, which measures a
different and more competitive market where the missed traffic would have been more
expensive anyway. It answered the wrong question.

### G1a. The counterfactual always runs noise-free — `FIXED v0.3`
Whatever mode the round itself used, the counterfactual pass runs in
`expected` mode.

G1 calls this a number the simulation knows exactly and Google can only
estimate. Sampling it would contradict that: you would be comparing a noisy
observation against a noisy hypothetical and reading the difference as
opportunity, when much of the difference was noise.

It also keeps a sampled round inside its performance budget. Two sampled
passes measured 2,217ms against a 1,500ms ceiling; a sampled main pass plus an
expected counterfactual is about 1,230ms. The right answer and the fast one
happened to coincide, which is worth recording as luck rather than judgement.

### G2. Competitors' true impression share — *by design*
Auction Insights in this simulation reports rivals' impression share computed from
truth. Google estimates it. The difference is small but it is a difference, and it
belongs on this list.

---

### G3. The books are opened after the last round — `FIXED`

R3 forbids an advertiser reading another's performance, and it forbids it for
the whole game. I7 is the record of a trend chart that could not be a
leaderboard for exactly that reason: the lead is cumulative gross profit (13.1)
and Auction Insights is the only legal surface.

**After the final round the end screen shows everything** — every advertiser's
cell, spend, conversions, CPA, net ROAS and gross profit, ranked.

It sits here rather than in section I because it is the same kind of thing as
G1 and G2: something the simulation knows that reality cannot. A real account
never tells you a competitor's spend, and never will.

**Why it is allowed at all:** the game is over, so there is no decision left for
it to unfairly inform. Withholding it after the last round would protect nothing
and cost the player the only answer the end screen exists to give.

**What it is actually for** is the position column. 17.1 says a rival's cell is
INFERRED from its ad copy and never stated, so a player who read those eight ads
at round 0 has spent twelve weeks not knowing whether they read them right. This
is where they find out, and it is the only place in the project that grades the
round 0 skill at all.

**The warning is on the screen, not in this file.** A player who took the table
for a normal report would leave believing competitor economics are obtainable.
The card says outright that they are not.

**It earned itself immediately.** The first game played to the end with it
showed a rival on ₹0 spend and ₹0 profit for twelve rounds — a market with eight
real competitors rather than nine, which nothing else surfaced and no test
catches. See I11 and HANDOVER.

### G4. Where the searches happen — `FIXED`, all nine steps

A third dimension of demand, after the query and the hour: every search happens
somewhere, and India divides into metros, large cities, and smaller cities and
towns. Advertisers choose where to bid, weekly, and the same ad and bid earn
differently in each.

It sits in this section because the mechanic rests on something no advertiser can
observe directly — the simulation knows exactly where a searcher is and what that
does to the odds they keep the parcel. Google reports location performance; it
does not hand you the causal model.

**THE SHAPE, and every part of it was argued before a line was written.**

| | what location changes |
|---|---|
| volume | distributes by price × location — premium concentrates in the metros, value spreads to the towns |
| return rate | rises outside the metros, 1.0 / 1.25 / 1.5 |
| order value | modestly higher in the metros, 1.10 / 1.00 / 0.92 |
| **conversion rate** | **untouched** |

**Conversion is deliberately left alone.** It already carries query affinity,
`PURPOSE_MODIFIERS` and the hourly intent curve, and F10 and F11 are both records
of what happens when two mechanisms push one number. The purpose axis was applied
twice and nobody noticed until an invariant was measured properly.

**RETURNS ARE THE TRADE, and without them there is no decision.** Volume alone
changes how MANY clicks are available, not what one is worth — so a player would
simply target everywhere and the control would be decoration. Cash on delivery is
ordinary outside the metros and COD orders come back materially more often, so
tier 3 traffic converts perfectly well and then leaves again. That is a fact about
this vertical rather than an invented penalty, and it is a *different mechanism*
from query affinity, so nothing double-counts.

**MEASURED BEFORE BUILDING.** A pre-auction model, guarded by reproducing
`realisedBreakEvenCpcPaise` to the paise for all six cells, put the value of a
click at:

| position | metros | large cities | towns | spread |
|---|---|---|---|---|
| value·lifestyle | ₹39.34 | ₹30.82 | ₹23.81 | **1.65×** |
| premium·performance | ₹91.60 | ₹78.55 | ₹67.92 | 1.35× |

Targeting your best tier instead of everywhere is worth **+20% to +27% for value
positions and +7% to +8.5% for premium** — the opposite of the intuition. Premium's
searches are already concentrated in the metros, so narrowing adds little; value is
spread, so running everywhere drags it through its worst ground. And returns bite
value hardest, because a return eats more of a 40% margin than of a 62% one.

**THE PROBLEM THAT MEASUREMENT EXPOSED: the metros are better for everyone.** On
economics alone that is a right answer, and F9's whole philosophy is that this game
should not have one. The counterweight is **capacity, not quality**. D8 measured
this market as demand-limited — raising every advertiser's money 60% raised spend
14% and moved median CPC not at all — so nine advertisers confined to the metros
cannot all spend there. The money has to overflow, and tier 2 and 3 are worth
having because they are where it can go.

That is why the tail is deliberately fat. The country comes out **34.0 / 35.2 /
30.8**, a spread of 1.14×, with the price correlation preserved inside each row
(premium 50/32/18, value 26/36/38). A thin tail would have made the metros a right
answer and a third of the market dead ground.

**THE BUDGET DOES NOT MOVE.** Splitting a market into three does not create
searchers, and `WEEKLY_VOLUME` is pinned in a narrow band anyway — below ~315,000
I1 fails, above ~375,000 I3 fails (F14 has since moved that band to
395,000-460,000, with the floor lowered to 48). The measured risk runs the other way: the player
already spends 18–20% of their month, and a targeting decision that narrows
eligibility makes that worse. Budget pressure is also what makes the choice bite;
if everyone could afford to be everywhere there would be no trade.

**FOUR SMALLER CALLS, all settled:**

- **Impression share becomes per targeted tier.** Otherwise an advertiser running
  the metros only reads share against a market it chose not to enter, and F12
  already records share as the most misread number here.
- **Quality Score stays account-level.** It needs 500 impressions on a keyword's
  literal search and already takes until week 2; per tier it would not appear
  until week 6, and Google's is not per location either.
- **The control is a weekly bid adjustment**, shaped exactly like dayparting, and
  it triggers **no learning period** — 12.3 reserves those for strategy changes.
- **Rivals target by their own affinity**, so crowding emerges where affinities
  overlap rather than from a rule. Without that there is no counterweight to
  calibrate.

**THE QUERY SET IS NOT TOUCHED.** The split is derived from each query's home cell
through one 3×3 table, so all 151 rows stay exactly as they are. It is the one
artefact where a subtle flaw poisons every number without throwing.

**WHY THE TABLES ARE `CALIBRATE`, which widens a set the spec pinned at two.**
Nothing about these numbers can be settled by argument. The metros are better per
click by construction, and whether tier 2 and 3 are worth having depends on whether
crowding makes the metros expensive — which is emergent (H10) and only observable
in a played game. `ESTIMATED` would claim a confidence nobody has.
`tests/constants.test.js` carries the argument beside the assertion, and asks the
next person to justify any further widening.

**TRAFFIC THAT IS NOBODY'S TERRITORY SPLITS EVENLY**, and it is 16% of the set.
`homeCell` returns null for brand, informational and irrelevant queries (7.5), so
they carry no price signal at all — and giving them a price tier's geography would
assert something the query does not say. An even split is the only honest answer,
and it is also what stops brand traffic quietly inheriting a geography it never
earned.

With that included the country comes out **33.9 / 34.9 / 31.2**, spread 1.12×.

**THE CONSERVATION TEST IS THE ONE THAT MATTERS.** Summed over the real 151 rows,
volume after the split equals volume before it. That is the entire claim of the
mechanic in one assertion — geography says where the searchers `WEEKLY_VOLUME`
already counts are. If it ever fails, the country has grown or shrunk and every
calibrated number is measuring a different market.

**THE TABLES ARE RATIOS, AND FINDING THAT OUT WAS THE DEFECT OF STEP 3.** They
were about to be applied raw. `LOCATION_RETURN_MULTIPLIER` reads 1.0 / 1.25 / 1.5,
and weighted by where the searches actually are that has a mean of **1.243** — so
every advertiser running everywhere would have seen returns rise by a quarter, and
value's documented **30% would have become 37%**. `POSITION_ECONOMICS.returnRate`
IS the category-wide rate (F8), and the briefing tells the player *"about a
quarter of orders category-wide"*.

That is the F10 and F11 shape once more: a modifier stacked on a number that
already contains the effect. Third time in this project, and the first two were
each found only when an invariant was finally measured properly rather than read.

`locationEffects(querySet)` now divides both tables by their volume-weighted mean.
The spread the design agreed survives exactly — the towns still return half again
as often as the metros — while the market keeps the average F8 gave it:

| | raw | normalised |
|---|---|---|
| returns | 1.0 / 1.25 / 1.5 | 0.804 / 1.005 / 1.207 |
| baskets | 1.10 / 1.00 / 0.92 | 1.090 / 0.991 / 0.912 |

Running everywhere, value's realised return rate comes back to **30.0%**, mid's to
24.0%, premium's to 20.0%. Normalised on VOLUME rather than conversions, which is
an approximation — conversions follow quality and bids too — but it holds the
category rate to within a point and does not depend on who is winning.

**ONE LADDER, APPORTIONED, AND THE PERFORMANCE STOP IS WHY.** Three locations are
three genuinely separate auctions and the honest implementation resolves three.
That was written first and measured:

| | naive three | apportioned | budget |
|---|---|---|---|
| expected | 531ms | **169ms** | 400ms |
| sampled + counterfactual | 4,155ms | **1,282ms** | 1,500ms spec, 2,200ms test |

Three quarters of that work is redundant **today**, because nothing yet makes a bid
depend on where the search is: the entrants, their bids and their quality are
identical in all three, so the ladder is too. Everything that differs — impressions,
clicks, cost, baskets, returns — is linear in volume, so splitting the RESULT is
exact rather than approximate.

**Step 6 breaks that, and there is a tripwire rather than a comment.** The moment a
per-location bid adjustment exists the ladders genuinely differ, and the
apportionment stops being merely approximate and becomes wrong — every advertiser
ranked as though it bid the same everywhere. `round.test.js` fails if any advertiser
carries `locationAdjustments` or if `round.js` so much as names the field, with a
message telling whoever added it to restore the per-tier resolution (keeping a fast
path for the common case where every adjustment is neutral).

**The settlement does not triple either.** The basket and the return rate are per
location, so both accumulate as weighted totals in one bucket per query and are
averaged at queue time. One bucket per query-and-tier would have tripled the
settlement to save nothing.

**THE REPORT HAD TO CARRY THE MONEY, NOT JUST THE TRAFFIC.** Location does not
touch conversion RATE by design, so a breakdown of clicks and cost alone would
have shown three columns differing by volume and nothing else — and hidden the
entire lesson. What location touches is the basket and the return rate, so the
conversion queue carries the tier its click was in, and returns carry it too.

That cost a design decision made in step 3: one conversion bucket per query
became one per query AND location. It is the difference between a location report
that can show what the money did and one that cannot.

**Measured over a played game, round 1 read at round 9 with its returns
resolved** — a value advertiser, identical bids everywhere:

| | metros | large cities | towns |
|---|---|---|---|
| cost per click | ₹18.17 | ₹18.17 | ₹18.18 |
| return rate | 21.4% | 26.8% | **32.2%** |
| **net revenue per click** | **₹100** | ₹85 | **₹72** |

The same price everywhere and 28% less money in the towns. The return-rate ratios
come out at 1.250 and 1.501 against the design's 1.25 and 1.5, so the gradient
survives the whole chain from table to played round.

**AND IT IS REVISED, ON THE SAME CLOCK AS EVERYTHING ELSE (11.4).** Returns
resolve after a return window on top of an attribution lag, so a location reads
well for several weeks and is then rewritten downward — which is precisely the
shape of the mistake the mechanic exists to teach. A location report that was not
revised would keep saying the towns never send anything back.

**Impression share is per location**, measured against the auctions available
there. Against the whole market it becomes meaningless the moment anybody can
choose where to run, and F12 already records share as the most misread number in
this report.

**THE CONTROL IS A BID ADJUSTMENT, and it had to come before rivals could use
it** — the build order had those two the wrong way round.
`campaign.locationAdjustments` is three percentages, exactly like dayparting,
because it is exactly the same kind of control and Google's own is a location bid
adjustment rather than a separate campaign. It triggers **no learning period**:
12.3 reserves those for strategy changes, and this changes no estimate.

**−100% IS A BID OF ONE RUPEE, NOT AN OFF SWITCH**, the same as dayparting.
`locationMultiplier` returns zero and `effectiveBidPaise` clamps to
`MIN_BID_PAISE`, so an advertiser who turns a location off is priced out rather
than absent — it stays in the eligible count and reports as lost to rank. Being
outbid because you bid a rupee is still being outbid, and a report that hid that
would teach the wrong lesson about where the traffic went.

**Both adjustments share one clamp.** −50% on the hour and −50% on the place
compound the way two bid adjustments do, rather than each being floored separately
at `MIN_BID_PAISE`.

**TWO PATHS THROUGH THE AUCTION, and a test that they agree.** When nobody adjusts
by location the ladders are identical, so one resolution apportioned is exact and
the round takes it — a player who never touches the control pays nothing. The
moment anyone tilts, all three are resolved properly. The risk of two paths is
that they quietly stop agreeing, so the same round runs both ways and is held to
the same numbers, breakdown included.

**One finding from turning a location off**, and it is not a defect: the metros
gain **0.02%**. Giving up two locations means spending the day's budget more
slowly, so pacing lets the advertiser participate a little more where it stayed.
That is the budget following, not the volume — the searches stayed where they
were, and total impressions more than halve.

**ALL NINE STEPS ARE DONE**, and two attempts to shrink the payoff both failed in
a way worth recording. Narrowing the return spread 1.5 to 1.35 moved value gain
from +58.6% to +57.2%; narrowing the basket spread 1.196x to 1.07x moved it to
+57.4%. Both were reverted. The cause is structural rather than a constant: for a
value advertiser the metros are BOTH the most valuable and the cheapest, because
its rivals crowd the towns where its own queries mostly are. Geography lands on top
of the affinity separation and produces *go where your competitors are not*. No
CALIBRATE value fixes that.

The decomposition also overturned this entry own framing: the BASKET is the larger
lever, 1.196x against returns 1.125x, and constants.js still calls it a texture
rather than a second lever. That comment is wrong.

**AND THE MECHANIC WAS SUSPECTED OF SOMETHING IT DID NOT DO.** The game played
after step 8 had `automator` winning by 62%, and `HANDOVER.md` recorded that
nobody had checked whether that predated this work. It does, and this work made it
smaller:

| | `automator`'s lead over second |
|---|---|
| as shipped, rivals targeting by location | 63.4% |
| tilts stripped, geography still in the engine | 67.7% |
| `5374fd8`, before a line of location code existed | **69.7%** |

Six points of the gap belong to geography, in the direction of closing it. The
cause was that `automator` held the only `mid|lifestyle` seat on that seed, and
five of the six policies win that seat — `cautious` takes ₹45.4L from it against
`automator`'s ₹27.5L. `HANDOVER.md` carries the full decomposition.

**The middle row of that table is worth more than the exoneration.** With the
geography present and nobody targeting, the standings come out ₹28.18L against a
pre-location ₹28.40L with identical ordering — a 0.8% difference across nine
accounts and twelve rounds. That is an independent confirmation that centring each
position on its own country works: an advertiser who ignores the control pays
almost exactly nothing for the mechanic existing, which is what the normalisation
was for and was previously only argued.

---

## H. What the simulation gets right

Recorded because the list above is long and the payload matters:

1. **Second-price mechanics.** You pay what is needed to beat the advertiser below
   you, not your bid — and, since v0.3, against the entrant below you whether or
   not they were shown.
2. **Quality as a price discount**, not a tiebreaker. Better ads cost less *at a
   given position* — and, because quality also lifts you into better positions where
   the advertiser beneath you is stronger, it does not reliably lower your average
   CPC. What it buys is more traffic for the same money.
3. **Impression share splitting losses** into rank problems and budget problems,
   which have opposite fixes.
4. **Demand peak and intent peak do not coincide**, which is where dayparting earns
   its money. Requires invariant I5 to hold.
5. **Broad match degrades quality as well as wasting spend**, because a distant
   query lowers `queryKeywordFit` and therefore ad rank on that query.
6. **Impression share can fall while impressions rise** when you broaden a keyword,
   because the denominator grows faster than the numerator.
7. **Winning the auction is not winning.** A premium brand can outbid everyone on a
   bargain-hunter's query and lose money on every click, while the dashboard shows
   impressions and clicks rising.
8. **Relevance is not the words matching** — it is whether that searcher wants what
   you sell. Two advertisers can both appear on one query and only one of them
   should be there.
9. **Conversion rate optimisation often beats more ad spend**, because a lift
   improves every click you buy for the rest of the game while extra budget buys more
   clicks once.
10. **Rank competition is emergent.** Auctions stay thin under disciplined play and
    crowd the moment anyone broadens, raising everyone's costs. Nobody is told this;
    they watch it happen.

---

## I. What the interface shows, and what it refuses to

Every entry above is about what the ENGINE does. These are about what the screen
says, which is a different kind of decision and was going unrecorded — the whole
of `ui/` was built without a line in this file. A departure from real Google Ads
belongs here whether it lives in `engine/` or in a render function.

### I1. The player is shown the grade their own ad earned — `FIXED`

Real Google Ads shows no absolute grade. It shows a 1-10 Quality Score and three
component ratings — below / average / above — and nothing else.

This screen shows the three ratings AND the 1-10 the grader gave each component.
That is a departure, and it exists because the relative rating is compression-
locked at both ends.

**Measured, on a played account.** Lifting `expectedCtr` from 6 to 9 — a 50%
improvement — moves the own/field ratio from 1.145 to 1.676 and the displayed
score not at all, because both sit past `RATING_UPPER_THRESHOLD` and three levels
have nothing between them to say.

**The landing-page half of this entry was wrong, and the correction matters more
than the original claim.** It read: "`landingFactor` spans 0.85–1.05, so at grade
10 the field ratio is 1.0925 against a 1.10 threshold — **'above' is unreachable
at any grade**", and on that basis spec 9.4 was rewritten and A6's correct
conclusion overturned.

It is reachable. Over 720 games `above` occurs on **20.2% of contested keywords
at grade 10 and 3.4% at grade 9**, in 33 of 72 (seed, cell) pairs. A6 carries the
full table.

**How the error was made, because the shape will recur.** The measurement was
taken on seed `20260902` — this project's canonical seed, the one in
`tests/setup.test.js` and in every played account in `HANDOVER.md`. It is the
worst row in the grid: one of its six cells reaches `above`, and only at grade
10. In five of six cells "unreachable at any grade" is **locally true**. The
figure 1.0925 is `1.05 / landingFactor(6)` exactly — one rival graded 6, on one
query, generalised to every field in the game. **A number measured on the
canonical seed is a sample of one.**

**The display decision survives, on better grounds.** The original argument was
that the rating is pinned, so the screen must show the grade. The true argument
is stronger: grades **5 to 8 are indistinguishable** — 411 of 411 keywords read
`average` at every one — so a player who takes their landing page from 5 to 8, a
serious improvement, gets **zero feedback from the rating**. Without the earned
grade the screen tells them nothing happened, which is the one thing this project
must not do. With it they read `Landing page 8/10 · average` and can see both that
the work landed and that the rating is a comparison rather than a verdict.

**The alternative was rejected on evidence, not taste.** 9.4 pre-authorises
widening the factor range rather than moving the threshold, so it was tried.
0.80–1.15 breaks spec 17.1's "an open cell is not a free ride" — an advertiser
alone in its cell falls from ~100% of its eligible auctions to 98.9%, because the
lower floor pushes weak ads under `AD_RANK_FLOOR`. Widening upward only is worse,
97.1%, because it lifts the RIVALS' factors too and manufactures rank competition
where 17.1 says there is none. Those measurements stand and are the reason the
range has not moved. What has changed is that **widening is no longer needed to
make the rating reachable** — it already is. It would only flatten the middle,
which is a smaller prize than the entry originally claimed.

### I2. The search terms report names brand owners — `FIXED`

Real Google Ads does not label a search term as belonging to anyone. This one
marks a term carrying an advertiser's name: green for yours, red with the name
for a rival's.

Spec 3.1 lists brand bidding as one of the four reasons this vertical was chosen
over a subscription business, and it was running every round with no surface at
all. `brandDefender` poaches every brand query in the market from round 1 and by
round 2 holds 100% of the impressions on eight of the nine, at
`BRAND_POACHER_MULTIPLIER` 0.25 against the owner's 2.5. Meanwhile a player
adding the entirely ordinary keyword `co ord set` on phrase match poaches a rival
and watches that row return 0.2 conversions for ₹681 with nothing to explain it.

**Ownership is inferred, never read.** `query.brandOwner` is withheld from every
viewer (16.1). `brandNamedIn` reads the words and looks for a name it already
knows, because identity is public under R3 — which is what makes the inference
fair, and it is the same reasoning `brandDefender` does.

**The duplication with that policy is deliberate.** `policies.test.js` forbids
`agents/policies.js` from importing `content/` at all, so a policy cannot reach
the roster except through the view it was handed. A shared helper was written,
the guard caught it, and it was put back. A hole in an absolute guard costs more
than a duplicated eight-line function.

### I3. Round 0 no longer marks the player's own territory — `FIXED`

It used to put a dot beside the searches in the player's cell, computed by
`homeCell()` — which reads `priceAffinity` and `purposeAffinity`, the two fields
16.1 withholds "from every viewer, including the advertiser the affinity
favours". A leak, and a worse one than it looks: working out which of 151
searches are yours is the decision round 0 exists to make (4.1), and the dot
made it for you.

It was not even helping. The account this project keeps returning to bought the
top five rows by volume — every one a Value-tier search for a premium brand —
with the dot on screen the whole time.

`tests/ui.test.js` now fails if any `ui/` file names the withheld query fields or
the functions that DERIVE them, built from the engine's own
`FORBIDDEN_IN_PUBLIC_VIEW` rather than a copy of it.

### I4. The player is told where they finished at week 8 — `FIXED`

13.1 announces the month-3 ranking RULE at round 1 and says nothing about
publishing the result. The end screen and the budget card both state the
player's own position, and nothing else about the field.

It is two integers. `budgetSchedule.rankedAtSnapshot` orders every advertiser by
gross profit; `rankOf` returns `{position, of}` and the array goes no further, so
no screen can show a rival's standing even by accident.

Withholding it would have been theatre rather than discipline: ₹1,17,600 against
₹1,68,000 is the last-place multiplier and nothing else, so a player reads their
rank straight off their own budget. And 13.3 is explicit that a budget swinging
for reasons nobody can attribute is worse than the mechanic is worth.

### I5. Two ads per cell, not one — `FIXED`

17.1 authors rival copy per cell and puts eight rivals in six cells, capping a
cell at two. With one ad per cell the doubled cells ran WORD FOR WORD identical
copy, so two of the player's eight pieces of evidence said nothing.

The second variant signals the same cell by a different route, which is what a
real second competitor in a segment looks like: Value still names a price and
makes an offer, Mid still names neither a price nor a material, Premium still
names what it is made of. Every rule in `adCopy.test.js` runs against both.

### I7. The trend chart plots six metrics because there are only six — `FIXED`

Asked for a graph putting all nine advertisers side by side "to evaluate who
has the current lead". The chart exists; the framing could not.

**The lead in this game is cumulative gross profit (13.1), and that is exactly
what R3 forbids reading about anybody else.** Auction Insights is the entire
legal surface and it carries precisely Google's six Search metrics, so those six
are what the chart draws and there is nothing else it could draw. Three are
per-advertiser and plot for all nine; three are pairwise and yield eight lines
and never one for the player, because "you against you" is not a quantity
`insightsFor` computes and a flat line for it would be invented data.

**The temptation was to let impression share stand in for the lead.** F12 is the
measurement of why not: an advertiser read 100% impression share for twelve
rounds while rivals took 69% of its profit through price. It was winning every
auction and losing the game, and a chart headed "who is leading" would have told
it that it was first. So the card is headed *share of impressions*, and F12's
finding is printed ON the chart rather than under it.

The overlap view carries §16's own warning for a sharper reason than §16 had.
§16 says overlap rate is the single most misread number in the report and the
interface should say so — and a TIME SERIES makes that worse, because a rising
line reads as a rival growing when it may only mean you both broadened into the
same searches.

Noise was the player's explicit choice: all six offered rather than the three
most useful, on the argument that learning to skim is part of reading a real
report. Clicking a name in the legend isolates it, which is what makes that
skimmable rather than merely busy.

### I8. The Negatives card answers "do I need to care" from the account — `FIXED`

The card explained the mechanism — literal words, no synonyms, no plurals — and
said nothing about whether any of it applied to the player, who asked outright
whether to pay attention or let it be.

That question has an answer and it is conditional: negatives matter in
proportion to how loosely the keywords match. Measured on this query set, five
phrase keywords on long strings produced a report with five rows and nothing to
block, while one broad keyword took it to seventy.

So `negativesOutlook` reads the player's own match types and their own report
and says which of those two accounts they are running — "3 of your 68 searches
took five clicks or more and returned nothing, costing ₹14,660" against "your 5
keywords matched 5 searches, and none of them is taking clicks without returning
anything". Same principle as I1: a live read of the situation beats a paragraph
the reader has to apply to themselves.

Phrase counts as loose. "leggings" on phrase reaches 45 of this set's 151
queries, five of them informational, so treating phrase as tight would tell a
player they were safe when they were not.

### I9. The landing page is built, not described — `FIXED`

Round 0 used to hold a free-text box for the landing page, and its own hint said
the quiet part out loud: *"Nobody else ever sees this line; it exists to be
graded."*

**The concept was modelled twice, and the free model was the text box.** The
engine already prices a landing page as three capital investments
(`engine/positions.js`): `photography` raises `convRateBase`, `sizeGuide` lowers
`returnRate`, `landingPage` adds up to three graded points. Meanwhile
`agents/grader.js` read the typed prose for `/size|fit|guide|chart/` and
`/review|rating/`. **So typing the words "size guide" earned landing-page grade
for nothing, while buying one cost ₹25,000.**

It was also the wrong question to ask a player. Describing a page that does not
exist is not a decision about advertising; it is a guess at a rubric. Once
`explainGrade` put the checks on screen — which was right for other reasons —
the optimal play became satisfying a checklist, and the prose became ceremony.

**The page is now composed from what the capital funded.** `ui/landing-page.js`
holds a tier ladder per capex target, each rung carrying the sentence it
contributes; `composeDescription(capex)` builds the string the grader reads. A
claim with no purchase behind it cannot be made. The card draws the page as the
strips it has paid for.

**WHAT THIS COSTS, stated rather than hidden.** A `sizeGuide` purchase now moves
two numbers: the return rate, as before, and — through the page claim it
unlocks — the graded `landingPage`. `engine/positions.js` warns against exactly
this: *"Two things writing one number is how the L6 double-count happened."*
The warning is about two mechanisms writing one FIELD, and that is still not
happening — the grade comes from text, as it always did, and the capital bonus
is still applied separately afterwards. What changed is that the UI will no
longer let a player write text they have not paid for. It is bounded at one
point out of ten and it is argued here so the next person to read that warning
finds the exception.

**The trade-off was measured, not designed.** Enumerating all 29 affordable
allocations: the top landing grade costs ₹80,000, which leaves ₹20,000 — under
photography's ₹25,000 first rung. **So the best page and better photography are
mutually exclusive**, and a player is choosing between a cheaper click and more
of their visitors buying. `tests/landingPage.test.js` pins that as an invariant
rather than an observation. Verified in a browser: at that allocation every
photography chip is disabled, and removing the size guide drops the grade 8 → 7
with the sizing check flipping to a miss.

**Two things this did NOT fix.** Headlines and descriptions are still free text
graded by token presence — a digit anywhere, one of `free|save|off|buy|shop`
— so `expectedCtr` remains word-bingo. And the ad can still only be written at
round 0 and never revised, though spec 12.3 is explicit that editing copy costs
no learning period.

### I10. The offline grader rewards craft, and still refuses to award a 9 — `FIXED`

`CTR_RULES` gave a point each for **three headlines**, **a digit anywhere**, and
**one of `free|save|off|buy|shop|order`**. Two of the three positive points were
therefore single tokens, and an ad reading *"Shop 3 Now"* three times over
scored the same 8 as a finished one. Descriptions were **not scored at all**.

Now three rules, still worth one point each, still capping at 8:

| | rule |
|---|---|
| +1 | the ad is filled out — three headlines AND both descriptions |
| +1 | the headlines say three different things (pairwise content-word overlap ≤ `HEADLINE_OVERLAP_LIMIT`) |
| +1 | a reason to click — a number **or** an offer word, one point between them |

All three are Google's own Ad Strength criteria: *add more headlines, add more
descriptions, make your headlines more unique*. Two of the three now depend on
the ad being written rather than on characters appearing somewhere in it.

**WHY THE CEILING STAYED AT 8, having been asked to raise it.** A balance
measurement wanted a DIY writing path to reach 9 so it could beat a hired
writer. But `grader.test.js` pins *"it does not pretend to be the model: it
awards no 9s or 10s"*, and the module header says why: it is *"a floor that
keeps the game playable without an API key, not an opinion about writing."*
The 8-cap is a claim about what regexes can know. Extending patterns until they
award a 10 would assert that pattern-matching recognises excellent copy, which
is false, and would rebuild the token-guessing the change exists to remove.

The balance problem was solved on the other side instead: hired tiers cap at
5/6/7, so DIY at 6/7/8 beats each of them, and 8 — the honest ceiling — becomes
the natural top of the ladder. **The only honest route to a 9 is the model
path**, which `grader.js` already takes as an injected transport and which
nothing has yet supplied.

**A live bug found on the way.** `gradeInputs` counted empty strings. Round 0
seeds the draft `headlines: ['', '', '']` and only strips them at submit, so the
LIVE grade on that screen credited an untouched form with three headlines.
Empty boxes are now filtered before any rule sees them, and an empty round 0
reads 5/10 with all three checks missing.

**Two of the four tests written for this passed against the OLD rubric**, which
is worth recording because it nearly shipped. Removing a description also
removed a digit; rewording the headlines also removed one. Both measured the
rules they were meant to prove absent. The fixtures now hold the digit and the
offer word constant in the shared descriptions, so only the variable under test
moves.

`HEADLINE_OVERLAP_LIMIT` sits in `agents/grader.js` beside `TRADEMARK_PENALTY`,
`OVERLONG_CEILING` and `HEURISTIC_BASE` rather than in `constants.js`, following
those three: the rubric's own numbers live with the rubric, and no formula in
`engine/` reads any of them.

### I11. Ad copy is bought or written, and the choice is a real one — `FIXED`

Real Google Ads has no notion of who wrote your ad. This one does: at round 0
every advertiser hires a writer or writes its own.

| tier | price | copy grades | live |
|---|---|---|---|
| Write it yourself | ₹0 | whatever you actually wrote, up to the grader's 8 | **week 3** |
| Freelance copywriter | ₹10,000 | 6 | week 1 |
| Creative agency | ₹25,000 | 7 | week 1 |
| Premium retainer | ₹50,000 | 8 | week 1 |

**PRICE CANNOT BE THE LEVER, and that is measured rather than assumed.** The
obvious design — pay more, get a better ad — does not work in this economy. One
point of ad copy quality is worth **₹1,33,986** of net profit over twelve
rounds. Against honest search copywriting rates of ₹1,000–3,000 that is a **45–134×
return**, so every tier is a forced buy and the decision is a toll booth. Even
at a ₹50,000 agency fee one point still repays four times over. To make price
balance the choice you would have to charge about ₹2,00,000 for three headlines,
which is more than a month's media and a lie about what copy costs.

So the currency is **time and certainty, not money**. Hiring is immediate and
guaranteed and capped; writing your own is delayed, uncapped to the grader's
ceiling, and only as good as what you wrote.

**THE TIER GRADES WERE MEASURED, TWICE.** The first run put them at 5/6/7 — and
was taken against a market where every rival ran a no-op controller (see
HANDOVER). Re-measured against a field that bids back, one quality point fell
from ₹2,20,254 to ₹1,33,986, CPC improvement collapsed from −28% to −8%, and
marginal value began PEAKING at grade 8 and falling at 9. Hired grades of 5/6/7
were beaten by a competent self-written ad at every rung, so the ladder is
6/7/8.

**A TIER SETS THE LEVEL; THE ADVERTISER SETS THE SHAPE.** Had a tier set both
copy components, every buyer of one tier would have `expectedCtr ===
adRelevance` and the eight rivals would collapse onto three identical shapes —
exactly what `adCopy.js` exists to prevent, since "above average" needs a field
to be above and equal ad ranks hand one advertiser every top slot. Each rival's
authored character now supplies a lean (the SIGN of its old ctr-minus-relevance)
around the tier's level.

**A WRITER WRITES COPY**, so no tier touches `landingPage`. That is graded from
the page the capital built (I9), and letting a copywriter move it would rebuild
the double model I9 was written to remove.

**THE DELIVERY IS DELAYED, NEVER THE EFFECT.** `CLAUDE.md` requires an ad copy
change to move `qualitySignal` immediately and leave `reportedScore` unchanged;
a grade that faded in over rounds would break the split the whole diagnostic
rests on. The grade is computed at round 0, held whole, and applied whole by
`game.js` on the round it was due.

**THE ROLLOVER IS LOAD-BEARING, not tidiness.** Whatever the writer did not cost
becomes advertising budget. Without it the retainer was 20% ahead of a perfectly
self-written ad and strictly dominated. With it, `tests/writerBalance.test.js`
measures self-written against retainer at **1.002** — within 0.2%. **Re-measured
at 1.014** through a replica of that test's own fixtures once rivals stopped
writing their own ads, which raised the field it is measured against. **Read at
1.034 on 2026-09-12** (E9), identical before and after that change, so it had
drifted there unseen. Still far inside the test's 0.85-1.15 bounds.

It arrives differently from the capital rollover and the two must not be
confused: capital has allocation rounds and `round.js` adds it there, rescaling
the split; the writer is chosen at round 0 and has no allocation round to wait
for, so its remainder is in `monthlyBudgetPaise` from the start.

**A CONSEQUENCE WORTH KNOWING.** A self-written ad can reach `adRelevance` 10
and so beat every hired tier on that component, because relevance is measured
against your OWN keywords while a tier is a flat grade capped at 8. For it:
echoing your own searches is the part the advertiser knows best. Against: a
copywriter handed your keyword list would use it too. Left as it is because the
balance decides, and at 1.002 it is not too generous.

**RIVALS HIRE; ONLY THE PLAYER MAY WRITE ITS OWN.** A rival's tier follows the
policy it already runs rather than a second authored table: a `spender` buys the
retainer, a `disciplined` advertiser the agency.

`cautious` used to write its own, and it was a defect. A self-written ad opens
on the ungraded 3/3/3 default, and A8 measured that as sitting below
`AD_RANK_FLOOR` at any cautious bid — so the rival showed in nothing for twelve
rounds. A8 exists to keep the PLAYER out of exactly that state; dealing rivals a
DIY tier recreated it. Measured at round 0: Marlow needed 1551 paise to appear
and bid 1078. Over a played game it went from ₹0 spend and ₹0 profit to
₹1,93,623 and fourth place once it hired.

**This is not a privileged player path (R6).** Round 0 is asymmetric by
construction — the player DECIDES their position, keywords and copy while a
rival is CONFIGURED from a seed. Both still go through `creativeBlock`, and
nothing in `engine/` branches on who is who. What changed is a configuration
choice of the same kind as which keywords a rival opens with. The player may
still write their own because the player is TOLD what it costs and chooses
anyway; a rival is never asked.

**The guard that was missing** is now in `setup.test.js`: every rival's opening
bid must clear the reserve on its own best keyword, across every seed. Nothing
asserted that a rival TRADES, which is why a dead one survived until the end
screen put all nine in one table (G3).

**THE ABSTRACTION IS ON THE CARD.** You write what the ad says either way, and
those are the words searchers see — this simulator cannot invent better ones.
What hiring buys is the grade. That sentence is printed, because the difference
between an abstraction and a screen that teaches something false is whether it
says so.

### I13. The trend chart reads itself back to you — `FIXED`

The card explained what each of the six metrics IS, and warned what impression
share is NOT, and never said what to DO with any of it. Asked outright after
playing: *"I still don't get the rationale behind the graph."*

That is a fair question and the card was not answering it. I7 records why the
chart cannot be a leaderboard — the lead is cumulative gross profit and R3
forbids reading it about anyone else — but a player should never have to read a
design ledger to know what a card is for.

`marketOutlook` now reads the situation back. **Every fact in it is one a real
advertiser could see**: it comes from `insightsFor(...).self` and the six legal
rival metrics, and a test poisons the input with every withheld field to prove
none reaches the output.

**The reading that matters is "rank or budget", and it is answerable inside
R3.** Measured on a played account: 41% impression share, 0.0% lost to rank,
58.8% lost to budget. Nobody was outranking that player at all — they simply
stopped appearing when the money ran out, and the rivals plotted above them had
budget left rather than better ads. Those two situations want opposite responses
and the chart previously let a player conclude the wrong one.

Four states, and the thresholds that pick between them are display judgement
kept in `ui/` for the reason I6 gives:

| state | what it says to look at |
|---|---|
| budget | the weekly split, and whether bids are higher than they need to be |
| rank | bid × quality — a higher bid buys position, a better ad buys position AND cheaper clicks |
| both | bidding for more traffic than the budget can pay for |
| saturated | more keywords, not more money on these — and F12's warning that 100% share is not winning |

**It says where to look, never what to do.** "Your split and your bids" is a
place; "lower your bids" would be advice this card cannot justify, because it
cannot see whether those clicks were worth buying.

**And it reads the steps already taken**, which was the other half of the
request: the change in impression share since last week, attributed to nothing
in particular — *"whatever you changed, that is what it did to how often you
appear"* — because the chart cannot know which of several changes caused it and
should not pretend to.

### I14. The game can be started again, and the market is a choice — `FIXED`

Twelve weeks end and nothing followed. The end screen now offers another game,
and the interesting part is not the button but **which market**.

- **Same market.** The same eight rivals in the same cells. This is G1's
  counterfactual made playable: the only way to learn whether a result came from
  a decision or from the board you happened to be dealt.
- **A new market.** Different rivals in different cells, so the eight ads at
  round 0 say something else — which asks whether what was learned transfers,
  or whether one board was memorised.

**A NEW MARKET IS THE NEXT SEED, NOT A RANDOM ONE.** `rootSeed + 1`, so a game
stays reproducible from the number its own state records (R1). A clock would
have been easier and would have made every game unreplayable. `setup.test.js`
now asserts consecutive seeds place rivals differently over thirty pairs —
without it, "a new market" could silently hand back the same one.

**Two steps, deliberately.** The first button only asks; the second says which
market it is about to build. Twelve rounds is far too much to lose to one stray
click, and the card sits LAST on the end screen so it is read after the summary
rather than met before it.

**It is not the round 0 redo (17.3), and must not be confused with it.** A redo
goes back THROUGH `redoRoundZero`, which stamps `redoUsed` and keeps the
identical market on purpose. This starts over completely, and the new game
arrives with its redo unspent.

Nothing is saved. `serialise.js` exists and no screen has ever called it, so
"play again" ends the old game rather than setting it aside.

### I15. Capital is described the same way wherever it is spent — `FIXED`

Round 0's capital card became a page builder (I9) — chips saying what each rung
buys, beside a drawing of the page. **The round-5 allocation window kept the
older framing** and nobody noticed: its own target list in a different order,
one-line whys (*"Fewer returns."*), chips showing only `₹25,000`, and no page at
all. One decision described in two languages, and the terser telling was on the
screen where the player has MORE context and less time to use it.

Reported by a player who wanted to invest at the month-2 refresh and found the
screen explained it worse than round 0 had.

Both cards now read `featureAt`, so they cannot drift apart again.

**AND THE ROUND-5 CARD HAS TO SAY SOMETHING ROUND 0 NEVER DOES**, because 13.3
makes investment cumulative. ₹25,000 on top of nothing is a different purchase
from ₹25,000 on top of ₹25,000 — the second reaches ₹50,000, the next rung is
₹55,000, and it therefore **buys nothing at all**. The old card showed the amount
alone and could not tell anyone that. Showing only the destination would have
read as buying a chart you already own.

So a top-up that reaches no new rung says `no change · ₹25,000` and is marked.
That is the S-curve note — *"spreading it thin genuinely underperforms
committing"* — made concrete on the one chip where it bites, rather than left as
a sentence under the card.

**NARROWED, because this card had a rung nobody could climb.** Reported by the
player who hit it: with ₹25,000 already on photography, the chips offered
₹25,000 (no change), ₹55,000, ₹70,000 and ₹1,00,000 — the rung PRICES, reused as
top-up amounts. Nobody was double-charged, because investment is cumulative:
₹55,000 on top of ₹25,000 reaches ₹80,000 and lands on the ₹70,000 rung. But the
increment to the ₹55,000 rung is **₹30,000, and no chip offered it** — so that
rung was unreachable for the rest of the game, and round 5 is the last capital
window there is. It priced the player out as well: lifting two half-funded
targets one rung each cost ₹55,000 twice against a ₹1,00,000 allocation, where
the true increments are ₹30,000 twice.

**It was the menu, not the price**, and establishing that changed the fix — the
first reading was that the card charged full price for an upgrade, which would
have been an engine problem rather than a display one. `capexChoices` now offers
the cheapest amount that reaches each rung. Verified in a browser at the round-5
window with ₹25,000 on two targets: `no change · ₹25,000` (marked),
`on real bodies · ₹30,000`, `fabric detail · ₹45,000`, `video · ₹75,000` — and
both targets lifted a rung for ₹60,000 of the ₹1,00,000, which the old menu made
impossible.

**The marked chip stays**, and it is the half of this entry worth keeping: beside
`on real bodies · ₹30,000`, a `no change · ₹25,000` teaches the threshold better
than either chip alone, and it is always one of `CAPEX_STEPS` rather than an
invented number — an amount a player might really have reached for. What is gone
is the pair of chips reaching one rung at different prices: the dearer of the two
was strictly worse, and a dominated option is not a lesson.

**What was deliberately NOT changed.** `composeDescription` runs only in round 0,
so the page DESCRIPTION is frozen after it. Investing later still works —
`landingPageBonus` raises the graded landing page by up to three points and the
player sees that move — but the description string never gains the new line.
That teaches nothing false, because the description is never shown again after
round 0. Recomposing it mid-game would change the ad's `contentHash` and trigger
a regrade under 5.2, which would overwrite the grade the player's WRITER TIER
bought (I11). The inconsistency is cheaper than the fix.

### I16. The dashboard says when your own copy is not live, and when it lands — `FIXED`

Real Google Ads has no notion of a writer, so it has nothing to announce. This
one delays a self-written ad to `CREATIVE_DIY_LIVE_ROUND` (I11), and until this
entry **no screen on the dashboard mentioned that at all**.
`CREATIVE_DIY_LIVE_ROUND` was named in `ui/round-zero.js` and nowhere else, and
`ui/dashboard.js` mentioned the creative zero times.

**WHY IT MATTERS IS A MEASUREMENT, not a tidiness argument.** The round a
self-written ad lands is the largest single movement in a twelve-week game. At
the bid round 0 offers, on the account this project keeps returning to:

| | week 2 | week 3 |
|---|---|---|
| clicks | 575 | **2,800** |
| spend | ₹13,558 | ₹69,643 |

A hired control over the same two weeks goes **down** (2,029 to 1,819), so the
jump is the creative and nothing else. Below the reserve it is worse: 0 to 1,951,
out of nothing at all.

**So a player who changed anything that week would credit their own change with a
4.9x traffic jump, and be wrong.** Nothing on the screen could correct them.
Round 0 does say it — *"It does not go live until week 3; until then you run an
unwritten ad that wins almost nothing"* — once, five cards deep in a form, before
the player has seen a single auction. By week 3 that sentence is three weeks and
a whole interface behind them.

Two sentences, in the note under "The week", where the six figures they qualify
are:

- **weeks 1 to 2:** the ad is not live, and these figures are what an *ungraded*
  ad does rather than what yours will do. It quotes the grade the auction actually
  ran on, from `DEFAULT_UNGRADED_QUALITY` rather than a literal in a view.
- **the round it lands:** the copy went live this week, and a jump in impressions
  and clicks is the first thing to attribute it to rather than last week's changes.

**It names a cause without claiming to be the only one.** The player may have
changed bids the same week and both moved. The sentence says where to look and
stops there, which is I13's rule.

**A hired account is never told anything**, at any round, because its ad was live
before the first auction and "your copy went live this week" on week 1 would be
noise on every hired game. `creativeOutlook` returns null on `liveAtRound <= 1`,
which gets that from the data rather than from a tier name.

**And it goes quiet afterwards.** A card that keeps announcing something that
happened four weeks ago trains the player to stop reading the card.

**WHAT THIS COST TO GET RIGHT, worth recording.** `getSelfView` does **not carry
`creative`** — the block is a caller-layer field added after that view was
written — so no controller can see it either. **An `llmPolicy` therefore cannot
know its own ad is not live yet**, which is a real blind spot for a policy that
would otherwise raise bids in weeks 1-2 for the wrong reason. The dashboard reads
it from `game.state`, which it already holds and which is outside R5's controller
boundary, so nothing here is blocked on it. Adding it to the view is open.

**One test written for this was wrong while the code was right.** It read the
stored `gradedQuality` at the START of the round the copy lands and expected the
default, because `game.js` applies the pending grade *inside* `submitRound`, on
the advertiser it prepares for that round. So the stored grade lags the auction by
one round exactly at the boundary being tested. `tests/dashboard.test.js` now
compares against the grade in `nextGameState`, which is the one the round actually
used.

### I17. Round 0 says when a bid cannot clear the reserve — `FIXED`

Real Google Ads shows a first-page bid estimate and warns that a keyword is
"below first page bid". This screen says something stronger, because the
consequence here is absolute rather than a worse position: under `AD_RANK_FLOOR`
an advertiser enters every auction and **shows in none**.

`minimumBidToShowPaise` has said since B5 that it is *"exported so a caller can
WARN before a week is spent in it"*. **Round 0 was not a caller**, and it is the
screen where the bid is first typed.

**MEASURED, and this is why it is a warning rather than a raised default.** A
self-written ad opens on the ungraded 3/3 default (I11), which needs **₹16.24** on
this query set where a hired 6/6 needs **₹6.87** — a floor 2.4x higher. Round 0
offers ₹30, so a DIY account clears its floor by **1.85x** against a hired
account's 4.37x, and the form accepts anything from ₹1. Played, at week 1:

| bid | impressions | clicks | lost to rank |
|---|---|---|---|
| ₹17 | 25,937 | 396 | 29.2% |
| ₹16 | 16,612 | 244 | 54.6% |
| **₹14** | **0** | **0** | **100.0%** |

A ₹2 change takes the account from trading to invisible, for two full weeks, and
the only thing on screen is "lost to rank 100%" — which reads as being OUTBID.
HANDOVER's "the player survives only because their opening bid happens to be
larger" is that 1.85x, against the 0.70x that killed a rival (I11).

**Capital cannot lower this floor**, and finding that out settled the design.
Round 0's capex goes live at round 4, so `landingPageBonus` is zero for the first
three rounds — **the copy lands before the capital does**. There is no allocation
a player can make that rescues a bid under the reserve.

**THE GRADE IT PRICES AGAINST IS THE OPENING ONE, NOT THE WRITTEN ONE, and that
is the whole warning.** A player writing their own ad watches it grade 8/10 on the
card below and opens the account at 3/10. Pricing the floor against the 8 would
reassure exactly the player about to disappear. So `content/writers.js` gained
`openingCopyGrades`, and `creativeBlock` in `setup.js` now uses it too — one
source, because a screen that recomputes a rule the caller also computes drifts
from it eventually and the drift is invisible. Same reasoning as
`willTriggerLearning` asking `triggersLearning`, and `STRATEGY_PARAM` being
checked against `rawBid`.

**It is priced per keyword, on the keyword's own literal search**, which is the
most favourable query it could meet — so failing there fails everywhere, at any
hour, against anyone. That is the test `setup.test.js` already runs over every
rival, now run for the player before the fact. Verified live: two keywords at ₹14
warned that neither could appear, and the week they bought returned ₹0, zero
impressions and lost-to-rank 100%.

**It names two levers and recommends neither** (I13). The floor is set by the
unwritten ad, so hiring lowers it and so does raising the bid; which of those is
right depends on what the player is trying to learn, and this card cannot know.

**It does not fire at the bid round 0 itself offers**, because a warning that
fires on the default trains the player to ignore it — the lesson of the split
card that cried wolf.

**And it updates as the bid is typed**, through the same `live` refresher the
character counters use rather than `rerender`, which would destroy the field
being typed into and swallow every character after the first.

### I18. Opening the account buys the first week — `FIXED`

There used to be a screen between round 0 and the dashboard, carrying one
sentence and nothing else: *"The account is open and nothing has run yet. Run the
week to buy some traffic."*

Reported by the player who met it. It is a dead end. It tells you to run the week
while the only button that does so is in the **header, top right** — the opposite
corner of the page from the bottom of the five-screen form you have just spent
your attention on. The one screen in the game with nothing on it is also the one
that does not say where to click.

**Leaving round 0 on screen instead would have been worse**, and that is worth
recording because it was the first instinct. By the time that screen is drawn
`begin()` has already built the account, so the form's draft is no longer read by
anything: every field on it — position, keywords, bids, writer, ad — would accept
edits that did nothing. *A control that does nothing is worse than no control*,
which this file already says about spent weeks in the split card.

So the question was never what to draw in between. It was **when the account gets
created**, and the answer is: when the week is bought. Round 0's own button says
`Open the account and run week 1`, and the header button stays hidden until a game
exists. One button, at the end of the form it belongs to.

**A review screen was the alternative and was rejected on this project's own
history.** A read-only summary of the round 0 choices would be a second surface
describing one decision, which is exactly the drift that produced I15's two
capital cards and the writer card disagreeing with the budget card. Removing a
screen removes the drift; adding one creates it.

**What this costs:** `chrome()`'s "no weeks played" label is gone, because
`render` is never reached with an empty report list any more — the account and its
first report are created together. The redo (17.3) now also runs its week on the
same press, which is the same flow rather than a special case, and
`canRedoRoundZero` correctly withdraws the button afterwards.

Verified by playing it: round 0 with 3 keywords and with 60, straight to the week
1 dashboard both times with no intermediate screen, header button appearing
afterwards, and the redo path refilled and run in one press with the redo then
withdrawn. No console errors.

### I19. Round 0 grades the ad it is about to submit — `FIXED`

Reported by a player: *"why is my landing page still rated 4/10? According to the
capital invested I had an 8/10 website."* They were right, and the landing page
was not the thing that was wrong — it was the only place the damage still showed.

**What happened.** They left the two description boxes blank, which is reasonable
having just paid a retainer to write the ad. Then:

1. Round 0's Go button asks `validateAdCopy(draft.ad)`, and the draft holds
   `descriptions: ['', '']`. That function counted ARRAY ENTRIES, so two empty
   boxes read as two descriptions. The ad was "valid" and the button enabled.
2. Submit sent `descriptions.filter(Boolean)` — an ad with **no** descriptions.
3. `setup.js` graded that one. It fails validation, so `OVERLONG_CEILING` capped
   **all three** components at 4, `landingPage` included.
4. The retainer then overwrote the two copy components with its guaranteed 8s
   (I11). Nothing overwrites the landing page.
5. And round 0's panel had graded the UNFILTERED draft, so it showed 8.

Panel: **8 · 8 · 8.** Account: **8 · 8 · 4.** Reproduced exactly before anything
was changed.

**The structural fault is that round 0 graded a different object from the one it
submitted**, across four call sites and three ad shapes. `submittedAd(draft)` now
builds the ad once — blanks filtered, page composed — and the grade panel, the
writer card, the keyword reserve warning, the Go button and the submit itself all
read it. There is one ad.

**`validateAdCopy` now counts written lines, not boxes.** This is the second time
empty-string counting has bitten: I10 fixed the identical flaw in `gradeInputs`
and did not touch this function, so the same root cause sat one function away for
a whole session. Both now use one predicate.

**AND ROUND 0 NOW GRADES WITH `rivalNames`, which it never did.** `setup.js`
passes them; the screen did not, so the trademark penalty (8.7, −4 on
`adRelevance`) was invisible on the one card that shows a grade — it warned in
words and left the number alone, which reads as cosmetic when it is worth four
points. Measured before the fix: an ad naming a rival showed `adRelevance` 5 and
ran on 1.

**A hired tier absorbs that penalty entirely, and that is correct.** A tier sets
the two copy components outright, so a retainer naming a rival really does run at
8 — the penalty bites a player who writes their own. A test asserted otherwise
first and was wrong; it now pins the real behaviour, because this is exactly the
kind of asymmetry someone would later "fix".

**~~`OVERLONG_CEILING` still caps the landing page, and that is argued rather than
overlooked.~~ REVERSED, and the argument that kept it is the thing that was
wrong.** It read: capping only the copy components would be more logical — page
quality is not a function of headline length — but a hired tier overwrites both of
them, so the cap would cost a retainer buyer *nothing at all*, and the bluntness is
what makes it bite. It then claimed: *"With the gate fixed the state is unreachable
through the interface, so the diagnostic asymmetry is no longer something a player
can meet."*

**A player met it.** The gate stops an invalid ad being SUBMITTED; it does nothing
about the panel being READ, and round 0 is where the decision is made. They hired
the retainer, left the copy boxes alone — which is what buying a copywriter is for
— committed ₹55,000 to reviews and ₹25,000 to a size chart, and watched the landing
page sit at 4 through every rung, explained by three notes about a page that by
then had reviews and a size chart on it.

So the cap now takes `expectedCtr` and `adRelevance` only. Two things settle it.
The bite the bluntness was preserving **cannot exist**: `ui/round-zero.js` gates the
Go button on `validateAdCopy(submittedAd(draft))`, so no invalid ad reaches a played
account and the cap has nothing to punish — its only remaining effect was to
mislead. And the more logical reading was right all along: page quality is not a
function of headline length, which this entry conceded in the same sentence as
overruling it.

Measured, blank boxes and a retainer, landing page grade before → after:
nothing committed 4 → 5, reviews ₹55,000 4 → 7, **reviews + chart 4 → 8**,
₹1,00,000 on the page 4 → 7. `writerBalance.test.js` is unmoved, which is what the
gate predicts: no submittable account was ever affected.

**The lesson is about the claim, not the cap.** "Unreachable through the interface"
was asserted from reading the code path and never checked against a person using
the screen, and it survived two sessions because it sounded like a proof. The
project's own rule — *when a measurement agrees with what you expected, check what
it actually ran* — applies to arguments as much as to harnesses.

The spec documents the character limits and says nothing about what breaking them
should do, so this remains the grader's own judgement and stays with the rubric.

**What is still not surfaced:** `gradeAdOffline` returns `notes`, and for this ad
it said *"does not fit Google's limits, capped at 4: no descriptions"* — the exact
explanation the player needed. **No screen has ever read `notes`.** Left alone
deliberately for now; it is additive rather than a fix.

### I20. The month round 0 divides is the month the account gets — `FIXED`

`monthlyBudget` was `MONTHLY_BUDGET_PAISE + (CAPEX_ALLOCATION_PAISE - committed)`.
It counted the uncommitted CAPITAL and omitted the CREATIVE rollover — so the
writer card said *"₹50,000 not committed, which is added to this month's
advertising budget instead"* and the very next card divided a month without it.

**`rerender` puts those two cards in that order deliberately**, and its comment
says why: *"whatever the writer did not cost rolls into the month this divides"*.
The ordering existed for a dependency the code did not honour. It was correct only
for a retainer, where the rollover is zero, which is why it read as a plausible
number for a whole session before anyone asked.

Measured, for a DIY player committing no capital: the card said **₹2,68,000**, the
account held **₹2,18,000**, and after week 1 it was **₹3,18,000**. Three different
numbers for one month.

**It shows the month AFTER the rollovers**, not the ₹1,68,000 the account holds at
that instant. These four boxes are spent in rounds 1 to 4 and the capital lands at
round 1, so the post-rollover figure is the one the player is actually dividing.
`tests/roundZero.test.js` pins it against the month the account reports once the
week has run, across every writer tier and three capex levels — so the two cannot
drift apart again.

Verified live: DIY with nothing committed reads ₹3,18,000 (₹79,500 weeks); hiring
the retainer drops it to ₹2,68,000; committing ₹55,000 to the page drops it to
₹2,13,000. Each step moves the month by exactly what was spent, and the weekly
boxes re-even with it.

**A second consequence, now gone.** The split the form submitted could exceed the
month it was submitted against — a retainer player planned ₹2,68,000 against a
₹1,68,000 month. Nothing crashed, because round 1 rolls the capital in and
rescales, but between those two points the plan was bigger than the account.

### I21. The grader says why it marked an ad down, and the screen finally reads it — `FIXED`

`gradeAdOffline` and `explainGrade` have always returned `notes` — the grader's own
sentence about what it penalised. **No screen had ever read them.** A search for
`.notes` across `ui/` returned nothing.

The cost of that was concrete. A player asked why their landing page read 4/10 on
a page they had spent ₹80,000 on, and the answer had already been generated and
thrown away: *"does not fit Google's limits, capped at 4: no descriptions"* (I19).
Working it out took a code read, three wrong hypotheses and an enumeration of
every affordable capital allocation. The sentence was sitting in the return value.

Round 0's grade panel now prints them. Two exist:

- `does not fit Google's limits, capped at 4: <the first violation>`
- `names a rival ("Kestrel"): adRelevance penalised by 4`

The second is worth more than it looks. The card already warned in words that
naming a rival is not allowed, and the number beside it did not move — so the
warning read as cosmetic. Now the note states the size of the penalty and, for a
self-written ad, the grade moves with it. A hired ad shows `you would have scored
1` beside the tier's 8, which is the honest statement of what a tier absorbs.

A clean ad produces no notes, so this is silent unless something is wrong.

### I22. Round 0 draws three things it used to only state — `FIXED`

Asked for round 0 to be more visual and to fill the empty space in its sections.
Measured first, at 1440×900: the page is 4,028px and **714px of it is dead column
beside a shorter card** — the slack is not inside the cards, every one of which has
the same 21px of padding. Three rows waste it: 148px, 300px and 266px.

So the answer was not "add visuals" but "which cards can grow for free". Two of
these three cost nothing.

**1. The positioning grid was scrambled, and that is the real finding.**
`.cell-grid` was already `repeat(3, minmax(0, 1fr))` and `allCells()` returns the
six cells price-major, so flowing them 3-across put **`mid|lifestyle` directly
under `value|performance`**. It rendered as a 3×2 matrix in which position carried
no meaning — on the one screen whose job is to teach the price × purpose model the
whole game rests on (4.1). It is now a real matrix: price on the columns, purpose
on the rows, both labelled, built from the engine's own `PRICE_TIERS` and
`PURPOSES` rather than a list typed into the view.

`positionMatrix()` describes the layout as data, which is why it is now assertable
— nothing caught the scramble because nothing described it. Tests pin one row per
purpose, one column per price, and every legal cell covered exactly once.

**No cell is marked as the player's**, and that is I3 being obeyed rather than
forgotten: the old dot was computed from the two affinity fields 16.1 withholds
from every viewer, and it made the round 0 decision for the player.

**2. The month has a shape.** Four number boxes state the money and hide the
decision — a front-loaded month and a flat one read identically as digits, and the
shape is what 13.2's burn-down compares against later. A stacked bar now draws it,
with each week's share of what is PLANNED rather than of the month, so it draws the
shape the player made even while something is still unallocated.

**3. The ad is previewed as a searcher meets it.** The card's own subtitle is *"the
only thing your rivals can see about you"*, and the player wrote into five boxes
and was never shown the thing they were making. It is assembled from
`submittedAd`, so it cannot show words the account will not run — a blank box
contributes nothing here either — and it is deliberately restrained: no favicon, no
star row, nothing implying more fidelity than the model has.

**WHAT IT COST IN PAGE HEIGHT: nothing.** 4,028px before, 4,028px after. Where you
sit 370 → 422, This month 234 → 271, Your ad 721 → 721 — the preview fits inside the
column beside the fields, which was already the taller one. All three land in space
that was already being wasted.

**Below 700px the axes are dropped rather than squeezed**, back to two columns of
named cells: a matrix too narrow to show its own labels is worse than a list.

**One bug the measurement caught**, and it is the reason to measure rather than
screenshot: the summary line under the bar set `className = 'problems'` when the
plan went over, which **stripped the base class** and took its spacing with it.
Both classes are now kept.

### I23. A rival's ad and your own are read in the same block — `FIXED`

Second half of the round 0 visual pass (I22).

**The eight rival ads now draw in `.serp`, the same block the player's own ad is
previewed in.** They are the same kind of object, and 17.1 makes that copy the
**only** evidence of where anyone sits before the first auction — so reading a
rival and writing your own should look alike. Until now the player wrote into five
boxes and read rivals as plain stacked text: two mental models of one thing.

`serpBlock` is one function used by both cards. The domain is shown, which is legal
because identity is public under R3 and C6 — the ADS are the evidence; the names
were never the secret. A rival block carries its brand name, the player's own does
not: you know whose ad you are writing.

**FOUR ACROSS, NOT `auto-fill`.** There are exactly eight rivals, so four columns
is two full rows with nothing sitting alone in a ragged one. `auto-fill` with a
215px minimum fitted **five** once the ads became `.serp` blocks, leaving a row of
three — and the card's own comment had always said the intent was four. Measured
rather than assumed, which is how the raggedness was noticed at all.

**The planner shows volume as a bar as well as a figure.** The card's note says
this list is *"in the order Keyword Planner gives it: biggest first. That is not the
order to buy in"* — and 151 rows of digits cannot show how steeply it falls away.
The head term runs 8,225 a week at 100% of the bar; the tail of the visible sixty
sits at 28%. Scaled against the whole list's largest rather than the filtered
view's, so searching cannot silently rescale the bars and make a tail row look like
a head term.

**WHAT IT COST IN PAGE HEIGHT: less than nothing.** 4,028px before the visual pass,
**4,014px after both slices** — "Who else is here" went 521 → 508, because a `.serp`
block in two tidy rows is shorter than nine stacked text blocks in a ragged grid.
Every rival block was checked for clipping (`scrollHeight` against `clientHeight`):
none.

`.rival`, `.rival-name`, `.rival-headline` and `.rival-desc` were deleted with the
change rather than left as orphaned CSS. `.rival-grid` stays — it is the grid the
blocks sit on. `.brand-tag.rival` in the search terms report is a different thing
and untouched.

### I24. The location card states a fact, names no lever, and repeats itself — `FOUND, not fixed`

G4 built the location mechanic, put the control on the row, and this file recorded
the outlook sentence as *"the operative sentence"*. **It has now been read by
somebody who did not build it, for twelve rounds, and produced zero decisions.**
The card was on screen from week 1 and was never clicked once.

**WHAT IT SAYS, every week, byte for byte:**

> A click is worth 1.3 times as much in metros as in smaller cities and towns,
> after returns. You are paying ₹9 for one there against ₹11 here.

Three things are wrong with that, and none of them is the number.

**1. IT NAMES NO LEVER.** I13's rule for these sentences is that they read the
ACCOUNT back and point at what to do — `marketOutlook` says whether you are
rank-bound or budget-bound, `termsOutlook` says whether there is reach you did not
name. This one reads the MARKET back. It states a price difference and never says
that a bid adjustment exists, that the row it sits on is the control, or what
acting would be worth. I13 permits naming levers without recommending one; this
card names none.

**2. IT REPEATS ITSELF VERBATIM.** Seven consecutive weeks, identical to the
character. `creativeOutlook` has the rule this needs, in its own docstring: *"it
goes quiet afterwards. A card that keeps announcing something that happened four
weeks ago trains the player to stop reading the card."* `locationOutlook` has no
such rule and violated it for most of a game. That is the most plausible reason it
never registered as actionable.

**3. THE ANSWER'S SIGN DEPENDS ON A REGIME THE CARD NEVER MENTIONS.** G4 measured
concentrating as **+58.6% to a value advertiser, +38.7% to a mid one, and −9% to a
premium one** — and G4 is explicit that what decides it is whether the account is
budget-limited or demand-limited, because a demand-limited account cannot spend
what it has and every extra search is worth having whatever it costs. The card
composes its note purely from per-click economics, so it gives the same
encouragement to both regimes while the right answer flips.

**AND THE MISSING HALF IS ALREADY ON THE SAME SCREEN.** `marketOutlook` computes
`constraint` every round — it read `"saturated"` for seven straight weeks in the
replay — and `splitOutlook` knows what is left unspent. Everything needed to say
*which regime this account is in* is already computed one card away. Nothing new
has to be modelled.

**WHY THIS IS FOUND RATHER THAN FIXED.** The fix is a wording and gating change,
which is cheap; but what the sentence should SAY depends on the F13 question, which
is open. If the purpose asymmetry is left as it is, the honest sentence names the
lever and the regime. If F13 is closed by retagging or by rebalancing volume, the
economics this card reports move, and a screen rewritten first would be rewritten
twice. G4's own step 9 made exactly this argument in reverse — *"a table that moves
after a screen is built against it is a screen built twice"* — and it was right
then.

**One thing NOT to conclude:** that the mechanic is unteachable. The same player,
in the same game, read the dayparting table correctly and peaked their bids on the
**afternoon** block — the best-converting one, not the busiest. That card shows two
columns and says nothing, and the lesson landed. The difference is that dayparting
puts the evidence and the control in one place and lets the player draw the
conclusion, while the location card draws the conclusion and withholds the control.

### I25. A hired writer hands the player the copy — `FIXED`

**A player paid ₹50,000 for the premium retainer, committed capital to reviews
and the size guide, watched the ad card reach 8/8/8 — and could not start the
game at all.** `ui/round-zero.js` disables the Go button when `validateAdCopy`
fails, and the description boxes were empty. They had hired a copywriter and were
still required to write the copy.

**THE BLOCK IS I19'S OWN FIX, WORKING CORRECTLY.** Refusing an invalid ad was
right — it stopped the panel promising 8·8·8 while the account ran 8·8·4 under
`OVERLONG_CEILING`. But for a retainer buyer it converted a MISLEADING state into
an IMPASSABLE one. The fix was correct and its blast radius was not checked, which
is the shape to watch for: a validation added for one caller reaching a second one
nobody enumerated.

**And the player leaving the boxes empty was reasoning correctly.** I11 sells the
GRADE and leaves the words to the player, which is a strange deal at ₹50,000.
Having just bought a copywriter, inferring that the boxes are the copywriter's job
is the right inference from what the screen sold them. Nothing said otherwise.

**THE PROPOSAL THAT WAS MEASURED AND REJECTED: copy authored to GRADE at its
tier.** The idea was that a retainer's seeded copy should genuinely grade 8. It
cannot be done, and the measurement is worth keeping because it will be proposed
again. Run through `gradeAdOffline` against each cell's own top keywords:

| set | `expectedCtr` | `adRelevance` |
|---|---|---|
| `content/adCopy.js`, all 12 rival ads | 7–8 | **3–5** |
| `writerCopy.js` freelancer, mid-lifestyle | 8, 8, 8 | 2, 5, 4 |
| `writerCopy.js` agency | 8, 8, 8 | 5, 3, 5 |
| `writerCopy.js` retainer | 8, 7, 8 | **1, 6, 1** |

**The best copy grades the worst.** "Four Places To Be Today" scores 1 because it
echoes no keyword; "Everyday Co-ord Sets" scores higher because it does.
`adRelevance` rewards keyword echo and good advertising avoids it. Making a
retainer set grade 8 would require copy that reads like a keyword list — and 17.1
makes ad copy the ONLY evidence of where an advertiser sits, so that trade buys a
number by spending the mechanic. The rivals' own table, hand-authored and
human-reviewed end to end, never reaches 8 either.

It would also be a second mechanism writing one number. `creativeBlock` takes a
hired tier's grades from `openingCopyGrades(tierId, bias)` and discards the ad
text; `constants.js` says why in one line — *"two things writing one number is how
L6 happened."* **So the tier remains the sole source of the grade, and none of
these numbers touches gameplay.**

**WHAT SHIPPED.** `content/writerCopy.js`, keyed cell → tier → three variants:
6 × 3 × 3 = **54 sets**, covering 9 × 6 × 3 = 162 combinations because `{brand}`
is interpolated. Keyed by CELL and not by brand, because 7.5 makes brand names
position-neutral on purpose — the player picks brand and cell independently, so
brand-keyed copy would contradict the cell in most combinations. The tier shows up
in the WRITING: the freelancer names the category, the agency adds a hook and one
concrete detail, the retainer knows the customer's day. That difference is visible
at the moment it is paid for, because `serpBlock` previews the player's own ad in
round 0 beside the rivals'.

**Four rules in `syncWriterCopy`, each of which is a way this could go wrong:**

1. **It clears the boxes on the way to DIY.** The words belong to the writer who
   was paid for them. Measured, retainer copy grades `adRelevance` **1**, so a
   player who kept it after cancelling the writer would be punished for holding on
   to the best writing in the game — a trap they could not see.
2. **It never overwrites what the player wrote.** `draft.adIsSeeded` records whose
   words are in the boxes; without it, typing three headlines and then changing
   your mind about the writer would silently discard them.
3. **The variant follows `rootSeed`**, which `app.js` increments for a new market,
   so a restart shows a different ad. `content/adCopy.js` carries the scar of the
   alternative: with one ad per cell, two rivals in a cell ran the same ad word
   for word.
4. **The landing page line is not seeded.** `syncPage` composes it from CAPITAL
   and I9 grades the page from what that capital built. A writer supplying it
   would be the second mechanism this entry argues against.

**`writerBalance.test.js` was expected to need re-measuring and did not.** It holds
self-written against retainer at 1.014 inside 0.85–1.15 bounds, and passes
unchanged — which is the prediction the decoupling makes: seeded text changes no
grade for a hired tier, so it can change no outcome. Had it moved, the decoupling
would have been broken somewhere.

**`writerCopy.test.js` asserts what content cannot be reviewed for.** All 54 pass
`validateAdCopy`; every limit is checked with the LONGEST brand name interpolated,
because a headline that fits "Nira" and not "Vella & Co." is a violation only some
games would show; no set names a rival (8.7); no line duplicates a rival ad; and
no two tiers in a cell share a headline. **That last one failed on the first run** —
the agency and the freelancer both said "Everyday Leggings", which is ₹15,000
buying the same words.

### I26. The end screen ranks on contribution margin, not gross — `FIXED`

**Raised by a player after twenty-odd playthroughs**, and the strongest form of
the question this project has been asked: *should gross profit really be the
metric to gauge who ranks first?* No. And the engine already computed the right
one.

`netProfitPaise` is `(revenue − returns) × margin − cost`: revenue after returns,
times the margin that covers the goods, minus what the traffic cost. That is
contribution margin after advertising, and it has been on every row of
`finalStandings` since it was written, computed and **unused as a sort key.**

**IT IS NOT COSMETIC. 15 OF 45 PLACINGS MOVE**, measured over five seeds, because
returns take between **18% and 75%** of gross depending on the advertiser. One
example, seed 20260904:

| | by gross | by contribution | returns took |
|---|---|---|---|
| 2nd | **Halcyon** | Nira | Halcyon 45% |
| 6th | Satva | **Halcyon** | Auren 18% |

Halcyon finishes 2nd on gross and 6th on contribution margin, having shipped 45%
of what it sold back. Ranking on gross treats a company that keeps its revenue
and one that ships it back and forth as the same company. The winner did not
change in those five seeds; the midfield reordered heavily, 7 of 9 in one game.

**ONLY ONE OF THE TWO RANKINGS CHANGED, AND THE OTHER MUST NOT.**

| | what it is | what rests on it |
|---|---|---|
| `rankedAtSnapshot` | round 8, cumulative gross | month-3 budget allocation |
| `finalStandings` | all twelve rounds, cumulative gross | who won; nothing else |

D4 makes the round-8 snapshot a **deliberate trap**, announced to the player at
round 1: gross so returns are not netted out, and as-reported-at-round-8 so
attribution has not resolved. That trap is the lesson and it drives real money —
it stays exactly as it is.

`finalStandings` is different in kind. It is read when the game is over and
nothing rests on it, which is the same argument that lets it lift R3 and open
everyone's books at all. There is no lesson in declaring the wrong winner once
no decision can follow.

**And the gap between the two becomes the teaching.** The table now carries
`Returns took`, `Contribution` and `On gross`, and a rival whose two ranks
disagree is marked on its own row with the direction it moved. The note says how
many placed differently and why. A trap that was invisible for twelve weeks is
made visible at the one moment it can no longer be gamed.

**Two defects found while building it, one of them older than this change.**

The position sentence was appended to the CARD rather than to the note paragraph,
so it rendered as a bare text node above the paragraph it belonged to. Mine, and
the browser is the only place it was visible.

**`standingsCard` was the only caller handing `table()` a `<div>`.** `table()`
appends a `thead` and a `tbody` to whatever it is given; the browser wraps a
stray pair in an anonymous table box, so it LOOKED correct while
`table { width: 100% }` never matched it. Eleven columns sat in 1,135px of a
1,383px card with a third of the width empty. Every other caller passes a real
`<table>` and this one now does too. It had been wrong since the card was
written, and no test could see it — the suite reads source as text.

### I27. The attribution lag is drawn, not described — `FIXED`

**A player who has played this twenty-odd times asked what "conversions still
pending" means.** That is the whole finding. It had a sub-label under the
headline figure — *"49.7 still pending"* — and a paragraph under the card, and
neither worked, because **the lag is a SHAPE and prose is the worst medium for a
shape.**

`Changed since you looked` now opens with one bar per week played: solid for what
has landed, hatched for what is still arriving, and a tick where the figure stood
when that week was the week on screen. Read down it and the mechanic explains
itself — week 1 is a full bar, this week is a third of one, and the staircase
between them IS the lag. Measured on a real game at week 9:

| week | landed | still to arrive |
|---|---|---|
| 1 | 60.0 | — |
| 7 | 77.4 | +4.1 |
| 8 | 64.4 | +13.2 |
| **9** | **44.6** | **+36.5** |

The week the player is reading is **45% complete**. Nothing on the old screen
said that in a form anybody absorbed.

**NOTHING IN IT IS ESTIMATED.** `stillPending` is tracked per week by `report.js`
and decremented as conversions land; `asFirstReported` is the twin W11 already
stores. The chart reads state and draws it — no model of the lag lives in the
view.

**The sentence is derived from the constant**, so *"55% this week, then 28%, then
12% and then 5%"* cannot drift from `ATTRIBUTION_LAG_DISTRIBUTION`. That mattered
more than it looks: the card above it was already describing the same rule in
hardcoded prose — *"about five rounds ... three for the order to arrive, two more
for the return window"* — which is exactly the copy-of-a-constant this project
has been bitten by before.

**AND IT MADE A GUARD IN `ui.test.js` FIRE, CORRECTLY.** That test forbids the
view from naming nine engine constants, `ATTRIBUTION_LAG_DISTRIBUTION` among
them, because the name stands in for *"the view is deciding economics"*. Here it
was a false positive: the view is QUOTING the rule, not computing with it, and
the alternative the guard was pushing toward is the hardcoded decimals the test
immediately above it forbids.

Following the precedent set when `roundZero.test.js`'s own proxy misfired, **the
guard was narrowed rather than worked around.** One allowance, one file, one
constant, with the reasoning in the test — plus a second test that fails if
dashboard.js ever starts doing ARITHMETIC with it rather than printing it. The
comment says what to do if a second entry is ever proposed: ask whether the view
has started doing work it should not be doing.

**One defect found in the browser and nowhere else.** A settled week's
`stillPending` lands on floating-point crumbs rather than on zero, so three rows
rendered `width: 5.77183e-15%`. Widths are now rounded, and a pending segment
below a twentieth of a percent is not appended at all — which also lets
`:only-child` round both ends of a finished week's bar.

### I28. Cash on delivery, and the returns that were never sales — `BUILDS 1 AND 2 OF 3`

**COD has been in this model since G4 with no name.** `LOCATION_RETURN_MULTIPLIER`
exists because of it — its own comment says *"cash on delivery is ordinary
outside the metros and COD orders come back materially more often"* — so a
player could see that small towns return more and never learn why. Raised by a
player who wanted enough on screen to work out COD and RTO for themselves and
found there was nothing to work with.

**AN RTO AND A RETURN ARE DIFFERENT EVENTS, and the engine had only ever had
one.**

| | what happened | what it costs |
|---|---|---|
| Return | delivered, then sent back | a sale reversed |
| RTO | refused at the door | **there was never a sale** |

**COD share is keyed on price AND location.** Cash skews non-metro *and*
low-value, and a table on geography alone would have a ₹4,800 premium order paid
in cash three times in four — the kind of detail that reads as invented to
anyone who knows the market. It is also where the price decision and the
location decision finally talk to each other.

`COD_SHARE_BY_PRICE_LOCATION`, both `ESTIMATED`:

| | metros | large cities | towns |
|---|---|---|---|
| value | 45% | 65% | 78% |
| mid | 35% | 52% | 66% |
| premium | 22% | 35% | 48% |

**BUILD 1 SPLITS AND DOES NOT ADD.** `refused + sentBack === returned`, exactly,
asserted in `report.test.js` — so no advertiser's economics move and no
calibrated number changes. `calibration.test.js` passes untouched, which is the
proof rather than the claim.

**AND THE SPLIT TAUGHT SOMETHING NOBODY HAD SEEN.** Playing `value|lifestyle` to
week 7:

| | paid at door | refused | sent back |
|---|---|---|---|
| Metros | 45% | **6.1%** | 11.9% |
| Large cities | 65% | **11.6%** | 12.2% |
| Towns | 78% | **16.0%** | 11.3% |

**The send-back rate is flat — 11 to 12% everywhere. Refusals nearly triple.**
So the geography penalty G4 built the whole location mechanic around is almost
entirely parcels that never got through the door, and the size guide, which
fixes *fit*, can only ever reach the flat half. That is now the sentence the
card ends on.

**ONE THING BUILD 1 DELIBERATELY GETS WRONG.** `positions.js` divides the return
rate by the size guide's capex effect and this split is applied afterwards, so a
size guide currently reduces refusals as well as send-backs. It should not — no
size guide fixes somebody changing their mind on a doorstep. Correcting it moves
numbers rather than only the display, so it lands with build 2 and a calibration
re-run, where before and after can be measured in one place instead of two.

**BUILD 2 LANDED, AND THE NUMBERS WERE SOURCED FIRST.** The player asked whether
the constants were factual. They were not — `COD_REFUSAL_PROPENSITY` was 0.75,
chosen by nothing — so they were looked up before any of build 2 was written.

| | was | is | source |
|---|---|---|---|
| freight per refused parcel | ₹140, invented | **₹200** | ClickPost ₹150-300 direct; GoKwik ₹200-250 loss on a ₹1,000 order |
| refusal propensity | 0.75, invented | **RTO 20.9% COD / 5.8% prepaid** | Unicommerce FY23, a 3.6x gap |
| post-delivery returns | — | **30%** | Pragma 30-35% fashion; GoKwik/ClickPost 25-40% |
| COD share, mid row mean | 0.51 | **0.71** | fashion runs 68-76%, the highest category (Pragma) |

**THE INVENTED CONSTANT WAS WRONG BY ABOUT DOUBLE.** It made refusals run from
16% of returns in the metros to 58% in the towns. On the sourced figures the
range is **31.5% to 43.5%** — the geography penalty is real and roughly half as
dramatic as the guess. Worth remembering the next time a plausible-feeling number
goes in unsourced.

**The two axes are not equally evidenced and are now tagged as such.** Location is
sourced — tier 2/3 runs 58-64% COD across 142 D2C brands. Price is INFERRED, and
the nearest fact cuts against it: RTO by order band is nearly flat, 25% under
₹500, 28% at ₹500-1,000, 24% above. What justifies the axis is reasoning, not
measurement, and the table says so.

**WHAT BUILD 2 CHANGED.** Freight on every refused parcel, and the size guide
reduced to reaching only send-backs. `positions.js` exposes
`returnRateBeforeSizeGuide` and `sizeGuideEffect`; `round.js` rebuilds the rate
per location as `refused + sentBack / sizeGuideEffect`; `attribution.js` carries
`refusedShare` through the return queue so a resolved return knows what freight
it owes; `report.js` charges it against NET profit only — gross is the reading
where nothing came back, and if nothing came back there is no freight.

**MEASURED, twelve weeks, three seeds:**

| cell | refused parcels | freight | share of profit |
|---|---|---|---|
| value / lifestyle | 275 | ₹55L | **13.6%** |
| mid / lifestyle | 126 | ₹25L | 2.5% |
| premium / performance | 13 | ₹3L | 0.6% |

A 23x spread. Flat freight against value's ₹480 margin on a ₹1,200 basket is 42%
of the order; against premium's ₹2,976 it is 7%.

**AND A PREDICTION OF MINE WAS WRONG, WHICH IS WORTH RECORDING.** I argued the
size guide would be worth LESS where COD is higher, since less of the return is
reachable. Measured, the full guide is worth **+10.8%** to value / lifestyle,
**+5.4%** to mid and **+3.4%** to premium — the opposite ordering. The COD effect
is real but subordinate: a premium brand's size guide reaches ~66% of its returns
against value's ~58%, and that 14% difference is swamped by value having half as
much margin and the highest base return rate to begin with. The mechanism is in
the model; it is not what drives the ranking.

**`calibration.test.js` PASSES UNCHANGED.** Build 2 moves economics and does not
move them past the calibrated bounds, so `AD_RANK_FLOOR` and `WEEKLY_VOLUME` hold.
That is a result, not a formality — it was expected to need a re-run.

**CORRECTED BY F14: it passed, and it spent two thirds of I3's headroom doing
so.** The test asserts under 15% and prints nothing when it passes, so nobody saw
the figure move. Replaying the I3 harness at every commit since it was recorded:

| commit | I3 at 350,000 | at the raised budget |
|---|---|---|
| `10fa372` (build 1) | 9.5% | 5.4% |
| `ce04a04` (this build) | **13.2%** | **11.5%** |

The flat ₹200 of freight lands on value's thin margin, and value fell further
below the mean. "Passes unchanged" was true and should have carried the number.

**Build 3, agreed and not started:** the player's lever — a prepaid discount, a
COD fee, or COD off by tier — trading conversion rate against refusals, with
rivals getting it under R6.

**One defect, caught by the suite in seconds.** `byLocation` is keyed by INDEX,
not by tier id — `round.js` writes `locationTier: bucket.tier` and `locationRows`
reads it as `totals[tier]`. Passing the key to `locationIndex` threw on `"0"` and
took the entire report suite down with it. Worth knowing before touching that
breakdown again.

### I29. Order confirmation, and a capital ladder that can be finished — `BUILD 3 OF 3`

**Build 2 charged ₹200 on every parcel refused at the door and gave the player
nothing to do about it.** The size guide reaches send-backs only — no fit chart
stops somebody changing their mind on a doorstep — so refusals were a cost with
no defence, which is a tax rather than a decision. Raised by the player, and
correctly.

**THE FOURTH TARGET.** A WhatsApp or IVR confirmation before dispatch, plus
address verification. Sourced: one automated confirmation cuts RTO by **6-12
percentage points** at a 60-70% response rate; brands running IVR, WhatsApp and
COD-to-prepaid nudges together report **up to 40%**. Against India's 25-35%
baseline that is a 20-40% relative cut, and it reuses `CAPEX_TIER_CURVE`
unchanged — full commitment divides refusals by 1.25, a 20% cut, the
conservative end of the range.

It contributes no page sentence and cannot move a grade, asserted in
`landingPage.test.js`. If that ever starts passing, capital has found a second
route into quality score and L6 is happening again.

**AND IT LANDS EXACTLY WHERE THE FREIGHT DOES**, which is what makes it the
corrective rather than a fourth thing to buy. Measured, twelve weeks, three
seeds, ₹80,000 on one target against funding nothing:

| cell | freight as % of profit | order confirmation buys |
|---|---|---|
| value / lifestyle | 14.3% | **+11.8%** |
| value / performance | 12.4% | **+9.5%** |
| mid / lifestyle | 2.6% | +4.4% |
| premium / performance | 0.6% | +2.0% |

**THE STRUCTURE CHANGED TO MAKE ROOM, AND TWO INVARIANTS DIED.**

The ladder now tops at **₹80,000** and a round allocates **₹1,20,000**, so two
rounds are ₹2,40,000 = exactly three maxed targets of four. The player finishes
three and must abandon one entirely.

The old top rung was what paid for it: ₹30,000 for +0.03, a quarter the
efficiency of the middle of the ladder and worse than the first step. `HANDOVER`
already recorded that the last ₹30,000 "buys almost nothing". Deleting it costs
nothing and the ladder still reaches 1.25.

**One invariant could not be kept, and the arithmetic says so outright.** "One
allocation buys one maxed target" is A = T. "Two allocations fund three of four"
is 2A = 3T. Together they require 2T = 3T. The second is the structure the fourth
target needs, so `CAPEX_ALLOCATION_PAISE === REPOSITION_COST_PAISE` and
`top.paise === CAPEX_ALLOCATION_PAISE` both went. Repositioning stays at
₹1,00,000 rather than following the allocation up — HANDOVER records it as
barely affordable already.

**The second was MEASURED and is a real loss.** `THE BEST PAGE AND BETTER
PHOTOGRAPHY ARE MUTUALLY EXCLUSIVE` held because the top page cost ₹80,000 of a
₹1,00,000 round, leaving less than photography's first rung. At ₹1,20,000 it
leaves ₹40,000 and the exclusion is gone. The trade did not vanish — it moved
from *"page or photos, this round"* to *"which of the four do I abandon, all
game"* — and both forms are now asserted, the old one as a record of what
changed.

**THE MEASUREMENT FOUND SOMETHING BIGGER THAN THE CHANGE, AND IT IS OPEN.**
₹80,000 on each target, every cell:

| cell | order conf. | size guide | **photography** |
|---|---|---|---|
| value / performance | 9.5% | 8.9% | **65.1%** |
| mid / performance | 4.0% | 5.0% | **49.9%** |
| premium / performance | 2.0% | 3.4% | **35.2%** |
| value / lifestyle | 11.8% | 11.4% | **56.9%** |
| mid / lifestyle | 4.4% | 5.6% | **39.7%** |
| premium / lifestyle | 2.3% | 4.0% | **31.1%** |

**Photography is five to seven times better than either alternative in every
cell.** The reason is structural and predates all of this work: photography
multiplies `convRateBase`, so a 25% lift is 25% more revenue on the same ad
spend, while the two return targets divide a rate that is only ~24% of revenue
to begin with. A 25% cut in returns is worth about 6%.

So "which three of four" is not yet the choice it is meant to be — everybody
buys photography first, and the real decision is over the remaining two slots.
D7's argument assumes the targets are comparable and they are not.

**Not fixed here, deliberately.** It predates build 2 and I29; those only made it
visible by giving it something to be compared against. Options, none taken: give
photography its own flatter curve; move some of its effect onto a target that
costs something elsewhere; or accept that one target dominates and rewrite D7 to
say the choice is among the other three.

**One thing the measurement CANNOT say.** Profit across the six cells spreads
3.40x best to worst, and F13 records 1.55x by purpose against 1.27x by price.
Those are not comparable — F13 measured realised profit across 30 markets with
live decisions, this is one fixed account making no decisions after round 0 — so
nothing here shows the spread widened. A matched before-and-after would be needed
to claim that, and it has not been run.

### I30. Photography climbs a longer, shallower ladder — `FIXED, and not fully`

I29's measurement found that **photography was worth 5.4x the next best target in
every cell**, so "which three of four" was not a choice: everybody bought
photography and the real decision was over the leftovers.

Structural rather than a tuning slip. Photography multiplies `convRateBase`, so a
25% lift is 25% more revenue on advertising that costs the same either way. The
two return targets divide a rate that is only about a quarter of revenue, so a
25% cut there is worth about 6%.

**PRICE ALONE COULD NOT FIX IT**, and the arithmetic is kept because the idea will
come back:

- to make photography no better per rupee than the landing page it would have to
  cost **₹4,35,068** — **1.8x the ₹2,40,000 the whole game provides**, so nobody
  could ever buy it
- cutting the other three to match photography per rupee puts all four at
  ₹1,15,000 together, **leaving ₹1,25,000 spare** — you buy everything and the
  choice disappears, which is where the rejected carryover idea also led

**Equal value per rupee was never the goal anyway.** If all four pay the same,
every allocation is as good as any other and there is still nothing to decide.
What makes a choice is comparable size with DIFFERENT ORDERING BY CELL, and the
other three already had it — the landing page pays most at `premium|performance`,
exactly where the size guide and order confirmation pay least.

**WHAT SHIPPED.** Photography gets `CAPEX_PHOTOGRAPHY_CURVE`: 0 / ₹50,000 /
₹1,10,000 / ₹1,60,000 at 1.00 / 1.02 / 1.07 / **1.11**, against the shared
0 / ₹25,000 / ₹55,000 / ₹80,000 at 1.00 / 1.04 / 1.16 / 1.25. Two strategies then
cost exactly the ₹2,40,000 two rounds provide: **photography plus one other**, or
**three of the other three**.

**MEASURED AFTER, six cells, three seeds, and the target was hit:**

| target | before | after | cost | per ₹10,000 |
|---|---|---|---|---|
| photography | 46.3% | **20.0%** | ₹1,60,000 | 1.25 |
| landing page | 8.5% | 8.5% | ₹80,000 | 1.06 |
| size guide | 6.4% | 6.4% | ₹80,000 | 0.80 |
| order confirmation | 5.7% | 5.6% | ₹80,000 | 0.71 |

The aim was "about +20% of profit" and it landed on 20.0%. Photography's lead over
the best alternative fell from **5.44x to 2.36x**, and **to 1.18x per rupee.**

**IT IS NOT FULLY FIXED, AND THE HONEST NUMBER IS THE STRATEGY ONE.** Comparing
the two ₹2,40,000 routes:

| cell | photography + best other | three others | ratio |
|---|---|---|---|
| value / performance | 37.6% | 23.4% | 1.61x |
| mid / performance | 27.1% | 14.7% | **1.84x** |
| premium / performance | 27.8% | 17.7% | 1.57x |
| value / lifestyle | 36.4% | 33.2% | **1.10x** |
| mid / lifestyle | 25.8% | 19.0% | 1.36x |
| premium / lifestyle | 22.4% | 15.1% | 1.48x |

**Photography still leads in all six cells**, by 1.10x to 1.84x. It is a real
choice now rather than a solved one — `value|lifestyle` is nearly a coin toss —
but it is not balanced, and calling it balanced would be the second time this
ledger recorded a prediction that the measurement did not support.

Two caveats on those figures. **The gains are not additive** — they interact
through the auction, so summing three of them overstates the combined result by
an unknown amount, and the "three others" column is the more overstated of the
two. And there is a case that photography SHOULD lead: raising conversion rate
genuinely is the highest-leverage move in performance marketing, because the ad
spend is fixed either way. 5.4x was "no decision"; 1.5x is arguably the lesson.

**F14 moved this a long way without trying to.** Raising returns to the sourced
level gave the two returns targets twice as much to act on. On F14's harness
(not comparable in absolute terms with the table above), per ₹10,000: photography
0.34 → 0.54, size guide 0.15 → **0.88**, order confirmation 0.05 → 0.65. The size
guide now beats photography per rupee, and photography is the best single target
in 4 cells of 6 rather than 5.

**Three things the suite caught that would otherwise have shipped.**

`capexCurveFor` was written into `constants.js`, and a FUNCTION there hid
`CAPEX_PHOTOGRAPHY_CURVE` from the guard that checks every constant is read
outside its own file. Moved to `positions.js`.

The new curve was tagged `CALIBRATE` and the provenance test refused it, by its
own stated rule: *"is the thing being added genuinely unsettleable, or merely
unmeasured?"* It was FITTED to a measurement, so it is settled by evidence.
Retagged `ESTIMATED`; the CALIBRATE set stays at the five the spec and G4 pinned.

`landingPage.test.js` compared all four ladders against `CAPEX_STEPS`, which
would have passed silently if photography's rungs were ever reset to the shared
ones. It now checks each target against its own ladder, **plus a guard asserting
photography's really is the longer one** — without which the first assertion is
vacuous.

### I31. What came back, given somewhere to be watched — `FIXED`

**Raised by the player: why is there no section for RTO and return statistics?**
There wasn't, and the inventory is short enough to be damning. During a whole
game, returns appeared in exactly two places:

- a sub-label under net profit — *"less ₹Y freight"* — this week only, one number
- three columns on **the location card**, which is a card about geography

No account-level return rate existed anywhere before the end screen, by which
point nothing can be done with it.

**AND THE SHARPEST CONSEQUENCE.** `locationRows` sums every week played and has
no week/all toggle — the search terms card has one, that card does not. So a
capex landing at round 4 is permanently diluted by rounds 1 to 3 in a cumulative
average. **A player could spend ₹80,000 on order confirmation and never find out
whether it worked.** Build 2 added a cost and build 3 added the lever against it,
and neither got a place to be watched.

Same shape as I16 (*"your copy is not live yet"*), I24 (the location card states
a fact and names no lever) and *two of three capital targets have no surface*.

**WHAT SHIPPED.** One card, `What came back`, carrying five figures and a bar per
week. On a played `value|lifestyle` account at week 9:

| | |
|---|---|
| Came back | 35.9% — 305 of 849 orders |
| Refused | **15.3%** — 130 never delivered |
| Sent back | 20.6% — 175 after delivery |
| Freight paid | **₹40,009** |
| Paid at door | 82%, weighted across where the clicks went |

**The week column is the point of it**, and the reason the card exists rather
than three more columns somewhere: each week is its own bar, so the round an
investment lands is a step rather than a smudge. Weeks that have not settled are
dimmed rather than hidden — a gap where a week should be reads as a bug.

**The arithmetic the player asked for is computed from their own account**, not
from a constant: *"every refusal costs you about ₹712 — ₹200 of freight both
ways, and ₹512 of margin on a sale that never happened."* Margin is recovered
from the gross figures, which is only possible because gross carries no freight
term (I28 build 2).

**It reuses the arrival chart's row grammar deliberately.** Both are "one bar per
week, split in two", and a player who has learned to read one should not have to
learn the other. Only the colours differ, because these two halves are a problem
where the arrival chart's two are a delay.

**The location columns stay.** They answer *where*; this answers *how much, and
is it improving*. The duplication is deliberate and worth watching: I19's whole
lesson was two surfaces disagreeing, so both read `refused` from the same
`conversions.refused` the engine writes, never from a second derivation.

**Dead space was measured, not eyeballed.** The first build left 110px of slack
at the bottom — the grid stretches rows and the neighbouring card is taller. The
fifth figure was the fix rather than padding: it was in the proposal, had not
been built, and adding it took the slack to **24px**, which is the card's own
bottom padding. Verified at 1152, 1280, 1366, 1440 and 1920 with no card on the
screen overflowing at any of them.

### I32. Which search sent it back — `FIXED`

**The player's criticism, and it was right:** the returns chart is a statistic
rather than something to work on. Capital closes at round 5, and after that a
player watches a number they cannot move.

**They can move it, and the data to do so was being thrown away.** `queueReturns`
has carried `queryId` on every resolved return since it was written. The revision
loop credited the LOCATION and dropped the query. So a player could see that the
towns return badly and never that a SEARCH does — leaving the one lever available
in every round unusable on return grounds, with the block button already sitting
on the row.

**51 of the queries carry a `ret:` multiplier**, six distinct values from 0.85 to
1.2. Attributing returns back to the query costs nothing and moves nothing: the
returns already happened and were already charged. `report.test.js` asserts the
query rows and the keyword rows each sum to the account's own total.

**Measured on a broad account at week 7:** 59 searches with returns, a **6 point**
spread, and five flagged as worse than the account's own rate — `flared leggings
under 699`, `crop top under 299`, `sports bra combo pack`, `sports bra under 500`.
Those are precisely the queries carrying 1.15 and 1.2, so the multiplier reads
through end to end.

**THREE MISTAKES OF MINE, AND THE FIRST TWO ARE THE SAME MISTAKE TWICE.**

The test asserting that rates vary read `history.at(-1)` — the last week, whose
returns have not resolved, because a return needs two rounds after the
conversion. Every rate was 0 and the test reported a working feature as broken.
**Then I blamed the fixture, rewrote it against the real query set, and it failed
again for the identical reason.** The fixture WAS also wrong — it hardcodes
`returnRateMultiplier: 1.0` on every query — but that was not what the test was
measuring. Two wrong diagnoses of one symptom.

The column divided by `conversions + returned`. A returned order was already
counted when it landed, so `returned` is a SUBSET of `conversions` and the sum
double-counts. Every rate was understated.

The highlight used a fixed 34% and never fired, because a `mid|lifestyle` account
runs at 20-22%. It now compares each search against **this account's own rate**
over exactly the rows on screen — which is the comparison a negative is actually
made on, and it adapts to whatever cell the player chose.

**The column is called `Came back` and not `Sent back`.** The returns card uses
`Sent back` for the post-delivery half specifically, against `Refused`; this
column is both. Two surfaces using one word for two quantities is I19's lesson.

### I33. The week-8 deadline, and the levers the returns card was not naming — `FIXED`

Two halves of one complaint: a statistic you cannot act on, and an empty half of
a row.

**THE LEVERS.** The returns card was a chart with no verbs. Capital closes at
round 5 and nothing named the two levers that never close, so a player watched a
number they had no way to move — exactly what I24 says about the location card.
It now names three and says which are open THIS round, read off
`capexAllocationRounds` rather than assumed: bid down where cash is commonest,
block a search that comes back worse than the rest of the account (possible only
since I32 attributed returns to the query), and capital when its window is open.

**THE DEADLINE CARD, AND WHAT IT DELIBERATELY DOES NOT SHOW.**

The player asked for the final-round rankings in short form, mid-game. **That is
I7, refused before**: *"Asked for a graph putting all nine advertisers side by
side to evaluate who has the current lead. The chart exists; the framing could
not."* The lead is cumulative gross profit, and R3 forbids reading that about
anybody else. `finalStandings` opens the books only because the game is over.

**But the legal version was missing and is more useful than a leaderboard.** Month
3's budget is allocated on cumulative gross profit at week 8, the rule is
announced at round 1 — and no screen showed that total accumulating. The player
was ranked on a number they could not watch. Same shape as I16, I24 and I31.

So the card carries the player's OWN running total, the weeks left, and what each
finish is worth in rupees:

| finish | month 3 | vs average |
|---|---|---|
| 1st | ₹2,18,400 | +30% |
| 5th | ₹1,68,000 | 0% |
| 9th | ₹1,17,600 | −30% |

**₹1,00,800 separates first from last**, on a pool that does not change size —
and the dashboard had never said so.

Not one figure on it belongs to a rival, and **the note says so outright** rather
than letting the omission read as an oversight: *"Nothing here tells you where
you stand against the other eight. It cannot."* A gap a player notices and
understands teaches R3; a gap they merely notice reads as a missing feature.

It sits beside the search terms card, which was alone on its row with **685px of
empty width** — measured, and the reason this card exists where it does.

**The budget card already covers the other half** — after week 8 it names the
rank and D4's two traps. This is the part that can still be acted on.

### I34. A prepaid discount, and the version of it that was a trap — `FIXED, and modest`

**The gap the player named:** every lever on returns shut at round 5. What was
left — a bid adjustment and a negative — moves your MIX and your TRAFFIC. Neither
moves a rate.

A prepaid discount does, and it is an operating decision rather than a capital
project, so it is open every week. Sourced, including its shape: ₹30-50 shifts
10-20% of the cash mix, and the returns diminish hard — ₹30 to ₹50 is a 38%
improvement, ₹50 to ₹70 only 12%, past ₹100 under 5% per further ₹25. Those three
deltas build `PREPAID_DISCOUNT_CURVE` rather than a guess.

**DIMINISHING, NOT AN S**, deliberately unlike `CAPEX_TIER_CURVE`. Capital rewards
committing because half a fit tool helps nobody; a discount does not work that
way, and a second S would teach one lesson twice.

**FLAT RUPEES**, which is the whole of its balance: ₹50 is 4.2% of a value
brand's ₹1,200 basket and 1.0% of a premium brand's ₹4,800, so the advertiser
with the most refusals to prevent pays the most to prevent them.

**THE FIRST VERSION WAS STRICTLY DOMINATED, AND THE MEASUREMENT CAUGHT IT.**
"No discount" won in all six cells, monotonically, at every rung.

The fault was mine and it was structural. `round.js` read one share for both
halves:

    refused  = gross x rtoShare(discount)
    sentBack = gross x (1 - rtoShare(discount))

Those sum to `gross` EXACTLY, whatever the discount is — `rtoShareOfReturns` is a
share of a fixed total, which was correct for build 1's "it splits, it does not
add" and wrong the moment something tried to move the total. So the discount
converted refusals into send-backs one for one: it bought a change of door, not
a kept sale, and the only saving left was ₹200 of freight against a margin lost
either way. Per order at ₹30 that is **−₹5.39** for value, **−₹8.22** for mid,
**−₹14.19** for premium.

**Two of my own calculations disagreed and that is what found it** — the
per-order arithmetic said the discount should pay in five of six rows while the
played game said it lost in all six. Neither number was wrong; the wiring
between them was.

It was also wrong about the world. Prepaid RTO runs 5-10% against COD's 25-35%,
and somebody who has already paid mostly does not send it back either. So
send-backs are now computed from the mix BEFORE the discount, and the refusals it
prevents leave the account rather than reappearing.

**AFTER THE FIX, measured the same way — 90 games, six cells, five rungs, three
seeds:**

| cell | best rung | gain over none | what ₹100 costs |
|---|---|---|---|
| value / lifestyle | ₹30 | **+1.4%** | −1.2% |
| value / performance | ₹30 | +0.4% | **−3.2%** |
| mid / lifestyle | ₹30 | +0.4% | −0.4% |
| premium / lifestyle | ₹30 | +0.2% | −0.6% |
| mid / performance | **none** | 0.0% | −1.5% |
| premium / performance | **none** | 0.0% | −1.0% |

**IT IS A REAL LEVER AND A MODEST ONE, AND THE SECOND HALF OF THAT MATTERS.**
₹30 is right in four of six cells and the gain is 0.2% to 1.4% — closer to a
slider with an obvious answer than to a fork. What it teaches properly is the
penalty: ₹100 loses in every cell, up to 3.2%, which is exactly the diminishing
return the sources describe. "A little helps, a lot hurts" is a true lesson and
a small one.

The two cells that decline it are the two with the fewest refusals to prevent, so
the cell-dependence is real but narrow.

**THE CARD CRASHED THE GAME AFTER WEEK 1, FROM THE DAY IT SHIPPED.** Found
2026-09-11 by the first smoke test of the deployable build, not by the suite.
`prepaidCard` asked for `refusalRateFor(ctx.price, ...)` and nothing ever set
`ctx.price`, so it requested the cash mix of price tier "undefined", which
throws. The card draws on the dashboard after every week, so a player pressing
"Open the account and run week 1" got round 0 back with an error in the console
and no dashboard. 1348 tests passed throughout — none of them draws the card —
and the commit that built it records tests and calibration but no browser.

That is this project's most repeated defect shape, and the rule that would have
caught it is already written in HANDOVER: open the browser before believing the
interface works. Fixed by reading the tier from the draft's position, and the
arithmetic moved out of the render into `prepaidOutlook(draft, rows)`, where four
tests hold it — including one on a real draft after a real round.

**LESS MODEST SINCE F14, without touching the curve.** The return level rose to
the sourced total, so there are more refusals to prevent everywhere. On F14's
harness ₹50 is now best in all six cells for +1.2% to +2.7%, where the same
harness gave ₹30 in five of six for +0.0% to +1.2% before; ₹100 loses only at
value/performance. Still one lever with one effect — the curve and the rule
below are unchanged.

**Not strengthened, deliberately.** The obvious way to make it bigger is to let
it lift conversion rate, which a discount genuinely does and which was excluded
on purpose so the lever has one effect. Doing that would also make it partly pay
for itself, which is a different mechanic from this one. If the modesty is a
problem, that is the lever to pull — and it should be pulled on purpose rather
than by retuning this curve until the answer flatters the idea.

**Rivals pull it too (R6)**, reading their own refusal rate rather than a
constant, one rung and not a hill-climb: 5.2 wants a competent operator, not a
solver. And `submitRound` REJECTS an out-of-range discount rather than clamping
— a clamp would let a controller ask for ₹500 and be quietly charged for ₹100,
which is the shape of bug that survives a whole game.

### F14. The engine contradicts itself about returns — `FIXED`

**RESOLVED 2026-09-11, and it took four constants rather than three numbers.**
The return level is now the total the engine's own DOCUMENTED constants imply,
and a test holds it there; the price axis was allowed to flatten; and three
further changes turned out to be forced by the first — `PURPOSE_MODIFIERS.ret`,
`AD_RANK_FLOOR` and `WEEKLY_VOLUME`. *What shipped* at the end of this entry
carries every measurement. What follows first is the finding, as recorded before
anything moved.

**THE BIGGEST OPEN PROBLEM IN THE MODEL, and it was introduced by I28.** Found on
2026-09-11 by starting to source `POSITION_ECONOMICS`, which is what that
exercise is for.

`POSITION_ECONOMICS.returnRate` was authored as POST-DELIVERY returns. Its own
comment says so and says nothing else: *"price shoppers order two sizes meaning
to return one"*, and premium has *"fewer returns because the size guide is better
and the buyer is committed"*. Fit, not refusal.

**I28 split that number as though it already contained refusals, and held the
total fixed.** So a figure meaning "returns after delivery" was silently
redefined as "returns of every kind" without changing its magnitude — and the
engine's own DOCUMENTED constants, added the same day, say what the total should
actually be:

| cell | model refused | sourced | model sent back | sourced | model total | sourced |
|---|---|---|---|---|---|---|
| value | 12.8% | **18.2%** | 17.2% | **24.5%** | 30.0% | **42.7%** |
| mid | 9.6% | **16.8%** | 14.4% | **25.0%** | 24.0% | **41.7%** |
| premium | 6.9% | **13.8%** | 13.1% | **25.9%** | 20.0% | **39.6%** |

Sourced side: `RTO_RATE_COD` 20.9% and `RTO_RATE_PREPAID` 5.8% blended at each
tier's own COD mix, then `POST_DELIVERY_RETURN_RATE` 30% on what survives.
**Every figure the model uses is understated, by 30% to 100%.**

**This is not a benchmark disagreement.** It is the engine's INVENTED constant
disagreeing with the engine's own DOCUMENTED ones. One of them has to move.

**WHY IT IS NOT FIXED HERE.** Raising `returnRate` to the sourced total nearly
doubles returns, which moves net revenue, net profit, net ROAS, the location
spread G4 rests on, F13's purpose measurements, and every figure quoted in
`HANDOVER.md` under *What measuring it found*. `AD_RANK_FLOOR` and
`WEEKLY_VOLUME` are `CALIBRATE` and would almost certainly need retuning. That is
a session's work with a measurement at each step, not a tail-end edit.

**OPTION 1 IS CHOSEN** (2026-09-11). Raise `returnRate` to the sourced total and
recalibrate. The three options are kept below because the reasoning against the
other two is the reason this one was picked.

**TWO THINGS MEASURED AFTER THE DECISION, and the second may reopen it.**

**Only the LEVEL is wrong — the split is already right.** `rtoShareOfReturns`
gives 42.5 / 40.1 / 34.6% against a sourced 42.5 / 40.2 / 34.7%, so nothing about
the refused/sent-back ratio needs touching. This is a three-number change plus a
calibration run, not a re-derivation of the chain. The targets, back-solved
through `PURPOSE_MODIFIERS.ret` (mean 1.025) because `locationEffects` normalises
to a mean of 1:

| cell | is | should be | target total |
|---|---|---|---|
| value | 0.30 | **0.417** | 42.7% |
| mid | 0.24 | **0.407** | 41.7% |
| premium | 0.20 | **0.387** | 39.6% |

**IT ALSO FLATTENS THE PRICE AXIS, AND THAT CONTRADICTS THE AUTHORED STORY.**
Today the spread is 30 / 24 / 20 — **1.5x** from value to premium. The sourced
targets spread **1.08x**. So the price tier would barely affect returns at all,
and `POSITION_ECONOMICS`'s own comment — *"price shoppers order two sizes meaning
to return one"*, premium has *"fewer returns because the size guide is better and
the buyer is committed"* — becomes largely false.

**That flatness is probably an artefact of my sourcing rather than a fact.**
`POST_DELIVERY_RETURN_RATE` is a single 30% for all tiers because the sources
found quote fashion returns as one figure and do not break them down by price
point. What genuinely varies by tier in the sourced view is the COD mix, and that
is already modelled. So before implementing, consider whether
`POST_DELIVERY_RETURN_RATE` should take a per-tier variation of its own — which
would keep the authored story AND the sourced level — or whether the flattening
is accepted and the comment rewritten. **Do not simply paste the three numbers in
without settling that**; it is the difference between importing evidence and
importing a gap in the evidence.

**The three ways out, for the record:**

1. **Raise `returnRate` to the sourced total** (~43 / 42 / 40%) and recalibrate.
   Most honest, largest blast radius, and it makes the whole vertical harsher —
   which is arguably true to Indian D2C apparel and arguably a worse game.
2. **Keep `returnRate` as post-delivery only and add refusals on top.**
   Economically identical to (1); the difference is which constant carries the
   meaning, and this version keeps the authored comment true.
3. **Accept the model's total as a deliberate simplification** and say so in
   `POSITION_ECONOMICS` — that the simulator runs a gentler returns regime than
   the market, on purpose, so twelve rounds are playable. Cheapest, and it
   requires writing down that the number is not the market's.

**What sourcing `POSITION_ECONOMICS` found about the other three fields**, since
that was the task:

- **AOV ₹1,200 / ₹2,400 / ₹4,800** — defensible. Indian D2C quotes ₹1,200-2,500
  as a good AOV band and ₹500-1,500 as the most commercially active; the value
  and mid tiers sit inside that and premium sits deliberately above it.
- **`marginPct` 40 / 52 / 62%** — defensible but at the low end. Indian fashion
  apparel is quoted at 35-55% gross and digital-first D2C fashion at 65-70%, with
  "above 60% healthy, below 50% very difficult". The model's value tier at 40% is
  therefore in a regime the sources call very hard, which may be intended.
- **`convRateBase` 4.2 / 2.8 / 1.6%** — **not comparable to the benchmark that
  looks like it.** Indian D2C site-wide conversion is quoted at 1.8-3%, but this
  is conversion on a PAID SEARCH CLICK, and brand search alone is quoted at
  4-8%. The benchmark and the constant are different quantities and the
  temptation to "correct" 4.2% down to 3% should be resisted without a
  like-for-like source.

**The tag stays `INVENTED`** on all of it. Three of the four fields now have
evidence beside them and one is contradicted, which is more than they had, but
none has a citation tight enough to call `DOCUMENTED`.

#### What shipped

| | was | is | tag |
|---|---|---|---|
| `POSITION_ECONOMICS.returnRate` | 0.30 / 0.24 / 0.20 | **0.427 / 0.417 / 0.396** | object stays `INVENTED`; the level is pinned to the DOCUMENTED chain |
| `PURPOSE_MODIFIERS.ret` | 0.85 / 1.20 | **0.91 / 1.09** | `INVENTED` |
| `AD_RANK_FLOOR` | 60 | **48** | `CALIBRATE` |
| `WEEKLY_VOLUME` | 350,000 | **430,000** | `CALIBRATE` |
| `ASSUMED_RETURN_RATE` (policy, C7) | 0.25 | **0.40** | policy number |

Plus the round 0 briefing: *"About two in five orders come back category-wide,
counting parcels refused at the door as well as those sent back. Price barely
changes how often; it changes how much each one costs you."*

**THE PRICE QUESTION WAS SETTLED BY ACCEPTING THE FLATTENING.** Giving
`POST_DELIVERY_RETURN_RATE` a per-tier shape would have put an invented shape
inside a DOCUMENTED constant — the exact thing this entry is about. And the
evidence does not support the old story: the only breakdown by order value found
is flat (RTO 25 / 28 / 24%), what is quoted about post-delivery returns by price
leans the other way (luxury 18-30%, a high price leaving less tolerance for a
mismatch), and "the size guide is better" gave premium for free a capital target
every tier can buy. So the `POSITION_ECONOMICS` comment was rewritten rather than
the data bent: cheap goods do not come back much more often; each one that does
costs more, because ₹200 of freight is 42% of value's margin and 7% of premium's.

**THE PIN.** `constants.test.js` computes, for each price tier, refusals on its
own cash mix plus `POST_DELIVERY_RETURN_RATE` of what is delivered, weighted by
where that tier's searches are, and holds `returnRate` × the mean purpose
modifier to it within half a point. Mutation-tested three ways — `RTO_RATE_COD`
0.26, `POST_DELIVERY_RETURN_RATE` 0.35, premium's `returnRate` 0.20 — and it
fires on each. `ret` averages exactly 1.0 by design, so nothing is back-solved.

**EACH FURTHER CHANGE WAS FORCED BY THE ONE BEFORE, AND EACH WAS MEASURED.**

1. **Option 1 as written failed I3 three ways, and no `CALIBRATE` constant
   could fix it.** The same 1.41x purpose ratio on a 40% base over-penalised
   lifestyle. Measured with the replica of the I3 harness:

   | | I3 worst | spread | lifestyle ÷ performance | I4 neutral gap |
   |---|---|---|---|---|
   | before | 13.2% | 1.23 | 0.998 | 3.3% |
   | option 1 | **21.1%** | **1.45** | **0.865** | 14.5% |
   | option 1, volume 320,000 | **18.2%** | **1.37** | **0.860** | 14.5% |
   | option 1, floor 30 | 12.3% | 1.25 | **0.859** | 14.5% (I1 breaks) |

   The tilt sat at 0.86 whatever the volume or floor. `ret` narrowed to
   0.91/1.09 — see F11 — and the tilt went to 1.01.

2. **At 350,000 that passed I3 by 0.6 points**, so 330,000 was chosen first.

3. **Then the rival prior made two rivals go dark.** Moving
   `ASSUMED_RETURN_RATE` to the briefing's 0.40 is correct — real ceilings fell
   20-30% — but `AD_RANK_FLOOR` is a fixed price and did not move, so relative
   to every ceiling it became a quarter stricter. Played, 12 rounds, the twelve
   seeds `setup.test.js` uses:

   | | rivals with a dark week | DIY player on `disciplined`, week 1 |
   |---|---|---|
   | before F14 | 0 | trades |
   | F14 constants, prior 0.25 | 0 | trades |
   | F14 constants, prior 0.40 | **14, on 10 of 12 seeds** — both `cautious` seats, 1-4 weeks | **0 impressions** |

   Caught by `setup.test.js`'s guard that every rival clears the reserve —
   exactly what it was written for, after a rival once showed in nothing for
   twelve rounds. Four ways out were put to the user: loosen the guards, make
   `cautious` braver, keep the prior at 0.25, or move the reserve. **The reserve
   moved**, because leaving it put was itself a change: A8 and B1 record raising
   it as regressive, and that is what standing still did.

4. **A lower reserve moved the volume window.** In a thin auction the reserve is
   the price, so cheaper clicks need more searches before a budget binds.
   Measured on the repo:

   | volume | I1 spend | I1 lostToBudget | I3 worst | |
   |---|---|---|---|---|
   | 330,000 | 0.857 | 0.0% | 6.0% | I1 fails |
   | 400,000 | 1.000 | 3.8% | 7.5% | |
   | **430,000** | 1.000 | 10.5% | 11.3% | |
   | 460,000 | 1.000 | 16.3% | 14.9% | I3 at its bound |
   | 500,000 | 1.000 | 23.0% | 19.6% | I3 fails |

   The window moved from about 315,000-375,000 to 395,000-460,000. Both
   jaw tests in `calibration.test.js` moved with it — the lower probe from
   225,000, which after F14 sat so far below the window it tested nothing, to
   330,000; the upper from 400,000, which now sits inside, to 500,000.

**CALIBRATION, BEFORE AND AFTER**

| | before | after |
|---|---|---|
| I1 lostToBudget | 12.0% | 10.5% |
| I2 median CPC against value's realised ceiling | ₹20.02 / ₹34.56 | ₹15.84 / ₹28.22 |
| I3 worst / raised budget | 13.2% / 11.5% | **11.3% / 7.8%** |
| I3 lifestyle ÷ performance | 0.998 | 1.012 |
| I4 purpose gap, neutral / realised | 3.3% / 11.2% | 1.5% / 12.0% |
| I4 price, premium ÷ value (neutral) | 2.63x | 2.47x |

I3 ends with MORE headroom than it started with. The three location tables were
not retuned: I3 passes with them unchanged, and `locationEffects` centres each
position on its own country, so a change of level passes through them. G4's own
payoff figures could not be re-measured — see the harness finding below.

**WHAT IT DID TO PLAYED GAMES.** One harness, run before and after: 30 markets
with a passive `mid|performance` player for the market figures, and 6 cells × 3
seeds for the player's own account. Absolute figures are this harness's and are
NOT comparable to earlier entries; the direction of each change is the finding.

| | before | after |
|---|---|---|
| returns across the market | 22.4% | **34.2%** |
| freight as a share of net profit | 3.7% | 6.9% |
| market net profit per game | ₹66.6L | ₹62.3L (−6.5%) |
| market gross profit per game | ₹98.1L | ₹124.3L (more clicks: 281k → 334k) |
| market spend / net ROAS | ₹42.3L / 5.16 | ₹42.2L / 5.08 |
| lifestyle ÷ performance, net profit (F13) | 1.58x | **1.73x** |
| lifestyle top rival, net | 26 of 30 | 27 of 30 |
| capital per ₹10,000: photography / size guide / order confirmation / page | 0.34 / 0.15 / 0.05 / 0.18 | 0.54 / **0.88** / 0.65 / 0.20 |
| best single capital target | photography in 5 of 6 cells | photography in 4, size guide in 2 |
| best prepaid discount | ₹30 in 5 of 6, +0.0-1.2% | **₹50 in 6 of 6, +1.2-2.7%** |

Two of those are gains nobody set out to buy. **The returns levers caught up
with photography** — per rupee the size guide now beats it, which is most of
what I30 left open. And **the prepaid discount became a decision** rather than a
slider with an obvious answer (I34), because there is now twice as much to
prevent.

**F13 IS VISIBLY WORSE, AND THAT IS THE HONEST OUTCOME.** Option 1 as written
would have taken lifestyle's profit down through returns, partly cancelling the
cheaper clicks F13 is about — two wrongs making a smaller one. Holding I3 level
removed that accidental offset. F13's cause is broad match spilling one way
across the tags, and it should be fixed there.

**THREE THINGS IT FOUND THAT WERE WRONG BEFORE IT STARTED.**

- **I3 had drifted from 9.5% to 13.2% and nobody knew.** Replaying the harness
  at every economics commit since it was recorded puts the whole move at
  `ce04a04`, I28 build 2. I28 is corrected in place. The test asserts under 15%
  and prints nothing when it passes — a passing invariant is not a measurement.
- **The briefing's worked anchor was a hard-coded string**: "₹2,400 x 52% x 76%
  x 2.8% = ₹26.56". This change would have left the engine computing ₹20.37
  under a sentence saying ₹26.56, and `setup.test.js` would have stayed green —
  it asserted the string contained "26.56". The sentence is built from the
  constants now, and the test checks the words against the fields.
- **F13, I30 and G4 cannot be re-run, because none recorded its harness.**
  The replica used here reproduces the calibration figures EXACTLY at the
  commits where they were written (9.5 / 17.0 / 5.3%) and I34's discount ranking
  roughly. Against F13's recorded 1.55x / 1.27x / 28 of 30 it gives 1.69x /
  1.79x / 27 — identically at F13's own commit and at HEAD, so the engine did
  not move them and the difference is the unrecorded player setup. I30's and
  G4's figures depend on a player account that was never written down either.
  The comparison above is therefore before-and-after on one harness, which is
  the only claim it makes.

**RECORDED AND NOT FIXED: THE LOCATION GRADIENT SITS ON THE WRONG HALF.** The
sourced chain is nearly flat by location (towns 1.04-1.06x the metros) because
`POST_DELIVERY_RETURN_RATE` and the RTO pair are single figures. There the
flatness is known to be wrong — tier-3 RTO is quoted at 3-5x the metros, far more
than the cash mix explains — which is why `LOCATION_RETURN_MULTIPLIER` carries a
1.5x gradient. But it multiplies the WHOLE total, and the refused/sent-back split
is applied afterwards, so send-backs also come out 1.36-1.40x higher in the
towns. That is arithmetic from `round.js` rather than an observation in play,
and it contradicts I28's measured *"the send-back rate is flat"* — which was
measured on an earlier COD table. The evidence says the gradient belongs on
refusals. Not touched here: F14 was already four constants.

### F15. The market is profitable for almost everyone, and the reason is click-through and conversion — `OPEN` (2026-09-12)

**The question.** The SLC review (9A-3) asked whether the market is too
profitable to teach that most traffic is marginal. Nothing had checked
absolute levels: calibration invariants I1–I5 test balance and budget binding,
not whether a rupee of ads returns what it would in life.

**The harness, recorded so it can be re-run:**
- `startGame` on `content/querySet.js`, seeds 1–12, the player
  (`BRAND_IDENTITIES[0]`) in each of the six cells, so 72 markets;
- the agency writer;
- the six highest-volume searches of the player's cell on PHRASE at 0.7 ×
  `realisedBreakEvenCpcPaise` (F14's harness), plus its own brand search on
  EXACT at 1.2×;
- rivals on `controllerFor(policyId)`, asserted live;
- `playGame` in `mode: 'expected'`;
- economics over weeks 1–7 only (fully settled, returns included), from
  `gameTotals(...).weeks`; per-search figures summed from each report's
  `breakdown.byQuery`;
- 3m16s on this machine.

**Measured, medians over settled weeks:**

| | click-through | cost per click | conversion | gross ROAS | net ROAS | profit per ₹ spent | returned |
|---|---|---|---|---|---|---|---|
| player, all cells (72) | 8.1% | ₹19.9 | 5.3% | 7.95 | 4.51 | 1.07 | 43% |
| all rivals (576) | 5.4% | ₹10.5 | 4.6% | 9.87 | 6.00 | 1.74 | 41% |
| rival `spender` | 7.6% | ₹16.8 | 3.3% | 4.56 | 2.72 | 0.27 | 40% |
| rival `cautious` | 3.6% | ₹6.6 | 5.2% | 17.13 | 10.20 | 3.68 | 42% |

By cell, the player's profit per rupee ran from 0.56 (`mid|performance`) to
2.18 (`premium|lifestyle`). **8 of 648 advertiser-games lost money over the
settled weeks, and the player lost in 0 of 72.**

**Against benchmarks (their quality stated, because none is Indian search
apparel data from a named dataset):**

| | sim | benchmark | source and quality |
|---|---|---|---|
| cost per click | ₹10–20 | ₹8–40 on category keywords, Indian D2C | Balistro: agency's own campaigns 2024–26, no dataset cited |
| click-through | 5.4–8.1% | 3.2% apparel search | PPC Chief: global, mostly US; own 200+ accounts plus WordStream |
| conversion | 4.6–5.3% | 3.8% apparel search | PPC Chief, as above |
| gross ROAS | 7.9–9.9 | 4.2× apparel, all campaign types; 4.5–8× Indian D2C search | PPC Chief; Balistro |
| returns | 41–43% | 25–40% fashion (constants.js, DOCUMENTED) | GoKwik, ClickPost |

**So cost per click is realistic, and returns sit at the top of their sourced
band, where F14 put them.** The excess is in **click-through (about 2×)** and
**conversion (about 1.5×)**, which multiply into gross ROAS at or above the top
of the Indian range.

**Why, and which parts are recorded choices:**
- **Click-through: B6.** The results page holds only ads, so four ads share
  attention no organic results, shopping units or AI answers compete for. That
  simplification alone raises ad click-through. It was recorded as WONTFIX, but
  its effect on economics was never measured until now.
- **Conversion: `convRateBase`.** It is INVENTED, and HANDOVER notes that on an
  advertiser's own territory the affinity product runs near 2.0, which roughly
  doubles it.
- **No lifetime value (F4).** Real D2C often loses money on the first order and
  earns it back later. Here the first order has to carry everything, and it does
  so easily.

**What it costs the lesson.** When 99% of accounts profit, "most traffic is
marginal" and "bid to break-even" cannot be felt. The careless player still
loses (the SLC review's value · performance game, E9's sixty-keyword table), so
consequences exist. But the band of "fine" is very wide.

**"Winning is easy" does NOT follow, and the review is corrected on it.** The
sensible harness player finished between 1st and 8th of 9, **median 6th**:
1st once, 2nd twice, 3rd five times. The market is generous to everyone rather
than easy to beat. The two recorded first places came from particular choices
(cells F13 favours, low bids), not from the market handing out wins.

**Options, none taken:**
- **(a) Wait for stranger playtests.** If strangers can lose by ordinary
  mistakes, the generosity may be tolerable.
- **(b) Lower `convRateBase` toward the evidence.** It is INVENTED, but it feeds
  break-even, every rival's bid and invariants I1–I4, so it means a full
  calibration pass measured on all five CALIBRATE constants.
- **(c) Revisit B6's effect on click-through**, for example a position-1
  click-through ceiling that leaves room for the organic results the page does
  not show.
- **(d) Say it on screen:** the simulated market is kinder than a real one,
  and why.

(a) first, then (d) at least. (b) and (c) only with better data than agency
blogs.

**Sources:**
- Balistro, Indian D2C performance channels: https://www.balistro.com/blog/performance-marketing-channels-ranked-d2c-india
- PPC Chief, apparel and fashion benchmarks: https://ppcchief.com/google-ads-benchmarks/apparel-fashion
- WordStream 2025 benchmarks, cited by both, not fetchable (403): https://www.wordstream.com/blog/2025-google-ads-benchmarks

### F16. India has no January surge in activewear searches, so the January event is not built — `WONTFIX`, measured (2026-09-13)

**The question.** Route B of the SLC review's recommendation 7, chosen after D12
ruled out route A, was an announced market event: New Year fitness resolutions
raising training searches in weeks 9–11, placed in the first weeks of January
(`plans/2026-09-13-january-surge.md`). The design made its size wait on Google
Trends, and set a stop before anything was built: if training searches did not
rise in January, the premise was false.

**The files** (`sources/trends/`, exported by the owner 2026-09-13): fourteen
terms, one per file, India, all categories, web search, weekly, 12 September
2021 to 6 September 2026. Five training terms (gym leggings, sports bra, gym
wear, gym clothes, workout clothes), five lifestyle terms as the control (co ord
set, loungewear, joggers, athleisure, lounge pants), and four searches broad
match wanders into (gym near me, workout plan, how to lose belly fat, gym
membership). Two are thin: workout clothes has 24 weeks at zero, and co ord set
starts near zero because the term is new.

**The method, fixed before the files were read** (`scripts/season-lift.js`,
tested in `tests/seasonLift.test.js`): for each winter, each January game week's
index over the mean of that winter's game weeks 1–8 (6 November to 31 December);
the median over the five winters; the mean within each group. Only a term is
ever compared with itself, so Trends scaling each file to its own 100 changes
nothing.

**Measured, January over November–December:**

| | week 9 | week 10 | week 11 | week 12 |
|---|---|---|---|---|
| training, mean of five | **1.01** | **0.98** | **0.98** | 1.05 |
| lifestyle, mean of five | 0.92 | 0.90 | 0.88 | 0.87 |
| searches broad match wanders into, mean of four | 1.12 | 1.02 | 0.97 | 1.00 |
| of which gym membership | 1.21 | 1.06 | 1.04 | 1.06 |

No training term carries the group: in week 9 they read 1.10 (gym clothes), 0.87
(gym leggings), 1.02 (gym wear), 0.96 (sports bra) and 1.08 (workout clothes).
`node scripts/season-lift.js` prints all four weeks for every term.

**The gate failed.** Training averages 0.99 over weeks 9–11, below the 1.00 the
design set as "January is not a surge at all". It is not a median hiding a
split: winter by winter, training's weeks 9–11 run from about 0.7 to 1.4 of the
November–December level with no pattern, and a check against September–October
instead of November–December (not the fixed method, run only to see whether the
baseline was the cause) is just as flat.

**What January does show:** lifestyle searches fall about 10% from their
festive-season high, and gym-membership and workout-plan searches jump 12–21% in
the first week only, then fade. Neither is a surge in anything this game sells.

**When these searches do peak in India** (exploration on the same files, labelled
as such: each full calendar year 2022–2025 over its own mean, so a growing term
does not read as a season):

| | Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| training | 0.89 | 1.00 | 1.02 | 1.07 | 1.08 | **1.13** | 1.12 | 1.00 | 0.92 | 0.84 | 1.01 | 0.92 |
| lifestyle | 0.82 | 0.85 | 0.99 | 0.98 | 1.00 | 1.03 | 0.99 | 0.99 | 0.96 | 1.07 | **1.21** | 1.09 |
| broad-match junk | 0.95 | 1.00 | 1.02 | 1.02 | 1.04 | 1.09 | 1.07 | 1.02 | 0.96 | 0.87 | 1.00 | 0.97 |

January is one of training's lowest months. India's training season is April to
July, a gentle rise of about a tenth; lifestyle's is November, the festive and
winter season, at about a fifth above its year.

**So the New Year surge is a Western pattern, and building it would have taught
something false about the market this game is set in.** The design, its plan and
the reader stay in the repository as the record of how it was tested; nothing
downstream of the gate was built, and no constant moved.

**The caveat, stated so it is not mistaken for an escape:** Trends reports a
term's share of all Indian searches, not a count. A flat line means the term
kept its share. That is still the right measure for "does January bring more of
these searches than November?", because both months are measured against the
same total.

**What is left for the back half** (HANDOVER, *And the calendar says the same
thing structurally*), none taken:
- **the festive season**, lifestyle's November rise, the strongest real signal
  here; it favours lifestyle cells, its sales lift is mostly discounts (which
  the design ruled out modelling), and Diwali moves between mid-October and
  mid-November, so a calendar without a year does not hold it cleanly;
- **the summer training season**, true but gradual, scenery rather than an
  event;
- **no calendar event**: D12's option (d), saying on screen that the second
  allocation is spend-or-invest and which figure decides it, or something the
  game already has, such as rivals running out of money.

#### Addendum: the festive season, measured and rejected too (2026-09-13)

The owner chose the festive season next, and it was tested before any design
rested on it.

**Diwali's dates** (Lakshmi Puja, Drik Panchang, calculated for New Delhi):
4 November 2021, 24 October 2022, 12 November 2023, 1 November 2024,
20 October 2025. The site otherwise calculates for the visitor's location,
which moved two of these by a day, so the New Delhi pages are the ones cited:
https://www.drikpanchang.com/festivals/lakshmipuja/festivals-lakshmipuja-timings.html?geoname-id=1261481&year=2022
(and `year=` 2021, 2023, 2024, 2025).

**Lined up on Diwali** (each week over the 52 weeks centred on that year's
Diwali week, 2022–2025; 2021 is too close to the files' start to centre):

| | 4 weeks before | Diwali week | 5 weeks after |
|---|---|---|---|
| training | about 0.80 | 0.82 | 0.88–0.98 |
| lifestyle | about 0.91 | 0.94 | 1.02–1.07 |

Year by year, lifestyle's five weeks after Diwali read 1.05, 1.07, 1.06, 1.06:
small, and the steadiest figure in these files. Training's four weeks before
read 0.77, 0.87, 0.90, 0.65.

**It follows the calendar, not Diwali.** Over the same 25 October–20 November,
training reads 0.92 whether that stretch fell after Diwali (2022, 2025) or
before it (2023, 2024). Lifestyle reads higher in the late years (1.19 against
1.03), the opposite of a Diwali-driven rise, and only because of 2023 (1.32),
an unexplained November spike; without it there is no Diwali pattern either
way. So the monthly table's November 1.21 above was lifted by one year, and the
dependable effect is a gentle calendar season: lifestyle about +5–7% in
November–December, training quiet in October–November.

**The share caveat bites harder here.** Before Diwali everyone searches more,
so a flat count of gym searches reads as a falling share. Keyword Planner's
absolute counts would settle it, but opening a Google Ads account now requires
a payment method, and the owner chose not to add one. So the pre-Diwali
training dip is recorded as possibly an artefact of how Trends measures, and
the post-Diwali lifestyle rise, which comes after the shopping peak, as the
trustworthy half.

**Does it create a decision? Measured, and no.** A throwaway harness (D12's,
72 markets, F15's full-account player, rivals live and not told): rounds 1–8
played once, forked at round 9 into three worlds (lifestyle commercial searches
×1, ×1.06 as measured, ×1.15 exaggerated, rounds 9–12, raised in the fork's own
copy of the query set) and four responses at round 9 (none; chase: add the
three biggest rising searches of the player's price tier; bids −15%; bids +15%).
A response is a decision the event creates only if its advantage over doing
nothing moves when the event is added.

| response | advantage, no event | with +6% | with +15% | what +6% moves it by |
|---|---|---|---|---|
| chase | +₹9,058 (wins 65%) | +₹8,680 (65%) | +₹6,070 (61%) | −₹457 |
| bids −15% | +₹15,733 (72%) | +₹18,528 (79%) | +₹26,600 (81%) | +₹117 |
| bids +15% | −₹17,926 (15%) | −₹18,384 (18%) | −₹20,042 (18%) | −₹2 |

The best response changes in 4 of 72 markets at +6% and 7 of 72 at +15%; the
median cost of ignoring the event is ₹0. What the event does is hand
lifestyle cells whose budget is not running out a windfall (premium · lifestyle
+₹16,461, value · lifestyle +₹10,980 at +6%), cost the budget-limited
mid · lifestyle a little (−₹2,330: more searches, same money), and leave
performance cells alone. **Scenery, and mildly false scenery: it would teach
that a season is free money.** Not built.

**Found on the way, and the thing worth keeping.** Without any event, cutting
bids 15% at week 9 beats doing nothing in 72% of markets, by a median ₹15,733,
and raising them loses in 85%. With D12, that is two measurements saying the
decision the back half already holds is "my budget is running out, so pay less
per click", and nothing on screen says so while it can be acted on (the
debrief's *Rank or budget* says it after the game). It rests on one scripted
player bidding 0.7 × realised break-even with rivals untold, so it is a lead to
measure properly, not yet a claim for the screen.

### I6. Display numbers stay in the view, not in `constants.js` — *by design*

Hard rule 7 sends every unsourced number to `constants.js`. Three live in `ui/`
instead: `SETTLED_EPSILON` (0.01 of a conversion), `DAYPART_RANGE` (-100 to
+900%), and the planner's default bid.

**Because `constants.test.js` would reject them.** Its orphan check reads
`engine/`, `content/`, `agents/` and the root modules — not `ui/` — so a
display-only constant there is a constant read by nothing, which is precisely
the failure that test exists to catch. They are model-shaped numbers only in
appearance: `SETTLED_EPSILON` exists because `stillPending` decays by
subtracting fractional landings and lands on float residue (7.1e-15), not
because anyone chose a threshold.

Each is documented where it sits. This entry is the ledger's record that the
omission is argued rather than forgotten.

---

## Maintenance rule

Every time you or Claude Code picks a number with no source, add it here before
committing. If it is not in this file, it is not a decision — it is an accident.

**And the corollary, learned the hard way in v0.3:** every time a number is deleted
from `constants.js`, check this file for an entry defending it. `QUALITY_WEIGHTS`
and `EXTENSIONS_IMPACT` were argued for at length here while no formula in the spec
ever read them. A ledger that defends numbers the engine cannot see is worse than no
ledger, because it reads as evidence that the thing was modelled.
