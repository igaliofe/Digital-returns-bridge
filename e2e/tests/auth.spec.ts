/**
 * Journey 1 — authentication.
 *
 * Covers, per docs/e2e-test-plan.md and the plan's journey list:
 *   - valid login for all four seeded actors, including DRIVER (0502222222),
 *     landing on /warehouse/receiving.xhtml for WAREHOUSE and /dashboard.xhtml otherwise;
 *   - unknown phone -> the NOT_FOUND detail inside #loginForm:msgs with NO navigation;
 *   - blank phone -> the requiredMessage, also without navigating;
 *   - a user deactivated over the API -> USER_INACTIVE, rejected at the login screen;
 *   - logout invalidates the HttpSession, and the browser back button cannot re-enter.
 *
 * Parallel safety (`--workers=4`):
 *   - every test drives its OWN browser context (`page` is anonymous, `loginAs` mints a
 *     brand-new HttpSession), so nothing here can invalidate a session another test is using —
 *     `LoginBean#logout` kills exactly one TokenStore UUID plus its own session;
 *   - the only row this spec writes is a freshly created user on a worker-namespaced phone
 *     (`data.nextPhone()`), so no seeded actor is ever deactivated;
 *   - no seeded RET-100xx return is read or mutated, and nothing asserts an absolute count.
 *
 * No test.fixme here: none of the five known gaps in docs/e2e-findings.md land on this journey
 * (they are the role filter, the nav links, admin row-edit, ?id=abc, and the priority list).
 */

import type { Page } from '@playwright/test';
import {
  expect,
  LANDING_PATH,
  LOGIN_ERROR,
  LOGIN_PATH,
  ROLE_FULL_NAME,
  ROLE_PHONE,
  ROLES,
  test,
} from '../fixtures';
import { DashboardPage, LayoutNav, LoginPage, WarehouseReceivingPage } from '../pages';

/**
 * Records the path of every main-frame navigation from the moment it is called.
 *
 * A rejected login must never leave `/login.xhtml`. The button is a `p:commandButton`,
 * so in practice the error arrives as a partial update of `#loginForm:msgs` and nothing
 * navigates at all — but asserting on the *paths* rather than on "zero events" keeps the
 * check about the requirement (we never reached an authenticated screen) instead of about
 * whether PrimeFaces chose ajax or a full postback.
 */
function trackNavigatedPaths(page: Page): string[] {
  const seen: string[] = [];
  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame()) return;
    const raw = frame.url();
    if (!raw.startsWith('http')) return; // ignore about:blank
    seen.push(new URL(raw).pathname);
  });
  return seen;
}

/** Every navigation the tracker saw (if any) stayed on the login route. */
function expectNeverLeftLogin(paths: string[]): void {
  expect(
    paths.filter((p) => p !== LOGIN_PATH),
    'a rejected login must not navigate away from /login.xhtml',
  ).toEqual([]);
}

test.describe('Journey 1 — authentication', () => {
  // -------------------------------------------------------------------------
  // Valid login
  // -------------------------------------------------------------------------

  test.describe('valid login', () => {
    for (const role of ROLES) {
      test(`${role} (${ROLE_PHONE[role]}) signs in and lands on ${LANDING_PATH[role]}`, async ({
        page,
      }) => {
        const login = new LoginPage(page);
        await login.open();
        await login.loginAs(role);

        expect(new URL(page.url()).pathname).toBe(LANDING_PATH[role]);

        // The landing screen must actually render — not a 500 and not a bounce back to login.
        if (role === 'WAREHOUSE') {
          await new WarehouseReceivingPage(page).expectLoaded();
        } else {
          await new DashboardPage(page).expectLoaded();
        }

        // The session carries the right user: layout.xhtml renders the first two
        // characters of sessionScope.loggedInUser.fullName in the avatar chip.
        const nav = new LayoutNav(page);
        await expect(nav.header).toBeVisible();
        expect(await nav.avatarInitials()).toBe(ROLE_FULL_NAME[role].slice(0, 2));
        await expect(nav.logout).toBeVisible();
      });
    }

    test('DRIVER gets the same web landing as SERVICE_REP — a fully rendered dashboard', async ({
      page,
    }) => {
      // CONTEXT/plan decision: DRIVER has the same web rights as SERVICE_REP; the
      // Android pickup flow is an additional surface, not a replacement.
      expect(LANDING_PATH.DRIVER).toBe(LANDING_PATH.REP);

      const login = new LoginPage(page);
      await login.open();
      await login.loginAs('DRIVER');

      const dashboard = new DashboardPage(page);
      await dashboard.expectLoaded();
      // All 8 tiles present and numeric. Tile COUNT only — never an absolute KPI value,
      // because sibling workers are creating returns at the same time.
      await dashboard.expectAllKpisNumeric();
    });
  });

  // -------------------------------------------------------------------------
  // Rejected login
  // -------------------------------------------------------------------------

  test.describe('rejected login', () => {
    test('an unknown phone number is rejected in #loginForm:msgs without navigating', async ({
      page,
      data,
      api,
    }) => {
      // Worker-namespaced and monotonic, so no other worker can have registered it.
      const phone = data.nextPhone();
      expect(await api.findUserByPhone(phone)).toBeNull();

      const login = new LoginPage(page);
      await login.open();

      const navigated = trackNavigatedPaths(page);
      await login.login(phone);

      await login.expectUnknownPhoneError(phone);
      await login.expectStillOnLogin();
      expect(new URL(page.url()).pathname).toBe(LOGIN_PATH);
      expectNeverLeftLogin(navigated);

      // Nothing was created as a side effect of the failed attempt.
      expect(await api.findUserByPhone(phone)).toBeNull();
    });

    test('submitting an empty phone number shows the required message without navigating', async ({
      page,
    }) => {
      const login = new LoginPage(page);
      await login.open();

      const navigated = trackNavigatedPaths(page);
      await login.submitEmpty();

      await login.expectPhoneRequired();
      await login.expectStillOnLogin();
      expectNeverLeftLogin(navigated);
    });

    test('a deactivated user cannot sign in', async ({ page, data, api }) => {
      const phone = data.nextPhone();
      const fullName = data.uniqueName('inactive');

      const created = await api.createUser({
        phoneNumber: phone,
        fullName,
        role: 'SERVICE_REP',
      });
      expect(created.active, 'a newly created user starts active').toBe(true);

      // PATCH /api/users/{id}/active?active=false answers 204, so re-read to confirm.
      await api.setUserActive(created.id, false);
      const deactivated = await api.findUserByPhone(phone);
      expect(deactivated?.active, 'the user must be inactive before we try to log in').toBe(false);

      const login = new LoginPage(page);
      await login.open();

      const navigated = trackNavigatedPaths(page);
      await login.login(phone);

      // AuthService throws ValidationException("USER_INACTIVE") *after* finding the user,
      // so the detail must be the inactive text, never the not-found text.
      await login.expectInactiveError();
      expect(await login.errorTexts()).not.toContain(LOGIN_ERROR.unknownPhone(phone));
      await login.expectStillOnLogin();
      expectNeverLeftLogin(navigated);

      // No session was minted for the rejected user: the protected route still bounces.
      const probe = await page.request.get('/dashboard.xhtml');
      expect(new URL(probe.url()).pathname).toBe(LOGIN_PATH);
    });
  });

  // -------------------------------------------------------------------------
  // Session lifecycle
  // -------------------------------------------------------------------------

  test.describe('session lifecycle', () => {
    test('an anonymous visitor asking for /dashboard.xhtml is redirected to /login.xhtml', async ({
      page,
    }) => {
      const dashboard = new DashboardPage(page);
      // goto(), not open() — the point of the test is that we never land on the route.
      await dashboard.goto();
      await dashboard.expectRedirectedToLogin();
      await new LoginPage(page).expectLoaded();
      await new LayoutNav(page).expectNoAppChrome();
    });

    test('logout invalidates the HttpSession server-side', async ({ loginAs }) => {
      // loginAs (not managerPage): this test destroys its session, and the worker's
      // storageState session is shared by every other test in the worker.
      const page = await loginAs('MANAGER');
      const dashboard = new DashboardPage(page);
      await dashboard.expectLoaded();

      await dashboard.nav.logoutAndWait();
      await new LoginPage(page).expectLoaded();

      // Same cookie jar, straight to the server: LoginBean#logout invalidated the session
      // and dropped the token, so RoleAuthFilter must bounce this to /login.xhtml.
      const afterLogout = await page.request.get('/dashboard.xhtml');
      expect(afterLogout.ok()).toBe(true);
      expect(new URL(afterLogout.url()).pathname).toBe(LOGIN_PATH);
    });

    test('after logout the browser back button cannot re-enter the app', async ({ loginAs }) => {
      const page = await loginAs('MANAGER');
      const dashboard = new DashboardPage(page);
      await dashboard.expectLoaded();
      const protectedUrl = page.url();

      await dashboard.nav.logoutAndWait();
      await new LoginPage(page).expectLoaded();

      // Step back onto the dashboard history entry.
      await page.goBack();

      // Whatever the browser paints from its own back/forward cache, the app must not be
      // re-enterable: the very next round-trip on that entry has to bounce to /login.xhtml,
      // because the session behind the JSESSIONID cookie no longer exists.
      await page.reload();
      await expect(page).toHaveURL(/\/login\.xhtml/);
      await expect(page.locator('#loginForm')).toBeVisible();
      await new LayoutNav(page).expectNoAppChrome();

      // And the same holds for a fresh hit on the exact URL we were on before logging out.
      await page.goto(protectedUrl);
      await new LoginPage(page).expectLoaded();
    });
  });
});
