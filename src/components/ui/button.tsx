import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-btn px-4 text-base font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        buy: "bg-accent text-white hover:bg-accentHover active:bg-accentPressed",
        secondary: "bg-brand text-white hover:bg-brandDeep",
        tertiary: "border border-lineStrong bg-surface text-ink hover:bg-sunken",
        text: "min-h-0 text-brandLink underline underline-offset-4 hover:opacity-80",
      },
      size: {
        default: "",
        sm: "min-h-9 px-3 text-sm",
        lg: "min-h-12 px-6 text-lg",
        icon: "w-11 px-0",
      },
    },
    defaultVariants: {
      variant: "tertiary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
