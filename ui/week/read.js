/**
 * What the Studio's Your week shows, read without a page (design/your-week/,
 * chosen by the owner 2026-09-15): the week's six figures, every week's net
 * profit against where it stood before this week ran, one sentence on what
 * moved, and where the impressions went.
 *
 * THE FIGURES ARE THE ENGINE'S OWN. The six are the week's report, read as
 * today's card reads it. Every week's profit is `state.history`, the copy the
 * engine revises as late conversions land and returns come back (11.4).
 * "Before" is the history the interface kept when the week was run
 * (ui/app.js, ui/save.js), because the engine keeps only the new one.
 *
 * THE WHY IS COUNTED, NOT ASSUMED. A revised week is recomputed at this week's
 * margin (engine/report.js, reviseReports), so a fall is not proof that
 * anything came back. The sentence says conversions landed, or returns came
 * back, only when the counts moved.
 */

/**
 * The week just played, as today's card reads it.
 *
 * @param {object} row - `history[k].byAdvertiser[playerId]`
 * @returns {{spendPaise: number, clicks: number, cpcPaise: number, impressions: number,
 *   conversions: number, pending: number, landedShare: number, netProfitPaise: number,
 *   netRoas: number, grossRoas: number, cpaPaise: number|null}} money in paise;
 *   `landedShare` 0-1 of the week's conversions that have landed
 */
export function weekFigures(row) {
  const t = row.traffic;
  const c = row.conversions;
  const expected = c.final + c.stillPending;
  return {
    spendPaise: t.costPaise,
    clicks: t.clicks,
    cpcPaise: t.clicks > 0 ? t.costPaise / t.clicks : 0,
    impressions: t.impressions,
    conversions: c.final,
    pending: c.stillPending,
    landedShare: expected > 0 ? c.final / expected : 0,
    netProfitPaise: row.money.netProfitPaise,
    netRoas: row.money.netRoas,
    grossRoas: row.money.grossRoas,
    cpaPaise: row.money.cpaPaise,
  };
}

/** A sum of paise as the whole rupees it is shown in (ui/dom.js, rupees). */
const shownPaise = (paise) => Math.round(paise / 100) * 100;

/**
 * Every week played, now and as it stood before this week ran.
 *
 * The change is the difference of the two figures as shown, in whole rupees,
 * so it is what a reader gets by subtracting them: ₹84,894 and ₹89,914 differ
 * by ₹5,020, though the paise behind them differ by ₹5,019.64.
 *
 * @param {object[]} history - `state.history`, oldest first
 * @param {object[]} before - the history as it stood before the latest week ran
 * @param {string} playerId
 * @returns {{round: number, netPaise: number, beforePaise: number|null,
 *   changePaise: number|null, moved: boolean, latest: boolean, landed: number,
 *   returned: number}[]} `changePaise` in whole rupees; `landed` and `returned`
 *   are the conversions and returns that arrived for that week while this one ran
 */
export function weekBars(history, before, playerId) {
  const was = new Map((before ?? []).map((h) => [h.round, h.byAdvertiser[playerId]]));
  return history.map((h, i) => {
    const now = h.byAdvertiser[playerId];
    const then = was.get(h.round) ?? null;
    const latest = i === history.length - 1;
    const beforePaise = latest || !then ? null : then.money.netProfitPaise;
    const changePaise = beforePaise === null ? null
      : shownPaise(now.money.netProfitPaise) - shownPaise(beforePaise);
    return {
      round: h.round,
      netPaise: now.money.netProfitPaise,
      beforePaise,
      changePaise,
      moved: changePaise !== null && changePaise !== 0,
      latest,
      landed: then && !latest ? now.conversions.final - then.conversions.final : 0,
      returned: then && !latest ? (now.conversions.returned ?? 0) - (then.conversions.returned ?? 0) : 0,
    };
  });
}

/** "week 5", "weeks 1 to 4", or "weeks 1, 3 and 4", as figures for the words. */
function weeksOf(rounds) {
  if (rounds.length === 1) return { kind: 'one', week: rounds[0] };
  const run = rounds.every((r, i) => i === 0 || r === rounds[i - 1] + 1);
  if (run) return { kind: 'run', from: rounds[0], to: rounds[rounds.length - 1] };
  return { kind: 'list', list: rounds.slice(0, -1), last: rounds[rounds.length - 1] };
}

/**
 * What running the latest week did to the earlier ones, for one sentence.
 *
 * @param {ReturnType<typeof weekBars>} bars
 * @returns {{week: number, first: boolean,
 *   rose: {weeks: object, paise: number, landed: number}|null,
 *   fell: {weeks: object, paise: number, returned: number}|null}}
 *   `landed` and `returned` are whole counts, for the words' "as"
 */
export function revision(bars) {
  const week = bars.length ? bars[bars.length - 1].round : 0;
  const sum = (list, pick) => list.reduce((total, b) => total + pick(b), 0);
  const up = bars.filter((b) => b.changePaise > 0);
  const down = bars.filter((b) => b.changePaise < 0);
  return {
    week,
    first: bars.length === 1,
    rose: up.length === 0 ? null : {
      weeks: weeksOf(up.map((b) => b.round)),
      paise: sum(up, (b) => b.changePaise),
      landed: Math.round(sum(up, (b) => b.landed)),
    },
    fell: down.length === 0 ? null : {
      weeks: weeksOf(down.map((b) => b.round)),
      paise: -sum(down, (b) => b.changePaise),
      returned: Math.round(sum(down, (b) => b.returned)),
    },
  };
}

/**
 * How far the chart runs: from the deepest loss to the highest week, now or
 * before, so the old bar and the tick fit as well as the new one.
 *
 * @param {ReturnType<typeof weekBars>} bars
 * @returns {{topPaise: number, lowPaise: number}} both 0 or more
 */
export function chartRange(bars) {
  const values = bars.flatMap((b) => [b.netPaise, b.beforePaise ?? 0]);
  return {
    topPaise: Math.max(0, ...values),
    lowPaise: Math.max(0, -Math.min(0, ...values)),
  };
}

/**
 * Where one value's bar sits on the chart, as fractions of its height.
 *
 * @param {number} paise
 * @param {{topPaise: number, lowPaise: number}} range - from `chartRange`
 * @returns {{zero: number, size: number, below: boolean}} the zero line from
 *   the chart's floor, and the bar's length, standing on the line or hanging from it
 */
export function barPlace(paise, { topPaise, lowPaise }) {
  const span = topPaise + lowPaise;
  if (span === 0) return { zero: 0, size: 0, below: false };
  return { zero: lowPaise / span, size: Math.abs(paise) / span, below: paise < 0 };
}

/**
 * Where the impressions went: share alone is misleading (F12), so it never
 * appears without the position mix beside it.
 *
 * @param {object} row - `history[k].byAdvertiser[playerId]`
 * @returns {{shown: number, lostToBudget: number, lostToRank: number, positions: number[]}}
 *   every figure 0-1; `positions` is each position's share of the impressions
 */
export function impressions(row) {
  const counts = row.positions?.counts ?? [];
  const total = counts.reduce((a, b) => a + b, 0);
  return {
    shown: row.share.impressionShare ?? 0,
    lostToBudget: row.share.lostToBudget ?? 0,
    lostToRank: row.share.lostToRank ?? 0,
    positions: counts.map((n) => (total > 0 ? n / total : 0)),
  };
}
