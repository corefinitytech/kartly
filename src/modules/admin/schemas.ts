import { z } from "zod";
import { ORDER_STATUSES } from "@/modules/orders/state-machine";
import { ADJUSTMENT_REASONS, MAX_STOCK, parseMoneyToCents, slugify } from "./rules";

const MAX_PRICE_CENTS = 10_000_000; // $100,000

const money = (label: string) =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      const cents = parseMoneyToCents(value);
      if (cents === null || cents <= 0 || cents > MAX_PRICE_CENTS) {
        ctx.addIssue({ code: "custom", message: `Enter ${label} like 19.99.` });
        return z.NEVER;
      }
      return cents;
    });

const optionalMoney = (label: string) =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === "") return null;
      const cents = parseMoneyToCents(value);
      if (cents === null || cents <= 0 || cents > MAX_PRICE_CENTS) {
        ctx.addIssue({ code: "custom", message: `Enter ${label} like 19.99, or leave it empty.` });
        return z.NEVER;
      }
      return cents;
    });

const intField = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .regex(/^[+-]?\d+$/, message)
    .transform(Number)
    .pipe(z.number().int().min(min, message).max(max, message));

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const productSchema = z
  .object({
    title: z.string().trim().min(1, "Enter a title.").max(200, "Keep the title under 200 characters."),
    slug: z.string().trim().max(80, "Keep the URL under 80 characters."),
    brand: z.string().trim().max(100, "Keep the brand under 100 characters."),
    description: z.string().trim().max(5000, "Keep the description under 5,000 characters."),
    categoryId: z.union([z.string().uuid(), z.literal("")]),
    status: z.enum(["active", "draft"]),
  })
  .transform((v, ctx) => {
    const slug = v.slug === "" ? slugify(v.title) : v.slug.toLowerCase();
    if (!SLUG.test(slug)) {
      ctx.addIssue({ code: "custom", path: ["slug"], message: "Use lowercase letters, numbers and dashes in the URL." });
      return z.NEVER;
    }
    return {
      title: v.title,
      slug,
      brand: v.brand || null,
      description: v.description || null,
      categoryId: v.categoryId || null,
      status: v.status,
    };
  });
export type ProductInput = z.infer<typeof productSchema>;

/** "Color: Red, Size: M" -> { Color: "Red", Size: "M" }; empty -> the default variant marker. */
export function parseOptions(text: string): Record<string, string | boolean> | null {
  const trimmed = text.trim();
  if (trimmed === "") return { default: true };
  const options: Record<string, string> = {};
  for (const part of trimmed.split(",")) {
    const [rawKey, ...rest] = part.split(":");
    const key = rawKey?.trim() ?? "";
    const value = rest.join(":").trim();
    if (!key || !value || key.length > 30 || value.length > 60) return null;
    options[key] = value;
  }
  return Object.keys(options).length > 6 ? null : options;
}

export function formatOptions(json: string): string {
  try {
    const options = JSON.parse(json) as Record<string, string | boolean>;
    return Object.entries(options)
      .filter(([, value]) => value !== true)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");
  } catch {
    return "";
  }
}

export const variantSchema = z
  .object({
    sku: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/, "Use letters, numbers, dots and dashes for the SKU (max 64)."),
    options: z.string().trim().max(300),
    price: money("a price"),
    compareAt: optionalMoney("a compare-at price"),
    lowStockThreshold: intField(0, 1000, "Enter a low stock threshold from 0 to 1000."),
  })
  .transform((v, ctx) => {
    const options = parseOptions(v.options);
    if (!options) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Write options like Color: Red, Size: M." });
      return z.NEVER;
    }
    if (v.compareAt !== null && v.compareAt <= v.price) {
      ctx.addIssue({ code: "custom", path: ["compareAt"], message: "The compare-at price must be higher than the price." });
      return z.NEVER;
    }
    return {
      sku: v.sku.toUpperCase(),
      optionsJson: JSON.stringify(options),
      priceCents: v.price,
      compareAtCents: v.compareAt,
      lowStockThreshold: v.lowStockThreshold,
    };
  });
export type VariantInput = z.infer<typeof variantSchema>;

export const stockAdjustmentSchema = z.object({
  variantId: z.string().uuid(),
  delta: intField(-MAX_STOCK, MAX_STOCK, "Enter a whole number, like 10 or -3."),
  reason: z.enum(ADJUSTMENT_REASONS, { errorMap: () => ({ message: "Choose a reason." }) }),
  note: z.string().trim().max(200, "Keep the note under 200 characters."),
});
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;

export const thresholdSchema = z.object({
  variantId: z.string().uuid(),
  lowStockThreshold: intField(0, 1000, "Enter a threshold from 0 to 1000."),
});

export const imageAltSchema = z.object({
  imageId: z.string().uuid(),
  alt: z.string().trim().max(200, "Keep the description under 200 characters."),
});

export const advanceOrderSchema = z
  .object({
    orderId: z.string().uuid(),
    to: z.enum(["processing", "shipped", "delivered"]),
    carrier: z.string().trim().max(60, "Keep the carrier under 60 characters."),
    trackingNumber: z.string().trim().max(40),
  })
  .superRefine((v, ctx) => {
    if (v.to !== "shipped") return;
    if (!v.carrier) ctx.addIssue({ code: "custom", path: ["carrier"], message: "Enter the carrier." });
    if (!/^[A-Za-z0-9 -]{4,40}$/.test(v.trackingNumber)) {
      ctx.addIssue({ code: "custom", path: ["trackingNumber"], message: "Enter a tracking number (4 to 40 letters or digits)." });
    }
  });
export type AdvanceOrderInput = z.infer<typeof advanceOrderSchema>;

export const cancelOrderSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().trim().min(1, "Give a short reason.").max(200, "Keep the reason under 200 characters."),
});

export const refundSchema = z.object({
  orderId: z.string().uuid(),
  amount: money("an amount"),
  reason: z.string().trim().min(1, "Give a short reason.").max(200, "Keep the reason under 200 characters."),
});

const page = z.coerce.number().int().min(1).max(10_000).catch(1);

export const orderListSchema = z.object({
  status: z.enum(["all", ...ORDER_STATUSES]).catch("all"),
  q: z
    .string()
    .trim()
    .max(20)
    .transform((v) => v.toUpperCase().replace(/[^A-Z0-9-]/g, ""))
    .catch(""),
  page,
});

export const productListSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  status: z.enum(["all", "active", "draft"]).catch("all"),
  page,
});

export const inventoryListSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  stock: z.enum(["all", "low", "out"]).catch("all"),
  page,
});

export const auditListSchema = z.object({
  action: z.string().trim().max(60).regex(/^[a-z0-9._]*$/).catch(""),
  entityType: z.string().trim().max(40).regex(/^[a-z_]*$/).catch(""),
  entityId: z.string().trim().max(64).regex(/^[A-Za-z0-9-]*$/).catch(""),
  actorId: z.union([z.string().uuid(), z.literal("")]).catch(""),
  page,
});

/** Form kit state plus the submitted values, so a failed form keeps what was typed. */
export interface AdminFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  notice?: string;
  values?: Record<string, string>;
}

/** Flatten Zod errors to one message per field for the form kit. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
