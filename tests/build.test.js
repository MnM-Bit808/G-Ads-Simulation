/**
 * The site Cloudflare publishes is exactly what the game loads, and no more.
 *
 * `scripts/build-site.js` copies files into `dist/` by following the imports
 * from `ui/app.js`. Two ways that goes wrong, and neither announces itself:
 *
 *   TOO LITTLE. A module the game needs is left out. The site deploys, the
 *   page is blank, and the only error is in a stranger's browser console.
 *
 *   TOO MUCH. The docs, the tests, the design canvas or `files.zip` go out
 *   with it. The repository is private; the site is the one part of it meant
 *   to be seen.
 *
 * THE COMPLETENESS CHECK DOES NOT TRUST THE WALKER. Asking the build's own
 * import-reader whether its output is complete would pass whenever the reader
 * and the check share a blind spot. So the built copy is imported by NODE, whose
 * resolver is the real one: if a file is missing from `dist/`, the import throws.
 * Every module except `ui/app.js` — the one that reaches for `document` the
 * moment it loads — goes through that door.
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, posix } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { siteFiles, buildSite } from '../scripts/build-site.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
// ui/ alone may hold one level of folders: ui/words/ carries the screens'
// sentences (stage C1) and is loaded by the game like any other module.
// ui/fonts/ holds the Studio look's two typefaces and their licences, which
// ship together (plans/2026-09-13-studio-makeover.md, section 3).
const RUNTIME = /^(ui|engine|content|agents)\/[^/]+\.(js|html|css)$|^ui\/[a-z]+\/[^/]+\.js$|^ui\/fonts\/[^/]+\.(woff2|txt)$|^(setup|game)\.js$/;

describe('the site holds what the game loads', () => {
  const files = siteFiles(ROOT);

  test('the page, its stylesheet, and both ends of the engine', () => {
    for (const f of [
      'ui/index.html', 'ui/style.css', 'ui/app.js', 'engine/round.js',
      'engine/constants.js', 'content/querySet.js', 'setup.js', 'game.js',
      'ui/studio.css', 'ui/fonts/bricolage-grotesque-latin.woff2',
      'ui/fonts/instrument-sans-latin-ext.woff2', 'ui/fonts/OFL-bricolage-grotesque.txt',
    ]) {
      expect(files, f).toContain(f);
    }
  });

  test('and nothing that is not part of the running game', () => {
    for (const f of files) expect(f, f).toMatch(RUNTIME);
    // Named, because each is a real file in this repository that a looser
    // build — "publish the repo root" — would have sent out.
    for (const f of [
      'DECISIONS.md', 'HANDOVER.md', 'CLAUDE.md', 'files.zip', 'package.json',
      'dev-server.js', 'agents/claude.js', 'tests/build.test.js', 'design/README.md',
    ]) {
      expect(files, f).not.toContain(f);
    }
  });

  test('agents/claude.js stays out, because a browser cannot load it', () => {
    // It imports '@anthropic-ai/sdk' by bare name, which only Node can resolve.
    // The game never imports it — the grader and tagger take their transport as
    // an argument — and if something ever does, the build must refuse rather
    // than publish a page that dies on load.
    expect(files).not.toContain('agents/claude.js');
  });
});

describe('Cloudflare publishes dist/ because the repository says so', () => {
  // Without wrangler.jsonc, Cloudflare's deploy tool GUESSED the folder on every
  // build — "Detected Project Settings: Framework: Static, Output Directory:
  // dist" in the first build log. Right, and one detection change away from
  // publishing the repository root with the docs and tests in it, while still
  // reporting success. The build test above checks what goes INTO dist/; this
  // checks that dist/ is what goes out.
  //
  // Full-line comments only, so stripping them leaves plain JSON.
  const config = JSON.parse(
    readFileSync(join(ROOT, 'wrangler.jsonc'), 'utf8').replace(/^\s*\/\/.*$/gm, ''),
  );

  test('the published folder is dist/, where the build writes', () => {
    expect(posix.normalize(config.assets?.directory ?? '')).toBe('dist');
  });

  test('it names the project connected in the dashboard', () => {
    expect(config.name).toBe('g-ads-simulation');
  });

  test('and runs no code on the server — the site is files, nothing more', () => {
    // A `main` script would make this a backend. The backend has its own plan
    // (HANDOVER, Still open) and must not arrive as a line in a config file.
    expect(config.main).toBeUndefined();
  });
});

describe('the build refuses what a browser could not run', () => {
  let scratch;
  beforeAll(() => { scratch = mkdtempSync(join(tmpdir(), 'site-refuse-')); });
  afterAll(() => rmSync(scratch, { recursive: true, force: true }));

  const fakeRoot = (name, appSource) => {
    const root = join(scratch, name);
    mkdirSync(join(root, 'ui'), { recursive: true });
    writeFileSync(join(root, 'ui/index.html'), '<script type="module" src="./app.js"></script>');
    writeFileSync(join(root, 'ui/app.js'), appSource);
    return root;
  };

  test('a bare package name', () => {
    const root = fakeRoot('bare', "import Anthropic from '@anthropic-ai/sdk';\n");
    expect(() => siteFiles(root)).toThrow(/@anthropic-ai\/sdk/);
  });

  test('an import of a file that does not exist', () => {
    const root = fakeRoot('missing', "import { x } from '../engine/gone.js';\n");
    expect(() => siteFiles(root)).toThrow(/gone\.js/);
  });

  test('a dynamic import, which the walker cannot follow', () => {
    const root = fakeRoot('dynamic', "const m = await import('./later.js');\n");
    expect(() => siteFiles(root)).toThrow(/dynamic/i);
  });

  test('it follows the fonts a stylesheet names, and nothing inline or remote', () => {
    const root = fakeRoot('fonts', '');
    writeFileSync(join(root, 'ui/index.html'),
      '<link rel="stylesheet" href="./look.css"><script type="module" src="./app.js"></script>');
    writeFileSync(join(root, 'ui/look.css'),
      "@font-face { src: url('./fonts/a.woff2') format('woff2'); }\n"
      + '.x { background: url(data:image/png;base64,AAAA); }\n'
      + ".y { background: url('https://example.com/b.png'); }\n");
    mkdirSync(join(root, 'ui/fonts'), { recursive: true });
    writeFileSync(join(root, 'ui/fonts/a.woff2'), 'x');
    const files = siteFiles(root);
    expect(files).toEqual(expect.arrayContaining(['ui/look.css', 'ui/fonts/a.woff2']));
    expect(files.some((f) => f.includes('example.com') || f.includes('data:'))).toBe(false);
  });

  test('and refuses a stylesheet naming a font that is not there', () => {
    const root = fakeRoot('font-missing', '');
    writeFileSync(join(root, 'ui/index.html'), '<link rel="stylesheet" href="./look.css">');
    writeFileSync(join(root, 'ui/look.css'), "@font-face { src: url('./fonts/gone.woff2'); }\n");
    expect(() => siteFiles(root)).toThrow(/gone\.woff2/);
  });

  test('and it reads an import written across several lines', () => {
    // The usual shape in this codebase — `import {\n  a, b,\n} from '...'` — and
    // the one a line-by-line reader would miss.
    const root = fakeRoot('multiline', "import {\n  a,\n  b,\n} from './dep.js';\n");
    writeFileSync(join(root, 'ui/dep.js'), 'export const a = 1; export const b = 2;\n');
    expect(siteFiles(root)).toContain('ui/dep.js');
  });
});

describe('the built copy runs', () => {
  let out;
  let built;
  beforeAll(() => {
    out = mkdtempSync(join(tmpdir(), 'site-'));
    built = buildSite(ROOT, out);
  });
  afterAll(() => rmSync(out, { recursive: true, force: true }));

  test('every file it lists is in the output', () => {
    for (const f of built) expect(existsSync(join(out, f)), f).toBe(true);
  });

  // Its own allowance, not vitest's 5s default: this asks whether every module
  // loads, never how fast. Alone it takes about 3.7s at 106 files, and inside the
  // full parallel run it crossed 5s (5,020ms on 2026-09-15) and failed with
  // nothing wrong, which is the machine-weather failure vitest.config.js keeps
  // timing out of this suite. Each section the build publishes adds a module.
  test('node can load every module in it except the page itself', async () => {
    // The real resolver, not the build's: a module missing from dist/ throws.
    const modules = built.filter((f) => f.endsWith('.js') && f !== 'ui/app.js');
    expect(modules.length).toBeGreaterThan(30);
    for (const f of modules) {
      await expect(import(pathToFileURL(join(out, f)).href), f).resolves.toBeTruthy();
    }
  }, 30_000);

  test('and a game starts from the copy, not from the repository', async () => {
    const { startGame } = await import(pathToFileURL(join(out, 'setup.js')).href);
    const { QUERY_SET } = await import(pathToFileURL(join(out, 'content/querySet.js')).href);
    const { BRAND_IDENTITIES } = await import(pathToFileURL(join(out, 'content/brands.js')).href);
    const own = QUERY_SET.queries.filter((q) => q.intent === 'commercial').slice(0, 3);
    const state = startGame({
      rootSeed: 1,
      playerBrandId: BRAND_IDENTITIES[0].id,
      querySet: QUERY_SET,
      player: {
        position: { price: 'mid', purpose: 'performance' },
        keywords: own.map((q) => ({ text: q.text, matchType: 'phrase', bidPaise: 2400 })),
      },
    });
    expect(state.advertisers).toHaveLength(9);
  });

  // A playtest file names the build it was recorded on (the switch-over,
  // 2026-09-16), and 'dev' in a built site would name nothing.
  test('the built copy carries the commit it was built from, not \'dev\'', () => {
    expect(readFileSync(join(out, 'ui/version.js'), 'utf8')).toMatch(/GAME_VERSION = '(?!dev')[0-9a-f]{7,}'/);
  });

  test('the address a visitor types sends them to the game', () => {
    // The dev server answers "/" with a redirect to /ui/. A static host has no
    // code to do that, so the build writes a page that does it instead — and
    // RELATIVELY, so it also works if the site is ever served from a subfolder.
    const html = readFileSync(join(out, 'index.html'), 'utf8');
    expect(html).toMatch(/url=ui\//);
    expect(html).toMatch(/href="ui\/"/);
    expect(html).not.toMatch(/url=\/ui|href="\/ui/);
  });

  test('browsers are told to check for a newer file on every load', () => {
    // No bundler, so every module is cached separately. Without this a returning
    // player's browser can pair a freshly fetched ui/decisions.js with an engine
    // module it cached last week — found while verifying this very build, when a
    // plain static server let the browser keep a stale decisions.js through a
    // hard reload. `_headers` is Cloudflare's own file format; `no-cache` means
    // "revalidate", which costs a 304 when nothing changed.
    const headers = readFileSync(join(out, '_headers'), 'utf8');
    expect(headers).toMatch(/^\/\*$/m);
    expect(headers).toMatch(/^\s+Cache-Control: no-cache$/m);
  });

  test('building again replaces the last build rather than piling onto it', () => {
    writeFileSync(join(out, 'stale.js'), '// left over from an old build\n');
    buildSite(ROOT, out);
    expect(existsSync(join(out, 'stale.js'))).toBe(false);
  });
});
