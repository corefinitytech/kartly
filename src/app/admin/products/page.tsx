import Image from "next/image";
import Link from "next/link";
import { ImageOff, PackagePlus, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/money";
import { AdminEmpty, FilterTabs, PageHeader, Pager, SearchForm } from "@/components/admin/ui";
import { requireStaffPage } from "@/modules/admin/guard";
import { ADMIN_PAGE_SIZE, listProducts } from "@/modules/admin/repo";
import { productListSchema } from "@/modules/admin/schemas";

export const metadata = { title: "Products" };

function priceRange(min: number | null, max: number | null): string {
  if (min === null) return "No price";
  return min === max || max === null ? formatCents(min) : `${formatCents(min)} – ${formatCents(max)}`;
}

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaffPage("products.manage", "/admin/products");
  const raw = await searchParams;
  const filters = productListSchema.parse(raw);
  const rows = await listProducts(filters);
  const total = Number(rows[0]?.total ?? 0);

  const href = (next: Partial<typeof filters>) => {
    const merged = { ...filters, ...next };
    const params = new URLSearchParams();
    if (merged.status !== "all") params.set("status", merged.status);
    if (merged.q) params.set("q", merged.q);
    if (merged.page > 1) params.set("page", String(merged.page));
    const qs = params.toString();
    return `/admin/products${qs ? `?${qs}` : ""}`;
  };

  return (
    <div>
      <PageHeader
        title="Products"
        description="Stock is changed in Inventory, so every change has a reason on record."
        actions={
          <Link href="/admin/products/new" className={buttonVariants({ variant: "secondary" })}>
            <Plus aria-hidden="true" strokeWidth={1.75} className="h-5 w-5" />
            New product
          </Link>
        }
      />
      {raw.deleted ? (
        <p role="status" className="mb-4 rounded-badge bg-brandTint px-3 py-2 text-sm">Product deleted.</p>
      ) : null}
      <FilterTabs
        label="Product status"
        items={(["all", "active", "draft"] as const).map((s) => ({
          href: href({ status: s, page: 1 }),
          label: s === "all" ? "All" : s === "active" ? "Live" : "Drafts",
          current: filters.status === s,
        }))}
      />
      <SearchForm
        action="/admin/products"
        name="q"
        defaultValue={filters.q}
        placeholder="Title, brand or SKU"
        label="Search products"
        hidden={filters.status !== "all" ? { status: filters.status } : {}}
      />

      {rows.length === 0 ? (
        <AdminEmpty
          icon={PackagePlus}
          title={filters.q ? "No matching products" : "No products yet"}
          description={filters.q ? "Try a different title, brand or SKU." : "Create a product, then add stock in Inventory."}
          action={
            <Link href="/admin/products/new" className={buttonVariants({ variant: "secondary" })}>
              New product
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {rows.map((p) => (
            <li key={p.id}>
              <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 p-3 hover:bg-canvas sm:p-4">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-badge bg-sunken">
                  {p.image_url ? (
                    <Image src={p.image_url} alt="" fill sizes="56px" className="object-contain p-1" />
                  ) : (
                    <ImageOff aria-hidden="true" strokeWidth={1.75} className="m-auto h-full w-5 text-inkMuted" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{p.title}</p>
                  <p className="truncate text-sm text-inkSoft">
                    {[p.brand, p.category_name].filter(Boolean).join(" · ") || "No category"} · {p.variant_count}{" "}
                    {p.variant_count === 1 ? "variant" : "variants"}
                  </p>
                </div>
                <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                  <span className="price text-sm">{priceRange(p.min_price, p.max_price)}</span>
                  <span className="text-sm tabular-nums text-inkSoft">{p.total_stock} in stock</span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {p.status === "active" ? <Badge variant="success">Live</Badge> : <Badge>Draft</Badge>}
                  {p.low_variants > 0 ? <Badge variant="lowStock">Low stock</Badge> : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pager page={filters.page} hasNext={filters.page * ADMIN_PAGE_SIZE < total} href={(page) => href({ page })} total={total} />
    </div>
  );
}
