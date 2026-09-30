import type { MetadataRoute } from "next";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { absoluteUrl } from "@/lib/seo";
import { toIso, type DbTimestamp } from "@/lib/dates";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const categories = await db.execute<{ slug: string }>(sql`
    select slug from categories where parent_id is null
  `);
  const products = await db.execute<{ slug: string; created_at: DbTimestamp }>(sql`
    select slug, created_at from products where status = 'active' order by created_at desc
  `);

  return [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    ...["/privacy", "/cookies", "/terms", "/returns", "/contact", "/faq"].map((path) => ({
      url: absoluteUrl(path),
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
    ...categories.map((c) => ({
      url: absoluteUrl(`/c/${c.slug}`),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...products.map((p) => ({
      url: absoluteUrl(`/p/${p.slug}`),
      lastModified: toIso(p.created_at),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
