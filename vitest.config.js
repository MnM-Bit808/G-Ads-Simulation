import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only tests/ is the suite. engine-audit.test.mjs at the repo root is a
    // v0.1 prototype artefact kept for reference — it imports an engine.mjs
    // that never existed and cannot run. Its BUG CHECK cases encode real traps
    // (below-floor rivals must stay in the ladder, maxConv must differ from
    // maxClicks, targetRoas must guard against a zero target) and are being
    // ported into tests/ as the modules they cover get built.
    include: ['tests/**/*.test.js'],

    // performance.test.js is NOT here. It measures how long a round takes,
    // and vitest runs twenty-odd suites at once - the same round reported
    // 496ms and 1991ms twenty seconds apart, and switching to CPU time only
    // moved the problem, because garbage collection under that much memory
    // pressure is real CPU this process really spent.
    //
    // A timing assertion that fires on machine weather is worse than none: it
    // trains you to rerun until it passes. It lives in its own config and runs
    // alone, via `npm run test:perf`.
    exclude: ['tests/performance.test.js', '**/node_modules/**'],
  },
});
