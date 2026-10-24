import { execFileSync } from 'node:child_process';

// Install the browsers the Playwright projects use (Chromium and WebKit).
// Skip on Netlify — E2E tests run in GitHub Actions only.
// `playwright install` ignores PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD, so honour it
// here; CI sets it and installs browsers itself after restoring its cache.
if (process.env.NETLIFY !== 'true' && !process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD) {
  execFileSync('npx', ['playwright', 'install', 'chromium', 'webkit'], { stdio: 'inherit' });
}
