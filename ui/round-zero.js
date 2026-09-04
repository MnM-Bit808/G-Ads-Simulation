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
 */

import {
  el, add, table, field, input, select, rupees, whole,
} from './dom.js';
import { briefing, placeRivals, buildRival } from '../setup.js';
import { BRAND_IDENTITIES, assignIdentities } from '../content/brands.js';
import { allCells, parseCell } from '../engine/positions.js';
import { homeCell } from '../engine/querySet.js';
import { validateAdCopy, namesARival } from '../agents/grader.js';
import { heuristicTags } from '../agents/keywordTagger.js';
import {
  HEADLINE_MAX_CHARS, DESCRIPTION_MAX_CHARS, MONTHLY_BUDGET_PAISE,
  CAPEX_ALLOCATION_PAISE, ROUNDS_PER_MONTH, TOTAL_ROUNDS,
} from '../engine/constants.js';

const CAPEX_TARGETS = [
  ['sizeGuide', 'Size guide', 'Fewer returns. Worth most at the cheap end, and to anything sold on how it looks.'],
  ['photography', 'Photography', 'More of your visitors buy. Worth most where the decision is considered.'],
  ['landingPage', 'Landing page', 'Better quality, so a cheaper click. Worth most in the middle.'],
];

/** The amounts the S-curve actually distinguishes (13.3). */
const CAPEX_STEPS = [0, 2500000, 5500000, 7000000, 10000000];

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
    ad: { headlines: ['', '', ''], descriptions: ['', ''], landingPageDescription: '' },
    split: null,
  };

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
  const live = { ad: null, budget: null, start: null };
  const revalidate = () => {
    live.ad?.();
    live.budget?.();
    live.start?.();
  };

  const rerender = () => {
    root.replaceChildren();
    add(root,
      sectionBrand(draft, rerender),
      sectionBriefing(brief),
      sectionRivals(querySet, rootSeed, draft),
      sectionPosition(brief, draft, rerender),
      sectionCapex(draft, rerender),
      sectionKeywords(querySet, draft, rerender),
      sectionAd(draft, revalidate, live),
      sectionBudget(draft, revalidate, live),
      sectionStart(draft, onStart, live));
  };
  rerender();
  return root;
}

const card = (title, subtitle) => {
  const node = el('section', 'card setup-card');
  const h = el('h2', null, title);
  if (subtitle) h.append(el('span', 'muted', subtitle));
  node.append(h);
  return node;
};

// ---------------------------------------------------------------------------
// 2. The brand
// ---------------------------------------------------------------------------

function sectionBrand(draft, rerender) {
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
  const node = card('Who else is here', 'their ads, in no particular order');

  // Built from the same seed the game will use, so what is read here is what
  // will be played against. Position is never stated: it is in the words.
  const { rivals: identities } = assignIdentities(draft.playerBrandId);
  const placement = placeRivals(rootSeed, identities.length);
  const ads = identities
    .map((identity, i) => buildRival(identity, placement[i], i + 1, querySet, () => 0.5))
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
    'Nobody will tell you where these brands sit on the grid. The copy is the '
    + 'only evidence you get before the first auction, and after that, how often '
    + 'you meet them.'));
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

function sectionCapex(draft, rerender) {
  const node = card('Capital', `₹1,00,000 to invest in the business, or to keep`);
  const spent = committed(draft);
  const left = CAPEX_ALLOCATION_PAISE - spent;

  for (const [key, label, why] of CAPEX_TARGETS) {
    const row = el('div', 'capex-row');
    row.append(el('div', 'capex-label', label));
    const steps = el('div', 'chips');
    for (const amount of CAPEX_STEPS) {
      const affordable = amount <= draft.capex[key] + left;
      const chip = el('button', `chip small${draft.capex[key] === amount ? ' on' : ''}`);
      chip.type = 'button';
      chip.textContent = amount === 0 ? 'none' : rupees(amount);
      chip.disabled = !affordable;
      chip.addEventListener('click', () => { draft.capex[key] = amount; rerender(); });
      steps.append(chip);
    }
    row.append(steps);
    row.append(el('div', 'capex-why muted', why));
    node.append(row);
  }

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

function sectionKeywords(querySet, draft, rerender) {
  const node = card('Keywords', 'what you bid on, and how loosely it matches');
  const all = researchList(querySet);
  const chosen = new Set(draft.keywords.map((k) => k.text));

  // The player's own territory first: the searches this position is for.
  const mine = new Set(querySet.queries
    .filter((q) => homeCell(q) === draft.cell).map((q) => q.text));

  const search = input({
    placeholder: 'search the keyword planner…',
    onInput: (value) => {
      const term = value.trim().toLowerCase();
      renderList(term);
    },
  });
  node.append(field('Research', search,
    `${all.length} searches, with weekly volume. Volume is public; what converts is not.`));

  const listBox = el('div', 'scroll research');
  node.append(listBox);

  function renderList(term = '') {
    const rows = all
      .filter((q) => !term || q.text.includes(term))
      .slice(0, 60)
      .map((q) => {
        const button = el('button', 'add');
        button.type = 'button';
        button.textContent = chosen.has(q.text) ? 'added' : 'add';
        button.disabled = chosen.has(q.text);
        button.addEventListener('click', () => {
          draft.keywords.push({ text: q.text, matchType: 'phrase', bidPaise: 3000 });
          rerender();
        });
        return {
          className: mine.has(q.text) ? 'own-territory' : null,
          cells: [q.text, whole(q.weekly), q.intent, button],
        };
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
          onInput: (value) => { keyword.bidPaise = Math.max(100, Math.round(Number(value) * 100)); },
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

  node.append(el('p', 'note',
    'Exact and phrase match on the words. Broad matches on meaning, using those '
    + 'tags — and the fewer tags a keyword carries, the further it travels. '
    + 'Broad will find you searches you did not ask for, and you pay for those too.'));
  return node;
}

// ---------------------------------------------------------------------------
// 10. The ad
// ---------------------------------------------------------------------------

function sectionAd(draft, revalidate, live) {
  const node = card('Your ad', 'the only thing your rivals can see about you');

  const counters = [];
  const counter = (max) => {
    const node2 = el('span', 'count');
    counters.push({ node: node2, max, read: null });
    return node2;
  };

  const addField = (label, box, max, read, hint) => {
    const mark = max == null ? hint : counter(max);
    if (max != null) counters[counters.length - 1].read = read;
    node.append(field(label, box, mark));
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

  const page = input({
    value: draft.ad.landingPageDescription,
    onInput: (value) => { draft.ad.landingPageDescription = value; revalidate(); },
  });
  addField('Landing page', page, null, null,
    'Describe the page they arrive on. Nobody else sees this; it is graded.');

  const problems = el('div');
  node.append(problems);

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
  };
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
