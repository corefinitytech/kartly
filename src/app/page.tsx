import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { RatingStars } from "@/components/rating-stars";
import { getHomeData } from "@/modules/catalog/service";
import { categoryDisplayName } from "@/modules/catalog/category-names";
import { formatCents } from "@/lib/money";
import { buildCanonical } from "@/lib/seo";
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/json-ld";

export const revalidate = 3600;

export const metadata: Metadata = {
  alternates: { canonical: buildCanonical("/") },
};

function ProductRow({
  title,
  products,
  href,
}: {
  title: string;
  products: Awaited<ReturnType<typeof getHomeData>>["topRated"];
  href: string;
}) {
  const headingId = `row-${title.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <section aria-labelledby={headingId} className="mt-10">
      <div className="flex items-baseline justify-between">
        <h2 id={headingId} className="text-xl font-semibold">
          {title}
        </h2>
        <Link href={href} className="text-sm text-brandLink underline-offset-4 hover:underline">
          See all
        </Link>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {products.map((product, index) => (
          <li key={product.slug}>
            <Link
              href={`/p/${product.slug}`}
              className="group block rounded-card border border-line bg-surface transition-theme hover:border-lineStrong"
            >
              <div className="aspect-square rounded-t-card bg-sunken p-3">
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt=""
                    width={200}
                    height={200}
                    loading={index < 4 ? "eager" : "lazy"}
                    priority={index < 4}
                    sizes="(max-width: 640px) 50vw, 16vw"
                    className="anim-fade-in h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-inkMuted">No image</div>
                )}
              </div>
              <div className="space-y-1 p-3">
                <p className="line-clamp-2 min-h-[3em] text-sm font-medium">{product.title}</p>
                <RatingStars rating={product.ratingAvg} />
                <p className="price text-base">{formatCents(product.priceCents)}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function HomePage() {
  const { categories, topRated, newArrivals } = await getHomeData();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
      <OrganizationJsonLd />
      <WebSiteJsonLd />
      <section className="rounded-card border border-line bg-surface px-6 py-10">
        <h1 className="max-w-2xl text-3xl font-bold lg:text-4xl">Plain prices. No sponsored results.</h1>
        <p className="mt-3 max-w-xl text-base text-inkSoft">
          See your full cost, including shipping and tax, before you check out.
        </p>
      </section>

      <section aria-labelledby="categories" className="mt-10">
        <h2 id="categories" className="text-xl font-semibold">
          Categories
        </h2>
        <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
          {categories.map((category, index) => (
            <li key={category.slug}>
              <Link
                href={`/c/${category.slug}`}
                className="flex h-full flex-col rounded-card border border-line bg-surface transition-theme hover:border-lineStrong"
              >
                <div className="aspect-square rounded-t-card bg-sunken p-3">
                  {category.imageUrl ? (
                    <Image
                      src={category.imageUrl}
                      alt=""
                      width={200}
                      height={200}
                      loading={index < 4 ? "eager" : "lazy"}
                      priority={index < 4}
                      sizes="(max-width: 640px) 50vw, 12vw"
                      className="anim-fade-in h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-inkMuted">No image</div>
                  )}
                </div>
                <p className="line-clamp-2 min-h-[calc(3em+0.75rem)] p-3 text-sm font-semibold">
                  {categoryDisplayName(category.slug)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <ProductRow title="Top rated" products={topRated} href="/search?sort=rating" />
      <ProductRow title="New arrivals" products={newArrivals} href="/search?sort=newest" />
    </div>
  );
}
