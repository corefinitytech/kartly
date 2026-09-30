// Grant or remove a staff role: npm run admin:role -- <email> <admin|support|customer>
// The user must already have signed up. Their sessions are revoked so the new
// role (and the 12 hour admin session limit) applies from their next sign in.
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

const ROLES = ["admin", "support", "customer"] as const;

async function main() {
  const [email, role] = process.argv.slice(2);
  if (!email || !role || !(ROLES as readonly string[]).includes(role)) {
    console.error("Usage: npm run admin:role -- <email> <admin|support|customer>");
    process.exit(2);
  }
  const rows = await db.execute<{ id: string; role: string }>(sql`
    update users u set role = ${role}, updated_at = now()
    from (select id, role from users where email = ${email.trim().toLowerCase()} for update) old
    where u.id = old.id
    returning u.id, old.role
  `);
  const user = rows[0];
  if (!user) {
    // No email in the output: the operator already knows what they typed.
    console.error("No user with that email. They need to sign up first.");
    process.exit(1);
  }
  await db.execute(sql`delete from sessions where user_id = ${user.id}`);
  await writeAudit({
    actorId: null,
    actorRole: "cli",
    action: "user.role_changed",
    entityType: "user",
    entityId: user.id,
    meta: { from: user.role, to: role },
  });
  console.log(`Role changed from ${user.role} to ${role} for user ${user.id}. They must sign in again.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
