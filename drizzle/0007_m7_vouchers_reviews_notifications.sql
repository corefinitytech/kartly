-- M7: vouchers, reviews, in-app notifications. Hand written (--custom), idempotent, additive only.
create table if not exists "vouchers" (
  "id" uuid primary key default gen_random_uuid() not null,
  "code" text not null,
  "type" text not null,
  "value" integer default 0 not null,
  "min_spend_cents" integer default 0 not null,
  "applies_to_json" text default '{}' not null,
  "first_order_only" boolean default false not null,
  "per_user_limit" integer,
  "global_limit" integer,
  "used_count" integer default 0 not null,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "is_active" boolean default true not null,
  "is_public_coupon" boolean default false not null,
  "note" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  constraint "vouchers_type_check" check ("type" in ('percent', 'fixed_amount', 'free_shipping')),
  constraint "vouchers_value_check" check ("value" >= 0 and ("type" <> 'percent' or "value" between 1 and 100)),
  constraint "vouchers_limits_check" check (("per_user_limit" is null or "per_user_limit" >= 1) and ("global_limit" is null or "global_limit" >= 1)),
  -- The global limit is enforced by the row itself: an increment past it fails.
  constraint "vouchers_used_count_check" check ("used_count" >= 0 and ("global_limit" is null or "used_count" <= "global_limit")),
  constraint "vouchers_window_check" check ("starts_at" is null or "ends_at" is null or "ends_at" > "starts_at")
);--> statement-breakpoint
create unique index if not exists "vouchers_code_unique" on "vouchers" ("code");--> statement-breakpoint

create table if not exists "voucher_redemptions" (
  "id" uuid primary key default gen_random_uuid() not null,
  "voucher_id" uuid not null references "vouchers"("id") on delete restrict,
  "user_id" uuid references "users"("id") on delete set null,
  "order_id" uuid not null references "orders"("id") on delete cascade,
  "user_seq" integer,
  "at" timestamp with time zone default now() not null
);--> statement-breakpoint
create unique index if not exists "voucher_redemptions_order_unique" on "voucher_redemptions" ("order_id");--> statement-breakpoint
create unique index if not exists "voucher_redemptions_user_seq_unique" on "voucher_redemptions" ("voucher_id", "user_id", "user_seq");--> statement-breakpoint
create index if not exists "voucher_redemptions_voucher_user_idx" on "voucher_redemptions" ("voucher_id", "user_id");--> statement-breakpoint

-- A cancelled (or expired) order gives its code back: delete the redemption and
-- decrement used_count in the same transaction as the status change, whichever
-- code path cancels it. Refunded orders keep their redemption.
create or replace function "release_voucher_on_cancel"() returns trigger language plpgsql as $$
declare
  released uuid;
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    delete from voucher_redemptions where order_id = new.id returning voucher_id into released;
    if released is not null then
      update vouchers set used_count = greatest(used_count - 1, 0), updated_at = now() where id = released;
    end if;
  end if;
  return new;
end;
$$;--> statement-breakpoint
drop trigger if exists "orders_release_voucher" on "orders";--> statement-breakpoint
create trigger "orders_release_voucher" after update of "status" on "orders"
  for each row execute function "release_voucher_on_cancel"();--> statement-breakpoint

create table if not exists "reviews" (
  "id" uuid primary key default gen_random_uuid() not null,
  "product_id" uuid not null references "products"("id") on delete cascade,
  "user_id" uuid not null references "users"("id") on delete cascade,
  "order_id" uuid references "orders"("id") on delete set null,
  "rating" smallint not null,
  "title" text not null,
  "body" text not null,
  "status" text default 'visible' not null,
  "helpful_count" integer default 0 not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  constraint "reviews_rating_check" check ("rating" between 1 and 5),
  constraint "reviews_status_check" check ("status" in ('visible', 'hidden', 'pending'))
);--> statement-breakpoint
create unique index if not exists "reviews_product_user_unique" on "reviews" ("product_id", "user_id");--> statement-breakpoint
create index if not exists "reviews_product_status_created_idx" on "reviews" ("product_id", "status", "created_at");--> statement-breakpoint

-- Rating aggregates follow the visible reviews in the same transaction as the
-- write (FR-REV-02), including cascades from account or product deletion.
-- Seed ratings are synthetic: the first real review replaces them.
create or replace function "refresh_product_rating"() returns trigger language plpgsql as $$
declare
  pid uuid;
begin
  for pid in
    select distinct x from unnest(array[
      case when tg_op in ('INSERT', 'UPDATE') then new.product_id end,
      case when tg_op in ('UPDATE', 'DELETE') then old.product_id end
    ]) as x where x is not null
  loop
    update products p set
      rating_avg = coalesce(s.avg_rating, 0),
      rating_count = s.n
    from (
      select round(avg(rating)::numeric, 2)::double precision as avg_rating, count(*)::int as n
      from reviews where product_id = pid and status = 'visible'
    ) s
    where p.id = pid;
  end loop;
  return null;
end;
$$;--> statement-breakpoint
drop trigger if exists "reviews_refresh_rating" on "reviews";--> statement-breakpoint
create trigger "reviews_refresh_rating" after insert or update of "rating", "status", "product_id" or delete on "reviews"
  for each row execute function "refresh_product_rating"();--> statement-breakpoint

create table if not exists "notifications" (
  "id" uuid primary key default gen_random_uuid() not null,
  "user_id" uuid not null references "users"("id") on delete cascade,
  "event_key" text not null,
  "payload_json" text default '{}' not null,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null
);--> statement-breakpoint
create index if not exists "notifications_user_read_idx" on "notifications" ("user_id", "read_at");--> statement-breakpoint
create index if not exists "notifications_user_created_idx" on "notifications" ("user_id", "created_at");
