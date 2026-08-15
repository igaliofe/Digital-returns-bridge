/**
 * `/reports.xhtml` — Figma 27:2. MANAGER only.
 * 9 KPI tiles (the dashboard 8 plus Inspected) and 4 report panels. No interactive controls.
 */

import type { Locator, Page } from '@playwright/test';
import { expect } from '../fixtures';
import { BasePage } from './base';

export const REPORT_KPIS = [
  'open',
  'waiting-pickup',
  'barcode-assigned',
  'picked-up',
  'in-warehouse',
  'inspected',
  'closed',
  'needs-more-info',
  'no-barcode',
] as const;

export type ReportKpi = (typeof REPORT_KPIS)[number];

/**
 * Each panel is wrapped in `rendered="#{not empty ...}"`, so when the report has no data the
 * testid is ABSENT — assert absence, never emptiness.
 */
export const REPORT_TABLES = [
  'top-return-reasons',
  'returns-by-driver',
  'returns-by-customer',
  'monthly-volume',
] as const;

export type ReportTableName = (typeof REPORT_TABLES)[number];

export class ReportsPage extends BasePage {
  readonly statusOverview: Locator;
  readonly kpiGrid: Locator;
  readonly kpiCards: Locator;

  constructor(page: Page) {
    super(page, '/reports.xhtml');
    this.statusOverview = page.locator('.ui-panel', { hasText: 'Status Overview' }).first();
    this.kpiGrid = page.locator('.drb-kpi-grid');
    this.kpiCards = page.locator('.drb-kpi-card');
  }

  override async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/\/reports\.xhtml/);
    await expect(this.heading).toContainText('Reports');
    await expect(this.kpiGrid).toBeVisible();
  }

  /** The value span carrying the `kpi-<name>` testid. */
  kpi(name: ReportKpi): Locator {
    return this.page.getByTestId(`kpi-${name}`);
  }

  /**
   * The whole `.drb-kpi-card` that holds this KPI's value — use it to assert the testid sits on
   * the tile with the matching label. A hook that landed on the wrong tile would otherwise skew
   * every delta assertion silently instead of failing.
   */
  kpiCard(name: ReportKpi): Locator {
    return this.kpiCards.filter({ has: this.kpi(name) });
  }

  /** The tile's rendered label, e.g. 'Inspected'. */
  async kpiLabel(name: ReportKpi): Promise<string> {
    return (await this.kpiCard(name).locator('.drb-kpi-label').first().innerText()).trim();
  }

  async kpiValue(name: ReportKpi): Promise<number> {
    const raw = (await this.kpi(name).innerText()).trim();
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      throw new Error(`KPI "${name}" is not numeric: ${JSON.stringify(raw)}`);
    }
    return parsed;
  }

  async kpiValues(): Promise<Record<ReportKpi, number>> {
    const out = {} as Record<ReportKpi, number>;
    for (const name of REPORT_KPIS) {
      out[name] = await this.kpiValue(name);
    }
    return out;
  }

  /** All 9 tiles present and rendering a bare integer. */
  async expectAllKpisNumeric(): Promise<void> {
    await expect(this.kpiCards).toHaveCount(REPORT_KPIS.length);
    for (const name of REPORT_KPIS) {
      await expect(this.kpi(name)).toHaveText(/^\d+$/);
    }
  }

  /** The `p:panel` wrapper. Absent (count 0) when the underlying report is empty. */
  table(name: ReportTableName): Locator {
    return this.page.getByTestId(`report-${name}`);
  }

  tableRows(name: ReportTableName): Locator {
    return this.table(name).locator('tbody.ui-datatable-data > tr:not(.ui-datatable-empty-message)');
  }

  async tableIsPresent(name: ReportTableName): Promise<boolean> {
    return (await this.table(name).count()) > 0;
  }

  async tableRowCount(name: ReportTableName): Promise<number> {
    if (!(await this.tableIsPresent(name))) return 0;
    return this.tableRows(name).count();
  }

  /** Rows as `[label, count]` pairs — every report table is exactly two columns. */
  async tableData(name: ReportTableName): Promise<Array<[string, string]>> {
    if (!(await this.tableIsPresent(name))) return [];
    const rows = await this.tableRows(name).all();
    const out: Array<[string, string]> = [];
    for (const row of rows) {
      const cells = await row.locator('td').allInnerTexts();
      out.push([(cells[0] ?? '').trim(), (cells[1] ?? '').trim()]);
    }
    return out;
  }

  /** Every report panel that actually rendered. */
  async presentTables(): Promise<ReportTableName[]> {
    const present: ReportTableName[] = [];
    for (const name of REPORT_TABLES) {
      if (await this.tableIsPresent(name)) present.push(name);
    }
    return present;
  }
}
