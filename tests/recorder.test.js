/**
 * The playtest recorder (stage B of reviews/slc-review.md).
 *
 * WHY IT EXISTS. The review's route asks for three strangers to play the live
 * site as a baseline before stage C rebuilds the screens. The only recorder
 * this project ever had was a scratch script injected into the browser pane, so
 * it could watch nobody but a player sitting at this machine. A stranger plays
 * in their own browser, so the recording has to live in the game.
 *
 * WHAT IT MEASURES is what the one recorded human game taught: time per phase
 * was the finding (round 0 took 67% of the session, weeks 5-11 took 72s). So
 * time is measured carefully, with a hidden tab and an idle one taken off,
 * because "round 0 took 25 minutes" is worthless if ten of them were lunch.
 *
 * The clock and storage are passed in, so none of this needs a browser.
 */

import { describe, test, expect } from 'vitest';
import {
  RECORDING_KEY, IDLE_AFTER_MS, playtestMode, createRecorder, summarise,
  describeClick, onScreen, playtestFile, playtestFilename, savedGameFor,
} from '../ui/recorder.js';
import { SAVE_KEY } from '../ui/save.js';

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

/** A clock the test moves by hand. */
function clock(start = 1_700_000_000_000) {
  let t = start;
  const now = () => t;
  now.advance = (ms) => { t += ms; };
  return now;
}

/** Tick once a second for `seconds`, the way the page does. */
function tickFor(recorder, now, seconds, cards = []) {
  for (let i = 0; i < seconds; i++) {
    now.advance(1000);
    recorder.tick(cards);
  }
}

function fresh() {
  const storage = memoryStorage();
  const now = clock();
  const recorder = createRecorder({ storage, now });
  recorder.load();
  return { storage, now, recorder };
}

const phaseNamed = (log, name) => summarise(log).find((p) => p.name === name);

describe('it is switched on by the invite link and nothing else', () => {
  test('the ordinary game records nothing', () => {
    const storage = memoryStorage();
    expect(playtestMode('', storage)).toBe(false);
    expect(storage.items.size).toBe(0);
  });

  test('the playtest link switches it on, and a reload without it stays on', () => {
    const storage = memoryStorage();
    expect(playtestMode('?playtest=1', storage)).toBe(true);
    expect(playtestMode('', storage)).toBe(true);
  });

  test('playtest=0 switches it off and forgets it', () => {
    const storage = memoryStorage();
    playtestMode('?playtest=1', storage);
    expect(playtestMode('?playtest=0', storage)).toBe(false);
    expect(playtestMode('', storage)).toBe(false);
  });

  test('a browser that refuses storage still honours the link, without throwing', () => {
    expect(playtestMode('?playtest=1', refusing)).toBe(true);
    expect(playtestMode('', refusing)).toBe(false);
  });
});

describe('time per phase', () => {
  test('a phase lasts from its start to the next one', () => {
    const { now, recorder } = fresh();
    recorder.phase('round 0');
    tickFor(recorder, now, 600, ['Your position']);
    recorder.click('Your budget › Open the account');
    recorder.phase('week 1');
    tickFor(recorder, now, 60);

    const log = recorder.log();
    expect(phaseNamed(log, 'round 0').seconds).toBe(600);
    expect(phaseNamed(log, 'week 1').seconds).toBe(60);
  });

  test('time with the tab hidden is taken off', () => {
    const { now, recorder } = fresh();
    recorder.phase('round 0');
    tickFor(recorder, now, 2);
    recorder.hidden();
    now.advance(300_000);
    recorder.visible();
    tickFor(recorder, now, 3);

    const round0 = phaseNamed(recorder.log(), 'round 0');
    expect(round0.seconds).toBe(305);
    expect(round0.hiddenSeconds).toBe(300);
    expect(round0.activeSeconds).toBe(5);
  });

  test('a link opened in a background tab counts as hidden until it is looked at', () => {
    const { now, recorder } = fresh();
    recorder.hidden();
    recorder.phase('round 0');
    now.advance(60_000);
    recorder.visible();
    tickFor(recorder, now, 10);

    const round0 = phaseNamed(recorder.log(), 'round 0');
    expect(round0.seconds).toBe(70);
    expect(round0.hiddenSeconds).toBe(60);
    expect(round0.activeSeconds).toBe(10);
  });

  test('a visible tab nobody touches for two minutes counts as idle, not reading', () => {
    const { now, recorder } = fresh();
    recorder.phase('week 3');
    tickFor(recorder, now, IDLE_AFTER_MS / 1000 + 30);

    const week3 = phaseNamed(recorder.log(), 'week 3');
    expect(week3.idleSeconds).toBe(30);
    expect(week3.activeSeconds).toBe(IDLE_AFTER_MS / 1000);
  });

  test('scrolling or moving the pointer keeps a phase active without being recorded', () => {
    const { now, recorder } = fresh();
    recorder.phase('week 3');
    for (let i = 0; i < 4; i++) {
      tickFor(recorder, now, 60);
      recorder.activity();
    }
    const week3 = phaseNamed(recorder.log(), 'week 3');
    expect(week3.idleSeconds).toBe(0);
    expect(week3.clicks).toBe(0);
  });

  test('drawing the same screen again does not start a new phase', () => {
    const { now, recorder } = fresh();
    recorder.phase('week 2');
    tickFor(recorder, now, 10);
    recorder.phase('week 2');
    tickFor(recorder, now, 10);
    expect(summarise(recorder.log()).map((p) => [p.name, p.seconds])).toEqual([['week 2', 20]]);
  });

  test('a page that froze or slept is not counted as reading time', () => {
    const { now, recorder } = fresh();
    recorder.phase('week 2');
    tickFor(recorder, now, 1);
    now.advance(600_000);
    recorder.tick([]);

    const week2 = phaseNamed(recorder.log(), 'week 2');
    expect(week2.seconds).toBe(601);
    expect(week2.activeSeconds).toBeLessThanOrEqual(6);
  });
});

describe('what the player did', () => {
  test('clicks are kept in order, with where they landed and in which phase', () => {
    const { recorder } = fresh();
    recorder.phase('round 0');
    recorder.click('Keywords › Add');
    recorder.phase('week 1');
    recorder.click('Search terms › Last week');

    const { clicks } = recorder.log();
    expect(clicks.map((c) => [c.phase, c.where])).toEqual([
      [0, 'Keywords › Add'],
      [1, 'Search terms › Last week'],
    ]);
    expect(phaseNamed(recorder.log(), 'week 1').clicks).toBe(1);
  });

  test('keystrokes are counted and never recorded', () => {
    const { recorder } = fresh();
    recorder.phase('round 0');
    for (const letter of ['s', 'e', 'c', 'r', 'e', 't']) recorder.key(letter);

    const log = recorder.log();
    expect(phaseNamed(log, 'round 0').keys).toBe(6);
    expect(JSON.stringify(log)).not.toMatch(/"s"|"e"|"c"|"r"|"t"/);
  });

  test('each card is credited with the time it was on screen', () => {
    const { now, recorder } = fresh();
    recorder.phase('week 6');
    tickFor(recorder, now, 5, ['The week', 'What came back']);
    tickFor(recorder, now, 3, ['What came back']);

    expect(phaseNamed(recorder.log(), 'week 6').cards).toEqual({
      'The week': 5,
      'What came back': 8,
    });
  });

  test('a card sitting on an idle screen is not credited', () => {
    const { now, recorder } = fresh();
    recorder.phase('week 6');
    tickFor(recorder, now, IDLE_AFTER_MS / 1000 + 60, ['Budget']);
    expect(phaseNamed(recorder.log(), 'week 6').cards.Budget).toBe(IDLE_AFTER_MS / 1000);
  });

  test('how long each week took to compute, which is the live-site timing nobody has', () => {
    const { recorder } = fresh();
    recorder.week(1, 412.7);
    recorder.week(2, 280.2);
    expect(recorder.log().weeks).toEqual([
      { week: 1, computeMs: 413 },
      { week: 2, computeMs: 280 },
    ]);
  });
});

describe('it survives the things a stranger will do', () => {
  test('a reload carries on the same recording, and closes the phase it interrupted', () => {
    const storage = memoryStorage();
    const now = clock();
    const first = createRecorder({ storage, now });
    first.load();
    first.phase('round 0');
    tickFor(first, now, 5);
    first.click('Keywords › Add');
    now.advance(3000); // the page reloads; nothing fires

    const second = createRecorder({ storage, now });
    second.load();
    second.phase('round 0');

    const log = second.log();
    expect(log.loads).toHaveLength(2);
    expect(summarise(log).map((p) => p.name)).toEqual(['round 0', 'round 0']);
    expect(summarise(log)[0].seconds).toBe(5);
    expect(log.clicks).toHaveLength(1);
  });

  test('answers typed at the end survive a reload', () => {
    const storage = memoryStorage();
    const now = clock();
    const first = createRecorder({ storage, now });
    first.load();
    first.answer('lessons', 'Broad match wanders.');

    const second = createRecorder({ storage, now });
    second.load();
    expect(second.log().answers).toEqual({ lessons: 'Broad match wanders.' });
  });

  test('a browser that refuses storage records in memory and never throws', () => {
    const now = clock();
    const recorder = createRecorder({ storage: refusing, now });
    recorder.load();
    recorder.phase('round 0');
    recorder.click('Keywords › Add');
    tickFor(recorder, now, 2, ['Keywords']);
    expect(recorder.log().clicks).toHaveLength(1);
  });

  test('a stored recording it cannot read is replaced by a fresh one, not crashed on', () => {
    const storage = memoryStorage();
    storage.setItem(RECORDING_KEY, '{not json');
    const recorder = createRecorder({ storage, now: clock() });
    recorder.load();
    expect(recorder.log().loads).toHaveLength(1);
  });

  test('a page that is closing can write out what it has not yet stored', () => {
    const { storage, recorder } = fresh();
    recorder.phase('round 0');
    for (let i = 0; i < 7; i++) recorder.key();
    recorder.flush();
    const stored = JSON.parse(storage.getItem(RECORDING_KEY));
    expect(stored.phases[0].keys).toBe(7);
  });
});

describe('the saved game travels with the recording', () => {
  test('the save is read as it was stored, so the reader can replay it', () => {
    const storage = memoryStorage();
    const save = { format: 1, weeksPlayed: 2, decisionLog: [{ round: 1 }] };
    storage.setItem(SAVE_KEY, JSON.stringify(save));
    expect(savedGameFor(storage)).toEqual(save);
  });

  test('no save, an unreadable one, or refusing storage all read as none', () => {
    expect(savedGameFor(memoryStorage())).toBeNull();
    const broken = memoryStorage();
    broken.setItem(SAVE_KEY, '{half');
    expect(savedGameFor(broken)).toBeNull();
    expect(savedGameFor(refusing)).toBeNull();
    expect(savedGameFor(null)).toBeNull();
  });
});

describe('naming a click', () => {
  test('the card, then the control', () => {
    expect(describeClick({ card: 'Search terms', control: 'Last week' }))
      .toBe('Search terms › Last week');
  });

  test('whitespace is collapsed and a long label is cut short', () => {
    const where = describeClick({ card: '  Keywords ', control: `Add ${'x'.repeat(100)}\n  now` });
    expect(where.startsWith('Keywords › Add x')).toBe(true);
    expect(where.length).toBeLessThanOrEqual('Keywords › '.length + 60);
    expect(where).not.toMatch(/\s{2,}|\n/);
  });

  test('a click with no card or no control still says what it can', () => {
    expect(describeClick({ card: 'Budget', control: '' })).toBe('Budget');
    expect(describeClick({ card: null, control: 'Run the week' })).toBe('Run the week');
    expect(describeClick({})).toBe('(page)');
  });
});

describe('what counts as a card on screen', () => {
  const viewport = 800;

  test('a card in view is on screen, one out of view is not', () => {
    expect(onScreen({ top: 100, bottom: 400 }, viewport)).toBe(true);
    expect(onScreen({ top: -500, bottom: -10 }, viewport)).toBe(false);
    expect(onScreen({ top: 900, bottom: 1200 }, viewport)).toBe(false);
  });

  test('half a card showing counts; a sliver at the edge does not', () => {
    expect(onScreen({ top: 500, bottom: 1100 }, viewport)).toBe(true);
    expect(onScreen({ top: 760, bottom: 1300 }, viewport)).toBe(false);
  });

  test('a card taller than the screen counts while it fills most of it', () => {
    expect(onScreen({ top: -1000, bottom: 2000 }, viewport)).toBe(true);
  });
});

describe('the file the player sends', () => {
  test('it carries the summary, the raw recording, the answers, the save and the device', () => {
    const { now, recorder } = fresh();
    recorder.phase('round 0');
    tickFor(recorder, now, 10);
    recorder.answer('lessons', 'Defend your name.');
    const save = { format: 1, weeksPlayed: 3, decisionLog: [] };
    const environment = { userAgent: 'test', viewport: [1280, 720], screen: [1920, 1080] };

    const file = playtestFile({ log: recorder.log(), save, environment });
    expect(file.summary[0]).toMatchObject({ name: 'round 0', seconds: 10 });
    expect(file.recording.loads).toHaveLength(1);
    expect(file.answers).toEqual({ lessons: 'Defend your name.' });
    expect(file.save).toEqual(save);
    expect(file.environment).toEqual(environment);
    expect(JSON.parse(JSON.stringify(file))).toEqual(file);
  });

  test('a player who stopped before week 1 has no save, and the file says so', () => {
    const { recorder } = fresh();
    recorder.phase('round 0');
    const file = playtestFile({ log: recorder.log(), save: null, environment: {} });
    expect(file.save).toBeNull();
  });

  test('it is named for when the recording began, so three files never collide', () => {
    const log = { startedAt: Date.UTC(2026, 8, 14, 9, 5) };
    expect(playtestFilename(log)).toBe('playtest-2026-09-14-0905.json');
  });
});
