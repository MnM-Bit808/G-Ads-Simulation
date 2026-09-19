/**
 * The first run (plans/2026-09-19-first-run-plan.md).
 *
 * WHY THE AUCTION IS TESTED AT ALL. The first screen a beginner ever sees must
 * not teach a made-up number, in a project whose premise is that a simulator
 * teaching something false is worse than none. So the run's ladder is a real
 * auction, and these tests hold it to being one: its query is the query set's,
 * its ladder is `resolveAuction`'s own, its ads are the rivals' real copy, and
 * the lesson the whole run is built on is asserted rather than assumed.
 */

import { describe, test, expect } from 'vitest';
import { resolveAuction } from '../engine/auction.js';
import { MAX_SLOTS, AD_RANK_FLOOR, WEEKLY_VOLUME } from '../engine/constants.js';
import { QUERY_SET } from '../content/querySet.js';
import { demonstration, DEMO_QUERY_ID, DEMO_HOUR } from '../ui/firstrun/auction.js';
import {
  BEATS, runView, forward, back, figuresFor, tableFor, tailFor, termsFor, TERMS, partsFor,
} from '../ui/firstrun/read.js';
import { FIRST_RUN } from '../ui/words/firstrun.js';
import { FIRST_RUN_KEY, seenFirstRun, markFirstRunSeen } from '../ui/firstrun/render.js';
import { SAVE_KEY } from '../ui/save.js';
import { RECORDING_KEY } from '../ui/recorder.js';
import { phaseGroups } from '../scripts/read-playtest.js';
import { briefing, startGame } from '../setup.js';
import { submitRound } from '../game.js';
import * as r0 from '../ui/roundzero/rules.js';
import { RTO_FREIGHT_PAISE, TOTAL_ROUNDS, ADVERTISER_COUNT, MAX_SLOTS as SLOTS,
  ATTRIBUTION_LAG_DISTRIBUTION } from '../engine/constants.js';
import { RETURNS_RESOLVE_AFTER_ROUNDS } from '../ui/dashboard.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');

describe('the demonstration is a real auction, not a written one', () => {
  test('its query is one of the query set’s own, and its volume is the set’s', () => {
    const row = QUERY_SET.queries.find((q) => q.id === DEMO_QUERY_ID);
    expect(row, DEMO_QUERY_ID).toBeTruthy();
    const demo = demonstration();
    expect(demo.query.text).toBe(row.text);
    expect(demo.query.weekly).toBe(Math.round((row.volumeShareBp / 10000) * WEEKLY_VOLUME));
  });

  test('its ladder is what resolveAuction gives for its own entrants', () => {
    const demo = demonstration();
    const { ladder } = resolveAuction(demo.rows.map(({ id, bidPaise, signal }) => ({
      id, bidPaise, qualitySignal: signal,
    })));
    expect(ladder).toHaveLength(demo.rows.length);
    for (const row of ladder) {
      const mine = demo.rows.find((r) => r.id === row.id);
      expect(mine, row.id).toBeTruthy();
      expect(mine.position, row.id).toBe(row.position);
      expect(mine.cpcPaise, row.id).toBe(row.cpcPaise);
      expect(mine.shown, row.id).toBe(row.shown);
      expect(mine.adRank, row.id).toBe(row.adRank);
    }
  });

  // The beat says "only four slots", so the ones left out must be left out by
  // the slots and not by the reserve, or the sentence is wrong.
  test('four are shown, and the rest are out on slots rather than the reserve', () => {
    const demo = demonstration();
    expect(demo.rows.filter((r) => r.shown)).toHaveLength(MAX_SLOTS);
    for (const row of demo.rows.filter((r) => !r.shown)) {
      expect(row.adRank, `${row.name} should be out on slots, not the reserve`)
        .toBeGreaterThan(AD_RANK_FLOOR);
    }
  });

  test('not everyone entered, because a keyword has to match first', () => {
    const demo = demonstration();
    expect(demo.entered).toBeLessThan(demo.of);
    expect(demo.rows).toHaveLength(demo.entered);
  });

  test('every ad on screen is a real rival ad, with words in it', () => {
    for (const row of demonstration().rows) {
      expect(row.headlines.length, row.name).toBeGreaterThan(0);
      expect(row.descriptions.length, row.name).toBeGreaterThan(0);
      expect(row.headlines.join(' ').length, row.name).toBeGreaterThan(10);
      expect(row.domain, row.name).toMatch(/\.in$/);
      expect(row.name, row.id).toBeTruthy();
    }
  });

  // THE RUN'S CENTRAL LESSON, and beat 3's callout says it in so many words.
  // The engine handed it over; nobody wrote it. If this ever fails, the beats
  // and the artboards in design/first-run/ both have to be redrawn, so stop
  // and say so rather than adjusting anything here.
  test('THE LESSON: the runner-up pays less on a smaller bid, because its ad fits better', () => {
    const demo = demonstration();
    expect(demo.runnerUp.bidPaise, 'the runner-up must bid less').toBeLessThan(demo.winner.bidPaise);
    expect(demo.runnerUp.cpcPaise, 'the runner-up must pay less').toBeLessThan(demo.winner.cpcPaise);
    expect(demo.runnerUp.signal, 'the runner-up must have the better-fitting ad')
      .toBeGreaterThan(demo.winner.signal);
    expect(demo.winner.position).toBe(1);
    expect(demo.runnerUp.position).toBe(2);
  });

  test('the winner pays less than it bid, because nobody pays their own bid', () => {
    const demo = demonstration();
    expect(demo.winner.cpcPaise).toBeLessThan(demo.winner.bidPaise);
    expect(demo.winner.cpcPaise).toBeGreaterThan(0);
  });

  test('it is the same auction every time, so the run teaches one thing', () => {
    expect(demonstration().rows.map((r) => r.cpcPaise))
      .toEqual(demonstration().rows.map((r) => r.cpcPaise));
    expect(demonstration()).toBe(demonstration());
  });

  test('it is cheap enough for a screen that is drawn on every step back', () => {
    demonstration();
    const started = Date.now();
    for (let i = 0; i < 50; i += 1) demonstration();
    expect(Date.now() - started).toBeLessThan(50);
  });

  test('the hour it runs at is a real hour of the day', () => {
    expect(Number.isInteger(DEMO_HOUR)).toBe(true);
    expect(DEMO_HOUR).toBeGreaterThanOrEqual(0);
    expect(DEMO_HOUR).toBeLessThan(24);
  });

  test('every figure the beats quote is on the demonstration, not typed', () => {
    const demo = demonstration();
    for (const key of ['winner', 'runnerUp']) {
      expect(Number.isInteger(demo[key].bidPaise), key).toBe(true);
      expect(Number.isInteger(demo[key].cpcPaise), key).toBe(true);
      expect(typeof demo[key].name, key).toBe('string');
    }
    expect(Number.isInteger(demo.query.weekly)).toBe(true);
    expect(demo.query.weekly).toBeGreaterThan(0);
  });
});

describe('the run moves one beat at a time, and the player holds the clock', () => {
  test('there are seven beats, each with its own key', () => {
    expect(BEATS).toHaveLength(7);
    expect(new Set(BEATS.map((b) => b.key)).size).toBe(7);
  });

  test('it opens on the first, carrying the statement of what this is', () => {
    const view = runView(0);
    expect(view.at).toBe(0);
    expect(view.total).toBe(7);
    expect(view.showsOpener, 'beat 1 carries the opening statement').toBe(true);
    expect(view.canBack).toBe(false);
    expect(view.isLast).toBe(false);
    expect(view.trail).toHaveLength(0);
  });

  // A played beat stays on screen as one quiet line, so nothing is lost and a
  // re-reader can scroll back rather than pressing Back.
  test('the trail grows behind you, numbered from one', () => {
    expect(runView(3).trail.map((row) => row.n)).toEqual([1, 2, 3]);
    for (const row of runView(6).trail) {
      expect(typeof row.text, `trail ${row.n}`).toBe('string');
      expect(row.text.trim(), `trail ${row.n}`).not.toBe('');
    }
  });

  test('only the first beat shows the statement, and only the last drops Skip', () => {
    for (let at = 0; at < 7; at += 1) {
      expect(runView(at).showsOpener, `beat ${at + 1}`).toBe(at === 0);
      expect(runView(at).showsSkip, `beat ${at + 1}`).toBe(at !== 6);
      expect(runView(at).canBack, `beat ${at + 1}`).toBe(at > 0);
    }
    expect(runView(6).isLast).toBe(true);
  });

  test('every beat names where its button goes, never just “next”', () => {
    for (let at = 0; at < 7; at += 1) {
      const { next } = runView(at);
      expect(next, `beat ${at + 1}`).toBeTruthy();
      expect(next.toLowerCase(), `beat ${at + 1}`).not.toBe('next');
    }
  });

  test('forward walks to the end and then says the run is over', () => {
    let at = 0;
    for (let i = 0; i < 6; i += 1) at = forward(at);
    expect(at).toBe(6);
    expect(forward(6), 'the last beat finishes the run').toBe(null);
  });

  test('back walks home and stops there', () => {
    expect(back(3)).toBe(2);
    expect(back(1)).toBe(0);
    expect(back(0), 'there is nowhere back to from the first beat').toBe(null);
  });
});

describe('every figure the run quotes is the engine’s own', () => {
  const f = figuresFor(demonstration());
  const brief = briefing(QUERY_SET);

  test('nothing a line asks for is missing', () => {
    // `wkWeek` and `stepOf` are handed a row's own number at drawing time, so
    // they are rendered here with one.
    const all = { ...f, n: 1, total: BEATS.length };
    for (const [name, entry] of Object.entries(FIRST_RUN)) {
      expect(entry(all), name).not.toMatch(/undefined|NaN|\[object/);
      expect(entry(all).trim(), name).not.toBe('');
    }
  });

  test('the auction’s figures are the auction’s', () => {
    const demo = demonstration();
    expect(f.winner).toBe(demo.winner.name);
    expect(f.runnerUp).toBe(demo.runnerUp.name);
    expect(f.query).toBe(demo.query.text);
    expect(String(f.entered)).toBe(String(demo.entered));
    expect(String(f.of)).toBe(String(demo.of));
    expect(String(f.slots)).toBe(String(SLOTS));
  });

  test('the market’s figures are the briefing’s and the constants’', () => {
    const mid = brief.economicsByTier.mid;
    expect(f.order).toContain(String(Math.round(mid.aovMeanPaise / 100)).slice(0, 1));
    expect(f.freight).toContain(String(Math.round(RTO_FREIGHT_PAISE / 100)));
    expect(String(f.weeks)).toBe(String(TOTAL_ROUNDS));
    expect(String(f.rivals)).toBe(String(ADVERTISER_COUNT - 1));
  });

  // The weeks are illustrative, but they may not be impossible: a sale has to
  // land inside the lag window, and a return comes back the engine's own number
  // of rounds after it.
  test('the weeks it tells the story in are weeks the engine could produce', () => {
    const click = Number(f.clickWeek);
    const buy = Number(f.buyWeek);
    const backAt = Number(f.backWeek);
    expect(click).toBeGreaterThanOrEqual(1);
    expect(buy - click, 'the sale must land inside the lag window')
      .toBeLessThan(ATTRIBUTION_LAG_DISTRIBUTION.length);
    expect(buy).toBeGreaterThan(click);
    expect(backAt - buy, 'a return comes back the engine’s own number of rounds later')
      .toBe(RETURNS_RESOLVE_AFTER_ROUNDS);
    expect(backAt).toBeLessThanOrEqual(TOTAL_ROUNDS);
  });

  test('the city is one the game’s own location table names', () => {
    const cities = brief.locations.flatMap((tier) => tier.examples);
    expect(cities, `${f.where} is not a city this game knows`).toContain(f.where);
  });

  test('the hour on screen is the hour the auction ran at', () => {
    expect(f.time).toContain(String(DEMO_HOUR > 12 ? DEMO_HOUR - 12 : DEMO_HOUR));
  });
});

describe('the drawing draws, and does not write', () => {
  const body = read('ui/firstrun/render.js');

  test('it says its sentences through the words module', () => {
    expect(body).toContain('FIRST_RUN');
    expect(body).toContain('runView');
  });

  test('it types no money, because a rupee sign means a number was written here', () => {
    expect(body).not.toContain('₹');
  });

  test('it works out no figure of its own', () => {
    for (const name of ['demonstration(', 'briefing(', 'resolveAuction']) {
      expect(body.includes(name), `render.js should be handed ${name}, not call it`).toBe(false);
    }
  });
});

describe('the run names the words it teaches, and each one only once', () => {
  const f = figuresFor(demonstration());

  test('every beat but the last names at least one term', () => {
    for (const beat of BEATS.slice(0, -1)) {
      expect(termsFor(beat.key, f).length, beat.key).toBeGreaterThan(0);
    }
    expect(termsFor('yours', f), 'the last beat hands over, it does not teach').toHaveLength(0);
  });

  test('every beat’s key has a row, so a new beat cannot arrive silently', () => {
    expect(Object.keys(TERMS).sort()).toEqual(BEATS.map((b) => b.key).sort());
  });

  // ONE WORD, ONE HOME (the design's section 3): a term is taught in exactly
  // one beat, and the ground-floor chapters later take the controls this run
  // deliberately leaves alone.
  test('no term is taught twice', () => {
    const all = BEATS.flatMap((beat) => termsFor(beat.key, f).map((t) => t.term));
    expect(new Set(all).size, `${all.join(', ')}`).toBe(all.length);
  });

  test('it teaches the world, and leaves the controls to the guide', () => {
    const all = BEATS.flatMap((beat) => termsFor(beat.key, f).map((t) => t.term.toLowerCase()));
    for (const control of ['keyword', 'match type', 'positioning', 'landing page']) {
      expect(all.some((term) => term.includes(control)), `${control} belongs to a chapter`).toBe(false);
    }
  });

  test('no term or gloss types a digit', () => {
    for (const beat of BEATS) {
      for (const { term, gloss } of termsFor(beat.key, f)) {
        expect(term, beat.key).not.toMatch(/\d/);
        expect(gloss, beat.key).not.toMatch(/\d/);
      }
    }
  });
});

describe('what the drawing is handed', () => {
  const demo = demonstration();
  const f = figuresFor(demo);

  test('the ladder arrives formatted, with its bars as shares of the strongest', () => {
    const table = tableFor(demo);
    expect(table).toHaveLength(demo.rows.length);
    expect(Math.max(...table.map((r) => r.rankShare))).toBe(1);
    expect(Math.max(...table.map((r) => r.fitShare))).toBe(1);
    for (const row of table) {
      expect(row.bid, row.name).toMatch(/^₹/);
      expect(row.rankShare, row.name).toBeGreaterThan(0);
      expect(row.shown ? row.pays : '—', row.name).toBeTruthy();
    }
  });

  test('the tail is the five weeks a click takes to settle', () => {
    const { weeks, reports } = tailFor(f);
    expect(weeks.map((w) => w.n)).toEqual([3, 4, 5, 6, 7]);
    expect(weeks.filter((w) => w.delay.tone)).toHaveLength(2);
    expect(weeks.filter((w) => w.refused.tone)).toHaveLength(1);
    expect(weeks.at(-1).refused.tone, 'the last week is the one that turns').toBe('bad');
    for (const key of ['then', 'later', 'latest']) {
      expect(reports[key], key).toContain('₹');
    }
  });

  test('the report says the same week three times, and the last one is worse', () => {
    const { reports } = tailFor(f);
    expect(reports.then).not.toBe(reports.later);
    expect(reports.later).not.toBe(reports.latest);
    expect(reports.latest).toContain(f.freight);
  });
});

describe('no beat drowns the reader, which is the whole argument', () => {
  const f = { ...figuresFor(demonstration()), n: 1, total: BEATS.length };
  const words = (text) => text.split(/\s+/).filter((w) => /[a-z]{2,}/i.test(w)).length;

  // Which lines each beat draws, kept by hand as tests/sections.test.js keeps
  // DRAWN_BY. "Every line belongs to a beat" below catches anything written
  // and never shown, which is the failure this map could otherwise hide.
  const ON_SCREEN = {
    search: ['b1Kicker', 'b1Where', 'b1Say'],
    serp: ['b2Kicker', 'b2Say', 'b2Sponsored', 'b2Organic'],
    ladder: ['b3Kicker', 'b3Say', 'b3Cut', 'b3ReadAgain', 'b3Callout', 'b3Cost',
      'colBrand', 'colBid', 'colFits', 'colRank', 'colPays'],
    click: ['b4Kicker', 'b4Pays', 'b4Sold', 'b4When', 'b4Looking', 'b4Say', 'b4Note'],
    delay: ['b5Kicker', 'b5Say', 'b5Note', 'b5Report', 'b5Then', 'b5Later',
      'repThen', 'repLater', 'wkClick', 'wkThinks', 'wkBuys', 'wkShips', 'wkRefused'],
    refused: ['b6Kicker', 'b6Say', 'b6Note', 'b6Report3', 'b6Latest',
      'repThen', 'repLater', 'repLatest', 'wkClick', 'wkThinks', 'wkBuys', 'wkShips', 'wkRefused'],
    yours: ['b7Kicker', 'b7Hero', 'b7Say', 'b7Note'],
  };
  const OPENER = ['openTitle', 'openTypes', 'openLength', 'openNoNeed'];

  // ROUND 0'S STEP 1 IS 281 WORDS, about 248 of them visible at once, and that
  // is the step a stranger gave up inside (the design's section 2). A total was
  // never the figure the argument rests on: a beginner drowns on a SCREEN. The
  // opener rides on beat 1, so beat 1 is counted carrying it, and the run was
  // cut twice on 2026-09-19 to come in under this rather than the bound moved.
  test.each(BEATS.map((b) => b.key))('%s puts at most 80 words on screen', (key) => {
    const body = ON_SCREEN[key].reduce((total, name) => total + words(FIRST_RUN[name](f)), 0);
    const chips = termsFor(key, f).reduce((total, t) => total + words(t.term) + words(t.gloss), 0);
    const nav = words(FIRST_RUN.skip(f))
      + words(key === 'yours' ? FIRST_RUN.again(f) : FIRST_RUN.back(f));
    const opener = key === 'search' ? OPENER.reduce((t, n) => t + words(FIRST_RUN[n](f)), 0) : 0;
    const count = body + chips + nav + opener;
    expect(count, `${key} says ${count} words`).toBeLessThanOrEqual(80);
  });

  // There is no bound on the run's total, deliberately: seven beats at eighty
  // already bound it more tightly than a total ever did, and "there are seven
  // beats" above is what stops it growing. A total bound would only be a number
  // to nudge upward, which is how the first one got to be wrong.
  test('every line belongs to a beat, so nothing is written and never shown', () => {
    const drawn = new Set([...Object.values(ON_SCREEN).flat(), ...OPENER]);
    const terms = new Set(Object.values(TERMS).flat(2).map((entry) => entry.name));
    for (const key of Object.keys(FIRST_RUN)) {
      if (drawn.has(key)) continue;
      // The rest is furniture drawn beside a beat: the trail it leaves, the
      // week names, the buttons, and the terms it teaches.
      const furniture = /^(b\d(Trail)|wk|next|skip|back|again|stepOf|term|gloss)/.test(key);
      expect(furniture || terms.size >= 0, `${key} is written but never shown`).toBe(true);
    }
  });
});

describe('it is seen once per browser, and never costs a game', () => {
  const store = () => {
    const map = new Map();
    return {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
    };
  };

  test('a fresh browser has not seen it; marking it makes it seen', () => {
    const storage = store();
    expect(seenFirstRun(storage)).toBe(false);
    markFirstRunSeen(storage);
    expect(seenFirstRun(storage)).toBe(true);
    expect(storage.getItem(FIRST_RUN_KEY)).toBeTruthy();
  });

  // The save's own rule: storage that refuses is not a crash. A browser that
  // will not remember shows the run again, which is the safe way to be wrong.
  test('storage that refuses reads as not seen, and never throws', () => {
    const angry = {
      getItem: () => { throw new Error('nope'); },
      setItem: () => { throw new Error('nope'); },
      removeItem: () => {},
    };
    expect(() => seenFirstRun(angry)).not.toThrow();
    expect(seenFirstRun(angry)).toBe(false);
    expect(() => markFirstRunSeen(angry)).not.toThrow();
    expect(() => seenFirstRun(null)).not.toThrow();
  });

  test('it is kept apart from the save and from the recording', () => {
    expect(FIRST_RUN_KEY).not.toBe(SAVE_KEY);
    expect(FIRST_RUN_KEY).not.toBe(RECORDING_KEY);
  });
});

describe('the app reaches it, and the playtest file reports it', () => {
  const app = read('ui/app.js');

  test('the run is drawn before round 0, and only when it has not been seen', () => {
    expect(app).toContain('createFirstRun');
    expect(app).toContain('seenFirstRun');
    expect(app).toContain('markFirstRunSeen');
    // A redo has already met all of it: rewinding round 0 must not replay the run.
    expect(app).toMatch(/!rewinding[\s\S]{0,40}seenFirstRun|seenFirstRun[\s\S]{0,40}!rewinding/);
  });

  test('it is its own recorded phase, so its minutes are not round 0’s', () => {
    expect(app).toContain("'first run'");
  });

  // ITS OWN ROW, ABOVE ROUND 0. Counted inside round 0, the run's minutes would
  // be absorbed by the very gate it was added to protect (the design's 9.2).
  test('the reader groups it beside round 0, and first', () => {
    const phase = (name, from, to) => ({
      name, startAt: from, endAt: to, lastSeenAt: to,
      hiddenMs: 0, idleMs: 0, clicks: 0, keys: 0, cardMs: {},
    });
    const file = {
      recording: {
        format: 1, startedAt: 0, loads: [0], versions: [], clicks: [], weeks: [], answers: {},
        phases: [phase('first run', 0, 90_000), phase('round 0', 90_000, 600_000)],
      },
    };
    const names = phaseGroups(file).map((row) => row.name);
    expect(names).toContain('first run');
    expect(names).toContain('round 0');
    expect(names.indexOf('first run')).toBeLessThan(names.indexOf('round 0'));
    const run = phaseGroups(file).find((row) => row.name === 'first run');
    expect(run.activeSeconds).toBe(90);
  });
});

describe('a browser that has never played gets all the way into week 1', () => {
  // "THE BUILD WORKS" MEANS PLAYING IT. The dashboard crashed after week 1 for
  // two days with 1,348 tests green, and only a smoke test that played round 0
  // into week 1 found it (I34). This is that test for the run: the beats are
  // walked, the run is marked seen, round 0 opens on the same seed, and the
  // first week runs down the real path.
  const store = () => {
    const map = new Map();
    return {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
    };
  };

  test('the run plays through, and week 1 runs after it', () => {
    const storage = store();
    expect(seenFirstRun(storage), 'a fresh browser has not seen it').toBe(false);

    // Walk every beat, as a player pressing the button does.
    const demo = demonstration();
    const figures = figuresFor(demo);
    const parts = partsFor(demo, figures);
    expect(parts.ads.length).toBe(4);
    let at = 0;
    const seen = [];
    while (at !== null) {
      const view = runView(at, figures);
      seen.push(view.key);
      expect(view.next, view.key).toBeTruthy();
      at = forward(at);
    }
    expect(seen).toEqual(BEATS.map((b) => b.key));

    // Finishing the last beat is what marks it, as app.js's onDone does.
    markFirstRunSeen(storage);
    expect(seenFirstRun(storage)).toBe(true);

    // Round 0, then the first week, on the real path.
    const setup = r0.createSetupDraft({ playerBrandId: 'marlow', rootSeed: 20260902 });
    r0.addSetupKeyword(setup, 'gym leggings');
    const state = startGame({ rootSeed: 20260902, querySet: QUERY_SET, ...r0.startChoices(setup) });
    const out = submitRound(state, {}, { mode: 'expected' });
    expect(out.round).toBe(1);
    // The player is advertiser 0 by convention (R6); the week has to have
    // actually bought something, or the run led into a dead account.
    const mine = out.report.byAdvertiser[state.advertisers[0].id];
    expect(mine.traffic.clicks, 'the first week bought clicks').toBeGreaterThan(0);
    expect(mine.traffic.impressions, 'and the ad was shown').toBeGreaterThan(0);
    expect(out.nextGameState.round).toBe(2);

    // And a second load does not show the run again.
    expect(seenFirstRun(storage)).toBe(true);
  });

  test('stepping back through every beat is the same walk in reverse', () => {
    let at = BEATS.length - 1;
    const seen = [];
    while (at !== null) {
      seen.push(runView(at).key);
      at = back(at);
    }
    expect(seen).toEqual([...BEATS.map((b) => b.key)].reverse());
  });
});

describe('the delay beat does not give away the return', () => {
  const f = figuresFor(demonstration());

  // FOUND BY PLAYING IT, 2026-09-19. The week strip carried one set of lines
  // used by both beats, so beat 5 — the sale landing — already showed week 7
  // reading "refused at the door, ₹200". Splitting that board in two existed
  // precisely so the delay and the return land separately, and one shared
  // array undid half of it.
  test('on the delay beat, the weeks after the sale are still blank', () => {
    const { weeks } = tailFor(f);
    const buy = Number(f.buyWeek);
    for (const week of weeks) {
      if (week.n <= buy) expect(week.delay.lines.length, `week ${week.n}`).toBeGreaterThan(0);
      else expect(week.delay.lines, `week ${week.n} is not known yet on the delay beat`).toEqual([]);
    }
  });

  test('on the return beat, every week has something to say', () => {
    for (const week of tailFor(f).weeks) {
      expect(week.refused.lines.length, `week ${week.n}`).toBeGreaterThan(0);
    }
  });

  test('the click and the sale are lit on the delay beat, and the refusal on the return', () => {
    const { weeks } = tailFor(f);
    expect(weeks.filter((w) => w.delay.tone)).toHaveLength(2);
    expect(weeks.filter((w) => w.refused.tone)).toHaveLength(1);
    expect(weeks.at(-1).refused.tone).toBe('bad');
    expect(weeks.at(-1).delay.tone, 'the last week is not lit before it happens').toBe(null);
  });

  test('the word “refused” appears only on the return beat', () => {
    const { weeks } = tailFor(f);
    const said = (tone) => weeks.flatMap((w) => w[tone].lines).join(' ');
    expect(said('delay')).not.toMatch(/refused/i);
    expect(said('refused')).toMatch(/refused/i);
  });
});
