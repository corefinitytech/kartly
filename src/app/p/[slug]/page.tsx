import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, MessageSquareOff } from "lucide-react";
import { ProductGallery } from "@/components/product/gallery";
import { BuyBox } from "@/components/product/buy-box";
import { RatingStars } from "@/components/rating-stars";
import { getProductDetail } from "@/modules/catalog/service";

export const revalidate = 120;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  return {
    title: product ? product.title : "Product",
    description: product?.description?.slice(0, 160) ?? undefined,
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 pb-24 lg:px-6 lg:pb-6">
      <nav aria-label="Breadcrumb" className="text-sm text-inkSoft">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/" className="underline-offset-4 hover:underline">
              Home
            </Link>
          </li>
          {product.categoryPath.map((category) => (
            <li key={category.slug} className="flex items-center gap-1">
              <ChevronRight strokeWidth={1.75} className="h-4 w-4 text-inkMuted" aria-hidden="true" />
              <Link href={`/c/${category.slug}`} className="underline-offset-4 hover:underline">
                {category.name}
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
              <Link href={`/search?q=${encodeURIComponent(product.brand)}`} className="text-brandLink underline-offset-4 hover:underline">
                {product.brand}
              </Link>
            </p>
          ) : null}
          <RatingStars rating={product.ratingAvg} count={product.ratingCount} />
          <p className="text-xs text-inkMuted">Sample rating from seed data, not customer reviews.</p>
          {product.description ? (
            <div className="pt-2 text-base text-inkSoft">
              <h2 className="mb-1 text-lg font-semibold text-ink">About this product</h2>
              <p>{product.description}</p>
            </div>
          ) : null}
        </div>

        <div className="lg:justify-self-end">
          <BuyBox product={product} />
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
        <div className="mt-3 flex flex-col items-start gap-2 rounded-card border border-line bg-surface px-6 py-10 text-left">
          <MessageSquareOff strokeWidth={1.75} className="h-6 w-6 text-inkMuted" />
          <p className="text-lg font-semibold">No reviews yet</p>
          <p className="text-sm text-inkSoft">Reviews open once the first orders are delivered.</p>
        </div>
      </section>
    </div>
  );
}
