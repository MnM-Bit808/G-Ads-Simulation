/**
 * Rival ad copy, authored per cell (spec 17.1).
 *
 * READ AND CORRECTED. This is content, and content is the one thing in this
 * project a test cannot validate, so it went past a human end to end and came
 * back with six corrections — all applied, all recorded in the commit that made
 * them. Mid-market, the cell most at risk of being unreadable against Premium,
 * is confirmed as reading well.
 *
 * **One detail remains unverified**: the Japanese and Korean yarn signal in the
 * Premium cells. It replaced an Italian one, which is a European premium
 * signal rather than an Indian one — but whether Indian premium activewear
 * actually leads with Japanese yarn, or with recycled technical fabric, or with
 * a named mill, is a judgement nobody in this project has confirmed. It is a
 * one-line change if somebody who knows the market says otherwise.
 *
 * WHY IT IS LOAD-BEARING
 *
 * Brand names are deliberately position-neutral (7.5) — rival placement is
 * seeded per game, so any name carrying a price or purpose signal would
 * eventually land in a cell that contradicts it. **Position is signalled
 * entirely through ad copy.** 17.1 says rival positions are never stated, only
 * inferred, primarily from these words. If the six read generically the player
 * can infer nothing and the entire round 0 mechanic collapses into guessing.
 *
 * So each set has to answer two questions from thirty characters and two
 * lines: *what does this cost*, and *what is it for*.
 *
 * HOW THE TWO AXES ARE SIGNALLED
 *
 *   price    Value    a number, and the number is small. Discounts, combos,
 *                     "from ₹799". Price is the offer, and **only Value makes
 *                     one** — an offer is itself a price-tier signal, so a
 *                     premium brand running "buy 2, save 20%" would contradict
 *                     everything else in its ad.
 *            Mid      no price and no material — the pitch is the product
 *                     doing its job for a normal person, four sessions a week,
 *                     wash after wash. The hardest cell to write, because
 *                     mid-market is defined by what it is not, and the one
 *                     most worth getting right: if a player cannot tell mid
 *                     from premium, the middle of the grid is unreadable.
 *            Premium  material and construction. Modal, cashmere blend,
 *                     Japanese technical knit, seamless. Never the word
 *                     "expensive"; premium brands signal cost by naming what
 *                     they are made of.
 *
 *   purpose  Performance  the verb is TRAIN. Squat-proof, sweat-wicking,
 *                         compression, heavy lifts, high impact.
 *            Lifestyle    the verb is WEAR. Lounge, co-ord, everyday, soft,
 *                         studio to street.
 *
 * TWO RULES THE FIRST DRAFT BROKE, AND THE CORRECTIONS
 *
 * **The second description used to be boilerplate**, identical within each
 * purpose pair — both mid cells shared "Sizes XS to XXL. Fit guide, 30-day
 * returns, free delivery both ways" verbatim, and both premium cells shared
 * theirs. Realistic, and it halved the signal available per ad. Every second
 * line now carries something only that cell would say: Value's 15-day returns
 * against Mid and Premium's 30, a fit guide that "admits when to size up" for
 * the tier that has to be honest about fit, a fit consultation for the tier
 * that can afford one.
 *
 * **And the sourcing was Italian**, which is a European premium-athleisure
 * signal rather than an Indian one. Indian premium activewear signals with
 * Japanese and Korean yarn, recycled technical fabric and knit construction.
 * Corrected — this is the kind of detail that reads as invented to anyone who
 * knows the market, and the whole point of the vertical is that it does not.
 *
 * WHY THE GRADES DO NOT VARY BY CELL
 *
 * `gradedQuality` is NOT authored here per cell, and that is deliberate. If
 * premium copy graded 8 and value copy graded 5, then position would silently
 * determine ad quality, and a cell would carry a hidden economic advantage
 * nobody chose. DECISIONS F6 is explicit that economics are identical within a
 * cell so that outcome differences trace back to a decision somebody made.
 * Quality variation belongs on the individual rival, not on the square it
 * happens to occupy, so it lives in `RIVAL_GRADE_VARIATION` below.
 *
 * NO RIVAL TRADEMARKS APPEAR IN ANY OF THIS COPY. Bidding on a competitor's
 * brand as a keyword is permitted; naming them in your ad text is not, and the
 * grader penalises `adRelevance` when it happens (8.7). None of the nine brand
 * names from `brands.js` appears here.
 */

/**
 * One ad per cell. Three headlines, two descriptions, one landing page note.
 *
 * Headlines are capped at `HEADLINE_MAX_CHARS` (30) and descriptions at
 * `DESCRIPTION_MAX_CHARS` (90) — the two DOCUMENTED Google limits, which until
 * now no code in this project read.
 */
export const AD_COPY_BY_CELL = Object.freeze({
  'value|performance': {
    headlines: [
      'Gym Leggings From ₹799',
      'Squat Proof, Not Pricey',
      '2 Sports Bras For ₹999',
    ],
    descriptions: [
      'Train hard, spend little. Squat-proof leggings and high-impact bras that hold.',
      'Free delivery over ₹799. Easy 15-day returns, because gym fit is hard to guess.',
    ],
    landingPageDescription:
      'Category page sorted by price, low to high. Size chart, bulk combo offers.',
  },

  'value|lifestyle': {
    headlines: [
      'Co-ord Sets From ₹1199',
      'Comfy Everyday, Low Price',
      'Buy 2 Sets, Save 20%',
    ],
    descriptions: [
      'Soft co-ord sets and joggers that look put together, for a lot less.',
      'New drops monthly, sizes XS to XXL. Easy 15-day returns, no questions asked.',
    ],
    landingPageDescription:
      'Grid of co-ord sets with combo pricing. Reviews above the fold, size chart below.',
  },

  'mid|performance': {
    headlines: [
      'Leggings Built To Train In',
      'Holds Up, Wash After Wash',
      'Squat-Proof, Sweat-Wicking',
    ],
    descriptions: [
      'Gym wear that survives four sessions a week and a hot Indian summer.',
      'Sizes XS to XXL, with a fit guide that admits when to size up. 30-day returns.',
    ],
    landingPageDescription:
      'Product page with a fit guide, wash-test notes, and reviews filtered by activity.',
  },

  'mid|lifestyle': {
    headlines: [
      'Athleisure For All Day',
      'Studio To Street Co-ords',
      'The Set You Reach For',
    ],
    descriptions: [
      'Everyday athleisure for the school run, the studio, and whatever comes after.',
      'Sizes XS to XXL, with a fit guide for between-sizes. 30-day returns.',
    ],
    landingPageDescription:
      'Lookbook-led page, sets shown as outfits. Fit guide and reviews below.',
  },

  'premium|performance': {
    headlines: [
      'Seamless Compression Kit',
      'Japanese Technical Knit',
      'Made For Heavy Lifts',
    ],
    descriptions: [
      'Seamless, sculpting, second-skin. Japanese yarn, knitted to hold under load.',
      'Fit consultation before you buy. 30-day returns, free delivery both ways.',
    ],
    landingPageDescription:
      'Long-form product page: yarn composition, knit structure, athlete testing notes.',
  },

  'premium|lifestyle': {
    headlines: [
      'Modal And Cashmere Blend',
      'Considered Athleisure',
      'Made To Outlast Trends',
    ],
    descriptions: [
      'Loungewear in modal and cashmere blend, cut to hold its shape for years.',
      'Fit consultation, and a care card in every box. 30-day returns.',
    ],
    landingPageDescription:
      'Editorial page: fabric provenance, care instructions, considered-purchase framing.',
  },
});

/**
 * Ad quality, per RIVAL rather than per cell.
 *
 * Nine entries, applied in roster order, so a brand carries its own strengths
 * and weaknesses into whichever cell the seed drops it in. Index 0 is the
 * player's slot and is unused when the player writes their own copy.
 *
 * Deliberately uneven and deliberately uncorrelated with position. One rival
 * writes a sharp ad onto a weak landing page; another has an excellent page and
 * dull copy. That spread is what makes `reportedScore` mean anything — "above
 * average" needs a field to be above (L4) — and what stops nine identical ad
 * ranks tying and handing one advertiser every top slot.
 *
 * `ESTIMATED`, in the sense that a human graded them by reading. When
 * `agents/grader.js` exists it can regrade these; until then they keep the
 * suite offline, which R2 requires.
 */
export const RIVAL_GRADE_VARIATION = Object.freeze([
  { expectedCtr: 6, adRelevance: 7, landingPage: 6 },
  { expectedCtr: 7, adRelevance: 6, landingPage: 5 },
  { expectedCtr: 5, adRelevance: 8, landingPage: 7 },
  { expectedCtr: 8, adRelevance: 5, landingPage: 6 },
  { expectedCtr: 6, adRelevance: 6, landingPage: 8 },
  { expectedCtr: 7, adRelevance: 7, landingPage: 4 },
  { expectedCtr: 4, adRelevance: 7, landingPage: 7 },
  { expectedCtr: 9, adRelevance: 4, landingPage: 5 },
  { expectedCtr: 5, adRelevance: 6, landingPage: 9 },
]);

/**
 * @param {string} cell e.g. "premium|lifestyle"
 * @returns {object} a fresh copy, so a caller cannot edit the frozen source
 */
export function adCopyFor(cell) {
  const ad = AD_COPY_BY_CELL[cell];
  if (!ad) throw new RangeError(`no ad copy authored for cell "${cell}"`);
  return structuredClone(ad);
}
