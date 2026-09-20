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
import { capexCurveFor, liveCapexPaise, landingPageBonus } from '../engine/positions.js';

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

/**
 * Where every grade starts before anything on the page counts: mid-scale, not
 * good. The offline grader starts all three parts here (agents/grader.js reads
 * this number rather than keeping its own), so there is one.
 */
export const PAGE_GRADE_BASE = 5;

/**
 * How long a description must run, in characters, before the page counted as
 * described, in a game saved before grading only what Google names (`LENGTH_RULES`).
 * One number, because the screen says it (Your ad's breakdown) and a sentence may
 * not carry a digit of its own.
 */
export const DESCRIBED_AT = 40;

/**
 * The top of the grader's scale, where the auction stops a landing page grade
 * however many points it earns (round.js, `withLandingBonus`; `effectiveGrades`).
 */
export const GRADE_CAP = 10;

const SIZING = Object.freeze({
  key: 'sizing',
  points: 1,
  hit: ({ page }) => /size|fit|guide|chart/.test(page),
  whenHit: 'it mentions sizing, which is what apparel buyers leave over',
  whenMissed: 'no mention of size or fit — the main reason apparel visitors bounce',
});
const REVIEWS = Object.freeze({
  key: 'reviews',
  points: 1,
  hit: ({ page }) => /review|rating/.test(page),
  whenHit: 'it mentions reviews',
  whenMissed: 'no reviews or ratings on the page',
});
const BARELY = Object.freeze({
  key: 'barely',
  points: -2,
  hit: ({ page }) => page.length < 15,
  whenHit: 'there is barely a description at all',
  whenMissed: null,
});

/**
 * What a page description earns, rule by rule. The grader's own rules for the
 * landing page part: `agents/grader.js` scores and explains the landing page
 * from this list, so the advice on screen and the number cannot drift apart.
 *
 * WHY THEY LIVE WITH THE LADDER, NOT IN agents/. Since the owner's decision of
 * 2026-09-17 the weekly loop grades the page as it stands, and game.js may not
 * reach agents/, where a model can be called (R2, tests/game.test.js). These
 * rules read the description and nothing else — no model, no copy, no keywords —
 * so the page and what it is worth sit together.
 *
 * GRADING ONLY WHAT GOOGLE NAMES (the owner's C, 2026-09-17,
 * design/photography-point/). A point for a description over 40 characters went
 * to any sentence at all, since the plain page is 21: a caption for product
 * shots, the faster page, a size chart alone by one character. Neither Google
 * help page fetched for it names pictures or length ("Optimize your ads and
 * landing pages", "Landing page experience"); Google's advice for a mobile page
 * is to keep it quick. So the faster page's own sentence earns that point, for
 * speed, and every rung above it keeps it. Over all 64 combinations of the three
 * ladders, a page with capital on the page itself grades as it did, and one
 * without loses exactly one point when a chart or shots are bought. Sizing stays:
 * Google asks for useful information about the product, and size is that, which
 * is inferred, not named. DECISIONS I38.
 */
export const LANDING_RULES = Object.freeze([
  {
    key: 'speed',
    points: 1,
    hit: ({ page }) => /loads quickly/.test(page),
    whenHit: 'it loads quickly on a phone',
    whenMissed: 'nothing says the page loads quickly on a phone',
  },
  SIZING,
  REVIEWS,
  BARELY,
]);

/**
 * The rules a game saved before grading only what Google names keeps (the
 * owner's choice, 2026-09-17), so it replays as it was played.
 */
export const LENGTH_RULES = Object.freeze([
  {
    key: 'described',
    points: 1,
    hit: ({ page }) => page.length > DESCRIBED_AT,
    whenHit: 'you have actually described the page',
    whenMissed: 'the description is too short to tell anyone what is on the page',
  },
  SIZING,
  REVIEWS,
  BARELY,
]);

/**
 * What a new game's page carries to say `LANDING_RULES` grade it (setup.js).
 * A page without it was saved before those rules and keeps `LENGTH_RULES`.
 */
export const PAGE_RULES_NOW = 'speed';

/**
 * The rules that grade a played game's page: the ones it was begun under.
 *
 * @param {object} [adGroup] the advertiser's first ad group, which carries the mark
 * @returns {readonly object[]}
 */
export function rulesFor(adGroup) {
  return adGroup?.pageRules === PAGE_RULES_NOW ? LANDING_RULES : LENGTH_RULES;
}

/**
 * The landing page grade a description earns: 1-10, a whole number.
 *
 * @param {string} description
 * @param {readonly object[]} [rules] `LENGTH_RULES` for a game saved before C
 * @returns {number}
 */
export function gradePage(description, rules = LANDING_RULES) {
  const page = (description ?? '').toLowerCase();
  const total = rules.reduce((sum, rule) => sum + (rule.hit({ page }) ? rule.points : 0), PAGE_GRADE_BASE);
  return Math.max(1, Math.min(10, Math.round(total)));
}

/**
 * The page as it stands in `round`: the description this ladder writes from the
 * capital LIVE that week, and the landing page grade that description earns.
 *
 * THE OWNER'S DECISION, 2026-09-17: GRADE THE PAGE AS IT STANDS. Round 0 used to
 * write the description once, from all the capital committed, and it was graded
 * from week 1 — so page capital counted three weeks before the work existed, and
 * capital committed at week 5 never reached the description at all. Measured:
 * a size guide and product shots bought at round 0 graded the page 7 from week
 * 1; the same bought at week 5 left it at 5 all game.
 *
 * One function for every reader, so the auction and the screens cannot disagree:
 * game.js lands it before each round's auctions, setup.js opens a game on it,
 * and round 0 and Your ad read it for what they show.
 *
 * @param {{committed?: object, pending?: object[]}} capex a capex block
 * @param {number} round the week the page is read in
 * @param {{rules?: readonly object[]}} [options] the rules the game was begun
 *   under (`rulesFor`); a new game's by default
 * @returns {{description: string, landingPage: number}}
 */
export function pageAsItStands(capex, round, { rules = LANDING_RULES } = {}) {
  const live = Object.fromEntries(COMPOSE_ORDER.map((target) => [target, liveCapexPaise(capex, target, round)]));
  const description = composeDescription(live);
  return { description, landingPage: gradePage(description, rules) };
}

/**
 * Where the landing page grade comes from in `round`, point by point, and which
 * purchase earned each (the owner's choice B, 2026-09-17, design/grade-breakdown/).
 *
 * BY RULE, NOT BY PURCHASE. Asked per purchase — the grade with it against the
 * grade without it — the answers do not add up: reviews and a size chart grade
 * 10, 7 without the page's money and 9 without the chart, so +3 and +1 against a
 * gain of 5. The missing point is "described", which either earns alone, so
 * neither finds it missing. Split by the grader's own rules, each point is
 * credited to every purchase whose sentences alone would earn it: one earner owns
 * it, more than one SHARE it. The site work's points are the page's.
 *
 * THE CAP IS SHOWN, NOT HIDDEN (the owner, 2026-09-17). `total` is the plain sum
 * and may pass ten; `grade` is what the auction runs on, computed as it computes
 * it, and never does. Where they differ, the cap took the difference.
 *
 * SHARING NEEDS THE LENGTH RULE. Under `LANDING_RULES` every rule is earned by
 * one ladder's sentences, so nothing is shared; only a game saved before C, still
 * on `LENGTH_RULES`, can split a point.
 *
 * @param {{committed?: object, pending?: object[]}} capex a capex block
 * @param {number} round
 * @param {object} [options]
 * @param {'live'|'committed'} [options.describedFrom] 'committed' reads the
 *   description from everything committed, as a game saved before the page was
 *   graded as it stands still does; the site work is always what is live.
 * @param {readonly object[]} [options.rules] the rules the game was begun under
 *   (`rulesFor`); a new game's by default.
 * @returns {{start: number, lines: Array<{rule: string, points: number, by: string[]}>,
 *   total: number, grade: number}} `by` names capex targets; empty for a point the
 *   plain page earns (none does today)
 */
export function pagePoints(capex, round, { describedFrom = 'live', rules = LANDING_RULES } = {}) {
  const paise = (target) => (describedFrom === 'committed'
    ? capex?.committed?.[target] ?? 0
    : liveCapexPaise(capex, target, round));
  const funded = Object.fromEntries(COMPOSE_ORDER.map((target) => [target, paise(target)]));
  const page = composeDescription(funded).toLowerCase();
  // A purchase earns a rule if its own sentences, on the plain page, hit it.
  const earners = COMPOSE_ORDER.filter((target) => tiersFunded(target, funded[target])
    .some((tier) => tier.paise > 0 && tier.sentence));
  const alone = (target) => composeDescription({ [target]: funded[target] }).toLowerCase();

  const lines = [];
  for (const rule of rules) {
    if (!rule.hit({ page })) continue;
    const by = earners.filter((target) => rule.hit({ page: alone(target) }));
    // Hit only by sentences together: every earner shares it.
    lines.push({ rule: rule.key, points: rule.points, by: by.length > 0 || rule.points < 0 ? by : earners });
  }
  const bonus = landingPageBonus(capex, round);
  if (bonus > 0) lines.push({ rule: 'siteWork', points: bonus, by: ['landingPage'] });

  return {
    start: PAGE_GRADE_BASE,
    lines,
    total: PAGE_GRADE_BASE + lines.reduce((sum, line) => sum + line.points, 0),
    grade: Math.min(GRADE_CAP, gradePage(page, rules) + bonus),
  };
}
