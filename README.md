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

## 📖 Documentation

- [CLAUDE.md](CLAUDE.md) - Development guide and architecture documentation
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment setup and SSL configuration
- [DOWNLOAD_IMAGES_README.md](DOWNLOAD_IMAGES_README.md) - Image download + rename workflows

## 🧰 Scripts

Scripts live in the `scripts/` directory. See `DOWNLOAD_IMAGES_README.md` for image-related workflows.

- `scripts/download_gallery_images.py` - Download gallery images from `ALL_GALLERY_URLS.txt` into `public/images/<gallery>/`.
- `scripts/rename_existing_gallery_images.py` - Rename all existing gallery images using EXIF data + optional Google Maps geocoding.
- `scripts/rename_new_gallery_images.py` - Import/rename a new batch of images into an existing or new gallery.
- `scripts/generate-latest-redirect.mjs` - Generate `public/_redirects` so `/` routes to the newest gallery.
- `scripts/verify-build-artifacts.mjs` - Ensure docs/scripts never ship in the production build output.

## 🌐 Deployment

The site automatically deploys to Netlify via GitHub Actions when changes are pushed to the `main` branch.

**Live site:** <https://samthegeek.net>
