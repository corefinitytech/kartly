"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function NotificationsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
      <ErrorState title="Notifications did not load" description="Please try again." onRetry={reset} />
    </div>
  );
}
