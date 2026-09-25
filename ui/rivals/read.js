/**
 * What the Studio's Rivals shows, read without a page (design/market/, chosen
 * by the owner 2026-09-15): each rival you meet as a card, and the market's
 * public figures on top.
 *
 * ONLY WHAT A PLAYER MAY SEE (R3). A rival's name, site and ad come from the
 * public view (the Ads Transparency Centre's), the three figures from the
 * player's own Auction Insights, the market's totals from its public context
 * (D8). Nothing here reads a rival's spend, bids, budget or results, and a
 * test hands it those fields to prove none comes out.
 */

import { isMove } from '../chart.js';

/**
 * Every rival in the player's latest Auction Insights, as a card: how often
 * you meet (overlap), how often they are above you when you do, how often you
 * outrank them, how often you met each week so far, their ad, and whether
 * their overlap moved five printed points since last week.
 *
 * @param {object[]} insights - `game.insights`, one entry per played week, keyed by advertiser
 * @param {string} playerId
 * @param {Array<{id: string, name: string, domain: string, ads: object[]}>} advertisers - the public view's
 * @returns {{met: object[], never: object[]}} by how often you meet, most first; `never` met 0% this week
 */
export function rivalCards(insights, playerId, advertisers) {
  const latest = insights?.[insights.length - 1]?.[playerId];
  if (!latest) return { met: [], never: [] };
  const previous = insights[insights.length - 2]?.[playerId];
  const known = new Map((advertisers ?? []).map((a) => [a.id, a]));
  const cards = Object.entries(latest.rivals ?? {})
    .filter(([id]) => id !== playerId)
    .map(([id, row]) => {
      const who = known.get(id);
      const was = previous?.rivals?.[id]?.overlapRate ?? null;
      const ad = who?.ads?.[0];
      return {
        id,
        name: who?.name ?? id,
        domain: who?.domain ?? '',
        ad: ad ? { headlines: [...ad.headlines], descriptions: [...ad.descriptions] } : null,
        overlap: row.overlapRate,
        above: row.positionAboveRate,
        beat: row.outrankingShare,
        weeks: insights.map((entry) => entry?.[playerId]?.rivals?.[id]?.overlapRate ?? null),
        was,
        moved: was !== null && isMove(was, row.overlapRate),
      };
    })
    .sort((a, b) => b.overlap - a.overlap);
  return { met: cards.filter((c) => c.overlap > 0), never: cards.filter((c) => c.overlap === 0) };
}

/**
 * The market's public figures this week, beside last week's: the whole
 * market's spend, the median click, how many advertisers ran, and the searches
 * a week, which the query set fixes (Keyword Planner's figure).
 *
 * @param {object[]} contexts - `state.marketContext`, one per played week
 * @param {number} weeklySearches - the public view's `weeklyVolume`
 * @returns {object|null} null before a week is played; the last-week figures null in week 1
 */
export function marketFigures(contexts, weeklySearches) {
  const now = contexts?.[contexts.length - 1];
  if (!now) return null;
  const before = contexts[contexts.length - 2] ?? null;
  return {
    spendPaise: now.totalMarketSpendPaise,
    lastSpendPaise: before?.totalMarketSpendPaise ?? null,
    medianCpcPaise: now.medianCpcPaise,
    lastMedianCpcPaise: before?.medianCpcPaise ?? null,
    advertisers: now.activeAdvertisers,
    lastAdvertisers: before?.activeAdvertisers ?? null,
    weeklySearches,
  };
}
