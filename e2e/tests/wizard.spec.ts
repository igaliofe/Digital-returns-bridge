/**
 * Journey 3 — the 3-step "Create Return" wizard.
 *
 * `CreateReturnWizardBean` is `@SessionScoped`, so EVERY test here drives a brand-new browser
 * context via `loginAs('REP')` / `loginAs('MANAGER')`. Using `repPage` would share one HttpSession
 * per worker and the wizard state of two tests would collide.
 *
 * Data budget — `customer_purchases` are a FINITE seeded resource (nothing creates them over the
 * API) and each worker owns exactly one customer, `(workerIndex % 20) + 1`. A purchase is consumed
 * only by a SUCCESSFUL create (`ReturnRequestService.createReturnRequest` flips `handled = true`);
 * merely selecting a row, or failing validation, consumes nothing. This spec therefore performs
 * exactly TWO successful creates, so it stays well inside the 4-per-customer worst case.
 */

import type { Page } from '@playwright/test';
import { driverOptionLabel, expect, pngUpload, SEED_DRIVER_ONE, test } from '../fixtures';
import {
  clickAjax,
  CreateReturnWizard,
  IdentifyCustomerPage,
  ReturnDetailsPage,
  ReturnsListPage,
  WIZARD_PATHS,
} from '../pages';

/** `d.user.fullName (d.vehicleNumber)` — how new-return.xhtml labels the driver dropdown. */
const DRIVER = SEED_DRIVER_ONE;
const DRIVER_LABEL = driverOptionLabel(DRIVER);

/** `yyyy-MM-dd` (API) -> `dd/MM/yyyy` (the `p:datePicker` pattern on step 3). */
function toDisplayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

async function openStep2(page: Page, phone: string): Promise<CreateReturnWizard> {
  const wizard = new CreateReturnWizard(page);
  await wizard.openStep2(phone);
  return wizard;
}

async function openStep3(
  page: Page,
  phone: string,
  orderNumber: string,
): Promise<CreateReturnWizard> {
  const wizard = new CreateReturnWizard(page);
  await wizard.openStep3(phone, orderNumber);
  return wizard;
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

test('happy path: REP creates a return from a seeded purchase and lands on its details page', async ({
  loginAs,
  data,
  api,
}) => {
  // Three Cloudinary round-trips happen inside the single Create post.
  test.slow();

  const purchase = await data.firstSelectablePurchase();
  const page = await loginAs('REP');
  const wizard = new CreateReturnWizard(page);

  // --- step 1 -> step 2 ---------------------------------------------------
  await wizard.step1.gotoViaEntry();
  await wizard.step1.lookupAndContinue(data.customer.phone);
  await wizard.step2.expectLoaded();
  expect(await wizard.step2.customerField('Name')).toBe(data.customer.fullName);
  expect(await wizard.step2.customerField('Phone')).toBe(data.customer.phone);

  // --- step 2 -> step 3 ---------------------------------------------------
  await wizard.step2.selectByOrderNumber(purchase.orderNumber);
  await wizard.step3.expectLoaded();
  expect(await wizard.step3.selectedItemField('Customer')).toBe(data.customer.fullName);
  expect(await wizard.step3.selectedItemField('Phone')).toBe(data.customer.phone);
  expect(await wizard.step3.selectedItemField('Product')).toBe(purchase.productName);
  expect(await wizard.step3.selectedItemField('SKU')).toBe(purchase.productSku);

  // --- step 3 -------------------------------------------------------------
  const notes = `${data.uniqueName('wizard')} free-text notes`;
  await wizard.step3.fill({
    wasUsed: true,
    returnReason: 'PRODUCT_DEFECT',
    defectStage: 'INITIAL_SHIPPING',
    defectType: 'SCRATCH',
    defectLocationText: 'front-left leg',
    notes,
    defectDescription: 'Deep scratch across the lid',
    // 'High' is the one form option whose value (HIGH) is also a domain priority — see GAP 5 below.
    priority: 'High',
    driverLabel: DRIVER_LABEL,
    clearPhotosReceived: true,
    generalPhotoExists: true,
    focusedDefectPhotoExists: true,
  });

  // `wasUsed` + a defect type make photos mandatory server-side (CreateReturnWizardBean.create).
  await wizard.step3.generalImages.setInputFiles(pngUpload('wizard-general.png'));
  await wizard.step3.defectImages.setInputFiles(pngUpload('wizard-defect.png'));

  await wizard.step3.drawSignature();
  expect(await wizard.step3.hasSignature()).toBe(true);

  const returnId = await wizard.step3.submitAndOpenDetails();

  const details = new ReturnDetailsPage(page);
  await details.expectLoaded();
  await details.expectHeaderId(returnId);

  // --- API oracle ---------------------------------------------------------
  const dto = await api.getReturn(returnId);
  expect(dto.status).toBe('WAITING_FOR_PICKUP'); // assigning a driver lifts OPEN -> WAITING_FOR_PICKUP
  expect(dto.customerId).toBe(data.customer.id);
  expect(dto.productId).toBe(purchase.productId);
  expect(dto.orderNumber).toBe(purchase.orderNumber);
  expect(dto.driverId).toBe(DRIVER.id);
  expect(dto.reason).toBe(notes);
  expect(dto.returnReason).toBe('PRODUCT_DEFECT');
  expect(dto.defectStage).toBe('INITIAL_SHIPPING');
  expect(dto.defectType).toBe('SCRATCH');
  expect(dto.defectLocationText).toBe('front-left leg');
  expect(dto.defectDescription).toBe('Deep scratch across the lid');
  expect(dto.wasUsed).toBe(true);
  expect(dto.priority).toBe('HIGH');
  expect(dto.barcode).toBeNull(); // a barcode only exists once a driver assigns one

  const consumed = await api.getPurchase(data.customer.id, purchase.id);
  expect(consumed?.handled).toBe(true);

  await api.expectImageType(returnId, 'SERVICE_GENERAL_IMAGE');
  await api.expectImageType(returnId, 'SERVICE_DEFECT_IMAGE');
  await api.expectImageType(returnId, 'SERVICE_REP_SIGNATURE');
});

test('signature and driver are optional: Create succeeds and the return stays OPEN without a rep signature', async ({
  loginAs,
  data,
  api,
}) => {
  // docs/screens.md lists the service-rep signature as a step-3 FIELD, not a precondition, and
  // CreateReturnWizardBean.create() only uploads it `if (signatureData != null && !isBlank)`.
  // The single mandatory rule is "defective or used items require a photo" (covered separately).
  const purchase = await data.firstSelectablePurchase();
  const page = await loginAs('REP');
  const wizard = await openStep3(page, data.customer.phone, purchase.orderNumber);

  const notes = `${data.uniqueName('wizard-nosig')} free-text notes`;
  await wizard.step3.fill({ returnReason: 'NOT_AS_EXPECTED', notes });

  expect(await wizard.step3.hasSignature()).toBe(false);
  expect(await wizard.step3.selectedDriver()).toContain('No Driver');

  const returnId = await wizard.step3.submitAndOpenDetails();
  await new ReturnDetailsPage(page).expectHeaderId(returnId);

  const dto = await api.getReturn(returnId);
  expect(dto.status).toBe('OPEN'); // no driver -> no automatic WAITING_FOR_PICKUP
  expect(dto.driverId).toBeNull();
  expect(dto.reason).toBe(notes);
  expect(await api.imageTypesOf(returnId)).not.toContain('SERVICE_REP_SIGNATURE');

  const consumed = await api.getPurchase(data.customer.id, purchase.id);
  expect(consumed?.handled).toBe(true);
});

// ---------------------------------------------------------------------------
// Step 1 — identify customer
// ---------------------------------------------------------------------------

test('step 1 rejects an unknown phone number and stays on step 1', async ({
  loginAs,
  data,
  api,
}) => {
  const page = await loginAs('REP');
  const step1 = new IdentifyCustomerPage(page);
  await step1.gotoViaEntry();

  // `nextPhone()` is '0599<worker><5 digits>' — it cannot collide with any seeded customer.
  const unknown = data.nextPhone();
  expect(await api.findCustomerByPhone(unknown)).toBeNull();

  await step1.phone.fill(unknown);
  await clickAjax(page, step1.findCustomer);

  await expect(page).toHaveURL(/identify-customer\.xhtml/);
  await step1.expectStep(1);
});

test('step 1 blocks the lookup when the phone number is empty', async ({ loginAs }) => {
  const page = await loginAs('REP');
  const step1 = new IdentifyCustomerPage(page);
  await step1.gotoViaEntry();

  await step1.phone.fill('');
  await clickAjax(page, step1.findCustomer);

  // `required="true"` fails validation, so `lookupCustomer` never runs and there is no navigation.
  await expect(page).toHaveURL(/identify-customer\.xhtml/);
  await step1.expectStep(1);
});

test.fixme(
  'step 1 surfaces "Customer not found for phone: N" for an unknown number',
  async ({ loginAs, data }) => {
    // GAP 6 (found while writing this spec, see docs/e2e-findings.md) — the three wizard forms are
    // the only screens whose `p:commandButton`s declare NO `update` attribute (login.xhtml uses
    // update="msgs", list/warehouse/admin all update their form). A PrimeFaces ajax response
    // therefore never re-renders `p:messages`, so `addError(...)` and JSF validation messages are
    // invisible on every wizard step. Intended: the detail text appears in the form's message block.
    const page = await loginAs('REP');
    const step1 = new IdentifyCustomerPage(page);
    await step1.gotoViaEntry();

    const unknown = data.nextPhone();
    await step1.phone.fill(unknown);
    await clickAjax(page, step1.findCustomer);

    await step1.expectCustomerNotFound(unknown);
  },
);

// ---------------------------------------------------------------------------
// Step 2 — item selection
// ---------------------------------------------------------------------------

test("step 2 lists exactly the looked-up customer's purchase history", async ({
  loginAs,
  data,
  api,
}) => {
  const expected = await api.getPurchases(data.customer.id);
  const page = await loginAs('REP');
  const wizard = await openStep2(page, data.customer.phone);

  expect(await wizard.step2.rowCount()).toBe(expected.length);
  expect((await wizard.step2.orderNumbers()).sort()).toEqual(
    expected.map((p) => p.orderNumber).sort(),
  );

  const first = expected[0];
  const row = wizard.step2.rowByOrderNumber(first.orderNumber);
  await expect(wizard.step2.cell(row, 'product')).toHaveText(first.productName);
  await expect(wizard.step2.cell(row, 'sku')).toHaveText(first.productSku);
  await expect(wizard.step2.cell(row, 'quantity')).toHaveText(String(first.quantity));
  await expect(wizard.step2.cell(row, 'warranty')).toHaveText(first.underWarranty ? 'Yes' : 'No');
});

test('step 2 chips Handled purchases and offers a Select button only on Available ones', async ({
  loginAs,
  data,
}) => {
  const [selectable, handled] = await Promise.all([
    data.selectablePurchases(),
    data.handledPurchases(),
  ]);
  const page = await loginAs('REP');
  const wizard = await openStep2(page, data.customer.phone);

  expect((await wizard.step2.availableOrderNumbers()).sort()).toEqual(
    selectable.map((p) => p.orderNumber).sort(),
  );
  // Seed rule `handled = product_id % 5 == 0` leaves some customers (e.g. customer 1) with zero
  // handled rows — the Available side of this assertion is what carries the test for those workers.
  expect((await wizard.step2.handledOrderNumbers()).sort()).toEqual(
    handled.map((p) => p.orderNumber).sort(),
  );

  await expect(wizard.step2.selectButton(wizard.step2.handledRows)).toHaveCount(0);
  await expect(wizard.step2.selectButton(wizard.step2.availableRows)).toHaveCount(
    selectable.length,
  );
});

test('step 2 Back returns to step 1', async ({ loginAs, data }) => {
  const page = await loginAs('REP');
  const wizard = await openStep2(page, data.customer.phone);

  await wizard.step2.backToStep1();
  await wizard.step1.expectLoaded();
});

test('step 2 Cancel leaves the wizard for the returns list', async ({ loginAs, data }) => {
  const page = await loginAs('REP');
  const wizard = await openStep2(page, data.customer.phone);

  await wizard.step2.cancelToList();
  await new ReturnsListPage(page).expectLoaded();
});

// ---------------------------------------------------------------------------
// Step 3 — new return request
// ---------------------------------------------------------------------------

test('step 3 pre-fills order number, delivery date, quantity and warranty from the purchase', async ({
  loginAs,
  data,
}) => {
  const purchase = await data.firstSelectablePurchase();
  const page = await loginAs('REP');
  const wizard = await openStep3(page, data.customer.phone, purchase.orderNumber);

  await expect(wizard.step3.orderNumber).toHaveValue(purchase.orderNumber);
  await expect(wizard.step3.quantity).toHaveValue(String(purchase.quantity));
  if (purchase.originalDeliveryDate) {
    await expect(wizard.step3.originalDeliveryDate).toHaveValue(
      toDisplayDate(purchase.originalDeliveryDate),
    );
  }
  expect(await wizard.step3.isUnderWarrantyChecked()).toBe(Boolean(purchase.underWarranty));
  // Nothing on step 3 is filled in yet, so the item must still be selectable.
  expect((await data.selectablePurchases()).map((p) => p.id)).toContain(purchase.id);
});

test('step 3 Back returns to step 2 with the purchase still selectable', async ({
  loginAs,
  data,
}) => {
  const purchase = await data.firstSelectablePurchase();
  const page = await loginAs('REP');
  const wizard = await openStep3(page, data.customer.phone, purchase.orderNumber);

  await wizard.step3.backToStep2();
  await wizard.step2.expectLoaded();
  expect(await wizard.step2.availableOrderNumbers()).toContain(purchase.orderNumber);
});

test('step 3 Cancel leaves the wizard for the returns list', async ({ loginAs, data }) => {
  const purchase = await data.firstSelectablePurchase();
  const page = await loginAs('REP');
  const wizard = await openStep3(page, data.customer.phone, purchase.orderNumber);

  await wizard.step3.cancelToList();
  await new ReturnsListPage(page).expectLoaded();
});

test('step 3 blocks Create when the required Free-text Notes field is empty', async ({
  loginAs,
  data,
  api,
}) => {
  const purchase = await data.firstSelectablePurchase();
  const page = await loginAs('REP');
  const wizard = await openStep3(page, data.customer.phone, purchase.orderNumber);

  await wizard.step3.setReturnReason('NOT_AS_EXPECTED');
  // Free-text Notes (`createForm:reason`) deliberately left empty.
  await clickAjax(page, wizard.step3.create);

  await expect(page).toHaveURL(/new-return\.xhtml/);
  await wizard.step3.expectStep(3);

  const untouched = await api.getPurchase(data.customer.id, purchase.id);
  expect(untouched?.handled).toBe(false);
  const created = await api.listReturns({ customerId: data.customer.id });
  expect(created.some((r) => r.orderNumber === purchase.orderNumber)).toBe(false);
});

test('step 3 blocks Create for a defective item with no photos attached', async ({
  loginAs,
  data,
  api,
}) => {
  const purchase = await data.firstSelectablePurchase();
  const page = await loginAs('REP');
  const wizard = await openStep3(page, data.customer.phone, purchase.orderNumber);

  // requiresVisualDocs(): PRODUCT_DEFECT / a defect type / wasUsed all demand at least one photo.
  await wizard.step3.fill({
    returnReason: 'PRODUCT_DEFECT',
    defectType: 'DENT',
    notes: `${data.uniqueName('wizard-nophoto')} free-text notes`,
  });
  await clickAjax(page, wizard.step3.create);

  await expect(page).toHaveURL(/new-return\.xhtml/);
  await wizard.step3.expectStep(3);

  const untouched = await api.getPurchase(data.customer.id, purchase.id);
  expect(untouched?.handled).toBe(false);
  const created = await api.listReturns({ customerId: data.customer.id });
  expect(created.some((r) => r.orderNumber === purchase.orderNumber)).toBe(false);
});

test('Clear Signature empties the signature pad', async ({ loginAs, data }) => {
  const purchase = await data.firstSelectablePurchase();
  const page = await loginAs('REP');
  const wizard = await openStep3(page, data.customer.phone, purchase.orderNumber);

  await wizard.step3.drawSignature();
  expect(await wizard.step3.hasSignature()).toBe(true);

  await wizard.step3.clearSignaturePad();
  await expect.poll(() => wizard.step3.hasSignature()).toBe(false);
});

test.fixme(
  'step 3 surfaces the required-field error when Free-text Notes is empty',
  async ({ loginAs, data }) => {
    // GAP 6 (found while writing this spec, see docs/e2e-findings.md) — new-return.xhtml's Create
    // button declares no `update`, so the ajax response never re-renders `p:messages` and the
    // "Please provide a reason" requiredMessage is never shown. The user sees a dead button.
    const purchase = await data.firstSelectablePurchase();
    const page = await loginAs('REP');
    const wizard = await openStep3(page, data.customer.phone, purchase.orderNumber);

    await wizard.step3.setReturnReason('NOT_AS_EXPECTED');
    await wizard.step3.submitAndExpectError('Please provide a reason');
  },
);

test.fixme(
  'the priority dropdown offers the domain priorities LOW / MEDIUM / HIGH',
  async ({ loginAs, data }) => {
    // GAP 5 — new-return.xhtml hard-codes Normal/High/Urgent (NORMAL/HIGH/URGENT) while the domain,
    // the seed data and the returns-list filter all use LOW/MEDIUM/HIGH. See docs/e2e-findings.md.
    const purchase = await data.firstSelectablePurchase();
    const page = await loginAs('REP');
    const wizard = await openStep3(page, data.customer.phone, purchase.orderNumber);

    expect(await wizard.step3.priorityValues()).toEqual(['LOW', 'MEDIUM', 'HIGH']);
    expect(await wizard.step3.priorityOptions()).toEqual(['Low', 'Medium', 'High']);
    expect(await wizard.step3.selectedPriority()).toBe('Medium');
  },
);

// ---------------------------------------------------------------------------
// Step guards — deep links
// ---------------------------------------------------------------------------

test('deep-linking straight to step 3 bounces back to step 1', async ({ loginAs }) => {
  const page = await loginAs('REP');
  const wizard = new CreateReturnWizard(page);

  await wizard.step3.goto();

  await page.waitForURL(`**${WIZARD_PATHS.step1}**`);
  await wizard.step1.expectLoaded();
});

test('deep-linking to step 2 without a customer bounces back to step 1', async ({ loginAs }) => {
  const page = await loginAs('REP');
  const wizard = new CreateReturnWizard(page);

  await wizard.step2.goto();

  await page.waitForURL(`**${WIZARD_PATHS.step1}**`);
  await wizard.step1.expectLoaded();
});

test('deep-linking to step 3 with a customer but no purchase bounces back to step 2', async ({
  loginAs,
  data,
}) => {
  const page = await loginAs('REP');
  const wizard = await openStep2(page, data.customer.phone);

  await wizard.step3.goto();

  await page.waitForURL(`**${WIZARD_PATHS.step2}**`);
  await wizard.step2.expectLoaded();
});

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

test('MANAGER can drive the wizard through to step 3', async ({ loginAs, data }) => {
  const page = await loginAs('MANAGER');
  const wizard = new CreateReturnWizard(page);

  const orderNumber = await wizard.startFor(data.customer.phone);

  await wizard.step3.expectLoaded();
  expect(await wizard.step3.selectedItemField('Customer')).toBe(data.customer.fullName);
  await expect(wizard.step3.orderNumber).toHaveValue(orderNumber);
});
