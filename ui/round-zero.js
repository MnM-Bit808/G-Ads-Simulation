/**
 * Round 0 on screen (spec 17).
 *
 * The most consequential decisions in the game, taken before the player has
 * seen a single auction. 17.3 exists because of that, and this screen's job is
 * to make the incompleteness legible rather than to hide it: the briefing shows
 * what a founder could research and says plainly which two of break-even's four
 * inputs are being withheld.
 *
 * WHAT THIS SCREEN MUST NOT DO
 *
 * Rival positions are never stated, only inferred (17.1). So the eight rival
 * ads are shown unordered, with no cell, and nothing on this page maps a brand
 * to a square. The whole round 0 mechanic is reading those ads.
 *
 * The keyword research list is Keyword Planner: text, volume and intent, and
 * nothing else. `priceAffinity`, `purposeAffinity` and `convMultiplier` are
 * withheld from everyone including the advertiser they favour (16.1, C4), and
 * `tests/ui.test.js` fails if this file so much as names one.
 *
 * IT USED TO MARK THE PLAYER'S OWN TERRITORY with a dot, using `homeCell()` —
 * which is computed from exactly those two affinities. It was a leak, and it
 * was doing the round 0 decision FOR the player: which of these searches are
 * mine is the question 4.1 says positioning answers, and reading the words is
 * how a founder answers it. The evidence it was not even helping is in
 * HANDOVER: the account that bought the top five rows by volume had the dot on
 * screen the whole time.
 */

import {
  el, add, table, field, input, select, rupees, whole, scrollX,
} from './dom.js';
import { briefing, placeRivals, buildRivals } from '../setup.js';
import { BRAND_IDENTITIES, assignIdentities, brandNamedIn } from '../content/brands.js';
import { cellKey, parseCell } from '../engine/positions.js';
import { writerCopyFor, WRITER_COPY_VARIANTS } from '../content/writerCopy.js';
import { validateAdCopy, namesARival, explainGrade } from '../agents/grader.js';
import { heuristicTags, tagKeywordOffline } from '../agents/keywordTagger.js';
import { keywordReach } from '../engine/matching.js';
import { FORM } from './words/form.js';
import {
  HEADLINE_MAX_CHARS, DESCRIPTION_MAX_CHARS, MONTHLY_BUDGET_PAISE,
  CAPEX_ALLOCATION_PAISE, ROUNDS_PER_MONTH,
  WRITER_TIERS, CREATIVE_ALLOCATION_PAISE, CREATIVE_DIY_LIVE_ROUND,
  PRICE_TIERS, PURPOSES, CAPEX_TIER_CURVE,
} from '../engine/constants.js';
import {
  writerTier, isDiy, hiredCopyGrades, openingCopyGrades,
} from '../content/writers.js';
import { qualitySignalBase } from '../engine/quality.js';
import { minimumBidToShowPaise } from '../engine/auction.js';
import { PAGE_FEATURES, composeDescription, pageShape } from './landing-page.js';
import { MAP_VIEWBOX, INDIA_PATH, CITY_POINTS, BACKDROP } from './india-map.js';

const CAPEX_TARGETS = [
  ['landingPage', 'The page itself', 'Better quality, so a cheaper click. Worth most in the middle.'],
  ['sizeGuide', 'Size guide', 'Fewer parcels sent back after delivery. Worth most at the cheap end, '
    + 'and to anything sold on how it looks.'],
  ['photography', 'Photography', 'More of your visitors buy. Worth most where the decision is considered.'],
  // I29: the only one that is not about the page, and the only defence against
  // the freight a refused parcel costs.
  ['orderConfirmation', 'Order confirmation', 'Fewer parcels refused at the door. Worth most '
    + 'where cash on delivery is commonest, which is the cheap end and the small towns.'],
];

/**
 * The landing page description is DERIVED, never typed (DECISIONS I9).
 *
 * It used to be a text box whose own hint said "it exists to be graded", and
 * the grader read it for two regexes — so writing the words "size guide" earned
 * the grade that BUYING one costs capital for. Composing it from the capital
 * instead means a claim without a purchase behind it cannot be made.
 */
/**
 * Is this rung on the steep part of the S?
 *
 * Derived from the curve rather than hard-coded to two indices, so widening
 * CAPEX_TIER_CURVE cannot leave the drawing highlighting the wrong bars. A rung
 * is steep when it gains more than an even share of the total climb.
 *
 * @param {{paise: number, effect: number}} tier
 * @returns {boolean}
 */
function steepRung(tier) {
  const i = CAPEX_TIER_CURVE.indexOf(tier);
  if (i <= 0) return false;
  const gain = tier.effect - CAPEX_TIER_CURVE[i - 1].effect;
  const total = CAPEX_TIER_CURVE[CAPEX_TIER_CURVE.length - 1].effect - CAPEX_TIER_CURVE[0].effect;
  return gain > total / (CAPEX_TIER_CURVE.length - 1);
}

function syncPage(draft) {
  draft.ad.landingPageDescription = composeDescription(draft.capex);
}

/** Has anybody put words in the two boxes that block the Go button? */
const anyCopyWritten = (ad) => [...(ad.headlines ?? []), ...(ad.descriptions ?? [])]
  .some((line) => String(line).trim() !== '');

/**
 * Fill the ad boxes from the writer the player hired, or empty them (I25).
 *
 * A player paid 50,000 for the retainer and could not start the game, because
 * the Go button asks `validateAdCopy` and the description boxes were empty.
 * They had hired a copywriter and were still required to write the copy.
 *
 * THREE RULES, AND EACH ONE IS A WAY THIS COULD GO WRONG.
 *
 * It never overwrites what the PLAYER wrote. `draft.adIsSeeded` records whose
 * words are in the boxes, so switching tier rewrites a delivered ad but leaves a
 * hand-written one alone. Without it, typing three headlines and then changing
 * your mind about the writer would silently discard them.
 *
 * It CLEARS on the way to DIY, which is the whole reason the flag exists. The
 * words belong to the writer who was paid for them, and carrying an agency's
 * copy into DIY takes something the player did not buy — measured, retainer
 * copy grades `adRelevance` 1 against the keywords, so keeping it would punish
 * them for holding on to the best writing in the game.
 *
 * The variant follows `rootSeed`, which `app.js` increments for a new market,
 * so restarting shows a different ad rather than the same one three times.
 */
function syncWriterCopy(draft, rootSeed) {
  if (isDiy(draft.writerTier)) {
    if (draft.adIsSeeded) {
      draft.ad.headlines = ['', '', ''];
      draft.ad.descriptions = ['', ''];
      draft.adIsSeeded = false;
    }
    return;
  }
  if (!draft.adIsSeeded && anyCopyWritten(draft.ad)) return;

  const brand = BRAND_IDENTITIES.find((b) => b.id === draft.playerBrandId);
  const copy = writerCopyFor(
    draft.cell, draft.writerTier, brand.name, rootSeed % WRITER_COPY_VARIANTS,
  );
  draft.ad.headlines = copy.headlines;
  draft.ad.descriptions = copy.descriptions;
  draft.adIsSeeded = true;
}

/**
 * @param {object} args
 * @param {object} args.querySet
 * @param {number} args.rootSeed
 * @param {(choices: {playerBrandId: string, player: object}) => void} args.onStart
 * @returns {HTMLElement}
 */
export function renderRoundZero({ querySet, rootSeed, onStart }) {
  const brief = briefing(querySet);

  const draft = {
    playerBrandId: BRAND_IDENTITIES[0].id,
    cell: 'mid|performance',
    capex: Object.fromEntries(CAPEX_TARGETS.map(([key]) => [key, 0])),
    keywords: [],
    // landingPageDescription is derived from `capex` by syncPage, below.
    ad: { headlines: ['', '', ''], descriptions: ['', ''], landingPageDescription: '' },
    // Who writes it (I11). DIY by default because writing their own copy is
    // what the player has always done here; hiring is the new option.
    writerTier: 'diy',
    // Whose words are in the ad boxes. `syncWriterCopy` rewrites a delivered
    // ad and never a written one, and it cannot tell them apart from content.
    adIsSeeded: false,
    split: null,
    // What is typed in the planner's search box. UI state, kept on the draft
    // because adding a keyword rebuilds the whole form and would otherwise
    // throw the filter away — which is most annoying exactly when the filter
    // is doing the most work.
    keywordFilter: '',
  };
  syncPage(draft);

  const root = el('div', 'setup');

  /**
   * Everything a keystroke changes, and nothing a keystroke does not.
   *
   * `rerender` replaces the whole form, which is right for a click — a new cell,
   * a keyword added — and catastrophic for typing: the input you are typing
   * into is destroyed, focus falls to <body>, and every character after the
   * first is swallowed. Typing "Built" into a headline by hand produced "B".
   * A script re-queried the field after each character and never saw it.
   *
   * So a keystroke writes into the draft and then refreshes only the things
   * DERIVED from it — the character counters, the copy warnings, the budget
   * total, and whether the Go button is allowed to be pressed.
   */
  const live = { ad: null, writer: null, budget: null, start: null, keywords: null };
  const revalidate = () => {
    live.ad?.();
    // The reserve note is derived from a bid the player is typing INTO the
    // keyword table, so it refreshes the same way the counters do rather than
    // rebuilding the table and taking the cursor with it.
    live.keywords?.();
    // The writer card quotes the self-written grade, so it is derived from the
    // ad and has to move with it.
    live.writer?.();
    live.budget?.();
    live.start?.();
  };

  const rerender = () => {
    root.replaceChildren();
    add(root,
      sectionBrand(draft, querySet, rerender, rootSeed),
      sectionBriefing(brief),
      // Split out of the briefing (G4). Full width because the table needs the
      // room beside its explanation rather than under it, and because seven
      // half-width cards leave one orphaned in a row of its own.
      sectionWhereSearch(brief),
      sectionRivals(querySet, rootSeed, draft),
      sectionPosition(brief, draft, rerender, rootSeed),
      // WRITER BEFORE KEYWORDS, AND CAPITAL AFTER THEM, which is a layout
      // constraint rather than a reading preference and is worth saying so.
      // Three cards here are full width, so the half-width ones pair in the gaps
      // between them; the stack below has to land beside CAPITAL (670px) because
      // that is the only card tall enough to hold "This month" and the example
      // without adding a row. Any other order orphans a card. The writer card
      // already handles being read before the planner - with no keywords chosen
      // it says "pick them first" rather than scoring relevance against nothing.
      sectionWriter(draft, rerender, live, rootSeed),
      sectionKeywords(querySet, draft, rerender, live),
      sectionCapex(draft, rerender),
      // Before the ad, and that is a dependency rather than a layout choice:
      // whatever the writer did not cost rolls into the month this divides.
      //
      // STACKED IN ONE CELL so the example fills the slack under the budget card
      // rather than starting a row of its own. `.setup` is a two-column grid with
      // `align-items: start`, so a shorter card leaves its column empty for the
      // rest of the row - "Who writes it" is 500px and "This month" 271px, and
      // that 229px gap is where the example goes. Adding it as a seventh
      // half-width card would instead orphan one card in a row of its own.
      stack(
        sectionBudget(brief, draft, revalidate, live),
        sectionExample(),
      ),
      sectionAd(draft, revalidate, live),
      sectionStart(draft, onStart, live));
  };
  rerender();
  return root;
}

/** Two cards in one grid cell, so the second fills the slack under the first. */
const stack = (...cards) => {
  const node = el('div', 'setup-stack');
  add(node, ...cards);
  return node;
};

const card = (title, subtitle, wide = false) => {
  const node = el('section', `card setup-card${wide ? ' wide' : ''}`);
  const h = el('h2', null, title);
  if (subtitle) h.append(el('span', 'muted', subtitle));
  node.append(h);
  return node;
};

// ---------------------------------------------------------------------------
// 2. The brand
// ---------------------------------------------------------------------------

function sectionBrand(draft, querySet, rerender, rootSeed) {
  const node = card('Your brand', 'nine names, and none of them says anything');
  const row = el('div', 'chips');
  for (const brand of BRAND_IDENTITIES) {
    const chip = el('button', `chip${brand.id === draft.playerBrandId ? ' on' : ''}`);
    chip.type = 'button';
    chip.append(el('strong', null, brand.name));
    chip.append(el('span', 'muted', brand.domain));
    chip.addEventListener('click', () => {
      draft.playerBrandId = brand.id;
      syncWriterCopy(draft, rootSeed);
      rerender();
    });
    row.append(chip);
  }
  node.append(row);
  node.append(el('p', 'note',
    'The other eight go to your rivals. The names are deliberately abstract: a '
    + 'brand called BudgetBox turning up in the premium tier would mislead you, '
    + 'and position here is signalled entirely through ad copy.'));

  // The one thing the choice actually decides. Ownership is INFERRED from the
  // words, the way a player would - `brandOwner` is withheld from every viewer
  // (16.1) - and your own name is yours to recognise.
  const me = BRAND_IDENTITIES.find((b) => b.id === draft.playerBrandId);
  const own = querySet.queries.find((q) => q.intent === 'brand'
    && brandNamedIn(q.text, [me]));
  if (own) {
    const weekly = Math.round((querySet.weeklyVolume * own.volumeShareBp) / 10000);
    const line = el('p', 'own-brand');
    line.append(document.createTextNode('Picking it also gives you a search. People type '));
    line.append(el('strong', null, `“${own.text}”`));
    line.append(document.createTextNode(
      ` about ${whole(weekly)} times a week, and somebody searching your name buys `
      + 'far more often than somebody searching a category — it is the cheapest '
      + 'good traffic in the market. It is also the easiest to lose: nothing stops '
      + 'a rival bidding on your name, and if you are not there when they do, they '
      + 'get the click. You have to add it as a keyword like any other.',
    ));
    node.append(line);
  }
  return node;
}

// ---------------------------------------------------------------------------
// 6. The briefing (17.2)
// ---------------------------------------------------------------------------

function sectionBriefing(brief) {
  const node = card('The market', 'what you could research before spending anything');

  const volumes = el('table', 'mini');
  table(volumes,
    ['Tier', { label: 'Searches / week', num: true }, { label: 'Order value', num: true },
      { label: 'Margin', num: true }],
    ['value', 'mid', 'premium'].map((tier) => ({
      cells: [
        tier,
        whole(brief.weeklySearchesByTier[tier]),
        rupees(brief.economicsByTier[tier].aovMeanPaise),
        `${Math.round(100 * brief.economicsByTier[tier].marginPct)}%`,
      ],
    })));
  node.append(scrollX(volumes));

  const anchor = el('div', 'anchor');
  anchor.append(el('div', 'anchor-formula', brief.breakEvenFormula));
  anchor.append(el('div', 'anchor-sum', brief.workedAnchor.arithmetic));
  anchor.append(el('p', 'anchor-caveat', brief.workedAnchor.caveat));
  node.append(anchor);

  const hints = el('ul', 'hints');
  for (const hint of Object.values(brief.hints)) hints.append(el('li', null, hint));
  node.append(el('p', 'field-label', 'What you are not being told'));
  node.append(hints);
  node.append(el('p', 'note',
    `Break-even has four inputs. You have been given two and a worked example. `
    + `You have to estimate the other two — and the month-3 budget is redistributed `
    + `by ${brief.rankingRule.metric}, announced now so you can plan for it.`));
  return node;
}

/**
 * Where the searching happens (G4), its own section rather than the tail of the
 * briefing.
 *
 * THE HALF THAT MATTERS MOST IS THAT THE METROS ARE THE SMALLEST OF THE THREE,
 * which is what makes "just advertise in the metros" a plan that runs out rather
 * than a plan that wins. So it is in the subtitle, where the card is read.
 *
 * The share is given per price tier because that is the shape of the fact: a
 * premium brand's customers and a value brand's are not in the same places. What
 * is NOT given is what a click is worth in each, or which tier suits which
 * position. That is the decision, and it is read from the location report.
 *
 * WIDE, AND THE TABLE SITS BESIDE ITS NOTE RATHER THAN ABOVE IT. Measured: as a
 * half-width card it orphans one of seven cards into a row of its own (+118px);
 * stretched full width with the note underneath, four columns spread over
 * 1385px and leave a 350px hole in the middle (+36px). Beside it, the card is
 * 244px and the page comes out 24px SHORTER than before the split. Same move
 * I22 made on the ad card, for the same reason.
 */
function sectionWhereSearch(brief) {
  const node = card('Where the search happens',
    'most searches happen outside the metros', true);

  // The card owns which tier is lit. Local state, not draft state: choosing a
  // tier here changes nothing about the account, it only asks the card to show
  // one row of a table it is already showing.
  let lit = null;

  const split = el('div', 'where-split');
  const mapWrap = el('div', 'india-wrap');
  const right = el('div');
  split.append(mapWrap, right);
  node.append(split);

  const places = el('table', 'mini places');
  right.append(places);
  right.append(el('p', 'note', brief.returnsVaryByLocation));

  const rowFor = {};
  const draw = () => {
    mapWrap.replaceChildren(indiaMap(brief.locations, lit, (id) => {
      lit = lit === id ? null : id;
      draw();
    }));
    for (const [id, row] of Object.entries(rowFor)) {
      row.classList.toggle('dim', lit !== null && lit !== id);
      row.classList.toggle('on', lit === id);
    }
  };

  table(places,
    ['Where', { label: 'Value', num: true }, { label: 'Mid', num: true },
      { label: 'Premium', num: true }],
    brief.locations.map((place) => {
      const name = el('div');
      name.append(el('div', null, place.label));
      // All six, not the first three. The card used to slice to three and throw
      // the rest away, which is most of what the map now draws.
      name.append(el('div', 'muted small', place.examples.join(', ')));
      return {
        cells: [
          name,
          `${Math.round(100 * place.shareOfSearches.value)}%`,
          `${Math.round(100 * place.shareOfSearches.mid)}%`,
          `${Math.round(100 * place.shareOfSearches.premium)}%`,
        ],
        onRow: (tr) => {
          rowFor[place.id] = tr;
          tr.classList.add('pick');
          tr.addEventListener('click', () => {
            lit = lit === place.id ? null : place.id;
            draw();
          });
        },
      };
    }));

  draw();
  return node;
}

/**
 * The country, with the tiers on it.
 *
 * WHY A MAP AT ALL. The card names eighteen real cities across three tiers, so
 * this is the chart the data already asks for rather than an ornament: the
 * shape of the argument is that the metros are the SMALLEST of the three, and a
 * table of percentages says that in a way nobody feels.
 *
 * `lit` is a location tier id or null for all of them. Everything the card draws
 * comes from `brief.locations` (17.2, public) and `ui/india-map.js` (display
 * geography); no engine constant and no affinity field is touched here.
 *
 * @param {Array<object>} locations from `briefing(querySet)`
 * @param {string|null} lit the tier to light, or null for every one
 * @param {(id: string) => void} onPick called with a tier id when a city is clicked
 * @returns {SVGElement}
 */
function indiaMap(locations, lit, onPick) {
  const NS = 'http://www.w3.org/2000/svg';
  const make = (tag, attrs) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    return n;
  };

  const svg = make('svg', { viewBox: MAP_VIEWBOX, class: 'india' });

  const defs = make('defs', {});
  const glow = make('filter', { id: 'city-glow', x: '-80%', y: '-80%', width: '260%', height: '260%' });
  glow.append(make('feGaussianBlur', { stdDeviation: 3.2, result: 'b' }));
  const merge = make('feMerge', {});
  merge.append(make('feMergeNode', { in: 'b' }), make('feMergeNode', { in: 'SourceGraphic' }));
  glow.append(merge);
  defs.append(glow);
  svg.append(defs);

  svg.append(make('path', { d: INDIA_PATH, class: 'india-halo', filter: 'url(#city-glow)' }));
  svg.append(make('path', { d: INDIA_PATH, class: 'india-land' }));

  // The backdrop twinkles on staggered delays. A single shared animation would
  // pulse 150 dots in lockstep, which reads as a flashing screen rather than a
  // country with the lights on.
  const back = make('g', { class: 'india-backdrop' });
  for (const [i, [x, y]] of BACKDROP.entries()) {
    const dot = make('circle', { cx: x, cy: y, r: 2 });
    dot.style.animationDelay = `${((i * 0.21) % 4.5).toFixed(2)}s`;
    back.append(dot);
  }
  svg.append(back);

  svg.append(make('rect', { class: 'india-scan', x: 0, y: 0, width: 450, height: 2 }));

  for (const place of locations) {
    const g = make('g', { class: `india-tier${lit && lit !== place.id ? ' dim' : ''}` });
    const drawn = place.examples.map((n) => CITY_POINTS[n]).filter(Boolean);

    // A ring through the tier's cities, so a tier reads as a network rather than
    // as scattered dots. Drawn under them, and it flows.
    for (let i = 0; i < drawn.length; i += 1) {
      const [ax, ay] = drawn[i];
      const [bx, by] = drawn[(i + 1) % drawn.length];
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.hypot(dx, dy) || 1;
      const bend = 16 + (i % 3) * 8;
      g.append(make('path', {
        class: 'india-arc',
        d: `M${ax} ${ay} Q${(mx - (dy / len) * bend).toFixed(1)} ${(my + (dx / len) * bend).toFixed(1)} ${bx} ${by}`,
      }));
    }

    for (const [i, name] of place.examples.entries()) {
      const point = CITY_POINTS[name];
      // A city the map has no coordinate for is skipped rather than guessed at.
      if (!point) continue;
      const [x, y] = point;
      // CLICKING A CITY PICKS ITS TIER, because a glowing dot that does nothing
      // when pressed is the control this card already had too many of.
      const pin = make('g', { class: 'india-pin' });
      const halo = make('circle', { cx: x, cy: y, class: 'india-halo-city' });
      halo.style.animationDelay = `${(i * 0.19).toFixed(2)}s`;
      pin.append(halo);
      pin.append(make('circle', { cx: x, cy: y, r: 6, class: 'india-city', filter: 'url(#city-glow)' }));
      pin.append(make('circle', { cx: x, cy: y, r: 3, class: 'india-city-core' }));
      const label = make('text', {
        x: x + 9, y: y + 3, class: `india-label${lit === place.id ? ' show' : ''}`,
      });
      label.textContent = name;
      pin.append(label);
      pin.addEventListener('click', () => onPick(place.id));
      g.append(pin);
    }
    svg.append(g);
  }
  return svg;
}

/**
 * One worked ad, rendered the way a searcher meets it, with what each part is
 * doing (asked for, to learn from).
 *
 * IT IS AN EXAMPLE, NOT AN ANSWER, and the model makes that true rather than the
 * wording. `adRelevance` is scored against YOUR OWN keywords, so an ad copied
 * from here scores WORSE than the same effort in the player's own words - the
 * one component a self-written ad can take to 10 is the one copying forfeits.
 * That is why a worked example is safe here where I3's territory dot was not:
 * the dot did the decision, this cannot.
 *
 * IT IS NOT THE BEST POSSIBLE AD, deliberately. I10 caps `expectedCtr` at 8 on
 * rules alone and refuses to pretend regexes can award a 9 - so showing a "10"
 * would claim a judgement the offline grader cannot make. This one satisfies the
 * three rules that carry most of the score, and says so.
 */
const EXAMPLE_AD = Object.freeze({
  domain: 'example.in',
  headlines: Object.freeze([
    'Gym Leggings That Hold',
    'Squat Proof, Sweat Tested',
    'Sizes XS To XXL In Stock',
  ]),
  descriptions: Object.freeze([
    'Leggings that hold through 4 sessions a week, wash after wash.',
    'Free delivery over ₹999, and 30 day returns if the fit is wrong.',
  ]),
});

/** What each rule is doing, in the order the grader weighs it. */
const EXAMPLE_REASONS = Object.freeze([
  'Three headlines doing three different jobs — what it is, why it lasts, whether it fits. Only one shows at a time, so saying one thing three ways wastes two of them.',
  'Numbers instead of adjectives: 4 sessions, ₹999, 30 days. "Premium quality" is a claim; a number is evidence.',
  'It uses the words people type. Relevance is scored against your own keywords, so echoing the search is worth more than reading well.',
]);

function sectionExample() {
  const node = card('A worked example', 'one ad, and what each part is doing');
  node.append(serpBlock({ domain: EXAMPLE_AD.domain, headlines: [...EXAMPLE_AD.headlines], descriptions: [...EXAMPLE_AD.descriptions] }));
  const list = el('ul', 'hints');
  for (const reason of EXAMPLE_REASONS) list.append(el('li', null, reason));
  node.append(list);
  node.append(el('p', 'note',
    'Copying it will score worse than your own words: relevance is measured '
    + 'against the keywords you chose.'));
  return node;
}

// ---------------------------------------------------------------------------
// 7. The rival ads, unordered (17.1)
// ---------------------------------------------------------------------------

function sectionRivals(querySet, rootSeed, draft) {
  const me = BRAND_IDENTITIES.find((b) => b.id === draft.playerBrandId);
  // Eight rival ads on an auto-fill grid. Given the width it lays them four
  // across instead of two, which is the difference between one screen and two.
  const node = card('Who else is here',
    `the other eight, in no particular order — the ninth is you`, true);

  // Built from the same seed the game will use, so what is read here is what
  // will be played against. Position is never stated: it is in the words.
  const { rivals: identities } = assignIdentities(draft.playerBrandId);
  const placement = placeRivals(rootSeed, identities.length);
  // The SAME builder startGame uses, so what is shown here is what will be
  // played against — including which of a cell's two ads each rival wears.
  const ads = buildRivals(identities, placement, querySet, () => 0.5)
    .map((rival) => ({ name: rival.name, domain: rival.domain, ad: rival.adGroups[0].ad }))
    .sort((a, b) => (a.name < b.name ? -1 : 1));

  // The same block the player's own ad is previewed in, because these are the
  // same kind of object and 17.1 makes this copy the only evidence of position.
  const grid = el('div', 'rival-grid');
  for (const { name, domain, ad } of ads) {
    grid.append(serpBlock({
      name, domain, headlines: ad.headlines, descriptions: ad.descriptions,
    }));
  }
  node.append(grid);
  node.append(el('p', 'note',
    `There are nine brands and ${me.name} is yours, so eight are listed. Nobody `
    + 'will tell you where any of them sits on the grid: the copy is the only '
    + 'evidence you get before the first auction, and after that, how often you '
    + 'meet them in Auction Insights. Two rivals can share a cell, and when they '
    + 'do they are competing for exactly the same searches you would be.'));
  return node;
}

// ---------------------------------------------------------------------------
// 8. Position
// ---------------------------------------------------------------------------

function sectionPosition(brief, draft, rerender, rootSeed) {
  const node = card('Where you sit', 'chosen once, and fixed until round 5');
  const matrix = positionMatrix();

  // A MATRIX, WITH ITS AXES LABELLED. Six buttons in a three-column flow read as
  // a grid whose position means nothing; price on the columns and purpose on the
  // rows is the model 4.1 describes, and this is the only place it is drawn.
  //
  // NO CELL IS MARKED AS THE PLAYER'S. I3 removed exactly that, because it was
  // computed from the two affinity fields 16.1 withholds from every viewer — and
  // because working out which searches are yours is the decision this card exists
  // to make.
  const grid = el('div', 'cell-grid');
  grid.append(el('div', 'cell-corner'));
  for (const price of matrix.prices) grid.append(el('div', 'cell-colhead', price));

  for (const row of matrix.rows) {
    grid.append(el('div', 'cell-rowhead', row.purpose));
    for (const { key, price } of row.cells) {
      const box = el('button', `cell${key === draft.cell ? ' on' : ''}`);
      box.type = 'button';
      // The purpose is on the row and the price on the column, so the name here
      // would repeat both. The axes carry it.
      box.append(el('div', 'cell-name', `${price} · ${row.purpose}`));
      // From the BRIEFING, not from POSITION_ECONOMICS. 17.2 decides what a
      // founder could have researched; this only draws it. Reaching past the
      // briefing into the constants would be how a screen starts showing numbers
      // the player was never meant to have.
      const economics = brief.economicsByTier[price];
      box.append(el('div', 'cell-econ',
        `${rupees(economics.aovMeanPaise)} order · `
        + `${Math.round(100 * economics.marginPct)}% margin`));
      box.append(el('div', 'cell-vol',
        `${whole(brief.weeklySearchesByTier[price])} a week in this tier`));
      box.addEventListener('click', () => {
        draft.cell = key;
        syncWriterCopy(draft, rootSeed);
        rerender();
      });
      grid.append(box);
    }
  }
  node.append(grid);
  node.append(add(el('p', 'cell-axis muted'),
    el('span', null, '← cheaper click, thicker volume'),
    el('span', null, 'higher ceiling, thinner volume →')));
  node.append(el('p', 'note',
    'Price sets what a click can be worth to you. Purpose sets which searches '
    + 'are yours. A high ceiling on thin volume against a low ceiling on thick '
    + 'volume — by design the two come out about the same, so the real '
    + 'difference is the risk you cannot see from here.'));
  return node;
}

// ---------------------------------------------------------------------------
// 9. Capital (13.3)
// ---------------------------------------------------------------------------

function committed(draft) {
  return Object.values(draft.capex).reduce((a, b) => a + b, 0);
}

/**
 * The page as it stands, drawn rather than described.
 *
 * The strips are whatever `pageShape` says the capital has funded, so the
 * drawing cannot show something the description does not claim — both read the
 * same ladder. What it deliberately does NOT do is state a grade: the grade for
 * this component lives on the ad card with the other two, because reading them
 * apart is what made the Quality Score unreadable in the first place.
 */
function sectionPagePreview(draft) {
  const wrap = el('div', 'page-preview');
  wrap.append(el('p', 'field-label', 'What they land on'));

  const sheet = el('div', 'page-sheet');
  sheet.append(el('div', 'page-strip head', 'your product'));
  const { strips } = pageShape(draft.capex);
  for (const strip of strips) {
    sheet.append(el('div', `page-strip ${strip.target}`, strip.label));
  }
  if (strips.length === 0) {
    sheet.append(el('div', 'page-strip empty', 'nothing else'));
  }
  wrap.append(sheet);

  wrap.append(el('p', 'note muted', draft.ad.landingPageDescription));
  return wrap;
}

function sectionCapex(draft, rerender) {
  const node = card('Capital', `${rupees(CAPEX_ALLOCATION_PAISE)} to build the site they land on, or to keep`);
  const spent = committed(draft);
  const left = CAPEX_ALLOCATION_PAISE - spent;


  for (const [key, label, why] of CAPEX_TARGETS) {
    const row = el('div', 'capex-row');
    row.append(el('div', 'capex-label', label));
    const steps = el('div', 'chips');
    for (const tier of PAGE_FEATURES[key]) {
      const amount = tier.paise;
      const affordable = amount <= draft.capex[key] + left;
      const chip = el('button', `chip small${draft.capex[key] === amount ? ' on' : ''}`);
      chip.type = 'button';
      // The label says what it BUYS; the amount says what it costs. The old
      // chip said only the amount, so three targets read as three identical
      // sliders and the money was the only thing being chosen.
      chip.textContent = amount === 0 ? tier.label : `${tier.label} · ${rupees(amount)}`;
      chip.disabled = !affordable;
      chip.addEventListener('click', () => {
        draft.capex[key] = amount;
        syncPage(draft);
        rerender();
      });
      steps.append(chip);
    }
    row.append(steps);
    row.append(el('div', 'capex-why muted', why));
    node.append(row);
  }

  // WHAT A RUPEE BUYS, AND WHERE IT STOPS BUYING IT. Measured over three seeds:
  // against not investing at all, photography is worth +22.3% of net profit,
  // the page +7.6% and the size guide +4.0% - and two of those three targets
  // have no on-screen indicator anywhere in the game. Nor did anything show the
  // shape of the curve, which is the whole skill: topping up a funded target
  // earned +5.4% where funding a fresh one earned +14.1%.
  //
  // Read from CAPEX_TIER_CURVE rather than restated, so a change to the curve
  // moves the drawing with it.
  node.append(el('p', 'field-label', 'What a rupee buys, by rung'));
  const curve = el('div', 'capex-curve');
  const peak = CAPEX_TIER_CURVE[CAPEX_TIER_CURVE.length - 1].effect - 1;
  for (const tier of CAPEX_TIER_CURVE) {
    const bar = el('div', steepRung(tier) ? 'steep' : null);
    bar.style.height = `${Math.round(((tier.effect - 1) / peak) * 50) + 3}px`;
    curve.append(bar);
  }
  node.append(curve);
  const ticks = el('div', 'capex-ticks');
  for (const tier of CAPEX_TIER_CURVE) {
    ticks.append(el('span', null, tier.paise === 0 ? '0' : rupees(tier.paise)));
  }
  node.append(ticks);
  node.append(el('p', 'note',
    'The steep stretch is the middle of the ladder. Past it, another rung on the '
    + 'same target buys very little — two targets part-funded beat one maxed out, '
    + 'and a target you have not started is worth more than a top-up.'));

  // Stacked, not beside the chips. Measured: at half a row the two-column
  // version took this card from 670px to 868px, because the chip rows wrap
  // harder than the preview saves.
  node.append(sectionPagePreview(draft));


  const summary = el('p', 'capex-summary');
  summary.append(el('strong', null, rupees(left)));
  summary.append(document.createTextNode(
    left > 0
      ? ' not committed, which is added to this month\'s advertising budget instead.'
      : ' left. Every rupee is committed.',
  ));
  node.append(summary);
  node.append(el('p', 'note',
    'Site work takes three rounds to go live, so this costs you three weeks of '
    + 'traffic AND three weeks of conversion data. Spreading thin genuinely '
    + 'underperforms committing: ₹25,000 of engineering buys a half-built '
    + 'thing that helps nobody.'));
  return node;
}

// ---------------------------------------------------------------------------
// 10. Keywords, from the research list
// ---------------------------------------------------------------------------

/**
 * Keyword Planner: text, weekly volume, intent. Nothing else exists here.
 * What a query does after the click is earned by running it (16.1, C4).
 */
function researchList(querySet) {
  return querySet.queries.map((query) => ({
    id: query.id,
    text: query.text,
    intent: query.intent,
    weekly: Math.round((querySet.weeklyVolume * query.volumeShareBp) / 10000),
  })).sort((a, b) => b.weekly - a.weekly);
}

/**
 * One ad as a searcher meets it: who is running it, the headlines assembled, the
 * descriptions run together.
 *
 * ONE COMPONENT, TWO CARDS. The player's own ad and the eight rival ads are the
 * same kind of object, and 17.1 makes the rival copy the only evidence of where
 * anyone sits - so reading a rival and writing your own should look alike. Before
 * this the player wrote into five boxes and read rivals as plain stacked text,
 * which are two mental models of one thing.
 *
 * Restrained on purpose: no favicon, no star row, nothing implying more fidelity
 * than the model has. Identity is public under R3, so the domain may be shown.
 *
 * @param {object} args `headlines` and `descriptions` already filtered; `domain`
 *   and optional `name`; `placeholder` to draw empty slots as prompts
 * @returns {HTMLElement}
 */
export function serpBlock({ domain, headlines = [], descriptions = [], name = null, placeholder = false }) {
  const node = el('article', 'serp');

  const tag = el('div', 'serp-tag');
  tag.append(el('span', null, 'Sponsored'));
  tag.append(el('span', 'serp-sep', '·'));
  tag.append(el('span', 'serp-domain', domain ?? ''));
  if (name) tag.append(el('span', 'serp-name', name));
  node.append(tag);

  const head = el('p', 'serp-head');
  if (headlines.length === 0) {
    if (placeholder) head.append(el('span', 'muted', 'Your headlines appear here'));
  } else {
    headlines.forEach((headline, i) => {
      if (i > 0) head.append(el('span', 'serp-sep', ' · '));
      head.append(el('span', null, headline));
    });
  }
  node.append(head);

  const body = descriptions.join(' ');
  node.append(el('p', 'serp-desc',
    body || (placeholder ? 'Your descriptions appear here.' : '')));
  return node;
}

/**
 * A search's weekly volume, as a figure and a bar.
 *
 * The card's own note says this list is *"in the order Keyword Planner gives it:
 * biggest first. That is not the order to buy in"* - and with 151 rows of digits
 * a reader cannot see how steeply it falls away. The bar makes the shape of the
 * head and the tail visible, which is what that warning is about.
 *
 * @param {number} weekly searches a week
 * @param {number} max the largest in the list, so the bar has a scale
 * @returns {HTMLElement}
 */
function volumeCell(weekly, max) {
  const node = el('div', 'vol');
  node.append(el('span', 'vol-figure', whole(weekly)));
  const track = el('span', 'vol-track');
  const fill = el('span', 'vol-fill');
  fill.style.width = `${max > 0 ? Math.max(1, Math.round((100 * weekly) / max)) : 0}%`;
  track.append(fill);
  node.append(track);
  return node;
}

/**
 * The price x purpose grid, as rows and columns rather than a flat list.
 *
 * `.cell-grid` was already a three-column CSS grid, and `allCells()` returns the
 * six cells price-major — so flowing them 3-across put **mid|lifestyle directly
 * under value|performance**. It rendered as a 3x2 matrix whose position carried
 * no meaning, on the one screen whose job is to teach the model the whole game
 * rests on (4.1). Nothing caught it because nothing described the layout as data.
 *
 * Built from the engine's own `PRICE_TIERS` and `PURPOSES` rather than a list
 * typed here, so a change to either vocabulary moves the grid with it.
 *
 * @returns {{prices: string[], rows: Array<{purpose: string,
 *   cells: Array<{key: string, price: string, purpose: string}>}>}}
 */
export function positionMatrix() {
  return {
    prices: [...PRICE_TIERS],
    rows: PURPOSES.map((purpose) => ({
      purpose,
      cells: PRICE_TIERS.map((price) => ({ key: cellKey(price, purpose), price, purpose })),
    })),
  };
}

/**
 * Each week's share of what is PLANNED, for the shape of the split.
 *
 * Of the plan rather than of the month, so the bar draws the shape the player
 * made even while it does not add up to the month yet — the summary line beside
 * it is what says whether anything is unallocated.
 *
 * @param {number[]} split paise per week
 * @returns {number[]} fractions summing to 1, or zeros when nothing is planned
 */
export function splitShares(split = []) {
  const planned = split.reduce((a, b) => a + b, 0);
  if (planned <= 0) return split.map(() => 0);
  return split.map((amount) => amount / planned);
}

/**
 * The ad exactly as the Go button will submit it.
 *
 * ONE OBJECT, because grading a different one is what produced this bug. Round 0
 * used to grade `draft.ad` — which holds `['', '']` in the description slots
 * until submit strips them — and submit sent the stripped version. A player who
 * left the descriptions blank was shown 8 · 8 · 8 and given 8 · 8 · 4: the
 * stripped ad has no descriptions, so `validateAdCopy` fails it and
 * `OVERLONG_CEILING` caps every component at 4, and a hired tier then overwrote
 * the two copy components and hid it. The landing page was the only place the
 * damage showed, on a page the player had spent ₹80,000 on.
 *
 * @param {object} draft
 * @returns {{headlines: string[], descriptions: string[], landingPageDescription: string}}
 */
export function submittedAd(draft) {
  return {
    headlines: (draft.ad?.headlines ?? []).filter(Boolean),
    descriptions: (draft.ad?.descriptions ?? []).filter(Boolean),
    // Composed from the capital by `syncPage`, never typed (I9).
    landingPageDescription: draft.ad?.landingPageDescription ?? '',
  };
}

/**
 * The grading context the ACCOUNT will be graded in.
 *
 * `rivalNames` is the half round 0 used to leave out, so the trademark penalty
 * (8.7, −4 on `adRelevance`) was invisible on the one screen that shows a grade:
 * the card warned in words and left the number alone, which reads as cosmetic
 * when it is worth four points. `setup.js` passes exactly this.
 */
function gradingContext(draft) {
  return {
    keywords: draft.keywords,
    rivalNames: BRAND_IDENTITIES
      .filter((b) => b.id !== draft.playerBrandId)
      .map((b) => b.name),
  };
}

/**
 * How the ad round 0 is about to submit will actually grade.
 *
 * `written` is what the player earned; `applied` is what will run, which differs
 * when a writer was hired. Every screen in round 0 that shows a grade reads this
 * one function, so they cannot disagree with each other or with the account.
 *
 * @param {object} draft
 * @returns {{ad: object, written: object, applied: object, checks: object[], notes: string[]}}
 */
export function gradeAsSubmitted(draft) {
  const ad = submittedAd(draft);
  const { grade, checks, notes } = explainGrade(ad, gradingContext(draft));
  const hired = !isDiy(draft.writerTier);
  return {
    ad,
    written: grade,
    // What will ACTUALLY apply. A hired tier sets the two copy components and
    // nothing else — the landing page is graded from the page the capital built.
    applied: hired ? { ...grade, ...hiredCopyGrades(draft.writerTier) } : grade,
    checks,
    notes,
  };
}

/**
 * Can each keyword's bid actually clear the reserve, at the grade the FIRST
 * auction will run at?
 *
 * `AD_RANK_FLOOR` is a reserve rather than an eligibility gate (B5). An
 * advertiser under it enters every auction and shows in none, and the report
 * calls that "lost to rank 100%" — which reads as being OUTBID and sends a
 * player to raise keyword bids, when the bid was never the binding thing.
 * `minimumBidToShowPaise` exists for exactly this warning and says so; round 0
 * was not calling it.
 *
 * MEASURED, which is why the card says anything at all. A self-written ad opens
 * on the ungraded 3/3 default (I11) and needs ₹16.24 on this query set, where a
 * hired 6/6 needs ₹6.87. Round 0 offers ₹30 — 1.85x headroom against a hired
 * account's 4.37x — and accepts anything from ₹1. Played: ₹17 takes 396 clicks
 * in week 1, ₹16 takes 244, ₹14 takes ZERO, for two full weeks.
 *
 * THE GRADE IS THE OPENING ONE, NOT THE WRITTEN ONE, and that distinction is the
 * whole warning. A player writing their own ad watches it grade 8/10 on the card
 * below and opens the account at 3/10; pricing the floor against the 8 would
 * reassure exactly the player who is about to disappear. It comes from
 * `openingCopyGrades` so this screen and `creativeBlock` cannot disagree.
 *
 * No landing-page bonus is added, and that is not an omission: round 0's capital
 * goes live at round 4 (`liveAtRound`), so `landingPageBonus` is zero for the
 * first three rounds and the copy lands before the capital does. Capital cannot
 * lower this floor.
 *
 * @param {object} draft round 0's own draft
 * @param {object} querySet
 * @returns {{grade: object, rows: Array<{text: string, bidPaise: number,
 *   needPaise: number, clears: boolean}>, under: Array<object>,
 *   worstShortfall: {text: string, needPaise: number, bidPaise: number}|null}}
 */
export function openingReserve(draft, querySet) {
  const written = gradeAsSubmitted(draft).written;
  const grade = {
    ...openingCopyGrades(draft.writerTier),
    // The player's own page, graded from what the capital built (I9). A writer
    // never touches it, so it is not part of what the delay withholds.
    landingPage: written.landingPage,
  };

  const rows = (draft.keywords ?? []).map((keyword) => {
    // The keyword's own literal search, which is the most favourable query it
    // could meet. Failing there means failing everywhere, at any hour, against
    // anyone — the same test `setup.test.js` runs over every rival.
    const query = querySet.queries.find((q) => q.text === keyword.text)
      ?? { text: keyword.text, intent: 'commercial', tags: heuristicTags(keyword.text) };
    const needPaise = minimumBidToShowPaise(qualitySignalBase(grade, query, keyword).base);
    return {
      text: keyword.text,
      bidPaise: keyword.bidPaise,
      needPaise,
      clears: keyword.bidPaise >= needPaise,
    };
  });

  const under = rows.filter((r) => !r.clears);
  return {
    grade,
    rows,
    under,
    // The largest gap, because that is the number that makes the point.
    worstShortfall: under.length === 0
      ? null
      : under.reduce((a, b) => (b.needPaise - b.bidPaise > a.needPaise - a.bidPaise ? b : a)),
  };
}

function sectionKeywords(querySet, draft, rerender, live) {
  // The planner: a 151-row table behind a capped scroll region. Narrowing it
  // means seeing fewer searches at once, which is the opposite of helpful.
  const node = card('Keywords', 'what you bid on, and how loosely it matches', true);
  const all = researchList(querySet);
  const chosen = new Set(draft.keywords.map((k) => k.text));

  const search = input({
    value: draft.keywordFilter,
    placeholder: 'search the keyword planner…',
    onInput: (value) => { draft.keywordFilter = value; renderList(); },
  });
  node.append(field('Research', search,
    `${all.length} searches, sorted by weekly volume. Volume is public; what a `
    + 'search is worth to you is not.'));

  const bulk = el('div', 'bulk-add');
  node.append(bulk);

  const listBox = el('div', 'scroll research');
  node.append(listBox);

  function renderList() {
    const term = draft.keywordFilter.trim().toLowerCase();
    const shown = all.filter((q) => !term || q.text.includes(term)).slice(0, 60);

    // The count is on the button on purpose. Adding sixty keywords because
    // they were listed is exactly the mistake this screen is about.
    const addable = shown.filter((q) => !chosen.has(q.text));
    bulk.replaceChildren();
    if (addable.length > 1) {
      const go = el('button', 'add');
      go.type = 'button';
      go.textContent = `Add all ${addable.length} shown`;
      go.title = 'Phrase match at ₹30 each, the same as adding them one at a time. '
        + 'You can change both afterwards.';
      go.addEventListener('click', () => {
        for (const q of addable) {
          draft.keywords.push({ text: q.text, matchType: 'phrase', bidPaise: 3000 });
        }
        rerender();
      });
      bulk.append(go);
    }

    // Scaled against the whole list's biggest rather than the filtered view's, so
    // searching cannot silently rescale the bars and make a tail row look like a
    // head term.
    const max = all.length > 0 ? all[0].weekly : 0;
    const rows = shown
      .map((q) => {
        const button = el('button', 'add');
        button.type = 'button';
        button.textContent = chosen.has(q.text) ? 'added' : 'add';
        button.disabled = chosen.has(q.text);
        button.addEventListener('click', () => {
          draft.keywords.push({ text: q.text, matchType: 'phrase', bidPaise: 3000 });
          rerender();
        });
        return { cells: [q.text, volumeCell(q.weekly, max), q.intent, button] };
      });
    const node2 = el('table', 'mini');
    table(node2, ['Search term', { label: 'Weekly', num: true }, 'Intent', ''], rows);
    listBox.replaceChildren(node2);
  }
  renderList();

  if (draft.keywords.length > 0) {
    const picked = el('table', 'mini picked');
    table(picked,
      ['Keyword', 'Match', { label: 'Bid', num: true }, 'Tags', ''],
      draft.keywords.map((keyword, i) => {
        const matchType = select({
          options: [['exact', 'exact'], ['phrase', 'phrase'], ['broad', 'broad']],
          value: keyword.matchType,
          onChange: (value) => { keyword.matchType = value; rerender(); },
        });
        const bid = input({
          type: 'number', value: String(Math.round(keyword.bidPaise / 100)),
          min: '1', step: '1', class: 'bid',
          onInput: (value) => {
            keyword.bidPaise = Math.max(100, Math.round(Number(value) * 100));
            // Not `rerender`: that would destroy the field being typed into.
            live?.keywords?.();
          },
        });
        const tags = el('div', 'tag-row');
        // The tags the account will actually be given (setup.js), not the word
        // lookup's guess: "matching set women" runs as co-ord-set + women (E9).
        const given = tagKeywordOffline({ text: keyword.text }, querySet).tags;
        for (const tag of given) {
          tags.append(el('span', 'tag', tag));
        }
        // How far it reaches on the match type chosen, with those same tags, so
        // "broad" shows what it would buy before the first week (E8).
        const match = el('div', 'kw-match');
        match.append(matchType, el('div', 'kw-reach', FORM.reach({
          count: keywordReach({ text: keyword.text, matchType: keyword.matchType, tags: given }, querySet),
        })));
        const remove = el('button', 'add');
        remove.type = 'button';
        remove.textContent = 'remove';
        remove.addEventListener('click', () => { draft.keywords.splice(i, 1); rerender(); });
        return { cells: [keyword.text, match, bid, tags, remove] };
      }));
    node.append(el('p', 'field-label', `Your keywords (${draft.keywords.length})`));
    node.append(scrollX(picked));
  }

  // The reserve, live. It sits directly under the keyword table because that is
  // where the bid is typed, and it is the one thing on this screen that can make
  // an account invisible without anything looking wrong.
  const reserve = el('p', 'note reserve-note');
  node.append(reserve);
  live.keywords = () => {
    const out = openingReserve(draft, querySet);
    if (out.under.length === 0) {
      reserve.textContent = '';
      reserve.hidden = true;
      return;
    }
    reserve.hidden = false;
    const worst = out.worstShortfall;
    const names = out.under.map((r) => `“${r.text}”`).join(', ');
    reserve.textContent
      = `${out.under.length === 1 ? 'One keyword bids' : `${out.under.length} keywords bid`} `
      + 'under the reserve, so it cannot appear at all: '
      + `${names}. At the grade this account OPENS on — `
      + `${out.grade.expectedCtr}/10 for both copy components`
      + `${isDiy(draft.writerTier) ? ', because you are writing the ad yourself' : ''} — `
      + `${worst.text} needs ${rupees(worst.needPaise)} and bids `
      + `${rupees(worst.bidPaise)}. A bid under the reserve enters every auction and `
      + 'shows in none, and the report calls that “lost to rank”, which looks '
      + 'exactly like being outbid.'
      + (isDiy(draft.writerTier)
        ? ` That floor is set by the unwritten ad you open on, not by the one you wrote — hiring a writer lowers it, and so does raising the bid.`
        : '');
  };
  live.keywords();

  node.append(el('p', 'note',
    'Exact and phrase match on the words. Broad matches on meaning, using those '
    + 'tags — and the fewer tags a keyword carries, the further it travels. '
    + 'Broad will find you searches you did not ask for, and you pay for those too.'));
  node.append(el('p', 'note',
    'This list is in the order Keyword Planner gives it: biggest first. That is '
    + 'not the order to buy in. Nobody can tell you which of these searches are '
    + 'yours — you have the words, the volume and the intent, and the arithmetic '
    + 'from the briefing. Reading them is the job.'));
  return node;
}

// ---------------------------------------------------------------------------
// 9b. Who writes the ad (DECISIONS I11)
// ---------------------------------------------------------------------------

/**
 * The writer choice, with a live read of what writing it yourself would score.
 *
 * The point of showing that number is I8's principle: a live read of the
 * player's own situation beats a paragraph they have to apply to themselves.
 * A player looking at "you would score 5 · the agency guarantees 7" is making
 * an informed trade; one reading a description of three tiers is guessing.
 *
 * It updates as they write, so the card is worth coming back to — which is why
 * it sits directly above the ad rather than beside the capital.
 */
function sectionWriter(draft, rerender, live, rootSeed) {
  const node = card('Who writes it', 'a separate budget, and whatever is left buys traffic instead');
  const rows = el('div');
  const summary = el('p', 'capex-summary');
  node.append(rows, summary);

  /**
   * Redrawn on every keystroke, not only on a click.
   *
   * The first version computed the self-written grade once at render time, so
   * typing a better ad updated the ad card and left THIS card saying 5/10 while
   * the one below it said 8/10. Two screens disagreeing about the same number
   * is the worst thing either of them can do, and it is only visible by opening
   * the page — no test in this project reads both cards at once.
   */
  const draw = () => {
    const written = gradeAsSubmitted(draft).written;
    const left = CREATIVE_ALLOCATION_PAISE - writerTier(draft.writerTier).pricePaise;

    rows.replaceChildren();
    for (const tier of WRITER_TIERS) {
      const row = el('div', `writer-row${draft.writerTier === tier.id ? ' on' : ''}`);
      const pick = el('button', 'writer-pick');
      pick.type = 'button';
      pick.append(el('span', 'writer-name', tier.label));
      pick.append(el('span', 'writer-price', tier.pricePaise === 0 ? 'free' : rupees(tier.pricePaise)));
      pick.addEventListener('click', () => {
        draft.writerTier = tier.id;
        syncWriterCopy(draft, rootSeed);
        rerender();
      });
      row.append(pick);

      row.append(el('div', 'writer-what muted', tier.grade === null
        ? `Graded on what you actually write — ${written.expectedCtr}/10 and `
          + `${written.adRelevance}/10 as it stands. It does not go live until week `
          + `${CREATIVE_DIY_LIVE_ROUND}; until then you run an unwritten ad that wins almost nothing.`
        : `Both copy scores guaranteed at ${tier.grade}/10, running from week 1.`));
      rows.append(row);
    }

    summary.textContent = left > 0
      ? `${rupees(left)} not spent on a writer, which becomes advertising budget instead.`
      : 'Every rupee of the creative budget is committed.';
  };
  live.writer = draw;
  draw();

  node.append(el('p', 'note',
    'Two of your three Quality Score components come from the copy. The third, '
    + 'your landing page, is bought with capital and nothing here touches it.'));

  // The abstraction, stated rather than left for a player to notice. It is the
  // one place this card could quietly teach something false.
  node.append(el('p', 'note',
    'You write what the ad says either way, and those are the words searchers '
    + 'see — this simulator has no way to invent better ones. What hiring buys '
    + 'is the grade: a hired ad is scored at the writer’s level whatever your '
    + 'draft says, and writing it yourself is scored on the draft.'));
  return node;
}

// ---------------------------------------------------------------------------
// 10. The ad
// ---------------------------------------------------------------------------

function sectionAd(draft, revalidate, live) {
  // The tallest card in round 0 at 1024px, and the fields sit beside the live
  // grade rather than above it — so the number moves where you can see it while
  // you type, instead of two screens down.
  const node = card('Your ad', 'the only thing your rivals can see about you', true);
  node.append(el('p', 'note',
    'These are graded, and the grade is not decoration. Your headlines and '
    + 'descriptions set two of the three components of Quality Score — whether '
    + 'people click, and whether the ad answers what they searched for. The '
    + 'landing page line sets the third. Quality multiplies your bid into ad '
    + 'rank, so a better ad wins better positions AND pays less for the position '
    + 'it had. It is the only lever in this game that makes traffic cheaper '
    + 'rather than just buying more of it — and writing it yourself costs no money.'));

  // Two columns: what you write on the left, what it scores on the right. They
  // used to stack, which put the grade a screen below the words that earned it.
  const split = el('div', 'ad-split');
  const written = el('div');
  const scored = el('div');
  split.append(written, scored);
  node.append(split);

  const counters = [];
  const counter = (max) => {
    const node2 = el('span', 'count');
    counters.push({ node: node2, max, read: null });
    return node2;
  };

  const addField = (label, box, max, read, hint) => {
    const mark = max == null ? hint : counter(max);
    if (max != null) counters[counters.length - 1].read = read;
    written.append(field(label, box, mark));
  };

  draft.ad.headlines.forEach((text, i) => {
    const box = input({
      value: text,
      maxlength: String(HEADLINE_MAX_CHARS + 20),
      // No rerender: this box is the one being typed into.
      onInput: (value) => {
        draft.ad.headlines[i] = value;
        draft.adIsSeeded = false;
        revalidate();
      },
    });
    addField(`Headline ${i + 1}`, box, HEADLINE_MAX_CHARS, () => draft.ad.headlines[i]);
  });

  draft.ad.descriptions.forEach((text, i) => {
    const box = input({
      value: text,
      maxlength: String(DESCRIPTION_MAX_CHARS + 40),
      onInput: (value) => {
        draft.ad.descriptions[i] = value;
        draft.adIsSeeded = false;
        revalidate();
      },
    });
    addField(`Description ${i + 1}`, box, DESCRIPTION_MAX_CHARS, () => draft.ad.descriptions[i]);
  });

  // No landing page box. The third component is graded from the page the
  // capital actually built (DECISIONS I9) — describing one was free, and
  // claiming a size guide you had not bought earned the same grade as buying
  // one. What is left here is the read-out, so the ad card still shows all
  // three components in one place.
  written.append(field(
    'Landing page',
    el('p', 'derived', draft.ad.landingPageDescription),
    'Built on the Capital card above, not written here. Every line of this is '
    + 'something you paid for — which is why it is the one component of the ad '
    + 'that costs money rather than only effort.',
  ));

  const problems = el('div');
  written.append(problems);

  // The live grade, and what is moving it. Without this the player writes an
  // ad, gets a number two screens later, and has no way to tell which of the
  // words did it — which makes the whole card a guess. Every rule shown here
  // is ordinary search-advertising practice, and it comes from the grader's own
  // single pass, so the advice cannot drift from the score beside it.
  // WHAT A SEARCHER SEES, which the player was writing and never shown. The
  // card's own subtitle is "the only thing your rivals can see about you", and
  // until now that thing existed only as five separate boxes. Real Google Ads
  // previews the assembled ad; the grade below it is what the auction sees.
  const preview = el('div', 'serp-slot');
  scored.append(preview);

  const gradePanel = el('div', 'grade-panel');
  scored.append(gradePanel);

  // Rules, not judgements. The numeric grade is earned by running the ad.
  live.ad = () => {
    for (const c of counters) {
      const value = c.read?.() ?? '';
      c.node.textContent = `${value.length}/${c.max}`;
      c.node.className = value.length > c.max ? 'count over' : 'count';
    }

    const found = validateAdCopy(submittedAd(draft)).violations;
    const rival = namesARival(draft.ad, BRAND_IDENTITIES.map((b) => b.name));
    if (rival) {
      found.push(
        `names "${rival}". Bidding on a rival's brand is allowed; naming them in `
        + 'your ad is not, and it will cost you ad relevance.',
      );
    }
    problems.replaceChildren();
    if (found.length > 0) {
      const list = el('ul', 'problems');
      for (const problem of found) list.append(el('li', null, problem));
      problems.append(list);
    }

    drawPreview();
    drawGrade();
  };

  const COMPONENT_LABEL = {
    expectedCtr: 'Expected CTR',
    adRelevance: 'Ad relevance',
    landingPage: 'Landing page',
  };

  /**
   * The assembled ad, from `submittedAd` so the preview cannot show words the
   * account will not run — a blank box contributes nothing here either.
   */
  function drawPreview() {
    const ad = submittedAd(draft);
    const identity = BRAND_IDENTITIES.find((b) => b.id === draft.playerBrandId);
    preview.replaceChildren(serpBlock({
      domain: identity?.domain,
      headlines: ad.headlines,
      descriptions: ad.descriptions,
      placeholder: true,
    }));
  }

  function drawGrade() {
    // The ad as it will be SUBMITTED, graded in the context the account will be
    // graded in. Both halves of that mattered: grading the unstripped draft
    // showed a landing page of 8 where the account got 4, and grading without
    // rivalNames hid a four-point trademark penalty.
    const { written: grade, applied, checks, notes } = gradeAsSubmitted(draft);
    const hired = !isDiy(draft.writerTier);

    gradePanel.replaceChildren();
    gradePanel.append(el('p', 'field-label', hired
      ? `How this ad grades, with ${writerTier(draft.writerTier).label.toLowerCase()} writing it`
      : `How this ad grades, as it stands — live from week ${CREATIVE_DIY_LIVE_ROUND}`));

    // THE GRADER'S OWN SENTENCE, which nothing had ever read. It writes exactly
    // why it marked an ad down — "does not fit Google's limits, capped at 4: no
    // descriptions", or how many points naming a rival cost — and every screen
    // threw it away. A player had to ask why their landing page read 4/10 when
    // the answer had already been generated and discarded (I19).
    for (const note of notes) gradePanel.append(el('p', 'note grade-note', note));

    for (const component of ['expectedCtr', 'adRelevance', 'landingPage']) {
      const box = el('div', 'grade-row');
      const head = el('div', 'grade-head');
      head.append(el('span', 'grade-name', COMPONENT_LABEL[component]));
      head.append(el('span', 'grade-value', `${applied[component]}/10`));
      // Both numbers, when they differ, because "you would have scored 5" is
      // what tells a player whether the money was worth spending.
      if (applied[component] !== grade[component]) {
        head.append(el('span', 'grade-was muted', `you would have scored ${grade[component]}`));
      }
      box.append(head);

      const list = el('ul', 'grade-checks');
      for (const check of checks.filter((c) => c.component === component)) {
        list.append(el('li', check.ok ? 'ok' : 'miss', check.text));
      }
      box.append(list);
      gradePanel.append(box);
    }

    gradePanel.append(el('p', 'note',
      hired
        ? 'The checks above are what YOUR draft scores. You have hired someone, '
          + 'so the grade beside each component is what will actually apply from '
          + 'week 1 — the checks are there to show you what you are paying for.'
        : 'This is the same grader the game runs, so the numbers above are the '
          + 'ones you will start with. They set your Quality Score, which '
          + 'multiplies your bid into ad rank — a better ad wins better positions '
          + 'AND pays less for the position it already had.'));
  }

  live.ad();
  return node;
}

// ---------------------------------------------------------------------------
// 11. The weekly split
// ---------------------------------------------------------------------------

/**
 * The month this form is dividing into four weeks.
 *
 * THREE TERMS, AND THE MIDDLE ONE WAS MISSING. The base month, plus whatever the
 * writer did not cost, plus whatever capital is left uncommitted — 13.3 rolls both
 * remainders into advertising money.
 *
 * `rerender` puts the writer card before this one deliberately, and its comment
 * says why: *"whatever the writer did not cost rolls into the month this
 * divides"*. The ordering existed for a dependency this function did not honour,
 * so the writer card promised a ₹50,000 rollover and the card below it divided a
 * month without it. Correct only for a retainer, where the rollover is zero,
 * which is why it read as a plausible number.
 *
 * It is the month AFTER the rollovers arrive, not the ₹1,68,000 the account holds
 * at this instant, because these four boxes are spent in rounds 1 to 4 and the
 * capital lands at round 1. `tests/roundZero.test.js` pins it against the month
 * the account reports once the week has run.
 *
 * @param {object} draft
 * @returns {number} integer paise
 */
export function monthlyBudget(draft) {
  const writerLeft = CREATIVE_ALLOCATION_PAISE - writerTier(draft.writerTier).pricePaise;
  return MONTHLY_BUDGET_PAISE + writerLeft + (CAPEX_ALLOCATION_PAISE - committed(draft));
}

function evenSplit(total) {
  const each = Math.floor(total / ROUNDS_PER_MONTH);
  const split = new Array(ROUNDS_PER_MONTH).fill(each);
  split[0] += total - each * ROUNDS_PER_MONTH;
  return split;
}

function sectionBudget(brief, draft, revalidate, live) {
  const total = monthlyBudget(draft);
  if (!draft.split || draft.split.reduce((a, b) => a + b, 0) !== total) {
    draft.split = evenSplit(total);
  }

  const node = card('This month', `${rupees(total)} across four weeks`);
  const row = el('div', 'split-row');
  draft.split.forEach((amount, i) => {
    const box = input({
      type: 'number', value: String(Math.round(amount / 100)), min: '0', step: '100',
      onInput: (value) => {
        draft.split[i] = Math.max(0, Math.round(Number(value) * 100));
        revalidate();
      },
    });
    row.append(field(`Week ${i + 1}`, box));
  });
  node.append(row);

  // THE SHAPE, not just the four amounts. The boxes state the money and hide the
  // decision: a front-loaded month and a flat one read identically as digits, and
  // the shape is what 13.2's burn-down compares against later.
  const bar = el('div', 'split-bar');
  node.append(bar);
  const summary = el('p', 'split-summary');
  node.append(summary);

  live.budget = () => {
    const planned = draft.split.reduce((a, b) => a + b, 0);
    const over = planned > total;

    bar.replaceChildren();
    splitShares(draft.split).forEach((share, i) => {
      const week = el('div', 'split-week');
      week.style.flexGrow = String(Math.max(0, share));
      // Weeks already spent are not a case here — round 0 has none — so every
      // segment is a plan rather than a report.
      week.title = `Week ${i + 1}: ${rupees(draft.split[i])}`;
      if (share > 0.08) week.append(el('span', null, `${Math.round(100 * share)}%`));
      bar.append(week);
    });
    bar.classList.toggle('over', over);

    // Keep the base class: assigning `problems` alone stripped `split-summary`,
    // so an over-allocated month lost the spacing the readable one had.
    summary.className = `split-summary ${over ? 'problems' : 'muted'}`;
    summary.textContent = over
      ? `${rupees(planned)} planned against ${rupees(total)} available. The month is a hard cap.`
      : `${rupees(planned)} planned, ${rupees(total - planned)} unallocated.`;
  };
  live.budget();

  node.append(el('p', 'note',
    'Unspent money is lost at the month boundary — there is no carry-over. '
    + 'Months 1 and 2 are identical for everyone; month 3 is redistributed by '
    + `rank on ${brief.rankingRule.metric}.`));
  return node;
}

// ---------------------------------------------------------------------------
// 12. Go
// ---------------------------------------------------------------------------

function sectionStart(draft, onStart, live) {
  const node = el('div', 'start');
  const problems = el('div');
  node.append(problems);

  // The live grade, and what is moving it. Without this the player writes an
  // ad, gets a number two screens later, and has no way to tell which of the
  // words did it — which makes the whole card a guess. Every rule shown here
  // is ordinary search-advertising practice, and it comes from the grader's own
  // single pass, so the advice cannot drift from the score beside it.
  const gradePanel = el('div', 'grade-panel');
  node.append(gradePanel);

  const go = el('button', 'go');
  go.type = 'button';
  // It opens the account AND buys the first week, because there is nothing
  // useful to show between those two things. The old flow put a screen carrying
  // one sentence in between and pointed at a button in the header — the opposite
  // corner of the page from the form the player had just filled in.
  go.textContent = 'Open the account and run week 1';

  // Recomputed on every keystroke rather than only when the form is rebuilt,
  // or the Go button would stay disabled until something else was clicked —
  // the player finishes typing their last headline and nothing happens.
  live.start = () => {
    const found = [];
    if (draft.keywords.length === 0) found.push('You need at least one keyword.');
    if (!validateAdCopy(submittedAd(draft)).valid) found.push('Your ad is not finished.');
    if (draft.split.reduce((a, b) => a + b, 0) > monthlyBudget(draft)) {
      found.push('Your weekly split asks for more than the month holds.');
    }

    problems.replaceChildren();
    if (found.length > 0) {
      const list = el('ul', 'problems');
      for (const problem of found) list.append(el('li', null, problem));
      problems.append(list);
    }
    go.disabled = found.length > 0;
  };
  live.start();
  go.addEventListener('click', async () => {
    // The round blocks the main thread for seconds, so the button has to say so
    // and stop accepting presses. Yield once first or the new label never paints.
    go.disabled = true;
    go.textContent = 'running 168 hours…';
    await new Promise((resolve) => { setTimeout(resolve, 0); });

    const remaining = CAPEX_ALLOCATION_PAISE - committed(draft);
    const pending = Object.entries(draft.capex)
      .filter(([, paise]) => paise > 0)
      .map(([target, paise]) => ({ target, paise, liveAtRound: 4 }));

    await onStart({
      playerBrandId: draft.playerBrandId,
      player: {
        position: parseCell(draft.cell),
        capex: { committed: { ...draft.capex }, pending, remainingUnallocatedPaise: remaining },
        keywords: draft.keywords.map((k) => ({ ...k })),
        // The same object every card in this form was grading.
        ad: submittedAd(draft),
        weeklySplitPaise: [...draft.split],
        writerTier: draft.writerTier,
      },
    });
  });
  node.append(go);
  node.append(el('p', 'note',
    'You may redo all of this once, at any point up to the end of week 3. '
    + 'These are the hardest decisions in the game and you are making them with '
    + 'the least information you will ever have.'));
  return node;
}
