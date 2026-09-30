import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { centsToInput } from "@/modules/admin/rules";
import { OrderStatusBadge, Section, formatDateTime } from "@/components/admin/ui";
import { requireStaffPage } from "@/modules/admin/guard";
import { categoryOptions, getVoucher, productSlugsByIds } from "@/modules/vouchers/service";
import { describeVoucher, parseAppliesTo } from "@/modules/vouchers/rules";
import { categoryDisplayName } from "@/modules/catalog/category-names";
import { ActiveToggleForm, EditVoucherForm } from "../voucher-forms";

export const metadata = { title: "Edit voucher" };

/** ISO to the datetime-local value the form reads back as UTC. */
function toLocalInput(iso: string | null): string {
  return iso ? iso.slice(0, 16) : "";
}

export default async function EditVoucherPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  await requireStaffPage("vouchers.manage", `/admin/vouchers/${id}`);
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [voucher, categories, query] = await Promise.all([getVoucher(id), categoryOptions(), searchParams]);
  if (!voucher) notFound();
  const scope = parseAppliesTo(voucher.appliesToJson);
  const slugs = await productSlugsByIds(scope.productIds);

  return (
    <div>
      <Link href="/admin/vouchers" className="inline-flex min-h-11 items-center gap-1 text-sm text-brandLink underline-offset-4 hover:underline">
        <ArrowLeft aria-hidden="true" strokeWidth={1.75} className="h-4 w-4" />
        All vouchers
      </Link>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <h1 className="break-all font-mono text-2xl font-bold">{voucher.code}</h1>
        {voucher.isActive ? <Badge variant="success">Active</Badge> : <Badge>Inactive</Badge>}
      </div>
      {query.created ? (
        <p role="status" className="mb-4 rounded-badge bg-brandTint px-3 py-2 text-sm">
          Voucher created. {voucher.isActive ? "Shoppers can use it now." : "Activate it when you are ready."}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <EditVoucherForm
            voucher={{
              id: voucher.id,
              code: voucher.code,
              type: voucher.type,
              value: voucher.type === "percent" ? String(voucher.value) : voucher.type === "fixed_amount" ? centsToInput(voucher.value) : "",
              minSpend: voucher.minSpendCents > 0 ? centsToInput(voucher.minSpendCents) : "",
              perUserLimit: voucher.perUserLimit === null ? "" : String(voucher.perUserLimit),
              globalLimit: voucher.globalLimit === null ? "" : String(voucher.globalLimit),
              firstOrderOnly: voucher.firstOrderOnly,
              startsAt: toLocalInput(voucher.startsAt),
              endsAt: toLocalInput(voucher.endsAt),
              isActive: voucher.isActive,
              note: voucher.note ?? "",
              categoryIds: scope.categoryIds,
              productSlugs: slugs.join(", "),
              usedCount: voucher.usedCount,
            }}
            categories={categories.map((c) => ({ id: c.id, label: categoryDisplayName(c.slug) }))}
          />
        </div>
        <div className="space-y-4">
          <Section title="Status" id="voucher-status">
            <p className="mb-3 text-sm text-inkSoft">{describeVoucher(voucher)}</p>
            <ActiveToggleForm voucherId={voucher.id} isActive={voucher.isActive} />
          </Section>
          <Section title="Usage" id="voucher-usage">
            <p className="text-2xl font-semibold tabular-nums">
              {voucher.usedCount}
              {voucher.globalLimit ? <span className="text-base font-normal text-inkSoft"> of {voucher.globalLimit}</span> : null}
            </p>
            <p className="text-sm text-inkSoft">Orders using the code. A cancelled order gives its use back.</p>
            {voucher.recent.length > 0 ? (
              <ul className="mt-3 divide-y divide-line text-sm">
                {voucher.recent.map((r) => (
                  <li key={r.orderNumber} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link href={`/admin/orders/${r.orderNumber}`} className="font-medium text-brandLink underline-offset-4 hover:underline">
                      {r.orderNumber}
                    </Link>
                    <OrderStatusBadge status={r.orderStatus} />
                    <span className="w-full text-xs text-inkMuted">
                      {formatDateTime(r.at)} · {r.signedIn ? "signed in" : "guest"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-inkMuted">Not used yet.</p>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
