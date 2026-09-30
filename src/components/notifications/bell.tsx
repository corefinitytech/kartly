"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

/** Fired by the notifications page after marking items read, so the badge follows. */
export const UNREAD_EVENT = "kt:notifications-unread";

/**
 * Header bell with unread count. Renders nothing for guests and fetches only
 * after hydration, so the static catalog pages stay static.
 */
export function NotificationBell({ className }: { className?: string }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [unread, setUnread] = useState<number | null>(null);
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) {
      setUnread(null);
      return;
    }
    const controller = new AbortController();
    fetch("/api/notifications?count=1", { signal: controller.signal, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { data?: { unread: number } } | null) => {
        if (body?.data) setUnread(body.data.unread);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [userId, pathname]);

  useEffect(() => {
    const onUnread = (event: Event) => setUnread((event as CustomEvent<number>).detail);
    window.addEventListener(UNREAD_EVENT, onUnread);
    return () => window.removeEventListener(UNREAD_EVENT, onUnread);
  }, []);

  if (!userId) return null;
  const label = unread ? `Notifications, ${unread} unread` : "Notifications";
  return (
    <Link
      href="/notifications"
      aria-label={label}
      className={cn("relative flex h-11 w-11 items-center justify-center rounded-btn text-white hover:bg-brand", className)}
    >
      <Bell strokeWidth={1.75} className="h-5 w-5" aria-hidden="true" />
      {unread ? (
        <span className="absolute right-1 top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-semibold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
