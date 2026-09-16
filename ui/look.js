/**
 * Which look a visit runs in (plans/2026-09-13-studio-makeover.md, section 5).
 *
 * Since the switch-over (2026-09-16, the owner's choice) the Studio IS the
 * game: a visit with nothing asked gets it. `?look=classic` still reaches
 * today's page, remembered in this browser the way the playtest link is
 * (ui/recorder.js, `playtestMode`), until `?look=studio` clears it — part 2
 * removes the classic look and this file with it.
 *
 * The stored value is the ASKED-FOR one, so a tester whose browser remembers
 * 'studio' from the build reads as the Studio either way.
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
    if (asked === 'classic') {
      storage?.setItem(LOOK_KEY, 'classic');
      return 'classic';
    }
    if (asked === 'studio') {
      storage?.removeItem(LOOK_KEY);
      return 'studio';
    }
    return storage?.getItem(LOOK_KEY) === 'classic' ? 'classic' : 'studio';
  } catch {
    // A browser that will not store the choice still came in on the link.
    return asked === 'classic' ? 'classic' : 'studio';
  }
}
