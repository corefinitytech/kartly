import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { orders } from "./orders";

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    status: text("status").notNull(),
    amountCents: integer("amount_cents").notNull(),
    methodBrand: text("method_brand"),
    methodLast4: text("method_last4"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payments_order_id_idx").on(t.orderId)],
);

export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    scope: text("scope").notNull(),
    requestHash: text("request_hash").notNull(),
    responseBody: text("response_body"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idempotency_keys_key_scope_idx").on(t.key, t.scope)],
);
