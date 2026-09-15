/**
 * The Studio layout's areas and sections, and which of today's cards each one
 * shows (plans/2026-09-13-studio-makeover.md, section 2). Pure: the shell draws
 * what this decides, and the rules can be tested without a browser.
 *
 * A section shows today's cards by their `data-slot`. Until a section is rebuilt
 * its cards are the classic ones, re-themed; `draws` names the slots a rebuilt
 * section draws itself, so the guide can still open it.
 */

import { SETTLES_AFTER_ROUNDS } from '../dashboard.js';
import { TOTAL_ROUNDS } from '../../engine/constants.js';

/** Stroked paths on a 24-unit grid, the mock-up's own icons. */
export const ICON_BOX = '0 0 24 24';
export const ICONS = Object.freeze({
  brand: ['M6 7h12l-1 13H7L6 7z', 'M9 7a3 3 0 0 1 6 0'],
  market: ['M6 8a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', 'M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6',
    'M14.5 9a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0', 'M16 14.2c2.9.4 5 2.8 5 5.8'],
  guide: ['M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z', 'M4 19a2 2 0 0 1 2-2h13'],
  results: ['M8 4h8v5a4 4 0 0 1-8 0V4z', 'M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4', 'M12 13v4M9 20h6'],
  week: ['M5 20V11M11 20V5M17 20v-6M3 20h18'],
  keywords: ['M3 12V4h8l10 10-8 8L3 12z', 'M6 7.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0'],
  typed: ['M5 11a6 6 0 1 0 12 0a6 6 0 1 0 -12 0', 'M20 20l-4.5-4.5'],
  ad: ['M3 10v4h4l6 4V6L7 10H3z', 'M16.5 9a4 4 0 0 1 0 6'],
  money: ['M5 6h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z', 'M3 10h18M16 14.5h2'],
  where: ['M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z', 'M9.5 10a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0'],
  returns: ['M4 8l8-4 8 4v8l-8 4-8-4V8z', 'M4 8l8 4 8-4M12 12v8'],
  rivals: ['M7 7h12l-3-3', 'M17 17H5l3 3'],
  menu: ['M4 7h16M4 12h16M4 17h16'],
  close: ['M6 6l12 12M18 6L6 18'],
  file: ['M6 3h8l4 4v14H6z', 'M14 3v4h4'],
});

export const AREAS = Object.freeze([
  { key: 'brand', label: 'Brand', title: 'Your brand', icon: ICONS.brand },
  { key: 'market', label: 'Market', title: 'The market', icon: ICONS.market },
  { key: 'guide', label: 'Guide', title: 'Field guide', icon: ICONS.guide },
  { key: 'results', label: 'Results', title: 'Results', icon: ICONS.results },
]);

export const SECTIONS = Object.freeze([
  // Rebuilt (the owner's choice, 2026-09-15, design/your-week/): it draws its
  // own figures, chart and impressions (ui/week/render.js); the classic three
  // cards are retired in the Studio.
  { key: 'week', area: 'brand', label: 'Your week', icon: ICONS.week, slots: [], draws: ['headline', 'share', 'revised'] },
  // Rebuilt: it draws its own cards (ui/keywords/render.js) and the classic
  // keywords card is retired in the Studio; `draws` lets the guide open it.
  { key: 'keywords', area: 'brand', label: 'Your keywords', icon: ICONS.keywords, slots: [], draws: ['keywords'] },
  // Rebuilt (the owner's choice, 2026-09-15, design/what-people-typed/): one
  // list and Block words (ui/typed/render.js); the classic two cards are retired.
  { key: 'typed', area: 'brand', label: 'What people typed', icon: ICONS.typed, slots: [], draws: ['terms', 'negatives'] },
  // Read-only (the owner, 2026-09-15): the ad is written in round 0 and runs as
  // it is (I9). It draws itself (ui/ad/render.js); the classic page has no ad card.
  { key: 'ad', area: 'brand', label: 'Your ad', icon: ICONS.ad, slots: [] },
  { key: 'money', area: 'brand', label: 'Your money', icon: ICONS.money,
    slots: ['window', 'budget', 'split', 'bidding', 'deadline'] },
  // Rebuilt (the owner's choice, 2026-09-15, design/where-when/): it draws its
  // own bars and map (ui/where/render.js), and the classic two cards are retired.
  { key: 'where', area: 'brand', label: 'Where and when', icon: ICONS.where, slots: [], draws: ['places', 'hours'] },
  // Opens the week the first returns settle: the returns card's own rule
  // (ui/dashboard.js, SETTLES_AFTER_ROUNDS), never a typed week.
  { key: 'returns', area: 'brand', label: 'Returns', icon: ICONS.returns,
    slots: ['returns', 'prepaid'], opensAt: SETTLES_AFTER_ROUNDS + 1 },
  { key: 'rivals', area: 'market', label: 'Rivals', icon: ICONS.rivals, slots: ['insights', 'trends'] },
  { key: 'marketMoves', area: 'market', label: 'The market', icon: ICONS.market, slots: ['market'] },
  { key: 'results', area: 'results', label: 'After the last week', icon: ICONS.results,
    slots: [], opensAt: TOTAL_ROUNDS },
]);

/** Cards the new screens draw instead: the tray replaces *Next week*; the rebuilt sections draw their own. */
export const RETIRED_SLOTS = Object.freeze([
  'keywords', 'next', 'places', 'hours', 'headline', 'share', 'revised', 'terms', 'negatives',
]);

/** @returns {object|null} the section a card's slot lives in */
export function sectionOf(slot) {
  return SECTIONS.find((s) => s.slots.includes(slot) || s.draws?.includes(slot)) ?? null;
}

/** @returns {object[]} an area's sections, in order */
export function sectionsIn(area) {
  return SECTIONS.filter((s) => s.area === area);
}

/**
 * Whether a section can be opened, and whether it carries a dot.
 *
 * A dot marks something new, once: a section the week it unlocks, and Your
 * money in a week its capital window is open. `seenKey` names that occasion,
 * so opening it once clears that dot and no later one.
 *
 * @param {object} section
 * @param {{played: number, seen?: Record<string, boolean>, windowOpen?: boolean}} at
 * @returns {{locked: boolean, opensAt: number|null, fresh: boolean, seenKey: string|null}}
 */
export function sectionState(section, { played, seen = {}, windowOpen = false }) {
  const opensAt = section.opensAt ?? null;
  const locked = opensAt !== null && played < opensAt;
  let seenKey = null;
  if (!locked && opensAt !== null) seenKey = `${section.key}:opened`;
  else if (section.key === 'money' && windowOpen) seenKey = `money:window:${played}`;
  return { locked, opensAt, fresh: seenKey !== null && !seen[seenKey], seenKey };
}

/**
 * The stylesheet that makes a section a filter over today's page: in each
 * section, every other section's cards and every retired card are hidden.
 *
 * @param {string} [scope] - the dashboard root, as the shell marks it
 * @returns {string}
 */
export function visibilityRules(scope = 'body.studio .studio-cards') {
  const is = (slots) => `:is(${slots.map((slot) => `[data-slot="${slot}"]`).join(', ')})`;
  const rules = [`${scope} ${is(RETIRED_SLOTS)} { display: none !important; }`];
  for (const s of SECTIONS) {
    if (s.slots.length === 0) continue;
    rules.push(`${scope}:not([data-section="${s.key}"]) ${is(s.slots)} { display: none !important; }`);
  }
  return rules.join('\n');
}
