import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frontmatterField, loadBlogPosts } from '../helpers.mjs';

const posts = await loadBlogPosts();

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
