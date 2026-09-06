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
  el, add, table, field, input, select, rupees, whole,
} from './dom.js';
import { briefing, placeRivals, buildRivals } from '../setup.js';
import { BRAND_IDENTITIES, assignIdentities, brandNamedIn } from '../content/brands.js';
import { allCells, parseCell } from '../engine/positions.js';
import { validateAdCopy, namesARival, explainGrade } from '../agents/grader.js';
import { heuristicTags } from '../agents/keywordTagger.js';
import {
  HEADLINE_MAX_CHARS, DESCRIPTION_MAX_CHARS, MONTHLY_BUDGET_PAISE,
  CAPEX_ALLOCATION_PAISE, ROUNDS_PER_MONTH, TOTAL_ROUNDS,
  WRITER_TIERS, CREATIVE_ALLOCATION_PAISE, CREATIVE_DIY_LIVE_ROUND,
} from '../engine/constants.js';
import {
  writerTier, isDiy, hiredCopyGrades, openingCopyGrades,
} from '../content/writers.js';
import { qualitySignalBase } from '../engine/quality.js';
import { minimumBidToShowPaise } from '../engine/auction.js';
import { PAGE_FEATURES, composeDescription, pageShape } from './landing-page.js';

const CAPEX_TARGETS = [
  ['landingPage', 'The page itself', 'Better quality, so a cheaper click. Worth most in the middle.'],
  ['sizeGuide', 'Size guide', 'Fewer returns. Worth most at the cheap end, and to anything sold on how it looks.'],
  ['photography', 'Photography', 'More of your visitors buy. Worth most where the decision is considered.'],
];

/**
 * The landing page description is DERIVED, never typed (DECISIONS I9).
 *
 * It used to be a text box whose own hint said "it exists to be graded", and
 * the grader read it for two regexes — so writing the words "size guide" earned
 * the grade that BUYING one costs capital for. Composing it from the capital
 * instead means a claim without a purchase behind it cannot be made.
 */
function syncPage(draft) {
  draft.ad.landingPageDescription = composeDescription(draft.capex);
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
    capex: { sizeGuide: 0, photography: 0, landingPage: 0 },
    keywords: [],
    // landingPageDescription is derived from `capex` by syncPage, below.
    ad: { headlines: ['', '', ''], descriptions: ['', ''], landingPageDescription: '' },
    // Who writes it (I11). DIY by default because writing their own copy is
    // what the player has always done here; hiring is the new option.
    writerTier: 'diy',
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
      sectionBrand(draft, querySet, rerender),
      sectionBriefing(brief),
      sectionRivals(querySet, rootSeed, draft),
      sectionPosition(brief, draft, rerender),
      sectionCapex(draft, rerender),
      sectionKeywords(querySet, draft, rerender, live),
      sectionWriter(draft, rerender, live),
      // Before the ad, and that is a dependency rather than a layout choice:
      // whatever the writer did not cost rolls into the month this divides.
      sectionBudget(draft, revalidate, live),
      sectionAd(draft, revalidate, live),
      sectionStart(draft, onStart, live));
  };
  rerender();
  return root;
}

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

function sectionBrand(draft, querySet, rerender) {
  const node = card('Your brand', 'nine names, and none of them says anything');
  const row = el('div', 'chips');
  for (const brand of BRAND_IDENTITIES) {
    const chip = el('button', `chip${brand.id === draft.playerBrandId ? ' on' : ''}`);
    chip.type = 'button';
    chip.append(el('strong', null, brand.name));
    chip.append(el('span', 'muted', brand.domain));
    chip.addEventListener('click', () => { draft.playerBrandId = brand.id; rerender(); });
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
  node.append(volumes);

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
    .map((rival) => ({ name: rival.name, ad: rival.adGroups[0].ad }))
    .sort((a, b) => (a.name < b.name ? -1 : 1));

  const grid = el('div', 'rival-grid');
  for (const { name, ad } of ads) {
    const box = el('article', 'rival');
    box.append(el('div', 'rival-name', name));
    for (const headline of ad.headlines) box.append(el('div', 'rival-headline', headline));
    for (const description of ad.descriptions) box.append(el('div', 'rival-desc', description));
    grid.append(box);
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

function sectionPosition(brief, draft, rerender) {
  const node = card('Where you sit', 'chosen once, and fixed until round 5');
  const grid = el('div', 'cell-grid');

  for (const cell of allCells()) {
    const { price, purpose } = parseCell(cell);
    const box = el('button', `cell${cell === draft.cell ? ' on' : ''}`);
    box.type = 'button';
    box.append(el('div', 'cell-name', `${price} · ${purpose}`));
    // From the BRIEFING, not from POSITION_ECONOMICS. 17.2 decides what a
    // founder could have researched; this only draws it. Reaching past the
    // briefing into the constants would be how a screen starts showing numbers
    // the player was never meant to have.
    const economics = brief.economicsByTier[price];
    box.append(el('div', 'cell-econ',
      `${rupees(economics.aovMeanPaise)} order · `
      + `${Math.round(100 * economics.marginPct)}% margin`));
    box.append(el('div', 'cell-vol',
      `${whole(brief.weeklySearchesByTier[price])} searches a week in this tier`));
    box.addEventListener('click', () => { draft.cell = cell; rerender(); });
    grid.append(box);
  }
  node.append(grid);
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
  const node = card('Capital', `₹1,00,000 to build the site they land on, or to keep`);
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
  const written = explainGrade(draft.ad, { keywords: draft.keywords }).grade;
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
        return { cells: [q.text, whole(q.weekly), q.intent, button] };
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
        for (const tag of heuristicTags(keyword.text)) tags.append(el('span', 'tag', tag));
        const remove = el('button', 'add');
        remove.type = 'button';
        remove.textContent = 'remove';
        remove.addEventListener('click', () => { draft.keywords.splice(i, 1); rerender(); });
        return { cells: [keyword.text, matchType, bid, tags, remove] };
      }));
    node.append(el('p', 'field-label', `Your keywords (${draft.keywords.length})`));
    node.append(picked);
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
function sectionWriter(draft, rerender, live) {
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
    const written = explainGrade(draft.ad, { keywords: draft.keywords }).grade;
    const left = CREATIVE_ALLOCATION_PAISE - writerTier(draft.writerTier).pricePaise;

    rows.replaceChildren();
    for (const tier of WRITER_TIERS) {
      const row = el('div', `writer-row${draft.writerTier === tier.id ? ' on' : ''}`);
      const pick = el('button', 'writer-pick');
      pick.type = 'button';
      pick.append(el('span', 'writer-name', tier.label));
      pick.append(el('span', 'writer-price', tier.pricePaise === 0 ? 'free' : rupees(tier.pricePaise)));
      pick.addEventListener('click', () => { draft.writerTier = tier.id; rerender(); });
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
    + 'rather than just buying more of it, and it costs nothing.'));

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
      onInput: (value) => { draft.ad.headlines[i] = value; revalidate(); },
    });
    addField(`Headline ${i + 1}`, box, HEADLINE_MAX_CHARS, () => draft.ad.headlines[i]);
  });

  draft.ad.descriptions.forEach((text, i) => {
    const box = input({
      value: text,
      maxlength: String(DESCRIPTION_MAX_CHARS + 40),
      onInput: (value) => { draft.ad.descriptions[i] = value; revalidate(); },
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
  const gradePanel = el('div', 'grade-panel');
  scored.append(gradePanel);

  // Rules, not judgements. The numeric grade is earned by running the ad.
  live.ad = () => {
    for (const c of counters) {
      const value = c.read?.() ?? '';
      c.node.textContent = `${value.length}/${c.max}`;
      c.node.className = value.length > c.max ? 'count over' : 'count';
    }

    const found = validateAdCopy(draft.ad).violations;
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

    drawGrade();
  };

  const COMPONENT_LABEL = {
    expectedCtr: 'Expected CTR',
    adRelevance: 'Ad relevance',
    landingPage: 'Landing page',
  };

  function drawGrade() {
    const { grade, checks } = explainGrade(draft.ad, { keywords: draft.keywords });
    const hired = !isDiy(draft.writerTier);
    // What will ACTUALLY apply. If the panel showed the written grade while the
    // player had bought a tier, the two cards would contradict each other — and
    // a screen explaining a mechanic wrongly is the worst class of bug here.
    const applied = hired
      ? { ...grade, ...hiredCopyGrades(draft.writerTier) }
      : grade;

    gradePanel.replaceChildren();
    gradePanel.append(el('p', 'field-label', hired
      ? `How this ad grades, with ${writerTier(draft.writerTier).label.toLowerCase()} writing it`
      : `How this ad grades, as it stands — live from week ${CREATIVE_DIY_LIVE_ROUND}`));

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

function monthlyBudget(draft) {
  return MONTHLY_BUDGET_PAISE + (CAPEX_ALLOCATION_PAISE - committed(draft));
}

function evenSplit(total) {
  const each = Math.floor(total / ROUNDS_PER_MONTH);
  const split = new Array(ROUNDS_PER_MONTH).fill(each);
  split[0] += total - each * ROUNDS_PER_MONTH;
  return split;
}

function sectionBudget(draft, revalidate, live) {
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

  const summary = el('p');
  node.append(summary);
  live.budget = () => {
    const planned = draft.split.reduce((a, b) => a + b, 0);
    const over = planned > total;
    summary.className = over ? 'problems' : 'muted';
    summary.textContent = over
      ? `${rupees(planned)} planned against ${rupees(total)} available. The month is a hard cap.`
      : `${rupees(planned)} planned, ${rupees(total - planned)} unallocated.`;
  };
  live.budget();

  node.append(el('p', 'note',
    'Unspent money is lost at the month boundary — there is no carry-over. '
    + `Months 1 and 2 are identical for everyone; month 3 is redistributed by `
    + `rank across all ${TOTAL_ROUNDS} rounds.`));
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
  go.textContent = 'Open the account';

  // Recomputed on every keystroke rather than only when the form is rebuilt,
  // or the Go button would stay disabled until something else was clicked —
  // the player finishes typing their last headline and nothing happens.
  live.start = () => {
    const found = [];
    if (draft.keywords.length === 0) found.push('You need at least one keyword.');
    if (!validateAdCopy(draft.ad).valid) found.push('Your ad is not finished.');
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
  go.addEventListener('click', () => {
    const remaining = CAPEX_ALLOCATION_PAISE - committed(draft);
    const pending = Object.entries(draft.capex)
      .filter(([, paise]) => paise > 0)
      .map(([target, paise]) => ({ target, paise, liveAtRound: 4 }));

    onStart({
      playerBrandId: draft.playerBrandId,
      player: {
        position: parseCell(draft.cell),
        capex: { committed: { ...draft.capex }, pending, remainingUnallocatedPaise: remaining },
        keywords: draft.keywords.map((k) => ({ ...k })),
        ad: {
          headlines: draft.ad.headlines.filter(Boolean),
          descriptions: draft.ad.descriptions.filter(Boolean),
          landingPageDescription: draft.ad.landingPageDescription,
        },
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
