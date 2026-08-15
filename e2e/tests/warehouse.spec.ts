/**
 * Journey 6 — Warehouse Receiving (`/warehouse/receiving.xhtml`, Figma 49:2).
 *
 * What this spec proves: the storekeeper can pull a return's digital file up by barcode and
 * drive it through the back half of its lifecycle from the browser —
 *
 *     PICKED_UP --Mark as Arrived--> ARRIVED_TO_WAREHOUSE --Save Inspection--> INSPECTED
 *                                            \--Request More Info--> NEEDS_MORE_INFO
 *
 * Every transition is confirmed against the REST API (`api`), never against the screen alone.
 * The screen is the thing under test; the API is only the oracle and the fixture provisioner.
 *
 * Parallel-safety rules this file obeys (plan, "Test data strategy"):
 *   - Every barcode it touches comes from `data.makeReturn()`, i.e. `RET-E2E-<worker-namespaced>`.
 *     The seeded `RET-100xx` returns are shared across workers and are never read or mutated here.
 *   - Each test owns its return outright — nothing is handed between tests, and no test asserts on
 *     a return another test could also be transitioning.
 *   - No absolute counts. The only counts asserted are per-return (`getInspections(id).length`),
 *     which is scoped to a row this test created.
 *
 * Two behaviours of the screen that shape the assertions below:
 *   - The three forms are siblings. Search updates all of them; **Save Inspection updates only
 *     `#inspectionForm`**, so the Status cell inside `#digitalFile` still shows the pre-inspection
 *     status until the barcode is searched again. Post-inspection UI assertions therefore re-search.
 *   - Both destructive-ish actions are guarded by a native `confirm()`. Playwright auto-DISMISSES
 *     dialogs, so the page object's `*Confirming()` / `*Cancelling()` helpers are mandatory —
 *     a bare `.click()` on those buttons is a silent no-op.
 */

import {
  test,
  expect,
  ITEM_CONDITIONS,
  ROLE_USER_ID,
  SEED_DRIVER_ONE,
  WAREHOUSE_DECISIONS,
  type ReturnStatus,
} from '../fixtures';
import { WarehouseReceivingPage } from '../pages';

const DRIVER_ONE = SEED_DRIVER_ONE; // { id: 1, name: 'Bob Levi' }

/** A barcode that is syntactically ours but was never assigned to anything. */
function missingBarcode(seed: string): string {
  return `${seed}-NO-SUCH-RETURN`;
}

test.describe('Warehouse receiving — Journey 6', () => {
  // --- lookup ---------------------------------------------------------------

  test('an unknown barcode reports "not found" and renders no digital file', async ({
    warehousePage,
    data,
    api,
  }) => {
    const unknown = missingBarcode(data.nextBarcode());

    // Oracle: the barcode really is absent before the screen is asked about it.
    expect(await api.statusCode('GET', `/warehouse/returns/${unknown}`)).toBe(404);

    const receiving = new WarehouseReceivingPage(warehousePage);
    await receiving.open();

    await receiving.search(unknown);

    await receiving.expectNotFound(unknown);
    expect(await receiving.isFileVisible()).toBe(false);
    expect(await receiving.isInspectionFormVisible()).toBe(false);
  });

  test('an empty barcode search is rejected and never reaches the lookup', async ({
    warehousePage,
  }) => {
    const receiving = new WarehouseReceivingPage(warehousePage);
    await receiving.open();

    await receiving.search('');

    // `p:inputText id="barcodeInput" required="true"` — the action must not run at all.
    await receiving.searchMessages.expectError(/required/i);
    expect(await receiving.isFileVisible()).toBe(false);
  });

  test('searching a PICKED_UP barcode renders the full digital return file', async ({
    warehousePage,
    data,
    api,
  }) => {
    const seeded = await data.makeReturn('PICKED_UP', {
      quantity: 2,
      underWarranty: true,
      wasUsed: false,
      priority: 'MEDIUM',
      returnReason: 'PRODUCT_DEFECT',
      defectType: 'SCRATCH',
      defectStage: 'INITIAL_SHIPPING',
      defectLocationText: 'left-hand corner',
      reason: 'e2e receiving notes',
      defectDescription: 'e2e receiving defect description',
    });
    const dto = await api.getReturn(seeded.id);
    expect(dto.status).toBe('PICKED_UP');

    const receiving = new WarehouseReceivingPage(warehousePage);
    await receiving.open();
    await receiving.search(seeded.barcode!);

    await receiving.expectFound(seeded.barcode!);
    expect(await receiving.returnIdInHeader()).toBe(seeded.id);

    // Core info block — every value comes from the return the API just described.
    await expect(receiving.fileFieldValue('Customer')).toHaveText(data.customer.fullName);
    await expect(receiving.fileFieldValue('Phone')).toHaveText(data.customer.phone);
    await expect(receiving.fileFieldValue('Order Number')).toHaveText(seeded.orderNumber);
    await expect(receiving.fileFieldValue('Quantity')).toHaveText('2');
    await expect(receiving.fileFieldValue('Under Warranty')).toHaveText('true');
    await expect(receiving.fileFieldValue('Was Used')).toHaveText('false');
    await expect(receiving.fileFieldValue('Priority')).toHaveText('MEDIUM');
    await expect(receiving.fileFieldValue('Barcode')).toHaveText(seeded.barcode!);
    await expect(receiving.fileFieldValue('Driver')).toHaveText(DRIVER_ONE.name);
    await receiving.expectStatus('PICKED_UP');

    // Service defect detail — the storekeeper reads the rep's assessment here.
    await expect(receiving.fileFieldValue('Return Reason')).toHaveText('PRODUCT_DEFECT');
    await expect(receiving.fileFieldValue('Defect Type')).toHaveText('SCRATCH');
    await expect(receiving.fileFieldValue('Defect Stage')).toHaveText('INITIAL_SHIPPING');
    await expect(receiving.fileFieldValue('Defect Location')).toHaveText('left-hand corner');
    await expect(receiving.fileFieldValue('Reason Notes')).toHaveText('e2e receiving notes');
    await expect(receiving.fileFieldValue('Defect Description')).toHaveText(
      'e2e receiving defect description',
    );

    // An API-provisioned return carries no images and no driver pickup update, so both
    // `rendered="#{not empty …}"` fieldsets must be ABSENT rather than empty.
    expect(await api.getImages(seeded.id)).toEqual([]);
    expect(await api.getPickupUpdates(seeded.id)).toEqual([]);
    expect(await receiving.galleryCount()).toBe(0);
    expect(await receiving.pickupRowCount()).toBe(0);

    // PICKED_UP offers exactly one action, and no inspection yet.
    expect(await receiving.isMarkArrivedVisible()).toBe(true);
    expect(await receiving.isRequestMoreInfoVisible()).toBe(false);
    expect(await receiving.isInspectionFormVisible()).toBe(false);
  });

  test('the action buttons and the inspection card are gated by the return status', async ({
    warehousePage,
    data,
  }) => {
    // Only statuses that HAVE a barcode are reachable from this screen (lookup is by barcode),
    // which rules out OPEN and WAITING_FOR_PICKUP. NEEDS_MORE_INFO is provisioned through the
    // warehouse route so that it, too, owns a barcode.
    const [assigned, picked, arrived, inspected, closed, needsInfo] = await Promise.all([
      data.makeReturn('BARCODE_ASSIGNED'),
      data.makeReturn('PICKED_UP'),
      data.makeReturn('ARRIVED_TO_WAREHOUSE'),
      data.makeReturn('INSPECTED'),
      data.makeReturn('CLOSED'),
      data.makeReturn('NEEDS_MORE_INFO', { needsMoreInfoVia: 'WAREHOUSE' }),
    ]);

    const cases: Array<{
      status: ReturnStatus;
      barcode: string;
      markArrived: boolean;
      requestMoreInfo: boolean;
      inspection: boolean;
    }> = [
      {
        status: 'BARCODE_ASSIGNED',
        barcode: assigned.barcode!,
        markArrived: false,
        requestMoreInfo: false,
        inspection: false,
      },
      {
        status: 'PICKED_UP',
        barcode: picked.barcode!,
        markArrived: true,
        requestMoreInfo: false,
        inspection: false,
      },
      {
        status: 'ARRIVED_TO_WAREHOUSE',
        barcode: arrived.barcode!,
        markArrived: false,
        requestMoreInfo: true,
        inspection: true,
      },
      {
        status: 'INSPECTED',
        barcode: inspected.barcode!,
        markArrived: false,
        requestMoreInfo: false,
        inspection: true,
      },
      {
        status: 'CLOSED',
        barcode: closed.barcode!,
        markArrived: false,
        requestMoreInfo: false,
        inspection: false,
      },
      {
        status: 'NEEDS_MORE_INFO',
        barcode: needsInfo.barcode!,
        markArrived: false,
        requestMoreInfo: false,
        inspection: false,
      },
    ];

    const receiving = new WarehouseReceivingPage(warehousePage);
    await receiving.open();

    for (const c of cases) {
      await receiving.search(c.barcode);
      await receiving.expectFound(c.barcode);
      await receiving.expectStatus(c.status);

      expect(await receiving.isMarkArrivedVisible(), `Mark as Arrived on ${c.status}`).toBe(
        c.markArrived,
      );
      expect(await receiving.isRequestMoreInfoVisible(), `Request More Info on ${c.status}`).toBe(
        c.requestMoreInfo,
      );
      expect(await receiving.isInspectionFormVisible(), `inspection card on ${c.status}`).toBe(
        c.inspection,
      );
    }
  });

  // --- Mark as Arrived ------------------------------------------------------

  test('Mark as Arrived moves the return to ARRIVED_TO_WAREHOUSE and opens the inspection card', async ({
    warehousePage,
    data,
    api,
  }) => {
    const seeded = await data.makeReturn('PICKED_UP');
    expect(await api.statusOf(seeded.id)).toBe('PICKED_UP');

    const receiving = new WarehouseReceivingPage(warehousePage);
    await receiving.open();
    await receiving.search(seeded.barcode!);
    await receiving.expectFound(seeded.barcode!);

    await receiving.markArrivedConfirming();

    await receiving.searchMessages.expectInfo('Marked as arrived');
    await receiving.expectStatus('ARRIVED_TO_WAREHOUSE');
    await api.expectStatus(seeded.id, 'ARRIVED_TO_WAREHOUSE');

    // The screen swaps which actions it offers, and the inspection card appears.
    expect(await receiving.isMarkArrivedVisible()).toBe(false);
    expect(await receiving.isRequestMoreInfoVisible()).toBe(true);
    expect(await receiving.isInspectionFormVisible()).toBe(true);

    // The history row proves the ARRIVAL came from this screen and this user: the API path
    // `makeReturn` uses would have written the comment "e2e: received at warehouse" instead.
    const arrival = (await api.getStatusHistory(seeded.id)).find(
      (h) => h.newStatus === 'ARRIVED_TO_WAREHOUSE',
    );
    expect(arrival, 'ARRIVED_TO_WAREHOUSE status-history row').toBeTruthy();
    expect(arrival!.comment).toBe('Arrived at warehouse');
    expect(arrival!.changedByUserId).toBe(ROLE_USER_ID.WAREHOUSE);
  });

  test('cancelling the Mark as Arrived confirm leaves the return in PICKED_UP', async ({
    warehousePage,
    data,
    api,
  }) => {
    const seeded = await data.makeReturn('PICKED_UP');

    const receiving = new WarehouseReceivingPage(warehousePage);
    await receiving.open();
    await receiving.search(seeded.barcode!);
    await receiving.expectFound(seeded.barcode!);

    await receiving.markArrivedCancelling();

    // `onclick="return confirm(...)"` returning false suppresses the ajax entirely: no message,
    // no re-render, no transition.
    await receiving.expectStatus('PICKED_UP');
    expect(await receiving.isMarkArrivedVisible()).toBe(true);
    expect(await receiving.isInspectionFormVisible()).toBe(false);
    expect(await api.statusOf(seeded.id)).toBe('PICKED_UP');
    expect(await api.statusTrail(seeded.id)).not.toContain('ARRIVED_TO_WAREHOUSE');
  });

  // --- Request More Info ----------------------------------------------------

  test('Request More Info sends an arrived return back to NEEDS_MORE_INFO', async ({
    warehousePage,
    data,
    api,
  }) => {
    const seeded = await data.makeReturn('ARRIVED_TO_WAREHOUSE');
    expect(await api.statusOf(seeded.id)).toBe('ARRIVED_TO_WAREHOUSE');

    const receiving = new WarehouseReceivingPage(warehousePage);
    await receiving.open();
    await receiving.search(seeded.barcode!);
    expect(await receiving.isRequestMoreInfoVisible()).toBe(true);

    await receiving.requestMoreInfoConfirming();

    await receiving.searchMessages.expectInfo('More info requested');
    await receiving.expectStatus('NEEDS_MORE_INFO');
    await api.expectStatus(seeded.id, 'NEEDS_MORE_INFO');

    // A return awaiting information offers no warehouse action and no inspection card.
    expect(await receiving.isMarkArrivedVisible()).toBe(false);
    expect(await receiving.isRequestMoreInfoVisible()).toBe(false);
    expect(await receiving.isInspectionFormVisible()).toBe(false);

    const trail = await api.statusTrail(seeded.id);
    expect(trail.slice(-2)).toEqual(['ARRIVED_TO_WAREHOUSE', 'NEEDS_MORE_INFO']);

    const row = (await api.getStatusHistory(seeded.id)).find(
      (h) => h.newStatus === 'NEEDS_MORE_INFO',
    );
    expect(row!.comment).toBe('Warehouse requested more information');
  });

  test('cancelling the Request More Info confirm leaves the return ARRIVED_TO_WAREHOUSE', async ({
    warehousePage,
    data,
    api,
  }) => {
    const seeded = await data.makeReturn('ARRIVED_TO_WAREHOUSE');

    const receiving = new WarehouseReceivingPage(warehousePage);
    await receiving.open();
    await receiving.search(seeded.barcode!);

    await receiving.requestMoreInfoCancelling();

    await receiving.expectStatus('ARRIVED_TO_WAREHOUSE');
    expect(await receiving.isRequestMoreInfoVisible()).toBe(true);
    expect(await receiving.isInspectionFormVisible()).toBe(true);
    expect(await api.statusOf(seeded.id)).toBe('ARRIVED_TO_WAREHOUSE');
    expect(await api.statusTrail(seeded.id)).not.toContain('NEEDS_MORE_INFO');
  });

  // --- Inspection -----------------------------------------------------------

  test('Save Inspection requires both Item Condition and Decision', async ({
    warehousePage,
    data,
    api,
  }) => {
    const seeded = await data.makeReturn('ARRIVED_TO_WAREHOUSE');

    const receiving = new WarehouseReceivingPage(warehousePage);
    await receiving.open();
    await receiving.search(seeded.barcode!);
    expect(await receiving.isInspectionFormVisible()).toBe(true);

    // Both selects start on "— Select … —", i.e. an empty submitted value.
    await receiving.saveInspectionAndWait();

    await receiving.inspectionMessages.expectError(/required/i);
    expect(await api.getInspections(seeded.id)).toEqual([]);
    expect(await api.statusOf(seeded.id)).toBe('ARRIVED_TO_WAREHOUSE');

    // Supplying both makes the very same button succeed.
    await receiving.inspect({
      itemCondition: 'USED',
      decision: 'REPAIR',
      callFullyHandled: false,
      notes: 'e2e: filled in on the second attempt',
    });

    await receiving.expectInspectionSaved();
    await api.expectStatus(seeded.id, 'INSPECTED');
    expect(await api.getInspections(seeded.id)).toHaveLength(1);
  });

  // One test per WarehouseDecision — a return can only be inspected once (the server-enforced
  // transition table has no INSPECTED -> INSPECTED edge), so each decision needs its own return.
  // Item conditions are cycled alongside so all five of those get exercised too.
  for (const [index, decision] of WAREHOUSE_DECISIONS.entries()) {
    const itemCondition = ITEM_CONDITIONS[index % ITEM_CONDITIONS.length];

    test(`Save Inspection records the ${decision} decision and moves the return to INSPECTED`, async ({
      warehousePage,
      data,
      api,
    }) => {
      const seeded = await data.makeReturn('ARRIVED_TO_WAREHOUSE');
      const notes = data.uniqueName(`insp-${decision.toLowerCase()}`);

      const receiving = new WarehouseReceivingPage(warehousePage);
      await receiving.open();
      await receiving.search(seeded.barcode!);
      expect(await receiving.isInspectionFormVisible()).toBe(true);

      await receiving.inspect({ itemCondition, decision, callFullyHandled: false, notes });

      await receiving.expectInspectionSaved();
      await api.expectStatus(seeded.id, 'INSPECTED');

      const inspection = await api.latestInspection(seeded.id);
      expect(inspection, 'the screen must have persisted an inspection').toBeTruthy();
      expect(inspection!.warehouseDecision).toBe(decision);
      expect(inspection!.itemCondition).toBe(itemCondition);
      expect(inspection!.warehouseNotes).toBe(notes);
      expect(inspection!.callFullyHandled).toBe(false);
      expect(inspection!.inspectedByUserId).toBe(ROLE_USER_ID.WAREHOUSE);

      // Not fully handled -> the return stops at INSPECTED, it does not close itself.
      expect(await api.statusOf(seeded.id)).toBe('INSPECTED');

      // `Save Inspection` only updates #inspectionForm, so the digital file's Status cell is
      // stale until the barcode is looked up again — after which it reports INSPECTED.
      await receiving.search(seeded.barcode!);
      await receiving.expectStatus('INSPECTED');
      expect(await receiving.isInspectionFormVisible()).toBe(true);
      expect(await receiving.isMarkArrivedVisible()).toBe(false);
      expect(await receiving.isRequestMoreInfoVisible()).toBe(false);
    });
  }

  test.fixme('"Call Fully Handled" chains the return on to CLOSED', async ({
    warehousePage,
    data,
    api,
  }) => {
    // NEW FINDING — not one of the 5 in docs/e2e-findings.md yet; please add it as GAP 6.
    // The plan (journey 6) and docs/screens.md ("Call Fully Handled chains CLOSED") both say a
    // fully-handled inspection closes the return, and the control inventory encodes the same
    // effect on `save-inspection`. Nothing on the web path implements it:
    //   - WarehouseReceivingBean.createInspection() (server/.../web/WarehouseReceivingBean.java:118)
    //     copies callFullyHandled onto the entity and stops there;
    //   - WarehouseService.createInspection() (server/.../service/WarehouseService.java:46) always
    //     transitions to INSPECTED and never reads the flag.
    // The Android client does the chaining itself with a second call
    // (WarehouseInspectionActivity.java:332 posts a CLOSED status update), so the web screen is
    // the surface that diverges. INSPECTED -> CLOSED is already a legal edge in
    // ReturnRequestService.ALLOWED_TRANSITIONS, so the fix is server-side and small.
    const seeded = await data.makeReturn('ARRIVED_TO_WAREHOUSE');

    const receiving = new WarehouseReceivingPage(warehousePage);
    await receiving.open();
    await receiving.search(seeded.barcode!);

    await receiving.inspect({
      itemCondition: 'LIKE_NEW_ORIGINAL_PACKAGING',
      decision: 'STOCK_AS_NEW_114',
      callFullyHandled: true,
      notes: 'e2e: fully handled on the call',
    });

    await receiving.expectInspectionSaved();

    const inspection = await api.latestInspection(seeded.id);
    expect(inspection!.callFullyHandled).toBe(true);

    await api.expectStatus(seeded.id, 'CLOSED');
    expect((await api.statusTrail(seeded.id)).slice(-2)).toEqual(['INSPECTED', 'CLOSED']);

    // A closed return exposes no further warehouse action.
    await receiving.search(seeded.barcode!);
    await receiving.expectStatus('CLOSED');
    expect(await receiving.isInspectionFormVisible()).toBe(false);
    expect(await receiving.isMarkArrivedVisible()).toBe(false);
    expect(await receiving.isRequestMoreInfoVisible()).toBe(false);
  });

  // --- full lifecycle -------------------------------------------------------

  test('full lifecycle on one owned barcode: picked up -> arrived -> inspected', async ({
    warehousePage,
    data,
    api,
  }) => {
    const seeded = await data.makeReturn('PICKED_UP');
    const barcode = seeded.barcode!;
    expect(await api.statusOf(seeded.id)).toBe('PICKED_UP');

    const receiving = new WarehouseReceivingPage(warehousePage);
    await receiving.open();

    // 1. Look the return up by the barcode the driver stuck on it.
    await receiving.search(barcode);
    await receiving.expectFound(barcode);
    await receiving.expectStatus('PICKED_UP');
    expect(await receiving.returnIdInHeader()).toBe(seeded.id);

    // 2. Receive it into the warehouse.
    await receiving.markArrivedConfirming();
    await receiving.expectStatus('ARRIVED_TO_WAREHOUSE');
    await api.expectStatus(seeded.id, 'ARRIVED_TO_WAREHOUSE');
    expect(await receiving.isInspectionFormVisible()).toBe(true);

    // 3. Inspect it.
    const notes = data.uniqueName('lifecycle');
    await receiving.inspect({
      itemCondition: 'USED_MINOR_DEFECT',
      decision: 'CLASS_B',
      callFullyHandled: false,
      notes,
    });
    await receiving.expectInspectionSaved();
    await api.expectStatus(seeded.id, 'INSPECTED');

    const inspection = await api.latestInspection(seeded.id);
    expect(inspection!.itemCondition).toBe('USED_MINOR_DEFECT');
    expect(inspection!.warehouseDecision).toBe('CLASS_B');
    expect(inspection!.warehouseNotes).toBe(notes);
    expect(inspection!.returnRequestId).toBe(seeded.id);

    // 4. The audit trail records both browser-driven transitions, in order.
    expect((await api.statusTrail(seeded.id)).slice(-3)).toEqual([
      'PICKED_UP',
      'ARRIVED_TO_WAREHOUSE',
      'INSPECTED',
    ]);

    // 5. A fresh lookup of the same barcode reports the end state.
    await receiving.search(barcode);
    await receiving.expectFound(barcode);
    await receiving.expectStatus('INSPECTED');
    expect(await receiving.isMarkArrivedVisible()).toBe(false);
    expect(await receiving.isRequestMoreInfoVisible()).toBe(false);
    expect(await receiving.isInspectionFormVisible()).toBe(true);
  });

  test('MANAGER can drive the receiving screen as well as WAREHOUSE', async ({
    managerPage,
    data,
    api,
  }) => {
    // docs/screens.md scopes this screen to Warehouse; the plan's role matrix grants MANAGER the
    // same access. This asserts the manager path end-to-end, including who the server records.
    const seeded = await data.makeReturn('PICKED_UP');

    const receiving = new WarehouseReceivingPage(managerPage);
    await receiving.open();
    await receiving.search(seeded.barcode!);
    await receiving.expectFound(seeded.barcode!);

    await receiving.markArrivedConfirming();
    await api.expectStatus(seeded.id, 'ARRIVED_TO_WAREHOUSE');

    const arrival = (await api.getStatusHistory(seeded.id)).find(
      (h) => h.newStatus === 'ARRIVED_TO_WAREHOUSE',
    );
    expect(arrival!.changedByUserId).toBe(ROLE_USER_ID.MANAGER);

    await receiving.inspect({
      itemCondition: 'SIGNIFICANTLY_DEFECTIVE',
      decision: 'DISPOSE',
      callFullyHandled: false,
      notes: data.uniqueName('manager-insp'),
    });
    await receiving.expectInspectionSaved();
    await api.expectStatus(seeded.id, 'INSPECTED');
    expect((await api.latestInspection(seeded.id))!.inspectedByUserId).toBe(ROLE_USER_ID.MANAGER);
  });
});
