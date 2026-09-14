/**
 * Step 3, your keywords (plans/2026-09-14-round-zero-redesign.md, section 4):
 * the weekly section's card and planner, before any data. The card's weekly
 * places are present and empty; a bid under the reserve at the grade the
 * account opens on says so on its card, in one amber line (openingReserve).
 *
 * A DRAG IS NEVER REDRAWN: while a slider moves, only that card's figure and
 * warning change, and the tray. Anything else redraws the step.
 */

import { el, add } from '../dom.js';
import { keywordReach } from '../../engine/matching.js';
import { tagKeywordOffline } from '../../agents/keywordTagger.js';
import { whyButton } from '../guide/drawer.js';
import { KEYWORDS } from '../words/keywords.js';
import { R0 } from '../words/roundZero.js';
import { keywordCard, sliderMaxPaise } from '../kit/card.js';
import { openPlanner } from '../kit/planner.js';
import {
  setupKeywordCards, addSetupKeyword, updateSetupKeyword, removeSetupKeyword, SETUP_BID_PAISE,
} from './rules.js';

/** What the planner had typed, per round 0: reopening it keeps the search. */
const PLANNER = new WeakMap();
const normal = (text) => String(text).trim().toLowerCase().replace(/\s+/g, ' ');
// The step redraws behind the planner and after a removal, so the button to
// return focus to is always the one on the page now.
const focusAdd = () => document.querySelector('.r0-keywords [data-key="add"]')?.focus();

/**
 * @param {object} ctx - the frame's context (./studio.js)
 * @param {object} ctx.draft - round 0's draft; the keywords are kept here
 * @param {object} ctx.querySet
 * @param {Function} ctx.openGuide
 * @param {() => void} ctx.changed - moves the ticks and the tray, not the step
 * @param {() => void} ctx.redraw - redraws this step, keeping the scroll and focus
 * @returns {{node: HTMLElement}}
 */
export function renderKeywordsStep({ draft, querySet, openGuide, changed, redraw }) {
  if (!PLANNER.has(draft)) PLANNER.set(draft, { term: '', matchType: 'phrase', bidPaise: SETUP_BID_PAISE });
  const maxRupees = Math.round(sliderMaxPaise(draft.keywords) / 100);

  const node = el('div', 'r0-keywords');
  const intro = el('p', 'r0-intro', R0.keywordsIntro({ n: draft.keywords.length }));
  add(intro, whyButton(R0.keywordsIntro, openGuide));

  const grid = el('div', 'kgrid');
  for (const card of setupKeywordCards(draft, querySet)) {
    const drawn = keywordCard({
      card,
      maxRupees,
      openGuide,
      onMatch: (matchType) => { updateSetupKeyword(draft, card.text, { matchType }); redraw(); },
      onBid: (rupees, settled) => {
        updateSetupKeyword(draft, card.text, { bidPaise: rupees * 100 });
        if (settled) { redraw(); return; }
        drawn.show(setupKeywordCards(draft, querySet).find((c) => c.id === card.id));
        changed();
      },
      // The card, and the menu that had focus, are gone after the redraw.
      onRemove: () => { removeSetupKeyword(draft, card.text); redraw(); focusAdd(); },
    });
    grid.append(drawn.node);
  }

  const plus = el('button', 'kadd');
  plus.type = 'button';
  plus.dataset.key = 'add';
  plus.append(el('strong', null, KEYWORDS.addTitle()), el('span', null, KEYWORDS.addHow()));
  plus.addEventListener('click', () => openPlanner({
    trigger: { focus: focusAdd },
    queries: querySet.queries,
    weeklyVolume: querySet.weeklyVolume,
    state: PLANNER.get(draft),
    held: () => new Set(draft.keywords.map((k) => normal(k.text))),
    reach: (keyword) => keywordReach(keyword, querySet),
    tag: (keyword) => tagKeywordOffline(keyword, querySet),
    onAdd: (text, spec) => {
      const { ok } = addSetupKeyword(draft, text, spec);
      if (ok) redraw();
      return ok;
    },
    onAddAll: (texts, spec) => {
      for (const text of texts) addSetupKeyword(draft, text, spec);
      redraw();
    },
  }));
  grid.append(plus);

  node.append(intro, grid);
  return { node };
}
