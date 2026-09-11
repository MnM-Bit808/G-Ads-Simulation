import { describe, test, expect } from 'vitest';
import { QUERY_SET } from '../content/querySet.js';
import { validateQuerySet, homeCell, weeklySearches } from '../engine/querySet.js';
import {
  allCells, parseCell, businessFor, breakEvenCpcPaise,
} from '../engine/positions.js';

const EMPTY_CAPEX = { committed: { sizeGuide: 0, photography: 0, landingPage: 0 }, pending: [] };
import { BRAND_IDS } from '../content/brands.js';
import { TAG_VOCABULARY, QUERY_SET_RULES, BROAD_MATCH_MIN_OVERLAP } from '../engine/constants.js';
import { tagOverlap } from '../engine/matching.js';

const opts = { advertiserIds: [...BRAND_IDS] };
const result = validateQuerySet(QUERY_SET, opts);
const commercial = QUERY_SET.queries.filter((q) => q.intent === 'commercial');

describe('the real query set passes its own validator', () => {
  test('no errors', () => {
    expect(result.errors, JSON.stringify(result.errors, null, 2)).toEqual([]);
  });

  test('no warnings', () => {
    expect(result.warnings, JSON.stringify(result.warnings, null, 2)).toEqual([]);
  });
});

describe('shape', () => {
  test('carries 20 commercial queries in every cell', () => {
    for (const cell of allCells()) {
      const n = commercial.filter((q) => homeCell(q) === cell).length;
      expect(n, cell).toBe(20);
    }
  });

  test('the obvious keywords a player would write have a literal query to match', () => {
    // reportedScore counts only impressions where the query text literally
    // equals the keyword (A4). If the canonical two-word search is missing
    // from the set, the most natural keyword in the market never earns a
    // Quality Score at all, and the whole 9.3 diagnostic is dead for it.
    //
    // Found by running the real set through matching: an exact-match keyword
    // "gym leggings" caught nothing, because every query carried a modifier.
    const OBVIOUS = [
      'gym leggings', 'workout leggings', 'co ord set', 'everyday leggings',
      'seamless leggings', 'compression leggings', 'squat proof leggings',
      'cheap athleisure', 'premium athleisure',
    ];
    const texts = new Set(QUERY_SET.queries.map((q) => q.text));
    const missing = OBVIOUS.filter((t) => !texts.has(t));
    expect(missing, `no literal query for: ${missing.join(', ')}`).toEqual([]);
  });

  test('every cell has a head term short enough to be typed as a keyword', () => {
    // Three words, not two. "cheap gym leggings" is every bit as plausible a
    // keyword as "gym leggings", and holding the Value cells to two would mean
    // contorting the content to satisfy an arbitrary bar.
    for (const cell of allCells()) {
      const short = commercial.filter(
        (q) => homeCell(q) === cell && q.isHeadTerm && q.text.split(' ').length <= 3,
      );
      expect(short.length, cell).toBeGreaterThan(0);
    }
  });

  test('every cell has more head terms than the floor, not exactly the floor', () => {
    // Sitting on a minimum means the next edit breaks it silently.
    for (const cell of allCells()) {
      const heads = commercial.filter((q) => homeCell(q) === cell && q.isHeadTerm).length;
      expect(heads, cell).toBeGreaterThan(QUERY_SET_RULES.minHeadTermsPerCell);
    }
  });

  test('holds one brand query per advertiser and no others', () => {
    const brand = QUERY_SET.queries.filter((q) => q.intent === 'brand');
    expect(brand).toHaveLength(BRAND_IDS.length);
    expect(brand.map((q) => q.brandOwner).sort()).toEqual([...BRAND_IDS].sort());
  });

  test('every brand query names its owner in the text a person would type', () => {
    for (const q of QUERY_SET.queries.filter((x) => x.intent === 'brand')) {
      expect(q.text.toLowerCase(), q.text).toContain(q.brandOwner);
    }
  });
});

describe('tag vocabulary and the set cannot drift apart', () => {
  test('every tag used is in the vocabulary', () => {
    const vocab = new Set(TAG_VOCABULARY);
    for (const q of QUERY_SET.queries) {
      for (const tag of q.tags) expect(vocab.has(tag), `${q.text}: ${tag}`).toBe(true);
    }
  });

  test('every tag in the vocabulary is used by at least one query', () => {
    // An unused tag is dead weight that quietly widens broad match overlap
    // ratios without ever matching anything.
    const used = new Set(QUERY_SET.queries.flatMap((q) => q.tags));
    const unused = TAG_VOCABULARY.filter((t) => !used.has(t));
    expect(unused, `unused tags: ${unused.join(', ')}`).toEqual([]);
  });
});

describe('the traps are actually reachable', () => {
  test('irrelevant traffic clears the volume floor with headroom', () => {
    expect(result.stats.irrelevantShare)
      .toBeGreaterThan(QUERY_SET_RULES.minIrrelevantVolumeShare);
  });

  test('irrelevant queries share vocabulary with commercial ones', () => {
    // If no broad keyword could ever reach them, the waste never happens and
    // the most expensive lesson in the simulation is unreachable.
    const commercialTags = new Set(commercial.flatMap((q) => q.tags));
    for (const q of QUERY_SET.queries.filter((x) => x.intent === 'irrelevant')) {
      const shared = q.tags.filter((t) => commercialTags.has(t));
      expect(shared.length, `"${q.text}" shares no tag with any commercial query`)
        .toBeGreaterThan(0);
    }
  });

  test('informational traffic likewise sits inside reach', () => {
    const commercialTags = new Set(commercial.flatMap((q) => q.tags));
    for (const q of QUERY_SET.queries.filter((x) => x.intent === 'informational')) {
      expect(q.tags.some((t) => commercialTags.has(t)), q.text).toBe(true);
    }
  });
});

describe('territory economics', () => {
  test('the tier split stays near 52/28/20, inside the validator tolerance', () => {
    // No longer exactly 52/28/20. Each CELL's share now tracks 1/break-even
    // rather than each tier being split evenly between its two purposes, which
    // left the lower-break-even cell of each pair short. The tier totals shift
    // slightly as a consequence — to 52.7/27.9/19.4 — and the validator's
    // five-point tolerance is what governs, not the headline figures.
    const { value, mid, premium } = result.stats.tierVolumeShare;
    for (const [tier, share, target] of [
      ['value', value, 0.52], ['mid', mid, 0.28], ['premium', premium, 0.20],
    ]) {
      expect(Math.abs(share - target), tier)
        .toBeLessThan(QUERY_SET_RULES.tierVolumeTolerance);
    }
  });

  test('each cell share tracks the inverse of its break-even', () => {
    // The property that makes the grid fair: territory x break-even roughly
    // equal across all six, so no position is structurally richer than another.
    const products = allCells().map((cell) => {
      const { price, purpose } = parseCell(cell);
      const be = breakEvenCpcPaise(businessFor({ price, purpose }, EMPTY_CAPEX, 1));
      return result.stats.cellVolumeShare[cell] * be;
    });
    const spread = Math.max(...products) / Math.min(...products);
    expect(spread).toBeLessThan(1.2);
  });

  test('every cell clears the volume floor with headroom', () => {
    for (const [cell, share] of Object.entries(result.stats.cellVolumeShare)) {
      expect(share, cell).toBeGreaterThan(QUERY_SET_RULES.minCellVolumeShare);
    }
  });

  test('value territory carries the most searches, premium the fewest', () => {
    // Premium generates ~2.7x Value's margin per thousand searches, so Value
    // must carry roughly 2.7x the volume for the positions to balance at all.
    const { value, premium } = result.stats.tierVolumeShare;
    expect(value / premium).toBeGreaterThan(2.3);
    expect(value / premium).toBeLessThan(3.1);
  });
});

describe('soft and sharp queries behave differently', () => {
  const spread = (q) => {
    const a = Object.values(q.priceAffinity);
    return Math.max(...a) / Math.min(...a);
  };

  test('head terms are contested, long tail is not', () => {
    const heads = commercial.filter((q) => q.isHeadTerm);
    const tail = commercial.filter((q) => !q.isHeadTerm);
    const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(heads.map(spread))).toBeLessThan(avg(tail.map(spread)));
  });

  test('non-territory traffic is neutral, favouring nobody', () => {
    for (const q of QUERY_SET.queries) {
      if (q.intent === 'commercial') continue;
      expect(spread(q), q.text).toBe(1);
    }
  });
});

describe('conversion intent is separate from position fit', () => {
  test('buy-intent queries carry a raised convMultiplier', () => {
    const buyers = commercial.filter((q) => q.tags.includes('buy'));
    expect(buyers.length).toBeGreaterThan(0);
    for (const q of buyers) expect(q.convMultiplier, q.text).toBeGreaterThan(1);
  });

  test('research-intent queries carry a lowered one', () => {
    const researchers = commercial.filter((q) => q.tags.includes('compare'));
    for (const q of researchers) expect(q.convMultiplier, q.text).toBeLessThan(1);
  });

  test('set queries carry a larger basket on average', () => {
    // Averaged, not asserted per query. A price cap can legitimately beat the
    // set effect: "co ord set under 999" is a set AND a small basket, and the
    // ceiling wins. Asserting it universally would force the content to lie.
    const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const sets = commercial.filter((q) => q.tags.includes('co-ord-set'));
    const singles = commercial.filter((q) => !q.tags.includes('co-ord-set'));
    expect(avg(sets.map((q) => q.valueMultiplier)))
      .toBeGreaterThan(avg(singles.map((q) => q.valueMultiplier)));
  });

  test('a price ceiling shrinks the basket even on a set query', () => {
    const capped = commercial.find((q) => q.text === 'co ord set under 999');
    expect(capped.valueMultiplier).toBeLessThan(1);
  });
});

describe('volume composition over the real set', () => {
  test('the week sums to weeklyVolume', () => {
    const total = QUERY_SET.queries.reduce((a, q) => a + weeklySearches(QUERY_SET, q), 0);
    expect(total / QUERY_SET.weeklyVolume).toBeCloseTo(1, 9);
  });

  test('no query is so small it can never be measured', () => {
    // Below roughly 40 searches a week a query cannot produce a usable signal
    // even across the whole game, and it is noise in the report rather than a
    // decision the player could act on.
    for (const q of QUERY_SET.queries) {
      expect(weeklySearches(QUERY_SET, q), q.text).toBeGreaterThan(40);
    }
  });
});

describe('broad match crosses the purpose axis one way, and the game says so (F13)', () => {
  // F13 is ACCEPTED rather than fixed: lifestyle takes top rival in 27 of 30
  // played markets because its broad keywords crowd performance auctions and
  // performance keywords barely reach back. The mechanism is realistic — a
  // casual brand bidding broad on "everyday leggings" does show on "gym
  // leggings" — and the round 0 briefing now warns that activewear searches are
  // the most contested. That warning is only true while this asymmetry exists,
  // so it is pinned from BOTH sides: growing silently would widen a gap the
  // ledger records at one size, and vanishing silently would leave the briefing
  // telling the player something false.
  //
  // Measured on the content alone, every commercial row bid on as a broad
  // keyword, with the engine's own overlap rule: how much of the OTHER purpose's
  // volume its keywords reach. Instant, where the played-market figure takes 30
  // whole games.
  const byPurpose = (p) => commercial.filter((q) => homeCell(q)?.endsWith(p));
  const volumeOf = (qs) => qs.reduce((a, q) => a + q.volumeShareBp, 0);
  const reach = (from, to) => {
    let reached = 0;
    let viaLeggingsAlone = 0;
    for (const k of byPurpose(from)) {
      for (const q of byPurpose(to)) {
        if (tagOverlap(k.tags, q.tags) < BROAD_MATCH_MIN_OVERLAP) continue;
        reached += q.volumeShareBp;
        const shared = k.tags.filter((t) => q.tags.includes(t));
        if (shared.length === 1 && shared[0] === 'leggings') viaLeggingsAlone += q.volumeShareBp;
      }
    }
    return { times: reached / volumeOf(byPurpose(to)), leggingsShare: viaLeggingsAlone / reached };
  };
  const intoPerformance = reach('lifestyle', 'performance');
  const intoLifestyle = reach('performance', 'lifestyle');

  test('lifestyle keywords reach performance searches about 1.7x as far as the reverse', () => {
    // 5.27x of performance volume against 3.10x of lifestyle's, on 2026-09-12.
    const ratio = intoPerformance.times / intoLifestyle.times;
    expect(ratio, `ratio ${ratio.toFixed(2)}`).toBeGreaterThan(1.5);
    expect(ratio, `ratio ${ratio.toFixed(2)}`).toBeLessThan(1.9);
  });

  test('and one word carries most of it: "leggings", which lives in activewear', () => {
    // A two-tag lifestyle keyword — "everyday leggings", "designer leggings" —
    // needs one shared tag, and "leggings" alone reaches every activewear
    // leggings search. Half the crossing is that single word. If this stops
    // being true, the mechanism F13 describes has changed and the entry needs
    // re-reading before anything else.
    expect(intoPerformance.leggingsShare).toBeGreaterThan(0.4);
    const rows = (p) => byPurpose(p).filter((q) => q.tags.includes('leggings')).length;
    expect(rows('performance')).toBeGreaterThan(2 * rows('lifestyle'));
  });
});

describe('the set is frozen', () => {
  test('QUERY_SET cannot be mutated at runtime', () => {
    expect(Object.isFrozen(QUERY_SET)).toBe(true);
  });
});
