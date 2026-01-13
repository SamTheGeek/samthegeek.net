import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const isCI = Boolean(process.env.CI);

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
});
