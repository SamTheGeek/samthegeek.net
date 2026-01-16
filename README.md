# samthegeek.net

[![Netlify Status](https://api.netlify.com/api/v1/badges/157edc7e-ad0d-4e06-9095-42dfc690f4fd/deploy-status)](https://app.netlify.com/projects/samthegeeknet/deploys)

Personal website for Sam Gross, built with Astro and deployed to Netlify.

## 🚀 Development

```bash
# Install Node LTS via NVM
nvm use --lts

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```
## 🧱 Tools Used

- Astro for the site framework and content collections
- Node.js + npm (via NVM) for builds and local dev
- Netlify + GitHub Actions for deployment
- Python scripts (with `exifread`) for gallery imports and metadata
- OpenAI Codex & Claude Code

For a fresh machine setup, run:
```bash
bash scripts/setup_repo.sh
```

## ✅ Testing

```bash
# Fast regression checks
npm run test

# Full build + Playwright E2E
npm run test:e2e
```
## 🧱 Tools Used

- Astro for the site framework and content collections
- Node.js + npm (via NVM) for builds and local dev
- Netlify + GitHub Actions for deployment
- Python scripts (with `exifread`) for gallery imports and metadata
- OpenAI Codex & Claude Code

## 🗺️ Lightbox Maps (Optional)

The lightbox can show an embedded Google Map when EXIF GPS data is present.

1. Copy `.env.example` to `.env`.
2. Set `PUBLIC_GOOGLE_MAPS_EMBED_API_KEY` (used by the lightbox and local scripts).
3. Optionally set `PUBLIC_GOOGLE_MAPS_STATIC_API_KEY` if you want a separate key for static maps.
4. Enable the Static Maps + Geocoding APIs for that key.
5. Restrict the key by HTTP referrer (e.g., `http://localhost:4321/*` for local dev).

Note: These keys are exposed to the client by design, so rely on referrer restrictions and limiting the enabled APIs.
Troubleshooting: if the static map image returns 403 but the URL works in a new tab, add the exact referrer
(`http://localhost:4321/*`, `http://127.0.0.1:4321/*`, etc.) to the key’s allowed referrers.

## 📖 Documentation

- [Docs/CLAUDE.md](Docs/CLAUDE.md) - Development guide and architecture documentation
- [Docs/DEPLOYMENT.md](Docs/DEPLOYMENT.md) - Deployment setup and SSL configuration
- [Docs/DOWNLOAD_IMAGES_README.md](Docs/DOWNLOAD_IMAGES_README.md) - Image download + rename workflows
- [STATUS.md](STATUS.md) - Current status, progress, and next tasks
- [AGENT_INSTRUCTIONS.md](AGENT_INSTRUCTIONS.md) - Repository workflows and conventions for assistants

## 🧰 Scripts

Scripts live in the `scripts/` directory. See `Docs/DOWNLOAD_IMAGES_README.md` for image-related workflows.

### Image Processing (Node.js - Recommended)
- `scripts/process-gallery-images.mjs` - **Main image processing script**: converts to WebP, extracts EXIF metadata, registers images in gallery JSON, creates new galleries automatically. Used by GitHub Actions workflows.

### Legacy Python Scripts
Gallery scripts auto-bootstrap `exifread` in a local `.venv` and read `.env` for `PUBLIC_GOOGLE_MAPS_EMBED_API_KEY`.

- `scripts/download_gallery_images.py` - Download gallery images from `ALL_GALLERY_URLS.txt` into `public/images/<gallery>/`.
- `scripts/import_live_content.py` - Import live blog posts + About content, and regenerate blog redirects.
- `scripts/rename_existing_gallery_images.py` - Rename all existing gallery images using EXIF data + optional Google Maps geocoding.
- `scripts/rename_new_gallery_images.py` - Import/rename a new batch of images into an existing or new gallery.
- `scripts/extract_gallery_exif.py` - Extract EXIF metadata into gallery JSON files.

### Build Scripts
- `scripts/generate-latest-redirect.mjs` - Generate `public/_redirects` so `/` routes to the newest gallery.
- `scripts/verify-build-artifacts.mjs` - Ensure docs/scripts never ship in the production build output.

## 📸 Importing New Photos

### Automated Workflow (Recommended)

The easiest way to add photos is via GitHub Actions:

1. **Add photos** to `public/images/<gallery-name>/` (create folder if new gallery)
2. **Commit and push** to a branch, then merge to `main`
3. **GitHub Actions automatically**:
   - Converts images to WebP format (with JPEG fallback)
   - Extracts EXIF metadata (camera, lens, settings, GPS)
   - Reverse geocodes GPS to city names
   - Registers images in gallery JSON
   - Creates gallery page if folder is new
   - Opens a PR with all processed files

### Manual Processing

Run the image processor locally:

```bash
# Process all galleries
node scripts/process-gallery-images.mjs

# Process specific gallery
node scripts/process-gallery-images.mjs --gallery japan

# Options
node scripts/process-gallery-images.mjs --help
```

Options:
- `--gallery <name>` - Process only a specific gallery
- `--force` - Re-process images even if already in JSON
- `--quality <n>` - WebP quality (1-100, default: 80)
- `--skip-webp` - Skip WebP conversion (metadata only)
- `--skip-geocode` - Skip reverse geocoding
- `--dry-run` - Show what would be done

### Manual GitHub Workflow

Trigger the "Process All Gallery Images" workflow from GitHub Actions UI with options:
- Quality setting
- Force re-processing
- Gallery filter
- Skip WebP/geocoding options

### Legacy Python Workflow

For manual control, use the Python scripts:

```bash
pip install exifread  # or let scripts auto-install
python3 scripts/rename_new_gallery_images.py
python3 scripts/extract_gallery_exif.py <gallery-slug>
```

### API Keys

For reverse geocoding (GPS → city names):
- Set `PUBLIC_GOOGLE_MAPS_EMBED_API_KEY` in `.env` or GitHub Secrets
- Falls back to OpenStreetMap Nominatim if no key provided

## 🌐 Deployment

The site automatically deploys to Netlify via GitHub Actions when changes are pushed to the `main` branch.

**Live site:** <https://samthegeek.net>
