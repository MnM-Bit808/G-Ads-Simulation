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

import {
  AD_RANK_FLOOR, MAX_SLOTS, TOP_SLOTS, MIN_INCREMENT_PAISE, ADVERTISER_COUNT,
} from './constants.js';
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
    // THE WHOLE `LadderRow` SHAPE, DECLARED HERE. The five fields below used to
    // be attached by the two loops that follow, which left the row's real shape
    // spread across three places and readable in none of them. They are
    // initialised to what "did not show" means, so the loops only have to write
    // the cases that differ.
    return {
      id: entrant.id,
      bidPaise: entrant.bidPaise,
      qualitySignal: entrant.qualitySignal,
      adRank: adRank(entrant.bidPaise, entrant.qualitySignal),
      shown: false,
      position: 0,
      aboveOrganic: false,
      beatRank: 0,
      cpcPaise: 0,
    };
  });

  // Descending by ad rank. Ties break on id so the ladder is reproducible from
  // its inputs alone, independent of the order the caller happened to build in.
  rows.sort((a, b) => (b.adRank - a.adRank) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // Slots go in rank order to entrants clearing the floor. A below-floor
  // entrant never takes a slot, even when slots are free.
  let filled = 0;
  for (const r of rows) {
    // No else: a row that takes no slot already carries the not-shown values
    // from where it was built.
    if (r.adRank >= AD_RANK_FLOOR && filled < MAX_SLOTS) {
      filled += 1;
      r.shown = true;
      r.position = filled;
      r.aboveOrganic = filled <= TOP_SLOTS;
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

/**
 * @typedef {object} SliceEntrant
 * @property {string} id
 * @property {number} bidPaise integer paise
 * @property {number} qualitySignal > 0
 * @property {number} participation the share of the slice's searches it enters, (0, 1]
 */

/**
 * @typedef {object} SliceResult
 * Every array is indexed in the entrants' order as given, never the ladder's,
 * and every value is a share of the slice's searches. With n entrants:
 * @property {Float64Array} shown [x] the share x shows in
 * @property {Float64Array} positions [x * MAX_SLOTS + k] the share it shows in slot k + 1
 * @property {Float64Array} cpcPaise [x] its average price per click when it shows:
 *   an average of whole-paise prices, so not itself whole
 * @property {Float64Array} both [x * n + y] the share in which x and y both show
 * @property {Float64Array} above [x * n + y] the share in which both show and y is above x
 * @property {Float64Array} shownNot [x * n + y] the share in which x shows and y
 *   takes part without showing
 */

/**
 * Resolve one slice of searches in which some entrants take part in only a
 * share of them (DECISIONS F17).
 *
 * Pacing throttles an advertiser by letting it into a share of a slice's
 * searches, never by skipping the auction (spec 13.4, H1). In the searches it
 * stays out of, it is not in the ladder: it takes no slot and sets nobody's
 * price. `resolveAuction` ranks everyone it is handed in every search, and the
 * round used to hand it throttled advertisers, so a nearly-spent rival held a
 * slot, and priced the advertiser above it, on searches it was not in.
 *
 * Each advertiser's share is its own pacer's, so who is present in a search is
 * independent from one advertiser to the next. Every combination of who is
 * present is then a ladder of its own, as likely as its members' shares times
 * its absentees' complements. This resolves each with `resolveAuction`'s rules
 * and weighs it. Exact, not sampled.
 *
 * COST: an entrant in every search adds no combinations, so a slice with k
 * throttled entrants resolves 2^k ladders - one when nobody is throttled, 512
 * if all nine are. Ranked once, because an absentee changes nobody else's order.
 *
 * WHY POSITION AND PRICE ARE AVERAGED APART: where an entrant sits depends only
 * on who is present above it, and what it pays only on who is present below
 * it. Those are separate sets of independent advertisers, so its average price
 * is the same whatever slot it lands in, and clicks times average price is its
 * expected cost exactly.
 *
 * @param {SliceEntrant[]} entrants
 * @returns {SliceResult}
 */
export function resolveSlice(entrants) {
  if (!Array.isArray(entrants)) {
    throw new TypeError('entrants must be an array');
  }
  const n = entrants.length;
  const seen = new Set();
  for (const entrant of entrants) {
    if (seen.has(entrant.id)) {
      throw new Error(`duplicate entrant id "${entrant.id}" in one auction`);
    }
    seen.add(entrant.id);
    const p = entrant.participation;
    if (!Number.isFinite(p) || p <= 0 || p > 1) {
      throw new RangeError(`participation must be in (0, 1], got ${String(p)} for "${entrant.id}"`);
    }
  }

  const rows = rankEntrants(entrants);
  // The ranks of the entrants that are sometimes absent. Only they make
  // combinations: one in every search is present in all of them.
  const throttled = [];
  for (let r = 0; r < n; r++) {
    if (entrants[rows[r].index].participation < 1) throttled.push(r);
  }
  if (throttled.length > ADVERTISER_COUNT) {
    throw new RangeError(
      `${throttled.length} throttled entrants in one slice; the game has ${ADVERTISER_COUNT} advertisers`,
    );
  }

  const shown = new Float64Array(n);
  const positions = new Float64Array(n * MAX_SLOTS);
  const cpcPaise = new Float64Array(n);
  const both = new Float64Array(n * n);
  const above = new Float64Array(n * n);
  const shownNot = new Float64Array(n * n);

  // One ladder's worth, by rank, reused across the combinations.
  const present = new Uint8Array(n).fill(1);
  const position = new Int32Array(n);
  const cpc = new Float64Array(n);
  const shownRanks = new Int32Array(MAX_SLOTS);
  const unshownRanks = new Int32Array(n);

  const combinations = 2 ** throttled.length;
  for (let mask = 0; mask < combinations; mask++) {
    // Bit j says whether the j-th throttled entrant is present.
    let weight = 1;
    for (let j = 0; j < throttled.length; j++) {
      const r = throttled[j];
      const p = entrants[rows[r].index].participation;
      present[r] = (mask >> j) & 1;
      weight *= present[r] ? p : 1 - p;
    }
    if (weight === 0) continue;
    settleLadder(rows, present, position, cpc);

    let nShown = 0;
    let nUnshown = 0;
    for (let r = 0; r < n; r++) {
      if (!present[r]) continue;
      const x = rows[r].index;
      if (position[r]) {
        shownRanks[nShown] = r;
        nShown += 1;
        shown[x] += weight;
        positions[x * MAX_SLOTS + position[r] - 1] += weight;
        cpcPaise[x] += weight * cpc[r];
      } else {
        unshownRanks[nUnshown] = r;
        nUnshown += 1;
      }
    }
    // Pairs are only ever made with somebody shown, and at most MAX_SLOTS are.
    for (let s = 0; s < nShown; s++) {
      const r = shownRanks[s];
      const x = rows[r].index;
      for (let t = 0; t < nShown; t++) {
        if (t === s) continue;
        const y = rows[shownRanks[t]].index;
        both[x * n + y] += weight;
        if (position[shownRanks[t]] < position[r]) above[x * n + y] += weight;
      }
      for (let t = 0; t < nUnshown; t++) {
        shownNot[x * n + rows[unshownRanks[t]].index] += weight;
      }
    }
  }

  // A sum of weighted prices until now; the average, over the searches shown in.
  for (let x = 0; x < n; x++) {
    if (shown[x] > 0) cpcPaise[x] /= shown[x];
  }
  return { shown, positions, cpcPaise, both, above, shownNot };
}

/** Everyone in ladder order, once: descending ad rank, ties on id as resolveAuction breaks them. */
function rankEntrants(entrants) {
  const rows = entrants.map((entrant, index) => ({
    index,
    id: entrant.id,
    bidPaise: entrant.bidPaise,
    qualitySignal: entrant.qualitySignal,
    adRank: adRank(entrant.bidPaise, entrant.qualitySignal),
  }));
  rows.sort((a, b) => (b.adRank - a.adRank) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return rows;
}

/**
 * Slots and prices among the rows present in one search, by resolveAuction's
 * rules: slots in rank order to present rows that clear the floor, and each
 * shown row priced against the next PRESENT row beneath it, shown or not,
 * never below the reserve (B5).
 *
 * resolveSlice's test holds this to resolveAuction on every combination of
 * random auctions, so the two sets of rules cannot drift apart.
 */
function settleLadder(rows, present, position, cpc) {
  let filled = 0;
  for (let r = 0; r < rows.length; r++) {
    if (present[r] && rows[r].adRank >= AD_RANK_FLOOR && filled < MAX_SLOTS) {
      filled += 1;
      position[r] = filled;
    } else {
      position[r] = 0;
    }
  }
  let belowRank = AD_RANK_FLOOR;
  for (let r = rows.length - 1; r >= 0; r--) {
    if (!present[r]) continue;
    const row = rows[r];
    const beatRank = Math.max(belowRank, AD_RANK_FLOOR);
    cpc[r] = position[r]
      ? Math.min(row.bidPaise, Math.ceil(beatRank / row.qualitySignal) + MIN_INCREMENT_PAISE)
      : 0;
    belowRank = row.adRank;
  }
}
