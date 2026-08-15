/**
 * The 3-step Create Return wizard — Figma 62:2 / 62:37 / 62:158.
 *
 * `CreateReturnWizardBean` is `@SessionScoped`: every step shares one bean per HttpSession.
 * Specs driving this MUST use `loginAs('REP')` / `loginAs('MANAGER')` (a brand-new context),
 * never `repPage` — those share one session per worker and the wizard state would collide.
 *
 * Step guards live in `f:metadata`: `ensureStep2` bounces to step 1 when no customer is loaded,
 * `ensureStep3` bounces to step 2 when no purchase is selected (or step 1 with no customer).
 * `/returns/create.xhtml` is a bare redirect to step 1.
 */

import type { Locator, Page } from '@playwright/test';
import {
  expect,
  type DataFactory,
  type DefectStage,
  type DefectType,
  type ReturnReason,
} from '../fixtures';
import { BasePage } from './base';
import {
  byId,
  drawSignature,
  pfFill,
  pfFillDate,
  pfFillNumber,
  pfInput,
  pfIsChecked,
  pfSelectOne,
  pfSelectOptions,
  pfSelectedLabel,
  pfSetCheckbox,
  PfMessages,
  pfMessages,
} from './pf';

export const WIZARD_PATHS = {
  entry: '/returns/create.xhtml',
  step1: '/returns/create/identify-customer.xhtml',
  step2: '/returns/create/select-item.xhtml',
  step3: '/returns/create/new-return.xhtml',
} as const;

/** Shared bits of the three step pages. */
export abstract class WizardStepPage extends BasePage {
  /** `[data-testid="wizard-current-step"]`, also carries `data-step="1|2|3"`. */
  readonly stepIndicator: Locator;
  readonly card: Locator;
  readonly wizardTitle: Locator;

  protected constructor(page: Page, path: string) {
    super(page, path);
    this.stepIndicator = page.getByTestId('wizard-current-step');
    this.card = page.locator('.drb-wizard-card');
    this.wizardTitle = page.locator('.drb-wizard-title');
  }

  async expectStep(step: 1 | 2 | 3): Promise<void> {
    await expect(this.stepIndicator).toHaveAttribute('data-step', String(step));
  }

  async currentStep(): Promise<number> {
    return Number(await this.stepIndicator.getAttribute('data-step'));
  }
}

// ---------------------------------------------------------------------------
// Step 1 — Identify Customer
// ---------------------------------------------------------------------------

export class IdentifyCustomerPage extends WizardStepPage {
  readonly form: Locator;
  readonly phone: Locator;
  readonly findCustomer: Locator;
  readonly messages: PfMessages;

  constructor(page: Page) {
    super(page, WIZARD_PATHS.step1);
    this.form = page.locator('#identifyForm');
    this.phone = pfInput(page, 'identifyForm:phone');
    this.findCustomer = this.form.locator('button:has-text("Find Customer")');
    this.messages = pfMessages(this.form.locator('.ui-messages'));
  }

  /** Enter the wizard the way the app does — via `/returns/create.xhtml`. */
  async gotoViaEntry(): Promise<void> {
    await this.page.goto(WIZARD_PATHS.entry);
    await this.page.waitForURL(`**${WIZARD_PATHS.step1}**`);
    await this.expectLoaded();
  }

  override async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/identify-customer\.xhtml/);
    await expect(this.form).toBeVisible();
    await this.expectStep(1);
  }

  /** Fill + click, no waiting. Use for the failure cases. */
  async lookup(phone: string): Promise<void> {
    await this.phone.fill(phone);
    await this.findCustomer.click();
  }

  /** Fill + click + wait for step 2. */
  async lookupAndContinue(phone: string): Promise<void> {
    await this.phone.fill(phone);
    await this.findCustomer.click();
    await this.page.waitForURL(`**${WIZARD_PATHS.step2}**`);
  }

  /** Unknown phone: `Customer not found for phone: <phone>` and no navigation. */
  async expectCustomerNotFound(phone: string): Promise<void> {
    await this.messages.expectError(`Customer not found for phone: ${phone}`);
    await expect(this.page).toHaveURL(/identify-customer\.xhtml/);
  }

  async expectPhoneRequired(): Promise<void> {
    await expect(this.form).toContainText('Phone number is required');
  }
}

// ---------------------------------------------------------------------------
// Step 2 — Item Selection
// ---------------------------------------------------------------------------

/** Columns of `selectForm:purchasesTable` (1-based). */
export const PURCHASE_COLUMNS = {
  product: 1,
  sku: 2,
  orderNumber: 3,
  quantity: 4,
  deliveryDate: 5,
  warranty: 6,
  status: 7,
  action: 8,
} as const;

export type PurchaseColumn = keyof typeof PURCHASE_COLUMNS;

export class SelectItemPage extends WizardStepPage {
  readonly form: Locator;
  readonly customerPanel: Locator;
  readonly table: Locator;
  readonly rows: Locator;
  readonly emptyMessage: Locator;
  readonly back: Locator;
  readonly cancel: Locator;
  readonly messages: PfMessages;

  constructor(page: Page) {
    super(page, WIZARD_PATHS.step2);
    this.form = page.locator('#selectForm');
    this.customerPanel = page.locator('.ui-panel', { hasText: 'Customer' }).first();
    this.table = page.locator(byId('selectForm:purchasesTable'));
    this.rows = this.table.locator('tbody.ui-datatable-data > tr:not(.ui-datatable-empty-message)');
    this.emptyMessage = this.table.locator('tr.ui-datatable-empty-message');
    this.back = this.form.locator('button:has-text("Back")');
    this.cancel = this.form.locator('button:has-text("Cancel")');
    this.messages = pfMessages(this.form.locator('.ui-messages'));
  }

  override async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/select-item\.xhtml/);
    await expect(this.table).toBeVisible();
    await this.expectStep(2);
  }

  async rowCount(): Promise<number> {
    return this.rows.count();
  }

  rowByOrderNumber(orderNumber: string): Locator {
    return this.rows.filter({
      has: this.page.locator(`td:nth-child(${PURCHASE_COLUMNS.orderNumber}):text-is("${orderNumber}")`),
    });
  }

  rowByProduct(productName: string): Locator {
    return this.rows.filter({
      has: this.page.locator(`td:nth-child(${PURCHASE_COLUMNS.product}):text-is("${productName}")`),
    });
  }

  /** Rows whose Status chip reads "Available" (`handled = false`). */
  get availableRows(): Locator {
    return this.rows.filter({ has: this.page.locator('.drb-chip-available') });
  }

  /** Rows whose Status chip reads "Handled" — these must expose NO Select button. */
  get handledRows(): Locator {
    return this.rows.filter({ has: this.page.locator('.drb-chip-handled') });
  }

  selectButton(row: Locator): Locator {
    return row.locator('button:has-text("Select")');
  }

  statusChip(row: Locator): Locator {
    return row.locator(`td:nth-child(${PURCHASE_COLUMNS.status}) span`);
  }

  cell(row: Locator, column: PurchaseColumn): Locator {
    return row.locator(`td:nth-child(${PURCHASE_COLUMNS[column]})`);
  }

  async orderNumbers(): Promise<string[]> {
    const raw = await this.rows
      .locator(`td:nth-child(${PURCHASE_COLUMNS.orderNumber})`)
      .allInnerTexts();
    return raw.map((t) => t.trim());
  }

  async availableOrderNumbers(): Promise<string[]> {
    const raw = await this.availableRows
      .locator(`td:nth-child(${PURCHASE_COLUMNS.orderNumber})`)
      .allInnerTexts();
    return raw.map((t) => t.trim());
  }

  async handledOrderNumbers(): Promise<string[]> {
    const raw = await this.handledRows
      .locator(`td:nth-child(${PURCHASE_COLUMNS.orderNumber})`)
      .allInnerTexts();
    return raw.map((t) => t.trim());
  }

  /** Click Select on a specific row and wait for step 3. */
  async selectRow(row: Locator): Promise<void> {
    await this.selectButton(row).click();
    await this.page.waitForURL(`**${WIZARD_PATHS.step3}**`);
  }

  async selectByOrderNumber(orderNumber: string): Promise<void> {
    await this.selectRow(this.rowByOrderNumber(orderNumber));
  }

  /** Select the first "Available" row; returns its order number. Throws when none is left. */
  async selectFirstAvailable(): Promise<string> {
    const count = await this.availableRows.count();
    if (count === 0) {
      throw new Error(
        'no selectable purchase rows left for this customer — customer_purchases are a finite ' +
          'seeded resource (handled = product_id % 5 == 0) and nothing creates more over the API',
      );
    }
    const row = this.availableRows.first();
    const orderNumber = (await this.cell(row, 'orderNumber').innerText()).trim();
    await this.selectRow(row);
    return orderNumber;
  }

  async backToStep1(): Promise<void> {
    await this.back.click();
    await this.page.waitForURL(`**${WIZARD_PATHS.step1}**`);
  }

  async cancelToList(): Promise<void> {
    await this.cancel.click();
    await this.page.waitForURL('**/returns/list.xhtml**');
  }

  /** Customer panel values: 'Name' | 'Phone' | 'Email' | 'Address'. */
  async customerField(label: 'Name' | 'Phone' | 'Email' | 'Address'): Promise<string> {
    const cell = this.customerPanel.locator(`td:has(label:text-is("${label}")) + td`).first();
    return (await cell.innerText()).trim();
  }
}

// ---------------------------------------------------------------------------
// Step 3 — New Return Request
// ---------------------------------------------------------------------------

export interface NewReturnFormData {
  orderNumber?: string;
  /** `dd/MM/yyyy`. */
  originalDeliveryDate?: string;
  quantity?: number;
  underWarranty?: boolean;
  wasUsed?: boolean;
  returnReason?: ReturnReason;
  defectStage?: DefectStage;
  defectType?: DefectType;
  defectLocationText?: string;
  /** Maps to `createForm:reason` — the REQUIRED "Free-text Notes *" textarea. */
  notes?: string;
  defectDescription?: string;
  /** The form offers NORMAL/HIGH/URGENT while the domain uses LOW/MEDIUM/HIGH — GAP 5. */
  priority?: string;
  /** Option label of the driver dropdown, e.g. `Bob Levi (ABC-123)`. */
  driverLabel?: string;
  generalImages?: string[];
  defectImages?: string[];
  clearPhotosReceived?: boolean;
  generalPhotoExists?: boolean;
  focusedDefectPhotoExists?: boolean;
  /** Draw a real signature with mouse strokes. */
  signature?: boolean;
}

const F = {
  orderNumber: 'createForm:orderNumber',
  originalDeliveryDate: 'createForm:originalDeliveryDate',
  quantity: 'createForm:quantity',
  underWarranty: 'createForm:underWarranty',
  wasUsed: 'createForm:wasUsed',
  returnReason: 'createForm:returnReason',
  defectStage: 'createForm:defectStage',
  defectType: 'createForm:defectType',
  defectLocationText: 'createForm:defectLocationText',
  reason: 'createForm:reason',
  defect: 'createForm:defect',
  priority: 'createForm:priority',
  driver: 'createForm:driver',
  generalImages: 'createForm:generalImages',
  defectImages: 'createForm:defectImages',
  clearPhotos: 'createForm:clearPhotos',
  generalPhotoExists: 'createForm:generalPhotoExists',
  focusedDefectPhotoExists: 'createForm:focusedDefectPhotoExists',
} as const;

export class NewReturnPage extends WizardStepPage {
  readonly form: Locator;
  readonly messages: PfMessages;

  readonly orderNumber: Locator;
  readonly originalDeliveryDate: Locator;
  readonly quantity: Locator;
  readonly underWarranty: Locator;
  readonly wasUsed: Locator;
  readonly returnReason: Locator;
  readonly defectStage: Locator;
  readonly defectType: Locator;
  readonly defectLocationText: Locator;
  readonly notes: Locator;
  readonly defectDescription: Locator;
  readonly priority: Locator;
  readonly driver: Locator;
  readonly generalImages: Locator;
  readonly defectImages: Locator;
  readonly clearPhotosReceived: Locator;
  readonly generalPhotoExists: Locator;
  readonly focusedDefectPhotoExists: Locator;

  /** `p:signature` has no id — the container is located by class inside `#createForm`. */
  readonly signaturePad: Locator;
  readonly signatureCanvas: Locator;
  readonly signatureHiddenValue: Locator;
  readonly clearSignature: Locator;

  readonly create: Locator;
  readonly back: Locator;
  readonly cancel: Locator;
  readonly selectedItemFieldset: Locator;

  constructor(page: Page) {
    super(page, WIZARD_PATHS.step3);
    this.form = page.locator('#createForm');
    this.messages = pfMessages(this.form.locator('.ui-messages'));

    this.orderNumber = pfInput(page, F.orderNumber);
    this.originalDeliveryDate = page.locator(byId(`${F.originalDeliveryDate}_input`));
    this.quantity = page.locator(byId(`${F.quantity}_input`));
    this.underWarranty = page.locator(byId(F.underWarranty));
    this.wasUsed = page.locator(byId(F.wasUsed));
    this.returnReason = page.locator(byId(F.returnReason));
    this.defectStage = page.locator(byId(F.defectStage));
    this.defectType = page.locator(byId(F.defectType));
    this.defectLocationText = pfInput(page, F.defectLocationText);
    this.notes = pfInput(page, F.reason);
    this.defectDescription = pfInput(page, F.defect);
    this.priority = page.locator(byId(F.priority));
    this.driver = page.locator(byId(F.driver));
    this.generalImages = pfInput(page, F.generalImages);
    this.defectImages = pfInput(page, F.defectImages);
    this.clearPhotosReceived = page.locator(byId(F.clearPhotos));
    this.generalPhotoExists = page.locator(byId(F.generalPhotoExists));
    this.focusedDefectPhotoExists = page.locator(byId(F.focusedDefectPhotoExists));

    this.signaturePad = this.form.locator('.ui-signature').first();
    this.signatureCanvas = this.signaturePad.locator('canvas').first();
    this.signatureHiddenValue = this.form.locator('input[type="hidden"][id$="_value"]').first();
    this.clearSignature = this.form.locator('button:has-text("Clear Signature")');

    this.create = this.form.locator('button:has-text("Create Return Request")');
    this.back = this.form.locator('button:has-text("Back")');
    this.cancel = this.form.locator('button:has-text("Cancel")');
    this.selectedItemFieldset = this.form.locator('fieldset', { hasText: 'Selected Item' }).first();
  }

  override async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/new-return\.xhtml/);
    await expect(this.form).toBeVisible();
    await this.expectStep(3);
  }

  // --- individual setters --------------------------------------------------

  async setOrderNumber(value: string): Promise<void> {
    await pfFill(this.page, F.orderNumber, value);
  }

  /** `dd/MM/yyyy`. */
  async setDeliveryDate(ddMMyyyy: string): Promise<void> {
    await pfFillDate(this.page, F.originalDeliveryDate, ddMMyyyy);
  }

  async setQuantity(value: number): Promise<void> {
    await pfFillNumber(this.page, F.quantity, value);
  }

  async setUnderWarranty(checked: boolean): Promise<void> {
    await pfSetCheckbox(this.page, F.underWarranty, checked);
  }

  async setWasUsed(checked: boolean): Promise<void> {
    await pfSetCheckbox(this.page, F.wasUsed, checked);
  }

  async setReturnReason(value: ReturnReason): Promise<void> {
    await pfSelectOne(this.page, F.returnReason, value);
  }

  async setDefectStage(value: DefectStage): Promise<void> {
    await pfSelectOne(this.page, F.defectStage, value);
  }

  async setDefectType(value: DefectType): Promise<void> {
    await pfSelectOne(this.page, F.defectType, value);
  }

  async setDefectLocation(value: string): Promise<void> {
    await pfFill(this.page, F.defectLocationText, value);
  }

  /** The REQUIRED "Free-text Notes *" field (bean property `reason`). */
  async setNotes(value: string): Promise<void> {
    await pfFill(this.page, F.reason, value);
  }

  async setDefectDescription(value: string): Promise<void> {
    await pfFill(this.page, F.defect, value);
  }

  /** Option LABEL: 'Normal' | 'High' | 'Urgent' (values NORMAL/HIGH/URGENT) — GAP 5. */
  async setPriority(label: string): Promise<void> {
    await pfSelectOne(this.page, F.priority, label);
  }

  /** Option label, e.g. `Bob Levi (ABC-123)`, or `— No Driver —`. */
  async setDriver(label: string): Promise<void> {
    await pfSelectOne(this.page, F.driver, label);
  }

  async uploadGeneralImages(paths: string[]): Promise<void> {
    await this.generalImages.setInputFiles(paths);
  }

  async uploadDefectImages(paths: string[]): Promise<void> {
    await this.defectImages.setInputFiles(paths);
  }

  async setPhotoChecklist(opts: {
    clearPhotosReceived?: boolean;
    generalPhotoExists?: boolean;
    focusedDefectPhotoExists?: boolean;
  }): Promise<void> {
    if (opts.clearPhotosReceived !== undefined) {
      await pfSetCheckbox(this.page, F.clearPhotos, opts.clearPhotosReceived);
    }
    if (opts.generalPhotoExists !== undefined) {
      await pfSetCheckbox(this.page, F.generalPhotoExists, opts.generalPhotoExists);
    }
    if (opts.focusedDefectPhotoExists !== undefined) {
      await pfSetCheckbox(this.page, F.focusedDefectPhotoExists, opts.focusedDefectPhotoExists);
    }
  }

  // --- signature -----------------------------------------------------------

  /** Real mouse strokes on the canvas — `fill()` on the hidden input does not register. */
  async drawSignature(): Promise<void> {
    await drawSignature(this.page, this.signaturePad);
  }

  async clearSignaturePad(): Promise<void> {
    await this.clearSignature.click();
  }

  /** Raw value of the signature's hidden input; `''` when nothing has been drawn. */
  async signatureRawValue(): Promise<string> {
    if ((await this.signatureHiddenValue.count()) === 0) return '';
    return this.signatureHiddenValue.inputValue();
  }

  async hasSignature(): Promise<boolean> {
    return (await this.signatureRawValue()).trim().length > 0;
  }

  // --- bulk fill -----------------------------------------------------------

  async fill(data: NewReturnFormData): Promise<void> {
    if (data.orderNumber !== undefined) await this.setOrderNumber(data.orderNumber);
    if (data.originalDeliveryDate !== undefined) await this.setDeliveryDate(data.originalDeliveryDate);
    if (data.quantity !== undefined) await this.setQuantity(data.quantity);
    if (data.underWarranty !== undefined) await this.setUnderWarranty(data.underWarranty);
    if (data.wasUsed !== undefined) await this.setWasUsed(data.wasUsed);
    if (data.returnReason !== undefined) await this.setReturnReason(data.returnReason);
    if (data.defectStage !== undefined) await this.setDefectStage(data.defectStage);
    if (data.defectType !== undefined) await this.setDefectType(data.defectType);
    if (data.defectLocationText !== undefined) await this.setDefectLocation(data.defectLocationText);
    if (data.notes !== undefined) await this.setNotes(data.notes);
    if (data.defectDescription !== undefined) await this.setDefectDescription(data.defectDescription);
    if (data.priority !== undefined) await this.setPriority(data.priority);
    if (data.driverLabel !== undefined) await this.setDriver(data.driverLabel);
    if (data.generalImages?.length) await this.uploadGeneralImages(data.generalImages);
    if (data.defectImages?.length) await this.uploadDefectImages(data.defectImages);
    await this.setPhotoChecklist({
      clearPhotosReceived: data.clearPhotosReceived,
      generalPhotoExists: data.generalPhotoExists,
      focusedDefectPhotoExists: data.focusedDefectPhotoExists,
    });
    if (data.signature) await this.drawSignature();
  }

  // --- reads ---------------------------------------------------------------

  /** Selected Item fieldset values: 'Customer' | 'Phone' | 'Product' | 'SKU'. */
  async selectedItemField(label: 'Customer' | 'Phone' | 'Product' | 'SKU'): Promise<string> {
    const cell = this.selectedItemFieldset.locator(`td:has(label:text-is("${label}")) + td`).first();
    return (await cell.innerText()).trim();
  }

  /** Priority option labels as rendered — 'Normal', 'High', 'Urgent' today (GAP 5). */
  async priorityOptions(): Promise<string[]> {
    return pfSelectOptions(this.page, F.priority);
  }

  async priorityValues(): Promise<string[]> {
    return this.page
      .locator(`${byId(`${F.priority}_input`)} option`)
      .evaluateAll((els) => els.map((el) => (el as HTMLOptionElement).value));
  }

  async driverOptions(): Promise<string[]> {
    return pfSelectOptions(this.page, F.driver);
  }

  async returnReasonOptions(): Promise<string[]> {
    return pfSelectOptions(this.page, F.returnReason);
  }

  async selectedPriority(): Promise<string> {
    return pfSelectedLabel(this.page, F.priority);
  }

  async selectedDriver(): Promise<string> {
    return pfSelectedLabel(this.page, F.driver);
  }

  async isWasUsedChecked(): Promise<boolean> {
    return pfIsChecked(this.page, F.wasUsed);
  }

  async isUnderWarrantyChecked(): Promise<boolean> {
    return pfIsChecked(this.page, F.underWarranty);
  }

  // --- submit --------------------------------------------------------------

  /** Click Create, no waiting. Use for the validation cases. */
  async submit(): Promise<void> {
    await this.create.click();
  }

  /** Click Create and wait for the details redirect. Returns the new return id. */
  async submitAndOpenDetails(): Promise<number> {
    await this.create.click();
    await this.page.waitForURL(/\/returns\/details\.xhtml\?id=\d+/, { timeout: 60_000 });
    return Number(new URL(this.page.url()).searchParams.get('id'));
  }

  /** Click Create and assert the form stayed put with the given error. */
  async submitAndExpectError(text: string | RegExp): Promise<void> {
    await this.create.click();
    await expect(this.form).toContainText(text);
    await expect(this.page).toHaveURL(/new-return\.xhtml/);
  }

  async backToStep2(): Promise<void> {
    await this.back.click();
    await this.page.waitForURL(`**${WIZARD_PATHS.step2}**`);
  }

  async cancelToList(): Promise<void> {
    await this.cancel.click();
    await this.page.waitForURL('**/returns/list.xhtml**');
  }
}

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

/** All three steps behind one object, for specs that walk the whole wizard. */
export class CreateReturnWizard {
  readonly page: Page;
  readonly step1: IdentifyCustomerPage;
  readonly step2: SelectItemPage;
  readonly step3: NewReturnPage;

  constructor(page: Page) {
    this.page = page;
    this.step1 = new IdentifyCustomerPage(page);
    this.step2 = new SelectItemPage(page);
    this.step3 = new NewReturnPage(page);
  }

  /** Step 1 -> step 2 for a known customer phone. */
  async openStep2(phone: string): Promise<SelectItemPage> {
    await this.step1.gotoViaEntry();
    await this.step1.lookupAndContinue(phone);
    await this.step2.expectLoaded();
    return this.step2;
  }

  /** Step 1 -> step 2 -> step 3 on one named purchase. */
  async openStep3(phone: string, orderNumber: string): Promise<NewReturnPage> {
    await this.openStep2(phone);
    await this.step2.selectByOrderNumber(orderNumber);
    await this.step3.expectLoaded();
    return this.step3;
  }

  /** Step 1 -> step 2 -> step 3 on the first selectable purchase. Returns its order number. */
  async startFor(phone: string): Promise<string> {
    await this.openStep2(phone);
    const orderNumber = await this.step2.selectFirstAvailable();
    await this.step3.expectLoaded();
    return orderNumber;
  }
}

// ---------------------------------------------------------------------------
// Driving the wizard from a spec that only wants to GET somewhere
// ---------------------------------------------------------------------------

/**
 * Customers this worker may drive the wizard with, in order of preference.
 *
 * `data.customer` is the worker's own partition and is the right first choice, but
 * `customer_purchases` rows are consumed for good by any successful Create — and `wizard.spec.ts`
 * runs in the same worker. The extra offsets are read-only fallbacks so a smoke or coverage test
 * never fails merely because a journey spec spent the last selectable purchase.
 *
 * Nothing creates `customer_purchases` over the API, so this is a finite seeded resource.
 */
export function wizardCustomerPhones(data: DataFactory): string[] {
  return [0, 5, 10, 15].map((offset) => data.claimCustomer(data.workerIndex + offset).phone);
}

/**
 * Step 1 -> step 2, retrying across `wizardCustomerPhones` until one lands.
 *
 * `needSelectable` additionally requires the customer to still have an "Available" row, i.e. the
 * caller intends to press Select. Leave it false for tests that only need to BE on step 2 —
 * that way they never depend on purchase inventory at all.
 */
export async function driveToStep2(
  page: Page,
  data: DataFactory,
  needSelectable = false,
): Promise<CreateReturnWizard> {
  const wizard = new CreateReturnWizard(page);
  const tried: string[] = [];
  for (const phone of wizardCustomerPhones(data)) {
    await wizard.openStep2(phone);
    if (!needSelectable || (await wizard.step2.availableRows.count()) > 0) return wizard;
    tried.push(phone);
  }
  throw new Error(
    `no selectable purchase left on any customer this worker may use (${tried.join(', ')}) — ` +
      'customer_purchases are a finite seeded resource and nothing creates more over the API',
  );
}

/** Step 1 -> step 2 -> step 3, on the first still-Available purchase. */
export async function driveToStep3(page: Page, data: DataFactory): Promise<CreateReturnWizard> {
  const wizard = await driveToStep2(page, data, true);
  await wizard.step2.selectFirstAvailable();
  await wizard.step3.expectLoaded();
  return wizard;
}
