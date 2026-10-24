/**
 * The conversion has to produce an upright file from a camera's portrait
 * frame - landscape pixels plus an EXIF Orientation tag - because the tag does
 * not survive the conversion and cannot be recovered afterwards. This is the
 * bug PR #148 had to clean up by hand, so it is checked against real pixels
 * rather than against the source of the script.
 */
import { after, before, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { importScript } from '../helpers.mjs';

const converter = await importScript('scripts/process-gallery-images.mjs');
// The same guard the script applies to its own sharp: without it libvips
// hands back a cached copy of a file that was rewritten in place, and the
// checks below would read the image as it was before the rotation.
const sharp = converter.configureSharp((await import('sharp')).default);

let dir;
let source;

/** Is the marker in the top-right corner, i.e. did the pixels really turn? */
const markerTopRight = async (file) => {
  const image = sharp(file);
  const { width } = await image.metadata();
  const raw = await image.raw().toBuffer();
  const isRed = (x, y) => {
    const i = (y * width + x) * 3;
    return raw[i] > 200 && raw[i + 1] < 100 && raw[i + 2] < 100;
  };
  return isRed(width - 3, 2) && !isRed(2, 2);
};

/** A WebP that still carries the source's "rotate 90 clockwise" tag. */
const staleWebP = async (name) => {
  const file = path.join(dir, name);
  await sharp(source).webp({ quality: 100 }).withMetadata({ orientation: 6 }).toFile(file);
  return file;
};

before(async () => {
  // The converter narrates what it does; the suite does not need to.
  mock.method(console, 'log', () => {});
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'webp-rotation-'));

  // A camera-style portrait: a 60x40 landscape frame with a red marker in
  // the stored top-left, tagged "rotate 90 clockwise to display". Shown
  // upright it is 40x60 with the marker in the top-right.
  const marker = await sharp({
    create: { width: 12, height: 12, channels: 3, background: '#ff0000' },
  }).png().toBuffer();
  source = path.join(dir, 'portrait.jpg');
  await sharp({ create: { width: 60, height: 40, channels: 3, background: '#ffffff' } })
    .composite([{ input: marker, top: 0, left: 0 }])
    .jpeg({ quality: 100 })
    .withMetadata({ orientation: 6 })
    .toFile(source);
});

after(async () => {
  mock.restoreAll();
  await fs.rm(dir, { recursive: true, force: true });
});

describe('convertToWebP', () => {
  test('bakes the EXIF rotation into the pixels and reports the displayed size', async () => {
    const converted = await converter.convertToWebP(sharp, source, 100, false);
    assert.equal(converted.converted, true);
    assert.deepEqual([converted.width, converted.height], [40, 60]);

    const webpPath = path.join(dir, 'portrait.webp');
    const meta = await sharp(webpPath).metadata();
    assert.deepEqual([meta.width, meta.height], [40, 60]);
    assert.ok(await markerTopRight(webpPath), 'rotation should be in the pixels');
    // Stated outright, so that a downloaded copy cannot be re-rotated by a viewer.
    assert.equal(meta.orientation, 1);
    assert.ok(
      (await fs.readdir(dir)).every((file) => !file.includes('convert-tmp')),
      'should not leave its temporary file behind',
    );
  });
});

describe('ensureUprightWebP', () => {
  test('repairs a WebP that still carries an orientation tag', async () => {
    const stale = await staleWebP('stale.webp');
    const repaired = await converter.ensureUprightWebP(sharp, stale, 100, false);
    assert.equal(repaired.repaired, true);
    assert.deepEqual([repaired.width, repaired.height], [40, 60]);

    const meta = await sharp(stale).metadata();
    assert.deepEqual([meta.width, meta.height, meta.orientation], [40, 60, 1]);
    assert.ok(await markerTopRight(stale), 'rotation should be in the pixels');
  });

  test('leaves an upright WebP byte-for-byte alone', async () => {
    const file = await staleWebP('idempotent.webp');
    await converter.ensureUprightWebP(sharp, file, 100, false);
    const before = await fs.readFile(file);
    const second = await converter.ensureUprightWebP(sharp, file, 100, false);
    assert.equal(second.repaired, false);
    assert.equal(Buffer.compare(before, await fs.readFile(file)), 0);
  });

  test('a dry run reports the rotation without writing', async () => {
    const file = await staleWebP('dry-run.webp');
    const untouched = await fs.readFile(file);
    const predicted = await converter.ensureUprightWebP(sharp, file, 100, true);
    assert.deepEqual(
      [predicted.repaired, predicted.width, predicted.height],
      [true, 40, 60],
    );
    assert.equal(Buffer.compare(untouched, await fs.readFile(file)), 0);
  });
});

test('displayedSize reports the auto-oriented size of a tagged source', async () => {
  const stored = await sharp(source).metadata();
  assert.deepEqual([stored.width, stored.height], [60, 40]);
  assert.deepEqual(converter.displayedSize(stored), { width: 40, height: 60 });
});

test('webpPathFor maps a source path to the WebP we serve', () => {
  assert.equal(converter.webpPathFor('/images/japan/DSCF1234.jpg'), '/images/japan/DSCF1234.webp');
  assert.equal(converter.webpPathFor('/images/japan/DSCF1234.webp'), '/images/japan/DSCF1234.webp');
});
