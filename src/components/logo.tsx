import { cn } from "@/lib/utils";

export function Logo({ onDark = false, className }: { onDark?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "font-heading text-2xl font-bold leading-none",
        onDark ? "text-white" : "text-ink",
        className,
      )}
    >
      kartly
      <span aria-hidden="true" className="ml-0.5 inline-block h-[0.22em] w-[0.22em] rounded-[1px] bg-accent" />
    </span>
  );
}
