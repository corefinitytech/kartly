import type { NextRequest } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/ratelimit";
import { cancelOwnOrder } from "@/modules/orders/service";
import { clientIp, errorResponse } from "@/app/api/cart/_shared";
import { ORDER_NUMBER, orderAccess } from "../../_access";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ email: z.string().trim().toLowerCase().email().max(254).optional() });

/** Customer cancels their own order (FR-ORD-03). Stock is restored and any payment refunded. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ number: string }> }) {
  try {
    const { number } = await ctx.params;
    const notFound = Response.json({ error: { code: "NOT_FOUND", message: "Order not found." } }, { status: 404 });
    if (!ORDER_NUMBER.test(number)) return notFound;
    const ip = clientIp(request);
    const limit = await rateLimit("orderLookup", ip);
    if (!limit.allowed) {
      return Response.json({ error: { code: "RATE_LIMITED", message: "Too many requests. Try again later." } }, { status: 429 });
    }
    const body = bodySchema.safeParse(await request.json().catch(() => ({})));
    const access = await orderAccess(request, body.success ? body.data.email : undefined);
    if (!access) return notFound;
    const { refundError } = await cancelOwnOrder(number, access, ip);
    return Response.json({ data: { cancelled: true, refundPending: Boolean(refundError) } });
  } catch (error) {
    return errorResponse(error);
  }
}
