import type { Metadata } from "next";
import { requireUser } from "@/modules/auth/session";
import { AccountNav, VerifyBanner } from "./nav";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
      <VerifyBanner verified={user.emailVerified} />
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <AccountNav firstName={user.name.split(" ")[0] ?? user.name} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
