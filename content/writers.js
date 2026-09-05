/**
 * Who writes an advertiser's ad, and what grade that produces (DECISIONS I11).
 *
 * Every advertiser makes the same choice at round 0: hire someone, or write it
 * yourself. Hiring is immediate and guaranteed and capped; writing it yourself
 * is delayed, uncapped to the offline grader's ceiling, and only as good as
 * what you actually wrote.
 *
 * WHY A TIER SETS A LEVEL AND NOT A GRADE
 *
 * If a tier simply set both copy components, every advertiser who bought the
 * same tier would end up with `expectedCtr === adRelevance`, and the eight
 * rivals would collapse onto three identical shapes. `content/adCopy.js` exists
 * to prevent exactly that: its grades are "deliberately uneven and deliberately
 * uncorrelated with position", because "above average" needs a field to be
 * above, and nine equal ad ranks hand one advertiser every top slot.
 *
 * So the tier sets the LEVEL and the advertiser's own character sets the SHAPE.
 * A rival that has always leaned on sharp copy still does, at whatever level it
 * paid for.
 */

import { WRITER_TIERS } from '../engine/constants.js';

/** The lowest and highest grade any component may take. */
const GRADE_MIN = 1;
const GRADE_MAX = 10;

const clampGrade = (n) => Math.max(GRADE_MIN, Math.min(GRADE_MAX, Math.round(n)));

/**
 * One tier by id.
 *
 * @param {string} id one of WRITER_TIERS
 * @returns {object} the frozen tier
 * @throws {RangeError} on an unknown id, rather than quietly returning DIY —
 *   a typo that silently downgraded an advertiser to "writes its own" would be
 *   invisible in every number it produced.
 */
export function writerTier(id) {
  const tier = WRITER_TIERS.find((t) => t.id === id);
  if (!tier) throw new RangeError(`unknown writer tier "${id}"`);
  return tier;
}

/** Is this the tier where the advertiser writes its own copy? */
export const isDiy = (id) => writerTier(id).grade === null;

/**
 * The copy grades a hired tier produces for one advertiser.
 *
 * `bias` is the advertiser's own lean, from `RIVAL_GRADE_VARIATION`: +1 means
 * it has always been better at getting the click than at answering the search,
 * −1 the reverse, 0 balanced. It moves the two components apart around the
 * tier's level without changing their mean, so paying more raises an
 * advertiser without flattening it into everyone else who paid the same.
 *
 * @param {string} tierId
 * @param {number} bias -1, 0 or +1
 * @returns {{expectedCtr: number, adRelevance: number}}
 * @throws {RangeError} if asked for the grades of a tier that writes its own —
 *   there is no grade to give, because the answer is whatever they wrote.
 */
export function hiredCopyGrades(tierId, bias = 0) {
  const tier = writerTier(tierId);
  if (tier.grade === null) {
    throw new RangeError('the diy tier has no grade: grade what was written instead');
  }
  return {
    expectedCtr: clampGrade(tier.grade + bias),
    adRelevance: clampGrade(tier.grade - bias),
  };
}

/**
 * What a tier costs, and what is left of the creative budget after it.
 *
 * @param {string} tierId
 * @param {number} allocationPaise the creative budget
 * @returns {{pricePaise: number, unspentPaise: number}}
 */
export function creativeSpend(tierId, allocationPaise) {
  const { pricePaise } = writerTier(tierId);
  if (pricePaise > allocationPaise) {
    throw new RangeError(`tier "${tierId}" costs more than the creative budget`);
  }
  return { pricePaise, unspentPaise: allocationPaise - pricePaise };
}

/**
 * The tier an advertiser with this character would pick.
 *
 * Rivals choose too, and this is where their choice comes from. It is derived
 * from the policy they already run rather than from a second authored table:
 * a `spender` buys the most expensive thing available, a `cautious` advertiser
 * writes its own, and so on. That keeps the market's spread traceable to
 * characters the player can already read off the six policies.
 *
 * @param {string} policyId
 * @returns {string} a tier id
 */
export function tierForPolicy(policyId) {
  return POLICY_TIERS[policyId] ?? 'freelancer';
}

/**
 * Which character buys what.
 *
 * Spread across the hired tiers so the field is not one level: the grades a
 * market ends up with have to differ, or `reportedScore` has nothing to compare
 * against (L4).
 *
 * NO RIVAL WRITES ITS OWN, and that is a correction rather than an omission.
 * `cautious` used to, and the result was a rival that showed in nothing for
 * twelve rounds: a self-written ad opens on the ungraded 3/3/3 default, which
 * DECISIONS A8 measured as sitting below `AD_RANK_FLOOR` at any cautious bid.
 * A8 is the reason the PLAYER's ad is graded before round 1; dealing rivals a
 * DIY tier recreated the exact condition A8 exists to prevent. It surfaced only
 * when the end screen put all nine advertisers in one table (G3).
 *
 * This is not a privileged player path (R6). Round 0 is asymmetric by
 * construction: the player DECIDES their position, keywords and copy while a
 * rival is CONFIGURED from a seed. Both still go through `creativeBlock`, and
 * nothing in `engine/` branches on who is who. What changed is a configuration
 * choice, the same kind as which keywords a rival opens with.
 *
 * The player may still write their own, because the player is told what it
 * costs and chooses anyway. A rival is not asked.
 */
const POLICY_TIERS = Object.freeze({
  spender: 'retainer',
  grossOptimiser: 'retainer',
  automator: 'agency',
  disciplined: 'agency',
  brandDefender: 'freelancer',
  cautious: 'freelancer',
});

export { POLICY_TIERS };
