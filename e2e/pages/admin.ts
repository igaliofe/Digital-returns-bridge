/**
 * The four admin CRUD screens — Figma 27:153 .. 28:136. MANAGER only.
 *
 * All four share one shape: a toolbar "New X" button opening `#createDialog`, and a row-editable
 * `p:dataTable` whose Actions column holds a `p:rowEditor` (pencil / check / close) plus an
 * icon-only Delete guarded by a native `confirm()`.
 *
 * Two things that bite:
 *  - The Delete button is icon-only. PrimeFaces emits `<span class="ui-button-text">ui-button</span>`
 *    for icon-only buttons, so its accessible name is garbage — select on `button[title="Delete"]`.
 *  - Inline row-save uses `oncomplete="#{bean.saveSelected()}"`, i.e. EL inside a JS attribute,
 *    which evaluates at RENDER time. Inline edits almost certainly never persist — GAP 3,
 *    see docs/e2e-findings.md. Encode the INTENDED behaviour (the edit survives a reload).
 *
 * There is NO REST delete endpoint for users/customers/products/drivers: UI delete is the only
 * cleanup path, so create rows with the `e2e-` prefix and remove them in `afterEach`.
 */

import type { Locator, Page } from '@playwright/test';
import { expect } from '../fixtures';
import { BasePage } from './base';
import {
  acceptConfirm,
  byId,
  clickAjax,
  dismissConfirm,
  pfFill,
  pfInput,
  pfIsChecked,
  pfSelectOne,
  pfSelectOptions,
  pfSetCheckbox,
  PfMessages,
  pfMessages,
} from './pf';

/**
 * Anchored, whitespace-tolerant matcher for a cell's whole text. Used instead of `:text-is()`,
 * which requires the matched element to be the smallest one holding the text — false for every
 * `p:cellEditor` column, where the value sits in a nested `div.ui-cell-editor-output`.
 */
function exactText(value: string | number): RegExp {
  const escaped = String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^\\s*${escaped}\\s*$`);
}

export interface AdminPageConfig {
  path: string;
  /** `h:form` wrapping the table, e.g. `usersForm`. */
  formId: string;
  /** `p:dataTable` client id, e.g. `usersForm:usersTable`. */
  tableId: string;
  /** `h:form` inside `#createDialog`, e.g. `createUserForm`. */
  dialogFormId: string;
  /** Label of the toolbar button, e.g. `New User`. */
  newButtonLabel: string;
  /** Heading text, e.g. `User Management`. */
  headingText: string;
  /** 1-based column positions, used by `cell` / `rowInput`. */
  columns: Readonly<Record<string, number>>;
}

export abstract class AdminCrudPage extends BasePage {
  readonly config: AdminPageConfig;
  readonly form: Locator;
  readonly table: Locator;
  /** Data rows only — the "No X found." row is excluded. */
  readonly rows: Locator;
  readonly emptyMessage: Locator;
  readonly messages: PfMessages;
  readonly newButton: Locator;
  readonly paginator: Locator;

  readonly dialog: Locator;
  readonly dialogForm: Locator;
  readonly dialogSave: Locator;
  readonly dialogCancel: Locator;
  /** Title-bar close icon — framework chrome, listed so specs can assert it exists. */
  readonly dialogClose: Locator;

  protected constructor(page: Page, config: AdminPageConfig) {
    super(page, config.path);
    this.config = config;
    this.form = page.locator(byId(config.formId));
    this.table = page.locator(byId(config.tableId));
    this.rows = this.table.locator('tbody.ui-datatable-data > tr:not(.ui-datatable-empty-message)');
    this.emptyMessage = this.table.locator('tr.ui-datatable-empty-message');
    this.messages = pfMessages(this.form.locator('.ui-messages').first());
    this.newButton = this.form.locator(`button:has-text("${config.newButtonLabel}")`);
    this.paginator = this.table.locator('.ui-paginator').first();

    this.dialog = page.locator('#createDialog');
    this.dialogForm = page.locator(byId(config.dialogFormId));
    this.dialogSave = this.dialogForm.locator('button:has-text("Save")');
    this.dialogCancel = this.dialogForm.locator('button:has-text("Cancel")');
    this.dialogClose = this.dialog.locator('.ui-dialog-titlebar-close');
  }

  override async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(this.path.replace(/[/.]/g, '\\$&')));
    await expect(this.heading).toHaveText(this.config.headingText);
    await expect(this.table).toBeVisible();
  }

  // --- create dialog -------------------------------------------------------

  async openCreateDialog(): Promise<void> {
    await this.newButton.click();
    await expect(this.dialog).toBeVisible();
    await expect(this.dialogForm).toBeVisible();
  }

  /** Click Cancel — client-side only, nothing is created. */
  async cancelCreateDialog(): Promise<void> {
    await this.dialogCancel.click();
    await expect(this.dialog).toBeHidden();
  }

  /** Save and expect success: the dialog closes and the table refreshes. */
  async saveCreateDialog(): Promise<void> {
    await clickAjax(this.page, this.dialogSave);
    await expect(this.dialog).toBeHidden();
  }

  /** Save and expect validation to fail: the dialog STAYS OPEN. */
  async saveCreateDialogExpectingValidationError(): Promise<void> {
    await clickAjax(this.page, this.dialogSave);
    await expect(this.dialog).toBeVisible();
  }

  // --- rows ----------------------------------------------------------------

  async rowCount(): Promise<number> {
    return this.rows.count();
  }

  async isEmpty(): Promise<boolean> {
    return (await this.emptyMessage.count()) > 0;
  }

  /**
   * Row whose `column`-th cell reads exactly `value`.
   *
   * NOT `td:nth-child(n):text-is(...)`: Playwright's `:text-is()` only matches when the element
   * is the SMALLEST one holding the text, and every editable column wraps its value in
   * `div.ui-cell-editor-output` — so the `<td>` never matches and the lookup silently finds
   * nothing. Filtering the cell by an anchored regex works for both plain and editable cells.
   */
  protected rowByCell(column: number, value: string | number): Locator {
    return this.rows.filter({
      has: this.page.locator(`td:nth-child(${column})`).filter({ hasText: exactText(value) }),
    });
  }

  /** Row whose ID cell is exactly `id`. */
  rowById(id: number): Locator {
    return this.rowByCell(1, id);
  }

  /** Row containing an exact cell text anywhere (name, phone, sku, ...). */
  rowByCellText(text: string): Locator {
    return this.rows.filter({ has: this.page.locator('td').filter({ hasText: exactText(text) }) });
  }

  cell(row: Locator, column: string): Locator {
    return row.locator(`td:nth-child(${this.columnIndex(column)})`);
  }

  async cellText(row: Locator, column: string): Promise<string> {
    return (await this.cell(row, column).innerText()).trim();
  }

  async ids(): Promise<number[]> {
    const raw = await this.rows.locator('td:nth-child(1)').allInnerTexts();
    return raw.map((t) => Number(t.trim())).filter((n) => Number.isFinite(n));
  }

  async columnTexts(column: string): Promise<string[]> {
    const raw = await this.rows
      .locator(`td:nth-child(${this.columnIndex(column)})`)
      .allInnerTexts();
    return raw.map((t) => t.trim());
  }

  protected columnIndex(column: string): number {
    const index = this.config.columns[column];
    if (!index) {
      throw new Error(
        `Unknown column "${column}" on ${this.path}. Known: ${Object.keys(this.config.columns).join(', ')}`,
      );
    }
    return index;
  }

  // --- inline row editing --------------------------------------------------

  rowEditPencil(row: Locator): Locator {
    return row.locator('.ui-row-editor-pencil');
  }

  rowEditSave(row: Locator): Locator {
    return row.locator('.ui-row-editor-check');
  }

  rowEditCancel(row: Locator): Locator {
    return row.locator('.ui-row-editor-close');
  }

  /** Enter edit mode; the row's cell editors switch from output to input. */
  async startRowEdit(row: Locator): Promise<void> {
    await clickAjax(this.page, this.rowEditPencil(row));
    await expect(this.rowEditSave(row)).toBeVisible();
  }

  /** The `<input>` inside a cell editor of an editing row. */
  rowInput(row: Locator, column: string): Locator {
    return this.cell(row, column).locator('.ui-cell-editor-input input').first();
  }

  /** The whole cell-editor input container (use for select menus and checkboxes). */
  rowEditorInput(row: Locator, column: string): Locator {
    return this.cell(row, column).locator('.ui-cell-editor-input');
  }

  async setRowText(row: Locator, column: string, value: string): Promise<void> {
    await this.rowInput(row, column).fill(value);
  }

  /** Commit the inline edit. GAP 3: this currently does not persist. */
  async commitRowEdit(row: Locator): Promise<void> {
    await clickAjax(this.page, this.rowEditSave(row));
  }

  async cancelRowEdit(row: Locator): Promise<void> {
    await clickAjax(this.page, this.rowEditCancel(row));
  }

  /** Pencil -> fill one text cell -> check, in one call. */
  async editRowText(row: Locator, column: string, value: string): Promise<void> {
    await this.startRowEdit(row);
    await this.setRowText(row, column, value);
    await this.commitRowEdit(row);
  }

  // --- delete --------------------------------------------------------------

  deleteButton(row: Locator): Locator {
    return row.locator('button[title="Delete"]');
  }

  /** Accept the native confirm and delete the row. */
  async deleteRow(row: Locator, confirmText?: string | RegExp): Promise<void> {
    const confirmed = acceptConfirm(this.page, confirmText);
    await clickAjax(this.page, this.deleteButton(row));
    await confirmed;
  }

  /** Cancel the native confirm — the row must survive. */
  async deleteRowCancelling(row: Locator, confirmText?: string | RegExp): Promise<void> {
    const dismissed = dismissConfirm(this.page, confirmText);
    await this.deleteButton(row).click();
    await dismissed;
  }

  /**
   * Best-effort `afterEach` cleanup: delete every row whose `column` text matches.
   * Pass `data.isE2eName` (or a `startsWith('e2e-')` check) so seeded rows are never touched.
   */
  async deleteRowsMatching(
    column: string,
    predicate: (text: string) => boolean,
    maxRows = 25,
  ): Promise<number> {
    let deleted = 0;
    while (deleted < maxRows) {
      const texts = await this.columnTexts(column);
      const index = texts.findIndex(predicate);
      if (index < 0) break;
      await this.deleteRow(this.rows.nth(index));
      deleted += 1;
    }
    return deleted;
  }

  // --- paginator -----------------------------------------------------------
  //
  // Load-bearing, not cosmetic: all four admin repositories run `SELECT e FROM E e` with NO
  // ORDER BY, the tables paginate at 20, and the seed ships 20 customers + 30 products — so a row
  // this suite just created routinely lands on page 2 and `rowById(...)` finds nothing on page 1.
  // Any lookup of a created row must go through `revealRow`.

  /** Number of page links the paginator renders (0 when the table fits on one page). */
  async pageCount(): Promise<number> {
    return this.paginator.locator('.ui-paginator-page').count();
  }

  /** 1-based index of the highlighted page link; 1 when the paginator renders no links. */
  async currentPage(): Promise<number> {
    const active = this.paginator.locator('.ui-paginator-page.ui-state-active').first();
    if ((await active.count()) === 0) return 1;
    const parsed = Number((await active.innerText()).trim());
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  /**
   * Click page `oneBased`. Never call this for the page you are already on — PrimeFaces'
   * `Paginator.setPage` short-circuits when `cfg.page === p`, so no XHR is issued and `clickAjax`
   * would sit there until it times out. `goToPageIfNeeded` handles that for you.
   *
   * The label regex is anchored: an unanchored `hasText: "1"` would also match "10", "11", "12".
   */
  async goToPage(oneBased: number): Promise<void> {
    const link = this.paginator
      .locator('.ui-paginator-page')
      .filter({ hasText: new RegExp(`^\\s*${oneBased}\\s*$`) })
      .first();
    await clickAjax(this.page, link);
  }

  async goToPageIfNeeded(oneBased: number): Promise<void> {
    if ((await this.currentPage()) !== oneBased) await this.goToPage(oneBased);
  }

  /**
   * Walk every paginator page until `row` resolves. Leaves the table parked on the page holding
   * it; returns false (from wherever it stopped) when the row is on no page at all.
   */
  async findRowAcrossPages(row: Locator): Promise<boolean> {
    const pages = Math.max(await this.pageCount(), 1);
    // `count()` is a single sample: called right after a create, it can read the table
    // mid-ajax-rebuild and miss a row that lands milliseconds later. Wait per page instead —
    // generously when there is only one page to search, briefly when walking several.
    const perPage = pages === 1 ? 10_000 : 2_000;
    for (let page = 1; page <= pages; page += 1) {
      await this.goToPageIfNeeded(page);
      try {
        await row.first().waitFor({ state: 'attached', timeout: perPage });
        return true;
      } catch {
        // not on this page — keep walking
      }
    }
    return false;
  }

  /** `findRowAcrossPages` that fails the test instead of returning false. */
  async revealRow(row: Locator, what: string): Promise<Locator> {
    const found = await this.findRowAcrossPages(row);
    expect(found, `row ${what} was not on any page of ${this.path}`).toBe(true);
    await expect(row).toHaveCount(1);
    return row;
  }

  async expectInfo(text: string | RegExp): Promise<void> {
    await this.messages.expectInfo(text);
  }

  async expectError(text: string | RegExp): Promise<void> {
    await this.messages.expectError(text);
  }
}

// ---------------------------------------------------------------------------
// /admin/users.xhtml
// ---------------------------------------------------------------------------

export const USER_COLUMNS = {
  id: 1,
  fullName: 2,
  phone: 3,
  role: 4,
  active: 5,
  actions: 6,
} as const;

export interface NewUserInput {
  fullName: string;
  phone: string;
  /** Server role name: SERVICE_REP | DRIVER | WAREHOUSE | MANAGER. */
  role: string;
  active?: boolean;
}

export class AdminUsersPage extends AdminCrudPage {
  readonly newFullName: Locator;
  readonly newPhone: Locator;
  readonly newRole: Locator;
  readonly newActive: Locator;

  constructor(page: Page) {
    super(page, {
      path: '/admin/users.xhtml',
      formId: 'usersForm',
      tableId: 'usersForm:usersTable',
      dialogFormId: 'createUserForm',
      newButtonLabel: 'New User',
      headingText: 'User Management',
      columns: USER_COLUMNS,
    });
    this.newFullName = pfInput(page, 'createUserForm:newFullName');
    this.newPhone = pfInput(page, 'createUserForm:newPhone');
    this.newRole = page.locator(byId('createUserForm:newRole'));
    this.newActive = page.locator(byId('createUserForm:newActive'));
  }

  rowByPhone(phone: string): Locator {
    return this.rowByCell(USER_COLUMNS.phone, phone);
  }

  rowByName(fullName: string): Locator {
    return this.rowByCell(USER_COLUMNS.fullName, fullName);
  }

  /** Open the dialog, fill it, save. Expects success ("User created"). */
  async createUser(input: NewUserInput): Promise<void> {
    await this.openCreateDialog();
    await this.fillCreateForm(input);
    await this.saveCreateDialog();
    await this.expectInfo('User created');
  }

  async fillCreateForm(input: Partial<NewUserInput>): Promise<void> {
    if (input.fullName !== undefined) {
      await pfFill(this.page, 'createUserForm:newFullName', input.fullName);
    }
    if (input.phone !== undefined) await pfFill(this.page, 'createUserForm:newPhone', input.phone);
    if (input.role !== undefined) await pfSelectOne(this.page, 'createUserForm:newRole', input.role);
    if (input.active !== undefined) {
      await pfSetCheckbox(this.page, 'createUserForm:newActive', input.active);
    }
  }

  async roleOptions(): Promise<string[]> {
    return pfSelectOptions(this.page, 'createUserForm:newRole');
  }

  async roleOf(row: Locator): Promise<string> {
    return this.cellText(row, 'role');
  }

  /** The Active column renders 'Yes' / 'No'. */
  async isActive(row: Locator): Promise<boolean> {
    return (await this.cellText(row, 'active')) === 'Yes';
  }

  async deleteUserRow(row: Locator, fullName: string): Promise<void> {
    await this.deleteRow(row, `Delete user ${fullName}?`);
    await this.expectInfo('User deleted');
  }
}

// ---------------------------------------------------------------------------
// /admin/customers.xhtml
// ---------------------------------------------------------------------------

export const CUSTOMER_COLUMNS = {
  id: 1,
  fullName: 2,
  phone: 3,
  email: 4,
  address: 5,
  actions: 6,
} as const;

export interface NewCustomerInput {
  fullName: string;
  phone: string;
  email?: string;
  address?: string;
}

export class AdminCustomersPage extends AdminCrudPage {
  readonly newName: Locator;
  readonly newPhone: Locator;
  readonly newEmail: Locator;
  readonly newAddress: Locator;

  constructor(page: Page) {
    super(page, {
      path: '/admin/customers.xhtml',
      formId: 'customersForm',
      tableId: 'customersForm:customersTable',
      dialogFormId: 'createCustomerForm',
      newButtonLabel: 'New Customer',
      headingText: 'Customer Management',
      columns: CUSTOMER_COLUMNS,
    });
    this.newName = pfInput(page, 'createCustomerForm:newName');
    this.newPhone = pfInput(page, 'createCustomerForm:newPhone');
    this.newEmail = pfInput(page, 'createCustomerForm:newEmail');
    this.newAddress = pfInput(page, 'createCustomerForm:newAddress');
  }

  rowByPhone(phone: string): Locator {
    return this.rowByCell(CUSTOMER_COLUMNS.phone, phone);
  }

  rowByName(fullName: string): Locator {
    return this.rowByCell(CUSTOMER_COLUMNS.fullName, fullName);
  }

  async createCustomer(input: NewCustomerInput): Promise<void> {
    await this.openCreateDialog();
    await this.fillCreateForm(input);
    await this.saveCreateDialog();
    await this.expectInfo('Customer created');
  }

  async fillCreateForm(input: Partial<NewCustomerInput>): Promise<void> {
    if (input.fullName !== undefined) {
      await pfFill(this.page, 'createCustomerForm:newName', input.fullName);
    }
    if (input.phone !== undefined) {
      await pfFill(this.page, 'createCustomerForm:newPhone', input.phone);
    }
    if (input.email !== undefined) {
      await pfFill(this.page, 'createCustomerForm:newEmail', input.email);
    }
    if (input.address !== undefined) {
      await pfFill(this.page, 'createCustomerForm:newAddress', input.address);
    }
  }

  async deleteCustomerRow(row: Locator, fullName: string): Promise<void> {
    await this.deleteRow(row, `Delete customer ${fullName}?`);
    await this.expectInfo('Customer deleted');
  }
}

// ---------------------------------------------------------------------------
// /admin/products.xhtml
// ---------------------------------------------------------------------------

export const PRODUCT_COLUMNS = {
  id: 1,
  image: 2,
  imageUrl: 3,
  sku: 4,
  name: 5,
  category: 6,
  price: 7,
  actions: 8,
} as const;

export interface NewProductInput {
  sku: string;
  name: string;
  category?: string;
  description?: string;
  price?: string;
  imageUrl?: string;
  /** Absolute path of a local image to upload through `createProductForm:newImageFile`. */
  imageFile?: string;
}

export class AdminProductsPage extends AdminCrudPage {
  readonly newSku: Locator;
  readonly newName: Locator;
  readonly newCategory: Locator;
  readonly newDescription: Locator;
  readonly newPrice: Locator;
  readonly newImageUrl: Locator;
  readonly newImageFile: Locator;

  constructor(page: Page) {
    super(page, {
      path: '/admin/products.xhtml',
      formId: 'productsForm',
      tableId: 'productsForm:productsTable',
      dialogFormId: 'createProductForm',
      newButtonLabel: 'New Product',
      headingText: 'Product Management',
      columns: PRODUCT_COLUMNS,
    });
    this.newSku = pfInput(page, 'createProductForm:newSku');
    this.newName = pfInput(page, 'createProductForm:newName');
    this.newCategory = pfInput(page, 'createProductForm:newCategory');
    this.newDescription = pfInput(page, 'createProductForm:newDesc');
    this.newPrice = pfInput(page, 'createProductForm:newPrice');
    this.newImageUrl = pfInput(page, 'createProductForm:newImageUrl');
    this.newImageFile = pfInput(page, 'createProductForm:newImageFile');
  }

  rowBySku(sku: string): Locator {
    return this.rowByCell(PRODUCT_COLUMNS.sku, sku);
  }

  rowByName(name: string): Locator {
    return this.rowByCell(PRODUCT_COLUMNS.name, name);
  }

  /** The catalog thumbnail in the Image column; absent when the product has no imageUrl. */
  rowImage(row: Locator): Locator {
    return this.cell(row, 'image').locator('img');
  }

  async createProduct(input: NewProductInput): Promise<void> {
    await this.openCreateDialog();
    await this.fillCreateForm(input);
    await this.saveCreateDialog();
    await this.expectInfo('Product created');
  }

  async fillCreateForm(input: Partial<NewProductInput>): Promise<void> {
    if (input.sku !== undefined) await pfFill(this.page, 'createProductForm:newSku', input.sku);
    if (input.name !== undefined) await pfFill(this.page, 'createProductForm:newName', input.name);
    if (input.category !== undefined) {
      await pfFill(this.page, 'createProductForm:newCategory', input.category);
    }
    if (input.description !== undefined) {
      await pfFill(this.page, 'createProductForm:newDesc', input.description);
    }
    if (input.price !== undefined) await pfFill(this.page, 'createProductForm:newPrice', input.price);
    if (input.imageUrl !== undefined) {
      await pfFill(this.page, 'createProductForm:newImageUrl', input.imageUrl);
    }
    if (input.imageFile !== undefined) await this.newImageFile.setInputFiles(input.imageFile);
  }

  async deleteProductRow(row: Locator, name: string): Promise<void> {
    await this.deleteRow(row, `Delete product ${name}?`);
    await this.expectInfo('Product deleted');
  }
}

// ---------------------------------------------------------------------------
// /admin/drivers.xhtml
// ---------------------------------------------------------------------------

export const DRIVER_COLUMNS = {
  id: 1,
  fullName: 2,
  phone: 3,
  vehicleNumber: 4,
  active: 5,
  actions: 6,
} as const;

export interface NewDriverInput {
  /** Option label of the User Account dropdown: `<fullName> (<phoneNumber>)`. */
  userLabel: string;
  phone: string;
  vehicleNumber?: string;
  active?: boolean;
}

export class AdminDriversPage extends AdminCrudPage {
  readonly newUser: Locator;
  readonly newPhone: Locator;
  readonly newVehicle: Locator;
  readonly newActive: Locator;

  constructor(page: Page) {
    super(page, {
      path: '/admin/drivers.xhtml',
      formId: 'driversForm',
      tableId: 'driversForm:driversTable',
      dialogFormId: 'createDriverForm',
      newButtonLabel: 'New Driver',
      headingText: 'Driver Management',
      columns: DRIVER_COLUMNS,
    });
    this.newUser = page.locator(byId('createDriverForm:newUser'));
    this.newPhone = pfInput(page, 'createDriverForm:newPhone');
    this.newVehicle = pfInput(page, 'createDriverForm:newVehicle');
    this.newActive = page.locator(byId('createDriverForm:newActive'));
  }

  rowByPhone(phone: string): Locator {
    return this.rowByCell(DRIVER_COLUMNS.phone, phone);
  }

  rowByVehicle(vehicleNumber: string): Locator {
    return this.rowByCell(DRIVER_COLUMNS.vehicleNumber, vehicleNumber);
  }

  /** The Full Name column comes from the linked user and is NOT editable. */
  async fullNameOf(row: Locator): Promise<string> {
    return this.cellText(row, 'fullName');
  }

  async isActive(row: Locator): Promise<boolean> {
    return (await this.cellText(row, 'active')) === 'Yes';
  }

  async createDriver(input: NewDriverInput): Promise<void> {
    await this.openCreateDialog();
    await this.fillCreateForm(input);
    await this.saveCreateDialog();
    await this.expectInfo('Driver created');
  }

  async fillCreateForm(input: Partial<NewDriverInput>): Promise<void> {
    if (input.userLabel !== undefined) {
      await pfSelectOne(this.page, 'createDriverForm:newUser', input.userLabel);
    }
    if (input.phone !== undefined) await pfFill(this.page, 'createDriverForm:newPhone', input.phone);
    if (input.vehicleNumber !== undefined) {
      await pfFill(this.page, 'createDriverForm:newVehicle', input.vehicleNumber);
    }
    if (input.active !== undefined) {
      await pfSetCheckbox(this.page, 'createDriverForm:newActive', input.active);
    }
  }

  /** Option labels of the User Account dropdown: `<fullName> (<phoneNumber>)`. */
  async userOptions(): Promise<string[]> {
    return pfSelectOptions(this.page, 'createDriverForm:newUser');
  }

  async isNewActiveChecked(): Promise<boolean> {
    return pfIsChecked(this.page, 'createDriverForm:newActive');
  }

  async deleteDriverRow(row: Locator): Promise<void> {
    await this.deleteRow(row, 'Delete this driver?');
    await this.expectInfo('Driver deleted');
  }
}
