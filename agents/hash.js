/**
 * A content hash for the grade and tag caches.
 *
 * WHY NOT node:crypto
 *
 * The grader and the tagger both run in round 0, and round 0 runs in the
 * browser — `ui/` imports the real engine rather than a copy of it, which is
 * the whole point of not repeating what the v0.1 prototypes did. `engine/` and
 * `content/` were already free of Node APIs; these two modules were the only
 * thing standing between the game and a browser tab.
 *
 * Web Crypto would be the obvious swap and it is asynchronous, which
 * `gradeAdOffline` and `tagKeywordOffline` cannot be: round 0 grades and tags
 * synchronously while assembling the game state.
 *
 * WHY NOT rng.js's hashString
 *
 * It exists and it is 32 bits, which is enough for what it does — deriving a
 * seed, where a collision changes which random numbers you get and nothing
 * else. Here a collision means an edited ad is NOT regraded, silently, and the
 * player keeps a score for copy they replaced. Different consequence, different
 * requirement. Coupling the grade cache to the RNG's seeding function would
 * also mean any future change to seeding quietly invalidated every cached
 * grade.
 *
 * WHAT THIS IS
 *
 * cyrb53, a well-known non-cryptographic hash with 53 bits of output — the
 * whole mantissa of a double. Collision odds across the few dozen ads and
 * keywords one game produces are negligible.
 *
 * It is NOT cryptographic and the prefix says so. Spec 5.2 illustrates these
 * fields as `sha1:...`; writing `sha1:` over something that is not SHA-1 would
 * be a small lie in a file the whole project reads for provenance.
 */

/**
 * @param {string} text
 * @returns {string} e.g. "h53:1f0a3c..."
 */
export function contentHash(text) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const value = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return `h53:${value.toString(16).padStart(14, '0')}`;
}
