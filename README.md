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

- [CLAUDE.md](CLAUDE.md) - Development guide and architecture documentation
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment setup and SSL configuration
- [DOWNLOAD_IMAGES_README.md](DOWNLOAD_IMAGES_README.md) - Image download + rename workflows
- [STATUS.md](STATUS.md) - Current status, progress, and next tasks
- [AGENT_INSTRUCTIONS.md](AGENT_INSTRUCTIONS.md) - Repository workflows and conventions for assistants

## 🧰 Scripts

Scripts live in the `scripts/` directory. See `DOWNLOAD_IMAGES_README.md` for image-related workflows.
Gallery scripts auto-bootstrap `exifread` in a local `.venv` and read `.env` for `PUBLIC_GOOGLE_MAPS_EMBED_API_KEY`.

- `scripts/download_gallery_images.py` - Download gallery images from `ALL_GALLERY_URLS.txt` into `public/images/<gallery>/`.
- `scripts/import_live_content.py` - Import live blog posts + About content, and regenerate blog redirects.
- `scripts/rename_existing_gallery_images.py` - Rename all existing gallery images using EXIF data + optional Google Maps geocoding.
- `scripts/rename_new_gallery_images.py` - Import/rename a new batch of images into an existing or new gallery.
- `scripts/generate-latest-redirect.mjs` - Generate `public/_redirects` so `/` routes to the newest gallery.
- `scripts/verify-build-artifacts.mjs` - Ensure docs/scripts never ship in the production build output.

## 📸 Importing New Photos

Use the rename/import workflow to add new images to an existing or new gallery.

Requirements:
```bash
pip install exifread
export PUBLIC_GOOGLE_MAPS_EMBED_API_KEY="your_key_here" # optional for city lookup
```

If your system Python blocks global installs, use a virtual env first:
```bash
python3 -m venv .venv
source .venv/bin/activate
```

Tip: the scripts will auto-create `.venv` and install `exifread` if missing.

API key setup:
- Put a dev/testing Google Maps key in `.env` at the repo root as `PUBLIC_GOOGLE_MAPS_EMBED_API_KEY=...`.
- Keep production keys separate; this key is used by the lightbox and the Python scripts.

Workflow:
```bash
python3 scripts/rename_new_gallery_images.py
python3 scripts/extract_gallery_exif.py <gallery-slug>
```

This will move images into `public/images/<gallery>/`, update `src/content/galleries/<gallery>.json`,
and refresh EXIF metadata for the lightbox info panel.

## 🌐 Deployment

The site automatically deploys to Netlify via GitHub Actions when changes are pushed to the `main` branch.

**Live site:** <https://samthegeek.net>
