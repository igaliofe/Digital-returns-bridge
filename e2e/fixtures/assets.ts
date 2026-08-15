/**
 * Binary test assets, inlined.
 *
 * The suite uploads images in three places — the wizard's `h:inputFile` fields, the admin product
 * dialog's file input, and `POST /api/returns/{id}/images` — and every one of them wants a real,
 * decodable image. Rather than ship a checked-in `assets/*.png` (and make three specs agree on its
 * path), the single smallest valid PNG lives here as a base64 constant.
 *
 * `file` — PNG image data, 1 x 1, 8-bit/color RGBA, non-interlaced. Cloudinary accepts it, and it
 * keeps the upload round-trip fast enough that the multipart-over-ajax paths stay testable.
 */

import { Buffer } from 'node:buffer';
import fs from 'node:fs';

export const PNG_1X1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** The same PNG as bytes. Safe to share — nothing mutates it. */
export const PNG_1X1: Buffer = Buffer.from(PNG_1X1_BASE64, 'base64');

/**
 * A Playwright `setInputFiles` / `multipart` payload for the shared PNG, so no spec has to
 * restate the mime type. Use it wherever a filesystem path is not required:
 *
 *     await step3.generalImages.setInputFiles(pngUpload('general.png'));
 */
export function pngUpload(name = 'e2e.png'): { name: string; mimeType: string; buffer: Buffer } {
  return { name, mimeType: 'image/png', buffer: PNG_1X1 };
}

/**
 * Writes the shared PNG to `absolutePath` and returns that path — for the inputs that only accept
 * a real file on disk (`AdminProductsPage.fillCreateForm({ imageFile })`). Pair it with
 * `testInfo.outputPath('...')` so the file lands in the test's own output directory.
 */
export function writePng(absolutePath: string): string {
  fs.writeFileSync(absolutePath, PNG_1X1);
  return absolutePath;
}
