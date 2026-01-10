# Gallery Image Download Scripts

This directory contains scripts to download gallery images from the live samthegeek.net website.

## Source URL List

All gallery image URLs are stored in `ALL_GALLERY_URLS.txt` at the repository root. The download script reads this file so it can reliably fetch the known images without scraping live pages.

## Available Scripts

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
