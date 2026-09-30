"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

type Phase = "waiting" | "paid" | "delayed" | "unknown";

export function SuccessView({ orderNumber }: { orderNumber: string }) {
  const [phase, setPhase] = useState<Phase>("waiting");

  useEffect(() => {
    if (!orderNumber) {
      setPhase("unknown");
      return;
    }
    // Read the guest token before the first poll (it used to arrive one render late and 404).
    const fragment = window.location.hash.replace("#", "");
    if (fragment) sessionStorage.setItem(`order-token-${orderNumber}`, fragment);
    const token = fragment || sessionStorage.getItem(`order-token-${orderNumber}`) || "";
    let cancelled = false;
    const started = Date.now();
    const poll = async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers["x-order-token"] = token;
        const response = await fetch(`/api/orders/${orderNumber}/status`, { headers });
        if (response.ok) {
          const body = (await response.json()) as { data?: { status: string } };
          if (body.data?.status === "paid") {
            if (!cancelled) setPhase("paid");
            return;
          }
        }
      } catch {
        // keep polling
      }
      if (Date.now() - started > 30_000) {
        if (!cancelled) setPhase("delayed");
        return;
      }
      if (!cancelled) setTimeout(poll, 2000);
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, [orderNumber]);

  if (!orderNumber || phase === "unknown") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Order not found</h1>
        <p className="mt-2 text-sm text-inkSoft">We could not find this order.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-brandLink underline underline-offset-4">
          Continue shopping
        </Link>
      </div>
    );
  }

  if (phase === "waiting") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <Clock strokeWidth={1.75} className="mx-auto h-8 w-8 animate-pulse text-inkMuted" />
        <h1 className="mt-3 text-2xl font-bold">Confirming your payment</h1>
        <p className="mt-2 text-sm text-inkSoft">This usually takes a few seconds. Order {orderNumber}.</p>
      </div>
    );
  }

  if (phase === "delayed") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <Clock strokeWidth={1.75} className="mx-auto h-8 w-8 text-inkMuted" />
        <h1 className="mt-3 text-2xl font-bold">Your payment is processing</h1>
        <p className="mt-2 text-sm text-inkSoft">
          We will email you when order {orderNumber} is confirmed. Nothing else is needed from you.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-brandLink underline underline-offset-4">
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <Check strokeWidth={1.75} className="mx-auto h-8 w-8 text-success" />
      <h1 className="mt-3 text-2xl font-bold">Order confirmed</h1>
      <p className="mt-2 text-sm text-inkSoft">
        Thank you. Your order number is <span className="font-medium text-ink">{orderNumber}</span>. A
        confirmation email is on its way.
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <Link
          href={`/orders/${orderNumber}`}
          className="inline-flex min-h-11 items-center justify-center rounded-btn bg-brand px-4 text-base font-medium text-white hover:bg-brandDeep"
        >
          View your order
        </Link>
        <Button variant="tertiary" onClick={() => (window.location.href = "/")}>
          Continue shopping
        </Button>
      </div>
      <p className="mt-6 text-sm text-inkSoft">
        Keep your order link handy, or{" "}
        <a href="/signup" className="text-brandLink underline underline-offset-4">
          create an account
        </a>{" "}
        to see your orders any time.
      </p>
    </div>
  );
}
