# Next Steps: Download Gallery Images

## Current Status

I've created comprehensive scripts to download all remaining gallery images from your live samthegeek.net site. Currently, your gallery JSON files contain placeholder images that need to be replaced with real photos.

## Scripts Created

Three download scripts have been prepared in the root directory:

### 1. **download_and_update_galleries.py** (RECOMMENDED)
**Location**: `/Users/sam/Developer/samthegeek.net/download_and_update_galleries.py`

This is the most complete solution. It will:
- Download all images from the live site
- Save them to the appropriate directories
- Automatically update the JSON files with correct image paths
- Report progress every 20 images
- Provide a final summary

**To run:**
```bash
cd /Users/sam/Developer/samthegeek.net
python3 download_and_update_galleries.py
```

### 2. **download_all_galleries.sh**
**Location**: `/Users/sam/Developer/samthegeek.net/download_all_galleries.sh`

Bash script alternative (downloads only, doesn't update JSON).

**To run:**
```bash
cd /Users/sam/Developer/samthegeek.net
chmod +x download_all_galleries.sh
./download_all_galleries.sh
```

### 3. **check_gallery_status.sh**
**Location**: `/Users/sam/Developer/samthegeek.net/check_gallery_status.sh`

Quick status checker to see how many images are in each gallery directory.

**To run:**
```bash
cd /Users/sam/Developer/samthegeek.net
chmod +x check_gallery_status.sh
./check_gallery_status.sh
```

## Galleries to Download

The scripts will download images from these galleries:

| Gallery       | Live URL                              | Local Directory                                      |
|---------------|---------------------------------------|------------------------------------------------------|
| Italy         | https://samthegeek.net/italy         | /Users/sam/Developer/samthegeek.net/public/images/italy/         |
| Los Angeles   | https://samthegeek.net/los-angeles19 | /Users/sam/Developer/samthegeek.net/public/images/los-angeles/   |
| France        | https://samthegeek.net/france18      | /Users/sam/Developer/samthegeek.net/public/images/france/        |
| Japan         | https://samthegeek.net/japan18       | /Users/sam/Developer/samthegeek.net/public/images/japan/         |
| Canada        | https://samthegeek.net/canada17      | /Users/sam/Developer/samthegeek.net/public/images/canada/        |
| Elsewhere     | https://samthegeek.net/elsewhere     | /Users/sam/Developer/samthegeek.net/public/images/elsewhere/     |

Note: Copenhagen gallery is already complete (35 images downloaded).

## Expected Output

When you run the recommended script, you'll see:

```
======================================================================
Gallery Image Download & JSON Update Tool
======================================================================

======================================================================
Processing: Italy
URL: https://samthegeek.net/italy
Target: /Users/sam/Developer/samthegeek.net/public/images/italy
======================================================================
Fetching page and extracting image URLs...
Found 45 potential image URLs
[1/45] Downloading: IMG_1234.jpg
[2/45] Downloading: IMG_1235.jpg
...
[20/45] Downloading: IMG_1253.jpg

===== Progress: 20/45 images processed =====

...
[45/45] Downloading: IMG_1278.jpg

✓ Completed Italy:
  - Downloaded: 45 new images
  - Skipped (already existed): 0
  - Total in directory: 45

[Process continues for each gallery...]

======================================================================
FINAL SUMMARY
======================================================================
Italy               :  45 images
Los Angeles         :  32 images
France              :  38 images
Japan               :  52 images
Canada              :  28 images
Elsewhere           :  41 images
======================================================================
Total               : 236 images across all galleries
======================================================================

Done! All gallery JSON files have been updated.
```

## After Running the Script

1. **Verify the downloads:**
   ```bash
   ./check_gallery_status.sh
   ```

2. **Check the updated JSON files:**
   ```bash
   ls -la src/content/galleries/*.json
   ```

3. **Start the dev server to view the galleries:**
   ```bash
   source "$HOME/.nvm/nvm.sh" && nvm use --lts && npm run dev
   ```
   Then visit:
   - http://localhost:4321/italy
   - http://localhost:4321/los-angeles
   - http://localhost:4321/france
   - http://localhost:4321/japan
   - http://localhost:4321/canada
   - http://localhost:4321/elsewhere

4. **Commit the changes:**
   ```bash
   git add public/images/
   git add src/content/galleries/
   git commit -m "Add real gallery images for all galleries"
   ```

## Troubleshooting

### If images don't download:
- Check internet connection
- Verify the live site URLs are accessible
- Some galleries may use JavaScript to load images dynamically

### If JSON files aren't updated:
- Make sure you have write permissions
- Check that the JSON files exist in `src/content/galleries/`

### If galleries look wrong on the dev server:
- Check that image paths in JSON files use the format: `/images/[gallery-name]/[filename]`
- Verify images actually downloaded to the correct directories

## Manual Alternative

If the scripts don't work perfectly (e.g., due to JavaScript-loaded content), you can:

1. Visit each gallery URL in a browser
2. Use browser dev tools to find image URLs
3. Download manually using curl:
   ```bash
   curl -o public/images/italy/image.jpg https://samthegeek.net/path/to/image.jpg
   ```
4. Manually update the JSON files to reference the downloaded images

## Documentation

See `DOWNLOAD_IMAGES_README.md` for more detailed documentation about the scripts.
