import { describe, expect, it } from "vitest";
import { PERMISSIONS, can, isAdminSessionStale, isStaffRole, maskEmail } from "./permissions";

describe("admin permissions", () => {
  it("gives admin every permission", () => {
    for (const permission of PERMISSIONS) expect(can("admin", permission)).toBe(true);
  });

  it("limits support to viewing and fulfilling orders", () => {
    expect(can("support", "orders.view")).toBe(true);
    expect(can("support", "orders.fulfil")).toBe(true);
    expect(can("support", "orders.cancel")).toBe(false);
    expect(can("support", "orders.refund")).toBe(false);
    expect(can("support", "orders.viewFullPii")).toBe(false);
    expect(can("support", "products.manage")).toBe(false);
    expect(can("support", "inventory.manage")).toBe(false);
    expect(can("support", "audit.view")).toBe(false);
  });

  it("gives customers and unknown roles nothing", () => {
    for (const permission of PERMISSIONS) {
      expect(can("customer", permission)).toBe(false);
      expect(can("", permission)).toBe(false);
      expect(can("Admin", permission)).toBe(false);
    }
  });

  it("recognises staff roles", () => {
    expect(isStaffRole("admin")).toBe(true);
    expect(isStaffRole("support")).toBe(true);
    expect(isStaffRole("customer")).toBe(false);
  });
});

describe("admin session age", () => {
  const signedIn = new Date("2026-09-30T00:00:00Z");

  it("is fresh up to 12 hours", () => {
    expect(isAdminSessionStale(signedIn, new Date("2026-09-30T11:59:59Z"))).toBe(false);
    expect(isAdminSessionStale(signedIn, new Date("2026-09-30T12:00:00Z"))).toBe(false);
  });

  it("is stale after 12 hours", () => {
    expect(isAdminSessionStale(signedIn, new Date("2026-09-30T12:00:01Z"))).toBe(true);
  });
});

describe("maskEmail", () => {
  it("keeps the first letters and the TLD only", () => {
    expect(maskEmail("jane.doe@example.com")).toBe("j•••@e•••.com");
    expect(maskEmail("a@b.co.uk")).toBe("a•••@b•••.uk");
  });

  it("never returns the original address", () => {
    expect(maskEmail("jane@example.com")).not.toContain("jane");
    expect(maskEmail("jane@example.com")).not.toContain("example");
  });

  it("handles malformed input", () => {
    expect(maskEmail("not-an-email")).toBe("•••");
    expect(maskEmail("@example.com")).toBe("•••");
  });
});
