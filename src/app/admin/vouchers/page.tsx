import Link from "next/link";
import { Plus, TicketPercent } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/money";
import { AdminEmpty, FilterTabs, PageHeader, Pager, SearchForm, formatDateTime } from "@/components/admin/ui";
import { requireStaffPage } from "@/modules/admin/guard";
import { listVouchers } from "@/modules/vouchers/service";
import { VOUCHER_PAGE_SIZE } from "@/modules/vouchers/repo";
import { voucherListSchema } from "@/modules/vouchers/schemas";
import { describeVoucher } from "@/modules/vouchers/rules";

export const metadata = { title: "Vouchers" };

function windowLabel(startsAt: string | null, endsAt: string | null, now: number): string | null {
  if (startsAt && Date.parse(startsAt) > now) return `Starts ${formatDateTime(startsAt)}`;
  if (endsAt && Date.parse(endsAt) <= now) return "Expired";
  if (endsAt) return `Ends ${formatDateTime(endsAt)}`;
  return null;
}

export default async function AdminVouchersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaffPage("vouchers.manage", "/admin/vouchers");
  const filters = voucherListSchema.parse(await searchParams);
  const { items, total } = await listVouchers(filters);
  const now = Date.now();

  const href = (next: Partial<typeof filters>) => {
    const merged = { ...filters, ...next };
    const params = new URLSearchParams();
    if (merged.status !== "all") params.set("status", merged.status);
    if (merged.q) params.set("q", merged.q);
    if (merged.page > 1) params.set("page", String(merged.page));
    const qs = params.toString();
    return `/admin/vouchers${qs ? `?${qs}` : ""}`;
  };

  return (
    <div>
      <PageHeader
        title="Vouchers"
        description="Promo codes shoppers enter at checkout. One code per order."
        actions={
          <Link href="/admin/vouchers/new" className={buttonVariants({ variant: "secondary" })}>
            <Plus aria-hidden="true" strokeWidth={1.75} className="h-5 w-5" />
            New voucher
          </Link>
        }
      />
      <FilterTabs
        label="Voucher status"
        items={(["all", "active", "inactive"] as const).map((s) => ({
          href: href({ status: s, page: 1 }),
          label: s === "all" ? "All" : s === "active" ? "Active" : "Inactive",
          current: filters.status === s,
        }))}
      />
      <SearchForm
        action="/admin/vouchers"
        name="q"
        defaultValue={filters.q}
        placeholder="Code, e.g. WELCOME10"
        label="Search vouchers by code"
        hidden={filters.status !== "all" ? { status: filters.status } : {}}
      />

      {items.length === 0 ? (
        <AdminEmpty
          icon={TicketPercent}
          title={filters.q ? "No matching codes" : "No vouchers yet"}
          description={filters.q ? "Check the code, or clear the search." : "Create a code, then share it with shoppers."}
          action={
            <Link href="/admin/vouchers/new" className={buttonVariants({ variant: "secondary" })}>
              New voucher
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {items.map((v) => {
            const window = windowLabel(v.startsAt, v.endsAt, now);
            return (
              <li key={v.id}>
                <Link href={`/admin/vouchers/${v.id}`} className="flex items-center gap-3 p-3 hover:bg-canvas sm:p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono font-medium text-ink">{v.code}</p>
                    <p className="text-sm text-inkSoft">
                      {describeVoucher(v)}
                      {v.minSpendCents > 0 ? ` · min ${formatCents(v.minSpendCents)}` : ""}
                      {v.scoped ? " · selected items" : ""}
                      {v.perUserLimit ? ` · ${v.perUserLimit} per customer` : ""}
                    </p>
                    {window ? <p className="text-sm text-inkMuted">{window}</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {v.isActive ? <Badge variant="success">Active</Badge> : <Badge>Inactive</Badge>}
                    <span className="text-sm tabular-nums text-inkSoft">
                      {v.usedCount}
                      {v.globalLimit ? ` / ${v.globalLimit}` : ""} used
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Pager page={filters.page} hasNext={filters.page * VOUCHER_PAGE_SIZE < total} href={(page) => href({ page })} total={total} />
    </div>
  );
}
