import { describe, expect, it } from "vitest";
import {
  ANONYMIZED_ORDER_FIELDS,
  deletionBlockedBy,
  deletionRunsAt,
  dsarDueAt,
  exportLinkExpiresAt,
  retentionCutoffs,
  slaDaysLeft,
} from "./rules";

const now = new Date("2026-09-30T12:00:00Z");

describe("deletion rules (9.4)", () => {
  it("blocks while an order is pending, paid, processing or shipped", () => {
    expect(deletionBlockedBy(["delivered", "cancelled", "refunded"])).toEqual([]);
    expect(deletionBlockedBy(["delivered", "shipped", "paid"])).toEqual(["shipped", "paid"]);
    expect(deletionBlockedBy(["pending_payment"])).toEqual(["pending_payment"]);
  });

  it("runs 7 days after the request", () => {
    expect(deletionRunsAt(now).toISOString()).toBe("2026-10-07T12:00:00.000Z");
  });

  it("anonymizes every field that identifies a person, and only those", () => {
    expect(Object.keys(ANONYMIZED_ORDER_FIELDS).sort()).toEqual(
      ["access_token_hash", "billing_address_json_enc", "contact_email_enc", "guest_email_enc", "shipping_address_json_enc", "user_id"].sort(),
    );
    expect(Object.values(ANONYMIZED_ORDER_FIELDS).every((v) => v === null)).toBe(true);
  });
});

describe("DSAR timing", () => {
  it("is due in 30 days and counts down", () => {
    const due = dsarDueAt(now);
    expect(due.toISOString()).toBe("2026-10-30T12:00:00.000Z");
    expect(slaDaysLeft(due, now)).toBe(30);
    expect(slaDaysLeft(due, new Date("2026-10-31T12:00:00Z"))).toBe(-1);
  });

  it("expires export links after 24 hours", () => {
    expect(exportLinkExpiresAt(now).toISOString()).toBe("2026-10-01T12:00:00.000Z");
  });
});

describe("retention cutoffs (9.5)", () => {
  it("matches the schedule", () => {
    const c = retentionCutoffs(now);
    expect(c.unverifiedAccounts.toISOString()).toBe("2026-09-23T12:00:00.000Z");
    expect(c.carts.toISOString()).toBe("2026-08-31T12:00:00.000Z");
    expect(c.auditLog.toISOString()).toBe("2025-09-30T12:00:00.000Z");
    expect(c.dsarRecords.toISOString()).toBe("2023-09-30T12:00:00.000Z");
  });
});
