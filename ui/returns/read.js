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

import { RTO_FREIGHT_PAISE } from '../../engine/constants.js';

const sum = (rows, fn) => rows.reduce((a, r) => a + fn(r), 0);

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

  // Paid at the door, across where the clicks actually went.
  let codClicks = 0;
  let codWeighted = 0;
  for (const h of rows) {
    for (const place of Object.values(h.byAdvertiser[playerId]?.breakdown?.byLocation ?? {})) {
      if (place.codShare == null) continue;
      codClicks += place.clicks ?? 0;
      codWeighted += (place.clicks ?? 0) * place.codShare;
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
    codShare: codClicks > 0 ? codWeighted / codClicks : null,
    marginPaise,
    perRefusalPaise: marginPaise + RTO_FREIGHT_PAISE,
    countedFrom: settled[0]?.round ?? null,
    countedTo: latest - settlesAfter,
  };
}
