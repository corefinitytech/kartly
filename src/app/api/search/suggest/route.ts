import { NextResponse, type NextRequest } from "next/server";
import { suggestQuerySchema } from "@/modules/search/schemas";
import { suggestTitles } from "@/modules/search/repo";
import { rateLimit } from "@/lib/ratelimit";

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await rateLimit("search", ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many searches. Please slow down." } },
      { status: 429 },
    );
  }

  const q = request.nextUrl.searchParams.get("q") ?? "";
  const parsed = suggestQuerySchema.safeParse({ q });
  if (!parsed.success) {
    return NextResponse.json({ data: [] });
  }

  const suggestions = await suggestTitles(parsed.data.q);
  return NextResponse.json({ data: suggestions });
}
