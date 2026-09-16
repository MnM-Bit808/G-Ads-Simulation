import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FORBIDDEN_IN_PUBLIC_VIEW } from '../engine/insights.js';

/**
 * The interface is a view. It is not tested here for what it draws — that needs
 * a DOM, and the numbers it draws are tested to death upstream.
 *
 * What IS tested is the thing this project has already got wrong once. The two
 * `.jsx` files at the repository root are v0.1 prototypes, and each carries its
 * own copy of the demand curve, the conversion multipliers and the auction.
 * They agreed with the spec on the day they were written and drifted the moment
 * it moved, and nothing could tell — there was no shared engine to disagree
 * with.
 *
 * So: the interface must import the real engine, and must not carry physics of
 * its own.
 */

const UI = fileURLToPath(new URL('../ui/', import.meta.url));
// Every module under ui/, folders included. It used to read only the top
// level, so the guards below would never have reached ui/words/ or ui/guide/,
// which hold the sentences most likely to quote something withheld.
const source = readdirSync(UI, { recursive: true })
  .map((f) => f.split('\\').join('/'))
  .filter((f) => f.endsWith('.js'))
  .map((f) => ({ file: f, text: readFileSync(join(UI, f), 'utf8') }));

const stripped = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');

describe('the interface uses the real engine (spec 6, build step 14)', () => {
  test('there is some interface to check', () => {
    expect(source.length).toBeGreaterThan(0);
  });

  test('it imports the engine rather than reimplementing it', () => {
    const all = source.map((s) => s.text).join('\n');
    expect(all).toMatch(/from '\.\.\/(setup|game)\.js'/);
    expect(all).toMatch(/from '\.\.\/engine\//);
  });

  test('it defines no curve, multiplier or economics of its own', () => {
    // The specific shape of the v0.1 drift: a long array of decimals sitting in
    // the view, which was a copy of something in constants.js until one of them
    // changed.
    for (const { file, text } of source) {
      const body = stripped(text);
      const longNumericArrays = body.match(/\[\s*(?:-?\d+\.\d+\s*,\s*){5,}/g) ?? [];
      expect(longNumericArrays, `${file} carries its own curve`).toEqual([]);
    }
  });

  test('it does not name the constants it should be importing', () => {
    // A view may format money and may lay out a grid. It may not decide what a
    // conversion rate is, what a slot is worth, or where the ad rank floor sits.
    const forbidden = [
      'AD_RANK_FLOOR', 'POSITION_CTR_MULTIPLIERS', 'HOURLY_INTENT_CURVE',
      'HOUR_PROFILES', 'POSITION_ECONOMICS', 'PURPOSE_MODIFIERS',
      'CONV_RATE_CLAMP', 'ATTRIBUTION_LAG_DISTRIBUTION', 'BROAD_MATCH_MIN_OVERLAP',
    ];

    // ONE ALLOWANCE, AND IT IS NARROWER THAN IT LOOKS (I27).
    //
    // This guard is a proxy: the name stands in for "the view is deciding
    // economics". `ui/dashboard.js` QUOTES the attribution lag to the player —
    // "55% this week, then 28%, then 12% and then 5%" — and computes nothing
    // from it. The card above it was already describing the same rule in
    // hardcoded prose ("about five rounds ... three for the order to arrive"),
    // so the choice was never between naming the constant and staying pure. It
    // was between DERIVING the sentence and TYPING the numbers again, and the
    // test directly above this one forbids the second: a copy of something in
    // constants.js that stays right until one of them changes.
    //
    // So the name is allowed in exactly one file, for exactly one constant. If
    // a second entry ever wants adding here, that is the moment to ask whether
    // the view has started doing arithmetic it should not be doing.
    const quoted = new Map([['dashboard.js', ['ATTRIBUTION_LAG_DISTRIBUTION']]]);

    for (const { file, text } of source) {
      const body = stripped(text);
      const allowed = quoted.get(file) ?? [];
      for (const name of forbidden) {
        if (allowed.includes(name)) continue;
        expect(body.includes(name), `${file} names ${name}`).toBe(false);
      }
    }
  });

  test('the one quoted constant is displayed, never computed with', () => {
    // The allowance above is only safe while dashboard.js reads the lag to
    // WRITE A SENTENCE. The moment it multiplies by it, it is deciding when a
    // conversion lands, which is `attribution.js`'s job and nobody else's.
    const dashboard = source.find((s) => s.file === 'dashboard.js');
    const body = stripped(dashboard.text);
    const uses = body.split('ATTRIBUTION_LAG_DISTRIBUTION').slice(1);
    for (const after of uses) {
      const next = after.slice(0, 90);
      expect(next, 'the lag is being computed with, not quoted').not.toMatch(/^\s*[*/+-]/);
    }
    // And it must still reach the screen as a percentage, not as a raw share.
    expect(body).toMatch(/ATTRIBUTION_LAG_DISTRIBUTION[\s\S]{0,200}100 \*/);
  });

  test('it formats money from paise and never stores rupees', () => {
    // R7: money is integer paise everywhere, formatted only at the display
    // layer. This IS the display layer, so the division belongs here and
    // nowhere else — but it must divide, not carry a second unit around.
    const all = source.map((s) => s.text).join('\n');
    expect(all).toMatch(/\/\s*100/);
  });

  test('it never reads what 16.1 withholds from every viewer', () => {
    // The guard that was missing. round-zero.js marked the player's own
    // territory in the keyword planner with a dot, computed by homeCell() —
    // which reads priceAffinity and purposeAffinity, the two fields 16.1
    // withholds "from every viewer, including the advertiser the affinity
    // favours". It shipped in slice two and survived four sessions.
    //
    // The list is the ENGINE'S, not a copy: FORBIDDEN_IN_PUBLIC_VIEW is what
    // getPublicView strips, so a field added there is guarded here for free.
    // Only the query-side fields apply — an advertiser's own bid and budget are
    // its own business (16.2), and the form edits them.
    const queryFields = [
      'priceAffinity', 'purposeAffinity', 'convMultiplier', 'valueMultiplier',
      'returnRateMultiplier', 'isHeadTerm', 'hourProfile',
    ];
    for (const name of queryFields) {
      expect(FORBIDDEN_IN_PUBLIC_VIEW, `${name} is no longer withheld by the engine`)
        .toContain(name);
    }

    // And the functions that DERIVE them, which is how the dot got in: the
    // affinities were never named, only asked about.
    const derived = ['homeCell', 'territoryQueries', 'realisedConvRate', 'businessFor'];

    for (const { file, text } of source) {
      const body = stripped(text);
      for (const name of [...queryFields, ...derived]) {
        expect(body.includes(name), `${file} reads ${name}`).toBe(false);
      }
    }
  });

  test('it holds no game state the engine should own', () => {
    // The view may remember which reports it has been handed. It may not keep
    // its own advertisers, its own query set, or its own budget arithmetic.
    for (const { file, text } of source) {
      const body = stripped(text);
      for (const name of ['monthSpentPaise =', 'pendingConversions =', 'qualityHistory =']) {
        expect(body.includes(name), `${file} keeps ${name}`).toBe(false);
      }
    }
  });
});

describe('the linter is part of the gate (eslint.config.js)', () => {
  // The stale identifier this suite could never see - `brief is not defined`,
  // left behind when the dashboard was split out of app.js - is `no-undef`.
  // The dead function whose value rendered as an em dash is `no-unused-vars`.
  // Both reached a browser. So the lint runs INSIDE `npm test` rather than as
  // a separate command nobody remembers, and this test is what stops it being
  // quietly unwired again.
  const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));

  test('npm test does not go green without it', () => {
    expect(pkg.scripts.test).toMatch(/eslint/);
    expect(pkg.scripts.test).toMatch(/vitest/);
  });

  test('and it covers the view, which is what it is for', () => {
    const config = readFileSync(fileURLToPath(new URL('../eslint.config.js', import.meta.url)), 'utf8');
    expect(config).toMatch(/ui\/\*\*/);
    expect(config).toMatch(/globals\.browser/);
  });
});

describe('every interface module at least loads', () => {
  // Weaker than the linter and kept anyway: it is the only thing here that
  // EXECUTES a module, so it catches a bad import path and a missing export
  // that static analysis reads straight past. It has caught one real bug, a
  // syntax error, in nine.

  // Named explicitly rather than built from the directory listing: a dynamic
  // import of a computed path cannot be resolved statically, and the test below
  // makes sure this map never falls behind the directory.
  const LOADABLE = {
    'dom.js': () => import('../ui/dom.js'),
    'look.js': () => import('../ui/look.js'),
    'chart.js': () => import('../ui/chart.js'),
    'dashboard.js': () => import('../ui/dashboard.js'),
    'decisions.js': () => import('../ui/decisions.js'),
    'ending.js': () => import('../ui/ending.js'),
    'landing-page.js': () => import('../ui/landing-page.js'),
    'round-zero.js': () => import('../ui/round-zero.js'),
    'india-map.js': () => import('../ui/india-map.js'),
    'save.js': () => import('../ui/save.js'),
    'recorder.js': () => import('../ui/recorder.js'),
    'version.js': () => import('../ui/version.js'),
    'words/line.js': () => import('../ui/words/line.js'),
    'words/returns.js': () => import('../ui/words/returns.js'),
    'words/guide.js': () => import('../ui/words/guide.js'),
    'words/debrief.js': () => import('../ui/words/debrief.js'),
    'words/capital.js': () => import('../ui/words/capital.js'),
    'words/market.js': () => import('../ui/words/market.js'),
    'words/form.js': () => import('../ui/words/form.js'),
    'guide/chapters.js': () => import('../ui/guide/chapters.js'),
    'guide/figures.js': () => import('../ui/guide/figures.js'),
    'guide/drawer.js': () => import('../ui/guide/drawer.js'),
    'guide/book.js': () => import('../ui/guide/book.js'),
    'guide/page.js': () => import('../ui/guide/page.js'),
    'debrief/read.js': () => import('../ui/debrief/read.js'),
    'debrief/render.js': () => import('../ui/debrief/render.js'),
    'season/read.js': () => import('../ui/season/read.js'),
    'shell/sections.js': () => import('../ui/shell/sections.js'),
    'shell/tray.js': () => import('../ui/shell/tray.js'),
    'shell/shell.js': () => import('../ui/shell/shell.js'),
    'shell/context.js': () => import('../ui/shell/context.js'),
    'door/read.js': () => import('../ui/door/read.js'),
    'door/render.js': () => import('../ui/door/render.js'),
    'words/door.js': () => import('../ui/words/door.js'),
    'words/shell.js': () => import('../ui/words/shell.js'),
    'roundzero/rules.js': () => import('../ui/roundzero/rules.js'),
    'kit/controls.js': () => import('../ui/kit/controls.js'),
    'kit/card.js': () => import('../ui/kit/card.js'),
    'kit/planner.js': () => import('../ui/kit/planner.js'),
    'kit/serp.js': () => import('../ui/kit/serp.js'),
    'words/keywords.js': () => import('../ui/words/keywords.js'),
    'keywords/read.js': () => import('../ui/keywords/read.js'),
    'keywords/render.js': () => import('../ui/keywords/render.js'),
    'words/ad.js': () => import('../ui/words/ad.js'),
    'ad/read.js': () => import('../ui/ad/read.js'),
    'ad/render.js': () => import('../ui/ad/render.js'),
    'words/where.js': () => import('../ui/words/where.js'),
    'where/read.js': () => import('../ui/where/read.js'),
    'where/render.js': () => import('../ui/where/render.js'),
    'words/week.js': () => import('../ui/words/week.js'),
    'week/read.js': () => import('../ui/week/read.js'),
    'week/render.js': () => import('../ui/week/render.js'),
    'words/typed.js': () => import('../ui/words/typed.js'),
    'typed/read.js': () => import('../ui/typed/read.js'),
    'typed/render.js': () => import('../ui/typed/render.js'),
    'words/money.js': () => import('../ui/words/money.js'),
    'money/read.js': () => import('../ui/money/read.js'),
    'money/render.js': () => import('../ui/money/render.js'),
    'returns/read.js': () => import('../ui/returns/read.js'),
    'returns/render.js': () => import('../ui/returns/render.js'),
    'words/rivals.js': () => import('../ui/words/rivals.js'),
    'rivals/read.js': () => import('../ui/rivals/read.js'),
    'rivals/render.js': () => import('../ui/rivals/render.js'),
    'words/results.js': () => import('../ui/words/results.js'),
    'words/playtest.js': () => import('../ui/words/playtest.js'),
    'results/read.js': () => import('../ui/results/read.js'),
    'results/render.js': () => import('../ui/results/render.js'),
    'reserve.js': () => import('../ui/reserve.js'),
    'map/india.js': () => import('../ui/map/india.js'),
    'roundzero/studio.js': () => import('../ui/roundzero/studio.js'),
    'roundzero/market.js': () => import('../ui/roundzero/market.js'),
    'roundzero/position.js': () => import('../ui/roundzero/position.js'),
    'roundzero/keywords.js': () => import('../ui/roundzero/keywords.js'),
    'roundzero/ad.js': () => import('../ui/roundzero/ad.js'),
    'roundzero/money.js': () => import('../ui/roundzero/money.js'),
    'words/roundZero.js': () => import('../ui/words/roundZero.js'),
  };

  test('the list of modules to load is complete', () => {
    // app.js is excluded on purpose: it reaches for `document` at import time,
    // because wiring the buttons is the first thing it does.
    const onDisk = source.map((s) => s.file).filter((f) => f !== 'app.js').sort();
    expect(Object.keys(LOADABLE).sort()).toEqual(onDisk);
  });

  test('each module imports cleanly', async () => {
    for (const [file, load] of Object.entries(LOADABLE)) {
      const module = await load();
      expect(Object.keys(module).length, file).toBeGreaterThan(0);
    }
  });

  test('and the ones that draw a screen export a render function', async () => {
    for (const file of ['chart.js', 'dashboard.js', 'decisions.js', 'ending.js', 'round-zero.js']) {
      const module = await LOADABLE[file]();
      const renders = Object.entries(module).filter(([name]) => name.startsWith('render'));
      expect(renders.length, file).toBe(1);
      expect(typeof renders[0][1], file).toBe('function');
    }
  });
});

describe('the dev server serves the project, not just the interface', () => {
  const server = readFileSync(fileURLToPath(new URL('../dev-server.js', import.meta.url)), 'utf8');

  test('it exists, because ES modules will not load over file://', () => {
    expect(server).toMatch(/createServer/);
  });

  test('it refuses to serve outside the repository', () => {
    // It serves the whole project so that ui/ can reach engine/, which makes
    // the traversal check load-bearing rather than ceremonial.
    expect(server).toMatch(/startsWith\(ROOT/);
    expect(server).toMatch(/403/);
  });

  test('and it does not cache, because the engine changes under it', () => {
    expect(server).toMatch(/no-store/);
  });
});
