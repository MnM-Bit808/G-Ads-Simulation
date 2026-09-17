/**
 * What the capital cards draw from the page ladder: the chips a target offers,
 * and the page as a drawable shape.
 *
 * The ladder itself — every rung, the sentence it puts on the page, and the
 * description the grader reads — is in content/landingPage.js. It moved there on
 * 2026-09-17 because the weekly loop now re-writes a page from the capital live
 * that week (grade the page as it stands), and game.js reads nothing from ui/.
 * One ladder, so the cards, round 0 and the auction cannot describe a page
 * differently.
 */

import {
  PAGE_FEATURES, COMPOSE_ORDER, stepsFor, tiersFunded, featureAt,
} from '../content/landingPage.js';

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
  for (const step of stepsFor(target)) {
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
