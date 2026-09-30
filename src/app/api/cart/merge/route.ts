import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/modules/auth/session";
import { mergeGuestCartIntoUser } from "@/modules/cart/merge-service";
import { CART_COOKIE_NAME, hashCartToken } from "@/modules/cart/identity";
import { errorResponse, limitMutations } from "../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const limited = await limitMutations(request);
    if (limited) return limited;

    const session = await getSession();
    if (!session) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Please sign in." } },
        { status: 401 },
      );
    }

    const store = await cookies();
    const token = store.get(CART_COOKIE_NAME)?.value;
    if (!token) {
      return Response.json({ data: { mergedAnything: false, clampedAnything: false } });
    }

    const plan = await mergeGuestCartIntoUser(hashCartToken(token), session.user.id);
    store.delete(CART_COOKIE_NAME);
    return Response.json({ data: plan });
  } catch (error) {
    return errorResponse(error);
  }
}
