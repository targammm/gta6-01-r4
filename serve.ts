// serve.ts — a tiny static server for local play: serves the game/
// directory on http://localhost:8080 (override with --port N), refuses
// anything outside game/, and answers with proper MIME types so ES
// modules and the import map load exactly as they will in the browser.

import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), 'game');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
};

function portFromArgs(): number {
  const args = process.argv.slice(2);
  const at = args.indexOf('--port');
  if (at >= 0 && args[at + 1]) {
    const n = parseInt(args[at + 1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 8080;
}

const server = createServer((req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path === '/') path = '/index.html';
    const file = normalize(join(root, path));
    if (!file.startsWith(root)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('forbidden');
      return;
    }
    const stat = statSync(file);
    if (!stat.isFile()) throw new Error('not a file');
    const body = readFileSync(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  }
});

const port = portFromArgs();
server.listen(port, () => {
  console.log(`SOLMAR BAY — serving game/ at http://localhost:${port}`);
});
