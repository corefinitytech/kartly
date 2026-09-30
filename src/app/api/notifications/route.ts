import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/modules/auth/session";
import { listForUser, unreadCount } from "@/modules/notifications/service";
import { errorResponse } from "@/app/api/cart/_shared";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(500).catch(1),
  count: z.enum(["1"]).optional().catch(undefined),
});

/** GET ?count=1 for the header badge only, otherwise a page of the inbox. */
export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const query = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const headers = { "cache-control": "private, no-store" };
    if (query.count) {
      return Response.json({ data: { unread: await unreadCount(user.id) } }, { headers });
    }
    return Response.json({ data: await listForUser(user.id, query.page) }, { headers });
  } catch (error) {
    return errorResponse(error);
  }
}
