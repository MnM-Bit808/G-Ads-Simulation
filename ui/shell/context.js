/**
 * The Studio's own context for the draft (the switch-over, part 1): what the
 * rebuilt sections read and stage through, built without drawing a page.
 *
 * Until now the shell took it from `renderDashboard`, drawn hidden on every
 * week: `formContext` plus the search terms and keyword breakdowns, and two
 * things the classic form wrote back into it, `ctx.refresh` and the keyword
 * planner's state. So the Studio drew the whole classic page to read twenty
 * fields. This builds the same fields and nothing else.
 */

import { formContext, accumulate } from '../dashboard.js';

/** The planner's opening state, as the classic keywords card set it (ui/decisions.js). */
export const PLANNER_START = Object.freeze({ matchType: 'phrase', bidPaise: 3000, term: '', open: false });

/**
 * @param {object} game - the running game: state, reports, playerId, draft, view
 * @param {object} [options]
 * @param {() => void} [options.onChange] - after anything is staged; the shell redraws its tray
 * @returns {object} `formContext(game)` plus `terms`, `byKeyword`, `planner`, `sync` and `refresh`
 */
export function studioContext(game, { onChange } = {}) {
  const ctx = {
    ...formContext(game),
    terms: null,
    byKeyword: null,
    planner: { ...PLANNER_START },
    /** Both breakdowns follow whichever range the report is showing. */
    sync: () => {
      ctx.terms = accumulate(game, 'byQuery', game.view.termsRange);
      ctx.byKeyword = accumulate(game, 'byKeyword', game.view.termsRange);
    },
    /** A change was staged: read the figures again, then let the shell catch up. */
    refresh: () => {
      ctx.sync();
      onChange?.();
    },
  };
  ctx.sync();
  return ctx;
}
