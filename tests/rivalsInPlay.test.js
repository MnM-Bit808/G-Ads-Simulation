import { describe, test, expect, beforeAll } from 'vitest';
import { controllerFor, affordableCpcPaise } from '../agents/policies.js';
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
});
