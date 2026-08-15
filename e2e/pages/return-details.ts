/**
 * `/returns/details.xhtml?id=N` — Figma 26:136.
 *
 * The whole body lives inside `rendered="#{returnDetailsBean.returnRequest != null}"`, so on an
 * unknown id ONLY `notFound` renders — no heading, no Back button. The Images card, the Status
 * History card and their testids are wrapped in `rendered="#{not empty ...}"` too: assert ABSENCE,
 * not emptiness.
 *
 * The page's `h:form` has no id, so its client id is `j_idt*` — never select on it.
 */

import type { Locator, Page, Response } from '@playwright/test';
import { expect } from '../fixtures';
import { BasePage } from './base';

/** Columns of the Status History table (1-based). */
export const TIMELINE_COLUMNS = {
  date: 1,
  from: 2,
  to: 3,
  changedBy: 4,
  notes: 5,
} as const;

export type TimelineColumn = keyof typeof TIMELINE_COLUMNS;

export class ReturnDetailsPage extends BasePage {
  readonly notFound: Locator;
  readonly detailsHeader: Locator;
  readonly statusBadge: Locator;
  readonly infoCard: Locator;
  readonly catalogBox: Locator;
  readonly catalogImage: Locator;
  readonly barcodeBlock: Locator;
  readonly barcodeWarning: Locator;
  readonly imageGallery: Locator;
  readonly images: Locator;
  readonly statusTimeline: Locator;
  readonly timelineRows: Locator;
  readonly backToList: Locator;

  constructor(page: Page) {
    super(page, '/returns/details.xhtml');
    this.notFound = page.locator('.ui-message-warn, .ui-messages-warn').first();
    this.detailsHeader = page.locator('.drb-details-header');
    this.statusBadge = page.getByTestId('status-badge');
    this.infoCard = page.locator('.drb-details-card').first();
    this.catalogBox = page.locator('.drb-catalog-box');
    this.catalogImage = this.catalogBox.locator('img');
    this.barcodeBlock = page.getByTestId('barcode-block');
    this.barcodeWarning = this.barcodeBlock.locator('.ui-message-warn, .ui-messages-warn');
    this.imageGallery = page.getByTestId('image-gallery');
    this.images = this.imageGallery.locator('img');
    this.statusTimeline = page.getByTestId('status-timeline');
    this.timelineRows = this.statusTimeline.locator('tbody tr');
    this.backToList = page.getByRole('button', { name: 'Back to List' });
  }

  /** Navigate to a specific return. Accepts a string so specs can probe `?id=abc` (GAP 4). */
  async gotoId(id: number | string): Promise<void> {
    await this.goto(`?id=${id}`);
  }

  /**
   * Same navigation, but hands back the HTTP response so a spec can assert the status code.
   * Needed by the GAP 4 probes: `?id=abc` must degrade to a warning, never a 500, and `gotoId`
   * swallows the `Response` that proves it.
   */
  gotoIdRaw(id: number | string): Promise<Response | null> {
    return this.page.goto(this.url(`?id=${id}`));
  }

  async openId(id: number): Promise<void> {
    await this.gotoId(id);
    await this.expectLoaded();
  }

  override async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/\/returns\/details\.xhtml/);
    await expect(this.detailsHeader).toBeVisible();
    await expect(this.statusBadge).toBeVisible();
  }

  /** No return matched the id: the warn message renders and nothing else does. */
  async expectNotFound(): Promise<void> {
    await expect(this.notFound).toContainText('Return request not found.');
    await expect(this.detailsHeader).toHaveCount(0);
  }

  async expectHeaderId(id: number): Promise<void> {
    await expect(this.detailsHeader.locator('h1')).toHaveText(`Return #${id}`);
  }

  /** Rendered chip label — 'Open', 'Waiting for pickup', 'Barcode assigned', ... */
  async statusLabel(): Promise<string> {
    return (await this.statusBadge.innerText()).trim();
  }

  /** The chip's CSS class, e.g. `drb-chip drb-chip-status-closed`. */
  async statusChipClass(): Promise<string> {
    return (await this.statusBadge.getAttribute('class')) ?? '';
  }

  // --- field grid ----------------------------------------------------------

  /** Value of a `.drb-field` by its exact label — 'Customer', 'Phone', 'SKU', 'Priority', ... */
  field(label: string): Locator {
    return this.page
      .locator(`.drb-field:has(> .drb-field-label:text-is("${label}"))`)
      .locator('.drb-field-value')
      .first();
  }

  async fieldText(label: string): Promise<string> {
    return (await this.field(label).innerText()).trim();
  }

  /** Same as `field`, scoped to the Barcode / Pickup card ('Barcode', 'Assigned At', ...). */
  barcodeField(label: string): Locator {
    return this.barcodeBlock
      .locator(`.drb-field:has(> .drb-field-label:text-is("${label}"))`)
      .locator('.drb-field-value')
      .first();
  }

  async barcodeText(): Promise<string> {
    return (await this.barcodeField('Barcode').innerText()).trim();
  }

  /** True when the "Barcode not assigned" warn message is showing. */
  async hasBarcodeWarning(): Promise<boolean> {
    return (await this.barcodeWarning.count()) > 0;
  }

  // --- sections ------------------------------------------------------------

  async hasImageGallery(): Promise<boolean> {
    return (await this.imageGallery.count()) > 0;
  }

  async imageCount(): Promise<number> {
    if (!(await this.hasImageGallery())) return 0;
    return this.images.count();
  }

  /** `src` of every thumbnail — enough to tell distinct uploads apart. */
  async imageSources(): Promise<string[]> {
    if (!(await this.hasImageGallery())) return [];
    return this.images.evaluateAll((els) => els.map((el) => (el as HTMLImageElement).src));
  }

  async hasStatusTimeline(): Promise<boolean> {
    return (await this.statusTimeline.count()) > 0;
  }

  async timelineRowCount(): Promise<number> {
    if (!(await this.hasStatusTimeline())) return 0;
    return this.timelineRows.count();
  }

  timelineCell(rowIndex: number, column: TimelineColumn): Locator {
    return this.timelineRows.nth(rowIndex).locator(`td:nth-child(${TIMELINE_COLUMNS[column]})`);
  }

  /** Chip labels in the "To" column, top to bottom — compare against `api.statusTrail(id)`. */
  async timelineToLabels(): Promise<string[]> {
    if (!(await this.hasStatusTimeline())) return [];
    const raw = await this.timelineRows
      .locator(`td:nth-child(${TIMELINE_COLUMNS.to})`)
      .allInnerTexts();
    return raw.map((t) => t.trim());
  }

  async timelineFromLabels(): Promise<string[]> {
    if (!(await this.hasStatusTimeline())) return [];
    const raw = await this.timelineRows
      .locator(`td:nth-child(${TIMELINE_COLUMNS.from})`)
      .allInnerTexts();
    return raw.map((t) => t.trim());
  }

  async backToListAndWait(): Promise<void> {
    await this.backToList.click();
    await this.page.waitForURL('**/returns/list.xhtml**');
  }

  /** Current `?id=` as a number, or NaN when it is not numeric. */
  currentId(): number {
    return Number(new URL(this.page.url()).searchParams.get('id'));
  }
}
