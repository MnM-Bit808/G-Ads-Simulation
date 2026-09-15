/**
 * Saving a game in the browser, and getting it back (stage A4 of
 * reviews/slc-review.md).
 *
 * WHY IT EXISTS. The game lived in memory, so a reload lost it with no warning
 * and no error. The review lost a whole round 0 that way, and HANDOVER had to
 * tell playtesters to be careful. A message to be careful is not a fix.
 *
 * WHAT IS SAVED IS THE START AND THE LOG, NEVER THE STATE. Measured on a real
 * twelve-week game: the starting state is 79 KB and the decision log 184 KB,
 * while the final state is 4.5 MB, about the whole of what a browser allows a
 * site to store. The engine is pure and seeded, so the start plus every decision
 * rebuilds everything else, which is what HANDOVER said before anyone designed
 * a schema around snapshotting GameState.
 *
 * Storage is passed in, so none of this needs a browser to test.
 */

import { describe, test, expect } from 'vitest';
import {
  SAVE_KEY, SAVE_FORMAT, makeSave, writeSave, readSave, clearSave,
  fingerprintOf, restoreSave,
} from '../ui/save.js';
import { startGame } from '../setup.js';
import { playRound } from '../game.js';
import { controllerFor } from '../agents/policies.js';
import { serialise } from '../engine/serialise.js';
import { QUERY_SET } from '../content/querySet.js';
import { BRAND_IDENTITIES } from '../content/brands.js';
import { homeCell } from '../engine/querySet.js';
import { SCHEMA_VERSION, TOTAL_ROUNDS } from '../engine/constants.js';

/** A Map dressed as localStorage. */
function memoryStorage() {
  const items = new Map();
  return {
    getItem: (k) => (items.has(k) ? items.get(k) : null),
    setItem: (k, v) => { items.set(k, String(v)); },
    removeItem: (k) => { items.delete(k); },
    items,
  };
}

/** Storage that refuses, the way private browsing or a full quota does. */
const refusing = {
  getItem: () => { throw new Error('SecurityError'); },
  setItem: () => { throw new Error('QuotaExceededError'); },
  removeItem: () => { throw new Error('SecurityError'); },
};

const PLAYER = BRAND_IDENTITIES[0].id;
const own = QUERY_SET.queries.filter((q) => homeCell(q) === 'mid|lifestyle').slice(0, 4);

function start() {
  return startGame({
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
}

/** Play `weeks` weeks the way the interface does, through playRound. */
async function play(weeks) {
  const initial = start();
  const controllers = Object.fromEntries(initial.advertisers.map((a, i) => [
    a.id,
    i === 0
      ? (self) => (self.round === 2 ? { campaign: { negatives: [{ text: 'gym', matchType: 'broad' }] } } : null)
      : controllerFor(a.policyId),
  ]));
  const sources = Object.fromEntries(initial.advertisers.map((a, i) => [
    a.id, i === 0 ? 'player' : `policy:${a.policyId}`,
  ]));
  let state = initial;
  const reports = [];
  const insights = [];
  while (state.round <= weeks) {
    const out = await playRound(state, controllers, { mode: 'expected', sources });
    reports.push(out.report);
    insights.push(out.insights);
    state = out.nextGameState;
  }
  return { initial, state, reports, insights };
}

const saveOf = (game) => makeSave({
  initial: game.initial,
  decisionLog: game.state.decisionLog,
  playerId: PLAYER,
  weeksPlayed: game.reports.length,
  fingerprint: fingerprintOf(game.reports, PLAYER),
});

describe('what goes into storage', () => {
  test('a save round-trips through storage unchanged', async () => {
    const game = await play(3);
    const storage = memoryStorage();
    expect(writeSave(storage, saveOf(game))).toBe(true);

    const back = readSave(storage);
    expect(back.playerId).toBe(PLAYER);
    expect(back.weeksPlayed).toBe(3);
    expect(back.decisionLog).toEqual(game.state.decisionLog);
    expect(JSON.stringify(back.initialState)).toBe(JSON.stringify(game.initial));
  });

  test('it is stamped with the format and the engine schema it was written under', async () => {
    const storage = memoryStorage();
    writeSave(storage, saveOf(await play(1)));
    const raw = JSON.parse(storage.getItem(SAVE_KEY));
    expect(raw.format).toBe(SAVE_FORMAT);
    expect(raw.schemaVersion).toBe(SCHEMA_VERSION);
  });

  test('a whole game fits comfortably, because the state itself is never stored', async () => {
    const game = await play(TOTAL_ROUNDS);
    const stored = JSON.stringify(saveOf(game));
    // Browsers allow about 5 MB a site. The whole final state is most of that.
    expect(stored.length).toBeLessThan(1024 * 1024);
    expect(stored.length).toBeLessThan(serialise(game.state).length / 4);
  });

  test('clearing it leaves nothing to resume', async () => {
    const storage = memoryStorage();
    writeSave(storage, saveOf(await play(1)));
    clearSave(storage);
    expect(readSave(storage)).toBeNull();
  });
});

describe('loading is strict, and never throws at the interface', () => {
  // A save the build cannot read correctly must not load and then teach
  // something false (engine/serialise.js says the same about schema versions).
  test('nothing saved reads as nothing', () => {
    expect(readSave(memoryStorage())).toBeNull();
  });

  test('garbage, another format, another schema, or missing parts read as nothing', async () => {
    const good = JSON.parse(JSON.stringify(saveOf(await play(1))));
    const cases = {
      'not json': '{this is not',
      'another format': JSON.stringify({ ...good, format: SAVE_FORMAT + 1 }),
      'another schema': JSON.stringify({ ...good, schemaVersion: 'v0.0' }),
      'no player': JSON.stringify({ ...good, playerId: undefined }),
      'no log': JSON.stringify({ ...good, decisionLog: undefined }),
      'weeks out of range': JSON.stringify({ ...good, weeksPlayed: TOTAL_ROUNDS + 1 }),
      'fingerprint of the wrong length': JSON.stringify({ ...good, fingerprint: [] }),
      'a broken start': JSON.stringify({ ...good, initial: '{"schemaVersion":"nope"}' }),
    };
    for (const [label, raw] of Object.entries(cases)) {
      const storage = memoryStorage();
      storage.setItem(SAVE_KEY, raw);
      expect(readSave(storage), label).toBeNull();
    }
  });

  test('storage that refuses is a failed save and an empty load, not a crash', async () => {
    expect(writeSave(refusing, saveOf(await play(1)))).toBe(false);
    expect(readSave(refusing)).toBeNull();
    expect(() => clearSave(refusing)).not.toThrow();
    // And a browser that will not even hand over the storage object.
    expect(writeSave(null, saveOf(await play(1)))).toBe(false);
    expect(readSave(null)).toBeNull();
  });
});

// Whole games replayed, 2-4 seconds a test on their own. The suite runs files
// in parallel, and beside the other replaying tests these crossed Vitest's
// 5-second default on an ordinary run. They assert equality, never speed, so
// the limit is only a ceiling (the writerBalance test sets one the same way).
// Sixty seconds, the same as `npm run ci` gives every test on Cloudflare's
// slower machines: a group limit overrides that, so a lower one would be
// stricter there than the default it replaces.
describe('restoring rebuilds the game the player was playing', { timeout: 60_000 }, () => {
  test('the state, every report and every insight come back exactly', async () => {
    const game = await play(4);
    const storage = memoryStorage();
    writeSave(storage, saveOf(game));

    const restored = await restoreSave(readSave(storage), { mode: 'expected' });
    expect(restored.exact).toBe(true);
    expect(JSON.stringify(restored.state)).toBe(JSON.stringify(game.state));
    expect(JSON.stringify(restored.reports)).toBe(JSON.stringify(game.reports));
    expect(restored.insights).toHaveLength(4);
  });

  test('it keeps every week as it stood before the last week ran, for Your week\'s tick', async () => {
    // Running a week rewrites the earlier ones and the engine keeps only the
    // new version, so the dashed tick needs the history from a week before.
    // A reopened game must hand back the same one the live game kept.
    const game = await play(4);
    const weekEarlier = await play(3);
    const restored = await restoreSave(readSaveOf(game), { mode: 'expected' });
    expect(restored.historyBefore).toHaveLength(3);
    expect(JSON.stringify(restored.historyBefore)).toBe(JSON.stringify(weekEarlier.state.history));
  });

  test('it reports each week as it replays, so the screen can say how far it has got', async () => {
    const game = await play(3);
    const seen = [];
    await restoreSave(readSaveOf(game), {
      mode: 'expected',
      onWeek: (week, of) => seen.push([week, of]),
    });
    expect(seen).toEqual([[1, 3], [2, 3], [3, 3]]);
  });

  test('a resumed game goes on exactly as it would have without the reload', async () => {
    // The replay matching is not enough: the weeks AFTER a resume are played by
    // fresh controllers, so a rival that remembered anything in memory would
    // diverge from here. Six weeks straight against three, a reload, and three.
    const straight = await play(6);

    const firstHalf = await play(3);
    const restored = await restoreSave(readSaveOf(firstHalf), { mode: 'expected' });
    const controllers = Object.fromEntries(restored.state.advertisers.map((a, i) => [
      a.id, i === 0 ? () => null : controllerFor(a.policyId),
    ]));
    const sources = Object.fromEntries(restored.state.advertisers.map((a, i) => [
      a.id, i === 0 ? 'player' : `policy:${a.policyId}`,
    ]));
    let state = restored.state;
    while (state.round <= 6) {
      state = (await playRound(state, controllers, { mode: 'expected', sources })).nextGameState;
    }
    expect(JSON.stringify(state)).toBe(JSON.stringify(straight.state));
  });

  test('a replay that no longer matches what the player saw says so', async () => {
    // What a deploy between saving and loading would do: the same decisions,
    // run by a changed engine, give different weeks. The player must be told
    // rather than handed a game quietly different from the one they played.
    const game = await play(2);
    const save = readSaveOf(game);
    save.fingerprint = save.fingerprint.map(([cost, clicks]) => [cost + 1, clicks]);
    const restored = await restoreSave(save, { mode: 'expected' });
    expect(restored.exact).toBe(false);
  });
});

/** Write a game's save to fresh storage and read it back, as a load would. */
function readSaveOf(game) {
  const storage = memoryStorage();
  writeSave(storage, saveOf(game));
  return readSave(storage);
}
