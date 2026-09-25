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
briefing followed.) It is the belief a rival STARTS with: from week 7 each rival
corrects it off its own settled weeks. Until C9 (2026-09-16) none ever did, because
the only report a rival was handed never carried a return; C9 added
`WEEKS_TO_SETTLE`, `MIN_SETTLED_CONVERSIONS` and `PLACE_STEP` to this file on the
same terms.

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

### C8. Every rival loses its second capital allocation, and the player does not — `FIXED` (2026-09-13)

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

---

**FIXED, in four steps, each its own commit** (`plans/2026-09-13-rival-capital-plan.md`):
1. **The guard.** `startGame` builds the round-0 block from an allocation the
   way the decision door does, and refuses a block missing a field
   (`capitalBlock` in `setup.js`). The whole suite passed unchanged, the
   writer-balance orderings included.
2. **A committed harness**, `scripts/market-harness.js`, so the before and
   after are measured one way. Its player is F15's, now with its round-0 money
   and the week-5 decision the form always sends.
3. **The rules reach the rivals.** The self view carries `capital`: the
   allocation rounds, the allocation, each target's top rung. They are the rules
   every advertiser is told at round 0, and a policy reads nothing else.
4. **Every rival decides, by character, decided with the owner:** `disciplined`
   invests when last week lost under 10% of its impressions to budget and keeps
   the money as ads otherwise (D12's finding, as the capital card now puts it to
   the player); `spender` always keeps it as ads; `cautious` always invests;
   `automator`, `grossOptimiser` and `brandDefender` repeat what they did at
   round 0. Investing follows the round-0 tilt, primary target to its top rung,
   then the secondary, and what no ladder can take becomes ad budget. Each
   policy's bids and campaign are untouched: the rule acts only in a capital
   round.

**Measured, before and after** (the harness, 72 markets):

| | before | after |
|---|---|---|
| rivals' month-2 budgets | ₹1,68,000, all 576 | median ₹2,48,000 (₹1,68,000–2,88,000) |
| player's month-2 budget | ₹2,88,000 | ₹2,88,000 |
| rivals, weeks 1–7: cost per click · profit per ₹ | ₹11.4 · 1.48 | ₹11.7 · 1.39 |
| player, weeks 1–7: cost per click · profit per ₹ | ₹19.6 · 1.05 | ₹19.6 · 1.05 |
| player's final net profit, median | ₹6,70,001 | ₹6,57,635 |
| player loses money | 0 of 72 | 0 of 72 |
| player's final rank, median | 5th | 5th |
| rivals' largest move into week 5, against an ordinary week | 3.53× | 2.23× |
| the same into week 9 | 1.48× | **2.40×** |

**The gates, agreed with the owner, all held:** calibration is unchanged (its
balanced game runs `runRound` with no policies, and its solo month ends before
week 5); the player's median rank did not move; it loses money in no market;
and D12's comparison keeps its sign in every cell (best investment against
keeping it: value · performance +₹31,104, value · lifestyle +₹40,295,
mid · performance −₹32,406, mid · lifestyle −₹44,268, premium · performance
+₹9,134, premium · lifestyle +₹47,209).

**What it changed that nobody asked it to.** The market's big shift moved from
week 5 to week 9: rivals now carry their second allocation through month 2 and
fall back to their rank-based month-3 budgets at week 9. **So the week-9 check
D12 records, which gave no line at 1.51×, now clears its own gate of double at
2.40×.** That decision was taken on the defective market and is reopened; it
is the owner's to retake.

*Since F17 (2026-09-15)* the same harness reads 4.40× into week 5 and 4.29×
into week 9. Ordinary weeks are calmer and both budget events move the market
more, because a rival whose budget changes no longer keeps phantom slots. F17
has the figures.

Played on the dev server into week 5, the two `spender` rivals, which keep their
allocation as ads, rose in the player's Auction Insights: one from 97% overlap
and 53% above the player to 100% and 88%, the other from 28% overlap to 49%.

### C9. A rival is handed only the week just played, and no return is ever in it — `FIXED` (2026-09-16)

**Found while fixing the rivals' prepaid discount (I34)**, whose rule counted the
refusals in the report a rival is handed and in play never saw one. The same is
true of every rule that reads returns.

**What happens.** `playRound` hands each controller its own slice of the week just
played (R3a), fresh from `runRound`. Returns are counted by CLICK week: a fresh
report carries `returned`, `refused` and `returnedRevenuePaise` at zero, and
`reviseReports` adds each return to its click week later. A conversion lands 0–3
rounds after the click (`ATTRIBUTION_LAG_DISTRIBUTION`) and its return two rounds
after that (`returnWindowRounds`), so no return can be in the week just played.
Measured over 18 markets (`playMarket`, seeds 1–3, all six cells): 1,584 reports
handed to rivals, **none carrying a return or a refusal, and none revised before
it was read.**

**Three rival rules read zero because of it:**

1. **`observedReturnRate` never observed a return.** It read `returned` off the
   week handed and fell back to `ASSUMED_RETURN_RATE` (0.40) while that was zero,
   which was always. What every rival believed it could afford was the briefing's
   guess in all 1,584 reports; the settled rates it never saw ran 35.9–46.4%
   (median 42.4%). Its docstring said the guess holds "until enough has settled to
   argue otherwise". Nothing ever settled.
2. **`grossOptimiser`'s geography was `disciplined`'s.** `locationTilt` with
   `net: true` subtracted `returnedRevenuePaise`, always zero, so it computed
   exactly what `net: false` does: identical in all 1,188 readings. Read off the
   settled version of the same weeks the two differ in every one, by a median 30
   points of place adjustment. G4's rival — one that "leans toward the metros first
   and then discovers, several rounds in, what the towns actually cost it" — did
   not exist, and `HANDOVER.md` described it as existing.
3. **The prepaid discount**, fixed first and separately (I34) by stating each
   place's refusal rate on the report.

**Why no test caught the first two.** `tests/policies.test.js` handed policies
reports built by hand, carrying `returned: 2` and the like, a shape play never
produces; "its belief moves as its own history arrives" passed a null report.
Every test was green and every rule was reading zero.

**AND A THIRD DEFECT IN THE SAME FUNCTION: THE SEE-SAW.** `locationTilt` set each
week's place adjustments from scratch off that one week's value per click, with no
limit on the move — keyword bids have `MAX_BID_MOVE`, place adjustments had
nothing. And a place's value per click is not the place's alone: it depends on the
rival's own bid there. With a low towns bid a rival wins only its best towns
searches and a click reads ₹52–55; the rule raises the bid, the rival wins weaker
searches too, a click reads ₹39–42, and the rule cuts again, each swing about 0.9
of the last. Traced on seed 8 (player at premium · performance), `disciplined`'s
towns adjustment ran −48, −44, −10, −56, −17, −58, −12, −54, −26, −52, −38, and its
towns clicks 1,302 / 386 / 1,766 / 401 / 1,444 / 374 / 1,212 / 387 / 1,131. Over
72 markets (seeds 1–12, six cells) the mean weekly move in the towns adjustment is
a median of 1.9 points for `disciplined` (90th percentile 10.1), 1.6 (3.4) for
`grossOptimiser`, 3.2 (31.6) for `spender` and 1.9 (6.2) for `cautious`: a tail,
not the rule. It is what made a rival's prepaid rung flip ₹50 / ₹30 until I34
weighted the rate by eligible searches.

**WHAT WAS PUT TO THE OWNER**, after prototyping each fix outside the repo and
playing it over those 72 markets:

- **(B) hand every controller its own past reports, as revised.** Amends R3a and
  hard rule 5, and shapes what the future `llmPolicy` is handed. No engine change.
  It had been declined for the prepaid lever alone; with three rules and a
  character's lesson failing from one cause, and the next rule to need settled
  weeks (the rivals' `wastefulQueries`, an LLM rival) certain to hit the same
  wall, the balance was different.
- (C) the engine keeps a settled running tally in the self view, like
  `bidding.observedConvRate`. The same information and so the same rival
  behaviour as B, at the price of engine state that copies what history already
  holds, a change to `round.js` on two lines that already differ there, and older
  browser saves without it.
- (D) leave the behaviour and correct the docs. Fair for the first rule alone —
  0.40 sits inside the true range, and correcting it moves a rival's ceiling
  between −18% and +9% — but not for the second, which leaves `grossOptimiser`
  with no geography of its own.

A stated rate, the way I34 was fixed, was not an option: a modelled return rate is
exactly the truth D2 withholds.

For the see-saw, a cap like `MAX_BID_MOVE` was measured and does not cure it. At
25 points a week the 90th percentile went 10.1 → 9.5 and the reversals stayed,
because a cap bites only on swings bigger than itself and the see-saw carries on
inside it; at 10 points, 6.3 with two or three reversals left. **Moving halfway
toward each week's reading** took every character's reversals to zero and left
where each comes to rest unchanged.

**The owner chose B, and moving halfway.**

**Step 1, the rule (R3a, hard rule 5).** A controller is handed a fourth thing:
its own report for every week played, as revised since, each week cut by
`advertiserReport`, the function that cuts the first, so nothing of any other
advertiser can come with it. `game.test.js` holds it to four things, to the
controller's own weeks as they stood when it decided, and to no rival's id
anywhere in them. The self view is untouched: `history` stays in
`FORBIDDEN_IN_SELF_VIEW`, because the history there would be everyone's.

**Step 2, the return rate.** `observedReturnRate` reads the rival's own history,
and only the weeks that have finished coming back: a week's sales land over the
three weeks after it and their returns two weeks after that (`WEEKS_TO_SETTLE`,
5), so week 1 is first read at week 7 — the first fully settled week the player
gets too. Until then, or on fewer than five settled sales
(`MIN_SETTLED_CONVERSIONS`), the briefing's 0.40 holds. `affordableCpcPaise`
takes the history where it took the report, which it only ever read for this.

**Step 3, the places.** `locationTilt` sums every week in the rival's history, as
the player's place card sums them, so its reading is net of whatever has come
back and no more. A net reader leans exactly as a gross one does until the towns'
returns arrive, and then only the net reader moves: the lag G4 describes, now
happening.

**Step 4, the see-saw.** A place adjustment moves halfway from where it is toward
the reading (`PLACE_STEP`, 0.5). Summing every week had already steadied three
characters; `spender`, which leans hardest, still reversed four to six times on
seed 8 until this.

**And a negative zero, which step 3 made reachable.** `Math.round` returns -0 for
anything a hair under zero, so a place a shade below the account's own average
was written as -0; JSON has no -0, so a save read back a decision it had never
stored and the round-trip in `save.test.js` failed. The rounding is older than
this entry — summing every week is what put a place close enough to the average
to meet it. **The makeover line found it and this line did not**, on the same
code: that test plays its own three weeks, and the -0 happened there and not
here. Guarded where an adjustment is written, on both lines; step 4 has since
made that path unreachable, so the guard now holds the one that remains, the
adjustment carried over for a place with too little traffic to read.

All three policy numbers are a character's opinion, kept with the policy (C7).
`tests/rivalsInPlay.test.js` plays seed 8 through `playMarket` and holds each fix
in play: late in the game a rival has been handed returns and has moved its
belief off the briefing; `grossOptimiser` and `disciplined`, handed the same week,
place their bids differently; and no rival reverses a place adjustment by ten
points twice. Each of the three failed before its fix. The hand-built reports in
`policiesAll.test.js` that carried `returned: 6` and called the risen ceiling
learning now measure against the ceiling the rival actually holds.

**MEASURED, BEFORE AND AFTER**, on `scripts/market-harness.js market` (72
markets, seeds 1–12, six cells), paired market by market against the code before
(`42eeebf`, the prepaid fix of I34). **`main` moved twice while this was being
built** — F18 and I36 landed — so it was measured again against `760a6b1`, the
tip with both: every figure below is identical, to the rupee and to the second
decimal, so F18 and I36 do not move this market and the table stands.

| | before | after |
|---|---|---|
| the player's final net profit, median | ₹6,57,676 | ₹7,05,003 |
| the same, paired | | **+0.8%** median; −10.9% to +8.9% (10th to 90th percentile); worst −29.4%, best +89.9% |
| the player's final rank, median · loses money in | 5th · 0 of 72 | 5th · 0 of 72 |
| ranks better · same · worse | | 14 · 50 · 8 |
| the player, weeks 1–7: cost per click · net ROAS · profit per ₹ | ₹19.6 · 4.36 · 1.06 | ₹20.0 · 4.31 · 1.05 |
| rivals, weeks 1–7: cost per click · net ROAS · profit per ₹ | ₹11.7 · 5.07 · 1.41 | ₹11.8 · 5.08 · 1.42 |
| rivals' month-2 budgets, median | ₹2,48,000 | ₹2,48,000 |

By the player's cell the paired median runs from −3.8% (mid · performance) to
+6.7% (premium · performance), and single mid-cell markets move most, −29% to
+90%. Median rank moved in one cell, mid · lifestyle, from 5th to 4th.

And the rivals, from the same games:

| | before | after |
|---|---|---|
| what a rival believes it can afford in weeks 8–12, against the briefing's 0.40 | the briefing's, always | 0.83–1.09 of it, median 0.97 (2,880 decisions; 16 still on the briefing, on too few settled sales) |
| towns adjustment at week 12, median: `disciplined` · `grossOptimiser` · `spender` · `cautious` | −19.5 · −19 · −12.5 · −9 | −37 · −19 · −43 · −14 |
| mean weekly move in the towns adjustment, median (90th percentile): `disciplined` | 1.9 (10.1) | 2.6 (3.0) |
| `grossOptimiser` | 1.6 (3.4) | 0.9 (2.4) |
| `spender` | 3.2 (31.6) | 4.0 (8.1) |
| `cautious` | 1.9 (6.2) | 1.2 (1.5) |
| reversals of five points or more, 90th percentile of rival-games | 3–5 | **0**, every character |
| rival-weeks with no impressions at all (F14's "dark") | 0 | 0 |
| net profit, paired median: `spender` · `automator` · `grossOptimiser` · `brandDefender` · `cautious` · `disciplined` | | +18.8% · −3.7% · −3.1% · +2.2% · +0.8% · 0.0% |
| rival-games offering a prepaid discount · changing rung after the first | 144 of 576 · 0 | 144 of 576 · 0 |

`disciplined`'s and `spender`'s median weekly move rises because they keep moving
as returns arrive — `disciplined`'s towns adjustment runs −10, −15, −19, −23 …
−37 by week, `grossOptimiser`'s stops at −19 — not because they thrash: the
reversals are gone. `spender` gains most: it now holds its towns bid near −43
where it used to swing it by up to 75 points a week. In the prototype that
preceded this, reading every week without the halfway step moved it +3.7%, so
most of the gain is the step.

**Calibration.** Only I1 runs a policy (`disciplined`, alone, one month).
Measured with the test's own `soloState` and `playSolo`, copied verbatim and
checked against F14's figures: at 430,000 searches it spends 100.00%, pays ₹4.91
a click against a ₹28.22 break-even and loses 10.51% to budget, before and after;
at 330,000, 85.74% and 0.01%, before and after. Its month ends before week 7, so
the settled belief never starts. No other invariant runs a policy.

**WHAT IT CHANGED THAT NOBODY ASKED IT TO: D12's week-9 gate.** The harness's
"largest rival move against an ordinary week" went 2.46× → **1.83×** into week 9
(at least double in 43 → 33 of 72 markets) and 2.30× → 1.78× into week 5. Taken
apart, the week-9 move itself did not change — a median 20.2 points of impression
share before, 19.7 after, and market spend still falls 26% into week 9. Ordinary
weeks got busier, 8.0 → 10.2 points, because rivals now take several weeks to
settle into their places rather than jumping there in week 2, and from week 7
their ceilings move to what came back. The Auction Insights card fires as often as
it did (a rival's overlap moves five points or more into week 9 in 39 of 72
markets, before and after), but its step against ordinary weeks is now 1.80×
(was 2.27×). D12 took the week-9 line on a gate of double; what the line says —
the re-split and the spend — still stands, the gate no longer clears. Recorded in
D12; the owner's to retake.

**RETAKEN ON TODAY'S MARKET, AND LANDED (2026-09-18).** This fix sat unmerged on
`claude/rival-history-main` while `main` moved 221 commits: F17 (the throttled
ladder), the Studio switch-over, I37 and I38. Merged and re-measured against
`main` at `26391d9`, over the same 72 markets, against gates the owner agreed
first:

- **Hard, all passed.** The suite green including `tests/rivalsInPlay.test.js`,
  which holds the three fixes in play. Calibration's 22 printed figures identical.
  The player's median rank still 5th, losing money in 0 of 72 markets.
- **Stop-and-show, all passed.** The player's final net profit, paired market by
  market: **+0.3% median** (10th percentile −3.2%, 90th +4.1%; worst −6.2%, best
  +16.7%), ranks better in 6 markets, the same in 63, worse in 3. Weeks 1-7: the
  player's cost per click ₹12.0 either way, net ROAS 6.46 → 6.45, profit per
  rupee 1.90 → 1.89; the rivals' cost per click ₹10.0, net ROAS 6.20 → 6.16,
  profit per rupee 1.96 unchanged. Rivals' month-2 budgets identical, median
  ₹2,48,000 across ₹1,68,000 to ₹2,88,000.
- **D12's week-9 gate clears on this market**, 3.53 times an ordinary week
  against 4.19 before, so the concern above is closed rather than carried; the
  screens that quote the figure now say 3.53×.

The table above stands as what this change did to the market of its own day; this
note is what it does to the market players meet.

**Found on the way.** Seed 7's `cautious` rival nearly vanishes in week 2 in five
cells of six — 3,995 impressions against 39,291 in week 1 before this change,
1,703 after. It recovers by week 4 either way and is never dark; it is the
reserve's knife-edge F14 met, and the halfway step deepens it a little. And
`npm run test:perf`'s sampled-round test sits at its 2,200ms bound on this
machine: on the code before this change it failed at 2,240ms, and the code after
passed moments later; the engine is not touched here.

**Still open, the same cause:** the rivals' `wastefulQueries` still blocks off the
week just played, on an exact zero (I8's addendum). It can now read settled
weeks, and has not been changed.

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

**The hours half told, 2026-09-13, without waiting for C4.** While the chosen
strategy predicts conversions, the *Hours of the day* card now says that the
adjustment lands on top of the strategy's own reading of the hour and counts
twice, and that Google Ads does not allow it with those strategies
(`ui/words/form.js`, `hourAdjustmentStacks` in `ui/decisions.js`). Its "why?"
opens a new chapter, *Bidding by the hour*, written from Google's bid
adjustments and Smart Bidding pages re-read that day (schedule adjustments
−90% to +900%, "not used" under Smart Bidding, which already bids by time of
day), citing this entry, H4 and D2.

**Where the telling moved, 2026-09-16.** The switch-over deleted the classic
decision form, and that daypart card was the only place saying it. Because this
entry is accepted *and told*, the sentence moved rather than went: the Studio's
*Where and when* says it under the hours, while the strategy it describes is the
one running (`WHERE.hoursTwice` in `ui/words/where.js`, shown on
`hoursModel().countsTwice`, which still asks `hourAdjustmentStacks`). Its "why?"
opens the same chapter. `ui/where/read.js` also stopped keeping its own list of
which strategies lean by hour, which was this same fact typed a second time.

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

**Reopened by C8's fix.** With every rival keeping its second allocation, the
step into week 9 measures 2.40 times ordinary, over the gate. The "no line"
above was decided on the defective market.

*Since F17 (2026-09-15).* The step into week 9 measures 4.29 times ordinary
and into week 5 4.40 times (the harness, 72 markets). Taken apart on 24 of
them, ordinary weeks are 18% calmer and the two moves 75% and 34% larger,
because a rival whose budget changes no longer keeps phantom slots. The line
taken below stands with a wider margin. Its spend drop (26.2%) and its count of
overlap movers (14 of 24 games) were not re-measured.

**And taken, with the owner (2026-09-13).** Total market spend drops a median
26.2% into week 9 (13.3–31.5% over 24 games), against about 1% in an ordinary
week and +2.7% into week 5, so week 9 is the one month change worth a line. The
market card now shows last week beside this week, every week, and in the week-9
report says month 3 began, that every budget was re-split by the week-8
ranking, and what the market spent against last week: the rule is public (D4)
and so is the market's spend (D8); nobody's rank or budget is named (R3). The
Auction Insights card names up to three rivals whose overlap with the player
moved at least five points, as observed, and never why. Overlap moves 2.17
times ordinary into week 9, but at least five points in only 14 of 24 games,
so in the rest the card says none moved much. Words: `ui/words/market.js`;
readings `insightMovers` and `marketChange` in `ui/chart.js`. Played to week 9,
it read: the whole market spent ₹3,18,830, against ₹4,43,294 last week. **And D12's comparisons were re-run
on the committed harness**, whose player has its round-0 money: before C8's fix
and after it, the best investment against keeping the money keeps its sign in
every cell, so the capital card's premise stands (C8 has the figures).

**Moved again by C9 (2026-09-16), and retaken on the market as it is now
(2026-09-18).** On the market of the day C9 was built, rivals reading their own
history took the step into week 9 to 1.83 times an ordinary week, under the gate
of double this line was taken on, because ordinary weeks got busier rather than
because the week-9 move shrank. **That reading was on the pre-F17 market.** F17,
which came to `main` with the switch-over, changed how far a throttled rival
reaches, and the step is larger on both sides of C9 now: measured over the same
72 markets on 2026-09-18, **4.19 times ordinary before C9 and 3.53 times after**
(and into week 5, 4.40 → 3.75). The gate clears comfortably, so this line stands
as written, and C9's concern is closed rather than carried.

**Dated note, 2026-09-17: week-5 capital now reaches the page (I37).** The table
above measured a week-5 investment whose page sentence never reached the grader,
because the description was written only in round 0. It now does, from the week
the work lands, so those investments are worth more. On the committed harness
(full account, week 5, median over keeping the money): photography ₹21,824 →
₹34,204, size guide ₹21,491 → ₹46,435, the page ₹36,789 → ₹60,841; order
confirmation writes no sentence and did not move. The week-7 question was not
re-run: moving the window would now also move when the page is re-graded, so the
table's week-7 column describes the old rule and should be re-measured before
anyone reopens it.

### D13. A bid lies between ₹1 and four times its keyword bid — `OPEN`, recorded 2026-09-15

**What the game does.** Every bid, whatever the strategy and however the hour's
and the place's adjustments stack, is clamped once between `MIN_BID_PAISE`
(₹1) and `MAX_BID_MULTIPLE` (4) × the keyword's bid (`clampBidPaise`,
`engine/strategies.js`; G4's dated note for the single clamp). So under manual
bidding an adjustment past +300% changes nothing on its own, and under Maximise
clicks, which already bids `MAX_CLICKS_AGGRESSION` (1.6) × the keyword, past
+150%. The Studio's Where and when bars stop there and say why, and the `hours`
and `cashOnDelivery` chapters say it.

**In Google Ads**, bid adjustments are "typically multiplied together", and
"combined bid adjustments can't exceed a 900% bid increase", with −90% the
lowest combined adjustment; a location or ad-schedule adjustment alone runs
−90% to +900% (Google Ads Help, *About bid adjustments*,
https://support.google.com/google-ads/answer/2732132, fetched 2026-09-15). The
page names no cap relative to the keyword's own bid. So Google's ceiling is a
combined ten times the bid and the game's is four: stricter, and of the same
shape since G4's single clamp. Google's floor is −90%, where the game's −100%
is a bid of one rupee, which D11 and G4 already record.

**Why four is not known.** Both bounds arrived with the bid strategies
(`ba3f227`, 2026-09-03) as `INVENTED`, and no reason was recorded, which R7
asks for; this entry is written after the fact, when Where and when first
showed the cap to players. What the ceiling does is keep a strategy that sets
its own bid from a forecast (Target CPA and Target ROAS multiply a target by an
estimated rate, D2) or from stacked adjustments from bidding far past anything
the player set. Nothing measured sets it at four rather than Google's ten, and
moving it moves the market, rivals' target strategies and place tilts included,
so a change is measured on `scripts/market-harness.js` first.

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

**Surfaced, 2026-09-13, as the SLC review's first recommendation asked.** The
keyword rows already showed each keyword's tags; they now also say how many
searches it reaches on its chosen match type, before negatives, on the
dashboard's keyword card and round 0's list alike (`keywordReach` in
`engine/matching.js`, the engine's own matching over the whole set). Switching
a keyword to broad shows what broad would buy before a week is spent on it.
On the real set: "gym leggings" reaches 1 search on exact, 16 on phrase, 68 on
broad; "seamless compression leggings", with three tags, reaches only 6 on
broad against 50 for "leggings", which is this entry's point made visible. The
figure is a count computed from tags the view withholds, and nothing else: no
tag and no particular search reaches the screen, the way Keyword Planner
forecasts a keyword without showing its workings.

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

*Completed 2026-09-15 (F17).* Fractional participation removed the cliff but
left the throttled advertiser in the ladder for every search, when in any one
real search it is either there or not. So one resolution was not yet
statistically equivalent to simulating each search, and a nearly-spent rival
held slots it was not in. `resolveSlice` makes the claim above true.

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

*Made true in the round on 2026-09-15.* `effectiveBidPaise` clamped once, but the
round builds each hour's bid once and applies the place afterwards: it clamped
the hour's bid, then only floored the place's. So a place carried a bid past
`MAX_BID_MULTIPLE` × its keyword (+300% on the hour and +100% on a place bid 8×),
and an hour above the cap was cut before a place could bring it back. Found
drawing the Studio's Where and when controls. The round now keeps each hour's
bid unclamped (`unclampedBidPaise`, still rounded to paise per hour as the
table always was) and clamps once, after the place (`clampBidPaise`), on both
paths through the auction. Measured on the market harness, 72 games before and
after: identical to the byte, so the rivals never reach the cap and the change
reaches only a player who stacks the two adjustments. A first version that
rounded once at the end instead moved every game by a paisa's worth and one by
15% of the player's profit, so the rounding stays where it was. Two tests in
`tests/round.test.js` hold the cap.

**TWO PATHS THROUGH THE AUCTION, and a test that they agree.** When nobody adjusts
by location the ladders are identical, so one resolution apportioned is exact and
the round takes it — a player who never touches the control pays nothing. The
moment anyone tilts, all three are resolved properly. The risk of two paths is
that they quietly stop agreeing, so the same round runs both ways and is held to
the same numbers, breakdown included.

*Corrected 2026-09-15 (F17).* The test named here set every place adjustment to
0%, a multiplier of exactly 1, so both of its states took the flat path and it
compared that path with itself. The paths disagreed with equal bids, by up to
13% of one rival's cost, because a nearly-spent advertiser held a slot in every
search it entered and a paisa of rounding decided when. They now agree to the
paisa: the flat path records its one resolution place by place, and the test
tilts one place by a millionth of a percent, asserting first that this forces
the second path and moves no bid. This entry's own dated note on the bid cap, a
rounding step that moved one game by 15% of the player's profit, was the same
defect.

**One finding from turning a location off**, and it is not a defect: the metros
gain **0.02%**. Giving up two locations means spending the day's budget more
slowly, so pacing lets the advertiser participate a little more where it stayed.
That is the budget following, not the volume — the searches stayed where they
were, and total impressions more than halve.

*Since F17 (2026-09-15)* the metros gain 17.6% in the same fixture. The player
now spends its whole week, which had been costing it 15% of its metro
searches, so freeing the budget gives them back. Still the budget following,
not the volume: all 4,850 metro searches and not one more, which is the bound
the test now holds rather than the size.

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

**HOW RIVALS CHOOSE WHERE TO BID — and the description was true only from C9
(2026-09-16).** `locationTilt` in `agents/policies.js` reads a rival's own place
report, never the tables, and leans by each place's value per click against its
own average: 200 points a step for most characters, 320 for `spender`, 100 for
`cautious`. It reads net of returns, so a rival should lean toward the metros
first and correct once the towns send things back; `grossOptimiser` reads gross,
so it never should. **Until C9 neither half happened.** It read only the week just
played, which never carries a return, so the net and gross readings were identical
in every game; and it jumped all the way to each week's reading, so a rival could
see-saw its towns bid for twelve weeks. It now sums every week played, as the
player's place card does, and moves halfway toward the reading each week. By week
12 `disciplined` bids the towns −37% and `grossOptimiser` −19%, where both sat at
about −19 before. The engine side of this entry is untouched: the tables, their
normalisation and the conservation test are as above.

**Round 0 names 32 cities (8 / 12 / 12) since 2026-09-14**, placed from the
geonames-derived dataset; display geography only, nothing in `engine/` reads them.

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

#### Addendum: marked by what a sale cost, not by an exact zero (2026-09-15)

**The sentence quoted above could not be said truthfully, and the card said it
anyway.** "Five clicks or more and returned nothing" was a test for an exact zero,
and the game is played in `mode: 'expected'`, where a search's sales are its
clicks times a conversion rate: a fraction, never exactly zero unless nobody
searching it ever buys. So the mark on the search terms report, and the card's
count, fired only for the zero-intent searches. Found while drawing the Studio's
What people typed, on seed 1, Vella & Co. at `mid|performance` with the makeover
keywords, six weeks in: 33 searches, none marked, and the card saying that none
of them "is taking clicks without returning anything", while `how to wash gym
leggings` had cost ₹3,566 for 0.8 of a sale (₹4,355 a sale) and `are gym
leggings squat proof` ₹3,050 for 0.7, against an account average of ₹488.

The block preview had the same fault from the other side. It warned "This would
also block searches that converted for you" whenever the searches caught had sold
anything, which in expected mode is almost always: phrase `how to` warned over
0.8 of a sale.

**What replaced them, chosen with the owner:**

- **A search is dear** when each of its sales cost over twice the account's
  average cost per sale, taken over the same rows the report is showing, once it
  has spent at least one average sale. A search that sold nothing is marked on the
  same terms. The mark sits on a new Per sale column, beside the returns mark,
  and the Negatives card counts dear searches ("3 of your 33 searches are selling
  at over twice your average of ₹488 a sale, or not at all").
- **The preview warns only when the block would catch a search whose sales cost no
  more than the account's average**, and names the first three. Otherwise it is
  quiet, and each search it lists carries the same mark as the report.

**Measured**, with `gym` and `leggings` added on broad to the same account (71
searches, ₹418 a sale):

| rule | searches marked |
|---|---|
| five clicks and no sale (the old one) | 3, the zero-intent `gym near me`, `free gym diet chart`, `gym membership price` |
| over twice the average (the Studio's) | 12, and not those three: with no sale there is no price per sale to compare |
| over twice the average, counting no sale, once it has spent one average sale | 15 |

And the preview, on the same account: broad `gym`, written to stop `gym near me`,
now warns that it would also block 12 searches selling at or under ₹418; `how to`,
`cheap` and `free` are quiet. The Studio drops the warning altogether; the owner
chose to keep one that fires only when it is true.

**The two thresholds are display choices, not model figures.** Twice the average
(`DEAR_TIMES` in `ui/decisions.js`) and one average sale's spend as enough
evidence are `INVENTED`, like I32's 1.15; neither changes what the engine does,
which is why they live beside the cards that use them rather than in
`constants.js`. The second does the job the five clicks did: short of one
average sale's spend, a search has not had the money to sell, whatever it shows.

**The rivals now block by this rule too (2026-09-18, the owner's decision).**
`wastefulQueries` (`agents/policies.js`) asked for conversions of exactly zero,
the same test this addendum removed from the player's screens, so in expected
mode a rival blocked the zero-intent searches and nothing else. Measured in 24
played games: `disciplined` and `grossOptimiser`, the two characters that read
their search terms report, ended twelve weeks holding **no negative at all** in
23 of them. They now judge a search by `isDear`, over every week they have
played, as revised — C9's fourth argument, doing what it was added for: a week's
sales arrive over the three weeks after it, so a search judged on the week just
played is judged before its sales have landed. Their own click threshold (40)
stays, on top of the rule's floor of one average sale's spend.

**One rule, two readers, and a guard narrowed to allow it.** `isDear`,
`averagePerSalePaise` and the totals a rival sums now live in
`content/searchTerms.js`; `ui/decisions.js` re-exports them, so no screen
changed. `policies.test.js` held that a policy imports nothing from `engine/` or
`content/` — absolute, so no route to the truth exists that nobody thought to
forbid. It now allows exactly `content/searchTerms.js` and holds that file to
being a leaf that imports nothing itself, so nothing can reach a policy through
it. The alternative was the same concept written twice, which is the defect I9
was written about.

**Measured against gates the owner agreed first**, `market` mode, 72 markets,
before and after. Hard, all passed: the suite green; calibration's 22 printed
figures identical; and no rival blocks itself out of the market — 0 rival-weeks
with no impressions at all, out of 2,304, on both sides. Stop-and-show: the
player's net profit is unmoved (paired median **+0.2%**, −2.8% to +7.9% at the
10th and 90th), it still loses money in 0 of 72, and its cost per click is ₹12.0
against ₹11.9. **Two gates tripped and the owner accepted both**: the player's
median rank slips 5 → 5.5 (better in 5 markets, the same in 51, worse in 16),
and `grossOptimiser`'s median profit rises 35.4% (₹16,90,521 → ₹22,89,087),
where the other five characters move between −2.1% and +6.4%. Both are the fix
working: two of eight rivals stop paying for searches that cost them several
times what a sale costs them. `grossOptimiser` gaining most is in character —
its lesson is that it ignores returns, not that it cannot read a report, and
cost per sale is exactly the returns-blind reading it would use.

Also moved, and in no gate: rivals' step into week 5 reads 2.55 times an
ordinary week against 3.75, because ordinary weeks are busier now that two
rivals re-read their report every week. The week-9 step the screens quote barely
moved, 3.53 → 3.45, so D12's line still stands.

**And What people typed reads it too (2026-09-18, the owner).** That screen
carried its own version of the mark, which required a cost per sale to exist —
so a search that sold NOTHING, the clearest waste on the page, was the one row
it would not mark, while the card marked it. One idea read two ways. It now
reads `isDear`, so all three readers agree: the card, the list, and a rival's
policy. Every mark the list already made is unchanged; what is new is the silent
search. Played on a broad keyword, where a real account buys them: "gym near me"
at ₹7,870, "free gym diet chart" at ₹6,154 and "gym membership price" at ₹5,201,
each with no sales, were unmarked before and are amber now. A search that sold
nothing has no cost per sale to name, so its mark says what it spent instead —
"₹7,870 spent and nothing sold, where a sale costs you ₹532" — and the legend
gained the same clause.

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

**Corrected, 2026-09-17.** Three things above no longer hold, and the first was
never true. *"Bounded at one point out of ten"*: a ₹25,000 size guide takes the
page from 5 to 7, because its sentence both mentions size and carries the
description past the 40-character rule; product shots earn a point by length
alone. Measured through a real round 0; Your ad said the size guide and
photography were worth no point until `2d5359c`. The ladder is no longer in
`ui/landing-page.js` but `content/landingPage.js`, with the landing page rules
beside it. And the description is no longer composed once in round 0: it is
re-written each week from the capital live that week (I37).

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

*Changed 2026-09-14 (plans/2026-09-14-round-zero-redesign.md): a self-written
ad is graded on its words from week 1. Until then it waited until week 3; the
paragraphs below keep both rules and say which is which.*

Real Google Ads has no notion of who wrote your ad. This one does: at round 0
every advertiser hires a writer or writes its own.

| tier | price | copy grades | live |
|---|---|---|---|
| Write it yourself | ₹0 | whatever you actually wrote, up to the grader's 8 | **week 1** (week 3 until 2026-09-14) |
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

**The fee buys not having to write, and insurance** (since 2026-09-14). Writing
your own is free and graded on the words from week 1; hiring guarantees the
writer's level from week 1. A player who writes a 4 loses far more than any
fee, since one grade point is worth about ₹1,33,986 over a game; a player who
writes an 8 keeps the fee and runs a better ad than the retainer's. Until
2026-09-14 the currency was time: a self-written ad ran on the ungraded 3/3
until week 3, an invented wait whose only job was to make the choice cost
something. The owner kept the fee so round 0 introduces the idea that copy can
be bought, and moved what it buys.

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

**MEASURED BEFORE AND AFTER, AND ONE GATE FAILED.** On
`scripts/market-harness.js`, `writer` mode: 72 markets (seeds 1–12, the six
squares), F15's player hiring the agency, and the same player writing its own
ad. The self-written ad was agreed with the owner before the run: one per
square in that square's own keyword words, grading 8/10 everywhere, the
strongest self-writer the game allows. Gates agreed before the run: the
self-writer's median rank improves by at most one place; the hiring player
does not move; no rival's median profit, in the self-writer's markets, falls
by more than 5%.

| | before (week 3) | after (week 1) |
|---|---|---|
| self-writer's median rank | 5 | 4 |
| self-writer's median net profit | ₹7,56,231 | ₹9,56,167 |
| markets where writing beat hiring | 53 of 72 | 63 of 72 |
| hiring player (median rank, net) | 5, ₹6,57,635 | identical in every market |
| all eight rivals together, median | ₹68,31,323 | ₹67,57,215 (−1.1%) |

Rank passed, at the limit. The hiring player did not move. Seven rivals stayed
within ±2.1%; **Torvi fell 5.8%** (₹1,19,620 to ₹1,12,640) and failed the 5%
gate. Its loss is mixed by market (it fell in 40 of 72 and rose in 32; median
change −₹852) and sits where the player sells mid-price lifestyle (mean
−₹30,068 there; it gains where the player sells value). **The owner accepted
the rule with the failure recorded here**, rather than loosen a gate after
seeing the result: the one small rival, the strongest possible writer, and the
market as a whole down 1.1%.

The finding worth keeping is the 26%: under this rule writing well pays a lot,
and a careful writer beats the agency in almost every market. That is the rule
doing what it says, and it is now a measured fact rather than a design claim.

The delivery was always delayed, never the effect, and that still holds for
saves made before the change: `CLAUDE.md` requires an ad copy change to move
`qualitySignal` immediately and leave `reportedScore` unchanged, so a waiting
grade is held whole and applied whole by `game.js` on the round it was due.

**THE ROLLOVER IS LOAD-BEARING, not tidiness.** Whatever the writer did not cost
becomes advertising budget. Without it the retainer was 20% ahead of a perfectly
self-written ad and strictly dominated. With it, `tests/writerBalance.test.js`
measures self-written against retainer at **1.002** — within 0.2%. **Re-measured
at 1.014** through a replica of that test's own fixtures once rivals stopped
writing their own ads, which raised the field it is measured against. **Read at
1.034 on 2026-09-12** (E9), identical before and after that change, so it had
drifted there unseen. Still far inside the test's 0.85-1.15 bounds. Under the
2026-09-14 rule `tests/writerBalance.test.js` holds writing well above the
retainer rather than level with it.

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
₹1,93,623 and fourth place once it hired. The 3/3 opening it describes no
longer applies to anyone new (2026-09-14).

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

**Corrected 2026-09-14: "at any hour" was not yet true.** The auction's signal is
the ad's quality times an hourly factor (`CONTEXT_FACTOR_CURVE`, 0.95 at night to
1.05 at 7pm), and the floor was priced without it, so it sat about 5% above the
lowest bid that shows. The table above has the evidence: ₹16 took 16,612
impressions under a floor this entry gave as ₹16.24. The floor is now priced at
the hour the signal is strongest (`lowestBidToShowPaise`, `ui/reserve.js`), and
tested against the engine's own auction: at the figure a bid clears the reserve
in some hour, a paise under it clears it in none. **And it priced the keyword
without its tags**, where `startGame` tags it (E9) and a keyword whose tags match
its search runs a fit of up to 1.15 against an untagged one's 1.0, so the floor
sat up to 15% high: in `tests/roundZero.test.js`'s own draft, ₹3.59 where the
account's own keyword clears at ₹3.12. It is
now priced as the account will hold it, and tested against the account
`startGame` builds. A played week could not prove
it in today's market: at such low bids rivals take every slot, and bids a paise
under and at 1.1 times the figure both showed nothing, which says nothing about
the reserve. So the warning is necessary, not sufficient: clearing the reserve
still leaves the rivals to beat.

**And every week's card, since 2026-09-14, the owner's call.** The weekly
*Your keywords* card gives the same warning, priced at the grade the week's
auctions run on (the live landing-page points included) and with the hour and
place bid adjustments that week will run, so a bid that clears at every hour can
be warned once the evenings are cut. Manual bidding only: under a bid strategy
the keyword's bid is not what it bids, and the strategy's own warning says
whether its bid shows. A paused keyword enters no auction and is not warned. The
figure is the lowest whole-rupee bid at or over the floor, since bids are slid
and typed in rupees.

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

   **Changed 2026-09-14, by the owner.** A hired writer's ad is now always the
   writer's copy, and the player's own words are set aside in `draft.ownAd`, not
   lost: they come back when the player chooses Write it yourself, and only then
   does rule 1 fall back to empty boxes. Keeping the player's words under a hired
   writer suited the classic page, whose boxes show for every writer. The Studio's
   round 0 shows them only for Write it yourself, so the words sat in the account
   unseen, and if they broke Google's limits Go stayed blocked with nothing on
   screen to fix; found by playing its step 4. The classic page follows the same
   rule when a writer or square is chosen. Its boxes still show for a hired
   writer, so typing over the writer's copy there still runs the player's words
   at the writer's grade; the Studio, with no boxes for a hired writer, cannot.

   **Dated note, 2026-09-16.** The switch-over deleted the classic page, so the
   last two sentences describe something that no longer exists: there are no
   boxes for a hired writer anywhere, and the words in `draft.ownAd` come back
   only on Write it yourself. The rule as decided is unchanged.
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

**What the player sees, since 2026-09-15.** Order confirmation now moves the
prepaid card's "Refusals" figure from the week it goes live, by the ladder's own
effect (1.25 at the top rung), because the card asks the round's arithmetic
rather than a formula of its own (I34). Until then the card read the same with
or without it. Nothing on screen names order confirmation as the cause: the
figure drops in its live week and says no more, so HANDOVER's "no surface at all"
is narrowed to that, not closed.

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

**The highlight was never drawn** (found 2026-09-15, I8's addendum). The figure
was given the class `bad`, and no rule in `ui/style.css` styled it, so "flagged"
above meant a line of hover text on an ordinary-coloured figure. It is red now,
beside the cost-per-sale mark that exposed it.

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

**AND IT READ THE WRONG PLACES, QUIETLY, UNTIL 2026-09-15.** The card was written
reading three keys from its context that the dashboard never set: `ctx.price`,
`ctx.history` and `ctx.playerId`. The fix above mended the one that threw. The
other two never threw: a missing key reads as undefined, and `ctx.history ?? []`
turned that into an account with no weeks played, so the card fell back to the
towns' mix, the most cash-heavy place, for every account in every week from the
day it shipped. Measured after four weeks on seed 20260902, it overstated
refusals in every cell: premium/lifestyle **15.6%** against its own 13.8%,
mid/performance 17.9% against 16.9%, value/lifestyle 18.8% against 18.2%; the
"fewer refusals" line by less, 8.7% against 8.0% for premium at ₹50. The four
tests above could not see it, because `prepaidOutlook` was right. The fault was
in what the card was handed, and that was built inside a render no test draws.

Fixed by lifting the half of the form's context that needs no page into
`formContext` (`ui/dashboard.js`), so a test reads the card through the context
the screen really gives it (`prepaidReading`), and by handing it `places`: this
account's own rows, the ones the places card draws. Not `state.history`, which
was the obvious fix: it holds all nine advertisers' reports, and the form may
only know what a controller could. A second test fails if it is handed over.
The curve, its rule and the lever are unchanged.

**A QUARTER SHORT OF ITS OWN FIGURES, AND A CARD THAT COULD NOT SEE CAPITAL —
`FIXED` 2026-09-15.** Measured rather than argued: 144 games on the committed
harness's player (F15's, rivals live, expected mode), six cells × seeds 1–6 ×
{no capital, ₹80,000 of order confirmation at round 0} × {no discount, ₹30},
refusals read as refused ÷ orders over settled weeks. Two faults, found together.

*The card's figure was not the account's rate.* It worked refusals out from the
cash mix alone, so it read the same whether or not the player had bought order
confirmation, and it knew nothing of purpose (`PURPOSE_MODIFIERS.ret`) or the
place gradient (`LOCATION_RETURN_MULTIPLIER`). Weeks 4–7, no discount:

| cell | card | engine, no capital | engine, full order confirmation |
|---|---|---|---|
| value / performance | 18.1% | 17.3% | 13.8% |
| value / lifestyle | 18.2% | 19.7% | 15.8% |
| mid / performance | 16.9% | 16.3% | 13.1% |
| mid / lifestyle | 16.9% | 18.6% | 14.9% |
| premium / performance | 13.8% | 14.1% | 11.3% |
| premium / lifestyle | 13.9% | 15.6% | 12.5% |

Without capital the pieces roughly cancelled — lifestyle read 1.5 to 1.7 points
low, performance up to 0.9 high — which is how it looked right. With order
confirmation live it was 1.4 to 4.3 points high, and a player could read two
different refusal rates on one page: the returns card's measured one, and this.

*The round delivered about three quarters of what a discount's sourced figures
say.* It took refusals as the refused SHARE at the discounted cash mix times the
return total before the discount. That share is computed against a total in
which the newly delivered parcels are sent back at `POST_DELIVERY_RETURN_RATE` —
the relabelling the fix above removed from the other half — so it falls more
slowly than the refusal rate. 100 mid orders in the towns give 17.9 refusals; ₹30
moves a tenth of the cash buyers to prepaid, which by `RTO_RATE_COD` and
`RTO_RATE_PREPAID` leaves 16.7; the round booked 17.0. The card said 5.8–6.8%
fewer at ₹30 and the round delivered 4.5–4.9%, with or without capital. Here the
card was right and the engine short: CLAUDE.md's "a split of a fixed total can
never move the total", again, in a milder form.

*Fixed as one arithmetic with two callers* (decided with the owner: the card
and the engine share one function, and the engine moves to the sourced rate).
`returnHalves` in `positions.js` is what comes back from one order at one place,
and the round books with it; `refusalOutlook` weights it by the account's own
places for the card, so the two cannot drift. The refused half now falls by the
ratio of the two refusal rates, which is exactly 1 with no discount, so no
account without one moved: the committed harness's `market` mode came out
byte-identical before and after. The forecast leaves out each search's own
return multiplier, which every view withholds (16.1). It matches the round to
six decimals on a search at 1 (`round.test.js`) and measured 0.91× to 1.02× of
the booked rate over the 72 accounts above. On a mid/performance account with
the top rung, the card now reads 15.6% for weeks 2 and 3 and 12.5% from the week
order confirmation goes live, against 12.9% booked.

*What the discount is worth now*, on the committed harness
(`node scripts/market-harness.js prepaid <label> 6`: 72 markets, seeds 1–12, the
median gain in final net profit over no discount, before → after):

| cell | ₹30 | ₹50 | ₹70 | ₹100 | best |
|---|---|---|---|---|---|
| value / performance | 1.5 → 2.7% | 1.5 → 3.0% | 0.8 → 2.5% | −0.6 → 1.2% | ₹30 → ₹50 |
| value / lifestyle | 2.2 → 3.5% | 2.3 → 4.0% | 1.8 → 3.7% | 0.6 → 2.4% | ₹50 |
| mid / performance | 2.4 → 3.8% | 2.8 → 4.7% | 2.4 → 4.5% | 1.1 → 3.2% | ₹50 |
| mid / lifestyle | 2.3 → 3.4% | 2.8 → 4.3% | 2.7 → 4.4% | 1.9 → 3.5% | ₹50 → ₹70 |
| premium / performance | 1.0 → 1.5% | 1.2 → 1.8% | 1.0 → 1.7% | 0.5 → 1.2% | ₹50 |
| premium / lifestyle | 0.9 → 1.3% | 1.1 → 1.7% | 1.0 → 1.6% | 0.6 → 1.3% | ₹50 |

₹30, ₹50 and ₹70 win in 71 of 72 markets before and after; ₹100 went from 56 of
72 to 71, and no longer loses at value/performance. Measured on `main` and again
on the makeover line, whose bid clamp (D13) binds nowhere in these markets: both
tables, and the market before and after, came out byte-identical on the two. So the lever is about half
as large again and still a few percent, and "a lot hurts" now holds against
₹50 rather than against doing nothing: ₹100 is worse than ₹50 in every cell and
better than none in every cell. The curve is unchanged.

*One consequence, accepted:* a saved game whose player used a discount shows
slightly fewer refusals once this build replays it. The save's fingerprint
checks cost and clicks, which do not move, so no warning fires.

**LESS MODEST SINCE F14, without touching the curve.** The return level rose to
the sourced total, so there are more refusals to prevent everywhere. On F14's
harness ₹50 is now best in all six cells for +1.2% to +2.7%, where the same
harness gave ₹30 in five of six for +0.0% to +1.2% before; ₹100 loses only at
value/performance. Still one lever with one effect — the curve and the rule
below are unchanged. (Measured on F14's harness, which recorded no player that
can be rebuilt; superseded by the committed harness's table above.)

**Not strengthened, deliberately.** The obvious way to make it bigger is to let
it lift conversion rate, which a discount genuinely does and which was excluded
on purpose so the lever has one effect. Doing that would also make it partly pay
for itself, which is a different mechanic from this one. If the modesty is a
problem, that is the lever to pull — and it should be pulled on purpose rather
than by retuning this curve until the answer flatters the idea.

**Rivals pull it too (R6) — true since 2026-09-15, and false until then.** Two
of the six characters carry the rule, `disciplined` and `grossOptimiser`, and
every game deals one of each, so it is two rivals of eight. One rung, not a
hill-climb: 5.2 wants a competent operator, not a solver. And `submitRound`
REJECTS an out-of-range discount rather than clamping — a clamp would let a
controller ask for ₹500 and be quietly charged for ₹100, which is the shape of
bug that survives a whole game.

**AS FIRST BUILT, NO RIVAL EVER OFFERED ONE.** This paragraph said rivals read
"their own refusal rate", and they did — off the one report a controller is
handed, the week just played. Refusals are counted by CLICK week: a fresh report
writes zero, and `reviseReports` adds each refusal to the week its click
happened, two to five rounds later (an attribution lag of up to three, then the
two-round return window). So the rate the rule read was exactly zero, every week
of every game. Measured on the market harness, seeds 1–3 in all six cells: 1,584
reports handed to rivals and not one carrying a refusal or a return; 1,728 rival
decisions and not one discount. The same rivals' weeks, once settled, ran 15–19%
refused, over the rule's own 12% line. It survived because nothing tested it:
every prepaid test was of the player's card, and no test played a game and asked
whether a rival ever offered a discount — the check CLAUDE.md's traps ask of
every decision a rival must make. It is also why the fix above left the market
byte-identical: nobody in it discounted but a player who chose to.

**WHAT IT READS NOW** (the owner's choice, of four): the `refusalRate` each place
row of the report states. The fix above had dropped that field for being the
cash-mix formula alone — no capital, no purpose, no place gradient — with
nothing reading it; `statedRefusals` in `report.js` puts it back as
`refusalOutlook` for that one place with no discount: the card's own figure,
from `returnHalves`, which the round books with. Stated once, when the week is
reported, and kept by every revision; and before any discount, so a rival
already offering one cannot talk itself out of it as its refusals fall.
Declined: handing each controller its own past reports so it could read its
settled weeks (it amends R3a for one lever, and the first fully settled week is
week 7); an engine-kept tally in the self view; leaving the rule and correcting
this paragraph.

**WEIGHTED BY THE SEARCHES IT IS IN, WITH A MARGIN, BECAUSE IT FLIPPED.** First
built weighted by the week's clicks, as the card weights by the player's, 8 of
144 rival-games stepped between ₹50 and ₹30 — all `disciplined`, one of them
seven times in eleven weeks. Traced, that was never the discount: a rival's
clicks follow its place bids, and `locationTilt` resets those from each week's
reading with no limit on the move, so they see-saw (on one market the towns
adjustment alternated about −55% / −15% and the weighted rate 10.5% / 12.4%).
The card's clicks are every week played and move slowly; a rival has one week.
So the rule weights each place by its `eligibleAuctions`, which do not follow
its bids, and it steps up at a line but down only a point under it, so a rate
on the line is not stepped down by order confirmation going live (every place
falls to about 0.91 of its rate). A one-point margin on clicks alone stopped 2
of the 8; the weighting stopped all of them. The see-saw is `locationTilt`'s
and is left to that function.

**IT LANDS ON ₹50.** The stated rate runs from 7.5% (premium performance in the
metros, with order confirmation built) to 22.5% (lifestyle in the towns), so ₹30
is open to a rival whose searches sit where refusals are light — never none,
since nowhere runs under 6%. Measured, all 144 rival-games offer ₹50 from week 2
and hold it to the end: ₹50, which the table above has best in five cells of six
and within 0.1 points of ₹70 in the sixth.

**MEASURED BEFORE AND AFTER** on `scripts/market-harness.js market` (72 markets,
seeds 1–12, six cells), plus each rival's own figures from the same games'
history — `conversions.refused` over `conversions.final` for weeks 1–7,
`money.rtoFreightPaise` and `gameTotals(...).all.netProfitPaise` over the game —
paired market by market against the code before the change:

| | before | after |
|---|---|---|
| the two rivals offering a discount | 0 of 144 | 144 of 144, ₹50 from week 2, held to the end |
| their refused share of settled orders | 16.5% | 15.2% |
| their freight on refused parcels, whole game | | −8.1% |
| their gross revenue, weeks 1–7 | | −0.6% |
| their net profit, whole game | | **+2.0%** median, −2.9% to +7.7%; up in 142 of 144 |
| the other six rivals' net profit | | 0.0% median; ₹129 median either way |
| all eight rivals, weeks 1–7: returned / net ROAS / profit per ₹ | 41.2% / 5.04 / 1.39 | 40.6% / 5.07 / 1.41 |
| the player: final net / median rank / loses money in | ₹6,57,635 / 5th / 0 of 72 | ₹6,57,676 / 5th / 0 of 72 |

`disciplined` gains in 72 of 72, `grossOptimiser` in 70, losing up to 2.9% in the
rest. The stated rate on its own, before the rule read it, moved nothing
(`market` mode byte-identical), and I1's solo account, which runs on
`disciplined`, measured the same to three decimals.
The player's table above still stands with rivals discounting: re-measured on
`prepaid` mode, every cell's best rung and every win count are unchanged, and
one figure moved — value/lifestyle at ₹100, from 2.4% to 2.6%. Measured on the
makeover line and again on `main`: the market before and after, and every
rival's figures, came out identical market by market.

*Re-measured with F17 (2026-09-16),* after the owner merged both into
`makeover`. Every figure above was taken on the market before F17, whose
throttled rivals held slots they were not in. Same harness, F17 alone against
F17 with this rule:

| | F17 alone | with rivals discounting |
|---|---|---|
| all eight rivals, weeks 1–7: returned / net ROAS / profit per ₹ | 41.4% / 6.17 / 1.94 | 40.9% / 6.20 / 1.96 |
| the player: final net / median rank / loses money in | ₹11,90,785 / 5th / 0 of 72 | ₹11,90,787 / 5th / 0 of 72 |
| largest rival move into week 5 · week 9 | 4.40× · 4.29× | 4.40× · 4.19× |

The same small shift as before F17, and the player's figures stay put. The
per-rival rows of the table above, re-measured the same way on this market
(each rival's own history, paired market by market): 144 of 144 still offer
₹50 from week 2 and hold it; their refused share of settled orders 16.6% →
15.3%; freight on refused parcels −8.1%; gross revenue, weeks 1–7, −0.6%; net
profit, whole game, **+1.7%** median, −1.6% to +6.3%, up in 141 of 144
(`disciplined` 70 of 72, `grossOptimiser` 71); the other six rivals 0.0%
median, ₹126 either way. I1's solo account measured the same to three decimals
here too. Not re-measured on this market: the player's prepaid table,
`prepaid` mode.

**Found on the way, not fixed here:** `observedReturnRate` and `locationTilt`'s
net-of-returns reading read returns off the same one-week report and are dead the
same way — a rival's belief about returns never leaves the briefing's 40%, and
`grossOptimiser`'s gross reading of place is identical to `disciplined`'s net
one — and `locationTilt` see-saws as above. Opened together as a separate task,
2026-09-15. **Fixed as C9** (2026-09-16): a controller is now handed its own
revised history as well (R3a amended), both rules read it, and a place adjustment
moves halfway toward its reading. This rule still reads the week just played, as
it should: its rate is stated, not counted, and the search weighting stays,
because the searches a rival is in do not follow its bids at all.

**THE MIX THE SCREENS SHOWED NEVER MOVED — `FIXED` 2026-09-15.** "Paid at the
door", on Returns in both looks, on the places table and its note, and on Where
and when, is `codShare`, on each location row of a week's report, and it was the
one figure there worked out from the advertiser rather than added up from orders.
It was worked out without the discount: a mid account at ₹30 read 60 / 72 / 80%
paid at the door, metros to towns, where the round sold at 54 / 64.8 / 72%, and
after nine weeks the returns card read 72.6% whether the player never discounted,
discounted every week or tried it once. And it was worked out again at every
revision, from the account as it stood that later week: a move from mid to
premium at week 5 rewrote weeks 1–4 to premium's 42% in the metros, though those
orders were sold at mid's 60%. The refusal counts beside it were right
throughout, because they ride on the orders.

*Fixed in two halves* (decided with the owner: option A). The report records each
week's share once, when it is built, from that round's price and discount, and a
revision keeps it. Each screen then reads the share over the same orders as the
refusals beside it: `returnsReading` and `placeReturns` (`ui/returns/read.js`,
which both looks draw Returns from) over their settled weeks, and `locationRows`
(the places table, its note and Where and when) over every week, all weighted by
orders. The rejected option fixed the report alone. It would have shown a
discount on Returns at once, beside refusals that cannot move until its weeks
settle, and paired this week's mix with every week's refusals in the note.

*What a player now sees*, played in the browser in both looks (mid/performance,
₹30 from week 3): Returns reads 74% after week 7, the same as with no discount,
because only weeks 1–2 have settled, and 71% after week 8, when week 3 and the
refusals it prevented arrive together; the Studio's place table there reads 60 /
72 / 80% and then 58 / 70 / 78%, over the same settled weeks. The places table
and Where and when read 56 / 68 / 75%, the weeks blended, where they would have
shown the latest week's 54 / 65 / 72%. What a discount will do is still said at
once, by the prepaid card's forecast.

Nothing in `engine/` or `agents/` reads `codShare`, so no economics moved, and a
save replays onto the corrected figures with its fingerprint unchanged. The tests
read the share the round used back off the revenue it booked, since the discount
is paid on prepaid orders only, rather than off `codShareFor`.

*And measured rather than left at that, 2026-09-16:* `market` mode over 72
markets, this line with the fix against this line without it, the two trees
differing in `engine/report.js` alone. Every row came out byte-identical, so no
market figure moves and the F17 figures in the dated note above still describe
this line. The rule that has rivals discount is untouched by it: `statedRefusals`
builds their `refusalRate` from `refusalOutlook`, never from `codShare`.

**Dated note, 2026-09-16.** "Both looks" above means what it meant when this was
written. The switch-over deleted the classic page, so `ui/returns/read.js` and
`locationRows` now feed the Studio alone; the fix and the reasoning are
unchanged, and the screens named are the Studio's Returns and Where and when.

### I35. Round 0 is five steps in the sidebar layout, and the brand is drawn — `FIXED` (2026-09-14)

**What was measured before.** Round 0 was 2,648 words across eleven sections
and 97 buttons, and 1,170 of the words were 35 blocks of explanation. The one
recorded human game spent 18 of its 28 minutes there (`reviews/slc-review.md`,
section 5). Opened in the Studio look it also wore a second palette the new
stylesheet never reached, with red on every rival ad and 32 texts failing
contrast (`plans/2026-09-14-round-zero-redesign.md`, section 1).

**What it is now, behind `?look=studio`.** Five steps in the sidebar layout,
open in any order from the list, *Next* moving forward: the market (read only),
where you sit, your keywords, your ad, your money, then Go. Each step is a
drawing module in `ui/roundzero/`. Every figure a step shows comes from
`ui/roundzero/rules.js`, which the classic page reads too, and Go sends exactly
what the classic page sends (`startChoices`). Measured at the end of the build
with the plan's script: 281, 119, 23 (plus 15 a keyword), 150 and 208 words,
781 in all against 2,648 (the plan's Task 15). Without the link, round 0 is the
classic page.

**THE BRAND IS DRAWN, NOT PICKED.** A brand's own searches run 2,838 to 2,881 a
week whichever of the nine it is, within two percent of each other, so choosing
one was ten buttons and a paragraph for no decision. `assignPlayerBrand` in
`setup.js` draws it from the seed (`deriveSeed(rootSeed, 'player-brand')`): the
same seed is always the same brand, a new market can be another, and the redo
keeps it. The engine was not touched; `startGame` already took `playerBrandId`.

**REOPENED BY THE OWNER, 2026-09-15: the brand is a pick from the nine.** After
playing the pilot the owner asked why they could not choose their brand. The
figures above still hold, so the pick decides almost nothing about the
economics; it is the player's name. Step 2 now opens with the nine names,
starting on the seed's draw, and one line for the search the chosen name brings
(`ownSearch`, the classic page's figure). A typed name was considered and is
not workable: the query set holds searches for these nine names only, so a
tenth would have no search of its own. Choosing another brand makes the one
left a rival, and a hired writer's copy is written again for the new name
(`setBrand` in `ui/roundzero/rules.js`, which the classic page's picker now
calls too). Rivals are dealt around the player in the brands' fixed order, so a
different brand moves up to seven names onto different ads, while the eight ads
and their squares stay the same. **The notes follow the ads:** a note is the
player's reading of an ad, so it goes wherever that ad went. Step 2 grew by
about 54 words, 19 of them the names and domains. The redo still opens on the
brand the game was played as, and the player may choose again there.

**The freelancer is the arrival.** A player arrives with the freelance
copywriter hired and its copy in the ad, so someone who does not want to write
never meets five empty boxes. Writing it yourself is one choice away and graded
on its words from week 1 (I11); a hired writer's ad is always the writer's
copy, with the player's own words set aside until they choose to write (I25).

**GUESSES ARE NOTES, NEVER CONFIRMED AND NEVER SENT.** Step 2 lets the player
mark where they think each rival sits, and shows the rivals they placed in each
square. The game never says whether a guess is right: the player learns where
rivals sit from Auction Insights and at the end (G1). The guesses live in round
0's draft (`draft.guesses`) and Go does not send them, so nothing keeps them
once week 1 begins, because nothing reads them yet. Carrying them into the end
reveal is a later decision (the design's section 12). Nothing in round 0 plots
a territory or states a rival's square (I3, C5).

**Capital in plain view, and neutral.** Kept is the default and nothing is
recommended: measured, every allocation beat keeping it in the one cell tested,
so tucking capital behind "advanced" would have steered players to the worst
option. The landing page grade sits in step 5 beside the capital that moves it.
How that grade is timed is open (the design's section 12): a page bought in
round 0 raises the graded page from week 1, though the site work goes live at
week 4. *Settled 2026-09-17 (I37): the page is graded as it stands, so week 1
runs on the plain page and step 5 draws the built page's grade from week 4.*

**Not changed:** the engine's economics, the query set, the rival policies, and
every constant but I11's `CREATIVE_DIY_LIVE_ROUND`, which went. The map's 32
cities (G4) are display geography; nothing in `engine/` reads them.

The design, decided with the owner one question at a time on a canvas, is
`plans/2026-09-14-round-zero-redesign.md`; the build and its play record are
`plans/2026-09-14-round-zero-redesign-plan.md`.

### I36. An old week's late sales went to whichever keyword caught the search when they landed — `FIXED` (2026-09-16)

Found while tracing F18, and the same shape: a revision reading the account as
it is now rather than as the week was sold.

**Sim, before.** A week's late sales and returns are added to its breakdown
rows as they arrive (11.4). Each order carried its search and its place, so the
search terms rows and the place rows were right. The keyword row was found by
asking which keyword catches that search in the week the sale LANDS
(`keywordForQuery`, the revising round's own map), so it was right only while
the keywords stayed as they were. Changing them broke the weeks before the
change, in two ways:
- **A search nothing catches any more** had its late sales and returns reach no
  keyword row. The commonest way in is the search terms report's own lesson:
  block a search with a negative, and its keyword stays and still matches it,
  but nothing catches it. One game (seed 20260902, the phrase keyword
  "leggings", "gym leggings" blocked at week 3): week 2's keyword row held
  159.30 of the week's 163.27 sales and 61.29 of its 64.64 returns. Removing a
  keyword does the same: with two exact keywords and one removed at week 3,
  week 2's row for it stopped at 11.29 of the 20.52 sales its search made, and
  none of its 7.79 returns.
- **A search a broader keyword took over** had them credited to that keyword,
  a row the week does have, so the rows still added up to the week and were
  wrong. The existing test that holds keyword rows to the week's returns could
  not see either: its game never changes a keyword.

**Who saw it.** The keywords table adds up every revised week, so a player who
blocked a search, or removed or replaced a keyword, saw that keyword's old weeks
come up short, and whatever took over its searches credited with sales it never
caught. The search terms report was right throughout, so the two tables
disagreed about the same weeks. No rival reads an old week's keyword rows: a
controller is handed only its latest report, which no revision has touched yet.

**The fix.** Each order carries the keyword that caught its click
(`keywordId`), snapshotted with its search and its place (spec 11.3). The
round's per-search bucket records it, since an advertiser catches a search with
one keyword for the whole round (8.6); `queueConversions` stores it,
`queueReturns` carries it to the return, and both places in `report.js` that
credit a keyword row read it from the entry. `keywordForQuery` had no reader
left and is gone. `tests/report.test.js` plays both ways in: an exact keyword a
phrase keyword in the same ad group takes over at week 3 and one nothing else
catches, and a search blocked by a negative at week 3. Weeks 1 and 2's keyword
rows now add up to the week's sales and returns, and each removed keyword keeps
what its one search earned. The negative game was also run against the engine
before the fix, and failed there.

**Measured.** The market harness before and after: identical, all 72 rows and
every field. Rivals block searches too, so their own old keyword rows did
change; nothing in the market reads an old week's keyword rows, so nothing it
decides moved.

### I37. The landing page is graded as it stands each week — `FIXED` (2026-09-17)

**The question, open since the round 0 redesign (its section 12).** Round 0
writes the player's page description from every rupee of capital committed
(I9), and the grader scored it from week 1. None of that work is live before
week 4. Measured on real round-0 games played to week 10:

| capital | when | landing page grade the auctions ran on |
|---|---|---|
| reviews ₹55,000 | round 0 | 7 from week 1, 9 from week 4 |
| size guide ₹25,000 + photography ₹50,000 | round 0 | 7 from week 1 |
| the same | week 5 | 5 all game — the description was never written again |
| reviews ₹55,000 | week 5 | 5, then 7 at week 8 (the site work's points only) |

So round-0 page capital counted three weeks before the work existed, capital
committed at week 5 never reached the page at all, and the same money was worth
up to three grade points more for being spent early. Nobody decided that; it
fell out of when the description happened to be written.

**The owner's decision: grade the page as it stands.** Each week a page built
from capital is re-written from the capital LIVE that week and its landing page
grade re-scored (`pageAsItStands`, `content/landingPage.js`). `game.js` lands it
before each round's auctions beside `landCreative`; `setup.js` opens a game on
the page as it stands in week 1, the plain page; round 0's step 5, its reserve
warning, and Your ad read the same function. Only the landing page part moves:
the copy grades read headlines and descriptions alone. A page built from capital
carries a mark (`pageBuiltFromCapital`) — data, not "this is the player": a
rival's page grade is its authored character and has none. **Games saved before
the change keep the rule they were played under** (the owner's choice): their
stored start has no mark, so they replay exactly, as saves from before I11 still
land their copy at week 3.

**Where it departs from Google.** The field guide's sourced sentence describes
landing page experience as "how relevant and useful your page is to people who
click" (`ui/guide/chapters.js`, *Who writes the ad*). Inferred from that, not
separately sourced: people who click reach the page as it is, not work still
being built, so grading the page as it stands departs less than grading it
early did. What remains of I9's departure is that the page is a description
graded by rules, not a page.

**The landing page's grading rules moved beside the ladder.** `game.js` may not
import `agents/` (R2, `tests/game.test.js`), and the rules read the description
and nothing else, so `LANDING_RULES`, `gradePage` and the base grade live in
`content/landingPage.js`, and `agents/grader.js` reads them from there to score
and explain the landing page.

**Measured, against gates the owner agreed before any run** (the market harness
at `6246367`, whose player first learned to write its page from capital):
- **Hard, all passed.** `market` mode byte-identical (72 markets). At week 5,
  keeping the money and order confirmation identical in every market. From the
  auctions' own record, round-0 capital grades like none in weeks 1-3 and like
  it used to from week 4; week-5 capital leaves the page alone to week 7 and
  matches the same bought at round 0 from week 8 (`tests/pageAsItStands.test.js`).
  The screen's grade equals the auction's every week. Calibration's 22 printed
  figures identical.
- **Stop-and-show, all passed.** Week-5 capital's median advantage over keeping
  rose: photography ₹21,824 → ₹34,204, size guide ₹21,491 → ₹46,435, the page
  ₹36,789 → ₹60,841. Round-0 capital's fell by no more than the owner's 25%:
  size guide ₹77,387 → ₹63,951 (−17.4%), reviews ₹1,15,455 → ₹99,832 (−13.5%),
  top page ₹1,40,553 → ₹1,20,169 (−14.5%), photography ₹56,419 → ₹47,641
  (−15.6%), each still beating keeping in 51 to 58 of 72 markets. No rival's
  median profit moved more than 5%; the widest, −4.1%.

**What it changes on screen.** Round 0's step 5 draws the grade as 5 for week 1
and the built page's grade from week 4, so a size chart that used to show one
bar at 7 shows two. Your ad's chart steps at the week the work lands, and the
page's row counts what the page's own capital adds against the same account
without it — a size chart bought beside it lands its sentence on the page too.

**Both things this left open are now settled.** Photography earned its landing
page point only by lengthening the description past 40 characters: the rule is
gone (I38). How Your ad shows what each purchase's sentence adds was designed
and built (`523301f`, design/grade-breakdown/, direction B).

### I38. The landing page grade counts only what Google names — `FIXED` (2026-09-17)

**The rule nobody chose.** `LANDING_RULES` gave a point to any page description
longer than 40 characters. The plain page every advertiser starts with is 21
characters, so ANY sentence the capital ladder wrote earned it:

| bought alone at round 0 | the sentence | characters | grade from week 4 |
|---|---|---|---|
| product shots ₹50,000 | "Product shots on white." | 45 | 6 |
| the faster page ₹25,000 | "It loads quickly on a phone." | 50 | 6 |
| a size chart ₹25,000 | "A basic size chart." | 41 | 7 (with sizing) |

So a photograph earned Quality Score through its caption, and a size chart
cleared the threshold by a single character. I9's correction of 2026-09-17 had
already recorded the first as a fact; the owner asked whether it should be one.

**What Google says, fetched 2026-09-17.** Google Ads Help, *Optimize your ads and
landing pages* (`support.google.com/google-ads/answer/6238826`): useful, original
information about what you advertise; being clear about the product; adding
reviews from real customers; for mobile, keep it quick and use simple navigation;
and a page that matches the ad and its keywords. Search Ads 360 Help, *Landing
page experience* (`support.google.com/sa360/answer/9351020`): the usefulness and
relevance of the information, ease of navigation, the number of links, and what
the ad led people to expect. **Neither names images, photographs, video, or the
length of the text.**

**The owner's decision (design/photography-point/, direction C).** The length
rule goes. The faster page's own sentence earns that point for SPEED, which
Google's mobile advice names, and every page rung above it keeps it, since the
ladder is cumulative. Sizing and reviews stay; reviews is named by Google, sizing
is inferred from "useful information about the product" and is marked as inferred
rather than sourced. Photography earns no landing page point at any rung: it buys
conversions, which is its road.

Two directions were drawn and not taken: saying plainly on screen what the length
point was for (no number moves, but the game still pays a grade point for a
caption), and counting length from what the page SAYS rather than what it shows
(smaller, but the faster page and the size chart would still earn by character
count). **Refused outright:** a grade point of photography's own. No source names
pictures, and photography is already the best single capital purchase in four of
the six cells (I30, as F14 left it).

**What it changes, over all 64 combinations of the three ladders:** 49 grade
exactly as before — every page with capital on the page itself, and the page with
nothing bought. 15 lose exactly one point: no page capital, but a size chart or
product shots. Rivals' page grades are authored numbers, not scored, so only the
player's grade moves directly.

**Games saved before this keep the length rule** (the owner's choice, as for I37
and I11). A new game's page carries `pageRules: 'speed'`; a page without it is
graded by `LENGTH_RULES`. `game.js`, Your ad and the week-5 capital card all read
`rulesFor`, so a saved game replays exactly and never meets "This game has changed".

**Measured, against gates the owner agreed before any run** (`speedgates`, from
`market`, `capital` and `page` runs before and after):

- **Hard, all passed.** The 72 markets of `market` mode identical. At week 5,
  keeping the money, order confirmation and ₹80,000 on the page identical, the
  player's profit and every rival's. At round 0, keeping, reviews, the top page
  and the faster page identical.
- **Stop-and-show: all five tripped, and the owner accepted them.** Median
  advantage over keeping the money: round-0 size chart ₹63,951 → ₹38,029
  (−40.5%), round-0 product shots ₹47,641 → ₹22,245 (−53.3%), the two together
  ₹85,397 → ₹57,238 (−33.0%), week-5 size guide ₹46,435 → ₹33,263 (−28.4%),
  week-5 photography ₹34,204 → ₹21,824 (−36.2%). The limit was a quarter, carried
  over from I37 where the change was about timing; here a whole grade point is
  removed, which is a fifth of the way from 5 to 10, so a third to a half of the
  advantage is the size to expect. **Nothing stopped being worth buying**: each
  still beats keeping the money in about the same share of markets (the size chart
  in 55 of 72, down from 58; product shots in 51 of 72, unchanged; the pair in 52,
  up from 51; week-5 size guide in 47, unchanged; week-5 photography in 38, down
  from 41).
- **Rivals within 5%**, the widest 3.1% (Torvi, round-0 photography).
- **Shown, not a gate:** the round-0 purchases rank by advantage as before — the
  top page, reviews, chart-and-shots, the size chart — except that product shots
  now sit below the faster page. A first ₹50,000 rung of photography buys 2% more
  sales and nothing else, which is what it always bought.

**What it costs.** The size chart was the best-value first purchase for a
beginner and is now worth about 60% of what it was. Making it worth more again
would need a second sourced rule about the page's usefulness, which is a design
question rather than a tuning knob, and is not open.

### I39. The books count what the business spent, and settle the tail — `FIXED` (2026-09-18)

**Two findings from drawing Results (2026-09-15), left for the owner's rules and
decided together.**

**One: capital was free in every final figure.** `moneyBlock` charges a week for
its clicks and for the freight on parcels refused at the door, and never for the
money spent building the business — `netProfitPaise` has no capital term in it.
So the standings compared an advertiser that committed nothing with one that
committed the whole ₹2,40,000 on a figure that charged neither. It was not even
neutral: capital left uncommitted becomes ad budget (13.3), so the one that kept
its money was charged for the clicks it bought with it, and the one that built
was charged nothing at all. Measured over six games, rivals commit between ₹0 and
₹2,40,000, a median of ₹1,20,000, against final net profits of ₹7 to ₹14 lakh.

**Two: the last weeks read high, and the last two counted no returns at all.** A
sale lands up to three weeks after its click and comes back two weeks after that,
so nothing sold after week 10 could come back inside twelve weeks. A finished
game simply dropped what was in flight: a median ₹3,46,560 of orders per
advertiser.

**The owner's decision (2026-09-18): the books do both, and the weekly report
does neither.** A weekly report is an advertising report — Google Ads never knows
what a business spent on itself — so `moneyBlock` and every weekly screen are
untouched. The end-of-game books settle the tail and take capital off:

- `settledHistory` (`ui/ending.js`) runs each advertiser's own queues on past the
  last week and writes every arrival into the week whose click earned it, with
  `reviseReports`, the engine's own reviser, at the margin each week was built
  with (11.3). Every advertiser settles the same way, which is what makes the
  standings like for like.
- `finalStandings` ranks on what the business made: settled net profit less what
  that advertiser committed.

**No auction is re-run and no engine number moves.** This is arithmetic after the
last auction, on a copy: `tests/settling.test.js` holds every week's impressions,
clicks, cost, share and quality identical before and after, holds each queued
sale to being counted exactly once, and holds the game's own history untouched —
so a saved game still replays to the fingerprint it was saved with and no player
meets "This game has changed".

**Measured against gates the owner agreed first**, over 12 games and 108 rankings:

| | places that move, of 108 | the player, of 12 games |
|---|---|---|
| settling alone | 8 | 9 same, 3 worse |
| capital alone | 14 | 9 same, 3 worse |
| both | 22 | 5 same, 5 worse, 2 better |

**Settling takes money off, not on**: a median ₹1,12,594 per advertiser, because a
late sale pays its margin while its return takes the whole order value back and
the freight with it. That is what "the last weeks read high" meant, measured.
Capital takes off a median ₹1,20,000. The player slips more often than it gains
in these games because it committed ₹1,30,000 where several rivals committed
nothing, and sold well late.

**What it costs.** Two figures now mean different things in different places, and
the screens say so: a week's net profit is an advertising figure, and the books'
is what the business made. The alternative — charging capital weekly — would have
made the weekly report something Google Ads never shows, mid-lesson.

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

**RECORDED AND NOT FIXED HERE — FIXED LATER AS F20 (2026-09-20).** The
sourced chain is nearly flat by location (towns 1.04-1.06x the metros) because
`POST_DELIVERY_RETURN_RATE` and the RTO pair are single figures. There the
flatness is known to be wrong — tier-3 RTO is quoted at 3-5x the metros, far more
than the cash mix explains — which is why `LOCATION_RETURN_MULTIPLIER` carries a
1.5x gradient. *(**That sentence is false and is corrected in F21.** The 3-5x is
COD against prepaid, not tier-3 against metros, and the cash mix already carries
it at a sourced 3.6x. Left in place here because it is what this entry reasoned
from.)* But it multiplies the WHOLE total, and the refused/sent-back split
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

#### Addendum: re-measured on a real player, with every rival's money (2026-09-13)

The harness above handed the player's round-0 capital to `startGame` in a shape
that lost it, and sent no capital decision at week 5, so its player ran months
1 and 2 poorer than any real one; and every rival lost its second allocation
(C8). Re-run on the committed harness (`scripts/market-harness.js market`),
which fixes the first, and after C8's fix, which fixes the second:

| settled weeks 1–7 | click-through | cost per click | conversion | gross ROAS | net ROAS | profit per ₹ spent | returned |
|---|---|---|---|---|---|---|---|
| player, all cells (72) | 8.2% | ₹19.6 | 5.0% | 7.81 | 4.36 | 1.05 | 42% |
| all rivals (576) | 5.5% | ₹11.7 | 4.9% | 8.63 | 5.04 | 1.39 | 41% |

**The finding stands.** The player still loses money in 0 of 72 markets. C8 was
not why the market is generous to the player: its own figures barely moved, while the
rivals' profit per rupee fell from 1.48 to 1.39 as they spent their second
allocation. **One correction:** with its round-0 money, the sensible player
finishes a median **5th** of 9, not 6th (1st once, never below 7th).

#### Addendum: the benchmark disagrees with itself, and option (d) is taken (2026-09-13)

**"Click-through about 2×" does not stand unqualified.** Re-read while writing
the guide chapter this entry's option (d) called for, the PPC Chief page gives
apparel search click-through twice over: **3.2%** (and conversion 3.8%) in its
table by campaign type, the Search row this entry quoted, and **6.8%** (and
4.0%) as its headline averages, which cite WordStream's 2026 study of search
campaigns. Against 3.2% the game clicks 1.7–2.6 times as often; against 6.8%
the player clicks about 1.2 times as often and the rivals less. Conversion is
steadier: a quarter to a third above either figure. So the excess in
click-through is uncertain by a factor of two, and the robust claim is the
outcome: the player's gross ROAS (7.81) sits at the top of the Indian agency
range (4.5–8×) and above the page's apparel 4.2×, and a sensible player made
money in every market measured.

**Option (d) taken.** The end screen's *Twelve weeks* card now says the market is
kinder than a real one in those terms, clicks and conversions "at least as
often as published benchmarks" rather than a ratio, with a "why?" to a new
guide chapter, *How kind this market is*, which lays out the conflicting
figures and the three choices behind the kindness (B6, the invented base
conversion rate, F4). Options (b) and (c) still want better data than an
internally inconsistent industry page.

#### Addendum: F17 made it kinder still (2026-09-15)

F17 removed a defect that had been making the market harsher: a budget-limited
advertiser held its slot, and priced whoever sat above it, in searches it was
not in, so ads sat lower and paid more than the model meant. Re-measured on the
same harness:

| settled weeks 1–7 | click-through | cost per click | conversion | gross ROAS | net ROAS | profit per ₹ spent | returned |
|---|---|---|---|---|---|---|---|
| player, before F17 | 8.2% | ₹19.6 | 5.0% | 7.81 | 4.36 | 1.05 | 42% |
| player, after | 10.1% | ₹12.0 | 5.0% | 11.14 | 6.45 | 1.90 | 42% |
| all rivals, before | 5.5% | ₹11.7 | 4.9% | 8.63 | 5.04 | 1.39 | 41% |
| all rivals, after | 7.1% | ₹10.0 | 5.1% | 10.48 | 6.17 | 1.94 | 41% |

**The robust claim above no longer stands as written.** The player's gross ROAS
is 11.1, above the Indian agency range (4.5–8×) rather than at its top, and its
click-through is 10.1% against the page's 3.2% and 6.8%. So the defect had been
hiding part of the click-through excess this entry is about. The end screen and
the guide chapter now say "above the range". The player still loses money in 0
of 72 and finishes a median 5th, so "winning is easy" still does not follow.
Options (b) and (c) matter more than they did. They still want better data, and
the owner chose not to recalibrate with F17 (2026-09-15).

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

### F17. A throttled advertiser held its place in every search — `FIXED` (2026-09-15)

**Real:** Google says little about the mechanism. Its help page on campaigns
not running or getting low traffic, under *6. Low budget*: "When you have a low
budget, your ads may not serve as often while Google Ads ensures your campaign
doesn't spend more than your spending limit." Its *Fix "Limited by budget"
status* page says only that the campaign "is underperforming". The game's
reading, in its own voice: an ad not served in an auction takes no place in it.

**Sim, before.** Pacing gives each advertiser a participation fraction for each
auction (spec 13.4, H1): the share of the slice's searches it enters. The round
billed it for that share, but `resolveAuction` ranked it in all of them. So in
the searches it was not in, it still held its slot: the rivals beneath it
dropped a place or off the page, and the one above paid as though it were
bidding against them. F2's "statistically equivalent to simulating each search"
was false.

A trigger made it chaotic. An advertiser that has nearly spent its day enters
with a tiny share, each auction then costs it a fraction of a paisa, which
rounds to zero, so it never spends its last paisa and holds a slot for the rest
of the day. Whether it lands on its day target and drops out, or stalls a paisa
short, is rounding luck. G4's two paths round differently, so with equal bids
they disagreed by up to 5.1% of one rival's impressions and 12.9% of its cost.
At the first auction where they parted, marlow had spent 600,000 paise of a
600,000 day target on one path and 599,999 on the other. The ladder itself
never differed given the same entrants (0 of 45,774 resolutions). The test
meant to hold the paths together forced the second path with a 0% adjustment, a
multiplier of exactly 1, so it never took it.

Against an exact reference, built in scratch copies of the round: the engine
was up to 58% off in impressions and 105% in cost on the test fixture. In nine
played markets, 67–95% of auctions had a throttled entrant and the worst-hit
advertiser's clicks were 30–82% off. A cutoff (ignore participation under
0.001) made the paths agree but left clicks about 37% off whatever the
threshold, because advertisers throttled to 25–99% held slots they were not in
too.

**The fix**, decided with the owner ("only its share"). Each advertiser's share
comes from its own pacer, so who is present in a search is independent from one
advertiser to the next. `resolveSlice` (`engine/auction.js`) resolves every
combination of who is present, each as likely as its members' shares times its
absentees' complements, by `resolveAuction`'s rules, ranked once because an
absentee changes nobody else's order. Where an entrant sits depends only on who
is present above it, and what it pays only on who is present below, so its
average price is the same whatever slot it lands in, and clicks times that
price is its expected cost exactly. k throttled entrants cost 2^k ladders: one
when nobody is throttled, 13.7 a search on the test fixture, 5.4–8.0 in played
markets. Both paths record a slice place by place, each advertiser's numbers
added in the same order and rounded at the same points (`roundPaise`), so they
agree to the paisa. `tests/round.test.js` holds them there with a tilt of a
millionth of a percent, after asserting that it forces the second path and
moves no bid. Not a sampled draw of who is present: that would put a whole
slice's volume on or off one advertiser, the cliff H1 removed.

**What it cost.** A played week (three-auction, sampled, with a counterfactual)
went from about 1.33s to 1.45s on the development machine: 8–15% dearer in plain
Node, which is what a browser runs, and about 30% under the test runner. So the
three-auction timing test, added the same day with a bound copied from the flat
one, was set from its own cost to 2,800ms (the owner). Two speed-ups that move
no number came with it: `roundHalfUp` skips its string conversion unless a
value is close enough to a half for it to matter, and each search's return
halves and each advertiser's prepaid share per place are worked out once per
round.

**Measured**, 72 markets on `scripts/market-harness.js`, before and after, with
gates agreed with the owner first (the plan,
`plans/2026-09-15-throttled-ladder-plan.md`, has every figure):

| | before | after |
|---|---|---|
| player, settled weeks 1–7: CTR · CPC · profit per ₹ | 8.2% · ₹19.6 · 1.05 | 10.1% · ₹12.0 · 1.90 |
| rivals, the same | 5.5% · ₹11.7 · 1.39 | 7.1% · ₹10.0 · 1.94 |
| player's gross ROAS · net ROAS | 7.81 · 4.36 | 11.14 · 6.45 |
| player's final net profit, median | ₹6,57,635 | ₹11,90,785 |
| player loses money | 0 of 72 | 0 of 72 |
| player's final rank, median | 5th | 5th |
| rivals' largest move into week 5 · week 9, against an ordinary week | 2.23× · 2.40× | 4.40× · 4.29× |

The five gates that had to hold held. `resolveSlice` equals every combination
to 1e-9, the paths agree to the paisa, the suite and the timing suite pass, and
calibration passes, I1 and I3 to the last digit because they play one entrant
per auction. Two tripwires fired and the owner accepted both (2026-09-15). The
market is kinder (F15's addendum), and the budget events at weeks 5 and 9 move
it more: the week-5 move 75% larger and the week-9 move 34%, against ordinary
weeks 18% calmer (24 markets; C8 and D12 have notes).

Two claim tests had bounds that assumed the fixture's player barely spent its
budget. It now sits first in 73% of its impressions rather than 55% and spends
its whole week, so both were restated with the owner. An open cell costs the
player nothing through rank, and its whole gap to playing alone is its own
budget (6,061 impressions). Turning a location down gives the metros only their
own searches.

**Why it survived.** I1 and I3 play one entrant per auction, so nobody was ever
in anybody's way. The two-paths test compared one path with itself. And a
fixture round's numbers looked plausible either way. G4's dated note on the bid
cap had already seen it without naming it: moving one rounding step changed one
game by 15% of the player's profit.

### F18. A price move re-priced the weeks already sold — `FIXED` (2026-09-16)

Not a modelling choice. Spec 11.3 already said the right thing, and the engine
did not do it.

**Sim, before.** A week's report is revised for up to five weeks as its late
sales land and its returns come back (11.4), and each revision works the week's
profit out again: revenue times margin, less what the clicks cost. The revenue
came from the orders, which carry what they sold for. The margin came from
`businessFor` on the advertiser as it stood in the REVISING week. Margin follows
the price tier (40, 52 and 62%) and a price move is legal at week 5 (4.5), so a
move re-priced every week sold before it: all four weeks of month 1, since each
is still getting returns back after week 5. Spec 11.3 snapshots an order's value
and return rate "so a repositioning (4.5) cannot retroactively change an order
that was already sold". The margin is applied to the report rather than the
order, so that rule never reached it.

One game (seed 20260902, the player on mid · performance with one exact keyword,
the setup `tests/report.test.js` now plays): after a move to premium, week 1's
gross profit read ₹15,410 until week 5 and ₹20,791 from then on, and its net
profit ₹4,214 then ₹7,573. Its revenue, returns, freight and ROAS were the same
to the paisa as in the game that stayed.

**What it moved.** Gross profit decides the week-8 rank that splits month 3's
budget (13.3, D4), and the end screen ranks on these reports (I26). Measured
first with a throwaway on the committed harness's player, moving at week 5, 12
seeds × the eight price moves, each game re-ranked with weeks 1–4 at the margin
they were sold at: the week-8 rank was wrong in 63 of 96 games and the end
screen's in 40 of 96. That was on the same game, so without the knock-on from a
wrong month-3 budget (whole games below). Moving up flattered the player and
moving down cost it: seed 8, mid · lifestyle to value, ranked 4th and was
honestly 1st. Weeks 1–4's net profit moved by a median of about ₹1,00,000 either
way, which for a move from mid to value is more than that player's median profit
for the whole game (₹96,481). It showed on screen too: the week-8 deadline
card's running total, the end screen's *Every week* card, which presented the
jump as late sales, and the debrief's *Numbers keep moving* lesson. A game that
did this taught that moving up makes your old sales worth more.

Only the player was ever hit. No rival policy repositions (`agents/policies.js`,
`disciplined`), and nobody in the harness's `market` mode moves.

**The fix**, chosen with the owner (option A). `buildRoundReport` records the
margin on each week's report, `money.marginPct`, and `reviseReports` revises
with that and never asks the advertiser (spec 11.3, 15.2). It is exact, not an
approximation: every order in a report was clicked in that report's week, and a
week has one price, so one margin per report is each order's own. A report
without the field fails loudly (`mulRate` rejects an undefined rate) rather than
falling back to the current margin, which would bring this back unseen.

Rejected: a margin on every pending order beside `valuePaise` (option B). It
matches 11.3's wording, but profit is worked out per week, so the revision would
still have to pick one margin per week from whichever orders arrived, with the
returns carrying it too: three files for the same answer in every game the grid
allows. B is the right shape only if a report could ever hold orders sold at two
prices, and a report is keyed by the week its clicks happened in.

**Measured before and after**, whole games on `scripts/market-harness.js`: the
`market` mode (72 games, nobody moves) and the `move` mode added for this
(12 seeds × every move spec 4.5 allows from each cell, 168 games; the market
mode's rows for the same seeds are the games where the player stayed).

| | before | after |
|---|---|---|
| `market`, 72 games | | identical, every row and field |
| `move`, the 72 purpose steps | | identical, every field |
| weeks 1–4's net profit, median: value to mid | ₹2,54,098 | ₹1,45,029 |
| mid to value | ₹86,345 | ₹2,02,326 |
| mid to premium | ₹3,03,422 | ₹2,02,326 |
| premium to mid | ₹2,05,741 | ₹2,83,824 |

After the fix, weeks 1–4 read the same whichever move a cell makes, as they
must: the games are the same to the end of week 4. Before it, mid · performance's
three moves gave three figures for the same four weeks.

Of the 96 price moves, the week-8 rank changed in 63, month 3's budget with it,
and the final rank in 40: the throwaway's counts, now with the budget's
knock-on in. Every change ran one way. A move up had been flattered (its week-8
rank falls in 35 of 48 and rises in none) and a move down punished (rises in 28
of 48, falls in none). The final net profit moved by a median of −₹1,15,943
(value to mid), +₹1,26,794 (mid to value), −₹1,14,718 (mid to premium) and
+₹78,002 (premium to mid).

**The lesson it had been teaching.** Paired by seed with the game where the same
player stayed, a move from mid to premium beat staying on net profit in 10 of 24
games before the fix and in none after. Value to mid beats staying in all 24
either way, and the two moves down in none. The harness player keeps its old
keywords after moving, so this measures the move and nothing else, not whether
moving pays for a player who rebuilds the account around it.

**Why it survived.** 11.3's snapshot was written for the two numbers an order
carries; the margin is applied later, at the report, and a revision is the only
code that applies it after the week. No test moved price and then read an
earlier week, the harness never moved, and no rival moves. And a jump in an old
week reads exactly like late sales, which is what every screen says a revision
is.

**The same shape elsewhere.** The cash share on each place row was worked out
from the advertiser at revision too (I34), and so was the keyword a late sale is
credited to (I36). Anything a revision works out from the advertiser, rather
than adding up from orders, belongs on the report when it is built or on the
order (CLAUDE.md, known traps).

### F19. Month 3's rank was taken a moment before the player could see it — `FIXED` (2026-09-20)

Not a modelling choice. Spec 13.1 already said the right thing, the engine's own
comment said the right thing, and the code did it one step early.

**The rule.** Month 3's budgets are split by rank on cumulative gross profit
across rounds 1–8, **as reported at round 8** (13.1). The pool is fixed, so the
only thing rank decides is who gets which multiplier, from 1.30 at the top to
0.70 at the bottom.

**Sim, before.** `advanceState` ran at `round.js:309` and `reviseReports` at
`round.js:321`, so the rank was taken from **weeks 1–7 as they stood after week
7, plus week 8 fresh**. Week 8's own revisions to weeks 4–7 — the late sales
that landed while week 8 ran — were not in it. That is a state that exists for
no one: it is not what week 7 showed, and it is not what the player reads when
week 8 finishes.

**The engine knew.** The comment above the capture already read *"captured THERE
rather than read later, because history keeps being revised and 'as reported at
round 8' has to mean at round 8."* The intent was right from the start. What was
wrong was that "at round 8" had been implemented as *before round 8's revisions*
rather than *when round 8 is done*.

**How it was found.** Not by testing. A 34-line test, written in a worktree and
never committed, was rescued during a branch audit (tagged
`rank-snapshot-probe`). It passed on `main`, and the pass was vacuous: it had no
guard that the two readings could still differ on a market that had moved six
times since it was written.

**Measured, 3 cells x 8 seeds, before and after:**

| | before | after |
|---|---|---|
| markets where the rank matches the reports as read | 16 of 24 | **24 of 24** |
| months 1 and 2 budgets changed | — | 0 of 24 |
| month 3 budgets changed | — | 8 of 24 (exactly those that ranked wrong) |

Always an adjacent swap, never more than one place. At the rank multipliers that
is ₹11,760–₹13,440 of month 3 moving between two advertisers, against a month-3
budget running from ₹2,18,400 at rank 1 to ₹1,17,600 at rank 9.

**What it did to the player, over 72 markets:**

| | before | after |
|---|---|---|
| player's final rank changed | — | **0 of 72** |
| player's net profit changed | — | 21 of 72 |
| median net profit | ₹11,66,491 | ₹11,94,283 |
| where it moved, median delta | — | −₹1,330 (range −₹38,855 to +₹31,916) |
| rivals' median month-2 budget | ₹3,08,000 | ₹3,08,000 |
| largest rival move into week 5 / week 9 | 2.78x / 3.62x | 2.78x / 3.62x |

So the market the player meets is genuinely different in about a third of games,
and their own outcome is barely touched: the swap is almost always between two
rivals. D12's week-9 gate does not move at all.

**Why it was worth fixing anyway, given how small that is.** A player who adds up
their own weekly gross profit gets one order; the game used another. For a
simulator whose claim is that its figures can be traced, a number nobody can
reproduce from the screens is worse than a number that is slightly off.

**What it also removed.** `rankByGrossProfit` used to call `buildRoundOutput` a
second time to append this round's report to an unrevised history. It now sums
the finished history, so the round's report is built once.

**The counterfactual builds no report for this.** `runCounterfactual` reads
`raw` alone and discards the state it is handed, so it is given no history and
skips the rank entirely — a one-round hypothetical never reaches month 3.

### F20. The location gradient sat on both halves of a return — `FIXED` (2026-09-20)

Not a modelling choice. F14 found this, recorded it, and left it because F14 was
already four constants: *"The evidence says the gradient belongs on refusals."*

**The rule the sources give.** `POST_DELIVERY_RETURN_RATE` and the RTO pair are
single national figures, so the sourced chain is nearly flat by location
(1.04–1.06x). `LOCATION_RETURN_MULTIPLIER` exists to carry what that flatness
misses.

> **Amended by F21 (same day).** This entry was written believing the flatness
> was known to be wrong by a quoted 3–5x. It is not: that 3–5x is COD against
> prepaid, which the model already carries at a sourced 3.6x. What survives is a
> direction with no number on it. **Everything below about which HALF the
> gradient belongs on is unaffected** — that rests on
> `POST_DELIVERY_RETURN_RATE` being one national figure, which it is.

**Sim, before.** It multiplied the WHOLE return rate in `returnHalves`, and the
refused/sent-back split was applied afterwards. So the gradient landed on both
halves, and the model came out wrong in both directions at once:

| | before | what the sources say |
|---|---|---|
| refusals, metro → town | 1.65–1.81x | 3–5x |
| send-backs, metro → town | 1.36–1.40x | one national rate — flat |

Refusals climbed less than a third as far as the evidence quotes, and send-backs
climbed when nothing says they should.

**The fix, and only half the job.** The gradient multiplies the refused half
alone. The table did **not** widen with it, and that is the unfinished part —
see *Why the gradient could not widen* below.

| | before | after |
|---|---|---|
| refusals, metro → town | 1.65–1.81x | 1.65–1.81x (unchanged) |
| send-backs, metro → town | 1.36–1.40x | **0.90–0.93x** |
| total return rate, metro → town | 1.50x | **1.16x** |
| category return rate (value/mid/premium) | exact | exact |

**WHY THE GRADIENT COULD NOT WIDEN, which is the finding worth more than the
fix.** Reaching what was then believed to be a sourced 3–5x needs a wider table,
and every table wide enough overturns the sourced cash mix. `LOCATION_RETURN_MULTIPLIER` is
normalised PER PRICE TIER to hold each position's documented return rate, and a
value brand's country is 53% towns where a premium brand's is 26% — so holding
premium's rate lifts its town multiplier further than value's. Measured, at the
towns:

| table | refusals in the towns | |
|---|---|---|
| the sourced cash mix (`refusalRateFor`) | value 18.8% > mid 17.9% > premium 15.6% | — |
| `[1, 1.25, 1.5]` on refusals *(shipped)* | 18.69 > 18.35 > 16.70 | holds |
| `[1, 1.5, 1.9]` | value **=** mid, both 19.35 | breaks |
| `[1, 1.8, 2.6]` | mid **21.02** > value 20.51 > premium 20.40 | breaks |
| `[1, 2.2, 3.4]` | mid and premium both above value | breaks |

An INVENTED constant must not overrule a DOCUMENTED one, so the table stayed
where it was. **The gradient is capped by the normalisation, not by the
evidence.** The fix is to normalise market-wide, so a place's gradient is a
property of the PLACE and not of who is advertising; then the cash mix is the
only price-dependent term and the ordering holds at any width. That moves F14's
per-position return rates, so it is its own piece of work with its own gates.

**THE COST, STATED PLAINLY.** The location trade falls from 1.50x to 1.16x. That
is the thing this table's own comment warns about — *"without it the metros would
simply be better and there would be no decision to make"* — so the place
decision is worth less to a player until the table can widen. It was taken
anyway because the alternative was leaving a wrong claim in the model to protect
a number, and the weakening is recoverable where the wrong claim was not.

**TWO WRONG RECOMMENDATIONS ON THE WAY HERE, recorded because the mistake is
instructive.** `[1, 2.2, 3.4]` was proposed and agreed first, on a check that
compared only value against premium — the widest gap, which survives longest.
`[1, 1.8, 2.6]` was proposed second, on the same partial check. Only a full
ordering check across all three tiers showed both break it. **When a bound is an
ordering over several things, check every adjacent pair, not the extremes.**

**Send-backs falling slightly is the right direction, not a leftover.** More
parcels are refused at the door outside the metros, so fewer are ever delivered,
and a parcel that never arrived cannot be sent back. What is left of the
variation comes through `rtoShareOfReturns` alone.

**Normalisation had to change with it.** Normalisation exists to hold the
category return rate. While the gradient multiplied the whole rate, dividing by
its volume-weighted mean did that exactly. A rate is now
`share x m + (1 - share)`, so holding the average needs
`sum(w . share . m) = sum(w . share)` rather than `sum(w . m) = 1`.
`locationEffects` normalises against the refused share when it is given a price,
and falls back to the volume mean when it is not — which every caller that feeds
`returnHalves` does pass.

**Measured over 72 markets, before and after** (the "before" is main at F19):

| | before | after |
|---|---|---|
| player's final rank changed | — | 3 of 72 |
| median net profit | ₹11,94,283 | ₹11,80,730 |
| median delta | — | −₹2,246 (better in 31, worse in 41) |
| range | — | −₹36,312 to +₹1,04,625 |
| rivals' return rate, settled | 40.5% | 40.5% |
| largest rival move into week 5 / week 9 | 2.78x / 3.62x | 2.66x / 3.78x |
| the prepaid card against what the round books | 0.92–1.00x | 0.92–1.00x |

The player is slightly worse off on median, which follows from the trade
narrowing: the towns are relatively more attractive than they were, and the
harness player does not re-choose its place. D12's week-9 gate still clears
double at 3.78x, and I34's card is unaffected because the card and the round
both read `returnHalves`.

**A test had quietly stopped testing the game's path.** `locations.test.js`
asserted that the multiplier's volume-weighted mean is 1, which is no longer
what holds the category rate — and it still passed, because it calls
`locationEffects` with no price and so measures the fallback. The average is now
checked on the rate itself, with a price, and a second test holds the two halves
to the sources rather than to today's table: send-backs at most flat, refusals
between 3x and 5x. Both fail on the old engine, which was checked by stashing
the fix rather than assumed.

### F21. The 3–5x that justified a constant was about something else — `FIXED` (2026-09-20)

Not a modelling choice, and not a number that was wrong. A **source that was
read wrong**, and then relied on by three entries and six files.

**What the model said.** `POST_DELIVERY_RETURN_RATE`'s comment, and F14, and
F20 after them:

> "tier-3 RTO is quoted at 3-5x the metros, far more than the cash mix alone
> explains — which is why `LOCATION_RETURN_MULTIPLIER` carries the gradient
> instead."

**What the sources say.** The 3–5x is real, and it is **COD against PREPAID**:

> "COD orders have 3–5× higher RTO than prepaid." — Shipmozo, *How to Reduce RTO
> in eCommerce* (2026)

Repeated across several trackers, with the underlying rates put at 28–35% for
COD against 4–8% for prepaid. **That is the mechanism this model already
carries, and carries from a named study:** `RTO_RATE_COD` 20.9% against
`RTO_RATE_PREPAID` 5.8% (Unicommerce FY23) is **3.6x**, inside the quoted range.

So the cash mix does not under-explain the geography. It *is* the explanation,
and it was already in the engine, DOCUMENTED, when a constant was invented to
close the gap it supposedly left.

**What IS supported, and it is worth keeping.** A direction with no number
attached:

> "tier-2/3 pin codes have higher RTO due to address quality, courier partner
> limitations, and lower digital literacy." — Shipmozo, same page

No source found puts a multiple on that remainder. So
`LOCATION_RETURN_MULTIPLIER` keeps its place as the unquantified part — which is
what `INVENTED` means — and stops claiming a measured target it never had.

**What changed.** Comments and ledger entries only; no engine behaviour, no
constant, no test outcome. F14's sentence is marked false in place rather than
edited away, because it is what that entry reasoned from. F20's "the gradient is
capped by the normalisation, not by the evidence" stands as an observation but
loses its sting: there is no evidence pulling the other way, so the cap is just
the right bound.

**AND IT DISSOLVES PHASE 2b.** The programme had an item to normalise the
gradient market-wide so the table could widen to 3–5x. There is nothing to widen
toward. Better still, the reason that item looked necessary — per-price
normalisation — turns out to be correct by construction:
`tests/constants.test.js` ties `POSITION_ECONOMICS.returnRate` to
`refusalRateFor` **weighted by where that tier's searches are**, so each
position's rate is already its realised rate given its own country. Normalising
market-wide would have broken a sourced derivation to chase a misread one.

**THE PATTERN, which this project has now hit twice.** CLAUDE.md already warns:
*"never add a real-world claim from memory, and read a benchmark's context
before quoting it"* — written after F15 quoted an apparel click-through figure
without its context. This is the same failure one layer up: the number was
quoted accurately and attached to the wrong axis. **A figure needs its
denominator carried with it, not just its value.** The check that caught it was
searching for the claim itself rather than for support of it.

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

### I40. The page's own money was worth five points of five — `FIXED` (2026-09-19)

**The owner found it by playing.** Round 0's capital bought a landing page grade
of 10/10 from week 4, off one purchase, and a size guide bought beside it moved
the grade not at all.

**Measured, before anything changed.** The grade starts at `PAGE_GRADE_BASE` 5
and stops at 10, so five points are buyable. Three come from the description the
capital composes — speed, reviews, sizing — and up to
`CAPEX_LANDING_PAGE_MAX_POINTS` came from `landingPageBonus`, which reads the
money on the page target alone:

| bought at round 0 | grade from week 4 | computed |
|---|---|---|
| page ₹25,000 | 6 | 6 |
| page ₹55,000 | 9 | 9 |
| **page ₹80,000** | **10** | 10 |
| page ₹80,000 + size chart ₹25,000 | 10 | **11** |
| page ₹80,000 + guide ₹55,000 | 10 | **11** |

The top rung of ONE ladder hit speed, reviews AND the full three-point bonus:
five of the five, from ₹80,000 of a ₹1,20,000 allocation. Every combination
above it computed 11 against a cap of 10, so a point was always discarded — and
the discarded point was always the size guide's, which is why buying one beside
the top page was worth nothing to the grade.

**Two mechanisms were paying for the same purchase.** `landingPageBonus`'s own
comment says it is kept separate from the business block so that two things do
not write one number (the L6 defect). They stayed separable in code and stopped
being separable in play: one spend drove both.

**The decision: `CAPEX_LANDING_PAGE_MAX_POINTS` 3 → 2.** The arithmetic then
closes exactly — 5 + 3 sentence points + 2 = 10 — so no combination computes
above the cap and no point a player buys is thrown away. The top page alone
grades 9; reaching 10 needs the page AND a size guide, ₹1,05,000 across two
targets.

**The owner's hard gate, agreed before the measurement:** no combination of the
three ladders may compute above 10. Held by `tests/landingPage.test.js`, over
every rung of all three ladders under both rule sets.

**Measured with `scripts/market-harness.js page`, 72 markets before and after.**
Only the purchases that actually carried the bonus move:

| bought at round 0 | before | after |
|---|---|---|
| size guide | ₹40,343 | ₹40,392 |
| reviews (page ₹55,000) | ₹1,03,620 | **₹85,736** |
| top page (₹80,000) | ₹1,29,405 | **₹1,01,299** |
| photography | ₹21,951 | ₹21,958 |
| faster page (₹25,000) | ₹25,239 | ₹25,287 |
| guide + shots | ₹61,724 | ₹61,719 |

The page is still worth buying — the top rung still beats keeping the money by a
median ₹1,01,299 and wins 51 markets of 72 — it is no longer worth five points
of five.

**IT MOVES THE RIVALS TOO, and I38 is imprecise about this.** That entry says
rivals' page grades are authored rather than scored, "so only the player's grade
moves directly". True of the DESCRIPTION grade; the bonus is applied in
`buildEntryPlans` to every advertiser (`engine/round.js`), so any rival holding
capital on its page is regraded as well. Measured: 66 of 72 markets where the
player buys no page still move, by 0.03-0.25% of the player's net, and the
largest single rival median move is **-2.89%**, under the 5% I37's G8 used.

**Rejected, and worth recording.** Moving the sizing point up the size-guide
ladder (from "a basic size chart" to "real measurements") would have put 10 out
of reach of one capital window, which is closer to what the owner asked for. It
was measured and dropped: it moves the cheapest route to the best description
grade from ₹80,000 to ₹1,10,000, which deepens a squeeze on photography that is
already worse than the ledger claims — see the note under I29 below.

**A stale test, found on the way.** `tests/landingPage.test.js` asserted I29's
property that the best page no longer costs you photography. It iterated
photography over the SHARED rungs, and I30 gave photography its own ladder on
2026-09-17 — so it offered a ₹25,000 purchase photography does not sell, which
`featureAt` resolves to "none". Measured on photography's real ladder, on the
code as it stood before this entry, **I29's property is already false**: the
cheapest route to the best description grade is ₹80,000, leaving ₹40,000 against
a ₹50,000 first rung. The test now reads the real ladder and records what is
true, with a `test.todo` naming the open question: raise the allocation, or
accept the trade. **That is the owner's to decide and is not decided here.**

---

### I41. The round-0 allocation, raised to keep I29's trade alive — `FIXED` (2026-09-19)

**I29's property had been dead for two days and its test was green.** I29 raised
the capital round to ₹1,20,000 expressly so the best page would stop costing you
photography. I30 then doubled photography's first rung, ₹25,000 → ₹50,000, and
the trade came straight back: the cheapest route to the best description grade
is ₹80,000, leaving ₹40,000 against a ₹50,000 rung. Nobody saw, because
`tests/landingPage.test.js` iterated photography over the SHARED rungs and kept
offering a ₹25,000 purchase photography does not sell — one `featureAt` resolves
to "none". The single combination holding the assertion up was buying nothing.

**Measured, the property flips at one point and one only:**

| round-0 allocation | ways to the best grade | with photography |
|---|---|---|
| ₹1,20,000 | 3 | **0** |
| **₹1,30,000** | 4 | **1** |
| ₹1,40,000 / ₹1,50,000 | 6 | 1 |
| ₹1,60,000 | 9 | 3 |

**The owner chose ₹1,50,000** (2026-09-19): it clears the ₹1,30,000 cliff with
₹20,000 of slack, so a later price change on either ladder cannot silently kill
the property the way I30's did. Two rounds are ₹3,00,000 against ₹4,00,000 to
max all four targets on their own ladders, so one target must still be given up
over the whole game — the trade I29 wanted.

**The owner's hard gate, agreed before measuring:** the property must hold on
photography's OWN ladder. It does, and the test now checks that each qualifying
combination buys a rung photography actually HAS — `featureAt(...).label` is not
"none" — which is the check the shared-ladder version could not make.

**IT MAKES ALMOST EVERYONE SLIGHTLY POORER, AND THAT IS THE INTERESTING PART.**
72 markets each way, median final net profit:

| round-0 page | before | after | |
|---|---|---|---|
| keep it all as ad money | ₹11,99,626 | ₹11,66,491 | **−2.8%** |
| the faster page | ₹12,28,325 | ₹12,13,388 | −1.2% |
| the top page | ₹12,29,748 | ₹12,18,465 | −0.9% |
| a size guide | ₹12,43,583 | ₹12,33,762 | −0.8% |
| reviews | ₹12,35,688 | ₹12,29,618 | −0.5% |
| photography | ₹11,80,447 | ₹11,83,903 | +0.3% |
| guide and shots | ₹12,10,263 | ₹12,20,166 | +0.8% |

**Why: rivals absorb the extra worse than the player, so more of it becomes ad
money.** A rival's investment is capped by its ceilings, so a bigger allocation
spills further into its budget — rivals' median month-2 budget rose ₹60,000
against the player's ₹30,000. The market is richer, and therefore dearer: player
CPC ₹12.0 → ₹12.3, net ROAS 6.56 → 6.34. Median rank is unchanged at 5, and
nobody loses money in any of the 72 markets before or after.

**The shape of that is right even though the level fell.** KEEPING the money got
relatively worse (−2.8%) than spending it (−0.5% to +0.8%), and the two rows
that gained are the ones that put it on the ladder tall enough to absorb it. A
bigger allocation sharpens the capital decision rather than blunting it, which
is what 13.3 wants: not investing stays viable, and stays a real cost.

**Three tests were resting on arithmetic that only held at ₹1,20,000**, and all
three are now written against the ladders instead of the figure: two allocations
pinned to exactly three shared top rungs (`constants.test.js`); the best grade
pinned to 66% of a round (`landingPage.test.js`); and the S-curve's
spread-versus-commit comparison, which split the whole round against the whole
round committed to one target — but the curve tops out at ₹80,000, so past that
"committed" meant a spend whose tail bought nothing and the test measured waste
rather than shape. It is measured against the curve's own top now, and no player
can reach the old case anyway: the cards offer rungs.

---

## Maintenance rule

Every time you or Claude Code picks a number with no source, add it here before
committing. If it is not in this file, it is not a decision — it is an accident.

**And the corollary, learned the hard way in v0.3:** every time a number is deleted
from `constants.js`, check this file for an entry defending it. `QUALITY_WEIGHTS`
and `EXTENSIONS_IMPACT` were argued for at length here while no formula in the spec
ever read them. A ledger that defends numbers the engine cannot see is worse than no
ledger, because it reads as evidence that the thing was modelled.

---

### I42. The provenance audit: what was invented by default rather than by choice — `FIXED` (2026-09-20)

> **CLOSED THE SAME DAY BY I44, AND THE ANSWER WAS NOT MORE SOURCING.** This
> entry set out to split 57 INVENTED constants into "nothing could be sourced"
> and "nobody looked". Working through them showed a third category nobody had
> allowed for and it was the largest: **30 of the 57 were not claims about
> advertising at all**, but rules of the game — its length, its economy, its
> clamps. They could not be sourced because there was nothing to source. I44
> gives them their own tag, `DESIGNED`, and the count of genuinely invented
> claims falls from 57 to 26. The figures quoted below (59, 22) are as they
> stood mid-audit; I44 has the settled ones.
>
> **The 3/10 rating this entry opens with rested on a number that was
> measuring the wrong thing.** That does not make the model well-sourced — 26
> real claims about advertising remain unsourced — but 26 of 48 world-claiming
> constants is a different statement from 57 of 79, and the second one was
> never true in the sense a reader would take it.

Phase 3 of `plans/2026-09-20-critical-review-programme.md`. The review rated
quantitative grounding 3/10 on one figure: **59 of 79 tagged constants were
INVENTED and 8 DOCUMENTED**, five of those eight being the Indian returns
numbers. The question this entry answers, constant by constant, is which were
invented because nothing could be sourced, and which because nobody looked.

**The method, and it is the part to reuse.** F21 had just shown a quoted figure
attached to the wrong axis, so the sweep ran that check first: every INVENTED
constant whose comment makes a quantified real-world claim. Seven of 59 did, and
**all seven came back clean** — `QUALITY_FACTOR_RANGES`' 88.6% and 20.2%,
`PREDICTION_ERROR_BASE`' 27% and 8%, `PACING_REFERENCE_CURVE`'s 14.6% are all
measurements of this simulation, not claims about the world. F21 was the only
misattribution, which is worth knowing: the discipline is better than one bad
case suggested.

**The gap that did turn up: 22 of 57 INVENTED constants have no comment directly
above them.** Stated carefully, because the first version of this sentence said
"no comment at all" and that was wrong: several are covered by a comment on a
neighbouring constant or on the group, and `RATING_TO_SCORE_TABLE`'s own comment
sits above an intermediate helper. Which of the 22 are genuinely undocumented
and which are group-covered is what the audit is working through one at a time.

What is not in doubt is that some are real modelling claims rather than
self-evident structure — `HOURLY_INTENT_CURVE`, `QUALITY_MIN_IMPRESSIONS`, the
two `RATING_*` thresholds, `BRAND_POACHER_MULTIPLIER`, `CAPEX_DELAY_ROUNDS` —
and those are the ones worth writing up.

#### Settled so far

| constant | was | now | why |
|---|---|---|---|
| `SMART_BIDDING_MIN_CONVERSIONS` | INVENTED | **DOCUMENTED** | it is Google's own published figure, and nobody had looked |
| `LEARNING_ROUNDS` | INVENTED | **ESTIMATED** | Google gives the wait in conversion cycles, not weeks |
| `MAX_SLOTS` | INVENTED | INVENTED, *looked for* | Google publishes no count |
| `QUALITY_MIN_IMPRESSIONS` | INVENTED | INVENTED, *looked for* | Google publishes that the threshold exists, not where |
| `RATING_UPPER/LOWER_THRESHOLD` | INVENTED | INVENTED, *looked for* | the three bands are Google's, the cutoffs are not |
| `DEFAULT_UNGRADED_QUALITY` | INVENTED | INVENTED, *clarified* | Google's "—" is what is SHOWN; this is what the auction assumes |
| `HOUR_PROFILES` | INVENTED | INVENTED, *looked for* | the sources disagree; 20:00 sits between them |
| `DAY_OF_WEEK_CURVE` | INVENTED | INVENTED, **contradicted** | every source found points away from a Saturday peak |

**`SMART_BIDDING_MIN_CONVERSIONS` = 30.** "To evaluate results accurately,
Google Ads recommends measuring performance over longer time periods that have
at least 30 conversions, such as a month or longer (50 conversions for Target
ROAS)" (*About Smart Bidding*). Target CPA's page repeats it: "we recommend you
measure performance for the last 30 days, including at least 30 conversions".
**One figure where Google gives three**, and the simplification is now named in
the constant: Target ROAS wants 50 to evaluate and has a separate eligibility
floor of "at least 15 conversions in the past 30 days" for Search and Shopping.

**`LEARNING_ROUNDS` = 2.** Not DOCUMENTED, because the unit had to be converted.
Google says "give it 1-2 conversion cycles" (*About Target ROAS bidding*); a
cycle is however long an account takes to convert, and reading that into weeks
is an inference. **A converted unit is where a sourced figure becomes an
inferred one** — F21's lesson applied to a case that looked liftable.

**`MAX_SLOTS` = 4 — the negative result, recorded so nobody searches twice.**
Google's own help says only that "ads can appear above or below search results
on Google Search" and gives no count either way. Plenty of third-party pages
assert four; matching an unsourced claim is not a source. It stays INVENTED,
and its existing game-design justification is the honest one.

**The Quality Score batch, and what it says about the model's fidelity.** Google
publishes the *structure* and none of the *numbers*: "This score is measured on
a scale from 1-10", built from expected clickthrough rate, ad relevance and
landing page experience, each "evaluated with a status of 'Above average,'
'Average,' or 'Below average'" (*About Quality Score*). Every one of those the
game already matches. What it does not publish is where a band begins, how many
impressions a rating needs, or what an unevaluated ad is assumed to be worth in
the auction — so those three stay INVENTED with the search recorded.

One thing the fetch settled rather than changed: Google shows a dash for an
unevaluated keyword, and this game does too (`gradedQuality` is null until
graded, 9.5). `DEFAULT_UNGRADED_QUALITY` is the auction's assumption, not the
account's display, and the two were already right.

**The demand curves, and the first thing the audit found that is actually
WRONG.** `DAY_OF_WEEK_CURVE`'s comment says "weekend browsing runs higher" and
the table peaks on Saturday. Every source found points the other way — "Mondays
have also overtaken weekends as the busiest day for completed transactions"
for Indian online fashion (DFU Publications), and "Friday Is the Peak eCommerce
Day in the U.S." with activity that "peaks on Friday before declining over the
weekend", while in the UK and Germany "only on Saturday... is there a notable
decline" (ECDB, 2023). Saturday is the one day two of three markets single out
as falling.

**It was left alone, and the reasoning is the point.** Nothing a player does
touches this curve: there is no day-of-week bid adjustment in the game, it feeds
only `searches()`, and a round IS a week, so the weekly total is identical
whatever shape it takes. Correcting it would move which day volume lands on,
interact with daily pacing, and need gates and a market measurement — to buy no
lesson. **So it is recorded as a trap instead:** if day-of-week targeting is
ever added, this curve becomes player-facing and must be re-sourced first,
because it currently points the wrong way. That note is in the constant, where
whoever adds the feature will be standing.

`HOUR_PROFILES` came out better. The sources disagree with each other —
"browsing activity peaks around 10 p.m." for Indian fashion (Fynd, via DFU),
against "the early evening from 7 p.m. onwards" for the UK and Germany (ECDB) —
and the evening profile's 20:00 sits between them. That is the most it can
honestly claim, so it stays INVENTED rather than borrowing either number.

**THE AUDIT ALSO CONFIRMED SOMETHING THE MODEL GETS RIGHT, and it is the thing
most practitioners get wrong.** Google's own words:

> "Quality Score is not an input in the ad auction. It's a diagnostic tool to
> identify how ads that show for certain keywords affect the user experience."
> — *About Quality Score for Search campaigns*

This engine enforces exactly that, architecturally rather than by convention:
CLAUDE.md's rule 4 is "Nothing in `engine/` may read `reportedScore`. It is
output only", the auction runs on `qualitySignal`, and `reportedScore` is
computed for the account to read and nothing else. A simulator that let the
displayed score feed the auction would teach a falsehood that a great deal of
published advice repeats. Worth recording on the credit side of the ledger,
since an audit that only finds faults is not measuring.

**The two biggest constants were already reasoned, not defaulted.**
`POSITION_ECONOMICS` states its own case for staying INVENTED — order value and
margin "sit inside quoted bands without a citation tight enough to call
documented", and `convRateBase` is conversion on a PAID CLICK, which the 1.8–3%
site-wide benchmark does not measure (F14). `PURPOSE_MODIFIERS` averages to
exactly 1.0 by construction so `returnRate` stays the sourced total. Both
checked, both correct as tagged, neither needing work.

**The brand multipliers, and the pattern holding for the fourth time.** Google
defines ad relevance as "how closely your ad matches the intent behind a user's
search", so a rival's ad on your brand term being less relevant follows from
Google's own definition — the DIRECTION of `BRAND_POACHER_MULTIPLIER` is
sourced. Nothing in Google's help puts a number on competitor brand bidding, so
2.5x and 0.25x stay this game's own.

**What this does not yet do.** The remaining 57 INVENTED constants have not all
been searched, and the 22 without a comment of their own have not all been
written up. The
guide's honesty line still reads true — `tests/guide.test.js` checks it against
`PROVENANCE` on every run, and at 57 of 79 "mostly invented" is still an
understatement.

---

### I43. This stays an auction game, and says so — `DECIDED` (2026-09-20)

**The question**, from the critical review's Phase 5: is this game about **the
auction**, or about **the modern job**? Real paid search is increasingly about
feeding automation, and a simulator that teaches only manual keyword bidding
would be teaching a version of the work that is being automated away.

**The premise turned out to be mostly wrong, which is why the answer is
narrow.** The game already teaches the automation transition: the player can
choose manual, Maximise clicks, Maximise conversions, Target CPA and Target
ROAS; `LEARNING_ROUNDS` and `LEARNING_ERROR_MULTIPLIER` model a learning
period; `predictionErrorSigma` falls with the square root of conversions, so
automation genuinely improves with data; chapter 20 is *Smart bidding has to
learn* and chapter 17 is *How far broad match wanders*. The gap was never Smart
Bidding.

**The gap is Performance Max, and it is a gap in the MODEL'S SELF-DESCRIPTION
rather than in the model.** Spec 20 lists thirteen deliberate omissions —
devices, audiences, multiple campaigns, ad-group negatives, seasonality,
shopping and local SERP elements, lifetime value, multi-touch attribution, RSA
asset combination testing, ad disapproval, search-terms thresholding, a
depleting bankroll, a third positioning axis — and does not list the largest
one. Before today, "Performance Max" appeared nowhere in the guide, the ledger
or the spec.

**Decided: do not model it. Name it.** Three reasons, in order of weight.

**It is not a search-auction mechanism.** Google's own words: "Performance Max
is a goal-based campaign type that allows you to access all Google Ads
inventory, including YouTube, Display, Search, Discover, Gmail, and Maps, from
a single campaign" (*About Performance Max campaigns*). This engine resolves
search auctions. Building it faithfully means building five more inventories,
which is a different simulator rather than an extension of this one.

**It would remove the teaching loop rather than extend it.** This game's loop is
*guess which searches are yours, see what came back, revise*. Performance Max's
advertiser decision is to supply "assets and settings... like images, data
feeds, and bidding goals" and let Google "automatically funnel your budget
toward the highest performing inventory and placements". A faithful simulator
of that is a simulator of not deciding — and the two halves a player DOES
decide, the assets and the goal, this game already teaches as *Who writes the
ad* and Target CPA / Target ROAS.

**The defect was the silence, not the absence.** A player could finish twelve
weeks and meet a real account that is mostly Performance Max, with nothing
having told them it exists. That is the same failure as the numbers before the
guide's honesty line: the model is defensible and the claim of completeness was
not.

**So:** a new chapter, *What this game leaves out*, carries the boundary in the
guide's own voice, sourced to Google's page, with the keyword list as the card
it points at — a keyword list being exactly what a Performance Max campaign
does not have. Performance Max is added to spec 20's omissions with its
reasoning.

#### The chapter got the rest of the picture on 2026-09-25

The owner asked to teach PMax better rather than model it, which is this entry's
answer carried further. Three things went into chapter 24, all fetched from
Google rather than written from memory:

**THE BEST OF THEM CONNECTS WHAT IS TAUGHT TO WHAT IS MISSING.** When a Performance
Max campaign and a search campaign want the same query, Google's own page on the
interaction says a search campaign whose keyword *"exactly matches or is
spell-corrected to a person's query will be preferred"*, and that otherwise
*"the campaign with the higher Ad Rank will serve"*. **Both of those are what
this game spends twelve weeks on.** The boundary chapter now says so: the
player is not learning a museum piece, they are learning the two things that
decide the contest at the boundary.

**AI MAX IS THE MORE RELEVANT FIND, AND IT IS NEWER THAN PMAX.** It is not a
campaign type but a set of features layered on a SEARCH campaign — which is
what this game models — letting Google match, write and land the click. Google
says keywords still exist there and do less. That is the Phase 5 concern in
Google's own words, inside the campaign type this game teaches, so it is named
in the chapter and in its departures.

**ONE CLAIM WAS FOUND AND NOT USED.** A search summary asserted that a
budget-limited search campaign lets PMax serve on exact-match terms anyway.
Google's own interaction page does not say it, and the caveat would have been
load-bearing here because this game models budget pacing. Unsourced, so
unused — F21's rule applied before it could become F21 again.

The guide's own guards did the editing: the first draft ran to 174 words
against the chapter limit of 120, with a 31-word sentence against a limit of
25. Both bounds held and the text was cut, not the bounds.

**What would reopen this.** Phase 0. What a beginner says they learned is the
evidence for which game this actually is, and nobody has finished it yet.

---

### I44. `INVENTED` was doing two jobs, and the count said the model was worse than it is — `FIXED` (2026-09-20)

**The finding that started it**, from Phase 3's audit (I42): of 57 constants
tagged `INVENTED`, most were not claims about advertising at all.
`TOTAL_ROUNDS = 12` sat in the same bucket as an invented conversion rate.
`SCHEMA_VERSION = '0.3'`, a save format's version string, sat there too.

**The tag was answering two different questions with one word.** Both senses
mean "we chose this". They differ in what a wrong value costs:

- **`INVENTED`** asserts a magnitude in advertising that nobody sourced — how
  much better position 1 is, how a rating becomes a Quality Score, how demand
  moves through a day. **A wrong value teaches something false**, which is the
  failure this project exists to avoid.
- **`DESIGNED`** is a rule of this game — its length, its economy, what a clamp
  bounds, what the engine samples. **A wrong value makes a worse game**, and
  cannot make a false claim, because it claims nothing about the world.

**The test applied to all 57, one question each:** does this assert a magnitude
in the real world, or define the game's own structure?

| | before | after |
|---|---|---|
| `DOCUMENTED` | 9 | 9 |
| `ESTIMATED` | 8 | 8 |
| `CALIBRATE` | 5 | 5 |
| `INVENTED` | **57** | **26** |
| `DESIGNED` | — | **30** |
| no tag | 0 | 1 |

**Thirty moved.** The game's length and shape (`TOTAL_ROUNDS`,
`ADVERTISER_COUNT`, `PRICE_TIERS`, `PURPOSES`, `LOCATION_TIERS`); its economy in
game money (`MONTHLY_BUDGET_PAISE`, the `CAPEX_*` allocations,
`REPOSITION_COST_PAISE`); the clamps and floors (`CONV_RATE_CLAMP`,
`RETURN_RATE_CLAMP_MAX`, `PREDICTION_ERROR_CLAMP`, `MIN_BID_PAISE`); what the
rival policies may do (`MAX_CLICKS_AGGRESSION`, `MIN_HOUR_OBSERVATIONS`); the
shape of the content (`TAG_VOCABULARY`, `QUERY_SET_RULES`); and the interface's
own granularity (`DAYPART_BLOCKS`, `AUCTIONS_PER_QUERY_HOUR`).

**A clamp is the clearest case, and the rule it produced is worth keeping.** A
clamp asserts nothing — it stops a value leaving the range the engine can
reason about. Which means **a clamp that binds in normal play is a defect, not
a number to tune**: if `RETURN_RATE_CLAMP_MAX` starts binding, the multipliers
upstream are wrong, and raising the clamp would hide it.

**`LOCATION_TIERS` shows where the line falls.** Three tiers is a structure and
is now `DESIGNED` — how many bands to cut India into is this game's choice.
What each band *does* is the three `CALIBRATE` tables, and those are
measurements. Same for `PRICE_TIERS` (`DESIGNED`) against `POSITION_ECONOMICS`
(`INVENTED`): the vocabulary claims nothing, the effects claim everything.

#### The guide's honesty line, and why the denominator moved

`GUIDE.whatIsReal` tells the player the sizes are "mostly invented", and
`tests/guide.test.js` holds it with `share('INVENTED') > 0.5`. The retag would
have dropped that share from **72% to 47%** and failed the test **without one
number about advertising changing**.

That failure would have been an artefact. The sentence is about **the sizes** —
how big this game says a thing in advertising is — and a game rule is not one of
them. No value of `TOTAL_ROUNDS` can be wrong about Google. So the share is now
taken over world-claiming tags only (`DOCUMENTED`, `ESTIMATED`, `INVENTED`,
`CALIBRATE`), where it stands at **26 of 48, 54.2%**, and the line holds.

**This was not a bound being widened to keep a test green**, and the test's own
comment forbids that. It is a denominator corrected to measure what the sentence
actually says. The margin is now thin on purpose: three more constants sourced
and it trips, which is what a tripwire is for.

#### One exemption, named so it cannot grow

`SCHEMA_VERSION` carries **no tag at all**. A provenance tag answers "where did
this quantity come from", and the save format's version string cannot be asked
that question. `tests/constants.test.js` names the exemption in a list of one
and asserts the name is not in `PROVENANCE`. **A number you cannot source is
`INVENTED` or `DESIGNED`, never exempt.**

#### What else the pass found

**Spec 18.1's table was stale in the opposite direction.** It listed three
`DOCUMENTED` and three `ESTIMATED` when there were nine and eight — it predated
the returns strand (G4, I34) entirely. So while this entry argues the count
overstated how invented the model is, the spec was *understating* how sourced it
is by six constants. Both are now right, and the table says to re-derive it
rather than trust it.

**Sixteen constants got the note they never had**, which was Phase 3's actual
"done when": `TOTAL_ROUNDS`, `PRICE_TIERS`/`PURPOSES`, `REPOSITION_*`,
`RIVAL_PLACEMENT_CONSTRAINTS`, `MIN_PEAK_SEPARATION_HOURS`,
`HOURLY_INTENT_CURVE`, `DAYPART_BLOCKS`, `AUCTIONS_PER_QUERY_HOUR`,
`RATING_TO_SCORE_TABLE`, `MONTHLY_BUDGET_PAISE`, `RETURN_RATE_CLAMP_MAX`,
`CAPEX_DELAY_ROUNDS`, `SCHEMA_VERSION`.

**Two of those are worth reading as a pair.** `RATING_TO_SCORE_TABLE` is
recorded as **unsourceable in principle**: Google publishes the three Quality
Score components and that the scale runs 1-10, and has never published how the
three become the one, because the weighting is the mechanism. Third-party pages
assert mappings reverse-engineered from small samples and disagree; matching one
would dress a guess as a citation, which is `MAX_SLOTS`' lesson.
`HOURLY_INTENT_CURVE` is the opposite — **the one that might yet be sourced**,
and the note says what was searched for, what was not found, and that it is the
first constant to replace if a real curve appears.

#### `HOURLY_INTENT_CURVE`: the one that might have been sourced, and was not

The note above named it the first constant to replace if a real curve appeared.
It was then searched properly the same day, and **the finding is not "nothing
was published" — it is that what is published is the wrong quantity.**

Nearly every source gives **orders by hour**. Orders are volume × intent, and
volume is already `HOUR_PROFILES`. Fitting an order curve to
`HOURLY_INTENT_CURVE` would count volume twice, making the busiest hour also
the best-converting hour, collapsing `MIN_PEAK_SEPARATION_HOURS` and destroying
the dayparting trade the game exists to teach (H4). **That is worse than
inventing the curve**, and it is F21's error in a new place: a real figure
attached to the wrong axis.

| searched | what it was |
|---|---|
| SureBright, 1M+ US orders | order distribution; explicitly "does not separately break out conversion rates per session"; US only; no 24-hour table |
| dayparting guides ("12–18% peak against 5–8% off-peak", "40% swing") | vendor pages, no methodology, sample or source |
| Google's ad scheduling documentation | the control, not the data; its worked example is a fictional dog-sled business |
| arXiv 1905.05938, conversion-rate outlier detection | one unnamed store, no hourly curve |
| conversion-rate benchmark round-ups | segment by device, AOV, industry — never by hour |

**Not contradicted, and the distinction from `DAY_OF_WEEK_CURVE` matters.** The
one source naming a converting hour puts it at 14:00 with a 13:00–15:00 peak,
and this curve peaks at 15:00 — agreement. But it is a single agency's own
website, with no sample size, industry, geography or period, written to show
readers how to build the report. Agreement that thin cannot carry 24 numbers.
`DAY_OF_WEEK_CURVE` was *contradicted* by every source found; this one is
merely unsupported, which is a weaker charge and a different remedy.

**What would qualify, written down so the next search is shorter:** conversion
rate per session by hour — not orders — with a stated sample, period and
geography.

#### `HOUR_PROFILES` gained a third source and kept its tag, and the rule is the point

The India search turned up Shadowfax's 2024 delivery data and ClickPost, both
putting Indian online ordering strongest **8–11 p.m.**, tier-2 and tier-3
cities later still. That is the right quantity for `HOUR_PROFILES` — volume —
and it corroborates the 20:00 evening peak that I42 could only say "sits
between" Fynd's 10 p.m. and ECDB's 7 p.m. Three sources now, all pointing at
the evening.

**It was proposed for INVENTED → ESTIMATED on the strength of that, and the
proposal was wrong.** This file's own precedent settles it:
`COD_SHARE_BY_PRICE_LOCATION` is ESTIMATED because its price axis is inferred
even though its location axis is sourced — "tagged for the weaker of the two".
Here the **peak hour** is corroborated and the other twenty-three numbers in
each profile — trough depth, morning gradient, peak width — are sourced by
nothing. Retagging would let one sourced hour vouch for twenty-three invented
ones.

**A tag describes the weakest number it covers.** Worth stating as a rule
because the temptation runs the other way: a constant that has been researched
*feels* better sourced, and the tag is not a record of effort spent.

**What would reopen this.** A sixth tag. If one is ever proposed, the question
to ask is the one this entry turned on: what does a wrong value cost? Two tags
that answer that the same way should be one tag.

### I45. An offer made to customers is public — `FIXED` (2026-09-25)

**The player could not find out that rivals discount, by any route.** Asked to
show a rival's prepaid discount, the Rivals card read
`who.campaign.prepaidDiscountPaise` and drew nothing, in every game, for every
rival: `ui/dashboard.js` hands the section `view.advertisers`, and
`getPublicView` built a rival as `{id, name, domain, ads}` with no `campaign`
on it. `?? 0` turned the missing shape into a confident "no offer".

**And rivals do discount.** Measured on the committed harness, two of eight
offer ₹50, live from week 3, in every seed tried (20260901, 20260902, 7, 12).
So since the C9 fix the one lever still open after round 5 has been contested
INVISIBLY. That is worse than an uncontested lever: a player could not tell
whether their ₹50 matched the field or was being paid alone, so their own
restraint looked like skill.

**Why the field was missing was never decided — it was simply never asked.**
`prepaidDiscountPaise` is not in `FORBIDDEN_IN_PUBLIC_VIEW`, but the view is a
WHITELIST, so being absent from the blacklist granted it nothing.

**The distinction the blacklist actually encodes.** Everything the view
withholds is private OPERATING data: what an advertiser bids, budgets and
spends, what it believes a query is worth, what it has told Google to avoid.
A competitor genuinely cannot see any of it. **A prepaid discount is the
opposite kind of fact.** Its entire purpose is to be seen by shoppers — it
sits on the shop's site and in its ads, and a competitor reads it by looking.
Withholding it modelled a shop that discounts in secret, which is not a shop.

So the field joins the public view, beside the name, the domain and the ad.

**What was considered and not chosen:** putting the offer into the rival's own
ad copy at the point the policy sets it. That is the most faithful version —
the line would literally be in the creative, needing no change to R3 at all,
because ads are already public. It was rejected for now on cost: rival ads are
fixed at `setup.js` while the discount starts at week 3, so a policy decision
would have to be able to carry creative, which today it cannot. If decisions
ever carry creative, this is the better home and this entry should be revisited.

**It reaches rival controllers too, and that is the real cost of the choice.**
Every advertiser gets the same public view, so a policy could now read what
its rivals offer and undercut them. None does today — which is why the market
is unchanged, measured as 72 whole games byte-identical before and after. A
policy that starts reading it is making a market-moving change and needs its
own gates.

**Where it shows.** A discounting rival's card carries the line at the end of
its ad: "₹50 off when you pay online." In the ad rather than in a panel of its
own, because that is what a shop does with an offer, and finding it is the
same reading step 2 already teaches.

**The guard this left behind.** The version that drew nothing had a green
test, because the test spread a `campaign` onto `tests/rivals.test.js`'s
fixture — a shape play never produces. Same failure as the three rival rules
that read `report` for returns and read zero for months. That file's fixture
is now the public view's keys exactly, `the shape a card is really handed`
locks it to `getPublicView`, and the offer's own tests build their advertisers
by calling `getPublicView` rather than by hand.

**What would reopen this.** A second field wanting in on the same argument.
The question to ask is this entry's: is it something the advertiser tells
customers, or something it tells Google? The first is public. The second is
not.

### I46. Four of six characters were never handed the prepaid lever — `FIXED` (2026-09-25)

**The finding.** `prepaidNudge` is a shared helper, but only
`disciplinedAccount` and `grossOptimiserAccount` called it. `spender`,
`cautious`, `automator` and `brandDefender` never did, and `withCapital` adds
only capex — so **two of eight rivals ever discounted**, in every seed.

**They were not declining it on their numbers.** Measured on the last played
week of seed 20260901, **all eight rivals sit between 12.2% and 18.6%**
weighted refusal, against a 12% line that buys ₹50. Every one of them was over
the line their own rule uses.

**So this was the C8 shape** — a decision written into some policies and not
the rest — rather than a character choice. Two things say so. Every other
deliberate omission in `agents/policies.js` is stated in the header that owns
it (`spenderAccount`: "Negatives stay empty, every round. That is the whole
character."), and none of the four mentions prepaid. And the cast's standard
is that each character is wrong about one thing **legibly**, while a rival's
refusal rate appears on no screen, so this one could not be read.

**`automator` gets it on both paths, not just the switching one.** Its
satisfied path returns `{ campaign: { strategy: current } }`, and a lever it
could only reach in the weeks it happened to be changing strategy would be a
rule about the code rather than about the character. `applyDecision` merges
rather than replaces, so omitting the field keeps the last value — the C8 trap
does not apply here, and was checked rather than assumed.

**GATES, agreed with the owner before measuring, all passed.** 72 whole games
before and after.

| gate | before | after |
|---|---|---|
| rivals offering | 2 of 8 | **8 of 8**, from week 3, ₹50 |
| any rival dark in any week | none | **none** |
| player's median final rank | 5 | **5** (gate: may slip to 6) |
| player loses money | 0 of 72 | **0 of 72** |
| player's own ₹50 lever, six cells | 2.6/3.4/2.7/2.9/1.1/1.4% | **2.6/3.4/2.7/2.8/1.1/1.4%** |
| D12's week-9 move (gate: double) | 3.78× | **3.97×** |
| cast's best/worst profit spread | 8.21× | **7.99×** |
| I3 worst deviation (bound 15%) | 11.2% | **11.2%** |

**What moved, and it is the right shape.** Rivals' returns fall 40.5% → 39.6%
and their profit per rupee rises 2.05 → 2.09. Taken by character, the four
that gained the lever each gain — `spender` +2.6%, `brandDefender` +1.2%,
`automator` +0.9%, `cautious` +0.9% — while the two that already had it dip
slightly, `disciplined` −0.1% and `grossOptimiser` −0.5%, because their rivals
got stronger. The player's own profit is not harmed: median ₹11,67,463 →
₹11,82,637.

**Two things recorded rather than hidden.**

- **The rank tail got worse** while the median held. Eighth place went from 0
  games of 72 to 2. Ninth is still never reached. The agreed gate was on the
  median and passes, but the worst case for a player is now slightly worse.
- **The lever is uniform across the cast.** All eight land on ₹50, because all
  eight are over 12% and `PREPAID_RUNGS` has only two steps. That is honest —
  everyone has a refusal problem, so everyone should discount — but it means
  no rival is distinguishable by this lever any more, where two of eight used
  to be. If that matters, the thing to change is the rung table, not who calls
  the helper.

**Calibration is unaffected by construction**, and that is worth stating
plainly rather than claiming a re-derivation: `tests/calibration.test.js`
drives `disciplined` alone, which this did not touch. Its 22 figures are
identical, I3's worst deviation 11.2% against a 15% bound.

**A stale figure this turned up.** `HANDOVER.md` gave the player's prepaid
lever as "+1.7% to +4.7% of final profit". On today's market it was already
+1.1% to +3.4% BEFORE this change. The quoted range predates F17 and C9.
`ui/chart.js` and `ui/words/market.js` also carried 3.53× for D12's week-9
move in their headers, measured 3.78× before this change. Both are comments,
not player-facing sentences — the screens carry the week's live figures — but
both are corrected.

**What would reopen this.** A character that should visibly NOT use the lever.
That is a legitimate design, and the way to build it is a documented rule in
that policy's header saying so, not silence in the code.

### I47. Everyone's books: one figure, one label — `FIXED` (2026-09-25)

**The owner asked for the section to be cleaner with more structure.** Three
options were drawn with real figures from a game played through to week 12 —
`design/everyones-books/Options.html` — and B was chosen: **the ranking stays a
table, and the six figures that were a sentence open under the row**.

**What was wrong, found by playing to week 12 rather than reading the code.**

- **Six figures arrived as one run-on sentence**, drawn full width in 12px grey
  under each of the nine brands, nothing in it labelled:
  *"spent ₹4,81,159 · 1,482.6 conversions, ₹325 each · ₹4.62 of sales after
  returns per rupee of clicks · gross profit ₹13,97,433 · net profit ₹6,26,417
  before the ₹0 it built with"*.
- **The bars were hidden on most laptops.** `.rs-track` was `display: none`
  under a 900px section, and the Studio's rail and padding put the section at
  **886px on a 1280px viewport** — measured in the browser, not inferred. So
  the gap between gross and net, which is what returns took and the lesson of
  the whole page, was drawn only above about 1295px. The table degraded to
  seven columns of numbers with a dead gap where the picture should be.
- **Two columns were dead.** *Where they sat* is a dash until the reveal is
  answered, and *rank on gross* sat beside the rank already in column one.
- **"before the ₹0 it built with"** read as though zero were a purchase, on
  every brand that built nothing, which is most of them.

**What it is now.** Five columns that any width holds — place, brand, the bar,
what the business made, what returns took — and a row that is a button. Under
it, nine labelled figures, including the two dead columns. **Your own row is
open from the start**, because the one brand nobody should have to hunt for is
their own.

**The bar is the third column now, not the last thing before the numbers**, so
it is no longer the first thing dropped. On a phone it keeps its place by
taking a line of its own under the row rather than being hidden.

**What was NOT changed, and why.** The fractional order counts — *1,482.6
conversions* — look wrong and are not. Expected mode makes a sale a fraction,
`one()` is deliberate, and the Twelve weeks section formats the same figure the
same way. Rounding it here alone would have made two screens disagree about the
same number to no one's benefit. Left, and recorded so the next reader does not
re-find it as a bug.

**The guard.** `tests/results.test.js` now reads `ui/studio.css` as text and
fails on any rule that hides `.rs-track`, and checks the phone rule still lays
the row out **for** the bar. Checked against the deleted rule, which it
catches. This suite cannot render, so a text guard is what is available — and
the fault it guards was invisible to every other test in the project for as
long as it existed.

**Still open, and NOT this change's doing.** At 375px the page scrolls
sideways: on the books it is the shell's own end-of-game footer, whose two
buttons do not wrap; on Twelve weeks it is `.rs-chart`, which is deliberately
640px inside a sideways-scrolling container but overflows the page as well.
Both predate this and are left alone.

### I48. The Studio had one design system and nine implementations — `FIXED` (2026-09-25)

**The owner asked for the simulation to look more sophisticated.** What the
measurement found was not a missing visual language but the one already there,
written out between five and nine times and drifting a few pixels each way.

| object | implementations | how they differed |
|---|---|---|
| card | 10 | four byte-identical; the rest `16px 20px` / `16px 18px` / `14px 12px 12px` / `16px 20px 14px` |
| the big figure over a label | 5 | **24px** (Where and when), **26** (Rivals), **28** (Your week, Results), **30** (Returns) |
| uppercase micro-label | 5 | three byte-identical, two the same plus one property |
| bar or track | 20 | one per section |
| font sizes | **25 distinct** | seven used once or twice: 10.5, 12.5, 13.5, 17, 19, 22, 34 |
| display heading line-height | 3 | the same size at `/1.1`, `/1.15` and `/1.2` |

**The cause is recorded in `HANDOVER.md` already:** each section was rebuilt
beside the classic page one at a time, so each grew its own copy of the same
parts. Nothing was wrong; nothing was shared.

**Why near-consistency is the problem.** Full consistency reads as designed.
Deliberate variation reads as designed. Two pixels of padding that nobody
chose reads as careless, and the reading is correct — nobody did choose it.

**What was done, in two steps, the first proved to change nothing.**

- **Names for what was already identical.** Ten rules now read
  `--studio-card-pad`, `--studio-card-gap`, `--studio-card-edge`,
  `--studio-radius` and the micro-label's three. Verified by resolving every
  touched class in the browser against a probe carrying the old declarations:
  identical padding, radius, border, gap, size, weight, letter-spacing,
  transform, colour and **line box**.
- **One scale.** The seven one-off sizes moved to their nearest step. The big
  figure became one size at **28px**, the majority and the median of the five.
  Display headings settled on **one line-height, 1.1**, the majority of eleven.
  Every card surface — twenty-two of them — took one padding, gap, edge and
  corner.

**THE ONE CHANGE THAT IS TASTE AND NOT A FIX**, said plainly so nobody later
reads it as a correction: the card corner went **20px to 16px** and the card
gap **10px to 12px**. The radius was already consistent (20 card, 14 inner
surface, 12 control), so this is not a drift being removed — it is the look the
owner chose off `design/sophistication/Scale.html`, option B.

**Named exceptions, which is the difference between a system and a rule.**
`--studio-card-pad-tight` exists so What people typed's dense table says it
needs a denser card rather than inventing a fourth padding. The 48px page title
keeps `/0.95`, because a heading that size wants to be tighter than one half of
it. `.door-card` and `.pt-card` are standalone panels — a full screen before a
game exists, and a 560px centred form — and are deliberately more generous than
a card carrying figures. The guide keeps `--t-read: 17px` because it is read as
prose at length.

**Two defects fell out of the audit.**

- **`.rs-answer` was two different components under one name** — a `div`
  showing a counterfactual answer and the playtest question's `textarea`. CSS
  does not know one from the other, so the read-only answer was drawn with the
  input's border, radius and dark fill: something you could not type into,
  dressed as something you could. The div is `.rs-said` now.
- **`.fr-lede` was two adjacent rules**, the second overriding the first's size
  and colour, so the first's `font-size` had been dead for as long as both
  existed — and was still dead after the scale pass rewrote it. One rule now.

**What the guard holds** (`tests/sections.test.js`): the collapsed one-off
sizes do not return; every strip's figure reads `--studio-figure` rather than a
number of its own; display headings have one line-height, with the 48px hero
named as the exception; and every section card takes the card padding and
corner, with the two panels named. The suite cannot render, so this is text —
and text is what would have caught the drift in the first place.

**What is deliberately NOT done.** The twenty bar tracks and twenty-nine figure
classes are still twenty and twenty-nine. Consolidating them means moving card,
figure strip and bar into `ui/kit/` as components every section calls, which
touches all nine sections and needs each replayed. That is the next step and
was scoped as such, not forgotten.
