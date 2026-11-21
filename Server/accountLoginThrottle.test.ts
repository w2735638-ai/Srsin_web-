import { beforeEach, describe, expect, it } from "vitest";
import { clearReaderLoginFailures, isReaderLoginBlocked, recordReaderLoginFailure } from "./accountLoginThrottle";

describe("reader sign-in throttling", () => {
  const key = "account-throttle-test";
  beforeEach(() => clearReaderLoginFailures(key));

  it("blocks after ten failed sign-in attempts", () => {
    const now = 1_800_000_000_000;
    for (let attempt = 0; attempt < 9; attempt += 1) recordReaderLoginFailure(key, now + attempt);
    expect(isReaderLoginBlocked(key, now + 9)).toBe(false);
    recordReaderLoginFailure(key, now + 10);
    expect(isReaderLoginBlocked(key, now + 11)).toBe(true);
  });

  it("allows attempts again after the cooldown and clears on success", () => {
    const now = 1_800_000_100_000;
    for (let attempt = 0; attempt < 10; attempt += 1) recordReaderLoginFailure(key, now + attempt);
    expect(isReaderLoginBlocked(key, now + 11)).toBe(true);
    expect(isReaderLoginBlocked(key, now + 15 * 60 * 1000 + 20)).toBe(false);
    recordReaderLoginFailure(key, now + 16 * 60 * 1000);
    clearReaderLoginFailures(key);
    expect(isReaderLoginBlocked(key, now + 16 * 60 * 1000)).toBe(false);
  });
});
