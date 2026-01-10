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
- Removed year-based gallery slugs (redirects from legacy URLs to place-only slugs).
- Refined base sidebar design to match the live site layout.

## Pending Tasks (Priority Order)

1. Make the site responsive to different screen widths.
2. Update the design of the infobox and lightbox until approved.
3. Make the site responsive: show a header when narrower than three images + sidebar, and switch to the sidebar on wider screens with graceful reflow.
4. Expand infobox content.
5. Final design check against the original site for near-identical matching.
6. Migrate real blog content and About page content.
7. Redirect the live site to the Netlify site and finalize SSL.
8. Verify all galleries + lightbox behavior (desktop + mobile).
9. Add tests that run on any GitHub branch, not just main.
10. Create a setup bash script to get the dev environment setup exactly as it should be on any new machine.
11. Change the way photos are laid out and ordered to prevent awkwardly tall or wide photos from disrupting the overall gallery or distracting too much from the art.
12. Add custom fonts and styling to reflect the original site's intent, even if using different fonts.
