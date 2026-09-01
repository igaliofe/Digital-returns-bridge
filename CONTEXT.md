# Context — Glossary

The canonical language for the Digital Returns Bridge domain. This file is a glossary only — no implementation details.

## Terms

### Barcode Assignment
The act of a **driver** attaching a physical barcode sticker to a returned item and recording that code against the return request (it *writes* `return_requests.barcode` and moves status `WAITING_FOR_PICKUP → BARCODE_ASSIGNED`). There is no barcode pool — a barcode only exists in the system once a driver assigns it. Distinct from [[barcode-lookup]].

### Barcode Lookup
The act of the **warehouse / storekeeper** reading an existing return by its barcode to pull up the digital return file. It is read-only — it never creates or changes a barcode. Distinct from [[barcode-assignment]].

> "Barcode screen" is ambiguous and should be avoided: it conflates **Barcode Assignment** (driver, write) with **Barcode Lookup** (warehouse, read). Both flows live in the single multi-role Android app.

### Pickup Confirmation
The driver's completion of a collected return: item condition, defect assessment, notes, and a required driver signature. A pickup cannot be confirmed until a barcode is assigned (server-enforced) and — in the Android client — a driver photo has been captured.

### Customer Purchase
A record that a **customer** bought a **product** — order number, quantity, delivery date and warranty flag. It is the anchor a [[return-request]] is opened against: the return wizard's step 2 lists a customer's purchases and cannot advance without one, and opening a return marks the purchase *handled* so it cannot be returned twice.

Stands in for the ERP feed the system does not have. Rows are created by a service rep or admin (the Purchases admin screen, or "Add Purchase" inside wizard step 2) and by `database/seed.sql`.

> A purchase-less return is legal in the domain — `return_requests.purchase_id` is nullable and the REST `POST /api/returns` accepts a return without one. The **wizard** is what insists on a purchase, not the model.

### Driver photo
A pickup photo captured by the driver (`DRIVER_PRODUCT_IMAGE`, `DRIVER_DISTANT_IMAGE`, or `DRIVER_DEFECT_IMAGE`). Excludes the `DRIVER_SIGNATURE`, which is captured later during [[pickup-confirmation]].
