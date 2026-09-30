import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSession, requireApiUser } from "@/modules/auth/session";
import { createReview, myReviewState } from "@/modules/reviews/service";
import { createReviewSchema } from "@/modules/reviews/rules";
import { clientIp, errorResponse, limitMutations } from "@/app/api/cart/_shared";

export const dynamic = "force-dynamic";

const querySchema = z.object({ productId: z.string().uuid() });

/** The composer's state for this shopper: can they review, and their own review. */
export async function GET(request: NextRequest) {
  try {
    const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) {
      return Response.json({ error: { code: "VALIDATION", message: "Invalid product." } }, { status: 422 });
    }
    const session = await getSession();
    const state = await myReviewState(session?.user.id ?? null, parsed.data.productId);
    return Response.json({ data: state }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = await limitMutations(request);
    if (limited) return limited;
    const user = await requireApiUser();
    const parsed = createReviewSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      const fieldErrors = Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]));
      return Response.json({ error: { code: "VALIDATION", message: "Check the highlighted fields.", fieldErrors } }, { status: 422 });
    }
    const { productId, ...input } = parsed.data;
    const id = await createReview(user.id, productId, input, clientIp(request));
    return Response.json({ data: { id } }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
