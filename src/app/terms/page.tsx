import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Terms of service", description: "The terms that apply when you order from Kartly." };

export default function Page() {
  return (
    <LegalPage title="Terms of service">
      <p>
        By placing an order you agree to these terms. Kartly is a single-vendor store: the operator sells all items
        listed.
      </p>
      <h2 className="text-xl font-semibold">Prices and payment</h2>
      <p>
        Prices are in US dollars and shown including shipping and tax before you check out. Payment is processed by
        Stripe. We never see or store your full card number.
      </p>
      <h2 className="text-xl font-semibold">Orders</h2>
      <p>
        An order is a request until payment is confirmed. If an item sells out before payment clears, the order is
        cancelled and you are not charged.
      </p>
      <h2 className="text-xl font-semibold">Accounts</h2>
      <p>
        You must be 16 or older to create an account. You are responsible for keeping your password safe. You can
        delete your account at any time.
      </p>
      <h2 className="text-xl font-semibold">Returns</h2>
      <p>Return rights are described in the returns policy.</p>
    </LegalPage>
  );
}
