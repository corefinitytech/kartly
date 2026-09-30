import type { Metadata } from "next";
import { requireUser } from "@/modules/auth/session";
import { getPrivacyOverview } from "@/modules/privacy/dsar-service";
import { PrivacyCentre } from "./view";

export const metadata: Metadata = {
  title: "Privacy",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const user = await requireUser("/account/privacy");
  const overview = await getPrivacyOverview(user.id);
  return <PrivacyCentre overview={overview} email={user.email} name={user.name} />;
}
