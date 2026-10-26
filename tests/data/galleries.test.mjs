// Gallery JSON checks that run before every build (and so every Netlify
// deploy). The Astro content schema already enforces field types; these cover
// what it can't: formats, references to files on disk, and cross-file rules.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { exists, importScript, loadGalleries, root } from '../helpers.mjs';

const galleries = await loadGalleries();
const { shortNameFor, stripExtension } = await importScript('scripts/shorten-image-names.mjs');

/**
 * Paths under public/ that exist, from the filesystem, or - in the sparse CI
 * checkout, which leaves the 2GB of images out - from the GitHub tree API.
 */
const imageIndex = await (async () => {
  if (await exists(path.join(root, 'public/images'))) {
    return { has: (relPath) => exists(path.join(root, 'public', relPath)) };
  }
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repository, GITHUB_SHA: sha } = process.env;
  if (!token || !repository || !sha) {
    throw new Error(
      'public/images is not checked out and GITHUB_TOKEN/GITHUB_REPOSITORY/GITHUB_SHA are not set, ' +
        'so image references cannot be checked.',
    );
  }
  const response = await fetch(
    `https://api.github.com/repos/${repository}/git/trees/${sha}?recursive=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  );
  if (!response.ok) {
    throw new Error(`GitHub tree API returned ${response.status} for ${repository}@${sha}.`);
  }
  const tree = await response.json();
  // A truncated tree would make every image past the cut-off look missing.
  if (tree.truncated) {
    throw new Error('GitHub tree API response was truncated; check out public/images instead.');
  }
  const paths = new Set(
    tree.tree.filter((item) => item.path.startsWith('public/images/')).map((item) => item.path),
  );
  return { has: async (relPath) => paths.has(`public/${relPath}`) };
})();

/** The files that can satisfy an image entry: its src, or the WebP we serve for it. */
const candidatePaths = (image) => {
  const candidates = new Set([image.src, image.src.replace(/\.[^./]+$/, '.webp')]);
  if (image.webpSrc) candidates.add(image.webpSrc);
  return [...candidates].map((src) => src.replace(/^\/+/, ''));
};

const exifFormats = {
  date: /^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/,
  focalLength: /mm$/,
  aperture: /^f\//,
  shutterSpeed: /s$/,
  iso: /^ISO /,
};

test('there is at least one gallery', () => {
  assert.ok(galleries.length > 0);
});

for (const { slug, data } of galleries) {
  describe(`gallery ${slug}`, () => {
    const images = Array.isArray(data.images) ? data.images : [];

    test('has a title, location, valid publishedDate and images', () => {
      assert.equal(typeof data.title, 'string');
      assert.ok(data.title.trim(), 'title should not be empty');
      assert.equal(typeof data.location, 'string');
      assert.ok(!Number.isNaN(new Date(data.publishedDate).valueOf()), 'publishedDate should parse');
      assert.ok(images.length > 0, 'should include at least one image');
    });

    test('has a page at src/pages/<slug>.astro', async () => {
      assert.ok(await exists(path.join(root, 'src/pages', `${slug}.astro`)), `missing page for ${slug}`);
    });

    test('every image has an /images/ src, alt text and a .webp webpSrc', () => {
      const problems = [];
      for (const image of images) {
        if (typeof image.src !== 'string' || !image.src.startsWith('/images/')) {
          problems.push(`src should start with /images/: ${image.src}`);
        }
        if (typeof image.alt !== 'string' || !image.alt.trim()) {
          problems.push(`missing alt text: ${image.src}`);
        }
        if (image.webpSrc !== undefined && !/^\/images\/.*\.webp$/.test(image.webpSrc)) {
          problems.push(`webpSrc should be an /images/ .webp path: ${image.webpSrc}`);
        }
      }
      assert.deepEqual(problems, []);
    });

    test('no image is listed twice', () => {
      const seen = new Set();
      const duplicates = images.map((image) => image.src).filter((src) => seen.size === seen.add(src).size);
      assert.deepEqual(duplicates, []);
    });

    test('EXIF fields are well-formed when present', () => {
      const problems = [];
      for (const { src, exif } of images) {
        if (!exif) continue;
        for (const [field, pattern] of Object.entries(exifFormats)) {
          if (exif[field] !== undefined && !pattern.test(exif[field])) {
            problems.push(`${src}: exif.${field} ${JSON.stringify(exif[field])} should match ${pattern}`);
          }
        }
        for (const [field, limit] of [['latitude', 90], ['longitude', 180]]) {
          const value = exif[field];
          if (value !== undefined && !(typeof value === 'number' && Math.abs(value) <= limit)) {
            problems.push(`${src}: exif.${field} ${value} is out of range`);
          }
        }
        for (const field of ['location', 'locationEn']) {
          if (exif[field] !== undefined && !(typeof exif[field] === 'string' && exif[field].trim())) {
            problems.push(`${src}: exif.${field} should be a non-empty string`);
          }
        }
      }
      assert.deepEqual(problems, []);
    });

    test('every image file exists', async () => {
      const missing = [];
      for (const image of images) {
        if (typeof image.src !== 'string') continue;
        const found = await Promise.all(candidatePaths(image).map((relPath) => imageIndex.has(relPath)));
        if (!found.includes(true)) missing.push(image.src);
      }
      assert.deepEqual(missing, [], `missing image files for ${slug}`);
    });

    test('filenames are already shortened (no full UUIDs)', () => {
      const long = images
        .flatMap((image) => [image.src, image.webpSrc])
        .filter((src) => typeof src === 'string' && shortNameFor(stripExtension(path.posix.basename(src))));
      assert.deepEqual(long, [], 'run scripts/shorten-image-names.mjs');
    });
  });
}

test('every gallery directory on disk is shortened too', async (t) => {
  const imagesDir = path.join(root, 'public/images');
  if (!(await exists(imagesDir))) return t.skip('public/images is not checked out');
  const dirs = (await fs.readdir(imagesDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !['about', 'blog'].includes(entry.name));
  const long = [];
  for (const { name } of dirs) {
    for (const file of await fs.readdir(path.join(imagesDir, name))) {
      if (shortNameFor(stripExtension(file))) long.push(`${name}/${file}`);
    }
  }
  assert.deepEqual(long, [], 'run scripts/shorten-image-names.mjs');
});
