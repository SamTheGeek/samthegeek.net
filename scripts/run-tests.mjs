import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();

// In CI, check image file existence via the GitHub API rather than the
// filesystem (images are not checked out in the sparse clone).
let _remoteImagePaths = null;
const getRemoteImagePaths = async () => {
  if (_remoteImagePaths !== null) return _remoteImagePaths;

  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const sha = process.env.GITHUB_SHA;
  if (!token || !repository || !sha) return null;

  const [owner, repo] = repository.split('/');
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`,
    { headers },
  );
  const treeData = await treeRes.json();

  _remoteImagePaths = new Set(
    (treeData.tree ?? [])
      .filter((item) => item.path.startsWith('public/images/'))
      .map((item) => item.path),
  );
  return _remoteImagePaths;
};

const errors = [];

const fileExists = async (targetPath) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const candidateImagePaths = (imageSrc, webpSrc) => {
  const candidates = new Set();

  if (typeof imageSrc === 'string' && imageSrc.startsWith('/images/')) {
    candidates.add(imageSrc.replace(/^\/+/, ''));
    const webpVariant = imageSrc.replace(/\.[^.\/]+$/, '.webp');
    if (webpVariant.startsWith('/images/')) {
      candidates.add(webpVariant.replace(/^\/+/, ''));
    }
  }

  if (typeof webpSrc === 'string' && webpSrc.startsWith('/images/')) {
    candidates.add(webpSrc.replace(/^\/+/, ''));
  }

  return [...candidates];
};


const readText = async (relativePath) => {
  const fullPath = path.join(root, relativePath);
  return fs.readFile(fullPath, 'utf8');
};

const assert = (condition, message) => {
  if (!condition) {
    errors.push(message);
  }
};

const testIndexRedirect = async () => {
  const content = await readText('src/pages/index.astro');
  assert(
    content.includes('<meta http-equiv="refresh"'),
    'index.astro should use a meta refresh redirect.'
  );
  assert(
    !content.includes('window.location'),
    'index.astro should not include a JS-based redirect.'
  );
  assert(
    !content.includes('BaseLayout'),
    'index.astro should not render the main layout.'
  );
};

const testLightboxMapsKey = async () => {
  const content = await readText('src/components/Lightbox.astro');
  assert(
    content.includes('PUBLIC_GOOGLE_MAPS_EMBED_API_KEY'),
    'Lightbox should reference PUBLIC_GOOGLE_MAPS_EMBED_API_KEY.'
  );
  assert(
    content.includes('PUBLIC_GOOGLE_MAPS_STATIC_API_KEY || mapsKey'),
    'Lightbox should fall back to the embed key for static maps.'
  );
};

const testEnvExample = async () => {
  const content = await readText('.env.example');
  assert(
    content.includes('PUBLIC_GOOGLE_MAPS_EMBED_API_KEY='),
    '.env.example should include PUBLIC_GOOGLE_MAPS_EMBED_API_KEY.'
  );
};

const testLayoutFooterCentering = async () => {
  const content = await readText('src/layouts/BaseLayout.astro');
  assert(
    content.includes('.sidebar-footer') && content.includes('text-align: center;'),
    'BaseLayout should center the footer when the sidebar collapses.'
  );
  assert(
    content.includes('.social-links') && content.includes('justify-content: center;'),
    'BaseLayout should center the social links in the collapsed layout.'
  );
};

const testAboutCentering = async () => {
  const content = await readText('src/pages/about.astro');
  assert(
    content.includes('.about-page') && content.includes('align-items: center;'),
    'About page should center its content when the sidebar is collapsed.'
  );
  assert(
    content.includes('.about-footer') && content.includes('justify-content: center;'),
    'About page footer should be centered in the header/footer layout.'
  );
  assert(
    content.includes('alt="Portrait of Sam Gross"'),
    'About page portrait should include descriptive alt text.'
  );
};

const testGalleryMetadata = async () => {
  const galleriesDir = path.join(root, 'src/content/galleries');
  const entries = await fs.readdir(galleriesDir);
  const galleryFiles = entries.filter((name) => name.endsWith('.json'));
  assert(galleryFiles.length > 0, 'Expected at least one gallery JSON file.');

  for (const filename of galleryFiles) {
    const filePath = path.join(galleriesDir, filename);
    const raw = await fs.readFile(filePath, 'utf8');
    let data;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      errors.push(`Invalid JSON in ${path.join('src/content/galleries', filename)}.`);
      continue;
    }
    const images = Array.isArray(data.images) ? data.images : [];
    assert(images.length > 0, `${filename} should include at least one image.`);

    for (const image of images) {
      const src = typeof image.src === 'string' ? image.src : '';
      const alt = typeof image.alt === 'string' ? image.alt.trim() : '';
      assert(
        src.startsWith('/images/'),
        `${filename} image src should start with /images/.`
      );
      assert(alt.length > 0, `${filename} image alt text should be present.`);
      if (src.startsWith('/images/')) {
        const relPaths = candidateImagePaths(src, image.webpSrc);
        const remoteImagePaths = await getRemoteImagePaths();

        if (remoteImagePaths !== null) {
          const hasMatch = relPaths.some((relPath) => remoteImagePaths.has(`public/${relPath}`));
          if (!hasMatch) {
            errors.push(`Missing image file for ${filename}: ${src}`);
          }
        } else {
          let hasMatch = false;
          for (const relPath of relPaths) {
            const fullPath = path.join(root, 'public', relPath);
            if (await fileExists(fullPath)) {
              hasMatch = true;
              break;
            }
          }
          if (!hasMatch) {
            errors.push(`Missing image file for ${filename}: ${src}`);
          }
        }
      }
      if (image.exif) {
        const lat = image.exif.latitude;
        const lng = image.exif.longitude;
        if (typeof lat === 'number' && typeof lng === 'number') {
          assert(Math.abs(lat) <= 90, `${filename} EXIF latitude out of range.`);
          assert(Math.abs(lng) <= 180, `${filename} EXIF longitude out of range.`);
        }
      }
    }
  }
};

const testBlogIdsUnique = async () => {
  const blogDir = path.join(root, 'src', 'content', 'blog');
  const entries = await fs.readdir(blogDir, { recursive: true });
  const files = entries
    .filter((name) => typeof name === 'string' && name.endsWith('.md'))
    .map((name) => path.join(blogDir, name));

  const urlIdMap = new Map();
  const guidMap = new Map();
  const slugMap = new Map();

  for (const filePath of files) {
    const raw = await fs.readFile(filePath, 'utf8');
    const relative = path.relative(blogDir, filePath).replace(/\\/g, '/');
    const slug = relative.replace(/\\.md$/, '');

    if (slugMap.has(slug)) {
      errors.push(`Duplicate blog slug: ${slug}`);
    } else {
      slugMap.set(slug, filePath);
    }

    const urlIdMatch = raw.match(/^urlId:\\s*\"([^\"]+)\"/m);
    if (urlIdMatch) {
      const urlId = urlIdMatch[1];
      if (urlIdMap.has(urlId)) {
        errors.push(`Duplicate blog urlId: ${urlId}`);
      } else {
        urlIdMap.set(urlId, filePath);
      }
    }

    const guidMatch = raw.match(/^guid:\\s*\"([^\"]+)\"/m);
    if (guidMatch) {
      const guid = guidMatch[1];
      if (guidMap.has(guid)) {
        errors.push(`Duplicate blog guid: ${guid}`);
      } else {
        guidMap.set(guid, filePath);
      }
    }
  }
};

const testPerformanceHints = async () => {
  const gallery = await readText('src/components/Gallery.astro');
  // Check for lazy loading - either literal or conditional expression
  const hasLazyLoading =
    gallery.includes('loading="lazy"') ||
    gallery.includes("loading='lazy'") ||
    gallery.includes('loading={') && gallery.includes('"lazy"');
  assert(
    hasLazyLoading,
    'Gallery images should opt into lazy loading (literal or conditional).'
  );
  // Check for performance optimizations
  assert(
    gallery.includes('width=') && gallery.includes('height='),
    'Gallery images should include width and height attributes for CLS.'
  );
};


const testImageRotationWorkflow = async () => {
  const script = 'scripts/rotate-gallery-images.mjs';
  assert(
    await fileExists(path.join(root, script)),
    `${script} should exist for fixing images that lost their EXIF orientation.`
  );

  const workflow = await readText('.github/workflows/rotate-images.yml');
  assert(
    workflow.includes(script),
    'rotate-images workflow should run the rotation script.'
  );
  for (const rotation of ['cw', 'ccw', "'180'"]) {
    assert(
      workflow.includes(`- ${rotation}`),
      `rotate-images workflow should offer the ${rotation} rotation.`
    );
  }
  assert(
    workflow.includes('--images-file'),
    'rotate-images workflow should pass the intake list as a file, not as a shell argument.'
  );

  // The conversion itself must bake the rotation in, or portrait photos lose
  // it all over again; that is exercised for real in
  // testWebpConversionBakesRotation below.
  const processor = await readText('scripts/process-gallery-images.mjs');
  assert(
    processor.includes('.autoOrient()'),
    'process-gallery-images should autoOrient() before writing WebP.'
  );

  const rotator = await import(pathToFileURL(path.join(root, script)).href);

  const rotationCases = [
    ['cw', 'cw'], ['CW', 'cw'], ['90', 'cw'], ['right', 'cw'],
    ['ccw', 'ccw'], ['-90', 'ccw'], ['left', 'ccw'],
    ['180', '180'], ['upside-down', '180'], ['flip', '180'],
    ['sideways', null], ['', null],
  ];
  for (const [input, expected] of rotationCases) {
    assert(
      rotator.parseRotation(input) === expected,
      `parseRotation(${JSON.stringify(input)}) should be ${expected}.`
    );
  }

  assert(rotator.rotationDegrees('cw') === 90, 'cw should be 90 degrees clockwise.');
  assert(rotator.rotationDegrees('ccw') === 270, 'ccw should be 270 degrees clockwise.');
  assert(rotator.rotationDegrees('180') === 180, '180 should be 180 degrees.');

  const referenceCases = [
    ['https://samthegeek.net/images/japan/DSCF1234.webp', 'images/japan/DSCF1234.webp'],
    ['/images/japan/DSCF1234.webp?v=2#top', 'images/japan/DSCF1234.webp'],
    ['public/images/japan/DSCF1234.webp', 'public/images/japan/DSCF1234.webp'],
    ['https://x.netlify.app/_image?href=%2Fimages%2Fjapan%2FDSCF1234.webp&w=800', 'images/japan/DSCF1234.webp'],
    // The lightbox deep-link, which is what copying the address bar gives you.
    ['https://samthegeek.net/japan/?photo=DSCF1234.webp', 'japan/DSCF1234.webp'],
    ['https://samthegeek.net/los-angeles/?photo=A1B2C3D4.webp', 'los-angeles/A1B2C3D4.webp'],
  ];
  for (const [input, expected] of referenceCases) {
    assert(
      rotator.normalizeImageReference(input) === expected,
      `normalizeImageReference(${JSON.stringify(input)}) should be ${expected}.`
    );
  }

  // Per-entry rotations override the run-wide default; comments are ignored.
  const entries = rotator.parseEntries(
    '/images/a.webp cw\n# skip me\n/images/b.webp | ccw, /images/c.webp => 180\n/images/d.webp',
    'cw'
  );
  assert(entries.length === 4, 'parseEntries should read four entries.');
  assert(
    entries.map((entry) => entry.rotation).join(',') === 'cw,ccw,180,cw',
    'parseEntries should honour per-entry rotations and fall back to the default.'
  );
  assert(
    entries[1].reference === '/images/b.webp',
    'parseEntries should strip the rotation from the reference.'
  );
};

/**
 * The conversion has to produce an upright file from a camera's portrait
 * frame - landscape pixels plus an EXIF Orientation tag - because the tag does
 * not survive the conversion and cannot be recovered afterwards. This is the
 * bug PR #148 had to clean up by hand, so it is checked against real pixels
 * rather than against the source of the script.
 */
const testWebpConversionBakesRotation = async () => {
  const converter = await import(
    pathToFileURL(path.join(root, 'scripts/process-gallery-images.mjs')).href
  );
  // The same guard the script applies to its own sharp: without it libvips
  // hands back a cached copy of a file that was rewritten in place, and the
  // checks below would read the image as it was before the rotation.
  const sharp = converter.configureSharp((await import('sharp')).default);

  // Is the marker in the top-right corner, i.e. did the pixels really turn?
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

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'webp-rotation-'));
  // The converter narrates what it does; the suite does not need to.
  const log = console.log;
  console.log = () => {};
  try {
    // A camera-style portrait: a 60x40 landscape frame with a red marker in
    // the stored top-left, tagged "rotate 90 clockwise to display". Shown
    // upright it is 40x60 with the marker in the top-right.
    const marker = await sharp({
      create: { width: 12, height: 12, channels: 3, background: '#ff0000' },
    }).png().toBuffer();
    const source = path.join(dir, 'portrait.jpg');
    await sharp({ create: { width: 60, height: 40, channels: 3, background: '#ffffff' } })
      .composite([{ input: marker, top: 0, left: 0 }])
      .jpeg({ quality: 100 })
      .withMetadata({ orientation: 6 })
      .toFile(source);

    const converted = await converter.convertToWebP(sharp, source, 100, false);
    const webpPath = path.join(dir, 'portrait.webp');
    assert(converted.converted, 'convertToWebP should convert a JPEG source.');

    const meta = await sharp(webpPath).metadata();
    assert(
      meta.width === 40 && meta.height === 60,
      `Converted WebP should be upright 40x60, got ${meta.width}x${meta.height}.`
    );
    assert(
      await markerTopRight(webpPath),
      'Converted WebP should have the rotation baked into its pixels.'
    );
    assert(
      meta.orientation === 1,
      'Converted WebP should state Orientation = 1 outright, so that a downloaded ' +
      'copy cannot be re-rotated by a viewer.'
    );
    assert(
      converted.width === 40 && converted.height === 60,
      'convertToWebP should report the displayed size, for the gallery JSON.'
    );
    assert(
      (await fs.readdir(dir)).every((file) => !file.includes('convert-tmp')),
      'convertToWebP should not leave its temporary file behind.'
    );

    // A WebP already on disk that still carries an orientation tag gets the
    // rotation baked in too, instead of being skipped as "already converted".
    const stale = path.join(dir, 'stale.webp');
    await sharp(source).webp({ quality: 100 }).withMetadata({ orientation: 6 }).toFile(stale);
    const repaired = await converter.ensureUprightWebP(sharp, stale, 100, false);
    assert(repaired.repaired, 'ensureUprightWebP should repair a WebP with Orientation != 1.');
    assert(
      repaired.width === 40 && repaired.height === 60,
      'ensureUprightWebP should report the displayed size after baking.'
    );
    const staleMeta = await sharp(stale).metadata();
    assert(
      staleMeta.width === 40 && staleMeta.height === 60 && staleMeta.orientation === 1,
      'A repaired WebP should be upright and state Orientation = 1.'
    );
    assert(
      await markerTopRight(stale),
      'A repaired WebP should have the rotation baked into its pixels.'
    );

    // Running again re-encodes nothing: the file is already upright.
    const before = await fs.readFile(stale);
    const second = await converter.ensureUprightWebP(sharp, stale, 100, false);
    assert(!second.repaired, 'ensureUprightWebP should leave an upright WebP alone.');
    assert(
      Buffer.compare(before, await fs.readFile(stale)) === 0,
      'ensureUprightWebP should not rewrite a file it does not need to change.'
    );

    // A dry run reports the same result without touching the file.
    const upright = path.join(dir, 'dry-run.webp');
    await sharp(source).webp({ quality: 100 }).withMetadata({ orientation: 6 }).toFile(upright);
    const untouched = await fs.readFile(upright);
    const predicted = await converter.ensureUprightWebP(sharp, upright, 100, true);
    assert(
      predicted.repaired && predicted.width === 40 && predicted.height === 60,
      'A dry run should still report the rotation it would bake in.'
    );
    assert(
      Buffer.compare(untouched, await fs.readFile(upright)) === 0,
      'A dry run should not write to the image.'
    );

    // The displayed size is the one the browser lays out, not the stored one.
    const stored = await sharp(source).metadata();
    const shown = converter.displayedSize(stored);
    assert(
      stored.width === 60 && stored.height === 40 && shown.width === 40 && shown.height === 60,
      'displayedSize should report the auto-oriented size of a tagged source.'
    );

    assert(
      converter.webpPathFor('/images/japan/DSCF1234.jpg') === '/images/japan/DSCF1234.webp' &&
        converter.webpPathFor('/images/japan/DSCF1234.webp') === '/images/japan/DSCF1234.webp',
      'webpPathFor should map a source path to the WebP we serve.'
    );
  } finally {
    console.log = log;
    await fs.rm(dir, { recursive: true, force: true });
  }
};

const testImageNameShortening = async () => {
  const script = 'scripts/shorten-image-names.mjs';
  assert(
    await fileExists(path.join(root, script)),
    `${script} should exist for shortening UUID filenames.`
  );

  const shortener = await import(pathToFileURL(path.join(root, script)).href);

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
    assert(
      shortener.shortNameFor(stem) === expected,
      `shortNameFor(${JSON.stringify(stem)}) should be ${expected}.`
    );
  }

  // Gallery filenames should already be short, and unique within a gallery.
  const imagesDir = path.join(root, 'public/images');
  let galleries = [];
  try {
    galleries = (await fs.readdir(imagesDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && !['about', 'blog'].includes(entry.name))
      .map((entry) => entry.name);
  } catch {
    return; // Images aren't checked out (sparse CI clone).
  }

  for (const gallery of galleries) {
    const files = await fs.readdir(path.join(imagesDir, gallery));
    const longNames = files.filter((name) => shortener.shortNameFor(shortener.stripExtension(name)));
    assert(
      longNames.length === 0,
      `${gallery} still has ${longNames.length} full-UUID filename(s); run scripts/shorten-image-names.mjs.`
    );
  }
};

const testDependencyAlignment = async () => {
  const packageJson = JSON.parse(await readText('package.json'));
  const lockfile = JSON.parse(await readText('package-lock.json'));
  const rootPackage = lockfile.packages?.[''] ?? {};

  const expectedDeps = {
    astro: packageJson.dependencies?.astro,
    '@playwright/test': packageJson.devDependencies?.['@playwright/test'],
    '@axe-core/playwright': packageJson.devDependencies?.['@axe-core/playwright'],
  };

  for (const [name, expectedVersion] of Object.entries(expectedDeps)) {
    assert(Boolean(expectedVersion), `package.json should declare ${name}.`);

    const lockVersion = rootPackage.dependencies?.[name] ?? rootPackage.devDependencies?.[name];
    assert(
      lockVersion === expectedVersion,
      `package-lock.json should pin ${name} to ${expectedVersion} (found ${lockVersion ?? 'missing'}).`
    );
  }
};

const run = async () => {
  await testIndexRedirect();
  await testLightboxMapsKey();
  await testEnvExample();
  await testLayoutFooterCentering();
  await testAboutCentering();
  await testGalleryMetadata();
  await testBlogIdsUnique();
  await testPerformanceHints();
  await testImageRotationWorkflow();
  await testWebpConversionBakesRotation();
  await testImageNameShortening();
  await testDependencyAlignment();

  if (errors.length > 0) {
    console.error('Tests failed:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }
  console.log('All tests passed.');
};

run().catch((error) => {
  console.error('Tests crashed.');
  console.error(error);
  process.exit(1);
});
