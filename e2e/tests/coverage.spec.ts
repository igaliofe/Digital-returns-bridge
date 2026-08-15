/**
 * CONTROL COVERAGE — the "no unlisted button" guarantee.
 *
 * For each of the 13 renderable routes this spec scrapes every `button`, `a[href]` and
 * `input[type=submit]` that the browser actually rendered, and fails when one of them is matched
 * by neither an inventory control `selector` nor a framework-chrome selector. Adding a button to
 * an `.xhtml` therefore breaks this spec until the button is listed in
 * `e2e/inventory/routes-and-controls.ts` — and, because `routes.smoke.spec.ts` is generated from
 * that same file, listing it also puts it under test.
 *
 * The 14th route id, `create-return`, is a bare `f:viewAction` bounce with no rendered screen; it
 * is covered as a redirect by `routes.smoke.spec.ts` instead.
 *
 * Routes are scraped in more than one render state where controls are `conditional`:
 *   warehouse-receiving — plain, with a PICKED_UP file loaded, and with an ARRIVED_TO_WAREHOUSE one
 *   admin/*             — plain and with the create dialog open
 *
 * A first block of pure-data tests (no browser) checks the inventory itself stays well-formed:
 * unique ids, `nav` controls that declare a resolvable target, `dialog`/`destructive` controls that
 * declare their dialog/confirm text, and role sets that partition the four roles.
 *
 * Parallel safety (`--workers=4`): every return used here is provisioned by `data.makeReturn()`;
 * no seeded `RET-100xx` row is read or mutated, nothing is deleted, and no count is asserted.
 * The wizard is `@SessionScoped`, so the wizard routes are scraped through `loginAs`.
 */

import type { Page } from '@playwright/test';
import {
  expect,
  test,
  LOGIN_PATH,
  ROLES,
  type DataFactory,
  type PageForRole,
  type Role,
} from '../fixtures';
import {
  LAYOUT_CONTROLS,
  ROUTES,
  ROUTE_IDS,
  chromeSelectorsFor,
  controlsOn,
  routeByPath,
  type RouteId,
  type RouteSpec,
} from '../inventory/routes-and-controls';
import {
  ADMIN_LINK_NAMES,
  adminPageForRoute,
  driveToStep2,
  IdentifyCustomerPage,
  NAV_LINK_NAMES,
  ReturnDetailsPage,
  ReturnsListPage,
  WarehouseReceivingPage,
} from '../pages';

// ===========================================================================
// 1. The inventory itself (no browser)
// ===========================================================================

test.describe('inventory integrity', () => {
  test('routes have unique ids, sane paths, and role sets that partition the four roles', () => {
    const seen = new Set<RouteId>();
    const allRoles = [...ROLES].sort();

    for (const route of ROUTES) {
      expect(seen.has(route.id), `duplicate route id "${route.id}"`).toBe(false);
      seen.add(route.id);

      expect(route.path, `route "${route.id}" has an odd path`).toMatch(/^\/[\w/.-]*\.xhtml$/);
      expect(route.title.length, `route "${route.id}" has no title`).toBeGreaterThan(0);

      expect(
        [...route.allowedRoles, ...route.deniedRoles].sort(),
        `route "${route.id}": allowedRoles + deniedRoles must be exactly the four roles, once each`,
      ).toEqual(allRoles);
    }

    expect([...seen].sort(), 'ROUTE_IDS drifted from ROUTES').toEqual([...ROUTE_IDS].sort());
  });

  test('every control declares what its kind requires', () => {
    for (const route of ROUTES) {
      const seen = new Set<string>();

      for (const control of controlsOn(route.id)) {
        const where = `${route.id} / ${control.id}`;

        expect(seen.has(control.id), `${where}: duplicate control id`).toBe(false);
        seen.add(control.id);

        expect(control.selector.length, `${where}: empty selector`).toBeGreaterThan(0);
        expect(control.effect.length, `${where}: empty effect — say what clicking it must do`)
          .toBeGreaterThan(0);
        expect(control.label.length, `${where}: empty label`).toBeGreaterThan(0);

        if (control.kind === 'nav') {
          expect(control.targetPath, `${where}: kind "nav" needs a targetPath`).toBeTruthy();
          expect(control.targetRouteId, `${where}: kind "nav" needs a targetRouteId`).toBeTruthy();
          if (control.targetPath) {
            const target = control.targetPath.split('?')[0];
            expect(
              routeByPath(target),
              `${where}: targetPath "${target}" is not a known route`,
            ).toBeTruthy();
          }
          if (control.targetRouteId) {
            expect(ROUTE_IDS, `${where}: unknown targetRouteId`).toContain(control.targetRouteId);
          }
        }

        if (control.kind === 'dialog') {
          expect(control.opensDialog, `${where}: kind "dialog" needs opensDialog`).toBeTruthy();
        }

        if (control.kind === 'destructive') {
          expect(
            control.confirms,
            `${where}: kind "destructive" needs the confirm() text it is guarded by`,
          ).toBeTruthy();
        }

        if (control.conditional) {
          expect(
            control.requiresState,
            `${where}: conditional controls must say which state renders them`,
          ).toBeTruthy();
        }
      }
    }
  });

  test('the layout control set matches the nav links the page objects drive', () => {
    const layoutIds = LAYOUT_CONTROLS.map((control) => control.id);

    for (const name of NAV_LINK_NAMES) {
      expect(layoutIds, `LayoutNav drives nav-${name}, the inventory does not list it`).toContain(
        `nav-${name}`,
      );
    }
    for (const name of ADMIN_LINK_NAMES) {
      expect(
        layoutIds,
        `LayoutNav drives nav-admin-${name}, the inventory does not list it`,
      ).toContain(`nav-admin-${name}`);
    }
    expect(layoutIds, 'the inventory lost the logout control').toContain('logout');
  });
});

// ===========================================================================
// 2. Scraping
// ===========================================================================

/** Everything a user can click. `input[type=submit]` is included even though JSF emits none today. */
const SCRAPE_SELECTOR = 'button, a[href], input[type=submit]';

/** Temporary attribute stamped on elements an inventory/chrome selector already accounts for. */
const MARK_ATTRIBUTE = 'data-e2e-inventoried';

interface ScrapedControl {
  tag: string;
  id: string;
  classes: string;
  text: string;
  title: string;
  href: string;
}

function describeControl(control: ScrapedControl): string {
  const bits = [
    control.id ? `id="${control.id}"` : '',
    control.classes ? `class="${control.classes}"` : '',
    control.title ? `title="${control.title}"` : '',
    control.href ? `href="${control.href}"` : '',
    control.text ? `text="${control.text}"` : '',
  ].filter(Boolean);
  return `<${control.tag}> ${bits.join(' ')}`;
}

/**
 * Every rendered control on the page that no inventory selector and no chrome selector matches.
 * Marking happens in the page, which lets the inventory keep using Playwright-only selector
 * engines (`:has-text`, `:text-is`) that `querySelectorAll` could not evaluate.
 */
async function uninventoriedControls(page: Page, routeId: RouteId): Promise<ScrapedControl[]> {
  const known = [
    ...controlsOn(routeId).map((control) => control.selector),
    ...chromeSelectorsFor(routeId),
  ];

  for (const selector of known) {
    await page.locator(selector).evaluateAll((elements, mark) => {
      for (const element of elements) element.setAttribute(mark, '1');
    }, MARK_ATTRIBUTE);
  }

  return page.locator(SCRAPE_SELECTOR).evaluateAll(
    (elements, mark) =>
      elements
        .filter((element) => !element.hasAttribute(mark))
        .map((element) => ({
          tag: element.tagName.toLowerCase(),
          id: element.id || '',
          classes: element.getAttribute('class') || '',
          text: (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
          title: element.getAttribute('title') || '',
          href: element.getAttribute('href') || '',
        })),
    MARK_ATTRIBUTE,
  );
}

// ---------------------------------------------------------------------------
// Getting each route on screen
// ---------------------------------------------------------------------------

interface Ctx {
  page: Page;
  pageForRole: PageForRole;
  loginAs: PageForRole;
  data: DataFactory;
}

/** A render state worth scraping: the plain load, plus whatever reveals `conditional` controls. */
interface RenderState {
  name: string;
  enter: () => Promise<void>;
}

interface ScrapeTarget {
  page: Page;
  states: RenderState[];
}

const AS_LOADED: RenderState = { name: 'as loaded', enter: async () => {} };

/** The role used to scrape a route: MANAGER wherever it is allowed, so nothing is role-hidden. */
function scrapeRole(route: RouteSpec): Role {
  return route.allowedRoles.includes('MANAGER') ? 'MANAGER' : route.allowedRoles[0];
}

/** How the scrape is labelled in a failure message. */
function scrapeActor(route: RouteSpec): string {
  return route.id === 'login' ? 'anonymous' : `as ${scrapeRole(route)}`;
}

async function openForScrape(route: RouteSpec, ctx: Ctx): Promise<ScrapeTarget> {
  const role = scrapeRole(route);

  switch (route.id) {
    case 'login': {
      // The only screen without the layout — scraped logged out, the way a visitor sees it.
      await ctx.page.goto(LOGIN_PATH);
      return { page: ctx.page, states: [AS_LOADED] };
    }

    case 'wizard-step1': {
      const page = await ctx.loginAs(role);
      await new IdentifyCustomerPage(page).gotoViaEntry();
      return { page, states: [AS_LOADED] };
    }

    case 'wizard-step2': {
      const page = await ctx.loginAs(role);
      await driveToStep2(page, ctx.data, false);
      return { page, states: [AS_LOADED] };
    }

    case 'wizard-step3': {
      const page = await ctx.loginAs(role);
      const wizard = await driveToStep2(page, ctx.data, true);
      // Selecting a purchase does not consume it — only `create()` flips `handled`, and this spec
      // never submits the form.
      await wizard.step2.selectFirstAvailable();
      await wizard.step3.expectLoaded();
      return { page, states: [AS_LOADED] };
    }

    case 'return-details': {
      const page = await ctx.pageForRole(role);
      const seeded = await ctx.data.makeReturn();
      await new ReturnDetailsPage(page).openId(seeded.id);
      return { page, states: [AS_LOADED] };
    }

    case 'returns-list': {
      const page = await ctx.pageForRole(role);
      // Guarantee at least one row (and therefore at least one per-row "View" link) without
      // depending on the seeded RET-100xx returns.
      await ctx.data.makeReturn();
      await new ReturnsListPage(page).open();
      return { page, states: [AS_LOADED] };
    }

    case 'warehouse-receiving': {
      const page = await ctx.pageForRole(role);
      const warehouse = new WarehouseReceivingPage(page);
      await warehouse.open();

      const pickedUp = await ctx.data.makeReturn('PICKED_UP');
      const arrived = await ctx.data.makeReturn('ARRIVED_TO_WAREHOUSE');

      return {
        page,
        states: [
          AS_LOADED,
          {
            // reveals `mark-arrived`
            name: 'with a PICKED_UP digital file loaded',
            enter: async () => {
              await warehouse.search(requireBarcode(pickedUp.barcode, 'PICKED_UP'));
              await warehouse.expectStatus('PICKED_UP');
            },
          },
          {
            // reveals `request-more-info` and `save-inspection`
            name: 'with an ARRIVED_TO_WAREHOUSE digital file loaded',
            enter: async () => {
              await warehouse.search(
                requireBarcode(arrived.barcode, 'ARRIVED_TO_WAREHOUSE'),
              );
              await warehouse.expectStatus('ARRIVED_TO_WAREHOUSE');
            },
          },
        ],
      };
    }

    default: {
      const page = await ctx.pageForRole(role);
      await page.goto(route.path);
      expect(
        new URL(page.url()).pathname,
        `${route.path} bounced ${role} to the login screen — nothing to scrape`,
      ).not.toBe(LOGIN_PATH);

      const admin = adminPageForRoute(route.id, page);
      if (!admin) return { page, states: [AS_LOADED] };

      await admin.expectLoaded();
      return {
        page,
        states: [
          AS_LOADED,
          {
            // reveals `dialog-save` / `dialog-cancel` in their visible state
            name: 'with the create dialog open',
            enter: () => admin.openCreateDialog(),
          },
        ],
      };
    }
  }
}

function requireBarcode(barcode: string | null, status: string): string {
  if (!barcode) throw new Error(`makeReturn('${status}') produced no barcode`);
  return barcode;
}

// ---------------------------------------------------------------------------
// One test per renderable route
// ---------------------------------------------------------------------------

/** `create-return` renders nothing — it is a pure redirect, asserted in routes.smoke.spec.ts. */
const SCRAPED_ROUTES = ROUTES.filter((route) => route.id !== 'create-return');

test.describe('rendered controls are all inventoried', () => {
  for (const route of SCRAPED_ROUTES) {
    test(`${route.path} renders no control that the inventory is missing`, async ({
      page,
      pageForRole,
      loginAs,
      data,
    }) => {
      const target = await openForScrape(route, { page, pageForRole, loginAs, data });

      for (const state of target.states) {
        await state.enter();

        const extras = await uninventoriedControls(target.page, route.id);
        const where = `${route.path} (${state.name}, ${scrapeActor(route)})`;

        expect(
          extras.map(describeControl),
          `${where}: ${extras.length} rendered control(s) are not accounted for in ` +
            'e2e/inventory/routes-and-controls.ts.\n' +
            "Add each one to that route's `controls` (id, label, kind, formId, selector, effect) so " +
            'routes.smoke.spec.ts starts exercising it — or, if it is PrimeFaces chrome rather than ' +
            "something this app authored, to PF_CHROME_SELECTORS / the route's `chromeSelectors`.",
        ).toEqual([]);
      }
    });
  }
});
