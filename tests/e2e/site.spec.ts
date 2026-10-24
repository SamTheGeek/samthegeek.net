// Browser behaviour only. Anything that can be read from the built HTML is
// checked in tests/dist instead, which needs no browser.
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loadGalleries } from '../helpers.mjs';

const galleries = await loadGalleries();
const desktop = { width: 1280, height: 900 };
const phone = { width: 430, height: 932 };

const lightbox = (page: Page) => page.locator('#lightbox');
const thumbnails = (page: Page) => page.locator('.gallery-item img');
const photoParam = (page: Page) => new URL(page.url()).searchParams.get('photo');

const openFirstPhoto = async (page: Page, slug = 'copenhagen') => {
  await page.goto(`/${slug}`);
  await thumbnails(page).first().click();
  await expect(lightbox(page)).toHaveClass(/active/);
};

test.describe('every gallery', () => {
  test.use({ viewport: desktop });

  for (const { slug } of galleries) {
    test(`${slug} renders and its lightbox opens and closes`, async ({ page }) => {
      await page.goto(`/${slug}`);
      await expect(thumbnails(page).first()).toBeVisible();
      await thumbnails(page).first().click();
      await expect(lightbox(page)).toHaveClass(/active/);
      await page.keyboard.press('Escape');
      await expect(lightbox(page)).not.toHaveClass(/active/);
    });
  }
});

test.describe('lightbox', () => {
  test.use({ viewport: desktop });

  test('shows the cached CDN thumbnail immediately', async ({ page }) => {
    await openFirstPhoto(page);
    await expect(page.locator('#lightbox-image')).toHaveAttribute('src', /\/\.netlify\/images/);
  });

  test('opening sets ?photo= and closing removes it', async ({ page }) => {
    const filename = galleries.find((g) => g.slug === 'copenhagen')!.data.images[0].src.split('/').pop()!;
    await openFirstPhoto(page);
    await expect.poll(() => photoParam(page)).toBe(filename.replace(/\.[^.]+$/, '.webp'));
    await page.keyboard.press('Escape');
    await expect(lightbox(page)).not.toHaveClass(/active/);
    expect(photoParam(page)).toBeNull();
  });

  test('a ?photo= deep link opens that photo', async ({ page }) => {
    const { images } = galleries.find((g) => g.slug === 'copenhagen')!.data;
    const filename = images[images.length - 1].src.split('/').pop()!;
    await page.goto(`/copenhagen?photo=${encodeURIComponent(filename)}`);
    await expect(lightbox(page)).toHaveClass(/active/);
    const baseName = filename.replace(/\.[^.]+$/, '');
    await expect(page.locator('#lightbox-image')).toHaveAttribute('src', new RegExp(`${baseName}\\.(jpe?g|webp)`));
  });

  test('the close button closes it', async ({ page }) => {
    await openFirstPhoto(page);
    await page.locator('.lightbox-close').click();
    await expect(lightbox(page)).not.toHaveClass(/active/);
  });

  test('clicking the backdrop closes it, clicking the controls does not', async ({ page }) => {
    await openFirstPhoto(page);
    await page.locator('.lightbox-info-toggle').click();
    await expect(lightbox(page)).toHaveClass(/active/);
    await lightbox(page).click({ position: { x: 5, y: desktop.height - 5 } });
    await expect(lightbox(page)).not.toHaveClass(/active/);
  });

  test('the info toggle opens and closes the photo details', async ({ page }) => {
    await openFirstPhoto(page);
    const toggle = page.locator('.lightbox-info-toggle');
    const info = page.locator('#lightbox-info');
    await toggle.click();
    await expect(info).toHaveClass(/active/);
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#lightbox-camera')).not.toBeEmpty();
    await toggle.click();
    await expect(info).not.toHaveClass(/active/);
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  test('shows the local and English location names together', async ({ page }) => {
    await page.goto('/japan');
    await thumbnails(page).first().evaluate((img: HTMLImageElement) => {
      img.dataset.exifLocation = '東京';
      img.dataset.exifLocationEn = 'Tokyo';
      img.dataset.exifLatitude = '35.6762';
      img.dataset.exifLongitude = '139.6503';
    });
    await thumbnails(page).first().click();
    await expect(lightbox(page)).toHaveClass(/active/);
    const label = page.locator('#lightbox-map-label');
    await expect(label).toContainText('東京');
    await expect(label).toContainText('Tokyo');
  });

  test.describe('on a phone', () => {
    test.use({ viewport: phone });

    test('opens and closes', async ({ page }) => {
      await openFirstPhoto(page);
      await page.locator('.lightbox-close').click();
      await expect(lightbox(page)).not.toHaveClass(/active/);
    });
  });
});

test.describe('layout', () => {
  test.describe('wide desktop', () => {
    test.use({ viewport: { width: 1400, height: 900 } });

    test('the gallery uses multiple columns', async ({ page }) => {
      await page.goto('/copenhagen');
      const columns = await page.locator('.gallery-grid').evaluate((el) =>
        Number.parseInt(getComputedStyle(el).columnCount, 10),
      );
      expect(columns).toBeGreaterThan(1);
    });
  });

  test.describe('tablet', () => {
    test.use({ viewport: { width: 1024, height: 900 } });

    test('the footer and social links centre in the header/footer layout', async ({ page }) => {
      await page.goto('/copenhagen');
      await expect(page.locator('.sidebar-footer')).toHaveCSS('text-align', 'center');
      await expect(page.locator('.social-links')).toHaveCSS('justify-content', 'center');
    });
  });

  test.describe('phone', () => {
    test.use({ viewport: phone });

    test('the about page stays centred', async ({ page }) => {
      await page.goto('/about');
      const offset = await page.locator('.about-shell').evaluate((shell) => {
        const rect = shell.getBoundingClientRect();
        return Math.abs(rect.left + rect.width / 2 - window.innerWidth / 2);
      });
      expect(offset).toBeLessThan(6);
    });
  });
});

test.describe('blog', () => {
  test('the index links through to a post with working prev/next links', async ({ page }) => {
    await page.goto('/blog');
    const firstPost = page.locator('main a[href^="/blog/2"]').first();
    await expect(firstPost).toBeVisible();
    const href = await firstPost.getAttribute('href');
    await firstPost.click();
    await expect(page).toHaveURL(new RegExp(`${href}/?$`));
    await expect(page.locator('article h1')).toBeVisible();

    const navLinks = page.locator('nav.pagination a');
    for (const navHref of await navLinks.evaluateAll((els) => els.map((el) => el.getAttribute('href')))) {
      expect(navHref).toMatch(/^\/blog\/\d{4}\/[^/]+\/(\d+\/)?[a-z0-9-]+$/);
    }
  });
});

test.describe('accessibility', () => {
  // axe results do not depend on the engine; once is enough.
  test.skip(({ browserName }) => browserName !== 'chromium', 'axe runs in Chromium only');

  // Known, not yet fixed on the blog: links inside post text are told apart by
  // colour alone (link-in-text-block) and embedded YouTube iframes have no
  // title (frame-title). Remove these once the blog styles/content are fixed.
  const knownBlogIssues = ['link-in-text-block', 'frame-title'];

  const scan = (page: Page, knownIssues: string[] = []) =>
    new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast', ...knownIssues])
      // The photo credit is an intentionally low-key easter-egg link.
      .exclude('.photo-credit')
      .analyze();

  for (const path of ['/about', '/copenhagen']) {
    test(`${path} has no WCAG A/AA violations`, async ({ page }) => {
      await page.goto(path);
      expect((await scan(page)).violations).toEqual([]);
    });
  }

  test('/blog has no WCAG A/AA violations beyond the known ones', async ({ page }) => {
    await page.goto('/blog');
    expect((await scan(page, knownBlogIssues)).violations).toEqual([]);
  });

  test('a blog post has no WCAG A/AA violations beyond the known ones', async ({ page }) => {
    await page.goto('/blog');
    await page.locator('main a[href^="/blog/2"]').first().click();
    await expect(page.locator('article h1')).toBeVisible();
    expect((await scan(page, knownBlogIssues)).violations).toEqual([]);
  });

  test('the open lightbox has no WCAG A/AA violations', async ({ page }) => {
    await page.setViewportSize(desktop);
    await openFirstPhoto(page);
    expect((await scan(page)).violations).toEqual([]);
  });
});
