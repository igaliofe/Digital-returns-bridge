/** `/login.xhtml` — Figma 20:5. The only screen that does NOT use layout.xhtml. */

import type { Locator, Page } from '@playwright/test';
import {
  expect,
  LANDING_PATH,
  LOGIN_ERROR,
  LOGIN_MESSAGES,
  LOGIN_PATH,
  LOGIN_PHONE_INPUT,
  LOGIN_SUBMIT_LABEL,
  ROLE_PHONE,
  type Role,
} from '../fixtures';
import { BasePage } from './base';
import { PfMessages, pfMessages } from './pf';

export class LoginPage extends BasePage {
  readonly form: Locator;
  readonly phone: Locator;
  readonly submit: Locator;
  /** `#loginForm:msgs` — showSummary="false", so only the DETAIL text renders. */
  readonly messages: PfMessages;
  /** `p:message for="phone" display="text"` — the required-field message next to the input. */
  readonly phoneFieldMessage: Locator;
  readonly card: Locator;
  readonly signInHeading: Locator;

  constructor(page: Page) {
    super(page, LOGIN_PATH);
    this.form = page.locator('#loginForm');
    this.phone = page.locator(LOGIN_PHONE_INPUT);
    this.submit = page.getByRole('button', { name: LOGIN_SUBMIT_LABEL });
    this.messages = pfMessages(page.locator(LOGIN_MESSAGES));
    this.phoneFieldMessage = this.form.locator('.ui-message-error-detail');
    this.card = page.locator('.drb-login-card');
    this.signInHeading = page.locator('.drb-login-heading');
  }

  override async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/\/login\.xhtml/);
    await expect(this.form).toBeVisible();
    await expect(this.signInHeading).toHaveText('Sign In');
  }

  /** Fill + click. Does NOT wait for navigation — use for the failure cases. */
  async login(phone: string): Promise<void> {
    await this.phone.fill(phone);
    await this.submit.click();
  }

  /** Click Sign In with the phone field left empty. */
  async submitEmpty(): Promise<void> {
    await this.phone.fill('');
    await this.submit.click();
  }

  /** Log in with a seeded actor's phone and wait for that role's landing page. */
  async loginAs(role: Role): Promise<void> {
    await this.login(ROLE_PHONE[role]);
    await this.page.waitForURL(`**${LANDING_PATH[role]}**`);
  }

  /** Assert the error DETAIL rendered inside `#loginForm:msgs`. */
  async expectError(text: string | RegExp): Promise<void> {
    await this.messages.expectError(text);
  }

  async expectUnknownPhoneError(phone: string): Promise<void> {
    await this.expectError(LOGIN_ERROR.unknownPhone(phone));
  }

  async expectInactiveError(): Promise<void> {
    await this.expectError(LOGIN_ERROR.inactive);
  }

  /** The required message renders in `#loginForm:msgs` AND in the `p:message` beside the field. */
  async expectPhoneRequired(): Promise<void> {
    await expect(this.form).toContainText(LOGIN_ERROR.phoneRequired);
  }

  async errorTexts(): Promise<string[]> {
    return this.messages.texts();
  }

  /** Login failed: still on /login.xhtml, no redirect happened. */
  async expectStillOnLogin(): Promise<void> {
    await expect(this.page).toHaveURL(/\/login\.xhtml/);
    await expect(this.form).toBeVisible();
  }
}
