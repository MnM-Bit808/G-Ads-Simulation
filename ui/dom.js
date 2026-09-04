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

/**
 * Build a table from a header spec and row descriptors.
 *
 * A header is a string, or `{ label, num }` when the column holds figures.
 * `num` right-aligns and sets tabular numerals, which is the difference between
 * a column you can compare down and one you cannot.
 *
 * @param {HTMLTableElement} node
 * @param {Array<string|{label: string, num?: boolean}>} headers
 * @param {Array<{cells: Array<string|Node>, className?: string}>} rows
 */
export function table(node, headers, rows) {
  node.replaceChildren();
  const head = el('thead');
  const headRow = el('tr');
  for (const header of headers) {
    headRow.append(el('th', header.num ? 'num' : null, header.label ?? header));
  }
  head.append(headRow);

  const body = el('tbody');
  for (const row of rows) {
    const tr = el('tr', row.className);
    for (const [i, cell] of row.cells.entries()) {
      const td = el('td', headers[i]?.num ? 'num' : null);
      if (cell instanceof Node) td.append(cell);
      else td.textContent = cell;
      tr.append(td);
    }
    body.append(tr);
  }
  node.append(head, body);
}

/** A labelled figure: the unit of the headline row. */
export function figure(label, value, sub, tone) {
  const box = el('div', 'figure');
  box.append(el('div', 'label', label));
  box.append(el('div', `value${tone ? ` ${tone}` : ''}`, value));
  if (sub) box.append(el('div', 'sub', sub));
  return box;
}

/**
 * A labelled form field.
 *
 * `hint` may be a string or a node. It used to be passed to `el()`, which sets
 * `textContent` — so round 0's character counters, which are spans, rendered
 * as the literal text "[object HTMLSpanElement]" under every headline and
 * description from the day they were written. Nothing caught it: the counters
 * are cosmetic, no test reads them, and they are small grey text at the end of
 * a long form.
 */
export function field(label, control, hint) {
  const wrap = el('label', 'field');
  wrap.append(el('span', 'field-label', label));
  wrap.append(control);
  if (hint instanceof Node) {
    const box = el('span', 'field-hint');
    box.append(hint);
    wrap.append(box);
  } else if (hint) {
    wrap.append(el('span', 'field-hint', hint));
  }
  return wrap;
}

/** An <input>, wired to call back on every keystroke. */
export function input({ value = '', type = 'text', onInput, ...attrs } = {}) {
  const node = el('input');
  node.type = type;
  node.value = value;
  for (const [key, val] of Object.entries(attrs)) node.setAttribute(key, val);
  if (onInput) node.addEventListener('input', () => onInput(node.value, node));
  return node;
}

/** A <select> from `[value, label]` pairs. */
export function select({ options, value, onChange }) {
  const node = el('select');
  for (const [optionValue, label] of options) {
    const option = el('option', null, label);
    option.value = optionValue;
    if (optionValue === value) option.selected = true;
    node.append(option);
  }
  if (onChange) node.addEventListener('change', () => onChange(node.value));
  return node;
}
