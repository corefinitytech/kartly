import { getCart } from "@/modules/cart/service";
import { errorResponse, resolveOwner } from "./_shared";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { owner } = await resolveOwner();
    const cart = await getCart(owner);
    return Response.json({ data: { cart } });
  } catch (error) {
    return errorResponse(error);
  }
}
