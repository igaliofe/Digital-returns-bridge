# E2E Findings — Known Gaps

Gaps between what [`docs/screens.md`](screens.md) + [`CONTEXT.md`](../CONTEXT.md) say the web portal does and
what `server/src/main/` actually does, found while building the Playwright suite.

**The suite encodes intended behavior, not current behavior.** Every gap below ships as a `test.fixme`
whose body asserts the contract as documented. When a gap is fixed, drop the `.fixme` — the test should
already pass. This file is the backlog; the `test.fixme` comments link back here by gap number.

Each gap was re-read in the source before being written up. Status is one of **CONFIRMED** (the code
reproduces the claim as stated) or **CONFIRMED, symptom qualified** (the defective construct is
definitely present; the exact runtime symptom needs a booted stack to pin down).

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

## GAP 4 — `ReturnDetailsBean.init()` parses `?id=` without guarding, and there is no error page

- **Status**: CONFIRMED
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
- **Fix shape**: wrap in `try/catch (NumberFormatException)` leaving `returnRequest == null` so the
  existing `rendered="#{empty …}"` not-found block takes over; separately, add a catch-all
  `<error-page>` to `web.xml` so no unhandled exception ever reaches the user as a stack trace.

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

---

## Additional observations (not part of the five, no test asserts on them)

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
