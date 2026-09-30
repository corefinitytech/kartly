import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { expireStaleOrders } from "@/modules/checkout/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authorized." } }, { status: 401 });
  }
  const expired = await expireStaleOrders();
  return Response.json({ data: { expired } });
}
