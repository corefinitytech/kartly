-- M6 privacy centre: DSAR tracking and scheduled deletion. Hand written (--custom).
create table if not exists "dsar_requests" (
  "id" uuid primary key default gen_random_uuid() not null,
  "user_id" uuid references "users"("id") on delete set null,
  "type" text not null,
  "status" text default 'received' not null,
  "due_at" timestamp with time zone not null,
  "completed_at" timestamp with time zone,
  "notes" text,
  "export_token_hash" text,
  "export_expires_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null
);--> statement-breakpoint
create index if not exists "dsar_requests_user_id_idx" on "dsar_requests" ("user_id");--> statement-breakpoint
create index if not exists "dsar_requests_status_due_idx" on "dsar_requests" ("status", "due_at");--> statement-breakpoint
alter table "users" add column if not exists "deletion_scheduled_at" timestamp with time zone;
