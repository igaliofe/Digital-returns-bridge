/**
 * PrimeFaces 13 interaction primitives.
 *
 * JSF client ids contain colons (`createForm:reason`) which are illegal in a bare CSS id selector,
 * and most PrimeFaces widgets hide the real form control behind a decorated div. Everything in this
 * module exists so page objects never have to remember either fact.
 *
 * Markup contracts assumed (PrimeFaces 13.0.0, jakarta classifier):
 *   p:inputText     -> <input id="clientId">
 *   p:inputTextarea -> <textarea id="clientId">
 *   p:inputNumber   -> visible <input id="clientId_input"> + hidden <input id="clientId_hinput">
 *   p:datePicker    -> <span id="clientId"><input id="clientId_input"></span>
 *   p:selectOneMenu -> <div id="clientId" class="ui-selectonemenu"> with
 *                      <select id="clientId_input"> (hidden, holds every option),
 *                      <label id="clientId_label"> (the visible selection) and a detached
 *                      <div id="clientId_panel"> holding <li class="ui-selectonemenu-item" data-label>
 *   p:selectBooleanCheckbox -> <div id="clientId"> with hidden <input id="clientId_input" type=checkbox>
 *                      and a clickable <div class="ui-chkbox-box">
 *   p:signature     -> <div class="ui-inputfield ui-widget"> + hidden <input id="clientId_value">
 *                      and <input id="clientId_base64">; the <canvas> and the plugin's own
 *                      widget class are added client-side. There is NO `ui-signature` class.
 *   p:messages      -> <div class="ui-messages"><div class="ui-messages-{sev}"><ul><li>
 *                        <span class="ui-messages-{sev}-summary"><span class="ui-messages-{sev}-detail">
 *   p:message       -> <div class="ui-message"><span class="ui-message-{sev}-detail">
 */

import type { Locator, Page } from '@playwright/test';
import { expect } from '../fixtures';

/** Severities a p:messages block can render. */
export type MessageSeverity = 'info' | 'warn' | 'error' | 'fatal';

export const AJAX_SETTLE_MS = 150;

// ---------------------------------------------------------------------------
// Client ids
// ---------------------------------------------------------------------------

/** `createForm:reason` -> `#createForm\:reason`. Safe to pass ids that need no escaping. */
export function byId(clientId: string): string {
  return `#${escapeId(clientId)}`;
}

/** CSS-escapes the characters JSF puts in client ids. */
export function escapeId(clientId: string): string {
  return clientId.replace(/([:.[\]()])/g, '\\$1');
}

// ---------------------------------------------------------------------------
// Field locators
// ---------------------------------------------------------------------------

/** p:inputText / p:inputTextarea / h:inputFile — the element carries the client id itself. */
export function pfInput(page: Page, clientId: string): Locator {
  return page.locator(byId(clientId));
}

/** p:inputNumber — the element you type into is `<clientId>_input`. */
export function pfNumberInput(page: Page, clientId: string): Locator {
  return page.locator(byId(`${clientId}_input`));
}

/** p:datePicker — the element you type into is `<clientId>_input`. */
export function pfDateInput(page: Page, clientId: string): Locator {
  return page.locator(byId(`${clientId}_input`));
}

/** p:selectBooleanCheckbox — the real (hidden) checkbox. Use for state, not for clicking. */
export function pfCheckboxInput(page: Page, clientId: string): Locator {
  return page.locator(byId(`${clientId}_input`));
}

/** p:selectBooleanCheckbox — the clickable box. */
export function pfCheckboxBox(page: Page, clientId: string): Locator {
  return page.locator(`${byId(clientId)} .ui-chkbox-box`);
}

/** p:selectOneMenu root. */
export function pfSelect(page: Page, clientId: string): Locator {
  return page.locator(byId(clientId));
}

/** p:selectOneMenu visible label (the current selection). */
export function pfSelectLabel(page: Page, clientId: string): Locator {
  return page.locator(byId(`${clientId}_label`));
}

/** p:selectOneMenu hidden `<select>` — the authoritative list of options and the posted value. */
export function pfSelectNative(page: Page, clientId: string): Locator {
  return page.locator(byId(`${clientId}_input`));
}

// ---------------------------------------------------------------------------
// Field actions
// ---------------------------------------------------------------------------

export async function pfFill(page: Page, clientId: string, value: string): Promise<void> {
  await pfInput(page, clientId).fill(value);
}

export async function pfFillNumber(page: Page, clientId: string, value: number): Promise<void> {
  const input = pfNumberInput(page, clientId);
  await input.click();
  await input.press('Control+a');
  await input.fill(String(value));
  await input.blur();
}

/** `dd/MM/yyyy` — the pattern the wizard's datePicker uses. */
export async function pfFillDate(page: Page, clientId: string, ddMMyyyy: string): Promise<void> {
  const input = pfDateInput(page, clientId);
  await input.fill(ddMMyyyy);
  await input.press('Escape');
}

export async function pfIsChecked(page: Page, clientId: string): Promise<boolean> {
  return pfCheckboxInput(page, clientId).isChecked();
}

export async function pfSetCheckbox(page: Page, clientId: string, checked: boolean): Promise<void> {
  if ((await pfIsChecked(page, clientId)) === checked) return;
  await pfCheckboxBox(page, clientId).click();
  await expect(pfCheckboxInput(page, clientId)).toBeChecked({ checked });
}

/** Opens the overlay panel and picks the item whose `data-label` matches exactly. */
export async function pfSelectOne(page: Page, clientId: string, label: string): Promise<void> {
  await pfSelect(page, clientId).click();
  const panel = page.locator(byId(`${clientId}_panel`));
  await expect(panel).toBeVisible();
  await panel.locator(`li.ui-selectonemenu-item[data-label="${label}"]`).click();
  await expect(panel).toBeHidden();
  await expect(pfSelectLabel(page, clientId)).toHaveText(label);
}

/** The visible selection of a p:selectOneMenu. */
export async function pfSelectedLabel(page: Page, clientId: string): Promise<string> {
  return (await pfSelectLabel(page, clientId).innerText()).trim();
}

/** The posted value of a p:selectOneMenu, read off the hidden native `<select>`. */
export async function pfSelectedValue(page: Page, clientId: string): Promise<string> {
  return pfSelectNative(page, clientId).inputValue();
}

/** Every option label of a p:selectOneMenu, in render order (includes the "— Select … —" entry). */
export async function pfSelectOptions(page: Page, clientId: string): Promise<string[]> {
  const texts = await pfSelectNative(page, clientId).locator('option').allTextContents();
  return texts.map((t) => t.trim());
}

// ---------------------------------------------------------------------------
// p:messages / p:message
// ---------------------------------------------------------------------------

/**
 * Thin wrapper over a `p:messages` (or `p:message`) block.
 *
 * Whether the SUMMARY renders depends on the component:
 *   login.xhtml `#loginForm:msgs` -> showSummary="false" showDetail="true"  => detail only
 *   layout.xhtml global block     -> showSummary="false" showDetail="true"  => detail only
 *   every other block             -> summary AND detail
 * `texts()` concatenates whatever rendered, so assertions work either way.
 */
export class PfMessages {
  readonly root: Locator;

  constructor(root: Locator) {
    this.root = root;
  }

  /** All `<li>` entries across every severity block. */
  get items(): Locator {
    return this.root.locator('li');
  }

  severity(sev: MessageSeverity): Locator {
    return this.root.locator(`.ui-messages-${sev}, .ui-message-${sev}`);
  }

  get errors(): Locator {
    return this.root.locator('.ui-messages-error-detail, .ui-messages-error-summary, .ui-message-error-detail');
  }

  get infos(): Locator {
    return this.root.locator('.ui-messages-info-detail, .ui-messages-info-summary, .ui-message-info-detail');
  }

  get warns(): Locator {
    return this.root.locator('.ui-messages-warn-detail, .ui-messages-warn-summary, .ui-message-warn-detail');
  }

  /** Flattened text of every rendered message, trimmed. */
  async texts(): Promise<string[]> {
    const raw = await this.root.locator('span[class*="-summary"], span[class*="-detail"]').allTextContents();
    return raw.map((t) => t.trim()).filter((t) => t.length > 0);
  }

  async hasSeverity(sev: MessageSeverity): Promise<boolean> {
    return (await this.severity(sev).count()) > 0;
  }

  async expectText(text: string | RegExp): Promise<void> {
    await expect(this.root).toContainText(text);
  }

  async expectError(text: string | RegExp): Promise<void> {
    await expect(this.severity('error')).toBeVisible();
    await expect(this.root).toContainText(text);
  }

  async expectInfo(text: string | RegExp): Promise<void> {
    await expect(this.severity('info')).toBeVisible();
    await expect(this.root).toContainText(text);
  }

  async expectWarn(text: string | RegExp): Promise<void> {
    await expect(this.severity('warn')).toBeVisible();
    await expect(this.root).toContainText(text);
  }

  /** No error- or fatal-severity message rendered. */
  async expectNoErrors(): Promise<void> {
    await expect(this.severity('error')).toHaveCount(0);
    await expect(this.severity('fatal')).toHaveCount(0);
  }

  async expectEmpty(): Promise<void> {
    await expect(this.items).toHaveCount(0);
  }
}

export function pfMessages(root: Locator): PfMessages {
  return new PfMessages(root);
}

/** `p:messages` identified by its client id, e.g. `loginForm:msgs`. */
export function pfMessagesById(page: Page, clientId: string): PfMessages {
  return new PfMessages(page.locator(byId(clientId)));
}

// ---------------------------------------------------------------------------
// Native confirm()
// ---------------------------------------------------------------------------

/**
 * Playwright auto-DISMISSES native dialogs, which makes every `onclick="return confirm(...)"`
 * button a no-op. Arm this BEFORE the click and await it after:
 *
 *   const confirmed = acceptConfirm(page, 'Mark this return as arrived');
 *   await page.locator('#digitalFile button:has-text("Mark as Arrived")').click();
 *   await confirmed;
 *
 * Resolves with the dialog text. You MUST await the returned promise, otherwise a mismatch
 * surfaces as an unhandled rejection instead of a test failure.
 */
export function acceptConfirm(page: Page, expected?: string | RegExp): Promise<string> {
  return handleConfirm(page, 'accept', expected);
}

/** Same contract as `acceptConfirm`, but cancels — the guarded action must NOT run. */
export function dismissConfirm(page: Page, expected?: string | RegExp): Promise<string> {
  return handleConfirm(page, 'dismiss', expected);
}

function handleConfirm(
  page: Page,
  how: 'accept' | 'dismiss',
  expected?: string | RegExp,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    page.once('dialog', (dialog) => {
      const message = dialog.message();
      const action = how === 'accept' ? dialog.accept() : dialog.dismiss();
      void action.then(
        () => {
          if (expected !== undefined && !matches(message, expected)) {
            reject(
              new Error(
                `confirm() text ${JSON.stringify(message)} did not match ${String(expected)}`,
              ),
            );
            return;
          }
          resolve(message);
        },
        (err: unknown) => reject(err instanceof Error ? err : new Error(String(err))),
      );
    });
  });
}

function matches(value: string, expected: string | RegExp): boolean {
  return typeof expected === 'string' ? value.includes(expected) : expected.test(value);
}

// ---------------------------------------------------------------------------
// Ajax
// ---------------------------------------------------------------------------

/**
 * Click a PrimeFaces ajax control and wait for its XHR + the DOM patch that follows.
 * Use this for `kind: 'ajax'` controls; for `kind: 'nav'` controls use `page.waitForURL` instead
 * (a `?faces-redirect=true` outcome comes back as `<redirect>` inside the ajax response).
 *
 * Assertions afterwards should still be auto-retrying `expect`s — this only removes the
 * "clicked before the widget was wired" class of flake.
 */
export async function clickAjax(
  page: Page,
  target: Locator,
  opts: { timeout?: number } = {},
): Promise<void> {
  const timeout = opts.timeout ?? 20_000;
  const response = page.waitForResponse(
    (r) => r.request().method() === 'POST' && r.request().resourceType() === 'xhr',
    { timeout },
  );
  await target.click();
  await response;
  await page.waitForTimeout(AJAX_SETTLE_MS);
}

// ---------------------------------------------------------------------------
// p:signature
// ---------------------------------------------------------------------------

/**
 * Draw a real squiggle with real mouse events. The jQuery signature plugin only records
 * mousedown/mousemove/mouseup on its canvas, so `fill()`-ing the hidden input does not work.
 */
export async function drawSignature(page: Page, pad: Locator): Promise<void> {
  await pad.scrollIntoViewIfNeeded();
  await expect(pad).toBeVisible();
  const box = await pad.boundingBox();
  if (!box) throw new Error('signature pad has no bounding box (not rendered?)');

  const midY = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.15, midY);
  await page.mouse.down();
  for (const [fx, fy] of [
    [0.3, -0.25],
    [0.45, 0.2],
    [0.6, -0.2],
    [0.75, 0.15],
    [0.85, -0.05],
  ] as const) {
    await page.mouse.move(box.x + box.width * fx, midY + box.height * fy, { steps: 8 });
  }
  await page.mouse.up();
}
