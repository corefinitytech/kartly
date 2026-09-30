import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/admin/ui";
import { requireStaffPage } from "@/modules/admin/guard";
import { imageUploadsEnabled } from "@/modules/admin/products-service";
import { findProduct, listCategoryOptions, productImages, productVariants } from "@/modules/admin/repo";
import { centsToInput } from "@/modules/admin/rules";
import { formatOptions } from "@/modules/admin/schemas";
import {
  AddVariantForm,
  DeleteProductForm,
  ImagesManager,
  ProductDetailsForm,
  PublishForm,
  VariantForm,
} from "../product-forms";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  await requireStaffPage("products.manage", `/admin/products/${id}`);
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [product, variants, images, categories, query] = await Promise.all([
    findProduct(id),
    productVariants(id),
    productImages(id),
    listCategoryOptions(),
    searchParams,
  ]);
  if (!product) notFound();
  const anyOrdered = variants.some((v) => v.ordered);

  return (
    <div>
      <Link href="/admin/products" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-brandLink underline-offset-4 hover:underline">
        <ArrowLeft aria-hidden="true" strokeWidth={1.75} className="h-4 w-4" />
        All products
      </Link>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 text-2xl font-bold">{product.title}</h1>
        {product.status === "active" ? <Badge variant="success">Live</Badge> : <Badge>Draft</Badge>}
        {product.status === "active" ? (
          <Link href={`/p/${product.slug}`} className="inline-flex min-h-11 items-center gap-1 text-sm text-brandLink underline underline-offset-4" target="_blank">
            View in store
            <ExternalLink aria-hidden="true" strokeWidth={1.75} className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
      {query.created ? (
        <p role="status" className="mb-4 rounded-badge bg-brandTint px-3 py-2 text-sm">
          Product created as {product.status === "active" ? "live" : "a draft"}. Add images, then add stock in Inventory.
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-4">
          <Section title="Details" id="details">
            <ProductDetailsForm
              product={{
                id: product.id,
                title: product.title,
                slug: product.slug,
                brand: product.brand,
                description: product.description,
                categoryId: product.category_id,
                status: product.status,
              }}
              categories={categories}
            />
          </Section>

          <Section title={`Variants (${variants.length})`} id="variants">
            <div className="divide-y divide-line">
              {variants.map((v) => (
                <VariantForm
                  key={v.id}
                  onlyVariant={variants.length === 1}
                  variant={{
                    id: v.id,
                    sku: v.sku,
                    options: formatOptions(v.options_json),
                    price: centsToInput(v.price_cents),
                    compareAt: centsToInput(v.compare_at_cents),
                    lowStockThreshold: v.low_stock_threshold,
                    stockQty: v.stock_qty,
                    ordered: v.ordered,
                  }}
                />
              ))}
            </div>
            <details className="mt-4 rounded-card border border-line p-4">
              <summary className="min-h-11 cursor-pointer text-base font-medium text-brandLink">Add a variant</summary>
              <div className="mt-3">
                <AddVariantForm productId={product.id} />
              </div>
            </details>
          </Section>

          <Section title={`Images (${images.length})`} id="images">
            <ImagesManager productId={product.id} images={images.map((i) => ({ id: i.id, url: i.url, alt: i.alt }))} uploadsEnabled={imageUploadsEnabled()} />
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Visibility" id="visibility">
            <p className="mb-3 text-sm text-inkSoft">
              {product.status === "active" ? "Live: shoppers can find and buy it." : "Draft: hidden from shoppers and search."}
            </p>
            <PublishForm productId={product.id} status={product.status} />
          </Section>
          <Section title="Delete" id="delete">
            <DeleteProductForm productId={product.id} canDelete={!anyOrdered} />
          </Section>
        </div>
      </div>
    </div>
  );
}
