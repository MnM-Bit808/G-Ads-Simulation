# Density first, polish second

*Design, 2026-09-24, on the branch `polish`. Written before any code, per
`CLAUDE.md`. The owner asked to make the simulation "posh and very clean" and
chose to refine the Studio that exists rather than start a new direction, and
to lead with density.*

*Measured on the live site at `aa97790`, 1440×900, with animations finished by
script because the browser pane reports itself hidden.*

---

## 1. What this is not

**It is not a restyle, and the measurements are why.** Three things I expected
to find wrong are right:

- **The type is already a considered pairing** — Bricolage Grotesque for
  display, Instrument Sans for text. Not a default.
- **Contrast passes almost everywhere.** Sampling every distinct text style on
  round 0's step 1 against its actual composited background, the only failure
  is the rail's own labels — *Market*, *Guide* — at **3.47:1** on 10px, which
  needs 4.5:1 at that size. Everything else is 4.66:1 or better.
- **The red is disciplined.** It marks the player and nothing else, which is
  the rule the switch-over set.

So the work is not "make it look better". **A beginner is not drowning in the
colours.** This document is about how much is on screen at once.

## 2. The principle is already in this codebase, and round 0 never got it

`tests/firstRun.test.js` holds each of the first run's seven beats to **80
words on screen**, and its comment says why:

> A total was never the figure the argument rests on: **a beginner drowns on a
> SCREEN.**

It then refuses to bound the run's total, deliberately:

> A total bound would only be a number to nudge upward, which is how the first
> one got to be wrong.

That is the right instinct and it is enforced by a test. **Round 0 has no such
bound and never did**, and in the ten days since it was last measured it has
grown accordingly.

## 3. What round 0 measures today

Words rendered on each step, against the like-for-like figures recorded on
2026-09-14 (`plans/2026-09-14-round-zero-redesign-plan.md`, *Played*):

| step | 2026-09-14 | 2026-09-24 | change |
|---|---|---|---|
| 1 · The market | 281 | **375** | 1.3× |
| 2 · Where you sit | 119 | **612** | **5.1×** |
| 3 · Your keywords | 38 | **77** | 2.0× |
| 4 · Your ad | 150 | **258** | 1.7× |
| 5 · Your money | 208 | **353** | 1.7× |
| **total** | **781** | **1,675** | **2.1×** |

**Every step grew. None was held by anything.** The first run got a bound
because a stranger gave up inside round 0; round 0 itself did not.

For scale: the first run's bound is 80 words a screen. **Four of round 0's five
steps are three to seven times that.**

## 4. Where the words come from, and it is not the writing

`ui/words/roundZero.js` holds about **625 authored words** across 90 strings,
and round 0 renders **1,675**. So roughly **two thirds of what a beginner reads
on round 0 was never written by anyone** — it is data: rival names, ad copy,
place names, numbers.

**This matters because it changes the remedy.** Cutting prose would reach a
third of the problem at most, and the prose has already been cut twice. The
density is in what the screens CHOOSE TO SHOW AT ONCE.

## 5. The worst screen, named exactly

**Step 2, *Where you sit*, draws all eight rival ads in full** — each with a
*Sponsored* label, a display domain, a brand name, a headline of two or three
lines, and a description of four or five — plus a 3×2 placement grid under each
one. That is roughly 500 of its 612 words.

It asks a beginner, on the second of five screens, to:

1. read eight competitors' ad copy,
2. infer each one's price tier and purpose from that copy,
3. place all eight on a grid they met one screen ago,
4. and then choose their own cell against that picture.

**The task is right and the staging is wrong.** Reading rivals' ads to work out
where they sit is exactly the lesson — spec 4 and the whole positioning idea
rest on it. Eight at once, before anything has been practised, is what a
beginner cannot do.

## 6. What I propose, in order

**6.1 Bound round 0 the way the first run is bounded.** A per-step measurement
and a test that fails when it is exceeded. The bound is not 80 — round 0 is a
decision screen carrying real data, not a guided teaching beat — and picking it
is the first thing to agree. My proposal is **two bounds, not one**:

- **authored words per step ≤ 120** — what `ui/words/roundZero.js` contributes,
  which is the part a writer controls;
- **on-screen items per step**, counted as cards, rows and chips rather than
  words, because that is what the data contributes.

A words-only bound would be gamed by moving prose into data, which is how step
2 got to 612 while the words file stayed small.

**6.2 Stage step 2 rather than cut it.** Four options, to be chosen on the
canvas:

- **A · One worked example, then the rest condensed.** Show one rival's ad in
  full with the reading demonstrated, then the other seven as headline-only
  cards that expand on click.
- **B · The grid leads.** Draw the 3×2 grid first with eight unplaced markers;
  clicking a marker opens that rival's ad. The ads become evidence fetched on
  demand rather than a wall to read.
- **C · Deal them in threes.** Three ads, place them, three more, then two.
  Same content, three smaller screens.
- **D · Headline only, description on hover/tap.** Smallest change; keeps one
  screen, cuts roughly 300 words from it.

**My recommendation is B.** It inverts the screen so the *structure* is the
subject and the copy is supporting evidence, which is the lesson's actual shape
— and it is the only option that makes the placement task feel like the point
rather than homework attached to a wall of text.

**6.3 Then the other four steps** to whatever bound 6.1 sets, in descending
order of excess: step 1 (375), step 5 (353), step 4 (258), step 3 (77 — already
fine).

## 7. The polish, which comes after and is small

Once density is fixed, four specific treatments, all measured:

- **Not everything is a card.** On step 1, the three tier panels, the break-even
  box and the map box share one radius, one border and one fill. Border, fill
  and shadow each say "separate object"; spent uniformly they flatten the
  hierarchy. The break-even number is the most important thing on that screen
  and does not read as such.
- **The red panel shouts three ways** — red tint, red border, red text. Keep
  one, at most two.
- ~~**The India map is decorative.** Small, dim, and carrying a real idea
  (where the searches are) that it barely communicates.~~ **WRONG, WITHDRAWN
  2026-09-25.** Measured on the running game it is **560 × 585**, fills its
  container exactly, and draws a dot per city scaled by how often that kind of
  place is searched, beside three rows giving 20% / 36% / 44%. It communicates
  the idea well. This entry was written from a screenshot cropped at 500px, in
  which the map begins at y≈410 — I described its top edge and called it the
  map. **The lesson is the one this project keeps relearning: a screenshot is
  not the screen.** Its column was widened from 1.1fr to 1.45fr anyway, kept
  because a card titled *Where the searches are* reads better with the picture
  leading — but that is a preference, not the defect this bullet claimed.
- ~~**The rail labels fail contrast** at 3.47:1. One fix, and the only measured
  accessibility failure on the screen.~~ **WRONG, WITHDRAWN 2026-09-25.** The
  3.47:1 is `.studio-area:disabled` — *Market* and *Results*, greyed out for the
  whole of round 0 because they are not reachable yet. The owner raised them
  from 2.18:1 to about 3.5:1 on 2026-09-14 **and no further, deliberately**, so
  they still read as off; `tests/roundZeroLook.test.js` holds both ends of that,
  requiring at least 3:1 AND at least 1.5 less than an active area. WCAG 1.4.3
  exempts inactive components from contrast minimums. Nothing to fix: the
  sampling script found a disabled control and this document called it a
  failure without checking which control it was.

## 8. What would make this wrong

**Playtest files.** Five people have the link as of 2026-09-20 and none has
returned anything. If a file arrives showing a beginner moving through step 2
quickly and stalling somewhere else entirely, section 5 is the wrong target and
this document gets rewritten against the recording rather than against my
reading of a screenshot.

**That is a real risk and worth stating plainly:** every measurement here is of
the artefact, not of a person using it. The project has been caught by exactly
this before — the 10-minute round 0 gate was a proxy for "not drowning", and a
proxy is what this is too.

## 9. What this does not touch

The engine, the constants, the market. Nothing here moves a number in a played
week, so no `market-harness` run is needed and the five CALIBRATE constants are
not in scope. It is `ui/` and `plans/` only.

It stays on `polish` until playtest files are back or the wait is called, because
every push to `main` redeploys and five people may be mid-game.
