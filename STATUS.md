# Project Status (Consolidated)

This file is the single source of truth for current status, progress, and next tasks.

## Current State

- Build: `npm run build` succeeds and generates `public/_redirects`.
- Upgraded to Astro 6 (`astro@6.0.8`) and migrated content collections to `src/content.config.ts` with explicit loaders.
- Refreshed the local dependency install to match the Astro 6 lockfile; `npm run build` and `npx playwright test` now pass again.
- Local/CI gallery validation now accepts existing `.webp` assets when JSON `src` points to legacy JPG/JPEG paths.
- Dev server: starts successfully when network access is allowed; fails under restricted sandbox.
- CI Playwright workflow now skips docs/workflow/photo-only PRs and `scripts/**` changes, caches Playwright browser binaries, runs core browser checks broadly, and runs blog route checks only when new blog content files are added.
- Added a repo-managed CodeQL workflow scoped to JavaScript/TypeScript and only relevant source/config path changes.
- `Update Photo Metadata` workflow now discovers galleries via GitHub API, runs per-gallery matrix jobs, uses sparse checkout + `blob:none`, and opens per-gallery PR branches to reduce clone overhead and improve PR reliability.
- Deployment: Netlify site is live; live-site redirect and SSL pending (after design refinements).
- Galleries: all images downloaded locally; see the gallery status list below.
- Lightbox design refresh + EXIF/map integration completed; awaiting approval.
- Lightbox photo details popover now shows geocoded location only once (above the map).
- Added metadata refresh automation guidance: run the `Update Photo Metadata` workflow after metadata extraction/display changes.
- Added an image rotation workflow (`Rotate Images` + `scripts/rotate-gallery-images.mjs`) for photos that lost their EXIF orientation during WebP conversion: paste URLs, pick CW/CCW/180, get a PR with the rotation baked into the pixels. `process-gallery-images.mjs` now auto-orients on conversion so new imports keep their rotation. See `Docs/IMAGE_ROTATION.md`.
- Rotated 45 sideways photos (5 CW, 39 CCW, 1 upside-down across Los Angeles, France, Japan and Canada) at quality 100, and removed the misfiled `italy/DSCF6211` (a Copenhagen photo already present in that gallery). Lossless was tried first and reverted: the sources are already lossy WebP, so it preserved existing artefacts at roughly double the bytes without recovering any detail.
- Shortened all 215 full-UUID photo filenames to the last 8 characters of their UUID via `scripts/shorten-image-names.mjs`; no collisions.
- `process-gallery-images.mjs` now bakes the rotation in at conversion time and keeps it that way: every WebP it writes is auto-oriented and states `Orientation = 1`, encodes through a temp file that is renamed into place, and records the size the encoder reports. Runs also check the WebP files whose JPEG source is gone - re-encoding any that still carry an orientation tag, and correcting `width`/`height` that disagree with the file on disk. Covered by a test that converts a synthetic portrait frame and checks the pixels; it fails if either `autoOrient()` or the `Orientation = 1` is removed.
- Re-synced the 40 Italy entries whose JSON recorded pre-WebP dimensions (task 15), as output of the run above; six of them were recorded landscape while the file is portrait.


## Pending Tasks (Priority Order)

1. Add custom fonts and styling to reflect the original site's intent, even if using different fonts.
2. Use an AI service to automatically add alt text for every photo
3. Add a "Bicycling" information page adjacent to the "About" page
4. Update the about page information, including a more-recent what I do and also listing the tools I used to make this website. I'd like to be cute and also include a list of things I did while the agent was running to create the site
5. Investigate lightbox embedded map sizing on iPhone Pro screen sizes.
6. Monitor CI runtime after Playwright slimming changes and decide whether to further trim browser test coverage.
7. Smoothly animate on the width breakpoint for responsive design.
8. Add smooth view transitions when opening blog posts. (Guideline: <https://developer.chrome.com/docs/web-platform/view-transitions/cross-document>)
9. Go through all old blog posts and reformat them using modern markdown, fixing any markdown warnings.
10. Write a new blog post updating the synology icpl downloader
11. Write a blog post about writing this site
12. Redesign the blog again to make it good (note to self: use the Claude UI skill).
13. Fix the lightbox map embed to make it use mapbox styled to look like the website
14. Accessibility and performance audit (beyond current automated checks).
15. Make the photos WebP for faster loading, maintaining a jpeg fallback. Create a pipeline that automatically converts + extracts metadata using github actions whenever a new photo or photos is checked in — automatically creating a gallery page if that exists at the same time. This script should only run after a PR is merged with those photos, opening a new PR with the new gallery + converted images. Tests should be updated to handle these kinds of cases. Also we need a workflow that will convert all the existing images and open a new PR, but this should only be run manually.

## Completed Tasks

Archived in `Docs/completed-tasks.md`.
