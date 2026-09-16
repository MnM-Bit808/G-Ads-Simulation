/**
 * What the Studio's Results area reads from the debrief (plans/2026-09-13-debrief.md).
 *
 * The readings are ./read.js and the words ../words/debrief.js. Until the
 * switch-over's part 2 (2026-09-16) this file also DREW the classic end
 * screen's debrief and reveal; the Studio draws its own four Results sections
 * (ui/results/render.js) from the same readings, so what is left here is the
 * two sentences both looks shared. Deleting the drawing also cut this module's
 * import of the classic round 0, which was the last thing keeping
 * ui/round-zero.js in the page's import graph.
 */

import { rupees, whole, pct } from '../dom.js';
import { DEBRIEF } from '../words/debrief.js';
import { STRATEGY_NAMES } from '../ending.js';
import { MATERIAL_LOSS } from './read.js';

/**
 * The budget question's answer, in the order a player reads it: how often the
 * money ran out, then what the rest of the month would have done in those
 * weeks, then the weeks with none of their month left.
 *
 * @param {object} read - `budgetWeeks`'s reading (./read.js): `ranOut`,
 *   `played`, `best`, `paidFor`, `brokeEven`, `lostMoney`, `nothingLeft`
 * @returns {string[]}
 */
export function budgetLines(read) {
  if (read.ranOut === 0) return [DEBRIEF.budgetNeverRanOut()];
  const lines = [DEBRIEF.budgetRanOut({ ranOut: read.ranOut, played: read.played })];
  if (read.best) {
    lines.push(DEBRIEF.budgetPaid({
      count: read.paidFor.length,
      round: read.best.round,
      clicks: whole(read.best.clicks),
      kept: rupees(read.best.profitIfFundedPaise),
    }));
  }
  if (read.brokeEven.length > 0) {
    lines.push(DEBRIEF.budgetBrokeEven({ count: read.brokeEven.length, weeks: read.brokeEven.map((w) => w.round) }));
  }
  if (read.lostMoney.length > 0) {
    const all = read.paidFor.length + read.brokeEven.length + read.nothingLeft.length === 0;
    lines.push(DEBRIEF.budgetLost({ count: read.lostMoney.length, all }));
  }
  if (read.nothingLeft.length > 0) lines.push(DEBRIEF.budgetNothingLeft({ weeks: read.nothingLeft }));
  return lines;
}

/**
 * The sentence for one lesson, met or not, as its words and figures. The
 * Studio's What you learned draws the same (ui/results/render.js).
 *
 * @param {{id: string, met: boolean, figures: object|null}} lesson - from `lessons`
 * @returns {[Function, object]|null} the words' entry, and the figures to call it with
 */
export function lessonSentence(lesson) {
  const f = lesson.figures ?? {};
  switch (lesson.id) {
    case 'numbersMove':
      return [DEBRIEF.numbersMove, {
        round: f.round, first: rupees(f.firstReportedPaise), now: rupees(f.nowPaise),
      }];
    case 'rankOrBudget':
      if (!lesson.met) return [DEBRIEF.rankOrBudgetNot, { threshold: pct(MATERIAL_LOSS) }];
      return [f.kind === 'budget' ? DEBRIEF.rankOrBudgetBudget : DEBRIEF.rankOrBudgetRank,
        { round: f.round, share: pct(f.share) }];
    case 'broadMatch':
      return lesson.met
        ? [DEBRIEF.broadMatch, { terms: whole(f.unwrittenTerms), negatives: whole(f.negatives), blocked: f.negatives }]
        : [DEBRIEF.broadMatchNot, {}];
    case 'returns':
      return [DEBRIEF.returns, {
        share: f.returnedShare == null ? '—' : pct(f.returnedShare), rank: f.rank, grossRank: f.grossRank,
      }];
    case 'ownName':
      if (!lesson.met) return [DEBRIEF.ownNameNot, {}];
      if (f.ownCpcPaise == null) return [DEBRIEF.ownNameNoClicks, {}];
      return [DEBRIEF.ownName, {
        own: rupees(f.ownCpcPaise), other: f.otherCpcPaise == null ? '—' : rupees(f.otherCpcPaise),
      }];
    case 'smartBidding':
      return lesson.met
        ? [DEBRIEF.smartBidding, {
          strategy: STRATEGY_NAMES[f.strategy] ?? f.strategy, round: f.round, learning: f.learningWeeks,
        }]
        : [DEBRIEF.smartBiddingNot, {}];
    default:
      return null;
  }
}
