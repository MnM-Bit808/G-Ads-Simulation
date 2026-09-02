/**
 * Seeded randomness (spec R1, 9.2).
 *
 * Nothing in engine/ may call Math.random. Every draw comes from a generator
 * created here from an explicit seed and passed in as an argument, so a round
 * is reproducible from its inputs alone.
 *
 * The important piece is substream(). Each advertiser draws from its own stream
 * rather than a shared one. With a shared generator, an advertiser becoming
 * ineligible would shift every subsequent draw and change everyone else's
 * numbers — determinism would survive, but "change one thing and compare", the
 * core play loop, would not.
 */

/**
 * Mulberry32: a small, fast, well-distributed 32-bit PRNG.
 *
 * @param {number} seed any integer; only the low 32 bits are used
 * @returns {() => number} a generator returning values in [0, 1)
 */
export function mulberry32(seed) {
  let a = seed | 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * FNV-1a hash of a string to an unsigned 32-bit integer.
 *
 * Used to fold advertiser ids, keyword ids and query ids into seeds. Not
 * cryptographic and does not need to be — it only has to be deterministic and
 * spread similar strings apart.
 *
 * @param {string} str
 * @returns {number} unsigned 32-bit integer
 */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Fold a root seed and any number of labelled parts into a new seed.
 *
 * Numbers and strings are tagged differently before hashing so that
 * deriveSeed(1, 3) and deriveSeed(1, '3') do not collide. Part order matters.
 *
 * @param {number} rootSeed
 * @param {...(string|number)} parts
 * @returns {number} unsigned 32-bit integer
 */
export function deriveSeed(rootSeed, ...parts) {
  let h = hashString(`s:${rootSeed >>> 0}`);
  for (const part of parts) {
    const tagged = typeof part === 'number' ? `n:${part}` : `t:${part}`;
    // Mix the running hash into the part so ordering is significant.
    h = hashString(`${h}|${tagged}`);
  }
  return h >>> 0;
}

/**
 * The random stream for one advertiser in one round (spec 9.2).
 *
 * @param {number} rootSeed the game's rootSeed
 * @param {number} round round number
 * @param {string} advertiserId
 * @returns {() => number} a generator returning values in [0, 1)
 */
export function substream(rootSeed, round, advertiserId) {
  return mulberry32(deriveSeed(rootSeed, round, advertiserId));
}

/**
 * One standard normal draw, via Box-Muller.
 *
 * Needed for the variance-scaled noise in spec 11.5 and section 14: sampled
 * mode perturbs an aggregate outcome by an amount whose spread depends on the
 * underlying count, so a 50-search query stays violently noisy while a
 * 5,000-search one does not.
 *
 * Consumes two draws from the supplied generator. The lower bound on u guards
 * against log(0) returning -Infinity.
 *
 * @param {() => number} rng
 * @returns {number} a draw from N(0, 1)
 */
export function normal(rng) {
  const u = Math.max(rng(), Number.EPSILON);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
