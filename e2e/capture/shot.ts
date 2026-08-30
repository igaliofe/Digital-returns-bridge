/**
 * Screenshot plumbing shared by capture/screenshots.spec.ts.
 *
 * Every file name here must match a row in docs/images/README.md — that file is the spec for
 * which screenshots the three Hebrew submission documents reference, and the names are load-bearing
 * (the docs link them literally).
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { Buffer } from 'node:buffer';
import type { Page, Locator } from '@playwright/test';
import { REPO_ROOT } from '../fixtures';

/** Canonical destination — docs/images/, per docs/images/README.md. */
export const IMAGES_DIR = path.join(REPO_ROOT, 'docs', 'images');

export function ensureImagesDir(): void {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

export function shotPath(name: string): string {
  return path.join(IMAGES_DIR, `${name}.png`);
}

/**
 * Capture a screen.
 *
 * `fullPage` is the default: these end up in a design document, where a cut-off table is worse
 * than a tall image. Pass `fullPage: false` for screens whose value is the above-the-fold framing
 * (the login card).
 */
export async function shoot(
  page: Page,
  name: string,
  opts: { fullPage?: boolean } = {},
): Promise<string> {
  ensureImagesDir();
  const file = shotPath(name);
  // PrimeFaces animates panel/dialog transitions; a settled network + a beat avoids
  // capturing a half-faded overlay.
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(400);

  const fullPage = opts.fullPage ?? true;
  if (fullPage) {
    await unlockPageHeight(page);
    await trimViewportToContent(page);
  }

  await page.screenshot({ path: file, fullPage });
  return file;
}

/**
 * Shrink the viewport to the content when the content is shorter than it.
 *
 * `fullPage: true` returns max(viewport, content), so a short screen like the dashboard comes back
 * with several hundred pixels of empty page background stapled underneath — which looks like a
 * mistake in a submission document. Measure what the page actually occupies and shrink to it.
 */
async function trimViewportToContent(page: Page): Promise<void> {
  const size = page.viewportSize();
  if (!size) return;

  const contentHeight = await page.evaluate(() => {
    const bottoms = Array.from(document.body.querySelectorAll<HTMLElement>('*'))
      .filter((el) => {
        const style = getComputedStyle(el);
        // Ignore absolutely-positioned decoration and anything not painted; an off-screen
        // helper element would otherwise pin the height back to the full viewport.
        return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
      })
      .map((el) => el.getBoundingClientRect().bottom + window.scrollY);
    return Math.ceil(Math.max(0, ...bottoms));
  });

  // A floor keeps a nearly-empty screen from collapsing into a letterbox.
  const target = Math.max(520, Math.min(contentHeight + 24, size.height));
  if (target < size.height) {
    await page.setViewportSize({ width: size.width, height: target });
    await page.waitForTimeout(200);
  }
}

/**
 * Let the document grow to its real content height.
 *
 * drb.css pins `html, body { height: 100% }` and scrolls the page inside
 * `.drb-content { overflow: auto }`. The document therefore never exceeds the viewport, and
 * Playwright's `fullPage: true` silently returns a viewport-sized image with the rest of the
 * screen cut off — which is how a design document ends up shipping a picture of the top third of
 * the digital return file.
 *
 * Injecting a capture-only override is enough; nothing is written back to the app.
 */
async function unlockPageHeight(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      html, body { height: auto !important; min-height: 0 !important; overflow: visible !important; }
      body.drb-body { min-height: 0 !important; }
      .drb-content { overflow: visible !important; flex: 0 0 auto !important; }
    `,
  });
  await page.waitForTimeout(250);
}

/**
 * A real, decodable PNG of arbitrary size and solid colour.
 *
 * fixtures/assets.ts ships a 1x1 PNG, which is right for testing upload plumbing and wrong for a
 * screenshot — a 1x1 stretched into a galleria reads as a broken image. This builds a proper block
 * with zlib, so the gallery and thumbnail strips in the captures look like real photos rather than
 * artefacts. No image library needed.
 */
export function solidPng(width: number, height: number, rgb: [number, number, number]): Buffer {
  const raw = Buffer.alloc(height * (width * 3 + 1));
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0; // filter type 0 (None) for this scanline
    for (let x = 0; x < width; x++) {
      // A soft vertical gradient reads as a photo-ish surface rather than a flat swatch.
      const k = 1 - (y / height) * 0.35;
      raw[o++] = Math.round(rgb[0] * k);
      raw[o++] = Math.round(rgb[1] * k);
      raw[o++] = Math.round(rgb[2] * k);
    }
  }

  const chunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData) >>> 0, 0);
    return Buffer.concat([len, typeAndData, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = truecolour RGB
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

/** A `multipart` / `setInputFiles` payload backed by {@link solidPng}. */
export function photoUpload(
  name: string,
  rgb: [number, number, number] = [122, 138, 158],
): { name: string; mimeType: string; buffer: Buffer } {
  return { name, mimeType: 'image/png', buffer: solidPng(640, 480, rgb) };
}

/** Write a {@link solidPng} to disk for inputs that demand a real filesystem path. */
export function writePhoto(absolutePath: string, rgb: [number, number, number]): string {
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, solidPng(640, 480, rgb));
  return absolutePath;
}

/** Scroll a locator into view and let PrimeFaces finish any ajax it triggered. */
export async function settle(target: Locator): Promise<void> {
  await target.scrollIntoViewIfNeeded().catch(() => undefined);
  await target.page().waitForTimeout(250);
}
