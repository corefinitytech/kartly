import { boolean, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";

export const shippingMethods = pgTable("shipping_methods", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  priceCents: integer("price_cents").notNull(),
  freeOverCents: integer("free_over_cents"),
  minDays: integer("min_days").notNull(),
  maxDays: integer("max_days").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  position: integer("position").notNull().default(0),
});

export const taxRates = pgTable("tax_rates", {
  countryCode: text("country_code").primaryKey(),
  rateBps: integer("rate_bps").notNull(),
  label: text("label").notNull(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull(),
});
