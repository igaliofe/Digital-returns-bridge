import { defineConfig, devices } from '@playwright/test';

/**
 * Digital Returns Bridge — browser-level E2E suite.
 *
 * The app is deployed as ROOT.war (see server/Dockerfile), so the context root
 * is "/" — there is NO /digital-returns-bridge prefix. Pages live at
 * http://localhost:8080/<route>.xhtml and the REST API at http://localhost:8080/api.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8080';

/** `E2E_WORKERS=4 npm test` or `npx playwright test --workers=4`. */
const WORKERS = process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : undefined;

/** Retries default to 1 so `trace: 'on-first-retry'` actually captures something. */
const RETRIES = process.env.E2E_RETRIES ? Number(process.env.E2E_RETRIES) : 1;

export default defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.ts/,

  // JSF full-page POSTs + PrimeFaces ajax on WildFly are not fast.
  timeout: 90_000,
  expect: { timeout: 15_000 },

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: RETRIES,
  workers: WORKERS,

  // Nukes + boots the stack, then polls /login.xhtml until it answers 200.
  globalSetup: './global-setup.ts',

  outputDir: './test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: './playwright-report', open: 'never' }],
  ],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    // PrimeFaces confirm dialogs are DOM-based, but a few controls use the
    // native confirm(); specs opt in with page.on('dialog', ...).
    acceptDownloads: true,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
