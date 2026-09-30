import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { Check, X } from "lucide-react";
import { db } from "@/lib/db";
import { users, verifications } from "@/db/schema/identity";
import { AuthCard } from "@/components/auth/form-kit";
import { writeAudit } from "@/lib/audit";

export const metadata: Metadata = {
  title: "Verify your email",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  let verified = false;

  if (token) {
    const rows = await db
      .select()
      .from(verifications)
      .where(eq(verifications.value, token))
      .limit(1);
    const record = rows[0];
    if (record && record.expiresAt.getTime() > Date.now()) {
      const updated = await db
        .update(users)
        .set({ emailVerified: true, updatedAt: new Date() })
        .where(eq(users.email, record.identifier))
        .returning({ id: users.id });
      await db.delete(verifications).where(eq(verifications.id, record.id));
      verified = updated.length > 0;
      if (updated[0]) {
        await writeAudit({ actorId: updated[0].id, actorRole: "customer", action: "auth.email_verified", entityType: "user", entityId: updated[0].id }).catch(() => undefined);
      }
    }
  }

  return (
    <AuthCard title={verified ? "Email verified" : "Link not valid"}>
      <div className="flex flex-col items-start gap-2 py-4 text-base">
        {verified ? (
          <>
            <Check strokeWidth={1.75} className="h-6 w-6 text-success" />
            <p className="text-inkSoft">Your email address is confirmed. Thank you.</p>
            <Link href="/account" className="mt-2 text-brandLink underline underline-offset-4">
              Go to your account
            </Link>
          </>
        ) : (
          <>
            <X strokeWidth={1.75} className="h-6 w-6 text-danger" />
            <p className="text-inkSoft">This verification link is invalid or has expired.</p>
            <Link href="/account" className="mt-2 text-brandLink underline underline-offset-4">
              Send a new link from your account
            </Link>
          </>
        )}
      </div>
    </AuthCard>
  );
}
