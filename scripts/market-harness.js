/**
 * The market harness: what F15, D12 and C8 are measured with.
 *
 * WHY IT IS COMMITTED. F15, D12 and F16 each rebuilt this as a throwaway, and
 * each handed `startGame` the player's round-0 capital in a shape that lost it
 * (C8), and left out the capital decision the real form always sends at week
 * 5. So the measured player was poorer than any real one in months 1 and 2.
 * This runs the market one way, before and after a change, so a difference
 * between two runs is the change and not the harness.
 *
 * THE PLAYER is F15's: the six highest-volume searches of its cell on phrase at
 * 0.7 x realised break-even, its own brand search on exact at 1.2x, the agency
 * writer, nothing committed at round 0, and nothing committed at week 5 either,
 * which is what the form sends if the player leaves the capital card alone.
 * Rivals run their own policies and are asserted live. Expected mode. The
 * `writer` mode plays the same player twice, hiring the agency and writing its
 * own ad (OWN_AD, one per square), for DECISIONS I11
 * (plans/2026-09-14-round-zero-redesign.md, section 5).
 *
 * usage:
 *   node scripts/market-harness.js market  <label> [workers]
 *   node scripts/market-harness.js capital <label> [workers]
 *   node scripts/market-harness.js writer  <label> [workers]
 *   node scripts/market-harness.js prepaid <label> [workers]
 *   node scripts/market-harness.js move    <label> [workers]
 *   node scripts/market-harness.js page    <label> [workers]
 *   node scripts/market-harness.js compare <before.json> <after.json>
 *   node scripts/market-harness.js pagegates <before-label> <after-label>
 *   node scripts/market-harness.js speedgates <before-label> <after-label>
 *
 * `market` plays 72 whole games (seeds 1-12, the six cells) and reports F15's
 * economics, the player's profit and rank, every rival's month-2 budget, and how
 * far rivals move into weeks 5 and 9 against an ordinary week. `capital` is
 * D12's comparison: forked at week 5, committing nothing against four ways of
 * investing the whole allocation. `prepaid` is I34's comparison: every rung from
 * week 1 against none, whole games. `move` is F18's: the player moves one step
 * at week 5, to every cell spec 4.5 allows, whole games; the same seeds in
 * `market` are the games where it stayed. `page` plays whole games with one page
 * bought at round 0 against none, and `pagegates` checks the gates the owner
 * agreed for grading the page as it stands (2026-09-17) from a `market`,
 * `capital` and `page` run under each label; `speedgates` checks, from the same
 * three, the gates agreed for grading only what Google names (C, 2026-09-17).
 * Each mode writes
 * `harness-<label>-<mode>.json` to the system temp folder and prints a summary.
 */
import { writeFileSync, readFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fork } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startGame } from '../setup.js';
import { playRound } from '../game.js';
import { controllerFor } from '../agents/policies.js';
import { gameTotals, finalStandings, rankOf } from '../ui/ending.js';
import { QUERY_SET } from '../content/querySet.js';
import { BRAND_IDENTITIES } from '../content/brands.js';
import { homeCell } from '../engine/querySet.js';
import {
  allCells, parseCell, businessFor, realisedBreakEvenCpcPaise, isOneStep,
} from '../engine/positions.js';
import {
  TOTAL_ROUNDS, CAPEX_ALLOCATION_PAISE, PREPAID_DISCOUNT_CURVE, REPOSITION_ROUND, ROUNDS_PER_MONTH,
} from '../engine/constants.js';
import { gradeAdOffline } from '../agents/grader.js';
import { composeDescription } from '../content/landingPage.js';

export const PLAYER = BRAND_IDENTITIES[0].id;
export const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
export const CELLS = allCells();
const EMPTY_CAPEX = { committed: {}, pending: [] };

const AD = {
  headlines: ['Activewear Built To Train In', 'Free Delivery Across India', 'Sizes XS To XXL'],
  descriptions: [
    'Leggings, tights and sports bras that hold through 4 sessions a week.',
    'Easy returns within 30 days, and cash on delivery everywhere.',
  ],
};

/**
 * What the same player writes when it writes its own ad: one per square, as a
 * careful player would, in the words of that square's own keywords (I11's
 * measurement, agreed with the owner before the first run). The grader scores
 * relevance against your own keywords, so a careful writer echoes them; a
 * strong self-writer is also where the new rule could be too generous, which is
 * what the gates are there to catch. The page is written from the same capital
 * as the hiring player's, so only the writing differs.
 */
const OWN_AD = Object.freeze({
  'value|performance': {
    headlines: ['Gym Leggings Under ₹999', 'Sports Bra Combo Pack Sale', 'Budget Gym Wear For Women'],
    descriptions: [
      'Vella leggings and sports bras that hold through 4 sessions a week.',
      'Cheap enough to own two pairs. Free delivery and 30-day returns.',
    ],
  },
  'value|lifestyle': {
    headlines: ['Co-ord Sets Under ₹999', 'Budget Loungewear That Lasts', 'Leggings Combo Pack Sale'],
    descriptions: [
      'Cheap athleisure that looks put together, in sizes XS to XXL.',
      'Vella co-ord sets from ₹799. Free delivery, easy 15-day returns.',
    ],
  },
  'mid|performance': {
    headlines: ['High Waisted Gym Leggings', 'Sports Bra, High Impact', 'Running Tights For Women'],
    descriptions: [
      'Vella workout leggings that hold through 4 sessions a week.',
      'Sizes XS to XXL, free delivery and 30-day returns.',
    ],
  },
  'mid|lifestyle': {
    headlines: ['Everyday Athleisure Leggings', 'Matching Co-ord Sets', 'Joggers And Lounge Pants'],
    descriptions: [
      'Vella sets for women who wear them to the studio and after.',
      'Sizes XS to XXL. Free delivery and 30-day returns.',
    ],
  },
  'premium|performance': {
    headlines: ['Seamless Compression Leggings', 'Squat Proof, No Camel Toe', 'Four Way Stretch Gym Tights'],
    descriptions: [
      'Vella’s buttery soft knit holds through 4 sessions a week.',
      'Fit consultation before you buy. Free returns within 30 days.',
    ],
  },
  'premium|lifestyle': {
    headlines: ['Luxury Loungewear In Modal', 'Buttery Soft Designer Leggings', 'Bamboo Fabric Lounge Pants'],
    descriptions: [
      'Premium athleisure from Vella, cut to hold its shape for years.',
      'Fit consultation, and free returns within 30 days.',
    ],
  },
});

/**
 * F15's player, as round 0 choices.
 *
 * THE PAGE IS WRITTEN FROM ITS CAPITAL, as round 0 writes a real player's
 * (`syncPage`, I9). It used to type "A plain product page." and buy nothing at
 * round 0, so no mode could see the page: grading the page as it stands (the
 * owner, 2026-09-17) would have measured identical before and after, and every
 * gate would have passed on nothing. With no capital the words are the same.
 *
 * @param {string} cell 'price|purpose'
 * @param {string} [writerTier] - 'agency', or 'diy' for the self-writing player
 * @param {Object<string, number>} [capex] round 0's allocation, paise per target
 * @returns {object} the `player` argument of `startGame`
 */
export function harnessPlayer(cell, writerTier = 'agency', capex = {}) {
  const position = parseCell(cell);
  const breakEven = realisedBreakEvenCpcPaise(businessFor(position, EMPTY_CAPEX, 1), QUERY_SET, position);
  const own = QUERY_SET.queries.filter((q) => homeCell(q) === cell)
    .sort((a, b) => b.volumeShareBp - a.volumeShareBp)
    .slice(0, 6);
  const brand = QUERY_SET.queries.find((q) => q.intent === 'brand' && q.brandOwner === PLAYER);
  return {
    position,
    // By default an allocation of nothing: the whole ₹1,20,000 rolls into month 1 (C8).
    capex,
    keywords: [
      ...own.map((q) => ({ text: q.text, matchType: 'phrase', bidPaise: Math.round(breakEven * 0.7) })),
      { text: brand.text, matchType: 'exact', bidPaise: Math.round(breakEven * 1.2) },
    ],
    // A hired writer's ad runs at the writer's level whatever it says, so the
    // hiring player keeps the one ad; the self-writer writes its square's own.
    ad: { ...(writerTier === 'diy' ? OWN_AD[cell] : AD), landingPageDescription: composeDescription(capex) },
    writerTier,
  };
}

/** What the form sends when the player leaves the capital card alone. */
/**
 * @returns {{capex?: object, campaign?: object, position?: string}|null} a
 *   DECISION, which callers spread and add to — `prepaidDecision` sets
 *   `campaign`, `moveDecision` sets `position`. Typed as the whole shape
 *   rather than the one field this returns, so those stay honest.
 */
export const keepAtWindow = (round, state) => (
  round > 1 && (state.budgetSchedule?.capexAllocationRounds ?? []).includes(round) ? { capex: {} } : null
);

/**
 * Play one market.
 *
 * @param {object} options
 * @param {number} options.seed
 * @param {string} options.cell
 * @param {object} [options.from] a state to continue from, instead of a new game
 * @param {number} [options.rounds] the last round to play
 * @param {Function} [options.playerDecision] (round, state) => decision | null
 * @param {Function} [options.policyFor] policy id => controller; a test wraps
 *   `controllerFor` here to record what each rival is handed and decides
 * @param {string} [options.writerTier] - who writes the player's ad
 * @param {Object<string, number>} [options.capex] - round 0's allocation
 * @returns {Promise<{state: object, insights: object[]}>}
 */
export async function playMarket({
  seed, cell, from = null, rounds = TOTAL_ROUNDS, playerDecision = keepAtWindow,
  policyFor = controllerFor, writerTier = 'agency', capex = {},
}) {
  let state = from ?? startGame({
    rootSeed: seed, playerBrandId: PLAYER, querySet: QUERY_SET, player: harnessPlayer(cell, writerTier, capex),
  });
  const live = state.advertisers.filter((a) => a.policyId).length;
  if (live !== state.advertisers.length - 1) throw new Error(`rivals are not live (${live}), so this measures nothing`);
  const insights = [];
  while (state.round <= rounds) {
    const round = state.round;
    const current = state;
    /** @type {Record<string, Function>} */
    const controllers = {};
    for (const a of state.advertisers) {
      controllers[a.id] = a.policyId ? policyFor(a.policyId) : () => playerDecision(round, current);
    }
    const out = await playRound(state, controllers, { mode: 'expected' });
    insights.push(out.insights);
    state = out.nextGameState;
  }
  return { state, insights };
}

const median = (xs) => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (s.length === 0) return NaN;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** F15's table, over the weeks that have settled (1-7), for one or more advertisers. */
function economics(history, ids) {
  const t = { impressions: 0, clicks: 0, costPaise: 0, conversions: 0, returned: 0, gross: 0, net: 0, profit: 0 };
  for (const id of ids) {
    for (const w of gameTotals(history, id).weeks.filter((x) => x.round <= 7)) {
      t.impressions += w.impressions; t.clicks += w.clicks; t.costPaise += w.costPaise;
      t.conversions += w.conversions; t.returned += w.returned;
      t.gross += w.grossRevenuePaise; t.net += w.netRevenuePaise; t.profit += w.netProfitPaise;
    }
  }
  return {
    ctr: t.clicks / t.impressions,
    cpcPaise: t.costPaise / t.clicks,
    conv: t.conversions / t.clicks,
    grossRoas: t.gross / t.costPaise,
    netRoas: t.net / t.costPaise,
    profitPerRupee: t.profit / t.costPaise,
    returned: t.returned / t.conversions,
  };
}

/** The largest change among rivals' impression shares from week a to week b. */
function largestStep(insights, a, b) {
  const before = insights[a - 1]?.[PLAYER]?.rivals ?? {};
  const after = insights[b - 1]?.[PLAYER]?.rivals ?? {};
  return Math.max(0, ...Object.keys(before).map((id) => Math.abs((after[id]?.impressionShare ?? 0) - before[id].impressionShare)));
}
const ORDINARY = [[2, 3], [3, 4], [5, 6], [6, 7], [7, 8], [9, 10], [10, 11], [11, 12]];

/** One whole game, measured. */
export async function marketRow({ seed, cell }) {
  const { state, insights } = await playMarket({ seed, cell });
  const standings = finalStandings(state);
  const rivals = state.advertisers.filter((a) => a.id !== PLAYER).map((a) => a.id);
  const week5 = state.history.find((h) => h.round === 5);
  const ordinary = median(ORDINARY.map(([a, b]) => largestStep(insights, a, b)));
  return {
    seed,
    cell,
    net: gameTotals(state.history, PLAYER).all.netProfitPaise,
    rank: standings.findIndex((r) => r.id === PLAYER) + 1,
    player: economics(state.history, [PLAYER]),
    rivals: economics(state.history, rivals),
    rivalMonth2: rivals.map((id) => week5.byAdvertiser[id].budget.monthlyBudgetPaise),
    playerMonth2: week5.byAdvertiser[PLAYER].budget.monthlyBudgetPaise,
    step5: largestStep(insights, 4, 5) / ordinary,
    step9: largestStep(insights, 8, 9) / ordinary,
  };
}

/** D12's comparison on one market: forked at week 5, nothing against four investments. */
export const INVESTMENTS = {
  keep: {},
  photography: { photography: CAPEX_ALLOCATION_PAISE },
  sizeGuide: { sizeGuide: 8000000 },
  landingPage: { landingPage: 8000000 },
  orderConfirmation: { orderConfirmation: 8000000 },
};
export async function capitalRow({ seed, cell }) {
  const { state: before } = await playMarket({ seed, cell, rounds: 4 });
  // Every rival's profit beside the player's, for the page gates' G8 (the owner,
  // 2026-09-17). The player's figures are where they always were.
  const out = { seed, cell, rivals: {} };
  for (const [name, capex] of Object.entries(INVESTMENTS)) {
    const { state } = await playMarket({
      seed, cell, from: structuredClone(before), playerDecision: (round) => (round === 5 ? { capex } : null),
    });
    out[name] = gameTotals(state.history, PLAYER).all.netProfitPaise;
    out.rivals[name] = rivalProfits(state);
  }
  return out;
}

/**
 * The pages a player can buy at round 0, for the `page` mode: nothing, and one of
 * each kind of sentence the page ladder writes — a size chart, reviews, the top
 * page, product shots (content/landingPage.js). Each is bought alone, so a
 * difference is that page's.
 *
 * The last two were added for grading only what Google names (the owner's C,
 * 2026-09-17), whose gates need them: the faster page earns its point by length
 * today and for speed after, so it must not move; a chart with shots, bought
 * without the page, loses one point.
 */
export const ROUND0_PAGES = Object.freeze({
  keep: {},
  guide: { sizeGuide: 2500000 },
  reviews: { landingPage: 5500000 },
  topPage: { landingPage: 8000000 },
  photography: { photography: 5000000 },
  fasterPage: { landingPage: 2500000 },
  guideShots: { sizeGuide: 2500000, photography: 5000000 },
});

/**
 * The round-0 pages the page gates were agreed over. Pinned, so they still read
 * the runs made before `fasterPage` and `guideShots` existed.
 */
const I37_PAGES = Object.freeze(['keep', 'guide', 'reviews', 'topPage', 'photography']);

/**
 * Grading the page as it stands, on one market: whole games with each round-0
 * page, the week-5 capital decision the form always sends still sent (C8).
 * Today such a page is graded from week 1; as it stands, from the week it lands.
 */
export async function pageRow({ seed, cell }) {
  const out = { seed, cell };
  for (const [name, capex] of Object.entries(ROUND0_PAGES)) {
    const { state } = await playMarket({ seed, cell, capex });
    out[name] = { net: gameTotals(state.history, PLAYER).all.netProfitPaise, rivals: rivalProfits(state) };
  }
  return out;
}

/**
 * The gates the owner agreed before any run, for grading the page as it stands
 * (2026-09-17). Hard gates stop the change; stop-and-show gates bring the
 * numbers to the owner before it lands.
 *
 * - G1 (hard): `market` mode's player buys no page and rivals' page grades are
 *   authored, so every row must match exactly.
 * - G2 (hard): at week 5, keeping the money and order confirmation write no
 *   sentence, so their rows must match exactly in every market.
 * - G6 (stop): the median advantage over keeping, of week-5 photography, size
 *   guide and page, must not fall — they gain description points from week 8.
 * - G7 (stop): no round-0 page may go from beating keep to not, nor lose more
 *   than a quarter of its median advantage. It loses three weeks of twelve;
 *   25% is the owner-accepted judgment, not a measurement.
 * - G8 (stop): no rival's median profit may move more than 5% either way, in any
 *   week-5 investment or round-0 page.
 *
 * G3-G5 are tests and calibration, not harness figures.
 *
 * @param {{market: {before: object[], after: object[]}, capital: {before: object[], after: object[]},
 *   page: {before: object[], after: object[]}}} runs rows as the three modes write them
 * @returns {object} each gate's figures and verdict, `hardOk` and `stopOk`
 */
export function pageGates({ market, capital, page }) {
  const key = (r) => `${r.seed}|${r.cell}`;
  const byKey = (rows) => new Map(rows.map((r) => [key(r), r]));

  const marketAfter = byKey(market.after);
  const marketDiffer = market.before.map(key)
    .filter((k) => JSON.stringify(byKey(market.before).get(k)) !== JSON.stringify(marketAfter.get(k)));
  if (market.after.length !== market.before.length) marketDiffer.push('the number of markets');

  const capitalAfter = byKey(capital.after);
  const fixedDiffer = capital.before.filter((r) => ['keep', 'orderConfirmation']
    .some((t) => capitalAfter.get(key(r))?.[t] !== r[t])).map(key);

  const advantage = (rows, t, keep = 'keep', net = (r, n) => r[n]) => median(rows.map((r) => net(r, t) - net(r, keep)));
  const capitalGain = ['photography', 'sizeGuide', 'landingPage'].map((target) => {
    const before = advantage(capital.before, target);
    const after = advantage(capital.after, target);
    return { target, before, after, ok: after >= before };
  });

  const pageNet = (r, n) => r[n].net;
  const pageCheck = I37_PAGES.filter((n) => n !== 'keep').map((name) => {
    const before = advantage(page.before, name, 'keep', pageNet);
    const after = advantage(page.after, name, 'keep', pageNet);
    const flipped = before > 0 && after <= 0;
    const lossShare = before > 0 ? (before - after) / before : 0;
    return { name, before, after, flipped, lossShare, ok: !flipped && lossShare <= 0.25 };
  });

  const rivalMoves = [];
  const rivalCheck = (mode, rows, variants, profits) => {
    for (const variant of variants) {
      const ids = Object.keys(profits(rows.before[0], variant));
      for (const id of ids) {
        const before = median(rows.before.map((r) => profits(r, variant)[id]));
        const after = median(rows.after.map((r) => profits(r, variant)[id]));
        const change = (after - before) / Math.abs(before);
        rivalMoves.push({ mode, variant, id, before, after, change, ok: Math.abs(change) <= 0.05 });
      }
    }
  };
  rivalCheck('capital', capital, Object.keys(INVESTMENTS), (r, v) => r.rivals[v]);
  rivalCheck('page', page, I37_PAGES, (r, v) => r[v].rivals);

  const out = {
    market: { ok: marketDiffer.length === 0, differ: marketDiffer },
    capitalFixed: { ok: fixedDiffer.length === 0, differ: fixedDiffer },
    capitalGain,
    page: pageCheck,
    rivals: rivalMoves,
  };
  out.hardOk = out.market.ok && out.capitalFixed.ok;
  out.stopOk = capitalGain.every((g) => g.ok) && pageCheck.every((p) => p.ok) && rivalMoves.every((r) => r.ok);
  return out;
}

/**
 * The gates the owner agreed before any run for grading only what Google names
 * (design/photography-point/, C, 2026-09-17): the 40-character rule goes and
 * the faster page's sentence earns its point for speed. Over all 64 rung
 * combinations, a page with capital on the page itself grades exactly as
 * before, and one without it loses exactly one point when a size chart or shots
 * are bought, so:
 *
 * - hard: `market` mode's player buys no capital, so every row is identical.
 * - hard: at week 5, keeping, order confirmation and the page itself (₹80,000)
 *   are identical in every market, the player's profit and every rival's.
 * - hard: at round 0, keeping, reviews, the top page and the faster page are
 *   identical in every market, rivals included.
 * - stop: the five purchases that lose a point (round-0 size chart, shots, and
 *   both together; week-5 size guide and photography) may not go from beating
 *   keep to not, in the median market, nor lose more than a quarter of their
 *   median advantage. The quarter is the judgment the owner accepted for I37.
 * - stop: no rival's median profit moves more than 5% either way, in any variant.
 * - shown, not a gate: the round-0 purchases ranked by median advantage.
 *
 * The 64-combination rule, the screen equalling the auction, and calibration's
 * figures are tests, not harness figures.
 *
 * @param {{market: {before: object[], after: object[]}, capital: {before: object[], after: object[]},
 *   page: {before: object[], after: object[]}}} runs rows as the three modes write them
 * @returns {object} each gate's figures and verdict, `hardOk` and `stopOk`
 */
export function speedGates({ market, capital, page }) {
  const key = (r) => `${r.seed}|${r.cell}`;
  const byKey = (rows) => new Map(rows.map((r) => [key(r), r]));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  const marketBefore = byKey(market.before);
  const marketAfter = byKey(market.after);
  const marketDiffer = [...marketBefore.keys()].filter((k) => !same(marketBefore.get(k), marketAfter.get(k)));
  if (market.after.length !== market.before.length) marketDiffer.push('the number of markets');

  const fixed = (rows, names, pick) => {
    const after = byKey(rows.after);
    return rows.before.flatMap((r) => names
      .filter((name) => !same(pick(r, name), after.get(key(r)) && pick(after.get(key(r)), name)))
      .map((name) => `${key(r)} ${name}`));
  };
  const capitalDiffer = fixed(capital, ['keep', 'orderConfirmation', 'landingPage'], (r, n) => [r[n], r.rivals[n]]);
  const pageDiffer = fixed(page, ['keep', 'reviews', 'topPage', 'fasterPage'], (r, n) => r[n]);

  const advantage = (rows, name, net) => median(rows.map((r) => net(r, name) - net(r, 'keep')));
  const bounded = (label, rows, name, net) => {
    const before = advantage(rows.before, name, net);
    const after = advantage(rows.after, name, net);
    const flipped = before > 0 && after <= 0;
    const lossShare = before > 0 ? (before - after) / before : 0;
    return { name: `${label} ${name}`, before, after, flipped, lossShare, ok: !flipped && lossShare <= 0.25 };
  };
  const pageNet = (r, n) => r[n].net;
  const capitalNet = (r, n) => r[n];
  const weaker = [
    ...['guide', 'photography', 'guideShots'].map((name) => bounded('page', page, name, pageNet)),
    ...['sizeGuide', 'photography'].map((name) => bounded('capital', capital, name, capitalNet)),
  ];

  const rivalMoves = [];
  const rivalCheck = (mode, rows, variants, profits) => {
    for (const variant of variants) {
      for (const id of Object.keys(profits(rows.before[0], variant))) {
        const before = median(rows.before.map((r) => profits(r, variant)[id]));
        const after = median(rows.after.map((r) => profits(r, variant)[id]));
        const change = (after - before) / Math.abs(before);
        rivalMoves.push({ mode, variant, id, before, after, change, ok: Math.abs(change) <= 0.05 });
      }
    }
  };
  rivalCheck('capital', capital, Object.keys(INVESTMENTS), (r, v) => r.rivals[v]);
  rivalCheck('page', page, Object.keys(ROUND0_PAGES), (r, v) => r[v].rivals);

  const ranked = (rows) => Object.keys(ROUND0_PAGES).filter((n) => n !== 'keep')
    .map((name) => [name, advantage(rows, name, pageNet)])
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  const out = {
    market: { ok: marketDiffer.length === 0, differ: marketDiffer },
    capitalFixed: { ok: capitalDiffer.length === 0, differ: capitalDiffer },
    pageFixed: { ok: pageDiffer.length === 0, differ: pageDiffer },
    weaker,
    rivals: rivalMoves,
    ranking: { before: ranked(page.before), after: ranked(page.after) },
  };
  out.hardOk = out.market.ok && out.capitalFixed.ok && out.pageFixed.ok;
  out.stopOk = weaker.every((w) => w.ok) && rivalMoves.every((r) => r.ok);
  return out;
}

/** Every rival's final net profit, by id. */
const rivalProfits = (state) => Object.fromEntries(state.advertisers
  .filter((a) => a.id !== PLAYER)
  .map((a) => [a.id, gameTotals(state.history, a.id).all.netProfitPaise]));

/**
 * I11's comparison on one market: the player hiring the agency, and the same
 * player writing its own ad (OWN_AD). `written` is the grade that ad gets in
 * this cell, the figure the owner agreed counts as a careful self-written ad.
 */
export async function writerRow({ seed, cell }) {
  const out = { seed, cell };
  for (const [key, writerTier] of [['hired', 'agency'], ['own', 'diy']]) {
    const { state } = await playMarket({ seed, cell, writerTier });
    out[key] = {
      net: gameTotals(state.history, PLAYER).all.netProfitPaise,
      rank: finalStandings(state).findIndex((r) => r.id === PLAYER) + 1,
      rivals: rivalProfits(state),
    };
  }
  const player = harnessPlayer(cell, 'diy');
  const rivalNames = BRAND_IDENTITIES.filter((b) => b.id !== PLAYER).map((b) => b.name);
  const { expectedCtr, adRelevance, landingPage } = gradeAdOffline(player.ad, { keywords: player.keywords, rivalNames }, 0);
  out.written = { expectedCtr, adRelevance, landingPage };
  return out;
}

/**
 * The gates agreed with the owner before the run (spec section 5): the
 * self-writing player's median rank improves by at most one place; the hiring
 * player does not move at all, since nothing it touches changed; and no
 * rival's median profit, in the self-writer's markets, falls by more than 5%.
 *
 * @param {object[]} before - writerRow rows
 * @param {object[]} after - writerRow rows, the same markets
 */
export function writerGates(before, after) {
  const key = (r) => `${r.seed}|${r.cell}`;
  const then = new Map(before.map((r) => [key(r), r]));
  const rank = { before: median(before.map((r) => r.own.rank)), after: median(after.map((r) => r.own.rank)) };
  rank.ok = rank.before - rank.after <= 1;
  const hiredUnmoved = after.every((r) => {
    const was = then.get(key(r));
    return Boolean(was) && was.hired.net === r.hired.net && was.hired.rank === r.hired.rank;
  });
  const ids = Object.keys(before[0].own.rivals);
  const rivals = ids.map((id) => {
    const b = median(before.map((r) => r.own.rivals[id]));
    const a = median(after.map((r) => r.own.rivals[id]));
    const change = (a - b) / Math.abs(b);
    return { id, before: b, after: a, change, ok: change >= -0.05 };
  });
  return { rank, hiredUnmoved, rivals, ok: rank.ok && hiredUnmoved && rivals.every((r) => r.ok) };
}

/** The rungs a player can pick (I34), none first. */
export const RUNGS = PREPAID_DISCOUNT_CURVE.map((r) => r.paise);

/**
 * The harness player with a prepaid discount from week 1. It still sends the
 * week-5 capital decision the form always sends: a decision that dropped it would
 * lose the second allocation and measure a poorer player (C8).
 */
export const prepaidDecision = (paise) => (round, state) => {
  const decision = { ...(keepAtWindow(round, state) ?? {}) };
  if (round === 1 && paise > 0) decision.campaign = { prepaidDiscountPaise: paise };
  return Object.keys(decision).length > 0 ? decision : null;
};

/** I34's comparison on one market: whole games at every rung, against none. */
export async function prepaidRow({ seed, cell }) {
  const out = { seed, cell };
  for (const paise of RUNGS) {
    const { state } = await playMarket({ seed, cell, playerDecision: prepaidDecision(paise) });
    out[paise] = gameTotals(state.history, PLAYER).all.netProfitPaise;
  }
  return out;
}

/** Every cell one step from `cell`: where a week-5 move may go (spec 4.5). */
export const movesFrom = (cell) => CELLS.filter((to) => isOneStep(parseCell(cell), parseCell(to)));

/**
 * The harness player moving at week 5. Merged into the capital decision the form
 * always sends that week, for prepaid's reason: a decision that dropped it would
 * lose the second allocation and measure a poorer player (C8).
 */
export const moveDecision = (to) => (round, state) => {
  const decision = { ...(keepAtWindow(round, state) ?? {}) };
  if (round === REPOSITION_ROUND) decision.position = to;
  return Object.keys(decision).length > 0 ? decision : null;
};

/**
 * F18's comparison on one market: a whole game for every move the cell has.
 *
 * `soldBeforeNet` is the weeks sold before the move, as they finally stand. No
 * later decision may change them, so a move that does is a report re-pricing
 * old orders, which is what F18 found.
 */
export async function moveRow({ seed, cell }) {
  const out = { seed, cell };
  for (const to of movesFrom(cell)) {
    const { state } = await playMarket({ seed, cell, playerDecision: moveDecision(parseCell(to)) });
    const { weeks, all } = gameTotals(state.history, PLAYER);
    const month3 = state.history.find((h) => h.round === 2 * ROUNDS_PER_MONTH + 1);
    out[to] = {
      net: all.netProfitPaise,
      rank: finalStandings(state).findIndex((r) => r.id === PLAYER) + 1,
      week8Rank: rankOf(state, PLAYER).position,
      month3BudgetPaise: month3.byAdvertiser[PLAYER].budget.monthlyBudgetPaise,
      soldBeforeNet: weeks.filter((w) => w.round < REPOSITION_ROUND).reduce((t, w) => t + w.netProfitPaise, 0),
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Running it
// ---------------------------------------------------------------------------

const rupees = (p) => Math.round(p / 100).toLocaleString('en-IN');
const pct = (x) => `${(100 * x).toFixed(1)}%`;

function summariseMarket(rows) {
  const m = (f) => median(rows.map(f));
  const line = (who) => `CTR ${pct(m((r) => r[who].ctr))}  CPC ₹${(m((r) => r[who].cpcPaise) / 100).toFixed(1)}`
    + `  conversion ${pct(m((r) => r[who].conv))}  gross ROAS ${m((r) => r[who].grossRoas).toFixed(2)}`
    + `  net ROAS ${m((r) => r[who].netRoas).toFixed(2)}  profit per ₹ ${m((r) => r[who].profitPerRupee).toFixed(2)}`
    + `  returned ${pct(m((r) => r[who].returned))}`;
  const month2 = rows.flatMap((r) => r.rivalMonth2);
  const ranks = rows.map((r) => r.rank);
  return [
    `${rows.length} markets`,
    `player, settled weeks 1-7: ${line('player')}`,
    `rivals, settled weeks 1-7: ${line('rivals')}`,
    `player final net profit: median ₹${rupees(m((r) => r.net))}; loses money in ${rows.filter((r) => r.net < 0).length} of ${rows.length}`,
    `player final rank: median ${m((r) => r.rank)}; ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => `${k}:${ranks.filter((x) => x === k).length}`).join(' ')}`,
    `player month-2 budget: median ₹${rupees(m((r) => r.playerMonth2))}`,
    `rivals' month-2 budgets: median ₹${rupees(median(month2))}, from ₹${rupees(Math.min(...month2))} to ₹${rupees(Math.max(...month2))}`,
    `largest rival move against an ordinary week: into week 5 ${m((r) => r.step5).toFixed(2)}x, into week 9 ${m((r) => r.step9).toFixed(2)}x`,
  ].join('\n');
}

function summariseCapital(rows) {
  const targets = Object.keys(INVESTMENTS).filter((k) => k !== 'keep');
  const gain = (r, t) => (r[t] - r.keep) / 100;
  const best = (r) => Math.max(...targets.map((t) => gain(r, t)));
  const out = [`${rows.length} markets: investing the whole allocation at week 5, against keeping it as ad money`];
  for (const t of targets) {
    const g = rows.map((r) => gain(r, t));
    out.push(`  ${t.padEnd(18)} median ₹${rupees(median(g) * 100)}; wins in ${g.filter((x) => x > 0).length} of ${rows.length}`);
  }
  out.push('  best of the four, by cell:');
  for (const cell of CELLS) {
    const g = rows.filter((r) => r.cell === cell).map(best);
    out.push(`    ${cell.padEnd(20)} median ₹${rupees(median(g) * 100)}; wins in ${g.filter((x) => x > 0).length} of ${g.length}`);
  }
  return out.join('\n');
}

function summariseWriter(rows) {
  const m = (f) => median(rows.map(f));
  const grades = [...new Set(rows.map((r) => `${r.cell} ${r.written.expectedCtr}/${r.written.adRelevance}`))];
  return [
    `${rows.length} markets`,
    `the self-written ad grades (expected CTR / ad relevance): ${grades.join(', ')}`,
    `hiring the agency: median rank ${m((r) => r.hired.rank)}, median net ₹${rupees(m((r) => r.hired.net))}`,
    `writing it: median rank ${m((r) => r.own.rank)}, median net ₹${rupees(m((r) => r.own.net))}`,
  ].join('\n');
}

function printGates(beforeFile, afterFile) {
  const out = writerGates(JSON.parse(readFileSync(beforeFile, 'utf8')), JSON.parse(readFileSync(afterFile, 'utf8')));
  console.log(`self-writer's median rank: ${out.rank.before} -> ${out.rank.after}  ${out.rank.ok ? 'PASS' : 'FAIL'}`);
  console.log(`the hiring player unmoved in every market: ${out.hiredUnmoved ? 'PASS' : 'FAIL'}`);
  for (const r of out.rivals) {
    console.log(`  ${r.id.padEnd(12)} median ₹${rupees(r.before)} -> ₹${rupees(r.after)} (${pct(r.change)})  ${r.ok ? 'PASS' : 'FAIL'}`);
  }
  console.log(out.ok ? 'ALL GATES PASS' : 'A GATE FAILED');
}

function summarisePrepaid(rows) {
  const gain = (r, paise) => (r[paise] - r[0]) / Math.abs(r[0]);
  const paid = RUNGS.slice(1);
  const out = [`${rows.length} markets: a prepaid discount from week 1 at each rung, against none (I34)`];
  out.push(`  ${'cell'.padEnd(20)}${paid.map((p) => `₹${p / 100}`.padStart(17)).join('')}   best`);
  for (const cell of CELLS) {
    const mine = rows.filter((r) => r.cell === cell);
    const medians = paid.map((p) => median(mine.map((r) => gain(r, p))));
    const wins = paid.map((p) => mine.filter((r) => r[p] > r[0]).length);
    const top = medians.reduce((b, m, i) => (m > b.m ? { m, i } : b), { m: 0, i: -1 });
    const best = top.i < 0 ? 'none' : `₹${paid[top.i] / 100}`;
    out.push(`  ${cell.padEnd(20)}${medians.map((m, i) => `${pct(m)} (${wins[i]}/${mine.length})`.padStart(17)).join('')}   ${best}`);
  }
  return out.join('\n');
}

function summarisePage(rows) {
  const out = [`${rows.length} markets: one page bought at round 0, whole games, against buying none`];
  for (const name of Object.keys(ROUND0_PAGES).filter((n) => n !== 'keep')) {
    const g = rows.map((r) => r[name].net - r.keep.net);
    out.push(`  ${name.padEnd(12)} median ₹${rupees(median(g))} over keeping; wins in ${g.filter((x) => x > 0).length} of ${rows.length}`);
  }
  return out.join('\n');
}

/** Read one labelled run of each mode the page gates need, from the temp folder. */
const runOf = (label, mode) => JSON.parse(readFileSync(join(tmpdir(), `harness-${label}-${mode}.json`), 'utf8'));

function printPageGates(beforeLabel, afterLabel) {
  const pair = (mode) => ({ before: runOf(beforeLabel, mode), after: runOf(afterLabel, mode) });
  const out = pageGates({ market: pair('market'), capital: pair('capital'), page: pair('page') });
  const verdict = (ok, word = 'FAIL') => (ok ? 'PASS' : word);
  console.log(`G1 market mode identical: ${verdict(out.market.ok)}${out.market.ok ? '' : ` (${out.market.differ.join(', ')})`}`);
  console.log(`G2 keep and order confirmation identical at week 5: ${verdict(out.capitalFixed.ok)}`
    + `${out.capitalFixed.ok ? '' : ` (${out.capitalFixed.differ.join(', ')})`}`);
  for (const g of out.capitalGain) {
    console.log(`G6 week-5 ${g.target.padEnd(12)} median over keep ₹${rupees(g.before)} -> ₹${rupees(g.after)}  ${verdict(g.ok, 'STOP')}`);
  }
  for (const p of out.page) {
    console.log(`G7 round-0 ${p.name.padEnd(12)} median over keep ₹${rupees(p.before)} -> ₹${rupees(p.after)}`
      + ` (${pct(-p.lossShare)}${p.flipped ? ', no longer beats keep' : ''})  ${verdict(p.ok, 'STOP')}`);
  }
  const moved = out.rivals.filter((r) => !r.ok);
  const widest = out.rivals.reduce((w, r) => (Math.abs(r.change) > Math.abs(w.change) ? r : w), out.rivals[0]);
  console.log(`G8 rivals within 5%: ${verdict(moved.length === 0, 'STOP')}; widest ${widest.mode} ${widest.variant} ${widest.id} ${pct(widest.change)}`);
  for (const r of moved) console.log(`   ${r.mode} ${r.variant} ${r.id}: ₹${rupees(r.before)} -> ₹${rupees(r.after)} (${pct(r.change)})`);
  console.log(out.hardOk ? (out.stopOk ? 'ALL GATES PASS' : 'HARD GATES PASS; A STOP GATE TRIPPED: show the owner') : 'A HARD GATE FAILED');
}

function printSpeedGates(beforeLabel, afterLabel) {
  const pair = (mode) => ({ before: runOf(beforeLabel, mode), after: runOf(afterLabel, mode) });
  const out = speedGates({ market: pair('market'), capital: pair('capital'), page: pair('page') });
  const verdict = (ok, word = 'FAIL') => (ok ? 'PASS' : word);
  const differ = (gate) => (gate.ok ? '' : ` (${gate.differ.slice(0, 8).join(', ')}${gate.differ.length > 8 ? ', …' : ''})`);
  console.log(`hard: market mode identical: ${verdict(out.market.ok)}${differ(out.market)}`);
  console.log(`hard: week 5 keep, order confirmation, the page itself identical: ${verdict(out.capitalFixed.ok)}${differ(out.capitalFixed)}`);
  console.log(`hard: round 0 keep, reviews, top page, faster page identical: ${verdict(out.pageFixed.ok)}${differ(out.pageFixed)}`);
  for (const w of out.weaker) {
    console.log(`stop: ${w.name.padEnd(20)} median over keep ₹${rupees(w.before)} -> ₹${rupees(w.after)}`
      + ` (${pct(-w.lossShare)}${w.flipped ? ', no longer beats keep' : ''})  ${verdict(w.ok, 'STOP')}`);
  }
  const moved = out.rivals.filter((r) => !r.ok);
  const widest = out.rivals.reduce((w, r) => (Math.abs(r.change) > Math.abs(w.change) ? r : w), out.rivals[0]);
  console.log(`stop: rivals within 5%: ${verdict(moved.length === 0, 'STOP')}; widest ${widest.mode} ${widest.variant} ${widest.id} ${pct(widest.change)}`);
  for (const r of moved) console.log(`   ${r.mode} ${r.variant} ${r.id}: ₹${rupees(r.before)} -> ₹${rupees(r.after)} (${pct(r.change)})`);
  console.log(`shown: round-0 purchases by median advantage, before: ${out.ranking.before.join(' > ')}`);
  console.log(`                                              after:  ${out.ranking.after.join(' > ')}`);
  console.log(out.hardOk ? (out.stopOk ? 'ALL GATES PASS' : 'HARD GATES PASS; A STOP GATE TRIPPED: show the owner') : 'A HARD GATE FAILED');
}

function summariseMove(rows) {
  const out = [`${rows.length} markets: the player moves one step at week 5, every move its cell has (F18); medians`];
  out.push(`  ${'move'.padEnd(42)}${'net profit'.padStart(13)}${'rank'.padStart(6)}${'week-8 rank'.padStart(13)}`
    + `${'month-3 budget'.padStart(16)}${'weeks 1-4 net'.padStart(15)}`);
  for (const cell of CELLS) {
    for (const to of movesFrom(cell)) {
      const games = rows.filter((r) => r.cell === cell).map((r) => r[to]);
      const m = (f) => median(games.map(f));
      out.push(`  ${`${cell} to ${to}`.padEnd(42)}${`₹${rupees(m((g) => g.net))}`.padStart(13)}`
        + `${String(m((g) => g.rank)).padStart(6)}${String(m((g) => g.week8Rank)).padStart(13)}`
        + `${`₹${rupees(m((g) => g.month3BudgetPaise))}`.padStart(16)}${`₹${rupees(m((g) => g.soldBeforeNet))}`.padStart(15)}`);
    }
  }
  return out.join('\n');
}

const MODES = {
  market: [marketRow, summariseMarket],
  capital: [capitalRow, summariseCapital],
  writer: [writerRow, summariseWriter],
  prepaid: [prepaidRow, summarisePrepaid],
  move: [moveRow, summariseMove],
  page: [pageRow, summarisePage],
};

async function worker(mode, outFile, seeds) {
  const [row] = MODES[mode];
  const rows = [];
  for (const seed of seeds) for (const cell of CELLS) rows.push(await row({ seed, cell }));
  writeFileSync(outFile, JSON.stringify(rows));
}

async function main(mode, label, workers) {
  if (!MODES[mode]) throw new Error(`mode must be ${Object.keys(MODES).join(', ')}, or compare`);
  const dir = mkdtempSync(join(tmpdir(), 'harness-'));
  const groups = Array.from({ length: workers }, () => []);
  SEEDS.forEach((seed, i) => groups[i % workers].push(seed));
  const self = fileURLToPath(import.meta.url);
  const files = await Promise.all(groups.filter((g) => g.length > 0).map((seeds, i) => new Promise((resolve, reject) => {
    const file = join(dir, `part-${i}.json`);
    fork(self, ['--worker', mode, file, ...seeds.map(String)])
      .on('exit', (code) => (code === 0 ? resolve(file) : reject(new Error(`worker ${i} exited ${code}`))));
  })));
  const rows = files.flatMap((f) => JSON.parse(readFileSync(f, 'utf8')));
  const out = join(tmpdir(), `harness-${label}-${mode}.json`);
  writeFileSync(out, JSON.stringify(rows, null, 1));
  console.log(MODES[mode][1](rows));
  console.log(`\nrows written to ${out}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [first, ...rest] = process.argv.slice(2);
  if (first === '--worker') {
    const [mode, outFile, ...seeds] = rest;
    await worker(mode, outFile, seeds.map(Number));
  } else if (first === 'compare') {
    printGates(rest[0], rest[1]);
  } else if (first === 'pagegates') {
    printPageGates(rest[0], rest[1]);
  } else if (first === 'speedgates') {
    printSpeedGates(rest[0], rest[1]);
  } else {
    await main(first, rest[0] ?? 'run', Number(rest[1] ?? 6));
  }
}
