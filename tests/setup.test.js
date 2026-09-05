import { describe, test, expect } from 'vitest';
import {
  placeRivals, placementIsLegal, briefing, rivalAdsForBriefing, buildRivals,
  startGame, redoRoundZero, canRedoRoundZero, REDO_DEADLINE_ROUND,
} from '../setup.js';
import { playGame, submitRound } from '../game.js';
import { disciplined, controllerFor, RIVAL_CAST } from '../agents/policies.js';
import { writerTier, isDiy } from '../content/writers.js';
import { QUERY_SET } from '../content/querySet.js';
import { BRAND_IDENTITIES, assignIdentities } from '../content/brands.js';
import { AD_COPY_BY_CELL } from '../content/adCopy.js';
import { allCells } from '../engine/positions.js';
import { homeCell } from '../engine/querySet.js';
import {
  ADVERTISER_COUNT, MONTHLY_BUDGET_PAISE,
  ROUNDS_PER_MONTH, PRICE_TIERS, CAPEX_ALLOCATION_PAISE, TAG_VOCABULARY,
  CREATIVE_ALLOCATION_PAISE, CREATIVE_DIY_LIVE_ROUND, DEFAULT_UNGRADED_QUALITY,
} from '../engine/constants.js';

const PLAYER_BRAND = BRAND_IDENTITIES[0].id;
const SEEDS = [1, 7, 42, 20260902, 999983, 12345, 2, 3, 5, 8, 13, 21];

/** A plausible set of round 0 choices: value|performance, a few keywords. */
const choices = (over = {}) => {
  const own = QUERY_SET.queries.filter((q) => homeCell(q) === 'value|performance');
  return {
    position: { price: 'value', purpose: 'performance' },
    keywords: own.slice(0, 5).map((q, i) => ({
      text: q.text, matchType: i === 0 ? 'exact' : 'phrase', bidPaise: 2400,
    })),
    ad: {
      headlines: ['Gym Leggings', 'Squat Proof', 'Free Delivery'],
      descriptions: ['Train hard without overspending.', 'Sizes XS to XXL.'],
      landingPageDescription: 'Category page with a size chart.',
    },
    ...over,
  };
};

const start = (over = {}) => startGame({
  rootSeed: 20260902, playerBrandId: PLAYER_BRAND, player: choices(), querySet: QUERY_SET, ...over,
});

describe('every advertiser chose who writes its ad (DECISIONS I11)', () => {
  // Hard rule 6: one advertiser type. The player picks a writer tier at round 0
  // and so does every rival, by the same table and through the same functions.
  // A rival that skipped the choice would be a privileged path in the one place
  // 17.1 says the player can actually SEE a rival.

  test('every advertiser has a creative block naming a real tier', () => {
    for (const a of start().advertisers) {
      expect(a.creative, a.id).toBeTruthy();
      expect(() => writerTier(a.creative.tier), a.id).not.toThrow();
    }
  });

  test('a hired ad is live from round 1 and graded at its tier', () => {
    for (const a of start().advertisers.filter((x) => !isDiy(x.creative.tier))) {
      const tier = writerTier(a.creative.tier);
      const graded = a.adGroups[0].gradedQuality;
      expect(a.creative.pendingGrade, a.id).toBeNull();
      // The bias moves the two apart; their mean is what the tier bought.
      expect((graded.expectedCtr + graded.adRelevance) / 2, a.id).toBe(tier.grade);
    }
  });

  test('a self-written ad runs weak until it lands, then becomes what was written', () => {
    const diy = start().advertisers.filter((a) => isDiy(a.creative.tier));
    expect(diy.length, 'nobody writes their own, so the mechanic is unreachable')
      .toBeGreaterThan(0);
    for (const a of diy) {
      expect(a.creative.liveAtRound, a.id).toBe(CREATIVE_DIY_LIVE_ROUND);
      expect(a.creative.pendingGrade, a.id).toBeTruthy();
      // Until it lands they run the ungraded default (9.5, DECISIONS A8) —
      // which is the cost of writing it yourself, and the whole reason hiring
      // is worth anything.
      expect(a.adGroups[0].gradedQuality.expectedCtr, a.id)
        .toBe(DEFAULT_UNGRADED_QUALITY.expectedCtr);
      expect(a.creative.pendingGrade.expectedCtr, a.id)
        .toBeGreaterThan(DEFAULT_UNGRADED_QUALITY.expectedCtr);
    }
  });

  test('what a tier cost comes out of the creative budget, and the rest is not lost', () => {
    for (const a of start().advertisers) {
      const { pricePaise } = writerTier(a.creative.tier);
      expect(a.creative.spentPaise, a.id).toBe(pricePaise);
      expect(a.creative.unspentPaise, a.id).toBe(CREATIVE_ALLOCATION_PAISE - pricePaise);
    }
  });

  test('what the writer did not cost is advertising money instead', () => {
    // The rollover, and it is load-bearing rather than tidy. Writing it
    // yourself is slower AND lower-ceilinged; the whole budget staying in the
    // account is what pays for that, and without it the top tier simply
    // dominates — measured at 20% ahead of a perfectly written self-made ad.
    //
    // Unlike capital, this needs no allocation round: the writer is chosen at
    // round 0, so the money is in the budget from round 1.
    for (const a of start().advertisers) {
      expect(a.campaign.monthlyBudgetPaise, a.id)
        .toBe(MONTHLY_BUDGET_PAISE + a.creative.unspentPaise);
    }
  });

  test('and the weekly split still adds up to the month it belongs to', () => {
    // allocate() spreads the real total, so a split that summed to the old
    // budget would quietly under-spend every week of month one.
    for (const a of start().advertisers) {
      const split = a.campaign.weeklySplitPaise;
      expect(split.reduce((x, y) => x + y, 0), a.id).toBe(a.campaign.monthlyBudgetPaise);
    }
  });

  test('hiring the top tier leaves nothing over, writing your own leaves it all', () => {
    const advertisers = start().advertisers;
    const top = advertisers.find((a) => a.creative.tier === 'retainer');
    const own = advertisers.find((a) => isDiy(a.creative.tier));
    expect(top.campaign.monthlyBudgetPaise).toBe(MONTHLY_BUDGET_PAISE);
    expect(own.campaign.monthlyBudgetPaise)
      .toBe(MONTHLY_BUDGET_PAISE + CREATIVE_ALLOCATION_PAISE);
  });

  test('the field does not all buy the same thing', () => {
    // The reason rivals choose at all. A market where every ad is the same
    // level gives reportedScore nothing to compare against (L4).
    const tiers = new Set(start().advertisers.slice(1).map((a) => a.creative.tier));
    expect(tiers.size).toBeGreaterThan(2);
  });

  test('and buying the same tier does not produce the same ad', () => {
    // The level/shape split. Two rivals on one tier must still differ, or the
    // field flattens exactly where adCopy.js says it must not.
    const byTier = new Map();
    for (const a of start().advertisers.slice(1).filter((x) => !isDiy(x.creative.tier))) {
      const list = byTier.get(a.creative.tier) ?? [];
      list.push(a.adGroups[0].gradedQuality);
      byTier.set(a.creative.tier, list);
    }
    const shared = [...byTier.values()].find((list) => list.length > 1);
    expect(shared, 'no tier has two buyers, so this cannot be checked').toBeTruthy();
    const shapes = new Set(shared.map((g) => `${g.expectedCtr}|${g.adRelevance}`));
    expect(shapes.size).toBeGreaterThan(1);
  });
});

describe('every rival carries the policy it will actually run', () => {
  // `buildRival` set `policyId: null` with the comment "the caller assigns a
  // policy", and the ONLY caller that did was ui/app.js — which assigned by
  // index and never wrote the id back to state. So `advertiser.policyId` was
  // null in every real game, and `controllerFor`, which exists precisely to
  // turn that id into a controller, had no reader outside the tests.
  //
  // That is not cosmetic. A harness written the obvious way —
  //   controllers[a.id] = a.policyId ? controllerFor(a.policyId) : () => null
  // — silently gives every rival a no-op controller and measures a market that
  // never bids back. Several measurements in this project were taken that way
  // before anyone noticed, because a dead field still produces plausible
  // numbers. Assigning the id at construction makes the field live by default
  // rather than by the caller remembering.

  test('no advertiser but the player is left without one', () => {
    for (const seed of SEEDS) {
      const state = start({ rootSeed: seed });
      const [player, ...rivals] = state.advertisers;
      expect(player.policyId).toBeNull();
      for (const rival of rivals) {
        expect(rival.policyId, `${seed} ${rival.id}`).toBeTruthy();
      }
    }
  });

  test('and every id names a policy that exists', () => {
    for (const rival of start().advertisers.slice(1)) {
      expect(() => controllerFor(rival.policyId)).not.toThrow();
      expect(typeof controllerFor(rival.policyId)).toBe('function');
    }
  });

  test('every character is in the market, so the field is not one policy', () => {
    // The cast exists because five of the six are each wrong about one thing in
    // a legible way. A market of eight identical policies teaches nothing.
    const used = new Set(start().advertisers.slice(1).map((a) => a.policyId));
    expect(used.size).toBe(RIVAL_CAST.length);
  });

  test('the assignment is the seeded market, not an accident of ordering', () => {
    const first = start({ rootSeed: 7 }).advertisers.map((a) => a.policyId);
    const again = start({ rootSeed: 7 }).advertisers.map((a) => a.policyId);
    expect(first).toEqual(again);
  });
});

describe('rival placement (spec 17.1)', () => {
  test('satisfies RIVAL_PLACEMENT_CONSTRAINTS for any seed', () => {
    // The test spec 19 names and that RIVAL_PLACEMENT_CONSTRAINTS existed for
    // years without: the constant sat in constants.js with a provenance entry
    // and no reader at all.
    for (const seed of SEEDS) {
      const placement = placeRivals(seed);
      const legal = placementIsLegal(placement);
      expect(legal.valid, `seed ${seed}: ${legal.reason}`).toBe(true);
    }
  });

  test('places one rival per remaining identity', () => {
    for (const seed of SEEDS) {
      expect(placeRivals(seed)).toHaveLength(ADVERTISER_COUNT - 1);
    }
  });

  test('the same seed always yields the same market (R1)', () => {
    for (const seed of SEEDS) {
      expect(placeRivals(seed)).toEqual(placeRivals(seed));
    }
  });

  test('and different seeds do not all yield the same one', () => {
    const shapes = new Set(SEEDS.map((s) => placeRivals(s).join(',')));
    expect(shapes.size).toBeGreaterThan(1);
  });

  test('at least two cells double up, and at most one is left open', () => {
    // Eight rivals over six cells with at most two per cell. The arithmetic is
    // forced, and 17.1 leans on it: an open cell has to be POSSIBLE for
    // "taking an open cell is a legitimate strategy" to mean anything.
    for (const seed of SEEDS) {
      const placement = placeRivals(seed);
      const occupied = new Set(placement);
      expect(occupied.size).toBeGreaterThanOrEqual(allCells().length - 1);
      const doubled = [...occupied].filter((c) => placement.filter((x) => x === c).length === 2);
      expect(doubled.length, `seed ${seed}`).toBeGreaterThanOrEqual(2);
    }
  });

  test('an open cell does turn up across seeds', () => {
    const anyOpen = SEEDS.some((s) => new Set(placeRivals(s)).size < allCells().length);
    expect(anyOpen).toBe(true);
  });

  test('placementIsLegal actually rejects an illegal placement', () => {
    // Mutation-tested, or the guard above proves nothing.
    expect(placementIsLegal(new Array(8).fill('value|performance')).valid).toBe(false);
    expect(placementIsLegal(['value|performance', 'value|lifestyle']).valid).toBe(false);
    const oneTier = ['value|performance', 'value|lifestyle', 'value|performance'];
    expect(placementIsLegal(oneTier).valid).toBe(false);
  });
});

describe('rivals are built from their cell (spec 17.1)', () => {
  const state = start();
  const rivals = state.advertisers.slice(1);

  test('there are eight, with the eight identities the player did not take', () => {
    expect(rivals).toHaveLength(ADVERTISER_COUNT - 1);
    const ids = rivals.map((r) => r.id);
    expect(ids).not.toContain(PLAYER_BRAND);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('each wears the ad copy of the cell it landed in', () => {
    // The entire round 0 mechanic. Position is never stated, only inferable,
    // and this is the only thing it is inferable FROM.
    for (const rival of rivals) {
      const cell = `${rival.position.price}|${rival.position.purpose}`;
      const authored = AD_COPY_BY_CELL[cell].map((ad) => ad.headlines);
      expect(authored, rival.id).toContainEqual(rival.adGroups[0].ad.headlines);
    }
  });

  test('the briefing shows the ads the game will actually use', () => {
    // round 0's screen and startGame used to build the roster with two
    // separate loops. Adding the ad variant to one made the briefing show an
    // ad the player would never meet - a worse bug than the duplication it
    // was fixing. buildRivals is now the only way to build a roster.
    const { rivals: identities } = assignIdentities(PLAYER_BRAND);
    const placement = placeRivals(20260902, identities.length);
    const shown = buildRivals(identities, placement, QUERY_SET, () => 0.5);
    for (const [i, rival] of shown.entries()) {
      expect(rival.adGroups[0].ad, rival.id).toEqual(rivals[i].adGroups[0].ad);
    }
  });

  test('and no two of them wear the SAME ad', () => {
    // Two rivals share a cell whenever eight are placed over six, and with one
    // ad per cell they ran word for word the same copy - two of the player's
    // eight pieces of evidence saying nothing.
    const ads = rivals.map((r) => JSON.stringify(r.adGroups[0].ad));
    expect(new Set(ads).size).toBe(ads.length);
  });

  test('each holds keywords in its own territory', () => {
    for (const rival of rivals) {
      const cell = `${rival.position.price}|${rival.position.purpose}`;
      const texts = new Set(QUERY_SET.queries.filter((q) => homeCell(q) === cell).map((q) => q.text));
      for (const keyword of rival.adGroups[0].keywords) {
        expect(texts.has(keyword.text), `${rival.id}: ${keyword.text}`).toBe(true);
      }
    }
  });

  test('every rival starts cold, exactly like the player', () => {
    // Seeding rivals with plausible history would make them competent from
    // round 1 and hand them an advantage the player cannot see or attribute.
    // The cold-start error (12.2) is one of the things the sim exists to teach,
    // so everybody pays it.
    for (const rival of rivals) {
      expect(rival.bidding.observedConvRate, rival.id).toBeNull();
      expect(rival.bidding.observedConversions, rival.id).toBe(0);
      expect(rival.bidding.observedClicks, rival.id).toBe(0);
      expect(rival.qualityHistory, rival.id).toEqual({});
    }
  });

  test('their grades travel with the brand, not with the cell', () => {
    // If premium copy graded 8 and value copy graded 5, position would silently
    // determine ad quality and a cell would carry an advantage nobody chose.
    const byCell = {};
    for (const rival of rivals) {
      const cell = `${rival.position.price}|${rival.position.purpose}`;
      (byCell[cell] ??= []).push(rival.adGroups[0].gradedQuality.expectedCtr);
    }
    const doubled = Object.values(byCell).filter((g) => g.length > 1);
    expect(doubled.length).toBeGreaterThan(0);
    expect(doubled.some((g) => new Set(g).size > 1)).toBe(true);
  });

  test('capex is seeded and tilted, so some of them get it wrong', () => {
    // D7: Value should invest, Premium often should not. The draw is tilted
    // that way and still random, because a market where every rival invests
    // correctly demonstrates the lesson instead of leaving it discoverable.
    const invested = (r) => Object.values(r.capex.committed).some((p) => p > 0);
    const across = SEEDS.slice(0, 8).flatMap((seed) =>
      start({ rootSeed: seed }).advertisers.slice(1));

    const value = across.filter((r) => r.position.price === 'value');
    const premium = across.filter((r) => r.position.price === 'premium');
    expect(value.length).toBeGreaterThan(0);
    expect(premium.length).toBeGreaterThan(0);

    const rate = (list) => list.filter(invested).length / list.length;
    expect(rate(value), 'value should invest more often than premium')
      .toBeGreaterThan(rate(premium));
    // And not unanimously, either way.
    expect(across.some(invested)).toBe(true);
    expect(across.some((r) => !invested(r))).toBe(true);
  });

  test('a rival that declined keeps the money as ad budget', () => {
    for (const rival of rivals) {
      const invested = Object.values(rival.capex.committed).reduce((a, b) => a + b, 0);
      const rolled = rival.capex.remainingUnallocatedPaise;
      expect(invested + rolled, rival.id).toBe(CAPEX_ALLOCATION_PAISE);
    }
  });
});

describe('the briefing shows research and withholds experience (spec 17.2)', () => {
  const brief = briefing(QUERY_SET);

  test('weekly volume by tier, which Keyword Planner would give you', () => {
    const total = Object.values(brief.weeklySearchesByTier).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(QUERY_SET.weeklyVolume, -3);
    expect(brief.weeklySearchesByTier.value)
      .toBeGreaterThan(brief.weeklySearchesByTier.premium);
  });

  test('order values and margins for all three tiers', () => {
    for (const price of PRICE_TIERS) {
      expect(brief.economicsByTier[price].aovMeanPaise).toBeGreaterThan(0);
      expect(brief.economicsByTier[price].marginPct).toBeGreaterThan(0);
    }
  });

  test('one fully worked anchor, with its arithmetic visible', () => {
    const a = brief.workedAnchor;
    expect(a.tier).toBe('mid');
    const recomputed = Math.round(a.aovMeanPaise * a.marginPct * a.retentionPct * a.convRate);
    expect(a.resultPaise).toBe(recomputed);
    expect(a.arithmetic).toContain('26.56');
  });

  test('and the sentence 17.2 says is not optional', () => {
    // The anchor is the NEUTRAL-QUERY figure and every real ceiling is about
    // 2.4x it. A player handed 26.56 with no warning bids 26.56, loses every
    // auction, and concludes the arithmetic they were taught is broken.
    expect(brief.workedAnchor.caveat).toMatch(/roughly double/i);
    expect(brief.workedAnchor.caveat).toMatch(/choose to compete for/i);
  });

  test('the month 3 ranking rule, stated in full', () => {
    expect(brief.rankingRule.metric).toMatch(/gross profit/i);
    expect(brief.rankingRule.metric).toMatch(/as reported at round 8/i);
    expect(brief.rankingRule.multipliers).toHaveLength(ADVERTISER_COUNT);
  });

  test('conversion and return rates are hints, never numbers', () => {
    const text = JSON.stringify(brief.hints);
    expect(text).toMatch(/cheaper products convert more often/i);
    expect(text).not.toMatch(/0\.042|4\.2%|0\.016|1\.6%/);
  });

  test('nothing in it leaks 4.2, 4.3 or the affinities', () => {
    const text = JSON.stringify(brief);
    for (const forbidden of [
      'convRateBase', 'returnRate', 'priceAffinity', 'purposeAffinity',
      'convMultiplier', 'valueMultiplier', 'returnRateMultiplier', 'PURPOSE_MODIFIERS',
    ]) {
      expect(text, forbidden).not.toContain(forbidden);
    }
    // Nor Value's or Premium's conversion rate as a bare number.
    expect(text).not.toContain('0.042');
    expect(text).not.toContain('0.016');
  });

  test('the rival ads are shown unordered and without their cells', () => {
    const state = start();
    const ads = rivalAdsForBriefing(state.advertisers.slice(1), state.rootSeed);
    expect(ads).toHaveLength(ADVERTISER_COUNT - 1);
    for (const ad of ads) {
      expect(ad).not.toHaveProperty('position');
      expect(ad).not.toHaveProperty('cell');
      expect(ad.headlines.length).toBeGreaterThan(0);
    }
  });
});

describe('startGame produces a game that runs (spec 17)', () => {
  const state = start();

  test('nine advertisers, the player at index 0 by convention', () => {
    expect(state.advertisers).toHaveLength(ADVERTISER_COUNT);
    expect(state.advertisers[0].id).toBe(PLAYER_BRAND);
    expect(state.advertisers[0].controller).toBe('player');
  });

  test('it starts at round 1 with nothing behind it', () => {
    expect(state.round).toBe(1);
    expect(state.history).toEqual([]);
    expect(state.decisionLog).toEqual([]);
  });

  test('a round runs on it, and the market is alive', async () => {
    const { reports } = await playGame(
      state,
      Object.fromEntries(state.advertisers.map((a) => [a.id, disciplined])),
      { mode: 'expected', rounds: 2 },
    );
    expect(reports).toHaveLength(2);
    const spend = Object.values(reports[0].byAdvertiser)
      .reduce((a, r) => a + r.traffic.costPaise, 0);
    expect(spend).toBeGreaterThan(0);
  });

  test('the player keywords are tagged, per step 12', () => {
    // The other half of "grade + tag player assets". Untagged is a safe
    // degradation (8.4) and it was still an asymmetry: every rival is tagged at
    // placement, so broad match worked for eight advertisers and not the ninth,
    // in a game about match types.
    for (const keyword of state.advertisers[0].adGroups[0].keywords) {
      expect(keyword.tags.length, keyword.text).toBeGreaterThan(0);
      expect(keyword.taggedContentHash, keyword.text).toMatch(/^h53:/);
      for (const tag of keyword.tags) expect(TAG_VOCABULARY).toContain(tag);
    }
  });

  test('so the player can use broad match, like every rival can', () => {
    const broad = start({ player: choices({
      keywords: choices().keywords.map((k) => ({ ...k, matchType: 'broad' })),
    }) });
    const out = submitRound(broad, {}, { mode: 'expected' });
    const mine = out.report.byAdvertiser[PLAYER_BRAND];
    // Broad reaches further than the phrase baseline. Untagged, it reached
    // nothing at all and this would be zero.
    expect(mine.traffic.eligibleAuctions)
      .toBeGreaterThan(submitRound(state, {}, { mode: 'expected' })
        .report.byAdvertiser[PLAYER_BRAND].traffic.eligibleAuctions);
  });

  test('the player is graded before round 1, per step 12', () => {
    // Round 0's last step is "grade + tag player assets -> round 1", and it is
    // not optional. Leaving gradedQuality null is not neutral: DECISIONS A8
    // measured that an ungraded ad grades 3/3/3, which sits below
    // AD_RANK_FLOOR at any cautious bid, so the player would enter every
    // auction and show in none.
    const graded = state.advertisers[0].adGroups[0].gradedQuality;
    expect(graded).not.toBeNull();
    expect(graded.gradedAtRound).toBe(0);
    expect(graded.contentHash).toMatch(/^h53:/);
    expect(graded.source).toBe('heuristic');
  });

  test('graded offline, so round 0 completes without an API key (R2)', () => {
    // The grader takes its transport as an argument. Round 0 supplies none, so
    // the whole of setup runs with no network and no key - which is what makes
    // the game playable and the suite honest.
    for (const component of ['expectedCtr', 'adRelevance', 'landingPage']) {
      expect(state.advertisers[0].adGroups[0].gradedQuality[component])
        .toBeGreaterThanOrEqual(1);
    }
  });

  test('and it can now actually compete', async () => {
    // The measurement that motivated all of this. With the ungraded 3/3/3 the
    // same advertiser on the same policy got zero impressions from 33,670
    // eligible auctions.
    const { reports } = await playGame(
      state,
      Object.fromEntries(state.advertisers.map((a) => [a.id, disciplined])),
      { mode: 'expected', rounds: 1 },
    );
    const mine = reports[0].byAdvertiser[PLAYER_BRAND];
    expect(mine.traffic.impressions).toBeGreaterThan(0);
    expect(mine.warnings).not.toContain('ungraded_ad');
  });

  test('a supplied grade is respected rather than overwritten', () => {
    const own = startGame({
      rootSeed: 20260902, playerBrandId: PLAYER_BRAND, querySet: QUERY_SET,
      player: choices({
        gradedQuality: {
          expectedCtr: 9, adRelevance: 8, landingPage: 7,
          gradedAtRound: 0, contentHash: 'sha1:mine',
        },
      }),
    });
    expect(own.advertisers[0].adGroups[0].gradedQuality.expectedCtr).toBe(9);
  });

  test('a split may spend the capital the player declined to invest (13.3)', () => {
    // Found by playing round 0 on screen. The interface offered a 1,98,000
    // month - 1,68,000 plus 30,000 of uncommitted capital, exactly as 13.3
    // says - and startGame rejected the split for exceeding 1,68,000.
    //
    // The player's month really is the larger figure. Only the validation needs
    // to know: monthlyBudgetPaise stays at the base and round.js adds the
    // rollover at the capex allocation round, where it also rescales the split.
    const kept = CAPEX_ALLOCATION_PAISE - 7000000;
    const withRollover = start({ player: choices({
      capex: {
        committed: { sizeGuide: 0, photography: 7000000, landingPage: 0 },
        pending: [{ target: 'photography', paise: 7000000, liveAtRound: 4 }],
        remainingUnallocatedPaise: kept,
      },
      weeklySplitPaise: new Array(ROUNDS_PER_MONTH)
        .fill(Math.floor((MONTHLY_BUDGET_PAISE + kept) / ROUNDS_PER_MONTH)),
    }) });
    expect(withRollover.advertisers[0].campaign.weeklySplitPaise
      .reduce((a, b) => a + b, 0)).toBeGreaterThan(MONTHLY_BUDGET_PAISE);

    // And the first round really does hand it over — along with the creative
    // budget, since this player writes their own ad and so spent none of it.
    // TWO rollovers arrive by different routes and must not be confused: the
    // creative one is in `monthlyBudgetPaise` from construction, because the
    // writer is chosen at round 0 and has no allocation round to wait for; the
    // capital one is added by round.js at the capex allocation round, which is
    // also where it rescales the split.
    const out = submitRound(withRollover, {}, { mode: 'expected' });
    expect(out.report.byAdvertiser[PLAYER_BRAND].budget.monthlyBudgetPaise)
      .toBe(MONTHLY_BUDGET_PAISE + CREATIVE_ALLOCATION_PAISE + kept);
  });

  test('but a split beyond even that is refused, not quietly corrected', () => {
    expect(() => start({
      player: choices({ weeklySplitPaise: new Array(ROUNDS_PER_MONTH).fill(MONTHLY_BUDGET_PAISE) }),
    })).toThrow(/weekly split/i);
  });

  test('a player with no keywords is refused', () => {
    expect(() => start({ player: choices({ keywords: [] }) })).toThrow(/keyword/i);
  });

  test('the same seed and choices give the same game (R1)', () => {
    expect(JSON.stringify(start())).toBe(JSON.stringify(start()));
  });
});

describe('round 0 may be redone once, up to round 3 (spec 17.3)', () => {
  test('the rewind keeps the market and changes only the player', () => {
    const before = start();
    const after = redoRoundZero(before, {
      player: choices({ position: { price: 'premium', purpose: 'lifestyle' } }),
    });
    expect(after.advertisers[0].position.price).toBe('premium');
    // Same seed, same rivals, same cells, same ads. Replaying against a
    // different market would answer a different question.
    expect(after.advertisers.slice(1).map((r) => `${r.id}:${r.position.price}|${r.position.purpose}`))
      .toEqual(before.advertisers.slice(1).map((r) => `${r.id}:${r.position.price}|${r.position.purpose}`));
  });

  test('it is offered through round 3 and withdrawn after', () => {
    const state = start();
    for (const round of [1, 2, 3]) {
      expect(canRedoRoundZero({ ...state, round }), `round ${round}`).toBe(true);
    }
    expect(canRedoRoundZero({ ...state, round: REDO_DEADLINE_ROUND + 1 })).toBe(false);
    expect(() => redoRoundZero({ ...state, round: 4 })).toThrow(/round 4/);
  });

  test('and only once', () => {
    const once = redoRoundZero(start());
    expect(once.roundZero.redoUsed).toBe(true);
    expect(canRedoRoundZero(once)).toBe(false);
    expect(() => redoRoundZero(once)).toThrow(/once/i);
  });

  test('a game not started through startGame cannot be rewound', () => {
    expect(() => redoRoundZero({ round: 1, rootSeed: 1, querySet: QUERY_SET }))
      .toThrow(/startGame/);
  });

  test('the rewound game still runs', async () => {
    const after = redoRoundZero(start(), {
      player: choices({ position: { price: 'mid', purpose: 'lifestyle' } }),
    });
    const { reports } = await playGame(
      after,
      Object.fromEntries(after.advertisers.map((a) => [a.id, disciplined])),
      { mode: 'expected', rounds: 1 },
    );
    expect(reports[0].byAdvertiser[PLAYER_BRAND].traffic.eligibleAuctions).toBeGreaterThan(0);
  });
});
