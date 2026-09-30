import type { NextRequest } from "next/server";
import { removeItem, setQuantity } from "@/modules/cart/service";
import { setQuantitySchema } from "@/modules/cart/schemas";
import { AppError } from "@/lib/errors";
import { errorResponse, limitMutations, resolveOwner } from "../../_shared";

export const dynamic = "force-dynamic";

function variantId(params: Record<string, string>): string {
  const id = params["id"];
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    throw new AppError("VALIDATION", "Invalid item id.");
  }
  return id;
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<Record<string, string>> }) {
  try {
    const limited = await limitMutations(request);
    if (limited) return limited;

    const parsed = setQuantitySchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: { code: "VALIDATION", message: "Invalid quantity." } },
        { status: 422 },
      );
    }

    const { owner } = await resolveOwner();
    const id = variantId(await ctx.params);
    const result = await setQuantity(owner, id, parsed.data.quantity);
    return Response.json({ data: result });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<Record<string, string>> }) {
  try {
    const limited = await limitMutations(request);
    if (limited) return limited;

    const { owner } = await resolveOwner();
    const id = variantId(await ctx.params);
    const cart = await removeItem(owner, id);
    return Response.json({ data: { removed: true, cart } });
  } catch (error) {
    return errorResponse(error);
  }
}
