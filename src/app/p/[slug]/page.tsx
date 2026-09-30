import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { ChevronRight, MessageSquareOff } from "lucide-react";
import { db } from "@/lib/db";
import { ProductGallery } from "@/components/product/gallery";
import { BuyBox } from "@/components/cart/buy-box";
import { RatingStars } from "@/components/rating-stars";
import { getProductDetail } from "@/modules/catalog/service";
import { categoryDisplayName } from "@/modules/catalog/category-names";
import { buildCanonical, truncateAtWord } from "@/lib/seo";
import { BreadcrumbJsonLd, ProductJsonLd } from "@/components/json-ld";

export const revalidate = 3600;
export const dynamicParams = true;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const rows = await db.execute<{ slug: string }>(sql`
    select slug from products where status = 'active' limit 200
  `);
  return rows.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  if (!product) return {};
  const canonical = buildCanonical(`/p/${slug}`);
  const title = product.brand ? `${product.title} by ${product.brand}` : product.title;
  const description = product.description
    ? truncateAtWord(product.description, 150)
    : "Available at Kartly with the full cost shown before checkout.";
  const price = product.defaultVariant ? (product.defaultVariant.priceCents / 100).toFixed(2) : undefined;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      images: product.images[0]
        ? [{ url: product.images[0].url, width: 720, height: 720, alt: product.title }]
        : undefined,
    },
    other: price
      ? {
          "product:price:amount": price,
          "product:price:currency": "USD",
        }
      : undefined,
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 pb-24 lg:px-6 lg:pb-6">
      <BreadcrumbJsonLd path={[{ slug: "", name: "Home" }, ...product.categoryPath.map((c) => ({ slug: c.slug, name: c.slug }))] } />
      <ProductJsonLd product={product} />
      <nav aria-label="Breadcrumb" className="text-sm text-inkSoft">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/" className="underline-offset-4 hover:underline">
              Home
            </Link>
          </li>
          {product.categoryPath.map((category, index) => (
            <li
              key={category.slug}
              aria-current={index === product.categoryPath.length - 1 ? "page" : undefined}
              className="flex items-center gap-1"
            >
              <ChevronRight strokeWidth={1.75} className="h-4 w-4 text-inkMuted" aria-hidden="true" />
              <Link href={`/c/${category.slug}`} className="underline-offset-4 hover:underline">
                {categoryDisplayName(category.slug)}
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-4 grid gap-8 lg:grid-cols-[2fr_1fr_1fr]">
        <ProductGallery images={product.images} title={product.title} />

        <div className="space-y-3">
          <h1 className="text-2xl font-bold lg:text-3xl">{product.title}</h1>
          {product.brand ? (
            <p className="text-sm text-inkSoft">
              Brand:{" "}
              <Link
                href={`/search?q=${encodeURIComponent(product.brand)}`}
                className="text-brandLink underline-offset-4 hover:underline"
              >
                {product.brand}
              </Link>
            </p>
          ) : null}
          <RatingStars rating={product.ratingAvg} />
          <p className="text-xs text-inkMuted">Sample rating</p>
          {product.description ? (
            <div className="pt-2 text-base text-inkSoft">
              <h2 className="mb-1 text-lg font-semibold text-ink">About this product</h2>
              <p>{product.description}</p>
            </div>
          ) : null}
        </div>

        <div className="lg:justify-self-end">
          <BuyBox product={product} imageForLine={product.images[0]?.url ?? null} />
        </div>
      </div>

      {product.specs.length > 0 ? (
        <section aria-labelledby="specs" className="mt-10 max-w-2xl">
          <h2 id="specs" className="text-xl font-semibold">
            Specifications
          </h2>
          <table className="mt-3 w-full border-collapse text-sm">
            <tbody>
              {product.specs.map((spec) => (
                <tr key={spec.label} className="border-b border-line">
                  <th scope="row" className="w-1/3 py-2 text-left font-medium text-inkSoft">
                    {spec.label}
                  </th>
                  <td className="py-2 text-ink">{spec.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <section aria-labelledby="reviews" className="mt-10">
        <h2 id="reviews" className="text-xl font-semibold">
          Reviews
        </h2>
        <div className="anim-fade-in mt-3 flex flex-col items-start gap-2 rounded-card border border-line bg-surface px-6 py-10 text-left">
          <MessageSquareOff strokeWidth={1.75} className="h-6 w-6 text-inkMuted" />
          <p className="text-lg font-semibold">No reviews yet</p>
          <p className="text-sm text-inkSoft">Reviews open once the first orders are delivered.</p>
        </div>
      </section>
    </div>
  );
}
