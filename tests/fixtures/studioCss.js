/**
 * Read the Studio stylesheet's own values, so a test can measure what the page
 * will draw: a colour's contrast, a control's size. Measured from ui/studio.css
 * itself, a later change to any value is measured the same way.
 */

import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../ui/studio.css', import.meta.url), 'utf8');
const tokens = Object.fromEntries([...css.matchAll(/(--studio-[a-z-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

/** A `--studio-*` token's value, as written. */
export const studioToken = (name) => tokens[name];

/**
 * One property of the first `body.studio <selector> { ... }` rule, with a
 * `var(--studio-*)` resolved to its token.
 *
 * @param {string} selector - exactly as the rule writes it, e.g. '.r0-mini'
 * @param {string} property - e.g. 'fill'; 'stroke' never matches 'stroke-width'
 * @returns {string}
 */
export function studioRule(selector, property) {
  const block = css.match(new RegExp(`body\\.studio ${selector.replace(/\./g, '\\.')} \\{([^}]*)\\}`))[1];
  const value = block.match(new RegExp(`(?:^|;)\\s*${property}:\\s*([^;]+)`))[1].trim();
  return value.replace(/var\((--[a-z-]+)\)/, (_, name) => tokens[name]);
}

/** '#68636B' as [104, 99, 107]; the first six-digit colour in a value such as a border. */
export const rgb = (value) => {
  const hex = value.match(/#[0-9a-f]{6}/i)[0];
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
};

const luminance = (c) => {
  const [r, g, b] = c.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG contrast ratio of two [r, g, b] colours. */
export const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
