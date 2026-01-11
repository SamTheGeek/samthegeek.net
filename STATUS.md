# Project Status (Consolidated)

This file is the single source of truth for current status, progress, and next tasks.

## Current State

- Build: `npm run build` succeeds and generates `public/_redirects`.
- Dev server: starts successfully when network access is allowed; fails under restricted sandbox.
- Galleries: all images downloaded for Copenhagen, Italy, Los Angeles, France, Japan, Canada, Elsewhere.
- Deployment: Netlify site is live; live-site redirect and SSL pending (after design refinements).
- Downloaded images are present in `public/images/`.
- Lightbox design refreshed (overlay, stage styling, info panel) and awaiting approval.
- Lightbox info panel now supports EXIF fields and optional Google Maps embed key wiring.
- Added EXIF extraction script and wired it into new gallery import; Copenhagen run found no EXIF data.
- Lightbox map uses Google Static Maps with dynamic sizing + scale=2 for crisp display and click-through; EXIF location uses Google or Nominatim fallback.

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
- Implemented responsive sidebar/header/footer reflow with scrollable nav rows.
- Imported live blog posts and About content (with redirects for old blog URLs).
- Homepage now redirects to the newest gallery (server-side 302).
- Updated lightbox design and EXIF/map integration.

## Pending Tasks (Priority Order)

1. Update the design of the infobox and lightbox until approved.
2. Add a query parameter to the gallery page when a photo is open in the lightbox to allow linking to a specific photo and not just the gallery page.
3. Final design check against the original site for near-identical matching.
4. Redirect the live site to the Netlify site and finalize SSL.
5. Verify all galleries + lightbox behavior (desktop + mobile).
6. Add tests that run on any GitHub branch, not just main.
7. Create a setup bash script to get the dev environment setup exactly as it should be on any new machine.
8. Change the way photos are laid out and ordered to prevent awkwardly tall or wide photos from disrupting the overall gallery or distracting too much from the art.
9. Add custom fonts and styling to reflect the original site's intent, even if using different fonts.
10. Use an AI service to automatically add alt text for every photo
11. Add a "Bicycling" information page adjacent to the "About" page
12. Update the about page information, including a more-recent what I do and also listing the tools I used to make this website. I'd like to be cute and also include a list of things I did while the agent was running to create the site
13. Investigate lightbox embedded map sizing on iPhone Pro screen sizes.
14. Replace gallery photos with versions that contain EXIF data.
