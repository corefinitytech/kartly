import Link from "next/link";
import { ChevronRight, PackageSearch } from "lucide-react";
import { formatCents } from "@/lib/money";
import { AdminEmpty, FilterTabs, OrderStatusBadge, PageHeader, Pager, SearchForm, formatDateTime } from "@/components/admin/ui";
import { requireStaffPage } from "@/modules/admin/guard";
import { listOrders } from "@/modules/admin/orders-service";
import { ADMIN_PAGE_SIZE } from "@/modules/admin/repo";
import { orderListSchema } from "@/modules/admin/schemas";

export const metadata = { title: "Orders" };

const TABS = [
  { status: "all", label: "All" },
  { status: "paid", label: "To process" },
  { status: "processing", label: "Processing" },
  { status: "shipped", label: "Shipped" },
  { status: "delivered", label: "Delivered" },
  { status: "pending_payment", label: "Awaiting payment" },
  { status: "cancelled", label: "Cancelled" },
  { status: "partially_refunded", label: "Partially refunded" },
  { status: "refunded", label: "Refunded" },
] as const;

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const staff = await requireStaffPage("orders.view", "/admin/orders");
  const filters = orderListSchema.parse(await searchParams);
  const { items, total, byStatus } = await listOrders(staff, filters);
  const allCount = Object.values(byStatus).reduce((a, b) => a + b, 0);

  const href = (next: Partial<typeof filters>) => {
    const params = new URLSearchParams();
    const merged = { ...filters, ...next };
    if (merged.status !== "all") params.set("status", merged.status);
    if (merged.q) params.set("q", merged.q);
    if (merged.page > 1) params.set("page", String(merged.page));
    const qs = params.toString();
    return `/admin/orders${qs ? `?${qs}` : ""}`;
  };

  return (
    <div>
      <PageHeader title="Orders" description="Paid orders wait in To process. Each order moves one step at a time." />
      <FilterTabs
        label="Order status"
        items={TABS.map((t) => ({
          href: href({ status: t.status, page: 1 }),
          label: t.label,
          count: t.status === "all" ? allCount : (byStatus[t.status] ?? 0),
          current: filters.status === t.status,
        }))}
      />
      <SearchForm
        action="/admin/orders"
        name="q"
        defaultValue={filters.q}
        placeholder="Order number, e.g. KT-20260930"
        label="Search orders by number"
        hidden={filters.status !== "all" ? { status: filters.status } : {}}
      />

      {items.length === 0 ? (
        <AdminEmpty
          icon={PackageSearch}
          title={filters.q ? "No matching orders" : "No orders here"}
          description={filters.q ? "Check the order number, or clear the search." : "Orders in this status will appear here."}
          action={
            filters.q || filters.status !== "all" ? (
              <Link href="/admin/orders" className="text-brandLink underline underline-offset-4">
                Show all orders
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-card border border-line bg-surface md:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Orders, newest first</caption>
              <thead className="bg-sunken text-left text-inkSoft">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">Order</th>
                  <th scope="col" className="px-4 py-2 font-medium">Placed</th>
                  <th scope="col" className="px-4 py-2 font-medium">Customer</th>
                  <th scope="col" className="px-4 py-2 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Items</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((o) => (
                  <tr key={o.id} className="hover:bg-canvas">
                    <td className="px-4 py-3">
                      <Link href={`/admin/orders/${o.number}`} className="font-medium text-brandLink underline-offset-4 hover:underline">
                        {o.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-inkSoft">{formatDateTime(o.placedAt)}</td>
                    <td className="px-4 py-3">
                      {o.customer}
                      {o.isGuest ? <span className="ml-1 text-inkMuted">(guest)</span> : null}
                    </td>
                    <td className="px-4 py-3"><OrderStatusBadge status={o.status} /></td>
                    <td className="px-4 py-3 text-right tabular-nums">{o.itemCount}</td>
                    <td className="price px-4 py-3 text-right">{formatCents(o.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 md:hidden">
            {items.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.number}`} className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 hover:border-lineStrong">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{o.number}</span>
                      <OrderStatusBadge status={o.status} />
                    </div>
                    <p className="mt-1 truncate text-sm text-inkSoft">
                      {o.customer}
                      {o.isGuest ? " (guest)" : ""} · {o.itemCount} items
                    </p>
                    <p className="mt-0.5 text-sm text-inkMuted">{formatDateTime(o.placedAt)}</p>
                  </div>
                  <span className="price shrink-0">{formatCents(o.totalCents)}</span>
                  <ChevronRight aria-hidden="true" strokeWidth={1.75} className="h-5 w-5 shrink-0 text-inkMuted" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <Pager page={filters.page} hasNext={filters.page * ADMIN_PAGE_SIZE < total} href={(page) => href({ page })} total={total} />
    </div>
  );
}
