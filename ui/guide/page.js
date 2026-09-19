/**
 * The Guide as a page (the owner's choice, 2026-09-15, design/guide/): the
 * contents, and one chapter at a time, in the Studio's Guide area. What each
 * shows is worked out in ./book.js; the words are in ui/words/guide.js.
 *
 * A chapter reads at full width with its two halves side by side, and its Show
 * me is the drawer's own, so the page and a "why?" mark a part the same way.
 */

import { el } from '../dom.js';
import { button, icon } from '../kit/controls.js';
import { GUIDE } from '../words/guide.js';
import { contentsCards, chapterPage } from './book.js';

const ARROWS = { back: ['M15 5l-7 7 7 7'], on: ['M9 5l7 7-7 7'] };

/**
 * @param {object} args
 * @param {Readonly<Record<string, string>>} args.figures - from `guideFigures()`
 * @param {(id: string) => void} args.onOpen - opens a chapter, or 'contents'
 * @param {(slot: string) => void} args.showSlot - the drawer's `showCard`
 * @param {(slot: string) => boolean} args.canShow - false before week 1, and
 *   while the section holding the slot is locked
 * @returns {{node: (id: string) => HTMLElement}}
 */
export function renderGuidePage({ figures, onOpen, showSlot, canShow }) {
  const cards = contentsCards(figures);

  function contents() {
    const grid = el('div', 'gb-grid');
    for (const c of cards) {
      const top = el('span', 'gb-top');
      top.append(el('span', 'gb-num', String(c.n)), el('span', 'gb-where', c.section));
      const card = button('gb-card', top, el('span', 'gb-name', c.title), el('span', 'gb-opening', c.opening));
      card.addEventListener('click', () => onOpen(c.id));
      grid.append(card);
    }
    const node = el('div', 'gb');
    node.append(el('p', 'gb-intro', GUIDE.intro()), grid);
    return node;
  }

  function half(label, text, sources = []) {
    const box = el('section', 'gb-half');
    box.append(el('h3', null, label), el('p', null, text));
    if (sources.length > 0) {
      const list = el('div', 'gb-sources');
      list.append(el('span', null, GUIDE.sources()));
      for (const source of sources) {
        const link = el('a', null, source.label);
        link.href = source.url;
        link.target = '_blank';
        link.rel = 'noopener';
        list.append(link);
      }
      box.append(list);
    }
    return box;
  }

  function turn(to, arrow, iconAfter) {
    const label = el('span', null, GUIDE.numbered(to));
    const link = button('gb-turn', ...(iconAfter ? [label, icon(arrow)] : [icon(arrow), label]));
    link.addEventListener('click', () => onOpen(to.id));
    return link;
  }

  function chapter(id) {
    const page = chapterPage(id, figures);
    const meta = el('div', 'gb-meta');
    const explains = el('span', 'gb-explains', `${GUIDE.explains()} `);
    explains.append(el('b', null, page.section));
    meta.append(el('span', null, GUIDE.chapterOf({ n: page.n, of: page.of })), explains);
    // Before week 1, and while the section is locked, there is nothing to show.
    if (canShow(page.slot)) {
      const show = button('gb-show', GUIDE.showAccount());
      show.addEventListener('click', () => showSlot(page.slot));
      meta.append(show);
    }
    const halves = el('div', 'gb-halves');
    halves.append(half(GUIDE.real(), page.real, page.sources), half(GUIDE.game(), page.game));
    const node = el('div', 'gb');
    node.append(meta, halves);
    // Under both halves rather than inside one, so it can be skipped by anyone
    // who does not care and found by anyone who does. The drawer draws the same
    // block the same way.
    if (page.departs.length > 0) {
      const apart = el('section', 'gb-departs');
      const list = el('ul', null);
      for (const line of page.departs) list.append(el('li', null, line));
      apart.append(el('h3', null, GUIDE.departs()), list);
      node.append(apart);
    }
    if (page.related.length > 0) {
      const related = el('div', 'gb-related');
      related.append(el('span', null, GUIDE.readBeside()));
      for (const r of page.related) {
        const chip = button('gb-chip', GUIDE.numbered(r));
        chip.addEventListener('click', () => onOpen(r.id));
        related.append(chip);
      }
      node.append(related);
    }
    const turns = el('div', 'gb-turns');
    turns.append(page.previous ? turn(page.previous, ARROWS.back, false) : el('span'),
      page.following ? turn(page.following, ARROWS.on, true) : el('span'));
    node.append(turns);
    return node;
  }

  return { node: (id) => (id === 'contents' ? contents() : chapter(id)) };
}
