"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { requireStaffAction } from "@/modules/admin/guard";
import type { AdminFormState } from "@/modules/admin/schemas";
import { updateDsarRequest } from "./dsar-service";
import { DSAR_STATUSES } from "./rules";

const schema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(DSAR_STATUSES),
  notes: z.string().trim().max(500, "Keep notes under 500 characters."),
});

/** Admin updates a DSAR's status and notes (FR-ADM-12). Admin only. */
export async function updateDsarAction(_prev: AdminFormState | undefined, formData: FormData): Promise<AdminFormState> {
  try {
    const staff = await requireStaffAction("privacy.manage");
    const parsed = schema.safeParse({
      requestId: formData.get("requestId"),
      status: formData.get("status"),
      notes: formData.get("notes") ?? "",
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
    await updateDsarRequest(staff, parsed.data.requestId, parsed.data.status, parsed.data.notes);
    revalidatePath("/admin/privacy");
    return { notice: "Saved." };
  } catch (error) {
    return { error: error instanceof AppError ? error.message : "Something went wrong. Please try again." };
  }
}
