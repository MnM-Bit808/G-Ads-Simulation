/**
 * What the Studio's Your week shows, read without a page (design/your-week/,
 * chosen by the owner 2026-09-15: money first, a dashed tick where each week
 * stood before this week ran, the change under it, a losing week in amber).
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { QUERY_SET } from '../content/querySet.js';
import { startGame } from '../setup.js';
import { playRound } from '../game.js';
import { controllerFor } from '../agents/policies.js';
import * as r0 from '../ui/roundzero/rules.js';
import {
  weekFigures, weekBars, revision, chartRange, barPlace, impressions,
} from '../ui/week/read.js';

const PLAYER = 'me';

/** One week's row, carrying only what Your week reads. */
const row = ({
  net = 0, conv = 0, pending = 0, returned = 0, cost = 0, clicks = 0, impressions: shown = 0,
  netRoas = 0, grossRoas = 0, cpa = null, share = {}, counts = [0, 0, 0, 0],
} = {}) => ({
  traffic: { costPaise: cost, clicks, impressions: shown },
  conversions: { final: conv, stillPending: pending, returned, asFirstReported: conv },
  money: { netProfitPaise: net, netRoas, grossRoas, cpaPaise: cpa },
  share: { impressionShare: 0, lostToRank: 0, lostToBudget: 0, ...share },
  positions: { counts },
});
const week = (round, fields) => ({ round, byAdvertiser: { [PLAYER]: row(fields) } });

describe('the week\'s six figures', () => {
  test('are the week just played, as today\'s card reads them', () => {
    const figures = weekFigures(row({
      cost: 7200000, clicks: 3170, impressions: 43347, conv: 83.3, pending: 68.1,
      net: 2975300, netRoas: 2.72, grossRoas: 2.72, cpa: 86500,
    }));
    expect(figures).toEqual({
      spendPaise: 7200000, clicks: 3170, cpcPaise: 7200000 / 3170, impressions: 43347,
      conversions: 83.3, pending: 68.1, landedShare: 83.3 / (83.3 + 68.1),
      netProfitPaise: 2975300, netRoas: 2.72, grossRoas: 2.72, cpaPaise: 86500,
    });
  });

  test('no clicks is no cost per click, and no conversions nothing landed, never a division by nothing', () => {
    const figures = weekFigures(row());
    expect(figures.cpcPaise).toBe(0);
    expect(figures.landedShare).toBe(0);
  });
});

describe('every week so far', () => {
  const history = [week(1, { net: 10000 }), week(2, { net: 5000 }), week(3, { net: 3000 })];
  const before = [week(1, { net: 9000 }), week(2, { net: 7000 })];

  test('each week now, where it stood before this week ran, and the change', () => {
    const bars = weekBars(history, before, PLAYER);
    expect(bars.map((b) => [b.round, b.netPaise, b.beforePaise, b.changePaise])).toEqual([
      [1, 10000, 9000, 1000], [2, 5000, 7000, -2000], [3, 3000, null, null],
    ]);
  });

  test('the change is the difference of the two figures shown, as a reader would subtract them', () => {
    // ₹84,894 and ₹89,914 on screen differ by ₹5,020, though the paise
    // behind them differ by ₹5,019.64: a change that did not add up would
    // teach a player to distrust every figure beside it.
    const bars = weekBars([week(1, { net: 8489412 }), week(2, { net: 0 })], [week(1, { net: 8991376 })], PLAYER);
    expect(bars[0].changePaise).toBe(-502000);
  });

  test('only the newest week is this week, and it has nothing before it', () => {
    expect(weekBars(history, before, PLAYER).map((b) => b.latest)).toEqual([false, false, true]);
  });

  test('a week that did not move has no change to show, and no tick', () => {
    const bars = weekBars([week(1, { net: 4000 }), week(2, { net: 500 })], [week(1, { net: 4000 })], PLAYER);
    expect(bars[0]).toMatchObject({ changePaise: 0, moved: false });
  });

  test('a move of less than a rupee shows none, since both figures read the same', () => {
    const bars = weekBars([week(1, { net: 4020 }), week(2, { net: 500 })], [week(1, { net: 4000 })], PLAYER);
    expect(bars[0]).toMatchObject({ changePaise: 0, moved: false });
  });

  test('a week missing from before has nothing to compare with', () => {
    const bars = weekBars(history, [], PLAYER);
    expect(bars.every((b) => b.beforePaise === null && !b.moved)).toBe(true);
  });
});

describe('the sentence under it', () => {
  // The mock-up's game (seed 1, Vella & Co., after week 6), in rupees.
  const R = 100;
  const history = [
    week(1, { net: 84894 * R, conv: 192.6, returned: 76 }), week(2, { net: 44054 * R, conv: 162.3, returned: 60.97 }),
    week(3, { net: 46629 * R, conv: 157.6, returned: 53.14 }), week(4, { net: 54464 * R, conv: 144.7, returned: 34.42 }),
    week(5, { net: 86047 * R, conv: 129.3 }), week(6, { net: 29753 * R, conv: 83.3 }),
  ];
  const before = [
    week(1, { net: 89914 * R, conv: 192.6, returned: 72.2 }), week(2, { net: 54206 * R, conv: 162.3, returned: 53.27 }),
    week(3, { net: 60317 * R, conv: 149.7, returned: 35.21 }), week(4, { net: 76747 * R, conv: 126.4 }),
    week(5, { net: 32730 * R, conv: 85.7 }),
  ];

  test('what rose, what fell, by how much, and why', () => {
    expect(revision(weekBars(history, before, PLAYER))).toEqual({
      week: 6,
      first: false,
      rose: { weeks: { kind: 'one', week: 5 }, paise: 53317 * R, landed: 44 },
      fell: { weeks: { kind: 'run', from: 1, to: 4 }, paise: 51143 * R, returned: 64 },
    });
  });

  test('the why is counted, not assumed: a fall with nothing returned claims no returns', () => {
    // A revised week's profit is recomputed at this week's margin (engine/report.js),
    // so a fall is not proof that anything came back.
    const said = revision(weekBars([week(1, { net: 800 }), week(2, { net: 100 })], [week(1, { net: 1000 })], PLAYER));
    expect(said.fell).toEqual({ weeks: { kind: 'one', week: 1 }, paise: 200, returned: 0 });
  });

  test('the first week has nothing earlier to move', () => {
    expect(revision(weekBars([week(1, { net: 5 })], [], PLAYER))).toMatchObject({ week: 1, first: true });
  });

  test('weeks apart are listed, not joined into a run', () => {
    const fell = (rounds) => {
      const now = [1, 2, 3, 4, 5].map((r) => week(r, { net: rounds.includes(r) ? 0 : 1000 }));
      const was = [1, 2, 3, 4].map((r) => week(r, { net: 1000 }));
      return revision(weekBars(now, was, PLAYER)).fell.weeks;
    };
    expect(fell([1, 3])).toEqual({ kind: 'list', list: [1], last: 3 });
    expect(fell([1, 3, 4])).toEqual({ kind: 'list', list: [1, 3], last: 4 });
    expect(fell([2, 3])).toEqual({ kind: 'run', from: 2, to: 3 });
  });

  test('nothing moved says so, rather than nothing', () => {
    const now = [week(1, { net: 1000 }), week(2, { net: 300 })];
    expect(revision(weekBars(now, [week(1, { net: 1000 })], PLAYER))).toEqual({
      week: 2, first: false, rose: null, fell: null,
    });
  });
});

describe('a week that lost money hangs below the line', () => {
  // The losing game on the canvas: every bid raised at week 5.
  const bars = weekBars(
    [week(1, { net: 8489400 }), week(5, { net: 1060000 }), week(6, { net: -2057000 })],
    [week(1, { net: 8991400 }), week(5, { net: -1726500 })],
    PLAYER,
  );
  const range = chartRange(bars);

  test('the chart runs from the deepest loss to the highest week, before or now', () => {
    expect(range).toEqual({ topPaise: 8991400, lowPaise: 2057000 });
  });

  test('a profit stands on the line and a loss hangs from it, to scale', () => {
    const zero = 2057000 / (8991400 + 2057000);
    const top = barPlace(8991400, range);
    const deepest = barPlace(-2057000, range);
    expect(top.zero).toBeCloseTo(zero, 12);
    expect(top.zero + top.size).toBeCloseTo(1, 12);
    expect(top.below).toBe(false);
    expect(deepest.zero - deepest.size).toBeCloseTo(0, 12);
    expect(deepest.below).toBe(true);
    expect(barPlace(0, range).size).toBe(0);
  });

  test('a chart with nothing on it has no line to draw from, never a division by nothing', () => {
    expect(barPlace(0, chartRange([]))).toEqual({ zero: 0, size: 0, below: false });
  });

  test('without a loss the line is the floor', () => {
    expect(chartRange(weekBars([week(1, { net: 5 })], [], PLAYER)).lowPaise).toBe(0);
  });
});

describe('where the impressions went', () => {
  test('shown, lost to budget and lost to rank, and the share at each position', () => {
    const read = impressions(row({
      share: { impressionShare: 0.57, lostToBudget: 0.43, lostToRank: 0 }, counts: [44, 3, 51, 2],
    }));
    expect(read).toEqual({ shown: 0.57, lostToBudget: 0.43, lostToRank: 0, positions: [0.44, 0.03, 0.51, 0.02] });
  });

  test('no impressions is no share anywhere, never a division by nothing', () => {
    expect(impressions(row()).positions).toEqual([0, 0, 0, 0]);
  });
});

describe('what a screen reader hears', () => {
  // The animation review, 2026-09-15: at opacity 0 the old bar and figure were
  // still read out, so a week that moved sounded like two current figures.
  test('where a week stood is drawn for the eye only: the change and the sentence say it in words', () => {
    const source = readFileSync(fileURLToPath(new URL('../ui/week/render.js', import.meta.url)), 'utf8');
    const drawn = source.match(/\S*el\('span', '[^']*(?:yw-was|yw-tick)[^']*'/g) ?? [];
    expect(drawn).toHaveLength(3);
    for (const call of drawn) expect(call, call).toMatch(/^forTheEye\(el\(/);
  });
});

describe('on a game the engine played', { timeout: 60_000 }, () => {
  const SEED = 20260902;

  /** Played `weeks` weeks, keeping the history from before the last, as ui/app.js does. */
  async function played(weeks) {
    const setup = r0.createSetupDraft({ playerBrandId: 'marlow', rootSeed: SEED });
    r0.addSetupKeyword(setup, 'gym leggings');
    let state = startGame({ rootSeed: SEED, querySet: QUERY_SET, ...r0.startChoices(setup) });
    const controllers = Object.fromEntries(state.advertisers.map((a, i) => [
      a.id, i === 0 ? () => null : controllerFor(a.policyId),
    ]));
    let before = [];
    while (state.round <= weeks) {
      before = state.history;
      state = (await playRound(state, controllers, { mode: 'expected' })).nextGameState;
    }
    return { state, before, playerId: state.advertisers[0].id };
  }

  test('while week 2 ran, week 1 rose as its late conversions landed, and nothing came back yet', async () => {
    const { state, before, playerId } = await played(2);
    const bars = weekBars(state.history, before, playerId);
    const said = revision(bars);
    expect(said.rose.weeks).toEqual({ kind: 'one', week: 1 });
    expect(said.rose.landed).toBeGreaterThan(0);
    // A return needs the window: the first come back two weeks after they land.
    expect(said.fell).toBeNull();
  });

  test('the sentence adds up the bars it describes', async () => {
    const { state, before, playerId } = await played(4);
    const bars = weekBars(state.history, before, playerId);
    const said = revision(bars);
    const up = bars.filter((b) => b.changePaise > 0).reduce((s, b) => s + b.changePaise, 0);
    const down = bars.filter((b) => b.changePaise < 0).reduce((s, b) => s - b.changePaise, 0);
    expect(said.rose?.paise ?? 0).toBe(up);
    expect(said.fell?.paise ?? 0).toBe(down);
  });
});
