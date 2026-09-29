import { Skeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
      <div className="rounded-card border border-line bg-surface px-6 py-10">
        <Skeleton className="h-9 w-3/4 max-w-2xl" />
        <Skeleton className="mt-3 h-5 w-1/2 max-w-xl" />
      </div>
      <Skeleton className="mt-10 h-7 w-32" />
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="rounded-card border border-line bg-surface">
            <Skeleton className="aspect-square rounded-t-card" />
            <Skeleton className="m-3 h-4 w-3/4" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-10 h-7 w-24" />
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="rounded-card border border-line bg-surface">
            <Skeleton className="aspect-square rounded-t-card" />
            <Skeleton className="m-3 h-4 w-full" />
            <Skeleton className="mx-3 mb-3 h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
