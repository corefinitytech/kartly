import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { auditLog } from "@/db/schema/identity";
import { env } from "@/lib/env";

export interface AuditEntry {
  actorId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string;
  meta?: Record<string, unknown>;
  ip?: string | null;
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(`${env.IP_HASH_SALT}:${ip}`).digest("hex");
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    actorId: entry.actorId,
    actorRole: entry.actorRole,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    metaJson: JSON.stringify(entry.meta ?? {}),
    ipHash: entry.ip ? hashIp(entry.ip) : null,
  });
}
