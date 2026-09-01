/**
 * Captures the 14 web screenshots the three Hebrew submission documents reference.
 *
 * This is NOT part of `npm test` — it lives in its own testDir and runs via capture.config.ts:
 *
 *     npx playwright test --config=capture.config.ts
 *
 * It is a capture run, not a test run: assertions exist only to guarantee the screen is in the
 * state docs/images/README.md prescribes before the shutter fires. A red run here means a document
 * would have shipped a picture of the wrong thing.
 *
 * File names come from docs/images/README.md and are load-bearing — the docs link them literally.
 */

import { test, expect, ROLE_PHONE } from '../fixtures';
import type { ReturnStatus } from '../fixtures';
import {
  AdminCustomersPage,
  AdminDriversPage,
  AdminProductsPage,
  AdminUsersPage,
  DashboardPage,
  IdentifyCustomerPage,
  LoginPage,
  NewReturnPage,
  ReportsPage,
  ReturnDetailsPage,
  ReturnsListPage,
  SelectItemPage,
  WarehouseReceivingPage,
} from '../pages';
import { photoUpload, shoot, writePhoto } from './shot';

/** Enough spread that no dashboard/report panel renders as an empty state. */
const SPREAD: readonly ReturnStatus[] = [
  'OPEN',
  'OPEN',
  'WAITING_FOR_PICKUP',
  'BARCODE_ASSIGNED',
  'PICKED_UP',
  'ARRIVED_TO_WAREHOUSE',
  'INSPECTED',
  'CLOSED',
  'NEEDS_MORE_INFO',
];

test.describe('web screenshots', () => {
  test('login', async ({ page }) => {
    const login = new LoginPage(page);
    await login.open();
    await expect(login.card).toBeVisible();
    // Empty form, before submit — per docs/images/README.md.
    await shoot(page, 'login', { fullPage: false });
  });

  test('dashboard', async ({ repPage, data }) => {
    // The dashboard is eight KPI counters; an all-zero board tells the reader nothing.
    for (const status of SPREAD) await data.makeReturn(status);

    const dashboard = new DashboardPage(repPage);
    await dashboard.open();
    await dashboard.expectAllKpisNumeric();
    await expect(dashboard.kpiCards.first()).toBeVisible();
    await shoot(repPage, 'dashboard');
  });

  test('wizard steps 1-3', async ({ repPage, data, api }) => {
    // Step 2 must show BOTH an Available and a Handled purchase row. Creating a return against one
    // purchase is what flips that row's `handled` flag, so do it before opening the wizard.
    const purchases = await api.selectablePurchases(data.customer.id);
    expect(
      purchases.length,
      'seeded customer needs at least two purchases so step 2 can show Available + Handled',
    ).toBeGreaterThanOrEqual(2);
    await data.makeReturn('OPEN', { purchaseId: purchases[0].id, productId: purchases[0].productId });

    // --- step 1: phone filled, before Find Customer ---
    const step1 = new IdentifyCustomerPage(repPage);
    await step1.gotoViaEntry();
    await step1.phone.fill(data.customer.phone);
    await shoot(repPage, 'wizard-step1');

    // --- step 2: purchase history, Available + Handled ---
    await step1.lookupAndContinue(data.customer.phone);
    const step2 = new SelectItemPage(repPage);
    await step2.expectStep(2);
    await expect(step2.availableRows.first()).toBeVisible();
    await expect(step2.handledRows.first()).toBeVisible();
    await shoot(repPage, 'wizard-step2');

    // --- step 3: filled form incl. a drawn signature, before Create ---
    await step2.selectFirstAvailable();
    const step3 = new NewReturnPage(repPage);
    await step3.expectStep(3);
    await step3.fill({
      orderNumber: 'ORD-2026-0042',
      quantity: 1,
      underWarranty: true,
      wasUsed: false,
      returnReason: 'PRODUCT_DEFECT',
      defectType: 'SCRATCH',
      defectStage: 'INITIAL_SHIPPING',
      defectLocationText: 'פינה קדמית ימנית',
      notes: 'הלקוח מדווח על שריטה עמוקה שהתגלתה עם פתיחת האריזה.',
      defectDescription: 'שריטה בגוף המוצר',
    });
    await step3.drawSignature();
    expect(await step3.hasSignature(), 'signature pad should hold a drawn value').toBe(true);
    await shoot(repPage, 'wizard-step3');
  });

  test('returns list', async ({ repPage, data }) => {
    for (const status of SPREAD) await data.makeReturn(status);
    // docs/images/README.md wants at least one "Not assigned" row visible.
    await data.makeReturn('OPEN', { driverId: null });

    const list = new ReturnsListPage(repPage);
    await list.open();
    await expect(list.filterCard).toBeVisible();
    expect(await list.rowCount()).toBeGreaterThan(0);
    await shoot(repPage, 'returns-list');
  });

  test('return details', async ({ repPage, data, api }) => {
    // "Advanced" return: has a barcode, several typed photos, and a multi-row status timeline.
    const seeded = await data.makeReturn('ARRIVED_TO_WAREHOUSE');
    await api.uploadImage(seeded.id, 'SERVICE_GENERAL_IMAGE', {
      ...photoUpload('service-general.png', [126, 148, 176]),
    });
    await api.uploadImage(seeded.id, 'SERVICE_DEFECT_IMAGE', {
      ...photoUpload('service-defect.png', [176, 132, 118]),
    });
    await api.uploadImage(seeded.id, 'DRIVER_PRODUCT_IMAGE', {
      ...photoUpload('driver-product.png', [132, 160, 136]),
    });

    const details = new ReturnDetailsPage(repPage);
    await details.openId(seeded.id);
    expect(await details.imageCount()).toBeGreaterThan(0);
    expect(await details.timelineRowCount()).toBeGreaterThan(1);
    await shoot(repPage, 'return-details');
  });

  test('warehouse receiving', async ({ warehousePage, data, api }) => {
    // ARRIVED_TO_WAREHOUSE is the only status where the digital file AND the inspection form
    // both render — that is the screen the design document describes.
    const seeded = await data.makeReturn('ARRIVED_TO_WAREHOUSE');
    await api.uploadImage(seeded.id, 'SERVICE_GENERAL_IMAGE', {
      ...photoUpload('wh-general.png', [126, 148, 176]),
    });
    await api.uploadImage(seeded.id, 'DRIVER_DEFECT_IMAGE', {
      ...photoUpload('wh-defect.png', [176, 132, 118]),
    });

    const receiving = new WarehouseReceivingPage(warehousePage);
    await receiving.open();
    await receiving.search(seeded.barcode!);
    await receiving.expectFound(seeded.barcode!);
    expect(await receiving.isInspectionFormVisible()).toBe(true);
    await shoot(warehousePage, 'warehouse-receiving');
  });

  test('reports', async ({ managerPage, data, api }) => {
    // Every report panel is wrapped in rendered="#{not empty ...}" — with no data the panel is
    // absent from the DOM entirely, so seed before opening.
    for (const status of SPREAD) await data.makeReturn(status);
    const inspected = await data.makeReturn('ARRIVED_TO_WAREHOUSE');
    await api.createInspection(inspected.id, {
      itemCondition: 'USED_MINOR_DEFECT',
      warehouseDecision: 'CLASS_B',
      callFullyHandled: true,
      warehouseNotes: 'הועבר למלאי מדרגה ב׳',
    });

    const reports = new ReportsPage(managerPage);
    await reports.open();
    await reports.expectAllKpisNumeric();
    const panels = await reports.presentTables();
    expect(panels.length, 'no report panel rendered — nothing worth screenshotting').toBeGreaterThan(0);
    // eslint-disable-next-line no-console
    console.log(`[capture] reports panels rendered: ${panels.join(', ')}`);
    await shoot(managerPage, 'reports');
  });

  test('admin — users, with a row in edit mode', async ({ managerPage }) => {
    const users = new AdminUsersPage(managerPage);
    await users.open();
    expect(await users.rowCount()).toBeGreaterThan(0);
    await users.startRowEdit(users.rows.first());
    await shoot(managerPage, 'admin-users');
  });

  test('admin — customers', async ({ managerPage }) => {
    const customers = new AdminCustomersPage(managerPage);
    await customers.open();
    expect(await customers.rowCount()).toBeGreaterThan(0);
    await shoot(managerPage, 'admin-customers');
  });

  test('admin — products', async ({ managerPage }, testInfo) => {
    const products = new AdminProductsPage(managerPage);
    await products.open();
    expect(await products.rowCount()).toBeGreaterThan(0);
    // Keep the disk write so the fixture path stays exercised even though seeded products
    // already carry catalog imageUrls.
    writePhoto(testInfo.outputPath('catalog.png'), [150, 150, 158]);
    await shoot(managerPage, 'admin-products');
  });

  test('admin — drivers, create dialog open', async ({ managerPage }) => {
    const drivers = new AdminDriversPage(managerPage);
    await drivers.open();
    expect(await drivers.rowCount()).toBeGreaterThan(0);
    // The dialog is the interesting part: it shows the User Account selector, which is what makes
    // "a driver is an existing user plus vehicle details" legible in the functionality document.
    await drivers.openCreateDialog();
    await expect(drivers.dialog).toBeVisible();
    await shoot(managerPage, 'admin-drivers');
  });
});

/**
 * The optimistic-lock conflict message.
 *
 * This is a genuine race, not a mock: two authenticated warehouse sessions load the same return and
 * click "Mark as Arrived" simultaneously. WarehouseService.markArrived reads the row through a
 * non-locking findByBarcode before ReturnRequestService re-reads it FOR UPDATE, so the loser can
 * still be holding a stale @Version — which is what surfaces
 * ConcurrentModificationConflictException and, in the JSF layer, the Hebrew message below.
 *
 * The race is real, so it is not guaranteed on any single attempt; retry a bounded number of times
 * and fail loudly rather than fabricate the screenshot.
 */
test('warehouse receiving — concurrent modification conflict', async ({ data, loginAs }) => {
  test.slow();
  const CONFLICT = 'This record was updated by another user. Refresh the page and try again';
  const ATTEMPTS = 12;

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const seeded = await data.makeReturn('PICKED_UP');
    const barcode = seeded.barcode!;

    const pageA = await loginAs('WAREHOUSE');
    const pageB = await loginAs('WAREHOUSE');
    const a = new WarehouseReceivingPage(pageA);
    const b = new WarehouseReceivingPage(pageB);

    await a.open();
    await b.open();
    await a.search(barcode);
    await b.search(barcode);
    await a.expectFound(barcode);
    await b.expectFound(barcode);

    // Both sessions now hold the same version. Fire the two mutations together.
    await Promise.all([
      a.markArrivedConfirming().catch(() => undefined),
      b.markArrivedConfirming().catch(() => undefined),
    ]);

    for (const [label, page] of [['A', pageA], ['B', pageB]] as const) {
      if (await page.getByText(CONFLICT).first().isVisible().catch(() => false)) {
        // eslint-disable-next-line no-console
        console.log(`[capture] conflict reproduced on session ${label}, attempt ${attempt}`);
        await shoot(page, 'warehouse-receiving-concurrent-error');
        await pageA.close();
        await pageB.close();
        return;
      }
    }

    await pageA.close();
    await pageB.close();
  }

  throw new Error(
    `The optimistic-lock conflict did not reproduce in ${ATTEMPTS} attempts. ` +
      'Do NOT fake this screenshot — drop the image reference from ' +
      'docs/user-functionality.he.md §9.3 instead, and say so.',
  );
});

// Referenced by the docs but unused here; keeps the import honest if the file is trimmed later.
void ROLE_PHONE;
