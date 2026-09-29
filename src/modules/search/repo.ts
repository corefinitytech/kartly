import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export interface Suggestion {
  slug: string;
  title: string;
}

export async function suggestTitles(q: string, limit = 8): Promise<Suggestion[]> {
  const rows = await db.execute<{ slug: string; title: string }>(sql`
    select slug, title from products
    where status = 'active' and similarity(title, ${q}) > 0.3
    order by similarity(title, ${q}) desc
    limit ${limit}
  `);
  return rows.map((r) => ({ slug: r.slug, title: r.title }));
}
