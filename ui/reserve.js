/**
 * What a keyword must bid to show at all (spec 10.2, DECISIONS B5 and I17).
 *
 * `AD_RANK_FLOOR` is a reserve: under it an advertiser enters every auction and
 * shows in none, and the report calls that "lost to rank 100%", which reads as
 * being outbid. This finds the lowest keyword bid that clears the reserve in
 * at least one auction, for the warning the keyword card gives in round 0 and
 * in a played week (ui/kit/card.js).
 *
 * THE BEST HOUR, NOT AN AVERAGE ONE. The auction's signal is the ad's quality
 * times an hourly factor (`CONTEXT_FACTOR_CURVE`, 0.95 at night to 1.05 at
 * 7pm). Until 2026-09-14 round 0 priced the floor without it, so a bid it said
 * could not show at all still cleared the reserve in the evening.
 *
 * Its most favourable search is its own words, the test round 0 has always
 * used; its most favourable hour and place are the ones its bid adjustments
 * and the hour's signal favour most. Manual bidding: the keyword's bid is the
 * bid. Every step is the engine's own function, so this cannot drift from the
 * auction.
 */

import { normalise } from '../engine/matching.js';
import { qualitySignalBase, applyHourAndNoise } from '../engine/quality.js';
import { minimumBidToShowPaise } from '../engine/auction.js';
import { effectiveBidPaise, locationMultiplier } from '../engine/strategies.js';
import { HOURS_PER_DAY } from '../engine/querySet.js';
import { MIN_BID_PAISE, LOCATION_TIERS } from '../engine/constants.js';
import { heuristicTags } from '../agents/keywordTagger.js';

const HOURS = Array.from({ length: HOURS_PER_DAY }, (_, hour) => hour);

/**
 * The figure a warning shows: the lowest whole-rupee bid at or over `paise`.
 * Bids are slid and typed in rupees, and `rupees()` rounds to the nearest, so
 * a floor of ₹6.02 used to read "needs ₹6" to a bid of ₹6 that it refused.
 *
 * @param {number} paise
 * @returns {number} paise, a multiple of 100
 */
export const wholeRupeeBid = (paise) => Math.ceil(paise / 100) * 100;

/** Doublings tried before deciding no bid can show (every hour or place off). */
const MAX_DOUBLINGS = 24;

/**
 * @param {object} args
 * @param {object} args.grade - the three grades the auction runs on, 1-10
 * @param {{text: string, matchType: string, tags?: string[]}} args.keyword
 * @param {{queries: object[]}} args.querySet
 * @param {number[]|null} [args.daypartAdjustments] - percentages, one per hour block
 * @param {number[]|null} [args.locationAdjustments] - percentages, one per place
 * @returns {number|null} integer paise; null when no bid can show, because
 *   every hour or every place is adjusted to nothing
 */
export function lowestBidToShowPaise({
  grade, keyword, querySet, daypartAdjustments = null, locationAdjustments = null,
}) {
  const own = normalise(keyword.text);
  const query = querySet.queries.find((q) => normalise(q.text) === own)
    ?? { text: keyword.text, intent: 'commercial', tags: heuristicTags(keyword.text) };
  const { base } = qualitySignalBase(grade, query, keyword);
  const needAt = HOURS.map((hour) => minimumBidToShowPaise(applyHourAndNoise(base, hour, null, 'expected')));

  // A place adjustment multiplies every hour's bid alike, re-clamped to the
  // minimum bid (round.js), and every place has a share of every search
  // (LOCATION_VOLUME_BY_PRICE), so the place it favours most is the best one.
  const place = Math.max(...LOCATION_TIERS.map((_, tier) => locationMultiplier(locationAdjustments, tier)));
  const shows = (bidPaise) => HOURS.some((hour) => {
    const bid = effectiveBidPaise({
      strategy: 'manual',
      strategyParams: {},
      keyword: { ...keyword, bidPaise },
      business: { aovMeanPaise: 0 },
      bidding: {},
      daypartAdjustments,
      hour,
      rng: null,
    });
    return Math.max(MIN_BID_PAISE, Math.round(bid * place)) >= needAt[hour];
  });

  if (shows(MIN_BID_PAISE)) return MIN_BID_PAISE;
  let high = Math.max(...needAt);
  for (let i = 0; i < MAX_DOUBLINGS && !shows(high); i++) high *= 2;
  if (!shows(high)) return null;
  // Showing only ever gets easier as the bid rises, so halve the gap.
  let low = MIN_BID_PAISE;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (shows(mid)) high = mid;
    else low = mid;
  }
  return high;
}
