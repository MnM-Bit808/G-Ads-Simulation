import { describe, test, expect } from 'vitest';
import { AD_COPY_BY_CELL, RIVAL_GRADE_VARIATION, adCopyFor } from '../content/adCopy.js';
import { BRAND_IDENTITIES } from '../content/brands.js';
import { allCells } from '../engine/positions.js';
import {
  HEADLINE_MAX_CHARS, DESCRIPTION_MAX_CHARS, ADVERTISER_COUNT,
} from '../engine/constants.js';

const CELLS = allCells();
const all = (pick) => CELLS.flatMap((c) => pick(AD_COPY_BY_CELL[c]));

describe('the shape Google actually allows', () => {
  test('every cell has copy', () => {
    for (const cell of CELLS) expect(AD_COPY_BY_CELL, cell).toHaveProperty(cell);
    expect(Object.keys(AD_COPY_BY_CELL)).toHaveLength(CELLS.length);
  });

  test('headlines fit HEADLINE_MAX_CHARS', () => {
    // The first code in this project to read either limit. Both have been
    // DOCUMENTED constants with no reader since step 1.
    for (const cell of CELLS) {
      for (const headline of AD_COPY_BY_CELL[cell].headlines) {
        expect(headline.length, `${cell}: "${headline}"`)
          .toBeLessThanOrEqual(HEADLINE_MAX_CHARS);
      }
    }
  });

  test('descriptions fit DESCRIPTION_MAX_CHARS', () => {
    for (const cell of CELLS) {
      for (const description of AD_COPY_BY_CELL[cell].descriptions) {
        expect(description.length, `${cell}: "${description}"`)
          .toBeLessThanOrEqual(DESCRIPTION_MAX_CHARS);
      }
    }
  });

  test('three headlines and two descriptions, matching the schema in 5.2', () => {
    for (const cell of CELLS) {
      expect(AD_COPY_BY_CELL[cell].headlines, cell).toHaveLength(3);
      expect(AD_COPY_BY_CELL[cell].descriptions, cell).toHaveLength(2);
      expect(typeof AD_COPY_BY_CELL[cell].landingPageDescription).toBe('string');
    }
  });
});

describe('no cell borrows another cell voice', () => {
  test('every headline is unique across the six', () => {
    const headlines = all((ad) => ad.headlines);
    expect(new Set(headlines).size).toBe(headlines.length);
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
      const text = [...AD_COPY_BY_CELL[cell].headlines, ...AD_COPY_BY_CELL[cell].descriptions]
        .join(' ');
      const namesPrice = /₹\s?\d|%\s?off|save\s?\d/i.test(text);
      expect(namesPrice, `${cell}: ${namesPrice ? 'names' : 'does not name'} a price`)
        .toBe(cell.startsWith('value'));
    }
  });

  test('an offer is a Value signal, and only Value makes one', () => {
    // Correction to the first draft, where value|lifestyle carried the only
    // offer in the set and stood out for the wrong reason. Both Value cells
    // now make one and nobody else does — which is right, because a discount
    // IS a price-tier signal. A premium brand running "buy 2, save 20%" would
    // contradict every other word in its ad.
    for (const cell of CELLS) {
      const text = [...AD_COPY_BY_CELL[cell].headlines, ...AD_COPY_BY_CELL[cell].descriptions]
        .join(' ');
      const offers = /save \d|buy \d|for ₹\d|combo/i.test(text);
      expect(offers, cell).toBe(cell.startsWith('value'));
    }
  });

  test('the second description is not boilerplate shared between cells', () => {
    // It used to be. Both mid cells and both premium cells shared their second
    // line verbatim, which halved the signal available per ad in exactly the
    // two tiers that are hardest to tell apart.
    const seconds = CELLS.map((c) => AD_COPY_BY_CELL[c].descriptions[1]);
    expect(new Set(seconds).size).toBe(CELLS.length);
  });

  test('only Premium names a material', () => {
    // Premium brands signal cost by naming what a thing is made of, never by
    // saying it is expensive.
    const materials = /modal|cashmere|japanese|seamless|yarn|silk|bamboo|recycled/i;
    for (const cell of CELLS) {
      const text = JSON.stringify(AD_COPY_BY_CELL[cell]);
      expect(materials.test(text), cell).toBe(cell.startsWith('premium'));
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

  const textOf = (cell) => JSON.stringify(AD_COPY_BY_CELL[cell]);

  test('a naive classifier recovers the price tier of all six', () => {
    for (const cell of CELLS) {
      const text = textOf(cell);
      const guess = PRICE_TELLS.value.test(text) ? 'value'
        : PRICE_TELLS.premium.test(text) ? 'premium' : 'mid';
      expect(guess, `${cell} read as ${guess}`).toBe(cell.split('|')[0]);
    }
  });

  test('and the purpose of all six', () => {
    for (const cell of CELLS) {
      const text = textOf(cell);
      const performance = PURPOSE_TELLS.performance.test(text);
      const lifestyle = PURPOSE_TELLS.lifestyle.test(text);
      const guess = performance && !lifestyle ? 'performance'
        : lifestyle && !performance ? 'lifestyle' : 'ambiguous';
      expect(guess, `${cell} read as ${guess}`).toBe(cell.split('|')[1]);
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
      expect(AD_COPY_BY_CELL[cell]).not.toHaveProperty('gradedQuality');
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

describe('adCopyFor', () => {
  test('returns a copy a caller cannot write back through', () => {
    const ad = adCopyFor('mid|lifestyle');
    ad.headlines[0] = 'MUTATED';
    expect(AD_COPY_BY_CELL['mid|lifestyle'].headlines[0]).not.toBe('MUTATED');
  });

  test('an unknown cell throws rather than returning a generic ad', () => {
    // A generic fallback is the exact failure 17.1 warns about: if the ads
    // read generically the player can infer nothing.
    expect(() => adCopyFor('budget|sporty')).toThrow(/budget\|sporty/);
  });
});
