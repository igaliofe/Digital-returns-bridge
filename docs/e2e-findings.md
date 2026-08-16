# E2E Findings — Known Gaps

Gaps between what [`docs/screens.md`](screens.md) + [`CONTEXT.md`](../CONTEXT.md) say the web portal does and
what `server/src/main/` actually does, found while building the Playwright suite.

**The suite encodes intended behavior, not current behavior.** Gaps found while authoring the suite
(1-6) ship as a `test.fixme` whose body asserts the contract as documented; when one is fixed, drop
the `.fixme` — the test should already pass. Gaps found later, by running the suite (7-9), were
already covered by plain `test`s that simply failed, so they have nothing to un-skip. This file is
the backlog; the `test.fixme` comments link back here by gap number.

Each gap was re-read in the source before being written up. Status is one of **CONFIRMED** (the code
reproduces the claim as stated), **CONFIRMED, symptom qualified** (the defective construct is
definitely present; the exact runtime symptom needs a booted stack to pin down), or **FIXED** (the
defect is gone from the working tree).

**Convention for closed gaps**: the heading keeps its number and gains a `— FIXED` suffix, the
`Status` line becomes `FIXED`, `Fix shape` is replaced by `Fixed by` (what actually landed), and an
`Un-skip` bullet names the exact `test.fixme` sites a human still has to convert back to `test`.
Nothing is deleted — the number stays claimed so the `test.fixme` comments that cite it keep
resolving.

---

## GAP 1 — `RoleAuthFilter` never reads the user's role

- **Status**: CONFIRMED
- **Where**: [`server/src/main/java/com/drb/server/web/RoleAuthFilter.java:29-37`](../server/src/main/java/com/drb/server/web/RoleAuthFilter.java)
- **Symptom**: The filter pulls `loggedInUser` off the session, redirects to `/login.xhtml` when it is
  `null`, and then calls `chain.doFilter(...)` unconditionally. `user.getRole()` is never called anywhere
  in the class — the `User` import is used only for the cast. Any authenticated user of any role reaches
  `/admin/users.xhtml`, `/admin/customers.xhtml`, `/admin/products.xhtml`, `/admin/drivers.xhtml`,
  `/reports.xhtml` and `/warehouse/receiving.xhtml`. This is authorization, not cosmetics: the admin
  screens are fully functional CRUD for a DRIVER who types the URL.
- **Intended** (plan role matrix, [e2e-test-plan.md](e2e-test-plan.md#2-role--route-matrix)): a forbidden
  route returns a **redirect**, not a rendered page and not a 500.
- **Referenced by**: `e2e/tests/roles.spec.ts` — the whole denied half of the 4-role × 14-route table test
  (`test.fixme` on the "denied role is redirected away from <route>" cases).
- **Fix shape**: add an allow-list of path prefix → allowed `Role` set, check `user.getRole()` against it,
  `sendRedirect(ctx + "/dashboard.xhtml")` on a miss.

## GAP 2 — `layout.xhtml` renders all 6 nav links to every role

- **Status**: CONFIRMED
- **Where**: [`server/src/main/webapp/WEB-INF/templates/layout.xhtml:33-64`](../server/src/main/webapp/WEB-INF/templates/layout.xhtml)
  (the `<nav class="drb-nav">` block)
- **Symptom**: None of the six `h:outputLink`s — Dashboard, Returns, New Return, Warehouse, Reports,
  Admin ▾ — nor the four links in the `.drb-admin-menu` submenu carry a `rendered` attribute. A REP or
  DRIVER sees Warehouse, Reports and the whole Admin dropdown in the header. Combined with GAP 1, those
  links also work.
- **Intended** (`docs/screens.md`: Reports "Used by: Manager", Warehouse "Used by: Warehouse"): the nav
  renders only the links the logged-in role may use.
- **Referenced by**: `e2e/tests/roles.spec.ts` — `test.fixme` on "nav renders only the links <role> may
  use", asserting `LayoutNav.renderedLinks()` (DOM presence, not CSS visibility) equals the role's
  allowed set. The inventory (`e2e/inventory/routes-and-controls.ts`) already encodes the **intended**
  `roles` on `nav-new-return`, `nav-warehouse`, `nav-reports` and `nav-admin*`, each tagged `gap: 2`.
- **Fix shape**: `rendered="#{loginBean.user.role eq 'MANAGER'}"` (and the equivalents) on each link.
  Server-side `rendered`, not CSS — a hidden-but-present link is still a leak.

## GAP 3 — Admin inline row-edit wires the save into a JavaScript attribute

- **Status**: CONFIRMED, symptom qualified
- **Where**: all four admin screens —
  [`admin/users.xhtml:91-93`](../server/src/main/webapp/admin/users.xhtml),
  [`admin/customers.xhtml:84-86`](../server/src/main/webapp/admin/customers.xhtml),
  [`admin/products.xhtml:103-105`](../server/src/main/webapp/admin/products.xhtml),
  [`admin/drivers.xhtml:81-83`](../server/src/main/webapp/admin/drivers.xhtml) — each identical:

  ```xhtml
  <p:ajax event="rowEdit" listener="#{userAdminBean.setSelected(event.object)}"
          oncomplete="#{userAdminBean.saveSelected()}"
          update="usersForm"/>
  ```

- **Symptom**: `oncomplete` is a **client-side JavaScript** attribute. The EL inside it is evaluated
  server-side during the render phase and its result is emitted as the JS body — it is not a listener.
  `saveSelected()` returns `void`, so the browser receives an empty `oncomplete`. The persistence call is
  therefore driven by *when the component tree renders*, not by the user clicking the row-editor's check
  mark. Two consequences worth separating:
  - The click on ✓ has no client-side save wired to it. Only `listener="…setSelected(event.object)"` is a
    real listener, and `setSelected` does not persist.
  - Because `update="usersForm"` re-renders the table inside the same ajax response, the `oncomplete` EL
    is re-evaluated during that render — *after* `setSelected` ran — so the row may in fact be saved as a
    render-phase side effect, at an unspecified point in the JSF lifecycle. It also means
    `saveSelected()` (and its `FacesMessage "User updated"`) fires on **every** render of the form,
    including the initial page load with `selected == null`.
  Which of these you observe is lifecycle-order dependent, and confirming it requires booting the stack
  (out of scope for this authoring pass). Either way the construct is wrong and the observable behavior
  is not the documented one.
- **Intended**: clicking the row-editor ✓ persists the edited row and surfaces one `INFO` message; the
  new value survives a reload and is visible through `GET /api/{users,customers,products,drivers}`.
- **Referenced by**: `e2e/tests/admin.spec.ts` — `test.fixme` "inline row-edit persists" on each of the
  four pages. The inventory tags `row-save` with `gap: 3` on all four admin routes;
  `AdminCrudPage.commitRowEdit()` is the helper.
- **Fix shape**: move persistence into the listener —
  `listener="#{userAdminBean.onRowEdit(event)}"` doing `setSelected` + `save`, and keep `oncomplete` for
  actual JS (or drop it).

## GAP 4 — `ReturnDetailsBean.init()` parses `?id=` without guarding, and there is no error page — FIXED

- **Status**: FIXED (the parse guard; the missing `<error-page>` half is still open — see below)
- **Where**: [`server/src/main/java/com/drb/server/web/ReturnDetailsBean.java:32-42`](../server/src/main/java/com/drb/server/web/ReturnDetailsBean.java)

  ```java
  String idParam = params.get("id");
  if (idParam != null) {
      id = Long.parseLong(idParam);   // line 37 — no try/catch
  ```

  and [`server/src/main/webapp/WEB-INF/web.xml`](../server/src/main/webapp/WEB-INF/web.xml) declares **no**
  `<error-page>` (no `<exception-type>`, no `<error-code>`).
- **Symptom**: `/returns/details.xhtml?id=abc` throws `NumberFormatException` out of `@PostConstruct` and,
  with no error page mapped, the container serves a raw stack-trace 500. A hand-edited or stale URL
  becomes a server error instead of a message.
- **Intended** (plan journey 5): a non-numeric `?id=` **must not 500** — the screen shows the same
  "return not found" warn state it shows for an unknown numeric id, with a 200.
- **Referenced by**: `e2e/tests/details.spec.ts` — `test.fixme` "non-numeric ?id does not 500"
  (`ReturnDetailsPage.gotoId('abc')` accepts a `string` specifically so this case can be probed), plus
  the response-status assertion in `routes.smoke.spec.ts`.
- **Fixed by**: `ReturnDetailsBean.init()` now routes `idParam` through a new
  `private static Long parseId(String)` that returns `null` for null/blank/non-numeric input
  ([`ReturnDetailsBean.java:38,47`](../server/src/main/java/com/drb/server/web/ReturnDetailsBean.java)).
  `id`, `returnRequest`, `images` and `statusHistory` are only assigned when the parse succeeded, so
  `?id=abc` makes **no** repository call and falls through to the existing
  `rendered="#{returnDetailsBean.returnRequest == null}"` not-found block with a 200.
- **Un-skip**: [`e2e/tests/details.spec.ts:324`](../e2e/tests/details.spec.ts) `test.fixme` →
  `test` ("non-numeric ?id=abc renders the not-found warning instead of a 500"), and
  [`e2e/tests/routes.smoke.spec.ts:300`](../e2e/tests/routes.smoke.spec.ts) `test.fixme` → `test`
  ("/returns/details.xhtml?id=abc answers with the not-found state, never a 5xx"). Neither is
  exercised until the `.fixme` is dropped — the fix does not move the pass count on its own.
- **Still open — the `<error-page>` half**: `web.xml` still declares no `<error-page>`, and the
  *numeric but nonexistent* id path is unchanged: `returnService.getById(id)`
  ([`ReturnRequestService.java:127`](../server/src/main/java/com/drb/server/service/ReturnRequestService.java))
  throws `NotFoundException` out of `@PostConstruct`, so `?id=999999999` is still a raw 500. That is
  sub-point (a) of GAP 6's second `test.fixme`, one line away from the fix that landed.

## GAP 5 — Create-return form offers priority values the domain does not use

- **Status**: CONFIRMED
- **Where**: [`server/src/main/webapp/returns/create/new-return.xhtml:98-102`](../server/src/main/webapp/returns/create/new-return.xhtml)

  ```xhtml
  <p:selectOneMenu id="priority" value="#{createReturnWizardBean.priority}">
      <f:selectItem itemLabel="Normal" itemValue="NORMAL"/>
      <f:selectItem itemLabel="High"   itemValue="HIGH"/>
      <f:selectItem itemLabel="Urgent" itemValue="URGENT"/>
  </p:selectOneMenu>
  ```

- **Symptom**: The rest of the system uses `LOW` / `MEDIUM` / `HIGH` — `database/seed.sql` contains only
  those three (13 × `LOW`, 17 × `MEDIUM`, 15 × `HIGH`; zero `NORMAL`, zero `URGENT`). There is no
  `Priority` enum: `ReturnRequest.priority` is a plain `String` on `VARCHAR(20)`
  (`database/schema.sql:73`) with no check constraint, so `NORMAL` and `URGENT` persist silently. Every
  return created through the web wizard lands on a priority value that the returns-list priority filter
  and the reports grouping do not know about, and `LOW` is unreachable from the UI.
- **Intended**: the wizard's priority options are exactly the domain's `LOW` / `MEDIUM` / `HIGH`.
- **Referenced by**: `e2e/tests/wizard.spec.ts` — `test.fixme` "priority options match the domain
  values", asserting `NewReturnPage.priorityValues()` equals `['LOW','MEDIUM','HIGH']`. The happy-path
  wizard test does **not** set priority, so it is unaffected.
- **Fix shape**: change the three `f:selectItem` values (and decide the wizard default — the domain
  default elsewhere is `MEDIUM`). Lowest-risk of the five; also the only one that has already written bad
  data into any environment where the web wizard has been used.

## GAP 6 — `p:message` with no `for` NPEs the whole return-details screen — FIXED

- **Status**: FIXED
- **Where**: [`server/src/main/webapp/returns/details.xhtml`](../server/src/main/webapp/returns/details.xhtml)
  — the not-found notice (was line 16) and the barcode notice (was line 103), each:

  ```xhtml
  <p:message severity="warn" summary="Barcode not assigned" detail="…"/>
  ```

- **Symptom**: `p:message` has no `summary`/`detail` attributes — it renders the queued
  `FacesMessage`s of the component `for` resolves to. With `for` absent,
  `SearchExpressionFacade.resolveComponent` returns `null` and `MessageRenderer.encodeEnd` NPEs on
  `getClientId()`, so the *whole page* 500s instead of showing a warning. That took out every
  barcode-less return (`OPEN`, `WAITING_FOR_PICKUP`) and the not-found state on the same screen.
- **Intended**: the two states render a warn box and a 200.
- **Fixed by**: both tags replaced with the plain `<div class="ui-message ui-message-warn ui-widget
  ui-corner-all">` + `ui-message-warn-{icon,summary,detail}` spans that PrimeFaces 13's
  `MessageRenderer` emits ([`details.xhtml:19-22`](../server/src/main/webapp/returns/details.xhtml)
  and `:111-114`), each inside its original `ui:fragment rendered=` condition. There is no
  `FacesMessage` behind either state, so `p:messages` would have rendered nothing; the
  `ui-message-warn` class is load-bearing — `e2e/pages/return-details.ts:44,51` select on it. Zero
  `<p:message` tags remain in the file.
- **Un-skip**: [`e2e/tests/details.spec.ts:150-167`](../e2e/tests/details.spec.ts) — the
  `if (BARCODE_LESS.has(status)) { test.fixme(…) } else { test(…) }` fork in the "renders the full
  return file for a <status> return" loop. Collapse it to a single `test(title, …)` with the same
  body; that converts the `OPEN` and `WAITING_FOR_PICKUP` cases from skipped to live. `BARCODE_LESS`
  (declared at `:44-53`) then has no remaining reader and should go with it.
- **Still `test.fixme`**: [`e2e/tests/details.spec.ts:295`](../e2e/tests/details.spec.ts)
  ("unresolvable ?id renders the not-found warning, not a server error") cites GAP 6 but stacks two
  defects, and only sub-point (b) — this one — is fixed. Sub-point (a),
  `returnService.getById(999999999)` throwing `NotFoundException` with no `<error-page>`, still 500s;
  see GAP 4. Leave it skipped and trim its comment to (a) when that lands.
- **Note on the number**: three specs independently wrote "GAP 6" for three different findings
  (`wizard.spec.ts:210,404` — wizard buttons with no `update`, so `p:messages` never re-renders;
  `warehouse.spec.ts:431` — "Call Fully Handled" never chains to `CLOSED`). Neither of those is this
  gap and neither is fixed. This file owns the numbering; those comments need renumbering when their
  findings are written up.

## GAP 7 — `admin/drivers.xhtml` bound `p:selectOneMenu` to a `User` entity with no converter — FIXED

- **Status**: FIXED
- **Where**: [`server/src/main/webapp/admin/drivers.xhtml:104-109`](../server/src/main/webapp/admin/drivers.xhtml)
  and [`DriverAdminBean.java`](../server/src/main/java/com/drb/server/web/DriverAdminBean.java) — the
  create dialog's user picker bound `value="#{driverAdminBean.newDriver.user}"` with
  `itemValue="#{u}"`.
- **Symptom**: JSF has no implicit converter for an entity type, so the submitted option value came
  back as a string and conversion failed with
  `Conversion Error setting value 'com.drb.server.domain.User@…' for 'null Converter'`. The lifecycle
  stopped at Apply Request Values, the model was never updated and `saveNew()` never ran — **driver
  creation was impossible from the web portal**. GAP 9 hid the evidence: the dialog re-rendered
  itself closed, so the conversion message was never seen either.
- **Intended**: picking a user account and saving creates the driver; `GET /api/drivers` returns it.
- **Fixed by**: the menu binds the id instead — `value="#{driverAdminBean.newUserId}"` and
  `itemValue="#{u.id}"` (a `Long`, so the implicit `LongConverter` applies). `DriverAdminBean` gained
  `private Long newUserId` plus accessors; `saveNew()` resolves it first
  (`newDriver.setUser(userService.findById(newUserId))`) and clears it on success, `prepareCreate()`
  clears it alongside `newDriver = new Driver()`. The `<f:selectItem itemValue="#{null}"/>`
  placeholder submits `""`, which `LongConverter` maps to `null` (not `0`), so `required="true"`
  still trips on it. `UserService.findById` throws `NotFoundException` for a bad id, which the
  existing `catch (Exception e)` already turns into a SEVERITY_ERROR message — no new failure mode.
  `Driver.user` is `@ManyToOne` with no cascade, so persisting with a detached `User` just writes
  `user_id`.
- **Referenced by**: `e2e/tests/admin.spec.ts:541` ("admin/drivers: the New Driver dialog creates the
  driver and GET /api/drivers returns it") — a plain `test`, failing outright, not a `test.fixme`.
  Nothing to un-skip.

## GAP 8 — `GET /api/returns/{id}/status-history` 500s on a lazy `changedByUser` proxy — FIXED

- **Status**: FIXED
- **Where**: [`ReturnRequestService.getStatusHistory(Long)`](../server/src/main/java/com/drb/server/service/ReturnRequestService.java)
  (line ~395), consumed by
  [`StatusHistoryDto.java:26`](../server/src/main/java/com/drb/server/rest/dto/StatusHistoryDto.java).
- **Symptom**: the service called `statusHistoryRepo.findByReturnRequestId(returnId)`, which does not
  fetch the `changedByUser` association. By the time `StatusHistoryDto.from(...)` calls
  `sh.getChangedByUser().getFullName()` the entity is detached, so Hibernate throws
  `LazyInitializationException` and the endpoint answers 500. `getId()` on the same proxy is served
  without initialisation, which is why the DTO got as far as the name field before throwing.
- **Intended**: the status trail serialises for any return; the details screen's timeline and the
  `/timeline` endpoint read it.
- **Fixed by**: switched to the already-existing fetch-join variant
  `findByReturnRequestIdWithUser(returnId)`
  ([`StatusHistoryRepository.java:32`](../server/src/main/java/com/drb/server/repository/StatusHistoryRepository.java),
  `LEFT JOIN FETCH s.changedByUser`), which initialises the association inside the persistence
  context so the detached entity is self-sufficient — the same approach `ReturnDetailsBean` already
  relied on. No `@Transactional` added. Both callers benefit
  ([`ReturnResource.java:157`](../server/src/main/java/com/drb/server/rest/ReturnResource.java)
  `/timeline` and `:234` `/status-history`). Side effect: the no-fetch-join
  `StatusHistoryRepository.findByReturnRequestId` (line 24) now has **zero** callers repo-wide; left
  in place.

## GAP 9 — all four admin create dialogs re-rendered themselves hidden on validation failure — FIXED

- **Status**: FIXED
- **Where**: the Save button of the create dialog on all four admin screens —
  [`admin/users.xhtml`](../server/src/main/webapp/admin/users.xhtml),
  [`admin/customers.xhtml`](../server/src/main/webapp/admin/customers.xhtml),
  [`admin/products.xhtml`](../server/src/main/webapp/admin/products.xhtml),
  [`admin/drivers.xhtml`](../server/src/main/webapp/admin/drivers.xhtml) — each carried
  `update="…Form createDialog …createForm"`.
- **Symptom**: `createDialog` in the Save button's `update` list re-renders the `p:dialog` markup
  itself, and PrimeFaces re-emits it in its initial (hidden) state. A validation failure therefore
  *closed* the dialog — visually identical to a successful save — and took the `p:message` text with
  it. Nothing told the user why the record was not created.
- **Intended**: a failed validation leaves the dialog open with the messages rendered in place.
- **Fixed by**: `createDialog` dropped from the Save button's `update` on all four, leaving
  `<listForm> <createForm>` (`usersForm createUserForm`, `customersForm createCustomerForm`,
  `productsForm createProductForm`, `driversForm createDriverForm`). The inner create form is still
  updated, so the `p:message` text re-renders where it belongs. The `oncomplete`
  `if (!args.validationFailed) PF('…Dlg').hide()` guards and the widgetVars are untouched, and the
  toolbar "New …" buttons (line 23 on each screen) deliberately keep `update="…Form createDialog"` —
  they call `.show()` immediately after. Each Save button now carries a comment warning against
  re-adding it.
- **Referenced by**: `e2e/tests/admin.spec.ts:170, 321, 463, 589` ("saving with the required fields
  empty keeps the dialog open and creates nothing"). Plain `test`s — nothing to un-skip.
- **Caveat, not a regression**: those four tests now get past the dialog-open assertion and fail on
  the *next* line. `admin.spec.ts:121` expects `REQUIRED_MESSAGE = /Value is required/i`, but every
  required field in these dialogs carries a Hebrew `requiredMessage`
  (`users.xhtml:126,137`, `customers.xhtml:124`, `products.xhtml:135`, `drivers.xhtml:105`
  `יש לבחור משתמש`), which replaces the JSF default text entirely. Spec text vs. Hebrew messages
  still needs reconciling — the Hebrew predates this pass and is intentional, so the spec constant is
  the side that should move.
- **Resolved**: `REQUIRED_MESSAGE` is now `/יש (להזין|לבחור)/` (`admin.spec.ts:119-126`), matching the
  shared prefix of the Hebrew messages rather than any single one.

---

## GAP 10 — `Delete` on the admin screens deleted nothing — FIXED

- **Status**: FIXED
- **Where**: [`CustomerService.java:58`](../server/src/main/java/com/drb/server/service/CustomerService.java),
  [`ProductService.java:55`](../server/src/main/java/com/drb/server/service/ProductService.java),
  [`UserService.java:54`](../server/src/main/java/com/drb/server/service/UserService.java),
  [`DriverService.java:39`](../server/src/main/java/com/drb/server/service/DriverService.java).
- **Symptom**: four different behaviours behind one button. `CustomerService.delete` called
  `customerRepo.save(customer)` — a no-op that reported success; `ProductService.delete` called
  `findById(id)` and discarded the result; users and drivers were soft-deleted via
  `setActive(false)`, so the row stayed in the table and in `GET /api/…`. No repository except
  `ReturnImageRepository` exposed a hard delete at all. The confirm dialog says "Delete X?" and the
  row survives it.
- **Intended**: the row disappears from the table and from the REST list, matching the button.
- **Fixed by**: a `delete(Long id)` on each of the four repositories (`em.find` + `em.remove`, no-op
  when already gone, mirroring `ReturnImageRepository:36`), with each service keeping its `findById`
  so a missing id still 404s. Deactivating is unchanged and remains a separate operation —
  `PATCH /users/{id}/active` for users, the Active checkbox in the row editor for drivers.
- **Referenced by**: `admin.spec.ts:196, 347, 489, 615` — plain `test`s, nothing to un-skip.
- **Note**: deleting a still-referenced row now genuinely fails instead of silently succeeding; that
  surfaces as a 409 rather than a 500, see the integrity-violation entry below.

---

## GAP 11 — `DriverDto.phone` reported the account's phone, not the driver's — FIXED

- **Status**: FIXED
- **Where**: [`DriverDto.java:21`](../server/src/main/java/com/drb/server/rest/dto/DriverDto.java).
- **Symptom**: `dto.phone = d.getUser().getPhoneNumber()`, while the admin screen edits and renders
  `drivers.phone` (`admin/drivers.xhtml:42-52` binds the column to `#{d.phone}`). The API and the UI
  disagreed about the same field. Every seeded driver has the two values equal
  (`drivers` 1 and 2 both `0502222222` / `0506666666`), which is why it went unnoticed — only a row
  created through the New Driver dialog, which sets a distinct driver phone, exposes it.
- **Intended**: the DTO reports the driver's own contact number.
- **Fixed by**: `dto.phone = d.getPhone()`, falling back to the linked account's number when the
  driver has none, so rows that never set one keep their previous value.
- **Referenced by**: `admin.spec.ts:582` — a plain `test`.

---

## GAP 12 — wizard step 3 "Back" ran the form's validation — FIXED

- **Status**: FIXED
- **Where**: [`returns/create/new-return.xhtml:166`](../server/src/main/webapp/returns/create/new-return.xhtml).
- **Symptom**: the Back `p:commandButton` carried neither `immediate` nor `process`, so it submitted
  and validated the whole step-3 form. On a half-filled step 3 the `required` Free-text Notes failed
  first, the navigation outcome never ran, and the button silently did nothing.
- **Intended**: Back returns to step 2 regardless of what step 3 currently holds.
- **Fixed by**: `immediate="true" process="@this"`. `backToStep2()` only returns a navigation
  outcome, so skipping the form is safe.
- **Referenced by**: `wizard.spec.ts:321` and `routes.smoke.spec.ts:619` (all three roles).

---

## Integrity violations answered 500 — FIXED

- **Where**: [`ExceptionMappers.java`](../server/src/main/java/com/drb/server/rest/exception/ExceptionMappers.java),
  `GenericMapper`.
- **Symptom**: `POST /api/users` with an existing phone number produced a raw
  `org.hibernate.exception.ConstraintViolationException` → `INTERNAL_ERROR` 500. The existing
  `ConstraintViolationMapper` does not catch it: that one maps *Bean Validation*'s identically-named
  `jakarta.validation.ConstraintViolationException` to 400.
- **Fixed by**: `GenericMapper` now inspects the cause chain for a `SQLException` whose SQLState is
  class 23 (integrity constraint violation) before falling through to 500 — `23505` → 409
  `DUPLICATE_RESOURCE`, `23503` → 409 `RESOURCE_IN_USE`. Matched on SQLState rather than the
  Hibernate type on purpose: the class name collides with Bean Validation's and it lives in a
  WildFly-provided module the build does not compile against.

---

## Harness defect — the suite tested a week-old WAR (~120 of 171 failures)

Not a product gap, but it masked every one above and inflated the failure count, so it belongs in the
backlog's history.

- **Where**: [`e2e/global-setup.ts`](../e2e/global-setup.ts), `resetStack()`.
- **Symptom**: `resetStack()` ran `./dev.sh nuke` then `./dev.sh up`. `nuke` drops the DB volume, but
  **`up` does not build** — it recreates the container from the last image that was built. The suite
  therefore reset the data and then pointed itself at a WAR compiled on **Aug 8**, while every
  `data-testid` the page objects select on landed **Aug 15** in commit `d59e8cd`. Roughly **120 of
  the 171 failures** were selectors timing out on markup that exists in the source tree and not in
  the deployment — failures with no defect behind them, sitting on top of the real ones.
- **Fixed by**: `resetStack()` now runs `nuke` followed by `docker:rebuild` — the exact task string
  `dev.sh` dispatches (`dev.sh:80` → `docker_rebuild` = `compose build server` + `up -d`), and
  compose builds from context `..`, so what ships is the working tree. `E2E_SKIP_BUILD=1` downgrades
  it back to `up` for fast test-only iteration; `E2E_SKIP_STACK=1` is untouched. The doc comment now
  names both stale things — the DB volume *and* the WAR image; it previously explained only the DB
  reset, which is exactly the blind spot that shipped the week-old build.
- **Plus a freshness assertion**: `FRESH_BUILD_MARKERS` + `assertFreshDeploy(url, html)`
  (`global-setup.ts:159-181`), called from `waitForApp()` once the app answers 200, aborting with a
  banner that names `./dev.sh docker:rebuild`. It runs **after** the retry loop, not inside it —
  inside, the loop's existing `catch (err)` would have swallowed the abort and turned a stale deploy
  into a silent five-minute poll.
- **Why `login.xhtml` is the sentinel page**: `RoleAuthFilter` redirects every other `.xhtml` to
  login when unauthenticated, so it is the only page reachable before the check has anything to check
  with. It is standalone — it does not use `WEB-INF/templates/layout.xhtml`, where the
  `pt:data-testid` nav links live — so it carries **zero** `data-testid`, and a plain testid check
  would have false-alarmed on every run. The marker used instead is the client id
  `loginForm:phoneMsg`, which PrimeFaces renders for `<p:message id="phoneMsg" for="phone">` whether
  or not a message is queued; the Aug-8 WAR rendered `loginForm:j_idt9` and no `phoneMsg`, verified
  against the failed run's own trace resource. `data-testid` is kept as a second marker so that
  adding testids to the login page later cannot turn this into a false alarm.
- **Known fragility, still open**: `loginForm:phoneMsg` exists only in the **uncommitted working
  tree** — `git show HEAD:server/src/main/webapp/login.xhtml` has `<p:message for="phone"
  display="text"/>` with no `id`. A build from `HEAD` (fresh clone, branch switch, stashed diff)
  renders `loginForm:j_idt9`, neither marker matches, and global-setup aborts claiming the WAR is
  stale on a WAR that was just built — with a remedy that will not help. Re-point the marker at
  something committed, or let it be once `login.xhtml` is committed.

---

## Suite defects found while draining the failure list

Test-side bugs, not product gaps. Recorded because each hid a real result and the same mistakes are
easy to repeat.

- **`:text-is()` on a `<td>` can never match an editable column** (`e2e/pages/admin.ts`). Playwright's
  `:text-is()` matches only the *smallest* element holding the text; every `p:cellEditor` column wraps
  its value in `div.ui-cell-editor-output`, so `td:nth-child(n):text-is("…")` silently matches nothing.
  `rowById` worked only because the ID column is a plain `<td>`. All eight per-screen matchers now go
  through `rowByCell(column, value)`, which filters the cell by an anchored regex and handles both
  cell shapes.
- **`p:panelGrid` is tabless in PrimeFaces 13** — `.ui-panelgrid-cell` divs, not `<td>`, with the label
  text in a nested `span.ui-outputlabel-label`. Three separate selectors assumed a table:
  `pages/warehouse-receiving.ts:149`, and `pages/wizard.ts` for both the customer panel and the
  Selected Item fieldset.
- **`p:signature` has no `ui-signature` class** (`pages/wizard.ts:380`). PrimeFaces renders
  `div.ui-inputfield` holding `_value` / `_base64` hidden inputs; the jQuery plugin adds only its own
  widget class, client-side. Anchored on the `_base64` input instead.
- **JSON-B omits null properties**, so a DTO field typed `string | null` reads `undefined`. Hit
  `list.spec.ts` (`barcode`) and `wizard.spec.ts` (`barcode`, `driverId`) — `toBeNull` → `toBeFalsy`.
- **`workerIndex` is not a slot id** — Playwright bumps it on every worker *respawn*. It leaked twice:
  `fixtures/auth.ts` wrote 968 storage-state files in one run, and `fixtures/data.ts:158` generated
  `0599<workerIndex % 10><counter>` phones that collided once respawns passed ten, which is what made
  `POST /users` return duplicate-key errors. Now `parallelIndex` and a per-process salt respectively.
- **Single-sample `count()` races an ajax rebuild** — `findRowAcrossPages` and `setRowsPerPage` both
  read the DOM once, immediately after a PrimeFaces update. Now a per-page `waitFor` and an
  `expect.poll`.
- **Column-header clicks land on the filter input** when a column has `filterBy`
  (`pages/returns-list.ts`); click `.ui-sortable-column-icon` instead.

---

## Additional observations (no test asserts on them)

Found while reading for the suite. Neither blocks the suite; both are one-line fixes.

- **`returns/details.xhtml:41-44`** — `rendered="#{empty …}"` is placed on a plain
  `<span class="drb-catalog-placeholder">`. `rendered` is a JSF component attribute and is **inert** on
  static markup, so Facelets passes it through as a no-op HTML attribute: the "Catalog image" placeholder
  text always renders, including stacked behind a real `p:graphicImage` when the product does have an
  `imageUrl`. Consequence for spec authors: the `.drb-catalog-box` element always contains the string
  "Catalog image" — never assert its absence. Fix: wrap the span in `<h:panelGroup rendered="…">` or use
  `<ui:fragment>`.
- **`server/src/main/webapp/WEB-INF/includes/wizard-steps.xhtml`** — dead file.
  `grep -rn wizard-steps server/src/main/` returns nothing; no `ui:include` or `ui:decorate` references
  it. The live step indicator is the `.drb-wizard-step` `<p>` on each of the three step pages, which is
  what carries the `wizard-current-step` / `data-step` hooks. Fix: delete it, or wire it up so the three
  step pages stop duplicating the indicator.
