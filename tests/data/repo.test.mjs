import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { exists, readText, root } from '../helpers.mjs';

test('package-lock.json matches the versions declared in package.json', async () => {
  const pkg = JSON.parse(await readText('package.json'));
  const lockRoot = JSON.parse(await readText('package-lock.json')).packages?.[''] ?? {};
  for (const section of ['dependencies', 'devDependencies']) {
    assert.deepEqual(lockRoot[section] ?? {}, pkg[section] ?? {}, `package-lock.json ${section} is stale; run npm install`);
  }
});

test('.env.example documents the Google Maps embed key', async () => {
  assert.match(await readText('.env.example'), /^PUBLIC_GOOGLE_MAPS_EMBED_API_KEY=/m);
});

// The intake list is pasted by a person; passing it as a shell argument would
// let a crafted line run commands in the workflow.
test('rotate-images workflow passes the intake list as a file', async () => {
  const workflow = await readText('.github/workflows/rotate-images.yml');
  assert.match(workflow, /scripts\/rotate-gallery-images\.mjs/);
  assert.match(workflow, /--images-file/);
});

// A .gitignore pattern once swallowed tests/dist/, so CI ran that suite with
// zero files and still passed. Every suite must have committed test files.
test('every node:test suite has test files git will commit', async (t) => {
  if (!(await exists(path.join(root, '.git')))) return t.skip('not a git checkout');
  for (const suite of ['tests/unit', 'tests/data', 'tests/dist']) {
    const files = (await fs.readdir(path.join(root, suite)))
      .filter((name) => name.endsWith('.test.mjs'))
      .map((name) => `${suite}/${name}`);
    assert.ok(files.length > 0, `${suite} has no *.test.mjs files`);
    const ignored = spawnSync('git', ['check-ignore', ...files], { cwd: root, encoding: 'utf8' })
      .stdout.split('\n').filter(Boolean);
    assert.deepEqual(ignored, [], `${suite} test files are gitignored`);
  }
});
