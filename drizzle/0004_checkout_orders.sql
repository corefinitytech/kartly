alter table "orders" add column "access_token_hash" text;--> statement-breakpoint
alter table "orders" add column "shipping_method_code" text;--> statement-breakpoint
alter table "orders" add column "source_cart_id" uuid;--> statement-breakpoint
alter table "orders" add column "contact_email_enc" text;--> statement-breakpoint
drop index if exists "payments_order_id_idx";--> statement-breakpoint
create index if not exists "payments_order_id_idx" on "payments" ("order_id");--> statement-breakpoint
create unique index if not exists "payments_stripe_payment_intent_unique" on "payments" ("stripe_payment_intent_id");
