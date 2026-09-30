import type { Metadata } from "next";
import { OrderDetailView } from "./view";

export const metadata: Metadata = {
  title: "Order",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  return <OrderDetailView number={number} />;
}
