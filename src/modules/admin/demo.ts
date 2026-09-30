// Server only: import from server components and scripts, never from "use client" files.
// Demo admin for reviewers (PRD Section 15: test admin credentials in the README).
// Created by `npm run db:seed:admin`. The password is below the signup policy
// (FR-AUTH-01, 10+ chars) by the owner's choice; sign-in does not re-check length.
export const DEMO_ADMIN = {
  email: "admin@kartly.com",
  password: "Test1@3",
  name: "Kartly Admin",
} as const;

/**
 * Prefill the admin sign-in form? Always in local development; on a deployed
 * site only when DEMO_ADMIN_PREFILL=true, because it hands the password to
 * anyone who opens /admin.
 */
export function demoAdminPrefillEnabled(): boolean {
  return process.env.NODE_ENV === "development" || process.env.DEMO_ADMIN_PREFILL === "true";
}
