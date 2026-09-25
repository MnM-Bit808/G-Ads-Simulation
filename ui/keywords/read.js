/**
 * What Your keywords shows (plans/2026-09-13-studio-makeover.md, section 4).
 * Pure: the draft, the report's own per-keyword rows and the engine's reach
 * count go in, plain objects come out for the kit's card (ui/kit/card.js) to
 * draw. Money stays in paise; nothing here formats. The slider's range is the
 * kit's own (`sliderMaxPaise`), shared with round 0.
 */

import { qualitySummary, updateKeyword } from '../decisions.js';
import { lowestBidToShowPaise, wholeRupeeBid } from '../reserve.js';
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
 * @param {object|null} [args.grades] - `effectiveGrades(draft)`, the grade the
 *   week's auctions run on
 * @param {(keyword: object) => number} args.reach - how many searches it reaches on its match type
 * @param {{queries: object[]}} args.querySet - to find each keyword's own search
 * @returns {object[]}
 */
export function keywordCards({ draft, byKeyword, quality = {}, grades = null, reach, querySet }) {
  // Round 0's warning that a bid cannot clear the reserve (I17), priced with
  // the hour and place adjustments this week will run. Manual bidding only:
  // under a strategy the keyword's bid is not what it bids, and the strategy's
  // own warning (`bidOutlook`) says whether its bid shows.
  /**
   * The reserve for this keyword, WHATEVER THE BID IS — the bid below which the
   * ad enters every auction and shows in none.
   *
   * Split out of `underReserve` on 2026-09-25 so the slider can draw it. The
   * warning only ever needed the number when the bid was already under it; the
   * track needs it always, because the whole point of drawing it is to be seen
   * BEFORE the bid goes there. Null when there is no bid to set: Smart Bidding
   * is not bidding by hand, and a paused keyword is not in the auction.
   */
  /**
   * The raw reserve in paise, or null when there is no bid to set: Smart
   * Bidding is not bidding by hand, and a paused keyword is not in the auction.
   *
   * RAW, AND THE WARNING COMPARES AGAINST IT RAW. `wholeRupeeBid` rounds UP to
   * the rupee a player could actually set, so comparing a bid against the
   * ROUNDED figure warns a bid that in fact clears — ₹16.50 against a floor of
   * ₹16.24 would be told it needs ₹17. A first draft of this split did exactly
   * that, and `tests/keywords.test.js` caught it on the paise.
   */
  const reserveRawPaise = (keyword) => {
    if (draft.strategy !== 'manual' || keyword.active === false) return null;
    return lowestBidToShowPaise({
      grade: grades,
      keyword,
      querySet,
      daypartAdjustments: draft.daypartAdjustments,
      locationAdjustments: draft.locationAdjustments,
    });
  };

  /**
   * The reserve as a bid, WHATEVER THE CURRENT BID IS — what the slider draws
   * on its track. Rounded up, because the track is in whole rupees and the
   * marker means "at or above here shows".
   */
  const reservePaise = (keyword) => {
    const need = reserveRawPaise(keyword);
    return need === null ? null : wholeRupeeBid(need);
  };

  const underReserve = (keyword) => {
    const need = reserveRawPaise(keyword);
    return need !== null && keyword.bidPaise < need ? wholeRupeeBid(need) : null;
  };

  return draft.keywords.map((keyword) => {
    const base = draft.base.keywords.find((k) => k.id === keyword.id) ?? null;
    const row = base ? byKeyword?.[keyword.id] : null;
    const broad = keyword.matchType === 'broad';
    const wasBidPaise = base && base.bidPaise !== keyword.bidPaise ? base.bidPaise : null;
    const wasMatchType = base && base.matchType !== keyword.matchType ? base.matchType : null;
    return {
      id: keyword.id,
      text: keyword.text,
      matchType: keyword.matchType,
      active: keyword.active !== false,
      isNew: base === null,
      // The red outline: this card is a change waiting in the tray.
      changed: base === null || wasBidPaise !== null || wasMatchType !== null,
      bidPaise: keyword.bidPaise,
      wasBidPaise,
      wasMatchType,
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
      needPaise: underReserve(keyword),
      floorPaise: reservePaise(keyword),
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
