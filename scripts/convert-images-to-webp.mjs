#!/usr/bin/env node
/**
 * Convert gallery images to WebP format while maintaining JPEG originals as fallback.
 *
 * This script:
 * - Finds all JPEG images in gallery directories
 * - Converts them to WebP format with quality optimization
 * - Updates gallery JSON files to include webpSrc references
 * - Extracts EXIF metadata using the existing Python script if needed
 *
 * Usage:
 *   node scripts/convert-images-to-webp.mjs [options]
 *
 * Options:
 *   --gallery <name>   Process only a specific gallery (e.g., japan, copenhagen)
 *   --force            Re-convert images even if WebP already exists
 *   --quality <n>      WebP quality (1-100, default: 80)
 *   --dry-run          Show what would be done without making changes
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(ROOT_DIR, 'public', 'images');
const GALLERIES_DIR = path.join(ROOT_DIR, 'src', 'content', 'galleries');

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.JPG', '.JPEG'];
const DEFAULT_QUALITY = 80;

/**
 * Dynamically import sharp, installing it if necessary
 */
async function getSharp() {
  try {
    const sharp = await import('sharp');
    return sharp.default;
  } catch (error) {
    console.log('Installing sharp for image conversion...');
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
      case '--help':
        console.log(`
Usage: node scripts/convert-images-to-webp.mjs [options]

Options:
  --gallery <name>   Process only a specific gallery (e.g., japan, copenhagen)
  --force            Re-convert images even if WebP already exists
  --quality <n>      WebP quality (1-100, default: 80)
  --dry-run          Show what would be done without making changes
  --help             Show this help message
`);
        process.exit(0);
    }
  }

  return options;
}

/**
 * Get all gallery directories
 */
async function getGalleryDirs(specificGallery = null) {
  const entries = await fs.readdir(IMAGES_DIR, { withFileTypes: true });
  const dirs = entries
    .filter((e) => e.isDirectory())
    .filter((e) => !['blog', 'about'].includes(e.name)) // Exclude non-gallery dirs
    .map((e) => e.name);

  if (specificGallery) {
    if (!dirs.includes(specificGallery)) {
      throw new Error(`Gallery '${specificGallery}' not found in ${IMAGES_DIR}`);
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
  const entries = await fs.readdir(galleryDir);

  return entries.filter((file) => {
    const ext = path.extname(file);
    return IMAGE_EXTENSIONS.includes(ext);
  });
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
 * Update gallery JSON to include webpSrc for images
 */
async function updateGalleryJson(galleryName, dryRun) {
  const jsonPath = path.join(GALLERIES_DIR, `${galleryName}.json`);

  try {
    await fs.access(jsonPath);
  } catch {
    console.log(`  No JSON file found for gallery: ${galleryName}`);
    return { updated: false };
  }

  const content = await fs.readFile(jsonPath, 'utf8');
  const data = JSON.parse(content);

  if (!Array.isArray(data.images)) {
    return { updated: false };
  }

  let updated = false;
  for (const image of data.images) {
    if (!image.src) continue;

    // Generate webpSrc from src
    const webpSrc = image.src.replace(/\.(jpg|jpeg)$/i, '.webp');

    // Check if WebP file actually exists
    const webpPath = path.join(ROOT_DIR, 'public', webpSrc);
    try {
      await fs.access(webpPath);
      if (image.webpSrc !== webpSrc) {
        image.webpSrc = webpSrc;
        updated = true;
      }
    } catch {
      // WebP doesn't exist, remove webpSrc if present
      if (image.webpSrc) {
        delete image.webpSrc;
        updated = true;
      }
    }
  }

  if (updated && !dryRun) {
    await fs.writeFile(jsonPath, JSON.stringify(data, null, 2) + '\n');
    console.log(`  Updated gallery JSON: ${galleryName}.json`);
  } else if (updated && dryRun) {
    console.log(`  [dry-run] Would update gallery JSON: ${galleryName}.json`);
  }

  return { updated };
}

/**
 * Process a single gallery
 */
async function processGallery(sharp, galleryName, options) {
  console.log(`\nProcessing gallery: ${galleryName}`);

  const images = await getGalleryImages(galleryName);
  console.log(`  Found ${images.length} images`);

  let converted = 0;
  let skipped = 0;
  let totalOriginalSize = 0;
  let totalWebpSize = 0;

  for (const image of images) {
    const imagePath = path.join(IMAGES_DIR, galleryName, image);

    if (!options.force && await webpExists(imagePath)) {
      skipped++;
      continue;
    }

    const result = await convertToWebP(sharp, imagePath, options.quality, options.dryRun);
    if (result.converted) {
      converted++;
      if (result.originalSize) {
        totalOriginalSize += result.originalSize;
        totalWebpSize += result.webpSize;
      }
    }
  }

  // Update gallery JSON
  await updateGalleryJson(galleryName, options.dryRun);

  return { converted, skipped, totalOriginalSize, totalWebpSize };
}

/**
 * Main entry point
 */
async function main() {
  const options = parseArgs();

  console.log('WebP Image Converter');
  console.log('====================');
  console.log(`Quality: ${options.quality}`);
  console.log(`Force: ${options.force}`);
  console.log(`Dry run: ${options.dryRun}`);

  const sharp = await getSharp();
  const galleries = await getGalleryDirs(options.gallery);

  console.log(`\nGalleries to process: ${galleries.join(', ')}`);

  let totalConverted = 0;
  let totalSkipped = 0;
  let grandTotalOriginal = 0;
  let grandTotalWebp = 0;

  for (const gallery of galleries) {
    const result = await processGallery(sharp, gallery, options);
    totalConverted += result.converted;
    totalSkipped += result.skipped;
    grandTotalOriginal += result.totalOriginalSize;
    grandTotalWebp += result.totalWebpSize;
  }

  console.log('\n====================');
  console.log('Summary');
  console.log('====================');
  console.log(`Converted: ${totalConverted} images`);
  console.log(`Skipped (already exists): ${totalSkipped} images`);

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
