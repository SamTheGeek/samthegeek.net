#!/usr/bin/env node
/**
 * Shorten gallery filenames that carry a full Apple Photos UUID.
 *
 * The photo import produced names like
 *
 *   50A3ED07-A33B-45AB-A859-AB71E66E94E8-3843-000005218633E382_photo.webp
 *
 * We aren't trying to hold globally-unique ids in the filename, so this
 * truncates each one to the last 8 characters of its UUID:
 *
 *   E66E94E8.webp
 *
 * Every variant of a photo (the `.webp` and any `.jpg` fallback) is renamed
 * together, and the gallery JSON `src` / `webpSrc` fields are rewritten to
 * match, keeping their own extensions.
 *
 * Eight hex characters is not unique by construction, so the script checks
 * first: if two photos in a gallery would land on the same name, or a target
 * name is already taken, it reports every clash and writes nothing.
 *
 * Files that aren't UUID-named (DSCF1234.webp, IMG_2664.webp) are left alone.
 *
 * Usage:
 *   node scripts/shorten-image-names.mjs --dry-run
 *   node scripts/shorten-image-names.mjs
 *   node scripts/shorten-image-names.mjs --gallery japan
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(ROOT_DIR, 'public', 'images');
const GALLERIES_DIR = path.join(ROOT_DIR, 'src', 'content', 'galleries');

const EXCLUDED_DIRS = ['about', 'blog'];

/** A canonical UUID at the start of a filename, plus whatever follows it. */
const UUID_PREFIX = /^([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})(?:[-_].*)?$/;

/**
 * The short name for a filename stem, or null when the stem isn't UUID-named.
 * Keeps the UUID's own casing, which the import wrote uppercase.
 */
export function shortNameFor(stem) {
  const match = UUID_PREFIX.exec(stem);
  if (!match) return null;
  return match[1].slice(-8);
}

/** Path without its final extension. */
export function stripExtension(filePath) {
  const ext = path.extname(filePath);
  return ext ? filePath.slice(0, -ext.length) : filePath;
}

function parseArgs(argv) {
  const options = { dryRun: false, gallery: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--gallery':
        options.gallery = argv[++i];
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        throw new Error(`Unknown option: ${argv[i]}`);
    }
  }
  return options;
}

function printHelp() {
  console.log(`
Usage: node scripts/shorten-image-names.mjs [options]

Rename gallery images whose filenames carry a full Apple Photos UUID down to
the last 8 characters of that UUID, updating the gallery JSON to match.

Options:
  --gallery <name>  Only rename inside this gallery
  --dry-run         Report the renames without applying them
  --help            Show this message

Nothing is written if any two photos would end up with the same name.
`);
}

async function listGalleries(filter) {
  const entries = await fs.readdir(IMAGES_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !EXCLUDED_DIRS.includes(entry.name))
    .map((entry) => entry.name)
    .filter((name) => !filter || name === filter)
    .sort();
}

/**
 * Group a gallery's files by filename stem, so a photo's variants rename
 * together, and work out the short name for each UUID-named group.
 */
async function planGallery(gallery) {
  const dir = path.join(IMAGES_DIR, gallery);
  const files = await fs.readdir(dir);

  const groups = new Map();
  for (const filename of files) {
    const stem = stripExtension(filename);
    if (!groups.has(stem)) groups.set(stem, []);
    groups.get(stem).push(filename);
  }

  const renames = [];
  const untouched = [];
  for (const [stem, variants] of groups) {
    const shortName = shortNameFor(stem);
    if (!shortName) {
      untouched.push(stem);
      continue;
    }
    renames.push({ gallery, stem, shortName, variants: variants.sort() });
  }

  return { renames, untouched, existingStems: new Set(groups.keys()) };
}

/**
 * Every way this batch could clash: two photos landing on one name, or a name
 * already used by a file we're not renaming.
 */
function findCollisions(renames, existingStems) {
  const collisions = [];
  const claimed = new Map();

  for (const rename of renames) {
    const previous = claimed.get(rename.shortName);
    if (previous) {
      collisions.push(
        `${rename.gallery}: "${previous.stem}" and "${rename.stem}" both shorten to "${rename.shortName}".`,
      );
    } else {
      claimed.set(rename.shortName, rename);
    }

    // A name already on disk that we aren't renaming out of the way.
    if (existingStems.has(rename.shortName) && rename.stem !== rename.shortName) {
      collisions.push(
        `${rename.gallery}: "${rename.stem}" shortens to "${rename.shortName}", which already exists.`,
      );
    }
  }

  return collisions;
}

/**
 * Rewrite gallery JSON paths, matching entries by stem so a `src` still
 * pointing at a legacy `.jpg` is updated alongside its `webpSrc`.
 */
async function updateGalleryJson(gallery, renameByStem, dryRun) {
  const jsonPath = path.join(GALLERIES_DIR, `${gallery}.json`);
  let data;
  try {
    data = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
  } catch {
    return 0;
  }

  let updated = 0;
  for (const image of data.images ?? []) {
    let changed = false;
    for (const field of ['src', 'webpSrc']) {
      const value = image[field];
      if (typeof value !== 'string') continue;
      const dir = path.posix.dirname(value);
      const ext = path.posix.extname(value);
      const stem = path.posix.basename(value, ext);
      const rename = renameByStem.get(stem);
      if (!rename) continue;
      image[field] = `${dir}/${rename.shortName}${ext}`;
      changed = true;
    }
    if (changed) updated++;
  }

  if (updated > 0 && !dryRun) {
    await fs.writeFile(jsonPath, `${JSON.stringify(data, null, 2)}\n`);
  }
  return updated;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return 0;
  }

  const galleries = await listGalleries(options.gallery);
  if (galleries.length === 0) {
    console.error(`No galleries found${options.gallery ? ` matching "${options.gallery}"` : ''}.`);
    return 1;
  }

  const plans = [];
  const collisions = [];
  for (const gallery of galleries) {
    const plan = await planGallery(gallery);
    plans.push({ gallery, ...plan });
    collisions.push(...findCollisions(plan.renames, plan.existingStems));
  }

  // Check the whole batch before touching anything: a half-applied rename is
  // far worse to unpick than one that never started.
  if (collisions.length > 0) {
    console.error(`Found ${collisions.length} name collision(s). Nothing was renamed:\n`);
    for (const collision of collisions) console.error(`  ${collision}`);
    console.error('\nResolve these (a longer truncation, or renaming one by hand) and re-run.');
    return 1;
  }

  let totalFiles = 0;
  let totalPhotos = 0;
  let totalEntries = 0;

  for (const plan of plans) {
    if (plan.renames.length === 0) {
      console.log(`${plan.gallery}: nothing to rename (${plan.untouched.length} already short)`);
      continue;
    }

    console.log(
      `\n${plan.gallery}: ${plan.renames.length} photo(s) to shorten, ` +
      `${plan.untouched.length} left alone`,
    );

    const renameByStem = new Map();
    for (const rename of plan.renames) {
      renameByStem.set(rename.stem, rename);

      for (const variant of rename.variants) {
        const ext = path.extname(variant);
        const from = path.join(IMAGES_DIR, plan.gallery, variant);
        const to = path.join(IMAGES_DIR, plan.gallery, `${rename.shortName}${ext}`);
        if (!options.dryRun) {
          await fs.rename(from, to);
        }
        totalFiles++;
      }
      totalPhotos++;
      console.log(`  ${options.dryRun ? '[dry-run] ' : ''}${rename.stem} -> ${rename.shortName}`);
    }

    const entries = await updateGalleryJson(plan.gallery, renameByStem, options.dryRun);
    totalEntries += entries;
    console.log(`  ${options.dryRun ? '[dry-run] ' : ''}${plan.gallery}.json: ${entries} entr(ies) repointed`);
  }

  console.log(
    `\n${options.dryRun ? '[dry-run] ' : ''}Done: ${totalPhotos} photo(s), ${totalFiles} file(s) renamed, ` +
    `${totalEntries} gallery entr(ies) updated. No collisions.`,
  );
  return 0;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error('Rename failed.');
      console.error(error);
      process.exitCode = 1;
    });
}
