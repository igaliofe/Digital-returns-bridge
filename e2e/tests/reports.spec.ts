/**
 * JOURNEY 8 — REPORTS (`/reports.xhtml`, Figma 27:2). MANAGER only.
 *
 * Requirements covered (docs/e2e-test-plan.md §5.8):
 *   R1 — all 9 KPI tiles present and numeric (the dashboard 8 plus `kpi-inspected`).
 *   R2 — each of the 4 report panels renders when its report has data; an empty report means the
 *        whole panel is ABSENT (`rendered="#{not empty …}"`), never a rendered-but-empty table.
 *   R3 — creating a return raises the tiles (read → act → re-read).
 *   R4 — tile values agree with the `api.dashboard()` oracle.
 *
 * NOT covered here, on purpose: who may open `/reports.xhtml`. The 4-role × 14-route access matrix
 * (and therefore GAP 1 / GAP 2 as they apply to this route) is owned by `roles.spec.ts`, which
 * drives it off `e2e/inventory/routes-and-controls.ts`. Restating it here would fork the matrix.
 * The screen also has zero interactive controls beyond the layout header, so there is nothing for
 * this spec to click — `routes.smoke.spec.ts` + `coverage.spec.ts` own that guarantee.
 *
 * ---------------------------------------------------------------------------------------------
 * PARALLEL SAFETY (`--workers=4`) — why every assertion below is an inequality
 * ---------------------------------------------------------------------------------------------
 * These KPIs are GLOBAL counters over `return_requests`. Sibling workers create returns and walk
 * them through the transition table while this spec is reading tiles, so:
 *
 *   - No absolute count is ever asserted, and no seeded `RET-100xx` row is relied on.
 *   - `expect(after).toBe(before + 1)` is NOT safe for any single tile: a concurrent worker moving
 *     its own return OPEN → WAITING_FOR_PICKUP makes `open` go DOWN between two reads. Per-status
 *     tiles are non-monotonic, so a per-status delta can only be asserted as "≥ what this test
 *     itself put there".
 *   - Two quantities ARE monotonically non-decreasing for the whole run, and those carry the delta
 *     assertions:
 *       * the SUM of the 8 status tiles = total returns in the system — nothing deletes a return
 *         (there is no DELETE endpoint) and every return is in exactly one status;
 *       * the `closed` tile — `CLOSED` is terminal in `ALLOWED_TRANSITIONS`, nothing transitions
 *         out of it.
 *     For a monotone counter, a read at time t2 > t1 is always ≥ the read at t1, which makes an
 *     API-bracketed oracle check (page-read sandwiched between two API reads) rigorous rather than
 *     racy — that is how R4 is asserted below.
 *   - Every return this file touches is provisioned by `data.makeReturn()` (worker-namespaced
 *     barcodes, this worker's claimed customer), and nothing else can move it, so "the tile counts
 *     at least MY return" holds no matter what the other workers do.
 *
 * `managerPage` (the worker's shared MANAGER session) is safe here: `ReportsBean` is
 * `@RequestScoped` and the screen is read-only, so there is no session state to collide over.
 */

import {
  test,
  expect,
  RETURN_STATUSES,
  SEED_CUSTOMER_COUNT,
  SEED_DRIVERS,
  type ReturnStatus,
} from '../fixtures';
import {
  DashboardPage,
  REPORT_KPIS,
  REPORT_TABLES,
  ReportsPage,
  type ReportKpi,
  type ReportTableName,
} from '../pages';

// ---------------------------------------------------------------------------
// Tile ↔ status mapping (ReportsBean.getDashboardValue)
// ---------------------------------------------------------------------------

/** Each of the 8 `ReturnStatus` values has exactly one tile; `no-barcode` is the 9th, derived. */
const KPI_FOR_STATUS: Readonly<Record<ReturnStatus, ReportKpi>> = {
  OPEN: 'open',
  WAITING_FOR_PICKUP: 'waiting-pickup',
  BARCODE_ASSIGNED: 'barcode-assigned',
  PICKED_UP: 'picked-up',
  ARRIVED_TO_WAREHOUSE: 'in-warehouse',
  INSPECTED: 'inspected',
  CLOSED: 'closed',
  NEEDS_MORE_INFO: 'needs-more-info',
};

/** The 8 status tiles, in `RETURN_STATUSES` order. Excludes the derived `no-barcode` tile. */
const STATUS_KPIS: readonly ReportKpi[] = RETURN_STATUSES.map((s) => KPI_FOR_STATUS[s]);

/** The label printed on each tile's card — proves the testid sits on the card it claims to. */
const KPI_LABEL: Readonly<Record<ReportKpi, string>> = {
  open: 'Open',
  'waiting-pickup': 'Waiting Pickup',
  'barcode-assigned': 'Barcode Assigned',
  'picked-up': 'Picked Up',
  'in-warehouse': 'In Warehouse',
  inspected: 'Inspected',
  closed: 'Closed',
  'needs-more-info': 'Needs More Info',
  'no-barcode': 'No Barcode Assigned',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Total returns in the system, as the page reports it. Monotonically non-decreasing for the whole
 * run, and read from ONE render, so it is a consistent snapshot.
 */
function totalReturns(values: Record<ReportKpi, number>): number {
  return STATUS_KPIS.reduce((sum, kpi) => sum + values[kpi], 0);
}

/** Re-render, then read all 9 tiles from that one render. */
async function readTiles(reports: ReportsPage): Promise<Record<ReportKpi, number>> {
  await reports.reopen();
  return reports.kpiValues();
}

/**
 * The count a report table shows for one label, or 0 when the label has no row — the reports group
 * only over existing rows, so "no row" and "zero" are the same statement.
 */
async function countFor(
  reports: ReportsPage,
  table: ReportTableName,
  label: string,
): Promise<number> {
  const row = (await reports.tableData(table)).find(([rowLabel]) => rowLabel === label);
  if (!row) return 0;
  const count = Number(row[1]);
  expect(Number.isInteger(count), `report-${table} count for "${label}" is an integer`).toBe(true);
  return count;
}

/** All four report tables, as a mutable copy for `toEqual` against `presentTables()`. */
const ALL_TABLES: ReportTableName[] = [...REPORT_TABLES];

test.describe('Reports & KPIs — Journey 8', () => {
  // -------------------------------------------------------------------------
  // R1 — the 9 tiles
  // -------------------------------------------------------------------------

  test('renders exactly 9 KPI tiles, each on its labelled card with a numeric value', async ({
    managerPage,
  }) => {
    const reports = new ReportsPage(managerPage);
    await reports.open();

    await expect(reports.statusOverview).toBeVisible();
    await expect(reports.kpiGrid).toBeVisible();

    // 9 cards, every `kpi-*` testid present and rendering a bare integer.
    await reports.expectAllKpisNumeric();

    // …and each testid is on the card carrying the matching label, so a copy/pasted hook that
    // landed on the wrong tile fails here rather than silently skewing every delta below.
    for (const kpi of REPORT_KPIS) {
      const card = reports.kpiCard(kpi);
      await expect(card, `exactly one card owns the kpi-${kpi} hook`).toHaveCount(1);
      await expect(card, `kpi-${kpi} sits on the "${KPI_LABEL[kpi]}" card`).toContainText(
        KPI_LABEL[kpi],
      );
    }
  });

  test('adds the Inspected tile that the dashboard deliberately omits', async ({ managerPage }) => {
    // docs/screens.md: the dashboard shows 8 cards, "no Inspected tile — that KPI appears on
    // Reports only". Both screens share the `kpi-*` naming, so the count is the discriminator.
    const dashboard = new DashboardPage(managerPage);
    await dashboard.open();
    await dashboard.expectAllKpisNumeric(); // asserts exactly 8 cards

    const reports = new ReportsPage(managerPage);
    await reports.open();
    await expect(reports.kpiCards).toHaveCount(9);
    await expect(reports.kpi('inspected')).toBeVisible();
    await expect(reports.kpi('inspected')).toHaveText(/^\d+$/);
  });

  // -------------------------------------------------------------------------
  // R3 — deltas
  // -------------------------------------------------------------------------

  test('total across the 8 status tiles grows when a return is created', async ({
    managerPage,
    data,
  }) => {
    const reports = new ReportsPage(managerPage);

    const before = await readTiles(reports);

    const created = await data.makeReturn('OPEN');

    const after = await readTiles(reports);

    // `>=` not `===`: sibling workers create returns concurrently. The total is monotone, so the
    // only thing that can go wrong is it failing to grow — which is exactly the regression.
    expect(
      totalReturns(after),
      'creating a return must raise the total across the 8 status tiles',
    ).toBeGreaterThanOrEqual(totalReturns(before) + 1);

    // The return this test owns is OPEN and has no barcode yet, so both of those tiles must be
    // able to account for it. (Absolute values stay unasserted — only "at least mine".)
    expect(after.open, 'the OPEN tile must count at least this test\'s return').toBeGreaterThanOrEqual(1);
    expect(
      after['no-barcode'],
      'a freshly created return has no barcode, so the No Barcode tile must count it',
    ).toBeGreaterThanOrEqual(1);

    // Premise guard for the No Barcode assertion above.
    expect(created.barcode, 'makeReturn("OPEN") must not assign a barcode').toBeNull();
  });

  test('every status tile counts at least the return this test parks in that status', async ({
    managerPage,
    api,
    data,
  }) => {
    // One return per status, all owned by this worker. Nothing else can move them, so after this
    // point each of the 8 tiles has a guaranteed floor of 1 no matter what the other workers do.
    const seeded = await data.makeReturnPerStatus(RETURN_STATUSES);

    // Premise guard — assert through the API that each return really reached its target status
    // before blaming the tiles for a wrong number.
    for (const status of RETURN_STATUSES) {
      const owned = seeded[status];
      expect(owned, `makeReturnPerStatus produced a return for ${status}`).toBeTruthy();
      expect(await api.statusOf(owned.id), `return ${owned.id} sits in ${status}`).toBe(status);
    }

    const reports = new ReportsPage(managerPage);
    const values = await readTiles(reports);

    for (const status of RETURN_STATUSES) {
      const kpi = KPI_FOR_STATUS[status];
      expect(
        values[kpi],
        `the "${KPI_LABEL[kpi]}" tile must count return ${seeded[status].id} (${status})`,
      ).toBeGreaterThanOrEqual(1);
    }

    expect(
      totalReturns(values),
      'the 8 returns this test created must all be represented in the status tiles',
    ).toBeGreaterThanOrEqual(RETURN_STATUSES.length);
  });

  // -------------------------------------------------------------------------
  // R4 — the tiles agree with the API oracle
  // -------------------------------------------------------------------------

  test('the Closed tile tracks api.dashboard() and only ever grows', async ({
    managerPage,
    api,
    data,
  }) => {
    const reports = new ReportsPage(managerPage);

    // CLOSED is terminal in ALLOWED_TRANSITIONS, so its count never decreases. That turns the
    // read-order below into a rigorous sandwich instead of a race:
    //
    //   page(t0)  <=  api(t1)  <   api(t2)  <=  page(t3)
    //
    // Every step is an inequality that holds no matter how many returns other workers close in
    // between — and it still fails loudly if the tile stops reflecting the API at all.
    await reports.reopen();
    const pageBefore = await reports.kpiValue('closed'); // t0
    const apiBefore = await api.statusCount('CLOSED'); // t1

    expect(
      pageBefore,
      'the Closed tile cannot exceed an API read taken after the page rendered',
    ).toBeLessThanOrEqual(apiBefore);

    const closed = await data.makeReturn('CLOSED');
    expect(await api.statusOf(closed.id)).toBe('CLOSED');

    const apiAfter = await api.statusCount('CLOSED'); // t2
    expect(apiAfter, 'closing a return must raise the API CLOSED count').toBeGreaterThanOrEqual(
      apiBefore + 1,
    );

    const pageAfter = await readTiles(reports); // t3

    expect(
      pageAfter.closed,
      'the Closed tile must be at least the API count read before the page rendered',
    ).toBeGreaterThanOrEqual(apiAfter);
    expect(
      pageAfter.closed,
      'closing a return must raise the Closed tile',
    ).toBeGreaterThanOrEqual(pageBefore + 1);
  });

  // -------------------------------------------------------------------------
  // R2 — the four report tables
  // -------------------------------------------------------------------------

  test('all four report panels render, and a rendered panel is never empty', async ({
    managerPage,
    data,
  }) => {
    const driver = SEED_DRIVERS[0]; // Bob Levi — makeReturn's default driver

    // Guarantee every one of the four reports has data attributable to this test:
    //   top-return-reasons  <- a reason string nothing else in the run can produce
    //   returns-by-driver   <- joined through driver 1
    //   returns-by-customer <- this worker's claimed customer
    //   monthly-volume      <- any return at all (grouped on createdAt)
    const reason = data.uniqueName('reason');
    const created = await data.makeReturn('OPEN', { driverId: driver.id, reason });

    const reports = new ReportsPage(managerPage);
    await reports.reopen();

    expect(
      await reports.presentTables(),
      'with data behind all four reports, all four panels must render',
    ).toEqual(ALL_TABLES);

    // `rendered="#{not empty …}"` means presence and non-emptiness are the same condition: a panel
    // that rendered must carry rows, and an empty report must not render a panel at all.
    for (const name of REPORT_TABLES) {
      const present = await reports.tableIsPresent(name);
      const rows = await reports.tableRowCount(name);
      expect(present, `report-${name} panel rendered`).toBe(true);
      expect(rows, `report-${name} rendered, so it must have rows`).toBeGreaterThan(0);
      expect(
        present,
        `report-${name}: a rendered panel and a non-empty table are the same condition`,
      ).toBe(rows > 0);
    }

    // Top Return Reasons — the reason is a fresh uuid-backed string, so its row is exactly ours and
    // its count is exactly 1 even under --workers=4.
    const reasons = await reports.tableData('top-return-reasons');
    expect(
      reasons,
      `Top Return Reasons must contain this test's return (${created.id}) as its own row`,
    ).toContainEqual([reason, '1']);

    // Returns by Driver / by Customer — presence of the label only. The counts aggregate every
    // worker's returns, so no number is asserted.
    const driverLabels = (await reports.tableData('returns-by-driver')).map(([label]) => label);
    expect(driverLabels, 'the assigned driver must appear in Returns by Driver').toContain(
      driver.name,
    );

    const customerLabels = (await reports.tableData('returns-by-customer')).map(([label]) => label);
    expect(
      customerLabels,
      'the return\'s customer must appear in Returns by Customer',
    ).toContain(data.customer.fullName);

    // Monthly Volume — `yyyy-MM` buckets with a numeric count each. The current month is not
    // asserted by name: `createdAt` is stamped by the server, whose clock/zone is not the runner's.
    const monthly = await reports.tableData('monthly-volume');
    expect(monthly.length).toBeGreaterThan(0);
    for (const [month, count] of monthly) {
      expect(month, 'Monthly Volume buckets are yyyy-MM').toMatch(/^\d{4}-\d{2}$/);
      expect(count, 'Monthly Volume counts are integers').toMatch(/^\d+$/);
    }

    // Every report table is two columns; a stray third column would silently break tableData().
    for (const name of REPORT_TABLES) {
      for (const row of await reports.tableData(name)) {
        expect(row, `report-${name} rows are [label, count] pairs`).toHaveLength(2);
        expect(row[1], `report-${name} count column is an integer`).toMatch(/^\d+$/);
      }
    }
  });

  test('Returns by Customer grows by exactly one for the worker-owned customer', async (
    { managerPage, api, data },
    testInfo,
  ) => {
    // The one place in this spec where an EXACT delta is safe, and it is worth having: the
    // by-customer report is keyed on `c.fullName`, and `data.customer` is this worker's
    // exclusively-claimed seeded customer (fixture contract: customer id = workerIndex % 20 + 1,
    // so no two workers share one). A Playwright worker runs a single test at a time, therefore
    // between the two reads below nobody can add a return for this customer except this test.
    // Admin-created rows cannot collide either — those all carry the `e2e-` name prefix.
    //
    // The exclusivity only holds while `workers <= SEED_CUSTOMER_COUNT`; past 20 the modulo wraps
    // and two workers share a customer, which would make the delta legitimately > 1. The plan's
    // target is `--workers=4`; above the wrap point this test states why it cannot run rather than
    // quietly weakening into an inequality.
    test.skip(
      testInfo.config.workers > SEED_CUSTOMER_COUNT,
      `exact per-customer deltas need workers <= ${SEED_CUSTOMER_COUNT} (claimCustomer wraps at 20)`,
    );

    const customer = data.customer;
    const reports = new ReportsPage(managerPage);

    await reports.reopen();
    const before = await countFor(reports, 'returns-by-customer', customer.fullName);

    const created = await data.makeReturn('OPEN', { customerId: customer.id });
    expect((await api.getReturn(created.id)).customerId).toBe(customer.id);

    await reports.reopen(); // cache-busted re-render
    const after = await countFor(reports, 'returns-by-customer', customer.fullName);

    expect(
      after,
      `Returns by Customer must count return ${created.id} against "${customer.fullName}"`,
    ).toBe(before + 1);
  });
});
