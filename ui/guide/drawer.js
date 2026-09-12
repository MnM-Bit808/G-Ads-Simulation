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

/**
 * What the drawer shows for one chapter.
 *
 * @param {string} id - a chapter id
 * @param {Readonly<Record<string, string>>} figures - from `guideFigures()`
 * @returns {{id: string, title: string, real: string, sources: Array<{label: string, url: string}>,
 *   game: string, yourAccount: string, next: {id: string, title: string}|null}}
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
    next: nextId ? { id: nextId, title: CHAPTERS[nextId].title } : null,
  };
}
