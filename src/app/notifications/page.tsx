import type { Metadata } from "next";
import { requireUser } from "@/modules/auth/session";
import { listForUser } from "@/modules/notifications/service";
import { NotificationsView } from "./view";

export const metadata: Metadata = { title: "Notifications", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireUser("/notifications");
  const first = await listForUser(user.id, 1);
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
      <NotificationsView initial={first} />
    </div>
  );
}
