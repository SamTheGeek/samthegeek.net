import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { importScript } from '../helpers.mjs';

const shortener = await importScript('scripts/shorten-image-names.mjs');

describe('shortNameFor', () => {
  // The last 8 characters of the canonical UUID, not of the whole filename
  // (which would just give you "_photo").
  const cases = [
    ['50A3ED07-A33B-45AB-A859-AB71E66E94E8-3843-000005218633E382_photo', 'E66E94E8'],
    ['2FC47DE0-C183-434E-949E-BE6CA12C3E2B', 'A12C3E2B'],
    ['DSCF1234', null],
    ['IMG_2664', null],
    ['not-a-uuid-at-all', null],
  ];
  for (const [stem, expected] of cases) {
    test(`${stem} -> ${expected}`, () => {
      assert.equal(shortener.shortNameFor(stem), expected);
    });
  }
});
