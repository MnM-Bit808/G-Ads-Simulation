# Stage D2: the January surge

> **Stopped at its first gate, 2026-09-13: not built.** Google Trends shows no
> January surge in Indian activewear searches (training 0.99 of November–December
> over weeks 9–11). See DECISIONS F16. Kept as the record of how it was tested.

*Design, 2026-09-13. Decided with the owner one section at a time. No code has
been written against it. Route B of recommendation 7 in `reviews/slc-review.md`,
after DECISIONS D12 measured and ruled out route A.*

*X, Y, N and M in the card's sentences mark where the player's own figures go;
nothing here is a measured number until section 6's sourcing has run.*

## 1. Why

**The back half of the game asks nothing.** The last new decision arrives at
week 5 and settled feedback starts at week 7, so the two never meet (HANDOVER,
*And the calendar says the same thing structurally*). The one recorded learner
made decisions in 4 of 12 weeks and clicked through the last seven in 72
seconds.

The review offered two routes. **Route A**, moving the second capital window to
week 7, was measured in D12: capital stays profitable, but the two returns
levers keep a quarter of their value, because no return from weeks 11–12
happens before the game ends. It would teach that fixing returns does not pay.
**Route B**, an announced market event true to the Indian calendar, is what is
left, and HANDOVER already preferred it as the only direction that adds a
lesson rather than removing a problem.

**The spec rules it out today.** `ENGINE_SPEC_v0.3.md` section 20 lists
seasonality among its deliberate omissions. This design therefore starts with a
spec amendment, and nothing is built until that amendment is written (section
7).

## 2. What was decided, and why

| question | decided | why |
|---|---|---|
| what the player decides | **how the account responds**: budget split, bids, keywords, negatives, strategy | keeps it an ads decision; prices and margin stay untouched |
| which moment | **New Year fitness resolutions** | the one surge specific to activewear, and it needs no discount; a sale would be a price event the player's prices never join |
| what moves | **search volume only** | the best-evidenced change and the fewest invented numbers; spend, prices, budgets running out and Smart Bidding's behaviour all emerge from the existing engine |
| which searches | **training searches rise, lifestyle ones stay** | resolutions are about starting to train; a season helps what you sell, not everyone |
| when | **weeks 9–11**, month 3 | planned with weeks 1–6 settled; the week-8 rank sets the January budget |
| rivals | **some plan, by character** | real competitors plan for January; a market where only the player notices would teach that a known surge is free money, on top of F15's already generous market |
| the size | **Google Trends, exported by the owner** | primary data, relative rather than absolute, which is what a multiplier needs; Trends refuses automated fetches (HTTP 429) |
| how it is built | **a season profile per search, like the hour profile** | one new field following an existing pattern, rather than a general events framework nobody has asked for |

Rejected on the way: a general market-events list in the state (building for
events nobody asked for), and deriving "training" from each search's purpose
affinity (it would expose affinity, which 16.1 withholds from every viewer, so
the planner could not show it and rivals could not plan).

## 3. The model

**The calendar.** The twelve weeks get dates, without a year: week 1 starts
**6 November**, week 9 starts **1 January**, week 12 ends 28 January. The
game's months are its four-week blocks, so month 3 is January, and the month-3
budget set by the week-8 rank is exactly the January budget. No year, because
the resolution surge falls on 1 January every year, while the festive season
and the winter sales move and are not modelled.

**Content.** Every search in `content/querySet.js` gets a hand-assigned
`seasonProfile`, `resolution` or `steady`. The rule: **a search someone makes
because they are starting to train**, judged from its words and never copied
from the hidden affinity numbers.

| group today | searches | volume | profile, mostly |
|---|---|---|---|
| commercial, training-leaning | 60 | 43.5% | `resolution` |
| commercial, lifestyle-leaning | 60 | 40.5% | `steady` |
| informational ("what to wear to the gym", "how to choose sports bra size") | 12 | 4.0% | 5 `resolution`, the rest `steady` |
| irrelevant ("free workout plan", "gym near me", "how to lose belly fat") | 10 | 6.0% | `resolution` |
| brand | 9 | 6.0% | `steady` |

The irrelevant row is deliberate: in January a broad keyword wanders into more
junk as well as more buyers, so negatives earn more.

**Constants.** `SEASON_PROFILES` in `engine/constants.js`, twelve values per
profile. `steady` is 1.0 throughout. `resolution` is 1.0 for weeks 1–8 **by
definition**, because the baseline is the November–December average, so every
calibrated constant stays valid for those weeks; weeks 9–12 carry the measured
lifts. Tagged `ESTIMATED`, with a DECISIONS entry and the Trends files beside
it.

**Engine.** A new `seasonFactor(query, round)` in `engine/querySet.js` returns
that week's value from the query's profile, and `runRound` multiplies each
query's hourly volume by it, at the one place volume enters an auction.
`searches()` keeps meaning an ordinary week, so its 30-odd tests and the
conservation check stand unchanged. *(Refined while planning: the design first
had `searches()` take the round; the effect is the same.)* `WEEKLY_VOLUME` stays
the baseline week. The engine stays pure: the lift depends on the round number
and nothing else.

**What does not change:** conversion, order value, returns, break-even, budgets
and every budget rule. The total money in the market stays constant (D5), so
January is more searches chasing the same money.

**Visible, unlike the hour profile.** `seasonProfile` is not added to
`FORBIDDEN_IN_PUBLIC_VIEW`, because real Keyword Planner shows advertisers each
keyword's monthly volumes. `hourProfile` stays withheld. "Training search" does
roughly track the hidden purpose lean, but the words already say that much, and
the affinity numbers stay withheld.

## 4. What the player sees

All new wording goes in `ui/words/season.js` under the content model's rules;
every disclosure carries a "why?".

1. **Dates wherever a week is named**: "Week 9 of 12 · 1–7 Jan". Round 0 says
   the twelve weeks run from early November to the end of January.
2. **The keyword planner marks "rises in January"** beside every training
   search, from round 0, as Keyword Planner does. The surge becomes part of the
   position choice.
3. **A January card, from week 5 to the end.**
   - *Weeks 5–8, the forecast*, read from the player's own account: training
     searches usually run about +X% in weeks 9–11 (five Januaries of Google
     Trends); N of the searches your ads showed on last week are training
     searches, which brought you M impressions. *(Refined while planning: the
     report records impressions per search, not searches, so the card reads
     what the player's own report can show.)* Then the lever that makes weeks
     5–8 matter: **your January budget is
     set by where you rank at week 8.** It names the other levers without
     prescribing: bids on those keywords, month 3's weekly split, and for broad
     accounts the junk that rises too.
   - *Weeks 9–11, the surge*: your training searches ran +Y% this week, read
     from the player's own report, beside the week's lost-to-budget share.
   - *Week 12*: January is easing.
   - *One disclosure*: only January's training searches move here; the festive
     season and winter sales that fall in these weeks are not modelled.
4. **A field guide chapter, *Seasons and surges*.** The real half from Google's
   pages, fetched while writing: Keyword Planner's monthly volumes; Smart
   Bidding handling seasonal traffic by itself; seasonality adjustments meant
   for short events of 1–7 days on Target CPA and Target ROAS. The game half:
   one surge, volume only, weeks 9–11, rivals planning by character, and **the
   forecast here comes true exactly**, where a real one is history, not a
   promise. It cites the new DECISIONS entry and spec section.
5. **A seventh debrief lesson, *Planning for a known surge*.** Ran into it: what
   the player changed on training keywords in weeks 5–8, and what January did to
   their clicks and lost-to-budget share. Did not: you changed nothing ahead of
   January; next game, try it.

No new motion. The card arrives like any other; a card's first-appearance
motion belongs to C4.

## 5. The rivals

**What they see** is what the player sees: each search's `seasonProfile`, the
calendar and the forecast curve, through the public view. `agents/policies.js`
still imports nothing from `engine/`, so hard rule 5 holds.

**What they can move.** The January budget is fixed by the week-8 rank, so a
rival plans with month 3's weekly split and its bids.

| character | in January | what it shows |
|---|---|---|
| `disciplined` | at week 9, reshapes month 3's split in proportion to the searches its own keywords are forecast to see each week; bids unchanged, because more searches do not change what a click is worth | the competent plan: move money to where the searches are, don't pay more per click |
| `spender` | piles month 3 into week 9 and bids up on training searches | spends January in its first week and goes quiet before it ends |
| `cautious` | nothing | caution costs more when there is more to win |
| `automator` | nothing new; its strategy adapts from its own data, as real Smart Bidding does | probably an emergent mistake: blaming the strategy when January ends and switching at week 12. **Measured before the game ever says so** |
| `grossOptimiser`, `brandDefender` | nothing | their flaws are elsewhere; brand searches are steady |

`spender`'s front-loading and bid lift are a character's opinions, so under
DECISIONS C7 they live in `agents/policies.js`, not `constants.js`. No rival
repositions or buys capital for January.

## 6. Sourcing

**The owner exports Google Trends CSVs**: India, the past five years, weekly.
The term list is written into the implementation plan and covers three groups,
training searches, lifestyle searches and the January junk, **one term per
file**, so each series uses Trends' whole 0–100 scale; the method only ever
compares a term with itself, so files never need comparing. *(Refined while
planning: the design first had a shared anchor term.)* They go in
`sources/trends/`, which is never published: `tests/build.test.js` holds
`dist/` to exactly the files the game loads.

**The method is fixed before the numbers are read.** For each January, each
week's index is divided by that year's 6 November–31 December mean; the median
over five years, averaged within each group, gives `resolution` for weeks 9–12.

**Two results come back to the owner** rather than being adjusted quietly:
- lifestyle searches rising in January too, which would contradict "lifestyle
  stays";
- a training lift too small to change any decision, as measured in section 7's
  balance check.

Sources consulted while designing, none of them yet carrying a number:
- Google Ads Help, *About seasonality adjustments*:
  https://support.google.com/google-ads/answer/10369906
- Google Ads Help, *How our bidding algorithms learn*:
  https://support.google.com/google-ads/answer/10970825
- second-hand January figures (12.5% of new gym subscriptions in January;
  activewear "peak demand" in the resolution period), too indirect to size a
  multiplier: https://www.grabon.in/indulge/tech/fitness-industry-statistics/ ,
  https://wod.guru/blog/gym-membership-statistics/
- festive-season returns (39.2% at the November 2025 peak), recorded because
  they are why the festive season was not chosen:
  https://www.firstresort.in/blogs/research/fashion-ecommerce-returns-rto-india-2026

## 7. Testing, and the order of work

**Tests first:**

| what | test |
|---|---|
| content | every search has a known `seasonProfile`; named examples pin the hand review ("gym near me" rises, "co ord set sale" does not) |
| engine | **weeks 1–8 are exactly today's market**: each round sums to `WEEKLY_VOLUME` and steady searches never move; weeks 9–11 add exactly the training share times the lift |
| views | the public view carries `seasonProfile` and the curve; `hourProfile` and the affinities stay withheld |
| rivals | every rival's decisions in weeks 1–8 are identical to today; `disciplined`'s January split sums to the month; `spender` front-loads |
| calibration | I1–I5 still pass, **and the figures are printed and read**, not only the green tick |
| balance | D12's harness, 72 markets: a player who plans for January beats one who ignores it by more than noise, but not by a rout; the effect on each cell against today (F13); whether `automator` really switches at week 12 |
| screens | content-model word tests, guide citations, the seventh lesson, and a game played to week 12 in the browser |

**Saves.** Adding a field to every search is a schema change, so
`SCHEMA_VERSION` moves, and `ui/save.js` already discards a save from another
version rather than replaying it into a different January. The postponed
playtests run from the `playtest-1` tag and are unaffected.

**Order:**
1. the Trends files and the DECISIONS entry (the owner exports; nothing else
   can start its numbers without them)
2. the spec: a seasonality section, the section-20 line removed, a changelog
   entry. *(The seventh lesson is not a spec change after all: each debrief
   lesson cites a DECISIONS entry, and this one cites the new one.)*
3. the content field and its validation
4. the engine and `SEASON_PROFILES`
5. the public view
6. the rivals
7. calibration and the balance measurement
8. the screens, the guide chapter and the debrief lesson
9. the docs, including the published file count, which grows by one for
   `ui/words/season.js`

## 8. What would prove it wrong

- **The balance check shows planning does not matter**: a player who ignores
  January finishes as well as one who plans. Then the surge is scenery, and the
  back half still asks nothing.
- **It becomes a rout for performance cells**: January decides the standings
  by where you sat at round 0 rather than by what you did in weeks 5–11.
- **Strangers do not notice it** in recorded play: the card is read and nothing
  changes in weeks 5–11. That is the stage D gate, "weeks 7–12 carry decisions",
  and only the playtests can close it.
