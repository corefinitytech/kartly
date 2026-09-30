import { describe, expect, it } from "vitest";
import {
  advanceOrderSchema,
  auditListSchema,
  formatOptions,
  orderListSchema,
  parseOptions,
  productSchema,
  stockAdjustmentSchema,
  variantSchema,
} from "./schemas";

const uuid = "0190f5b2-7c3e-7d4a-9b1c-2d3e4f5a6b7c";

describe("productSchema", () => {
  it("derives the slug from the title when empty", () => {
    const parsed = productSchema.parse({
      title: "Red Lamp",
      slug: "",
      brand: "",
      description: "",
      categoryId: "",
      status: "draft",
    });
    expect(parsed).toMatchObject({ slug: "red-lamp", brand: null, categoryId: null, status: "draft" });
  });

  it("rejects unsafe slugs", () => {
    const result = productSchema.safeParse({
      title: "Lamp",
      slug: "../admin",
      brand: "",
      description: "",
      categoryId: "",
      status: "active",
    });
    expect(result.success).toBe(false);
  });
});

describe("variantSchema", () => {
  const base = { sku: "lamp-red", options: "Color: Red", price: "19.99", compareAt: "", lowStockThreshold: "5" };

  it("parses money into cents and uppercases the SKU", () => {
    expect(variantSchema.parse(base)).toEqual({
      sku: "LAMP-RED",
      optionsJson: JSON.stringify({ Color: "Red" }),
      priceCents: 1999,
      compareAtCents: null,
      lowStockThreshold: 5,
    });
  });

  it("requires compare-at to be above the price", () => {
    expect(variantSchema.safeParse({ ...base, compareAt: "19.99" }).success).toBe(false);
    expect(variantSchema.parse({ ...base, compareAt: "24.99" }).compareAtCents).toBe(2499);
  });

  it("rejects zero or malformed prices", () => {
    expect(variantSchema.safeParse({ ...base, price: "0" }).success).toBe(false);
    expect(variantSchema.safeParse({ ...base, price: "12.345" }).success).toBe(false);
  });
});

describe("options text", () => {
  it("round trips", () => {
    const options = parseOptions("Color: Red, Size: M");
    expect(options).toEqual({ Color: "Red", Size: "M" });
    expect(formatOptions(JSON.stringify(options))).toBe("Color: Red, Size: M");
  });

  it("uses the default marker when empty", () => {
    expect(parseOptions("")).toEqual({ default: true });
    expect(formatOptions(JSON.stringify({ default: true }))).toBe("");
  });

  it("rejects malformed pairs", () => {
    expect(parseOptions("Red")).toBeNull();
    expect(parseOptions("Color:")).toBeNull();
  });
});

describe("stockAdjustmentSchema", () => {
  it("accepts negative whole numbers", () => {
    expect(stockAdjustmentSchema.parse({ variantId: uuid, delta: "-3", reason: "damaged", note: "" }).delta).toBe(-3);
    expect(stockAdjustmentSchema.parse({ variantId: uuid, delta: "+10", reason: "restock", note: "" }).delta).toBe(10);
  });

  it("rejects decimals and unknown reasons", () => {
    expect(stockAdjustmentSchema.safeParse({ variantId: uuid, delta: "1.5", reason: "restock", note: "" }).success).toBe(false);
    expect(stockAdjustmentSchema.safeParse({ variantId: uuid, delta: "2", reason: "theft?", note: "" }).success).toBe(false);
  });
});

describe("advanceOrderSchema", () => {
  it("requires carrier and tracking only when shipping", () => {
    expect(advanceOrderSchema.safeParse({ orderId: uuid, to: "processing", carrier: "", trackingNumber: "" }).success).toBe(true);
    expect(advanceOrderSchema.safeParse({ orderId: uuid, to: "shipped", carrier: "", trackingNumber: "" }).success).toBe(false);
    expect(
      advanceOrderSchema.safeParse({ orderId: uuid, to: "shipped", carrier: "DHL", trackingNumber: "JD014600003828" }).success,
    ).toBe(true);
  });

  it("cannot be used to move an order backwards", () => {
    expect(
      advanceOrderSchema.safeParse({ orderId: uuid, to: "pending_payment", carrier: "", trackingNumber: "" }).success,
    ).toBe(false);
  });
});

describe("list filters", () => {
  it("falls back to safe defaults on junk input", () => {
    expect(orderListSchema.parse({ status: "nope", q: "kt-2026'; drop", page: "-4" })).toEqual({
      status: "all",
      q: "KT-2026DROP",
      page: 1,
    });
    expect(auditListSchema.parse({ action: "DROP TABLE", entityType: "", entityId: "", actorId: "x", page: "2" })).toEqual({
      action: "",
      entityType: "",
      entityId: "",
      actorId: "",
      page: 2,
    });
  });
});
