/**
 * What the Studio's Where and when shows, read without a page
 * (design/where-when/, chosen by the owner 2026-09-15): the hours as blocks of
 * the day drawn to scale, and the three kinds of place as rows with a bar each
 * beside the India map.
 *
 * THE FIGURES ARE TODAY'S CARDS': `daypartRows` for the hours and
 * `locationRows` for the places, both summed over every week played, so the
 * two looks cannot disagree. Changes go through the form's own setters, so the
 * tray words them as it always has.
 *
 * A BAR STOPS WHERE A BID STOPS. Every bid is clamped at MAX_BID_MULTIPLE x its
 * keyword bid, once, over the hour's and the place's adjustment together (G4),
 * so a bar that went further would promise more than the auction can give.
 */

import { MAX_BID_MULTIPLE, MAX_CLICKS_AGGRESSION } from '../../engine/constants.js';
import {
  daypartRows, locationRows, locationOutlook, setDaypart, setLocation, hourAdjustmentStacks,
} from '../decisions.js';

/** A drag or an arrow key moves a bar in whole steps of this many percent. */
export const STEP = 5;
/** −100% bids the minimum, under the reserve: in practice, off. */
export const OFF = -100;

/** How far above even a keyword's bid can be taken before it hits the cap. */
const CAP = Math.round((MAX_BID_MULTIPLE - 1) * 100);

/**
 * The highest hour setting that still changes a bid under `strategy`.
 *
 * Manual bids the keyword bid, so the top is the cap. Maximise clicks already
 * bids MAX_CLICKS_AGGRESSION times it, so less is left. The three strategies
 * that set their own bid each hour reach the cap at a different setting every
 * hour; they keep manual's top, and the section says the top varies.
 *
 * @param {string} strategy
 * @returns {number} a whole percentage, a multiple of STEP
 */
export function hourTop(strategy) {
  if (strategy === 'maxClicks') {
    return Math.floor(((MAX_BID_MULTIPLE / MAX_CLICKS_AGGRESSION - 1) * 100) / STEP) * STEP;
  }
  return CAP;
}

/** A place's bar goes as far as the cap: one cap covers both adjustments (G4). */
export const PLACE_TOP = CAP;

/**
 * Strategies whose own bid changes hour by hour, so the top of an hour's bar
 * varies — and, for the same reason, the strategies an hour adjustment counts
 * twice under (DECISIONS D11). One fact, asked of the engine rather than listed
 * here: a second list of strategy names is a list that can quietly fall behind
 * `engine/strategies.js`, which is how this project has been bitten before.
 */
const leansByHour = (strategy) => hourAdjustmentStacks(strategy);

/**
 * A setting a drag or a key produced, made one the form accepts.
 *
 * @param {number} percent
 * @param {number} top - from `hourTop` or PLACE_TOP
 * @returns {number} a whole multiple of STEP from OFF to `top`
 */
export function settle(percent, top) {
  return Math.max(OFF, Math.min(top, Math.round(percent / STEP) * STEP));
}

/** Where a saved setting sits on its bar, and whether it was saved past the top. */
const onBar = (percent, top) => ({ percent, shown: Math.max(OFF, Math.min(top, percent)), above: percent > top });

/**
 * @param {object} draft - the weekly draft (ui/decisions.js)
 * @returns {{top: number, varies: boolean, hourly: number[], blocks: object[]}}
 *   `hourly` is this account's clicks in each of the 24 hours, over every week played
 */
export function hoursModel(draft) {
  const top = hourTop(draft.strategy);
  const observed = draft.bidding?.observedByHour ?? [];
  return {
    top,
    varies: leansByHour(draft.strategy),
    // D11's "and told": said only while it is true of the strategy in the draft.
    countsTwice: leansByHour(draft.strategy),
    hourly: Array.from({ length: 24 }, (_, hour) => observed[hour]?.clicks ?? 0),
    blocks: daypartRows(draft).map((row) => ({
      index: row.index,
      label: row.label,
      start: row.start,
      end: row.end,
      hours: row.hours,
      clicks: row.clicks,
      conversions: row.conversions,
      rate: row.rate,
      thin: row.thin,
      ...onBar(row.percent, top),
    })),
  };
}

/**
 * @param {object} draft
 * @param {object[]} history - `game.state.history`, the player's own reports
 * @param {string} playerId
 * @returns {{top: number, rows: object[], shares: Record<string, number>|null, outlook: object}}
 *   `shares` is each kind of place's part of this account's clicks, for the
 *   map's pulse; null before any click
 */
export function placesModel(draft, history, playerId) {
  const rows = locationRows(draft, history, playerId);
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  return {
    top: PLACE_TOP,
    rows: rows.map((row) => ({
      id: row.id,
      label: row.label,
      examples: row.examples,
      clicks: row.clicks,
      cpcPaise: row.cpcPaise,
      keptPerClickPaise: row.keptPerClickPaise,
      codShare: row.codShare,
      refusedRate: row.refusedRate,
      sentBackRate: row.sentBackRate,
      ...onBar(row.adjustment, PLACE_TOP),
    })),
    shares: clicks > 0 ? Object.fromEntries(rows.map((row) => [row.id, row.clicks / clicks])) : null,
    outlook: locationOutlook(rows),
  };
}

/** Set an hour block's adjustment through the form. */
export const setHour = (draft, index, percent) => setDaypart(draft, index, percent);

/** Set a kind of place's adjustment through the form. */
export const setPlace = (draft, index, percent) => setLocation(draft, index, percent);
