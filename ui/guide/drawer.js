/**
 * The field guide's drawer (stage C2, direction A: plans/2026-09-12-content-model-and-field-guide.md).
 *
 * The owner chose a side drawer from three mock-ups (design/field-guide/): the
 * chapter reads beside the card it explains, and the dashboard behind it stays
 * usable. On a phone the same drawer takes the whole screen.
 *
 * `guideView` decides what a chapter shows and is tested; `createGuide` draws it
 * and is checked by playing. Players see a chapter's sources and never its
 * DECISIONS citations, which keep it honest in the code, not on screen.
 */

import { CHAPTERS, CONTENTS } from './chapters.js';
import { GUIDE } from '../words/guide.js';
import { el } from '../dom.js';

/**
 * What the drawer shows for one chapter.
 *
 * @param {string} id - a chapter id
 * @param {Readonly<Record<string, string>>} figures - from `guideFigures()`
 * @returns {{id: string, title: string, real: string, sources: Array<{label: string, url: string}>,
 *   game: string, yourAccount: string, studioAccount: string, next: {id: string, title: string}|null}}
 *   `studioAccount` is where the Studio shows it: the chapter's own Studio part,
 *   or the same slot as the classic page's
 */
export function guideView(id, figures) {
  const chapter = CHAPTERS[id];
  if (!chapter) throw new RangeError(`there is no chapter "${id}"`);
  const at = CONTENTS.indexOf(id);
  const nextId = at >= 0 && at < CONTENTS.length - 1 ? CONTENTS[at + 1] : null;
  return {
    id,
    title: chapter.title,
    real: chapter.real(figures),
    sources: chapter.realSources.map(({ label, url }) => ({ label, url })),
    game: chapter.game(figures),
    yourAccount: chapter.yourAccount,
    studioAccount: chapter.studioAccount ?? chapter.yourAccount,
    next: nextId ? { id: nextId, title: CHAPTERS[nextId].title } : null,
  };
}

// ---------------------------------------------------------------------------
// The drawer on the page. Everything below touches the DOM and is checked by
// playing: at desktop and phone width, by mouse and by keyboard.
// ---------------------------------------------------------------------------

/** The class that marks a card after "Show me on the card". */
const MARKED = 'guide-marked';

const SVG = 'http://www.w3.org/2000/svg';

/** A 16px stroke icon from path data, so no glyph or emoji stands in for one. */
function icon(...paths) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '15');
  svg.setAttribute('height', '15');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of paths) {
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

const ICONS = {
  contents: ['M5 4h8', 'M5 8h8', 'M5 12h8', 'M2.5 4h.01', 'M2.5 8h.01', 'M2.5 12h.01'],
  close: ['M4 4l8 8', 'M12 4l-8 8'],
  back: ['M10 3.5L5.5 8l4.5 4.5'],
  next: ['M6 3.5L10.5 8 6 12.5'],
};

function button(className, label, onClick, iconPaths = null, iconAfter = false) {
  const node = el('button', className);
  node.type = 'button';
  const text = label ? el('span', null, label) : null;
  const glyph = iconPaths ? icon(...iconPaths) : null;
  if (iconAfter) node.append(...[text, glyph].filter(Boolean));
  else node.append(...[glyph, text].filter(Boolean));
  node.addEventListener('click', onClick);
  return node;
}

/**
 * Build the drawer once. It lives outside `#app`, so redrawing a week never
 * removes it, and it is a `.card` whose `h2` is the chapter title, so the
 * playtest recorder times it and names clicks in it by chapter.
 *
 * Not modal: the dashboard beside it stays usable, which is the point of a
 * drawer over a separate page.
 *
 * @param {object} options
 * @param {Readonly<Record<string, string>>} options.figures - from `guideFigures()`
 * @param {((slot: string) => boolean)|null} [options.reveal] - in the Studio
 *   layout, opens the section a card sits in before it is shown
 * @param {(slot: string) => boolean} [options.canShowCard] - whether a
 *   chapter's card is on the page to be shown; false before week 1, and in the
 *   Studio while the section holding it is locked
 * @param {() => boolean} [options.inStudio] - whether the Studio look is on,
 *   asked as a chapter opens: it points at the Studio's part, in its words
 * @param {() => boolean} [options.contentsPage] - opens the Studio's Guide page
 *   at its contents, and says whether it could; the classic look and round 0
 *   have no page, so the drawer shows its own list there
 * @returns {{node: HTMLElement, open: (id: string, opener?: Element) => void,
 *   openContents: (opener?: Element) => void, close: () => void, showCard: (slot: string) => void}}
 *   `showCard` is Show me, which the Guide page uses too
 */
export function createGuide({
  figures, reveal: revealCard = null, canShowCard = () => true, inStudio = () => false, contentsPage = () => false,
}) {
  const node = el('aside', 'card guide');
  node.id = 'field-guide';
  node.hidden = true;
  node.setAttribute('role', 'dialog');
  node.setAttribute('aria-modal', 'false');
  node.setAttribute('aria-labelledby', 'field-guide-title');

  let returnTo = null;

  const top = el('div', 'guide-top');
  const tools = el('div', 'guide-tools');
  const closeButton = button('ghost guide-icon', null, () => close(), ICONS.close);
  closeButton.setAttribute('aria-label', GUIDE.close());
  // In the Studio the book is a page of its own (the owner's choice,
  // 2026-09-15), so Contents opens that rather than a second, narrower list.
  const toContents = () => {
    if (contentsPage()) close({ restoreFocus: false });
    else openContents();
  };
  tools.append(
    button('ghost', GUIDE.contents(), toContents, ICONS.contents),
    closeButton,
  );
  top.append(el('span', 'guide-label', GUIDE.name()), tools);

  const body = el('div', 'guide-body');
  const foot = el('div', 'guide-foot');
  node.append(top, body, foot);

  function heading(text) {
    const h2 = el('h2', 'guide-title', text);
    h2.id = 'field-guide-title';
    h2.tabIndex = -1;
    return h2;
  }

  // Below the sticky bar rather than over it, so the week and "Run the week"
  // stay in reach. On a phone the stylesheet takes the whole screen instead.
  function reveal(opener) {
    if (opener) returnTo = opener;
    const bar = document.querySelector('.bar');
    node.style.top = `${bar ? Math.round(bar.getBoundingClientRect().bottom) : 0}px`;
    node.hidden = false;
    node.querySelector('.guide-title')?.focus({ preventScroll: true });
    body.scrollTop = 0;
  }

  function open(id, opener) {
    const view = guideView(id, figures);

    const real = el('section', 'guide-part');
    real.append(el('h3', null, GUIDE.real()), el('p', null, view.real));
    const sources = el('div', 'guide-sources');
    sources.append(el('span', null, GUIDE.sources()));
    for (const source of view.sources) {
      const link = el('a', null, source.label);
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener';
      sources.append(link);
    }
    real.append(sources);

    const game = el('section', 'guide-part');
    game.append(el('h3', null, GUIDE.game()), el('p', null, view.game));

    body.replaceChildren(heading(view.title), real, game);

    // Before week 1 there is no card to show, and a button that does nothing is
    // worse than none (plans/2026-09-14-round-zero-redesign-plan.md). In the
    // Studio what it marks is often one part of a section, not a card.
    foot.replaceChildren();
    const studio = inStudio();
    const slot = studio ? view.studioAccount : view.yourAccount;
    if (canShowCard(slot)) {
      foot.append(button('ghost', studio ? GUIDE.showAccount() : GUIDE.showCard(), () => showCard(slot), ICONS.back));
    }
    if (view.next) {
      foot.append(button('guide-next', GUIDE.next({ title: view.next.title }),
        () => open(view.next.id), ICONS.next, true));
    }
    // The last chapter, before week 1, has neither.
    foot.hidden = foot.children.length === 0;
    reveal(opener);
  }

  function openContents(opener) {
    const list = el('ul', 'guide-contents');
    for (const id of CONTENTS) {
      const item = el('li');
      item.append(button(null, CHAPTERS[id].title, () => open(id)));
      list.append(item);
    }
    body.replaceChildren(heading(GUIDE.contents()), list);
    foot.replaceChildren();
    foot.hidden = true;
    reveal(opener);
  }

  function close({ restoreFocus = true } = {}) {
    if (node.hidden) return;
    node.hidden = true;
    const back = returnTo;
    returnTo = null;
    if (restoreFocus && back?.isConnected) back.focus({ preventScroll: true });
  }

  // Close, bring the card into view, and mark it until the player next does
  // something, so the eye lands on it without the mark lingering. Focus goes to
  // the card's heading, not back to the "why?": a keyboard player pressing Tab
  // would otherwise be thrown back to wherever they started. A classic card's
  // heading is an h2; a Studio section's part draws its own as an h3, and a
  // part with none (a list, a note) takes focus itself.
  function showCard(slot) {
    close({ restoreFocus: false });
    // In the Studio layout the card may sit in a section that is not open.
    // (`revealCard`, because the drawer's own `reveal` shows the drawer.)
    revealCard?.(slot);
    const card = document.querySelector(`[data-slot="${slot}"]`);
    if (!card) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    card.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' });
    const heading = card.querySelector('h2, h3') ?? card;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    card.classList.add(MARKED);
    const clear = () => {
      card.classList.remove(MARKED);
      document.removeEventListener('pointerdown', clear, true);
      document.removeEventListener('keydown', clear, true);
    };
    document.addEventListener('pointerdown', clear, true);
    document.addEventListener('keydown', clear, true);
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !node.hidden) close();
  });

  return { node, open, openContents, close, showCard };
}

/**
 * The "why?" beside a line that names a chapter, or nothing for a line that
 * names none. A button, not a link: it opens something rather than going
 * anywhere.
 *
 * @param {{why: string|null}} entry - a line from `ui/words/`
 * @param {((id: string, opener: Element) => void)|undefined} openGuide
 * @returns {HTMLButtonElement|null}
 */
export function whyButton(entry, openGuide) {
  if (!entry?.why || !openGuide) return null;
  const node = el('button', 'why', GUIDE.why());
  node.type = 'button';
  node.setAttribute('aria-label', GUIDE.whyFor({ title: CHAPTERS[entry.why].title }));
  node.setAttribute('aria-haspopup', 'dialog');
  node.setAttribute('aria-controls', 'field-guide');
  node.addEventListener('click', () => openGuide(entry.why, node));
  return node;
}
