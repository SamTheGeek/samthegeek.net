// netlify.toml ends with a `/* -> /index.html` catch-all, so a redirect whose
// target is not built never 404s: it silently bounces to the homepage. These
// checks are the only place a broken target shows up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distDir, exists, listDist, readDist, resolveDistPath } from '../helpers.mjs';

if (!(await exists(distDir))) {
  throw new Error('dist/ not found; run `npm run build` first.');
}

const distFiles = new Set(await listDist());
const rules = (await readDist('_redirects'))
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => {
    const [from, to, status] = line.split(/\s+/);
    return { line, from, to, status };
  });

test('_redirects has rules', () => {
  assert.ok(rules.length > 0);
});

test('every rule is `from to status` with a 301 or 302', () => {
  const malformed = rules.filter(({ from, to, status }) => !from?.startsWith('/') || !to || !/^30[12]$/.test(status));
  assert.deepEqual(malformed.map(({ line }) => line), []);
});

test('no source is listed twice', () => {
  const seen = new Set();
  const duplicates = rules.map(({ from }) => from).filter((from) => seen.size === seen.add(from).size);
  assert.deepEqual(duplicates, []);
});

test('every internal target resolves to a built page', () => {
  const broken = rules.filter(({ to }) => to.startsWith('/') && !resolveDistPath(distFiles, to));
  assert.deepEqual(broken.map(({ line }) => line), []);
});

test('no redirect points at another redirect', () => {
  const sources = new Set(rules.map(({ from }) => from.replace(/\/$/, '')));
  const chained = rules.filter(({ to }) => sources.has(to.replace(/\/$/, '')));
  assert.deepEqual(chained.map(({ line }) => line), []);
});

// Netlify serves an existing file before applying a non-forced redirect, so a
// rule whose source is a real page never fires.
test('no source shadows a built page', () => {
  const shadowed = rules.filter(({ from }) => resolveDistPath(distFiles, from));
  assert.deepEqual(shadowed.map(({ line }) => line), []);
});
