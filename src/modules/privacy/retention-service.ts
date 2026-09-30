// Retention job (PRD 9.5). Idempotent: every step deletes by a cutoff, so a
// re-run finds nothing new. Logs counts only, never data.
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { writeAudit } from "@/lib/audit";
import { retentionCutoffs } from "./rules";
import { executeDueDeletions } from "./dsar-service";

export interface RetentionCounts {
  sessions: number;
  verifications: number;
  carts: number;
  unverifiedAccounts: number;
  auditLog: number;
  dsarRecords: number;
  exportLinks: number;
  erasures: number;
  erasuresPostponed: number;
}

export async function runRetention(now: Date = new Date()): Promise<RetentionCounts> {
  const c = retentionCutoffs(now);
  const iso = now.toISOString();
  const count = async (q: ReturnType<typeof sql>) => (await db.execute(q)).length;

  const sessions = await count(sql`delete from sessions where expires_at < ${iso} returning id`);
  const verifications = await count(sql`delete from verifications where expires_at < ${iso} returning id`);
  // Guest carts and abandoned signed-in carts (FR-CART-07); items cascade.
  const carts = await count(sql`delete from carts where updated_at < ${c.carts.toISOString()} returning id`);
  // Unverified accounts older than 7 days that never ordered and are not staff.
  const unverifiedAccounts = await count(sql`
    delete from users u
    where u.email_verified = false and u.created_at < ${c.unverifiedAccounts.toISOString()}
      and u.role = 'customer'
      and not exists (select 1 from orders o where o.user_id = u.id)
    returning id
  `);
  // The append-only trigger allows deleting rows past 12 months only.
  const auditLog = await count(sql`delete from audit_log where created_at < ${c.auditLog.toISOString()} returning id`);
  const dsarRecords = await count(sql`delete from dsar_requests where created_at < ${c.dsarRecords.toISOString()} returning id`);
  const exportLinks = await count(sql`
    update dsar_requests set export_token_hash = null
    where export_token_hash is not null and export_expires_at < ${iso} returning id
  `);
  const { deleted: erasures, postponed: erasuresPostponed } = await executeDueDeletions(now);

  const counts = { sessions, verifications, carts, unverifiedAccounts, auditLog, dsarRecords, exportLinks, erasures, erasuresPostponed };
  logger.info(counts, "retention job");
  await writeAudit({ actorId: null, actorRole: "system", action: "privacy.retention_run", entityType: "system", entityId: "retention", meta: counts }).catch(() => undefined);
  return counts;
}
