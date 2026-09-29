import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { RatingStars } from "@/components/rating-stars";
import { getHomeData } from "@/modules/catalog/service";
import { formatCents } from "@/lib/money";

export const revalidate = 300;

function ProductRow({ title, products }: { title: string; products: Awaited<ReturnType<typeof getHomeData>>["topRated"] }) {
  return (
    <section aria-labelledby={`row-${title.replace(/\s+/g, "-")}`} className="mt-10">
      <div className="flex items-baseline justify-between">
        <h2 id={`row-${title.replace(/\s+/g, "-")}`} className="text-xl font-semibold">
          {title}
        </h2>
        <Link href="/search" className="text-sm text-brandLink underline-offset-4 hover:underline">
          See all
        </Link>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {products.map((product) => (
          <li key={product.slug}>
            <Link href={`/p/${product.slug}`} className="group block rounded-card border border-line bg-surface transition-colors duration-150 hover:border-lineStrong">
              <div className="aspect-square rounded-t-card bg-sunken p-3">
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.title}
                    width={200}
                    height={200}
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-inkMuted">No image</div>
                )}
              </div>
              <div className="space-y-1 p-3">
                <p className="line-clamp-2 text-sm font-medium">{product.title}</p>
                <RatingStars rating={product.ratingAvg} count={product.ratingCount} />
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
      <section className="rounded-card border border-line bg-surface px-6 py-10">
        <h1 className="max-w-2xl text-3xl font-bold lg:text-4xl">Plain prices. No sponsored results.</h1>
        <p className="mt-3 max-w-xl text-base text-inkSoft">
          See your full cost, including shipping and tax, before you check out.
        </p>
        <label htmlFor="home-search-hint" className="sr-only">
          Search
        </label>
        <p className="mt-4 text-sm text-inkMuted">
          <ArrowRight strokeWidth={1.75} className="mr-1 inline h-4 w-4" aria-hidden="true" />
          Start with the search bar above, or browse the categories below.
        </p>
      </section>

      <section aria-labelledby="categories" className="mt-10">
        <h2 id="categories" className="text-xl font-semibold">
          Categories
        </h2>
        <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
          {categories.map((category) => (
            <li key={category.slug}>
              <Link
                href={`/c/${category.slug}`}
                className="block rounded-card border border-line bg-surface transition-colors duration-150 hover:border-lineStrong"
              >
                <div className="aspect-square rounded-t-card bg-sunken p-3">
                  {category.imageUrl ? (
                    <Image
                      src={category.imageUrl}
                      alt=""
                      width={200}
                      height={200}
                      loading="lazy"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-inkMuted">No image</div>
                  )}
                </div>
                <p className="p-3 text-sm font-semibold">{category.name}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <ProductRow title="Top rated" products={topRated} />
      <ProductRow title="New arrivals" products={newArrivals} />
    </div>
  );
}
