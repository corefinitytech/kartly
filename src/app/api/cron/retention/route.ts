import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { runRetention } from "@/modules/privacy/retention-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Daily retention and scheduled erasures (PRD 9.4 step 3, 9.5). Bearer CRON_SECRET. */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authorized." } }, { status: 401 });
  }
  const counts = await runRetention();
  return Response.json({ data: counts });
}
