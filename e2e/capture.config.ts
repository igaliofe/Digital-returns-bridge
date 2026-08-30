/**
 * Screenshot-capture config — separate from playwright.config.ts on purpose.
 *
 *     npx playwright test --config=capture.config.ts
 *
 * Differences from the test config:
 *   - testDir is ./capture, so `npm test` never picks these up
 *   - a single worker: several captures create returns and then read aggregate screens
 *     (dashboard, reports), which other workers' rows would otherwise perturb
 *   - no retries: a retried capture would silently overwrite a good PNG with a worse one
 *   - the SAME globalSetup, so every capture runs against a freshly seeded database
 */

import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8080';

export default defineConfig({
  testDir: './capture',
  testMatch: /.*\.spec\.ts/,

  timeout: 180_000,
  expect: { timeout: 20_000 },

  fullyParallel: false,
  workers: 1,
  retries: 0,

  globalSetup: './global-setup.ts',

  outputDir: './test-results-capture',
  reporter: [['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    // docs/images/README.md requires web captures at >= 1440px wide.
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    acceptDownloads: true,
  },

  projects: [
    {
      name: 'chromium',
      // The viewport MUST come after the device spread: devices['Desktop Chrome'] carries its own
      // 1280x720 viewport and would otherwise silently win, dropping every capture below the
      // 1440px minimum that docs/images/README.md sets.
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
});
