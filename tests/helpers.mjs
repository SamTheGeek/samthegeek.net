// Shared loaders for the node:test suites (unit, data, dist) and Playwright.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const distDir = path.join(root, 'dist');

export const readText = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

export const exists = async (fullPath) => {
  try {
    await fs.access(fullPath);
    return true;
  } catch {
    return false;
  }
};

/** Import a repo script by its repo-relative path. */
export const importScript = (relativePath) =>
  import(pathToFileURL(path.join(root, relativePath)).href);

/** Every gallery JSON as { slug, data }, sorted by slug. Throws on invalid JSON. */
export const loadGalleries = async () => {
  const dir = path.join(root, 'src/content/galleries');
  const files = (await fs.readdir(dir)).filter((name) => name.endsWith('.json')).sort();
  return Promise.all(
    files.map(async (file) => {
      const raw = await fs.readFile(path.join(dir, file), 'utf8');
      try {
        return { slug: path.basename(file, '.json'), data: JSON.parse(raw) };
      } catch (error) {
        throw new Error(`Invalid JSON in src/content/galleries/${file}: ${error.message}`);
      }
    }),
  );
};

/** The gallery the homepage should redirect to: the newest publishedDate. */
export const newestGallerySlug = (galleries) =>
  [...galleries].sort(
    (a, b) => new Date(b.data.publishedDate) - new Date(a.data.publishedDate),
  )[0].slug;

/** Every blog post as { file, raw }, where file is relative to src/content/blog. */
export const loadBlogPosts = async () => {
  const dir = path.join(root, 'src/content/blog');
  const entries = await fs.readdir(dir, { recursive: true });
  const files = entries.filter((name) => name.endsWith('.md')).sort();
  return Promise.all(
    files.map(async (file) => ({
      file: file.replace(/\\/g, '/'),
      raw: await fs.readFile(path.join(dir, file), 'utf8'),
    })),
  );
};

/** A scalar frontmatter value (quoted or bare), or undefined if absent. */
export const frontmatterField = (raw, field) => {
  const block = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
  const match = block.match(new RegExp(`^${field}:[ \\t]*(.*)$`, 'm'));
  if (!match) return undefined;
  const value = match[1].trim();
  if (value.startsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  return value.replace(/^'(.*)'$/, '$1');
};

/** Every file under dist/, relative to it, with forward slashes. */
export const listDist = async () =>
  (await fs.readdir(distDir, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(distDir, path.join(entry.parentPath, entry.name)).replace(/\\/g, '/'));

export const readDist = (relativePath) => fs.readFile(path.join(distDir, relativePath), 'utf8');

/**
 * The built file a site path is served from, following the same lookups as
 * `serve` and Netlify (exact file, then `<path>.html`, then `<path>/index.html`),
 * or null if nothing is built for it.
 */
export const resolveDistPath = (distFiles, sitePath) => {
  const clean = decodeURIComponent(sitePath.split(/[?#]/)[0]).replace(/^\/+|\/+$/g, '');
  const candidates = clean === ''
    ? ['index.html']
    : [clean, `${clean}.html`, `${clean}/index.html`];
  return candidates.find((candidate) => distFiles.has(candidate)) ?? null;
};

const decodeEntities = (value) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

/** Attributes of every `<tag ...>` in the HTML, as plain objects. */
export const findTags = (html, tag) =>
  [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, 'gi'))].map(([, attrs]) => {
    const result = {};
    for (const [, name, , , dq, sq, bare] of attrs.matchAll(
      /([^\s=/>]+)(\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g,
    )) {
      result[name.toLowerCase()] = decodeEntities(dq ?? sq ?? bare ?? '');
    }
    return result;
  });
