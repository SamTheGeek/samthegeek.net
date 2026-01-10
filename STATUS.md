# Project Status (Consolidated)

This file consolidates `SESSION_NOTES.md`, `HANDOFF_REPORT.md`, `PROJECT_STATUS.md`, and `NEXT_STEPS.md`.
When details conflict, information from the most recently modified source file is preferred.

## Overview

- Astro v5 site rebuild for samthegeek.net with dynamic photo galleries.
- Homepage behavior: build generates a redirect from `/` to the newest gallery by `publishedDate`.
- Deployment pipeline ready for Netlify (GitHub Actions + Netlify config).

## Current State

- Build: `npm run build` succeeds and generates `public/_redirects`.
- Dev server: fails to bind locally with `listen EPERM ... :4321` (environment-specific).
- Galleries: Copenhagen complete with 35 images; remaining galleries pending downloads.

## Gallery Status

- Complete: `public/images/copenhagen/` (35 images)
- Pending downloads: Italy, Los Angeles, France, Japan, Canada, Elsewhere

## Scripts

- Recommended: `download_and_update_galleries.py` (downloads images and updates JSON).
- Alternatives: `download_all_galleries.sh` (download only), `check_gallery_status.sh` (counts).

## Deployment Requirements

- GitHub Secrets: `NETLIFY_AUTH_TOKEN`
- GitHub Variables: `NETLIFY_SITE_ID`
- Netlify build: `npm run build`, publish directory `dist`

## Pending Tasks (Priority Order)

1. Download remaining gallery images and update JSON files.
2. Verify all galleries + lightbox behavior (desktop + mobile).
3. Configure Netlify deployment + custom domain + SSL.
4. Match design details to existing samthegeek.net.
5. Migrate real blog content and About page content.

## Key Files

- `src/content/galleries/*.json` (gallery metadata)
- `scripts/generate-latest-redirect.mjs` (newest-gallery redirect)
- `public/_redirects` (generated at build)
- `DEPLOYMENT.md` (Netlify setup)
