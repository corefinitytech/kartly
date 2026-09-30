import type { Metadata } from "next";
import { CheckoutView } from "./view";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function CheckoutPage() {
  return <CheckoutView />;
}
