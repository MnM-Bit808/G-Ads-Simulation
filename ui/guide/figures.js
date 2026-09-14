/**
 * The figures the field guide quotes, formatted for reading.
 *
 * A chapter types no number (tests/guide.test.js): every figure in its "in this
 * game" half arrives from here, and this reads the engine's constants, so a
 * chapter cannot drift from the model the way stage A's ten sentences did.
 *
 * The two attribution phrases are the dashboard's own, imported rather than
 * derived again: `ATTRIBUTION_LAG_DISTRIBUTION` may be named in exactly one
 * view file (tests/ui.test.js), and this is not it.
 */

import { ARRIVAL_SHAPE, SETTLES_AFTER_ROUNDS } from '../dashboard.js';
import { pct, rupees, whole } from '../dom.js';
import {
  RTO_RATE_COD, RTO_RATE_PREPAID, POST_DELIVERY_RETURN_RATE, RTO_FREIGHT_PAISE,
  LEARNING_ROUNDS, LEARNING_ERROR_MULTIPLIER, BRAND_OWNER_MULTIPLIER, BRAND_POACHER_MULTIPLIER,
  QUALITY_MIN_IMPRESSIONS,
} from '../../engine/constants.js';

/**
 * @returns {Readonly<Record<string, string>>} every figure a chapter may name in `needs`
 */
export function guideFigures() {
  return Object.freeze({
    lagShape: ARRIVAL_SHAPE,
    settlesAfter: String(SETTLES_AFTER_ROUNDS),
    rtoCod: pct(RTO_RATE_COD, 1),
    rtoPrepaid: pct(RTO_RATE_PREPAID, 1),
    postDelivery: pct(POST_DELIVERY_RETURN_RATE),
    freight: rupees(RTO_FREIGHT_PAISE),
    learningWeeks: String(LEARNING_ROUNDS),
    learningError: `${LEARNING_ERROR_MULTIPLIER} times`,
    ownerConv: `${BRAND_OWNER_MULTIPLIER} times`,
    poacherConv: `${BRAND_POACHER_MULTIPLIER} times`,
    qsImpressions: whole(QUALITY_MIN_IMPRESSIONS),
  });
}
