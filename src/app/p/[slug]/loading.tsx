import { Skeleton } from "@/components/ui/skeleton";

export default function ProductLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
      <Skeleton className="h-5 w-64" />
      <div className="mt-4 grid gap-8 lg:grid-cols-[2fr_1fr_1fr]">
        <div>
          <Skeleton className="aspect-square w-full rounded-card" />
          <div className="mt-3 flex gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-16 w-16 rounded-btn" />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-20 w-full" />
        </div>
        <div className="hidden lg:block">
          <Skeleton className="h-64 w-full rounded-card" />
        </div>
      </div>
    </div>
  );
}
