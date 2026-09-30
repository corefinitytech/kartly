import type { NextRequest } from "next/server";
import { z } from "zod";
import { placeOrder } from "@/modules/checkout/service";
import { placeOrderSchema } from "@/modules/checkout/schemas";
import { resolveOwner, errorResponse, limitMutations } from "@/app/api/cart/_shared";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const limited = await limitMutations(request);
    if (limited) return limited;

    const idempotencyKey = request.headers.get("Idempotency-Key") ?? "";
    if (!z.string().uuid().safeParse(idempotencyKey).success) {
      return Response.json(
        { error: { code: "VALIDATION", message: "Missing or invalid Idempotency-Key." } },
        { status: 422 },
      );
    }

    const parsed = placeOrderSchema.safeParse(await request.json());
    if (!parsed.success) {
      const message = Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? "Invalid checkout details.";
      return Response.json({ error: { code: "VALIDATION", message } }, { status: 422 });
    }

    const { owner } = await resolveOwner();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const result = await placeOrder(owner, parsed.data, idempotencyKey, ip);
    return Response.json({ data: result });
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    return errorResponse(error);
  }
}
