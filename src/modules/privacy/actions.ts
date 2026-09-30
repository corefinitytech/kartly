"use server";

// Privacy Centre actions: authorize, validate, step-up, call the service.
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/ratelimit";
import { requireApiUser } from "@/modules/auth/session";
import { cancelDeletion, requestDeletion, requestExport, verifyStepUp, type Requester } from "./dsar-service";

export interface PrivacyFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  notice?: string;
  downloadUrl?: string;
}

async function requester(): Promise<Requester> {
  const user = await requireApiUser();
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  return { id: user.id, name: user.name, email: user.email, ip };
}

const passwordSchema = z.string().min(1, "Enter your password to confirm it is you.").max(128);

function fail(error: unknown): PrivacyFormState {
  return { error: error instanceof AppError ? error.message : "Something went wrong. Please try again." };
}

/** FR-GDPR-10: step-up, then a 24 hour download link (also emailed). */
export async function requestExportAction(_prev: PrivacyFormState | undefined, formData: FormData): Promise<PrivacyFormState> {
  try {
    const user = await requester();
    const password = passwordSchema.safeParse(formData.get("password") ?? "");
    if (!password.success) return { fieldErrors: { password: password.error.issues[0]!.message } };
    const limit = await rateLimit("dsar", user.id);
    if (!limit.allowed) return { error: "You have made 3 privacy requests today. Try again tomorrow." };
    await verifyStepUp(user.id, password.data);
    const { url } = await requestExport(user);
    revalidatePath("/account/privacy");
    return { notice: "Your data is ready. The link works for 24 hours and was also emailed to you.", downloadUrl: url };
  } catch (error) {
    return fail(error);
  }
}

/** FR-GDPR-12 / 9.4: step-up and explicit confirmation, then a 7 day cool off. */
export async function requestDeletionAction(_prev: PrivacyFormState | undefined, formData: FormData): Promise<PrivacyFormState> {
  try {
    const user = await requester();
    const password = passwordSchema.safeParse(formData.get("password") ?? "");
    if (!password.success) return { fieldErrors: { password: password.error.issues[0]!.message } };
    if (formData.get("confirm") !== "on") return { fieldErrors: { confirm: "Tick the box to confirm you understand." } };
    const limit = await rateLimit("dsar", user.id);
    if (!limit.allowed) return { error: "You have made 3 privacy requests today. Try again tomorrow." };
    await verifyStepUp(user.id, password.data);
    await requestDeletion(user);
    revalidatePath("/account/privacy");
    return { notice: "Deletion scheduled. We emailed you the date. You can cancel until then." };
  } catch (error) {
    return fail(error);
  }
}

export async function cancelDeletionAction(): Promise<PrivacyFormState> {
  try {
    await cancelDeletion(await requester());
    revalidatePath("/account/privacy");
    return { notice: "Deletion cancelled. Your account stays as it is." };
  } catch (error) {
    return fail(error);
  }
}
