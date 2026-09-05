import { describe, test, expect } from 'vitest';
import {
  BRAND_IDENTITIES, BRAND_IDS, POSITION_SIGNALLING_WORDS,
  brandById, assignIdentities, brandNamedIn, brandToken,
} from '../content/brands.js';
import { ADVERTISER_COUNT } from '../engine/constants.js';
import { QUERY_SET } from '../content/querySet.js';

describe('the roster', () => {
  test('holds exactly one identity per advertiser', () => {
    expect(BRAND_IDENTITIES).toHaveLength(ADVERTISER_COUNT);
    expect(BRAND_IDS).toHaveLength(ADVERTISER_COUNT);
  });

  test('ids, names and domains are all unique', () => {
    for (const key of ['id', 'name', 'domain']) {
      const values = BRAND_IDENTITIES.map((b) => b[key].toLowerCase());
      expect(new Set(values).size, `duplicate ${key}`).toBe(values.length);
    }
  });

  test('ids are lowercase slugs, usable as object keys and seed parts', () => {
    for (const b of BRAND_IDENTITIES) {
      expect(b.id, b.id).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  test('every domain is a plausible Indian D2C domain', () => {
    for (const b of BRAND_IDENTITIES) {
      expect(b.domain, b.domain).toMatch(/^[a-z0-9-]+\.in$/);
    }
  });

  test('names are non-empty and human readable', () => {
    for (const b of BRAND_IDENTITIES) {
      expect(b.name.trim()).not.toBe('');
      expect(b.name).toBe(b.name.trim());
    }
  });

  test('the roster is frozen, so nothing can mutate it at runtime', () => {
    expect(Object.isFrozen(BRAND_IDENTITIES)).toBe(true);
    expect(Object.isFrozen(BRAND_IDENTITIES[0])).toBe(true);
  });
});

describe('names must not signal price or purpose (spec 7.5)', () => {
  // Placement is seeded per game, so a name carrying a signal would eventually
  // land in a cell that contradicts it - and since position is meant to be
  // inferable from ad copy, a misleading name poisons that inference.
  test('no name or domain contains a position-signalling word', () => {
    for (const b of BRAND_IDENTITIES) {
      const haystack = `${b.id} ${b.name} ${b.domain}`.toLowerCase();
      for (const word of POSITION_SIGNALLING_WORDS) {
        expect(haystack.includes(word), `"${b.name}" contains "${word}"`).toBe(false);
      }
    }
  });

  test('the guard actually catches a bad name', () => {
    // Proving the rule bites, not merely that it runs. "BudgetBox" is the
    // example from the v0.1 prototype and exactly what 7.5 forbids.
    const bad = { id: 'budgetbox', name: 'BudgetBox', domain: 'budgetbox.in' };
    const haystack = `${bad.id} ${bad.name} ${bad.domain}`.toLowerCase();
    const hits = POSITION_SIGNALLING_WORDS.filter((w) => haystack.includes(w));
    expect(hits).toContain('budget');
  });

  test('it catches a purpose signal too', () => {
    const bad = { id: 'anvil', name: 'Anvil Active', domain: 'anvilactive.in' };
    const haystack = `${bad.id} ${bad.name} ${bad.domain}`.toLowerCase();
    expect(POSITION_SIGNALLING_WORDS.some((w) => haystack.includes(w))).toBe(true);
  });
});

describe('brandById', () => {
  test('returns the identity', () => {
    expect(brandById('vella').name).toBe('Vella & Co.');
  });

  test('throws on an unknown id rather than returning undefined', () => {
    expect(() => brandById('ghostbrand')).toThrow(/ghostbrand/);
  });
});

describe('assignIdentities', () => {
  test('gives the player one and the rivals the rest', () => {
    const { player, rivals } = assignIdentities('satva');
    expect(player.id).toBe('satva');
    expect(rivals).toHaveLength(ADVERTISER_COUNT - 1);
    expect(rivals.map((r) => r.id)).not.toContain('satva');
  });

  test('every id is used exactly once, whoever the player picks', () => {
    for (const id of BRAND_IDS) {
      const { player, rivals } = assignIdentities(id);
      const all = [player.id, ...rivals.map((r) => r.id)].sort();
      expect(all).toEqual([...BRAND_IDS].sort());
    }
  });

  test('rival order follows the roster, so placement stays reproducible (R1)', () => {
    const a = assignIdentities('vella').rivals.map((r) => r.id);
    const b = assignIdentities('vella').rivals.map((r) => r.id);
    expect(a).toEqual(b);
    expect(a).toEqual(BRAND_IDS.filter((x) => x !== 'vella'));
  });

  test('throws when the player picks an identity that does not exist', () => {
    expect(() => assignIdentities('nobody')).toThrow();
  });
});

describe('reading a brand out of a search (spec 3.1, 8.7)', () => {
  // Ownership is INFERRED, never read: `query.brandOwner` is withheld from
  // every viewer (16.1). Identity is public (R3), so the interface works it
  // out the way a player would — read the words, look for a name you know.
  test('it finds the owner of every brand query in the frozen set', () => {
    const brandQueries = QUERY_SET.queries.filter((q) => q.intent === 'brand');
    expect(brandQueries).toHaveLength(BRAND_IDENTITIES.length);
    for (const query of brandQueries) {
      const found = brandNamedIn(query.text, BRAND_IDENTITIES);
      expect(found?.id, query.text).toBe(query.brandOwner);
    }
  });

  test('it matches the word people type, not the registered name', () => {
    // "Vella & Co." owns "vella leggings". Matching the full string finds
    // eight of the nine and silently misses the one whose name runs to more
    // than a word.
    expect(brandNamedIn('vella leggings', BRAND_IDENTITIES)?.id).toBe('vella');
    expect(brandToken('Vella & Co.')).toBe('vella');
  });

  test('a name never matches inside a longer word', () => {
    // `\b`, not ``: inside a template literal a single backslash-b is the
    // BACKSPACE character. The first version of this matched nothing at all,
    // and every brand term on screen rendered unlabelled.
    expect(brandNamedIn('niralamba yoga mats', BRAND_IDENTITIES)).toBeNull();
    expect(brandNamedIn('nira joggers', BRAND_IDENTITIES)?.id).toBe('nira');
  });

  test('an ordinary search names nobody', () => {
    for (const query of QUERY_SET.queries.filter((q) => q.intent !== 'brand')) {
      expect(brandNamedIn(query.text, BRAND_IDENTITIES), query.text).toBeNull();
    }
  });
});
