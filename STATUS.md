# Project Status (Consolidated)

This file is the single source of truth for current status, progress, and next tasks.

## Current State

- Build: `npm run build` succeeds and generates `public/_redirects`.
- Dev server: starts successfully when network access is allowed; fails under restricted sandbox.
- Galleries: all images downloaded for Copenhagen, Italy, Los Angeles, France, Japan, Canada, Elsewhere.
- Deployment: Netlify site is live; live-site redirect and SSL pending (after design refinements).
- Downloaded images are present in `public/images/`.

## Gallery Status

- Complete: `public/images/copenhagen/` (35 images)
- Complete: `public/images/italy/` (41 images)
- Complete: `public/images/los-angeles/` (79 images)
- Complete: `public/images/france/` (45 images)
- Complete: `public/images/japan/` (114 images)
- Complete: `public/images/canada/` (13 images)
- Complete: `public/images/elsewhere/` (9 images)

## Completed Tasks

- Fixed local dev environment (dev server starts with network access).
- Downloaded all gallery images via URL list.
- Updated gallery layout to a masonry-style column layout with consistent spacing.
- Added renaming/import scripts and build artifact verification script (committed on `main`).
- Documented all scripts in `README.md` and `DOWNLOAD_IMAGES_README.md`.

## Pending Tasks (Priority Order)

1. Remove years from URL slugs.
2. Verify all galleries + lightbox behavior (desktop + mobile).
3. Refine design to match existing samthegeek.net.
4. Update the design of the infobox until approved.
5. Expand infobox content.
6. Migrate real blog content and About page content.
7. Redirect the live site to the Netlify site and finalize SSL.
8. Add tests that run on any GitHub branch, not just main.
9. Create a setup bash script to get the dev environment setup exactly as it should be on any new machine.
