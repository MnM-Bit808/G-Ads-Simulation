/**
 * What the week's playout shows, read without a page
 * (plans/2026-09-27-week-playout.md): seven steps, and every figure their
 * sentences quote.
 *
 * IT HOLDS NO DOM, like every other `read.js` in the Studio, so the whole
 * sequence can be driven hard by a test on a suite with no browser in it.
 *
 * NOT ONE FIGURE IS INVENTED HERE. Every number below is read off the week's
 * own `AdvertiserRoundReport` and the round's own insights — the report the
 * dashboard is about to draw. Nothing is reconstructed, averaged or spread:
 * a clock was the first shape considered and was rejected because the round
 * keeps clicks and conversions by hour of day only, and throws the day away
 * (see the design, section 3).
 */

import { rupees, whole, pct } from '../dom.js';

/**
 * How many weeks play automatically before it becomes something you ask for.
 *
 * TWO, the owner's call, 2026-09-27. Fifteen seconds twelve times is ninety
 * seconds, and ninety seconds is exactly where the one recorded stranger's
 * attention ran out. A UI timing, so it lives here rather than in
 * `engine/constants.js` — it changes nothing the engine computes, as
 * `HOLD_MS` in `ui/week/render.js` does not.
 */
export const AUTOMATIC_WEEKS = 2;

/** How long each step holds before the next one arrives. */
export const STEP_MS = 2000;

/**
 * The seven steps, in order.
 *
 * `needs` decides whether a step has anything to say this week. A step with
 * nothing to say is dropped rather than drawn empty — a week where nothing was
 * missed should not be told it missed nothing in a step of its own.
 */
export const STEPS = Object.freeze([
  { key: 'pool', needs: (f) => f.eligibleRaw > 0 },
  { key: 'shown', needs: (f) => f.impressionsRaw > 0 },
  { key: 'missed', needs: (f) => f.lostBudgetRaw + f.lostRankRaw > 0.005 },
  { key: 'ladder', needs: (f) => f.impressionsRaw > 0 },
  { key: 'clicks', needs: (f) => f.clicksRaw > 0 },
  { key: 'bought', needs: (f) => f.boughtRaw >= 0.5 },
  { key: 'pending', needs: () => true },
].map(Object.freeze));

/**
 * Every figure the playout's sentences quote.
 *
 * The `…Raw` numbers are kept beside the formatted ones because `needs` above
 * has to compare them, and a test has to be able to. Nothing on screen reads a
 * raw figure.
 *
 * @param {object} row - the player's `AdvertiserRoundReport` for the week
 * @param {object} rivals - `insights[playerId].rivals`, keyed by advertiser id
 * @param {Object<string, string>} names - advertiser id to brand name
 * @returns {Readonly<object>} keyed as `ui/words/playout.js` names them
 */
export function figuresFor(row, rivals = {}, names = {}) {
  const met = metRivals(rivals, names);
  const first = met[0] ?? null;
  return Object.freeze({
    eligible: whole(row.traffic.eligibleAuctions),
    eligibleRaw: row.traffic.eligibleAuctions,
    impressions: whole(row.traffic.impressions),
    impressionsRaw: row.traffic.impressions,
    shown: pct(row.share.impressionShare),
    lostBudget: pct(row.share.lostToBudget),
    lostBudgetRaw: row.share.lostToBudget,
    lostRank: pct(row.share.lostToRank),
    lostRankRaw: row.share.lostToRank,
    // One row a slot, as the first run's ladder does it: the place is a figure
    // the drawing reads, never a word anyone typed. `share` is of the account's
    // own impressions, so the four bars are a whole.
    places: row.positions.counts.map((n, i) => Object.freeze({
      place: i + 1,
      count: whole(n),
      share: row.traffic.impressions > 0 ? n / row.traffic.impressions : 0,
    })),
    placesRaw: [...row.positions.counts],
    clicks: whole(row.traffic.clicks),
    clicksRaw: row.traffic.clicks,
    cost: rupees(row.traffic.costPaise),
    bought: whole(row.conversions.asFirstReported),
    boughtRaw: row.conversions.asFirstReported,
    pending: whole(row.conversions.stillPending),
    pendingRaw: row.conversions.stillPending,
    met: String(met.length),
    metRaw: met.length,
    rivals: String(Object.keys(rivals).length),
    rival: first?.name ?? '',
    aboveRate: first ? pct(first.aboveShare) : '',
    aboveRateRaw: first?.aboveShare ?? 0,
    // True when nobody the account met was ever above it — a different
    // sentence, not the same one reading zero.
    cleared: met.length > 0 && met.every((r) => r.aboveShare === 0),
    // WHETHER ANYTHING IS STILL OUTSTANDING. In expected mode a sale is a
    // fraction, so this is almost never a whole zero and "Another 0 are still
    // deciding" is what a naive `> 0` prints. It is also why the playout must
    // be handed the report the round JUST produced: `reviseReports` drains
    // this queue over the following weeks, so a revised copy of the same week
    // reads a smaller number and eventually none.
    settled: row.conversions.stillPending < 0.5,
    // Whether the budget, rather than the bidding, is what kept it out. The
    // note that says so must not appear on a week where rank was the problem.
    budgetLed: row.share.lostToBudget > row.share.lostToRank,
    metList: met,
  });
}

/**
 * The rivals this account actually ran against, most-met first.
 *
 * ONLY RIVALS WITH A REAL OVERLAP. `positionAboveRate` is "of the auctions we
 * both appeared in, how often they were above me" (`engine/insights.js`), and
 * it reads 0 both when a rival was never above you AND when you never met it
 * at all — `both > 0 ? above / both : 0` has no denominator to divide by. So a
 * rival that never entered the same auction would be reported as one you beat
 * every time. They are filtered out here, once, rather than in a sentence.
 *
 * `aboveShare` is the share of THIS ACCOUNT'S OWN IMPRESSIONS that had the
 * rival above it, and it is exact rather than an estimate: `overlapRate` is
 * `both / aShown` and `positionAboveRate` is `above / both`, so their product
 * is `above / aShown` with the `both` cancelling. It is the figure worth
 * naming a rival by — the most-MET rival is often one you comfortably beat
 * (week 1 of the measured game met Auren in 66% of its impressions and was
 * behind it in 7 of them), while the rival actually costing you position may
 * be met half as often.
 *
 * @param {object} rivals - `insights[playerId].rivals`
 * @param {Object<string, string>} names
 * @returns {Array<{id, name, overlapRate, positionAboveRate, aboveShare}>} met
 *   rivals, the one costing the most position first
 */
export function metRivals(rivals = {}, names = {}) {
  return Object.entries(rivals)
    .filter(([, r]) => r.overlapRate > 0)
    .map(([id, r]) => ({
      id,
      name: names[id] ?? id,
      overlapRate: r.overlapRate,
      positionAboveRate: r.positionAboveRate,
      aboveShare: r.overlapRate * r.positionAboveRate,
    }))
    .sort((a, b) => b.aboveShare - a.aboveShare || b.overlapRate - a.overlapRate);
}

/**
 * The steps this week actually has, in order.
 *
 * @param {object} figures - `figuresFor()`
 * @returns {string[]} step keys
 */
export function stepsFor(figures) {
  return STEPS.filter((step) => step.needs(figures)).map((step) => step.key);
}

/**
 * Where the playout is.
 *
 * @param {number} at - 0-based
 * @param {string[]} steps - `stepsFor()`
 * @returns {{at: number, key: string, total: number, isLast: boolean}}
 */
export function playoutView(at, steps) {
  const clamped = Math.max(0, Math.min(at, steps.length - 1));
  return Object.freeze({
    at: clamped,
    key: steps[clamped],
    total: steps.length,
    isLast: clamped === steps.length - 1,
  });
}

/**
 * Whether this week plays on its own.
 *
 * @param {number} week - 1-based
 * @param {boolean} skipped - whether the player has ever skipped one
 * @returns {boolean}
 */
export function playsAutomatically(week, skipped) {
  return !skipped && week <= AUTOMATIC_WEEKS;
}
