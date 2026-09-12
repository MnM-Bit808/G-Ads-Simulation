/**
 * One sentence on screen, and what kind of sentence it is (stage C1,
 * plans/2026-09-12-content-model-and-field-guide.md).
 *
 * WHY THE KIND IS PART OF THE SENTENCE. The screens used to carry every kind of
 * sentence the same way, always on screen, and the one human playtester skimmed
 * all of them. Labelling each one says where it belongs:
 *
 *   reading      a statement about this player's account. It stays, short.
 *   disclosure   where the game departs from real Google Ads. It stays, and it
 *                must name the guide chapter that explains why: DECISIONS I11,
 *                an abstraction is honest only if the screen says so.
 *   instruction  how to use a control. Headed for a label or tooltip (C4).
 *   label        the name of a figure or a legend key.
 *
 * A CONCEPT IS REFUSED. How something works is a field guide chapter, and a
 * concept left on a card is exactly the text nobody reads.
 *
 * A sentence is a function of the figures it quotes, passed in by the render
 * function that already works them out. This module imports nothing, so a
 * sentence cannot compute a number; it can only phrase one.
 */

/** The kinds of sentence a screen may carry. */
export const KINDS = Object.freeze(['reading', 'disclosure', 'instruction', 'label']);

/**
 * @param {string} kind - one of `KINDS`
 * @param {string | ((figures: object) => string)} text
 * @param {{why?: string|null}} [options] - the guide chapter explaining it
 * @returns {((figures?: object) => string) & {kind: string, why: string|null}}
 */
export function line(kind, text, { why = null } = {}) {
  if (kind === 'concept') throw new TypeError('a concept is a guide chapter, never a line on screen');
  if (!KINDS.includes(kind)) throw new TypeError(`unknown kind "${kind}"`);
  if (kind === 'disclosure' && !why) throw new TypeError('a disclosure must say why: name a guide chapter');
  const say = typeof text === 'function' ? text : () => text;
  const entry = (figures = {}) => say(figures);
  entry.kind = kind;
  entry.why = why;
  return Object.freeze(entry);
}
