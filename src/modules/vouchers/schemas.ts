import { z } from "zod";
import { parseMoneyToCents } from "@/modules/admin/rules";
import { CODE_PATTERN, VOUCHER_TYPES, normalizeCode } from "./rules";

/** Promo code as typed at checkout. Shape only; the service decides if it is usable. */
export const voucherCodeSchema = z
  .string()
  .max(64)
  .transform(normalizeCode)
  .refine((c) => CODE_PATTERN.test(c), "Enter the code exactly as you received it.");

const MAX_FIXED_CENTS = 1_000_000; // $10,000
const MAX_LIMIT = 1_000_000;

const optionalInt = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === "") return null;
      if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max) {
        ctx.addIssue({ code: "custom", message: `Enter ${label} from ${min} to ${max}, or leave it empty.` });
        return z.NEVER;
      }
      return Number(value);
    });

/** datetime-local value, read as UTC (the admin labels say so). */
const optionalUtc = (label: string) =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === "") return null;
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) {
        ctx.addIssue({ code: "custom", message: `Enter ${label} as a date and time.` });
        return z.NEVER;
      }
      const date = new Date(`${value}Z`);
      if (Number.isNaN(date.getTime())) {
        ctx.addIssue({ code: "custom", message: `Enter ${label} as a date and time.` });
        return z.NEVER;
      }
      return date;
    });

export const voucherFormSchema = z
  .object({
    code: z
      .string()
      .transform(normalizeCode)
      .refine((c) => CODE_PATTERN.test(c), "Use 3 to 32 letters, numbers, dashes or underscores."),
    type: z.enum(VOUCHER_TYPES, { errorMap: () => ({ message: "Choose a discount type." }) }),
    value: z.string().trim(),
    minSpend: z.string().trim(),
    perUserLimit: optionalInt("a per customer limit", 1, 1000),
    globalLimit: optionalInt("a total limit", 1, MAX_LIMIT),
    firstOrderOnly: z.boolean(),
    startsAt: optionalUtc("a start"),
    endsAt: optionalUtc("an end"),
    isActive: z.boolean(),
    note: z.string().trim().max(200, "Keep the note under 200 characters."),
    categoryIds: z.array(z.string().uuid()).max(50),
    productSlugs: z
      .string()
      .trim()
      .max(2000)
      .transform((s) => [...new Set(s.split(/[\s,]+/).map((x) => x.trim().toLowerCase()).filter(Boolean))])
      .refine((a) => a.length <= 50, "Limit a code to 50 products."),
  })
  .transform((v, ctx) => {
    let value = 0;
    if (v.type === "percent") {
      if (!/^\d{1,3}$/.test(v.value) || Number(v.value) < 1 || Number(v.value) > 100) {
        ctx.addIssue({ code: "custom", path: ["value"], message: "Enter a whole percent from 1 to 100." });
        return z.NEVER;
      }
      value = Number(v.value);
    } else if (v.type === "fixed_amount") {
      const cents = parseMoneyToCents(v.value);
      if (cents === null || cents <= 0 || cents > MAX_FIXED_CENTS) {
        ctx.addIssue({ code: "custom", path: ["value"], message: "Enter an amount like 5.00." });
        return z.NEVER;
      }
      value = cents;
    }
    let minSpendCents = 0;
    if (v.minSpend !== "") {
      const cents = parseMoneyToCents(v.minSpend);
      if (cents === null || cents > MAX_FIXED_CENTS) {
        ctx.addIssue({ code: "custom", path: ["minSpend"], message: "Enter a minimum like 25.00, or leave it empty." });
        return z.NEVER;
      }
      minSpendCents = cents;
    }
    if (v.startsAt && v.endsAt && v.endsAt <= v.startsAt) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "The end must be after the start." });
      return z.NEVER;
    }
    return {
      code: v.code,
      type: v.type,
      value,
      minSpendCents,
      perUserLimit: v.perUserLimit,
      globalLimit: v.globalLimit,
      firstOrderOnly: v.firstOrderOnly,
      startsAt: v.startsAt,
      endsAt: v.endsAt,
      isActive: v.isActive,
      note: v.note === "" ? null : v.note,
      categoryIds: v.categoryIds,
      productSlugs: v.productSlugs,
    };
  });
export type VoucherFormInput = z.infer<typeof voucherFormSchema>;

export const voucherListSchema = z.object({
  status: z.enum(["all", "active", "inactive"]).catch("all"),
  q: z
    .string()
    .optional()
    .transform((s) => normalizeCode(s ?? "").replace(/[^A-Z0-9_-]/g, "").slice(0, 32))
    .catch(""),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
});
