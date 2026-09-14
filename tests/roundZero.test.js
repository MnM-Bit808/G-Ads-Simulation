/**
 * Round 0's reserve warning, and the one function in that screen that can be
 * wrong in a way no screenshot shows.
 *
 * WHY IT EXISTS, measured. `AD_RANK_FLOOR` is a RESERVE, not an eligibility gate
 * (B5): an advertiser under it enters every auction and shows in none, and
 * reports it as "lost to rank 100%" — which reads as being outbid and sends a
 * player to raise the one lever that cannot help. `minimumBidToShowPaise` says
 * outright that it is "exported so a caller can WARN before a week is spent in
 * it", and until now round 0 was not a caller.
 *
 * It matters most to a player writing their own ad. A self-written ad opens on
 * the ungraded 3/3 default (I11), which needs ₹16.24 on this query set where a
 * hired 6/6 needs ₹6.87 — so the DIY floor is 2.4x, round 0's own ₹30 default
 * clears it by only 1.85x against a hired account's 4.37x, and the form accepts
 * anything from ₹1. Played: at ₹17 the account takes 396 clicks in week 1, at ₹16
 * it takes 244, and at ₹14 it takes ZERO for two full weeks. That is the state
 * DECISIONS A8 exists to keep the player out of, reachable from round 0 with no
 * bid strategy involved.
 *
 * The numbers are NOT pinned here. `AD_RANK_FLOOR` is CALIBRATE and the grade
 * scale may move; what is pinned is that the warning fires exactly when the
 * account would show in nothing, and that it agrees with the engine rather than
 * restating it.
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  openingReserve, submittedAd, gradeAsSubmitted, monthlyBudget,
  positionMatrix, splitShares,
} from '../ui/round-zero.js';
import { openingCopyGrades } from '../content/writers.js';
import { startGame } from '../setup.js';
import { submitRound } from '../game.js';
import { BRAND_IDENTITIES } from '../content/brands.js';
import { homeCell } from '../engine/querySet.js';
import { allCells } from '../engine/positions.js';
import { validateAdCopy } from '../agents/grader.js';
import { minimumBidToShowPaise } from '../engine/auction.js';
import { qualitySignalBase } from '../engine/quality.js';
import { QUERY_SET } from '../content/querySet.js';
import { composeDescription } from '../ui/landing-page.js';
import { gradeAdOffline } from '../agents/grader.js';
import {
  WRITER_TIERS, CAPEX_ALLOCATION_PAISE,
  CREATIVE_ALLOCATION_PAISE, PRICE_TIERS, PURPOSES,
  LOCATION_VOLUME_BY_PRICE, LOCATION_TIERS,
} from '../engine/constants.js';

/**
 * The example ad's own words, read out of the module rather than retyped, so the
 * test grades the ad that actually renders. A second copy would drift.
 */
const exampleSource = readFileSync(new URL('../ui/round-zero.js', import.meta.url), 'utf8');
const pluck = (label) => {
  const block = exampleSource.slice(exampleSource.indexOf(`${label}: Object.freeze([`));
  return [...block.slice(0, block.indexOf('])')).matchAll(/'([^']+)'/g)].map((m) => m[1]);
};
const EXAMPLE_AD_HEADLINES = pluck('headlines');
const EXAMPLE_AD_DESCRIPTIONS = pluck('descriptions');

const CAPEX = { sizeGuide: 0, photography: 0, landingPage: 0 };
const AD = {
  headlines: ['High Waisted Gym Leggings', 'Squat Proof Sports Bra', 'Running Tights For Women'],
  descriptions: [
    'Built to hold through 4 sessions a week, wash after wash.',
    'Sizes XS to XXL with free delivery and easy returns.',
  ],
  landingPageDescription: composeDescription(CAPEX),
};

/**
 * A self-written ad that grades low: one headline and one description, no
 * number or offer, and none of its keyword's words (5 and 3 against "gym
 * leggings"). It must not echo the keyword, or relevance alone lifts it past a
 * hire, which is what a first draft of this fixture did.
 */
const WEAK = { headlines: ['Our Range'], descriptions: ['Have a look.'], landingPageDescription: AD.landingPageDescription };

/** The draft shape `renderRoundZero` holds. */
const draft = (over = {}) => ({
  writerTier: 'diy',
  capex: { ...CAPEX },
  ad: { ...AD },
  keywords: [{ text: 'gym leggings', matchType: 'phrase', bidPaise: 3000 }],
  ...over,
});

describe('what round 0 says a bid has to clear', () => {
  test('it agrees with the engine rather than computing its own floor', () => {
    // The whole point of the function: it must be the auction's own arithmetic.
    // A restated floor would agree until AD_RANK_FLOOR moved.
    const out = openingReserve(draft(), QUERY_SET);
    const row = out.rows[0];
    const query = QUERY_SET.queries.find((q) => q.text === 'gym leggings');
    const expected = minimumBidToShowPaise(qualitySignalBase(
      out.grade, query, { text: 'gym leggings', matchType: 'phrase' },
    ).base);
    expect(row.needPaise).toBe(expected);
  });

  test('writing it yourself prices the floor at what you wrote, from week 1 (I11)', () => {
    const out = openingReserve(draft(), QUERY_SET);
    const written = gradeAsSubmitted(draft()).written;
    expect(out.grade.expectedCtr).toBe(written.expectedCtr);
    expect(out.grade.adRelevance).toBe(written.adRelevance);
    // The landing page is the player's own, graded from the page the capital
    // built — no writer touches it.
    expect(out.grade.landingPage).toBe(written.landingPage);
  });

  test('it asks content/writers.js for that grade instead of restating it', () => {
    for (const tier of WRITER_TIERS) {
      const d = draft({ writerTier: tier.id });
      const out = openingReserve(d, QUERY_SET);
      const expected = openingCopyGrades(tier.id, 0, gradeAsSubmitted(d).written);
      expect(out.grade.expectedCtr, tier.id).toBe(expected.expectedCtr);
      expect(out.grade.adRelevance, tier.id).toBe(expected.adRelevance);
    }
  });

  test('a weak ad of your own raises the floor; a hire guarantees its level', () => {
    const own = openingReserve(draft({ ad: WEAK }), QUERY_SET).rows[0].needPaise;
    const hired = openingReserve(draft({ ad: WEAK, writerTier: 'freelancer' }), QUERY_SET).rows[0].needPaise;
    expect(own).toBeGreaterThan(hired);
  });
});

describe('when it fires', () => {
  const at = (bidPaise, over = {}) => openingReserve(
    draft({ keywords: [{ text: 'gym leggings', matchType: 'phrase', bidPaise }], ...over }),
    QUERY_SET,
  );

  test('it does not fire at the bid round 0 itself offers', () => {
    // A warning that fires on the default would be noise on every game.
    const out = at(3000);
    expect(out.under).toHaveLength(0);
    expect(out.worstShortfall).toBeNull();
  });

  test('it fires on a bid one paise under the floor, and not one paise over', () => {
    const need = at(3000).rows[0].needPaise;
    expect(at(need).under, 'exactly the floor clears it').toHaveLength(0);
    expect(at(need - 1).under, 'a paise under does not').toHaveLength(1);
  });

  test('it names only the keywords that cannot show, not the whole list', () => {
    const need = at(3000).rows[0].needPaise;
    const out = openingReserve(draft({
      keywords: [
        { text: 'gym leggings', matchType: 'phrase', bidPaise: 3000 },
        { text: 'sports bra', matchType: 'phrase', bidPaise: need - 1 },
      ],
    }), QUERY_SET);
    expect(out.under.map((r) => r.text)).toEqual(['sports bra']);
  });

  test('at a bid a hire clears, a weak ad of your own is warned', () => {
    const need = openingReserve(draft({ ad: WEAK, writerTier: 'freelancer' }), QUERY_SET).rows[0].needPaise;
    expect(at(need, { ad: WEAK, writerTier: 'freelancer' }).under.length, 'freelancer').toBe(0);
    expect(at(need, { ad: WEAK }).under.length, 'a weak ad of your own').toBe(1);
  });

  test('an empty keyword list is not a warning', () => {
    const out = openingReserve(draft({ keywords: [] }), QUERY_SET);
    expect(out.under).toHaveLength(0);
    expect(out.rows).toHaveLength(0);
  });

  test('a keyword the planner does not contain is still priced', () => {
    // The composer takes free text, so a keyword need not be a row in the set.
    // Priced against its own literal search at commercial intent — the most
    // favourable query it could meet, so failing here fails everywhere.
    const out = openingReserve(draft({
      keywords: [{ text: 'squat proof leggings india', matchType: 'phrase', bidPaise: 100 }],
    }), QUERY_SET);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].needPaise).toBeGreaterThan(0);
    expect(out.under).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// The grade round 0 shows is the grade the account gets
// ---------------------------------------------------------------------------

describe('round 0 grades the ad it is about to submit', () => {
  /**
   * THE BUG THIS EXISTS FOR, reported by a player: "why is my landing page still
   * rated 4/10 when the capital bought me an 8?"
   *
   * They had left the descriptions blank — reasonable, having just paid a
   * retainer to write the ad. Round 0 graded `draft.ad`, which holds
   * `descriptions: ['', '']`, and showed 8 · 8 · 8. It then SUBMITTED
   * `descriptions.filter(Boolean)` — an ad with no descriptions at all — which
   * fails `validateAdCopy`, so `OVERLONG_CEILING` capped every component at 4.
   * The retainer overwrote the two copy components with its guaranteed 8s, and
   * the landing page was left as the only place the damage showed: 8 · 8 · 4.
   *
   * Three faults stacked, and the structural one is that round 0 graded a
   * DIFFERENT OBJECT from the one it submitted. So this asserts the only thing
   * that matters to a player: the number on the screen is the number the account
   * will run on.
   */
  const CAPEX = { sizeGuide: 2500000, photography: 0, landingPage: 5500000 };
  const OWN = QUERY_SET.queries.filter((q) => homeCell(q) === 'premium|lifestyle').slice(0, 6);

  /** The draft `renderRoundZero` holds, in the shape it holds it. */
  const draftOf = (over = {}) => ({
    playerBrandId: BRAND_IDENTITIES[0].id,
    cell: 'premium|lifestyle',
    capex: { ...CAPEX },
    writerTier: 'retainer',
    keywords: OWN.map((q) => ({ text: q.text, matchType: 'phrase', bidPaise: 3000 })),
    ad: {
      headlines: ['Premium Athleisure', 'Designer Leggings', 'Luxury Loungewear'],
      descriptions: [
        'Built to hold through 4 sessions a week, wash after wash.',
        'Sizes XS to XXL with free delivery and easy returns.',
      ],
      landingPageDescription: composeDescription(CAPEX),
    },
    ...over,
  });

  /** What the account actually ends up running, through the real round 0 path. */
  const accountGrade = (draft) => {
    const state = startGame({
      rootSeed: 20260902,
      playerBrandId: draft.playerBrandId,
      querySet: QUERY_SET,
      player: {
        position: { price: 'premium', purpose: 'lifestyle' },
        capex: { committed: { ...draft.capex }, pending: [], remainingUnallocatedPaise: 0 },
        keywords: draft.keywords.map((k) => ({ ...k })),
        // Exactly what the Go button sends.
        ad: submittedAd(draft),
        writerTier: draft.writerTier,
      },
    });
    return state.advertisers[0].adGroups[0].gradedQuality;
  };

  const CASES = [
    ['a finished ad', {}],
    ['descriptions left blank', { ad: { ...draftOf().ad, descriptions: ['', ''] } }],
    ['one description written', { ad: { ...draftOf().ad, descriptions: ['Sizes XS to XXL.', ''] } }],
    ['headlines left blank', { ad: { ...draftOf().ad, headlines: ['', '', ''] } }],
    ['an overlong headline', { ad: { ...draftOf().ad, headlines: ['x'.repeat(80), 'Designer Leggings', 'Luxury Loungewear'] } }],
    ['naming a rival', { ad: { ...draftOf().ad, headlines: ['Better Than Kestrel', 'Designer Leggings', 'Luxury Loungewear'] } }],
  ];

  test.each(CASES)('%s: the panel and the account agree', (_label, over) => {
    const draft = draftOf(over);
    const shown = gradeAsSubmitted(draft).applied;
    const got = accountGrade(draft);
    expect(shown.expectedCtr, 'expectedCtr').toBe(got.expectedCtr);
    expect(shown.adRelevance, 'adRelevance').toBe(got.adRelevance);
    expect(shown.landingPage, 'landingPage').toBe(got.landingPage);
  });

  test('blank descriptions cap the copy on screen, and leave the page alone', () => {
    // THIS TEST USED TO ASSERT THE OPPOSITE, and the reversal is the point.
    // I19 pinned `landingPage < 8` here, because the cap took all three
    // components and the panel had to stop claiming an 8 it would not deliver.
    // Both halves have since changed: the panel and the account agree (the
    // test.each above is what guarantees that now), and the cap no longer
    // touches the page.
    //
    // The player who reported it had hired a retainer, left the copy boxes
    // alone as one reasonably does, spent ₹80,000 on the page, and watched the
    // landing page sit at 4 through every rung. The page they bought really was
    // an 8; nothing on screen could say so.
    // This fixture hires a retainer, which is the reported case exactly.
    const finished = gradeAsSubmitted(draftOf());
    const blank = gradeAsSubmitted(draftOf({ ad: { ...draftOf().ad, descriptions: ['', ''] } }));

    // The cap still bites the copy the player actually wrote.
    expect(blank.written.expectedCtr, 'written copy is still capped').toBeLessThanOrEqual(4);
    expect(blank.written.adRelevance, 'written copy is still capped').toBeLessThanOrEqual(4);

    // And a hired tier still overwrites it, which is I11 and is not changed here.
    expect(blank.applied.expectedCtr, 'the tier still buys its grade').toBe(8);
    expect(blank.applied.adRelevance, 'the tier still buys its grade').toBe(8);

    // The whole point: the page is graded on the page.
    expect(blank.applied.landingPage, 'the page is graded on the page')
      .toBe(finished.applied.landingPage);
    expect(blank.applied.landingPage, 'and a bought page beats the old frozen 4')
      .toBeGreaterThan(4);
  });

  test('and the Go button refuses it', () => {
    const draft = draftOf({ ad: { ...draftOf().ad, descriptions: ['', ''] } });
    expect(validateAdCopy(submittedAd(draft)).valid).toBe(false);
  });

  test('the ad it submits is the ad it graded, blanks and all', () => {
    // The structural statement: one object, not two.
    const draft = draftOf({ ad: { ...draftOf().ad, descriptions: ['Sizes XS to XXL.', ''] } });
    const ad = submittedAd(draft);
    expect(ad.descriptions).toEqual(['Sizes XS to XXL.']);
    expect(ad.headlines).toHaveLength(3);
    expect(ad.landingPageDescription).toBe(composeDescription(CAPEX));
  });

  test('naming a rival now costs points on screen, as it costs the account', () => {
    // Round 0 used to grade without `rivalNames`, so the trademark penalty (8.7)
    // was invisible on the one screen that shows a grade — it warned in words and
    // left the number alone, which reads as cosmetic when it is worth 4 points.
    //
    // IT SHOWS ON WHAT YOU EARNED, and the first version of this test asserted it
    // on what APPLIES — which is wrong for a hired tier and is worth pinning
    // rather than fixing. A tier sets the two copy components outright (I11), so
    // a retainer absorbs the whole penalty: the account really does run at the
    // tier's grade. The penalty bites a player who writes their own.
    const named = (tier) => gradeAsSubmitted(draftOf({
      writerTier: tier,
      ad: { ...draftOf().ad, headlines: ['Better Than Kestrel', 'Designer Leggings', 'Luxury Loungewear'] },
    }));
    const clean = (tier) => gradeAsSubmitted(draftOf({ writerTier: tier }));

    expect(named('retainer').written.adRelevance, 'what you earned')
      .toBeLessThan(clean('retainer').written.adRelevance);
    expect(named('retainer').applied.adRelevance, 'what a retainer runs on')
      .toBe(clean('retainer').applied.adRelevance);
    expect(named('diy').applied.adRelevance, 'what a self-written ad runs on')
      .toBeLessThan(clean('diy').applied.adRelevance);
  });
});

// ---------------------------------------------------------------------------
// The month round 0 divides is the month the account gets
// ---------------------------------------------------------------------------

describe('the month on the budget card', () => {
  /**
   * `monthlyBudget` was `MONTHLY_BUDGET_PAISE + (CAPEX_ALLOCATION_PAISE -
   * committed)`. It counted the uncommitted CAPITAL and omitted the CREATIVE
   * rollover — so the writer card said "₹50,000 not committed, which is added to
   * this month's advertising budget instead" and the very next card divided a
   * month that did not include it.
   *
   * `rerender` puts those two cards in that order deliberately: *"whatever the
   * writer did not cost rolls into the month this divides"*. **The ordering
   * existed for a dependency the code then did not honour.** It was correct only
   * for a retainer, where the rollover is zero, which is why it read as a
   * plausible number for a whole session.
   *
   * Measured before the fix, for a DIY player committing no capital: the card
   * said ₹2,68,000, the account held ₹2,18,000, and after week 1 it was
   * ₹3,18,000.
   *
   * So the invariant is exact and this is what pins it: the total the card
   * divides equals the month the account reports once the capital has rolled in.
   */
  const OWN2 = QUERY_SET.queries.filter((q) => homeCell(q) === 'premium|lifestyle').slice(0, 6);

  const monthAfterWeekOne = (writerTier, capexCommitted) => {
    const capex = { sizeGuide: capexCommitted, photography: 0, landingPage: 0 };
    const state = startGame({
      rootSeed: 20260902,
      playerBrandId: BRAND_IDENTITIES[0].id,
      querySet: QUERY_SET,
      player: {
        position: { price: 'premium', purpose: 'lifestyle' },
        capex: {
          committed: { ...capex },
          pending: capexCommitted > 0
            ? [{ target: 'sizeGuide', paise: capexCommitted, liveAtRound: 4 }]
            : [],
          remainingUnallocatedPaise: CAPEX_ALLOCATION_PAISE - capexCommitted,
        },
        keywords: OWN2.map((q) => ({ text: q.text, matchType: 'phrase', bidPaise: 3000 })),
        ad: {
          headlines: ['Premium Athleisure', 'Designer Leggings', 'Luxury Loungewear'],
          descriptions: [
            'Built to hold through 4 sessions a week, wash after wash.',
            'Sizes XS to XXL with free delivery and easy returns.',
          ],
          landingPageDescription: composeDescription(capex),
        },
        writerTier,
      },
    });
    const out = submitRound(state, {}, { mode: 'expected' });
    return out.report.byAdvertiser[BRAND_IDENTITIES[0].id].budget.monthlyBudgetPaise;
  };

  const draftFor = (writerTier, capexCommitted) => ({
    writerTier,
    capex: { sizeGuide: capexCommitted, photography: 0, landingPage: 0 },
  });

  const CASES = [
    ['diy', 0], ['diy', 2500000], ['diy', 10000000],
    ['freelancer', 0], ['agency', 2500000], ['retainer', 0], ['retainer', 10000000],
  ];

  test.each(CASES)('%s with %i paise committed: the card matches the account', (tier, committed) => {
    expect(monthlyBudget(draftFor(tier, committed))).toBe(monthAfterWeekOne(tier, committed));
  });

  test('the creative rollover is in it, which is the half that was missing', () => {
    // A retainer spends the whole creative budget, a DIY player spends none of
    // it, so the gap between them IS the rollover. It used to be zero.
    const diy = monthlyBudget(draftFor('diy', 0));
    const retainer = monthlyBudget(draftFor('retainer', 0));
    expect(diy - retainer).toBe(CREATIVE_ALLOCATION_PAISE);
  });

  test('and committing capital lowers it, rupee for rupee', () => {
    expect(monthlyBudget(draftFor('diy', 0)) - monthlyBudget(draftFor('diy', 2500000)))
      .toBe(2500000);
  });
});

// ---------------------------------------------------------------------------
// The positioning grid, and the shape of the month
// ---------------------------------------------------------------------------

describe('the positioning grid means what its position says', () => {
  /**
   * `.cell-grid` was already `repeat(3, minmax(0, 1fr))`, and `allCells()` returns
   * the six cells price-major — so six cells flowed into three columns put
   * **mid|lifestyle directly under value|performance**. It rendered as a 3x2
   * matrix in which position carried no meaning at all, on the one screen whose
   * job is to teach the price x purpose model the whole game rests on (4.1).
   *
   * Nothing caught it because nothing described the layout as data. `positionMatrix`
   * does, so the axes are assertable.
   */
  test('one row per purpose, one column per price', () => {
    const matrix = positionMatrix();
    expect(matrix.prices).toEqual(PRICE_TIERS);
    expect(matrix.rows).toHaveLength(PURPOSES.length);
    matrix.rows.forEach((row, i) => {
      expect(row.purpose).toBe(PURPOSES[i]);
      expect(row.cells).toHaveLength(PRICE_TIERS.length);
      row.cells.forEach((cell, j) => {
        expect(cell.price, `row ${i} column ${j}`).toBe(PRICE_TIERS[j]);
        expect(cell.purpose, `row ${i} column ${j}`).toBe(PURPOSES[i]);
      });
    });
  });

  test('it covers every legal cell exactly once', () => {
    // The guard against a matrix that looks right and quietly drops a cell.
    const keys = positionMatrix().rows.flatMap((row) => row.cells.map((c) => c.key));
    expect([...keys].sort()).toEqual([...allCells()].sort());
    expect(new Set(keys).size).toBe(allCells().length);
  });

  test('and a cell knows its own key, so selection cannot drift from the draft', () => {
    for (const row of positionMatrix().rows) {
      for (const cell of row.cells) {
        expect(cell.key).toBe(`${cell.price}|${cell.purpose}`);
      }
    }
  });
});

describe('the month split has a shape, not just four amounts', () => {
  test('shares are the amounts as fractions of what is planned', () => {
    const shares = splitShares([100, 100, 100, 100]);
    expect(shares).toEqual([0.25, 0.25, 0.25, 0.25]);
  });

  test('an uneven plan reads uneven', () => {
    const shares = splitShares([400, 300, 200, 100]);
    expect(shares[0]).toBeGreaterThan(shares[3]);
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  test('a week set to zero takes no width rather than breaking the bar', () => {
    expect(splitShares([300, 0, 0, 100])).toEqual([0.75, 0, 0, 0.25]);
  });

  test('a plan of nothing gives no shape and does not divide by zero', () => {
    // Reachable: every box can be cleared, and the card still has to draw.
    expect(splitShares([0, 0, 0, 0])).toEqual([0, 0, 0, 0]);
    expect(splitShares([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Where the search happens is its own card (G4 content, I22's layout lesson)
// ---------------------------------------------------------------------------

/**
 * A LAYOUT DECISION, SO IT IS READ FROM THE SOURCE. Nothing behavioural can see
 * which card a table sits in or how wide it is, which is exactly how the round 0
 * positioning grid rendered scrambled for a whole session (I22) — nothing
 * described the layout, so nothing could assert it.
 *
 * WHY WIDE IS THE PART WORTH PINNING. `.setup` is a two-column grid, and the
 * screen has six half-width cards, which packs into exactly three rows. Splitting
 * the briefing makes seven — an odd number — so a half-width card is orphaned in
 * a row of its own and wastes a whole column. Measured at 1440x900: half width
 * costs +118px against the unsplit page, full width with the note stretched
 * underneath costs +36px, and full width with the note BESIDE the table comes out
 * 24px SHORTER than before the split. Someone tidying `true` away here would
 * silently take the first of those.
 */
describe('the briefing is split, and the geography card is wide', () => {
  const source = readFileSync(new URL('../ui/round-zero.js', import.meta.url), 'utf8');

  test('there is a card for where the search happens', () => {
    expect(source).toMatch(/function sectionWhereSearch\(/);
    expect(source).toMatch(/card\(\s*'Where the search happens'/);
  });

  test('and it is wide, which is what stops a card being orphaned in its own row', () => {
    const fn = source.slice(source.indexOf('function sectionWhereSearch('));
    const head = fn.slice(0, fn.indexOf('const places'));
    // card(title, subtitle, wide) — the third argument has to be true.
    expect(head).toMatch(/card\(\s*'Where the search happens',[\s\S]*?,\s*true\s*\)/);
  });

  test('it is rendered between the briefing and the rivals', () => {
    const order = ['sectionBriefing(', 'sectionWhereSearch(', 'sectionRivals(']
      .map((name) => source.indexOf(name));
    expect(order.every((i) => i > 0), 'all three sections are rendered').toBe(true);
    expect(order[0]).toBeLessThan(order[1]);
    expect(order[1]).toBeLessThan(order[2]);
  });

  test('and the briefing no longer draws the location table itself', () => {
    // Otherwise the split would leave two cards claiming the same fact, which is
    // the drift I15 records from two capital cards describing one decision.
    const briefing = source.slice(
      source.indexOf('function sectionBriefing('),
      source.indexOf('function sectionWhereSearch('),
    );
    expect(briefing).not.toMatch(/brief\.locations/);

    // COUNTED BY SECTION, NOT BY OCCURRENCE. This used to assert exactly one
    // mention, which was a proxy that broke the moment the card grew a map —
    // `sectionWhereSearch` now reads the locations three times quite legitimately.
    // What matters is that no OTHER section reads them.
    const whereStart = source.indexOf('function sectionWhereSearch(');
    const whereEnd = source.indexOf('\nfunction ', whereStart + 1);
    for (const m of source.matchAll(/brief\.locations/g)) {
      expect(m.index, 'only sectionWhereSearch reads the locations')
        .toBeGreaterThan(whereStart);
      expect(m.index, 'only sectionWhereSearch reads the locations')
        .toBeLessThan(whereEnd);
    }
  });
});

// ---------------------------------------------------------------------------
// The worked example (asked for by a player, to learn the ad rules from)
// ---------------------------------------------------------------------------

/**
 * A SOURCE READ, for the same reason the geography card's is: nothing
 * behavioural can see which grid cell a card lands in, and this one's whole
 * point is WHERE it sits. It fills the slack under "This month" by sharing a
 * cell with it, so the page height is unchanged (4274px before and after,
 * measured at 1440x900). Added as a seventh half-width card it would instead
 * orphan one card in a row of its own and cost 169px.
 *
 * The stack has to pair with CAPITAL, because at 670px it is the only card tall
 * enough to hold the budget card and the example together. That is why the
 * writer card moved ahead of the planner - a layout constraint, not a reading
 * preference, and the writer card already copes with being read first.
 */
describe('round 0 shows a worked example, in the space under the budget', () => {
  const source = readFileSync(new URL('../ui/round-zero.js', import.meta.url), 'utf8');

  test('the example is stacked with the budget card, not added as a new card', () => {
    expect(source).toMatch(/stack\(\s*[\s\S]*?sectionBudget\([\s\S]*?sectionExample\(\)/);
  });

  test('and the stack lands beside Capital, which is what makes it free', () => {
    const order = ['sectionKeywords(', 'sectionCapex(', 'stack(']
      .map((n) => source.indexOf(n, source.indexOf('const rerender')));
    expect(order.every((i) => i > 0)).toBe(true);
    expect(order[0], 'keywords before capital').toBeLessThan(order[1]);
    expect(order[1], 'capital immediately before the stack').toBeLessThan(order[2]);
  });

  test('the example ad passes the rules it is teaching', () => {
    // An example that would not grade well is worse than none. It is held to the
    // grader rather than to a copy of the grader's opinion.
    const ad = {
      headlines: [...EXAMPLE_AD_HEADLINES],
      descriptions: [...EXAMPLE_AD_DESCRIPTIONS],
      landingPageDescription: 'A plain product page.',
    };
    expect(validateAdCopy(ad).valid, 'it fits Google limits').toBe(true);
    const graded = gradeAdOffline(ad, { keywords: draft().keywords }, 0);
    expect(graded.expectedCtr, 'it reaches the offline ceiling on craft').toBe(8);
  });

  test('it says copying it will not help, which is what makes it safe to show', () => {
    // `adRelevance` is scored against the player's OWN keywords, so a copied ad
    // scores worse than the same effort in their own words. That is why a worked
    // example is legitimate here where I3's territory dot was not: the dot made
    // the decision, this cannot.
    const fn = source.slice(source.indexOf('function sectionExample('));
    // Rejoin the string concatenation before matching, or the assertion depends
    // on where the source happens to wrap.
    const flat = fn.slice(0, fn.indexOf('\n}')).replace(/'\s*\+\s*'/g, '');
    expect(flat).toMatch(/relevance is measured against the keywords you chose/i);
  });
});

/**
 * Three sentences round 0 got wrong (reviews/slc-review.md, 9C). Each claimed
 * something about a number the model owns, and each was typed rather than read,
 * so each was true on the day it was written and then was not.
 */
describe('round 0 states the numbers it is built on, not ones typed beside them', () => {
  const source = readFileSync(new URL('../ui/round-zero.js', import.meta.url), 'utf8');

  test('the capital heading is the allocation itself', () => {
    // It read "₹1,00,000" while the card below it allocated ₹1,20,000.
    expect(source).toMatch(/card\('Capital',\s*`\$\{rupees\(CAPEX_ALLOCATION_PAISE\)\}/);
    expect(source).not.toMatch(/card\('Capital',\s*`₹/);
  });

  test('"most searches happen outside the metros" is true in every price tier', () => {
    // The subtitle used to say the metros were the smallest of the three - true
    // for the market, false for the premium column printed beside it (38% against
    // 36 and 26). This pins the claim that replaced it to the data it describes,
    // so a recalibrated LOCATION_VOLUME_BY_PRICE that broke it would fail here.
    expect(source).toMatch(/card\('Where the search happens',\s*'most searches happen outside the metros'/);
    const metros = LOCATION_TIERS.indexOf('tier1');
    for (const price of PRICE_TIERS) {
      expect(LOCATION_VOLUME_BY_PRICE[price][metros], price).toBeLessThan(0.5);
    }
  });

  test('the month-3 rule on the budget card is the briefing\'s rule, not a paraphrase', () => {
    // It said "redistributed by rank across all 12 rounds"; the rule is rounds 1
    // to 8 as reported at round 8, and the briefing on the same page said so.
    const budget = source.slice(source.indexOf('function sectionBudget('));
    const body = budget.slice(0, budget.indexOf('\nfunction '));
    expect(body).toMatch(/rankingRule\.metric/);
    expect(body).not.toMatch(/across all/);
  });
});

describe('the tags round 0 shows are the tags the account will be given (stage A3)', () => {
  // setup.js tags the player's keywords with the query set. Round 0 drew its
  // tag chips from the word lookup, so a player reading "women" beside
  // "matching set women" was shown a keyword the account would never run.
  const source = readFileSync(new URL('../ui/round-zero.js', import.meta.url), 'utf8');
  const keywords = source.slice(source.indexOf('function sectionKeywords('));
  const body = keywords.slice(0, keywords.indexOf('\nfunction '));

  test('the chips come from the tagger, handed the query set', () => {
    expect(body).toMatch(/tagKeywordOffline\(\{\s*text: keyword\.text\s*\},\s*querySet\)/);
    expect(body).not.toMatch(/heuristicTags\(keyword\.text\)/);
  });
});
