/**
 * Reading a playtest file back (scripts/read-playtest.js).
 *
 * The file a stranger sends is the baseline stage C is measured against, so
 * reading it has to be a program rather than a session's judgement: the same
 * file must give the same table every time it is read.
 *
 * The groups are the ones the one recorded human game was reported in
 * (HANDOVER, "What playing it as a learner found"): round 0, weeks 1-4, weeks
 * 5-11 and the end. That table is the only baseline there is, so a stranger's
 * numbers have to line up with it.
 */

import { describe, test, expect } from 'vitest';
import {
  phaseGroups, cardTotals, computeTimes, outcome, report, weeksInTheRed,
} from '../scripts/read-playtest.js';
import { createRecorder, playtestFile } from '../ui/recorder.js';
import { makeSave, fingerprintOf } from '../ui/save.js';
import { startGame } from '../setup.js';
import { playRound } from '../game.js';
import { controllerFor } from '../agents/policies.js';
import { QUERY_SET } from '../content/querySet.js';
import { BRAND_IDENTITIES } from '../content/brands.js';
import { homeCell } from '../engine/querySet.js';
import { finalStandings, gameTotals } from '../ui/ending.js';

function memoryStorage() {
  const items = new Map();
  return {
    getItem: (k) => (items.has(k) ? items.get(k) : null),
    setItem: (k, v) => { items.set(k, String(v)); },
    removeItem: (k) => { items.delete(k); },
  };
}

/** A recording of a short game, built through the real recorder. */
function recordedFile(save = null) {
  let t = 1_700_000_000_000;
  const now = () => t;
  const recorder = createRecorder({ storage: memoryStorage(), now });
  const spend = (seconds, cards = []) => {
    for (let i = 0; i < seconds; i++) {
      t += 1000;
      recorder.tick(cards);
      if (i % 60 === 0) recorder.activity();
    }
  };
  recorder.load();
  recorder.phase('round 0');
  spend(400, ['Keywords']);
  recorder.click('Keywords › add');
  recorder.phase('round 0 (redo)');
  spend(200, ['Keywords', 'Your ad']);
  for (const week of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
    recorder.week(week, 200 + week);
    recorder.phase(`week ${week}`);
    spend(week <= 4 ? 60 : 10, ['The week']);
    recorder.click('header › Run the week');
  }
  recorder.week(12, 500);
  recorder.phase('end screen');
  spend(90, ['Twelve weeks']);
  recorder.answer('lessons', 'Broad match wanders.');
  return playtestFile({ log: recorder.log(), save, environment: { viewport: [390, 844] } });
}

describe('the phases, grouped the way the one human game was reported', () => {
  test('round 0 includes its redo, and the weeks split at 4 and 11', () => {
    const groups = phaseGroups(recordedFile());
    expect(groups.map((g) => [g.name, g.activeSeconds])).toEqual([
      ['round 0', 600],
      ['weeks 1-4', 240],
      ['weeks 5-11', 70],
      ['end screen', 90],
    ]);
    expect(groups[0].clicks).toBe(1);
    expect(groups[1].clicks).toBe(4);
  });

  test('screens that are not play, such as restoring a save, are kept apart', () => {
    const file = recordedFile();
    file.recording.phases.push({
      name: 'restoring', startAt: 0, endAt: 3000, lastSeenAt: 3000,
      hiddenMs: 0, idleMs: 0, clicks: 0, keys: 0, cardMs: {},
    });
    const groups = phaseGroups(file);
    expect(groups.at(-1)).toMatchObject({ name: 'other', activeSeconds: 3 });
  });
});

describe('what was read', () => {
  test('each card is totalled across the game, most read first', () => {
    expect(cardTotals(recordedFile())).toEqual([
      ['Keywords', 600],
      ['The week', 310],
      ['Your ad', 200],
      ['Twelve weeks', 90],
    ]);
  });
});

describe('how fast the weeks ran on their device', () => {
  test('slowest, typical and fastest week', () => {
    expect(computeTimes(recordedFile())).toEqual({ weeks: 12, fastestMs: 201, medianMs: 207, slowestMs: 500 });
  });
});

describe('how the game came out, replayed from the save', () => {
  const PLAYER = BRAND_IDENTITIES[0].id;
  const own = QUERY_SET.queries.filter((q) => homeCell(q) === 'mid|lifestyle').slice(0, 4);

  async function savedGame(weeks) {
    const initial = startGame({
      rootSeed: 20260902,
      playerBrandId: PLAYER,
      querySet: QUERY_SET,
      player: {
        position: { price: 'mid', purpose: 'lifestyle' },
        capex: { sizeGuide: 0, photography: 0, landingPage: 0 },
        keywords: own.map((q) => ({ text: q.text, matchType: 'phrase', bidPaise: 1500 })),
        ad: {
          headlines: ['Everyday Co-ord Sets', 'Soft Lounge Sets', 'Sizes XS To XXL'],
          descriptions: [
            'Soft co-ord sets and lounge pants to wear all day.',
            'Free delivery over Rs 1,499 and 30-day returns.',
          ],
          landingPageDescription: 'A plain product page.',
        },
        writerTier: 'diy',
      },
    });
    const controllers = Object.fromEntries(initial.advertisers.map((a, i) => [
      a.id, i === 0 ? () => null : controllerFor(a.policyId),
    ]));
    const sources = Object.fromEntries(initial.advertisers.map((a, i) => [
      a.id, i === 0 ? 'player' : `policy:${a.policyId}`,
    ]));
    let state = initial;
    const reports = [];
    for (let w = 0; w < weeks; w++) {
      const out = await playRound(state, controllers, { mode: 'expected', sources });
      state = out.nextGameState;
      reports.push(out.report);
    }
    const save = JSON.parse(JSON.stringify(makeSave({
      initial,
      decisionLog: state.decisionLog,
      playerId: PLAYER,
      weeksPlayed: weeks,
      fingerprint: fingerprintOf(reports, PLAYER),
    })));
    return { save, state };
  }

  test('rank, contribution and the weeks in the red, and the replay matches what was played', async () => {
    const { save, state } = await savedGame(3);
    const result = await outcome(recordedFile(save));

    // Against the game as it was PLAYED, not as the reader replays it, so this
    // also holds that the replay reproduces it.
    const played = finalStandings(state).find((row) => row.id === PLAYER);
    const red = gameTotals(state.history, PLAYER).weeks
      .filter((week) => week.netProfitPaise < 0).map((week) => week.round);

    expect(result.exact).toBe(true);
    expect(result.weeksPlayed).toBe(3);
    expect(result.of).toBe(state.advertisers.length);
    expect(result.rank).toBe(played.rank);
    expect(result.grossRank).toBe(played.grossRank);
    expect(result.netProfitPaise).toBe(played.netProfitPaise);
    expect(result.weeksInTheRed).toEqual(red);
  });

  test('a week that lost money after returns is in the red; one that made money is not', () => {
    const week = (round, netProfitPaise) => ({
      round,
      byAdvertiser: {
        [PLAYER]: {
          traffic: { impressions: 0, clicks: 0, costPaise: 0 },
          conversions: { final: 0, stillPending: 0, returned: 0 },
          money: { netProfitPaise },
        },
      },
    });
    const history = [week(1, 50_000), week(2, -1), week(3, 0), week(4, -20_000)];
    expect(weeksInTheRed(history, PLAYER)).toEqual([2, 4]);
  });

  test('a replay that no longer matches is reported, not trusted', async () => {
    const { save } = await savedGame(2);
    save.fingerprint[0][0] += 1;
    const result = await outcome(recordedFile(save));
    expect(result.exact).toBe(false);
  });

  test('a player who stopped in round 0 has no outcome to replay', async () => {
    expect(await outcome(recordedFile(null))).toBeNull();
  });
});

describe('the printed report', () => {
  test('it says the times, the answers and the device, and survives a missing save', async () => {
    const text = await report(recordedFile(null));
    expect(text).toMatch(/round 0\s+10:00/);
    expect(text).toMatch(/weeks 5-11\s+1:10/);
    expect(text).toMatch(/Broad match wanders\./);
    expect(text).toMatch(/390 × 844/);
    expect(text).toMatch(/no saved game/i);
  });
});
