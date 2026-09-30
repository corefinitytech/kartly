import { getCartCount } from "@/modules/cart/service";
import { errorResponse, resolveOwner } from "../_shared";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { owner } = await resolveOwner();
    const count = await getCartCount(owner);
    return Response.json({ data: { count } });
  } catch (error) {
    return errorResponse(error);
  }
}
