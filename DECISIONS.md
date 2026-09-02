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

### A6. Landing page ratings are compressed — `OPEN`
`landingFactor` spans 0.85–1.05, so an own-vs-field ratio can reach at most about
1.235, against a `RATING_UPPER_THRESHOLD` of 1.10. "Above average" on landing page
is reachable but narrow, and "below average" likewise.

If in play the landing page rating never leaves `average`, the fix is to widen the
factor range, not to move the threshold — the threshold is what makes the three
components comparable to each other.

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
a multiplier rather than a distribution. If the mean drifted from 1 it would
silently change the average conversion rate and invalidate every break-even
figure in spec 4.4. Tested.

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

### F9. Territory volume is engineered for balance — `OPEN`
Volume is split 52 / 28 / 20 across Value / Mid / Premium, derived so that each
tier's *total margin potential* comes out roughly equal — Premium generates about
2.7× Value's margin per thousand searches, so Value carries about 2.7× the volume.

Real markets are not balanced. This one is, deliberately, so that the round 0 choice
is a genuine trade-off (a high ceiling on thin volume against a low ceiling on thick
volume) rather than a right answer. Invariant I3 tests it.

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

## Maintenance rule

Every time you or Claude Code picks a number with no source, add it here before
committing. If it is not in this file, it is not a decision — it is an accident.

**And the corollary, learned the hard way in v0.3:** every time a number is deleted
from `constants.js`, check this file for an entry defending it. `QUALITY_WEIGHTS`
and `EXTENSIONS_IMPACT` were argued for at length here while no formula in the spec
ever read them. A ledger that defends numbers the engine cannot see is worse than no
ledger, because it reads as evidence that the thing was modelled.
