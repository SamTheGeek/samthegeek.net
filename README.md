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

## 🗺️ Lightbox Maps (Optional)

The lightbox can show an embedded Google Map when EXIF GPS data is present.

1. Copy `.env.example` to `.env`.
2. Set `PUBLIC_GOOGLE_MAPS_STATIC_API_KEY` to a Google Maps Static Maps API key.
3. Optionally set `PUBLIC_GOOGLE_MAPS_EMBED_API_KEY` as a fallback.
3. Restrict the key by HTTP referrer (e.g., `http://localhost:4321/*` for local dev).

Note: These keys are exposed to the client by design, so rely on referrer restrictions and limiting the enabled APIs.

## 📖 Documentation

- [CLAUDE.md](CLAUDE.md) - Development guide and architecture documentation
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment setup and SSL configuration
- [DOWNLOAD_IMAGES_README.md](DOWNLOAD_IMAGES_README.md) - Image download + rename workflows

## 🧰 Scripts

Scripts live in the `scripts/` directory. See `DOWNLOAD_IMAGES_README.md` for image-related workflows.

- `scripts/download_gallery_images.py` - Download gallery images from `ALL_GALLERY_URLS.txt` into `public/images/<gallery>/`.
- `scripts/import_live_content.py` - Import live blog posts + About content, and regenerate blog redirects.
- `scripts/rename_existing_gallery_images.py` - Rename all existing gallery images using EXIF data + optional Google Maps geocoding.
- `scripts/rename_new_gallery_images.py` - Import/rename a new batch of images into an existing or new gallery.
- `scripts/generate-latest-redirect.mjs` - Generate `public/_redirects` so `/` routes to the newest gallery.
- `scripts/verify-build-artifacts.mjs` - Ensure docs/scripts never ship in the production build output.

## 🌐 Deployment

The site automatically deploys to Netlify via GitHub Actions when changes are pushed to the `main` branch.

**Live site:** <https://samthegeek.net>
