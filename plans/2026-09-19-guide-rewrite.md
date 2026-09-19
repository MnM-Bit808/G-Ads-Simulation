# Rewriting the guide's thirteen chapters

**Design doc. Nothing is built from it yet.** Written 2026-09-19 with the owner.
This is section 6 of `plans/2026-09-19-first-run-and-ground-floor.md`, designed
out in full; where they differ, this one is later and wins.

It is the thing both testers actually asked for, and it goes before the ground
floor (`plans/2026-09-19-ground-floor.md`) rather than after, because that
design's `then` hands a beginner onward into these chapters. An on-ramp onto a
road still broken is worse than no on-ramp.

`main` is frozen; nothing here touches `engine/`, and one line of `ui/dashboard.js`
is the only code outside `ui/guide/` that moves.

---

## 1. What this is

The owner's quote of a tester, on *Why this week's numbers keep moving*: the
trouble **"starts from where it departs all the way to the end."** The second
chapter they named was *Bidding by the hour*. Both complaints are about the
same half of the same shape.

## 2. What was measured

Every figure below was measured on 2026-09-19 by rendering all thirteen chapters
with their real figures.

```
game halves    words             82 – 120,  median 95
               longest sentence  22 –  41,  median 32
               first sentence     7 –  36,  median 21
real halves    words             67 – 114
               longest sentence  20 –  40,  median 28
               first sentence     6 –  39,  median 19
opens in 15 words or fewer   game 4 of 13   ·   real 6 of 13
```

### 2.1 The finding: the departure is the largest part of the hardest chapters

| chapter | its departure | of the whole |
|---|---|---|
| `hours` | **73 words** | of 109 — two thirds |
| `cashOnDelivery` | **65** | of 118 |
| `weeklySplit` | 37 | of 95 |
| `attributionLag` | 35 | of 92 |
| `broadMatch` | 20 | of 91 |
| `qualityScore` | 17 | of 118 |
| `smartBidding` | 16 | of 82 |
| `writers` | 14 | of 120 |

**The two chapters the testers named as hardest are the two where the departure
is the largest share of the chapter.** That is not a coincidence, and it makes
this a structural fix before it is a stylistic one.

### 2.2 The finding nobody expected: the other five are not silent, they are buried

Five chapters declare no departure, and nothing checks. Reading them, **every
one of the five states a departure inside its prose, unlabelled** — so the
information exists and is simply where no reader can find it and no test can
reach it:

| chapter | the departure, as it stands today |
|---|---|
| `kindMarket` | *"Three choices make it kinder than a real market: … no organic results or shopping units compete for the click; the base conversion rate is the game's own estimate; and there is no lifetime value"* — **three of them, mid-paragraph** |
| `returnsSplit` | *"Here the game shows your returns from your shop's own books, which Google Ads would show only if you uploaded them"*, and *"newer reports put cash refusals higher"* |
| `counterfactuals` | *"Both are exact inside the game and impossible outside it"*, and *"though a real market might have answered differently"* |
| `rankOrBudget` | *"but exactly, because it counts every auction you could have entered"* — Google's is an estimate |
| `ownName` | *"Nothing else knows whose name it is: the searcher is no likelier to click your ad than a rival's"* |

So the honest description of this work is not *"add departures to five
chapters"*. It is **pull the departures out of the prose, where they are doing
the damage, and give them a place of their own.** Counted by hand, the thirteen
chapters hold about **25** departures against the 8 that are labelled.

## 3. The five rules

Applying to `ui/guide/` and the ground-floor chapters only. `HANDOVER.md`,
`DECISIONS.md`, commit messages and the rest of `ui/` keep their voice.

### Rule 1 · `departs` becomes its own field, and it is a list

Not a phrase buried mid-paragraph. One departure per entry, each **25 words or
fewer**, drawn as a labelled block the reader can skip.

```js
/** @param {string[]} [spec.departs] - one per entry, 25 words or fewer each.
 *  Required: a chapter declares its departures, or declares `departsNot` with
 *  a stated reason. */
```

It does four things at once: the `game` half gets shorter **by construction**;
the departure gets a signpost instead of ambushing a reader mid-sentence;
`hours`' three become three items rather than *"It departs three times"*; and a
test can finally require the field, which closes the five buried ones.

**`departsNot` is the escape, and it takes a reason, not a boolean.** A chapter
with genuinely nothing to disclose says so in words, so the next reader can
check the claim rather than trust a `false`.

### Rule 2 · A half opens in 15 words or fewer

Both halves. A topic sentence a reader can act on before any qualification.
Today: game 4 of 13, real 6 of 13.

### Rule 3 · No sentence over 25 words, anywhere in the guide

Medians are 32 and 28, maxima 41 and 40. **This is most of the work.**

### Rule 4 · Every figure names what it counts

Fixed at source rather than per chapter. Checked all twelve figures in
`guideFigures()`; **exactly one offends**, and it is the one the tester read out:

```
lagShape   "55% this week, then 28%, then 12% and then 5%"      55% of WHAT?
```

`ARRIVAL_SHAPE` (`ui/dashboard.js:53`) becomes **"55% of orders in the week of
the click, then 28%, then 12% and then 5%"**, so the noun travels with the
number everywhere it is used. `ui/guide/figures.js` is its only consumer, so the
blast radius is one line. The other eleven figures carry their noun in the
sentence around them and are left alone.

### Rule 5 · A banned-jargon list, seeded from what actually failed

Not invented — every one of these is in the file today:

| word | uses | why |
|---|---|---|
| `shape` | 2 | a distribution, called a shape |
| `lean` | 2 | used as a noun: "the strategy's own lean by hour" |
| `stack` | 2 | used as a verb, of adjustments |
| `departs` | 9 | becomes a field; it should not survive in prose |

**It is a ratchet, not a guess.** Every time a reader trips on a word it gains
one, and it never loses one. That is the only honest way to build such a list.

## 4. The worked example

The two chapters the testers named. **Nothing below changes what the game does**
— every claim is the same claim.

### 4.1 *Why this week's numbers keep moving*

**Today** — 92 words, longest sentence 32, the departure 35 of them:

> This game keeps the same rule, a week at a time. Each week's report belongs to
> the week of its clicks and is rewritten as orders arrive: 55% this week, then
> 28%, then 12% and then 5%. Returns then need their own time to come back, so a
> week is final about 5 weeks after it happens. Where it departs: a real
> account's delay depends on what you sell and how you set it up, while here
> every advertiser shares one fixed shape, counted in weeks because each turn is
> a week.

**After** — game half 50 words, longest sentence 21, opens in 11:

> A week's report belongs to the week its clicks happened.
>
> As the orders arrive it is rewritten: 55% of orders land in the week of the
> click, then 28%, then 12%, then 5%.
>
> Returns come back later still. A week is not final until about five weeks
> after it ends.

**Not like the real thing**
> - A real account's delay depends on what you sell and how you set it up. Here every advertiser has the same one.
> - It is counted in whole weeks, because here a week is one turn.

Four faults fixed: the missing noun (rule 4), `shape` (rule 5), the 32-word
sentence (rule 3), and the departure ambushing the reader mid-sentence (rule 1).

### 4.2 *Bidding by the hour*

**Today** — 109 words, and **73 of them are the departure**:

> Here searches peak at one time of day and buying at another, which is what
> makes an hour adjustment pay: it can move money toward the hours that convert
> rather than the hours that are busy. It departs three times. The lowest
> setting takes you out of an hour altogether, where Google's lowest still
> leaves you in it. The adjustment works under every strategy: under the ones
> that predict conversions it lands on top of the strategy's own lean by hour,
> so the hour counts twice, which Google does not allow. And no bid goes past 4
> times your keyword bid, however the hour's and the place's adjustments stack.

**After** — game half 30 words, opens in 8:

> Searches peak at one hour and buying at another.
>
> That gap is what an hour adjustment is for: it moves money toward the hours
> that buy, not the hours that are busy.

**Not like the real thing**
> - The lowest setting takes you out of an hour completely. Google's lowest still leaves you in it.
> - It works under every bidding strategy. Under the ones that predict conversions the hour counts twice, which Google does not allow.
> - No bid goes past 4 times your keyword bid, however an hour and a place add up.

The three departures were always three things. Said as three, each is under 25
words and none of them is in the reader's way while they learn what the lever is
for.

## 5. How it renders

`guideView` (`ui/guide/drawer.js:27`) returns `departs` beside `game`. Both the
drawer and the Guide page draw it as its own block under the game half, with its
own heading, so it can be skipped by anyone who does not care and found by
anyone who does.

**The heading is "Not like the real thing"**, not "Where it departs" — rule 5
retires that word from prose, and the heading should say what the block is to a
reader who has never met the word "departure" in this sense.

## 6. What this refuses

- **Abolishing the real / game split.** Only `departs` moves out. The real half
  is what lets the game be honest about the difference at all.
- **A readability score.** Gameable, and it would flag "advertiser" and
  "conversion", which are the vocabulary rather than the problem.
- **Rewriting the sourced numbers.** Every real-world claim and its source stays
  exactly as fetched; rule 3 may split a sentence, never change a figure.
- **Anything in `engine/`.** One line of `ui/dashboard.js` is the only code
  outside `ui/guide/` that moves.

## 7. How we would know

| | today | after |
|---|---|---|
| chapters declaring their departures | 8 of 13 | 13 of 13, or `departsNot` with a reason |
| departures a reader can find | 8 | about 25, each its own line |
| sentences over 25 words | median chapter has one | none |
| halves opening in ≤ 15 words | 10 of 26 | 26 of 26 |
| figures with no noun | 1 | 0 |
| banned words in prose | 15 uses | 0 |

**What is not testable.** Rules 1, 2, 3 and 5 are machine-checkable; rule 4 at
its source. **Whether the prose is clear is not testable at all** — the caps stop
the failures we measured, not a 24-word sentence that happens to be obscure.
That needs a reader: the owner first, the next playtest after.

## 8. Known weaknesses

1. **Twenty-six halves rewritten at once is a lot of prose to get right**, and
   the only real test is a stranger we do not have.
2. **Shorter is not clearer.** Rules 2 and 3 buy structure, and structure is not
   understanding. The worked examples in section 4 are the evidence that it can
   be both, and they are two chapters out of thirteen.
3. **It spends some of the guide's voice.** The compression that makes this
   project's prose distinctive is part of what a beginner cannot parse. The
   owner accepted that trade on 2026-09-19.
4. **`departsNot` can be abused.** A chapter that ought to disclose something
   can write a reason and pass. The reason is a sentence the next reader can
   check, which is the best a test can do here.
5. **About 25 departures is a hand count**, not a measurement, and will move as
   they are written.

## 9. Where it came from

- Two strangers played `playtest-4` and neither finished; both named the guide's
  "in this game" halves as too hard, and named these two chapters.
- The measurements in section 2 were taken for the parent doc on 2026-09-19 and
  extended here.
- The five buried departures in section 2.2 were found reading the chapters for
  this doc.
