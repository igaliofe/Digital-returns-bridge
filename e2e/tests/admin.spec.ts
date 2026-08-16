/**
 * Journey 7 — the four admin CRUD screens (`/admin/{users,customers,products,drivers}.xhtml`,
 * Figma 27:153 .. 28:136). MANAGER only.
 *
 * All four screens share one shape, so this spec runs the same four-part contract on each:
 *   1. create through the `#createDialog` modal        -> verified by GET /api/{...}
 *   2. required-field validation keeps the dialog open -> verified by the entity NOT existing
 *   3. delete accepts the native `confirm()`           -> verified by the entity disappearing
 *   4. inline row-edit persists                        -> GAP 3, ships as `test.fixme`
 * plus the products-only image upload path.
 *
 * Parallel-safety rules this file obeys (plan, "Test data strategy" + "Admin CRUD"):
 *   - Every row it creates carries a `data.uniqueName()` (`e2e-<uuid8>`) name and a
 *     `data.nextPhone()` (`0599<worker><counter>`) phone, so two workers can never collide and
 *     nothing it creates can be mistaken for seed data.
 *   - Every row it creates is removed in `afterEach`, through the UI — there is NO DELETE endpoint
 *     for users/customers/products/drivers, the screen under test is the only cleanup path.
 *     Cleanups run in reverse order so a driver is removed before the user account it points at.
 *   - It never asserts a row count or a table length. Existence is asserted per-row (by id) and
 *     through the REST oracle, never by counting.
 *   - It never touches seeded rows: the 6 seeded users, 20 customers, 30 products and 2 drivers are
 *     read-only for this spec.
 *
 * Pagination matters here in a way it does not elsewhere: the admin tables paginate at 20 rows and
 * `{Product,Customer,User,Driver}Repository.findAll()` issues `SELECT e FROM E e` with **no ORDER
 * BY**, so a freshly created row can surface on any page (customers seed 20 rows, products seed 30 —
 * both already spill past page one). Hence `AdminCrudPage.findRowAcrossPages` / `.revealRow`:
 * never assume a row is on the page you are looking at.
 */

import { test, expect, writePng, type CustomerDto, type ProductDto, type UserDto } from '../fixtures';
import {
  AdminCustomersPage,
  AdminDriversPage,
  AdminProductsPage,
  AdminUsersPage,
  clickAjax,
} from '../pages';

// ---------------------------------------------------------------------------
// Cleanup registry
//
// Module-level, but reset in `beforeEach` — a worker runs one test at a time, so nothing leaks
// between tests and nothing is shared between workers.
// ---------------------------------------------------------------------------

interface Cleanup {
  label: string;
  run: () => Promise<void>;
}

let cleanups: Cleanup[] = [];

function registerCleanup(label: string, run: () => Promise<void>): void {
  cleanups.push({ label, run });
}

test.beforeEach(() => {
  cleanups = [];
});

test.afterEach(async () => {
  // Reverse order: a driver row must go before the user account it links to.
  const pending = [...cleanups].reverse();
  cleanups = [];
  for (const cleanup of pending) {
    try {
      await cleanup.run();
    } catch (error) {
      // Cleanup must never turn a green test red; surface it loudly instead.
      console.warn(`[admin.spec] cleanup failed for ${cleanup.label}: ${String(error)}`);
    }
  }
});

// ---------------------------------------------------------------------------
// Cleanup closures, one per screen
// ---------------------------------------------------------------------------

function cleanupUser(admin: AdminUsersPage, id: number, fullName: string): void {
  registerCleanup(`user ${fullName} (#${id})`, async () => {
    await admin.open();
    const row = admin.rowById(id);
    if (!(await admin.findRowAcrossPages(row))) return;
    await admin.deleteUserRow(row, fullName);
  });
}

function cleanupCustomer(admin: AdminCustomersPage, id: number, fullName: string): void {
  registerCleanup(`customer ${fullName} (#${id})`, async () => {
    await admin.open();
    const row = admin.rowById(id);
    if (!(await admin.findRowAcrossPages(row))) return;
    await admin.deleteCustomerRow(row, fullName);
  });
}

function cleanupProduct(admin: AdminProductsPage, id: number, name: string): void {
  registerCleanup(`product ${name} (#${id})`, async () => {
    await admin.open();
    const row = admin.rowById(id);
    if (!(await admin.findRowAcrossPages(row))) return;
    await admin.deleteProductRow(row, name);
  });
}

function cleanupDriver(admin: AdminDriversPage, phone: string): void {
  registerCleanup(`driver ${phone}`, async () => {
    await admin.open();
    const row = admin.rowByPhone(phone);
    if (!(await admin.findRowAcrossPages(row))) return;
    await admin.deleteDriverRow(row);
  });
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

/**
 * Every `required="true"` field on the admin screens overrides JSF's stock
 * "Validation Error: Value is required" with a Hebrew `requiredMessage`, and the
 * four create-dialog tests each blank out a different field — so match the shared
 * prefix rather than any one message: "יש להזין …" (enter) / "יש לבחור …" (choose).
 * See `admin/users.xhtml:126,137`, `customers.xhtml:124`, `products.xhtml:135`,
 * `drivers.xhtml:105`.
 */
const REQUIRED_MESSAGE = /יש (להזין|לבחור)/;

// ===========================================================================
// /admin/users.xhtml
// ===========================================================================

test.describe('Admin — users', () => {
  test('admin/users: the New User dialog creates the user and GET /api/users returns it', async ({
    managerPage,
    api,
    data,
  }) => {
    const fullName = data.uniqueName('user');
    const phone = data.nextPhone();

    const users = new AdminUsersPage(managerPage);
    await users.open();

    await expect(users.newButton).toBeEnabled();
    await users.openCreateDialog();
    // The dialog offers exactly the four domain roles plus the "no selection" entry.
    expect(await users.roleOptions()).toEqual([
      '— Select Role —',
      'SERVICE_REP',
      'DRIVER',
      'WAREHOUSE',
      'MANAGER',
    ]);
    await users.fillCreateForm({ fullName, phone, role: 'WAREHOUSE', active: true });
    await users.saveCreateDialog();
    await users.expectInfo('User created');

    // REST oracle — the row is really in the database, with the values the dialog posted.
    const created = await api.findUserByPhone(phone);
    expect(created, `POST from the dialog did not create a user with phone ${phone}`).not.toBeNull();
    const dto = created as UserDto;
    cleanupUser(users, dto.id, fullName);
    expect(dto.fullName).toBe(fullName);
    expect(dto.role).toBe('WAREHOUSE');
    expect(dto.active).toBe(true);

    // ... and the table shows it.
    const row = await users.revealRow(users.rowById(dto.id), fullName);
    expect(await users.cellText(row, 'fullName')).toBe(fullName);
    expect(await users.cellText(row, 'phone')).toBe(phone);
    expect(await users.roleOf(row)).toBe('WAREHOUSE');
    expect(await users.isActive(row)).toBe(true);
  });

  test('admin/users: saving with the required fields empty keeps the dialog open and creates nothing', async ({
    managerPage,
    api,
    data,
  }) => {
    const fullName = data.uniqueName('nouser');

    const users = new AdminUsersPage(managerPage);
    await users.open();
    await users.openCreateDialog();

    // Name only: Phone and Role are both `required="true"`.
    await users.fillCreateForm({ fullName });
    await users.saveCreateDialogExpectingValidationError();
    await users.messages.expectError(REQUIRED_MESSAGE);

    expect((await api.listUsers()).some((u) => u.fullName === fullName)).toBe(false);
  });

  test('admin/users: Delete confirms, removes the row, and GET /api/users stops returning it', async ({
    managerPage,
    api,
    data,
  }) => {
    const fullName = data.uniqueName('delme');
    const phone = data.nextPhone();
    const created = await api.createUser({ phoneNumber: phone, fullName, role: 'SERVICE_REP' });

    const users = new AdminUsersPage(managerPage);
    await users.open();
    // Registered up front so a mid-test failure cannot leak the row; the closure no-ops once the
    // row is gone, which is the expected outcome here.
    cleanupUser(users, created.id, fullName);
    const row = await users.revealRow(users.rowById(created.id), fullName);

    // `deleteUserRow` arms `acceptConfirm` with the exact interpolated text before clicking —
    // Playwright auto-DISMISSES native dialogs, so an unguarded click would be a no-op.
    await users.deleteUserRow(row, fullName);

    await expect(users.rowById(created.id)).toHaveCount(0);
    expect(await api.findUserByPhone(phone)).toBeNull();
  });

  test('admin/users: dismissing the delete confirm() leaves the user untouched', async ({
    managerPage,
    api,
    data,
  }) => {
    const fullName = data.uniqueName('keepme');
    const phone = data.nextPhone();
    const created = await api.createUser({ phoneNumber: phone, fullName, role: 'SERVICE_REP' });

    const users = new AdminUsersPage(managerPage);
    await users.open();
    const row = await users.revealRow(users.rowById(created.id), fullName);
    cleanupUser(users, created.id, fullName);

    await users.deleteRowCancelling(row, `Delete user ${fullName}?`);

    // `onclick="return confirm(...)"` returning false cancels the whole ajax POST.
    await expect(row).toHaveCount(1);
    expect(await api.findUserByPhone(phone)).not.toBeNull();
  });

  test.fixme(
    'admin/users: inline row-edit persists the new full name',
    async ({ managerPage, api, data }) => {
      // GAP 3 — `<p:ajax event="rowEdit" oncomplete="#{userAdminBean.saveSelected()}">` puts the
      // persistence call inside a client-side JavaScript attribute (admin/users.xhtml:91-93). The EL
      // is evaluated server-side at RENDER time and its (void) result emitted as the JS body, so the
      // row editor's check mark has no save wired to it. See docs/e2e-findings.md, GAP 3.
      // Intended: ✓ persists the edited row, surfaces one INFO message, and the value survives a
      // reload and is visible through GET /api/users.
      const fullName = data.uniqueName('edit');
      const renamed = data.uniqueName('edited');
      const phone = data.nextPhone();
      const created = await api.createUser({ phoneNumber: phone, fullName, role: 'SERVICE_REP' });

      const users = new AdminUsersPage(managerPage);
      await users.open();
      cleanupUser(users, created.id, renamed);
      // Address the row by its (non-editable) ID cell: while the editor is open the Full Name cell
      // swaps its output text for an <input>, so a name-based locator stops matching mid-edit.
      const row = await users.revealRow(users.rowById(created.id), fullName);

      await users.editRowText(row, 'fullName', renamed);
      await users.expectInfo('User updated');

      expect((await api.listUsers()).find((u) => u.id === created.id)?.fullName).toBe(renamed);

      await users.open();
      const reloaded = await users.revealRow(users.rowById(created.id), renamed);
      expect(await users.cellText(reloaded, 'fullName')).toBe(renamed);
    },
  );
});

// ===========================================================================
// /admin/customers.xhtml
// ===========================================================================

test.describe('Admin — customers', () => {
  test('admin/customers: the New Customer dialog creates the customer and GET /api/customers returns it', async ({
    managerPage,
    api,
    data,
  }) => {
    const fullName = data.uniqueName('cust');
    const phone = data.nextPhone();
    const email = `${fullName}@e2e.invalid`;
    const address = '1 E2E Street, Tel Aviv';

    const customers = new AdminCustomersPage(managerPage);
    await customers.open();
    await customers.createCustomer({ fullName, phone, email, address });

    const created = await api.findCustomerByPhone(phone);
    expect(created, `no customer with phone ${phone} after saving the dialog`).not.toBeNull();
    const dto = created as CustomerDto;
    cleanupCustomer(customers, dto.id, fullName);
    expect(dto.fullName).toBe(fullName);
    expect(dto.email).toBe(email);
    expect(dto.address).toBe(address);

    const row = await customers.revealRow(customers.rowById(dto.id), fullName);
    expect(await customers.cellText(row, 'fullName')).toBe(fullName);
    expect(await customers.cellText(row, 'phone')).toBe(phone);
    expect(await customers.cellText(row, 'email')).toBe(email);
    expect(await customers.cellText(row, 'address')).toBe(address);
  });

  test('admin/customers: Cancel on the create dialog closes it and creates nothing', async ({
    managerPage,
    api,
    data,
  }) => {
    const fullName = data.uniqueName('cancelled');
    const phone = data.nextPhone();

    const customers = new AdminCustomersPage(managerPage);
    await customers.open();
    await customers.openCreateDialog();
    await customers.fillCreateForm({ fullName, phone });

    // Cancel is `type="button"` with `onclick="...hide(); return false;"` — pure client side.
    await customers.cancelCreateDialog();

    expect(await api.findCustomerByPhone(phone)).toBeNull();
    expect(await customers.findRowAcrossPages(customers.rowByName(fullName))).toBe(false);
  });

  test('admin/customers: saving with the required fields empty keeps the dialog open and creates nothing', async ({
    managerPage,
    api,
    data,
  }) => {
    const fullName = data.uniqueName('nocust');

    const customers = new AdminCustomersPage(managerPage);
    await customers.open();
    await customers.openCreateDialog();

    // Name only: Phone is `required="true"`.
    await customers.fillCreateForm({ fullName });
    await customers.saveCreateDialogExpectingValidationError();
    await customers.messages.expectError(REQUIRED_MESSAGE);

    expect((await api.listCustomers()).some((c) => c.fullName === fullName)).toBe(false);
  });

  test('admin/customers: Delete removes the row and GET /api/customers stops returning it', async ({
    managerPage,
    api,
    data,
  }) => {
    const fullName = data.uniqueName('cust-delme');
    const phone = data.nextPhone();
    const created = await api.createCustomer({ fullName, phone });

    const customers = new AdminCustomersPage(managerPage);
    await customers.open();
    cleanupCustomer(customers, created.id, fullName);
    const row = await customers.revealRow(customers.rowById(created.id), fullName);

    await customers.deleteCustomerRow(row, fullName);

    await expect(customers.rowById(created.id)).toHaveCount(0);
    expect(await api.findCustomerByPhone(phone)).toBeNull();
  });

  test.fixme(
    'admin/customers: inline row-edit persists the new email',
    async ({ managerPage, api, data }) => {
      // GAP 3 — admin/customers.xhtml:84-86 has the same
      // `oncomplete="#{customerAdminBean.saveSelected()}"` construct as the users screen: EL in a
      // JavaScript attribute, evaluated at render time, so clicking ✓ never persists.
      // See docs/e2e-findings.md, GAP 3.
      const fullName = data.uniqueName('cust-edit');
      const phone = data.nextPhone();
      const created = await api.createCustomer({ fullName, phone, email: `${fullName}@e2e.invalid` });
      const newEmail = `${data.uniqueName('mail')}@e2e.invalid`;

      const customers = new AdminCustomersPage(managerPage);
      await customers.open();
      cleanupCustomer(customers, created.id, fullName);
      const row = await customers.revealRow(customers.rowById(created.id), fullName);

      await customers.editRowText(row, 'email', newEmail);
      await customers.expectInfo('Customer updated');

      expect((await api.getCustomer(created.id)).email).toBe(newEmail);

      await customers.open();
      const reloaded = await customers.revealRow(customers.rowById(created.id), fullName);
      expect(await customers.cellText(reloaded, 'email')).toBe(newEmail);
    },
  );
});

// ===========================================================================
// /admin/products.xhtml
// ===========================================================================

test.describe('Admin — products', () => {
  test('admin/products: the New Product dialog creates the product and GET /api/products returns it', async ({
    managerPage,
    api,
    data,
  }) => {
    const name = data.uniqueName('prod');
    const sku = `E2E-${name}`;
    const category = 'e2e-category';
    const description = 'created by e2e admin.spec';

    const products = new AdminProductsPage(managerPage);
    await products.open();
    await products.createProduct({ sku, name, category, description, price: '123.45' });

    const created = (await api.listProducts(sku)).find((p) => p.sku === sku);
    expect(created, `no product with sku ${sku} after saving the dialog`).toBeTruthy();
    const dto = created as ProductDto;
    cleanupProduct(products, dto.id, name);
    expect(dto.name).toBe(name);
    expect(dto.category).toBe(category);
    expect(dto.description).toBe(description);
    expect(Number(dto.price)).toBeCloseTo(123.45, 2);

    const row = await products.revealRow(products.rowById(dto.id), sku);
    expect(await products.cellText(row, 'sku')).toBe(sku);
    expect(await products.cellText(row, 'name')).toBe(name);
    expect(await products.cellText(row, 'category')).toBe(category);
    // No image was supplied, so the thumbnail (`rendered="#{not empty prod.imageUrl}"`) is absent.
    expect(dto.imageUrl).toBeFalsy();
    await expect(products.rowImage(row)).toHaveCount(0);
  });

  test('admin/products: uploading an image file stores a Cloudinary URL and renders the thumbnail', async ({
    managerPage,
    api,
    data,
  }, testInfo) => {
    // The save round-trips through Cloudinary (ProductAdminBean#applyUploadedImage), which is a real
    // network call — give it room beyond the 20s default action budget.
    test.slow();

    const name = data.uniqueName('prod-img');
    const sku = `E2E-${name}`;
    const imageFile = writePng(testInfo.outputPath('e2e-product.png'));

    const products = new AdminProductsPage(managerPage);
    await products.open();
    await products.openCreateDialog();
    await products.fillCreateForm({ sku, name, price: '10', imageFile });
    await clickAjax(managerPage, products.dialogSave, { timeout: 60_000 });
    await expect(products.dialog).toBeHidden();
    await products.expectInfo('Product created');

    const created = (await api.listProducts(sku)).find((p) => p.sku === sku);
    expect(created, `no product with sku ${sku} after uploading an image`).toBeTruthy();
    const dto = created as ProductDto;
    cleanupProduct(products, dto.id, name);

    // The uploaded file became the product's imageUrl — not the (empty) Image URL text field.
    expect(dto.imageUrl, 'the upload did not produce an imageUrl').toBeTruthy();
    expect(dto.imageUrl as string).toContain('cloudinary.com');

    const row = await products.revealRow(products.rowById(dto.id), sku);
    expect((await products.cellText(row, 'imageUrl')).trim()).toBe(dto.imageUrl);
    const thumbnail = products.rowImage(row);
    await expect(thumbnail).toBeVisible();
    expect(await thumbnail.getAttribute('src')).toContain('cloudinary.com');
  });

  test('admin/products: saving with the required fields empty keeps the dialog open and creates nothing', async ({
    managerPage,
    api,
    data,
  }) => {
    const name = data.uniqueName('noprod');

    const products = new AdminProductsPage(managerPage);
    await products.open();
    await products.openCreateDialog();

    // Name only: SKU is `required="true"`.
    await products.fillCreateForm({ name });
    await products.saveCreateDialogExpectingValidationError();
    await products.messages.expectError(REQUIRED_MESSAGE);

    expect(await api.listProducts(name)).toEqual([]);
  });

  test('admin/products: Delete removes the row and GET /api/products stops returning it', async ({
    managerPage,
    api,
    data,
  }) => {
    const name = data.uniqueName('prod-delme');
    const sku = `E2E-${name}`;
    const created = await api.createProduct({ sku, name, price: 42 });

    const products = new AdminProductsPage(managerPage);
    await products.open();
    cleanupProduct(products, created.id, name);
    const row = await products.revealRow(products.rowById(created.id), sku);

    await products.deleteProductRow(row, name);

    await expect(products.rowById(created.id)).toHaveCount(0);
    expect(await api.listProducts(sku)).toEqual([]);
  });

  test.fixme(
    'admin/products: inline row-edit persists the new category',
    async ({ managerPage, api, data }) => {
      // GAP 3 — admin/products.xhtml:103-105,
      // `oncomplete="#{productAdminBean.saveSelected()}"`. See docs/e2e-findings.md, GAP 3.
      const name = data.uniqueName('prod-edit');
      const sku = `E2E-${name}`;
      const created = await api.createProduct({
        sku,
        name,
        category: 'e2e-before',
        price: 42,
      });
      const newCategory = data.uniqueName('cat');

      const products = new AdminProductsPage(managerPage);
      await products.open();
      cleanupProduct(products, created.id, name);
      const row = await products.revealRow(products.rowById(created.id), sku);

      await products.editRowText(row, 'category', newCategory);
      await products.expectInfo('Product updated');

      expect((await api.listProducts(sku)).find((p) => p.id === created.id)?.category).toBe(
        newCategory,
      );

      await products.open();
      const reloaded = await products.revealRow(products.rowById(created.id), sku);
      expect(await products.cellText(reloaded, 'category')).toBe(newCategory);
    },
  );
});

// ===========================================================================
// /admin/drivers.xhtml
// ===========================================================================

test.describe('Admin — drivers', () => {
  test('admin/drivers: the New Driver dialog creates the driver and GET /api/drivers returns it', async ({
    managerPage,
    api,
    data,
  }) => {
    // A driver row points at a user account, and there is no POST /api/drivers — so the linked user
    // is provisioned over REST first and the driver itself is created through the dialog under test.
    const userName = data.uniqueName('drvuser');
    const userPhone = data.nextPhone();
    const linkedUser = await api.createUser({
      phoneNumber: userPhone,
      fullName: userName,
      role: 'DRIVER',
    });

    const driverPhone = data.nextPhone();
    const vehicleNumber = `E2E-${data.uniqueName().slice(-6)}`;

    const drivers = new AdminDriversPage(managerPage);
    // Load AFTER the user exists: `DriverAdminBean.init()` snapshots the dropdown at @PostConstruct.
    await drivers.open();
    const users = new AdminUsersPage(managerPage);
    cleanupUser(users, linkedUser.id, userName);

    await drivers.openCreateDialog();
    const userLabel = `${userName} (${userPhone})`;
    expect(await drivers.userOptions()).toContain(userLabel);
    // Driver.active defaults to true in the domain, so the checkbox starts ticked.
    expect(await drivers.isNewActiveChecked()).toBe(true);
    await drivers.fillCreateForm({ userLabel, phone: driverPhone, vehicleNumber, active: true });
    await drivers.saveCreateDialog();
    await drivers.expectInfo('Driver created');
    cleanupDriver(drivers, driverPhone);

    const created = (await api.listDrivers()).find((d) => d.phone === driverPhone);
    expect(created, `no driver with phone ${driverPhone} after saving the dialog`).toBeTruthy();
    expect(created?.userId).toBe(linkedUser.id);
    expect(created?.driverFullName).toBe(userName);
    expect(created?.vehicleNumber).toBe(vehicleNumber);
    expect(created?.active).toBe(true);

    const row = await drivers.revealRow(drivers.rowByPhone(driverPhone), driverPhone);
    // The Full Name column is read-only — it comes from the linked user.
    expect(await drivers.fullNameOf(row)).toBe(userName);
    expect(await drivers.cellText(row, 'vehicleNumber')).toBe(vehicleNumber);
    expect(await drivers.isActive(row)).toBe(true);
  });

  test('admin/drivers: saving without a user account keeps the dialog open and creates nothing', async ({
    managerPage,
    api,
    data,
  }) => {
    const driverPhone = data.nextPhone();

    const drivers = new AdminDriversPage(managerPage);
    await drivers.open();
    await drivers.openCreateDialog();

    // Phone + vehicle only: User Account is `required="true"` and starts on "— Select User —".
    await drivers.fillCreateForm({ phone: driverPhone, vehicleNumber: 'E2E-NONE' });
    await drivers.saveCreateDialogExpectingValidationError();
    await drivers.messages.expectError(REQUIRED_MESSAGE);

    expect((await api.listDrivers()).some((d) => d.phone === driverPhone)).toBe(false);
  });

  test('admin/drivers: Delete removes the row and GET /api/drivers stops returning it', async ({
    managerPage,
    api,
    data,
  }) => {
    const userName = data.uniqueName('drvuser-delme');
    const userPhone = data.nextPhone();
    const linkedUser = await api.createUser({
      phoneNumber: userPhone,
      fullName: userName,
      role: 'DRIVER',
    });
    const driverPhone = data.nextPhone();

    const drivers = new AdminDriversPage(managerPage);
    await drivers.open();
    const users = new AdminUsersPage(managerPage);
    cleanupUser(users, linkedUser.id, userName);

    await drivers.createDriver({
      userLabel: `${userName} (${userPhone})`,
      phone: driverPhone,
      vehicleNumber: 'E2E-DEL',
    });
    cleanupDriver(drivers, driverPhone);
    const row = await drivers.revealRow(drivers.rowByPhone(driverPhone), driverPhone);

    // The drivers screen is the only one whose confirm() text carries no interpolated name.
    await drivers.deleteDriverRow(row);

    await expect(drivers.rowByPhone(driverPhone)).toHaveCount(0);
    expect((await api.listDrivers()).some((d) => d.phone === driverPhone)).toBe(false);
    // Deleting the driver must not take the user account with it.
    expect(await api.findUserByPhone(userPhone)).not.toBeNull();
  });

  test.fixme(
    'admin/drivers: inline row-edit persists the new vehicle number',
    async ({ managerPage, api, data }) => {
      // GAP 3 — admin/drivers.xhtml:81-83,
      // `oncomplete="#{driverAdminBean.saveSelected()}"`. See docs/e2e-findings.md, GAP 3.
      const userName = data.uniqueName('drvuser-edit');
      const userPhone = data.nextPhone();
      const linkedUser = await api.createUser({
        phoneNumber: userPhone,
        fullName: userName,
        role: 'DRIVER',
      });
      const driverPhone = data.nextPhone();
      const newVehicle = `E2E-${data.uniqueName().slice(-6)}`;

      const drivers = new AdminDriversPage(managerPage);
      await drivers.open();
      const users = new AdminUsersPage(managerPage);
      cleanupUser(users, linkedUser.id, userName);

      await drivers.createDriver({
        userLabel: `${userName} (${userPhone})`,
        phone: driverPhone,
        vehicleNumber: 'E2E-BEFORE',
      });
      cleanupDriver(drivers, driverPhone);
      const row = await drivers.revealRow(drivers.rowByPhone(driverPhone), driverPhone);

      await drivers.editRowText(row, 'vehicleNumber', newVehicle);
      await drivers.expectInfo('Driver updated');

      expect((await api.listDrivers()).find((d) => d.phone === driverPhone)?.vehicleNumber).toBe(
        newVehicle,
      );

      await drivers.open();
      const reloaded = await drivers.revealRow(drivers.rowByPhone(driverPhone), driverPhone);
      expect(await drivers.cellText(reloaded, 'vehicleNumber')).toBe(newVehicle);
    },
  );
});
