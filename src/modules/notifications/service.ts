import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { toIso, toIsoOrNull, type DbTimestamp } from "@/lib/dates";
import {
  cleanPayload,
  parsePayload,
  renderNotification,
  type NotificationEvent,
  type NotificationPayload,
  type RenderedNotification,
} from "./events";

export const NOTIFICATION_PAGE_SIZE = 20;

/**
 * Record an in-app notification for a signed-in customer. Never throws: a
 * notification must not break the order flow that emits it.
 */
export async function notify(userId: string, eventKey: NotificationEvent, payload: NotificationPayload = {}): Promise<void> {
  try {
    await db.execute(sql`
      insert into notifications (user_id, event_key, payload_json)
      values (${userId}, ${eventKey}, ${JSON.stringify(cleanPayload(payload))})
    `);
  } catch (error) {
    logger.warn({ eventKey, error: error instanceof Error ? error.name : "unknown" }, "notification write failed");
  }
}

/**
 * Hook for order flows: looks up the owner and number in the same statement,
 * so callers pass only the order id. Guest orders have no inbox and are skipped.
 */
export async function notifyOrder(
  orderId: string,
  eventKey: NotificationEvent,
  extra: Omit<NotificationPayload, "orderNumber"> = {},
): Promise<void> {
  try {
    await db.execute(sql`
      insert into notifications (user_id, event_key, payload_json)
      select o.user_id, ${eventKey}, jsonb_build_object('orderNumber', o.number) || ${JSON.stringify(cleanPayload(extra))}::jsonb
      from orders o where o.id = ${orderId} and o.user_id is not null
    `);
  } catch (error) {
    logger.warn({ eventKey, error: error instanceof Error ? error.name : "unknown" }, "notification write failed");
  }
}

export interface NotificationItem extends RenderedNotification {
  id: string;
  eventKey: string;
  createdAt: string;
  readAt: string | null;
}

export async function listForUser(userId: string, page: number): Promise<{ items: NotificationItem[]; unread: number; hasMore: boolean }> {
  const rows = await db.execute<{
    id: string;
    event_key: string;
    payload_json: string;
    read_at: DbTimestamp | null;
    created_at: DbTimestamp;
    unread: number;
  }>(sql`
    select n.id, n.event_key, n.payload_json, n.read_at, n.created_at,
      (select count(*)::int from notifications u where u.user_id = ${userId} and u.read_at is null) as unread
    from notifications n
    where n.user_id = ${userId}
    order by n.created_at desc
    limit ${NOTIFICATION_PAGE_SIZE + 1} offset ${(page - 1) * NOTIFICATION_PAGE_SIZE}
  `);
  const unread = rows[0] ? Number(rows[0].unread) : page === 1 ? 0 : await unreadCount(userId);
  return {
    unread,
    hasMore: rows.length > NOTIFICATION_PAGE_SIZE,
    items: rows.slice(0, NOTIFICATION_PAGE_SIZE).map((r) => ({
      id: r.id,
      eventKey: r.event_key,
      createdAt: toIso(r.created_at),
      readAt: toIsoOrNull(r.read_at),
      ...renderNotification(r.event_key, parsePayload(r.payload_json)),
    })),
  };
}

export async function unreadCount(userId: string): Promise<number> {
  const rows = await db.execute<{ n: number }>(sql`
    select count(*)::int as n from notifications where user_id = ${userId} and read_at is null
  `);
  return Number(rows[0]?.n ?? 0);
}

/** Scoped by user: someone else's id simply matches nothing. Returns the new unread count. */
export async function markRead(userId: string, id: string): Promise<number> {
  const rows = await db.execute<{ n: number }>(sql`
    with upd as (
      update notifications set read_at = now()
      where id = ${id} and user_id = ${userId} and read_at is null
      returning id
    )
    select (count(*)::int - (select count(*)::int from upd)) as n
    from notifications where user_id = ${userId} and read_at is null
  `);
  return Math.max(0, Number(rows[0]?.n ?? 0));
}

export async function markAllRead(userId: string): Promise<void> {
  await db.execute(sql`update notifications set read_at = now() where user_id = ${userId} and read_at is null`);
}
