// Pure GDPR rules (PRD 9.3–9.5). Unit tested; services apply them.
import { RETENTION } from "@/lib/retention";

const DAY = 24 * 60 * 60 * 1000;

export const DSAR_TYPES = ["access", "export", "erasure", "rectification", "restriction", "objection"] as const;
export type DsarType = (typeof DSAR_TYPES)[number];
export const DSAR_STATUSES = ["received", "verifying", "in_progress", "completed", "rejected"] as const;
export type DsarStatus = (typeof DSAR_STATUSES)[number];

/** Statutory answer window (FR-GDPR-16): one month, tracked as 30 days. */
export const DSAR_SLA_DAYS = 30;
/** Cool off before an erasure runs (D-10, 9.4 step 2). */
export const DELETION_COOL_OFF_DAYS = 7;

/** 9.4 step 1: deletion waits while an order is still moving. */
export const DELETION_BLOCKING_STATUSES = ["pending_payment", "paid", "processing", "shipped"] as const;

export function deletionBlockedBy(orderStatuses: string[]): string[] {
  return orderStatuses.filter((s) => (DELETION_BLOCKING_STATUSES as readonly string[]).includes(s));
}

export function dsarDueAt(requestedAt: Date): Date {
  return new Date(requestedAt.getTime() + DSAR_SLA_DAYS * DAY);
}

export function deletionRunsAt(requestedAt: Date): Date {
  return new Date(requestedAt.getTime() + DELETION_COOL_OFF_DAYS * DAY);
}

/** Whole days left before the SLA is breached; negative once overdue. */
export function slaDaysLeft(dueAt: Date, now: Date = new Date()): number {
  return Math.ceil((dueAt.getTime() - now.getTime()) / DAY);
}

export function exportLinkExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + RETENTION.dsarExportFilesHours * 60 * 60 * 1000);
}

/** Cutoff instants for the retention job (9.5): anything older is removed. */
export function retentionCutoffs(now: Date) {
  const monthsAgo = (m: number) => {
    const d = new Date(now);
    d.setUTCMonth(d.getUTCMonth() - m);
    return d;
  };
  return {
    unverifiedAccounts: new Date(now.getTime() - RETENTION.unverifiedAccountsDays * DAY),
    carts: new Date(now.getTime() - RETENTION.guestAndAbandonedCartsDays * DAY),
    auditLog: monthsAgo(RETENTION.auditLogMonths),
    dsarRecords: monthsAgo(RETENTION.dsarRequestRecordsYears * 12),
  };
}

/**
 * What an order keeps after its customer is erased (9.4, D-11): amounts, tax,
 * dates, SKUs and status stay for 7 years; everything that identifies a person goes.
 */
export const ANONYMIZED_ORDER_FIELDS = {
  user_id: null,
  contact_email_enc: null,
  guest_email_enc: null,
  shipping_address_json_enc: null,
  billing_address_json_enc: null,
  access_token_hash: null,
} as const;
