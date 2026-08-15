/**
 * JOURNEY 2 — ROLES.
 *
 * The plan's role -> route access matrix, driven as a table test over
 * `e2e/inventory/routes-and-controls.ts` (the single source of truth for which role may open
 * which route — do not restate the matrix here).
 *
 * Three rules are asserted:
 *
 *   1. Access matrix. For every role x every route: an ALLOWED route renders that screen; a
 *      FORBIDDEN route REDIRECTS — never a 5xx, never the rendered screen. The redirect target
 *      is deliberately not pinned to one path (the plan does not name one); it must simply be
 *      another route the acting role is allowed to use.
 *   2. Nav. `layout.xhtml` renders only the links the role may actually follow.
 *   3. Logged out. A GET of any `.xhtml` lands on `/login.xhtml`.
 *
 * WHAT FAILS TODAY (all shipped as `test.fixme`, see docs/e2e-findings.md):
 *   GAP 1 — `RoleAuthFilter` never reads `user.getRole()`; it only checks that SOMEBODY is logged
 *           in. Every "is redirected away from" test below therefore fails: the forbidden screen
 *           renders in full.
 *   GAP 2 — `layout.xhtml` renders all six nav links (and all four Admin submenu links) to every
 *           role, so only the MANAGER nav test passes.
 *
 * PARALLEL SAFETY (`--workers=4`):
 *   - Read-only navigation, except the one return `data.makeReturn()` provisions for
 *     `/returns/details.xhtml`. Nothing here mutates shared state and nothing touches the seeded
 *     `RET-100xx` returns.
 *   - No absolute counts are asserted anywhere.
 *   - `pageForRole` is safe here: this spec never writes to the `@SessionScoped`
 *     `CreateReturnWizardBean`. It only GETs wizard routes, and it tolerates the step-guard
 *     bounce (`ensureStep2`/`ensureStep3` redirect back when the session has no wizard state),
 *     so a sibling test's wizard state cannot make it flaky either way.
 */

import type { Page } from '@playwright/test';
import {
  LANDING_PATH,
  LOGIN_PATH,
  ROLES,
  ROLE_SERVER_NAME,
  test,
  expect,
  type Role,
} from '../fixtures';
import {
  LAYOUT_CONTROLS,
  ROUTES,
  routeByPath,
  type RouteSpec,
} from '../inventory/routes-and-controls';
import {
  ADMIN_LINK_NAMES,
  isScreenAssertableByGet,
  LAYOUT_HEADER_SELECTOR,
  LayoutNav,
  LoginPage,
  NAV_LINK_NAMES,
  pathnameOf,
  ReturnDetailsPage,
  screenForRoute,
  WIZARD_PATHS,
  type AdminLinkName,
  type NavLinkName,
} from '../pages';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Paths an ALLOWED navigation may legitimately end on.
 *
 * `/returns/create.xhtml` is a pure `f:viewAction` bounce to step 1, and the wizard step guards
 * (`CreateReturnWizardBean.ensureStep2` / `ensureStep3`) send you back one or two steps when the
 * session carries no customer / no selected purchase. All of those are "the role got in".
 */
function allowedLandingPaths(route: RouteSpec): string[] {
  switch (route.id) {
    case 'create-return':
      return [WIZARD_PATHS.step1];
    case 'wizard-step2':
      return [WIZARD_PATHS.step2, WIZARD_PATHS.step1];
    case 'wizard-step3':
      return [WIZARD_PATHS.step3, WIZARD_PATHS.step2, WIZARD_PATHS.step1];
    default:
      return [route.path];
  }
}

/** Navigate and return the HTTP status of the final response, asserting one came back. */
async function navigate(page: Page, url: string): Promise<number> {
  const response = await page.goto(url);
  const status = response?.status() ?? 0;
  expect(status, `GET ${url} produced no HTTP response`).toBeGreaterThan(0);
  return status;
}

/** The role may open this route: the screen renders and we are not on the login page. */
async function expectRouteAllowed(
  page: Page,
  route: RouteSpec,
  role: Role,
  query = '',
): Promise<void> {
  const url = `${route.path}${query}`;
  const status = await navigate(page, url);
  expect(status, `GET ${url} as ${role} must not fail (got HTTP ${status})`).toBeLessThan(400);

  if (route.id === 'login') {
    // /login.xhtml is exempt from the route guard for everybody, logged in or not.
    await new LoginPage(page).expectLoaded();
    return;
  }

  const destination = pathnameOf(page);
  expect(destination, `${role} was bounced to the login screen from ${url}`).not.toBe(LOGIN_PATH);
  expect(
    allowedLandingPaths(route),
    `${role} opened ${url} and unexpectedly ended on ${destination}`,
  ).toContain(destination);

  // Every allowed landing above renders inside layout.xhtml — the header proves a real app
  // screen came back rather than an error body.
  await expect(page.locator(LAYOUT_HEADER_SELECTOR)).toBeVisible();

  // Wizard steps 2/3 and the `create-return` bounce have no single screen to assert — a direct GET
  // legitimately lands one or two steps back. `isScreenAssertableByGet` is the shared rule.
  if (isScreenAssertableByGet(route.id)) await screenForRoute(route.id, page).expectLoaded();
}

/**
 * The role may NOT open this route: it is redirected somewhere it IS allowed.
 * Explicitly not a 5xx, and explicitly not the forbidden screen.
 */
async function expectRouteDenied(page: Page, route: RouteSpec, role: Role): Promise<void> {
  const status = await navigate(page, route.path);
  expect(
    status,
    `GET ${route.path} as ${role} must redirect, not fail (got HTTP ${status})`,
  ).toBeLessThan(400);

  const destination = pathnameOf(page);
  expect(
    destination,
    `${role} must not be served ${route.path} — the route guard let the forbidden screen render`,
  ).not.toBe(route.path);

  const landed = routeByPath(destination);
  expect(
    landed,
    `${role} was redirected from ${route.path} to ${destination}, which is not a known route`,
  ).toBeTruthy();
  if (!landed) return; // unreachable: the expect above throws first — narrows the type.

  expect(
    landed.allowedRoles,
    `${role} was redirected from ${route.path} into ${destination}, which ${role} may not use either`,
  ).toContain(role);
}

/** Top-level nav links the role should see, derived from the inventory's per-control roles. */
function navLinksFor(role: Role): NavLinkName[] {
  return NAV_LINK_NAMES.filter((name) => {
    const control = LAYOUT_CONTROLS.find((c) => c.id === `nav-${name}`);
    if (!control) throw new Error(`inventory is missing the layout control "nav-${name}"`);
    return !control.roles || control.roles.includes(role);
  });
}

/** Admin submenu links the role should see. */
function adminLinksFor(role: Role): AdminLinkName[] {
  return ADMIN_LINK_NAMES.filter((name) => {
    const control = LAYOUT_CONTROLS.find((c) => c.id === `nav-admin-${name}`);
    if (!control) throw new Error(`inventory is missing the layout control "nav-admin-${name}"`);
    return !control.roles || control.roles.includes(role);
  });
}

// ---------------------------------------------------------------------------
// 1. Logged out — every .xhtml bounces to /login.xhtml
// ---------------------------------------------------------------------------

test.describe('logged out', () => {
  test('logged out: /login.xhtml renders the sign-in form', async ({ page }) => {
    const login = new LoginPage(page);
    await login.open();
    await expect(login.submit).toBeEnabled();
  });

  for (const route of ROUTES.filter((r) => r.id !== 'login')) {
    test(`logged out: ${route.path} redirects to ${LOGIN_PATH}`, async ({ page }) => {
      const status = await navigate(page, route.path);
      expect(
        status,
        `an anonymous GET ${route.path} must redirect, not fail (got HTTP ${status})`,
      ).toBeLessThan(400);

      expect(
        pathnameOf(page),
        `an anonymous GET ${route.path} must land on the login screen`,
      ).toBe(LOGIN_PATH);
      await new LoginPage(page).expectLoaded();
    });
  }
});

// ---------------------------------------------------------------------------
// 2. The role -> route access matrix
// ---------------------------------------------------------------------------

test.describe('role -> route access matrix', () => {
  for (const role of ROLES) {
    test.describe(`${role} (${ROLE_SERVER_NAME[role]})`, () => {
      for (const route of ROUTES) {
        if (route.allowedRoles.includes(role)) {
          test(`${role} may open ${route.path}`, async ({ pageForRole, data }) => {
            const page = await pageForRole(role);

            if (route.id === 'return-details') {
              // Never reuse the seeded RET-100xx rows: provision this test's own return.
              const seeded = await data.makeReturn();
              await expectRouteAllowed(page, route, role, `?id=${seeded.id}`);
              await new ReturnDetailsPage(page).expectHeaderId(seeded.id);
              return;
            }

            await expectRouteAllowed(page, route, role);
          });
        } else {
          test.fixme(`${role} is redirected away from ${route.path}`, async ({ pageForRole }) => {
            // GAP 1 — RoleAuthFilter (server/src/main/java/com/drb/server/web/RoleAuthFilter.java)
            // only checks that `loggedInUser` exists in the session; it never reads
            // `user.getRole()`. Every logged-in role therefore reaches every .xhtml, so the
            // forbidden screen renders instead of redirecting. See docs/e2e-findings.md.
            const page = await pageForRole(role);
            await expectRouteDenied(page, route, role);
          });
        }
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 3. layout.xhtml nav renders only the links the role may use
// ---------------------------------------------------------------------------

test.describe('layout nav visibility', () => {
  for (const role of ROLES) {
    const expectedNav = navLinksFor(role);
    const expectedAdmin = adminLinksFor(role);

    const title = `${role} nav renders exactly [${expectedNav.join(', ')}]`;

    const body = async (page: Page): Promise<void> => {
      // Land on the role's own landing route, which every role is allowed to open.
      await navigate(page, LANDING_PATH[role]);
      const nav = new LayoutNav(page);
      await expect(nav.header).toBeVisible();

      expect(
        await nav.renderedLinks(),
        `${role} must see exactly the nav links for the routes ${role} may open`,
      ).toEqual(expectedNav);

      expect(
        await nav.renderedAdminLinks(),
        `${role} must see exactly the Admin submenu links for the admin routes ${role} may open`,
      ).toEqual(expectedAdmin);

      // Logout is the one header control every role always gets.
      await expect(nav.logout).toBeVisible();
      await expect(nav.logoutForm).toHaveCount(1);
    };

    if (role === 'MANAGER') {
      // MANAGER may use all six nav links and all four admin links, so GAP 2 does not bite here.
      test(title, async ({ pageForRole }) => {
        await body(await pageForRole(role));
      });
    } else {
      test.fixme(title, async ({ pageForRole }) => {
        // GAP 2 — WEB-INF/templates/layout.xhtml renders all six top-level nav links and all four
        // Admin submenu links unconditionally (no `rendered=` on any of them), so REP, DRIVER and
        // WAREHOUSE are all offered Warehouse / Reports / Admin. See docs/e2e-findings.md.
        await body(await pageForRole(role));
      });
    }
  }

  test('the Admin submenu is reachable for MANAGER and every entry points at an admin route', async ({
    managerPage,
  }) => {
    await navigate(managerPage, LANDING_PATH.MANAGER);
    const nav = new LayoutNav(managerPage);
    await nav.openAdminMenu();

    for (const name of adminLinksFor('MANAGER')) {
      const link = nav.adminLink(name);
      await expect(link).toBeVisible();

      const href = await link.getAttribute('href');
      expect(href, `Admin submenu link "${name}" must have an href`).toBeTruthy();

      const target = routeByPath(new URL(href ?? '', managerPage.url()).pathname);
      expect(target, `Admin submenu link "${name}" must point at a known route`).toBeTruthy();
      if (!target) return; // unreachable: the expect above throws first.
      expect(target.allowedRoles).toContain('MANAGER');
    }
  });
});
