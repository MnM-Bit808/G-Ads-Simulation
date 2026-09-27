/**
 * The week playing out (plans/2026-09-27-week-playout.md).
 *
 * EVERY FIGURE IS CHECKED AGAINST A PLAYED WEEK, never a hand-built report.
 * Three rival rules once read zero in every game ever played with every test
 * green, because their fixtures carried a shape play never produces
 * (CLAUDE.md, Known traps). `playMarket` is the committed route.
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { playMarket, PLAYER } from '../scripts/market-harness.js';
import { phaseGroups } from '../scripts/read-playtest.js';
import {
  STEPS, AUTOMATIC_WEEKS, figuresFor, metRivals, stepsFor, playoutView, playsAutomatically,
} from '../ui/playout/read.js';
import { PLAYOUT } from '../ui/words/playout.js';

const read = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');

describe('the week playing out', () => {
  let row;
  let rivals;
  let names;
  let f;

  beforeAll(async () => {
    // ONE ROUND, DELIBERATELY. `reviseReports` edits earlier weeks for five
    // rounds afterwards, and `stillPending` is the queue it drains — so a week
    // read after later weeks have run reports a smaller number than the week
    // itself ever showed. Playing two rounds here made week 1 say "Another 0
    // are still deciding" when the week had produced 86. The playout is handed
    // the report the round just produced, and so is this test.
    const played = await playMarket({ seed: 20260902, cell: 'mid|performance', rounds: 1 });
    row = played.state.history[0].byAdvertiser[PLAYER];
    rivals = played.insights[0][PLAYER].rivals;
    names = Object.fromEntries(played.state.advertisers.map((a) => [a.id, a.name]));
    f = figuresFor(row, rivals, names);
  }, 60_000);

  test('a played week has all seven steps to show', () => {
    expect(STEPS).toHaveLength(7);
    expect(stepsFor(f)).toHaveLength(7);
  });

  // Each step names the field it reads in the design's table, and this is that
  // table as a test: a step that quietly started reading something else would
  // still draw, and still be wrong.
  test('every figure is the report’s own', () => {
    expect(f.eligibleRaw).toBe(row.traffic.eligibleAuctions);
    expect(f.impressionsRaw).toBe(row.traffic.impressions);
    expect(f.lostBudgetRaw).toBe(row.share.lostToBudget);
    expect(f.lostRankRaw).toBe(row.share.lostToRank);
    expect(f.placesRaw).toEqual(row.positions.counts);
    expect(f.clicksRaw).toBe(row.traffic.clicks);
    expect(f.boughtRaw).toBe(row.conversions.asFirstReported);
    expect(f.pendingRaw).toBe(row.conversions.stillPending);
  });

  test('nothing it would print is undefined, NaN or an object', () => {
    // The figures, plus what the controls are handed: `stepOf` counts steps,
    // not auctions, so it takes the view rather than the week.
    const everything = () => ({ ...f, at: 1, of: stepsFor(f).length });
    for (const [name, entry] of Object.entries(PLAYOUT)) {
      const said = entry(everything());
      expect(said, name).not.toMatch(/undefined|NaN|\[object/);
      expect(said.trim(), name).not.toBe('');
    }
  });

  // THE ONE PLACE THIS COULD TEACH SOMETHING FALSE. `positionAboveRate` reads 0
  // both when a rival was never above you and when you never met it — the guard
  // in engine/insights.js is `both > 0 ? above / both : 0`, so a rival in a
  // different corner of the market divides by nothing and comes back zero. Name
  // it and the screen says you beat someone you never ran against.
  test('only rivals it actually met are ever named', () => {
    const met = metRivals(rivals, names);
    for (const r of met) expect(r.overlapRate, r.id).toBeGreaterThan(0);
    const never = Object.entries(rivals).filter(([, r]) => r.overlapRate === 0).map(([id]) => id);
    for (const id of never) expect(met.map((r) => r.id), id).not.toContain(id);
  });

  test('a rival that never met you cannot be the one named', () => {
    const withGhost = { ...rivals, ghost: { overlapRate: 0, positionAboveRate: 0 } };
    const met = metRivals(withGhost, { ...names, ghost: 'Ghost' });
    expect(met.map((r) => r.id)).not.toContain('ghost');
  });

  // THE MOST-MET RIVAL IS OFTEN ONE YOU BEAT. In the measured week the account
  // met Auren in 66% of its impressions and was behind it in 7% of those, while
  // Lumen was met half as often and was above it in 96% — so Lumen sat above
  // this account in 37% of everything it showed in and Auren in 3%. Naming the
  // most-met one would have pointed the player at the wrong brand.
  test('it names the rival that actually cost it position, not the one met most', () => {
    const met = metRivals(rivals, names);
    expect(met.length, 'this week met nobody, so the ladder step has no rival to name')
      .toBeGreaterThan(0);
    const hardest = [...met].sort((a, b) => b.aboveShare - a.aboveShare)[0];
    expect(f.rival).toBe(hardest.name);
    expect(f.aboveRateRaw).toBe(hardest.aboveShare);
    const mostMet = [...met].sort((a, b) => b.overlapRate - a.overlapRate)[0];
    expect(hardest.id, 'this week they are the same brand, so the rule is untested here')
      .not.toBe(mostMet.id);
  });

  // `aboveShare` is exact, not an estimate: overlapRate is both/aShown and
  // positionAboveRate is above/both, so the product is above/aShown.
  test('the share a rival sat above you by is the product of two real rates', () => {
    for (const r of metRivals(rivals, names)) {
      expect(r.aboveShare).toBeCloseTo(r.overlapRate * r.positionAboveRate, 12);
      expect(r.aboveShare).toBeLessThanOrEqual(1);
    }
  });

  // The first run's bound is 80 words a screen because it is READ. This is
  // watched, one line and some figures a step, so it is tighter. A failure
  // means cutting the sentence, never raising the number.
  const ON_SCREEN = {
    pool: ['s1Kicker', 's1Say', 's1Sub'],
    shown: ['s2Kicker', 's2Say', 's2Sub'],
    missed: ['s3Kicker', 's3Say', 's3Note', 's3Budget', 's3Rank'],
    ladder: ['s4Kicker', 's4Met', 's4Above'],
    clicks: ['s5Kicker', 's5Say', 's5Clicks', 's5Cost'],
    bought: ['s6Kicker', 's6Say', 's6Sub'],
    pending: ['s7Kicker', 's7Note', 's7Sub'],
  };

  test.each(STEPS.map((s) => s.key))('%s puts at most 40 words on screen', (key) => {
    const count = ON_SCREEN[key].reduce((total, name) => total
      + PLAYOUT[name](f).split(/\s+/).filter((w) => /[a-z]{2,}/i.test(w)).length, 0);
    expect(count, `${key} says ${count} words`).toBeLessThanOrEqual(40);
  });

  // THE BIG FIGURE IS THE POINT OF THE STEP, so the sentence beside it must
  // not say the same number again. Every one of the five did when first
  // written — "75,508" over "Your keywords matched 75,508 searches this week"
  // — which is a wordier screen saying less.
  test('no sentence repeats the figure drawn beside it', () => {
    const drawn = [
      ['s1Say', f.eligible], ['s2Say', f.impressions], ['s3Say', f.lostBudget],
      ['s5Say', f.clicks], ['s5Say', f.cost], ['s6Say', f.bought], ['s7Note', f.pending],
    ];
    for (const [name, figure] of drawn) {
      expect(PLAYOUT[name](f), `${name} says ${figure} twice`).not.toContain(figure);
    }
  });

  test('every line belongs to a step or is a control', () => {
    const drawn = new Set(Object.values(ON_SCREEN).flat());
    const spare = new Set(['skip', 'done', 'watch', 'stepOf', 's4Clear', 's7None']);
    for (const name of Object.keys(PLAYOUT)) {
      expect(drawn.has(name) || spare.has(name), `${name} is written but never shown`).toBe(true);
    }
  });

  test('it names no guide chapter, like the first run', () => {
    for (const [name, entry] of Object.entries(PLAYOUT)) expect(entry.why, name).toBe(null);
  });

  // IN EXPECTED MODE A SALE IS A FRACTION, so `stillPending` is almost never a
  // whole zero and a naive `> 0` prints "Another 0 are still deciding" — the
  // fault class CLAUDE.md records twice. The last step reads `settled`, which
  // asks whether anything rounds to a sale at all.
  test('a week with nothing outstanding says so, rather than counting zero', () => {
    expect(figuresFor({ ...row, conversions: { ...row.conversions, stillPending: 0.4 } },
      rivals, names).settled).toBe(true);
    expect(figuresFor({ ...row, conversions: { ...row.conversions, stillPending: 0.6 } },
      rivals, names).settled).toBe(false);
  });

  // The week this is built from must still have a queue, or the test above is
  // the only thing exercising the last step and the real sentence never runs.
  test('the played week really does have sales outstanding', () => {
    expect(f.settled, 'week 1 settled entirely, so read it before revisions').toBe(false);
    expect(f.pendingRaw).toBeGreaterThan(0.5);
  });

  test('a step with nothing to say is dropped, not drawn empty', () => {
    const quiet = { ...f, lostBudgetRaw: 0, lostRankRaw: 0, boughtRaw: 0 };
    const keys = stepsFor(quiet);
    expect(keys).not.toContain('missed');
    expect(keys).not.toContain('bought');
    // The last step always shows: "everything has settled" is worth saying.
    expect(keys).toContain('pending');
  });

  test('the view walks and knows where it ends', () => {
    const keys = stepsFor(f);
    expect(playoutView(0, keys).key).toBe('pool');
    expect(playoutView(0, keys).isLast).toBe(false);
    expect(playoutView(keys.length - 1, keys).isLast).toBe(true);
    // Out of range is clamped rather than thrown: a timer that fires once more
    // than it should must not blank the screen.
    expect(playoutView(99, keys).key).toBe(keys.at(-1));
    expect(playoutView(-3, keys).at).toBe(0);
  });

  // TWO AUTOMATIC PLAYS, the owner's call. Fifteen seconds twelve times is the
  // ninety that the one recorded stranger's attention ran out at.
  test('it plays itself for two weeks, then only when asked', () => {
    expect(AUTOMATIC_WEEKS).toBe(2);
    expect(playsAutomatically(1, false)).toBe(true);
    expect(playsAutomatically(2, false)).toBe(true);
    expect(playsAutomatically(3, false)).toBe(false);
  });

  test('skipping once is remembered', () => {
    expect(playsAutomatically(1, true)).toBe(false);
    expect(playsAutomatically(2, true)).toBe(false);
  });

  // IT RECORDS ITSELF, AND IN ITS OWN ROW. The whole design came from one
  // playtest file, so the next one has to be able to judge it — and left in
  // the reader's `other` catch-all its seconds would have been totalled with
  // the playtest questions, hiding the one thing worth knowing: watched, or
  // skipped. The first run's row exists for exactly this reason.
  test('the app records it as its own phase', () => {
    const app = read('ui/app.js');
    expect(app).toContain("'the week playing out'");
    expect(app, 'the phase is set where the playout is drawn').toMatch(/recorder\?\.phase\(PLAYOUT_PHASE\)/);
  });

  test('the playtest reader gives it a row of its own', () => {
    const phase = (name, from, to) => ({
      name, startAt: from, endAt: to, lastSeenAt: to,
      hiddenMs: 0, idleMs: 0, clicks: 0, keys: 0, cardMs: {},
    });
    const file = {
      recording: {
        format: 1, startedAt: 0, loads: [0], versions: [], clicks: [], weeks: [], answers: {},
        phases: [phase('week 1', 0, 30_000), phase('the week playing out', 30_000, 45_000)],
      },
    };
    const rows = phaseGroups(file);
    const mine = rows.find((row) => row.name === 'week playing out');
    expect(mine, 'it fell into the reader’s catch-all').toBeTruthy();
    expect(mine.activeSeconds).toBe(15);
    expect(rows.map((r) => r.name)).not.toContain('other');
  });
});
