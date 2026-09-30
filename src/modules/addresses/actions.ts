"use server";

import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { addressSchema, type AddressInput } from "./schemas";
import * as service from "./service";
import type { FormState } from "@/modules/auth/actions";

function parse(formData: FormData): { data?: AddressInput; fieldErrors?: Record<string, string> } {
  const parsed = addressSchema.safeParse({
    fullName: formData.get("fullName") ?? "",
    line1: formData.get("line1") ?? "",
    line2: formData.get("line2") ?? "",
    city: formData.get("city") ?? "",
    region: formData.get("region") ?? "",
    postalCode: formData.get("postalCode") ?? "",
    country: formData.get("country") ?? "",
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string> };
  }
  return { data: parsed.data };
}

async function user() {
  const { requireApiUser } = await import("@/modules/auth/session");
  return requireApiUser();
}

export async function createAddressAction(
  _prev: FormState | undefined,
  formData: FormData,
): Promise<FormState> {
  const session = await user();
  const { data, fieldErrors } = parse(formData);
  if (!data) return { fieldErrors };
  try {
    const created = await service.createAddress(session.id, data);
    await writeAudit({ actorId: session.id, actorRole: session.role, action: "account.address_created", entityType: "address", entityId: created.id }).catch(() => undefined);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save the address." };
  }
  revalidatePath("/account/addresses");
  return { notice: "Address saved." };
}

export async function updateAddressAction(
  _prev: FormState | undefined,
  formData: FormData,
): Promise<FormState> {
  const session = await user();
  const addressId = String(formData.get("addressId") ?? "");
  const { data, fieldErrors } = parse(formData);
  if (!data) return { fieldErrors };
  try {
    await service.updateAddress(session.id, addressId, data);
    await writeAudit({ actorId: session.id, actorRole: session.role, action: "account.address_updated", entityType: "address", entityId: addressId }).catch(() => undefined);
  } catch {
    return { error: "Address not found." };
  }
  revalidatePath("/account/addresses");
  return { notice: "Address saved." };
}

export async function deleteAddressAction(formData: FormData): Promise<void> {
  const session = await user();
  const addressId = String(formData.get("addressId") ?? "");
  await service.deleteAddress(session.id, addressId).catch(() => undefined);
  await writeAudit({ actorId: session.id, actorRole: session.role, action: "account.address_deleted", entityType: "address", entityId: addressId }).catch(() => undefined);
  revalidatePath("/account/addresses");
}

export async function setDefaultAction(formData: FormData): Promise<void> {
  const session = await user();
  const addressId = String(formData.get("addressId") ?? "");
  const role = String(formData.get("role") ?? "shipping") === "billing" ? "billing" : "shipping";
  await service.setDefaultAddress(session.id, addressId, role).catch(() => undefined);
  revalidatePath("/account/addresses");
}
