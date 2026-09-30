import type { Metadata } from "next";
import { DEMO_ADMIN, demoAdminPrefillEnabled } from "@/modules/admin/demo";
import { LoginForm } from "./form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; notice?: string }>;
}) {
  const { next, notice } = await searchParams;
  // Signing in to the admin area: prefill the demo admin (dev, or DEMO_ADMIN_PREFILL=true).
  const prefill =
    next?.startsWith("/admin") && demoAdminPrefillEnabled()
      ? { email: DEMO_ADMIN.email, password: DEMO_ADMIN.password }
      : undefined;
  return <LoginForm next={next} notice={notice} prefill={prefill} />;
}
