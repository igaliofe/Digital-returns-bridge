/**
 * The single entry point every spec imports:
 *
 *     import { test, expect } from '../fixtures';
 *
 * `test` is the fully merged fixture object (auth -> api -> data). Do NOT import
 * from '@playwright/test' directly in a spec, or you lose every fixture below.
 *
 * Fixtures available on `test`:
 *
 *   worker-scoped
 *     authStates : Record<Role, string>      storageState file per role
 *     api        : DrbApi                    MANAGER-authed REST oracle
 *     apiFor     : (role) => Promise<DrbApi> role-scoped REST client
 *
 *   test-scoped
 *     page                                   the stock Playwright page — LOGGED OUT
 *     repPage / driverPage / warehousePage / managerPage : Page (logged in)
 *     pageForRole : (role) => Promise<Page>  logged in, worker session reused
 *     loginAs     : (role) => Promise<Page>  logged in, BRAND NEW session
 *     data        : DataFactory              makeReturn / claimCustomer / barcodes
 *
 * Known gaps ship as `test.fixme(...)` with a comment citing docs/e2e-findings.md.
 */

export { expect } from '@playwright/test';
export { test } from './data';

// --- auth -------------------------------------------------------------------
export {
  AUTH_STATE_DIR,
  E2E_ROOT,
  LANDING_PATH,
  LOGIN_ERROR,
  LOGIN_MESSAGES,
  LOGIN_PATH,
  LOGIN_PHONE_INPUT,
  LOGIN_SUBMIT_LABEL,
  REPO_ROOT,
  ROLE_FULL_NAME,
  ROLE_PHONE,
  ROLE_SERVER_NAME,
  ROLE_USER_ID,
  ROLES,
  loginAsRole,
  loginViaUi,
} from './auth';
export type {
  AuthTestFixtures,
  AuthWorkerFixtures,
  PageForRole,
  Role,
  ServerRole,
} from './auth';

// --- api --------------------------------------------------------------------
export {
  ALLOWED_TRANSITIONS,
  API_BASE,
  DEFECT_LOCATIONS,
  DEFECT_STAGES,
  DEFECT_TYPES,
  DrbApi,
  IMAGE_TYPES,
  ITEM_CONDITIONS,
  RETURN_REASONS,
  RETURN_STATUSES,
  WAREHOUSE_DECISIONS,
  createApi,
} from './api';
export type {
  ApiForRole,
  ApiWorkerFixtures,
  CreateInspectionBody,
  CreateReturnBody,
  CustomerDto,
  CustomerPurchaseDto,
  DashboardDto,
  DefectLocation,
  DefectStage,
  DefectType,
  DriverDto,
  ErrorEnvelope,
  ImageType,
  ItemCondition,
  LoginResponse,
  PickupUpdateDto,
  Priority,
  ProductDto,
  QueryParams,
  ReturnFilter,
  ReturnImageDto,
  ReturnReason,
  ReturnRequestDto,
  ReturnStatus,
  StatusHistoryDto,
  UserDto,
  WarehouseDecision,
  WarehouseInspectionDto,
} from './api';

// --- data -------------------------------------------------------------------
export {
  DataFactory,
  E2E_BARCODE_PREFIX,
  E2E_NAME_PREFIX,
  SEED_BARCODE_PREFIX,
  SEED_CUSTOMER_COUNT,
  SEED_CUSTOMER_NAMES,
  SEED_DRIVER_IDS,
  SEED_DRIVER_ONE,
  SEED_DRIVER_TWO,
  SEED_DRIVERS,
  SEED_PRODUCT_COUNT,
  claimCustomer,
  driverOptionLabel,
  isE2eBarcode,
  isE2eName,
  nextBarcode,
  nextPhone,
  uniqueName,
} from './data';
export type {
  ClaimedCustomer,
  DataTestFixtures,
  MakeReturnOptions,
  SeedDriver,
  SeededReturn,
} from './data';

// --- assets -----------------------------------------------------------------
export { PNG_1X1, PNG_1X1_BASE64, pngUpload, writePng } from './assets';
