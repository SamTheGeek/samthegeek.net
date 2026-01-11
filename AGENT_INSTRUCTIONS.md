# Agent Instructions

## Source of Truth

- Use `STATUS.md` as the only source of current status, active tasks, and suggested work.
- Use `agent_instructions.md` for repository instructions, conventions, and operational notes for assistants.
- Treat "next task" as the next item in memory; if none is in memory, use the next item in `STATUS.md`'s priority list.

## Project Overview

This is the repository for samthegeek.net, a personal website built with Astro. The goal is to recreate the existing samthegeek.net website and deploy it via GitHub Actions to Netlify with SSL via Let's Encrypt.
The homepage route `/` redirects to the newest gallery based on `publishedDate` (generated at build time).

## Important Development Workflow

**ALWAYS start a local development server when working on this project:**

```bash
# Run in background to keep it active during the session
source "$HOME/.nvm/nvm.sh" && nvm use --lts && npm run dev
```

The dev server should run at <http://localhost:4321/> and will hot-reload when files are changed. This allows for immediate visual feedback during development.

**ALWAYS open the dev server in a browser at session start:**

```bash
open http://localhost:4321/
```

**CRITICAL**: The dev server must be restarted at the beginning of each new session:

- If VSCode was closed and reopened
- If the terminal was quit
- After any system restart or session interruption

Always check if the dev server is running and restart it if needed before making changes.

Note: The dev server can fail to bind under restricted sandbox permissions; it starts successfully with network access enabled.

## Technology Stack

- **Framework**: Astro (static site generator)
- **Node Version**: LTS (managed via NVM)
- **Deployment**: Netlify (via GitHub Actions)
- **SSL**: Let's Encrypt

## Development Commands

```bash
# Install Node LTS via NVM
nvm install --lts
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

## Build Output Safety

Builds include a verification step that fails if documentation or scripts appear in `dist/`.

## Architecture

The project uses Astro's file-based routing system:

- `src/pages/` - Page components that map to routes
  - `index.astro` - Homepage that displays the newest gallery
  - `about.astro` - About page
  - `blog/index.astro` - Blog listing page
  - `blog/[...slug].astro` - Individual blog post template
  - `copenhagen.astro`, `italy.astro`, etc. - Photo gallery pages for different locations
- `src/layouts/` - Layout components for consistent page structure
  - `BaseLayout.astro` - Main layout with navigation, header, and footer
- `src/components/` - Reusable UI components
  - `Gallery.astro` - Photo gallery grid component
  - `Lightbox.astro` - Lightbox overlay
- `src/content/` - Content collections (Astro content layer)
  - `config.ts` - Content collection schemas
  - `blog/` - Markdown blog posts
- `public/` - Static assets served as-is

## Deployment Requirements

- GitHub Secrets: `NETLIFY_AUTH_TOKEN`
- GitHub Variables: `NETLIFY_SITE_ID`
- Netlify build: `npm run build`, publish directory `dist`

## Important Files

- `.github/workflows/deploy.yml` - GitHub Actions workflow for deployment
- `netlify.toml` - Netlify configuration with redirects and headers
- `DEPLOYMENT.md` - Detailed deployment and SSL setup guide
- `astro.config.mjs` - Astro configuration
- `package.json` - Project dependencies and scripts
- `src/content/galleries/*.json` - Gallery metadata
- `scripts/generate-latest-redirect.mjs` - Build-time redirect for newest gallery
- `scripts/verify-build-artifacts.mjs` - Ensure docs/scripts never ship in `dist`

## Assistant Notes

- Image downloads use `ALL_GALLERY_URLS.txt` plus `scripts/download_gallery_images.py`.
- Renaming/import scripts live in `scripts/rename_existing_gallery_images.py`, `scripts/rename_new_gallery_images.py`, and `scripts/import_live_content.py` (require `exifread` and optional `GOOGLE_MAPS_API_KEY`).
- Gallery layout uses a masonry column layout in `src/components/Gallery.astro`.
