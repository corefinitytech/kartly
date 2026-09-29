import type { LucideIcon } from "lucide-react";
import { PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon = PackageOpen, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-line bg-surface px-6 py-16 text-center">
      <Icon aria-hidden="true" strokeWidth={1.75} className="h-6 w-6 text-inkMuted" />
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-sm text-sm text-inkSoft">{description}</p>
      {actionLabel && onAction ? (
        <Button variant="secondary" onClick={onAction} className="mt-2">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
