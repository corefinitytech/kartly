"use server";

// Admin voucher actions (FR-ADM-08): authorize, validate, call the service.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { requireStaffAction } from "@/modules/admin/guard";
import { fieldErrors, type AdminFormState } from "@/modules/admin/schemas";
import * as service from "./service";
import { voucherFormSchema } from "./schemas";

const id = z.string().uuid();

function readForm(formData: FormData) {
  const text = (name: string) => String(formData.get(name) ?? "");
  return {
    code: text("code"),
    type: text("type"),
    value: text("value"),
    minSpend: text("minSpend"),
    perUserLimit: text("perUserLimit"),
    globalLimit: text("globalLimit"),
    firstOrderOnly: formData.get("firstOrderOnly") === "on",
    startsAt: text("startsAt"),
    endsAt: text("endsAt"),
    isActive: formData.get("isActive") === "on",
    note: text("note"),
    categoryIds: formData.getAll("categoryIds").map(String),
    productSlugs: text("productSlugs"),
  };
}

async function run(formData: FormData, fn: (staff: Awaited<ReturnType<typeof requireStaffAction>>) => Promise<AdminFormState>): Promise<AdminFormState> {
  let state: AdminFormState;
  try {
    state = await fn(await requireStaffAction("vouchers.manage"));
  } catch (error) {
    if (error instanceof AppError) state = { error: error.message };
    else {
      logger.error({ error: error instanceof Error ? error.name : "unknown" }, "voucher action failed");
      state = { error: "Something went wrong. Please try again." };
    }
  }
  if (state.error || state.fieldErrors) {
    const values: Record<string, string> = {};
    for (const [key, value] of formData.entries()) if (typeof value === "string") values[key] = value;
    values.categoryIds = formData.getAll("categoryIds").map(String).join(",");
    state.values = values;
  }
  return state;
}

export async function createVoucherAction(_prev: AdminFormState | undefined, formData: FormData): Promise<AdminFormState> {
  let createdId: string | null = null;
  const state = await run(formData, async (staff) => {
    const parsed = voucherFormSchema.safeParse(readForm(formData));
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
    createdId = await service.createVoucher(staff, parsed.data);
    revalidatePath("/admin/vouchers");
    return { notice: "Voucher created." };
  });
  if (createdId) redirect(`/admin/vouchers/${createdId}?created=1`);
  return state;
}

export async function updateVoucherAction(_prev: AdminFormState | undefined, formData: FormData): Promise<AdminFormState> {
  return run(formData, async (staff) => {
    const voucherId = id.parse(formData.get("voucherId"));
    const parsed = voucherFormSchema.safeParse(readForm(formData));
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
    await service.updateVoucher(staff, voucherId, parsed.data);
    revalidatePath(`/admin/vouchers/${voucherId}`);
    revalidatePath("/admin/vouchers");
    return { notice: "Voucher saved." };
  });
}

export async function setVoucherActiveAction(_prev: AdminFormState | undefined, formData: FormData): Promise<AdminFormState> {
  return run(formData, async (staff) => {
    const voucherId = id.parse(formData.get("voucherId"));
    const isActive = z.enum(["true", "false"]).parse(formData.get("isActive")) === "true";
    await service.setVoucherActive(staff, voucherId, isActive);
    revalidatePath(`/admin/vouchers/${voucherId}`);
    revalidatePath("/admin/vouchers");
    return { notice: isActive ? "Activated. Shoppers can use the code." : "Deactivated. The code no longer works at checkout." };
  });
}
