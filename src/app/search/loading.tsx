import { Skeleton } from "@/components/ui/skeleton";

export default function ListingLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
      <Skeleton className="h-8 w-48" />
      <div className="mt-6 flex gap-8">
        <Skeleton className="hidden w-64 shrink-0 lg:block" />
        <div className="min-w-0 flex-1">
          <div className="mb-4 flex items-center justify-between">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-11 w-40" />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="rounded-card border border-line bg-surface">
                <Skeleton className="aspect-square rounded-t-card" />
                <Skeleton className="m-3 h-4 w-full" />
                <Skeleton className="mx-3 h-4 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
