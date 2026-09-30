"use client";

import { useEffect, useState } from "react";
import { PackageOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { OrderDetail } from "@/modules/orders/service";
import { formatCents } from "@/lib/money";

const EVENT_LABELS: Record<string, string> = {
  pending_payment: "Ordered",
  paid: "Paid",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  partially_refunded: "Partly refunded",
  refunded: "Refunded",
};

export function OrderDetailView({ number }: { number: string }) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    const fragment = window.location.hash.replace("#", "");
    const token = fragment || sessionStorage.getItem(`order-token-${number}`) || "";
    void (async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers["x-order-token"] = token;
        const response = await fetch(`/api/orders/${number}`, { headers });
        if (!response.ok) {
          setState("missing");
          return;
        }
        const body = (await response.json()) as { data?: { order: OrderDetail } };
        if (body.data?.order) {
          setOrder(body.data.order);
          setState("ready");
        } else {
          setState("missing");
        }
      } catch {
        setState("missing");
      }
    })();
  }, [number]);

  if (state === "loading") {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 lg:px-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full rounded-card" />
        <Skeleton className="h-32 w-full rounded-card" />
      </div>
    );
  }

  if (state === "missing" || !order) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <PackageOpen strokeWidth={1.75} className="mx-auto h-8 w-8 text-inkMuted" />
        <h1 className="mt-3 text-2xl font-bold">Order not found</h1>
        <p className="mt-2 text-sm text-inkSoft">
          This order does not exist, or this link does not belong to it.
        </p>
      </div>
    );
  }

  const address = order.shippingAddress as Record<string, string> | null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{order.number}</h1>
        <Badge variant={order.status === "paid" || order.status === "delivered" ? "success" : "default"}>
          {order.status.replace(/_/g, " ")}
        </Badge>
      </div>

      {order.shipment ? (
        <section aria-labelledby="tracking" className="mt-4 rounded-card border border-line bg-surface p-5">
          <h2 id="tracking" className="text-lg font-semibold">
            {order.shipment.deliveredAt ? "Delivered" : "On its way"}
          </h2>
          <p className="mt-2 text-sm text-inkSoft">
            {order.shipment.carrier} · tracking number{" "}
            <span className="break-all font-mono text-ink">{order.shipment.trackingNumber}</span>
          </p>
        </section>
      ) : null}

      <section aria-labelledby="timeline" className="mt-4 rounded-card border border-line bg-surface p-5">
        <h2 id="timeline" className="text-lg font-semibold">
          Timeline
        </h2>
        <ol className="mt-3 space-y-2">
          {order.events
            .filter((event) => event.toStatus !== event.fromStatus)
            .map((event, index) => (
              <li key={index} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">
                  {EVENT_LABELS[event.toStatus] ?? event.toStatus}
                  {event.note ? <span className="font-normal text-inkSoft"> — {event.note}</span> : null}
                </span>
                <span className="shrink-0 text-inkSoft">
                  {new Date(event.at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
        </ol>
      </section>

      <section aria-labelledby="items" className="mt-4 rounded-card border border-line bg-surface p-5">
        <h2 id="items" className="text-lg font-semibold">
          Items
        </h2>
        <ul className="mt-3 divide-y divide-line">
          {order.items.map((item, index) => (
            <li key={index} className="flex items-baseline justify-between gap-2 py-2 text-sm">
              <span>
                {item.title} × {item.quantity}
              </span>
              <span className="price">{formatCents(item.unitPriceCents * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-inkSoft">Subtotal</dt>
            <dd className="price">{formatCents(order.subtotalCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-inkSoft">Shipping ({order.shippingMethodCode ?? "standard"})</dt>
            <dd className="price">{formatCents(order.shippingCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-inkSoft">Tax</dt>
            <dd className="price">{formatCents(order.taxCents)}</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-1 text-base">
            <dt className="font-semibold">Total</dt>
            <dd className="price">{formatCents(order.totalCents)}</dd>
          </div>
          {order.refunds.map((refund, index) => (
            <div key={index} className="flex justify-between text-danger">
              <dt>
                {refund.status === "succeeded" ? "Refunded" : "Refund pending"}{" "}
                {new Date(refund.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </dt>
              <dd className="price">-{formatCents(refund.amountCents)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <section aria-labelledby="ship-to" className="rounded-card border border-line bg-surface p-5">
          <h2 id="ship-to" className="text-lg font-semibold">
            Shipping address
          </h2>
          {address ? (
            <p className="mt-2 text-sm text-inkSoft">
              {address.fullName}
              <br />
              {address.line1}
              {address.line2 ? <>, {address.line2}</> : null}
              <br />
              {address.city} {address.postalCode}
              <br />
              {address.country}
            </p>
          ) : null}
        </section>
        <section aria-labelledby="payment-info" className="rounded-card border border-line bg-surface p-5">
          <h2 id="payment-info" className="text-lg font-semibold">
            Payment
          </h2>
          <p className="mt-2 text-sm text-inkSoft">
            {order.payment?.brand
              ? `${order.payment.brand.toUpperCase()} ending in ${order.payment.last4}`
              : "Paid by card"}
          </p>
        </section>
      </div>
    </div>
  );
}
