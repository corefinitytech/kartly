import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const carts = pgTable(
  "carts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id"),
    guestTokenHash: text("guest_token_hash"),
    estimateCountry: text("estimate_country"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("carts_user_id_unique").on(t.userId),
    uniqueIndex("carts_guest_token_hash_unique").on(t.guestTokenHash),
  ],
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").notNull(),
    qty: integer("qty").notNull(),
    savedForLater: boolean("saved_for_later").notNull().default(false),
    addedPriceCents: integer("added_price_cents").notNull(),
  },
  (t) => [
    index("cart_items_cart_id_idx").on(t.cartId),
    uniqueIndex("cart_items_cart_variant_unique").on(t.cartId, t.variantId),
  ],
);

export const cartsRelations = relations(carts, ({ many }) => ({
  items: many(cartItems),
}));
