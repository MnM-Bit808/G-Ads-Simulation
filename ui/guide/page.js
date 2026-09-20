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

  /** One group of the contents, under its own heading. */
  function group(cards_, label) {
    const grid = el('div', 'gb-grid');
    for (const c of cards_) {
      const top = el('span', 'gb-top');
      // A ground-floor card names the round 0 step that asks for it; a nuance
      // card names the Studio section it explains.
      const where = c.group === 'start' ? GUIDE.usedIn({ step: c.step }) : c.section;
      top.append(el('span', 'gb-num', String(c.n)), el('span', 'gb-where', where));
      const card = button('gb-card', top, el('span', 'gb-name', c.title), el('span', 'gb-opening', c.opening));
      card.addEventListener('click', () => onOpen(c.id));
      grid.append(card);
    }
    const head = el('h2', 'gb-group', label);
    return [head, grid];
  }

  function contents() {
    const node = el('div', 'gb');
    node.append(el('p', 'gb-intro', GUIDE.intro()));
    // Before the chapter list, not after it: what a number here is worth is
    // the frame for every chapter below, and a note under 23 cards is a note
    // nobody reads.
    node.append(el('p', 'gb-real', GUIDE.whatIsReal()));
    // Start here, then Going deeper. The split is itself teaching: what a
    // control IS, before why it behaves oddly.
    node.append(...group(cards.filter((c) => c.group === 'start'), GUIDE.startHere()));
    node.append(...group(cards.filter((c) => c.group === 'deeper'), GUIDE.goingDeeper()));
    return node;
  }

  function half(label, text, sources = []) {
    const box = el('section', label ? 'gb-half' : 'gb-half gb-plain');
    if (label) box.append(el('h3', null, label));
    box.append(el('p', null, text));
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

    // A GROUND-FLOOR CHAPTER IS ONE COLUMN, with the step that asks for it and
    // a way on to the chapter that continues it, in place of a card to show.
    if (page.kind === 'basic') {
      meta.append(el('span', null, GUIDE.chapterOf({ n: page.n, of: page.of })),
        el('span', 'gb-explains', GUIDE.usedIn({ step: page.step })));
      const only = half(null, page.plain, page.sources);
      const on = el('div', 'gb-related');
      const chip = button('gb-chip', GUIDE.readOn({ title: page.then.title }));
      chip.addEventListener('click', () => onOpen(page.then.id));
      on.append(chip);
      const node = el('div', 'gb');
      const turns = el('div', 'gb-turns');
      turns.append(page.previous ? turn(page.previous, ARROWS.back, false) : el('span'),
        page.following ? turn(page.following, ARROWS.on, true) : el('span'));
      node.append(meta, only, on, turns);
      return node;
    }

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
