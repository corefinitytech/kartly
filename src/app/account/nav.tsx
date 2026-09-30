"use client";

import { useActionState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { resendVerificationAction } from "@/modules/auth/actions";

const LINKS = [
  { href: "/account", label: "Overview" },
  { href: "/orders", label: "Orders" },
  { href: "/account/profile", label: "Profile" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/security", label: "Security" },
];

export function AccountNav({ firstName, showAdmin = false }: { firstName: string; showAdmin?: boolean }) {
  const pathname = usePathname();
  const links = showAdmin ? [...LINKS, { href: "/admin", label: "Store admin" }] : LINKS;
  return (
    <nav aria-label="Account">
      <p className="mb-3 text-lg font-semibold">Hi, {firstName}</p>
      <ul className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {links.map((link) => {
          const current = pathname === link.href;
          return (
            <li key={link.href} className="shrink-0">
              <Link
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center rounded-btn px-3 text-base text-inkSoft underline-offset-4 hover:bg-sunken hover:text-ink hover:underline",
                  current && "bg-brandTint font-medium text-ink",
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
        <li className="shrink-0">
          <button
            type="button"
            onClick={() => void signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/"; } }})}
            className="flex min-h-11 items-center rounded-btn px-3 text-base text-brandLink underline underline-offset-4"
          >
            Sign out
          </button>
        </li>
      </ul>
    </nav>
  );
}

export function VerifyBanner({ verified }: { verified: boolean }) {
  const [state, formAction, pending] = useActionState(resendVerificationAction, undefined);
  if (verified) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-badge bg-warningTint px-3 py-2 text-sm text-warning">
      <Badge variant="default">Not verified</Badge>
      <span>{state?.notice ?? "Your email is not verified yet. You can still shop and sign in."}</span>
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className="min-h-9 rounded-btn px-2 font-medium text-warning underline underline-offset-4 disabled:opacity-50"
        >
          {pending ? "Sending" : "Resend link"}
        </button>
      </form>
    </div>
  );
}
