# The guide's ground floor

**Design doc. Nothing is built from it yet.** Written 2026-09-19 with the owner,
after the first run (section 4 of
`plans/2026-09-19-first-run-and-ground-floor.md`) was built. This is section 5 of
that doc, designed out in full; where the two differ, this one is later and
wins. `main` is frozen and nothing here touches `engine/`.

---

## 1. What this is

The field guide has thirteen chapters and every one is a nuance of something you
are assumed to know. None defines **keyword**, **bid**, **CPC**, **auction**,
**ad rank**, **impression**, **click**, **conversion**, **landing page** or the
price × purpose grid. The file says so itself: *"A chapter is optional depth."*

The first run now teaches **the world** — what a click is, what an auction does,
why a week's numbers move. This is the second layer: **the controls**, one per
decision round 0 asks a player to make, reachable from the step that asks.

The third layer, the thirteen existing chapters, keeps **the surprises**, and is
rewritten separately (section 6 of the parent doc).

## 2. What was decided, 2026-09-19

### 2.1 A ground-floor chapter is a definition, then where you use it

Put to the owner as three drafts of the same chapter. **The owner chose B.**

- **A, the definition alone.** Honest, and leaves a beginner exactly where they
  started: holding a decision they still cannot make.
- **B, the definition then where you use it.** *Chosen.* Whoever opens this is
  standing in a round 0 step with a decision in front of them, and B is the only
  one that hands them back to it.
- **C, the definition then what it costs to get wrong.** Reads best of the
  three, and was argued against for that reason: *"too many keywords and you pay
  for searches nobody buys from"* is the **surprises** layer's job and
  `broadMatch` already owns it. Consequences downstairs blur the three layers,
  and that is how a ground floor quietly grows into a second set of nuance
  chapters.

### 2.2 Three defaults, accepted

1. **A source where the term is Google's**, and `device: true` where it is this
   game's own — the escape `chapter()` already has. Two of the nine are devices.
2. **The contents page splits in two**: *Start here* above *Going deeper*. The
   split is itself teaching.
3. **A ground-floor chapter may quote a figure and never needs one.** The
   thirteen are dense partly *because* they are full of figures, so these use
   them sparingly: one of the nine quotes anything.

### 2.3 And one thing this design adds: each one names what continues it

Found while writing chapter 8. A budget in this game is a month split across its
weeks; in Google Ads it is an average daily budget with a monthly limit of 30.4
times it. That is a **departure**, and `basic()` has no `departs` field — by
design, because the two-halves shape is what lost both testers.

The departure is not lost, because a nuance chapter already owns it:
`weeklySplit`, *Splitting the month into weeks*. So every ground-floor chapter
carries **`then`**, the chapter that continues it, and the guide draws it as a
way on. That turns *Start here* and *Going deeper* into a real ladder rather
than two lists, and it enforces "one word, one home" in the structure: the
ground floor never discloses a departure, because the chapter it hands you to
already does.

## 3. The `basic()` contract

```js
/**
 * @param {object} spec
 * @param {string} spec.title
 * @param {(figures: object) => string} spec.plain - what it is, then where you
 *   use it. One paragraph. No second half, and no departure.
 * @param {Array<{label: string, url: string}>} [spec.sources] - required unless
 *   `device`, on the same rule `chapter()` follows
 * @param {boolean} [spec.device] - a game device with no real equivalent
 * @param {string[]} [spec.needs] - figures `plain` quotes, from guideFigures()
 * @param {number} spec.step - the round 0 step that asks for it, 1 to 5
 * @param {string} spec.then - the nuance chapter that continues it
 * @param {string} [spec.yourAccount] - a card, once a game exists
 */
export function basic({ title, plain, sources, device, needs, step, then, yourAccount })
```

**What it deliberately does not take:** `game`, `cites`, `departs`. A
ground-floor chapter describes one thing that is true; it has no second half to
compare against and no DECISIONS entry to rest on, and forcing either produces
padding or a false claim of difference.

**Rejected: a `ground: true` flag on `chapter()`.** `device` waives one rule;
this would waive three, and a flag that switches off half the validation
spreads. **Rejected: changing nothing** and giving these a `game` half citing a
spec section, which `CITATION` already permits. It costs no code and reproduces
the exact two-halves shape that lost both testers — a beginner asking what a
keyword is wants one answer, not a comparison.

## 4. How the guide serves two shapes

`guideView(id, figures)` (`ui/guide/drawer.js:27`) is the single reader the
drawer and the page both use, and it returns `real`, `sources`, `game`,
`yourAccount`, `next`. It gains a `kind`:

```js
{ kind: 'basic', id, title, plain, sources, step, then: {id, title}, yourAccount, next }
{ kind: 'chapter', id, title, real, sources, game, departs, yourAccount, studioAccount, next }
```

Everything that draws a chapter switches on `kind`. A `basic` chapter draws as
one column, not two; its footer is *Read on* rather than *Show me in your
account* when no game exists yet.

**`CONTENTS` becomes two lists.** `START_HERE` (the nine, in round 0's own
order) and `GOING_DEEPER` (the thirteen). `openingSentence` in `book.js` works
unchanged on `plain`.

## 5. The nine chapters

In the order a player meets them. Every real-world claim below was fetched on
2026-09-19, not written from memory, and the source is named with it.

---

**1 · What a click is worth to you** — step 1, then `kindMarket`, quotes the
break-even sum

> Before you can say what to bid, you need to know what a visitor is worth.
> Work out what one sale earns you after returns, then how often a click becomes
> a sale. Multiply them and that is what a click is worth to you. Bid above it
> and you lose money on every click you win. Step 1 does the sum for where you
> sit.

*Source:* [About Target CPA bidding](https://support.google.com/google-ads/answer/6268632)
— in real Google Ads you "set your desired average cost per conversion", and
Google works back from it to a bid.

**Why this one matters most.** Round 0 step 1 already prints *"₹20.37 a click at
break-even"* and nothing in the game says what it means. It is the most
important number a player is handed and it arrives undefined.

---

**2 · Where your brand sits** — step 2, then `kindMarket`, `device: true`

> Your brand sits at a price — value, mid or premium — and has a purpose:
> performance or lifestyle. Together they decide what one sale earns you and
> which searches are really yours. Nobody tells you where the other eight sit;
> their ads are the only evidence. You choose in step 2, and you cannot move
> until week 5.

*A game device.* The 3 × 2 grid is this game's own; real advertisers are not
sorted into six boxes.

---

**3 · Keywords: the searches you bid on** — step 3, then `broadMatch`

> A keyword is a word or phrase you choose. When someone types a search close
> enough to it, your ad can enter the auction for that search. You are not
> buying the words — you are buying the chance to appear when they are typed.
> You pick yours in step 3, and each one carries a bid of its own.

*Source:* [Keywords](https://support.google.com/google-ads/answer/6323) —
Google's own definition is "words or phrases describing your product or service
that you choose to help determine when and where your ad can appear."

---

**4 · How loosely a keyword matches** — step 3, then `broadMatch`

> Every keyword carries a match type. Exact reaches the search you wrote. Phrase
> reaches searches that contain it. Broad reaches searches merely related to it,
> which can be a long way from what you wrote. Wider reaches more people and
> more of the wrong people. You set it beside each keyword in step 3.

*Source:* [About keyword matching options](https://support.google.com/google-ads/answer/7478529),
already cited by `broadMatch`.

---

**5 · Your bid, and what you actually pay** — step 3, then `qualityScore`

> Your bid is the most you will pay for a click, not what you will pay. On every
> search, ads are ranked by their bid multiplied by how well they fit, and the
> winner pays only enough to stay ahead of the ad below it. So a better ad can
> buy a better place for less money. You set a bid on each keyword in step 3.

*Source:* [The ad auction](https://support.google.com/google-ads/answer/1704431)
— Google's own words: *"It's not like an art auction where the highest bidder
always wins"*, and *"you can still win a higher position — at a lower price —
with high-quality ads and landing pages."*

**Worth noting:** that is the first run's central lesson, in Google's own
sentence. The run shows it happening; this chapter names it.

---

**6 · What an ad is made of** — step 4, then `writers`

> An ad is a set of headlines and two lines of description, and Google chooses
> which to show on each search. It is the only thing your rivals can see about
> you, and how well it fits a search decides your place as much as your bid
> does. You write it yourself, or pay someone to, in step 4.

*Source:* [About responsive search ads](https://support.google.com/google-ads/answer/7684791),
already cited by `writers`.

---

**7 · Your landing page** — step 4, then `qualityScore`

> The page a click lands on. Google judges how well it matches the ad and the
> search that brought someone there, and a poor match costs you both position
> and price. It is also where a visitor decides whether to buy at all. You do
> not write it here; you build it with capital in step 5.

*Source:* [Optimize your ads and landing pages](https://support.google.com/google-ads/answer/6238826)
— *"Choose a landing page that closely matches your ad and keywords. This
alignment helps improve your Ad relevance and landing page experience."*

---

**8 · Your budget, and what running out means** — step 5, then `weeklySplit`

> Your budget is what the month has to spend, divided across its four weeks.
> When a week's money runs out your ads stop and the searches carry on without
> you. Spending less than you could is not saving — it is searches you were
> never in. You split the month in step 5.

*Source:* [About average daily budgets](https://support.google.com/google-ads/answer/6385083),
already cited by `weeklySplit`.

**This is the chapter that produced `then`.** Google budgets by the day, with a
monthly limit of 30.4 times the daily figure; this game splits a month across
four weeks. The ground floor does not say so — `weeklySplit` does, and this
chapter hands the reader to it.

---

**9 · Capital: spending on the business, not the ads** — step 5, then
`rankOrBudget`, `device: true`

> Some of your money can go into the business instead of into ads: a better
> page, a size chart, photographs, order confirmation. Each takes three weeks to
> take effect and then keeps paying for the rest of the game. Anything you do
> not commit becomes ad budget instead. You choose in step 5, and once more at
> week 5.

*A game device.* Google Ads knows nothing about what a business spends on
itself.

---

## 6. Reachability, which is half the design

A ground floor nobody finds is worth nothing. Round 0 has **134 pieces of text
and 6 `why?` links**, onto 4 of the 13 chapters.

**The rule: every term a ground-floor chapter defines carries a `why?` the first
time round 0 uses it.** `line()` already takes the option; `tests/words.test.js`
holds it, the way it already holds sentences out of drawing modules. Six links
become roughly thirty.

**One thing to get right:** the `why?` opens the drawer, which today belongs to a
game (`ui/app.js` closes it when there is none, because chapters point at cards
that do not exist yet). A ground-floor chapter points at a **step**, not a card,
which is why `basic()` takes `step` and makes `yourAccount` optional.

## 7. What this refuses

- **A glossary page.** It would give every term a second address and break "one
  word, one home", which is the rule holding the three layers apart.
- **A `departs` half.** Section 2.3: the nuance chapter it hands you to owns the
  departure.
- **Consequences.** Section 2.1: that is the surprises layer.
- **Anything in `engine/`.** No number moves.

## 8. How we would know

**On the code, before any tester:**

| | today | after |
|---|---|---|
| terms with a home in the guide | 0 of 10 | 9 chapters covering all of them |
| `why?` links in round 0 | 6, across 134 lines | one per term the ground floor defines |
| chapters whose real-world claim is sourced | 13 of 13 | 20 of 22 (two are devices) |
| a ground-floor chapter naming what continues it | — | 9 of 9 |

**From the next playtest file:** whether any `why?` is ever clicked.
`recording.clicks` names every control, so a ground floor that goes unopened is
visible rather than assumed. If six links become thirty and none is touched,
on-demand was the wrong shape and the fallback is section 3 of the parent doc —
teaching inline in the steps, with evidence behind it the second time.

## 9. Known weaknesses, stated rather than hidden

1. **Nine new chapters is a lot of prose to get right at once**, and the only
   real test is a stranger we do not have.
2. **`then` assumes the nuance chapter is worth arriving at**, and section 6 of
   the parent doc has not rewritten them yet. A beginner sent from chapter 8 to
   `weeklySplit` today lands on a chapter whose departure is 37 of its 95 words.
   **The ground floor should therefore land after the rewrite, or with it.**
3. **Two of the nine are devices**, and a beginner cannot tell a game device
   from the real thing except by the absence of a source. That is thin.
4. **The break-even chapter quotes a figure that depends on a square the player
   has not chosen yet** when opened from step 1. It reads the briefing's worked
   anchor, which is the mid tier — the same figure step 1 already prints, so
   they agree, but it is an assumption worth naming.
5. **Round 0's `why?` links open a drawer built for a game.** Section 6 says how;
   it is the one piece of real plumbing here and the most likely to bite.

## 10. Where it came from

- Two strangers played `playtest-4` and neither finished; both named the guide's
  explanations as not simple enough (the parent doc, section 1).
- The parent doc's section 5 sketched this; the owner chose B and the three
  defaults on 2026-09-19, and `then` came out of writing chapter 8.
- Every real-world claim was fetched on 2026-09-19 from the pages named beside
  it, per `CLAUDE.md`: never a real-world claim from memory.
