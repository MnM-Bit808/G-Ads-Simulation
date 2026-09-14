# Round 0, redesigned in the Studio look

*Design, 2026-09-14. Decided with the owner one question at a time, each
screen chosen on the canvas. Built the same day on `makeover`
(`plans/2026-09-14-round-zero-redesign-plan.md`); where the build departs from
this text, section 14 says so.*

*It changes the Studio makeover's plan (`plans/2026-09-13-studio-makeover.md`):
round 0 moves from seventh to first among the sections, lives inside the
sidebar layout, and brings its own build order (section 9). Everything that
design decided still holds unless this one says otherwise, and the one place
it does is motion (section 7).*

## 1. Why

The owner opened round 0 in the Studio look after makeover Task 2 and called it
horrid. Measured at 1280×720, on `makeover` at `ac457eb`:

- **Two palettes at once.** Round 0 has its own skin in `ui/style.css`
  (`--r0-*`, lines 442–584: slate text, a teal accent, a navy map) that
  `ui/studio.css` never reaches. 13 text colours on one page. The chosen brand's
  border is that teal (#64D2C7), not the mint the handover guessed.
- **Red on things that are not yours:** all eight rival ads' headlines and the
  planner's 60 "add" links, 96 red text elements. Red means *you and your
  changes*.
- **32 text elements fail contrast**: field labels and table heads at #4D5C6E
  measure 2.79:1 on the card.
- **Amber where nothing is wrong** (the break-even caveat), and none of the
  Studio type: 12.5px capital-letter card titles, no Bricolage anywhere, 203
  text elements in the system monospace.
- **The card pairing has come apart:** Capital is 995px beside 707px of cards;
  the page is 5,057px, about seven screens.
- **The map runs 187 endless animations** for as long as the page is open.
- **The review's baselines hold:** 2,648 words (2,633 then), 11 sections, 97
  buttons; 1,170 of the words are 35 blocks of explanation.

The review (`reviews/slc-review.md`, section 5) had already scored it: round 0
took 18 minutes of a 28-minute game, and recommendation 4 proposed round 0 as a
guided sequence.

## 2. What was decided, and what was not chosen

| Question | Decided | Not chosen, and why |
|---|---|---|
| Where round 0 lives | **Inside the sidebar layout**: the section list becomes the five steps | Its own full-screen flow (my recommendation): a second layout to build and keep. Kept on the canvas as the record |
| The steps | **1 The market · 2 Where you sit · 3 Your keywords · 4 Your ad · 5 Your money**, then Go | Recommendation 4 put the rival ads in step 1; they moved beside the grid, because they are the evidence for that choice |
| The brand | **Assigned, not picked**: brand searches run 2,838–2,881 a week whichever brand, so the pick changed almost nothing | Picking one of nine: ten buttons and a paragraph for no decision |
| Who writes the ad | **Writers at a fee stay** (the owner's call, so round 0 introduces the concept); **the fee buys not having to write** | Removing the writer (my first recommendation); the fee buying a head start (today's I11: an invented two-week wait); the fee buying the angle choice (a toll on the new decision) |
| The writer you arrive on | **The freelance copywriter**, so a player who does not want to write never meets empty boxes | Arriving on writing it yourself, as today |
| Capital | **In plain view and neutral**, defaulting to kept | Recommendation 4 grouped it with things tucked behind "advanced"; measured, every allocation beat keeping it in the one cell tested, so hiding it steers to the worst option |
| The weekly split and the redo | **The split behind "advanced"**; the redo stays under the brand name in the sidebar until week 3 | — |
| The India map | **Kept, restyled, and moving**: each city pulses by its kind of place's share of searches | Cut from round 0 (chosen, then reversed by the owner); today's four loops restyled; one arrival then still |
| More cities on the map | **8 metros, 12 large cities, 12 smaller cities and towns** | 10–12 metros: India has about eight by the usual count; twelve would mean calling large cities metros |
| The squares | **A diagram**: price as a real axis with bars, purpose as a divider, a crosshair, who you would be, and your guesses | Empty squares; any per-square figure (withheld, I3) |
| The landing page grade | **In step 5**, beside the capital that moves it | In step 4, where it showed a number step 5 changes (the owner's catch) |
| Build order | **C**: sidebar layout, then round 0 building the shared keyword pieces, then the weekly Your keywords extending them | A (keyword pieces first, round 0 a stage later); B (round 0 with its own list, thrown away later) |

## 3. The layout

Round 0 is drawn by the sidebar layout of the makeover design (its section 2):
the icon strip, the section list, one section at a time, and the tray.

- **The section list shows the five steps**, numbered, with a tick on each one
  done. The heading reads *Before week 1*. Steps can be opened in any order from
  the list; *Next* moves forward.
- **The icon strip** shows Brand active. Market and Results are locked until
  week 1, because neither has anything to show before an auction has run (the
  rival ads are in step 2). The Guide opens from its icon and from every
  "why?".
- **The top bar** reads *Round 0 · before the first auction*, twelve empty week
  dots, and the step number.
- **The tray** holds *So far* (the choices made, as chips) and *Next: <step>*.
  At step 5 it holds a checklist of what is done and the Go button, *Open the
  account and run week 1*. A step not yet complete shows in the checklist in
  amber with what it needs; Go is disabled until all are done.
- **Go hands over to week 1** in the same layout: the section list becomes the
  weekly sections.

## 4. The five steps

Every figure below is the game's own. The canvas draws each step with the
default market's content (seed 20260902, the player as Vella & Co.).

### Step 1 · The market (read only)

- **Two lines of context**: twelve weeks against eight rival brands; you finish
  ranked by profit after returns (`ui/ending.js` ranks by net profit).
- **The three price levels** across the top: searches a week, order value,
  margin (`briefing()`, `setup.js`).
- **What a click is worth at break-even**, in the dark reading panel: the
  formula, the worked sum (₹2,400 × 52% × 58.3% × 2.8% = ₹20.37) and the
  caveat that the searches you choose are worth roughly double.
- **What you are not told**: the briefing's three hints (who buys, returns,
  competition), each under a short label.
- **Where the searches are**: the India map and the three kinds of place.
  - A switch, **All · Value · Mid · Premium**, picks whose shares are shown.
    *All* is worked from the briefing's public figures (each price level's
    shares weighted by its searches a week): metros 20%, large cities 36%,
    smaller cities and towns 44%.
  - **Each city pulses at a rate set by its kind of place's share**, for the
    price level switched to: the busiest kind rings every 1.6 seconds, the
    others more slowly in proportion. The model knows three kinds of place, not
    cities, so every city of a kind rings at that kind's rate.
  - **Tap a place or a city** to light that place: its cities brighten and are
    named, the others dim.
  - **The cities**: the game's six per kind, plus Kolkata and Ahmedabad
    (metros), six more large cities and six more towns (section 10 lists them,
    for the owner's review). Positions come from the same geonames dataset
    `design/build-cities.mjs` used for the first eighteen.
  - The returns line stays: cash on delivery outside the metros, and more of it
    coming back.

### Step 2 · Where you sit

- **The other eight**: the rival ads, four across, as searchers see them
  (headlines in bone, never red). Each carries a small 3×2 grid: **tap the
  square where you think that rival sits**. Optional; the header counts how
  many are placed.
- **Pick your square**, drawn as a diagram:
  - **Price is an axis**, value to premium, with an arrow. Under each price
    level, two bars from the briefing: searches a week (shrinking) and order
    value (growing). The trade-off the grid exists for, drawn.
  - **Purpose is a divider**, no arrow, because performance and lifestyle are
    kinds, not a scale. Each row carries the briefing's line on competition:
    *the most contested* / *fewer bidders*.
  - **The six squares** sit as one block, text centred. Each says **who you
    would be** (*An affordable gym-wear brand*, *A budget loungewear label*,
    *A serious training brand*, *An everyday athleisure label*, *A technical
    performance house*, *A considered luxury label*), the rivals **you** placed
    there with a question mark, and *You* on yours.
  - **A crosshair**: your square's price and purpose light red on the axes.
  - One line above the grid says whom you placed in your square: *if you're
    right, you'll be competing for exactly the same searches*.
- **The game never confirms a guess.** The player learns where rivals sit from
  Auction Insights, and at the end. Guesses are the player's notes, kept with
  the save (section 8), not part of the game's state.

### Step 3 · Your keywords

The weekly *Your keywords* cards and planner drawer (makeover design, section
4), before any data:

- one card per keyword: match pills, *reaches N searches*, tags on broad only,
  the bid slider with its typed figure, the ⋯ menu to remove;
- the card's weekly slots are present and empty: *QS —*, *new: no clicks yet*,
  and dashes for clicks, cost and conversions;
- no pause switch and no *was*, which only a played week can give meaning;
- *Add a keyword* opens the planner drawer: search, match, bid, *A week* and
  *Reach* per row;
- a bid under the reserve at the grade the account opens on shows one amber
  line on its card (`openingReserve`); the long warning paragraph goes.

### Step 4 · Your ad

- **Who writes it**: four writers, each with its price and what it runs at,
  from a ₹50,000 creative budget. The freelance copywriter is chosen on arrival.
  Each writer's line comes from I25: the freelancer names what you sell, the
  agency adds a hook and one concrete detail, the retainer writes from the
  customer's day.
- **As searchers see it**: the ad in the search-result block. A hired writer's
  copy is the real `content/writerCopy.js` set for your cell and the seed's
  variant. Writing it yourself opens three headline boxes and two description
  boxes, and the preview fills in as you type.
- **How it runs, from week 1**: the two parts of Quality Score the ad sets
  (expected click-through, ad relevance), each as a bar and a figure. One
  grade, the one the auction uses:
  - hired: the writer's level (6, 7 or 8) whatever the words say, and the
    screen says why: *this game cannot judge professional writing, so it takes
    the writer's level as the grade*;
  - written yourself: graded live on your words by the game's own grader, which
    the screen says checks rules, not taste.
- One line points to the third part: *the landing page is your site: you build
  it in the next step*.
- **What is left** of the creative budget goes to ads, shown under the writers.
- **Room for angles**: the message project's picker (section 11) sits above the
  ad when it is built. Nothing is drawn there until it works.

### Step 5 · Your money

- **Month 1, to spend on clicks**, in the reading panel: the total, and a bar
  of where it comes from: the base month (₹1,68,000), what the writer did not
  cost, and the capital kept. Commit capital and the month shrinks by the same
  amount (`monthlyBudget`, `ui/round-zero.js`).
- **Capital**, ₹1,20,000, in plain view: *site work goes live at week 4*, and
  how much is not committed.
- **The landing page grade**, the third part of Quality Score, live as capital
  is chosen, with its timing: its value from week 1 and, where the page's own
  capital adds points, its value from week 4 (section 6 has the figures).
- **Four targets**, each with its line, *moves: …* (the landing page grade,
  parcels sent back, how many visitors buy, parcels refused), and its rungs as
  chips with prices. A rung the capital left cannot buy is shown and disabled
  (photography's *video* at ₹1,60,000 is never affordable in round 0). Kept is
  the default; nothing is recommended.
- **Advanced**: the weekly split, even by default, four boxes when opened, and
  its note that Google offers no such decision (D10).
- **The tray**: the checklist, *You can redo round 0 once, until the end of
  week 3*, and Go.

**What leaves round 0**: the brand pick; the worked example ad (the writers'
drafts are the examples now); the capital curve chart and the page preview
(the guide can carry the curve); the weekly-split card; the reserve paragraph;
and most of the 35 blocks of explanation, which become "why?" links into the
field guide.

**Reading load**: about 150 to 200 words per step, rival ads, planner rows and
keyword names excluded, measured in the browser at the end of the build the way
the review measured its 2,648.

## 5. The rule changes

**This project changes one rule, and it is measured before it is built.**

### The writer: the fee buys not having to write

Today (DECISIONS I11) writing your own ad is free but runs at the ungraded 3/10
until week 3, and hiring buys a fixed grade from week 1. That wait was invented
to make the choice real: at honest prices hiring pays back 45 to 134 times.

**New**: writing it yourself is graded on your words **from week 1**. Hiring
still buys the writer's level from week 1. The fee buys not having to write,
and insurance: a player who writes a 4 loses far more than the fee (one grade
point is worth about ₹1,34,000 over a game, I11), a player who writes an 8
saves it.

- `CREATIVE_DIY_LIVE_ROUND` is deleted from `engine/constants.js` with its
  provenance entry, and every use goes (`setup.js`, `ui/round-zero.js`,
  `tests/setup.test.js`, `tests/writers.test.js`, `tests/dashboard.test.js`).
  CLAUDE.md rule 7: a deleted number takes its ledger entry with it.
- `tests/writerBalance.test.js` is retired: it held self-written against
  retainer near 1.0, a balance that no longer exists by design. Writing well
  now beats hiring on the numbers, and that is the point.
- **Rivals are unchanged**: they hire as today, by character.
- **DECISIONS I11 is rewritten** with the reason, and I25's "clears the boxes on
  the way to DIY" rule is kept.
- **Measured first** on `scripts/market-harness.js` (72 markets), before and
  after, against gates agreed with the owner before the run. **The harness's
  sensible player hires the agency** (`scripts/market-harness.js:79`), so the
  change would not touch it: the run adds a self-writing variant of the same
  player, writing a competent ad (the grade a careful player reaches, stated
  before the run), and compares it before and after. Proposed gates: the
  self-writing player's median rank improves by no more than one place, the
  hiring player's results do not move, and no rival's median profit falls by
  more than 5%.

### The brand: assigned

Drawn from the seed (`deriveSeed(rootSeed, 'player-brand')`), so a restart can
be a different brand and the same seed is always the same brand. The redo keeps
it. No engine change: `startGame` already takes `playerBrandId`, and the harness
and tests name theirs.

### Not changed

The engine's economics, the query set, every constant but the one above, and
the rival policies. The map's cities are display geography (`ui/india-map.js`);
nothing in `engine/` reads them.

## 6. The landing page grade, as the game computes it

From the game's own code for every affordable round-0 mix (the page described
by the capital, graded by `agents/grader.js`, plus `landingPageBonus` from week
4, capped at 10):

| The page | Size guide | Photography | From week 1 | From week 4 |
|---|---|---|---|---|
| plain | none | none | 5 | 5 |
| plain | none | any | 6 | 6 |
| plain | any | any | 7 | 7 |
| faster, ₹25,000 | none | any | 6 | 6 |
| faster | any | none | 7 | 7 |
| reviews, ₹55,000 | none | any | 7 | 9 |
| reviews | any | none | 8 | 10 |
| built around the search, ₹80,000 | none | none | 7 | 10 |
| built around the search | a chart | none | 8 | 10 |

**One question is open about the "from week 1" column** (section 12): the
description counts from week 1 although the site goes live at week 4. Step 5
shows whatever the engine does once that is settled.

## 7. Motion

The makeover's six motions stand. Round 0 uses three of them: the step
transition (row 4, direction-aware), the press on Next and Go (row 5), and the
planner drawer (row 6). A chosen square, a rung and a writer change instantly.

**One exception, decided by the owner: the map's pulse.** It is ambient and
longer than 300ms, which the six do not allow, so it is recorded here as a
named exception:

- **it carries the data**: its rate is the share of searches, for the price
  level shown, never decoration;
- 32 rings, `transform` and `opacity` only, on the game's curve
  `cubic-bezier(0.23, 1, 0.32, 1)`;
- **off for anyone who asks for reduced motion**, and it runs only while step 1
  is on screen;
- the backdrop's 150 dots stay still.

Every other motion in round 0 still has to fit the six.

## 8. How it fits the code

**Behind `?look=studio`, on `makeover`, as the rest of the makeover.** Without
the link, round 0 is today's page.

- **The shell draws round 0** as a mode of the sidebar layout: before the game
  starts, the section list holds the five steps. Round 0's draft is still the
  one `ui/round-zero.js` builds today, and Go still calls `startGame` through
  `app.js`'s `begin`; the new screens are a new way to reach the same draft.
- **One module per step**, drawing only; the rules each step needs (the month,
  the reserve, the grades) stay in the functions that already compute them
  (`monthlyBudget`, `openingReserve`, `gradeAsSubmitted`, `submittedAd`), moved
  out of `ui/round-zero.js` into a pure module the steps share, so they can be
  tested without a page.
- **The shared kit is built here** (order C): the slider with type-in, pills,
  the switch, the stat, the keyword card and the planner drawer, all in the
  shapes the makeover's plan specified for *Your keywords*. The weekly section
  later adds the week's figures to the same card.
- **The map** becomes one drawing module used twice: round 0's step 1 now, the
  *Where and when* control later. More cities means extending `content/
  locations.js`'s examples (the words) and `ui/india-map.js`'s `CITY_POINTS`
  (the positions, from the geonames dataset; the download needs the owner's yes
  with its name and size).
- **Words**: every sentence in `ui/words/`, one file for round 0, under the
  content model (no digit typed; figures handed in). The drawing modules hold
  none (the makeover's guard).
- **Guesses** are the player's notes: stored with the browser save, next to the
  game's own view state, never in `GameState` or the decision log. A reload
  restores them.
- **The recorder** names each step as a section and each new control, so the
  playtests can read round 0 (the makeover design, section 5).
- **The old `.setup` skin** is left for the classic look; the Studio round 0
  never draws a `.setup` card.

**Traps this must respect** (CLAUDE.md and the makeover's own):

- every new `ui/` module joins `LOADABLE` in `tests/ui.test.js` and touches no
  `document` or `window` while loading;
- no `ui/` file names the withheld query fields or `homeCell`, and nothing in
  round 0 plots a territory or states a rival's square (I3, C5);
- red means you: rival ads, planner rows and the map never use it except for
  the player's own choices;
- the build publishes exactly what the game loads, so the file count moves on
  purpose and is written down.

## 9. Build order

C, decided by the owner:

1. **The sidebar layout**: makeover plan Tasks 3–5 (sections, the tray's order,
   the shell).
2. **Round 0 in the new look**, all five steps. It builds the shared kit, the
   keyword card's base and the planner drawer on the way. The writer rule is
   measured on the harness and built as its own task, one concern per commit.
3. **The weekly *Your keywords***: makeover plan Tasks 6–9, extending the same
   card with the week's figures, the reading panel and *Adjust several*.
4. **The message project** (section 11), its own design first.
5. **The rest of the Studio plan**: the other sections, *Where and when* with
   the map as a control, the switch-over.

The owner plays round 0 in the browser when step 2 is done, and says whether it
feels alive. That is the gate, as it was for the pilot.

## 10. For the owner to review before the build

- **The cities.** Metros: Mumbai, Delhi NCR, Bengaluru, Hyderabad, Chennai,
  Pune, **Kolkata, Ahmedabad**. Large cities: Jaipur, Lucknow, Kochi, Indore,
  Chandigarh, Coimbatore, **Nagpur, Visakhapatnam, Bhopal, Patna, Bhubaneswar,
  Vadodara**. Smaller cities and towns: Guwahati, Raipur, Jodhpur, Salem,
  Warangal, Siliguri, **Dehradun, Udaipur, Mysuru, Gorakhpur, Jammu,
  Hubballi**. The line between a large city and a town is fuzzy in any list;
  these follow the grouping `content/locations.js` already uses.
- **"A budget loungewear label"** keeps a little of the tone "cheap" had; kept
  for now, one "affordable" per column.
- **The harness gates** in section 5, and the grade the self-writing variant
  writes at, agreed before the run.

## 11. Decided for the message project, designed later

Recorded here because round 0's step 4 leaves room for it. It needs its own
design doc, a spec change and DECISIONS entries before any build.

- **The goal**: the game stays about the auction and the money, with a simple
  way to teach message strategy, and ads that feel more real.
- **The mix**: **angles change who clicks; images come later.**
  - *Angles*: a writer offers two or three for your position (lead with price,
    proof, material or comfort). An angle becomes a factor in the quality
    signal beside `queryKeywordFit`, read against each search's leanings, so a
    message that suits a searcher raises the chance of a click and the ad rank
    on that search. Who buys still depends on where the brand really sits. The
    feasibility check found the engine already shaped for it (one factor, once
    per brand per search per week); its size has no source yet, so it is
    INVENTED until one is found; calibration and the harness run again; every
    rival needs an angle rule.
  - *Images*: from week 9, when the account turns 60 days old (Google Ads'
    rule for image assets on Search), chosen from generated images as Google's
    own workflow lets advertisers do. Google's documented effect is "a 6%
    increase in click-through rate on average when image assets show"; the game
    uses that and says plainly that it cannot judge a picture.
  - *Fees*: the writer's fee introduced in round 0 extends to each extra ad
    later.
- Sources, fetched 2026-09-14: Google Ads Help, *About image assets for Search
  campaigns* (answer 9566341), *About generated images in Google Ads* (answer
  14150986), *About responsive search ads* (7684791), *About your data segments
  for Search ads* (2701222).

## 12. Open, and running

- **The landing page grade's timing.** Round 0's capital raises the graded
  landing page from week 1, through the description it buys, though the site
  goes live at week 4. A background task is checking it; the owner decides what
  changes. Step 5 shows whatever the engine does then.
- **Carrying guesses into the end-of-game reveal** (*Where did they sit?*, G1's
  debrief) is a later decision, not part of this build.

## 13. Where it came from

The canvas: https://claude.ai/code/artifact/b89a625b-19ea-4d93-b90b-a548f1d97680,
with its source in `design/round-zero/`:

| Board | Page |
|---|---|
| `MarketMap.dc.html` | Step 1 · The market (chosen, with the three motions to compare) |
| `Main.dc.html` | Step 2 · Where you sit (chosen) |
| `KeywordsCards.dc.html`, `KeywordsList.dc.html` | Build order and step 3: the shared cards (A and C) and the throwaway list (B) |
| `AdStep.dc.html`, `MoneyStep.dc.html` | Steps 4 and 5 |
| `Flow.dc.html`, `MapCut.dc.html`, `MapKept.dc.html` | Not chosen, kept as the record |

Real content throughout: the default market's rival ads (seed 20260902, the
player as Vella & Co.), the briefing's figures, engine-counted reach for the
planner rows, the writers' real copy and prices, the capital rungs, and the
landing page grades from the game's own code. The added cities' positions on
the canvas are approximate; the build takes them from the dataset.

## 14. Corrected by the build

Each was agreed with the owner, either before the build (the plan's *Where
this plan narrows or departs from the spec*) or when playing it. The plan's
tasks carry the detail, in their *Found when built* notes.

- **The default market's brand (section 4).** With the brand drawn from the
  seed, seed 20260902 draws Marlow, not Vella & Co.; the canvas's Vella & Co.
  was for illustration.
- **The cities (sections 4 and 8).** The first eighteen had been typed by hand
  (`SIM` in `design/build-cities.mjs`); only the backdrop came from the geonames
  dataset. All 32 now come from the dataset, and five pairs of names that
  collided when a kind of place was lit are placed apart (`labelPlace`,
  `ui/india-map.js`).
- **The backdrop (section 7)** is 135 dots, not 150: fifteen that crowded the
  new cities were dropped.
- **The returns line (section 4, step 1) is cut**, by the owner: where to
  advertise is chosen week by week, never in round 0, and the weekly card shows
  each place's returns in the player's own figures. The classic page keeps it.
- **On a phone (section 3).** Under 900px the top bar drops the week dots and
  *before the first auction*. Under 700px *So far* takes its own line above
  *Next*, and step 5's tray drops it, since the checklist beside Go names the
  same four things.
- **The strip's Market and Results (section 3)** are greyed out in the
  coastline's grey, 3.47:1, readable and still plainly off (the owner's ruling).
- **`tests/writerBalance.test.js` was rewritten, not retired (section 5).** Two
  of its orderings still hold: *paying more buys more*, and *writing badly
  loses to the cheapest writer*. The third flips to *writing well beats the
  retainer*, which is the new rule's point.
- **I25's second rule changed (section 5)**, by the owner, found by playing step
  4: a hired writer's ad is always the writer's copy, and the player's own words
  are set aside in `draft.ownAd`, coming back when they choose Write it
  yourself. The first rule, empty boxes on the way to writing it yourself,
  applies only when there are no words of their own.
- **Two guide chapters were written for round 0's "why?" links (section 4)**,
  which had nowhere to go: *Who writes the ad* and *Splitting the month into
  weeks* (`ui/guide/chapters.js`).
- **Round 0 has its own controller (section 8)**, `ui/roundzero/studio.js`,
  sharing the shell's classes, icons and kit, rather than being a mode of
  `ui/shell/shell.js`, whose every draw function reads a played game. On screen
  it is the same layout.
- **Guesses live in round 0's draft only (section 8)**, not the browser save.
  Round 0 is never saved (the save is the state before week 1 plus the log), so
  a reload in round 0 loses every choice, guesses included, as it always has;
  after Go nothing reads them.
- **The guide's *Show me on the card* is hidden before week 1**
  (`canShowCard`, `ui/guide/drawer.js`): there is no card to show yet, and a
  button that does nothing is worse than none.
- **Motion (section 7).** Round 0 uses the step transition, the press, the
  planner drawer and the keyword card's menu (the makeover's row 6 is drawers
  and the menu). Each city's ring starts part-way through its cycle
  (`pulseDelay`, `ui/map/india.js`), so redrawing the map never blanks it.
- **The build order (section 9)** began after makeover Task 6, not 5: the
  keyword card opens that task's Quality Score chapter from its *QS* button.
- **The landing page's timing (section 12) is confirmed, and not yet decided.**
  A background check found that a page bought in round 0 raises the graded
  landing page in week 1's auctions, though the site work goes live at week 4:
  reviews take it from 5 to 7 in week 1 and to 9 at week 4. Step 5 shows what
  the engine does. HANDOVER's *Start here* says where the check's test is; the
  owner decides what changes, and any change is measured on the harness first.
