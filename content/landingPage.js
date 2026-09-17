/**
 * The landing page, as something you BUILD rather than something you describe.
 *
 * Round 0 used to hold a text box whose hint said, out loud, "it exists to be
 * graded". The player typed prose; the grader read it for two regexes
 * (`/size|fit|guide|chart/` and `/review|rating/`) and a length. So the words
 * "size guide" earned landing-page grade for nothing, while BUYING a size guide
 * cost capital and bought a lower return rate instead. One concept, two models,
 * and the free one was a text box.
 *
 * Here the description is COMPOSED from what the capital actually funded, so a
 * claim without a purchase behind it cannot be made. See DECISIONS I9 for what
 * that costs — a `sizeGuide` purchase now moves two numbers, which is the shape
 * `engine/positions.js` warns about, argued there rather than hidden.
 *
 * NO PHYSICS LIVES HERE. The sentences are content; the grade they earn is the
 * grader's opinion, asked for rather than restated. `tests/landingPage.test.js`
 * asserts every claim below through the real `explainGrade`.
 *
 * WHY IN content/, NOT ui/. It lived in ui/landing-page.js while only round 0
 * composed a page. The owner's decision of 2026-09-17 — grade the page as it
 * stands — has the weekly loop in game.js re-write a page from the capital live
 * that week, and game.js reads nothing from ui/. The cards' own helpers
 * (`capexChoices`, `pageShape`) stay in ui/landing-page.js and read this.
 */

import { CAPEX_TIER_CURVE } from '../engine/constants.js';
import { capexCurveFor } from '../engine/positions.js';

/**
 * The amounts the S-curve actually distinguishes (13.3).
 *
 * Derived, not typed. This was a literal `[0, 2500000, ...]` in `round-zero.js`
 * holding the same five integers as the curve — a copy of an engine curve
 * sitting in the view, which is the exact defect `tests/ui.test.js` exists to
 * prevent and could not see, because its guard matches DECIMAL arrays only.
 */
export const CAPEX_STEPS = CAPEX_TIER_CURVE.map((tier) => tier.paise);

/**
 * The rungs one target's ladder actually has (I30).
 *
 * Photography climbs a longer, shallower one, so `CAPEX_STEPS` is no longer the
 * answer for every target — it is the answer for three of them. A card reading
 * the shared list for photography would offer ₹25,000 as a rung photography does
 * not have and quietly charge for a step that reaches nothing.
 */
export const stepsFor = (target) => capexCurveFor(target).map((tier) => tier.paise);

/** Photography's own rungs, named so the table below reads as a ladder. */
const PHOTO_STEPS = stepsFor('photography');

/**
 * What each rung of each capex target puts on the page.
 *
 * `sentence` is what the tier contributes to the description the grader reads;
 * `label` is what the chip says. A tier with no sentence adds nothing to the
 * page — which is what "none" means.
 *
 * The ladders are cumulative: funding a tier includes every tier below it, so
 * the page a player ends up with is everything they could afford, in order.
 */
export const PAGE_FEATURES = Object.freeze({
  landingPage: Object.freeze([
    // Not "none": spending nothing on the page still leaves you a page. The
    // other two ladders start at "none" because they start at absent.
    { paise: CAPEX_STEPS[0], label: 'plain', sentence: 'A plain product page.' },
    { paise: CAPEX_STEPS[1], label: 'faster', sentence: 'It loads quickly on a phone.' },
    {
      paise: CAPEX_STEPS[2],
      label: 'reviews',
      // The only route to the grader's /review|rating/ rule. Without a tier
      // that mentions them, that clause becomes a rule nothing can satisfy.
      sentence: 'Customer reviews and ratings sit under every product.',
    },
    {
      paise: CAPEX_STEPS[3],
      label: 'built around the search',
      // The old ladder had these as two rungs, ₹70,000 and ₹1,00,000, and the
      // second was the worst buy on it. Merged rather than dropped, so the top
      // of the ladder is still the best page a player can build (I29).
      sentence: 'Fabric, care and delivery are written out in full, and each page '
        + 'is built around the search that brought them to it.',
    },
  ]),
  sizeGuide: Object.freeze([
    { paise: CAPEX_STEPS[0], label: 'none', sentence: null },
    { paise: CAPEX_STEPS[1], label: 'a chart', sentence: 'A basic size chart.' },
    {
      paise: CAPEX_STEPS[2],
      label: 'measured',
      sentence: 'A size guide with real measurements for every size.',
    },
    {
      paise: CAPEX_STEPS[3],
      label: 'fit finder',
      sentence: 'Fit notes for each garment, and a fit finder that recommends a '
        + 'size from height and build.',
    },
  ]),
  // Photography's rungs are its own — ₹50,000 / ₹1,10,000 / ₹1,60,000 rather
  // than the shared ₹25,000 / ₹55,000 / ₹80,000 (I30). It is the strongest
  // lever in the game and it now costs twice what anything else does.
  photography: Object.freeze([
    { paise: PHOTO_STEPS[0], label: 'none', sentence: null },
    { paise: PHOTO_STEPS[1], label: 'product shots', sentence: 'Product shots on white.' },
    {
      paise: PHOTO_STEPS[2],
      label: 'on real bodies',
      sentence: 'Photographed on more than one body type.',
    },
    {
      paise: PHOTO_STEPS[3],
      label: 'video',
      sentence: 'Close detail shots of the fabric and the seams, and a short '
        + 'video on every product, moving.',
    },
  ]),

  /**
   * The fourth target (I29), and the only one that is not about the page.
   *
   * It contributes NO sentence, and that is the point rather than an omission:
   * confirming an order before dispatch changes nothing a visitor reads, so it
   * cannot move a grade the copy grader writes. It acts on refusals and on
   * nothing else, which is why it is the answer to the freight build 2 charges
   * and not a second route to quality score.
   */
  orderConfirmation: Object.freeze([
    { paise: CAPEX_STEPS[0], label: 'none', sentence: null },
    { paise: CAPEX_STEPS[1], label: 'an SMS', sentence: null },
    { paise: CAPEX_STEPS[2], label: 'WhatsApp confirm', sentence: null },
    { paise: CAPEX_STEPS[3], label: 'confirm and verify', sentence: null },
  ]),
});

/** The order the page reads in. The page itself first, then what is on it. */
export const COMPOSE_ORDER = Object.freeze(['landingPage', 'sizeGuide', 'photography']);

/**
 * The tiers a given spend has paid for, cheapest first.
 *
 * @param {string} target one of the capex target keys
 * @param {number} paise what is committed to that target
 * @returns {object[]} every tier at or below the spend
 */
export function tiersFunded(target, paise) {
  return PAGE_FEATURES[target].filter((tier) => tier.paise <= (paise ?? 0));
}

/**
 * What a given spend on a target has actually bought.
 *
 * The S-curve is a step function of what is COMMITTED, so money between two
 * knots buys the lower one — `capexEffect` interpolates the EFFECT but the
 * feature ladder does not, and describing a part-paid tier as the one above it
 * would promise something the page does not have.
 *
 * Shared so the two cards that spend capital cannot describe it differently.
 * Round 0 became a page builder while the round-5 allocation window kept the
 * older framing — its own target list, one-line whys, and chips showing only an
 * amount — which left one decision described in two languages, the terser one
 * being where the player has more context and less time (DECISIONS I15).
 *
 * @param {string} target one of the capex target keys
 * @param {number} paise committed to that target
 * @returns {object} the tier that spend reaches
 * @throws {RangeError} on an unknown target, rather than describing nothing
 */
export function featureAt(target, paise) {
  const tiers = PAGE_FEATURES[target];
  if (!tiers) throw new RangeError(`no page features for target "${target}"`);
  const funded = tiersFunded(target, paise);
  return funded[funded.length - 1] ?? tiers[0];
}

/**
 * The landing page description, built from what the capital funded.
 *
 * Pure: the same allocation always gives the same page, and the argument is
 * never written to. This is what `ad.landingPageDescription` becomes, so it is
 * the exact string `agents/grader.js` will read.
 *
 * @param {{sizeGuide?: number, photography?: number, landingPage?: number}} capex
 *   committed paise per target, as `round-zero.js` holds it
 * @returns {string}
 */
export function composeDescription(capex = {}) {
  const sentences = [];
  for (const target of COMPOSE_ORDER) {
    for (const tier of tiersFunded(target, capex[target])) {
      if (tier.sentence) sentences.push(tier.sentence);
    }
  }
  return sentences.join(' ');
}
