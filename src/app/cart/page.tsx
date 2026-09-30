import type { Metadata } from "next";
import { CartPageClient } from "@/components/cart/cart-page-client";

export const metadata: Metadata = {
  title: "Cart",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function CartPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
      <CartPageClient />
    </div>
  );
}
