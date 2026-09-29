import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-2 px-4 py-24 text-center">
      <SearchX strokeWidth={1.75} className="h-6 w-6 text-inkMuted" />
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-sm text-inkSoft">The page you are looking for does not exist or may have moved.</p>
      <Link
        href="/"
        className="mt-2 inline-flex min-h-11 items-center rounded-btn bg-brand px-4 text-base font-medium text-white hover:bg-brandDeep"
      >
        Back to the store
      </Link>
    </div>
  );
}
