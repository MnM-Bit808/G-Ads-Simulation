/**
 * One auction, resolved (spec 10).
 *
 * Takes every eligible, funded advertiser and returns the FULL ladder: who
 * showed, in what order, at what price, and — just as importantly — who
 * entered and did not appear. Discarding the losers would make Auction
 * Insights (spec 16) impossible to compute and would leave the interface
 * unable to render the row that says a rival bid and never showed, which is
 * one of the things most worth seeing.
 *
 * WHAT THIS MODULE IS CAREFUL ABOUT
 *
 * Second price means you pay what it takes to beat the advertiser beneath you,
 * not what you bid. Two details follow from that and both are easy to get
 * wrong:
 *
 *   - "Beneath you" means the next entrant in the ladder, whether or not they
 *     were shown. With four slots and nine advertisers the entrant in position
 *     five is usually well above the floor; pricing position four against the
 *     floor instead would undercharge it exactly when the field is deep, which
 *     is when it should be expensive.
 *
 *   - The floor is a reserve, not just an eligibility gate. You always pay at
 *     least enough to clear it. Without that, a below-floor rival sitting
 *     beneath you would drag your price under the reserve, so adding a
 *     competitor would LOWER your cost — which is backwards.
 *
 * Neither is stated outright in spec 10.2; both are recorded in DECISIONS B5.
 */

import { AD_RANK_FLOOR, MAX_SLOTS, TOP_SLOTS, MIN_INCREMENT_PAISE } from './constants.js';
import { assertPaise } from './money.js';

/**
 * Ad rank: what orders the auction.
 *
 * Bid times the real-time quality signal — not the reported 1-10 score, which
 * is a diagnostic and never enters the auction (spec 9.1, DECISIONS A1).
 *
 * @param {number} bidPaise integer paise
 * @param {number} qualitySignal roughly a click probability, > 0
 * @returns {number} ad rank, a float
 */
export function adRank(bidPaise, qualitySignal) {
  assertPaise(bidPaise, 'bidPaise');
  if (!Number.isFinite(qualitySignal) || qualitySignal <= 0) {
    throw new RangeError(
      `qualitySignal must be finite and positive, got ${String(qualitySignal)}`,
    );
  }
  return bidPaise * qualitySignal;
}

/**
 * The smallest bid that clears the reserve at this quality (spec 10.2).
 *
 * `AD_RANK_FLOOR` is a reserve, not just an eligibility gate: an advertiser
 * under it enters every auction and shows in none. That state is invisible from
 * the outside — it reports as "lost to rank", which reads as being OUTBID and
 * sends a player to raise keyword bids, when the bid was never the binding
 * thing. DECISIONS A8 measured the same shape on an ungraded ad.
 *
 * Exported so a caller can WARN before a week is spent in it. Nothing in the
 * auction reads this; it exists for the interface, which is not allowed to
 * derive the floor itself.
 *
 * @param {number} qualitySignal roughly a click probability, > 0
 * @returns {number} integer paise, rounded up — one paise less does not clear
 */
export function minimumBidToShowPaise(qualitySignal) {
  if (!Number.isFinite(qualitySignal) || qualitySignal <= 0) {
    throw new RangeError(
      `qualitySignal must be finite and positive, got ${String(qualitySignal)}`,
    );
  }
  return Math.ceil(AD_RANK_FLOOR / qualitySignal);
}

/**
 * @typedef {object} Entrant
 * @property {string} id
 * @property {number} bidPaise integer paise
 * @property {number} qualitySignal > 0
 */

/**
 * @typedef {object} LadderRow
 * @property {string} id
 * @property {number} bidPaise
 * @property {number} qualitySignal
 * @property {number} adRank
 * @property {boolean} shown
 * @property {number} position 1..MAX_SLOTS when shown, 0 when not
 * @property {boolean} aboveOrganic position 1..TOP_SLOTS
 * @property {number} beatRank the ad rank this row had to beat
 * @property {number} cpcPaise integer paise, 0 when not shown
 */

/**
 * Resolve one auction.
 *
 * @param {Entrant[]} entrants eligible, funded advertisers
 * @returns {{ladder: LadderRow[]}} sorted by ad rank, descending
 */
export function resolveAuction(entrants) {
  if (!Array.isArray(entrants)) {
    throw new TypeError('entrants must be an array');
  }

  const seen = new Set();
  const rows = entrants.map((entrant) => {
    if (seen.has(entrant.id)) {
      throw new Error(`duplicate entrant id "${entrant.id}" in one auction`);
    }
    seen.add(entrant.id);
    return {
      id: entrant.id,
      bidPaise: entrant.bidPaise,
      qualitySignal: entrant.qualitySignal,
      adRank: adRank(entrant.bidPaise, entrant.qualitySignal),
    };
  });

  // Descending by ad rank. Ties break on id so the ladder is reproducible from
  // its inputs alone, independent of the order the caller happened to build in.
  rows.sort((a, b) => (b.adRank - a.adRank) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // Slots go in rank order to entrants clearing the floor. A below-floor
  // entrant never takes a slot, even when slots are free.
  let filled = 0;
  for (const r of rows) {
    if (r.adRank >= AD_RANK_FLOOR && filled < MAX_SLOTS) {
      filled += 1;
      r.shown = true;
      r.position = filled;
      r.aboveOrganic = filled <= TOP_SLOTS;
    } else {
      r.shown = false;
      r.position = 0;
      r.aboveOrganic = false;
    }
  }

  for (const [i, r] of rows.entries()) {
    const below = rows[i + 1];
    // The reserve applies whether or not anyone is beneath you: see the note
    // at the top of this file.
    r.beatRank = Math.max(below ? below.adRank : AD_RANK_FLOOR, AD_RANK_FLOOR);
    r.cpcPaise = r.shown
      ? Math.min(r.bidPaise, Math.ceil(r.beatRank / r.qualitySignal) + MIN_INCREMENT_PAISE)
      : 0;
  }

  return { ladder: rows };
}
