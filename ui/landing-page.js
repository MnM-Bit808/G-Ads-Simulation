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
 * The top-up amounts the allocation card should offer, from where this target
 * already stands.
 *
 * FOUND BY PLAYING IT, and it was a menu problem rather than a pricing one.
 * Investment is cumulative (13.3), so a ₹55,000 top-up on an existing ₹25,000
 * reaches ₹80,000 and lands on the ₹70,000 rung — nobody was ever charged twice.
 * But the card offered `CAPEX_STEPS`, the rung PRICES, as amounts. From ₹25,000
 * the increment to the ₹55,000 rung is ₹30,000, and no chip offered it, so **that
 * rung could never be occupied again** — and round 5 is the last capital window
 * in the game. It priced a player out, too: two half-funded targets cost ₹55,000
 * each to lift one rung, against a ₹1,00,000 window where the true increments
 * are ₹30,000 each.
 *
 * So: the cheapest amount that reaches each rung above where you stand. A
 * dominated option — more money for the same rung — is not a lesson and is not
 * offered.
 *
 * ONE WASTEFUL CHIP IS KEPT, AND MARKED, which narrows DECISIONS I15 rather than
 * undoing it. I15 added a "no change" chip to make the S-curve threshold
 * concrete, and that is worth keeping: beside `on real bodies · ₹30,000`, a
 * `no change · ₹25,000` teaches more than either chip alone. It is always one of
 * `CAPEX_STEPS`, so it is an amount the player might genuinely have reached for,
 * rather than a warning about a button nobody could press. What I15 also showed —
 * two chips reaching one rung at different prices — is gone, because the more
 * expensive of the two was strictly worse.
 *
 * @param {string} target one of the capex target keys
 * @param {number} [alreadyPaise] what is committed to it already
 * @returns {Array<{amountPaise: number, reaches: object, wasteful: boolean}>}
 *   ascending by amount; `wasteful` means the money changes nothing
 * @throws {RangeError} on an unknown target
 */
export function capexChoices(target, alreadyPaise = 0) {
  const tiers = PAGE_FEATURES[target];
  if (!tiers) throw new RangeError(`no page features for target "${target}"`);
  const standing = featureAt(target, alreadyPaise);

  // Every rung above here, at the difference — which is the price the cumulative
  // model actually charges — plus the steps the card has always offered, so a
  // wasteful one is still a real option rather than an invented number.
  const candidates = new Set();
  for (const tier of tiers) {
    if (tier.paise > alreadyPaise) candidates.add(tier.paise - alreadyPaise);
  }
  for (const step of CAPEX_STEPS) {
    if (step > 0) candidates.add(step);
  }

  // Cheapest amount per rung reached. Two amounts landing on one rung means the
  // dearer one buys nothing extra.
  const cheapest = new Map();
  for (const amountPaise of candidates) {
    const reaches = featureAt(target, alreadyPaise + amountPaise);
    const held = cheapest.get(reaches.paise);
    if (!held || amountPaise < held.amountPaise) {
      cheapest.set(reaches.paise, {
        amountPaise,
        reaches,
        wasteful: reaches.paise === standing.paise,
      });
    }
  }

  return [...cheapest.values()].sort((a, b) => a.amountPaise - b.amountPaise);
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
