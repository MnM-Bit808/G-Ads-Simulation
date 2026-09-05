/**
 * Who writes the ad (DECISIONS I11).
 *
 * The tier grades were set from measurement over whole games, and the ordering
 * they produce is the whole mechanic. So this file does not assert the numbers
 * — it holds the ordering they exist to create. A balance that lives only in a
 * commit message stops being true the first time anything moves.
 */

import { describe, test, expect } from 'vitest';
import {
  writerTier, isDiy, hiredCopyGrades, creativeSpend, tierForPolicy, POLICY_TIERS,
} from '../content/writers.js';
import { POLICIES, RIVAL_CAST } from '../agents/policies.js';
import {
  WRITER_TIERS, CREATIVE_ALLOCATION_PAISE, CREATIVE_DIY_LIVE_ROUND, PROVENANCE,
} from '../engine/constants.js';

const HIRED = WRITER_TIERS.filter((t) => t.grade !== null);

describe('the tier table is a ladder, not a list', () => {
  test('exactly one tier writes its own copy, and it is free', () => {
    const diy = WRITER_TIERS.filter((t) => t.grade === null);
    expect(diy).toHaveLength(1);
    expect(diy[0].pricePaise).toBe(0);
    expect(isDiy(diy[0].id)).toBe(true);
  });

  test('paying more never buys less', () => {
    for (let i = 1; i < HIRED.length; i++) {
      expect(HIRED[i].pricePaise, HIRED[i].id).toBeGreaterThan(HIRED[i - 1].pricePaise);
      expect(HIRED[i].grade, HIRED[i].id).toBeGreaterThan(HIRED[i - 1].grade);
    }
  });

  test('every tier is affordable, and the best one costs the whole budget', () => {
    // If the top tier were unaffordable it would be decoration; if it cost less
    // than the budget, nothing would ever compete with buying it.
    for (const tier of WRITER_TIERS) {
      expect(tier.pricePaise, tier.id).toBeLessThanOrEqual(CREATIVE_ALLOCATION_PAISE);
    }
    expect(HIRED[HIRED.length - 1].pricePaise).toBe(CREATIVE_ALLOCATION_PAISE);
  });

  test('no hired tier reaches the grader ceiling of 8 by more than matching it', () => {
    // 8 is what the offline grader can award at most, and DECISIONS I10 records
    // why it must not award more. A hired tier above 8 would be claiming a
    // judgement the game has no way to make.
    for (const tier of HIRED) expect(tier.grade, tier.id).toBeLessThanOrEqual(8);
  });

  test('both measured constants are declared, and not as CALIBRATE', () => {
    // CALIBRATE is reserved for the two constants spec 18.2 names, which
    // calibration.test.js governs. These were measured over whole games and are
    // held HERE, so claiming CALIBRATE would name a reader they do not have.
    expect(PROVENANCE.WRITER_TIERS).toBe('ESTIMATED');
    expect(PROVENANCE.CREATIVE_DIY_LIVE_ROUND).toBe('ESTIMATED');
  });
});

describe('an unknown tier throws rather than quietly becoming DIY', () => {
  test('writerTier refuses one', () => {
    expect(() => writerTier('premium')).toThrow(RangeError);
  });

  test('and asking a self-written tier for a grade is an error', () => {
    // There is no grade to give: the answer is whatever they wrote, which only
    // the grader knows. Returning a plausible number here would silently
    // replace a graded ad with a made-up one.
    expect(() => hiredCopyGrades('diy')).toThrow(RangeError);
  });
});

describe('a tier sets the level and the advertiser sets the shape', () => {
  test('the same tier does not give two advertisers the same ad', () => {
    // The failure this split exists to prevent. If a tier set both components,
    // every buyer of that tier would be identical, and adCopy.js is explicit
    // that a flat field makes reportedScore meaningless and ties ad ranks.
    const sharp = hiredCopyGrades('agency', 1);
    const relevant = hiredCopyGrades('agency', -1);
    expect(sharp).not.toEqual(relevant);
    expect(sharp.expectedCtr).toBeGreaterThan(relevant.expectedCtr);
    expect(sharp.adRelevance).toBeLessThan(relevant.adRelevance);
  });

  test('but it does not change what the tier was worth on average', () => {
    for (const tier of HIRED) {
      for (const bias of [-1, 0, 1]) {
        const { expectedCtr, adRelevance } = hiredCopyGrades(tier.id, bias);
        expect((expectedCtr + adRelevance) / 2, `${tier.id} ${bias}`).toBe(tier.grade);
      }
    }
  });

  test('a balanced advertiser gets the tier grade on both components', () => {
    for (const tier of HIRED) {
      expect(hiredCopyGrades(tier.id, 0)).toEqual({
        expectedCtr: tier.grade, adRelevance: tier.grade,
      });
    }
  });

  test('grades stay inside the scale at every tier and bias', () => {
    for (const tier of HIRED) {
      for (const bias of [-1, 0, 1]) {
        for (const value of Object.values(hiredCopyGrades(tier.id, bias))) {
          expect(value).toBeGreaterThanOrEqual(1);
          expect(value).toBeLessThanOrEqual(10);
        }
      }
    }
  });
});

describe('rivals choose too, and the market that results is not flat', () => {
  test('every policy in the cast has a tier', () => {
    for (const policyId of RIVAL_CAST) {
      expect(() => writerTier(tierForPolicy(policyId)), policyId).not.toThrow();
    }
  });

  test('the mapping names only policies that exist', () => {
    // The orphan check this table needs: a tier assigned to a policy nobody
    // runs is a decision with no effect, and a policy with no tier falls
    // through to a default nobody chose.
    for (const policyId of Object.keys(POLICY_TIERS)) {
      expect(POLICIES[policyId], policyId).toBeTypeOf('function');
    }
    expect(Object.keys(POLICY_TIERS).sort()).toEqual([...RIVAL_CAST].sort());
  });

  test('the cast spreads across more than one tier', () => {
    // A market where everyone bought the same thing teaches nothing about the
    // choice, and gives reportedScore nothing to compare against.
    const chosen = new Set(RIVAL_CAST.map(tierForPolicy));
    expect(chosen.size).toBeGreaterThan(2);
  });

  test('and at least one rival writes its own, so DIY is visible in the market', () => {
    expect(RIVAL_CAST.map(tierForPolicy).some(isDiy)).toBe(true);
  });
});

describe('the creative budget', () => {
  test('what is not spent is reported as unspent, to the paise', () => {
    for (const tier of WRITER_TIERS) {
      const { pricePaise, unspentPaise } = creativeSpend(tier.id, CREATIVE_ALLOCATION_PAISE);
      expect(pricePaise + unspentPaise, tier.id).toBe(CREATIVE_ALLOCATION_PAISE);
    }
  });

  test('writing it yourself leaves the whole budget', () => {
    expect(creativeSpend('diy', CREATIVE_ALLOCATION_PAISE).unspentPaise)
      .toBe(CREATIVE_ALLOCATION_PAISE);
  });

  test('a tier that does not fit the budget throws', () => {
    expect(() => creativeSpend('retainer', 1)).toThrow(RangeError);
  });
});

describe('the delay is a delivery date, not a fade-in', () => {
  test('self-written copy lands after the game has started but early in it', () => {
    // Late enough to cost something real, early enough that the player still
    // has most of the game to run with what they wrote.
    expect(CREATIVE_DIY_LIVE_ROUND).toBeGreaterThan(1);
    expect(CREATIVE_DIY_LIVE_ROUND).toBeLessThan(5);
  });
});
