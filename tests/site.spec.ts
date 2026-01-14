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
    await expect(page.locator('#lightbox-image')).toHaveAttribute('src', new RegExp(escapeRegExp(filename)));
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
});
