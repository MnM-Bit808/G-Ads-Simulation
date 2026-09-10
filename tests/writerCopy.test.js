/**
 * The copy a hired writer delivers (I25).
 *
 * CONTENT IS THE ONE THING IN THIS PROJECT A TEST CANNOT VALIDATE — whether a
 * line reads well, whether it signals its cell, whether the retainer sounds
 * worth ₹50,000 — so this asserts only the things that are mechanical, and
 * asserts all of them. Every one of these has a corresponding bug in the
 * history of `content/adCopy.js`.
 *
 * The one that matters most is the first: a set that fails `validateAdCopy` is
 * a set that leaves the Go button disabled, which is the entire defect this
 * work exists to fix.
 */

import { describe, test, expect } from 'vitest';
import {
  AD_COPY_BY_WRITER, HIRED_TIER_IDS, WRITER_COPY_VARIANTS, writerCopyFor,
} from '../content/writerCopy.js';
import { AD_COPY_BY_CELL } from '../content/adCopy.js';
import { validateAdCopy, namesARival } from '../agents/grader.js';
import { BRAND_IDENTITIES } from '../content/brands.js';
import {
  HEADLINE_MAX_CHARS, DESCRIPTION_MAX_CHARS, PRICE_TIERS, PURPOSES, WRITER_TIERS,
} from '../engine/constants.js';

const NAMES = BRAND_IDENTITIES.map((b) => b.name);

/**
 * The longest brand name, which is the only one worth checking limits against.
 * A headline that fits "Nira" and not "Vella & Co." is a violation that only
 * some games ever show, and 7.5 lets a player pick any of the nine.
 */
const LONGEST = NAMES.reduce((a, b) => (b.length > a.length ? b : a));

/** Every (cell, tier, variant) triple, as the game can actually ask for them. */
const everySet = () => {
  const out = [];
  for (const cell of Object.keys(AD_COPY_BY_WRITER)) {
    for (const tier of HIRED_TIER_IDS) {
      for (let v = 0; v < WRITER_COPY_VARIANTS; v++) {
        out.push({ cell, tier, variant: v, ad: writerCopyFor(cell, tier, LONGEST, v) });
      }
    }
  }
  return out;
};

describe('the table covers what round 0 can ask of it', () => {
  test('every cell of the 3 x 2 grid is present', () => {
    const expected = PRICE_TIERS.flatMap((p) => PURPOSES.map((u) => `${p}|${u}`));
    expect(Object.keys(AD_COPY_BY_WRITER).sort()).toEqual(expected.sort());
  });

  test('every hired tier is present in every cell, and DIY is in none of them', () => {
    const hired = WRITER_TIERS.filter((t) => t.grade !== null).map((t) => t.id);
    const diy = WRITER_TIERS.filter((t) => t.grade === null).map((t) => t.id);
    expect(HIRED_TIER_IDS).toEqual(hired);
    for (const [cell, byTier] of Object.entries(AD_COPY_BY_WRITER)) {
      expect(Object.keys(byTier).sort(), cell).toEqual([...hired].sort());
      for (const id of diy) expect(byTier[id], `${cell} ${id}`).toBeUndefined();
    }
  });

  test('every cell and tier carries the same number of variants', () => {
    for (const [cell, byTier] of Object.entries(AD_COPY_BY_WRITER)) {
      for (const [tier, sets] of Object.entries(byTier)) {
        expect(sets.length, `${cell} ${tier}`).toBe(WRITER_COPY_VARIANTS);
      }
    }
  });

  test('54 sets, which is what covers 9 brands x 6 cells x 3 tiers', () => {
    expect(everySet()).toHaveLength(54);
  });
});

describe('every set is a legal ad, which is the whole point', () => {
  test('all 54 pass validateAdCopy with the longest brand name filled in', () => {
    for (const { cell, tier, variant, ad } of everySet()) {
      const { valid, violations } = validateAdCopy(ad);
      expect(valid, `${cell} ${tier} v${variant}: ${violations.join('; ')}`).toBe(true);
    }
  });

  test('three headlines and two descriptions, matching the boxes round 0 offers', () => {
    for (const { cell, tier, variant, ad } of everySet()) {
      expect(ad.headlines, `${cell} ${tier} v${variant}`).toHaveLength(3);
      expect(ad.descriptions, `${cell} ${tier} v${variant}`).toHaveLength(2);
    }
  });

  test('nothing is blank — an empty box is what blocked the player', () => {
    for (const { cell, tier, variant, ad } of everySet()) {
      for (const line of [...ad.headlines, ...ad.descriptions]) {
        expect(line.trim(), `${cell} ${tier} v${variant}`).not.toBe('');
      }
    }
  });

  test('the two documented Google limits hold for every brand, not just short ones', () => {
    for (const name of NAMES) {
      for (const cell of Object.keys(AD_COPY_BY_WRITER)) {
        for (const tier of HIRED_TIER_IDS) {
          for (let v = 0; v < WRITER_COPY_VARIANTS; v++) {
            const ad = writerCopyFor(cell, tier, name, v);
            for (const h of ad.headlines) {
              expect(h.length, `"${h}" for ${name}`).toBeLessThanOrEqual(HEADLINE_MAX_CHARS);
            }
            for (const d of ad.descriptions) {
              expect(d.length, `"${d}" for ${name}`).toBeLessThanOrEqual(DESCRIPTION_MAX_CHARS);
            }
          }
        }
      }
    }
  });

  test('no set names a rival, which 8.7 penalises adRelevance for', () => {
    for (const { cell, tier, variant, ad } of everySet()) {
      const rivals = NAMES.filter((n) => n !== LONGEST);
      expect(namesARival(ad, rivals), `${cell} ${tier} v${variant}`).toBeFalsy();
    }
  });
});

describe('nothing here reads as a copy of something else', () => {
  test('no line duplicates a rival ad from content/adCopy.js', () => {
    const rivalLines = new Set();
    for (const sets of Object.values(AD_COPY_BY_CELL)) {
      for (const s of sets) for (const l of [...s.headlines, ...s.descriptions]) rivalLines.add(l);
    }
    for (const { cell, tier, variant } of everySet()) {
      // The unfilled template, because `{brand}` never appears in a rival line
      // and filling it would hide a duplicate of one that has no brand in it.
      const raw = AD_COPY_BY_WRITER[cell][tier][variant];
      for (const l of [...raw.headlines, ...raw.descriptions]) {
        expect(rivalLines.has(l), `duplicates a rival ad: "${l}"`).toBe(false);
      }
    }
  });

  test('the three variants of a cell and tier share no line', () => {
    for (const [cell, byTier] of Object.entries(AD_COPY_BY_WRITER)) {
      for (const [tier, sets] of Object.entries(byTier)) {
        const seen = new Set();
        for (const s of sets) {
          for (const l of [...s.headlines, ...s.descriptions]) {
            expect(seen.has(l), `${cell} ${tier} repeats "${l}"`).toBe(false);
            seen.add(l);
          }
        }
      }
    }
  });

  test('a cell\'s three tiers share no headline, so paying more visibly changes it', () => {
    for (const [cell, byTier] of Object.entries(AD_COPY_BY_WRITER)) {
      const seen = new Map();
      for (const [tier, sets] of Object.entries(byTier)) {
        for (const s of sets) {
          for (const h of s.headlines) {
            expect(seen.has(h), `${cell}: ${tier} and ${seen.get(h)} share "${h}"`).toBe(false);
            seen.set(h, tier);
          }
        }
      }
    }
  });
});

describe('the brand name is the only thing that varies by brand', () => {
  test('{brand} appears in every cell and tier, so the ad is never anonymous', () => {
    for (const [cell, byTier] of Object.entries(AD_COPY_BY_WRITER)) {
      for (const [tier, sets] of Object.entries(byTier)) {
        const uses = sets.filter((s) => [...s.headlines, ...s.descriptions]
          .some((l) => l.includes('{brand}')));
        expect(uses.length, `${cell} ${tier}`).toBeGreaterThan(0);
      }
    }
  });

  test('no placeholder survives into the delivered copy', () => {
    for (const name of NAMES) {
      for (const cell of Object.keys(AD_COPY_BY_WRITER)) {
        for (const tier of HIRED_TIER_IDS) {
          const ad = writerCopyFor(cell, tier, name, 0);
          for (const l of [...ad.headlines, ...ad.descriptions]) {
            expect(l, `${cell} ${tier} for ${name}`).not.toContain('{brand}');
          }
        }
      }
    }
  });

  test('two brands differ only where the name goes', () => {
    const a = writerCopyFor('mid|lifestyle', 'retainer', 'Nira', 0);
    const b = writerCopyFor('mid|lifestyle', 'retainer', 'Kestrel', 0);
    const strip = (ad) => [...ad.headlines, ...ad.descriptions]
      .map((l) => l.replace('Nira', '~').replace('Kestrel', '~'));
    expect(strip(a)).toEqual(strip(b));
  });
});

describe('the accessor', () => {
  test('it hands back a fresh object, so one game cannot edit another\'s', () => {
    const first = writerCopyFor('mid|lifestyle', 'retainer', 'Nira', 0);
    first.headlines[0] = 'edited by the player';
    const second = writerCopyFor('mid|lifestyle', 'retainer', 'Nira', 0);
    expect(second.headlines[0]).not.toBe('edited by the player');
  });

  test('variants wrap rather than returning undefined', () => {
    const zero = writerCopyFor('value|performance', 'agency', 'Nira', 0);
    expect(writerCopyFor('value|performance', 'agency', 'Nira', 3)).toEqual(zero);
    expect(writerCopyFor('value|performance', 'agency', 'Nira', -3)).toEqual(zero);
  });

  test('it throws for DIY rather than quietly handing back nothing', () => {
    // Returning empty copy here would reintroduce the exact block this fixes:
    // the boxes stay blank, validateAdCopy fails, the Go button stays disabled,
    // and nothing says why.
    expect(() => writerCopyFor('mid|lifestyle', 'diy', 'Nira', 0)).toThrow(RangeError);
  });

  test('it throws on an unknown cell', () => {
    expect(() => writerCopyFor('mid|luxury', 'retainer', 'Nira', 0)).toThrow(RangeError);
  });
});
