/**
 * What the returns card shows, read without a page: the classic look's What
 * came back and the Studio's Returns (design/returns/, chosen by the owner
 * 2026-09-15) read the same weeks, so the two cannot disagree about them.
 *
 * THE ACCOUNT'S OWN WEEKS ONLY. It reads the player's rows of the history and
 * nobody else's, as the card always has (I31).
 *
 * WHEN A WEEK SETTLES is the caller's to say (`SETTLES_AFTER_ROUNDS`, in
 * ui/dashboard.js): it is the attribution lag plus a week, and that constant
 * is quoted by one interface file only (tests/ui.test.js).
 */

import { RTO_FREIGHT_PAISE, LOCATION_TIERS } from '../../engine/constants.js';

const sum = (rows, fn) => rows.reduce((a, r) => a + fn(r), 0);
/** The two capital targets that reach returns, and the half each reaches (I28, I29). */
const REACHES = Object.freeze({ orderConfirmation: 'refused', sizeGuide: 'sentBack' });
/** A rate that moved less than this prints the same, to one decimal of a percent. */
const HELD = 0.0005;

/**
 * Whether capital, one of the levers on returns, is open this round, shut
 * until a later window, or closed for the game.
 *
 * Found drawing the Studio's Returns: the card said capital "opens only before
 * week 1 and before week 5" in every week it drew, and it draws only once a
 * week has settled, week 6 at the soonest, when both windows had passed.
 *
 * @param {number[]} [allocationRounds] - `budgetSchedule.capexAllocationRounds`
 * @param {number} round - the round about to be played
 * @returns {{state: 'open'|'later'|'closed', later: number[]}} and the windows still to come
 */
export function capitalWindow(allocationRounds, round) {
  const rounds = allocationRounds ?? [];
  if (rounds.includes(round)) return { state: 'open', later: [] };
  const later = rounds.filter((r) => r > round);
  return { state: later.length > 0 ? 'later' : 'closed', later };
}

/**
 * Every week's returns, the counted totals, and what one refusal costs this
 * account.
 *
 * A click in round R is final at R + 5: three rounds for the order, two for its
 * return window. So recent weeks always understate what will come back, and
 * only settled weeks are counted. Freight is every week's, paid as each refused
 * parcel comes back.
 *
 * What one refusal costs is the account's own figures, not a constant: the
 * freight, and the margin on an order, recovered from the gross figures, which
 * carry no freight (I28, build 2).
 *
 * @param {object[]} history - the game's reports, revised
 * @param {string} playerId
 * @param {number} settlesAfter - rounds before a week is final (`SETTLES_AFTER_ROUNDS`)
 * @returns {{latest: number, weeks: object[], settled: object[], orders: number, refused: number,
 *   sentBack: number, freightPaise: number, codShare: number|null, marginPaise: number,
 *   perRefusalPaise: number, countedFrom: number|null, countedTo: number}}
 */
export function returnsReading(history, playerId, settlesAfter) {
  const rows = history ?? [];
  const latest = rows.length > 0 ? rows[rows.length - 1].round : 0;
  const weeks = rows.map((h) => {
    const row = h.byAdvertiser[playerId];
    const c = row?.conversions ?? {};
    return {
      round: h.round,
      conversions: c.final ?? 0,
      refused: c.refused ?? 0,
      sentBack: c.sentBack ?? 0,
      freightPaise: row?.money?.rtoFreightPaise ?? 0,
      grossRevenuePaise: row?.money?.grossRevenuePaise ?? 0,
      grossProfitPaise: row?.money?.grossProfitPaise ?? 0,
      costPaise: row?.traffic?.costPaise ?? 0,
      settled: latest - h.round >= settlesAfter,
    };
  });
  const settled = weeks.filter((w) => w.settled);
  const orders = sum(settled, (w) => w.conversions);

  // Paid at the door, of the same orders the refusals are counted from. Each
  // week carries the share it was sold at (I34), so read over every week played
  // a discount started this week would show at once, beside refusals that cannot
  // move until its weeks settle.
  const counted = new Set(settled.map((w) => w.round));
  let codOrders = 0;
  let codWeighted = 0;
  for (const h of rows) {
    if (!counted.has(h.round)) continue;
    for (const place of Object.values(h.byAdvertiser[playerId]?.breakdown?.byLocation ?? {})) {
      if (place.codShare == null) continue;
      codOrders += place.conversions ?? 0;
      codWeighted += (place.conversions ?? 0) * place.codShare;
    }
  }

  const grossRevenuePaise = sum(settled, (w) => w.grossRevenuePaise);
  const marginPct = grossRevenuePaise > 0
    ? (sum(settled, (w) => w.grossProfitPaise) + sum(settled, (w) => w.costPaise)) / grossRevenuePaise
    : 0;
  const aovPaise = orders > 0 ? grossRevenuePaise / orders : 0;
  const marginPaise = aovPaise * marginPct;
  return {
    latest,
    weeks,
    settled,
    orders,
    refused: sum(settled, (w) => w.refused),
    sentBack: sum(settled, (w) => w.sentBack),
    freightPaise: sum(weeks, (w) => w.freightPaise),
    codShare: codOrders > 0 ? codWeighted / codOrders : null,
    marginPaise,
    perRefusalPaise: marginPaise + RTO_FREIGHT_PAISE,
    countedFrom: settled[0]?.round ?? null,
    countedTo: latest - settlesAfter,
  };
}

/**
 * The weeks order confirmation and the size guide went live, from the
 * account's own capital: every tranche keeps the round it goes live
 * (game.js, applyCapex), so the week an investment lands can be drawn as the
 * step it makes (I31: "the round an investment lands is a step rather than a
 * smudge").
 *
 * @param {{pending?: Array<{target: string, liveAtRound: number}>}} [capexBlock]
 * @returns {Array<{target: string, week: number}>} by week, one per target and week
 */
export function liveMarks(capexBlock) {
  const marks = [];
  for (const { target, liveAtRound } of capexBlock?.pending ?? []) {
    if (!(target in REACHES)) continue;
    if (!marks.some((m) => m.target === target && m.week === liveAtRound)) marks.push({ target, week: liveAtRound });
  }
  return marks.sort((a, b) => a.week - b.week);
}

/**
 * What an investment did to the half it reaches, once there are settled weeks
 * on both sides of the week it went live: the rate before and from then, and
 * the other half over the same weeks, which it cannot reach. The other half is
 * read rather than assumed to have held: the mix of places can move it.
 *
 * @param {ReturnType<typeof returnsReading>} reading
 * @param {ReturnType<typeof liveMarks>} marks
 * @returns {{target: string, week: number, half: 'refused'|'sentBack', before: number,
 *   after: number, direction: 'fell'|'rose'|'held', otherBefore: number, otherAfter: number,
 *   beforeFrom: number, beforeTo: number}|null}
 */
export function stepReading(reading, marks) {
  const rate = (weeks, key) => {
    const orders = sum(weeks, (w) => w.conversions);
    return orders > 0 ? sum(weeks, (w) => w[key]) / orders : 0;
  };
  for (const { target, week } of marks) {
    const before = reading.settled.filter((w) => w.round < week);
    const after = reading.settled.filter((w) => w.round >= week);
    if (before.length === 0 || after.length === 0) continue;
    const half = REACHES[target];
    const other = half === 'refused' ? 'sentBack' : 'refused';
    const was = rate(before, half);
    const now = rate(after, half);
    let direction = now < was ? 'fell' : 'rose';
    if (Math.abs(now - was) < HELD) direction = 'held';
    return {
      target, week, half, direction,
      before: was,
      after: now,
      otherBefore: rate(before, other),
      otherAfter: rate(after, other),
      beforeFrom: before[0].round,
      beforeTo: before[before.length - 1].round,
    };
  }
  return null;
}

/**
 * Each place's orders and returns over the settled weeks, and how many of its
 * orders are paid at the door: the account's own report rows, by place.
 *
 * @param {object[]} history
 * @param {string} playerId
 * @param {Array<{round: number}>} settled - from `returnsReading`
 * @returns {Array<{orders: number, refused: number, sentBack: number, codShare: number|null}>}
 *   one per `LOCATION_TIERS` entry
 */
export function placeReturns(history, playerId, settled) {
  const counted = new Set(settled.map((w) => w.round));
  const places = LOCATION_TIERS.map(() => ({ orders: 0, refused: 0, sentBack: 0, codOrders: 0, codWeighted: 0 }));
  for (const h of history ?? []) {
    if (!counted.has(h.round)) continue;
    for (const [tier, row] of Object.entries(h.byAdvertiser[playerId]?.breakdown?.byLocation ?? {})) {
      const place = places[tier];
      if (!place) continue;
      place.orders += row.conversions ?? 0;
      place.refused += row.refused ?? 0;
      place.sentBack += row.sentBack ?? 0;
      // Of these same orders (I34): the latest week alone would put a discount
      // started this week beside refusals from weeks sold without it.
      if (row.codShare != null) {
        place.codOrders += row.conversions ?? 0;
        place.codWeighted += (row.conversions ?? 0) * row.codShare;
      }
    }
  }
  return places.map(({ codOrders, codWeighted, ...place }) => ({
    ...place,
    codShare: codOrders > 0 ? codWeighted / codOrders : null,
  }));
}

/**
 * What each rung of the discount saves a week against what it costs.
 *
 * A refusal it prevents keeps the sale and the freight (I34: prevented
 * refusals leave the account instead of reappearing), so it saves what one
 * refusal costs; it costs the discount on every prepaid order. Both at the
 * orders the counted weeks averaged, so this is a forecast, as the rates are.
 *
 * @param {Array<{paise: number, refusal: number, prepaidShare: number}>} rungs - from
 *   `prepaidRungs` in ui/decisions.js; the first is none
 * @param {{ordersPerWeek: number, perRefusalPaise: number}} at
 * @returns {Array<object>} each rung with `fewer`, `avoidedPerWeek`, `savedPerWeekPaise`,
 *   `costPerWeekPaise` and `prepaidOrdersPerWeek`
 */
export function discountTrade(rungs, { ordersPerWeek, perRefusalPaise }) {
  const none = rungs[0].refusal;
  return rungs.map((rung) => {
    const avoidedPerWeek = (none - rung.refusal) * ordersPerWeek;
    return {
      ...rung,
      fewer: none > 0 ? 1 - rung.refusal / none : 0,
      avoidedPerWeek,
      savedPerWeekPaise: avoidedPerWeek * perRefusalPaise,
      costPerWeekPaise: rung.paise * rung.prepaidShare * ordersPerWeek,
      prepaidOrdersPerWeek: rung.prepaidShare * ordersPerWeek,
    };
  });
}
