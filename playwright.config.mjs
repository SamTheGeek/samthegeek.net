import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);

export default defineConfig({
  fullyParallel: true,
  forbidOnly: isCI,
  testDir: './tests/e2e',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  reporter: isCI ? [['github'], ['line']] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4321',
    trace: isCI ? 'off' : 'retain-on-failure',
  },
  webServer: {
    command: 'node tests/e2e/static-server.mjs 4321',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: !isCI,
    timeout: 30000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
