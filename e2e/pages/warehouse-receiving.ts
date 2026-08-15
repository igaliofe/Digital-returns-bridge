/**
 * `/warehouse/receiving.xhtml` — Figma 49:2. WAREHOUSE (and MANAGER) only.
 *
 * Three sibling forms, all refreshed by the Search button:
 *   #searchForm      barcode lookup + `searchForm:searchMessages`
 *   #digitalFile     the digital return file; Mark as Arrived / Request More Info live here and
 *                    are `rendered` on status PICKED_UP / ARRIVED_TO_WAREHOUSE respectively
 *   #inspectionForm  the inspection card, rendered on ARRIVED_TO_WAREHOUSE or INSPECTED
 *
 * Both action buttons are guarded by a native `confirm()`. Playwright auto-DISMISSES dialogs, so
 * the `*Confirming()` helpers arm an accept handler before clicking.
 */

import type { Locator, Page } from '@playwright/test';
import {
  expect,
  type ItemCondition,
  type ReturnStatus,
  type WarehouseDecision,
} from '../fixtures';
import { BasePage } from './base';
import {
  acceptConfirm,
  byId,
  clickAjax,
  dismissConfirm,
  pfFill,
  pfInput,
  pfSelectOne,
  pfSetCheckbox,
  PfMessages,
  pfMessages,
} from './pf';

const F = {
  barcodeInput: 'searchForm:barcodeInput',
  searchMessages: 'searchForm:searchMessages',
  itemCondition: 'inspectionForm:itemCondition',
  decision: 'inspectionForm:decision',
  callFullyHandled: 'inspectionForm:callFullyHandled',
  notes: 'inspectionForm:notes',
} as const;

export const CONFIRM_MARK_ARRIVED = 'Mark this return as arrived at warehouse?';
export const CONFIRM_REQUEST_MORE_INFO = 'Send this return back for more info?';

export class WarehouseReceivingPage extends BasePage {
  readonly searchForm: Locator;
  readonly barcodeInput: Locator;
  readonly searchButton: Locator;
  readonly searchMessages: PfMessages;

  readonly digitalFileForm: Locator;
  /** The `p:panel` titled "Digital Return File — #N". Absent until a barcode is found. */
  readonly digitalFile: Locator;
  readonly digitalFileHeader: Locator;
  readonly catalogImage: Locator;
  readonly galleria: Locator;
  readonly galleriaThumbnails: Locator;
  readonly pickupTable: Locator;
  readonly pickupRows: Locator;
  readonly serviceSignature: Locator;
  readonly driverSignature: Locator;
  readonly markArrived: Locator;
  readonly requestMoreInfo: Locator;

  readonly inspectionForm: Locator;
  readonly inspectionCard: Locator;
  readonly itemCondition: Locator;
  readonly decision: Locator;
  readonly callFullyHandled: Locator;
  readonly notes: Locator;
  readonly saveInspection: Locator;
  readonly inspectionMessages: PfMessages;

  constructor(page: Page) {
    super(page, '/warehouse/receiving.xhtml');

    this.searchForm = page.locator('#searchForm');
    this.barcodeInput = pfInput(page, F.barcodeInput);
    this.searchButton = this.searchForm.locator('button:has-text("Search")');
    this.searchMessages = pfMessages(page.locator(byId(F.searchMessages)));

    this.digitalFileForm = page.locator('#digitalFile');
    this.digitalFile = this.digitalFileForm.locator('.ui-panel').first();
    this.digitalFileHeader = this.digitalFileForm.locator('.ui-panel-title').first();
    this.catalogImage = this.digitalFileForm.locator('.ui-panel-content img').first();
    this.galleria = this.digitalFileForm.locator('.ui-galleria');
    this.galleriaThumbnails = this.galleria.locator('.ui-galleria-thumbnail-item img');
    this.pickupTable = this.digitalFileForm.locator('.ui-datatable').first();
    this.pickupRows = this.pickupTable.locator(
      'tbody.ui-datatable-data > tr:not(.ui-datatable-empty-message)',
    );
    this.serviceSignature = this.digitalFileForm
      .locator('div:has(> label:text-is("Service Rep Signature")) img')
      .first();
    this.driverSignature = this.digitalFileForm
      .locator('div:has(> label:text-is("Driver Signature")) img')
      .first();
    this.markArrived = this.digitalFileForm.locator('button:has-text("Mark as Arrived")');
    this.requestMoreInfo = this.digitalFileForm.locator('button:has-text("Request More Info")');

    this.inspectionForm = page.locator('#inspectionForm');
    this.inspectionCard = page.locator('.drb-inspection-card');
    this.itemCondition = page.locator(byId(F.itemCondition));
    this.decision = page.locator(byId(F.decision));
    this.callFullyHandled = page.locator(byId(F.callFullyHandled));
    this.notes = pfInput(page, F.notes);
    this.saveInspection = this.inspectionForm.locator('button:has-text("Save Inspection")');
    this.inspectionMessages = pfMessages(this.inspectionForm.locator('.ui-messages'));
  }

  override async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/\/warehouse\/receiving\.xhtml/);
    await expect(this.heading).toHaveText('Warehouse Receiving');
    await expect(this.barcodeInput).toBeVisible();
  }

  // --- lookup --------------------------------------------------------------

  /** Type a barcode and hit Search, waiting for the ajax refresh of all three forms. */
  async search(barcode: string): Promise<void> {
    await this.barcodeInput.fill(barcode);
    await clickAjax(this.page, this.searchButton);
  }

  async expectFound(barcode: string): Promise<void> {
    await expect(this.digitalFile).toBeVisible();
    await expect(this.fileFieldValue('Barcode')).toHaveText(barcode);
  }

  async expectNotFound(barcode: string): Promise<void> {
    await this.searchMessages.expectError(`No return request found with barcode: ${barcode}`);
    await expect(this.digitalFile).toHaveCount(0);
  }

  async isFileVisible(): Promise<boolean> {
    return (await this.digitalFile.count()) > 0;
  }

  /**
   * Value cell of the digital file's `p:panelGrid` by its label — 'Customer', 'Phone',
   * 'Order Number', 'Quantity', 'Original Delivery Date', 'Return Date', 'Under Warranty',
   * 'Was Used', 'Priority', 'Status', 'Barcode', 'Driver', plus the Service Defect Detail
   * labels ('Return Reason', 'Defect Type', 'Defect Stage', 'Defect Location', 'Reason Notes',
   * 'Defect Description').
   */
  fileFieldValue(label: string): Locator {
    return this.digitalFileForm.locator(`td:has(label:text-is("${label}")) + td`).first();
  }

  async fileFieldText(label: string): Promise<string> {
    return (await this.fileFieldValue(label).innerText()).trim();
  }

  /** The raw enum name rendered in the Status cell, e.g. `ARRIVED_TO_WAREHOUSE`. */
  async statusText(): Promise<string> {
    return this.fileFieldText('Status');
  }

  async expectStatus(status: ReturnStatus): Promise<void> {
    await expect(this.fileFieldValue('Status')).toHaveText(status);
  }

  async returnIdInHeader(): Promise<number> {
    const text = (await this.digitalFileHeader.innerText()).trim();
    return Number(text.split('#')[1]);
  }

  async galleryCount(): Promise<number> {
    if ((await this.galleria.count()) === 0) return 0;
    return this.galleriaThumbnails.count();
  }

  async pickupRowCount(): Promise<number> {
    if ((await this.pickupTable.count()) === 0) return 0;
    return this.pickupRows.count();
  }

  // --- actions -------------------------------------------------------------

  async isMarkArrivedVisible(): Promise<boolean> {
    return (await this.markArrived.count()) > 0;
  }

  async isRequestMoreInfoVisible(): Promise<boolean> {
    return (await this.requestMoreInfo.count()) > 0;
  }

  /** Accept the native confirm and mark arrived: PICKED_UP -> ARRIVED_TO_WAREHOUSE. */
  async markArrivedConfirming(): Promise<void> {
    const confirmed = acceptConfirm(this.page, CONFIRM_MARK_ARRIVED);
    await clickAjax(this.page, this.markArrived);
    await confirmed;
  }

  /** Cancel the confirm — the status must NOT change. */
  async markArrivedCancelling(): Promise<void> {
    const dismissed = dismissConfirm(this.page, CONFIRM_MARK_ARRIVED);
    await this.markArrived.click();
    await dismissed;
  }

  /** Accept the native confirm: ARRIVED_TO_WAREHOUSE -> NEEDS_MORE_INFO. */
  async requestMoreInfoConfirming(): Promise<void> {
    const confirmed = acceptConfirm(this.page, CONFIRM_REQUEST_MORE_INFO);
    await clickAjax(this.page, this.requestMoreInfo);
    await confirmed;
  }

  async requestMoreInfoCancelling(): Promise<void> {
    const dismissed = dismissConfirm(this.page, CONFIRM_REQUEST_MORE_INFO);
    await this.requestMoreInfo.click();
    await dismissed;
  }

  // --- inspection ----------------------------------------------------------

  async isInspectionFormVisible(): Promise<boolean> {
    return (await this.inspectionCard.count()) > 0;
  }

  async setItemCondition(value: ItemCondition): Promise<void> {
    await pfSelectOne(this.page, F.itemCondition, value);
  }

  async setDecision(value: WarehouseDecision): Promise<void> {
    await pfSelectOne(this.page, F.decision, value);
  }

  async setCallFullyHandled(checked: boolean): Promise<void> {
    await pfSetCheckbox(this.page, F.callFullyHandled, checked);
  }

  async setNotes(text: string): Promise<void> {
    await pfFill(this.page, F.notes, text);
  }

  async fillInspection(opts: {
    itemCondition: ItemCondition;
    decision: WarehouseDecision;
    callFullyHandled?: boolean;
    notes?: string;
  }): Promise<void> {
    await this.setItemCondition(opts.itemCondition);
    await this.setDecision(opts.decision);
    if (opts.callFullyHandled !== undefined) await this.setCallFullyHandled(opts.callFullyHandled);
    if (opts.notes !== undefined) await this.setNotes(opts.notes);
  }

  /** Save the inspection and wait for the ajax refresh of `#inspectionForm`. */
  async saveInspectionAndWait(): Promise<void> {
    await clickAjax(this.page, this.saveInspection);
  }

  /** Fill + save in one call. */
  async inspect(opts: {
    itemCondition: ItemCondition;
    decision: WarehouseDecision;
    callFullyHandled?: boolean;
    notes?: string;
  }): Promise<void> {
    await this.fillInspection(opts);
    await this.saveInspectionAndWait();
  }

  async expectInspectionSaved(): Promise<void> {
    await this.inspectionMessages.expectInfo('Inspection saved');
  }
}
