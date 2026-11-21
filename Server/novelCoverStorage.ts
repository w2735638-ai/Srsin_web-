import { storagePut } from "./storage";

export const NOVEL_COVER_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type NovelCoverMimeType = (typeof NOVEL_COVER_MIME_TYPES)[number];
export const MAX_NOVEL_COVER_BYTES = 2 * 1024 * 1024;
export const MAX_NOVEL_COVER_BASE64_CHARS = 4 * Math.ceil(MAX_NOVEL_COVER_BYTES / 3);

const fileSignatures: Record<NovelCoverMimeType, (bytes: Buffer) => boolean> = {
  "image/jpeg": bytes => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  "image/png": bytes => bytes.length >= 24
    && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    && bytes.toString("ascii", 12, 16) === "IHDR",
  "image/webp": bytes => bytes.length >= 12
    && bytes.toString("ascii", 0, 4) === "RIFF"
    && bytes.toString("ascii", 8, 12) === "WEBP",
};

const extensions: Record<NovelCoverMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function decodeNovelCoverPayload(dataBase64: string, mimeType: NovelCoverMimeType): Buffer {
  if (!dataBase64 || dataBase64.length > MAX_NOVEL_COVER_BASE64_CHARS) {
    throw new Error("The compressed cover image must be no larger than 2 MiB.");
  }
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(dataBase64)) {
    throw new Error("The cover image upload is not valid base64 data.");
  }
  const bytes = Buffer.from(dataBase64, "base64");
  if (!bytes.length || bytes.length > MAX_NOVEL_COVER_BYTES || bytes.toString("base64") !== dataBase64) {
    throw new Error("The compressed cover image must be no larger than 2 MiB.");
  }
  if (!fileSignatures[mimeType](bytes)) {
    throw new Error("The uploaded file does not match its JPEG, PNG, or WebP image type.");
  }
  return bytes;
}

export function isValidNovelCoverSource(value: string): boolean {
  if (!value) return true;
  if (value.startsWith("/manus-storage/")) {
    const key = value.slice("/manus-storage/".length);
    return /^[A-Za-z0-9._/-]+$/.test(key) && key.split("/").every(part => part && part !== "." && part !== "..");
  }
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export async function storeNovelCover(bytes: Buffer, mimeType: NovelCoverMimeType) {
  if (bytes.length > MAX_NOVEL_COVER_BYTES || !fileSignatures[mimeType](bytes)) {
    throw new Error("Invalid novel cover image.");
  }
  const stored = await storagePut(`novel-covers/cover.${extensions[mimeType]}`, bytes, mimeType);
  return { key: stored.key, url: stored.url };
}
