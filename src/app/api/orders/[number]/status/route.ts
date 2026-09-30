import type { NextRequest } from "next/server";
import { getSession } from "@/modules/auth/session";
import { getOrderDetailByNumber } from "@/modules/orders/service";
import { errorResponse } from "@/app/api/cart/_shared";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, ctx: { params: Promise<{ number: string }> }) {
  try {
    const { number } = await ctx.params;
    if (!/^KT-\d{8}-[A-HJ-NP-Z2-9]{5}$/.test(number)) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Order not found." } }, { status: 404 });
    }
    const token = _request.headers.get("x-order-token");
    const session = await getSession();
    if (session) {
      const order = await getOrderDetailByNumber(number, { userId: session.user.id });
      return Response.json({ data: { status: order.status, number: order.number } });
    }
    if (token) {
      const order = await getOrderDetailByNumber(number, { accessToken: token });
      return Response.json({ data: { status: order.status, number: order.number } });
    }
    return Response.json({ error: { code: "NOT_FOUND", message: "Order not found." } }, { status: 404 });
  } catch (error) {
    return errorResponse(error);
  }
}
