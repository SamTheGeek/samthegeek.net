// Checks on the built site in dist/. Run after `astro build` (npm run test:dist).
// These assert on what visitors are actually served, so they survive
// refactors of the components that produce it.
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  distDir,
  exists,
  findTags,
  frontmatterField,
  listDist,
  loadBlogPosts,
  loadGalleries,
  newestGallerySlug,
  readDist,
  resolveDistPath,
} from '../helpers.mjs';

if (!(await exists(distDir))) {
  throw new Error('dist/ not found; run `npm run build` first.');
}

const distFiles = new Set(await listDist());
const htmlFiles = [...distFiles].filter((file) => file.endsWith('.html')).sort();
const html = new Map(await Promise.all(htmlFiles.map(async (file) => [file, await readDist(file)])));
const galleries = await loadGalleries();
const posts = (await loadBlogPosts())
  .map(({ file, raw }) => ({ file, urlId: frontmatterField(raw, 'urlId') }))
  .filter((post) => post.urlId);

/** Same-site paths a page links to, skipping images and the Netlify image CDN. */
const internalLinks = (page) =>
  [...findTags(page, 'a'), ...findTags(page, 'link')]
    .map((attrs) => attrs.href)
    .filter((href) => href?.startsWith('/') && !href.startsWith('//'))
    .filter((href) => !href.startsWith('/images/') && !href.startsWith('/.netlify/'));

const blogPostLinks = (page) =>
  new Set(internalLinks(page).filter((href) => /^\/blog\/\d{4}\//.test(href)).map((href) => href.replace(/\/$/, '')));

test('the homepage is a meta-refresh to the newest gallery and nothing else', () => {
  const index = html.get('index.html');
  const target = `/${newestGallerySlug(galleries)}`;
  const refresh = findTags(index, 'meta').find((meta) => meta['http-equiv'] === 'refresh');
  assert.ok(refresh, 'index.html should have a meta refresh');
  assert.match(refresh.content, new RegExp(`^0;\\s*url=${target}$`));
  assert.doesNotMatch(index, /window\.location/, 'the redirect should not depend on JS');
  assert.doesNotMatch(index, /<nav\b|class="sidebar/, 'index.html should not render the site layout');
});

describe('gallery pages', () => {
  for (const { slug, data } of galleries) {
    describe(slug, () => {
      let images;
      before(() => {
        const page = html.get(`${slug}/index.html`);
        assert.ok(page, `dist/${slug}/index.html should be built`);
        images = findTags(page, 'img').filter((img) => img['data-full-src']);
      });

      test('renders every image in JSON order, pointing at the WebP we serve', () => {
        const expected = data.images.map((image) => image.webpSrc ?? image.src.replace(/\.[^./]+$/, '.webp'));
        assert.deepEqual(images.map((img) => img['data-full-src']), expected);
      });

      test('prioritises the first image and lazy-loads below the fold', () => {
        assert.equal(images[0].fetchpriority, 'high');
        images.forEach((img, index) => {
          assert.equal(img.loading, index < 6 ? 'eager' : 'lazy', `image ${index} loading`);
          if (index > 0) assert.equal(img.fetchpriority, undefined, `image ${index} fetchpriority`);
        });
      });

      test('every image has dimensions, alt text and a Netlify CDN src/srcset', () => {
        for (const img of images) {
          assert.match(img.width ?? '', /^\d+$/, `${img['data-full-src']} width`);
          assert.match(img.height ?? '', /^\d+$/, `${img['data-full-src']} height`);
          assert.ok(img.alt?.trim(), `${img['data-full-src']} alt`);
          assert.match(img.src, /^\/\.netlify\/images\?/);
          const widths = img.srcset.split(',').map((candidate) => candidate.trim().split(/\s+/));
          assert.ok(widths.length > 1, 'srcset should offer several widths');
          for (const [url, descriptor] of widths) {
            assert.match(url, /^\/\.netlify\/images\?/);
            assert.match(descriptor, /^\d+w$/);
          }
          assert.ok(img.sizes, 'sizes should be set alongside srcset');
        }
      });

      test('carries EXIF data for the lightbox', () => {
        data.images.forEach((image, index) => {
          if (image.exif?.camera) assert.equal(images[index]['data-exif-camera'], image.exif.camera);
          if (typeof image.exif?.latitude === 'number') {
            assert.equal(Number(images[index]['data-exif-latitude']), image.exif.latitude);
          }
          if (image.exif?.locationEn) {
            assert.equal(images[index]['data-exif-location-en'], image.exif.locationEn);
          }
        });
      });
    });
  }
});

test('every internal link resolves to a built page', () => {
  const broken = [];
  for (const [file, page] of html) {
    for (const href of internalLinks(page)) {
      if (href.includes('undefined') || !resolveDistPath(distFiles, href)) broken.push(`${file} -> ${href}`);
    }
  }
  assert.deepEqual(broken, []);
});

test('every <img> has an alt attribute', () => {
  const missing = [];
  for (const [file, page] of html) {
    for (const img of findTags(page, 'img')) {
      if (img.alt === undefined) missing.push(`${file}: ${img.src}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('the about portrait has descriptive alt text', () => {
  const alts = findTags(html.get('about/index.html'), 'img').map((img) => img.alt);
  assert.ok(alts.includes('Portrait of Sam Gross'), `about page img alts: ${alts.join(', ')}`);
});

describe('stylesheets', () => {
  let css;
  before(async () => {
    const files = [...distFiles].filter((file) => file.endsWith('.css'));
    const inline = [...html.values()].flatMap((page) =>
      [...page.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(([, body]) => body),
    );
    css = [...(await Promise.all(files.map(readDist))), ...inline].join('\n');
  });

  // Media Queries Level 4 range syntax needs Safari 16.4+; on 16.0-16.3 the
  // breakpoints silently vanish. astro.config.mjs pins vite cssTarget to keep
  // `max-width` output - this fails if that pin is lost.
  test('media queries use max-width, not range syntax', () => {
    const queries = [...css.matchAll(/@media([^{]*)\{/g)].map(([, query]) => query.trim());
    assert.ok(queries.some((query) => /max-width/.test(query)), 'expected max-width breakpoints');
    assert.deepEqual(queries.filter((query) => /[<>]/.test(query)), []);
  });

  test('no web fonts are loaded (system font stack only)', () => {
    assert.doesNotMatch(css, /@font-face/);
    for (const [file, page] of html) {
      assert.doesNotMatch(page, /fonts\.googleapis\.com|use\.typekit\.net|fonts\.gstatic\.com/, file);
    }
  });
});

describe('blog', () => {
  test('every post with a urlId is built at /blog/<urlId>', () => {
    const missing = posts.filter(({ urlId }) => !resolveDistPath(distFiles, `/blog/${urlId}`));
    assert.deepEqual(missing, []);
  });

  test('every post is listed on exactly one index page', () => {
    const listingPages = htmlFiles.filter((file) => /^blog\/(index\.html|page\/\d+\/index\.html)$/.test(file));
    const listedOn = new Map();
    for (const file of listingPages) {
      for (const href of blogPostLinks(html.get(file))) {
        listedOn.set(href, [...(listedOn.get(href) ?? []), file]);
      }
    }
    const problems = posts
      .map(({ urlId }) => [`/blog/${urlId}`, listedOn.get(`/blog/${urlId}`) ?? []])
      .filter(([, files]) => files.length !== 1);
    assert.deepEqual(problems, []);
  });

  test('every category and tag page lists at least one post', () => {
    const empty = htmlFiles
      .filter((file) => /^blog\/(category|tag)\//.test(file))
      .filter((file) => blogPostLinks(html.get(file)).size === 0);
    assert.deepEqual(empty, []);
  });
});

describe('RSS feed', () => {
  let feed;
  let items;
  before(async () => {
    assert.ok(distFiles.has('blog/rss.xml'), 'dist/blog/rss.xml should be built');
    feed = await readDist('blog/rss.xml');
    items = [...feed.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, body]) => {
      const field = (name) => body.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1];
      return { title: field('title'), link: field('link'), guid: field('guid'), pubDate: field('pubDate') };
    });
  });

  test('is an RSS 2.0 document with one item per post', () => {
    assert.match(feed, /^<\?xml version="1\.0" encoding="UTF-8"\?>\s*<rss\b[^>]*version="2\.0"/);
    assert.match(feed, /<\/channel>\s*<\/rss>\s*$/);
    assert.equal((feed.match(/<item>/g) ?? []).length, (feed.match(/<\/item>/g) ?? []).length);
    assert.equal(items.length, posts.length);
  });

  test('items have a title, an RFC 822 pubDate and a unique guid', () => {
    for (const item of items) {
      assert.ok(item.title?.trim(), `title for ${item.link}`);
      assert.match(item.pubDate ?? '', /^\w{3}, \d{2} \w{3} \d{4} \d{2}:\d{2}:\d{2} \+0000$/);
      assert.ok(!Number.isNaN(new Date(item.pubDate).valueOf()), `pubDate for ${item.link}`);
    }
    assert.equal(new Set(items.map((item) => item.guid)).size, items.length, 'guids should be unique');
  });

  test('item links are absolute URLs to built posts', () => {
    const broken = items
      .map((item) => item.link)
      .filter((link) => {
        const url = URL.parse(link ?? '');
        return !url || url.protocol !== 'https:' || !/^(www\.)?samthegeek\.net$/.test(url.hostname) ||
          !resolveDistPath(distFiles, url.pathname);
      });
    assert.deepEqual(broken, []);
  });

  test('CDATA sections are balanced', () => {
    const body = feed.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
    assert.doesNotMatch(body, /<!\[CDATA\[|\]\]>/);
  });
});
