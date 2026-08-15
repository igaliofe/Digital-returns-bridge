/**
 * Shared page-object plumbing: the `layout.xhtml` header nav, and the base class every
 * screen object extends.
 */

import { randomUUID } from 'node:crypto';
import type { Locator, Page } from '@playwright/test';
import { expect, LOGIN_PATH } from '../fixtures';
import { PfMessages, pfMessages } from './pf';

/** `layout.xhtml`'s header — present on every authenticated screen, absent on `/login.xhtml`. */
export const LAYOUT_HEADER_SELECTOR = 'header.drb-header';

/** Current pathname, no query string. The one place `new URL(page.url())` should appear. */
export function pathnameOf(page: Page): string {
  return new URL(page.url()).pathname;
}

// ---------------------------------------------------------------------------
// Header nav (WEB-INF/templates/layout.xhtml)
// ---------------------------------------------------------------------------

export type NavLinkName = 'dashboard' | 'returns' | 'new-return' | 'warehouse' | 'reports' | 'admin';
export type AdminLinkName = 'users' | 'customers' | 'products' | 'drivers';

/** Top-level nav links, in render order. */
export const NAV_LINK_NAMES: readonly NavLinkName[] = [
  'dashboard',
  'returns',
  'new-return',
  'warehouse',
  'reports',
  'admin',
];

export const ADMIN_LINK_NAMES: readonly AdminLinkName[] = [
  'users',
  'customers',
  'products',
  'drivers',
];

/** `href` of each nav link. */
export const NAV_LINK_TARGET: Readonly<Record<NavLinkName, string>> = {
  dashboard: '/dashboard.xhtml',
  returns: '/returns/list.xhtml',
  'new-return': '/returns/create.xhtml',
  warehouse: '/warehouse/receiving.xhtml',
  reports: '/reports.xhtml',
  admin: '/admin/users.xhtml',
};

/** Where you actually END UP — `/returns/create.xhtml` immediately redirects to wizard step 1. */
export const NAV_LINK_LANDING: Readonly<Record<NavLinkName, string>> = {
  ...NAV_LINK_TARGET,
  'new-return': '/returns/create/identify-customer.xhtml',
};

export class LayoutNav {
  readonly page: Page;
  readonly header: Locator;
  readonly logo: Locator;
  readonly dashboard: Locator;
  readonly returns: Locator;
  readonly newReturn: Locator;
  readonly warehouse: Locator;
  readonly reports: Locator;
  readonly admin: Locator;
  readonly adminMenu: Locator;
  readonly adminUsers: Locator;
  readonly adminCustomers: Locator;
  readonly adminProducts: Locator;
  readonly adminDrivers: Locator;
  readonly logoutForm: Locator;
  readonly logout: Locator;
  readonly avatar: Locator;

  constructor(page: Page) {
    this.page = page;
    this.header = page.locator(LAYOUT_HEADER_SELECTOR);
    this.logo = page.locator('a.drb-logo');
    this.dashboard = page.getByTestId('nav-dashboard');
    this.returns = page.getByTestId('nav-returns');
    this.newReturn = page.getByTestId('nav-new-return');
    this.warehouse = page.getByTestId('nav-warehouse');
    this.reports = page.getByTestId('nav-reports');
    this.admin = page.getByTestId('nav-admin');
    this.adminMenu = page.locator('.drb-admin-menu');
    this.adminUsers = page.getByTestId('nav-admin-users');
    this.adminCustomers = page.getByTestId('nav-admin-customers');
    this.adminProducts = page.getByTestId('nav-admin-products');
    this.adminDrivers = page.getByTestId('nav-admin-drivers');
    this.logoutForm = page.locator('#logoutForm');
    this.logout = page.getByTestId('logout-link');
    this.avatar = page.locator('.drb-avatar');
  }

  link(name: NavLinkName): Locator {
    return this.page.getByTestId(`nav-${name}`);
  }

  adminLink(name: AdminLinkName): Locator {
    return this.page.getByTestId(`nav-admin-${name}`);
  }

  /**
   * Which of the six top-level nav links are actually in the DOM.
   * Today this is always all six regardless of role — GAP 2, see docs/e2e-findings.md.
   */
  async renderedLinks(): Promise<NavLinkName[]> {
    const present: NavLinkName[] = [];
    for (const name of NAV_LINK_NAMES) {
      if ((await this.link(name).count()) > 0) present.push(name);
    }
    return present;
  }

  /** Same as `renderedLinks`, but requires the link to be visible (CSS-hidden links drop out). */
  async visibleLinks(): Promise<NavLinkName[]> {
    const visible: NavLinkName[] = [];
    for (const name of NAV_LINK_NAMES) {
      if (await this.link(name).isVisible()) visible.push(name);
    }
    return visible;
  }

  async renderedAdminLinks(): Promise<AdminLinkName[]> {
    const present: AdminLinkName[] = [];
    for (const name of ADMIN_LINK_NAMES) {
      if ((await this.adminLink(name).count()) > 0) present.push(name);
    }
    return present;
  }

  /** `.drb-admin-menu` is `display:none` until the dropdown is hovered or focused. */
  async openAdminMenu(): Promise<void> {
    await this.admin.hover();
    await expect(this.adminMenu).toBeVisible();
  }

  /** The nav link carrying `.drb-nav-active`, or null when none does. */
  async activeLink(): Promise<NavLinkName | null> {
    for (const name of NAV_LINK_NAMES) {
      const cls = (await this.link(name).getAttribute('class')) ?? '';
      if (cls.includes('drb-nav-active')) return name;
    }
    return null;
  }

  /** Click a nav link and wait for the route it lands on. */
  async go(name: NavLinkName): Promise<void> {
    await this.link(name).click();
    await this.page.waitForURL(new RegExp(`${escapeRegExp(NAV_LINK_LANDING[name])}(\\?|$)`));
  }

  async goAdmin(name: AdminLinkName): Promise<void> {
    await this.openAdminMenu();
    await this.adminLink(name).click();
    await this.page.waitForURL(`**/admin/${name}.xhtml**`);
  }

  /** Click Logout and wait for /login.xhtml. Invalidates the HttpSession server-side. */
  async logoutAndWait(): Promise<void> {
    await this.logout.click();
    await this.page.waitForURL(`**${LOGIN_PATH}**`);
  }

  /** Two-letter initials rendered in the avatar chip ('TO' when no user name is available). */
  async avatarInitials(): Promise<string> {
    return (await this.avatar.innerText()).trim();
  }

  /**
   * No authenticated chrome is on the page at all — the assertion that a logged-out visitor is
   * really logged out. `/login.xhtml` uses its own template and renders no `header.drb-header`,
   * so a count of zero means no app screen leaked through.
   */
  async expectNoAppChrome(): Promise<void> {
    await expect(
      this.header,
      'the layout header rendered on a screen that must be unauthenticated',
    ).toHaveCount(0);
  }
}

// ---------------------------------------------------------------------------
// BasePage
// ---------------------------------------------------------------------------

export abstract class BasePage {
  readonly page: Page;
  /** Route path, no query string, no context prefix (the app is deployed as ROOT.war). */
  readonly path: string;
  readonly nav: LayoutNav;
  /** The layout-level `p:messages` (`main.drb-content > .ui-messages`). Detail text only. */
  readonly globalMessages: PfMessages;
  /** `h1.drb-page-title` — most screens have exactly one. */
  readonly heading: Locator;

  constructor(page: Page, path: string) {
    this.page = page;
    this.path = path;
    this.nav = new LayoutNav(page);
    this.globalMessages = pfMessages(page.locator('main.drb-content > .ui-messages'));
    this.heading = page.locator('h1.drb-page-title');
  }

  /** `/returns/details.xhtml` + `?id=7`. */
  url(query = ''): string {
    return `${this.path}${query}`;
  }

  async goto(query = ''): Promise<void> {
    await this.page.goto(this.url(query));
  }

  /** Navigate and assert we actually landed (i.e. were not bounced to /login.xhtml). */
  async open(query = ''): Promise<void> {
    await this.goto(query);
    await this.expectLoaded();
  }

  /**
   * Re-open the screen, forcing a genuinely fresh server render.
   *
   * The app sets no `Cache-Control` headers anywhere under `server/src/main`, while recent commits
   * turned on JSF Production stage "to enhance caching" — so a plain re-`goto()` of the same URL
   * could be answered from the HTTP cache and turn a real regression into a green delta. The unique
   * query parameter is a cache-buster; every screen bean ignores unknown request parameters.
   *
   * Use this for before/after delta reads. Plain `open()` is right everywhere else.
   */
  async reopen(): Promise<void> {
    await this.open(`?e2e=${randomUUID().slice(0, 8)}`);
  }

  /** Overridden per screen with a marker assertion. Default: the URL is this route. */
  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`${escapeRegExp(this.path)}(\\?|$)`));
  }

  /** The route guard bounced us to the login screen. */
  async expectRedirectedToLogin(): Promise<void> {
    await this.page.waitForURL(`**${LOGIN_PATH}**`);
    await expect(this.page.locator('#loginForm')).toBeVisible();
  }

  /** True when the current URL is this route (ignoring the query string). */
  async isCurrent(): Promise<boolean> {
    return new URL(this.page.url()).pathname === this.path;
  }
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
