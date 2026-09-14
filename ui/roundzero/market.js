/**
 * Step 1, the market (plans/2026-09-14-round-zero-redesign.md, section 4). Read
 * only: what a founder could research before spending anything (17.2), all of
 * it from setup.js's briefing(), and where the searches are, on a map that
 * pulses by each kind of place's share.
 */

import { el, rupees, whole, pct } from '../dom.js';
import { ADVERTISER_COUNT, TOTAL_ROUNDS, PRICE_TIERS } from '../../engine/constants.js';
import { R0, PRICE_WORD } from '../words/roundZero.js';
import { pills } from '../kit/controls.js';
import { sharesFor, drawIndia } from '../map/india.js';

/**
 * @param {{brief: object}} ctx - the frame's context (./studio.js); step 1
 *   reads only the briefing
 * @returns {{node: HTMLElement}}
 */
export function renderMarketStep({ brief }) {
  const node = el('div', 'r0-market');
  node.append(el('p', 'r0-intro', R0.marketIntro({ weeks: TOTAL_ROUNDS, rivals: ADVERTISER_COUNT - 1 })));

  const levels = el('div', 'r0-levels');
  for (const price of PRICE_TIERS) {
    const economics = brief.economicsByTier[price];
    const level = el('div', 'r0-level');
    level.append(
      el('h3', null, PRICE_WORD[price]()),
      el('p', 'r0-figure', whole(brief.weeklySearchesByTier[price])),
      el('p', 'r0-small', R0.searchesWeek()),
      el('p', 'r0-small', R0.orderMargin({ order: rupees(economics.aovMeanPaise), margin: pct(economics.marginPct) })),
    );
    levels.append(level);
  }

  const panel = el('div', 'r0-panel');
  panel.dataset.region = R0.breakEvenTitle();
  panel.append(
    el('p', 'r0-eyebrow', R0.breakEvenTitle()),
    el('p', 'r0-formula', brief.breakEvenFormula),
    el('p', 'r0-sum', brief.workedAnchor.arithmetic),
    el('p', null, R0.breakEvenCaveat()),
  );

  const told = el('div', 'r0-told');
  const hints = el('dl', 'r0-hints');
  for (const [label, text] of [
    [R0.hintBuys, brief.hints.conversionRate],
    [R0.hintReturns, brief.hints.returns],
    [R0.hintCompetition, brief.hints.competition],
  ]) hints.append(el('dt', null, label()), el('dd', null, text));
  told.append(el('h3', null, R0.notTold()), hints);

  const where = el('div', 'r0-where');
  where.dataset.region = R0.whereTitle();
  let basis = 'all';
  let lit = null;
  const light = (id) => { lit = lit === id ? null : id; drawWhere(); };

  function drawWhere() {
    // Redrawing replaces the pill or place just pressed; focus goes to its
    // replacement, found by data-key, as the frame's own redraw does.
    const key = where.contains(document.activeElement) ? document.activeElement.dataset.key : null;
    const shares = sharesFor(brief.locations, brief.weeklySearchesByTier, basis);
    const head = el('div', 'r0-where-head');
    head.append(el('h3', null, R0.whereTitle()), pills({
      options: [['all', R0.basisAll()], ...PRICE_TIERS.map((p) => [p, PRICE_WORD[p]()])],
      value: basis,
      label: R0.basisLabel(),
      keyPrefix: 'basis',
      onPick: (value) => { basis = value; drawWhere(); },
    }));
    const places = el('div', 'r0-places');
    places.append(el('p', 'r0-small',
      basis === 'all' ? R0.shareAll() : R0.shareOf({ level: PRICE_WORD[basis]().toLowerCase() })));
    for (const place of brief.locations) {
      const row = el('button', lit === place.id ? 'r0-place-row on' : 'r0-place-row');
      row.type = 'button';
      row.dataset.key = `place:${place.id}`;
      row.setAttribute('aria-pressed', String(lit === place.id));
      row.append(el('strong', null, place.label), el('span', 'r0-share', pct(shares[place.id])),
        el('span', 'r0-small', place.examples.join(', ')));
      row.addEventListener('click', () => light(place.id));
      places.append(row);
    }
    places.append(el('p', 'r0-small', R0.pulseNote()), el('p', 'r0-small', brief.returnsVaryByLocation));
    const map = el('div', 'r0-mapbox');
    map.append(drawIndia({ locations: brief.locations, shares, lit, onPick: light }));
    const split = el('div', 'r0-where-split');
    split.append(places, map);
    where.replaceChildren(head, split);
    if (key) where.querySelector(`[data-key="${CSS.escape(key)}"]`)?.focus();
  }
  drawWhere();

  node.append(levels, panel, told, where, el('p', 'r0-readonly', R0.readOnly()));
  return { node };
}
