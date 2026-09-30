"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { accounts, users } from "@/db/schema/identity";
import { auth, verifyPassword } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { sendMail } from "@/lib/mailer";
import { passwordChangedEmail } from "@/modules/auth/emails";
import { validatePassword } from "@/modules/auth/password";
import { safeNext } from "@/modules/auth/session";
import { clearFailures, formatRemaining, lockoutKey, lockoutRemainingMs, recordFailure } from "@/modules/auth/lockout";
import { CART_COOKIE_NAME, hashCartToken } from "@/modules/cart/identity";
import { mergeGuestCartIntoUser } from "@/modules/cart/merge-service";
import { encryptPii } from "@/lib/crypto";

export interface FormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  notice?: string;
}

const DUMMY_HASH = "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzdHJh$RdescudvJCsgt3ub+b+dWRWJTmaaJObG";

const signUpSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
  ageConfirmed: z.literal(true, { errorMap: () => ({ message: "Please confirm you are 16 or older." }) }),
});

async function mergeGuestCart(userId: string): Promise<{ mergedAnything: boolean; clampedAnything: boolean }> {
  const store = await cookies();
  const token = store.get(CART_COOKIE_NAME)?.value;
  if (!token) return { mergedAnything: false, clampedAnything: false };
  const plan = await mergeGuestCartIntoUser(hashCartToken(token), userId);
  store.delete(CART_COOKIE_NAME);
  return { mergedAnything: plan.mergedAnything, clampedAnything: plan.clampedAnything };
}

export async function signUpAction(
  _prev: FormState | undefined,
  formData: FormData,
): Promise<FormState> {
  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    ageConfirmed: formData.get("ageConfirmed") === "on" ? true : undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string> };
  }
  const { name, email, password } = parsed.data;
  const passwordIssues = validatePassword(password, email);
  if (passwordIssues.length > 0) {
    return { fieldErrors: { password: passwordIssues[0]!.message } };
  }

  const headerList = await headers();
  let userId: string;
  try {
    const result = await auth.api.signUpEmail({
      body: { name, email, password },
      headers: headerList,
    });
    userId = result.user.id;
  } catch {
    void verifyPassword({ password, hash: DUMMY_HASH }).catch(() => undefined);
    return {
      error: "This email may already have an account. Try signing in or resetting your password.",
    };
  }
  await db.update(users).set({ ageConfirmedAt: new Date() }).where(eq(users.id, userId));
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();
  await writeAudit({ actorId: userId, actorRole: "customer", action: "auth.sign_up", entityType: "user", entityId: userId, ip }).catch(() => undefined);

  await mergeGuestCart(userId);
  redirect(safeNext(formData.get("next")?.toString() ?? "/account"));
}

export async function signInAction(
  _prev: FormState | undefined,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const key = lockoutKey(email, ip);

  const locked = lockoutRemainingMs(key);
  if (locked > 0) {
    return { error: `Too many attempts. Try again in ${formatRemaining(locked)}.` };
  }

  if (!email || !password) {
    return { fieldErrors: { email: !email ? "Enter your email." : "", password: !password ? "Enter your password." : "" } };
  }

  const known = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (known.length === 0) {
    await verifyPassword({ password, hash: DUMMY_HASH }).catch(() => undefined);
    recordFailure(key);
    return { error: "Email or password is incorrect." };
  }

  let signedInUserId: string;
  try {
    const result = await auth.api.signInEmail({ body: { email, password }, headers: headerList });
    signedInUserId = result.user.id;
  } catch {
    recordFailure(key);
    await writeAudit({ actorId: null, actorRole: null, action: "auth.sign_in_failed", entityType: "session", entityId: "anonymous", ip }).catch(() => undefined);
    return { error: "Email or password is incorrect." };
  }

  clearFailures(key);
  await writeAudit({ actorId: signedInUserId, actorRole: "customer", action: "auth.sign_in", entityType: "user", entityId: signedInUserId, ip }).catch(() => undefined);

  const merge = await mergeGuestCart(signedInUserId);
  if (merge.mergedAnything) {
    const store = await cookies();
    store.set("kt_cart_merged", merge.clampedAnything ? "clamped" : "merged", { maxAge: 30, path: "/" });
  }
  redirect(safeNext(formData.get("next")?.toString() ?? "/account"));
}

export async function forgotPasswordAction(
  _prev: FormState | undefined,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !z.string().email().safeParse(email).success) {
    return { fieldErrors: { email: "Enter a valid email address." } };
  }
  const headerList = await headers();
  await auth.api
    .requestPasswordReset({ body: { email, redirectTo: "/reset-password" }, headers: headerList })
    .catch(() => undefined);
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();
  await writeAudit({ actorId: null, actorRole: null, action: "auth.password_reset_requested", entityType: "user", entityId: "anonymous", ip }).catch(() => undefined);
  return { notice: "If that email has an account, a reset link is on its way. The link expires in 1 hour." };
}

export async function resetPasswordAction(
  _prev: FormState | undefined,
  formData: FormData,
): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const issues = validatePassword(password);
  if (issues.length > 0) {
    return { fieldErrors: { password: issues[0]!.message } };
  }

  const headerList = await headers();
  try {
    await auth.api.resetPassword({ body: { newPassword: password, token }, headers: headerList });
  } catch {
    return { error: "This reset link is invalid or has expired. Request a new one." };
  }

  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();
  await writeAudit({ actorId: null, actorRole: null, action: "auth.password_changed", entityType: "user", entityId: "anonymous", ip }).catch(() => undefined);
  redirect("/login?notice=reset");
}

export async function changePasswordAction(
  _prev: FormState | undefined,
  formData: FormData,
): Promise<FormState> {
  const { getSession } = await import("@/modules/auth/session");
  const session = await getSession();
  if (!session) return { error: "Please sign in again." };

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const issues = validatePassword(newPassword, session.user.email);
  if (issues.length > 0) {
    return { fieldErrors: { newPassword: issues[0]!.message } };
  }

  const account = await db
    .select({ password: accounts.password })
    .from(accounts)
    .where(and(eq(accounts.userId, session.user.id), eq(accounts.providerId, "credential")))
    .limit(1);
  const stored = account[0]?.password ?? DUMMY_HASH;
  const currentOk = await verifyPassword({ password: currentPassword, hash: stored }).catch(() => false);
  if (!currentOk) {
    return { fieldErrors: { currentPassword: "Current password is incorrect." } };
  }

  const headerList = await headers();
  try {
    await auth.api.changePassword({
      body: { currentPassword, newPassword, revokeOtherSessions: true },
      headers: headerList,
    });
  } catch {
    return { error: "Could not change the password. Please try again." };
  }

  await sendMail({ to: session.user.email, ...passwordChangedEmail(session.user.name) });
  await writeAudit({ actorId: session.user.id, actorRole: session.user.role, action: "auth.password_changed", entityType: "user", entityId: session.user.id }).catch(() => undefined);
  return { notice: "Password changed. Other sessions were signed out." };
}

export async function updateProfileAction(
  _prev: FormState | undefined,
  formData: FormData,
): Promise<FormState> {
  const { getSession } = await import("@/modules/auth/session");
  const session = await getSession();
  if (!session) return { error: "Please sign in again." };

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (name.length < 1) {
    return { fieldErrors: { name: "Enter your name." } };
  }
  if (phone && !/^[+\d][\d\s()-]{4,20}$/.test(phone)) {
    return { fieldErrors: { phone: "Enter a valid phone number." } };
  }

  await db
    .update(users)
    .set({ name, phoneEnc: phone ? encryptPii(phone) : null, updatedAt: new Date() })
    .where(eq(users.id, session.user.id));
  await writeAudit({ actorId: session.user.id, actorRole: session.user.role, action: "account.profile_updated", entityType: "user", entityId: session.user.id }).catch(() => undefined);
  return { notice: "Profile saved." };
}

export async function resendVerificationAction(): Promise<FormState> {
  const { getSession } = await import("@/modules/auth/session");
  const session = await getSession();
  if (!session) return { error: "Please sign in again." };
  const headerList = await headers();
  await auth.api.sendVerificationEmail({ body: { email: session.user.email }, headers: headerList }).catch(() => undefined);
  return { notice: "Verification email sent. It can take a few minutes to arrive." };
}
