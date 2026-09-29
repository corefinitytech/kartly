CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN IF EXISTS "search_vector";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce("title", '')), 'A')
  || setweight(to_tsvector('english', coalesce("brand", '')), 'B')
  || setweight(to_tsvector('english', coalesce("description", '')), 'C')
) STORED;--> statement-breakpoint
DROP INDEX IF EXISTS "products_search_vector_idx";--> statement-breakpoint
CREATE INDEX "products_search_vector_idx" ON "products" USING gin ("search_vector");--> statement-breakpoint
DROP INDEX IF EXISTS "products_title_trgm_idx";--> statement-breakpoint
CREATE INDEX "products_title_trgm_idx" ON "products" USING gist ("title" gist_trgm_ops);
