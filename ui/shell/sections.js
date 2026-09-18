/**
 * The Studio layout's areas and sections, and the parts each one draws
 * (plans/2026-09-13-studio-makeover.md, section 2). Pure: the shell draws what
 * this decides, and the rules can be tested without a browser.
 *
 * `draws` names the `data-slot`s a section's own module sets, which is how the
 * guide's "Show me in your account" finds a part and how a first visit knows
 * what to bring in.
 *
 * IT USED TO BE A FILTER. The makeover was built beside the classic page: a
 * section listed the classic cards it `slots`-ed, and an injected stylesheet
 * hid every other section's. Section by section that list emptied as each
 * section was rebuilt to draw its own parts, and the switch-over's part 2
 * deleted the page, so the last of the machinery — `slots`, `RETIRED_SLOTS`
 * and `visibilityRules` — went with it. Nothing is hidden now; a section is
 * simply what it draws.
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
  learned: ['M9 18h6', 'M10 21h4', 'M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z'],
  squares: ['M3 6h18v12H3z', 'M3 12h18', 'M9 6v12', 'M15 6v12'],
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
  { key: 'week', area: 'brand', label: 'Your week', icon: ICONS.week, draws: ['headline', 'share', 'revised'] },
  // Rebuilt: it draws its own cards (ui/keywords/render.js) and the classic
  // keywords card is retired in the Studio; `draws` lets the guide open it.
  { key: 'keywords', area: 'brand', label: 'Your keywords', icon: ICONS.keywords, draws: ['keywords'] },
  // Rebuilt (the owner's choice, 2026-09-15, design/what-people-typed/): one
  // list and Block words (ui/typed/render.js); the classic two cards are retired.
  { key: 'typed', area: 'brand', label: 'What people typed', icon: ICONS.typed, draws: ['terms', 'negatives'] },
  // Read-only (the owner, 2026-09-15): the ad is written in round 0 and runs as
  // it is (I9). It draws itself (ui/ad/render.js); the classic page has no ad card.
  // Its writer carries a slot so the guide's "Who writes the ad" can show it.
  { key: 'ad', area: 'brand', label: 'Your ad', icon: ICONS.ad, draws: ['writer'] },
  // Rebuilt (the owner's choice, 2026-09-15, design/your-money/): this month as
  // one bar, with the week-5 window on top and bidding and week 8 beside each
  // other (ui/money/render.js); the classic five cards are retired.
  { key: 'money', area: 'brand', label: 'Your money', icon: ICONS.money,
    draws: ['window', 'budget', 'split', 'bidding', 'deadline'] },
  // Rebuilt (the owner's choice, 2026-09-15, design/where-when/): it draws its
  // own bars and map (ui/where/render.js), and the classic two cards are retired.
  { key: 'where', area: 'brand', label: 'Where and when', icon: ICONS.where, draws: ['places', 'hours'] },
  // Opens the week the first returns settle: the returns card's own rule
  // (ui/dashboard.js, SETTLES_AFTER_ROUNDS), never a typed week. Rebuilt (the
  // owner's choice, 2026-09-15, design/returns/): its figures, weeks, discount
  // and levers (ui/returns/render.js); the classic two cards are retired.
  { key: 'returns', area: 'brand', label: 'Returns', icon: ICONS.returns,
    draws: ['returns-figures', 'returns', 'prepaid', 'returns-levers'], opensAt: SETTLES_AFTER_ROUNDS + 1 },
  // Rebuilt (the owner's choice, 2026-09-15, design/market/): one section, the
  // market's public figures on top and each rival you meet as a card
  // (ui/rivals/render.js); the classic three cards are retired, and the
  // market card no longer has a section of its own.
  { key: 'rivals', area: 'market', label: 'Rivals', icon: ICONS.rivals, draws: ['market', 'insights'] },
  // Rebuilt (the owner's choice, 2026-09-15, design/results/): four sections
  // after the last week, drawn by ui/results/render.js, in the order they are
  // read; each carries a dot until opened and ends by pointing at the next.
  // The classic end screen still draws for the classic look.
  { key: 'twelve', area: 'results', label: 'Twelve weeks', icon: ICONS.week,
    draws: ['results-figures', 'results-weeks', 'results-built'], opensAt: TOTAL_ROUNDS },
  { key: 'learned', area: 'results', label: 'What you learned', icon: ICONS.learned,
    draws: ['results-lessons', 'results-moments', 'results-budget'], opensAt: TOTAL_ROUNDS },
  { key: 'reveal', area: 'results', label: 'Where they sat', icon: ICONS.squares,
    draws: ['results-reveal', 'results-squares'], opensAt: TOTAL_ROUNDS },
  { key: 'books', area: 'results', label: 'Everyone’s books', icon: ICONS.results,
    draws: ['results-books', 'results-finish'], opensAt: TOTAL_ROUNDS },
  // On the playtest link only (design/switch-over/, 2026-09-16): the questions
  // a tester answers before sending the file, as the last Results section
  // rather than a card under Everyone's books, where one who stops at the first
  // section never meets them.
  { key: 'playtest', area: 'results', label: 'Before you go', icon: ICONS.file,
    draws: ['results-playtest'], opensAt: TOTAL_ROUNDS, playtestOnly: true },
]);

/** @returns {object|null} the section that draws the part a slot names */
export function sectionOf(slot) {
  return SECTIONS.find((s) => s.draws?.includes(slot)) ?? null;
}

/**
 * The parts a section's first visit brings in (spec section 3, row 3).
 *
 * Found planning Returns: this once looked for a section's cards among the
 * classic page's, so rebuilding Your money quietly took its week-5 entrance
 * away. Every section draws its own parts now, so there is one answer.
 *
 * @param {object} section
 * @returns {string[]} data-slot names
 */
export function entranceSlots(section) {
  return section.draws ?? [];
}

/**
 * @param {string} area
 * @param {{playtest?: boolean}} [options] - on the playtest link, Results has "Before you go"
 * @returns {object[]} an area's sections, in order
 */
export function sectionsIn(area, { playtest = false } = {}) {
  return SECTIONS.filter((s) => s.area === area && (playtest || !s.playtestOnly));
}

/**
 * The section an area's rail button opens: the one last open there, so a trip
 * to the Guide or the Market comes back to where the player was (found drawing
 * the Guide as a page, 2026-09-15), or else the area's first.
 *
 * @param {string} area
 * @param {Record<string, string>} [lastIn] - the section last open, by area
 * @param {{playtest?: boolean}} [options] - as `sectionsIn` takes them
 * @returns {string} a section key in that area
 */
export function areaEntry(area, lastIn = {}, options = {}) {
  const inArea = sectionsIn(area, options);
  return inArea.find((s) => s.key === lastIn[area])?.key ?? inArea[0].key;
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
 * Whether the guide's "Show me" can open the part a slot names: a section holds
 * it, and that section is open (the owner, 2026-09-15). Before week 6 Returns
 * is locked, and Results before week 12; a button that opens a locked section
 * shows nothing, so it waits.
 *
 * @param {string} slot
 * @param {{played: number}} at
 * @returns {boolean}
 */
export function slotOpen(slot, at) {
  const section = sectionOf(slot);
  return section !== null && !sectionState(section, at).locked;
}

