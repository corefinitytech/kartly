import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("accepts relative paths", () => {
    expect(safeNext("/cart")).toBe("/cart");
    expect(safeNext("/account/addresses?x=1")).toBe("/account/addresses?x=1");
  });

  it("rejects absolute and protocol relative urls", () => {
    expect(safeNext("https://evil.example")).toBe("/account");
    expect(safeNext("//evil.example")).toBe("/account");
    expect(safeNext("/\\evil.example")).toBe("/account");
    expect(safeNext("javascript:alert(1)")).toBe("/account");
    expect(safeNext("evil.example")).toBe("/account");
    expect(safeNext(undefined)).toBe("/account");
  });
});
