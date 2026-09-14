/**
 * Step 2, where you sit (plans/2026-09-14-round-zero-redesign.md, section 4):
 * the eight rival ads, each with a small grid for the player's own guess, and
 * the six squares drawn as a diagram. Price is a real axis, value to premium,
 * carrying the briefing's two figures per level; purpose is a divider, because
 * performance and lifestyle are kinds, not a scale.
 *
 * THE GAME NEVER SAYS WHERE A RIVAL SITS, AND NEVER CONFIRMS A GUESS (17.1,
 * I3). The guesses are the player's notes, kept in round 0's draft and not
 * sent. No square carries a figure of its own: that would be worked out from
 * what round 0 withholds.
 */

import { el, rupees, whole, pct } from '../dom.js';
import { PRICE_TIERS, REPOSITION_ROUND } from '../../engine/constants.js';
import { R0, PRICE_WORD, PURPOSE_WORD, cellWords } from '../words/roundZero.js';
import { serp } from '../kit/serp.js';
import { rivalAds, positionMatrix, setCell, setGuess, guessedIn } from './rules.js';

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
 * @param {object} ctx - the frame's context (./studio.js)
 * @param {object} ctx.draft - round 0's draft; a guess and the square are kept here
 * @param {object} ctx.brief - `briefing(querySet)`, for the axis's figures
 * @param {object} ctx.querySet
 * @param {number} ctx.rootSeed
 * @param {() => void} ctx.redraw - redraws this step, keeping the scroll and focus
 * @returns {{node: HTMLElement}}
 */
export function renderPositionStep({ draft, brief, querySet, rootSeed, redraw }) {
  const ads = rivalAds(rootSeed, draft.playerBrandId, querySet);
  const matrix = positionMatrix();
  const node = el('div', 'r0-position');
  node.append(el('p', 'r0-intro', R0.positionIntro({ rivals: ads.length })));

  // The other eight, as searchers see them, each with a grid for a guess.
  const rivals = el('div', 'r0-rivals');
  rivals.dataset.region = R0.otherRivals({ n: ads.length });
  const head = el('div', 'r0-head');
  head.append(el('h3', null, R0.otherRivals({ n: ads.length })),
    el('span', 'r0-small', R0.guessNote({ placed: Object.keys(draft.guesses).length, total: ads.length })));
  const grid = el('div', 'r0-rival-grid');
  for (const rival of ads) {
    const card = el('div', 'r0-rival');
    card.append(serp({
      domain: rival.domain, name: rival.name, headlines: rival.ad.headlines,
      descriptions: rival.ad.descriptions, sponsored: R0.sponsored(),
    }));
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
    card.append(mini);
    grid.append(card);
  }
  rivals.append(head, grid);

  // The squares, as a diagram, with a crosshair on the one chosen.
  const squares = el('div', 'r0-squares');
  squares.dataset.region = R0.pickSquare();
  const shead = el('div', 'r0-head');
  shead.append(el('h3', null, R0.pickSquare()), el('span', 'r0-small', R0.fixedUntil({ week: REPOSITION_ROUND })));
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
      for (const name of guessedIn(draft, cell.key)) chips.append(el('span', 'r0-guess', R0.guessed({ name })));
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

  node.append(rivals, squares);
  return { node };
}
