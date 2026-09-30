"use client";

import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type AddToCartState = "idle" | "pending" | "added";

export function AddToCartButton({
  state,
  children,
  className,
  ...props
}: React.ComponentProps<"button"> & { state: AddToCartState }) {
  return (
    <button
      type="button"
      disabled={state !== "idle" ? true : props.disabled}
      className={cn(
        "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-btn bg-accent px-4 text-base font-medium text-white transition-colors duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)] hover:bg-accentHover active:bg-accentPressed disabled:pointer-events-none disabled:opacity-60",
        className,
      )}
      {...props}
    >
      {state === "pending" ? <Loader2 strokeWidth={1.75} className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
      {state === "added" ? <Check strokeWidth={1.75} className="h-5 w-5" aria-hidden="true" /> : null}
      {state === "added" ? "Added" : state === "pending" ? "Adding" : children}
    </button>
  );
}
