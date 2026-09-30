"use client";

import { useMemo, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";

let stripePromise: Promise<Stripe | null> | null = null;

function getStripe(publishableKey?: string): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = loadStripe(
      publishableKey ?? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
    );
  }
  return stripePromise;
}

const appearance = {
  variables: {
    colorPrimary: "#0F4C4A",
    colorText: "#1B1F1E",
    colorBackground: "#FFFFFF",
    colorDanger: "#B42318",
    fontFamily: "Public Sans, system-ui, sans-serif",
    borderRadius: "6px",
  },
};

function PayForm({ orderNumber, totalLabel }: { orderNumber: string; totalLabel: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const onPay = async () => {
    if (!stripe || !elements) return;
    setPending(true);
    setError("");
    const token = sessionStorage.getItem(`order-token-${orderNumber}`) ?? "";
    const baseUrl = window.location.origin;
    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${baseUrl}/checkout/success?order=${orderNumber}${token ? `#${token}` : ""}`,
      },
    });
    if (confirmError) {
      setError(confirmError.message ?? "Payment could not be completed. Please try again.");
      setPending(false);
    }
  };

  return (
    <div>
      {error ? (
        <p role="alert" className="mb-3 rounded-badge bg-dangerTint px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <PaymentElement />
      <Button variant="buy" onClick={onPay} disabled={pending || !stripe} className="mt-4 w-full">
        {pending ? "Processing" : totalLabel}
      </Button>
    </div>
  );
}

export function PaymentSection({
  clientSecret,
  orderNumber,
  totalLabel,
}: {
  clientSecret: string;
  orderNumber: string;
  totalLabel: string;
}) {
  const stripeClient = useMemo(() => getStripe(), []);
  return (
    <Elements stripe={stripeClient} options={{ clientSecret, appearance }}>
      <PayForm orderNumber={orderNumber} totalLabel={totalLabel} />
    </Elements>
  );
}
