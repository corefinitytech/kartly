import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: text("number").notNull(),
    userId: uuid("user_id"),
    guestEmailEnc: text("guest_email_enc"),
    status: text("status").notNull().default("pending_payment"),
    currency: text("currency").notNull().default("USD"),
    subtotalCents: integer("subtotal_cents").notNull(),
    discountCents: integer("discount_cents").notNull().default(0),
    shippingCents: integer("shipping_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    instrumentsCents: integer("instruments_cents").notNull().default(0),
    payableCents: integer("payable_cents").notNull(),
    pricingJson: text("pricing_json").notNull().default("{}"),
    shippingAddressJsonEnc: text("shipping_address_json_enc"),
    billingAddressJsonEnc: text("billing_address_json_enc"),
    voucherId: uuid("voucher_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    accessTokenHash: text("access_token_hash"),
    shippingMethodCode: text("shipping_method_code"),
    sourceCartId: uuid("source_cart_id"),
    contactEmailEnc: text("contact_email_enc"),
    placedAt: timestamp("placed_at", { withTimezone: true }).notNull().defaultNow(),
    anonymizedAt: timestamp("anonymized_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("orders_number_unique").on(t.number),
    uniqueIndex("orders_idempotency_key_unique").on(t.idempotencyKey),
    index("orders_user_id_placed_at_idx").on(t.userId, t.placedAt),
    index("orders_status_placed_at_idx").on(t.status, t.placedAt),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").notNull(),
    titleSnapshot: text("title_snapshot").notNull(),
    skuSnapshot: text("sku_snapshot").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    qty: integer("qty").notNull(),
    discountCents: integer("discount_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
  },
  (t) => [index("order_items_order_id_idx").on(t.orderId)],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    actor: text("actor").notNull(),
    note: text("note"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("order_events_order_id_idx").on(t.orderId)],
);

export const shipments = pgTable(
  "shipments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    carrier: text("carrier").notNull(),
    trackingNumber: text("tracking_number").notNull(),
    status: text("status").notNull().default("shipped"),
    shippedAt: timestamp("shipped_at", { withTimezone: true }).notNull().defaultNow(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("shipments_order_id_unique").on(t.orderId)],
);

export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    paymentId: uuid("payment_id"),
    amountCents: integer("amount_cents").notNull(),
    reason: text("reason"),
    stripeRefundId: text("stripe_refund_id"),
    status: text("status").notNull().default("pending"),
    actorId: uuid("actor_id"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("refunds_order_id_idx").on(t.orderId),
    uniqueIndex("refunds_stripe_refund_id_unique").on(t.stripeRefundId),
  ],
);

export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
  events: many(orderEvents),
}));
