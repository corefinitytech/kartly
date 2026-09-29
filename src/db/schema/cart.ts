import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const carts = pgTable(
  "carts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id"),
    guestTokenHash: text("guest_token_hash"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("carts_user_id_idx").on(t.userId), index("carts_guest_token_hash_idx").on(t.guestTokenHash)],
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
  (t) => [index("cart_items_cart_id_idx").on(t.cartId)],
);

export const cartsRelations = relations(carts, ({ many }) => ({
  items: many(cartItems),
}));
