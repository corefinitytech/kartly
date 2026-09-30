import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { safeNext as safeNextValue } from "./safe-next";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: string;
  status: string;
}

export async function getSession(): Promise<{ user: SessionUser } | null> {
  const headerList = await headers();
  const session = await auth.api.getSession({ headers: headerList });
  if (!session?.user) return null;
  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      emailVerified: Boolean(session.user.emailVerified),
      role: (session.user as { role?: string }).role ?? "customer",
      status: (session.user as { status?: string }).status ?? "active",
    },
  };
}

export async function requireUser(next?: string): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(safeNextValue(next ?? "/account"))}`);
  }
  return session.user;
}

export async function requireApiUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new AppError("UNAUTHORIZED", "Please sign in.");
  return session.user;
}

export async function requireRole(role: "admin" | "support"): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== role && user.role !== "admin") {
    throw new AppError("FORBIDDEN", "You do not have access to this area.");
  }
  return user;
}

export function safeNext(value: string | undefined | null): string {
  if (!value) return "/account";
  if (!value.startsWith("/")) return "/account";
  if (value.startsWith("//") || value.startsWith("/\\")) return "/account";
  if (value.includes("://")) return "/account";
  return value;
}
