/**
 * The first run's demonstration auction (plans/2026-09-19-first-run-and-ground-floor.md,
 * section 4.3).
 *
 * WHY IT IS A REAL AUCTION. The first screen a beginner ever sees must not
 * teach a made-up number, in a project whose whole premise is that a simulator
 * teaching something false is worse than no simulator. So this builds a
 * throwaway game exactly as `startGame` builds one, then resolves ONE auction
 * on one search with the engine's own functions. It is the rule `ui/reserve.js`
 * already follows: every step the engine's own, so this cannot drift from the
 * auction the game runs.
 *
 * IT IS NOT THE PLAYER'S GAME. It runs before a game exists, on a fixed seed,
 * and nothing it builds is ever handed to `game.js`. It reads no save, writes
 * none, and moves no number.
 *
 * WHY THIS SEARCH. `q_056` leans mid and performance — the square a player is
 * most likely to sit in — and it is plain English, so a beginner recognises it
 * without knowing the vertical.
 *
 * WHY THIS HOUR. Evening, where the demand curve and the intent curve are both
 * high, which is the hour a real click is most likely to happen in.
 *
 * WHAT IT HANDED OVER, unprompted: the winner buys the top slot on a bid twice
 * the runner-up's and pays nearly three times as much for it, because the
 * runner-up's ad fits the search better. That is the run's central lesson and
 * nobody wrote it. `tests/firstRun.test.js` holds it.
 */

import { startGame, briefing } from '../../setup.js';
import { findMatches, selectAdGroup, isBlocked } from '../../engine/matching.js';
import { qualitySignalBase, applyHourAndNoise } from '../../engine/quality.js';
import { landingPageBonus } from '../../engine/positions.js';
import { resolveAuction } from '../../engine/auction.js';
import { effectiveBidPaise } from '../../engine/strategies.js';
import { WEEKLY_VOLUME } from '../../engine/constants.js';
import { QUERY_SET } from '../../content/querySet.js';
import * as r0 from '../roundzero/rules.js';

/** The search the run is told on. */
export const DEMO_QUERY_ID = 'q_056';

/** Evening: both hourly curves are high, so it is when a click really happens. */
export const DEMO_HOUR = 19;

/** Fixed, so every beginner is taught the same auction. */
const DEMO_SEED = 20260902;
const DEMO_BRAND = 'marlow';

/**
 * Worked out once. The run is redrawn on every beat and on every step back, and
 * this is a pure function of frozen content with no rng in it, so the value
 * cannot differ between calls. Held here rather than recomputed because
 * `startGame` builds nine advertisers and grades nine ads.
 */
let cached = null;

/**
 * A grade's ceiling, mirroring `withLandingBonus` in engine/round.js, which is
 * private to that file and writes the same 10. If the engine's cap ever moves,
 * this moves with it.
 */
const GRADE_CEILING = 10;

/** The query row the run is told on. */
function demoQuery() {
  const row = QUERY_SET.queries.find((q) => q.id === DEMO_QUERY_ID);
  if (!row) throw new RangeError(`the first run's search ${DEMO_QUERY_ID} is not in the query set`);
  return row;
}

/**
 * A bid strategy needs the advertiser's own average order value, and nothing
 * else about its economics (`effectiveBidPaise`: "own catalogue, legitimately
 * known"). It is read from `briefing()`, which is where round 0's first step
 * already prints it on screen — NOT from `businessFor`, which derives the true
 * conversion rate and value multipliers that spec 16.1 withholds from every
 * viewer, including the advertiser the affinity favours. `tests/ui.test.js`
 * holds the interface to that, and caught this file reaching for it.
 */
function catalogueFor(price, economics) {
  return { aovMeanPaise: economics[price].aovMeanPaise };
}

/**
 * One advertiser's entry into this search: which ad group answers it, how well
 * that ad fits, and what it bids. Mirrors `buildEntryPlans` in engine/round.js
 * for a single query and a single hour.
 */
function entryFor(advertiser, query, economics) {
  if (isBlocked(query, advertiser.campaign.negatives)) return null;
  const hits = findMatches(query, advertiser.adGroups);
  if (hits.length === 0) return null;

  const bonus = landingPageBonus(advertiser.capex, 1);
  const baseFor = (hit) => {
    const group = advertiser.adGroups.find((g) => g.id === hit.adGroupId);
    const graded = group.gradedQuality && bonus !== 0
      ? {
        ...group.gradedQuality,
        landingPage: Math.min(GRADE_CEILING, group.gradedQuality.landingPage + bonus),
      }
      : group.gradedQuality;
    return { ...qualitySignalBase(graded, query, hit.keyword), group };
  };

  // The ad group is chosen on the hour-independent signal, as a round does, so
  // it cannot flip between one drawing of the screen and the next.
  const chosen = selectAdGroup(hits, (hit) => hit.keyword.bidPaise * baseFor(hit).base);
  const { base, group } = baseFor(chosen);

  return {
    id: advertiser.id,
    name: advertiser.name,
    domain: advertiser.domain,
    headlines: Object.freeze([...group.ad.headlines]),
    descriptions: Object.freeze([...group.ad.descriptions]),
    signal: applyHourAndNoise(base, DEMO_HOUR, null, 'expected'),
    bidPaise: effectiveBidPaise({
      strategy: advertiser.campaign.strategy,
      strategyParams: advertiser.campaign.strategyParams ?? {},
      keyword: chosen.keyword,
      business: catalogueFor(advertiser.position.price, economics),
      bidding: advertiser.bidding ?? {},
      daypartAdjustments: advertiser.campaign.daypartAdjustments ?? [],
      hour: DEMO_HOUR,
      rng: null,
    }),
  };
}

/**
 * One real auction on one real search, resolved by the engine.
 *
 * @returns {{
 *   query: {text: string, weekly: number},
 *   winner: object, runnerUp: object,
 *   entered: number, of: number,
 *   rows: ReadonlyArray<{
 *     id: string, name: string, domain: string,
 *     headlines: ReadonlyArray<string>, descriptions: ReadonlyArray<string>,
 *     bidPaise: number, signal: number, adRank: number,
 *     position: number, shown: boolean, cpcPaise: number,
 *   }>,
 * }} the ladder, sorted by ad rank descending
 */
export function demonstration() {
  if (cached) return cached;

  const query = demoQuery();
  const setup = r0.createSetupDraft({ playerBrandId: DEMO_BRAND, rootSeed: DEMO_SEED });
  r0.addSetupKeyword(setup, query.text);
  const state = startGame({ rootSeed: DEMO_SEED, querySet: QUERY_SET, ...r0.startChoices(setup) });

  const economics = briefing(QUERY_SET).economicsByTier;
  const entrants = state.advertisers
    .map((advertiser) => entryFor(advertiser, query, economics))
    .filter(Boolean);

  const { ladder } = resolveAuction(entrants.map(({ id, bidPaise, signal }) => ({
    id, bidPaise, qualitySignal: signal,
  })));
  const rows = Object.freeze(ladder.map((row) => Object.freeze({
    ...entrants.find((e) => e.id === row.id),
    adRank: row.adRank,
    position: row.position,
    shown: row.shown,
    cpcPaise: row.cpcPaise,
  })));

  cached = Object.freeze({
    query: Object.freeze({
      text: query.text,
      weekly: Math.round((query.volumeShareBp / 10000) * WEEKLY_VOLUME),
    }),
    winner: rows[0],
    runnerUp: rows[1],
    entered: entrants.length,
    of: state.advertisers.length,
    rows,
  });
  return cached;
}
