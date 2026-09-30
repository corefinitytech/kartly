import type { Metadata } from "next";
import { ForgotForm } from "./form";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return <ForgotForm />;
}
