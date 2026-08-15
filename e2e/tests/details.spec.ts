/**
 * Journey 5 — Return Details (`/returns/details.xhtml?id=N`, Figma 26:136).
 *
 * What this spec proves: the digital return file renders every section the screen
 * doc promises — header + status chip, the Return Information card (catalog image
 * and field grid), the Barcode / Pickup card, the image gallery and the status
 * timeline — for a return in each of the 8 `ReturnStatus` values, and that the
 * screen degrades to a warning (never a server error) for an id it cannot resolve.
 *
 * Parallel-safety rules this file obeys (see the plan's "Test data strategy"):
 *   - Every return it asserts on is provisioned inside the test through
 *     `data.makeReturn()`, which is worker-namespaced. The seeded `RET-100xx`
 *     rows are never read and never mutated.
 *   - No absolute counts. The only fixed number asserted is `IMAGE_TYPES.length`,
 *     which is a property of the enum and of the images THIS test uploaded to a
 *     return THIS test created.
 *   - The details screen is read-only, so nothing here mutates shared state; the
 *     shared per-role worker session (`managerPage`) is therefore safe to use.
 *
 * Oracles come from `api` (MANAGER-authenticated). `api.fullName` is the user that
 * `data.makeReturn()` acted as, which is what the screen must show under
 * "Opened By" and in the timeline's "Changed By" column.
 */

import type { Page } from '@playwright/test';
import {
  test,
  expect,
  IMAGE_TYPES,
  RETURN_STATUSES,
  ROLES,
  SEED_DRIVER_ONE,
  type DataFactory,
  type DrbApi,
  type ReturnStatus,
} from '../fixtures';
import {
  ReturnDetailsPage,
  ReturnsListPage,
  STATUS_CHIP_CLASS,
  STATUS_LABEL,
} from '../pages';

/**
 * Statuses a return can hold while `barcode` is still null — the two the driver
 * has not reached yet. `NEEDS_MORE_INFO` is provisioned through the warehouse
 * route (`needsMoreInfoVia: 'WAREHOUSE'`), which is the flow the screens doc
 * describes, so it carries a barcode like every post-pickup status.
 */
const BARCODE_LESS: ReadonlySet<ReturnStatus> = new Set<ReturnStatus>([
  'OPEN',
  'WAITING_FOR_PICKUP',
]);

/** `dd/MM/yyyy HH:mm` — the `f:convertDateTime` pattern used across the screen. */
const DATE_TIME = /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/;

/**
 * The whole-screen assertion, shared by the eight per-status tests: header,
 * status chip, catalog image, every field of the information grid, the barcode
 * card, the timeline's presence, and the Back to List control.
 */
async function expectReturnFileRenders(args: {
  page: Page;
  api: DrbApi;
  data: DataFactory;
  status: ReturnStatus;
}): Promise<void> {
  const { page, api, data, status } = args;

  const seeded =
    status === 'NEEDS_MORE_INFO'
      ? await data.makeReturn(status, { needsMoreInfoVia: 'WAREHOUSE' })
      : await data.makeReturn(status);
  const dto = await api.getReturn(seeded.id);
  expect(dto.status, 'fixture reached the requested status').toBe(status);

  const details = new ReturnDetailsPage(page);
  await details.openId(seeded.id);

  // --- header ---------------------------------------------------------------
  await details.expectHeaderId(seeded.id);
  expect(await details.statusLabel()).toBe(STATUS_LABEL[status]);
  expect(await details.statusChipClass()).toContain(STATUS_CHIP_CLASS[status]);

  // --- Return Information ---------------------------------------------------
  await expect(details.infoCard).toBeVisible();
  expect(await details.fieldText('Customer')).toBe(dto.customerName);
  expect(await details.fieldText('Phone')).toBe(dto.customerPhone);
  expect(await details.fieldText('Product')).toBe(dto.productName);
  expect(await details.fieldText('SKU')).toBe(dto.productSku);
  expect(await details.fieldText('Order Number')).toBe(dto.orderNumber);
  expect(await details.fieldText('Priority')).toBe(dto.priority);
  expect(await details.fieldText('Opened By')).toBe(api.fullName);
  expect(await details.fieldText('Created At')).toMatch(DATE_TIME);
  expect(await details.fieldText('Reason')).toBe(dto.reason);
  expect(await details.fieldText('Defect Description')).toBe(dto.defectDescription);

  // Catalog image: `p:graphicImage` renders only when the product has an imageUrl.
  if (dto.productImageUrl) {
    await expect(details.catalogImage).toBeVisible();
    const src = await details.catalogImage.getAttribute('src');
    expect(src ?? '').toContain(dto.productImageUrl);
  } else {
    expect(await details.catalogImage.count()).toBe(0);
  }

  // --- Barcode / Pickup -----------------------------------------------------
  await expect(details.barcodeBlock).toBeVisible();
  if (seeded.barcode === null) {
    // Nothing has been assigned yet: the card warns and every value falls back.
    expect(await details.hasBarcodeWarning(), 'barcode-not-assigned warning').toBe(true);
    expect(await details.barcodeText()).toBe('—');
    expect((await details.barcodeField('Assigned At').innerText()).trim()).toBe('—');
    expect((await details.barcodeField('Assigned By Driver').innerText()).trim()).toBe('—');
  } else {
    expect(await details.hasBarcodeWarning(), 'no warning once a barcode exists').toBe(false);
    expect(await details.barcodeText()).toBe(seeded.barcode);
    expect((await details.barcodeField('Assigned At').innerText()).trim()).toMatch(DATE_TIME);
    expect((await details.barcodeField('Assigned By Driver').innerText()).trim()).toBe(
      SEED_DRIVER_ONE.name,
    );
    expect((await details.barcodeField('Assigned Driver').innerText()).trim()).toBe(
      SEED_DRIVER_ONE.name,
    );
  }

  // --- conditional sections -------------------------------------------------
  // Both cards are wrapped in `rendered="#{not empty ...}"`: they must be ABSENT,
  // not empty, when there is nothing to show. A brand-new OPEN return has no
  // status history at all (creation writes no StatusHistory row).
  const trail = await api.statusTrail(seeded.id);
  expect(await details.hasStatusTimeline()).toBe(trail.length > 0);
  if (trail.length > 0) {
    expect(await details.timelineRowCount()).toBe(trail.length);
  }
  expect(await details.hasImageGallery(), 'no images were uploaded to this return').toBe(false);

  await expect(details.backToList).toBeVisible();
}

test.describe('Return details — Journey 5', () => {
  // -------------------------------------------------------------------------
  // Every status renders the full file
  // -------------------------------------------------------------------------

  for (const status of RETURN_STATUSES) {
    const title = `renders the full return file for a ${status} return`;

    if (BARCODE_LESS.has(status)) {
      test.fixme(title, async ({ managerPage, api, data }) => {
        // GAP 6 — `returns/details.xhtml:103` uses `<p:message severity="warn"
        // summary="Barcode not assigned" detail="..."/>` with no `for`. PrimeFaces
        // `p:message` has no summary/detail attributes: it renders queued
        // FacesMessages for the component `for` resolves to, and with a blank `for`
        // `SearchExpressionFacade.resolveComponent` returns null, so MessageRenderer
        // NPEs on `getClientId`. Every barcode-less return (OPEN, WAITING_FOR_PICKUP)
        // therefore fails to render the whole page instead of showing the warning.
        // Same root cause as the not-found message on line 16.
        // See docs/e2e-findings.md.
        await expectReturnFileRenders({ page: managerPage, api, data, status });
      });
    } else {
      test(title, async ({ managerPage, api, data }) => {
        await expectReturnFileRenders({ page: managerPage, api, data, status });
      });
    }
  }

  // -------------------------------------------------------------------------
  // Image gallery
  // -------------------------------------------------------------------------

  test('image gallery renders a thumbnail for every ImageType', async ({
    managerPage,
    api,
    data,
  }) => {
    test.slow(); // eight sequential Cloudinary uploads before the page is opened.

    const seeded = await data.makeReturn('BARCODE_ASSIGNED');
    for (const imageType of IMAGE_TYPES) {
      await api.uploadImage(seeded.id, imageType);
    }
    await api.expectImageType(seeded.id, IMAGE_TYPES[IMAGE_TYPES.length - 1]);

    const images = await api.getImages(seeded.id);
    expect(
      [...images.map((i) => i.imageType)].sort(),
      'every ImageType is attached to the return',
    ).toEqual([...IMAGE_TYPES].sort());

    const details = new ReturnDetailsPage(managerPage);
    await details.openId(seeded.id);

    expect(await details.hasImageGallery()).toBe(true);
    expect(await details.imageCount()).toBe(IMAGE_TYPES.length);

    // The gallery renders one `p:graphicImage` per image, in no guaranteed order —
    // assert the set, and that each stored URL is rendered exactly once.
    const rendered = await details.imageSources();
    expect(new Set(rendered).size, 'no duplicated thumbnails').toBe(IMAGE_TYPES.length);
    for (const img of images) {
      expect(
        rendered.filter((src) => src.includes(img.imageUrl)),
        `thumbnail for ${img.imageType}`,
      ).toHaveLength(1);
    }
  });

  test('omits the image gallery for a return with no images', async ({
    managerPage,
    api,
    data,
  }) => {
    const seeded = await data.makeReturn('PICKED_UP');
    expect(await api.getImages(seeded.id)).toHaveLength(0);

    const details = new ReturnDetailsPage(managerPage);
    await details.openId(seeded.id);

    // `rendered="#{not empty returnDetailsBean.images}"` — the whole card, testid
    // included, must be absent rather than present and empty.
    expect(await details.hasImageGallery()).toBe(false);
    expect(await details.imageCount()).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Status timeline
  // -------------------------------------------------------------------------

  test('status timeline lists every transition in chronological order', async ({
    managerPage,
    api,
    data,
  }) => {
    const seeded = await data.makeReturn('CLOSED');

    // The walk makeReturn performs, oldest first.
    const expectedTrail: ReturnStatus[] = [
      'WAITING_FOR_PICKUP',
      'BARCODE_ASSIGNED',
      'PICKED_UP',
      'ARRIVED_TO_WAREHOUSE',
      'INSPECTED',
      'CLOSED',
    ];
    expect(await api.statusTrail(seeded.id)).toEqual(expectedTrail);

    const details = new ReturnDetailsPage(managerPage);
    await details.openId(seeded.id);

    expect(await details.hasStatusTimeline()).toBe(true);
    expect(await details.timelineRowCount()).toBe(expectedTrail.length);

    // "To" is the new status of each row, oldest first (ORDER BY createdAt ASC).
    expect(await details.timelineToLabels()).toEqual(
      expectedTrail.map((s) => STATUS_LABEL[s]),
    );

    // "From" is the previous status; the first row starts at OPEN.
    expect(await details.timelineFromLabels()).toEqual([
      STATUS_LABEL.OPEN,
      ...expectedTrail.slice(0, -1).map((s) => STATUS_LABEL[s]),
    ]);

    // Barcode assignment is attributed to the driver that assigned it; every other
    // transition to the user that requested it (this worker's MANAGER client).
    const barcodeRow = expectedTrail.indexOf('BARCODE_ASSIGNED');
    const closedRow = expectedTrail.indexOf('CLOSED');
    expect(
      (await details.timelineCell(barcodeRow, 'changedBy').innerText()).trim(),
    ).toBe(SEED_DRIVER_ONE.name);
    expect((await details.timelineCell(closedRow, 'changedBy').innerText()).trim()).toBe(
      api.fullName,
    );

    // Notes carry the comment sent with the transition; assign-barcode sends none.
    const pickedUpRow = expectedTrail.indexOf('PICKED_UP');
    expect((await details.timelineCell(pickedUpRow, 'notes').innerText()).trim()).toBe(
      'e2e: item collected',
    );
    expect((await details.timelineCell(barcodeRow, 'notes').innerText()).trim()).toBe('');

    // Every row is stamped with a formatted date.
    for (let row = 0; row < expectedTrail.length; row += 1) {
      expect((await details.timelineCell(row, 'date').innerText()).trim()).toMatch(DATE_TIME);
    }
  });

  // -------------------------------------------------------------------------
  // Unresolvable ids
  // -------------------------------------------------------------------------

  test.fixme('unresolvable ?id renders the not-found warning, not a server error', async ({
    managerPage,
    api,
  }) => {
    // GAP 6 — two defects stack on this path and both must be fixed for the screen
    // to behave as documented:
    //   (a) `ReturnDetailsBean.init()` calls `returnService.getById(id)`, which
    //       throws NotFoundException for a missing row, so `returnRequest == null`
    //       is only ever reachable when the `id` parameter is absent entirely;
    //   (b) the `returnRequest == null` branch renders
    //       `<p:message severity="warn" summary="Return request not found." .../>`
    //       with no `for` — PrimeFaces ignores summary/detail and NPEs when `for`
    //       resolves to null (see MessageRenderer.encodeEnd).
    // Intended: a warn message, HTTP < 500, and no details body.
    // See docs/e2e-findings.md.
    const missingId = 999_999_999;
    expect(await api.findReturn(missingId), 'id must really not exist').toBeNull();

    const details = new ReturnDetailsPage(managerPage);

    const unknown = await details.gotoIdRaw(missingId);
    expect(unknown?.status() ?? 0, 'unknown id must not be a server error').toBeLessThan(500);
    await details.expectNotFound();

    const noId = await managerPage.goto(details.url());
    expect(noId?.status() ?? 0, 'missing id must not be a server error').toBeLessThan(500);
    await details.expectNotFound();
  });

  test.fixme('non-numeric ?id=abc renders the not-found warning instead of a 500', async ({
    managerPage,
  }) => {
    // GAP 4 — `ReturnDetailsBean.init()` does a bare `Long.parseLong(idParam)`, so
    // a non-numeric id throws NumberFormatException out of @PostConstruct, and
    // web.xml declares no <error-page>. Intended: the same warn message any other
    // unresolvable id gets. See docs/e2e-findings.md.
    const details = new ReturnDetailsPage(managerPage);

    const res = await details.gotoIdRaw('abc');
    expect(res?.status() ?? 0, 'a malformed id must not be a server error').toBeLessThan(500);
    await details.expectNotFound();
  });

  // -------------------------------------------------------------------------
  // Navigation + access
  // -------------------------------------------------------------------------

  test('Back to List returns to the returns list', async ({ managerPage, data }) => {
    const seeded = await data.makeReturn('ARRIVED_TO_WAREHOUSE');

    const details = new ReturnDetailsPage(managerPage);
    await details.openId(seeded.id);
    await details.backToListAndWait();

    await new ReturnsListPage(managerPage).expectLoaded();
  });

  test('every role can open the return details screen', async ({ pageForRole, data }) => {
    // The role matrix in CONTEXT.md grants /returns/details.xhtml to all four roles.
    const seeded = await data.makeReturn('INSPECTED');

    for (const role of ROLES) {
      const page = await pageForRole(role);
      const details = new ReturnDetailsPage(page);
      await details.openId(seeded.id);
      await details.expectHeaderId(seeded.id);
      expect(await details.statusLabel(), `status chip for ${role}`).toBe(
        STATUS_LABEL.INSPECTED,
      );
    }
  });
});
