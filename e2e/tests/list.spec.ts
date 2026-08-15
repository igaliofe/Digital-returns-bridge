/**
 * Journey 4 — Return Requests list (`/returns/list.xhtml`, Figma 20:78).
 *
 * What this spec proves: every filter on the filter card NARROWS the table, the
 * sortable headers re-order it, the paginator pages it, and a row's View link
 * opens that exact return.
 *
 * Parallel-safety rules this file obeys (see the plan's "Test data strategy"):
 *   - Never asserts an absolute row count that depends on how much data exists.
 *     The only fixed numbers asserted are page SIZES (20 / 10), which are a
 *     property of the paginator, not of the data — the seed alone ships 45
 *     return requests, so page one is always full.
 *   - Never touches the seeded `RET-100xx` rows; every row it asserts on is
 *     provisioned through `data.makeReturn()` inside the test that uses it.
 *   - Scopes each filter assertion to rows this test owns, using either a
 *     worker-unique barcode "group token" or a freshly created customer, so a
 *     concurrent worker's returns can never land on the asserted page.
 *
 * The barcode group token trick: `data.nextBarcode()` hands out a globally
 * unique `RET-E2E-<6 digits>` string. Consuming one as a *prefix* and appending
 * a suffix yields sibling barcodes that (a) are still unique and (b) share a
 * substring nothing else in the database contains — and `filterBarcode` is a
 * `contains` match server-side (`ReturnListBean.load`). Filtering on the token
 * therefore reduces the table to exactly this test's rows.
 */

import {
  test,
  expect,
  RETURN_STATUSES,
  SEED_DRIVER_ONE,
  SEED_DRIVER_TWO,
} from '../fixtures';
import {
  DRIVER_FILTER_ALL,
  ReturnDetailsPage,
  ReturnsListPage,
  STATUS_FILTER_ALL,
  STATUS_LABEL,
} from '../pages';

const DRIVER_ONE = SEED_DRIVER_ONE; // { id: 1, name: 'Bob Levi' }
const DRIVER_TWO = SEED_DRIVER_TWO; // { id: 2, name: 'Dana Avraham' }

/** Ids as an order-independent set, so display order never makes a set check flaky. */
function asSet(ids: readonly number[]): number[] {
  return [...ids].sort((a, b) => a - b);
}

test.describe('Returns list — Journey 4', () => {
  test('lists return requests with the filter card and a status chip on every row', async ({
    repPage,
    data,
  }) => {
    const seeded = await data.makeReturn('PICKED_UP');

    const list = new ReturnsListPage(repPage);
    await list.open();

    await expect(list.filterCard).toBeVisible();
    await expect(list.statusFilter).toBeVisible();
    await expect(list.driverFilter).toBeVisible();
    await expect(list.customerFilter).toBeVisible();
    await expect(list.barcodeFilter).toBeVisible();
    await expect(list.noBarcodeFilter).toBeVisible();
    await expect(list.applyFilters).toBeEnabled();

    // Unfiltered, the filters start neutral.
    expect(await list.selectedStatus()).toBe(STATUS_FILTER_ALL);
    expect(await list.selectedDriver()).toBe(DRIVER_FILTER_ALL);

    // Narrow to the row this test owns and check the columns it must render.
    await list.filterBy({ barcode: seeded.barcode! });
    expect(await list.ids()).toEqual([seeded.id]);

    await expect(list.cell(seeded.id, 'id')).toHaveText(String(seeded.id));
    await expect(list.cell(seeded.id, 'barcode')).toHaveText(seeded.barcode!);
    await expect(list.cell(seeded.id, 'customer')).toHaveText(data.customer.fullName);
    await expect(list.cell(seeded.id, 'driver')).toHaveText(DRIVER_ONE.name);
    await expect(list.cell(seeded.id, 'priority')).toHaveText('MEDIUM');
    await expect(list.statusBadge(seeded.id)).toHaveText(STATUS_LABEL.PICKED_UP);
    await expect(list.viewLink(seeded.id)).toBeVisible();

    // One chip per data row — the Status column is never blank.
    expect(await list.statusBadges.count()).toBe(await list.rowCount());
  });

  test('status filter narrows the table to returns in the selected status', async ({
    repPage,
    data,
    api,
  }) => {
    const group = data.nextBarcode();
    const [assigned, picked] = await Promise.all([
      data.makeReturn('BARCODE_ASSIGNED', { barcode: `${group}-BA` }),
      data.makeReturn('PICKED_UP', { barcode: `${group}-PU` }),
    ]);

    // Oracle: the two rows really are in different statuses before the UI is asked.
    expect(await api.statusOf(assigned.id)).toBe('BARCODE_ASSIGNED');
    expect(await api.statusOf(picked.id)).toBe('PICKED_UP');

    const list = new ReturnsListPage(repPage);
    await list.open();

    await list.filterBy({ barcode: group });
    expect(asSet(await list.ids())).toEqual(asSet([assigned.id, picked.id]));

    await list.filterBy({ status: 'BARCODE_ASSIGNED' });
    expect(await list.ids()).toEqual([assigned.id]);
    await expect(list.statusBadge(assigned.id)).toHaveText(STATUS_LABEL.BARCODE_ASSIGNED);
    await list.expectDoesNotContainId(picked.id);

    await list.filterBy({ status: 'PICKED_UP' });
    expect(await list.ids()).toEqual([picked.id]);
    await expect(list.statusBadge(picked.id)).toHaveText(STATUS_LABEL.PICKED_UP);
    await list.expectDoesNotContainId(assigned.id);

    // Widening back to "— All Statuses —" restores both rows.
    await list.filterBy({ status: null });
    expect(asSet(await list.ids())).toEqual(asSet([assigned.id, picked.id]));
  });

  test('status chips render the domain label for every return status', async ({
    repPage,
    data,
    api,
  }) => {
    // A brand-new customer keeps the customer-search filter exclusive to this
    // test, which is the only way to get a no-barcode status (OPEN,
    // WAITING_FOR_PICKUP, NEEDS_MORE_INFO) onto a page we can assert on.
    const customer = await api.createCustomer({
      fullName: data.uniqueName('status-chips'),
      phone: data.nextPhone(),
    });

    const perStatus = await Promise.all(
      RETURN_STATUSES.map(async (status) => ({
        status,
        seeded: await data.makeReturn(status, { customerId: customer.id }),
      })),
    );

    const list = new ReturnsListPage(repPage);
    await list.open();
    await list.filterBy({ customerQuery: customer.phone });

    expect(asSet(await list.ids())).toEqual(asSet(perStatus.map((r) => r.seeded.id)));

    for (const { status, seeded } of perStatus) {
      await expect(list.statusBadge(seeded.id)).toHaveText(STATUS_LABEL[status]);
      await expect(list.cell(seeded.id, 'customer')).toHaveText(customer.fullName);
    }
  });

  test('driver filter narrows the table to the selected driver', async ({ repPage, data, api }) => {
    const group = data.nextBarcode();
    const [byBob, byDana] = await Promise.all([
      data.makeReturn('BARCODE_ASSIGNED', { driverId: DRIVER_ONE.id, barcode: `${group}-D1` }),
      data.makeReturn('BARCODE_ASSIGNED', { driverId: DRIVER_TWO.id, barcode: `${group}-D2` }),
    ]);

    expect((await api.getReturn(byBob.id)).driverId).toBe(DRIVER_ONE.id);
    expect((await api.getReturn(byDana.id)).driverId).toBe(DRIVER_TWO.id);

    const list = new ReturnsListPage(repPage);
    await list.open();

    await list.filterBy({ barcode: group });
    expect(asSet(await list.ids())).toEqual(asSet([byBob.id, byDana.id]));

    await list.filterBy({ driverName: DRIVER_ONE.name });
    expect(await list.ids()).toEqual([byBob.id]);
    await expect(list.cell(byBob.id, 'driver')).toHaveText(DRIVER_ONE.name);
    await list.expectDoesNotContainId(byDana.id);

    await list.filterBy({ driverName: DRIVER_TWO.name });
    expect(await list.ids()).toEqual([byDana.id]);
    await expect(list.cell(byDana.id, 'driver')).toHaveText(DRIVER_TWO.name);
    await list.expectDoesNotContainId(byBob.id);

    await list.filterBy({ driverName: null });
    expect(asSet(await list.ids())).toEqual(asSet([byBob.id, byDana.id]));
  });

  test('customer search filter narrows the table by phone and by name', async ({
    repPage,
    data,
    api,
  }) => {
    const [wanted, other] = await Promise.all([
      api.createCustomer({ fullName: data.uniqueName('wanted'), phone: data.nextPhone() }),
      api.createCustomer({ fullName: data.uniqueName('other'), phone: data.nextPhone() }),
    ]);

    const group = data.nextBarcode();
    const [wantedReturn, otherReturn] = await Promise.all([
      data.makeReturn('BARCODE_ASSIGNED', { customerId: wanted.id, barcode: `${group}-W` }),
      data.makeReturn('BARCODE_ASSIGNED', { customerId: other.id, barcode: `${group}-O` }),
    ]);

    const list = new ReturnsListPage(repPage);
    await list.open();

    await list.filterBy({ barcode: group });
    expect(asSet(await list.ids())).toEqual(asSet([wantedReturn.id, otherReturn.id]));

    // Phone match.
    await list.filterBy({ customerQuery: wanted.phone });
    expect(await list.ids()).toEqual([wantedReturn.id]);
    await expect(list.cell(wantedReturn.id, 'customer')).toHaveText(wanted.fullName);
    await list.expectDoesNotContainId(otherReturn.id);

    // Name match — same filter field, matched case-insensitively against the name.
    await list.filterBy({ customerQuery: wanted.fullName.toUpperCase() });
    expect(await list.ids()).toEqual([wantedReturn.id]);
    await list.expectDoesNotContainId(otherReturn.id);

    // Clearing the query widens back to both rows of the group.
    await list.filterBy({ customerQuery: '' });
    expect(asSet(await list.ids())).toEqual(asSet([wantedReturn.id, otherReturn.id]));
  });

  test('barcode filter narrows the table to the matching barcode', async ({ repPage, data }) => {
    const group = data.nextBarcode();
    const [first, second] = await Promise.all([
      data.makeReturn('BARCODE_ASSIGNED', { barcode: `${group}-ONE` }),
      data.makeReturn('BARCODE_ASSIGNED', { barcode: `${group}-TWO` }),
    ]);

    const list = new ReturnsListPage(repPage);
    await list.open();

    // Partial match keeps both siblings.
    await list.filterBy({ barcode: group });
    expect(asSet(await list.ids())).toEqual(asSet([first.id, second.id]));

    // Exact match keeps exactly one — barcodes are unique (schema.sql: UNIQUE).
    await list.filterBy({ barcode: first.barcode! });
    expect(await list.ids()).toEqual([first.id]);
    await expect(list.cell(first.id, 'barcode')).toHaveText(first.barcode!);
    await list.expectDoesNotContainId(second.id);

    await list.filterBy({ barcode: second.barcode! });
    expect(await list.ids()).toEqual([second.id]);
    await expect(list.cell(second.id, 'barcode')).toHaveText(second.barcode!);
    await list.expectDoesNotContainId(first.id);
  });

  test('barcode filter that matches nothing renders the empty message', async ({
    repPage,
    data,
  }) => {
    const missing = `${data.nextBarcode()}-NO-SUCH-ROW`;

    const list = new ReturnsListPage(repPage);
    await list.open();
    await list.filterBy({ barcode: missing });

    expect(await list.rowCount()).toBe(0);
    expect(await list.isEmpty()).toBe(true);
    await expect(list.emptyMessage).toContainText('No return requests found.');
  });

  test('no-barcode toggle narrows the table to returns without a barcode', async ({
    repPage,
    data,
    api,
  }) => {
    const customer = await api.createCustomer({
      fullName: data.uniqueName('no-barcode'),
      phone: data.nextPhone(),
    });

    // OPEN never reaches assign-barcode, so this row's barcode stays NULL.
    const [withoutBarcode, withBarcode] = await Promise.all([
      data.makeReturn('OPEN', { customerId: customer.id, driverId: null }),
      data.makeReturn('BARCODE_ASSIGNED', { customerId: customer.id }),
    ]);

    expect(await api.barcodeOf(withoutBarcode.id)).toBeNull();
    expect(await api.barcodeOf(withBarcode.id)).toBe(withBarcode.barcode);

    const list = new ReturnsListPage(repPage);
    await list.open();

    await list.filterBy({ customerQuery: customer.phone });
    expect(asSet(await list.ids())).toEqual(asSet([withoutBarcode.id, withBarcode.id]));
    await expect(list.cell(withoutBarcode.id, 'barcode')).toHaveText('Not assigned');

    await list.filterBy({ noBarcodeOnly: true });
    expect(await list.ids()).toEqual([withoutBarcode.id]);
    await list.expectDoesNotContainId(withBarcode.id);

    await list.filterBy({ noBarcodeOnly: false });
    expect(asSet(await list.ids())).toEqual(asSet([withoutBarcode.id, withBarcode.id]));
  });

  test.fixme('status and driver filters compose instead of overriding each other', async ({
    repPage,
    data,
  }) => {
    // NEW FINDING (not one of the 5 in docs/e2e-findings.md yet — please add it):
    // ReturnListBean.load() picks the base query with an if/else chain —
    //   if (filterStatus) findByStatus(...) else if (filterDriverId) findByDriverId(...) else findAll()
    // — so selecting a Status silently DISCARDS the Driver selection. The screen
    // shows both dropdowns as independent filters, so they must intersect.
    // See server/src/main/java/com/drb/server/web/ReturnListBean.java:41-48.
    const group = data.nextBarcode();
    const [bobPicked, danaPicked] = await Promise.all([
      data.makeReturn('PICKED_UP', { driverId: DRIVER_ONE.id, barcode: `${group}-B` }),
      data.makeReturn('PICKED_UP', { driverId: DRIVER_TWO.id, barcode: `${group}-D` }),
    ]);

    const list = new ReturnsListPage(repPage);
    await list.open();

    await list.filterBy({ barcode: group });
    expect(asSet(await list.ids())).toEqual(asSet([bobPicked.id, danaPicked.id]));

    // Both filters applied together must intersect, not override.
    await list.filterBy({ status: 'PICKED_UP', driverName: DRIVER_TWO.name });
    expect(await list.ids()).toEqual([danaPicked.id]);
    await list.expectDoesNotContainId(bobPicked.id);
  });

  test('sorting by ID toggles ascending and descending order', async ({ repPage, data }) => {
    const group = data.nextBarcode();
    const seeded = await Promise.all([
      data.makeReturn('BARCODE_ASSIGNED', { barcode: `${group}-S1` }),
      data.makeReturn('BARCODE_ASSIGNED', { barcode: `${group}-S2` }),
      data.makeReturn('BARCODE_ASSIGNED', { barcode: `${group}-S3` }),
    ]);
    const owned = asSet(seeded.map((r) => r.id));

    const list = new ReturnsListPage(repPage);
    await list.open();
    await list.filterBy({ barcode: group });
    expect(asSet(await list.ids())).toEqual(owned);

    await list.sortBy('ID');
    const ascending = await list.ids();
    expect(ascending).toEqual(owned);

    await list.sortBy('ID');
    const descending = await list.ids();
    expect(descending).toEqual([...owned].reverse());

    // Sorting re-orders, it never adds or drops rows.
    expect(asSet(descending)).toEqual(owned);
  });

  test('sorting by Barcode orders the rows lexicographically', async ({ repPage, data }) => {
    const group = data.nextBarcode();
    // Created out of alphabetical order on purpose, so ascending order cannot
    // accidentally coincide with insertion order.
    const seeded = await Promise.all([
      data.makeReturn('BARCODE_ASSIGNED', { barcode: `${group}-C` }),
      data.makeReturn('BARCODE_ASSIGNED', { barcode: `${group}-A` }),
      data.makeReturn('BARCODE_ASSIGNED', { barcode: `${group}-B` }),
    ]);
    const byBarcode = [...seeded].sort((a, b) => a.barcode!.localeCompare(b.barcode!));

    const list = new ReturnsListPage(repPage);
    await list.open();
    await list.filterBy({ barcode: group });

    await list.sortBy('Barcode');
    expect(await list.barcodes()).toEqual(byBarcode.map((r) => r.barcode));
    expect(await list.ids()).toEqual(byBarcode.map((r) => r.id));

    await list.sortBy('Barcode');
    expect(await list.barcodes()).toEqual(byBarcode.map((r) => r.barcode).reverse());
  });

  test('paginator splits the unfiltered table into pages of 20', async ({ repPage, data }) => {
    // The seed alone ships 45 return requests, so an unfiltered list always
    // overflows the default 20-row page. Nothing here depends on the exact total.
    await data.makeReturn('OPEN');

    const list = new ReturnsListPage(repPage);
    await list.open();

    await expect(list.paginator).toBeVisible();
    expect(await list.rowCount()).toBe(20);
    expect(await list.pageCount()).toBeGreaterThanOrEqual(2);
    expect(await list.currentPage()).toBe(1);

    const firstPageIds = await list.ids();

    await list.goToPage(2);
    expect(await list.currentPage()).toBe(2);

    const secondPageIds = await list.ids();
    expect(secondPageIds.length).toBeGreaterThan(0);
    // A return appears on exactly one page.
    expect(secondPageIds.filter((id) => firstPageIds.includes(id))).toEqual([]);

    await list.goToPage(1);
    expect(await list.currentPage()).toBe(1);
    expect(await list.ids()).toEqual(firstPageIds);
  });

  test('rows-per-page dropdown resizes the page', async ({ repPage, data }) => {
    await data.makeReturn('OPEN');

    const list = new ReturnsListPage(repPage);
    await list.open();
    expect(await list.rowCount()).toBe(20);

    await list.setRowsPerPage(10);
    expect(await list.rowCount()).toBe(10);

    await list.setRowsPerPage(50);
    // 45 seeded rows + whatever the run created: more than a 20-row page, and
    // never more than the 50 the dropdown asked for.
    const widened = await list.rowCount();
    expect(widened).toBeGreaterThan(20);
    expect(widened).toBeLessThanOrEqual(50);
  });

  test("View opens the details screen for that row's return", async ({ repPage, data }) => {
    const seeded = await data.makeReturn('ARRIVED_TO_WAREHOUSE');

    const list = new ReturnsListPage(repPage);
    await list.open();
    await list.filterBy({ barcode: seeded.barcode! });
    expect(await list.ids()).toEqual([seeded.id]);

    await list.openDetails(seeded.id);

    const details = new ReturnDetailsPage(repPage);
    await details.expectLoaded();
    await details.expectHeaderId(seeded.id);
    expect(details.currentId()).toBe(seeded.id);
    expect(await details.barcodeText()).toBe(seeded.barcode);
    expect(await details.statusLabel()).toBe(STATUS_LABEL.ARRIVED_TO_WAREHOUSE);

    // Back to the list — the filter is gone (the bean is @ViewScoped, so a fresh
    // view means fresh, empty filters) but the row is still reachable.
    await details.backToListAndWait();
    await list.expectLoaded();
    expect(await list.selectedStatus()).toBe(STATUS_FILTER_ALL);
  });
});
