/**
 * Step 2, where you sit (plans/2026-09-14-round-zero-redesign.md, section 4;
 * restaged 2026-09-24 by plans/2026-09-24-density-and-polish.md, option B):
 * the six squares drawn as a diagram, and the eight rival ads read ONE AT A
 * TIME from a list beside it. Price is a real axis, value to premium, carrying
 * the briefing's two figures per level; purpose is a divider, because
 * performance and lifestyle are kinds, not a scale.
 *
 * WHY IT IS STAGED. The step used to draw all eight ads in full at once, each
 * with its own small grid: 612 words measured on the live site at `aa97790`,
 * against 119 on 2026-09-14, roughly 500 of them the ads. A beginner on the
 * second of five screens was asked to read eight competitors' ads, infer each
 * one's tier and purpose, place all eight, and then choose their own cell. The
 * task is the lesson and the staging was what nobody could do. `adStage` in
 * ./rules.js is the rule and holds the bound of one ad on screen; this module
 * only draws what it returns.
 *
 * THE GAME NEVER SAYS WHERE A RIVAL SITS, AND NEVER CONFIRMS A GUESS (17.1,
 * I3). The guesses are the player's notes, kept in round 0's draft and not
 * sent. No square carries a figure of its own: that would be worked out from
 * what round 0 withholds. Nothing here marks a placement right or wrong.
 */

import { el, add, rupees, whole, pct } from '../dom.js';
import { PRICE_TIERS, REPOSITION_ROUND } from '../../engine/constants.js';
import { BRAND_IDENTITIES } from '../../content/brands.js';
import { R0, PRICE_WORD, PURPOSE_WORD, cellWords } from '../words/roundZero.js';
import { serp } from '../kit/serp.js';
import { whyButton } from '../guide/drawer.js';
import {
  rivalAds, positionMatrix, setCell, setGuess, guessedIn, setBrand, ownSearch, adStage,
} from './rules.js';

const WHO = {
  'value|performance': R0.whoValuePerformance,
  'value|lifestyle': R0.whoValueLifestyle,
  'mid|performance': R0.whoMidPerformance,
  'mid|lifestyle': R0.whoMidLifestyle,
  'premium|performance': R0.whoPremiumPerformance,
  'premium|lifestyle': R0.whoPremiumLifestyle,
};
const CONTEST = { performance: R0.contestPerformance, lifestyle: R0.contestLifestyle };

/** A bar under a price level: a share of the widest, and its figure. */
function bar(fraction, text) {
  const box = el('div', 'r0-bar');
  const fill = el('span', 'r0-bar-fill');
  fill.style.width = `${Math.max(4, Math.round(100 * fraction))}%`;
  box.append(fill, el('span', 'r0-bar-text', text));
  return box;
}

/**
 * The nine names, and the search the chosen one brings. The brand is the
 * player's to choose (I35, reopened by the owner 2026-09-15); it starts on the
 * one the seed draws.
 */
function brandPicker({ draft, querySet, rootSeed, openGuide, redraw }) {
  const box = el('div', 'r0-brands');
  box.dataset.region = R0.brandTitle();
  const head = el('div', 'r0-head');
  head.append(el('h3', null, R0.brandTitle()), el('span', 'r0-small', R0.brandNote()));
  const row = el('div', 'r0-brand-row');
  for (const brand of BRAND_IDENTITIES) {
    const on = brand.id === draft.playerBrandId;
    const pick = el('button', on ? 'r0-brand on' : 'r0-brand');
    pick.type = 'button';
    pick.dataset.key = `brand:${brand.id}`;
    pick.setAttribute('aria-pressed', String(on));
    pick.append(el('strong', null, brand.name), el('span', null, brand.domain));
    pick.addEventListener('click', () => { if (!on) { setBrand(draft, brand.id, rootSeed, querySet); redraw(); } });
    row.append(pick);
  }
  box.append(head, row);
  const own = ownSearch(draft.playerBrandId, querySet);
  if (own) {
    const said = el('p', 'r0-small', R0.ownSearch({ query: own.text, volume: whole(own.weekly) }));
    add(said, whyButton(R0.ownSearch, openGuide));
    box.append(said);
  }
  return box;
}

/**
 * @param {object} ctx - the frame's context (./studio.js)
 * @param {object} ctx.draft - round 0's draft; the brand, a guess and the square are kept here
 * @param {object} ctx.brief - `briefing(querySet)`, for the axis's figures
 * @param {object} ctx.querySet
 * @param {number} ctx.rootSeed
 * @param {Function} ctx.openGuide - `guide.open`
 * @param {() => void} ctx.redraw - redraws this step, keeping the scroll and focus
 * @param {{openRival?: string|null}} [ctx.ui] - the step's own state between redraws
 * @returns {{node: HTMLElement}}
 */
export function renderPositionStep({
  draft, brief, querySet, rootSeed, openGuide, redraw, ui = {},
}) {
  const ads = rivalAds(rootSeed, draft.playerBrandId, querySet);
  const matrix = positionMatrix();
  const node = el('div', 'r0-position');
  node.append(el('p', 'r0-intro', R0.positionIntro({ rivals: ads.length })),
    el('p', 'r0-ask', R0.positionAsk()),
    brandPicker({ draft, querySet, rootSeed, openGuide, redraw }));

  // The other eight, read ONE AT A TIME. `adStage` decides what is on screen;
  // this only draws it.
  const stage = adStage(ads, draft, ui.openRival ?? null);
  const open = (name) => { ui.openRival = name; redraw(); };

  /** The 3x2 picker under an opened ad. Wordless, and the only way to place. */
  function miniGrid(rival) {
    const mini = el('div', 'r0-mini');
    mini.setAttribute('role', 'group');
    mini.setAttribute('aria-label', R0.guessFor({ name: rival.name }));
    for (const row of matrix.rows) {
      for (const cell of row.cells) {
        const on = draft.guesses[rival.name] === cell.key;
        const pick = el('button', on ? 'r0-mini-cell on' : 'r0-mini-cell');
        pick.type = 'button';
        pick.dataset.key = `guess:${rival.name}:${cell.key}`;
        pick.setAttribute('aria-pressed', String(on));
        pick.setAttribute('aria-label', R0.guessCell({ name: rival.name, cell: cellWords(cell.key) }));
        pick.addEventListener('click', () => { setGuess(draft, rival.name, cell.key); redraw(); });
        mini.append(pick);
      }
    }
    return mini;
  }

  /** One row in the waiting list: a name, its domain, and a way in. */
  function waitingRow(rival) {
    const row = el('button', 'r0-wait');
    row.type = 'button';
    row.dataset.key = `open:${rival.name}`;
    row.append(
      el('span', 'r0-wait-mark', rival.name.slice(0, 1)),
      el('span', 'r0-wait-who', rival.name),
      el('span', 'r0-wait-dom', rival.domain),
      el('span', 'r0-wait-go', R0.readAd()),
    );
    row.addEventListener('click', () => open(rival.name));
    return row;
  }

  const rivals = el('div', 'r0-rivals');
  rivals.dataset.region = R0.otherRivals({ n: ads.length });
  const head = el('div', 'r0-head');
  const unreadCount = stage.unread.length;
  head.append(
    el('h3', null, unreadCount === ads.length ? R0.otherRivals({ n: ads.length }) : R0.stillUnread()),
    el('span', 'r0-small', unreadCount > 0
      ? R0.unreadLeft({ n: unreadCount })
      : R0.guessNote({ placed: stage.placed.length, total: ads.length })),
  );
  rivals.append(head);

  // The opened ad: a different surface from the list, because it is a
  // different kind of thing — evidence, not a control.
  if (stage.open) {
    const panel = el('div', 'r0-ad-open');
    const ahead = el('div', 'r0-ad-head');
    ahead.append(el('h4', null, R0.adOf({ name: stage.open.name })), el('span', 'r0-small', R0.adOnly()));
    const shut = el('button', 'r0-ad-shut');
    shut.type = 'button';
    shut.dataset.key = 'open:none';
    shut.textContent = R0.closeAd();
    shut.addEventListener('click', () => open(null));
    ahead.append(shut);
    panel.append(ahead, serp({
      domain: stage.open.domain, name: stage.open.name, headlines: stage.open.ad.headlines,
      descriptions: stage.open.ad.descriptions, sponsored: R0.sponsored(),
    }), miniGrid(stage.open));
    rivals.append(panel);
  }

  const waiting = el('div', 'r0-waiting');
  for (const rival of stage.unread) waiting.append(waitingRow(rival));
  rivals.append(waiting);

  // The squares, as a diagram, with a crosshair on the one chosen.
  const squares = el('div', 'r0-squares');
  squares.dataset.region = R0.pickSquare();
  const shead = el('div', 'r0-head');
  shead.append(el('h3', null, R0.pickSquare()), el('span', 'r0-small', R0.fixedUntil({ week: REPOSITION_ROUND })));
  add(shead, whyButton(R0.pickSquare, openGuide));
  const here = guessedIn(draft, draft.cell);
  const readout = el('p', 'r0-readout', here.length > 0 ? R0.readoutPlaced({ names: here }) : R0.readoutNone());

  const [chosenPrice, chosenPurpose] = draft.cell.split('|');
  const diagram = el('div', 'r0-diagram');
  for (const row of matrix.rows) {
    const label = el('div', row.purpose === chosenPurpose ? 'r0-row-label on' : 'r0-row-label');
    label.append(el('strong', null, PURPOSE_WORD[row.purpose]()), el('span', 'r0-small', CONTEST[row.purpose]()));
    diagram.append(label);
    for (const cell of row.cells) {
      const on = cell.key === draft.cell;
      const square = el('button', on ? 'r0-square on' : 'r0-square');
      square.type = 'button';
      square.dataset.key = `square:${cell.key}`;
      square.setAttribute('aria-pressed', String(on));
      square.append(el('span', 'r0-square-name', cellWords(cell.key)), el('span', 'r0-who', WHO[cell.key]()));
      const chips = el('span', 'r0-square-chips');
      if (on) chips.append(el('span', 'r0-you', R0.you()));
      // A placed chip is the way back into that ad. A player who placed Nira
      // early and then reads a dearer one has to be able to check the first
      // against the second, and `adStage` keeps a placed rival openable.
      for (const name of guessedIn(draft, cell.key)) {
        const chip = el('button', 'r0-guess');
        chip.type = 'button';
        chip.dataset.key = `open:${name}`;
        chip.setAttribute('aria-label', R0.reopenAd({ name }));
        chip.textContent = R0.guessed({ name });
        chip.addEventListener('click', (event) => { event.stopPropagation(); open(name); });
        chips.append(chip);
      }
      square.append(chips);
      square.addEventListener('click', () => { if (!on) { setCell(draft, cell.key, rootSeed); redraw(); } });
      diagram.append(square);
    }
  }
  diagram.append(el('div', 'r0-axis-name', R0.axisPrice()));
  const maxSearches = Math.max(...PRICE_TIERS.map((p) => brief.weeklySearchesByTier[p]));
  const maxOrder = Math.max(...PRICE_TIERS.map((p) => brief.economicsByTier[p].aovMeanPaise));
  for (const price of PRICE_TIERS) {
    const economics = brief.economicsByTier[price];
    const axis = el('div', price === chosenPrice ? 'r0-axis on' : 'r0-axis');
    axis.append(
      el('strong', null, PRICE_WORD[price]()),
      bar(brief.weeklySearchesByTier[price] / maxSearches, `${whole(brief.weeklySearchesByTier[price])} ${R0.searchesWeek()}`),
      bar(economics.aovMeanPaise / maxOrder, R0.orderMargin({ order: rupees(economics.aovMeanPaise), margin: pct(economics.marginPct) })),
    );
    diagram.append(axis);
  }
  squares.append(shead, readout, diagram);

  // THE GRID FIRST, since 2026-09-24. It used to come after eight ads, so the
  // structure a beginner was meant to be filling in was below the wall of text
  // they were meant to fill it in from. The subject of the screen now leads it.
  node.append(squares, rivals);
  return { node };
}
