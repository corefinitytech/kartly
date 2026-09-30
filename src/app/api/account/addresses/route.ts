import { getSession } from "@/modules/auth/session";
import { listAddresses } from "@/modules/addresses/service";
import { errorResponse } from "@/app/api/cart/_shared";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Please sign in." } }, { status: 401 });
    }
    const addresses = await listAddresses(session.user.id);
    return Response.json({ data: { addresses } });
  } catch (error) {
    return errorResponse(error);
  }
}
