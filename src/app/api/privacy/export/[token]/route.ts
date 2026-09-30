import type { NextRequest } from "next/server";
import { getSession } from "@/modules/auth/session";
import { buildExport } from "@/modules/privacy/dsar-service";
import { errorResponse } from "@/app/api/cart/_shared";

export const dynamic = "force-dynamic";

/**
 * Download a data export (FR-GDPR-10). The link is `<requestId>.<token>`; it
 * works only for the signed-in owner, within 24 hours. Guests are sent to sign in.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token: link } = await ctx.params;
    const match = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{20,})$/.exec(link);
    const session = await getSession();
    if (!session) {
      const next = encodeURIComponent(new URL(request.url).pathname);
      return Response.redirect(new URL(`/login?next=${next}`, request.url), 303);
    }
    if (!match) {
      return Response.json({ error: { code: "NOT_FOUND", message: "This download link is not valid." } }, { status: 404 });
    }
    const { filename, zip } = await buildExport(session.user.id, match[1]!, match[2]!);
    return new Response(Buffer.from(zip), {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store, private",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
