import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { addresses } from "@/db/schema/identity";
import { decryptPii, encryptPii } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { MAX_ADDRESSES, type AddressInput } from "./schemas";

export interface AddressView {
  id: string;
  fullName: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string;
  country: string;
  phone: string | null;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}

function toView(row: typeof addresses.$inferSelect): AddressView {
  return {
    id: row.id,
    fullName: decryptPii(row.nameEnc),
    line1: decryptPii(row.line1Enc),
    line2: row.line2Enc ? decryptPii(row.line2Enc) : null,
    city: row.city,
    region: row.region,
    postalCode: row.postalCode,
    country: row.country,
    phone: row.phoneEnc ? decryptPii(row.phoneEnc) : null,
    isDefaultShipping: row.isDefaultShipping,
    isDefaultBilling: row.isDefaultBilling,
  };
}

export async function listAddresses(userId: string): Promise<AddressView[]> {
  const rows = await db
    .select()
    .from(addresses)
    .where(eq(addresses.userId, userId))
    .orderBy(desc(addresses.position), addresses.id);
  return rows.map(toView);
}

async function ownedAddress(userId: string, addressId: string) {
  const rows = await db
    .select()
    .from(addresses)
    .where(and(eq(addresses.id, addressId), eq(addresses.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new AppError("NOT_FOUND", "Address not found.");
  return row;
}

export async function getAddress(userId: string, addressId: string): Promise<AddressView> {
  return toView(await ownedAddress(userId, addressId));
}

export async function countAddresses(userId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(addresses)
    .where(eq(addresses.userId, userId));
  return Number(rows[0]?.total ?? 0);
}

export async function createAddress(userId: string, input: AddressInput): Promise<AddressView> {
  if ((await countAddresses(userId)) >= MAX_ADDRESSES) {
    throw new AppError("VALIDATION", `You can save up to ${MAX_ADDRESSES} addresses.`);
  }
  const existing = await countAddresses(userId);
  const isFirst = existing === 0;
  const [row] = await db
    .insert(addresses)
    .values({
      userId,
      nameEnc: encryptPii(input.fullName),
      line1Enc: encryptPii(input.line1),
      line2Enc: input.line2 ? encryptPii(input.line2) : null,
      city: input.city,
      region: input.region || null,
      postalCode: input.postalCode,
      country: input.country,
      phoneEnc: input.phone ? encryptPii(input.phone) : null,
      isDefaultShipping: isFirst,
      isDefaultBilling: isFirst,
      position: Date.now(),
    })
    .returning();
  return toView(row!);
}

export async function updateAddress(userId: string, addressId: string, input: AddressInput): Promise<AddressView> {
  await ownedAddress(userId, addressId);
  const [row] = await db
    .update(addresses)
    .set({
      nameEnc: encryptPii(input.fullName),
      line1Enc: encryptPii(input.line1),
      line2Enc: input.line2 ? encryptPii(input.line2) : null,
      city: input.city,
      region: input.region || null,
      postalCode: input.postalCode,
      country: input.country,
      phoneEnc: input.phone ? encryptPii(input.phone) : null,
    })
    .where(eq(addresses.id, addressId))
    .returning();
  return toView(row!);
}

export async function deleteAddress(userId: string, addressId: string): Promise<void> {
  const row = await ownedAddress(userId, addressId);
  await db.delete(addresses).where(eq(addresses.id, addressId));

  const wasDefault = row.isDefaultShipping || row.isDefaultBilling;
  if (wasDefault) {
    const remaining = await db
      .select()
      .from(addresses)
      .where(eq(addresses.userId, userId))
      .orderBy(desc(addresses.position))
      .limit(1);
    const promoted = remaining[0];
    if (promoted) {
      await db
        .update(addresses)
        .set({
          isDefaultShipping: row.isDefaultShipping ? true : promoted.isDefaultShipping,
          isDefaultBilling: row.isDefaultBilling ? true : promoted.isDefaultBilling,
        })
        .where(eq(addresses.id, promoted.id));
    }
  }
}

export async function setDefaultAddress(
  userId: string,
  addressId: string,
  role: "shipping" | "billing",
): Promise<void> {
  await ownedAddress(userId, addressId);
  await db.transaction(async (tx) => {
    await tx
      .update(addresses)
      .set(role === "shipping" ? { isDefaultShipping: false } : { isDefaultBilling: false })
      .where(eq(addresses.userId, userId));
    await tx
      .update(addresses)
      .set(role === "shipping" ? { isDefaultShipping: true } : { isDefaultBilling: true })
      .where(and(eq(addresses.id, addressId), eq(addresses.userId, userId)));
  });
}
