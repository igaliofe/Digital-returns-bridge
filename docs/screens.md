# Digital Returns Bridge — Screen Descriptions

> **Design source**: [Figma — Digital Returns Bridge Screen Designs](https://www.figma.com/design/QLMlsSFt51XHxZAyUNeI2U/Digital-Returns-Bridge-%E2%80%94-Screen-Designs) (24 frames).  
> **UI styling**: Web uses `server/src/main/webapp/resources/css/drb.css` (Inter font, Figma tokens, PrimeFaces overrides). Android uses `colors.xml`, `dimens.xml`, `themes.xml`, `styles.xml`, and status-chip drawables.  
> **Validation**: [figma-ui-gaps.md](figma-ui-gaps.md) — no gaps identified after pixel-perfect pass.

---

## Figma → Code Map (24 screens)

| # | Figma frame | Node | Route / Activity |
|---|---|---|---|
| 1 | Web · Login | `20:5` | `/login.xhtml` |
| 2 | Web · Dashboard | `20:22` | `/dashboard.xhtml` + `layout.xhtml` nav |
| 3 | Web · Identify Customer | `62:2` | `/returns/create/identify-customer.xhtml` |
| 4 | Web · Item Selection | `62:37` | `/returns/create/select-item.xhtml` |
| 5 | Web · New Return Request | `62:158` | `/returns/create/new-return.xhtml` |
| 6 | Web · Return Requests | `20:78` | `/returns/list.xhtml` |
| 7 | Web · Return Details | `26:136` | `/returns/details.xhtml` |
| 8 | Web · Warehouse Receiving | `49:2` | `/warehouse/receiving.xhtml` |
| 9 | Web · Reports & KPIs | `27:2` | `/reports.xhtml` |
| 10 | Admin · Users | `27:153` | `/admin/users.xhtml` |
| 11 | Admin · Customers | `27:265` | `/admin/customers.xhtml` |
| 12 | Admin · Products | `28:22` | `/admin/products.xhtml` |
| 13 | Admin · Drivers | `28:136` | `/admin/drivers.xhtml` |
| 14 | Android · Login | `36:2` | `LoginActivity` |
| 15 | Android · Pickup List | `36:19` | `PickupListActivity` |
| 16 | Android · Pickup Details | `36:50` | `PickupDetailsActivity` |
| 17 | Android · Barcode Assignment | `36:105` | `BarcodeAssignmentActivity` |
| 18 | Android · Image Capture | `36:124` | `ImageCaptureActivity` |
| 19 | Android · Pickup Confirmation | `36:146` | `PickupConfirmationActivity` |
| 20 | Storekeeper · Login | `50:2` | `LoginActivity` (WAREHOUSE chrome via `LoginChromeHelper`) |
| 21 | Storekeeper · Receiving Queue | `50:19` | `StorekeeperHomeActivity` |
| 22 | Storekeeper · Scan Barcode | `50:50` | `WarehouseScanActivity` |
| 23 | Storekeeper · Return File | `50:70` | `WarehouseReturnDetailsActivity` |
| 24 | Storekeeper · Inspection | `50:126` | `WarehouseInspectionActivity` |

`/returns/create.xhtml` redirects to Step 1.

---

## JSF Web Screens

### Login (`/login.xhtml`) — Figma `20:5`
**Used by**: Service Rep, Warehouse, Manager

Centered sign-in card on cream background. Single phone input. Calls `POST /api/auth/login`. On success:
- `WAREHOUSE` → `/warehouse/receiving.xhtml`
- All others → `/dashboard.xhtml`

### Dashboard (`/dashboard.xhtml`) — Figma `20:22`
**Used by**: Service Rep, Manager, Warehouse

**8 KPI cards** from `GET /api/reports/dashboard` (no Inspected tile — that KPI appears on Reports only):

| Card | Source field |
|---|---|
| Open | `open` |
| Waiting Pickup | `waitingForPickup` |
| Barcode Assigned | `barcodeAssigned` |
| Picked Up | `pickedUp` |
| In Warehouse | `arrivedToWarehouse` |
| Closed | `closed` |
| Needs More Info | `needsMoreInfo` |
| No Barcode Assigned | `noBarcode` |

Custom header nav in `layout.xhtml`: DRB logo, active pill, Admin dropdown, logout + avatar.

### Create Return Wizard (3 steps)
**Used by**: Service Rep. Backed by `CreateReturnWizardBean` (session-scoped).

#### Step 1 — Identify Customer (`/returns/create/identify-customer.xhtml`) — Figma `62:2`
- Phone lookup → `GET /api/customers/by-phone/{phone}`
- Step indicator card, wizard cream background
- Next → Step 2 when customer found

#### Step 2 — Item Selection (`/returns/create/select-item.xhtml`) — Figma `62:37`
- Purchase table → `GET /api/customers/{customerId}/purchases`
- Columns: product, order #, qty, delivery date, warranty, handled badge
- Rows with `handled=true` are non-selectable (Handled chip)
- Back / Next with selected `purchaseId`

#### Step 3 — New Return Request (`/returns/create/new-return.xhtml`) — Figma `62:158`
Pre-filled from purchase: product, order number, quantity, delivery date, warranty.

Form fields:
- Was used (checkbox)
- Return reason, defect stage, defect type, defect location (text)
- Notes (required → `reason`), defect description, priority
- Assign driver (dropdown)
- General photos (`SERVICE_GENERAL_IMAGE`), defect photos (`SERVICE_DEFECT_IMAGE`)
- Photo checklist checkboxes
- Service rep signature (`<p:signature>` → `SERVICE_REP_SIGNATURE`)

On save: `POST /api/returns` with `purchaseId` → sets `handled=true` on purchase → uploads images/signature → optional `PATCH .../assign-driver` → `WAITING_FOR_PICKUP`.

### Returns List (`/returns/list.xhtml`) — Figma `20:78`
**Used by**: Service Rep, Manager, Warehouse

Styled `drb-panel` + `drb-table`. Columns: barcode, customer, product, status badge, driver, open date, priority. Filters: status, driver, customer, barcode toggle/search. Row click → details.

### Return Details (`/returns/details.xhtml`) — Figma `26:136`
**Used by**: Service Rep, Manager, Warehouse

Sections: header badges, customer & product (with catalog image), barcode block, image gallery (all `ImageType` values including signatures), pickup assessment, status timeline. Role-dependent actions.

### Warehouse Receiving (`/warehouse/receiving.xhtml`) — Figma `49:2`
**Used by**: Warehouse

Barcode lookup → `GET /api/warehouse/returns/{barcode}`. Full digital return file: catalog image, checklist fields, galleria, driver pickup table, signatures.

Actions: Mark Arrived (`POST /api/warehouse/arrivals/{barcode}`), Request More Info, Create Inspection (`POST .../warehouse-inspections`).

### Reports (`/reports.xhtml`) — Figma `27:2`
**Used by**: Manager

**9 KPI cards** including Inspected. Tables/charts from all six report endpoints.

### Admin CRUD — Figma `27:153`–`28:136`
- `/admin/users.xhtml` — users table, active toggle
- `/admin/customers.xhtml` — customer CRUD
- `/admin/products.xhtml` — product CRUD with catalog image
- `/admin/drivers.xhtml` — driver records

---

## Android Screens

Multi-role app. `NavigationHelper.routeAfterLogin` routes `DRIVER` → pickup flow, `WAREHOUSE` → storekeeper flow. `LoginChromeHelper` applies role-specific login chrome (storekeeper header styling on Figma `50:2`).

### LoginActivity — Figma `36:2` / `50:2`
Phone + Login. `POST /api/auth/login`. Role routing on success and session restore.

### Driver flow

#### PickupListActivity — Figma `36:19`
`GET /api/drivers/{driverId}/pickups`. Each row (`item_pickup.xml` via `ReturnCardBinder`):
- Customer name, **customer address** (not order #)
- Product × quantity
- Status chip (color per status)
- Barcode chip (separate from status)

#### PickupDetailsActivity — Figma `36:50`
Full return detail with `customerAddress`, catalog image, barcode block, timeline. Actions: Assign Barcode, Take Photo, Confirm Pickup.

#### BarcodeAssignmentActivity — Figma `36:105`
Manual entry + ZXing scan. `PATCH /api/returns/{id}/assign-barcode`.

#### ImageCaptureActivity — Figma `36:124`
Camera capture. Spinner: Product / Distant / Defect image types. Defect photo mandatory before other types.

#### PickupConfirmationActivity — Figma `36:146`
Item condition spinner (`ItemCondition`), defect type/location, collected checkbox, notes, required driver signature (`DRIVER_SIGNATURE`), then `POST .../pickup-confirmation`.

### Storekeeper flow

#### StorekeeperHomeActivity — Figma `50:19`
Merged queue: `GET /api/returns?status=PICKED_UP` + `ARRIVED_TO_WAREHOUSE`. Shared header with logout. Scan button → `WarehouseScanActivity`.

#### WarehouseScanActivity — Figma `50:50`
ZXing scan → `GET /api/warehouse/returns/{barcode}` → details activity.

#### WarehouseReturnDetailsActivity — Figma `50:70`
Digital return file. Mark Arrived, Inspect, View History.

#### WarehouseInspectionActivity — Figma `50:126`
Read-only context block + inspection form. Request More Info or Submit Inspection; Call Fully Handled chains `CLOSED`.
