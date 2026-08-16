import { randomUUID } from 'node:crypto';
import {
  test as apiTest,
  type CustomerPurchaseDto,
  type DefectStage,
  type DefectType,
  type DrbApi,
  type ReturnReason,
  type ReturnRequestDto,
  type ReturnStatus,
} from './api';

// ---------------------------------------------------------------------------
// Seed facts (database/seed.sql — deterministic BIGSERIAL ids on a fresh volume)
// ---------------------------------------------------------------------------

/** customers ids 1..20. */
export const SEED_CUSTOMER_COUNT = 20;

/** Index i holds the name of customer id (i + 1). */
export const SEED_CUSTOMER_NAMES: readonly string[] = [
  'Yael Shapiro',
  'Moshe Peretz',
  'Noa Goldberg',
  'Avi Friedman',
  'Tamar Levi',
  'Itai Cohen',
  'Shira Azoulay',
  'Yossi Mizrahi',
  'Rivka Stern',
  'Daniel Katz',
  'Maya Barak',
  'Eitan Regev',
  'Liora Ben-Ami',
  'Omer Shani',
  'Hila Dahan',
  'Nadav Tal',
  'Gali Weiss',
  'Ronen Avraham',
  'Sivan Klein',
  'Tomer Geva',
];

/**
 * drivers.id -> driver display name (drivers 1 = Bob Levi, 2 = Dana Avraham).
 * Prefer the named `SEED_DRIVER_ONE` / `SEED_DRIVER_TWO` below over indexing this.
 */
export const SEED_DRIVERS: readonly SeedDriver[] = [
  { id: 1, name: 'Bob Levi', vehicle: 'ABC-123' },
  { id: 2, name: 'Dana Avraham', vehicle: 'XYZ-789' },
];

export const SEED_DRIVER_IDS: readonly number[] = [1, 2];

export interface SeedDriver {
  id: number;
  name: string;
  vehicle: string;
}

/** Bob Levi — the driver `makeReturn` assigns by default. */
export const SEED_DRIVER_ONE: SeedDriver = { id: 1, name: 'Bob Levi', vehicle: 'ABC-123' };

/** Dana Avraham — the second driver, used to prove the driver filter actually narrows. */
export const SEED_DRIVER_TWO: SeedDriver = { id: 2, name: 'Dana Avraham', vehicle: 'XYZ-789' };

/**
 * How the wizard's step-3 driver dropdown labels a driver: `#{d.user.fullName} (#{d.vehicleNumber})`.
 * Also the shape of the `Assigned Driver` value on the details screen's barcode card.
 */
export function driverOptionLabel(driver: SeedDriver): string {
  return `${driver.name} (${driver.vehicle})`;
}

/** products ids 1..30, every one carries the same working Cloudinary image_url. */
export const SEED_PRODUCT_COUNT = 30;

/**
 * Seeded return barcodes look like `RET-100xx`. Specs must NEVER mutate those —
 * they are shared across all workers. Use `data.makeReturn()` instead.
 */
export const SEED_BARCODE_PREFIX = 'RET-100';

/** Every barcode this suite creates starts with this. */
export const E2E_BARCODE_PREFIX = 'RET-E2E-';

/** Every admin row this suite creates carries this name prefix. */
export const E2E_NAME_PREFIX = 'e2e-';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export interface ClaimedCustomer {
  /** customers.id */
  id: number;
  /** Login/lookup phone for wizard step 1 (`0521000001` … `0521000020`). */
  phone: string;
  /** Seeded full name, as rendered by the list/details screens. */
  fullName: string;
}

/**
 * Each worker owns exactly one seeded customer and therefore owns that
 * customer's `customer_purchases` rows outright. Nothing creates purchases over
 * the API, so the wizard has to consume seeded rows — this partition is what
 * keeps `--workers=4` from double-selecting the same purchase.
 *
 * Rows with `handled = true` (product_id % 5 == 0) are the non-selectable ones.
 */
export function claimCustomer(workerIndex: number): ClaimedCustomer {
  const id = (workerIndex % SEED_CUSTOMER_COUNT) + 1;
  return {
    id,
    phone: `0521${String(id).padStart(6, '0')}`,
    fullName: SEED_CUSTOMER_NAMES[id - 1] ?? `customer-${id}`,
  };
}

/** `e2e-<uuid8>` or `e2e-<uuid8>-<label>`; always matched by `isE2eName`. */
export function uniqueName(label?: string): string {
  const id = randomUUID().slice(0, 8);
  return label ? `${E2E_NAME_PREFIX}${id}-${label}` : `${E2E_NAME_PREFIX}${id}`;
}

/** True for anything this suite created — use it to scope admin cleanup. */
export function isE2eName(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(E2E_NAME_PREFIX);
}

export function isE2eBarcode(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(E2E_BARCODE_PREFIX);
}

/** Per-worker monotonic counters, so barcodes/phones never collide across workers. */
const barcodeCounters = new Map<number, number>();
const phoneCounters = new Map<number, number>();

function nextIn(counters: Map<number, number>, workerIndex: number): number {
  const next = (counters.get(workerIndex) ?? 0) + 1;
  counters.set(workerIndex, next);
  return next;
}

/**
 * `RET-E2E-<n>` with n = workerIndex * 100000 + counter, zero-padded to 6.
 * Worker 0 -> RET-E2E-000001, worker 3 -> RET-E2E-300001. Unique across the run.
 */
export function nextBarcode(workerIndex: number): string {
  const n = workerIndex * 100_000 + nextIn(barcodeCounters, workerIndex);
  return `${E2E_BARCODE_PREFIX}${String(n).padStart(6, '0')}`;
}

/**
 * A phone that cannot collide with seeded users (`050…`) or customers (`0521…`).
 * Shape: `0599<3-digit process salt><3-digit counter>` — 10 digits.
 *
 * The salt is per worker PROCESS, not per index: the old `workerIndex % 10` form broke
 * once Playwright respawned past ten workers (a respawn bumps workerIndex), because two
 * live processes then shared a digit AND both counters started at 1 — which is what made
 * `POST /users` blow up on `users_phone_number_key`.
 */
const PHONE_SALT = String(process.pid % 1000).padStart(3, '0');

export function nextPhone(workerIndex: number): string {
  const n = nextIn(phoneCounters, workerIndex) % 1000;
  return `0599${PHONE_SALT}${String(n).padStart(3, '0')}`;
}

// ---------------------------------------------------------------------------
// makeReturn
// ---------------------------------------------------------------------------

export interface MakeReturnOptions {
  /** Defaults to this worker's claimed customer. */
  customerId?: number;
  /** Defaults to product 1. */
  productId?: number;
  /** Defaults to driver 1 (Bob Levi). Pass `null` for an unassigned return. */
  driverId?: number | null;
  /** Defaults to `nextBarcode()`. Only used for BARCODE_ASSIGNED and beyond. */
  barcode?: string;
  /**
   * Link a `customer_purchases` row and flip its `handled` flag.
   * Omitted by default — makeReturn must not burn the wizard's purchases.
   */
  purchaseId?: number;
  orderNumber?: string;
  reason?: string;
  defectDescription?: string;
  /** Domain values are LOW / MEDIUM / HIGH. Defaults to MEDIUM. */
  priority?: string;
  originalDeliveryDate?: string;
  quantity?: number;
  underWarranty?: boolean;
  wasUsed?: boolean;
  returnReason?: ReturnReason;
  defectType?: DefectType;
  defectStage?: DefectStage;
  defectLocationText?: string;
  /**
   * NEEDS_MORE_INFO is reachable from two places. 'OPEN' (default) is the quick
   * path; 'WAREHOUSE' walks the return all the way to ARRIVED_TO_WAREHOUSE
   * first, which is what the warehouse "Request More Info" flow produces.
   */
  needsMoreInfoVia?: 'OPEN' | 'WAREHOUSE';
}

export interface SeededReturn {
  id: number;
  /** Non-null from BARCODE_ASSIGNED onwards. */
  barcode: string | null;
  status: ReturnStatus;
  customerId: number;
  productId: number;
  driverId: number | null;
  orderNumber: string;
  /** The last DTO the API returned — already reflects the target status. */
  dto: ReturnRequestDto;
}

/**
 * Per-test data factory. Reachable from every spec as the `data` fixture.
 *
 * Everything it produces is owned by the calling worker: barcodes are worker
 * -namespaced, and the default customer is the worker's claimed one. Assert on
 * deltas, never on absolute dashboard counts — other workers are creating
 * returns at the same time.
 */
export class DataFactory {
  /** This worker's exclusively-owned seeded customer. */
  readonly customer: ClaimedCustomer;

  constructor(
    private readonly api: DrbApi,
    readonly workerIndex: number,
  ) {
    this.customer = claimCustomer(workerIndex);
  }

  claimCustomer(workerIndex: number = this.workerIndex): ClaimedCustomer {
    return claimCustomer(workerIndex);
  }

  nextBarcode(): string {
    return nextBarcode(this.workerIndex);
  }

  nextPhone(): string {
    return nextPhone(this.workerIndex);
  }

  uniqueName(label?: string): string {
    return uniqueName(label);
  }

  isE2eName(value: string | null | undefined): boolean {
    return isE2eName(value);
  }

  isE2eBarcode(value: string | null | undefined): boolean {
    return isE2eBarcode(value);
  }

  /** Purchases of the claimed customer that the wizard may select. */
  selectablePurchases(): Promise<CustomerPurchaseDto[]> {
    return this.api.selectablePurchases(this.customer.id);
  }

  /** Purchases of the claimed customer the wizard must show as "Handled". */
  handledPurchases(): Promise<CustomerPurchaseDto[]> {
    return this.api.handledPurchases(this.customer.id);
  }

  /** First still-selectable purchase; throws if the worker has exhausted them. */
  async firstSelectablePurchase(): Promise<CustomerPurchaseDto> {
    const rows = await this.selectablePurchases();
    const first = rows[0];
    if (!first) {
      throw new Error(
        `[data] customer ${this.customer.id} has no unhandled purchases left — ` +
          `worker ${this.workerIndex} consumed them all. Seed provides ~3 per customer.`,
      );
    }
    return first;
  }

  /**
   * Provisions a brand-new return in `status` via the REST API and returns its
   * identifiers. Never touches the seeded RET-100xx rows.
   *
   * The walk follows the server-enforced transition table:
   * OPEN -> WAITING_FOR_PICKUP -> (assign-barcode) BARCODE_ASSIGNED ->
   * PICKED_UP -> ARRIVED_TO_WAREHOUSE -> INSPECTED -> CLOSED.
   */
  async makeReturn(
    status: ReturnStatus = 'OPEN',
    options: MakeReturnOptions = {},
  ): Promise<SeededReturn> {
    const customerId = options.customerId ?? this.customer.id;
    const productId = options.productId ?? 1;
    const driverId = options.driverId === null ? null : (options.driverId ?? SEED_DRIVER_IDS[0]);
    const orderNumber = options.orderNumber ?? uniqueName('ord');

    let dto = await this.api.createReturn({
      customerId,
      productId,
      ...(options.purchaseId !== undefined ? { purchaseId: options.purchaseId } : {}),
      driverId,
      orderNumber,
      reason: options.reason ?? 'e2e seeded return',
      defectDescription: options.defectDescription ?? 'e2e seeded defect description',
      priority: options.priority ?? 'MEDIUM',
      ...(options.originalDeliveryDate !== undefined
        ? { originalDeliveryDate: options.originalDeliveryDate }
        : {}),
      quantity: options.quantity ?? 1,
      underWarranty: options.underWarranty ?? true,
      wasUsed: options.wasUsed ?? false,
      returnReason: options.returnReason ?? 'PRODUCT_DEFECT',
      defectType: options.defectType ?? 'SCRATCH',
      defectStage: options.defectStage ?? 'INITIAL_SHIPPING',
      defectLocationText: options.defectLocationText ?? 'e2e defect location',
    });

    let barcode: string | null = null;
    const seeded = (): SeededReturn => ({
      id: dto.id,
      barcode,
      status: dto.status,
      customerId,
      productId,
      driverId,
      orderNumber,
      dto,
    });

    if (status === 'OPEN') return seeded();

    const viaWarehouse = (options.needsMoreInfoVia ?? 'OPEN') === 'WAREHOUSE';
    if (status === 'NEEDS_MORE_INFO' && !viaWarehouse) {
      dto = await this.api.setStatus(dto.id, 'NEEDS_MORE_INFO', 'e2e: opened with missing info');
      return seeded();
    }

    dto = await this.api.setStatus(dto.id, 'WAITING_FOR_PICKUP', 'e2e: driver assigned');
    if (status === 'WAITING_FOR_PICKUP') return seeded();

    barcode = options.barcode ?? this.nextBarcode();
    dto = await this.api.assignBarcode(dto.id, barcode, driverId ?? SEED_DRIVER_IDS[0]);
    if (status === 'BARCODE_ASSIGNED') return seeded();

    dto = await this.api.setStatus(dto.id, 'PICKED_UP', 'e2e: item collected');
    if (status === 'PICKED_UP') return seeded();

    dto = await this.api.setStatus(dto.id, 'ARRIVED_TO_WAREHOUSE', 'e2e: received at warehouse');
    if (status === 'ARRIVED_TO_WAREHOUSE') return seeded();

    if (status === 'NEEDS_MORE_INFO') {
      dto = await this.api.setStatus(dto.id, 'NEEDS_MORE_INFO', 'e2e: warehouse needs more info');
      return seeded();
    }

    dto = await this.api.setStatus(dto.id, 'INSPECTED', 'e2e: inspection completed');
    if (status === 'INSPECTED') return seeded();

    dto = await this.api.setStatus(dto.id, 'CLOSED', 'e2e: return closed');
    return seeded();
  }

  /** Convenience: one return per status, in parallel. */
  async makeReturnPerStatus(
    statuses: readonly ReturnStatus[],
  ): Promise<Record<string, SeededReturn>> {
    const entries = await Promise.all(
      statuses.map(async (s) => [s, await this.makeReturn(s)] as const),
    );
    return Object.fromEntries(entries);
  }
}

export interface DataTestFixtures {
  /** Per-test data factory bound to this worker's API client and customer. */
  data: DataFactory;
}

export const test = apiTest.extend<DataTestFixtures>({
  data: async ({ api }, use, testInfo) => {
    await use(new DataFactory(api, testInfo.workerIndex));
  },
});
