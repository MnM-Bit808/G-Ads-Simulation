import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  serialise, deserialise, roundTrip, logDecisions, decisionsForRound, replayGame,
} from '../engine/serialise.js';
import { runRound } from '../engine/round.js';
import { makeGameState, PLAYER_ID } from './fixtures/gameState.js';
import { SCHEMA_VERSION } from '../engine/constants.js';

const STATE = makeGameState();

describe('save and load round-trip', () => {
  test('a fresh state survives JSON intact', () => {
    expect(roundTrip(STATE)).toEqual(STATE);
  });

  test('a played state survives too', () => {
    // The real risk: an accumulator that is a Map in memory works perfectly
    // and vanishes on reload. Anything that cannot survive JSON must not be
    // in game state.
    const next = runRound(STATE, { mode: 'expected' }).nextGameState;
    expect(roundTrip(next)).toEqual(next);
  });

  test('history and pending queues come back whole', () => {
    const r1 = runRound(STATE, { mode: 'expected' });
    const r2 = runRound(r1.nextGameState, { mode: 'expected' });
    const reloaded = roundTrip(r2.nextGameState);

    expect(reloaded.history).toHaveLength(2);
    const player = reloaded.advertisers.find((a) => a.id === PLAYER_ID);
    expect(player.pendingConversions.length).toBeGreaterThan(0);
    expect(Object.keys(player.qualityHistory).length).toBeGreaterThan(0);
  });

  test('a reloaded state runs on and gives the same numbers', () => {
    const next = runRound(STATE, { mode: 'expected' }).nextGameState;
    const fromMemory = runRound(next, { mode: 'expected' });
    const fromDisk = runRound(roundTrip(next), { mode: 'expected' });
    expect(fromDisk.raw.byAdvertiser[PLAYER_ID].costPaise)
      .toBe(fromMemory.raw.byAdvertiser[PLAYER_ID].costPaise);
  });

  test('pretty output is valid too, just larger', () => {
    expect(serialise(STATE, { pretty: true }).length)
      .toBeGreaterThan(serialise(STATE).length);
    expect(deserialise(serialise(STATE, { pretty: true }))).toEqual(STATE);
  });
});

describe('an unknown schemaVersion throws (L16)', () => {
  test('loading an older version is refused', () => {
    const old = JSON.stringify({ ...STATE, schemaVersion: '0.2' });
    expect(() => deserialise(old)).toThrow(/unknown schemaVersion/);
  });

  test('a missing version is refused', () => {
    const { schemaVersion, ...rest } = STATE;
    expect(() => deserialise(JSON.stringify(rest))).toThrow(/unknown schemaVersion/);
  });

  test('the version is checked before anything else is read', () => {
    // A version mismatch makes every other field suspect, so there is nothing
    // to gain by reading on and reporting a more specific complaint.
    const broken = JSON.stringify({ schemaVersion: '0.1' });
    expect(() => deserialise(broken)).toThrow(/unknown schemaVersion/);
  });

  test('saving a mismatched state is refused too', () => {
    expect(() => serialise({ ...STATE, schemaVersion: '9.9' })).toThrow(/refusing to save/);
  });

  test('the current version is what the constants say', () => {
    expect(deserialise(serialise(STATE)).schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe('malformed saves fail with something readable', () => {
  test('not JSON at all', () => {
    expect(() => deserialise('{ definitely not')).toThrow(/not valid JSON/);
  });

  test('JSON but not a game state', () => {
    for (const bad of ['[]', '42', '"a save"', 'null']) {
      expect(() => deserialise(bad), bad).toThrow();
    }
  });

  test('a state with no advertisers', () => {
    expect(() => deserialise(JSON.stringify({ ...STATE, advertisers: [] })))
      .toThrow(/no advertisers/);
  });

  test('a state with no query set', () => {
    expect(() => deserialise(JSON.stringify({ ...STATE, querySet: null })))
      .toThrow(/no query set/);
  });

  test('a state with no usable round or seed', () => {
    expect(() => deserialise(JSON.stringify({ ...STATE, round: null })))
      .toThrow(/usable round/);
    expect(() => deserialise(JSON.stringify({ ...STATE, rootSeed: 'abc' })))
      .toThrow(/usable rootSeed/);
  });
});

describe('the decision log', () => {
  const decision = { campaign: { ...STATE.advertisers[0].campaign, strategy: 'maxClicks' } };

  test('appends one entry per advertiser who submitted', () => {
    const log = logDecisions([], 1, { [PLAYER_ID]: decision }, { [PLAYER_ID]: 'player' });
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ round: 1, advertiserId: PLAYER_ID, source: 'player' });
  });

  test('records where each decision came from', () => {
    // A replay needs to know which entries could not have been regenerated
    // even in principle.
    const log = logDecisions([], 1,
      { vella: decision, kestrel: decision, marlow: decision },
      { vella: 'player', kestrel: 'policy:disciplined', marlow: 'llm' });
    expect(log.map((e) => e.source).sort())
      .toEqual(['llm', 'player', 'policy:disciplined']);
  });

  test('an unlabelled source is marked unknown rather than guessed', () => {
    expect(logDecisions([], 1, { [PLAYER_ID]: decision })[0].source).toBe('unknown');
  });

  test('it accumulates across rounds without disturbing earlier entries', () => {
    let log = logDecisions([], 1, { [PLAYER_ID]: decision }, { [PLAYER_ID]: 'player' });
    log = logDecisions(log, 2, { [PLAYER_ID]: decision }, { [PLAYER_ID]: 'player' });
    expect(log).toHaveLength(2);
    expect(log[0].round).toBe(1);
  });

  test('it does not mutate the log it was given (R1)', () => {
    const log = [];
    logDecisions(log, 1, { [PLAYER_ID]: decision });
    expect(log).toHaveLength(0);
  });

  test('decisionsForRound pulls back exactly what runRound wants', () => {
    const log = logDecisions([], 3, { [PLAYER_ID]: decision }, { [PLAYER_ID]: 'player' });
    expect(decisionsForRound(log, 3)).toEqual({ [PLAYER_ID]: decision });
    expect(decisionsForRound(log, 4)).toEqual({});
  });

  test('a log survives a save and load', () => {
    const withLog = { ...STATE, decisionLog: logDecisions([], 1, { [PLAYER_ID]: decision }) };
    expect(roundTrip(withLog).decisionLog).toEqual(withLog.decisionLog);
  });
});

describe('replay reproduces a game without a model (L12)', () => {
  const decision = (strategy) => ({
    campaign: { ...STATE.advertisers[0].campaign, strategy },
  });

  /** Play three rounds live, logging every decision as it is submitted. */
  function playLive() {
    let state = STATE;
    let log = [];
    const costs = [];
    const strategies = ['manual', 'maxClicks', 'targetCpa'];

    for (let i = 0; i < 3; i++) {
      const decisions = { [PLAYER_ID]: decision(strategies[i]) };
      log = logDecisions(log, state.round, decisions, { [PLAYER_ID]: 'player' });
      const result = runRound(state, { mode: 'sampled', seed: 555, decisions });
      costs.push(result.raw.byAdvertiser[PLAYER_ID].costPaise);
      state = result.nextGameState;
    }
    return { log, costs };
  }

  test('replaying the log gives the same numbers, round for round', () => {
    const live = playLive();
    const { reports } = replayGame(STATE, live.log, { mode: 'sampled', seed: 555 });
    expect(reports.map((r) => r.byAdvertiser[PLAYER_ID].traffic.costPaise))
      .toEqual(live.costs);
  });

  test('and the same final state', () => {
    const live = playLive();
    const replayed = replayGame(STATE, live.log, { mode: 'sampled', seed: 555 });
    expect(replayed.finalState.round).toBe(STATE.round + 3);
    const player = replayed.finalState.advertisers.find((a) => a.id === PLAYER_ID);
    expect(player.campaign.strategy).toBe('targetCpa');
  });

  test('it replays every logged round and stops', () => {
    const live = playLive();
    expect(replayGame(STATE, live.log, { mode: 'expected' }).reports).toHaveLength(3);
  });

  test('an empty log replays nothing rather than guessing', () => {
    const { finalState, reports } = replayGame(STATE, [], { mode: 'expected' });
    expect(reports).toHaveLength(0);
    expect(finalState).toBe(STATE);
  });

  test('a log that does not start where the state does throws', () => {
    // Silently running the wrong rounds would produce a plausible game that
    // never happened.
    const log = logDecisions([], 7, { [PLAYER_ID]: decision('manual') });
    expect(() => replayGame(STATE, log, { mode: 'expected' }))
      .toThrow(/desynchronised/);
  });

  test('replay never needs a model: the module cannot reach one', () => {
    // Arity proved nothing here - Function.length stops counting at the first
    // defaulted parameter, so it read 2. The real guarantee is that this
    // module imports nothing from agents/ and calls nothing that could leave
    // the process, so there is nowhere for a model call to hide (R2, L12).
    const src = readFileSync(
      fileURLToPath(new URL('../engine/serialise.js', import.meta.url)), 'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    expect(/from\s*['"][^'"]*agents/.test(src)).toBe(false);
    for (const escape of ['fetch(', 'XMLHttpRequest', 'require(', 'import(']) {
      expect(src.includes(escape), escape).toBe(false);
    }
  });

  test('and two replays of one log agree exactly', () => {
    const live = playLive();
    const a = replayGame(STATE, live.log, { mode: 'sampled', seed: 555 });
    const b = replayGame(STATE, live.log, { mode: 'sampled', seed: 555 });
    expect(a.reports.map((r) => r.byAdvertiser[PLAYER_ID].traffic.costPaise))
      .toEqual(b.reports.map((r) => r.byAdvertiser[PLAYER_ID].traffic.costPaise));
  });
});
