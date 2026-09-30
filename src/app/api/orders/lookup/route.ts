import type { NextRequest } from "next/server";
import { rateLimit } from "@/lib/ratelimit";
import { getOrderDetailByNumber } from "@/modules/orders/service";
import { clientIp, errorResponse } from "@/app/api/cart/_shared";
import { lookupSchema } from "../_access";

export const dynamic = "force-dynamic";

/** Guest order lookup by order number + checkout email (FR-ORD-02), 10 per hour per IP. */
export async function POST(request: NextRequest) {
  try {
    const limit = await rateLimit("orderLookup", clientIp(request));
    if (!limit.allowed) {
      return Response.json({ error: { code: "RATE_LIMITED", message: "Too many lookups. Try again in an hour." } }, { status: 429 });
    }
    const parsed = lookupSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json({ error: { code: "VALIDATION", message: parsed.error.issues[0]?.message ?? "Check the details." } }, { status: 422 });
    }
    const order = await getOrderDetailByNumber(parsed.data.number, { email: parsed.data.email });
    return Response.json({ data: { order } });
  } catch (error) {
    // Same answer whether the number or the email was wrong, so neither can be probed.
    return errorResponse(error);
  }
}
