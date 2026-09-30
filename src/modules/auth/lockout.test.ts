import { describe, expect, it } from "vitest";
import { clearFailures, formatRemaining, lockoutKey, lockoutRemainingMs, recordFailure } from "./lockout";

describe("lockout", () => {
  const key = lockoutKey("A@B.COM", "1.2.3.4");

  it("normalises the email in the key", () => {
    expect(lockoutKey("a@b.com", "1.2.3.4")).toBe(key);
  });

  it("locks after five failures in the window", () => {
    const now = Date.now();
    for (let i = 0; i < 5; i++) recordFailure(key, now);
    expect(lockoutRemainingMs(key, now)).toBe(15 * 60 * 1000);
    clearFailures(key);
    expect(lockoutRemainingMs(key, now)).toBe(0);
  });

  it("resets when the window has passed", () => {
    const start = Date.now();
    for (let i = 0; i < 5; i++) recordFailure(key, start);
    expect(lockoutRemainingMs(key, start + 15 * 60 * 1000 + 1)).toBe(0);
    clearFailures(key);
  });

  it("formats the remaining time in minutes", () => {
    expect(formatRemaining(30_000)).toBe("less than a minute");
    expect(formatRemaining(120_000)).toBe("2 minutes");
  });
});
