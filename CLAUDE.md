# CLAUDE.md

Project instructions. Read at the start of every session.

## What this is

A Google Ads search auction simulator, built to be played as a learning tool for
paid search advertising. Vertical: athleisure and gym clothing, D2C, India.

Nine advertisers — the player plus eight rivals — compete over twelve weekly rounds
in three monthly budget cycles. Each advertiser occupies one cell of a 3 × 2
positioning grid (price × purpose) chosen at round 0, which determines what a click
is worth to them and therefore which searches are theirs.

Its value depends entirely on being **honest about what it models**. A simulator
that teaches something false is worse than no simulator, because the person cannot
tell the difference. Accuracy outranks features here.

## Read before writing any code

- `HANDOVER.md` — **read this first.** Where the build has got to, what is still
  resting on a guess, how the work is done, and the traps. Shortest route in.
- `ENGINE_SPEC_v0.3.md` — the specification. It is the source of truth.
- `DECISIONS.md` — every departure from real Google Ads and why.

Then `git log --oneline` and read the last few commit messages in full. They
carry the reasoning behind each module and what building it exposed.

`ENGINE_SPEC_v0.2.md` is superseded and kept only for reference. Section 21 of v0.3
lists what changed and why.

If the spec and your instinct disagree, say so and ask. Do not silently deviate.

## Working with me

I am relatively new to development. Explain technical concepts in plain language
when they come up. I am building this to understand it, so a working file I cannot
follow is a failure even if the tests pass.

- **Plan before code.** For anything beyond a trivial edit, tell me the approach
  first and wait.
- **Ask rather than assume.** If the spec is ambiguous, say which part and what the
  options are. Guessing silently is the main failure mode I am trying to avoid.
- **One module at a time.** Do not build ahead.
- **Push back.** If something in the spec is wrong or will not work, say so. Two
  audit passes have already caught roughly forty problems; assume more remain.

## Hard rules

These come from the spec and are not negotiable without changing the spec first.

1. **The engine is pure.** No network calls, no clocks, no global state, no
   unseeded randomness inside `engine/`. Each advertiser draws from its own seeded
   substream, never a shared generator.
2. **Claude calls live in `agents/` only.** The full test suite must pass with no
   network access.
3. **Money is integer paise.** Never floating point, never `Infinity`. Format only
   at display.
4. **Nothing in `engine/` may read `reportedScore`.** It is output only.
5. **Controllers receive views, never state.** A policy or model is passed its own
   `AdvertiserRoundReport` plus `getPublicView()` output. `GameState` never reaches
   a controller. This is architectural — you cannot test that something ignored a
   field it was handed.
6. **One advertiser type.** No privileged player path anywhere.
7. **Every unsourced number goes in `constants.js`** with a provenance tag
   (`DOCUMENTED` / `ESTIMATED` / `INVENTED` / `CALIBRATE`) and an entry in
   `DECISIONS.md`. When you delete a number, delete its ledger entry too.
8. **Negatives never touch the tag layer.** Broad match uses tags; exact, phrase and
   all three negative types are string operations.

## Workflow

Tests first, then implementation, then run them and iterate until green.

```bash
npm test
```

That runs `eslint .` first and `vitest run` second, so a lint error stops you
before a single test runs. The linter is there because `no-undef` and
`no-unused-vars` are two bugs this project shipped to a browser that no test
could see — the suite reads source as text, not as code. `npm run lint` alone
if you want just that.

```bash
npm test -- auction
```

```bash
npm run dev
```

That serves the project at http://localhost:5173 so `ui/` can import the real
engine over native ES modules. The performance suite runs alone, because timing
anything inside a parallel test run measures the machine rather than the code:

```bash
npm run test:perf
```

Commit after every green test run. Small commits, present tense, one concern each.

**Pushing to `main` deploys.** The game is live on Cloudflare at
`https://g-ads-simulation.manikhorocks.workers.dev`, invite-only. Every push runs
`npm run ci` there — lint, the whole suite, then the build — and publishes only
if it passes. To see the built site exactly as it will be served:

```bash
npm run preview
```

`HANDOVER.md` *Deployment* has the Cloudflare settings and how to add a
playtester.

## Conventions

- ES modules, `.js`, no TypeScript for now.
- Named exports. No default exports outside `ui/`.
- Pure functions take dependencies as arguments; nothing reaches for a module-level
  singleton, `rng` least of all.
- JSDoc on every exported function: what it does, units, and any invariant it
  assumes.
- Comments explain *why*, never *what*.

## Build order

**All fourteen are done or in progress.** `HANDOVER.md` has the current
position and what comes next. Two modules the list below never had — `game.js`
(the round loop) and `setup.js` (round 0, spec 17) — sit between steps 13 and
14, because the build order was written before either existed.

1. `constants.js`, `money.js`, `rng.js`
2. `querySet.js` + tests — nothing downstream is trustworthy without a valid set
3. `auction.js` + tests
4. `matching.js` + tests
5. `quality.js` + tests
6. `positions.js` + tests
7. `strategies.js` + tests
8. `pacing.js`, `attribution.js`
9. `round.js` + tests
10. `report.js`, `insights.js` + tests
11. `serialise.js`
12. `calibration.test.js` — run it, then set the `CALIBRATE` constants
13. `agents/` — rule-based policies first, Claude-backed after
14. `ui/` last

Round 0 (spec 17) is in none of these steps. It was assumed, and it turned out
to be a phase with real decisions in it; it lives in `setup.js`.

The query set is generated by a model, then **read and corrected by hand**, then
frozen as a test fixture. It is the one artefact where a subtle flaw poisons every
number in the simulation without ever throwing an error.

## Known traps

- **Quality does not reliably lower average CPC.** It lowers the price of a given
  position, then lifts you into better positions where the advertiser beneath you is
  stronger. Two separate tests, not one. A correct engine fails the naive version.
- **Improving ad copy must move `qualitySignal` immediately and leave
  `reportedScore` unchanged in the same round.** If both move, the split is broken.
- **Broadening a keyword must *lower* impression share while raising impressions.**
  If it raises both, the eligibility denominator is wrong.
- **Pacing throttles by reducing participation fraction, never by skipping an
  auction.** One auction resolution carries a whole slice of an hour's volume, so
  skipping produces exactly the budget cliff the design exists to remove.
- **The counterfactual raises only the focal advertiser's budget.** Raising
  everyone's measures a different, more competitive market and answers the wrong
  question.
- **`getPublicView` must expose the query set** (text, volume, intent) or no
  controller can write keywords. It must never expose affinity or conversion
  multipliers — to anyone, including the advertiser the affinity favours.
- **The two hourly curves must not peak together.** If demand peak and intent peak
  coincide, dayparting earns nothing and `DECISIONS.md` H4 is false.
- **Five constants are `CALIBRATE`, not two:** `AD_RANK_FLOOR`, `WEEKLY_VOLUME`,
  and the three location tables G4 added — `LOCATION_VOLUME_BY_PRICE`,
  `LOCATION_RETURN_MULTIPLIER`, `LOCATION_AOV_MULTIPLIER`. All provisional until
  `calibration.test.js` passes, and `constants.test.js` pins the set so it cannot
  grow quietly. Anything that moves returns or volume means re-running
  calibration and checking all five — F14 moved both `AD_RANK_FLOOR` (60 → 48)
  and `WEEKLY_VOLUME` (350,000 → 430,000). **The test only asserts a bound and
  prints nothing when it passes**, so I3 once drifted from 9.5% to 13.2%
  unseen: measure the figure, don't just read the green tick.
- **A fixed price falls behind when everything else moves.** `AD_RANK_FLOOR` is
  an absolute reserve. When F14 cut every ceiling by 20-30%, leaving it put made
  it a quarter stricter and two rivals went dark for weeks. Standing still is
  itself a change.
- **A split of a fixed total can never move the total.** `rtoShareOfReturns`
  divides returns into refused and sent-back as SHARES, which was right when it
  was built and has since caused two defects: a prepaid discount that could only
  relabel a return rather than remove one (I34), and `returnRate` being redefined
  as all returns without its magnitude changing (F14). When a lever cannot move a
  number, ask what is holding it fixed by construction.
- **Each returns lever reaches only its own half.** The size guide reduces
  send-backs and nothing else; order confirmation and the prepaid discount reduce
  refusals and nothing else. A size guide that reduced refusals would be claiming
  a fit chart stops someone changing their mind at the door — the first build of
  I28 did exactly that.
- **In expected mode a sale is a fraction, so almost nothing is exactly
  zero.** A search's sales are its clicks times a conversion rate; only a
  search nobody buys from reads 0. A rule asking `conversions === 0` fires on
  zero-intent searches alone, and one asking `> 0` fires on nearly everything:
  the search terms mark and the block warning did one each, with every test
  green because their fixtures used whole zeros (I8's addendum). Compare a
  search against the account instead, and test on a played game. The rivals'
  `wastefulQueries` still asks for a zero.
- **"The build works" means playing it, not loading it.** The dashboard crashed
  after week 1 for two days with 1348 tests green; only a smoke test that played
  round 0 into week 1 found it (I34). Open the browser and play a week.
- **`wrangler.jsonc` must keep pointing at `./dist`.** Without it Cloudflare
  guesses the folder to publish on every deploy, and a wrong guess publishes the
  repository — docs and tests — while still reporting success.
  `tests/build.test.js` holds it, and holds `dist/` to exactly the files the
  game loads — 54 since `ui/words/form.js` (2026-09-13).
- **The engine's `replayGame` is not a game replay.** It runs `runRound` alone,
  so it skips everything `game.js` adds: capital, repositioning, a self-written
  ad landing, Quality Scores. Measured, its costs do not match a played game.
  Anything that restores a PLAYED game goes through `game.js`'s `replayLog`, as
  the save does.
- **A decision the player's form always sends must be sent by every rival too.**
  The engine turns uncommitted capital into ad budget only when a capital
  decision is submitted. The form always sent one at week 5; no rival policy
  did, so every rival's second ₹1,20,000 vanished for months with every test
  green (C8). Any new decision window needs a rule in every policy in
  `agents/policies.js`, and a test through `submitRound` that nobody's money
  disappears.
- **Measure a market-moving change with `scripts/market-harness.js`, before
  and after.** Three throwaway harnesses each measured a player poorer than
  any real one: the round-0 capital was handed to `startGame` in a shape that
  lost it (now built properly, `capitalBlock` in `setup.js`), and the week-5
  capital decision was never sent. The committed harness does both right;
  `market` for F15's economics and the market's shape, `capital` for D12.
- **Don't re-propose a calendar event without new data.** A January surge and a
  festive season were both measured from Google Trends for India and rejected
  (F16): January is one of training's quietest months, and the festive rise
  changes no decision.
- **The field guide cites DECISIONS, and a green test does not mean it
  agrees.** `ui/guide/chapters.js` says what the game does and cites the entries
  it rests on; `tests/guide.test.js` proves each cited entry exists, not that
  the chapter still matches it. When a DECISIONS entry changes, search
  `ui/guide/` for its ID and re-read every chapter that cites it. The chapters'
  "in real Google Ads" halves come from sources fetched when written; never
  add a real-world claim from memory, and read a benchmark's context before
  quoting it (the apparel page F15 cited gives search click-through as 3.2% and
  6.8%). A chapter's `yourAccount` must be a slot that exists once the page is
  drawn: the decision form replaces the page's `decisions` placeholder, so its
  cards set their own `dataset.slot`, and the guide test checks both.
