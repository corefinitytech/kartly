import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit items-center rounded-badge px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-sunken text-inkSoft",
        lowStock: "bg-warningTint text-warning",
        outOfStock: "bg-sunken text-inkSoft",
        discount: "bg-dangerTint text-danger",
        success: "bg-surface text-success border border-line",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
