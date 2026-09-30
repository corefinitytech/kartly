import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/modules/auth/session";
import { markAllRead, markRead } from "@/modules/notifications/service";
import { errorResponse, limitMutations } from "@/app/api/cart/_shared";

export const dynamic = "force-dynamic";

const bodySchema = z.union([z.object({ id: z.string().uuid() }), z.object({ all: z.literal(true) })]);

export async function POST(request: NextRequest) {
  try {
    const limited = await limitMutations(request);
    if (limited) return limited;
    const user = await requireApiUser();
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: { code: "VALIDATION", message: "Invalid request." } }, { status: 422 });
    }
    if ("all" in parsed.data) {
      await markAllRead(user.id);
      return Response.json({ data: { unread: 0 } });
    }
    return Response.json({ data: { unread: await markRead(user.id, parsed.data.id) } });
  } catch (error) {
    return errorResponse(error);
  }
}
