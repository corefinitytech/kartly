import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/modules/auth/session";
import { deleteReview, updateReview } from "@/modules/reviews/service";
import { reviewInputSchema } from "@/modules/reviews/rules";
import { clientIp, errorResponse, limitMutations } from "@/app/api/cart/_shared";

export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();

async function reviewId(params: Promise<{ id: string }>): Promise<string | null> {
  const parsed = idSchema.safeParse((await params).id);
  return parsed.success ? parsed.data : null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const limited = await limitMutations(request);
    if (limited) return limited;
    const user = await requireApiUser();
    const id = await reviewId(params);
    if (!id) return Response.json({ error: { code: "NOT_FOUND", message: "That review no longer exists." } }, { status: 404 });
    const parsed = reviewInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      const fieldErrors = Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]));
      return Response.json({ error: { code: "VALIDATION", message: "Check the highlighted fields.", fieldErrors } }, { status: 422 });
    }
    await updateReview(user.id, id, parsed.data, clientIp(request));
    return Response.json({ data: { id } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const limited = await limitMutations(request);
    if (limited) return limited;
    const user = await requireApiUser();
    const id = await reviewId(params);
    if (!id) return Response.json({ error: { code: "NOT_FOUND", message: "That review no longer exists." } }, { status: 404 });
    await deleteReview(user.id, id, clientIp(request));
    return Response.json({ data: { id } });
  } catch (error) {
    return errorResponse(error);
  }
}
