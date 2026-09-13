/**
 * Build the playable site into `dist/`, which is what Cloudflare publishes —
 * `wrangler.jsonc` names the folder, so the deploy never has to guess.
 *
 * `npm run build` locally; `npm run ci` is what Cloudflare runs, and it runs
 * the whole suite first so a red commit never reaches a player.
 *
 * WHY A BUILD AT ALL, IN A PROJECT WITH NO BUILD STEP
 *
 * Nothing here is compiled, bundled or minified. The site is the repository's
 * own files, served as they are — the same native ES modules `npm run dev`
 * serves. The script exists to decide WHICH files, because publishing the
 * repository root would send out everything in it: DECISIONS.md, HANDOVER.md,
 * the tests, the design canvas, files.zip. The repository is private; the site
 * is the one part of it meant to be seen.
 *
 * So it follows the imports from the page, exactly as a browser will, and
 * copies what it reaches. A new module is picked up the moment something
 * imports it, and nothing is published because it happened to be lying nearby.
 *
 * WHAT IT DOES NOT HIDE. Everything the game runs on still reaches the
 * player's browser, including the content the interface withholds on purpose
 * (16.1): query affinities, conversion multipliers. The site is behind
 * Cloudflare Access, so strangers get a sign-in page and none of it — but
 * anyone who CAN sign in can read them in the developer tools. Only a server
 * holding them back can change that, and there is no server yet.
 */

import {
  readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, existsSync,
} from 'node:fs';
import { dirname, join, resolve, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ENTRY = 'ui/index.html';

// Static imports and re-exports in any layout, including the multi-line
// `import {\n  a,\n} from '...'` this codebase mostly uses — `[^'"]` crosses
// newlines, which a line-by-line reader would not.
const STATIC_IMPORT = /(?:^|[;\s])(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|(?:^|[;\s])import\s*['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT = /\bimport\s*\(/;
const HTML_REF = /(?:src|href)="([^"]+)"/g;
// A stylesheet's own references: the Studio look's fonts. A `data:` URI is
// inline and an absolute address is somebody else's, so neither is a file to copy.
const CSS_URL = /url\(\s*['"]?([^'")]+?)['"]?\s*\)/g;
const NOT_A_FILE = /^(data:|https?:|\/\/)/;

const posix = (path) => path.split(sep).join('/');

/**
 * Every file the page loads, as repository-relative paths.
 *
 * Throws rather than skipping, on three things a browser could not run: a bare
 * package name (only Node resolves those), a dynamic import (this reader cannot
 * follow one, so it could not promise the output is complete), and a missing
 * file. Each would otherwise publish a page that fails in a stranger's browser
 * and nowhere else.
 *
 * @param {string} root the repository root
 * @returns {string[]} sorted, forward slashes
 */
export function siteFiles(root) {
  const found = new Set();

  const visit = (absolute, from) => {
    const path = posix(relative(root, absolute));
    if (found.has(path)) return;
    if (!existsSync(absolute)) {
      throw new Error(`${from} loads ${path}, which does not exist`);
    }
    found.add(path);
    if (absolute.endsWith('.css')) {
      for (const match of readFileSync(absolute, 'utf8').matchAll(CSS_URL)) {
        const target = match[1].trim();
        if (!NOT_A_FILE.test(target)) visit(resolve(dirname(absolute), target), path);
      }
      return;
    }
    if (!absolute.endsWith('.js')) return;

    const source = readFileSync(absolute, 'utf8');
    if (DYNAMIC_IMPORT.test(source)) {
      throw new Error(`${path} has a dynamic import(), which the build cannot follow`);
    }
    for (const match of source.matchAll(STATIC_IMPORT)) {
      const specifier = match[1] ?? match[2];
      if (!specifier.startsWith('.')) {
        throw new Error(`${path} imports '${specifier}' by bare name, which a browser cannot resolve`);
      }
      visit(resolve(dirname(absolute), specifier), path);
    }
  };

  const entry = join(root, ENTRY);
  visit(entry, 'the build');
  for (const match of readFileSync(entry, 'utf8').matchAll(HTML_REF)) {
    visit(resolve(dirname(entry), match[1]), ENTRY);
  }
  return [...found].sort();
}

/**
 * The page a visitor lands on at the bare address.
 *
 * `dev-server.js` answers "/" with a redirect to /ui/; a static host has no
 * code to do that, so this page does it. Relative, so it keeps working if the
 * site is ever served from a subfolder.
 */
export const ROOT_INDEX = `<!doctype html>
<meta charset="utf-8">
<title>Search auction simulator</title>
<meta http-equiv="refresh" content="0; url=ui/">
<p><a href="ui/">Open the simulator</a></p>
`;

/**
 * Response headers, in Cloudflare's `_headers` format — confirmed live: the
 * site answers every file with `Cache-Control: no-cache`, and `/_headers`
 * itself is not served.
 *
 * `no-cache` is "check before reusing", not "never store": an unchanged file
 * costs a 304. It matters because nothing here is bundled, so every module is
 * cached on its own, and a browser left to guess can pair a module fetched
 * after a deploy with one it kept from before. That was seen, not imagined:
 * verifying this build on a plain static server, the browser kept a stale
 * `ui/decisions.js` through a hard reload.
 */
export const HEADERS = `/*
  Cache-Control: no-cache
`;

/**
 * Copy the site into `outDir`, replacing whatever was there.
 *
 * @param {string} root the repository root
 * @param {string} outDir where the site goes
 * @returns {string[]} the files copied, as `siteFiles` lists them
 */
export function buildSite(root, outDir) {
  const files = siteFiles(root);
  // Emptied first: a file deleted from the repository must also disappear
  // from the site, or the build quietly keeps publishing it.
  rmSync(outDir, { recursive: true, force: true });
  for (const file of files) {
    const target = join(outDir, file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(root, file), target);
  }
  writeFileSync(join(outDir, 'index.html'), ROOT_INDEX);
  writeFileSync(join(outDir, '_headers'), HEADERS);
  return files;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const out = join(root, 'dist');
  const files = buildSite(root, out);
  const bytes = files.reduce((sum, f) => sum + readFileSync(join(root, f)).length, 0);
  process.stdout.write(`built ${files.length} files (${Math.round(bytes / 1024)} KB) into dist/\n`);
}
