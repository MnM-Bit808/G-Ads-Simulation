import { describe, test, expect } from 'vitest';
import { AD_COPY_BY_CELL, RIVAL_GRADE_VARIATION, adCopyFor } from '../content/adCopy.js';
import { BRAND_IDENTITIES, assignIdentities } from '../content/brands.js';
import { placeRivals } from '../setup.js';
import { allCells } from '../engine/positions.js';
import {
  HEADLINE_MAX_CHARS, DESCRIPTION_MAX_CHARS, ADVERTISER_COUNT,
  RIVAL_PLACEMENT_CONSTRAINTS,
} from '../engine/constants.js';

const CELLS = allCells();
// Every cell now holds TWO ads, and every rule below applies to both — the
// second variant exists so that the two rivals 17.1 puts in one cell do not
// run identical copy, and copy that broke a rule would be worse than the
// duplication it replaced.
const adsOf = (cell) => AD_COPY_BY_CELL[cell];
const EVERY_AD = CELLS.flatMap((c) => adsOf(c).map((ad) => ({ cell: c, ad })));
const all = (pick) => EVERY_AD.flatMap(({ ad }) => pick(ad));

/** Content words: what an ad is actually made of, minus the joinery. */
const STOP = new Set(['that', 'with', 'from', 'your', 'this', 'they', 'them', 'when',
  'what', 'have', 'more', 'less', 'both', 'into', 'over', 'each', 'been', 'were',
  'their', 'there', 'which', 'about', 'after', 'every', 'other', 'sizes', 'size']);
const words = (text) => String(text).toLowerCase().split(/[^a-z0-9]+/)
  .filter((w) => w.length > 3 && !STOP.has(w));

describe('the shape Google actually allows', () => {
  test('every cell has copy', () => {
    for (const cell of CELLS) expect(AD_COPY_BY_CELL, cell).toHaveProperty(cell);
    expect(Object.keys(AD_COPY_BY_CELL)).toHaveLength(CELLS.length);
  });

  test('headlines fit HEADLINE_MAX_CHARS', () => {
    // The first code in this project to read either limit. Both have been
    // DOCUMENTED constants with no reader since step 1.
    for (const cell of CELLS) {
      for (const headline of adsOf(cell).flatMap((a) => a.headlines)) {
        expect(headline.length, `${cell}: "${headline}"`)
          .toBeLessThanOrEqual(HEADLINE_MAX_CHARS);
      }
    }
  });

  test('descriptions fit DESCRIPTION_MAX_CHARS', () => {
    for (const cell of CELLS) {
      for (const description of adsOf(cell).flatMap((a) => a.descriptions)) {
        expect(description.length, `${cell}: "${description}"`)
          .toBeLessThanOrEqual(DESCRIPTION_MAX_CHARS);
      }
    }
  });

  test('three headlines and two descriptions, matching the schema in 5.2', () => {
    for (const cell of CELLS) {
      expect(adsOf(cell).length, cell).toBeGreaterThanOrEqual(2);
      for (const ad of adsOf(cell)) {
        expect(ad.headlines, cell).toHaveLength(3);
        expect(ad.descriptions, cell).toHaveLength(2);
        expect(typeof ad.landingPageDescription).toBe('string');
      }
    }
  });
});

describe('no cell borrows another cell voice', () => {
  test('every headline is unique across the six', () => {
    const headlines = all((ad) => ad.headlines);
    expect(new Set(headlines).size).toBe(headlines.length);
  });

  test('no two ads are the same words in a different order', () => {
    // The uniqueness test above compares STRINGS, and a reorder is a different
    // string: "Squat-Proof, Sweat-Wicking" and "Sweat-Wicking, Squat-Proof"
    // both passed it while reading as one ad printed twice. Two rivals in a
    // cell are two of the eight data points 17.1 gives the player, and a
    // paraphrase is one and a half.
    const seen = new Map();
    for (const { cell, ad } of EVERY_AD) {
      for (const headline of ad.headlines) {
        const key = [...new Set(words(headline))].sort().join(' ');
        expect(seen.has(key), `"${headline}" repeats "${seen.get(key)}"`).toBe(false);
        seen.set(key, headline);
      }
      void cell;
    }
  });

  test('the two ads in a cell do not share most of their vocabulary', () => {
    // They must signal the SAME cell by a DIFFERENT route, which is what a real
    // second competitor in a segment looks like. Reaching for the first ad's
    // nouns is the easy failure when writing to a constraint list.
    for (const cell of CELLS) {
      const [a, b] = adsOf(cell).map((ad) => new Set(
        [...ad.headlines, ...ad.descriptions].flatMap(words),
      ));
      const shared = [...a].filter((w) => b.has(w));
      const overlap = shared.length / Math.min(a.size, b.size);
      expect(overlap, `${cell} shares: ${shared.join(', ')}`).toBeLessThan(0.3);
    }
  });

  test('no rival trademark appears in any ad text (spec 8.7)', () => {
    // Bidding on a competitor's brand as a keyword is permitted. Naming them
    // in your ad text is not, and the grader penalises adRelevance when it
    // happens. Rival copy must not itself be in breach.
    const text = JSON.stringify(AD_COPY_BY_CELL).toLowerCase();
    for (const brand of BRAND_IDENTITIES) {
      expect(text.includes(brand.name.toLowerCase()), brand.name).toBe(false);
    }
  });

  test('only Value names a price', () => {
    // Price is the offer at the cheap end and is never mentioned above it.
    // A mid-market or premium ad that led with a number would be signalling
    // the wrong cell.
    for (const cell of CELLS) {
      for (const ad of adsOf(cell)) {
        const text = [...ad.headlines, ...ad.descriptions].join(' ');
        const namesPrice = /₹\s?\d|%\s?off|save\s?\d/i.test(text);
        expect(namesPrice, `${cell}: "${ad.headlines[0]}"`).toBe(cell.startsWith('value'));
      }
    }
  });

  test('an offer is a Value signal, and only Value makes one', () => {
    // Correction to the first draft, where value|lifestyle carried the only
    // offer in the set and stood out for the wrong reason. Both Value cells
    // now make one and nobody else does — which is right, because a discount
    // IS a price-tier signal. A premium brand running "buy 2, save 20%" would
    // contradict every other word in its ad.
    for (const cell of CELLS) {
      for (const ad of adsOf(cell)) {
        const text = [...ad.headlines, ...ad.descriptions].join(' ');
        const offers = /save \d|buy \d|for ₹\d|combo/i.test(text);
        expect(offers, `${cell}: "${ad.headlines[0]}"`).toBe(cell.startsWith('value'));
      }
    }
  });

  test('the second description is not boilerplate shared between cells', () => {
    // It used to be. Both mid cells and both premium cells shared their second
    // line verbatim, which halved the signal available per ad in exactly the
    // two tiers that are hardest to tell apart.
    const seconds = EVERY_AD.map(({ ad }) => ad.descriptions[1]);
    expect(new Set(seconds).size).toBe(seconds.length);
  });

  test('only Premium names a material', () => {
    // Premium brands signal cost by naming what a thing is made of, never by
    // saying it is expensive.
    const materials = /modal|cashmere|japanese|seamless|yarn|silk|bamboo|recycled/i;
    for (const cell of CELLS) {
      for (const ad of adsOf(cell)) {
        expect(materials.test(JSON.stringify(ad)), `${cell}: "${ad.headlines[0]}"`)
          .toBe(cell.startsWith('premium'));
      }
    }
  });
});

describe('position is inferable from the words alone (spec 17.1)', () => {
  // A PROXY, and worth naming as one. If a dumb keyword classifier cannot
  // recover the cell, a human certainly cannot - so failing this means the
  // copy is definitely too generic. Passing it does NOT mean the copy reads
  // well. That still needs a person, which is why the module header says so.
  const PRICE_TELLS = {
    value: /₹\s?\d|save \d|combo|low price|for a lot less/i,
    premium: /modal|cashmere|japanese|seamless|consultation|provenance|outlast/i,
  };
  const PURPOSE_TELLS = {
    performance: /train|squat|sweat|compression|high impact|lifts|gym/i,
    lifestyle: /lounge|co-ord|everyday|all day|studio to street|live in|outfit/i,
  };

  const textOf = (ad) => JSON.stringify(ad);

  test('a naive classifier recovers the price tier of all six', () => {
    for (const { cell, ad } of EVERY_AD) {
      const text = textOf(ad);
      const guess = PRICE_TELLS.value.test(text) ? 'value'
        : PRICE_TELLS.premium.test(text) ? 'premium' : 'mid';
      expect(guess, `"${ad.headlines[0]}" read as ${guess}`).toBe(cell.split('|')[0]);
    }
  });

  test('and the purpose of all six', () => {
    for (const { cell, ad } of EVERY_AD) {
      const text = textOf(ad);
      const performance = PURPOSE_TELLS.performance.test(text);
      const lifestyle = PURPOSE_TELLS.lifestyle.test(text);
      const guess = performance && !lifestyle ? 'performance'
        : lifestyle && !performance ? 'lifestyle' : 'ambiguous';
      expect(guess, `"${ad.headlines[0]}" read as ${guess}`).toBe(cell.split('|')[1]);
    }
  });
});

describe('grades belong to the rival, not to the cell', () => {
  test('there is one grade per advertiser, not one per cell', () => {
    // If premium copy graded 8 and value copy graded 5, position would
    // silently determine ad quality and a cell would carry an economic
    // advantage nobody chose. DECISIONS F6: economics are identical within a
    // cell so that outcome differences trace back to a decision.
    expect(RIVAL_GRADE_VARIATION).toHaveLength(ADVERTISER_COUNT);
    for (const cell of CELLS) {
      for (const ad of adsOf(cell)) expect(ad).not.toHaveProperty('gradedQuality');
    }
  });

  test('every grade is in range, and the field is genuinely uneven', () => {
    for (const grade of RIVAL_GRADE_VARIATION) {
      for (const component of ['expectedCtr', 'adRelevance', 'landingPage']) {
        expect(grade[component], component).toBeGreaterThanOrEqual(1);
        expect(grade[component], component).toBeLessThanOrEqual(10);
      }
    }
    // "Above average" needs a field to be above (L4). Nine identical grades
    // would also tie nine ad ranks and hand one advertiser every top slot.
    for (const component of ['expectedCtr', 'adRelevance', 'landingPage']) {
      const values = RIVAL_GRADE_VARIATION.map((g) => g[component]);
      expect(new Set(values).size, component).toBeGreaterThan(2);
    }
  });

  test('strength is uncorrelated: nobody is best at everything', () => {
    const best = (component) => RIVAL_GRADE_VARIATION
      .indexOf(RIVAL_GRADE_VARIATION.reduce((a, b) => (b[component] > a[component] ? b : a)));
    const winners = new Set(['expectedCtr', 'adRelevance', 'landingPage'].map(best));
    expect(winners.size).toBeGreaterThan(1);
  });
});

describe('no two rivals can run the same ad (spec 17.1)', () => {
  // The guard that was missing. Eight rivals over six cells means two cells
  // double up, and with one ad per cell those pairs ran word for word the same
  // copy: on seed 20260902, Lumen and Auren both said "Seamless Compression
  // Kit". 17.1 makes the ads the ONLY evidence of where anyone sits, so that
  // is not a cosmetic repeat — it is two rivals the player cannot tell apart.
  test('a cell holds at least as many ads as rivals it can hold', () => {
    for (const cell of CELLS) {
      expect(adsOf(cell).length, cell)
        .toBeGreaterThanOrEqual(RIVAL_PLACEMENT_CONSTRAINTS.maxPerCell);
    }
  });

  test('and a whole placed roster runs eight different ads, for any seed', () => {
    for (const seed of [1, 7, 20260902, 424242, 999999]) {
      const identities = assignIdentities(BRAND_IDENTITIES[0].id).rivals;
      const placement = placeRivals(seed, identities.length);
      const seen = {};
      const ads = placement.map((cell) => {
        const variant = seen[cell] ?? 0;
        seen[cell] = variant + 1;
        return JSON.stringify(adCopyFor(cell, variant));
      });
      expect(new Set(ads).size, `seed ${seed}`).toBe(ads.length);
    }
  });
});

describe('adCopyFor', () => {
  test('the variant is what makes two rivals in one cell distinguishable', () => {
    const a = adCopyFor('premium|performance', 0);
    const b = adCopyFor('premium|performance', 1);
    expect(a.headlines).not.toEqual(b.headlines);
    expect(a.descriptions).not.toEqual(b.descriptions);
    expect(a.landingPageDescription).not.toBe(b.landingPageDescription);
  });

  test('and it wraps rather than throwing, if a cell ever held three', () => {
    expect(adCopyFor('mid|lifestyle', 2)).toEqual(adCopyFor('mid|lifestyle', 0));
  });

  test('returns a copy a caller cannot write back through', () => {
    const ad = adCopyFor('mid|lifestyle');
    ad.headlines[0] = 'MUTATED';
    expect(AD_COPY_BY_CELL['mid|lifestyle'][0].headlines[0]).not.toBe('MUTATED');
  });

  test('an unknown cell throws rather than returning a generic ad', () => {
    // A generic fallback is the exact failure 17.1 warns about: if the ads
    // read generically the player can infer nothing.
    expect(() => adCopyFor('budget|sporty')).toThrow(/budget\|sporty/);
  });
});
