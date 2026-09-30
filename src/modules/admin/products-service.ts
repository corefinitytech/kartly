import { revalidatePath, revalidateTag } from "next/cache";
import { sql } from "drizzle-orm";
import { del, put } from "@vercel/blob";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { writeAudit } from "@/lib/audit";
import type { Staff } from "./guard";
import { checkImageUpload, randomImageName } from "./images";
import * as repo from "./repo";
import type { ProductInput, VariantInput } from "./schemas";

/** Catalog pages are static; drop their cached data and pages after any edit. */
function invalidateCatalog(): void {
  revalidateTag("catalog");
  revalidatePath("/", "layout");
}

function audit(staff: Staff, action: string, entityType: string, entityId: string, meta?: Record<string, unknown>) {
  return writeAudit({ actorId: staff.id, actorRole: staff.role, action, entityType, entityId, meta, ip: staff.ip }).catch(
    () => logger.error({ action }, "audit write failed"),
  );
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  return error instanceof Error && error.message.includes(constraint);
}

async function assertSlugFree(slug: string, productId: string | null) {
  if (await repo.slugTaken(slug, productId)) {
    throw new AppError("CONFLICT", "Another product already uses that URL. Change the URL slug.");
  }
}

async function assertSkuFree(sku: string, variantId: string | null) {
  if (await repo.skuTaken(sku, variantId)) {
    throw new AppError("CONFLICT", `SKU ${sku} is already in use.`);
  }
}

async function requireProduct(productId: string) {
  const product = await repo.findProduct(productId);
  if (!product) throw new AppError("NOT_FOUND", "Product not found.");
  return product;
}

// Products -------------------------------------------------------------------

export async function createProduct(staff: Staff, product: ProductInput, variant: VariantInput): Promise<string> {
  await assertSlugFree(product.slug, null);
  await assertSkuFree(variant.sku, null);
  let productId: string;
  try {
    productId = await db.transaction(async (tx) => {
      const inserted = await tx.execute<{ id: string }>(sql`
        insert into products (slug, title, brand, description, category_id, status)
        values (${product.slug}, ${product.title}, ${product.brand}, ${product.description}, ${product.categoryId}, ${product.status})
        returning id
      `);
      const id = inserted[0]!.id;
      await tx.execute(sql`
        insert into product_variants (product_id, sku, options_json, price_cents, compare_at_cents, stock_qty, low_stock_threshold)
        values (${id}, ${variant.sku}, ${variant.optionsJson}, ${variant.priceCents}, ${variant.compareAtCents}, 0, ${variant.lowStockThreshold})
      `);
      return id;
    });
  } catch (error) {
    if (isUniqueViolation(error, "products_slug_unique")) throw new AppError("CONFLICT", "Another product already uses that URL.");
    if (isUniqueViolation(error, "product_variants_sku_unique")) throw new AppError("CONFLICT", `SKU ${variant.sku} is already in use.`);
    throw error;
  }
  await audit(staff, "product.created", "product", productId, { status: product.status });
  invalidateCatalog();
  return productId;
}

export async function updateProduct(staff: Staff, productId: string, input: ProductInput): Promise<void> {
  const before = await requireProduct(productId);
  await assertSlugFree(input.slug, productId);
  try {
    await db.execute(sql`
      update products set slug = ${input.slug}, title = ${input.title}, brand = ${input.brand},
        description = ${input.description}, category_id = ${input.categoryId}, status = ${input.status}
      where id = ${productId}
    `);
  } catch (error) {
    if (isUniqueViolation(error, "products_slug_unique")) throw new AppError("CONFLICT", "Another product already uses that URL.");
    throw error;
  }
  const changed = (Object.keys(input) as (keyof ProductInput)[]).filter((key) => {
    const column = { categoryId: "category_id" }[key as string] ?? key;
    return (before as Record<string, unknown>)[column] !== input[key];
  });
  await audit(staff, "product.updated", "product", productId, { fields: changed });
  invalidateCatalog();
}

export async function setProductStatus(staff: Staff, productId: string, status: "active" | "draft"): Promise<void> {
  await requireProduct(productId);
  if (status === "active") {
    const variants = await repo.productVariants(productId);
    if (variants.length === 0) throw new AppError("VALIDATION", "Add a variant with a price before publishing.");
  }
  await db.execute(sql`update products set status = ${status} where id = ${productId}`);
  await audit(staff, status === "active" ? "product.published" : "product.unpublished", "product", productId);
  invalidateCatalog();
}

export async function deleteProduct(staff: Staff, productId: string): Promise<void> {
  await requireProduct(productId);
  const [variants, images] = await Promise.all([repo.productVariants(productId), repo.productImages(productId)]);
  if (variants.some((v) => v.ordered)) {
    throw new AppError("CONFLICT", "This product has orders, so it cannot be deleted. Unpublish it instead.");
  }
  await db.transaction(async (tx) => {
    for (const v of variants) await tx.execute(sql`delete from cart_items where variant_id = ${v.id}`);
    await tx.execute(sql`delete from products where id = ${productId}`);
  });
  await deleteBlobs(images.map((i) => i.url));
  await audit(staff, "product.deleted", "product", productId);
  invalidateCatalog();
}

// Variants -------------------------------------------------------------------

export async function addVariant(staff: Staff, productId: string, input: VariantInput): Promise<void> {
  await requireProduct(productId);
  await assertSkuFree(input.sku, null);
  let variantId: string;
  try {
    const rows = await db.execute<{ id: string }>(sql`
      insert into product_variants (product_id, sku, options_json, price_cents, compare_at_cents, stock_qty, low_stock_threshold)
      values (${productId}, ${input.sku}, ${input.optionsJson}, ${input.priceCents}, ${input.compareAtCents}, 0, ${input.lowStockThreshold})
      returning id
    `);
    variantId = rows[0]!.id;
  } catch (error) {
    if (isUniqueViolation(error, "product_variants_sku_unique")) throw new AppError("CONFLICT", `SKU ${input.sku} is already in use.`);
    throw error;
  }
  await audit(staff, "variant.created", "variant", variantId, { productId, priceCents: input.priceCents });
  invalidateCatalog();
}

/** Stock is never written here; it only changes through inventory adjustments and orders. */
export async function updateVariant(staff: Staff, variantId: string, input: VariantInput): Promise<void> {
  await assertSkuFree(input.sku, variantId);
  const before = await db.execute<{ price_cents: number; product_id: string }>(sql`
    select price_cents, product_id from product_variants where id = ${variantId} limit 1
  `);
  if (!before[0]) throw new AppError("NOT_FOUND", "Variant not found.");
  try {
    await db.execute(sql`
      update product_variants set sku = ${input.sku}, options_json = ${input.optionsJson},
        price_cents = ${input.priceCents}, compare_at_cents = ${input.compareAtCents},
        low_stock_threshold = ${input.lowStockThreshold}
      where id = ${variantId}
    `);
  } catch (error) {
    if (isUniqueViolation(error, "product_variants_sku_unique")) throw new AppError("CONFLICT", `SKU ${input.sku} is already in use.`);
    throw error;
  }
  const priceChanged = before[0].price_cents !== input.priceCents;
  await audit(staff, "variant.updated", "variant", variantId, {
    productId: before[0].product_id,
    ...(priceChanged ? { priceFromCents: before[0].price_cents, priceToCents: input.priceCents } : {}),
  });
  invalidateCatalog();
}

export async function deleteVariant(staff: Staff, variantId: string): Promise<void> {
  const rows = await db.execute<{ product_id: string }>(sql`select product_id from product_variants where id = ${variantId} limit 1`);
  const productId = rows[0]?.product_id;
  if (!productId) throw new AppError("NOT_FOUND", "Variant not found.");
  const variants = await repo.productVariants(productId);
  const variant = variants.find((v) => v.id === variantId);
  if (variant?.ordered) throw new AppError("CONFLICT", "This variant has orders, so it cannot be deleted.");
  if (variants.length <= 1) throw new AppError("CONFLICT", "A product needs at least one variant.");
  await db.transaction(async (tx) => {
    await tx.execute(sql`delete from cart_items where variant_id = ${variantId}`);
    await tx.execute(sql`delete from product_variants where id = ${variantId}`);
  });
  await audit(staff, "variant.deleted", "variant", variantId, { productId });
  invalidateCatalog();
}

// Images ---------------------------------------------------------------------

export function imageUploadsEnabled(): boolean {
  return Boolean(env.BLOB_READ_WRITE_TOKEN);
}

export async function uploadImage(staff: Staff, productId: string, file: File): Promise<void> {
  if (!imageUploadsEnabled()) {
    throw new AppError("BAD_REQUEST", "Image uploads are not set up. Add BLOB_READ_WRITE_TOKEN to enable them.");
  }
  const product = await requireProduct(productId);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkImageUpload(bytes);
  if (!check.ok) throw new AppError("VALIDATION", check.message);

  const blob = await put(randomImageName(check.type), Buffer.from(bytes), {
    access: "public",
    contentType: check.type,
    addRandomSuffix: false,
    token: env.BLOB_READ_WRITE_TOKEN,
  }).catch(() => {
    throw new AppError("INTERNAL", "The image could not be stored. Please try again.");
  });

  const rows = await db.execute<{ id: string }>(sql`
    insert into product_images (product_id, url, alt, position)
    values (${productId}, ${blob.url}, ${product.title},
      (select coalesce(max(position) + 1, 0) from product_images where product_id = ${productId}))
    returning id
  `);
  await audit(staff, "product.image_added", "product", productId, { imageId: rows[0]!.id, bytes: bytes.length });
  invalidateCatalog();
}

async function requireImage(imageId: string) {
  const rows = await db.execute<{ id: string; product_id: string; url: string; position: number }>(sql`
    select id, product_id, url, position from product_images where id = ${imageId} limit 1
  `);
  if (!rows[0]) throw new AppError("NOT_FOUND", "Image not found.");
  return rows[0];
}

export async function updateImageAlt(staff: Staff, imageId: string, alt: string): Promise<void> {
  const image = await requireImage(imageId);
  await db.execute(sql`update product_images set alt = ${alt || null} where id = ${imageId}`);
  await audit(staff, "product.image_updated", "product", image.product_id, { imageId });
  invalidateCatalog();
}

/** Swap with the neighbour, then renumber 0..n so position 0 is always the cover. */
export async function moveImage(staff: Staff, imageId: string, direction: "up" | "down"): Promise<void> {
  const image = await requireImage(imageId);
  const images = await repo.productImages(image.product_id);
  const index = images.findIndex((i) => i.id === imageId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= images.length) return;
  const order = images.map((i) => i.id);
  [order[index], order[target]] = [order[target]!, order[index]!];
  await db.transaction(async (tx) => {
    for (const [position, id] of order.entries()) {
      await tx.execute(sql`update product_images set position = ${position} where id = ${id}`);
    }
  });
  await audit(staff, "product.image_reordered", "product", image.product_id, { imageId, direction });
  invalidateCatalog();
}

export async function deleteImage(staff: Staff, imageId: string): Promise<void> {
  const image = await requireImage(imageId);
  await db.transaction(async (tx) => {
    await tx.execute(sql`delete from product_images where id = ${imageId}`);
    const rest = await tx.execute<{ id: string }>(sql`
      select id from product_images where product_id = ${image.product_id} order by position asc, id asc
    `);
    for (const [position, row] of rest.entries()) {
      await tx.execute(sql`update product_images set position = ${position} where id = ${row.id}`);
    }
  });
  await deleteBlobs([image.url]);
  await audit(staff, "product.image_deleted", "product", image.product_id, { imageId });
  invalidateCatalog();
}

/** Only files we uploaded live in Blob; seed images are external and left alone. */
async function deleteBlobs(urls: string[]): Promise<void> {
  const ours = urls.filter((u) => /\.blob\.vercel-storage\.com\//.test(u));
  if (ours.length === 0 || !env.BLOB_READ_WRITE_TOKEN) return;
  await del(ours, { token: env.BLOB_READ_WRITE_TOKEN }).catch(() => logger.warn({ count: ours.length }, "blob delete failed"));
}
