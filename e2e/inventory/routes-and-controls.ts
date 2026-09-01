/**
 * ROUTE + CONTROL INVENTORY — the "every button" guarantee.
 *
 * Hand-derived by walking every `.xhtml` under `server/src/main/webapp/`.
 * Two specs consume this file:
 *
 *   routes.smoke.spec.ts  for each route x each allowed role: page loads, no 5xx, no unexpected
 *                         error-severity p:messages, no uncaught page error; every NON-conditional
 *                         control is visible+enabled; `nav` and `ajax` controls are exercised.
 *   coverage.spec.ts      scrapes every `button`, `a[href]`, `input[type=submit]` rendered on each
 *                         route and fails when something is NOT matched by any control `selector`
 *                         and NOT matched by a chrome selector.
 *
 * ROLES ENCODED HERE ARE THE **INTENDED** ROLES FROM THE PLAN, not what the code does today.
 * `RoleAuthFilter` currently ignores `user.getRole()` and `layout.xhtml` renders all six nav links
 * to everybody — see `gap` on the affected entries and docs/e2e-findings.md.
 */

import type { Role } from '../fixtures';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Route ids are stable slugs; use `routeById` / `ROUTE_BY_ID` to look one up. */
export type RouteId =
  | 'login'
  | 'dashboard'
  | 'returns-list'
  | 'return-details'
  | 'create-return'
  | 'wizard-step1'
  | 'wizard-step2'
  | 'wizard-step3'
  | 'warehouse-receiving'
  | 'reports'
  | 'admin-users'
  | 'admin-customers'
  | 'admin-purchases'
  | 'admin-products'
  | 'admin-drivers';

/**
 * `nav`         — click leaves the page (GET link, `p:button`, or an action returning a
 *                 `?faces-redirect=true` outcome). `targetPath` says where it should land.
 * `ajax`        — click acts in place: a PrimeFaces ajax post, or a pure client-side widget call
 *                 (`Clear Signature`, dialog `Cancel`). Never navigates.
 * `dialog`      — click opens a `p:dialog`; `opensDialog` is the dialog's CSS selector.
 * `destructive` — click deletes a row. Always guarded by a native `confirm()` (`confirms`).
 */
export type ControlKind = 'nav' | 'ajax' | 'dialog' | 'destructive';

export interface ControlSpec {
  /** Unique within its route. Stable — specs may reference it. */
  readonly id: string;
  /** Visible label, or the `title` attribute for icon-only buttons. */
  readonly label: string;
  readonly kind: ControlKind;
  /** Rendered element. Icon-only PrimeFaces buttons get `<span>ui-button</span>` as their
   *  text content, so their accessible name is unusable — match those by `selector`. */
  readonly element: 'button' | 'link';
  /** Client id of the owning `h:form`, or null when the control sits outside a named form
   *  (layout links, `p:button` GET buttons, the unnamed `h:form` on returns/details.xhtml). */
  readonly formId: string | null;
  /** Playwright selector that resolves the control. CSS engine (`:has-text`, `:text-is` allowed). */
  readonly selector: string;
  /** What clicking it must do. Free text — the smoke spec asserts the structured fields below. */
  readonly effect: string;
  /** `nav` only: path the click must land on. `:id` means "an id path param". */
  readonly targetPath?: string;
  /** `nav` only: the route reached. When the acting role may NOT access that route, the smoke
   *  spec expects the role-denial outcome (redirect) instead of `targetPath`. */
  readonly targetRouteId?: RouteId;
  /** `dialog` only: CSS selector of the dialog that must become visible. */
  readonly opensDialog?: string;
  /** Native `confirm()` text that must be accepted for the action to run. */
  readonly confirms?: string;
  /** True when the control renders only under some server state (a table row exists, the return
   *  is in a given status, a row is in edit mode). The smoke spec must not require visibility. */
  readonly conditional?: boolean;
  /** Precondition prose for `conditional` controls. */
  readonly requiresState?: string;
  /** Roles that should SEE this control. Omitted = every role in the route's `allowedRoles`. */
  readonly roles?: readonly Role[];
  /** Known gap number from docs/e2e-findings.md that this control currently violates. */
  readonly gap?: number;
}

export interface RouteSpec {
  readonly id: RouteId;
  readonly path: string;
  /** Substring of the `<title>` element. */
  readonly title: string;
  /** Roles the plan's role->route matrix says may open this route. */
  readonly allowedRoles: readonly Role[];
  /** Complement of `allowedRoles` — each must be redirected, never 500, never rendered. */
  readonly deniedRoles: readonly Role[];
  /** Query string the route needs to render (appended verbatim, includes the leading `?`). */
  readonly sampleQuery?: string;
  /** Set when the route only exists to bounce elsewhere (`/returns/create.xhtml`). */
  readonly redirectsTo?: string;
  /** True when this route renders inside `WEB-INF/templates/layout.xhtml` (i.e. has the nav bar). */
  readonly usesLayout: boolean;
  /** Route-specific controls. Layout nav is in `LAYOUT_CONTROLS`, spread in by `controlsOn`. */
  readonly controls: readonly ControlSpec[];
  /** Extra framework-chrome selectors to ignore on this route, on top of `PF_CHROME_SELECTORS`. */
  readonly chromeSelectors?: readonly string[];
}

// ---------------------------------------------------------------------------
// Role sets
// ---------------------------------------------------------------------------

const ALL: readonly Role[] = ['REP', 'DRIVER', 'WAREHOUSE', 'MANAGER'];
const WIZARD_ROLES: readonly Role[] = ['REP', 'DRIVER', 'MANAGER'];
const WAREHOUSE_ROLES: readonly Role[] = ['WAREHOUSE', 'MANAGER'];
const MANAGER_ONLY: readonly Role[] = ['MANAGER'];

const denied = (allowed: readonly Role[]): readonly Role[] => ALL.filter((r) => !allowed.includes(r));

// ---------------------------------------------------------------------------
// Framework chrome — rendered by PrimeFaces, never authored in an .xhtml.
// coverage.spec.ts ignores anything matching one of these.
// ---------------------------------------------------------------------------

export const PF_CHROME_SELECTORS: readonly string[] = [
  // p:messages / p:message close icons
  '.ui-messages-close',
  '.ui-message-close',
  // p:dataTable paginator
  '.ui-paginator a',
  '.ui-paginator button',
  '.ui-paginator-rpp-options',
  // p:dataTable sorting / filtering / row-toggle chrome
  '.ui-sortable-column',
  '.ui-column-filter',
  '.ui-row-toggler',
  // p:dialog title bar
  '.ui-dialog-titlebar a',
  '.ui-dialog-titlebar-icon',
  '.ui-dialog-titlebar-close',
  // p:selectOneMenu
  '.ui-selectonemenu-trigger',
  '.ui-selectonemenu-panel a',
  '.ui-selectonemenu-item',
  // p:datePicker (showIcon + the popup panel)
  '.ui-datepicker-trigger',
  '.ui-datepicker a',
  '.ui-datepicker button',
  // p:galleria navigation
  '.ui-galleria button',
  '.ui-galleria a',
  // p:panel / p:fieldset togglers (not used today, cheap insurance)
  '.ui-panel-titlebar-icon',
  '.ui-fieldset-toggler',
  // PrimeFaces skip-link / hidden accessibility helpers
  '.ui-helper-hidden-accessible a',
  '.ui-helper-hidden-accessible button',
];

// ---------------------------------------------------------------------------
// Layout (WEB-INF/templates/layout.xhtml) — present on every route except /login.xhtml
// ---------------------------------------------------------------------------

export const LAYOUT_CONTROLS: readonly ControlSpec[] = [
  {
    id: 'layout-logo',
    label: "Tollman's",
    kind: 'nav',
    element: 'link',
    formId: null,
    selector: 'a.drb-logo',
    effect: 'Brand link back to the dashboard.',
    targetPath: '/dashboard.xhtml',
    targetRouteId: 'dashboard',
  },
  {
    id: 'nav-dashboard',
    label: 'Dashboard',
    kind: 'nav',
    element: 'link',
    formId: null,
    selector: '[data-testid="nav-dashboard"]',
    effect: 'Nav link to the dashboard; gets .drb-nav-active while on it.',
    targetPath: '/dashboard.xhtml',
    targetRouteId: 'dashboard',
  },
  {
    id: 'nav-returns',
    label: 'Returns',
    kind: 'nav',
    element: 'link',
    formId: null,
    selector: '[data-testid="nav-returns"]',
    effect: 'Nav link to the returns list; active on /returns/list and /returns/details.',
    targetPath: '/returns/list.xhtml',
    targetRouteId: 'returns-list',
  },
  {
    id: 'nav-new-return',
    label: 'New Return',
    kind: 'nav',
    element: 'link',
    formId: null,
    selector: '[data-testid="nav-new-return"]',
    effect: 'Nav link to the wizard entry point, which bounces to step 1.',
    targetPath: '/returns/create/identify-customer.xhtml',
    targetRouteId: 'wizard-step1',
    roles: WIZARD_ROLES,
    gap: 2,
  },
  {
    id: 'nav-warehouse',
    label: 'Warehouse',
    kind: 'nav',
    element: 'link',
    formId: null,
    selector: '[data-testid="nav-warehouse"]',
    effect: 'Nav link to warehouse receiving.',
    targetPath: '/warehouse/receiving.xhtml',
    targetRouteId: 'warehouse-receiving',
    roles: WAREHOUSE_ROLES,
    gap: 2,
  },
  {
    id: 'nav-reports',
    label: 'Reports',
    kind: 'nav',
    element: 'link',
    formId: null,
    selector: '[data-testid="nav-reports"]',
    effect: 'Nav link to reports & KPIs.',
    targetPath: '/reports.xhtml',
    targetRouteId: 'reports',
    roles: MANAGER_ONLY,
    gap: 2,
  },
  {
    id: 'nav-admin',
    label: 'Admin ▾',
    kind: 'nav',
    element: 'link',
    formId: null,
    selector: '[data-testid="nav-admin"]',
    effect: 'Dropdown trigger; it is itself a link to /admin/users.xhtml. Hover/focus reveals .drb-admin-menu.',
    targetPath: '/admin/users.xhtml',
    targetRouteId: 'admin-users',
    roles: MANAGER_ONLY,
    gap: 2,
  },
  {
    id: 'nav-admin-users',
    label: 'Users',
    kind: 'nav',
    element: 'link',
    formId: null,
    selector: '[data-testid="nav-admin-users"]',
    effect: 'Admin submenu link. Hidden by CSS (display:none) until .drb-admin-dropdown is hovered/focused.',
    targetPath: '/admin/users.xhtml',
    targetRouteId: 'admin-users',
    roles: MANAGER_ONLY,
    conditional: true,
    requiresState: 'admin dropdown hovered or focus-within',
    gap: 2,
  },
  {
    id: 'nav-admin-customers',
    label: 'Customers',
    kind: 'nav',
    element: 'link',
    formId: null,
    selector: '[data-testid="nav-admin-customers"]',
    effect: 'Admin submenu link.',
    targetPath: '/admin/customers.xhtml',
    targetRouteId: 'admin-customers',
    roles: MANAGER_ONLY,
    conditional: true,
    requiresState: 'admin dropdown hovered or focus-within',
    gap: 2,
  },
  {
    id: 'nav-admin-purchases',
    label: 'Purchases',
    kind: 'nav',
    element: 'link',
    formId: null,
    selector: '[data-testid="nav-admin-purchases"]',
    effect: 'Admin submenu link.',
    targetPath: '/admin/purchases.xhtml',
    targetRouteId: 'admin-purchases',
    roles: MANAGER_ONLY,
    conditional: true,
    requiresState: 'admin dropdown hovered or focus-within',
    gap: 2,
  },
  {
    id: 'nav-admin-products',
    label: 'Products',
    kind: 'nav',
    element: 'link',
    formId: null,
    selector: '[data-testid="nav-admin-products"]',
    effect: 'Admin submenu link.',
    targetPath: '/admin/products.xhtml',
    targetRouteId: 'admin-products',
    roles: MANAGER_ONLY,
    conditional: true,
    requiresState: 'admin dropdown hovered or focus-within',
    gap: 2,
  },
  {
    id: 'nav-admin-drivers',
    label: 'Drivers',
    kind: 'nav',
    element: 'link',
    formId: null,
    selector: '[data-testid="nav-admin-drivers"]',
    effect: 'Admin submenu link.',
    targetPath: '/admin/drivers.xhtml',
    targetRouteId: 'admin-drivers',
    roles: MANAGER_ONLY,
    conditional: true,
    requiresState: 'admin dropdown hovered or focus-within',
    gap: 2,
  },
  {
    id: 'logout',
    label: 'Logout',
    kind: 'nav',
    element: 'link',
    formId: 'logoutForm',
    selector: '[data-testid="logout-link"]',
    effect:
      'h:commandLink -> LoginBean.logout(): revokes the API token, invalidates the HttpSession, ' +
      'redirects to /login.xhtml. The back button must not re-enter the app afterwards.',
    targetPath: '/login.xhtml',
    targetRouteId: 'login',
  },
];

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const ROUTES: readonly RouteSpec[] = [
  // -------------------------------------------------------------------------
  {
    id: 'login',
    path: '/login.xhtml',
    title: 'Login',
    allowedRoles: ALL,
    deniedRoles: [],
    usesLayout: false,
    controls: [
      {
        id: 'sign-in',
        label: 'Sign In',
        kind: 'ajax',
        element: 'button',
        formId: 'loginForm',
        selector: '#loginForm button:has-text("Sign In")',
        effect:
          'LoginBean.login(): unknown/inactive phone -> error detail inside #loginForm\\:msgs and NO ' +
          'navigation; empty phone -> "Phone number is required". A valid phone redirects to ' +
          '/warehouse/receiving.xhtml for WAREHOUSE and /dashboard.xhtml for every other role.',
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    id: 'dashboard',
    path: '/dashboard.xhtml',
    title: 'Dashboard',
    allowedRoles: ALL,
    deniedRoles: [],
    usesLayout: true,
    controls: [
      {
        id: 'new-return',
        label: 'New Return',
        kind: 'nav',
        element: 'button',
        formId: null,
        selector: 'button:has-text("New Return")',
        effect: 'p:button GET to the wizard entry point, which bounces to step 1.',
        targetPath: '/returns/create/identify-customer.xhtml',
        targetRouteId: 'wizard-step1',
      },
      {
        id: 'view-all-returns',
        label: 'View All Returns',
        kind: 'nav',
        element: 'button',
        formId: null,
        selector: 'button:has-text("View All Returns")',
        effect: 'p:button GET to the returns list.',
        targetPath: '/returns/list.xhtml',
        targetRouteId: 'returns-list',
      },
      {
        id: 'reports',
        label: 'Reports',
        kind: 'nav',
        element: 'button',
        formId: null,
        selector: 'button:has-text("Reports")',
        effect: 'p:button GET to /reports.xhtml. Non-MANAGER roles must be redirected by the route guard.',
        targetPath: '/reports.xhtml',
        targetRouteId: 'reports',
      },
      {
        id: 'warehouse-receiving',
        label: 'Warehouse Receiving',
        kind: 'nav',
        element: 'button',
        formId: null,
        selector: 'button:has-text("Warehouse Receiving")',
        effect:
          'p:button GET to /warehouse/receiving.xhtml. REP/DRIVER must be redirected by the route guard.',
        targetPath: '/warehouse/receiving.xhtml',
        targetRouteId: 'warehouse-receiving',
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    id: 'returns-list',
    path: '/returns/list.xhtml',
    title: 'Returns List',
    allowedRoles: ALL,
    deniedRoles: [],
    usesLayout: true,
    controls: [
      {
        id: 'apply-filters',
        label: 'Apply Filters',
        kind: 'ajax',
        element: 'button',
        formId: 'filterForm',
        selector: '#filterForm button:has-text("Apply Filters")',
        effect:
          'ReturnListBean.load(): re-queries with status / driver / customer-query / barcode / ' +
          'no-barcode filters and updates returnsTable + filterForm in place. No navigation.',
      },
      {
        id: 'row-view',
        label: 'View',
        kind: 'nav',
        element: 'link',
        formId: 'filterForm',
        selector: '#filterForm a.drb-link-view',
        effect: 'Per-row GET link to /returns/details.xhtml?id=<row id>.',
        targetPath: '/returns/details.xhtml?id=:id',
        targetRouteId: 'return-details',
        conditional: true,
        requiresState: 'at least one return row on the current page',
      },
    ],
    chromeSelectors: ['#filterForm\\:returnsTable .ui-paginator a'],
  },

  // -------------------------------------------------------------------------
  {
    id: 'return-details',
    path: '/returns/details.xhtml',
    title: 'Return Details',
    allowedRoles: ALL,
    deniedRoles: [],
    sampleQuery: '?id=1',
    usesLayout: true,
    controls: [
      {
        id: 'back-to-list',
        label: 'Back to List',
        kind: 'nav',
        element: 'button',
        formId: null,
        selector: 'button:has-text("Back to List")',
        effect: 'p:button GET back to the returns list. Sits inside the page\'s UNNAMED h:form (j_idt*).',
        targetPath: '/returns/list.xhtml',
        targetRouteId: 'returns-list',
        conditional: true,
        requiresState: 'a return was found for ?id= (the whole body is inside rendered="returnRequest != null")',
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    id: 'create-return',
    path: '/returns/create.xhtml',
    title: 'New Return Request',
    allowedRoles: WIZARD_ROLES,
    deniedRoles: denied(WIZARD_ROLES),
    redirectsTo: '/returns/create/identify-customer.xhtml',
    usesLayout: false,
    controls: [],
  },

  // -------------------------------------------------------------------------
  {
    id: 'wizard-step1',
    path: '/returns/create/identify-customer.xhtml',
    title: 'Identify Customer',
    allowedRoles: WIZARD_ROLES,
    deniedRoles: denied(WIZARD_ROLES),
    usesLayout: true,
    controls: [
      {
        id: 'find-customer',
        label: 'Find Customer →',
        kind: 'nav',
        element: 'button',
        formId: 'identifyForm',
        selector: '#identifyForm button:has-text("Find Customer")',
        effect:
          'CreateReturnWizardBean.lookupCustomer(): a known phone redirects to step 2; an unknown ' +
          'phone stays put with "Customer not found for phone: <n>"; blank -> "Phone number is required".',
        targetPath: '/returns/create/select-item.xhtml',
        targetRouteId: 'wizard-step2',
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    id: 'wizard-step2',
    path: '/returns/create/select-item.xhtml',
    title: 'Item Selection',
    allowedRoles: WIZARD_ROLES,
    deniedRoles: denied(WIZARD_ROLES),
    usesLayout: true,
    controls: [
      {
        id: 'select-purchase',
        label: 'Select',
        kind: 'nav',
        element: 'button',
        formId: 'selectForm',
        selector: '#selectForm button:has-text("Select")',
        effect:
          'CreateReturnWizardBean.selectPurchase(id): copies product/order/qty/delivery/warranty onto ' +
          'the wizard and redirects to step 3. Rendered ONLY on rows with handled=false; handled rows ' +
          'show an em dash and a "Handled" chip instead.',
        targetPath: '/returns/create/new-return.xhtml',
        targetRouteId: 'wizard-step3',
        conditional: true,
        requiresState: 'the customer has at least one purchase with handled=false',
      },
      {
        id: 'back',
        label: 'Back',
        kind: 'nav',
        element: 'button',
        formId: 'selectForm',
        selector: '#selectForm button:has-text("Back")',
        effect: 'CreateReturnWizardBean.backToStep1(): redirect to step 1, wizard state preserved.',
        targetPath: '/returns/create/identify-customer.xhtml',
        targetRouteId: 'wizard-step1',
      },
      {
        id: 'cancel',
        label: 'Cancel',
        kind: 'nav',
        element: 'button',
        formId: null,
        selector: '#selectForm button:has-text("Cancel")',
        effect: 'p:button GET out of the wizard to the returns list. Does NOT reset the wizard bean.',
        targetPath: '/returns/list.xhtml',
        targetRouteId: 'returns-list',
      },
      {
        id: 'add-purchase',
        label: 'Add Purchase',
        kind: 'dialog',
        element: 'button',
        formId: 'selectForm',
        selector: '[data-testid="add-purchase"]',
        effect:
          'CreateReturnWizardBean.prepareAddPurchase() then PF shows #addPurchaseDialog with a blank ' +
          'purchase. Escape hatch for a customer with no history: without a handled=false purchase row ' +
          'the wizard cannot reach step 3 at all.',
        opensDialog: '#addPurchaseDialog',
      },
      {
        id: 'add-purchase-save',
        label: 'Save',
        kind: 'ajax',
        element: 'button',
        formId: 'addPurchaseForm',
        selector: '#addPurchaseForm button:has-text("Save")',
        effect:
          'CreateReturnWizardBean.saveNewPurchase(): persists the purchase for the identified ' +
          'customer, re-renders selectForm so the new row appears with a "Select" link, and hides the ' +
          'dialog. On validation failure the dialog STAYS OPEN and the messages show.',
        conditional: true,
        requiresState: 'the Add Purchase dialog is open',
      },
      {
        id: 'add-purchase-cancel',
        label: 'Cancel',
        kind: 'ajax',
        element: 'button',
        formId: 'addPurchaseForm',
        selector: '#addPurchaseForm button:has-text("Cancel")',
        effect: 'type="button" + PF(\'addPurchaseDlg\').hide() — pure client-side close, no post.',
        conditional: true,
        requiresState: 'the Add Purchase dialog is open',
      },
    ],
    chromeSelectors: ['#selectForm\\:purchasesTable .ui-paginator a'],
  },

  // -------------------------------------------------------------------------
  {
    id: 'wizard-step3',
    path: '/returns/create/new-return.xhtml',
    title: 'New Return Request',
    allowedRoles: WIZARD_ROLES,
    deniedRoles: denied(WIZARD_ROLES),
    usesLayout: true,
    controls: [
      {
        id: 'clear-signature',
        label: 'Clear Signature',
        kind: 'ajax',
        element: 'button',
        formId: 'createForm',
        selector: '#createForm button:has-text("Clear Signature")',
        effect:
          'type="button", client-side only: PF("sigPad").clear() wipes the canvas and blanks the ' +
          'hidden <clientId>_value input. No request is sent.',
      },
      {
        id: 'create',
        label: 'Create Return Request',
        kind: 'nav',
        element: 'button',
        formId: 'createForm',
        selector: '#createForm button:has-text("Create Return Request")',
        effect:
          'CreateReturnWizardBean.create(): POST /api/returns with purchaseId (flips purchase.handled), ' +
          'uploads SERVICE_GENERAL_IMAGE / SERVICE_DEFECT_IMAGE / SERVICE_REP_SIGNATURE, optional ' +
          'assign-driver, status WAITING_FOR_PICKUP, then redirects to /returns/details.xhtml?id=N. ' +
          'Missing returnReason or Notes fails validation in place; a defective/used item with no ' +
          'photo fails with "Defective or used items require at least one ... photo.".',
        targetPath: '/returns/details.xhtml?id=:id',
        targetRouteId: 'return-details',
      },
      {
        id: 'back',
        label: 'Back',
        kind: 'nav',
        element: 'button',
        formId: 'createForm',
        selector: '#createForm button:has-text("Back")',
        effect: 'CreateReturnWizardBean.backToStep2(): reloads purchases and redirects to step 2.',
        targetPath: '/returns/create/select-item.xhtml',
        targetRouteId: 'wizard-step2',
      },
      {
        id: 'cancel',
        label: 'Cancel',
        kind: 'nav',
        element: 'button',
        formId: null,
        selector: '#createForm button:has-text("Cancel")',
        effect: 'p:button GET out of the wizard to the returns list.',
        targetPath: '/returns/list.xhtml',
        targetRouteId: 'returns-list',
      },
    ],
    chromeSelectors: ['.ui-datepicker-trigger', '.ui-datepicker a'],
  },

  // -------------------------------------------------------------------------
  {
    id: 'warehouse-receiving',
    path: '/warehouse/receiving.xhtml',
    title: 'Warehouse Receiving',
    allowedRoles: WAREHOUSE_ROLES,
    deniedRoles: denied(WAREHOUSE_ROLES),
    usesLayout: true,
    controls: [
      {
        id: 'search',
        label: 'Search',
        kind: 'ajax',
        element: 'button',
        formId: 'searchForm',
        selector: '#searchForm button:has-text("Search")',
        effect:
          'WarehouseReceivingBean.searchByBarcode(): GET /api/warehouse/returns/{barcode}. Unknown ' +
          'barcode -> error "No return request found with barcode: X" in #searchForm\\:searchMessages ' +
          'and no digital file. Known barcode renders the digital file panel. Updates searchForm, ' +
          'digitalFile and inspectionForm.',
      },
      {
        id: 'mark-arrived',
        label: 'Mark as Arrived',
        kind: 'ajax',
        element: 'button',
        formId: 'digitalFile',
        selector: '#digitalFile button:has-text("Mark as Arrived")',
        effect:
          'POST /api/warehouse/arrivals/{barcode}: status PICKED_UP -> ARRIVED_TO_WAREHOUSE, info ' +
          'message "Marked as arrived", and the inspection form appears.',
        confirms: 'Mark this return as arrived at warehouse?',
        conditional: true,
        requiresState: 'a return is loaded and its status is PICKED_UP',
      },
      {
        id: 'request-more-info',
        label: 'Request More Info',
        kind: 'ajax',
        element: 'button',
        formId: 'digitalFile',
        selector: '#digitalFile button:has-text("Request More Info")',
        effect:
          'WarehouseService.requestMoreInfo(): status ARRIVED_TO_WAREHOUSE -> NEEDS_MORE_INFO with ' +
          'info message "More info requested".',
        confirms: 'Send this return back for more info?',
        conditional: true,
        requiresState: 'a return is loaded and its status is ARRIVED_TO_WAREHOUSE',
      },
      {
        id: 'save-inspection',
        label: 'Save Inspection',
        kind: 'ajax',
        element: 'button',
        formId: 'inspectionForm',
        selector: '#inspectionForm button:has-text("Save Inspection")',
        effect:
          'POST /api/returns/{id}/warehouse-inspections with itemCondition + warehouseDecision ' +
          '(both required) -> status INSPECTED and info message "Inspection saved". With ' +
          '"Call Fully Handled" ticked the server chains on to CLOSED.',
        conditional: true,
        requiresState: 'a return is loaded and its status is ARRIVED_TO_WAREHOUSE or INSPECTED',
      },
    ],
    chromeSelectors: ['.ui-galleria button', '.ui-galleria a'],
  },

  // -------------------------------------------------------------------------
  {
    id: 'reports',
    path: '/reports.xhtml',
    title: 'Reports',
    allowedRoles: MANAGER_ONLY,
    deniedRoles: denied(MANAGER_ONLY),
    usesLayout: true,
    // Reports is read-only: 9 KPI tiles + 4 non-toggleable p:panel tables. No page controls at all.
    controls: [],
  },

  // -------------------------------------------------------------------------
  {
    id: 'admin-users',
    path: '/admin/users.xhtml',
    title: 'Users Admin',
    allowedRoles: MANAGER_ONLY,
    deniedRoles: denied(MANAGER_ONLY),
    usesLayout: true,
    controls: adminControls({
      formId: 'usersForm',
      dialogForm: 'createUserForm',
      newLabel: 'New User',
      entity: 'user',
      confirmPrefix: 'Delete user',
    }),
    chromeSelectors: ['#usersForm\\:usersTable .ui-paginator a'],
  },

  // -------------------------------------------------------------------------
  {
    id: 'admin-customers',
    path: '/admin/customers.xhtml',
    title: 'Customers Admin',
    allowedRoles: MANAGER_ONLY,
    deniedRoles: denied(MANAGER_ONLY),
    usesLayout: true,
    controls: adminControls({
      formId: 'customersForm',
      dialogForm: 'createCustomerForm',
      newLabel: 'New Customer',
      entity: 'customer',
      confirmPrefix: 'Delete customer',
    }),
    chromeSelectors: ['#customersForm\\:customersTable .ui-paginator a'],
  },

  // -------------------------------------------------------------------------
  {
    // Not built from adminControls(): purchases.xhtml is read-only + create. The table has no
    // row editor and no Delete — a purchase row is consumed by the wizard (handled=true), never
    // removed. So this route has exactly three controls.
    id: 'admin-purchases',
    path: '/admin/purchases.xhtml',
    title: 'Purchases Admin',
    allowedRoles: MANAGER_ONLY,
    deniedRoles: denied(MANAGER_ONLY),
    usesLayout: true,
    controls: [
      {
        id: 'new',
        label: 'New Purchase',
        kind: 'dialog',
        element: 'button',
        formId: 'purchasesForm',
        selector: '#purchasesForm button:has-text("New Purchase")',
        effect: 'PurchaseAdminBean.prepareCreate() then PF shows the create dialog with a blank purchase.',
        opensDialog: '#createDialog',
      },
      {
        id: 'dialog-save',
        label: 'Save',
        kind: 'ajax',
        element: 'button',
        formId: 'createPurchaseForm',
        selector: '#createPurchaseForm button:has-text("Save")',
        effect:
          'saveNew(): creates the purchase, adds info "Purchase created", refreshes the table and ' +
          'hides the dialog. When a required field is blank, validation fails, the dialog STAYS OPEN ' +
          'and the required message shows.',
        conditional: true,
        requiresState: 'the create dialog is open',
      },
      {
        id: 'dialog-cancel',
        label: 'Cancel',
        kind: 'ajax',
        element: 'button',
        formId: 'createPurchaseForm',
        selector: '#createPurchaseForm button:has-text("Cancel")',
        effect: 'Client-side PF hide() — closes the dialog without posting.',
        conditional: true,
        requiresState: 'the create dialog is open',
      },
    ],
    chromeSelectors: ['#purchasesForm\\:purchasesTable .ui-paginator a'],
  },

  // -------------------------------------------------------------------------
  {
    id: 'admin-products',
    path: '/admin/products.xhtml',
    title: 'Products Admin',
    allowedRoles: MANAGER_ONLY,
    deniedRoles: denied(MANAGER_ONLY),
    usesLayout: true,
    controls: adminControls({
      formId: 'productsForm',
      dialogForm: 'createProductForm',
      newLabel: 'New Product',
      entity: 'product',
      confirmPrefix: 'Delete product',
    }),
    chromeSelectors: ['#productsForm\\:productsTable .ui-paginator a'],
  },

  // -------------------------------------------------------------------------
  {
    id: 'admin-drivers',
    path: '/admin/drivers.xhtml',
    title: 'Drivers Admin',
    allowedRoles: MANAGER_ONLY,
    deniedRoles: denied(MANAGER_ONLY),
    usesLayout: true,
    controls: adminControls({
      formId: 'driversForm',
      dialogForm: 'createDriverForm',
      newLabel: 'New Driver',
      entity: 'driver',
      // drivers.xhtml has no #{d.name} in the confirm text
      confirmPrefix: 'Delete this driver?',
    }),
    chromeSelectors: ['#driversForm\\:driversTable .ui-paginator a'],
  },
];

/**
 * The four admin screens are structurally identical: toolbar "New X" -> p:dialog, a row-editable
 * p:dataTable with pencil/check/close row editors and an icon-only Delete, and Save/Cancel in the
 * dialog. Only ids, labels and the confirm() text differ.
 */
function adminControls(cfg: {
  formId: string;
  dialogForm: string;
  newLabel: string;
  entity: string;
  confirmPrefix: string;
}): readonly ControlSpec[] {
  const form = `#${cfg.formId}`;
  const dialogForm = `#${cfg.dialogForm}`;
  return [
    {
      id: 'new',
      label: cfg.newLabel,
      kind: 'dialog',
      element: 'button',
      formId: cfg.formId,
      selector: `${form} button:has-text("${cfg.newLabel}")`,
      effect: `prepareCreate() then PF shows the create dialog with a blank ${cfg.entity}.`,
      opensDialog: '#createDialog',
    },
    {
      id: 'row-edit',
      label: 'Edit',
      kind: 'ajax',
      element: 'link',
      formId: cfg.formId,
      selector: `${form} .ui-row-editor-pencil`,
      effect: `rowEditInit -> setSelected(row); the row switches its cell editors to input mode.`,
      conditional: true,
      requiresState: 'at least one row on the current page',
    },
    {
      id: 'row-save',
      label: 'Save',
      kind: 'ajax',
      element: 'link',
      formId: cfg.formId,
      selector: `${form} .ui-row-editor-check`,
      effect:
        `rowEdit -> the edited ${cfg.entity} must be PERSISTED ("${cfg.entity[0].toUpperCase()}` +
        `${cfg.entity.slice(1)} updated") and survive a reload.`,
      conditional: true,
      requiresState: 'the row is in edit mode (hidden with display:none otherwise)',
      gap: 3,
    },
    {
      id: 'row-cancel',
      label: 'Cancel',
      kind: 'ajax',
      element: 'link',
      formId: cfg.formId,
      selector: `${form} .ui-row-editor-close`,
      effect: 'Leaves edit mode and restores the original cell values; nothing is persisted.',
      conditional: true,
      requiresState: 'the row is in edit mode (hidden with display:none otherwise)',
    },
    {
      id: 'row-delete',
      label: 'Delete',
      kind: 'destructive',
      element: 'button',
      formId: cfg.formId,
      // Icon-only p:commandButton: PrimeFaces emits <span class="ui-button-text">ui-button</span>,
      // so the accessible name is useless. Match on the title attribute.
      selector: `${form} button[title="Delete"]`,
      effect: `delete${cfg.entity[0].toUpperCase()}${cfg.entity.slice(1)}(id): row disappears, ` +
        `info message "${cfg.entity[0].toUpperCase()}${cfg.entity.slice(1)} deleted", and GET ` +
        `/api/${cfg.entity}s no longer returns it. There is NO REST delete endpoint — this is the ` +
        `only way to remove a row.`,
      confirms: cfg.confirmPrefix,
      conditional: true,
      requiresState: 'at least one row on the current page',
    },
    {
      id: 'dialog-save',
      label: 'Save',
      kind: 'ajax',
      element: 'button',
      formId: cfg.dialogForm,
      selector: `${dialogForm} button:has-text("Save")`,
      effect:
        `saveNew(): creates the ${cfg.entity}, adds info "${cfg.entity[0].toUpperCase()}` +
        `${cfg.entity.slice(1)} created", refreshes the table and hides the dialog. When a required ` +
        `field is blank, validation fails, the dialog STAYS OPEN and the required message shows.`,
      conditional: true,
      requiresState: 'the create dialog is open',
    },
    {
      id: 'dialog-cancel',
      label: 'Cancel',
      kind: 'ajax',
      element: 'button',
      formId: cfg.dialogForm,
      selector: `${dialogForm} button:has-text("Cancel")`,
      effect: 'type="button", client-side only: hides the dialog. Nothing is created.',
      conditional: true,
      requiresState: 'the create dialog is open',
    },
  ];
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export const ROUTE_IDS: readonly RouteId[] = ROUTES.map((r) => r.id);

export const ROUTE_BY_ID: Readonly<Record<RouteId, RouteSpec>> = Object.fromEntries(
  ROUTES.map((r) => [r.id, r]),
) as Record<RouteId, RouteSpec>;

export function routeById(id: RouteId): RouteSpec {
  const route = ROUTE_BY_ID[id];
  if (!route) throw new Error(`Unknown route id: ${id}`);
  return route;
}

export function routeByPath(path: string): RouteSpec | undefined {
  const clean = path.split('?')[0];
  return ROUTES.find((r) => r.path === clean);
}

/** Routes the role may open, per the plan's role -> route matrix. */
export function routesForRole(role: Role): readonly RouteSpec[] {
  return ROUTES.filter((r) => r.allowedRoles.includes(role));
}

/** Routes the role must be redirected away from. */
export function deniedRoutesForRole(role: Role): readonly RouteSpec[] {
  return ROUTES.filter((r) => r.deniedRoles.includes(role));
}

/** Path with `sampleQuery` appended — what the smoke spec should actually navigate to. */
export function sampleUrl(route: RouteSpec): string {
  return route.sampleQuery ? `${route.path}${route.sampleQuery}` : route.path;
}

/**
 * Every control on the route: layout nav (when `usesLayout`) plus the route's own controls.
 * Pass `role` to drop layout links the role should not see; pass `includeConditional: false`
 * to keep only controls that must be visible on a plain page load.
 */
export function controlsOn(
  id: RouteId,
  opts: { role?: Role; includeConditional?: boolean } = {},
): readonly ControlSpec[] {
  const route = routeById(id);
  const { role, includeConditional = true } = opts;
  const all = route.usesLayout ? [...LAYOUT_CONTROLS, ...route.controls] : [...route.controls];
  return all.filter((c) => {
    if (!includeConditional && c.conditional) return false;
    if (role && c.roles && !c.roles.includes(role)) return false;
    return true;
  });
}

/** Controls that must be visible and enabled right after a plain page load for `role`. */
export function requiredControlsOn(id: RouteId, role: Role): readonly ControlSpec[] {
  return controlsOn(id, { role, includeConditional: false });
}

export function controlOn(id: RouteId, controlId: string): ControlSpec {
  const found = controlsOn(id).find((c) => c.id === controlId);
  if (!found) throw new Error(`Unknown control "${controlId}" on route "${id}"`);
  return found;
}

/** Every control on every route, tagged with its route — the flat list coverage.spec iterates. */
export function allControls(): ReadonlyArray<ControlSpec & { routeId: RouteId }> {
  return ROUTES.flatMap((r) =>
    controlsOn(r.id).map((c) => ({ ...c, routeId: r.id })),
  );
}

/** Selectors coverage.spec.ts must treat as framework chrome on the given route. */
export function chromeSelectorsFor(id: RouteId): readonly string[] {
  return [...PF_CHROME_SELECTORS, ...(routeById(id).chromeSelectors ?? [])];
}
