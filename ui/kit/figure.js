/**
 * A figure: a label, the number under it, and a quieter line under that.
 *
 * ONE OBJECT, FOUR IMPLEMENTATIONS UNTIL I49 (2026-09-25). Your week, Returns,
 * Rivals and Results each built this themselves — `yw-stat`, `wr-figure`,
 * `rv-figure`, `rs-stat` — with their own label, value and sub classes. They
 * had already drifted to four sizes of the same number (24, 26, 28, 30, settled
 * at 28 by I48) and, less visibly, to TWO label styles: sentence-case grey in
 * Your week and Results, uppercase micro in Rivals and Returns.
 *
 * WHY SENTENCE CASE WON, and it is not taste. The uppercase micro is also the
 * table column-heading style — the books' header, What people typed's columns.
 * One style serving two roles is the same conflation that let a read-only
 * answer wear a text input's border (`.rs-answer`, I48). So: uppercase marks a
 * column, sentence case labels a figure.
 *
 * Where and when keeps its own, and should: its figure is inline and reversed
 * — the number, then the word, on one baseline inside a table row. A different
 * object that happens to contain the same two things.
 */

import { el, add } from '../dom.js';
import { whyButton } from '../guide/drawer.js';
import { CHAPTERS } from '../guide/chapters.js';
import { GUIDE } from '../words/guide.js';

/**
 * @param {object} args
 * @param {string} args.label - what the figure is
 * @param {string|Node} args.value - the figure itself
 * @param {string|null} [args.sub] - the quieter line under it
 * @param {boolean} [args.loss] - draw the value as a loss (amber, not red:
 *   red is the player's colour, so it cannot also mean "bad")
 * @param {{why: string|null}|null} [args.why] - the `line` whose chapter the
 *   why-button opens; null for no button
 * @param {Function|null} [args.openGuide] - `guide.open`
 * @param {Node|null} [args.lead] - a node before the label, e.g. Returns' swatch
 * @param {Node|null} [args.extra] - a node after the value, e.g. Your week's
 *   landed-against-pending bar
 * @returns {HTMLElement}
 */
export function figure({
  label = null, value, sub = null, loss = false, why = null, openGuide = null,
  lead = null, extra = null,
}) {
  const box = el('div', 'kfig');
  // A figure may have no label: a rival card's headline is the number and the
  // sentence under it, with the brand name above doing the labelling.
  const head = label ? el('span', 'kfig-label') : null;
  if (head) {
    add(head, lead);
    head.append(el('span', null, label));
    const ask = whyButton(why, openGuide);
    if (ask) {
      // Named by the figure it belongs to, so a screen reader hears which of
      // six "why?" buttons this is rather than six identical ones.
      ask.setAttribute('aria-label', GUIDE.whyForFigure({ figure: label, title: CHAPTERS[why.why].title }));
      head.append(ask);
    }
  }
  const big = typeof value === 'string'
    ? el('strong', loss ? 'kfig-value loss' : 'kfig-value', value)
    : value;
  add(box, head, big, extra, sub ? el('span', 'kfig-sub', sub) : null);
  return box;
}

/**
 * A row of figures, which is how every section shows them.
 *
 * @param {HTMLElement[]} items
 * @param {object} [args]
 * @param {boolean} [args.carded] - draw the strip as a card of its own, as
 *   Your week's six and Results' six do; Rivals and Returns sit inside one
 * @param {string|null} [args.slot] - the shell's `data-slot`, for the guide's
 *   "Show me in your account"
 * @returns {HTMLElement}
 */
export function figures(items, { carded = false, slot = null } = {}) {
  const box = el('div', carded ? 'kfigs carded' : 'kfigs');
  if (slot) box.dataset.slot = slot;
  box.style.setProperty('--kfigs-count', String(items.length));
  box.append(...items);
  return box;
}
