import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sessions } from "@/db/schema/identity";
import { AppError } from "@/lib/errors";
import { can, isAdminSessionStale, isStaffRole, type Permission, type StaffRole } from "./permissions";

export interface Staff {
  id: string;
  name: string;
  role: StaffRole;
  ip: string | null;
}

type Resolved =
  | { kind: "anonymous" }
  | { kind: "stale" }
  | { kind: "not_staff" }
  | { kind: "staff"; staff: Staff };

async function resolveStaff(): Promise<Resolved> {
  const headerList = await headers();
  // Always hit the database here: a revoked or demoted staff session must stop working at once.
  const result = await auth.api.getSession({ headers: headerList, query: { disableCookieCache: true } });
  if (!result?.user) return { kind: "anonymous" };
  const user = result.user as typeof result.user & { role?: string; status?: string };
  const role = user.role ?? "customer";
  if (!isStaffRole(role) || user.status !== "active") return { kind: "not_staff" };
  if (isAdminSessionStale(new Date(result.session.createdAt))) {
    // Revoke the session server-side; the next request is signed out.
    await db.delete(sessions).where(eq(sessions.id, result.session.id));
    return { kind: "stale" };
  }
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  return { kind: "staff", staff: { id: user.id, name: user.name, role, ip } };
}

/**
 * For admin pages and layouts. Signed-out and timed-out staff go to sign in;
 * everyone else who is not staff gets a plain 404 so the area is not advertised.
 */
export async function requireStaffPage(permission: Permission, next = "/admin"): Promise<Staff> {
  const resolved = await resolveStaff();
  if (resolved.kind === "anonymous" || resolved.kind === "stale") {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  if (resolved.kind === "not_staff") notFound();
  if (!can(resolved.staff.role, permission)) redirect("/admin/orders");
  return resolved.staff;
}

/** For server actions: never redirects, always throws a safe AppError. */
export async function requireStaffAction(permission: Permission): Promise<Staff> {
  const resolved = await resolveStaff();
  if (resolved.kind === "anonymous" || resolved.kind === "stale") {
    throw new AppError("UNAUTHORIZED", "Your admin session has ended. Please sign in again.");
  }
  if (resolved.kind === "not_staff" || !can(resolved.staff.role, permission)) {
    throw new AppError("FORBIDDEN", "You do not have permission to do that.");
  }
  return resolved.staff;
}
