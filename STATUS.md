# Project Status (Consolidated)

This file consolidates `SESSION_NOTES.md`, `HANDOFF_REPORT.md`, `PROJECT_STATUS.md`, and `NEXT_STEPS.md`.
When details conflict, information from the most recently modified source file is preferred.

## Overview

- Astro v5 site rebuild for samthegeek.net with dynamic photo galleries.
- Homepage behavior: build generates a redirect from `/` to the newest gallery by `publishedDate`.
- Netlify deployment completed; remaining work is redirecting the live site to Netlify and final SSL setup after design refinements.

## Current State

- Build: `npm run build` succeeds and generates `public/_redirects`.
- Dev server: starts successfully when network access is allowed; fails under restricted sandbox.
- Galleries: Copenhagen complete with 35 images; remaining galleries pending downloads.
- Deployment: Netlify site is live; live-site redirect and SSL pending (after design refinements).

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

## Completed Tasks

- Fixed local dev environment (dev server starts with network access).

## Pending Tasks (Priority Order)

1. Download remaining gallery images and update JSON files. (handled separately)
2. Implement an automatic attractive tile layout for photos.
3. Create a photo renaming script.
4. Remove years from URL slugs.
5. Verify all galleries + lightbox behavior (desktop + mobile).
6. Refine design to match existing samthegeek.net.
7. Update the design of the infobox until approved.
8. Expand infobox content.
9. Migrate real blog content and About page content.
10. Redirect the live site to the Netlify site and finalize SSL.
11. Add tests that run on any GitHub branch, not just main.
12. Create a setup bash script to get the dev environment setup exactly as it should be on any new machine.

## Key Files

- `src/content/galleries/*.json` (gallery metadata)
- `scripts/generate-latest-redirect.mjs` (newest-gallery redirect)
- `public/_redirects` (generated at build)
- `DEPLOYMENT.md` (Netlify setup)
