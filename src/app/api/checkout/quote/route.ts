import type { NextRequest } from "next/server";
import { quote } from "@/modules/checkout/service";
import * as cartRepo from "@/modules/cart/repo";
import { quoteSchema } from "@/modules/checkout/schemas";
import { resolveOwner, errorResponse, limitMutations } from "@/app/api/cart/_shared";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const parsed = quoteSchema.safeParse(await request.json());
    if (!parsed.success) {
      const codeIssue = parsed.error.issues.find((i) => i.path[0] === "voucherCode");
      return Response.json(
        { error: { code: "VALIDATION", message: codeIssue?.message ?? "Invalid quote request.", field: codeIssue ? "voucherCode" : undefined } },
        { status: 422 },
      );
    }
    // Codes are guessable strings: quotes that carry one are rate limited.
    if (parsed.data.voucherCode) {
      const limited = await limitMutations(request);
      if (limited) return limited;
    }
    const { owner } = await resolveOwner();
    const [result, methods] = await Promise.all([
      quote(owner, parsed.data.country, parsed.data.shippingMethodCode, parsed.data.voucherCode),
      cartRepo.getShippingMethods(),
    ]);
    return Response.json({
      data: {
        quote: result,
        methods: methods
          .filter((m) => m.isActive)
          .map((m) => ({
            code: m.code,
            name: m.name,
            priceCents: m.priceCents,
            freeOverCents: m.freeOverCents,
            minDays: m.minDays,
            maxDays: m.maxDays,
          })),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
