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

  // Four since I34 added the discount; the note named three until the Studio's
  // Returns was drawn (2026-09-15).
  leversHead: line('instruction', 'Four things move it, and three of them are open every week.'),
  levers: line('instruction',
    'Offer a prepaid discount: it moves buyers off cash, and cash is what gets refused. '
    + 'Bid less where cash on delivery is commonest — the location card is the same '
    + 'decision seen from the other side, and it is open every round. Block a search '
    + 'that comes back worse than the rest of your account; the search terms card '
    + 'marks them and the button is on the row.'),
  capitalOpen: line('instruction',
    'And capital is open THIS round: order confirmation reaches refusals, the size '
    + 'guide reaches send-backs, and neither reaches the other.'),
  capitalLater: line('instruction', ({ window }) =>
    `Capital is the fourth: it is shut, and opens again ${window}.`),
  capitalClosed: line('instruction', 'Capital is the fourth, and it has closed for the rest of the game.'),

  countedWeeks: line('reading', ({ first, last }) => (first === last
    ? `Only week ${first} is counted above; `
    : `Only weeks ${first} to ${last} are counted above; `)
    + 'the rest are still arriving and will read better than they are.', { why: 'attributionLag' }),
});

/** The two capital targets on returns, as a sentence names them, and the half each reaches (I28, I29). */
const TARGETS = Object.freeze({
  orderConfirmation: ['Order confirmation', 'order confirmation', 'refusals'],
  sizeGuide: ['The size guide', 'the size guide', 'send-backs'],
});
const HALVES = Object.freeze({ refused: 'Refused', sentBack: 'Sent back' });
const VERBS = Object.freeze({ fell: 'fell', rose: 'rose' });
const weeksOf = (from, to) => (from === to ? `week ${from}` : `weeks ${from} to ${to}`);

/**
 * The Studio's Returns (design/returns/, chosen by the owner 2026-09-15). The
 * figures it shares with the classic card keep that card's words (RETURNS);
 * these are the ones it adds.
 */
export const RETURNS_STUDIO = Object.freeze({
  // The five figures.
  refusedAtDoor: line('label', 'Refused at the door'),
  freightSub: line('label', ({ perParcel }) => `${perParcel} a refused parcel, all weeks`),
  paidAtDoor: line('label', 'Paid at the door', { why: 'cashOnDelivery' }),
  paidAtDoorSub: line('label', 'where your clicks came from'),
  counted: line('reading', ({ from, to, settlesAfter }) => (from === to
    ? `Week ${from} is counted`
    : `Weeks ${from} to ${to} are counted`) + `: a week settles ${settlesAfter} weeks after it runs.`,
  { why: 'attributionLag' }),

  // Week by week.
  chartTitle: line('label', 'Week by week'),
  keyStill: line('label', 'still coming back'),
  markLive: line('label', ({ target }) => `${TARGETS[target][1]} live`),
  markLater: line('label', ({ target }) => `${TARGETS[target][1]} from here`),
  column: line('label', ({ week, refused, sentBack, still }) => (still
    ? `Week ${week}, still coming back: ${refused} refused and ${sentBack} sent back so far`
    : `Week ${week}: ${refused} refused and ${sentBack} sent back`)),
  step: line('reading', ({ half, direction, before, after, from, to, week, target, otherBefore, otherAfter }) => {
    const other = HALVES[half === 'refused' ? 'sentBack' : 'refused'];
    const name = TARGETS[target][1];
    const change = direction === 'held'
      ? `${HALVES[half]} held at ${after} of orders from week ${week}, when ${name} went live, as in ${weeksOf(from, to)}.`
      : `${HALVES[half]} ${VERBS[direction]} from ${before} of orders in ${weeksOf(from, to)} to ${after} from week `
        + `${week}, when ${name} went live.`;
    return `${change} ${other}, which it does not reach, went from ${otherBefore} to ${otherAfter}.`;
  }),
  onlyOne: line('reading', ({ from, refused, sentBack }) =>
    `Only week ${from} has settled: ${refused} of its orders refused and ${sentBack} sent back.`),
  plain: line('reading', ({ from, to, refused, sentBack }) =>
    `Over weeks ${from} to ${to}, ${refused} of orders were refused at the door and ${sentBack} sent back.`),
  stillComing: line('reading', ({ next, latest }) => (next === latest
    ? `Week ${latest} is still coming back, so it reads lower than it will end.`
    : `Weeks ${next} to ${latest} are still coming back, so they read lower than they will end.`)),

  // The prepaid discount.
  prepaidTitle: line('label', 'Prepaid discount'),
  prepaidSub: line('label', 'money off a prepaid order, so fewer of your buyers pay at the door',
    { why: 'cashOnDelivery' }),
  none: line('label', 'none'),
  noneLine: line('reading', ({ rate }) => `No discount: about ${rate} of next week's orders refused.`),
  noneShape: line('reading', 'The rungs get worse as they get bigger: the first does most of the work.'),
  pickHint: line('instruction', 'Pick one to see what it saves and what it costs.'),
  // A forecast of next week, not the weeks counted above, and it says so: the
  // review of the canvas found it read as a second, different refusal rate.
  rungRate: line('reading', ({ none, at, rung, fewer }) =>
    `Next week about ${none} of orders refused with no discount, ${at} at ${rung}: ${fewer} fewer.`),
  saves: line('label', ({ amount }) => `Saves about ${amount} a week`),
  savesSub: line('label', ({ parcels, freight, margin }) =>
    `${parcels} refused parcels kept, each ${freight} of freight and ${margin} of margin`),
  costs: line('label', ({ amount }) => `Costs about ${amount} a week`),
  costsSub: line('label', ({ rung, orders }) =>
    `${rung} off about ${orders} prepaid orders, the ones already paying first included`),
  rungFoot: line('reading', ({ orders, from, to }) => (from === to
    ? `At the ${orders} orders week ${from} had.`
    : `At the ${orders} orders a week that weeks ${from} to ${to} averaged.`)),

  // What else moves it.
  leversTitle: line('label', 'What else moves it'),
  placeHead: line('label', 'Where you advertise'),
  bothHalves: line('label', 'reaches both halves'),
  colRefused: line('label', 'refused'),
  colSentBack: line('label', 'sent back'),
  colPaidAtDoor: line('label', 'paid at door'),
  blockHead: line('label', 'Blocking a search'),
  blockText: line('reading', 'A search whose orders come back more than the rest of your account\'s is marked, '
    + 'with Block beside it.'),
  capitalHead: line('label', 'Capital'),
  oneHalfEach: line('label', 'one half each'),
  capitalOpen: line('reading', 'Open this week, in Your money.'),
  capitalLater: line('reading', ({ window }) => `Shut, and it opens again ${window}.`),
  capitalClosed: line('reading', 'Closed for the rest of the game.'),
  capitalTarget: line('reading', ({ target, rung, since, later, laterWeek }) => {
    const [name, , reach] = TARGETS[target];
    const head = `${name}, which reaches ${reach} only: `;
    if (!rung && !later) return `${head}nothing built.`;
    const now = rung ? `${rung}, live since week ${since}` : '';
    const next = later ? `${later} from week ${laterWeek}` : '';
    return `${head}${[now, next].filter(Boolean).join(', rising to ')}.`;
  }),
});
