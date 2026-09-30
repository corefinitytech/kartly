// Upload checks for admin product images (FR-SEC-12): type is decided by the
// file's own bytes, not its name or the browser's claim; size is capped; the
// stored name is random so it reveals nothing and cannot be guessed.
import { randomBytes } from "node:crypto";

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export type ImageType = keyof typeof TYPES;

export function sniffImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export type ImageCheck = { ok: true; type: ImageType } | { ok: false; message: string };

export function checkImageUpload(bytes: Uint8Array): ImageCheck {
  if (bytes.length === 0) return { ok: false, message: "Choose an image to upload." };
  if (bytes.length > MAX_IMAGE_BYTES) return { ok: false, message: "Images must be 2 MB or smaller." };
  const type = sniffImageType(bytes);
  if (!type) return { ok: false, message: "Use a JPEG, PNG or WebP image." };
  return { ok: true, type };
}

export function randomImageName(type: ImageType): string {
  return `products/${randomBytes(16).toString("hex")}.${TYPES[type]}`;
}
