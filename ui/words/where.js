/**
 * The Studio's Where and when words (design/where-when/, the owner's choice of
 * 2026-09-15): where you advertise, as three rows beside the map, and the hours
 * of the day, drawn to scale. Figures arrive as figures.
 */

import { line } from './line.js';

export const WHERE = Object.freeze({
  placesTitle: line('label', 'Where you advertise'),
  placesSub: line('label', 'the same click is worth different money in different places'),
  placesHint: line('instruction', 'drag a bar to bid more or less in a kind of place'),
  cities: line('label', ({ n, names }) => `${n} · ${names}`),
  citiesMore: line('label', ({ n, names, more }) => `${n} · ${names} and ${more} more`),
  kept: line('label', 'kept a click'),
  paid: line('label', 'paid a click'),
  rowFigures: line('label', ({ clicks, cod, refused, sentBack }) => `${clicks} clicks · ${cod} paid at the door · `
    + `${refused} refused · ${sentBack} sent back`),
  noClicks: line('label', 'no clicks here yet'),
  outlook: line('reading', ({ best, bestKept, bestPaid, worst, worstKept, worstPaid }) => `A click has left you `
    + `${bestKept} in ${best} and ${worstKept} in ${worst}, after returns, your margin and return freight, `
    + `against ${bestPaid} and ${worstPaid} paid for one.`, { why: 'cashOnDelivery' }),
  notYet: line('reading', 'Not enough has run yet to compare places: the returns behind a click take weeks to come back.',
    { why: 'cashOnDelivery' }),
  mapNote: line('reading', 'Rings pulse with where your clicks came from, and dots grow with your bid there. '
    + 'The game knows three kinds of place, not single cities: every city of a kind moves together.'),

  hoursTitle: line('label', 'Hours of the day'),
  hoursSub: line('label', 'when you bid more, and when you bid less'),
  hoursHint: line('instruction', 'drag a block up to bid more, down to bid less'),
  over: line('label', ({ from, to }) => (from === to ? `clicks and sales from week ${from}` : `clicks and sales from weeks ${from}–${to}`)),
  clicksByHour: line('label', 'clicks by hour'),
  blockClicks: line('label', ({ n }) => `${n} clicks`),
  bought: line('label', ({ rate }) => `${rate} bought`),
  noRate: line('label', 'no clicks yet'),
  thin: line('reading', ({ n, min }) => `${n} ${n === 1 ? 'block rests' : 'blocks rest'} on hours with fewer than `
    + `${min} clicks, marked: a rate from a handful of clicks is noise.`),
  hoursNote: line('reading', 'An adjustment multiplies what you bid in those hours. It adds no money: the day’s budget '
    + 'is the same, so bidding harder in one block leaves less for the rest of the day.', { why: 'hours' }),
  varies: line('reading', 'Your strategy sets its own bid each hour, so how far a block can go before the limit '
    + 'varies, and a higher setting may change nothing.'),

  even: line('label', 'even'),
  off: line('label', 'off'),
  times: line('label', ({ value }) => `bids ×${value}`),
  offBid: line('label', 'bids the minimum'),
  top: line('label', 'the most'),
  scaleTimes: line('label', ({ times }) => `×${times}`),
  cap: line('reading', ({ times, top }) => `No bid goes past ${times} times your keyword bid, so these bars stop at ${top}.`),
  capClicks: line('reading', ({ already, times, top }) => `Maximise clicks already bids ${already} times your keyword `
    + `bid, and no bid goes past ${times} times it, so these bars stop at ${top}.`),
  above: line('label', ({ value }) => `set to ${value}; the bid stops at the top`),
  sliderName: line('label', ({ name }) => `${name} bid adjustment`),
});
