import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readText } from '../helpers.mjs';

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
