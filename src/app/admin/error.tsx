"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState description="This admin page could not load. Nothing was changed." onRetry={reset} />;
}
