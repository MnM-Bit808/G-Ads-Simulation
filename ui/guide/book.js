/**
 * The Guide as a page (the owner's choice, 2026-09-15, design/guide/): what the
 * contents and each chapter show, worked out without a page so a test can hold
 * it. ./page.js draws it, in the Studio's Guide area; "why?" still opens the
 * drawer (./drawer.js) beside a section.
 */

import { CHAPTERS, CONTENTS } from './chapters.js';
import { guideView } from './drawer.js';
import { sectionOf } from '../shell/sections.js';

/**
 * A chapter's opening sentence, for its card on the contents: the first that
 * ends in a full stop or a colon followed by a space, so "2.5" does not end
 * one. A colon becomes a full stop ("Google Ads budgets by the day.").
 *
 * @param {string} text
 * @returns {string}
 */
export function openingSentence(text) {
  const match = text.match(/^.*?[.:](?=\s|$)/);
  const sentence = (match ? match[0] : text).trim();
  return sentence.endsWith(':') ? `${sentence.slice(0, -1)}.` : sentence;
}

/** A chapter as a link elsewhere on the page: its number and title. */
function entry(id) {
  return { id, n: CONTENTS.indexOf(id) + 1, title: CHAPTERS[id].title };
}

/**
 * The Guide area's list, after Contents: every chapter by its number.
 *
 * @returns {Array<{id: string, n: number, title: string}>}
 */
export function chapterList() {
  return CONTENTS.map(entry);
}

/**
 * The contents: every chapter in reading order, with the Studio section it
 * explains and its opening sentence.
 *
 * @param {Readonly<Record<string, string>>} figures - from `guideFigures()`
 * @returns {Array<{id: string, n: number, title: string, section: string, opening: string}>}
 */
export function contentsCards(figures) {
  return CONTENTS.map((id) => {
    const view = guideView(id, figures);
    return { ...entry(id), section: sectionOf(view.studioAccount).label, opening: openingSentence(view.real) };
  });
}

/**
 * One chapter as the page shows it: both halves and the sources (guideView),
 * where it sits in the book, the Studio section it explains and the slot Show
 * me opens there, the chapters to read beside it, and the ones either side.
 *
 * @param {string} id
 * @param {Readonly<Record<string, string>>} figures
 */
export function chapterPage(id, figures) {
  const view = guideView(id, figures);
  const at = CONTENTS.indexOf(id);
  return {
    id,
    n: at + 1,
    of: CONTENTS.length,
    title: view.title,
    real: view.real,
    sources: view.sources,
    game: view.game,
    departs: view.departs,
    slot: view.studioAccount,
    section: sectionOf(view.studioAccount).label,
    related: CHAPTERS[id].related.map(entry),
    previous: at > 0 ? entry(CONTENTS[at - 1]) : null,
    following: at < CONTENTS.length - 1 ? entry(CONTENTS[at + 1]) : null,
  };
}
