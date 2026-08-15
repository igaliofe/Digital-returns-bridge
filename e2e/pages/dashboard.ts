/** `/dashboard.xhtml` — Figma 20:22. 8 KPI tiles + 4 shortcut buttons. */

import type { Locator, Page } from '@playwright/test';
import { expect } from '../fixtures';
import { BasePage } from './base';

/**
 * `data-testid` values sit on the KPI VALUE span, so `textContent` is the bare number.
 * Reports repeats these names and adds `inspected` — scope per page object.
 */
export const DASHBOARD_KPIS = [
  'open',
  'waiting-pickup',
  'barcode-assigned',
  'picked-up',
  'in-warehouse',
  'closed',
  'needs-more-info',
  'no-barcode',
] as const;

export type DashboardKpi = (typeof DASHBOARD_KPIS)[number];

export class DashboardPage extends BasePage {
  readonly kpiGrid: Locator;
  readonly kpiCards: Locator;
  readonly newReturn: Locator;
  readonly viewAllReturns: Locator;
  readonly reports: Locator;
  readonly warehouseReceiving: Locator;

  constructor(page: Page) {
    super(page, '/dashboard.xhtml');
    this.kpiGrid = page.locator('.drb-kpi-grid');
    this.kpiCards = page.locator('.drb-kpi-card');
    this.newReturn = page.getByRole('button', { name: 'New Return', exact: true });
    this.viewAllReturns = page.getByRole('button', { name: 'View All Returns' });
    this.reports = page.getByRole('button', { name: 'Reports', exact: true });
    this.warehouseReceiving = page.getByRole('button', { name: 'Warehouse Receiving' });
  }

  override async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/\/dashboard\.xhtml/);
    await expect(this.heading).toHaveText('Dashboard');
    await expect(this.kpiGrid).toBeVisible();
  }

  kpi(name: DashboardKpi): Locator {
    return this.page.getByTestId(`kpi-${name}`);
  }

  /** Label text of the card owning a KPI value (e.g. 'Waiting Pickup'). */
  kpiCard(name: DashboardKpi): Locator {
    return this.page.locator('.drb-kpi-card').filter({ has: this.kpi(name) });
  }

  async kpiValue(name: DashboardKpi): Promise<number> {
    const raw = (await this.kpi(name).innerText()).trim();
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      throw new Error(`KPI "${name}" is not numeric: ${JSON.stringify(raw)}`);
    }
    return parsed;
  }

  /** Snapshot every tile — the read side of a read -> act -> re-read delta assertion. */
  async kpiValues(): Promise<Record<DashboardKpi, number>> {
    const out = {} as Record<DashboardKpi, number>;
    for (const name of DASHBOARD_KPIS) {
      out[name] = await this.kpiValue(name);
    }
    return out;
  }

  /** All 8 tiles present and rendering a bare integer. */
  async expectAllKpisNumeric(): Promise<void> {
    await expect(this.kpiCards).toHaveCount(DASHBOARD_KPIS.length);
    for (const name of DASHBOARD_KPIS) {
      await expect(this.kpi(name)).toHaveText(/^\d+$/);
    }
  }

  async goToNewReturn(): Promise<void> {
    await this.newReturn.click();
    await this.page.waitForURL('**/returns/create/identify-customer.xhtml**');
  }

  async goToReturnsList(): Promise<void> {
    await this.viewAllReturns.click();
    await this.page.waitForURL('**/returns/list.xhtml**');
  }

  async goToReports(): Promise<void> {
    await this.reports.click();
    await this.page.waitForURL('**/reports.xhtml**');
  }

  async goToWarehouse(): Promise<void> {
    await this.warehouseReceiving.click();
    await this.page.waitForURL('**/warehouse/receiving.xhtml**');
  }
}
