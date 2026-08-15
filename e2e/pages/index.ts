/**
 * Page-object barrel. From a spec:
 *
 *   import { test, expect } from '../fixtures';
 *   import { LoginPage, ReturnsListPage, acceptConfirm } from '../pages';
 *
 * Every page object takes a `Page` and nothing else:
 *
 *   const list = new ReturnsListPage(repPage);
 *   await list.open();               // goto + expectLoaded
 *
 * `open()` navigates and asserts the screen rendered; `goto()` only navigates (use it when the
 * point of the test is that the route bounces you to /login.xhtml).
 */

export * from './pf';
export * from './base';
export * from './status-ui';
export * from './login';
export * from './dashboard';
export * from './returns-list';
export * from './return-details';
export * from './wizard';
export * from './warehouse-receiving';
export * from './reports';
export * from './admin';
export * from './screens';
