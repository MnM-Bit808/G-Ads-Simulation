# The message project, part 1: angles

**Design doc. Nothing is built from it yet.** The round 0 redesign's section 11
recorded the message project as decided-in-principle and designed later; this is
the design for its first half. Images are part 2 and have their own doc to come.

Written 2026-09-18 with the owner, while `main` was frozen for the stranger
playtests, so nothing here has been built or measured in play.

---

## 1. What this is, and what it is for

The game teaches the auction and the money. It says nothing about the message: an
ad is written once in round 0, graded on whether it is filled out, says three
different things and gives a reason to click, and then it runs for twelve weeks.
Two advertisers with the same grade are identical to the engine however
differently they talk.

**The goal, from section 11:** the game stays about the auction and the money,
with a simple way to teach message strategy, and ads that feel more real.

**The lesson this design teaches:** the more precisely someone searches, the more
precisely your ad must answer — and the right message therefore depends on the
keywords you chose, not on your taste.

## 2. What the player meets

**In round 0, step 4**, a hired writer offers three finished ads, one per angle,
for the square the player sits in:

| Angle | What the ad leads with | Example headline |
|---|---|---|
| **Wide** | the brand, the range, the price | Gym Leggings From ₹799 |
| **Balanced** | one clear claim, no detail | Squat Proof, Wash After Wash |
| **Specific** | the exact thing, named | Four-Way Stretch, Flat Seams |

The player picks one. It is their ad — not a setting beside it.

**A player who writes their own ad** gets the angle the grader reads out of their
words. Your ad says which angle it read and why: *"read as wide: it names a price
and a range."* Writing "from ₹799" makes it a wide ad whether or not that was the
intention, which is the point — the words are the message.

**At the week-5 window** the ad may be rewritten once, for the writer's fee, live
after the usual capital lag. A wrong choice is recoverable, at a price, which is
what makes it a decision rather than a coin toss in the first five minutes. This
is also the first time the game lets an ad change: I11's note that "rewriting an
ad mid-game waits for the message project" is answered here.

## 3. The rule

**An angle is read from the ad's own words**, by one rule, for everyone: the
player's ad, a hired writer's ad, and every rival's ad. Nobody carries an angle
as a separate field, so nothing on screen can contradict the ad the player can
read in Auction Insights.

**An angle is matched against how specific the search is** — `isHeadTerm`, which
the query set already carries. A wide ad answers someone typing *gym leggings*; a
specific ad answers someone typing *high waisted squat proof leggings*. Balanced
is never best and never worst.

**The match becomes one factor in the quality signal**, beside `queryKeywordFit`,
so it moves the click-through and the ad rank on that search and nothing else.

**Who buys still depends on where the brand really sits.** A premium brand can
win the click with a wide, price-led ad and then sell badly. The trap the game
already teaches stays a trap; the angle cannot rescue a position.

**Why this is a decision and not an answer.** The market is 35% head and 65% tail
by volume, but an account is whatever its keywords bought. Measured on the query
set: the six highest-volume searches in mid · performance are 4 head and 2 tail,
so a player who takes the obvious keywords should run a wide ad, while a player
who broadens reaches the tail and should not. Two decisions, one step apart, that
have to agree.

## 4. What the measurements ruled out

Three other ways to decide whether an angle suits a search were considered and
killed by measurement, before any code. They are recorded because each is the
obvious idea and will be proposed again.

**(a) The words in the search.** Angles mapped onto the words a search is made of
— "cheap" and "under 999" wanting a price message, "bamboo" a material one. It
fails on the data. Share of each square's volume carrying an angle-bearing word,
on a first-pass word list:

| Square | price | proof | material | comfort | none |
|---|---|---|---|---|---|
| value · performance | 100% | 4% | 0% | 0% | **0%** |
| value · lifestyle | 100% | 4% | 0% | 30% | **0%** |
| mid · performance | 0% | 0% | 0% | 0% | **100%** |
| mid · lifestyle | 0% | 0% | 3% | 27% | **70%** |
| premium · performance | 0% | 19% | 36% | 18% | 36% |
| premium · lifestyle | 0% | 0% | 46% | 38% | 38% |

A mid · performance player — the default square — would have no angle that
matters at all, and a value player would have no choice to make. Widening the
word list does not help: those searches name the product ("sports bra high
impact"), not a motivation. There is no message in them to match.

**(b) What the searcher is there to do.** `intent` covers every search by
construction, so nobody is left out. But every search with a home cell is
`commercial`: brand, informational and irrelevant searches sit outside the
squares entirely. Inside a square, intent is a constant, so there is again
nothing to choose between.

**(c) The search's price and purpose leanings.** These decide whether a
**position** suits a search. An angle read off them would teach the positioning
lesson a second time, inside the same product of factors — the shape of the L6
double-count this ledger already warns about. Refused on principle rather than on
data.

**What survives.** Within a square, the only thing that varies is how specific
the search is: about 35% head and 65% tail in every one of the six.

## 5. The field

Every rival's angle is read from the ad it already runs, by the same rule. No new
authored data, and a rival's angle can never disagree with its ad.

Read by a first-pass rule, the twelve authored ads split **6 wide, 6 specific**,
and the split tracks position without anyone having intended it: every value ad
reads wide ("Gym Leggings From ₹799"), every premium ad specific ("Recycled
Nylon, Built To Last"), and mid splits. That the existing copy already forms a
coherent field is the best evidence available that the rule reads something real.

**The field is fixed for the game.** Rivals do not rewrite. This is deliberate: a
moving field would make the effect's size impossible to isolate, and C9's
measurements are recent enough to remember what that costs.

## 6. Its size, and how we would know

**The factor's size is INVENTED and the entry will say so.** No source measures
what a message angle is worth; Google's documented +6% for image assets measures
a different thing and is not borrowed for it.

**The target, agreed with the owner:** the best angle over the worst is worth
about one good capital purchase — a median ₹38,000 to ₹1,20,000 over keeping the
money, as `page` and `capital` mode measure those today.

**The hard bound:** the best angle in the wrong square must never beat an average
angle in the right one. Position stays the biggest decision in the game.

**A new harness mode, `angle`**, plays the same account three times, once per
angle, as `writer` mode already does for the writer decision. Gates before any
run, as for every market-moving change: the market's shape, rivals' medians,
nobody going dark, the player's rank distribution, and calibration's figures
re-recorded, since they will move.

## 7. The spec change

- **9.1 `qualitySignal`** gains one factor in the product, `angleFit(ad, query)`,
  between `queryKeywordFit` and `adRelevance`.
- **A new 9.6** defines `angleFit`: how an angle is read from an ad's words, the
  three angles, and the match against `isHeadTerm`, with its constant named and
  tagged `INVENTED`.
- **8.3 `queryKeywordFit` is untouched.** It asks whether the KEYWORD matches the
  search; `angleFit` asks whether the AD's promise suits it. Related, and not the
  same question.
- **12.3** gains the second ad: what a rewrite costs, when it lands, and that it
  starts no learning period, since the ad's words are not a campaign setting.

## 8. The DECISIONS entries it needs

1. **The angle factor itself** — what it models, the INVENTED size, the
   calibration target and the measured result, and the three rejected matches
   with the tables in section 4.
2. **Where it departs from Google.** Google says an ad should "more closely match
   potential customers' search terms" and that more headlines give "more
   opportunities … to serve ads that more closely match" a query (Google Ads
   Help, *About responsive search ads*, answer 7684791, fetched 2026-09-18). It
   does **not** frame this as broad-versus-specific searches; that framing is the
   game's own, and the entry must say so. The game also collapses fifteen
   headlines into one ad with one angle, which is its own departure.
3. **The second ad** — the fee, the lag, and why exactly one rewrite.

## 9. What it refuses

- **The angle never touches who buys.** Clicks and rank only.
- **It never reads the affinities.** See 4(c).
- **No screen names the best angle.** Your ad says which angle it read and why;
  the figures say how it did.
- **No angle is offered that the writer did not write.** A hired writer's three
  ads are real copy per square; the player is choosing between written ads, not
  ticking a strategy box.

## 10. Known weaknesses, stated rather than hidden

- **The reading rule is word-based**, so a self-written ad can be read as an angle
  its author did not intend. The game shows its reading and the player can
  rewrite; this is the same honesty the landing page grader already owes.
- **Three angles over one axis is thin.** Wide, balanced and specific are points
  on a single line, not four motivations. That is what the query set supports;
  richer angles would need a new field across 151 searches, hand-written and
  hand-reviewed, which is the one artefact where a subtle flaw poisons every
  number in silence.
- **Balanced may not earn its place.** If measurement shows it is dominated
  everywhere, it should be cut rather than kept for symmetry.

## 11. Open, for the owner

- **The three angles' copy** — 18 ads, three per square, in the writers' voices.
  A content job, and the design's biggest single cost.
- **Whether the rewrite is the same writer or a new hire**, and what it costs.
- **Part 2, images**: from week 9 on Google's 60-day rule, with its documented
  +6% click-through, and the fee extending to each extra ad (section 11 of the
  round 0 design has the sources).

## 12. Where it came from

The round 0 redesign's section 11 (2026-09-14) decided the mix — angles change
who clicks, images come later — and recorded the four Google sources fetched for
images. This design was worked out with the owner on 2026-09-18: five decisions
(angles alone; pick at round 0 and rewrite once; read from the ad's words; sized
below position; rivals read from their own ads), then three rejections forced by
the measurements in section 4, which overturned the match the owner had first
chosen and the one recommended in its place.
