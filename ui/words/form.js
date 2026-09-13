/**
 * Sentences on the decision form's cards, under the content model (C1).
 *
 * The form's older prose still lives in `ui/decisions.js`; it moves here when
 * C4 rebuilds the cards. New lines start here, so they can be tested.
 */

import { line } from './line.js';

export const FORM = Object.freeze({
  // D11: owed since the field guide's cash-on-delivery chapter told the place
  // half. Shown only while the strategy predicts conversions, when it is true.
  hoursTwice: line('disclosure',
    'Here an hour adjustment works under every bidding strategy. Under this one it lands on '
    + 'top of the strategy’s own reading of the hour, so the hour counts twice; Google Ads '
    + 'does not allow hour adjustments with the strategies that predict conversions.',
    { why: 'hours' }),
});
