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
import { fileURLToPath } from 'node:url';

// Straight from the rules both looks read. They used to come through
// ui/round-zero.js, which re-exported them for this test alone; the switch-over's
// part 2 deleted that page, and the rules never lived in it.
import {
  openingReserve, submittedAd, gradeAsSubmitted, monthlyBudget,
  positionMatrix, splitShares, adStage, createSetupDraft, checklist, syncWriterCopy,
} from '../ui/roundzero/rules.js';
import { R0 } from '../ui/words/roundZero.js';
import { openingCopyGrades } from '../content/writers.js';
import { startGame } from '../setup.js';
import { submitRound } from '../game.js';
import { BRAND_IDENTITIES } from '../content/brands.js';
import { homeCell } from '../engine/querySet.js';
import { allCells } from '../engine/positions.js';
import { validateAdCopy } from '../agents/grader.js';
import { minimumBidToShowPaise } from '../engine/auction.js';
import { qualitySignalBase, applyHourAndNoise } from '../engine/quality.js';
import { tagKeywordOffline } from '../agents/keywordTagger.js';
import { QUERY_SET } from '../content/querySet.js';
import { composeDescription } from '../content/landingPage.js';
import {
  WRITER_TIERS, CAPEX_ALLOCATION_PAISE,
  CREATIVE_ALLOCATION_PAISE, PRICE_TIERS, PURPOSES,
} from '../engine/constants.js';

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
    // A restated floor would agree until AD_RANK_FLOOR moved. At the hour the
    // signal is strongest, and with the tags startGame gives the keyword, since
    // 2026-09-14: priced without either, a bid it said could not show at all
    // still cleared the reserve.
    const out = openingReserve(draft(), QUERY_SET);
    const row = out.rows[0];
    const query = QUERY_SET.queries.find((q) => q.text === 'gym leggings');
    const { tags } = tagKeywordOffline({ text: 'gym leggings' }, QUERY_SET);
    const { base } = qualitySignalBase(out.grade, query, { text: 'gym leggings', matchType: 'phrase', tags });
    const expected = Math.min(...Array.from({ length: 24 },
      (_, hour) => minimumBidToShowPaise(applyHourAndNoise(base, hour, null, 'expected'))));
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

/**
 * WHAT STEP 2 SHOWS AT ONCE, which is the whole of the density fix
 * (plans/2026-09-24-density-and-polish.md, option B).
 *
 * The step used to draw all eight rival ads in full, simultaneously: measured
 * on the live site at `aa97790`, 612 words, against 119 on 2026-09-14. Roughly
 * 500 of those were the eight ads. It asked a beginner on the second of five
 * screens to read eight competitors' copy, infer each one's tier and purpose,
 * place all eight, and then choose their own cell.
 *
 * `adStage` is the rule, and it lives here rather than in the drawing module
 * for the reason `CLAUDE.md` gives: round 0's rules are testable and a drawing
 * module is not. **The bound it exists to hold is ONE AD ON SCREEN AT A TIME.**
 */
describe('step 2 stages the rival ads instead of dealing them all at once', () => {
  const ads = ['Nira', 'Torvi', 'Kestrel', 'Halcyon', 'Satva', 'Auren', 'Lumen', 'Vella & Co.']
    .map((name) => ({ name, domain: `${name.toLowerCase()}.in`, ad: { headlines: [], descriptions: [] } }));
  const draftWith = (guesses) => ({ guesses: { ...guesses }, cell: 'mid|lifestyle' });

  test('nothing is open to begin with, and all eight are waiting', () => {
    const stage = adStage(ads, draftWith({}), null);
    expect(stage.open).toBe(null);
    expect(stage.unread).toHaveLength(8);
    expect(stage.placed).toHaveLength(0);
  });

  test('AT MOST ONE AD IS OPEN, whatever the player has done', () => {
    // The bound. Every reachable combination of opened and placed still shows
    // one ad, because `open` is a single rival and never a list.
    for (const name of ads.map((a) => a.name)) {
      for (const placedCount of [0, 3, 8]) {
        const guesses = Object.fromEntries(
          ads.slice(0, placedCount).map((a) => [a.name, 'value|performance']),
        );
        const stage = adStage(ads, draftWith(guesses), name);
        expect(Array.isArray(stage.open), `${name}, ${placedCount} placed`).toBe(false);
        expect(stage.open?.name).toBe(name);
      }
    }
  });

  test('placing a rival takes it out of the waiting list', () => {
    const stage = adStage(ads, draftWith({ Nira: 'value|performance', Torvi: 'value|performance' }), null);
    expect(stage.unread.map((r) => r.name)).not.toContain('Nira');
    expect(stage.unread).toHaveLength(6);
    expect(stage.placed.map((r) => r.name).sort()).toEqual(['Nira', 'Torvi']);
  });

  test('the open one is never also in the waiting list, so it cannot be drawn twice', () => {
    const stage = adStage(ads, draftWith({}), 'Kestrel');
    expect(stage.unread.map((r) => r.name)).not.toContain('Kestrel');
    expect(stage.unread).toHaveLength(7);
  });

  test('a rival already placed can be opened again, and is still counted as placed', () => {
    // The chip on the grid is the way back in: a player who placed Nira early
    // and wants to check it against a later ad must be able to re-read it.
    const stage = adStage(ads, draftWith({ Nira: 'value|performance' }), 'Nira');
    expect(stage.open?.name).toBe('Nira');
    expect(stage.placed.map((r) => r.name)).toEqual(['Nira']);
    expect(stage.unread.map((r) => r.name)).not.toContain('Nira');
  });

  test('a name that is not a rival opens nothing rather than throwing', () => {
    // The open name is UI state and survives a redraw; a brand change swaps the
    // whole cast, so a stale name must fail soft.
    const stage = adStage(ads, draftWith({}), 'Marlow');
    expect(stage.open).toBe(null);
    expect(stage.unread).toHaveLength(8);
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

describe('the tags round 0 shows are the tags the account will be given (stage A3)', () => {
  // setup.js tags the player's keywords with the query set. The classic round 0
  // drew its tag chips from the word lookup instead, so a player reading "women"
  // beside "matching set women" was shown a keyword the account would never run.
  // That page is gone; the rule is held here against the step that draws them
  // now, because the mistake is one any new keyword list could make again.
  const source = readFileSync(new URL('../ui/roundzero/keywords.js', import.meta.url), 'utf8');

  test('the chips come from the tagger, handed the query set', () => {
    expect(source).toMatch(/tagKeywordOffline\(keyword, querySet\)/);
    expect(source).not.toMatch(/heuristicTags\(/);
  });
});

// ---------------------------------------------------------------------------
// The reading load of a step, bounded
// ---------------------------------------------------------------------------

/**
 * ROUND 0 HAS A WORD BUDGET NOW, AND UNTIL 2026-09-25 IT HAD NONE.
 *
 * The first run has been held to 80 words a beat since it was built, by
 * `tests/firstRun.test.js`, whose comment says why: **a beginner drowns on a
 * SCREEN**. Round 0 — the screen a stranger actually gave up inside — was held
 * to nothing, and went from 781 rendered words to 1,675 in the ten days to
 * 2026-09-24. Nothing was watching, so nothing said.
 *
 * WHY 150, MEASURED RATHER THAN PICKED. The design first proposed 120
 * (plans/2026-09-24-density-and-polish.md, section 6.1) and that was a guess:
 * four of the five steps failed it, including step 1 at 115, the lightest step
 * that carries a real decision. A bound that the work has to move to meet is
 * not a bound. 150 leaves step 1 its room, sits at roughly twice the first
 * run's 80 — fair, because a beat teaches one idea and a step asks for a
 * decision — and still required cuts to steps 2, 4 and 5 on the day it was set.
 *
 * WHAT IT COUNTS, AND WHAT IT CANNOT. It counts AUTHORED words: every `R0.*`
 * line a step's module mentions, found by reading the module as text so the
 * count cannot drift when a line is added. It deliberately over-counts, because
 * a line behind a condition still counts — a bound should err strict.
 *
 * IT DOES NOT COUNT DATA, and on round 0 data is more than half of what is
 * read: 788 authored words across the five steps render as 1,675. Rival names,
 * ad copy, place names and figures are not in this number. The structural half
 * of the budget is held elsewhere and per-step — `adStage` above is step 2's,
 * holding it to one rival ad on screen instead of eight.
 *
 * IF THIS FAILS, CUT THE STEP. Do not raise the bound: it was set on evidence
 * once, and a number that gets nudged upward is the thing the first run's test
 * refuses to have.
 */
describe('a round 0 step does not out-talk its budget', () => {
  const STEP_MODULES = {
    'step 1 · the market': 'ui/roundzero/market.js',
    'step 2 · where you sit': 'ui/roundzero/position.js',
    'step 3 · your keywords': 'ui/roundzero/keywords.js',
    'step 4 · your ad': 'ui/roundzero/ad.js',
    'step 5 · your money': 'ui/roundzero/money.js',
  };
  const BUDGET = 150;

  /**
   * Lines that are alternatives to each other: exactly one of a group is ever
   * drawn, so the group costs what its LONGEST member costs, not the sum.
   *
   * This is not leniency. The bound is on what a beginner meets ON A SCREEN,
   * and `readoutNone` is the sentence shown when `readoutPlaced` is not. Adding
   * them would be measuring a screen that cannot exist, and would spend the
   * budget cutting sentences nobody reads together.
   *
   * EVERY GROUP HAS TO BE TRUE OF THE DRAWING. If a module changes so that two
   * of these can appear at once, the group is a lie and belongs deleted rather
   * than kept for the headroom.
   */
  const ALTERNATES = [
    // ui/roundzero/position.js: the readout under the grid, and the note
    // beside the rival list, each have an empty state and a filled one.
    ['readoutNone', 'readoutPlaced'],
    ['otherRivals', 'stillUnread'],
    ['unreadLeft', 'guessNote'],
    // ui/roundzero/ad.js:134 — `graded.byWriter ? hiredNote() : diyNote()`.
    // You either hired or you did not, so the reader meets one of these.
    ['hiredNote', 'diyNote'],
    // ui/roundzero/money.js — the weekly split is even until it is not.
    ['splitEven', 'splitCustom'],
  ];

  // One bag of figures that every line can be called with. A line reads only
  // the keys it wants, so a superset is safe and keeps this from needing a
  // bespoke call per line.
  const FIGURES = {
    rivals: 8, n: 8, count: 3, name: 'Nira', names: ['Nira'], cell: 'Value · Performance',
    placed: 2, total: 8, query: 'gym leggings with pockets', volume: '1,849', week: 5,
    order: '₹2,400', margin: '52%', searches: '1,20,400', need: '₹17', grade: 6, of: 10,
    paise: 1000, rupees: '₹1,000', pct: '52%', text: 'gym leggings', tier: 'mid',
  };
  const words = (value) => String(value).trim().split(/\s+/).filter(Boolean).length;

  const wordsOf = (name) => {
    const entry = R0[name];
    if (typeof entry !== 'function') return 0;
    // A line this bag cannot satisfy is skipped rather than counted wrong.
    try { return words(entry(FIGURES)); } catch { return 0; }
  };

  const authored = (path) => {
    const source = readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');
    const names = new Set([...source.matchAll(/R0\.([A-Za-z0-9_]+)/g)].map((m) => m[1]));
    let total = 0;
    for (const group of ALTERNATES) {
      const present = group.filter((name) => names.has(name));
      if (present.length === 0) continue;
      total += Math.max(...present.map(wordsOf));
      for (const name of present) names.delete(name);
    }
    for (const name of names) total += wordsOf(name);
    return total;
  };

  test.each(Object.entries(STEP_MODULES))(`%s stays inside ${BUDGET} words`, (label, path) => {
    const count = authored(path);
    expect(count, `${label} authors ${count} words`).toBeLessThanOrEqual(BUDGET);
  });

  test('every step module was actually found and read', () => {
    // The guard against a renamed module quietly measuring zero and passing.
    for (const path of Object.values(STEP_MODULES)) {
      expect(authored(path), path).toBeGreaterThan(0);
    }
  });
});

/**
 * WHAT STOPPED THE ONE PERSON WHO EVER SENT A PLAYTEST FILE (I59).
 *
 * `checklist`'s `keywords` item is the only one that can be false at the
 * start: `square` is always true, `ad` is valid because a writer is hired by
 * default, and `money` passes with nothing planned. So round 0 had exactly one
 * way to block — and it blocked SILENTLY, four screens after the step that
 * caused it, with the reason in 13px beside a disabled button.
 *
 * Their file: zero keystrokes, three seconds on Your keywords, five clicks in
 * round 0 and every one a tray Next. They added no keyword, so Go was dead for
 * the 3:35 of active time they spent on the last screen.
 */
describe('round 0 says what it is waiting for, where it is waiting for it', () => {
  const src = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');

  test('keywords is still the only thing that can block a fresh round 0', () => {
    const fresh = createSetupDraft({ playerBrandId: 'marlow', rootSeed: 20260902 });
    // A hired writer's copy is dealt on the way in, as round 0 deals it.
    syncWriterCopy(fresh, 20260902);
    const blocked = checklist(fresh).filter((item) => !item.done).map((item) => item.key);
    expect(blocked, 'if another item can block, the Go button must name it too')
      .toEqual(['keywords']);
  });

  // It reads "add a keyword" in the checklist, where it follows a label, and
  // "Add a keyword first" on a button, where it stands alone.
  test('the blocked Go names the missing thing, capitalised', () => {
    expect(R0.goNeeds({ need: R0.needKeyword() })).toBe('Add a keyword first');
    expect(R0.goNeeds({ need: R0.needAd() })).toBe('Finish the ad first');
  });

  // A DEAD BUTTON IS A DEAD END. It stays pressable while something is
  // missing, and pressing it opens the step that holds it.
  test('Go is not disabled for being blocked, only for already running', () => {
    const body = src('ui/roundzero/studio.js');
    expect(body, 'a blocked Go must still be pressable').toMatch(/go\.disabled = going;/);
    expect(body, 'it must not go back to disabling on canGo').not.toMatch(/go\.disabled = going \|\| !canGo/);
    expect(body, 'pressing it opens the step that is missing').toMatch(/if \(blocked\) \{ if \(missing\) open\(/);
  });

  // `canGo` stays the authority; the checklist only supplies the label.
  test('whether it may run is still asked of canGo, not re-derived', () => {
    expect(src('ui/roundzero/studio.js')).toMatch(/const blocked = !canGo\(draft\);/);
  });

  // THE STEP'S OWN HIERARCHY. Empty, the add box was dashed, transparent and
  // muted — the language of absence — while the one filled red button on the
  // screen said "Next: your ad". The emphasis swaps while there is nothing in
  // it, and nothing is blocked.
  test('the add box is the loud one while the step is empty', () => {
    expect(src('ui/roundzero/keywords.js'))
      .toMatch(/draft\.keywords\.length === 0\) plus\.classList\.add\('wanted'\)/);
    expect(src('ui/studio.css')).toMatch(/\.kadd\.wanted \{[^}]*background: var\(--studio-red\)/);
  });

  test('and Next goes quiet there, without being held', () => {
    const body = src('ui/roundzero/studio.js');
    expect(body).toMatch(/view\.step === 'keywords' && draft\.keywords\.length === 0\) next\.classList\.add\('quiet'\)/);
    expect(body, 'Next must still work: it asks, it does not refuse').not.toMatch(/next\.disabled = /);
  });
});
