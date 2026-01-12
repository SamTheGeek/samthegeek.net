# Project Status (Consolidated)

This file is the single source of truth for current status, progress, and next tasks.

## Current State

- Build: `npm run build` succeeds and generates `public/_redirects`.
- Dev server: starts successfully when network access is allowed; fails under restricted sandbox.
- Copenhagen gallery EXIF metadata refreshed via `scripts/extract_gallery_exif.py`.
- README updated with photo import steps, docs list, and tool stack summary.
- Gallery scripts now load `.env` for `PUBLIC_GOOGLE_MAPS_EMBED_API_KEY` (fallback to `GOOGLE_MAPS_API_KEY`) and auto-bootstrap `exifread`.
- `.env.example` updated with the script-only Google Maps key.
- Galleries: all images downloaded for Copenhagen, Italy, Los Angeles, France, Japan, Canada, Elsewhere.
- Deployment: Netlify site is live; live-site redirect and SSL pending (after design refinements).
- Deployment: Netlify live redirect and SSL setup steps documented for execution.
- Favicon now uses the about profile photo embedded as SVG.
- SVG favicon preferred in the head, PNG favicon masked to a circular crop.
- About page now pulls copy from markdown with a refreshed layout and round photo mask.
- Downloaded images are present in `public/images/`.
- Lightbox design refreshed (overlay, stage styling, info panel) and awaiting approval.
- Lightbox info panel now supports EXIF fields and optional Google Maps embed key wiring.
- Added EXIF extraction script and wired it into new gallery import; Copenhagen run found no EXIF data.
- Lightbox map uses Google Static Maps with dynamic sizing + scale=2 for crisp display and click-through; EXIF location uses Google or Nominatim fallback.
- Lightbox now supports filename-based deep links via the `photo` query parameter.
- Root redirect forced via Netlify `_redirects` with `302!` to avoid visible interstitials.
- Root redirect page now uses a static meta refresh without JS or layout chrome.
- Centered about-page content and footer in the header/footer layout at narrow widths.
- Added `scripts/run-tests.mjs` with regression checks and wired it into `npm run build`.
- Added GitHub Actions CI workflow to run build/tests on PRs.
- Added Playwright E2E tests (behavior, layout, and accessibility) and CI browser install.
- Added regression checks for gallery lazy-loading in the build-time test runner.
- Added a repo setup script and wired Playwright browser install into `postinstall`.
- Underlined About page body links to satisfy link-in-text accessibility checks.
- About page body links now inherit text color; a11y scan excludes the Jelly easter-egg link.
- Stripped Squarespace-derived `sqs-*` class names from blog content HTML.
- Stripped Squarespace-derived `data-*` attributes from blog content HTML.
- Stripped legacy `elementtiming`, `onload`, and `yui_*` IDs from blog content HTML.
- Stripped remaining legacy HTML attributes from blog content (kept only core href/src/alt/sizing attrs).
- Forced About page body link styling to override global link styles for a11y tests.
- Restored Jelly easter-egg link styling to match body text without underline.
- Added blog slug/urlId/guid uniqueness checks to the test runner.
- Blog: re-imported live posts with date-based slugs; list/post templates updated with categories/tags, likes/share UI, pagination, and archive routes.
- Lightbox design refreshed (overlay, stage styling, info panel) and awaiting approval.
- Lightbox info panel now supports EXIF fields and optional Google Maps embed key wiring.
- Added EXIF extraction script and wired it into new gallery import; Copenhagen run found no EXIF data.
- Lightbox map uses Google Static Maps with dynamic sizing + scale=2 for crisp display and click-through; EXIF location uses Google or Nominatim fallback.
- Lightbox now supports filename-based deep links via the `photo` query parameter.
- Root redirect forced via Netlify `_redirects` with `302!` to avoid visible interstitials.
- Blog: re-imported live posts with date-based slugs; list/post templates updated with categories/tags, likes/share UI, pagination, and archive routes.
- Blog cleanup: removed leftover Squarespace embed markup in `googles-red-alert` and build completes cleanly.
- Lightbox flicker fix: size low-res preview to final display and defer full-res load until preview paint (keep for tests).
- Gallery masonry fix: Blink now shows multiple columns via balanced column fill + explicit column width (keep for tests).
- Lightbox zoom animation: photos now zoom from the masonry position into the lightbox (keep for tests).
- Gallery masonry regression: switched to balanced column fill and added WebKit column break avoidance.
- Gallery masonry Safari tweak: use inline-block tiles with top alignment and zeroed container font size.
- Social sharing meta tags updated; root now uses site-level metadata with HTML redirect, and gallery meta descriptions are pulled from markdown files.

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
- Added repo setup script (`scripts/setup_repo.sh`) and Playwright browser install on `postinstall`.
- Added regression tests + Playwright E2E suite, wired into build and PR CI.
- Cleaned legacy Squarespace markup from blog content (classes + attributes).
- Removed year-based gallery slugs (redirects from legacy URLs to place-only slugs).
- Refined base sidebar design to match the live site layout.
- Implemented responsive sidebar/header/footer reflow with scrollable nav rows.
- Imported live blog posts and About content (with redirects for old blog URLs).
- Rebuilt blog listing and post pages to match Squarespace structure (excerpts, pagination, category/tag archives, likes/share UI).
- Homepage now redirects to the newest gallery (server-side 302).
- Updated lightbox design and EXIF/map integration.
- Infobox/lightbox design approved.
- Added `photo` query parameter handling for lightbox deep links.
- Implemented blog RSS feed with legacy ordering/guids and `/blog?format=rss` redirect.
- Final design check against the original site for near-identical matching (approved).
- Lightbox flicker fix: sized low-res preview to final display and deferred full-res load until preview paint.
- Gallery masonry fix: balanced column fill and explicit column width to restore multi-column layout in Blink.
- Lightbox zoom animation: thumbnail-to-lightbox zoom now animates on open.
- Gallery JSONs updated to reference local images for all galleries.
- About page rebuilt with markdown content, compact layout, and updated photo styling.
- Social sharing meta tags updated (OG/Twitter + canonical).
- Gallery meta descriptions moved to per-gallery markdown files (used only for meta description).
- Root share now uses site-level description instead of gallery-level metadata.

## Pending Tasks (Priority Order)

1. Verify all galleries + lightbox behavior (desktop + mobile).
2. Investigate duplicate blog ID warnings reported by Astro content loader.
3. Change the way photos are laid out and ordered to prevent awkwardly tall or wide photos from disrupting the overall gallery or distracting too much from the art.
4. Add custom fonts and styling to reflect the original site's intent, even if using different fonts.
5. Use an AI service to automatically add alt text for every photo
6. Add a "Bicycling" information page adjacent to the "About" page
7. Update the about page information, including a more-recent what I do and also listing the tools I used to make this website. I'd like to be cute and also include a list of things I did while the agent was running to create the site
8. Investigate lightbox embedded map sizing on iPhone Pro screen sizes.
9. Replace gallery photos with versions that contain EXIF data.
10. Smoothly animate on the width breakpoint for responsive design.
11. Add smooth view transitions when opening blog posts. (Guideline: <https://developer.chrome.com/docs/web-platform/view-transitions/cross-document>)
12. Go through all old blog posts and reformat them using modern markdown, fixing any markdown warnings.
13. Write a new blog post updating the synology icpl downloader
14. Write a blog post about writing this site
15. Redesign the blog again to make it good.
16. Fix the lightbox map embed to make it use mapbox styled to look like the website
17. Accessibility and performance audit (beyond current automated checks).
18. Make the low resolution photos webp (use the script to make alternate versions when loading them into json) for faster loading while keeping the lightbox versions as jpeg — swapping at the same time as we already swap when switching to the animation.
