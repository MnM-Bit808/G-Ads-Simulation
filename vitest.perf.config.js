import { defineConfig } from 'vitest/config';

/**
 * The performance suite, run alone.
 *
 * Spec 19's budgets are 400ms for an expected round and 1500ms for a sampled
 * round with one counterfactual. Those are budgets for the ENGINE, and the only
 * way to measure the engine is to stop twenty other suites competing with it -
 * so this config runs one file, one worker, no parallelism.
 *
 *   npm run test:perf
 */
export default defineConfig({
  test: {
    include: ['tests/performance.test.js'],
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
  },
});
