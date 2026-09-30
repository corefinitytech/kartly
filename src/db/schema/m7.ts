// M7: vouchers, reviews and in-app notifications (PRD Section 7).
// Created by the hand-written migration 0007 (--custom); keep both in step.
import { boolean, index, integer, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { products } from "./catalog";
import { users } from "./identity";
import { orders } from "./orders";

export const vouchers = pgTable(
  "vouchers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(), // stored upper case
    type: text("type").notNull(), // percent | fixed_amount | free_shipping
    value: integer("value").notNull().default(0), // percent 1-100, or cents
    minSpendCents: integer("min_spend_cents").notNull().default(0),
    appliesToJson: text("applies_to_json").notNull().default("{}"), // {"productIds":[],"categoryIds":[]}; empty = all
    firstOrderOnly: boolean("first_order_only").notNull().default(false),
    perUserLimit: integer("per_user_limit"),
    globalLimit: integer("global_limit"),
    usedCount: integer("used_count").notNull().default(0),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    isPublicCoupon: boolean("is_public_coupon").notNull().default(false),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("vouchers_code_unique").on(t.code)],
);

export const voucherRedemptions = pgTable(
  "voucher_redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    voucherId: uuid("voucher_id")
      .notNull()
      .references(() => vouchers.id, { onDelete: "restrict" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    // 1..per_user_limit for signed-in redemptions; the unique index makes a
    // second concurrent "first use" fail even if the limit check raced.
    userSeq: integer("user_seq"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("voucher_redemptions_order_unique").on(t.orderId),
    uniqueIndex("voucher_redemptions_user_seq_unique").on(t.voucherId, t.userId, t.userSeq),
    index("voucher_redemptions_voucher_user_idx").on(t.voucherId, t.userId),
  ],
);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    rating: smallint("rating").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull().default("visible"), // visible | hidden | pending
    helpfulCount: integer("helpful_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("reviews_product_user_unique").on(t.productId, t.userId),
    index("reviews_product_status_created_idx").on(t.productId, t.status, t.createdAt),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventKey: text("event_key").notNull(),
    payloadJson: text("payload_json").notNull().default("{}"), // ids and order numbers only, no PII
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_read_idx").on(t.userId, t.readAt), index("notifications_user_created_idx").on(t.userId, t.createdAt)],
);
