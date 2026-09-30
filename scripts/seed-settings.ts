import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { shippingMethods, settings, taxRates } from "@/db/schema/settings";

const SHIPPING_ROWS = [
  {
    code: "standard",
    name: "Standard",
    priceCents: 499,
    freeOverCents: 5000,
    minDays: 3,
    maxDays: 5,
    isActive: true,
    position: 0,
  },
  {
    code: "express",
    name: "Express",
    priceCents: 1299,
    freeOverCents: null,
    minDays: 1,
    maxDays: 2,
    isActive: true,
    position: 1,
  },
];

const TAX_ROWS = [
  { countryCode: "US", rateBps: 700, label: "US sales tax (demo)" },
  { countryCode: "GB", rateBps: 2000, label: "UK VAT (demo)" },
  { countryCode: "DE", rateBps: 1900, label: "Germany VAT (demo)" },
  { countryCode: "PK", rateBps: 1800, label: "Pakistan GST (demo)" },
  { countryCode: "CA", rateBps: 500, label: "Canada GST (demo)" },
  { countryCode: "AE", rateBps: 500, label: "UAE VAT (demo)" },
];

const SETTINGS_ROWS = [
  { key: "default_estimate_country", valueJson: JSON.stringify("US") },
  { key: "max_line_quantity", valueJson: JSON.stringify(10) },
  { key: "low_stock_threshold", valueJson: JSON.stringify(5) },
];

async function main() {
  await db
    .insert(shippingMethods)
    .values(SHIPPING_ROWS)
    .onConflictDoUpdate({
      target: shippingMethods.code,
      set: {
        name: sql`excluded.name`,
        priceCents: sql`excluded.price_cents`,
        freeOverCents: sql`excluded.free_over_cents`,
        minDays: sql`excluded.min_days`,
        maxDays: sql`excluded.max_days`,
        isActive: sql`excluded.is_active`,
        position: sql`excluded.position`,
      },
    });

  await db
    .insert(taxRates)
    .values(TAX_ROWS)
    .onConflictDoUpdate({
      target: taxRates.countryCode,
      set: { rateBps: sql`excluded.rate_bps`, label: sql`excluded.label` },
    });

  await db
    .insert(settings)
    .values(SETTINGS_ROWS)
    .onConflictDoUpdate({
      target: settings.key,
      set: { valueJson: sql`excluded.value_json` },
    });

  console.log("Seeded shipping methods, tax rates and settings (demo data).");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
