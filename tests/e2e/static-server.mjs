// Serves dist/ for Playwright with the same clean-URL lookups as Netlify
// (see resolveDistPath), so the suite needs no extra npm package.
// Usage: node tests/e2e/static-server.mjs [port]
import { createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { distDir, listDist, resolveDistPath } from '../helpers.mjs';

const port = Number(process.argv[2] ?? 4321);
const distFiles = new Set(await listDist());

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

createServer((request, response) => {
  const { pathname } = new URL(request.url, 'http://localhost');
  const file = resolveDistPath(distFiles, pathname);
  if (!file) {
    response.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    return;
  }
  response.writeHead(200, {
    'Content-Type': contentTypes[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
  });
  createReadStream(path.join(distDir, file)).pipe(response);
}).listen(port, '127.0.0.1', () => {
  console.log(`Serving dist/ at http://127.0.0.1:${port}`);
});
