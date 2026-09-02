import { ALREADY_ENCRYPTED, BAD_IMAGE, FILE_TOO_LARGE, NOT_A_PDF } from "./errors";
import type { ImageMime } from "../types";

export const MAX_PDF_BYTES = 50 * 1024 * 1024;

const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = new Uint8Array([0xff, 0xd8, 0xff]);

function startsWith(bytes: Uint8Array, magic: Uint8Array): boolean {
  if (bytes.byteLength < magic.byteLength) return false;
  for (let i = 0; i < magic.byteLength; i += 1) {
    if (bytes[i] !== magic[i]) return false;
  }
  return true;
}

export function isPdfMagic(bytes: Uint8Array): boolean {
  return startsWith(bytes, PDF_MAGIC);
}

export function sniffImage(bytes: Uint8Array): ImageMime {
  if (startsWith(bytes, PNG_MAGIC)) return "image/png";
  if (startsWith(bytes, JPEG_MAGIC)) return "image/jpeg";
  throw new Error(BAD_IMAGE);
}

export function assertPdfUpload(bytes: Uint8Array): void {
  if (bytes.byteLength > MAX_PDF_BYTES) {
    throw new Error(FILE_TOO_LARGE);
  }
  if (!isPdfMagic(bytes)) {
    throw new Error(NOT_A_PDF);
  }
}

export function assertNotEncrypted(bytes: Uint8Array): void {
  const decoder = new TextDecoder("latin1");
  const headLen = Math.min(bytes.byteLength, 2 * 1024 * 1024);
  const tailStart = Math.max(0, bytes.byteLength - 64 * 1024);
  const sample =
    decoder.decode(bytes.subarray(0, headLen)) +
    decoder.decode(bytes.subarray(tailStart));
  if (/\/Encrypt(?=[\/\s\[<])/.test(sample)) {
    throw new Error(ALREADY_ENCRYPTED);
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
