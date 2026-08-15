/**
 * ROUTE + CONTROL SMOKE — generated from `e2e/inventory/routes-and-controls.ts`.
 *
 * Two guarantees, both driven off the inventory rather than off hand-written lists:
 *
 *  1. RENDERS CLEAN — for every route x every role the plan's matrix allows, the screen loads
 *     (no 5xx anywhere in the page's network traffic, no uncaught JavaScript, no error-severity
 *     `p:messages`) and every non-conditional control the inventory lists for that role is
 *     visible and enabled.
 *
 *  2. CONTROLS DO WHAT THEY DECLARE — every `nav` and `ajax` control is clicked and its
 *     `effect` is asserted. `dialog` and `destructive` controls are asserted present only
 *     (a dialog control is still opened when a conditional control behind it needs the state).
 *
 * Deliberate exemptions from "every nav/ajax control is clicked", each covered by the owning
 * journey spec instead:
 *
 *   wizard-step3 `create`   — clicking it flips `customer_purchases.handled`, and purchases are a
 *                             finite seeded resource with no API that creates more. Asserted
 *                             visible+enabled by the render-clean test; exercised by wizard.spec.ts.
 *   admin `dialog-save`     — the success branch creates a row that only the UI can delete.
 *                             Here we click it on a blank form and assert the *validation* branch
 *                             of its declared effect (dialog stays open); admin.spec.ts owns the
 *                             create branch and its cleanup.
 *   admin `row-delete`      — destructive, presence-only per the inventory's `kind`.
 *
 * Parallel safety (`--workers=4`):
 *   - no seeded `RET-100xx` return is ever read or mutated; every return used here comes from
 *     `data.makeReturn()` and is owned by the test that made it;
 *   - no absolute counts are asserted — only this test's own rows, or before/after deltas taken
 *     inside one page;
 *   - the wizard is `@SessionScoped`, so every wizard test uses `loginAs` (fresh context AND fresh
 *     HttpSession), never `repPage`/`pageForRole`;
 *   - `logout` destroys the session it runs in, so it also uses `loginAs`.
 *
 * Known gaps ship as `test.fixme` citing docs/e2e-findings.md.
 */

import type { Locator, Page, Request } from '@playwright/test';
import {
  expect,
  test,
  ITEM_CONDITIONS,
  LOGIN_PATH,
  ROLES,
  ROLE_SERVER_NAME,
  WAREHOUSE_DECISIONS,
  type DataFactory,
  type PageForRole,
  type Role,
} from '../fixtures';
import {
  LAYOUT_CONTROLS,
  ROUTES,
  controlOn,
  requiredControlsOn,
  routeById,
  routeByPath,
  type ControlSpec,
  type RouteId,
  type RouteSpec,
} from '../inventory/routes-and-controls';
import {
  ADMIN_LINK_NAMES,
  AdminCrudPage,
  AdminCustomersPage,
  AdminDriversPage,
  AdminProductsPage,
  AdminUsersPage,
  CreateReturnWizard,
  DashboardPage,
  driveToStep2 as driveWizardToStep2,
  driveToStep3 as driveWizardToStep3,
  IdentifyCustomerPage,
  LayoutNav,
  LoginPage,
  NewReturnPage,
  pathnameOf,
  ReturnDetailsPage,
  ReturnsListPage,
  screenForRoute,
  SelectItemPage,
  wizardCustomerPhones,
  WarehouseReceivingPage,
  WIZARD_PATHS,
} from '../pages';

// ---------------------------------------------------------------------------
// Runtime-error watchdog
// ---------------------------------------------------------------------------

/** Any `p:messages` / `p:message` block rendering an error or fatal severity. */
const ERROR_MESSAGE_SELECTOR =
  '.ui-messages-error, .ui-messages-fatal, .ui-message-error, .ui-message-fatal';

interface Watchdog {
  readonly pageErrors: string[];
  readonly serverErrors: string[];
}

/** Start recording uncaught page exceptions and any 5xx the page provokes. */
function watchPage(page: Page): Watchdog {
  const pageErrors: string[] = [];
  const serverErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 500) {
      serverErrors.push(`HTTP ${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });
  return { pageErrors, serverErrors };
}

async function expectNoRuntimeErrors(page: Page, watch: Watchdog, label: string): Promise<void> {
  expect(watch.serverErrors, `${label}: the server answered 5xx`).toEqual([]);
  expect(watch.pageErrors, `${label}: uncaught JavaScript error on the page`).toEqual([]);
  await expect(
    page.locator(ERROR_MESSAGE_SELECTOR),
    `${label}: an error-severity message rendered on a plain page load`,
  ).toHaveCount(0);
}

// ---------------------------------------------------------------------------
// Arriving on a route
// ---------------------------------------------------------------------------

interface Ctx {
  pageForRole: PageForRole;
  loginAs: PageForRole;
  data: DataFactory;
}

interface Arrival {
  page: Page;
  watch: Watchdog;
  /** HTTP status of the document request, when the arrival was a single plain navigation. */
  status?: number;
  /** `return-details` only: the id of the return provisioned for this test. */
  returnId?: number;
}

/**
 * Step 1 -> step 2. `needSelectable` also requires the customer to still have an Available row.
 * The customer-retry logic lives in `pages/wizard.ts` — `coverage.spec.ts` drives it too.
 */
async function driveToStep2(
  page: Page,
  data: DataFactory,
  needSelectable = false,
): Promise<SelectItemPage> {
  return (await driveWizardToStep2(page, data, needSelectable)).step2;
}

/** Step 1 -> step 2 -> step 3, on the first still-Available purchase. */
async function driveToStep3(page: Page, data: DataFactory): Promise<NewReturnPage> {
  return (await driveWizardToStep3(page, data)).step3;
}

/** Put `role` on `routeId`, in the state the route needs in order to actually render. */
async function arriveAt(routeId: RouteId, role: Role, ctx: Ctx): Promise<Arrival> {
  const route = routeById(routeId);

  switch (routeId) {
    case 'wizard-step1': {
      const page = await ctx.loginAs(role);
      const watch = watchPage(page);
      await new IdentifyCustomerPage(page).gotoViaEntry();
      return { page, watch };
    }
    case 'wizard-step2': {
      const page = await ctx.loginAs(role);
      const watch = watchPage(page);
      await driveToStep2(page, ctx.data);
      return { page, watch };
    }
    case 'wizard-step3': {
      const page = await ctx.loginAs(role);
      const watch = watchPage(page);
      await driveToStep3(page, ctx.data);
      return { page, watch };
    }
    case 'return-details': {
      const page = await ctx.pageForRole(role);
      const watch = watchPage(page);
      const seeded = await ctx.data.makeReturn();
      const response = await page.goto(`${route.path}?id=${seeded.id}`);
      return { page, watch, status: response?.status(), returnId: seeded.id };
    }
    default: {
      const page = await ctx.pageForRole(role);
      const watch = watchPage(page);
      const response = await page.goto(route.path);
      return { page, watch, status: response?.status() };
    }
  }
}

/** Where an arrival on this route may legitimately end up. */
function expectedLandings(route: RouteSpec): string[] {
  return route.id === 'create-return' ? [WIZARD_PATHS.step1] : [route.path];
}

// ---------------------------------------------------------------------------
// Control assertions
// ---------------------------------------------------------------------------

async function expectControlReady(page: Page, control: ControlSpec, label: string): Promise<void> {
  const locator = page.locator(control.selector);
  const count = await locator.count();
  expect(
    count,
    `${label}: control "${control.id}" (${control.label}) matched nothing — selector ${control.selector}`,
  ).toBeGreaterThan(0);
  await expect(
    locator.first(),
    `${label}: control "${control.id}" (${control.label}) is not visible`,
  ).toBeVisible();
  await expect(
    locator.first(),
    `${label}: control "${control.id}" (${control.label}) is not enabled`,
  ).toBeEnabled();
}

function layoutControl(id: string): ControlSpec {
  const found = LAYOUT_CONTROLS.find((control) => control.id === id);
  if (!found) throw new Error(`inventory is missing layout control "${id}"`);
  return found;
}

/** `targetPath` without its query string. Throws when a `nav` control forgot to declare one. */
function navTarget(control: ControlSpec): string {
  const target = control.targetPath;
  if (!target) throw new Error(`control "${control.id}" is kind "nav" but declares no targetPath`);
  return target.split('?')[0];
}

/** Click a `nav` control and require it to land exactly on `expectedPath`. */
async function clickAndLandOn(
  page: Page,
  target: Locator,
  expectedPath: string,
  label: string,
): Promise<void> {
  await Promise.all([
    page.waitForURL((url) => url.pathname === expectedPath, { timeout: 45_000 }),
    target.click(),
  ]);
  expect(pathnameOf(page), label).toBe(expectedPath);
}

/**
 * Click a `nav` control whose target route this role may NOT use: the route guard must send us
 * somewhere the role IS allowed, and must never serve the forbidden screen. The destination is
 * deliberately not pinned — the plan only says "redirect, not a 500, not a rendered page".
 */
async function clickAndExpectGuardRedirect(
  page: Page,
  target: Locator,
  forbiddenPath: string,
  role: Role,
): Promise<void> {
  const navigated = page.waitForEvent('framenavigated', {
    predicate: (frame) => frame === page.mainFrame(),
    timeout: 45_000,
  });
  await target.click();
  await navigated;
  await page.waitForLoadState('domcontentloaded');

  const landing = pathnameOf(page);
  expect(
    landing,
    `${role} must not be served ${forbiddenPath} — the route guard let the forbidden screen render`,
  ).not.toBe(forbiddenPath);

  const landed = routeByPath(landing);
  expect(landed, `${role} was redirected to ${landing}, which is not a known route`).toBeTruthy();
  if (!landed) return; // unreachable — the expect above throws first; this narrows the type.
  expect(
    landed.allowedRoles,
    `${role} was redirected into ${landing}, which ${role} may not use either`,
  ).toContain(role);
}

// ===========================================================================
// 1. Every route renders clean for every allowed role
// ===========================================================================

test.describe('routes render clean', () => {
  test('/login.xhtml renders clean for an anonymous visitor', async ({ page }) => {
    const watch = watchPage(page);
    const response = await page.goto(LOGIN_PATH);
    expect(response?.status(), 'GET /login.xhtml').toBeLessThan(400);

    await new LoginPage(page).expectLoaded();
    await expectNoRuntimeErrors(page, watch, '/login.xhtml anonymous');
    await expectControlReady(page, controlOn('login', 'sign-in'), '/login.xhtml anonymous');
  });

  test.fixme(
    '/returns/details.xhtml?id=abc answers with the not-found state, never a 5xx',
    async ({ pageForRole }) => {
      // GAP 4 — ReturnDetailsBean.init() does a bare Long.parseLong(idParam) inside @PostConstruct
      // and web.xml declares no <error-page>, so a hand-edited id becomes a raw stack-trace 500.
      // See docs/e2e-findings.md.
      const page = await pageForRole('MANAGER');
      const response = await page.goto('/returns/details.xhtml?id=abc');
      expect(response?.status(), 'a non-numeric ?id must not fail the request').toBeLessThan(400);
      await new ReturnDetailsPage(page).expectNotFound();
    },
  );

  for (const route of ROUTES) {
    // /login.xhtml is covered above, logged out, which is the only state that matters for it.
    if (route.id === 'login') continue;

    for (const role of route.allowedRoles) {
      test(`${route.path} renders clean for ${role} (${ROLE_SERVER_NAME[role]})`, async ({
        pageForRole,
        loginAs,
        data,
      }) => {
        const label = `${route.path} as ${role}`;
        const arrival = await arriveAt(route.id, role, { pageForRole, loginAs, data });
        const { page, watch } = arrival;

        if (arrival.status !== undefined) {
          expect(arrival.status, `${label}: document request failed`).toBeLessThan(400);
        }

        const landing = pathnameOf(page);
        expect(landing, `${label}: bounced to the login screen`).not.toBe(LOGIN_PATH);
        expect(expectedLandings(route), `${label}: ended on ${landing}`).toContain(landing);

        await screenForRoute(route.id, page).expectLoaded();
        if (arrival.returnId !== undefined) {
          await new ReturnDetailsPage(page).expectHeaderId(arrival.returnId);
        }

        await expectNoRuntimeErrors(page, watch, label);

        for (const control of requiredControlsOn(route.id, role)) {
          await expectControlReady(page, control, label);
        }
      });
    }
  }
});

// ===========================================================================
// 2. layout.xhtml — nav links and logout
// ===========================================================================

test.describe('layout controls', () => {
  for (const role of ROLES) {
    test(`layout nav links land on their declared targets for ${role}`, async ({ pageForRole }) => {
      const page = await pageForRole(role);
      const nav = new LayoutNav(page);

      const topLevel = [
        layoutControl('layout-logo'),
        ...LAYOUT_CONTROLS.filter(
          (control) =>
            control.id.startsWith('nav-') &&
            !control.id.startsWith('nav-admin-') &&
            (!control.roles || control.roles.includes(role)),
        ),
      ];

      for (const control of topLevel) {
        const target = navTarget(control);
        // Always start somewhere else, so "the URL changed" is a real assertion.
        await page.goto(target === '/returns/list.xhtml' ? '/dashboard.xhtml' : '/returns/list.xhtml');
        await clickAndLandOn(
          page,
          page.locator(control.selector),
          target,
          `layout "${control.label}" as ${role}`,
        );
      }

      // The submenu is display:none until .drb-admin-dropdown is hovered — goAdmin() hovers first.
      for (const name of ADMIN_LINK_NAMES) {
        const control = layoutControl(`nav-admin-${name}`);
        if (control.roles && !control.roles.includes(role)) continue;
        await page.goto('/dashboard.xhtml');
        await nav.goAdmin(name);
        expect(pathnameOf(page), `layout admin submenu "${control.label}" as ${role}`).toBe(
          navTarget(control),
        );
      }
    });

    // `loginAs` gives this test its own HttpSession: logging out of the worker's shared
    // per-role session would break every later test in the worker.
    test(`logout ends the session and blocks re-entry for ${role}`, async ({ loginAs }) => {
      const page = await loginAs(role);
      const login = new LoginPage(page);

      await page.goto('/dashboard.xhtml');
      await new LayoutNav(page).logoutAndWait();
      await login.expectLoaded();

      // The session is gone: the guard must bounce a fresh request straight back to login.
      await page.goto('/dashboard.xhtml');
      await login.expectLoaded();
    });
  }
});

// ===========================================================================
// 3. /login.xhtml — sign-in
// ===========================================================================

test.describe('login controls', () => {
  test('login: "Sign In" with a blank phone reports the requirement and does not navigate', async ({
    page,
  }) => {
    const login = new LoginPage(page);
    await login.open();
    await login.submitEmpty();
    await login.expectPhoneRequired();
    await login.expectStillOnLogin();
  });
});

// ===========================================================================
// 4. /dashboard.xhtml — the four p:button shortcuts
// ===========================================================================

test.describe('dashboard controls', () => {
  const DASHBOARD_BUTTONS = ['new-return', 'view-all-returns', 'reports', 'warehouse-receiving'];

  for (const role of ROLES) {
    for (const controlId of DASHBOARD_BUTTONS) {
      const control = controlOn('dashboard', controlId);
      const targetRouteId = control.targetRouteId;
      if (!targetRouteId) throw new Error(`dashboard control "${controlId}" declares no targetRouteId`);
      const targetRoute = routeById(targetRouteId);
      const allowed = targetRoute.allowedRoles.includes(role);

      if (allowed) {
        test(`dashboard: "${control.label}" takes ${role} to ${navTarget(control)}`, async ({
          pageForRole,
        }) => {
          const page = await pageForRole(role);
          await new DashboardPage(page).open();
          await clickAndLandOn(
            page,
            page.locator(control.selector),
            navTarget(control),
            `dashboard "${control.label}" as ${role}`,
          );
        });
      } else {
        test.fixme(
          `dashboard: "${control.label}" must redirect ${role} away from ${targetRoute.path}`,
          async ({ pageForRole }) => {
            // GAP 1 — RoleAuthFilter never reads user.getRole(), so the forbidden screen renders
            // for every logged-in role instead of redirecting. See docs/e2e-findings.md.
            const page = await pageForRole(role);
            await new DashboardPage(page).open();
            await clickAndExpectGuardRedirect(
              page,
              page.locator(control.selector),
              targetRoute.path,
              role,
            );
          },
        );
      }
    }
  }
});

// ===========================================================================
// 5. /returns/list.xhtml — Apply Filters, row View
// ===========================================================================

test.describe('returns list controls', () => {
  for (const role of routeById('returns-list').allowedRoles) {
    test(`returns list: "Apply Filters" re-queries in place for ${role}`, async ({
      pageForRole,
      data,
    }) => {
      const page = await pageForRole(role);
      const seeded = await data.makeReturn('BARCODE_ASSIGNED');
      const barcode = seeded.barcode;
      if (!barcode) throw new Error('makeReturn(BARCODE_ASSIGNED) produced no barcode');

      const list = new ReturnsListPage(page);
      await list.open();
      await list.filterBy({ barcode });

      // ajax, not navigation
      await expect(page).toHaveURL(/\/returns\/list\.xhtml/);
      await list.expectContainsId(seeded.id);
      // Every surviving row matches the filter — asserted on this test's own barcode, never on a
      // global row count (other workers are creating returns at the same time).
      for (const shown of await list.barcodes()) {
        expect(shown, 'Apply Filters left a row that does not match the barcode filter').toBe(
          barcode,
        );
      }
    });

    test(`returns list: the row "View" link opens that return for ${role}`, async ({
      pageForRole,
      data,
    }) => {
      const page = await pageForRole(role);
      const seeded = await data.makeReturn('BARCODE_ASSIGNED');
      const barcode = seeded.barcode;
      if (!barcode) throw new Error('makeReturn(BARCODE_ASSIGNED) produced no barcode');

      const list = new ReturnsListPage(page);
      await list.open();
      await list.filterBy({ barcode });
      await list.openDetails(seeded.id);

      const details = new ReturnDetailsPage(page);
      await details.expectLoaded();
      await details.expectHeaderId(seeded.id);
    });
  }
});

// ===========================================================================
// 6. /returns/details.xhtml — Back to List
// ===========================================================================

test.describe('return details controls', () => {
  for (const role of routeById('return-details').allowedRoles) {
    test(`return details: "Back to List" returns ${role} to the list`, async ({
      pageForRole,
      data,
    }) => {
      const page = await pageForRole(role);
      const seeded = await data.makeReturn();
      const details = new ReturnDetailsPage(page);
      await details.openId(seeded.id);
      await details.backToListAndWait();
      await new ReturnsListPage(page).expectLoaded();
    });
  }
});

// ===========================================================================
// 7. The create-return wizard
//    Every test here uses `loginAs`: CreateReturnWizardBean is @SessionScoped.
// ===========================================================================

test.describe('wizard controls', () => {
  for (const role of routeById('wizard-step1').allowedRoles) {
    test(`wizard step 1: "Find Customer" moves ${role} to step 2`, async ({ loginAs, data }) => {
      const page = await loginAs(role);
      const wizard = new CreateReturnWizard(page);
      await wizard.step1.gotoViaEntry();
      await wizard.step1.lookupAndContinue(wizardCustomerPhones(data)[0]);
      await wizard.step2.expectLoaded();
      await wizard.step2.messages.expectNoErrors();
    });

    test(`wizard step 2: "Select" moves ${role} to step 3 with the purchase applied`, async ({
      loginAs,
      data,
    }) => {
      const page = await loginAs(role);
      const step2 = await driveToStep2(page, data, true);
      const orderNumber = await step2.selectFirstAvailable();

      const step3 = new NewReturnPage(page);
      await step3.expectLoaded();
      // selectPurchase() copies the purchase onto the wizard — the order number proves it.
      await expect(step3.orderNumber).toHaveValue(orderNumber);
    });

    test(`wizard step 2: "Back" returns ${role} to step 1`, async ({ loginAs, data }) => {
      const page = await loginAs(role);
      const step2 = await driveToStep2(page, data);
      await step2.backToStep1();
      await new IdentifyCustomerPage(page).expectLoaded();
    });

    test(`wizard step 2: "Cancel" drops ${role} back on the returns list`, async ({
      loginAs,
      data,
    }) => {
      const page = await loginAs(role);
      const step2 = await driveToStep2(page, data);
      await step2.cancelToList();
      await new ReturnsListPage(page).expectLoaded();
    });

    test(`wizard step 3: "Clear Signature" wipes the pad client-side for ${role}`, async ({
      loginAs,
      data,
    }) => {
      const page = await loginAs(role);
      const step3 = await driveToStep3(page, data);

      await step3.drawSignature();
      expect(await step3.hasSignature(), 'drawing did not reach the signature input').toBe(true);

      // Declared effect: "No request is sent."
      let posts = 0;
      const countPosts = (request: Request): void => {
        if (request.method() === 'POST') posts += 1;
      };
      page.on('request', countPosts);
      await step3.clearSignaturePad();
      await expect.poll(() => step3.hasSignature()).toBe(false);
      page.off('request', countPosts);

      expect(posts, 'Clear Signature posted to the server; it is a client-side widget call').toBe(0);
      await expect(page).toHaveURL(/new-return\.xhtml/);
    });

    test(`wizard step 3: "Back" returns ${role} to step 2`, async ({ loginAs, data }) => {
      const page = await loginAs(role);
      const step3 = await driveToStep3(page, data);
      await step3.backToStep2();
      await new SelectItemPage(page).expectLoaded();
    });

    test(`wizard step 3: "Cancel" drops ${role} back on the returns list`, async ({
      loginAs,
      data,
    }) => {
      const page = await loginAs(role);
      const step3 = await driveToStep3(page, data);
      await step3.cancelToList();
      await new ReturnsListPage(page).expectLoaded();
    });
  }
});

// ===========================================================================
// 8. /warehouse/receiving.xhtml
// ===========================================================================

test.describe('warehouse receiving controls', () => {
  for (const role of routeById('warehouse-receiving').allowedRoles) {
    test(`warehouse: "Search" reports an unknown barcode and loads a known one for ${role}`, async ({
      pageForRole,
      data,
    }) => {
      const page = await pageForRole(role);
      const seeded = await data.makeReturn('PICKED_UP');
      const barcode = seeded.barcode;
      if (!barcode) throw new Error('makeReturn(PICKED_UP) produced no barcode');
      const unknown = `${data.nextBarcode()}-NOPE`;

      const warehouse = new WarehouseReceivingPage(page);
      await warehouse.open();

      await warehouse.search(unknown);
      await warehouse.expectNotFound(unknown);

      await warehouse.search(barcode);
      await warehouse.expectFound(barcode);
      expect(await warehouse.returnIdInHeader()).toBe(seeded.id);
    });

    test(`warehouse: "Mark as Arrived" moves the return into the warehouse for ${role}`, async ({
      pageForRole,
      data,
      api,
    }) => {
      const page = await pageForRole(role);
      const seeded = await data.makeReturn('PICKED_UP');
      const barcode = seeded.barcode;
      if (!barcode) throw new Error('makeReturn(PICKED_UP) produced no barcode');

      const warehouse = new WarehouseReceivingPage(page);
      await warehouse.open();
      await warehouse.search(barcode);
      expect(
        await warehouse.isMarkArrivedVisible(),
        'Mark as Arrived must render for a PICKED_UP return',
      ).toBe(true);

      await warehouse.markArrivedConfirming();

      await warehouse.expectStatus('ARRIVED_TO_WAREHOUSE');
      await api.expectStatus(seeded.id, 'ARRIVED_TO_WAREHOUSE');
      expect(
        await warehouse.isInspectionFormVisible(),
        'the inspection card must appear once the return has arrived',
      ).toBe(true);
    });

    test(`warehouse: "Request More Info" sends the return back for ${role}`, async ({
      pageForRole,
      data,
      api,
    }) => {
      const page = await pageForRole(role);
      const seeded = await data.makeReturn('ARRIVED_TO_WAREHOUSE');
      const barcode = seeded.barcode;
      if (!barcode) throw new Error('makeReturn(ARRIVED_TO_WAREHOUSE) produced no barcode');

      const warehouse = new WarehouseReceivingPage(page);
      await warehouse.open();
      await warehouse.search(barcode);
      expect(
        await warehouse.isRequestMoreInfoVisible(),
        'Request More Info must render for an ARRIVED_TO_WAREHOUSE return',
      ).toBe(true);

      await warehouse.requestMoreInfoConfirming();
      await api.expectStatus(seeded.id, 'NEEDS_MORE_INFO');
    });

    test(`warehouse: "Save Inspection" records the inspection for ${role}`, async ({
      pageForRole,
      data,
      api,
    }) => {
      const page = await pageForRole(role);
      const seeded = await data.makeReturn('ARRIVED_TO_WAREHOUSE');
      const barcode = seeded.barcode;
      if (!barcode) throw new Error('makeReturn(ARRIVED_TO_WAREHOUSE) produced no barcode');

      const warehouse = new WarehouseReceivingPage(page);
      await warehouse.open();
      await warehouse.search(barcode);
      expect(
        await warehouse.isInspectionFormVisible(),
        'the inspection card must render for an ARRIVED_TO_WAREHOUSE return',
      ).toBe(true);

      await warehouse.inspect({
        itemCondition: ITEM_CONDITIONS[0],
        decision: WAREHOUSE_DECISIONS[0],
        callFullyHandled: false,
        notes: `smoke inspection for #${seeded.id}`,
      });

      await warehouse.expectInspectionSaved();
      await api.expectStatus(seeded.id, 'INSPECTED');
      const inspection = await api.latestInspection(seeded.id);
      expect(inspection, 'no inspection came back from the API oracle').not.toBeNull();
    });
  }
});

// ===========================================================================
// 9. The four admin screens (MANAGER only)
// ===========================================================================

interface AdminScreen {
  routeId: RouteId;
  name: string;
  /** Entity word used in the info messages ("User updated"). */
  entity: string;
  /** A text column with a `p:cellEditor` — the one the row-editor tests type into. */
  editColumn: string;
  make: (page: Page) => AdminCrudPage;
}

const ADMIN_SCREENS: readonly AdminScreen[] = [
  {
    routeId: 'admin-users',
    name: 'users',
    entity: 'User',
    editColumn: 'fullName',
    make: (page) => new AdminUsersPage(page),
  },
  {
    routeId: 'admin-customers',
    name: 'customers',
    entity: 'Customer',
    editColumn: 'address',
    make: (page) => new AdminCustomersPage(page),
  },
  {
    routeId: 'admin-products',
    name: 'products',
    entity: 'Product',
    editColumn: 'category',
    make: (page) => new AdminProductsPage(page),
  },
  {
    routeId: 'admin-drivers',
    name: 'drivers',
    entity: 'Driver',
    // The Full Name column comes from the linked user and has no cell editor.
    editColumn: 'vehicleNumber',
    make: (page) => new AdminDriversPage(page),
  },
];

test.describe('admin controls', () => {
  for (const screen of ADMIN_SCREENS) {
    test(`admin ${screen.name}: the row editor opens and "Cancel" restores the row`, async ({
      pageForRole,
    }) => {
      const page = await pageForRole('MANAGER');
      const admin = screen.make(page);
      expect(admin.path, 'page object and inventory disagree about the route').toBe(
        routeById(screen.routeId).path,
      );
      await admin.open();

      expect(await admin.rowCount(), `${screen.name} table rendered no rows`).toBeGreaterThan(0);
      const row = admin.rows.first();
      const original = await admin.cellText(row, screen.editColumn);

      await admin.startRowEdit(row);
      const input = admin.rowInput(row, screen.editColumn);
      await expect(input).toBeVisible();
      await expect(input).toBeEditable();

      await admin.setRowText(row, screen.editColumn, `e2e-smoke-${screen.name}`);
      await admin.cancelRowEdit(row);

      // Nothing was persisted and the original value is back on screen.
      await expect(admin.cell(row, screen.editColumn)).toHaveText(original);

      // `destructive` controls are presence-only per the inventory — never clicked here.
      await expect(admin.deleteButton(row)).toBeVisible();
      await expect(admin.deleteButton(row)).toBeEnabled();
    });

    test.fixme(
      `admin ${screen.name}: the row editor's "Save" persists the edit`,
      async ({ pageForRole }) => {
        // GAP 3 — <p:ajax event="rowEdit" oncomplete="#{bean.saveSelected()}"> puts EL inside a
        // JavaScript attribute, so it is evaluated at render time and the check mark never drives
        // a persist. See docs/e2e-findings.md.
        const page = await pageForRole('MANAGER');
        const admin = screen.make(page);
        await admin.open();

        const row = admin.rows.first();
        const original = await admin.cellText(row, screen.editColumn);
        const edited = `e2e-smoke-${screen.name}`;

        await admin.editRowText(row, screen.editColumn, edited);
        await admin.expectInfo(`${screen.entity} updated`);

        await admin.open();
        await expect(admin.rows.first().locator(`td:text-is("${edited}")`)).toBeVisible();

        // Put the seeded row back the way we found it.
        await admin.editRowText(admin.rows.first(), screen.editColumn, original);
      },
    );

    test(`admin ${screen.name}: "New" opens the create dialog and "Cancel" closes it`, async ({
      pageForRole,
    }) => {
      const page = await pageForRole('MANAGER');
      const admin = screen.make(page);
      await admin.open();

      await admin.openCreateDialog();
      await expect(admin.dialogSave).toBeVisible();
      await expect(admin.dialogCancel).toBeVisible();

      // Read the count AFTER the dialog opened: prepareCreate() re-renders the table, and other
      // workers may have added rows in the meantime. Cancel itself sends no request, so from here
      // on the table cannot change under us.
      const before = await admin.rowCount();
      await admin.cancelCreateDialog();
      await expect(admin.dialog).toBeHidden();
      expect(await admin.rowCount(), 'Cancel changed the table').toBe(before);
    });

    test(`admin ${screen.name}: "Save" on a blank create form keeps the dialog open`, async ({
      pageForRole,
    }) => {
      const page = await pageForRole('MANAGER');
      const admin = screen.make(page);
      await admin.open();

      await admin.openCreateDialog();
      // Every create dialog has at least two required fields; a blank submit must fail validation.
      await admin.saveCreateDialogExpectingValidationError();

      await expect(admin.dialog).toBeVisible();
      await expect(admin.messages.errors.first()).toBeVisible();
    });
  }
});
