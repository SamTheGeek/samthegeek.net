import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];

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
        const relPath = src.replace(/^\/+/, '');
        const fullPath = path.join(root, 'public', relPath);
        try {
          await fs.access(fullPath);
        } catch {
          errors.push(`Missing image file for ${filename}: ${src}`);
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

const run = async () => {
  await testIndexRedirect();
  await testLightboxMapsKey();
  await testEnvExample();
  await testLayoutFooterCentering();
  await testAboutCentering();
  await testGalleryMetadata();
  await testBlogIdsUnique();
  await testPerformanceHints();

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
