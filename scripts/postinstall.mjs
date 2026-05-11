import { execFileSync } from 'node:child_process';

// Skip heavy browser install on Netlify — E2E tests run in GitHub Actions only.
if (process.env.NETLIFY !== 'true') {
  execFileSync('npx', ['playwright', 'install', 'chromium'], { stdio: 'inherit' });
}
