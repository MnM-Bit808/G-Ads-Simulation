/**
 * What Your keywords shows (plans/2026-09-13-studio-makeover.md, section 4).
 * Pure: the draft, the report's own per-keyword rows and the engine's reach
 * count go in, plain objects come out for the kit's card (ui/kit/card.js) to
 * draw. Money stays in paise; nothing here formats. The slider's range is the
 * kit's own (`sliderMaxPaise`), shared with round 0.
 */

import { qualitySummary, updateKeyword } from '../decisions.js';
import { MIN_BID_PAISE } from '../../engine/constants.js';

/** How many keywords the panel names by their share of the week's money (I6). */
export const SPEND_NAMED = 3;

const LEVERS = Object.freeze({
  budget: ['stretch', 'addMoney'],
  both: ['stretch', 'addMoney'],
  rank: ['raise'],
  saturated: ['reach'],
});

/**
 * One card per keyword, in the draft's order, in the shape round 0's
 * `setupKeywordCards` gives the same card.
 *
 * @param {object} args
 * @param {object} args.draft
 * @param {Record<string, {clicks: number, costPaise: number, conversions: number}>} args.byKeyword
 * @param {Record<string, object>} [args.quality] - this advertiser's reportedScores
 * @param {object|null} [args.grades] - `effectiveGrades(draft)`
 * @param {(keyword: object) => number} args.reach - how many searches it reaches on its match type
 * @returns {object[]}
 */
export function keywordCards({ draft, byKeyword, quality = {}, grades = null, reach }) {
  return draft.keywords.map((keyword) => {
    const base = draft.base.keywords.find((k) => k.id === keyword.id) ?? null;
    const row = base ? byKeyword?.[keyword.id] : null;
    const broad = keyword.matchType === 'broad';
    return {
      id: keyword.id,
      text: keyword.text,
      matchType: keyword.matchType,
      active: keyword.active !== false,
      isNew: base === null,
      bidPaise: keyword.bidPaise,
      wasBidPaise: base && base.bidPaise !== keyword.bidPaise ? base.bidPaise : null,
      wasMatchType: base && base.matchType !== keyword.matchType ? base.matchType : null,
      reach: reach(keyword),
      // Tags decide how far broad reaches and nothing else (E8), so they show
      // exactly when broad is chosen.
      tags: broad ? [...keyword.tags] : null,
      noTagsOnBroad: broad && keyword.tags.length === 0,
      stats: base === null ? null : {
        clicks: row?.clicks ?? 0,
        costPaise: row?.costPaise ?? 0,
        cpcPaise: row && row.clicks > 0 ? Math.round(row.costPaise / row.clicks) : null,
        conversions: row?.conversions ?? 0,
      },
      quality: qualitySummary(quality?.[keyword.id] ?? null, grades),
      // Round 0's per-keyword warning that a bid cannot clear the reserve
      // (I17). The weekly form has never carried it per keyword (it warns once,
      // for the strategy's own bid, `bidOutlook`), so a week's card leaves it off.
      needPaise: null,
    };
  });
}

/**
 * One change across several keywords, each through `updateKeyword`, so a bulk
 * edit is exactly the single edits it stands for. A percentage rounds each bid
 * to the whole rupee and never below the minimum bid.
 *
 * @param {object} draft
 * @param {string[]} ids
 * @param {{setBidPaise?: number, byPercent?: number, matchType?: string}} change
 * @returns {{changed: string[], refused: Array<{id: string, reason: string}>}}
 */
export function adjustSeveral(draft, ids, change) {
  if (!['setBidPaise', 'byPercent', 'matchType'].some((key) => key in change)) {
    throw new TypeError('adjustSeveral needs setBidPaise, byPercent or matchType');
  }
  const patchFor = (keyword) => {
    if ('setBidPaise' in change) return { bidPaise: change.setBidPaise };
    if ('matchType' in change) return { matchType: change.matchType };
    const rupees = Math.round((keyword.bidPaise * (100 + change.byPercent)) / 10000);
    return { bidPaise: Math.max(MIN_BID_PAISE, rupees * 100) };
  };

  const out = { changed: [], refused: [] };
  for (const id of ids) {
    const keyword = draft.keywords.find((k) => k.id === id);
    if (!keyword) {
      out.refused.push({ id, reason: 'no such keyword' });
      continue;
    }
    const result = updateKeyword(draft, id, patchFor(keyword));
    if (result.ok) out.changed.push(id);
    else out.refused.push({ id, reason: result.reason });
  }
  return out;
}

/**
 * The dark panel: what held the week back, where its money went, and the
 * levers that act on it (spec section 4, item 2). Cost is the only split,
 * because it is final the week it is spent; conversions keep arriving. It
 * names levers and never a verdict: whether more clicks would pay is not
 * something it can see.
 *
 * @param {object} args
 * @param {object|null} args.outlook - `marketOutlook(...)`, ui/chart.js
 * @param {Array<{id: string, text: string}>} args.keywords - the week's own, `draft.base.keywords`
 * @param {Record<string, {costPaise: number}>} args.lastWeek - the week's per-keyword rows
 * @param {number} args.week - the week just played
 * @returns {null|object}
 */
export function readingPanel({ outlook, keywords, lastWeek, week }) {
  if (!outlook) return null;
  const names = new Map(keywords.map((k) => [k.id, k.text]));
  const rows = Object.entries(lastWeek ?? {})
    .map(([id, r]) => ({ id, text: names.get(id), costPaise: r.costPaise ?? 0 }))
    .filter((r) => r.text && r.costPaise > 0)
    .sort((a, b) => b.costPaise - a.costPaise);
  const total = rows.reduce((sum, r) => sum + r.costPaise, 0);
  const share = (paise) => (total > 0 ? paise / total : 0);
  const withShare = (r) => ({ ...r, share: share(r.costPaise) });
  const rest = rows.slice(SPEND_NAMED);
  return {
    week,
    kind: outlook.constraint,
    lostToBudget: outlook.lostToBudget,
    lostToRank: outlook.lostToRank,
    impressionShare: outlook.impressionShare,
    spend: rows.map(withShare),
    named: rows.slice(0, SPEND_NAMED).map(withShare),
    others: rest.length > 0
      ? { count: rest.length, share: share(rest.reduce((sum, r) => sum + r.costPaise, 0)) }
      : null,
    levers: LEVERS[outlook.constraint] ?? [],
  };
}
