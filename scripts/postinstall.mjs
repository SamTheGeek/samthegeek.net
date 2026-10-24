import { execFileSync } from 'node:child_process';

// Skip heavy browser install on Netlify — E2E tests run in GitHub Actions only.
// `playwright install` ignores PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD, so honour it
// here; CI sets it and installs browsers itself after restoring its cache.
if (process.env.NETLIFY !== 'true' && !process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD) {
  execFileSync('npx', ['playwright', 'install', 'chromium'], { stdio: 'inherit' });
}
