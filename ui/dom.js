/**
 * Element and number helpers, shared by the screens.
 *
 * Money is integer paise everywhere in this project until exactly here (R7).
 * `rupees()` is the only division by 100 the interface performs, and no value
 * that has been through it is ever handed back to the engine.
 */

export const rupees = (paise) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
export const whole = (n) => Math.round(n).toLocaleString('en-IN');
export const pct = (x, places = 0) => `${(100 * (x || 0)).toFixed(places)}%`;
export const ratio = (x) => (Number.isFinite(x) ? x.toFixed(2) : '—');

/**
 * @param {string} tag
 * @param {string|null} [className]
 * @param {string|null} [text]
 * @returns {HTMLElement}
 */
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/** Append children, skipping nulls so callers can inline conditionals. */
export function add(parent, ...children) {
  for (const child of children) {
    if (child == null) continue;
    parent.append(child);
  }
  return parent;
}
