import { absoluteUrl, escapeJsonLd, toSchemaAvailability } from "@/lib/seo";
import type { ProductDetail } from "@/modules/catalog/types";
import { categoryDisplayName } from "@/modules/catalog/category-names";

function Script({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: escapeJsonLd(JSON.stringify(data)) }}
    />
  );
}

export function OrganizationJsonLd() {
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Kartly",
        url: absoluteUrl("/"),
        logo: absoluteUrl("/icon.svg"),
      }}
    />
  );
}

export function WebSiteJsonLd() {
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Kartly",
        url: absoluteUrl("/"),
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: absoluteUrl("/search?q={search_term_string}"),
          },
          "query-input": "required name=search_term_string",
        },
      }}
    />
  );
}

export function BreadcrumbJsonLd({ path }: { path: { slug: string; name: string }[] }) {
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: path.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.slug === "" ? item.name : categoryDisplayName(item.slug),
          item: absoluteUrl(item.slug === "" ? "/" : `/c/${item.slug}`),
        })),
      }}
    />
  );
}

export function ProductJsonLd({ product }: { product: ProductDetail }) {
  const variant = product.defaultVariant;
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.title,
        description: product.description ?? undefined,
        sku: variant?.sku,
        image: product.images[0]?.url,
        brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
        category: product.categoryPath.at(-1)
          ? categoryDisplayName(product.categoryPath.at(-1)!.slug)
          : undefined,
        offers: variant
          ? {
              "@type": "Offer",
              price: (variant.priceCents / 100).toFixed(2),
              priceCurrency: "USD",
              availability: toSchemaAvailability(variant.stockState.kind),
              url: absoluteUrl(`/p/${product.slug}`),
              itemCondition: "https://schema.org/NewCondition",
            }
          : undefined,
      }}
    />
  );
}
