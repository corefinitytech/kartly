import type { NextRequest } from "next/server";
import { getCart, setEstimateCountry } from "@/modules/cart/service";
import { estimateSchema } from "@/modules/cart/schemas";
import { errorResponse, limitMutations, resolveOwner } from "../_shared";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  try {
    const limited = await limitMutations(request);
    if (limited) return limited;

    const parsed = estimateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: { code: "VALIDATION", message: "Invalid country." } },
        { status: 422 },
      );
    }

    const { owner } = await resolveOwner();
    await setEstimateCountry(owner, parsed.data.country);
    const cart = await getCart(owner);
    return Response.json({ data: { cart } });
  } catch (error) {
    return errorResponse(error);
  }
}
