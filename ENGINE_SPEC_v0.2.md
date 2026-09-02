# Engine Specification — Google Ads Search Simulator

**Version 0.2.** Supersedes v0.1. Changelog in section 16.

Vertical for v0.2: **athleisure and gym clothing, direct-to-consumer, India.**

---

## 1. Design rules

**R1 — The engine is pure.** `runRound` is a function of its inputs. Same inputs,
same seed, same outputs, always. No global state, no clocks, no network calls, no
unseeded randomness.

**R2 — Claude lives outside the engine.** Model calls produce decisions and scores.
The engine consumes them as plain data. The full test suite passes with no network.

**R3 — Information asymmetry mirrors reality.** Every advertiser may read every
other advertiser's **identity and ad creative**, because Google's Ads Transparency
Center makes those public. No advertiser may read another's **bid, budget, costs,
quality signals, conversions, or margins**. Enforced by `insights.getPublicView()`
and a structural test.

**R4 — Every invented number lives in `constants.js`** tagged `DOCUMENTED`,
`ESTIMATED`, or `INVENTED`.

**R5 — Simulation granularity and decision cadence are separate.** The engine
simulates hourly. Advertisers decide weekly.

**R6 — One advertiser type.** You and every competitor are the same data structure
and run through the same functions. The only difference is where decisions come
from. There is no privileged player path anywhere in the engine.

**R7 — Money is integer paise.** All monetary values are integers. Formatting to
rupees happens only at the display layer. No floating-point currency anywhere.

---

## 2. Time model

```
1 round = 1 week = 7 days x 24 hours = 168 simulated hours
```

Decisions are submitted once per round. Budgets are daily. Dayparting is hourly.
Learning periods and quality history are counted in rounds. A standard game is 12
rounds.

---

## 3. The vertical

Athleisure was chosen because it exercises three mechanics a subscription business
does not:

1. **Brand bidding.** Bidding on a competitor's trademark as a keyword is
   permitted. Using their trademark in your ad text generally is not. The sim must
   allow the first and block the second.
2. **Returns.** Sizing drives high return rates. A conversion is not revenue until
   it survives the return window. Gross and net ROAS diverge, and optimising to
   gross is a real and expensive mistake.
3. **Wide intent spread.** "gym leggings for women" (commercial), "how to wash
   activewear" (informational), "nike pro leggings" (brand), "free workout plan"
   (irrelevant) all sit inside one keyword theme.

---

## 4. State

All state is serialisable JSON. `schemaVersion` is mandatory; loaders must reject
unknown versions loudly rather than misread them **(L16)**.

### 4.1 GameState

```js
{
  schemaVersion: '0.2',
  round: 3,
  rootSeed: 20260902,
  advertisers: [ /* Advertiser, see 4.2. Index 0 is the player by convention only */ ],
  querySet: { /* see 4.3 */ },
  history: [ /* RoundReport per round, revisable — see 8.4 */ ],
  decisionLog: [ /* see L12 in section 10.3 */ ]
}
```

### 4.2 Advertiser

One type for everyone **(L1, R6)**.

```js
{
  id: 'vella',
  name: 'Vella & Co.',
  domain: 'vellaandco.in',              // public
  controller: 'player' | 'policy' | 'llm',
  policyId: 'disciplined',              // null when controller is 'player'
  active: true,

  campaign: {
    dailyBudgetPaise: 600000,           // R7
    strategy: 'manual'|'maxClicks'|'targetCpa'|'targetRoas'|'maxConv',
    strategyParams: { targetCpaPaise: 40000, targetRoas: 5.0 },
    daypartAdjustments: [0,0,0,0,0,0],
    negatives: [{ text: 'free', matchType: 'broad' }]
  },

  adGroups: [{
    id: 'ag_leggings',
    keywords: [
      { id: 'kw_1', text: 'gym leggings women', matchType: 'phrase', bidPaise: 4500 }
    ],
    ad: {
      headlines: ['...','...','...'],
      descriptions: ['...','...'],
      landingPageDescription: '...'
    },
    gradedQuality: {                    // null until graded — see L9 / section 6.4
      expectedCtr: 6, adRelevance: 7, landingPage: 4,
      gradedAtRound: 2,
      contentHash: 'sha1:...'           // regrade only when this changes
    }
  }],

  // Competitors need per-query eligibility exactly as the player does (L1).
  // Competitors are generated with real keywords; no shortcut representation.

  business: {
    convRateBase: 0.028,
    aovMeanPaise: 240000,
    aovSpread: 0.35,
    marginPct: 0.52,
    returnRate: 0.24,                   // section 12
    returnWindowRounds: 2
  },

  bidding: {
    learningRoundsRemaining: 0,         // set by the CALLER, not the engine (L7)
    observedConvRate: null,
    observedConversions: 0
  },

  // Conversions that have not yet landed (L5)
  pendingConversions: [
    { clickedInRound: 2, dueRound: 4, count: 31.2, valuePaise: 7488000 }
  ],

  // Trailing quality history, three components stored separately (L4)
  qualityHistory: {
    'kw_1': [{
      round: 2,
      impressions: 4200,
      clicks: 168,
      ownComponents:   { expectedCtr: 0.062, adRelevance: 0.81, landingPage: 0.55 },
      fieldComponents: { expectedCtr: 0.071, adRelevance: 0.77, landingPage: 0.68 }
    }]
  }
}
```

`fieldComponents` is the impression-weighted average of every *other* advertiser
who appeared for the same queries that round. It is the baseline that makes
"above average" meaningful **(L4)**, and it is written by the engine, never read
by any agent.

### 4.3 QuerySet

Generated once by Claude, cached to disk, reused for the whole game.

```js
{
  generatedFrom: 'Athleisure D2C brand, India...',
  weeklyVolume: 84000,                  // absolute searches per week (L6)
  queries: [{
    id: 'q_017',
    text: 'high waisted gym leggings',
    volumeShare: 0.031,                 // sums to 1.0 across the set
    intent: 'commercial'|'informational'|'brand'|'irrelevant',
    brandOwner: null,                   // advertiser id, when intent is 'brand'
    convMultiplier: 1.4,
    valueMultiplier: 1.1,
    returnRateMultiplier: 1.0,
    hourProfile: 'evening'|'business'|'flat'
  }]
}
```

**Volume composition (L6).** The global `HOURLY_DEMAND_CURVE` from v0.1 is
**deleted**. It double-counted against `hourProfile`. Volume for a query in a
given hour is:

```
weeklyVolume x volumeShare x DAY_OF_WEEK_CURVE[day] x HOUR_PROFILES[hourProfile][hour]
```

Both curves are normalised to sum to 1 over their range. One mechanism, not two.

`intent: 'irrelevant'` queries exist so broad match can waste money on them. That
waste is the lesson.

---

## 5. Module layout

```
engine/
  constants.js    every number, provenance-tagged
  money.js        integer paise helpers, formatting (R7)
  rng.js          seeded mulberry32, injected
  matching.js     query x keyword x match type -> eligibility
  quality.js      qualitySignal and reportedScore
  auction.js      resolve one auction, return the FULL ladder (L3)
  strategies.js   five strategies with prediction error
  pacing.js       budget pacing
  attribution.js  conversion lag queue and returns
  round.js        orchestration
  insights.js     Auction Insights + getPublicView (R3)
agents/
  policies.js     rule-based policies, used by tests
  llmPolicy.js    Claude-backed, same interface
  grader.js       Claude-backed ad copy grader
  queryGen.js     Claude-backed query set generator
tests/
ui/
DECISIONS.md
```

---

## 6. Quality

### 6.1 qualitySignal — the auction input

Continuous, roughly a predicted click probability. Computed per auction, per
query, per advertiser. Deterministic. Never displayed as a number.

```js
qualitySignal(gradedQuality, query, keyword, hour, rng, mode) -> {
  signal: 0.058,
  components: { expectedCtr: 0.062, adRelevance: 0.81, landingPage: 0.55 }
}
```

```
signal = baseCtr(gradedQuality.expectedCtr)             // 1-10 -> 0.02..0.14
       x queryKeywordFit(query, keyword, matchType)      // 0.50..1.15
       x relevanceFactor(gradedQuality.adRelevance, query.intent)
       x landingFactor(gradedQuality.landingPage)        // 0.85..1.05
       x contextFactor(hour)                             // 0.95..1.05
       x noise                                           // sampled mode only, seeded
```

`queryKeywordFit` is where match types bite. Exact match on a close query scores
high; broad match on a distant query scores low, dropping ad rank, sometimes below
the floor. **Broad match therefore degrades quality as well as wasting spend**,
which is real and invisible in a sim with undifferentiated searches.

The returned `components` are accumulated into `qualityHistory` and are what make
section 6.2 computable.

### 6.2 reportedScore — the diagnostic

```js
reportedScore(advertiser, keywordId, currentRound) -> null | {
  score: 7,
  expectedCtr: 'above'|'average'|'below',
  adRelevance: 'above'|'average'|'below',
  landingPage: 'above'|'average'|'below'
}
```

Rules:

- Trailing window of `QUALITY_WINDOW_ROUNDS` (13, approx. 90 days).
- Returns `null` below `QUALITY_MIN_IMPRESSIONS`. New keywords show no score.
- Each component: compare the impression-weighted trailing mean of
  `ownComponents[c]` against `fieldComponents[c]`. Ratio above
  `RATING_UPPER_THRESHOLD` is `above`, below `RATING_LOWER_THRESHOLD` is `below`,
  otherwise `average` **(L4)**.
- The 1–10 score comes from the three ratings via `RATING_TO_SCORE_TABLE`
  (`INVENTED`).
- Computed only from **exact-query impressions** for that keyword, so changing
  match type alone does not move it.
- **No engine function may read `reportedScore`.** Output only, enforced
  structurally.

### 6.3 Who may see it

Each advertiser's own `reportedScore` is passed to its own controller, player or
policy alike **(L15)**. It is never in `getPublicView`.

### 6.4 Ungraded ads (L9)

If `gradedQuality` is null, the engine uses `DEFAULT_UNGRADED_QUALITY`
(`{ expectedCtr: 3, adRelevance: 3, landingPage: 3 }`, tagged `INVENTED`) and sets
`report.warnings` to include `'ungraded_ad'`. The default is deliberately poor: an
ad nobody has evaluated should not perform like a good one.

---

## 7. Matching and eligibility

### 7.1 Match types

- **Exact** — the query is the keyword or a close variant (plural, misspelling,
  reordering that preserves meaning).
- **Phrase** — the keyword's terms appear in order, with text permitted either
  side.
- **Broad** — semantically related, including loose associations.

**Negatives use stricter semantics.** Negative phrase and negative exact do **not**
match close variants, unlike their positive counterparts **(L11)**. Miss this and
negatives over-block.

### 7.2 The impression share denominator (L2)

An advertiser is **eligible** for a query when at least one active keyword matches
it and no negative blocks it. Eligibility is independent of whether they won,
cleared the ad rank floor, or had budget.

```
impressionShare = impressions / eligibleAuctions
```

Consequence to preserve deliberately: switching a keyword to broad match increases
the denominator faster than the numerator, so **impression share falls while
impressions rise**. Counterintuitive, real, and a good lesson.

Losses split into `lostToRank` (eligible, entered, did not place) and
`lostToBudget` (eligible, throttled by pacing before entry).

### 7.3 Multiple matching ad groups (L10)

When more than one ad group matches, the one with the highest ad rank enters. Ties
break toward the more specific match type: exact, then phrase, then broad. One ad
per advertiser per auction.

### 7.4 Brand queries

An advertiser may hold keywords matching a query whose `brandOwner` is another
advertiser. The grader must penalise `adRelevance` if a rival's trademark appears
in the ad text, reflecting that bidding on a competitor's brand is allowed while
naming them in copy generally is not.

---

## 8. The round

```js
runRound(gameState, options) -> { reports, insights, nextGameState }
```

```js
options = {
  seed,
  mode: 'expected' | 'sampled',
  decisions: { [advertiserId]: { campaign, adGroups } },  // pre-computed (R2)
  computeCounterfactual: true,
  _isCounterfactual: false        // internal guard (L13)
}
```

The engine never invokes a policy or a model. Decisions arrive pre-computed.

### 8.1 Order of operations

```
for day in 1..7:
    reset dailySpend for every advertiser
    for hour in 0..23:
        for each query instance sampled for this hour:
            for each advertiser:
                determine eligibility (7.2); skip if not eligible
                count an eligible auction
                apply pacing (section 11); if throttled, count lostToBudget, skip
                select the ad group (7.3)
                compute qualitySignal (6.1) and adRank
            resolve the auction, returning the FULL ladder (L3)
            record positions, prices, and the pairwise matrix (section 9)
            accrue impressions, clicks, cost
            queue conversions into pendingConversions with attribution lag
    apply day-of-week volume weighting
land due conversions; apply returns (section 12)
write ownComponents and fieldComponents into qualityHistory
build reports and insights
```

### 8.2 The counterfactual guard (L13)

When `computeCounterfactual` is true and `_isCounterfactual` is false, run a second
pass with every budget set to infinity and `_isCounterfactual: true`. The inner
call must never recurse.

```js
report.missedToBudget = {
  impressions, clicks, conversions, revenuePaise,
  profitIfFundedPaise    // margin on missed revenue minus the extra cost
}
```

`profitIfFundedPaise` is the field that matters. Sometimes the missed traffic would
have lost money and the correct action is to leave the budget alone.

Label this in the UI as a figure **the simulation knows exactly and Google can only
estimate**. Google reports lost impression share as a percentage and estimates
additional clicks in Recommendations; it cannot observe the counterfactual.

### 8.3 Attribution lag (L5)

Conversions are queued into `pendingConversions` with `dueRound` drawn from
`ATTRIBUTION_LAG_DISTRIBUTION`. They land in a later round.

### 8.4 Reporting rule (L5)

Reports are keyed by **click round** and are **revisable**. When conversions land
in round 5 from clicks in round 3, round 3's stored report is updated in place and
its `revisedAtRound` is set.

The UI must show `conversionsAsFirstReported` alongside `conversionsFinal` for past
rounds. Numbers changing after you looked at them is one of the most disorienting
things about real Google Ads, and reproducing it is worth the complexity.

---

## 9. Auction Insights

Computable only because the auction returns the full ladder **(L3)**. The round
accumulates, for each ordered pair of advertisers:

```
bothShown[a][b]      // both received an impression in the same auction
aShown[a]            // a received an impression
bAbove[a][b]         // b ranked above a, given both shown
aShownBnot[a][b]     // a shown, b not
```

From which, matching Google's six Search metrics:

```js
{
  impressionShare, overlapRate, positionAboveRate,
  topOfPageRate, absTopOfPageRate, outrankingShare
}
```

- **Overlap rate** = `bothShown[a][b] / aShown[a]`
- **Position above rate** = `bAbove[a][b] / bothShown[a][b]`
- **Outranking share** = `(bothShown - bAbove + aShownBnot) / (bothShown + aShownBnot)`
- Top of page = positions 1..`TOP_SLOTS`; absolute top = position 1.

Competitors are identified by `name` and `domain` only.

**Documentation note for the UI:** overlap rate is not market share and is not a
measure of spend. It is the single most misread number in the report, and the
interface should say so.

### 9.1 getPublicView (R3)

```js
getPublicView(gameState, viewerId) -> {
  advertisers: [{ id, name, domain, ads: [{ headlines, descriptions }] }],
  insights: { /* the viewer's own row against each rival */ }
}
```

Ad creative is public, mirroring Google's Ads Transparency Center. Bids, budgets,
costs, quality, and conversions are not. A structural test must assert no other
field escapes.

---

## 10. Strategies, prediction error, learning

### 10.1 Prediction error

```js
estimatedConvRate(bidding, query, hour, rng) -> number
```

Drawn around observed history, never the truth. Error variance shrinks as
`bidding.observedConversions` grows; below `SMART_BIDDING_MIN_CONVERSIONS` (30) it
is large. During a learning period it is multiplied by
`LEARNING_ERROR_MULTIPLIER`.

Manual CPC and Maximise Clicks never predict conversions and are unaffected. This
is precisely why they behave more predictably on thin accounts, and the player
should discover it rather than be told.

### 10.2 Learning periods are set externally (L7)

A pure function cannot detect that a setting changed. The caller diffs the
submitted decisions against the previous state and writes
`learningRoundsRemaining = LEARNING_ROUNDS` before invoking the engine. The engine
only decrements it.

### 10.3 Decision logging and replay (L12)

Every entry in `options.decisions` is appended to `gameState.decisionLog` with its
round number and source (`player`, `policy:disciplined`, `llm`). Replaying a saved
game reads decisions from the log and never re-invokes a model. Without this, LLM
competitors make saved games unreproducible.

---

## 11. Budget pacing

- Spend is paced against expected remaining demand for the day.
- A single day may reach `DAILY_BUDGET_OVERSPEND_CAP` (2.0x) of the daily budget.
- Spend across the round may not exceed `7 x dailyBudget`.
- `lostToBudget` accrues through throttling spread across the day, never as a
  cliff at exhaustion.

The v0.1 test asserting daily spend never exceeds the daily budget **must fail**
after this change. Replace it with the weekly cap assertion. That failure is the
fix landing correctly; do not patch around it.

---

## 12. Returns

Athleisure-specific and material.

- Each landed conversion is retained with probability
  `1 - (business.returnRate x query.returnRateMultiplier)`.
- Returns resolve `business.returnWindowRounds` after landing.
- Reports carry **gross** and **net** revenue, ROAS, and profit.
- Bid strategies optimise to **gross** unless configured otherwise, because that is
  what a default Google Ads conversion setup does.

Optimising to gross ROAS while returns consume a quarter of it is a real and
expensive mistake, and the sim should let the player make it.

---

## 13. Constants requiring provenance

```js
// DOCUMENTED
HEADLINE_MAX_CHARS = 30
DESCRIPTION_MAX_CHARS = 90
QUALITY_WINDOW_ROUNDS = 13
DAILY_BUDGET_OVERSPEND_CAP = 2.0

// ESTIMATED — third-party analyses, no official source, they disagree
QUALITY_WEIGHTS = { expectedCtr: 0.5, adRelevance: 0.3, landingPage: 0.2 }
POSITION_CTR_MULTIPLIERS = [1, 0.62, 0.42, 0.30, 0.12, 0.08, 0.06]
ATTRIBUTION_LAG_DISTRIBUTION = [0.55, 0.28, 0.12, 0.05]  // rounds 0..3
ATHLEISURE_RETURN_RATE = 0.24

// INVENTED — chosen for playability, no empirical basis
AD_RANK_FLOOR, MAX_SLOTS = 7, TOP_SLOTS = 4
DAY_OF_WEEK_CURVE, HOUR_PROFILES
EXTENSIONS_IMPACT = 0.1
LEARNING_ROUNDS = 2, LEARNING_ERROR_MULTIPLIER = 2.5
SMART_BIDDING_MIN_CONVERSIONS = 30
RATING_UPPER_THRESHOLD = 1.10, RATING_LOWER_THRESHOLD = 0.90
RATING_TO_SCORE_TABLE
DEFAULT_UNGRADED_QUALITY = { expectedCtr: 3, adRelevance: 3, landingPage: 3 }
QUALITY_MIN_IMPRESSIONS = 500
```

---

## 14. Tests

### money.test.js
```js
test('all monetary values remain integers through a full round', () => {});
test('no accumulated drift over 168 hours of auctions', () => {});
```

### auction.test.js
```js
test('second price, fully specified', () => {
  // Two advertisers only. A: bid 5000 paise, qualitySignal 0.08 -> adRank 400.
  // B: bid 3000 paise, qualitySignal 0.05 -> adRank 150.
  // A takes position 1 and pays ceil(150 / 0.08) + 1 = 1876 paise.
  // Expected CPC asserted as an exact integer. (L14)
});
test('cpc never exceeds bid', () => { /* fuzz 1000 auctions */ });
test('last shown advertiser pays against the floor', () => {});
test('below the floor: no impression, no cost', () => {});
test('monotonic: raising quality never raises cpc', () => {});
test('monotonic: raising bid never worsens position', () => {});
test('resolver returns the full ladder including non-winners', () => {});
```

### matching.test.js
```js
test('exact match accepts close variants', () => {});
test('negative exact does NOT match close variants', () => {});   // L11
test('phrase requires terms in order', () => {});
test('broad match reaches irrelevant-intent queries', () => {});  // shows waste
test('highest ad rank wins between two matching ad groups', () => {});
test('ties break toward the more specific match type', () => {});
```

### quality.test.js
```js
test('improving copy raises qualitySignal in the same round', () => {});
test('improving copy does NOT move reportedScore in the same round', () => {});
test('reportedScore is null below the impression threshold', () => {});
test('changing match type alone does not move reportedScore', () => {});
test('component ratings derive from own vs field comparison', () => {});
test('no engine module imports reportedScore', () => {});         // structural
test('ungraded ads use the poor default and raise a warning', () => {});
```

### insights.test.js
```js
test('overlap rate is symmetric in both-shown counts', () => {});
test('outranking share plus rival position-above accounts for all shared auctions', () => {});
test('getPublicView exposes only id, name, domain and ad creative', () => {});
test('getPublicView never exposes bid, budget, cost, quality or conversions', () => {});
```

### impressionShare.test.js
```js
test('broadening a keyword lowers impression share while raising impressions', () => {});
test('lostToRank plus lostToBudget plus impressionShare equals 1', () => {});
```

### strategies.test.js
```js
test('targetCpa never reads the true conversion rate', () => {});
test('prediction error shrinks as observed conversions grow', () => {});
test('the engine does not set learning periods itself', () => {});  // L7
test('manual cpc is unaffected by learning state', () => {});
```

### round.test.js
```js
test('same seed produces identical results', () => {});
test('replay from decisionLog reproduces the game exactly', () => {});  // L12
test('round spend never exceeds 7 x dailyBudget', () => {});
test('a single day may exceed the daily budget up to the cap', () => {});
test('the counterfactual pass does not recurse', () => {});             // L13
test('conversions land in later rounds and revise earlier reports', () => {});
test('gross and net revenue diverge by the return rate', () => {});
test('competitors are eligible only for queries their keywords match', () => {}); // L1
test('loading an unknown schemaVersion throws', () => {});              // L16
```

---

## 15. Out of scope for v0.2

Deliberate omissions, not oversights: devices, geography, audiences, multiple
campaigns, seasonality, shopping and local SERP elements, lifetime value,
multi-touch attribution, ad rotation and RSA asset combination testing, ad
disapproval and policy review.

---

## 16. Changelog from v0.1

| ID | Resolution |
|----|------------|
| L1 | Competitors are full `Advertiser` objects with keywords and per-query quality (R6) |
| L2 | Impression share denominator defined in 7.2, with the broad-match consequence preserved |
| L3 | Auction resolver returns the full ladder; round accumulates a pairwise matrix |
| L4 | Three components stored separately, with `fieldComponents` as the comparison baseline |
| L5 | `pendingConversions` added; reports keyed by click round and revisable |
| L6 | `weeklyVolume` added; global demand curve deleted in favour of per-query hour profiles |
| L7 | Learning periods set by the caller; the engine only decrements |
| L8 | R7: all money is integer paise |
| L9 | `DEFAULT_UNGRADED_QUALITY`, deliberately poor, plus a warning |
| L10 | Ad group selection and tie-breaking specified in 7.3 |
| L11 | Negative match semantics differ from positive; test added |
| L12 | `decisionLog` added; replay never re-invokes a model |
| L13 | `_isCounterfactual` guard |
| L14 | Second-price test rewritten with all values fixed and the answer computed by hand |
| L15 | Each advertiser's own `reportedScore` is passed to its own controller |
| L16 | `schemaVersion` mandatory; unknown versions throw |

Also new in v0.2: vertical changed to athleisure, brand-bidding mechanics (7.4),
and returns (section 12).
