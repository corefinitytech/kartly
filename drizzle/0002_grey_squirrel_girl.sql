CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value_json" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"price_cents" integer NOT NULL,
	"free_over_cents" integer,
	"min_days" integer NOT NULL,
	"max_days" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "shipping_methods_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "tax_rates" (
	"country_code" text PRIMARY KEY NOT NULL,
	"rate_bps" integer NOT NULL,
	"label" text NOT NULL
);
--> statement-breakpoint
DROP INDEX "carts_guest_token_hash_idx";--> statement-breakpoint
ALTER TABLE "carts" ADD COLUMN "estimate_country" text;--> statement-breakpoint
CREATE UNIQUE INDEX "cart_items_cart_variant_unique" ON "cart_items" USING btree ("cart_id","variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "carts_guest_token_hash_unique" ON "carts" USING btree ("guest_token_hash");