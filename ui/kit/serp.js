/**
 * One ad as a searcher meets it: who runs it, the headlines, the descriptions.
 * The same block for a rival's ad and the player's own, because round 0 makes
 * the rivals' copy the only evidence of where they sit (17.1). Words are
 * handed in; the block holds none. Headlines are bone, never red: red is you.
 */

import { el } from '../dom.js';

/**
 * @param {object} args
 * @param {string} args.domain - shown after the sponsored tag
 * @param {string|null} [args.name] - the advertiser, at the far end of the tag
 * @param {string[]} args.headlines
 * @param {string[]} args.descriptions
 * @param {string} args.sponsored - the tag's word
 * @param {string} [args.emptyHead] - shown faint when there are no headlines yet
 * @param {string} [args.emptyDesc] - the same, for the descriptions
 * @returns {HTMLElement}
 */
export function serp({ domain, name = null, headlines, descriptions, sponsored, emptyHead = '', emptyDesc = '' }) {
  const node = el('article', 'kserp');
  const tag = el('p', 'kserp-tag');
  tag.append(el('span', null, sponsored), el('span', 'kserp-sep', '·'), el('span', null, domain));
  if (name) tag.append(el('span', 'kserp-name', name));
  const head = el('p', headlines.length > 0 ? 'kserp-head' : 'kserp-head empty',
    headlines.length > 0 ? headlines.join(' · ') : emptyHead);
  const desc = el('p', descriptions.length > 0 ? 'kserp-desc' : 'kserp-desc empty',
    descriptions.length > 0 ? descriptions.join(' ') : emptyDesc);
  node.append(tag, head, desc);
  return node;
}
