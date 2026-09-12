/**
 * The field guide's chapters (stage C2, plans/2026-09-12-content-model-and-field-guide.md).
 *
 * TITLES ONLY FOR NOW. The words on the returns card already name the chapters
 * that will explain them, and a "why" that points at nothing is the failure
 * `tests/words.test.js` exists to catch. So the chapters exist as names first;
 * Task 2 of the plan writes them, each in two parts — how real Google Ads does
 * it, then what this game does and where it departs — with its sources and
 * the DECISIONS entries it rests on.
 */

export const CHAPTERS = Object.freeze({
  attributionLag: Object.freeze({ title: 'Why this week’s numbers keep moving' }),
  returnsSplit: Object.freeze({ title: 'Refused at the door, or sent back' }),
  cashOnDelivery: Object.freeze({ title: 'Cash on delivery, and where you advertise' }),
});
