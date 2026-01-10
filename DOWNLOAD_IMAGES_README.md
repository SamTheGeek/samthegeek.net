# Gallery Image Download Scripts

This directory contains scripts to download gallery images from the live samthegeek.net website.

## Available Scripts

### 1. download_all_galleries.sh (Bash)
Simple bash script that downloads images using curl.

```bash
chmod +x download_all_galleries.sh
./download_all_galleries.sh
```

### 2. download_all_galleries.py (Python - Images Only)
Python script that downloads images without updating JSON files.

```bash
python3 download_all_galleries.py
```

### 3. download_and_update_galleries.py (Python - Complete Solution)
**RECOMMENDED**: Comprehensive Python script that:
- Downloads all gallery images from the live site
- Updates JSON files in `src/content/galleries/` with correct image paths
- Reports progress every 20 images
- Handles errors gracefully

```bash
python3 download_and_update_galleries.py
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

- Progress reporting every 20 images
- Skips already downloaded images
- Handles errors gracefully
- Final summary with image counts per gallery
- The complete solution (`download_and_update_galleries.py`) also updates JSON files automatically

## Output

The scripts will:
1. Create subdirectories under `public/images/` if they don't exist
2. Download each image with its original filename
3. Report progress during download
4. Provide a final summary with image counts

Example output:
```
==========================================
Processing: Italy
URL: https://samthegeek.net/italy
Target: /Users/sam/Developer/samthegeek.net/public/images/italy
==========================================
Fetching page and extracting image URLs...
Found 45 images
[1/45] Downloading: IMG_1234.jpg
[2/45] Downloading: IMG_1235.jpg
...
===== Progress: 20/45 images processed =====
...
✓ Completed Italy: 45 images in directory

FINAL SUMMARY
==========================================
Italy: 45 images
Los Angeles: 32 images
France: 38 images
Japan: 52 images
Canada: 28 images
Elsewhere: 41 images
==========================================
```

## Troubleshooting

If a gallery fails to download:
1. Check your internet connection
2. Verify the live site URLs are still valid
3. Check that you have write permissions to the `public/images/` directory
4. Some galleries may use JavaScript to load images - in that case, manual download may be required

## After Running

After successfully running the complete solution script:
1. Check that images are in `public/images/[gallery-name]/`
2. Verify JSON files in `src/content/galleries/` have been updated
3. Start the dev server (`npm run dev`) to see the real images
4. Commit the new images and updated JSON files to git
