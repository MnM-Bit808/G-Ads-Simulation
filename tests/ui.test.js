import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
const source = readdirSync(UI)
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
    for (const { file, text } of source) {
      const body = stripped(text);
      for (const name of forbidden) {
        expect(body.includes(name), `${file} names ${name}`).toBe(false);
      }
    }
  });

  test('it formats money from paise and never stores rupees', () => {
    // R7: money is integer paise everywhere, formatted only at the display
    // layer. This IS the display layer, so the division belongs here and
    // nowhere else — but it must divide, not carry a second unit around.
    const all = source.map((s) => s.text).join('\n');
    expect(all).toMatch(/\/\s*100/);
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
