import { describe, expect, it } from "vitest";
import {
  decodeNovelCoverPayload,
  isValidNovelCoverSource,
  MAX_NOVEL_COVER_BYTES,
  type NovelCoverMimeType,
} from "./novelCoverStorage";

const pngHeader = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from([0x00, 0x00, 0x00, 0x0d]),
  Buffer.from("IHDR", "ascii"),
  Buffer.alloc(12),
]);

function encode(bytes: Buffer) {
  return bytes.toString("base64");
}

describe("novel cover upload validation", () => {
  it("accepts valid JPEG, PNG and WebP signatures", () => {
    const images: Array<[NovelCoverMimeType, Buffer]> = [
      ["image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0x00])],
      ["image/png", pngHeader],
      ["image/webp", Buffer.from("RIFF0000WEBPVP8 ", "ascii")],
    ];
    for (const [mimeType, bytes] of images) {
      expect(decodeNovelCoverPayload(encode(bytes), mimeType)).toEqual(bytes);
    }
  });

  it("rejects malformed base64 and a declared MIME type that does not match the bytes", () => {
    expect(() => decodeNovelCoverPayload("not base64!", "image/jpeg")).toThrow(/base64/i);
    expect(() => decodeNovelCoverPayload(encode(pngHeader), "image/jpeg")).toThrow(/does not match/i);
  });

  it("rejects empty and oversized payloads", () => {
    expect(() => decodeNovelCoverPayload("", "image/png")).toThrow(/2 MiB/i);
    const oversized = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(MAX_NOVEL_COVER_BYTES)]);
    expect(() => decodeNovelCoverPayload(encode(oversized), "image/jpeg")).toThrow(/2 MiB/i);
  });

  it("allows HTTP(S) URLs and stable project-storage paths only", () => {
    expect(isValidNovelCoverSource("https://cdn.example.com/covers/book.webp")).toBe(true);
    expect(isValidNovelCoverSource("http://images.example.com/book.jpg")).toBe(true);
    expect(isValidNovelCoverSource("/manus-storage/novel-covers/cover_ab12cd34.webp")).toBe(true);
    expect(isValidNovelCoverSource("javascript:alert(1)")).toBe(false);
    expect(isValidNovelCoverSource("data:image/svg+xml,evil")).toBe(false);
    expect(isValidNovelCoverSource("/manus-storage/../private")).toBe(false);
  });
});
