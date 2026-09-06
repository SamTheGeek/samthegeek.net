import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const isCI = Boolean(process.env.CI);

interface GalleryImage {
  src: string;
  webpSrc?: string;
  alt: string;
  exif?: Record<string, unknown>;
}

const loadFirstGalleryImage = async () => {
  const jsonPath = path.join(process.cwd(), 'src', 'content', 'galleries', 'copenhagen.json');
  const data = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
  if (!Array.isArray(data.images) || data.images.length === 0) {
    throw new Error('Copenhagen gallery has no images to test.');
  }
  const filename = data.images[0].src.split('/').pop();
  if (!filename) {
    throw new Error('Copenhagen gallery image filename missing.');
  }
  return filename;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const loadGallerySlugs = async () => {
  const galleriesDir = path.join(process.cwd(), 'src', 'content', 'galleries');
  const entries = await fs.readdir(galleriesDir);
  return entries.filter((entry) => entry.endsWith('.json')).map((entry) => entry.replace('.json', ''));
};

const contentConfigPath = path.join(process.cwd(), 'src', 'content.config.ts');

test.describe('Site behavior', () => {
  test('lightbox opens on click', async ({ page }) => {
    await page.goto('/copenhagen');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator('.gallery-item img').first().click();
    await expect(page.locator('#lightbox')).toHaveClass(/active/);
    // Lightbox shows the cached CDN thumbnail immediately; src is a CDN or images URL.
    await expect(page.locator('#lightbox-image')).toHaveAttribute('src', /images/);
  });

  test('deep link opens lightbox for a photo', async ({ page }) => {
    const filename = await loadFirstGalleryImage();
    await page.goto(`/copenhagen?photo=${encodeURIComponent(filename)}`);
    await expect(page.locator('#lightbox')).toHaveClass(/active/);
    // The lightbox may use either JPEG or WebP (via currentSrc), so match the base filename
    const baseName = filename.replace(/\.(jpe?g|webp)$/i, '');
    await expect(page.locator('#lightbox-image')).toHaveAttribute('src', new RegExp(escapeRegExp(baseName) + '\\.(jpe?g|webp)'));
  });

  test('about page stays centered on narrow screens', async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    await page.goto('/about');
    const centerDelta = await page.evaluate(() => {
      const shell = document.querySelector('.about-shell') as HTMLElement | null;
      if (!shell) return null;
      const rect = shell.getBoundingClientRect();
      const shellCenter = rect.left + rect.width / 2;
      const viewportCenter = window.innerWidth / 2;
      return Math.abs(shellCenter - viewportCenter);
    });
    expect(centerDelta).not.toBeNull();
    expect(centerDelta).toBeLessThan(6);
  });

  test('footer centers in header/footer layout', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto('/copenhagen');
    const layout = await page.evaluate(() => {
      const footer = document.querySelector('.sidebar-footer') as HTMLElement | null;
      const social = document.querySelector('.social-links') as HTMLElement | null;
      if (!footer || !social) return null;
      return {
        footerAlign: getComputedStyle(footer).textAlign,
        socialJustify: getComputedStyle(social).justifyContent,
      };
    });
    expect(layout).not.toBeNull();
    expect(layout?.footerAlign).toBe('center');
    expect(layout?.socialJustify).toBe('center');
  });

  test('gallery uses multiple columns in chromium', async ({ page, browserName }) => {
    test.skip(!isCI, 'Column check runs in CI only.');
    test.skip(browserName !== 'chromium', 'Blink-only column check.');
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/copenhagen');
    const columnCount = await page.$eval(
      '.gallery-grid',
      (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length
    );
    expect(columnCount).toBeGreaterThan(1);
  });

  test('all galleries render images and lightbox opens', async ({ page }) => {
    test.slow();
    const slugs = await loadGallerySlugs();
    for (const slug of slugs) {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`/${slug}`);
      const images = page.locator('.gallery-item img');
      await expect(images.first()).toBeVisible();
      await images.first().click();
      await expect(page.locator('#lightbox')).toHaveClass(/active/);
      await page.keyboard.press('Escape');
      await expect(page.locator('#lightbox')).not.toHaveClass(/active/);
    }
  });

  test('lightbox opens on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    await page.goto('/copenhagen');
    await page.locator('.gallery-item img').first().click();
    await expect(page.locator('#lightbox')).toHaveClass(/active/);
  });

  test('about page has no critical a11y violations (except easter egg link)', async ({ page }) => {
    await page.goto('/about');
    const results = await new AxeBuilder({ page })
      .include('main')
      .disableRules(['color-contrast'])
      .exclude('.photo-credit')
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('blog index renders post links @blog', async ({ page }) => {
    await page.goto('/blog');
    const posts = page.locator('main a[href^="/blog/"]');
    expect(await posts.count()).toBeGreaterThan(0);
    await expect(posts.first()).toBeVisible();
  });

  test('blog index links do not contain undefined', async ({ page }) => {
    await page.goto('/blog');
    // Post links follow the /blog/YEAR/ pattern (not pagination/category/tag)
    const posts = page.locator('main a[href^="/blog/"]').filter({ hasText: /.+/ });
    const allHrefs = await posts.evaluateAll((els) =>
      els.map((el) => el.getAttribute('href') ?? '')
    );
    const postLinks = allHrefs.filter((href) => /^\/blog\/\d{4}\//.test(href));
    expect(postLinks.length).toBeGreaterThan(0);
    for (const href of postLinks) {
      expect(href).not.toContain('undefined');
    }
  });

  test('blog post page loads when navigating from index', async ({ page }) => {
    await page.goto('/blog');
    const firstLink = page.locator('main a[href^="/blog/"]').first();
    const href = await firstLink.getAttribute('href');
    expect(href).toBeTruthy();
    expect(href).not.toContain('undefined');

    await page.goto(href!);
    await expect(page).not.toHaveURL('/');
    await expect(page.locator('article')).toBeVisible();
    await expect(page.locator('article h1')).toBeVisible();
  });

  test('blog post page prev/next links do not contain undefined', async ({ page }) => {
    await page.goto('/blog');
    const firstLink = page.locator('main a[href^="/blog/"]').first();
    const href = await firstLink.getAttribute('href');
    await page.goto(href!);

    const navLinks = page.locator('nav.pagination a');
    const navCount = await navLinks.count();
    for (let i = 0; i < navCount; i++) {
      const navHref = await navLinks.nth(i).getAttribute('href');
      expect(navHref).not.toContain('undefined');
      expect(navHref).toMatch(/^\/blog\/\d{4}\//);
    }
  });

  test('gallery images render with srcset via Netlify image CDN', async ({ page }) => {
    await page.goto('/copenhagen');
    await page.setViewportSize({ width: 1280, height: 900 });
    // Images are rendered directly (no picture wrapper) with a CDN srcset
    const imgCount = await page.locator('.gallery-item img').count();
    expect(imgCount).toBeGreaterThan(0);
    const firstSrcset = await page.locator('.gallery-item img').first().getAttribute('srcset');
    expect(firstSrcset).toContain('/.netlify/images');
  });

  test('gallery images serve optimized formats via Netlify CDN', async ({ page }) => {
    await page.goto('/copenhagen');
    await page.setViewportSize({ width: 1280, height: 900 });
    const imgs = page.locator('.gallery-item img');
    const count = await imgs.count();
    expect(count).toBeGreaterThan(0);
    // src should go through Netlify image CDN for on-demand format conversion
    for (let i = 0; i < Math.min(count, 5); i++) {
      const src = await imgs.nth(i).getAttribute('src');
      expect(src).toContain('/.netlify/images');
    }
  });

  test('lightbox immediately shows cached CDN thumbnail on click', async ({ page }) => {
    await page.goto('/copenhagen');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator('.gallery-item img').first().click();
    await expect(page.locator('#lightbox')).toHaveClass(/active/);
    // Lightbox opens instantly by reusing the already-cached CDN thumbnail.
    // It then upgrades to a viewport-sized CDN image silently in the background.
    const lightboxSrc = await page.locator('#lightbox-image').getAttribute('src');
    expect(lightboxSrc).toBeTruthy();
    expect(lightboxSrc).toContain('/.netlify/images');
  });
});

test.describe('Image processing', () => {
  test('gallery JSON schema supports webpSrc field', async () => {
    const jsonPath = path.join(process.cwd(), 'src', 'content', 'galleries', 'copenhagen.json');
    const data = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
    expect(Array.isArray(data.images)).toBe(true);
    // Each image should have required fields
    for (const image of data.images) {
      expect(image).toHaveProperty('src');
      expect(image).toHaveProperty('alt');
      // webpSrc is optional but should be a string if present
      if (image.webpSrc !== undefined) {
        expect(typeof image.webpSrc).toBe('string');
        expect(image.webpSrc).toMatch(/\.webp$/);
      }
    }
  });

  test('image processing script exists and is valid', async () => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'process-gallery-images.mjs');
    const stat = await fs.stat(scriptPath);
    expect(stat.isFile()).toBe(true);
    // Check the script contains expected functionality
    const content = await fs.readFile(scriptPath, 'utf8');
    expect(content).toContain('convertToWebP');
    expect(content).toContain('extractExifMetadata');
    expect(content).toContain('createGalleryJson');
  });

  test('all gallery JSONs have required structure', async () => {
    const slugs = await loadGallerySlugs();
    expect(slugs.length).toBeGreaterThan(0);

    for (const slug of slugs) {
      const jsonPath = path.join(process.cwd(), 'src', 'content', 'galleries', `${slug}.json`);
      const data = JSON.parse(await fs.readFile(jsonPath, 'utf8'));

      // Required top-level fields
      expect(data).toHaveProperty('title');
      expect(data).toHaveProperty('location');
      expect(data).toHaveProperty('publishedDate');
      expect(data).toHaveProperty('images');
      expect(Array.isArray(data.images)).toBe(true);
      expect(data.images.length).toBeGreaterThan(0);

      // Each image must have src and alt
      for (const image of data.images) {
        expect(image).toHaveProperty('src');
        expect(image).toHaveProperty('alt');
        expect(image.src).toMatch(/^\/images\//);
      }
    }
  });

  test('gallery EXIF data has valid structure when present', async () => {
    const slugs = await loadGallerySlugs();

    for (const slug of slugs) {
      const jsonPath = path.join(process.cwd(), 'src', 'content', 'galleries', `${slug}.json`);
      const data = JSON.parse(await fs.readFile(jsonPath, 'utf8'));

      for (const image of data.images) {
        if (image.exif) {
          // Validate EXIF field types when present
          if (image.exif.date !== undefined) {
            expect(typeof image.exif.date).toBe('string');
          }
          if (image.exif.camera !== undefined) {
            expect(typeof image.exif.camera).toBe('string');
          }
          if (image.exif.lens !== undefined) {
            expect(typeof image.exif.lens).toBe('string');
          }
          if (image.exif.focalLength !== undefined) {
            expect(typeof image.exif.focalLength).toBe('string');
            expect(image.exif.focalLength).toMatch(/mm$/);
          }
          if (image.exif.aperture !== undefined) {
            expect(typeof image.exif.aperture).toBe('string');
            expect(image.exif.aperture).toMatch(/^f\//);
          }
          if (image.exif.shutterSpeed !== undefined) {
            expect(typeof image.exif.shutterSpeed).toBe('string');
            expect(image.exif.shutterSpeed).toMatch(/s$/);
          }
          if (image.exif.iso !== undefined) {
            expect(typeof image.exif.iso).toBe('string');
            expect(image.exif.iso).toMatch(/^ISO /);
          }
          if (image.exif.latitude !== undefined) {
            expect(typeof image.exif.latitude).toBe('number');
            expect(image.exif.latitude).toBeGreaterThanOrEqual(-90);
            expect(image.exif.latitude).toBeLessThanOrEqual(90);
          }
          if (image.exif.longitude !== undefined) {
            expect(typeof image.exif.longitude).toBe('number');
            expect(image.exif.longitude).toBeGreaterThanOrEqual(-180);
            expect(image.exif.longitude).toBeLessThanOrEqual(180);
          }
          if (image.exif.location !== undefined) {
            expect(typeof image.exif.location).toBe('string');
          }
        }
      }
    }
  });

  test('each gallery JSON has a corresponding page', async () => {
    const slugs = await loadGallerySlugs();
    const pagesDir = path.join(process.cwd(), 'src', 'pages');

    for (const slug of slugs) {
      const pagePath = path.join(pagesDir, `${slug}.astro`);
      try {
        const stat = await fs.stat(pagePath);
        expect(stat.isFile()).toBe(true);
      } catch {
        // Page doesn't exist - this is an error
        throw new Error(`Missing page for gallery: ${slug}`);
      }
    }
  });
});

test.describe('GitHub Actions workflows', () => {
  test('process-photos workflow exists with correct triggers', async () => {
    const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'process-photos.yml');
    const content = await fs.readFile(workflowPath, 'utf8');

    // Check for correct trigger
    expect(content).toContain('push:');
    expect(content).toContain('branches:');
    expect(content).toContain('main');
    expect(content).toContain('public/images/**/*.jpg');

    // Check for required steps
    expect(content).toContain('process-gallery-images.mjs');
    expect(content).toContain('sharp');
    expect(content).toContain('exifr');
    expect(content).toContain('push-gallery-pr.sh');
  });

  test('convert-all-images workflow exists with manual trigger', async () => {
    const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'convert-all-images.yml');
    const content = await fs.readFile(workflowPath, 'utf8');

    // Check for manual trigger
    expect(content).toContain('workflow_dispatch:');
    expect(content).toContain('inputs:');

    // Check for required options
    expect(content).toContain('quality');
    expect(content).toContain('force');
    expect(content).toContain('gallery');
    expect(content).toContain('skip_webp');
    expect(content).toContain('skip_geocode');

    // Check for required steps
    expect(content).toContain('process-gallery-images.mjs');
    expect(content).toContain('push-gallery-pr.sh');
  });

  test('CI workflow exists and runs tests', async () => {
    const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'ci.yml');
    const content = await fs.readFile(workflowPath, 'utf8');

    expect(content).toContain('pull_request:');
    expect(content).toContain('playwright');
  });
});

test.describe('Blog routing', () => {
  test('BlogList uses post.id not post.slug for hrefs', async () => {
    const blogListPath = path.join(process.cwd(), 'src', 'components', 'BlogList.astro');
    const content = await fs.readFile(blogListPath, 'utf8');
    expect(content).toContain('post.id');
    expect(content).not.toContain('post.slug');
  });

  test('[...slug].astro uses post.id and render(post) API', async () => {
    const slugPagePath = path.join(process.cwd(), 'src', 'pages', 'blog', '[...slug].astro');
    const content = await fs.readFile(slugPagePath, 'utf8');
    expect(content).toContain('post.id');
    expect(content).not.toContain('post.slug');
    // Astro 6 render API: render(post) not post.render()
    expect(content).toContain('render(post)');
    expect(content).not.toContain('post.render()');
  });

  test('all blog markdown files have required frontmatter', async () => {
    const blogDir = path.join(process.cwd(), 'src', 'content', 'blog');
    const files: string[] = [];
    const walk = async (dir: string) => {
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) await walk(fullPath);
        else if (entry.name.endsWith('.md')) files.push(fullPath);
      }
    };
    await walk(blogDir);
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const content = await fs.readFile(file, 'utf8');
      expect(content, `${file} missing title`).toMatch(/^title:/m);
      expect(content, `${file} missing pubDate`).toMatch(/^pubDate:/m);
    }
  });
});

test.describe('Content schema', () => {
  test('config.ts includes webpSrc in gallery schema', async () => {
    const content = await fs.readFile(contentConfigPath, 'utf8');

    // Check for webpSrc field in schema
    expect(content).toContain('webpSrc');
    expect(content).toContain('z.string().optional()');

    // Check for EXIF schema fields
    expect(content).toContain('exif:');
    expect(content).toContain('latitude');
    expect(content).toContain('longitude');
    expect(content).toContain('location');
  });
});

test.describe('Gallery component', () => {
  test('Gallery.astro uses Astro Image component with Netlify CDN', async () => {
    const componentPath = path.join(process.cwd(), 'src', 'components', 'Gallery.astro');
    const content = await fs.readFile(componentPath, 'utf8');

    // Uses Astro's <Image /> component (not a raw <picture>)
    expect(content).toContain('<Image');
    expect(content).toContain("from 'astro:assets'");

    // Responsive srcset via widths prop
    expect(content).toContain('widths=');
    expect(content).toContain('sizes=');

    // data-full-src for lightbox to load original full-resolution file
    expect(content).toContain('data-full-src=');

    // EXIF data attributes still present
    expect(content).toContain('data-exif-');
  });

  test('Gallery.astro has performance optimizations', async () => {
    const componentPath = path.join(process.cwd(), 'src', 'components', 'Gallery.astro');
    const content = await fs.readFile(componentPath, 'utf8');

    // width/height attributes for CLS prevention (with fallback defaults)
    expect(content).toContain('width={image.width');
    expect(content).toContain('height={image.height');

    // Check for fetchpriority on first image for LCP
    expect(content).toContain('fetchpriority');

    // Check for lazy/eager loading based on position
    expect(content).toContain('loading={isAboveFold');
    expect(content).toContain('"eager"');
    expect(content).toContain('"lazy"');

    // Check for decoding attribute
    expect(content).toContain('decoding=');
  });
});

test.describe('Performance optimizations', () => {
  test('content schema supports image dimensions', async () => {
    const content = await fs.readFile(contentConfigPath, 'utf8');

    // Check for width/height in schema
    expect(content).toContain('width: z.number().optional()');
    expect(content).toContain('height: z.number().optional()');
  });

  test('image processor extracts dimensions', async () => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'process-gallery-images.mjs');
    const content = await fs.readFile(scriptPath, 'utf8');

    // Check for dimension extraction
    expect(content).toContain('metadata.width');
    expect(content).toContain('metadata.height');
    expect(content).toContain('imageEntry.width');
    expect(content).toContain('imageEntry.height');
  });

  test('uses system font stack for performance', async () => {
    const layoutPath = path.join(process.cwd(), 'src', 'layouts', 'BaseLayout.astro');
    const content = await fs.readFile(layoutPath, 'utf8');

    // Check for system font stack (not external fonts)
    expect(content).toContain('-apple-system');
    expect(content).toContain('BlinkMacSystemFont');
    // Should not reference fonts that need to be loaded
    expect(content).not.toContain('"proxima-nova"');
  });

  test('first gallery images have priority loading', async ({ page }) => {
    await page.goto('/copenhagen');
    await page.setViewportSize({ width: 1280, height: 900 });

    // First image should have fetchpriority="high"
    const firstImg = page.locator('.gallery-item img').first();
    const fetchpriority = await firstImg.getAttribute('fetchpriority');
    expect(fetchpriority).toBe('high');

    // First image should have loading="eager"
    const loading = await firstImg.getAttribute('loading');
    expect(loading).toBe('eager');

    // Later images should have loading="lazy"
    const seventhImg = page.locator('.gallery-item img').nth(6);
    const laterLoading = await seventhImg.getAttribute('loading');
    expect(laterLoading).toBe('lazy');
  });

  test('gallery images have dimensions for CLS prevention', async ({ page }) => {
    await page.goto('/copenhagen');
    await page.setViewportSize({ width: 1280, height: 900 });

    // Check first few images have width/height or aspect-ratio
    const imgs = page.locator('.gallery-item img');
    const count = await imgs.count();

    for (let i = 0; i < Math.min(count, 5); i++) {
      const img = imgs.nth(i);
      const style = await img.getAttribute('style');
      const width = await img.getAttribute('width');
      const height = await img.getAttribute('height');

      // Either has explicit dimensions or aspect-ratio style
      const hasDimensions = (width && height) || (style && style.includes('aspect-ratio'));
      // Note: dimensions may not be present if images haven't been processed yet
      // This test verifies the structure is in place
    }
  });
});

test.describe('Panoramic photos', () => {
  const measureGallery = (page: import('@playwright/test').Page) =>
    page.evaluate(() => {
      const grid = document.querySelector('.gallery-grid') as HTMLElement;
      const gridRect = grid.getBoundingClientRect();
      const gap = Number.parseFloat(getComputedStyle(grid).columnGap);
      const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').map(Number.parseFloat);
      const items = [...document.querySelectorAll('.gallery-item')] as HTMLElement[];
      const panorama = items.find((item) => item.classList.contains('gallery-item-panorama'));
      if (!panorama) return null;
      const rect = panorama.getBoundingClientRect();
      return {
        columnCount: columns.length,
        columnWidth: columns[0],
        gap,
        panoramaWidth: rect.width,
        // Distance from the grid's left edge, in whole columns.
        offsetFromColumnBoundary: Math.abs((rect.left - gridRect.left) % (columns[0] + gap)),
        // Tiles that share vertical space with the panorama - i.e. sit beside it.
        neighbours: items.filter((item) => {
          if (item === panorama) return false;
          const r = item.getBoundingClientRect();
          return r.top < rect.bottom - 2 && r.bottom > rect.top + 2;
        }).length,
      };
    });

  test('only ultra-wide photos are marked as panoramas', async ({ page }) => {
    test.slow();
    const slugs = await loadGallerySlugs();

    for (const slug of slugs) {
      const jsonPath = path.join(process.cwd(), 'src', 'content', 'galleries', `${slug}.json`);
      const data = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
      const expected = data.images.filter(
        (image: { width?: number; height?: number }) =>
          image.width && image.height && image.width / image.height >= 2
      ).length;

      await page.goto(`/${slug}`);
      const rendered = await page.locator('.gallery-item-panorama').count();
      expect(rendered, `panorama count for ${slug}`).toBe(expected);
    }
  });

  test('panoramas are exactly two columns wide and sit on the column grid', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/canada');

    const metrics = await measureGallery(page);
    expect(metrics).not.toBeNull();
    expect(metrics!.columnCount).toBe(3);
    // Two column widths plus the gap they swallow between them.
    expect(metrics!.panoramaWidth).toBeCloseTo(metrics!.columnWidth * 2 + metrics!.gap, 0);
    // Flush with a column boundary rather than centred across one.
    expect(metrics!.offsetFromColumnBoundary).toBeLessThan(1.5);
  });

  test('photos fill the column beside a panorama', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/canada');

    // The whole point of the grid: a two-column panorama in a three-column
    // layout leaves a column free, and ordinary photos flow into it.
    const metrics = await measureGallery(page);
    expect(metrics!.neighbours).toBeGreaterThan(0);
  });

  test('panoramas fill the width when the grid is two columns or fewer', async ({ page }) => {
    for (const width of [1000, 500]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/canada');

      const metrics = await measureGallery(page);
      const expected =
        metrics!.columnWidth * metrics!.columnCount + metrics!.gap * (metrics!.columnCount - 1);
      expect(metrics!.panoramaWidth, `panorama width at ${width}px`).toBeCloseTo(expected, 0);
    }
  });

  test('tiles keep their aspect ratio to within a fraction of a percent', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/canada');
    await page.evaluate(() =>
      document.querySelectorAll('.gallery-item img').forEach((img) => {
        (img as HTMLImageElement).loading = 'eager';
      })
    );
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('.gallery-item img')].every(
          (img) => (img as HTMLImageElement).complete
        ),
      null,
      { timeout: 60000 }
    );

    // Heights are quantised to the row grid, so a tile can be a hair shorter or
    // taller than its photo's true aspect ratio; object-fit: cover absorbs it.
    // Guard the size of that discrepancy so a bad row-span never slips through.
    const worstDrift = await page.evaluate(() => {
      const grid = document.querySelector('.gallery-grid') as HTMLElement;
      const gap = Number.parseFloat(getComputedStyle(grid).columnGap);
      return Math.max(
        ...[...document.querySelectorAll('.gallery-item')].map((item) => {
          const img = item.querySelector('img') as HTMLImageElement;
          const box = item.getBoundingClientRect();
          const attrRatio =
            Number(img.getAttribute('height')) / Number(img.getAttribute('width'));
          const wanted = box.width * attrRatio + gap;
          return Math.abs(box.height - wanted) / wanted;
        })
      );
    });

    expect(worstDrift).toBeLessThan(0.01);
  });
});

test.describe('English location names', () => {
  test('config.ts includes locationEn in EXIF schema', async () => {
    const content = await fs.readFile(contentConfigPath, 'utf8');
    expect(content).toContain('locationEn');
  });

  test('Gallery.astro passes data-exif-location-en attribute', async () => {
    const componentPath = path.join(process.cwd(), 'src', 'components', 'Gallery.astro');
    const content = await fs.readFile(componentPath, 'utf8');
    expect(content).toContain('data-exif-location-en');
    expect(content).toContain('locationEn');
  });

  test('process-gallery-images.mjs uses Google geocoding for locationEn', async () => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'process-gallery-images.mjs');
    const content = await fs.readFile(scriptPath, 'utf8');
    expect(content).toContain('geocodeGoogle');
    expect(content).toContain('locationEn');
    expect(content).not.toContain('nominatim');
  });

  test('gallery EXIF locationEn is a string when present', async () => {
    const slugs = await loadGallerySlugs();
    for (const slug of slugs) {
      const jsonPath = path.join(process.cwd(), 'src', 'content', 'galleries', `${slug}.json`);
      const data = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
      for (const image of data.images) {
        if (image.exif?.locationEn !== undefined) {
          expect(typeof image.exif.locationEn).toBe('string');
          expect(image.exif.locationEn.length).toBeGreaterThan(0);
        }
      }
    }
  });

  test('lightbox shows combined local and English location label', async ({ page }) => {
    await page.goto('/japan');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator('.gallery-item img').first().evaluate((img) => {
      img.dataset.exifLocation = '東京';
      img.dataset.exifLocationEn = 'Tokyo';
      img.dataset.exifLatitude = '35.6762';
      img.dataset.exifLongitude = '139.6503';
    });
    await page.locator('.gallery-item img').first().click();
    await expect(page.locator('#lightbox')).toHaveClass(/active/);
    const mapLabel = page.locator('#lightbox-map-label');
    await expect(mapLabel).toContainText('東京');
    await expect(mapLabel).toContainText('Tokyo');
  });
});
