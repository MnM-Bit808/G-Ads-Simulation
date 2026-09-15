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
 *   node scripts/market-harness.js compare <before.json> <after.json>
 *
 * `market` plays 72 whole games (seeds 1-12, the six cells) and reports F15's
 * economics, the player's profit and rank, every rival's month-2 budget, and how
 * far rivals move into weeks 5 and 9 against an ordinary week. `capital` is
 * D12's comparison: forked at week 5, committing nothing against four ways of
 * investing the whole allocation. `prepaid` is I34's comparison: every rung from
 * week 1 against none, whole games. Each writes `harness-<label>-<mode>.json` to
 * the system temp folder and prints a summary.
 */
import { writeFileSync, readFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fork } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startGame } from '../setup.js';
import { playRound } from '../game.js';
import { controllerFor } from '../agents/policies.js';
import { gameTotals, finalStandings } from '../ui/ending.js';
import { QUERY_SET } from '../content/querySet.js';
import { BRAND_IDENTITIES } from '../content/brands.js';
import { homeCell } from '../engine/querySet.js';
import { allCells, parseCell, businessFor, realisedBreakEvenCpcPaise } from '../engine/positions.js';
import { TOTAL_ROUNDS, CAPEX_ALLOCATION_PAISE, PREPAID_DISCOUNT_CURVE } from '../engine/constants.js';
import { gradeAdOffline } from '../agents/grader.js';

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
  landingPageDescription: 'A plain product page.',
};

/**
 * What the same player writes when it writes its own ad: one per square, as a
 * careful player would, in the words of that square's own keywords (I11's
 * measurement, agreed with the owner before the first run). The grader scores
 * relevance against your own keywords, so a careful writer echoes them; a
 * strong self-writer is also where the new rule could be too generous, which is
 * what the gates are there to catch. The page is AD's, so only the writing
 * differs from the hiring player.
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
 * @param {string} cell 'price|purpose'
 * @param {string} [writerTier] - 'agency', or 'diy' for the self-writing player
 * @returns {object} the `player` argument of `startGame`
 */
export function harnessPlayer(cell, writerTier = 'agency') {
  const position = parseCell(cell);
  const breakEven = realisedBreakEvenCpcPaise(businessFor(position, EMPTY_CAPEX, 1), QUERY_SET, position);
  const own = QUERY_SET.queries.filter((q) => homeCell(q) === cell)
    .sort((a, b) => b.volumeShareBp - a.volumeShareBp)
    .slice(0, 6);
  const brand = QUERY_SET.queries.find((q) => q.intent === 'brand' && q.brandOwner === PLAYER);
  return {
    position,
    // An allocation of nothing: the whole ₹1,20,000 rolls into month 1 (C8).
    capex: {},
    keywords: [
      ...own.map((q) => ({ text: q.text, matchType: 'phrase', bidPaise: Math.round(breakEven * 0.7) })),
      { text: brand.text, matchType: 'exact', bidPaise: Math.round(breakEven * 1.2) },
    ],
    // A hired writer's ad runs at the writer's level whatever it says, so the
    // hiring player keeps the one ad; the self-writer writes its square's own.
    ad: writerTier === 'diy' ? { ...OWN_AD[cell], landingPageDescription: AD.landingPageDescription } : AD,
    writerTier,
  };
}

/** What the form sends when the player leaves the capital card alone. */
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
 * @param {string} [options.writerTier] - who writes the player's ad
 * @returns {Promise<{state: object, insights: object[]}>}
 */
export async function playMarket({
  seed, cell, from = null, rounds = TOTAL_ROUNDS, playerDecision = keepAtWindow, writerTier = 'agency',
}) {
  let state = from ?? startGame({
    rootSeed: seed, playerBrandId: PLAYER, querySet: QUERY_SET, player: harnessPlayer(cell, writerTier),
  });
  const live = state.advertisers.filter((a) => a.policyId).length;
  if (live !== state.advertisers.length - 1) throw new Error(`rivals are not live (${live}), so this measures nothing`);
  const insights = [];
  while (state.round <= rounds) {
    const round = state.round;
    const current = state;
    const controllers = {};
    for (const a of state.advertisers) {
      controllers[a.id] = a.policyId ? controllerFor(a.policyId) : () => playerDecision(round, current);
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
  const out = { seed, cell };
  for (const [name, capex] of Object.entries(INVESTMENTS)) {
    const { state } = await playMarket({
      seed, cell, from: structuredClone(before), playerDecision: (round) => (round === 5 ? { capex } : null),
    });
    out[name] = gameTotals(state.history, PLAYER).all.netProfitPaise;
  }
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

const MODES = {
  market: [marketRow, summariseMarket],
  capital: [capitalRow, summariseCapital],
  writer: [writerRow, summariseWriter],
  prepaid: [prepaidRow, summarisePrepaid],
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
  } else {
    await main(first, rest[0] ?? 'run', Number(rest[1] ?? 6));
  }
}
