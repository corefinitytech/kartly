import type { Metadata } from "next";
import { SignupForm } from "./form";

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function SignupPage() {
  return <SignupForm />;
}
