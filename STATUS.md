# Project Status (Consolidated)

This file is the single source of truth for current status, progress, and next tasks.

## Current State

- Build: `npm run build` succeeds and generates `public/_redirects`.
- Dev server: starts successfully when network access is allowed; fails under restricted sandbox.
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

## Pending Tasks (Priority Order)

1. Redirect the live site to the Netlify site and finalize SSL.
2. Verify all galleries + lightbox behavior (desktop + mobile).
3. Add tests that run on any GitHub branch, not just main. Including protecting against parse errors and enforcing markdown cleanliness. These should use
4. Create a setup bash script to get the dev environment setup exactly as it should be on any new machine.
5. Change the way photos are laid out and ordered to prevent awkwardly tall or wide photos from disrupting the overall gallery or distracting too much from the art.
6. Add custom fonts and styling to reflect the original site's intent, even if using different fonts.
7. Use an AI service to automatically add alt text for every photo
8. Add a "Bicycling" information page adjacent to the "About" page
9. Update the about page information, including a more-recent what I do and also listing the tools I used to make this website. I'd like to be cute and also include a list of things I did while the agent was running to create the site
10. Investigate lightbox embedded map sizing on iPhone Pro screen sizes.
11. Replace gallery photos with versions that contain EXIF data.
12. Smoothly animate on the width breakpoint for responsive design.
13. Add smooth view transitions when opening blog posts. (Guideline: <https://developer.chrome.com/docs/web-platform/view-transitions/cross-document>)
14. Go through all old blog posts and reformat them using modern markdown, fixing any markdown warnings.
15. Write a new blog post updating the synology icpl downloader
16. Write a blog post about writing this site
17. Redesign the blog again to make it good.
18. Fix the lightbox map embed to make it use mapbox styled to look like the website
