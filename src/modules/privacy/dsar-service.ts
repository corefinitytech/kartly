// Data subject rights (PRD 9.3, 9.4, FR-ADM-12). Everything is scoped by the
// authenticated user's id; admin functions are called only behind the admin guard.
import { sql } from "drizzle-orm";
import { strToU8, zipSync } from "fflate";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { writeAudit } from "@/lib/audit";
import { decryptPii } from "@/lib/crypto";
import { sendMail } from "@/lib/mailer";
import { verifyPassword } from "@/lib/auth";
import { absoluteUrl } from "@/lib/seo";
import { toIso, toIsoOrNull, type DbTimestamp } from "@/lib/dates";
import { generateAccessToken, hashAccessToken, accessTokenMatches } from "@/modules/orders/access-token";
import { deletionDoneEmail, deletionScheduledEmail, exportReadyEmail } from "@/modules/auth/emails";
import {
  ANONYMIZED_ORDER_FIELDS,
  DSAR_STATUSES,
  deletionBlockedBy,
  deletionRunsAt,
  dsarDueAt,
  exportLinkExpiresAt,
  type DsarStatus,
} from "./rules";

export interface Requester {
  id: string;
  name: string;
  email: string;
  ip: string | null;
}

function safeDecrypt(value: string | null): string | null {
  if (!value) return null;
  try {
    return decryptPii(value);
  } catch {
    return null;
  }
}

/** Step-up auth (FR-AUTH-09): the current password, checked again before export or deletion. */
export async function verifyStepUp(userId: string, password: string): Promise<void> {
  const rows = await db.execute<{ password: string | null }>(sql`
    select password from accounts where user_id = ${userId} and provider_id = 'credential' limit 1
  `);
  const hash = rows[0]?.password;
  const ok = hash ? await verifyPassword({ password, hash }).catch(() => false) : false;
  if (!ok) throw new AppError("VALIDATION", "That password is not correct.");
}

// Overview ---------------------------------------------------------------------

export interface PrivacyOverview {
  counts: { addresses: number; orders: number; sessions: number; consents: number; cartItems: number };
  deletionScheduledAt: string | null;
  blockingOrders: string[];
  requests: { id: string; type: string; status: string; dueAt: string; completedAt: string | null; createdAt: string }[];
  activeExport: { token: null; expiresAt: string } | null;
}

export async function getPrivacyOverview(userId: string): Promise<PrivacyOverview> {
  const [counts, user, orders, requests] = await Promise.all([
    db.execute<{ addresses: number; orders: number; sessions: number; consents: number; cart_items: number }>(sql`
      select
        (select count(*) from addresses where user_id = ${userId})::int as addresses,
        (select count(*) from orders where user_id = ${userId})::int as orders,
        (select count(*) from sessions where user_id = ${userId})::int as sessions,
        (select count(*) from consents where user_id = ${userId})::int as consents,
        (select coalesce(sum(ci.qty), 0) from cart_items ci join carts c on c.id = ci.cart_id where c.user_id = ${userId})::int as cart_items
    `),
    db.execute<{ deletion_scheduled_at: DbTimestamp | null }>(sql`select deletion_scheduled_at from users where id = ${userId}`),
    db.execute<{ number: string; status: string }>(sql`select number, status from orders where user_id = ${userId}`),
    db.execute<{ id: string; type: string; status: string; due_at: DbTimestamp; completed_at: DbTimestamp | null; created_at: DbTimestamp; export_expires_at: DbTimestamp | null }>(sql`
      select id, type, status, due_at, completed_at, created_at, export_expires_at
      from dsar_requests where user_id = ${userId} order by created_at desc limit 20
    `),
  ]);
  const c = counts[0]!;
  const blocking = new Set(deletionBlockedBy(orders.map((o) => o.status)));
  const liveExport = requests.find((r) => r.type === "export" && r.export_expires_at && new Date(toIso(r.export_expires_at)) > new Date());
  return {
    counts: { addresses: c.addresses, orders: c.orders, sessions: c.sessions, consents: c.consents, cartItems: c.cart_items },
    deletionScheduledAt: toIsoOrNull(user[0]?.deletion_scheduled_at),
    blockingOrders: orders.filter((o) => blocking.has(o.status)).map((o) => o.number),
    requests: requests.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      dueAt: toIso(r.due_at),
      completedAt: toIsoOrNull(r.completed_at),
      createdAt: toIso(r.created_at),
    })),
    activeExport: liveExport?.export_expires_at ? { token: null, expiresAt: toIso(liveExport.export_expires_at) } : null,
  };
}

// Export (FR-GDPR-10, AC-8) ----------------------------------------------------

/**
 * Records the request, issues a single signed link valid for 24 hours (only
 * its hash is stored), and emails it. The ZIP is built at download time, so
 * no export file ever sits in storage.
 */
export async function requestExport(user: Requester): Promise<{ url: string; expiresAt: string }> {
  const token = generateAccessToken();
  const now = new Date();
  const expiresAt = exportLinkExpiresAt(now);
  const rows = await db.execute<{ id: string }>(sql`
    insert into dsar_requests (user_id, type, status, due_at, completed_at, export_token_hash, export_expires_at, notes)
    values (${user.id}, 'export', 'completed', ${dsarDueAt(now).toISOString()}, now(), ${hashAccessToken(token)},
      ${expiresAt.toISOString()}, 'Self-service export')
    returning id
  `);
  const url = absoluteUrl(`/api/privacy/export/${rows[0]!.id}.${token}`);
  await writeAudit({ actorId: user.id, actorRole: "customer", action: "privacy.export_requested", entityType: "dsar", entityId: rows[0]!.id, ip: user.ip }).catch(() => undefined);
  void sendMail({ to: user.email, ...exportReadyEmail(user.name, url) }).catch(() => undefined);
  return { url, expiresAt: expiresAt.toISOString() };
}

function csv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const cell = (v: unknown) => {
    const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => cell(r[h])).join(","))].join("\n");
}

/** Build the ZIP for a valid, unexpired link that belongs to the signed-in user. */
export async function buildExport(userId: string, requestId: string, token: string): Promise<{ filename: string; zip: Uint8Array }> {
  const reqRows = await db.execute<{ user_id: string | null; export_token_hash: string | null; export_expires_at: DbTimestamp | null }>(sql`
    select user_id, export_token_hash, export_expires_at from dsar_requests where id = ${requestId}::uuid and type = 'export' limit 1
  `);
  const req = reqRows[0];
  const valid =
    req &&
    req.user_id === userId &&
    accessTokenMatches(token, req.export_token_hash) &&
    req.export_expires_at &&
    new Date(toIso(req.export_expires_at)) > new Date();
  if (!valid) throw new AppError("NOT_FOUND", "This download link is not valid or has expired. Request a new one.");

  const [users, addresses, orders, items, events, consents, requests, sessions, cart] = await Promise.all([
    db.execute<Record<string, unknown> & { phone_enc: string | null }>(sql`
      select id, name, email, phone_enc, locale, role, email_verified, age_confirmed_at, created_at from users where id = ${userId}
    `),
    db.execute<{ label: string | null; name_enc: string | null; line1_enc: string; line2_enc: string | null; city: string; region: string | null; postal_code: string; country: string; phone_enc: string | null; is_default_shipping: boolean; is_default_billing: boolean }>(sql`
      select label, name_enc, line1_enc, line2_enc, city, region, postal_code, country, phone_enc, is_default_shipping, is_default_billing
      from addresses where user_id = ${userId}
    `),
    db.execute<{ id: string; number: string; status: string; placed_at: DbTimestamp; subtotal_cents: number; discount_cents: number; shipping_cents: number; tax_cents: number; total_cents: number; shipping_method_code: string | null; shipping_address_json_enc: string | null; contact_email_enc: string | null }>(sql`
      select id, number, status, placed_at, subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
        shipping_method_code, shipping_address_json_enc, contact_email_enc
      from orders where user_id = ${userId} order by placed_at desc
    `),
    db.execute<{ number: string; title_snapshot: string; qty: number; unit_price_cents: number }>(sql`
      select o.number, oi.title_snapshot, oi.qty, oi.unit_price_cents
      from order_items oi join orders o on o.id = oi.order_id where o.user_id = ${userId}
    `),
    db.execute<{ number: string; to_status: string; note: string | null; at: DbTimestamp }>(sql`
      select o.number, e.to_status, e.note, e.at from order_events e join orders o on o.id = e.order_id where o.user_id = ${userId} order by e.at
    `),
    db.execute<{ category: string; granted: boolean; policy_version: string; source: string; created_at: DbTimestamp }>(sql`
      select category, granted, policy_version, source, created_at from consents where user_id = ${userId} order by created_at
    `),
    db.execute<{ type: string; status: string; due_at: DbTimestamp; created_at: DbTimestamp; completed_at: DbTimestamp | null }>(sql`
      select type, status, due_at, created_at, completed_at from dsar_requests where user_id = ${userId} order by created_at
    `),
    db.execute<{ created_at: DbTimestamp; expires_at: DbTimestamp; user_agent: string | null }>(sql`
      select created_at, expires_at, user_agent from sessions where user_id = ${userId}
    `),
    db.execute<{ title: string; qty: number; added_price_cents: number }>(sql`
      select p.title, ci.qty, ci.added_price_cents from cart_items ci join carts c on c.id = ci.cart_id
      join product_variants v on v.id = ci.variant_id join products p on p.id = v.product_id where c.user_id = ${userId}
    `),
  ]);
  const u = users[0];
  if (!u) throw new AppError("NOT_FOUND", "Account not found.");
  const profile = { ...u, phone: safeDecrypt(u.phone_enc), phone_enc: undefined };
  const addressList = addresses.map((a) => ({
    label: a.label,
    name: safeDecrypt(a.name_enc),
    line1: safeDecrypt(a.line1_enc),
    line2: safeDecrypt(a.line2_enc),
    city: a.city,
    region: a.region,
    postal_code: a.postal_code,
    country: a.country,
    phone: safeDecrypt(a.phone_enc),
    default_shipping: a.is_default_shipping,
    default_billing: a.is_default_billing,
  }));
  const orderList = orders.map((o) => ({
    number: o.number,
    status: o.status,
    placed_at: toIso(o.placed_at),
    subtotal_cents: o.subtotal_cents,
    discount_cents: o.discount_cents,
    shipping_cents: o.shipping_cents,
    tax_cents: o.tax_cents,
    total_cents: o.total_cents,
    shipping_method: o.shipping_method_code,
    contact_email: safeDecrypt(o.contact_email_enc),
    shipping_address: (() => {
      const raw = safeDecrypt(o.shipping_address_json_enc);
      try {
        return raw ? (JSON.parse(raw) as unknown) : null;
      } catch {
        return null;
      }
    })(),
  }));
  const files: Record<string, Uint8Array> = {
    "README.txt": strToU8(
      [
        "Your Kartly data export.",
        `Created ${new Date().toISOString()} (UTC).`,
        "profile.json, addresses.json, orders.json (+ orders.csv, order_items.csv), order_events.json, consents.json, privacy_requests.json, sessions.json, cart.json.",
        "Money is in cents (USD). Not collected by Kartly, so not included: card numbers (held by Stripe), reviews, wishlist, notifications, referrals, search history, vouchers (features not built).",
      ].join("\n"),
    ),
    "profile.json": strToU8(JSON.stringify(profile, null, 2)),
    "addresses.json": strToU8(JSON.stringify(addressList, null, 2)),
    "orders.json": strToU8(JSON.stringify(orderList, null, 2)),
    "orders.csv": strToU8(csv(orderList.map((o) => ({ ...o, shipping_address: o.shipping_address ? JSON.stringify(o.shipping_address) : "" })))),
    "order_items.csv": strToU8(csv(items)),
    "order_events.json": strToU8(JSON.stringify(events.map((e) => ({ ...e, at: toIso(e.at) })), null, 2)),
    "consents.json": strToU8(JSON.stringify(consents.map((c) => ({ ...c, created_at: toIso(c.created_at) })), null, 2)),
    "privacy_requests.json": strToU8(
      JSON.stringify(requests.map((r) => ({ ...r, due_at: toIso(r.due_at), created_at: toIso(r.created_at), completed_at: toIsoOrNull(r.completed_at) })), null, 2),
    ),
    "sessions.json": strToU8(JSON.stringify(sessions.map((s) => ({ ...s, created_at: toIso(s.created_at), expires_at: toIso(s.expires_at) })), null, 2)),
    "cart.json": strToU8(JSON.stringify(cart, null, 2)),
  };
  await writeAudit({ actorId: userId, actorRole: "customer", action: "privacy.export_downloaded", entityType: "dsar", entityId: requestId }).catch(() => undefined);
  return { filename: `kartly-data-${new Date().toISOString().slice(0, 10)}.zip`, zip: zipSync(files) };
}

// Erasure (FR-GDPR-12, 9.4) ----------------------------------------------------

async function blockingOrders(userId: string): Promise<string[]> {
  const rows = await db.execute<{ number: string; status: string }>(sql`select number, status from orders where user_id = ${userId}`);
  const blocked = new Set(deletionBlockedBy(rows.map((r) => r.status)));
  return rows.filter((r) => blocked.has(r.status)).map((r) => r.number);
}

export async function requestDeletion(user: Requester): Promise<{ runsAt: string }> {
  const blocked = await blockingOrders(user.id);
  if (blocked.length > 0) {
    throw new AppError(
      "CONFLICT",
      `Some orders are still in progress (${blocked.join(", ")}). Wait until they are delivered, or cancel them, then try again.`,
    );
  }
  const now = new Date();
  const runsAt = deletionRunsAt(now);
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      update users set status = 'pending_deletion', deletion_scheduled_at = ${runsAt.toISOString()}, updated_at = now() where id = ${user.id}
    `);
    await tx.execute(sql`
      insert into dsar_requests (user_id, type, status, due_at, notes)
      values (${user.id}, 'erasure', 'in_progress', ${dsarDueAt(now).toISOString()}, ${`Scheduled for ${runsAt.toISOString().slice(0, 10)}`})
    `);
  });
  await writeAudit({ actorId: user.id, actorRole: "customer", action: "privacy.deletion_scheduled", entityType: "user", entityId: user.id, ip: user.ip }).catch(() => undefined);
  const runsOn = runsAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  void sendMail({ to: user.email, ...deletionScheduledEmail(user.name, runsOn, absoluteUrl("/account/privacy")) }).catch(() => undefined);
  return { runsAt: runsAt.toISOString() };
}

export async function cancelDeletion(user: Requester): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      update users set status = 'active', deletion_scheduled_at = null, updated_at = now()
      where id = ${user.id} and status = 'pending_deletion'
    `);
    await tx.execute(sql`
      update dsar_requests set status = 'rejected', completed_at = now(), notes = 'Withdrawn by the customer'
      where user_id = ${user.id} and type = 'erasure' and status in ('received', 'verifying', 'in_progress')
    `);
  });
  await writeAudit({ actorId: user.id, actorRole: "customer", action: "privacy.deletion_cancelled", entityType: "user", entityId: user.id, ip: user.ip }).catch(() => undefined);
}

/**
 * Run erasures whose cool off has passed (cron). Per user, in one transaction:
 * close the request, anonymize orders (amounts, tax, dates, SKUs stay), delete
 * carts, addresses, consents, sessions, credentials and the user row. Then a
 * final email to the old address (not stored anywhere afterwards).
 */
export async function executeDueDeletions(now: Date = new Date(), limit = 20): Promise<{ deleted: number; postponed: number }> {
  const due = await db.execute<{ id: string; email: string }>(sql`
    select id, email from users
    where status = 'pending_deletion' and deletion_scheduled_at is not null and deletion_scheduled_at <= ${now.toISOString()}
    order by deletion_scheduled_at asc limit ${limit}
  `);
  let deleted = 0;
  let postponed = 0;
  for (const user of due) {
    if ((await blockingOrders(user.id)).length > 0) {
      // An order started during the cool off: try again tomorrow rather than erase mid-delivery.
      await db.execute(sql`update users set deletion_scheduled_at = ${new Date(now.getTime() + 86_400_000).toISOString()} where id = ${user.id}`);
      postponed++;
      continue;
    }
    const a = ANONYMIZED_ORDER_FIELDS;
    await db.transaction(async (tx) => {
      await tx.execute(sql`
        update dsar_requests set status = 'completed', completed_at = now(), notes = 'Erased by the retention job'
        where user_id = ${user.id} and type = 'erasure' and status in ('received', 'verifying', 'in_progress')
      `);
      await tx.execute(sql`
        update orders set user_id = ${a.user_id}, contact_email_enc = ${a.contact_email_enc}, guest_email_enc = ${a.guest_email_enc},
          shipping_address_json_enc = ${a.shipping_address_json_enc}, billing_address_json_enc = ${a.billing_address_json_enc},
          access_token_hash = ${a.access_token_hash}, anonymized_at = now()
        where user_id = ${user.id}
      `);
      await tx.execute(sql`delete from carts where user_id = ${user.id}`);
      await tx.execute(sql`delete from addresses where user_id = ${user.id}`);
      await tx.execute(sql`delete from consents where user_id = ${user.id}`);
      await tx.execute(sql`delete from sessions where user_id = ${user.id}`);
      await tx.execute(sql`delete from accounts where user_id = ${user.id}`);
      await tx.execute(sql`delete from verifications where identifier = ${user.email} or identifier like ${`%${user.email}%`}`);
      await tx.execute(sql`delete from users where id = ${user.id}`);
    });
    await writeAudit({ actorId: null, actorRole: "system", action: "privacy.erasure_completed", entityType: "user", entityId: user.id }).catch(() => undefined);
    void sendMail({ to: user.email, ...deletionDoneEmail() }).catch(() => undefined);
    deleted++;
  }
  if (deleted || postponed) logger.info({ deleted, postponed }, "erasure job");
  return { deleted, postponed };
}

// Admin DSAR queue (FR-ADM-12) -------------------------------------------------

export interface AdminDsarRow {
  id: string;
  type: string;
  status: string;
  dueAt: string;
  createdAt: string;
  completedAt: string | null;
  notes: string | null;
  userId: string | null;
  requesterEmail: string | null;
}

export async function listDsarRequests(filter: { status: string }): Promise<AdminDsarRow[]> {
  const open = filter.status === "open";
  const rows = await db.execute<{ id: string; type: string; status: string; due_at: DbTimestamp; created_at: DbTimestamp; completed_at: DbTimestamp | null; notes: string | null; user_id: string | null; email: string | null }>(sql`
    select d.id, d.type, d.status, d.due_at, d.created_at, d.completed_at, d.notes, d.user_id, u.email
    from dsar_requests d left join users u on u.id = d.user_id
    where ${open ? sql`d.status in ('received', 'verifying', 'in_progress')` : sql`true`}
    order by ${open ? sql`d.due_at asc` : sql`d.created_at desc`}
    limit 100
  `);
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    status: r.status,
    dueAt: toIso(r.due_at),
    createdAt: toIso(r.created_at),
    completedAt: toIsoOrNull(r.completed_at),
    notes: r.notes,
    userId: r.user_id,
    requesterEmail: r.email,
  }));
}

export async function updateDsarRequest(
  staff: { id: string; role: string; ip: string | null },
  requestId: string,
  status: DsarStatus,
  notes: string,
): Promise<void> {
  if (!(DSAR_STATUSES as readonly string[]).includes(status)) throw new AppError("VALIDATION", "Unknown status.");
  const rows = await db.execute(sql`
    update dsar_requests set status = ${status}, notes = ${notes || null},
      completed_at = ${status === "completed" || status === "rejected" ? sql`now()` : sql`null`}
    where id = ${requestId}::uuid returning id
  `);
  if (rows.length === 0) throw new AppError("NOT_FOUND", "Request not found.");
  await writeAudit({ actorId: staff.id, actorRole: staff.role, action: "privacy.dsar_updated", entityType: "dsar", entityId: requestId, meta: { status }, ip: staff.ip }).catch(() => undefined);
}
