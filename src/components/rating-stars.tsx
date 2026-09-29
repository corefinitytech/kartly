import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingStarsProps {
  rating: number;
  count?: number;
  className?: string;
}

export function RatingStars({ rating, count, className }: RatingStarsProps) {
  const clamped = Math.max(0, Math.min(5, rating));
  return (
    <span className={cn("inline-flex items-center gap-1", className)} aria-label={`Rated ${clamped.toFixed(1)} out of 5`}>
      <span className="inline-flex" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            strokeWidth={1.75}
            className={cn("h-4 w-4", i < Math.round(clamped) ? "fill-star text-star" : "text-lineStrong")}
          />
        ))}
      </span>
      <span className="text-sm text-inkSoft">{clamped.toFixed(1)}</span>
      {typeof count === "number" ? (
        <span className="text-sm text-inkSoft">({count})</span>
      ) : null}
    </span>
  );
}
