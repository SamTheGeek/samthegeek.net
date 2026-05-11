import { defineConfig } from '@playwright/test';

const isCI = Boolean(process.env.CI);

export default defineConfig({
  fullyParallel: true,
  workers: isCI ? 2 : undefined,
  testDir: './tests',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  use: {
    baseURL: 'http://127.0.0.1:4321',
    trace: isCI ? 'off' : 'retain-on-failure',
  },
  webServer: {
    command: 'npx --yes serve dist -l 4321 --no-clipboard',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: !isCI,
    timeout: 120000,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
