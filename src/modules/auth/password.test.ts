import { describe, expect, it } from "vitest";
import { passwordStrength, validatePassword } from "./password";

describe("validatePassword", () => {
  it("requires 10 to 128 characters", () => {
    expect(validatePassword("short1A!")).toHaveLength(1);
    expect(validatePassword("a".repeat(10))).toHaveLength(0);
    expect(validatePassword("a".repeat(129))).toHaveLength(1);
  });

  it("rejects common passwords", () => {
    expect(validatePassword("qwerty12345").some((i) => /common/.test(i.message))).toBe(false);
    expect(validatePassword("password123").some((i) => /common/.test(i.message))).toBe(true);
  });

  it("rejects the email local part", () => {
    expect(validatePassword("maarij12345", "maarij@example.com")).toHaveLength(1);
    expect(validatePassword("safe1234567", "maarij@example.com")).toHaveLength(0);
  });
});

describe("passwordStrength", () => {
  it("scores length and variety", () => {
    expect(passwordStrength("").label).toBe("Enter a password");
    expect(passwordStrength("abc").score).toBeLessThan(2);
    expect(passwordStrength("StrongEnough1!x").score).toBeGreaterThanOrEqual(3);
  });
});
