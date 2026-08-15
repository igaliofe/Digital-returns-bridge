import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  test as base,
  type BrowserContext,
  type Page,
} from '@playwright/test';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** `<repo>/e2e` */
export const E2E_ROOT = path.resolve(HERE, '..');
/** `<repo>` */
export const REPO_ROOT = path.resolve(E2E_ROOT, '..');
/** Where worker-scoped storageState files land (git-ignored). */
export const AUTH_STATE_DIR = path.join(E2E_ROOT, '.auth');

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

/** Test-facing role handles. Do not use the server enum names here. */
export type Role = 'REP' | 'DRIVER' | 'WAREHOUSE' | 'MANAGER';

/** The role enum as the server / API / DB spells it. */
export type ServerRole = 'SERVICE_REP' | 'DRIVER' | 'WAREHOUSE' | 'MANAGER';

export const ROLES: readonly Role[] = ['REP', 'DRIVER', 'WAREHOUSE', 'MANAGER'];

/** Seeded actors — database/seed.sql, users ids 1-6. */
export const ROLE_PHONE: Record<Role, string> = {
  REP: '0501111111',
  DRIVER: '0502222222',
  WAREHOUSE: '0503333333',
  MANAGER: '0504444444',
};

export const ROLE_FULL_NAME: Record<Role, string> = {
  REP: 'Alice Cohen',
  DRIVER: 'Bob Levi',
  WAREHOUSE: 'Carol Mizrahi',
  MANAGER: 'David Katz',
};

export const ROLE_SERVER_NAME: Record<Role, ServerRole> = {
  REP: 'SERVICE_REP',
  DRIVER: 'DRIVER',
  WAREHOUSE: 'WAREHOUSE',
  MANAGER: 'MANAGER',
};

/** users.id in the seeded DB. */
export const ROLE_USER_ID: Record<Role, number> = {
  REP: 1,
  DRIVER: 2,
  WAREHOUSE: 3,
  MANAGER: 5,
};

/**
 * Where a successful login lands, per LoginBean#login:
 * WAREHOUSE -> /warehouse/receiving.xhtml, everyone else -> /dashboard.xhtml.
 */
export const LANDING_PATH: Record<Role, string> = {
  REP: '/dashboard.xhtml',
  DRIVER: '/dashboard.xhtml',
  WAREHOUSE: '/warehouse/receiving.xhtml',
  MANAGER: '/dashboard.xhtml',
};

// ---------------------------------------------------------------------------
// Login screen hooks (login.xhtml)
// ---------------------------------------------------------------------------

export const LOGIN_PATH = '/login.xhtml';

/**
 * PrimeFaces client ids contain ':' which must be escaped in a CSS selector.
 * NOTE: login.xhtml's <label for="phone"> does NOT match the generated client id
 * `loginForm:phone`, so getByLabel() does not work — use these selectors.
 */
export const LOGIN_PHONE_INPUT = '#loginForm\\:phone';
export const LOGIN_MESSAGES = '#loginForm\\:msgs';
export const LOGIN_SUBMIT_LABEL = 'Sign In';

/**
 * Error detail texts surfaced in `loginForm:msgs`.
 * p:messages is showSummary="false" showDetail="true", so the *detail*
 * (the exception message) is what renders — the summary "Login failed" is hidden.
 */
export const LOGIN_ERROR = {
  /** NotFoundException("User", phone) — unknown phone number. */
  unknownPhone: (phone: string) => `User with id ${phone} not found`,
  /** ValidationException("USER_INACTIVE", ...) — deactivated account. */
  inactive: 'User account is inactive',
  /** p:inputText requiredMessage. */
  phoneRequired: 'Phone number is required',
} as const;

/** Fills the phone and submits. Does NOT wait for navigation. */
export async function loginViaUi(page: Page, phone: string): Promise<void> {
  await page.goto(LOGIN_PATH);
  await page.locator(LOGIN_PHONE_INPUT).fill(phone);
  await page.getByRole('button', { name: LOGIN_SUBMIT_LABEL }).click();
}

/** Logs the role in and waits for its landing route. Throws if it never lands. */
export async function loginAsRole(page: Page, role: Role): Promise<void> {
  await loginViaUi(page, ROLE_PHONE[role]);
  await page.waitForURL(`**${LANDING_PATH[role]}`, { timeout: 45_000 });
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

export type PageForRole = (role: Role) => Promise<Page>;

export interface AuthWorkerFixtures {
  /**
   * Worker-scoped storageState file per role. One UI login per role per worker;
   * every test in the worker reuses the resulting JSESSIONID cookie.
   */
  authStates: Record<Role, string>;
}

export interface AuthTestFixtures {
  /**
   * A logged-in Page for `role`, reusing the worker's storageState (fast, but
   * the JSF HttpSession — and therefore the @SessionScoped
   * CreateReturnWizardBean — is shared with the rest of the worker).
   * Contexts are closed automatically after the test.
   */
  pageForRole: PageForRole;

  /**
   * A logged-in Page in a BRAND NEW browser context that performs a real UI
   * login, i.e. a guaranteed-fresh HttpSession. Use this for the wizard specs
   * (CreateReturnWizardBean is @SessionScoped and leaks across tests otherwise)
   * and anywhere a test asserts on session lifecycle.
   */
  loginAs: PageForRole;

  repPage: Page;
  driverPage: Page;
  warehousePage: Page;
  managerPage: Page;
}

async function statesForWorker(
  browser: import('@playwright/test').Browser,
  baseURL: string | undefined,
  workerIndex: number,
): Promise<Record<Role, string>> {
  fs.mkdirSync(AUTH_STATE_DIR, { recursive: true });
  const states = {} as Record<Role, string>;

  for (const role of ROLES) {
    const file = path.join(AUTH_STATE_DIR, `${role.toLowerCase()}-w${workerIndex}.json`);
    const context = await browser.newContext(baseURL ? { baseURL } : {});
    try {
      const page = await context.newPage();
      await loginAsRole(page, role);
      await context.storageState({ path: file });
    } finally {
      await context.close();
    }
    states[role] = file;
  }
  return states;
}

export const test = base.extend<AuthTestFixtures, AuthWorkerFixtures>({
  authStates: [
    async ({ browser }, use, workerInfo) => {
      const baseURL = workerInfo.project.use.baseURL;
      const states = await statesForWorker(browser, baseURL, workerInfo.workerIndex);
      await use(states);
    },
    { scope: 'worker' },
  ],

  pageForRole: async ({ browser, baseURL, authStates }, use) => {
    const opened: BrowserContext[] = [];
    await use(async (role: Role) => {
      const context = await browser.newContext({
        ...(baseURL ? { baseURL } : {}),
        storageState: authStates[role],
      });
      opened.push(context);
      return context.newPage();
    });
    for (const context of opened) await context.close();
  },

  loginAs: async ({ browser, baseURL }, use) => {
    const opened: BrowserContext[] = [];
    await use(async (role: Role) => {
      const context = await browser.newContext(baseURL ? { baseURL } : {});
      opened.push(context);
      const page = await context.newPage();
      await loginAsRole(page, role);
      return page;
    });
    for (const context of opened) await context.close();
  },

  repPage: async ({ pageForRole }, use) => {
    await use(await pageForRole('REP'));
  },
  driverPage: async ({ pageForRole }, use) => {
    await use(await pageForRole('DRIVER'));
  },
  warehousePage: async ({ pageForRole }, use) => {
    await use(await pageForRole('WAREHOUSE'));
  },
  managerPage: async ({ pageForRole }, use) => {
    await use(await pageForRole('MANAGER'));
  },
});
