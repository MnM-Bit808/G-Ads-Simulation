# JOURNAL.md

What happened, in the order it happened, newest first. Split out of
`HANDOVER.md` on 2026-09-20, which had grown to 3,400 lines by keeping a
running log inside a document whose job is to be current.

## The rule this file exists to hold

**Append only. Never edit an entry.** An entry says what was true on its date
and what was believed then, and that stays true about that date whatever
happens later. When something here turns out to be wrong, the correction goes in
a NEW entry that names the old one — the way `DECISIONS.md` handles F14's
sentence being overturned by F21, marked false in place rather than rewritten
away.

**And the other half of the rule, which is `HANDOVER.md`'s:** if a sentence
would still be true in a month whatever happens, it belongs there, not here. If
it says what happened on a date, it belongs here.

## What this means for anything that points at this file

**Do not chase old cross-references into being right.** Twelve of the fourteen
references to HANDOVER's *Start here* live in `plans/`, which are themselves
dated design documents. A plan written on 2026-09-13 pointing at *Start here*
means *Start here as it stood on 2026-09-13* — which is now in this file, below.
Rewriting those pointers to aim at today's HANDOVER would make them cite
something their author never read.

## What was known to be stale when the split happened

Two things, and both are why the split happened rather than incidental to it.
They are preserved below as they were, and corrected in `HANDOVER.md`:

- **"1656 tests, all passing, 1 todo (2026-09-13)"** — it was 2,733 on the day
  of the split. The section carrying that line was called *Where we are*.
- **"This is the classic look's round 0, which `?look=classic` still draws"** —
  the classic look was deleted on 2026-09-16 in the switch-over. That section
  described a look that had not existed for four days.

Neither was wrong when written. Both were wrong for days afterwards because
nothing in a 3,400-line file makes a stale line visible.

---

## 2026-09-28: round 0 stopped being a dead end

**I59.** The Go gate, which is the reason the only person who ever sent a
playtest file never reached week 1.

`checklist`'s `keywords` item wants a keyword ADDED, not visited, and it is the
only item that can block a fresh round 0 — `square` is always true, `ad` is
valid because a writer is hired for you, `money` passes with nothing planned. A
test holds that now, so a second blocker cannot appear without the button
naming it.

**Measured on the empty step, and this is the whole thing:** the required
action was transparent, dashed, muted grey, 14px; the optional one was solid
brand red, white, 18px, weight 700. The screen drew the thing you must do in
the language of absence and the thing you need not do as the primary call to
action. Three seconds is a rational response to that.

Two halves, neither refusing anybody. At the step, the add box goes solid red
and Next goes to an outlined ghost while there is nothing there — and Next
still works, because someone looking ahead should be able to. At the end, the
blocked Go stops being disabled: it reads **"Add a keyword first"** and opens
the step that holds it. `canGo` stays the authority; the checklist only
supplies the label.

**The part worth keeping is how it was found.** I had explained this file twice
already — once that they could not find the button (measured: findable, and I
said so), once that it was lack of interest. Both times I stopped at a
plausible answer. It turned up only because I stepped through round 0 the way
their click log did, while building something else. **Findable is not usable,
and I had checked the first and called it done.**

## 2026-09-27: the first playtest file, and what it turned out to say

**Somebody finally sent one.** `playtest-2026-09-27-1620`, on `f65a3d7`. It
says the opening minute works — **114 seconds, nothing hidden, nothing idle,
all ten beats** — and that reading collapses at beat 6, from 1.2–4.1 words a
second to 9.7–13.5. It also says they never reached week 1.

**I read it wrong twice before reading it right.**

First I guessed they could not find the Go button on round 0's last step.
Measured: 343 × 52, red, in view. Wrong, and I said so.

Then I accepted the owner's reading — plain lack of interest — and started
building for appeal. **That is when I found it by accident.** Round 0's Go waits
on a checklist, and one item is `keywords: draft.keywords.length > 0`: a
keyword must be ADDED, not visited. Their file has **zero keystrokes**, **three
seconds on Your keywords**, and **five clicks in round 0, every one a tray
Next**. So they added none, and `go.disabled` was true for all 3:35 they sat on
Your money. I reproduced it exactly. **They were not bored. They could not
start.** What they had to notice was a 13px amber line in a busy tray, beside a
343 × 52 red button at `opacity: 0.45` that composites to a dark red still
reading as a button.

**The lesson is not the bug.** It is that a hypothesis I had already corrected
once ("the button was findable") was *true and not the point*. Findable is not
usable, and I had checked the first and called it done.

## 2026-09-27, and what got built: the week plays out

**I58.** The auction is the most interesting thing in this simulator and after
the opening minute you never see one again — every week is a form you submit
and a table you read. So *Run week N* now plays the week out in seven steps,
and step 4 is beat 4's ladder with the player's own numbers in it.

A clock was the first shape and the data refused it: hourly buckets carry only
clicks and conversions, days are summed away entirely, and the player has a
lever on hour and none on day. What the week DOES keep is richer — 2,45,745
auctions, 1,55,771 impressions, 34% lost to budget, the four slot counts, the
clicks, the cost, and **who has not decided yet**, which is the first run's
beat 8 arriving when it is finally true of them.

**Naming a rival was where this could have taught something false, twice.**
`positionAboveRate` reads zero both for a rival that never beat you and one you
never met, so only real overlaps are considered. And the most-MET rival is
often one you beat comfortably — week 1 met Auren 66% of the time and was
behind it in 7%, while Lumen was met half as often and was above it in 96%. It
names by the product of the two rates, which is exact.

**Found by reading it on screen:** all five figure-steps said their number
twice, once big and once in the sentence. The figure carries the number now and
the sentence carries the meaning.

## 2026-09-26, last: the bidding got two screens, and the run got a proofread

**I57.** A second tester said the bidding was the hardest thing in the run. The
ladder beat had three faults, and the first made the other two unreadable: it
called a bid **"a price it will pay"** directly above a `PAYS` column where all
four brands paid something else. ₹30 → ₹25, ₹19 → ₹17, ₹17 → ₹13, ₹16 → ₹9 —
four contradictions of its own opening sentence. A bid is a ceiling, and
everything else on that screen went wrong downstream of calling it a price.

The rule behind `PAYS` was never stated; the one explanation given covered the
runner-up and nobody else. And six columns, two of them bars, asked the reader
to check ₹30 × 0.625 > ₹16 × 1.000 by eye.

**The screen was already telling us.** Its callout was headed *"Read those two
rows again"*. A screen that asks the reader to go round again is reporting a
fault, not helping.

Split on I55's pattern: beat 4 settles the ORDER (five columns, no price, and a
callout that finally answers why the best-fitting ad is second), beat 5 settles
the PRICE (bid → pays, no bars, the rule said plainly). `cost per click` moved
to beat 5, where a click's price is actually set, leaving the click beat one
term. Ten beats, all under the 80-word bound, 451 words.

**The ratchet has now moved twice**, which is a habit forming, so the guard's
comment records both moves and what a third would have to show: a named reader
who could not follow a specific screen, and a fault on it that splitting fixes.

**Two claims on screen got tests**, because a different demonstration could
falsify either with everything else green: that the runner-up really does have
the best-fitting ad **of all six**, and that nobody shown paid their bid. The
second is why the kicker says "nobody **here**" — the engine prices at
`min(bid, …)`, so the minimum can bind and someone CAN pay their bid.

**The proofread found four punctuation errors**, the worst of which was also a
clarity bug: *"She pays cash on delivery, and doesn't take it"* — a comma on a
compound predicate, and an "it" standing for a parcel named only in the next
sentence.

## 2026-09-26, after that: the revision mark was amber, and amber was taken

**I56.** The owner played it and said the tint I52 added still felt too quiet.
Measuring it found three faults, and the third was the one worth the trip.

The **shape** was backwards: the animation decayed from 0.20 to transparent
over 900ms while `HOLD_MS` was also 900ms, so the mark peaked for one frame and
was gone the instant the revision ended — 1.49:1 at best, 1.18:1 averaged, on a
3:1 floor. A **wash** was the wrong instrument anyway: 3:1 needs alpha 0.49,
which is a brown block behind the figure, so more alpha was never the answer.

And the **colour was already spoken for on the same chart**. `--studio-amber`
is `#F2A53A`; the tint was `rgba(242, 165, 58, 0.20)`, the same colour to the
byte; and `.yw-bar.loss` is `var(--studio-amber)` a few pixels away. The mark
said *a bad week* where it meant *a corrected one*. I52's note — "amber,
because a correction is not money and not the player" — was reasoning about the
palette when it needed to reason about the picture the colour lands in.

It speaks the chart's own grey now: the ghost bar's `#7A7480` as a wash that
says which column, and a 3px rule at 4.87:1 that does the work, held for the
whole revision rather than decaying. `HOLD_MS` went to 1400ms, because a
revision can move five columns at once and 900ms is not long enough to look
along five. Reduced motion **keeps** the mark now — it used to remove it
outright, leaving the reader who most needs a landmark with none.

**Two things about the checking, both worth keeping.** Judging this needed a
PLAYED game, so one was built with the committed harness's own `harnessPlayer`
and served into `localStorage` — hand-building that player shape is the trap
CLAUDE.md already names, and it threw on the first try. And the mark appeared
to be stuck on with `.was` gone, which looked exactly like a leak: it was the
browser pane freezing transitions on a hidden page, and `getAnimations()
.forEach((a) => a.finish())` cleared it to transparent. The pane's own trap,
read correctly only because the note about it was there.

## 2026-09-26, last: the opening minute slowed down, from seven beats to nine

**I55.** A tester told the owner the explainer should explain more. The first
thing I measured was whether anything was **missing**, and nothing was — all
fifteen world terms are taught in it. The fault was pace: two beats carried
**three new terms each** (bid / ad rank / auction in fifty words; click / cost
per click / budget in fifty-four) while every other beat carried one or two.

Split into nine. The new beat 3 is the auction — nobody bought those slots, and
the question is asked again for every search — placed *before* the ladder so ad
rank has something to rank in. The new beat 6 is the budget, placed *after* the
click so a budget is met as the thing a click spends from. Every beat now
teaches two terms or fewer; `serp` keeps three deliberately, at 29 words.

**This overturned a guard written to stop it.** `toHaveLength(7)` is described
in its own test as the ratchet — *"a total bound would only be a number to
nudge upward, which is how the first one got to be wrong."* The owner's call,
done once, and the comment now records who nudged it and why. **The eighty did
not move**, and that is the guard doing the work: 299 words became 403, but the
widest screen is unchanged, because the new words are on new screens.

**Found by drawing it, not by reading it.** The budget beat started as a
spent-against-budget bar. At ₹25 of ₹42,000 the fill was **three pixels of
762** — correct, and a blank track. A proportion is the wrong picture when the
proportion is 0.06%. It reads *1,671 clicks at ₹25, then nothing shows* now:
the same arithmetic, and the thing a budget actually means to someone who has
never had one.

## 2026-09-26, later: the opening minute stopped being a one-off

**I54.** The owner asked why the explainer that teaches what Google Ads *is*
plays once and then can never be found again. It was worse than
once-per-browser: the block sat inside `if (!game)`, so it could only ever
have appeared before a game existed. **The one screen that says what the whole
game is about was the only one a player could not go back to** — and a beginner
loses the thread in week 4, not at the door.

Three ways in now, all quiet: the door, the Guide page above the chapters, and
the guide drawer, which is round 0's only route into the guide.

**Two faults found by clicking it, neither visible in the code.** From the
door, finishing the intro dropped you into round 0 — the save was untouched but
the offer to resume was gone. And the page went blank on the way out of the
Guide's copy: `replayFirstRun` is passed straight to `addEventListener`, so its
argument arrived as a **MouseEvent** — truthy, not callable. A handler is handed
an event, and a parameter with a default is exactly where that hides.

## 2026-09-26: a tablet, and three fixes that had only ever been phone-shaped

**I53.** Played end to end at 768x1024 — the band where the shell's ≤900px
rules apply and the ≤560px ones do not. Three findings, and **every one was a
general defect that a phone-shaped fix had hidden**:

- the planner's 480px drawer left the keyword 165px, and **eight of the forty**
  terms need 167 to 174, so they ellipsised at every width **including
  desktop**;
- a tier's places were nowrap everywhere but a phone, so a tablet read
  *"12 · Guwa…"*, 73 pixels of 264 — and under it, the tier's name took 215px
  of a 297px cell, leaving the places six wrapped lines;
- the quiz cells stayed 26x20, because I51 grew them below 560px.

**A tablet is a finger at 768px and a small desktop window is a mouse at
768px.** Only `pointer: coarse` asks which, so that is the rule now, with the
width arm kept because the browser pane emulates a size but not a touch screen
— at a custom 768 it reports `maxTouchPoints: 0`, which is precisely how this
was missed.

**The pattern is worth more than the three bugs.** Each was found on a phone,
fixed with a phone-shaped rule, and left broken everywhere else. A keyword
needs room for its longest term, a tier needs room for its places, a target
needs room for whatever is touching it — and none of those three is a screen
width.

## 2026-09-25, actually last: played it on a phone, end to end

**I51.** The whole route at 375px on the live build — door, round 0's five
steps, twelve weeks, the week-5 capital decision made and committed, every
section, the guide drawer, all four Results sections. **It plays.** Two things
it could not do well.

**The keyword planner was unreadable**: its row left the keyword name 70px
against the 95-134 its text wants, so every one ellipsised to "cheap g...".
Reading a keyword is the whole of what that drawer does. It folds now, the way
What people typed already did.

**And a handful of controls were 13 to 21px tall** against WCAG's 24x24,
including the forty-eight cells of the Where they sat quiz. The ink stays the
size it was; a transparent pseudo-element grows the hit area, because `why?`
sits inline in a figure's label and padding there would re-space the number
above it on every screen in the game. The quiz cells grow outright, and only on
a phone — on a desktop they are a diagram, and being small is the point.

**Two things measurement stopped me reporting as defects.** A tap on a quiz
cell looked inert; it had worked, and my check had re-queried a re-rendered
list and looked for the wrong class. And several screenshots looked cut off at
the right, which was the browser pane rendering at 2x. **A screenshot from that
pane is evidence of how something looks, never of how wide it is** — that one
has now cost me two wrong readings in a day, the other being `.rs-chart`.

## 2026-09-25, the last thing: the tray stopped pushing the page

**I50.** On a 375px phone the document scrolled to 467px on every Results
section. One cause: `.studio-tray` is a nowrap flex row and a finished game
puts two `flex-shrink: 0` buttons in it wanting 420px. Below 560px every tray
wraps now, the way the deadline tray already did — the same rule made general.

**And it corrected I47, which had reported two causes.** `.rs-chart` was named
as the second and was never one: it is 640px inside a 313px `overflow-x: auto`
scroller, which is the design, and the page never moved because of it. The bad
check compared every element against its SECTION's right edge rather than
asking whether an ancestor scrolls. **The only measurement that answers the
question is `document.documentElement.scrollWidth > clientWidth`** — anything
narrower reports a working chart as a defect, which is how a correct piece of
design spent an afternoon listed as broken.

## 2026-09-25, after that: the figure and the meter became components

**I49, the step I48 scoped and left.** The figure — a label, the number, the
quieter line — moved into `ui/kit/figure.js`, and the thin meter into
`ui/kit/meter.js`. Bar and track classes went 20 to 17, figure and label
classes 29 to 17, and sections importing from the kit 4 of 9 to 8 of 9.
Twenty-eight dead rules came out of the stylesheet.

**The interesting decisions were about what NOT to fold in.** Three classes
share the word "track" and are different objects: the books' two stacked bars,
Where and when's drag target, and the bid slider's rail. Where and when's
figure is inline and reversed — the number then the word, on one baseline in a
table row. Forcing those together would have been worse than the duplication,
and saying so is most of what the entry is for.

**A tie broken on role rather than taste.** Two sections labelled figures in
sentence case and two in uppercase. The uppercase micro is also the table
column-heading style, and one style meaning two things is exactly what let a
read-only answer wear a text input's border the same afternoon. So uppercase
marks a column; sentence case labels a figure.

**The thing that nearly got erased:** Your money tints its rungs three ways —
the field, the average, and you — and a single-colour meter would have taken
the two that carry meaning. The kit gives the shape; the section keeps the
tint, and all three are unchanged to the byte.

**Played from week 4 to the end** to see all four migrated sections, including
Results' loss still reading −₹17,690 in amber with a minus sign.

## 2026-09-25, last of the day: the Studio got one scale

**I48.** "Make it look more sophisticated" turned out to be measurable, and the
measurement said something more useful than a visual brief would have: there is
one design system here, implemented between five and nine times. Ten card
classes, four of them byte-identical and the rest differing only in padding.
**Twenty-five distinct font sizes**, seven used once or twice. The big figure
over a label at **24, 26, 28 and 30** — one object, five sections, four sizes.
Display headings at three line-heights for the same size.

**So the pass was consolidation, not decoration**, and that is worth saying
because the request could easily have been answered with gradients.

**Two steps, and the first was proved to change nothing** by resolving every
touched class in the browser against a probe carrying the old declarations.
That check earned its keep twice in ten minutes: writing the micro-label token
as a `font` shorthand also set line-height, which those rules had always
inherited, taking every label from a 16.5px line box to 13.2px — a redesign
wearing a refactor's clothes. And the fix's own comment was then pasted outside
its comment block, silently killing every declaration after it. Neither was
visible by looking; both were obvious by measuring.

**One change in the pass is taste and is labelled as such:** the card corner
20px → 16px and the gap 10px → 12px, chosen by the owner off the drawing. The
radius was already consistent, so that one is not a drift being removed.

**Two defects fell out of the audit.** `.rs-answer` was two different
components under one name — a read-only answer `div` and the playtest
`textarea` — so the answer was drawn with the input's border, radius and dark
fill. And `.fr-lede` was two adjacent rules, the second overriding the first,
whose `font-size` had been dead the whole time and was still dead after the
scale pass rewrote it.

**Left undone on purpose:** twenty bar tracks and twenty-nine figure classes
are still twenty and twenty-nine. That is the components step, which touches
all nine sections and needs each replayed.

## 2026-09-25, after the push: Everyone's books stopped being a paragraph

**I47, and the option was chosen off a drawing rather than a description.**
Three ways were built with real figures from a game played to week 12 on the
build of the day — `design/everyones-books/Options.html` — and the owner took
B: the ranking stays a table, the six figures that were a run-on sentence open
under the row, and your own row opens by itself.

**The finding that mattered came from playing it, again.** `.rs-track`, the
bar whose gap is what returns took, was hidden under a 900px section. Measured
in the browser: the Studio's rail and padding put the section at **886px on a
1280px laptop**, so the one picture in the section was `display: none` for
anyone under about 1295px, and the page fell back to seven columns of numbers
with a gap where the picture belonged. Nothing in the suite could see it,
because nothing in this project renders — every UI test reads source as text.
It is now the third column rather than the last thing before the numbers, and
on a phone it takes a line of its own instead of being dropped.

**A thing left deliberately alone.** The fractional order counts (*1,482.6
conversions*) look like a bug and are not: expected mode makes a sale a
fraction, and Twelve weeks formats the same figure the same way. Changing it
here alone would have made two screens disagree. Recorded in I47 so it is not
re-found as a defect.

**And one found in passing, left alone as out of scope:** at 375px the page
scrolls sideways — the shell's end-of-game footer on the books, `.rs-chart` on
Twelve weeks. Both predate this.

## 2026-09-25, last: four characters got the lever they had never been handed

**I46, and the gates were agreed before anything was measured**, which is the
only reason the result means anything. Eight of eight rivals now discount, ₹50
from week 3, against two of eight before.

**Every gate passed**, 72 whole games either side: no rival dark, median rank
still 5, losing money in 0 of 72, the player's own ₹50 lever unmoved
(2.6/3.4/2.7/2.8/1.1/1.4% against 2.6/3.4/2.7/2.9/1.1/1.4%), D12's week-9 move
3.97× against a gate of double, cast spread 8.21× → 7.99×. Taken by character
the shape is right: the four that gained the lever each gain, `spender` most at
+2.6%, and the two that already had it dip slightly because their rivals got
stronger.

**Two things recorded rather than hidden**, because neither failed a gate and
both are true: the rank tail worsened — eighth place in 2 games of 72, from 0 —
and the lever is now uniform, all eight landing on ₹50 because all eight clear
12% and there are only two rungs. Where two of eight used to be distinguishable
by it, none is. The rung table is the thing to change if that matters.

**The test was checked against the old code before it was believed.** It names
six silent rivals starting with `Kestrel (spender)` when run without the fix.
Every unit test of `prepaidNudge` passed throughout this, before and after,
because the helper was never the broken part — which is the whole argument for
testing a rival rule in play.

**A stale figure fell out of it.** HANDOVER gave the player's prepaid lever as
"+1.7% to +4.7% of final profit"; on today's market it was already +1.1% to
+3.4% before this change, the quoted range predating F17 and C9. `ui/chart.js`
and `ui/words/market.js` carried 3.53× for D12's week-9 move in their headers
and it measured 3.78× before the change. Comments, not sentences — the screens
carry live figures — but corrected.

## 2026-09-25, later still: the offer went into the public view

**The decision the entry below left for the owner was taken the same day.**
Route A: `prepaidDiscountPaise` joins `getPublicView`, recorded as `I45`. The
rule it was admitted under is the one to apply next time — *is it something the
advertiser tells customers, or something it tells Google?* An offer exists to
be seen, so a competitor reads it by looking.

**The claim that it moves nothing was measured, not argued.** Adding a field
to a view is the kind of change that looks obviously inert and is not:
`agents/hash.js` exists, and anything hashing or serialising the view would
have shifted every seeded draw in the game. It does not — the hashes are of ad
copy and keyword text — but the proof is two `market` runs of 72 whole games
each, before and after, identical by MD5 (`d7c076f4…`). The cost of the route
is real and is recorded instead of hidden: every rival controller can now read
what its rivals offer, and the first policy that does is making a
market-moving change that needs its own gates.

**And it draws.** Played into week 5 in the browser: Nira and Halcyon carry
"₹50 off when you pay online." at the end of their ad copy, the other four
carry nothing, and those are exactly the two the harness named. The version
that drew nothing had a green suite; this one was looked at.

**Still open, and asked for:** four of six characters never consider the lever
at all, while every rival sits above the line that buys it. Gates first.

## 2026-09-25, later: the rivals' discount, and a test that proved nothing

**Asked to show the player that rivals discount, and found three things, only
the first of which was the job.**

**One: the documentation was a fix behind.** `HANDOVER.md` said "no rival has
ever pulled it (I34, open)". That has been false since the C9 fix. Measured on
the committed harness, two of eight rivals offer ₹50, live from week 3, in
every seed tried — 20260901, 20260902, 7 and 12, the same two brands and the
same rung each time. The first measurement said 0 of 8 and said it
confidently, because it called `submitRound` where the harness calls
`playRound(state, controllers, {mode: 'expected'})`; nobody acted, and a
market where nobody acts reports no discounts. Fourth throwaway harness in
this project to measure a market that was not being played. The rule about
using `scripts/market-harness.js` exists for exactly this and was not followed
until the answer looked wrong.

**Two: the lever is offered to two characters of six.** `prepaidNudge` is a
shared helper, but only `disciplinedAccount` and `grossOptimiserAccount` call
it; `spender`, `cautious`, `automator` and `brandDefender` never do, and
`withCapital` adds only capex. On the last played week of seed 20260901 all
eight rivals sit between 12.2% and 18.6% weighted refusal, against a 12% line
that buys ₹50 — so the four silent characters are not declining the lever on
their own numbers, they were never handed it. Recorded open rather than
fixed: six rivals taking a +1.7% to +4.7% profit lever moves the market, and
that needs gates agreed first. It is also not clearly a character choice,
since every deliberate omission in `agents/policies.js` is documented in its
policy's header and none of the four mentions prepaid, and the cast's own
standard is that each character is wrong about one thing **legibly**, while a
rival's refusal rate appears on no screen.

**Three: the feature was built, committed, and drew nothing.** The card read
`who.campaign.prepaidDiscountPaise`; `ui/dashboard.js` hands the section
`view.advertisers`, and `getPublicView` builds a rival as
`{id, name, domain, ads}`. There is no `campaign`, so `?? 0` turned a missing
shape into a confident "no offer" — in every game, for every rival. The suite
was green because the new test spread a `campaign` onto this file's fixture,
which is otherwise the public view's four keys on purpose. Same shape as the
three rival rules that read `report` for returns and read zero for months.
Green tests, and the browser showed Nira and Halcyon with their ordinary ad
copy and nothing else.

Found by opening the page, which is the only reason it was found. Backed out
in the same session; `c070a50` is the commit that did not work. What replaced
it is a guard — `the shape a card is really handed` in `tests/rivals.test.js`
— that locks the fixture to `getPublicView`, so the next field a card wants
off a rival fails there instead of reading `undefined`.

**And the reason it cannot simply be wired up** is a decision nobody has
taken. `prepaidDiscountPaise` is not in `FORBIDDEN_IN_PUBLIC_VIEW`, but the
view is a whitelist, so that grants nothing. Either the field joins the public
view — defensible, because everything the blacklist withholds is genuinely
private operating data while a retail discount is advertised to customers, but
it hands the field to every rival controller too and so is a 16.1 change — or
the offer goes into the rival's own ad copy when the policy sets it, which
needs no R3 change because ads are already public, but means a decision can
carry creative, which today it cannot. Left for the owner.

## 2026-09-25: round 0 got a budget, and the preview aliases would not die

**The density pass merged and went live** as `f184a91`, tagged `playtest-8`.
Seven commits over two days, from `plans/2026-09-24-density-and-polish.md`.
Round 0 had gone from 781 rendered words to 1,675 in the ten days to the 24th
because nothing was holding it; the first run had been bounded to 80 words a
beat since it was built. Step 1 is now 342 rendered, step 2 299 against 612,
step 5 271 against 353, and step 2 shows one rival ad instead of eight.

**Four guards exist now that did not**, and they matter more than the counts,
because the counts drift back without them: a 150-word per-step budget set on
evidence, `adStage` holding step 2 to one ad, step 1's city names held behind
the tap, and step 1's three kinds of box held apart.

**Three defects came out of the work that were not about density.** "Tap a
place to name its cities" was false — every row named them from the moment the
step drew, so the step's only interactive thing did nothing visible, and the
2026-09-14 design had measured its own intent rather than the code. Two of step
1's card treatments were byte-identical, so nothing on the screen read as more
important than anything else. And `hiredNote` and `diyNote` ended with the same
sixteen-word sentence, which `twoParts` and `lpNote` each said again.

**Two findings in that design were withdrawn as not real**, and the second is
the one worth remembering. A rail contrast "failure" at 3.47:1 turned out to be
`.studio-area:disabled`, which the owner tuned deliberately on 2026-09-14 and a
test already holds at both ends. And a map called "small, dim, decorative" is
560×585 and reads well — **described from its top edge in a screenshot cropped
at 500px**. A screenshot is not the screen, which this file's own handover had
already said.

**THE PREVIEW ALIASES SURVIVED EVERYTHING, and that is the finding to keep.**
`polish` was merged and deleted; `makeover` had been deleted on the 20th. Then
Preview URLs was turned off in the Worker's settings, with no branches left in
the repository at all. Both aliases went on answering `200`, each still serving
its own old build — `7913880` and `e312519` — through thirteen checks over six
minutes. Not propagation delay. Production was unaffected throughout.

So: deleting the branch does not remove the alias, the alias is not in the
Deployments tab, Cloudflare documents no way to delete one, and disabling the
feature appears to stop new ones without withdrawing old ones. **There may be
no way to take an issued alias down.** Parked a second time on the same
reasoning as the first: the site is public anyway, and the only real cost needs
somebody to send a tester that link.

**And the thing none of it touched.** Five testers had the link for seven days
and returned nothing. Every measurement behind every commit above is of the
artefact; nobody has watched a person use any of it. The merge commit says so
and `playtest-8`'s tag message ends on it.

---

## 2026-09-20, later: the sign-in came off, and four documents were wrong about it

**The Cloudflare Access application was deleted by the owner**, closing item 0.1
of the critical-review programme. The site is open to anyone with the link. It
was invite-only from 2026-09-12.

**It was reported done once before and was not.** On an earlier attempt the
owner said the sign-in page was gone; `curl` showed all five paths still
answering `302`. The cause was the check, not the change: a private window
reports "open" for a signed-in browser, because Chrome shares one session across
private tabs and an Access session lasts 24 hours. **The check that works is
`curl` from outside**, and it is now written into HANDOVER beside the record.

**What the deletion actually had to be.** Deleting the *Playtesters policy*
alone would have left an application with no Allow rule, which denies everyone
— stricter, not looser, and from outside indistinguishable from the gate still
being on. The application itself was deleted.

**Four documents claimed the site was invite-only**, in ten passages: `HANDOVER.md`
(the *Still open* opener, the deployment note, the *Deployment* heading, the
whole *Invite-only* section, the download-versus-link argument, the playtest
steps, the invite's preamble and its step 2, the preview claim, and "tell
playtesters two things"), `CLAUDE.md`, `scripts/build-site.js`'s *WHAT IT DOES
NOT HIDE* comment, and `plans/next-session-prompt.md`. All corrected.
`JOURNAL.md` and `reviews/slc-review.md` were left alone on purpose: they are
records of a moment and true as written.

**The comment in `build-site.js` was the one worth catching.** It explained why
shipping the query affinities to the browser was acceptable — *"The site is
behind Cloudflare Access, so strangers get a sign-in page and none of it"* — and
its reason had just evaporated. A stale comment that still reads as a live
justification is worse than a stale line in a document.

**Two things were found that nobody had planned for.**

**Branch previews are public, and they outlive the branch.** Every branch gets
one at `<branch>-g-ads-simulation.manikhorocks.workers.dev`, covered by the same
"All traffic" scope and so opened by the same deletion. `origin/makeover` was
serving `e312519`, a build from 2026-09-16, at a guessable address — a second
playable copy of the game, four days and roughly a hundred commits stale. The
branch was deleted (zero commits not in `main`; the annotated tag `playtest-3`
points at that commit, so the build is preserved). **The preview went on
answering `200` afterwards.** Deleting the branch does not delete the
deployment; that is a dashboard job, and it is now written down.

**A `200` on a preview means something only against a control.** A subdomain
with no deployment answers `404`, which is what makes the preview's `200` proof
rather than an assumption. The two builds' `ui/version.js` stamps differed
(`2b4f414` against `e312519`), which is the same check done a second way.

**And one near-miss worth recording.** Before deleting the branch, `git rev-parse
--short playtest-3` printed `c99a0fd`, not the `e312519` the branch stood at —
which looked like the tag not covering the build about to be deleted. It was an
annotated tag: `c99a0fd` is the tag object, `playtest-3^{commit}` is `e312519`.
**`rev-parse` on an annotated tag does not give you the commit.** The deletion
was held until that resolved, which was right — the alternative was a confident
deletion on a misread.

**Phases 4 and 5 were marked done in the programme file**, four days of work
that had landed without being ticked. The programme document had itself drifted
while being used to prevent drift.

---

**Current state, 2026-09-19: the beginner's build is LIVE, PLAYED END TO END,
and the freeze is over.** `main` is `14d0c05`, pushed at the owner's word.
Two strangers played the old build and neither finished — one gave up
inside round 0, the other stopped around week 6 — and today's work is everything
that came out of what they said. Neither sent a playtest file; every measurement
below was taken on the code and the engine.

**What they said, and what was measured.** The owner's quote of one of them:
*"for someone who is new to this, these all seem too text heavy and working
around concepts that they are not at all familiar with. And even if the
explanation is there, the explanation is not good enough and not simple
enough."* Measured against the code, three things were true:

- round 0 had already been cut from **2,648 words to 781** and a stranger still
  gave up inside it, so cutting further was never the remedy;
- the guide had **no ground floor** — thirteen chapters, every one a nuance of
  something you are assumed to know, and none defining keyword, bid, CPC,
  auction, ad rank, click, conversion or the price × purpose grid;
- and it was **unreachable** where it was needed: 134 pieces of text in round 0
  carried six `why?` links.

**The four pieces built today**, in the order they were built, each designed with
the owner before any code:

| | what | design |
|---|---|---|
| the first run | seven beats before round 0, on **one real auction the engine ran**, teaching the world's vocabulary as a story | `plans/2026-09-19-first-run-and-ground-floor.md` §4, `plans/2026-09-19-first-run-plan.md` |
| the guide rewrite | `departs` is a field, **25 of them pulled out of the prose** where 8 were labelled; every half opens in ≤15 words and no sentence runs past 25 | `plans/2026-09-19-guide-rewrite.md`, `-plan.md` |
| the ground floor | **nine chapters**, one per control round 0 asks for, each naming the nuance chapter that continues it | `plans/2026-09-19-ground-floor.md`, `-plan.md` |
| the mid-game questions | pressing Playtest anywhere now **asks what the game taught you** before handing over the file | §7 of the parent doc |

**THE ONE THING STILL OPEN, and it is the owner's:** whether the nine
ground-floor chapters and the rewritten thirteen actually read better. The rules
bought structure, and structure is not understanding; no test can say. Both
plans leave that step unticked on purpose.

**Five guards caught real mistakes today**, which is worth knowing before
trusting a green suite:

- `tests/ui.test.js` refused `businessFor` in the interface — it derives what
  spec 16.1 withholds from every viewer;
- the drawing guard refused a hand-written SVG string, and `no number is typed
  into a sentence` refused "7:40 pm";
- an existing test held the returns chapter to giving the send-back rate as **the
  country's**, which a rewrite had dropped;
- and twice, **only playing it found the fault**: the contents page still
  promised "two halves" of every chapter, and twelve `why?` links were added to
  round 0's words while step 1 drew none — the test counted the data, not the
  buttons. Both tests now read the drawing.

**Then it was played, from a cleared browser, and five more faults fell out.**
The first run, all five round 0 steps, weeks 1 to 6, the guide, Returns and the
playtest panel — no help, as a beginner would. `f7f7500` beat 5 gave away beat
6's twist; `fcaf261` beat 7's button named a screen it did not open; `046f834`
**"Pick your square" was still there** — the one item on the owner's own list of
five specifics that never got built, now "Brand positioning" with the term
defined once in the chapter its `why?` opens; `bb98ada` step 4 drew two
identical `why?` buttons side by side onto different chapters; `14d0c05` beat 7
promised a `why?` beside every word it had taught, and the first screen after
round 0 carries two, beside none of impressions, clicks, cost per click or
conversions.

**What playing PROVED, which no test had:** at week 3 the dashboard said week 2
rose as conversions landed and week 1 fell as returns came back — beats 5 and 6
of the first run, arriving in the game. Pressing Playtest at week 1 asks the two
questions, so the instrument's hole is shut in play. Search terms correctly
flagged a ₹5,119-per-sale query against a ₹386 average, on fractional sales.

**Then the guide gained its twenty-third chapter** (`b30a3f3`). Adding the
`why?` links the playthrough asked for turned up a bigger hole: **net profit,
return on ad spend and cost per conversion were defined in none of the other
twenty-two** — they appeared only as the names of Google's bidding strategies.
Three of the six figures a player reads twelve times had no chapter at all.
*What your week's figures mean* is that chapter, and it opens GOING DEEPER,
because what the figures ARE comes before why they move. All six figures now
carry a `why?`.

**Read this before touching that chapter.** Its first draft said Google cannot
report profit. It can — "About conversion values" gives *"sales revenue or
profit margins"* as Google's own examples of what to report — and the claim was
caught only by fetching the source instead of trusting memory. The true
difference is narrower and is in the block: here you do not choose what a
conversion is worth, and nobody uploads the return. A test holds the chapter to
not making the false claim again.

**A SECOND PLAYTHROUGH WENT ALL THE WAY TO RESULTS** (`07204ca`), the first
time anyone has. Two more defects, both from width and from finishing last —
neither reachable by reading the code:

- `9cf288f` **the ladder dropped the column its own lesson rests on.** Below
  720px the stylesheet hid "ad fits", so beat 3 — the run's centre — said
  Halcyon outranks a bigger bid *because its ad fits better* with nothing on
  screen showing that it does. The bar a phone drops is now RANK: rank is bid
  times fit, and the place number already says where each brand came. At 375px
  the page, board and beat each kept their desktop side padding, so 136px of a
  375px screen was margin and the brand column came out 17px wide with every
  name clipped.
- `07204ca` **the books handed the player their own figure as a comparison.**
  From 9th of nine: "9th gave you ₹1,17,600, where the middle place got
  ₹1,68,000, first ₹2,18,400 and last ₹1,17,600". A beginner who changes
  nothing finishes last, so this is the common case, not the edge.

**WEEK 5 NOW SAYS SO, beside the button that would pass it** (`d0c3707`, the
owner's call). `capexAllocationRounds` is `[1, 5]` and `canReposition` is true
at round 5 alone, so that week carries the last ₹1,20,000 and the only chance
to move. The signals existed — a rail dot AND a "Capital: nothing committed"
chip in the tray — and pressing "Run week N" each time missed both, because a
chip in a strip headed "1 change waiting" reads as something already done.

**IT ASKS; IT DOES NOT REFUSE.** Uncommitted capital becoming ad budget is
deliberate (13.3, so not investing stays viable), so skipping is a real choice
and only the *move* is truly gone. The tray carries an amber line while the
window is open, and Run asks once — but ONLY when nothing is staged against
either half AND Your money was never opened that week, which the
`money:window:<week>` key already knows. Look and decide to skip and you are
never interrupted.

`capitalWindow` (`ui/shell/tray.js`) is pure, so the three inputs and three
halves are tested without a browser, and the tray says which halves are
actually open rather than assuming both. Measured: amber 9.08:1, the question
13.83:1; one 76px row at 1400px, 133px at 375px where sharing the row made it
280px.

**THE LANDING PAGE GRADE WAS BROKEN, and the owner found it by playing**
(`3cb1739`, DECISIONS I40). Round 0's capital graded the page 10/10 from week 4
off ONE purchase, and a size guide bought beside it moved nothing. Five points
are buyable above the base of 5; the top rung of the page ladder alone took all
five — speed and reviews as sentences, plus the whole `landingPageBonus` — so
every combination above it computed 11 against a cap of 10 and always discarded
the size guide's point. `CAPEX_LANDING_PAGE_MAX_POINTS` 3 to 2 closes it
exactly: 5 + 3 + 2 = 10, nothing overflows, and 10 now needs two targets.
Measured over 72 markets each way; only page purchases move.

**TWO THINGS THE LEDGER HAD SLIGHTLY WRONG, both corrected in I40:**

- **I38 says rivals' grades do not move.** True of the description grade only.
  `buildEntryPlans` applies the bonus to EVERY advertiser (`engine/round.js`),
  so a rival holding capital on its page is regraded too. Largest rival median
  move from this change: -2.89%.
- **I29's property is dead, and its test was green on a fiction** (`7afbec0`).
  "The best page no longer costs you photography" was asserted by iterating
  photography over the SHARED rungs; I30 gave it its own ladder in September,
  so the test offered a Rs 25,000 purchase `featureAt` resolves to "none". On
  the real ladder the property is false, and was false before today's change.
  **OPEN for the owner** — raise the allocation, or accept the trade came back —
  and carried as a `test.todo` rather than decided.

**THE DRAWN PAGE NOW SHOWS NINE RUNGS, not two** (`7a69c8a`). Reviews drew
stars and a size chart drew bars; the other ten rungs drew nothing, photography
worst of all — the dearest ladder in the game, up to Rs 1,60,000, with a picture
that never changed. `DRAWN_RUNGS` now carries three rungs per page ladder, and
a test holds every label to being a rung its ladder really has.

- **`faster` reads backwards, and that is the point.** Every other rung ADDS a
  picture; this one says the page is finished, so a page below it draws as the
  placeholders a visitor waits in front of. The first Rs 25,000 of page money is
  what paints it, where it used to buy a sentence and no picture.
- **The dearer size-guide rungs REPLACE the one below**, rather than stack: a
  real page does not carry a bar chart and a table of the same sizes.
- **Order confirmation still draws nothing, and a test holds it there** (I29).
  If it ever appears on the page it has found a second route into quality score.
- **`pageArrived` rings what landed this week** — the difference between this
  week's pictures and last week's, pure, because capital lands by going live and
  nothing records "this landed today".

**PLAYED AGAIN ON THE BIGGER ROUND, AND THE WRAPPER BROKE AN OLDER RULE**
(`fa8ee66`). Below 900px the hero gives the garment a 96px column and shrinks
the svg to match — written when the picture WAS the svg. The wrapper the
nine-rung page added carried a hard 124px, ignored that rule, overflowed its
track by 28px and covered the first word of the product title. **Every rect I
compared first was the TAG against the title, and those did not overlap;**
`elementFromPoint` at the title's left edge is what named the garment box.
Measuring the thing you suspect is not the same as asking what is actually
there.

**PLAYED STRAIGHT AFTER IT WAS BUILT, AND THE PICTURE WAS WRONG THEN TOO**
(`3297bbc`). The
garment's svg paints its own dark rectangle across the whole viewBox, so
`product shots` lit the box BEHIND that plate: the rung whose entire job is
putting the garment on white changed almost nothing. **The DOM was right the
whole time** — the class read `yad-shot lit`, and the tests passed. Only the
screenshot showed it. The plate is optional now and the lit garment drops it.
The arrival tag also landed 1px on the product title, measured, and now sits on
its row rather than above it (`b6c5396`). **A green DOM check is not a picture:
for anything drawn, look at it.**

**THE CAPITAL ROUND IS ₹1,50,000 NOW, and I29's trade is alive again**
(`cfdd584`, DECISIONS I41). Measured, the property flips at exactly ₹1,30,000 —
the cheapest route to the best page grade is ₹80,000 and photography's first
rung is ₹50,000 — and does not widen again until ₹1,60,000. ₹1,50,000 clears
that cliff with ₹20,000 of slack, so a later price change on either ladder
cannot kill it silently the way I30's did.

**IT MAKES ALMOST EVERYONE SLIGHTLY POORER, and the reason is worth knowing
before anything else touches this number.** A rival's investment is capped by
its ceilings, so a bigger allocation spills further into its AD BUDGET —
rivals' median month-2 budget rose ₹60,000 against the player's ₹30,000. The
market is richer and therefore dearer: player CPC ₹12.0 to ₹12.3, median final
profit −0.5% to −2.8% depending on what was bought. Median rank is unchanged
at 5 and nobody loses money in any of 72 markets either way. **The shape is
right even though the level fell:** keeping the money got relatively worse
(−2.8%) than spending it (−0.5% to +0.8%), and the two that gained put it on
the ladder tall enough to absorb it.

**Three tests were resting on arithmetic that only held at ₹1,20,000** and are
now written against the ladders instead — two allocations pinned to three shared
top rungs, the best grade pinned to 66% of a round, and the S-curve's
spread-versus-commit, which past the curve's ₹80,000 top compared against a
spend whose tail bought nothing. **A number is easier to change when its tests
read the thing rather than the figure.**

**THE TWENTY-THREE CHAPTERS HAVE BEEN READ END TO END** (2026-09-19, `729a2d8`),
which is the step both plans left unticked. Twenty-one read cleanly. What came
out of reading them:

- **`69c8a7e` "Your landing page" was filed under step 4 while its own last
  sentence said step 5**, and step 5 was right: the only why? that opens it is
  on step 5's "Landing page grade", and step 5 is where the capital that builds
  the page is spent. The contents page was sending a beginner to a step where
  they could neither act on it nor find the chapter. A test now refuses any
  ground-floor chapter whose prose names a step other than its own.
- **`729a2d8` two chapters rewritten.** Broad match carried a sentence nobody
  could parse — "enough of the concept tags the two were given from their words
  are shared", three possessives nested inside one another, in the chapter
  explaining the one match type a beginner cannot predict. Quality Score was the
  densest half in the book, 101 words carrying eleven ideas, in the chapter
  whose whole job is correcting the belief that the score is an auction input;
  it is 86 words and six sentences now, one idea each.

**WHAT WAS DELIBERATELY DROPPED from Quality Score:** that the landing page part
reads above average only rarely. True, but an observation about this market
rather than about what the score IS, and the least load-bearing of the eleven.
Nothing dropped was false; there was simply too much of it.

**AND THE LIST THEY SIT IN WAS SQUASHING THEM** (`efc6879`, the owner looking at
it). Twenty of the twenty-five rows in the Guide area's left-hand list printed
over one another. The rule that grows a chapter row was already correct; the
PARENT beat it — `.studio-list` is a column flex container, so once its rows did
not fit it SHRANK them, `min-height` held them at 42px, and every wrapped title
spilled onto the row below. **When a child's size rule looks right and the box
is still wrong, suspect the flex parent.**

**A FINISHED GAME HAS A WAY OUT NOW** (`c4d6a10`, the owner: "all I can see is
'see your results'"). After the last week the tray offered that and nothing
else, and **no screen in the game led back to the front door at any point** —
the only exit at all was the Play again card on the FOURTH Results section,
which throws the game away. The tray carries "Back to the menu" beside it now.

**THE DESTINATION WAS ALREADY BUILT AND UNREACHABLE.** `ui/door/` has had a
finished-game state since the switch-over — "A finished game / 12 of 12 weeks
played", offering "Back to the results" or a warned fresh start — and nothing
could get to it. This was the door handle, not the door. **Worth a look around
for others: a state with words written for it and no route in.**

It is drawn only when the game is over, and hidden during a bulk edit or a
running week: during a game the tray's one button runs the week, and an exit
beside it is something a beginner presses by mistake. **There is still no way
back to the menu MID-game** (the owner's call, end-only); if that is ever
wanted it belongs in the rail, not beside Run.

**STILL NOT ANSWERED, AND NO TEST CAN:** whether a beginner UNDERSTANDS them.
Length, sentence count and nesting are measured; comprehension is not. That is
the last thing standing between here and `playtest-5`.

**Next, none blocking:** the message project's part 2 (images from week 9);
whether sixty keywords want a compact list.

**`playtest-5` IS TAGGED: `a7266a2`, pushed 2026-09-19.** Its annotation lists
what changed since `playtest-4` — `git show playtest-5`. **The next tag is
`playtest-6`**, and a pushed playtest tag is never moved. Read *Running a
playtest* below before sending an invite.

**A RETURNED FILE WILL SAY `54b2769`, NOT `playtest-5`, AND THAT IS THE SAME
BUILD.** Verified live 2026-09-19: the site serves `54b2769`, which is the tag
plus one commit touching `HANDOVER.md` and nothing else —
`git diff --stat playtest-5 54b2769` is one documentation file, zero files the
game loads. So a file stamped `54b2769` is a `playtest-5` file.

**AND THERE IS NO VERSION ON SCREEN TO CHECK.** `GAME_VERSION` is imported only
by `ui/recorder.js`, for the playtest file. To see what is live, open
`/ui/version.js` on the site directly — one line, and Cloudflare Access lets an
invited browser through. The invite already tells a tester who gives up to press
Playtest; they will now be asked the two questions before the file is handed
over, wherever they stopped.

**Current state, 2026-09-16: the Studio is LIVE, and it is the only game.** The
switch-over is deployed — `main` is `e29648f`, 194 commits ahead of where it
stood this morning, pushed at the owner's word. There is no other look and no
`?look=` to reach one with: the classic page, its round 0, its end screen and
the 6,153 lines behind them are deleted, and the tag `classic-last` is the last
commit where they run. The owner put the stranger playtests on hold for a
visual makeover.
Their own sessions with two other people kept raising the same complaints: too
much to read, fiddly click-and-edit controls, and a static look. "It needs to
feel alive." Round 0 went first, after the owner opened it in the new look and
called it horrid, and they then played its five new steps and said "it feels
alive". The weekly *Your keywords* followed, the makeover pilot's own section;
the owner played it on 2026-09-15 and said "Alive".

- **The live site runs `main`**: Cloudflare deploys each push to it that
  passes `npm run ci`. Since 2026-09-16 that is the Studio, F17 included —
  `main` and `makeover` are the same commit, `e29648f`. Four tags mark what came
  before: `playtest-1` and `playtest-2` are the versions the two playtests were
  played on, `live-before-studio` (`760a6b1`) is the last classic version the
  site served, and `classic-last` (`b7f6726`) is the last commit the classic
  look runs on at all.
- **The makeover, which `makeover` was built on and `main` now carries.**
  Cloudflare builds every other branch a preview behind the same sign-in; only a
  push to `main` deploys.
  - Makeover Tasks 1–6: `?look=studio` and the Red signal colours, the two
    typefaces, the sidebar layout (sections, the tray's order and the shell,
    played through twelve weeks), and the Quality Score chapter.
  - Round 0, all sixteen tasks of `plans/2026-09-14-round-zero-redesign-plan.md`
    (`98610c4` onward), as designed in `plans/2026-09-14-round-zero-redesign.md`
    (DECISIONS I35). Five steps in the sidebar layout: the market, where you
    sit, your keywords, your ad, your money. The brand starts on the seed's
    draw and, since 2026-09-15, is the player's to pick in step 2; the India map has 32 cities that pulse by searches, and the shared kit
    (`ui/kit/`) is built for the weekly *Your keywords* to reuse. Two rules
    changed: a self-written ad is graded on its words from week 1 (I11, measured
    on the harness first), and a hired writer's ad is always the writer's copy
    (I25).
  - What playing it measured: four accounts matched round 0; 781 words against
    2,648; every enabled text passes contrast; nothing is wider than a 375px
    phone. The record is the round 0 plan's Task 15.
  - Makeover Tasks 7–11 (`3ccd239` onward): the weekly *Your keywords*, drawn
    with round 0's kit card and planner (`ui/keywords/`), with the reading
    panel, *Adjust several* in the tray, and round 0's reserve warning on every
    week's card; the motion (tray lines, a section's dot and first visit, the
    switch); the play-through (the plan's Task 10). Building the warning found
    round 0's floor figure wrong three ways, each fixed and tested against the
    engine's own auction (`ui/reserve.js`, DECISIONS I17). Playing found and
    fixed, among others, a prepaid discount the tray never listed and a bid
    drag that redrew the whole form on every step.
  - After the gate, for a desktop browser (the owner's call): a section's cards
    at full width, one scroll, slim scrollbars, the guide's contents numbered.
    The design doc's section 10 lists every departure.
  - Then, in the owner's order: the brand as a pick in round 0's step 2; each
    Quality Score part's grade out of ten on the Studio keyword card, as I1
    says and the Studio had dropped; the weekly *Your ad*, read-only
    (`ui/ad/`); and *Where and when* as bars to drag (`ui/where/`), chosen from
    the mock-ups on `design/where-when/`. Drawing those found the round
    clamping a place's bid adjustment separately from the hour's; one clamp
    now covers both (DECISIONS G4's dated note, the market measured
    identical). Then *Your week* (`ui/week/`), chosen from the mock-ups on
    `design/your-week/`: every week's net profit against a dashed tick where it
    stood before this week ran, the revision played once a week. Then *What
    people typed* (`ui/typed/`), from `design/what-people-typed/`: the search
    terms as one list by spend, with Block words beside it. Then *Your money*
    (`ui/money/`), from `design/your-money/`: this month as one bar whose
    weeks you move money between, bidding and week 8 beside it, and at week 5
    the capital and the one move on top. Then *Returns* (`ui/returns/`), from
    `design/returns/`: every week split into refused and sent back, and the
    prepaid discount's rungs, each drawing what it saves against what it
    costs, on the prepaid fix (I34) merged in for it. Then the Market area as
    one section, *Rivals* (`ui/rivals/`), from `design/market/`: the market's
    public figures and your share on top, each rival you meet as a card with
    its ad. Then *Results* after the last week (`ui/results/`), from
    `design/results/`, as four sections, on fixes to both end-of-game replays.
    No Studio screen shows a classic card any more. Then the Guide as a page
    (`ui/guide/page.js`), from `design/guide/`: the field guide as a book,
    with Show me fixed to mark what it opens in every rebuilt section.
  - Part 1 of the switch-over (2026-09-16, `638cf47`..`77e63bc`): `main` merged
    in, the Studio standing on its own context, the front door, the playtest
    questions as a Results section, the version in the playtest file, and the
    Studio as the default look. Part 2 removes the classic look.
  - Part 2 of the switch-over (2026-09-16, `bae274d`..`d3c3476`): the classic
    look and its code are gone — 6,153 lines, and with them `ui/look.js`,
    `ui/round-zero.js` and the page's own markup. The tag `classic-last`
    (`b7f6726`) is the last commit where it runs.
  - On `makeover` (2026-09-16, after part 2): 2273 tests pass, 1 todo, and the
    build publishes 112 files. On `main` it is 54.
- **The tag `playtest-2`** exists on this computer only.

**To play it:** `npm run dev`, then `http://localhost:5173/ui/`. There is one
look and no parameter for another. A saved game is met at the front door on
every load, so choose *Start a new game* to reach round 0. To see the classic
game as it was, check out the tag `classic-last`.

**DONE 2026-09-18: a rival is handed its own revised history** (DECISIONS C9,
the owner's option B, built 2026-09-16 and landed today). Three rival rules read
returns off the report a controller is handed — the week just played, which never
carries one, because a return is written back into its click week two to five
weeks later. So every rival believed the briefing's 40% return rate all game,
`grossOptimiser`'s geography was `disciplined`'s, and the place rule see-sawed.
A controller is now handed a fourth thing, its own report for every week played
as revised (spec R3a and CLAUDE.md hard rule 5 amended, no engine change); the
return rate reads settled weeks only, places sum every week played, and a place
adjustment moves halfway toward its reading. `tests/rivalsInPlay.test.js` holds
all three in play, and each failed before its fix.
- **It sat unmerged while `main` moved 221 commits** — F17, the switch-over, I37
  and I38 — so it was merged and re-measured before landing, against gates agreed
  first: the suite green (2,383 tests), calibration's 22 figures identical, the
  player's median rank still 5th and losing in 0 of 72 markets; paired net profit
  +0.3% median (−3.2% to +4.1%, 10th to 90th), cost per click unchanged at ₹12.0,
  rivals' month-2 budgets identical.
- **D12's week-9 gate, which C9 left open, is closed.** On the pre-F17 market the
  step into week 9 fell to 1.83 times an ordinary week, under the double D12 was
  taken on. On today's market it is 4.19 before C9 and 3.53 after, so the gate
  clears and the figure the screens quote is now 3.53.
- **DONE 2026-09-18, the same root cause: what a rival blocks** (I8's addendum).
  `wastefulQueries` asked for conversions of exactly zero, so a rival blocked the
  zero-intent searches and nothing else: in 24 played games the two characters
  that read their search terms report held no negative at all in 23 of them. They
  now judge by `isDear`, the player's own rule, over every week played — C9's
  fourth argument doing what it was added for. The rule moved to
  `content/searchTerms.js`, the one exception to "a policy imports nothing from
  `engine/` or `content/`", which `policies.test.js` holds to a leaf module.
  Gates agreed first: hard ones passed (suite green, calibration identical, no
  rival blocks itself dark in 2,304 rival-weeks); two stop gates tripped and the
  owner accepted them — the player's median rank slips 5 → 5.5, and
  `grossOptimiser` earns 35.4% more, where its lesson was never that it cannot
  read a report. The player's own profit is unmoved, +0.2% paired.
- **DONE 2026-09-18: What people typed marks a search that sold nothing**, which
  it alone refused to mark while the card marked it. All three readers — the
  card, the list and a rival's policy — now read `isDear` from
  `content/searchTerms.js`. Played on a broad keyword: "gym near me" at ₹7,870
  with no sales was unmarked, and is amber now, saying what it spent rather than
  a cost per sale it does not have.
- ~~**Still open:** `npm run test:perf`'s sampled-round test sits on its 2,200ms
  bound on this machine, on unchanged code.~~ **Settled 2026-09-20** — and it
  had gone red in the meantime without anyone knowing, because nothing runs the
  file. See *Running the performance suite* below.

**DONE 2026-09-17: the landing page is graded as it stands** (DECISIONS I37,
the owner's decision; commits `88c2c98`, `6246367`, `a163633`). The timing
question this entry held open is settled. A page built from capital is
re-written each week from the capital LIVE that week and its landing page grade
re-scored (`pageAsItStands`, `content/landingPage.js`), so round-0 capital no
longer counts three weeks before the work exists, and week-5 capital — which
used to never reach the page — does from week 8. Old saves keep the old rule.
Measured against gates the owner agreed before any run, all passing: `market`
mode byte-identical; week-5 page purchases worth more (the size guide's median
advantage over keeping ₹21,491 → ₹46,435); round-0 purchases worth 13-17% less,
none flipping; no rival moved more than 5%; calibration's figures identical.
- **Measure through a real round 0.** The landing page grade has two writers,
  the page description (all capital's sentences) and the site work's points
  (the page's own capital), and a test game that types its own description
  meets only the second. That is how 073e05f came to say the size guide and
  photography move no grade (corrected in `2d5359c`).
- **The harness can see the page now**, and has a `page` mode and a
  `pagegates` check (`scripts/market-harness.js`). Before `6246367` its player
  typed "A plain product page." and bought nothing at round 0, so it was blind
  to all of this.
- The kept measurement of the old timing, branch
  `claude/cranky-montalcini-b7c4de` (`87d797e`), is superseded by
  `tests/pageAsItStands.test.js`, which reads the same auction record.
- **DONE 2026-09-17: the grade counts only what Google names** (DECISIONS I38,
  the owner's decision, from `design/photography-point/`, direction C). The rule
  that gave a point to any description over 40 characters is gone: the plain page
  is 21, so any sentence at all earned it — a caption for product shots, the
  faster page, a size chart alone by one character. The faster page's own
  sentence now earns that point for SPEED, which Google's mobile advice names;
  photography earns no landing page point at any rung. Over all 64 rung
  combinations, 49 grade as before (every page with capital on the page itself)
  and 15 lose exactly one point (a chart or shots with nothing on the page).
  Games saved before keep the length rule (`pageRules`, `rulesFor`), the owner's
  choice as for I37. Gates agreed first: all three hard gates passed (the
  no-capital market identical; week-5 keep, order confirmation and the page
  identical; round-0 keep, reviews, top page and faster page identical), and all
  five stop-and-show gates tripped and were accepted — the purchases that lose a
  point lost 28-53% of their median advantage over keeping the money, while every
  one still beats keeping it in about the same share of markets, and no rival
  moved more than 3.1%.
- **DONE 2026-09-17: Your ad shows where the grade comes from** (`523301f`,
  from `design/grade-breakdown/`, direction B). Each row names the grader's
  rules its own sentences earn ("+1 it mentions sizing", "+2 the work on the
  page" — not "the site work", which the game uses for everything capital builds),
  the point more than one purchase earns alone is shown once as shared, and a
  sum under the rows matches the chart, saying "the grade stops at 10" when
  the rows add to more. Split by RULE, not by what removing a purchase costs,
  because those do not add up (`pagePoints`, `content/landingPage.js`, with a
  property test against the auction's grade over every rung).

**What to do next, in the owner's order (2026-09-15):**
1. **DONE 2026-09-15: the brand as a pick from the nine,** in round 0's step
   2, starting on the one the seed draws (DECISIONS I35's dated note). A note
   on a rival follows the ad it was made about, because another brand deals
   the eight names onto the eight ads differently.
2. **DONE 2026-09-15: Your ad, read-only** (`ui/ad/read.js`, `render.js`): the
   ad as searchers see it, who wrote it, the three grades out of ten the
   auctions use that week with any change to come and its week, and the
   landing page. Rewriting an ad mid-game waits for the message project. The
   keyword card's Quality Score shows each part's grade out of ten again (I1).
3. **DONE 2026-09-15: Where and when** (`ui/where/`), from the canvas
   https://claude.ai/code/artifact/84535b5e-0d58-4228-b2b5-fbfcf8d7383b: the
   three kinds of place as rows with a bar each beside the India map, and the
   hours as the day drawn to scale. Bars stop where a bid stops, +300% under
   manual bidding and +150% under Maximise clicks.
4. **DONE 2026-09-15: Your week** (`ui/week/`), from the canvas
   https://claude.ai/code/artifact/ae97f8b4-111a-451d-b37a-e8e237b4866f: the
   week's six figures; every week's net profit with a dashed tick where it
   stood before this week ran, the change in grey under it, a losing week in
   amber below a zero line; one sentence on what moved, whose "as" is said only
   when its count moved; and where the impressions went. The engine keeps only
   the revised history, so `ui/app.js` and `ui/save.js` keep the one from
   before the latest week.
   **DONE 2026-09-15: What people typed** (`ui/typed/`), from the canvas
   https://claude.ai/code/artifact/9564f078-b493-4538-94aa-90b6c035ffc0: every
   search bought, most spent first, with what a sale cost there and how many
   came back, and Block words beside it, whose preview shows what a block
   would catch before it is made. A sale costing over twice the account's
   average is marked, because today's "five clicks, no sale" never fires on
   the game's fractional sales (the classic look's fix is its own task).
   **DONE 2026-09-15: Your money** (`ui/money/`), from the canvas
   https://claude.ai/code/artifact/6f331294-d17c-48e9-9804-b7b37227e2c8: this
   month as one bar, where a line between two weeks moves money between those
   two and no others (drag it, or arrow keys); bidding and what week 8 decides
   side by side, the rank said once after week 8 and nothing summed again; and
   at week 5 the capital chips, the one step and the page they would build.
   The bar is what each week will be given, the engine's own re-spread at
   week 5 (`weekBudgetsAtRun`), and the tray says the same by game week.
   Still open from the canvas's notes: the classic deadline card prints the
   rank sentence twice after week 8, and ₹1,00,000 is left in stale comments
   and spec 13.3.
   **DONE 2026-09-15: Returns** (`ui/returns/`), from the canvas
   https://claude.ai/code/artifact/ca2f5ce0-0c5c-4935-8179-55337e6fc9c5: the
   five figures over settled weeks; every week split into refused at the door
   and sent back, the week order confirmation or the size guide went live
   marked and read before and after; the discount's rungs, each drawing what
   it saves a week (refusals prevented, at freight plus margin) against what
   it costs (the discount on every prepaid order), at `refusalOutlook`'s rates,
   said to be next week's; and what else moves returns. Before building it:
   the prepaid fix merged into `makeover` (the owner's choice; harness market
   byte-identical before and after); the returns card's arithmetic lifted into
   `ui/returns/read.js` for both looks; the classic note now names the discount
   and says capital has closed; and a first visit's entrance restored for
   rebuilt sections, which rebuilding Your money had quietly taken away.
   **DONE 2026-09-15: the Market area** (`ui/rivals/`), from the canvas
   https://claude.ai/code/artifact/230864af-39a1-4789-8631-158a34316d7a: one
   section, Rivals (the owner's choice, merging today's Rivals and The market):
   the market's four public figures this week beside last, the median click in
   paise; your share and one reading; each rival you meet as a card, most met
   first, with how often you met week by week, its ad, above-you and
   you-outrank, and a five-point move marked. Only what R3 allows. Two fixes to
   the shared market reading came first, for both looks: it names the rival
   above you in the most of your auctions (overlap times position-above), where
   it had named one in 2% of them; and a move is judged on the printed figures.
   Left for the owner: a results page for one search (a DECISIONS entry
   first).
   **DONE 2026-09-15: Results** (`ui/results/`), from the canvas
   https://claude.ai/code/artifact/e03ab7c2-eeb8-473b-b80c-d67e1932a5b7: four
   sections after the last week (the owner's choice, over one long page).
   *Twelve weeks*: the figures, every week's net profit against its first
   report with the weeks you changed something marked, a strip for the week
   tapped. *What you learned*: the six lessons, the weeks you changed
   something with "What if I hadn't?", the budget question. *Where they sat*:
   round 0's ads and squares, scored on round 0's notes where the save has them.
   *Everyone's books*: every brand by net profit, gross as an outline, your
   three ranks, Play again. Drawing it found both end-of-game replays wrong,
   and the owner chose to fix them first: "What if I hadn't?" deleted the week
   and stopped at the next decision of any kind, so a later list carried the
   change back, capital vanished at week 5, and the week-8 ranking's knock-on
   was cut off (blocking "cheap" read Rs 8,067, worth Rs 75,021; the size
   guide's answer reversed), now `logWithoutChange`, to the end of the game;
   and the budget question's raise was undone by the capital rollover and by a
   plan sent that week (`liftWeek` in `engine/round.js`, the harness
   byte-identical). The budget question now sorts weeks into paid, about broke
   even (within a rupee a click) and lost money, and names a week with nothing
   left in its month; "Numbers keep moving" reads net profit; round 0's notes
   are kept in the save (`notesFor`; an older save asks at the end, as today).
   Said plainly on the screens, by the owner's choice, not fixed: net profit
   never counts capital, and the last five weeks read high because their
   returns come back after the game ends (item 8).
   **DONE 2026-09-15: the Guide as a page** (`ui/guide/book.js`,
   `ui/guide/page.js`), from the canvas
   https://claude.ai/code/artifact/5a912577-a5cc-4107-9923-c351e61837fd: the
   Guide area is the field guide as a book (the owner's choice, over a panel
   of the player's own figure on each chapter). Its list is Contents and the
   thirteen chapters by number; the contents a card a chapter, with the
   section it explains; a chapter its two halves side by side, Show me in
   your account, "Read beside it" and previous and next. "why?" still opens
   the drawer, and its Contents opens the page; the classic look and round 0
   keep the drawer's own list. Checking the mock-ups found, and the build
   fixed first: Show me marked nothing in any rebuilt section (the ring was
   drawn on classic cards only, and focus looked for their h2); three
   chapters pointed where their idea is not shown ("Who writes the ad" at
   Your keywords, now Your ad's writer; "Defending your own name" at the
   auction insights, now the search terms; "What only a simulation can tell
   you" at a month bar, now Results' replays after week 12); Show me now
   waits while its section is locked; two chapters named a classic card, and
   the returns chapter's 30% is now the country's, which places move; six
   related links from the owner's read-through; and each area remembers its
   last section, so the rail goes back to where the player was.
   **DONE 2026-09-16: the switch-over, part 1** (`plans/2026-09-16-switch-over-plan.md`),
   from the canvas
   https://claude.ai/code/artifact/54dadd5c-e4db-43fd-90ef-dd8117aa2c19: the
   Studio becomes the game. The owner chose the front door on its own, the
   classic look removed, and F17 and the rival prepaid fix in the release.
   - **The three merges.** `main` came in as one `-s ours` merge: all 22 of its
     commits are twins of makeover's own, and the tree is byte-identical to
     makeover's before it, so the gate held by construction. F17 and the rival
     fix were already merged here by other sessions; F17's gate held the same
     way (no file the market reads differs), and the rival fix was measured with
     F17 in place — rank 5th, no losing weeks, the player's net within ₹2, the
     rivals' profit per rupee 1.94 to 1.96.
   - **The Studio stands on its own** (`ui/shell/context.js`). It was drawing
     the whole classic page hidden, only to borrow the decision form's context;
     it now builds its own, and a section with nothing to draw throws rather
     than falling back to a card that is no longer there.
   - **The front door** (`ui/door/`): before a game opens, one card in the
     page's own space, in five states — the game in progress, restoring it, a
     game the simulator has changed under (the weeks that differ, as saved
     against replayed now), a game this version cannot open, and a finished
     game. The weeks played stay red while a replay runs, with a bar and a
     line a screen reader can follow. Nothing caught a restore that threw
     before this, so "Restoring your game" stayed on screen for ever.
   - **"Before you go"** is a fifth Results section on the playtest link, where
     the questions were a card under Everyone's books and a tester who stopped
     at the first section never met them. Play again moves there, since
     starting again clears the saved game the file carries.
   - **The playtest file names its version** (`ui/version.js`): 'dev' in the
     repository, the commit in a built site, noted on a load only when it
     differs from the last, so a game that spans a deploy says where.
   - **The Studio is the default.** The page is served as `body.studio` and a
     classic visit takes the class off, so the game everyone now gets paints in
     its own colours before any script runs.
   **DONE 2026-09-16: the switch-over, part 2**
   (`plans/2026-09-16-switch-over-part-2-plan.md`): the classic look and its
   code are gone, 6,153 lines over eight commits, each with the suite green.
   The owner chose to delete first and deploy once, and to cut the look off
   before carving the shared files.
   - **What it actually was.** The design said "about 4,500 lines" and read
     like a deletion; an inventory found only TWO wholly classic files
     (`ui/look.js` and `ui/round-zero.js`), with everything else shared. So it
     was carving classic-only regions out of six files: `ui/dashboard.js`
     1,208 lines to 248, `ui/decisions.js` 3,047 to 1,824, `ui/chart.js` 487 to
     189, `ui/dom.js` 146 to 35, `ui/ending.js` and `ui/debrief/render.js` down
     to their readings, and `ui/style.css` 1,581 to 992.
   - **The header was not inert markup.** `ui/app.js` wrote to `#brand`,
     `#round-label`, `#next`, `#redo` and `#guide` on every render in BOTH
     looks, and the Studio only hid the header with CSS. Deleting the markup
     without stripping that wiring would have broken the Studio, not the
     classic page, so they went in one commit (`bae274d`).
   - **Two things nearly went that should not have.** DECISIONS D11 is accepted
     "and told", and the classic daypart card was the only place telling the
     player that an hour adjustment counts twice under the strategies that
     predict conversions; the owner chose to move it, so Where and when says it
     now (`WHERE.hoursTwice`, shown while `hoursModel().countsTwice`). And
     `tests/roundZero.test.js` was written off as the classic page's; reading it
     first showed it is round 0's RESERVE WARNING, measured against the engine's
     own auction, so 37 tests moved to `ui/roundzero/rules.js` instead of dying.
   - **The stylesheet was cut by measurement.** A rule went only if every class
     in its selector appears nowhere in `ui/**.js`, `ui/index.html` or
     `studio.css`; 142 classes that do appear somewhere were left, most of them
     English words used as variables. Then every element on every screen was
     fingerprinted from its computed styles before and after: 4,853 elements
     across round 0, the six Brand sections, the guide drawer and the five
     Results sections, with zero differences.
   **DEPLOYED 2026-09-16 at the owner's word** ("deploy it"). `main` went
   `760a6b1` → `e29648f`, 194 commits, +39,627 / −7,086 over 204 files: the
   whole makeover at once, F17 and the one-clamp bid fix included, neither of
   which `main` had ever had.
   - **Before `main` moved**, the versions the playtests were played on were
     pushed as tags, since a playtest file is read by checking out the build it
     was recorded on and `playtest-2` existed on this computer only:
     `playtest-2`, `live-before-studio` (`760a6b1`, the last classic version
     the site served) and `classic-last`.
   - **`main` had sixteen commits `makeover` did not**, and an ordinary merge
     conflicted in six files. Every one was a document or a twin of work this
     branch already carried by its own route (F18, I36, the harness's move
     mode, I34's cash share), and the only file `main` held that `makeover` did
     not was the classic round 0, deleted on purpose. So it was merged `-s
     ours` (`e29648f`), which made the deploy a fast-forward rather than a
     second conflicted merge.
   - **`npm run ci` was run locally first**, exactly as Cloudflare runs it:
     lint, 2,273 tests, then the build, exit 0. The built copy was then served
     from `dist/` and played — it stamps `e29648f`, opens in the Studio with no
     classic header and a clean console, and round 0 into week 1 saved.
   - **The live site itself was NOT opened from here**: it is behind Cloudflare
     Access, and signing in is the owner's. Confirming Cloudflare's own build
     passed and published is theirs too.
   - **Nobody needed telling.** No playtester has ever been added to the Access
     list, so no saved game existed on the live site and nobody met the front
     door's "This game has changed" — which is what they WILL meet, since F17
     moves almost any game whose budget ran short.
   **DONE 2026-09-16, from the owner playing the deployed game: the landing page
   is drawn as a page** (`073e05f`, from `design/landing-page/`, direction C).
   It was a domain bar and grey strips reading "product shots"; it is now the
   garment, the sizes, review stars and a size chart, in SVG, showing only what
   is LIVE — plain until the site work lands, then the stars and the chart
   arrive. Beneath it, the landing page grade the auction runs on, week by week,
   which STEPS rather than climbs.
   - **~~It says which purchase buys the grade, and the other two do not.~~
     WRONG, corrected 2026-09-17 (`2d5359c`).** This entry said
     `landingPageBonus` reads the `landingPage` target alone, so only the page
     moves the grade, and the screen carried a disclosure saying so. The
     bonus is one road of two. Round 0 writes the page description from ALL the
     capital (`composeDescription`) and the grader scores it from week 1: +1
     for more than 40 characters, +1 for mentioning size, +1 for reviews
     (`agents/grader.js`, LANDING_RULES). Measured through a real round 0: a
     ₹25,000 size guide takes the grade 5 → 7, photography 5 → 6, ₹25,000 on the
     page 5 → 6. The disclosure is gone, the page row's points say "from the
     site work", and the description's points are shown rule by rule since
     `523301f` (design B, the owner's choice). Found when the owner asked for a round-0 warning that
     ₹25,000 on the page moves nothing, on my word; it moves the grade by one.
     The test games had typed their descriptions by hand, which skips this road.
   - **Four things were caught before it shipped**, three of them by the guards:
     an invented per-part split of the grade (caught in the mock-up); a row
     reading "+0 on the landing page grade · live from week 4", true and the
     opposite of its meaning; "the money leaves in week 1", false for the week-5
     capital window; and a drawn price read from `businessFor`, refused by the
     R3 guard because that function blends in what 16.1 withholds from every
     viewer. The page carries no price now.
   - **And one wording fix from the same play-through** (`da65154`): the
     attribution chapter said a Monday click buying on Friday "adds a conversion
     to Monday, on Friday". Google Ads Help confirms the fact, but two dates in
     one clause read as a typo in the chapter whose job is why numbers move.
   - **The worth chart was redrawn the same day as a step** (`1cfdf33`,
     `37c7e58`, from `design/page-worth/`, direction B), because the owner
     could not see it change: twelve bars stepping 8 → 10 read as one flat row.
     Its geometry is `worthShape` in `ui/ad/read.js`, so a full 0-10 scale and a
     riser on the week the grade steps are tests. Its labels are laid OVER the
     SVG rather than drawn in it: text inside a scaled SVG shrinks with it, and
     measured 8.2px on screen.
   - **And it showed the landing page ignoring the cap** (`bc60a13`). The
     auction caps the landing page grade at 10; this screen added capital's
     points without the cap, so ₹80,000 on a page graded 8 charted 11 and a row
     read "+3" for a gain of 2. The screen now reads `effectiveGrades` for every
     figure, as its header always said it did.
   - **The page row names the weeks the grade moves** (`543cda7`, the owner's
     choice). It named the latest capital tranche's week, so ₹55,000 then
     ₹25,000 on a page graded 8 read "live from week 8" at week 6, when its whole
     +2 arrived at week 4. It now reads `steps`, off the chart's own capped
     grades: "live from week 4", "1 more from week 8", or nothing once the grade
     has finished moving. The size guide and photography rows still fold two
     purchases into one week; they move no grade, and were not the choice.
   - **The drawn page shows a picture when its rung is live** (`6be00c7`, the
     owner's word). It drew stars once no page tranche was pending, so ₹55,000
     then ₹25,000 stayed plain through weeks 4-7 with its grade at 10, and
     ₹25,000 alone — a faster page, no reviews — was drawn with review stars.
     `pageDrawn` runs the LIVE money through `tiersFunded`, the ladder that
     writes the description: stars when "reviews" is live, the chart when "a
     chart" is. **Still open, the owner's:** what the other rungs draw —
     "faster" and "built around the search" on the page, and product shots,
     draw nothing yet.
5. **The message project** (the round 0 design, section 11): angles that change
   who clicks, images from week 9. Its own design doc, a spec change and
   DECISIONS entries come before any build.
6. **Then the playtests**, below, on whatever the makeover has become.
7. **Still open for the owner, none blocking:** from the pilot's play-through,
   whether sixty keywords want the compact list view (a click redraws in 274ms,
   and the section runs to twenty screens), whether to trim the cards' repeated
   words (158 against about 120), and whether Redo round 0 should start from the
   last choices rather than afresh, in both looks. Older: A9, F15 (b)/(c) and
   E8's formula (item 5 below). Round 0's rival guesses now carry into the end
   reveal (the round 0 design, section 12; the owner, 2026-09-15).
8. **DONE 2026-09-18 (DECISIONS I39), both findings from drawing Results, on
   the owner's rules:** net profit never counted capital spent on the business
   (`engine/report.js`, `moneyBlock`), so an advertiser that built nothing and
   one that spent ₹2,40,000 were ranked alike — and the one that kept its money
   was charged for the clicks it bought with it; and a return comes back two
   weeks after its sale, so the last weeks read high and weeks 11 and 12 counted
   none. **The books now do both and the weekly report does neither**, because a
   week's report is an advertising report and Google Ads never knows what a
   business spent on itself. `settledHistory` (`ui/ending.js`) runs each
   advertiser's queues on past the last week with the engine's own reviser, and
   `finalStandings` ranks on settled net profit less what that advertiser
   committed. No auction is re-run, no engine number moves, and the game's own
   history is untouched, so a saved game replays to its own fingerprint.
   Measured over 12 games: settling takes a median ₹1,12,594 off each advertiser
   (a late sale pays margin, its return takes the order back), capital a median
   ₹1,20,000, and 22 of 108 places move. Both replay fixes are live since the
   switch-over deployed (2026-09-16); until then they were on `makeover` only.
9. **FIXED 2026-09-15 (DECISIONS F17), built on the branch
   `claude/lucid-bhabha-395dd1`, merged into `makeover` on 2026-09-16 and live
   since the switch-over deployed that day:** the round's two paths through the auction disagreed with equal
   bids, and the test meant to hold them together never took the second path.
   The cause was deeper: a budget-throttled advertiser held its slot, and
   priced the advertiser above it, in searches it was not in. It now takes part
   in only its share of the searches (`resolveSlice`), and the two paths agree
   to the paisa. The market is kinder for it, which the owner accepted: the
   player's cost per click went ₹19.6 to ₹12.0 and its profit per rupee 1.05 to
   1.90, its rank is still a median 5th, and it still loses money in 0 of 72
   markets. So the end screen and the guide now say returns sit above the
   Indian range (F15's addendum). A played week costs 8–15% more time. One
   full `npm test` run in three failed a single test on identical code during
   F17, most likely a time limit under another session's load; its output was
   not kept, so which test is not known. Every figure is in the plan's
   *Measurements*, `plans/2026-09-15-throttled-ladder-plan.md`.
   Found the same day and still as it was: the prepaid discount card that quoted the smaller towns'
   refusal rate for every account is fixed on `makeover` since 2026-09-15
   (merged from `claude/refusal-outlook-makeover`, I34); `main`'s twin,
   `claude/refusal-outlook`, is still unmerged. The market harness's `compare` reads only `writer` runs;
   compare `market` runs by their summaries or files. The bid's floor and cap
   (`MIN_BID_PAISE`, `MAX_BID_MULTIPLE`) now have their entry, D13, with
   Google's own combined cap for comparison (ten times against the game's
   four), and the `hours` and `cashOnDelivery` chapters say it. Rivals now
   offer the prepaid discount too (I34: none ever had), merged into `makeover`
   on 2026-09-16 (`7096b96`); `main`'s twin `claude/rival-prepaid-main` is
   unmerged. Measured on top of F17, it moves
   rivals' returns half a point and the player's figures not at all (I34's
   dated note).

**Decided about the makeover, not to re-open:**
- a sidebar shell like Claude's app, not the real Google Ads layout;
- Studio drop's cards and type;
- the Red signal palette, where red means *you and your changes*, so warnings
  and losses are amber with a minus sign;
- six motions, none of them the week playing out, plus the map's pulse as the
  one named exception;
- round 0 inside the sidebar layout as five steps, the freelancer as the writer
  a player arrives on, and capital in plain view with nothing recommended (the
  brand, drawn at first, becomes a pick from the nine: the owner, 2026-09-15);
- built for a desktop browser first, the phone kept working.

The two design docs record each choice and what was rejected (round 0's in its
section 2).

**End of 2026-09-13, kept for its list.** `main` was at the latest push and was the
only branch; the game is live and invite-only; 1656 tests passed, 1 todo; the
build published 54 files. The next step was the owner's: the stranger playtests
(*Deployment → Running a playtest* has the steps and the invite).

**What was next, in order, before the makeover:**
1. **Run the stranger playtests on the live site.** Owner: pick three people
   (two alone, one on a video call), add their exact emails in Cloudflare
   Access, send the invite. Session: on the day, `git tag playtest-2 && git push
   origin playtest-2`, and keep engine changes off `main` until the files are
   back. Read them with `node scripts/read-playtest.js <files>`.
2. **Judge the playtests against the review's gates** (`reviews/slc-review.md`,
   section 12): stage C, round 0 under 10 active minutes and weeks 5–12 over 72
   seconds; stage D, three lessons stated in their own words and decisions in
   weeks 7–12 (the reader now counts them).
3. **Then C3 and C4**, designed from what the files show: C3 is round 0 in steps
   (review recommendation 4; it re-opens I11, the writer decision); C4 is a
   dashboard that shows only the cards with something to say (recommendation 5;
   the recorder's card times decide what it hides). Each moves its cards'
   prose into `ui/words/` as it goes.
4. **Then stage E, game feel** (review section 13), only on the screens C
   rebuilds.
5. **Open, for the owner's judgement, none blocking:** A9 (whether a brand
   owner's advantage on its own name should be modelled rather than emergent),
   F15 options (b)/(c) (lower `convRateBase` or cap click-through, only with
   better data than an industry page that contradicts itself), E8's formula
   (how many tags decide how far broad reaches).

**What the session of 2026-09-13 did**, each with its full record elsewhere:

| | what | read |
|---|---|---|
| stage C | the content model (`ui/words/`), the field guide as a side drawer, now nine chapters | `plans/2026-09-12-content-model-and-field-guide.md`, D11 |
| stage D1 | the debrief and the rival reveal on the end screen | `plans/2026-09-13-debrief.md`, G1 |
| rec. 7 | the back half: moving the capital window measured and rejected; a calendar event (January, then the festive season) measured from Google Trends and rejected | D12, F16, `sources/trends/`, `scripts/season-lift.js` |
| built instead | the week-5 capital card reads last month's budget; the week-9 market card shows the re-split | D12 |
| C8 | every rival had been losing its second capital allocation; fixed, measured before and after | C8, `plans/2026-09-13-rival-capital-plan.md`, `scripts/market-harness.js` |
| honesty | "this market is kinder than a real one" on the end screen; hour adjustments counting twice under automated bidding; how many searches a keyword reaches | F15 addendum, D11, E8 |
| playtests | re-planned to run on the live site; the reader lists the weeks with a decision | *Running a playtest* |

**Older detail, kept for its pointers.** The session of 2026-09-12 reviewed the
product and began its stage A.
- **`reviews/slc-review.md` is the product review.** It covers Simple, Lovable
  and Complete, with scores, a 45-minute verdict and a route of seven
  recommendations in five stages. Read its section 12 for the route.
- **Stage A1 is done (`4e24039`).** It fixed the ten sentences that contradicted
  the model, plus the week-8 rank, which one finisher was never told.
- **Stage A4 is done.** The game is saved in the browser and a reload offers it
  back (*Still open*, the database bullet, says how).
- **Stage A2 is done.** The location card's "net per click" was revenue beside
  a CPC; it is now "revenue per click" plus "kept per click", taken from the
  engine's own `moneyBlock` (now exported), and the card ranks places by what a
  click kept.
- **Stage A3 is done: DECISIONS E9.** A keyword taken from the planner now
  carries that search's own tags, as a rival's does; typed phrases are still read
  from their words. Exact-match accounts are unchanged to the rupee. Broad
  accounts now behave like a rival's: narrower for short lifestyle keywords,
  slightly wider for a sixty-keyword spray. **Stage A is complete.**
- **Stage B's measurements are done: DECISIONS A9 and F15** (72 markets, 12
  seeds × 6 cells, with the harness recorded in F15). Both entries are OPEN, and
  no constant moved.
  - **Brand (A9).** Defending your name IS cheaper traffic in play: 0.59× the
    generic cost per click at 1.52× the click-through. But the advantage is
    emergent, not modelled, and five of six rival characters never defend their
    own names.
  - **Economics (F15).** Cost per click is realistic; click-through and
    conversion run at or above benchmarks (the "about 2×" was later qualified:
    the benchmark page gives two figures, F15's addendum), and a sensible
    player profits in every market measured.
  - **The review's "winning is easy" is withdrawn.** A sensible player finishes
    median 5th of 9 (6th before the harness was corrected, C8).
- **Stage B's other half is ready to run, and needs the owner.** A playtest
  recorder is built (`ui/recorder.js`, `a25d637` and `82f29e5`). It is on only
  behind `?playtest=1`, and the player downloads a file at the end and sends it
  back. `scripts/read-playtest.js` turns each file into the baseline table
  (`dd25053`). Decided with the owner: two strangers play alone with the
  recorder, and one plays on a video call with it running too. *Deployment →
  Running a playtest* has the steps. **Postponed on 2026-09-13**, then
  **re-planned the same day to run on the live site** rather than the
  `playtest-1` tag: stage D's gate needs the debrief in the game. Tag the live
  version (`playtest-2`) the day the invites go out; *Running a playtest* has
  the steps and the invite.
- **Decided with the owner:** the explanations will move into an optional field
  guide inside the game, after stage A.

**Stage C has begun, and is on `main`** (begun 2026-09-12 on the branch
`stage-c`, merged and deployed 2026-09-13 as `dfa9bee`). It was held off `main`
so the version strangers play would not change under them; the playtests now
run on the live site instead (*Running a playtest*). The design is
`plans/2026-09-12-content-model-and-field-guide.md`, and the task list with its
Task 4 addendum is `…-plan.md` beside it.
- **C1, the content model, is piloted on the returns card.** Its sentences live
  in `ui/words/returns.js`, each labelled reading, disclosure, instruction or
  label, and `tests/words.test.js` forbids typed numbers, a concept on screen, a
  disclosure without a "why", and prose back in `renderReturns`. Every other
  card moves across when C3 or C4 rebuilds it, not in one sweep.
- **C2, the field guide, is built as a side drawer** (direction A, chosen from
  three mock-ups in `design/field-guide/`). Nine chapters, in
  `ui/guide/chapters.js`, and every debrief lesson now opens one: each says how
  real Google Ads does it, from sources
  fetched while writing, then what this game does, citing DECISIONS.
  `tests/guide.test.js` checks every citation exists; it cannot check that a
  chapter agrees with what it cites (see CLAUDE.md's known traps).
- **Found on the way:** DECISIONS D11 (place and hour adjustments go past
  Google's limits and work under every strategy; both halves are now told);
  and two dead or misleading capital sentences on the
  returns card. Also six tables wider than a phone, which widened the whole page
  to as much as 894px: **fixed** on the branch `phone-tables` (`f725dda`, cut
  from `main` so it can ship without stage C) and merged into `stage-c`.
- **Stage D1, the debrief, is built** (2026-09-13, merged with stage C). The
  design is `plans/2026-09-13-debrief.md` and the task list `…-plan.md` beside
  it. The end screen now opens with two cards before the standings:
  - **What your twelve weeks taught you** (`94867cf`). Up to five weeks the
    player changed something, each with a before and after and a "What if I
    hadn't?" button that replays the game without that one change
    (`replayWithout` in `game.js`). A button that works out what more budget
    would have done: it replays the whole game once with the budget
    counterfactual on, which play never computes (DECISIONS G1, corrected in
    `5449f67`). And the six spec lessons, split into what the player ran into
    and what they did not try. The reading is `ui/debrief/read.js`, the drawing
    `ui/debrief/render.js`, the words `ui/words/debrief.js`, and the two
    "only a simulation knows this" lines open a fourth guide chapter.
  - **Where did they sit?** The player places each rival from its ad, then
    sees the truth. Until they answer or skip, the standings hide the "Where
    they sat" column. The answers arrive one rival at a time (`376ffea`), and
    the animation review's two fixes are in that commit's message.
  - **Found while checking it on a phone:** the dashboard's negatives table
    poked 4px past a 375px screen, missed by the six-table fix because that
    measured a game with no negatives. **Fixed** (`783d4b1`): a two-line
    header makes it fit, remove buttons in view.
- **Stage D's other recommendation (7, a decision for the back half) is
  measured, not built: DECISIONS D12** (2026-09-13). Its cheap test, moving the
  second capital window to week 7, keeps capital profitable but leaves the two
  returns levers a quarter of their value, because no return from weeks 11–12
  happens before the game ends. So the review's route B, an announced market
  event true to the Indian calendar, is the one left.
- **Route B was measured twice and not built: DECISIONS F16.** Google Trends
  for India (the owner's exports, `sources/trends/`, read by
  `scripts/season-lift.js`) shows no January surge in activewear searches;
  January is one of training's quietest months. The festive season is a
  gentle calendar season, and a 72-market check found it changes no decision.
- **What was built instead, on the branch `back-half`:**
  - **The capital card reads the month just played** at week 5: what was spent,
    of what, and the share lost to budget, and says the choice turns on it
    (D12, option d; `ui/words/capital.js`).
  - **C8, found on the way and fixed:** every rival used to lose its second
    ₹1,20,000, because no rival policy made a week-5 capital decision. Rivals now
    decide by character from capital rules their self view carries, and
    `startGame` no longer loses a harness player's round-0 money. Measured
    before and after on `scripts/market-harness.js`, now committed: the player's
    median rank (5th) and its 0-of-72 losses did not move, D12 kept its sign in
    every cell, and F15 has an addendum.
- **The week-9 line, reopened by C8 and then built** (D12): C8's fix moved the
  market's big shift to week 9, where total market spend now drops a median
  26%. The market card shows last week beside this week, and in the week-9
  report says month 3's budgets were re-split by rank; Auction Insights names
  the rivals whose overlap moved most.
- **Also since:** "this market is kinder than a real one" on the end screen
  (F15 addendum, which qualifies F15's "click-through about 2×"); four more
  guide chapters so every debrief lesson opens one; the hours card's D11
  disclosure and a *Bidding by the hour* chapter; each keyword's reach on its
  match type (E8); and the playtest re-plan. All on `main` and live.

**The session before (2026-09-11 to 12) closed the three items that had been open
longest**, in this order. Each has its full record in `DECISIONS.md`; the commit
messages carry the reasoning in between.

| | what happened | read |
|---|---|---|
| **F14** | the return level now equals what the engine's own sourced constants imply (42.7 / 41.7 / 39.6%), and a test pins it. It forced `PURPOSE_MODIFIERS.ret`, `AD_RANK_FLOOR` and `WEEKLY_VOLUME` to move too, each measured before and after | F14 *What shipped* |
| **A crash** | the dashboard had crashed after week 1 since 2026-09-10, with every test green. Found by playing the deployable build, fixed, recorded | I34 |
| **Deployment** | live on Cloudflare, tests gating every push, invite-only through Cloudflare Access | *Deployment* below |
| **F13** | accepted rather than engineered away: lifestyle's broad keywords crowd activewear auctions, the round 0 briefing now says so, and a test pins the asymmetry | F13 *What was decided* |

**Pending, and nobody's but the owner's:** no playtester has been added to the
Access list yet (see *Deployment* for how — it is one edit).

**Two things in this file are easy to miss in its length:** *What playing it as
a learner found* (the one full recorded game, engagement ending at week 4) and
*Still open* (what is known to be unfinished, and why).

**Reading order for a new session:** `CLAUDE.md`, then this section, then
*Deployment → Running a playtest*, then *Still open*. `DECISIONS.md` is a ledger
to look things up in, not to read front to back — its entries are long because
they carry their measurements. `reviews/slc-review.md` section 12 is the route
the work follows.

---


## Where we are

**Every build-order step is done, and the location mechanic with them.** 1656 tests, all passing, 1 todo (2026-09-13).

**THE GAME IS LIVE ON CLOUDFLARE, INVITE-ONLY** (2026-09-12), at
`https://g-ads-simulation.manikhorocks.workers.dev`. Every push to `main` runs the
full suite and deploys only if it passes; every visitor signs in with an emailed
code, and only addresses on the list get one. The list holds the owner's address
alone so far. See *Deployment* below, including how to add playtesters.

**The returns model is the newest thing here** (I28-I34, 2026-09-10, and F14,
2026-09-11). It was one number — `returnRate` — and is now a chain of six: price
tier, purpose, the search's own multiplier, where it was bought, which half of
the return it is, and what capital and a prepaid discount do to each half. It is
the only part of the engine with a shipping cost in it, and the only one whose
constants are mostly `DOCUMENTED` rather than invented. Read I28 before touching
it: the safety property it was built on — *a split of a fixed total* — is exactly
what made a later change silently impossible, and then produced F14.

**F14 IS FIXED, AND IT MOVED THE WHOLE MARKET.** The invented `returnRate`
(30 / 24 / 20%, meaning post-delivery returns only) contradicted the engine's own
sourced constants, which imply 42.7 / 41.7 / 39.6% for every kind of return. It
now equals them and a test holds it there. Three more constants had to follow,
each forced by the one before and each measured: `PURPOSE_MODIFIERS.ret` 0.85/1.20
→ 0.91/1.09 (or I3's purpose tilt broke), `AD_RANK_FLOOR` 60 → 48 (or two rivals
went dark), `WEEKLY_VOLUME` 350,000 → 430,000 (or budgets stopped binding). Returns
across a played market went 22% → 34%. **Every absolute figure measured before
2026-09-11 in this file describes the old market** — the directions mostly
survive, the numbers do not. F14's *What shipped* has the before-and-after.

**F13 IS ACCEPTED, AND TOLD** (2026-09-12). Lifestyle takes top rival in 27 of 30
played markets because its short, vague broad keywords — "everyday leggings" —
reach every activewear leggings search and activewear keywords barely reach back.
True to life, so it stays; the briefing now warns that activewear searches are the
most contested. The lifestyle seat is still the easier one, and whether that spoils
the game is a question for playtesting.

**74% of the model's constants are `INVENTED`** — 59 of 80, against 8
`DOCUMENTED`, 8 `ESTIMATED` and 5 `CALIBRATE`. Roughly 25 of the 59 are
legitimate game-design choices (twelve rounds, nine advertisers, the grid); the
rest are empirical claims wearing a design tag. F14 is what happened the first
time one of them was checked properly.

```
✅  1  constants, money, rng          ✅  8  pacing, attribution
✅  2  querySet + content             ✅  9  round
✅  3  auction                        ✅ 10  report, insights
✅  4  matching                       ✅ 11  serialise
✅  5  quality                        ✅ 12  calibration
✅  6  positions                      🟨 13  agents  — llmPolicy + queryGen left
✅  7  strategies                     ✅ 14  ui      — every control the spec has
```

Plus three modules the spec's layout never had, all of them caller-layer:

| | what it is |
|---|---|
| `game.js` | the round loop. Diffs decisions and writes learning periods (12.3), appends to `decisionLog` (12.4), attaches each advertiser's own Quality Score (15.2). |
| `setup.js` | round 0 (§17). Seeded rival placement, the briefing, the player's opening decisions, and the one redo (17.3). It is in NO build-order step — the order predates `game.js`. |
| `dev-server.js` | 40 lines of `node:http` so `ui/` can import the real engine. `npm run dev`. |

`ui/` is seven modules: `app.js` (the loop), `round-zero.js`, `dashboard.js`,
`decisions.js` (the between-weeks form), `chart.js` (the week-by-week trend of
Auction Insights), `ending.js` (the last screen, and the only reader
`decisionLog` has ever had) and `landing-page.js` (the page the capital builds).

`content/writers.js` is newer than the rest of `content/`: who writes an
advertiser's ad, what that costs, and what it guarantees (DECISIONS I11).

**The interface was laid out across the page rather than down it.** Round 0 was
a single 980px column in a 1425px main — 5.6 screens of scrolling with ~445px
empty down the right; the dashboard rendered a four-column grid as one column
because eight of thirteen cards were full width. Both were measured before
being touched, and the measurement changed the plan twice:

- **Naive pairing is worth almost nothing.** Round 0 two-up came to 4767px
  against 5059px, and merely removing the width cap to 4803px. Halving a card's
  width INFLATES its height — "who else is here" goes 591px to 1590px — so
  pairing takes `max()` of two inflated cards and gives the gain back.
- **The wide TABLES were the cheap ones to halve.** Search terms, a seven-column
  table, grew 11%; the six-figure headline row grew 118%. Tables sit in capped
  scroll regions and only their notes rewrap, while `auto-fit` figure grids
  collapse from six across to three and double.

So the tall cards were fixed internally first — the ad card's fields now sit
BESIDE its live grade, 1024px to 660px — and the grid spends what that freed.
Round 0 is 3948px (4.4 screens), the dashboard 3725px (4.1). Two attempts that
made things worse are kept as comments so nobody repeats them.

**Two screens answer questions nothing used to.** The bidding card says what
the strategy will actually bid and whether that clears the reserve, BEFORE the
week is spent finding out; and the end screen opens the books on all nine
advertisers once the last round is played. Both came from playing it — see
DECISIONS I12 and G3.

**Round 0 now asks two things it never used to.** Who writes the ad — yourself,
a freelancer, an agency or a retainer — and what is on your landing page, which
is built from the capital rather than described in a text box. Both are
DECISIONS I9 and I11, and both replaced a screen that was quietly teaching
something false.

**It is playable end to end, and has been played end to end.** `npm run dev`,
then http://localhost:5173 (`.claude/launch.json` sets `autoPort`, so a second
session gets a different port rather than colliding). Round 0 asks for brand,
position, capital, keywords, who writes the ad, the ad itself and a weekly
split; the dashboard plays a week at a time
against six rule-based rivals; and the decision form now lets the player write
negatives, change bids and match types, pause keywords and add new ones between
weeks, choose a bid strategy, take the round-5 capital allocation, use the one
repositioning window, divide the month across its four weeks and bid the hours
of the day. **Every control spec v0.3 describes is now reachable.** A full
twelve rounds runs through the interface with no console errors and ends on a
screen that says what the twelve weeks came to.

**The rescue works**, which is what slice three was for. The account this
project keeps coming back to — `premium|lifestyle`, five keywords taken off the
top of the keyword planner by volume, every one of them a Value-tier search:

| | week 3 | week 4 |
|---|---|---|
| Net profit | **−₹26,998** | **+₹39,570** |
| Net ROAS | 0.73 | 2.90 |
| CPA | ₹6,756 | ₹1,737 |

Between those two weeks, through the form and nothing else: three negatives
written off the search terms report, three Value keywords paused, a broad bid
cut, six premium and co-ord terms added from the planner.

**This table is NOT a baseline for an unchanged account, and a session that
treats it as one will chase a number it cannot reach.** By week 3 that account
had been played for two weeks — the broad keyword the bid cut refers to was added
along the way — so its week 3 is a different account from the week 3 of the same
opening left alone. Rebuilt and run with no changes, the same opening reports
−₹5,871 / 1.44 / ₹3,600, which is the figure quoted further down under *the
search terms report defaults to every week played* (−₹5,796, reproduced to 1.3%).
Two different week 3s, both real, and only the second one is replayable.

All five calibration invariants pass. Neither `CALIBRATE` constant moved without
argument, and both moved in F14:

| | value | why it is where it is |
|---|---|---|
| `AD_RANK_FLOOR` | 48 (was 60) | Raising it is regressive. A flat reserve takes the same absolute paise from every cell — a small bite out of Premium's ceiling, a fatal one out of Value's. Floor 150 took I3 from 2.8% to 50.8%; 250 wiped the Value tier out. **Standing still is raising it** when every ceiling falls, which is why F14 moved it: at 60 after the return level rose, both `cautious` rivals went dark for up to four weeks. |
| `WEEKLY_VOLUME` | 430000 (was 350000) | Pinned from both sides. Below ~395,000 I1 fails — a competently covered advertiser cannot exhaust its month. Above ~460,000 I3 fails — the flat budget cap bites unequally across break-evens differing 2.5x. **The two are read together**: a lower floor means cheaper clicks, which take more searches to exhaust a budget. |

I3 sits at **11.3% worst deviation, 1.19x spread** against a 15% target, 7.8% at
the raised budget. It had drifted to 13.2% after I28 build 2 without anybody
seeing it, because a passing invariant prints nothing — the 2.8% above predates
the location mechanic and freight.

---


## The decision form

`ui/decisions.js` is the form. It owns a **draft** and the cards that edit it.

**The seam, and the trap it is arranged around.** A decision is RETURNED from a
controller, never written into state. The draft is built from `getSelfView` —
which deep-copies on the way out, so the form *physically cannot* write through
into `GameState` — and `toDecision(draft)` hands back a `{ campaign, adGroups }`
object that `app.js` returns from the player's controller. `playRound` collects
it and `submitRound` applies it, so the player enters a round by the same door a
policy does (R6), and the learning period and the decision log both happen.

`toDecision` returns **null when nothing changed**, so an untouched form is
byte-identical to the `() => null` controller it replaced. There is a test for
exactly that, and it is the one that would fail if someone "simplified"
`createDraft` to take the advertiser record directly.

All of it verified by opening a browser, because `npm test` cannot see any of
it (see *Verifying the interface*).

1. ✅ **Negatives written from the search terms report.** A block button on the
   row writes an exact negative for that one search. The composer writes broad
   and phrase negatives with a live preview.
2. ✅ **Bids, match types, pausing, and adding keywords** from a mid-game
   keyword planner. New keywords are tagged offline as they are typed (8.4).
3. ✅ **Bid strategy and its parameter**, with the learning period named before
   the commit and again while it bites.
4. ✅ **The round-5 window** — the capital top-up and the one repositioning step,
   together, because they are drawn from the same month.
5. ✅ **Month 3 explained, and an end screen** (`ui/ending.js`).
6. ✅ **The weekly split**, with what each spent week actually cost beside what
   it was planned.
7. ✅ **Dayparting**, six blocks, over the player's own hour-of-day history.

**Nothing is left of the list.** What is left of the project is in *Still open*,
and none of it is interface.

### What items 3 to 5 settled that is worth not relearning

**The learning period is asked of `game.js`, not restated.** `willTriggerLearning`
calls the same `triggersLearning` that `submitRound` will call. If the two ever
disagreed, the player would be warned about a penalty they do not get, or worse,
not warned about one they do.

**The bid-strategy parameter is locked to the strategy that uses it**, and that
is a fix for a sharp edge in 12.3 rather than tidiness. 12.3 triggers a learning
period on "changing any value in `strategyParams`", and that object carries BOTH
`targetCpaPaise` and `targetRoas` at all times whatever is running. Left
editable, nudging the target ROAS while running Target CPA would cost two rounds
of doubled prediction error for a number that touches no bid. `setStrategyParam`
therefore takes no key: the strategy decides which parameter exists.
**Anything else that writes decisions will hit this** — an `llmPolicy` most of
all.

The decision still submits the WHOLE params object, both keys, because
`applyDecision` merges `campaign` shallowly and a partial one would drop the
other strategy's parameter. `rawBid` then throws rather than substituting a
plausible number, which is correct and also means the failure would be loud.

**`STRATEGY_PARAM` restates knowledge that lives in `rawBid`, so it is checked
against the engine rather than trusted:** every strategy the table gives a key
to must throw without it, every strategy it gives none to must run on empty
params. Same principle as the negatives preview calling `blockedBy`.

**The capital allocation is submitted whether or not the player touches it.**
Omitting `capex` is not declining it — it means the allocation is never claimed
and ₹1,00,000 disappears, no investment AND no rollover. So the default is an
explicit zero, stated on the card and listed under `Next week` with no undo
button, because there the default IS the decision. Round 1 is deliberately not
offered: round 0 spent that allocation, and asking again would hand the player
the rollover on top of an investment already made.

**`monthBudgetAfter` mirrors `applyBudgetAdjustments`**, which is a drift risk,
so five cases assert it equals what the round actually reports — including both
round-5 decisions at once, which is the case that matters: committing everything
AND moving leaves ₹68,000 of a ₹1,68,000 month.

**The rank is two integers.** `budgetSchedule.rankedAtSnapshot` orders every
advertiser by gross profit; `rankOf` returns `{position, of}` and the array goes
no further, so no screen can show a rival's standing even by accident. Showing
the player their own rank was a deliberate call: they can read it off their own
month-3 budget anyway (₹1,17,600 against ₹1,68,000 is the last-place multiplier
and nothing else), and 13.3 is explicit that a budget swinging for reasons
nobody can attribute is worse than the mechanic is worth.

### What items 6 and 7 settled

**The split resets every month, and the card has to say so.**
`advanceCampaign` re-evens `weeklySplitPaise` at every month boundary, because
the month's total can change — month 3 is redistributed by rank. A shape set in
month 1 does not survive into month 2. The card re-asks at the top of each
month rather than pretending the plan carried, and a test pins the reset so
nobody later "fixes" the card on the assumption it persists.
`applyBudgetAdjustments` also rescales the split whenever capital rolls in,
which preserves the shape but not the amounts — so at an allocation round the
card tells the player to set the shape rather than the exact rupees.

**Spent weeks are read-only.** `buildBudgets` only ever reads
`split[(round - 1) % ROUNDS_PER_MONTH]`, so editing a week that has already run
changes nothing. A control that does nothing is worse than no control. They
show what they actually SPENT beside what they were planned, which is the
comparison 13.2's burn-down exists for.

**The split warning asks the operative question, not the tidy one.** The first
version asked `validateWeeklySplit`, which sums the WHOLE split against the
WHOLE month — right at round 0 where `setup.js` asks it, wrong mid-month. With
weeks 1 and 2 under their plan there is MORE in the pot than the total implies,
and the card warned about a ₹3,21,000 plan when only ₹1,87,000 was planned
ahead. It now compares the weeks still to run against what is left, which
collapses to exactly `validateWeeklySplit` at the top of a month — and a test
asserts they agree there, which is where the engine has an opinion at all.
Mid-month it has none; 13.2's cap simply binds during the round.

**Dayparting reads `bidding.observedByHour`, and that is the whole trick.** It
is cumulative clicks and LANDED conversions per hour of day, written by the
engine and already carried in `getSelfView` — the same history a bid strategy
must accumulate before it can daypart at all (12.2, D2). So the card needed no
new data and leaks nothing: `HOUR_PROFILES` and `HOURLY_INTENT_CURVE` are the
model and `tests/ui.test.js` fails if a `ui/` file names them.

**The card says nothing about which hours are good**, because I5 forces the
demand peak and the intent peak at least three hours apart and the table makes
that visible on its own. Measured on a played account at week 5:

| block | clicks | conversion rate |
|---|---|---|
| Afternoon | 1,390 | **3.63%** |
| Evening | **2,241** | 3.00% |
| Night | 1,460 | 2.21% |

The busiest block is not the best-converting one, and noticing that is the
entirety of H4. Being told it would be a different and much smaller lesson.

**−100% is "bids the minimum", not an off switch.** `daypartMultiplier` returns
zero, and `effectiveBidPaise` then clamps to `MIN_BID_PAISE` rather than to
nothing — so it is a bid of ₹1. It behaves like an off switch only because ₹1
lands under `AD_RANK_FLOOR`. Two tests pin the ends: every block at −100% cuts
impressions by over 99%, and +100% on evening raises what the account spends.

### Three rules the form obeys, and why

**A decision must be previewable before it is committed.** The whole design is
about acting on incomplete information, and a form that hides consequences it
could show is being cruel rather than honest. The commit button says how many
changes it is about to commit; a `Next week` card lists them with an undo on
each; and staging a negative greys out the rows it kills *in the report it was
written from*, rather than leaving the player to discover them next week.

**The view may not compute economics.** `tests/ui.test.js` fails if a `ui/` file
names a constant it should import, and that guard has already fired once and was
right. Every string operation in the form is the engine's own — `blockedBy`,
`normalise`, `tokenise`. A preview that reimplemented the matcher would agree
with it right up until one of them changed, which is exactly how the two `.jsx`
prototypes went wrong. A test asserts the preview agrees with `blockedBy` over
the whole frozen query set, for all three negative types.

**The form may only know what a controller could know.** It reads the query set
through `getPublicView` — text, volume, intent — rather than
`content/querySet.js`, so 16.1's withholding is enforced rather than intended.
Two consequences worth keeping:

- **There is no broad-match reach preview, and there must not be.** Reach needs
  the QUERY's tags, which 16.1 withholds from everybody. 8.2 is explicit that
  you discover what broad match dragged you into *after the fact*, from the
  report. The keyword note states the mechanism — impressions rise, impression
  share falls — with no number nobody could have.
- **Intent stays off the search terms report.** It is public, and the planner
  shows it. But a real search terms report has no such column, and adding one
  would turn reading the report into sorting by a label. The negatives preview
  lists the searches a negative would block and lets the player read them, which
  is the actual skill.

### The search terms report defaults to every week played

Not to the week just run. One week is the wrong basis for a negative and the
interface should not invite it: `byQuery.conversions` keeps being revised for
three more rounds, so a row reading zero today may read two next week. In the
account above, week 3 showed a ₹5,796 loss and was rewritten to a ₹16,454
profit. Blocking an unsettled zero is precisely the mistake the report exists to
expose. There is a `this week only` toggle, and the note under the table says
which of the two you are reading.

`accumulate()` sums `state.history` rather than the reports the screen was
handed, because history is the copy that gets revised (11.4).

---

## Three things the interface found in the engine and caller

Both were reachable by nothing before the form existed, which is exactly why
they survived. Both produced numbers, and one of them had been on screen since
slice one.

### Capital could be committed in any round, for free (`game.js`)

`applyCapex` never checked the round. The engine does not DEBIT capital: it
converts whatever was left uncommitted into ad budget, and only at
`capexAllocationRounds`. So a commitment made in any other round had no
allocation to consume and nothing to forfeit. Measured before the guard:

```
round 1: committed=10000000 liveAtRound=4    legal
round 5: committed=10000000 liveAtRound=8    legal
round 7: committed=10000000 liveAtRound=10   free
```

₹1,00,000 of investment, repeatable every round. It throws now, and a state
with no `budgetSchedule` refuses rather than guessing.

### `stillPending` was the whole queue, not the round's own clicks (`report.js`)

It summed the advertiser's entire pending queue, which made it the only field in
an `AdvertiserRoundReport` not about that round's cohort — `final`, `returned`,
`costPaise` and everything else are — and it broke the revision below it, which
subtracts only that round's late landings. Measured over eight rounds:

| round | final | stillPending |
|---|---|---|
| 1 | 195.0 | 0.00 |
| 3 | 195.0 | 42.91 — plateaus, nothing of its own outstanding |
| 8 | 107.3 | 130.68 — the entire account queue |

Summing across reports gave 421.30 against a true outstanding of 130.68. **The
dashboard had been showing an over-count under Conversions since slice one**,
and nothing noticed until the end screen tried to total it. Corrected to the
round's own cohort it now equals the true outstanding for every round, and the
ending reads 9 of 12 weeks settled — which is what a three-round lag predicts.

**It decays to 7.1e-15, not to zero**, because it decays by SUBTRACTING
fractional landings from a fractional total. Anything asking "has this settled"
needs a tolerance. `ui/ending.js` has one and `report.test.js` uses
`toBeCloseTo`.

### Two fields 15.2 asks for that the report never carried (`report.js`)

`budget.weeklySplitPaise` and `budget.roundsRemainingInMonth` are both listed in
15.2 and neither existed. 13.2 asks the UI for "a burn-down of remaining pot
against **rounds remaining**", and the second number could not be drawn — so the
dashboard showed half a burn-down from slice one until item 6. It now reads
`₹1,99,036 left, 1 week to spend it`.

`roundsRemainingInMonth` counts the rounds AFTER the one being reported, which
is the figure a burn-down wants: what is left, and how long there is to spend it.

**The shape of all three:** a field or a guard that nothing exercised. The
pattern worth carrying forward is that building the first real caller for a path
is when you find out whether the path was right — and that the spec's own field
lists are worth diffing against the code, because two of these were simply never
implemented and nothing noticed for eleven build steps.

## What building the form exposed

Eleven bugs in the interface itself. Before the linter existed `npm test` caught
exactly one of them — a syntax error. Every other one came from opening it, and
the last two from driving it by hand rather than from a script.

The ones worth remembering, because they are kinds rather than incidents:

- **A form that could not be typed into.** Every keystroke in round 0's ad copy
  called `rerender()`, which replaces the form and destroys the input being
  typed into: focus fell to `<body>` and every character after the first was
  swallowed. Typing "Built" by hand produced "B". **This file had recorded the
  cause since slice two** — "the round 0 form rebuilds itself on every
  keystroke, so driving it from a script means re-querying the element after
  every change" — as a scripting hazard rather than as a bug, which is exactly
  why it survived: a script re-queries and never notices. Fixed by separating a
  structural rebuild (a click) from a keystroke, which now refreshes only what
  it derives.
- **A counter that never rendered.** `field()` passed its hint to `el()`, which
  sets `textContent`, so round 0's character counters — spans — displayed the
  literal string `[object HTMLSpanElement]` from the day the screen was
  written. No test reads them and they are small grey text at the end of a long
  form.

- **A screen that leaked what the spec withholds.** Round 0 marked the player's
  own territory in the keyword planner with a dot, computed by `homeCell()` —
  which reads `priceAffinity` and `purposeAffinity`, the two fields 16.1
  withholds "from every viewer, including the advertiser the affinity favours".
  It also did the round 0 decision FOR the player: which of these searches are
  mine is the question 4.1 says positioning answers. Removed, and
  `tests/ui.test.js` now fails if any `ui/` file names those fields or the
  functions that derive them — a guard built from the engine's own
  `FORBIDDEN_IN_PUBLIC_VIEW` rather than a copy of it.
- **A screen that taught something false.** The round-5 card claimed
  repositioning resets your Quality Scores. It does not: 4.5 calls the loss "a
  consequence, not a rule to implement" — keeping a keyword keeps its history,
  and only the ones you REPLACE start from nothing. Moving with the old keywords
  in place kept every score (`4 7 4 4 7` before and after). **This is the worst
  class of interface bug in this project**, because the screen was explaining
  the exact mechanic it was getting wrong.
- **A warning that cried wolf.** The split card summed all four weeks against
  the month mid-month, warning about a ₹3,21,000 plan when only ₹1,87,000 was
  planned ahead. A warning that fires when nothing is wrong trains the player to
  ignore it.
- **An engine string on screen.** The same card printed
  `validateWeeklySplit`'s own message, which quotes raw paise because it is
  written for a thrown error: the player was shown "totals 35100000 paise". R7
  puts formatting at the display layer. **The verdict may be the engine's; the
  sentence has to be this layer's.**
- **A promise the screen did not keep.** The end screen offers "every decision,
  week by week" and knew nothing about the weekly split or the hour adjustments
  — a week where four blocks and a week budget changed logged one line about
  capital.
- **`willTriggerLearning` compared the draft's position against itself**, so a
  repositioning would have reported no learning period on the one change that
  most certainly causes one. Shipped in item 3, unreachable until item 4.
- **`spentByWeek` was computed and never attached to `ctx`** — a defined
  function nothing calls and an undefined lookup rendering as an em dash.
- Three more that were friction rather than falsehood: the planner composer
  losing its match type, bid and filter on every add; the over-block warning
  firing only on conversions already earned; and the split outlook not redrawing
  as you typed into it.

And one thing that was not a bug: at exactly 1100px wide the dashboard grid is
two columns, not four, because `@media (max-width: 1100px)` is inclusive. A
`span-2` card measuring full width there is correct. Check `matchMedia` before
believing a layout report.

## What the audit pass changed, and why it still matters

Two sessions back, and kept because the defects are the instructive kind.
An audit pass found nineteen things. Four were already covered by the ledger and
were withdrawn or narrowed — that is the system working. The rest produced eight
commits, and three of them were engine defects producing wrong numbers:

- **Reports were double-counting their own lag-0 conversions.** `runRound`
  appended the fresh report to history and then revised the whole array,
  including that report, so 55% of every advertiser's conversions landed twice.
  Round 1 stored 131.33 where `runRound` returned 65.66. Eight revision tests
  missed it because they all compared `R1.report` against `history`, and the
  defect lived exactly in the gap between those two objects.
- **`observedConvRate` was never written.** It stayed null for twelve rounds
  while `observedConversions` climbed into the hundreds, so smart bidding grew
  steadily more confident about `COLD_START_CONV_RATE`. The spec-19 test for it
  was never written, and every strategies test supplied the value by hand.
- **`observedByHour` was hard-coded null**, so `MIN_HOUR_OBSERVATIONS` was
  unreachable and a bid strategy had no route to dayparting at all.

And one design defect worth understanding before touching anything:

- **The purpose axis was applied twice.** `PURPOSE_MODIFIERS` *and* the query
  set, which gives lifestyle territory bigger baskets and fewer returns. Both
  are true; both push the same way. The realised purpose gap was 12/17/20%
  against I4's 15% bound, invisible because **I4 read `constants.js` and
  nothing else** — it measured a quantity no auction experiences. Fixed by
  shrinking the `INVENTED` modifier rather than flattening the argued content.

---


## What playing it found

Six sessions of building found bugs by writing tests. **Playing it found a
different class entirely**, and every one of these was invisible to 1000+ tests
because it was about what the screen SAYS rather than what the engine does.

- **Two rivals ran word for word the same ad.** `adCopy.js` authored one ad per
  CELL and 17.1 puts eight rivals in six cells, so every doubled cell produced
  identical copy — on seed 20260902, two pairs of them. 17.1 makes the eight ads
  the ONLY evidence of where anyone sits, so that is not a cosmetic repeat: it is
  two rivals the player cannot tell apart. Each cell now holds two ads and every
  copy rule runs against both.
- **Round 0 listed eight brands with no hint that the ninth was you.** Correct
  behaviour, unexplained, so it reads as a missing rival.
- **The Quality Score was one number that barely moved.** Measured: lifting
  `expectedCtr` 6 → 9 moves the ratio 1.145 → 1.676 and the displayed score not
  at all. Worse, a player who commits the whole ₹1,00,000 to their landing page
  still read `landingPage: average`. The screen now shows all three component
  ratings AND the grade the player earned — see `DECISIONS.md` I1.
- **Brand bidding ran every round with no surface at all.** §3.1 names it one of
  four reasons this vertical was chosen. `brandDefender` poaches every brand
  query in the market from round 1 and holds 100% of eight of them by round 2,
  and nothing told the player they owned a name. See `DECISIONS.md` I2.
- **`Weekly` ran into `Intent`.** `td.num` sets `padding-right: 0` so figures
  align on their last digit, and the next cell had no left padding.
- **The round 0 planner threw away your search term** every time you added a
  keyword, because adding rebuilds the form.
- **Keywords could be paused but never removed** anywhere except round 0.
- **The ad copy card was a guess.** It took five boxes, said nothing about what
  they were worth, and the grade appeared two screens later with no way to tell
  which words moved it. `explainGrade` now scores and EXPLAINS from one pass, so
  the advice on screen cannot drift from the number beside it, and round 0 shows
  the grade live. Writing to the advice took a deliberately weak ad from 3/6/3
  to 8/10/8.

**The pattern.** Every one is a sentence the interface does or does not say. The
suite reads source, the linter reads syntax, and neither reads meaning — so this
class is found by using the thing and in no other way.

---

## What measuring it found, and it is the sharpest lesson here

A session spent measuring rather than building produced four findings, and three
of them were **defects in the measurements themselves**. That is the pattern
worth carrying: in this project a wrong number is far more likely than a wrong
feature, and it never announces itself.

> **Every rupee and percentage in this section predates F14** (2026-09-11), which
> raised returns across the market from 22% to 34% and moved the reserve and the
> weekly volume with them. The LESSONS are unaffected — they are about how
> measurements go wrong. The figures are a record of the old market and should
> not be quoted as current. None of them has been re-run, and several cannot be:
> see *Record the harness* under *Writing a measurement harness*.

### `advertiser.policyId` was dead, so every rival stood still

`buildRival` set it to `null` with the comment "the caller assigns a policy",
and the only caller that did was `ui/app.js` — which assigned by index from a
private array and never wrote the id back. So in **every game that had ever
run**, `policyId` was null and `controllerFor`, which exists precisely to turn
that id into a controller, had no reader outside the tests.

The cost was not theoretical. Every measurement taken that day wired rivals as

```js
controllers[a.id] = a.policyId ? controllerFor(a.policyId) : () => null;
```

which is the obvious way to write it and silently gives all eight rivals a
**no-op controller**. They kept their round 0 keywords, bids and ads and never
adjusted a bid, wrote a negative or responded to anything. A dead field still
produces entirely plausible numbers, which is why nothing looked wrong.

Fixed by dealing the policy at construction from `RIVAL_CAST` in
`agents/policies.js`, so the field is live by default rather than by the caller
remembering. **Any harness you write should assert the rivals are live before it
measures anything** — `tests/writerBalance.test.js` does.

What it cost in numbers: one point of ad copy quality was measured at
₹2,20,254 against a dead field and ₹1,33,986 against a live one. CPC improvement
went from −28% to −8%. Marginal value only starts falling at grade 9 once
rivals bid back.

### A claim measured on the canonical seed was a sample of one

Spec 9.4 said an "above average" landing page rating was "not reachable at all",
which overturned `DECISIONS` A6's correct "reachable but narrow". Measured over
720 games it is reached in **33 of 72 (seed, cell) pairs**.

The retracted figure came from seed `20260902` — this project's canonical seed,
and the WORST row in the grid: one of its six cells reaches `above`. In five of
six the false claim is locally true. **A number measured on the canonical seed
is a sample of one**, and this one propagated into the spec, a DECISIONS entry
and a `constants.js` comment before anyone re-measured.

### A replica that disagrees with the recorded baseline is measuring something else

Checking whether the creative rollover broke invariant I3, a scratch replica of
the I3 harness reported **15.0% and a FAIL** — which would have sent a session
rebalancing something that was never broken. It summed GROSS profit over all
twelve rounds; the real invariant uses NET profit over settled rounds only,
because a click in round R is not final until R+5.

What gave it away was that it could not reproduce the documented 2.8% baseline.
The real figure at the raised budget is **5.3%** against a 15% bound.

**And `calibration.test.js` could not have caught it either**, which is the
second half of the lesson: it builds its own fixture with `monthlyBudgetPaise`
hardcoded and no `creative` block, so a ~30% change to the budget scale
`WEEKLY_VOLUME` is pinned against could not reach the invariant that exists to
catch it. The suite passing proved nothing. The harness is parameterised by
budget now and the raised case is a permanent test.

### A rival that never traded, found by a screen rather than a test

The end screen's standings table, on its first game, showed one rival on ₹0
spend and ₹0 profit across twelve rounds. **The market had eight real
competitors, not nine**, and nothing had noticed.

The cause was self-inflicted and an hour old: the writer mechanic dealt the two
`cautious` rivals a self-written ad, which opens on the ungraded 3/3/3 default.
DECISIONS A8 measured that state precisely — *"sits below `AD_RANK_FLOOR` at any
cautious bid, so the player would enter every auction and show in none"* — and A8
is the reason the PLAYER's ad is graded before round 1. The fix recreated the
condition the fix existed to prevent. Marlow needed 1551 paise to appear and bid
1078.

**Nothing in 1147 tests asserted that a rival TRADES.** There are tests that
rivals exist, carry a policy, sit in legal cells, hold distinct ad copy and get
grades inside the scale — and none that any of it produces an impression.
`setup.test.js` now checks every rival's opening bid against the reserve on its
own best keyword, across all twelve seeds.

### The shape of all four

A test or a measurement that does not exercise the thing it names. `policyId`
had a function built to read it and no reader; I3 had an invariant that could
not see the budget; the landing-page claim had one seed standing in for
seventy-two; and eight rivals had nothing checking they were alive. **When a
measurement agrees with what you expected, check what it actually ran** — all
four produced numbers that looked entirely reasonable.

The fourth one is the warning about the other three. It was found by a SCREEN,
not a test — by putting nine rows in one table where a human could see that one
of them was zeros. Every guard in this project was written after something got
past it.

## What a second player session found

Every one of these came from somebody using it and saying what happened, and
none was findable any other way.

- **"Setting a target ROAS gives me a blank week."** It did, and the model was
  right: Target ROAS bids DOWN (`order value × conversion rate ÷ target`), so at
  25 the bid fell under `AD_RANK_FLOOR` — a RESERVE, not an eligibility gate —
  and the account entered every auction and showed in none. The screen said
  "lost to rank 100%", which reads as being OUTBID and sends a player to raise
  keyword bids, the one lever that cannot help. `bidOutlook` now says what the
  strategy will bid and whether it clears, live, before the week is spent
  (DECISIONS I12).
- **"Week 2 told me nothing."** Four phrase keywords produced four search-term
  rows, each identical to the keyword that bought it. The explanation existed
  and was good and lived on the NEGATIVES card — a feature the player was not
  using. `termsOutlook` moved that live read under the table where the question
  is actually asked, and it turns on REACH rather than match type, because a
  long phrase keyword reaches nothing while a short one reaches dozens.
- **"I don't get the rationale behind the graph."** The chart explained what
  each metric IS and warned what impression share is NOT, and never said what to
  DO with it. `marketOutlook` reads the account back — rank-bound, budget-bound,
  both, or saturated — entirely from `insightsFor(...).self` and the six legal
  rival metrics (I13).
- **"The month-2 capital screen explains it worse than round 0."** True, and a
  drift introduced the same day: round 0 became a page builder while the
  allocation window kept the older framing. Both read `featureAt` now. Finding
  it turned up something round 0 never has to say: investment is CUMULATIVE, so
  ₹25,000 on top of ₹25,000 reaches ₹50,000 against a ₹55,000 rung and buys
  NOTHING. That chip now says `no change` and is marked (I15).

**The pattern.** Three of the four were a screen that was correct and unhelpful
— the number was right and the sentence explaining it was missing, in the wrong
card, or pointed at the wrong lever. None of them is a defect any test could
hold, and all four were reported in the form "this told me nothing".

**And one thing to say plainly to whoever picks this up:** the recorder in
`ui/` is a scratch injection, not a feature. A session that wants to watch a
game must install it in the browser pane and the player must play THERE — twice
this session a game was played in a separate browser window and nothing was
captured, which is not recoverable afterwards.

## What playing it as a learner found

**The largest untested claim in this project is now tested once.** A full twelve
rounds, played by hand in the browser pane by somebody who had not driven it
before, with a passive DOM recorder installed so the session could be read back
rather than remembered. 881 events over 28 minutes, round 0 to the end screen.

**They won.** First of nine, `premium|lifestyle`: ₹5,70,502 spent for 68,576
clicks, 958.5 conversions, **₹17,22,620 net** on ₹22,97,660 gross, net ROAS
**6.48**, CPA ₹595. Second place took ₹16.62L, so a 38% lead. And **Vella & Co.
sat in the same cell and finished 6th on ₹5.99L** — worth holding on to, because
F13 says lifestyle cells are structurally cheap and this is the counterweight: the
seat did not win this game, the opening did.

### The finding: engagement ended at week 4 and winning did not require more

| phase | time | clicks | keystrokes |
|---|---|---|---|
| round 0 | **1,076s** | 42 | 630 |
| week 1 | 168s | 28 | 2 |
| week 2 | 102s | 14 | 4 |
| week 3 | 50s | 5 | 3 |
| week 4 | 148s | 26 | 20 |
| **weeks 5-11** | **72s total** | **8** | **0** |

Seven weeks in 72 seconds, one click each, nothing typed. The game's own decision
log agrees: *"4 of the 12 weeks carried a decision. The rest ran on what you had
already set."* **Round 0 took 67% of the entire session** — eighteen minutes and
630 keystrokes before a single auction ran.

Asked what happened, the player said: *"the screens stopped asking me anything
after week 4. Once I had put in the major inputs at about round 4 I felt like
there weren't that many things to look out for."*

### The screens did NOT go quiet. They spoke, and correctly said nothing was wrong

This was measured rather than assumed, and the first attempt to measure it was
wrong — see the correction at the end. Replaying a close replica and reading every
prompting surface for weeks 4 to 10, **seven consecutive weeks are identical**:

| card | every week |
|---|---|
| the market | `constraint: "saturated"`, impression share **99.999%**, lost to rank **0**, lost to budget **0.001%** |
| negatives | `worthIt: false`, wasteful rows 0, wasted spend ₹0 |
| search terms | `mirrored: true`, 20 searches / 20 keywords, 1.0 per keyword |
| bidding | bid ₹30 against ₹4.60 needed, `willShow: true`, unchanged |
| where you advertise | **byte-identical sentence, seven weeks running** |
| your copy | `null`, correctly — a hired ad was live from week 1 |
| this month | the only thing that moved |

So this is neither an interface defect nor exactly a round-loop one. **The account
reached a state by week 4 where every diagnostic correctly reported nothing wrong,
and nothing in the remaining eight weeks disturbs it.** The player's read was not a
failure to notice; every card agreed with them.

### And the calendar says the same thing structurally

| round | what arrives |
|---|---|
| 0 | position, keywords, ad, writer, capital, budget |
| 1 | first capital allocation |
| 3 | a DIY ad goes live |
| **5** | **capital top-up + the one repositioning window** |
| 8 | rank snapshot — invisible, and unactionable |
| 9 | month 3's redistributed budget |

**The last new decision the game offers arrives at round 5, and seven rounds
follow it.** Everything still available after that was already available in week 2.

Put that beside this file's own W11 measurement — *"first fully-settled feedback
arrives at round 7"* — and the shape is stark: **decisions are front-loaded and
finish at round 5; settled feedback is back-loaded and starts at round 7. They
never meet.** That is the best explanation this project has for both the passive
account that finished third and this one that stopped at week 4 and finished
first.

### Four smaller things the session found

- **The search terms report was inert for twelve weeks.** `mirrored: true` every
  round: twenty phrase keywords producing twenty rows, each identical to the
  keyword that bought it. This file already knows all-phrase accounts do this;
  what is new is that it persisted for a whole game, so the surface 15.2 calls the
  only route to negatives never switched on. I8 measured **one broad keyword
  taking the report to seventy rows** — the player never had a reason to add one.
- **Six of eight negatives blocked a search the player had already removed as a
  keyword the week before** (`gym near me`, `free workout plan`, `how to lose
  belly fat`, `gym tights for women`, `cheap gym leggings`, `marlow co ord set`).
  The two controls are genuinely different mechanisms, so this is not wasted
  motion in principle — but **neither card says the other has already handled it**,
  so the job was done twice and could not have been known to be redundant.
- **The location card was on screen from week 1 and never clicked.** Zero location
  decisions in twelve rounds. See DECISIONS I24.
- **Two things worked exactly as designed.** The player's dayparting peaked on
  **afternoon at +100%** — the best-converting block, not the busiest — which is
  H4 landing without being told, and the whole reason I5 forces the two peaks
  apart. And Target ROAS was set to **10** and traded fine, where the previous
  player session set 25, got a blank week, and read "lost to rank 100%" as being
  outbid. That is `bidOutlook` doing its job.

### The correction, because the shape will recur

**The first harness written to answer "did the screens go quiet" produced a clean
table showing exactly that, and it was wrong.** It read `.note` off all seven
outlook functions and printed `(silent)` where there was none. Only
`locationOutlook` composes a note; the other six return DATA and the sentence is
assembled inside the render function.

It would have confirmed the player's own words with a fabricated measurement, and
it looked right *because* it agreed with them. This file's rule — *when a
measurement agrees with what you expected, check what it actually ran* — caught it.

**And the reason it was possible is worth recording as a defect in its own right.**
This file claims the pure part of every screen sits outside the render so only the
drawing needs a browser. For six of seven prompting cards the **wording lives
inside the drawing**, so it is neither unit-tested nor readable without a browser
— and the wording is exactly where this project's whole "correct and unhelpful"
defect class lives.



## What changed in round 0, and what it cost

Three commits, all measured before they were built.

**The geography got its own card** (`a8b7554`). "The market" was 817px against
"Your brand"'s 386, so 432px of column sat empty. Splitting it is what was asked
for, and **every naive version made the page taller** — a half-width card costs
+118px, full width with the note stretched underneath +36px. What works is full
width with the note BESIDE the table: **4,274px, 25px shorter than before the
split**, and dead column under Your brand down to 148px. The arrangement
originally asked for — the market stacked under the brand with geography beside
them — cannot remove the dead space at all: it needs a 936px card on the right and
the geography card is the shortest on the page.

**The cap stopped freezing the landing page** (`286b0ab`). See DECISIONS I19,
which is reversed rather than amended, because the argument that kept the cap
depended on a state the Go button now makes unreachable.

**A worked example ad** (`71e41c6`), asked for so the ad rules are learnable. It
costs **no height at all** — 4,274px before and after — because it shares a grid
cell with the budget card through `.setup-stack` rather than starting a row of its
own. It had to land beside **Capital**: against "Who writes it" it overflowed by
169px, and Capital at 670px is the only card tall enough. That is why the writer
card now sits before the keyword planner — a layout constraint, not a reading
preference.

**Why an example is safe here when I3's territory dot was not:** `adRelevance` is
scored against the player's OWN keywords, so a copied ad scores *worse* than the
same effort in their own words. The dot made the decision; this cannot.



## Round 0 has a design, and part of it is built

**This is the classic look's round 0**, which `?look=classic` still draws. The
Studio look rebuilt round 0 on `makeover` on 2026-09-14 (*Start here*, DECISIONS
I35), and the hired-writer fix this section calls open was built as I25.

**The canvas:** https://claude.ai/code/artifact/5e9555b3-28fa-4d12-8479-5f10812a086a

Six interactive artboards covering all ten round 0 cards, built on the
simulator's own content — the nine brands, the tier economics, the break-even
sums, the geography splits, the eight rival ads from `content/adCopy.js`, the
writer tiers, the capital rungs and the planner's head terms. It is a design
surface, not code: nothing in it drops into `ui/`, which is the point given the
two `.jsx` prototypes were deleted for drifting away from the engine.

**The brief was "it looks too mundane", and the diagnosis is in `style.css`'s own
opening line** — *"dense on purpose. This is a dashboard for reading numbers
against each other"*. True of the dashboard. Round 0 is a briefing and seven
decisions read once, and it had inherited the telemetry-panel look without
needing it: ten near-identical grey rectangles.

### What is built (`61304b9`)

- **The map.** `ui/india-map.js` plus a rebuilt `sectionWhereSearch`.
- **The capital curve**, which is the fix for a measured finding rather than a
  visual one — see *What capital is actually worth*.
- **The skin, scoped to `.setup`**. Not one selector wider, deliberately.

**And it moves** (`4a21bc7`). The first cut shipped the design's geometry and none
of its motion, which a player noticed immediately: *"the map is stationary."* Now
the 150 backdrop cities twinkle on staggered delays, each tier city throws a
halo, a tier's cities are joined by arcs that flow, and a scanline crosses the
country. **A city is a control** — clicking one picks its tier exactly as clicking
the table row does. A dimmed tier's arcs and halos stop, animations cancelled, or
the tier you dismissed keeps flowing over the one you chose.
`prefers-reduced-motion` turns all of it off.

### What is designed and NOT built

The identity panel on *Where you sit*, the market tiles, the keyword planner and
the ad card. All four are in the canvas at full fidelity. They were left because
they are the delicate parts of `round-zero.js` — the `live`/`rerender` split,
`submittedAd`, the reserve warning and the Go gate — and rewriting them is where
the risk is, not because the design is unsettled.

### Three decisions worth not relitigating

**The map is the honest chart, not an ornament.** The card already names eighteen
real cities across three tiers; drawing them is the figure that data asks for.
The coastline is DataMeet's boundary reduced by Douglas-Peucker, projected from
latitude and longitude. **Earlier attempts drew it by eye and were wrong however
many points were added** — 34, then 120, then a redraw. Adding points to a wrong
shape gives a wrong shape with more points. Only switching to real coordinates
fixed it.

**"Where you sit" is an identity, not a chart.** The first attempt plotted the
six cells on searches against ceiling. It was correct, and it was an analyst's
chart: it stripped out the thing the card actually asks, which is what kind of
company you are. The canvas version keeps the 3×2 grid — the intuitive part —
and makes choosing one show who you would be, with the real ad a shop like that
runs. Rejected on sight, and the rejection was right.

**Nothing may plot territory.** The tempting version of the positioning chart
lights up your own queries, and it would need `priceAffinity` and
`purposeAffinity` — exactly what 16.1 withholds and what I3 removed the round 0
dot for. Every figure on that card is public: order value, margin, searches,
break-even.

### One thing the canvas takes a position on that the code does not

The ad artboard opens in **the failing state a tester met**: retainer hired,
8/8/8 on screen, account still blocked because the description boxes are empty.
A tweak above the artboard flips it to the resolved state. The fix — a hired
writer supplying copy the player can edit — is proposed and unbuilt, and is the
open item below.


