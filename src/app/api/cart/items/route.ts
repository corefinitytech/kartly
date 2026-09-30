import type { NextRequest } from "next/server";
import { addItem } from "@/modules/cart/service";
import { addItemSchema } from "@/modules/cart/schemas";
import { errorResponse, limitMutations, resolveOwner, saveCartCookie } from "../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const limited = await limitMutations(request);
    if (limited) return limited;

    const parsed = addItemSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: { code: "VALIDATION", message: "Invalid item." } },
        { status: 422 },
      );
    }

    const context = await resolveOwner();
    const result = await addItem(context.owner, parsed.data.variantId, parsed.data.quantity);
    await saveCartCookie(context);
    return Response.json({ data: result });
  } catch (error) {
    return errorResponse(error);
  }
}
