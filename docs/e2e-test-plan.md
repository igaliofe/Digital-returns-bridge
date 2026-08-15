# E2E Test Plan — JSF Web Portal

The checked-in requirements document for `e2e/`. It states what the browser suite must prove, which spec
proves it, and when the suite is done. It is the contract the specs are written against — when the app
and this document disagree, one of them is a bug, and [`docs/e2e-findings.md`](e2e-findings.md) records
which.

**Sources of truth**: [`docs/screens.md`](screens.md) (what each screen does),
[`CONTEXT.md`](../CONTEXT.md) (domain language), [`docs/api.md`](api.md) (the oracle endpoints).

---

## 1. Scope and principles

The portal has 14 navigable routes across 13 Figma frames and had **zero** browser-level coverage before
this suite — only JUnit/Mockito over beans and services. Nothing proved that a button posts, that a route
redirects when logged out, or that a UI action actually changed server state.

| Principle | Consequence |
|---|---|
| The UI is the system under test | Every assertion is driven through the browser. `/api` is **fixture setup and state oracle only** — never the thing being tested. |
| Intended behavior, not current behavior | Where code contradicts the docs, the spec asserts the docs and ships as `test.fixme` citing a gap in [e2e-findings.md](e2e-findings.md). The gaps are a visible backlog, not baked-in regressions. |
| Every route, every control, every role | The route/control inventory is machine-checked (§7). A new button in an `.xhtml` fails the build until it is inventoried and tested. |
| A UI action must move server state | Clicking is not passing. Every mutating journey re-reads the entity through `/api` and asserts the new status/field/image. |
| Deltas, never absolute counts | Specs run `fullyParallel` and create returns concurrently. KPI assertions are read → act → re-read → assert the delta. |

**Out of scope for this change**: CI pipeline, non-Chromium browsers, the Android surfaces (frames 14–24),
visual-regression/screenshot diffing, load or accessibility testing.

---

## 2. Role → route matrix

The access rules the suite encodes. DRIVER has the same *web* rights as SERVICE_REP — login is valid and
lands on `/dashboard.xhtml`; the Android app is an additional surface, not a replacement.

| # | Route | REP | DRIVER | WAREHOUSE | MANAGER |
|---|---|:--:|:--:|:--:|:--:|
| 1 | `/login.xhtml` | ✓ | ✓ | ✓ | ✓ |
| 2 | `/dashboard.xhtml` | ✓ | ✓ | ✓ | ✓ |
| 3 | `/returns/list.xhtml` | ✓ | ✓ | ✓ | ✓ |
| 4 | `/returns/details.xhtml?id=N` | ✓ | ✓ | ✓ | ✓ |
| 5 | `/returns/create.xhtml` (redirects to step 1) | ✓ | ✓ | — | ✓ |
| 6 | `/returns/create/identify-customer.xhtml` | ✓ | ✓ | — | ✓ |
| 7 | `/returns/create/select-item.xhtml` | ✓ | ✓ | — | ✓ |
| 8 | `/returns/create/new-return.xhtml` | ✓ | ✓ | — | ✓ |
| 9 | `/warehouse/receiving.xhtml` | — | — | ✓ | ✓ |
| 10 | `/reports.xhtml` | — | — | — | ✓ |
| 11 | `/admin/users.xhtml` | — | — | — | ✓ |
| 12 | `/admin/customers.xhtml` | — | — | — | ✓ |
| 13 | `/admin/products.xhtml` | — | — | — | ✓ |
| 14 | `/admin/drivers.xhtml` | — | — | — | ✓ |

Rules asserted on top of the matrix:

- **R1** — a logged-out request to any `.xhtml` other than `/login.xhtml` redirects to `/login.xhtml`.
- **R2** — a forbidden route for a logged-in role produces a **redirect**, never a rendered page and never
  a 5xx. *(blocked by GAP 1)*
- **R3** — `layout.xhtml` renders only the nav links the role may use, server-side. A link hidden by CSS
  is still a failure. *(blocked by GAP 2)*
- **R4** — login landing is `/warehouse/receiving.xhtml` for WAREHOUSE and `/dashboard.xhtml` for every
  other role (`LoginBean:41-44`).
- **R5** — logout invalidates the `HttpSession`; the browser Back button cannot re-enter an authenticated
  screen.

**Seeded actors**: `0501111111` Alice Cohen (SERVICE_REP), `0502222222` Bob Levi (DRIVER),
`0503333333` Carol Mizrahi (WAREHOUSE), `0504444444` David Katz (MANAGER).

---

## 3. Environment and preconditions

- App deploys as **`ROOT.war`** → context root is `/`. There is **no** `/digital-returns-bridge` path
  prefix (the stale constant in `dev.sh` is not used by the suite).
- `baseURL = http://localhost:8080`, override with `E2E_BASE_URL`. REST base `/api`.
- Playwright: Chromium only, `fullyParallel: true`, `retries: 1`, `trace: 'on-first-retry'`,
  test timeout 90 s, expect 15 s, action 20 s, navigation 45 s, viewport 1440×900.
- **Cloudinary credentials in `infra/.env` are required.** `global-setup.ts` preflights them and fails
  fast — image-upload and signature paths are always exercised, never skipped.
- `global-setup.ts` runs `./dev.sh nuke && ./dev.sh up`, then polls `GET /login.xhtml` until 200.
  `database/seed.sql` only executes on a fresh volume (mounted into `docker-entrypoint-initdb.d`), so the
  nuke is what makes the seed deterministic. **No spec boots or resets anything.**
  `E2E_SKIP_STACK=1` is the local escape hatch when a stack is already up.

---

## 4. Test data strategy

| Resource | Strategy |
|---|---|
| **Returns** | Never touch seeded `RET-100xx`. `data.makeReturn(status)` does `POST /api/returns` → `PATCH /{id}/assign-barcode` with a unique `RET-E2E-<n>` → `PATCH /{id}/status` along the server-enforced transition table until the target status. All 8 statuses are reachable. Warehouse specs own their barcode outright. |
| **Customers** | Each worker exclusively claims customer `(workerIndex % 20) + 1` (phone `0521<id padded>`). Workers never read or mutate each other's customer. |
| **Purchases** | **Finite, non-renewable.** No API creates `customer_purchases`, so wizard specs consume seeded rows from their claimed customer. `handled = product_id % 5 == 0` → ~3 of every 4 rows selectable. `makeReturn` deliberately omits `purchaseId` so it never burns a wizard row. |
| **Dashboard / reports KPIs** | Deltas only. Read the tile, act, re-read, assert the difference. Never assert an absolute count. |
| **Admin CRUD** | Rows created with an `e2e-<uuid8>` name prefix and deleted in `afterEach`. There is **no** DELETE endpoint for users/customers/products/drivers — cleanup is UI-only, through the same destructive control the test just exercised. |
| **Sessions** | One `storageState` per role per worker. `CreateReturnWizardBean` is `@SessionScoped`, so **wizard specs and any session-lifecycle assertion must use `loginAs(role)`** (fresh context, real UI login), never the shared `repPage`. |

---

## 5. Journey specs — requirements

Ten spec files under `e2e/tests/`. Each requirement below is one or more `test()` blocks.

### 5.1 `auth.spec.ts` — authentication and session lifecycle

| ID | Requirement |
|---|---|
| A1 | Each of the 4 roles logs in with its seeded phone and lands on `LANDING_PATH[role]` (R4). |
| A2 | DRIVER (`0502222222`) specifically logs in and lands on `/dashboard.xhtml` — not rejected as "mobile only". |
| A3 | An unknown phone shows `User with id <phone> not found` inside `#loginForm:msgs` **without navigating**. |
| A4 | A user deactivated over the API first is rejected with `User account is inactive`; the test reactivates in `afterEach`. |
| A5 | Empty submit shows `Phone number is required`; the page stays on `/login.xhtml`. |
| A6 | Logout invalidates the session and the browser Back button cannot re-enter the authenticated screen (R5). |
| A7 | A logged-out request to a representative protected route redirects to `/login.xhtml` (R1) — uses the anonymous `page` fixture. |

`#loginForm:msgs` is `showSummary="false" showDetail="true"` — assert the **detail** text; the summary
"Login failed" never renders.

### 5.2 `roles.spec.ts` — the access matrix

| ID | Requirement |
|---|---|
| RL1 | Table test over 4 roles × 14 routes: an allowed route renders its screen with a 2xx. |
| RL2 | A denied route redirects — asserted as landing on a route the role may use, with no 5xx and no rendered forbidden screen (R2). **`test.fixme` — GAP 1.** |
| RL3 | For each role, `LayoutNav.renderedLinks()` (DOM presence) equals exactly that role's allowed nav set (R3). **`test.fixme` — GAP 2.** |
| RL4 | The Admin ▾ submenu's four links are present for MANAGER and absent for everyone else. **`test.fixme` — GAP 2.** |
| RL5 | R1 as a table: every route, logged out, redirects to `/login.xhtml`. |

### 5.3 `wizard.spec.ts` — create-return, 3 steps

Uses `loginAs('REP')` / `loginAs('MANAGER')` exclusively (`@SessionScoped` bean).

| ID | Requirement |
|---|---|
| W1 | **Happy path**: step 1 phone → step 2 pick an *Available* row → step 3 fill required Notes, reason/defect enums, driver, upload general + defect photos, **draw the signature with real mouse strokes** → Create → lands on `details.xhtml?id=N`. |
| W2 | Oracle for W1: `api.statusOf(N) == 'WAITING_FOR_PICKUP'`; `api.getPurchase(customerId, purchaseId).handled == true`; `api.imageTypesOf(N)` contains `SERVICE_GENERAL_IMAGE`, `SERVICE_DEFECT_IMAGE` and `SERVICE_REP_SIGNATURE`. (`ReturnRequestDto` has no `purchaseId` — read the purchase, not the return.) |
| W3 | `/returns/create.xhtml` redirects to step 1. |
| W4 | Unknown phone at step 1 shows a not-found message and does not advance. |
| W5 | Empty phone at step 1 shows the required-field message. |
| W6 | Rows with `handled == true` render the *Handled* chip and expose **no** Select button; `handledOrderNumbers()` matches `api.handledPurchases()`. |
| W7 | Back and Cancel from step 2 and step 3 go where the screens say (step 2 → step 1, step 3 → step 2, Cancel → returns list). |
| W8 | Submitting step 3 with no signature is rejected with a validation message and creates nothing. |
| W9 | Submitting step 3 with an empty Notes (`createForm:reason`) is rejected — it is the required free-text field. |
| W10 | Deep-linking straight to `/returns/create/new-return.xhtml` with no wizard state bounces to step 1 (asserted on `data-step="1"`). |
| W11 | Priority options are exactly the domain values `LOW`/`MEDIUM`/`HIGH`. **`test.fixme` — GAP 5.** |

### 5.4 `list.spec.ts` — returns list

| ID | Requirement |
|---|---|
| L1 | Status filter narrows the table: a return seeded at status *S* appears when filtering *S* and disappears when filtering a different status. |
| L2 | Driver filter narrows to that driver's returns. |
| L3 | Customer search narrows to the worker's claimed customer. |
| L4 | Barcode search finds the worker's own `RET-E2E-*` return and nothing else. |
| L5 | The "no barcode" toggle shows only returns whose `barcode` is null (cross-checked against `api.barcodeOf`). |
| L6 | Column sort flips `aria-sort` / sort order and reorders the rows. |
| L7 | The paginator changes rows-per-page and pages forward/back. |
| L8 | The row **View** link opens `details.xhtml?id=N` for that exact row (id 5 must not match id 50). |
| L9 | Status badge text per row matches `api.statusOf(id)` for the rows the test seeded. |

### 5.5 `details.spec.ts` — return details

| ID | Requirement |
|---|---|
| D1 | For a return in **each of the 8 statuses**, the screen loads and the header badge matches `api.statusOf(id)`. |
| D2 | Customer/product/return fields match the DTO from `api.getReturn(id)`. |
| D3 | The barcode block shows the assigned barcode; a return with no barcode shows the warning instead. |
| D4 | The image gallery renders one image per `api.getImages(id)` entry and covers every `ImageType` present. |
| D5 | With no images at all, the gallery section is **absent** (`rendered="#{not empty …}"`) — assert absence, not emptiness. Same for the status timeline. |
| D6 | The status timeline's "to" column, in order, equals `api.statusTrail(id)`. |
| D7 | An unknown numeric id shows the not-found warn state, 200, no stack trace. |
| D8 | A non-numeric `?id=abc` **must not 500** — same not-found state, 200. **`test.fixme` — GAP 4.** |
| D9 | Back to List returns to `/returns/list.xhtml`. |

### 5.6 `warehouse.spec.ts` — receiving lifecycle

Every step runs against a barcode this test seeded and owns. Native `confirm()` is auto-**dismissed** by
Playwright, so every confirming action must arm `acceptConfirm` first — the page object's
`markArrivedConfirming()` / `requestMoreInfoConfirming()` do this.

| ID | Requirement |
|---|---|
| WH1 | Searching an unknown barcode shows the not-found message and renders no digital file. |
| WH2 | Searching a `PICKED_UP` barcode renders the digital file: catalog image, checklist fields, galleria, driver pickup table, both signatures. |
| WH3 | Mark as Arrived with the confirm **accepted** → `api.expectStatus(id,'ARRIVED_TO_WAREHOUSE')`. |
| WH4 | Mark as Arrived with the confirm **dismissed** → status unchanged. |
| WH5 | The inspection form appears only once the return has arrived. |
| WH6 | Save Inspection persists for **each** `WarehouseDecision` value; `api.latestInspection(id)` reflects condition + decision + notes; status → `INSPECTED`. |
| WH7 | `callFullyHandled = true` chains the return to `CLOSED`. |
| WH8 | Request More Info (confirm accepted) → `NEEDS_MORE_INFO`; dismissed → unchanged. |
| WH9 | Field values on the digital file match `api.warehouseReturn(barcode)`. |

### 5.7 `admin.spec.ts` — four CRUD screens

Runs the same shape against users, customers, products and drivers. All created rows carry the `e2e-`
prefix and are deleted in `afterEach`.

| ID | Requirement |
|---|---|
| AD1 | Create via the dialog persists — verified through `GET /api/{users,customers,products,drivers}`, not just the table. |
| AD2 | Saving the dialog with a required field empty keeps the dialog **open** and shows a validation message; nothing is created. |
| AD3 | Delete (confirm accepted) removes the row and it is gone from the API listing. |
| AD4 | Delete with the confirm **dismissed** leaves the row intact. |
| AD5 | Product create with an **image upload** persists and the row renders the thumbnail. |
| AD6 | Users: the role dropdown offers exactly `SERVICE_REP`/`DRIVER`/`WAREHOUSE`/`MANAGER`; the active flag round-trips. |
| AD7 | Drivers: the row's full name comes from the linked user and is not editable inline. |
| AD8 | Inline row-edit persists — new value survives a reload and appears in the API listing. **`test.fixme` — GAP 3** (×4 pages). |

### 5.8 `reports.spec.ts`

| ID | Requirement |
|---|---|
| R1 | All **9** KPI tiles are present and numeric (`/^\d+$/`) — the 8 dashboard tiles plus `kpi-inspected`. |
| R2 | Each of the 4 report tables renders when its data is non-empty; when empty the whole panel is **absent** — assert absence. |
| R3 | Creating a return through the API raises the relevant KPI by exactly the expected delta (read → act → re-read). |
| R4 | Tile values agree with `api.dashboard().statusCounts` at the moment of reading (missing key means 0). |

### 5.9 `dashboard` coverage

Folded into `roles.spec.ts` and `routes.smoke.spec.ts`: 8 tiles present and numeric, delta after seeding a
return, and the four action buttons (New Return, View All Returns, Reports, Warehouse Receiving) each
navigate to their declared target.

### 5.10 `routes.smoke.spec.ts` and `coverage.spec.ts`

See §7 — these are generated from the inventory rather than hand-written.

---

## 6. Coverage matrix — route × spec

Which spec is responsible for each route. `roles` and `routes.smoke` cover all 14 by construction.

| Route | roles | smoke | coverage | auth | wizard | list | details | warehouse | admin | reports |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `/login.xhtml` | ✓ | ✓ | ✓ | **✓** | | | | | | |
| `/dashboard.xhtml` | ✓ | **✓** | ✓ | ✓ | | | | | | ✓ |
| `/returns/list.xhtml` | ✓ | ✓ | ✓ | | ✓ | **✓** | | | | |
| `/returns/details.xhtml` | ✓ | ✓ | ✓ | | ✓ | ✓ | **✓** | | | |
| `/returns/create.xhtml` | ✓ | ✓ | ✓ | | **✓** | | | | | |
| `…/identify-customer.xhtml` | ✓ | ✓ | ✓ | | **✓** | | | | | |
| `…/select-item.xhtml` | ✓ | ✓ | ✓ | | **✓** | | | | | |
| `…/new-return.xhtml` | ✓ | ✓ | ✓ | | **✓** | | | | | |
| `/warehouse/receiving.xhtml` | ✓ | ✓ | ✓ | | | | | **✓** | | |
| `/reports.xhtml` | ✓ | ✓ | ✓ | | | | | | | **✓** |
| `/admin/users.xhtml` | ✓ | ✓ | ✓ | | | | | | **✓** | |
| `/admin/customers.xhtml` | ✓ | ✓ | ✓ | | | | | | **✓** | |
| `/admin/products.xhtml` | ✓ | ✓ | ✓ | | | | | | **✓** | |
| `/admin/drivers.xhtml` | ✓ | ✓ | ✓ | | | | | | **✓** | |

**Bold** = the spec that owns the route's behavior in depth; plain ✓ = touched in passing.

### Gap → spec index

| Gap | Blocks | `test.fixme` lives in |
|---|---|---|
| [1](e2e-findings.md#gap-1--roleauthfilter-never-reads-the-users-role) | R2 — role-based route denial | `roles.spec.ts` (RL2) |
| [2](e2e-findings.md#gap-2--layoutxhtml-renders-all-6-nav-links-to-every-role) | R3 — role-scoped nav | `roles.spec.ts` (RL3, RL4) |
| [3](e2e-findings.md#gap-3--admin-inline-row-edit-wires-the-save-into-a-javascript-attribute) | AD8 — inline row-edit | `admin.spec.ts` ×4 |
| [4](e2e-findings.md#gap-4--returndetailsbeaninit-parses-id-without-guarding-and-there-is-no-error-page) | D8 — non-numeric `?id` | `details.spec.ts` |
| [5](e2e-findings.md#gap-5--create-return-form-offers-priority-values-the-domain-does-not-use) | W11 — priority values | `wizard.spec.ts` |

---

## 7. Route + control inventory — the "every button" guarantee

`e2e/inventory/routes-and-controls.ts` declares, per route: path, title, allowed and denied roles, and
every interactive control — label, kind (`nav | ajax | dialog | destructive`), owning form id, selector,
and the effect clicking it must produce. Two specs consume it:

- **`routes.smoke.spec.ts`** — for every route × every allowed role: the page loads with no 5xx, no
  unexpected `p:messages` error severity and no uncaught page error; every non-conditional control is
  visible and enabled; `nav` and `ajax` controls are clicked and must produce their declared effect.
- **`coverage.spec.ts`** — scrapes every rendered `button`, `a[href]` and `input[type=submit]` on each
  route and **fails if anything is missing from the inventory**. A new button added to an `.xhtml` breaks
  the build until it is listed and tested. Known PrimeFaces chrome (paginator, dialog close ×, galleria,
  datepicker) is excluded through `PF_CHROME_SELECTORS`.

The inventory encodes the **intended** roles — `nav-new-return` REP/DRIVER/MANAGER, `nav-warehouse`
WAREHOUSE/MANAGER, `nav-reports` and `nav-admin*` MANAGER-only — each tagged `gap: 2`, and `row-save` on
all four admin pages tagged `gap: 3`. Fixing a gap therefore only requires dropping a `.fixme`, not
rewriting the inventory.

---

## 8. Test hooks added to production markup

`pt:data-testid` was added only where no stable hook existed. Everything else uses existing client ids
(`loginForm:phone`, `createForm:*`, `filterForm:*`, `searchForm:barcodeInput`, `inspectionForm:*`,
`usersForm:usersTable`, …) with `getByRole('button', { name })` scoped to the owning form.

| File | Hooks |
|---|---|
| `WEB-INF/templates/layout.xhtml` | `id="logoutForm"` (was unnamed → `j_idt*`), `logout-link`, and `nav-dashboard`/`nav-returns`/`nav-new-return`/`nav-warehouse`/`nav-reports`/`nav-admin` + the 4 `nav-admin-*` submenu links |
| `dashboard.xhtml` | 8 tiles: `kpi-open`, `kpi-waiting-pickup`, `kpi-barcode-assigned`, `kpi-picked-up`, `kpi-in-warehouse`, `kpi-closed`, `kpi-needs-more-info`, `kpi-no-barcode` |
| `reports.xhtml` | the same 8 plus `kpi-inspected`; and `report-top-return-reasons`, `report-returns-by-driver`, `report-returns-by-customer`, `report-monthly-volume` |
| `returns/details.xhtml` | `status-badge`, `barcode-block`, `image-gallery`, `status-timeline` |
| `returns/list.xhtml` | `status-badge` (one per data row) |
| the 3 wizard step pages | `wizard-current-step` + `data-step="1|2|3"` |

Conventions: KPI testids sit on the value `<span>`, not the card, so `textContent` is the bare number.
Dashboard and Reports intentionally share the `kpi-*` names (Reports adds `kpi-inspected`) — page objects
scope them. The change is **additive attributes only**: no behavior, wiring or layout was touched, and all
8 edited files parse as well-formed XML.

---

## 9. How to run

```bash
cp infra/.env.example infra/.env      # Cloudinary creds REQUIRED — the suite fails fast without them
cd e2e
npm install
npx playwright install chromium

npx playwright test                   # globalSetup nukes the DB and boots the stack
npx playwright test --workers=4       # the parallel-safety run (see §10)
npx playwright test --ui              # interactive
npx playwright show-report

npm run typecheck                     # tsc --noEmit — specs and page objects must typecheck standalone
```

Targeted runs: `npx playwright test tests/wizard.spec.ts`, or `-g "inline row-edit"`.
`E2E_SKIP_STACK=1` skips the nuke/boot when a stack is already running — **local convenience only**,
never for a verification run, since it invalidates the fresh-seed assumption.

---

## 10. Definition of done

1. Every spec passes except the declared `test.fixme`s, which cover exactly the 6 blocked requirement ids
   — RL2, RL3, RL4, AD8 (×4 admin pages), D8, W11 — and no others.
2. `coverage.spec.ts` reports **zero uninventoried controls** across all 14 routes.
3. The suite is green **twice in a row starting from a dirty database** — proving `global-setup.ts`'s
   nuke-and-reseed is what makes runs deterministic, not luck.
4. The suite is green under `--workers=4` — proving no session collisions (per-worker `storageState`,
   `loginAs` for the `@SessionScoped` wizard) and no data collisions (per-worker customer partition,
   unique `RET-E2E-*` barcodes, delta-only KPI assertions).
5. `npm run typecheck` is clean.
6. No spec asserts an absolute dashboard or report count.
7. No spec mutates seeded `RET-100xx` returns, and every `e2e-` admin row is cleaned up — a full run
   leaves the database with no `e2e-`-prefixed users, customers, products or drivers.
8. Every `test.fixme` body encodes the **intended** behavior and carries a comment naming its gap number
   and pointing at [`docs/e2e-findings.md`](e2e-findings.md).
