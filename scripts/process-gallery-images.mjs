#!/usr/bin/env node
/**
 * Process gallery images: convert to WebP, extract EXIF metadata, and register in gallery JSON.
 *
 * This script:
 * - Finds all JPEG images in gallery directories
 * - Converts them to WebP format with quality optimization
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
import { fileURLToPath } from 'node:url';
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
 * Dynamically import sharp, installing it if necessary
 */
async function getSharp() {
  try {
    const sharp = await import('sharp');
    return sharp.default;
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
    return sharp.default;
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

/**
 * Get all JPEG images in a gallery directory
 */
async function getGalleryImages(galleryName) {
  const galleryDir = path.join(IMAGES_DIR, galleryName);
  try {
    const entries = await fs.readdir(galleryDir);
    return entries.filter((file) => {
      const ext = path.extname(file);
      return IMAGE_EXTENSIONS.includes(ext);
    });
  } catch {
    return [];
  }
}

/**
 * Check if WebP version exists for an image
 */
async function webpExists(imagePath) {
  const webpPath = imagePath.replace(/\.(jpg|jpeg)$/i, '.webp');
  try {
    await fs.access(webpPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert a single image to WebP
 */
async function convertToWebP(sharp, imagePath, quality, dryRun) {
  const webpPath = imagePath.replace(/\.(jpg|jpeg)$/i, '.webp');

  if (dryRun) {
    console.log(`  [dry-run] Would convert: ${path.basename(imagePath)}`);
    return { converted: true, webpPath };
  }

  try {
    await sharp(imagePath)
      .webp({ quality, effort: 4 })
      .toFile(webpPath);

    const originalStat = await fs.stat(imagePath);
    const webpStat = await fs.stat(webpPath);
    const savings = ((1 - webpStat.size / originalStat.size) * 100).toFixed(1);

    console.log(`  Converted: ${path.basename(imagePath)} -> ${path.basename(webpPath)} (${savings}% smaller)`);
    return { converted: true, webpPath, originalSize: originalStat.size, webpSize: webpStat.size };
  } catch (error) {
    console.error(`  Error converting ${path.basename(imagePath)}: ${error.message}`);
    return { converted: false, error: error.message };
  }
}

/**
 * Extract EXIF metadata from an image using sharp
 */
async function extractExifMetadata(sharp, imagePath) {
  try {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    const exifData = metadata.exif;

    if (!exifData) {
      return null;
    }

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
            result.latitude = parsed.GPSLatitude;
            result.longitude = parsed.GPSLongitude;
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
 * Reverse geocode coordinates to get city/location name
 */
async function reverseGeocode(latitude, longitude, cache) {
  const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  // Try Google Maps API first
  const googleApiKey = process.env.PUBLIC_GOOGLE_MAPS_EMBED_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

  if (googleApiKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${googleApiKey}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.results?.length > 0) {
        for (const result of data.results) {
          for (const component of result.address_components || []) {
            if (component.types?.some(t => ['locality', 'postal_town', 'administrative_area_level_3', 'administrative_area_level_2'].includes(t))) {
              const location = component.long_name;
              cache.set(cacheKey, location);
              return location;
            }
          }
        }
      }
    } catch (error) {
      console.log(`  Geocoding error (Google): ${error.message}`);
    }
  }

  // Fallback to Nominatim (OpenStreetMap)
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=10&addressdetails=1`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'samthegeek-gallery-processor' }
    });
    const data = await response.json();

    const address = data.address || {};
    const location = address.city || address.town || address.village || address.county;

    if (location) {
      cache.set(cacheKey, location);
      // Rate limit for Nominatim
      await new Promise(resolve => setTimeout(resolve, 1000));
      return location;
    }
  } catch (error) {
    console.log(`  Geocoding error (Nominatim): ${error.message}`);
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
    return { converted: 0, skipped: 0, registered: 0, totalOriginalSize: 0, totalWebpSize: 0 };
  }

  console.log(`  Found ${images.length} images`);

  // Load or create gallery JSON
  const { data: galleryData, isNew } = await loadOrCreateGalleryJson(galleryName, options.dryRun);

  // Build a map of existing images by src
  const existingImages = new Map();
  for (const img of galleryData.images || []) {
    if (img.src) {
      const filename = img.src.split('/').pop();
      existingImages.set(filename, img);
    }
  }

  let converted = 0;
  let skipped = 0;
  let registered = 0;
  let totalOriginalSize = 0;
  let totalWebpSize = 0;
  let jsonUpdated = false;

  for (const imageFile of images) {
    const imagePath = path.join(IMAGES_DIR, galleryName, imageFile);
    const imageSrc = `/images/${galleryName}/${imageFile}`;
    const webpSrc = imageSrc.replace(/\.(jpg|jpeg)$/i, '.webp');

    // Check if image is already registered
    const existingImage = existingImages.get(imageFile);
    const needsRegistration = !existingImage || options.force;
    const needsWebP = !options.skipWebp && (options.force || !(await webpExists(imagePath)));

    // Convert to WebP if needed
    if (needsWebP) {
      const result = await convertToWebP(sharp, imagePath, options.quality, options.dryRun);
      if (result.converted) {
        converted++;
        if (result.originalSize) {
          totalOriginalSize += result.originalSize;
          totalWebpSize += result.webpSize;
        }
      }
    } else if (!options.skipWebp) {
      skipped++;
    }

    // Register image and extract metadata if needed
    if (needsRegistration) {
      console.log(`  Processing metadata: ${imageFile}`);

      // Extract EXIF metadata
      const exif = await extractExifMetadata(sharp, imagePath);

      // Reverse geocode if we have coordinates and location isn't set
      if (exif?.latitude && exif?.longitude && !exif.location && !options.skipGeocode) {
        const location = await reverseGeocode(exif.latitude, exif.longitude, geocodeCache);
        if (location) {
          exif.location = location;
          console.log(`    Location: ${location}`);
        }
      }

      // Build image entry
      const imageEntry = {
        src: imageSrc,
        alt: `${galleryData.title} photo`,
      };

      // Add webpSrc if WebP exists
      const webpPath = imagePath.replace(/\.(jpg|jpeg)$/i, '.webp');
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
        const webpPath = imagePath.replace(/\.(jpg|jpeg)$/i, '.webp');
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

  return { converted, skipped, registered, totalOriginalSize, totalWebpSize };
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
  let grandTotalOriginal = 0;
  let grandTotalWebp = 0;

  for (const gallery of galleries) {
    const result = await processGallery(sharp, gallery, options, geocodeCache);
    totalConverted += result.converted;
    totalSkipped += result.skipped;
    totalRegistered += result.registered;
    grandTotalOriginal += result.totalOriginalSize;
    grandTotalWebp += result.totalWebpSize;
  }

  console.log('\n=======================');
  console.log('Summary');
  console.log('=======================');
  console.log(`Images registered/updated: ${totalRegistered}`);
  console.log(`WebP converted: ${totalConverted}`);
  console.log(`WebP skipped (exists): ${totalSkipped}`);

  if (grandTotalOriginal > 0) {
    const savedBytes = grandTotalOriginal - grandTotalWebp;
    const savedMB = (savedBytes / 1024 / 1024).toFixed(2);
    const savedPercent = ((savedBytes / grandTotalOriginal) * 100).toFixed(1);
    console.log(`Space saved: ${savedMB} MB (${savedPercent}%)`);
  }
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
