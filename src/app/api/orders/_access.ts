import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/modules/auth/session";
import type { OrderAccess } from "@/modules/orders/service";

export const ORDER_NUMBER = /^KT-\d{8}-[A-HJ-NP-Z2-9]{5}$/;

export const lookupSchema = z.object({
  number: z.string().trim().toUpperCase().regex(ORDER_NUMBER, "Enter the order number, like KT-20260930-ABCDE."),
  email: z.string().trim().toLowerCase().email("Enter the email used at checkout.").max(254),
});

/** Signed-in owner, else the guest link token header, else a number + email lookup. */
export async function orderAccess(request: NextRequest, email?: string): Promise<OrderAccess | null> {
  const session = await getSession();
  if (session) return { userId: session.user.id };
  const token = request.headers.get("x-order-token");
  if (token) return { accessToken: token };
  if (email) return { email };
  return null;
}
