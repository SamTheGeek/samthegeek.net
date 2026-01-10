# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Source of Truth

- Use `STATUS.md` as the only source of current status, active tasks, and suggested work.
- Use `CLAUDE.md` for repository instructions, conventions, and operational notes for assistants.

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

## Project Goals

1. Create a relatively exact copy of the existing samthegeek.net
2. Configure automated deployment using GitHub Actions to Netlify
3. Set up SSL certificate from Let's Encrypt
4. Prepare for production deployment

## Development Setup

### Prerequisites

- NVM (Node Version Manager)
- Node LTS (installed via NVM)

### Development Commands

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
  - `about.astro` - About page with professional background
  - `blog/index.astro` - Blog listing page
  - `blog/[...slug].astro` - Individual blog post template
  - `copenhagen.astro`, `italy.astro`, etc. - Photo gallery pages for different locations
- `src/layouts/` - Layout components for consistent page structure
  - `BaseLayout.astro` - Main layout with navigation, header, and footer
- `src/components/` - Reusable UI components
  - `Gallery.astro` - Photo gallery grid component
- `src/content/` - Content collections (Astro content layer)
  - `config.ts` - Content collection schemas
  - `blog/` - Markdown blog posts
- `public/` - Static assets served as-is

## Site Structure

### Main Pages

- **Homepage** (`/`): Automatically displays the most recently published photo gallery based on `publishedDate` metadata
- **About** (`/about`): Professional background and contact information
- **Blog** (`/blog`): Blog post listing with dates and categories
- **Blog Posts** (`/blog/[slug]`): Individual blog post pages with markdown rendering

### Photo Galleries

Galleries are managed via content collections with metadata in `src/content/galleries/`:

- Each gallery is a JSON file with: `title`, `location`, `publishedDate`, `description`, `images` array
- Gallery pages (`/copenhagen`, `/italy`, etc.) fetch data from these JSON files
- **The homepage automatically displays the newest gallery** based on `publishedDate`
- To change which gallery appears on the homepage, update the `publishedDate` in the gallery's JSON file

Current galleries:

- `/copenhagen` - Copenhagen photos (2022-07-01) **← Currently shown on homepage (newest)**
- `/italy` - Italy photos (2019-09-01)
- `/los-angeles` - Los Angeles photos (2019-02-01)
- `/france` - France photos (2018-09-01)
- `/japan` - Japan photos (2018-04-01)
- `/canada` - Canada photos (2017-09-01)
- `/elsewhere` - Miscellaneous photos (2015-01-01)

### External Tools (Not in Astro Site)

These tools are hosted on separate subdomains and managed independently:

- Twitter Archive - <https://twarchive.samthegeek.net>
- Apple Music Analyzer - <https://music.samthegeek.net>

Navigation links in the site header point to these external URLs.

## Blog System

The blog uses Astro's content collections for type-safe content management:

- Blog posts are written in Markdown in `src/content/blog/`
- Each post has frontmatter with title, description, pubDate, and optional category
- Posts are automatically sorted by date (newest first)
- Individual post URLs follow the pattern `/blog/[post-slug]/`

## Deployment

Deployment is automated via GitHub Actions (see [DEPLOYMENT.md](DEPLOYMENT.md) for detailed setup):

- Push to main branch triggers build
- Build artifacts are deployed to Netlify
- SSL certificates are managed by Let's Encrypt through Netlify

### Required GitHub Configuration

**Secrets** (Settings > Secrets and variables > Actions > Secrets):

- `NETLIFY_AUTH_TOKEN` - Netlify personal access token

**Variables** (Settings > Secrets and variables > Actions > Variables):

- `NETLIFY_SITE_ID` - Netlify site ID (not sensitive)

## Important Files

- `.github/workflows/deploy.yml` - GitHub Actions workflow for deployment
- `netlify.toml` - Netlify configuration with redirects and headers
- `DEPLOYMENT.md` - Detailed deployment and SSL setup guide
- `astro.config.mjs` - Astro configuration
- `package.json` - Project dependencies and scripts
- `src/content/galleries/*.json` - Gallery metadata
- `scripts/generate-latest-redirect.mjs` - Build-time redirect for newest gallery
- `scripts/verify-build-artifacts.mjs` - Ensure docs/scripts never ship in `dist`

## Deployment Requirements

- GitHub Secrets: `NETLIFY_AUTH_TOKEN`
- GitHub Variables: `NETLIFY_SITE_ID`
- Netlify build: `npm run build`, publish directory `dist`

## Assistant Notes

- Image downloads use `ALL_GALLERY_URLS.txt` plus `scripts/download_gallery_images.py`.
- Renaming/import scripts live in `scripts/rename_existing_gallery_images.py` and `scripts/rename_new_gallery_images.py` (require `exifread` and optional `GOOGLE_MAPS_API_KEY`).
- Gallery layout is a masonry column layout in `src/components/Gallery.astro`.
