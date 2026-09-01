/**
 * Route id -> page object. The single switch over `RouteId`, so a new route breaks one file.
 *
 * Adding a route to `e2e/inventory/routes-and-controls.ts` and forgetting to teach a spec about it
 * used to mean silently skipping its `expectLoaded()` assertion; `screenForRoute` is exhaustive
 * over `RouteId`, so the compiler now points at the omission.
 */

import type { Page } from '@playwright/test';
import type { RouteId } from '../inventory/routes-and-controls';
import {
  AdminCrudPage,
  AdminCustomersPage,
  AdminDriversPage,
  AdminProductsPage,
  AdminPurchasesPage,
  AdminUsersPage,
} from './admin';
import type { BasePage } from './base';
import { DashboardPage } from './dashboard';
import { LoginPage } from './login';
import { ReportsPage } from './reports';
import { ReturnDetailsPage } from './return-details';
import { ReturnsListPage } from './returns-list';
import { WarehouseReceivingPage } from './warehouse-receiving';
import { IdentifyCustomerPage, NewReturnPage, SelectItemPage } from './wizard';

/**
 * The page object whose `expectLoaded()` proves this route really rendered.
 *
 * `create-return` maps to step 1 because `/returns/create.xhtml` is a pure `f:viewAction` bounce —
 * you never see a screen at that path, you see step 1.
 *
 * Callers that arrive at a route by GET rather than by walking the wizard should skip the
 * assertion for the wizard steps: `ensureStep2` / `ensureStep3` legitimately bounce a direct GET
 * back one or two steps, so there is no single screen to assert. See `SCREEN_ASSERTABLE_BY_GET`.
 */
export function screenForRoute(routeId: RouteId, page: Page): BasePage {
  switch (routeId) {
    case 'login':
      return new LoginPage(page);
    case 'dashboard':
      return new DashboardPage(page);
    case 'returns-list':
      return new ReturnsListPage(page);
    case 'return-details':
      return new ReturnDetailsPage(page);
    case 'create-return':
    case 'wizard-step1':
      return new IdentifyCustomerPage(page);
    case 'wizard-step2':
      return new SelectItemPage(page);
    case 'wizard-step3':
      return new NewReturnPage(page);
    case 'warehouse-receiving':
      return new WarehouseReceivingPage(page);
    case 'reports':
      return new ReportsPage(page);
    case 'admin-users':
      return new AdminUsersPage(page);
    case 'admin-customers':
      return new AdminCustomersPage(page);
    case 'admin-purchases':
      return new AdminPurchasesPage(page);
    case 'admin-products':
      return new AdminProductsPage(page);
    case 'admin-drivers':
      return new AdminDriversPage(page);
  }
}

/**
 * Routes whose screen object may be asserted after a plain `page.goto(route.path)`.
 *
 * Excluded: `create-return` (a redirect, so the URL you asked for is never the URL you get),
 * and wizard steps 2 and 3 (whose session-state guards legitimately bounce a direct GET).
 * `login` is excluded because it renders outside `layout.xhtml` and is asserted separately.
 */
export function isScreenAssertableByGet(routeId: RouteId): boolean {
  return (
    routeId !== 'login' &&
    routeId !== 'create-return' &&
    routeId !== 'wizard-step2' &&
    routeId !== 'wizard-step3'
  );
}

/** The admin CRUD screen for an `admin-*` route, or null for every other route. */
export function adminPageForRoute(routeId: RouteId, page: Page): AdminCrudPage | null {
  const screen = screenForRoute(routeId, page);
  return screen instanceof AdminCrudPage ? screen : null;
}
