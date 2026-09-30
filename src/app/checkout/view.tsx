"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/components/cart/cart-store";
import { COUNTRY_CODES, countryName } from "@/modules/addresses/schemas";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

const PaymentSection = dynamic(() => import("./payment-section").then((m) => m.PaymentSection), {
  ssr: false,
  loading: () => <Skeleton className="h-40 w-full rounded-btn" />,
});

interface AddressOption {
  id: string;
  fullName: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string;
  country: string;
  phone: string | null;
  isDefaultShipping: boolean;
}

interface QuoteData {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  payableCents: number;
  freeShippingRemainingCents: number;
  shippingMethodName: string;
  taxCountry: string;
}

interface ShippingMethodOption {
  code: string;
  name: string;
  priceCents: number;
  freeOverCents: number | null;
  minDays: number;
  maxDays: number;
}

interface FormState {
  contactEmail: string;
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone: string;
}

const emptyForm: FormState = {
  contactEmail: "",
  fullName: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "US",
  phone: "",
};

export function CheckoutView() {
  const { view, loaded } = useCart();
  const [addresses, setAddresses] = useState<AddressOption[] | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [methods, setMethods] = useState<ShippingMethodOption[]>([]);
  const [methodCode, setMethodCode] = useState("standard");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const idempotencyKey = useRef(crypto.randomUUID());

  useEffect(() => {
    if (loaded && (!view || view.lines.filter((l) => !l.unavailable).length === 0)) {
      window.location.href = "/cart";
    }
  }, [loaded, view]);

  useEffect(() => {
    void (async () => {
      const [addressesResponse, methodsResponse] = await Promise.all([
        fetch("/api/account/addresses").catch(() => null),
        fetch("/api/cart").then((r) => r.json()).catch(() => null),
      ]);
      if (addressesResponse?.ok) {
        const body = (await addressesResponse.json()) as { data?: { addresses: AddressOption[] } };
        const list = body.data?.addresses ?? [];
        setAddresses(list);
        const preferred = list.find((a) => a.isDefaultShipping) ?? list[0];
        if (preferred) {
          setSelectedAddressId(preferred.id);
          setForm((f) => ({ ...f, ...addressToForm(preferred) }));
        }
      } else {
        setAddresses([]);
      }
      void methodsResponse;
      const cart = view;
      if (cart) {
        setForm((f) => ({ ...f, country: cart.summary.estimateCountry }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const load = async () => {
      const response = await fetch("/api/checkout/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ country: form.country, shippingMethodCode: methodCode }),
      });
      if (!response.ok) return;
      const body = (await response.json()) as { data?: { quote: QuoteData | null; methods?: ShippingMethodOption[] } };
      setQuote(body.data?.quote ?? null);
      if (body.data?.methods && body.data.methods.length > 0) {
        setMethods(body.data.methods);
      }
    };
    void load();
  }, [form.country, methodCode]);

  const available = useMemo(() => view?.lines.filter((l) => !l.unavailable) ?? [], [view]);

  const setField = (key: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const validate = (): string | null => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.contactEmail)) return "Enter a valid email address.";
    if (!form.fullName.trim()) return "Enter the full name for delivery.";
    if (!form.line1.trim()) return "Enter the street address.";
    if (!form.city.trim()) return "Enter the city.";
    if (!form.postalCode.trim()) return "Enter the postal code.";
    return null;
  };

  const onPlace = async () => {
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }
    setError("");
    setPlacing(true);
    try {
      const response = await fetch("/api/checkout/place", {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": idempotencyKey.current },
        body: JSON.stringify({
          contactEmail: form.contactEmail,
          address: {
            fullName: form.fullName,
            line1: form.line1,
            line2: form.line2,
            city: form.city,
            region: form.region,
            postalCode: form.postalCode,
            country: form.country,
            phone: form.phone,
          },
          shippingMethodCode: methodCode,
        }),
      });
      const body = (await response.json()) as {
        data?: { clientSecret: string | null; orderNumber: string; status: string; accessToken: string | null };
        error?: { message: string };
      };
      if (!response.ok || !body.data) {
        setError(body.error?.message ?? "Could not start checkout. Please try again.");
        if (body.error?.message?.includes("sold out") || body.error?.message?.includes("no longer available")) {
          setTimeout(() => {
            window.location.href = "/cart";
          }, 2500);
        }
        return;
      }
      if (body.data.accessToken) {
        sessionStorage.setItem(`order-token-${body.data.orderNumber}`, body.data.accessToken);
      }
      setOrderNumber(body.data.orderNumber);
      if (body.data.status === "paid" || !body.data.clientSecret) {
        window.location.href = `/checkout/success?order=${body.data.orderNumber}`;
        return;
      }
      setClientSecret(body.data.clientSecret);
    } catch {
      setError("Network problem. Please try again.");
    } finally {
      setPlacing(false);
    }
  };

  if (!loaded || !view) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-6 lg:px-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          <Skeleton className="h-96 w-full rounded-card" />
          <Skeleton className="h-64 w-full rounded-card" />
        </div>
      </div>
    );
  }

  const summaryCard = (
    <div className="rounded-card border border-line bg-surface p-5">
      <h2 className="text-lg font-semibold">Order summary</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {available.map((line) => (
          <li key={line.variantId} className="flex justify-between gap-2">
            <span className="line-clamp-1 text-inkSoft">
              {line.title} × {line.quantity}
            </span>
            <span className="price">{formatCents(line.unitPriceCents * line.quantity)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-4 space-y-2 border-t border-line pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-inkSoft">Subtotal</dt>
          <dd className="price">{formatCents(quote?.subtotalCents ?? 0)}</dd>
        </div>
        {quote && quote.discountCents > 0 ? (
          <div className="flex justify-between text-danger">
            <dt>Discount</dt>
            <dd className="price">−{formatCents(quote.discountCents)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between">
          <dt className="text-inkSoft">Shipping ({quote?.shippingMethodName ?? methodCode})</dt>
          <dd className="price">
            {quote ? (quote.shippingCents === 0 ? "Free" : formatCents(quote.shippingCents)) : "—"}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-inkSoft">Tax ({quote?.taxCountry ?? form.country}, demo rate)</dt>
          <dd className="price">{formatCents(quote?.taxCents ?? 0)}</dd>
        </div>
        <div className="flex justify-between border-t border-line pt-2 text-base">
          <dt className="font-semibold">Total</dt>
          <dd className="price text-lg">{formatCents(quote?.totalCents ?? 0)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-sm text-inkMuted">Tax rates are demo values.</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Checkout</h1>
        <a href="/cart" className="text-sm text-brandLink underline underline-offset-4">
          Back to cart
        </a>
      </div>

      <div className="mt-4 rounded-card border border-line lg:hidden">
        <button
          type="button"
          onClick={() => setSummaryOpen((v) => !v)}
          aria-expanded={summaryOpen}
          className="flex min-h-11 w-full items-center justify-between px-4 text-base font-medium"
        >
          Order summary ({available.length} {available.length === 1 ? "item" : "items"})
          <span className="price">{formatCents(quote?.totalCents ?? 0)}</span>
        </button>
        {summaryOpen ? <div className="anim-fade-in border-t border-line">{summaryCard}</div> : null}
      </div>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section aria-labelledby="contact" className="rounded-card border border-line bg-surface p-5">
            <h2 id="contact" className="text-lg font-semibold">
              Contact
            </h2>
            <p className="mt-1 text-sm text-inkSoft">You can check out without an account.</p>
            <div className="mt-3">
              <label htmlFor="contactEmail" className="block text-sm text-inkSoft">
                Email
              </label>
              <Input
                id="contactEmail"
                type="email"
                autoComplete="email"
                value={form.contactEmail}
                onChange={(e) => setField("contactEmail", e.target.value)}
                className="mt-1"
                required
              />
            </div>
          </section>

          <section aria-labelledby="address" className="rounded-card border border-line bg-surface p-5">
            <h2 id="address" className="text-lg font-semibold">
              Shipping address
            </h2>
            {addresses && addresses.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {addresses.map((address) => (
                  <li key={address.id}>
                    <label
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center gap-2 rounded-btn border p-3 text-sm transition-theme",
                        selectedAddressId === address.id ? "border-brand bg-brandTint" : "border-line",
                      )}
                    >
                      <input
                        type="radio"
                        name="savedAddress"
                        className="h-4 w-4 accent-[#0F4C4A]"
                        checked={selectedAddressId === address.id}
                        onChange={() => {
                          setSelectedAddressId(address.id);
                          setForm((f) => ({ ...f, ...addressToForm(address) }));
                        }}
                      />
                      <span>
                        {address.fullName}, {address.line1}, {address.city} {address.postalCode},{" "}
                        {countryName(address.country)}
                      </span>
                    </label>
                  </li>
                ))}
                <li>
                  <label
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-2 rounded-btn border p-3 text-sm transition-theme",
                      selectedAddressId === "" ? "border-brand bg-brandTint" : "border-line",
                    )}
                  >
                    <input
                      type="radio"
                      name="savedAddress"
                      className="h-4 w-4 accent-[#0F4C4A]"
                      checked={selectedAddressId === ""}
                      onChange={() => {
                        setSelectedAddressId("");
                        setForm(emptyForm);
                      }}
                    />
                    <span>Use a new address</span>
                  </label>
                </li>
              </ul>
            ) : null}
            {selectedAddressId === "" || (addresses && addresses.length === 0) ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="fullName" className="block text-sm text-inkSoft">Full name</label>
                  <Input id="fullName" autoComplete="name" value={form.fullName}
                    onChange={(e) => setField("fullName", e.target.value)} className="mt-1" />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="line1" className="block text-sm text-inkSoft">Address line 1</label>
                  <Input id="line1" autoComplete="address-line1" value={form.line1}
                    onChange={(e) => setField("line1", e.target.value)} className="mt-1" />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="line2" className="block text-sm text-inkSoft">Address line 2 (optional)</label>
                  <Input id="line2" autoComplete="address-line2" value={form.line2}
                    onChange={(e) => setField("line2", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label htmlFor="city" className="block text-sm text-inkSoft">City</label>
                  <Input id="city" autoComplete="address-level2" value={form.city}
                    onChange={(e) => setField("city", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label htmlFor="region" className="block text-sm text-inkSoft">Region or state</label>
                  <Input id="region" autoComplete="address-level1" value={form.region}
                    onChange={(e) => setField("region", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label htmlFor="postalCode" className="block text-sm text-inkSoft">Postal code</label>
                  <Input id="postalCode" autoComplete="postal-code" value={form.postalCode}
                    onChange={(e) => setField("postalCode", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label htmlFor="country" className="block text-sm text-inkSoft">Country</label>
                  <select
                    id="country"
                    autoComplete="country"
                    value={form.country}
                    onChange={(e) => setField("country", e.target.value)}
                    className="mt-1 h-11 w-full rounded-btn border border-lineStrong bg-surface px-2 text-base text-ink"
                  >
                    {COUNTRY_CODES.map((code) => (
                      <option key={code} value={code}>{countryName(code)}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}
          </section>

          <section aria-labelledby="method" className="rounded-card border border-line bg-surface p-5">
            <h2 id="method" className="text-lg font-semibold">
              Shipping method
            </h2>
            <ul className="mt-3 space-y-2">
              {(methods.length > 0
                ? methods
                : [
                    { code: "standard", name: "Standard", priceCents: 499, freeOverCents: 5000, minDays: 3, maxDays: 5 },
                    { code: "express", name: "Express", priceCents: 1299, freeOverCents: null, minDays: 1, maxDays: 2 },
                  ]
              ).map((method) => {
                const free = quote && method.freeOverCents !== null && quote.subtotalCents >= method.freeOverCents;
                return (
                  <li key={method.code}>
                    <label
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-btn border p-3 text-sm transition-theme",
                        methodCode === method.code ? "border-brand bg-brandTint" : "border-line",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="shippingMethod"
                          className="h-4 w-4 accent-[#0F4C4A]"
                          checked={methodCode === method.code}
                          onChange={() => setMethodCode(method.code)}
                        />
                        <span>
                          {method.name} · {method.minDays}-{method.maxDays} business days
                        </span>
                      </span>
                      <span className="price">{free ? "Free" : formatCents(method.priceCents)}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="payment" className="rounded-card border border-line bg-surface p-5">
            <h2 id="payment" className="flex items-center gap-2 text-lg font-semibold">
              <Lock strokeWidth={1.75} className="h-5 w-5" aria-hidden="true" />
              Payment
            </h2>
            {clientSecret ? (
              <div className="mt-3">
                <PaymentSection
                  clientSecret={clientSecret}
                  orderNumber={orderNumber ?? ""}
                  totalLabel={`Pay ${formatCents(quote?.totalCents ?? 0)}`}
                />
              </div>
            ) : (
              <div className="mt-3">
                {error ? (
                  <p role="alert" className="mb-3 rounded-badge bg-dangerTint px-3 py-2 text-sm text-danger">
                    {error}
                  </p>
                ) : null}
                <Button variant="buy" onClick={onPlace} disabled={placing} className="w-full">
                  {placing ? "Please wait" : `Pay ${formatCents(quote?.totalCents ?? 0)}`}
                </Button>
                <p className="mt-2 text-sm text-inkMuted">
                  Card details are collected by Stripe. We never see your card number.
                </p>
              </div>
            )}
          </section>
        </div>

        <div className="hidden lg:block">
          <div className="sticky top-24">{summaryCard}</div>
        </div>
      </div>
    </div>
  );
}

function addressToForm(address: AddressOption): Partial<FormState> {
  return {
    fullName: address.fullName,
    line1: address.line1,
    line2: address.line2 ?? "",
    city: address.city,
    region: address.region ?? "",
    postalCode: address.postalCode,
    country: address.country,
    phone: address.phone ?? "",
  };
}
