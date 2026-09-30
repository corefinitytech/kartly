import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema/identity";
import { decryptPii } from "@/lib/crypto";
import { requireUser } from "@/modules/auth/session";
import { ProfileForm } from "./form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await requireUser();
  const rows = await db
    .select({ name: users.name, phoneEnc: users.phoneEnc, email: users.email })
    .from(users)
    .where(eq(users.id, session.id))
    .limit(1);
  const row = rows[0];
  return (
    <ProfileForm
      initialName={row?.name ?? ""}
      initialPhone={row?.phoneEnc ? decryptPii(row.phoneEnc) : ""}
      email={row?.email ?? session.email}
    />
  );
}
