import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { PackageOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/modules/auth/session";
import { listOrdersForUser } from "@/modules/orders/service";
import { formatCents } from "@/lib/money";

export const metadata: Metadata = {
  title: "Your orders",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const STATUS_VARIANTS: Record<string, "default" | "success" | "lowStock"> = {
  paid: "success",
  processing: "success",
  shipped: "success",
  delivered: "success",
  pending_payment: "lowStock",
  payment_failed: "lowStock",
  cancelled: "default",
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser();
  const { page } = await searchParams;
  const pageNumber = Number(page ?? "1") || 1;
  const { items, total } = await listOrdersForUser(user.id, pageNumber);
  const pageCount = Math.max(1, Math.ceil(total / 10));

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center lg:px-6">
        <PackageOpen strokeWidth={1.75} className="mx-auto h-8 w-8 text-inkMuted" />
        <h1 className="mt-3 text-2xl font-bold">No orders yet</h1>
        <p className="mt-2 text-sm text-inkSoft">When you place an order it will show up here.</p>
        <Link
          href="/"
          className="mt-4 inline-flex min-h-11 items-center rounded-btn bg-brand px-4 text-base font-medium text-white hover:bg-brandDeep"
        >
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
      <h1 className="text-2xl font-bold">Your orders</h1>
      <ul className="mt-4 space-y-4">
        {items.map((order) => (
          <li key={order.id} className="rounded-card border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Link href={`/orders/${order.number}`} className="font-medium underline-offset-4 hover:underline">
                  {order.number}
                </Link>
                <p className="text-sm text-inkSoft">
                  {new Date(order.placedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_VARIANTS[order.status] ?? "default"}>
                  {order.status.replace(/_/g, " ")}
                </Badge>
                <span className="price">{formatCents(order.totalCents)}</span>
              </div>
            </div>
            <ul className="mt-3 flex gap-2 overflow-x-auto">
              {order.items.map((item, index) => (
                <li
                  key={`${order.id}-${index}`}
                  className="h-14 w-14 shrink-0 rounded-btn bg-sunken p-1"
                >
                  {item.imageUrl ? (
                    <Image src={item.imageUrl} alt="" width={56} height={56} className="h-full w-full object-contain" />
                  ) : null}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {pageCount > 1 ? (
        <nav aria-label="Pagination" className="mt-6 flex justify-center gap-2 text-sm">
          {pageNumber > 1 ? (
            <Link href={`/orders?page=${pageNumber - 1}`} className="text-brandLink underline underline-offset-4">
              Previous
            </Link>
          ) : null}
          <span className="text-inkSoft">
            Page {pageNumber} of {pageCount}
          </span>
          {pageNumber < pageCount ? (
            <Link href={`/orders?page=${pageNumber + 1}`} className="text-brandLink underline underline-offset-4">
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
