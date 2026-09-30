import type { Metadata } from "next";
import { LookupForm } from "./form";

export const metadata: Metadata = {
  title: "Find an order",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function OrderLookupPage() {
  return <LookupForm />;
}
