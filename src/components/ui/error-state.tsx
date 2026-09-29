"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  description = "We could not load this. Please try again.",
  retryLabel = "Try again",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-line bg-surface px-6 py-16 text-center">
      <AlertTriangle aria-hidden="true" strokeWidth={1.75} className="h-6 w-6 text-inkMuted" />
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-sm text-sm text-inkSoft">{description}</p>
      <Button variant="tertiary" onClick={onRetry} className="mt-2">
        <RotateCcw aria-hidden="true" strokeWidth={1.75} className="h-5 w-5" />
        {retryLabel}
      </Button>
    </div>
  );
}
