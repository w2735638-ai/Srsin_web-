import { describe, expect, it } from "vitest";
import { hashReaderPassword, verifyReaderPassword } from "./readerAuth";

describe("reader password authentication", () => {
  it("verifies the exact password and rejects a different one", async () => {
    const encoded = await hashReaderPassword("Correct horse battery staple 1!");
    expect(encoded).not.toContain("Correct horse battery staple");
    expect(await verifyReaderPassword("Correct horse battery staple 1!", encoded)).toBe(true);
    expect(await verifyReaderPassword("correct horse battery staple 1!", encoded)).toBe(false);
  });

  it("denies passwords for accounts that do not exist", async () => {
    expect(await verifyReaderPassword("any supplied password", null)).toBe(false);
  });
});
