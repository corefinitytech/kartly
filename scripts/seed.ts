import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, productImages, productVariants, products } from "@/db/schema/catalog";

/**
 * SEED RATINGS WARNING: the rating_avg / rating_count values written by this
 * script are SYNTHETIC SEED DATA, derived from the DummyJSON rating field.
 * They are not real customer reviews. When real reviews land (M7), seeded
 * aggregates must be recomputed from the reviews table.
 */

interface DummyJsonProduct {
  id: number;
  title: string;
  description: string;
  brand: string;
  category: string;
  price: number;
  rating: number;
  stock: number;
  images: string[];
}

interface DummyJsonResponse {
  products: DummyJsonProduct[];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  await db.execute(
    sql`truncate table product_images, product_variants, products, categories, inventory_ledger cascade`,
  );

  const limit = 200;
  const response = await fetch(`https://dummyjson.com/products?limit=${limit}&skip=0`);
  if (!response.ok) throw new Error(`DummyJSON request failed: ${response.status}`);
  const payload: DummyJsonResponse = await response.json();

  const categoryNames = [...new Set(payload.products.map((p) => p.category))];
  const categoryIds = new Map<string, string>();
  for (const name of categoryNames) {
    const [row] = await db
      .insert(categories)
      .values({ slug: slugify(name), name })
      .returning({ id: categories.id });
    categoryIds.set(name, row!.id);
  }

  for (const product of payload.products) {
    const [productRow] = await db
      .insert(products)
      .values({
        slug: slugify(`${product.title}-${product.id}`),
        title: product.title,
        brand: product.brand,
        description: product.description,
        categoryId: categoryIds.get(product.category) ?? null,
        status: "active",
        ratingAvg: product.rating,
        ratingCount: Math.round(product.rating * 10),
      })
      .returning({ id: products.id });
    const productId = productRow!.id;

    await db.insert(productVariants).values({
      productId,
      sku: `SEED-${product.id}`,
      optionsJson: JSON.stringify({ default: true }),
      priceCents: Math.round(product.price * 100),
      stockQty: product.stock,
    });

    const images = product.images.slice(0, 5);
    for (const [position, url] of images.entries()) {
      await db.insert(productImages).values({
        productId,
        url,
        alt: product.title,
        position,
      });
    }
  }

  console.log(
    `Seeded ${payload.products.length} products, ${categoryNames.length} categories. ` +
      "Rating aggregates are synthetic seed data, not real reviews.",
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
