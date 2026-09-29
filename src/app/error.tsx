"use client";

import { AlertTriangle } from "lucide-react";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-2 px-4 py-24 text-center">
      <AlertTriangle strokeWidth={1.75} className="h-6 w-6 text-inkMuted" />
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-inkSoft">An unexpected error occurred. Please try again.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 inline-flex min-h-11 items-center rounded-btn bg-brand px-4 text-base font-medium text-white hover:bg-brandDeep"
      >
        Try again
      </button>
    </div>
  );
}
