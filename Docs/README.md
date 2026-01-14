# Documentation Index

This folder houses supporting documentation that does not need to live at the repository root.

## Contents

- `CLAUDE.md` - Development guide and architecture documentation.
- `DEPLOYMENT.md` - Deployment setup and SSL configuration.
- `DOWNLOAD_IMAGES_README.md` - Image processing, download, and gallery management workflows.
- `completed-tasks.md` - Archived completed work and prior status notes.

## Quick Links

### Adding New Photos
See [DOWNLOAD_IMAGES_README.md](DOWNLOAD_IMAGES_README.md) for the recommended workflow:
1. Drop JPEGs into `public/images/<gallery-name>/`
2. Merge to `main`
3. GitHub Actions automatically processes and opens a PR

### Image Processing Features
- **WebP conversion** with JPEG fallback for older browsers
- **EXIF extraction** (camera, lens, settings, GPS)
- **Reverse geocoding** for location names
- **Auto-registration** in gallery JSON
- **New gallery creation** for new folders
