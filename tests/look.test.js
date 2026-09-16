/**
 * Which look a visit runs in. Since the switch-over (2026-09-16, the owner's
 * choice) the Studio is the default; `?look=classic` still reaches the classic
 * page until part 2 removes it, and this browser remembers that choice until
 * `?look=studio`.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test, expect } from 'vitest';
import { lookMode, LOOK_KEY } from '../ui/look.js';

const memory = () => {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
  };
};
const refusing = {
  getItem() { throw new Error('blocked'); },
  setItem() { throw new Error('blocked'); },
  removeItem() { throw new Error('blocked'); },
};

describe('the Studio is the default look', () => {
  test('a visit with nothing asked runs the Studio', () => {
    expect(lookMode('', memory())).toBe('studio');
    expect(lookMode('', null)).toBe('studio');
  });

  test('the classic page is still reachable, and remembered', () => {
    const storage = memory();
    expect(lookMode('?look=classic', storage)).toBe('classic');
    expect(storage.getItem(LOOK_KEY)).toBe('classic');
    expect(lookMode('', storage)).toBe('classic');
    expect(lookMode('?look=studio', storage)).toBe('studio');
    expect(lookMode('', storage)).toBe('studio');
  });

  // Every tester who played the makeover has 'studio' stored from before the
  // switch-over. It must not read as "asked for something else".
  test('a remembered Studio from before the switch-over still reads as the Studio', () => {
    const storage = memory();
    storage.setItem(LOOK_KEY, 'studio');
    expect(lookMode('', storage)).toBe('studio');
  });

  test('it rides alongside the playtest link', () => {
    expect(lookMode('?playtest=1&look=classic', memory())).toBe('classic');
  });

  test('an unknown value changes nothing', () => {
    const storage = memory();
    lookMode('?look=classic', storage);
    expect(lookMode('?look=neon', storage)).toBe('classic');
  });

  test('a browser that will not store the choice gets what it asked for, or the Studio', () => {
    expect(lookMode('', refusing)).toBe('studio');
    expect(lookMode('?look=classic', refusing)).toBe('classic');
  });

  // Without this the page paints the classic header, then the script repaints
  // it: a white flash on every load of the game everyone now gets.
  test('the page opens in the Studio\'s colours, before any script runs', () => {
    expect(readFileSync(fileURLToPath(new URL('../ui/index.html', import.meta.url)), 'utf8'))
      .toMatch(/<body class="studio">/);
  });
});
