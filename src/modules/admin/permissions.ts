// Admin roles and what each may do (PRD FR-ADM-15). Pure, so the matrix is
// unit tested; guard.ts applies it to the live session.

export const STAFF_ROLES = ["admin", "support"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const PERMISSIONS = [
  "orders.view",
  "orders.fulfil", // advance processing -> shipped -> delivered, add tracking
  "orders.cancel",
  "orders.refund",
  "orders.viewFullPii", // unmasked contact email and full shipping address
  "products.manage",
  "inventory.manage",
  "audit.view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const SUPPORT: readonly Permission[] = ["orders.view", "orders.fulfil"];

export function isStaffRole(role: string): role is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

export function can(role: string, permission: Permission): boolean {
  if (role === "admin") return true;
  if (role === "support") return SUPPORT.includes(permission);
  return false;
}

/** Admin sessions are capped at 12 hours from sign-in (FR-AUTH-03). */
export const ADMIN_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function isAdminSessionStale(createdAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - createdAt.getTime() > ADMIN_SESSION_MAX_AGE_MS;
}

/** j•••@e•••.com — enough to recognise a customer, not enough to contact them. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "•••";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  const domainName = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : "";
  return `${local[0]}•••@${domainName[0] ?? ""}•••${tld}`;
}
