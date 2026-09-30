import { describe, expect, it } from "vitest";
import { toDate, toIso, toIsoOrNull } from "./dates";

describe("toIso", () => {
  it("parses Postgres timestamptz text with microseconds and a short offset", () => {
    expect(toIso("2026-09-30 07:31:15.123456+00")).toBe("2026-09-30T07:31:15.123Z");
  });

  it("handles other offsets, no fraction, and full ISO input", () => {
    expect(toIso("2026-09-30 12:00:00+05")).toBe("2026-09-30T07:00:00.000Z");
    expect(toIso("2026-09-30 12:00:00+05:30")).toBe("2026-09-30T06:30:00.000Z");
    expect(toIso("2026-09-30T07:31:15.5Z")).toBe("2026-09-30T07:31:15.500Z");
  });

  it("passes Date values through", () => {
    const d = new Date("2026-01-02T03:04:05.006Z");
    expect(toIso(d)).toBe("2026-01-02T03:04:05.006Z");
    expect(toDate(d)).toBe(d);
  });

  it("maps null to null and rejects garbage", () => {
    expect(toIsoOrNull(null)).toBeNull();
    expect(toIsoOrNull(undefined)).toBeNull();
    expect(() => toIso("not a date")).toThrow();
  });
});
