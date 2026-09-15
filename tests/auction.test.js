import { describe, test, expect } from 'vitest';
import { resolveAuction, resolveSlice, adRank, minimumBidToShowPaise } from '../engine/auction.js';
import { mulberry32 } from '../engine/rng.js';
import { AD_RANK_FLOOR, MAX_SLOTS, TOP_SLOTS, MIN_INCREMENT_PAISE } from '../engine/constants.js';

/** Shorthand for an entrant. */
const e = (id, bidPaise, qualitySignal) => ({ id, bidPaise, qualitySignal });

/** Pull one entrant's row out of the ladder. */
const row = (ladder, id) => ladder.find((r) => r.id === id);

describe('adRank', () => {
  test('is bid times quality signal', () => {
    expect(adRank(5000, 0.08)).toBeCloseTo(400, 10);
    expect(adRank(3000, 0.05)).toBeCloseTo(150, 10);
  });

  test('rejects a non-integer bid (R7)', () => {
    expect(() => adRank(50.5, 0.08)).toThrow();
  });

  test('rejects a non-finite or non-positive quality signal', () => {
    expect(() => adRank(5000, 0)).toThrow();
    expect(() => adRank(5000, -0.1)).toThrow();
    expect(() => adRank(5000, Infinity)).toThrow();
    expect(() => adRank(5000, NaN)).toThrow();
  });
});

describe('second price, fully specified (L14, spec 19)', () => {
  // Every value fixed and the answer computed by hand, so this test cannot
  // drift with the constants.
  const ladder = resolveAuction([e('A', 5000, 0.08), e('B', 3000, 0.05)]).ladder;

  test('A takes position 1 on the higher ad rank', () => {
    expect(row(ladder, 'A').adRank).toBeCloseTo(400, 10);
    expect(row(ladder, 'B').adRank).toBeCloseTo(150, 10);
    expect(row(ladder, 'A').position).toBe(1);
    expect(row(ladder, 'B').position).toBe(2);
  });

  test('A pays ceil(150 / 0.08) + 1 = 1876 paise, exactly', () => {
    expect(row(ladder, 'A').cpcPaise).toBe(1876);
  });

  test('the price is an integer number of paise', () => {
    for (const r of ladder) expect(Number.isSafeInteger(r.cpcPaise)).toBe(true);
  });
});

describe('the ladder is complete (L3)', () => {
  test('non-winners are returned, not discarded', () => {
    // With MAX_SLOTS of 4 and six entrants, two must be listed as not shown.
    const entrants = [
      e('a', 9000, 0.10), e('b', 8000, 0.10), e('c', 7000, 0.10),
      e('d', 6000, 0.10), e('e', 5000, 0.10), e('f', 4000, 0.10),
    ];
    const { ladder } = resolveAuction(entrants);
    expect(ladder).toHaveLength(6);
    expect(ladder.filter((r) => r.shown)).toHaveLength(MAX_SLOTS);
    expect(ladder.filter((r) => !r.shown)).toHaveLength(2);
  });

  test('below-floor entrants stay in the ladder so the UI can show them', () => {
    // "Your rival bid but never appeared" is one of the things worth seeing.
    const { ladder } = resolveAuction([
      e('strong', 9000, 0.10),
      e('tooweak', 100, 0.02),
    ]);
    const weak = row(ladder, 'tooweak');
    expect(weak).toBeDefined();
    expect(weak.adRank).toBeLessThan(AD_RANK_FLOOR);
    expect(weak.shown).toBe(false);
    expect(weak.position).toBe(0);
  });

  test('a ladder comes back even when nobody clears the floor', () => {
    const { ladder } = resolveAuction([e('a', 100, 0.02), e('b', 90, 0.02)]);
    expect(ladder).toHaveLength(2);
    expect(ladder.every((r) => !r.shown)).toBe(true);
  });

  test('an empty auction returns an empty ladder rather than throwing', () => {
    expect(resolveAuction([]).ladder).toEqual([]);
  });

  test('the ladder is sorted by ad rank, descending', () => {
    const { ladder } = resolveAuction([
      e('lo', 1000, 0.05), e('hi', 9000, 0.10), e('mid', 5000, 0.06),
    ]);
    for (let i = 1; i < ladder.length; i++) {
      expect(ladder[i - 1].adRank).toBeGreaterThanOrEqual(ladder[i].adRank);
    }
  });

  test('ties break on id, so the ladder is deterministic (R1)', () => {
    const a = resolveAuction([e('zeta', 5000, 0.08), e('alpha', 5000, 0.08)]).ladder;
    const b = resolveAuction([e('alpha', 5000, 0.08), e('zeta', 5000, 0.08)]).ladder;
    expect(a.map((r) => r.id)).toEqual(['alpha', 'zeta']);
    expect(a).toEqual(b);
  });
});

describe('the floor', () => {
  test('below the floor: no impression, no cost', () => {
    const { ladder } = resolveAuction([e('weak', 100, 0.02)]);
    const r = row(ladder, 'weak');
    expect(r.adRank).toBeLessThan(AD_RANK_FLOOR);
    expect(r.shown).toBe(false);
    expect(r.cpcPaise).toBe(0);
  });

  test('a below-floor entrant never takes a slot even when slots are free', () => {
    const { ladder } = resolveAuction([e('ok', 9000, 0.10), e('weak', 100, 0.02)]);
    expect(row(ladder, 'ok').position).toBe(1);
    expect(row(ladder, 'weak').position).toBe(0);
  });

  test('positions 1..TOP_SLOTS are flagged as above the organic results', () => {
    const entrants = Array.from({ length: 6 }, (_, i) => e(`a${i}`, 9000 - i * 500, 0.10));
    const { ladder } = resolveAuction(entrants);
    for (const r of ladder) {
      expect(r.aboveOrganic).toBe(r.shown && r.position <= TOP_SLOTS);
    }
    expect(ladder.filter((r) => r.aboveOrganic)).toHaveLength(TOP_SLOTS);
  });
});

describe('pricing against the entrant below (W8)', () => {
  test('the last shown advertiser prices against the first entrant below, shown or not', () => {
    // With four slots and more entrants than slots, position 4 must price
    // against position 5's ad rank - not against the floor. Pricing against
    // the floor would undercharge exactly when the field is deep, which is
    // when it should be expensive.
    const entrants = [
      e('p1', 20000, 0.10), e('p2', 15000, 0.10), e('p3', 12000, 0.10),
      e('p4', 10000, 0.10), e('p5', 8000, 0.10),
    ];
    const { ladder } = resolveAuction(entrants);
    const fourth = row(ladder, 'p4');
    const fifth = row(ladder, 'p5');

    expect(fourth.position).toBe(4);
    expect(fifth.shown).toBe(false);
    expect(fourth.beatRank).toBeCloseTo(fifth.adRank, 10);
    expect(fourth.cpcPaise).toBe(Math.ceil(fifth.adRank / 0.10) + MIN_INCREMENT_PAISE);
  });

  test('it prices against the floor only when nobody is below at all', () => {
    const { ladder } = resolveAuction([e('only', 9000, 0.10)]);
    const r = row(ladder, 'only');
    expect(r.beatRank).toBe(AD_RANK_FLOOR);
    expect(r.cpcPaise).toBe(Math.ceil(AD_RANK_FLOOR / 0.10) + MIN_INCREMENT_PAISE);
  });

  test('a below-floor rival below you never prices you under the floor', () => {
    // The floor is a reserve. If a weak rival could pull the price beneath it,
    // adding a competitor would LOWER your cost, which is backwards.
    const alone = resolveAuction([e('me', 9000, 0.10)]).ladder;
    const withWeak = resolveAuction([e('me', 9000, 0.10), e('weak', 50, 0.02)]).ladder;
    expect(row(withWeak, 'me').beatRank).toBeGreaterThanOrEqual(AD_RANK_FLOOR);
    expect(row(withWeak, 'me').cpcPaise).toBe(row(alone, 'me').cpcPaise);
  });

  test('every shown entrant prices against the rank directly beneath it', () => {
    const entrants = [
      e('a', 20000, 0.10), e('b', 15000, 0.10), e('c', 12000, 0.10), e('d', 9000, 0.10),
    ];
    const { ladder } = resolveAuction(entrants);
    for (let i = 0; i < ladder.length; i++) {
      const below = ladder[i + 1];
      const expected = below ? Math.max(below.adRank, AD_RANK_FLOOR) : AD_RANK_FLOOR;
      expect(ladder[i].beatRank, ladder[i].id).toBeCloseTo(expected, 10);
    }
  });
});

describe('cpc never exceeds bid', () => {
  test('fuzz: 2000 auctions, no entrant ever pays more than it bid', () => {
    const rand = mulberry32(20260903);
    for (let i = 0; i < 2000; i++) {
      const n = 2 + Math.floor(rand() * 8);
      const entrants = Array.from({ length: n }, (_, k) => e(
        `x${k}`,
        1 + Math.floor(rand() * 20000),
        0.02 + rand() * 0.12,
      ));
      for (const r of resolveAuction(entrants).ladder) {
        expect(r.cpcPaise).toBeLessThanOrEqual(r.bidPaise);
        expect(r.cpcPaise).toBeGreaterThanOrEqual(0);
        expect(Number.isSafeInteger(r.cpcPaise)).toBe(true);
      }
    }
  });

  test('the bid cap binds only on the rounding edge, and it does bind there', () => {
    // Worth knowing why this window is so narrow. Clearing the floor means
    // bid x qs >= floor, so bid >= floor/qs. The price is ceil(floor/qs) + 1,
    // at most floor/qs + 2. So anyone who qualifies to show can almost always
    // afford the price by construction, and the min(bid, ...) cap is a guard
    // against the rounding increment rather than a real economic constraint.
    //
    // The same holds against a live rival: being above them in ad rank implies
    // bid > theirRank/qs, so the price is again within two paise of the bid.
    //
    // bid 858 at qs 0.07: ad rank 60.06 clears the floor of 60, but the floor
    // price is ceil(60/0.07) + 1 = 859. One paise more than was offered.
    const qs = 0.07;
    const bid = Math.ceil(AD_RANK_FLOOR / qs); // 858
    const { ladder } = resolveAuction([e('thin', bid, qs)]);
    const r = row(ladder, 'thin');

    expect(r.adRank).toBeGreaterThanOrEqual(AD_RANK_FLOOR);
    expect(r.shown).toBe(true);
    expect(Math.ceil(AD_RANK_FLOOR / qs) + MIN_INCREMENT_PAISE).toBeGreaterThan(bid);
    expect(r.cpcPaise).toBe(bid);
  });

  test('an ordinary bid comfortably covers its floor price', () => {
    const { ladder } = resolveAuction([e('normal', 5000, 0.10)]);
    const r = row(ladder, 'normal');
    expect(r.cpcPaise).toBe(Math.ceil(AD_RANK_FLOOR / 0.10) + MIN_INCREMENT_PAISE);
    expect(r.cpcPaise).toBeLessThan(5000);
  });
});

describe('quality and price (W1) — the claim, and the caveat', () => {
  // v0.2 asserted "raising quality never raises cpc" as a single monotonic
  // test. That is FALSE, and a correct engine fails it. The truth is two
  // statements pulling in opposite directions, so it takes two tests.

  test('THE CLAIM: at a fixed position, higher quality lowers cpc', () => {
    const field = [e('rival', 1000, 0.10)]; // adRank 100
    let prev = Infinity;
    let seenPositions = new Set();
    for (const qs of [0.02, 0.04, 0.06, 0.08, 0.10, 0.12, 0.14]) {
      const { ladder } = resolveAuction([e('me', 10000, qs), ...field]);
      const me = row(ladder, 'me');
      seenPositions.add(me.position);
      expect(me.cpcPaise, `qs ${qs}`).toBeLessThanOrEqual(prev);
      prev = me.cpcPaise;
    }
    // The comparison is only fair if position never moved.
    expect([...seenPositions]).toEqual([1]);
  });

  test('THE CAVEAT: better quality can lift you into a costlier position', () => {
    // Rivals at 1000, 300 and 100. At qs 0.05 you sit below the 300; at 0.08
    // you climb above it, and now you must outbid a stronger advertiser.
    const field = [e('big', 10000, 0.10), e('mid', 6000, 0.05), e('small', 2000, 0.05)];

    const low = resolveAuction([e('me', 5000, 0.05), ...field]).ladder;
    const high = resolveAuction([e('me', 5000, 0.08), ...field]).ladder;

    expect(row(low, 'me').position).toBe(3);
    expect(row(high, 'me').position).toBe(2);
    expect(row(high, 'me').cpcPaise).toBeGreaterThan(row(low, 'me').cpcPaise);
  });

  test('so what quality actually buys is traffic, not a lower price', () => {
    const field = [e('big', 10000, 0.10), e('mid', 6000, 0.05), e('small', 2000, 0.05)];
    const low = resolveAuction([e('me', 5000, 0.05), ...field]).ladder;
    const high = resolveAuction([e('me', 5000, 0.08), ...field]).ladder;
    expect(row(high, 'me').position).toBeLessThan(row(low, 'me').position);
  });
});

describe('monotonicity in bid', () => {
  test('raising your bid never worsens your position', () => {
    const rand = mulberry32(77);
    const field = Array.from({ length: 5 }, (_, k) => e(
      `r${k}`, 1000 + Math.floor(rand() * 15000), 0.03 + rand() * 0.1,
    ));
    let prev = Infinity;
    for (let bid = 100; bid <= 30000; bid += 500) {
      const { ladder } = resolveAuction([e('me', bid, 0.07), ...field]);
      const me = row(ladder, 'me');
      const rank = me.shown ? me.position : Infinity;
      expect(rank, `bid ${bid}`).toBeLessThanOrEqual(prev);
      prev = rank;
    }
  });

  test('raising your bid never lowers your ad rank', () => {
    let prev = -Infinity;
    for (let bid = 100; bid <= 20000; bid += 700) {
      const r = adRank(bid, 0.07);
      expect(r).toBeGreaterThan(prev);
      prev = r;
    }
  });
});

describe('the field', () => {
  test('removing the advertiser beneath you lowers your price', () => {
    const withRival = resolveAuction([
      e('me', 20000, 0.10), e('under', 12000, 0.10), e('deep', 4000, 0.10),
    ]).ladder;
    const without = resolveAuction([
      e('me', 20000, 0.10), e('deep', 4000, 0.10),
    ]).ladder;
    expect(row(without, 'me').cpcPaise).toBeLessThan(row(withRival, 'me').cpcPaise);
  });

  test('removing an advertiser above you does not change your price', () => {
    // Second price depends only on who is beneath you.
    const withTop = resolveAuction([
      e('top', 30000, 0.10), e('me', 20000, 0.10), e('under', 12000, 0.10),
    ]).ladder;
    const without = resolveAuction([
      e('me', 20000, 0.10), e('under', 12000, 0.10),
    ]).ladder;
    expect(row(without, 'me').cpcPaise).toBe(row(withTop, 'me').cpcPaise);
  });

  test('a deeper field never makes a given position cheaper', () => {
    const rand = mulberry32(303);
    for (let i = 0; i < 200; i++) {
      const base = Array.from({ length: 3 }, (_, k) => e(
        `b${k}`, 2000 + Math.floor(rand() * 8000), 0.04 + rand() * 0.08,
      ));
      const extra = e('extra', 1 + Math.floor(rand() * 6000), 0.04 + rand() * 0.08);
      const me = e('me', 25000, 0.12);

      const thin = row(resolveAuction([me, ...base]).ladder, 'me');
      const deep = row(resolveAuction([me, ...base, extra]).ladder, 'me');
      if (thin.position === deep.position) {
        expect(deep.cpcPaise).toBeGreaterThanOrEqual(thin.cpcPaise);
      }
    }
  });
});

describe('purity (R1)', () => {
  test('the same entrants always give the same ladder', () => {
    const entrants = [e('a', 9000, 0.10), e('b', 5000, 0.07), e('c', 3000, 0.04)];
    expect(resolveAuction(entrants)).toEqual(resolveAuction(entrants));
  });

  test('it does not mutate the entrants it is given', () => {
    const entrants = [e('a', 9000, 0.10), e('b', 5000, 0.07)];
    const before = JSON.stringify(entrants);
    resolveAuction(entrants);
    expect(JSON.stringify(entrants)).toBe(before);
  });

  test('entrant order in the input does not affect the outcome', () => {
    const a = [e('a', 9000, 0.10), e('b', 5000, 0.07), e('c', 3000, 0.04)];
    const b = [e('c', 3000, 0.04), e('a', 9000, 0.10), e('b', 5000, 0.07)];
    expect(resolveAuction(a).ladder).toEqual(resolveAuction(b).ladder);
  });

  test('duplicate ids are rejected rather than silently double-counted', () => {
    expect(() => resolveAuction([e('a', 9000, 0.10), e('a', 5000, 0.07)])).toThrow(/a/);
  });
});

describe('the reserve is visible before a week is spent under it (I12)', () => {
  // AD_RANK_FLOOR is a reserve, not an eligibility gate. An advertiser beneath
  // it enters every auction and shows in none — and reports "lost to rank
  // 100%", which reads as being outbid and sends a player to raise keyword
  // bids. Measured in a played game: target ROAS 25 produced a bid of a couple
  // of rupees and a completely blank week.
  test('a bid at the minimum clears, and one paise under it does not', () => {
    const signal = 0.08;
    const need = minimumBidToShowPaise(signal);
    expect(adRank(need, signal)).toBeGreaterThanOrEqual(AD_RANK_FLOOR);
    expect(adRank(need - 1, signal)).toBeLessThan(AD_RANK_FLOOR);
  });

  test('better quality needs a smaller bid, which is the whole mechanic', () => {
    expect(minimumBidToShowPaise(0.12)).toBeLessThan(minimumBidToShowPaise(0.04));
  });

  test('it agrees with the auction it is describing', () => {
    // The guard that stops this drifting into a second opinion about the floor.
    // Whatever it returns must actually win a slot in resolveAuction, and one
    // paise less must not.
    const signal = 0.05;
    const need = minimumBidToShowPaise(signal);
    const shown = (bidPaise) => resolveAuction([
      { id: 'me', bidPaise, qualitySignal: signal },
    ]).ladder.filter((r) => r.shown);
    expect(shown(need)).toHaveLength(1);
    expect(shown(need - 1)).toHaveLength(0);
  });

  test('it refuses a quality signal that cannot happen', () => {
    expect(() => minimumBidToShowPaise(0)).toThrow(RangeError);
    expect(() => minimumBidToShowPaise(-1)).toThrow(RangeError);
  });
});

/** An entrant in a share of the slice's searches. */
const part = (id, bidPaise, qualitySignal, participation = 1) => ({
  id, bidPaise, qualitySignal, participation,
});

/**
 * The definition, written out plainly: every combination of who is present,
 * resolved by resolveAuction and weighed by how likely it is. resolveSlice
 * must equal this; it only gets there faster.
 */
function everyCombination(entrants) {
  const n = entrants.length;
  const shown = new Array(n).fill(0);
  const positions = new Array(n * MAX_SLOTS).fill(0);
  const cpcSum = new Array(n).fill(0);
  const both = new Array(n * n).fill(0);
  const above = new Array(n * n).fill(0);
  const shownNot = new Array(n * n).fill(0);
  for (let mask = 0; mask < 2 ** n; mask++) {
    let weight = 1;
    const here = [];
    entrants.forEach((entrant, x) => {
      const isIn = (mask >> x) & 1;
      weight *= isIn ? entrant.participation : 1 - entrant.participation;
      if (isIn) here.push({ ...entrant, x });
    });
    if (weight === 0 || here.length === 0) continue;
    const { ladder } = resolveAuction(here);
    const index = new Map(here.map((entrant) => [entrant.id, entrant.x]));
    for (const r of ladder) {
      if (!r.shown) continue;
      const x = index.get(r.id);
      shown[x] += weight;
      positions[x * MAX_SLOTS + r.position - 1] += weight;
      cpcSum[x] += weight * r.cpcPaise;
      for (const other of ladder) {
        if (other.id === r.id) continue;
        const y = index.get(other.id);
        if (other.shown) {
          both[x * n + y] += weight;
          if (other.position < r.position) above[x * n + y] += weight;
        } else {
          shownNot[x * n + y] += weight;
        }
      }
    }
  }
  const cpcPaise = cpcSum.map((sum, x) => (shown[x] > 0 ? sum / shown[x] : 0));
  return { shown, positions, cpcPaise, both, above, shownNot };
}

describe('a throttled advertiser is in only its share of the searches (F17)', () => {
  // Quality signals are powers of two, so every price below is exact.
  const floorPrice = (qualitySignal) => Math.ceil(AD_RANK_FLOOR / qualitySignal) + MIN_INCREMENT_PAISE;

  test('the hand-worked cases below clear the reserve, whatever it is calibrated to', () => {
    // AD_RANK_FLOOR is CALIBRATE and may move. Every case below assumes an ad
    // rank of 125 shows; if the floor passes it, these numbers stop meaning
    // what their names say, so this fails first rather than they pass wrongly.
    expect(adRank(2000, 0.0625)).toBeGreaterThanOrEqual(AD_RANK_FLOOR);
  });

  test('in the searches it stays out of, the rival beneath it keeps the top slot', () => {
    // X outranks Y (ad rank 500 against 125) but takes part in a tenth of the
    // searches. The old ladder put Y second in every one of them.
    const r = resolveSlice([part('X', 4000, 0.125, 0.1), part('Y', 2000, 0.0625)]);
    expect(r.shown[0]).toBeCloseTo(0.1, 12);
    expect(r.positions[0]).toBeCloseTo(0.1, 12);
    expect(r.shown[1]).toBeCloseTo(1, 12);
    expect(r.positions[MAX_SLOTS + 0]).toBeCloseTo(0.9, 12);
    expect(r.positions[MAX_SLOTS + 1]).toBeCloseTo(0.1, 12);
  });

  test('and the rival above it pays its price only in the searches it is in', () => {
    // Y outranks X. A quarter of the time X is beneath it and prices it at
    // 1001; the rest of the time only the reserve does.
    const r = resolveSlice([part('Y', 4000, 0.125), part('X', 2000, 0.0625, 0.25)]);
    const againstX = Math.ceil(125 / 0.125) + MIN_INCREMENT_PAISE;
    expect(r.cpcPaise[0]).toBeCloseTo(0.25 * againstX + 0.75 * floorPrice(0.125), 9);
    expect(r.cpcPaise[1]).toBeCloseTo(floorPrice(0.0625), 9);
    expect(r.positions[MAX_SLOTS + 1]).toBeCloseTo(0.25, 12);
  });

  test('Auction Insights counts only the searches both were in', () => {
    // B takes part in half the searches and never clears the reserve.
    expect(adRank(100, 0.25)).toBeLessThan(AD_RANK_FLOOR);
    const r = resolveSlice([part('A', 4000, 0.125), part('B', 100, 0.25, 0.5)]);
    expect(r.shown[1]).toBe(0);
    expect(r.shownNot[0 * 2 + 1]).toBeCloseTo(0.5, 12);
    expect(r.both[0 * 2 + 1]).toBe(0);
  });

  test('it equals every combination resolved by resolveAuction, on random auctions', () => {
    const rng = mulberry32(20260915);
    let worst = 0;
    for (let trial = 0; trial < 300; trial++) {
      const n = 1 + Math.floor(rng() * 9);
      const entrants = Array.from({ length: n }, (_, x) => {
        const roll = rng();
        return part(
          `e${x}`,
          100 + Math.floor(rng() * 4000),
          0.005 + rng() * 0.12,
          // Some in every search, some nearly spent, the rest anywhere between.
          roll < 0.4 ? 1 : roll < 0.5 ? 1e-5 : 1e-3 + rng() * (1 - 2e-3),
        );
      });
      const got = resolveSlice(entrants);
      const want = everyCombination(entrants);
      for (const field of ['shown', 'positions', 'both', 'above', 'shownNot']) {
        want[field].forEach((v, k) => { worst = Math.max(worst, Math.abs(got[field][k] - v)); });
      }
      want.cpcPaise.forEach((v, x) => {
        worst = Math.max(worst, Math.abs(got.cpcPaise[x] - v) / Math.max(1, v));
      });
    }
    expect(worst).toBeLessThan(1e-9);
  });

  test('with everyone in every search it is resolveAuction, exactly', () => {
    const rng = mulberry32(7);
    for (let trial = 0; trial < 200; trial++) {
      const n = 1 + Math.floor(rng() * 9);
      const entrants = Array.from({ length: n }, (_, x) => part(
        `e${x}`, 100 + Math.floor(rng() * 4000), 0.005 + rng() * 0.12,
      ));
      const got = resolveSlice(entrants);
      const { ladder } = resolveAuction(entrants);
      entrants.forEach((entrant, x) => {
        const r = ladder.find((l) => l.id === entrant.id);
        expect(got.shown[x]).toBe(r.shown ? 1 : 0);
        expect(got.cpcPaise[x]).toBe(r.cpcPaise);
        for (let k = 0; k < MAX_SLOTS; k++) {
          expect(got.positions[x * MAX_SLOTS + k]).toBe(r.position === k + 1 ? 1 : 0);
        }
      });
    }
  });

  test('refuses a participation outside (0, 1], and a duplicate id', () => {
    for (const p of [0, -0.1, 1.5, NaN, Infinity]) {
      expect(() => resolveSlice([part('a', 4000, 0.125, p)]), String(p)).toThrow(RangeError);
    }
    expect(() => resolveSlice([part('a', 4000, 0.125), part('a', 2000, 0.125)])).toThrow(/a/);
  });
});
