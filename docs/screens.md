# Digital Returns Bridge — Screen Descriptions

---

## JSF Web Screens

### Login (`/login.xhtml`)
**Used by**: Service Rep, Warehouse, Manager

Single input: phone number. On submit, calls `POST /api/auth/login`. On success, redirects based on role:
- `WAREHOUSE` → `/warehouse/receiving.xhtml`
- All others → `/dashboard.xhtml`

On failure (unknown phone / inactive user), displays a PrimeFaces error message inline.

---

### Dashboard (`/dashboard.xhtml`)
**Used by**: Service Rep, Manager, Warehouse

Displays KPI cards sourced from `GET /api/reports/dashboard`:

| Card | Value |
|---|---|
| Open | Returns in `OPEN` status |
| Waiting for Pickup | `WAITING_FOR_PICKUP` count |
| Barcode Assigned | `BARCODE_ASSIGNED` count |
| Picked Up | `PICKED_UP` count |
| At Warehouse | `ARRIVED_TO_WAREHOUSE` count |
| Inspected | `INSPECTED` count |
| Closed | `CLOSED` count |
| Needs More Info | `NEEDS_MORE_INFO` count |
| No Barcode | Returns where barcode is still `NULL` |

Navigation links to: Create Return, Returns List, Reports, Warehouse Receiving.

---

### Returns List (`/returns/list.xhtml`)
**Used by**: Service Rep, Manager, Warehouse

PrimeFaces `<p:dataTable>` with columns:

- Barcode (shows "Not assigned" when `null`)
- Customer name
- Product name
- Status (badge/tag)
- Assigned driver
- Open date
- Priority

**Filters** (above the table):
- Status dropdown
- Driver dropdown
- Customer search
- "Has barcode" / "No barcode" toggle
- Barcode text search

Row click → navigates to Return Details.

---

### Create Return (`/returns/create.xhtml`)
**Used by**: Service Rep

Form fields (backed by `CreateReturnBean`):
- Customer (dropdown from `GET /api/customers`)
- Product (dropdown from `GET /api/products`)
- Order number (text)
- **Original delivery date** (`<p:datePicker>`)
- **Quantity** (`<p:inputNumber>`, min 1)
- **Under warranty** (checkbox)
- **Was used** (checkbox)
- **Return reason** (dropdown — `ReturnReason` enum, required)
- **Defect stage** (dropdown — `DefectStage` enum)
- **Defect type** (dropdown — `DefectType` enum)
- **Defect location** (free text)
- Free-text notes (textarea, required — maps to `reason`)
- Defect description (textarea)
- Priority (dropdown: NORMAL / HIGH / URGENT)
- Assign driver (dropdown from `GET /api/drivers`)
- **General Photos** (`<h:inputFile multiple>`) — uploaded as `SERVICE_GENERAL_IMAGE`
- **Focused Defect Photos** (`<h:inputFile multiple>`) — uploaded as `SERVICE_DEFECT_IMAGE`
- **Photo checklist** (three checkboxes): "Clear photos received", "General photo exists", "Focused defect photo exists"
- **Service Rep Signature** — drawn on a `<p:signature>` pad (with Clear button); saved via the image endpoint as `SERVICE_REP_SIGNATURE`

**No barcode field or barcode generation.** The barcode will be assigned later by the driver in the field.

On save: `POST /api/returns` (with the structured checklist fields) → uploads the general/defect photos and the signature → if a driver is selected, `PATCH /api/returns/{id}/assign-driver` → status becomes `WAITING_FOR_PICKUP`.

---

### Return Details (`/returns/details.xhtml`)
**Used by**: Service Rep, Manager, Warehouse

Sections:

**Header**: Return ID, status badge, priority badge, open date.

**Customer & Product block**: full name, phone, email, address; product name, SKU, category, price, and the **catalog image** (`product.imageUrl`).

**Barcode block**:
- If assigned: barcode value, date/time assigned, driver who assigned it
- If not assigned: "Not yet assigned" placeholder

**Images gallery**: thumbnails of all uploaded images, grouped by `ImageType` (`SERVICE_GENERAL_IMAGE`, `SERVICE_DEFECT_IMAGE`, `DRIVER_PRODUCT_IMAGE`, `DRIVER_DISTANT_IMAGE`, `DRIVER_DEFECT_IMAGE`, `WAREHOUSE_IMAGE`). Drawn signatures (`SERVICE_REP_SIGNATURE`, `DRIVER_SIGNATURE`) are shown as signature images. Upload button adds more.

**Pickup block**: item condition, defect type, defect location (+ free text when `OTHER`), item collected flag, driver notes, and the driver's signature image.

**Timeline / Status history**: chronological list of all status transitions with timestamp, actor name, and optional comment.

**Actions** (role-dependent):
- Edit return details (Service Rep)
- Assign / reassign driver
- Change priority
- Manual status override (Manager)
- Add image
- Go to Warehouse Receiving (Warehouse)

---

### Warehouse Receiving (`/warehouse/receiving.xhtml`)
**Used by**: Warehouse

**Primary action**: enter or scan barcode → calls `GET /api/warehouse/returns/{barcode}`.

On barcode not found: inline error message "Barcode not found: {value}".

On barcode found, shows the **complete digital return file** (backed by `WarehouseReceivingBean`):
- **Catalog image + price** of the product, name and SKU
- Core info grid: customer, phone, order number, quantity, original delivery date, return date, under-warranty, was-used, priority, status, barcode, assigned driver
- **Service Defect Detail** fieldset: return reason, defect type, defect stage, defect location text, reason notes, defect description
- **Photos** — a `<p:galleria>` of all service + driver images
- **Driver Pickup Assessment** table (from `pickup_updates`): item condition, defect type, defect location (+ "other" text), collected flag, driver notes
- **Signatures**: service rep signature and driver signature images (when present)
- Current status (full status history is available via Return Details)

**Warehouse actions**:
- **Mark as Arrived** → `POST /api/warehouse/arrivals/{barcode}` → status → `ARRIVED_TO_WAREHOUSE` (shown only when status is `PICKED_UP`)
- **Request More Info** → transitions an `ARRIVED_TO_WAREHOUSE` return to `NEEDS_MORE_INFO` (shown only when status is `ARRIVED_TO_WAREHOUSE`)
- **Create Inspection** → form (shown when status is `ARRIVED_TO_WAREHOUSE` or `INSPECTED`) with:
  - **Item Condition** dropdown (`ItemCondition` enum, required)
  - **Decision (routing)** dropdown (`WarehouseDecision` enum, required)
  - **Call Fully Handled** checkbox
  - **Notes** textarea
  - → `POST /api/returns/{id}/warehouse-inspections` → status → `INSPECTED`

`warehouseDecision` (routing) options:
- `STOCK_AS_NEW_114` — return to stock as new (route 114)
- `CLASS_B` — classify as Class B stock
- `SHAPIIM_155` — route to refurbishment (Shapiim, route 155)
- `REDESIGN_208` — route to redesign (route 208)
- `FROZEN_FURTHER_HANDLING` — frozen, pending further handling
- `REPAIR` — send for repair
- `DISPOSE` — discard

---

### Reports (`/reports.xhtml`)
**Used by**: Manager

Displays data from all six report endpoints:

- Returns by status (bar chart / table via `GET /api/reports/returns-by-status`)
- Warehouse decisions breakdown (`GET /api/reports/warehouse-decisions`)
- Returns with missing info (`GET /api/reports/missing-info`)
- Driver performance — pickups per driver (`GET /api/reports/driver-performance`)
- Daily returns volume (`GET /api/reports/daily-returns`)
- Full dashboard KPIs (`GET /api/reports/dashboard`)

---

### Admin — Users (`/admin/users.xhtml`)
**Used by**: Manager

`<p:dataTable>` listing all users. Inline edit for full name, role. Toggle active/inactive via `PATCH /api/users/{id}/active`. New user form at the bottom.

---

### Admin — Customers (`/admin/customers.xhtml`)
**Used by**: Manager

CRUD table for customers. Fields: full name, phone, email, address. `POST /api/customers` and `PUT /api/customers/{id}`.

---

### Admin — Products (`/admin/products.xhtml`)
**Used by**: Manager

CRUD table for products. Fields: SKU, name, category, description, price, and **catalog image** (`imageUrl`). The image is shown to drivers (pickup details) and warehouse staff (receiving screen).

---

### Admin — Drivers (`/admin/drivers.xhtml`)
**Used by**: Manager

CRUD table for drivers. Shows linked user, vehicle number, phone, active flag.

---

## Android Screens

### LoginActivity
Phone number `EditText` + Login button. Calls `POST /api/auth/login`. On success, saves token and user data to `SharedPreferences` via `SessionManager`, then launches `PickupListActivity`. Displays a `Toast` on error.

---

### PickupListActivity
`RecyclerView` showing all return requests assigned to the logged-in driver (`GET /api/drivers/{driverId}/pickups`).

Each `item_pickup.xml` row shows:
- Customer name + address
- Product name
- Current status chip
- Barcode status badge: **Assigned** (green) / **Not assigned** (grey)

**Actions**:
- Pull-to-refresh reloads the list
- Filter by status (spinner in toolbar)
- Tap a row → `PickupDetailsActivity`
- Toolbar overflow menu → Logout

---

### PickupDetailsActivity
Full detail view for a single return request (`GET /api/returns/{returnId}`).

Sections:
- Customer: name, phone, address
- Product: name, SKU, **price**, and the **catalog image** (`productImageUrl`, loaded via Glide)
- **Original delivery date**
- Reason and defect description
- **Barcode status block**: shows barcode value if assigned; shows "Not yet assigned" with a highlighted **Assign Barcode** button if not
- Thumbnail images (loaded via Glide)
- Status timeline (`GET /api/returns/{returnId}/timeline`)

**Action buttons**:
- **Assign Barcode** → `BarcodeAssignmentActivity` (disabled once assigned)
- **Take Photo** → `ImageCaptureActivity`
- **Confirm Pickup** → `PickupConfirmationActivity` (disabled until status is `BARCODE_ASSIGNED`)
- **View History** → inline timeline expansion

---

### BarcodeAssignmentActivity
Text field for manual barcode entry + **Assign** button.  
Optional **Scan** button launches ZXing barcode scanner (`com.journeyapps:zxing-android-embedded`); scanned value populates the text field automatically.

Shows sticker-attachment guidance (from `strings.xml`):
- "Attach the barcode sticker firmly to the outside of the package so it is clearly visible and scannable."
- "If the return has multiple cartons, attach the barcode to the package containing the defective item."

On **Assign**:
- Calls `PATCH /api/returns/{returnId}/assign-barcode` with `{ barcode, driverId }`
- **200**: success Toast, finishes activity and refreshes `PickupDetailsActivity`
- **400 BARCODE_BLANK**: Toast "Barcode cannot be empty"
- **409 BARCODE_ALREADY_ASSIGNED**: Toast "This barcode is already in use"
- **404**: Toast "Return request not found"

---

### ImageCaptureActivity
Launches `MediaStore.ACTION_IMAGE_CAPTURE` intent with a `FileProvider` URI. After capture:
1. Resizes the image bitmap to reduce upload size
2. Builds a `multipart/form-data` request with `file` + `imageType` parts
3. POSTs to `POST /api/returns/{returnId}/images`

`imageType` is selected via a spinner with three options: **Product** (`DRIVER_PRODUCT_IMAGE`), **Distant** (`DRIVER_DISTANT_IMAGE`), or **Defect** (`DRIVER_DEFECT_IMAGE`).

A **defect photo is mandatory**: on open the screen checks the return's images for an existing `DRIVER_DEFECT_IMAGE`. If none exists it shows a "A defect photo (Defect) is required for this return." banner, pre-selects the Defect type, and blocks uploading any other type until the defect photo has been captured.

Shows upload progress; displays success or error Toast on completion.

---

### PickupConfirmationActivity
Form for the final pickup step. **Confirm Pickup button is disabled** if the return's status is not `BARCODE_ASSIGNED`.

Fields:
- **Item Condition** spinner — `ItemCondition` enum (5 values: `LIKE_NEW_ORIGINAL_PACKAGING`, `LIKE_NEW_NO_PACKAGING`, `USED`, `USED_MINOR_DEFECT`, `SIGNIFICANTLY_DEFECTIVE`)
- **Defect Type** spinner — `(none)` + `DefectType` enum
- **Defect Location** spinner — `(none)` + `DefectLocation` enum; selecting `OTHER` reveals a free-text "other location" field (required when `OTHER` is chosen)
- Item collected checkbox (defaults checked)
- Driver notes `EditText` (optional)
- **Driver signature** — drawn on a custom `SignatureView` (Canvas) with a Clear button; a signature is **required** to confirm

On **Confirm Pickup**:
1. Validates the signature (and the "other" location text if applicable)
2. Uploads the drawn signature as a PNG via `POST /api/returns/{returnId}/images` with `imageType = DRIVER_SIGNATURE`
3. Then calls `POST /api/returns/{returnId}/pickup-confirmation` with `{ driverId, itemCondition, defectType, defectLocation, defectLocationOther, itemCollected, driverNotes }`
- On success (status → `PICKED_UP`): Toast + navigate back to `PickupListActivity`
- On `409`: Toast "Cannot confirm pickup — barcode not yet assigned"
- On other errors: Toast with the status code
