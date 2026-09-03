/**
 * A playable nine-advertiser game state, built on the real query set.
 *
 * Every advertiser bids on the head terms of its own territory, which is what
 * a competent opening looks like. Tests then deform one thing at a time.
 */

import { QUERY_SET } from '../../content/querySet.js';
import { BRAND_IDENTITIES } from '../../content/brands.js';
import { homeCell } from '../../engine/querySet.js';
import {
  allCells, parseCell, businessFor, breakEvenCpcPaise,
} from '../../engine/positions.js';
import {
  SCHEMA_VERSION, MONTHLY_BUDGET_PAISE, ROUNDS_PER_MONTH,
} from '../../engine/constants.js';

const CELLS = allCells();
const EMPTY_CAPEX = { committed: { sizeGuide: 0, photography: 0, landingPage: 0 }, pending: [] };

/**
 * Small per-advertiser variation in ad quality.
 *
 * Without it two advertisers sharing a cell are byte-identical, their ad ranks
 * tie exactly, and the auction's alphabetical tie-break hands one of them
 * every top slot for the whole game. Real advertisers are never identical;
 * a fixture that makes them so tests a market that cannot exist.
 */
const GRADE_VARIATION = [
  { expectedCtr: 6, adRelevance: 7, landingPage: 6 },
  { expectedCtr: 7, adRelevance: 6, landingPage: 5 },
  { expectedCtr: 5, adRelevance: 8, landingPage: 7 },
  { expectedCtr: 8, adRelevance: 5, landingPage: 6 },
  { expectedCtr: 6, adRelevance: 6, landingPage: 8 },
  { expectedCtr: 7, adRelevance: 7, landingPage: 4 },
  { expectedCtr: 4, adRelevance: 7, landingPage: 7 },
  { expectedCtr: 9, adRelevance: 4, landingPage: 5 },
  { expectedCtr: 5, adRelevance: 6, landingPage: 9 },
];

/** Nine advertisers over six cells: three cells double up. */
function positionFor(index) {
  return { ...parseCell(CELLS[index % CELLS.length]), setAtRound: 0, repositionedAtRound: null };
}

/**
 * A bid a competent advertiser in this cell would actually make: comfortably
 * under its own net break-even.
 *
 * The first fixture gave everyone the same 2500 paise, which is nearly double
 * what the Value tier can afford. Every Value advertiser was structurally
 * bankrupt and the whole market read as broken when it was the fixture that
 * was wrong.
 */
function bidFor(position) {
  const business = businessFor(position, EMPTY_CAPEX, 1);
  return Math.round(breakEvenCpcPaise(business) * 0.70);
}

/**
 * The head terms of an advertiser's own territory.
 *
 * The fourth keyword is broad. Without at least one, every advertiser sits in
 * its own lane on exact and phrase, auctions draw two entrants against four
 * slots, and nothing is ever lost to rank - the market looks placid because
 * nobody ever meets anyone.
 */
function keywordsFor(cell, bidPaise) {
  const own = QUERY_SET.queries.filter((q) => homeCell(q) === cell && q.isHeadTerm);
  return own.slice(0, 4).map((q, i) => ({
    id: `kw_${i + 1}`,
    text: q.text,
    matchType: i === 0 ? 'exact' : i === 3 ? 'broad' : 'phrase',
    bidPaise,
    active: true,
    tags: [...q.tags],
    taggedContentHash: 'sha1:fixture',
  }));
}

/**
 * @param {object} [over] shallow overrides applied to every advertiser
 * @returns {object[]}
 */
export function makeAdvertisers(over = {}) {
  return BRAND_IDENTITIES.map((brand, i) => {
    const position = positionFor(i);
    const cell = `${position.price}|${position.purpose}`;
    const weekly = Math.floor(MONTHLY_BUDGET_PAISE / ROUNDS_PER_MONTH);
    const bidPaise = bidFor(position);

    return {
      id: brand.id,
      name: brand.name,
      domain: brand.domain,
      controller: i === 0 ? 'player' : 'policy',
      policyId: i === 0 ? null : 'disciplined',
      active: true,
      position,
      capex: { committed: { sizeGuide: 0, photography: 0, landingPage: 0 }, pending: [] },
      campaign: {
        monthlyBudgetPaise: MONTHLY_BUDGET_PAISE,
        monthSpentPaise: 0,
        weeklySplitPaise: new Array(ROUNDS_PER_MONTH).fill(weekly),
        strategy: 'manual',
        strategyParams: { targetCpaPaise: 40000, targetRoas: 5.0 },
        daypartAdjustments: [0, 0, 0, 0, 0, 0],
        negatives: [],
      },
      adGroups: [{
        id: 'ag_main',
        keywords: keywordsFor(cell, bidPaise),
        ad: {
          headlines: ['Shop the range', 'Free delivery', 'Easy returns'],
          descriptions: ['Everything you need for the gym.', 'Sizes XS to XXL.'],
          landingPageDescription: 'Category page with filters and a size guide.',
        },
        gradedQuality: {
          ...GRADE_VARIATION[i % GRADE_VARIATION.length],
          gradedAtRound: 0, contentHash: `sha1:fixture-${i}`,
        },
      }],
      bidding: {
        learningRoundsRemaining: 0,
        observedConvRate: 0.028,
        observedConversions: 120,
        observedByHour: null,
      },
      pendingConversions: [],
      pendingReturns: [],
      qualityHistory: {},
      ...over,
    };
  });
}

/**
 * @param {object} [opts]
 * @param {number} [opts.round]
 * @param {number} [opts.rootSeed]
 * @returns {object} a GameState
 */
export function makeGameState({ round = 1, rootSeed = 20260902 } = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    round,
    rootSeed,
    advertisers: makeAdvertisers(),
    querySet: QUERY_SET,
    budgetSchedule: {
      monthlyAllocationPaise: [MONTHLY_BUDGET_PAISE, MONTHLY_BUDGET_PAISE, null],
      capexAllocationRounds: [1, 5],
      rankSnapshotRound: 8,
    },
    history: [],
    decisionLog: [],
    marketContext: [],
  };
}

/** Deep clone so a test mutation cannot leak into another test. */
export function clone(state) {
  return structuredClone(state);
}

/**
 * Clone a state and hand the copy to a mutator.
 *
 * @param {object} state
 * @param {(s: object) => void} mutate
 * @returns {object}
 */
export function deformed(state, mutate) {
  const copy = clone(state);
  mutate(copy);
  return copy;
}

/** The player, by convention index 0. */
export const PLAYER_ID = BRAND_IDENTITIES[0].id;
