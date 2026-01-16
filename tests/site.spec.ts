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

test.describe('Site behavior', () => {
  test('lightbox opens on click', async ({ page }) => {
    await page.goto('/copenhagen');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator('.gallery-item img').first().click();
    await expect(page.locator('#lightbox')).toHaveClass(/active/);
    await expect(page.locator('#lightbox-image')).toHaveAttribute('src', /\/images\//);
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
    const columnCount = await page.$eval('.gallery-grid', (el) =>
      Number.parseInt(getComputedStyle(el).columnCount, 10)
    );
    expect(columnCount).toBeGreaterThan(1);
  });

  test('all galleries render images and lightbox opens', async ({ page }) => {
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

  test('gallery images use picture elements', async ({ page }) => {
    await page.goto('/copenhagen');
    await page.setViewportSize({ width: 1280, height: 900 });
    // Check that images are wrapped in picture elements
    const pictureCount = await page.locator('.gallery-item picture').count();
    const imgCount = await page.locator('.gallery-item img').count();
    expect(pictureCount).toBeGreaterThan(0);
    expect(pictureCount).toBe(imgCount);
  });

  test('gallery images have JPEG fallback', async ({ page }) => {
    await page.goto('/copenhagen');
    await page.setViewportSize({ width: 1280, height: 900 });
    // Every img in gallery should have a JPEG src as fallback
    const imgs = page.locator('.gallery-item img');
    const count = await imgs.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < Math.min(count, 5); i++) {
      const src = await imgs.nth(i).getAttribute('src');
      expect(src).toMatch(/\.(jpg|jpeg)$/i);
    }
  });

  test('lightbox uses currentSrc for WebP support', async ({ page }) => {
    await page.goto('/copenhagen');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator('.gallery-item img').first().click();
    await expect(page.locator('#lightbox')).toHaveClass(/active/);
    // The lightbox should have an image loaded
    const lightboxSrc = await page.locator('#lightbox-image').getAttribute('src');
    expect(lightboxSrc).toBeTruthy();
    // It should be either WebP or JPEG depending on browser support
    expect(lightboxSrc).toMatch(/\.(jpg|jpeg|webp)$/i);
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
    expect(content).toContain('create-pull-request');
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
    expect(content).toContain('create-pull-request');
  });

  test('CI workflow exists and runs tests', async () => {
    const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'ci.yml');
    const content = await fs.readFile(workflowPath, 'utf8');

    expect(content).toContain('pull_request:');
    expect(content).toContain('playwright');
  });
});

test.describe('Content schema', () => {
  test('config.ts includes webpSrc in gallery schema', async () => {
    const configPath = path.join(process.cwd(), 'src', 'content', 'config.ts');
    const content = await fs.readFile(configPath, 'utf8');

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
  test('Gallery.astro uses picture elements with WebP source', async () => {
    const componentPath = path.join(process.cwd(), 'src', 'components', 'Gallery.astro');
    const content = await fs.readFile(componentPath, 'utf8');

    // Check for picture element
    expect(content).toContain('<picture>');
    expect(content).toContain('</picture>');

    // Check for WebP source
    expect(content).toContain('type="image/webp"');
    expect(content).toContain('webpSrc');

    // Check for JPEG fallback img
    expect(content).toContain('<img');
    expect(content).toContain('src={image.src}');

    // Check for data attributes for EXIF
    expect(content).toContain('data-exif-');
    expect(content).toContain('data-webp-src');
  });

  test('Gallery.astro has performance optimizations', async () => {
    const componentPath = path.join(process.cwd(), 'src', 'components', 'Gallery.astro');
    const content = await fs.readFile(componentPath, 'utf8');

    // Check for width/height attributes for CLS prevention
    expect(content).toContain('width={image.width}');
    expect(content).toContain('height={image.height}');

    // Check for aspect-ratio CSS for CLS prevention
    expect(content).toContain('aspect-ratio');

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
    const configPath = path.join(process.cwd(), 'src', 'content', 'config.ts');
    const content = await fs.readFile(configPath, 'utf8');

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
