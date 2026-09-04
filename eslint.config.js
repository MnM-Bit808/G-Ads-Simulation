import js from '@eslint/js';
import globals from 'globals';

/**
 * The linter, and why this project finally has one.
 *
 * `ui/dashboard.js` once shipped a `ReferenceError` to the browser that a
 * 917-test suite could not see, because no test reads function bodies. Since
 * then nine interface bugs have been found and `npm test` caught exactly one of
 * them — a syntax error. Two of the nine are precisely what a linter is for:
 *
 *   `brief is not defined`   a stale identifier left behind by a refactor
 *                            (no-undef)
 *   `spentByWeekOfMonth`     a function defined, never called, and the value it
 *                            should have produced rendering as an em dash
 *                            (no-unused-vars)
 *
 * Both reached a browser. Neither could be caught by a test that reads source
 * as text, which is what `tests/ui.test.js` does. So this is wired into
 * `npm test` rather than left as a separate command nobody remembers to run.
 *
 * CORRECTNESS ONLY, NO STYLE. `js.configs.recommended` is almost entirely
 * "this cannot be what you meant". Nothing here has an opinion about quotes,
 * semicolons or line length — CLAUDE.md's conventions are for a person to
 * follow, and a linter arguing about them would add noise to a project whose
 * whole discipline is that a warning means something.
 */

export default [
  { ignores: ['node_modules/**', 'engine-audit.test.mjs'] },

  js.configs.recommended,

  {
    // `const { schemaVersion, ...rest } = STATE` is destructuring in order to
    // OMIT a key, which is the idiomatic way to do it and reads better than the
    // alternative. The variable is unused on purpose.
    rules: { 'no-unused-vars': ['error', { ignoreRestSiblings: true }] },
  },

  {
    // engine/, content/, agents/, game.js, setup.js — no DOM, no Node.
    // R1 says the engine is pure; nothing here should reach for a global at
    // all, and `no-undef` with an empty global set is the strictest way to
    // say so.
    files: ['engine/**/*.js', 'content/**/*.js', 'game.js', 'setup.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      // `structuredClone` only. It is a platform builtin rather than a DOM API
      // — Node 17+ and every modern browser — and it is what the deep copies
      // R3a rests on are made of.
      globals: { structuredClone: 'readonly' },
    },
  },

  {
    // agents/ may call a model, so it gets fetch and the console.
    files: ['agents/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { fetch: 'readonly', console: 'readonly' },
    },
  },

  {
    // The view. This is the scope the linter exists for.
    files: ['ui/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: globals.browser,
    },
  },

  {
    files: ['tests/**/*.js', 'dev-server.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
  },
];
