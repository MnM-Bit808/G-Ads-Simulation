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

**The tell that this is the right line:** `ASSUMED_RETURN_RATE` is 0.25 because
that is what the round 0 briefing tells the player (17.2), and it is *wrong* for
every cell on the grid — Value-Lifestyle really returns 36%, Premium-Performance
17%. A number that is deliberately wrong has no business in the file that defines
what is true.

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

**Sim:** two allocations of ₹1,00,000, three targets, an S-curve of guaranteed
effects, live three rounds after commitment.

**Simplified heavily in the player's favour.** What it does buy honestly is the
lesson the simulator otherwise could not teach at all: **the highest-return
marketing decision is often not a marketing decision.** A conversion lift improves
every click you buy for the rest of the game; more budget buys more clicks once.

**Why the curve is an S rather than diminishing.** With diminishing returns the
first tranche on every target is the most efficient purchase, splitting three ways
becomes strictly optimal, and the amount choice collapses to a solved puzzle. The S
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
