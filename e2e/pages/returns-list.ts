/**
 * `/returns/list.xhtml` — Figma 20:78.
 * One `h:form id="filterForm"` holds BOTH the filter card and `p:dataTable id="returnsTable"`,
 * so every client id below is `filterForm:*`.
 */

import type { Locator, Page } from '@playwright/test';
import { expect, type ReturnStatus } from '../fixtures';
import { BasePage } from './base';
import { byId, clickAjax, pfInput, pfSetCheckbox, pfSelectOne, pfSelectedLabel } from './pf';

/** Columns of `filterForm:returnsTable`, in render order (1-based, matches `td:nth-child`). */
export const LIST_COLUMNS = {
  id: 1,
  barcode: 2,
  customer: 3,
  product: 4,
  status: 5,
  driver: 6,
  priority: 7,
  createdAt: 8,
  actions: 9,
} as const;

export type ListColumn = keyof typeof LIST_COLUMNS;

export const STATUS_FILTER_ALL = '— All Statuses —';
export const DRIVER_FILTER_ALL = '— All Drivers —';

export class ReturnsListPage extends BasePage {
  readonly form: Locator;
  readonly filterCard: Locator;
  readonly statusFilter: Locator;
  readonly driverFilter: Locator;
  readonly customerFilter: Locator;
  readonly barcodeFilter: Locator;
  readonly noBarcodeFilter: Locator;
  readonly applyFilters: Locator;
  readonly table: Locator;
  /** Data rows only — the "No return requests found." row is excluded. */
  readonly rows: Locator;
  readonly emptyMessage: Locator;
  readonly statusBadges: Locator;
  readonly paginator: Locator;

  private readonly statusFilterId = 'filterForm:statusFilter';
  private readonly driverFilterId = 'filterForm:driverFilter';
  private readonly customerFilterId = 'filterForm:customerFilter';
  private readonly barcodeFilterId = 'filterForm:barcodeFilter';
  private readonly noBarcodeFilterId = 'filterForm:noBarcodeFilter';

  constructor(page: Page) {
    super(page, '/returns/list.xhtml');
    this.form = page.locator('#filterForm');
    this.filterCard = page.locator('.drb-filter-card');
    this.statusFilter = page.locator(byId(this.statusFilterId));
    this.driverFilter = page.locator(byId(this.driverFilterId));
    this.customerFilter = pfInput(page, this.customerFilterId);
    this.barcodeFilter = pfInput(page, this.barcodeFilterId);
    this.noBarcodeFilter = page.locator(byId(this.noBarcodeFilterId));
    this.applyFilters = this.form.locator('button:has-text("Apply Filters")');
    this.table = page.locator(byId('filterForm:returnsTable'));
    this.rows = this.table.locator('tbody.ui-datatable-data > tr:not(.ui-datatable-empty-message)');
    this.emptyMessage = this.table.locator('tr.ui-datatable-empty-message');
    this.statusBadges = this.table.getByTestId('status-badge');
    this.paginator = this.table.locator('.ui-paginator').first();
  }

  override async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/\/returns\/list\.xhtml/);
    await expect(this.heading).toHaveText('Return Requests');
    await expect(this.table).toBeVisible();
  }

  // --- filters -------------------------------------------------------------

  /** Pass null for "— All Statuses —". Does not submit — call `apply()`. */
  async setStatus(status: ReturnStatus | null): Promise<void> {
    await pfSelectOne(this.page, this.statusFilterId, status ?? STATUS_FILTER_ALL);
  }

  /** Driver is selected by the driver's user full name (e.g. 'Bob Levi'), or null for all. */
  async setDriver(driverName: string | null): Promise<void> {
    await pfSelectOne(this.page, this.driverFilterId, driverName ?? DRIVER_FILTER_ALL);
  }

  async setCustomerQuery(query: string): Promise<void> {
    await this.customerFilter.fill(query);
  }

  async setBarcodeQuery(barcode: string): Promise<void> {
    await this.barcodeFilter.fill(barcode);
  }

  async setNoBarcodeOnly(on: boolean): Promise<void> {
    await pfSetCheckbox(this.page, this.noBarcodeFilterId, on);
  }

  async selectedStatus(): Promise<string> {
    return pfSelectedLabel(this.page, this.statusFilterId);
  }

  async selectedDriver(): Promise<string> {
    return pfSelectedLabel(this.page, this.driverFilterId);
  }

  /** Submit the filter form and wait for the ajax table update. */
  async apply(): Promise<void> {
    await clickAjax(this.page, this.applyFilters);
  }

  /** Set every filter you care about, then apply, in one call. */
  async filterBy(criteria: {
    status?: ReturnStatus | null;
    driverName?: string | null;
    customerQuery?: string;
    barcode?: string;
    noBarcodeOnly?: boolean;
  }): Promise<void> {
    if (criteria.status !== undefined) await this.setStatus(criteria.status);
    if (criteria.driverName !== undefined) await this.setDriver(criteria.driverName);
    if (criteria.customerQuery !== undefined) await this.setCustomerQuery(criteria.customerQuery);
    if (criteria.barcode !== undefined) await this.setBarcodeQuery(criteria.barcode);
    if (criteria.noBarcodeOnly !== undefined) await this.setNoBarcodeOnly(criteria.noBarcodeOnly);
    await this.apply();
  }

  /** Reload the page to drop every filter (the bean is @ViewScoped). */
  async clearFilters(): Promise<void> {
    await this.goto();
    await this.expectLoaded();
  }

  // --- rows ----------------------------------------------------------------

  async rowCount(): Promise<number> {
    return this.rows.count();
  }

  async isEmpty(): Promise<boolean> {
    return (await this.emptyMessage.count()) > 0;
  }

  /** Matched on the row's View link href, so id 5 never matches id 50. */
  row(id: number): Locator {
    return this.rows.filter({ has: this.page.locator(`a[href$="id=${id}"]`) });
  }

  cell(id: number, column: ListColumn): Locator {
    return this.row(id).locator(`td:nth-child(${LIST_COLUMNS[column]})`);
  }

  viewLink(id: number): Locator {
    return this.row(id).locator('a.drb-link-view');
  }

  statusBadge(id: number): Locator {
    return this.row(id).getByTestId('status-badge');
  }

  /** Ids on the current page, in display order. */
  async ids(): Promise<number[]> {
    const hrefs = await this.rows.locator('a.drb-link-view').evaluateAll((els) =>
      els.map((el) => (el as HTMLAnchorElement).getAttribute('href') ?? ''),
    );
    return hrefs
      .map((href) => Number(href.split('id=')[1]))
      .filter((n) => Number.isFinite(n));
  }

  async columnTexts(column: ListColumn): Promise<string[]> {
    const raw = await this.rows.locator(`td:nth-child(${LIST_COLUMNS[column]})`).allInnerTexts();
    return raw.map((t) => t.trim());
  }

  /** Rendered status chip labels ('Waiting for pickup', 'Barcode assigned', ...). */
  async statusLabels(): Promise<string[]> {
    const raw = await this.statusBadges.allInnerTexts();
    return raw.map((t) => t.trim());
  }

  async barcodes(): Promise<string[]> {
    return this.columnTexts('barcode');
  }

  async containsId(id: number): Promise<boolean> {
    return (await this.row(id).count()) > 0;
  }

  async expectContainsId(id: number): Promise<void> {
    await expect(this.row(id)).toHaveCount(1);
  }

  async expectDoesNotContainId(id: number): Promise<void> {
    await expect(this.row(id)).toHaveCount(0);
  }

  /** Click a row's View link and wait for `/returns/details.xhtml?id=<id>`. */
  async openDetails(id: number): Promise<void> {
    await this.viewLink(id).click();
    // A RegExp, not a glob: Playwright's URL globs do not reliably escape `?`.
    await this.page.waitForURL(new RegExp(`/returns/details\\.xhtml\\?id=${id}$`));
  }

  // --- table chrome --------------------------------------------------------

  /** Click a sortable column header (`sortMode="multiple"`, so clicks accumulate). */
  async sortBy(headerText: string): Promise<void> {
    await clickAjax(
      this.page,
      this.table.locator('th.ui-sortable-column').filter({ hasText: headerText }).first(),
    );
  }

  async sortOrderOf(headerText: string): Promise<string | null> {
    return this.table
      .locator('th.ui-sortable-column')
      .filter({ hasText: headerText })
      .first()
      .getAttribute('aria-sort');
  }

  /**
   * `rowsPerPageTemplate="10,20,50"`. PrimeFaces renders this either as a native `<select>`
   * or as a dropdown widget depending on theme/version — both are handled.
   */
  async setRowsPerPage(rows: 10 | 20 | 50): Promise<void> {
    const native = this.paginator.locator('select.ui-paginator-rpp-options');
    if ((await native.count()) > 0) {
      const response = this.page.waitForResponse(
        (r) => r.request().method() === 'POST' && r.request().resourceType() === 'xhr',
      );
      await native.selectOption(String(rows));
      await response;
      return;
    }
    const widget = this.paginator.locator('.ui-paginator-rpp-options').first();
    await widget.click();
    await clickAjax(
      this.page,
      this.page.locator(`.ui-selectonemenu-panel li[data-label="${rows}"]`).first(),
    );
  }

  /**
   * Click page `oneBased`. The label regex is anchored on purpose — an unanchored `hasText: "1"`
   * substring-matches "10", "11", "12" and only DOM order saves it.
   *
   * Never call this for the page you are already on: PrimeFaces' `Paginator.setPage` short-circuits
   * when `cfg.page === p`, so no XHR is issued and `clickAjax` waits out its full timeout.
   */
  async goToPage(oneBased: number): Promise<void> {
    await clickAjax(
      this.page,
      this.paginator
        .locator('.ui-paginator-page')
        .filter({ hasText: new RegExp(`^\\s*${oneBased}\\s*$`) })
        .first(),
    );
  }

  async currentPage(): Promise<number> {
    const active = this.paginator.locator('.ui-paginator-page.ui-state-active').first();
    return Number((await active.innerText()).trim());
  }

  async pageCount(): Promise<number> {
    return this.paginator.locator('.ui-paginator-page').count();
  }
}
