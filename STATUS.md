# Project Status (Consolidated)

This file is the single source of truth for current status, progress, and next tasks.

## Current State

- Build: `npm run build` succeeds and generates `public/_redirects`.
- Dev server: starts successfully when network access is allowed; fails under restricted sandbox.
- Deployment: Netlify site is live; live-site redirect and SSL pending (after design refinements).
- Galleries: all images downloaded locally; see the gallery status list below.
- Lightbox design refresh + EXIF/map integration completed; awaiting approval.

## Pending Tasks (Priority Order)

1. Add custom fonts and styling to reflect the original site's intent, even if using different fonts.
2. Use an AI service to automatically add alt text for every photo
3. Add a "Bicycling" information page adjacent to the "About" page
4. Update the about page information, including a more-recent what I do and also listing the tools I used to make this website. I'd like to be cute and also include a list of things I did while the agent was running to create the site
5. Investigate lightbox embedded map sizing on iPhone Pro screen sizes.
6. Split the tests and make them skip when only changing markdown.
7. Smoothly animate on the width breakpoint for responsive design.
8. Add smooth view transitions when opening blog posts. (Guideline: <https://developer.chrome.com/docs/web-platform/view-transitions/cross-document>)
9. Go through all old blog posts and reformat them using modern markdown, fixing any markdown warnings.
10. Write a new blog post updating the synology icpl downloader
11. Write a blog post about writing this site
12. Redesign the blog again to make it good (note to self: use the Claude UI skill).
13. Fix the lightbox map embed to make it use mapbox styled to look like the website
14. Accessibility and performance audit (beyond current automated checks).
15. Make the low resolution photos webp (use the script to make alternate versions when loading them into json) for faster loading while keeping the lightbox versions as jpeg — swapping at the same time as we already swap when switching to the animation.

## Completed Tasks

Archived in `Docs/completed-tasks.md`.
