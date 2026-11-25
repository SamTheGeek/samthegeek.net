import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frontmatterField, loadBlogPosts, loadImageIndex } from '../helpers.mjs';

const posts = await loadBlogPosts();
const imageIndex = await loadImageIndex();

/** Every /images/... path a post references, in its body or its rssDescription HTML. */
const imageRefs = (raw) => [...raw.matchAll(/\/images\/[^\s"'()<>\\]+\.[A-Za-z0-9]+/g)].map(([ref]) => ref);

test('there is at least one blog post', () => {
  assert.ok(posts.length > 0);
});

test('every post has a title and a parseable pubDate', () => {
  const problems = [];
  for (const { file, raw } of posts) {
    if (!frontmatterField(raw, 'title')) problems.push(`${file}: missing title`);
    const pubDate = frontmatterField(raw, 'pubDate');
    if (!pubDate || Number.isNaN(new Date(pubDate).valueOf())) {
      problems.push(`${file}: missing or invalid pubDate`);
    }
  }
  assert.deepEqual(problems, []);
});

// urlId is the post's public URL and RSS link; guid is what feed readers
// de-duplicate on. A copy-pasted post that keeps either breaks both.
for (const field of ['urlId', 'guid']) {
  test(`${field} is unique across posts`, () => {
    const owners = new Map();
    for (const { file, raw } of posts) {
      const value = frontmatterField(raw, field);
      if (value === undefined) continue;
      owners.set(value, [...(owners.get(value) ?? []), file]);
    }
    const duplicates = [...owners].filter(([, files]) => files.length > 1);
    assert.deepEqual(duplicates, []);
  });
}

// Posts used to reference .jpg files that were only ever deployed as .webp,
// so those images 404ed into the homepage. Photos and screenshots are WebP
// (the formats the site serves), and every reference has to exist.
test('every image a post references is a WebP that exists', async () => {
  const problems = [];
  for (const { file, raw } of posts) {
    for (const ref of new Set(imageRefs(raw))) {
      if (!ref.endsWith('.webp')) problems.push(`${file}: ${ref} is not WebP`);
      else if (!(await imageIndex.has(ref.slice(1)))) problems.push(`${file}: ${ref} does not exist`);
    }
  }
  assert.deepEqual(problems, []);
});
