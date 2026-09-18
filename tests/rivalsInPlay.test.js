import { describe, test, expect, beforeAll } from 'vitest';
import { controllerFor, disciplined, affordableCpcPaise } from '../agents/policies.js';
import { playMarket } from '../scripts/market-harness.js';

/**
 * What a rival learns in a PLAYED game, read through the door (C9).
 *
 * `policies.test.js` hands policies reports built by hand, and those carried
 * `returned: 2` and the like. Play never hands a rival that shape: a week's
 * returns land two to five weeks after its clicks and are written back into
 * that week's report, and until R3a was amended a controller was handed only
 * the week just played. Every hand-built test passed while the rules reading
 * returns read zero.
 *
 * So these play a whole market (seed 8, the player at premium|performance, the
 * game where the see-saw was traced) and record what every rival is handed and
 * what it decides.
 */

const MARKET = { seed: 8, cell: 'premium|performance' };

/** Walk what a controller was handed for any return that has come back. */
function carriesReturns(value) {
  if (Array.isArray(value)) return value.some(carriesReturns);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, v]) => (
    (key === 'returned' || key === 'returnedRevenuePaise') && typeof v === 'number' ? v > 0 : carriesReturns(v)
  ));
}

/** Direction changes of at least `points` in one place's adjustment, week to week. */
function reversals(series, points) {
  let count = 0;
  let last = 0;
  for (let i = 1; i < series.length; i++) {
    const move = series[i] - series[i - 1];
    if (Math.abs(move) < points) continue;
    if (last !== 0 && Math.sign(move) !== last) count++;
    last = Math.sign(move);
  }
  return count;
}

describe('what a rival learns in a played game (C9)', { timeout: 120_000 }, () => {
  const seen = [];
  let state;

  beforeAll(async () => {
    const policyFor = (policyId) => {
      const policy = controllerFor(policyId);
      return (...handed) => {
        const decision = policy(...handed);
        seen.push({ policyId, id: handed[0].id, round: handed[0].round, handed, decision });
        return decision;
      };
    };
    ({ state } = await playMarket({ ...MARKET, policyFor }));
  });

  test('set up: every rival decided every week', () => {
    const rivals = state.advertisers.filter((a) => a.policyId);
    expect(seen).toHaveLength(rivals.length * 12);
  });

  test('its return rate comes from returns it has actually had', () => {
    // A week's first returns are back three rounds after its clicks, and week
    // 1 has settled entirely by week 7. From week 8 a rival has had returns to
    // read; what it believes it can afford should no longer be the briefing's
    // two in five.
    const late = seen.filter((c) => c.round >= 8);
    expect(late.filter((c) => carriesReturns(c.handed)), 'no rival was handed a single return').not.toEqual([]);
    const moved = late.filter((c) => affordableCpcPaise(c.handed[0], c.handed[3]) !== affordableCpcPaise(c.handed[0]));
    expect(moved.length, 'every late belief is still the briefing\'s 0.40').toBeGreaterThan(0);
  });

  test('grossOptimiser, reading gross, places its bids unlike disciplined, reading net', () => {
    // Same week, same account, two readings: the only difference between the
    // two is whether returns are subtracted. Once returns have come back the
    // towns, which return half again as often as the metros (G4), must read
    // worse net than gross.
    const gross = seen.filter((c) => c.policyId === 'grossOptimiser' && c.round >= 6);
    expect(gross.length, 'no grossOptimiser in this market').toBeGreaterThan(0);
    const differ = gross.filter((c) => JSON.stringify(disciplined(...c.handed).campaign.locationAdjustments)
      !== JSON.stringify(c.decision.campaign.locationAdjustments));
    expect(differ.length, 'net and gross place bids are identical every week').toBeGreaterThan(0);
  });

  /**
   * WHAT A RIVAL BLOCKS, in play (2026-09-18). Its rule asked for conversions of
   * exactly zero on the week just played, and in expected mode a search's sales
   * are a fraction, so it wrote negatives on the zero-intent searches alone
   * (I8's addendum). It now judges by `isDear` over every week it has played.
   * Both tests below failed before that: the first read zero negatives, and the
   * second is the risk the first one buys.
   */
  test('it blocks the searches that cost it most, rather than only the ones nobody ever buys from', () => {
    const blockers = seen.filter((c) => ['disciplined', 'grossOptimiser'].includes(c.policyId));
    expect(blockers.length, 'no rival in this market reads its search terms').toBeGreaterThan(0);
    const written = new Map();
    for (const c of blockers.sort((x, y) => x.round - y.round)) {
      written.set(c.id, (c.decision?.campaign?.negatives ?? []).length);
    }
    const blocked = [...written.values()];
    expect(Math.max(...blocked), 'every rival ends the game blocking nothing').toBeGreaterThan(0);
  });

  test('and blocks itself out of nothing: every rival still shows every week', () => {
    const dark = [];
    for (const report of state.history) {
      for (const a of state.advertisers.filter((x) => x.policyId)) {
        const impressions = report.byAdvertiser[a.id]?.traffic?.impressions ?? 0;
        if (!(impressions > 0)) dark.push(`${a.id} (${a.policyId}) week ${report.round}`);
      }
    }
    expect(dark).toEqual([]);
  });

  test('a rival\'s place adjustments settle rather than see-saw', () => {
    // Traced here: the disciplined rival's towns adjustment went -10, -56, -17,
    // -58, -12, -54... because a place's value per click falls as its bid
    // there rises, and the rule jumped all the way to each week's reading.
    const out = [];
    for (const a of state.advertisers.filter((x) => x.policyId)) {
      let held = [0, 0, 0];
      const weeks = [];
      for (const c of seen.filter((x) => x.id === a.id).sort((x, y) => x.round - y.round)) {
        held = c.decision?.campaign?.locationAdjustments ?? held;
        weeks.push(held);
      }
      for (let place = 0; place < 3; place++) {
        const flips = reversals(weeks.map((w) => w[place]), 10);
        if (flips > 1) out.push(`${a.id} (${a.policyId}) place ${place}: ${flips} reversals`);
      }
    }
    expect(out).toEqual([]);
  });
});
