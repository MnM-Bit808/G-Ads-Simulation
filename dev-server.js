/**
 * A static file server, so `ui/` can import the real engine.
 *
 * `npm run dev`, then open http://localhost:5173.
 *
 * WHY THIS EXISTS AT ALL
 *
 * The interface is native ES modules with no bundler and no framework, and it
 * imports `../engine/round.js` directly rather than a copy. Browsers refuse to
 * load ES modules over `file://` on CORS grounds, so something has to serve the
 * directory. Forty lines of `node:http` costs less than a dependency, and this
 * project has exactly one runtime dependency so far.
 *
 * CLAUDE.md has listed `npm run dev` in its workflow since step 1. This is the
 * first commit where it does anything.
 *
 * It serves the repository root rather than `ui/`, because the whole point is
 * that the interface reaches back into `engine/`, `content/`, `agents/` and
 * `setup.js`. Development only: no caching, no compression, no range requests.
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT ?? 5173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    // Redirect rather than serve ui/index.html at the root. Serving it here
    // would leave the document's base URL at "/", so its own "./style.css"
    // would resolve to "/style.css" and 404 — and every relative import in the
    // module graph would be off by a directory in the same way.
    if (url.pathname === '/') {
      response.writeHead(302, { Location: '/ui/' }).end();
      return;
    }
    const requested = decodeURIComponent(url.pathname);

    // Nothing outside the repository, however the path is spelled.
    const resolved = join(ROOT, normalize(requested).replace(/^(\.\.[/\\])+/, ''));
    if (!resolved.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) {
      response.writeHead(403).end('outside the project');
      return;
    }

    const info = await stat(resolved);
    const file = info.isDirectory() ? join(resolved, 'index.html') : resolved;
    const body = await readFile(file);

    response.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      // The engine changes constantly while this is running. A cached module
      // graph is the single most confusing thing a dev server can do.
      'Cache-Control': 'no-store',
    });
    response.end(body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
  }
});

server.listen(PORT, () => {
  process.stdout.write(`\n  the simulator is at http://localhost:${PORT}\n\n`);
});
