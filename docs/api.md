# Digital Returns Bridge — REST API Reference

Base path: `/api`  
Authentication: `Authorization: Bearer <token>` (all endpoints except `/api/auth/login`)  
Content-Type: `application/json` (unless noted)

> **Audit timestamps**: every entity DTO carries `createdAt` and `updatedAt` (ISO-8601 `LocalDateTime`), auto-managed server-side via JPA `@PrePersist`/`@PreUpdate`. They are read-only and present on all resources for future statistics.

---

## Authentication

### POST /api/auth/login
Login by phone number. No password required.

**Roles**: public (no token needed)

**Request**
```json
{ "phoneNumber": "0501234567" }
```

**Response 200**
```json
{
  "token": "uuid-token",
  "userId": 1,
  "fullName": "Alice Cohen",
  "role": "SERVICE_REP"
}
```

**Errors**: `400 PHONE_REQUIRED`, `404 NOT_FOUND` (unknown phone), `400 USER_INACTIVE`

---

### GET /api/auth/me
Returns the currently authenticated user.

**Roles**: any authenticated user

**Response 200**
```json
{ "id": 1, "phoneNumber": "0501234567", "fullName": "Alice Cohen", "role": "SERVICE_REP", "active": true }
```

---

### POST /api/auth/logout
Invalidates the current token.

**Roles**: any authenticated user

**Response**: `204 No Content`

---

## Users

### GET /api/users
List all users.  **Roles**: MANAGER

### GET /api/users/{userId}
Get user by ID.  **Roles**: MANAGER

### POST /api/users
Create a user.  **Roles**: MANAGER

**Request**
```json
{ "phoneNumber": "0509999999", "fullName": "New User", "role": "DRIVER" }
```
**Response**: `201 Created` with `UserDto`

### PUT /api/users/{userId}
Update user details.  **Roles**: MANAGER

### PATCH /api/users/{userId}/active
Toggle user active/inactive.  **Roles**: MANAGER

**Response**: `200` with updated `UserDto`

---

## Customers

### GET /api/customers
List all customers. Optional `?search={text}` filters by name or phone.  
**Roles**: SERVICE_REP, MANAGER

### GET /api/customers/{customerId}
**Roles**: SERVICE_REP, MANAGER

### GET /api/customers/by-phone/{phone}
Look up a customer by phone number. Used by Create Return wizard Step 1 (`identify-customer.xhtml`).

**Roles**: SERVICE_REP, MANAGER

**Response 200**: `CustomerDto`

**Errors**: `404 NOT_FOUND` if no customer matches the phone

---

### GET /api/customers/{customerId}/purchases
Returns purchase-history rows for the Item Selection table (wizard Step 2). Each row includes product details and a `handled` flag.

**Roles**: SERVICE_REP, MANAGER

**Response 200**: array of `CustomerPurchaseDto`

```json
[
  {
    "id": 1,
    "customerId": 1,
    "productId": 2,
    "productName": "Smart TV 55\"",
    "productSku": "TV-55-4K",
    "productPrice": 2499.00,
    "productImageUrl": "https://res.cloudinary.com/...",
    "orderNumber": "ORD-2024-001",
    "quantity": 1,
    "originalDeliveryDate": "2024-05-01",
    "underWarranty": true,
    "handled": false,
    "createdAt": "2024-01-10T08:00:00",
    "updatedAt": "2024-01-10T08:00:00"
  }
]
```

Rows with `handled: true` are shown as non-selectable in the wizard (Handled badge).

**Errors**: `404` if customer not found

---

### POST /api/customers
**Request**: `{ "fullName", "phone", "email", "address" }`  
**Response**: `201 Created`

### PUT /api/customers/{customerId}
**Roles**: SERVICE_REP, MANAGER

---

## Products

### GET /api/products
List all products. Optional `?search={text}` filters by name or SKU.  
**Roles**: SERVICE_REP, MANAGER

### GET /api/products/{productId}
### POST /api/products
**Request**: `{ "sku", "name", "category", "description", "price", "imageUrl" }`  
`imageUrl` is the catalog image URL (Cloudinary), shown to the driver and warehouse. Nullable.  
**Response**: `201 Created` with `ProductDto` (`{ id, sku, name, category, description, price, imageUrl, createdAt, updatedAt }`)

### PUT /api/products/{productId}

---

## Drivers

### GET /api/drivers
List all drivers.  **Roles**: SERVICE_REP, MANAGER

### GET /api/drivers/{driverId}

> **Note**: There is no `POST /api/drivers` endpoint. Driver records are created via seed data or the admin UI; the Android app resolves `drivers.id` from the logged-in user via `DriverIdResolver` (`GET /api/auth/me` + `GET /api/drivers`).

### GET /api/drivers/{driverId}/pickups
Returns `ReturnRequest` list assigned to this driver.  
Optional: `?status={status}` or `?date={YYYY-MM-DD}`

---

## Return Requests

### GET /api/returns
List return requests. Optional filters:
- `?status={ReturnStatus}`
- `?driverId={id}`
- `?customerId={id}`

**Roles**: SERVICE_REP, WAREHOUSE, MANAGER (shared read endpoint — intentionally not role-restricted)

**Consumed by**: JSF web + Android. The Android **storekeeper work queue** (`StorekeeperHomeActivity`) uses the `?status` filter (single status per call) twice — `PICKED_UP` and `ARRIVED_TO_WAREHOUSE` — and merges client-side.

**Response fields on `ReturnRequestDto`**: includes `customerAddress`, `customerPhone` (from linked customer), `productPrice`, `productImageUrl` (from linked product) — used by Android pickup list rows.

### GET /api/returns/{returnId}
Get full return request detail.

### GET /api/returns/by-barcode/{barcode}
Fetch a return request by its scanned barcode. Used by warehouse and Android.

**Errors**: `404` if barcode not found

### POST /api/returns
Create a new return request. Barcode is **not** set here.

**Request**
```json
{
  "customerId": 1,
  "productId": 2,
  "purchaseId": 5,
  "driverId": 3,
  "orderNumber": "ORD-2024-001",
  "reason": "Defective product",
  "defectDescription": "Screen has dead pixels",
  "priority": "HIGH",
  "originalDeliveryDate": "2024-05-01",
  "quantity": 1,
  "underWarranty": true,
  "wasUsed": true,
  "returnReason": "PRODUCT_DEFECT",
  "defectType": "ELECTRONIC_FAULT",
  "defectStage": "AFTER_USE",
  "defectLocationText": "Screen panel, lower-right quadrant"
}
```

Service-rep checklist fields (all nullable):

| Field | Type | Notes |
|---|---|---|
| `originalDeliveryDate` | `string` (ISO date `YYYY-MM-DD`) | When the product was originally delivered |
| `quantity` | `integer` | Number of units being returned |
| `underWarranty` | `boolean` | Whether the item is still under warranty |
| `wasUsed` | `boolean` | Whether the customer used the item |
| `returnReason` | enum `ReturnReason` | Reason category (see [Enum Values](#enum-values)) |
| `defectType` | enum `DefectType` | Defect kind (see [Enum Values](#enum-values)) |
| `defectStage` | enum `DefectStage` | When the defect appeared |
| `defectLocationText` | `string` | Free-text defect location |
| `purchaseId` | `integer` | Optional. When set (Create Return wizard), links the return to a `customer_purchases` row |

**Handled rule**: When `purchaseId` is provided, the server links `return_requests.purchase_id`, pre-fills missing order/delivery/qty/warranty fields from the purchase, and sets `customer_purchases.handled = true` in the same transaction. Already-handled purchases are rejected by the wizard UI before submit.

**Response**: `201 Created` with `ReturnRequestDto`. The DTO echoes the fields above plus `customerAddress`, `customerPhone`, `productPrice`, and `productImageUrl` (denormalized from the linked customer/product for driver and warehouse views).

### PUT /api/returns/{returnId}
Update return details (reason, defect, priority, order number).

### PATCH /api/returns/{returnId}/assign-driver
```json
{ "driverId": 3 }
```

### PATCH /api/returns/{returnId}/assign-barcode
Assign a physical barcode sticker to this return. Called by the Android driver app after scanning.

**Roles**: DRIVER

**Request**
```json
{ "barcode": "BC-10001", "driverId": 3 }
```

**Response 200**: `ReturnRequestDto` with `status: BARCODE_ASSIGNED`

**Errors**:
- `400 BARCODE_BLANK` — barcode is empty
- `409 BARCODE_ALREADY_ASSIGNED` — barcode is in use by another return
- `404` — return request or driver not found

### PATCH /api/returns/{returnId}/status
Manually transition status.

**Request**: `{ "status": "INSPECTED", "comment": "All good" }`

Allowed transitions (enforced server-side):

| From | To |
|---|---|
| `OPEN` | `WAITING_FOR_PICKUP`, `NEEDS_MORE_INFO` |
| `WAITING_FOR_PICKUP` | `BARCODE_ASSIGNED` |
| `BARCODE_ASSIGNED` | `PICKED_UP` |
| `PICKED_UP` | `ARRIVED_TO_WAREHOUSE` |
| `ARRIVED_TO_WAREHOUSE` | `INSPECTED`, `NEEDS_MORE_INFO` |
| `INSPECTED` | `CLOSED` |
| `NEEDS_MORE_INFO` | `WAITING_FOR_PICKUP` |

> `ARRIVED_TO_WAREHOUSE → NEEDS_MORE_INFO` backs the warehouse "Request More Info" action (see Warehouse section).

**Consumed by**: JSF web + Android. The Android storekeeper uses this endpoint for two transitions: **Request More Info** (`ARRIVED_TO_WAREHOUSE → NEEDS_MORE_INFO`) and, when an inspection is marked **Call Fully Handled**, a follow-up `INSPECTED → CLOSED`.

**Errors**: `409` for illegal transitions

### PATCH /api/returns/{returnId}/priority
```json
{ "priority": "HIGH" }
```

### GET /api/returns/{returnId}/timeline
Returns status history as a timeline. Used by Android `PickupDetailsActivity`.

**Response**: array of `StatusHistoryDto`

---

## Images

### GET /api/returns/{returnId}/images
List all images for a return request.

### POST /api/returns/{returnId}/images
Upload an image to Cloudinary and persist the metadata.

**Content-Type**: `multipart/form-data`  
**Parts**: `file` (binary), `imageType` (string)

**imageType values** (`ImageType` enum):

| Value | Source |
|---|---|
| `SERVICE_GENERAL_IMAGE` | Service rep — general product photo |
| `SERVICE_DEFECT_IMAGE` | Service rep — focused defect photo |
| `SERVICE_REP_SIGNATURE` | Service rep — drawn signature |
| `DRIVER_PRODUCT_IMAGE` | Driver — product photo at pickup |
| `DRIVER_DISTANT_IMAGE` | Driver — distant / contextual photo |
| `DRIVER_DEFECT_IMAGE` | Driver — close-up defect photo |
| `DRIVER_SIGNATURE` | Driver — drawn signature |
| `WAREHOUSE_IMAGE` | Warehouse — inspection photo |

Drawn signatures (service rep + driver) are uploaded through this same endpoint as PNG files tagged `SERVICE_REP_SIGNATURE` / `DRIVER_SIGNATURE`.

**Response**: `201 Created` with `ReturnImageDto`

### GET /api/images/{imageId}
Get image metadata.

### DELETE /api/images/{imageId}
Delete image from Cloudinary and database.

---

## Pickup Updates

### GET /api/returns/{returnId}/pickup-updates
List pickup updates for a return.

### POST /api/returns/{returnId}/pickup-updates
Record a pickup update from the driver. Accepts the same `PickupConfirmationRequest` body as pickup-confirmation (below) but does **not** change the return status.

### POST /api/returns/{returnId}/pickup-confirmation
Confirm pickup. **Requires** the return to be in `BARCODE_ASSIGNED` status; rejects with `409` otherwise.

**Request** (`PickupConfirmationRequest`)
```json
{
  "driverId": 3,
  "itemCondition": "USED_MINOR_DEFECT",
  "defectType": "SCRATCH",
  "defectLocation": "OTHER",
  "defectLocationOther": "USB-C port housing",
  "itemCollected": true,
  "driverNotes": "All fine"
}
```

| Field | Type | Notes |
|---|---|---|
| `driverId` | `integer` | Driver recording the pickup |
| `itemCondition` | enum `ItemCondition` | Replaces the old `packageCondition` field |
| `defectType` | enum `DefectType` | Nullable |
| `defectLocation` | enum `DefectLocation` | Nullable |
| `defectLocationOther` | `string` | Free text; used when `defectLocation = OTHER` |
| `itemCollected` | `boolean` | Whether the driver physically collected the item |
| `driverNotes` | `string` | Free-text notes |

Transitions status → `PICKED_UP`. The driver's drawn signature is uploaded separately via the image endpoint as `DRIVER_SIGNATURE` (the Android app uploads it just before confirming).

The returned `PickupUpdateDto` also includes `signatureImageUrl` (the stored driver-signature URL, nullable).

### PUT /api/pickup-updates/{pickupUpdateId}
Update an existing pickup update record.

---

## Warehouse

All `/api/warehouse/*` endpoints are **role-restricted to `WAREHOUSE` / `MANAGER`** (`@RolesAllowed({"WAREHOUSE","MANAGER"})` at the `WarehouseResource` class level, enforced by `RolesAllowedFilter`).

**Consumed by**: JSF web Warehouse Receiving screen **and** the Android storekeeper screens (`WarehouseScanActivity`, `WarehouseReturnDetailsActivity`). The two are interchangeable clients of these endpoints.

### GET /api/warehouse/returns/{barcode}
Fetch the complete return file (return request + images + pickup updates) by barcode.  
Used by the warehouse receiving screen and the Android `WarehouseScanActivity` barcode lookup.

**Roles**: WAREHOUSE, MANAGER

**Errors**: `404` if barcode unknown

### POST /api/warehouse/arrivals/{barcode}
Mark the item as arrived at the warehouse (no request body). Transitions status → `ARRIVED_TO_WAREHOUSE` and records the authenticated user in status history. Returns the updated `ReturnRequestDto`. Backs the **Mark Arrived** action in both the JSF receiving screen and Android `WarehouseReturnDetailsActivity`.

**Roles**: WAREHOUSE, MANAGER

**Errors**: `404` if barcode unknown

> **Request More Info**: The warehouse receiving screen's "Request More Info" button transitions an `ARRIVED_TO_WAREHOUSE` return to `NEEDS_MORE_INFO`. There is no dedicated REST route — the JSF bean performs this through the standard status-transition engine (equivalent to `PATCH /api/returns/{id}/status` with `{ "status": "NEEDS_MORE_INFO" }`).

### GET /api/returns/{returnId}/warehouse-inspections
List warehouse inspections for a return. Consumed by JSF web + Android.

### POST /api/returns/{returnId}/warehouse-inspections
Create a warehouse inspection record. Transitions status → `INSPECTED`.

**Roles**: WAREHOUSE, MANAGER (`@RolesAllowed({"WAREHOUSE","MANAGER"})` on `ReturnResource.createWarehouseInspection`)

**Consumed by**: JSF web Warehouse Receiving screen **and** Android `WarehouseInspectionActivity`. When the Android storekeeper checks **Call Fully Handled**, the app chains a follow-up `PATCH /api/returns/{returnId}/status` `{ "status": "CLOSED" }` after the inspection so the return ends in `CLOSED`.

**Request** (`WarehouseInspectionRequest`)
```json
{
  "itemCondition": "LIKE_NEW_ORIGINAL_PACKAGING",
  "warehouseDecision": "STOCK_AS_NEW_114",
  "callFullyHandled": true,
  "warehouseNotes": "Item in perfect condition"
}
```

| Field | Type | Notes |
|---|---|---|
| `itemCondition` | enum `ItemCondition` | Warehouse-graded condition |
| `warehouseDecision` | enum `WarehouseDecision` | Routing classification (see below) |
| `callFullyHandled` | `boolean` | Whether the customer call was fully handled |
| `warehouseNotes` | `string` | Free-text inspection notes |

> `inspectedByUserId` is **derived server-side** from the authenticated Bearer token; clients do not send it. (The JSF receiving bean binds the inspecting user the same way.)

`warehouseDecision` values (remapped): `STOCK_AS_NEW_114`, `CLASS_B`, `SHAPIIM_155`, `REDESIGN_208`, `FROZEN_FURTHER_HANDLING`, `REPAIR`, `DISPOSE`.

**Response**: `201 Created` with `WarehouseInspectionDto`

### PUT /api/warehouse-inspections/{inspectionId}
Update an existing inspection record.

---

## Status History

### GET /api/returns/{returnId}/status-history
List all status changes for a return.

**Response**
```json
[
  {
    "id": 1,
    "oldStatus": "OPEN",
    "newStatus": "WAITING_FOR_PICKUP",
    "createdAt": "2024-01-15T10:30:00",
    "updatedAt": "2024-01-15T10:30:00",
    "comment": "Driver assigned",
    "changedByUserName": "Alice Cohen"
  }
]
```

### POST /api/returns/{returnId}/status-history
Manually insert a status history entry (Manager override).

**Request**: `{ "newStatus": "NEEDS_MORE_INFO", "comment": "Missing serial number" }`

---

## Reports

All report endpoints require **MANAGER** role.

### GET /api/reports/dashboard
General KPI summary.

**Response** (`DashboardDto`)
```json
{
  "statusCounts": {
    "OPEN": 4,
    "WAITING_FOR_PICKUP": 12,
    "BARCODE_ASSIGNED": 5,
    "PICKED_UP": 8,
    "ARRIVED_TO_WAREHOUSE": 3,
    "INSPECTED": 7,
    "CLOSED": 45,
    "NEEDS_MORE_INFO": 2
  },
  "noBarcode": 16,
  "totalOpen": 4,
  "totalPickedUp": 8,
  "totalInspected": 7,
  "totalClosed": 45
}
```
`noBarcode` = count of returns where `barcode IS NULL`. The JSF dashboard and reports pages derive individual KPI tiles from `statusCounts` (e.g. `WAITING_FOR_PICKUP`) plus the top-level totals above.

### GET /api/reports/returns-by-status
Count of returns grouped by status.

### GET /api/reports/warehouse-decisions
Count of warehouse inspections grouped by decision type.

### GET /api/reports/missing-info
List returns in `NEEDS_MORE_INFO` status.

### GET /api/reports/driver-performance
Count of pickups per driver.

### GET /api/reports/daily-returns
Count of return requests created per day.

---

## Enum Values

These value sets are shared verbatim across the database `CHECK` constraints, the Java enums, the JSF dropdowns, and the Android spinners. Strings must match exactly.

### ReturnStatus
`OPEN`, `WAITING_FOR_PICKUP`, `BARCODE_ASSIGNED`, `PICKED_UP`, `ARRIVED_TO_WAREHOUSE`, `INSPECTED`, `CLOSED`, `NEEDS_MORE_INFO`

### ItemCondition
`LIKE_NEW_ORIGINAL_PACKAGING`, `LIKE_NEW_NO_PACKAGING`, `USED`, `USED_MINOR_DEFECT`, `SIGNIFICANTLY_DEFECTIVE`

### ReturnReason
`NOT_AS_EXPECTED`, `DELIVERY_ERROR`, `SELLER_ERROR`, `SUPPLIER_ERROR`, `WAREHOUSE_ERROR`, `DRIVER_ERROR`, `CUSTOMER_NOT_HOME`, `PRODUCT_DEFECT`

### DefectType
`TEAR`, `SCRATCH`, `BREAK`, `MISSING_PART`, `FADED_COLOR`, `RUST`, `DENT`, `REVERSED_SIDE`, `ELECTRONIC_FAULT`

### DefectStage
`INITIAL_SHIPPING`, `AFTER_USE`, `MISSING_PART`

### DefectLocation
`RIGHT_SEAT`, `LEFT_SEAT`, `SEAT`, `LEGS`, `BACK`, `OTHER`

### WarehouseDecision
`STOCK_AS_NEW_114`, `CLASS_B`, `SHAPIIM_155`, `REDESIGN_208`, `FROZEN_FURTHER_HANDLING`, `REPAIR`, `DISPOSE`

### ImageType
`SERVICE_GENERAL_IMAGE`, `SERVICE_DEFECT_IMAGE`, `SERVICE_REP_SIGNATURE`, `DRIVER_PRODUCT_IMAGE`, `DRIVER_DISTANT_IMAGE`, `DRIVER_DEFECT_IMAGE`, `DRIVER_SIGNATURE`, `WAREHOUSE_IMAGE`

> The old `PackageCondition` enum (`GOOD`/`DAMAGED`/`MISSING`/`UNKNOWN`) has been removed and replaced by `ItemCondition`.

---

## Error Envelope

All error responses use this structure:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "ReturnRequest with id 99 not found"
  }
}
```

| HTTP Status | When |
|---|---|
| 400 | `ValidationException` — invalid input |
| 401 | Missing or invalid Bearer token |
| 404 | `NotFoundException` — resource not found |
| 409 | `IllegalStatusTransitionException` or `BARCODE_ALREADY_ASSIGNED` |
| 500 | Unexpected server error |
