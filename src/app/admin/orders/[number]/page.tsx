import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppError } from "@/lib/errors";
import { formatCents } from "@/lib/money";
import { OrderStatusBadge, Section, formatDateTime } from "@/components/admin/ui";
import { requireStaffPage } from "@/modules/admin/guard";
import { getOrder } from "@/modules/admin/orders-service";
import { STATUS_LABELS, isOrderStatus } from "@/modules/orders/state-machine";
import { OrderActions } from "./actions-panel";

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  return { title: number };
}

const ACTOR_LABELS: Record<string, string> = { customer: "Customer", system: "System", admin: "Admin", support: "Support" };

export default async function AdminOrderPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const staff = await requireStaffPage("orders.view", `/admin/orders/${number}`);
  if (!/^KT-\d{8}-[A-HJ-NP-Z2-9]{5}$/.test(number)) notFound();
  const order = await getOrder(staff, number).catch((error: unknown) => {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  });

  return (
    <div>
      <Link href="/admin/orders" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-brandLink underline-offset-4 hover:underline">
        <ArrowLeft aria-hidden="true" strokeWidth={1.75} className="h-4 w-4" />
        All orders
      </Link>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{order.number}</h1>
        <OrderStatusBadge status={order.status} />
        <span className="text-sm text-inkSoft">Placed {formatDateTime(order.placedAt)}</span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-4">
          <Section title="Items" id="items">
            <ul className="divide-y divide-line">
              {order.items.map((item) => (
                <li key={item.variantId} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    {item.productId ? (
                      <Link href={`/admin/products/${item.productId}`} className="text-brandLink underline-offset-4 hover:underline">
                        {item.title}
                      </Link>
                    ) : (
                      item.title
                    )}{" "}
                    × {item.quantity}
                    {item.sku ? <span className="block text-xs text-inkMuted">SKU {item.sku}</span> : null}
                  </span>
                  <span className="price shrink-0">{formatCents(item.unitPriceCents * item.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
              {[
                ["Subtotal", order.subtotalCents],
                ...(order.discountCents ? [["Discount", -order.discountCents] as const] : []),
                [`Shipping (${order.shippingMethodCode ?? "standard"})`, order.shippingCents],
                ["Tax", order.taxCents],
              ].map(([label, cents]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-inkSoft">{label}</dt>
                  <dd className="price">{formatCents(Number(cents))}</dd>
                </div>
              ))}
              <div className="flex justify-between border-t border-line pt-1 text-base">
                <dt className="font-semibold">Total</dt>
                <dd className="price">{formatCents(order.totalCents)}</dd>
              </div>
            </dl>
          </Section>

          <Section title="Timeline" id="timeline">
            <ol className="space-y-3">
              {order.events.map((e, i) => (
                <li key={i} className="grid gap-0.5 text-sm sm:grid-cols-[1fr_auto] sm:gap-3">
                  <span>
                    <span className="font-medium">
                      {e.fromStatus === e.toStatus
                        ? (e.note ?? "Update")
                        : isOrderStatus(e.toStatus)
                          ? STATUS_LABELS[e.toStatus]
                          : e.toStatus}
                    </span>
                    {e.fromStatus !== e.toStatus && e.note ? <span className="text-inkSoft"> — {e.note}</span> : null}
                    <span className="text-inkMuted"> · {ACTOR_LABELS[e.actor] ?? e.actor}</span>
                  </span>
                  <span className="text-inkSoft">{formatDateTime(e.at)}</span>
                </li>
              ))}
            </ol>
          </Section>

          {order.refunds.length > 0 ? (
            <Section title="Refunds" id="refunds">
              <ul className="divide-y divide-line text-sm">
                {order.refunds.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                    <span>
                      <span className="price">{formatCents(r.amountCents)}</span>
                      {r.reason ? <span className="text-inkSoft"> — {r.reason}</span> : null}
                    </span>
                    <span className={r.status === "failed" ? "text-danger" : "text-inkSoft"}>
                      {r.status === "succeeded" ? "Refunded" : r.status === "pending" ? "Pending" : r.status === "failed" ? "Failed" : r.status}
                      {" · "}
                      {formatDateTime(r.at)}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>

        <div className="space-y-4">
          <OrderActions
            orderId={order.id}
            status={order.status}
            next={order.actions.next}
            canCancel={order.actions.canCancel}
            canRefund={order.actions.canRefund}
            refundableCents={order.refundableCents}
          />

          <Section title="Customer" id="customer">
            <p className="text-sm">
              {order.customerEmail || "No email on file"}
              {order.isGuest ? <span className="text-inkMuted"> (guest checkout)</span> : null}
            </p>
            {order.shipTo ? (
              <address className="mt-3 text-sm not-italic text-inkSoft">
                {order.shipTo.name ? <span className="block text-ink">{order.shipTo.name}</span> : null}
                {order.shipTo.lines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
            ) : null}
            {staff.role === "support" ? (
              <p className="mt-3 text-xs text-inkMuted">Contact details are masked for support. Ask an admin if you need them.</p>
            ) : null}
          </Section>

          <Section title="Payment" id="payment">
            {order.payment ? (
              <p className="text-sm">
                <span className="price">{formatCents(order.payment.amountCents)}</span>{" "}
                <span className="text-inkSoft">
                  {order.payment.brand ? `· ${order.payment.brand.toUpperCase()} ending ${order.payment.last4}` : ""} · {order.payment.status}
                </span>
              </p>
            ) : (
              <p className="text-sm text-inkSoft">No card payment on this order.</p>
            )}
          </Section>

          {order.shipment ? (
            <Section title="Shipment" id="shipment">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-inkSoft">Carrier</dt>
                <dd>{order.shipment.carrier}</dd>
                <dt className="text-inkSoft">Tracking</dt>
                <dd className="break-all font-mono">{order.shipment.trackingNumber}</dd>
                <dt className="text-inkSoft">Shipped</dt>
                <dd>{formatDateTime(order.shipment.shippedAt)}</dd>
                {order.shipment.deliveredAt ? (
                  <>
                    <dt className="text-inkSoft">Delivered</dt>
                    <dd>{formatDateTime(order.shipment.deliveredAt)}</dd>
                  </>
                ) : null}
              </dl>
            </Section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
