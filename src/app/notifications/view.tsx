"use client";

import { useState } from "react";
import Link from "next/link";
import { BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UNREAD_EVENT } from "@/components/notifications/bell";
import type { NotificationItem } from "@/modules/notifications/service";
import { cn } from "@/lib/utils";

interface Page {
  items: NotificationItem[];
  unread: number;
  hasMore: boolean;
}

const when = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function announce(unread: number) {
  window.dispatchEvent(new CustomEvent(UNREAD_EVENT, { detail: unread }));
}

export function NotificationsView({ initial }: { initial: Page }) {
  const [items, setItems] = useState(initial.items);
  const [unread, setUnread] = useState(initial.unread);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<"all" | "more" | null>(null);
  const [error, setError] = useState("");

  const post = async (body: object): Promise<number | null> => {
    const response = await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (!response?.ok) return null;
    const json = (await response.json()) as { data?: { unread: number } };
    return json.data?.unread ?? null;
  };

  const markOne = async (id: string) => {
    const now = new Date().toISOString();
    setItems((list) => list.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? now } : n)));
    const next = await post({ id });
    if (next !== null) {
      setUnread(next);
      announce(next);
    }
  };

  const markAll = async () => {
    setBusy("all");
    setError("");
    const next = await post({ all: true });
    setBusy(null);
    if (next === null) {
      setError("Could not mark them as read. Please try again.");
      return;
    }
    const now = new Date().toISOString();
    setItems((list) => list.map((n) => ({ ...n, readAt: n.readAt ?? now })));
    setUnread(0);
    announce(0);
  };

  const loadMore = async () => {
    setBusy("more");
    setError("");
    const response = await fetch(`/api/notifications?page=${page + 1}`, { cache: "no-store" }).catch(() => null);
    setBusy(null);
    if (!response?.ok) {
      setError("Could not load more. Please try again.");
      return;
    }
    const json = (await response.json()) as { data: Page };
    setItems((list) => [...list, ...json.data.items.filter((n) => !list.some((x) => x.id === n.id))]);
    setHasMore(json.data.hasMore);
    setPage((p) => p + 1);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-inkSoft" aria-live="polite">
            {unread === 0 ? "You're all caught up." : `${unread} unread`}
          </p>
        </div>
        {unread > 0 ? (
          <Button variant="secondary" onClick={markAll} disabled={busy === "all"}>
            {busy === "all" ? "Marking" : "Mark all as read"}
          </Button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-3 rounded-badge bg-dangerTint px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {items.length === 0 ? (
        <div className="anim-fade-in mt-4 flex flex-col items-start gap-2 rounded-card border border-line bg-surface px-6 py-10">
          <BellOff strokeWidth={1.75} className="h-6 w-6 text-inkMuted" aria-hidden="true" />
          <p className="text-lg font-semibold">No notifications yet</p>
          <p className="text-sm text-inkSoft">Order updates appear here: confirmed, shipped, delivered and refunds.</p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {items.map((n) => {
            const isUnread = !n.readAt;
            const content = (
              <>
                <span className="flex items-start justify-between gap-3">
                  <span className={cn("text-base", isUnread ? "font-semibold text-ink" : "text-ink")}>{n.title}</span>
                  <time dateTime={n.createdAt} className="shrink-0 text-xs text-inkMuted">
                    {when.format(new Date(n.createdAt))}
                  </time>
                </span>
                <span className="mt-1 block text-sm text-inkSoft">{n.body}</span>
              </>
            );
            return (
              <li key={n.id} className={cn("relative", isUnread && "bg-brandTint/40")}>
                {isUnread ? (
                  <span className="absolute left-2 top-5 h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
                ) : null}
                <div className="flex flex-col gap-2 py-3 pl-6 pr-4 sm:flex-row sm:items-center">
                  {n.href ? (
                    <Link href={n.href} onClick={() => isUnread && void markOne(n.id)} className="block min-w-0 flex-1 hover:underline-offset-4">
                      <span className="sr-only">{isUnread ? "Unread: " : ""}</span>
                      {content}
                    </Link>
                  ) : (
                    <div className="min-w-0 flex-1">{content}</div>
                  )}
                  {isUnread ? (
                    <Button variant="text" size="sm" onClick={() => void markOne(n.id)} className="self-start sm:self-center">
                      Mark as read
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore ? (
        <div className="mt-4">
          <Button variant="tertiary" onClick={loadMore} disabled={busy === "more"}>
            {busy === "more" ? "Loading" : "Show older"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
