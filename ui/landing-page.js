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
 */

import { CAPEX_TIER_CURVE } from '../engine/constants.js';

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
      label: 'full detail',
      sentence: 'Fabric, care and delivery details are written out in full.',
    },
    {
      paise: CAPEX_STEPS[4],
      label: 'built around the search',
      sentence: 'Each page is built around the search that brought them to it.',
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
      label: 'per garment',
      sentence: 'Fit notes for each garment, cut by cut.',
    },
    {
      paise: CAPEX_STEPS[4],
      label: 'fit finder',
      sentence: 'A fit finder that recommends a size from height and build.',
    },
  ]),
  photography: Object.freeze([
    { paise: CAPEX_STEPS[0], label: 'none', sentence: null },
    { paise: CAPEX_STEPS[1], label: 'product shots', sentence: 'Product shots on white.' },
    {
      paise: CAPEX_STEPS[2],
      label: 'on real bodies',
      sentence: 'Photographed on more than one body type.',
    },
    {
      paise: CAPEX_STEPS[3],
      label: 'fabric detail',
      sentence: 'Close detail shots of the fabric and the seams.',
    },
    {
      paise: CAPEX_STEPS[4],
      label: 'video',
      sentence: 'A short video on every product, moving.',
    },
  ]),
});

/** The order the page reads in. The page itself first, then what is on it. */
const COMPOSE_ORDER = ['landingPage', 'sizeGuide', 'photography'];

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

/**
 * The page as a drawable shape, for the wireframe beside the chips.
 *
 * Returns which strips the page has, so the view can draw them without knowing
 * what any of them cost.
 *
 * @param {object} capex committed paise per target
 * @returns {{strips: Array<{target: string, label: string}>}}
 */
export function pageShape(capex = {}) {
  const strips = [];
  for (const target of COMPOSE_ORDER) {
    const funded = tiersFunded(target, capex[target]);
    const top = funded[funded.length - 1];
    if (top && top.sentence) strips.push({ target, label: top.label });
  }
  return { strips };
}
