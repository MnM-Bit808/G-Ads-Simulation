/**
 * Which look a visit runs in (plans/2026-09-13-studio-makeover.md, section 5).
 *
 * The Studio makeover is built beside today's screens: a link turns it on and
 * the browser remembers, so the classic game is never broken while it is built.
 */

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

describe('which look a visit runs in', () => {
  test('everyone gets today\'s screens unless they ask', () => {
    expect(lookMode('', memory())).toBe('classic');
    expect(lookMode('', null)).toBe('classic');
  });

  test('the link turns the studio on, and the browser remembers it', () => {
    const storage = memory();
    expect(lookMode('?look=studio', storage)).toBe('studio');
    expect(storage.getItem(LOOK_KEY)).toBe('studio');
    expect(lookMode('', storage)).toBe('studio');
  });

  test('?look=classic turns it off again', () => {
    const storage = memory();
    lookMode('?look=studio', storage);
    expect(lookMode('?look=classic', storage)).toBe('classic');
    expect(lookMode('', storage)).toBe('classic');
  });

  test('it rides alongside the playtest link', () => {
    expect(lookMode('?playtest=1&look=studio', memory())).toBe('studio');
  });

  test('an unknown value changes nothing', () => {
    const storage = memory();
    lookMode('?look=studio', storage);
    expect(lookMode('?look=neon', storage)).toBe('studio');
  });

  test('a browser that refuses storage still honours the link', () => {
    expect(lookMode('?look=studio', refusing)).toBe('studio');
    expect(lookMode('', refusing)).toBe('classic');
  });
});
