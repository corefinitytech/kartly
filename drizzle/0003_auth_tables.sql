alter table "users" add column "name_set" text;--> statement-breakpoint
update "users" set "name_set" = coalesce("name", split_part("email", '@', 1));--> statement-breakpoint
alter table "users" alter column "name" set not null;--> statement-breakpoint
alter table "users" alter column "name" type text using coalesce("name", "name_set");--> statement-breakpoint
alter table "users" drop column "name_set";--> statement-breakpoint
alter table "users" add column "email_verified" boolean not null default false;--> statement-breakpoint
update "users" set "email_verified" = true where "email_verified_at" is not null;--> statement-breakpoint
alter table "users" drop column "email_verified_at";--> statement-breakpoint
alter table "users" drop column "password_hash";--> statement-breakpoint
alter table "users" add column "image" text;--> statement-breakpoint
alter table "users" add column "updated_at" timestamptz not null default now();--> statement-breakpoint
drop index if exists "sessions_token_hash_unique";--> statement-breakpoint
alter table "sessions" rename column "token_hash" to "token";--> statement-breakpoint
alter table "sessions" rename column "ip_hash" to "ip_address";--> statement-breakpoint
alter table "sessions" add column if not exists "user_agent" text;--> statement-breakpoint
alter table "sessions" add column "updated_at" timestamptz not null default now();--> statement-breakpoint
alter table "sessions" alter column "user_id" set not null;--> statement-breakpoint
create unique index if not exists "sessions_token_unique" on "sessions" ("token");--> statement-breakpoint
create index if not exists "sessions_user_id_idx" on "sessions" ("user_id");--> statement-breakpoint
drop index if exists "accounts_provider_unique";--> statement-breakpoint
alter table "accounts" rename column "provider" to "provider_id";--> statement-breakpoint
alter table "accounts" rename column "provider_account_id" to "account_id";--> statement-breakpoint
alter table "accounts" add column "access_token" text;--> statement-breakpoint
alter table "accounts" add column "refresh_token" text;--> statement-breakpoint
alter table "accounts" add column "id_token" text;--> statement-breakpoint
alter table "accounts" add column "access_token_expires_at" timestamptz;--> statement-breakpoint
alter table "accounts" add column "refresh_token_expires_at" timestamptz;--> statement-breakpoint
alter table "accounts" add column "scope" text;--> statement-breakpoint
alter table "accounts" add column "password" text;--> statement-breakpoint
alter table "accounts" add column "updated_at" timestamptz not null default now();--> statement-breakpoint
create unique index if not exists "accounts_provider_unique" on "accounts" ("provider_id","account_id");--> statement-breakpoint
create index if not exists "accounts_user_id_idx" on "accounts" ("user_id");--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamptz NOT NULL,
	"created_at" timestamptz NOT NULL DEFAULT now(),
	"updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
create index if not exists "verifications_identifier_idx" on "verifications" ("identifier");--> statement-breakpoint
alter table "addresses" add column "position" integer not null default 0;--> statement-breakpoint
drop index if exists "carts_user_id_idx";--> statement-breakpoint
create unique index if not exists "carts_user_id_unique" on "carts" ("user_id");--> statement-breakpoint
