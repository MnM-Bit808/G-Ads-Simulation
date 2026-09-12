# SLC review — the Google Ads search simulator

*2026-09-12 · a product review, not a fix · no code was changed · reviewed on `main` at `cf07b43`*

*Revised the same day, after four motion skills were installed (`find-animation-opportunities`,
`improve-animations`, `review-animations`, `animation-vocabulary`):*
- *section 12 is now a staged route rather than a flat list;*
- *section 13 is rewritten under the skills' rules, and withdraws one of my own ideas;*
- *a final pass corrected the timing, word-count and ROAS figures (sections 4, 8 and 9A-3), the
  count of contradicting sentences in the verdict, and a few smaller figures.*
- *Stage B (72 measured markets) then corrected two of this review's own claims:*
  - *9A-2, brand, is largely wrong: defending your name IS cheaper traffic in play;*
  - *"winning is easy" does not hold: a sensible player finishes median 6th of 9.*

  *Both are marked where they appear. DECISIONS A9 and F15 hold the measurements.*

## How to read this

- **Labels.** **[O]** observed (I saw it on screen), **[M]** measured (I counted it, or read it in code),
  **[I]** inferred (my reasoning). Where a claim comes from the builder's documents it says so.
- **Terms.** CTR = click-through rate (clicks ÷ times the ad was shown). CPC = cost per click.
  ROAS = revenue ÷ ad spend. QS = Quality Score.
- **Evidence and its limits.** Two full games played by me in the browser pane against the local dev
  server, plus the one recorded human game in `HANDOVER.md`. I read every word on every screen,
  which no human does, and that human had watched the product being built. **Neither of us is the
  target player.** Every verdict here is a hypothesis for a stranger playtest to confirm or kill.
- **Order of work.** I played blind first and froze my notes before opening `HANDOVER.md`,
  `DECISIONS.md` or the spec. Section 1 is those notes. Everything after reads the documents as the
  builder's hypotheses and checks them against the code.

The two games:

| | game 1, "careful" | game 2, "careless" |
|---|---|---|
| position | Mid · Lifestyle | Value · Performance |
| keywords | 19, later 32, mostly phrase; bids cut from ₹30 to ₹15 by week 3 | "Add all 60 shown", every one switched to broad, never touched again |
| writer, capital | freelancer; page + size guide, then photography + WhatsApp | premium retainer; no capital |
| result | **1st of 9**, contribution ₹20.8L on ₹5.57L spend, net ROAS 9.39 | **9th of 9**, contribution −₹1.86L on ₹6.94L spend |

---

## Verdict in brief

| | score | one line |
|---|---|---|
| **Simple** | **2 / 5** | A strong game buried under 2,600 words before the first auction and 2,600–3,600 per week |
| **Lovable** | **3 / 5** | Real "aha" moments; they stop at week 4 (the "wins easily" claim is withdrawn, see section 6) |
| **Complete** | **3 / 5** | The loop runs end to end; a reload destroys it, and nothing turns the game into stated lessons |

- **The core works.** Careful play won and careless play lost [M], and the best moments are genuine:
  week 1's numbers rewriting themselves, the returns bill at week 6, and broad match flooding spend.
- **Too much is written and too little is read.** The one human finished in 28 minutes by skimming,
  so most of the text is unread by design.
- **The back half teaches nothing new.** That is the builder's own finding, and it agrees with mine.
- **Four things on screen teach something false or misleading, all of them fixable** (section 9).
  Three are cheap: an unrecorded player-only broad-match inflation, a revenue figure labelled like
  profit, and ten sentences that contradict the model.
- **45 minutes is enough to finish but not enough to read.** Round 0 takes two-thirds of it (section 8).

---

## 1. First impressions, written before reading any document

Condensed from the notes I froze after playing. Corrections made after reading the code are marked.

**What worked.**
- **Blocking and match types gave immediate feedback.** Typing "gym" as a negative said at once that
  it blocks 38 searches [O].
- **Changed since you looked** rewrote week 1 from 181 to 274 conversions and from ₹1.91L to ₹3.17L
  of gross profit [M]. That is the best lesson in the product: you decide on unfinished numbers.
- **Cutting every bid from ₹30 to ₹15 bought 33% more clicks** and took CPC from ₹19 to ₹8. The advice
  card pointed there first ("lost 48% to budget, 0% to rank") [M].
- **The week-6 returns card** (refused at the door against sent back, freight paid, cash on delivery
  by city tier) is specific to India and genuinely instructive [O].
- **Maximise conversions spent the whole budget for the same conversions** as manual bidding
  (146.5 against 145.9) [M].
- **The end screen opens every rival's books** and shows that gross rank and money actually kept
  disagree. Five of nine placed differently [O].

**What got in the way.**
- **No first screen says what the game is,** how long it takes, or how you win [O].
- **Round 0 is one page:** 2,633 words, 11 sections, about 6,900px, 97 buttons and seven decision
  areas [M].
- **The weekly dashboard is 17–19 cards,** growing from 2,650 words in week 1 to 3,605 by week 4, with
  182 buttons [M].
- **One bid idea took 18 separate field edits,** and later 31 [M].
- **A pane-triggered reload wiped round 0 silently** [O].

**Withdrawn after reading the code.**
- **The stale ad grader:** my reading was contaminated by that reload.
- **"Start another game" does nothing:** it reveals two options below it.
- **"You are never told your week-8 rank":** you are, in the 16th of 17 cards (see 9C).

---

## 2. My play against the one recorded human game

The human game is in `HANDOVER.md`, *What playing it as a learner found*: premium · lifestyle,
28 minutes, recorded with a passive DOM recorder.

| | human (HANDOVER) | me | agree? |
|---|---|---|---|
| Result | 1st of 9, 38% ahead, net ROAS 6.48 | 1st of 9, 2.2× the next rival, net ROAS 9.39 | **Yes, in these two games.** Stage B's 72 markets put a sensible player at median 6th, so the wins came from choices, not the market |
| Round 0's share | 1,076s, 67% of the session, 630 keystrokes | 2,633 words, 7 decision areas | **Yes.** Round 0 is the product's centre of gravity |
| Back half | weeks 5–11 in 72s, 8 clicks, nothing typed | decisions in 6 of 12 weeks, most of them my own experiments, not prompts | **Yes.** Nothing new arrives after round 5 |
| Search terms report | inert all game: all-phrase keywords mirror themselves | alive: one broad keyword took 73% of week 1's spend | **Differs.** The lesson depends on choosing broad, and nothing leads a player to it |
| Location card | never clicked | used at week 6, once returns existed | **Differs,** because I read everything. The card has nothing to say until week 6 |
| Dayparting | afternoon +100%, correct without being told | untouched | **Differs.** It worked for them |
| End screen | read without a question | clear, but no debrief | **Mostly agree** |
| Time | 28 minutes | not comparable; I don't read at human speed | The human shows people **skim**. That changes the 45-minute question (section 8) |

**Where I'd challenge the handover's reading.** It says the screens "correctly reported nothing
wrong" from week 4 on. True, but it's also the problem: the market stops changing, so a correct
screen has nothing to say.

---

## 3. What it intends to teach, and whether that lands

Intended lessons come from spec §3 (brand bidding, returns, intent spread, positioning), DECISIONS
**H1–H10** ("What the simulation gets right"), and I27 (attribution lag), D4 (the week-8 trap),
G4 (location and cash on delivery) and D2 (automation).

| Lesson | Where it is shown | Evidence from play | Lands? |
|---|---|---|---|
| Losing share to budget and to rank need opposite fixes (H3) | the impressions card plus its advice sentence | halved bids → +33% clicks, CPC ₹19 → ₹8 [M] | **Yes** |
| Numbers you read are unfinished (I27) | *Changed since you looked* | week 1: ₹1.91L → ₹3.17L [M] | **Yes, the strongest** |
| Gross and net ROAS diverge on returns (§3.2, D4) | returns card from week 6; end screen | 45% of week 1 came back [M]; the human understood the end-screen trap | **Yes, late.** Nothing before week 6 |
| Broad match drifts; negatives clean it up (E4, H5, H6) | search terms and negatives cards | 73% of week-1 spend on one broad keyword [M]; careless game −₹1.86L [M] | **Only if you pick broad.** The human never met it |
| You pay to beat the ad below, not your bid (H1) | implied: CPC sits well under the bid | bid ₹30, paid ₹5 [M] | **Visible, never named** |
| Quality is a price discount (H2) | the QS column | QS read 3 in every week I checked, while the landing page went 8 → 10 [O]; A6 and W11 measure grades 5–8 as indistinguishable | **No.** The display cannot move |
| Conversion-rate work beats more spend (H9) | nothing: photography and order confirmation have no surface (HANDOVER *Still open*) | — | **No** |
| Dayparting (H4) | hours card | the human got it right; I didn't touch it | **Sometimes** |
| Winning the auction is not winning (H7) | search terms CPC and conversions | gym terms at ₹28 CPC with 0.1–0.7 conversions [M] | **Partly**, if you sort the table |
| Smart bidding has a learning period (D2) | bidding card | Max conversions spent ₹21k more for the same conversions [M] | **Yes, if tried** |
| Brand bidding (§3.1) | red and green brand labels (I2) | own brand ₹25 CPC against ₹8 generic, 2.6% CTR [M], in one game; across 72 markets, 0.59× generic CPC at 1.52× click-through | **Lands if you defend your name**, though smaller than real (9A-2, corrected) |
| Cash on delivery by location (G4) | location card | used by me, never by the human | **Weak** until week 6 |
| Competition emerges from everyone's play (H10) | nowhere on screen | — | **Invisible** |

**Pattern.** A lesson lands when the player makes one change and sees its effect the next week. It
fails when the effect is hidden (quality, capital), late (returns), or needs a choice the game never
prompts (broad match).

---

## 4. What a real player meets that I did not

- **Sign-in.** The live site sits behind Cloudflare Access: enter your email, wait for a one-time
  code, possibly fish it out of spam (HANDOVER *Deployment*). I didn't sign in, because I don't
  authenticate to accounts. [I] It costs a minute or three and invites drop-off, and the first
  thing after the code is 2,633 words with no introduction.
- **A reload loses the game.** [O] A reload during round 0 wiped every choice with no warning.
  [M] `ui/` has no `beforeunload` guard and uses no storage. HANDOVER tells playtesters in a
  message; a message is not a fix. The repair is cheap, because `serialise.test.js` already proves a
  seed plus the decision log replays a game exactly.
- **The pauses may be gone, and the warning may be stale.** HANDOVER says early weeks take about 7s
  and late weeks 30–60s, and tells playtesters to expect a freeze. That figure was written on
  2026-09-06 (`e9007d9`) and copied into the playtester advice on 09-11 without re-measuring.
  [M] Today, locally, weeks 2–11 took **0.27–0.30s** each in game 1 (19–32 keywords), with the
  final week at 0.82s. In game 2 (60 broad keywords) every week took **0.8–1.8s**. Not checked on
  the live site or a slow phone. If the pause is gone, telling strangers to expect a freeze sets a
  bad first impression for nothing.

---

## 5. Simple

**What 5/5 looks like here.**
- The goal fits in one sentence on the first screen.
- Round 0 is at most four decisions and about ten minutes.
- Each week shows the three to five things that changed and asks one question.
- Every lever is one a real account has, or is marked plainly as a game device.
- Nothing is said twice.

**Score: 2 / 5.**

**Evidence.**
- **Round 0:** 2,633 words, 11 sections, 7 decision areas, 97 buttons [M]. It took the human
  18 minutes and 630 keystrokes (HANDOVER) [M].
- **The dashboard:** 17–19 cards, 2,650–3,605 words, 52 inputs, 182 buttons [M]. Every card appears
  from week 1 whether or not it has anything to say. The returns card announces its "first honest
  reading is week 6"; the location card has no data until then [O].
- **Duplication:**
  - two budget cards, *This month's budget* and *Budget*;
  - two 1–10 grade scales beside a three-level QS, so 6/10 reads "below average" and 10/10 reads
    "average" [O];
  - "a higher bid buys rank, not a lower price" printed 30 times in one pending-changes list [M];
  - the same "most visible is not winning" anecdote every week [O].
- **Decisions real Google Ads doesn't have:**
  - who writes the ad (I11: *"Real Google Ads has no notion of who wrote your ad"*);
  - the weekly split (D10: *"a decision Google does not offer"*);
  - a 4 × 4 capital ladder;
  - picking one of nine deliberately meaningless brand names.

  All four are recorded and disclosed, so none is a lie. But each costs round-0 time the lesson
  doesn't need.
- **No bulk bid edit** [M].

**What is getting in the way.** The project's fix for "correct but unhelpful" is to add a sentence.
HANDOVER's *second player session* lists four such fixes, each a new note. Nothing ever retires one,
so text only grows.

**Cut, add, change.**
- **Cut:** the writer choice (keep the starter draft and the live grader); the brand-name pick
  (assign one); the second budget card; repeated notes after first view.
- **Hide until they have something to say:** the weekly split (default even, behind an "advanced"
  toggle), plus location, prepaid discount and hours of the day.
- **Change:** round 0 into a guided sequence of steps. Give each card a word budget.
- **Add:** one intro screen (what this is, 12 weeks, about 45 minutes, how you're scored) and bulk
  bid edit.

---

## 6. Lovable

**What 5/5 looks like here.**
- Every week produces one thing the player didn't expect and can explain.
- Losing is possible and visible.
- The ending tells you what *your* game taught you and what would have happened otherwise.
- You want to replay from a different cell, and you'd send it to a colleague.

**Score: 3 / 5.**

**For.**
- The "aha" moments in section 1 are genuine and specific to India [M/O].
- The end screen was the best-performing surface for the human (HANDOVER).
- Bad play has consequences: the careless game lost ₹1.86L and got last place's month-3 budget [M].

**Against.**
- **Engagement ends at week 4.** The human clicked through weeks 5–11 in 72s (HANDOVER) [M].
  HANDOVER's own diagnosis holds: the last new decision arrives at round 5, and settled feedback
  starts at round 7.
- ~~**Winning is easy.** Both recorded careful games won 1st, by 38% and by 123% [M].~~
  **Withdrawn after stage B.** Across 72 markets, a sensible player finished median 6th of 9
  (DECISIONS F15). Those two wins came from particular choices, not from the market. What stage B
  did confirm is that almost nobody *loses money* (8 of 648 advertiser-games), which is the real
  tension problem: the band of "fine" is very wide.
- **The numbers flatter.** The headline profit is green and huge: week 1 revised to a gross ROAS of
  13.1, and weeks up to 15.9 [M]. It makes a first-timer feel like a genius rather than a learner
  (see 9A-3).
- **Improving copy is never rewarded on screen.** QS never moves (A6, W11).
- **No debrief and no counterfactual** at the end [O].
- **A reload erases the game so far, up to 45 minutes of work** [O].

**Cut, add, change.** Recommendations 4–7.

---

## 7. Complete

**What 5/5 looks like here.**
- A stranger signs in, understands the goal, plays 12 weeks and leaves with the lessons stated back
  to them, without losing work.
- Every lesson the spec claims (H1–H10) has at least one screen showing cause and effect.
- The live site behaves like the local one.

**Score: 3 / 5.**

**For.** Two full games played end to end with no crash [O]. Every control spec v0.3 describes is
reachable (HANDOVER).

**Gaps.**
- **No save:** a reload loses the game [M].
- **No debrief.** The end screen is an answer sheet plus a 60-line change log [O].
- **The engine's exact counterfactual is computed every round and shown nowhere** [M].
  *Corrected 2026-09-13: it is computable, not computed. The engine works it out only for the
  advertisers a caller names in `counterfactualFor`, and nothing in the game named any, so no played
  game has had it (DECISIONS G1).*
  `missedToBudget` (`engine/report.js:122`) has no reader in `ui/`, although G1 says *"The UI must
  label it."* It is the natural "what if" for a debrief.
- **Two of the four capital targets have no surface at all** (HANDOVER *Still open*).
- **The quality lesson cannot be displayed** (A6).
- **Your week-8 rank is told only in the 16th of 17 cards.** A 5th-place finisher is never told,
  because the note only renders when month 3 differs from ₹1,68,000 (`ui/dashboard.js:907`) [M, from
  the code, not seen in play].
- **Live-site timing is unverified.**

---

## 8. The 45-minute verdict

**Can a first-timer finish in 45 minutes? Yes. Can they learn it in 45? Only the front half.**

| phase | what it asks (measured) | recorded human time |
|---|---|---|
| sign-in | email, then a one-time code | not recorded |
| round 0 | 2,633 words, 7 decision areas, 151 searches to sift | **1,076s (18 min)** |
| week 1 | 2,650 words, 17 cards | 168s |
| week 2 | 2,933 words | 102s |
| week 3 | not measured | 50s |
| week 4 | 3,605 words, plus capital and repositioning | 148s |
| weeks 5–11 | 3,333 and 3,510 words at weeks 5 and 6, the two measured | **72s in total** |
| end screen | about 2,000 words on top of the dashboard | not separate |
| **total** | about 40,000 words across the game (estimated from the weeks measured) | **28 minutes** |

**Where the time goes.** Two-thirds goes on round 0, and almost none on the weeks where settled
data finally exists. The game fits 45 minutes only because players skip most of the text. At a
normal reading speed, the weekly dashboards alone would take two to three hours [I].

**For a genuine stranger,** who hasn't watched it being built [I]:
- sign-in: 2 min;
- round 0: 20–25 min;
- weeks 1–4: 10–12 min;
- weeks 5–12: 3–5 min;
- end screen: 3–5 min.

That comes to **38–49 minutes**, right at the edge. The risk isn't running out of time. It's
quitting inside round 0.

---

## 9. Where it teaches something false, sorted by where it would be fixed

In this project honesty outranks features, so this section comes before the recommendations. None
of the fixes suggested here makes the model less true.

### 9A. Model inputs: confirmed defects and one open question

1. **The player's keywords broad-match further than a rival's identical keyword** [M].
   - **The cause.** Rivals' keywords carry the search row's own tags (`setup.js:359`). The player's
     get `heuristicTags`, a plain word lookup (`setup.js:729`, `ui/decisions.js:1307`).
   - **The size of it.** Across the 120 commercial searches, 86 lose at least one tag when added as a
     keyword, and 34 collapse to a single tag. Mean broad reach is **29.2 searches with the lookup
     tags against 16.7 with the row's tags**. Worst cases:
     - `studio to street leggings` reaches 50 searches against 4;
     - `athleisure set india` reaches 18 against 6;
     - `wrinkle free travel co ord` picks up the tag `free` and reaches three "free workout" searches.
   - **The reasoning is backwards.** The docstring (`agents/keywordTagger.js:143`) calls fewer tags
     "conservative". But `tagOverlap` divides by the keyword's tag count, so fewer tags means
     *further* reach.
   - **Status.** Not a breach of R6 in the letter, because the engine is symmetric. It is an
     unrecorded asymmetry in what goes into it, and `round-zero.js:1027` already uses the row's tags
     for the reserve check.
   - **A correction to my own blind note.** My week-1 blow-out (`matching set women`, 73% of spend)
     is *not* this defect: with its row tags it reaches 53 searches, more than the 41 it reached. That
     one is E8's rule, where a two-tag keyword needs only one shared tag, meeting the tag "women",
     which sits on most of the set.
   - **The open question, not a finding:** should a qualifier like *women* or *india* count as a
     concept broad match travels on? F13 rejected retagging and symmetric broad match, so raise this
     only with playtest evidence.

2. **Brand owners have no click or relevance advantage on their own name** [M].
   - **What the model does.** Ownership changes conversion only: 2.5× for the owner, 0.25× for a
     poacher (spec 12.1, `engine/attribution.js:53`). Click-through and relevance are identical for
     owner and poacher, and no DECISIONS entry argues for that.
   - **What I saw.** Own brand at 2.6% CTR in week 1 and about ₹25 CPC in week 3, against ₹8 generic.
     I2 records `brandDefender` holding 100% of eight of the nine brand searches by round 2.
   - **The contradiction.** The briefing calls brand "the cheapest good traffic in the market".
   - [I] In real accounts the owner's ad on its own name is usually the account's highest-CTR,
     cheapest traffic, and a poacher pays a quality penalty. So the game currently teaches the
     reverse. It needs a DECISIONS entry and a measurement across seeds before any change.
   - **Corrected by stage B: the "teaches the reverse" conclusion was one game, and wrong.**
     Across 72 markets, a player defending its name gets 1.52× its generic click-through at 0.59×
     the cost per click, and keeps 66% of its own-name clicks. What survives (DECISIONS A9):
     - the advantage is emergent rather than modelled;
     - it is probably smaller than real;
     - poachers pay no quality penalty;
     - five of six rival characters never defend their own names.

3. **The market looks too profitable** [M, with the judgement inferred].
   - **What I measured.** Lifetime conversion rate 4.87%. Weekly gross ROAS, one week after the
     fact, between 6.4 and 15.9 (13.1 for week 1). ₹20.8L kept on ₹5.57L of spend. The human's net
     ROAS was 6.48.
   - **Why.** `convRateBase` is tagged INVENTED (`engine/constants.js:344`), and HANDOVER notes the
     affinity product on your own territory runs near 2.0, which doubles it by construction.
   - **Nothing checks the absolute level.** Invariants I1–I5 test balance and budget binding; none
     bounds absolute ROAS or conversion rate.
   - **It compounds.** F4 (no lifetime value) means a real brand's first-order losses aren't
     modelled either.
   - [I] If a careful first-timer can't lose, "most traffic is marginal" can't be taught. **Measure
     against a sourced benchmark before changing anything.** I haven't sourced one.
   - **Confirmed and located by stage B** (DECISIONS F15), against weak benchmarks:
     - cost per click is realistic;
     - the excess is click-through (about 2×, partly B6's ads-only results page) and conversion
       (about 1.5×);
     - 640 of 648 advertiser-games profit over the settled weeks.

### 9B. Labels that mislead (UI; the numbers are right)

4. **"Net per click"** in the location card is net revenue ÷ clicks (`ui/decisions.js:843`), shown
   beside average CPC: ₹78–112 against ₹8–11 [M]. It invites bids two to three times too high.
5. **Round 0's "₹20.37 on an average search"** is margin per *click*. The report's "worth" figures
   are revenue per click. Two bases for "what a click is worth" [O].
6. **The headline "net profit" equals gross** until returns settle, since net equalled gross in every
   week I read, yet it's shown in large green type [O].

### 9C. Sentences that contradict the model (UI copy, one sitting) [M]

| where | says | truth |
|---|---|---|
| `ui/round-zero.js:708` | Capital "₹1,00,000" | ₹1,20,000 (`CAPEX_ALLOCATION_PAISE`, `constants.js:895`) |
| `ui/round-zero.js:1561` | month 3 "redistributed by rank across all 12 rounds" | D4: rounds 1–8, as reported at round 8 (the same page says so elsewhere) |
| `ui/dashboard.js:512` (week-8 card) | both halves of the rule "reward spending that looks better than it is" | D4: attribution lag makes deadline spending look *worse*; the end screen says so correctly |
| `ui/dashboard.js:515` (week-8 card) | "Nothing here tells you where you stand" | the budget card states your rank after week 8, except at 5th place (`dashboard.js:907`) |
| `ui/ending.js:493` | "the metric **13.1** calls the lead" | a spec section number shown to the player |
| `ui/ending.js:42` | prints "orderConfirmation" | `CAPEX_NAMES` lacks that entry |
| `ui/dashboard.js:428` | capital "opens at rounds 1 and 5" | the screens call these round 0 and week 4 |
| `ui/round-zero.js:367` | "the metros are the smallest of the three" | true across the market, false for the premium column beside it (38% against 36% and 26%) |
| `ui/round-zero.js:1284` | quality "costs nothing" | two lines above writers priced at ₹10,000–₹50,000 |
| `ui/decisions.js:2547` | "over the last 13 finished rounds" | true to `QUALITY_WINDOW_ROUNDS`, but reads as a mistake in a 12-round game |

HANDOVER already names the root cause: *"for six of seven prompting cards the wording lives inside
the drawing, so it is neither unit-tested nor readable without a browser."*

### 9D. Disclosed abstractions: not false, but they cost simplicity

- **The writer tiers and the self-written ad's two-week delay** (I11: *"the abstraction is on the
  card"*).
- **The weekly split** (D10).

They're honest about being game devices. The question is whether a 45-minute learner should spend
round-0 time on them (section 10).

---

## 10. The smallest complete version

**The one job:** run a search account long enough to see cause and effect, honestly.

**Must keep.** Each of these carries a lesson with a visible consequence:
1. **Position choice,** with the eight rival ads as the only evidence (positioning, C5).
2. **Keyword research, match types, bids, negatives and the search terms report.** That loop is E4.
3. **Ad copy with the live grader:** relevance and click-through.
4. **A monthly budget,** for lost-to-budget against lost-to-rank.
5. **The weekly report:** the week, the impression-share split, search terms, keywords with QS.
6. ***Changed since you looked*,** for attribution lag.
7. **The returns card from week 6,** for gross against net, the cash-on-delivery texture, and its one
   open lever: block a search that returns worse (I32).
8. **One smart-bidding option** with its learning period.
9. **The end screen,** with the books open, gross against contribution, **and a debrief**.

**Could go, or move behind an "advanced" toggle or into later weeks, without losing the lesson:**
- the brand-name pick;
- the writer tiers (the starter draft stays);
- the weekly split;
- the 4 × 4 capital ladder (H9 isn't visible anyway, so keep one target or none);
- location adjustments, the prepaid discount, and hours of the day;
- the repositioning window and the round-0 redo;
- the week-by-week chart, the market card and the second budget card.

**Honest caveat.** Cutting location, prepaid and capital loses India's cash-on-delivery texture as
*levers*. The returns card still teaches it as *fact*. That trade is for you to judge.

**Target to test, not a cut order:** round 0 at four steps and about 1,200 words, and a weekly
report of about eight cards.

---

## 11. Pushing back on the project's assumptions

1. **The honesty audit points at the engine, but the leaks are in the words.** The ledger runs to
   3,855 lines. Every false thing I found is in a string, a label, or an input path that no test
   reads (section 9). Point the next honesty pass at the screen.
2. **A sentence nobody reads isn't disclosure.** The one human spent 72 seconds on seven dashboards.
   Every new note should retire an old one.
3. **Two careful players, two first places.** That isn't evidence the game teaches. It may be
   evidence it's easy: a lifestyle rival tops 27 of 30 played markets (F13), and the market looks
   generous (9A-3).
   Every playtest should record whether the player *could* have lost.
   *Stage B answered part of this. Winning isn't easy (median 6th across 72 markets), but losing
   money is rare. The pushback stands, aimed at profitability rather than rank.*
4. **You don't need a database to save a game.** For a solo learner, the seed plus the decision log
   in the browser's own storage is enough, and `serialise.test.js` already proves the replay is
   exact. The backend's only job is the Claude-backed rivals (`llmPolicy`), which HANDOVER itself
   calls optional. Don't build a server for this review's needs.
5. **Twelve rounds.** I agree with HANDOVER that the back half needs something that changes after
   round 5. Test the cheap version first (recommendation 7).
6. **One playtest is one playtest.** Agreed. But fix the known false sentences first, or a
   stranger's session will be spent rediscovering them.
7. **On gamifying it like Capstone:** Capstone's Courier opens every rival's books each round, and
   R3 rightly forbids that here. Keep the refusal. Get the game feel from true moments (section 13).

**Where you should push back on me.** I read every word at machine speed, so my timings are
inferred; the human's are measured. And I played two seeds, not thirty.

---

## 12. The recommendation route

Seven recommendations and a design stage, in five stages. Each stage has a gate: don't start the
next until it's met.
Costs are in working sessions like the ones this project already runs.

| stage | recommendations | done when |
|---|---|---|
| **A. True and safe** | 1, 2 | no row of 9C is left, and a reload restores a game exactly |
| **B. Measured** | 3 | brand and economics are measured; three stranger sessions are recorded as the baseline |
| **C. Simple** | 4, 5, with only the motion their new transitions need | strangers finish round 0 in under 10 minutes and spend more than 72s on weeks 5–12; then re-run the playtest |
| **D. Lands** | 6, 7; the game's one moment of delight lives in 6 | strangers state three lessons in their own words, and weeks 7–12 carry decisions |
| **E. Game feel** | section 13 | only after C, because it polishes the screens C rebuilds |

**Decided with the owner, 2026-09-12.** The explanations move into a **field guide inside the
game**, reached from "why?" links on each card. It is **optional depth**, not required reading, and
both the guide and the screens draw on one content source. Concepts go to the guide; readings of
your account and disclosures stay on screen, short. This merges stages C and E into one track,
"split the words from the play". **Stage A goes first.**

**What the motion skills changed, and what they didn't.** They change *how* stages C and D are
built. Each new transition gets one gated, specified motion, and in two places motion can replace a
sentence of explanation, which serves Simple. They don't change the order. The skills' own premise
is that the best animation is often none, and animating today's 3,600-word dashboard would polish
the thing recommendation 5 exists to shrink. Motion never goes before truth, safety or structure.

### 1. Stop the screen saying false things
**What.**
- Give a player's keyword the search row's tags when its text matches a row, as rivals already get.
  Show "on broad, this reaches about N searches" beside the match type. That is E8's own stated
  remedy, mirroring the negatives card's "blocks 38 searches".
- Relabel "net per click" as revenue per click after returns, and show the break-even CPC beside it.
- Correct the ten sentences in 9C. Put the week-8 rank on the week-8 card, including for 5th place.

**Impact.** High. It removes a player-only broad-match inflation of about 1.75× and a label that
invites overbidding, and it stops the game contradicting itself.

**Cost.** One session, mostly `ui/` and `setup.js`. The tag change moves the player's broad results,
so re-run `writerBalance.test.js` and the calibration checks, and **read the printed figures**.

**Proves it right.**
- Re-running the reach measurement (Appendix B) gives a ratio of 1.0 for planner keywords.
- A playtester asked "what would you bid in metros?" answers near break-even, not near ₹100.

**Proves it wrong.** If broad match stops producing any surprise at all, the lesson moved into the
tags. Then the real question is 9A-1's open one.

### 2. Don't lose the game, and re-measure the pauses
**What.** Save the seed and the decision log to the browser after every week, and replay them on
load. Warn before leaving mid-game. Time a full game on the live site and on a phone. If late weeks
are fast, drop the "30–60 second freeze" warning to playtesters.

**Impact.** High. A reload currently destroys up to 45 minutes of work.

**Cost.** One session. The replay already exists and is tested. It touches `ui/app.js` only; no
database, no backend.

**Proves it right.** A reload at week 9 restores the identical dashboard, down to the rupee.

**Proves it wrong.** Replay is too slow to feel instant. Then store a snapshot as well.

### 3. Measure two model questions, then play with strangers
**What.**
- Write DECISIONS entries for brand ownership (9A-2) and absolute economics (9A-3). Measure brand
  CPC and CTR for owner against poacher, and realised conversion rate and ROAS by cell, across 12+
  seeds. Compare with a sourced Indian benchmark before touching a constant.
- Then run three strangers through the live site with the recorder. Record time per phase, whether
  they could have lost, and three lessons each in their own words.

**Impact.** High. These decide whether the game's core economics are teaching the truth.

**Cost.** One or two sessions of measurement, plus the playtesters' time. It changes nothing unless
the numbers say so.

**Proves it right.** Measured CTR and CPC land near a sourced benchmark, or the gap gets a recorded
reason.

**Proves it wrong.** Strangers lose, and don't find it easy. Then the generosity worry was specific
to my cells and seeds.

### 4. Round 0 as a guided sequence, without the writer decision
**What.** Five steps:
1. the market and the rivals' ads (read only);
2. position;
3. keywords;
4. the ad: a starter draft, graded live, live from week 1;
5. budget, then Go.

Capital defaults to "keep it". Move the weekly split and the redo behind "advanced". Assign the brand.

**Motion (section 13, row 3).** Moving between steps uses a direction-aware transition: forward
slides one way and back slides the other, using transform and opacity only, over 200–300ms on
`cubic-bezier(0.77, 0, 0.175, 1)`. Under reduced motion it becomes a plain fade. Its job is to show
where you are in the sequence, which the scroll used to do.

**Impact.** High. It attacks the 67% of the session that is round 0.

**Cost.** Two sessions in `ui/round-zero.js`. It **re-opens I11**, and the new evidence is:
- round 0's share of a session (HANDOVER);
- hired copy scoring *below* the player's own draft in play (CTR 6 against 8) [M];
- I25 already supplying starter copy.

It would retire `writerBalance.test.js` and the invented two-week delay, which makes the model
*more* true: real ads go live in about a day.

**Proves it right.** Recorded round 0 under 10 minutes for strangers, with ad grades no worse.

**Proves it wrong.** Self-written grades collapse without the tier ladder as a reference point. Then
bring back a single "hire someone" shortcut.

### 5. A dashboard that reveals itself
**What.**
- Show only the cards with something to say *this* week. Introduce each new card with one sentence
  in the week it becomes useful: returns and location at week 6, smart bidding once conversions
  exist, the week-8 card from week 5.
- Merge the two budget cards. Collapse a note after the player has seen it once.
- Set a text budget of about 1,000 new words a week.
- **Motion (section 13, rows 1 and 2).**
  - A card appearing for the first time enters once: opacity 0 → 1 and scale 0.97 → 1 over
    200–250ms on `cubic-bezier(0.23, 1, 0.32, 1)`. It is never animated again after that week.
  - In *Changed since you looked*, a revised figure visibly gives way to its new value (a crossfade
    or text morph under 300ms). That lets the card drop a sentence, because the player *sees* the
    week they read being rewritten.
  - **Use no counting ticker anywhere.** A ticker shows in-between numbers the engine never reported,
    which is a small lie in a project that forbids them.

**Impact.** High for Simple and Lovable, because the back half gets new things to look at.

**Cost.** Two or three sessions in `ui/dashboard.js` and `ui/decisions.js`. Move the wording out of
the render functions while there, which makes it testable (HANDOVER's own defect).

**Proves it right.**
- Recorded time in weeks 5–12 rises well above 72 seconds, and newly revealed cards get clicked.
- The motion diff passes `review-animations`.

**Proves it wrong.** Players miss a lever they needed because it was hidden. Then show a one-line
teaser for hidden cards.

### 6. A debrief that names the lessons, with the counterfactual
**What.** End with three to five moments from the player's *own* game, each a decision with its
before and after (for example, "week 3: bids ₹30 → ₹15, clicks +33%, CPC −58%"). Add the exact
"what if you'd had more budget" figure the engine already computes (`missedToBudget`, labelled as
G1 requires) and one line per spec lesson they did or didn't meet. *(Corrected 2026-09-13: the
engine can compute it but the game never asked; the debrief now asks once, at the end. See G1.)*

**The game's one moment of delight belongs here (section 13, row 5).** The end screen reveals where
each rival actually sat, the column `ui/ending.js` calls the one "nothing has ever told you". Reveal
it row by row, once per game, at a 50ms stagger, never blocking reading or scrolling. It's the rare
tier, where the skills allow a longer beat, and it rewards reading the market rather than winning
it. **A celebration for finishing 1st is rejected.** Both careful players won 1st, and celebrating an
outcome that may be too easy (9A-3) would amplify a lesson that may be false.

**Impact.** High for Lovable and Complete. It turns an experience into stated learning, and it's a
reason to replay.

**Cost.** One or two sessions. The data already exists in `decisionLog`, `history` and
`missedToBudget` *(the last only once asked for; see the correction above)*.

**Proves it right.** In interviews, strangers state three correct lessons with the debrief, and
fewer without it.

**Proves it wrong.** They skip it. Then shorten it to the single most expensive mistake.

### 7. Give the back half a decision that meets settled data
**What.**
- **Cheap test first:** move the second capital and repositioning window from week 4 to week 7,
  after returns are readable. It's a rule about timing, not market physics.
- **If that isn't enough:** an announced mid-game market event that's true to the Indian calendar,
  such as an end-of-season sale with more searches, higher conversion and higher returns. That is
  HANDOVER's own preferred direction.

**Impact.** Medium to high. It addresses the builder's biggest open question.

**Cost.** Low for the window move, though it needs a check that capital still pays back in the
remaining weeks. High for the event: engine and calibration.

**Proves it right.** Weeks 7–12 carry decisions in recorded play.

**Proves it wrong.** Moving capital later makes every capital allocation unprofitable. Then the
event is the only route.

*Not proposed, because the ledger or memory records them as rejected:* capital carry-over,
grade-matched writer copy, symmetric broad match, retagging the vague lifestyle rows, and extra
volume for performance (F13).

---

## 13. Game feel and motion, with the motion skills applied

This is a separate conversation, for stage E. It still matters now, because it corrects two things
my first draft said.

### Two corrections to my first draft

1. **Withdrawn: "show a few seconds of the 168 hours playing out" each week.** Put through
   `find-animation-opportunities`' gate, it fails two of the four tests:
   - **Speed:** it runs for several seconds, twelve times a game, and adds a wait to every week.
   - **Function:** the player is waiting to *read* a result.

   It would also stutter. The round runs on the page's main thread (HANDOVER *Playing it to the
   end*), so nothing driven by script can move while it computes. At most it could be a skippable,
   one-off explanation of pacing in week 1.
2. **Motion needs no library.** I warned that new libraries would trip the 40-file guard in
   `tests/build.test.js`. For motion that is beside the point: CSS transitions, `@starting-style` and
   the browser's built-in Web Animations API need no new files. That suits this no-bundler build. A
   React-oriented animation library would add files, and a framework the interface doesn't use.

### What moves today [M]

Nothing, except round 0's India map. It runs four infinite loops (`ui/style.css:477–514`: a 4.5s
twinkle, a 3.6s pulse, a 4.2s arc flow and an 11s sweep), and respects reduced motion
(`style.css:527`).

Its comment argues the motion is doing work, saying the demand is live (`style.css:470`). The
`improve-animations` skill says to respect a documented choice, so this is a note, not a finding.
One observation for whoever redesigns round 0: the map moves for the whole 18 minutes a player
spends reading that page, and its 380ms opacity transitions (`style.css:535, 543`) sit over the
skills' 300ms budget for interface motion.

### The opportunities that survive the gate

Five, which is inside the skill's cap of 5–7 for a whole app. All use transform and opacity only.
Under `prefers-reduced-motion` they keep the fades and drop the movement.

| # | where | today | purpose | how often | motion |
|---|---|---|---|---|---|
| 1 | *Changed since you looked* (rec 5) | the rewrite arrives already done, with "you saw" and "actually" side by side | **state indication**: the revision *is* the lesson | once a week | old value gives way to new, a crossfade or text morph under 300ms; never a counting ticker |
| 2 | a card's first appearance (rec 5) | cards appear from nowhere | **preventing a jarring change** | once per card per game | opacity 0 → 1, scale 0.97 → 1, 200–250ms, `cubic-bezier(0.23, 1, 0.32, 1)`, via `@starting-style` |
| 3 | round-0 steps (rec 4) | one long scroll | **spatial consistency** | five steps, once | direction-aware translate and fade, 200–300ms, `cubic-bezier(0.77, 0, 0.175, 1)` |
| 4 | *Run the week* and *Open the account* | the label changes, and that's all | **feedback** | 12 times a game | `:active { transform: scale(0.97) }`, 160ms ease-out; "running 168 hours…" stays the real signal |
| 5 | end screen, where each rival sat (rec 6) | the table appears at once | **delight**, which the skills reserve for rare moments | once a game | row-by-row reveal at a 50ms stagger, never blocking reading or scrolling |

### Rejected, with the test each one failed

- **The 168-hour run:** Speed and Function (above).
- **Counting tickers on the week's headline numbers:** Function, because these are numbers the
  player reads. They'd also dramatise the "net equals gross" headline that 9B-6 already says
  flatters.
- **The week-by-week chart drawing itself in:** Function. It's the skill's own example of
  decoration hindering a data graph.
- **Hover motion on keyword and search-term rows:** Frequency. They're touched tens of times a
  session.
- **A celebration for finishing 1st:** Purpose. Delight on an outcome that may be too easy (9A-3).
  The reveal in row 5 spends that budget on learning instead.

### How to use the skills here

All four are read-only: they write plans and reviews, never code.
1. Re-run `find-animation-opportunities` against the redesigned screens after stage C. The table
   above is a first sweep, not the final one.
2. Turn a row into a self-contained plan in `plans/` with `improve-animations plan <row>`.
3. Build the plan in a normal session.
4. Use `review-animations` as the bar the diff must pass. It defaults to flagging.

Doing this before stage C would animate screens that recommendation 5 is about to shrink.

### The rest of the game-feel direction

This part is unchanged, minus the withdrawn run.
- **Phases.** Borrow Capstone's round structure (brief, decide, results, debrief), not its open
  books.
- **A results page per week.** Replace the scroll with a single page of at most three stories: what
  changed, what it cost, what to look at.
- **A map you return to.** Make the positioning grid a recurring picture, where rivals sit at *your*
  guesses and those guesses sharpen as Auction Insights comes in.
- **Tools that unlock.** Present newly revealed cards as new tools. Row 2's entrance is what makes
  "a new tool" legible without adding a sentence.

Mock it up with the design canvas before touching `ui/`. Your skills folder also holds
visual-design skills, among them `redesign-existing-projects` and `minimalist-ui`. I haven't read
them for this review, so they're for that conversation.

---

## Appendix A — findings by where they would be fixed

| area | items |
|---|---|
| **Model inputs** (`setup.js`, `agents/keywordTagger.js`, engine, constants) | 9A-1 tag asymmetry · 9A-2 brand ownership · 9A-3 economics |
| **Labels on correct numbers** (UI) | 9B-4 net per click · 9B-5 two bases for click value · 9B-6 net shown as gross |
| **Copy** (UI text only) | the ten rows of 9C |
| **Flow and onboarding** (design) | intro screen · round 0 in steps · cards revealed as they become useful · debrief · the back half |
| **Quality of life** | bulk bid edit · repeated notes · 91 of 151 searches hidden until you search (60 are shown; *corrected: this row first said 60 hidden*) · no ₹ unit on round-0 bids · the starter ad arrives unannounced when you pick a position |
| **Robustness** | save and replay · leave-page warning · live timing |
| **Motion** (stage C onward) | the five gated rows of section 13 · the India map's loops and 380ms transitions, noted rather than contested |

## Appendix B — how the numbers were measured

- **Word, card and button counts:** `document.querySelector('main').innerText` split on whitespace,
  at round 0 and after weeks 1, 2, 4, 5 and 6. Buttons and inputs counted with `querySelectorAll`.
- **Week timing:** `performance.now()` from clicking *Run the week* until the header showed the next
  week number, local dev server, 2026-09-12.
- **Broad reach, 9A-1:** a read-only script in the session scratchpad, importing the real modules
  (paths shortened):

  ```js
  const { QUERY_SET } = await import('content/querySet.js');
  const { heuristicTags } = await import('agents/keywordTagger.js');
  const { tagOverlap } = await import('engine/matching.js');
  const { BROAD_MATCH_MIN_OVERLAP } = await import('engine/constants.js');
  const reach = (tags) => QUERY_SET.queries
    .filter((q) => tagOverlap(tags, q.tags) >= BROAD_MATCH_MIN_OVERLAP).length;
  // for each commercial row q: compare reach(heuristicTags(q.text)) with reach(q.tags)
  // result: 86 of 120 lose a tag, 34 collapse to one, mean reach 29.2 against 16.7
  ```
- **Everything else** is cited to a file and line, or to a named section of `HANDOVER.md` or
  `DECISIONS.md`.
