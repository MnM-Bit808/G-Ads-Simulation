import { describe, test, expect } from 'vitest';
import { runRound } from '../engine/round.js';
import { makeGameState } from './fixtures/gameState.js';

/**
 * Spec 19's performance budgets, measured alone.
 *
 * WHY THIS FILE IS EXCLUDED FROM `npm test`
 *
 * These are budgets for the ENGINE. Inside the normal suite twenty-odd files
 * run at once, and the same round reported 496ms and 1991ms twenty seconds
 * apart. Switching to `process.cpuUsage()` only moved the problem: garbage
 * collection under that much memory pressure is real CPU this process really
 * spends, and it billed 2200ms for work that costs 1830ms standalone.
 *
 * A timing assertion that fires on machine weather is worse than no assertion,
 * because it teaches you to rerun until it passes. So this runs on its own,
 * one worker, no parallelism:
 *
 *   npm run test:perf
 *
 * Spec 19 names this file. Until now it did not exist, and its two tests lived
 * in `round.test.js` competing with everything else.
 *
 * WALL TIME, NOT CPU TIME. CPU time sums Node's parallel GC threads, so it
 * reported 469ms for a round that finishes in 183ms - a real number, but not
 * the one the budget is about. A budget is what somebody waits.
 *
 * WHAT THE NUMBERS ARE ON THIS MACHINE
 *
 *   expected              183ms   against a 400ms budget
 *   sampled + one CF     1830ms   against a 1500ms budget
 *
 * The second is over, and it was over before any of this session's work: the
 * same benchmark against the commit that preceded it gives 251ms and 1722ms.
 * So the engine has not regressed - expected got FASTER - and this machine is
 * simply slower than the one where a8c433d measured 1229ms and set the budget.
 *
 * The spec budget stays at 1500. It describes the shape of the engine, not the
 * speed of a laptop, and moving it to match whatever hardware ran it last would
 * be measuring the wrong thing and calling it a requirement. The bound asserted
 * here is 2200ms: loose enough to absorb the gap, tight enough that the kind of
 * regression this test exists for - the 600,000 redundant Map writes found in
 * this same session, which cost 1.3 seconds - still fails it.
 *
 * ---------------------------------------------------------------------------
 * RE-MEASURED 2026-09-20, because the three-auction bound had gone red and
 * NOTHING RUNS THIS FILE, so nobody knew. `npm test` is lint plus vitest and
 * `npm run ci` is lint, vitest and the build; neither runs `test:perf`.
 *
 *   under vitest        plain node        2026-09-15
 *   ------------        ----------        ----------
 *   expected       -      107-129ms         183ms
 *   sampled + CF   -      873-962ms        1830ms
 *   three-auction  3101-3180ms  1968-2104ms  2200-2550ms
 *
 * THE ENGINE GOT FASTER, and that was measured rather than assumed: the
 * expected round nearly halved, and 3bcfa35 - the commit that set the 2800
 * bound below - was checked out and run on today's setup, where it measures
 * 3180ms against HEAD's 3101ms. The old code is SLOWER than the current code.
 * There is no regression to find, which is why none of I34, I39, I40, I41, C9
 * or F18 turned out to be responsible.
 *
 * WHAT MOVED IS THE RUNNER, and the relationship has inverted. The paragraph
 * above says plain Node used to be "8-15% dearer" than vitest. Today it is
 * about 35% CHEAPER: vitest adds roughly half again to this path. The bound
 * was measuring the test runner.
 *
 * A RATIO BOUND WAS CONSIDERED AND REJECTED. Asserting three-auction against
 * the expected round in the same run would be machine-independent in principle,
 * but the ratio moved further than the absolute did - 12.0-13.9x then, 16-19x
 * now - because the cheap path sped up more than the expensive one. Less
 * stable, not more.
 *
 * SO THE THREE-AUCTION BOUND GOES TO 3600 AND THE SPEC BUDGET DOES NOT MOVE.
 * Same reasoning as the 2200 above: 3600 absorbs today's 3180 under the runner
 * it actually runs in, and still fails on the regression this file exists for -
 * 1.3 seconds of redundant work on today's numbers lands near 4400, which misses
 * 3600 by 800ms.
 *
 * IF THIS GOES RED AGAIN, RUN THE OLD COMMIT BEFORE TOUCHING THE NUMBER. That
 * is the check that separates "the engine regressed" from "the environment
 * changed", it takes one `git checkout <sha> -- engine/ tests/`, and both times
 * this bound has moved the answer was the environment.
 */
const STATE = makeGameState();
const CONSTRAINED = 'halcyon';

/** Median of five, warmed first so JIT compilation is not billed. */
function medianMs(work, runs = 5) {
  work();
  const samples = [];
  for (let i = 0; i < runs; i++) {
    const t0 = Date.now();
    work();
    samples.push(Date.now() - t0);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(runs / 2)];
}

describe('performance (spec 19)', () => {
  test('an expected round completes under the 400ms budget', () => {
    const ms = medianMs(() => runRound(STATE, { mode: 'expected' }));
    expect(ms, `${ms}ms`).toBeLessThan(400);
  });

  test('a sampled round with one counterfactual stays near its 1500ms budget', () => {
    // See the header: 1830ms here against a 1500ms budget set on faster
    // hardware, and 1722ms on the same machine before this session's work.
    const ms = medianMs(() => runRound(
      STATE, { mode: 'sampled', seed: 3, counterfactualFor: [CONSTRAINED] },
    ), 3);
    expect(ms, `${ms}ms against a 1500ms spec budget`).toBeLessThan(2200);
  });

  test('and so does the three-auction path, which a played week mostly takes', () => {
    // Rivals bid by place (agents/policies.js), so once one tilts, every
    // auction resolves once per place, and that is what a played week costs.
    // The flat fixture above never takes that path. A millionth of a percent
    // on one place sends the round down it without moving a bid (G4).
    //
    // 3,600ms, not the 2,200 above, and set from this path's own cost. F17
    // resolves every combination of which throttled advertisers are present,
    // and this fixture throttles five at once, 13.7 ladders a search against
    // 5-8 in played markets. A round here was about 1,750ms before F17 and
    // 2,200-2,550ms after (the owner, 2026-09-15, when plain Node was 8-15%
    // DEARER than this runner).
    //
    // 2,800 -> 3,600 on 2026-09-20, and the header has the evidence: the engine
    // is FASTER than it was, the old commit measures worse than HEAD on today's
    // setup, and what grew is the runner — plain Node is now about 35% cheaper
    // than vitest, where it used to be dearer. 1.3 seconds of redundant work,
    // the regression this file exists for, lands near 4,400ms today and still
    // fails this.
    const tilted = makeGameState();
    tilted.advertisers[1].campaign.locationAdjustments = [0, 0, 0.0001];
    const ms = medianMs(() => runRound(
      tilted, { mode: 'sampled', seed: 3, counterfactualFor: [CONSTRAINED] },
    ), 3);
    expect(ms, `${ms}ms against a 1500ms spec budget`).toBeLessThan(3600);
  });

  test('sampled mode costs about what its sub-auction count implies', () => {
    // AUCTIONS_PER_QUERY_HOUR is 1 expected, 6 sampled (11.5), so sampled
    // should cost roughly six times expected and not dramatically more. If it
    // ever does, something in the hot loop has started scaling with volume
    // rather than with auctions - which 11.5 explicitly promises it does not.
    const expectedMs = medianMs(() => runRound(STATE, { mode: 'expected' }));
    const sampledMs = medianMs(() => runRound(STATE, { mode: 'sampled', seed: 3 }), 3);
    expect(sampledMs / expectedMs, `${sampledMs}ms vs ${expectedMs}ms`).toBeLessThan(12);
  });

  test('the counterfactual is worth what it costs', () => {
    // It roughly doubles an expected round. Worth knowing, because 11.2
    // defaults to a single advertiser deliberately: counterfactualFor is
    // linear in the ids it is given, and asking for all nine would be nine
    // extra rounds rather than one.
    const plain = medianMs(() => runRound(STATE, { mode: 'expected' }));
    const withCf = medianMs(() => runRound(
      STATE, { mode: 'expected', counterfactualFor: [CONSTRAINED] },
    ));
    expect(withCf).toBeGreaterThanOrEqual(plain);
    expect(withCf).toBeLessThan(plain * 4);
  });
});
