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
  },
});
