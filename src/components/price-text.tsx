import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/money";

interface PriceTextProps {
  cents: number;
  compareAtCents?: number | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function PriceText({ cents, compareAtCents, className, size = "md" }: PriceTextProps) {
  const discount = compareAtCents && compareAtCents > cents
    ? Math.round(((compareAtCents - cents) / compareAtCents) * 100)
    : null;
  return (
    <span className={cn("inline-flex items-baseline gap-2", className)}>
      <span
        className={cn(
          "price",
          size === "sm" && "text-sm",
          size === "md" && "text-base",
          size === "lg" && "text-2xl",
        )}
      >
        {formatCents(cents)}
      </span>
      {compareAtCents && compareAtCents > cents ? (
        <span className="text-sm text-inkMuted line-through">{formatCents(compareAtCents)}</span>
      ) : null}
      {discount ? <span className="price text-sm text-danger">−{discount}%</span> : null}
    </span>
  );
}
