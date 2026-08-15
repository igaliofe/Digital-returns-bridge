import type { Buffer } from 'node:buffer';
import {
  expect,
  request as apiRequest,
  type APIRequestContext,
  type APIResponse,
} from '@playwright/test';
import { PNG_1X1 } from './assets';
import { test as authTest, ROLE_PHONE, type Role } from './auth';

/** JaxRsApplication is @ApplicationPath("/api") on a ROOT.war — no context prefix. */
export const API_BASE = '/api';

// ---------------------------------------------------------------------------
// Enum value sets — must match docs/api.md and the DB CHECK constraints exactly
// ---------------------------------------------------------------------------

export type ReturnStatus =
  | 'OPEN'
  | 'WAITING_FOR_PICKUP'
  | 'BARCODE_ASSIGNED'
  | 'PICKED_UP'
  | 'ARRIVED_TO_WAREHOUSE'
  | 'INSPECTED'
  | 'CLOSED'
  | 'NEEDS_MORE_INFO';

export type ItemCondition =
  | 'LIKE_NEW_ORIGINAL_PACKAGING'
  | 'LIKE_NEW_NO_PACKAGING'
  | 'USED'
  | 'USED_MINOR_DEFECT'
  | 'SIGNIFICANTLY_DEFECTIVE';

export type ReturnReason =
  | 'NOT_AS_EXPECTED'
  | 'DELIVERY_ERROR'
  | 'SELLER_ERROR'
  | 'SUPPLIER_ERROR'
  | 'WAREHOUSE_ERROR'
  | 'DRIVER_ERROR'
  | 'CUSTOMER_NOT_HOME'
  | 'PRODUCT_DEFECT';

export type DefectType =
  | 'TEAR'
  | 'SCRATCH'
  | 'BREAK'
  | 'MISSING_PART'
  | 'FADED_COLOR'
  | 'RUST'
  | 'DENT'
  | 'REVERSED_SIDE'
  | 'ELECTRONIC_FAULT';

export type DefectStage = 'INITIAL_SHIPPING' | 'AFTER_USE' | 'MISSING_PART';

export type DefectLocation = 'RIGHT_SEAT' | 'LEFT_SEAT' | 'SEAT' | 'LEGS' | 'BACK' | 'OTHER';

export type WarehouseDecision =
  | 'STOCK_AS_NEW_114'
  | 'CLASS_B'
  | 'SHAPIIM_155'
  | 'REDESIGN_208'
  | 'FROZEN_FURTHER_HANDLING'
  | 'REPAIR'
  | 'DISPOSE';

export type ImageType =
  | 'SERVICE_GENERAL_IMAGE'
  | 'SERVICE_DEFECT_IMAGE'
  | 'SERVICE_REP_SIGNATURE'
  | 'DRIVER_PRODUCT_IMAGE'
  | 'DRIVER_DISTANT_IMAGE'
  | 'DRIVER_DEFECT_IMAGE'
  | 'DRIVER_SIGNATURE'
  | 'WAREHOUSE_IMAGE';

/** Domain/seed priority values. NOTE: the create form offers NORMAL/HIGH/URGENT — see gap 5. */
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';

export const RETURN_STATUSES: readonly ReturnStatus[] = [
  'OPEN',
  'WAITING_FOR_PICKUP',
  'BARCODE_ASSIGNED',
  'PICKED_UP',
  'ARRIVED_TO_WAREHOUSE',
  'INSPECTED',
  'CLOSED',
  'NEEDS_MORE_INFO',
];

export const ITEM_CONDITIONS: readonly ItemCondition[] = [
  'LIKE_NEW_ORIGINAL_PACKAGING',
  'LIKE_NEW_NO_PACKAGING',
  'USED',
  'USED_MINOR_DEFECT',
  'SIGNIFICANTLY_DEFECTIVE',
];

export const RETURN_REASONS: readonly ReturnReason[] = [
  'NOT_AS_EXPECTED',
  'DELIVERY_ERROR',
  'SELLER_ERROR',
  'SUPPLIER_ERROR',
  'WAREHOUSE_ERROR',
  'DRIVER_ERROR',
  'CUSTOMER_NOT_HOME',
  'PRODUCT_DEFECT',
];

export const DEFECT_TYPES: readonly DefectType[] = [
  'TEAR',
  'SCRATCH',
  'BREAK',
  'MISSING_PART',
  'FADED_COLOR',
  'RUST',
  'DENT',
  'REVERSED_SIDE',
  'ELECTRONIC_FAULT',
];

export const DEFECT_STAGES: readonly DefectStage[] = [
  'INITIAL_SHIPPING',
  'AFTER_USE',
  'MISSING_PART',
];

export const DEFECT_LOCATIONS: readonly DefectLocation[] = [
  'RIGHT_SEAT',
  'LEFT_SEAT',
  'SEAT',
  'LEGS',
  'BACK',
  'OTHER',
];

export const WAREHOUSE_DECISIONS: readonly WarehouseDecision[] = [
  'STOCK_AS_NEW_114',
  'CLASS_B',
  'SHAPIIM_155',
  'REDESIGN_208',
  'FROZEN_FURTHER_HANDLING',
  'REPAIR',
  'DISPOSE',
];

export const IMAGE_TYPES: readonly ImageType[] = [
  'SERVICE_GENERAL_IMAGE',
  'SERVICE_DEFECT_IMAGE',
  'SERVICE_REP_SIGNATURE',
  'DRIVER_PRODUCT_IMAGE',
  'DRIVER_DISTANT_IMAGE',
  'DRIVER_DEFECT_IMAGE',
  'DRIVER_SIGNATURE',
  'WAREHOUSE_IMAGE',
];

/** Server-enforced transition table (ReturnRequestService.ALLOWED_TRANSITIONS). */
export const ALLOWED_TRANSITIONS: Readonly<Record<ReturnStatus, readonly ReturnStatus[]>> = {
  OPEN: ['WAITING_FOR_PICKUP', 'NEEDS_MORE_INFO'],
  WAITING_FOR_PICKUP: ['BARCODE_ASSIGNED'],
  BARCODE_ASSIGNED: ['PICKED_UP'],
  PICKED_UP: ['ARRIVED_TO_WAREHOUSE'],
  ARRIVED_TO_WAREHOUSE: ['INSPECTED', 'NEEDS_MORE_INFO'],
  INSPECTED: ['CLOSED'],
  CLOSED: [],
  NEEDS_MORE_INFO: ['WAITING_FOR_PICKUP'],
};

// ---------------------------------------------------------------------------
// DTOs (mirror com.drb.server.rest.dto.*)
// ---------------------------------------------------------------------------

export interface LoginResponse {
  token: string;
  userId: number;
  fullName: string;
  role: string;
}

export interface UserDto {
  id: number;
  phoneNumber: string;
  fullName: string;
  role: 'SERVICE_REP' | 'DRIVER' | 'WAREHOUSE' | 'MANAGER';
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerDto {
  id: number;
  fullName: string;
  phone: string;
  email: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductDto {
  id: number;
  sku: string;
  name: string;
  category: string | null;
  description: string | null;
  price: number;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DriverDto {
  id: number;
  userId: number;
  driverFullName: string;
  vehicleNumber: string | null;
  phone: string | null;
  active: boolean;
}

export interface CustomerPurchaseDto {
  id: number;
  customerId: number;
  productId: number;
  productName: string;
  productSku: string;
  productPrice: number;
  productImageUrl: string | null;
  orderNumber: string;
  quantity: number;
  originalDeliveryDate: string | null;
  underWarranty: boolean | null;
  handled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReturnImageDto {
  id: number;
  cloudinaryPublicId: string | null;
  imageUrl: string;
  imageType: ImageType;
  uploadedByUserId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface StatusHistoryDto {
  id: number;
  returnRequestId: number;
  oldStatus: ReturnStatus | null;
  newStatus: ReturnStatus;
  comment: string | null;
  changedByUserId: number | null;
  changedByUserName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PickupUpdateDto {
  id: number;
  returnRequestId: number;
  driverId: number | null;
  itemCondition: ItemCondition | null;
  defectType: DefectType | null;
  defectLocation: DefectLocation | null;
  defectLocationOther: string | null;
  signatureImageUrl: string | null;
  itemCollected: boolean | null;
  driverNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseInspectionDto {
  id: number;
  returnRequestId: number;
  inspectedByUserId: number | null;
  warehouseDecision: WarehouseDecision | null;
  itemCondition: ItemCondition | null;
  callFullyHandled: boolean | null;
  warehouseNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReturnRequestDto {
  id: number;
  barcode: string | null;
  barcodeAssignedAt: string | null;
  barcodeAssignedByDriverId: number | null;
  barcodeAssignedByDriverName: string | null;
  customerId: number | null;
  customerName: string | null;
  customerAddress: string | null;
  customerPhone: string | null;
  productId: number | null;
  productName: string | null;
  productSku: string | null;
  productPrice: number | null;
  productImageUrl: string | null;
  driverId: number | null;
  driverName: string | null;
  orderNumber: string | null;
  reason: string | null;
  defectDescription: string | null;
  priority: string | null;
  originalDeliveryDate: string | null;
  quantity: number | null;
  underWarranty: boolean | null;
  wasUsed: boolean | null;
  returnReason: ReturnReason | null;
  defectType: DefectType | null;
  defectStage: DefectStage | null;
  defectLocationText: string | null;
  status: ReturnStatus;
  createdAt: string;
  updatedAt: string;
  images?: ReturnImageDto[] | null;
}

export interface DashboardDto {
  statusCounts: Partial<Record<ReturnStatus, number>>;
  noBarcode: number;
  totalOpen: number;
  totalPickedUp: number;
  totalInspected: number;
  totalClosed: number;
}

export interface CreateReturnBody {
  customerId: number;
  productId: number;
  purchaseId?: number;
  driverId?: number | null;
  orderNumber?: string;
  reason?: string;
  defectDescription?: string;
  priority?: string;
  originalDeliveryDate?: string;
  quantity?: number;
  underWarranty?: boolean;
  wasUsed?: boolean;
  returnReason?: ReturnReason;
  defectType?: DefectType;
  defectStage?: DefectStage;
  defectLocationText?: string;
}

export interface CreateInspectionBody {
  itemCondition?: ItemCondition;
  warehouseDecision?: WarehouseDecision;
  callFullyHandled?: boolean;
  warehouseNotes?: string;
}

export interface ReturnFilter {
  status?: ReturnStatus;
  driverId?: number;
  customerId?: number;
}

export interface ErrorEnvelope {
  error: { code: string; message: string };
}

export type QueryParams = Record<string, string | number | boolean>;

// ---------------------------------------------------------------------------
// DrbApi — thin REST client + state oracle
// ---------------------------------------------------------------------------

/**
 * Bearer-authenticated REST client used ONLY for fixture setup and as a state
 * oracle. Never drive a user journey through it — that is the browser's job.
 *
 * Every `get/post/...` path is relative to `/api`, e.g. `api.get('/returns/5')`.
 * The typed helpers below throw a readable Error on any non-2xx; use `send()`
 * when the test wants to assert on the status code itself.
 */
export class DrbApi {
  constructor(
    /** Raw context, already carrying `Authorization: Bearer <token>`. */
    readonly ctx: APIRequestContext,
    readonly token: string,
    readonly role: Role,
    readonly userId: number,
    readonly fullName: string,
  ) {}

  // --- plumbing ------------------------------------------------------------

  /** Issues a request without throwing. `path` is relative to `/api`. */
  send(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    params?: QueryParams,
  ): Promise<APIResponse> {
    return this.ctx.fetch(`${API_BASE}${path}`, {
      method,
      ...(body === undefined ? {} : { data: body }),
      ...(params === undefined ? {} : { params }),
      failOnStatusCode: false,
    });
  }

  private async unwrap<T>(res: APIResponse, what: string): Promise<T> {
    if (!res.ok()) {
      throw new Error(`[api ${this.role}] ${what} -> HTTP ${res.status()}: ${await res.text()}`);
    }
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  async get<T>(path: string, params?: QueryParams): Promise<T> {
    return this.unwrap<T>(await this.send('GET', path, undefined, params), `GET ${path}`);
  }
  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.unwrap<T>(await this.send('POST', path, body), `POST ${path}`);
  }
  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.unwrap<T>(await this.send('PUT', path, body), `PUT ${path}`);
  }
  async patch<T>(path: string, body?: unknown, params?: QueryParams): Promise<T> {
    return this.unwrap<T>(await this.send('PATCH', path, body, params), `PATCH ${path}`);
  }

  /** Status code only — for negative/authorization assertions. */
  async statusCode(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<number> {
    return (await this.send(method, path, body)).status();
  }

  // --- auth ----------------------------------------------------------------

  me(): Promise<UserDto> {
    return this.get<UserDto>('/auth/me');
  }

  async logout(): Promise<void> {
    await this.send('POST', '/auth/logout');
  }

  // --- return requests -----------------------------------------------------

  getReturn(id: number): Promise<ReturnRequestDto> {
    return this.get<ReturnRequestDto>(`/returns/${id}`);
  }

  /** null instead of throwing on 404. */
  async findReturn(id: number): Promise<ReturnRequestDto | null> {
    const res = await this.send('GET', `/returns/${id}`);
    if (res.status() === 404) return null;
    return this.unwrap<ReturnRequestDto>(res, `GET /returns/${id}`);
  }

  getReturnByBarcode(barcode: string): Promise<ReturnRequestDto> {
    return this.get<ReturnRequestDto>(`/returns/by-barcode/${encodeURIComponent(barcode)}`);
  }

  async findReturnByBarcode(barcode: string): Promise<ReturnRequestDto | null> {
    const res = await this.send('GET', `/returns/by-barcode/${encodeURIComponent(barcode)}`);
    if (res.status() === 404) return null;
    return this.unwrap<ReturnRequestDto>(res, `GET /returns/by-barcode/${barcode}`);
  }

  listReturns(filter: ReturnFilter = {}): Promise<ReturnRequestDto[]> {
    const params: QueryParams = {};
    if (filter.status) params.status = filter.status;
    if (filter.driverId !== undefined) params.driverId = filter.driverId;
    if (filter.customerId !== undefined) params.customerId = filter.customerId;
    return this.get<ReturnRequestDto[]>('/returns', params);
  }

  createReturn(body: CreateReturnBody): Promise<ReturnRequestDto> {
    return this.post<ReturnRequestDto>('/returns', body);
  }

  /** Moves WAITING_FOR_PICKUP -> BARCODE_ASSIGNED and writes the barcode. */
  assignBarcode(id: number, barcode: string, driverId: number): Promise<ReturnRequestDto> {
    return this.patch<ReturnRequestDto>(`/returns/${id}/assign-barcode`, { barcode, driverId });
  }

  assignDriver(id: number, driverId: number): Promise<ReturnRequestDto> {
    return this.patch<ReturnRequestDto>(`/returns/${id}/assign-driver`, { driverId });
  }

  setStatus(id: number, status: ReturnStatus, comment?: string): Promise<ReturnRequestDto> {
    return this.patch<ReturnRequestDto>(`/returns/${id}/status`, { status, comment: comment ?? null });
  }

  setPriority(id: number, priority: string): Promise<ReturnRequestDto> {
    return this.patch<ReturnRequestDto>(`/returns/${id}/priority`, { priority });
  }

  // --- state oracles -------------------------------------------------------

  async statusOf(id: number): Promise<ReturnStatus> {
    return (await this.getReturn(id)).status;
  }

  async barcodeOf(id: number): Promise<string | null> {
    return (await this.getReturn(id)).barcode;
  }

  getStatusHistory(id: number): Promise<StatusHistoryDto[]> {
    return this.get<StatusHistoryDto[]>(`/returns/${id}/status-history`);
  }

  getTimeline(id: number): Promise<StatusHistoryDto[]> {
    return this.get<StatusHistoryDto[]>(`/returns/${id}/timeline`);
  }

  /** newStatus values in insertion order — handy for asserting timeline order. */
  async statusTrail(id: number): Promise<ReturnStatus[]> {
    const rows = await this.getStatusHistory(id);
    return [...rows].sort((a, b) => a.id - b.id).map((r) => r.newStatus);
  }

  getImages(id: number): Promise<ReturnImageDto[]> {
    return this.get<ReturnImageDto[]>(`/returns/${id}/images`);
  }

  /**
   * Attaches one image to a return — fixture setup only, so the browser has something to render.
   *
   * `POST /api/returns/{id}/images` is multipart (`file` + `imageType`) and uploads to Cloudinary,
   * which is why this cannot go through `post()`. Defaults to the shared 1x1 PNG; pass `buffer`
   * only when a test needs to tell two uploads apart by their bytes.
   */
  async uploadImage(
    returnId: number,
    imageType: ImageType,
    opts: { name?: string; buffer?: Buffer; mimeType?: string } = {},
  ): Promise<ReturnImageDto> {
    const res = await this.ctx.fetch(`${API_BASE}/returns/${returnId}/images`, {
      method: 'POST',
      multipart: {
        file: {
          name: opts.name ?? `${imageType.toLowerCase()}.png`,
          mimeType: opts.mimeType ?? 'image/png',
          buffer: opts.buffer ?? PNG_1X1,
        },
        imageType,
      },
      failOnStatusCode: false,
    });
    expect(
      res.status(),
      `upload ${imageType} to return ${returnId}: ${await res.text()}`,
    ).toBe(201);
    return (await res.json()) as ReturnImageDto;
  }

  /** Uploads one image per type, sequentially (Cloudinary rate-limits parallel bursts). */
  async uploadImages(returnId: number, types: readonly ImageType[]): Promise<void> {
    for (const type of types) await this.uploadImage(returnId, type);
  }

  async imageTypesOf(id: number): Promise<ImageType[]> {
    return (await this.getImages(id)).map((i) => i.imageType);
  }

  getPickupUpdates(id: number): Promise<PickupUpdateDto[]> {
    return this.get<PickupUpdateDto[]>(`/returns/${id}/pickup-updates`);
  }

  getInspections(id: number): Promise<WarehouseInspectionDto[]> {
    return this.get<WarehouseInspectionDto[]>(`/returns/${id}/warehouse-inspections`);
  }

  async latestInspection(id: number): Promise<WarehouseInspectionDto | null> {
    const all = await this.getInspections(id);
    if (all.length === 0) return null;
    return [...all].sort((a, b) => a.id - b.id)[all.length - 1] ?? null;
  }

  /**
   * Polls until the return reaches `status`. Use after a JSF action instead of
   * a bare read — the ajax POST may still be in flight when the click resolves.
   */
  async expectStatus(
    id: number,
    status: ReturnStatus,
    opts: { timeout?: number } = {},
  ): Promise<void> {
    await expect
      .poll(async () => (await this.getReturn(id)).status, {
        timeout: opts.timeout ?? 20_000,
        message: `return ${id} never reached ${status}`,
      })
      .toBe(status);
  }

  /** Polls until at least one image of `type` exists on the return. */
  async expectImageType(
    id: number,
    type: ImageType,
    opts: { timeout?: number } = {},
  ): Promise<void> {
    await expect
      .poll(async () => await this.imageTypesOf(id), {
        timeout: opts.timeout ?? 30_000,
        message: `return ${id} never got a ${type} image`,
      })
      .toContain(type);
  }

  // --- customers & purchases ----------------------------------------------

  getCustomer(id: number): Promise<CustomerDto> {
    return this.get<CustomerDto>(`/customers/${id}`);
  }

  getCustomerByPhone(phone: string): Promise<CustomerDto> {
    return this.get<CustomerDto>(`/customers/by-phone/${encodeURIComponent(phone)}`);
  }

  async findCustomerByPhone(phone: string): Promise<CustomerDto | null> {
    const res = await this.send('GET', `/customers/by-phone/${encodeURIComponent(phone)}`);
    if (res.status() === 404) return null;
    return this.unwrap<CustomerDto>(res, `GET /customers/by-phone/${phone}`);
  }

  listCustomers(search?: string): Promise<CustomerDto[]> {
    return this.get<CustomerDto[]>('/customers', search ? { search } : undefined);
  }

  createCustomer(body: {
    fullName: string;
    phone: string;
    email?: string;
    address?: string;
  }): Promise<CustomerDto> {
    return this.post<CustomerDto>('/customers', body);
  }

  getPurchases(customerId: number): Promise<CustomerPurchaseDto[]> {
    return this.get<CustomerPurchaseDto[]>(`/customers/${customerId}/purchases`);
  }

  async getPurchase(customerId: number, purchaseId: number): Promise<CustomerPurchaseDto | null> {
    const all = await this.getPurchases(customerId);
    return all.find((p) => p.id === purchaseId) ?? null;
  }

  /** Purchases the wizard is allowed to select (handled === false). */
  async selectablePurchases(customerId: number): Promise<CustomerPurchaseDto[]> {
    return (await this.getPurchases(customerId)).filter((p) => !p.handled);
  }

  /** Purchases the wizard must render as a non-selectable "Handled" row. */
  async handledPurchases(customerId: number): Promise<CustomerPurchaseDto[]> {
    return (await this.getPurchases(customerId)).filter((p) => p.handled);
  }

  // --- catalogs ------------------------------------------------------------

  /** MANAGER-only endpoint (`@RolesAllowed("MANAGER")` on UserResource). */
  listUsers(): Promise<UserDto[]> {
    return this.get<UserDto[]>('/users');
  }

  async findUserByPhone(phone: string): Promise<UserDto | null> {
    return (await this.listUsers()).find((u) => u.phoneNumber === phone) ?? null;
  }

  createUser(body: { phoneNumber: string; fullName: string; role: string }): Promise<UserDto> {
    return this.post<UserDto>('/users', body);
  }

  /**
   * NOTE: `active` is a QUERY parameter, not a JSON body —
   * `PATCH /api/users/{id}/active?active=false` (UserResource#setActive).
   *
   * Returns nothing: `UserResource#setActive` answers `204 No Content` with an empty body, so
   * there is no DTO to hand back. Re-read through `findUserByPhone` / `listUsers` to assert the
   * flag actually flipped.
   */
  async setUserActive(userId: number, active: boolean): Promise<void> {
    await this.patch<void>(`/users/${userId}/active`, undefined, { active });
  }

  listProducts(search?: string): Promise<ProductDto[]> {
    return this.get<ProductDto[]>('/products', search ? { search } : undefined);
  }

  createProduct(body: {
    sku: string;
    name: string;
    category?: string;
    description?: string;
    price?: number;
    imageUrl?: string;
  }): Promise<ProductDto> {
    return this.post<ProductDto>('/products', body);
  }

  listDrivers(): Promise<DriverDto[]> {
    return this.get<DriverDto[]>('/drivers');
  }

  getDriverPickups(driverId: number, filter?: { status?: ReturnStatus; date?: string }): Promise<ReturnRequestDto[]> {
    const params: QueryParams = {};
    if (filter?.status) params.status = filter.status;
    if (filter?.date) params.date = filter.date;
    return this.get<ReturnRequestDto[]>(`/drivers/${driverId}/pickups`, params);
  }

  // --- warehouse -----------------------------------------------------------

  /** GET /api/warehouse/returns/{barcode} — returns a plain ReturnRequestDto. */
  warehouseReturn(barcode: string): Promise<ReturnRequestDto> {
    return this.get<ReturnRequestDto>(`/warehouse/returns/${encodeURIComponent(barcode)}`);
  }

  markArrived(barcode: string): Promise<ReturnRequestDto> {
    return this.post<ReturnRequestDto>(`/warehouse/arrivals/${encodeURIComponent(barcode)}`);
  }

  createInspection(returnId: number, body: CreateInspectionBody): Promise<WarehouseInspectionDto> {
    return this.post<WarehouseInspectionDto>(`/returns/${returnId}/warehouse-inspections`, body);
  }

  // --- reports -------------------------------------------------------------

  dashboard(): Promise<DashboardDto> {
    return this.get<DashboardDto>('/reports/dashboard');
  }

  /** Convenience for delta assertions: count for one status right now. */
  async statusCount(status: ReturnStatus): Promise<number> {
    return (await this.dashboard()).statusCounts[status] ?? 0;
  }

  reportReturnsByStatus(): Promise<Array<Record<string, unknown>>> {
    return this.get<Array<Record<string, unknown>>>('/reports/returns-by-status');
  }
  reportWarehouseDecisions(): Promise<Array<Record<string, unknown>>> {
    return this.get<Array<Record<string, unknown>>>('/reports/warehouse-decisions');
  }
  reportMissingInfo(): Promise<Array<Record<string, unknown>>> {
    return this.get<Array<Record<string, unknown>>>('/reports/missing-info');
  }
  reportDriverPerformance(): Promise<Array<Record<string, unknown>>> {
    return this.get<Array<Record<string, unknown>>>('/reports/driver-performance');
  }
  reportDailyReturns(): Promise<Array<Record<string, unknown>>> {
    return this.get<Array<Record<string, unknown>>>('/reports/daily-returns');
  }

  async dispose(): Promise<void> {
    await this.ctx.dispose();
  }
}

/**
 * Logs `role` in over REST and returns a Bearer-authenticated client.
 * Callers own the returned instance and must `dispose()` it.
 */
export async function createApi(role: Role, baseURL: string): Promise<DrbApi> {
  const anon = await apiRequest.newContext({ baseURL, ignoreHTTPSErrors: true });
  let login: LoginResponse;
  try {
    const res = await anon.post(`${API_BASE}/auth/login`, {
      data: { phoneNumber: ROLE_PHONE[role] },
      failOnStatusCode: false,
    });
    if (!res.ok()) {
      throw new Error(
        `[api] login as ${role} (${ROLE_PHONE[role]}) failed: HTTP ${res.status()} ${await res.text()}`,
      );
    }
    login = (await res.json()) as LoginResponse;
  } finally {
    await anon.dispose();
  }

  const ctx = await apiRequest.newContext({
    baseURL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      Authorization: `Bearer ${login.token}`,
      Accept: 'application/json',
    },
  });
  return new DrbApi(ctx, login.token, role, login.userId, login.fullName);
}

export type ApiForRole = (role: Role) => Promise<DrbApi>;

export interface ApiWorkerFixtures {
  /**
   * MANAGER-authenticated client — the default state oracle. MANAGER is used
   * because it is the only role that passes `@RolesAllowed` on /api/users and
   * /api/warehouse/*, so one client can read everything.
   */
  api: DrbApi;
  /** Role-scoped client, for asserting API-level authorization. Cached per worker. */
  apiFor: ApiForRole;
}

// eslint-disable-next-line @typescript-eslint/ban-types
export const test = authTest.extend<{}, ApiWorkerFixtures>({
  api: [
    async ({}, use, workerInfo) => {
      const baseURL = workerInfo.project.use.baseURL ?? 'http://localhost:8080';
      const api = await createApi('MANAGER', baseURL);
      await use(api);
      await api.dispose();
    },
    { scope: 'worker' },
  ],

  apiFor: [
    async ({}, use, workerInfo) => {
      const baseURL = workerInfo.project.use.baseURL ?? 'http://localhost:8080';
      const cache = new Map<Role, DrbApi>();
      await use(async (role: Role) => {
        const hit = cache.get(role);
        if (hit) return hit;
        const created = await createApi(role, baseURL);
        cache.set(role, created);
        return created;
      });
      for (const client of cache.values()) await client.dispose();
    },
    { scope: 'worker' },
  ],
});
