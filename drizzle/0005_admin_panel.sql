-- M5 minimal admin: shipments, refunds, ledger notes, admin order index,
-- and an append-only guard on audit_log. Hand written (--custom).
alter table "inventory_ledger" add column if not exists "note" text;--> statement-breakpoint
create index if not exists "orders_status_placed_at_idx" on "orders" ("status", "placed_at");--> statement-breakpoint
create table if not exists "shipments" (
  "id" uuid primary key default gen_random_uuid() not null,
  "order_id" uuid not null references "orders"("id") on delete cascade,
  "carrier" text not null,
  "tracking_number" text not null,
  "status" text default 'shipped' not null,
  "shipped_at" timestamp with time zone default now() not null,
  "delivered_at" timestamp with time zone
);--> statement-breakpoint
create unique index if not exists "shipments_order_id_unique" on "shipments" ("order_id");--> statement-breakpoint
create table if not exists "refunds" (
  "id" uuid primary key default gen_random_uuid() not null,
  "order_id" uuid not null references "orders"("id") on delete cascade,
  "payment_id" uuid,
  "amount_cents" integer not null check ("amount_cents" > 0),
  "reason" text,
  "stripe_refund_id" text,
  "status" text default 'pending' not null,
  "actor_id" uuid,
  "at" timestamp with time zone default now() not null
);--> statement-breakpoint
create index if not exists "refunds_order_id_idx" on "refunds" ("order_id");--> statement-breakpoint
create unique index if not exists "refunds_stripe_refund_id_unique" on "refunds" ("stripe_refund_id");--> statement-breakpoint
-- Product URLs must be unique now that admins can edit slugs (seed slugs are title-id, already unique).
create unique index if not exists "products_slug_unique" on "products" ("slug");--> statement-breakpoint
-- Stock can never go negative, whatever path writes it.
alter table "product_variants" drop constraint if exists "product_variants_stock_non_negative";--> statement-breakpoint
alter table "product_variants" add constraint "product_variants_stock_non_negative" check ("stock_qty" >= 0);--> statement-breakpoint
-- audit_log is append only: no updates ever, deletes only for rows past the
-- 12 month retention window (the M6 retention job).
create or replace function audit_log_append_only() returns trigger as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'audit_log is append only';
  end if;
  if tg_op = 'DELETE' and old.created_at > now() - interval '12 months' then
    raise exception 'audit_log rows are kept for 12 months';
  end if;
  return old;
end;
$$ language plpgsql;--> statement-breakpoint
drop trigger if exists audit_log_append_only on "audit_log";--> statement-breakpoint
create trigger audit_log_append_only before update or delete on "audit_log"
  for each row execute function audit_log_append_only();
