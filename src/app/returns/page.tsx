import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Returns policy", description: "Return most items within 30 days of delivery for a refund." };

export default function Page() {
  return (
    <LegalPage title="Returns policy">
      <p>
        You can return most items within 30 days of delivery for a refund to your original payment method. The
        returns flow opens with the account features.
      </p>
      <h2 className="text-xl font-semibold">Condition</h2>
      <p>Items should be returned in the condition they arrived in, with packaging where practical.</p>
      <h2 className="text-xl font-semibold">Refunds</h2>
      <p>
        Once a return is approved, the refund is issued to your original payment method. Shipping is refunded when the
        item was faulty or sent in error.
      </p>
      <h2 className="text-xl font-semibold">Contact</h2>
      <p>Start a return from your order page once order history is available, or contact us directly.</p>
    </LegalPage>
  );
}
