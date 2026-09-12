/**
 * Every sentence and label on the returns card, "What came back" (I31, I33).
 *
 * The pilot of the content model: moved out of `renderReturns` word for word,
 * except the "five weeks" the card used to type, which is now the constant it
 * was describing. The figures arrive formatted, from the render function.
 *
 * Nothing here is a concept yet, and nothing is a disclosure. The lines that
 * lean on a concept name the chapter that will carry it, so C2 can move the
 * explanation off the card without hunting for where it was.
 */

import { line } from './line.js';

export const RETURNS = Object.freeze({
  nothingSettled: line('reading', ({ settlesAfter, firstHonestWeek }) =>
    `Nothing has settled yet. A click is final about ${settlesAfter} weeks `
    + `after it happens, so the first honest reading of this card is week ${firstHonestWeek}.`,
  { why: 'attributionLag' }),

  cameBack: line('label', 'Came back'),
  cameBackSub: line('label', ({ returned, orders }) => `${returned} of ${orders} orders`),
  refused: line('label', 'Refused'),
  refusedSub: line('label', ({ refused }) => `${refused} never delivered`),
  sentBack: line('label', 'Sent back'),
  sentBackSub: line('label', ({ sentBack }) => `${sentBack} after delivery`),
  freight: line('label', 'Freight paid'),
  freightSub: line('label', ({ perParcel }) => `${perParcel} a parcel, every week`),
  paidAtDoor: line('label', 'Paid at door', { why: 'cashOnDelivery' }),
  paidAtDoorSub: line('label', 'across where you actually advertise'),

  week: line('label', ({ round }) => `Week ${round}`),
  stillIn: line('label', 'still in'),
  keyRefused: line('label', 'refused at the door', { why: 'returnsSplit' }),
  keySentBack: line('label', 'sent back after delivery'),

  refusalCost: line('reading', ({ perRefusal }) => `Every refusal costs you about ${perRefusal}`),
  refusalCostParts: line('reading', ({ freight, margin }) =>
    `— ${freight} of freight both ways, and ${margin} of margin on a sale that never happened.`),

  leversHead: line('instruction', 'Three things move it, and two of them this week.'),
  levers: line('instruction',
    'Bid less where cash on delivery is commonest — the location card is the same '
    + 'decision seen from the other side, and it is open every round. Block a search '
    + 'that comes back worse than the rest of your account; the search terms card '
    + 'marks them and the button is on the row.'),
  capitalOpen: line('instruction',
    'And capital is open THIS round: order confirmation reaches refusals, the size '
    + 'guide reaches send-backs, and neither reaches the other.'),
  capitalShut: line('instruction', ({ window }) =>
    `Capital is the third and it is shut — it opens only ${window}, `
    + 'so the first two are what you have now.'),

  countedWeeks: line('reading', ({ first, last }) =>
    `Only weeks ${first} to ${last} are counted above; the rest are still arriving `
    + 'and will read better than they are.', { why: 'attributionLag' }),
});
