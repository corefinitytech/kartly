"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OrderDetail } from "@/modules/orders/service";
import { OrderDetailView } from "../[number]/view";

/** Guest order lookup (FR-ORD-02): order number + the email used at checkout. */
export function LookupForm() {
  const [number, setNumber] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [found, setFound] = useState<{ order: OrderDetail; email: string } | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/orders/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ number, email }),
      });
      const body = (await response.json()) as { data?: { order: OrderDetail }; error?: { code: string; message: string } };
      if (response.ok && body.data) {
        setFound({ order: body.data.order, email });
        return;
      }
      setError(
        body.error?.code === "NOT_FOUND"
          ? "We could not find an order with that number and email. Check both and try again."
          : (body.error?.message ?? "Something went wrong. Please try again."),
      );
    } catch {
      setError("Network problem. Please try again.");
    } finally {
      setPending(false);
    }
  };

  if (found) {
    return <OrderDetailView number={found.order.number} initialOrder={found.order} lookupEmail={found.email} />;
  }

  return (
    <div className="mx-auto w-full max-w-[420px] px-4 py-10">
      <div className="rounded-card border border-line bg-surface p-6">
        <h1 className="text-2xl font-bold">Find an order</h1>
        <p className="mt-1 text-sm text-inkSoft">For orders placed without an account. Signed in? See <Link href="/orders" className="text-brandLink underline underline-offset-4">your orders</Link>.</p>
        <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
          {error ? (
            <p role="alert" className="flex items-start gap-2 rounded-badge bg-dangerTint px-3 py-2 text-sm text-danger">
              <AlertCircle strokeWidth={1.75} className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          ) : null}
          <div>
            <label htmlFor="number" className="block text-sm text-inkSoft">Order number</label>
            <Input
              id="number"
              value={number}
              onChange={(e) => setNumber(e.target.value.toUpperCase())}
              placeholder="KT-20260930-ABCDE"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              required
              className="mt-1"
            />
            <p className="mt-1 text-sm text-inkMuted">It is in your confirmation email.</p>
          </div>
          <div>
            <label htmlFor="email" className="block text-sm text-inkSoft">Email used at checkout</label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required className="mt-1" />
          </div>
          <Button type="submit" variant="secondary" disabled={pending || !number || !email} className="w-full">
            {pending ? "Looking up" : "Find order"}
          </Button>
        </form>
      </div>
    </div>
  );
}
