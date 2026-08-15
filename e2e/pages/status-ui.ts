/**
 * The rendered vocabulary of `ReturnStatus` — mirrors `com.drb.server.web.StatusUi`.
 *
 * Both the list screen's Status column and the details screen's header chip run every status
 * through `StatusUi.label(...)` / `StatusUi.chipClass(...)`, so these two maps are the single
 * place a spec should get the expected text or CSS modifier from. Keep them in step with
 * `StatusUi.java`; a rename there must break exactly one file here.
 */

import type { ReturnStatus } from '../fixtures';

/** `StatusUi.label(...)` — the chip text rendered for each status. */
export const STATUS_LABEL: Readonly<Record<ReturnStatus, string>> = {
  OPEN: 'Open',
  WAITING_FOR_PICKUP: 'Waiting for pickup',
  BARCODE_ASSIGNED: 'Barcode assigned',
  PICKED_UP: 'Picked up',
  ARRIVED_TO_WAREHOUSE: 'Arrived to warehouse',
  INSPECTED: 'Inspected',
  CLOSED: 'Closed',
  NEEDS_MORE_INFO: 'Needs more info',
};

/** `StatusUi.chipClass(...)` — the modifier class that colours the chip. */
export const STATUS_CHIP_CLASS: Readonly<Record<ReturnStatus, string>> = {
  OPEN: 'drb-chip-status-open',
  WAITING_FOR_PICKUP: 'drb-chip-status-waiting',
  BARCODE_ASSIGNED: 'drb-chip-status-barcode',
  PICKED_UP: 'drb-chip-status-picked',
  ARRIVED_TO_WAREHOUSE: 'drb-chip-status-warehouse',
  INSPECTED: 'drb-chip-status-inspected',
  CLOSED: 'drb-chip-status-closed',
  NEEDS_MORE_INFO: 'drb-chip-status-needs-info',
};
