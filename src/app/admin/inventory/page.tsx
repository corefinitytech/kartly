import { toIso } from "@/lib/dates";
import Link from "next/link";
import { Boxes } from "lucide-react";
import { AdminEmpty, FilterTabs, PageHeader, Pager, SearchForm, Section, StockBadge, formatDateTime } from "@/components/admin/ui";
import { requireStaffPage } from "@/modules/admin/guard";
import { ADMIN_PAGE_SIZE, countStockAlerts, listInventory, recentLedger } from "@/modules/admin/repo";
import { formatOptions, inventoryListSchema } from "@/modules/admin/schemas";
import { AdjustStockForm, ThresholdForm } from "./forms";

export const metadata = { title: "Inventory" };

const REASON_LABELS: Record<string, string> = { order: "Order", cancel: "Order cancelled", adjust: "Adjustment", return: "Return" };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaffPage("inventory.manage", "/admin/inventory");
  const filters = inventoryListSchema.parse(await searchParams);
  const [rows, alerts, ledger] = await Promise.all([listInventory(filters), countStockAlerts(), recentLedger(null, 15)]);
  const total = Number(rows[0]?.total ?? 0);

  const href = (next: Partial<typeof filters>) => {
    const merged = { ...filters, ...next };
    const params = new URLSearchParams();
    if (merged.stock !== "all") params.set("stock", merged.stock);
    if (merged.q) params.set("q", merged.q);
    if (merged.page > 1) params.set("page", String(merged.page));
    const qs = params.toString();
    return `/admin/inventory${qs ? `?${qs}` : ""}`;
  };

  return (
    <div>
      <PageHeader title="Inventory" description="Every change is saved to the stock ledger with who made it and why." />
      <FilterTabs
        label="Stock level"
        items={[
          { href: href({ stock: "all", page: 1 }), label: "All", current: filters.stock === "all" },
          { href: href({ stock: "low", page: 1 }), label: "Low stock", count: alerts.low, current: filters.stock === "low" },
          { href: href({ stock: "out", page: 1 }), label: "Out of stock", count: alerts.out, current: filters.stock === "out" },
        ]}
      />
      <SearchForm
        action="/admin/inventory"
        name="q"
        defaultValue={filters.q}
        placeholder="SKU or product title"
        label="Search inventory"
        hidden={filters.stock !== "all" ? { stock: filters.stock } : {}}
      />

      {rows.length === 0 ? (
        <AdminEmpty
          icon={Boxes}
          title={filters.stock === "all" && !filters.q ? "No variants yet" : "Nothing matches"}
          description={filters.stock === "low" ? "No variants are running low." : filters.stock === "out" ? "Everything is in stock." : "Try another SKU or title."}
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((v) => {
            const options = formatOptions(v.options_json);
            return (
              <li key={v.id} className="rounded-card border border-line bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/admin/products/${v.product_id}`} className="font-medium text-brandLink underline-offset-4 hover:underline">
                      {v.product_title}
                    </Link>
                    <p className="text-sm text-inkSoft">
                      SKU {v.sku}
                      {options ? ` · ${options}` : ""}
                      {v.product_status !== "active" ? " · Draft" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-inkSoft">In stock</span>
                    <StockBadge qty={v.stock_qty} threshold={v.low_stock_threshold} />
                  </div>
                </div>
                <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_220px]">
                  <AdjustStockForm variantId={v.id} current={v.stock_qty} />
                  <ThresholdForm variantId={v.id} threshold={v.low_stock_threshold} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Pager page={filters.page} hasNext={filters.page * ADMIN_PAGE_SIZE < total} href={(page) => href({ page })} total={total} />

      <Section title="Recent stock movements" id="ledger" className="mt-6">
        {ledger.length === 0 ? (
          <p className="text-sm text-inkSoft">No stock movements yet.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {ledger.map((l) => (
              <li key={l.id} className="grid gap-0.5 py-2 sm:grid-cols-[80px_1fr_auto] sm:gap-3">
                <span className={`tabular-nums font-medium ${l.delta > 0 ? "text-success" : "text-danger"}`}>
                  {l.delta > 0 ? `+${l.delta}` : l.delta}
                </span>
                <span className="min-w-0">
                  {l.product_title} <span className="text-inkMuted">({l.sku})</span>
                  <span className="block text-inkSoft">
                    {REASON_LABELS[l.reason] ?? l.reason}
                    {l.note ? ` — ${l.note}` : ""}
                    {l.actor_name ? ` · ${l.actor_name}` : ""}
                  </span>
                </span>
                <span className="text-inkSoft">{formatDateTime(toIso(l.at))}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
