import { beforeEach, describe, expect, it } from "vitest";
import { clearAdminLoginFailures, isAdminLoginBlocked, recordFailedAdminLogin } from "./adminLoginThrottle";

const address = "review-test-client";
const start = 1_800_000_000_000;
const windowMs = 15 * 60 * 1000;

beforeEach(() => clearAdminLoginFailures(address));

describe("admin login throttle", () => {
  it("blocks an address after eight failed attempts in the window", () => {
    for (let attempt = 1; attempt <= 7; attempt += 1) {
      recordFailedAdminLogin(address, start + attempt);
      expect(isAdminLoginBlocked(address, start + attempt)).toBe(false);
    }

    recordFailedAdminLogin(address, start + 8);
    expect(isAdminLoginBlocked(address, start + 9)).toBe(true);
    expect(isAdminLoginBlocked(address, start + windowMs + 9)).toBe(false);
  });

  it("clears the throttle state after successful sign-in", () => {
    for (let attempt = 1; attempt <= 8; attempt += 1) {
      recordFailedAdminLogin(address, start + attempt);
    }

    expect(isAdminLoginBlocked(address, start + 9)).toBe(true);
    clearAdminLoginFailures(address);
    expect(isAdminLoginBlocked(address, start + 9)).toBe(false);
  });
});
