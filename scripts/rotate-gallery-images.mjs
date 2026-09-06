#!/usr/bin/env node
/**
 * Rotate gallery images that lost their EXIF orientation during conversion.
 *
 * Photos shot in portrait carry an EXIF Orientation tag rather than rotated
 * pixels. The WebP conversion baked the *stored* pixels and dropped the tag, so
 * those photos now display sideways everywhere. This script fixes them the only
 * way that survives every browser, OS and download: it rotates the actual
 * pixels and writes an explicit `Orientation = 1` so nothing can second-guess
 * the result.
 *
 * Intake is a list of images plus one of three rotations (cw, ccw, 180). Each
 * entry may be a live site URL, a site-root path, a repo path or a bare
 * filename:
 *
 *   https://samthegeek.net/images/japan/DSCF1234.webp
 *   /images/japan/DSCF1234.webp
 *   public/images/japan/DSCF1234.webp
 *   japan/DSCF1234.webp
 *   DSCF1234.webp
 *   /_image?href=%2Fimages%2Fjapan%2FDSCF1234.webp&w=800   (Astro-optimized URL)
 *
 * A rotation may be attached to an individual entry, which overrides
 * --rotation for that image:
 *
 *   /images/japan/DSCF1234.webp cw
 *   /images/japan/DSCF5678.webp | ccw
 *   /images/japan/DSCF9012.webp => 180
 *
 * Every sibling variant of an image is rotated together (the `.webp` and its
 * `.jpg` fallback), so the fallback never disagrees with the WebP, and the
 * gallery JSON `width`/`height` are re-read from the rotated files so the
 * layout reserves the right space.
 *
 * Usage:
 *   node scripts/rotate-gallery-images.mjs --rotation cw /images/japan/DSCF1234.webp
 *   node scripts/rotate-gallery-images.mjs --images-file rotations.txt
 *   echo "/images/japan/DSCF1234.webp cw" | node scripts/rotate-gallery-images.mjs
 *
 * Options:
 *   --rotation <cw|ccw|180>  Rotation for entries that don't carry their own
 *   --images-file <path>     Read entries from a file (one per line, # = comment)
 *   --images <text>          Read entries from a string (newline/comma separated)
 *   --quality <n>            Re-encode quality, 1-100 (default: 100)
 *   --lossless               Encode WebP output losslessly (large files)
 *   --report <path>          Write a JSON summary of the run
 *   --summary <path>         Write a Markdown summary of the run
 *   --dry-run                Report what would change without writing
 *   --strict                 Exit non-zero if any entry fails
 *   --help
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const IMAGES_DIR = path.join(PUBLIC_DIR, 'images');
const GALLERIES_DIR = path.join(ROOT_DIR, 'src', 'content', 'galleries');

const DEFAULT_QUALITY = 100;

// Extensions we can rotate. GIF is excluded on purpose: animated frames don't
// survive a naive re-encode.
export const ROTATABLE_EXTENSIONS = ['.webp', '.jpg', '.jpeg', '.png'];

/**
 * The three supported operations, and the aliases people actually type.
 * Degrees are clockwise, matching sharp's rotate().
 */
const ROTATIONS = {
  cw: 90,
  ccw: 270,
  '180': 180,
};

const ROTATION_ALIASES = new Map([
  ['cw', 'cw'],
  ['90', 'cw'],
  ['+90', 'cw'],
  ['right', 'cw'],
  ['clockwise', 'cw'],
  ['rotatecw', 'cw'],
  ['ccw', 'ccw'],
  ['270', 'ccw'],
  ['-90', 'ccw'],
  ['left', 'ccw'],
  ['counterclockwise', 'ccw'],
  ['counter-clockwise', 'ccw'],
  ['anticlockwise', 'ccw'],
  ['rotateccw', 'ccw'],
  ['180', '180'],
  ['-180', '180'],
  ['flip', '180'],
  ['upsidedown', '180'],
  ['upside-down', '180'],
  ['rotate180', '180'],
]);

/**
 * Normalize a user-supplied rotation token to one of cw | ccw | 180.
 * Returns null when the token isn't a rotation.
 */
export function parseRotation(token) {
  if (typeof token !== 'string') return null;
  const key = token.trim().toLowerCase().replace(/[\s_]+/g, '').replace(/°|deg(rees)?$/g, '');
  if (!key) return null;
  return ROTATION_ALIASES.get(key) ?? null;
}

/** Clockwise degrees for a normalized rotation name. */
export function rotationDegrees(rotation) {
  return ROTATIONS[rotation] ?? null;
}

/**
 * Pull the image reference out of anything the user might paste: a lightbox
 * `/<gallery>/?photo=…` URL, a live or deploy-preview URL, an Astro
 * `/_image?href=…` optimized URL, a site-root path, a repo path or a bare
 * filename.
 */
export function normalizeImageReference(raw) {
  if (typeof raw !== 'string') return '';
  let value = raw.trim();

  // Markdown/HTML leftovers people paste along with the URL.
  value = value.replace(/^[<'"`(\[]+/, '').replace(/[>'"`)\]]+$/, '');
  if (!value) return '';

  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      // Astro's image endpoint wraps the real path in an ?href= parameter.
      const href = url.searchParams.get('href');
      // The lightbox deep-links a photo as /<gallery>/?photo=<filename>, which
      // is what you get by copying the address bar with a photo open.
      const photo = url.searchParams.get('photo');
      if (href && /\.[a-z0-9]+$/i.test(href)) {
        value = href;
      } else if (photo) {
        const gallery = url.pathname.split('/').filter(Boolean)[0];
        value = gallery ? `${gallery}/${photo}` : photo;
      } else {
        value = url.pathname;
      }
    } catch {
      // Fall through and treat it as a plain path.
    }
  }

  // Drop any query string / fragment left on a plain path.
  value = value.split('#')[0].split('?')[0];

  try {
    value = decodeURIComponent(value);
  } catch {
    // Keep the raw value if it isn't valid percent-encoding.
  }

  return value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '').trim();
}

/**
 * Split raw intake text into { reference, rotation } entries.
 * Entries are separated by newlines, commas or semicolons; a per-entry rotation
 * is separated from the reference by whitespace, `|` or `=>`.
 */
export function parseEntries(text, defaultRotation = null) {
  const entries = [];
  if (typeof text !== 'string') return entries;

  for (const rawLine of text.split(/[\n\r,;]+/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const parts = line.split(/\s*(?:=>|\||\s)\s*/).filter(Boolean);
    let rotation = defaultRotation;
    let reference = line;

    if (parts.length > 1) {
      const parsed = parseRotation(parts[parts.length - 1]);
      if (parsed) {
        rotation = parsed;
        reference = parts.slice(0, -1).join(' ');
      }
    }

    entries.push({ raw: line, reference: reference.trim(), rotation });
  }

  return entries;
}

/** Path without its final extension, e.g. `a/b/DSCF1.webp` -> `a/b/DSCF1`. */
export function stripExtension(filePath) {
  const ext = path.extname(filePath);
  return ext ? filePath.slice(0, -ext.length) : filePath;
}

async function fileExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function listGalleryDirs() {
  try {
    const entries = await fs.readdir(IMAGES_DIR, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

/**
 * Resolve a normalized reference to an absolute path inside public/.
 *
 * Gallery JSON still points `src` at legacy `.jpg` paths that no longer exist
 * on disk, so a reference whose exact extension is missing falls back to a
 * sibling with the same basename.
 */
export async function resolveImagePath(reference) {
  const normalized = normalizeImageReference(reference);
  if (!normalized) {
    return { error: 'Empty image reference.' };
  }
  if (normalized.includes('..')) {
    return { error: `Refusing to resolve a path containing "..": ${reference}` };
  }

  const candidates = [];
  if (normalized.startsWith('public/')) {
    candidates.push(path.join(ROOT_DIR, normalized));
  } else if (normalized.startsWith('images/')) {
    candidates.push(path.join(PUBLIC_DIR, normalized));
  } else if (normalized.includes('/')) {
    candidates.push(path.join(IMAGES_DIR, normalized));
    candidates.push(path.join(PUBLIC_DIR, normalized));
  }

  // Bare filename: look for it in every gallery folder.
  if (!normalized.includes('/')) {
    const base = stripExtension(normalized);
    const matches = [];
    for (const dir of await listGalleryDirs()) {
      for (const ext of ROTATABLE_EXTENSIONS) {
        const candidate = path.join(IMAGES_DIR, dir, `${base}${ext}`);
        if (await fileExists(candidate)) matches.push(candidate);
      }
    }
    const unique = [...new Set(matches.map((match) => stripExtension(match)))];
    if (unique.length > 1) {
      const shown = unique.map((match) => path.relative(ROOT_DIR, match)).join(', ');
      return { error: `"${reference}" is ambiguous, it matches: ${shown}. Use a path that includes the gallery.` };
    }
    if (matches.length > 0) candidates.push(matches[0]);
  }

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return finalizeResolved(candidate, reference);
    }
    // Same basename, different extension (e.g. JSON says .jpg, disk has .webp).
    const base = stripExtension(candidate);
    for (const ext of ROTATABLE_EXTENSIONS) {
      const sibling = `${base}${ext}`;
      if (await fileExists(sibling)) {
        return finalizeResolved(sibling, reference);
      }
    }
  }

  return { error: `Could not find an image for "${reference}" under public/.` };
}

function finalizeResolved(absolutePath, reference) {
  const resolved = path.resolve(absolutePath);
  const relativeToPublic = path.relative(PUBLIC_DIR, resolved);
  if (relativeToPublic.startsWith('..') || path.isAbsolute(relativeToPublic)) {
    return { error: `"${reference}" resolves outside public/.` };
  }
  return { path: resolved, repoPath: path.relative(ROOT_DIR, resolved).replace(/\\/g, '/') };
}

/**
 * Every file that represents the same photo: the WebP and its JPEG/PNG
 * fallback. They must rotate together or the fallback will disagree.
 */
export async function findVariants(absolutePath) {
  const dir = path.dirname(absolutePath);
  const base = path.basename(stripExtension(absolutePath));
  let entries = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [absolutePath];
  }

  const variants = entries
    .filter((name) => {
      if (path.basename(stripExtension(name)) !== base) return false;
      return ROTATABLE_EXTENSIONS.includes(path.extname(name).toLowerCase());
    })
    .map((name) => path.join(dir, name))
    .sort();

  return variants.length > 0 ? variants : [absolutePath];
}

/**
 * Index every gallery JSON image entry by `public/images/<gallery>/<basename>`
 * (extension dropped) so a rotated `.webp` still matches an entry whose `src`
 * points at a legacy `.jpg`.
 */
export async function buildGalleryIndex() {
  const index = new Map();
  let files = [];
  try {
    files = (await fs.readdir(GALLERIES_DIR)).filter((name) => name.endsWith('.json'));
  } catch {
    return { index, galleries: new Map() };
  }

  const galleries = new Map();

  for (const filename of files) {
    const filePath = path.join(GALLERIES_DIR, filename);
    let data;
    try {
      data = JSON.parse(await fs.readFile(filePath, 'utf8'));
    } catch {
      console.warn(`  Warning: could not parse ${path.join('src/content/galleries', filename)}`);
      continue;
    }
    galleries.set(filename, { filePath, data, dirty: false });

    for (const image of data.images ?? []) {
      for (const key of [image.src, image.webpSrc]) {
        if (typeof key !== 'string' || !key.startsWith('/images/')) continue;
        const indexKey = stripExtension(`public${key}`);
        if (!index.has(indexKey)) index.set(indexKey, []);
        const bucket = index.get(indexKey);
        if (!bucket.some((existing) => existing.image === image)) {
          bucket.push({ filename, image });
        }
      }
    }
  }

  return { index, galleries };
}

/**
 * Rotate one file in place: bake any surviving EXIF orientation, apply the
 * requested rotation, keep the metadata but force Orientation = 1.
 */
async function rotateFile(sharp, absolutePath, degrees, options) {
  const ext = path.extname(absolutePath).toLowerCase();
  const before = await sharp(absolutePath).metadata();
  const bytesBefore = (await fs.stat(absolutePath)).size;

  if (options.dryRun) {
    // Predict from the *displayed* size: a file that still carries an EXIF
    // orientation tag gets auto-oriented before the rotation is applied.
    const upright = before.autoOrient ?? { width: before.width, height: before.height };
    const swaps = degrees !== 180;
    return {
      file: absolutePath,
      before: { width: before.width, height: before.height },
      after: {
        width: swaps ? upright.height : upright.width,
        height: swaps ? upright.width : upright.height,
      },
      bytesBefore,
      bytesAfter: bytesBefore,
    };
  }

  const tempPath = `${absolutePath}.rotate-tmp${ext}`;
  const pipeline = sharp(absolutePath, { failOn: 'error' })
    .autoOrient()
    .rotate(degrees);

  if (ext === '.webp') {
    pipeline.webp(
      options.lossless
        ? { lossless: true, effort: 6 }
        : { quality: options.quality, effort: 6 },
    );
  } else if (ext === '.jpg' || ext === '.jpeg') {
    pipeline.jpeg({ quality: options.quality, chromaSubsampling: '4:4:4' });
  } else if (ext === '.png') {
    pipeline.png({ compressionLevel: 9 });
  }

  // Keep EXIF (camera, lens, GPS) but state plainly that the pixels are
  // already upright, so no viewer re-rotates them.
  pipeline.withMetadata({ orientation: 1 });

  let info;
  try {
    // Take the dimensions from the encoder itself: libvips caches reads by
    // filename + mtime, so re-reading the file we just wrote can hand back the
    // pre-rotation image.
    info = await pipeline.toFile(tempPath);
    await fs.rename(tempPath, absolutePath);
  } catch (error) {
    await fs.rm(tempPath, { force: true });
    throw error;
  }

  return {
    file: absolutePath,
    before: { width: before.width, height: before.height },
    after: { width: info.width, height: info.height },
    bytesBefore,
    bytesAfter: (await fs.stat(absolutePath)).size,
  };
}

function parseArgs(argv) {
  const options = {
    rotation: null,
    imagesFile: null,
    imagesText: null,
    quality: DEFAULT_QUALITY,
    lossless: false,
    report: null,
    summary: null,
    dryRun: false,
    strict: false,
    help: false,
    positional: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--rotation':
      case '--rotate':
        options.rotation = argv[++i];
        break;
      case '--images-file':
        options.imagesFile = argv[++i];
        break;
      case '--images':
        options.imagesText = argv[++i];
        break;
      case '--quality':
        options.quality = Number.parseInt(argv[++i], 10);
        break;
      case '--lossless':
        options.lossless = true;
        break;
      case '--report':
        options.report = argv[++i];
        break;
      case '--summary':
        options.summary = argv[++i];
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--strict':
        options.strict = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        if (arg.startsWith('--')) {
          throw new Error(`Unknown option: ${arg}`);
        }
        options.positional.push(arg);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Usage: node scripts/rotate-gallery-images.mjs [options] [image...]

Rotate site images whose EXIF orientation was lost, baking the rotation into
the pixels so they display correctly in every browser, OS and download.

Options:
  --rotation <cw|ccw|180>  Rotation for entries that don't carry their own
  --images-file <path>     Read entries from a file (one per line, # = comment)
  --images <text>          Read entries from a string (newline/comma separated)
  --quality <n>            Re-encode quality, 1-100 (default: ${DEFAULT_QUALITY})
  --lossless               Encode WebP output losslessly (much larger files)
  --report <path>          Write a JSON summary of the run
  --summary <path>         Write a Markdown summary of the run
  --dry-run                Report what would change without writing
  --strict                 Exit non-zero if any entry fails
  --help                   Show this message

Entries accept live URLs, site-root paths, repo paths or bare filenames, and
may carry their own rotation:

  /images/japan/DSCF1234.webp cw
  https://samthegeek.net/images/italy/DSCF0778.webp | ccw
  DSCF9012.webp => 180

Examples:
  node scripts/rotate-gallery-images.mjs --rotation cw /images/japan/DSCF1234.webp
  node scripts/rotate-gallery-images.mjs --images-file rotations.txt --dry-run
  echo "/images/japan/DSCF1234.webp ccw" | node scripts/rotate-gallery-images.mjs
`);
}

async function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function getSharp() {
  const sharp = (await import('sharp')).default;
  // We read and write the same paths in one run; the libvips cache is keyed on
  // filename + mtime and would happily serve the pre-rotation pixels back.
  sharp.cache(false);
  return sharp;
}

async function collectIntake(options) {
  const sources = [];

  if (options.positional.length > 0) sources.push(options.positional.join('\n'));
  if (options.imagesText) sources.push(options.imagesText);
  if (options.imagesFile) {
    sources.push(await fs.readFile(path.resolve(ROOT_DIR, options.imagesFile), 'utf8'));
  }
  if (sources.length === 0) {
    const stdin = await readStdin();
    if (stdin.trim()) sources.push(stdin);
  }

  return sources.join('\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return 0;
  }

  if (!Number.isInteger(options.quality) || options.quality < 1 || options.quality > 100) {
    console.error(`Error: --quality must be an integer between 1 and 100.`);
    return 1;
  }

  let defaultRotation = null;
  if (options.rotation) {
    defaultRotation = parseRotation(options.rotation);
    if (!defaultRotation) {
      console.error(`Error: unknown rotation "${options.rotation}". Use cw, ccw or 180.`);
      return 1;
    }
  }

  const intake = await collectIntake(options);
  const entries = parseEntries(intake, defaultRotation);

  if (entries.length === 0) {
    console.error('Error: no images given. Pass image URLs/paths, --images, --images-file, or pipe them on stdin.');
    printHelp();
    return 1;
  }

  const results = { rotated: [], errors: [], skipped: [] };

  // Resolve everything before touching a single file, so a typo in entry 12
  // doesn't leave entries 1-11 half-applied.
  const planned = new Map();
  let conflicts = 0;
  for (const entry of entries) {
    if (!entry.rotation) {
      results.errors.push({
        input: entry.raw,
        error: 'No rotation given for this image, and no --rotation default was set.',
      });
      continue;
    }

    const resolved = await resolveImagePath(entry.reference);
    if (resolved.error) {
      results.errors.push({ input: entry.raw, error: resolved.error });
      continue;
    }

    const key = stripExtension(resolved.path);
    const existing = planned.get(key);
    if (existing) {
      if (existing.rotation !== entry.rotation) {
        conflicts++;
        results.errors.push({
          input: entry.raw,
          error: `Conflicting rotations for ${resolved.repoPath}: "${existing.rotation}" and "${entry.rotation}".`,
        });
      } else {
        results.skipped.push({ input: entry.raw, reason: `Duplicate of ${existing.input}.` });
      }
      continue;
    }

    planned.set(key, {
      input: entry.raw,
      rotation: entry.rotation,
      degrees: rotationDegrees(entry.rotation),
      repoPath: resolved.repoPath,
      variants: await findVariants(resolved.path),
    });
  }

  // A conflict means the intake list itself is wrong about a photo, so stop
  // rather than silently picking one of the two rotations.
  const abort = conflicts > 0 || planned.size === 0 || (options.strict && results.errors.length > 0);
  if (abort) {
    for (const error of results.errors) {
      console.error(`  Error: ${error.input}: ${error.error}`);
    }
    if (conflicts > 0) {
      console.error('\nNothing was rotated: resolve the conflicting rotations above and re-run.');
    }
    await writeReport(options, results);
    return 1;
  }

  const sharp = await getSharp();
  const { index, galleries } = await buildGalleryIndex();

  console.log(
    `${options.dryRun ? '[dry-run] ' : ''}Rotating ${planned.size} image${planned.size === 1 ? '' : 's'} ` +
    `(quality ${options.lossless ? 'lossless' : options.quality})`,
  );

  for (const plan of planned.values()) {
    console.log(`\n${plan.repoPath} -> ${plan.rotation} (${plan.degrees}deg clockwise)`);

    const rotatedFiles = [];
    let failed = false;

    for (const variant of plan.variants) {
      try {
        const result = await rotateFile(sharp, variant, plan.degrees, options);
        rotatedFiles.push(result);
        const relative = path.relative(ROOT_DIR, variant).replace(/\\/g, '/');
        console.log(
          `  ${options.dryRun ? '[dry-run] ' : ''}${relative}: ` +
          `${result.before.width}x${result.before.height} -> ${result.after.width}x${result.after.height} ` +
          `(${formatBytes(result.bytesBefore)} -> ${formatBytes(result.bytesAfter)})`,
        );
      } catch (error) {
        failed = true;
        const relative = path.relative(ROOT_DIR, variant).replace(/\\/g, '/');
        const partial = rotatedFiles.length > 0
          ? ' Its sibling variants were already rotated, so check this photo out of git and re-run.'
          : '';
        results.errors.push({
          input: plan.input,
          error: `Failed to rotate ${relative}: ${error.message}.${partial}`,
        });
        console.error(`  Error rotating ${relative}: ${error.message}`);
      }
    }

    if (rotatedFiles.length === 0 || failed) continue;

    // The site loads `webpSrc ?? src`, so size the JSON entry from the WebP
    // when there is one.
    const primary =
      rotatedFiles.find((result) => path.extname(result.file).toLowerCase() === '.webp') ?? rotatedFiles[0];

    const galleryUpdates = [];
    const matches = index.get(stripExtension(plan.repoPath)) ?? [];
    for (const { filename, image } of matches) {
      const entry = galleries.get(filename);
      if (!entry) continue;
      if (image.width !== primary.after.width || image.height !== primary.after.height) {
        image.width = primary.after.width;
        image.height = primary.after.height;
        entry.dirty = true;
        galleryUpdates.push({ file: `src/content/galleries/${filename}`, width: image.width, height: image.height });
        console.log(
          `  ${options.dryRun ? '[dry-run] ' : ''}${filename}: dimensions -> ${image.width}x${image.height}`,
        );
      }
    }

    if (matches.length === 0) {
      console.log('  Note: no gallery JSON entry references this image.');
    }

    results.rotated.push({
      input: plan.input,
      path: plan.repoPath,
      rotation: plan.rotation,
      degrees: plan.degrees,
      before: `${primary.before.width}x${primary.before.height}`,
      after: `${primary.after.width}x${primary.after.height}`,
      files: rotatedFiles.map((result) => ({
        path: path.relative(ROOT_DIR, result.file).replace(/\\/g, '/'),
        bytesBefore: result.bytesBefore,
        bytesAfter: result.bytesAfter,
      })),
      galleryUpdates,
    });
  }

  if (!options.dryRun) {
    for (const entry of galleries.values()) {
      if (!entry.dirty) continue;
      await fs.writeFile(entry.filePath, `${JSON.stringify(entry.data, null, 2)}\n`);
    }
  }

  console.log(
    `\nDone: ${results.rotated.length} rotated, ${results.skipped.length} skipped, ${results.errors.length} failed.`,
  );
  for (const error of results.errors) {
    console.error(`  Error: ${error.input}: ${error.error}`);
  }

  await writeReport(options, results);

  if (options.strict && results.errors.length > 0) return 1;
  return results.rotated.length > 0 ? 0 : 1;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'n/a';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

async function writeReport(options, results) {
  const report = {
    generatedAt: new Date().toISOString(),
    dryRun: options.dryRun,
    quality: options.lossless ? 'lossless' : options.quality,
    ...results,
  };

  if (options.report) {
    await fs.writeFile(path.resolve(ROOT_DIR, options.report), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Report written to ${options.report}`);
  }

  if (options.summary) {
    await fs.writeFile(path.resolve(ROOT_DIR, options.summary), renderMarkdownSummary(report));
    console.log(`Summary written to ${options.summary}`);
  }
}

/** Render a run report as Markdown, for PR bodies and job summaries. */
export function renderMarkdownSummary(report) {
  const lines = [];
  const count = report.rotated.length;
  const noun = `${count} image${count === 1 ? '' : 's'}`;

  lines.push('## Summary');
  lines.push('');
  if (count === 0) {
    lines.push('No images were rotated. See the details below and re-run once the entries are fixed.');
    lines.push('');
  } else {
    lines.push(
      report.dryRun
        ? `Dry run: ${noun} would be rotated to display upright everywhere. Nothing was written.`
        : `Rotated ${noun} so they display upright everywhere.`,
    );
    lines.push('');
    lines.push(
      'The rotation is baked into the pixels and the EXIF `Orientation` tag is reset to `1`, ' +
      'so the fix holds in every browser, on every OS, and in the downloaded file.',
    );
    lines.push('');
  }

  if (report.rotated.length > 0) {
    lines.push('## Changes');
    lines.push('');
    lines.push('| Image | Rotation | Before | After |');
    lines.push('| --- | --- | --- | --- |');
    for (const item of report.rotated) {
      lines.push(`| \`${item.path}\` | ${item.rotation} | ${item.before} | ${item.after} |`);
    }
    lines.push('');

    const jsonFiles = [
      ...new Set(report.rotated.flatMap((item) => item.galleryUpdates.map((update) => update.file))),
    ];
    if (jsonFiles.length > 0) {
      lines.push(`Gallery dimensions re-synced in: ${jsonFiles.map((file) => `\`${file}\``).join(', ')}.`);
      lines.push('');
    }
  }

  if (report.skipped.length > 0) {
    lines.push('## Skipped');
    lines.push('');
    for (const item of report.skipped) {
      lines.push(`- \`${item.input}\` — ${item.reason}`);
    }
    lines.push('');
  }

  if (report.errors.length > 0) {
    lines.push('## Not applied');
    lines.push('');
    for (const item of report.errors) {
      lines.push(`- \`${item.input}\` — ${item.error}`);
    }
    lines.push('');
  }

  if (count > 0) {
    lines.push('## Test plan');
    lines.push('');
    lines.push('- [ ] Each photo above is upright in the gallery grid');
    lines.push('- [ ] Each photo is upright in the lightbox, and the layout reserves the right space');
    lines.push('- [ ] Downloading a rotated photo opens upright in the OS image viewer');
    lines.push('- [ ] `npm run build` succeeds');
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error('Rotation failed.');
      console.error(error);
      process.exitCode = 1;
    });
}
