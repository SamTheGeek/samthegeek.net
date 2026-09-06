#!/usr/bin/env node
/**
 * Process gallery images: convert to WebP, extract EXIF metadata, and register in gallery JSON.
 *
 * This script:
 * - Finds all JPEG images in gallery directories
 * - Converts them to WebP with the EXIF rotation baked into the pixels, so a
 *   photo shot in portrait stays upright once its orientation tag is gone
 * - Bakes the rotation into any WebP already on disk that still carries one
 * - Keeps the gallery JSON's width/height in step with the files it serves
 * - Extracts EXIF metadata (camera, lens, settings, GPS coordinates)
 * - Registers new images in gallery JSON files
 * - Creates new gallery JSON files for new gallery folders
 * - Optionally performs reverse geocoding for location names
 *
 * Usage:
 *   node scripts/process-gallery-images.mjs [options]
 *
 * Options:
 *   --gallery <name>   Process only a specific gallery (e.g., japan, copenhagen)
 *   --force            Re-process images even if already in JSON
 *   --quality <n>      WebP quality (1-100, default: 80)
 *   --dry-run          Show what would be done without making changes
 *   --skip-webp        Skip WebP conversion (only update metadata/registration)
 *   --skip-geocode     Skip reverse geocoding for location names
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(ROOT_DIR, 'public', 'images');
const GALLERIES_DIR = path.join(ROOT_DIR, 'src', 'content', 'galleries');
const GALLERY_DESCRIPTIONS_DIR = path.join(ROOT_DIR, 'src', 'content', 'galleryDescriptions');

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.JPG', '.JPEG'];
const DEFAULT_QUALITY = 80;
const EXCLUDED_DIRS = ['blog', 'about'];

// Load environment variables from .env file
async function loadEnv() {
  const envPath = path.join(ROOT_DIR, '.env');
  try {
    const content = await fs.readFile(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value;
      }
    }
  } catch {
    // .env file doesn't exist, that's OK
  }
}

/**
 * libvips caches decoded images by filename, so a file rewritten in place
 * reads back as it was before the write - the pre-rotation image, in our case.
 * This script touches each photo once, so the cache buys nothing and costs
 * correctness. Callers that use the exported helpers should do the same.
 */
export function configureSharp(sharp) {
  sharp.cache(false);
  return sharp;
}

/**
 * Dynamically import sharp, installing it if necessary
 */
async function getSharp() {
  try {
    const sharp = await import('sharp');
    return configureSharp(sharp.default);
  } catch {
    console.log('Installing sharp for image processing...');
    await new Promise((resolve, reject) => {
      const proc = spawn('npm', ['install', 'sharp', '--save-dev'], {
        cwd: ROOT_DIR,
        stdio: 'inherit',
        shell: true,
      });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`npm install failed with code ${code}`));
      });
    });
    const sharp = await import('sharp');
    return configureSharp(sharp.default);
  }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    gallery: null,
    force: false,
    quality: DEFAULT_QUALITY,
    dryRun: false,
    skipWebp: false,
    skipGeocode: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--gallery':
        options.gallery = args[++i];
        break;
      case '--force':
        options.force = true;
        break;
      case '--quality':
        options.quality = parseInt(args[++i], 10);
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--skip-webp':
        options.skipWebp = true;
        break;
      case '--skip-geocode':
        options.skipGeocode = true;
        break;
      case '--help':
        console.log(`
Usage: node scripts/process-gallery-images.mjs [options]

Options:
  --gallery <name>   Process only a specific gallery (e.g., japan, copenhagen)
  --force            Re-process images even if already in JSON
  --quality <n>      WebP quality (1-100, default: 80)
  --dry-run          Show what would be done without making changes
  --skip-webp        Skip WebP conversion
  --skip-geocode     Skip reverse geocoding for location names
  --help             Show this help message
`);
        process.exit(0);
    }
  }

  return options;
}

/**
 * Get all gallery directories (including new ones not yet in JSON)
 */
async function getGalleryDirs(specificGallery = null) {
  const entries = await fs.readdir(IMAGES_DIR, { withFileTypes: true });
  const dirs = entries
    .filter((e) => e.isDirectory())
    .filter((e) => !EXCLUDED_DIRS.includes(e.name))
    .map((e) => e.name);

  if (specificGallery) {
    if (EXCLUDED_DIRS.includes(specificGallery)) {
      throw new Error(
        `Directory '${specificGallery}' is excluded from gallery processing (${EXCLUDED_DIRS.join(', ')})`
      );
    }

    if (!dirs.includes(specificGallery)) {
      // Check if the directory exists at all
      try {
        await fs.access(path.join(IMAGES_DIR, specificGallery));
        return [specificGallery];
      } catch {
        throw new Error(`Gallery '${specificGallery}' not found in ${IMAGES_DIR}`);
      }
    }
    return [specificGallery];
  }

  return dirs;
}

/** A filename without its extension, e.g. `DSCF1234.webp` -> `DSCF1234`. */
export function stemOf(file) {
  return file.replace(/\.[^.]+$/, '');
}

/**
 * Get the images in a gallery directory: every JPEG source, plus any WebP that
 * no longer has a JPEG beside it. Sources are removed once they are converted,
 * so for most photos the WebP is all that is left - and it still needs its
 * rotation and its recorded size checked.
 */
async function getGalleryImages(galleryName) {
  const galleryDir = path.join(IMAGES_DIR, galleryName);
  try {
    const entries = await fs.readdir(galleryDir);
    const sources = entries.filter((file) => IMAGE_EXTENSIONS.includes(path.extname(file)));
    const sourceStems = new Set(sources.map(stemOf));
    const converted = entries.filter(
      (file) => path.extname(file).toLowerCase() === '.webp' && !sourceStems.has(stemOf(file))
    );
    return [...sources, ...converted];
  } catch {
    return [];
  }
}

/** The WebP we serve for a source image, whatever the source's extension. */
export function webpPathFor(imagePath) {
  return imagePath.replace(/\.(jpg|jpeg|webp)$/i, '.webp');
}

/**
 * Check if WebP version exists for an image
 */
async function webpExists(imagePath) {
  const webpPath = webpPathFor(imagePath);
  try {
    await fs.access(webpPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * The size a file displays at, which is not the size it stores: a photo shot
 * in portrait keeps landscape pixels plus an EXIF Orientation tag saying to
 * turn them.
 */
export function displayedSize(metadata) {
  const upright = metadata.autoOrient ?? metadata;
  return { width: upright.width, height: upright.height };
}

/**
 * Encode a source image to WebP with its rotation baked into the pixels.
 *
 * Two things make the rotation stick:
 *
 * - `autoOrient()` applies the source's EXIF Orientation to the pixels, so the
 *   WebP stores the photo the way it is meant to be seen. Without it a portrait
 *   photo is written as the landscape frame the camera stored, and the tag that
 *   said to turn it is dropped with the rest of the metadata - the file then
 *   displays sideways with no way left to tell that it should not.
 * - `withMetadata({ orientation: 1 })` states in the output that the pixels are
 *   already upright, so no browser, OS viewer or photo app re-rotates them.
 *   This is what makes the result hold for a downloaded copy, not just on the
 *   site, and it matches what `scripts/rotate-gallery-images.mjs` writes.
 *
 * The encode goes to a temporary file that is renamed into place. A failed or
 * interrupted encode therefore leaves no half-written `.webp` behind - one
 * would look "already converted" on the next run and be skipped forever.
 *
 * Dimensions come back from the encoder rather than from re-reading the file:
 * libvips caches reads by filename and mtime, so a re-read can hand back the
 * pre-conversion image.
 */
export async function encodeUprightWebP(sharp, sourcePath, webpPath, quality) {
  const tempPath = `${webpPath}.convert-tmp.webp`;

  try {
    const info = await sharp(sourcePath, { failOn: 'error' })
      .autoOrient()
      .webp({ quality, effort: 4 })
      .withMetadata({ orientation: 1 })
      .toFile(tempPath);
    await fs.rename(tempPath, webpPath);
    return { width: info.width, height: info.height };
  } catch (error) {
    await fs.rm(tempPath, { force: true });
    throw error;
  }
}

/**
 * Convert a single image to WebP
 */
export async function convertToWebP(sharp, imagePath, quality, dryRun) {
  const webpPath = webpPathFor(imagePath);

  if (dryRun) {
    console.log(`  [dry-run] Would convert: ${path.basename(imagePath)}`);
    try {
      const metadata = await sharp(imagePath).metadata();
      return { converted: true, webpPath, ...displayedSize(metadata) };
    } catch {
      return { converted: true, webpPath };
    }
  }

  try {
    const originalStat = await fs.stat(imagePath);
    const { width, height } = await encodeUprightWebP(sharp, imagePath, webpPath, quality);
    const webpStat = await fs.stat(webpPath);
    const savings = ((1 - webpStat.size / originalStat.size) * 100).toFixed(1);

    console.log(`  Converted: ${path.basename(imagePath)} -> ${path.basename(webpPath)} (${savings}% smaller)`);
    return { converted: true, webpPath, width, height, originalSize: originalStat.size, webpSize: webpStat.size };
  } catch (error) {
    console.error(`  Error converting ${path.basename(imagePath)}: ${error.message}`);
    return { converted: false, error: error.message };
  }
}

/**
 * Make sure a WebP already on disk is upright.
 *
 * A file that still carries an EXIF Orientation other than 1 shows sideways
 * anywhere the tag is ignored, and the gallery JSON would record the stored
 * size rather than the displayed one. Re-encoding bakes the rotation in and
 * clears the tag, so the invariant "no gallery WebP has Orientation != 1" is
 * enforced on every run instead of being a one-off audit.
 *
 * Returns the file's displayed size either way, so callers can keep the JSON
 * in step with the pixels.
 */
export async function ensureUprightWebP(sharp, webpPath, quality, dryRun) {
  let metadata;
  try {
    metadata = await sharp(webpPath).metadata();
  } catch (error) {
    console.error(`  Error reading ${path.basename(webpPath)}: ${error.message}`);
    return { repaired: false };
  }

  const size = displayedSize(metadata);
  if ((metadata.orientation ?? 1) === 1) {
    return { repaired: false, ...size };
  }

  if (dryRun) {
    console.log(`  [dry-run] Would bake rotation into: ${path.basename(webpPath)} (orientation ${metadata.orientation})`);
    return { repaired: true, ...size };
  }

  try {
    const baked = await encodeUprightWebP(sharp, webpPath, webpPath, quality);
    console.log(
      `  Baked rotation into: ${path.basename(webpPath)} ` +
      `(orientation ${metadata.orientation}, ${metadata.width}x${metadata.height} -> ${baked.width}x${baked.height})`
    );
    return { repaired: true, ...baked };
  } catch (error) {
    console.error(`  Error re-encoding ${path.basename(webpPath)}: ${error.message}`);
    return { repaired: false, ...size };
  }
}

/**
 * Extract EXIF metadata from an image using sharp
 */
async function extractExifMetadata(sharp, imagePath) {
  try {
    const image = sharp(imagePath);
    const metadata = await image.metadata();

    // Parse EXIF buffer - sharp provides raw EXIF, we need to parse it
    // We'll use a simplified approach reading common tags
    const result = {};

    // Try to extract using sharp's stats and metadata
    if (metadata.width && metadata.height) {
      // Image dimensions available
    }

    // For more detailed EXIF, we need to parse the buffer
    // This is a simplified extraction - for full EXIF we'd use exifr or similar
    try {
      const exifr = await importExifr();
      if (exifr) {
        const parsed = await exifr.parse(imagePath, {
          pick: [
            'DateTimeOriginal', 'Make', 'Model', 'LensModel', 'LensMake',
            'FocalLength', 'FNumber', 'ExposureTime', 'ISO',
            'GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef'
          ]
        });

        if (parsed) {
          // Format date
          if (parsed.DateTimeOriginal) {
            const date = parsed.DateTimeOriginal;
            if (date instanceof Date) {
              result.date = formatExifDate(date);
            }
          }

          // Format camera
          const make = parsed.Make?.trim() || '';
          const model = parsed.Model?.trim() || '';
          if (make || model) {
            if (make && model && model.toLowerCase().includes(make.toLowerCase())) {
              result.camera = model;
            } else {
              result.camera = [make, model].filter(Boolean).join(' ');
            }
          }

          // Format lens
          const lensMake = parsed.LensMake?.trim() || '';
          const lensModel = parsed.LensModel?.trim() || '';
          if (lensModel) {
            result.lens = lensModel;
          } else if (lensMake) {
            result.lens = lensMake;
          }

          // Format focal length
          if (parsed.FocalLength) {
            const fl = typeof parsed.FocalLength === 'number' ? parsed.FocalLength : parseFloat(parsed.FocalLength);
            if (!isNaN(fl)) {
              result.focalLength = `${Math.round(fl)}mm`;
            }
          }

          // Format aperture
          if (parsed.FNumber) {
            const fn = typeof parsed.FNumber === 'number' ? parsed.FNumber : parseFloat(parsed.FNumber);
            if (!isNaN(fn)) {
              result.aperture = `f/${fn % 1 === 0 ? fn : fn.toFixed(1)}`;
            }
          }

          // Format shutter speed
          if (parsed.ExposureTime) {
            const exp = parsed.ExposureTime;
            if (exp < 1) {
              result.shutterSpeed = `1/${Math.round(1 / exp)}s`;
            } else {
              result.shutterSpeed = `${exp.toFixed(1)}s`;
            }
          }

          // Format ISO
          if (parsed.ISO) {
            result.iso = `ISO ${parsed.ISO}`;
          }

          // GPS coordinates
          if (parsed.GPSLatitude !== undefined && parsed.GPSLongitude !== undefined) {
            const latitude = normalizeGpsCoordinate(parsed.GPSLatitude, parsed.GPSLatitudeRef);
            const longitude = normalizeGpsCoordinate(parsed.GPSLongitude, parsed.GPSLongitudeRef);
            if (latitude !== undefined && longitude !== undefined) {
              result.latitude = latitude;
              result.longitude = longitude;
            }
          }
        }
      }
    } catch (exifrError) {
      // exifr not available or parse failed, continue without detailed EXIF
      console.log(`  Note: Could not parse detailed EXIF for ${path.basename(imagePath)}`);
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch (error) {
    console.error(`  Error extracting EXIF from ${path.basename(imagePath)}: ${error.message}`);
    return null;
  }
}

/**
 * Format EXIF date to standard format
 */
function formatExifDate(date) {
  const pad = (n) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}:${pad(date.getMonth() + 1)}:${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * Normalize EXIF GPS values to decimal degrees.
 * Supports decimal numbers, numeric strings, DMS arrays, and rational objects.
 */
function normalizeGpsCoordinate(value, ref) {
  const parseNumber = (input) => {
    if (typeof input === 'number') {
      return Number.isFinite(input) ? input : NaN;
    }
    if (typeof input === 'string') {
      const parsed = Number.parseFloat(input.trim());
      return Number.isFinite(parsed) ? parsed : NaN;
    }
    if (input && typeof input === 'object') {
      const numerator = Number(input.numerator);
      const denominator = Number(input.denominator);
      if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
        return numerator / denominator;
      }
    }
    return NaN;
  };

  let decimal;
  if (Array.isArray(value)) {
    const degrees = parseNumber(value[0]);
    const minutes = parseNumber(value[1] ?? 0);
    const seconds = parseNumber(value[2] ?? 0);
    if (![degrees, minutes, seconds].every(Number.isFinite)) {
      return undefined;
    }
    decimal = Math.abs(degrees) + (minutes / 60) + (seconds / 3600);
    if (degrees < 0) {
      decimal = -decimal;
    }
  } else {
    decimal = parseNumber(value);
    if (!Number.isFinite(decimal)) {
      return undefined;
    }
  }

  if (typeof ref === 'string') {
    const upperRef = ref.toUpperCase();
    if (upperRef === 'S' || upperRef === 'W') {
      decimal = -Math.abs(decimal);
    } else if (upperRef === 'N' || upperRef === 'E') {
      decimal = Math.abs(decimal);
    }
  }

  return Number.isFinite(decimal) ? decimal : undefined;
}

/**
 * Try to import exifr for EXIF parsing
 */
async function importExifr() {
  try {
    const exifr = await import('exifr');
    return exifr.default || exifr;
  } catch {
    console.log('Installing exifr for EXIF extraction...');
    await new Promise((resolve, reject) => {
      const proc = spawn('npm', ['install', 'exifr', '--save-dev'], {
        cwd: ROOT_DIR,
        stdio: 'inherit',
        shell: true,
      });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`npm install exifr failed with code ${code}`));
      });
    });
    try {
      const exifr = await import('exifr');
      return exifr.default || exifr;
    } catch {
      return null;
    }
  }
}

/**
 * Fetch a city/location name from Google Maps Geocoding API for a given language.
 * Returns the name string, or null if not found.
 */
async function geocodeGoogle(normalizedLatitude, normalizedLongitude, googleApiKey, language) {
  const langParam = language ? `&language=${language}` : '';
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${normalizedLatitude},${normalizedLongitude}&key=${googleApiKey}${langParam}`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.status === 'OK' && data.results?.length > 0) {
    for (const result of data.results) {
      for (const component of result.address_components || []) {
        if (component.types?.some(t => ['locality', 'postal_town', 'administrative_area_level_3', 'administrative_area_level_2'].includes(t))) {
          return component.long_name;
        }
      }
    }
  }
  return null;
}

/**
 * Reverse geocode coordinates to get city/location name in local language and English.
 * Returns { local, en } or null if nothing could be resolved.
 */
async function reverseGeocode(latitude, longitude, cache) {
  const normalizedLatitude = normalizeGpsCoordinate(latitude);
  const normalizedLongitude = normalizeGpsCoordinate(longitude);

  if (normalizedLatitude === undefined || normalizedLongitude === undefined) {
    return null;
  }

  const cacheKey = `${normalizedLatitude.toFixed(4)},${normalizedLongitude.toFixed(4)}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const googleApiKey = process.env.PUBLIC_GOOGLE_MAPS_EMBED_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!googleApiKey) {
    cache.set(cacheKey, null);
    return null;
  }

  const [localResult, enResult] = await Promise.allSettled([
    geocodeGoogle(normalizedLatitude, normalizedLongitude, googleApiKey, null),
    geocodeGoogle(normalizedLatitude, normalizedLongitude, googleApiKey, 'en'),
  ]);

  if (localResult.status === 'rejected') {
    console.log(`  Geocoding error (Google): ${localResult.reason?.message}`);
  }
  if (enResult.status === 'rejected') {
    console.log(`  Geocoding error (Google, en): ${enResult.reason?.message}`);
  }

  const localName = localResult.status === 'fulfilled' ? localResult.value : null;
  const enName = enResult.status === 'fulfilled' ? enResult.value : null;

  if (localName) {
    // Only provide an English translation when the local name uses a non-Latin
    // script (e.g. Japanese, Arabic, Cyrillic). Latin-based names like
    // "København" or "Köln" are already readable without a translation.
    const needsTranslation = /[^\p{Script=Latin}\p{Number}\p{Punctuation}\p{White_Space}]/u.test(localName);
    const result = { local: localName, en: needsTranslation && enName && enName !== localName ? enName : null };
    cache.set(cacheKey, result);
    return result;
  }

  cache.set(cacheKey, null);
  return null;
}

/**
 * Create a new gallery JSON file
 */
async function createGalleryJson(galleryName, dryRun) {
  const jsonPath = path.join(GALLERIES_DIR, `${galleryName}.json`);

  // Format gallery name for display (capitalize, replace hyphens)
  const title = galleryName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const galleryData = {
    title,
    location: title,
    publishedDate: new Date().toISOString().split('T')[0],
    description: `Photos from ${title}`,
    images: []
  };

  if (dryRun) {
    console.log(`  [dry-run] Would create gallery JSON: ${galleryName}.json`);
    return galleryData;
  }

  await fs.writeFile(jsonPath, JSON.stringify(galleryData, null, 2) + '\n');
  console.log(`  Created new gallery JSON: ${galleryName}.json`);

  return galleryData;
}

/**
 * Create a gallery description markdown file
 */
async function createGalleryDescription(galleryName, dryRun) {
  const mdPath = path.join(GALLERY_DESCRIPTIONS_DIR, `${galleryName}.md`);

  try {
    await fs.access(mdPath);
    return; // Already exists
  } catch {
    // Doesn't exist, create it
  }

  const title = galleryName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const content = `---
description: Photos from ${title}
---

Photo journal from ${title}.
`;

  if (dryRun) {
    console.log(`  [dry-run] Would create gallery description: ${galleryName}.md`);
    return;
  }

  await fs.writeFile(mdPath, content);
  console.log(`  Created gallery description: ${galleryName}.md`);
}

/**
 * Check if a gallery page exists, create if needed
 */
async function ensureGalleryPage(galleryName, dryRun) {
  const pagePath = path.join(ROOT_DIR, 'src', 'pages', `${galleryName}.astro`);

  try {
    await fs.access(pagePath);
    return; // Already exists
  } catch {
    // Doesn't exist, create it
  }

  const title = galleryName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const content = `---
import Layout from '../layouts/Layout.astro';
import Gallery from '../components/Gallery.astro';
import { getEntry } from 'astro:content';

const gallery = await getEntry('galleries', '${galleryName}');
const descriptionEntry = await getEntry('galleryDescriptions', '${galleryName}');
const description = descriptionEntry?.body || gallery?.data.description || 'Photo gallery';
---

<Layout
  title="${title}"
  description={description}
  currentPath="/${galleryName}"
  ogImage={gallery?.data.images?.[0]?.src}
  ogImageAlt={gallery?.data.images?.[0]?.alt}
>
  {gallery && <Gallery title={gallery.data.title} images={gallery.data.images} />}
</Layout>
`;

  if (dryRun) {
    console.log(`  [dry-run] Would create gallery page: ${galleryName}.astro`);
    return;
  }

  await fs.writeFile(pagePath, content);
  console.log(`  Created gallery page: ${galleryName}.astro`);
}

/**
 * Load or create gallery JSON data
 */
async function loadOrCreateGalleryJson(galleryName, dryRun) {
  const jsonPath = path.join(GALLERIES_DIR, `${galleryName}.json`);

  try {
    await fs.access(jsonPath);
    const content = await fs.readFile(jsonPath, 'utf8');
    return { data: JSON.parse(content), isNew: false };
  } catch {
    // JSON doesn't exist, create it
    const data = await createGalleryJson(galleryName, dryRun);
    await createGalleryDescription(galleryName, dryRun);
    await ensureGalleryPage(galleryName, dryRun);
    return { data, isNew: true };
  }
}

/**
 * Process a single gallery
 */
async function processGallery(sharp, galleryName, options, geocodeCache) {
  console.log(`\nProcessing gallery: ${galleryName}`);

  const images = await getGalleryImages(galleryName);
  if (images.length === 0) {
    console.log(`  No images found`);
    return { converted: 0, skipped: 0, registered: 0, repaired: 0, resynced: 0, totalOriginalSize: 0, totalWebpSize: 0 };
  }

  console.log(`  Found ${images.length} images`);

  // Load or create gallery JSON
  const { data: galleryData, isNew } = await loadOrCreateGalleryJson(galleryName, options.dryRun);

  // Build a map of existing images by filename stem: an entry's `src` often
  // still points at a `.jpg` that has since been replaced by its `.webp`.
  const existingImages = new Map();
  for (const img of galleryData.images || []) {
    for (const key of [img.src, img.webpSrc]) {
      if (key) existingImages.set(stemOf(key.split('/').pop()), img);
    }
  }

  let converted = 0;
  let skipped = 0;
  let registered = 0;
  let repaired = 0;
  let resynced = 0;
  let totalOriginalSize = 0;
  let totalWebpSize = 0;
  let jsonUpdated = false;

  for (const imageFile of images) {
    const imagePath = path.join(IMAGES_DIR, galleryName, imageFile);
    const imageSrc = `/images/${galleryName}/${imageFile}`;
    const webpSrc = webpPathFor(imageSrc);
    const webpPath = webpPathFor(imagePath);
    // A JPEG still waiting to be converted, as against a WebP whose source has
    // already been removed.
    const isSource = IMAGE_EXTENSIONS.includes(path.extname(imageFile));

    // Check if image is already registered
    const existingImage = existingImages.get(stemOf(imageFile));
    const hasExistingExif = !!(existingImage?.exif && Object.keys(existingImage.exif).length > 0);
    const missingLocationWithGps = !!(
      existingImage?.exif &&
      existingImage.exif.latitude !== undefined &&
      existingImage.exif.longitude !== undefined &&
      !existingImage.exif.location &&
      !options.skipGeocode
    );
    const needsRegistration = !existingImage || options.force || !hasExistingExif || missingLocationWithGps;
    const needsWebP = isSource && !options.skipWebp && (options.force || !(await webpExists(imagePath)));

    // The size the WebP we serve displays at, filled in by whichever step last
    // touched the file, so the JSON can be recorded from the pixels themselves.
    let displayed = null;

    // Convert to WebP if needed
    if (needsWebP) {
      const result = await convertToWebP(sharp, imagePath, options.quality, options.dryRun);
      if (result.converted) {
        converted++;
        if (result.width && result.height) {
          displayed = { width: result.width, height: result.height };
        }
        if (result.originalSize) {
          totalOriginalSize += result.originalSize;
          totalWebpSize += result.webpSize;
        }
      }
    } else if (!options.skipWebp) {
      skipped++;
      // The WebP is already there. Make sure its rotation is baked into the
      // pixels rather than left to an EXIF tag, which not every viewer honours
      // and which a re-encode would drop.
      if (await webpExists(imagePath)) {
        const upright = await ensureUprightWebP(sharp, webpPath, options.quality, options.dryRun);
        if (upright.repaired) repaired++;
        if (upright.width && upright.height) {
          displayed = { width: upright.width, height: upright.height };
        }
      }
    }

    // Register image and extract metadata if needed
    if (needsRegistration) {
      console.log(`  Processing metadata: ${imageFile}`);

      // Extract EXIF metadata
      const exif = await extractExifMetadata(sharp, imagePath);

      // Reverse geocode if we have coordinates and location isn't set
      if (exif?.latitude !== undefined && exif?.longitude !== undefined && !exif.location && !options.skipGeocode) {
        const geocoded = await reverseGeocode(exif.latitude, exif.longitude, geocodeCache);
        if (geocoded) {
          exif.location = geocoded.local;
          if (geocoded.en) {
            exif.locationEn = geocoded.en;
          }
          console.log(`    Location: ${geocoded.local}${geocoded.en ? ` (${geocoded.en})` : ''}`);
        }
      }

      // Get image dimensions for CLS prevention. Record the *displayed* size,
      // read from the WebP we actually serve - its rotation is baked in, so
      // this is the size the browser lays out - and fall back to the
      // auto-oriented source when there is no WebP yet.
      let width = displayed?.width;
      let height = displayed?.height;
      if (!width || !height) {
        try {
          const measured = (await webpExists(imagePath)) ? webpPath : imagePath;
          const metadata = await sharp(measured).metadata();
          ({ width, height } = displayedSize(metadata));
        } catch (err) {
          console.log(`    Warning: Could not get dimensions for ${imageFile}`);
        }
      }

      // Build image entry. An entry that already exists keeps its `src` - for a
      // photo whose JPEG has been removed, that path is the legacy one the rest
      // of the site still resolves from - and keeps its `alt`, which may have
      // been written by hand and is not ours to replace with a placeholder.
      const imageEntry = {
        ...(!existingImage || isSource ? { src: imageSrc } : {}),
        ...(existingImage?.alt ? {} : { alt: `${galleryData.title} photo` }),
      };

      // Add dimensions if available (critical for CLS)
      if (width && height) {
        imageEntry.width = width;
        imageEntry.height = height;
      }

      // Add webpSrc if WebP exists
      try {
        await fs.access(webpPath);
        imageEntry.webpSrc = webpSrc;
      } catch {
        // WebP doesn't exist yet
      }

      // Add EXIF data if available
      if (exif && Object.keys(exif).length > 0) {
        imageEntry.exif = exif;
      }

      // Update or add image to gallery
      if (existingImage) {
        // Update existing entry
        Object.assign(existingImage, imageEntry);
      } else {
        // Add new entry
        galleryData.images.push(imageEntry);
      }

      registered++;
      jsonUpdated = true;
    } else {
      // Just update webpSrc if needed
      if (existingImage) {
        try {
          await fs.access(webpPath);
          if (existingImage.webpSrc !== webpSrc) {
            existingImage.webpSrc = webpSrc;
            jsonUpdated = true;
          }
        } catch {
          if (existingImage.webpSrc) {
            delete existingImage.webpSrc;
            jsonUpdated = true;
          }
        }

        // Keep the recorded size in step with the file on disk: a photo whose
        // rotation is baked into the pixels is no longer the shape the JSON
        // was written from, and the grid would reserve the wrong space.
        if (
          displayed?.width && displayed?.height &&
          (existingImage.width !== displayed.width || existingImage.height !== displayed.height)
        ) {
          console.log(
            `  Dimensions: ${imageFile} ` +
            `${existingImage.width}x${existingImage.height} -> ${displayed.width}x${displayed.height}`
          );
          existingImage.width = displayed.width;
          existingImage.height = displayed.height;
          resynced++;
          jsonUpdated = true;
        }
      }
    }
  }

  // Save updated gallery JSON
  if (jsonUpdated && !options.dryRun) {
    const jsonPath = path.join(GALLERIES_DIR, `${galleryName}.json`);
    await fs.writeFile(jsonPath, JSON.stringify(galleryData, null, 2) + '\n');
    console.log(`  Updated gallery JSON with ${registered} new/updated images`);
  } else if (jsonUpdated && options.dryRun) {
    console.log(`  [dry-run] Would update gallery JSON with ${registered} new/updated images`);
  }

  return { converted, skipped, registered, repaired, resynced, totalOriginalSize, totalWebpSize };
}

/**
 * Main entry point
 */
async function main() {
  await loadEnv();
  const options = parseArgs();

  console.log('Gallery Image Processor');
  console.log('=======================');
  console.log(`Quality: ${options.quality}`);
  console.log(`Force: ${options.force}`);
  console.log(`Dry run: ${options.dryRun}`);
  console.log(`Skip WebP: ${options.skipWebp}`);
  console.log(`Skip geocode: ${options.skipGeocode}`);

  const sharp = await getSharp();
  const galleries = await getGalleryDirs(options.gallery);
  const geocodeCache = new Map();

  console.log(`\nGalleries to process: ${galleries.join(', ')}`);

  let totalConverted = 0;
  let totalSkipped = 0;
  let totalRegistered = 0;
  let totalRepaired = 0;
  let totalResynced = 0;
  let grandTotalOriginal = 0;
  let grandTotalWebp = 0;

  for (const gallery of galleries) {
    const result = await processGallery(sharp, gallery, options, geocodeCache);
    totalConverted += result.converted;
    totalSkipped += result.skipped;
    totalRegistered += result.registered;
    totalRepaired += result.repaired;
    totalResynced += result.resynced;
    grandTotalOriginal += result.totalOriginalSize;
    grandTotalWebp += result.totalWebpSize;
  }

  console.log('\n=======================');
  console.log('Summary');
  console.log('=======================');
  console.log(`Images registered/updated: ${totalRegistered}`);
  console.log(`WebP converted: ${totalConverted}`);
  console.log(`WebP skipped (exists): ${totalSkipped}`);
  console.log(`Rotation baked into existing WebP: ${totalRepaired}`);
  console.log(`Dimensions re-synced in JSON: ${totalResynced}`);

  if (grandTotalOriginal > 0) {
    const savedBytes = grandTotalOriginal - grandTotalWebp;
    const savedMB = (savedBytes / 1024 / 1024).toFixed(2);
    const savedPercent = ((savedBytes / grandTotalOriginal) * 100).toFixed(1);
    console.log(`Space saved: ${savedMB} MB (${savedPercent}%)`);
  }
}

// Importing this module (the test suite does) must not start a run.
const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}
