/**
 * Which look a visit runs in (plans/2026-09-13-studio-makeover.md, section 5).
 *
 * The Studio makeover is built beside today's screens, not over them: the link
 * `?look=studio` turns it on and this browser remembers it, the way the
 * playtest link is remembered (ui/recorder.js, `playtestMode`); `?look=classic`
 * turns it off. Everyone else gets today's game, unchanged, until the
 * switch-over retires the classic look.
 */

export const LOOK_KEY = 'g-ads-simulation:look';

/**
 * @param {string} search - `location.search`
 * @param {Storage|null} storage
 * @returns {'classic'|'studio'}
 */
export function lookMode(search, storage) {
  const asked = new URLSearchParams(search).get('look');
  try {
    if (asked === 'studio') {
      storage?.setItem(LOOK_KEY, 'studio');
      return 'studio';
    }
    if (asked === 'classic') {
      storage?.removeItem(LOOK_KEY);
      return 'classic';
    }
    return storage?.getItem(LOOK_KEY) === 'studio' ? 'studio' : 'classic';
  } catch {
    // A browser that will not store the choice still came in on the link.
    return asked === 'studio' ? 'studio' : 'classic';
  }
}
