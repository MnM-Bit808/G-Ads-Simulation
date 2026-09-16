# Engine Specification — Google Ads Search Simulator

**Version 0.3.** Supersedes v0.2. Changelog in section 20.

Vertical for v0.3: **athleisure and gym clothing, direct-to-consumer, India.**

---

## 1. Design rules

**R1 — The engine is pure.** `runRound` is a function of its inputs. Same inputs,
same seed, same outputs, always. No global state, no clocks, no network calls, no
unseeded randomness.

**R2 — Claude lives outside the engine.** Model calls produce decisions, scores and
tags. The engine consumes them as plain data. The full test suite passes with no
network.

**R3 — Information asymmetry mirrors reality.** Every advertiser may read every
other advertiser's **identity and ad creative** (Google's Ads Transparency Center
makes those public) and the **query set as market research** — text, volume and
intent, mirroring Keyword Planner. No advertiser may read another's bid, budget,
costs, quality signals, conversions, margins or position economics. Nor may any
advertiser read *any* query's affinity or conversion multipliers, including its
own. Enforced by `insights.getPublicView()` and structurally by R3a.

**R3a — Controllers receive views, never state.** A policy or model controller is
passed three things and no others: its own `AdvertiserRoundReport`, the output of
`getSelfView()`, and the output of `getPublicView()`. **`GameState` is never
passed to a controller, and neither is any other advertiser's record.** This is
architectural, not a test — you cannot prove a controller ignored a field it was
handed **(W12)**.

**Amended from "exactly two things".** As originally written this rule made a
policy unable to read its own bid: `breakdown.byKeyword` is keyed by keyword id
and carries impressions, clicks, cost and conversions, but no text, no match type
and no `bidPaise`, so "raise my bid 10%" was not expressible. R3's actual rule is
that no advertiser may read *another's* private data; its own is its own.
`getSelfView` (16.2) is that third thing, and it withholds `convRateBase` and
`returnRate` — the truth — for the reason in `DECISIONS.md` D2.

**R4 — Every invented number lives in `constants.js`** tagged `DOCUMENTED`,
`ESTIMATED`, `INVENTED` or `CALIBRATE`, and has an entry in `DECISIONS.md`.
`CALIBRATE` means the value is provisional and governed by a calibration
invariant in section 18.

**R5 — Simulation granularity and decision cadence are separate.** The engine
simulates hourly. Advertisers decide weekly.

**R6 — One advertiser type.** You and every competitor are the same data structure
and run through the same functions. The only difference is where decisions come
from. There is no privileged player path anywhere in the engine.

**R7 — Money is integer paise.** All monetary values are integers. Formatting to
rupees happens only at the display layer. No floating-point currency anywhere.
`Infinity` is never a monetary value.

---

## 2. Time model and game shape

```
1 round  = 1 week = 7 days x 24 hours = 168 simulated hours
1 month  = 4 rounds
1 game   = 12 rounds = 3 months
```

Decisions are submitted once per round. Budgets are monthly, split into weeks by
the advertiser, then paced daily and hourly.

**Nine advertisers**: the player plus eight rivals. Of the rivals, two are
`controller: 'llm'` and six are `controller: 'policy'`. The player is index 0 by
convention only **(R6)**.

---

## 3. The vertical

Athleisure was chosen because it exercises four mechanics a subscription business
does not:

1. **Brand bidding.** Bidding on a competitor's trademark as a keyword is
   permitted. Using their trademark in your ad text generally is not. The sim
   allows the first and penalises the second.
2. **Returns.** Sizing drives high return rates. A conversion is not revenue until
   it survives the return window. Gross and net ROAS diverge, and optimising to
   gross is a real and expensive mistake.
3. **Wide intent spread.** "gym leggings for women" (commercial), "how to wash
   activewear" (informational), "nike pro leggings" (brand), "free workout plan"
   (irrelevant) all sit inside one keyword theme.
4. **Genuine market positioning.** The same click is worth wildly different amounts
   to a discounter and to a premium brand. See section 4.

---

## 4. Positioning

### 4.1 The grid

Every advertiser occupies one cell of a 3 x 2 grid, chosen at round 0.

```
                  PERFORMANCE            LIFESTYLE
                  (bought to train in)   (bought to look good in)
  VALUE           .                      .
  MID-MARKET      .                      .
  PREMIUM         .                      .
```

The two axes do different jobs, and must not be allowed to do each other's:

- **Price sets the economics** — order value, margin, conversion rate, return rate.
  It answers *what can I afford to pay for a click*.
- **Purpose sets the territory** — which searches you are relevant for. It answers
  *which clicks am I even trying to buy*.

### 4.2 Price tier economics

`INVENTED`, subject to the balance invariant in section 18.

| | Value | Mid-market | Premium |
|---|---|---|---|
| `aovMeanPaise` | 120000 | 240000 | 480000 |
| `marginPct` | 0.40 | 0.52 | 0.62 |
| `convRateBase` | 0.042 | 0.028 | 0.016 |
| `returnRate` | 0.427 | 0.417 | 0.396 |
| `aovSpread` | 0.35 | 0.35 | 0.35 |
| `returnWindowRounds` | 2 | 2 | 2 |

The internal logic: cheap things convert well because the decision is near-impulse,
but the margin has been competed away. Expensive things are considered purchases —
slow to convert, high margin.

**`returnRate` is every return, and it is not invented** (amended by `DECISIONS.md`
F14). It was 0.30 / 0.24 / 0.20, authored as returns after delivery and then
treated as the total when refusals at the door were modelled — so the engine's own
DOCUMENTED constants contradicted it by 30% to 100%. It is now the total those
constants imply: RTO at 20.9% on cash and 5.8% prepaid, on each tier's cash mix,
then 30% of whatever was delivered. A test holds the two together. Returns barely
vary by price as a result, and that is the sourced position: the one breakdown by
order value found is flat, and nothing found supports "price shoppers size-gamble".
What price decides is what a return **costs**.

### 4.3 Purpose modifiers

Applied on top of the price tier. `INVENTED`.

| | Performance | Lifestyle |
|---|---|---|
| conversion x | 0.94 | 1.06 |
| return rate x | 0.91 | 1.09 |

Performance goods are bought on stated specs — they either do the job or they
don't, and mostly they do. Lifestyle goods are bought on appearance, and *how it
looks on me* is only knowable after it arrives.

**Conversion was 0.90/1.10 and is deliberately weaker now.** The query set
already carries a purpose effect on economics, and a better one: lifestyle
territory has genuinely bigger baskets (it is full of co-ord sets) and genuinely
fewer returns (oversized and modal fit anybody; compression and high-impact do
not). Both are per-query and argued. Applying a blunt modifier on top of them
put the *realised* purpose gap at 12.2 / 17.0 / 20.5%, through I4's bound in two
rows out of three — invisible, because I4 read only this table. See `DECISIONS.md`
F11.

**The return modifier was 0.85/1.20 and narrowed with F14.** It exists to offset
the conversion modifier, and it was sized at a 20-30% return level. At the
sourced 40-43% the same ratio over-penalised lifestyle — I3's purpose tilt fell
to 0.865 against a 0.9 bound — and no calibration constant could move it. In
percentage points the lifestyle penalty is nearly what it was; the two values
average exactly 1.0, so 4.2's `returnRate` is the sourced total unadjusted.

### 4.4 What each position can pay

Derived, not authored. Shown here because it is the number the whole simulation
has to clear.

```
break-even CPC (net) = aovMeanPaise
                     x marginPct
                     x (1 - returnRate)
                     x convRateBase
```

**There are two of these figures and they are not the same number.** Conflating
them is what made this section wrong for four commits.

**Neutral-query break-even** — `breakEvenCpcPaise`, computed from 4.2 and 4.3
alone, for a query whose every multiplier is 1 at an hour of average intent:

| | Performance | Lifestyle |
|---|---|---|
| **Value** | 1159 paise | 1142 paise |
| **Mid** | 2038 paise | 2020 paise |
| **Premium** | 2863 paise | 2869 paise |

**Nobody buys that query.** What an advertiser buys is its own territory, and by
construction (7.1, `homeCell`) territory is exactly the set where *both* of its
affinities peak, so the affinity product runs near 2.0. `HOURLY_INTENT_CURVE`
compounds it: normalised to a mean of 1 across 24 uniform hours, its
*traffic-weighted* mean is 1.146, because clicks arrive where demand is and
demand sits where intent is high.

**Realised break-even** — `realisedBreakEvenCpcPaise`, volume-weighted over a
position's own territory. **This is the operative ceiling**, and it is what I2,
the round 0 briefing (17.2) and the test fixtures quote:

| | Performance | Lifestyle | gap |
|---|---|---|---|
| **Value** | 2822 paise | 2998 paise | +6.2% |
| **Mid** | 4714 paise | 5092 paise | +8.0% |
| **Premium** | 6212 paise | 6956 paise | +12.0% |

(All three tables moved with F14: the return level rose to the sourced total and
the return modifier narrowed. They were 1412-3836 neutral and 3456-9261 realised.)

Note the intended property: **the purpose axis moves break-even by under 13%
within a price row, while the price axis moves it 2.2 to 2.5x top to bottom.** If a
change to the constants *or to the query set* breaks that property, the axes have
started doing each other's job. **I4 must be checked against the realised table**
— checking only the neutral one is how a 20.5% purpose gap went unseen.

**Headroom warning, corrected.** The old warning said Premium sat at 11.9% and
that any increase to `PURPOSE_MODIFIERS` would push it through 15%. It was aimed
at the wrong constant: Premium was already at 20.5% realised, and the excess came
from the query set. Strengthening the query affinities — the remedy this section
used to recommend — would have made it worse, not better. The lever that works
is whichever of the two is the *weaker argument*, and today that is the modifier.

**What a position can PAY is not what it EARNS in play, and in play purpose
dominates** (`DECISIONS.md` F13, accepted 2026-09-12). Everything above is about
break-even, and there price does move things 2.2-2.5x while purpose moves them
under 13%. In a played market the ordering flips: over 30 markets lifestyle's
net profit runs about 1.7x performance's, and lifestyle takes top rival in 27 of
30.

Not because a lifestyle sale is worth more — because a lifestyle click is
cheaper. Broad match (8.2) compares tags, and a keyword needs half ITS tags on
the query. Lifestyle keywords are short and vague — "everyday leggings",
"designer leggings", two tags — so the one word "leggings" is enough to reach
every activewear leggings search, and most leggings searching in this market is
activewear (33 performance rows carry the tag against 12 lifestyle). Performance
keywords are specific and barely reach back. So the whole market's broad match
lands in activewear auctions, which run more entrants and a higher second price.

**Accepted, not engineered away**, because the mechanism is true to life: a
casual brand bidding broad on leggings does show on gym leggings searches. What
the design refuses is letting it stay hidden. The round 0 briefing (17.2) says
activewear searches are the most contested; `querySetContent.test.js` pins the
asymmetry from both sides, so it can neither grow unrecorded nor vanish and leave
that sentence false. The rejected alternatives — symmetric broad match, retagging
the vague rows, compensating with territory volume — are argued in F13.

Gross break-even (ignoring returns) is materially higher in every cell. Per cell,
not per row — no advertiser occupies a row:

| | Performance | Lifestyle |
|---|---|---|
| **Value** | +63.6% | **+87.1%** |
| **Mid** | +61.2% | +83.3% |
| **Premium** | +56.3% | +75.9% |

That gap is the section 14 trap. It is widest at Value-Lifestyle, which is the
worst place on the grid to optimise to gross, and narrowest at
Premium-Performance, where it still costs more than half. Before F14 it ran
+20.5% to +56.3%; the level rose and the spread by price nearly vanished.

### 4.5 Position is fixed, with one exception

Chosen at round 0 and fixed, because twelve one-week rounds is too short a span for
a brand to credibly change what it sells and who it sells to.

**One repositioning window**, at the start of month 2 (round 5):

- **One grid step only.** Value-Performance may become Mid-Performance (price step)
  or Value-Lifestyle (purpose step). It may not become Premium-Lifestyle. One
  adjacent step is a repricing exercise a real brand could run in a month; a leap
  across the grid is a different company.
- **Costs `REPOSITION_COST_PAISE`** (10000000, i.e. ₹1,00,000) drawn from the
  month-2 budget.
- **Triggers a learning period** of `LEARNING_ROUNDS`, because `observedConvRate`
  is now calibrated to a business that no longer exists.
- **Quality history does not transfer.** New keywords carry no history, so
  `reportedScore` returns null until they clear `QUALITY_MIN_IMPRESSIONS` again.
  This is a consequence, not a rule to implement.
- **Capex effects persist.** It is still your website. Investment made for the old
  position may be partly stranded in the new one, which is realistic.

Available to every advertiser, player and policy alike **(R6)**.

---

## 5. State

All state is serialisable JSON. `schemaVersion` is mandatory; loaders must reject
unknown versions loudly rather than misread them **(L16)**.

### 5.1 GameState

```js
{
  schemaVersion: '0.3',
  round: 3,
  rootSeed: 20260902,
  advertisers: [ /* Advertiser, see 5.2. Index 0 is the player by convention only */ ],
  querySet: { /* see 7.1 */ },
  budgetSchedule: {                       // see section 13
    monthlyAllocationPaise: [16800000, 16800000, null],  // month 3 set at round 9
    capexAllocationRounds: [1, 5],
    rankSnapshotRound: 8
  },
  history: [ /* RoundReport per round, revisable — see 11.4 */ ],
  decisionLog: [ /* see 12.3 */ ],
  marketContext: [ /* per round: totalMarketSpendPaise, activeAdvertisers, medianCpcPaise */ ]
}
```

### 5.2 Advertiser

One type for everyone **(L1, R6)**.

```js
{
  id: 'vella',
  name: 'Vella & Co.',
  domain: 'vellaandco.in',              // public
  controller: 'player' | 'policy' | 'llm',
  policyId: 'disciplined',              // null when controller is 'player'
  active: true,

  position: {
    price: 'value' | 'mid' | 'premium',
    purpose: 'performance' | 'lifestyle',
    setAtRound: 0,
    repositionedAtRound: null           // at most once, at round 5
  },

  // Derived from position via POSITION_ECONOMICS. Never authored per advertiser.
  business: {
    convRateBase: 0.028,
    aovMeanPaise: 240000,
    aovSpread: 0.35,
    marginPct: 0.52,
    returnRate: 0.24,
    returnWindowRounds: 2
  },

  capex: {
    // Cumulative paise committed per target across all allocations.
    committed: { sizeGuide: 0, photography: 55000000, landingPage: 0 },
    // Each tranche lands CAPEX_DELAY_ROUNDS after the round it was committed.
    pending: [{ target: 'photography', paise: 45000000, liveAtRound: 8 }],
    remainingUnallocatedPaise: 0        // rolls into the current month's ad budget
  },

  campaign: {
    monthlyBudgetPaise: 16800000,       // this month's allocation
    monthSpentPaise: 4210000,           // hard ceiling: may not exceed the above
    weeklySplitPaise: [5000000, 4000000, 4000000, 3800000],  // player's choice, sums to monthly
    strategy: 'manual'|'maxClicks'|'targetCpa'|'targetRoas'|'maxConv',
    strategyParams: { targetCpaPaise: 40000, targetRoas: 5.0 },
    daypartAdjustments: [0,0,0,0,0,0],  // by DAYPART_BLOCKS
    negatives: [{ text: 'free', matchType: 'broad' }]   // campaign level only
  },

  adGroups: [{
    id: 'ag_leggings',
    keywords: [{
      id: 'kw_1',
      text: 'gym leggings women',
      matchType: 'phrase',
      bidPaise: 4500,
      active: true,
      tags: ['leggings','gym','commercial'],   // from agents/keywordTagger.js
      taggedContentHash: 'sha1:...'            // null until tagged; see 8.4
    }],
    ad: {
      headlines: ['...','...','...'],
      descriptions: ['...','...'],
      landingPageDescription: '...'
    },
    gradedQuality: {                    // null until graded — see 9.5
      expectedCtr: 6, adRelevance: 7, landingPage: 4,
      gradedAtRound: 2,
      contentHash: 'sha1:...'           // regrade only when this changes
    }
  }],

  bidding: {
    learningRoundsRemaining: 0,         // set by the CALLER, not the engine (L7)
    observedConvRate: null,
    observedConversions: 0
  },

  pendingConversions: [
    {
      clickedInRound: 2, dueRound: 4, count: 31.2,
      valuePaise: 7488000,              // snapshotted at click time
      returnRate: 0.24                  // snapshotted at click time — see 4.5
    }
  ],

  pendingReturns: [
    { landedInRound: 4, resolvesInRound: 6, count: 7.5, valuePaise: 1800000 }
  ],

  qualityHistory: {
    'kw_1': [{
      round: 2,
      impressions: 4200,                // literal-query impressions only — see 9.3
      clicks: 168,
      ownComponents:   { expectedCtr: 0.062, adRelevance: 0.81, landingPage: 0.55 },
      fieldComponents: { expectedCtr: 0.071, adRelevance: 0.77, landingPage: 0.68 }
    }]
  }
}
```

`fieldComponents` is the impression-weighted average of every *other* advertiser
who appeared on the same literal queries that round. It is the baseline that makes
"above average" meaningful **(L4)**, and it is written by the engine, never read by
any controller.

---

## 6. Module layout

```
engine/
  constants.js    every number, provenance-tagged
  money.js        integer paise helpers, formatting (R7)
  rng.js          seeded mulberry32, injected, per-advertiser substreams
  querySet.js     volume composition + validation (7.4)
  matching.js     query x keyword x match type -> eligibility (8)
  quality.js      qualitySignal and reportedScore (9)
  auction.js      resolve one auction, return the FULL ladder (10)
  strategies.js   five strategies with prediction error (12)
  pacing.js       three-level budget pacing (13.4)
  attribution.js  conversion lag queue and returns (14)
  positions.js    grid, economics, capex effects, repositioning (4)
  round.js        orchestration (11)
  report.js       RoundReport construction and revision (15)
  insights.js     Auction Insights + getPublicView (16)
  serialise.js    load/save, schemaVersion enforcement (L16)
content/
  brands.js       the nine brand identities, frozen (7.5)
  adCopy.js       rival ad copy authored per cell (17.1)
  querySet.json   the generated set, hand-corrected and frozen (7.1)
agents/
  policies.js     rule-based policies, used by tests
  llmPolicy.js    Claude-backed, same interface
  grader.js       Claude-backed ad copy grader
  keywordTagger.js Claude-backed keyword tagger (8.4)
  queryGen.js     Claude-backed query set generator
tests/
ui/
game.js         the caller loop — see below
DECISIONS.md
```

**`game.js` is new in this revision and sits outside `engine/`.** The layout had
no home for the caller, and four obligations the engine deliberately refuses had
nowhere to live: diffing decisions to write learning periods (12.3), appending to
`decisionLog` (12.4), committing capital and leaving the remainder to roll into ad
budget (13.3), and applying a repositioning (4.5). `runRound` cannot do any of
them — 12.3 says outright that a pure function cannot detect that a setting
changed — and `agents/` holds controllers rather than orchestration.

It is outside `engine/` because it holds the controllers, and a controller may be
Claude-backed while the engine may not be (R2). A structural test asserts this
file cannot reach a model or the network.

---

## 7. Queries

### 7.1 QuerySet

Generated once by Claude, validated, hand-inspected, cached to disk, reused for the
whole game and frozen as a test fixture.

```js
{
  schemaVersion: '0.3',
  generatedFrom: 'Athleisure D2C brand, India...',
  weeklyVolume: 430000,                 // absolute searches per week (WEEKLY_VOLUME)
  tagVocabulary: ['leggings','gym','seamless','price-sensitive', /* ~40-60 */ ],
  queries: [{
    id: 'q_017',
    text: 'high waisted gym leggings',
    isHeadTerm: true,                   // see 7.4
    volumeShareBp: 310,                 // integer basis points; sums to exactly 10000
    intent: 'commercial'|'informational'|'brand'|'irrelevant',
    brandOwner: null,                   // advertiser id, when intent is 'brand'
    tags: ['leggings','gym','high-waisted','commercial'],
    priceAffinity:   { value: 0.9, mid: 1.4, premium: 0.7 },
    purposeAffinity: { performance: 1.1, lifestyle: 0.9 },
    convMultiplier: 1.4,
    valueMultiplier: 1.1,               // position-independent: basket size
    returnRateMultiplier: 1.0,
    hourProfile: 'evening'|'business'|'flat'
  }]
}
```

**Roughly 150 queries**, about 25 per grid cell, plus ~12 informational, ~10
irrelevant, and one brand query per advertiser. Small enough to read end to end by
hand, which you must.

### 7.2 Volume composition

```
searches(query, day, hour) = weeklyVolume
                           x volumeShareBp / 10000
                           x DAY_OF_WEEK_CURVE[day]
                           x HOUR_PROFILES[query.hourProfile][hour]
```

Both curves normalised to sum to 1 over their range. One mechanism, not two
**(L6)**. Integer basis points remove the floating-point sum problem entirely.

### 7.3 Territory volume

Volume is distributed so that the **total margin potential of each price tier is
roughly equal**. Premium generates about 2.7x Value's margin per thousand searches,
so Value carries about 2.7x the volume.

| Tier | Share | Weekly searches |
|---|---|---|
| Value | 52% | 182000 |
| Mid | 28% | 98000 |
| Premium | 20% | 70000 |

This is what makes the balance invariant achievable, and it is what makes the round
0 choice a genuine trade-off rather than a right answer: a high ceiling on thin
volume against a low ceiling on thick volume.

### 7.4 Validation — `engine/querySet.js`

Throws loudly on any failure. Same philosophy as L16.

- `volumeShareBp` sums to **exactly** 10000
- every one of the 6 cells has >= 15 queries and >= 8% of total volume
- tier volume split within 5 percentage points of 52 / 28 / 20
- **>= 5% of total volume is `intent: 'irrelevant'`** — otherwise broad match has
  nothing to waste money on and the lesson dies
- **>= 3 `isHeadTerm` queries per cell.** These are the short strings a player would
  plausibly type as a keyword. Without them, literal-match `reportedScore` (9.3)
  never populates and the entire diagnostic is dead weight **(H4)**
- at least one `brandOwner` query per advertiser, for all nine — see 7.5
- every query carries tags; every tag is in `tagVocabulary`
- no duplicate query text

---

### 7.5 The brand roster is fixed in advance

Nine brand identities — id, name, domain — are authored once in
`content/brands.js` and frozen alongside the query set. **The player chooses
one of the nine as their own at round 0; the other eight go to the rivals.**

This resolves two things that could not otherwise both hold.

**The player would have had no brand query.** §17 loads and validates the query
set at step 1, but the player named their brand at step 7. At validation time
the player did not exist, yet 7.4 requires a brand query for all nine
advertisers. Pre-deciding the roster makes all nine brand queries part of the
frozen set, and removes the uniqueness check entirely — names cannot collide
when they come from one list.

**Names must be position-neutral.** Rival placement is seeded per game (17.1),
so any name carrying a price or purpose signal would eventually land in a cell
that contradicts it. A rival called "BudgetBox" appearing in Premium would
actively mislead, because 17.1 makes position *inferable from ad copy* — and an
incoherent name poisons that inference.

So the names are abstract and signal nothing, which is also true of most real
D2C brands. **Position is signalled entirely through ad copy**, authored per
cell at placement, which is the honest place for it. A brand is not premium
because of its name.

Cost to the player: they pick a name from nine rather than typing one. At the
most overloaded moment of the game that is arguably a gain.

## 8. Matching and eligibility

### 8.1 Match types

Only **broad match needs semantics**. The other two are string operations.

| Type | Rule | Mechanism |
|---|---|---|
| **Exact** | query is the keyword or a close variant (plural, misspelling, reordering that preserves meaning) | strings — stemming, edit distance, token-set equality |
| **Phrase** | keyword's terms appear in order, text permitted either side | strings — ordered token containment |
| **Broad** | semantically related, including loose associations | **tags** — overlap >= `BROAD_MATCH_MIN_OVERLAP` |

### 8.2 Negatives are string-only, never tag-based **(H3)**

This is not a simplification, it is a correction. Real broad negatives are
*stricter* than positive broad match. Routing them through the tag layer would
over-block enormously — `-cheap` would kill everything tagged `price-sensitive`
even where the word never appears.

| Negative type | Rule |
|---|---|
| Negative broad | all tokens present, any order |
| Negative phrase | tokens present, in order |
| Negative exact | whole normalised string equal |

**None of the three accept close variants**, unlike their positive counterparts
**(L11)**. Miss this and negatives over-block.

The consequence to preserve: you can be dragged into a query semantically and can
only block it by naming its literal words, after the fact, from the per-query
breakdown in your report. That report **is** the search terms report, and it is the
only tool for writing negatives. The UI must treat it as a primary surface.

### 8.3 `queryKeywordFit`

The same tag overlap ratio that decides broad eligibility produces the 0.50–1.15
quality factor in 9.1. One mechanism serves both, which makes "broad match degrades
quality as well as wasting spend" mechanical rather than asserted.

### 8.4 Untagged keywords

A player-written keyword needs tagging, which is a model call
(`agents/keywordTagger.js`, cached on `taggedContentHash`). Until tagged:

- **exact and phrase work normally** (string-based, need no tags)
- **broad match is inert** — the keyword matches nothing on broad

Degrades safely, invents no data, and the constraint explains itself. This is the
mirror of `DEFAULT_UNGRADED_QUALITY` in 9.5.

### 8.5 The impression share denominator **(L2)**

An advertiser is **eligible** for a query when at least one active keyword matches
it and no negative blocks it. Eligibility is independent of whether they won,
cleared the ad rank floor, or had budget.

```
impressionShare = impressions / eligibleAuctions
```

Consequence to preserve deliberately: switching a keyword to broad match increases
the denominator faster than the numerator, so **impression share falls while
impressions rise**.

Losses split into `lostToRank` (eligible, entered, did not place or fell below the
floor) and `lostToBudget` (eligible, throttled by pacing — see 13.4, this is
fractional).

### 8.6 Multiple matching ad groups **(L10)**

When more than one ad group matches, compute ad rank for each, and the highest
enters. Ties break toward the more specific match type: exact, then phrase, then
broad. One ad per advertiser per auction.

### 8.7 Brand queries

An advertiser may hold keywords matching a query whose `brandOwner` is another
advertiser. The grader must penalise `adRelevance` if a rival's trademark appears
in the ad text, reflecting that bidding on a competitor's brand is allowed while
naming them in copy generally is not. **This is a penalty, not a block** — ad
disapproval is out of scope (section 19).

---

## 9. Quality

### 9.1 `qualitySignal` — the auction input

Continuous, roughly a predicted click probability. Computed per auction, per query,
per advertiser. Deterministic. Never displayed as a number.

```js
qualitySignal(gradedQuality, query, keyword, hour, rng, mode) -> {
  signal: 0.058,
  components: { expectedCtr: 0.062, adRelevance: 0.81, landingPage: 0.55 }
}
```

```
signal = baseCtr(gradedQuality.expectedCtr)          // 1-10 -> 0.02..0.14
       x queryKeywordFit(query, keyword, matchType)  // 0.50..1.15  (8.3)
       x relevanceFactor(gradedQuality.adRelevance, query.intent)   // 0.60..1.20
       x landingFactor(gradedQuality.landingPage)    // 0.85..1.05
       x contextFactor(hour)                         // 0.95..1.05
       x noise                                       // sampled mode only, seeded
```

**`components` are the factor values above, not the 1-10 graded inputs.** They are
what 9.3 compares against `fieldComponents`.

`QUALITY_WEIGHTS` from v0.2 is **deleted**. The formula is multiplicative; nothing
read the weights. See `DECISIONS.md` A3.

`EXTENSIONS_IMPACT` from v0.2 is **deleted**. There was no `extensions` field in
the schema and no term in the formula. See `DECISIONS.md` B2.

### 9.2 RNG substreams

Each advertiser draws noise from its own seeded substream, derived from
`(roundSeed, advertiserId)`. Not from a single shared generator.

Without this, an advertiser becoming ineligible shifts every subsequent draw and
changes everyone else's numbers. Determinism would survive, but *change one thing
and compare* — the core play loop — would not **(A10)**.

### 9.3 `reportedScore` — the diagnostic

```js
reportedScore(advertiser, keywordId, currentRound) -> null | {
  score: 7,
  expectedCtr: 'above'|'average'|'below',
  adRelevance: 'above'|'average'|'below',
  landingPage: 'above'|'average'|'below'
}
```

- Trailing window of `QUALITY_WINDOW_ROUNDS` (13).
- Returns `null` below `QUALITY_MIN_IMPRESSIONS` (500) across the window.
- Each component: compare the impression-weighted trailing mean of
  `ownComponents[c]` against `fieldComponents[c]`. Ratio above
  `RATING_UPPER_THRESHOLD` is `above`, below `RATING_LOWER_THRESHOLD` is `below`,
  otherwise `average` **(L4)**.
- The 1–10 score comes from the three ratings via `RATING_TO_SCORE_TABLE`.
- **Computed only from impressions where the query text literally equals the
  keyword text** (after normalisation), so changing match type alone does not move
  it **(A4)**. This is why 7.4 requires head terms.
- **No engine function may read `reportedScore`.** Output only, enforced
  structurally.

Each advertiser's own `reportedScore` is passed to its own controller, player or
policy alike **(L15)**. It is never in `getPublicView`.

### 9.4 Component range warning

`landingFactor` spans 0.85–1.05, while `RATING_UPPER_THRESHOLD` is 1.10.

**Do not reason about this from `max / min` (1.235).** `rate()` compares an
advertiser to an impression-weighted **field average**, never to the worst
possible advertiser, so the end-to-end range is not a quantity any auction
computes. Reasoning from it is what produced both of this section's errors, and
`tests/constants.test.js` asserted it and passed while the section was wrong.

**This section twice said the wrong thing, and the second time was worse than the
first.** It originally said an "above average" rating was "reachable but narrow".
A later pass replaced that with "it is not reachable at all", measured on one
seed. **The original wording was right** and is restored, now with evidence.

Over 720 games — 12 seeds × 6 cells × 10 grades, `mode: 'expected'` (which is what
`ui/app.js` actually runs), 8 rounds, 411 contested keywords at each grade:

| grade | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| `below` % | 88.6 | 60.8 | 21.2 | 5.6 | 0 | 0 | 0 | 0 | 0 | 0 |
| `above` % | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3.4 | 20.2 |

`above` is reached in **33 of 72 (seed, cell) pairs**, at grades 9 and 10 only.

**What is true is narrower and more useful than "unreachable".** The compression
is a flat MIDDLE: grades 5 to 8 give 411 of 411 `average`, because the factor
range is ±10% around its midpoint while the `average` band is also ±10% — the
band is as wide as the whole range. At the median realised field (0.9760) the
reachable ratio runs 0.871 to 1.076, so `above` needs a below-median field and
`below` needs a grade of 4 or less.

**The retracted claim, and how it was reached**, because the shape will recur:
the 1.0925 figure is `1.05 / landingFactor(6)` — one rival graded 6 — measured on
seed `20260902`. That is this project's canonical seed and it is the worst row in
the grid: one of its six cells reaches `above` at all. In five of six, "no grade
reaches `above`" is locally true, and it was generalised to the whole game. A
number measured on the canonical seed is a sample of one.

The remedy this section recommends — widen the factor ranges rather than move the
thresholds, because the threshold is what makes the three components comparable
— still stands as the right *direction*, and it has a cost that was not known
when it was written. **Widening it in either direction breaks invariant-adjacent
behaviour in 17.1.** At 0.80–1.15 an advertiser alone in its cell falls from
~100% of its eligible auctions to 98.9%, because the lower bound pushes weak ads
under `AD_RANK_FLOOR`; widening upward only, to 0.85–1.15, is worse at 97.1%,
because it lifts every RIVAL's factor too and manufactures rank competition in a
cell 17.1 says is uncontested.

So it is a balance change requiring a calibration pass, not a one-line fix, and
it is **open** — but it is now a *smaller* prize than when it was written.
Widening is no longer needed to make the rating reachable, because it already is.
It would only flatten the middle, and that has to be weighed against a measured
cost to 17.1.

The compression is recorded in `DECISIONS.md` A6, and what the interface does
about it in the meantime — showing the player the grade their copy earned
alongside the field-relative rating — is `DECISIONS.md` I1.

### 9.5 Ungraded ads **(L9)**

If `gradedQuality` is null, the engine uses `DEFAULT_UNGRADED_QUALITY`
(`{ expectedCtr: 3, adRelevance: 3, landingPage: 3 }`) and adds `'ungraded_ad'` to
`report.warnings`. Deliberately poor: an ad nobody has evaluated should not perform
like a good one.

---

## 10. The auction

### 10.1 Resolution

```js
resolveAuction(entrants) -> { ladder }
```

`entrants` is every eligible, funded advertiser with a computed `adRank`
(`bidPaise x qualitySignal`).

- Sort descending by ad rank.
- Slots go, in rank order, to entrants clearing `AD_RANK_FLOOR`, up to `MAX_SLOTS`
  (4). Positions 1..`TOP_SLOTS` (3) render above organic results.
- **The full ladder is returned, including non-winners and below-floor entrants**,
  each flagged with `shown` and `position` **(L3)**. Auction Insights (16) is only
  computable because of this, and the UI needs the "bid but never appeared" rows.

### 10.2 Pricing

Second price, in integer paise:

```
beatRank = ad rank of the entrant immediately below you in the ladder,
           whether or not that entrant was shown;
           AD_RANK_FLOOR if there is no entrant below you at all

cpcPaise = min(bidPaise, ceil(beatRank / yourQualitySignal) + MIN_INCREMENT_PAISE)
```

**`beatRank` uses the first entrant below you, not the first *shown* entrant below
you (W8).** With 4 slots and 9 advertisers, the entrant in position 5 is usually
well above the floor. Pricing position 4 against the floor would undercharge it
exactly when the field is deep, which is when it should be expensive.

`MIN_INCREMENT_PAISE` = 1. It is an invented number and lives in `constants.js`
like every other **(A2)**.

### 10.3 `MAX_SLOTS = 4`, not 7

With nine advertisers and seven slots, every entrant clearing the floor always
shows, `lostToRank` collapses to "below the floor" only, and half the impression
share lesson dies. Four slots means rank competition is real — and it becomes
*emergent*: disciplined play keeps auctions thin, and the moment anyone broadens
their match types, auctions crowd and people start missing out. Nobody has to be
told that. `DECISIONS.md` B4 is reopened accordingly.

---

## 11. The round

```js
runRound(gameState, options) -> { reports, insights, nextGameState }
```

```js
options = {
  seed,
  mode: 'expected' | 'sampled',
  decisions: { [advertiserId]: { campaign, adGroups } },  // pre-computed (R2)
  counterfactualFor: ['vella'],   // advertiser ids; see 11.2
  _isCounterfactual: false        // internal guard (L13)
}
```

The engine never invokes a policy or a model. Decisions arrive pre-computed.

### 11.1 Order of operations

```
for day in 1..7:
    compute today's budget target for each advertiser (13.4)
    for hour in 0..23:
        for each query:
            volume = searches(query, day, hour)                     (7.2)
            for k in 1..AUCTIONS_PER_QUERY_HOUR:                    (11.5)
                for each advertiser:
                    determine eligibility (8.5); skip if not eligible
                    accrue eligible auction volume
                    compute pacing participation fraction (13.4)
                    accrue (1 - fraction) as lostToBudget
                    select the ad group by ad rank (8.6)
                    compute qualitySignal (9.1) and adRank
                resolve the auction, returning the FULL ladder      (10.1)
                record positions, prices, pairwise matrix           (16)
                accrue weighted impressions, clicks, cost
                queue conversions into pendingConversions           (14.1)
land due conversions; queue returns; resolve due returns            (14)
write ownComponents and fieldComponents into qualityHistory         (9.3)
apply capex tranches whose liveAtRound has arrived                  (13.3)
decrement learningRoundsRemaining                                   (12.2)
build reports and insights                                          (15, 16)
```

Note the ad group is selected **by** ad rank, so ad rank is computed first for
every candidate ad group. The v0.2 ordering had this backwards **(A7)**.

Day-of-week weighting is applied inside `searches()` only. There is no separate
weighting step; that was the L6 double-count.

### 11.2 The counterfactual **(L13, W4)**

For each advertiser id in `counterfactualFor`, run a second pass with **only that
advertiser's** budget raised to its remaining monthly pot, and `_isCounterfactual:
true`. The inner call must never recurse.

Raising *every* budget, as v0.2 specified, measures a different and more
competitive market in which the missed traffic would have been more expensive
anyway. It answers the wrong question.

```js
report.missedToBudget = {
  impressions, clicks, conversions,
  netRevenuePaise,        // net of returns
  profitIfFundedPaise     // margin on missed net revenue minus the extra cost
}
```

**`missedToBudget` is a pedagogical output. No controller reads it.** Policies use
`lostToBudget`, which everyone gets, exactly as a real advertiser would. This keeps
the engine symmetric under R6 and makes `DECISIONS.md` G1 true rather than
aspirational.

Default `counterfactualFor` is a single advertiser, which keeps cost linear in
advertiser count rather than quadratic.

### 11.3 Attribution lag **(L5)**

Conversions are queued into `pendingConversions` with `dueRound` drawn from
`ATTRIBUTION_LAG_DISTRIBUTION`. Each entry snapshots its `valuePaise` and
`returnRate` at click time, so a repositioning (4.5) cannot retroactively change
an order that was already sold.

Each entry also carries the search it came from, the keyword that caught the
click and where it was bought, so a late sale reaches the breakdown rows of its
own week (15.2) whatever the keywords have become since (`DECISIONS.md` I36).

The margin those orders earn is kept one level up, on the report: each records
`money.marginPct` when it is built (15.2), and every revision (11.4) uses it.
Every order in a report was clicked in that report's round, at that round's
price, so the report's margin is each order's own. It was once read from the
advertiser at revision time instead, and a week-5 price move re-priced all of
month 1 (`DECISIONS.md` F18).

### 11.4 Reporting rule **(L5)**

Reports are keyed by **click round** and are **revisable**. When conversions land
in round 5 from clicks in round 3, round 3's stored report is updated in place and
`revisedAtRound` is set. A report may be revised twice — once when conversions
land, once when returns resolve.

Every derived figure that depends on conversions — ROAS, CPA, profit — is revised
alongside them, and each keeps an `AsFirstReported` twin (15.2). Numbers changing
after you looked at them is one of the most disorienting things about real Google
Ads, and reproducing it is worth the complexity.

### 11.5 Expected and sampled mode **(A11, H1, H6)**

The engine does **not** simulate individual searches. One auction resolution
carries a whole slice of volume, weighted.

```
AUCTIONS_PER_QUERY_HOUR = 1   in 'expected' mode
                        = 6   in 'sampled' mode
```

Each of the k sub-auctions carries `volume / k`.

- **`expected`** — no noise. Smooth feedback while adjusting settings.
- **`sampled`** — noise applied to the aggregate outcome, with **variance scaling
  with the underlying count**, so a 50-search query stays violently noisy and a
  5,000-search one does not. Normal approximation to the binomial, seeded per
  advertiser (9.2), clamped at zero.

Six sub-auctions in sampled mode restore genuine position churn — you win position
1 on some of an hour's searches and position 3 on others — which a single
resolution per query-hour cannot produce.

Cost is 150 x 168 x k auctions per pass regardless of how large `weeklyVolume`
grows: 25,200 in expected mode, 151,200 in sampled.

---

## 12. Strategies, prediction error, learning

### 12.1 The conversion rate chain **(F3, W5)**

One chain, one clamp, written down once. Every module uses this and no module
applies its own bound.

```
effectiveConvRate = business.convRateBase
                  x query.convMultiplier
                  x query.priceAffinity[position.price]
                  x query.purposeAffinity[position.purpose]
                  x PURPOSE_MODIFIERS[position.purpose].conv
                  x brandFactor
                  x HOURLY_INTENT_CURVE[hour]
                  -> clamp to [0.001, 0.35]
```

```
brandFactor = BRAND_OWNER_MULTIPLIER  (2.5)   when query.brandOwner === advertiser.id
            = BRAND_POACHER_MULTIPLIER (0.25) when query.brandOwner is another id
            = INFORMATIONAL_CONV_MULTIPLIER (0.10) when intent is 'informational'
            = 0                                when intent is 'irrelevant'
            = 1.0                              otherwise
```

Irrelevant queries convert at **exactly zero**, for everyone. That traffic is pure
waste, which is true, and it makes the lesson clean and testable.

`HOURLY_INTENT_CURVE` was deleted in v0.2 along with the global demand curve, which
left dayparting with nothing to earn **(W5)**. It is restored here as a separate
24-value curve, and section 18 requires its peak to be offset from every
`HOUR_PROFILES` peak. If demand peak and intent peak coincide, the lesson in
`DECISIONS.md` H4 does not exist.

### 12.2 Prediction error

```js
estimatedConvRate(bidding, query, hour, rng) -> number
```

Drawn around `bidding.observedConvRate`, never around the truth of 12.1. Error
variance shrinks as `bidding.observedConversions` grows; below
`SMART_BIDDING_MIN_CONVERSIONS` (30) it is large. During a learning period it is
multiplied by `LEARNING_ERROR_MULTIPLIER`.

Before any conversions have been observed, `observedConvRate` is null and the
strategy falls back to `COLD_START_CONV_RATE` with maximum error.

`observedConvRate` and `observedConversions` are written by the **engine**, from
**landed** conversions only. A conversion that has not yet arrived cannot inform a
bid — which is precisely why bid strategies look broken when checked too early.

Manual CPC and Maximise Clicks never predict conversions and are unaffected. This
is why they behave more predictably on thin accounts, and the player should
discover it rather than be told.

**Consequence worth naming:** Premium generates roughly a sixth of Value's
conversions on the same budget, so its estimates are about three times noisier, its
smart bidding stays in high-error territory longer, and every learning period costs
it more. Premium's disadvantage is statistical, not economic.

### 12.3 Learning periods are set externally **(L7)**

A pure function cannot detect that a setting changed. The caller diffs submitted
decisions against the previous state and writes `learningRoundsRemaining =
LEARNING_ROUNDS`. The engine only decrements it.

**Triggering changes**: switching `strategy`, changing any value in
`strategyParams`, or repositioning (4.5). **Non-triggering**: keyword bid changes,
adding or removing keywords or negatives, editing ad copy, budget changes.

### 12.4 Decision logging and replay **(L12)**

Every entry in `options.decisions` is appended to `gameState.decisionLog` with its
round number and source (`player`, `policy:disciplined`, `llm`). Replaying a saved
game reads decisions from the log and never re-invokes a model.

Determinism is conditional on the decision set: same seed **and** same decision log
gives identical results. A fresh game with LLM rivals is not reproducible until its
log exists.

---

## 13. Budget

### 13.1 Allocation schedule

Three allocations, four rounds each.

| Month | Rounds | Allocation |
|---|---|---|
| 1 | 1–4 | `MONTHLY_BUDGET_PAISE` (16800000) — identical for all nine |
| 2 | 5–8 | `MONTHLY_BUDGET_PAISE` — identical for all nine |
| 3 | 9–12 | Redistributed by rank, same total pool |

Months 1 and 2 are equal by design. A learner will make a mess of month 1; if the
damage carried forward, one early mistake would make the remaining eight rounds
unwinnable and teach nothing. Month 2 is a clean run at applying what they learned.

**Month 3 redistribution.** The pool stays constant at 9 x
`MONTHLY_BUDGET_PAISE`. Only the split changes.

| Rank | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| x | 1.30 | 1.22 | 1.15 | 1.07 | 1.00 | 0.93 | 0.85 | 0.78 | 0.70 |

Multipliers sum to exactly 9.00, so total market money is unchanged. This matters:
if the pool grew, CPCs would inflate and the player could no longer tell whether
their results changed because of their decisions or because the market got richer.

**Ranking metric: cumulative gross profit across rounds 1–8, as reported at
round 8.** Announced to the player at round 1.

Both halves of that are deliberate traps the spec already contains. *Gross* means
returns are not netted (section 14), so chasing the ranking metric means buying
traffic that converts well and comes straight back. *As reported at round 8* means
attribution lag has not resolved, so a round-8 click shows 100% of its cost against
55% of its revenue — spending near the deadline makes you look worse.

**Cumulative, not round 8 alone.** Ranking on round 8's report alone would make
going dark for the last fortnight strictly optimal and free. Cumulative means the
go-dark play costs you the real profit those rounds would have produced. A residual
incentive survives — which is exactly what happens at real quarter ends, and is
recorded as intentional in `DECISIONS.md` D4.

### 13.2 The month is a hard cap

- `monthSpentPaise` may never exceed `monthlyBudgetPaise`.
- **No carry-over.** Unspent money is lost at the month boundary. Otherwise
  hoarding wins, which is degenerate play. Use-it-or-lose-it pressure at month end
  is also exactly what real marketing teams face.
- If an advertiser burns the pot early, it goes dark for the rest of the month.
  That is a cliff — but a player-caused, visible, forecastable one, which is a
  different thing entirely from the invisible engine cliff 13.4 forbids. **The UI
  must show a burn-down of remaining pot against rounds remaining.**

### 13.3 Capital expenditure

Two allocations of `CAPEX_ALLOCATION_PAISE` (10000000, ₹1,00,000), at round 1 and
round 5. **Not at round 9** — with the delay below, a month 3 allocation would go
live at round 12 and do nothing.

**Three targets**, each hitting a different part of the machine:

| Target | Moves | Worth most to |
|---|---|---|
| `sizeGuide` | lowers `business.returnRate` | Value, and anything Lifestyle |
| `photography` | raises `business.convRateBase` | Premium, and anything Performance |
| `landingPage` | raises `gradedQuality.landingPage`, lowering CPC via 9.1 | Mid-market |

**Splitting across targets is permitted.** Investment is **cumulative** across the
two allocations, so a three-way split at round 1 can be topped up at round 5.

**The tier curve is an S, not a diminishing curve.** `INVENTED`.

| Committed to one target | Effect multiplier |
|---|---|
| 0 | 1.000 |
| 25000000 (₹25,000) | 1.04 |
| 55000000 (₹55,000) | 1.16 |
| 70000000 (₹70,000) | 1.22 |
| 100000000 (₹1,00,000) | 1.25 |

Interpolated linearly between points. The S shape is load-bearing: with a
diminishing curve the first tranche on every target would be the most efficient
purchase, splitting three ways would be strictly optimal, and the amount choice
would collapse. The S makes splitting *available and sometimes right* while
spreading thin genuinely underperforms committing. It is also more honest —
₹25,000 of engineering produces a half-built fit tool that helps nobody.

**Delay: `CAPEX_DELAY_ROUNDS` = 3.** Commissioned at round 1, live at round 4.
Commissioned at round 5, live at round 8. Site work takes time to build.

The delay is what makes "don't invest" viable. Investing costs three rounds of
traffic *and* three rounds of conversion data — and the data cost falls unevenly.
Value has conversions to spare and the worst returns problem, so it should invest.
Premium is already data-starved and needs every round of history before the round-8
snapshot, so it often should not.

**`landingPage` capex adds a fixed number of points to the graded score, applied
after grading, capped at 10.** The grader's job is unchanged. Two mechanisms
writing one number is how L6 happened; this keeps them separable.

**Unspent capex rolls into the current month's ad budget**, raising that month's
hard cap accordingly. Months 1 and 2 can therefore reach ₹2,68,000 while month 3 is
capped at the rank allocation. A non-investor's spend falls off at exactly the
moment the game is decided; that is a consequence of the choice, and it is
deliberate.

Because rollover changes how much money is in the market, `marketContext` (5.1)
carries total market spend, active advertiser count and median CPC per round, and
the UI must surface it. Otherwise CPCs swing across month boundaries for reasons
the player cannot attribute, which is worse than the mechanic is worth.

### 13.4 Pacing

Three levels, with clear precedence.

```
MONTH   monthlyBudgetPaise                        hard ceiling, section 13.2
  WEEK  weeklySplitPaise[w]                       the advertiser's own choice
    DAY target = remaining week budget / days remaining in week
```

The daily target is recomputed each morning. If Monday overspends, Tuesday's target
falls automatically; if Monday runs cool, Tuesday's rises. The weekly figure holds
by construction rather than by a hard stop, and spend tapers instead of falling off
a ledge. All three of the v0.2 bullets survive without contradiction **(W3)**.

**Forecasting from a generic curve (W2).** The pacer plans against
`PACING_REFERENCE_CURVE`, a single smooth day-shape, while actual demand is the sum
of per-query `hourProfile`s that do not match it. The error emerges *structurally*
from the mismatch — no dice, no injected noise, fully deterministic under R1, and
no new invented constant beyond the reference curve itself.

This is what makes `DAILY_BUDGET_OVERSPEND_CAP` (2.0) reachable at all. With a
pacer reading the true demand table there is no forecast error, no overspend, and
the documented 2x behaviour would be decoration. It also produces a lesson the sim
did not previously have: **an account whose demand pattern is unusual gets paced
worse than an average one.**

**Throttling is fractional participation, never a skipped auction (H1).** One
auction resolution carries a whole slice of an hour's volume for a query — enough
to consume most of a day's budget in one step. So a throttled advertiser enters a
*fraction* of that volume:

```
participation = clamp(remaining day allowance / projected hour spend, 0, 1)
impressions   += weighted volume x participation
lostToBudget  += weighted volume x (1 - participation)
```

The obvious implementation — "if throttled, skip this auction" — reproduces exactly
the cliff 13.4 exists to remove.

**A throttled advertiser is in only its share of the searches (F17).**
Participation is the share of a slice's searches an advertiser enters, and each
advertiser's pacer decides its own, so who is present in a search is
independent from one advertiser to the next. In the searches it stays out of it
is not in the ladder: it takes no slot and sets nobody's price. One resolution
weighs every combination of who is present by how likely it is:

```
shown share    = P(present and shown)
impressions   += weighted volume x shown share
clicks        += weighted volume x quality x sum over slots of P(in slot) x slot CTR
cost          += clicks x average price when shown, rounded to the paisa once
lostToRank    += weighted volume x (participation - shown share)
```

With k throttled entrants that is 2^k ladders, and one when nobody is throttled.

---

## 14. Returns

Athleisure-specific and material.

- Each landed conversion is retained with probability
  `1 - clamp(returnRate x query.returnRateMultiplier x PURPOSE_MODIFIERS.ret, 0, 0.9)`.
  The clamp is required: nothing else bounds the product below 1.
- `returnRate` is the value **snapshotted at click time** (5.2), not the
  advertiser's current value.
- Returns resolve `returnWindowRounds` after landing, via `pendingReturns`.
- In `expected` mode the retention probability is applied as a multiplier; in
  `sampled` mode it is drawn with variance scaled to the count (11.5). Conversions
  are fractional throughout; there is no integer conversion count.
- Reports carry **gross** and **net** revenue, ROAS, and profit.
- Bid strategies optimise to **gross** unless configured otherwise, because that is
  what a default Google Ads conversion setup does.

A click in round 3 can land in round 6 and resolve its return in round 8. Clicks in
rounds 10–12 will not have final numbers before the game ends. The UI must label
unsettled figures as provisional rather than silently showing them as final.

---

## 15. RoundReport

The primary output. Four things consume it — the UI renders it, controllers read
it, `history` stores it, and 11.4 rewrites it — and every module either fills part
of it or reads it. It is defined here once **(A8)**.

### 15.1 Shape

```js
{
  round: 3,
  schemaVersion: '0.3',
  revisedAtRound: 5 | null,
  marketContext: { totalMarketSpendPaise, activeAdvertisers, medianCpcPaise },
  byAdvertiser: {
    vella: { /* AdvertiserRoundReport, see 15.2 */ }
  }
}
```

An advertiser's report contains **no rows for any rival**. `getPublicView` (16.1)
is the only route to another advertiser's data. The caller hands each controller
only its own slice **(R3a)**.

### 15.2 AdvertiserRoundReport

```js
{
  traffic:   { eligibleAuctions, impressions, clicks, costPaise },
  share:     { impressionShare, lostToRank, lostToBudget,
               topImpressionShare, absTopImpressionShare },
  positions: { counts: [.., .., .., ..] },       // by slot, 1..MAX_SLOTS

  conversions: {
    asFirstReported, final, stillPending, returned
  },
  money: {
    grossRevenuePaise, netRevenuePaise,
    grossRoas, netRoas,
    grossProfitPaise, netProfitPaise,
    cpaPaise,
    marginPct,       // its orders' margin, recorded at first report, never looked up again — see 11.3
    // twins captured at first report, never revised — see 11.4
    grossRoasAsFirstReported, netRoasAsFirstReported,
    cpaAsFirstReported, grossProfitAsFirstReportedPaise
  },

  budget: {
    monthlyBudgetPaise, monthSpentPaise, monthRemainingPaise,
    roundsRemainingInMonth, weeklySplitPaise, dailySpendPaise: [..7]
  },

  quality: { /* keywordId -> reportedScore | null. This advertiser's own only. */ },
  missedToBudget: { /* 11.2, or null if not requested */ },
  warnings: ['ungraded_ad'],

  breakdown: {
    byKeyword: { kw_1: { impressions, clicks, costPaise, conversions, ... } },
    byQuery:   { q_017: { impressions, clicks, costPaise, conversions, ... } }
  }
}
```

`breakdown.byQuery` **is the search terms report** — the only way to discover what
broad match dragged you into, and, since negatives are string-only (8.2), the only
tool for writing negatives. It is a primary UI surface, not a buried table.

### 15.3 Retention

Per-query breakdown across 150 queries x 12 rounds x 9 advertisers is roughly
16,000 rows before revisions. The **caller** decides what to retain; the engine
always produces the full report. Suggested default: full detail for the player,
aggregate only for rivals.

---

## 16. Auction Insights

Computable only because the auction returns the full ladder **(L3)**. The round
accumulates, for each ordered pair of advertisers:

```
bothShown[a][b]      // both received an impression in the same auction
aShown[a]            // a received an impression
bAbove[a][b]         // b ranked above a, given both shown
aShownBnot[a][b]     // a shown, b not
```

From which, matching Google's six Search metrics:

- **Impression share** — `impressions / eligibleAuctions`
- **Overlap rate** — `bothShown[a][b] / aShown[a]`
- **Position above rate** — `bAbove[a][b] / bothShown[a][b]`
- **Outranking share** — `(bothShown - bAbove + aShownBnot) / (bothShown + aShownBnot)`
- **Top of page rate** — positions 1..`TOP_SLOTS`
- **Absolute top of page rate** — position 1

`topOfPageRate` and `absTopOfPageRate` are **per-advertiser, not pairwise**. The
v0.2 layout listed them inside the pairwise block.

Competitors are identified by `name` and `domain` only.

**Documentation note for the UI:** overlap rate is not market share and is not a
measure of spend. It is the single most misread number in the report, and the
interface should say so.

### 16.1 `getPublicView` **(R3, R3a, H2)**

```js
getPublicView(gameState, viewerId) -> {
  advertisers: [{ id, name, domain, ads: [{ headlines, descriptions }] }],
  querySet:    [{ id, text, volumeShareBp, intent }],
  insights:    { /* the viewer's own row against each rival */ },
  marketContext: { totalMarketSpendPaise, activeAdvertisers, medianCpcPaise }
}
```

**The query set must be here.** With R3a enforced, a controller that cannot see the
query set is writing keywords blind. Real advertisers have Keyword Planner: query
text and search volume are researchable.

**It must expose text, volume and intent only.** `priceAffinity`,
`purposeAffinity`, `convMultiplier`, `valueMultiplier`, `returnRateMultiplier`,
`tags` and `isHeadTerm` are all withheld — from every viewer, including the
advertiser the affinity favours. That is the line between Keyword Planner (public)
and knowing how well a query converts for you (earned by running it).

Never exposed: bids, budgets, costs, quality, conversions, positions, position
economics, capex.

### 16.2 `getSelfView` **(R3a)**

```js
getSelfView(gameState, viewerId) -> {
  round,
  id, name, domain,
  position:  { price, purpose, setAtRound, repositionedAtRound },
  catalogue: { aovMeanPaise, aovSpread, marginPct },
  campaign, adGroups, bidding, capex        // this advertiser's own, deep-copied
}
```

Everything an advertiser knows about itself, and nothing about anyone else. It is
the third thing a controller receives, and it is what makes R3a implementable.

**`convRateBase` and `returnRate` are deliberately absent.** They are the truth.
A controller handed its own true conversion rate never has to learn one, which is
precisely the v0.1 oracle that `DECISIONS.md` D2 exists to have removed — it
would arrive by a different door and do the same damage. An advertiser knows its
own catalogue, because it set the prices. It discovers how often people buy and
how much comes back from its own report, like everybody else.

Deep-copied on the way out, so a controller cannot write through the view into
`GameState`.

---

## 17. Round 0

No circular dependencies, nothing deferred.

```
SETUP     1. load + validate query set                          (7.4)
          2. player picks brand identity, one of the nine       (7.5)
          3. place 8 rivals into cells, seeded and constrained  (17.1)
             and give them the eight remaining identities
          4. generate rival keywords, ads, capex, weekly splits
          5. grade + tag rival assets

BRIEFING  6. show market briefing                               (17.2)
          7. show all 8 rivals' ad copy, unordered

PLAYER    8. pick position                                      (6 cells)
          9. allocate capex                                     (13.3)
         10. build keywords + write ads
         11. split month 1 budget across four weeks

         12. grade + tag player assets  ->  round 1
```

### 17.1 Rival placement

Seeded from `rootSeed`, so a given seed always yields the same market — which the
balance invariant needs. **Constrained**, per `RIVAL_PLACEMENT_CONSTRAINTS`:

- rivals span at least two price tiers and both purposes
- no more than two rivals in any single cell

Unconstrained placement would sometimes drop all eight rivals into one tier,
leaving the player's choice a no-brainer rather than a decision.

With eight rivals over six cells, at least two cells double up and at most one
stays open. **That is a placement rule, not arithmetic** — eight rivals at two
per cell fit into four, so an unguided draw regularly leaves two cells empty and
a third of the grid uncontested. `placeRivals` occupies five or six cells
deliberately, seeding the open one when there is one.

**Taking an open cell is a legitimate strategy** and is intended: it
rewards reading the market. It is not a free ride — rival broad match spills into
every territory, and execution still decides the outcome.

Rival positions are **never stated, only inferable**, primarily from ad copy and
subsequently from Auction Insights overlap. This means rival ad copy must be
hand-authored per cell and must actually signal position. If the eight ads read
generically the player can infer nothing and the entire round 0 mechanic collapses
into guessing. This is a content dependency, and it is load-bearing.

### 17.2 The briefing

Show what a real founder could research. Withhold what you only learn by operating.

**Shown:**

- weekly search volume by tier (7.3) — Keyword Planner is public
- typical order values and margins for all three tiers — competitor prices are on
  their websites; apparel margin norms are common knowledge
- **one fully worked anchor**, mid-market, with the arithmetic visible:
  `₹2,400 x 52% x 58.3% x 2.8% = ₹20.37 on an average search` — built from the
  constants, never typed (it was a literal reading ₹26.56 at 76%, and would have
  gone on saying so after F14 moved the return level under it)
- **and the sentence that makes it usable**: *"that is what a search worth
  nothing in particular is worth to you. The searches you choose to compete for
  are worth appreciably more — roughly double — which is the entire reason
  choosing a position matters."*
- the break-even formula itself
- the month-3 ranking rule, stated in full (13.1)

**The second bullet is not optional.** The worked anchor is the neutral-query
figure from 4.4, and every advertiser's real ceiling is 2.2 to 2.6x it. A player
handed ₹20 and no warning bids ₹20, loses every auction, and concludes the
arithmetic they were taught does not work. Giving the direction and rough size
without the exact multiplier keeps the affinities withheld (C4) while leaving the
player able to reason. The precise figure is earned by running the keyword.

**Withheld, with directional hints only:**

- conversion rates for Value and Premium — *"cheaper products convert more often; a
  ₹4,800 decision is researched, compared and slept on"*
- return rate variation — *"about two in five orders come back category-wide,
  counting parcels refused at the door as well as those sent back. Price barely
  changes how often; it changes how much each one costs you."* (F14; it used to
  say a quarter, higher at the cheap end, which nothing sourced supports)
- which searches are fought over — *"Activewear searches are the most contested
  in the category. Almost everyone sells leggings, so anyone bidding broadly on
  them turns up in gym and training auctions, while searches for casual and
  lounge wear draw fewer bidders."* (F13: accepted, so it has to be told; what a
  real Keyword Planner shows as competition)
- everything in 4.2 and 4.3 as numbers
- the statistical consequence of a low conversion rate — Premium's real problem
  (12.2) must be discovered, not read off a card

The intended experience: break-even has four inputs, the player is handed two plus
a fully worked example, and must estimate the other two. Then weigh a high ceiling
on thin volume (Premium: 86,000 searches) against a low ceiling on thick volume
(Value: 223,600). By design the answer is *about the same* — so the real
differentiator is the risk they cannot see.

### 17.3 Replayable round 0

Round 0 asks for brand, position, capex target, capex amount, weekly split,
keywords and ad copy, against deliberately incomplete information, before the
player has seen a single auction.

**The player may redo round 0 once**, at any point up to the end of round 3,
without restarting the game. Otherwise the most consequential decisions in the game
are the ones the player was least equipped to make, and the sim punishes them for
not knowing things it deliberately withheld.

Rivals do not get this. It is a learning affordance outside the simulation, not a
game mechanic — and it is implemented in the caller by rewinding state, not in the
engine, so R6 is untouched.

---

## 18. Constants and calibration invariants

### 18.1 Provenance table

```js
// DOCUMENTED
HEADLINE_MAX_CHARS = 30
DESCRIPTION_MAX_CHARS = 90
DAILY_BUDGET_OVERSPEND_CAP = 2.0

// ESTIMATED — third-party analyses, no official source, they disagree
POSITION_CTR_MULTIPLIERS = [1, 0.62, 0.42, 0.30]        // now MAX_SLOTS long
ATTRIBUTION_LAG_DISTRIBUTION = [0.55, 0.28, 0.12, 0.05] // rounds 0..3, sums to 1
QUALITY_WINDOW_ROUNDS = 13                              // ~90 days, converted

// INVENTED — chosen for playability, no empirical basis
MAX_SLOTS = 4, TOP_SLOTS = 3
MIN_INCREMENT_PAISE = 1
DAY_OF_WEEK_CURVE, HOUR_PROFILES, HOURLY_INTENT_CURVE, PACING_REFERENCE_CURVE
DAYPART_BLOCKS
LEARNING_ROUNDS = 2, LEARNING_ERROR_MULTIPLIER = 2.5
SMART_BIDDING_MIN_CONVERSIONS = 30, COLD_START_CONV_RATE
RATING_UPPER_THRESHOLD = 1.10, RATING_LOWER_THRESHOLD = 0.90
RATING_TO_SCORE_TABLE
DEFAULT_UNGRADED_QUALITY = { expectedCtr: 3, adRelevance: 3, landingPage: 3 }
QUALITY_MIN_IMPRESSIONS = 500
POSITION_ECONOMICS, PURPOSE_MODIFIERS                   // 4.2, 4.3
MONTHLY_BUDGET_PAISE = 16800000
RANK_BUDGET_MULTIPLIERS                                 // 13.1
CAPEX_ALLOCATION_PAISE = 10000000, CAPEX_TIER_CURVE, CAPEX_DELAY_ROUNDS = 3
REPOSITION_COST_PAISE = 10000000
BRAND_OWNER_MULTIPLIER = 2.5, BRAND_POACHER_MULTIPLIER = 0.25
INFORMATIONAL_CONV_MULTIPLIER = 0.10
CONV_RATE_CLAMP = [0.001, 0.35]
BROAD_MATCH_MIN_OVERLAP
AUCTIONS_PER_QUERY_HOUR = { expected: 1, sampled: 6 }
RIVAL_PLACEMENT_CONSTRAINTS
TAG_VOCABULARY

// CALIBRATE — provisional, governed by 18.2
AD_RANK_FLOOR = 48          // was 60 until F14
WEEKLY_VOLUME = 430000      // was 350000 until F14
LOCATION_VOLUME_BY_PRICE, LOCATION_RETURN_MULTIPLIER, LOCATION_AOV_MULTIPLIER  // G4
```

Deleted from v0.2: `QUALITY_WEIGHTS` and `EXTENSIONS_IMPACT`, both orphans no
formula read. `ATHLEISURE_RETURN_RATE` is superseded by `POSITION_ECONOMICS`.

### 18.2 Calibration invariants

These are tests, not constants. A `CALIBRATE` value is wrong until they pass.

**I1 — Budget must bind.** An advertiser playing the baseline policy, **running
alone against passive rivals**, must be able to exhaust its monthly budget at a
CPC below its own net break-even. If budgets cannot be spent profitably,
`lostToBudget` never fires, `missedToBudget` returns zero, the monthly pot never
binds, and the entire section 13 scheme does nothing. This is what governs
`WEEKLY_VOLUME`.

**And it is pinned from both sides.** I1 alone bounds the market only from
below — too small and the budget never binds — so `WEEKLY_VOLUME` could have
been set arbitrarily large and I1 would have stayed green. **I3 is the other
jaw:** a bigger market puts more cells against their budget cap, and that cap is
flat while break-evens differ 2.5x top to bottom, so it bites unequally and
positions stop balancing.

| weekly volume | I1 spend | I1 `lostToBudget` | I3 worst deviation | |
|---|---|---|---|---|
| 330,000 | 0.857 | 0.0% | 6.0% | I1 fails |
| 400,000 | 1.000 | 3.8% | 7.5% | |
| 430,000 | 1.000 | 10.5% | 11.3% | both hold |
| 460,000 | 1.000 | 16.3% | 14.9% | I3 at its bound |
| 500,000 | 1.000 | 23.0% | 19.6% | I3 fails |

`WEEKLY_VOLUME` sits in that window rather than above a single floor. **The
window is not fixed**: F14 moved it from about 315,000-375,000 to
395,000-460,000, because lowering `AD_RANK_FLOOR` makes clicks in a thin auction
cheaper, and cheaper clicks take more searches to exhaust a budget. The two
`CALIBRATE` constants have to be read together.

**The "running alone" clause was added after `round.js` first ran.** The
original wording asked that *every* advertiser exhaust its budget
simultaneously, and the first full round showed why that is the wrong test: in
a live nine-advertiser market, spend ranged from 7% to 100% of budget, and the
advertisers at the bottom were there because they were being **outranked**, not
because the market was too small. An advertiser losing 39% of its impressions
to rank *should* spend less. Testing all nine at once measures competition,
not market size, and would push `WEEKLY_VOLUME` up to compensate for something
volume cannot fix.

**I2 — The market must be affordable.** Median CPC across the game must sit below
the Value tier's realised net break-even (2822 paise since F14) for a competently
run Value account. If it does not, the cheapest position is unplayable and the
grid collapses to two tiers. This is what governs `AD_RANK_FLOOR`.

**And the floor has to follow the ceilings.** A reserve is a fixed price. When F14
raised the return level and every ceiling fell 20-30%, leaving it at 60 made it a
quarter stricter relative to all of them, and the weakest rival ads went dark for
up to four weeks. It moved to 48 with them.

**I3 — Positions must balance.** **Six advertisers, one per cell, identical in
every respect except position — including identical keyword coverage** — must
finish a twelve-round game within ±15% of each other on cumulative net profit
over the settled window. That window is rounds 1–7, because a click settles at
+3 rounds of lag and +2 of return window. Rule-based policies only,
repositioning disabled.

**The equal-coverage clause is the whole test, and it was learned the hard way.**
The first harness gave each advertiser "the first four head terms of its cell,
one of them broad", and I3 failed at a 4.20x spread. Diagnosis showed **90% of
that was the keyword choice, not the grid**: how far a broad keyword travels
depends on how many tags that cell's head terms happen to carry, so reach ranged
from 0.42x to 4.1x of own territory. `premium|performance`'s broad keyword
carried two tags and reached half the market; `value|performance`'s carried
three and reached almost nothing.

Keyword choice is *skill*. A fairness invariant that varies with skill measures
the wrong thing. Holding coverage constant — one exact keyword per query in the
cell, nothing broad — collapsed the spread to 1.32x, and confirmed the tier
derivation was sound: territory × break-even came out within 1.13x across all
six cells.

**Capex is deliberately not part of this invariant.** Finding each position's
best capex means searching three targets × five amounts per position, which is
ninety twelve-round games. If capex asymmetry needs checking it belongs in a
separate, cheaper test asking only whether one capex choice dominates across
positions.

**I4 — The axes must stay in their lanes.** The purpose axis must move net
break-even CPC by **under 15%** within a price row; the price axis must move it by
more than 2x top to bottom (4.4).

**Checked on the REALISED figures, not only the constants.** This invariant read
`breakEvenCpcPaise` alone for four commits, which measures a neutral query that
no advertiser ever buys. On that measure the widest purpose gap was Premium at
11.9% and looked safe. On the figures an advertiser actually faces it was 20.5%,
and Mid was 17.0% — through the bound in two rows out of three, because the query
set was applying a second purpose effect on top of `PURPOSE_MODIFIERS` through
basket size and return rate. Both tables are now asserted. The realised gaps are
3.5 / 7.9 / 11.2% and the realised price axis is 2.68x. See `DECISIONS.md` F11.

**I5 — The peaks must not coincide.** `HOURLY_INTENT_CURVE`'s peak hour must differ
by at least 3 hours from every `HOUR_PROFILES` peak. If demand peak and intent peak
coincide, dayparting earns nothing and `DECISIONS.md` H4 is false.

---

## 19. Tests

### money.test.js
```js
test('all monetary values remain integers through a full round', () => {});
test('rounding loss is bounded: sum of parts equals the recorded total', () => {});
test('no monetary value is ever Infinity, including the counterfactual', () => {});
```

### auction.test.js
```js
test('second price, fully specified', () => {
  // Two advertisers only. A: bid 5000 paise, qualitySignal 0.08 -> adRank 400.
  // B: bid 3000 paise, qualitySignal 0.05 -> adRank 150.
  // A takes position 1 and pays ceil(150 / 0.08) + 1 = 1876 paise. (L14)
});
test('cpc never exceeds bid', () => { /* fuzz 1000 auctions */ });
test('beatRank uses the first entrant below, shown or not', () => {});     // W8
test('last shown prices against the floor only when nobody is below', () => {});
test('below the floor: no impression, no cost', () => {});
test('the ladder includes non-winners and below-floor entrants', () => {}); // L3
test('raising quality lowers cpc AT A FIXED POSITION', () => {});           // W1
test('raising quality can raise average cpc by lifting position', () => {});// W1
test('monotonic: raising bid never worsens position', () => {});
test('removing a competitor lowers average cpc', () => {});
```

The two W1 tests replace v0.2's single `monotonic: raising quality never raises
cpc`, which is **false** and which a correct engine would fail. Better quality
lowers the price of a given position, but it also lifts you into better positions
where the advertiser beneath you is stronger and more expensive to beat.

### matching.test.js
```js
test('exact match accepts close variants', () => {});
test('negative exact does NOT match close variants', () => {});         // L11
test('negative broad requires all tokens literally present', () => {}); // H3
test('negatives never consult the tag layer', () => {});                // H3, structural
test('phrase requires terms in order', () => {});
test('broad match reaches irrelevant-intent queries via tags', () => {});
test('an untagged keyword matches nothing on broad', () => {});         // 8.4
test('an untagged keyword still works on exact and phrase', () => {});
test('highest ad rank wins between two matching ad groups', () => {});
test('ties break toward the more specific match type', () => {});
```

### quality.test.js
```js
test('improving copy raises qualitySignal in the same round', () => {});
test('improving copy does NOT move reportedScore in the same round', () => {});
test('reportedScore is null below the impression threshold', () => {});
test('changing match type alone does not move reportedScore', () => {});
test('reportedScore counts only literal-query impressions', () => {});  // A4
test('component ratings derive from own vs field comparison', () => {});
test('no engine module imports reportedScore', () => {});               // structural
test('ungraded ads use the poor default and raise a warning', () => {});
test('each advertiser draws noise from its own substream', () => {});   // 9.2
```

### insights.test.js
```js
test('overlap rate is symmetric in both-shown counts', () => {});
test('outranking share and position above rate use their stated denominators', () => {});
test('getPublicView exposes id, name, domain, creative and query text/volume/intent', () => {});
test('getPublicView never exposes affinity or conversion multipliers', () => {});  // H2
test('getPublicView never exposes bid, budget, cost, quality, conversions or position', () => {});
test('no controller is ever passed gameState', () => {});               // R3a, structural
```

v0.2's `outranking share plus rival position-above accounts for all shared
auctions` is **deleted**. Per section 16's own formulas the two metrics use
different denominators and only sum to 1 when `aShownBnot` is zero; the test was
unsatisfiable as written.

### impressionShare.test.js
```js
test('broadening a keyword lowers impression share while raising impressions', () => {});
test('lostToRank plus lostToBudget plus impressionShare equals 1', () => {});
test('lostToBudget accrues fractionally, never as a skipped auction', () => {}); // H1
```

### strategies.test.js
```js
test('targetCpa never reads the true conversion rate', () => {});
test('observedConvRate is written from landed conversions only', () => {});
test('prediction error shrinks as observed conversions grow', () => {});
test('the engine does not set learning periods itself', () => {});      // L7
test('repositioning triggers a learning period', () => {});             // 4.5
test('editing ad copy does not trigger a learning period', () => {});   // 12.3
test('manual cpc is unaffected by learning state', () => {});
test('the conversion chain clamps at both ends', () => {});             // 12.1
test('irrelevant queries convert at exactly zero', () => {});
```

### budget.test.js
```js
test('month spend never exceeds the monthly allocation', () => {});
test('unspent budget does not carry across a month boundary', () => {});
test('a single day may exceed its target up to the overspend cap', () => {}); // W2
test('the generic pacing curve produces overspend on skewed hour profiles', () => {});
test('rank multipliers sum to exactly 9.00', () => {});
test('month 3 total pool equals months 1 and 2', () => {});
test('capex tranches go live exactly CAPEX_DELAY_ROUNDS later', () => {});
test('capex is cumulative across both allocations', () => {});
test('splitting three ways underperforms committing, at equal spend', () => {}); // S-curve
test('landingPage capex adds to the graded score and caps at 10', () => {});
```

v0.2's `round spend never exceeds 7 x dailyBudget` is **replaced** by the monthly
assertion. v0.1's `daily spend never exceeds the daily budget` remains correctly
deleted.

### positions.test.js
```js
test('economics derive from position and are never authored per advertiser', () => {});
test('the purpose axis moves break-even by under 15% within a price row', () => {}); // I4
test('the price axis moves break-even by more than 2x top to bottom', () => {});
test('repositioning is permitted only at round 5', () => {});
test('repositioning moves at most one grid step', () => {});
test('in-flight conversions keep their click-time value and return rate', () => {});
test('rival placement satisfies RIVAL_PLACEMENT_CONSTRAINTS for any seed', () => {});
```

### round.test.js
```js
test('same seed and same decision log produce identical results', () => {});
test('replay from decisionLog reproduces the game exactly', () => {});   // L12
test('the counterfactual raises only the focal advertiser budget', () => {}); // W4
test('the counterfactual pass does not recurse', () => {});             // L13
test('no controller reads missedToBudget', () => {});                   // 11.2, structural
test('conversions land in later rounds and revise earlier reports', () => {});
test('revised reports keep AsFirstReported twins for every derived figure', () => {});
test('a report may be revised twice: landing, then returns', () => {});
test('gross and net revenue diverge by the return rate', () => {});
test('competitors are eligible only for queries their keywords match', () => {}); // L1
test('loading an unknown schemaVersion throws', () => {});              // L16
test('expected mode is noise-free; sampled mode noise scales with count', () => {});
```

### calibration.test.js
```js
test('I1 budget binds: every position can profitably exhaust its month', () => {});
test('I2 market is affordable: median cpc below Value net break-even', () => {});
test('I3 positions balance within 15% at zero capex, across N seeds', () => {});
test('I3 positions balance within 15% at best capex, across N seeds', () => {});
test('I4 axes stay in their lanes', () => {});
test('I5 demand peak and intent peak do not coincide', () => {});
```

### performance.test.js
```js
test('a full round in expected mode completes under 400ms', () => {});
test('a full round in sampled mode with one counterfactual completes under 1500ms', () => {});
```

v0.2 asserted nothing about speed. The v0.1 prototype did, and was right to.

---

## 20. Out of scope for v0.3

Deliberate omissions, not oversights: devices, geography, audiences, multiple
campaigns, ad-group-level negatives, seasonality, shopping and local SERP elements,
lifetime value, multi-touch attribution, ad rotation and RSA asset combination
testing, ad disapproval and policy review, search-terms-report volume thresholding,
a depleting capital bankroll, asymmetric business economics within a position, and
a third positioning axis.

---

## 21. Changelog from v0.2

### Corrections to v0.2 defects

| ID | Resolution |
|----|------------|
| W1 | `monotonic: raising quality never raises cpc` was false; split into two correct tests (19) |
| W2 | 2x overspend cap was unreachable; pacer now forecasts from a generic curve (13.4) |
| W3 | Weekly cap contradicted "never a cliff"; replaced by month cap + rolling daily target (13.4) |
| W4 | Counterfactual raised every budget, answering the wrong question; now focal-only (11.2) |
| W5 | Hourly intent curve, deleted with the demand curve in v0.2, restored (12.1) |
| W6 | `QUALITY_WEIGHTS` and `EXTENSIONS_IMPACT` were orphans; deleted (9.1) |
| W7 | Component scales contradicted stated factor ranges; components defined as factors (9.1, 9.4) |
| W8 | Last shown priced against the floor even with an entrant below; corrected (10.2) |
| W9 | Outranking-share test was unsatisfiable as written; deleted (19) |
| W10 | §3 said "block" trademarks, §7.4 said "penalise"; penalise (8.7) |
| W11 | Feedback loops exceeded game length; addressed by 13.1 month resets and 17.3 |
| W12 | R3 was untestable; now architectural as R3a |
| W13 | `QUALITY_WINDOW_ROUNDS` mis-tagged `DOCUMENTED`; now `ESTIMATED` (18.1) |
| A1–A25 | Every ambiguity from the v0.2 audit given an explicit answer; see sections cited |
| H1 | Volume-weighted auctions broke pacing; throttling is fractional participation (13.4) |
| H2 | `getPublicView` withheld the query set, leaving controllers blind (16.1) |
| H3 | Negatives routed through tags would over-block; string-only (8.2) |
| H4 | Literal-match `reportedScore` needs head terms in the query set (7.4) |
| H5 | Two hourly curves could coincide, killing dayparting; invariant I5 (18.2) |
| H6 | One auction per query-hour removed position churn; sub-auctions in sampled mode (11.5) |

### New in v0.3

- **Positioning** (4) — 3 x 2 grid, economics derived from position, one
  repositioning window
- **Budget allocation** (13.1–13.3) — three monthly allocations, rank
  redistribution, capital expenditure with an S-curve and a delay
- **Three-level pacing** (13.4) — month, week, day
- **Tag-based broad match** (8.1–8.4) — semantics precomputed offline, negatives
  string-only
- **`RoundReport` defined** (15) — previously described four times and never
  specified
- **Round 0** (17) — a real phase with real decisions, and replayable once
- **Nine advertisers, four slots** (2, 10.3) — rank competition made emergent
- **Calibration invariants** (18.2) — `CALIBRATE` provenance tag and a test file
  that governs it
- **Performance budget** (19) — v0.2 had none
