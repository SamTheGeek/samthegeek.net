import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { importScript } from '../helpers.mjs';

const rotator = await importScript('scripts/rotate-gallery-images.mjs');

describe('parseRotation', () => {
  const cases = [
    ['cw', 'cw'], ['CW', 'cw'], ['90', 'cw'], ['right', 'cw'],
    ['ccw', 'ccw'], ['-90', 'ccw'], ['left', 'ccw'],
    ['180', '180'], ['upside-down', '180'], ['flip', '180'],
    ['sideways', null], ['', null],
  ];
  for (const [input, expected] of cases) {
    test(`${JSON.stringify(input)} -> ${expected}`, () => {
      assert.equal(rotator.parseRotation(input), expected);
    });
  }
});

test('rotationDegrees is measured clockwise', () => {
  assert.equal(rotator.rotationDegrees('cw'), 90);
  assert.equal(rotator.rotationDegrees('ccw'), 270);
  assert.equal(rotator.rotationDegrees('180'), 180);
});

describe('normalizeImageReference', () => {
  const cases = [
    ['https://samthegeek.net/images/japan/DSCF1234.webp', 'images/japan/DSCF1234.webp'],
    ['/images/japan/DSCF1234.webp?v=2#top', 'images/japan/DSCF1234.webp'],
    ['public/images/japan/DSCF1234.webp', 'public/images/japan/DSCF1234.webp'],
    ['https://x.netlify.app/_image?href=%2Fimages%2Fjapan%2FDSCF1234.webp&w=800', 'images/japan/DSCF1234.webp'],
    // The lightbox deep-link, which is what copying the address bar gives you.
    ['https://samthegeek.net/japan/?photo=DSCF1234.webp', 'japan/DSCF1234.webp'],
    ['https://samthegeek.net/los-angeles/?photo=A1B2C3D4.webp', 'los-angeles/A1B2C3D4.webp'],
  ];
  for (const [input, expected] of cases) {
    test(input, () => {
      assert.equal(rotator.normalizeImageReference(input), expected);
    });
  }
});

test('parseEntries honours per-entry rotations, the default, and comments', () => {
  const entries = rotator.parseEntries(
    '/images/a.webp cw\n# skip me\n/images/b.webp | ccw, /images/c.webp => 180\n/images/d.webp',
    'cw',
  );
  assert.deepEqual(
    entries.map(({ reference, rotation }) => [reference, rotation]),
    [
      ['/images/a.webp', 'cw'],
      ['/images/b.webp', 'ccw'],
      ['/images/c.webp', '180'],
      ['/images/d.webp', 'cw'],
    ],
  );
});
