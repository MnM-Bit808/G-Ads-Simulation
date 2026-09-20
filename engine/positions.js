/**
 * The positioning grid, and everything derived from it (spec 4, 13.3).
 *
 * Each advertiser occupies one cell of a 3 x 2 grid, chosen at round 0. The
 * two axes do different jobs and must not be allowed to do each other's:
 *
 *   PRICE sets the economics    - what a click can be worth
 *   PURPOSE sets the territory  - which clicks you want
 *
 * Invariant I4 holds that line: the purpose axis may move break-even CPC by
 * under 15% within a price row, while the price axis moves it more than 2x top
 * to bottom. Premium already sits at 11.9%, so the headroom is about three
 * points - if the purpose axis ever needs to be stronger, strengthen the query
 * affinities instead, which change WHICH queries you want without changing
 * what you can pay for them.
 *
 * WHY ECONOMICS ARE DERIVED AND NEVER AUTHORED
 *
 * Nothing here is set per advertiser. Everyone in a cell has identical
 * economics, so a difference in outcome traces back to a decision somebody
 * made rather than to the hand they were dealt. That is the same
 * control-group logic as equal starting budgets, applied one level up -
 * without it, ranking on profit would rank the endowment (DECISIONS F6).
 */

import {
  PRICE_TIERS, PURPOSES, POSITION_ECONOMICS, PURPOSE_MODIFIERS,
  RETURN_RATE_CLAMP_MAX, CAPEX_TIER_CURVE, CAPEX_PHOTOGRAPHY_CURVE, CAPEX_ALLOCATION_PAISE,
  CAPEX_LANDING_PAGE_MAX_POINTS, REPOSITION_ROUND,
  HOUR_PROFILES, HOURLY_INTENT_CURVE, CONV_RATE_CLAMP, LOCATION_TIERS,
} from './constants.js';
import { clamp, lerp } from './num.js';
import { mulRate } from './money.js';
import { homeCell } from './querySet.js';
import { locationEffects, refusalRateFor, rtoShareOfReturns } from './locations.js';

// ---------------------------------------------------------------------------
// The grid
// ---------------------------------------------------------------------------

/**
 * @param {string} price one of PRICE_TIERS
 * @param {string} purpose one of PURPOSES
 * @returns {string} e.g. "premium|lifestyle"
 */
export function cellKey(price, purpose) {
  return `${price}|${purpose}`;
}

/**
 * @param {string} key
 * @returns {{price: string, purpose: string}}
 */
export function parseCell(key) {
  const [price, purpose] = String(key).split('|');
  if (!PRICE_TIERS.includes(price) || !PURPOSES.includes(purpose)) {
    throw new RangeError(`not a grid cell: "${key}"`);
  }
  return { price, purpose };
}

/** Every cell, in a fixed order so iteration is deterministic (R1). */
export function allCells() {
  const cells = [];
  for (const price of PRICE_TIERS) {
    for (const purpose of PURPOSES) cells.push(cellKey(price, purpose));
  }
  return cells;
}

/**
 * @param {{price?: string, purpose?: string}|null} position
 * @returns {boolean}
 */
export function isValidPosition(position) {
  return Boolean(position)
    && PRICE_TIERS.includes(position.price)
    && PURPOSES.includes(position.purpose);
}

function assertPosition(position) {
  if (!isValidPosition(position)) {
    throw new RangeError(`invalid position: ${JSON.stringify(position)}`);
  }
}

// ---------------------------------------------------------------------------
// Economics
// ---------------------------------------------------------------------------

/**
 * The business block for an advertiser, derived from position and whatever
 * capital investment has gone live by this round.
 *
 * Always returns a fresh object. A caller mutating it must not corrupt
 * POSITION_ECONOMICS for every other advertiser in the game.
 *
 * @param {{price: string, purpose: string}} position
 * @param {{committed: object, pending?: object[]}} capex
 * @param {number} round
 * @returns {object} business block
 */
export function businessFor(position, capex, round) {
  assertPosition(position);
  const tier = POSITION_ECONOMICS[position.price];
  const modifier = PURPOSE_MODIFIERS[position.purpose];

  // Photography raises conversion; the size guide lowers returns. Dividing by
  // the effect rather than multiplying keeps "more investment is better" true
  // for a number you want to go down.
  const photography = capexEffect(liveCapexPaise(capex, 'photography', round), 'photography');
  const sizeGuide = capexEffect(liveCapexPaise(capex, 'sizeGuide', round), 'sizeGuide');
  // I29: the fourth target, and the only defence against the freight build 2
  // charges. A WhatsApp or IVR confirmation before dispatch does nothing about
  // a customer who takes delivery and changes their mind — it stops the parcel
  // that would have come back from the door.
  const orderConfirmation = capexEffect(
    liveCapexPaise(capex, 'orderConfirmation', round), 'orderConfirmation',
  );

  return {
    convRateBase: tier.convRateBase * modifier.conv * photography,
    aovMeanPaise: tier.aovMeanPaise,
    aovSpread: tier.aovSpread,
    marginPct: tier.marginPct,
    returnRate: clamp(tier.returnRate * modifier.ret / sizeGuide, 0, RETURN_RATE_CLAMP_MAX),
    // THE TWO HALVES OF THAT DIVISION, kept so a caller that knows the LOCATION
    // can apply the size guide to the part it can actually reach (I28 build 2).
    // A size guide fixes "wrong size"; it does nothing about a parcel refused at
    // the door, and refusals are the half that varies with geography. `round.js`
    // is the only place both this and the location are in scope.
    //
    // `returnRate` above stays exactly as it was so nothing that only wants the
    // headline number has to know any of this.
    returnRateBeforeSizeGuide: clamp(tier.returnRate * modifier.ret, 0, RETURN_RATE_CLAMP_MAX),
    sizeGuideEffect: sizeGuide,
    orderConfirmationEffect: orderConfirmation,
    returnWindowRounds: tier.returnWindowRounds,
  };
}

/**
 * What comes back from one order bought at one place: every return, and the
 * part of it refused at the door.
 *
 * THE ONE PLACE THIS ARITHMETIC LIVES. `round.js` books an order's returns with
 * it and `refusalOutlook` forecasts an account's refusal rate with it, so what
 * the prepaid card says and what the week then does cannot drift apart. Until
 * 2026-09-15 the card had a formula of its own, and it missed order
 * confirmation, purpose and the place gradient (I29, I34).
 *
 * @param {object} args
 * @param {object} args.business from `businessFor`: the return level before the
 *   size guide, and both capital effects
 * @param {number} args.queryReturnMultiplier the search's own multiplier; 1
 *   where the caller may not know it (16.1)
 * @param {number} args.placeReturnMultiplier
 *   `locationEffects(...).returnMultiplier[tierIndex]`
 * @param {string} args.price a `PRICE_TIERS` entry
 * @param {number} args.tierIndex into `LOCATION_TIERS`
 * @param {number} [args.discountPaise] the prepaid discount, 0 for none
 * @returns {{returned: number, refused: number}} per order, with
 *   refused <= returned <= RETURN_RATE_CLAMP_MAX
 */
export function returnHalves({
  business, queryReturnMultiplier, placeReturnMultiplier, price, tierIndex, discountPaise = 0,
}) {
  // The return rate for this query BEFORE the size guide was divided into
  // it, which is what the per-location split below has to start from.
  // `retentionRate` is still the right function for anything that wants
  // the headline figure; this path needs the two halves separately.
  // Clamped twice, as the round always has: once for the search, once for the
  // place.
  // THE PLACE IS NOT IN HERE ANY MORE (2026-09-20, F20). This used to be
  // multiplied by `placeReturnMultiplier` as well, before the split below, so
  // the location gradient landed on BOTH halves and send-backs came out
  // 1.36-1.40x higher in the towns. Nothing supports that —
  // `POST_DELIVERY_RETURN_RATE` is one national figure — and F14 recorded the
  // fault and left it for later. The gradient now goes onto the refused half
  // alone, which is the half a place can plausibly move: what raises RTO
  // outside the metros is payment mix, address quality and courier reach, none
  // of which touch whether a delivered parcel fits.
  const gross = Math.min(
    RETURN_RATE_CLAMP_MAX,
    business.returnRateBeforeSizeGuide * queryReturnMultiplier,
  );

  // I28 BUILD 2: THE SIZE GUIDE ONLY REACHES HALF OF THIS.
  //
  // A refusal at the door and a send-back after delivery are different
  // events, and a size guide fixes only the second — nobody's fit chart
  // stops a customer changing their mind on the doorstep. So the return
  // rate is rebuilt from its two halves here, where the location is
  // known, rather than taken from `business.returnRate`, which has
  // already divided the whole thing by the capex effect.
  //
  // The consequence is a real strategic lever and it falls out of
  // numbers the player can already see: the more of your orders are cash
  // on delivery, the less a size guide is worth to you.
  //
  // EACH TARGET REDUCES ITS OWN HALF AND ONLY ITS OWN HALF (I29).
  // Order confirmation stops the parcel that never got through the door;
  // the size guide fixes the one that was delivered and did not fit.
  // Neither converts into the other — an order that is confirmed rather
  // than refused simply does not come back.
  //
  // I34: THE DISCOUNT REMOVES REFUSALS, IT DOES NOT RELABEL THEM.
  //
  // The first version read one share for both halves, so lowering the
  // refusal share raised the send-back share by exactly as much and the
  // total return rate never moved — the discount bought a change of
  // door, not a kept sale. Measured, that made it strictly dominated:
  // "no discount" won in all six cells because the only saving left was
  // ₹200 of freight against a margin lost either way.
  //
  // It is also wrong about the world. Prepaid RTO runs 5-10% against
  // COD's 25-35%, and a customer who has already paid mostly does not
  // send it back either — the sale survives. So send-backs are computed
  // from the mix BEFORE the discount, and the refusals it prevents leave
  // the account instead of reappearing.
  //
  // AND IT REMOVES THEM AT THE SOURCED RATE (2026-09-15). The second version
  // took refusals as the refused SHARE at the discounted mix times the total
  // before it. That share is worked out against a total in which the newly
  // delivered parcels are sent back at POST_DELIVERY_RETURN_RATE — the
  // relabelling this comment says was removed — so it falls more slowly than
  // the refusal rate, and about a quarter of the refusals the discount should
  // prevent stayed: 100 mid orders in the towns gave 17.9 refusals, ₹30 should
  // leave 16.7, and the round booked 17.0. Measured over 72 accounts, the
  // prepaid card promised 5.8-6.8% fewer and the round delivered 4.5-4.9%. So
  // the refused half falls by exactly the ratio of the two refusal rates, and
  // with no discount that ratio is exactly 1, which keeps every account
  // without one to the paisa.
  // F20: the place gradient multiplies the REFUSED half and nothing else. A
  // send-back rate that is one national figure has no business varying by
  // place, and the small FALL that is left — 0.92x metros to towns, through
  // `refusedShare` alone — is the right direction rather than a leftover: more
  // parcels are refused at the door out there, so fewer are ever delivered, and
  // a parcel that never arrived cannot be sent back.
  const refusedShare = rtoShareOfReturns(price, tierIndex, 0);
  const cut = refusalRateFor(price, tierIndex, discountPaise) / refusalRateFor(price, tierIndex, 0);
  const refused = (gross * refusedShare * placeReturnMultiplier * cut)
    / business.orderConfirmationEffect;
  const sentBack = (gross * (1 - refusedShare)) / business.sizeGuideEffect;
  const returned = Math.min(RETURN_RATE_CLAMP_MAX, refused + sentBack);
  return { returned, refused: Math.min(returned, refused) };
}

/**
 * The refusal rate an account will run at next week, per order, at its own
 * places — the figure the prepaid card shows (I34).
 *
 * `returnHalves` at each place, weighted by where the account buys, so it
 * carries everything the round will apply: the price tier's cash mix, purpose's
 * return level, the place gradient, order confirmation once it is live, and the
 * discount.
 *
 * ONE THING IT LEAVES OUT, BY RULE: each search's own return multiplier, which
 * every view withholds (16.1). So it is exact for an account whose searches sit
 * at 1 and close otherwise — measured 2026-09-15 over 72 played accounts at
 * 0.91x to 1.02x of what the round booked, where the card's old cash-mix formula
 * was up to 4.3 points high once order confirmation was live.
 *
 * @param {object} args
 * @param {{price: string, purpose: string}} args.position
 * @param {{committed: object, pending?: object[]}} args.capex the account's own
 *   capital block, pending tranches included, so money still being built is not
 *   counted
 * @param {number} args.round the round about to be played
 * @param {number} [args.discountPaise] 0 for none
 * @param {number[]} args.placeWeights one per `LOCATION_TIERS` entry, any scale:
 *   the account's clicks by place, say
 * @returns {number} refusals per order, 0..1
 * @throws {RangeError} when the weights are the wrong length or hold nothing —
 *   which place an account with no clicks should be shown is the caller's call
 */
export function refusalOutlook({ position, capex, round, discountPaise = 0, placeWeights }) {
  const total = (placeWeights ?? []).reduce((a, w) => a + w, 0);
  if (placeWeights?.length !== LOCATION_TIERS.length || !(total > 0)) {
    throw new RangeError(`placeWeights must be ${LOCATION_TIERS.length} weights with something in them`);
  }
  const business = businessFor(position, capex, round);
  // Normalised to the price tier's own country, as the round's are. With a
  // price named, `locationEffects` does not read the query set.
  const places = locationEffects(null, position.price).returnMultiplier;
  let refused = 0;
  for (let t = 0; t < placeWeights.length; t++) {
    if (placeWeights[t] <= 0) continue;
    refused += placeWeights[t] * returnHalves({
      business, queryReturnMultiplier: 1, placeReturnMultiplier: places[t],
      price: position.price, tierIndex: t, discountPaise,
    }).refused;
  }
  return refused / total;
}

/**
 * Margin on one order that survives the return window.
 *
 * @param {object} business
 * @returns {number} integer paise
 */
export function marginPerOrderPaise(business) {
  return mulRate(business.aovMeanPaise, business.marginPct * (1 - business.returnRate));
}

/**
 * The most you can pay for a click and still break even, net of returns.
 *
 * One rounding at the end rather than one per step: chaining three separate
 * roundings would drift by a paisa or two for no reason.
 *
 * @param {object} business
 * @returns {number} integer paise
 */
export function breakEvenCpcPaise(business) {
  return mulRate(
    business.aovMeanPaise,
    business.marginPct * (1 - business.returnRate) * business.convRateBase,
  );
}

/**
 * What you believe you can pay if you never net out returns.
 *
 * This is the section 14 trap: a default Google Ads setup optimises to gross
 * conversions, so an advertiser managing to this number overpays by the return
 * rate - and the gap is widest at the cheap end, where the margin is thinnest
 * and the returns are highest.
 *
 * @param {object} business
 * @returns {number} integer paise
 */
export function grossBreakEvenCpcPaise(business) {
  return mulRate(business.aovMeanPaise, business.marginPct * business.convRateBase);
}

/**
 * The queries a position is actually trying to buy.
 *
 * A query belongs to the cell where its combined affinity peaks, and only
 * commercial queries belong anywhere - informational and irrelevant traffic is
 * waste rather than territory, and brand traffic belongs to a trademark owner
 * (DECISIONS E7).
 *
 * @param {object} querySet
 * @param {{price: string, purpose: string}} position
 * @returns {object[]} the queries in this position's territory
 */
export function territoryQueries(querySet, position) {
  assertPosition(position);
  const cell = cellKey(position.price, position.purpose);
  return querySet.queries.filter((q) => homeCell(q) === cell);
}

/**
 * The conversion rate a position ACTUALLY sees on its own territory.
 *
 * WHY THIS EXISTS AND WHY breakEvenCpcPaise IS NOT ENOUGH
 *
 * `business.convRateBase` is the rate on a NEUTRAL query - every query
 * multiplier at 1, every hour equally likely. No advertiser ever buys that
 * query. What it buys is its own territory, and by construction that is the
 * set of queries where BOTH of its affinities peak, so the affinity product
 * runs around 2.0. The intent curve compounds it: it is normalised to a mean
 * of 1 across 24 uniform hours, but clicks arrive weighted by demand, and
 * demand sits where intent is high, so its traffic-weighted mean is 1.146.
 *
 * The result is that a position's real ceiling is roughly 2.2 to 2.5 times the
 * 4.4 table. Quoting the table as the operative number - which invariant I2,
 * the round 0 briefing and the test fixtures all did - understates what every
 * position can pay by more than half.
 *
 * WEIGHTED BY SEARCH VOLUME, NOT BY CLICKS. Clicks depend on position, which
 * depends on bid, which is the thing this figure exists to inform. Volume
 * weighting is both non-circular and the number a competent advertiser could
 * work out from Keyword Planner before spending anything.
 *
 * @param {object} business from businessFor
 * @param {object} querySet
 * @param {{price: string, purpose: string}} position
 * @returns {number} a conversion rate
 */
export function realisedConvRate(business, querySet, position) {
  let weight = 0;
  let total = 0;
  for (const query of territoryQueries(querySet, position)) {
    const profile = HOUR_PROFILES[query.hourProfile];
    for (let hour = 0; hour < profile.length; hour++) {
      const w = query.volumeShareBp * profile[hour];
      weight += w;
      total += w * clamp(
        business.convRateBase
          * query.convMultiplier
          * query.priceAffinity[position.price]
          * query.purposeAffinity[position.purpose]
          * HOURLY_INTENT_CURVE[hour],
        ...CONV_RATE_CLAMP,
      );
    }
  }
  return weight > 0 ? total / weight : business.convRateBase;
}

/**
 * The most a position can pay for a click ON ITS OWN TERRITORY and break even.
 *
 * This is the operative ceiling - the number 4.4 calls "the number the whole
 * simulation has to clear" - and it is what I2, the briefing and the fixtures
 * should quote. `breakEvenCpcPaise` remains the figure for a neutral query and
 * is what invariant I4 holds to its lane.
 *
 * Basket size and return rate are per query too, so both are folded in here
 * rather than taken from the business block alone.
 *
 * @param {object} business from businessFor
 * @param {object} querySet
 * @param {{price: string, purpose: string}} position
 * @returns {number} integer paise
 */
export function realisedBreakEvenCpcPaise(business, querySet, position) {
  let weight = 0;
  let total = 0;
  for (const query of territoryQueries(querySet, position)) {
    const profile = HOUR_PROFILES[query.hourProfile];
    const retention = 1 - clamp(
      business.returnRate * query.returnRateMultiplier, 0, RETURN_RATE_CLAMP_MAX,
    );
    const perOrder = business.aovMeanPaise * query.valueMultiplier * business.marginPct * retention;
    for (let hour = 0; hour < profile.length; hour++) {
      const w = query.volumeShareBp * profile[hour];
      weight += w;
      total += w * perOrder * clamp(
        business.convRateBase
          * query.convMultiplier
          * query.priceAffinity[position.price]
          * query.purposeAffinity[position.purpose]
          * HOURLY_INTENT_CURVE[hour],
        ...CONV_RATE_CLAMP,
      );
    }
  }
  return weight > 0 ? Math.round(total / weight) : breakEvenCpcPaise(business);
}

// ---------------------------------------------------------------------------
// Capital expenditure
// ---------------------------------------------------------------------------

/**
 * The ladder a given target climbs (I30). Everything but photography shares one.
 *
 * Lives here rather than in `constants.js` because that file holds constants,
 * and because a function there put `CAPEX_PHOTOGRAPHY_CURVE` out of reach of the
 * guard that checks every constant is read by something outside its own file.
 *
 * @param {string|null} target one of `CAPEX_TARGETS`, or null for the shared one
 * @returns {Array<{paise: number, effect: number}>}
 */
export function capexCurveFor(target) {
  return target === 'photography' ? CAPEX_PHOTOGRAPHY_CURVE : CAPEX_TIER_CURVE;
}

/**
 * Read the S-curve at a commitment, interpolating between authored points and
 * flat outside them.
 *
 * The S shape is the mechanic, not decoration. With diminishing returns the
 * first tranche on a fresh target would always be the cheapest gain, splitting
 * three ways would be strictly optimal, and the amount choice would collapse
 * into a solved puzzle. It is also the more honest shape: a quarter of the
 * budget buys a half-built fit tool that helps nobody (DECISIONS D7).
 *
 * WHICH LADDER depends on the target (I30). Photography climbs a longer,
 * shallower one, because on the shared curve it was worth five and a half times
 * the next best target in every cell and there was no choice left to make.
 * Omitting `target` reads the shared curve, which is what the other three use.
 *
 * @param {number} paise cumulative commitment to one target
 * @param {string} [target] one of `CAPEX_TARGETS`
 * @returns {number} effect multiplier, >= 1
 */
export function capexEffect(paise, target = null) {
  const curve = capexCurveFor(target);
  if (paise <= curve[0].paise) return curve[0].effect;
  const last = curve[curve.length - 1];
  if (paise >= last.paise) return last.effect;

  for (let i = 1; i < curve.length; i++) {
    if (paise <= curve[i].paise) {
      return lerp(paise, curve[i - 1].paise, curve[i - 1].effect, curve[i].paise, curve[i].effect);
    }
  }
  return last.effect;
}

/**
 * How much of a target's commitment has actually gone live by this round.
 *
 * `committed` is the cumulative total across every allocation; `pending` holds
 * the tranches that have not reached their live round yet. Site work takes
 * time to build, and that delay is what makes "do not invest" a viable choice
 * at all — investing costs three rounds of traffic AND three rounds of
 * conversion data, and the data cost falls unevenly across positions.
 *
 * @param {{committed: object, pending?: object[]}} capex
 * @param {string} target
 * @param {number} round
 * @returns {number} integer paise
 */
export function liveCapexPaise(capex, target, round) {
  const total = capex?.committed?.[target] ?? 0;
  let notYetLive = 0;
  for (const tranche of capex?.pending ?? []) {
    if (tranche.target === target && tranche.liveAtRound > round) notYetLive += tranche.paise;
  }
  return Math.max(0, total - notYetLive);
}

/**
 * Points to add to the graded landing page score (spec 13.3).
 *
 * Kept separate from the business block on purpose. The other two targets move
 * a business number directly; this one moves a number the ad grader also
 * writes, so expressing it as points applied AFTER grading keeps the two
 * mechanisms from writing the same field. Two things writing one number is
 * how the L6 double-count happened.
 *
 * @param {{committed: object, pending?: object[]}} capex
 * @param {number} round
 * @returns {number} whole points, 0..CAPEX_LANDING_PAGE_MAX_POINTS
 */
export function landingPageBonus(capex, round) {
  const effect = capexEffect(liveCapexPaise(capex, 'landingPage', round), 'landingPage');
  const maxEffect = CAPEX_TIER_CURVE[CAPEX_TIER_CURVE.length - 1].effect;
  const fraction = maxEffect === 1 ? 0 : (effect - 1) / (maxEffect - 1);
  return Math.round(fraction * CAPEX_LANDING_PAGE_MAX_POINTS);
}

// ---------------------------------------------------------------------------
// Repositioning
// ---------------------------------------------------------------------------

/**
 * May this advertiser reposition now? (spec 4.5)
 *
 * One window, at the start of month 2, and only once. Twelve one-week rounds
 * is too short a span for a brand to credibly change what it sells and who it
 * sells to; one adjacent step is a repricing exercise a real brand could run
 * in a month, and that is all this allows.
 *
 * @param {{position: object}} advertiser
 * @param {number} round
 * @returns {boolean}
 */
export function canReposition(advertiser, round) {
  return round === REPOSITION_ROUND
    && advertiser?.position?.repositionedAtRound == null;
}

/**
 * Is `to` exactly one grid step from `from`?
 *
 * Value to Mid is a repricing exercise. Value to Premium is a different
 * company. Standing still is not a step.
 *
 * @param {{price: string, purpose: string}} from
 * @param {{price: string, purpose: string}} to
 * @returns {boolean}
 */
export function isOneStep(from, to) {
  if (!isValidPosition(from) || !isValidPosition(to)) return false;
  const priceSteps = Math.abs(PRICE_TIERS.indexOf(to.price) - PRICE_TIERS.indexOf(from.price));
  const purposeSteps = from.purpose === to.purpose ? 0 : 1;
  return priceSteps + purposeSteps === 1;
}

/**
 * Move an advertiser one step, returning a new position object.
 *
 * Throws on anything illegal rather than clamping to the nearest legal move —
 * a silently corrected reposition would charge the cost and deliver something
 * the player did not ask for.
 *
 * @param {object} position current position
 * @param {{price: string, purpose: string}} to
 * @param {number} round
 * @returns {object} the new position
 */
export function reposition(position, to, round) {
  if (round !== REPOSITION_ROUND) {
    throw new RangeError(`repositioning is only permitted in round ${REPOSITION_ROUND}`);
  }
  if (position.repositionedAtRound != null) {
    throw new RangeError('an advertiser may reposition only once');
  }
  if (!isOneStep(position, to)) {
    throw new RangeError(
      `${cellKey(position.price, position.purpose)} to ${cellKey(to.price, to.purpose)} `
      + 'is not one step on the grid',
    );
  }
  return {
    ...position,
    price: to.price,
    purpose: to.purpose,
    repositionedAtRound: round,
  };
}

/** The full allocation a reposition costs, for callers sizing the decision. */
export { CAPEX_ALLOCATION_PAISE as REPOSITION_EQUIVALENT_ALLOCATION };
