import { promises as fs } from 'node:fs';
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

  // The conversion must bake EXIF orientation into the pixels, or portrait
  // photos lose their rotation all over again.
  const processor = await readText('scripts/process-gallery-images.mjs');
  assert(
    processor.includes('.autoOrient()'),
    'process-gallery-images should autoOrient() before writing WebP.'
  );
  assert(
    processor.includes('metadata.autoOrient ?? metadata'),
    'process-gallery-images should record auto-oriented dimensions.'
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
