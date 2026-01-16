# Gallery Image Scripts

This directory contains scripts for downloading, processing, and managing gallery images.

## Quick Start: Adding New Photos

The recommended workflow for adding photos:

1. **Drop JPEGs** into `public/images/<gallery-name>/` (create folder for new galleries)
2. **Commit and merge** to `main`
3. **GitHub Actions** automatically processes images and opens a PR

Or run locally:
```bash
node scripts/process-gallery-images.mjs
```

## Image Processing Script (Node.js - Recommended)

### scripts/process-gallery-images.mjs

The main image processing script that handles the complete lifecycle:

**Features:**
- Converts JPEG images to WebP format (with JPEG fallback for older browsers)
- Extracts EXIF metadata (camera, lens, focal length, aperture, shutter speed, ISO, GPS)
- Reverse geocodes GPS coordinates to city names
- Registers new images in gallery JSON files
- Creates new gallery JSON, description, and page files for new gallery folders
- Updates existing images with webpSrc references

**Usage:**
```bash
# Process all galleries
node scripts/process-gallery-images.mjs

# Process specific gallery
node scripts/process-gallery-images.mjs --gallery copenhagen

# Dry run (show what would be done)
node scripts/process-gallery-images.mjs --dry-run

# Force re-process all images
node scripts/process-gallery-images.mjs --force

# Custom WebP quality (1-100, default 80)
node scripts/process-gallery-images.mjs --quality 85

# Skip WebP conversion (metadata only)
node scripts/process-gallery-images.mjs --skip-webp

# Skip reverse geocoding
node scripts/process-gallery-images.mjs --skip-geocode
```

**Dependencies (auto-installed):**
- `sharp` - Image processing and WebP conversion
- `exifr` - EXIF metadata extraction

**Environment Variables:**
- `PUBLIC_GOOGLE_MAPS_EMBED_API_KEY` - Google Maps API key for reverse geocoding (optional, falls back to Nominatim)

## GitHub Actions Workflows

### Process New Photos (Automatic)

Triggered when JPEGs are merged to `main`. The workflow:
1. Detects new JPEG images
2. Converts to WebP format
3. Extracts EXIF metadata
4. Registers in gallery JSON
5. Creates gallery page if new folder
6. Opens a PR with processed files

### Process All Gallery Images (Manual)

Trigger from GitHub Actions UI to process all existing images. Options:
- Quality setting (1-100)
- Force re-processing
- Gallery filter
- Skip WebP/geocoding

## Legacy Python Scripts

## Source URL List

All gallery image URLs are stored in `ALL_GALLERY_URLS.txt` at the repository root. The download script reads this file so it can reliably fetch the known images without scraping live pages.

## Available Scripts (Python)

### scripts/download_gallery_images.py (Python - URL List)
Downloads images based on `ALL_GALLERY_URLS.txt` and writes them into the `public/images/<gallery>/` structure.

Legacy scraping/check scripts have been removed to keep the workflow focused on the curated URL list.

```bash
python3 scripts/download_gallery_images.py
```

Optional arguments:

```bash
python3 scripts/download_gallery_images.py --urls-file ALL_GALLERY_URLS.txt --images-dir public/images
```

This is the canonical download tool for gallery images. It uses the curated URL list rather than scraping HTML pages.

### scripts/rename_existing_gallery_images.py (Python - Rename Existing Galleries)
Renames all existing images under `public/images/*` using EXIF data and optional Google Maps reverse geocoding.

Pattern: `<gallery>_<city>_<DDMMYYYY>_<sequence>.<ext>`
- `gallery` matches the folder name
- `city` from EXIF GPS (Google Maps Geocoding API), omitted if unavailable
- `DDMMYYYY` from EXIF DateTimeOriginal, omitted if unavailable
- `sequence` only added when multiple files share the same base name

Requirements:
```bash
pip install exifread
export PUBLIC_GOOGLE_MAPS_EMBED_API_KEY="your_key_here" # optional for city lookup
```

Usage:
```bash
python3 scripts/rename_existing_gallery_images.py
```

Optional flags:
```bash
python3 scripts/rename_existing_gallery_images.py --dry-run
python3 scripts/rename_existing_gallery_images.py --no-update-json
```

### scripts/rename_new_gallery_images.py (Python - Import/Rename New Gallery)
Imports a new batch of photos and renames them with the same EXIF-based rules.

Flow:
1. Prompt for the source folder
2. Choose existing gallery or create a new one
3. Move files into `public/images/<gallery>/`
4. Rename using EXIF metadata
5. Create/update the gallery JSON file in `src/content/galleries/`
6. Extract EXIF metadata into the gallery JSON (date/camera/lens/GPS)

Requirements:
```bash
pip install exifread
export PUBLIC_GOOGLE_MAPS_EMBED_API_KEY="your_key_here" # optional for city lookup
```

Usage:
```bash
python3 scripts/rename_new_gallery_images.py
```

### scripts/extract_gallery_exif.py (Python - EXIF Metadata)
Extracts EXIF metadata into a gallery JSON file for use in the lightbox info panel.

Requirements:
```bash
pip install exifread
export PUBLIC_GOOGLE_MAPS_EMBED_API_KEY="your_key_here" # optional for location lookup
```

Usage:
```bash
python3 scripts/extract_gallery_exif.py copenhagen
```

## What These Scripts Do

Each script downloads images from the following galleries:

| Gallery       | Live URL                              | Local Directory                    |
|---------------|---------------------------------------|------------------------------------|
| Italy         | https://samthegeek.net/italy         | public/images/italy/               |
| Los Angeles   | https://samthegeek.net/los-angeles19 | public/images/los-angeles/         |
| France        | https://samthegeek.net/france18      | public/images/france/              |
| Japan         | https://samthegeek.net/japan18       | public/images/japan/               |
| Canada        | https://samthegeek.net/canada17      | public/images/canada/              |
| Elsewhere     | https://samthegeek.net/elsewhere     | public/images/elsewhere/           |

## Features

- Progress reporting for each gallery
- Skips already downloaded images
- Handles errors gracefully
- Final summary with image counts per gallery

## Output

The scripts will:
1. Create subdirectories under `public/images/` if they don't exist
2. Download each image with its original filename
3. Report progress during download
4. Provide a final summary with image counts

## Troubleshooting

If a gallery fails to download:
1. Check your internet connection
2. Verify the live site URLs are still valid
3. Check that you have write permissions to the `public/images/` directory
4. Some galleries may use JavaScript to load images - the URL list script avoids scraping issues

## After Running

After successfully running the download script:
1. Check that images are in `public/images/[gallery-name]/`
2. Start the dev server (`npm run dev`) to see the real images
3. Commit the new images to git (and update gallery JSON if needed)
