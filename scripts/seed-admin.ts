// Create or reset the demo admin account (idempotent): npm run db:seed:admin
// Writes the same rows Better Auth's email signup would (users + a "credential"
// account with an argon2id hash), with role admin and email already verified.
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { DEMO_ADMIN } from "@/modules/admin/demo";

async function main() {
  const hash = await hashPassword(DEMO_ADMIN.password);
  const userId = await db.transaction(async (tx) => {
    const users = await tx.execute<{ id: string }>(sql`
      insert into users (name, email, email_verified, role, status, age_confirmed_at)
      values (${DEMO_ADMIN.name}, ${DEMO_ADMIN.email}, true, 'admin', 'active', now())
      on conflict (email) do update set role = 'admin', status = 'active', email_verified = true, updated_at = now()
      returning id
    `);
    const id = users[0]!.id;
    const updated = await tx.execute(sql`
      update accounts set password = ${hash}, updated_at = now()
      where user_id = ${id} and provider_id = 'credential' returning id
    `);
    if (updated.length === 0) {
      await tx.execute(sql`
        insert into accounts (user_id, account_id, provider_id, password)
        values (${id}, ${id}, 'credential', ${hash})
      `);
    }
    // Existing sessions predate the reset; make them sign in again.
    await tx.execute(sql`delete from sessions where user_id = ${id}`);
    return id;
  });
  await writeAudit({ actorId: null, actorRole: "cli", action: "user.demo_admin_seeded", entityType: "user", entityId: userId });
  console.log(`Demo admin ready (user ${userId}). Sign in at /admin.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
